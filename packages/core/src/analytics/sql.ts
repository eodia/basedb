import {
  type Constraint,
  type ParameterValue,
  QUERY_LIMITS,
  type QueryResult,
  type ResultColumn,
  SQL_FILTER_KINDS,
  SQL_VARIABLE_TYPES,
  type SqlQuery,
  type SqlVariable,
  addDays,
  resolveDateExpression,
  sqlVariableNames,
} from '@basedb/contracts'
import { quoteLiteral } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import type { Pools } from '../runtime/pool.js'
import { uniqueKey } from '../sql/console.js'
import { runReaderSql } from '../sql/reader.js'
import type { RequestContext } from '../tx/context.js'
import { todayIn, validTimeZone, zonedMidnight } from './time.js'

/**
 * SQL questions — chapter 18 §3.3: one `SELECT`, its variables, and nothing of its author.
 *
 * Always through the READER (`sql/reader.ts`), never through the console: read only, on
 * the person's own role, their tables and their fields alone — whoever manages the base
 * included. A question sits on a dashboard others open; if it ran with the console's reach
 * for whoever manages the base, a `DELETE` saved as a question would run the day a manager
 * looked at the dashboard.
 *
 * A variable is written `{{nom}}`; a part that should vanish when a variable has no value
 * is written between `[[` and `]]`. Values become literals quoted here — the statement is
 * the author's text anyway, run with the reader's rights: what a value could add to it,
 * the author could have written.
 */

const invalid = (field: string, reason: string, detail?: unknown): BasedbError =>
  new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/

/** A SQL question as the kernel accepts it. */
export function checkSqlQuery(raw: unknown, at = 'query'): SqlQuery {
  if (typeof raw !== 'object' || raw === null) throw invalid(at, 'requete_invalide')
  const r = raw as Record<string, unknown>
  if (typeof r.sql !== 'string' || r.sql.trim() === '') throw invalid(`${at}.sql`, 'sql_requis')
  if (r.sql.length > QUERY_LIMITS.sql) throw invalid(`${at}.sql`, 'sql_trop_long')
  const raws = r.variables === undefined || r.variables === null ? [] : r.variables
  if (!Array.isArray(raws) || raws.length > QUERY_LIMITS.variables) {
    throw invalid(`${at}.variables`, 'liste_attendue')
  }
  const names = new Set<string>()
  const variables = raws.map((item, i): SqlVariable => {
    const where = `${at}.variables[${i}]`
    const v = (item ?? {}) as Record<string, unknown>
    if (typeof v.name !== 'string' || !NAME.test(v.name) || names.has(v.name)) {
      throw invalid(`${where}.name`, 'nom_invalide', v.name)
    }
    names.add(v.name)
    const type = (SQL_VARIABLE_TYPES as readonly unknown[]).includes(v.type)
      ? (v.type as SqlVariable['type'])
      : 'text'
    const label =
      typeof v.label === 'string' && v.label.trim() !== '' ? v.label.trim().slice(0, 120) : v.name
    const out: Record<string, unknown> = { name: v.name, label, type }
    if (v.required === true) out.required = true
    if (typeof v.default === 'string' || Array.isArray(v.default)) out.default = v.default
    if (type === 'filter') {
      if (typeof v.column !== 'string' || v.column.trim() === '' || v.column.length > 500) {
        throw invalid(`${where}.column`, 'colonne_requise')
      }
      out.column = v.column.trim()
      out.column_kind = (SQL_FILTER_KINDS as readonly unknown[]).includes(v.column_kind)
        ? v.column_kind
        : 'text'
    }
    return out as unknown as SqlVariable
  })
  return { kind: 'sql', sql: r.sql, ...(variables.length === 0 ? {} : { variables }) }
}

interface Clock {
  readonly today: string
  readonly timeZone: string
  readonly weekStart: 0 | 1
}

/** A value given to a variable: a filter of the dashboard, or its default. */
interface Given {
  readonly value: ParameterValue
  readonly type: Constraint['type'] | null
  readonly operator?: Constraint['operator']
}

