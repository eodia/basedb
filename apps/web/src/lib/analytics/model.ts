import type { DescribedBase, Field, Table } from '@/lib/api/client'
import { effectiveKind } from '@/lib/computed'
import { $t, $tp, dayLabel, monthLabel, msg } from '@/lib/i18n'
import {
  type Aggregation,
  type AggregationFn,
  type Breakout,
  type BuilderQuery,
  COLUMNLESS_FNS,
  type ColumnRef,
  type Filter,
  type FilterOp,
  type Join,
  type JoinKind,
  QUERY_LIMITS,
  type QueryResult,
  type QuestionQuery,
  type ResultColumn,
  type TemporalTruncation,
  type TemporalUnit,
  type VisualizationType,
  columnName,
  finerUnit,
  periodExpression,
  resolveDateExpression,
  sameColumnRef,
} from '@basedb/contracts'

/**
 * What the builder of questions works with — chapter 18 §3, on screen: the columns a query
 * can cite, what each kind can be filtered, grouped and summed by, the words for all of it,
 * the chart a result reads best as, and where a click on a point leads. Pure, to be tested.
 */

// ── The columns of a query ──────────────────────────────────────────────────

export interface ColumnOption {
  readonly ref: ColumnRef
  readonly field: Field
  /** What its values are: a computed field's result, `user` for who wrote a row. */
  readonly kind: string
  readonly table: Table
  /**
   * The join it comes through; absent for the source table. For a column of a related table
   * not yet joined, the join choosing it adds (`reached`).
   */
  readonly join?: Join
  /** The title it is listed under: its table's label. */
  readonly group: string
  /** How a chip names it: the field, prefixed by its table when it comes from a join. */
  readonly label: string
  /** The link field of the source it is reached through, for a column of a related table. */
  readonly via?: Field
  /** Offered by a relation of the source, and not in the query yet: choosing it joins. */
  readonly reached?: boolean
}

export const tableOf = (base: DescribedBase, key: string): Table | undefined =>
  base.tables.find((t) => t.id === key || t.name === key)

/** The kind a column reads as — the kernel's rule (`analytics/query.ts`). */
export function kindOf(field: Field): string {
  if (field.name === '_id') return 'id'
  if (field.name === '_created_by' || field.name === '_updated_by') return 'user'
  if (field.name === '_created_at' || field.name === '_updated_at') return 'datetime'
  return effectiveKind(field)
}

/** What the five system columns are called, whatever the catalog labels them. */
const SYSTEM_LABELS: Readonly<Record<string, string>> = {
  _id: $t('Identifiant'),
  _created_at: $t('Créé le'),
  _updated_at: $t('Modifié le'),
  _created_by: $t('Créé par'),
  _updated_by: $t('Modifié par'),
}

/** The columns of one table of a query, as options: its fields, then the system columns. */
function tableColumns(
  table: Table,
  join: Join | undefined,
  via: Field | undefined,
  reached: boolean,
): ColumnOption[] {
  const out: ColumnOption[] = []
  const fields = [
    ...table.fields.filter((f) => f.system !== true),
    ...table.fields.filter((f) => f.system === true),
  ]
  for (const raw of fields) {
    if (raw.kind === 'button') continue
    const own = SYSTEM_LABELS[raw.name]
    const field =
      own !== undefined && (raw.label === '' || raw.label === raw.name)
        ? { ...raw, label: own }
        : raw
    out.push({
      ref: join === undefined ? { field: field.name } : { join: join.alias, field: field.name },
      field,
      kind: kindOf(field),
      table,
      ...(join === undefined ? {} : { join }),
      group:
        join === undefined
          ? table.label
          : via === undefined
            ? `${table.label} (jointure)`
            : $t('{label} (par {label2})', { label: table.label, label2: via.label }),
      // Through a relation, the column is named by it — « Client → Nom » — for two relations
      // to one table must not read the same.
      label:
        join === undefined
          ? field.label
          : `${via === undefined ? table.label : via.label} → ${field.label}`,
      ...(via === undefined ? {} : { via }),
      ...(reached ? { reached: true } : {}),
    })
  }
  return out
}

/** The link field of the source an implicit join goes through. */
function viaOf(source: Table | undefined, join: Join): Field | undefined {
  if (join.implicit !== true || join.left.join !== undefined) return undefined
  return source?.fields.find((f) => f.name === join.left.field)
}

/**
 * Every column the query cites already: its source's fields, then each join's. A column of
 * a related table, not joined yet, is not here — `reachableColumns` has it.
 */
export function columnsOf(base: DescribedBase, query: BuilderQuery): ColumnOption[] {
  const source = tableOf(base, query.source)
  const out = source === undefined ? [] : tableColumns(source, undefined, undefined, false)
  for (const join of query.joins ?? []) {
    const table = tableOf(base, join.table)
    if (table !== undefined) out.push(...tableColumns(table, join, viaOf(source, join), false))
  }
  return out
}

