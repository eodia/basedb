import {
  AGGREGATION_FNS,
  type Aggregation,
  type AggregationFn,
  type Breakout,
  type BuilderQuery,
  COLUMNLESS_FNS,
  type ColumnRef,
  type Constraint,
  FILTER_OPS,
  type Filter,
  type FilterOp,
  type FilterValue,
  JOIN_KINDS,
  type Join,
  NUMBER_OPERATORS,
  type OrderBy,
  PARAMETER_TYPES,
  QUERY_LIMITS,
  type QueryResult,
  type ResultColumn,
  TEMPORAL_UNITS,
  type TemporalUnit,
  addDays,
  columnName,
  isTemporalUnit,
  resolveDateExpression,
  resultNames,
} from '@basedb/contracts'
import { qualify, quoteIdentifier } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { SYSTEM_COLUMNS } from '../rbac/decide.js'
import {
  type FilterableColumn,
  buildFilter,
  resolveColumn,
  sortableKind,
} from '../records/filter.js'
import { type Plan, buildPlan, planLateral } from '../records/list.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { todayIn, validTimeZone, zonedMidnight } from './time.js'

/**
 * Questions built with the mouse — chapter 18 §3: a table, its joins, its filters, its
 * aggregates by groups, read with the rights of whoever looks.
 *
 * Nothing here opens a door the data routes keep shut. Each table the query names is read
 * through ITS reader's plan — the one a page of it would use: its readable columns only,
 * its row predicate, its fields computed at read time — as a sub-query of its own:
 *
 *   FROM (SELECT t."_id", t."montant", v."total" FROM "b_…"."commandes" AS t
 *           CROSS JOIN LATERAL (…) AS v WHERE ( /*predicat_lignes:commandes*\/ TRUE )) AS "s"
 *   LEFT JOIN (SELECT … FROM "b_…"."clients" AS t WHERE ( /*predicat_lignes:clients*\/ TRUE )) AS "j1"
 *     ON "j1"."_id" = "s"."client"
 *
 * A column the reader may not see is not in its sub-query, and a name the query cites is
 * resolved against the plan before being quoted: a masked field is an unknown one, here as
 * in a filter. The filters are written in the grammar of chapter 08 §4 and translated by
 * its builder — bound values, casts, escaped patterns — and a relative date is resolved to
 * days in the reader's time zone before it gets there.
 */

// ── Checking what is received ───────────────────────────────────────────────

const invalid = (field: string, reason: string, detail?: unknown): BasedbError =>
  new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })

const NAME = /^[_a-z][a-z0-9_]{0,62}$/
const ALIAS = /^[a-z][a-z0-9_]{0,30}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function listOf(value: unknown, at: string, max: number): unknown[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw invalid(at, 'liste_attendue')
  if (value.length > max) throw invalid(at, 'trop_d_elements', max)
  return value
}

function columnRef(value: unknown, at: string): ColumnRef {
  if (!isRecord(value) || typeof value.field !== 'string' || !NAME.test(value.field)) {
    throw invalid(at, 'colonne_invalide')
  }
  if (value.join !== undefined && value.join !== null && value.join !== '') {
    if (typeof value.join !== 'string' || !ALIAS.test(value.join)) {
      throw invalid(`${at}.join`, 'jointure_invalide')
    }
    return { join: value.join, field: value.field }
  }
  return { field: value.field }
}

function filterOf(value: unknown, at: string): Filter {
  if (!isRecord(value)) throw invalid(at, 'filtre_invalide')
  if (typeof value.expression === 'string') {
    const expression = value.expression.trim()
    if (expression === '') throw invalid(at, 'filtre_vide')
    const join =
      typeof value.join === 'string' && value.join !== '' ? { join: value.join } : undefined
    return { expression, ...join }
  }
  const op = value.op
  if (typeof op !== 'string' || !(FILTER_OPS as readonly string[]).includes(op)) {
    throw invalid(`${at}.op`, 'operateur_inconnu', op)
  }
  const values = listOf(value.values, `${at}.values`, 200).map((v, i) => {
    if (typeof v === 'string' || typeof v === 'boolean') return v
    if (typeof v === 'number' && Number.isFinite(v)) return v
    throw invalid(`${at}.values[${i}]`, 'valeur_invalide')
  })
  return { column: columnRef(value.column, `${at}.column`), op: op as FilterOp, values }
}

/**
 * A query as the kernel accepts it: its shape, its bounds — not yet whether its tables
 * and fields exist, which depends on who reads.
 */
