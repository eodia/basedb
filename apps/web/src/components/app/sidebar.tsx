'use client'

import type { AdminTab } from '@/components/app/admin/admin-panel'
import { DeleteBaseDialog, EditBaseDialog } from '@/components/app/base-menu'
import {
  EnvironmentBadge,
  familiesOf,
  readEnvironmentChoices,
  shownEnvironment,
  writeEnvironmentChoice,
} from '@/components/app/environment-badge'
import { EnvironmentsDialog } from '@/components/app/environments-dialog'
import {
  AliasesDialog,
  DeletedTablesDialog,
  PhysicalRenameDialog,
  type PhysicalTarget,
} from '@/components/app/lifecycle-dialogs'
import { LookIcon, type OptionLook } from '@/components/app/option-badge'
import { ProjectMenu } from '@/components/app/project-menu'
import { ProposalDialog } from '@/components/app/proposal-dialog'
import { ExportTemplateDialog } from '@/components/app/template-export-dialog'
import { TokenDialog } from '@/components/app/token-dialog'
import { UserMenu } from '@/components/app/user-menu'
import { WebhookDialog } from '@/components/app/webhook-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DescribedBase, Me, Project, ProjectBase } from '@/lib/api/client'
import { useSidebar } from '@/lib/store/sidebar'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  ArchiveX,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Clock,
  CodeXml,
  Copy,
  Database,
  Ellipsis,
  FileJson,
  FolderOpen,
  GitCompareArrows,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  PanelLeft,
  Pencil,
  Plug,
  Plus,
  Puzzle,
  Search,
  Settings,
  Shield,
  Table2,
  Terminal,
  Trash2,
  Upload,
  Users,
  Webhook,
  Zap,
} from 'lucide-react'
import { createContext, useContext, useEffect, useState } from 'react'

/**
 * The left column — chapter 11, reorganized around projects (chapter 05 §15).
 *
 * At the top, the project one is in. Below it, the bases of that project as a tree, each
 * with its tables: one creates a base in the project, a table in a base, from the menu of
 * the level above. Everything here comes from `/meta/projects`, hence from the catalog
 * and from the reader's own rights: a base with no readable table is absent, and so is a
 * table the reader cannot see. Two people open the same instance and see two different
 * sidebars.
 *
 * Its bottom belongs to the person rather than to the data: the administration, for those
 * who administer, and who they are, with what one does to a session.
 */

/** True inside the reduced column: every item shows its icon, and its label as a tooltip. */
const Compact = createContext(false)

export type Section =
  | 'data'
  | 'structure'
  | 'history'
  | 'interfaces'
  | 'automations'
  | 'integrations'
  | 'doc'
  | 'admin'

/** What a base's menu asks of the page: each makes the base the current one first. */
export type BaseIntent = 'open' | 'structure' | 'doc' | 'sql' | 'new-table'

/** What a table's menu asks of the page. */
export type TableIntent = 'open' | 'import' | 'edit' | 'delete' | 'rename-physical'

interface Props {
  readonly projects: readonly Project[]
  readonly project: Project | null
  /** The base the sections speak of — the last one chosen, or the open table's. */
  readonly base: DescribedBase | null
  readonly user: Me
  readonly section: Section
  readonly busy?: boolean
  readonly onSelectProject: (id: string) => void
  readonly onNewProject: () => void
  readonly onProjectsChanged: () => void
  readonly onProjectDeleted: (id: string) => void
  readonly onNewBase: () => void
  readonly onBase: (name: string, intent: BaseIntent) => void
  readonly onBaseChanged: (name: string) => void
  readonly onBaseDeleted: (name: string) => void
  readonly onTable: (base: string, table: string, intent: TableIntent) => void
  readonly onSection: (section: Section) => void
  readonly onAdmin: (tab: AdminTab) => void
  readonly onSignedOut: () => void
  /** A base or a table renamed in the database: tabs and URLs carry the old name. */
  readonly onRenamed?: (change: {
    readonly kind: 'base' | 'table'
    readonly base: string
    readonly from: string
    readonly to: string
  }) => void
}

