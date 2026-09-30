'use client'

import { FieldRulesDialog } from '@/components/app/admin/field-rules-dialog'
import { RowRulesDialog } from '@/components/app/admin/row-rules-dialog'
import { cancelled, useElevated } from '@/components/app/elevation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Hint } from '@/components/ui/tooltip'
import {
  type AccessCell,
  type AccessGraph,
  type AccessLevel,
  type Group,
  api,
} from '@/lib/api/client'
import { $t, groupName } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  Columns3,
  Database,
  FolderKanban,
  Loader2,
  Lock,
  type LucideIcon,
  Rows3,
  Table2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * The permission grid, over projects, bases and tables.
 *
 * One group at a time, chosen on the left; on the right, every project, base and table of
 * the tenant with the level that group has there. A level flows down: « Lecture » on a
 * project reads every table of every base in it, those created later included. Giving a
 * table less than its base makes the base « Granulaire »: its tables are then set one by
 * one. A change applies at once — there is no draft to save and forget.
 *
 * Rights add up across groups: a person gets the highest level any of their groups gives.
 * Which is why « Tous les utilisateurs » should give little — whatever it gives, nobody
 * can be kept from.
 */

type Level = AccessLevel | 'granular'

const LEVELS: ReadonlyArray<{ id: AccessLevel; label: string; hint: string }> = [
  { id: 'none', label: $t('Aucun accès'), hint: $t('Invisible') },
  { id: 'read', label: $t('Lecture'), hint: $t('Voir les lignes') },
  { id: 'edit', label: $t('Édition'), hint: $t('Créer, modifier, supprimer des lignes') },
  { id: 'manage', label: $t('Gestion'), hint: $t('Et changer la structure, créer des jetons') },
]

const DOT: Readonly<Record<Level, string>> = {
  none: 'bg-muted-foreground/35',
  read: 'bg-sky-500',
  edit: 'bg-emerald-500',
  manage: 'bg-violet-500',
  granular: 'bg-amber-500',
}

const LABEL: Readonly<Record<Level, string>> = {
  none: $t('Aucun accès'),
  read: $t('Lecture'),
  edit: $t('Édition'),
  manage: $t('Gestion'),
  granular: $t('Granulaire'),
}

type Scope = { readonly kind: 'project' | 'base' | 'table'; readonly id: string }

