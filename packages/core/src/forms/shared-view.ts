import type { ProjectedField, ProjectedTable } from '../catalog/projection.js'
import { BasedbError } from '../errors/index.js'

/**
 * A data view read through its link — chapter 15 §10: what the page `/v/<jeton>` shows,
 * and nothing more. The fields are those the view shows AND the publisher may read; the
 * rows those the view's filter keeps, in its order, under the publisher's row predicate.
 */

/** A field as the shared page draws it: its value's kind, its choices, its format. */
export interface SharedViewField {
  readonly name: string
  readonly label: string
  readonly kind: string
  readonly options?: ProjectedField['options']
  readonly format?: {
    readonly display: string
    readonly currency: string | null
    readonly rating_max: number | null
  }
  readonly computed?: { readonly result_kind: string; readonly multiple: boolean }
}

export interface SharedViewPage {
  readonly kind: string
  readonly title: string
  readonly description: string | null
  readonly access: 'public' | 'members'
  readonly reader: string | null
  readonly canEmbed: boolean
  readonly fields: readonly SharedViewField[]
  /** What the page needs of the spec to draw the view — never its filter. */
  readonly spec: Readonly<Record<string, unknown>>
  readonly rows: ReadonlyArray<Record<string, unknown>>
  readonly nextCursor: string | null
}

/** The spec keys that name ONE field the view shows, per kind, in their drawing order. */
const SHOWN_KEYS: Readonly<Record<string, readonly string[]>> = {
  kanban: ['title_field', 'group_by', 'cover_field'],
  calendar: ['title_field', 'date_field', 'end_field', 'color_field'],
  timeline: ['title_field', 'start_field', 'end_field', 'group_by', 'color_field', 'depends_on'],
  gallery: ['title_field', 'cover_field', 'color_field'],
  list: ['title_field', 'group_by'],
}

/** The spec keys the page may read: presentation, never the filter. */
const PAGE_KEYS = [
  'title_field',
  'card_fields',
  'cover_field',
  'cover_fit',
  'card_size',
  'group_by',
  'group_order',
  'date_field',
  'end_field',
  'start_field',
  'color_field',
  'depends_on',
  'mode',
  'scale',
  'column_widths',
  'row_height',
  'manual_order',
]

const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/**
 * The fields a view shows, in its order, among those the publisher reads — the table's
 * projection for the publisher is already cut to what they may see.
 */
export function shownFields(
  kind: string,
  spec: Readonly<Record<string, unknown>>,
  table: ProjectedTable,
): ProjectedField[] {
  const business = table.fields.filter((f) => !f.system)
  const byName = new Map(business.map((f) => [f.name, f]))
  if (kind === 'grid') {
    const hidden = new Set(names(spec.hidden))
    const order = names(spec.column_order)
    const ordered = [
      ...order.map((n) => byName.get(n)).filter((f): f is ProjectedField => f !== undefined),
      ...business.filter((f) => !order.includes(f.name)),
    ]
    return ordered.filter((f) => !hidden.has(f.name))
  }
  const wanted = [
    ...(SHOWN_KEYS[kind] ?? []).map((key) =>
      typeof spec[key] === 'string' ? (spec[key] as string) : null,
    ),
    ...names(spec.card_fields),
  ]
  // A view with no title shows the table's display column, as the application does.
  if (typeof spec.title_field !== 'string' && table.displayField !== null) {
    wanted.unshift(table.displayField)
  }
  const out: ProjectedField[] = []
  for (const name of wanted) {
    const field = name === null ? undefined : byName.get(name)
    if (field !== undefined && !out.includes(field)) out.push(field)
  }
  return out
}

/** A field as the page receives it. */
export function sharedField(field: ProjectedField): SharedViewField {
  return {
    name: field.name,
    label: field.label,
    kind: field.kind,
    ...(field.options === undefined ? {} : { options: field.options }),
    ...(field.format === undefined
      ? {}
      : {
          format: {
            display: field.format.display,
            currency: field.format.currency,
            rating_max: field.format.ratingMax,
          },
        }),
    ...(field.computed === undefined
      ? {}
      : {
          computed: { result_kind: field.computed.resultKind, multiple: field.computed.multiple },
        }),
  }
}

/**
 * The spec as the page may read it: presentation keys naming only fields it shows. The
 * order by hand goes only with a view that has no sort — a sort decides the order then.
 */
export function pageSpec(
  spec: Readonly<Record<string, unknown>>,
  shown: ReadonlySet<string>,
  sorted = false,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of PAGE_KEYS) {
    const value = spec[key]
    if (value === undefined || (sorted && key === 'manual_order')) continue
    if (key.endsWith('_field') || key === 'group_by' || key === 'depends_on') {
      out[key] = typeof value === 'string' && shown.has(value) ? value : null
    } else if (key === 'card_fields') {
      out[key] = names(value).filter((n) => shown.has(n))
    } else {
      out[key] = value
    }
  }
  return out
}

/** Whether a field holds people — a person column, or a lookup that reaches one. */
const holdsPeople = (field: ProjectedField) =>
  field.kind === 'user' || field.computed?.resultKind === 'user'

/** The people the rows name, to be read once by their names. */
export function peopleIn(
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  fields: readonly ProjectedField[],
): string[] {
  const ids = new Set<string>()
  for (const field of fields.filter(holdsPeople)) {
    for (const row of rows) {
      const value = row[field.name]
      for (const id of Array.isArray(value) ? value : [value]) {
        if (typeof id === 'string' && id !== '') ids.add(id)
      }
    }
  }
  return [...ids]
}

/**
 * A row as the page receives it: the shown fields, a relation by its display alone — the
 * identifier of a row of another table is not the reader's to know — and a person by
 * their name alone, never their address.
 */
export function sharedRow(
  row: Readonly<Record<string, unknown>>,
  fields: readonly ProjectedField[],
  people: ReadonlyMap<string, string | null> = new Map(),
): Record<string, unknown> {
  const out: Record<string, unknown> = { _id: row._id }
  const person = (id: unknown) =>
    typeof id === 'string' && id !== '' ? { display: people.get(id) ?? null } : null
  for (const field of fields) {
    const value = row[field.name]
    if (holdsPeople(field)) {
      out[field.name] = Array.isArray(value) ? value.map(person) : person(value)
    } else if (field.kind === 'link') {
      const link = value as { display?: string | null; masked?: boolean } | null
      out[field.name] =
        link === null || link === undefined ? null : { display: link.display ?? null }
    } else if (field.kind === 'multi_link') {
      out[field.name] = Array.isArray(value)
        ? value.map((v) => ({ display: (v as { display?: string | null }).display ?? null }))
        : null
    } else {
      out[field.name] = value
    }
  }
  return out
}

/** The sort of a view, as the list takes it, cut to what the publisher reads. */
export function sortOf(
  spec: Readonly<Record<string, unknown>>,
  readable: ReadonlySet<string>,
): string {
  const sorts = Array.isArray(spec.sorts)
    ? (spec.sorts as Array<{ field?: unknown; direction?: unknown }>)
    : []
  return sorts
    .filter((t) => typeof t.field === 'string' && readable.has(t.field))
    .map((t) => (t.direction === 'desc' ? `-${String(t.field)}` : String(t.field)))
    .join(',')
}

/** A filter that names a field the publisher cannot read closes the page, never widens it. */
export function filterRefused(error: unknown): never {
  if (error instanceof BasedbError && error.code === 'FILTER_FIELD_UNKNOWN') {
    throw new BasedbError('VIEW_SHARE_CLOSED', { details: { reason: 'filtre' } })
  }
  throw error
}