export function checkBuilderQuery(raw: unknown, at = 'query'): BuilderQuery {
  if (!isRecord(raw)) throw invalid(at, 'requete_invalide')
  if (JSON.stringify(raw).length > QUERY_LIMITS.bytes) throw invalid(at, 'requete_trop_longue')
  if (typeof raw.source !== 'string' || raw.source === '')
    throw invalid(`${at}.source`, 'table_requise')

  const aliases = new Set<string>()
  const joins = listOf(raw.joins, `${at}.joins`, QUERY_LIMITS.joins).map((item, i): Join => {
    const where = `${at}.joins[${i}]`
    if (!isRecord(item)) throw invalid(where, 'jointure_invalide')
    const alias = item.alias
    if (typeof alias !== 'string' || !ALIAS.test(alias) || aliases.has(alias)) {
      throw invalid(`${where}.alias`, 'alias_invalide', alias)
    }
    aliases.add(alias)
    if (typeof item.table !== 'string' || item.table === '') {
      throw invalid(`${where}.table`, 'table_requise')
    }
    const kind = (JOIN_KINDS as readonly unknown[]).includes(item.kind) ? item.kind : 'left'
    if (typeof item.right !== 'string' || !NAME.test(item.right)) {
      throw invalid(`${where}.right`, 'colonne_invalide')
    }
    return {
      alias,
      table: item.table,
      kind: kind as Join['kind'],
      left: columnRef(item.left, `${where}.left`),
      right: item.right,
    }
  })

  const filters = listOf(raw.filters, `${at}.filters`, QUERY_LIMITS.filters).map((f, i) =>
    filterOf(f, `${at}.filters[${i}]`),
  )

  const aggregations = listOf(
    raw.aggregations,
    `${at}.aggregations`,
    QUERY_LIMITS.aggregations,
  ).map((item, i): Aggregation => {
    const where = `${at}.aggregations[${i}]`
    if (!isRecord(item) || !(AGGREGATION_FNS as readonly unknown[]).includes(item.fn)) {
      throw invalid(where, 'agregat_invalide', isRecord(item) ? item.fn : undefined)
    }
    const fn = item.fn as AggregationFn
    const label =
      typeof item.label === 'string' && item.label.trim() !== ''
        ? { label: item.label.trim().slice(0, 120) }
        : {}
    if (COLUMNLESS_FNS.has(fn)) return { fn, ...label }
    return { fn, column: columnRef(item.column, `${where}.column`), ...label }
  })

  const breakouts = listOf(raw.breakouts, `${at}.breakouts`, QUERY_LIMITS.breakouts).map(
    (item, i): Breakout => {
      const where = `${at}.breakouts[${i}]`
      const ref = columnRef(item, where)
      const b = item as Record<string, unknown>
      if (b.unit !== undefined && b.unit !== null && !isTemporalUnit(b.unit)) {
        throw invalid(`${where}.unit`, 'unite_inconnue', b.unit)
      }
      let bin: Breakout['bin']
      if (b.bin === 'auto') bin = 'auto'
      else if (typeof b.bin === 'number') {
        if (!Number.isFinite(b.bin) || b.bin <= 0) throw invalid(`${where}.bin`, 'pas_invalide')
        bin = b.bin
      }
      return {
        ...ref,
        ...(isTemporalUnit(b.unit) ? { unit: b.unit } : {}),
        ...(bin === undefined ? {} : { bin }),
      }
    },
  )

  const fields = listOf(raw.fields, `${at}.fields`, QUERY_LIMITS.fields).map((f, i) =>
    columnRef(f, `${at}.fields[${i}]`),
  )

  const sort = listOf(raw.sort, `${at}.sort`, QUERY_LIMITS.sort).map((item, i): OrderBy => {
    const where = `${at}.sort[${i}]`
    if (!isRecord(item) || !isRecord(item.target)) throw invalid(where, 'tri_invalide')
    const target = item.target
    const desc = item.desc === true
    if (target.kind === 'aggregation' || target.kind === 'breakout') {
      const index = target.index
      const count = target.kind === 'aggregation' ? aggregations.length : breakouts.length
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= count) {
        throw invalid(`${where}.target.index`, 'rang_invalide', index)
      }
      return { target: { kind: target.kind, index }, desc }
    }
    if (target.kind === 'column') {
      return {
        target: { kind: 'column', column: columnRef(target.column, `${where}.target.column`) },
        desc,
      }
    }
    throw invalid(`${where}.target`, 'tri_invalide')
  })

  let limit: number | null = null
  if (typeof raw.limit === 'number' && Number.isFinite(raw.limit)) {
    limit = Math.min(Math.max(Math.round(raw.limit), 1), QUERY_LIMITS.rows)
  }

  // Every join cites a column of the source or of a join declared before it.
  const declared = new Set<string>()
  for (const [i, join] of joins.entries()) {
    if (join.left.join !== undefined && !declared.has(join.left.join)) {
      throw invalid(`${at}.joins[${i}].left.join`, 'jointure_inconnue', join.left.join)
    }
    declared.add(join.alias)
  }
  const known = (ref: ColumnRef, where: string) => {
    if (ref.join !== undefined && !aliases.has(ref.join)) {
      throw invalid(where, 'jointure_inconnue', ref.join)
    }
  }
  for (const [i, f] of filters.entries()) {
    if ('column' in f) known(f.column, `${at}.filters[${i}]`)
    else if (f.join !== undefined && !aliases.has(f.join)) {
      throw invalid(`${at}.filters[${i}].join`, 'jointure_inconnue', f.join)
    }
  }
  for (const [i, a] of aggregations.entries()) {
    if (a.column !== undefined) known(a.column, `${at}.aggregations[${i}]`)
  }
  for (const [i, b] of breakouts.entries()) known(b, `${at}.breakouts[${i}]`)
  for (const [i, f] of fields.entries()) known(f, `${at}.fields[${i}]`)

  return {
    kind: 'builder',
    source: raw.source,
    ...(joins.length === 0 ? {} : { joins }),
    ...(filters.length === 0 ? {} : { filters }),
    ...(aggregations.length === 0 ? {} : { aggregations }),
    ...(breakouts.length === 0 ? {} : { breakouts }),
    ...(fields.length === 0 ? {} : { fields }),
    ...(sort.length === 0 ? {} : { sort }),
    ...(limit === null ? {} : { limit }),
  }
}