type BaseDialog = {
  readonly kind:
    | 'edit'
    | 'delete'
    | 'mcp'
    | 'webhooks'
    | 'proposals'
    | 'rename-physical'
    | 'aliases'
    | 'deleted-tables'
    | 'environments'
    | 'template'
  readonly base: ProjectBase
}

export function Sidebar({
  projects,
  project,
  base,
  user,
  section,
  busy = false,
  onSelectProject,
  onNewProject,
  onProjectsChanged,
  onProjectDeleted,
  onNewBase,
  onBase,
  onBaseChanged,
  onBaseDeleted,
  onTable,
  onSection,
  onAdmin,
  onSignedOut,
  onRenamed,
}: Props) {
  const tabs = useWorkspace((s) => s.tabs)
  const activeId = useWorkspace((s) => s.activeId)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [dialog, setDialog] = useState<BaseDialog | null>(null)
  const [physicalTable, setPhysicalTable] = useState<{
    readonly base: string
    readonly target: PhysicalTarget
  } | null>(null)

  const collapsed = useSidebar((s) => s.collapsed)

  // The current base is always unfolded: it is the one whose table is open, or the one
  // just chosen, and its tables are what one reaches for next.
  useEffect(() => {
    if (base === null) return
    setExpanded((was) => (was.has(base.name) ? was : new Set([...was, base.name])))
  }, [base])

  const active = tabs.find((t) => t.id === activeId) ?? null
  const activeTable =
    section === 'data' && active?.kind === 'table' && active.table !== null
      ? { base: active.base, table: active.table }
      : null

  // One line per base, whatever its number of environments (chapter 14): the line shows
  // the environment being worked in, or the one last chosen, or production.
  const [chosen, setChosen] = useState<Readonly<Record<string, string>>>({})
  useEffect(() => setChosen(readEnvironmentChoices()), [])
  const families = familiesOf(project?.bases ?? [])
  const familyOf = new Map(
    families.flatMap((family) => family.map((b) => [b.name, family] as const)),
  )
  const bases = families.flatMap((family) => {
    const lineage = family[0]?.environment.lineage ?? ''
    const shownOne = shownEnvironment(family, base?.name ?? null, chosen, lineage)
    return shownOne === undefined ? [] : [shownOne]
  })
  const switchEnvironment = (b: ProjectBase) => {
    writeEnvironmentChoice(b.environment.lineage, b.name)
    setChosen((was) => ({ ...was, [b.environment.lineage]: b.name }))
    onBase(b.name, 'open')
  }

  const needle = filter.trim().toLowerCase()
  const matches = (text: string) => text.toLowerCase().includes(needle)
  const shown =
    needle === ''
      ? bases.map((b) => ({ base: b, tables: b.tables }))
      : bases.flatMap((b) => {
          // A base whose own label matches shows all its tables; otherwise only those that do.
          if (matches(`${b.label} ${b.name}`)) return [{ base: b, tables: b.tables }]
          const tables = b.tables.filter((t) => matches(`${t.label} ${t.name}`))
          return tables.length > 0 ? [{ base: b, tables }] : []
        })

  const canCreateBase = project?.actions.includes('manage_schema') === true

  const toggle = (name: string) =>
    setExpanded((was) => {
      const next = new Set(was)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // Declared once and placed twice: under their group titles in full, one after the other
  // in the reduced column, which has no room for titles.
  // No « Nouvelle requête SQL » here: the tab bar's « + » opens one, and a base's menu too.
  const baseItems = (
    <>
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
        icon={LayoutDashboard}
        label="Interfaces"
        active={section === 'interfaces'}
        onClick={() => onSection('interfaces')}
        disabled={base === null}
      />
      {base?.actions.includes('manage_schema') === true && (
        <Item
          icon={Zap}
          label="Automatisations"
          active={section === 'automations'}
          onClick={() => onSection('automations')}
        />
      )}
    </>
  )

  const projectMenu = (
    <ProjectMenu
      projects={projects}
      project={project}
      administers={user.isAdmin}
      compact={collapsed}
      onSelect={onSelectProject}
      onNew={onNewProject}
      onChanged={onProjectsChanged}
      onDeleted={onProjectDeleted}
    />
  )

  const dialogs = dialog !== null && (
    <>
      <EditBaseDialog
        open={dialog.kind === 'edit'}
        base={dialog.base}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null)
          onBaseChanged(dialog.base.name)
        }}
        onEnvironmentsChanged={() => onBaseChanged(dialog.base.name)}
      />
      <TokenDialog
        open={dialog.kind === 'mcp'}
        base={dialog.base}
        onClose={() => setDialog(null)}
      />
      <WebhookDialog
        open={dialog.kind === 'webhooks'}
        base={dialog.base}
        onClose={() => setDialog(null)}
      />
      <ProposalDialog
        open={dialog.kind === 'proposals'}
        base={dialog.base}
        onClose={() => setDialog(null)}
        onApplied={() => onBaseChanged(dialog.base.name)}
      />
      <PhysicalRenameDialog
        target={
          dialog.kind === 'rename-physical'
            ? { kind: 'base', id: dialog.base.id, label: dialog.base.label }
            : null
        }
        onClose={() => setDialog(null)}
        onDone={(change) => {
          setDialog(null)
          onRenamed?.({ kind: 'base', base: change.from, ...change })
        }}
      />
      <AliasesDialog
        base={dialog.kind === 'aliases' ? dialog.base : null}
        onClose={() => setDialog(null)}
      />
      <DeletedTablesDialog
        base={dialog.kind === 'deleted-tables' ? dialog.base : null}
        onClose={() => setDialog(null)}
      />
      <EnvironmentsDialog
        base={dialog.kind === 'environments' ? dialog.base : null}
        onClose={() => setDialog(null)}
        onChanged={(name) => onBaseChanged(name)}
      />
      <ExportTemplateDialog
        base={dialog.kind === 'template' ? dialog.base : null}
        me={user}
        onClose={() => setDialog(null)}
      />
      <DeleteBaseDialog
        open={dialog.kind === 'delete'}
        base={dialog.base}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null)
          onBaseDeleted(dialog.base.name)
        }}
      />
    </>
  )

  const physicalDialog = (
    <PhysicalRenameDialog
      target={physicalTable?.target ?? null}
      onClose={() => setPhysicalTable(null)}
      onDone={(change) => {
        const base = physicalTable?.base ?? ''
        setPhysicalTable(null)
        onRenamed?.({ kind: 'table', base, ...change })
      }}
    />
  )

  // Documentation, integrations, people and rights: in the profile menu, bottom-left.
  const entries = (
    <WorkspaceEntries base={base} user={user} onSection={onSection} onAdmin={onAdmin} />
  )

  if (collapsed) {
    return (
      <Compact.Provider value>
        <aside className="relative flex w-14 shrink-0 flex-col border-r bg-sidebar">
          {projectMenu}

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-2 scroll-discret">
            <BasesMenu
              bases={bases}
              activeTable={activeTable}
              disabled={project === null}
              canCreateBase={canCreateBase && !busy}
              onOpen={(b, t) => onTable(b, t, 'open')}
              onNewBase={onNewBase}
            />
          </nav>

          {base !== null && (
            <div className="px-2 pb-2">
              <div className="space-y-1 rounded-xl border bg-card p-1 shadow-xs">{baseItems}</div>
            </div>
          )}

          <Separator />

          <div className="p-2">
            <UserMenu user={user} compact onSignedOut={onSignedOut} entries={entries} />
          </div>
          {dialogs}
          {physicalDialog}
        </aside>
      </Compact.Provider>
    )
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      {projectMenu}

      {/* The filter, and beside it the one way in for a new base: the list below needs no
          heading of its own — what it lists is plain to see. */}
      <div className="flex items-center gap-1.5 px-3 pb-3">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-2.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer les bases et les tables"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            aria-label="Filtrer les bases et les tables"
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
        {canCreateBase && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0"
                onClick={onNewBase}
                disabled={busy}
                aria-label="Nouvelle base"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nouvelle base dans ce projet</TooltipContent>
          </Tooltip>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3 scroll-discret">
        <div className="space-y-0.5">
          {shown.map(({ base: b, tables }) => (
            <BaseNode
              key={b.id}
              base={b}
              family={familyOf.get(b.name) ?? [b]}
              onEnvironment={switchEnvironment}
              tables={tables}
              current={base?.name === b.name}
              expanded={needle !== '' || expanded.has(b.name)}
              activeTable={activeTable?.base === b.name ? activeTable.table : null}
              busy={busy}
              onToggle={() => toggle(b.name)}
              onSelect={() => {
                if (!expanded.has(b.name) || base?.name === b.name) toggle(b.name)
                onBase(b.name, 'open')
              }}
              onIntent={(intent) => onBase(b.name, intent)}
              administers={user.isAdmin}
              onDialog={(kind) => setDialog({ kind, base: b })}
              onTable={(table, intent) => {
                const found = b.tables.find((x) => x.name === table)
                if (intent === 'rename-physical' && found !== undefined) {
                  setPhysicalTable({
                    base: b.name,
                    target: { kind: 'table', id: found.id, label: found.label },
                  })
                  return
                }
                onTable(b.name, table, intent)
              }}
            />
          ))}
          {project !== null && shown.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {needle !== ''
                ? 'Rien ne correspond.'
                : canCreateBase
                  ? 'Aucune base : créez la première avec « + ».'
                  : 'Aucune base visible dans ce projet.'}
            </p>
          )}
        </div>
      </nav>

      {/* The open base's own screens, just above the profile: the column above lists the
          bases, this card acts on the one that is open. */}
      {base !== null && (
        <div className="px-3 pb-3">
          <Card className="p-1.5">
            <p className="truncate px-2 pt-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Base · {base.label}
            </p>
            <div className="space-y-0.5">{baseItems}</div>
          </Card>
        </div>
      )}

      <Separator />

      <div className="p-3">
        <UserMenu user={user} onSignedOut={onSignedOut} entries={entries} />
      </div>
      {dialogs}
      {physicalDialog}
    </aside>
  )
}

