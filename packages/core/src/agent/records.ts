import { BasedbError } from '../errors/index.js'
import { createRecord } from '../records/create.js'
import { OPERATORS, type Operator } from '../records/filter.js'
import { listRecords } from '../records/list.js'
import { updateRecord } from '../records/update.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import type { AgentNotice } from './describe.js'
import {
  claimIdempotency,
  completeIdempotency,
  paramsHash,
  releaseIdempotency,
} from './idempotency.js'
import {
  type AgentField,
  type AgentTable,
  type AgentView,
  agentView,
  displayField,
  linkTarget,
  resolveAgentField,
  resolveAgentTable,
} from './view.js'

/**
 * Reading and writing records on the agent surface — chapter 09 §5 and §6.
 *
 * Nothing here reads or writes a row by itself: every read goes through `listRecords`,
 * every write through `createRecord` / `updateRecord`, under the same mask. What this
 * module adds is the agent's grammar — structured filters, closed bounds, the refusals
 * of §6.2 — and ONE resolution of every field name, shared by `select`, `filter`,
 * `sort`, `expand` and `values`: a field the bearer cannot read, or withheld from agents,
 * is a field that does not exist (§5.1).
 */

/** The bounds of §5 and §11, as the kernel enforces them. */
export const AGENT_BOUNDS = {
  defaultLimit: 25,
  maxLimit: 100,
  /** `select` absent: the first thirty readable fields, by position. */
  defaultSelect: 30,
  /** `include_count`: exact below, estimated above (§5.1). */
  exactCountBelow: 50_000,
  lookupDefault: 10,
  lookupMax: 25,
} as const

export interface AgentPredicate {
  readonly op: string
  readonly value?: unknown
}

export interface AgentListRequest {
  readonly base: string
  readonly table: string
  readonly select?: readonly string[]
  readonly filter?: Readonly<Record<string, AgentPredicate>>
  readonly sort?: readonly string[]
  readonly limit?: number
  readonly cursor?: string
  readonly expand?: readonly string[]
  /** `<link field>.<target field>`: what an expansion carries beyond `_id` and display. */
  readonly expandFields?: readonly string[]
  readonly includeCount?: boolean
}

/** What the adapter needs to shape a row for transport (§11.2), and nothing more. */
export interface AgentColumn {
  readonly name: string
  readonly kind: string
  readonly rich: boolean
}

export interface AgentRows {
  readonly table: { readonly id: string; readonly name: string; readonly baseId: string }
  readonly records: ReadonlyArray<Record<string, unknown>>
  readonly columns: readonly AgentColumn[]
  readonly hasMore: boolean
  readonly nextCursor: string | null
  readonly count?: number
  readonly countIsEstimate?: boolean
  readonly notices: readonly AgentNotice[]
}

/**
 * Rewrites a kernel refusal into the vocabulary of this surface (09 §14.5), keeping only
 * the details that name what the bearer may see.
 *
 * The kernel's filter, sort and expansion speak chapter 08; the agent surface names the
 * same conditions with the codes chapter 09 fixed for them.
 */
