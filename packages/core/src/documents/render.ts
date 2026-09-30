import { type ProjectedField, type ProjectedTable, projectBase } from '../catalog/projection.js'
import { BasedbError } from '../errors/index.js'
import { requireOnTable } from '../rbac/require.js'
import { listRecords } from '../records/list.js'
import { richTextToPlain } from '../records/rich-text.js'
import { VARIABLE } from '../records/variables.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import { withTransaction } from '../tx/context.js'
import { findFonts } from './fonts.js'
import { type LaidBlock, type LaidDocument, layoutPdf } from './layout.js'
import {
  type DocumentBlock,
  type DocumentSpec,
  MAX_ROWS_LISTED,
  SHEET,
  normalizeSpec,
} from './spec.js'
import { readTemplate } from './templates.js'

/**
 * A row as a document — chapter 21 §3. Everything is read with the rights of whoever asks:
 * the row through the one point of enforcement (a row they may not read is not found), its
 * linked rows likewise, its fields through their mask — a hidden column is left out of the
 * document as it is out of the screen. A template therefore gives nothing to read that is
 * not read already: it only lays it out.
 */

type Row = Readonly<Record<string, unknown>>

/** Yes and no, in each language a document may be written in. */
const YES_NO: Readonly<Record<string, readonly [string, string]>> = {
  fr: ['oui', 'non'],
  en: ['yes', 'no'],
  de: ['ja', 'nein'],
  es: ['sí', 'no'],
  it: ['sì', 'no'],
  'pt-BR': ['sim', 'não'],
  nl: ['ja', 'nee'],
  pl: ['tak', 'nie'],
  cs: ['ano', 'ne'],
  sv: ['ja', 'nej'],
  da: ['ja', 'nej'],
  nb: ['ja', 'nei'],
  fi: ['kyllä', 'ei'],
  ro: ['da', 'nu'],
  hu: ['igen', 'nem'],
  tr: ['evet', 'hayır'],
  uk: ['так', 'ні'],
  ja: ['はい', 'いいえ'],
  'zh-CN': ['是', '否'],
  ko: ['예', '아니요'],
}

const NUMERIC = new Set(['number', 'count', 'autonumber'])

/** The word the total row of a table opens with. */
const TOTAL: Readonly<Record<string, string>> = {
  fr: 'Total',
  en: 'Total',
  de: 'Summe',
  es: 'Total',
  it: 'Totale',
  'pt-BR': 'Total',
  nl: 'Totaal',
  pl: 'Suma',
  cs: 'Celkem',
  sv: 'Summa',
  da: 'I alt',
  nb: 'Totalt',
  fi: 'Yhteensä',
  ro: 'Total',
  hu: 'Összesen',
  tr: 'Toplam',
  uk: 'Разом',
  ja: '合計',
  'zh-CN': '合计',
  ko: '합계',
}

/** The kind a value reads as: a computed field's result, or the field's own. */
const kindOf = (field: ProjectedField) => field.computed?.resultKind ?? field.kind

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface Formatter {
  (value: unknown, field: ProjectedField): string
  number(value: unknown, field: ProjectedField): string
}

