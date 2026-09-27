import type { Field, Member } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { $t, $tp, dayLabel, intlLocale, monthLabel, monthNames, weekdayNames } from '@/lib/i18n'
import { memberName } from '@/lib/members'
import { dateFormat } from '@/lib/preferences'
import type {
  QueryResult,
  ResultColumn,
  TemporalUnit,
  VisualizationSettings,
} from '@basedb/contracts'

/**
 * How a result reads — chapter 18 §3: a period as a period (« janv. 2026 », « T2 2026 »),
 * a choice by its label, a person by their name, a relation by its row's display value, an
 * amount in its currency. Pure, to be tested; the charts and the tables share it.
 */

/**
 * What a result's formatting reads of its base: the fields of its tables — a base as the
 * application describes it, or the few fields a shared dashboard's page receives.
 */
export interface FormatBase {
  readonly tables: ReadonlyArray<{ readonly id: string; readonly fields: readonly Field[] }>
}

export interface FormatContext {
  readonly base: FormatBase
  readonly members: readonly Member[]
}

/** The field a column comes from, when it comes from one. */
export function fieldOfColumn(base: FormatBase, column: ResultColumn): Field | undefined {
  const source = column.source
  if (source === undefined) return undefined
  return base.tables.find((t) => t.id === source.table)?.fields.find((f) => f.name === source.field)
}

/** A day as the person reads dates: 14/09/2026 or 2026-09-14. */
export function dayText(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(day)) return day
  const [y, m, d] = [day.slice(0, 4), day.slice(5, 7), day.slice(8, 10)]
  return dateFormat() === 'iso' ? `${y}-${m}-${d}` : `${d}/${m}/${y}`
}

/** A grouped date as the period it stands for. */
export function periodText(value: unknown, unit: TemporalUnit): string {
  if (value === null || value === undefined) return $t('Sans date')
  const text = String(value)
  const year = text.slice(0, 4)
  const month = Number(text.slice(5, 7))
  switch (unit) {
    case 'year':
      return year
    case 'quarter':
      return $t('T{quarter} {year}', { quarter: Math.floor((month - 1) / 3) + 1, year })
    case 'month':
      return monthLabel(Number(year), month)
    case 'week':
      return $t('sem. du {day}', { day: dayLabel(text.slice(0, 10)) })
    case 'day':
      return dayLabel(text.slice(0, 10))
    case 'hour':
    case 'minute':
      return `${dayText(text.slice(0, 10))} ${text.slice(11, 16)}`
    case 'day_of_week':
      return weekdayNames('long')[Number(value) - 1] ?? text
    case 'month_of_year':
      return monthNames('long')[Number(value) - 1] ?? text
    case 'quarter_of_year':
      return $t('T{quarter}', { quarter: text })
    case 'day_of_month':
      return text
    case 'hour_of_day':
      return $t('{hour} h', { hour: text })
    case 'week_of_year':
      return $t('S{week}', { week: text })
  }
}

