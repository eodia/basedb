import {
  FORM_ALIGNS,
  FORM_CONDITION_OPS,
  FORM_FONTS,
  FORM_PREFILLS,
  FORM_PREFILL_KINDS,
  FORM_THEMES,
  type FormCondition,
  type FormPrefill,
  QUIZ_KINDS,
  QUIZ_MAX_POINTS,
  QUIZ_REVEALS,
  type QuizAnswer,
  conditionNeedsValue,
  quizAnswerFits,
} from '@basedb/contracts'
import { BasedbError } from '../errors/index.js'
import { type ActorGrants, decide } from '../rbac/decide.js'
import { loadTarget } from '../rbac/loader.js'
import { requireOnTable } from '../rbac/require.js'
import { type Aggregate, GROUPABLE, aggregatesFor } from '../records/aggregate.js'
import { BUDGETS, OPERATORS } from '../records/filter.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { normalizeDescription } from './description.js'
import { labelKey } from './operations.js'

/**
 * Saved views — `_basedb.view_def`, chapter 02 and chapter 11 §1.4.
 *
 * A view is a PRESENTATION of one table: how its rows are shown — a grid, a kanban, a
 * calendar, a timeline — or how a row is asked for — a form, a survey, a quiz. It holds no data
 * and no right of its own (chapter 05 §9): reading a view is reading its table, and
 * building one is `manage_schema`, like building the table. Views are shared at the scale
 * of the table; there is no personal view.
 *
 * `spec` is the whole configuration, and its shape depends on `kind`. It names fields by
 * their physical name, like the filter it carries. Two moments treat it differently:
 *
 *   à l'écriture, il est VALIDÉ — clés connues, types des valeurs, champs vivants et lisibles
 *   par l'auteur, et le type des champs pivots (un kanban se range sur une liste de choix,
 *   un calendrier sur une date) ;
 *   à la lecture, il est REPROJETÉ pour le lecteur — un champ qu'il ne voit pas en disparaît,
 *   comme de la grille, et un filtre qui en cite un rend la vue inaffichable plutôt que
 *   silencieusement plus large.
 */

export const VIEW_KINDS = [
  'grid',
  'kanban',
  'calendar',
  'timeline',
  'gallery',
  'list',
  'form',
  'survey',
  'quiz',
  'map',
] as const

export type ViewKind = (typeof VIEW_KINDS)[number]

/** A view as the API returns it — its spec already cut down to what the reader sees. */
export interface SavedView {
  readonly id: string
  readonly label: string
  readonly kind: ViewKind
  readonly description: string | null
  readonly position: number
  readonly spec: Readonly<Record<string, unknown>>
  /**
   * The filter cites a field this reader cannot see — or one that no longer exists, which
   * reads the same. The view is not shown rather than shown unfiltered: an ignored filter
   * widens the result, which is worse than a refusal (chapter 06 §4).
   */
  readonly filterHidden: boolean
  /** Its owner's alone: seen, changed and deleted by them only (chapter 11 §1.6). */
  readonly personal: boolean
  /** Changes are refused until it is unlocked (`VIEW_LOCKED`). */
  readonly locked: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

const MAX_LABEL_CHARS = 255
/** A spec is a configuration, not a document: 64 KiB is far more than any view needs. */
const MAX_SPEC_BYTES = 64 * 1024

/** A card's description, variables included (chapter 11 §1.6). */
export const MAX_CARD_TEMPLATE_CHARS = 500

/**
 * A variable of a card's description: `{{nom_du_champ}}`, spaces allowed inside the
 * braces. What it names is checked like any field of a spec.
 */
const TEMPLATE_VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g
const MAX_SORTS = 3
const MIN_WIDTH = 64
const MAX_WIDTH = 640
const MAX_PAGE = 500
/** A list of choices holds 200 at most (chapter 04 §3): so does the order of its columns. */
const MAX_OPTIONS = 200
const MAX_COLOR_RULES = 20
/** Rows a view orders by hand: past this, a sort says it better. */
const MAX_MANUAL_ORDER = 5000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** How tall a grid's rows are: one line, two, four, six. */
const ROW_HEIGHTS = ['short', 'medium', 'tall', 'extra'] as const
/**
 * How a coloured row shows its colour: a stripe at its left, a tinted background, or both.
 * Each colour rule has its own; `color_style` is that of the colour a list gives.
 */
const COLOR_STYLES = ['both', 'stripe', 'background'] as const
type ColorStyle = (typeof COLOR_STYLES)[number]

const DATES = ['date', 'datetime'] as const
/** What a map places a row by: an address, or a latitude and a longitude (chapter 11 §1.9). */
const PLACES = ['short_text', 'long_text', 'formula', 'lookup'] as const
const COORDINATES = ['number', 'formula', 'lookup', 'rollup'] as const
/** A form writes rows: a computed column has nothing to be typed into. */
const NOT_ASKABLE = ['formula', 'autonumber', 'lookup', 'rollup', 'count', 'button']

/**
 * The system columns a view may name — to sort by, to filter on, to show in a grid —, with
 * the kind they read as: a date and time, a person (chapter 04 §2.10). Every reader of the
 * table reads them (A18); `_id` is left out, being nothing one sorts or looks at.
 */
const SYSTEM_VIEW_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['_created_at', 'datetime'],
  ['_updated_at', 'datetime'],
  ['_created_by', 'user'],
  ['_updated_by', 'user'],
]
const SYSTEM_NAMES = SYSTEM_VIEW_COLUMNS.map(([name]) => name)

/** The live fields of a table the reader sees: physical name → kind. */
type Readable = ReadonlyMap<string, string>

