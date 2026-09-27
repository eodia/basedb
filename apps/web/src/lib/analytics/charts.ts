import { $t } from '@/lib/i18n'
import {
  type QueryResult,
  type ResultColumn,
  type Visualization,
  type VisualizationSettings,
  ruleColor,
} from '@basedb/contracts'
import type { EChartsOption, SeriesOption } from 'echarts'
import {
  type ChartInk,
  type FormatContext,
  axisNumber,
  colorOf,
  fieldOfColumn,
  numberOptions,
  numberText,
  valueText,
} from './format'

/**
 * A result as a chart — chapter 18 §3: what goes on the axis, what makes the series, and
 * the options echarts draws them from. Thin marks, one axis unless one is asked for, a
 * legend as soon as there are two series, the text in the text's ink, never the series'.
 * Pure, to be tested: the component only hands the options to echarts.
 */

export interface Category {
  readonly value: unknown
  readonly label: string
  /** A period the result has no row for, put back so the axis keeps time's pace. */
  readonly missing?: boolean
}

export interface Series {
  readonly key: string
  readonly label: string
  readonly color: string
  readonly metric: ResultColumn
  readonly values: ReadonlyArray<number | null>
  /** The value of the splitting dimension this series stands for. */
  readonly split?: { readonly column: ResultColumn; readonly value: unknown }
  readonly display?: 'bar' | 'line' | 'area'
  readonly axis?: 'left' | 'right'
}

export interface ChartModel {
  readonly dimension: ResultColumn | null
  readonly split: ResultColumn | null
  readonly categories: readonly Category[]
  readonly series: readonly Series[]
}

/**
 * Text written into a tooltip, which echarts reads as HTML: a label comes from the data —
 * a client's name, a task's title — and must never become markup.
 */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const MAX_SERIES = 8
const MAX_SLICES = 8

const byName = (result: QueryResult, names: readonly string[] | undefined) =>
  (names ?? []).map((n) => result.columns.findIndex((c) => c.name === n)).filter((i) => i >= 0)

