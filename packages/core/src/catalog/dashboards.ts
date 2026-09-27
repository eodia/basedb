import {
  CARD_KINDS,
  type CardMapping,
  type ColumnRef,
  DASHBOARD_COLUMNS,
  DASHBOARD_LIMITS,
  type DashboardCard,
  type DashboardParameter,
  type DashboardTab,
  type LegacyBlock,
  NUMBER_OPERATORS,
  PARAMETER_TYPES,
  type ParameterValue,
  type QuestionQuery,
  TEMPORAL_UNITS,
  type TextVariable,
  VISUALIZATIONS,
  type Visualization,
  cardsFromBlocks,
  citedNames,
  columnName,
} from '@basedb/contracts'
import { checkBuilderQuery } from '../analytics/query.js'
import { checkSqlQuery } from '../analytics/sql.js'
import { canReadTable } from '../collab/signals.js'
import { BasedbError } from '../errors/index.js'
import { SYSTEM_COLUMNS } from '../rbac/decide.js'
import { requireOnBase } from '../rbac/require.js'
import { sanitizeRichText } from '../records/rich-text.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Dashboards — chapter 18: cards on a grid of 24 columns, in tabs, under filters that
 * drive the cards tied to them. Each card reads with the rights of whoever looks — a saved
 * question, or one kept in the card alone. What is kept here is only their layout and
 * settings, checked when saved; nothing here opens anything.
 *
 * The first dashboards had blocks on three columns (`blocks`). They are read as cards
 * until the dashboard is saved again, and a creation may still bring blocks — the base
 * templates do (chapter 20).
 */

export const MAX_BLOCKS = 24

export type Block =
  | {
      readonly kind: 'number'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max'
      readonly field: string | null
      readonly filter: string
    }
  | {
      readonly kind: 'chart'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly groupBy: string
      readonly filter: string
      readonly style: 'bar' | 'pie'
    }
  | {
      readonly kind: 'list'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly fields: readonly string[]
      readonly filter: string
      readonly sort: string
      readonly limit: number
    }
  | { readonly kind: 'text'; readonly width: number; readonly title: string; readonly body: string }
  | {
      readonly kind: 'embed'
      readonly width: number
      readonly title: string
      readonly url: string
      readonly height: number
    }

export interface Dashboard {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly position: number
  readonly tabs: readonly DashboardTab[]
  readonly cards: readonly DashboardCard[]
  readonly parameters: readonly DashboardParameter[]
  readonly updatedAt: string
}

export interface DashboardInput {
  readonly label?: unknown
  readonly description?: unknown
  readonly position?: unknown
  readonly tabs?: unknown
  readonly cards?: unknown
  readonly parameters?: unknown
  /** The blocks of chapter 18's first dashboards, translated into cards. */
  readonly blocks?: unknown
}

export const invalid = (field: string, reason: string, detail?: unknown) =>
  new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })

export const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

export type Tables = Map<string, { id: string; name: string; fields: Set<string> }>

/** The live tables of a base, by key, with their fields' names. */
export async function tablesOf(exec: Executor, baseId: string): Promise<Tables> {
  const rows = await exec.query<{ id: string; name: string; field: string | null }>(
    `SELECT t.id::text, tn.name, fn.name AS field
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       LEFT JOIN _basedb.field f ON f.table_id = t.id AND f.is_live
       LEFT JOIN _basedb.physical_name fn ON fn.id = f.name_id
      WHERE t.base_id = $1 AND t.is_live`,
    [baseId],
  )
  const out: Tables = new Map()
  for (const r of rows) {
    const table = out.get(r.id) ?? {
      id: r.id,
      name: r.name,
      fields: new Set<string>(SYSTEM_COLUMNS),
    }
    if (r.field !== null) table.fields.add(r.field)
    out.set(r.id, table)
  }
  return out
}

/**
 * Whether the caller sees a base's dashboards and questions: they read one of its tables,
 * or they build it — a base whose manager has no table yet is still theirs to arrange.
 */