function refuse(reason: string, detail?: string): never {
  throw new BasedbError('REQUEST_INVALID', {
    details: { field: 'spec', reason, ...(detail === undefined ? {} : { detail }) },
  })
}

/**
 * Reads a raw spec key by key, and refuses whatever is left over: a key nobody reads is a
 * typo someone will spend an afternoon looking for.
 */
class SpecReader {
  private readonly seen = new Set<string>()

  constructor(
    private readonly raw: Readonly<Record<string, unknown>>,
    private readonly fields: Readable,
  ) {}

  private take(key: string): unknown {
    this.seen.add(key)
    return this.raw[key]
  }

  text(key: string, max: number): string {
    const value = this.take(key)
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string' || value.includes('\u0000')) refuse('valeur_invalide', key)
    const text = value.replace(/\r\n?/g, '\n').normalize('NFC').trim()
    if ([...text].length > max) refuse('texte_trop_long', key)
    return text
  }

  flag(key: string, fallback: boolean): boolean {
    const value = this.take(key)
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'boolean') refuse('valeur_invalide', key)
    return value
  }

  choice<T extends string>(key: string, values: readonly T[], fallback: T): T {
    const value = this.take(key)
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
      refuse('valeur_invalide', key)
    }
    return value as T
  }

  /** A colour, `#rrggbb` in lower case — or `''`, which leaves the choice to the screen. */
  color(key: string): string {
    const value = this.take(key)
    if (value === undefined || value === null || value === '') return ''
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      refuse('valeur_invalide', key)
    }
    return value.toLowerCase()
  }

  /** An address to follow, `https://` or `http://` — or `''`. */
  link(key: string): string {
    const value = this.take(key)
    if (value === undefined || value === null || value === '') return ''
    if (typeof value !== 'string' || value.length > 2000 || !/^https?:\/\/\S+$/i.test(value)) {
      refuse('valeur_invalide', key)
    }
    return value
  }

  integer(key: string, min: number, max: number, fallback: number): number {
    const value = this.take(key)
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      refuse('valeur_invalide', key)
    }
    return value
  }

  /** A field of the table, of one of `kinds` when given. */
  field(key: string, kinds: readonly string[] | null, required: boolean): string | null {
    const value = this.take(key)
    if (value === undefined || value === null || value === '') {
      if (required) refuse('champ_pivot_manquant', key)
      return null
    }
    if (typeof value !== 'string') refuse('valeur_invalide', key)
    return this.check(value, kinds)
  }

  fieldList(key: string, kinds: readonly string[] | null = null): string[] {
    const value = this.take(key)
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) refuse('valeur_invalide', key)
    const names = value.map((name) => {
      if (typeof name !== 'string') refuse('valeur_invalide', key)
      return this.check(name, kinds)
    })
    const repeated = names.find((n, i) => names.indexOf(n) !== i)
    if (repeated !== undefined) refuse('doublon', repeated)
    return names
  }

  /**
   * An order of ROWS, by `_id` — a view ordered by hand (chapter 11 §1.6). Not checked
   * against the table: a row deleted since is skipped when drawn, one created since goes
   * after the others.
   */
  rowList(key: string): string[] {
    const value = this.take(key)
    if (value === undefined || value === null) return []
    if (!Array.isArray(value) || value.length > MAX_MANUAL_ORDER) refuse('valeur_invalide', key)
    const ids = value.map((v) => {
      if (typeof v !== 'string' || !UUID.test(v)) refuse('valeur_invalide', key)
      return v.toLowerCase()
    })
    const repeated = ids.find((id, i) => ids.indexOf(id) !== i)
    if (repeated !== undefined) refuse('doublon', repeated)
    return ids
  }

  /**
   * An order of VALUES — the choices of a list, not fields. Not checked against the list:
   * a choice removed since is simply skipped when drawn, and one added since goes last.
   */
  valueList(key: string, max: number): string[] {
    const value = this.take(key)
    if (value === undefined || value === null) return []
    if (!Array.isArray(value) || value.length > max) refuse('valeur_invalide', key)
    const values = value.map((v) => {
      if (typeof v !== 'string' || v.length > MAX_LABEL_CHARS) refuse('valeur_invalide', key)
      return v
    })
    const repeated = values.find((v, i) => values.indexOf(v) !== i)
    if (repeated !== undefined) refuse('doublon', repeated)
    return values
  }

  /**
   * A text with variables — a card's description. Each `{{…}}` must name a field the
   * author reads, like every field a spec names; it is kept as `{{nom}}`, spaces gone.
   */
  template(key: string, max: number): string {
    const text = this.text(key, max)
    return text.replace(
      TEMPLATE_VARIABLE,
      (_whole, name: string) => `{{${this.check(name, null)}}}`,
    )
  }

  private check(name: string, kinds: readonly string[] | null): string {
    const kind = this.fields.get(name)
    if (kind === undefined) refuse('champ_inconnu', name)
    if (kinds !== null && !kinds.includes(kind)) refuse('type_de_champ_incompatible', name)
    return name
  }

  filter(): string {
    const value = this.take('filter')
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string' || value.includes('\u0000')) refuse('valeur_invalide', 'filter')
    const text = value.trim()
    if (Buffer.byteLength(text, 'utf8') > BUDGETS.bytes) refuse('texte_trop_long', 'filter')
    return text
  }

  sorts(): Array<{ field: string; direction: 'asc' | 'desc' }> {
    const value = this.take('sorts')
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) refuse('valeur_invalide', 'sorts')
    if (value.length > MAX_SORTS) refuse('trop_de_tris')
    const terms = value.map((term) => {
      if (typeof term !== 'object' || term === null) refuse('valeur_invalide', 'sorts')
      const { field, direction } = term as { field?: unknown; direction?: unknown }
      if (typeof field !== 'string') refuse('valeur_invalide', 'sorts')
      if (direction !== 'asc' && direction !== 'desc') refuse('valeur_invalide', 'sorts')
      return { field: this.check(field, null), direction: direction as 'asc' | 'desc' }
    })
    const repeated = terms.find((t, i) => terms.findIndex((u) => u.field === t.field) !== i)
    if (repeated !== undefined) refuse('doublon', repeated.field)
    return terms
  }

  widths(): Record<string, number> {
    const value = this.take('column_widths')
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object' || Array.isArray(value))
      refuse('valeur_invalide', 'column_widths')
    const out: Record<string, number> = {}
    for (const [name, width] of Object.entries(value as Record<string, unknown>)) {
      this.check(name, null)
      if (typeof width !== 'number' || !Number.isFinite(width)) {
        refuse('valeur_invalide', 'column_widths')
      }
      out[name] = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
    }
    return out
  }

  /** The summary bar: one aggregate per column, of those its type allows. */
  summaries(): Record<string, string> {
    const value = this.take('summaries')
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object' || Array.isArray(value)) refuse('valeur_invalide', 'summaries')
    const out: Record<string, string> = {}
    for (const [name, fn] of Object.entries(value as Record<string, unknown>)) {
      this.check(name, null)
      const kind = this.fields.get(name) as string
      if (typeof fn !== 'string' || !aggregatesFor(kind).includes(fn as Aggregate)) {
        refuse('valeur_invalide', 'summaries')
      }
      out[name] = fn
    }
    return out
  }

  /**
   * Conditional colours: rows that match a filter take a colour. Their filters are only
   * checked for size here — a rule citing an unknown field matches nothing on screen,
   * like a view's filter would fail, and the projection drops it for a reader who cannot
   * see a field it cites.
   */
  colorRules(): Array<{ filter: string; color: string; style: ColorStyle }> {
    const value = this.take('color_rules')
    if (value === undefined || value === null) return []
    if (!Array.isArray(value) || value.length > MAX_COLOR_RULES) {
      refuse('valeur_invalide', 'color_rules')
    }
    return value.map((rule) => {
      if (typeof rule !== 'object' || rule === null) refuse('valeur_invalide', 'color_rules')
      const { filter, color, style } = rule as {
        filter?: unknown
        color?: unknown
        style?: unknown
      }
      if (typeof filter !== 'string' || Buffer.byteLength(filter, 'utf8') > BUDGETS.bytes) {
        refuse('valeur_invalide', 'color_rules')
      }
      if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
        refuse('valeur_invalide', 'color_rules')
      }
      // Each rule shows its colour its own way: a stripe, a background, or both.
      if (
        style !== undefined &&
        style !== null &&
        !(COLOR_STYLES as readonly unknown[]).includes(style)
      ) {
        refuse('valeur_invalide', 'color_rules')
      }
      return {
        filter: filter.trim(),
        color: color.toLowerCase(),
        style: (style ?? 'both') as ColorStyle,
      }
    })
  }

  /** System columns only, each named once. */
  systemColumns(): string[] {
    const names = this.fieldList('system_columns')
    const other = names.find((name) => !SYSTEM_NAMES.includes(name))
    if (other !== undefined) refuse('type_de_champ_incompatible', other)
    return names
  }

  /**
   * The questions of a form: which fields, in which order, and how each is asked — its
   * words, an example of an answer, what it holds before one, and when it is asked at all.
   * A quiz's may carry their right answer and what it is worth.
   */
  questions(quiz = false): Array<{
    field: string
    required: boolean
    label: string
    help: string
    placeholder: string
    prefill: FormPrefill | null
    show_if: FormCondition | null
    correct?: QuizAnswer | null
    points?: number
  }> {
    const value = this.take('fields')
    if (!Array.isArray(value)) refuse('valeur_invalide', 'fields')
    if (value.length === 0) refuse('formulaire_vide')
    const earlier = new Set<string>()
    const questions = value.map((entry) => {
      if (typeof entry !== 'object' || entry === null) refuse('valeur_invalide', 'fields')
      const item = new SpecReader(entry as Record<string, unknown>, this.fields)
      const field = item.field('field', null, true) as string
      if (NOT_ASKABLE.includes(this.fields.get(field) ?? '') || SYSTEM_NAMES.includes(field)) {
        refuse('type_de_champ_incompatible', field)
      }
      const question = {
        field,
        required: item.flag('required', false),
        label: item.text('label', MAX_LABEL_CHARS),
        help: item.text('help', 1000),
        placeholder: item.text('placeholder', MAX_LABEL_CHARS),
        prefill: item.prefill(this.fields.get(field) ?? ''),
        show_if: item.condition(earlier),
        ...(quiz
          ? {
              correct: item.correct(this.fields.get(field) ?? ''),
              points: item.integer('points', 1, QUIZ_MAX_POINTS, 1),
            }
          : {}),
      }
      item.finish()
      earlier.add(field)
      return question
    })
    const repeated = questions.find((q, i) => questions.findIndex((r) => r.field === q.field) !== i)
    if (repeated !== undefined) refuse('doublon', repeated.field)
    return questions
  }

  /**
   * A quiz question's right answer, in the shape its field's kind expects — `null`: the
   * question is asked, not graded. A choice is not checked against the list: one removed
   * since is simply never picked, as a condition's value is.
   */
  correct(kind: string): QuizAnswer | null {
    const value = this.take('correct')
    if (value === undefined || value === null) return null
    if (!QUIZ_KINDS.includes(kind)) refuse('type_de_champ_incompatible', 'correct')
    const tidied = Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.normalize('NFC').trim() : v))
      : value
    if (!quizAnswerFits(kind, tidied)) refuse('valeur_invalide', 'correct')
    return tidied
  }

  /** The pass mark of a quiz, in percent — `null`: none. */
  percent(key: string): number | null {
    const value = this.take(key)
    if (value === undefined || value === null) return null
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) {
      refuse('valeur_invalide', key)
    }
    return value
  }

  /** What a question holds before an answer: the day, and only in a date question. */
  prefill(kind: string): FormPrefill | null {
    const value = this.take('prefill')
    if (value === undefined || value === null) return null
    if (typeof value !== 'string' || !(FORM_PREFILLS as readonly string[]).includes(value)) {
      refuse('valeur_invalide', 'prefill')
    }
    if (!FORM_PREFILL_KINDS.includes(kind)) refuse('type_de_champ_incompatible', 'prefill')
    return value as FormPrefill
  }

  /**
   * « Show this question only if… »: it reads an EARLIER question — a later one would ask
   * the person to answer in an order the screen does not follow.
   */
  condition(earlier: ReadonlySet<string>): FormCondition | null {
    const value = this.take('show_if')
    if (value === undefined || value === null) return null
    if (typeof value !== 'object' || Array.isArray(value)) refuse('valeur_invalide', 'show_if')
    const raw = value as Record<string, unknown>
    const extra = Object.keys(raw).find((key) => !['field', 'op', 'value'].includes(key))
    if (extra !== undefined) refuse('cle_inconnue', `show_if.${extra}`)
    const field = raw.field
    if (typeof field !== 'string' || !earlier.has(field)) refuse('condition_invalide', 'show_if')
    const op = raw.op
    if (typeof op !== 'string' || !(FORM_CONDITION_OPS as readonly string[]).includes(op)) {
      refuse('valeur_invalide', 'show_if.op')
    }
    const typed = op as FormCondition['op']
    const given = raw.value ?? null
    if (conditionNeedsValue(typed)) {
      const ok =
        typeof given === 'boolean' ||
        (typeof given === 'number' && Number.isFinite(given)) ||
        (typeof given === 'string' && given.trim() !== '' && [...given].length <= 255)
      if (!ok) refuse('valeur_invalide', 'show_if.value')
      if ((typed === 'gte' || typed === 'lte') && typeof given !== 'number') {
        refuse('valeur_invalide', 'show_if.value')
      }
    }
    return {
      field,
      op: typed,
      value: conditionNeedsValue(typed) ? (given as string | number | boolean) : null,
    }
  }

  finish(): void {
    const unknown = Object.keys(this.raw).find((key) => !this.seen.has(key))
    if (unknown !== undefined) refuse('cle_inconnue', unknown)
  }
}

