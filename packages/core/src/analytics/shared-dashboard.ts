import {
  type BuilderQuery,
  type CardKind,
  type ColumnRef,
  type DashboardCard,
  type DashboardParameter,
  type DashboardTab,
  type ParameterValue,
  type QueryResult,
  type QuestionQuery,
  type Visualization,
  cardConstraints,
} from '@basedb/contracts'
import type { Dashboard } from '../catalog/dashboards.js'
import type { ProjectedBase, ProjectedTable } from '../catalog/projection.js'
import { BasedbError } from '../errors/index.js'
import { type SharedViewField, sharedField } from '../forms/shared-view.js'
import type { Executor } from '../runtime/pool.js'

/**
 * A shared dashboard as its page reads it — chapter 18 §2.5: its tabs, its filters, its
 * cards placed on the grid, and of the base only what the cards show — the fields they
 * cite, as the publisher reads them, to format the values. Never a query: a card is run
 * by its identifier, its filters tied by the kernel from the dashboard as it was built.
 */

export interface SharedDashboardCard {
  readonly id: string
  readonly tab: string | null
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly kind: CardKind
  readonly title: string
  readonly text?: string
  readonly url?: string
  readonly visualization?: Visualization
  /** The question sorts its rows itself: the chart keeps their order. */
  readonly sorted: boolean
  /** The filters tied to the card: the page reruns it when one of them changes. */
  readonly filters: readonly string[]
}

export interface SharedDashboardTable {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly fields: readonly SharedViewField[]
}

export interface SharedDashboardPage {
  readonly title: string
  readonly description: string | null
  readonly access: 'public' | 'members'
  readonly reader: string | null
  readonly canEmbed: boolean
  readonly tabs: readonly DashboardTab[]
  readonly parameters: readonly DashboardParameter[]
  readonly cards: readonly SharedDashboardCard[]
  readonly tables: readonly SharedDashboardTable[]
}

/** A saved question as a shared card needs it: what it runs, how it shows, its name. */
export interface SavedQuestion {
  readonly label: string
  readonly query: QuestionQuery
  readonly visualization: Visualization
}

/** What a card runs, and how it shows it — `null` when its saved question is gone. */
export function cardQuestion(
  card: DashboardCard,
  questions: ReadonlyMap<string, SavedQuestion>,
): SavedQuestion | null {
  if (card.question !== undefined) {
    const saved = questions.get(card.question)
    if (saved === undefined) return null
    return { ...saved, visualization: card.visualization ?? saved.visualization }
  }
  if (card.query === undefined) return null
  return { label: '', query: card.query, visualization: card.visualization ?? { type: 'table' } }
}

/** The cards the page draws, without what they run. */
export function sharedCards(
  dashboard: Dashboard,
  questions: ReadonlyMap<string, SavedQuestion>,
): SharedDashboardCard[] {
  return dashboard.cards.map((card) => {
    const question = card.kind === 'question' ? cardQuestion(card, questions) : null
    const title = card.title?.trim() || question?.label || ''
    return {
      id: card.id,
      tab: card.tab,
      x: card.x,
      y: card.y,
      w: card.w,
      h: card.h,
      kind: card.kind,
      title,
      ...(card.text === undefined ? {} : { text: card.text }),
      ...(card.url === undefined ? {} : { url: card.url }),
      ...(question === null ? {} : { visualization: question.visualization }),
      sorted:
        question !== null &&
        (question.query.kind === 'sql' || (question.query.sort ?? []).length > 0),
      filters: [...new Set((card.mappings ?? []).map((m) => m.parameter))],
    }
  })
}

/**
 * The fields the builder questions cite, per table: those they group by, aggregate, show.
 * A question that shows rows without choosing its columns shows every one it reads.
 */
