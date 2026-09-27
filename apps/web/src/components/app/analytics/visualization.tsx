'use client'

import { EChart, registerMap } from '@/components/app/analytics/echart'
import { OptionBadge } from '@/components/app/option-badge'
import {
  axisOption,
  chartModel,
  funnelOption,
  gaugeOption,
  mapOption,
  normalizeRegion,
  pieOption,
  roles,
  scatterOption,
} from '@/lib/analytics/charts'
import {
  type FormatBase,
  type FormatContext,
  STATUS,
  fieldOfColumn,
  inkOf,
  numberOptions,
  numberText,
  valueText,
} from '@/lib/analytics/format'
import type { DrillPoint } from '@/lib/analytics/model'
import { api } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { useMembers } from '@/lib/members'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  type MapRegion,
  type QueryResult,
  type ResultColumn,
  type Visualization,
  type VisualizationSettings,
  ruleColor,
  ruleHolds,
} from '@basedb/contracts'
import type { ECElementEvent } from 'echarts'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Loader2, Minus } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

/**
 * A result, drawn — chapter 18 §3. The same result reads as a table, a pivot, a number, a
 * trend against its previous period, a bar towards its goal, or a chart; a click on a
 * point of a grouped result opens what it stands for (`onDrill`), a click on a row read as
 * it is opens that row (`onRecord`).
 */

export interface DrillEvent {
  readonly point: DrillPoint
  /** Where the click was, on screen. */
  readonly at: { readonly x: number; readonly y: number }
}

export interface VizProps {
  readonly result: QueryResult
  readonly visualization: Visualization
  readonly base: FormatBase
  /** The question sorts its rows itself: the chart keeps their order. */
  readonly sorted?: boolean
  readonly onDrill?: (event: DrillEvent) => void
  readonly onRecord?: (table: string, id: string) => void
  /** Inside a dashboard card: tighter. */
  readonly dense?: boolean
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, ...size }
}

const clientPoint = (event: ECElementEvent) => {
  const native = (event.event as { event?: MouseEvent } | undefined)?.event
  return { x: native?.clientX ?? 0, y: native?.clientY ?? 0 }
}

export function VisualizationView(props: VizProps) {
  const { result, visualization } = props
  const members = useMembers()
  const theme = useTheme((s) => s.theme)
  const format: FormatContext = useMemo(
    () => ({ base: props.base, members }),
    [props.base, members],
  )
  const ink = inkOf(theme)

  if (result.rows.length === 0 && visualization.type !== 'table') {
    return <Empty>{$t('Aucun résultat.')}</Empty>
  }
  switch (visualization.type) {
    case 'table':
      return <TableViz {...props} format={format} />
    case 'pivot':
      return <PivotViz {...props} format={format} />
    case 'scalar':
      return <ScalarViz {...props} format={format} />
    case 'trend':
      return <TrendViz {...props} format={format} />
    case 'progress':
      return <ProgressViz {...props} format={format} />
    case 'map':
      return <MapViz {...props} format={format} theme={theme} />
    default:
      return <ChartViz {...props} format={format} ink={ink} />
  }
}