function agentError(error: unknown, table: AgentTable | null, view: AgentView | null): never {
  if (!(error instanceof BasedbError)) throw error
  const d = error.details as Record<string, unknown>
  const object = table === null ? undefined : { kind: 'table', name: table.row.table_name }
  const readableName = (name: unknown): string | undefined =>
    typeof name === 'string' && table?.fields.some((f) => f.name === name) ? name : undefined
  const keep = (extra: Record<string, unknown> = {}) => ({
    ...(object === undefined ? {} : { object }),
    ...(typeof d.param === 'string' ? { param: d.param } : {}),
    ...extra,
  })

  switch (error.code) {
    case 'FILTER_FIELD_UNKNOWN':
    case 'SORT_FIELD_UNKNOWN':
      throw new BasedbError('FIELD_UNKNOWN', { details: keep() })
    case 'EXPAND_UNAVAILABLE':
      throw new BasedbError('FIELD_NOT_EXPANDABLE', { details: keep() })
    case 'FILTER_VALUE_INVALID':
      throw new BasedbError('VALUE_INVALID', { details: keep({ field: readableName(d.field) }) })
    case 'CURSOR_STALE':
      throw new BasedbError('CURSOR_INVALID')
    case 'REQUEST_INVALID':
      throw new BasedbError('PARAMETER_INVALID', { details: keep() })
    case 'SERIALIZATION_CONFLICT':
      throw new BasedbError('CONCURRENCY_CONFLICT')
    case 'ADMIN_REQUIRED':
      throw new BasedbError('PERMISSION_DENIED', { details: keep() })
    case 'LINK_TARGET_NOT_FOUND': {
      // Carried by the SOURCE field, and never naming the target (§14.4).
      const link = view?.raw.links.find((l) => l.fk_constraint === d.constraint)
      const field = table?.fields.find((f) => f.id === link?.field_id)
      throw new BasedbError('LINK_TARGET_NOT_FOUND', {
        details: keep(field === undefined ? {} : { field: field.name }),
      })
    }
    case 'DUPLICATE_VALUE': {
      // Names the field, never the value in conflict.
      const fieldId = [...(view?.raw.unique ?? [])].find(([, name]) => name === d.constraint)?.[0]
      const field = table?.fields.find((f) => f.id === fieldId)
      throw new BasedbError('DUPLICATE_VALUE', {
        details: keep(field === undefined ? {} : { field: field.name }),
      })
    }
    default: {
      // Any other code travels with the details that name only visible objects: a
      // PostgreSQL column or constraint name is dropped unless it is a readable field.
      const field = readableName(d.field) ?? readableName(d.column)
      throw new BasedbError(error.code, {
        details: keep({
          ...(field === undefined ? {} : { field }),
          ...(typeof d.retry_after === 'number' ? { retry_after: d.retry_after } : {}),
          ...(typeof d.maximum === 'number' ? { maximum: d.maximum } : {}),
          ...(typeof d.expected === 'string' ? { expected: d.expected } : {}),
        }),
        cause: error.cause,
        incidentId: error.incidentId,
      })
    }
  }
}

/** A string literal of the filter grammar (chapter 08 §4.1): two escapes, and only two. */
const literal = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

function scalarOf(value: unknown, param: string): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' && Number.isFinite(value)) return literal(String(value))
  if (typeof value === 'string') return literal(value)
  throw new BasedbError('VALUE_INVALID', { details: { param } })
}

/**
 * The structured filter of §5.1, written in the grammar of chapter 08 — the ONE parser,
 * coercer and SQL builder every surface shares. Field names are resolved first, so the
 * text handed over only ever names readable columns, by their physical name.
 */
function filterExpression(
  view: AgentView,
  table: AgentTable,
  filter: Readonly<Record<string, AgentPredicate>>,
): string {
  const parts: string[] = []
  for (const [reference, predicate] of Object.entries(filter)) {
    const param = `filter.${reference}`
    const field = resolveAgentField(table, reference, param)
    if (!(OPERATORS as readonly string[]).includes(predicate.op)) {
      throw new BasedbError('PARAMETER_INVALID', { details: { param: `${param}.op` } })
    }
    const op = predicate.op as Operator

    // A link whose target is unreadable filters on "set" and "not set" alone: comparing
    // its identifier would test a row of a table the bearer cannot see (§4.3, A16).
    if (field.link !== null && linkTarget(view, field) === null && op !== 'is_null') {
      throw new BasedbError('FILTER_OPERATOR_INVALID', {
        details: { param, object: { kind: 'table', name: table.row.table_name } },
      })
    }

    if (op === 'is_null') {
      parts.push(predicate.value === false ? `not ${field.name} is_null` : `${field.name} is_null`)
      continue
    }
    if (op === 'in' || op === 'between') {
      const values = predicate.value
      if (!Array.isArray(values) || (op === 'between' && values.length !== 2)) {
        throw new BasedbError('PARAMETER_INVALID', { details: { param: `${param}.value` } })
      }
      parts.push(`${field.name} ${op} [${values.map((v) => scalarOf(v, param)).join(', ')}]`)
      continue
    }
    // A multiple choice is asked for one value or several: both are written as a list.
    if ((op === 'has_any' || op === 'has_all') && Array.isArray(predicate.value)) {
      if (predicate.value.length === 0) {
        throw new BasedbError('PARAMETER_INVALID', { details: { param: `${param}.value` } })
      }
      const values = predicate.value.map((v) => scalarOf(v, param)).join(', ')
      parts.push(`${field.name} ${op} [${values}]`)
      continue
    }
    parts.push(`${field.name} ${op} ${scalarOf(predicate.value, param)}`)
  }
  return parts.join(' and ')
}

