'use client'

import { VIZ_ICONS } from '@/components/app/analytics/viz-settings'
import { EnvironmentBadge } from '@/components/app/environment-badge'
import { LookIcon, type OptionLook } from '@/components/app/option-badge'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { BaseEnvironment, Table } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
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
import { Eye, FileCode2, Plus, SquareTerminal, Table2, Terminal, Workflow, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'

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
  /** A new question — built with the mouse, or in SQL —, or a SQL statement to run. */
  readonly onNew: (kind: 'builder' | 'sql' | 'statement') => void
  /** The tables whose look a tab wears; a tab of a table not listed keeps the plain glyph. */
  readonly tables?: readonly Table[]
  /**
   * The environment of each base that is not production, by base name: a tab of recette
   * and a tab of production over the same table must not look the same (chapter 14).
   */
  readonly environments?: ReadonlyMap<string, BaseEnvironment>
}

export function TabBar({ onNew, tables = [], environments }: Props) {
  const tabs = useWorkspace((s) => s.tabs)
  const activeId = useWorkspace((s) => s.activeId)
  const looks = useMemo(() => new Map(tables.map((t) => [`${t.base}.${t.name}`, t])), [tables])
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
                look={tab.kind === 'table' ? looks.get(`${tab.base}.${tab.table}`) : undefined}
                environment={environments?.get(tab.base)}
                active={tab.id === activeId}
                onActivate={() => activate(tab.id)}
                onClose={() => close(tab.id)}
                onCloseOthers={() => closeOthers(tab.id)}
                onCloseToLeft={() => closeToLeft(tab.id)}
                onCloseToRight={() => closeToRight(tab.id)}
                onCloseAll={closeAll}
              />
            ))}

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex shrink-0 items-center justify-center px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={$t('Nouvel onglet')}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{$t('Nouvel onglet')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onSelect={() => onNew('builder')}>
                  <Workflow className="size-4" />
                  {$t('Nouvelle question')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onNew('sql')}>
                  <SquareTerminal className="size-4" />
                  {$t('Nouvelle question SQL')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onNew('statement')}>
                  <Terminal className="size-4" />
                  {$t('Requête SQL')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableTab({
  tab,
  look,
  environment,
  active,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToLeft,
  onCloseToRight,
  onCloseAll,
}: {
  readonly tab: Tab
  /** The table's look, when the tab is a table's and the table is known here. */
  readonly look?: OptionLook
  /** The tab's environment, when it is not production. */
  readonly environment?: BaseEnvironment
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

  // A table, a SQL view, a question — its chart, or how it is built —, a saved query, a
  // statement being written.
  const chart = tab.question?.visualization?.type
  const Icon =
    tab.kind === 'table'
      ? Table2
      : tab.kind === 'sqlview'
        ? Eye
        : tab.kind === 'question'
          ? chart !== undefined && chart !== 'table'
            ? VIZ_ICONS[chart]
            : tab.question?.query?.kind === 'sql'
              ? SquareTerminal
              : Workflow
          : tab.queryId !== null
            ? FileCode2
            : Terminal

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
            <LookIcon look={look ?? {}} fallback={Icon} className="size-3 opacity-70" />
            <span className={cn('max-w-[140px] truncate', tab.kind === 'table' && 'font-mono')}>
              {tab.label}
            </span>
            {environment !== undefined && (
              <EnvironmentBadge environment={environment} className="h-4 px-1 text-[0.65rem]" />
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="rounded p-px text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
            aria-label={$t('Fermer {label}', { label: tab.label })}
          >
            <X className="size-3" />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={onClose}>
          {$t('Fermer')}
          <ContextMenuShortcut>{$t('Alt+W')}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers}>{$t('Fermer les autres')}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onCloseToLeft}>{$t('Fermer à gauche')}</ContextMenuItem>
        <ContextMenuItem onSelect={onCloseToRight}>{$t('Fermer à droite')}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onCloseAll} variant="destructive">
          {$t('Tout fermer')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
