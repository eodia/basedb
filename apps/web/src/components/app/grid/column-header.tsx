'use client'

import { hasDescription } from '@/components/app/description'
import { FieldIcon } from '@/components/app/field-icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Field } from '@/lib/api/client'
import type { SortTerm } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  MoveHorizontal,
  Pin,
  PinOff,
} from 'lucide-react'
import { useCallback, useRef } from 'react'

/**
 * A column header — chapter 11 §1.3 and §1.4.
 *
 * It carries the four verbs a column has: trier, épingler, cacher, adapter la largeur.
 * Only sorting reaches the server; the other three are the unsaved local overlay §1.4
 * allows, persisted by browser and never sent.
 *
 * A field the catalog marks non-sortable has NO sort affordance at all — §1.3 is
 * explicit that the interface never offers an operator the catalog does not declare,
 * and a disabled control that never becomes enabled is a lie told politely.
 */

interface Props {
  readonly field: Field
  readonly width: number
  readonly sorts: readonly SortTerm[]
  readonly sortable: boolean
  readonly pinned: boolean
  readonly stickyLeft: number | null
  readonly hiddenCount: number
  readonly onSort: (additive: boolean) => void
  readonly onResizeStart: () => void
  readonly onResize: (delta: number) => void
  readonly onPin: () => void
  readonly onHide: () => void
  readonly onFitWidth: () => void
  readonly onShowHidden: () => void
  readonly onFilter: () => void
}

export function ColumnHeader({
  field,
  width,
  sorts,
  sortable,
  pinned,
  stickyLeft,
  hiddenCount,
  onSort,
  onResizeStart,
  onResize,
  onPin,
  onHide,
  onFitWidth,
  onShowHidden,
  onFilter,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.name,
  })

  const rank = sorts.findIndex((s) => s.field === field.name)
  const term = rank === -1 ? null : sorts[rank]

  const hint = sortable
    ? 'Trier — Maj+clic pour ajouter au tri en cours'
    : 'Ce champ n’est pas triable au catalogue.'

  // The same node with or without a description: only a wrapper and a tooltip come and go,
  // so a column that has none is laid out exactly as before.
  const label = (
    // The wrapper, not the button, carries the hover: a disabled button raises no pointer
    // events, and a column that cannot be sorted would never show its description. It also
    // holds the native hint of a column WITHOUT a description; a described one shows the
    // hint inside its tooltip instead, rather than two tooltips at once.
    <div
      className="flex min-w-0 flex-1"
      title={hasDescription(field.description) ? undefined : hint}
    >
      <button
        type="button"
        onClick={(e) => {
          if (sortable) onSort(e.shiftKey)
        }}
        disabled={!sortable}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:pointer-events-none"
      >
        {pinned && <Pin className="size-2.5 shrink-0 text-primary" />}
        <FieldIcon kind={field.kind} />
        <span className="truncate text-xs font-medium">{field.label}</span>
        {term === null ? (
          sortable && <ArrowUpDown className="ml-auto size-3 shrink-0 text-muted-foreground/25" />
        ) : (
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {term.direction === 'asc' ? (
              <ArrowUp className="size-3 text-primary" />
            ) : (
              <ArrowDown className="size-3 text-primary" />
            )}
            {/* The rank is shown only when there IS a second term to rank against. */}
            {sorts.length > 1 && (
              <span className="text-[9px] font-bold tabular-nums text-primary">{rank + 1}</span>
            )}
          </span>
        )}
      </button>
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{
            width,
            // The vertical component is dropped and the scale pinned to 1: a header
            // dragged sideways must not lift off the row or grow under the pointer.
            transform: CSS.Transform.toString(
              transform === null ? null : { ...transform, y: 0, scaleX: 1, scaleY: 1 },
            ),
            transition,
            opacity: isDragging ? 0.4 : 1,
            position: stickyLeft === null ? undefined : 'sticky',
            left: stickyLeft ?? undefined,
            zIndex: isDragging ? 30 : stickyLeft === null ? undefined : 21,
          }}
          className={cn(
            'relative flex h-9 shrink-0 select-none items-center gap-0.5 border-r bg-background pr-0.5',
            stickyLeft !== null && 'border-r-primary/25',
          )}
        >
          <span
            {...attributes}
            {...listeners}
            className="flex w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/25 transition-colors hover:text-muted-foreground active:cursor-grabbing"
            aria-label={`Déplacer la colonne ${field.label}`}
          >
            <GripVertical className="size-3" />
          </span>

          {hasDescription(field.description) ? (
            <Tooltip>
              <TooltipTrigger asChild>{label}</TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-xs">
                <p className="whitespace-pre-line break-words">{field.description}</p>
                <p className="mt-1.5 text-background/60">{hint}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            label
          )}

          <ResizeHandle onResizeStart={onResizeStart} onResize={onResize} onFit={onFitWidth} />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-60">
        <ContextMenuLabel className="truncate">
          {field.label} <span className="font-mono opacity-60">{field.name}</span>
        </ContextMenuLabel>
        <ContextMenuSeparator />

        <ContextMenuItem onSelect={onFilter}>
          <Filter className="size-4" />
          Filtrer sur ce champ
        </ContextMenuItem>
        <ContextMenuItem onSelect={onPin}>
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          {pinned ? 'Détacher la colonne' : 'Ancrer la colonne'}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={onFitWidth}>
          <MoveHorizontal className="size-4" />
          Adapter la taille
          <ContextMenuShortcut>Double-clic</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onHide}>
          <EyeOff className="size-4" />
          Cacher la colonne
        </ContextMenuItem>
        {hiddenCount > 0 && (
          <ContextMenuItem onSelect={onShowHidden}>
            <Eye className="size-4" />
            Tout réafficher ({hiddenCount})
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * The drag strip on a column's right edge.
 *
 * Pointer events with capture, not mouse events: capture is what keeps the drag alive
 * when the pointer leaves the strip — which it does immediately, since the column is
 * growing out from under it — and what makes the gesture work with a stylus and a touch
 * screen without a second code path.
 */
function ResizeHandle({
  onResizeStart,
  onResize,
  onFit,
}: {
  readonly onResizeStart: () => void
  /** Total travel since the pointer went down, NOT the step since the last event. */
  readonly onResize: (delta: number) => void
  readonly onFit: () => void
}) {
  const originX = useRef(0)

  /**
   * The callbacks, held in a ref.
   *
   * The `pointermove` listener below is registered ONCE, at pointer-down, and closes
   * over whatever the props were at that instant. `onResize` is rebuilt on every render
   * — and a resize causes a render on every mouse move — so the closure would be calling
   * a callback one frame stale for the whole drag. That was the bug: every move
   * recomputed the width from the ORIGINAL one plus a few pixels, so the column moved
   * one step and stopped.
   */
  const latest = useRef({ onResizeStart, onResize })
  latest.current = { onResizeStart, onResize }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    originX.current = e.clientX
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    latest.current.onResizeStart()

    // Measured from the ORIGIN, not from the previous event. Accumulating steps drifts
    // when one is dropped, and it makes the result depend on the event rate.
    const move = (ev: PointerEvent) => latest.current.onResize(ev.clientX - originX.current)
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }, [])

  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onFit()
      }}
      className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize transition-colors hover:bg-primary/40 active:bg-primary/60"
      aria-hidden
    />
  )
}