export const findColumn = (columns: readonly ColumnOption[], ref: ColumnRef) =>
  columns.find((c) => sameColumnRef(c.ref, ref))

// ── Relations ───────────────────────────────────────────────────────────────

/** A link of a table to another one of the base. */
export interface Relation {
  readonly field: Field
  readonly target: Table
}

/** The tables a table links to: each `link` and `multi_link` field whose target is in the base. */
export function relationsOf(base: DescribedBase, table: Table): Relation[] {
  const out: Relation[] = []
  for (const field of table.fields) {
    if ((field.kind !== 'link' && field.kind !== 'multi_link') || field.link?.target === undefined)
      continue
    const target = base.tables.find((t) => t.name === field.link?.target)
    if (target !== undefined) out.push({ field, target })
  }
  return out
}

const sameTable = (base: DescribedBase, key: string, table: Table) =>
  tableOf(base, key)?.id === table.id

/** The alias a relation's join takes: its link field's name, which is stable. */
function relationStem(field: Field): string {
  const stem = field.name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^[^a-z]+/, '')
    .slice(0, 24)
  return stem === '' ? 'lien' : stem
}

/** A free alias, numbered past the first. */
function freeAlias(stem: string, taken: ReadonlySet<string>): string {
  if (!taken.has(stem)) return stem
  for (let i = 2; ; i++) if (!taken.has(`${stem}${i}`)) return `${stem}${i}`
}

/**
 * Whether a join of the query is the one a relation of the source makes: the same table,
 * reached by the same link, on the target's identifier. A join the person wrote on the same
 * terms is that join: its columns are not offered a second time.
 */
function joinsRelation(base: DescribedBase, join: Join, relation: Relation): boolean {
  return (
    join.left.join === undefined &&
    join.left.field === relation.field.name &&
    join.right === '_id' &&
    sameTable(base, join.table, relation.target)
  )
}

/**
 * Every column the query can cite: those it cites already, and those of the tables the source
 * links to — a link is a relation, and a column of what it points to is one choosing adds the
 * join for (`implicit`), no join step to write first. Past the bound of joins, only the first.
 */
export function reachableColumns(base: DescribedBase, query: BuilderQuery): ColumnOption[] {
  const out = columnsOf(base, query)
  const source = tableOf(base, query.source)
  const joins = query.joins ?? []
  if (source === undefined || joins.length >= QUERY_LIMITS.joins) return out
  const taken = new Set(joins.map((j) => j.alias))
  for (const relation of relationsOf(base, source)) {
    if (joins.some((j) => joinsRelation(base, j, relation))) continue
    const alias = freeAlias(relationStem(relation.field), taken)
    taken.add(alias)
    const join: Join = {
      alias,
      table: relation.target.id,
      kind: 'left',
      left: { field: relation.field.name },
      right: '_id',
      implicit: true,
    }
    out.push(...tableColumns(relation.target, join, relation.field, true))
  }
  return out
}

/** The query with the join a column needs, when it comes from a relation not joined yet. */
export function withJoinFor(query: BuilderQuery, column: ColumnOption | undefined): BuilderQuery {
  if (column?.join === undefined || column.reached !== true) return query
  const alias = column.join.alias
  if ((query.joins ?? []).some((j) => j.alias === alias)) return query
  return { ...query, joins: [...(query.joins ?? []), column.join] }
}

/** The query without its empty lists and its missing bound: a step taken away leaves no trace. */
export function compactQuery(query: BuilderQuery): BuilderQuery {
  const kept = Object.entries(query).filter(
    ([, value]) =>
      value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0),
  )
  return Object.fromEntries(kept) as unknown as BuilderQuery
}

/**
 * The query without the joins it added on its own that no step cites any more. A join the
 * person wrote stays, and so does every join an enduring join starts from.
 */
export function pruneJoins(query: BuilderQuery): BuilderQuery {
  const joins = query.joins ?? []
  if (!joins.some((j) => j.implicit === true)) return query
  const used = new Set<string>()
  const cite = (ref: ColumnRef | undefined) => {
    if (ref?.join !== undefined) used.add(ref.join)
  }
  for (const f of query.filters ?? []) {
    if ('column' in f) cite(f.column)
    else if (f.join !== undefined) used.add(f.join)
  }
  for (const a of query.aggregations ?? []) cite(a.column)
  for (const b of query.breakouts ?? []) cite(b)
  for (const f of query.fields ?? []) cite(f)
  for (const s of query.sort ?? []) if (s.target.kind === 'column') cite(s.target.column)
  const stays = (j: Join) => j.implicit !== true || used.has(j.alias)
  // A join that stays keeps the joins its condition starts from.
  for (let size = -1; size !== used.size; ) {
    size = used.size
    for (const j of joins) if (stays(j)) cite(j.left)
  }
  const kept = joins.filter(stays)
  if (kept.length === joins.length) return query
  const { joins: _joins, ...rest } = query
  return kept.length === 0 ? rest : { ...rest, joins: kept }
}

