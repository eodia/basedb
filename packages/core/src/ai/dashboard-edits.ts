import {
  type CardMapping,
  type ColumnRef,
  DASHBOARD_COLUMNS,
  DASHBOARD_LIMITS,
  type DashboardCard,
  type DashboardChange,
  type DashboardContent,
  type DashboardParameter,
  type DashboardTab,
  NUMBER_OPERATORS,
  PARAMETER_TYPES,
  type ParameterType,
  type ParameterValue,
  type QuestionQuery,
  TEMPORAL_UNITS,
  type TextVariable,
  type Visualization,
  type VisualizationType,
  cardSize,
  isTemporalUnit,
  parameterFits,
  placedAfter,
  withoutVariables,
} from '@basedb/contracts'
import { richTextToPlain } from '../records/rich-text.js'

/**
 * What the copilot of the dashboards proposes, made into what a save takes — chapter 18
 * §2.6. Pure: the queries are checked by a callback the kernel gives (the catalog, a dry
 * run), and whatever does not fit is set aside with its reason, in words the model reads
 * back to correct itself and the person reads under the answer.
 */

/** A table as the copilot knows it: by key, name and label, with its fields' kinds. */
export interface EditTable {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly label: string
    readonly kind: string
    readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
  }>
}

/** A saved question, as a card may cite it. */
export interface EditQuestion {
  readonly label: string
  readonly query: QuestionQuery
  readonly visualization: Visualization
}

/** The columns every table has, which the catalog of fields does not list. */
const SYSTEM_FIELDS = [
  { name: '_created_at', label: 'Créé le', kind: 'datetime', options: [] },
  { name: '_updated_at', label: 'Modifié le', kind: 'datetime', options: [] },
  { name: '_created_by', label: 'Créé par', kind: 'user', options: [] },
  { name: '_updated_by', label: 'Modifié par', kind: 'user', options: [] },
] as const

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

const cut = (text: string, max: number) =>
  [...text].length > max ? `${[...text].slice(0, max).join('')}…` : text

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}

const VIZ_WORDS: Readonly<Record<VisualizationType, string>> = {
  table: 'tableau',
  scalar: 'chiffre',
  trend: 'tendance',
  progress: 'progression',
  gauge: 'jauge',
  bar: 'histogramme',
  row: 'barres',
  line: 'courbe',
  area: 'aires',
  combo: 'combiné',
  pie: 'secteurs',
  scatter: 'nuage de points',
  funnel: 'entonnoir',
  pivot: 'tableau croisé',
  map: 'carte',
}

const TYPE_WORDS: Readonly<Record<ParameterType, string>> = {
  date: 'période',
  category: 'valeurs',
  text: 'texte',
  number: 'nombre',
  temporal_unit: 'regroupement',
}

/** A table named the way a model names it: its key, its name, its label. */
export function tableNamed(tables: readonly EditTable[], ref: unknown): EditTable | undefined {
  if (typeof ref !== 'string' || ref.trim() === '') return undefined
  const text = ref.trim().replace(/^"|"$/g, '')
  const last = text.split('.').at(-1) ?? text
  return (
    tables.find((t) => t.id === text) ??
    tables.find((t) => t.name === last) ??
    tables.find((t) => t.name.toLowerCase() === last.toLowerCase()) ??
    tables.find((t) => fold(t.label) === fold(text))
  )
}

/** A query as the model reads it: its tables by name, which is what it writes back. */
export function queryForModel(query: QuestionQuery, tables: readonly EditTable[]): unknown {
  if (query.kind !== 'builder') return query
  const name = (id: string) => tables.find((t) => t.id === id)?.name ?? id
  return {
    ...query,
    source: name(query.source),
    ...(query.joins === undefined
      ? {}
      : { joins: query.joins.map((j) => ({ ...j, table: name(j.table) })) }),
  }
}

