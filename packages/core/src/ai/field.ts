import { randomUUID } from 'node:crypto'
import { qualify, quoteIdentifier } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { requireOnField } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import {
  type AiKind,
  type AiOption,
  expectedFormat,
  isAiKind,
  isTextualAi,
  parseAnswer,
} from './answer.js'
import {
  type ProviderConfig,
  type ProviderTransport,
  assertQuota,
  computeFieldValue,
  resolveProvider,
} from './draft.js'
import {
  type CitableField,
  EMPTY_VALUE,
  type ValueContext,
  canonicalizePrompt,
  citedNames,
  formatValue,
  renderPrompt,
} from './prompt.js'
import { checkSchedule, nextRun, parseCron } from './schedule.js'

/**
 * Fields computed by the AI — chapter 12 §1.5, chapter 04 §7 bis.
 *
 * The AI is an OPTION of a field, not a type: a short or long text, an address, a number, a
 * choice, a yes-or-no or a date can be filled by a model (`AI_KINDS`), and the option can
 * be switched on and off on a field that exists. The answer is read into the column's type
 * (`answer.ts`); an answer holding no value of that type leaves the cell empty.
 *
 * A column a model fills. Its author writes a prompt citing other columns of the row —
 * `Résume {{notes}} en une phrase` — and says when it runs: whenever the cell is empty,
 * or again on a schedule, a cron expression read in the author's time zone. A cell is
 * empty when its row is new, and again when a person changes a column it cites: the
 * answer no longer holds for the row. The kernel does the rest, outside any request: it
 * reads the cited values, puts them in the prompt, asks the tenant's provider, and writes
 * the answer into the cell.
 *
 * Three rules hold it together:
 *
 *   NOBODY WRITES THE COLUMN. The decider withholds it from every write mask; only the
 *   kernel writes it, and a person asks it to — for one row, or for all.
 *
 *   THE VALUES LEAVE BY CONSENT. The cited values go to the provider: that is what the field
 *   is, and the exception it makes to INV-IA2. So it is created by someone who manages the
 *   schema, can read every column cited, and says yes explicitly (`consented_by`).
 *
 *   EVERY CALL IS COUNTED. One call per cell, journaled in `ai_call` as `field_compute`,
 *   under a quota of its own; a schedule may not run more often than every 15 minutes.
 */

export interface AiRefresh {
  /**
   * `if_empty`: a cell is computed when empty — a new row, or a cited column changed.
   * `schedule`: and again on the cron.
   */
  readonly mode: 'if_empty' | 'schedule'
  readonly cron?: string | null
  /** IANA zone the cron is read in — the author's, sent by the screen. */
  readonly timezone?: string | null
}

export interface AiFieldInput {
  readonly prompt: string
  readonly refresh: AiRefresh
  /** The author's explicit yes to the cited values leaving for the provider. */
  readonly consent?: boolean
}

interface PreparedConfig {
  readonly prompt: string
  readonly mode: 'if_empty' | 'schedule'
  readonly cron: string | null
  readonly timezone: string | null
  readonly nextSweepAt: Date | null
}

/** The identifier a sweep starts after: every real one is greater. */
const FIRST = '00000000-0000-0000-0000-000000000000'

interface FieldLine extends Record<string, unknown> {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly kind: string
}

/**
 * Validates a prompt and a schedule for a field of `tableId`, against what the AUTHOR can
 * read: citing a column is sending its values away, and nobody sends what they cannot see.
 */
async function prepareConfig(
  exec: Executor,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly self: string
    readonly input: AiFieldInput
  },
): Promise<PreparedConfig> {
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, request.tableId)
  if (target === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
  }
  const readable = decide(ctx, grants, 'read', target).readableFields
  const fields = await exec.query<FieldLine>(
    `SELECT f.id, n.name, f.label, f.kind
       FROM _basedb.field f JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position`,
    [request.tableId],
  )
  const citable: CitableField[] = fields.filter((f) => readable.has(f.id))
  const { prompt } = canonicalizePrompt(request.input.prompt ?? '', citable, request.self)

  const refresh = request.input.refresh
  if (refresh?.mode === 'schedule') {
    const cron = (refresh.cron ?? '').trim()
    const timezone = (refresh.timezone ?? '').trim() || 'UTC'
    const parsed = checkSchedule(cron, timezone, ctx.timestamp)
    return {
      prompt,
      mode: 'schedule',
      cron: cron.split(/\s+/).join(' '),
      timezone,
      nextSweepAt: nextRun(parsed, timezone, ctx.timestamp),
    }
  }
  if (refresh?.mode !== 'if_empty') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'refresh', reason: 'mode' } })
  }
  return { prompt, mode: 'if_empty', cron: null, timezone: null, nextSweepAt: null }
}