/** The filters of a dashboard, as a card hands them over: checked, never trusted. */
export function checkConstraints(raw: unknown): Constraint[] {
  return listOf(raw, 'constraints', 64).map((item, i): Constraint => {
    const at = `constraints[${i}]`
    if (!isRecord(item) || !isRecord(item.target)) throw invalid(at, 'filtre_invalide')
    const type = item.type
    if (!(PARAMETER_TYPES as readonly unknown[]).includes(type)) {
      throw invalid(`${at}.type`, 'type_inconnu', type)
    }
    const target =
      typeof item.target.variable === 'string'
        ? { variable: item.target.variable }
        : { column: columnRef(item.target.column, `${at}.target.column`) }
    const value = item.value
    const scalar = (v: unknown) =>
      typeof v === 'string' || v === null || (typeof v === 'number' && Number.isFinite(v))
    if (
      !(
        typeof value === 'string' ||
        (Array.isArray(value) && value.length <= 200 && value.every(scalar))
      )
    ) {
      throw invalid(`${at}.value`, 'valeur_invalide')
    }
    const operator = (NUMBER_OPERATORS as readonly unknown[]).includes(item.operator)
      ? { operator: item.operator as Constraint['operator'] }
      : {}
    return {
      target,
      type: type as Constraint['type'],
      value: value as Constraint['value'],
      ...operator,
    }
  })
}

// ── What the reader may read ────────────────────────────────────────────────

/** A table of the query, as the reader reads it. */
interface Scope {
  /** `''` for the source, the join's alias otherwise. */
  readonly key: string
  /** The alias of its sub-query: `s`, `j1`, `j2`… */
  readonly alias: string
  readonly tableId: string
  readonly tableLabel: string
  readonly plan: Plan
  /** Its readable columns, read as the plain columns of its sub-query. */
  readonly columns: ReadonlyMap<string, FilterableColumn>
  readonly labels: ReadonlyMap<string, string>
  /** A stored formula reads as its result: a number is summed like one. */
  readonly results: ReadonlyMap<string, string>
}

const SYSTEM_LABELS: Readonly<Record<string, string>> = {
  _id: 'Identifiant',
  _created_at: 'Créé le',
  _updated_at: 'Modifié le',
  _created_by: 'Créé par',
  _updated_by: 'Modifié par',
}

async function scopesOf(
  pools: Pools,
  ctx: RequestContext,
  baseId: string,
  query: BuilderQuery,
): Promise<Map<string, Scope>> {
  const entries = [
    { key: '', table: query.source },
    ...(query.joins ?? []).map((j) => ({ key: j.alias, table: j.table })),
  ]
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      // A table by its key or by its name, as the data routes take it.
      const tables = await exec.query<{ id: string; name: string; label: string }>(
        `SELECT t.id::text, tn.name, t.label
           FROM _basedb.table_def t
           JOIN _basedb.physical_name tn ON tn.id = t.name_id
          WHERE t.base_id = $1 AND t.is_live
            AND (t.id::text = ANY($2::text[]) OR tn.name = ANY($2::text[]))`,
        [baseId, entries.map((e) => e.table)],
      )
      const ids = tables.map((t) => t.id)
      const fields = await exec.query<{
        table_id: string
        name: string
        label: string
        result_kind: string | null
      }>(
        `SELECT f.table_id::text, n.name, f.label, fc.result_kind
           FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
           LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
          WHERE f.table_id::text = ANY($1::text[]) AND f.is_live`,
        [ids],
      )
      const scopes = new Map<string, Scope>()
      for (const [index, entry] of entries.entries()) {
        const table = tables.find((t) => t.id === entry.table || t.name === entry.table)
        // Another base's table, a deleted one and an unreadable one answer alike.
        if (table === undefined) {
          throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: entry.table } })
        }
        const plan = await buildPlan(exec, ctx, table.id)
        const columns = new Map<string, FilterableColumn>()
        for (const [name, column] of plan.filterable) {
          const { alias: _alias, ...plain } = column
          columns.set(name, plain)
        }
        const own = fields.filter((f) => f.table_id === table.id)
        scopes.set(entry.key, {
          key: entry.key,
          alias: index === 0 ? 's' : `j${index}`,
          tableId: table.id,
          tableLabel: table.label,
          plan,
          columns,
          labels: new Map([
            ...Object.entries(SYSTEM_LABELS),
            ...own.map((f) => [f.name, f.label] as [string, string]),
          ]),
          results: new Map(
            own
              .filter((f) => f.result_kind !== null)
              .map((f) => [f.name, f.result_kind as string] as [string, string]),
          ),
        })
      }
      return scopes
    },
    { readOnly: true },
  )
}

/** The sub-query of a table: its readable columns, its row predicate, and nothing else. */
function subQuery(plan: Plan): string {
  const computed = new Set(plan.computed.map((c) => c.name))
  const projection = plan.columns
    .map((c) => `${quoteIdentifier(computed.has(c) ? 'v' : 't')}.${quoteIdentifier(c)}`)
    .join(', ')
  return `(SELECT ${projection}
     FROM ${qualify(plan.schemaName, plan.tableName)} AS "t"${planLateral(plan, 't')}
    WHERE ( /*predicat_lignes:${plan.tableName}*/ ${plan.decision.rowPredicate} ))`
}

interface Resolved {
  readonly scope: Scope
  readonly column: FilterableColumn
  /** `"s"."montant"` */
  readonly sql: string
  /** What its values are: a formula's result, `user` for who created a row. */
  readonly kind: string
  readonly name: string
}

const USER_COLUMNS = new Set(['_created_by', '_updated_by'])
const ARRAY_KINDS = new Set(['multi_select', 'multi_link', 'lookup'])
const NUMERIC_KINDS = new Set(['number', 'rollup', 'count', 'autonumber'])
const DATE_KINDS = new Set(['date', 'datetime'])
const DOCUMENT_KINDS = new Set(['file', 'image', 'button'])

