import { $t } from '@/lib/i18n'
// Relative, as `messages.ts` does: the unit tests run without the `@/` alias.
import {
  FORM_ALIGNS,
  FORM_CONDITION_OPS,
  FORM_FONTS,
  FORM_THEMES,
  type FormAlign,
  type FormCondition,
  type FormConditionOp,
  type FormFont,
  type FormPrefill,
  type FormTheme,
  QUIZ_REVEALS,
  type QuizAnswer,
  type QuizReveal,
  quizAnswerFits,
} from '@basedb/contracts'
import {
  CalendarDays,
  ChartGantt,
  ClipboardList,
  LayoutGrid,
  List,
  type LucideIcon,
  MapIcon,
  MessageSquareText,
  SquareKanban,
  Table2,
  Trophy,
} from 'lucide-react'
import type { Field, SavedView, Table, ViewKind } from './api/client'
import { type DateKind, fromStored, isDateKind } from './dates'
import { weekStart } from './preferences'
import {
  type ColorRule,
  type ColorStyle,
  DEFAULT_PAGE_SIZE,
  type RowHeight,
  type SortTerm,
  type ViewState,
} from './store/workspace'

/**
 * Saved views, as the screen reads and writes them — chapter 11 §1.4.
 *
 * The API hands `spec` over as an object whose shape depends on the kind; this file is the
 * one place that knows those shapes. Every reader is DEFENSIVE: a spec arrives already cut
 * down to the fields the reader sees, so a pivot may be `null` and a list may be shorter
 * than its author made it — never a reason for the screen to fail.
 */

export interface KindInfo {
  readonly label: string
  readonly icon: LucideIcon
  /** One line, in the creation dialog. */
  readonly summary: string
  /** Shows rows (and takes the filter and the sort), rather than asking for one. */
  readonly data: boolean
  /** Its colour, on its icon where views are chosen: the text, and a tint behind. */
  readonly tone: string
}

export const VIEW_KINDS: readonly ViewKind[] = [
  'grid',
  'kanban',
  'calendar',
  'timeline',
  'gallery',
  'list',
  'map',
  'form',
  'survey',
  'quiz',
]

/** The kinds that ask for a row rather than show rows: a form, a survey, a quiz. */
export const isAnswerKind = (kind: ViewKind): kind is 'form' | 'survey' | 'quiz' =>
  kind === 'form' || kind === 'survey' || kind === 'quiz'

export const KIND_INFO: Readonly<Record<ViewKind, KindInfo>> = {
  grid: {
    label: $t('Grille'),
    icon: Table2,
    summary: $t('Lignes et colonnes, comme un tableur.'),
    data: true,
    tone: 'text-sky-600 bg-sky-500/12 dark:text-sky-300',
  },
  kanban: {
    label: $t('Kanban'),
    icon: SquareKanban,
    summary: $t('Des cartes en colonnes, une par choix d’une liste ; on les fait glisser.'),
    data: true,
    tone: 'text-violet-600 bg-violet-500/12 dark:text-violet-300',
  },
  calendar: {
    label: $t('Calendrier'),
    icon: CalendarDays,
    summary: $t('Chaque ligne posée sur sa date, au mois ou à la semaine.'),
    data: true,
    tone: 'text-rose-600 bg-rose-500/12 dark:text-rose-300',
  },
  timeline: {
    label: $t('Chronologie'),
    icon: ChartGantt,
    summary: $t('Des barres entre une date de début et une date de fin.'),
    data: true,
    tone: 'text-amber-600 bg-amber-500/15 dark:text-amber-300',
  },
  gallery: {
    label: $t('Galerie'),
    icon: LayoutGrid,
    summary: $t('Des cartes en mosaïque, une image de couverture en tête.'),
    data: true,
    tone: 'text-emerald-600 bg-emerald-500/12 dark:text-emerald-300',
  },
  list: {
    label: $t('Liste'),
    icon: List,
    summary: $t('Une ligne par enregistrement, regroupées sous des titres.'),
    data: true,
    tone: 'text-slate-600 bg-slate-500/12 dark:text-slate-300',
  },
  map: {
    label: $t('Carte'),
    icon: MapIcon,
    summary: $t('Chaque ligne posée sur une carte, par son adresse ou ses coordonnées.'),
    data: true,
    tone: 'text-lime-700 bg-lime-500/15 dark:text-lime-300',
  },
  form: {
    label: $t('Formulaire'),
    icon: ClipboardList,
    summary: $t('Une page de saisie : chaque envoi ajoute une ligne.'),
    data: false,
    tone: 'text-teal-600 bg-teal-500/12 dark:text-teal-300',
  },
  survey: {
    label: $t('Questionnaire'),
    icon: MessageSquareText,
    summary: $t('Le même, une question par écran, avec une barre de progression.'),
    data: false,
    tone: 'text-indigo-600 bg-indigo-500/12 dark:text-indigo-300',
  },
  quiz: {
    label: $t('Quiz'),
    icon: Trophy,
    summary: $t('Des questions notées, une par écran : le score s’affiche à la fin.'),
    data: false,
    tone: 'text-orange-600 bg-orange-500/12 dark:text-orange-300',
  },
}

