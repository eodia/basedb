'use client'

import { DateInput } from '@/components/app/date-picker'
import type { Upload } from '@/components/app/files'
import { Cell, ROW_HEIGHT, type Row, isTextual, rawText } from '@/components/app/grid/cell'
import { ColumnHeader } from '@/components/app/grid/column-header'
import { cellKey, useCellSelection } from '@/components/app/grid/use-selection'
import { EnumPicker, LinkPicker, MultiEnumPicker, type SearchLink } from '@/components/app/pickers'
import { CardValue } from '@/components/app/views/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Hint } from '@/components/ui/tooltip'
import type { Field, LinkOption, PointerAt, RemotePointer } from '@/lib/api/client'
import { effectiveKind } from '@/lib/computed'
import { isDateKind, storedFromText } from '@/lib/dates'
import { copy as copyText } from '@/lib/export'
import { AGGREGATE_LABELS, type Aggregate, aggregatesFor, formatAggregate } from '@/lib/grid'
import { $t, intlLocale } from '@/lib/i18n'
import {
  type ColorStyle,
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MAX_SORT_TERMS,
  MIN_COLUMN_WIDTH,
  type SortTerm,
  type ViewState,
} from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Maximize2,
  Plus,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * The grid — chapter 11 §1 and §2.
 *
 * Only the visible rows are rendered, plus a fixed margin (§1.2). That is not an
 * optimisation bolted on afterwards: a page is a hundred rows and a wide table is forty
 * columns, and four thousand live DOM nodes make every column resize stutter.
 *
 * Everything the header menu offers — largeur, ordre, ancrage, masquage — is the
 * UNSAVED local overlay of §1.4. It is persisted per browser, never sent to the server,
 * and `field.position` is not modified by it. A named, shared layout would be a saved
 * view in `_basedb.view_def` and would demand `manage_schema`; it is not what this is.
 */

interface Props {
  /** The visible columns, already ordered, hidden removed, pinned first. */
  readonly fields: readonly Field[]
  readonly hiddenFields: readonly Field[]
  readonly rows: readonly Row[]
  readonly view: ViewState
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  /** Names the catalog declares sortable. Everything else has no sort affordance. */
  readonly sortableFields: ReadonlySet<string>
  readonly checked: ReadonlySet<string>
  readonly cells: ReadonlySet<string>
  readonly busy: string | null
  readonly openedId: string | null
  /** False on an expression tab, where rows are a result rather than a table. */
  readonly editable: boolean
  /** Whether the reader may add a row, remove one — the table's own actions. */
  readonly canCreate?: boolean
  /** Kept within the viewport even when the columns overflow horizontally. */
  readonly emptyState?: ReactNode
  readonly canDelete?: boolean
  readonly onPatchView: (patch: Partial<ViewState>) => void
  readonly onChecked: (next: ReadonlySet<string>) => void
  readonly onCells: (next: ReadonlySet<string>) => void
  readonly onCommit: (id: string, field: Field, value: unknown) => Promise<void>
  /** Deposits files for a `file` or `image` cell, which then commits the list. */
  readonly onUpload?: Upload
  readonly onCreate: (values: Record<string, unknown>) => Promise<void>
  readonly onDelete: (id: string) => Promise<void>
  readonly onOpenRecord: (row: Row) => void
  readonly onFilterField: (field: Field) => void
  /** Opens the row a link cell points at, in its own table. */
  readonly onFollowLink?: (table: string, id: string) => void
  /** A row's height, in pixels: taller rows wrap their text over several lines. */
  readonly rowHeight?: number
  /**
   * The field the rows are grouped by. The rows arrive SORTED by it, so each group is one
   * run of rows; a header opens each run.
   */
  readonly groupField?: Field | null
  /** Rows per group over the whole filter, by `groupKey` — the page holds only some. */
  readonly groupCounts?: ReadonlyMap<string, number> | null
  /** The summary bar's aggregate per column; absent: no bar. */
  readonly summaries?: Readonly<Record<string, string>>
  readonly summaryValues?: Readonly<Record<string, string | number | null>> | null
  /** Rows the filter keeps, all pages together. */
  readonly summaryTotal?: number | null
  readonly onSummary?: (field: string, fn: Aggregate | null) => void
  /** The colour of a row — a rule's, or its choice's — and how it shows, or `null`. */
  readonly rowColor?: (row: Row) => RowColor | null
  /** The others' pointers on this table, drawn over their cell (chapter 16 §3.4). */
  readonly pointers?: readonly RemotePointer[]
  /** This screen's pointer: the cell it is over, `null` when it leaves the rows. */
  readonly onPointer?: (at: PointerAt | null) => void
}