function resolver(scopes: ReadonlyMap<string, Scope>) {
  return (ref: ColumnRef): Resolved => {
    const scope = scopes.get(ref.join ?? '')
    const column = scope === undefined ? undefined : resolveColumn(ref.field, scope.columns)
    if (scope === undefined || column === undefined) {
      // Unknown and masked: one answer, as in a filter (chapter 08 §4.3).
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: columnName(ref) } })
    }
    const kind =
      ref.field === '_id'
        ? 'id'
        : USER_COLUMNS.has(ref.field)
          ? 'user'
          : column.kind === 'formula'
            ? (scope.results.get(column.name) ?? 'formula')
            : column.kind
    return {
      scope,
      column,
      sql: `${quoteIdentifier(scope.alias)}.${quoteIdentifier(column.name)}`,
      kind,
      name: columnName(ref),
    }
  }
}

const labelOf = (r: Resolved) => {
  const field = r.scope.labels.get(r.column.name) ?? r.column.name
  return r.scope.key === '' ? field : `${r.scope.tableLabel} → ${field}`
}

// ── Filters, in the grammar of chapter 08 §4 ────────────────────────────────

/** A value as the filter grammar reads it: quoted, `"` and `\` escaped; a boolean bare. */
const literal = (value: FilterValue): string =>
  typeof value === 'boolean' ? String(value) : `"${String(value).replace(/(["\\])/g, '\\$1')}"`

const list = (values: readonly FilterValue[]) => `[${values.map(literal).join(', ')}]`

/** Text whose empty string is empty, as the aggregates count it. */
const EMPTY_TEXT = new Set(['short_text', 'select', 'url', 'email'])

interface Clock {
  readonly today: string
  readonly timeZone: string
  readonly weekStart: 0 | 1
}

/** One filter of the builder as an expression of the grammar, on one column. */
export function filterExpression(
  name: string,
  kind: string,
  filter: { readonly op: FilterOp; readonly values: readonly FilterValue[] },
  clock: Clock,
): string {
  const { op, values } = filter
  const first = values[0]
  const need = (n: number) => {
    if (values.length < n || values.some((v) => v === '' || v === null)) {
      throw invalid('filters', 'valeur_requise', { field: name, op })
    }
  }
  const array = ARRAY_KINDS.has(kind)
  const empty = EMPTY_TEXT.has(kind) ? `(${name} is_null or ${name} eq "")` : `${name} is_null`

  // A day, as the column compares it: itself for a date, the instant it opens in the
  // reader's zone for a moment.
  const at = (day: string) => (kind === 'datetime' ? zonedMidnight(day, clock.timeZone) : day)
  const day = (value: FilterValue | undefined): string => {
    const span = resolveDateExpression(String(value ?? ''), clock.today, clock.weekStart)
    if (span === null) throw invalid('filters', 'date_invalide', { field: name, value })
    return (span.start ?? span.end) as string
  }

  switch (op) {
    case 'empty':
      return empty
    case 'not_empty':
      return `not ${empty}`
    case 'true':
      return `${name} eq true`
    case 'false':
      return `${name} eq false`
    case 'is':
    case 'has_any':
      need(1)
      if (array || op === 'has_any') return `${name} has_any ${list(values)}`
      return values.length === 1
        ? `${name} eq ${literal(first as FilterValue)}`
        : `${name} in ${list(values)}`
    case 'is_not':
    case 'has_none':
      need(1)
      if (array || op === 'has_none')
        return `(not ${name} has_any ${list(values)} or ${name} is_null)`
      return `(not ${name} in ${list(values)} or ${name} is_null)`
    case 'has_all':
      need(1)
      return `${name} has_all ${list(values)}`
    case 'contains':
    case 'starts_with':
    case 'ends_with':
      need(1)
      return `${name} ${op} ${literal(String(first))}`
    case 'not_contains':
      need(1)
      return `(not ${name} contains ${literal(String(first))} or ${name} is_null)`
    case 'eq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      need(1)
      return `${name} ${op} ${literal(first as FilterValue)}`
    case 'ne':
      need(1)
      return `(${name} ne ${literal(first as FilterValue)} or ${name} is_null)`
    case 'between':
      need(2)
      if (DATE_KINDS.has(kind)) {
        const start = day(values[0])
        const end = day(values[1])
        return kind === 'date'
          ? `${name} between ${list([start, end])}`
          : `(${name} gte ${literal(at(start))} and ${name} lt ${literal(at(addDays(end, 1)))})`
      }
      return `${name} between ${list([values[0] as FilterValue, values[1] as FilterValue])}`
    case 'before':
      need(1)
      return `${name} lt ${literal(at(day(first)))}`
    case 'after': {
      need(1)
      const span = resolveDateExpression(String(first), clock.today, clock.weekStart)
      const last = span?.end ?? span?.start
      if (last === null || last === undefined)
        throw invalid('filters', 'date_invalide', { field: name })
      return kind === 'date'
        ? `${name} gt ${literal(last)}`
        : `${name} gte ${literal(at(addDays(last, 1)))}`
    }
    case 'date': {
      need(1)
      const span = resolveDateExpression(String(first), clock.today, clock.weekStart)
      if (span === null) throw invalid('filters', 'date_invalide', { field: name, value: first })
      const parts: string[] = []
      if (kind === 'date') {
        if (span.start !== null && span.end !== null)
          return `${name} between ${list([span.start, span.end])}`
        if (span.start !== null) parts.push(`${name} gte ${literal(span.start)}`)
        if (span.end !== null) parts.push(`${name} lte ${literal(span.end)}`)
      } else {
        if (span.start !== null) parts.push(`${name} gte ${literal(at(span.start))}`)
        if (span.end !== null) parts.push(`${name} lt ${literal(at(addDays(span.end, 1)))}`)
      }
      return parts.length === 1 ? (parts[0] as string) : `(${parts.join(' and ')})`
    }
  }
}

