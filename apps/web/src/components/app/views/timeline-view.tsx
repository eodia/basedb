'use client'

import type { Row } from '@/components/app/grid/cell'
import { OptionBadge } from '@/components/app/option-badge'
import { colorOf, titleOf } from '@/components/app/views/card'
import { Unavailable } from '@/components/app/views/kanban-view'
import { loadRows } from '@/components/app/views/load'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { type Field, type Table, api } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { weekStart } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import {
  type TimelineScale,
  type TimelineSpec,
  addDays,
  andFilter,
  daysBetween,
  localDateOf,
  pick,
  rangeClause,
  startOfDay,
  startOfWeek,
  storedOfDate,
  titleFieldOf,
} from '@/lib/views'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * The timeline — each row a bar from its start to its end, on a horizontal time axis
 * (ch. 11 §1.4). What a planning is read on: what overlaps, what follows, what slipped.
 *
 * Like the calendar, it asks for the rows of its window only. Rows may be stacked by a
 * list of choices or a link — a lane per team, per client. A bar is dragged to move the
 * row, its end with it; its right edge is dragged to change the end alone. Both snap to
 * whole days and keep the time of day of a date-time.
 */

const CEILING = 1000
const ROW = 36
const LABEL = 224

const SCALES: Readonly<
  Record<TimelineScale, { label: string; px: number; days: number; step: number; before: number }>
> = {
  day: { label: $t('Jour'), px: 56, days: 28, step: 7, before: 3 },
  week: { label: $t('Semaine'), px: 22, days: 91, step: 28, before: 14 },
  month: { label: $t('Mois'), px: 5, days: 366, step: 91, before: 30 },
}

const MONTH = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' })
const MONTH_SHORT = new Intl.DateTimeFormat(intlLocale(), { month: 'short' })
const DAY = new Intl.DateTimeFormat(intlLocale(), { weekday: 'narrow', day: 'numeric' })
const SHORT = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' })

interface Bar {
  readonly row: Row
  readonly start: Date
  readonly end: Date
}

interface Lane {
  readonly key: string
  readonly label: React.ReactNode
  readonly bars: readonly Bar[]
}

