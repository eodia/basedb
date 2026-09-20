'use client'

import { BaseMenu } from '@/components/app/base-menu'
import { UserMenu } from '@/components/app/user-menu'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Base, DescribedBase, Table } from '@/lib/api/client'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Clock,
  Layers,
  type LucideIcon,
  Plus,
  Puzzle,
  Search,
  Settings,
  Shield,
  Table2,
  Terminal,
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
            <Item
              key={t.id}
              icon={Table2}
              label={t.label}
              hint={t.name}
              active={section === 'data' && active?.kind === 'table' && active.table === t.name}
              onClick={() => {
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