/** A dashboard's filter on a column, as one filter of the builder. `null`: no value, no filter. */
function constraintFilter(constraint: Constraint, kind: string): Filter | null {
  if (!('column' in constraint.target)) return null
  const column = constraint.target.column
  const value = constraint.value
  const values = (Array.isArray(value) ? value : [value]).filter(
    (v): v is string | number => v !== null && v !== '',
  )
  if (values.length === 0) return null
  switch (constraint.type) {
    case 'date':
      return { column, op: 'date', values: [String(values[0])] }
    case 'text':
      // A choice is one of a list: it is picked, not searched.
      return kind === 'select' || kind === 'multi_select'
        ? { column, op: 'is', values: values.map(String) }
        : { column, op: 'contains', values: [String(values[0])] }
    case 'category': {
      if (kind === 'boolean') {
        const flags = new Set(values.map((v) => String(v)))
        if (flags.size !== 1) return null
        return { column, op: flags.has('true') ? 'true' : 'false', values: [] }
      }
      return {
        column,
        op: 'is',
        values: values.map((v) => (NUMERIC_KINDS.has(kind) ? Number(v) : String(v))),
      }
    }
    case 'number': {
      const bounds = Array.isArray(value) ? value : [value]
      const low = typeof bounds[0] === 'number' ? bounds[0] : null
      const high = typeof bounds[1] === 'number' ? bounds[1] : null
      switch (constraint.operator ?? 'eq') {
        case 'eq':
          return low === null ? null : { column, op: 'eq', values: [low] }
        case 'gte':
          return low === null ? null : { column, op: 'gte', values: [low] }
        case 'lte': {
          const bound = high ?? low
          return bound === null ? null : { column, op: 'lte', values: [bound] }
        }
        case 'between':
          if (low !== null && high !== null) return { column, op: 'between', values: [low, high] }
          if (low !== null) return { column, op: 'gte', values: [low] }
          return high === null ? null : { column, op: 'lte', values: [high] }
      }
      return null
    }
    case 'temporal_unit':
      return null
  }
}

// ── Running ─────────────────────────────────────────────────────────────────

export interface RunBuilderRequest {
  readonly baseId: string
  readonly query: BuilderQuery
  readonly constraints?: readonly Constraint[]
  /** The reader's zone: dates are cut, and « this month » starts, there. */
  readonly timeZone?: string
  readonly weekStart?: 0 | 1
}

const TRUNCATIONS = new Set<string>(TEMPORAL_UNITS)
const EXTRACTIONS: Readonly<Record<string, string>> = {
  hour_of_day: 'hour',
  day_of_week: 'isodow',
  day_of_month: 'day',
  week_of_year: 'week',
  month_of_year: 'month',
  quarter_of_year: 'quarter',
}

const AGGREGATION_LABELS: Readonly<Record<AggregationFn, string>> = {
  count: 'Nombre de lignes',
  cum_count: 'Nombre cumulé de lignes',
  distinct: 'Valeurs distinctes de',
  sum: 'Somme de',
  cum_sum: 'Somme cumulée de',
  avg: 'Moyenne de',
  median: 'Médiane de',
  min: 'Minimum de',
  max: 'Maximum de',
  stddev: 'Écart type de',
}

const UNIT_LABELS: Readonly<Record<TemporalUnit, string>> = {
  minute: 'minute',
  hour: 'heure',
  day: 'jour',
  week: 'semaine',
  month: 'mois',
  quarter: 'trimestre',
  year: 'année',
  hour_of_day: 'heure du jour',
  day_of_week: 'jour de la semaine',
  day_of_month: 'jour du mois',
  week_of_year: 'semaine de l’année',
  month_of_year: 'mois de l’année',
  quarter_of_year: 'trimestre de l’année',
}

/** A width that reads well — 1, 2, 5 times a power of ten — for about `bins` bins. */
export function niceWidth(min: number, max: number, bins = 10): number {
  const span = max - min
  if (!Number.isFinite(span) || span <= 0) return 1
  const raw = span / bins
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= raw) ?? 10
  return step * power
}

/** Values PostgreSQL hands back as text or `Date`, as the screen reads them. */
function readValue(raw: unknown, kind: string): unknown {
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date) return raw.toISOString()
  if (typeof raw === 'string' && NUMERIC_KINDS.has(kind)) {
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  return raw
}