const DATA_KEYS = ['filter', 'sorts']
const CARD_KEYS = ['title_field', 'card_fields', 'color_field']
const FORM_KEYS = [
  'title',
  'description',
  'fields',
  'submit_label',
  'success_message',
  'allow_another',
  'theme',
  'accent',
  'font',
  'align',
  'welcome_label',
  'show_progress',
  'show_numbers',
  'auto_advance',
  'celebrate',
  'end_link_label',
  'end_link_url',
]

/** The keys a spec may carry, per kind. */
const SPEC_KEYS: Readonly<Record<ViewKind, readonly string[]>> = {
  grid: [
    ...DATA_KEYS,
    'hidden',
    'pinned',
    'column_order',
    'column_widths',
    'page_size',
    'group_by',
    'summaries',
    'row_height',
    'color_field',
    'color_rules',
    'color_style',
    'system_columns',
  ],
  kanban: [
    ...DATA_KEYS,
    'group_by',
    'group_order',
    'title_field',
    'card_fields',
    'card_template',
    'cover_field',
    'hide_empty',
    'manual_order',
  ],
  calendar: [...DATA_KEYS, ...CARD_KEYS, 'date_field', 'end_field', 'mode'],
  timeline: [
    ...DATA_KEYS,
    ...CARD_KEYS,
    'start_field',
    'end_field',
    'group_by',
    'scale',
    'depends_on',
  ],
  gallery: [...DATA_KEYS, ...CARD_KEYS, 'cover_field', 'cover_fit', 'card_size', 'manual_order'],
  list: [...DATA_KEYS, 'title_field', 'card_fields', 'group_by', 'manual_order'],
  form: FORM_KEYS,
  survey: FORM_KEYS,
  quiz: [...FORM_KEYS, 'score_field', 'reveal', 'pass_percent'],
  map: [...DATA_KEYS, ...CARD_KEYS, 'address_field', 'latitude_field', 'longitude_field'],
}