/** The columns a chart draws: those the settings name, or the result's own roles. */
export function roles(result: QueryResult, settings: VisualizationSettings | undefined) {
  const shown = result.columns.map((c, i) => ({ c, i })).filter(({ c }) => c.hidden !== true)
  let dims = byName(result, settings?.dimensions)
  let metrics = byName(result, settings?.metrics)
  if (dims.length === 0) dims = shown.filter(({ c }) => c.role !== 'metric').map(({ i }) => i)
  if (metrics.length === 0) metrics = shown.filter(({ c }) => c.role === 'metric').map(({ i }) => i)
  // A result without aggregates — SQL, rows as they are — draws its numbers.
  if (metrics.length === 0) {
    metrics = shown.filter(({ c, i }) => c.type === 'number' && !dims.includes(i)).map(({ i }) => i)
    if (metrics.length === 0 && dims.length > 1) {
      const last = dims[dims.length - 1] as number
      if (result.columns[last]?.type === 'number') {
        metrics = [last]
        dims = dims.slice(0, -1)
      }
    }
  }
  return { dims, metrics }
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

const keyOf = (value: unknown) =>
  value === null || value === undefined ? '\u0000' : JSON.stringify(value)

const PERIODS = new Set(['day', 'week', 'month', 'quarter', 'year'])
const DAY = /^\d{4}-\d{2}-\d{2}$/

function nextPeriod(day: string, unit: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  if (unit === 'day') d.setUTCDate(d.getUTCDate() + 1)
  else if (unit === 'week') d.setUTCDate(d.getUTCDate() + 7)
  else d.setUTCMonth(d.getUTCMonth() + (unit === 'month' ? 1 : unit === 'quarter' ? 3 : 12))
  return d.toISOString().slice(0, 10)
}

/**
 * The periods between the first and the last, each once: a month without a row is a month
 * all the same, and a line that skipped it would lie about the pace of time.
 */
function withMissingPeriods(
  categories: Category[],
  column: ResultColumn,
  context: FormatContext,
): Category[] {
  const unit = column.unit
  if (unit === undefined || !PERIODS.has(unit)) return categories
  const dated = categories.filter((c) => typeof c.value === 'string' && DAY.test(c.value))
  if (dated.length < 2 || dated.length !== categories.filter((c) => c.value !== null).length)
    return categories
  const days = dated.map((c) => c.value as string).sort()
  const known = new Map(dated.map((c) => [c.value as string, c]))
  const out: Category[] = []
  let day = days[0] as string
  const last = days[days.length - 1] as string
  while (day <= last && out.length < 1000) {
    out.push(
      known.get(day) ?? { value: day, label: valueText(column, day, context), missing: true },
    )
    day = nextPeriod(day, unit)
  }
  if (out.length >= 1000) return categories
  return [...out, ...categories.filter((c) => c.value === null)]
}

/** What a missing period is worth: nothing counted, a running total unchanged, else no value. */
function fillMissing(series: Series[], categories: readonly Category[]): Series[] {
  if (!categories.some((c) => c.missing === true)) return series
  return series.map((s) => {
    const fn = s.metric.name.split(':')[0]?.replace(/#\d+$/, '') ?? ''
    const values = [...s.values]
    for (const [i, category] of categories.entries()) {
      if (category.missing !== true) continue
      if (fn === 'count' || fn === 'sum' || fn === 'distinct') values[i] = 0
      else if (fn === 'cum_count' || fn === 'cum_sum')
        values[i] = i > 0 ? (values[i - 1] ?? null) : null
    }
    return { ...s, values }
  })
}

/** Categories of a choice in the order of its options, when the query did not sort. */
function inOptionOrder(
  categories: Category[],
  column: ResultColumn,
  context: FormatContext,
): Category[] {
  if (column.type !== 'select') return categories
  const options = fieldOfColumn(context.base, column)?.options ?? []
  const rank = (value: unknown) => {
    const i = options.findIndex((o) => o.value === value)
    return i < 0 ? options.length + (value === null ? 1 : 0) : i
  }
  return [...categories].sort((a, b) => rank(a.value) - rank(b.value))
}

export function chartModel(
  result: QueryResult,
  visualization: Visualization,
  context: FormatContext,
  ink: ChartInk,
  sorted: boolean,
): ChartModel {
  const settings = visualization.settings
  const { dims, metrics } = roles(result, settings)
  const dimIndex = dims[0]
  const splitIndex = dims[1]
  const dimension = dimIndex === undefined ? null : (result.columns[dimIndex] as ResultColumn)
  const split = splitIndex === undefined ? null : (result.columns[splitIndex] as ResultColumn)

  const seen = new Map<string, Category>()
  for (const row of result.rows) {
    const value = dimIndex === undefined ? null : row[dimIndex]
    const key = keyOf(value)
    if (!seen.has(key)) {
      seen.set(key, {
        value,
        label: dimension === null ? '' : valueText(dimension, value, context),
      })
    }
  }
  let categories = [...seen.values()]
  if (!sorted && dimension !== null) {
    categories = inOptionOrder(categories, dimension, context)
    if (
      settings?.fill_periods !== false &&
      settings?.sort_values !== 'asc' &&
      settings?.sort_values !== 'desc'
    ) {
      categories = withMissingPeriods(categories, dimension, context)
    }
  }
  const position = new Map(categories.map((c, i) => [keyOf(c.value), i]))
  const seriesSettings = settings?.series ?? {}

  if (split !== null && splitIndex !== undefined) {
    // One series per value of the second dimension, the first measure in each; past eight,
    // « Autres ».
    const metricIndex = metrics[0]
    const metric = metricIndex === undefined ? null : (result.columns[metricIndex] as ResultColumn)
    if (metric === null || metricIndex === undefined)
      return { dimension, split, categories, series: [] }
    const totals = new Map<string, { value: unknown; total: number }>()
    for (const row of result.rows) {
      const key = keyOf(row[splitIndex])
      const entry = totals.get(key) ?? { value: row[splitIndex], total: 0 }
      entry.total += Math.abs(toNumber(row[metricIndex]) ?? 0)
      totals.set(key, entry)
    }
    let order = [...totals.values()]
    if (split.type === 'select' || split.unit !== undefined) {
      order = inOptionOrder(
        order.map((o) => ({ value: o.value, label: '' })),
        split,
        context,
      ).map((c) => totals.get(keyOf(c.value)) as { value: unknown; total: number })
    } else order.sort((a, b) => b.total - a.total)
    const kept = order.slice(0, MAX_SERIES)
    const keptKeys = new Set(kept.map((k) => keyOf(k.value)))
    const hasOther = order.length > kept.length
    const series: Series[] = kept.map((k, rank) => {
      const label = valueText(split, k.value, context)
      const own = seriesSettings[label] ?? {}
      return {
        key: `split:${keyOf(k.value)}`,
        label: own.label ?? label,
        color: own.color ?? colorOf(split, k.value, rank, context, ink),
        metric,
        values: categories.map(() => null),
        split: { column: split, value: k.value },
        ...(own.display === undefined ? {} : { display: own.display }),
        ...(own.axis === undefined ? {} : { axis: own.axis }),
      }
    })
    const other: Series | null = hasOther
      ? {
          key: 'other',
          label: $t('Autres'),
          color: ink.other,
          metric,
          values: categories.map(() => null),
        }
      : null
    const cells = new Map<string, Array<number | null>>()
    for (const s of [...series, ...(other === null ? [] : [other])]) cells.set(s.key, [...s.values])
    for (const row of result.rows) {
      const at = position.get(keyOf(dimIndex === undefined ? null : row[dimIndex]))
      if (at === undefined) continue
      const key = keptKeys.has(keyOf(row[splitIndex])) ? `split:${keyOf(row[splitIndex])}` : 'other'
      const list = cells.get(key)
      if (list === undefined) continue
      const n = toNumber(row[metricIndex])
      list[at] = n === null ? (list[at] ?? null) : (list[at] ?? 0) + n
    }
    return sortedModel(
      {
        dimension,
        split,
        categories,
        series: fillMissing(
          [...series, ...(other === null ? [] : [other])].map((s) => ({
            ...s,
            values: cells.get(s.key) ?? s.values,
          })),
          categories,
        ),
      },
      settings?.sort_values,
    )
  }

  const series: Series[] = metrics.map((index, rank) => {
    const metric = result.columns[index] as ResultColumn
    const own = seriesSettings[metric.name] ?? {}
    const values: Array<number | null> = categories.map(() => null)
    for (const row of result.rows) {
      const at = position.get(keyOf(dimIndex === undefined ? null : row[dimIndex]))
      if (at !== undefined) values[at] = toNumber(row[index])
    }
    return {
      key: metric.name,
      label: own.label ?? metric.label,
      color:
        own.color ??
        (metrics.length === 1 ? settings?.color : undefined) ??
        ink.series[rank % ink.series.length] ??
        ink.other,
      metric,
      values,
      ...(own.display === undefined ? {} : { display: own.display }),
      ...(own.axis === undefined ? {} : { axis: own.axis }),
    }
  })
  return sortedModel(
    { dimension, split, categories, series: fillMissing(series, categories) },
    settings?.sort_values,
  )
}

/** The categories by the height of their bar — their total over the series — when asked. */
function sortedModel(model: ChartModel, order: VisualizationSettings['sort_values']): ChartModel {
  if (order !== 'asc' && order !== 'desc') return model
  const totals = model.categories.map((_, i) =>
    model.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  )
  const ranks = model.categories
    .map((_, i) => i)
    .sort((a, b) => (order === 'asc' ? 1 : -1) * ((totals[a] ?? 0) - (totals[b] ?? 0)))
  return {
    ...model,
    categories: ranks.map((i) => model.categories[i] as Category),
    series: model.series.map((s) => ({ ...s, values: ranks.map((i) => s.values[i] ?? null) })),
  }
}

// ── Options ─────────────────────────────────────────────────────────────────

const tooltipStyle = (ink: ChartInk) => ({
  backgroundColor: ink.surface,
  borderColor: ink.grid,
  borderWidth: 1,
  padding: [6, 10] as [number, number],
  textStyle: { color: ink.text, fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 16px rgb(0 0 0 / 0.12); border-radius: 8px;',
})

type LegendPlace = 'top' | 'bottom' | 'left' | 'right'

/** Where the legend goes, and the room the plot leaves it. */
function legendAt(
  place: LegendPlace,
  ink: ChartInk,
  names: readonly string[] | undefined,
  scroll = true,
) {
  const common = {
    type: scroll ? ('scroll' as const) : ('plain' as const),
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: place === 'left' || place === 'right' ? 8 : 14,
    textStyle: { color: ink.text, fontSize: 12 },
    pageTextStyle: { color: ink.muted },
    ...(names === undefined ? {} : { data: [...names] }),
  }
  switch (place) {
    case 'bottom':
      return { ...common, bottom: 0, left: 'center' }
    case 'left':
      return { ...common, orient: 'vertical' as const, left: 0, top: 'middle' }
    case 'right':
      return { ...common, orient: 'vertical' as const, right: 0, top: 'middle' }
    default:
      return { ...common, top: 0, left: 0 }
  }
}

function legendOf(model: ChartModel, ink: ChartInk, settings: VisualizationSettings | undefined) {
  if (model.series.length <= 1 || settings?.legend === false) return undefined
  const place: LegendPlace =
    settings?.legend_position === undefined || settings.legend_position === 'auto'
      ? 'top'
      : settings.legend_position
  return {
    place,
    option: legendAt(
      place,
      ink,
      model.series.map((s) => s.label),
    ),
  }
}

export interface OptionContext {
  readonly format: FormatContext
  readonly ink: ChartInk
  readonly width: number
  /** The chart's height, when known: a pie sizes itself by the room it has. */
  readonly height?: number
}

interface AxisLook {
  readonly show?: boolean
  readonly grid?: boolean
  readonly min?: number | null
  readonly max?: number | null
  readonly log?: boolean
}

const valueAxis = (ink: ChartInk, percent: boolean, name?: string, look: AxisLook = {}) => ({
  type: look.log === true && !percent ? ('log' as const) : ('value' as const),
  ...(name === undefined || name === '' ? {} : { name, nameTextStyle: { color: ink.muted } }),
  ...(typeof look.min === 'number' ? { min: look.min } : {}),
  ...(typeof look.max === 'number' ? { max: look.max } : {}),
  axisLabel: {
    show: look.show !== false,
    color: ink.muted,
    fontSize: 11,
    formatter: (v: number) => (percent ? `${Math.round(v)} %` : axisNumber(v)),
  },
  splitLine: { show: look.grid !== false, lineStyle: { color: ink.grid, width: 1 } },
  axisLine: { show: false },
  axisTick: { show: false },
})

const categoryAxis = (
  model: ChartModel,
  ink: ChartInk,
  name?: string,
  look: { readonly show?: boolean; readonly rotate?: number } = {},
) => ({
  type: 'category' as const,
  data: model.categories.map((c) => c.label),
  ...(name === undefined || name === ''
    ? {}
    : { name, nameLocation: 'middle' as const, nameGap: 28 }),
  axisLabel: {
    show: look.show !== false,
    color: ink.muted,
    fontSize: 11,
    hideOverlap: true,
    rotate: look.rotate ?? 0,
  },
  axisLine: { lineStyle: { color: ink.axis } },
  axisTick: { show: false },
})

const BAR_WIDTH = { thin: 12, normal: 24, wide: 56 } as const

/** The options of a chart on axes: columns, bars, lines, areas, and their mix. */
export function axisOption(
  model: ChartModel,
  visualization: Visualization,
  { format, ink }: OptionContext,
): EChartsOption {
  const type = visualization.type
  const settings = visualization.settings
  const horizontal = type === 'row'
  const stack = settings?.stack ?? 'none'
  const percent = stack === 'percent'
  const stacked = stack !== 'none'
  const totals = model.categories.map((_, i) =>
    model.series.reduce((sum, s) => sum + Math.abs(s.values[i] ?? 0), 0),
  )
  const right = model.series.some((s) => s.axis === 'right')
  const many = model.categories.length > 24
  const options = numberOptions(settings)
  const markers = settings?.markers ?? 'auto'
  const lineStyle = settings?.line_style ?? 'straight'
  const barWidth = BAR_WIDTH[settings?.bar_width ?? 'normal']
  const show = (s: Series, v: number | null) =>
    v === null
      ? ''
      : percent
        ? `${Math.round(v)} %`
        : numberText(v, s.metric, fieldOfColumn(format.base, s.metric), options)

  const series: SeriesOption[] = model.series.map((s, index) => {
    const display =
      type === 'combo'
        ? (s.display ?? (index === 0 ? 'bar' : 'line'))
        : type === 'line'
          ? 'line'
          : type === 'area'
            ? 'area'
            : 'bar'
    // Stacked, an empty cell is nothing on the pile — else the pile breaks there.
    const data = s.values.map((raw, i) => {
      const v = stacked && raw === null ? 0 : raw
      return percent && v !== null
        ? (totals[i] ?? 0) === 0
          ? 0
          : (v / (totals[i] as number)) * 100
        : v
    })
    const inside = stacked && display === 'bar'
    const label = {
      show: settings?.values === true,
      position: (inside ? 'inside' : horizontal ? 'right' : 'top') as 'right' | 'top' | 'inside',
      color: inside ? '#ffffff' : ink.text,
      fontSize: 11,
      formatter: (p: { value: unknown }) => show(s, typeof p.value === 'number' ? p.value : null),
    }
    const common = {
      name: s.label,
      data,
      yAxisIndex: s.axis === 'right' && !horizontal ? 1 : 0,
      ...(stacked ? { stack: 'total' } : {}),
      label,
      emphasis: { focus: 'series' as const },
    }
    if (display === 'bar') {
      return {
        ...common,
        type: 'bar',
        barMaxWidth: barWidth,
        ...(settings?.bar_width === 'wide' ? { barCategoryGap: '18%' } : {}),
        itemStyle: {
          color: s.color,
          // The data end rounded, the baseline square; a stack's segments parted by a gap.
          borderRadius: stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          ...(stacked ? { borderColor: ink.surface, borderWidth: 1 } : {}),
        },
      }
    }
    return {
      ...common,
      type: 'line',
      ...(lineStyle === 'smooth'
        ? { smooth: true }
        : lineStyle === 'step'
          ? { step: 'middle' as const }
          : {}),
      lineStyle: { width: 2, color: s.color },
      itemStyle: { color: s.color, borderColor: ink.surface, borderWidth: 2 },
      symbol: 'circle',
      symbolSize: 8,
      showSymbol:
        markers === 'always' ? true : markers === 'never' ? false : model.categories.length <= 24,
      ...(display === 'area'
        ? { areaStyle: { color: s.color, opacity: stacked ? 0.35 : 0.12 } }
        : {}),
    }
  })

  // The total of each stack, above it: an empty series whose label says the sum.
  const first = model.series[0]
  if (stacked && !percent && settings?.stack_totals === true && first !== undefined) {
    series.push({
      name: '__total',
      type: 'bar',
      stack: 'total',
      data: model.categories.map(() => 0),
      barMaxWidth: barWidth,
      itemStyle: { color: 'transparent' },
      tooltip: { show: false },
      silent: true,
      label: {
        show: true,
        position: horizontal ? 'right' : 'top',
        color: ink.text,
        fontSize: 11,
        fontWeight: 600,
        // An empty period says nothing above its missing stack.
        formatter: (p: { dataIndex: number }) => {
          const total = totals[p.dataIndex] ?? 0
          return total === 0 ? '' : show(first, total)
        },
      },
    })
  }

  const goal = settings?.goal
  if (typeof goal === 'number' && series[0] !== undefined) {
    const lead = series[0] as Record<string, unknown>
    lead.markLine = {
      silent: true,
      symbol: 'none',
      lineStyle: { color: ink.muted, type: 'solid', width: 1 },
      label: { formatter: settings?.goal_label || $t('Objectif'), color: ink.muted, fontSize: 11 },
      data: [horizontal ? { xAxis: goal } : { yAxis: goal }],
    }
  }

  const categories = categoryAxis(model, ink, settings?.x_label, {
    show: horizontal ? settings?.y_axis : settings?.x_axis,
    ...(horizontal ? {} : { rotate: settings?.x_rotate ?? 0 }),
  })
  const look: AxisLook = {
    show: horizontal ? settings?.x_axis : settings?.y_axis,
    grid: settings?.grid_lines,
    min: settings?.y_min ?? null,
    max: settings?.y_max ?? null,
    log: settings?.y_scale === 'log',
  }
  const values = valueAxis(ink, percent, settings?.y_label, look)
  const legend = legendOf(model, ink, settings)
  const bottomLegend = legend?.place === 'bottom' ? 28 : 0
  return {
    animationDuration: 300,
    textStyle: { fontFamily: 'inherit' },
    grid: {
      left: legend?.place === 'left' ? 120 : 4,
      right: legend?.place === 'right' ? 120 : horizontal ? 32 : 12,
      top: legend?.place === 'top' ? 36 : 16,
      bottom: (many ? 28 : 4) + bottomLegend,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    legend: legend?.option,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: horizontal || type === 'bar' ? 'shadow' : 'line',
        lineStyle: { color: ink.axis },
      },
      ...tooltipStyle(ink),
      // Each series in its own format — an amount in its currency — under its period.
      formatter: (raw: unknown) => {
        const items = (Array.isArray(raw) ? raw : [raw]) as Array<{
          seriesIndex: number
          dataIndex: number
          marker: string
          seriesName: string
          value: unknown
        }>
        const head = model.categories[items[0]?.dataIndex ?? -1]?.label ?? ''
        const lines = items
          .filter((item) => item.seriesName !== '__total')
          .map((item) => {
            const s = model.series[item.seriesIndex]
            const v = typeof item.value === 'number' ? item.value : null
            const text =
              s === undefined || v === null ? '—' : percent ? `${v.toFixed(1)} %` : show(s, v)
            return `${item.marker}${escapeHtml(item.seriesName)}<span style="float:right;margin-left:16px;font-weight:600">${text}</span>`
          })
        return [`<div style="margin-bottom:2px">${escapeHtml(head)}</div>`, ...lines].join('<br/>')
      },
    },
    ...(many && !horizontal
      ? {
          dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 14, bottom: 4 + bottomLegend, borderColor: ink.grid },
          ],
        }
      : {}),
    xAxis: horizontal ? values : categories,
    yAxis: horizontal
      ? { ...categories, inverse: true }
      : right
        ? [
            values,
            {
              ...valueAxis(ink, percent, undefined, { ...look, min: null, max: null }),
              splitLine: { show: false },
            },
          ]
        : values,
    series,
  }
}