export function PermissionsTab({
  focusProject,
  onChanged,
}: {
  readonly focusProject: string | null
  readonly onChanged: () => void
}) {
  const elevated = useElevated()
  const [graph, setGraph] = useState<AccessGraph | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldsOf, setFieldsOf] = useState<{ id: string; label: string } | null>(null)
  const [rowsOf, setRowsOf] = useState<{ id: string; label: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const loaded = await api.access()
      const first =
        loaded.groups.find((g) => g.system === 'everyone')?.id ??
        loaded.groups.find((g) => g.system !== 'admins')?.id ??
        loaded.groups[0]?.id ??
        null
      setGraph(loaded)
      setGroupId(first)
      setExpanded(unfolded(loaded, first, focusProject))
    } catch (e) {
      setError(messageFor(e))
    }
  }, [focusProject])

  useEffect(() => {
    void load()
  }, [load])

  const group = graph?.groups.find((g) => g.id === groupId) ?? null
  const cells = useMemo(
    () => (graph === null || groupId === null ? {} : (graph.cells[groupId] ?? {})),
    [graph, groupId],
  )

  const toggle = (key: string) =>
    setExpanded((was) => {
      const next = new Set(was)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const set = async (scope: Scope, level: AccessLevel) => {
    if (groupId === null) return
    const key = `${scope.kind}:${scope.id}`
    setSaving(key)
    setError(null)
    try {
      const next = await elevated(() => api.setAccess([{ group: groupId, scope, level }]))
      setGraph(next)
      // A base set to less than its project is now granular: show what that means.
      if (scope.kind === 'table') {
        for (const project of next.projects) {
          const base = project.bases.find((b) => b.tables.some((t) => t.id === scope.id))
          if (base !== undefined) setExpanded((was) => new Set([...was, `base:${base.id}`]))
        }
      }
      onChanged()
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setSaving(null)
    }
  }

  const locked = group?.system === 'admins'

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <div>
        <h1 className="text-lg font-semibold">{$t('Permissions')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {$t(
            'Le niveau accordé à un groupe sur un projet vaut pour toutes ses bases et toutes leurs tables, y compris celles créées plus tard. Les droits s’additionnent : une personne reçoit le niveau le plus élevé que lui donne l’un de ses groupes. Sous une table, « Champs » masque une colonne à un groupe ou la rend non modifiable pour lui, et « Lignes » ne lui montre que certaines lignes.',
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {LEVELS.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', DOT[l.id])} />
            <span className="text-foreground">{l.label}</span> — {l.hint}
          </span>
        ))}
      </div>

      {error !== null && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {graph === null ? (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
          <GroupList
            groups={graph.groups}
            selected={groupId}
            onSelect={(id) => {
              setGroupId(id)
              setExpanded(unfolded(graph, id, focusProject))
            }}
          />

          <section className="min-w-0 overflow-hidden rounded-lg border">
            <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
              <span className="text-sm font-semibold">{group?.label ?? '—'}</span>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">{$t('Accès aux données')}</span>
            </header>

            {locked && (
              <p className="flex items-center gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" />
                {$t(
                  'Les administrateurs ont tous les droits, partout : leur niveau ne se règle pas.',
                )}
              </p>
            )}
            {group?.system === 'everyone' && (
              <p className="border-b bg-amber-500/5 px-4 py-2.5 text-xs text-muted-foreground">
                {$t(
                  'Ce que reçoit « Tous les utilisateurs », chaque compte l’a, quels que soient ses autres groupes. Pour réserver un accès, accordez-le plutôt à un groupe dédié.',
                )}
              </p>
            )}

            <ul>
              {graph.projects.map((project) => {
                const pKey = `project:${project.id}`
                const pOpen = expanded.has(pKey)
                return (
                  <li key={project.id}>
                    <Row
                      depth={0}
                      icon={FolderKanban}
                      label={project.label}
                      strong
                      open={project.bases.length > 0 ? pOpen : undefined}
                      onToggle={() => toggle(pKey)}
                      cell={cells[pKey]}
                      locked={locked}
                      saving={saving === pKey}
                      onLevel={(level) => void set({ kind: 'project', id: project.id }, level)}
                    />
                    {pOpen &&
                      project.bases.map((base) => {
                        const bKey = `base:${base.id}`
                        const bOpen = expanded.has(bKey)
                        return (
                          <div key={base.id}>
                            <Row
                              depth={1}
                              icon={Database}
                              label={base.label}
                              hint={base.name}
                              open={base.tables.length > 0 ? bOpen : undefined}
                              onToggle={() => toggle(bKey)}
                              cell={cells[bKey]}
                              locked={locked}
                              saving={saving === bKey}
                              onLevel={(level) => void set({ kind: 'base', id: base.id }, level)}
                            />
                            {bOpen &&
                              base.tables.map((table) => {
                                const tKey = `table:${table.id}`
                                return (
                                  <Row
                                    key={table.id}
                                    depth={2}
                                    icon={Table2}
                                    label={table.label}
                                    hint={table.name}
                                    cell={cells[tKey]}
                                    locked={locked}
                                    saving={saving === tKey}
                                    onLevel={(level) =>
                                      void set({ kind: 'table', id: table.id }, level)
                                    }
                                    onFields={() =>
                                      setFieldsOf({ id: table.id, label: table.label })
                                    }
                                    onRows={() => setRowsOf({ id: table.id, label: table.label })}
                                  />
                                )
                              })}
                          </div>
                        )
                      })}
                    {pOpen && project.bases.length === 0 && (
                      <p className="border-b py-2 pr-4 pl-12 text-xs text-muted-foreground">
                        {$t('Aucune base dans ce projet.')}
                      </p>
                    )}
                  </li>
                )
              })}
              {graph.projects.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {$t('Aucun projet.')}
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      <FieldRulesDialog table={fieldsOf} onClose={() => setFieldsOf(null)} />
      <RowRulesDialog table={rowsOf} onClose={() => setRowsOf(null)} />
    </div>
  )
}

/**
 * What is unfolded on arrival and on a change of group: the project being browsed (all of
 * them when there are few), and every base whose tables are set one by one — a
 * « Granulaire » that hides what it means would be a riddle.
 */
function unfolded(
  graph: AccessGraph,
  groupId: string | null,
  focusProject: string | null,
): ReadonlySet<string> {
  const cells = groupId === null ? {} : (graph.cells[groupId] ?? {})
  const open = new Set<string>()
  for (const project of graph.projects) {
    if (focusProject === null || project.id === focusProject || graph.projects.length <= 3) {
      open.add(`project:${project.id}`)
    }
    for (const base of project.bases) {
      if (cells[`base:${base.id}`]?.level === 'granular') {
        open.add(`project:${project.id}`)
        open.add(`base:${base.id}`)
      }
    }
  }
  return open
}

function GroupList({
  groups,
  selected,
  onSelect,
}: {
  readonly groups: readonly Group[]
  readonly selected: string | null
  readonly onSelect: (id: string) => void
}) {
  return (
    <ul className="h-fit overflow-hidden rounded-lg border">
      {groups.map((g) => (
        <li key={g.id} className="border-b last:border-b-0">
          <button
            type="button"
            onClick={() => onSelect(g.id)}
            aria-current={g.id === selected ? 'true' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60',
              g.id === selected && 'bg-accent font-medium',
            )}
          >
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{groupName(g.label)}</span>
            {g.system === 'admins' && <Lock className="size-3 text-muted-foreground" />}
            <span className="text-xs tabular-nums text-muted-foreground">{g.member_count}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** One node of the tree: its name, and the level the group has on it. */
function Row({
  depth,
  icon: Icon,
  label,
  hint,
  strong = false,
  open,
  onToggle,
  cell,
  locked,
  saving,
  onLevel,
  onFields,
  onRows,
}: {
  readonly depth: 0 | 1 | 2
  readonly icon: LucideIcon
  readonly label: string
  readonly hint?: string
  readonly strong?: boolean
  /** `undefined` for a node with nothing under it: no chevron. */
  readonly open?: boolean
  readonly onToggle?: () => void
  readonly cell: AccessCell | undefined
  readonly locked: boolean
  readonly saving: boolean
  readonly onLevel: (level: AccessLevel) => void
  /** A table's fields, group by group: offered on table rows only. */
  readonly onFields?: () => void
  /** A table's rows, group by group: offered on table rows only. */
  readonly onRows?: () => void
}) {
  const level: Level = cell?.level ?? 'none'
  const inherited = cell !== undefined && !cell.direct && level !== 'none' && level !== 'granular'

  return (
    <div
      className="flex min-h-11 items-center gap-2 border-b pr-3 hover:bg-accent/30"
      style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}
    >
      {open === undefined ? (
        <span className="size-5 shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? $t('Replier {label}', { label }) : $t('Déplier {label}', { label })}
          aria-expanded={open}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
      )}
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <Hint label={hint}>
        <span className={cn('min-w-0 flex-1 truncate text-sm', strong && 'font-medium')}>
          {label}
        </span>
      </Hint>

      {inherited && <span className="text-[11px] text-muted-foreground">{$t('hérité')}</span>}
      {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      {onFields !== undefined && (
        <button
          type="button"
          onClick={onFields}
          aria-label={$t('Droits des champs de {label}', { label })}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Columns3 className="size-3.5" />
          {$t('Champs')}
        </button>
      )}
      {onRows !== undefined && (
        <button
          type="button"
          onClick={onRows}
          aria-label={$t('Droits des lignes de {label}', { label })}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Rows3 className="size-3.5" />
          {$t('Lignes')}
        </button>
      )}

      <Select
        value={level}
        onValueChange={(value) => value !== 'granular' && onLevel(value as AccessLevel)}
        disabled={locked || saving}
      >
        <SelectTrigger
          className="h-8 w-40 shrink-0 text-xs"
          aria-label={$t('Niveau sur {label}', { label })}
        >
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', DOT[level])} />
              {LABEL[level]}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {LEVELS.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              <span className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', DOT[l.id])} />
                <span>{l.label}</span>
              </span>
            </SelectItem>
          ))}
          {level === 'granular' && (
            <SelectItem value="granular" disabled>
              <span className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', DOT.granular)} />
                {$t('Granulaire')}
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