function citedFields(queries: readonly BuilderQuery[]): Map<string, Set<string> | 'all'> {
  const out = new Map<string, Set<string> | 'all'>()
  for (const query of queries) {
    const tableOf = new Map<string, string>([
      ['', query.source],
      ...(query.joins ?? []).map((j): [string, string] => [j.alias, j.table]),
    ])
    const raw = (query.aggregations ?? []).length === 0 && (query.breakouts ?? []).length === 0
    if (raw && (query.fields ?? []).length === 0) {
      for (const table of tableOf.values()) out.set(table, 'all')
      continue
    }
    const cite = (ref: ColumnRef | undefined) => {
      if (ref === undefined) return
      const table = tableOf.get(ref.join ?? '')
      if (table === undefined) return
      const current = out.get(table)
      if (current === 'all') return
      const set = current ?? new Set<string>()
      set.add(ref.field)
      out.set(table, set)
    }
    for (const b of query.breakouts ?? []) cite(b)
    for (const a of query.aggregations ?? []) cite(a.column)
    for (const f of query.fields ?? []) cite(f)
    for (const j of query.joins ?? []) cite(j.left)
  }
  return out
}

/** Of the base, what the cards show: their tables, cut to the fields they cite. */
export function sharedTables(
  base: ProjectedBase,
  queries: readonly QuestionQuery[],
): SharedDashboardTable[] {
  const cited = citedFields(queries.filter((q): q is BuilderQuery => q.kind === 'builder'))
  const out: SharedDashboardTable[] = []
  const find = (reference: string): ProjectedTable | undefined =>
    base.tables.find((t) => t.id === reference || t.name === reference)
  const merged = new Map<string, { table: ProjectedTable; fields: Set<string> | 'all' }>()
  for (const [reference, fields] of cited) {
    const table = find(reference)
    if (table === undefined) continue
    const current = merged.get(table.id)
    if (current === undefined || fields === 'all') {
      merged.set(table.id, { table, fields })
    } else if (current.fields !== 'all') {
      for (const f of fields) current.fields.add(f)
    }
  }
  for (const { table, fields } of merged.values()) {
    out.push({
      id: table.id,
      name: table.name,
      label: table.label,
      fields: table.fields
        .filter((f) => (fields === 'all' ? !f.system : fields.has(f.name)))
        .map(sharedField),
    })
  }
  return out
}

/**
 * The values a visitor gives the filters, checked: known filters only, of a value's
 * shape. A filter left out keeps its default; `null` clears it.
 */
export function visitorValues(
  parameters: readonly DashboardParameter[],
  raw: unknown,
): Record<string, ParameterValue | null> {
  if (raw !== undefined && (typeof raw !== 'object' || raw === null || Array.isArray(raw))) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'values' } })
  }
  const given = (raw ?? {}) as Record<string, unknown>
  const out: Record<string, ParameterValue | null> = {}
  for (const parameter of parameters) {
    if (!Object.hasOwn(given, parameter.id)) {
      out[parameter.id] = parameter.default ?? null
      continue
    }
    const value = given[parameter.id]
    if (value === null || typeof value === 'string') {
      out[parameter.id] = value === null ? null : value.slice(0, 500)
    } else if (
      Array.isArray(value) &&
      value.length <= 100 &&
      (value.every((v) => typeof v === 'string') ||
        value.every((v) => v === null || (typeof v === 'number' && Number.isFinite(v))))
    ) {
      out[parameter.id] = value as ParameterValue
    } else {
      throw new BasedbError('REQUEST_INVALID', { details: { field: `values.${parameter.id}` } })
    }
  }
  const unknown = Object.keys(given).find((key) => !parameters.some((p) => p.id === key))
  if (unknown !== undefined) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: `values.${unknown}` } })
  }
  return out
}

/** What a card runs for a visitor: its question, and its filters tied by the kernel. */
export function sharedRun(
  dashboard: Dashboard,
  cardId: string,
  questions: ReadonlyMap<string, SavedQuestion>,
  rawValues: unknown,
) {
  const card = dashboard.cards.find((c) => c.id === cardId && c.kind === 'question')
  if (card === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { card: cardId } })
  const question = cardQuestion(card, questions)
  if (question === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { question: card.question ?? null } })
  }
  const values = visitorValues(dashboard.parameters, rawValues)
  return {
    query: question.query,
    constraints: cardConstraints(card.mappings, dashboard.parameters, values),
  }
}

/**
 * Where a category filter takes its values from: the first builder card it is tied to by
 * a column — the values of that column, the most frequent first.
 */