// ── The shapes ───────────────────────────────────────────────────────────────────────

export interface DataSpec {
  readonly filter: string
  readonly sorts: readonly SortTerm[]
}

export interface GridSpec extends DataSpec {
  readonly hidden: readonly string[]
  readonly pinned: readonly string[]
  readonly column_order: readonly string[]
  readonly column_widths: Readonly<Record<string, number>>
  readonly page_size: number
  readonly group_by: string | null
  readonly summaries: Readonly<Record<string, string>>
  readonly row_height: RowHeight
  readonly color_field: string | null
  readonly color_rules: readonly ColorRule[]
  readonly color_style: ColorStyle
  readonly system_columns: readonly string[]
}

/** What a card shows: its title, and a few fields under it. */
export interface CardSpec {
  readonly title_field: string | null
  readonly card_fields: readonly string[]
}

export interface KanbanSpec extends DataSpec, CardSpec {
  readonly group_by: string | null
  /**
   * A description under each card's title, with variables — `{{nom_du_champ}}` — that the
   * row's values replace (`card-template.ts`). Empty: none.
   */
  readonly card_template: string
  /** The columns' order, as choice values; a choice it does not name goes last. */
  readonly group_order: readonly string[]
  readonly cover_field: string | null
  readonly hide_empty: boolean
  /** Cards in the order they were dragged, when no sort says otherwise. */
  readonly manual_order: readonly string[]
}

export interface CalendarSpec extends DataSpec, CardSpec {
  readonly date_field: string | null
  readonly end_field: string | null
  readonly color_field: string | null
  readonly mode: 'month' | 'week'
}

export type TimelineScale = 'day' | 'week' | 'month'

export interface TimelineSpec extends DataSpec, CardSpec {
  readonly start_field: string | null
  readonly end_field: string | null
  readonly group_by: string | null
  readonly color_field: string | null
  readonly scale: TimelineScale
  /** « Dépend de »: a relation of the table to itself, drawn as arrows. */
  readonly depends_on: string | null
}

export interface GallerySpec extends DataSpec, CardSpec {
  readonly cover_field: string | null
  readonly cover_fit: 'cover' | 'contain'
  readonly card_size: 'small' | 'medium' | 'large'
  readonly color_field: string | null
  readonly manual_order: readonly string[]
}

/** A map: rows placed by an address, or by a latitude and a longitude (chapter 11 §1.9). */
export interface MapSpec extends DataSpec, CardSpec {
  readonly address_field: string | null
  readonly latitude_field: string | null
  readonly longitude_field: string | null
  readonly color_field: string | null
}

export interface ListSpec extends DataSpec, CardSpec {
  readonly group_by: string | null
  readonly manual_order: readonly string[]
}

export interface FormQuestion {
  readonly field: string
  readonly required: boolean
  /** Replaces the field's label in the form; empty keeps it. */
  readonly label: string
  /** Under the question; empty falls back to the field's description. */
  readonly help: string
  /** An example in the empty input; empty: one chosen for the kind of field. */
  readonly placeholder: string
  /** `today`: a date question holds the day before anyone answers it; `null`: empty. */
  readonly prefill: FormPrefill | null
  /** Asked only when an earlier answer says so; `null`: always. */
  readonly show_if: FormCondition | null
  /** A quiz's alone: the right answer, `null` for a question asked but not graded. */
  readonly correct?: QuizAnswer | null
  /** A quiz's alone: what the right answer is worth — one point unless said otherwise. */
  readonly points?: number
}

export interface FormSpec {
  readonly title: string
  readonly description: string
  readonly fields: readonly FormQuestion[]
  readonly submit_label: string
  readonly success_message: string
  readonly allow_another: boolean
  /** The look — a background, a type and colours that go together. */
  readonly theme: FormTheme
  /** `#rrggbb`; empty: the table's colour, else the theme's. */
  readonly accent: string
  readonly font: FormFont
  readonly align: FormAlign
  /** The survey's first button; empty: « Commencer ». */
  readonly welcome_label: string
  readonly show_progress: boolean
  readonly show_numbers: boolean
  /** A single choice, a yes or no, a rating: the next question comes by itself. */
  readonly auto_advance: boolean
  /** Confetti when the answer is sent. */
  readonly celebrate: boolean
  /** A button on the last screen: back to a site, to a page. */
  readonly end_link_label: string
  readonly end_link_url: string
  /** A quiz's: the number field its score is written into, if any. */
  readonly score_field: string | null
  /** A quiz's: when the right answers show — after each question, at the end, never. */
  readonly reveal: QuizReveal
  /** A quiz's: the percentage that passes; `null`: no pass mark. */
  readonly pass_percent: number | null
}