function formatter(
  locale: string,
  timezone: string,
  people: ReadonlyMap<string, string>,
  formatOf: (field: ProjectedField) => ProjectedField['format'],
): Formatter {
  const [yes, no] = YES_NO[locale] ?? ['yes', 'no']
  const numberText = (value: unknown, field: ProjectedField): string => {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return String(value ?? '')
    const format = formatOf(field)
    try {
      switch (format?.display) {
        case 'currency':
          return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: format.currency ?? 'EUR',
          }).format(n)
        case 'percent':
          return new Intl.NumberFormat(locale, {
            style: 'percent',
            maximumFractionDigits: 2,
          }).format(n / 100)
        case 'integer':
          return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)
        case 'duration': {
          const s = Math.round(n)
          const h = Math.floor(s / 3600)
          const m = Math.floor((s % 3600) / 60)
          return `${h}:${String(m).padStart(2, '0')}${s % 60 === 0 ? '' : `:${String(s % 60).padStart(2, '0')}`}`
        }
        case 'rating':
          return `${Math.round(n)} / ${format.ratingMax ?? 5}`
        default:
          return new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(n)
      }
    } catch {
      return String(n)
    }
  }
  const one = (value: unknown, field: ProjectedField, kind: string): string => {
    if (value === null || value === undefined || value === '') return ''
    switch (kind) {
      case 'number':
      case 'count':
      case 'autonumber':
        return numberText(value, field)
      case 'boolean':
        return value === true ? yes : no
      case 'date': {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
        if (match === null) return String(value)
        return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
          new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))),
        )
      }
      case 'datetime': {
        const at = new Date(String(value))
        if (Number.isNaN(at.getTime())) return String(value)
        try {
          return new Intl.DateTimeFormat(locale, {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: timezone,
          }).format(at)
        } catch {
          return at.toISOString()
        }
      }
      case 'select':
        return field.options?.find((o) => o.value === value)?.label ?? String(value)
      case 'user':
        return people.get(String(value)) ?? ''
      case 'link':
        return typeof value === 'object'
          ? String((value as { display?: unknown }).display ?? '')
          : String(value)
      case 'long_text':
        return field.unsafeHtml ? richTextToPlain(String(value)) : String(value)
      case 'file':
      case 'image':
        return typeof value === 'object'
          ? String((value as { name?: unknown }).name ?? '')
          : String(value)
      default:
        return typeof value === 'object' ? JSON.stringify(value) : String(value)
    }
  }
  const format = ((value: unknown, field: ProjectedField): string => {
    const kind = kindOf(field)
    if (Array.isArray(value)) {
      const each = kind === 'multi_select' ? 'select' : kind === 'multi_link' ? 'link' : kind
      return value
        .map((v) => one(v, field, each))
        .filter((t) => t !== '')
        .join(', ')
    }
    if (kind === 'multi_select') return one(value, field, 'select')
    return one(value, field, kind)
  }) as Formatter
  format.number = numberText
  return format
}

/** A text's citations, each replaced by the value the reader reads — or by nothing. */
function resolve(
  text: string,
  row: Row,
  fields: ReadonlyMap<string, ProjectedField>,
  known: ReadonlySet<string>,
  format: Formatter,
  html: boolean,
): string {
  return text.replace(VARIABLE, (whole, name: string) => {
    const field = fields.get(name)
    if (field === undefined) return known.has(name) ? '' : whole
    const value = format(row[name], field)
    return html ? escapeHtml(value) : value
  })
}

