'use client'

import { cn } from '@/lib/utils'
import type { ECElementEvent, EChartsOption } from 'echarts'
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  MapChart,
  PieChart,
  ScatterChart,
} from 'echarts/charts'
import {
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

/**
 * One chart, drawn by echarts — only the pieces the dashboards use, rendered in SVG: crisp
 * text at any zoom, and light enough for a dashboard of twenty cards. The options come
 * whole from `lib/analytics/charts.ts`; this only draws them, follows its box's size, and
 * hands a click back — a right click too, on a mark or in the band of its category: the
 * browser's own menu then gives way to the one the screen opens.
 */

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  FunnelChart,
  GaugeChart,
  MapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  SVGRenderer,
])

/** A map's regions, registered once for every chart that draws it. */
export function registerMap(name: string, geo: unknown): void {
  if (echarts.getMap(name) !== undefined && echarts.getMap(name) !== null) return
  echarts.registerMap(name, geo as Parameters<typeof echarts.registerMap>[1])
}

export function EChart({
  option,
  onClick,
  onContextMenu,
  onBandClick,
  className,
  label,
}: {
  readonly option: EChartsOption
  readonly onClick?: (event: ECElementEvent) => void
  /** A right click on a mark. */
  readonly onContextMenu?: (event: ECElementEvent) => void
  /**
   * A click — or a right click — beside the marks, in the band of a category: its rank on
   * the axis — `y` for horizontal bars. A thin bar is a small target; its whole band is not.
   */
  readonly onBandClick?: {
    readonly axis: 'x' | 'y'
    readonly handle: (index: number, at: { x: number; y: number }) => void
  }
  readonly className?: string
  /** What the chart shows, for whoever cannot see it. */
  readonly label?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const click = useRef(onClick)
  click.current = onClick
  const menu = useRef(onContextMenu)
  menu.current = onContextMenu
  const band = useRef(onBandClick)
  band.current = onBandClick

  useEffect(() => {
    const element = host.current
    if (element === null) return
    const instance = echarts.init(element, undefined, { renderer: 'svg' })
    chart.current = instance
    instance.on('click', (event) => click.current?.(event as ECElementEvent))
    instance.on('contextmenu', (event) => {
      const open = menu.current
      if (open === undefined) return
      ;(event.event?.event as unknown as MouseEvent | undefined)?.preventDefault()
      // The tooltip would cover the menu.
      instance.dispatchAction({ type: 'hideTip' })
      open(event as ECElementEvent)
    })
    // The band of the category under the pointer, for a click or a right click beside the marks.
    const inBand = (
      event: { target?: unknown; offsetX: number; offsetY: number; event: unknown },
      rightClick: boolean,
    ) => {
      const current = band.current
      // A mark answers through `click` and `contextmenu`; only the empty band is read here.
      if (current === undefined || (event.target !== undefined && event.target !== null)) return
      const point = [event.offsetX, event.offsetY]
      if (!instance.containPixel({ gridIndex: 0 }, point)) return
      const values = instance.convertFromPixel({ gridIndex: 0 }, point) as number[] | number
      const index = Array.isArray(values) ? values[current.axis === 'x' ? 0 : 1] : values
      const native = event.event as unknown as MouseEvent
      if (typeof index === 'number' && Number.isFinite(index)) {
        if (rightClick) {
          native.preventDefault()
          instance.dispatchAction({ type: 'hideTip' })
        }
        current.handle(Math.round(index), { x: native.clientX, y: native.clientY })
      }
    }
    instance.getZr().on('click', (event) => inBand(event, false))
    instance.getZr().on('contextmenu', (event) => inBand(event, true))
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(element)
    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true })
  }, [option])

  return (
    <div
      ref={host}
      role="img"
      aria-label={label}
      className={cn(
        'size-full min-h-0',
        (onClick !== undefined || onBandClick !== undefined) && '[&_path]:cursor-pointer',
        className,
      )}
    />
  )
}