/**
 * Turns what a caller sent into the spec the catalog stores, for one kind of view.
 *
 * Exported for the unit tests: the rules are the kernel's, and a test that goes through
 * HTTP to check that a kanban refuses a date field would test the network, not the rule.
 */
export function normalizeViewSpec(
  kind: ViewKind,
  raw: unknown,
  fields: Readable,
  /** The relations of the table to itself: what a timeline's dependencies may follow. */
  selfLinks: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const source = raw === undefined || raw === null ? {} : raw
  if (typeof source !== 'object' || Array.isArray(source)) refuse('spec_invalide')
  if (Buffer.byteLength(JSON.stringify(source), 'utf8') > MAX_SPEC_BYTES) {
    refuse('spec_trop_volumineux')
  }
  // The keys first: `date` for `date_field` is a typo, and the refusal must say THAT rather
  // than the missing pivot it leads to.
  const unknown = Object.keys(source).find((key) => !SPEC_KEYS[kind].includes(key))
  if (unknown !== undefined) refuse('cle_inconnue', unknown)
  const read = new SpecReader(source as Record<string, unknown>, fields)

  const spec = ((): Record<string, unknown> => {
    switch (kind) {
      case 'grid':
        return {
          filter: read.filter(),
          sorts: read.sorts(),
          hidden: read.fieldList('hidden'),
          pinned: read.fieldList('pinned'),
          column_order: read.fieldList('column_order'),
          column_widths: read.widths(),
          page_size: read.integer('page_size', 1, MAX_PAGE, 100),
          // Rows grouped by one field, their groups counted over the whole filter.
          group_by: read.field('group_by', GROUPABLE, false),
          summaries: read.summaries(),
          row_height: read.choice('row_height', ROW_HEIGHTS, 'short'),
          // A row takes the colour of its choice in this list — unless a rule says otherwise.
          color_field: read.field('color_field', ['select'], false),
          color_rules: read.colorRules(),
          // How the colour the list gives shows; each rule carries its own style.
          color_style: read.choice('color_style', COLOR_STYLES, 'both'),
          // The system columns shown: hidden unless asked for, where a field shows unless hidden.
          system_columns: read.systemColumns(),
        }
      case 'kanban':
        return {
          filter: read.filter(),
          sorts: read.sorts(),
          group_by: read.field('group_by', ['select'], true),
          // The order of the columns: the view's, not the list's — reordering a board
          // must not reorder the choices everywhere else they are offered.
          group_order: read.valueList('group_order', MAX_OPTIONS),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          // A description under the title, the row's values in place of its variables.
          card_template: read.template('card_template', MAX_CARD_TEMPLATE_CHARS),
          cover_field: read.field('cover_field', ['file', 'image'], false),
          hide_empty: read.flag('hide_empty', false),
          // Cards in the order they were dragged, when no sort says otherwise.
          manual_order: read.rowList('manual_order'),
        }
      case 'calendar': {
        const spec = {
          filter: read.filter(),
          sorts: read.sorts(),
          date_field: read.field('date_field', DATES, true),
          end_field: read.field('end_field', DATES, false),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          color_field: read.field('color_field', ['select'], false),
          mode: read.choice('mode', ['month', 'week'] as const, 'month'),
        }
        if (spec.end_field !== null && spec.end_field === spec.date_field) {
          refuse('doublon', spec.end_field)
        }
        return spec
      }
      case 'timeline': {
        const spec = {
          filter: read.filter(),
          sorts: read.sorts(),
          start_field: read.field('start_field', DATES, true),
          end_field: read.field('end_field', DATES, false),
          group_by: read.field('group_by', ['select', 'link'], false),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          color_field: read.field('color_field', ['select'], false),
          scale: read.choice('scale', ['day', 'week', 'month'] as const, 'week'),
          // « Dépend de »: a relation of the table to itself, drawn as arrows.
          depends_on: read.field('depends_on', ['link', 'multi_link'], false),
        }
        if (spec.end_field !== null && spec.end_field === spec.start_field) {
          refuse('doublon', spec.end_field)
        }
        if (spec.depends_on !== null && !selfLinks.has(spec.depends_on)) {
          refuse('type_de_champ_incompatible', spec.depends_on)
        }
        return spec
      }
      case 'gallery':
        return {
          filter: read.filter(),
          sorts: read.sorts(),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          color_field: read.field('color_field', ['select'], false),
          cover_field: read.field('cover_field', ['file', 'image'], false),
          cover_fit: read.choice('cover_fit', ['cover', 'contain'] as const, 'cover'),
          card_size: read.choice('card_size', ['small', 'medium', 'large'] as const, 'medium'),
          manual_order: read.rowList('manual_order'),
        }
      case 'map': {
        const spec = {
          filter: read.filter(),
          sorts: read.sorts(),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          color_field: read.field('color_field', ['select'], false),
          address_field: read.field('address_field', PLACES, false),
          latitude_field: read.field('latitude_field', COORDINATES, false),
          longitude_field: read.field('longitude_field', COORDINATES, false),
        }
        // A row is placed by its address, or by its two coordinates: one of the two is asked.
        if (
          spec.address_field === null &&
          (spec.latitude_field === null || spec.longitude_field === null)
        ) {
          refuse('champ_pivot_manquant', 'address_field')
        }
        if (spec.latitude_field !== null && spec.latitude_field === spec.longitude_field) {
          refuse('doublon', spec.latitude_field)
        }
        return spec
      }
      case 'list':
        return {
          filter: read.filter(),
          sorts: read.sorts(),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          group_by: read.field('group_by', ['select', 'link', 'user'], false),
          manual_order: read.rowList('manual_order'),
        }
      case 'quiz': {
        const questions = read.questions(true)
        const spec = {
          ...formSpec(read, questions),
          // The score may be written into the row: a number the quiz fills, never asks.
          score_field: read.field('score_field', ['number'], false),
          reveal: read.choice('reveal', QUIZ_REVEALS, 'each'),
          pass_percent: read.percent('pass_percent'),
        }
        if (spec.score_field !== null && questions.some((q) => q.field === spec.score_field)) {
          refuse('doublon', spec.score_field)
        }
        return spec
      }
      case 'form':
      case 'survey':
        return formSpec(read, read.questions())
    }
  })()
  read.finish()
  return spec
}