export async function requireSeesBase(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<void> {
  const tables = await exec.query<{ id: string }>(
    'SELECT id::text FROM _basedb.table_def WHERE base_id = $1 AND is_live',
    [baseId],
  )
  for (const t of tables) {
    if (await canReadTable(exec, ctx, t.id)) return
  }
  await requireOnBase(exec, ctx, 'manage_schema', baseId)
}

/**
 * A query checked against the base as it is built: its tables are the base's, the fields
 * it cites exist in them. Whether the reader may read them is decided at each run.
 */
export function checkedQuery(raw: unknown, tables: Tables, at: string): QuestionQuery {
  const kind = typeof raw === 'object' && raw !== null ? (raw as { kind?: unknown }).kind : null
  if (kind === 'sql') return checkSqlQuery(raw, at)
  const query = checkBuilderQuery(raw, at)
  const byAlias = new Map<string, { fields: Set<string> }>()
  const table = (id: string, where: string) => {
    const found = tables.get(id) ?? [...tables.values()].find((t) => t.name === id)
    if (found === undefined) throw invalid(where, 'table_inconnue', id)
    return found
  }
  const source = table(query.source, `${at}.source`)
  byAlias.set('', source)
  const joins = (query.joins ?? []).map((j, i) => {
    const joined = table(j.table, `${at}.joins[${i}].table`)
    byAlias.set(j.alias, joined)
    return { ...j, table: joined.id }
  })
  const field = (ref: ColumnRef, where: string) => {
    const scope = byAlias.get(ref.join ?? '')
    if (scope === undefined || !scope.fields.has(ref.field)) {
      throw invalid(where, 'champ_inconnu', columnName(ref))
    }
  }
  for (const [i, j] of (query.joins ?? []).entries()) {
    field(j.left, `${at}.joins[${i}].left`)
    field({ join: j.alias, field: j.right }, `${at}.joins[${i}].right`)
  }
  for (const [i, f] of (query.filters ?? []).entries()) {
    if ('column' in f) field(f.column, `${at}.filters[${i}]`)
  }
  for (const [i, a] of (query.aggregations ?? []).entries()) {
    if (a.column !== undefined) field(a.column, `${at}.aggregations[${i}]`)
  }
  for (const [i, b] of (query.breakouts ?? []).entries()) field(b, `${at}.breakouts[${i}]`)
  for (const [i, f] of (query.fields ?? []).entries()) field(f, `${at}.fields[${i}]`)
  return { ...query, source: source.id, ...(joins.length === 0 ? {} : { joins }) }
}

/** A visualization: a known type, settings kept as plain data within a bound. */
export function checkedVisualization(raw: unknown, at: string): Visualization {
  if (typeof raw !== 'object' || raw === null) throw invalid(at, 'visualisation_invalide')
  const v = raw as Record<string, unknown>
  if (!(VISUALIZATIONS as readonly unknown[]).includes(v.type)) {
    throw invalid(`${at}.type`, 'visualisation_inconnue', v.type)
  }
  const settings = v.settings === undefined || v.settings === null ? {} : v.settings
  if (typeof settings !== 'object' || Array.isArray(settings)) {
    throw invalid(`${at}.settings`, 'reglages_invalides')
  }
  const json = JSON.stringify(settings)
  if (json.length > 20_000) throw invalid(`${at}.settings`, 'reglages_trop_longs')
  const plain = JSON.parse(json) as Record<string, unknown>
  return {
    type: v.type as Visualization['type'],
    ...(Object.keys(plain).length === 0 ? {} : { settings: plain }),
  }
}

// ── Legacy blocks ───────────────────────────────────────────────────────────

function checkedBlocks(raw: unknown, tables: Tables): Block[] {
  if (!Array.isArray(raw)) throw invalid('blocks', 'liste_attendue')
  if (raw.length > MAX_BLOCKS) throw invalid('blocks', 'trop_de_blocs', MAX_BLOCKS)
  return raw.map((item, index): Block => {
    const b = (item ?? {}) as Record<string, unknown>
    const at = `blocks[${index}]`
    const width = b.width === 2 || b.width === 3 ? b.width : 1
    const title = text(b.title, 120)
    const tableOf = () => {
      const found = [...tables.values()].find((t) => t.id === b.table || t.name === b.table)
      if (found === undefined) throw invalid(`${at}.table`, 'table_inconnue', b.table)
      return found
    }
    const fieldOf = (table: { fields: Set<string> }, value: unknown, key: string) => {
      if (typeof value !== 'string' || !table.fields.has(value)) {
        throw invalid(`${at}.${key}`, 'champ_inconnu', value)
      }
      return value
    }
    switch (b.kind) {
      case 'number': {
        const table = tableOf()
        const aggregate = b.aggregate
        if (
          aggregate !== 'count' &&
          aggregate !== 'sum' &&
          aggregate !== 'avg' &&
          aggregate !== 'min' &&
          aggregate !== 'max'
        ) {
          throw invalid(`${at}.aggregate`, 'agregat_invalide', aggregate)
        }
        const field = aggregate === 'count' ? null : fieldOf(table, b.field, 'field')
        return {
          kind: 'number',
          width,
          title,
          table: table.id,
          aggregate,
          field,
          filter: text(b.filter, 4000),
        }
      }
      case 'chart': {
        const table = tableOf()
        return {
          kind: 'chart',
          width,
          title,
          table: table.id,
          groupBy: fieldOf(table, b.group_by ?? b.groupBy, 'group_by'),
          filter: text(b.filter, 4000),
          style: b.style === 'pie' ? 'pie' : 'bar',
        }
      }
      case 'list': {
        const table = tableOf()
        const fields = Array.isArray(b.fields) ? b.fields : []
        if (fields.length === 0 || fields.length > 6)
          throw invalid(`${at}.fields`, 'un_a_six_champs')
        const limit = typeof b.limit === 'number' ? Math.round(b.limit) : 10
        return {
          kind: 'list',
          width,
          title,
          table: table.id,
          fields: fields.map((f) => fieldOf(table, f, 'fields')),
          filter: text(b.filter, 4000),
          sort: text(b.sort, 200),
          limit: Math.min(Math.max(limit, 1), 20),
        }
      }
      case 'text':
        return { kind: 'text', width, title, body: text(b.body, 5000) }
      case 'embed': {
        const height = typeof b.height === 'number' ? Math.round(b.height) : 400
        return {
          kind: 'embed',
          width,
          title,
          url: checkedUrl(b.url, `${at}.url`),
          height: Math.min(Math.max(height, 200), 1200),
        }
      }
      default:
        throw invalid(`${at}.kind`, 'bloc_inconnu', b.kind)
    }
  })
}

const legacy = (blocks: readonly Block[]): LegacyBlock[] =>
  blocks.map((b) => {
    if (b.kind !== 'chart') return b
    const { groupBy, ...rest } = b
    return { ...rest, group_by: groupBy }
  })

/** A page from elsewhere: `https`, with a host (chapter 18 §2). */
function checkedUrl(raw: unknown, at: string): string {
  const url = text(raw, 2048)
  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }
  if (parsed === null || parsed.protocol !== 'https:' || parsed.hostname === '') {
    throw invalid(at, 'adresse_invalide')
  }
  return url
}

