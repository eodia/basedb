'use client'

import type { Row } from '@/components/app/grid/cell'
import { OptionBadge, OptionGlyph } from '@/components/app/option-badge'
import { CardDescription, RecordCard, coverOf } from '@/components/app/views/card'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { type Field, type FieldOption, type Table, api } from '@/lib/api/client'
import { quoteLiteral } from '@/lib/expression'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  type KanbanSpec,
  andFilter,
  nextHandOrder,
  orderByHand,
  pick,
  titleFieldOf,
} from '@/lib/views'
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS, type Coordinates, getEventCoordinates } from '@dnd-kit/utilities'
import { Inbox, Loader2, Plus } from 'lucide-react'
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * The kanban — one column per choice of a list, and a card per row (ch. 11 §1.6).
 *
 * Each column is its OWN query: the view's filter and « statut eq "x" », one page at a
 * time. Loading the table and sorting it into columns on the screen would stop at the
 * first page, and a column whose rows all come after it would read as empty. The count
 * of each column is asked for once, and says « 100 000+ » when the kernel caps it.
 *
 * Two things are dragged, and they write two different things:
 *
 *   une CARTE change de colonne — un `PATCH` d'un champ de la ligne, affiché aussitôt et
 *   remis en place si la base le refuse — ou de rang, quand la vue est rangée à la main ;
 *   une COLONNE, prise par son en-tête, change de place — l'ordre de la vue
 *   (`spec.group_order`), jamais celui de la liste de choix, qui reste le même partout
 *   ailleurs. La colonne « Sans valeur » reste en tête : elle n'est pas un choix.
 *
 * Each column wears its choice's colour — a band on top, the body faintly tinted — so the
 * board reads at a glance as the list it is made of. A card may carry a description under
 * its title, a sentence whose variables are the row's values (`spec.card_template`).
 *
 * While a card travels, it is drawn where it would land — a ghost, faded and outlined —
 * and the others make room for it. That place follows the pointer: the column under it,
 * and the rank among its cards when the view is ranked by hand; else the rank the view
 * gives it, the top of the column under a sort, which decides once the card is written.
 * The cards glide rather than jump as it goes (`useGlide`), and dropped, it settles into
 * its ghost's place (`settle`) — unless the reader asked for less motion.
 */

const PAGE = 50
/** Column keys: `v:<value>` for a choice, `none` for the rows that carry none. */
const NONE = 'none'

interface Column {
  readonly key: string
  readonly value: string | null
  readonly option: FieldOption | null
}

interface ColumnState {
  readonly rows: readonly Row[]
  readonly cursor: string | null
  readonly count: number | null
  readonly capped: boolean
  readonly loading: boolean
  readonly error: string | null
}

const EMPTY: ColumnState = {
  rows: [],
  cursor: null,
  count: null,
  capped: false,
  loading: true,
  error: null,
}

/** The card being dragged, and the column it comes from. */
interface Dragged {
  readonly row: Row
  readonly from: string
}

/** Where a card being dragged would land: the column, and its rank among the others. */
interface Landing {
  readonly column: string
  readonly index: number
}

/**
 * A column dragged lands on the column CLOSEST to it — among the choices alone, never on
 * « Sans valeur ». A card collides with nothing: where it lands is its ghost's place,
 * which the pointer sets (`landingAt`).
 */
const collision: CollisionDetection = (args) =>
  args.active.data.current?.type === 'column'
    ? closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => c.data.current?.type === 'column',
        ),
      })
    : []

/** The ease of every motion of the board: quick to leave, gentle to arrive. */
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'
const GLIDE = 200

/** Asked for less motion, the board has none: the cards jump, the dropped one vanishes. */
const still = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Dropped, the card flies to its ghost's place, straightening on the way, and takes it —
 * hidden meanwhile. A column's header flies to its column, which stays in sight.
 */
