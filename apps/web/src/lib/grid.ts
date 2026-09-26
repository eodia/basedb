import type { Field } from './api/client'
import { displayStored, isDateKind } from './dates'
import { quoteLiteral } from './expression'

/**
 * What the grid adds on top of rows (chapter 11 §1.6): the quick search, the groups, the
 * summary bar. The rules mirror the kernel's (`records/aggregate.ts`), which refuses what
 * this file would not offer.
 */

export type Aggregate = 'filled' | 'empty' | 'unique' | 'sum' | 'avg' | 'min' | 'max' | 'checked'

export const AGGREGATE_LABELS: Readonly<Record<Aggregate, string>> = {
  filled: 'Remplies',
  empty: 'Vides',
  unique: 'Valeurs uniques',
  sum: 'Somme',
  avg: 'Moyenne',
  min: 'Minimum',
  max: 'Maximum',
  checked: 'Cochées',
}

/** The aggregates a column of `kind` offers, in the menu's order. */
export function aggregatesFor(kind: string): readonly Aggregate[] {
  if (kind === 'boolean') return ['checked', 'filled', 'empty']
  if (kind === 'number') return ['sum', 'avg', 'min', 'max', 'filled', 'empty', 'unique']
  if (kind === 'date' || kind === 'datetime') return ['min', 'max', 'filled', 'empty']
  if (kind === 'autonumber') return ['min', 'max', 'filled', 'empty']
  if (['long_text', 'multi_select', 'multi_link', 'file', 'image'].includes(kind)) {
    return ['filled', 'empty']
  }
  return ['filled', 'empty', 'unique']
}

/** Kinds a grid can be grouped by: one comparable value per row. */
export const GROUPABLE_KINDS: readonly string[] = [
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

const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

/** An aggregate as the bar shows it: a count, a number rounded, a date read day first. */
export function formatAggregate(value: string | number | null, fn: string, field: Field): string {
  if (value === null) return '—'
  if (typeof value === 'number') return NUMBER.format(value)
  if ((fn === 'min' || fn === 'max') && isDateKind(field.kind)) {
    return displayStored(value, field.kind)
  }
  const n = Number(value)
  return Number.isFinite(n) ? NUMBER.format(n) : value
}

/** How many predicates the search may spend: the filter's budget is 32, the view's own comes first. */
const SEARCH_BUDGET = 16

/**
 * The quick search as a filter clause — the text looked for in every column that can hold
 * it, each by the operator its type accepts (chapter 08 §4): `contains` on a text, which
 * the kernel compares without case or accents; the choices whose LABEL holds it, on a list;
 * equality on a number, when the text is one. `''` when nothing can hold it.
 */
/**
 * The system columns a grid can show, as a reader names them (chapter 04 §2.10): when a
 * row was created and last changed, and by whom — a date and time, a person. `_id` is
 * not among them: an identifier is for programs, and the panel shows it to whoever needs it.
 */
const SYSTEM_DISPLAY: Readonly<Record<string, { label: string; kind: string }>> = {
  _created_at: { label: 'Créé le', kind: 'datetime' },
  _updated_at: { label: 'Modifié le', kind: 'datetime' },
  _created_by: { label: 'Créé par', kind: 'user' },
  _updated_by: { label: 'Modifié par', kind: 'user' },
}

/** The system columns of a table, dressed as the read-only fields a grid draws. */
export function systemColumns(fields: readonly Field[]): Field[] {
  return fields.flatMap((field) => {
    const display = field.system === true ? SYSTEM_DISPLAY[field.name] : undefined
    return display === undefined ? [] : [{ ...field, ...display, read_only: true }]
  })
}

export function searchClause(fields: readonly Field[], text: string): string {
  const needle = text.trim()
  if (needle === '') return ''
  const folded = needle
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  const number = Number(needle.replace(',', '.'))
  const parts: string[] = []
  for (const field of fields) {
    if (field.system === true) continue
    if (['short_text', 'long_text', 'url', 'email'].includes(field.kind)) {
      parts.push(`${field.name} contains ${quoteLiteral(needle)}`)
    } else if (field.kind === 'select' || field.kind === 'multi_select') {
      const values = (field.options ?? [])
        .filter((o) =>
          o.label
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .includes(folded),
        )
        .map((o) => quoteLiteral(o.value))
      if (values.length > 0) {
        parts.push(
          `${field.name} ${field.kind === 'select' ? 'in' : 'has_any'} [${values.join(', ')}]`,
        )
      }
    } else if (field.kind === 'number' && needle !== '' && Number.isFinite(number)) {
      parts.push(`${field.name} eq ${number}`)
    }
    if (parts.length >= SEARCH_BUDGET) break
  }
  // Nothing can hold the text: the search then finds nothing, rather than everything.
  if (parts.length === 0) return '_id is_null'
  return parts.length === 1 ? (parts[0] as string) : parts.map((p) => `(${p})`).join(' or ')
}