/**
 * The query without a join and everything that cites it: the joins that start from it, the
 * filters, the aggregates, the groupings, the columns and the sorts on its columns. A sort on
 * an aggregate or a grouping goes with the first it counts by rank.
 */
export function withoutJoin(query: BuilderQuery, alias: string): BuilderQuery {
  const gone = new Set([alias])
  const joins = query.joins ?? []
  // The joins that start from a join going go too, however far down.
  for (let size = -1; size !== gone.size; ) {
    size = gone.size
    for (const j of joins) if (j.left.join !== undefined && gone.has(j.left.join)) gone.add(j.alias)
  }
  const cites = (ref: ColumnRef | undefined) => ref?.join !== undefined && gone.has(ref.join)
  const aggregations = (query.aggregations ?? []).filter((a) => !cites(a.column))
  const breakouts = (query.breakouts ?? []).filter((b) => !cites(b))
  const sort = (query.sort ?? []).filter(
    (s) =>
      (s.target.kind !== 'column' || !cites(s.target.column)) &&
      (s.target.kind !== 'aggregation' ||
        aggregations.length === (query.aggregations ?? []).length) &&
      (s.target.kind !== 'breakout' || breakouts.length === (query.breakouts ?? []).length),
  )
  const filters = (query.filters ?? []).filter((f) =>
    'column' in f ? !cites(f.column) : f.join === undefined || !gone.has(f.join),
  )
  const fields = (query.fields ?? []).filter((f) => !cites(f))
  const {
    joins: _joins,
    filters: _filters,
    aggregations: _aggregations,
    breakouts: _breakouts,
    fields: _fields,
    sort: _sort,
    ...rest
  } = query
  const kept = joins.filter((j) => !gone.has(j.alias))
  return {
    ...rest,
    ...(kept.length === 0 ? {} : { joins: kept }),
    ...(filters.length === 0 ? {} : { filters }),
    ...(aggregations.length === 0 ? {} : { aggregations }),
    ...(breakouts.length === 0 ? {} : { breakouts }),
    ...(fields.length === 0 ? {} : { fields }),
    ...(sort.length === 0 ? {} : { sort }),
  }
}

const sameRefs = (a: readonly ColumnRef[], b: readonly ColumnRef[]) =>
  a.length === b.length && a.every((ref) => b.some((other) => sameColumnRef(ref, other)))

/**
 * The columns a question that only lists rows reads when it chooses none: the source's and
 * those of the joins written by hand, the system columns left out — what the kernel reads
 * for a question without `fields` — but not a related table's, which a column of it chosen
 * brings along.
 */
export function defaultFields(base: DescribedBase, query: BuilderQuery): ColumnRef[] {
  const written = (query.joins ?? []).filter((j) => j.implicit !== true)
  return columnsOf(base, { ...query, joins: written })
    .filter((c) => c.field.system !== true)
    .map((c) => c.ref)
}

/** The columns a question reads row by row: those chosen, or by default all. */
export const chosenFields = (base: DescribedBase, query: BuilderQuery): readonly ColumnRef[] =>
  query.fields !== undefined && query.fields.length > 0 ? query.fields : defaultFields(base, query)

/**
 * The query as the editor keeps it after a change: the joins no step cites any more gone,
 * and the columns of a question that lists rows fixed when a join was added on its own —
 * without them the kernel would read every column of the table joined —, then freed again
 * when they are back to the default.
 */
export function settleQuery(base: DescribedBase, query: BuilderQuery): BuilderQuery {
  const pruned = pruneJoins(query)
  const listing = (pruned.aggregations ?? []).length === 0 && (pruned.breakouts ?? []).length === 0
  if (!listing) return pruned
  const related = (pruned.joins ?? []).some((j) => j.implicit === true)
  const defaults = defaultFields(base, pruned)
  if (related && pruned.fields === undefined) return { ...pruned, fields: defaults }
  if (!related && pruned.fields !== undefined && sameRefs(pruned.fields, defaults)) {
    const { fields: _fields, ...rest } = pruned
    return rest
  }
  return pruned
}

// ── What each kind offers ───────────────────────────────────────────────────

const NUMERIC = new Set(['number', 'rollup', 'count', 'autonumber'])
const DATES = new Set(['date', 'datetime'])
const TEXTS = new Set(['short_text', 'email', 'url'])
const LISTS = new Set(['multi_select', 'multi_link', 'lookup'])
const DOCUMENTS = new Set(['file', 'image', 'button'])

export const isNumeric = (kind: string) => NUMERIC.has(kind)
export const isTemporal = (kind: string) => DATES.has(kind)

