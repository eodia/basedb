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

const DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 10 })
const INTEGER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const PERCENT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

const currencies = new Map<string, Intl.NumberFormat>()
function currencyFormat(code: string): Intl.NumberFormat {
  let format = currencies.get(code)
  if (format === undefined) {
    try {
      format = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code })
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
  // Trailing zeros are noise, and the decimal point is the one a French keyboard types.
  return raw
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
    .replace('.', ',')
}

/**
 * What a person typed in a number, as the API takes it: a duration read back into seconds,
 * an amount stripped of its symbol, its spaces and its French comma. What does not read as
 * a number goes through as typed — the server's refusal names the field.
 */
export function parseNumberInput(typed: string, field: Pick<Field, 'kind' | 'format'>): unknown {
  if (formatOf(field) === 'duration') {
    const seconds = parseDuration(typed)
    return seconds ?? typed
  }
  const cleaned = typed
    // `\s` includes the no-break spaces the French format puts between thousands.
    .replace(/\s/g, '')
    .replace(/[€$£¥%]|[A-Z]{3}$/gi, '')
    .replace(',', '.')
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
}

export const PRESETS: readonly Preset[] = [
  { value: 'short_text', kind: 'short_text', label: 'Texte court' },
  { value: 'long_text', kind: 'long_text', label: 'Texte long' },
  { value: 'number', kind: 'number', label: 'Nombre' },
  {
    value: 'number:currency',
    kind: 'number',
    format: { display: 'currency', currency: 'EUR' },
    label: 'Monnaie',
  },
  { value: 'number:percent', kind: 'number', format: { display: 'percent' }, label: 'Pourcentage' },
  { value: 'number:duration', kind: 'number', format: { display: 'duration' }, label: 'Durée' },
  {
    value: 'number:rating',
    kind: 'number',
    format: { display: 'rating', rating_max: 5 },
    label: 'Note (étoiles)',
  },
  { value: 'boolean', kind: 'boolean', label: 'Case à cocher' },
  { value: 'date', kind: 'date', label: 'Date' },
  { value: 'datetime', kind: 'datetime', label: 'Date et heure' },
  { value: 'select', kind: 'select', label: 'Liste de choix' },
  { value: 'multi_select', kind: 'multi_select', label: 'Choix multiple' },
  { value: 'user', kind: 'user', label: 'Personne' },
  { value: 'email', kind: 'email', label: 'E-mail' },
  {
    value: 'short_text:phone',
    kind: 'short_text',
    format: { display: 'phone' },
    label: 'Téléphone',
  },
  { value: 'url', kind: 'url', label: 'Lien URL' },
  {
    value: 'short_text:barcode',
    kind: 'short_text',
    format: { display: 'barcode' },
    label: 'Code-barres',
  },
  { value: 'autonumber', kind: 'autonumber', label: 'Numéro automatique' },
  { value: 'file', kind: 'file', label: 'Document' },
  { value: 'image', kind: 'image', label: 'Image' },
  { value: 'formula', kind: 'formula', label: 'Formule' },
  { value: 'lookup', kind: 'lookup', label: 'Recherche' },
  { value: 'rollup', kind: 'rollup', label: 'Cumul' },
  { value: 'count', kind: 'count', label: 'Décompte' },
  { value: 'button', kind: 'button', label: 'Bouton' },
]

export const CURRENCIES: readonly string[] = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY']

/** The formats a field of `kind` can switch between after its creation. */
export function formatsFor(kind: string): ReadonlyArray<readonly [string, string]> {
  if (kind === 'number') {
    return [
      ['decimal', 'Nombre'],
      ['integer', 'Entier'],
      ['currency', 'Monnaie'],
      ['percent', 'Pourcentage'],
      ['duration', 'Durée'],
      ['rating', 'Note (étoiles)'],
    ]
  }
  if (kind === 'short_text') {
    return [
      ['plain', 'Texte'],
      ['phone', 'Téléphone'],
      ['barcode', 'Code-barres'],
    ]
  }
  return []
}
