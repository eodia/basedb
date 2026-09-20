'use client'

import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type Tab, useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Sparkles, Table2, Terminal, X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * The tab strip.
 *
 * Tabs are reorderable, closable by middle click, and the wheel scrolls them
 * horizontally — three behaviours nobody asks for and everybody expects, because every
 * editor has had them for twenty years.
 *
 * What a tab holds is in `useWorkspace`: the grid overlay, the sort, the filter, the
 * cursor stack. Switching tabs therefore restores a view rather than reloading a
 * default one, which is the whole reason for having tabs instead of one canvas.
 */

interface Props {
  readonly onNewSql: () => void
  readonly copilotOpen: boolean
  readonly onToggleCopilot: () => void
}

export function TabBar({ onNewSql, copilotOpen, onToggleCopilot }: Props) {
  const tabs = useWorkspace((s) => s.tabs)
  const activeId = useWorkspace((s) => s.activeId)
  const { activate, close, closeOthers, closeToLeft, closeToRight, closeAll, reorder } =
    useWorkspace()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over !== null && active.id !== over.id) reorder(String(active.id), String(over.id))
  }

  // Alt+W closes, Ctrl+Tab walks. Bound on the window because the strip is rarely the
  // focused element — the grid below it is.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'w' && activeId !== null) {
        e.preventDefault()
        close(activeId)
        return
      }
      if (e.ctrlKey && e.key === 'Tab' && tabs.length > 1) {
        e.preventDefault()
        const index = tabs.findIndex((t) => t.id === activeId)
        const next = tabs[(index + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length]
        if (next !== undefined) activate(next.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tabs, activeId, close, activate])

  if (tabs.length === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b bg-surface">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div
            className="scroll-discret flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden"
            onWheel={(e) => {
              // A wheel over a strip that cannot scroll vertically should scroll it
              // horizontally: that is what a trackpad user expects, and what a mouse
              // user discovers immediately.
              if (e.deltaY === 0) return
              e.currentTarget.scrollLeft += e.deltaY
            }}
          >
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeId}
                onActivate={() => activate(tab.id)}
                onClose={() => close(tab.id)}
                onCloseOthers={() => closeOthers(tab.id)}
                onCloseToLeft={() => closeToLeft(tab.id)}
                onCloseToRight={() => closeToRight(tab.id)}
                onCloseAll={closeAll}
              />
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onNewSql}
                  className="flex shrink-0 items-center justify-center px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Nouvel onglet SQL"
                >
                  <Plus className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Nouvelle requête SQL</TooltipContent>
            </Tooltip>
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex shrink-0 items-center gap-1 border-l px-2">
        <Button
          variant={copilotOpen ? 'default' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onToggleCopilot}
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">Copilot</span>
        </Button>
      </div>
    </div>
  )
}

function SortableTab({
  tab,
  active,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToLeft,
  onCloseToRight,
  onCloseAll,
}: {
  readonly tab: Tab
  readonly active: boolean
  readonly onActivate: () => void
  readonly onClose: () => void
  readonly onCloseOthers: () => void
  readonly onCloseToLeft: () => void
  readonly onCloseToRight: () => void
  readonly onCloseAll: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  })

  const Icon = tab.kind === 'table' ? Table2 : Terminal

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{
            transform: CSS.Transform.toString(transform),
            transition,
            zIndex: isDragging ? 10 : undefined,
          }}
          className={cn(
            'group flex h-full shrink-0 select-none items-center gap-1.5 border-r px-3 text-xs transition-colors',
            active
              ? '-mb-px border-b-2 border-b-primary bg-background text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            isDragging && 'opacity-50',
          )}
          onAuxClick={(e) => {
            if (e.button !== 1) return
            e.preventDefault()
            onClose()
          }}
        >
          <div
            {...attributes}
            {...listeners}
            onClick={onActivate}
            className="flex cursor-pointer items-center gap-1.5"
          >
            <Icon className="size-3 shrink-0 opacity-70" />
            <span className={cn('max-w-[140px] truncate', tab.kind === 'table' && 'font-mono')}>
              {tab.label}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="rounded p-px text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
            aria-label={`Fermer ${tab.label}`}
          >
            <X className="size-3" />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={onClose}>
          Fermer
          <ContextMenuShortcut>Alt+W</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers}>Fermer les autres</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onCloseToLeft}>Fermer à gauche</ContextMenuItem>
        <ContextMenuItem onSelect={onCloseToRight}>Fermer à droite</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onCloseAll} className="text-destructive focus:text-destructive">
          Tout fermer
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