/** A row's colour, and how it shows: a stripe at its left, a tinted background, or both. */
export interface RowColor {
  readonly color: string
  readonly style: ColorStyle
}

/** The cell under the mouse, and where in it — `null` off the cells (the gutter, a group). */
function pointerIn(e: React.MouseEvent): PointerAt | null {
  const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-row][data-field]')
  const record = cell?.dataset.row
  const field = cell?.dataset.field
  if (cell === null || record === undefined || field === undefined) return null
  const box = cell.getBoundingClientRect()
  return {
    record,
    field,
    x: (e.clientX - box.left) / box.width,
    y: (e.clientY - box.top) / box.height,
  }
}

/** One colour per person, the same on every screen. */
const POINTER_COLORS = ['#7c3aed', '#2563eb', '#db2777', '#ea580c', '#0891b2', '#16a34a', '#c026d3']
function pointerColor(user: string): string {
  let hash = 0
  for (const char of user) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return POINTER_COLORS[hash % POINTER_COLORS.length] ?? '#7c3aed'
}

/**
 * The others' pointers, each over the cell it names — found again in this screen's own
 * layout on every frame, so that scrolling, a pinned column or a row that just rendered
 * keep them in place. Positioned straight in the DOM: a pointer moving is not a render.
 * Off the rows this screen shows, a pointer is hidden.
 */