/**
 * Writes the configuration of a field just created — called by `addField`, inside its
 * transaction, once the column exists. Refused while AI is not configured: a field that
 * could never be filled is a column of empty cells nobody would understand.
 */
export async function insertAiConfig(
  exec: Executor,
  ctx: RequestContext,
  request: {
    readonly fieldId: string
    /** The field's type: the satellite carries it, and only `AI_KINDS` take the option. */
    readonly kind: string
    readonly tableId: string
    readonly column: string
    readonly input: AiFieldInput
  },
): Promise<void> {
  if (request.input.consent !== true) throw new BasedbError('AI_CONSENT_REQUIRED')
  if (!isAiKind(request.kind)) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'ai', reason: 'type_sans_ia', kind: request.kind },
    })
  }
  const config = await prepareConfig(exec, ctx, {
    tableId: request.tableId,
    self: request.column,
    input: request.input,
  })
  await resolveProvider(exec, ctx)
  await exec.query(
    `INSERT INTO _basedb.field_ai_config
       (field_id, prompt, refresh_mode, refresh_cron, refresh_timezone, next_sweep_at,
        consented_by, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      request.fieldId,
      config.prompt,
      config.mode,
      config.cron,
      config.timezone,
      config.nextSweepAt,
      ctx.actor.id,
      request.kind,
    ],
    'insert',
  )
}

/**
 * Moves the base's `catalog_version`: switching the option on or off changes what the
 * projection says of the field — computed or not, writable or not — and every cache keyed
 * on that version must drop it. The field's own trigger does the bumping.
 */
async function touchField(exec: Executor, ctx: RequestContext, fieldId: string): Promise<void> {
  await exec.query(
    'UPDATE _basedb.field SET updated_at = clock_timestamp(), updated_by = $2 WHERE id = $1',
    [fieldId, ctx.actor.id],
    'update',
  )
}

export interface AiFieldStatus {
  /** As stored, citations by physical name — the screen shows them with labels. */
  readonly prompt: string
  readonly cited: ReadonlyArray<{ readonly name: string; readonly label: string }>
  readonly refresh: {
    readonly mode: 'if_empty' | 'schedule'
    readonly cron: string | null
    readonly timezone: string | null
  }
  readonly nextSweepAt: string | null
  /** A recomputation of every row is under way. */
  readonly sweeping: boolean
  readonly lastRunAt: string | null
  /** The code of the last refusal, e.g. `AI_QUOTA_EXCEEDED`; `null` after a clean run. */
  readonly lastError: string | null
  readonly lastErrorAt: string | null
  readonly computedCount: number
  readonly consentedAt: string
}

interface StatusRow extends Record<string, unknown> {
  readonly table_id: string
  readonly prompt: string
  readonly refresh_mode: 'if_empty' | 'schedule'
  readonly refresh_cron: string | null
  readonly refresh_timezone: string | null
  readonly next_sweep_at: Date | null
  readonly sweep_after: string | null
  readonly last_run_at: Date | null
  readonly last_error: string | null
  readonly last_error_at: Date | null
  readonly computed_count: string
  readonly consented_at: Date
}

const iso = (d: Date | null) => (d === null ? null : new Date(d).toISOString())

/** How an AI field is set and how it is doing — for whoever can read the table. */
export async function aiFieldStatus(
  pools: Pools,
  ctx: RequestContext,
  fieldId: string,
): Promise<AiFieldStatus> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnField(exec, ctx, 'read', fieldId)
      const [row] = await exec.query<StatusRow>(
        `SELECT f.table_id, c.prompt, c.refresh_mode, c.refresh_cron, c.refresh_timezone,
                c.next_sweep_at, c.sweep_after, c.last_run_at, c.last_error, c.last_error_at,
                c.computed_count, c.consented_at
           FROM _basedb.field_ai_config c JOIN _basedb.field f ON f.id = c.field_id
          WHERE c.field_id = $1 AND f.is_live`,
        [fieldId],
      )
      if (row === undefined) {
        throw new BasedbError('REQUEST_INVALID', {
          details: { field: 'kind', reason: 'pas_un_champ_ia' },
        })
      }
      const names = citedNames(row.prompt)
      const labels = await exec.query<{ name: string; label: string }>(
        `SELECT n.name, f.label FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.table_id = $1 AND f.is_live AND n.name = ANY($2::text[])`,
        [row.table_id, names],
      )
      const labelOf = new Map(labels.map((l) => [l.name, l.label]))
      return {
        prompt: row.prompt,
        cited: names.map((name) => ({ name, label: labelOf.get(name) ?? name })),
        refresh: {
          mode: row.refresh_mode,
          cron: row.refresh_cron,
          timezone: row.refresh_timezone,
        },
        nextSweepAt: iso(row.next_sweep_at),
        sweeping: row.sweep_after !== null,
        lastRunAt: iso(row.last_run_at),
        lastError: row.last_error,
        lastErrorAt: iso(row.last_error_at),
        computedCount: Number(row.computed_count),
        consentedAt: new Date(row.consented_at).toISOString(),
      }
    },
    { readOnly: true },
  )
}

/**
 * Switches the AI option on for a field, or changes its prompt and/or its schedule.
 * Re-checked as at creation, and the one who changes them consents anew — the columns cited
 * may not be the same. `recompute` starts a recomputation of every row, which is what a new
 * prompt usually calls for; without it, only the empty cells are filled.
 */
export async function setAiField(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly fieldId: string
    readonly input: AiFieldInput
    readonly recompute?: boolean
  },
): Promise<AiFieldStatus> {
  if (request.input.consent !== true) throw new BasedbError('AI_CONSENT_REQUIRED')
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnField(exec, ctx, 'manage_schema', request.fieldId)
    const [field] = await exec.query<{
      table_id: string
      name: string
      kind: string
      has_ai: boolean
    }>(
      `SELECT f.table_id, n.name, f.kind,
              EXISTS (SELECT 1 FROM _basedb.field_ai_config c WHERE c.field_id = f.id) AS has_ai
         FROM _basedb.field f
         JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE f.id = $1 AND f.is_live`,
      [request.fieldId],
    )
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.fieldId } })
    }
    if (!field.has_ai) {
      // Switched on: the option comes on top of the field's type, whose values stay as
      // they are — the empty cells are filled, and all of them with `recompute`.
      await insertAiConfig(exec, ctx, {
        fieldId: request.fieldId,
        kind: field.kind,
        tableId: field.table_id,
        column: field.name,
        input: request.input,
      })
      if (request.recompute === true) {
        await exec.query(
          'UPDATE _basedb.field_ai_config SET sweep_after = $2 WHERE field_id = $1',
          [request.fieldId, FIRST],
          'update',
        )
      }
      await touchField(exec, ctx, request.fieldId)
      return
    }
    const config = await prepareConfig(exec, ctx, {
      tableId: field.table_id,
      self: field.name,
      input: request.input,
    })
    await exec.query(
      `UPDATE _basedb.field_ai_config
          SET prompt = $2, refresh_mode = $3, refresh_cron = $4, refresh_timezone = $5,
              next_sweep_at = $6, consented_by = $7, consented_at = clock_timestamp(),
              sweep_after = CASE WHEN $8::boolean THEN $9::uuid ELSE sweep_after END,
              last_error = NULL, last_error_at = NULL
        WHERE field_id = $1`,
      [
        request.fieldId,
        config.prompt,
        config.mode,
        config.cron,
        config.timezone,
        config.nextSweepAt,
        ctx.actor.id,
        request.recompute === true,
        FIRST,
      ],
      'update',
    )
  })
  return aiFieldStatus(pools, ctx, request.fieldId)
}

/**
 * Switches the AI option off: the field is an ordinary one again, its values kept and
 * editable. The cells never computed stay empty.
 */
export async function disableAiField(
  pools: Pools,
  ctx: RequestContext,
  fieldId: string,
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnField(exec, ctx, 'manage_schema', fieldId)
    const removed = await exec.query(
      'DELETE FROM _basedb.field_ai_config WHERE field_id = $1 RETURNING field_id',
      [fieldId],
      'delete',
    )
    if (removed.length === 0) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'kind', reason: 'pas_un_champ_ia' },
      })
    }
    await touchField(exec, ctx, fieldId)
  })
}

/**
 * Starts a recomputation of every row, now — the « Tout recalculer » of the screen. The
 * worker takes it from there, a few rows per pass.
 */
export async function requestAiSweep(
  pools: Pools,
  ctx: RequestContext,
  fieldId: string,
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnField(exec, ctx, 'manage_schema', fieldId)
    const updated = await exec.query(
      `UPDATE _basedb.field_ai_config SET sweep_after = $2, last_error = NULL,
              last_error_at = NULL
        WHERE field_id = $1 RETURNING field_id`,
      [fieldId, FIRST],
      'update',
    )
    if (updated.length === 0) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'kind', reason: 'pas_un_champ_ia' },
      })
    }
  })
}

// ── Staleness ─────────────────────────────────────────────────────────────────

/** An AI column of a table, and the columns its prompt cites. */
export interface AiDependent {
  readonly column: string
  readonly cited: readonly string[]
}

/**
 * The AI columns of a table and what each cites — what an update reads to know which of
 * its cells the change leaves stale.
 */
export async function loadAiDependents(exec: Executor, tableId: string): Promise<AiDependent[]> {
  const rows = await exec.query<{ column: string; prompt: string }>(
    `SELECT n.name AS column, c.prompt
       FROM _basedb.field_ai_config c
       JOIN _basedb.field f         ON f.id = c.field_id
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live`,
    [tableId],
  )
  return rows.map((r) => ({ column: r.column, cited: citedNames(r.prompt) }))
}

/**
 * The assignments that empty the AI cells an update leaves stale. A cell answers for the
 * values its prompt cited: when one of them really changes — `IS DISTINCT FROM`, so that
 * writing a value back as it was costs no call — the cell is emptied in the same
 * statement, and the worker computes it again at its next pass. `placeholders` maps each
 * column the update assigns to the parameter holding its new value; the right-hand sides
 * of an UPDATE read the row as it was, which is what the comparison needs.
 *
 * Only a PERSON's change does this. The worker writing an AI cell cited by another AI
 * field does not empty that one: two fields citing each other would recompute each other
 * forever, a call each time.
 */
export function staleAiAssignments(
  dependents: readonly AiDependent[],
  placeholders: ReadonlyMap<string, string>,
): string[] {
  const out: string[] = []
  for (const ai of dependents) {
    const changed = ai.cited
      .filter((name) => placeholders.has(name))
      .map((name) => `${quoteIdentifier(name)} IS DISTINCT FROM ${placeholders.get(name)}`)
    if (changed.length === 0) continue
    const column = quoteIdentifier(ai.column)
    out.push(`${column} = CASE WHEN ${changed.join(' OR ')} THEN NULL ELSE ${column} END`)
  }
  return out
}

// ── Computing ─────────────────────────────────────────────────────────────────

/** A cited column, and what reading its value takes. */
interface Cited {
  readonly name: string
  readonly kind: string
  readonly options?: ReadonlyMap<string, string>
  readonly link?: { readonly relation: string; readonly display: string | null }
}

/** Everything a computation of the field needs, read once from the catalog. */
interface LoadedField {
  readonly fieldId: string
  /** The field's type: what the answer is read into. */
  readonly kind: AiKind
  /** The choices of a `select`: the only values its answer may name. */
  readonly options: readonly AiOption[]
  readonly column: string
  readonly fieldLabel: string
  readonly tableLabel: string
  readonly baseId: string
  readonly relation: string
  readonly prompt: string
  readonly mode: 'if_empty' | 'schedule'
  readonly cron: string | null
  readonly timezone: string | null
  readonly nextSweepAt: Date | null
  readonly sweepAfter: string | null
  readonly cited: readonly Cited[]
}

async function loadField(exec: Executor, fieldId: string): Promise<LoadedField | null> {
  const [row] = await exec.query<
    {
      table_id: string
      column: string
      field_label: string
      table_label: string
      base_id: string
      table_name: string
      schema_name: string
      prompt: string
      refresh_mode: 'if_empty' | 'schedule'
      refresh_cron: string | null
      refresh_timezone: string | null
      next_sweep_at: Date | null
      sweep_after: string | null
      kind: string
    } & Record<string, unknown>
  >(
    `SELECT f.table_id, f.kind, cn.name AS column, f.label AS field_label, t.label AS table_label,
            t.base_id, tn.name AS table_name, sn.name AS schema_name,
            c.prompt, c.refresh_mode, c.refresh_cron, c.refresh_timezone,
            c.next_sweep_at, c.sweep_after
       FROM _basedb.field_ai_config c
       JOIN _basedb.field f          ON f.id = c.field_id
       JOIN _basedb.physical_name cn ON cn.id = f.name_id
       JOIN _basedb.table_def t      ON t.id = f.table_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE c.field_id = $1 AND f.is_live AND t.is_live`,
    [fieldId],
  )
  if (row === undefined || !isAiKind(row.kind)) return null
  const own = await exec.query<AiOption & Record<string, unknown>>(
    `SELECT value, label FROM _basedb.select_option
      WHERE field_id = $1 AND deleted_at IS NULL ORDER BY position`,
    [fieldId],
  )

  const names = citedNames(row.prompt)
  const fields = await exec.query<{ id: string; name: string; kind: string }>(
    `SELECT f.id, n.name, f.kind FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND n.name = ANY($2::text[])`,
    [row.table_id, names],
  )
  const ids = fields.map((f) => f.id)
  const options = await exec.query<{ field_id: string; value: string; label: string }>(
    `SELECT field_id, value, label FROM _basedb.select_option
      WHERE field_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [ids],
  )
  const links = await exec.query<{
    field_id: string
    schema_name: string
    table_name: string
    display: string | null
  }>(
    `SELECT lc.field_id, sn.name AS schema_name, tn.name AS table_name, dn.name AS display
       FROM _basedb.field_link_config lc
       JOIN _basedb.table_def t      ON t.id = lc.target_table_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
       LEFT JOIN _basedb.field d         ON d.id = t.display_field_id
       LEFT JOIN _basedb.physical_name dn ON dn.id = d.name_id
      WHERE lc.field_id = ANY($1::uuid[])`,
    [ids],
  )

  return {
    fieldId,
    kind: row.kind,
    options: own,
    column: row.column,
    fieldLabel: row.field_label,
    tableLabel: row.table_label,
    baseId: row.base_id,
    relation: qualify(row.schema_name, row.table_name),
    prompt: row.prompt,
    mode: row.refresh_mode,
    cron: row.refresh_cron,
    timezone: row.refresh_timezone,
    nextSweepAt: row.next_sweep_at === null ? null : new Date(row.next_sweep_at),
    sweepAfter: row.sweep_after,
    cited: fields.map((f) => {
      const link = links.find((l) => l.field_id === f.id)
      const own = options.filter((o) => o.field_id === f.id)
      return {
        name: f.name,
        kind: f.kind,
        ...(own.length > 0 ? { options: new Map(own.map((o) => [o.value, o.label])) } : {}),
        ...(link === undefined
          ? {}
          : {
              link: {
                relation: qualify(link.schema_name, link.table_name),
                display: link.display,
              },
            }),
      }
    }),
  }
}