const clamp = (value: number | undefined, low: number, high: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), low), high)
    : fallback

/**
 * A pie or a ring: its slices, the largest first unless asked otherwise, past a number of
 * them « Autres »; each slice its colour, its name, what it says on itself; the total in
 * the middle; a half ring, a rose.
 */
export function pieOption(
  result: QueryResult,
  visualization: Visualization,
  { format, ink, width, height = 0 }: OptionContext,
): EChartsOption {
  const settings = visualization.settings
  const { dims, metrics } = roles(result, settings)
  const d = dims[0]
  const m = metrics[0]
  if (d === undefined || m === undefined) return {}
  const metric = result.columns[m] as ResultColumn
  const slices = pieSlices(result, visualization, format, ink)
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const field = fieldOfColumn(format.base, metric)
  const options = numberOptions(settings)
  const data = slices.map((s) => ({
    name: s.label,
    value: s.value,
    raw: s.raw,
    itemStyle: { color: s.color },
  }))
  const share = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100))

  const donut = settings?.donut !== false
  const half = settings?.half === true
  const rose = settings?.rose === true
  const place: LegendPlace | null =
    settings?.legend === false
      ? null
      : settings?.legend_position === undefined || settings.legend_position === 'auto'
        ? width >= 420
          ? 'left'
          : 'bottom'
        : settings.legend_position
  const center: [string, string] = half
    ? ['50%', place === 'bottom' ? '66%' : '74%']
    : place === 'left'
      ? ['64%', '50%']
      : place === 'right'
        ? ['36%', '50%']
        : place === 'bottom'
          ? ['50%', '44%']
          : place === 'top'
            ? ['50%', '56%']
            : ['50%', '50%']
  // The radius the room allows, in pixels once the size is known: beside the legend a ring
  // has 72 % of the width, above or under it 76 % of the height — a percentage alone reads
  // the smaller side, and overflows a narrow card whose legend takes part of its width.
  const room =
    width > 0 && height > 0
      ? half
        ? Math.min((width * (place === 'left' || place === 'right' ? 0.72 : 1)) / 2, height * 0.62)
        : Math.min(
            (width * (place === 'left' || place === 'right' ? 0.72 : 1)) / 2,
            (height * (place === 'top' || place === 'bottom' ? 0.76 : 1)) / 2,
          )
      : null
  const mode = settings?.slice_labels ?? 'none'
  const outside = settings?.labels_outside === true
  // Labels beside the ring take room from it.
  const fill = outside && mode !== 'none' ? 0.66 : half ? 0.96 : 0.88
  const outer =
    room === null
      ? outside && mode !== 'none'
        ? 62
        : half
          ? 118
          : place === 'top' || place === 'bottom'
            ? 76
            : 82
      : Math.round(room * fill)
  const unit = room === null ? '%' : ''
  const inner = donut ? Math.round(outer * (1 - clamp(settings?.ring_width, 10, 70, 32) / 100)) : 0
  const sliceText = (item: { name: string; value: number }) => {
    const amount = numberText(item.value, metric, field, { ...options, compact: true })
    switch (mode) {
      case 'percent':
        return `${share(item.value)} %`
      case 'value':
        return amount
      case 'name':
        return item.name
      case 'name_percent':
        return `${item.name} · ${share(item.value)} %`
      case 'name_value':
        return `${item.name} · ${amount}`
      default:
        return ''
    }
  }
  const showTotal = donut && !rose && settings?.total !== false
  const totalSize = room === null ? 18 : Math.min(Math.max(Math.round(inner * 0.3), 14), 32)
  const legendValues = settings?.legend_values !== false

  return {
    animationDuration: 300,
    textStyle: { fontFamily: 'inherit' },
    tooltip: {
      trigger: 'item',
      ...tooltipStyle(ink),
      formatter: (p: unknown) => {
        const item = p as { name: string; value: number; percent: number }
        return `${escapeHtml(item.name)}<br/><b>${numberText(item.value, metric, field, options)}</b> · ${item.percent.toFixed(0)} %`
      },
    },
    ...(place === null
      ? {}
      : {
          legend: {
            // Beside the ring, a list that scrolls; above or under it, lines that wrap.
            ...legendAt(place, ink, undefined, place === 'left' || place === 'right'),
            formatter: (name: string) => {
              const slice = data.find((s) => s.name === name)
              return slice === undefined || !legendValues
                ? name
                : `${name}  ${share(slice.value)} %`
            },
          },
        }),
    ...(showTotal
      ? {
          title: {
            text: numberText(total, metric, field, { ...options, compact: true }),
            subtext: $t('Total'),
            left: center[0],
            top: half ? `${Number.parseInt(center[1], 10) - 12}%` : center[1],
            textAlign: 'center',
            textVerticalAlign: 'middle',
            itemGap: 2,
            textStyle: {
              color: ink.text,
              fontSize: totalSize,
              lineHeight: Math.round(totalSize * 1.15),
              fontWeight: 600,
            },
            subtextStyle: {
              color: ink.muted,
              fontSize: totalSize > 24 ? 13 : 11,
              lineHeight: totalSize > 24 ? 16 : 14,
            },
          },
        }
      : {}),
    series: [
      {
        type: 'pie',
        radius: [`${inner}${unit}`, `${outer}${unit}`],
        center,
        ...(half ? { startAngle: 180, endAngle: 360 } : {}),
        ...(rose ? { roseType: 'radius' as const } : {}),
        data,
        label: {
          show: mode !== 'none',
          position: outside ? 'outside' : 'inside',
          color: outside ? ink.text : '#ffffff',
          fontSize: 11,
          ...(outside ? {} : { textBorderColor: 'rgba(0,0,0,0.25)', textBorderWidth: 2 }),
          formatter: (p: unknown) => sliceText(p as { name: string; value: number }),
        },
        labelLine: {
          show: outside && mode !== 'none',
          length: 8,
          length2: 8,
          lineStyle: { color: ink.axis },
        },
        itemStyle: {
          borderColor: ink.surface,
          borderWidth: 2,
          ...(donut ? { borderRadius: 3 } : {}),
        },
        emphasis: { scaleSize: 4 },
      },
    ],
  }
}

