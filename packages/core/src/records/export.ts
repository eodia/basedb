import { writeAudit } from '../audit/journal.js'
import { BasedbError } from '../errors/index.js'
import { loadFields } from '../rbac/loader.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, actorKey, withTransaction } from '../tx/context.js'
import { type Cell, MAX_COLUMNS, MAX_ROWS, numberOf, sheetNameOf, xlsxOf } from './export-xlsx.js'
import { type ListOptions, MAX_LIMIT, buildPlan, buildSelect, listRecords } from './list.js'
import { richTextToPlain } from './rich-text.js'

/**
 * Taking a whole table out — or a whole view: its filter, its sort, its columns.
 *
 * Decision A21 refused an export route because "a stream without a bound would pierce the
 * ceiling every other rule builds". It is lifted by the owner, for a reason that outweighs
 * it: a person must be able to leave with ALL their data. What the decision protected is
 * kept by construction here, not by the route's absence:
 *
 *   - every page is read by `listRecords` itself — the same decision, the same read mask,
 *     the same row predicate, the same link resolution as the page the grid shows. No
 *     second reading path exists to drift from the first, so a masked field is not in the
 *     file and a row the reader cannot see is not in it either;
 *   - it walks the table by cursor, page after page, never holding more than one page;
 *   - it is BOUNDED: a number of rows (refused up front, before the first byte, not cut
 *     off silently), a wall-clock budget, a few exports at once per actor — and every
 *     statement runs under the data pool's own `statement_timeout`;
 *   - it is written to `audit_log`: who took what, in which shape, how many rows. Never a
 *     value: the filter's text is not kept, only that there was one.
 *
 * It is NOT a snapshot. Rows written while the file is produced may be missed, or seen
 * twice if their sort key moves — exactly what paging through the API does. Holding one
 * transaction open for the time a slow client takes to read would be worse: the server
 * closes an idle one, and an export would die half way.
 */

export type ExportFormat = 'csv' | 'json' | 'xlsx'

export const RECORD_EXPORT_FORMATS: readonly ExportFormat[] = ['csv', 'json', 'xlsx']

/** The rows an export may hold — also the most a sheet can: one is left for the header. */
export const RECORD_EXPORT_MAX_ROWS = 1_000_000

/** How long one export may run, from the first page to the last. */
export const EXPORT_MAX_MS = 30 * 60_000

/** Exports one actor may run at once: each holds a page of the pool at a time, for long. */
export const EXPORTS_PER_ACTOR = 3

export interface ExportOptions {
  readonly tableId: string
  readonly format: ExportFormat
  /** Filter expression, grammar of chapter 08 §4.1 — the one a page takes. */
  readonly filter?: string
  /** `field` or `-field`, comma separated (§4.2) — the one a page takes. */
  readonly sort?: string
  /**
   * The columns to write, by physical name, in THIS order — the visible columns of a view.
   * Absent: every column the reader may read, system columns first. A name the reader
   * cannot read is refused like an unknown one.
   */
  readonly fields?: readonly string[]
  /**
   * What a spreadsheet's header row says: the physical `name` (the default, like the
   * CSV of the page and what `psql` shows) or the `label` a person reads. JSON keys are
   * always physical names.
   */
  readonly headers?: 'name' | 'label'
  /** A lower ceiling than the kernel's own, for a caller that wants one. */
  readonly maxRows?: number
}

/** An export under way: its headers, and its bytes, produced as they are read. */
export interface RecordExport {
  readonly format: ExportFormat
  readonly contentType: string
  /** `ventes-2026-10-09.csv` — the table's physical name and the day, ASCII only. */
  readonly filename: string
  /** The columns written, in order. */
  readonly columns: readonly string[]
  /**
   * The file. Pulled by the reader at its own pace: a slow client slows the reading of the
   * table, it does not pile pages up. A failure while it runs ends it with an error — the
   * response must be torn down, not closed cleanly on a file that stops short.
   */
  readonly body: AsyncGenerator<Uint8Array, void, undefined>
  /**
   * Lets go of what the export holds and writes its audit line. Called by whoever stops
   * reading, early or not; harmless the second time.
   */
  close(): Promise<void>
}

const CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Exports running now, by actor. */
const running = new Map<string, number>()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A column as the file writes it. */
export interface ExportColumn {
  readonly name: string
  readonly label: string
  readonly kind: string
  /** For a list-valued computed field — a lookup —, each element's kind. */
  readonly elementKind: string | undefined
  /** A long text holding HTML: written as the words it reads. */
  readonly rich: boolean
  /** A figure: a spreadsheet gets a number, not a text that looks like one. */
  readonly numeric: boolean
  /** The label of each choice, by stored value — for the two kinds of list. */
  readonly choices: ReadonlyMap<string, string> | undefined
}

/** What the system columns are, since the catalog does not describe them. */
const SYSTEM_KINDS: Readonly<Record<string, string>> = {
  _id: 'short_text',
  _created_at: 'datetime',
  _updated_at: 'datetime',
  _created_by: 'user',
  _updated_by: 'user',
}

const NUMERIC_KINDS: ReadonlySet<string> = new Set(['number', 'autonumber', 'count'])

// ── What a value reads as ────────────────────────────────────────────────────────────

/** A link cell — `{ id, display }` — as a person reads it. A masked one reads as nothing. */
function linkText(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value ?? '')
  const link = value as { id?: unknown; display?: unknown; masked?: unknown }
  if (link.masked === true) return ''
  // No display value — a table with none, a display column the reader cannot see — leaves
  // the identifier: a blank cell would lose which row it was, and the identifier is what the
  // API hands this reader in the same place.
  if (typeof link.display === 'string' && link.display !== '') return link.display
  return typeof link.id === 'string' ? link.id : ''
}

/** A file cell's entry — its name, which is all a text carries. */
function fileText(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value ?? '')
  const name = (value as { name?: unknown }).name
  return typeof name === 'string' ? name : ''
}

/**
 * A figure at the scale its column declares — `PostgreSQL` hands `numeric` back as a text,
 * `"1500.5000000000"` — as a person writes it: without the zeros that only fill the scale.
 */
function figureText(value: unknown): string | number {
  if (typeof value !== 'string' || !value.includes('.')) return value as string | number
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/** An instant as ISO 8601, UTC. What cannot be read as one is left as written. */
function instantText(value: unknown): string {
  const at = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(at.getTime()) ? String(value) : at.toISOString()
}

/** A calendar day, `YYYY-MM-DD`. */
function dayText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text
}

/**
 * One value, as a cell. Typed after what a person sees: a choice by its label, a person by
 * their name, a link by the label of the row it designates, a file by its name, a date
 * and an instant in ISO 8601, a long text by its words.
 */
function scalarCell(
  value: unknown,
  kind: string,
  column: ExportColumn,
  people: ReadonlyMap<string, string>,
): Cell {
  switch (kind) {
    case 'select':
    case 'multi_select':
      return column.choices?.get(String(value)) ?? String(value)
    case 'user':
      return people.get(String(value)) ?? String(value)
    case 'link':
    case 'multi_link':
      return linkText(value)
    case 'file':
    case 'image':
      return fileText(value)
    case 'long_text':
      return column.rich ? richTextToPlain(String(value)) : String(value)
    case 'date':
      return dayText(value)
    case 'datetime':
      return instantText(value)
    case 'boolean':
      return value === true || value === 'true'
    case 'number':
    case 'autonumber':
    case 'count':
      return figureText(value)
  }
  // Anything else — a formula, a rollup, a figure, a text — reads by what it is.
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const object = value as { display?: unknown; name?: unknown }
    if ('display' in object) return linkText(value)
    if (typeof object.name === 'string') return object.name
    return JSON.stringify(value)
  }
  return String(value)
}

/** A cell's value for the column: a list becomes its elements, written one after another. */
export function cellOf(
  value: unknown,
  column: ExportColumn,
  people: ReadonlyMap<string, string>,
): Cell {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) {
    const kind = column.elementKind ?? column.kind
    const parts = value
      .map((item) => scalarCell(item, kind, column, people))
      .map((part) => (part === null ? '' : String(part)))
      .filter((part) => part !== '')
    return parts.length === 0 ? null : parts.join(', ')
  }
  return scalarCell(value, column.kind, column, people)
}