/** A row read for a computation: its identifier, the cited values, and their fingerprint. */
type Row = Record<string, unknown> & { readonly _id: string; readonly _cited: string }

/**
 * What a row's prompt is built from, as one value: read with the row, compared at the
 * write. A computation takes seconds, and a cited value changed meanwhile — the row just
 * added, its notes typed while the model answered — makes the answer one for a row that
 * no longer is; it is dropped, and the cell, emptied by that change, is computed again.
 */
function citedFingerprint(field: LoadedField): string {
  return `md5(ROW(${field.cited.map((c) => quoteIdentifier(c.name)).join(', ')})::text)`
}

/** The select list of a computation: the identifier, the cited values, the fingerprint. */
function computedColumns(field: LoadedField): string {
  const columns = ['_id', ...field.cited.map((c) => c.name)].map((c) => quoteIdentifier(c))
  return `${columns.join(', ')}, ${citedFingerprint(field)} AS "_cited"`
}

/** Rows to compute: the empty ones, or all of them, after an identifier, in its order. */
async function readRows(
  pools: Pools,
  field: LoadedField,
  request: { readonly emptyOnly: boolean; readonly after: string; readonly limit: number },
): Promise<Row[]> {
  const columns = computedColumns(field)
  const empty = request.emptyOnly ? `${quoteIdentifier(field.column)} IS NULL AND ` : ''
  return pools.withConnection('data', (exec) =>
    exec.query<Row>(
      `SELECT ${columns} FROM ${field.relation}
        WHERE ${empty}"_id" > $1::uuid ORDER BY "_id" LIMIT $2`,
      [request.after, request.limit],
    ),
  )
}