export interface Slice {
  /** What the settings call it: its value read as text. */
  readonly key: string
  readonly label: string
  readonly value: number
  readonly raw: unknown
  readonly color: string
}

/**
 * The slices of a pie as they are drawn — sorted or not, past the maximum folded into
 * « Autres », each with its own colour and name when the settings give one. The settings
 * panel lists the same, to colour them one by one.
 */
export function pieSlices(
  result: QueryResult,
  visualization: Visualization,
  format: FormatContext,
  ink: ChartInk,
): Slice[] {
  const settings = visualization.settings
  const { dims, metrics } = roles(result, settings)
  const d = dims[0]
  const m = metrics[0]
  if (d === undefined || m === undefined) return []
  const dimension = result.columns[d] as ResultColumn
  const most = clamp(settings?.slices_max, 2, 12, MAX_SLICES)
  const rows = result.rows
    .map((row) => ({ raw: row[d], value: toNumber(row[m]) ?? 0 }))
    .filter((s) => s.value > 0)
  if (settings?.sort_slices !== false) rows.sort((a, b) => b.value - a.value)
  const own = settings?.series ?? {}
  const kept: Slice[] = rows.slice(0, most).map((s, rank) => {
    const key = valueText(dimension, s.raw, format)
    return {
      key,
      label: own[key]?.label ?? key,
      value: s.value,
      raw: s.raw,
      color: own[key]?.color ?? colorOf(dimension, s.raw, rank, format, ink),
    }
  })
  const rest = rows.slice(most).reduce((sum, s) => sum + s.value, 0)
  if (rest > 0) {
    kept.push({
      key: 'Autres',
      label: own.Autres?.label ?? $t('Autres'),
      value: rest,
      raw: undefined,
      color: own.Autres?.color ?? ink.other,
    })
  }
  return kept
}

