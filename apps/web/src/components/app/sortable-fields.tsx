'use client'

import { Hint } from '@/components/ui/tooltip'
import type { Field, Table } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, Lock } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

/**
 * The fields of a table in the structure screen, in the order a person gives them — by
 * dragging the handle, or from the keyboard (focus the handle, Space, arrows, Space).
 *
 * The order is the catalog's: the grid opens with it, the API and the documentation list
 * it. The system columns do not move — they carry no place of their own — and nobody builds
 * them: they come last, folded into one line that opens on demand, so that a table reads
 * from its own fields. Whether that line is open is this browser's to remember.
 * While the new order is being saved it is shown as dropped, then replaced by what the
 * server holds — a refusal puts the list back.
 */
export function SortableFields({
  table,
  disabled,
  onReorder,
  children,
  after,
}: {
  readonly table: Table
  /** No handle at all: the reader may not build the table, or the screen is busy. */
  readonly disabled: boolean
  readonly onReorder: (names: readonly string[]) => Promise<void>
  /** A field's row, given its index in the whole list and the handle to place in it. */
  readonly children: (field: Field, index: number, handle: ReactNode) => ReactNode
  /** What follows the table's own fields, before the system columns: the line that adds one. */
  readonly after?: ReactNode
}) {
  const system = useMemo(() => table.fields.filter((f) => f.system === true), [table.fields])
  const business = useMemo(() => table.fields.filter((f) => f.system !== true), [table.fields])
  const [pending, setPending] = useState<readonly string[] | null>(null)

  // The server's order, once it has answered.
  const signature = business.map((f) => f.name).join(',')
  useEffect(() => {
    void signature
    setPending(null)
  }, [signature])

  const shown =
    pending === null ? business : pending.flatMap((name) => business.filter((f) => f.name === name))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over === null || active.id === over.id) return
    const names = shown.map((f) => f.name)
    const next = arrayMove(names, names.indexOf(String(active.id)), names.indexOf(String(over.id)))
    setPending(next)
    // Whatever the answer, the list then shows what the server holds.
    void onReorder(next).finally(() => setPending(null))
  }

  const [systemOpen, setSystemOpen] = useSystemOpen()

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((f) => f.name)} strategy={verticalListSortingStrategy}>
          {shown.map((field, index) => (
            <SortableRow key={field.name} id={field.name} label={field.label} disabled={disabled}>
              {(handle) => children(field, index, handle)}
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
      {after}
      {system.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={systemOpen}
            onClick={() => setSystemOpen(!systemOpen)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50',
              shown.length > 0 && 'border-t',
            )}
          >
            <ChevronRight
              className={cn('size-4 shrink-0 transition-transform', systemOpen && 'rotate-90')}
            />
            <Lock className="size-3.5 shrink-0" />
            <span className="shrink-0 font-medium">
              {$tp(system.length, '{count} colonne système', '{count} colonnes système')}
            </span>
            <span className="truncate text-xs">
              {$t('Identifiant, dates et auteurs de création et de modification, tenus par basedb')}
            </span>
          </button>
          {systemOpen &&
            system.map((field, index) =>
              children(field, shown.length + 1 + index, <span className="size-4 shrink-0" />),
            )}
        </>
      )}
    </>
  )
}

const SYSTEM_OPEN_KEY = 'basedb.structure.systemColumns'

/** Folded by default; opened, it stays open in this browser — when storage allows. */
function useSystemOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(SYSTEM_OPEN_KEY) === 'open')
    } catch {
      // No storage (a private window, blocked site data): folded, as by default.
    }
  }, [])
  const set = (next: boolean) => {
    setOpen(next)
    try {
      window.localStorage.setItem(SYSTEM_OPEN_KEY, next ? 'open' : 'closed')
    } catch {
      // Remembered for this page only.
    }
  }
  return [open, set]
}

function SortableRow({
  id,
  label,
  disabled,
  children,
}: {
  readonly id: string
  readonly label: string
  readonly disabled: boolean
  readonly children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  const handle = disabled ? (
    <span className="size-4 shrink-0" />
  ) : (
    <Hint label={$t('Glisser pour changer l’ordre des colonnes')}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={$t('Déplacer le champ {label}', { label })}
        className="-ml-1 flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground focus-visible:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
    </Hint>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative bg-background', isDragging && 'z-10 shadow-lg')}
    >
      {children(handle)}
    </div>
  )
}
