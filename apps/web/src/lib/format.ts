import { $t, intlLocale } from '@/lib/i18n'
import type { Field } from './api/client'

/**
 * Display formats — chapter 04 §2.11: how a number or a short text READS, never what its
 * column holds. A currency is a number shown with its symbol, a duration a number of
 * seconds shown `h:mm`, a rating a number shown as stars, a phone number a short text one
 * can call. The server stores the format; this file is how the screen honours it, and how
 * what a person types in that form becomes the value again.
 */

export type NumberFormat = 'decimal' | 'integer' | 'percent' | 'currency' | 'duration' | 'rating'
export type TextFormat = 'plain' | 'phone' | 'barcode'

export interface FormatInput {
  readonly display: string
  readonly currency?: string | null
  readonly rating_max?: number | null
}

/** The format a field reads with — `decimal` or `plain` when it says nothing. */
export function formatOf(field: Pick<Field, 'kind' | 'format'>): string {
  return field.format?.display ?? (field.kind === 'number' ? 'decimal' : 'plain')
}

const DECIMAL = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 10 })
const INTEGER = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 0 })
const PERCENT = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 })

const currencies = new Map<string, Intl.NumberFormat>()
function currencyFormat(code: string): Intl.NumberFormat {
  let format = currencies.get(code)
  if (format === undefined) {
    try {
      format = new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: code })
    } catch {
      format = DECIMAL
    }
    currencies.set(code, format)
  }
  return format
}

/** Seconds as `h:mm`, or `h:mm:ss` when they do not fall on a minute. */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const total = Math.round(Math.abs(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  return s === 0 ? `${sign}${h}:${mm}` : `${sign}${h}:${mm}:${String(s).padStart(2, '0')}`
}

/**
 * A duration as typed: `1:30`, `1:30:15`, `90 min`, `1h30`, `2 h`, or a bare number of
 * MINUTES — what a person means when they type `45` in a duration. `null` when it reads as
 * none of these.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.')
  if (t === '') return null
  const clock = /^(-?)(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(t)
  if (clock !== null) {
    const [, sign, h, m, s] = clock
    const total = Number(h) * 3600 + Number(m) * 60 + Number(s ?? 0)
    return sign === '-' ? -total : total
  }
  const hours = /^(\d+(?:\.\d+)?)\s*h\s*(\d{1,2})?\s*(?:min|m)?$/.exec(t)
  if (hours !== null) return Math.round(Number(hours[1]) * 3600 + Number(hours[2] ?? 0) * 60)
  const minutes = /^(\d+(?:\.\d+)?)\s*(?:min|mn|m)?$/.exec(t)
  if (minutes !== null) return Math.round(Number(minutes[1]) * 60)
  const seconds = /^(\d+)\s*s$/.exec(t)
  if (seconds !== null) return Number(seconds[1])
  return null
}

/** A number as its format reads it. The raw decimal string when it is not one. */
export function formatNumber(raw: string, field: Pick<Field, 'kind' | 'format'>): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  switch (formatOf(field)) {
    case 'integer':
      return INTEGER.format(n)
    case 'percent':
      return `${PERCENT.format(n)} %`
    case 'currency':
      return currencyFormat(field.format?.currency ?? 'EUR').format(n)
    case 'duration':
      return formatDuration(n)
    case 'rating': {
      const max = field.format?.rating_max ?? 5
      const stars = Math.max(0, Math.min(max, Math.round(n)))
      return `${'★'.repeat(stars)}${'☆'.repeat(max - stars)}`
    }
    default:
      return DECIMAL.format(n)
  }
}

/**
 * The text an editor opens with: what a person would type, not what the grid shows — a
 * duration as `1:30`, an amount without its symbol or its thousands spaces.
 */
export function editText(value: unknown, field: Pick<Field, 'kind' | 'format'>): string {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  if (field.kind !== 'number') return raw
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (formatOf(field) === 'duration') return formatDuration(n)
  // Trailing zeros are noise, and the decimal mark is the one the reader's language writes.
  return raw
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
    .replace('.', decimalMark())
}

/** The decimal mark of the reader's language: `,` in French, `.` in English. */
export function decimalMark(): string {
  return (
    new Intl.NumberFormat(intlLocale()).formatToParts(1.5).find((part) => part.type === 'decimal')
      ?.value ?? '.'
  )
}

/**
 * A typed number with a decimal POINT, whatever mark and grouping it was typed with:
 * `1 234,5`, `1.234,5`, `1,234.5` all read 1234.5. With both marks, the last one is the
 * decimal one; with one mark alone, groups of exactly three digits after it read as
 * thousands only where the language groups with that mark (`1.234` is 1234 in German,
 * 1.234 in English).
 */