/** A form's, a survey's, a quiz's page — its questions already read. */
function formSpec(read: SpecReader, questions: ReturnType<SpecReader['questions']>) {
  return {
    title: read.text('title', MAX_LABEL_CHARS),
    description: read.text('description', 4000),
    fields: questions,
    submit_label: read.text('submit_label', 60),
    success_message: read.text('success_message', 2000),
    allow_another: read.flag('allow_another', true),
    // How it looks: every choice has a default that reads well, so a form made in a
    // click is already a good one (`accent` empty: the table's colour).
    theme: read.choice('theme', FORM_THEMES, 'clair'),
    accent: read.color('accent'),
    font: read.choice('font', FORM_FONTS, 'auto'),
    align: read.choice('align', FORM_ALIGNS, 'left'),
    welcome_label: read.text('welcome_label', 60),
    show_progress: read.flag('show_progress', true),
    show_numbers: read.flag('show_numbers', true),
    auto_advance: read.flag('auto_advance', true),
    celebrate: read.flag('celebrate', true),
    end_link_label: read.text('end_link_label', 60),
    end_link_url: read.link('end_link_url'),
  }
}

/** The keys of a spec that name ONE field, per kind. */
const SINGLE_FIELD_KEYS = [
  'group_by',
  'title_field',
  'cover_field',
  'date_field',
  'end_field',
  'start_field',
  'color_field',
  'depends_on',
  'score_field',
  'address_field',
  'latitude_field',
  'longitude_field',
]
const FIELD_LIST_KEYS = ['hidden', 'pinned', 'column_order', 'card_fields', 'system_columns']