const present = (value: ParameterValue | null | undefined): value is ParameterValue =>
  value !== null &&
  value !== undefined &&
  (typeof value === 'string' ? value.trim() !== '' : value.some((v) => v !== null && v !== ''))

const scalars = (value: ParameterValue): Array<string | number> =>
  (Array.isArray(value) ? value : [value]).filter(
    (v): v is string | number => v !== null && v !== '',
  )

function numberLiteral(value: string | number, name: string): string {
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) throw invalid('variables', 'nombre_invalide', name)
  return String(n)
}

function span(value: ParameterValue, clock: Clock, name: string) {
  const text = String(scalars(value)[0] ?? '')
  const resolved = resolveDateExpression(text, clock.today, clock.weekStart)
  if (resolved === null) throw invalid('variables', 'date_invalide', name)
  return resolved
}

/** A condition on a variable's column, for a `filter` variable. */
function condition(variable: SqlVariable, given: Given, clock: Clock): string {
  const column = `(${variable.column})`
  const kind = variable.column_kind ?? 'text'
  if (kind === 'date' || kind === 'datetime') {
    const s = span(given.value, clock, variable.name)
    const parts: string[] = []
    if (kind === 'date') {
      if (s.start !== null) parts.push(`${column} >= ${quoteLiteral(s.start)}`)
      if (s.end !== null) parts.push(`${column} <= ${quoteLiteral(s.end)}`)
    } else {
      if (s.start !== null)
        parts.push(`${column} >= ${quoteLiteral(zonedMidnight(s.start, clock.timeZone))}`)
      if (s.end !== null) {
        parts.push(`${column} < ${quoteLiteral(zonedMidnight(addDays(s.end, 1), clock.timeZone))}`)
      }
    }
    return `(${parts.join(' AND ')})`
  }
  if (kind === 'number') {
    const bounds = Array.isArray(given.value) ? given.value : [given.value]
    const low = bounds[0] === null || bounds[0] === undefined || bounds[0] === '' ? null : bounds[0]
    const high =
      bounds[1] === null || bounds[1] === undefined || bounds[1] === '' ? null : bounds[1]
    const op = given.operator ?? (high === null ? 'eq' : 'between')
    const lit = (v: string | number) => numberLiteral(v, variable.name)
    if (op === 'between' && low !== null && high !== null)
      return `(${column} BETWEEN ${lit(low)} AND ${lit(high)})`
    if (op === 'lte' || (op === 'between' && low === null && high !== null)) {
      return `(${column} <= ${lit((high ?? low) as string | number)})`
    }
    if (op === 'gte' || op === 'between') return `(${column} >= ${lit(low as string | number)})`
    return `(${column} = ${lit(low as string | number)})`
  }
  const values = scalars(given.value).map(String)
  if (given.type === 'text') {
    const pattern = `%${(values[0] ?? '').replace(/([\\%_])/g, '\\$1')}%`
    return `(${column}::text ILIKE ${quoteLiteral(pattern)} ESCAPE '\\')`
  }
  return `(${column}::text IN (${values.map(quoteLiteral).join(', ')}))`
}

/** A variable's value as a literal of the statement. */
function literal(variable: SqlVariable, given: Given, clock: Clock): string {
  switch (variable.type) {
    case 'filter':
      return condition(variable, given, clock)
    case 'number':
      return numberLiteral(scalars(given.value)[0] as string | number, variable.name)
    case 'date': {
      const s = span(given.value, clock, variable.name)
      return quoteLiteral((s.start ?? s.end) as string)
    }
    case 'text':
      // Several values — a category with several choices — read as a list: `IN ({{x}})`.
      return scalars(given.value)
        .map((v) => quoteLiteral(String(v)))
        .join(', ')
  }
}