// ── Reading a spec, whatever came over the wire ──────────────────────────────────────

type Raw = Readonly<Record<string, unknown>>

const text = (raw: Raw, key: string): string => (typeof raw[key] === 'string' ? raw[key] : '')
const name = (raw: Raw, key: string): string | null =>
  typeof raw[key] === 'string' && raw[key] !== '' ? raw[key] : null
const names = (raw: Raw, key: string): string[] =>
  Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((v) => typeof v === 'string') : []
const flag = (raw: Raw, key: string, fallback: boolean): boolean =>
  typeof raw[key] === 'boolean' ? raw[key] : fallback
function oneOf<T extends string>(raw: Raw, key: string, values: readonly T[], fallback: T): T {
  const value = raw[key]
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function sortsOf(raw: Raw): SortTerm[] {
  if (!Array.isArray(raw.sorts)) return []
  return (raw.sorts as unknown[]).flatMap((term) => {
    if (typeof term !== 'object' || term === null) return []
    const { field, direction } = term as { field?: unknown; direction?: unknown }
    if (typeof field !== 'string') return []
    return [{ field, direction: direction === 'desc' ? ('desc' as const) : ('asc' as const) }]
  })
}

const dataOf = (raw: Raw): DataSpec => ({ filter: text(raw, 'filter'), sorts: sortsOf(raw) })
const cardOf = (raw: Raw): CardSpec => ({
  title_field: name(raw, 'title_field'),
  card_fields: names(raw, 'card_fields'),
})

function summariesOf(raw: Raw): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof raw.summaries === 'object' && raw.summaries !== null) {
    for (const [key, value] of Object.entries(raw.summaries as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value
    }
  }
  return out
}

function colorRulesOf(raw: Raw): ColorRule[] {
  if (!Array.isArray(raw.color_rules)) return []
  return (raw.color_rules as unknown[]).flatMap((rule) => {
    if (typeof rule !== 'object' || rule === null) return []
    const { filter, color, style } = rule as { filter?: unknown; color?: unknown; style?: unknown }
    if (typeof filter !== 'string' || typeof color !== 'string') return []
    // A rule saved before styles existed shows both, as it always did.
    return [{ filter, color, style: isColorStyle(style) ? style : 'both' }]
  })
}

const isColorStyle = (value: unknown): value is ColorStyle =>
  value === 'both' || value === 'stripe' || value === 'background'

export function gridSpec(raw: Raw): GridSpec {
  const widths: Record<string, number> = {}
  if (typeof raw.column_widths === 'object' && raw.column_widths !== null) {
    for (const [key, value] of Object.entries(raw.column_widths as Record<string, unknown>)) {
      if (typeof value === 'number') widths[key] = value
    }
  }
  return {
    ...dataOf(raw),
    hidden: names(raw, 'hidden'),
    pinned: names(raw, 'pinned'),
    column_order: names(raw, 'column_order'),
    column_widths: widths,
    page_size: typeof raw.page_size === 'number' ? raw.page_size : DEFAULT_PAGE_SIZE,
    group_by: name(raw, 'group_by'),
    summaries: summariesOf(raw),
    row_height: oneOf(raw, 'row_height', ['short', 'medium', 'tall', 'extra'] as const, 'short'),
    color_field: name(raw, 'color_field'),
    color_rules: colorRulesOf(raw),
    color_style: isColorStyle(raw.color_style) ? raw.color_style : 'both',
    system_columns: names(raw, 'system_columns'),
  }
}

export const kanbanSpec = (raw: Raw): KanbanSpec => ({
  ...dataOf(raw),
  ...cardOf(raw),
  group_by: name(raw, 'group_by'),
  group_order: names(raw, 'group_order'),
  card_template: text(raw, 'card_template'),
  cover_field: name(raw, 'cover_field'),
  hide_empty: flag(raw, 'hide_empty', false),
  manual_order: names(raw, 'manual_order'),
})

export const calendarSpec = (raw: Raw): CalendarSpec => ({
  ...dataOf(raw),
  ...cardOf(raw),
  date_field: name(raw, 'date_field'),
  end_field: name(raw, 'end_field'),
  color_field: name(raw, 'color_field'),
  mode: oneOf(raw, 'mode', ['month', 'week'] as const, 'month'),
})

