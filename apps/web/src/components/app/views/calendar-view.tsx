'use client'

import type { Row } from '@/components/app/grid/cell'
import { CardFields, colorOf, titleOf } from '@/components/app/views/card'
import { Unavailable } from '@/components/app/views/kanban-view'
import { loadRows } from '@/components/app/views/load'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { type Field, type Table, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  type CalendarSpec,
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
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CalendarX2, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

/**
 * The calendar — each row on its date, a month or a week at a time (ch. 11 §1.4).
 *
 * It asks for the rows of the WINDOW only: the view's filter joined to a date clause —
 * the start within the window, or, with an end date, every row that overlaps it. A row
 * spanning several days is shown on each. Dragging a row to another day moves it by that
 * many days, its end with it and its time of day kept; a click on a day opens a new row
 * already dated.
 *
 * The rows without a date are not forgotten: a button counts them and lists them, since a
 * calendar that silently leaves them out is how a task never gets planned.
 */

const CEILING = 1000
const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

const keyOf = (date: Date) => storedOfDate(date, 'date')

interface Placed {
  readonly row: Row
  readonly start: Date
  readonly end: Date
}

export function CalendarView({
  table,
  fields,
  spec,
  filter,
  sort,
  reloadKey,
  openedId,
  onOpen,
  onAdd,
  onError,
}: {
  readonly table: Table
  readonly fields: readonly Field[]
  readonly spec: CalendarSpec
  readonly filter: string
  readonly sort: string
  readonly reloadKey: number
  readonly openedId: string | null
  readonly onOpen: (row: Row) => void
  readonly onAdd?: (values: Record<string, unknown>) => void
  readonly onError: (message: string | null) => void
}) {
  const dateField = fields.find((f) => f.name === spec.date_field) ?? null
  const endField = fields.find((f) => f.name === spec.end_field) ?? null
  const colorField = fields.find((f) => f.name === spec.color_field) ?? null
  const title = titleFieldOf(table, fields, spec.title_field)
  const shown = useMemo(() => pick(fields, spec.card_fields), [fields, spec.card_fields])
  const movable =
    table.actions.includes('update') && dateField !== null && dateField.read_only !== true

  const [mode, setMode] = useState(spec.mode)
  useEffect(() => setMode(spec.mode), [spec.mode])
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))

  const { from, to, days } = useMemo(() => {
    const first =
      mode === 'month'
        ? startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
        : startOfWeek(anchor)
    const count = mode === 'month' ? 42 : 7
    return {
      from: first,
      to: addDays(first, count),
      days: Array.from({ length: count }, (_, i) => addDays(first, i)),
    }
  }, [anchor, mode])

  const [rows, setRows] = useState<readonly Row[]>([])
  const [capped, setCapped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [undated, setUndated] = useState<{ rows: readonly Row[]; count: number | null } | null>(
    null,
  )

  const load = useCallback(async () => {
    if (dateField === null) return
    setLoading(true)
    try {
      const result = await loadRows(table, {
        filter: andFilter(filter, rangeClause(dateField, endField, from, to)),
        sort: sort === '' ? dateField.name : sort,
        ceiling: CEILING,
      })
      setRows(result.rows)
      setCapped(result.capped)
      const none = await api.list(table, {
        filter: andFilter(filter, `${dateField.name} is_null`),
        sort,
        limit: 50,
        count: true,
      })
      setUndated({ rows: none.data as Row[], count: none.meta.count })
    } catch (e) {
      onError(messageFor(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [table, filter, sort, dateField, endField, from, to, onError])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` is what asks for the reload
  useEffect(() => {
    void load()
  }, [load, reloadKey])

  /** Every row, on every day of the window it covers. */
  const byDay = useMemo(() => {
    const map = new Map<string, Placed[]>()
    if (dateField === null) return map
    for (const row of rows) {
      const start = localDateOf(row[dateField.name], dateField.kind)
      if (start === null) continue
      const rawEnd = endField === null ? null : localDateOf(row[endField.name], endField.kind)
      const end = rawEnd === null || rawEnd < start ? start : rawEnd
      const span = Math.min(daysBetween(start, end), 366)
      for (let i = 0; i <= span; i++) {
        const day = addDays(startOfDay(start), i)
        if (day < from || day >= to) continue
        const key = keyOf(day)
        map.set(key, [...(map.get(key) ?? []), { row, start, end }])
      }
    }
    return map
  }, [rows, dateField, endField, from, to])

  // ── Moving a row to another day ────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = async (event: DragEndEvent) => {
    if (dateField === null || event.over === null) return
    const [id, fromKey] = String(event.active.id).split('|')
    const toKey = String(event.over.id)
    if (id === undefined || fromKey === undefined || fromKey === toKey) return
    const row = rows.find((r) => r._id === id)
    if (row === undefined) return
    const start = localDateOf(row[dateField.name], dateField.kind)
    if (start === null) return
    const shift = daysBetween(new Date(`${fromKey}T00:00:00`), new Date(`${toKey}T00:00:00`))
    const values: Record<string, unknown> = {
      [dateField.name]: storedOfDate(addDays(start, shift), dateField.kind),
    }
    const end = endField === null ? null : localDateOf(row[endField.name], endField.kind)
    if (endField !== null && end !== null && endField.read_only !== true) {
      values[endField.name] = storedOfDate(addDays(end, shift), endField.kind)
    }
    // Shown moved at once; the reload says what the database kept.
    setRows((current) => current.map((r) => (r._id === id ? ({ ...r, ...values } as Row) : r)))
    onError(null)
    try {
      await api.updateRecord(table, id, values)
    } catch (e) {
      onError(messageFor(e))
    } finally {
      void load()
    }
  }

  if (dateField === null) {
    return (
      <Unavailable>
        Le champ date de ce calendrier n’existe plus, ou ne vous est pas ouvert.
      </Unavailable>
    )
  }

  const today = keyOf(new Date())
  const step = (direction: 1 | -1) =>
    setAnchor((a) =>
      mode === 'month'
        ? new Date(a.getFullYear(), a.getMonth() + direction, 1)
        : addDays(a, 7 * direction),
    )

  const add =
    onAdd === undefined
      ? undefined
      : (day: Date) => {
          // A day given a time: nine o'clock, rather than a midnight nobody means.
          const at =
            dateField.kind === 'datetime'
              ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9)
              : day
          onAdd({ [dateField.name]: storedOfDate(at, dateField.kind) })
        }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setAnchor(startOfDay(new Date()))}
        >
          Aujourd’hui
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => step(-1)}
          aria-label="Précédent"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => step(1)}
          aria-label="Suivant"
        >
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold first-letter:uppercase">
          {mode === 'month' ? MONTH.format(anchor) : `Semaine du ${SHORT.format(from)}`}
        </h2>
        {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        {capped && (
          <span className="text-xs text-destructive">
            Plus de {CEILING} lignes sur la période : resserrez le filtre.
          </span>
        )}
        <div className="flex-1" />
        {undated !== null && (undated.count ?? undated.rows.length) > 0 && (
          <Undated rows={undated.rows} count={undated.count} title={title} onOpen={onOpen} />
        )}
        <fieldset className="flex rounded-md border p-0.5">
          <legend className="sr-only">{'Période'}</legend>
          {(['month', 'week'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded px-2 py-0.5 text-xs',
                mode === m
                  ? 'bg-secondary font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'month' ? 'Mois' : 'Semaine'}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b bg-muted/30">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-7 overflow-y-auto scroll-discret',
            mode === 'month' ? 'auto-rows-[minmax(7rem,1fr)]' : 'auto-rows-[minmax(100%,1fr)]',
          )}
        >
          {days.map((day) => {
            const key = keyOf(day)
            const outside = mode === 'month' && day.getMonth() !== anchor.getMonth()
            return (
              <DayCell
                key={key}
                dayKey={key}
                day={day}
                today={key === today}
                outside={outside}
                limit={mode === 'month' ? 3 : Number.POSITIVE_INFINITY}
                placed={byDay.get(key) ?? []}
                onAdd={add === undefined ? undefined : () => add(day)}
                render={(placed) => (
                  <EventChip
                    key={placed.row._id}
                    id={`${placed.row._id}|${key}`}
                    disabled={!movable}
                    label={titleOf(placed.row, title)}
                    time={
                      dateField.kind === 'datetime' && daysBetween(placed.start, day) === 0
                        ? TIME.format(placed.start)
                        : null
                    }
                    continued={daysBetween(placed.start, day) > 0}
                    color={colorOf(placed.row, colorField)}
                    selected={placed.row._id === openedId}
                    onOpen={() => onOpen(placed.row)}
                  >
                    {mode === 'week' && <CardFields row={placed.row} fields={shown} />}
                  </EventChip>
                )}
              />
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}

function DayCell({
  dayKey,
  day,
  today,
  outside,
  limit,
  placed,
  onAdd,
  render,
}: {
  readonly dayKey: string
  readonly day: Date
  readonly today: boolean
  readonly outside: boolean
  readonly limit: number
  readonly placed: readonly Placed[]
  readonly onAdd?: () => void
  readonly render: (placed: Placed) => React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey })
  const visible = placed.slice(0, limit)
  const hidden = placed.length - visible.length
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group/day flex min-w-0 flex-col gap-1 border-r border-b p-1 [&:nth-child(7n)]:border-r-0',
        outside && 'bg-muted/30',
        isOver && 'bg-primary/10',
      )}
    >
      <div className="flex h-6 shrink-0 items-center justify-between px-1">
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
            today && 'bg-primary font-semibold text-primary-foreground',
            outside && !today && 'text-muted-foreground',
          )}
        >
          {day.getDate()}
        </span>
        {onAdd !== undefined && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100"
            aria-label="Ajouter une ligne à cette date"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        {visible.map(render)}
        {hidden > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
              >
                {hidden} de plus
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-64 flex-col gap-0.5 p-2">
              <p className="mb-1 px-1 text-xs font-medium">{SHORT.format(day)}</p>
              {placed.map(render)}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

function EventChip({
  id,
  disabled,
  label,
  time,
  continued,
  color,
  selected,
  onOpen,
  children,
}: {
  readonly id: string
  readonly disabled: boolean
  readonly label: string
  readonly time: string | null
  readonly continued: boolean
  readonly color: string | null
  readonly selected: boolean
  readonly onOpen: () => void
  readonly children?: React.ReactNode
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id, disabled })
  const style: CSSProperties | undefined =
    color === null
      ? undefined
      : {
          backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
          borderLeftColor: color,
        }
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // biome-ignore lint/a11y/useSemanticElements: in the week view the chip holds the card's list of values, which a <button> may not contain
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      title={label}
      className={cn(
        'min-w-0 cursor-pointer rounded border-l-2 border-l-primary/60 bg-primary/10 px-1.5 py-0.5 text-xs outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40',
        continued && 'opacity-70',
        selected && 'ring-2 ring-primary',
        isDragging && 'opacity-40',
      )}
      style={style}
    >
      <p className="truncate">
        {time !== null && <span className="mr-1 tabular-nums text-muted-foreground">{time}</span>}
        {label}
      </p>
      {children}
    </div>
  )
}

/** The rows that have no date: counted, and listed so they can be opened and dated. */
function Undated({
  rows,
  count,
  title,
  onOpen,
}: {
  readonly rows: readonly Row[]
  readonly count: number | null
  readonly title: Field | null
  readonly onOpen: (row: Row) => void
}) {
  const total = count ?? rows.length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <CalendarX2 className="size-3.5" />
          {total} sans date
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Ouvrez une ligne pour lui donner une date.
        </p>
        <div className="max-h-72 overflow-y-auto scroll-discret">
          {rows.map((row) => (
            <button
              key={row._id}
              type="button"
              onClick={() => onOpen(row)}
              className="block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {titleOf(row, title)}
            </button>
          ))}
        </div>
        {total > rows.length && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Et {total - rows.length} autres.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