/**
 * A text a spreadsheet would run as a formula, made harmless.
 *
 * Opened in Excel, a CSV cell that begins with `=`, `@`, `+` or `-` is a FORMULA, and a
 * collaborator can write one into a text field: whoever exports would run it. A quote in
 * front makes it text — the convention spreadsheets share. A figure or a dash followed by
 * a space or a digit is not touched: `-5`, `+33 1 23`, `- à faire`.
 */
export function neutralize(text: string): string {
  return /^[=@\t\r]/.test(text) || /^[+-][^\d\s.,]/.test(text) ? `'${text}` : text
}

/** RFC 4180: quoted as soon as a field carries a separator, a quote or a line break. */
export function csvField(cell: Cell): string {
  if (cell === null) return ''
  const text = typeof cell === 'string' ? neutralize(cell) : String(cell)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const encoder = new TextEncoder()

/** U+FEFF as UTF-8: written as bytes, so that no invisible character sits in this source. */
const BOM = Uint8Array.of(0xef, 0xbb, 0xbf)

// ── The export ───────────────────────────────────────────────────────────────────────

/**
 * Opens an export: decides, reads the first page, and hands back the file to pull.
 *
 * Everything that can be refused is refused HERE, before any byte: the table, the filter,
 * the sort, the columns, the size. The caller can still answer with a proper error; once
 * the file has begun, a failure can only cut it.
 */
export async function exportRecords(
  pools: Pools,
  ctx: RequestContext,
  options: ExportOptions,
  ceiling: number = RECORD_EXPORT_MAX_ROWS,
): Promise<RecordExport> {
  if (!RECORD_EXPORT_FORMATS.includes(options.format)) {
    throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'format' } })
  }
  const holder = actorKey(ctx)
  if ((running.get(holder) ?? 0) >= EXPORTS_PER_ACTOR) {
    throw new BasedbError('CONCURRENCY_LIMIT_EXCEEDED', {
      details: { exports: EXPORTS_PER_ACTOR },
    })
  }
  running.set(holder, (running.get(holder) ?? 0) + 1)
  let released = false
  const release = () => {
    if (released) return
    released = true
    const left = (running.get(holder) ?? 1) - 1
    if (left <= 0) running.delete(holder)
    else running.set(holder, left)
  }

  try {
    return await open(pools, ctx, options, ceiling, release)
  } catch (error) {
    release()
    throw error
  }
}