/**
 * The button that reduces the column to its icons, or brings it back — at the left of the
 * header of every screen, where the column's edge is.
 */
export function SidebarToggle() {
  const collapsed = useSidebar((s) => s.collapsed)
  const toggle = useSidebar((s) => s.toggle)
  const label = collapsed ? 'Agrandir le panneau' : 'Réduire le panneau'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label}>
          <PanelLeft className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * What is not the data itself — the base's documentation and integrations, the people and
 * their rights — as entries of the profile menu, bottom-left. The column is left to the
 * bases and tables.
 */
function WorkspaceEntries({
  base,
  user,
  onSection,
  onAdmin,
}: {
  readonly base: DescribedBase | null
  readonly user: Me
  readonly onSection: (section: Section) => void
  readonly onAdmin: (tab: AdminTab) => void
}) {
  return (
    <>
      <DropdownMenuItem disabled={base === null} onSelect={() => onSection('doc')}>
        <BookOpen className="size-4" />
        Documentation API et MCP
      </DropdownMenuItem>
      {base?.actions.includes('manage_schema') === true && (
        <DropdownMenuItem onSelect={() => onSection('integrations')}>
          <Puzzle className="size-4" />
          Intégrations
        </DropdownMenuItem>
      )}
      {/* People, groups and permissions: shown to those who administer, absent otherwise —
          a disabled entry would only advertise a door the reader will never open. */}
      {user.isAdmin && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Administration
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onAdmin('users')}>
            <Users className="size-4" />
            Utilisateurs et groupes
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAdmin('permissions')}>
            <Shield className="size-4" />
            Permissions
          </DropdownMenuItem>
        </>
      )}
      <DropdownMenuItem disabled>
        <Settings className="size-4" />
        Paramètres
      </DropdownMenuItem>
    </>
  )
}