/** The aggregates a column can be summarised by; `count` needs none. */
export function aggregationsFor(kind: string): AggregationFn[] {
  if (NUMERIC.has(kind))
    return ['sum', 'avg', 'median', 'min', 'max', 'distinct', 'stddev', 'cum_sum']
  if (DATES.has(kind)) return ['min', 'max', 'distinct']
  if (kind === 'long_text' || LISTS.has(kind) || DOCUMENTS.has(kind)) return []
  return ['distinct']
}

export const groupable = (kind: string) => !DOCUMENTS.has(kind) && kind !== 'long_text'

/** The filters a column offers, in the order the menu lists them. */
export function filterOpsFor(kind: string): FilterOp[] {
  if (NUMERIC.has(kind))
    return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not_empty']
  if (DATES.has(kind)) return ['date', 'before', 'after', 'between', 'empty', 'not_empty']
  if (TEXTS.has(kind))
    return [
      'is',
      'is_not',
      'contains',
      'not_contains',
      'starts_with',
      'ends_with',
      'empty',
      'not_empty',
    ]
  switch (kind) {
    case 'long_text':
      return ['contains', 'not_contains', 'empty', 'not_empty']
    case 'select':
    case 'user':
    case 'link':
      return ['is', 'is_not', 'empty', 'not_empty']
    case 'multi_select':
    case 'multi_link':
    case 'lookup':
      return ['has_any', 'has_all', 'has_none', 'empty']
    case 'boolean':
      return ['true', 'false', 'empty']
    case 'formula':
      return ['is', 'is_not', 'gt', 'lt', 'empty']
    case 'id':
      return ['is']
    default:
      return ['empty', 'not_empty']
  }
}

/** Filters that take no value. */
export const VALUELESS: ReadonlySet<FilterOp> = new Set(['empty', 'not_empty', 'true', 'false'])

// ── Words ───────────────────────────────────────────────────────────────────

export const FN_LABELS: Readonly<Record<AggregationFn, string>> = {
  count: $t('Nombre de lignes'),
  cum_count: $t('Nombre cumulé de lignes'),
  distinct: $t('Valeurs distinctes'),
  sum: $t('Somme'),
  cum_sum: $t('Somme cumulée'),
  avg: $t('Moyenne'),
  median: $t('Médiane'),
  min: $t('Minimum'),
  max: $t('Maximum'),
  stddev: $t('Écart type'),
}

export const OP_LABELS: Readonly<Record<FilterOp, string>> = {
  is: $t('est||opérateur de filtre'),
  is_not: $t('n’est pas'),
  contains: $t('contient||opérateur de filtre'),
  not_contains: $t('ne contient pas'),
  starts_with: $t('commence par'),
  ends_with: $t('finit par'),
  eq: '=',
  ne: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: $t('entre||opérateur de filtre'),
  date: $t('période'),
  before: $t('avant le'),
  after: $t('après le'),
  true: $t('est vrai'),
  false: $t('est faux'),
  has_any: $t('contient l’un de'),
  has_all: $t('contient tous'),
  has_none: $t('ne contient aucun de'),
  empty: $t('est vide'),
  not_empty: $t('n’est pas vide'),
}

export const UNIT_LABELS: Readonly<Record<TemporalUnit, string>> = {
  minute: $t('minute||unité de temps'),
  hour: $t('heure||unité de temps'),
  day: $t('jour||unité de temps'),
  week: $t('semaine||unité de temps'),
  month: $t('mois||unité de temps'),
  quarter: $t('trimestre||unité de temps'),
  year: $t('année'),
  hour_of_day: $t('heure du jour'),
  day_of_week: $t('jour de la semaine'),
  day_of_month: $t('jour du mois'),
  week_of_year: $t('semaine de l’année'),
  month_of_year: $t('mois de l’année'),
  quarter_of_year: $t('trimestre de l’année'),
}

/** The periods a date is grouped by, as the menu offers them. */
export const UNIT_GROUPS: ReadonlyArray<{
  readonly label: string
  readonly units: readonly TemporalUnit[]
}> = [
  { label: $t('Période'), units: ['day', 'week', 'month', 'quarter', 'year'] },
  { label: $t('Plus fin'), units: ['hour', 'minute'] },
  {
    label: $t('Rang'),
    units: [
      'day_of_week',
      'month_of_year',
      'quarter_of_year',
      'day_of_month',
      'hour_of_day',
      'week_of_year',
    ],
  },
]

export const PERIOD_UNITS: readonly TemporalTruncation[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
]

export const VIZ_LABELS: Readonly<Record<VisualizationType, string>> = {
  table: $t('Tableau'),
  scalar: $t('Chiffre'),
  trend: $t('Tendance'),
  progress: $t('Progression'),
  gauge: $t('Jauge'),
  bar: $t('Histogramme'),
  row: $t('Barres'),
  line: $t('Courbe'),
  area: $t('Aires'),
  combo: $t('Combiné'),
  pie: $t('Secteurs'),
  scatter: $t('Nuage de points'),
  funnel: $t('Entonnoir'),
  pivot: $t('Tableau croisé'),
  map: $t('Carte'),
}