// ── Tabs, filters, cards ────────────────────────────────────────────────────

const ID = /^[A-Za-z0-9_-]{1,40}$/

function checkedTabs(raw: unknown): DashboardTab[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw invalid('tabs', 'liste_attendue')
  if (raw.length > DASHBOARD_LIMITS.tabs)
    throw invalid('tabs', 'trop_d_onglets', DASHBOARD_LIMITS.tabs)
  const ids = new Set<string>()
  return raw.map((item, i) => {
    const t = (item ?? {}) as Record<string, unknown>
    if (typeof t.id !== 'string' || !ID.test(t.id) || ids.has(t.id)) {
      throw invalid(`tabs[${i}].id`, 'identifiant_invalide', t.id)
    }
    ids.add(t.id)
    const label = text(t.label, DASHBOARD_LIMITS.label)
    if (label === '') throw invalid(`tabs[${i}].label`, 'libelle_invalide')
    return { id: t.id, label }
  })
}

function checkedValue(raw: unknown, at: string): ParameterValue | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'string') return raw.slice(0, 500)
  if (
    Array.isArray(raw) &&
    raw.length <= 200 &&
    raw.every(
      (v) => typeof v === 'string' || v === null || (typeof v === 'number' && Number.isFinite(v)),
    )
  ) {
    return raw as ParameterValue
  }
  throw invalid(at, 'valeur_invalide')
}