function RemotePointers({
  pointers,
  host,
}: {
  readonly pointers: readonly RemotePointer[]
  readonly host: React.RefObject<HTMLDivElement | null>
}) {
  const marks = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    let frame = 0
    const place = () => {
      const root = host.current
      if (root !== null) {
        const origin = root.getBoundingClientRect()
        for (const pointer of pointers) {
          const mark = marks.current.get(pointer.session)
          if (mark === undefined) continue
          const { record, field, x, y } = pointer.at
          const cell = root.querySelector<HTMLElement>(
            `[data-row="${CSS.escape(record)}"][data-field="${CSS.escape(field)}"]`,
          )
          if (cell === null) {
            mark.style.opacity = '0'
            continue
          }
          const box = cell.getBoundingClientRect()
          mark.style.opacity = '1'
          mark.style.transform = `translate(${box.left - origin.left + x * box.width}px, ${box.top - origin.top + y * box.height}px)`
        }
      }
      frame = requestAnimationFrame(place)
    }
    frame = requestAnimationFrame(place)
    return () => cancelAnimationFrame(frame)
  }, [pointers, host])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {pointers.map((pointer) => {
        const color = pointerColor(pointer.user)
        return (
          <div
            key={pointer.session}
            ref={(mark) => {
              if (mark === null) marks.current.delete(pointer.session)
              else marks.current.set(pointer.session, mark)
            }}
            className="absolute top-0 left-0 flex items-start opacity-0 transition-[transform,opacity] duration-100 ease-linear"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              className="drop-shadow-sm"
              aria-hidden="true"
            >
              <path
                d="M4 2l16 9.5-7 1.6-3.6 6.9z"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="mt-3 -ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {pointer.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** A row's value for grouping, as a key: `∅` for no value, a link by its identifier. */
export function groupKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return '∅'
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return String((value as { id: unknown }).id ?? '∅')
  }
  return String(value)
}

type Item =
  | {
      readonly type: 'group'
      readonly key: string
      readonly first: number
      readonly loaded: number
    }
  | { readonly type: 'row'; readonly index: number }

const GROUP_HEIGHT = 34

/** Lines of text a row shows at its height. */
const linesAt = (height: number) => (height >= 132 ? 6 : height >= 92 ? 4 : height >= 56 ? 2 : 1)

/** Width of the leading gutter: checkbox plus row number. */
const GUTTER_WIDTH = 64

/**
 * The background of what stays in place while the row scrolls sideways — the gutter and
 * the pinned columns.
 *
 * The row's own tints are translucent (a stripe, a tick, the open record, the hover), and
 * a sticky cell that inherited one would let the columns scrolling UNDER it show through.
 * So these paint the same tint made opaque — mixed into the page's background —, chosen
 * here in the same order the row's classes resolve in: open, then ticked, then striped.
 */
function stickyBackground(odd: boolean, ticked: boolean, opened: boolean): string {
  const base = opened
    ? 'bg-[color:color-mix(in_oklab,var(--primary)_10%,var(--background))]'
    : ticked
      ? 'bg-[color:color-mix(in_oklab,var(--primary)_5%,var(--background))]'
      : odd
        ? 'bg-[color:color-mix(in_oklab,var(--surface)_40%,var(--background))]'
        : 'bg-background'
  // The row's hover wins over its other tints, as `hover:` does on the row itself.
  return `${base} group-hover/row:bg-[color:color-mix(in_oklab,var(--muted)_50%,var(--background))]`
}

/** A selected pinned cell: the selection's tint, opaque. */
const STICKY_SELECTED = 'bg-[color:color-mix(in_oklab,var(--primary)_10%,var(--background))]'

export function DataGrid({
  fields,
  hiddenFields,
  rows,
  view,
  linkOptions,
  onSearchLink,
  sortableFields,
  checked,
  cells,
  busy,
  openedId,
  editable,
  canCreate = editable,
  emptyState,
  canDelete = editable,
  onPatchView,
  onChecked,
  onCells,
  onCommit,
  onUpload,
  onCreate,
  onDelete,
  onOpenRecord,
  onFilterField,
  onFollowLink,
  rowHeight = ROW_HEIGHT,
  groupField = null,
  groupCounts = null,
  summaries,
  summaryValues = null,
  summaryTotal = null,
  onSummary,
  rowColor,
  pointers = [],
  onPointer,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState<{ rowIndex: number; column: string } | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)

  const columnNames = useMemo(() => fields.map((f) => f.name), [fields])
  const widthOf = useCallback(
    (name: string) => view.columnWidths[name] ?? DEFAULT_COLUMN_WIDTH,
    [view.columnWidths],
  )

  // ── The overlay's four verbs ─────────────────────────────────────────────────

  /**
   * The current view, reachable from a closure that outlives the render.
   *
   * A drag registers its listener once and then runs for hundreds of frames. Reading
   * `view.columnWidths` from the closure would read the map as it was when the pointer
   * went down, for the whole drag.
   */
  const viewRef = useRef(view)
  viewRef.current = view

  /** The width the column had when the drag started, against which the travel applies. */
  const resizeOrigin = useRef<{ name: string; from: number } | null>(null)

  const beginResize = useCallback((name: string) => {
    resizeOrigin.current = {
      name,
      from: viewRef.current.columnWidths[name] ?? DEFAULT_COLUMN_WIDTH,
    }
  }, [])

  const resize = useCallback(
    (name: string, delta: number) => {
      // `delta` is the travel since the pointer went down, so it applies to the width the
      // column had THEN. Applying it to the current width would compound it and the
      // column would run away under the pointer.
      const origin = resizeOrigin.current
      const from =
        origin?.name === name
          ? origin.from
          : (viewRef.current.columnWidths[name] ?? DEFAULT_COLUMN_WIDTH)
      const next = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, from + delta))
      onPatchView({ columnWidths: { ...viewRef.current.columnWidths, [name]: next } })
    },
    [onPatchView],
  )

  /**
   * Widens a column to its widest VISIBLE value.
   *
   * Measured on a canvas rather than by laying the values out in the DOM: the loaded
   * page is a hundred rows, and rendering a hundred hidden spans to read their width
   * back would force a reflow per column.
   *
   * "Visible" is load-bearing — the column fits the page that is loaded, not the table,
   * which nothing here has read.
   */
  const fitWidth = useCallback(
    (field: Field) => {
      const context = document.createElement('canvas').getContext('2d')
      if (context === null) return
      context.font = '12px ui-sans-serif, system-ui, sans-serif'
      // The header carries an icon, a grip and possibly a sort arrow: about 64 pixels
      // of furniture that the label alone does not account for.
      let widest = context.measureText(field.label).width + 64
      for (const row of rows) {
        widest = Math.max(widest, context.measureText(rawText(row, field)).width + 24)
      }
      const next = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.ceil(widest)))
      onPatchView({ columnWidths: { ...view.columnWidths, [field.name]: next } })
    },
    [rows, view.columnWidths, onPatchView],
  )

  const togglePin = useCallback(
    (name: string) => {
      onPatchView({
        pinned: view.pinned.includes(name)
          ? view.pinned.filter((n) => n !== name)
          : [...view.pinned, name],
      })
    },
    [view.pinned, onPatchView],
  )

  const hide = useCallback(
    (name: string) => {
      // Hiding also unpins: a pinned column that is not displayed still reserves its
      // sticky offset, and the columns after it would sit under a gap.
      // A system column is shown on request: hiding it withdraws the request.
      const system = fields.find((f) => f.name === name)?.system === true
      onPatchView({
        ...(system
          ? { systemColumns: view.systemColumns.filter((n) => n !== name) }
          : { hidden: [...view.hidden, name] }),
        pinned: view.pinned.filter((n) => n !== name),
      })
    },
    [fields, view.hidden, view.systemColumns, view.pinned, onPatchView],
  )

  /**
   * Cycles a column's sort: ascendant, descendant, aucun.
   *
   * Shift adds a term instead of replacing, up to the three chapter 11 §1.3 allows. The
   * tie-break on `_id` is added by the server and is not shown.
   */
  const toggleSort = useCallback(
    (name: string, additive: boolean) => {
      const current = view.sorts.find((s) => s.field === name)
      const others = additive ? view.sorts.filter((s) => s.field !== name) : []

      let next: readonly SortTerm[]
      if (current === undefined) next = [...others, { field: name, direction: 'asc' }]
      else if (current.direction === 'asc') next = [...others, { field: name, direction: 'desc' }]
      else next = others

      onPatchView({ sorts: next.slice(0, MAX_SORT_TERMS), cursors: [] })
    },
    [view.sorts, onPatchView],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      if (over === null || active.id === over.id) return
      const current = view.columnOrder ?? columnNames
      const from = current.indexOf(String(active.id))
      const to = current.indexOf(String(over.id))
      if (from === -1 || to === -1) return
      const next = [...current]
      const [moved] = next.splice(from, 1)
      if (moved === undefined) return
      next.splice(to, 0, moved)
      onPatchView({ columnOrder: next })
    },
    [view.columnOrder, columnNames, onPatchView],
  )

  // ── Selection ────────────────────────────────────────────────────────────────

  const copySelection = useCallback(() => {
    const entries = [...cells].map((key) => {
      const cut = key.indexOf(':')
      return { rowIndex: Number.parseInt(key.slice(0, cut), 10), column: key.slice(cut + 1) }
    })
    const rowIndexes = [...new Set(entries.map((c) => c.rowIndex))].sort((a, b) => a - b)
    const chosen = new Set(entries.map((c) => c.column))
    const columns = fields.filter((f) => chosen.has(f.name))
    // Laid out as a GRID, not as a list of values: a rectangle copied from here is
    // pasted into a spreadsheet, and the shape is the point.
    const text = rowIndexes
      .map((r) => {
        const row = rows[r]
        return columns
          .map((f) => (row === undefined || !cells.has(cellKey(r, f.name)) ? '' : rawText(row, f)))
          .join('\t')
      })
      .join('\n')
    void copyText(text)
  }, [cells, fields, rows])

  const { onCellPointerDown, onCellPointerEnter, endDrag, clear } = useCellSelection({
    rowCount: rows.length,
    columns: columnNames,
    selected: cells,
    setSelected: onCells,
    pageJump: view.pageSize,
    editing: editing !== null,
    onCopy: copySelection,
  })

  // Rows changed under the selection — a reload, a page turn, a new sort. Keeping the
  // old coordinates would leave a rectangle over rows nobody chose.
  const previousRows = useRef(rows)
  useEffect(() => {
    if (previousRows.current === rows) return
    previousRows.current = rows
    clear()
    setEditing(null)
  }, [rows, clear])

  const allChecked = rows.length > 0 && checked.size === rows.length
  const toggleAll = useCallback(() => {
    onChecked(allChecked ? new Set() : new Set(rows.map((r) => r._id)))
  }, [allChecked, rows, onChecked])

  /** The row checkbox, with Shift extending from the last one ticked. */
  const lastTicked = useRef<number | null>(null)
  const toggleRow = useCallback(
    (index: number, shift: boolean) => {
      const row = rows[index]
      if (row === undefined) return
      const next = new Set(checked)

      if (shift && lastTicked.current !== null) {
        const [from, to] = [lastTicked.current, index].sort((a, b) => a - b)
        // The range takes the state the CLICKED row is about to receive, which is what
        // makes Shift+clic able to unselect a block as well as select one.
        const adding = !next.has(row._id)
        for (let i = from; i <= to; i++) {
          const target = rows[i]
          if (target === undefined) continue
          if (adding) next.add(target._id)
          else next.delete(target._id)
        }
      } else if (next.has(row._id)) {
        next.delete(row._id)
      } else {
        next.add(row._id)
      }

      lastTicked.current = index
      onChecked(next)
    },
    [rows, checked, onChecked],
  )

  // ── Virtualisation ───────────────────────────────────────────────────────────

  // Groups folded by a click on their header. Local and transient: which groups one looks
  // at is not a setting of the view.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const groupName = groupField?.name ?? null
  // biome-ignore lint/correctness/useExhaustiveDependencies: unfolded whenever the grouping changes
  useEffect(() => setCollapsed(new Set()), [groupName])

  /** What the list draws, in order: a header per group, and the rows of unfolded groups. */
  const items = useMemo<readonly Item[]>(() => {
    if (groupField === null) return rows.map((_, index) => ({ type: 'row' as const, index }))
    const out: Item[] = []
    let current: string | null = null
    let header: { key: string; first: number; loaded: number } | null = null
    const flush = () => {
      if (header !== null) out.push({ type: 'group', ...header })
    }
    const pending: Item[] = []
    rows.forEach((row, index) => {
      const key = groupKey(row[groupField.name])
      if (key !== current) {
        flush()
        out.push(...pending)
        pending.length = 0
        current = key
        header = { key, first: index, loaded: 0 }
      }
      if (header !== null) header.loaded++
      if (!collapsed.has(key)) pending.push({ type: 'row', index })
    })
    flush()
    out.push(...pending)
    return out
  }, [rows, groupField, collapsed])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: (i) => (items[i]?.type === 'group' ? GROUP_HEIGHT : rowHeight),
    // Ten rows above and below: enough that a wheel flick never shows a blank band,
    // few enough that the DOM stays small.
    overscan: 10,
  })

  // Heights are estimated, never measured: they change with the setting and the groups.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measured when what sizes the items changes
  useEffect(() => virtualizer.measure(), [rowHeight, items])

  const totalWidth = GUTTER_WIDTH + fields.reduce((sum, f) => sum + widthOf(f.name), 0)
  const lines = linesAt(rowHeight)

  /** Sticky offsets, accumulated in display order. */
  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    let left = GUTTER_WIDTH
    for (const field of fields) {
      if (!view.pinned.includes(field.name)) continue
      offsets[field.name] = left
      left += widthOf(field.name)
    }
    return offsets
  }, [fields, view.pinned, widthOf])

  const submitDraft = useCallback(async () => {
    const values: Record<string, unknown> = {}
    for (const field of fields) {
      const typed = draft[field.name]
      if (typed === undefined || typed === '') continue
      // A date is typed day first; the API takes it in its own form. A multiple choice
      // waits in the draft as its JSON list, the draft holding text only.
      values[field.name] = isDateKind(field.kind)
        ? storedFromText(typed, field.kind)
        : field.kind === 'multi_select'
          ? JSON.parse(typed)
          : typed
    }
    if (Object.keys(values).length === 0) return
    setAdding(true)
    try {
      await onCreate(values)
      setDraft({})
    } finally {
      setAdding(false)
    }
  }, [draft, fields, onCreate])

  if (fields.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          {$t('Toutes les colonnes sont cachées.')}{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => onPatchView({ hidden: [] })}
          >
            {$t('Tout réafficher')}
          </button>
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scroller}
      className="scroll-discret flex min-h-0 flex-1 flex-col overflow-auto"
      onPointerUp={endDrag}
    >
      <div style={{ width: totalWidth, minWidth: '100%' }} className="relative shrink-0">
        {/* Header ─────────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 flex border-b bg-background">
          <div
            className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-background px-2"
            style={{ width: GUTTER_WIDTH }}
          >
            <Checkbox
              checked={allChecked}
              onCheckedChange={toggleAll}
              disabled={rows.length === 0}
              aria-label={$t('Tout sélectionner')}
            />
            <span className="text-[10px] text-muted-foreground">#</span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={columnNames} strategy={horizontalListSortingStrategy}>
              {fields.map((field) => (
                <ColumnHeader
                  key={field.name}
                  field={field}
                  width={widthOf(field.name)}
                  sorts={view.sorts}
                  sortable={sortableFields.has(field.name)}
                  pinned={view.pinned.includes(field.name)}
                  stickyLeft={stickyOffsets[field.name] ?? null}
                  hiddenCount={hiddenFields.length}
                  onSort={(additive) => toggleSort(field.name, additive)}
                  onResizeStart={() => beginResize(field.name)}
                  onResize={(delta) => resize(field.name, delta)}
                  onPin={() => togglePin(field.name)}
                  onHide={() => hide(field.name)}
                  onFitWidth={() => fitWidth(field)}
                  onShowHidden={() => onPatchView({ hidden: [] })}
                  onFilter={() => onFilterField(field)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Body ───────────────────────────────────────────────────────────── */}
        <div
          ref={body}
          style={{ height: virtualizer.getTotalSize() }}
          className="relative"
          onMouseMove={onPointer === undefined ? undefined : (e) => onPointer(pointerIn(e))}
          onMouseLeave={onPointer === undefined ? undefined : () => onPointer(null)}
        >
          {pointers.length > 0 && <RemotePointers pointers={pointers} host={body} />}
          {virtualizer.getVirtualItems().map((virtual) => {
            const item = items[virtual.index]
            if (item === undefined) return null
            if (item.type === 'group') {
              const first = rows[item.first]
              if (first === undefined || groupField === null) return null
              const folded = collapsed.has(item.key)
              const count = groupCounts?.get(item.key) ?? item.loaded
              return (
                <div
                  // With the first row's index: rows not yet read in the group's order — the
                  // grouping has just changed — make runs of the same value, briefly.
                  key={`group:${item.key}:${item.first}`}
                  className="absolute inset-x-0 flex items-center border-b bg-muted/60"
                  style={{ height: GROUP_HEIGHT, transform: `translateY(${virtual.start}px)` }}
                >
                  <Hint label={folded ? $t('Déplier le groupe') : $t('Replier le groupe')}>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((current) => {
                          const next = new Set(current)
                          if (next.has(item.key)) next.delete(item.key)
                          else next.add(item.key)
                          return next
                        })
                      }
                      className="sticky left-0 flex h-full max-w-[min(100%,36rem)] items-center gap-2 px-2 text-left text-xs"
                      aria-expanded={!folded}
                    >
                      {folded ? (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="shrink-0 text-muted-foreground">{groupField.label}</span>
                      <span className="flex min-w-0 items-center">
                        {item.key === '∅' ? (
                          <span className="text-muted-foreground">{$t('Sans valeur')}</span>
                        ) : (
                          <CardValue field={groupField} row={first} />
                        )}
                      </span>
                      <span className="shrink-0 rounded-full bg-background px-1.5 tabular-nums text-muted-foreground">
                        {count.toLocaleString(intlLocale())}
                      </span>
                    </button>
                  </Hint>
                </div>
              )
            }
            const rowIndex = item.index
            const row = rows[rowIndex]
            if (row === undefined) return null
            const colored = rowColor?.(row) ?? null
            // The row's colour as what colours it asks: a tint under the whole row, a stripe
            // at its left, or both. The opaque cells — the gutter, the pinned columns — take
            // the tint as a layer over their own background, or they would stay blank.
            const tint =
              colored !== null && colored.style !== 'stripe'
                ? `color-mix(in srgb, ${colored.color} 12%, transparent)`
                : null
            const stripe = colored !== null && colored.style !== 'background' ? colored.color : null
            const tintLayer = tint === null ? undefined : `linear-gradient(${tint}, ${tint})`
            const id = row._id
            const opened = openedId === id
            const ticked = checked.has(id)
            const pinnedBackground = stickyBackground(rowIndex % 2 === 1, ticked, opened)

            return (
              <ContextMenu key={id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      'group/row absolute inset-x-0 flex border-b transition-colors',
                      rowIndex % 2 === 1 && 'bg-surface/40',
                      ticked && 'bg-primary/5',
                      opened && 'bg-primary/10',
                      busy === id && 'opacity-50',
                      'hover:bg-muted/50',
                    )}
                    style={{
                      height: rowHeight,
                      transform: `translateY(${virtual.start}px)`,
                      ...(tint === null ? {} : { backgroundColor: tint }),
                    }}
                  >
                    <div
                      className={cn(
                        'sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r px-2 transition-colors',
                        lines > 1 && 'items-start pt-2.5',
                        pinnedBackground,
                      )}
                      style={{ width: GUTTER_WIDTH, backgroundImage: tintLayer }}
                    >
                      {stripe !== null && (
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-1"
                          style={{ backgroundColor: stripe }}
                        />
                      )}
                      <Checkbox
                        checked={ticked}
                        onClick={(e) => {
                          e.preventDefault()
                          toggleRow(rowIndex, e.shiftKey)
                        }}
                        aria-label={$t('Sélectionner la ligne')}
                      />
                      <span className="text-[10px] tabular-nums text-muted-foreground/60">
                        {rowIndex + 1}
                      </span>
                    </div>

                    {fields.map((field, columnIndex) => {
                      const key = cellKey(rowIndex, field.name)
                      const sticky = stickyOffsets[field.name]
                      const isSelected = cells.has(key)
                      const isEditing =
                        editing?.rowIndex === rowIndex && editing.column === field.name

                      return (
                        <div
                          key={field.name}
                          data-cell={key}
                          // Where a pointer is, for the others: this row, this column.
                          data-row={id}
                          data-field={field.name}
                          className={cn(
                            'relative flex shrink-0 items-center overflow-hidden border border-transparent text-xs transition-colors',
                            lines > 1 &&
                              'items-start py-2 [&_.truncate]:whitespace-normal [&_.truncate]:break-words',
                            lines === 2 && '[&_.truncate]:line-clamp-2',
                            lines === 4 && '[&_.truncate]:line-clamp-4',
                            lines === 6 && '[&_.truncate]:line-clamp-6',
                            isSelected &&
                              (sticky === undefined
                                ? 'border-primary/60 bg-primary/10'
                                : `border-primary/60 ${STICKY_SELECTED}`),
                            isEditing && 'border-primary p-0',
                            sticky !== undefined && !isSelected && pinnedBackground,
                          )}
                          style={{
                            width: widthOf(field.name),
                            ...(sticky === undefined
                              ? {}
                              : {
                                  position: 'sticky',
                                  left: sticky,
                                  zIndex: 5,
                                  backgroundImage: tintLayer,
                                }),
                          }}
                          onMouseDown={(e) => onCellPointerDown(rowIndex, field.name, e)}
                          onMouseEnter={() => onCellPointerEnter(rowIndex, field.name)}
                        >
                          <Cell
                            row={row}
                            field={field}
                            options={linkOptions[field.name]}
                            onSearchLink={onSearchLink}
                            emphasis={columnIndex === 0}
                            editing={isEditing}
                            onStartEdit={() =>
                              editable && setEditing({ rowIndex: rowIndex, column: field.name })
                            }
                            onEndEdit={() => setEditing(null)}
                            onCommit={(value) => onCommit(id, field, value)}
                            onUpload={editable ? onUpload : undefined}
                            onFollowLink={onFollowLink}
                          />

                          {/* The way into the record, on the FIRST column and on hover.
                              It lives on the row rather than inside `Cell` so that it
                              appears whatever that column's type is — a link cell and a
                              boolean cell are opened the same way.

                              Hidden while the cell is being edited: the control would sit
                              on top of the caret, at the end of the text being typed. */}
                          {columnIndex === 0 && editable && !isEditing && (
                            <Hint label={$t('Ouvrir la fiche')}>
                              <button
                                type="button"
                                // The grid starts a selection on mousedown; this one is a
                                // button, not a cell, and must not drag a rectangle out.
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpenRecord(row)
                                }}
                                className="absolute right-1 hidden size-6 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground group-hover/row:flex"
                                aria-label={$t('Ouvrir la fiche')}
                              >
                                <Maximize2 className="size-3" />
                              </button>
                            </Hint>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56">
                  <ContextMenuItem onSelect={() => onOpenRecord(row)}>
                    <ExternalLink className="size-4" />
                    {$t('Ouvrir la fiche')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => {
                      const text = fields.map((f) => rawText(row, f)).join('\t')
                      void copyText(text)
                    }}
                  >
                    <Copy className="size-4" />
                    {$t('Copier la ligne')}
                    <ContextMenuShortcut>{$t('Ctrl+C')}</ContextMenuShortcut>
                  </ContextMenuItem>
                  {editable && canDelete && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => void onDelete(id)} variant="destructive">
                        <Trash2 className="size-4" />
                        {$t('Supprimer la ligne')}
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>

        {/* The new row lives IN the grid, not behind a dialog: adding a line is the most
            frequent act there is, and a dialog would put a click in front of it. */}
        {editable && canCreate && (
          <div className="flex border-b bg-background" style={{ height: ROW_HEIGHT }}>
            <div
              className="sticky left-0 z-10 flex shrink-0 items-center justify-center border-r bg-background"
              style={{ width: GUTTER_WIDTH }}
            >
              <Plus className="size-3.5 text-muted-foreground" />
            </div>
            {fields.map((field, index) => (
              <div
                key={field.name}
                className={cn(
                  'flex shrink-0 items-center overflow-hidden border-r text-xs',
                  // A pinned column stays pinned here too, painted like the rows above.
                  stickyOffsets[field.name] !== undefined && 'bg-background',
                )}
                style={{
                  width: widthOf(field.name),
                  ...(stickyOffsets[field.name] === undefined
                    ? {}
                    : { position: 'sticky', left: stickyOffsets[field.name], zIndex: 5 }),
                }}
              >
                <DraftCell
                  field={field}
                  options={linkOptions[field.name]}
                  onSearchLink={onSearchLink}
                  value={draft[field.name] ?? ''}
                  placeholder={index === 0 ? $t('Ajouter un enregistrement') : field.label}
                  onChange={(value) => setDraft({ ...draft, [field.name]: value })}
                  onSubmit={() => void submitDraft()}
                />
              </div>
            ))}
            <div className="flex items-center px-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void submitDraft()}
                disabled={adding}
                aria-label={$t('Enregistrer la ligne')}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {summaries !== undefined && onSummary !== undefined && (
          <div className="sticky bottom-0 z-20 flex border-t bg-background">
            <Hint label={$t('Lignes que garde le filtre, toutes pages confondues')}>
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-background px-2 text-[10px] tabular-nums text-muted-foreground"
                style={{ width: GUTTER_WIDTH }}
              >
                {summaryTotal === null ? '' : summaryTotal.toLocaleString(intlLocale())}
              </div>
            </Hint>
            {fields.map((field) => (
              <SummaryCell
                key={field.name}
                field={field}
                width={widthOf(field.name)}
                sticky={stickyOffsets[field.name] ?? null}
                fn={(summaries[field.name] as Aggregate | undefined) ?? null}
                value={summaryValues?.[`${field.name}:${summaries[field.name]}`] ?? null}
                onChange={(fn) => onSummary(field.name, fn)}
              />
            ))}
          </div>
        )}
      </div>
      {rows.length === 0 && (
        <div className="sticky left-0 flex w-full flex-1 flex-col">
          {emptyState !== undefined ? (
            emptyState
          ) : (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {view.filter === ''
                  ? $t('Cette table est vide.')
                  : $t('Aucune ligne ne satisfait ce filtre.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One column of the summary bar: its aggregate over every row the filter keeps, or, on
 * hover, the way to choose one. A column with none shows nothing: a bar of dashes would
 * be read as sixty zeros.
 */
function SummaryCell({
  field,
  width,
  sticky,
  fn,
  value,
  onChange,
}: {
  readonly field: Field
  readonly width: number
  readonly sticky: number | null
  readonly fn: Aggregate | null
  readonly value: string | number | null
  readonly onChange: (fn: Aggregate | null) => void
}) {
  const offered = aggregatesFor(effectiveKind(field))
  return (
    <div
      className={cn(
        'group/sum flex h-8 shrink-0 items-center border-r',
        sticky !== null && 'bg-background',
      )}
      style={{ width, ...(sticky === null ? {} : { position: 'sticky', left: sticky, zIndex: 5 }) }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex size-full min-w-0 items-center justify-end gap-1.5 px-2 text-xs hover:bg-muted/60',
              fn === null && 'opacity-0 group-hover/sum:opacity-100 focus-visible:opacity-100',
            )}
            aria-label={$t('Résumé de {label}', { label: field.label })}
          >
            {fn === null ? (
              <span className="text-muted-foreground">{$t('Résumé')}</span>
            ) : (
              <>
                <span className="truncate text-muted-foreground">{AGGREGATE_LABELS[fn]}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatAggregate(value, fn, field)}
                </span>
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {field.label}
          </DropdownMenuLabel>
          {offered.map((option) => (
            <DropdownMenuItem key={option} onSelect={() => onChange(option)}>
              {AGGREGATE_LABELS[option]}
            </DropdownMenuItem>
          ))}
          {fn !== null && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChange(null)}>{$t('Aucun')}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function DraftCell({
  field,
  options,
  onSearchLink,
  value,
  placeholder,
  onChange,
  onSubmit,
}: {
  readonly field: Field
  readonly options?: readonly LinkOption[]
  readonly onSearchLink: SearchLink
  readonly value: string
  readonly placeholder: string
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
}) {
  // The draft holds text only, and `''` means "not filled in": a cleared picker is that.
  if (field.kind === 'link' && options !== undefined) {
    return (
      <span className="flex w-full items-center px-1">
        <LinkPicker
          field={field}
          value={value === '' ? null : value}
          options={options}
          onSearch={onSearchLink}
          onChange={(next) => onChange(next ?? '')}
          appearance="cell"
          placeholder={field.label}
        />
      </span>
    )
  }

  if (field.kind === 'select' && field.options !== undefined) {
    return (
      <span className="flex w-full items-center px-1">
        <EnumPicker
          field={field}
          value={value === '' ? null : value}
          onChange={(next) => onChange(next ?? '')}
          appearance="cell"
          placeholder={field.label}
        />
      </span>
    )
  }

  if (field.kind === 'multi_select' && field.options !== undefined) {
    return (
      <span className="flex w-full min-w-0 items-center px-1">
        <MultiEnumPicker
          field={field}
          value={value === '' ? [] : (JSON.parse(value) as string[])}
          onChange={(next) => onChange(next === null ? '' : JSON.stringify(next))}
          appearance="cell"
          placeholder={field.label}
        />
      </span>
    )
  }

  if (!isTextual(field)) {
    return <span className="w-full px-2 text-muted-foreground">—</span>
  }

  if (isDateKind(field.kind)) {
    return (
      <DateInput
        kind={field.kind}
        text={value}
        onTextChange={onChange}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') onSubmit()
        }}
        appearance="cell"
        clearable
        placeholder={placeholder}
        className="focus:bg-background"
        aria-label={field.label}
      />
    )
  }

  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onSubmit()
      }}
      className="size-full bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground focus:bg-background"
      aria-label={field.label}
    />
  )
}