export async function runBuilderQuery(
  pools: Pools,
  ctx: RequestContext,
  request: RunBuilderRequest,
): Promise<QueryResult> {
  const started = Date.now()
  const timeZone = validTimeZone(request.timeZone)
  const clock: Clock = {
    today: todayIn(timeZone),
    timeZone,
    weekStart: request.weekStart === 0 ? 0 : 1,
  }
  const scopes = await scopesOf(pools, ctx, request.baseId, request.query)
  const resolve = resolver(scopes)
  const source = scopes.get('') as Scope

  // The dashboard's filters: a period replaces a grouping's, a value adds a filter.
  let breakouts = [...(request.query.breakouts ?? [])]
  const filters = [...(request.query.filters ?? [])]
  for (const constraint of request.constraints ?? []) {
    if (!('column' in constraint.target)) continue
    const target = constraint.target.column
    if (constraint.type === 'temporal_unit') {
      const unit = Array.isArray(constraint.value) ? constraint.value[0] : constraint.value
      if (!isTemporalUnit(unit)) continue
      breakouts = breakouts.map((b) =>
        b.field === target.field && (b.join ?? '') === (target.join ?? '') ? { ...b, unit } : b,
      )
      continue
    }
    const resolved = resolve(target)
    const filter = constraintFilter(constraint, resolved.kind)
    if (filter !== null) filters.push(filter)
  }

  const params: unknown[] = []
  const bind = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  const tz = () => `${bind(timeZone)}::text`

  // FROM: the source, then each join, each through its own sub-query.
  const from: string[] = [`${subQuery(source.plan)} AS "s"`]
  for (const join of request.query.joins ?? []) {
    const scope = scopes.get(join.alias) as Scope
    const left = resolve(join.left)
    const right = resolve({ join: join.alias, field: join.right })
    const compatible = familyOf(left.kind, left.column) === familyOf(right.kind, right.column)
    if (!compatible) {
      throw invalid('query.joins', 'jointure_incompatible', { left: left.name, right: right.name })
    }
    const on = ARRAY_KINDS.has(left.column.kind)
      ? `${right.sql} = ANY(${left.sql})`
      : ARRAY_KINDS.has(right.column.kind)
        ? `${left.sql} = ANY(${right.sql})`
        : `${left.sql} = ${right.sql}`
    const keyword = { left: 'LEFT JOIN', inner: 'JOIN', right: 'RIGHT JOIN', full: 'FULL JOIN' }[
      join.kind
    ]
    from.push(`${keyword} ${subQuery(scope.plan)} AS ${quoteIdentifier(scope.alias)}\n    ON ${on}`)
  }

  // WHERE: every filter through the grammar's own builder, on its table's columns.
  const where: string[] = []
  for (const filter of filters) {
    let scope: Scope
    let expression: string
    if ('expression' in filter) {
      scope = scopes.get(filter.join ?? '') as Scope
      expression = filter.expression
    } else {
      const resolved = resolve(filter.column)
      scope = resolved.scope
      expression = filterExpression(resolved.column.name, resolved.kind, filter, clock)
    }
    const built = buildFilter(expression, scope.columns, {
      alias: scope.alias,
      firstParameter: params.length + 1,
      links: scope.plan.links,
    })
    params.push(...built.params)
    where.push(`( ${built.sql} )`)
  }
  const fromSql = from.join('\n  ')
  const whereSql = where.length === 0 ? '' : `\n WHERE ${where.join('\n   AND ')}`
  // What FROM and WHERE bind, before the projection binds its own: the bounds of an
  // automatic bin are read with these alone.
  const whereParams = [...params]

  const aggregations = request.query.aggregations ?? []
  const grouped = aggregations.length > 0 || breakouts.length > 0
  const limit = Math.min(request.query.limit ?? QUERY_LIMITS.rows, QUERY_LIMITS.rows)

  const run = (sql: string, values: readonly unknown[]) =>
    pools.withConnection('data', (exec) => exec.query<Record<string, unknown>>(sql, [...values]))

  let sql: string
  let columns: ResultColumn[]
  let record: QueryResult['record']

  if (grouped) {
    const names = resultNames({ aggregations, breakouts })
    const laterals: string[] = []
    const dimensions: Array<{ sql: string; column: ResultColumn; weekday: boolean }> = []
    for (const [i, breakout] of breakouts.entries()) {
      const r = resolve(breakout)
      if (DOCUMENT_KINDS.has(r.column.kind)) {
        throw invalid(`query.breakouts[${i}]`, 'regroupement_impossible', r.name)
      }
      let expr = r.sql
      let type = r.kind
      let unit: TemporalUnit | undefined
      let bin: number | undefined
      if (ARRAY_KINDS.has(r.column.kind)) {
        // A list counts its row once per element: a row tagged twice is in two groups.
        const alias = `u${i + 1}`
        laterals.push(
          `LEFT JOIN LATERAL unnest(${r.sql}) AS ${quoteIdentifier(alias)}("value") ON TRUE`,
        )
        expr = `${quoteIdentifier(alias)}."value"`
        type =
          r.column.kind === 'multi_select'
            ? 'select'
            : r.column.kind === 'multi_link'
              ? 'link'
              : (r.column.elementKind ?? 'short_text')
      } else if (DATE_KINDS.has(r.kind)) {
        unit = breakout.unit ?? 'day'
        const local =
          r.kind === 'datetime' ? `(${r.sql} AT TIME ZONE ${tz()})` : `${r.sql}::timestamp`
        if (TRUNCATIONS.has(unit)) {
          const cut =
            unit === 'week' && clock.weekStart === 0
              ? `(date_trunc('week', ${local} + interval '1 day') - interval '1 day')`
              : `date_trunc('${unit}', ${local})`
          const fine = unit === 'minute' || unit === 'hour'
          expr = `to_char(${cut}, '${fine ? 'YYYY-MM-DD"T"HH24:MI' : 'YYYY-MM-DD'}')`
          type = fine ? 'datetime' : 'date'
        } else {
          expr = `extract(${EXTRACTIONS[unit]} from ${local})::int`
          type = 'number'
        }
      } else if (NUMERIC_KINDS.has(r.kind) && breakout.bin !== undefined) {
        bin =
          breakout.bin === 'auto'
            ? await autoWidth(run, fromSql, whereSql, r.sql, whereParams)
            : breakout.bin
        expr = `(floor(${r.sql} / ${bind(bin)}::numeric) * ${bind(bin)}::numeric)`
        type = 'number'
      }
      const label = unit === undefined ? labelOf(r) : `${labelOf(r)} : ${UNIT_LABELS[unit]}`
      dimensions.push({
        sql: expr,
        weekday: unit === 'day_of_week' && clock.weekStart === 0,
        column: {
          name: names.breakouts[i] as string,
          label,
          role: 'dimension',
          type,
          ...(unit === undefined ? {} : { unit }),
          ...(bin === undefined ? {} : { bin }),
          source: sourceOf(r),
        },
      })
    }

    const metrics = aggregations.map((a, i) => {
      const expression = aggregateSql(a, a.column === undefined ? null : resolve(a.column), i)
      const target = a.column === undefined ? null : resolve(a.column)
      const label =
        a.label ??
        (target === null
          ? AGGREGATION_LABELS[a.fn]
          : `${AGGREGATION_LABELS[a.fn]} ${labelOf(target)}`)
      return {
        sql: expression,
        cumulative: a.fn === 'cum_count' || a.fn === 'cum_sum',
        column: {
          name: names.aggregations[i] as string,
          label,
          role: 'metric' as const,
          // A minimum of dates is a date, and reads as one.
          type:
            (a.fn === 'min' || a.fn === 'max') && target !== null && DATE_KINDS.has(target.kind)
              ? target.kind
              : 'number',
          ...(target === null ? {} : { source: sourceOf(target) }),
        },
      }
    })

    const inner = [
      ...dimensions.map((d, i) => `${d.sql} AS "d${i}"`),
      ...metrics.map((m, i) => `${m.sql} AS "m${i}"`),
    ].join(',\n       ')
    const groupBy =
      dimensions.length === 0 ? '' : `\n GROUP BY ${dimensions.map((_, i) => i + 1).join(', ')}`

    // A running total runs along the first grouping, within each value of the others.
    const partition = dimensions.slice(1).map((_, i) => `"q"."d${i + 1}"`)
    const outer = [
      ...dimensions.map((_, i) => `"q"."d${i}"`),
      ...metrics.map((m, i) =>
        m.cumulative && dimensions.length > 0
          ? `sum("q"."m${i}") OVER (${partition.length > 0 ? `PARTITION BY ${partition.join(', ')} ` : ''}ORDER BY "q"."d0" ROWS UNBOUNDED PRECEDING) AS "m${i}"`
          : `"q"."m${i}"`,
      ),
    ].join(', ')

    const dimensionOrder = (i: number, desc: boolean) =>
      `${dimensions[i]?.weekday ? `("q"."d${i}" % 7)` : `"q"."d${i}"`}${desc ? ' DESC' : ''}`
    const order = (request.query.sort ?? []).map((term) => {
      const desc = term.desc === true
      if (term.target.kind === 'aggregation')
        return `"q"."m${term.target.index}"${desc ? ' DESC' : ''}`
      if (term.target.kind === 'breakout') return dimensionOrder(term.target.index, desc)
      const column = term.target.column
      const index = breakouts.findIndex(
        (b) => b.field === column.field && (b.join ?? '') === (column.join ?? ''),
      )
      if (index < 0) throw invalid('query.sort', 'tri_hors_groupes', columnName(column))
      return dimensionOrder(index, desc)
    })
    if (order.length === 0) order.push(...dimensions.map((_, i) => dimensionOrder(i, false)))

    sql = `SELECT ${outer}
  FROM (SELECT ${inner}
  FROM ${fromSql}${laterals.length === 0 ? '' : `\n  ${laterals.join('\n  ')}`}${whereSql}${groupBy}) AS "q"${
    order.length === 0 ? '' : `\n ORDER BY ${order.join(', ')}`
  }
 LIMIT ${limit + 1};`
    columns = [...dimensions.map((d) => d.column), ...metrics.map((m) => m.column)]
  } else {
    // Rows as they are: the chosen columns, or every one read, and each row's identifier.
    const refs: ColumnRef[] =
      request.query.fields !== undefined && request.query.fields.length > 0
        ? [...request.query.fields]
        : [...scopes.values()].flatMap((scope) =>
            scope.plan.columns
              .filter((c) => !SYSTEM_COLUMNS.includes(c))
              .map((field) => (scope.key === '' ? { field } : { join: scope.key, field })),
          )
    const resolved = refs.map(resolve)
    const id = resolve({ field: '_id' })
    const selected = [...resolved, id]
    const order = (request.query.sort ?? []).map((term) => {
      if (term.target.kind !== 'column') throw invalid('query.sort', 'tri_sans_groupes')
      const r = resolve(term.target.column)
      if (!sortableKind(r.column.kind)) throw invalid('query.sort', 'tri_impossible', r.name)
      return `${r.sql}${term.desc === true ? ' DESC' : ''}`
    })
    order.push(`${id.sql}`)
    sql = `SELECT ${selected.map((r, i) => `${r.sql} AS "c${i}"`).join(', ')}
  FROM ${fromSql}${whereSql}
 ORDER BY ${order.join(', ')}
 LIMIT ${limit + 1};`
    columns = selected.map((r, i) => ({
      name: i === selected.length - 1 ? '_row' : r.name,
      label: labelOf(r),
      role: 'field' as const,
      type: r.kind,
      source: sourceOf(r),
      ...(i === selected.length - 1 ? { hidden: true } : {}),
    }))
    record = { table: source.tableId, column: selected.length - 1 }
  }

  const raw = await run(sql, params)
  const truncated = raw.length > limit
  const keys = columns.map((_, i) =>
    grouped ? (i < breakouts.length ? `d${i}` : `m${i - breakouts.length}`) : `c${i}`,
  )
  const rows = raw.slice(0, limit).map((row) =>
    columns.map((column, i) => {
      const value = row[keys[i] as string]
      return column.role === 'metric' && column.type === 'number' && typeof value === 'string'
        ? Number(value)
        : readValue(value, column.type)
    }),
  )

  const labelled = await withLinkLabels(pools, scopes, columns, rows)
  return {
    columns: labelled,
    rows,
    truncated,
    duration_ms: Date.now() - started,
    ...(record === undefined ? {} : { record }),
  }
}