/** Relative periods offered first, as a filter of dates reads them. */
export const DATE_PRESETS: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: 'today', label: $t('Aujourd’hui') },
  { value: 'yesterday', label: $t('Hier') },
  { value: 'past7days', label: $t('7 derniers jours') },
  { value: 'past30days', label: $t('30 derniers jours') },
  { value: 'thisweek', label: $t('Cette semaine') },
  { value: 'lastweek', label: $t('La semaine dernière') },
  { value: 'thismonth', label: $t('Ce mois-ci') },
  { value: 'lastmonth', label: $t('Le mois dernier') },
  { value: 'past3months', label: $t('3 derniers mois') },
  { value: 'past12months', label: $t('12 derniers mois') },
  { value: 'thisquarter', label: $t('Ce trimestre') },
  { value: 'lastquarter', label: $t('Le trimestre dernier') },
  { value: 'thisyear', label: $t('Cette année') },
  { value: 'lastyear', label: $t('L’année dernière') },
]

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** « 3 derniers mois », « Les 2 semaines précédentes » — each language its own plurals. */
function relativeLabel(direction: string, unit: string, n: number): string {
  switch (`${direction}:${unit}`) {
    case 'past:day':
      return $tp(n, '{count} dernier jour', '{count} derniers jours')
    case 'past:week':
      return $tp(n, '{count} dernière semaine', '{count} dernières semaines')
    case 'past:month':
      return $tp(n, '{count} dernier mois', '{count} derniers mois')
    case 'past:quarter':
      return $tp(n, '{count} dernier trimestre', '{count} derniers trimestres')
    case 'past:year':
      return $tp(n, '{count} dernière année', '{count} dernières années')
    case 'last:day':
      return $tp(n, 'Le jour précédent', 'Les {count} jours précédents')
    case 'last:week':
      return $tp(n, 'La semaine précédente', 'Les {count} semaines précédentes')
    case 'last:month':
      return $tp(n, 'Le mois précédent', 'Les {count} mois précédents')
    case 'last:quarter':
      return $tp(n, 'Le trimestre précédent', 'Les {count} trimestres précédents')
    case 'last:year':
      return $tp(n, 'L’année précédente', 'Les {count} années précédentes')
    case 'next:day':
      return $tp(n, 'Le jour suivant', 'Les {count} prochains jours')
    case 'next:week':
      return $tp(n, 'La semaine suivante', 'Les {count} prochaines semaines')
    case 'next:month':
      return $tp(n, 'Le mois suivant', 'Les {count} prochains mois')
    case 'next:quarter':
      return $tp(n, 'Le trimestre suivant', 'Les {count} prochains trimestres')
    default:
      return $tp(n, 'L’année suivante', 'Les {count} prochaines années')
  }
}

/** One period, said as French says it rather than « 1 dernier mois ». */
const SINGLE: Readonly<Record<string, string>> = {
  pastday: $t('Aujourd’hui'),
  pastweek: $t('Cette semaine'),
  pastmonth: $t('Ce mois-ci'),
  pastquarter: $t('Ce trimestre'),
  pastyear: $t('Cette année'),
  lastday: $t('Hier'),
  lastweek: $t('La semaine dernière'),
  lastmonth: $t('Le mois dernier'),
  lastquarter: $t('Le trimestre dernier'),
  lastyear: $t('L’année dernière'),
  nextday: $t('Demain'),
  nextweek: $t('La semaine prochaine'),
  nextmonth: $t('Le mois prochain'),
  nextquarter: $t('Le trimestre prochain'),
  nextyear: $t('L’année prochaine'),
}

/** A date expression as a person reads it: « 30 derniers jours », « 1 janv. 2026 – 31 mars 2026 ». */
export function describeDate(expression: string): string {
  const preset = DATE_PRESETS.find((p) => p.value === expression)
  if (preset !== undefined) return preset.label
  const relative = /^(past|last|next)(\d{0,4})(day|week|month|quarter|year)s?$/.exec(expression)
  if (relative !== null) {
    const [, direction, count, unit = 'day'] = relative
    const n = count === '' ? 1 : Number(count)
    if (n === 1) {
      const single = SINGLE[`${direction}${unit}`]
      if (single !== undefined) return single
    }
    return relativeLabel(direction ?? 'past', unit, n)
  }
  if (expression.includes('~')) {
    const [from = '', to = ''] = expression.split('~')
    if (from === '') return $t('Jusqu’au {to}', { to: describeDate(to) })
    if (to === '') return $t('Depuis le {from}', { from: describeDate(from) })
    return `${describeDate(from)} – ${describeDate(to)}`
  }
  if (DAY.test(expression)) return dayLabel(expression)
  const month = /^(\d{4})-(\d{2})$/.exec(expression)
  if (month !== null) return monthLabel(Number(month[1]), Number(month[2]))
  const quarter = /^(\d{4})-[Qq]([1-4])$/.exec(expression)
  if (quarter !== null) return $t('T{quarter} {year}', { quarter: quarter[2], year: quarter[1] })
  return expression
}