/** A file name every system takes: no separator, no reserved sign, no control character. */
const safeName = (text: string) =>
  [...text]
    .map((ch) => (ch.charCodeAt(0) < 0x20 || '\\/:*?"<>|'.includes(ch) ? '-' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

export interface RenderedDocument {
  readonly bytes: Buffer
  readonly filename: string
  readonly title: string
}

interface DocumentRequest {
  readonly tableId: string
  readonly recordId: string
  readonly templateId: string | null
  /**
   * A definition not saved yet, to see it before saving — building the table: it is
   * checked as a template's is, and `label` names it.
   */
  readonly draft?: { readonly label: unknown; readonly spec: unknown }
}

/**
 * The document of one row: with a template of its table, or — `templateId: null` — its
 * sheet, every field the reader reads, in the reader's language.
 */
export async function renderDocument(
  pools: Pools,
  ctx: RequestContext,
  request: DocumentRequest,
): Promise<RenderedDocument> {
  const prepared = await prepareDocument(pools, ctx, request)
  const bytes = await layoutPdf(prepared.laid, findFonts(prepared.laid.locale))
  return { bytes, filename: prepared.filename, title: prepared.laid.title }
}

/** What the document says, read and written out — before a page is set. */
export async function prepareDocument(
  pools: Pools,
  ctx: RequestContext,
  request: DocumentRequest,
): Promise<{ readonly laid: LaidDocument; readonly filename: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(request.recordId)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: request.recordId } })
  }
  const page = await listRecords(pools, ctx, {
    tableId: request.tableId,
    filter: `_id eq "${request.recordId.toLowerCase()}"`,
    limit: 1,
    links: 'display',
  })
  const row = page.rows[0]
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: request.recordId } })
  }

  const facts = await pools.withConnection('catalog', async (exec) => {
    const [table] = await exec.query<{ base_id: string; tenant_id: string }>(
      `SELECT t.base_id::text, b.tenant_id::text
         FROM _basedb.table_def t JOIN _basedb.base b ON b.id = t.base_id WHERE t.id = $1`,
      [request.tableId],
    )
    const [reader] =
      ctx.actor.kind === 'user'
        ? await exec.query<{ locale: string | null; timezone: string }>(
            'SELECT locale, timezone FROM _basedb.app_user WHERE id = $1',
            [ctx.actor.id],
          )
        : []
    const names = await exec.query<{ table_id: string; name: string }>(
      `SELECT f.table_id::text, n.name
         FROM _basedb.field f JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE f.is_live AND f.deleted_at IS NULL
          AND f.table_id IN (SELECT id FROM _basedb.table_def WHERE base_id = $1)`,
      [table?.base_id],
    )
    return { table, reader, names }
  })
  if (facts.table === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
  }

  const template =
    request.draft !== undefined
      ? await withTransaction(
          pools,
          'catalog',
          ctx,
          async (exec) => {
            await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
            return {
              label:
                typeof request.draft?.label === 'string' && request.draft.label.trim() !== ''
                  ? request.draft.label.trim()
                  : 'Aperçu',
              spec: await normalizeSpec(exec, request.tableId, request.draft?.spec),
            }
          },
          { readOnly: true },
        )
      : request.templateId === null
        ? null
        : await readTemplate(pools, ctx, { tableId: request.tableId, id: request.templateId })
  const readerLocale = facts.reader?.locale ?? 'fr'
  const spec: DocumentSpec = template?.spec ?? {
    ...SHEET,
    locale: readerLocale as DocumentSpec['locale'],
  }
  const timezone = facts.reader?.timezone ?? 'UTC'

  const base = await projectBase(pools, ctx, facts.table.base_id)
  const own = base.tables.find((t) => t.id === request.tableId) as ProjectedTable
  const byTable = (t: ProjectedTable | undefined) =>
    new Map((t?.fields ?? []).filter((f) => !f.system).map((f) => [f.name, f]))
  const known = (tableId: string) =>
    new Set(facts.names.filter((n) => n.table_id === tableId).map((n) => n.name))
  const fields = byTable(own)

  // The rows each table block lists, read with the same rights.
  const listed = new Map<number, { table: ProjectedTable; rows: Row[]; more: boolean }>()
  for (const [i, block] of spec.blocks.entries()) {
    if (block.kind !== 'rows') continue
    const found = await relatedRows(pools, ctx, base.tables, own, row, block)
    if (found !== null) listed.set(i, found)
  }

  // The names of the people the row and its rows name.
  const ids = new Set<string>()
  const collect = (r: Row, f: ReadonlyMap<string, ProjectedField>) => {
    for (const [name, field] of f) {
      if (kindOf(field) !== 'user') continue
      const v = r[name]
      for (const id of Array.isArray(v) ? v : [v]) if (typeof id === 'string') ids.add(id)
    }
  }
  collect(row, fields)
  for (const { table, rows } of listed.values()) for (const r of rows) collect(r, byTable(table))
  const people = new Map<string, string>()
  if (ids.size > 0) {
    const rows = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string; name: string }>(
        `SELECT id::text, coalesce(nullif(display_name, ''), email) AS name
           FROM _basedb.app_user WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
        [[...ids], facts.table?.tenant_id],
      ),
    )
    for (const p of rows) people.set(p.id, p.name)
  }

  // A lookup or a rollup reads as what it reaches: an amount stays an amount.
  const formatOf = (field: ProjectedField): ProjectedField['format'] => {
    if (field.format !== undefined) return field.format
    const via = field.computed?.via
    const target = field.computed?.target
    if (via === undefined || target === undefined || target === null) return undefined
    return base.tables.find((t) => t.name === via.reached)?.fields.find((f) => f.name === target)
      ?.format
  }
  const format = formatter(spec.locale, timezone, people, formatOf)

  // What names the row: its display column, else its first text the reader reads.
  const named =
    own.displayField !== null && fields.has(own.displayField)
      ? (fields.get(own.displayField) as ProjectedField)
      : [...fields.values()].find((f) => f.kind === 'short_text')
  const display =
    (named === undefined ? '' : format(row[named.name], named)) || String(row._id).slice(0, 8)
  const label = template?.label ?? own.label

  const blocks: LaidBlock[] = []
  if (template === null) blocks.push({ kind: 'html', html: `<h1>${escapeHtml(display)}</h1>` })
  for (const [i, block] of spec.blocks.entries()) {
    const laid = layBlock(block, i)
    if (laid !== null) blocks.push(laid)
  }

  function layBlock(block: DocumentBlock, i: number): LaidBlock | null {
    switch (block.kind) {
      case 'text':
        return block.html === ''
          ? null
          : { kind: 'html', html: resolve(block.html, row, fields, known(own.id), format, true) }
      case 'fields': {
        const names = block.fields.length === 0 ? [...fields.keys()] : block.fields
        const rows = names.flatMap((name) => {
          const field = fields.get(name)
          if (field === undefined || field.kind === 'button') return []
          return [{ label: field.label, value: format(row[name], field) }]
        })
        return rows.length === 0 ? null : { kind: 'fields', rows }
      }
      case 'rows': {
        const found = listed.get(i)
        if (found === undefined) return null
        const theirs = byTable(found.table)
        const columns = block.columns.flatMap((name) => {
          const field = theirs.get(name)
          return field === undefined ? [] : [field]
        })
        if (columns.length === 0) return null
        const numeric = (f: ProjectedField) =>
          NUMERIC.has(kindOf(f)) && f.computed?.multiple !== true
        const totals =
          block.totals.length === 0
            ? null
            : columns.map((f) => {
                if (!block.totals.includes(f.name) || !numeric(f)) return null
                const sum = found.rows.reduce((a, r) => {
                  const n = Number(r[f.name])
                  return Number.isFinite(n) ? a + n : a
                }, 0)
                return format.number(sum, f)
              })
        return {
          kind: 'table',
          title: block.title,
          columns: columns.map((f) => ({ label: f.label, numeric: numeric(f) })),
          rows: found.rows.map((r) => columns.map((f) => format(r[f.name], f))),
          // The first column says what the last row is, when it sums nothing itself.
          totals:
            totals === null
              ? null
              : totals.map((t, c) => (c === 0 && t === null ? (TOTAL[spec.locale] ?? 'Total') : t)),
          more: found.more ? `… ${MAX_ROWS_LISTED}+` : null,
        }
      }
      case 'break':
        return { kind: 'break' }
    }
  }

  return {
    laid: {
      title: `${label} — ${display}`,
      locale: spec.locale,
      page: spec.page,
      footer: resolve(spec.footer, row, fields, known(own.id), format, false),
      pageLabel: (p, n) => `${p} / ${n}`,
      blocks,
    },
    filename: `${safeName(`${label} — ${display}`)}.pdf`,
  }
}

/** The rows a table block lists, read with the reader's rights — `null`: not readable. */
async function relatedRows(
  pools: Pools,
  ctx: RequestContext,
  tables: readonly ProjectedTable[],
  own: ProjectedTable,
  row: Row,
  block: Extract<DocumentBlock, { kind: 'rows' }>,
): Promise<{ table: ProjectedTable; rows: Row[]; more: boolean } | null> {
  const source = block.source
  let table: ProjectedTable | undefined
  let filter: string
  if (source.kind === 'incoming') {
    table = tables.find((t) => t.id === source.table)
    const link = table?.fields.find((f) => f.name === source.field)
    if (table === undefined || link === undefined) return null
    filter =
      link.kind === 'multi_link'
        ? `${source.field} has_any ["${String(row._id)}"]`
        : `${source.field} eq "${String(row._id)}"`
  } else {
    const link = own.fields.find((f) => f.name === source.field)
    table = tables.find((t) => t.name === link?.link?.target?.table)
    const value = row[source.field]
    const ids = (Array.isArray(value) ? value : [])
      .map((v) => (typeof v === 'object' && v !== null ? (v as { id?: unknown }).id : v))
      .filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))
    if (table === undefined) return null
    if (ids.length === 0) return { table, rows: [], more: false }
    filter = `_id in [${ids.map((id) => `"${id}"`).join(', ')}]`
  }
  const page = await listRecords(pools, ctx, {
    tableId: table.id,
    filter,
    limit: MAX_ROWS_LISTED,
    links: 'display',
  })
  return { table, rows: [...page.rows], more: page.nextCursor !== null }
}