/** Operators, lower case: what follows a field name in a predicate. */
const OPERATOR_WORDS = new Set<string>(OPERATORS)

/**
 * The fields a filter cites — the first segment of every path that stands before an
 * operator. Quoted values are blanked first, so a value that happens to read like a field
 * name is not taken for one.
 */
export function citedFields(filter: string): string[] {
  const unquoted = filter.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
  const cited: string[] = []
  // The operator is looked AHEAD, not consumed: in `not debut is_null`, `not` must not
  // swallow the field that follows it.
  const predicate = /\b([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z_][A-Za-z0-9_]*)?(?=\s+([A-Za-z_]+))/g
  for (const match of unquoted.matchAll(predicate)) {
    const [, name, operator] = match
    if (
      name !== undefined &&
      operator !== undefined &&
      OPERATOR_WORDS.has(operator.toLowerCase())
    ) {
      cited.push(name)
    }
  }
  return cited
}

/**
 * The spec as ONE reader may see it (chapter 11 §7): what names a field they do not see —
 * or a field deleted since, which must read the same — disappears. A pivot that vanishes
 * becomes `null`, which the screen says; a filter that cites one hides the view.
 */
export function projectViewSpec(
  spec: Readonly<Record<string, unknown>>,
  readable: Readable,
): { readonly spec: Record<string, unknown>; readonly filterHidden: boolean } {
  const sees = (name: unknown): name is string => typeof name === 'string' && readable.has(name)
  const out: Record<string, unknown> = { ...spec }
  for (const key of SINGLE_FIELD_KEYS) {
    if (key in out && !sees(out[key])) out[key] = null
  }
  for (const key of FIELD_LIST_KEYS) {
    if (Array.isArray(out[key])) out[key] = (out[key] as unknown[]).filter(sees)
  }
  if (Array.isArray(out.sorts)) {
    out.sorts = (out.sorts as Array<{ field?: unknown }>).filter((t) => sees(t.field))
  }
  if (typeof out.column_widths === 'object' && out.column_widths !== null) {
    out.column_widths = Object.fromEntries(
      Object.entries(out.column_widths as Record<string, unknown>).filter(([name]) => sees(name)),
    )
  }
  if (Array.isArray(out.fields)) {
    // A condition that reads a field the reader cannot see goes: it would name it, and
    // could never be met on their screen.
    out.fields = (out.fields as Array<{ field?: unknown; show_if?: { field?: unknown } | null }>)
      .filter((q) => sees(q.field))
      .map((q) =>
        q.show_if !== undefined && q.show_if !== null && !sees(q.show_if.field)
          ? { ...q, show_if: null }
          : q,
      )
  }
  if (typeof out.summaries === 'object' && out.summaries !== null) {
    out.summaries = Object.fromEntries(
      Object.entries(out.summaries as Record<string, unknown>).filter(([name]) => sees(name)),
    )
  }
  // A colour rule citing a field the reader cannot see would tell them something about it
  // by colouring rows: it is dropped, as the field is from everything else.
  if (Array.isArray(out.color_rules)) {
    out.color_rules = (out.color_rules as Array<{ filter?: unknown }>).filter(
      (rule) =>
        typeof rule.filter === 'string' &&
        citedFields(rule.filter).every((name) => readable.has(name)),
    )
  }
  // A variable naming a field the reader cannot see goes, braces and all: its value would
  // not be served anyway, and its NAME is already something they are not to learn.
  if (typeof out.card_template === 'string') {
    out.card_template = out.card_template.replace(TEMPLATE_VARIABLE, (whole, name: string) =>
      sees(name) ? whole : '',
    )
  }
  let filterHidden = false
  if (typeof out.filter === 'string' && out.filter !== '') {
    filterHidden = citedFields(out.filter).some((name) => !readable.has(name))
    if (filterHidden) out.filter = ''
  }
  return { spec: out, filterHidden }
}

/** The fields of a table the actor reads, by physical name. */
async function readableFields(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  tableId: string,
): Promise<Map<string, string>> {
  const target = await loadTarget(exec, ctx, tableId)
  if (target === null) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  const decision = decide(ctx, grants, 'read', target)
  const rows = await exec.query<{ id: string; name: string; kind: string }>(
    `SELECT f.id::text, n.name, f.kind
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL
        AND f.definition_state = 'active'`,
    [tableId],
  )
  return new Map([
    ...SYSTEM_VIEW_COLUMNS,
    ...rows.filter((r) => decision.readableFields.has(r.id)).map((r) => [r.name, r.kind] as const),
  ])
}