/** Whether a date expression reads as a period, from the reader's today. */
export const validDate = (expression: string) =>
  resolveDateExpression(expression, new Date().toISOString().slice(0, 10)) !== null

export function describeAggregation(a: Aggregation, columns: readonly ColumnOption[]): string {
  if (a.label !== undefined) return a.label
  if (a.column === undefined || COLUMNLESS_FNS.has(a.fn)) return FN_LABELS[a.fn]
  const column = findColumn(columns, a.column)
  return $t('{fnLabels} de {value}', {
    fnLabels: FN_LABELS[a.fn],
    value: column?.label ?? columnName(a.column),
  })
}

export function describeBreakout(b: Breakout, columns: readonly ColumnOption[]): string {
  const column = findColumn(columns, b)
  const label = column?.label ?? columnName(b)
  if (b.unit !== undefined) return `${label} : ${UNIT_LABELS[b.unit]}`
  if (b.bin !== undefined)
    return `${label} : ${b.bin === 'auto' ? $t('tranches') : $t('tranches de {bin}', { bin: b.bin })}`
  return label
}

/** What a filter says, for its chip: « Statut est Fait, En cours ». */
export function describeFilter(
  filter: Filter,
  columns: readonly ColumnOption[],
  valueLabel: (column: ColumnOption | undefined, value: unknown) => string = (_, v) => String(v),
): string {
  if ('expression' in filter) return filter.expression
  const column = findColumn(columns, filter.column)
  const name = column?.label ?? columnName(filter.column)
  const values = filter.values.map((v) => valueLabel(column, v))
  switch (filter.op) {
    case 'empty':
    case 'not_empty':
    case 'true':
    case 'false':
      return `${name} ${OP_LABELS[filter.op]}`
    case 'date':
      return `${name} : ${describeDate(String(filter.values[0] ?? ''))}`
    case 'before':
    case 'after':
      return `${name} ${OP_LABELS[filter.op]} ${describeDate(String(filter.values[0] ?? ''))}`
    case 'between':
      return isTemporal(column?.kind ?? '')
        ? $t('{name} du {values} au {values2}', {
            name,
            values: describeDate(String(filter.values[0])),
            values2: describeDate(String(filter.values[1])),
          })
        : $t('{name} entre {values} et {values2}', { name, values: values[0], values2: values[1] })
    default:
      return `${name} ${OP_LABELS[filter.op]} ${values.join(', ')}`
  }
}

// ── Joins ───────────────────────────────────────────────────────────────────

/** The words for how two tables meet. */
export const JOIN_LABELS: Readonly<Record<JoinKind, string>> = {
  left: msg('Jointure à gauche'),
  inner: msg('Jointure interne'),
  right: msg('Jointure à droite'),
  full: msg('Jointure complète'),
}

/** The same, in one word, under its glyph. */
export const JOIN_SHORT: Readonly<Record<JoinKind, string>> = {
  left: msg('À gauche'),
  inner: msg('Interne'),
  right: msg('À droite'),
  full: msg('Complète'),
}

/** Which rows a join keeps, said for the two tables it joins. */
export function joinSentence(kind: JoinKind, source: string, table: string): string {
  switch (kind) {
    case 'inner':
      return $t('Seulement les lignes présentes des deux côtés.')
    case 'full':
      return $t('Toutes les lignes des deux côtés, qu’elles se correspondent ou non.')
    case 'left':
      return $t(
        'Toutes les lignes de {source}, complétées par {table} quand elles se correspondent.',
        {
          source,
          table,
        },
      )
    case 'right':
      return $t(
        'Toutes les lignes de {source}, complétées par {table} quand elles se correspondent.',
        {
          source: table,
          table: source,
        },
      )
  }
}

/** A table another can be joined to, and the condition its relation suggests. */
export interface JoinSuggestion {
  readonly table: Table
  readonly left: ColumnRef
  readonly right: string
  readonly label: string
}

/** The tables a query reads from by hand: its source, then the joins the person wrote. */
function origins(
  base: DescribedBase,
  query: BuilderQuery,
): Array<{ table: Table; alias?: string }> {
  const out: Array<{ table: Table; alias?: string }> = []
  const source = tableOf(base, query.source)
  if (source !== undefined) out.push({ table: source })
  for (const join of query.joins ?? []) {
    if (join.implicit === true) continue
    const table = tableOf(base, join.table)
    if (table !== undefined) out.push({ table, alias: join.alias })
  }
  return out
}

