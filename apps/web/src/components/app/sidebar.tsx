'use client'

import { BaseMenu } from '@/components/app/base-menu'
import { useTableActions } from '@/components/app/table-actions'
import { UserMenu } from '@/components/app/user-menu'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Base, DescribedBase, Table } from '@/lib/api/client'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Clock,
  Ellipsis,
  FolderOpen,
  Layers,
  type LucideIcon,
  Plus,
  Puzzle,
  Search,
  Settings,
  Shield,
  Table2,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react'
import { useState } from 'react'

/**
 * The left column — chapter 11.
 *
 * Everything here comes from `/meta/bases`, hence from the catalog and from the reader's
 * own rights: a base with no readable table is simply absent, and so is a table the
 * reader cannot see. Two people open the same instance and see two different sidebars.
 *
 * Its two ends belong to the person rather than to the data: the base they are in, at
 * the top, with what one does to a base; and who they are, at the bottom, with what one
 * does to a session.
 */

interface Props {
  readonly bases: readonly Base[]
  readonly base: DescribedBase | null
  readonly user: { readonly displayName: string; readonly email: string }
  readonly section: Section
  readonly busy?: boolean
  readonly onOpenBase: (name: string) => void
  readonly onNewBase: () => void
  readonly onNewTable: () => void
  readonly onSection: (section: Section) => void
  readonly onBasesChanged: () => void
  readonly onBaseDeleted: (name: string) => void
  readonly onSignedOut: () => void
}

export type Section = 'data' | 'structure' | 'history' | 'permissions' | 'doc'

export function Sidebar({
  bases,
  base,
  user,
  section,
  busy = false,
  onOpenBase,
  onNewBase,
  onNewTable,
  onSection,
  onBasesChanged,
  onBaseDeleted,
  onSignedOut,
}: Props) {
  const openTable = useWorkspace((s) => s.openTable)
  const openSql = useWorkspace((s) => s.openSql)
  const tabs = useWorkspace((s) => s.tabs)
  const activeId = useWorkspace((s) => s.activeId)
  const [filter, setFilter] = useState('')

  const active = tabs.find((t) => t.id === activeId) ?? null
  const shown =
    filter === ''
      ? (base?.tables ?? [])
      : (base?.tables ?? []).filter((t) =>
          `${t.label} ${t.name}`.toLowerCase().includes(filter.toLowerCase()),
        )

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <BaseMenu
        bases={bases}
        base={base}
        busy={busy}
        onOpenBase={onOpenBase}
        onNewBase={onNewBase}
        onChanged={onBasesChanged}
        onDeleted={onBaseDeleted}
      />

      <div className="px-3 pb-3">
        <div className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer les tables"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            aria-label="Filtrer les tables"
          />
          {filter !== '' && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Effacer"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3 scroll-discret">
        <Group
          title={`Tables${base === null ? '' : ` · ${base.tables.length}`}`}
          action={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onNewTable}
                  disabled={base === null || busy}
                  aria-label="Nouvelle table"
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nouvelle table</TooltipContent>
            </Tooltip>
          }
        >
          {shown.map((t) => (
            <TableRow
              key={t.id}
              table={t as Table}
              active={section === 'data' && active?.kind === 'table' && active.table === t.name}
              onOpen={() => {
                onSection('data')
                openTable(t as Table, t.label)
              }}
            />
          ))}
          {base !== null && shown.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {filter === ''
                ? 'Cette base ne contient aucune table lisible.'
                : 'Aucune table ne correspond.'}
            </p>
          )}
        </Group>

        <Group title="Interroger">
          <Item
            icon={Terminal}
            label="Nouvelle requête SQL"
            muted
            disabled={base === null}
            onClick={() => {
              if (base === null) return
              onSection('data')
              const count = tabs.filter((t) => t.kind === 'sql').length + 1
              openSql(base.name, null, `Requête ${count}`)
            }}
          />
        </Group>

        <Group title="Base">
          <Item
            icon={Layers}
            label="Structure"
            active={section === 'structure'}
            onClick={() => onSection('structure')}
            disabled={base === null}
          />
          <Item
            icon={Clock}
            label="Historique"
            active={section === 'history'}
            onClick={() => onSection('history')}
            disabled={base === null}
          />
          <Item
            icon={Shield}
            label="Permissions"
            active={section === 'permissions'}
            onClick={() => onSection('permissions')}
            disabled={base === null}
          />
        </Group>
      </nav>

      <Separator />

      <div className="space-y-0.5 p-3">
        <Item
          icon={BookOpen}
          label="Documentation API"
          active={section === 'doc'}
          onClick={() => onSection('doc')}
          disabled={base === null}
        />
        <Item icon={Puzzle} label="Intégrations" disabled />
        <Item icon={Settings} label="Paramètres" disabled />
      </div>

      <div className="p-3 pt-0">
        <UserMenu user={user} onSignedOut={onSignedOut} />
      </div>
    </aside>
  )
}

function Group({
  title,
  action,
  children,
}: {
  readonly title: string
  readonly action?: React.ReactNode
  readonly children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex h-7 items-center justify-between px-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

/**
 * A table in the list, and what can be done to it.
 *
 * Right-click opens the menu; a « ⋯ » on hover opens the same three entries for anyone who
 * looks for them with the left button, and for a touch screen, which has no right-click.
 * The click itself still opens the table: the menu is an addition to the most frequent
 * gesture, never a replacement.
 *
 * « Supprimer » leads to the same confirmation as the structure screen — the table is
 * renamed, not destroyed, and the dialog says so — and « Importer » to the assistant that
 * the grid's toolbar also opens: a verb reachable only from a menu is one nobody finds.
 */
function TableRow({
  table,
  active,
  onOpen,
}: {
  readonly table: Table
  readonly active: boolean
  readonly onOpen: () => void
}) {
  const { importInto, deleteTable } = useTableActions()

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/table relative">
          <Item
            icon={Table2}
            label={table.label}
            hint={table.name}
            active={active}
            onClick={onOpen}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions sur la table ${table.label}`}
                className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/table:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <Ellipsis className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onSelect={onOpen}>
                <FolderOpen className="size-4" />
                Ouvrir
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => importInto(table)}>
                <Upload className="size-4" />
                Importer…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => deleteTable(table)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Supprimer la table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onOpen}>
          <FolderOpen className="size-4" />
          Ouvrir
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => importInto(table)}>
          <Upload className="size-4" />
          Importer…
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => deleteTable(table)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4 text-destructive" />
          Supprimer la table
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function Item({
  icon: Icon,
  label,
  hint,
  active = false,
  muted = false,
  disabled = false,
  onClick,
}: {
  readonly icon: LucideIcon
  readonly label: string
  readonly hint?: string
  readonly active?: boolean
  readonly muted?: boolean
  readonly disabled?: boolean
  readonly onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-sm transition-colors',
        'hover:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-40',
        active ? 'bg-sidebar-accent font-medium' : 'font-normal',
        muted && 'text-muted-foreground',
      )}
    >
      <Icon
        className={cn('size-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground')}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}