async function open(
  pools: Pools,
  ctx: RequestContext,
  options: ExportOptions,
  ceiling: number,
  release: () => void,
): Promise<RecordExport> {
  // A sheet holds a header and a million rows and a bit: the bound can never be higher.
  const maxRows = Math.max(
    1,
    Math.min(
      options.maxRows ?? ceiling,
      ceiling,
      options.format === 'xlsx' ? MAX_ROWS - 1 : Number.MAX_SAFE_INTEGER,
    ),
  )

  // Decided once, here, on the catalog: the table and the mask are the page's own.
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => buildPlan(exec, ctx, options.tableId),
    {
      readOnly: true,
    },
  )

  const asked = [...new Set((options.fields ?? []).map((f) => f.trim()).filter((f) => f !== ''))]
  for (const name of asked) {
    // The same refusal as an unknown column: a mask is not something to enumerate.
    if (!plan.columns.includes(name)) {
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: name } })
    }
  }
  const names = asked.length > 0 ? asked : [...plan.columns]
  if (options.format === 'xlsx' && names.length > MAX_COLUMNS) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { parameter: 'fields', reason: 'export_trop_large' },
    })
  }

  // Refused BEFORE the first byte: the filter and the sort are built (and refused if they
  // name a column this reader cannot read), then the rows are counted up to the bound. A
  // file that stopped at a million rows and looked whole would be the worst answer.
  const probe = buildSelect(
    plan,
    { tableId: options.tableId, filter: options.filter, sort: options.sort },
    1,
    {
      actorId: actorKey(ctx),
      tableId: options.tableId,
    },
  )
  const bounded = probe.countSql.replace(
    /LIMIT \d+\) AS bounded;\s*$/,
    `LIMIT ${maxRows + 1}) AS bounded;`,
  )
  if (bounded === probe.countSql) {
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'the count query changed shape' },
    })
  }
  const counted = await pools.withConnection('data', (exec) =>
    exec.query<{ n: string }>(bounded, probe.countParams),
  )
  if (Number(counted[0]?.n ?? 0) > maxRows) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { parameter: 'filter', reason: 'export_trop_gros', maximum: maxRows },
    })
  }

  const meta = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const [table] = await exec.query<{ base_id: string; name: string; label: string }>(
        `SELECT t.base_id::text AS base_id, tn.name, t.label
           FROM _basedb.table_def t
           JOIN _basedb.physical_name tn ON tn.id = t.name_id
          WHERE t.id = $1`,
        [options.tableId],
      )
      const labels = await exec.query<{ name: string; label: string }>(
        `SELECT n.name, f.label
           FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.table_id = $1 AND f.is_live`,
        [options.tableId],
      )
      const fields = await loadFields(exec, options.tableId)
      const choiceFields = names.filter((n) => {
        const kind = plan.filterable.get(n)?.kind
        return kind === 'select' || kind === 'multi_select'
      })
      const choiceRows =
        choiceFields.length === 0
          ? []
          : await exec.query<{ field: string; value: string; label: string }>(
              // A removed choice may still be held by a row: it keeps its label, and the
              // live ones come last so they win a repeated value.
              `SELECT n.name AS field, o.value, o.label
                 FROM _basedb.select_option o
                 JOIN _basedb.field f ON f.id = o.field_id
                 JOIN _basedb.physical_name n ON n.id = f.name_id
                WHERE f.table_id = $1 AND f.is_live AND n.name = ANY($2::text[])
                ORDER BY (o.deleted_at IS NULL), o.position`,
              [options.tableId, choiceFields],
            )
      return { table, labels, fields, choices: choiceRows }
    },
    { readOnly: true },
  )
  if (meta.table === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: options.tableId } })
  }

  const labelOf = new Map(meta.labels.map((l) => [l.name, l.label]))
  const richOf = new Set([...meta.fields.values()].filter((f) => f.rich).map((f) => f.name))
  const choicesOf = new Map<string, Map<string, string>>()
  for (const option of meta.choices) {
    const own = choicesOf.get(option.field) ?? new Map<string, string>()
    own.set(option.value, option.label)
    choicesOf.set(option.field, own)
  }
  const columns: ExportColumn[] = names.map((name) => {
    const filterable = plan.filterable.get(name)
    const kind = filterable?.kind ?? SYSTEM_KINDS[name] ?? 'short_text'
    return {
      name,
      // The system columns are described by no catalog row: their name is what there is.
      label: labelOf.get(name) ?? name,
      kind,
      elementKind: filterable?.elementKind,
      rich: richOf.has(name),
      numeric: NUMERIC_KINDS.has(kind),
      choices: choicesOf.get(name),
    }
  })

  // The page's own query, repeated with the cursor of the page before.
  const base: ListOptions = {
    tableId: options.tableId,
    limit: MAX_LIMIT,
    ...(options.filter === undefined ? {} : { filter: options.filter }),
    ...(options.sort === undefined ? {} : { sort: options.sort }),
    ...(asked.length === 0 ? {} : { select: asked }),
    links: 'display',
    variables: 'resolve',
  }
  const first = await listRecords(pools, ctx, base)

  // ── Pulling the table, a page at a time ───────────────────────────────────────────

  let delivered = 0
  let outcome: 'complete' | 'truncated' | 'failed' | 'aborted' = 'aborted'
  const people = new Map<string, string>()
  const userColumns = columns.filter((c) => (c.elementKind ?? c.kind) === 'user').map((c) => c.name)

  /** The names of the people a page cites, in one query for those not yet known. */
  const learn = async (rows: ReadonlyArray<Record<string, unknown>>) => {
    const wanted = new Set<string>()
    for (const row of rows) {
      for (const name of userColumns) {
        const value = row[name]
        for (const one of Array.isArray(value) ? value : [value]) {
          if (typeof one === 'string' && UUID.test(one) && !people.has(one)) wanted.add(one)
        }
      }
    }
    if (wanted.size === 0) return
    const found = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string; name: string }>(
        `SELECT id::text AS id, coalesce(nullif(display_name, ''), email) AS name
           FROM _basedb.app_user
          WHERE id = ANY($1::uuid[])`,
        [[...wanted]],
      ),
    )
    for (const person of found) people.set(person.id, person.name)
    // One that is not found is remembered as itself: it is not asked for again.
    for (const id of wanted) if (!people.has(id)) people.set(id, id)
  }

  async function* pages(): AsyncGenerator<ReadonlyArray<Record<string, unknown>>> {
    const started = Date.now()
    let page = first
    for (;;) {
      const room = maxRows - delivered
      const rows = page.rows.length > room ? page.rows.slice(0, room) : page.rows
      delivered += rows.length
      await learn(rows)
      if (rows.length > 0) yield rows
      if (!page.hasNextPage || page.nextCursor === null) {
        outcome = 'complete'
        return
      }
      if (delivered >= maxRows) {
        outcome = 'truncated'
        return
      }
      if (Date.now() - started > EXPORT_MAX_MS) {
        throw new BasedbError('DEADLINE_EXCEEDED', { details: { reason: 'export' } })
      }
      page = await listRecords(pools, ctx, { ...base, after: page.nextCursor })
    }
  }

  const header = columns.map((c) => (options.headers === 'label' ? c.label : c.name))

  async function* bytes(): AsyncGenerator<Uint8Array, void, undefined> {
    switch (options.format) {
      case 'csv': {
        // The BOM is not decoration: Excel on Windows reads a CSV without one as
        // Windows-1252, and every accented label comes out mangled.
        yield BOM
        yield encoder.encode(`${header.map(csvField).join(',')}\r\n`)
        for await (const rows of pages()) {
          let chunk = ''
          for (const row of rows) {
            chunk += `${columns.map((c) => csvField(cellOf(row[c.name], c, people))).join(',')}\r\n`
          }
          yield encoder.encode(chunk)
        }
        return
      }
      case 'json': {
        yield encoder.encode('[')
        let empty = true
        for await (const rows of pages()) {
          let chunk = ''
          for (const row of rows) {
            // What the API says, projected to the columns asked for: links as `{id,
            // display}`, choices by their stored value, lists as lists.
            const out: Record<string, unknown> = {}
            for (const c of columns) out[c.name] = row[c.name] ?? null
            chunk += `${empty ? '\n' : ',\n'}${JSON.stringify(out)}`
            empty = false
          }
          yield encoder.encode(chunk)
        }
        yield encoder.encode(empty ? ']\n' : '\n]\n')
        return
      }
      case 'xlsx': {
        async function* sheetRows() {
          for await (const rows of pages()) {
            yield rows.map((row) =>
              columns.map((c) => {
                const cell = cellOf(row[c.name], c, people)
                if (c.numeric && typeof cell === 'string') return numberOf(cell) ?? cell
                return cell
              }),
            )
          }
        }
        yield* xlsxOf(
          {
            name: sheetNameOf(meta.table?.label ?? meta.table?.name ?? ''),
            header,
            pages: sheetRows(),
          },
          ctx.timestamp,
        )
        return
      }
    }
  }

  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    release()
    try {
      await pools.withConnection('catalog', (exec) =>
        writeAudit(exec, ctx, {
          action: 'records.export',
          objectKind: 'table',
          objectId: options.tableId,
          objectName: meta.table?.name ?? null,
          baseId: meta.table?.base_id ?? null,
          tableId: options.tableId,
          // The shape of the request, never a value: that a filter was there, not what it
          // said (a cell value never enters the audit).
          payload: {
            export: {
              format: options.format,
              columns: names.slice(0, 200),
              filtered: (options.filter ?? '').trim() !== '',
              sort: options.sort ?? null,
              rows: delivered,
              outcome,
            },
          },
        }),
      )
    } catch (error) {
      // A journal that cannot be written must not fail a file that was read.
      console.error('journal d’export :', error instanceof Error ? error.message : error)
    }
  }

  // The reader stops → the generator's `finally` runs → the audit line is written once.
  async function* watched(): AsyncGenerator<Uint8Array, void, undefined> {
    try {
      yield* bytes()
    } catch (error) {
      outcome = 'failed'
      throw error
    } finally {
      await close()
    }
  }

  const day = ctx.timestamp.toISOString().slice(0, 10)
  return {
    format: options.format,
    contentType: CONTENT_TYPES[options.format],
    filename: `${meta.table.name}-${day}.${options.format}`,
    columns: names,
    body: watched(),
    close,
  }
}
