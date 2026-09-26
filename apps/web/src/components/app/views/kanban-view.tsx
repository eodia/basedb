'use client'

import type { Row } from '@/components/app/grid/cell'
import { OptionBadge } from '@/components/app/option-badge'
import { RecordCard, coverOf } from '@/components/app/views/card'
import { Button } from '@/components/ui/button'
import { type Field, type FieldOption, type Table, api } from '@/lib/api/client'
import { quoteLiteral } from '@/lib/expression'
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
  PointerSensor,
  closestCenter,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Loader2, Plus } from 'lucide-react'
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
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
 *   remis en place si la base le refuse ;
 *   une COLONNE, prise par son en-tête, change de place — l'ordre de la vue
 *   (`spec.group_order`), jamais celui de la liste de choix, qui reste le même partout
 *   ailleurs. La colonne « Sans valeur » reste en tête : elle n'est pas un choix.
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

/**
 * A column dragged lands on the column CLOSEST to it — among the choices alone, never on
 * « Sans valeur »; a card lands on the column it is dropped over.
 */
const collision: CollisionDetection = (args) =>
  args.active.data.current?.type === 'column'
    ? closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => c.data.current?.type === 'column',
        ),
      })
    : rectIntersection(args)

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
  /** A column's cards as drawn: by hand when no sort says otherwise. */
  const drawn = useCallback(
    (key: string): readonly Row[] => {
      const rows = state[key]?.rows ?? []
      return byHand ? orderByHand(rows, pendingCards ?? spec.manual_order) : rows
    },
    [state, byHand, pendingCards, spec.manual_order],
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
    [table, filter, sort, clause],
  )

  // Keyed on the columns as LOADED, not as drawn: moving a column reads nothing again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` is what asks for the reload
  useEffect(() => {
    setState({})
    for (const column of columns) void loadColumn(column, null)
  }, [columns, loadColumn, reloadKey])

  // ── Dragging ───────────────────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [dragged, setDragged] = useState<Row | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<Column | null>(null)

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    if (event.active.data.current?.type === 'column') {
      setDraggedColumn(choices.find((c) => c.key === id) ?? null)
      return
    }
    for (const column of Object.values(state)) {
      const row = column.rows.find((r) => r._id === id)
      if (row !== undefined) setDragged(row)
    }
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

  /** A card dropped on another of its own column: it takes that card's place. */
  const reorderCard = async (column: Column, id: string, overId: string) => {
    if (onReorderCards === undefined || !byHand) return
    const ids = drawn(column.key).map((r) => r._id)
    const from = ids.indexOf(id)
    const to = ids.indexOf(overId)
    if (from === -1 || to === -1 || from === to) return
    const moved = arrayMove(ids, from, to)
    // Every column as drawn, this one as dropped: the order is the view's, whole.
    const all = columns.flatMap((c) =>
      c.key === column.key ? moved : drawn(c.key).map((r) => r._id),
    )
    const next = nextHandOrder(all, spec.manual_order)
    setPendingCards(next)
    onError(null)
    try {
      await onReorderCards(next)
    } catch (e) {
      setPendingCards(null)
      onError(messageFor(e))
    }
  }

  const moveCard = async (event: DragEndEvent) => {
    if (group === null || event.over === null) return
    const id = String(event.active.id)
    // Dropped on a card: the column that card is in; on a column: that column.
    const overCard = event.over.data.current?.type === 'card-target'
    const overKey = overCard ? String(event.over.data.current?.column) : String(event.over.id)
    const target = columns.find((c) => c.key === overKey)
    const source = columns.find((c) => state[c.key]?.rows.some((r) => r._id === id))
    if (target === undefined || source === undefined) return
    if (target.key === source.key) {
      if (overCard) await reorderCard(source, id, String(event.over.data.current?.row))
      return
    }
    const row = state[source.key]?.rows.find((r) => r._id === id)
    if (row === undefined) return

    // Shown where it was dropped, at the top, before the server answers.
    const moved = { ...row, [group.name]: target.value } as Row
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
    } catch (e) {
      onError(messageFor(e))
    } finally {
      // Either way the two columns are read again: the sort may place the card elsewhere,
      // and a refusal must not leave it where it was dropped.
      void loadColumn(source, null)
      void loadColumn(target, null)
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const column = event.active.data.current?.type === 'column'
    setDragged(null)
    setDraggedColumn(null)
    void (column ? moveColumn(event) : moveCard(event))
  }

  if (group === null) {
    return (
      <Unavailable>
        Le champ qui forme les colonnes de ce kanban n’existe plus, ou ne vous est pas ouvert.
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

  const cards = (column: Column) =>
    drawn(column.key).map((row) => (
      <DraggableCard
        key={row._id}
        id={row._id}
        column={column.key}
        disabled={!movable && !(byHand && onReorderCards !== undefined)}
      >
        <RecordCard
          row={row}
          title={title}
          fields={shown}
          cover={coverOf(row, cover)}
          selected={row._id === openedId}
          onOpen={() => onOpen(row)}
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
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragged(null)
        setDraggedColumn(null)
      }}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4 scroll-discret">
        {none !== undefined && showNone && (
          <DroppableColumn column={none}>
            {(frame) => (
              <ColumnFrame
                {...frame}
                column={none}
                state={noneState}
                onMore={(cursor) => void loadColumn(none, cursor)}
                onAdd={adder(none)}
              >
                {cards(none)}
              </ColumnFrame>
            )}
          </DroppableColumn>
        )}
        <SortableContext items={visible.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
          {visible.map((column) => (
            <SortableColumn key={column.key} column={column} disabled={!reorderable}>
              {(frame) => (
                <ColumnFrame
                  {...frame}
                  column={column}
                  state={state[column.key] ?? EMPTY}
                  onMore={(cursor) => void loadColumn(column, cursor)}
                  onAdd={adder(column)}
                >
                  {cards(column)}
                </ColumnFrame>
              )}
            </SortableColumn>
          ))}
        </SortableContext>
        {visible.length === 0 && !showNone && (
          <p className="m-auto text-sm text-muted-foreground">Aucune ligne à afficher.</p>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged !== null && (
          <RecordCard
            row={dragged}
            title={title}
            fields={shown}
            cover={coverOf(dragged, cover)}
            className="w-68 rotate-2 cursor-grabbing shadow-lg"
          />
        )}
        {draggedColumn?.option != null && (
          <div className="flex h-10 w-72 cursor-grabbing items-center gap-2 rounded-xl bg-muted px-3 shadow-lg ring-1 ring-primary/40">
            <OptionBadge option={draggedColumn.option} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** What a column wrapper hands its frame: where it is, and how its header is grabbed. */
interface Frame {
  readonly setNodeRef: (node: HTMLElement | null) => void
  readonly style?: CSSProperties
  readonly isOver: boolean
  readonly isDragging: boolean
  /** Spread on the header when the column can be moved; absent otherwise. */
  readonly handle?: Record<string, unknown>
}

/** A choice's column: dropped on by cards, and moved by its header. */
function SortableColumn({
  column,
  disabled,
  children,
}: {
  readonly column: Column
  readonly disabled: boolean
  readonly children: (frame: Frame) => ReactNode
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isOver, isDragging, active } =
    useSortable({ id: column.key, data: { type: 'column' }, disabled })
  return children({
    setNodeRef,
    style: { transform: CSS.Translate.toString(transform), transition },
    // A card over it asks for the highlight; another column passing by does not.
    isOver: isOver && active?.data.current?.type !== 'column',
    isDragging,
    handle: disabled ? undefined : { ...attributes, ...listeners },
  })
}

/** « Sans valeur »: dropped on by cards, never moved. */
function DroppableColumn({
  column,
  children,
}: {
  readonly column: Column
  readonly children: (frame: Frame) => ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key, data: { type: 'none' } })
  return children({ setNodeRef, isOver, isDragging: false })
}

function ColumnFrame({
  column,
  state,
  onMore,
  onAdd,
  setNodeRef,
  style,
  isOver,
  isDragging,
  handle,
  children,
}: Frame & {
  readonly column: Column
  readonly state: ColumnState
  readonly onMore: (cursor: string) => void
  readonly onAdd?: () => void
  readonly children: ReactNode
}) {
  const count = state.count === null ? state.rows.length : state.capped ? '100 000+' : state.count
  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 transition-colors',
        isOver && 'bg-primary/10 ring-1 ring-primary/40',
        // Its place stays marked while it travels, as an outline.
        isDragging && 'opacity-40 outline-2 outline-dashed outline-primary/50',
      )}
      aria-label={column.option?.label ?? 'Sans valeur'}
    >
      <header
        {...handle}
        // The header is the handle: grabbing anywhere on it but its buttons moves the column.
        title={handle === undefined ? undefined : 'Glisser pour déplacer la colonne'}
        className={cn(
          'flex h-10 shrink-0 items-center gap-2 rounded-t-xl px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          handle !== undefined && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {column.option === null ? (
          <span className="text-xs font-medium text-muted-foreground">Sans valeur</span>
        ) : (
          <OptionBadge option={column.option} />
        )}
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        <div className="flex-1" />
        {state.loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        {onAdd !== undefined && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7 cursor-pointer"
            onClick={onAdd}
            aria-label="Ajouter une carte dans cette colonne"
            title="Ajouter une carte"
          >
            <Plus className="size-4" />
          </Button>
        )}
      </header>
      <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scroll-discret">
        {children}
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
            Charger plus
          </Button>
        )}
      </div>
    </section>
  )
}

function DraggableCard({
  id,
  column,
  disabled,
  children,
}: {
  readonly id: string
  readonly column: string
  readonly disabled: boolean
  readonly children: ReactNode
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id,
    disabled,
    data: { type: 'card' },
  })
  // Each card is also a place to drop on: another card of its column takes its rank.
  const target = useDroppable({
    id: `card:${id}`,
    data: { type: 'card-target', column, row: id },
  })
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        target.setNodeRef(node)
      }}
      {...attributes}
      {...listeners}
      // The card itself is the button that opens the row; the wrapper only carries the drag.
      tabIndex={-1}
      role="presentation"
      className={cn(
        isDragging && 'opacity-30',
        target.isOver && !isDragging && 'rounded-lg ring-2 ring-primary/40',
      )}
    >
      {children}
    </div>
  )
}

/** A view that cannot be drawn, and why — its pivot gone, most often. */
export function Unavailable({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="max-w-md text-center text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