/** Where a column comes from, for the screen to format it and to drill into it. */
function sourceOf(r: Resolved): NonNullable<ResultColumn['source']> {
  return {
    table: r.scope.tableId,
    field: r.column.name,
    ...(r.scope.key === '' ? {} : { join: r.scope.key }),
  }
}

/** Two columns a join may compare: identifiers with identifiers, text with text… */
function familyOf(kind: string, column: FilterableColumn): string {
  const element = ARRAY_KINDS.has(column.kind)
    ? column.kind === 'multi_select'
      ? 'select'
      : column.kind === 'multi_link'
        ? 'link'
        : (column.elementKind ?? 'short_text')
    : kind
  if (['id', 'link', 'user'].includes(element)) return 'uuid'
  if (['short_text', 'long_text', 'select', 'email', 'url'].includes(element)) return 'text'
  if (NUMERIC_KINDS.has(element)) return 'number'
  return element
}

function aggregateSql(a: Aggregation, target: Resolved | null, index: number): string {
  const at = `query.aggregations[${index}]`
  if (a.fn === 'count' || a.fn === 'cum_count') return 'count(*)'
  if (target === null) throw invalid(at, 'colonne_requise')
  if (DOCUMENT_KINDS.has(target.column.kind)) throw invalid(at, 'agregat_impossible', target.name)
  if (a.fn === 'distinct') {
    if (target.column.kind === 'long_text') throw invalid(at, 'agregat_impossible', target.name)
    return `count(DISTINCT ${target.sql})`
  }
  if (ARRAY_KINDS.has(target.column.kind)) throw invalid(at, 'agregat_impossible', target.name)
  const numeric = NUMERIC_KINDS.has(target.kind)
  if ((a.fn === 'min' || a.fn === 'max') && (numeric || DATE_KINDS.has(target.kind))) {
    return `${a.fn}(${target.sql})`
  }
  if (!numeric) throw invalid(at, 'agregat_impossible', target.name)
  switch (a.fn) {
    case 'sum':
    case 'cum_sum':
      return `sum(${target.sql})`
    case 'avg':
      return `avg(${target.sql})`
    case 'median':
      return `percentile_cont(0.5) WITHIN GROUP (ORDER BY ${target.sql})`
    case 'stddev':
      return `stddev_samp(${target.sql})`
    default:
      return `${a.fn}(${target.sql})`
  }
}