/** The display values of the rows the cited links point at, in one query per link. */
async function linkDisplays(
  pools: Pools,
  field: LoadedField,
  rows: readonly Row[],
): Promise<Map<string, ReadonlyMap<string, string>>> {
  const out = new Map<string, ReadonlyMap<string, string>>()
  for (const cited of field.cited) {
    if (cited.link === undefined || cited.link.display === null) continue
    const ids = [...new Set(rows.map((r) => r[cited.name]).filter((v) => typeof v === 'string'))]
    if (ids.length === 0) continue
    const found = await pools.withConnection('data', (exec) =>
      exec.query<{ id: string; display: unknown }>(
        `SELECT "_id" AS id, ${quoteIdentifier(cited.link?.display as string)} AS display
           FROM ${cited.link?.relation} WHERE "_id" = ANY($1::uuid[])`,
        [ids],
      ),
    )
    out.set(cited.name, new Map(found.map((f) => [f.id, String(f.display ?? '')])))
  }
  return out
}

/** The cited values of one row, as the prompt reads them. */
function valuesFor(
  field: LoadedField,
  row: Row,
  displays: ReadonlyMap<string, ReadonlyMap<string, string>>,
): Map<string, string> {
  const values = new Map<string, string>()
  for (const cited of field.cited) {
    const context: ValueContext = {
      kind: cited.kind,
      options: cited.options,
      displays: displays.get(cited.name),
    }
    values.set(cited.name, formatValue(row[cited.name], context))
  }
  return values
}