/**
 * The pieces a menu is drawn with. The entries of a base are the same whether they open
 * from its « ⋯ » or from a right-click — only the primitives differ, and writing the list
 * twice is how two menus of the same thing drift apart.
 */
interface MenuKit {
  readonly Item: React.ComponentType<{
    readonly onSelect?: () => void
    readonly disabled?: boolean
    readonly className?: string
    readonly children: React.ReactNode
  }>
  readonly Label: React.ComponentType<{
    readonly className?: string
    readonly children: React.ReactNode
  }>
  readonly Separator: React.ComponentType
  readonly Sub: React.ComponentType<{ readonly children: React.ReactNode }>
  readonly SubTrigger: React.ComponentType<{ readonly children: React.ReactNode }>
  readonly SubContent: React.ComponentType<{
    readonly className?: string
    readonly children: React.ReactNode
  }>
}

const DROPDOWN_KIT: MenuKit = {
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
}

const CONTEXT_KIT: MenuKit = {
  Item: ContextMenuItem,
  // The right-click menu's label is set like the dropdown's: the base's name, readable.
  Label: ({ className, children }) => (
    <ContextMenuLabel className={cn('text-sm text-foreground', className)}>
      {children}
    </ContextMenuLabel>
  ),
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
}

/** What one does to a base: its « ⋯ » menu, and its right-click menu. */
function BaseMenuEntries({
  kit: M,
  base,
  busy,
  administers,
  onIntent,
  onDialog,
}: {
  readonly kit: MenuKit
  readonly base: ProjectBase
  readonly busy: boolean
  readonly administers: boolean
  readonly onIntent: (intent: BaseIntent) => void
  readonly onDialog: (kind: BaseDialog['kind']) => void
}) {
  const manages = base.actions.includes('manage_schema')
  return (
    <>
      <M.Label className="truncate">{base.label}</M.Label>
      {manages && (
        <M.Item onSelect={() => onIntent('new-table')} disabled={busy}>
          <Plus className="size-4" />
          Nouvelle table
        </M.Item>
      )}
      <M.Item onSelect={() => onIntent('sql')}>
        <Terminal className="size-4" />
        Nouvelle requête SQL
      </M.Item>
      <M.Item onSelect={() => onIntent('structure')}>
        <Layers className="size-4" />
        Structure
      </M.Item>
      <M.Item onSelect={() => onIntent('doc')}>
        <BookOpen className="size-4" />
        Documentation API et MCP
      </M.Item>
      <M.Separator />
      <M.Item onSelect={() => onDialog('mcp')}>
        <Plug className="size-4" />
        Jetons API et MCP…
      </M.Item>
      {/* Like tokens: offered to whoever may manage the base's doors. */}
      {base.actions.includes('manage_tokens') && (
        <M.Item onSelect={() => onDialog('webhooks')}>
          <Webhook className="size-4" />
          Webhooks…
        </M.Item>
      )}
      {manages && (
        <>
          <M.Item onSelect={() => onDialog('proposals')}>
            <Bot className="size-4" />
            <span className="flex-1">Propositions des agents…</span>
            {base.openProposals > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {base.openProposals}
              </span>
            )}
          </M.Item>
          <M.Item onSelect={() => onDialog('edit')}>
            <Pencil className="size-4" />
            Modifier la base…
          </M.Item>
          <M.Item onSelect={() => onDialog('environments')}>
            <GitCompareArrows className="size-4" />
            Comparer les environnements…
          </M.Item>
          <M.Item onSelect={() => onDialog('template')}>
            <FileJson className="size-4" />
            Enregistrer comme modèle…
          </M.Item>
          <M.Item
            onSelect={() => onDialog('delete')}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 text-destructive" />
            Supprimer la base…
          </M.Item>
        </>
      )}
      {administers && (
        <>
          <M.Separator />
          <M.Sub>
            <M.SubTrigger>
              <Shield className="size-4" />
              Administration
            </M.SubTrigger>
            <M.SubContent className="w-56">
              <M.Item onSelect={() => onDialog('rename-physical')}>
                <CodeXml className="size-4" />
                Renommer en base…
              </M.Item>
              <M.Item onSelect={() => onDialog('aliases')}>
                <Copy className="size-4" />
                Alias de compatibilité…
              </M.Item>
              <M.Item onSelect={() => onDialog('deleted-tables')}>
                <ArchiveX className="size-4" />
                Tables supprimées…
              </M.Item>
            </M.SubContent>
          </M.Sub>
        </>
      )}
    </>
  )
}