export const timelineSpec = (raw: Raw): TimelineSpec => ({
  ...dataOf(raw),
  ...cardOf(raw),
  start_field: name(raw, 'start_field'),
  end_field: name(raw, 'end_field'),
  group_by: name(raw, 'group_by'),
  color_field: name(raw, 'color_field'),
  scale: oneOf(raw, 'scale', ['day', 'week', 'month'] as const, 'week'),
  depends_on: name(raw, 'depends_on'),
})

export const gallerySpec = (raw: Raw): GallerySpec => ({
  ...dataOf(raw),
  ...cardOf(raw),
  cover_field: name(raw, 'cover_field'),
  cover_fit: oneOf(raw, 'cover_fit', ['cover', 'contain'] as const, 'cover'),
  card_size: oneOf(raw, 'card_size', ['small', 'medium', 'large'] as const, 'medium'),
  color_field: name(raw, 'color_field'),
  manual_order: names(raw, 'manual_order'),
})

export const mapSpec = (raw: Raw): MapSpec => ({
  ...dataOf(raw),
  ...cardOf(raw),
  address_field: name(raw, 'address_field'),
  latitude_field: name(raw, 'latitude_field'),
  longitude_field: name(raw, 'longitude_field'),
  color_field: name(raw, 'color_field'),
})

export const listSpec = (raw: Raw): ListSpec => ({
  ...dataOf(raw),
  ...cardOf(raw),
  group_by: name(raw, 'group_by'),
  manual_order: names(raw, 'manual_order'),
})

/**
 * Rows in the order a view keeps by hand (ch. 11 §1.6): those it names first, in its
 * order; the others after them, as they came. With a sort, the sort wins — the caller
 * passes no order then.
 */
export function orderByHand<T extends { readonly _id: string }>(
  rows: readonly T[],
  order: readonly string[],
): T[] {
  if (order.length === 0) return [...rows]
  const rank = new Map(order.map((id, index) => [id, index]))
  return rows
    .map((row, index) => ({ row, at: rank.get(row._id) ?? order.length + index }))
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.row)
}

/**
 * The order to save after a drag: the rows on screen in their new order, then the ids the
 * old order named that are not on screen — a row of a page not loaded keeps its place.
 */
export function nextHandOrder(
  shown: readonly string[],
  previous: readonly string[],
  limit = 5000,
): string[] {
  const onScreen = new Set(shown)
  return [...shown, ...previous.filter((id) => !onScreen.has(id))].slice(0, limit)
}

export function formSpec(raw: Raw): FormSpec {
  const questions = Array.isArray(raw.fields)
    ? (raw.fields as unknown[]).flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const item = entry as Raw
        const field = name(item, 'field')
        if (field === null) return []
        return [
          {
            field,
            required: flag(item, 'required', false),
            label: text(item, 'label'),
            help: text(item, 'help'),
            placeholder: text(item, 'placeholder'),
            prefill: item.prefill === 'today' ? ('today' as const) : null,
            show_if: conditionOf(item.show_if),
            // A quiz's grading, kept only where the spec has it: a form's question has none,
            // and a key it does not know would be refused.
            ...('correct' in item || 'points' in item
              ? {
                  correct: correctOf(item.correct),
                  points:
                    typeof item.points === 'number' && Number.isInteger(item.points)
                      ? item.points
                      : 1,
                }
              : {}),
          },
        ]
      })
    : []
  const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const v = raw[key]
    return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fallback
  }
  return {
    title: text(raw, 'title'),
    description: text(raw, 'description'),
    fields: questions,
    submit_label: text(raw, 'submit_label'),
    success_message: text(raw, 'success_message'),
    allow_another: flag(raw, 'allow_another', true),
    theme: choice('theme', FORM_THEMES, 'clair'),
    accent: typeof raw.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : '',
    font: choice('font', FORM_FONTS, 'auto'),
    align: choice('align', FORM_ALIGNS, 'left'),
    welcome_label: text(raw, 'welcome_label'),
    show_progress: flag(raw, 'show_progress', true),
    show_numbers: flag(raw, 'show_numbers', true),
    auto_advance: flag(raw, 'auto_advance', true),
    celebrate: flag(raw, 'celebrate', true),
    end_link_label: text(raw, 'end_link_label'),
    end_link_url: text(raw, 'end_link_url'),
    score_field: name(raw, 'score_field'),
    reveal: choice('reveal', QUIZ_REVEALS, 'each'),
    pass_percent:
      typeof raw.pass_percent === 'number' && raw.pass_percent >= 1 && raw.pass_percent <= 100
        ? raw.pass_percent
        : null,
  }
}