/**
 * The joins the base's relations suggest: for the source and each join written by hand, the
 * table a link of it points to, and each table linking to it, back — the condition that
 * makes the rows meet already written. Several make a question about the same table; the
 * first is the one proposed.
 */
export function joinSuggestions(base: DescribedBase, query: BuilderQuery): JoinSuggestion[] {
  const out: JoinSuggestion[] = []
  for (const { table: origin, alias } of origins(base, query)) {
    const ref = (field: string): ColumnRef =>
      alias === undefined ? { field } : { join: alias, field }
    for (const { field, target } of relationsOf(base, origin)) {
      out.push({
        table: target,
        left: ref(field.name),
        right: '_id',
        label: $t('{label} (par {label2})', { label: target.label, label2: field.label }),
      })
    }
    for (const table of base.tables) {
      if (table.id === origin.id) continue
      for (const field of table.fields) {
        if (
          (field.kind === 'link' || field.kind === 'multi_link') &&
          field.link?.target === origin.name
        ) {
          out.push({
            table,
            left: ref('_id'),
            right: field.name,
            label: $t('{label} (qui citent {label2})', {
              label: table.label,
              label2: origin.label,
            }),
          })
        }
      }
    }
  }
  return out
}

/** The condition a join on `table` most likely takes, when a relation says so. */
export function suggestedCondition(
  base: DescribedBase,
  query: BuilderQuery,
  table: Table,
): { readonly left: ColumnRef; readonly right: string } | null {
  const found = joinSuggestions(base, query).find((s) => s.table.id === table.id)
  return found === undefined ? null : { left: found.left, right: found.right }
}

/**
 * What two columns must share to be compared in a join — the kernel refuses otherwise
 * (`jointure_incompatible`): identifiers with identifiers, text with text, numbers with
 * numbers. `null` where the kind says too little (a lookup), and the pair is then left to the
 * kernel.
 */
export function joinFamily(kind: string): string | null {
  switch (kind) {
    case 'id':
    case 'link':
    case 'multi_link':
    case 'user':
      return 'uuid'
    case 'short_text':
    case 'long_text':
    case 'select':
    case 'multi_select':
    case 'email':
    case 'url':
      return 'text'
    case 'number':
    case 'autonumber':
    case 'count':
    case 'rollup':
      return 'number'
    case 'date':
    case 'datetime':
    case 'boolean':
      return kind
    default:
      return null
  }
}

/** Whether a join may compare two columns of these kinds. */
export function joinable(a: string, b: string): boolean {
  const left = joinFamily(a)
  const right = joinFamily(b)
  return left === null || right === null || left === right
}

/** A free alias for a join of `table`: its name, numbered past the first. */
export function joinAlias(query: BuilderQuery, table: Table): string {
  const stem =
    table.name
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[^a-z]+/, 't')
      .slice(0, 24) || 't'
  return freeAlias(stem, new Set((query.joins ?? []).map((j) => j.alias)))
}

// ── The chart a result reads best as ────────────────────────────────────────

/** A shape a result can be drawn in, and whether it needs grouping to. */
export function autoVisualization(
  query: QuestionQuery,
  result?: QueryResult | null,
): VisualizationType {
  if (query.kind === 'sql') {
    const columns = result?.columns ?? []
    const metrics = columns.filter((c) => c.role === 'metric')
    if ((result?.rows.length ?? 0) === 1 && columns.length === 1 && metrics.length === 1)
      return 'scalar'
    if (columns.length === 2 && metrics.length === 1) {
      const dimension = columns.find((c) => c.role === 'dimension')
      return dimension?.type === 'date' || dimension?.type === 'datetime' ? 'line' : 'bar'
    }
    return 'table'
  }
  const aggregations = query.aggregations ?? []
  const breakouts = query.breakouts ?? []
  if (aggregations.length === 0 && breakouts.length === 0) return 'table'
  if (breakouts.length === 0) return aggregations.length === 1 ? 'scalar' : 'table'
  if (breakouts.length > 2) return 'pivot'
  const temporal = breakouts.find(
    (b) => b.unit !== undefined && (PERIOD_UNITS as readonly string[]).includes(b.unit),
  )
  if (temporal !== undefined) return 'line'
  if (breakouts.length === 1 && (result?.rows.length ?? 0) > 12) return 'row'
  return 'bar'
}

/** The visualizations that make sense for a result, and why the others do not. */
export function vizFits(type: VisualizationType, result: QueryResult | null): boolean {
  if (result === null) return true
  const dims = result.columns.filter((c) => c.role === 'dimension' && c.hidden !== true)
  const metrics = result.columns.filter((c) => c.role === 'metric')
  switch (type) {
    case 'table':
    case 'pivot':
      return true
    case 'scalar':
    case 'progress':
    case 'gauge':
      return metrics.length > 0
    case 'trend':
      return metrics.length > 0 && dims.some((d) => d.unit !== undefined)
    case 'map':
    case 'pie':
    case 'funnel':
      return metrics.length > 0 && dims.length > 0
    case 'scatter':
      return result.columns.filter((c) => c.type === 'number').length >= 2
    default:
      return metrics.length > 0 && dims.length > 0
  }
}