export function valuesQuery(
  dashboard: Dashboard,
  parameterId: string,
  questions: ReadonlyMap<string, SavedQuestion>,
): BuilderQuery | null {
  const parameter = dashboard.parameters.find((p) => p.id === parameterId)
  if (parameter === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { parameter: parameterId } })
  }
  if (parameter.type !== 'category') return null
  for (const card of dashboard.cards) {
    const mapping = (card.mappings ?? []).find(
      (m) => m.parameter === parameterId && 'column' in m.target,
    )
    if (mapping === undefined || !('column' in mapping.target)) continue
    const question = cardQuestion(card, questions)
    if (question === null || question.query.kind !== 'builder') continue
    const column = mapping.target.column
    return {
      kind: 'builder',
      source: question.query.source,
      ...(question.query.joins === undefined ? {} : { joins: question.query.joins }),
      breakouts: [
        { ...(column.join === undefined ? {} : { join: column.join }), field: column.field },
      ],
      aggregations: [{ fn: 'count' }],
      sort: [{ target: { kind: 'aggregation', index: 0 }, desc: true }],
      limit: 300,
    }
  }
  return null
}

export interface ValueChoice {
  readonly value: string
  readonly label: string
  readonly color: string | null
}

/** The values of a filter, as its list offers them: labelled, never empty. */
export function choicesOf(result: QueryResult, base: ProjectedBase): ValueChoice[] {
  const column = result.columns[0]
  if (column === undefined) return []
  const field =
    column.source === undefined
      ? undefined
      : base.tables
          .find((t) => t.id === column.source?.table)
          ?.fields.find((f) => f.name === column.source?.field)
  const out: ValueChoice[] = []
  const seen = new Set<string>()
  for (const row of result.rows) {
    for (const raw of Array.isArray(row[0]) ? (row[0] as unknown[]) : [row[0]]) {
      if (raw === null || raw === undefined || raw === '') continue
      const value = String(raw)
      if (seen.has(value)) continue
      seen.add(value)
      const option = field?.options?.find((o) => o.value === value)
      const label =
        option?.label ??
        column.labels?.[value] ??
        (column.type === 'boolean' ? (value === 'true' ? 'Oui' : 'Non') : value)
      out.push({ value, label, color: option?.color ?? null })
    }
  }
  return out
}

/**
 * The people a result names, by their name alone: a visitor has no list of the tenant's
 * members to read them in. Each person column gets the labels of the identifiers it holds.
 */
export async function withPeopleNames(
  exec: Executor,
  tenantRef: string,
  result: QueryResult,
): Promise<QueryResult> {
  const people = result.columns
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.type === 'user' && c.hidden !== true)
  if (people.length === 0) return result
  const ids = new Set<string>()
  for (const row of result.rows) {
    for (const { i } of people) {
      for (const v of Array.isArray(row[i]) ? (row[i] as unknown[]) : [row[i]]) {
        if (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)) ids.add(v)
      }
    }
  }
  if (ids.size === 0) return result
  const found = await exec.query<{ id: string; name: string | null }>(
    `SELECT u.id::text, NULLIF(u.display_name, '') AS name
       FROM _basedb.app_user u
       JOIN _basedb.tenant t ON t.id = u.tenant_id
      WHERE t.ref = $1 AND u.id = ANY($2::uuid[])`,
    [tenantRef, [...ids]],
  )
  const names: Record<string, string> = {}
  for (const r of found) names[r.id] = r.name ?? 'Personne sans nom'
  return {
    ...result,
    columns: result.columns.map((c) =>
      c.type === 'user' && c.hidden !== true
        ? { ...c, labels: { ...(c.labels ?? {}), ...names } }
        : c,
    ),
  }
}

/** A result as a visitor receives it: without the columns kept to open a row. */
export function forVisitor(result: QueryResult): QueryResult {
  const kept = result.columns.map((c, i) => ({ c, i })).filter(({ c }) => c.hidden !== true)
  if (kept.length === result.columns.length && result.record === undefined) return result
  const { record: _record, ...rest } = result
  return {
    ...rest,
    columns: kept.map(({ c }) => c),
    rows: result.rows.map((row) => kept.map(({ i }) => row[i])),
  }
}