function sortExpression(view: AgentView, table: AgentTable, sort: readonly string[]): string {
  return sort
    .map((term, index) => {
      const descending = term.startsWith('-')
      const field = resolveAgentField(table, descending ? term.slice(1) : term, `sort[${index}]`)
      // The order of hidden identifiers is the order of their creation instants (UUIDv7):
      // a masked link is not sortable.
      if (field.link !== null && linkTarget(view, field) === null) {
        throw new BasedbError('SORT_UNAVAILABLE', { details: { param: `sort[${index}]` } })
      }
      return `${descending ? '-' : ''}${field.name}`
    })
    .join(',')
}

/** An estimate of the table's size, for a count past the exact bound (§5.1). */
async function estimate(pools: Pools, table: AgentTable): Promise<number | null> {
  const rows = await pools.withConnection('data', (exec) =>
    exec.query<{ n: string }>(
      `SELECT c.reltuples::bigint AS n
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = $1 AND c.relname = $2`,
      [table.row.schema_name, table.row.table_name],
    ),
  )
  const n = Number(rows[0]?.n ?? -1)
  return n < 0 ? null : n
}

function columnsOf(table: AgentTable, names: readonly string[]): AgentColumn[] {
  return names.map((name) => {
    const field = table.fields.find((f) => f.name === name)
    return { name, kind: field?.kind ?? 'system', rich: field?.row?.is_rich ?? false }
  })
}