function Empty({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex size-full min-h-16 items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

// ── Charts on axes, pies, funnels, clouds, gauges ───────────────────────────

const AXIS_TYPES: ReadonlySet<string> = new Set(['bar', 'row', 'line', 'area', 'combo'])

function ChartViz({
  result,
  visualization,
  sorted = false,
  onDrill,
  format,
  ink,
}: VizProps & { readonly format: FormatContext; readonly ink: ReturnType<typeof inkOf> }) {
  const { ref, width, height } = useWidth<HTMLDivElement>()
  const type = visualization.type
  const model = useMemo(
    () => chartModel(result, visualization, format, ink, sorted),
    [result, visualization, format, ink, sorted],
  )
  const option = useMemo(() => {
    const context = { format, ink, width, height }
    switch (type) {
      case 'pie':
        return pieOption(result, visualization, context)
      case 'funnel':
        return funnelOption(result, visualization, context)
      case 'scatter':
        return scatterOption(result, visualization, context)
      case 'gauge':
        return gaugeOption(result, visualization, context)
      default:
        return axisOption(model, visualization, context)
    }
  }, [type, result, visualization, format, ink, width, height, model])

  const click = (event: ECElementEvent) => {
    if (onDrill === undefined) return
    const { dims } = roles(result, visualization.settings)
    if (type === 'pie' || type === 'funnel') {
      const d = dims[0]
      const raw = (event.data as { raw?: unknown } | undefined)?.raw
      if (d === undefined || raw === undefined) return
      onDrill({
        point: { values: [{ column: result.columns[d] as ResultColumn, value: raw }] },
        at: clientPoint(event),
      })
      return
    }
    if (type === 'scatter' || type === 'gauge') return
    const category = model.categories[event.dataIndex]
    const series = model.series[event.seriesIndex ?? 0]
    if (category === undefined || model.dimension === null) return
    const values = [{ column: model.dimension, value: category.value }]
    if (series?.split !== undefined)
      values.push({ column: series.split.column, value: series.split.value })
    onDrill({ point: { values }, at: clientPoint(event) })
  }

  return (
    <div ref={ref} className="size-full min-h-40">
      {width > 0 && (
        <EChart
          option={option}
          onClick={onDrill === undefined ? undefined : click}
          onBandClick={
            onDrill === undefined || !AXIS_TYPES.has(type)
              ? undefined
              : {
                  axis: type === 'row' ? 'y' : 'x',
                  handle: (index, at) => {
                    const category = model.categories[index]
                    if (category === undefined || model.dimension === null) return
                    onDrill({
                      point: { values: [{ column: model.dimension, value: category.value }] },
                      at,
                    })
                  },
                }
          }
          label={visualization.type}
        />
      )}
    </div>
  )
}

// ── A number ────────────────────────────────────────────────────────────────

function firstMetric(result: QueryResult, visualization: Visualization) {
  const { metrics } = roles(result, visualization.settings)
  const index = metrics[0]
  return index === undefined ? null : { index, column: result.columns[index] as ResultColumn }
}

function ScalarViz({
  result,
  visualization,
  format,
  dense,
}: VizProps & { readonly format: FormatContext }) {
  const metric = firstMetric(result, visualization)
  if (metric === null) return <Empty>{$t('Aucune mesure à afficher.')}</Empty>
  const value = result.rows[result.rows.length === 1 ? 0 : result.rows.length - 1]?.[metric.index]
  const settings = visualization.settings
  const text =
    typeof value === 'number'
      ? numberText(value, metric.column, fieldOfColumn(format.base, metric.column), {
          ...numberOptions(settings),
          compact: settings?.compact ?? (dense === true && Math.abs(value) >= 1_000_000),
        })
      : valueText(metric.column, value, format)
  const color = ruleColor(settings?.rules, undefined, value) ?? settings?.color
  return (
    <div className="@container flex size-full flex-col items-center justify-center gap-1 text-center">
      <p
        className="text-3xl font-semibold tracking-tight @[220px]:text-5xl @[420px]:text-6xl"
        title={String(value ?? '')}
        style={color === undefined || color === null ? undefined : { color }}
      >
        {text}
      </p>
      {settings?.caption !== undefined && settings.caption !== '' && (
        <p className="text-sm text-muted-foreground">{settings.caption}</p>
      )}
    </div>
  )
}

const PREVIOUS: Readonly<Record<string, string>> = {
  day: $t('la veille'),
  week: $t('la semaine précédente'),
  month: $t('le mois précédent'),
  quarter: $t('le trimestre précédent'),
  year: $t('l’année précédente'),
}

function Delta({
  current,
  previous,
  label,
  metric,
  format,
  invert,
}: {
  readonly current: number
  readonly previous: number
  readonly label: string
  readonly metric: ResultColumn
  readonly format: FormatContext
  /** A fall is good news: a cost, a delay. */
  readonly invert: boolean
}) {
  const change = previous === 0 ? null : (current - previous) / Math.abs(previous)
  const up = current > previous
  const flat = current === previous
  const good = invert ? !up : up
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1 text-xs text-muted-foreground @[260px]:text-sm">
      <Icon
        className="size-3.5"
        style={{ color: flat ? undefined : good ? STATUS.good : STATUS.critical }}
      />
      {change !== null && (
        <span className="font-medium text-foreground">
          {`${Math.abs(change * 100).toLocaleString(intlLocale(), { maximumFractionDigits: 1 })} %`}
        </span>
      )}
      <span>
        {$t('vs {label} : {previous}', {
          label,
          previous: numberText(previous, metric, fieldOfColumn(format.base, metric)),
        })}
      </span>
    </p>
  )
}

/** The last period, and how it compares to the one before and to the same one a year ago. */
function TrendViz({
  result,
  visualization,
  format,
}: VizProps & { readonly format: FormatContext }) {
  const metric = firstMetric(result, visualization)
  const time = result.columns.findIndex((c) => c.unit !== undefined)
  if (metric === null || time < 0)
    return (
      <ScalarViz result={result} visualization={visualization} base={format.base} format={format} />
    )
  const rows = result.rows.filter((r) => r[time] !== null && r[time] !== undefined)
  const last = rows[rows.length - 1]
  const previous = rows[rows.length - 2]
  const column = result.columns[time] as ResultColumn
  const unit = column.unit
  const current = typeof last?.[metric.index] === 'number' ? (last[metric.index] as number) : null
  const settings = visualization.settings
  const comparison = settings?.comparison ?? 'both'
  const invert = settings?.invert === true
  const lastPeriod = String(last?.[time] ?? '')
  const yearAgo =
    unit === 'day' || unit === 'week' || unit === 'month' || unit === 'quarter'
      ? rows.find(
          (r) => String(r[time]) === `${Number(lastPeriod.slice(0, 4)) - 1}${lastPeriod.slice(4)}`,
        )
      : undefined
  if (current === null) return <Empty>{$t('Aucune valeur pour la dernière période.')}</Empty>
  const color = ruleColor(settings?.rules, undefined, current) ?? settings?.color
  return (
    <div className="@container flex size-full flex-col items-center justify-center gap-1 text-center">
      <p
        className="text-3xl font-semibold tracking-tight @[220px]:text-5xl"
        style={color === undefined || color === null ? undefined : { color }}
      >
        {numberText(
          current,
          metric.column,
          fieldOfColumn(format.base, metric.column),
          numberOptions(settings),
        )}
      </p>
      <p className="text-sm font-medium">
        {settings?.caption !== undefined && settings.caption !== ''
          ? settings.caption
          : valueText(column, last?.[time], format)}
      </p>
      {comparison !== 'year' && typeof previous?.[metric.index] === 'number' && (
        <Delta
          current={current}
          previous={previous[metric.index] as number}
          label={PREVIOUS[unit ?? ''] ?? valueText(column, previous[time], format)}
          metric={metric.column}
          format={format}
          invert={invert}
        />
      )}
      {comparison !== 'previous' &&
        yearAgo !== undefined &&
        typeof yearAgo[metric.index] === 'number' && (
          <Delta
            current={current}
            previous={yearAgo[metric.index] as number}
            label={valueText(column, yearAgo[time], format)}
            metric={metric.column}
            format={format}
            invert={invert}
          />
        )}
    </div>
  )
}

/** A bar towards a goal. */
function ProgressViz({
  result,
  visualization,
  format,
}: VizProps & { readonly format: FormatContext }) {
  const metric = firstMetric(result, visualization)
  const settings = visualization.settings
  if (metric === null) return <Empty>{$t('Aucune mesure à afficher.')}</Empty>
  const value = Number(result.rows[0]?.[metric.index] ?? 0)
  const goal = typeof settings?.goal === 'number' && settings.goal !== 0 ? settings.goal : null
  const field = fieldOfColumn(format.base, metric.column)
  const options = numberOptions(settings)
  if (goal === null) {
    return <Empty>{$t('Fixez un objectif dans les réglages de la visualisation.')}</Empty>
  }
  const share = Math.max(0, Math.min(1, value / goal))
  const reached = value >= goal
  const fill =
    ruleColor(settings?.rules, undefined, value) ??
    settings?.color ??
    (reached ? STATUS.good : 'var(--primary)')
  return (
    <div className="flex size-full flex-col justify-center gap-2 px-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold">
          {numberText(value, metric.column, field, options)}
        </span>
        <span className="text-sm text-muted-foreground">{Math.round((value / goal) * 100)} %</span>
      </div>
      <div className="h-6 overflow-hidden rounded-md bg-muted">
        <div
          className="h-full rounded-md transition-[width]"
          style={{ width: `${share * 100}%`, backgroundColor: fill }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          {reached
            ? $t('Objectif atteint')
            : $t('Reste {numberText}', {
                numberText: numberText(goal - value, metric.column, field, options),
              })}
        </span>
        <span>
          {settings?.goal_label || $t('Objectif')} {numberText(goal, metric.column, field, options)}
        </span>
      </div>
      {settings?.caption !== undefined && settings.caption !== '' && (
        <p className="text-xs text-muted-foreground">{settings.caption}</p>
      )}
    </div>
  )
}

// ── Tables ──────────────────────────────────────────────────────────────────

const DENSITY = {
  compact: 'px-2 py-0.5 text-xs',
  normal: 'px-3 py-1.5',
  comfortable: 'px-3 py-2.5',
} as const

function Cell({
  column,
  value,
  format,
  settings,
}: {
  readonly column: ResultColumn
  readonly value: unknown
  readonly format: FormatContext
  readonly settings?: VisualizationSettings
}) {
  if (value === null || value === undefined || value === '') {
    return (
      <span className="text-muted-foreground/60">
        {column.role === 'dimension' ? $t('Sans valeur') : '—'}
      </span>
    )
  }
  if ((column.type === 'select' || column.type === 'multi_select') && column.unit === undefined) {
    const field = fieldOfColumn(format.base, column)
    const values = Array.isArray(value) ? value : [value]
    return (
      <span className="flex flex-wrap gap-1">
        {values.map((v) => {
          const option = field?.options?.find((o) => o.value === v)
          return (
            <OptionBadge key={String(v)} option={option ?? { label: String(v), color: null }} />
          )
        })}
      </span>
    )
  }
  if (column.type === 'boolean') return <span>{value === true ? '✓' : '—'}</span>
  if (column.type === 'url' && typeof value === 'string') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    )
  }
  if (typeof value === 'number' && column.unit === undefined) {
    return (
      <>{numberText(value, column, fieldOfColumn(format.base, column), numberOptions(settings))}</>
    )
  }
  return <>{valueText(column, value, format)}</>
}