/** A funnel: its stages from the largest down, each with its share of the first. */
export function funnelOption(
  result: QueryResult,
  visualization: Visualization,
  { format, ink }: OptionContext,
): EChartsOption {
  const settings = visualization.settings
  const { dims, metrics } = roles(result, settings)
  const d = dims[0]
  const m = metrics[0]
  if (d === undefined || m === undefined) return {}
  const dimension = result.columns[d] as ResultColumn
  const metric = result.columns[m] as ResultColumn
  const stages = result.rows.map((row) => ({ value: row[d], n: toNumber(row[m]) ?? 0 }))
  const first = Math.max(...stages.map((s) => s.n), 0)
  const field = fieldOfColumn(format.base, metric)
  const own = settings?.series ?? {}
  // Beside the stages by default: a narrow stage has no room for its own words.
  const beside = settings?.labels_outside !== false
  return {
    animationDuration: 300,
    tooltip: { trigger: 'item', ...tooltipStyle(ink) },
    series: [
      {
        type: 'funnel',
        left: beside ? 0 : '8%',
        width: beside ? '58%' : '84%',
        top: 8,
        bottom: 8,
        sort: settings?.sort_slices === false ? 'none' : 'descending',
        gap: 2,
        minSize: '12%',
        label: {
          show: settings?.slice_labels !== 'none',
          position: beside ? 'right' : 'inside',
          color: beside ? ink.text : '#ffffff',
          fontSize: 12,
          formatter: (p: unknown) => {
            const item = p as { name: string; value: number }
            const share = first === 0 ? '' : ` · ${Math.round((item.value / first) * 100)} %`
            return `${item.name}\n${numberText(item.value, metric, field)}${share}`
          },
        },
        labelLine: { show: beside, length: 8, lineStyle: { color: ink.axis } },
        itemStyle: { borderColor: ink.surface, borderWidth: 1 },
        data: stages.map((s, rank) => {
          const key = valueText(dimension, s.value, format)
          return {
            name: own[key]?.label ?? key,
            value: s.n,
            raw: s.value,
            itemStyle: { color: own[key]?.color ?? colorOf(dimension, s.value, rank, format, ink) },
          }
        }),
      },
    ],
  }
}

