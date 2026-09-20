'use client'

import { Cell, ROW_HEIGHT, type Row, isTextual, rawText } from '@/components/app/grid/cell'
import { ColumnHeader } from '@/components/app/grid/column-header'
import { cellKey, useCellSelection } from '@/components/app/grid/use-selection'
import { EnumPicker, LinkPicker, type SearchLink } from '@/components/app/pickers'
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
import type { Field, LinkOption } from '@/lib/api/client'
import { copy as copyText } from '@/lib/export'
import {
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
import { Copy, ExternalLink, Maximize2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  readonly onPatchView: (patch: Partial<ViewState>) => void
  readonly onChecked: (next: ReadonlySet<string>) => void
  readonly onCells: (next: ReadonlySet<string>) => void
  readonly onCommit: (id: string, field: Field, value: unknown) => Promise<void>
  readonly onCreate: (values: Record<string, unknown>) => Promise<void>
  readonly onDelete: (id: string) => Promise<void>
  readonly onOpenRecord: (row: Row) => void
  readonly onFilterField: (field: Field) => void
}

/** Width of the leading gutter: checkbox plus row number. */
const GUTTER_WIDTH = 64

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
  onPatchView,
  onChecked,
  onCells,
  onCommit,
  onCreate,
  onDelete,
  onOpenRecord,
  onFilterField,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
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
      onPatchView({
        hidden: [...view.hidden, name],
        pinned: view.pinned.filter((n) => n !== name),
      })
    },
    [view.hidden, view.pinned, onPatchView],
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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    // Ten rows above and below: enough that a wheel flick never shows a blank band,
    // few enough that the DOM stays small.
    overscan: 10,
  })

  const totalWidth = GUTTER_WIDTH + fields.reduce((sum, f) => sum + widthOf(f.name), 0)

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
      values[field.name] = typed
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
          Toutes les colonnes sont cachées.{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => onPatchView({ hidden: [] })}
          >
            Tout réafficher
          </button>
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scroller}
      className="scroll-discret min-h-0 flex-1 overflow-auto"
      onPointerUp={endDrag}
    >
      <div style={{ width: totalWidth, minWidth: '100%' }} className="relative">
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
              aria-label="Tout sélectionner"
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
        <div style={{ height: virtualizer.getTotalSize() }} className="relative">
          {virtualizer.getVirtualItems().map((virtual) => {
            const row = rows[virtual.index]
            if (row === undefined) return null
            const id = row._id
            const opened = openedId === id
            const ticked = checked.has(id)

            return (
              <ContextMenu key={id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      'group/row absolute inset-x-0 flex border-b transition-colors',
                      virtual.index % 2 === 1 && 'bg-surface/40',
                      ticked && 'bg-primary/5',
                      opened && 'bg-primary/10',
                      busy === id && 'opacity-50',
                      'hover:bg-muted/50',
                    )}
                    style={{ height: ROW_HEIGHT, transform: `translateY(${virtual.start}px)` }}
                  >
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-inherit px-2"
                      style={{ width: GUTTER_WIDTH }}
                    >
                      <Checkbox
                        checked={ticked}
                        onClick={(e) => {
                          e.preventDefault()
                          toggleRow(virtual.index, e.shiftKey)
                        }}
                        aria-label="Sélectionner la ligne"
                      />
                      <span className="text-[10px] tabular-nums text-muted-foreground/60">
                        {virtual.index + 1}
                      </span>
                    </div>

                    {fields.map((field, columnIndex) => {
                      const key = cellKey(virtual.index, field.name)
                      const sticky = stickyOffsets[field.name]
                      const isSelected = cells.has(key)
                      const isEditing =
                        editing?.rowIndex === virtual.index && editing.column === field.name

                      return (
                        <div
                          key={field.name}
                          data-cell={key}
                          className={cn(
                            'relative flex shrink-0 items-center overflow-hidden border border-transparent text-xs transition-colors',
                            isSelected && 'border-primary/60 bg-primary/10',
                            isEditing && 'border-primary p-0',
                            sticky !== undefined && !isSelected && 'bg-inherit',
                          )}
                          style={{
                            width: widthOf(field.name),
                            ...(sticky === undefined
                              ? {}
                              : { position: 'sticky', left: sticky, zIndex: 5 }),
                          }}
                          onMouseDown={(e) => onCellPointerDown(virtual.index, field.name, e)}
                          onMouseEnter={() => onCellPointerEnter(virtual.index, field.name)}
                        >
                          <Cell
                            row={row}
                            field={field}
                            options={linkOptions[field.name]}
                            onSearchLink={onSearchLink}
                            emphasis={columnIndex === 0}
                            editing={isEditing}
                            onStartEdit={() =>
                              editable &&
                              setEditing({ rowIndex: virtual.index, column: field.name })
                            }
                            onEndEdit={() => setEditing(null)}
                            onCommit={(value) => onCommit(id, field, value)}
                          />

                          {/* The way into the record, on the FIRST column and on hover.
                              It lives on the row rather than inside `Cell` so that it
                              appears whatever that column's type is — a link cell and a
                              boolean cell are opened the same way.

                              Hidden while the cell is being edited: the control would sit
                              on top of the caret, at the end of the text being typed. */}
                          {columnIndex === 0 && editable && !isEditing && (
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
                              aria-label="Ouvrir la fiche"
                              title="Ouvrir la fiche"
                            >
                              <Maximize2 className="size-3" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56">
                  <ContextMenuItem onSelect={() => onOpenRecord(row)}>
                    <ExternalLink className="size-4" />
                    Ouvrir la fiche
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => {
                      const text = fields.map((f) => rawText(row, f)).join('\t')
                      void copyText(text)
                    }}
                  >
                    <Copy className="size-4" />
                    Copier la ligne
                    <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                  </ContextMenuItem>
                  {editable && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => void onDelete(id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        Supprimer la ligne
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
        {editable && (
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
                className="flex shrink-0 items-center overflow-hidden border-r text-xs"
                style={{ width: widthOf(field.name) }}
              >
                <DraftCell
                  field={field}
                  options={linkOptions[field.name]}
                  onSearchLink={onSearchLink}
                  value={draft[field.name] ?? ''}
                  placeholder={index === 0 ? 'Ajouter un enregistrement' : field.label}
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
                aria-label="Enregistrer la ligne"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {rows.length === 0 && (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {view.filter === ''
                ? 'Cette table est vide.'
                : 'Aucune ligne ne satisfait ce filtre.'}
            </p>
          </div>
        )}
      </div>
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

  if (!isTextual(field)) {
    return <span className="w-full px-2 text-muted-foreground">—</span>
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
