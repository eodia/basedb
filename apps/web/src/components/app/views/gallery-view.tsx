'use client'

import type { Row } from '@/components/app/grid/cell'
import { RecordCard, coverOf } from '@/components/app/views/card'
import { usePagedRows } from '@/components/app/views/paged'
import { Button } from '@/components/ui/button'
import type { Field, Table } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { type GallerySpec, nextHandOrder, orderByHand, pick, titleFieldOf } from '@/lib/views'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

/**
 * The gallery — a card per row, its cover first (ch. 11 §1.6): the first image of the
 * chosen field, cropped or whole, the title and the chosen fields under it. A click opens
 * the row. Without a sort, the cards keep the order they were dragged into.
 */

export const COLUMNS: Readonly<Record<GallerySpec['card_size'], string>> = {
  small: 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]',
  medium: 'grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]',
  large: 'grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]',
}
export const COVER: Readonly<Record<GallerySpec['card_size'], string>> = {
  small: 'h-28',
  medium: 'h-40',
  large: 'h-56',
}

export function GalleryView({
  table,
  fields,
  spec,
  filter,
  sort,
  reloadKey,
  openedId,
  onOpen,
  onReorder,
  onError,
}: {
  readonly table: Table
  readonly fields: readonly Field[]
  readonly spec: GallerySpec
  readonly filter: string
  readonly sort: string
  readonly reloadKey: number
  readonly openedId: string | null
  readonly onOpen: (row: Row) => void
  /** Saves an order by hand; absent for a reader who may not change the view. */
  readonly onReorder?: (order: readonly string[]) => Promise<void>
  readonly onError: (message: string | null) => void
}) {
  const { rows, loading, hasMore, loadMore } = usePagedRows({
    table,
    filter,
    sort,
    reloadKey,
    onError,
  })
  const title = titleFieldOf(table, fields, spec.title_field)
  const shown = useMemo(() => pick(fields, spec.card_fields), [fields, spec.card_fields])
  const cover = fields.find((f) => f.name === spec.cover_field) ?? null
  const color = fields.find((f) => f.name === spec.color_field) ?? null

  // The order as dropped, while the view is being saved.
  const [pending, setPending] = useState<readonly string[] | null>(null)
  const byHand = sort === ''
  const ordered = useMemo(
    () => (byHand ? orderByHand(rows, pending ?? spec.manual_order) : [...rows]),
    [rows, byHand, pending, spec.manual_order],
  )
  const draggable = byHand && onReorder !== undefined

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (onReorder === undefined || over === null || active.id === over.id) return
    const ids = ordered.map((r) => r._id)
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    const next = nextHandOrder(moved, spec.manual_order)
    setPending(next)
    try {
      await onReorder(next)
    } catch {
      setPending(null)
    }
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        {$t('Aucune ligne à montrer.')}
      </div>
    )
  }

  const colorOf = (row: Row): string | null => {
    if (color === null) return null
    const value = row[color.name]
    return color.options?.find((o) => o.value === value)?.color ?? null
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-discret p-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ordered.map((r) => r._id)} strategy={rectSortingStrategy}>
          <div className={cn('grid gap-3', COLUMNS[spec.card_size])}>
            {ordered.map((row) => (
              <SortableCard key={row._id} id={row._id} disabled={!draggable}>
                <RecordCard
                  row={row}
                  title={title}
                  fields={shown}
                  cover={coverOf(row, cover)}
                  coverClassName={cn(
                    COVER[spec.card_size],
                    spec.cover_fit === 'contain' && 'bg-muted object-contain',
                  )}
                  color={colorOf(row)}
                  coverPlaceholder={cover !== null}
                  selected={row._id === openedId}
                  onOpen={() => onOpen(row)}
                />
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex justify-center py-4">
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : hasMore ? (
          <Button variant="outline" size="sm" onClick={loadMore}>
            {$t('Charger plus')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** A card that can be dragged to a new place — or not, when the view is sorted. */
export function SortableCard({
  id,
  disabled,
  children,
}: {
  readonly id: string
  readonly disabled: boolean
  readonly children: React.ReactNode
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-80')}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