/** A cloud of points: two numbers, a third as the size of each. */
export function scatterOption(
  result: QueryResult,
  visualization: Visualization,
  { format, ink }: OptionContext,
): EChartsOption {
  const settings = visualization.settings
  const numeric = result.columns
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.type === 'number' && c.hidden !== true)
  const named = byName(result, settings?.metrics)
  const pick = named.length >= 2 ? named : numeric.map((n) => n.i)
  const [xi, yi, si] = pick
  if (xi === undefined || yi === undefined) return {}
  const x = result.columns[xi] as ResultColumn
  const y = result.columns[yi] as ResultColumn
  const labelIndex = result.columns.findIndex(
    (c, i) => c.role !== 'metric' && c.hidden !== true && !pick.includes(i),
  )
  const sizes = si === undefined ? [] : result.rows.map((r) => toNumber(r[si]) ?? 0)
  const largest = Math.max(1, ...sizes)
  return {
    animationDuration: 300,
    grid: {
      left: 4,
      right: 16,
      top: 16,
      bottom: 24,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    tooltip: {
      trigger: 'item',
      ...tooltipStyle(ink),
      formatter: (p: unknown) => {
        const index = (p as { dataIndex: number }).dataIndex
        const row = result.rows[index] ?? []
        const head =
          labelIndex < 0
            ? ''
            : `${escapeHtml(valueText(result.columns[labelIndex] as ResultColumn, row[labelIndex], format))}<br/>`
        return `${head}${escapeHtml(x.label)} : ${escapeHtml(valueText(x, row[xi], format))}<br/>${escapeHtml(y.label)} : ${escapeHtml(valueText(y, row[yi], format))}`
      },
    },
    xAxis: {
      ...valueAxis(ink, false, settings?.x_label || x.label),
      nameLocation: 'middle',
      nameGap: 24,
    },
    yAxis: valueAxis(ink, false, settings?.y_label || y.label),
    series: [
      {
        type: 'scatter',
        data: result.rows.map((r) => [toNumber(r[xi]), toNumber(r[yi])]),
        symbolSize: (_: unknown, p: { dataIndex: number }) =>
          si === undefined ? 10 : 8 + Math.sqrt((sizes[p.dataIndex] ?? 0) / largest) * 32,
        itemStyle: { color: ink.series[0], opacity: 0.8, borderColor: ink.surface, borderWidth: 2 },
      },
    ],
  }
}

