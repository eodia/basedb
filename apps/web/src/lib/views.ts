import {
  CalendarDays,
  ChartGantt,
  ClipboardList,
  type LucideIcon,
  MessageSquareText,
  SquareKanban,
  Table2,
} from 'lucide-react'
// Relative, as `messages.ts` does: the unit tests run without the `@/` alias.
import type { Field, SavedView, Table, ViewKind } from './api/client'
import { type DateKind, fromStored, isDateKind } from './dates'
import { DEFAULT_PAGE_SIZE, type SortTerm, type ViewState } from './store/workspace'

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
}

export const VIEW_KINDS: readonly ViewKind[] = [
  'grid',
  'kanban',
  'calendar',
  'timeline',
  'form',
  'survey',
]

export const KIND_INFO: Readonly<Record<ViewKind, KindInfo>> = {
  grid: {
    label: 'Grille',
    icon: Table2,
    summary: 'Lignes et colonnes, comme un tableur.',
    data: true,
  },
  kanban: {
    label: 'Kanban',
    icon: SquareKanban,
    summary: 'Des cartes en colonnes, une par choix d’une liste ; on les fait glisser.',
    data: true,
  },
  calendar: {
    label: 'Calendrier',
    icon: CalendarDays,
    summary: 'Chaque ligne posée sur sa date, au mois ou à la semaine.',
    data: true,
  },
  timeline: {
    label: 'Chronologie',
    icon: ChartGantt,
    summary: 'Des barres entre une date de début et une date de fin.',
    data: true,
  },
  form: {
    label: 'Formulaire',
    icon: ClipboardList,
    summary: 'Une page de saisie : chaque envoi ajoute une ligne.',
    data: false,
  },
  survey: {
    label: 'Questionnaire',
    icon: MessageSquareText,
    summary: 'Le même, une question par écran, avec une barre de progression.',
    data: false,
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
}

/** What a card shows: its title, and a few fields under it. */
export interface CardSpec {
  readonly title_field: string | null
  readonly card_fields: readonly string[]
}

export interface KanbanSpec extends DataSpec, CardSpec {
  readonly group_by: string | null
  /** The columns' order, as choice values; a choice it does not name goes last. */
  readonly group_order: readonly string[]
  readonly cover_field: string | null
  readonly hide_empty: boolean
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
}

export interface FormQuestion {
  readonly field: string
  readonly required: boolean
  /** Replaces the field's label in the form; empty keeps it. */
  readonly label: string
  /** Under the question; empty falls back to the field's description. */
  readonly help: string
}

export interface FormSpec {
  readonly title: string
  readonly description: string
  readonly fields: readonly FormQuestion[]
  readonly submit_label: string
  readonly success_message: string
  readonly allow_another: boolean
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
  }
}

export const kanbanSpec = (raw: Raw): KanbanSpec => ({
  ...dataOf(raw),
  ...cardOf(raw),
  group_by: name(raw, 'group_by'),
  group_order: names(raw, 'group_order'),
  cover_field: name(raw, 'cover_field'),
  hide_empty: flag(raw, 'hide_empty', false),
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
})

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
          },
        ]
      })
    : []
  return {
    title: text(raw, 'title'),
    description: text(raw, 'description'),
    fields: questions,
    submit_label: text(raw, 'submit_label'),
    success_message: text(raw, 'success_message'),
    allow_another: flag(raw, 'allow_another', true),
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
/** What a timeline can stack its rows by. */
export const groupFields = (fields: readonly Field[]) =>
  fields.filter((f) => f.kind === 'select' || f.kind === 'link')

/**
 * What a form can ask: every field a person may write. A formula, a column filled by the
 * AI or one the reader may only read has nothing to be typed into.
 */
export const askableFields = (fields: readonly Field[]) =>
  fields.filter((f) => f.read_only !== true && f.ai !== true && f.kind !== 'formula')

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
    case 'form':
    case 'survey':
      return {
        title: table.label,
        description: '',
        // Every field a person can fill, the required ones required: a form that leaves
        // one out could never be sent.
        fields: askableFields(fields).map((f) => ({
          field: f.name,
          required: f.required === true,
          label: '',
          help: '',
        })),
        submit_label: '',
        success_message: '',
        allow_another: true,
      }
  }
}

/** Why a kind cannot be made on this table, or `null` when it can. */
export function unavailableReason(kind: ViewKind, table: Table): string | null {
  const fields = businessFields(table)
  switch (kind) {
    case 'kanban':
      return selectFields(fields).length === 0
        ? 'Il faut un champ « Liste de choix » pour former les colonnes.'
        : null
    case 'calendar':
    case 'timeline':
      return dateFields(fields).length === 0 ? 'Il faut un champ date ou date-heure.' : null
    case 'form':
    case 'survey':
      return askableFields(fields).length === 0 ? 'Aucun champ ne peut être saisi.' : null
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

/** Monday of the week of `date` — the French week. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  return addDays(day, -((day.getDay() + 6) % 7))
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
  return (
    `${start.name} lt ${at(to, start)} and ` +
    `(${end.name} gte ${at(from, end)} or (${end.name} is_null and ${start.name} gte ${at(from, start)}))`
  )
}

/** A filter of the view and a clause of the screen, joined. */
export function andFilter(...parts: readonly string[]): string {
  const kept = parts.map((p) => p.trim()).filter((p) => p !== '')
  if (kept.length <= 1) return kept[0] ?? ''
  return kept.map((p) => `(${p})`).join(' and ')
}