/** A query as the model wrote it, its tables brought back to their keys. */
export function queryFromModel(raw: unknown, tables: readonly EditTable[]): unknown {
  const q = record(raw)
  if (q.kind === 'sql') return q
  const key = (ref: unknown) => tableNamed(tables, ref)?.id ?? ref
  return {
    ...q,
    kind: 'builder',
    source: key(q.source),
    ...(Array.isArray(q.joins)
      ? { joins: q.joins.map((j) => ({ ...record(j), table: key(record(j).table) })) }
      : {}),
  }
}

/** How a question shows when the model did not say: a number, a curve over time, bars. */
export function defaultVisualization(query: QuestionQuery): Visualization {
  if (query.kind === 'sql') return { type: 'table' }
  const breakouts = query.breakouts ?? []
  const aggregations = query.aggregations ?? []
  if (breakouts.length === 0) return { type: aggregations.length > 0 ? 'scalar' : 'table' }
  if (aggregations.length === 0) return { type: 'table' }
  const first = breakouts[0]
  if (
    first?.unit !== undefined &&
    (TEMPORAL_UNITS as readonly string[]).includes(first.unit) &&
    breakouts.length === 1
  ) {
    return { type: 'line' }
  }
  return { type: breakouts.length > 2 ? 'table' : 'bar' }
}

/** Checks one question — its query, its visualization — or throws the reason, in words. */
export type CheckQuestion = (
  raw: { readonly query: unknown; readonly visualization: unknown },
  at: string,
) => Promise<{ readonly query: QuestionQuery; readonly visualization: Visualization }>

export interface EditContext {
  readonly tables: readonly EditTable[]
  readonly questions: ReadonlyMap<string, EditQuestion>
  readonly check: CheckQuestion
  /** The tab on screen: where a card lands when the model names none. */
  readonly tab: string | null
  readonly newId: (prefix: string) => string
}

export interface EditedDashboard {
  readonly label: string
  readonly description: string | null
  readonly content: DashboardContent
  readonly changes: DashboardChange[]
  readonly dropped: string[]
}

const tiedText = (tied: readonly string[]) =>
  tied.length === 0
    ? ''
    : `, reliée ${tied.length > 1 ? 'aux filtres' : 'au filtre'} ${tied.map((t) => `« ${t} »`).join(', ')}`

const clampInt = (raw: unknown, min: number, max: number): number | null =>
  typeof raw === 'number' && Number.isFinite(raw)
    ? Math.min(Math.max(Math.round(raw), min), max)
    : null

/** What a card says it is, in a line: its title, or its question's label. */
function cardTitle(card: DashboardCard, questions: ReadonlyMap<string, EditQuestion>): string {
  if (card.title !== undefined && card.title.trim() !== '') return card.title
  if (card.kind === 'heading' || card.kind === 'text') {
    return cut(card.rich === true ? richTextToPlain(card.text ?? '') : (card.text ?? 'Texte'), 40)
  }
  if (card.question !== undefined) return questions.get(card.question)?.label ?? 'Question'
  return 'Question'
}

/** The columns of a card's question a filter of this type may be tied to, for a field. */
function tiesFor(
  query: QuestionQuery | null,
  type: ParameterType,
  field: string | null,
  table: EditTable | undefined,
  tables: readonly EditTable[],
): ColumnRef | null {
  if (query === null || query.kind !== 'builder') return null
  const scopes: Array<{ join?: string; table: EditTable | undefined }> = [
    // By key, or by name: the cards of the first dashboards name their table.
    { table: tableNamed(tables, query.source) },
    ...(query.joins ?? []).map((j) => ({ join: j.alias, table: tableNamed(tables, j.table) })),
  ]
  if (type === 'temporal_unit') {
    const breakout = (query.breakouts ?? []).find(
      (b) =>
        b.unit !== undefined &&
        (TEMPORAL_UNITS as readonly string[]).includes(b.unit) &&
        (field === null || b.field === field),
    )
    return breakout === undefined
      ? null
      : { ...(breakout.join === undefined ? {} : { join: breakout.join }), field: breakout.field }
  }
  if (field === null) return null
  for (const scope of scopes) {
    if (scope.table === undefined) continue
    if (table !== undefined && scope.table.id !== table.id) continue
    const found = [...scope.table.fields, ...SYSTEM_FIELDS].find((f) => f.name === field)
    if (found === undefined || !parameterFits(type, found.kind)) continue
    return { ...(scope.join === undefined ? {} : { join: scope.join }), field }
  }
  return null
}

