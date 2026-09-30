import { qualify, quoteIdentifier } from '@basedb/naming'
import type { FieldKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { rowWhere } from '../rbac/rows.js'
import { withMe } from '../rbac/rows.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type FilterableColumn, buildFilter, resolveColumn } from './filter.js'
import { buildPlan, planLateral } from './list.js'

/**
 * Aggregates over a table — the summary bar of a grid and the counts of its groups
 * (chapter 11 §1.6, chapter 08 §4).
 *
 * Over EVERY row the filter keeps, not over the page on screen: a sum that changed as one
 * paged forward would be a sum of nothing in particular. The query is built from the same
 * plan as a page — the reader's mask, the row predicate, the filter — so an aggregate can
 * no more reach a masked column or a hidden row than a page can.
 *
 * Its cost is a scan of what the filter keeps, which is why nothing asks for it unless a
 * summary or a grouping is on screen; the data pool's statement timeout bounds the rest.
 */

export const AGGREGATES = [
  'filled',
  'empty',
  'unique',
  'sum',
  'avg',
  'min',
  'max',
  'checked',
] as const

export type Aggregate = (typeof AGGREGATES)[number]

/** Kinds a grid can be grouped by: one value per row, comparable. */
export const GROUPABLE: readonly FieldKind[] = [
  'short_text',
  'select',
  'boolean',
  'link',
  'date',
  'number',
  'url',
  'formula',
  'email',
  'user',
]

const MAX_AGGREGATES = 64
const MAX_GROUPS = 500

const ARRAYS = new Set<string>(['multi_select', 'multi_link', 'lookup'])
const DOCUMENTS = new Set<string>(['file', 'image'])
/** Text whose empty string means "nothing": `''` counts as empty, not as filled. */
const TEXTUAL = new Set<string>(['short_text', 'long_text', 'select', 'url', 'email'])

/** What a field of `kind` can be summarised by. */
export function aggregatesFor(kind: string): readonly Aggregate[] {
  if (kind === 'boolean') return ['checked', 'filled', 'empty']
  if (kind === 'number') return ['filled', 'empty', 'unique', 'sum', 'avg', 'min', 'max']
  if (kind === 'date' || kind === 'datetime') return ['filled', 'empty', 'min', 'max']
  if (kind === 'autonumber') return ['filled', 'empty', 'min', 'max']
  if (kind === 'long_text' || ARRAYS.has(kind) || DOCUMENTS.has(kind)) return ['filled', 'empty']
  return ['filled', 'empty', 'unique']
}

function filledCondition(column: FilterableColumn, sql: string): string {
  if (ARRAYS.has(column.kind)) return `cardinality(${sql}) > 0`
  if (DOCUMENTS.has(column.kind)) return `jsonb_array_length(${sql}) > 0`
  if (TEXTUAL.has(column.kind)) return `${sql} <> ''`
  return `${sql} IS NOT NULL`
}

function expressionOf(column: FilterableColumn, fn: Aggregate, sql: string): string {
  switch (fn) {
    case 'filled':
      return `count(*) FILTER (WHERE ${filledCondition(column, sql)})`
    case 'empty':
      return `count(*) FILTER (WHERE NOT coalesce(${filledCondition(column, sql)}, false))`
    case 'unique':
      return `count(DISTINCT ${sql})`
    case 'sum':
      return `sum(${sql})`
    case 'avg':
      return `avg(${sql})`
    case 'min':
      return `min(${sql})`
    case 'max':
      return `max(${sql})`
    case 'checked':
      return `count(*) FILTER (WHERE ${sql})`
  }
}

export interface AggregateRequest {
  readonly tableId: string
  readonly filter?: string
  /** `field:fn` pairs. */
  readonly aggregates: ReadonlyArray<{ readonly field: string; readonly fn: string }>
  /** Counts per value of this field, when a grid is grouped by it. */
  readonly groupBy?: string
}

export interface AggregateResult {
  /** Rows the filter keeps. */
  readonly total: number
  /** By `field:fn`. Counts are numbers; sums, averages and bounds as PostgreSQL gives them. */
  readonly values: Readonly<Record<string, string | number | null>>
  /** Rows per value of the grouping field, in its order, empty value first. */
  readonly groups: ReadonlyArray<{ readonly value: unknown; readonly count: number }> | null
  /** More distinct values than are listed. */
  readonly groupsCapped: boolean
}

function refuse(detail: string): never {
  throw new BasedbError('REQUEST_INVALID', {
    details: { field: 'aggregate', reason: 'agregat_invalide', detail },
  })
}

export async function aggregateRecords(
  pools: Pools,
  ctx: RequestContext,
  request: AggregateRequest,
): Promise<AggregateResult> {
  if (request.aggregates.length > MAX_AGGREGATES) refuse('trop_d_agregats')
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => buildPlan(exec, ctx, request.tableId),
    { readOnly: true },
  )

  const alias = 't'
  // A computed field is read from the lateral join (chapter 04 §7 ter.3).
  const column = (name: string) =>
    `${quoteIdentifier(plan.filterable.get(name)?.alias ?? alias)}.${quoteIdentifier(name)}`
  const lateral = planLateral(plan, alias)
  const relation = qualify(plan.schemaName, plan.tableName)

  // Named against the read mask, like a filter: a masked column is an unknown one. The
  // system columns are read by all (A18) — who created a row, and when, is summarised too.
  const selected = request.aggregates.map(({ field, fn }) => {
    const known = resolveColumn(field, plan.filterable)
    if (known === undefined) {
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field } })
    }
    if (!aggregatesFor(known.kind).includes(fn as Aggregate)) refuse(`${field}:${fn}`)
    return { key: `${field}:${fn}`, sql: expressionOf(known, fn as Aggregate, column(field)) }
  })

  let group: FilterableColumn | null = null
  if (request.groupBy !== undefined && request.groupBy !== '') {
    const known = resolveColumn(request.groupBy, plan.filterable)
    if (known === undefined) {
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: request.groupBy } })
    }
    if (!GROUPABLE.includes(known.kind)) refuse(`group:${request.groupBy}`)
    group = known
  }

  const params: unknown[] = []
  // The marker the data pool's statements must all carry (see `buildSelect`).
  const clauses = [
    `( /*predicat_lignes:${plan.tableName}*/ ${rowWhere(plan.decision.rowPredicate, alias)} )`,
  ]
  if (request.filter !== undefined && request.filter.trim() !== '') {
    const filter = buildFilter(withMe(request.filter, ctx.actor.id), plan.filterable, {
      alias,
      firstParameter: 1,
      links: plan.links,
    })
    params.push(...filter.params)
    clauses.push(`( ${filter.sql} )`)
  }
  const where = clauses.join('\n   AND ')

  const projection = [
    'count(*) AS "__total"',
    ...selected.map((s, i) => `${s.sql} AS "a${i}"`),
  ].join(', ')
  const totalsSql = `SELECT ${projection}
  FROM ${relation} AS ${quoteIdentifier(alias)}${lateral}
 WHERE ${where};`

  const groupSql =
    group === null
      ? null
      : `SELECT ${column(group.name)} AS value, count(*) AS n
  FROM ${relation} AS ${quoteIdentifier(alias)}${lateral}
 WHERE ${where}
 GROUP BY 1
 ORDER BY 1 NULLS FIRST
 LIMIT ${MAX_GROUPS + 1};`

  return pools.withConnection('data', async (exec) => {
    const [totals] = await exec.query<Record<string, unknown>>(totalsSql, params)
    const values: Record<string, string | number | null> = {}
    for (const [index, s] of selected.entries()) {
      const raw = totals?.[`a${index}`]
      // Counts come back as `bigint` text: numbers, since they always fit. Sums and
      // averages stay the decimal text PostgreSQL gives — rounding is the screen's.
      values[s.key] =
        raw === null || raw === undefined
          ? null
          : s.key.endsWith(':filled') ||
              s.key.endsWith(':empty') ||
              s.key.endsWith(':unique') ||
              s.key.endsWith(':checked')
            ? Number(raw)
            : raw instanceof Date
              ? raw.toISOString()
              : String(raw)
    }
    let groups: Array<{ value: unknown; count: number }> | null = null
    let groupsCapped = false
    if (groupSql !== null) {
      const rows = await exec.query<{ value: unknown; n: string }>(groupSql, params)
      groupsCapped = rows.length > MAX_GROUPS
      groups = rows.slice(0, MAX_GROUPS).map((r) => ({
        value: r.value instanceof Date ? r.value.toISOString() : r.value,
        count: Number(r.n),
      }))
    }
    return { total: Number(totals?.__total ?? 0), values, groups, groupsCapped }
  })
}