/**
 * Computes one row and writes its cell — provided the cited values are still the ones
 * the prompt was built from. `fill` writes only into a cell still empty: a value someone
 * got in the meantime is not overwritten by an older computation.
 *
 * A row whose cited values are ALL empty is not sent: the model has nothing to work on,
 * and would answer nothing. A text cell gets that answer, `''`, without the call — settled
 * rather than NULL, which the worker would take for "to compute" at every pass. Filling
 * a cited column empties it again, and it is computed then. A prompt citing no column
 * asks for no data, and always runs.
 *
 * The other types have no empty value to settle on: the answer is read into the column's
 * type, and one holding no such value — no number, no choice of the list — is refused
 * (`AI_RESPONSE_UNUSABLE`). The cell stays NULL, and the worker tries the row again later,
 * less and less often.
 */
async function computeRow(
  pools: Pools,
  ctx: RequestContext,
  transport: ProviderTransport,
  config: ProviderConfig,
  field: LoadedField,
  row: Row,
  displays: ReadonlyMap<string, ReadonlyMap<string, string>>,
  mode: 'fill' | 'overwrite',
): Promise<unknown> {
  const values = valuesFor(field, row, displays)
  const nothing = values.size > 0 && [...values.values()].every((v) => v === EMPTY_VALUE)
  if (nothing && !isTextualAi(field.kind)) {
    throw new BasedbError('AI_RESPONSE_UNUSABLE', {
      details: { field: field.column, reason: 'rien_a_lire' },
    })
  }
  const answer = nothing
    ? ''
    : await (async () => {
        await withTransaction(
          pools,
          'catalog',
          ctx,
          (exec) => assertQuota(exec, ctx, 'field_compute'),
          { readOnly: true },
        )
        return computeFieldValue(pools, ctx, transport, config, {
          baseId: field.baseId,
          tableLabel: field.tableLabel,
          fieldLabel: field.fieldLabel,
          instruction: renderPrompt(field.prompt, values),
          format: expectedFormat(field.kind, field.options),
        })
      })()
  const value = parseAnswer(field.kind, answer, field.options)
  if (value === null) {
    throw new BasedbError('AI_RESPONSE_UNUSABLE', {
      details: { field: field.column, reason: 'type_attendu', kind: field.kind },
    })
  }
  // Through a transaction carrying the context, so the history records who wrote: the
  // kernel, as `system`, or the person who asked for this row.
  await withTransaction(pools, 'data', ctx, (exec) =>
    exec.query(
      `UPDATE ${field.relation} SET ${quoteIdentifier(field.column)} = $1
        WHERE "_id" = $2 AND ${citedFingerprint(field)} = $3${
          mode === 'fill' ? ` AND ${quoteIdentifier(field.column)} IS NULL` : ''
        }`,
      [value, row._id, row._cited],
      'update',
    ),
  )
  return value
}