/** The bounds of a column over the kept rows, for about ten bins of a round width. */
async function autoWidth(
  run: (sql: string, values: readonly unknown[]) => Promise<Array<Record<string, unknown>>>,
  from: string,
  where: string,
  column: string,
  params: readonly unknown[],
): Promise<number> {
  const [bounds] = await run(
    `SELECT min(${column}) AS "low", max(${column}) AS "high"\n  FROM ${from}${where};`,
    params,
  )
  return niceWidth(Number(bounds?.low ?? 0), Number(bounds?.high ?? 0))
}

/**
 * What the identifiers of a link column read as — its target's display column, read with
 * the target's row predicate and only if the reader reads that table and that column.
 */
async function withLinkLabels(
  pools: Pools,
  scopes: ReadonlyMap<string, Scope>,
  columns: readonly ResultColumn[],
  rows: ReadonlyArray<readonly unknown[]>,
): Promise<ResultColumn[]> {
  const out: ResultColumn[] = []
  for (const [index, column] of columns.entries()) {
    const scope = column.source === undefined ? undefined : scopes.get(column.source.join ?? '')
    const target =
      scope === undefined || column.source === undefined
        ? undefined
        : scope.plan.links.get(column.source.field)
    if (
      (column.type !== 'link' && column.type !== 'multi_link') ||
      target === undefined ||
      !target.readable ||
      target.displayColumn === null
    ) {
      out.push(column)
      continue
    }
    const ids = new Set<string>()
    for (const row of rows) {
      const value = row[index]
      for (const id of Array.isArray(value) ? value : [value]) {
        if (typeof id === 'string') ids.add(id)
      }
    }
    if (ids.size === 0) {
      out.push(column)
      continue
    }
    const display = target.displayColumn
    const found = await pools.withConnection('data', (exec) =>
      exec.query<{ id: string; label: string | null }>(
        `SELECT "l"."_id"::text AS id, "l".${quoteIdentifier(display.name)}::text AS label
           FROM ${target.relation} AS "l"
          WHERE "l"."_id" = ANY($1::uuid[])
            AND ( /*predicat_lignes:${column.source?.field}*/ ${target.rowPredicate} )`,
        [[...ids]],
      ),
    )
    const labels: Record<string, string> = {}
    for (const r of found) if (r.label !== null) labels[r.id] = r.label
    out.push({ ...column, labels })
  }
  return out
}