function checkedParameters(raw: unknown): DashboardParameter[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw invalid('parameters', 'liste_attendue')
  if (raw.length > DASHBOARD_LIMITS.parameters) {
    throw invalid('parameters', 'trop_de_filtres', DASHBOARD_LIMITS.parameters)
  }
  const ids = new Set<string>()
  return raw.map((item, i): DashboardParameter => {
    const at = `parameters[${i}]`
    const p = (item ?? {}) as Record<string, unknown>
    if (typeof p.id !== 'string' || !ID.test(p.id) || ids.has(p.id)) {
      throw invalid(`${at}.id`, 'identifiant_invalide', p.id)
    }
    ids.add(p.id)
    if (!(PARAMETER_TYPES as readonly unknown[]).includes(p.type)) {
      throw invalid(`${at}.type`, 'type_inconnu', p.type)
    }
    const label = text(p.label, DASHBOARD_LIMITS.label)
    if (label === '') throw invalid(`${at}.label`, 'libelle_invalide')
    const value = checkedValue(p.default, `${at}.default`)
    const units = Array.isArray(p.units)
      ? p.units.filter((u): u is (typeof TEMPORAL_UNITS)[number] =>
          (TEMPORAL_UNITS as readonly unknown[]).includes(u),
        )
      : []
    return {
      id: p.id,
      label,
      type: p.type as DashboardParameter['type'],
      ...(value === null ? {} : { default: value }),
      ...(p.multiple === true ? { multiple: true } : {}),
      ...((NUMBER_OPERATORS as readonly unknown[]).includes(p.operator)
        ? { operator: p.operator as DashboardParameter['operator'] }
        : {}),
      ...(units.length === 0 ? {} : { units }),
    }
  })
}

const integer = (value: unknown, at: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(at, 'position_invalide', value)
  }
  return value
}

function checkedCards(
  raw: unknown,
  context: {
    readonly tables: Tables
    readonly questions: ReadonlySet<string>
    readonly tabs: readonly DashboardTab[]
    readonly parameters: readonly DashboardParameter[]
  },
): DashboardCard[] {
  if (!Array.isArray(raw)) throw invalid('cards', 'liste_attendue')
  if (raw.length > DASHBOARD_LIMITS.cards)
    throw invalid('cards', 'trop_de_cartes', DASHBOARD_LIMITS.cards)
  const ids = new Set<string>()
  const tabs = new Set(context.tabs.map((t) => t.id))
  const parameters = new Set(context.parameters.map((p) => p.id))
  // The question cards a text may cite, wherever they come in the list.
  const cited = {
    tables: context.tables,
    questions: context.questions,
    parameters,
    cards: new Set(
      raw.flatMap((item) => {
        const c = (item ?? {}) as Record<string, unknown>
        return c.kind === 'question' && typeof c.id === 'string' ? [c.id] : []
      }),
    ),
  }
  return raw.map((item, i): DashboardCard => {
    const at = `cards[${i}]`
    const c = (item ?? {}) as Record<string, unknown>
    if (typeof c.id !== 'string' || !ID.test(c.id) || ids.has(c.id)) {
      throw invalid(`${at}.id`, 'identifiant_invalide', c.id)
    }
    ids.add(c.id)
    if (!(CARD_KINDS as readonly unknown[]).includes(c.kind)) {
      throw invalid(`${at}.kind`, 'carte_inconnue', c.kind)
    }
    // A card with no tab, or a vanished one, goes to the first: none is left unseen.
    const tab =
      tabs.size === 0
        ? null
        : typeof c.tab === 'string' && tabs.has(c.tab)
          ? c.tab
          : (context.tabs[0]?.id ?? null)
    const x = integer(c.x, `${at}.x`, 0, DASHBOARD_COLUMNS - 1)
    const w = integer(c.w, `${at}.w`, 1, DASHBOARD_COLUMNS - x)
    const y = integer(c.y, `${at}.y`, 0, 10_000)
    const h = integer(c.h, `${at}.h`, 1, DASHBOARD_LIMITS.height)
    const title = text(c.title, DASHBOARD_LIMITS.label)
    const common = { id: c.id, tab, x, y, w, h, ...(title === '' ? {} : { title }) }
    switch (c.kind as DashboardCard['kind']) {
      case 'heading': {
        const body = typeof c.text === 'string' ? c.text.slice(0, DASHBOARD_LIMITS.text) : ''
        return { ...common, kind: 'heading', text: body }
      }
      case 'text':
        return { ...common, kind: 'text', ...checkedText(c, at, cited) }
      case 'embed':
        return { ...common, kind: 'embed', url: checkedUrl(c.url, `${at}.url`) }
      case 'question': {
        let source: { question: string } | { query: QuestionQuery }
        if (typeof c.question === 'string' && c.question !== '') {
          if (!context.questions.has(c.question)) {
            throw invalid(`${at}.question`, 'question_inconnue', c.question)
          }
          source = { question: c.question }
        } else {
          source = { query: checkedQuery(c.query, context.tables, `${at}.query`) }
        }
        const visualization =
          c.visualization === undefined || c.visualization === null
            ? {}
            : { visualization: checkedVisualization(c.visualization, `${at}.visualization`) }
        const mappings = checkedMappings(c.mappings, at, parameters)
        return {
          ...common,
          kind: 'question',
          ...source,
          ...visualization,
          ...(mappings.length === 0 ? {} : { mappings }),
        }
      }
    }
  })
}