/**
 * The filters of the dashboard a new card takes: each one tied, on another card, to a
 * column this card's question has too — the period of the invoices is their date on every
 * card that reads them. A column is guessed only by its name, never by its kind.
 */
function autoTied(
  card: Omit<DashboardCard, 'x' | 'y'>,
  parameters: readonly DashboardParameter[],
  others: readonly DashboardCard[],
  questions: ReadonlyMap<string, EditQuestion>,
  tables: readonly EditTable[],
): { card: Omit<DashboardCard, 'x' | 'y'>; tied: string[] } {
  const query = queryOf(card as DashboardCard, questions)
  if (query === null || query.kind !== 'builder') return { card, tied: [] }
  const mappings: CardMapping[] = [...(card.mappings ?? [])]
  const tied: string[] = []
  for (const parameter of parameters) {
    if (mappings.some((m) => m.parameter === parameter.id)) continue
    const fields = [
      ...new Set(
        others.flatMap((c) =>
          (c.mappings ?? [])
            .filter((m) => m.parameter === parameter.id && 'column' in m.target)
            .map((m) => (m.target as { column: ColumnRef }).column.field),
        ),
      ),
    ]
    for (const field of fields) {
      const column = tiesFor(
        query,
        parameter.type,
        parameter.type === 'temporal_unit' ? null : field,
        undefined,
        tables,
      )
      if (column === null) continue
      mappings.push({ parameter: parameter.id, target: { column } })
      tied.push(parameter.label)
      break
    }
  }
  return tied.length === 0 ? { card, tied } : { card: { ...card, mappings }, tied }
}

/** The question a card runs, when it runs one. */
function queryOf(
  card: DashboardCard,
  questions: ReadonlyMap<string, EditQuestion>,
): QuestionQuery | null {
  if (card.kind !== 'question') return null
  if (card.question !== undefined) return questions.get(card.question)?.query ?? null
  return card.query ?? null
}

/**
 * A filter's value checked against its type — a date expression, values, a text, numbers,
 * a period — or `undefined` when it does not fit. A choice named by its label is written
 * as the column stores it.
 */
export function checkedFilterValue(
  parameter: Pick<DashboardParameter, 'type' | 'units'>,
  raw: unknown,
  options: ReadonlyArray<{ readonly value: string; readonly label: string }> = [],
): ParameterValue | null | undefined {
  if (raw === null) return null
  switch (parameter.type) {
    case 'date':
    case 'text':
      return typeof raw === 'string' && raw.trim() !== '' ? cut(raw.trim(), 200) : undefined
    case 'temporal_unit': {
      const unit = Array.isArray(raw) ? raw[0] : raw
      const offered = parameter.units ?? TEMPORAL_UNITS
      return typeof unit === 'string' && (offered as readonly string[]).includes(unit)
        ? unit
        : undefined
    }
    case 'number': {
      const list = Array.isArray(raw) ? raw : [raw]
      if (list.length === 0 || list.length > 2) return undefined
      if (!list.every((v) => v === null || (typeof v === 'number' && Number.isFinite(v)))) {
        return undefined
      }
      return list as ParameterValue
    }
    case 'category': {
      const list = (Array.isArray(raw) ? raw : [raw]).filter(
        (v): v is string | number => typeof v === 'string' || typeof v === 'number',
      )
      if (list.length === 0 || list.length > 50) return undefined
      return list.map((v) => {
        const text = String(v)
        return (
          options.find((o) => o.value === text)?.value ??
          options.find((o) => fold(o.label) === fold(text))?.value ??
          text
        )
      })
    }
  }
}