/** A right answer as a spec holds it: a text, a number, yes or no, or a list of texts. */
function correctOf(raw: unknown): QuizAnswer | null {
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw
  if (Array.isArray(raw) && raw.every((v) => typeof v === 'string')) return raw as string[]
  return null
}

/** Whether a quiz question grades its answer: a right answer, of its field's shape. */
export const isGraded = (question: FormQuestion, field: Field) =>
  question.correct !== undefined &&
  question.correct !== null &&
  quizAnswerFits(field.kind, question.correct)

/** A condition as a spec holds it — anything else reads as none. */
function conditionOf(raw: unknown): FormCondition | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { field, op, value } = raw as Raw
  if (typeof field !== 'string' || typeof op !== 'string') return null
  if (!(FORM_CONDITION_OPS as readonly string[]).includes(op)) return null
  return {
    field,
    op: op as FormConditionOp,
    value:
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : null,
  }
}

/** The filter and the sort of a view that shows rows; none for a form. */
export function dataSpecOf(view: SavedView): DataSpec {
  return KIND_INFO[view.kind].data ? dataOf(view.spec) : { filter: '', sorts: [] }
}

// ── Which field can play which part ──────────────────────────────────────────────────

/** The business fields of a table — the five system columns play no part in a view. */
export const businessFields = (table: Table): readonly Field[] =>
  table.fields.filter((f) => f.system !== true)

export const selectFields = (fields: readonly Field[]) => fields.filter((f) => f.kind === 'select')
export const dateFields = (fields: readonly Field[]) => fields.filter((f) => isDateKind(f.kind))
export const pictureFields = (fields: readonly Field[]) =>
  fields.filter((f) => f.kind === 'image' || f.kind === 'file')
/** What a map can read an address from: a text — the « Adresse » format first. */
export const addressFields = (fields: readonly Field[]) =>
  [...fields.filter((f) => f.kind === 'short_text' || f.kind === 'long_text')].sort(
    (a, b) => Number(b.format?.display === 'address') - Number(a.format?.display === 'address'),
  )
/** What a map can read a coordinate from. */
export const numberFields = (fields: readonly Field[]) => fields.filter((f) => f.kind === 'number')
/** What a timeline can stack its rows by. */
export const groupFields = (fields: readonly Field[]) =>
  fields.filter((f) => f.kind === 'select' || f.kind === 'link')
/** What a list can group its rows under: a choice, a relation, a person. */
export const listGroupFields = (fields: readonly Field[]) =>
  fields.filter((f) => f.kind === 'select' || f.kind === 'link' || f.kind === 'user')
/** The relations of a table to itself — what a timeline's dependencies follow. */
export const selfLinkFields = (table: Table, fields: readonly Field[]) =>
  fields.filter(
    (f) => (f.kind === 'link' || f.kind === 'multi_link') && f.link?.target === table.name,
  )

/**
 * What a form can ask: every field a person may write. A formula, a column filled by the
 * AI or one the reader may only read has nothing to be typed into.
 */
export const askableFields = (fields: readonly Field[]) =>
  fields.filter((f) => f.read_only !== true && f.ai !== true && f.kind !== 'formula')

/**
 * The questions a new form starts with — a smart default, so nobody has to sort a list
 * before the first answer: every askable field, but the ones a team fills in AFTER an
 * answer comes — a person to assign, a relation to another table, a status or a stage —
 * are left out unless the table requires them. They stay one tick away in the editor.
 */
export function defaultQuestions(fields: readonly Field[]): Field[] {
  const askable = askableFields(fields)
  const workflow =
    /^(statut|status|état|etat|estado|stato|stav|stan|tila|durum|статус|стан|状态|ステータス|상태|étape|etape|stage|phase|fase|avancement|priorité|priorite|priority|prioridad|priorità|priorität|prioriteit)$/i
  const picked = askable.filter(
    (f) =>
      f.required === true ||
      !(
        f.kind === 'user' ||
        f.kind === 'link' ||
        f.kind === 'multi_link' ||
        f.kind === 'button' ||
        (f.kind === 'select' && workflow.test(f.label.trim()))
      ),
  )
  return picked.length > 0 ? picked : askable
}

/**
 * The field that names a row on a card: the one the view chose, else the table's display
 * column, else the first short text. `null` when the table has none of them — the card
 * then shows the beginning of its identifier.
 */
export function titleFieldOf(
  table: Table,
  fields: readonly Field[],
  chosen: string | null,
): Field | null {
  const byName = (n: string | null) => (n === null ? undefined : fields.find((f) => f.name === n))
  return (
    byName(chosen) ??
    byName(table.display_field) ??
    fields.find((f) => f.kind === 'short_text') ??
    null
  )
}