/**
 * A base in the tree, its menu, and its tables when unfolded.
 *
 * The chevron folds; a click on the label also makes the base the current one — the one
 * « Structure », « Historique » and the SQL console speak of. The « ⋯ » holds what one does
 * to the base itself; « Nouvelle table » and « Modifier » appear only to whoever holds
 * `manage_schema` on it, which is what the server would demand anyway. What only an
 * administrator does — physical name, aliases, deleted tables — waits in a submenu of its
 * own, out of the way of the daily entries. A right-click on the line opens the same menu,
 * as it does on a table.
 */
function BaseNode({
  base,
  family,
  onEnvironment,
  tables,
  current,
  expanded,
  activeTable,
  busy,
  onToggle,
  onSelect,
  onIntent,
  onDialog,
  onTable,
  administers,
}: {
  readonly base: ProjectBase
  /** Every environment of this base, production first — the base alone when it has one. */
  readonly family: readonly ProjectBase[]
  readonly onEnvironment: (environment: ProjectBase) => void
  readonly tables: ProjectBase['tables']
  readonly current: boolean
  readonly expanded: boolean
  readonly activeTable: string | null
  readonly busy: boolean
  readonly onToggle: () => void
  readonly onSelect: () => void
  readonly onIntent: (intent: BaseIntent) => void
  readonly onDialog: (kind: BaseDialog['kind']) => void
  readonly onTable: (table: string, intent: TableIntent) => void
  /** The administration role: physical names, aliases, purge (chapter 06 §1.2). */
  readonly administers: boolean
}) {
  const manages = base.actions.includes('manage_schema')

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group/base relative">
            <div
              className={cn(
                'flex h-8 w-full items-center rounded-lg text-sm transition-colors hover:bg-sidebar-accent',
                current && 'font-medium',
              )}
            >
              <button
                type="button"
                onClick={onToggle}
                aria-label={expanded ? `Replier ${base.label}` : `Déplier ${base.label}`}
                aria-expanded={expanded}
                className="flex h-8 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <ChevronRight
                  className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
                />
              </button>
              <button
                type="button"
                onClick={onSelect}
                title={base.name}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 pr-1 text-left"
              >
                <LookIcon
                  look={base}
                  fallback={Database}
                  className={current ? 'text-foreground' : 'text-muted-foreground'}
                />
                <span className="truncate">{base.label}</span>
              </button>
              {/* The environment one works in, and where one changes it (chapter 14). */}
              {family.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Environnement de ${base.label} : ${base.environment.label}`}
                      title="Changer d’environnement"
                      className="flex shrink-0 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <EnvironmentBadge environment={base.environment} className="cursor-pointer" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Environnements de {base.label}
                    </DropdownMenuLabel>
                    {family.map((env) => (
                      <DropdownMenuItem key={env.id} onSelect={() => onEnvironment(env)}>
                        <EnvironmentBadge environment={env.environment} />
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {env.name}
                        </span>
                        {env.name === base.name && <Check className="size-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                    {manages && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onDialog('environments')}>
                          <GitCompareArrows className="size-4" />
                          Comparer les environnements…
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* What agents proposed and awaits a decision: said where one looks, not buried. */}
              {base.openProposals > 0 && (
                <button
                  type="button"
                  onClick={() => onDialog('proposals')}
                  title={`${base.openProposals} proposition${base.openProposals > 1 ? 's' : ''} d’agent en attente`}
                  aria-label={`Propositions en attente sur ${base.label} : ${base.openProposals}`}
                  className="ml-1 flex h-5 min-w-5 shrink-0 items-center justify-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 text-[0.7rem] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                >
                  <Bot className="size-3" />
                  {base.openProposals}
                </button>
              )}
              <span className="w-7 shrink-0" aria-hidden />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions sur la base ${base.label}`}
                  className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/base:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Ellipsis className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <BaseMenuEntries
                  kit={DROPDOWN_KIT}
                  base={base}
                  busy={busy}
                  administers={administers}
                  onIntent={onIntent}
                  onDialog={onDialog}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <BaseMenuEntries
            kit={CONTEXT_KIT}
            base={base}
            busy={busy}
            administers={administers}
            onIntent={onIntent}
            onDialog={onDialog}
          />
        </ContextMenuContent>
      </ContextMenu>

      {expanded && (
        <div className="ml-3 space-y-0.5 border-l pl-2">
          {tables.map((t) => (
            <TableRow
              key={t.id}
              table={t}
              active={activeTable === t.name}
              administers={administers}
              onIntent={(intent) => onTable(t.name, intent)}
            />
          ))}
          {tables.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {manages ? (
                <button
                  type="button"
                  onClick={() => onIntent('new-table')}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Créer la première table
                </button>
              ) : (
                'Aucune table.'
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The bases, in the reduced column: one icon that opens the list of every table, grouped
 * by base.
 *
 * One icon per table would be a column of identical glyphs, told apart only by hovering
 * each in turn — the list says which is which at a glance, and ticks the one open.
 */
function BasesMenu({
  bases,
  activeTable,
  disabled,
  canCreateBase,
  onOpen,
  onNewBase,
}: {
  readonly bases: readonly ProjectBase[]
  readonly activeTable: { readonly base: string; readonly table: string } | null
  readonly disabled: boolean
  readonly canCreateBase: boolean
  readonly onOpen: (base: string, table: string) => void
  readonly onNewBase: () => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Bases et tables"
              className={cn(
                'flex h-9 w-full items-center justify-center rounded-lg transition-colors',
                'hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-40',
                activeTable !== null && 'bg-sidebar-accent',
              )}
            >
              <Table2
                className={cn(
                  'size-4',
                  activeTable !== null ? 'text-foreground' : 'text-muted-foreground',
                )}
              />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">Bases et tables</TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="right" align="start" className="max-h-[70vh] w-64 overflow-y-auto">
        {bases.map((b, index) => (
          <div key={b.id}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-2">
              <LookIcon look={b} fallback={Database} className="size-3.5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{b.label}</span>
              {!b.environment.production && <EnvironmentBadge environment={b.environment} />}
            </DropdownMenuLabel>
            {b.tables.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => onOpen(b.name, t.name)}>
                <LookIcon look={t} fallback={Table2} />
                <span className="min-w-0 flex-1 truncate">{t.label}</span>
                {activeTable?.base === b.name && activeTable.table === t.name && (
                  <Check className="size-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            {b.tables.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">Aucune table.</div>
            )}
          </div>
        ))}
        {bases.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucune base.</div>
        )}
        {canCreateBase && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onNewBase}>
              <Plus className="size-4" />
              Nouvelle base
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * A table in the tree, and what can be done to it.
 *
 * Right-click opens the menu; a « ⋯ » on hover opens the same entries for anyone who looks
 * for them with the left button, and for a touch screen, which has no right-click. The
 * click itself still opens the table: the menu is an addition to the most frequent
 * gesture, never a replacement.
 *
 * « Supprimer » leads to the same confirmation as the structure screen — the table is
 * renamed, not destroyed, and the dialog says so — and « Importer » to the assistant that
 * the grid's toolbar also opens: a verb reachable only from a menu is one nobody finds.
 */
function TableRow({
  table,
  active,
  administers,
  onIntent,
}: {
  readonly table: ProjectBase['tables'][number]
  readonly active: boolean
  readonly administers: boolean
  readonly onIntent: (intent: TableIntent) => void
}) {
  // Offered only to whoever may: importing writes rows, deleting changes the structure.
  const imports = table.actions.includes('create')
  const manages = table.actions.includes('manage_schema')

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/table relative">
          <Item
            icon={Table2}
            look={table}
            label={table.label}
            hint={table.name}
            active={active}
            onClick={() => onIntent('open')}
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
              <DropdownMenuItem onSelect={() => onIntent('open')}>
                <FolderOpen className="size-4" />
                Ouvrir
              </DropdownMenuItem>
              {imports && (
                <DropdownMenuItem onSelect={() => onIntent('import')}>
                  <Upload className="size-4" />
                  Importer…
                </DropdownMenuItem>
              )}
              {manages && (
                <>
                  <DropdownMenuItem onSelect={() => onIntent('edit')}>
                    <Pencil className="size-4" />
                    Modifier la table…
                  </DropdownMenuItem>
                  {administers && (
                    <DropdownMenuItem onSelect={() => onIntent('rename-physical')}>
                      <CodeXml className="size-4" />
                      Renommer en base…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onIntent('delete')}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Supprimer la table
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => onIntent('open')}>
          <FolderOpen className="size-4" />
          Ouvrir
        </ContextMenuItem>
        {imports && (
          <ContextMenuItem onSelect={() => onIntent('import')}>
            <Upload className="size-4" />
            Importer…
          </ContextMenuItem>
        )}
        {manages && (
          <>
            <ContextMenuItem onSelect={() => onIntent('edit')}>
              <Pencil className="size-4" />
              Modifier la table…
            </ContextMenuItem>
            {administers && (
              <ContextMenuItem onSelect={() => onIntent('rename-physical')}>
                <CodeXml className="size-4" />
                Renommer en base…
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onIntent('delete')}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 text-destructive" />
              Supprimer la table
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function Item({
  icon: Icon,
  look,
  label,
  hint,
  active = false,
  disabled = false,
  onClick,
}: {
  readonly icon: LucideIcon
  /** A look of its own — a table's —, worn instead of the plain glyph. */
  readonly look?: OptionLook
  readonly label: string
  readonly hint?: string
  readonly active?: boolean
  readonly disabled?: boolean
  readonly onClick?: () => void
}) {
  const compact = useContext(Compact)

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={compact ? undefined : hint}
      aria-label={compact ? label : undefined}
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-sm transition-colors',
        'hover:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-40',
        compact && 'h-9 justify-center px-0',
        active ? 'bg-sidebar-accent font-medium' : 'font-normal',
      )}
    >
      <LookIcon
        look={look ?? {}}
        fallback={Icon}
        className={active ? 'text-foreground' : 'text-muted-foreground'}
      />
      {!compact && <span className="truncate">{label}</span>}
    </button>
  )

  if (!compact) return button

  // The tooltip hangs on a wrapper: a disabled button raises no pointer events, and the icon
  // of a section that is not there yet would otherwise never say what it is.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