/** The filters a card, or a question its text cites, ties — each to a column or a variable. */
function checkedMappings(raw: unknown, at: string, parameters: ReadonlySet<string>): CardMapping[] {
  return (Array.isArray(raw) ? raw : []).map((m, j): CardMapping => {
    const where = `${at}.mappings[${j}]`
    const mapping = (m ?? {}) as Record<string, unknown>
    if (typeof mapping.parameter !== 'string' || !parameters.has(mapping.parameter)) {
      throw invalid(`${where}.parameter`, 'filtre_inconnu', mapping.parameter)
    }
    const target = (mapping.target ?? {}) as Record<string, unknown>
    if (typeof target.variable === 'string' && target.variable !== '') {
      return {
        parameter: mapping.parameter,
        target: { variable: target.variable.slice(0, 63) },
      }
    }
    const column = (target.column ?? {}) as Record<string, unknown>
    if (typeof column.field !== 'string' || column.field === '') {
      throw invalid(`${where}.target`, 'cible_invalide')
    }
    const ref: ColumnRef =
      typeof column.join === 'string' && column.join !== ''
        ? { join: column.join, field: column.field }
        : { field: column.field }
    return { parameter: mapping.parameter, target: { column: ref } }
  })
}

/** The name a text cites a value by: `{{nom}}`. */
const VARIABLE_NAME = /^[a-z0-9_]{1,63}$/

/**
 * A text card's text, and the values it cites. A rich text is sanitized as a long text's
 * is (chapter 04 §2.2) — the same profile, on write; a Markdown one is kept as typed. A
 * variable the text no longer cites goes, whatever it named.
 */