/** The fields of `names`, in that order, that the reader still sees. */
export const pick = (fields: readonly Field[], list: readonly string[]): Field[] =>
  list.flatMap((n) => fields.filter((f) => f.name === n))

// ── A new view ───────────────────────────────────────────────────────────────────────

/**
 * A spec to start the creation dialog from — the pivots already on the first field that
 * can take them, so that "Créer" works at once whenever the table allows the kind.
 */
export function defaultSpec(kind: ViewKind, table: Table, current: DataSpec): Raw {
  const fields = businessFields(table)
  const title = titleFieldOf(table, fields, null)
  const others = fields
    .filter((f) => f.name !== title?.name && f.kind !== 'long_text')
    .slice(0, 3)
    .map((f) => f.name)
  const data = { filter: current.filter, sorts: current.sorts }
  switch (kind) {
    case 'grid':
      return { ...data, hidden: [], pinned: [], column_order: [], column_widths: {} }
    case 'kanban': {
      const group = selectFields(fields)[0]?.name ?? null
      return {
        ...data,
        group_by: group,
        group_order: [],
        title_field: title?.name ?? null,
        card_fields: others.filter((n) => n !== group),
        cover_field: fields.find((f) => f.kind === 'image')?.name ?? null,
        hide_empty: false,
      }
    }
    case 'calendar': {
      return {
        ...data,
        date_field: dateFields(fields)[0]?.name ?? null,
        end_field: null,
        title_field: title?.name ?? null,
        card_fields: [],
        color_field: selectFields(fields)[0]?.name ?? null,
        mode: 'month',
      }
    }
    case 'timeline': {
      const [start, end] = dateFields(fields)
      return {
        ...data,
        start_field: start?.name ?? null,
        end_field: end?.name ?? null,
        group_by: null,
        title_field: title?.name ?? null,
        card_fields: [],
        color_field: selectFields(fields)[0]?.name ?? null,
        scale: 'week',
      }
    }
    case 'gallery': {
      return {
        ...data,
        title_field: title?.name ?? null,
        card_fields: others,
        cover_field: pictureFields(fields)[0]?.name ?? null,
        cover_fit: 'cover',
        card_size: 'medium',
        color_field: null,
        manual_order: [],
      }
    }
    case 'list': {
      return {
        ...data,
        title_field: title?.name ?? null,
        card_fields: others,
        group_by: selectFields(fields)[0]?.name ?? null,
        manual_order: [],
      }
    }
    case 'map': {
      // An address field if there is one; otherwise the numbers named like coordinates.
      const address = fields.find((f) => f.kind === 'short_text' && f.format?.display === 'address')
      const numbers = numberFields(fields)
      const named = (words: readonly string[]) =>
        numbers.find((f) => words.some((w) => f.label.trim().toLocaleLowerCase().startsWith(w)))
          ?.name ?? null
      const latitude = address === undefined ? named(['lat']) : null
      const longitude = address === undefined ? named(['lon', 'lng']) : null
      return {
        ...data,
        address_field:
          address?.name ??
          (latitude === null || longitude === null
            ? (addressFields(fields)[0]?.name ?? null)
            : null),
        latitude_field: latitude,
        longitude_field: longitude,
        title_field: title?.name ?? null,
        card_fields: others.filter((n) => n !== address?.name),
        color_field: selectFields(fields)[0]?.name ?? null,
      }
    }
    case 'quiz': {
      // The score goes into a number field that reads like one, when the table has it.
      const score = fields.find(
        (f) =>
          f.kind === 'number' &&
          f.read_only !== true &&
          SCORE_NAMES.has(f.label.trim().toLocaleLowerCase()),
      )
      const survey = defaultSpec('survey', table, current)
      return {
        ...survey,
        fields: (survey.fields as FormQuestion[]).filter((q) => q.field !== score?.name),
        score_field: score?.name ?? null,
        reveal: 'each',
        pass_percent: null,
      }
    }
    case 'form':
    case 'survey':
      return {
        title: table.label,
        description: '',
        // What a person answers — not what the team fills in after (who handles it, how
        // far along it is) —, the required ones required: a form that leaves one out could
        // never be sent. Nothing else to decide: every choice below has a good default.
        fields: defaultQuestions(fields).map((f) => ({
          field: f.name,
          required: f.required === true,
          label: '',
          help: '',
          placeholder: '',
          prefill: null,
          show_if: null,
        })),
        submit_label: '',
        success_message: '',
        allow_another: true,
        theme: 'clair',
        // Empty: the table's own colour, so a form already wears its table's.
        accent: '',
        font: 'auto',
        align: 'left',
        welcome_label: '',
        show_progress: true,
        show_numbers: true,
        auto_advance: true,
        celebrate: true,
        end_link_label: '',
        end_link_url: '',
      }
  }
}