/** Runs a read through the kernel's one list operation, in the agent's grammar. */
async function readRows(
  pools: Pools,
  ctx: RequestContext,
  view: AgentView,
  table: AgentTable,
  request: Omit<AgentListRequest, 'base' | 'table'>,
): Promise<AgentRows> {
  const notices: AgentNotice[] = []

  // `select`: named fields, or the first thirty readable ones; `_id` always.
  const business = table.fields.filter((f) => !f.system)
  const selected =
    request.select === undefined
      ? ['_id', ...business.slice(0, AGENT_BOUNDS.defaultSelect).map((f) => f.name)]
      : [
          '_id',
          ...request.select.map((ref, i) => resolveAgentField(table, ref, `select[${i}]`).name),
        ]
  if (request.select === undefined && business.length > AGENT_BOUNDS.defaultSelect) {
    notices.push({
      kind: 'select_defaulted',
      message: `Seuls les ${AGENT_BOUNDS.defaultSelect} premiers champs sont rendus ; nommez les autres dans select.`,
    })
  }

  // `expand` and `expand_fields`, resolved by the same path, then written in the kernel's
  // expansion grammar. An expansion carries `_id` and the display value, plus the fields
  // named in `expand_fields` — never the whole target row by default (§11.2).
  const expansions = new Map<string, { field: AgentField; target: AgentTable; fields: string[] }>()
  for (const [i, reference] of (request.expand ?? []).entries()) {
    const field = resolveAgentField(table, reference, `expand[${i}]`)
    const target = linkTarget(view, field)
    if (field.link === null || target === null || displayField(target) === null) {
      throw new BasedbError('FIELD_NOT_EXPANDABLE', {
        details: {
          param: `expand[${i}]`,
          object: { kind: 'table', name: table.row.table_name },
        },
      })
    }
    expansions.set(field.name, { field, target, fields: [] })
    if (!selected.includes(field.name)) selected.push(field.name)
  }
  for (const [i, path] of (request.expandFields ?? []).entries()) {
    const param = `expand_fields[${i}]`
    const [linkName, fieldName, ...rest] = path.split('.')
    const expansion = expansions.get(
      expansions.has(linkName ?? '')
        ? (linkName ?? '')
        : (table.fields.find((f) => f.id === linkName)?.name ?? ''),
    )
    if (expansion === undefined || fieldName === undefined || rest.length > 0) {
      throw new BasedbError('PARAMETER_INVALID', { details: { param } })
    }
    // The target's fields obey the TARGET's mask, whatever the source's.
    const targetField = resolveAgentField(expansion.target, fieldName, param)
    expansion.fields.push(targetField.name)
  }
  const expand = [...expansions].map(([name, e]) => `${name}(${e.fields.join(',')})`).join(',')

  let limit = request.limit ?? AGENT_BOUNDS.defaultLimit
  if (limit > AGENT_BOUNDS.maxLimit) {
    // Clipped, not refused: an agent asking for a thousand rows wants to read the
    // table, and a hundred plus a cursor lets it (§5.1).
    notices.push({
      kind: 'limit_clipped',
      message: `La limite est ramenée à ${AGENT_BOUNDS.maxLimit} lignes ; poursuivez avec next_cursor.`,
    })
    limit = AGENT_BOUNDS.maxLimit
  }

  const filter =
    request.filter === undefined ? undefined : filterExpression(view, table, request.filter)
  const sort =
    request.sort === undefined || request.sort.length === 0
      ? undefined
      : sortExpression(view, table, request.sort)

  let result: Awaited<ReturnType<typeof listRecords>>
  try {
    result = await listRecords(pools, ctx, {
      tableId: table.row.id,
      limit,
      after: request.cursor,
      filter,
      sort,
      expand: expand === '' ? undefined : expand,
      select: selected.filter((c) => c !== '_id'),
      count: request.includeCount === true ? 'exact' : undefined,
      countCeiling: AGENT_BOUNDS.exactCountBelow,
    })
  } catch (error) {
    agentError(error, table, view)
  }

  // The expansion is nested in the link value it expands: an agent reads one object,
  // not a row plus an index to join by hand.
  const records = result.rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const column of selected) out[column] = row[column] ?? null
    for (const [name, expansion] of expansions) {
      const value = out[name] as { id?: string | null } | null
      if (value === null || typeof value !== 'object' || typeof value.id !== 'string') continue
      const target = result.included[expansion.target.row.table_name]?.[value.id]
      if (target === undefined) continue
      out[name] = {
        ...value,
        fields: Object.fromEntries(expansion.fields.map((f) => [f, target[f] ?? null])),
      }
    }
    return out
  })

  let count: number | undefined
  let countIsEstimate: boolean | undefined
  if (request.includeCount === true && result.total !== null) {
    count = result.total
    countIsEstimate = result.totalCapped
    if (result.totalCapped) {
      // Past the bound, an estimate from the planner's statistics rather than a scan —
      // of the whole table, which bounds a filtered count from above.
      const n = filter === undefined ? await estimate(pools, table) : null
      if (n !== null && n > count) count = n
      notices.push({
        kind: 'count_estimated',
        message: `Au-delà de ${AGENT_BOUNDS.exactCountBelow} lignes, le compte est une estimation.`,
      })
    }
  }

  return {
    table: { id: table.row.id, name: table.row.table_name, baseId: table.base.row.id },
    records,
    columns: columnsOf(table, selected),
    hasMore: result.hasNextPage,
    nextCursor: result.nextCursor,
    ...(count === undefined ? {} : { count, countIsEstimate }),
    notices,
  }
}