export function normalizeDecimal(typed: string): string {
  const dot = typed.lastIndexOf('.')
  const comma = typed.lastIndexOf(',')
  if (dot >= 0 && comma >= 0) {
    return dot > comma ? typed.replaceAll(',', '') : typed.replaceAll('.', '').replace(',', '.')
  }
  const mark = dot >= 0 ? '.' : comma >= 0 ? ',' : null
  if (mark === null) return typed
  const grouped = new RegExp(`^-?\\d{1,3}(\\${mark}\\d{3})+$`).test(typed)
  if (grouped && decimalMark() !== mark) return typed.replaceAll(mark, '')
  return mark === ',' ? typed.replace(',', '.') : typed
}

/**
 * What a person typed in a number, as the API takes it: a duration read back into seconds,
 * an amount stripped of its symbol, its spaces and its grouping, its decimal mark a point. What does not read as
 * a number goes through as typed — the server's refusal names the field.
 */
export function parseNumberInput(typed: string, field: Pick<Field, 'kind' | 'format'>): unknown {
  if (formatOf(field) === 'duration') {
    const seconds = parseDuration(typed)
    return seconds ?? typed
  }
  const cleaned = normalizeDecimal(
    typed
      // `\s` includes the no-break spaces the French format puts between thousands.
      .replace(/\s/g, '')
      .replace(/[€$£¥%]|[A-Z]{3}$/gi, ''),
  )
  const n = Number(cleaned)
  return cleaned !== '' && Number.isFinite(n) ? n : typed
}

/**
 * What the « Nouveau champ » dialog offers: the types, and the formats that read as types
 * to a person — a currency is a type to whoever creates one, whatever the column is.
 */
export interface Preset {
  readonly value: string
  readonly kind: string
  readonly format?: FormatInput
  readonly label: string
  /** A long text holding HTML (chapter 04 §2.2). */
  readonly rich?: boolean
}

export const PRESETS: readonly Preset[] = [
  { value: 'short_text', kind: 'short_text', label: $t('Texte court') },
  { value: 'long_text', kind: 'long_text', label: $t('Texte long') },
  { value: 'long_text:rich', kind: 'long_text', label: $t('Texte riche (HTML)'), rich: true },
  { value: 'number', kind: 'number', label: $t('Nombre') },
  {
    value: 'number:currency',
    kind: 'number',
    format: { display: 'currency', currency: 'EUR' },
    label: $t('Monnaie'),
  },
  {
    value: 'number:percent',
    kind: 'number',
    format: { display: 'percent' },
    label: $t('Pourcentage'),
  },
  { value: 'number:duration', kind: 'number', format: { display: 'duration' }, label: $t('Durée') },
  {
    value: 'number:rating',
    kind: 'number',
    format: { display: 'rating', rating_max: 5 },
    label: $t('Note (étoiles)'),
  },
  { value: 'boolean', kind: 'boolean', label: $t('Case à cocher') },
  { value: 'date', kind: 'date', label: $t('Date') },
  { value: 'datetime', kind: 'datetime', label: $t('Date et heure') },
  { value: 'select', kind: 'select', label: $t('Liste de choix') },
  { value: 'multi_select', kind: 'multi_select', label: $t('Choix multiple') },
  { value: 'user', kind: 'user', label: $t('Personne') },
  { value: 'email', kind: 'email', label: $t('E-mail') },
  {
    value: 'short_text:phone',
    kind: 'short_text',
    format: { display: 'phone' },
    label: $t('Téléphone'),
  },
  { value: 'url', kind: 'url', label: $t('Lien URL') },
  {
    value: 'short_text:barcode',
    kind: 'short_text',
    format: { display: 'barcode' },
    label: $t('Code-barres'),
  },
  { value: 'autonumber', kind: 'autonumber', label: $t('Numéro automatique') },
  { value: 'file', kind: 'file', label: $t('Document') },
  { value: 'image', kind: 'image', label: $t('Image') },
  { value: 'formula', kind: 'formula', label: $t('Formule') },
  { value: 'lookup', kind: 'lookup', label: $t('Recherche') },
  { value: 'rollup', kind: 'rollup', label: $t('Cumul') },
  { value: 'count', kind: 'count', label: $t('Décompte') },
  { value: 'button', kind: 'button', label: $t('Bouton') },
]

export const CURRENCIES: readonly string[] = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY']

/** The formats a field of `kind` can switch between after its creation. */
export function formatsFor(kind: string): ReadonlyArray<readonly [string, string]> {
  if (kind === 'number') {
    return [
      ['decimal', $t('Nombre')],
      ['integer', $t('Entier')],
      ['currency', $t('Monnaie')],
      ['percent', $t('Pourcentage')],
      ['duration', $t('Durée')],
      ['rating', $t('Note (étoiles)')],
    ]
  }
  if (kind === 'short_text') {
    return [
      ['plain', $t('Texte')],
      ['phone', $t('Téléphone')],
      ['barcode', $t('Code-barres')],
    ]
  }
  return []
}