/**
 * Computes one row now, on a person's demand — « Recalculer » in the record panel. The
 * person must be allowed to change rows of the table; the value is written whatever it
 * held, and returned.
 */
export async function runAiCell(
  pools: Pools,
  ctx: RequestContext,
  transport: ProviderTransport,
  request: { readonly fieldId: string; readonly recordId: string },
): Promise<{ readonly value: unknown }> {
  const prepared = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnField(exec, ctx, 'update', request.fieldId)
      const field = await loadField(exec, request.fieldId)
      if (field === null) {
        throw new BasedbError('REQUEST_INVALID', {
          details: { field: 'kind', reason: 'pas_un_champ_ia' },
        })
      }
      return { field, config: await resolveProvider(exec, ctx) }
    },
    { readOnly: true },
  )

  const [row] = await pools.withConnection('data', (exec) =>
    exec.query<Row>(
      `SELECT ${computedColumns(prepared.field)} FROM ${prepared.field.relation} WHERE "_id" = $1`,
      [request.recordId],
    ),
  )
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: request.recordId } })
  }
  const displays = await linkDisplays(pools, prepared.field, [row])
  const value = await computeRow(
    pools,
    ctx,
    transport,
    prepared.config,
    prepared.field,
    row,
    displays,
    'overwrite',
  )
  // Counted with the worker's: « cellules calculées » is every computation, whoever asked.
  await pools.withConnection('catalog', (exec) =>
    exec.query(
      'UPDATE _basedb.field_ai_config SET computed_count = computed_count + 1 WHERE field_id = $1',
      [request.fieldId],
      'update',
    ),
  )
  return { value }
}

// ── The worker ────────────────────────────────────────────────────────────────