/** A gauge: the value on its arc, between bounds, the goal marked. */
export function gaugeOption(
  result: QueryResult,
  visualization: Visualization,
  { format, ink }: OptionContext,
): EChartsOption {
  const settings = visualization.settings
  const { metrics } = roles(result, settings)
  const m = metrics[0]
  if (m === undefined) return {}
  const metric = result.columns[m] as ResultColumn
  const value = toNumber(result.rows[0]?.[m]) ?? 0
  const goal = typeof settings?.goal === 'number' ? settings.goal : null
  const min = typeof settings?.min === 'number' ? settings.min : 0
  const max =
    typeof settings?.max === 'number' ? settings.max : Math.max(goal ?? 0, value) * 1.25 || 1
  const field = fieldOfColumn(format.base, metric)
  const options = numberOptions(settings)
  const reached = goal !== null && value >= goal
  return {
    animationDuration: 400,
    series: [
      {
        type: 'gauge',
        min,
        max,
        startAngle: 210,
        endAngle: -30,
        radius: '92%',
        center: ['50%', '58%'],
        progress: {
          show: true,
          width: 14,
          roundCap: true,
          itemStyle: {
            color:
              ruleColor(settings?.rules, undefined, value) ??
              settings?.color ??
              (reached ? '#0ca30c' : ink.series[0]),
          },
        },
        axisLine: { roundCap: true, lineStyle: { width: 14, color: [[1, ink.grid]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          distance: -34,
          color: ink.muted,
          fontSize: 10,
          formatter: (v: number) => (v === min || v === max ? axisNumber(v) : ''),
        },
        anchor: { show: false },
        title: { show: goal !== null, offsetCenter: [0, '32%'], color: ink.muted, fontSize: 12 },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '0%'],
          fontSize: 26,
          fontWeight: 600,
          color: ink.text,
          formatter: (v: number) => numberText(v, metric, field, { ...options, compact: true }),
        },
        data: [
          {
            value,
            name:
              goal === null
                ? ''
                : $t('Objectif {goal}', { goal: numberText(goal, metric, field, options) }),
          },
        ],
      },
    ],
  }
}