/** `list_records` — §5.1. */
export async function agentListRecords(
  pools: Pools,
  ctx: RequestContext,
  request: AgentListRequest,
): Promise<AgentRows> {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, request.base, request.table)
  return readRows(pools, ctx, view, table, request)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `get_record` — §5.2. A row that does not exist and one not visible answer alike. */
export async function agentGetRecord(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly base: string
    readonly table: string
    readonly id: string
    readonly select?: readonly string[]
    readonly expand?: readonly string[]
    readonly expandFields?: readonly string[]
  },
): Promise<AgentRows> {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, request.base, request.table)
  if (!UUID.test(request.id)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const rows = await readRows(pools, ctx, view, table, {
    select: request.select ?? table.fields.filter((f) => !f.system).map((f) => f.name),
    expand: request.expand,
    expandFields: request.expandFields,
    filter: { _id: { op: 'eq', value: request.id } },
    limit: 1,
  })
  if (rows.records.length === 0) throw new BasedbError('RESOURCE_NOT_FOUND')
  return { ...rows, hasMore: false, nextCursor: null }
}

/**
 * `lookup_records` — §5.3: a display value resolved into candidate `_id`s.
 *
 * Exact match on the comparison key (folded case and accents), never approximate, and a
 * LIST even of one: choosing is the agent's work, and the choice must show in the
 * conversation. Without a readable display field there is nothing to match on, and the
 * table is not found — the `hint` points to `describe_table`.
 */
export async function agentLookupRecords(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly base: string
    readonly table: string
    readonly value: string
    readonly limit?: number
  },
) {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, request.base, request.table)
  const display = displayField(table)
  if (display === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { hint: 'describe_table' } })
  }

  const limit = Math.min(request.limit ?? AGENT_BOUNDS.lookupDefault, AGENT_BOUNDS.lookupMax)
  const op = display.kind === 'short_text' ? 'eq_ci' : 'eq'
  const rows = await readRows(pools, ctx, view, table, {
    select: [display.name],
    filter: { [display.name]: { op, value: request.value } },
    limit,
  })

  return {
    table: rows.table,
    candidates: rows.records.map((r) => ({ _id: r._id, display: r[display.name] ?? null })),
    has_more: rows.hasMore,
    returned: rows.records.length,
    provenance: 'user_data' as const,
  }
}

// ── Writes ────────────────────────────────────────────────────────────────────

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/
const DECIMAL = /^-?\d+(?:\.\d+)?$/

/** The functional type named in a `VALUE_INVALID` — never the PostgreSQL one (§5.4). */
const EXPECTED: Readonly<Record<string, string>> = {
  short_text: 'texte',
  long_text: 'texte',
  number: 'nombre',
  boolean: 'booléen',
  date: 'date AAAA-MM-JJ',
  datetime: 'date-heure ISO 8601 avec fuseau',
  select: 'une des valeurs de la liste',
  multi_select: 'liste de valeurs de la liste',
  link: 'identifiant _id de la ligne cible',
}

/**
 * Checks a value against its field's kind BEFORE anything is sent — so that a refusal
 * names the field and the functional type, instead of surfacing as a translated
 * PostgreSQL error. `null` clears a field; whether it may be cleared is the database's
 * `NOT NULL` to say.
 */