/**
 * The statement with its variables written in. Pure: the kernel's tests read it.
 *
 * A variable without a value empties the `[[ … ]]` around it; outside of one, a `filter`
 * reads `TRUE`, a required variable is refused, any other reads `NULL`.
 */
export function renderSql(
  query: SqlQuery,
  values: ReadonlyMap<string, Given>,
  clock: Clock,
): string {
  const variables = new Map((query.variables ?? []).map((v) => [v.name, v]))
  for (const name of sqlVariableNames(query.sql)) {
    if (!variables.has(name)) variables.set(name, { name, label: name, type: 'text' })
  }
  const given = (name: string): Given | null => {
    const g = values.get(name)
    if (g !== undefined && present(g.value)) return g
    const fallback = variables.get(name)?.default
    return present(fallback) ? { value: fallback, type: null } : null
  }

  const optional = query.sql.replace(/\[\[([\s\S]*?)\]\]/g, (_, inner: string) =>
    sqlVariableNames(inner).every((name) => given(name) !== null) ? inner : '',
  )
  return optional.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, name: string) => {
    const variable = variables.get(name) as SqlVariable
    const value = given(name)
    if (value === null) {
      if (variable.required === true) throw invalid('variables', 'variable_requise', name)
      return variable.type === 'filter' ? 'TRUE' : 'NULL'
    }
    return literal(variable, value, clock)
  })
}

const NUMERIC_TYPES =
  /^(smallint|integer|bigint|numeric|real|double precision|money|int\d|float\d|decimal)/

/** What a PostgreSQL type reads as on screen. */
function typeOf(dataType: string): string {
  if (NUMERIC_TYPES.test(dataType)) return 'number'
  if (dataType === 'date') return 'date'
  if (dataType.startsWith('timestamp')) return 'datetime'
  if (dataType === 'boolean') return 'boolean'
  if (dataType === 'json' || dataType === 'jsonb') return 'json'
  return 'text'
}

export interface RunSqlQuestionRequest {
  readonly baseId: string
  readonly query: SqlQuery
  readonly constraints?: readonly Constraint[]
  readonly timeZone?: string
  readonly weekStart?: 0 | 1
}

export async function runSqlQuestion(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string | undefined,
  connectionString: string,
  request: RunSqlQuestionRequest,
): Promise<QueryResult> {
  const timeZone = validTimeZone(request.timeZone)
  const clock: Clock = {
    today: todayIn(timeZone),
    timeZone,
    weekStart: request.weekStart === 0 ? 0 : 1,
  }
  const values = new Map<string, Given>()
  for (const c of request.constraints ?? []) {
    if (!('variable' in c.target) || values.has(c.target.variable)) continue
    values.set(c.target.variable, {
      value: c.value,
      type: c.type,
      ...(c.operator === undefined ? {} : { operator: c.operator }),
    })
  }
  const sql = renderSql(request.query, values, clock)
  const result = await runReaderSql(pools, ctx, instanceKey, connectionString, {
    baseId: request.baseId,
    sql,
    limit: QUERY_LIMITS.rows,
  })

  // The reader keys each row by column name, a repeated name suffixed: the same keys, in
  // the same order, read the values back as a list.
  const probe: Record<string, unknown> = {}
  const keys = result.columns.map((column, i) => {
    const key = uniqueKey(probe, column.name, i)
    probe[key] = true
    return key
  })
  const columns: ResultColumn[] = result.columns.map((column) => {
    const type = typeOf(column.dataType)
    return {
      name: column.name,
      label: column.name,
      role: type === 'number' ? 'metric' : 'dimension',
      type,
    }
  })
  const rows = result.rows.map((row) =>
    columns.map((column, i) => {
      const value = row[keys[i] as string]
      if (value === null || value === undefined) return null
      if (value instanceof Date) return value.toISOString()
      if (column.type === 'number' && typeof value === 'string') {
        const n = Number(value)
        return Number.isFinite(n) ? n : value
      }
      return value
    }),
  )
  return { columns, rows, truncated: result.truncated, duration_ms: result.durationMs }
}