const numeric = (c: ResultColumn) => c.type === 'number' || c.role === 'metric'

/** The name a column goes by: the one the settings give it, or its own. */
const titleOf = (c: ResultColumn, settings: VisualizationSettings | undefined) =>
  settings?.column_labels?.[c.name]?.trim() || c.label

/** A colour as a light wash behind a cell or a row, readable in both themes. */
const wash = (color: string) => `color-mix(in srgb, ${color} 16%, transparent)`

function TableViz({
  result,
  visualization,
  onRecord,
  onDrill,
  format,
}: VizProps & { readonly format: FormatContext }) {
  const settings = visualization.settings
  const [sort, setSort] = useState<{ index: number; desc: boolean } | null>(null)
  const [page, setPage] = useState(0)
  const chosen = settings?.columns
  const size = Math.min(Math.max(settings?.page_size ?? 100, 10), 500)
  const density = DENSITY[settings?.density ?? 'normal']
  const shown = useMemo(() => {
    const all = result.columns.map((c, i) => ({ c, i })).filter(({ c }) => c.hidden !== true)
    if (chosen === undefined || chosen.length === 0) return all
    return chosen
      .map((name) => all.find(({ c }) => c.name === name))
      .filter((x): x is { c: ResultColumn; i: number } => x !== undefined)
  }, [result, chosen])
  const rows = useMemo(() => {
    const indexed = result.rows.map((row, i) => ({ row, i }))
    if (sort === null) return indexed
    const compare = (a: unknown, b: unknown) => {
      if (a === b) return 0
      if (a === null || a === undefined) return 1
      if (b === null || b === undefined) return -1
      if (typeof a === 'number' && typeof b === 'number') return a - b
      return String(a).localeCompare(String(b), intlLocale())
    }
    return [...indexed].sort(
      (x, y) => (sort.desc ? -1 : 1) * compare(x.row[sort.index], y.row[sort.index]),
    )
  }, [result, sort])
  // The largest magnitude of each column drawn with bars: every bar is a share of it.
  const bars = useMemo(() => {
    const out = new Map<number, number>()
    for (const { c, i } of shown) {
      if (!(settings?.cell_bars ?? []).includes(c.name)) continue
      out.set(i, Math.max(0, ...result.rows.map((r) => Math.abs(Number(r[i]) || 0))))
    }
    return out
  }, [result, shown, settings?.cell_bars])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new result opens on its first page
  useEffect(() => setPage(0), [result])

  if (result.rows.length === 0) return <Empty>{$t('Aucune ligne.')}</Empty>
  const pages = Math.ceil(rows.length / size)
  const visible = rows.slice(page * size, (page + 1) * size)
  const record = result.record
  const recordTable = record?.table
  const grouped = result.columns.some((c) => c.role === 'metric')
  const rules = settings?.rules ?? []
  const rowRules = rules.filter((r) => r.row === true)
  const bar = settings?.color ?? 'var(--primary)'

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto scroll-discret">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              {settings?.row_numbers === true && (
                <th className="w-8 border-b px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                  #
                </th>
              )}
              {shown.map(({ c, i }) => (
                <th
                  key={c.name}
                  className={cn(
                    'whitespace-nowrap border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground',
                    numeric(c) && 'text-right',
                  )}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() =>
                      setSort((s) =>
                        s?.index === i
                          ? s.desc
                            ? null
                            : { index: i, desc: true }
                          : { index: i, desc: false },
                      )
                    }
                  >
                    {titleOf(c, settings)}
                    {sort?.index === i &&
                      (sort.desc ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronUp className="size-3" />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, i }, rank) => {
              const id = record === undefined ? undefined : row[record.column]
              const opens =
                onRecord !== undefined && recordTable !== undefined && typeof id === 'string'
              // A rule on the whole row: the first that holds on its column.
              const rowColor = rowRules.reduce<string | null>((found, rule) => {
                if (found !== null) return found
                const at = result.columns.findIndex((c) => c.name === rule.column)
                return at >= 0 && ruleHolds(rule, row[at]) ? rule.color : null
              }, null)
              return (
                <tr
                  key={i}
                  tabIndex={opens ? 0 : undefined}
                  onClick={opens ? () => onRecord(recordTable, id) : undefined}
                  onKeyDown={
                    opens ? (e) => e.key === 'Enter' && onRecord(recordTable, id) : undefined
                  }
                  className={cn('hover:bg-muted/40', opens && 'cursor-pointer')}
                  style={rowColor === null ? undefined : { backgroundColor: wash(rowColor) }}
                >
                  {settings?.row_numbers === true && (
                    <td
                      className={cn(
                        'border-b border-border/60 text-right text-xs text-muted-foreground tabular-nums',
                        density,
                      )}
                    >
                      {page * size + rank + 1}
                    </td>
                  )}
                  {shown.map(({ c, i: index }) => {
                    const value = row[index]
                    const cellColor = ruleColor(
                      rules.filter((r) => r.row !== true),
                      c.name,
                      numeric(c) ? value : null,
                    )
                    const max = bars.get(index)
                    return (
                      <td
                        key={c.name}
                        className={cn(
                          'max-w-72 truncate border-b border-border/60',
                          density,
                          numeric(c) && 'text-right tabular-nums',
                          grouped &&
                            c.role === 'dimension' &&
                            onDrill !== undefined &&
                            'cursor-pointer hover:text-primary',
                        )}
                        style={
                          cellColor === null
                            ? undefined
                            : {
                                backgroundColor: wash(cellColor),
                                color: `color-mix(in oklab, ${cellColor} 70%, var(--foreground))`,
                              }
                        }
                        onClick={
                          grouped && c.role === 'dimension' && onDrill !== undefined
                            ? (e) =>
                                onDrill({
                                  point: { values: [{ column: c, value }] },
                                  at: { x: e.clientX, y: e.clientY },
                                })
                            : undefined
                        }
                        onKeyDown={
                          grouped && c.role === 'dimension' && onDrill !== undefined
                            ? (e) => {
                                if (e.key !== 'Enter') return
                                const box = e.currentTarget.getBoundingClientRect()
                                onDrill({
                                  point: { values: [{ column: c, value }] },
                                  at: { x: box.left, y: box.bottom },
                                })
                              }
                            : undefined
                        }
                      >
                        {max !== undefined && max > 0 && typeof value === 'number' ? (
                          <span className="flex items-center justify-end gap-2">
                            <span className="h-2.5 min-w-8 flex-1 overflow-hidden rounded-sm bg-muted">
                              <span
                                className="block h-full rounded-sm"
                                style={{
                                  width: `${(Math.abs(value) / max) * 100}%`,
                                  backgroundColor: bar,
                                  marginLeft: 'auto',
                                }}
                              />
                            </span>
                            <Cell column={c} value={value} format={format} settings={settings} />
                          </span>
                        ) : (
                          <Cell column={c} value={value} format={format} settings={settings} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-2 py-1 text-xs text-muted-foreground">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="disabled:opacity-40"
          >
            {$t('Précédent')}
          </button>
          <span>
            {$t('{value}–{min} sur {rowsCount}', {
              value: page * size + 1,
              min: Math.min((page + 1) * size, rows.length),
              rowsCount: rows.length,
            })}
          </span>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="disabled:opacity-40"
          >
            {$t('Suivant')}
          </button>
        </div>
      )}
    </div>
  )
}

const keyOf = (values: readonly unknown[]) => JSON.stringify(values)

/**
 * A pivot: rows by some groupings, columns by another, the aggregates in the cells, totals
 * around — each cell tinted by its value when asked, or coloured by a rule.
 */
function PivotViz({
  result,
  visualization,
  format,
}: VizProps & { readonly format: FormatContext }) {
  const settings = visualization.settings
  const theme = useTheme((s) => s.theme)
  const { dims, metrics } = roles(result, settings)
  const index = (names: readonly string[] | undefined) =>
    (names ?? []).map((n) => result.columns.findIndex((c) => c.name === n)).filter((i) => i >= 0)
  let rowDims = index(settings?.pivot_rows)
  let colDims = index(settings?.pivot_columns)
  let values = index(settings?.pivot_values)
  if (rowDims.length === 0 && colDims.length === 0) {
    rowDims = dims.length > 1 ? dims.slice(0, -1) : dims
    colDims = dims.length > 1 ? dims.slice(-1) : []
  }
  if (values.length === 0) values = metrics
  const totals = settings?.totals !== false
  const density = DENSITY[settings?.density ?? 'normal']

  const rowKeys = new Map<string, unknown[]>()
  const colKeys = new Map<string, unknown[]>()
  const cells = new Map<string, number[]>()
  for (const row of result.rows) {
    const r = rowDims.map((i) => row[i])
    const c = colDims.map((i) => row[i])
    rowKeys.set(keyOf(r), r)
    colKeys.set(keyOf(c), c)
    const key = `${keyOf(r)}|${keyOf(c)}`
    const current = cells.get(key) ?? values.map(() => 0)
    values.forEach((v, j) => {
      current[j] = (current[j] ?? 0) + (Number(row[v]) || 0)
    })
    cells.set(key, current)
  }
  const columns = [...colKeys.values()].slice(0, 60)
  const rowsList = [...rowKeys.values()]
  const metricColumns = values.map((v) => result.columns[v] as ResultColumn)
  // The span of each measure over the cells, for the heat map.
  const spans = metricColumns.map((_, j) => {
    const all = [...cells.values()].map((list) => list[j] ?? 0)
    return { low: Math.min(0, ...all), high: Math.max(0, ...all) }
  })
  const heat = settings?.heatmap === true
  const hue = settings?.color ?? (theme === 'dark' ? '#3987e5' : '#2a78d6')
  const show = (n: number, j: number) => {
    const column = metricColumns[j] as ResultColumn
    return numberText(n, column, fieldOfColumn(format.base, column), numberOptions(settings))
  }
  const tint = (n: number, j: number): CSSProperties | undefined => {
    const column = metricColumns[j] as ResultColumn
    const ruled = ruleColor(settings?.rules, column.name, n)
    if (ruled !== null) return { backgroundColor: wash(ruled) }
    if (!heat) return undefined
    const span = spans[j]
    if (span === undefined || span.high === span.low) return undefined
    const share = Math.round(((n - span.low) / (span.high - span.low)) * 55)
    return {
      backgroundColor: `color-mix(in srgb, ${hue} ${share}%, transparent)`,
    }
  }
  const sum = (predicate: (rowKey: string, colKey: string) => boolean, j: number) => {
    let total = 0
    for (const [key, list] of cells) {
      const [r = '', c = ''] = key.split('|')
      if (predicate(r, c)) total += list[j] ?? 0
    }
    return total
  }
  const head = (c: unknown[]) =>
    c
      .map((v, k) => valueText(result.columns[colDims[k] as number] as ResultColumn, v, format))
      .join(' · ')

  return (
    <div className="size-full overflow-auto scroll-discret">
      <table className="border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            {rowDims.map((i) => (
              <th
                key={i}
                className="border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                {titleOf(result.columns[i] as ResultColumn, settings)}
              </th>
            ))}
            {columns.map((c) =>
              metricColumns.map((m, j) => (
                <th
                  key={`${keyOf(c)}${j}`}
                  className="whitespace-nowrap border-b px-3 py-2 text-right text-xs font-medium"
                >
                  {colDims.length === 0
                    ? titleOf(m, settings)
                    : metricColumns.length > 1
                      ? `${head(c)} — ${titleOf(m, settings)}`
                      : head(c)}
                </th>
              )),
            )}
            {totals &&
              colDims.length > 0 &&
              metricColumns.map((m) => (
                <th
                  key={`total:${m.name}`}
                  className="whitespace-nowrap border-b px-3 py-2 text-right text-xs font-semibold"
                >
                  {$t('Total{value}', {
                    value: metricColumns.length > 1 ? ` — ${titleOf(m, settings)}` : '',
                  })}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {rowsList.map((r) => (
            <tr key={keyOf(r)} className="hover:bg-muted/40">
              {r.map((v, k) => (
                <td
                  key={rowDims[k]}
                  className={cn('whitespace-nowrap border-b border-border/60', density)}
                >
                  {valueText(result.columns[rowDims[k] as number] as ResultColumn, v, format)}
                </td>
              ))}
              {columns.map((c) =>
                metricColumns.map((_, j) => {
                  const cell = cells.get(`${keyOf(r)}|${keyOf(c)}`)
                  const n = cell?.[j] ?? 0
                  return (
                    <td
                      key={`${keyOf(c)}${j}`}
                      className={cn('border-b border-border/60 text-right tabular-nums', density)}
                      style={cell === undefined ? undefined : tint(n, j)}
                    >
                      {cell === undefined ? '' : show(n, j)}
                    </td>
                  )
                }),
              )}
              {totals &&
                colDims.length > 0 &&
                metricColumns.map((m, j) => (
                  <td
                    key={`total:${m.name}`}
                    className={cn(
                      'border-b border-border/60 text-right font-medium tabular-nums',
                      density,
                    )}
                  >
                    {show(
                      sum((row) => row === keyOf(r), j),
                      j,
                    )}
                  </td>
                ))}
            </tr>
          ))}
          {totals && rowsList.length > 1 && (
            <tr className="font-semibold">
              <td colSpan={Math.max(rowDims.length, 1)} className={density}>
                {$t('Total')}
              </td>
              {columns.map((c) =>
                metricColumns.map((_, j) => (
                  <td key={`${keyOf(c)}${j}`} className={cn('text-right tabular-nums', density)}>
                    {show(
                      sum((_row, col) => col === keyOf(c), j),
                      j,
                    )}
                  </td>
                )),
              )}
              {colDims.length > 0 &&
                metricColumns.map((m, j) => (
                  <td key={`grand:${m.name}`} className={cn('text-right tabular-nums', density)}>
                    {show(
                      sum(() => true, j),
                      j,
                    )}
                  </td>
                ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Maps ────────────────────────────────────────────────────────────────────

interface LoadedMap {
  readonly name: string
  readonly regions: ReadonlyMap<string, string>
}

const maps = new Map<MapRegion, Promise<LoadedMap>>()

/** A map's regions, fetched once: each region by its name and by its code. */
function loadMap(region: MapRegion): Promise<LoadedMap> {
  let loading = maps.get(region)
  if (loading === undefined) {
    loading = api.geo(region).then((geo) => {
      const features =
        (geo as { features?: Array<{ properties?: Record<string, unknown> }> }).features ?? []
      const regions = new Map<string, string>()
      for (const f of features) {
        const name = String(f.properties?.name ?? f.properties?.nom ?? '')
        if (name === '') continue
        regions.set(normalizeRegion(name), name)
        for (const key of ['code', 'name_en', 'iso_a2', 'iso_a3', 'id']) {
          const code = f.properties?.[key]
          if (typeof code === 'string' || typeof code === 'number')
            regions.set(normalizeRegion(String(code)), name)
        }
      }
      registerMap(region, geo)
      return { name: region, regions }
    })
    loading.catch(() => maps.delete(region))
    maps.set(region, loading)
  }
  return loading
}

function MapViz({
  result,
  visualization,
  format,
  theme,
}: VizProps & { readonly format: FormatContext; readonly theme: 'light' | 'dark' }) {
  const region = visualization.settings?.region ?? 'fr-regions'
  const [map, setMap] = useState<LoadedMap | null>(null)
  const [failed, setFailed] = useState(false)
  const { ref, width } = useWidth<HTMLDivElement>()
  useEffect(() => {
    let current = true
    setMap(null)
    setFailed(false)
    loadMap(region)
      .then((m) => current && setMap(m))
      .catch(() => current && setFailed(true))
    return () => {
      current = false
    }
  }, [region])
  const ink = inkOf(theme)
  const option = useMemo(
    () => (map === null ? null : mapOption(result, visualization, { format, ink, width }, map)),
    [map, result, visualization, format, ink, width],
  )
  if (failed) return <Empty>{$t('La carte n’a pas pu être chargée.')}</Empty>
  return (
    <div ref={ref} className="size-full min-h-48">
      {option === null ? (
        <div className="flex size-full items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex size-full flex-col">
          <div className="min-h-0 flex-1">
            <EChart option={option} label={$t('Carte')} />
          </div>
          {region !== 'world' && (
            <p className="shrink-0 text-right text-[10px] text-muted-foreground">
              {$t('Fond : IGN, Admin Express')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