function coerce(view: AgentView, table: AgentTable, field: AgentField, value: unknown): unknown {
  if (value === null) return null
  const param = `values.${field.name}`
  const invalid = (): never => {
    throw new BasedbError('VALUE_INVALID', {
      details: {
        param,
        field: field.name,
        expected: EXPECTED[field.kind] ?? field.kind,
        object: { kind: 'table', name: table.row.table_name },
      },
    })
  }

  switch (field.kind) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string' || value.includes('\u0000')) return invalid()
      const max = field.row?.max_length ?? null
      if (max !== null && [...value].length > max) {
        throw new BasedbError('VALUE_TOO_LONG', {
          details: { param, field: field.name, maximum: max },
        })
      }
      return value
    }
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return String(value)
      if (typeof value === 'string' && DECIMAL.test(value.trim())) return value.trim()
      return invalid()
    case 'boolean':
      return typeof value === 'boolean' ? value : invalid()
    case 'date':
      return typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(value))
        ? value
        : invalid()
    case 'datetime':
      // A date-time without a time zone is refused, never guessed (§11.2).
      return typeof value === 'string' && DATETIME.test(value) && !Number.isNaN(Date.parse(value))
        ? value
        : invalid()
    case 'select': {
      const options = field.id === null ? undefined : view.raw.options.get(field.id)
      return typeof value === 'string' && options?.some((o) => o.value === value) === true
        ? value
        : invalid()
    }
    case 'multi_select': {
      // A lone value is a list of one; every element must be one of the choices.
      const options = field.id === null ? undefined : view.raw.options.get(field.id)
      const items = Array.isArray(value) ? value : [value]
      return items.every(
        (v) => typeof v === 'string' && options?.some((o) => o.value === v) === true,
      )
        ? items
        : invalid()
    }
    case 'link': {
      if (typeof value !== 'string' || !UUID.test(value)) return invalid()
      // A target the bearer cannot read is answered as a target that does not exist,
      // WITHOUT asking the database: its answer would say whether that row exists (§14.4).
      if (linkTarget(view, field) === null) {
        throw new BasedbError('LINK_TARGET_NOT_FOUND', {
          details: {
            param,
            field: field.name,
            object: { kind: 'table', name: table.row.table_name },
          },
        })
      }
      return value.toLowerCase()
    }
    default:
      return invalid()
  }
}

/** The values of a write, each resolved, checked for writability, and coerced. */
function writableValues(
  view: AgentView,
  table: AgentTable,
  values: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const object = { kind: 'table', name: table.row.table_name }
  const out: Record<string, unknown> = {}
  for (const [reference, value] of Object.entries(values)) {
    const field = resolveAgentField(table, reference, `values.${reference}`)
    if (!field.writable) {
      // System columns and formulas: `describe_table` already said `"access": "read"`.
      // Rich text: refused on this surface in v1, the hint points to the interface.
      throw new BasedbError('FIELD_NOT_WRITABLE', {
        details: {
          param: `values.${reference}`,
          field: field.name,
          object,
          ...(field.row?.is_rich === true ? { hint: 'rich_text' } : {}),
        },
      })
    }
    out[field.name] = coerce(view, table, field, value)
  }
  if (Object.keys(out).length === 0) {
    throw new BasedbError('PARAMETER_INVALID', { details: { param: 'values' } })
  }
  return out
}

/** `PERMISSION_DENIED` when the bearer can read but not do; `TOKEN_READ_ONLY` if the token is why. */
function requireWrite(table: AgentTable, action: 'create' | 'update'): void {
  const decision = table.decisions[action]
  if (decision.verdict === 'ALLOWED') return
  const object = { kind: 'table', name: table.row.table_name }
  if (decision.reason === 'TOKEN_ACTION_NOT_GRANTED') {
    throw new BasedbError('TOKEN_READ_ONLY', { details: { object } })
  }
  // The table is readable — the bearer knows it by an authorized path, so the refusal
  // may say "not allowed" rather than "not found" (§14.3).
  throw new BasedbError('PERMISSION_DENIED', { details: { object, action } })
}

export interface AgentWriteRequest {
  readonly base: string
  readonly table: string
  readonly values: Readonly<Record<string, unknown>>
  readonly idempotencyKey?: string
}