const settle: DropAnimation = {
  duration: GLIDE,
  easing: EASE,
  sideEffects: (parameters) => {
    if (parameters.active.data.current?.type === 'column') return
    parameters.dragOverlay.node.firstElementChild?.animate(
      [{ rotate: '3deg' }, { rotate: '0deg' }],
      { duration: GLIDE, easing: EASE, fill: 'forwards' },
    )
    return defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } })(parameters)
  },
}

export function KanbanView({
  table,
  fields,
  spec,
  filter,
  sort,
  reloadKey,
  openedId,
  onOpen,
  onAdd,
  onReorderColumns,
  onReorderCards,
  onError,
}: {
  readonly table: Table
  /** The business fields the reader sees. */
  readonly fields: readonly Field[]
  readonly spec: KanbanSpec
  /** The filter in force — the view's, or the one being tried over it. */
  readonly filter: string
  readonly sort: string
  /** Moves when rows were written elsewhere — the panel — and the columns must follow. */
  readonly reloadKey: number
  readonly openedId: string | null
  readonly onOpen: (row: Row) => void
  /** Opens a new row with these values already set — the column's choice. */
  readonly onAdd?: (values: Record<string, unknown>) => void
  /**
   * Saves a new order of the columns, as choice values. Absent for a reader who may not
   * change the view: the columns then stay where they are.
   */
  readonly onReorderColumns?: (order: readonly string[]) => Promise<void>
  /**
   * Saves the cards' order by hand (`spec.manual_order`), when no sort says otherwise.
   * Absent for a reader who may not change the view.
   */
  readonly onReorderCards?: (order: readonly string[]) => Promise<void>
  readonly onError: (message: string | null) => void
}) {
  const group = fields.find((f) => f.name === spec.group_by) ?? null
  const title = titleFieldOf(table, fields, spec.title_field)
  const shown = useMemo(() => pick(fields, spec.card_fields), [fields, spec.card_fields])
  const cover = fields.find((f) => f.name === spec.cover_field) ?? null
  const movable = table.actions.includes('update') && group !== null && group.read_only !== true
  const reorderable = onReorderColumns !== undefined

  /** Every column, in the list's order — what is LOADED, whatever order it is drawn in. */
  const columns = useMemo<readonly Column[]>(() => {
    if (group === null) return []
    const options = (group.options ?? []).map((option) => ({
      key: `v:${option.value}`,
      value: option.value,
      option,
    }))
    return [{ key: NONE, value: null, option: null }, ...options]
  }, [group])

  // The order as dropped, while the view is being saved; then the saved one replaces it.
  const [pendingOrder, setPendingOrder] = useState<readonly string[] | null>(null)
  const savedOrder = JSON.stringify(spec.group_order)
  useEffect(() => {
    void savedOrder
    setPendingOrder(null)
  }, [savedOrder])
  const order = pendingOrder ?? spec.group_order

  /** The choices in the view's order; one it does not name — added since — goes last. */
  const choices = useMemo(() => {
    const rank = new Map(order.map((value, index) => [value, index]))
    return columns
      .filter((c) => c.value !== null)
      .map((column, index) => ({
        column,
        at: rank.get(column.value as string) ?? order.length + index,
      }))
      .sort((a, b) => a.at - b.at)
      .map((entry) => entry.column)
  }, [columns, order])

  const [state, setState] = useState<Readonly<Record<string, ColumnState>>>({})
  const [pendingCards, setPendingCards] = useState<readonly string[] | null>(null)
  const savedCards = JSON.stringify(spec.manual_order)
  useEffect(() => {
    void savedCards
    setPendingCards(null)
  }, [savedCards])
  const byHand = sort === ''
  /** Cards in the order drawn: by hand when no sort says otherwise. */
  const arrange = useCallback(
    (rows: readonly Row[]): readonly Row[] =>
      byHand ? orderByHand(rows, pendingCards ?? spec.manual_order) : rows,
    [byHand, pendingCards, spec.manual_order],
  )
  /** A column's cards as drawn. */
  const drawn = useCallback(
    (key: string): readonly Row[] => arrange(state[key]?.rows ?? []),
    [state, arrange],
  )

  const clause = useCallback(
    (column: Column) =>
      group === null
        ? ''
        : column.value === null
          ? `${group.name} is_null`
          : `${group.name} eq ${quoteLiteral(column.value)}`,
    [group],
  )

  const board = useRef<HTMLDivElement>(null)
  const glide = useGlide(board)

  const loadColumn = useCallback(
    async (column: Column, after: string | null) => {
      setState((s) => ({ ...s, [column.key]: { ...(s[column.key] ?? EMPTY), loading: true } }))
      try {
        const page = await api.list(table, {
          filter: andFilter(filter, clause(column)),
          sort,
          limit: PAGE,
          after: after ?? undefined,
          count: after === null,
        })
        // Read again after a drop, a card may stand elsewhere: it glides there.
        glide()
        setState((s) => {
          const previous = s[column.key] ?? EMPTY
          return {
            ...s,
            [column.key]: {
              rows:
                after === null ? (page.data as Row[]) : [...previous.rows, ...(page.data as Row[])],
              cursor: page.meta.has_next_page ? page.meta.next_cursor : null,
              count: after === null ? page.meta.count : previous.count,
              capped: after === null ? page.meta.count_is_capped : previous.capped,
              loading: false,
              error: null,
            },
          }
        })
      } catch (e) {
        setState((s) => ({
          ...s,
          [column.key]: { ...(s[column.key] ?? EMPTY), loading: false, error: messageFor(e) },
        }))
      }
    },
    [table, filter, sort, clause, glide],
  )

  // Keyed on the columns as LOADED, not as drawn: moving a column reads nothing again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` is what asks for the reload
  useEffect(() => {
    setState({})
    for (const column of columns) void loadColumn(column, null)
  }, [columns, loadColumn, reloadKey])

  // ── Dragging ───────────────────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [dragged, setDragged] = useState<Dragged | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<Column | null>(null)
  // Where the card's ghost stands; `null` where it was — dropped there, nothing moves.
  const [landing, setLanding] = useState<Landing | null>(null)
  const pointer = useRef<Coordinates | null>(null)
  /** A card takes the rank it is dropped at: the view is ranked by hand, and may change. */
  const ranked = byHand && onReorderCards !== undefined

  const columnOf = (key: string) => columns.find((c) => c.key === key)

  // The pointer, followed while a card travels: where it is says where the card lands.
  useEffect(() => {
    if (dragged === null) return
    const follow = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', follow, { passive: true })
    return () => window.removeEventListener('pointermove', follow)
  }, [dragged])

  /**
   * Where the card would land, the pointer where it is: the column under it — anywhere
   * across its width — and, ranked by hand, before the first other card whose middle is
   * below the pointer. `null` out of the board, or where it may not go: back where it
   * was. `undefined` between two columns: the ghost stays where it stood.
   */
  const landingAt = (card: Dragged): Landing | null | undefined => {
    const host = board.current
    const at = pointer.current
    if (group === null || host === null || at === null) return undefined
    const bounds = host.getBoundingClientRect()
    if (at.x < bounds.left || at.x > bounds.right || at.y < bounds.top || at.y > bounds.bottom)
      return null
    for (const section of host.querySelectorAll<HTMLElement>('[data-column]')) {
      const r = section.getBoundingClientRect()
      if (at.x < r.left || at.x > r.right) continue
      const key = section.dataset.column ?? ''
      const home = key === card.from
      if (!home && !movable) return null
      if (!ranked) {
        if (home) return null
        // Its rank is the view's: the one it takes once written in this column.
        const moved = { ...card.row, [group.name]: columnOf(key)?.value ?? null } as Row
        const others = (state[key]?.rows ?? []).filter((row) => row._id !== card.row._id)
        return { column: key, index: arrange([moved, ...others]).indexOf(moved) }
      }
      let index = 0
      for (const other of section.querySelectorAll<HTMLElement>('[data-card]')) {
        if (other.dataset.card === card.row._id) continue
        const c = other.getBoundingClientRect()
        if (at.y > c.top + c.height / 2) index += 1
      }
      return { column: key, index }
    }
    return undefined
  }

  const aim = () => {
    if (dragged === null) return
    const next = landingAt(dragged)
    if (next === undefined) return
    if (next?.column === landing?.column && next?.index === landing?.index) return
    glide()
    setLanding(next)
  }

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    if (event.active.data.current?.type === 'column') {
      setDraggedColumn(choices.find((c) => c.key === id) ?? null)
      return
    }
    const from = columns.find((c) => state[c.key]?.rows.some((r) => r._id === id))
    const row = from === undefined ? undefined : state[from.key]?.rows.find((r) => r._id === id)
    if (from === undefined || row === undefined) return
    pointer.current = getEventCoordinates(event.activatorEvent)
    setLanding(null)
    setDragged({ row, from: from.key })
  }

  const moveColumn = async (event: DragEndEvent) => {
    if (onReorderColumns === undefined || event.over === null) return
    const keys = choices.map((c) => c.key)
    const from = keys.indexOf(String(event.active.id))
    const to = keys.indexOf(String(event.over.id))
    if (from === -1 || to === -1 || from === to) return
    const next = arrayMove(choices, from, to).map((c) => c.value as string)
    setPendingOrder(next)
    onError(null)
    try {
      await onReorderColumns(next)
    } catch (e) {
      // The columns go back where the saved view has them.
      setPendingOrder(null)
      onError(messageFor(e))
    }
  }

  /** The card dropped where its ghost stood: in another column, at another rank, or both. */
  const moveCard = async (card: Dragged, to: Landing) => {
    const source = columnOf(card.from)
    const target = columnOf(to.column)
    if (group === null || source === undefined || target === undefined) return
    const id = card.row._id
    const others = (key: string) =>
      drawn(key)
        .map((r) => r._id)
        .filter((other) => other !== id)
    const placed = others(target.key)
    placed.splice(to.index, 0, id)
    // Every column as drawn, the card where it was dropped: the order is the view's, whole.
    const order = ranked
      ? nextHandOrder(
          columns.flatMap((c) => (c.key === target.key ? placed : others(c.key))),
          spec.manual_order,
        )
      : null

    if (target.key === source.key) {
      const before = drawn(source.key).map((r) => r._id)
      if (order === null || onReorderCards === undefined) return
      if (placed.every((other, i) => other === before[i])) return
      setPendingCards(order)
      onError(null)
      try {
        await onReorderCards(order)
      } catch (e) {
        setPendingCards(null)
        onError(messageFor(e))
      }
      return
    }

    // Shown where it was dropped before the server answers: at its rank, or at the top.
    const moved = { ...card.row, [group.name]: target.value } as Row
    if (order !== null) setPendingCards(order)
    setState((s) => {
      const from = s[source.key] ?? EMPTY
      const to = s[target.key] ?? EMPTY
      return {
        ...s,
        [source.key]: {
          ...from,
          rows: from.rows.filter((r) => r._id !== id),
          count: from.count === null ? null : from.count - 1,
        },
        [target.key]: {
          ...to,
          rows: [moved, ...to.rows],
          count: to.count === null ? null : to.count + 1,
        },
      }
    })
    onError(null)
    try {
      await api.updateRecord(table, id, { [group.name]: target.value })
      // Its rank once it is there: saved before, it would name a card still elsewhere.
      if (order !== null) await onReorderCards?.(order)
    } catch (e) {
      setPendingCards(null)
      onError(messageFor(e))
    } finally {
      // Either way the two columns are read again: the sort may place the card elsewhere,
      // and a refusal must not leave it where it was dropped.
      void loadColumn(source, null)
      void loadColumn(target, null)
    }
  }

  const stop = () => {
    setDragged(null)
    setDraggedColumn(null)
    setLanding(null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    if (event.active.data.current?.type === 'column') {
      stop()
      void moveColumn(event)
      return
    }
    glide()
    stop()
    if (dragged !== null && landing !== null) void moveCard(dragged, landing)
  }

  // Given up — the window lost, say —, the card glides back where it was.
  const onDragCancel = () => {
    glide()
    stop()
  }

  if (group === null) {
    return (
      <Unavailable>
        {$t(
          'Le champ qui forme les colonnes de ce kanban n’existe plus, ou ne vous est pas ouvert.',
        )}
      </Unavailable>
    )
  }

  const none = columns.find((c) => c.key === NONE)
  const noneState = state[NONE]
  // The column of rows without a choice only when it has some: most lists are always
  // filled, and an empty « Sans valeur » column is noise.
  const showNone = noneState !== undefined && !noneState.loading && noneState.rows.length > 0
  const visible = choices.filter((column) => {
    if (!spec.hide_empty) return true
    const s = state[column.key]
    return s === undefined || s.loading || s.rows.length > 0
  })

  const describe = (row: Row) =>
    spec.card_template === '' ? undefined : (
      <CardDescription template={spec.card_template} row={row} fields={fields} />
    )
  /** A column's cards as shown: the one travelling stands where it would land. */
  const listed = (key: string): readonly Row[] => {
    const rows = drawn(key)
    if (dragged === null || landing === null) return rows
    const others = rows.filter((row) => row._id !== dragged.row._id)
    if (key !== landing.column) return others
    return [...others.slice(0, landing.index), dragged.row, ...others.slice(landing.index)]
  }
  /** The column the card would be written into — not the one it comes from. */
  const receives = (column: Column) =>
    dragged !== null && landing?.column === column.key && column.key !== dragged.from
  const cards = (rows: readonly Row[]) =>
    rows.map((row) => (
      <DraggableCard key={row._id} id={row._id} disabled={!movable && !ranked}>
        <RecordCard
          row={row}
          title={title}
          fields={shown}
          cover={coverOf(row, cover)}
          coverClassName="h-32"
          description={describe(row)}
          selected={row._id === openedId}
          onOpen={() => onOpen(row)}
          className="rounded-xl border-border/70 transition-[box-shadow,transform,opacity] duration-150 hover:-translate-y-0.5"
        />
      </DraggableCard>
    ))
  const adder = (column: Column) =>
    onAdd === undefined
      ? undefined
      : () => onAdd(column.value === null ? {} : { [group.name]: column.value })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragMove={aim}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div ref={board} className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-4 scroll-discret">
        {none !== undefined && showNone && (
          <ColumnFrame
            column={none}
            state={noneState}
            shown={listed(none.key).length}
            receives={receives(none)}
            onMore={(cursor) => void loadColumn(none, cursor)}
            onAdd={adder(none)}
            droppable={movable}
          >
            {cards(listed(none.key))}
          </ColumnFrame>
        )}
        <SortableContext items={visible.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
          {visible.map((column) => (
            <SortableColumn key={column.key} column={column} disabled={!reorderable}>
              {(frame) => (
                <ColumnFrame
                  {...frame}
                  column={column}
                  state={state[column.key] ?? EMPTY}
                  shown={listed(column.key).length}
                  receives={receives(column)}
                  onMore={(cursor) => void loadColumn(column, cursor)}
                  onAdd={adder(column)}
                  droppable={movable}
                >
                  {cards(listed(column.key))}
                </ColumnFrame>
              )}
            </SortableColumn>
          ))}
        </SortableContext>
        {visible.length === 0 && !showNone && (
          <p className="m-auto text-sm text-muted-foreground">{$t('Aucune ligne à afficher.')}</p>
        )}
      </div>
      <DragOverlay dropAnimation={still() ? null : settle}>
        {dragged !== null && (
          <RecordCard
            row={dragged.row}
            title={title}
            fields={shown}
            cover={coverOf(dragged.row, cover)}
            coverClassName="h-32"
            description={describe(dragged.row)}
            // The card's own width, so that it fits its place exactly once dropped.
            className="w-full rotate-3 cursor-grabbing rounded-xl shadow-xl ring-1 ring-primary/30"
          />
        )}
        {draggedColumn?.option != null && (
          <div className="flex h-11 w-72 cursor-grabbing items-center gap-2 rounded-2xl bg-card px-3 shadow-xl ring-1 ring-primary/40">
            <OptionBadge option={draggedColumn.option} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * What a column wrapper hands its frame: where it is, and how its header is grabbed.
 * « Sans valeur » is never moved: it has none of it.
 */
interface Frame {
  readonly setNodeRef?: (node: HTMLElement | null) => void
  readonly style?: CSSProperties
  readonly isDragging?: boolean
  /** Spread on the header when the column can be moved; absent otherwise. */
  readonly handle?: Record<string, unknown>
}

/** A choice's column, moved by its header. */
function SortableColumn({
  column,
  disabled,
  children,
}: {
  readonly column: Column
  readonly disabled: boolean
  readonly children: (frame: Frame) => ReactNode
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.key,
    data: { type: 'column' },
    disabled,
  })
  return children({
    setNodeRef,
    style: { transform: CSS.Translate.toString(transform), transition },
    isDragging,
    handle: disabled ? undefined : { ...attributes, ...listeners },
  })
}

/** The column's colour, or a neutral one for « Sans valeur » and a choice without one. */
const NEUTRAL = 'var(--muted-foreground)'

function ColumnFrame({
  column,
  state,
  shown,
  receives,
  onMore,
  onAdd,
  droppable,
  setNodeRef,
  style,
  isDragging = false,
  handle,
  children,
}: Frame & {
  readonly column: Column
  readonly state: ColumnState
  /** The cards drawn — a card passing through counted where its ghost stands. */
  readonly shown: number
  /** A card from another column would be written into this one. */
  readonly receives: boolean
  readonly onMore: (cursor: string) => void
  readonly onAdd?: () => void
  /** Cards may be dropped here: an empty column says so. */
  readonly droppable: boolean
  readonly children: ReactNode
}) {
  const count = state.count === null ? state.rows.length : state.capped ? '100 000+' : state.count
  const color = column.option?.color ?? null
  const tint = color ?? NEUTRAL
  const empty = !state.loading && shown === 0 && state.error === null
  return (
    <section
      ref={setNodeRef}
      data-column={column.key}
      style={{
        ...style,
        // The body faintly in the choice's colour, over the muted surface of the board.
        backgroundColor: `color-mix(in srgb, ${tint} ${color === null ? 4 : 7}%, var(--muted))`,
      }}
      className={cn(
        'flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 transition-[box-shadow,opacity]',
        receives && 'shadow-md ring-2 ring-primary/50',
        // Its place stays marked while it travels, as an outline.
        isDragging && 'opacity-40 outline-2 outline-dashed outline-primary/50',
      )}
      aria-label={column.option?.label ?? $t('Sans valeur')}
    >
      <span aria-hidden className="h-1 shrink-0" style={{ backgroundColor: tint }} />
      <Hint label={handle === undefined ? undefined : $t('Glisser pour déplacer la colonne')}>
        <header
          {...handle}
          // The header is the handle: grabbing anywhere on it moves the column.
          className={cn(
            'flex h-11 shrink-0 items-center gap-2 px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
            handle !== undefined && 'cursor-grab active:cursor-grabbing',
          )}
        >
          {column.option === null ? (
            <span className="truncate text-sm font-semibold text-muted-foreground">
              {$t('Sans valeur')}
            </span>
          ) : (
            <>
              <OptionGlyph
                look={column.option}
                // A pictogram or a picture reads at the size of the label; a plain colour is a dot.
                className={
                  (column.option.icon ?? null) !== null || (column.option.image ?? null) !== null
                    ? 'size-4'
                    : 'size-2.5'
                }
              />
              <span
                className="truncate text-sm font-semibold"
                style={
                  color === null
                    ? undefined
                    : { color: `color-mix(in oklab, ${color} 70%, var(--foreground))` }
                }
              >
                {column.option.label}
              </span>
            </>
          )}
          <span className="shrink-0 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground ring-1 ring-border/60">
            {count}
          </span>
          <div className="flex-1" />
          {state.loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </header>
      </Hint>
      <div className="flex min-h-16 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5 scroll-discret">
        {children}
        {empty && (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            <Inbox className="size-4 opacity-60" />
            {droppable ? $t('Déposez une carte ici') : $t('Aucune carte')}
          </div>
        )}
        {state.error !== null && (
          <p className="rounded-md bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
            {state.error}
          </p>
        )}
        {state.cursor !== null && !state.loading && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onMore(state.cursor as string)}
          >
            {$t('Charger plus')}
          </Button>
        )}
      </div>
      {onAdd !== undefined && (
        <div className="shrink-0 px-2.5 pb-2.5">
          <button
            type="button"
            onClick={onAdd}
            className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Plus className="size-3.5" />
            {$t('Ajouter une carte')}
          </button>
        </div>
      )}
    </section>
  )
}

function DraggableCard({
  id,
  disabled,
  children,
}: {
  readonly id: string
  readonly disabled: boolean
  readonly children: ReactNode
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id,
    disabled,
    data: { type: 'card' },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // Where the pointer looks for the cards of a column (`landingAt`).
      data-card={id}
      // The card itself is the button that opens the row; the wrapper only carries the drag.
      tabIndex={-1}
      role="presentation"
      className={cn(
        // While it travels, its ghost: where it would land, faded and outlined.
        isDragging &&
          'pointer-events-none rounded-xl outline-2 -outline-offset-2 outline-dashed outline-primary/60 *:opacity-40 *:shadow-none',
      )}
    >
      {children}
    </div>
  )
}

/** Where a card stands: its column, and its box on the screen as seen. */
interface Place {
  readonly column: string
  readonly rect: DOMRect
}

const placeOf = (card: HTMLElement): Place => ({
  column: card.closest<HTMLElement>('[data-column]')?.dataset.column ?? '',
  rect: card.getBoundingClientRect(),
})

/**
 * The cards glide to their new places rather than jump there (FLIP): the returned
 * function takes where each one stands just before a change, and once the change is drawn,
 * each card that moved plays the way from there. One that changed column fades in instead:
 * it would fly across the board. Taken where they are SEEN, a glide cut short by the next
 * change carries on from where it was.
 */
function useGlide(board: RefObject<HTMLElement | null>) {
  const places = useRef<Map<string, Place> | null>(null)
  const capture = useCallback(() => {
    const host = board.current
    // The first places taken hold until the change is drawn: the way starts there.
    if (host === null || places.current !== null) return
    places.current = new Map(
      [...host.querySelectorAll<HTMLElement>('[data-card]')].map((card) => [
        card.dataset.card ?? '',
        placeOf(card),
      ]),
    )
  }, [board])
  // After every render: a change captured is played once drawn, then forgotten.
  useLayoutEffect(() => {
    const before = places.current
    places.current = null
    const host = board.current
    if (before === null || host === null || still()) return
    for (const card of host.querySelectorAll<HTMLElement>('[data-card]')) {
      const was = before.get(card.dataset.card ?? '')
      if (was === undefined) continue
      for (const motion of card.getAnimations()) motion.cancel()
      const now = placeOf(card)
      if (now.column !== was.column) {
        card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: GLIDE, easing: EASE })
        continue
      }
      const dx = was.rect.left - now.rect.left
      const dy = was.rect.top - now.rect.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: GLIDE,
        easing: EASE,
      })
    }
  })
  return capture
}

/** A view that cannot be drawn, and why — its pivot gone, most often. */
export function Unavailable({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="max-w-md text-center text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