export function TimelineView({
  table,
  fields,
  spec,
  filter,
  sort,
  reloadKey,
  openedId,
  onOpen,
  onError,
}: {
  readonly table: Table
  readonly fields: readonly Field[]
  readonly spec: TimelineSpec
  readonly filter: string
  readonly sort: string
  readonly reloadKey: number
  readonly openedId: string | null
  readonly onOpen: (row: Row) => void
  readonly onError: (message: string | null) => void
}) {
  const startField = fields.find((f) => f.name === spec.start_field) ?? null
  const endField = fields.find((f) => f.name === spec.end_field) ?? null
  const groupField = fields.find((f) => f.name === spec.group_by) ?? null
  const colorField = fields.find((f) => f.name === spec.color_field) ?? null
  const dependsField = fields.find((f) => f.name === spec.depends_on) ?? null
  const title = titleFieldOf(table, fields, spec.title_field)
  const extra = useMemo(() => pick(fields, spec.card_fields), [fields, spec.card_fields])
  const writable = table.actions.includes('update')
  const movable = writable && startField !== null && startField.read_only !== true
  const resizable = writable && endField !== null && endField.read_only !== true

  const [scale, setScale] = useState(spec.scale)
  useEffect(() => setScale(spec.scale), [spec.scale])
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const s = SCALES[scale]

  const from = useMemo(() => {
    const base =
      scale === 'week'
        ? startOfWeek(anchor)
        : scale === 'month'
          ? new Date(anchor.getFullYear(), anchor.getMonth(), 1)
          : anchor
    return addDays(base, -s.before)
  }, [anchor, scale, s.before])
  const to = useMemo(() => addDays(from, s.days), [from, s.days])

  const [rows, setRows] = useState<readonly Row[]>([])
  const [capped, setCapped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [undated, setUndated] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (startField === null) return
    setLoading(true)
    try {
      const result = await loadRows(table, {
        filter: andFilter(filter, rangeClause(startField, endField, from, to)),
        sort: sort === '' ? startField.name : sort,
        ceiling: CEILING,
      })
      setRows(result.rows)
      setCapped(result.capped)
      const none = await api.list(table, {
        filter: andFilter(filter, `${startField.name} is_null`),
        limit: 1,
        count: true,
      })
      setUndated(none.meta.count)
    } catch (e) {
      onError(messageFor(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [table, filter, sort, startField, endField, from, to, onError])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` is what asks for the reload
  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const lanes = useMemo<readonly Lane[]>(() => {
    if (startField === null) return []
    const bars: Bar[] = []
    for (const row of rows) {
      const start = localDateOf(row[startField.name], startField.kind)
      if (start === null) continue
      const rawEnd = endField === null ? null : localDateOf(row[endField.name], endField.kind)
      bars.push({ row, start, end: rawEnd === null || rawEnd < start ? start : rawEnd })
    }
    if (groupField === null) return [{ key: 'all', label: null, bars }]

    const keyOf = (row: Row): string => {
      const value = row[groupField.name]
      if (value === null || value === undefined || value === '') return ''
      if (groupField.kind === 'link') return String((value as { id?: string }).id ?? '')
      return String(value)
    }
    const groups = new Map<string, Bar[]>()
    for (const bar of bars) {
      const key = keyOf(bar.row)
      groups.set(key, [...(groups.get(key) ?? []), bar])
    }
    const order =
      groupField.kind === 'select'
        ? [...(groupField.options ?? []).map((o) => o.value), '']
        : [...groups.keys()].sort((a, b) => {
            if (a === '') return 1
            if (b === '') return -1
            const label = (k: string) => {
              const first = groups.get(k)?.[0]?.row[groupField.name] as { display?: string } | null
              return first?.display ?? k
            }
            return label(a).localeCompare(label(b), intlLocale())
          })
    return order.flatMap((key) => {
      const list = groups.get(key)
      if (list === undefined) return []
      let label: React.ReactNode = (
        <span key={key} className="text-muted-foreground">
          {$t('Sans valeur')}
        </span>
      )
      if (key !== '' && groupField.kind === 'select') {
        const option = groupField.options?.find((o) => o.value === key)
        label = <OptionBadge key={key} option={option ?? { label: key }} />
      } else if (key !== '') {
        const link = list[0]?.row[groupField.name] as { display?: string | null } | null
        label = (
          <span key={key} className="truncate">
            {link?.display ?? key.slice(0, 8)}
          </span>
        )
      }
      return [{ key, label, bars: list }]
    })
  }, [rows, startField, endField, groupField])

  // ── Moving and stretching a bar ────────────────────────────────────────────────────

  const commit = async (bar: Bar, shiftStart: number, shiftEnd: number) => {
    if (startField === null) return
    const values: Record<string, unknown> = {}
    if (shiftStart !== 0) {
      values[startField.name] = storedOfDate(addDays(bar.start, shiftStart), startField.kind)
    }
    const end = endField === null ? null : localDateOf(bar.row[endField.name], endField.kind)
    if (endField !== null && shiftEnd !== 0 && endField.read_only !== true) {
      // A row with no end yet gets one when its bar is stretched: the start, moved.
      values[endField.name] = storedOfDate(addDays(end ?? bar.start, shiftEnd), endField.kind)
    }
    if (Object.keys(values).length === 0) return
    setRows((current) =>
      current.map((r) => (r._id === bar.row._id ? ({ ...r, ...values } as Row) : r)),
    )
    onError(null)
    try {
      await api.updateRecord(table, bar.row._id, values)
    } catch (e) {
      onError(messageFor(e))
    } finally {
      void load()
    }
  }

  if (startField === null) {
    return (
      <Unavailable>
        {$t('Le champ de début de cette chronologie n’existe plus, ou ne vous est pas ouvert.')}
      </Unavailable>
    )
  }

  const width = s.days * s.px
  const todayOffset = daysBetween(from, new Date()) * s.px

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setAnchor(startOfDay(new Date()))}
        >
          {$t('Aujourd’hui')}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => setAnchor((a) => addDays(a, -s.step))}
          aria-label={$t('Précédent')}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => setAnchor((a) => addDays(a, s.step))}
          aria-label={$t('Suivant')}
        >
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold">
          {SHORT.format(from)} – {SHORT.format(addDays(to, -1))} {to.getFullYear()}
        </h2>
        {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        {capped && (
          <span className="text-xs text-destructive">
            {$t('Plus de {ceiling} lignes sur la période : resserrez le filtre.', {
              ceiling: CEILING,
            })}
          </span>
        )}
        <div className="flex-1" />
        {undated !== null && undated > 0 && (
          <Hint label={$t('Lignes sans date de début')}>
            <span className="text-xs text-muted-foreground">
              {$t('{undated} sans date', { undated })}
            </span>
          </Hint>
        )}
        <fieldset className="flex rounded-md border p-0.5">
          <legend className="sr-only">{$t('Échelle')}</legend>
          {(Object.keys(SCALES) as TimelineScale[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={scale === k}
              onClick={() => setScale(k)}
              className={cn(
                'rounded px-2 py-0.5 text-xs',
                scale === k
                  ? 'bg-secondary font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {SCALES[k].label}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="min-h-0 flex-1 overflow-auto scroll-discret">
        <div className="relative" style={{ width: LABEL + width }}>
          <Axis from={from} scale={scale} />

          {lanes.map((lane) => (
            <section key={lane.key}>
              {lane.label !== null && (
                <div
                  className="sticky left-0 z-10 flex h-8 items-center gap-2 border-b bg-muted/60 px-3 text-xs font-medium"
                  style={{ width: LABEL + width }}
                >
                  <span className="sticky left-3 flex min-w-0 items-center gap-2">
                    {lane.label}
                    <span className="tabular-nums text-muted-foreground">{lane.bars.length}</span>
                  </span>
                </div>
              )}
              {lane.bars.map((bar) => (
                <div key={bar.row._id} className="flex border-b" style={{ height: ROW }}>
                  <button
                    type="button"
                    onClick={() => onOpen(bar.row)}
                    className={cn(
                      'sticky left-0 z-10 flex shrink-0 items-center truncate border-r bg-background px-3 text-left text-sm hover:bg-muted/60',
                      bar.row._id === openedId && 'font-medium text-primary',
                    )}
                    style={{ width: LABEL }}
                    title={titleOf(bar.row, title)}
                  >
                    <span className="truncate">{titleOf(bar.row, title)}</span>
                  </button>
                  <div className="relative" style={{ width }}>
                    <TimelineBar
                      bar={bar}
                      from={from}
                      px={s.px}
                      days={s.days}
                      label={[titleOf(bar.row, title), ...extra.map((f) => textOf(bar.row, f))]
                        .filter((t) => t !== '')
                        .join(' · ')}
                      color={colorOf(bar.row, colorField)}
                      selected={bar.row._id === openedId}
                      movable={movable}
                      resizable={resizable}
                      onOpen={() => onOpen(bar.row)}
                      onCommit={(shiftStart, shiftEnd) => void commit(bar, shiftStart, shiftEnd)}
                    />
                  </div>
                </div>
              ))}
            </section>
          ))}

          {lanes.every((l) => l.bars.length === 0) && !loading && (
            <p
              className="sticky left-0 p-6 text-sm text-muted-foreground"
              style={{ width: LABEL + Math.min(width, 800) }}
            >
              {$t('Aucune ligne sur cette période.')}
            </p>
          )}

          {dependsField !== null && (
            <Dependencies lanes={lanes} field={dependsField} from={from} px={s.px} days={s.days} />
          )}

          {todayOffset >= 0 && todayOffset <= width && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary/70"
              style={{ left: LABEL + todayOffset + s.px / 2 }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/** A value as plain text, for a bar's label. */
function textOf(row: Row, field: Field): string {
  const value = row[field.name]
  if (value === null || value === undefined) return ''
  if (field.kind === 'link') return (value as { display?: string | null }).display ?? ''
  if (field.kind === 'select') {
    return field.options?.find((o) => o.value === value)?.label ?? String(value)
  }
  if (typeof value === 'object') return ''
  return String(value)
}

/** The two lines of dates over the bars: months, and days or weeks under them. */
function Axis({ from, scale }: { readonly from: Date; readonly scale: TimelineScale }) {
  const s = SCALES[scale]
  const days = Array.from({ length: s.days }, (_, i) => addDays(from, i))
  const months: Array<{ key: string; label: string; offset: number; span: number }> = []
  for (const [i, day] of days.entries()) {
    const key = `${day.getFullYear()}-${day.getMonth()}`
    const last = months[months.length - 1]
    if (last?.key === key) {
      last.span++
    } else {
      months.push({
        key,
        label: scale === 'month' ? MONTH_SHORT.format(day) : MONTH.format(day),
        offset: i,
        span: 1,
      })
    }
  }
  return (
    <div className="sticky top-0 z-20 flex border-b bg-background">
      <div
        className="sticky left-0 z-30 shrink-0 border-r bg-background"
        style={{ width: LABEL }}
      />
      <div className="relative h-12" style={{ width: s.days * s.px }}>
        {months.map((m) => (
          <div
            key={m.key}
            className="absolute top-0 flex h-6 items-center truncate border-l px-2 text-xs font-medium first-letter:uppercase"
            style={{ left: m.offset * s.px, width: m.span * s.px }}
          >
            {m.label}
          </div>
        ))}
        {days.map((day, i) => {
          const opensWeek = day.getDay() === weekStart()
          const weekend = day.getDay() === 0 || day.getDay() === 6
          if (scale === 'day') {
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'absolute top-6 flex h-6 items-center justify-center border-l text-[11px] tabular-nums text-muted-foreground',
                  weekend && 'bg-muted/40',
                )}
                style={{ left: i * s.px, width: s.px }}
              >
                {DAY.format(day)}
              </div>
            )
          }
          if (scale === 'week' && opensWeek) {
            return (
              <div
                key={day.toISOString()}
                className="absolute top-6 flex h-6 items-center border-l px-1 text-[11px] tabular-nums text-muted-foreground"
                style={{ left: i * s.px, width: 7 * s.px }}
              >
                {SHORT.format(day)}
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

/**
 * One bar, moved or stretched with the pointer. The drag is followed on screen in whole
 * days, and written once, on release; a release that did not move is a click.
 */
function TimelineBar({
  bar,
  from,
  px,
  days,
  label,
  color,
  selected,
  movable,
  resizable,
  onOpen,
  onCommit,
}: {
  readonly bar: Bar
  readonly from: Date
  readonly px: number
  readonly days: number
  readonly label: string
  readonly color: string | null
  readonly selected: boolean
  readonly movable: boolean
  readonly resizable: boolean
  readonly onOpen: () => void
  readonly onCommit: (shiftStart: number, shiftEnd: number) => void
}) {
  const [drag, setDrag] = useState<{ mode: 'move' | 'end'; shift: number } | null>(null)
  const origin = useRef(0)
  const moved = useRef(false)

  const shiftStart = drag?.mode === 'move' ? drag.shift : 0
  const shiftEnd = drag === null ? 0 : drag.shift
  const startDay = daysBetween(from, bar.start) + shiftStart
  const endDay = Math.max(startDay, daysBetween(from, bar.end) + shiftEnd)
  const left = Math.max(0, startDay) * px
  const right = Math.min(days, endDay + 1) * px
  if (right <= 0 || left >= days * px) return null

  const begin = (mode: 'move' | 'end') => (e: React.PointerEvent<HTMLElement>) => {
    if ((mode === 'move' && !movable) || (mode === 'end' && !resizable)) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = e.clientX
    moved.current = false
    setDrag({ mode, shift: 0 })
  }
  const follow = (e: React.PointerEvent<HTMLElement>) => {
    if (drag === null) return
    const delta = e.clientX - origin.current
    if (Math.abs(delta) > 3) moved.current = true
    const shift = Math.round(delta / px)
    if (shift !== drag.shift) setDrag({ ...drag, shift })
  }
  const end = () => {
    if (drag === null) return
    const done = drag
    setDrag(null)
    if (done.shift !== 0) {
      onCommit(done.mode === 'move' ? done.shift : 0, done.shift)
    }
  }

  // A bar too short for its words carries them beside it, where there is room.
  const narrow = right - left < 96

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onPointerDown={begin('move')}
        onPointerMove={follow}
        onPointerUp={end}
        onPointerCancel={() => setDrag(null)}
        onClick={() => {
          if (!moved.current) onOpen()
          moved.current = false
        }}
        title={label}
        className={cn(
          'absolute top-1.5 flex h-6 items-center overflow-hidden rounded-md border border-primary/30 bg-primary/15 px-2 text-xs shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          movable && 'cursor-grab active:cursor-grabbing',
          selected && 'ring-2 ring-primary',
          drag !== null && 'z-10 shadow-md',
        )}
        style={{
          left,
          width: Math.max(right - left, 6),
          ...(color === null
            ? {}
            : {
                backgroundColor: `color-mix(in srgb, ${color} 22%, var(--background))`,
                borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
              }),
        }}
      >
        {!narrow && <span className="truncate">{label}</span>}
        {resizable && (
          <span
            aria-hidden
            onPointerDown={begin('end')}
            // Kept from the bar: its own handlers would follow and commit the same drag twice.
            onPointerMove={(e) => {
              e.stopPropagation()
              follow(e)
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              end()
            }}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-primary/30"
          />
        )}
      </button>
      {narrow && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1.5 flex h-6 max-w-60 items-center truncate text-xs text-muted-foreground"
          style={{ left: right + 6 }}
        >
          {label}
        </span>
      )}
    </>
  )
}

/** The axis's height: the lanes start under it. */
const AXIS = 48
/** A lane's header, when the timeline is grouped. */
const LANE_HEADER = 32

/**
 * The dependencies of a timeline — chapter 11 §1.6: an arrow from the end of each row
 * another depends on to the start of that other. One that goes back in time — the next
 * starts before the one it depends on ends — is red. Drawn from the saved dates: a bar
 * being dragged moves its arrows when it lands.
 */
function Dependencies({
  lanes,
  field,
  from,
  px,
  days,
}: {
  readonly lanes: readonly Lane[]
  readonly field: Field
  readonly from: Date
  readonly px: number
  readonly days: number
}) {
  // Where each bar sits: its row's middle, its two ends.
  const places = new Map<string, { y: number; start: number; end: number; bar: Bar }>()
  let y = AXIS
  for (const lane of lanes) {
    if (lane.label !== null) y += LANE_HEADER
    for (const bar of lane.bars) {
      const startDay = daysBetween(from, bar.start)
      const endDay = Math.max(startDay, daysBetween(from, bar.end))
      places.set(bar.row._id, {
        y: y + ROW / 2,
        start: LABEL + Math.max(0, Math.min(days, startDay)) * px,
        end: LABEL + Math.max(0, Math.min(days, endDay + 1)) * px,
        bar,
      })
      y += ROW
    }
  }

  const predecessorsOf = (row: Row): string[] => {
    const value = row[field.name]
    if (Array.isArray(value)) {
      return value.flatMap((v) => {
        const id = (v as { id?: unknown } | null)?.id
        return typeof id === 'string' ? [id] : []
      })
    }
    const id = (value as { id?: unknown } | null)?.id
    return typeof id === 'string' ? [id] : []
  }

  const arrows: Array<{ key: string; d: string; late: boolean }> = []
  for (const [id, next] of places) {
    for (const before of predecessorsOf(next.bar.row)) {
      const prior = places.get(before)
      if (prior === undefined) continue
      const x1 = prior.end
      const x2 = next.start
      const bend = Math.max(12, Math.min(40, Math.abs(x2 - x1) / 2))
      arrows.push({
        key: `${before}>${id}`,
        d: `M ${x1} ${prior.y} C ${x1 + bend} ${prior.y}, ${x2 - bend} ${next.y}, ${x2 - 2} ${next.y}`,
        late: next.bar.start.getTime() < prior.bar.end.getTime(),
      })
    }
  }
  if (arrows.length === 0) return null

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-[5] overflow-visible"
      width={LABEL + days * px}
      height={y}
    >
      <defs>
        <marker
          id="dep-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground" />
        </marker>
        <marker
          id="dep-arrow-late"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" className="fill-destructive" />
        </marker>
      </defs>
      {arrows.map((a) => (
        <path
          key={a.key}
          d={a.d}
          fill="none"
          strokeWidth={1.5}
          className={a.late ? 'stroke-destructive' : 'stroke-muted-foreground/70'}
          markerEnd={a.late ? 'url(#dep-arrow-late)' : 'url(#dep-arrow)'}
        />
      ))}
    </svg>
  )
}