/** The choices of the column a filter is tied to first, to read a value named by its label. */
export function optionsOfParameter(
  parameterId: string,
  cards: readonly DashboardCard[],
  questions: ReadonlyMap<string, EditQuestion>,
  tables: readonly EditTable[],
): ReadonlyArray<{ readonly value: string; readonly label: string }> {
  for (const card of cards) {
    const mapping = (card.mappings ?? []).find(
      (m) => m.parameter === parameterId && 'column' in m.target,
    )
    const query = queryOf(card, questions)
    if (mapping === undefined || !('column' in mapping.target) || query?.kind !== 'builder') {
      continue
    }
    const column = mapping.target.column
    const tableId =
      column.join === undefined
        ? query.source
        : query.joins?.find((j) => j.alias === column.join)?.table
    const field = tableNamed(tables, tableId)?.fields.find((f) => f.name === column.field)
    if (field !== undefined && field.options.length > 0) return field.options
  }
  return []
}

/**
 * The model's operations applied to a dashboard — or to an empty one, for a new one. Each
 * operation stands or falls alone; the cards added take their place after the others of
 * their tab, side by side while the row has room.
 */
export async function editDashboard(
  current: {
    readonly label: string
    readonly description: string | null
    readonly content: DashboardContent
  },
  operations: unknown,
  context: EditContext,
): Promise<EditedDashboard> {
  let label = current.label
  let description = current.description
  const tabs: DashboardTab[] = [...current.content.tabs]
  let cards: DashboardCard[] = [...current.content.cards]
  const parameters: DashboardParameter[] = [...current.content.parameters]
  const changes: DashboardChange[] = []
  const dropped: string[] = []
  const added: Array<Omit<DashboardCard, 'x' | 'y'>> = []
  const questions = context.questions

  const tabOf = (ref: unknown): string | null => {
    if (tabs.length === 0) return null
    if (typeof ref === 'string' && ref.trim() !== '') {
      const found = tabs.find((t) => t.id === ref) ?? tabs.find((t) => fold(t.label) === fold(ref))
      if (found !== undefined) return found.id
    }
    return tabs.some((t) => t.id === context.tab) ? context.tab : (tabs[0]?.id ?? null)
  }
  const every = () => [...cards, ...added] as DashboardCard[]
  const findCard = (ref: unknown): DashboardCard | undefined => {
    if (typeof ref !== 'string') return undefined
    return (
      every().find((c) => c.id === ref) ??
      every().find((c) => fold(cardTitle(c, questions)) === fold(ref))
    )
  }
  const sized = (
    raw: Record<string, unknown>,
    kind: DashboardCard['kind'],
    viz?: Visualization,
  ) => {
    const size = cardSize(kind, viz?.type)
    return {
      w: clampInt(raw.w, 2, DASHBOARD_COLUMNS) ?? size.w,
      h: clampInt(raw.h, 2, DASHBOARD_LIMITS.height) ?? size.h,
    }
  }

  const list = Array.isArray(operations) ? operations.slice(0, 30) : []
  for (const [index, item] of list.entries()) {
    const o = record(item)
    const at = `opérations[${index}]`
    try {
      switch (o.op) {
        case 'add_card': {
          if (every().length >= DASHBOARD_LIMITS.cards) throw new Error('trop de cartes')
          const title =
            typeof o.title === 'string' ? cut(o.title.trim(), DASHBOARD_LIMITS.label) : ''
          const saved = typeof o.question === 'string' ? questions.get(o.question) : undefined
          if (saved !== undefined) {
            const visualization =
              o.visualization === undefined
                ? undefined
                : (await context.check({ query: saved.query, visualization: o.visualization }, at))
                    .visualization
            const viz = visualization ?? saved.visualization
            const { card, tied } = autoTied(
              {
                id: context.newId('c'),
                tab: tabOf(o.tab),
                kind: 'question',
                question: o.question as string,
                ...(title === '' ? {} : { title }),
                ...(visualization === undefined ? {} : { visualization }),
                ...sized(o, 'question', viz),
              },
              parameters,
              every(),
              questions,
              context.tables,
            )
            added.push(card)
            changes.push({
              kind: 'add_card',
              text: `Ajouter « ${title || saved.label} » (${VIZ_WORDS[viz.type]})${tiedText(tied)}`,
            })
            break
          }
          const checked = await context.check(
            { query: o.query, visualization: o.visualization },
            at,
          )
          const { card, tied } = autoTied(
            {
              id: context.newId('c'),
              tab: tabOf(o.tab),
              kind: 'question',
              query: checked.query,
              visualization: checked.visualization,
              ...(title === '' ? {} : { title }),
              ...sized(o, 'question', checked.visualization),
            },
            parameters,
            every(),
            questions,
            context.tables,
          )
          added.push(card)
          changes.push({
            kind: 'add_card',
            text: `Ajouter « ${title || 'Question'} » (${VIZ_WORDS[checked.visualization.type]})${tiedText(tied)}`,
          })
          break
        }
        case 'add_text': {
          if (every().length >= DASHBOARD_LIMITS.cards) throw new Error('trop de cartes')
          const text = typeof o.text === 'string' ? cut(o.text.trim(), DASHBOARD_LIMITS.text) : ''
          if (text === '') throw new Error('texte vide')
          const heading = o.heading === true
          const kind = heading ? 'heading' : 'text'
          added.push({
            id: context.newId('c'),
            tab: tabOf(o.tab),
            kind,
            text: heading ? cut(text, DASHBOARD_LIMITS.label) : text,
            ...sized(o, kind),
          })
          changes.push({
            kind: 'add_text',
            text: heading ? `Ajouter le titre « ${cut(text, 60)} »` : 'Ajouter un texte',
          })
          break
        }
        case 'update_card': {
          const card = findCard(o.card)
          if (card === undefined) throw new Error(`carte inconnue (« ${String(o.card)} »)`)
          const before = cardTitle(card, questions)
          const said: string[] = []
          let next: DashboardCard = card
          if (typeof o.title === 'string') {
            next = { ...next, title: cut(o.title.trim(), DASHBOARD_LIMITS.label) }
            said.push(`titre « ${next.title} »`)
          }
          if (typeof o.text === 'string' && (card.kind === 'text' || card.kind === 'heading')) {
            // The copilot writes Markdown: a rich text it rewrites becomes one; the values
            // it still cites stay.
            const { rich: _rich, ...plain } = next
            next = { ...plain, text: cut(o.text.trim(), DASHBOARD_LIMITS.text) }
            said.push('texte')
          }
          if (
            card.kind === 'question' &&
            (o.query !== undefined || o.visualization !== undefined)
          ) {
            const query = queryOf(card, questions)
            if (query === null && o.query === undefined) throw new Error('question introuvable')
            const base =
              card.visualization ??
              (card.question === undefined
                ? undefined
                : questions.get(card.question)?.visualization)
            const given = record(o.visualization)
            const visualization =
              o.visualization === undefined
                ? base
                : {
                    type: given.type ?? base?.type ?? 'table',
                    settings: { ...(base?.settings ?? {}), ...record(given.settings) },
                  }
            const checked = await context.check(
              { query: o.query ?? query, visualization: visualization ?? {} },
              at,
            )
            if (o.query !== undefined) {
              // The saved question stays as it is: the card now keeps its own.
              const { question: _saved, ...rest } = next
              next = { ...rest, query: checked.query }
              said.push(card.question === undefined ? 'question' : 'question gardée dans la carte')
            }
            if (o.visualization !== undefined) {
              next = { ...next, visualization: checked.visualization }
              said.push(VIZ_WORDS[checked.visualization.type])
            }
          }
          const w = clampInt(o.w, 2, DASHBOARD_COLUMNS)
          const h = clampInt(o.h, 2, DASHBOARD_LIMITS.height)
          if (w !== null || h !== null) {
            const width = w ?? next.w
            next = {
              ...next,
              w: width,
              x: Math.min(next.x, DASHBOARD_COLUMNS - width),
              h: h ?? next.h,
            }
            said.push('taille')
          }
          if (said.length === 0) throw new Error(`rien à changer sur « ${before} »`)
          cards = cards.map((c) => (c.id === card.id ? next : c))
          for (const [i, c] of added.entries()) if (c.id === card.id) added[i] = next
          changes.push({ kind: 'update_card', text: `Modifier « ${before} » : ${said.join(', ')}` })
          break
        }
        case 'remove_card': {
          const card = findCard(o.card)
          if (card === undefined) throw new Error(`carte inconnue (« ${String(o.card)} »)`)
          // A text citing it loses its value, and the words that cited it.
          const cites = (v: TextVariable) => 'card' in v && v.card === card.id
          cards = cards.filter((c) => c.id !== card.id).map((c) => withoutVariables(c, cites))
          const i = added.findIndex((c) => c.id === card.id)
          if (i >= 0) added.splice(i, 1)
          changes.push({ kind: 'remove_card', text: `Retirer « ${cardTitle(card, questions)} »` })
          break
        }
        case 'add_filter': {
          if (parameters.length >= DASHBOARD_LIMITS.parameters) throw new Error('trop de filtres')
          const type = o.type as ParameterType
          if (!(PARAMETER_TYPES as readonly unknown[]).includes(type)) {
            throw new Error(`type de filtre inconnu (${String(o.type)})`)
          }
          const name =
            typeof o.label === 'string' ? cut(o.label.trim(), DASHBOARD_LIMITS.label) : ''
          if (name === '') throw new Error('filtre sans libellé')
          const field = typeof o.field === 'string' && o.field.trim() !== '' ? o.field.trim() : null
          const table = o.table === undefined ? undefined : tableNamed(context.tables, o.table)
          if (field === null && type !== 'temporal_unit') {
            throw new Error(`filtre « ${name} » sans colonne`)
          }
          const id = context.newId('p')
          const operator =
            type === 'number' && (NUMBER_OPERATORS as readonly unknown[]).includes(o.operator)
              ? (o.operator as DashboardParameter['operator'])
              : undefined
          const units =
            type === 'temporal_unit' && Array.isArray(o.units)
              ? o.units.filter(
                  (u): u is (typeof TEMPORAL_UNITS)[number] =>
                    isTemporalUnit(u) && (TEMPORAL_UNITS as readonly unknown[]).includes(u),
                )
              : undefined
          const parameter: DashboardParameter = {
            id,
            label: name,
            type,
            ...(type === 'category' ? { multiple: o.multiple !== false } : {}),
            ...(operator === undefined ? {} : { operator }),
            ...(units === undefined || units.length === 0 ? {} : { units }),
          }
          let tied = 0
          const tie = (card: DashboardCard): DashboardCard => {
            const column = tiesFor(queryOf(card, questions), type, field, table, context.tables)
            if (column === null) return card
            tied += 1
            const mapping: CardMapping = { parameter: id, target: { column } }
            return { ...card, mappings: [...(card.mappings ?? []), mapping] }
          }
          const nextCards = cards.map(tie)
          const nextAdded = added.map((c) => tie(c as DashboardCard))
          if (tied === 0) {
            throw new Error(
              field === null
                ? `aucune carte n’est groupée par date pour le filtre « ${name} »`
                : `aucune carte n’a de colonne « ${field} » pour le filtre « ${name} »`,
            )
          }
          const options = field === null ? [] : optionsOf(context.tables, table, field)
          const fallback =
            o.default === undefined ? undefined : checkedFilterValue(parameter, o.default, options)
          if (o.default !== undefined && fallback === undefined) {
            throw new Error(`valeur par défaut invalide pour « ${name} »`)
          }
          cards = nextCards
          added.splice(0, added.length, ...nextAdded)
          parameters.push(fallback === undefined ? parameter : { ...parameter, default: fallback })
          changes.push({
            kind: 'add_filter',
            text: `Ajouter le filtre « ${name} » (${TYPE_WORDS[type]}), relié à ${tied} carte${tied > 1 ? 's' : ''}`,
          })
          break
        }
        case 'add_tab': {
          if (tabs.length >= DASHBOARD_LIMITS.tabs) throw new Error('trop d’onglets')
          const name =
            typeof o.label === 'string' ? cut(o.label.trim(), DASHBOARD_LIMITS.label) : ''
          if (name === '') throw new Error('onglet sans libellé')
          if (tabs.some((t) => fold(t.label) === fold(name))) {
            throw new Error(`l’onglet « ${name} » existe déjà`)
          }
          if (tabs.length === 0) {
            // A first tab: the cards there were belong to a tab of their own from now on.
            const first = { id: context.newId('t'), label: 'Vue d’ensemble' }
            tabs.push(first)
            cards = cards.map((c) => ({ ...c, tab: first.id }))
            for (const [i, c] of added.entries()) added[i] = { ...c, tab: first.id }
          }
          tabs.push({ id: context.newId('t'), label: name })
          changes.push({ kind: 'add_tab', text: `Ajouter l’onglet « ${name} »` })
          break
        }
        case 'rename': {
          const said: string[] = []
          if (typeof o.label === 'string' && o.label.trim() !== '') {
            label = cut(o.label.trim(), 255)
            said.push(`renommer en « ${label} »`)
          }
          if (typeof o.description === 'string') {
            description = o.description.trim() === '' ? null : cut(o.description.trim(), 2000)
            said.push('changer la description')
          }
          if (said.length === 0) throw new Error('rien à renommer')
          changes.push({
            kind: 'rename',
            text: said.join(', ').replace(/^./, (c) => c.toUpperCase()),
          })
          break
        }
        default:
          throw new Error(`opération inconnue (${String(o.op)})`)
      }
    } catch (error) {
      dropped.push(error instanceof Error ? error.message : 'opération écartée')
    }
  }

  // The cards added, placed after the others of their tab, in the order proposed.
  const byTab = new Map<string | null, Array<Omit<DashboardCard, 'x' | 'y'>>>()
  for (const card of added) byTab.set(card.tab, [...(byTab.get(card.tab) ?? []), card])
  const placed: DashboardCard[] = []
  for (const [tab, list] of byTab) {
    placed.push(...(placedAfter(cards, tab, list) as DashboardCard[]))
  }

  return {
    label,
    description,
    content: { tabs, cards: [...cards, ...placed], parameters },
    changes,
    dropped,
  }
}