interface ViewRow extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly kind: ViewKind
  readonly description: string | null
  readonly position: number
  readonly spec: Record<string, unknown>
  readonly owner_id: string | null
  readonly is_locked: boolean
  readonly created_at: string
  readonly updated_at: string
}

const VIEW_COLUMNS = `id::text, label, kind, description, position, spec,
  owner_id::text, is_locked, created_at::text, updated_at::text`

function toView(row: ViewRow, readable: Readable): SavedView {
  const projected = projectViewSpec(row.spec ?? {}, readable)
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    description: row.description,
    position: row.position,
    spec: projected.spec,
    filterHidden: projected.filterHidden,
    personal: row.owner_id !== null,
    locked: row.is_locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** A label as the catalog keeps it — trimmed, bounded, never empty. */
function normalizeLabel(value: unknown, tableId: string): string {
  if (typeof value !== 'string')
    throw new BasedbError('LABEL_EMPTY', { details: { table: tableId } })
  const label = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (label === '') throw new BasedbError('LABEL_EMPTY', { details: { table: tableId } })
  if ([...label].length > MAX_LABEL_CHARS) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: MAX_LABEL_CHARS } })
  }
  return label
}

/** `name` — a slug of the label, for scripts and URLs; not unique, never a key. */
function slugOf(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63)
    .replace(/_+$/, '')
  return slug === '' ? 'vue' : slug
}

function asKind(value: unknown): ViewKind {
  if (typeof value !== 'string' || !(VIEW_KINDS as readonly string[]).includes(value)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'kind' } })
  }
  return value as ViewKind
}

async function assertLabelFree(
  exec: Executor,
  tableId: string,
  label: string,
  except: string | null,
  /** A personal view's owner: its label is unique among their views, not everyone's. */
  owner: string | null = null,
): Promise<void> {
  const clash = await exec.query<{ id: string }>(
    `SELECT id FROM _basedb.view_def
      WHERE table_id = $1 AND label_key = $2 AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id <> $3::uuid)
        AND owner_id IS NOT DISTINCT FROM $4::uuid`,
    [tableId, labelKey(label), except, owner],
  )
  if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
}

/** The views of a table, in the order of its selector. `read` on the table. */
export async function listViews(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string },
): Promise<SavedView[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await requireOnTable(exec, ctx, 'read', request.tableId)
      const readable = await readableFields(exec, ctx, grants, request.tableId)
      // The collaborative views, in the selector's order, then the reader's own.
      const rows = await exec.query<ViewRow>(
        `SELECT ${VIEW_COLUMNS} FROM _basedb.view_def
          WHERE table_id = $1 AND deleted_at IS NULL
            AND (owner_id IS NULL OR owner_id = $2)
          ORDER BY owner_id IS NOT NULL, position, created_at`,
        [request.tableId, ctx.actor.id],
      )
      return rows.map((row) => toView(row, readable))
    },
    { readOnly: true },
  )
}

/** Creates a view, placed last. Building is `manage_schema` (chapter 05 §9). */
export async function createView(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly label: unknown
    readonly kind: unknown
    readonly description?: unknown
    readonly spec?: unknown
    /** A personal view: the reader's own, which only needs `read` (chapter 11 §1.6). */
    readonly personal?: boolean
  },
): Promise<SavedView> {
  const label = normalizeLabel(request.label, request.tableId)
  const kind = asKind(request.kind)
  const description = normalizeDescription(request.description)
  const personal = request.personal === true

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    // Building a view for everyone is building the base; one for oneself is only reading.
    const grants = await requireOnTable(
      exec,
      ctx,
      personal ? 'read' : 'manage_schema',
      request.tableId,
    )
    const readable = await readableFields(exec, ctx, grants, request.tableId)
    const spec = normalizeViewSpec(
      kind,
      request.spec,
      readable,
      await selfLinksOf(exec, request.tableId),
    )
    const owner = personal ? ctx.actor.id : null
    await assertLabelFree(exec, request.tableId, label, null, owner)
    const [row] = await exec.query<ViewRow>(
      `INSERT INTO _basedb.view_def
         (table_id, label, label_key, name, description, kind, spec, position,
          created_by, updated_by, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb,
               (SELECT coalesce(max(position), 0) + 1 FROM _basedb.view_def
                 WHERE table_id = $1 AND deleted_at IS NULL),
               $8, $8, $9)
       RETURNING ${VIEW_COLUMNS}`,
      [
        request.tableId,
        label,
        labelKey(label),
        slugOf(label),
        description,
        kind,
        JSON.stringify(spec),
        ctx.actor.id,
        owner,
      ],
      'insert',
    )
    return toView(row as ViewRow, readable)
  })
}

/**
 * Changes a view's label, description and/or spec. The spec is replaced WHOLE, like a
 * list of choices: a partial merge would leave a kanban whose pivot changed carrying the
 * card fields chosen for the old one. The kind never changes — a calendar made into a form
 * is another view.
 */