function checkedText(
  c: Record<string, unknown>,
  at: string,
  context: {
    readonly tables: Tables
    /** The saved queries of the whole base. */
    readonly questions: ReadonlySet<string>
    readonly parameters: ReadonlySet<string>
    /** The question cards of the dashboard. */
    readonly cards: ReadonlySet<string>
  },
): Pick<DashboardCard, 'text' | 'rich' | 'variables'> {
  const { parameters } = context
  const raw = typeof c.text === 'string' ? c.text : ''
  const rich = c.rich === true
  const body = rich ? sanitizeRichText(raw) : raw.slice(0, DASHBOARD_LIMITS.text)
  if (rich && body.length > DASHBOARD_LIMITS.html) {
    throw invalid(`${at}.text`, 'texte_trop_long', DASHBOARD_LIMITS.html)
  }
  const cited = new Set(citedNames(body))
  const names = new Set<string>()
  const variables = (Array.isArray(c.variables) ? c.variables : []).flatMap(
    (item, j): TextVariable[] => {
      const where = `${at}.variables[${j}]`
      const v = (item ?? {}) as Record<string, unknown>
      if (typeof v.name !== 'string' || !VARIABLE_NAME.test(v.name) || names.has(v.name)) {
        throw invalid(`${where}.name`, 'nom_invalide', v.name)
      }
      names.add(v.name)
      if (!cited.has(v.name)) return []
      if (typeof v.parameter === 'string') {
        if (!parameters.has(v.parameter)) {
          throw invalid(`${where}.parameter`, 'filtre_inconnu', v.parameter)
        }
        return [{ name: v.name, parameter: v.parameter }]
      }
      if (typeof v.card === 'string') {
        if (!context.cards.has(v.card)) throw invalid(`${where}.card`, 'carte_inconnue', v.card)
        return [{ name: v.name, card: v.card }]
      }
      const mappings = checkedMappings(v.mappings, where, parameters)
      const tied = mappings.length === 0 ? {} : { mappings }
      // A query of one's own goes in by its content, as into a card: checked the same way.
      if (v.query !== undefined && v.query !== null) {
        const label = text(v.label, DASHBOARD_LIMITS.label)
        return [
          {
            name: v.name,
            query: checkedQuery(v.query, context.tables, `${where}.query`),
            ...(label === '' ? {} : { label }),
            ...(v.visualization === undefined || v.visualization === null
              ? {}
              : { visualization: checkedVisualization(v.visualization, `${where}.visualization`) }),
            ...tied,
          },
        ]
      }
      if (typeof v.question !== 'string' || !context.questions.has(v.question)) {
        throw invalid(`${where}.question`, 'question_inconnue', v.question)
      }
      return [{ name: v.name, question: v.question, ...tied }]
    },
  )
  if (variables.length > DASHBOARD_LIMITS.variables) {
    throw invalid(`${at}.variables`, 'trop_de_variables', DASHBOARD_LIMITS.variables)
  }
  return {
    text: body,
    ...(rich ? { rich: true } : {}),
    ...(variables.length === 0 ? {} : { variables }),
  }
}

// ── Storage ─────────────────────────────────────────────────────────────────

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly position: number
  readonly blocks: Block[]
  readonly tabs: DashboardTab[]
  readonly cards: DashboardCard[] | null
  readonly parameters: DashboardParameter[]
  readonly updated_at: string
}

const COLUMNS =
  'id::text, label, description, position, blocks, tabs, cards, parameters, updated_at::text'

const shaped = (r: Row): Dashboard => ({
  id: r.id,
  label: r.label,
  description: r.description,
  position: r.position,
  tabs: r.tabs,
  cards: r.cards ?? cardsFromBlocks(legacy(r.blocks)),
  parameters: r.parameters,
  updatedAt: r.updated_at,
})

/** One live dashboard of a base, or `null` — read with no check: the caller made it. */
export async function readDashboard(
  exec: Executor,
  baseId: string,
  id: string,
): Promise<Dashboard | null> {
  const [row] = await exec.query<Row>(
    `SELECT ${COLUMNS}
       FROM _basedb.dashboard
      WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL`,
    [id, baseId],
  )
  return row === undefined ? null : shaped(row)
}

/**
 * The queries a card may place: those of the whole base — whoever sees the dashboard
 * sees what its cards run. A personal query goes into a card by its content.
 */
async function questionsOf(exec: Executor, baseId: string): Promise<Set<string>> {
  const rows = await exec.query<{ id: string }>(
    `SELECT id::text FROM _basedb.question
      WHERE base_id = $1 AND deleted_at IS NULL AND audience = 'base'`,
    [baseId],
  )
  return new Set(rows.map((r) => r.id))
}

