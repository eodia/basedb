'use client'

import type { Row } from '@/components/app/grid/cell'
import { MarkdownView } from '@/components/app/markdown-text'
import { SidebarToggle } from '@/components/app/sidebar'
import { CardValue } from '@/components/app/views/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  ApiError,
  type Dashboard,
  type DashboardBlock,
  type DescribedBase,
  type Field,
  type Table,
  api,
} from '@/lib/api/client'
import { chartSlices, emptyBlock, numberText } from '@/lib/dashboards'
import { MembersProvider, memberName, useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Hash,
  LayoutDashboard,
  List,
  Loader2,
  PanelTop,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Type,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

/**
 * The dashboards of a base — chapter 18, on screen. Each block reads through the ordinary
 * routes with the rights of whoever looks: a block citing what they cannot read says so
 * and shows nothing. Whoever builds the base arranges them.
 */

const KINDS: ReadonlyArray<{ kind: DashboardBlock['kind']; label: string; icon: typeof Hash }> = [
  { kind: 'number', label: 'Chiffre', icon: Hash },
  { kind: 'chart', label: 'Graphique', icon: BarChart3 },
  { kind: 'list', label: 'Liste', icon: List },
  { kind: 'text', label: 'Texte', icon: Type },
  { kind: 'embed', label: 'Page intégrée', icon: PanelTop },
]

const WIDTH = { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3' } as const

export function DashboardsPanel({
  base,
  onBack,
}: {
  readonly base: DescribedBase
  readonly onBack: () => void
}) {
  return (
    <MembersProvider>
      <Panel base={base} onBack={onBack} />
    </MembersProvider>
  )
}

function Panel({ base, onBack }: { readonly base: DescribedBase; readonly onBack: () => void }) {
  const builds = base.actions.includes('manage_schema')
  const [dashboards, setDashboards] = useState<readonly Dashboard[] | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState<{ index: number | null; block: DashboardBlock } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await api.dashboards(base.name)
      setDashboards(list)
      setError(null)
      return list
    } catch (e) {
      setError(messageFor(e))
      return null
    }
  }, [base.name])

  useEffect(() => {
    setActive(null)
    setEditing(false)
    void load().then((list) => setActive(list?.[0]?.id ?? null))
  }, [load])

  const dashboard = dashboards?.find((d) => d.id === active) ?? null

  const save = async (blocks: readonly DashboardBlock[], label?: string) => {
    if (dashboard === null) return
    try {
      await api.updateDashboard(base.name, dashboard.id, {
        blocks,
        ...(label === undefined ? {} : { label }),
      })
      await load()
      setError(null)
    } catch (e) {
      setError(messageFor(e))
    }
  }

  const create = async () => {
    try {
      const created = await api.createDashboard(base.name, {
        label: `Tableau de bord ${(dashboards?.length ?? 0) + 1}`,
        blocks: [],
      })
      await load()
      setActive(created.id)
      setEditing(true)
    } catch (e) {
      setError(messageFor(e))
    }
  }

  const remove = async () => {
    if (dashboard === null) return
    try {
      await api.deleteDashboard(base.name, dashboard.id)
      const list = await load()
      setActive(list?.[0]?.id ?? null)
      setEditing(false)
    } catch (e) {
      setError(messageFor(e))
    }
  }

  const blocks = dashboard?.blocks ?? []
  const move = (index: number, step: number) => {
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    if (moved === undefined) return
    next.splice(Math.max(0, Math.min(next.length, index + step)), 0, moved)
    void save(next)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Interfaces</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onBack}>
          Retour aux données
        </Button>
      </header>
      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
        {dashboards?.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActive(d.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm',
              d.id === active
                ? 'bg-accent font-medium'
                : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            <LayoutDashboard className="size-3.5" />
            {d.label}
          </button>
        ))}
        {builds && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => void create()}
          >
            <Plus className="size-3.5" />
            Nouveau tableau de bord
          </Button>
        )}
        <div className="flex-1" />
        {builds && dashboard !== null && (
          <Button
            variant={editing ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => setEditing((e) => !e)}
          >
            <Pencil className="size-3.5" />
            {editing ? 'Terminer' : 'Modifier'}
          </Button>
        )}
      </div>
      <main className="min-h-0 flex-1 overflow-y-auto bg-muted/20 scroll-discret">
        {error !== null && <p className="m-4 text-sm text-destructive">{error}</p>}
        {dashboards === null && error === null && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {dashboards !== null && dashboards.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
            <LayoutDashboard className="size-8" />
            <p className="max-w-sm">
              {builds
                ? 'Aucun tableau de bord. Rassemblez sur une page les chiffres, graphiques et listes que chacun consulte.'
                : 'Aucun tableau de bord dans cette base.'}
            </p>
            {builds && (
              <Button size="sm" onClick={() => void create()}>
                Créer un tableau de bord
              </Button>
            )}
          </div>
        )}
        {dashboard !== null && (
          <div className="mx-auto max-w-6xl space-y-4 p-6">
            {editing && (
              <div className="flex items-center gap-2">
                <Input
                  defaultValue={dashboard.label}
                  key={dashboard.id}
                  onBlur={(e) => {
                    const label = e.target.value.trim()
                    if (label !== '' && label !== dashboard.label)
                      void save(dashboard.blocks, label)
                  }}
                  aria-label="Nom du tableau de bord"
                  className="h-8 max-w-sm font-medium"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => void remove()}
                >
                  Supprimer le tableau
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {blocks.map((block, index) => (
                <section
                  key={`${index}:${block.kind}:${block.title}`}
                  className={cn(
                    'flex min-h-32 flex-col rounded-xl border bg-background shadow-xs',
                    WIDTH[(block.width as 1 | 2 | 3) ?? 1] ?? WIDTH[1],
                  )}
                >
                  <header className="flex items-center gap-1 px-4 pt-3">
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {block.title || KINDS.find((k) => k.kind === block.kind)?.label}
                    </h3>
                    {editing && (
                      <>
                        <select
                          value={block.width}
                          onChange={(e) => {
                            const width = Number(e.target.value)
                            void save(blocks.map((b, i) => (i === index ? { ...b, width } : b)))
                          }}
                          aria-label="Largeur du bloc"
                          className="h-7 rounded border bg-transparent px-1 text-xs"
                        >
                          <option value={1}>1 colonne</option>
                          <option value={2}>2 colonnes</option>
                          <option value={3}>3 colonnes</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => move(index, -1)}
                          aria-label="Avancer le bloc"
                        >
                          <ArrowLeft className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => move(index, 1)}
                          aria-label="Reculer le bloc"
                        >
                          <ArrowRight className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDialog({ index, block })}
                          aria-label="Régler le bloc"
                        >
                          <Settings2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void save(blocks.filter((_, i) => i !== index))}
                          aria-label="Retirer le bloc"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </header>
                  <div className="min-h-0 flex-1 px-4 pt-2 pb-4">
                    <BlockView block={block} base={base} />
                  </div>
                </section>
              ))}
              {editing && (
                <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4">
                  <p className="text-xs text-muted-foreground">Ajouter un bloc</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {KINDS.map((k) => (
                      <Button
                        key={k.kind}
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setDialog({ index: null, block: emptyBlock(k.kind, base) })}
                      >
                        <k.icon className="size-3.5" />
                        {k.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!editing && blocks.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Ce tableau de bord est vide.
              </p>
            )}
          </div>
        )}
      </main>
      {dialog !== null && (
        <BlockDialog
          base={base}
          block={dialog.block}
          onClose={() => setDialog(null)}
          onSave={async (block) => {
            const next =
              dialog.index === null
                ? [...blocks, block]
                : blocks.map((b, i) => (i === dialog.index ? block : b))
            await save(next)
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

/** A block, read with the rights of whoever looks. */
function BlockView({
  block,
  base,
}: { readonly block: DashboardBlock; readonly base: DescribedBase }) {
  if (block.kind === 'text') {
    return block.body === '' ? (
      <p className="text-sm text-muted-foreground">Texte vide.</p>
    ) : (
      <MarkdownView source={block.body} className="text-sm" />
    )
  }
  if (block.kind === 'embed') {
    return (
      <iframe
        src={block.url}
        title={block.title || 'Page intégrée'}
        // A page from elsewhere: its scripts run, but in an origin of its own, with nothing
        // of basedb — no session, no data (chapter 18 §2).
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        loading="lazy"
        className="w-full rounded-md border"
        style={{ height: block.height }}
      />
    )
  }
  const table = base.tables.find((t) => t.id === block.table)
  if (table === undefined) return <Inaccessible />
  if (block.kind === 'number') return <NumberBlock block={block} table={table} />
  if (block.kind === 'chart') return <ChartBlock block={block} table={table} />
  return <ListBlock block={block} table={table} base={base} />
}

function Inaccessible() {
  return <p className="text-sm text-muted-foreground">Donnée inaccessible.</p>
}

/** Loads what a block reads; a refusal is « inaccessible », never an error page. */
function useBlockData<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ data: T | null; refused: boolean; error: string | null }>({
    data: null,
    refused: false,
    error: null,
  })
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says what the block reads
  useEffect(() => {
    let current = true
    setState({ data: null, refused: false, error: null })
    load()
      .then((data) => current && setState({ data, refused: false, error: null }))
      .catch((e) => {
        if (!current) return
        const refused =
          e instanceof ApiError &&
          (e.status === 404 || e.status === 403 || e.code.includes('UNKNOWN'))
        setState({ data: null, refused, error: refused ? null : messageFor(e) })
      })
    return () => {
      current = false
    }
  }, [key])
  return state
}

function NumberBlock({
  block,
  table,
}: {
  readonly block: Extract<DashboardBlock, { kind: 'number' }>
  readonly table: Table
}) {
  const state = useBlockData(
    () =>
      api.aggregate(table, {
        filter: block.filter,
        aggregates: block.field === null ? [] : [{ field: block.field, fn: block.aggregate }],
      }),
    JSON.stringify(block),
  )
  if (state.refused) return <Inaccessible />
  if (state.error !== null) return <p className="text-sm text-destructive">{state.error}</p>
  if (state.data === null) return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  const field = table.fields.find((f) => f.name === block.field)
  return (
    <div>
      <p className="text-4xl font-semibold tabular-nums">{numberText(block, state.data, field)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {table.label}
        {block.filter !== '' && ' · filtré'}
      </p>
    </div>
  )
}

function ChartBlock({
  block,
  table,
}: {
  readonly block: Extract<DashboardBlock, { kind: 'chart' }>
  readonly table: Table
}) {
  const members = useMembers()
  const state = useBlockData(
    () => api.aggregate(table, { filter: block.filter, aggregates: [], group: block.group_by }),
    JSON.stringify(block),
  )
  if (state.refused) return <Inaccessible />
  if (state.error !== null) return <p className="text-sm text-destructive">{state.error}</p>
  if (state.data === null) return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  const field = table.fields.find((f) => f.name === block.group_by)
  const slices = chartSlices(state.data.groups ?? [], field, (id) => memberName(members, id))
  if (slices.length === 0) return <p className="text-sm text-muted-foreground">Aucune ligne.</p>
  if (block.style === 'pie') return <Pie slices={slices} />
  const max = Math.max(...slices.map((s) => s.count))
  return (
    <div className="space-y-1.5">
      {slices.map((s) => (
        <div
          key={s.label}
          className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-2 text-xs"
        >
          <span className="truncate" title={s.label}>
            {s.label}
          </span>
          <span className="h-4 rounded-sm bg-muted">
            <span
              className="block h-full rounded-sm"
              style={{ width: `${Math.max(2, (s.count / max) * 100)}%`, backgroundColor: s.color }}
            />
          </span>
          <span className="tabular-nums text-muted-foreground">{s.count}</span>
        </div>
      ))}
    </div>
  )
}

function Pie({ slices }: { readonly slices: ReturnType<typeof chartSlices> }) {
  const total = slices.reduce((sum, s) => sum + s.count, 0)
  let angle = -Math.PI / 2
  const arcs = slices.map((s) => {
    const sweep = (s.count / total) * Math.PI * 2
    const start = angle
    angle += sweep
    const large = sweep > Math.PI ? 1 : 0
    const [x1, y1] = [50 + 45 * Math.cos(start), 50 + 45 * Math.sin(start)]
    const [x2, y2] = [50 + 45 * Math.cos(angle), 50 + 45 * Math.sin(angle)]
    const d =
      slices.length === 1
        ? 'M50,5 A45,45 0 1 1 49.99,5 Z'
        : `M50,50 L${x1},${y1} A45,45 0 ${large} 1 ${x2},${y2} Z`
    return { ...s, d }
  })
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="size-32 shrink-0" role="img" aria-label="Répartition">
        {arcs.map((a) => (
          <path key={a.label} d={a.d} fill={a.color} stroke="white" strokeWidth={0.8} />
        ))}
      </svg>
      <ul className="min-w-0 space-y-1 text-xs">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="truncate">{s.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {s.count} · {Math.round((s.count / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ListBlock({
  block,
  table,
  base,
}: {
  readonly block: Extract<DashboardBlock, { kind: 'list' }>
  readonly table: Table
  readonly base: DescribedBase
}) {
  const requestRecord = useWorkspace((s) => s.requestRecord)
  const state = useBlockData(
    () => api.list(table, { filter: block.filter, sort: block.sort, limit: block.limit }),
    JSON.stringify(block),
  )
  if (state.refused) return <Inaccessible />
  if (state.error !== null) return <p className="text-sm text-destructive">{state.error}</p>
  if (state.data === null) return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  const fields = block.fields
    .map((name) => table.fields.find((f) => f.name === name))
    .filter((f): f is Field => f !== undefined)
  const rows = state.data.data as Row[]
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune ligne.</p>
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {fields.map((f) => (
              <th key={f.name} className="px-4 py-1.5 font-medium">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row._id}
              onClick={() => requestRecord({ base: base.name, table: table.name, id: row._id })}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  requestRecord({ base: base.name, table: table.name, id: row._id })
              }}
              tabIndex={0}
              className="cursor-pointer border-b last:border-b-0 hover:bg-muted/40"
            >
              {fields.map((f) => (
                <td key={f.name} className="max-w-56 truncate px-4 py-1.5">
                  <CardValue field={f} row={row} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Labeled({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** The settings of a block: what it reads and how it shows it. */
function BlockDialog({
  base,
  block,
  onClose,
  onSave,
}: {
  readonly base: DescribedBase
  readonly block: DashboardBlock
  readonly onClose: () => void
  readonly onSave: (block: DashboardBlock) => Promise<void>
}) {
  const [draft, setDraft] = useState<DashboardBlock>(block)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<DashboardBlock>) =>
    setDraft((d) => ({ ...d, ...patch }) as DashboardBlock)
  const table = 'table' in draft ? base.tables.find((t) => t.id === draft.table) : undefined
  const fields = (table?.fields ?? []).filter((f) => f.kind !== 'button')

  const tableSelect = 'table' in draft && (
    <Labeled label="Table">
      <Select
        value={draft.table}
        onValueChange={(v) => set({ table: v } as Partial<DashboardBlock>)}
      >
        <SelectTrigger aria-label="Table du bloc" className="h-8">
          <SelectValue placeholder="Choisir une table" />
        </SelectTrigger>
        <SelectContent>
          {base.tables.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Labeled>
  )
  const filterInput = 'filter' in draft && (
    <Labeled label="Filtre">
      <Input
        value={draft.filter}
        onChange={(e) => set({ filter: e.target.value } as Partial<DashboardBlock>)}
        placeholder='statut eq "fait" (facultatif)'
        aria-label="Filtre du bloc"
        className="h-8 font-mono text-xs"
      />
    </Labeled>
  )
  const fieldSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    only?: (f: Field) => boolean,
  ) => (
    <Select value={value === '' ? undefined : value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-8">
        <SelectValue placeholder="Choisir un champ" />
      </SelectTrigger>
      <SelectContent>
        {fields
          .filter((f) => only === undefined || only(f))
          .map((f) => (
            <SelectItem key={f.name} value={f.name}>
              {f.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{KINDS.find((k) => k.kind === draft.kind)?.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Labeled label="Titre">
            <Input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              aria-label="Titre du bloc"
              className="h-8"
              maxLength={120}
            />
          </Labeled>
          {tableSelect}
          {draft.kind === 'number' && (
            <>
              <Labeled label="Calcul">
                <Select
                  value={draft.aggregate}
                  onValueChange={(v) =>
                    set({
                      aggregate: v as 'count',
                      field: v === 'count' ? null : draft.field,
                    } as Partial<DashboardBlock>)
                  }
                >
                  <SelectTrigger aria-label="Calcul" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Nombre de lignes</SelectItem>
                    <SelectItem value="sum">Somme</SelectItem>
                    <SelectItem value="avg">Moyenne</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                  </SelectContent>
                </Select>
              </Labeled>
              {draft.aggregate !== 'count' && (
                <Labeled label="Champ">
                  {fieldSelect(
                    draft.field ?? '',
                    (v) => set({ field: v } as Partial<DashboardBlock>),
                    'Champ calculé',
                    (f) =>
                      [
                        'number',
                        'rollup',
                        'count',
                        'formula',
                        'date',
                        'datetime',
                        'autonumber',
                      ].includes(f.kind),
                  )}
                </Labeled>
              )}
              {filterInput}
            </>
          )}
          {draft.kind === 'chart' && (
            <>
              <Labeled label="Par">
                {fieldSelect(
                  draft.group_by,
                  (v) => set({ group_by: v } as Partial<DashboardBlock>),
                  'Regroupement',
                  (f) => ['select', 'user', 'boolean', 'link', 'short_text'].includes(f.kind),
                )}
              </Labeled>
              <Labeled label="Style">
                <div className="flex gap-1">
                  {(['bar', 'pie'] as const).map((style) => (
                    <Button
                      key={style}
                      variant={draft.style === style ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => set({ style } as Partial<DashboardBlock>)}
                    >
                      {style === 'bar' ? 'Barres' : 'Secteurs'}
                    </Button>
                  ))}
                </div>
              </Labeled>
              {filterInput}
            </>
          )}
          {draft.kind === 'list' && (
            <>
              <Labeled label="Champs">
                <div className="flex flex-wrap gap-1">
                  {fields.map((f) => {
                    const on = draft.fields.includes(f.name)
                    return (
                      <button
                        key={f.name}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && draft.fields.length >= 6}
                        onClick={() =>
                          set({
                            fields: on
                              ? draft.fields.filter((n) => n !== f.name)
                              : [...draft.fields, f.name],
                          } as Partial<DashboardBlock>)
                        }
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-xs disabled:opacity-40',
                          on
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </Labeled>
              <Labeled label="Tri">
                <Input
                  value={draft.sort}
                  onChange={(e) => set({ sort: e.target.value } as Partial<DashboardBlock>)}
                  placeholder="-_created_at"
                  aria-label="Tri du bloc"
                  className="h-8 font-mono text-xs"
                />
              </Labeled>
              <Labeled label="Lignes">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.limit}
                  onChange={(e) =>
                    set({ limit: Number(e.target.value) } as Partial<DashboardBlock>)
                  }
                  aria-label="Nombre de lignes"
                  className="h-8 w-24"
                />
              </Labeled>
              {filterInput}
            </>
          )}
          {draft.kind === 'text' && (
            <Textarea
              value={draft.body}
              onChange={(e) => set({ body: e.target.value } as Partial<DashboardBlock>)}
              placeholder="Markdown : # Titre, **gras**, listes…"
              aria-label="Texte du bloc"
              rows={8}
              className="font-mono text-xs"
            />
          )}
          {draft.kind === 'embed' && (
            <>
              <Labeled label="Adresse">
                <Input
                  value={draft.url}
                  onChange={(e) => set({ url: e.target.value } as Partial<DashboardBlock>)}
                  aria-label="Adresse de la page"
                  className="h-8 font-mono text-xs"
                />
              </Labeled>
              <Labeled label="Hauteur">
                <Input
                  type="number"
                  min={200}
                  max={1200}
                  value={draft.height}
                  onChange={(e) =>
                    set({ height: Number(e.target.value) } as Partial<DashboardBlock>)
                  }
                  aria-label="Hauteur en pixels"
                  className="h-8 w-28"
                />
              </Labeled>
              <p className="text-xs text-muted-foreground">
                Une page <code>https</code>, affichée dans un cadre isolé : elle ne reçoit ni votre
                session ni les données de la base.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onSave(draft)
              setBusy(false)
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