const INTEGER = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 0 })
const DECIMAL = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 })
const COMPACT = new Intl.NumberFormat(intlLocale(), {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** The aggregate a metric column computes, from its name: `sum:montant` → `sum`. */
export const fnOf = (column: ResultColumn) => column.name.split(':')[0]?.replace(/#\d+$/, '') ?? ''

/** Whether a metric reads in its field's format: a total of amounts is an amount. */
const keepsFormat = (column: ResultColumn) =>
  column.role !== 'metric' ||
  ['sum', 'avg', 'median', 'min', 'max', 'cum_sum'].includes(fnOf(column))

export interface NumberOptions {
  readonly compact?: boolean
  readonly decimals?: number | null
  readonly prefix?: string
  readonly suffix?: string
}

/** A number of a column, in its field's format when it keeps one. */
export function numberText(
  value: number,
  column: ResultColumn,
  field: Field | undefined,
  options: NumberOptions = {},
): string {
  const { prefix = '', suffix = '' } = options
  let text: string
  if (options.compact === true && Math.abs(value) >= 10_000) text = COMPACT.format(value)
  else if (typeof options.decimals === 'number') {
    text = new Intl.NumberFormat(intlLocale(), {
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
    }).format(value)
  } else if (field !== undefined && keepsFormat(column) && field.format !== undefined) {
    text = formatNumber(String(value), field)
  } else if (['count', 'cum_count', 'distinct'].includes(fnOf(column))) {
    text = INTEGER.format(value)
  } else text = DECIMAL.format(value)
  return `${prefix}${text}${suffix}`
}

/** A value of a result, as a cell, a label or a tooltip says it. */
export function valueText(
  column: ResultColumn,
  value: unknown,
  context: FormatContext,
  options: NumberOptions = {},
): string {
  if (value === null || value === undefined || value === '') {
    return column.role === 'dimension' ? $t('Sans valeur') : '—'
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => valueText({ ...column, type: elementType(column.type) }, v, context))
      .join(', ')
  }
  if (column.unit !== undefined) return periodText(value, column.unit)
  const field = fieldOfColumn(context.base, column)
  if (column.bin !== undefined && typeof value === 'number') {
    return `${numberText(value, column, field)} – ${numberText(value + column.bin, column, field)}`
  }
  switch (column.type) {
    case 'number':
    case 'rollup':
    case 'count':
    case 'autonumber': {
      const n = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(n) ? numberText(n, column, field, options) : String(value)
    }
    case 'date':
      return dayText(String(value))
    case 'datetime': {
      const date = new Date(String(value))
      if (Number.isNaN(date.getTime())) return String(value)
      const pad = (n: number) => String(n).padStart(2, '0')
      const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      return `${dayText(day)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    case 'boolean':
      return value === true || value === 'true' ? $t('Oui') : $t('Non')
    case 'select': {
      const option = field?.options?.find((o) => o.value === value)
      return option?.label ?? String(value)
    }
    case 'user':
      // A shared dashboard names its people in the result: its page has no members' list.
      return column.labels?.[String(value)] ?? memberName(context.members, value)
    case 'link':
    case 'multi_link':
    case 'id':
      return column.labels?.[String(value)] ?? `${String(value).slice(0, 8)}…`
    case 'file':
    case 'image': {
      const n = Array.isArray(value) ? value.length : 0
      return $tp(n, '{count} fichier', '{count} fichiers')
    }
    case 'json':
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
    default:
      return String(value)
  }
}

const elementType = (type: string) =>
  type === 'multi_select' ? 'select' : type === 'multi_link' ? 'link' : type

export const numberOptions = (settings: VisualizationSettings | undefined): NumberOptions => ({
  ...(settings?.compact === true ? { compact: true } : {}),
  ...(typeof settings?.decimals === 'number' ? { decimals: settings.decimals } : {}),
  ...(settings?.prefix === undefined ? {} : { prefix: settings.prefix }),
  ...(settings?.suffix === undefined ? {} : { suffix: settings.suffix }),
})

/** An axis tick: short, compact past ten thousand. */
export function axisNumber(value: number): string {
  return Math.abs(value) >= 10_000 ? COMPACT.format(value) : DECIMAL.format(value)
}

// ── Colour ──────────────────────────────────────────────────────────────────

/**
 * Eight hues in a fixed order, validated for colour-blind separation on their surface, one
 * step each for the light and the dark theme. A ninth series is folded into « Autres ».
 */
export const SERIES_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
]
export const SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
]
export const OTHER_COLOR = { light: '#b5b3ad', dark: '#5f5e59' }

/** The single hue of magnitude, light to dark — a choropleth's. */
export const SEQUENTIAL = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
]

export const STATUS = { good: '#0ca30c', critical: '#d03b3b' }

export interface ChartInk {
  readonly text: string
  readonly muted: string
  readonly grid: string
  readonly axis: string
  readonly surface: string
  readonly series: readonly string[]
  readonly other: string
}

export function inkOf(theme: 'light' | 'dark'): ChartInk {
  return theme === 'dark'
    ? {
        text: '#c3c2b7',
        muted: '#898781',
        grid: '#2c2c2a',
        axis: '#383835',
        surface: '#1b1b1f',
        series: SERIES_DARK,
        other: OTHER_COLOR.dark,
      }
    : {
        text: '#52514e',
        muted: '#898781',
        grid: '#e1e0d9',
        axis: '#c3c2b7',
        surface: '#ffffff',
        series: SERIES_LIGHT,
        other: OTHER_COLOR.light,
      }
}

/** A value's colour: a choice's own when it has one, else its rank in the fixed order. */
export function colorOf(
  column: ResultColumn | undefined,
  value: unknown,
  rank: number,
  context: FormatContext,
  ink: ChartInk,
): string {
  if (column !== undefined && column.type === 'select') {
    const option = fieldOfColumn(context.base, column)?.options?.find((o) => o.value === value)
    if (option?.color !== undefined && option.color !== null && option.color !== '')
      return option.color
  }
  if (value === null || value === undefined) return ink.other
  return ink.series[rank % ink.series.length] ?? ink.other
}

// ── Export ──────────────────────────────────────────────────────────────────

/** A result as CSV — `;` separated, as a French spreadsheet opens it. */
export function toCsv(result: QueryResult, context: FormatContext): string {
  const shown = result.columns.map((c, i) => ({ c, i })).filter(({ c }) => c.hidden !== true)
  const quote = (text: string) => (/[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text)
  const lines = [shown.map(({ c }) => quote(c.label)).join(';')]
  for (const row of result.rows) {
    lines.push(
      shown
        .map(({ c, i }) => {
          const value = row[i]
          if (typeof value === 'number' && c.unit === undefined)
            return String(value).replace('.', ',')
          return quote(value === null || value === undefined ? '' : valueText(c, value, context))
        })
        .join(';'),
    )
  }
  // A byte-order mark first: without it, a spreadsheet opens « Créé » as « CrÃ©Ã© ».
  return String.fromCharCode(0xfeff) + lines.join('\r\n')
}