/** Runs a write under the idempotency claim of §6.3, when the agent supplied a key. */
async function idempotent(
  pools: Pools,
  ctx: RequestContext,
  key: string | undefined,
  tool: string,
  params: unknown,
  work: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  if (key === undefined) return work()
  const claim = await claimIdempotency(pools, ctx, { key, tool, hash: paramsHash(params) })
  if (claim.kind === 'replay') return claim.response
  let response: Record<string, unknown>
  try {
    response = await work()
  } catch (error) {
    // Every refusal of these writes is raised before or by one single statement: nothing
    // was written, and the key is freed for the corrected call.
    await releaseIdempotency(pools, ctx, key).catch(() => undefined)
    throw error
  }
  await completeIdempotency(pools, ctx, key, response)
  return response
}

/** Reads back what was just written, under the READ mask, as `get_record` would. */
async function readBack(
  pools: Pools,
  ctx: RequestContext,
  view: AgentView,
  table: AgentTable,
  id: string,
): Promise<Record<string, unknown> | null> {
  const rows = await readRows(pools, ctx, view, table, {
    select: table.fields.filter((f) => !f.system).map((f) => f.name),
    filter: { _id: { op: 'eq', value: id } },
    limit: 1,
  })
  return rows.records[0] ?? null
}

/**
 * `create_record` — §6.1.
 *
 * `_id` is not a parameter: the kernel assigns it. An agent fixing the primary key would
 * contradict the map (`"access": "read"`) and, above all, open an oracle — a collision
 * answers "exists" on a table the bearer may not read.
 */
export async function agentCreateRecord(
  pools: Pools,
  ctx: RequestContext,
  request: AgentWriteRequest,
): Promise<AgentWriteResult> {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, request.base, request.table)
  requireWrite(table, 'create')
  const values = writableValues(view, table, request.values)

  const response = await idempotent(
    pools,
    ctx,
    request.idempotencyKey,
    'mcp.create_record',
    { base: table.base.row.id, table: table.row.id, values },
    async () => {
      let created: Awaited<ReturnType<typeof createRecord>>
      try {
        created = await createRecord(pools, ctx, { tableId: table.row.id, values })
      } catch (error) {
        agentError(error, table, view)
      }
      const id = String(created.row._id)
      const record = await readBack(pools, ctx, view, table, id)
      return {
        _id: id,
        created: true,
        ...(record === null ? {} : { record }),
        provenance: 'user_data',
      }
    },
  )
  return writeResult(table, response)
}

/** What a write hands back: the response, and the columns its `record` is read with. */
export interface AgentWriteResult {
  readonly table: AgentRows['table']
  readonly response: Record<string, unknown>
  readonly columns: readonly AgentColumn[]
}

function writeResult(table: AgentTable, response: Record<string, unknown>): AgentWriteResult {
  const names = ['_id', ...table.fields.filter((f) => !f.system).map((f) => f.name)]
  return {
    table: { id: table.row.id, name: table.row.table_name, baseId: table.base.row.id },
    response,
    columns: columnsOf(table, names),
  }
}

/**
 * `update_record` — §6.2. Only the named fields are written: no full replacement, which
 * would erase the fields the bearer cannot see.
 */
export async function agentUpdateRecord(
  pools: Pools,
  ctx: RequestContext,
  request: AgentWriteRequest & { readonly id: string },
): Promise<AgentWriteResult> {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, request.base, request.table)
  requireWrite(table, 'update')
  if (!UUID.test(request.id)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const values = writableValues(view, table, request.values)

  const response = await idempotent(
    pools,
    ctx,
    request.idempotencyKey,
    'mcp.update_record',
    { base: table.base.row.id, table: table.row.id, id: request.id.toLowerCase(), values },
    async () => {
      try {
        await updateRecord(pools, ctx, {
          tableId: table.row.id,
          recordId: request.id,
          values,
        })
      } catch (error) {
        agentError(error, table, view)
      }
      const record = await readBack(pools, ctx, view, table, request.id)
      return {
        _id: request.id.toLowerCase(),
        updated: true,
        ...(record === null ? {} : { record }),
        provenance: 'user_data',
      }
    },
  )
  return writeResult(table, response)
}

export { agentError }