// ── Where a click on a point leads ──────────────────────────────────────────

/** A point clicked: the value of each grouping it stands for. */
export interface DrillPoint {
  readonly values: ReadonlyArray<{ readonly column: ResultColumn; readonly value: unknown }>
}

/** The filter that keeps the rows a grouped value stands for. */
export function filterForValue(
  column: ResultColumn,
  value: unknown,
  weekStart: 0 | 1 = 1,
): Filter | null {
  const source = column.source
  if (source === undefined) return null
  const ref: ColumnRef =
    source.join === undefined ? { field: source.field } : { join: source.join, field: source.field }
  if (value === null || value === undefined) return { column: ref, op: 'empty', values: [] }
  if (column.unit !== undefined) {
    const period = periodExpression(String(value), column.unit, weekStart)
    return period === null ? null : { column: ref, op: 'date', values: [period] }
  }
  if (column.bin !== undefined && typeof value === 'number') {
    return { column: ref, op: 'between', values: [value, value + column.bin - Number.EPSILON * 10] }
  }
  if (typeof value === 'boolean') return { column: ref, op: value ? 'true' : 'false', values: [] }
  if (typeof value === 'number') return { column: ref, op: 'eq', values: [value] }
  return { column: ref, op: 'is', values: [String(value)] }
}

const withFilters = (query: BuilderQuery, filters: readonly Filter[]): Filter[] => [
  ...(query.filters ?? []),
  ...filters,
]

/** The rows behind a point: the same source, filtered by what the point stands for. */
export function drillRows(
  query: BuilderQuery,
  point: DrillPoint,
  weekStart: 0 | 1 = 1,
): BuilderQuery {
  const filters = point.values
    .map((v) => filterForValue(v.column, v.value, weekStart))
    .filter((f): f is Filter => f !== null)
  const { aggregations: _a, breakouts: _b, sort: _s, limit: _l, ...rest } = query
  return { ...rest, filters: withFilters(query, filters) }
}

/** The point opened on a finer period: a month on its weeks. */
export function drillFiner(
  query: BuilderQuery,
  point: DrillPoint,
  weekStart: 0 | 1 = 1,
): BuilderQuery | null {
  const temporal = point.values.find((v) => v.column.unit !== undefined)
  const unit = temporal?.column.unit
  const finer = unit === undefined ? null : finerUnit(unit)
  if (temporal === undefined || finer === null) return null
  const filter = filterForValue(temporal.column, temporal.value, weekStart)
  const source = temporal.column.source
  return {
    ...query,
    filters: withFilters(query, filter === null ? [] : [filter]),
    breakouts: (query.breakouts ?? []).map((b) =>
      source !== undefined && b.field === source.field && (b.join ?? '') === (source.join ?? '')
        ? { ...b, unit: finer }
        : b,
    ),
  }
}

/** The point split by another column: the same aggregates, within that point. */
export function drillBy(
  query: BuilderQuery,
  point: DrillPoint,
  by: Breakout,
  weekStart: 0 | 1 = 1,
): BuilderQuery {
  const filters = point.values
    .map((v) => filterForValue(v.column, v.value, weekStart))
    .filter((f): f is Filter => f !== null)
  return { ...query, filters: withFilters(query, filters), breakouts: [by], sort: [] }
}

/** The question with this value kept alone, or left out. */
export function drillKeep(
  query: BuilderQuery,
  column: ResultColumn,
  value: unknown,
  keep: boolean,
): BuilderQuery | null {
  const filter = filterForValue(column, value)
  if (filter === null || 'expression' in filter) return null
  if (keep) return { ...query, filters: withFilters(query, [filter]) }
  const opposite: Filter =
    filter.op === 'is'
      ? { ...filter, op: 'is_not' }
      : filter.op === 'eq'
        ? { ...filter, op: 'ne' }
        : filter.op === 'empty'
          ? { ...filter, op: 'not_empty' }
          : filter.op === 'true'
            ? { ...filter, op: 'false' }
            : filter.op === 'false'
              ? { ...filter, op: 'true' }
              : filter
  if (opposite === filter) return null
  return { ...query, filters: withFilters(query, [opposite]) }
}

// ── A new question ──────────────────────────────────────────────────────────

/** A question on a table: its rows, as they are. */
export const questionOn = (table: Table): BuilderQuery => ({ kind: 'builder', source: table.id })

/** A breakout on a column, with the period a date reads best by. */
export function breakoutOn(column: ColumnOption): Breakout {
  if (isTemporal(column.kind)) return { ...column.ref, unit: 'month' }
  return { ...column.ref }
}

export { columnName, sameColumnRef }