export async function updateView(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly viewId: string
    readonly label?: unknown
    readonly description?: unknown
    readonly spec?: unknown
    /** Locks or unlocks a collaborative view. */
    readonly locked?: unknown
  },
): Promise<SavedView> {
  const label =
    request.label === undefined ? undefined : normalizeLabel(request.label, request.tableId)
  const setsDescription = request.description !== undefined
  const description = setsDescription ? normalizeDescription(request.description) : null
  if (request.locked !== undefined && typeof request.locked !== 'boolean') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'locked' } })
  }
  const locked = request.locked as boolean | undefined
  const changes = label !== undefined || setsDescription || request.spec !== undefined
  if (!changes && locked === undefined) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'body' } })
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const current = await currentView(exec, ctx, request.tableId, request.viewId)
    if (current.owner_id !== null && locked !== undefined) {
      // A personal view has nobody else to be protected from.
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'locked', reason: 'vue_personnelle' },
      })
    }
    const grants = await requireOnTable(
      exec,
      ctx,
      current.owner_id === null ? 'manage_schema' : 'read',
      request.tableId,
    )
    // Locked: nothing changes but the lock itself, unless it is lifted in the same request.
    if (current.is_locked && changes && locked !== false) {
      throw new BasedbError('VIEW_LOCKED', { details: { view: request.viewId } })
    }
    const readable = await readableFields(exec, ctx, grants, request.tableId)
    const spec =
      request.spec === undefined
        ? null
        : normalizeViewSpec(
            current.kind,
            request.spec,
            readable,
            await selfLinksOf(exec, request.tableId),
          )
    if (label !== undefined) {
      await assertLabelFree(exec, request.tableId, label, request.viewId, current.owner_id)
    }

    const [row] = await exec.query<ViewRow>(
      `UPDATE _basedb.view_def
          SET label = coalesce($2, label),
              label_key = coalesce($3, label_key),
              name = coalesce($4, name),
              description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
              spec = coalesce($7::jsonb, spec),
              is_locked = coalesce($9::boolean, is_locked),
              updated_at = clock_timestamp(), updated_by = $8
        WHERE id = $1::uuid
        RETURNING ${VIEW_COLUMNS}`,
      [
        request.viewId,
        label ?? null,
        label === undefined ? null : labelKey(label),
        label === undefined ? null : slugOf(label),
        setsDescription,
        description,
        spec === null ? null : JSON.stringify(spec),
        ctx.actor.id,
        locked ?? null,
      ],
      'update',
    )
    return toView(row as ViewRow, readable)
  })
}

/** Deletes a view — logically, like every catalog object. The rows are not touched. */
export async function deleteView(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly viewId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const current = await currentView(exec, ctx, request.tableId, request.viewId)
    await requireOnTable(
      exec,
      ctx,
      current.owner_id === null ? 'manage_schema' : 'read',
      request.tableId,
    )
    if (current.is_locked)
      throw new BasedbError('VIEW_LOCKED', { details: { view: request.viewId } })
    const rows = await exec.query<{ id: string }>(
      `UPDATE _basedb.view_def
          SET deleted_at = clock_timestamp(), deleted_by = $3
        WHERE id::text = $1 AND table_id = $2 AND deleted_at IS NULL
        RETURNING id::text`,
      [request.viewId, request.tableId, ctx.actor.id],
      'update',
    )
    if (rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: request.viewId } })
    }
  })
}

/**
 * Sets the order of a table's views, as the list of their identifiers. Views the list does
 * not name — created meanwhile by someone else — keep their relative order after the
 * others, as fields do (chapter 04 §1.1): a stale screen cannot lose a view.
 */
export async function reorderViews(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly ids: readonly string[] },
): Promise<{ readonly order: readonly string[] }> {
  const ids = request.ids
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'views' } })
  }
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i)
  if (repeated !== undefined) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'views', reason: 'doublon', detail: repeated },
    })
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    // The selector's shared order: personal views are listed after it, and never in it.
    const views = await exec.query<{ id: string; position: number }>(
      `SELECT id::text, position FROM _basedb.view_def
        WHERE table_id = $1 AND deleted_at IS NULL AND owner_id IS NULL
        ORDER BY position, created_at`,
      [request.tableId],
    )
    const known = new Map(views.map((v) => [v.id, v]))
    const unknown = ids.find((id) => !known.has(id))
    if (unknown !== undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: unknown } })
    }
    const named = new Set(ids)
    const order = [...ids, ...views.filter((v) => !named.has(v.id)).map((v) => v.id)]
    for (const [index, id] of order.entries()) {
      if (known.get(id)?.position === index + 1) continue
      await exec.query(
        `UPDATE _basedb.view_def
            SET position = $2, updated_at = clock_timestamp(), updated_by = $3
          WHERE id = $1::uuid`,
        [id, index + 1, ctx.actor.id],
        'update',
      )
    }
    return { order }
  })
}

/**
 * A view as its writer may see it: a personal view of someone else is exactly an absent
 * one — its existence is its owner's business.
 */
async function currentView(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
  viewId: string,
): Promise<{
  readonly kind: ViewKind
  readonly owner_id: string | null
  readonly is_locked: boolean
}> {
  const [current] = await exec.query<{
    kind: ViewKind
    owner_id: string | null
    is_locked: boolean
  }>(
    `SELECT kind, owner_id::text, is_locked FROM _basedb.view_def
      WHERE id::text = $1 AND table_id = $2 AND deleted_at IS NULL`,
    [viewId, tableId],
  )
  if (current === undefined || (current.owner_id !== null && current.owner_id !== ctx.actor.id)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: viewId } })
  }
  return current
}

/** The relations of a table to itself, by physical name — what dependencies may follow. */
async function selfLinksOf(exec: Executor, tableId: string): Promise<Set<string>> {
  const rows = await exec.query<{ name: string }>(
    `SELECT n.name
       FROM _basedb.field f
       JOIN _basedb.physical_name n      ON n.id = f.name_id
       JOIN _basedb.field_link_config lc ON lc.field_id = f.id
      WHERE f.table_id = $1 AND f.is_live AND lc.target_table_id = $1
        AND lc.fk_dropped_at IS NULL`,
    [tableId],
  )
  return new Set(rows.map((r) => r.name))
}