/**
 * What a table calls the number a quiz's score goes into, in the twenty languages: a new
 * quiz sends its score there by itself (the documentation of each language names some).
 */
const SCORE_NAMES: ReadonlySet<string> = new Set([
  'score',
  'scores',
  'point',
  'points',
  'note',
  'résultat',
  'resultat',
  'result',
  'results',
  'grade',
  'mark',
  'marks',
  'punkte',
  'punktzahl',
  'ergebnis',
  'punten',
  'resultaat',
  'beoordeling',
  'cijfer',
  'poäng',
  'betyg',
  'karakter',
  'poeng',
  'poengsum',
  'pisteet',
  'tulos',
  'arvosana',
  'puntuación',
  'puntuacion',
  'puntos',
  'nota',
  'resultado',
  'punteggio',
  'punti',
  'voto',
  'risultato',
  'pontuação',
  'pontuacao',
  'pontos',
  'punctaj',
  'puncte',
  'notă',
  'rezultat',
  'wynik',
  'punkty',
  'ocena',
  'skóre',
  'body',
  'výsledek',
  'známka',
  'pontszám',
  'pontok',
  'pont',
  'eredmény',
  'бали',
  'бал',
  'результат',
  'оцінка',
  'рахунок',
  'puan',
  'skor',
  'sonuç',
  'スコア',
  '得点',
  '点数',
  'ポイント',
  '分数',
  '得分',
  '积分',
  '成绩',
  '점수',
  '득점',
  '포인트',
])

/** Why a kind cannot be made on this table, or `null` when it can. */
export function unavailableReason(kind: ViewKind, table: Table): string | null {
  const fields = businessFields(table)
  switch (kind) {
    case 'kanban':
      return selectFields(fields).length === 0
        ? $t('Il faut un champ « Liste de choix » pour former les colonnes.')
        : null
    case 'calendar':
    case 'timeline':
      return dateFields(fields).length === 0 ? $t('Il faut un champ date ou date-heure.') : null
    case 'map':
      return addressFields(fields).length === 0 && numberFields(fields).length < 2
        ? $t('Il faut une adresse, ou deux nombres : latitude et longitude.')
        : null
    case 'form':
    case 'survey':
    case 'quiz':
      return askableFields(fields).length === 0 ? $t('Aucun champ ne peut être saisi.') : null
    default:
      return null
  }
}