/** What a dashboard is made of, checked — from new cards, or from blocks of old. */
export async function checkedContent(
  exec: Executor,
  baseId: string,
  input: DashboardInput,
  current: {
    tabs: readonly DashboardTab[]
    cards: readonly DashboardCard[]
    parameters: readonly DashboardParameter[]
  },
) {
  const tabs = input.tabs === undefined ? current.tabs : checkedTabs(input.tabs)
  const parameters =
    input.parameters === undefined ? current.parameters : checkedParameters(input.parameters)
  let cards: readonly DashboardCard[] = current.cards
  if (
    input.cards !== undefined ||
    input.blocks !== undefined ||
    input.tabs !== undefined ||
    input.parameters !== undefined
  ) {
    const tables = await tablesOf(exec, baseId)
    const raw =
      input.cards !== undefined
        ? input.cards
        : input.blocks !== undefined
          ? cardsFromBlocks(legacy(checkedBlocks(input.blocks, tables)))
          : current.cards
    cards = checkedCards(raw, {
      tables,
      questions: await questionsOf(exec, baseId),
      tabs,
      parameters,
    })
  }
  return { tabs, cards, parameters }
}

/**
 * The dashboards of a base, for whoever sees it — who may read at least one of its tables.
 * The cards keep their silence themselves, on the reader's rights.
 */
export async function listDashboards(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Dashboard[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireSeesBase(exec, ctx, request.baseId)
      const rows = await exec.query<Row>(
        `SELECT ${COLUMNS}
           FROM _basedb.dashboard
          WHERE base_id = $1 AND deleted_at IS NULL
          ORDER BY position, created_at`,
        [request.baseId],
      )
      return rows.map(shaped)
    },
    { readOnly: true },
  )
}

export async function createDashboard(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly input: DashboardInput },
): Promise<Dashboard> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const label = text(request.input.label, 255)
    if (label === '') throw invalid('label', 'libelle_invalide')
    const content = await checkedContent(exec, request.baseId, request.input, {
      tabs: [],
      cards: [],
      parameters: [],
    })
    const [row] = await exec.query<Row>(
      `INSERT INTO _basedb.dashboard
         (base_id, label, description, position, blocks, tabs, cards, parameters, created_by, updated_by)
       SELECT $1, $2, $3, coalesce(max(position), 0) + 1, '[]'::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $7
         FROM _basedb.dashboard WHERE base_id = $1 AND deleted_at IS NULL
       RETURNING ${COLUMNS}`,
      [
        request.baseId,
        label,
        text(request.input.description, 2000) || null,
        JSON.stringify(content.tabs),
        JSON.stringify(content.cards),
        JSON.stringify(content.parameters),
        ctx.actor.id,
      ],
      'insert',
    )
    return shaped(row as Row)
  })
}

export async function updateDashboard(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string; readonly input: DashboardInput },
): Promise<Dashboard> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const [found] = await exec.query<Row>(
      `SELECT ${COLUMNS}
         FROM _basedb.dashboard
        WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL`,
      [request.id, request.baseId],
    )
    if (found === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { dashboard: request.id } })
    }
    const current = shaped(found)
    const input = request.input
    const label = input.label === undefined ? current.label : text(input.label, 255)
    if (label === '') throw invalid('label', 'libelle_invalide')
    const description =
      input.description === undefined ? current.description : text(input.description, 2000) || null
    const content = await checkedContent(exec, request.baseId, input, current)
    const position =
      typeof input.position === 'number' ? Math.round(input.position) : current.position
    const [row] = await exec.query<Row>(
      `UPDATE _basedb.dashboard
          SET label = $2, description = $3, blocks = '[]'::jsonb, tabs = $4::jsonb,
              cards = $5::jsonb, parameters = $6::jsonb, position = $7,
              updated_by = $8, updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [
        found.id,
        label,
        description,
        JSON.stringify(content.tabs),
        JSON.stringify(content.cards),
        JSON.stringify(content.parameters),
        position,
        ctx.actor.id,
      ],
      'update',
    )
    return shaped(row as Row)
  })
}

export async function deleteDashboard(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const rows = await exec.query(
      `UPDATE _basedb.dashboard SET deleted_at = pg_catalog.clock_timestamp()
        WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [request.id, request.baseId],
      'update',
    )
    if (rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { dashboard: request.id } })
    }
  })
}