function optionsOf(
  tables: readonly EditTable[],
  table: EditTable | undefined,
  field: string,
): ReadonlyArray<{ readonly value: string; readonly label: string }> {
  for (const t of table === undefined ? tables : [table]) {
    const found = t.fields.find((f) => f.name === field)
    if (found !== undefined && found.options.length > 0) return found.options
  }
  return []
}

/** The model's values for the filters on screen, checked against them. */
export function checkedFilterValues(
  raw: unknown,
  parameters: readonly DashboardParameter[],
  optionsFor: (parameterId: string) => ReadonlyArray<{ value: string; label: string }>,
): {
  readonly values: Record<string, ParameterValue | null>
  readonly changes: string[]
  readonly dropped: string[]
} {
  const values: Record<string, ParameterValue | null> = {}
  const changes: string[] = []
  const dropped: string[] = []
  for (const [key, value] of Object.entries(record(raw))) {
    const parameter =
      parameters.find((p) => p.id === key) ?? parameters.find((p) => fold(p.label) === fold(key))
    if (parameter === undefined) {
      dropped.push(`filtre inconnu (« ${cut(key, 40)} »)`)
      continue
    }
    const checked = checkedFilterValue(parameter, value, optionsFor(parameter.id))
    if (checked === undefined) {
      dropped.push(`valeur invalide pour le filtre « ${parameter.label} »`)
      continue
    }
    values[parameter.id] = checked
    changes.push(
      checked === null
        ? `${parameter.label} : effacé`
        : `${parameter.label} : ${Array.isArray(checked) ? checked.join(', ') : String(checked)}`,
    )
  }
  return { values, changes, dropped }
}
