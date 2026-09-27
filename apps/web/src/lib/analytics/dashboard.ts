import type { DescribedBase, Question } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import {
  type BuilderQuery,
  type CardMapping,
  type ColumnRef,
  type Constraint,
  DASHBOARD_COLUMNS,
  type DashboardCard,
  type DashboardParameter,
  type LegacyBlock,
  type ParameterTarget,
  type ParameterType,
  type ParameterValue,
  type QuestionQuery,
  type ResultColumn,
  type TextVariable,
  type Visualization,
  type VisualizationType,
  cardConstraints,
  cardSize,
  citedNames,
  parameterFits,
  parameterFitsVariable,
  parameterHasValue,
  periodExpression,
  questionCards,
  sameColumnRef,
  sqlVariableNames,
  tiesItself,
  withoutVariables,
} from '@basedb/contracts'
import { htmlToPlain } from '../rich-text'
import { type ColumnOption, columnsOf, isTemporal } from './model'

/**
 * A dashboard on screen — chapter 18 §4: which question a card runs, what its filters make
 * of it, where a new card goes. Pure, to be tested.
 */

let sequence = 0

/** A fresh identifier for a card, a tab, a filter: short, unique within the dashboard. */
export function newId(prefix: string): string {
  sequence += 1
  return `${prefix}${Date.now().toString(36).slice(-5)}${sequence.toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

/** The question a card runs, and how it shows it. `null`: a saved question now deleted. */
export function cardQuestion(
  card: DashboardCard,
  questions: ReadonlyMap<string, Question>,
): { query: QuestionQuery; visualization: Visualization; label: string } | null {
  if (card.question !== undefined) {
    const saved = questions.get(card.question)
    if (saved === undefined) return null
    return {
      query: saved.query,
      visualization: card.visualization ?? saved.visualization,
      label: saved.label,
    }
  }
  if (card.query === undefined) return null
  return { query: card.query, visualization: card.visualization ?? { type: 'table' }, label: '' }
}

/** Whether a value says anything: an empty text or list filters nothing. */
export const hasValue = parameterHasValue

/** The filters a card is asked to apply: each tied filter that has a value. */
export function constraintsFor(
  card: DashboardCard,
  parameters: readonly DashboardParameter[],
  values: Readonly<Record<string, ParameterValue | null>>,
): Constraint[] {
  return cardConstraints(card.mappings, parameters, values)
}

/** The values a dashboard opens with: each filter's default. */
export function defaultValues(
  parameters: readonly DashboardParameter[],
): Record<string, ParameterValue | null> {
  return Object.fromEntries(parameters.map((p) => [p.id, p.default ?? null]))
}

export interface MappingCandidate {
  readonly target: ParameterTarget
  readonly label: string
  readonly group: string
}

/** What a filter of this type can be tied to on a card: fitting columns, or variables. */
export function mappingCandidates(
  base: DescribedBase,
  type: ParameterType,
  query: QuestionQuery,
): MappingCandidate[] {
  if (query.kind === 'sql') {
    const declared = new Map((query.variables ?? []).map((v) => [v.name, v]))
    return sqlVariableNames(query.sql)
      .map((name) => declared.get(name) ?? { name, label: name, type: 'text' as const })
      .filter((v) => parameterFitsVariable(type, v.type))
      .map((v) => ({ target: { variable: v.name }, label: v.label, group: $t('Variables') }))
  }
  const columns = columnsOf(base, query)
  if (type === 'temporal_unit') {
    return (query.breakouts ?? [])
      .map((b) => columns.find((c) => sameColumnRef(c.ref, b)))
      .filter((c): c is ColumnOption => c !== undefined && isTemporal(c.kind))
      .map((c) => ({ target: { column: c.ref }, label: c.label, group: c.group }))
  }
  return columns
    .filter((c) => parameterFits(type, c.kind))
    .map((c) => ({ target: { column: c.ref }, label: c.label, group: c.group }))
}

export const sameTarget = (a: ParameterTarget, b: ParameterTarget) =>
  'variable' in a
    ? 'variable' in b && a.variable === b.variable
    : 'column' in b && sameColumnRef(a.column, b.column)

/** A card with a filter tied to `target`, or untied when `target` is null. */
export function withMapping(
  card: DashboardCard,
  parameter: string,
  target: ParameterTarget | null,
): DashboardCard {
  const rest = (card.mappings ?? []).filter((m) => m.parameter !== parameter)
  const mappings: CardMapping[] = target === null ? rest : [...rest, { parameter, target }]
  const { mappings: _old, ...plain } = card
  return mappings.length === 0 ? plain : { ...plain, mappings }
}

/** The fields the cards already tie a filter to, their texts' questions included. */
const tiedFields = (cards: readonly DashboardCard[], parameter: string) =>
  questionCards(cards)
    .flatMap((c) => c.mappings ?? [])
    .filter((m) => m.parameter === parameter && 'column' in m.target)
    .map((m) => (m.target as { column: ColumnRef }).column.field)

/**
 * Where a filter is best tied on a question: to the column of the same name as the cards
 * already tied, else to the first that fits — a date filter to the first date.
 */
function guessedTarget(
  query: QuestionQuery,
  parameter: DashboardParameter,
  tied: readonly string[],
  base: DescribedBase,
): ParameterTarget | null {
  // Guessed only among the fields the base defines: « created on » is a column of every
  // table, and tying every card to it would filter them all by a date nobody chose.
  const candidates = mappingCandidates(base, parameter.type, query).filter(
    (c) => !('column' in c.target) || !c.target.column.field.startsWith('_'),
  )
  const preferred =
    candidates.find((c) => 'column' in c.target && tied.includes(c.target.column.field)) ??
    candidates.find((c) => 'column' in c.target && c.target.column.join === undefined) ??
    candidates[0]
  return preferred?.target ?? null
}

/** The query a text runs itself for a value: the saved one it names, or the one it keeps. */
export const variableQuery = (
  variable: TextVariable,
  questions: ReadonlyMap<string, Question>,
): QuestionQuery | null =>
  'question' in variable
    ? (questions.get(variable.question)?.query ?? null)
    : 'query' in variable
      ? variable.query
      : null

/**
 * A query a text runs itself, tied to a filter it was not tied to yet — when it can be. A
 * card cited follows its own ties; a filter's value, nothing.
 */
function mappedVariable(
  variable: TextVariable,
  parameter: DashboardParameter,
  tied: readonly string[],
  base: DescribedBase,
  questions: ReadonlyMap<string, Question>,
): TextVariable {
  if (!tiesItself(variable)) return variable
  if ((variable.mappings ?? []).some((m) => m.parameter === parameter.id)) return variable
  const query = variableQuery(variable, questions)
  const target = query === null ? null : guessedTarget(query, parameter, tied, base)
  return target === null
    ? variable
    : { ...variable, mappings: [...(variable.mappings ?? []), { parameter: parameter.id, target }] }
}

/**
 * Ties a filter to every card that can take it — and to every question a text cites: to
 * the column of the same name as the cards already tied, else to the first that fits.
 */
export function autoMap(
  cards: readonly DashboardCard[],
  parameter: DashboardParameter,
  base: DescribedBase,
  questions: ReadonlyMap<string, Question>,
): DashboardCard[] {
  const tied = tiedFields(cards, parameter.id)
  return cards.map((card) => {
    if (card.kind === 'text' && card.variables !== undefined) {
      return {
        ...card,
        variables: card.variables.map((v) => mappedVariable(v, parameter, tied, base, questions)),
      }
    }
    if (
      card.kind !== 'question' ||
      (card.mappings ?? []).some((m) => m.parameter === parameter.id)
    ) {
      return card
    }
    const question = cardQuestion(card, questions)
    if (question === null) return card
    const target = guessedTarget(question.query, parameter, tied, base)
    return target === null ? card : withMapping(card, parameter.id, target)
  })
}

/** A question just cited in a text, tied to each filter of the dashboard it can take. */
export function tiedVariable(
  variable: TextVariable,
  cards: readonly DashboardCard[],
  parameters: readonly DashboardParameter[],
  base: DescribedBase,
  questions: ReadonlyMap<string, Question>,
): TextVariable {
  return parameters.reduce(
    (v, parameter) =>
      mappedVariable(v, parameter, tiedFields(cards, parameter.id), base, questions),
    variable,
  )
}

/** A query a text runs, with a filter tied to `target` — or untied when null. */
export function withVariableMapping(
  variable: TextVariable,
  parameter: string,
  target: ParameterTarget | null,
): TextVariable {
  if (!tiesItself(variable)) return variable
  const rest = (variable.mappings ?? []).filter((m) => m.parameter !== parameter)
  const mappings: CardMapping[] = target === null ? rest : [...rest, { parameter, target }]
  const { mappings: _old, ...plain } = variable
  return mappings.length === 0 ? plain : { ...plain, mappings }
}

/**
 * A card once a filter is gone: untied from it — a text's questions too —, and a text no
 * longer citing its value: the citation leaves the words with it.
 */
export function withoutParameter(card: DashboardCard, parameter: string): DashboardCard {
  const untied = withMapping(card, parameter, null)
  if (card.kind !== 'text' || card.variables === undefined) return untied
  const left = withoutVariables(untied, (v) => 'parameter' in v && v.parameter === parameter)
  if (left.variables === undefined) return left
  return { ...left, variables: left.variables.map((v) => withVariableMapping(v, parameter, null)) }
}

/**
 * The name a text cites a value by, from its label: `{{chiffre_d_affaires}}` — lower case,
 * no accent, unique among `taken`.
 */
export function variableName(label: string, taken: ReadonlySet<string>): string {
  const stem =
    label
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40)
      .replace(/_+$/, '') || 'valeur'
  let name = stem
  for (let n = 2; taken.has(name); n++) name = `${stem}_${n}`
  return name
}

/**
 * What a text keeps of its variables once rewritten: those it still cites — the ones it
 * had, else the one `offered` under that name.
 */
export function citedVariables(
  text: string,
  kept: readonly TextVariable[],
  offered: ReadonlyMap<string, TextVariable>,
): TextVariable[] {
  const known = new Map(kept.map((v) => [v.name, v]))
  return citedNames(text).flatMap((name) => known.get(name) ?? offered.get(name) ?? [])
}

/** The size a card starts at, by what it shows — the kernel's copilot places by the same. */
export function sizeFor(
  kind: DashboardCard['kind'],
  viz?: VisualizationType,
): { w: number; h: number } {
  return { ...cardSize(kind, viz) }
}

/** Where a new card goes: under the cards of its tab, at the left. */
export function placed(
  cards: readonly DashboardCard[],
  tab: string | null,
  size: { w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const bottom = cards.filter((c) => c.tab === tab).reduce((max, c) => Math.max(max, c.y + c.h), 0)
  return { x: 0, y: bottom, ...size }
}

/**
 * A filter set by a click on a point of a chart: the column the point stands for — a
 * table's field — and its value, on every card of the dashboard whose question reads that
 * field. Kept on screen, never saved: the dashboard's own filters stay as they were built.
 */
export interface PointFilter {
  /** The table, by key, and the field the value belongs to. */
  readonly table: string
  readonly field: string
  /** What the chip says: the column, then the value as the chart reads it. */
  readonly label: string
  readonly text: string
  readonly type: 'category' | 'date'
  readonly value: ParameterValue
}

/**
 * The filter a point sets, or `null` when it cannot set one: a column of no field (a
 * measure, a SQL column), no value, a bin of numbers, a rank of the week.
 */
export function pointFilterOf(
  column: ResultColumn,
  value: unknown,
  weekStart: 0 | 1 = 1,
): Omit<PointFilter, 'label' | 'text'> | null {
  const source = column.source
  if (source === undefined || column.role === 'metric' || column.bin !== undefined) return null
  if (value === null || value === undefined || value === '') return null
  if (column.unit !== undefined) {
    const period =
      typeof value === 'string' ? periodExpression(value, column.unit, weekStart) : null
    return period === null
      ? null
      : { table: source.table, field: source.field, type: 'date', value: period }
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return null
  }
  return { table: source.table, field: source.field, type: 'category', value: [String(value)] }
}

/** Where a card's question reads a table's field: the source, or a join — or nowhere. */
function columnIn(
  query: QuestionQuery,
  table: string,
  field: string,
  base: DescribedBase,
): ColumnRef | null {
  if (query.kind !== 'builder') return null
  const same = (ref: string) => {
    const found = base.tables.find((t) => t.id === ref || t.name === ref)
    return found !== undefined && found.id === table ? found : null
  }
  const scopes = [
    { join: undefined as string | undefined, ref: query.source },
    ...(query.joins ?? []).map((j) => ({ join: j.alias, ref: j.table })),
  ]
  for (const scope of scopes) {
    const t = same(scope.ref)
    if (t === null) continue
    // A system column is in every table; a field, in its own.
    if (!field.startsWith('_') && !t.fields.some((f) => f.name === field)) continue
    return scope.join === undefined ? { field } : { join: scope.join, field }
  }
  return null
}

/** The filters set by clicks that a card takes, as constraints of its question. */
export function pointConstraints(
  card: DashboardCard,
  filters: readonly PointFilter[],
  questions: ReadonlyMap<string, Question>,
  base: DescribedBase,
): Constraint[] {
  if (filters.length === 0) return []
  const question = cardQuestion(card, questions)
  if (question === null) return []
  const out: Constraint[] = []
  for (const filter of filters) {
    const column = columnIn(question.query, filter.table, filter.field, base)
    if (column === null) continue
    out.push({ target: { column }, type: filter.type, value: filter.value })
  }
  return out
}

/** How many of these cards a filter set by a click would filter. */
export function cardsTaking(
  filter: Pick<PointFilter, 'table' | 'field'>,
  cards: readonly DashboardCard[],
  questions: ReadonlyMap<string, Question>,
  base: DescribedBase,
): number {
  const taking = questionCards(cards).filter((card) => {
    const question = cardQuestion(card, questions)
    return question !== null && columnIn(question.query, filter.table, filter.field, base) !== null
  })
  // A text citing two questions that read the column is still one card.
  return new Set(taking.map((c) => c.id)).size
}

/** A builder question's filters and a dashboard's, as one query — what « Explorer » opens. */
export function withConstraints(
  query: BuilderQuery,
  constraints: readonly Constraint[],
): BuilderQuery {
  let next: BuilderQuery = query
  for (const c of constraints) {
    if (!('column' in c.target)) continue
    const column = c.target.column
    if (c.type === 'temporal_unit') {
      const unit = Array.isArray(c.value) ? c.value[0] : c.value
      next = {
        ...next,
        breakouts: (next.breakouts ?? []).map((b) =>
          sameColumnRef(b, column) && typeof unit === 'string' ? { ...b, unit: unit as never } : b,
        ),
      }
      continue
    }
    const values = (Array.isArray(c.value) ? c.value : [c.value]).filter(
      (v): v is string | number => v !== null && v !== '',
    )
    if (values.length === 0) continue
    const filter =
      c.type === 'date'
        ? { column, op: 'date' as const, values: [String(values[0])] }
        : c.type === 'text'
          ? { column, op: 'contains' as const, values: [String(values[0])] }
          : c.type === 'number'
            ? c.operator === 'between' && values.length === 2
              ? { column, op: 'between' as const, values }
              : {
                  column,
                  op: (c.operator === 'gte' ? 'gte' : c.operator === 'lte' ? 'lte' : 'eq') as 'eq',
                  values: [values[0] as number],
                }
            : { column, op: 'is' as const, values }
    next = { ...next, filters: [...(next.filters ?? []), filter] }
  }
  return next
}

export const PARAMETER_LABELS: Readonly<Record<ParameterType, string>> = {
  date: $t('Date'),
  category: $t('Catégorie'),
  text: $t('Texte'),
  number: $t('Nombre'),
  temporal_unit: $t('Regroupement de date'),
}

/**
 * The blocks a base template can carry of a dashboard (chapter 20): its cards that read as
 * the first dashboards' blocks — a number, a count by a value, a list, a text. The others
 * are said, not dropped silently.
 */
export function blocksOf(
  cards: readonly DashboardCard[],
  tabs: readonly { readonly id: string }[],
  questions: ReadonlyMap<string, Question>,
): { blocks: LegacyBlock[]; omitted: string[] } {
  const rank = (card: DashboardCard) => tabs.findIndex((t) => t.id === card.tab)
  const ordered = [...cards].sort((a, b) => rank(a) - rank(b) || a.y - b.y || a.x - b.x)
  const blocks: LegacyBlock[] = []
  const omitted: string[] = []
  const width = (w: number) => (w <= 8 ? 1 : w <= 16 ? 2 : 3)
  for (const card of ordered) {
    const title = card.title ?? ''
    if (card.kind === 'heading') {
      blocks.push({ kind: 'text', width: 3, title: '', body: `## ${card.text ?? ''}` })
      continue
    }
    if (card.kind === 'text') {
      const text = card.text ?? ''
      // A template's text is Markdown, and cites nothing: a rich one goes as its words.
      const body = card.rich === true ? htmlToPlain(text) : text
      blocks.push({ kind: 'text', width: width(card.w), title, body })
      if ((card.variables ?? []).length > 0) {
        omitted.push(
          $t('« {value} » : un modèle ne porte pas les valeurs qu’un texte cite.', {
            value: title || htmlToPlain(text, 40) || $t('Texte'),
          }),
        )
      }
      continue
    }
    if (card.kind === 'embed') {
      omitted.push(
        $t('« {value} » : un modèle ne porte pas de page extérieure.', {
          value: title || $t('Page intégrée'),
        }),
      )
      continue
    }
    const question = cardQuestion(card, questions)
    const query = question?.query
    const named = title || question?.label || $t('Question')
    if (query === undefined || query.kind !== 'builder' || (query.joins ?? []).length > 0) {
      omitted.push(
        $t('« {named} » : une question SQL ou jointe ne tient pas dans un modèle.', { named }),
      )
      continue
    }
    const filters = query.filters ?? []
    if (filters.some((f) => !('expression' in f))) {
      omitted.push(
        $t('« {named} » : ses filtres construits ne tiennent pas dans un modèle.', { named }),
      )
      continue
    }
    const filter = filters.map((f) => ('expression' in f ? `(${f.expression})` : '')).join(' and ')
    const aggregations = query.aggregations ?? []
    const breakouts = query.breakouts ?? []
    const first = aggregations[0]
    const type = question?.visualization.type
    if (aggregations.length === 1 && breakouts.length === 0 && first !== undefined) {
      const fn = first.fn
      if (fn === 'count' || fn === 'sum' || fn === 'avg' || fn === 'min' || fn === 'max') {
        blocks.push({
          kind: 'number',
          width: width(card.w),
          title: title || (question?.label ?? ''),
          table: query.source,
          aggregate: fn,
          field: fn === 'count' ? null : (first.column?.field ?? null),
          filter,
        })
        continue
      }
    }
    const breakout = breakouts[0]
    if (
      aggregations.length === 1 &&
      first?.fn === 'count' &&
      breakouts.length === 1 &&
      breakout !== undefined &&
      breakout.unit === undefined &&
      breakout.bin === undefined &&
      breakout.join === undefined
    ) {
      blocks.push({
        kind: 'chart',
        width: width(card.w),
        title: title || (question?.label ?? ''),
        table: query.source,
        group_by: breakout.field,
        filter,
        style: type === 'pie' ? 'pie' : 'bar',
      })
      continue
    }
    if (aggregations.length === 0 && breakouts.length === 0) {
      const fields = (query.fields ?? []).filter((f) => f.join === undefined).map((f) => f.field)
      const sort = (query.sort ?? [])
        .map((s) =>
          s.target.kind === 'column' ? `${s.desc === true ? '-' : ''}${s.target.column.field}` : '',
        )
        .filter((s) => s !== '')
        .join(',')
      if (fields.length > 0) {
        blocks.push({
          kind: 'list',
          width: width(card.w),
          title: title || (question?.label ?? ''),
          table: query.source,
          fields: fields.slice(0, 6),
          filter,
          sort,
          limit: Math.min(query.limit ?? 10, 20),
        })
        continue
      }
    }
    omitted.push($t('« {named} » : une question trop riche pour les blocs d’un modèle.', { named }))
  }
  return { blocks, omitted }
}