/** The refusals that say "not now" for the whole field, rather than "not this row". */
const FIELD_STOPPERS: ReadonlySet<string> = new Set([
  'AI_DISABLED',
  'AI_NOT_CONFIGURED',
  'AI_QUOTA_EXCEEDED',
  'AI_PROVIDER_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
])

export interface AiWorkerOptions {
  /** Pause between two passes. */
  readonly intervalMs?: number
  /** Calls one pass may make, all fields together — the pace of the whole instance. */
  readonly perPass?: number
  /** Calls one pass may make for one field, so that one table does not starve the others. */
  readonly perField?: number
  /** Where a failing pass is said; nothing is said otherwise. */
  readonly onError?: (error: unknown) => void
}

export interface AiWorker {
  /** Runs one pass now and resolves when it is done — for tests, and for a first pass. */
  pass(): Promise<number>
  stop(): Promise<void>
}

/** The kernel acting for itself, inside one tenant — never an adapter's context. */
function systemContext(tenantRef: string, now: Date): RequestContext {
  return sealContext({
    requestId: randomUUID(),
    actor: { kind: 'system', id: FIRST },
    tenantId: tenantRef,
    surface: 'system',
    timestamp: now,
    deadline: new Date(now.getTime() + 10 * 60_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

/**
 * Starts the process that fills AI fields, pass after pass.
 *
 * One pass: for each AI field whose lease is free, take the lease (another API process may
 * be running the same loop), start a scheduled recomputation when it is due, then compute
 * — empty cells first, a recomputation in progress second — within the pass's budgets,
 * and give the lease back with how it went. A refusal that concerns the whole field —
 * quota, provider down, AI switched off — pauses that field for a few minutes rather than
 * spending the pass retrying it; a row that fails is skipped and tried again later.
 */
export function startAiWorker(
  pools: Pools,
  transport: ProviderTransport,
  options: AiWorkerOptions = {},
): AiWorker {
  const intervalMs = options.intervalMs ?? 10_000
  const perPass = options.perPass ?? 20
  const perField = options.perField ?? 8

  /** Where the empty pass of each field resumes: rows that failed are passed over. */
  const emptyCursor = new Map<string, string>()
  /** Rows that failed, by `field:row`, and when to try them again. */
  const backoff = new Map<string, { until: number; failures: number }>()
  /** Fields paused after a refusal that concerns all their rows. */
  const paused = new Map<string, number>()

  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<number> | null = null
  let stopped = false

  const processField = async (
    fieldId: string,
    tenantRef: string,
    budget: number,
  ): Promise<number> => {
    const now = new Date()
    const ctx = systemContext(tenantRef, now)
    const field = await withTransaction(pools, 'catalog', ctx, (exec) => loadField(exec, fieldId), {
      readOnly: true,
    })
    if (field === null) return 0

    let sweepAfter = field.sweepAfter
    if (
      field.mode === 'schedule' &&
      sweepAfter === null &&
      field.cron !== null &&
      field.timezone !== null &&
      (field.nextSweepAt === null || field.nextSweepAt.getTime() <= now.getTime())
    ) {
      const next = nextRun(parseCron(field.cron), field.timezone, now)
      sweepAfter = FIRST
      await pools.withConnection('catalog', (exec) =>
        exec.query(
          'UPDATE _basedb.field_ai_config SET sweep_after = $2, next_sweep_at = $3 WHERE field_id = $1',
          [fieldId, FIRST, next],
          'update',
        ),
      )
    }

    const config = await withTransaction(
      pools,
      'catalog',
      ctx,
      (exec) => resolveProvider(exec, ctx),
      {
        readOnly: true,
      },
    )

    let calls = 0
    let computed = 0
    let lastError: string | null = null
    const limit = Math.min(perField, budget)

    const attempt = async (
      row: Row,
      displays: Map<string, ReadonlyMap<string, string>>,
      mode: 'fill' | 'overwrite',
    ) => {
      calls++
      const key = `${fieldId}:${row._id}`
      try {
        await computeRow(pools, ctx, transport, config, field, row, displays, mode)
        computed++
        backoff.delete(key)
      } catch (error) {
        const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
        lastError = code
        if (FIELD_STOPPERS.has(code)) throw error
        const failures = (backoff.get(key)?.failures ?? 0) + 1
        backoff.set(key, {
          failures,
          until: Date.now() + Math.min(2 ** failures * 60_000, 6 * 3600_000),
        })
      }
    }

    try {
      // 1. Empty cells, whatever the mode: a new row is filled at the next pass.
      const after = emptyCursor.get(fieldId) ?? FIRST
      const empty = await readRows(pools, field, { emptyOnly: true, after, limit })
      const ready = empty.filter(
        (r) => (backoff.get(`${fieldId}:${r._id}`)?.until ?? 0) <= Date.now(),
      )
      const emptyDisplays = await linkDisplays(pools, field, ready)
      for (const row of ready) {
        if (calls >= limit) break
        await attempt(row, emptyDisplays, 'fill')
      }
      // Past the end — or nothing left — the next pass starts from the top again, so the
      // rows passed over in backoff get their turn.
      emptyCursor.set(
        fieldId,
        empty.length < limit ? FIRST : (empty[empty.length - 1]?._id ?? FIRST),
      )

      // 2. A recomputation in progress, with what the budget leaves.
      if (sweepAfter !== null && calls < limit) {
        const wanted = limit - calls
        const rows = await readRows(pools, field, {
          emptyOnly: false,
          after: sweepAfter,
          limit: wanted,
        })
        const displays = await linkDisplays(pools, field, rows)
        let reached = sweepAfter
        for (const row of rows) {
          await attempt(row, displays, 'overwrite')
          reached = row._id
        }
        const done = rows.length < wanted
        await pools.withConnection('catalog', (exec) =>
          exec.query(
            'UPDATE _basedb.field_ai_config SET sweep_after = $2 WHERE field_id = $1',
            [fieldId, done ? null : reached],
            'update',
          ),
        )
      }
    } catch (error) {
      const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
      lastError = code
      // A quota or a provider down: the field waits ten minutes; AI off or unconfigured,
      // five — the time for someone to fix the setting.
      paused.set(fieldId, Date.now() + (code === 'AI_QUOTA_EXCEEDED' ? 10 : 5) * 60_000)
    }

    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.field_ai_config
            SET last_run_at = clock_timestamp(),
                computed_count = computed_count + $2,
                last_error = CASE WHEN $3::text IS NULL THEN
                               CASE WHEN $2 > 0 THEN NULL ELSE last_error END
                             ELSE $3::text END,
                last_error_at = CASE WHEN $3::text IS NULL THEN
                                  CASE WHEN $2 > 0 THEN NULL ELSE last_error_at END
                                ELSE clock_timestamp() END
          WHERE field_id = $1`,
        [fieldId, computed, lastError],
        'update',
      ),
    )
    return calls
  }

  const pass = async (): Promise<number> => {
    const due = await pools.withConnection('catalog', (exec) =>
      exec.query<{ field_id: string; tenant_ref: string }>(
        `SELECT c.field_id, te.ref AS tenant_ref
           FROM _basedb.field_ai_config c
           JOIN _basedb.field f      ON f.id = c.field_id AND f.is_live
           JOIN _basedb.table_def t  ON t.id = f.table_id AND t.is_live
           JOIN _basedb.base b       ON b.id = t.base_id AND b.is_live
           JOIN _basedb.tenant te    ON te.id = b.tenant_id
          WHERE c.lease_until IS NULL OR c.lease_until < clock_timestamp()
          ORDER BY c.last_run_at NULLS FIRST`,
      ),
    )

    let budget = perPass
    for (const { field_id: fieldId, tenant_ref: tenantRef } of due) {
      if (budget <= 0 || stopped) break
      if ((paused.get(fieldId) ?? 0) > Date.now()) continue

      // The lease: five minutes, long enough for a pass, short enough that a process that
      // died holding it does not hold the field for long.
      const [claimed] = await pools.withConnection('catalog', (exec) =>
        exec.query(
          `UPDATE _basedb.field_ai_config
              SET lease_until = clock_timestamp() + interval '5 minutes'
            WHERE field_id = $1 AND (lease_until IS NULL OR lease_until < clock_timestamp())
            RETURNING field_id`,
          [fieldId],
          'update',
        ),
      )
      if (claimed === undefined) continue
      try {
        budget -= await processField(fieldId, tenantRef, budget)
      } catch (error) {
        options.onError?.(error)
        paused.set(fieldId, Date.now() + 5 * 60_000)
      } finally {
        await pools
          .withConnection('catalog', (exec) =>
            exec.query(
              'UPDATE _basedb.field_ai_config SET lease_until = NULL WHERE field_id = $1',
              [fieldId],
              'update',
            ),
          )
          .catch(() => undefined)
      }
    }
    return perPass - budget
  }

  const loop = () => {
    if (stopped) return
    running = pass().catch((error) => {
      options.onError?.(error)
      return 0
    })
    void running.finally(() => {
      running = null
      if (!stopped) timer = setTimeout(loop, intervalMs)
    })
  }
  timer = setTimeout(loop, intervalMs)

  return {
    pass: () => pass(),
    stop: async () => {
      stopped = true
      clearTimeout(timer)
      await running
    },
  }
}