/** One hue each, light to dark: the value of a region, never its identity. */
const RAMPS: Readonly<Record<NonNullable<VisualizationSettings['palette']>, readonly string[]>> = {
  blue: ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'],
  green: ['#d3f1dd', '#8fd9a8', '#1baf7a', '#11805a', '#0a5239'],
  orange: ['#fde2d3', '#f6ae86', '#eb6834', '#b84a1e', '#7a2e10'],
  violet: ['#e4e0fb', '#b5acf2', '#7b6fe0', '#4a3aa7', '#2c2170'],
  red: ['#fbd9d9', '#f29e9e', '#e34948', '#b12f2e', '#761c1c'],
}

/** Letters without accents, lower case: « Île-de-France » and « ile de france » meet. */
export const normalizeRegion = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** A map: each region coloured by its value on one hue, or points at their coordinates. */
export function mapOption(
  result: QueryResult,
  visualization: Visualization,
  { format, ink }: OptionContext,
  map: { readonly name: string; readonly regions: ReadonlyMap<string, string> },
): EChartsOption {
  const settings = visualization.settings
  const { dims, metrics } = roles(result, settings)
  const lat = result.columns.findIndex((c) => c.name === settings?.latitude)
  const lon = result.columns.findIndex((c) => c.name === settings?.longitude)
  const m = metrics[0]
  const metric = m === undefined ? undefined : (result.columns[m] as ResultColumn)
  const field = metric === undefined ? undefined : fieldOfColumn(format.base, metric)
  const geo = {
    map: map.name,
    roam: true,
    itemStyle: { areaColor: ink.grid, borderColor: ink.surface, borderWidth: 0.6 },
    emphasis: { itemStyle: { areaColor: ink.axis }, label: { show: false } },
    select: { disabled: true },
  }
  if (lat >= 0 && lon >= 0) {
    return {
      animationDuration: 300,
      tooltip: { trigger: 'item', ...tooltipStyle(ink) },
      geo,
      series: [
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          symbolSize: 9,
          itemStyle: { color: ink.series[0], borderColor: ink.surface, borderWidth: 1.5 },
          data: result.rows.map((r) => ({
            name:
              dims[0] === undefined
                ? ''
                : valueText(result.columns[dims[0]] as ResultColumn, r[dims[0]], format),
            value: [toNumber(r[lon]), toNumber(r[lat]), m === undefined ? null : toNumber(r[m])],
          })),
        },
      ],
    }
  }
  const d = dims[0]
  if (d === undefined || m === undefined || metric === undefined) return {}
  const dimension = result.columns[d] as ResultColumn
  const data: Array<{ name: string; value: number | null; label: string }> = []
  for (const row of result.rows) {
    const label = valueText(dimension, row[d], format)
    const name =
      map.regions.get(normalizeRegion(label)) ??
      map.regions.get(normalizeRegion(String(row[d] ?? '')))
    if (name !== undefined) data.push({ name, value: toNumber(row[m]), label })
  }
  const values = data.map((v) => v.value ?? 0)
  return {
    animationDuration: 300,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle(ink),
      formatter: (p: unknown) => {
        const item = p as { name: string; value: number }
        return Number.isFinite(item.value)
          ? `${escapeHtml(item.name)}<br/><b>${numberText(item.value, metric, field)}</b>`
          : escapeHtml(item.name)
      },
    },
    visualMap: {
      min: Math.min(0, ...values),
      max: Math.max(1, ...values),
      calculable: true,
      orient: 'horizontal',
      left: 0,
      bottom: 0,
      itemWidth: 10,
      itemHeight: 120,
      textStyle: { color: ink.muted, fontSize: 10 },
      inRange: { color: [...RAMPS[settings?.palette ?? 'blue']] },
      formatter: (v: unknown) => axisNumber(Number(v)),
    },
    series: [
      {
        type: 'map',
        map: map.name,
        roam: true,
        itemStyle: geo.itemStyle,
        emphasis: geo.emphasis,
        label: { show: settings?.region_labels === true, color: ink.text, fontSize: 9 },
        data,
      } as SeriesOption,
    ],
  }
}