/** A label no other view of the table carries: « Kanban », then « Kanban 2 »… */
export function freeLabel(base: string, views: readonly SavedView[]): string {
  const taken = new Set(views.map((v) => v.label.toLocaleLowerCase('fr')))
  if (!taken.has(base.toLocaleLowerCase('fr'))) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`
    if (!taken.has(candidate.toLocaleLowerCase('fr'))) return candidate
  }
}

// ── A grid view and the local overlay ────────────────────────────────────────────────

/** The overlay a saved grid opens with: its layout, its filter, its sort, page one. */
export function viewStateOf(view: SavedView | null, previous?: ViewState): ViewState {
  if (view === null || view.kind !== 'grid') {
    const data = view === null ? { filter: '', sorts: [] } : dataSpecOf(view)
    return {
      columnWidths: previous?.columnWidths ?? {},
      columnOrder: null,
      pinned: [],
      hidden: [],
      sorts: data.sorts,
      filter: data.filter,
      pageSize: previous?.pageSize ?? DEFAULT_PAGE_SIZE,
      cursors: [],
      total: null,
      totalCapped: false,
      search: '',
      groupBy: null,
      summaries: {},
      rowHeight: 'short',
      colorField: null,
      colorRules: [],
      colorStyle: 'both',
      systemColumns: [],
    }
  }
  const spec = gridSpec(view.spec)
  return {
    columnWidths: spec.column_widths,
    columnOrder: spec.column_order.length === 0 ? null : spec.column_order,
    pinned: spec.pinned,
    hidden: spec.hidden,
    sorts: spec.sorts,
    filter: spec.filter,
    pageSize: spec.page_size,
    cursors: [],
    total: null,
    totalCapped: false,
    search: '',
    groupBy: spec.group_by,
    summaries: spec.summaries,
    rowHeight: spec.row_height,
    colorField: spec.color_field,
    colorRules: spec.color_rules,
    colorStyle: spec.color_style,
    systemColumns: spec.system_columns,
  }
}

/** A grid's spec from the layout on screen — columns, filter, sort, page size. */
export function gridSpecOf(state: ViewState): Raw {
  return {
    filter: state.filter,
    sorts: state.sorts,
    hidden: state.hidden,
    pinned: state.pinned,
    column_order: state.columnOrder ?? [],
    column_widths: state.columnWidths,
    page_size: state.pageSize,
    group_by: state.groupBy,
    summaries: state.summaries,
    row_height: state.rowHeight,
    color_field: state.colorField,
    color_rules: state.colorRules,
    color_style: state.colorStyle,
    system_columns: state.systemColumns,
  }
}

/** What "Enregistrer la vue" writes from the overlay, for a view of `kind`. */
export function specFromState(view: SavedView, state: ViewState): Raw {
  if (view.kind === 'grid') return gridSpecOf(state)
  return { ...view.spec, filter: state.filter, sorts: state.sorts }
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])
const sameSorts = (a: readonly SortTerm[], b: readonly SortTerm[]) =>
  a.length === b.length &&
  a.every((t, i) => t.field === b[i]?.field && t.direction === b[i]?.direction)

/**
 * True when the overlay differs from what the view saved — the screen then offers to save
 * it, or to go back. Widths are compared loosely: a column dragged by two pixels is not
 * worth a banner.
 */
export function isModified(view: SavedView, state: ViewState): boolean {
  const data = dataSpecOf(view)
  if (data.filter !== state.filter || !sameSorts(data.sorts, state.sorts)) return true
  if (view.kind !== 'grid') return false
  const spec = gridSpec(view.spec)
  if (!sameList(spec.hidden, state.hidden) || !sameList(spec.pinned, state.pinned)) return true
  if (!sameList(spec.column_order, state.columnOrder ?? [])) return true
  if (spec.page_size !== state.pageSize) return true
  if (spec.group_by !== state.groupBy || spec.row_height !== state.rowHeight) return true
  if (spec.color_field !== state.colorField || spec.color_style !== state.colorStyle) return true
  if (!sameList(spec.system_columns, state.systemColumns)) return true
  if (JSON.stringify(spec.color_rules) !== JSON.stringify(state.colorRules)) return true
  const summaryKeys = new Set([...Object.keys(spec.summaries), ...Object.keys(state.summaries)])
  for (const key of summaryKeys) {
    if (spec.summaries[key] !== state.summaries[key]) return true
  }
  const keys = new Set([...Object.keys(spec.column_widths), ...Object.keys(state.columnWidths)])
  for (const key of keys) {
    if (Math.abs((spec.column_widths[key] ?? 0) - (state.columnWidths[key] ?? 0)) > 8) return true
  }
  return false
}

// ── Dates on a calendar and a timeline ───────────────────────────────────────────────

/** A stored date or instant as a local `Date`, or `null` for none. */
export function localDateOf(value: unknown, kind: string): Date | null {
  if (typeof value !== 'string' || !isDateKind(kind)) return null
  const moment = fromStored(value, kind as DateKind)
  if (moment === null) return null
  const { day, time } = moment
  return new Date(
    day.year,
    day.month - 1,
    day.day,
    time?.hour ?? 0,
    time?.minute ?? 0,
    time?.second ?? 0,
  )
}

/** A local `Date` as the API takes it for a field of `kind`. */
export function storedOfDate(date: Date, kind: string): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  if (kind === 'date') {
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  return date.toISOString()
}

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const addDays = (date: Date, days: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  )

/** Whole days from `a` to `b`, by calendar — a change of hour does not count. */
export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000)

/** The first day of the week of `date` — Monday, the French week, unless the person chose Sunday. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  return addDays(day, -((day.getDay() + 7 - weekStart()) % 7))
}

/**
 * The filter clause that keeps the rows touching [from, to[ — on the start alone, or,
 * with an end, every row that begins before `to` and ends on or after `from`.
 */
export function rangeClause(start: Field, end: Field | null, from: Date, to: Date): string {
  const at = (date: Date, field: Field) => `"${storedOfDate(date, field.kind)}"`
  if (end === null) {
    return `${start.name} gte ${at(from, start)} and ${start.name} lt ${at(to, start)}`
  }
  return `${start.name} lt ${at(to, start)} and (${end.name} gte ${at(from, end)} or (${end.name} is_null and ${start.name} gte ${at(from, start)}))`
}

/** A filter of the view and a clause of the screen, joined. */
export function andFilter(...parts: readonly string[]): string {
  const kept = parts.map((p) => p.trim()).filter((p) => p !== '')
  if (kept.length <= 1) return kept[0] ?? ''
  return kept.map((p) => `(${p})`).join(' and ')
}
