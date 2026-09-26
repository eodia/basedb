'use client'

import type { Row } from '@/components/app/grid/cell'
import { OptionBadge } from '@/components/app/option-badge'
import { UserValue } from '@/components/app/value-widgets'
import { CardValue, titleOf } from '@/components/app/views/card'
import { SortableCard } from '@/components/app/views/gallery-view'
import { usePagedRows } from '@/components/app/views/paged'
import { Button } from '@/components/ui/button'
import type { Field, Table } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { type ListSpec, nextHandOrder, orderByHand, pick, titleFieldOf } from '@/lib/views'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronRight, Loader2 } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'

/**
 * The list — one line per row, grouped under titles (ch. 11 §1.6): the title, then the
 * chosen fields on the same line; groups by a choice, a relation or a person, each header
 * folding its rows away. Without a sort, the lines keep the order they were dragged into,
 * within their group.
 */

const NONE = '__sans_valeur__'

interface Group {
  readonly key: string
  readonly header: ReactNode
  readonly rows: readonly Row[]
}

/** The key of a row's group, and how its header reads. */
function groupOf(row: Row, field: Field): { key: string; header: ReactNode } {
  const value = row[field.name]
  if (value === null || value === undefined || value === '') {
    return { key: NONE, header: <span className="text-muted-foreground">Sans valeur</span> }
  }
  if (field.kind === 'select') {
    const option = field.options?.find((o) => o.value === value)
    return {
      key: String(value),
      header: <OptionBadge option={option ?? { label: String(value) }} />,
    }
  }
  if (field.kind === 'link') {
    const link = value as { id?: string | null; display?: string | null }
    return {
      key: link.id ?? NONE,
      header: <span>{link.display ?? link.id?.slice(0, 8) ?? '—'}</span>,
    }
  }
  if (field.kind === 'user') return { key: String(value), header: <UserValue id={value} /> }
  return { key: String(value), header: <span>{String(value)}</span> }
}

export function ListView({
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
  readonly spec: ListSpec
  readonly filter: string
  readonly sort: string
  readonly reloadKey: number
  readonly openedId: string | null
  readonly onOpen: (row: Row) => void
  readonly onReorder?: (order: readonly string[]) => Promise<void>
  readonly onError: (message: string | null) => void
}) {
  const group = fields.find((f) => f.name === spec.group_by) ?? null
  // Grouped, the lines are read sorted by their group first: each group is one run.
  const effectiveSort =
    group === null
      ? sort
      : [
          group.name,
          ...sort.split(',').filter((s) => s !== '' && s.replace(/^-/, '') !== group.name),
        ].join(',')
  const { rows, loading, hasMore, loadMore } = usePagedRows({
    table,
    filter,
    sort: effectiveSort,
    reloadKey,
    onError,
  })
  const title = titleFieldOf(table, fields, spec.title_field)
  const shown = useMemo(() => pick(fields, spec.card_fields), [fields, spec.card_fields])
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const [pending, setPending] = useState<readonly string[] | null>(null)

  const byHand = sort === ''
  const ordered = useMemo(
    () => (byHand ? orderByHand(rows, pending ?? spec.manual_order) : [...rows]),
    [rows, byHand, pending, spec.manual_order],
  )
  const groups = useMemo<readonly Group[]>(() => {
    if (group === null) return [{ key: 'all', header: null, rows: ordered }]
    const out: Array<{ key: string; header: ReactNode; rows: Row[] }> = []
    for (const row of ordered) {
      const { key, header } = groupOf(row, group)
      const existing = out.find((g) => g.key === key)
      if (existing === undefined) out.push({ key, header, rows: [row] })
      else existing.rows.push(row)
    }
    // Rows without a value last, under their own header; the rest in the list's order.
    if (group.kind === 'select') {
      const rank = new Map((group.options ?? []).map((o, i) => [o.value, i]))
      out.sort((a, b) => (rank.get(a.key) ?? 1e6) - (rank.get(b.key) ?? 1e6))
    }
    return out
  }, [group, ordered])

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
        Aucune ligne à montrer.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-discret px-4 py-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ordered.map((r) => r._id)} strategy={verticalListSortingStrategy}>
          {groups.map((g) => {
            const closed = folded.has(g.key)
            return (
              <section key={g.key} className="mb-3">
                {g.header !== null && (
                  <button
                    type="button"
                    onClick={() =>
                      setFolded((f) => {
                        const next = new Set(f)
                        if (next.has(g.key)) next.delete(g.key)
                        else next.add(g.key)
                        return next
                      })
                    }
                    className="mb-1 flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm font-medium hover:bg-muted/60"
                    aria-expanded={!closed}
                  >
                    <ChevronRight
                      className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        !closed && 'rotate-90',
                      )}
                    />
                    {g.header}
                    <span className="text-xs font-normal text-muted-foreground">
                      {g.rows.length}
                    </span>
                  </button>
                )}
                {!closed && (
                  <div className="overflow-hidden rounded-lg border">
                    {g.rows.map((row, index) => (
                      <SortableCard key={row._id} id={row._id} disabled={!draggable}>
                        {/* biome-ignore lint/a11y/useSemanticElements: a line holds cells — values, chips — which a <button> may not contain */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpen(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onOpen(row)
                          }}
                          className={cn(
                            'flex cursor-pointer items-center gap-4 bg-background px-3 py-2 text-sm hover:bg-muted/40',
                            index > 0 && 'border-t',
                            row._id === openedId && 'bg-primary/5',
                          )}
                        >
                          <span className="w-56 shrink-0 truncate font-medium">
                            {titleOf(row, title)}
                          </span>
                          {shown.map((field) => (
                            <span
                              key={field.name}
                              className="flex min-w-0 max-w-56 flex-1 items-center truncate text-muted-foreground"
                            >
                              <CardValue field={field} row={row} />
                            </span>
                          ))}
                        </div>
                      </SortableCard>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </SortableContext>
      </DndContext>
      <div className="flex justify-center py-3">
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : hasMore ? (
          <Button variant="outline" size="sm" onClick={loadMore}>
            Charger plus
          </Button>
        ) : null}
      </div>
    </div>
  )
}
