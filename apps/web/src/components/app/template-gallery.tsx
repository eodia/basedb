'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ApiError,
  type Me,
  type TemplateCatalog,
  type TemplateDraft,
  type TemplateItem,
  type TemplateSource,
  api,
} from '@/lib/api/client'
import { copy, download } from '@/lib/export'
import { $t, $tp } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { optionIcon } from '@/lib/option-icons'
import { aiFieldsOf, applyTemplate } from '@/lib/templates'
import { cn } from '@/lib/utils'
import { KIND_INFO } from '@/lib/views'
import { type Template, labelKey } from '@basedb/contracts'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileJson,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Sigma,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * The gallery of base templates — chapter 20, chapter 11 §5.5. What the instance offers
 * (its own, the public site's, the carried ones), and what the AI proposes from a
 * sentence; each read whole before a base is built from it, through the public routes.
 */

type Selected =
  | {
      readonly kind: 'catalog'
      readonly key: string
      readonly source: TemplateSource
      readonly template: Template
    }
  | { readonly kind: 'draft'; readonly draft: TemplateDraft }

const ALL = '__tous'
const MINE = '__instance'
const AI = '__ia'

const SOURCE_LABELS: Readonly<Record<TemplateSource, string>> = {
  instance: $t('Modèle de l’instance'),
  site: $t('Catalogue du site'),
  bundled: $t('Intégré'),
}

function TemplateIcon({
  icon,
  color,
  className,
}: { icon?: string | null; color?: string | null; className?: string }) {
  const Icon = optionIcon(icon)?.Icon ?? LayoutGrid
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg text-white',
        className,
      )}
      style={{ backgroundColor: color ?? '#64748b' }}
    >
      <Icon className="size-5" />
    </span>
  )
}

/**
 * A template's card in the reader's language. The official templates are written in
 * French, and their catalog of messages holds each label, summary and tag; a template of
 * the instance, written by someone, reads as written.
 */
function localized<
  T extends {
    label: string
    summary: string
    category?: string | null
    tags: readonly string[]
    description?: string
  },
>(template: T): T {
  return {
    ...template,
    label: $t(template.label),
    summary: $t(template.summary),
    ...(typeof template.category === 'string' ? { category: $t(template.category) } : {}),
    ...(typeof template.description === 'string' ? { description: $t(template.description) } : {}),
    tags: template.tags.map((tag) => $t(tag)),
  }
}

function localizedCatalog(catalog: TemplateCatalog): TemplateCatalog {
  return { ...catalog, templates: catalog.templates.map(localized) }
}

function countsLine(counts: TemplateItem['counts']): string {
  return [
    $tp(counts.tables, '{count} table', '{count} tables'),
    $tp(counts.rows, '{count} ligne', '{count} lignes'),
    $tp(counts.views, '{count} vue', '{count} vues'),
  ].join(' · ')
}

function summaryOf(template: Template): TemplateItem['counts'] {
  return {
    tables: template.tables.length,
    fields: template.tables.reduce((n, t) => n + t.fields.length, 0),
    rows: Object.values(template.rows).reduce((n, r) => n + r.length, 0),
    views: template.views.length,
    dashboards: template.dashboards.length,
    automations: template.automations.length,
    ai_fields: template.tables.reduce(
      (n, t) => n + t.fields.filter((f) => f.ai !== undefined).length,
      0,
    ),
  }
}

export function TemplateGallery({
  open,
  project,
  me,
  initialKey,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly project: { readonly id: string; readonly label: string }
  readonly me: Me
  /** Opens on this template, read whole — the demonstration, say. */
  readonly initialKey?: string | null
  readonly onClose: () => void
  /** Receives the logical name of the base built. */
  readonly onDone: (name: string) => void
}) {
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [category, setCategory] = useState(ALL)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Selected | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [importing, setImporting] = useState(false)
  const [building, setBuilding] = useState(false)

  const load = useCallback(async () => {
    try {
      setCatalog(localizedCatalog(await api.templates()))
      setCatalogError(null)
    } catch (e) {
      setCatalogError(messageFor(e))
    }
  }, [])

  const openTemplate = useCallback(async (key: string) => {
    setOpening(key)
    try {
      const { template, source } = await api.template(key)
      setSelected({ kind: 'catalog', key, source, template: localized(template) })
    } catch (e) {
      toast.error(messageFor(e))
    } finally {
      setOpening(null)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setSearch('')
    setCategory(ALL)
    setDraftError(null)
    void load()
    if (initialKey !== undefined && initialKey !== null) void openTemplate(initialKey)
  }, [open, initialKey, load, openTemplate])

  // The AI takes its time: a clock says it has not forgotten.
  useEffect(() => {
    if (!drafting) return
    setElapsed(0)
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [drafting])

  const propose = async (request: string, previous?: Template) => {
    if (request.trim() === '') return
    setDrafting(true)
    setDraftError(null)
    try {
      const draft = await api.draftTemplate({
        project: project.id,
        request: request.trim(),
        ...(previous === undefined ? {} : { previous }),
      })
      setSelected({ kind: 'draft', draft })
      setCategory(AI)
    } catch (e) {
      setDraftError(messageFor(e))
    } finally {
      setDrafting(false)
    }
  }

  const categories = useMemo(() => {
    const found = new Map<string, number>()
    for (const t of catalog?.templates ?? []) {
      const c = t.category ?? $t('Autres')
      found.set(c, (found.get(c) ?? 0) + 1)
    }
    return [...found.entries()].sort(([a], [b]) =>
      a === 'Démonstration' ? -1 : b === 'Démonstration' ? 1 : a.localeCompare(b),
    )
  }, [catalog])

  const shown = useMemo(() => {
    const needle = labelKey(search)
    return (catalog?.templates ?? []).filter((t) => {
      if (category === MINE && t.source !== 'instance') return false
      if (
        category !== ALL &&
        category !== MINE &&
        category !== AI &&
        (t.category ?? $t('Autres')) !== category
      )
        return false
      if (needle === '') return true
      return labelKey([t.label, t.summary, t.category ?? '', ...t.tags].join(' ')).includes(needle)
    })
  }, [catalog, category, search])

  const mine = (catalog?.templates ?? []).filter((t) => t.source === 'instance').length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !building && onClose()}>
      <DialogContent className="flex h-[88vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle>{$t('Partir d’un modèle')}</DialogTitle>
              <DialogDescription>
                {$t(
                  'Une base prête à l’emploi dans « {label} » : tables, lignes d’exemple, vues, tableaux de bord et automatisations.',
                  { label: project.label },
                )}
              </DialogDescription>
            </div>
            <div className="relative w-60">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  if (selected !== null && selected.kind === 'catalog') setSelected(null)
                }}
                placeholder={$t('Rechercher un modèle')}
                aria-label={$t('Rechercher un modèle')}
                className="h-9 pl-8"
              />
            </div>
            {me.isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setImporting(true)}
              >
                <Upload className="size-4" />
                {$t('Importer un JSON')}
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* The sentence to the AI. */}
        <div className="border-b bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent px-6 py-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void propose(prompt)
            }}
          >
            <Sparkles className="size-5 shrink-0 text-violet-600" />
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={$t(
                'Décrivez ce que vous voulez gérer : « les réclamations de mes clients, avec une analyse du ton »',
              )}
              aria-label={$t('Décrire le besoin à l’IA')}
              disabled={drafting}
              className="h-9 flex-1 bg-background"
            />
            <Button type="submit" disabled={drafting || prompt.trim() === ''} className="gap-1.5">
              {drafting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {drafting
                ? $t('Proposition en cours… {elapsed} s', { elapsed })
                : $t('Proposer avec l’IA')}
            </Button>
          </form>
          {draftError !== null && (
            <p className="mt-1.5 pl-7 text-sm text-destructive">{draftError}</p>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          <nav
            className="w-52 shrink-0 space-y-0.5 overflow-y-auto border-r p-3 scroll-discret"
            aria-label={$t('Catégories')}
          >
            <NavItem
              active={category === ALL}
              onClick={() => {
                setCategory(ALL)
                setSelected(null)
              }}
              count={catalog?.templates.length}
            >
              {$t('Tous les modèles')}
            </NavItem>
            {selected?.kind === 'draft' && (
              <NavItem
                active={category === AI}
                onClick={() => setCategory(AI)}
                icon={<Sparkles className="size-3.5 text-violet-600" />}
              >
                {$t('Proposé par l’IA')}
              </NavItem>
            )}
            {mine > 0 && (
              <NavItem
                active={category === MINE}
                onClick={() => {
                  setCategory(MINE)
                  setSelected(null)
                }}
                count={mine}
                icon={<Server className="size-3.5" />}
              >
                {$t('De l’instance')}
              </NavItem>
            )}
            <p className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">
              {$t('Catégories')}
            </p>
            {categories.map(([name, n]) => (
              <NavItem
                key={name}
                active={category === name}
                onClick={() => {
                  setCategory(name)
                  setSelected(null)
                }}
                count={n}
              >
                {name}
              </NavItem>
            ))}
            {catalog?.site != null && (
              <p className="px-2 pt-4 text-[11px] leading-snug text-muted-foreground">
                <Globe className="mr-1 inline size-3" />
                {catalog.site.error === null
                  ? $t('Catalogue du site public à jour.')
                  : $t('Le site public ne répond pas : modèles intégrés.')}
              </p>
            )}
          </nav>

          <main className="min-w-0 flex-1 overflow-y-auto scroll-discret">
            {selected !== null && (selected.kind === 'catalog' || category === AI) ? (
              <TemplateDetail
                selected={selected}
                project={project}
                me={me}
                drafting={drafting}
                onBack={() => {
                  setSelected(null)
                  if (category === AI) setCategory(ALL)
                }}
                onRefine={(request) =>
                  selected.kind === 'draft' && void propose(request, selected.draft.template)
                }
                onBuilding={setBuilding}
                onRemoved={() => {
                  setSelected(null)
                  void load()
                }}
                onSaved={() => void load()}
                onDone={onDone}
              />
            ) : catalogError !== null ? (
              <p className="p-10 text-center text-sm text-destructive">{catalogError}</p>
            ) : catalog === null ? (
              <div className="flex justify-center p-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : shown.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                {$t('Aucun modèle ne correspond. Décrivez votre besoin à l’IA, en haut.')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((t) => (
                  <TemplateCard
                    key={t.key}
                    item={t}
                    busy={opening === t.key}
                    onOpen={() => void openTemplate(t.key)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>

        <ImportDialog
          open={importing}
          onClose={() => setImporting(false)}
          onDone={(key) => {
            setImporting(false)
            void load().then(() => openTemplate(key))
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function NavItem({
  active,
  onClick,
  count,
  icon,
  children,
}: {
  readonly active: boolean
  readonly onClick: () => void
  readonly count?: number
  readonly icon?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/60',
        active && 'bg-accent font-medium',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
    </button>
  )
}

function TemplateCard({
  item,
  busy,
  onOpen,
}: { readonly item: TemplateItem; readonly busy: boolean; readonly onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      aria-label={$t('Modèle {label}', { label: item.label })}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <TemplateIcon icon={item.icon} color={item.color} />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{item.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.category ?? $t('Autres')}</p>
        </div>
        {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {item.counts.ai_fields > 0 && (
          <Badge className="border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Sparkles />
            {$t('IA')}
          </Badge>
        )}
        {item.source === 'instance' && (
          <Badge variant="outline">
            <Server />
            {$t('Instance')}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{countsLine(item.counts)}</span>
      </div>
    </button>
  )
}

function Section({
  title,
  icon,
  children,
}: { readonly title: string; readonly icon: ReactNode; readonly children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function TemplateDetail({
  selected,
  project,
  me,
  drafting,
  onBack,
  onRefine,
  onBuilding,
  onRemoved,
  onSaved,
  onDone,
}: {
  readonly selected: Selected
  readonly project: { readonly id: string; readonly label: string }
  readonly me: Me
  readonly drafting: boolean
  readonly onBack: () => void
  readonly onRefine: (request: string) => void
  readonly onBuilding: (busy: boolean) => void
  readonly onRemoved: () => void
  readonly onSaved: () => void
  readonly onDone: (name: string) => void
}) {
  const template = selected.kind === 'catalog' ? selected.template : selected.draft.template
  const counts = summaryOf(template)
  const aiFields = aiFieldsOf(template)
  const tableLabel = (key: string) => template.tables.find((t) => t.key === key)?.label ?? key

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 space-y-6 p-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            {$t('Tous les modèles')}
          </Button>
          <div className="mt-2 flex items-start gap-4">
            <TemplateIcon
              icon={template.icon}
              color={template.color ?? '#8b5cf6'}
              className="size-12"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold leading-tight">{template.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{template.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.kind === 'draft' ? (
                  <Badge className="border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300">
                    <Sparkles />
                    {$t('Proposé par l’IA')}
                  </Badge>
                ) : (
                  <Badge variant="outline">{SOURCE_LABELS[selected.source]}</Badge>
                )}
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          {template.description !== undefined && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed">{template.description}</p>
          )}
        </div>

        {selected.kind === 'draft' && (
          <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
            {selected.draft.explanation !== '' && (
              <p className="text-sm">{selected.draft.explanation}</p>
            )}
            {selected.draft.issues.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  {$tp(
                    selected.draft.issues.length,
                    '{count} élément retiré de la proposition, qui ne tenait pas',
                    '{count} éléments retirés de la proposition, qui ne tenaient pas',
                  )}
                </summary>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {selected.draft.issues.slice(0, 20).map((issue) => (
                    <li key={`${issue.path}:${issue.message}`}>
                      <code>{issue.path}</code> — {issue.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Refine drafting={drafting} onRefine={onRefine} />
          </div>
        )}

        <Section
          title={$tp(counts.tables, '{count} table', '{count} tables')}
          icon={<LayoutGrid className="size-4 text-muted-foreground" />}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {template.tables.map((table) => {
              const tableLinks = template.links.filter((l) => l.from === table.key)
              const rows = template.rows[table.key]?.length ?? 0
              return (
                <div key={table.key} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <TemplateIcon
                      icon={table.icon}
                      color={table.color ?? '#64748b'}
                      className="size-7 rounded-md [&>svg]:size-4"
                    />
                    <p className="font-medium">{table.label}</p>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {$tp(rows, '{count} ligne', '{count} lignes')}
                    </span>
                  </div>
                  {table.description !== undefined && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{table.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {table.fields.map((field) => (
                      <span
                        key={field.label}
                        title={field.ai?.prompt ?? field.formula ?? field.description}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
                          field.ai !== undefined &&
                            'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200',
                        )}
                      >
                        {field.ai !== undefined ? (
                          <Sparkles className="size-3 text-violet-600" />
                        ) : ['formula', 'lookup', 'rollup', 'count'].includes(field.kind) ? (
                          <Sigma className="size-3 text-muted-foreground" />
                        ) : (
                          <FieldIcon
                            kind={field.kind}
                            format={field.rich === true ? 'html' : field.format?.display}
                            className="size-3"
                          />
                        )}
                        {field.label}
                      </span>
                    ))}
                    {tableLinks.map((link) => (
                      <span
                        key={link.label}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-xs"
                      >
                        <Link2 className="size-3 text-muted-foreground" />
                        {link.label} → {tableLabel(link.to)}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {aiFields.length > 0 && (
          <Section
            title={$t('Ce que l’IA calcule')}
            icon={<Sparkles className="size-4 text-violet-600" />}
          >
            <ul className="space-y-2">
              {aiFields.map((f) => (
                <li
                  key={`${f.table}:${f.field}`}
                  className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-sm"
                >
                  <p className="font-medium">
                    {f.table} › {f.field}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                    {f.prompt}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {template.views.length > 0 && (
          <Section
            title={$tp(template.views.length, '{count} vue', '{count} vues')}
            icon={<LayoutGrid className="size-4 text-muted-foreground" />}
          >
            <div className="flex flex-wrap gap-2">
              {template.views.map((view) => {
                const Icon = KIND_INFO[view.kind].icon
                return (
                  <span
                    key={`${view.table}:${view.label}`}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm"
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    {view.label}
                    <span className="text-xs text-muted-foreground">
                      {KIND_INFO[view.kind].label} · {tableLabel(view.table)}
                    </span>
                  </span>
                )
              })}
            </div>
          </Section>
        )}

        {(template.dashboards.length > 0 || template.automations.length > 0) && (
          <div className="grid gap-6 lg:grid-cols-2">
            {template.dashboards.length > 0 && (
              <Section
                title={$t('Tableaux de bord')}
                icon={<LayoutDashboard className="size-4 text-muted-foreground" />}
              >
                <ul className="space-y-1 text-sm">
                  {template.dashboards.map((d) => (
                    <li key={d.label}>
                      {d.label}{' '}
                      <span className="text-xs text-muted-foreground">
                        — {$tp(d.blocks.length, '{count} bloc', '{count} blocs')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {template.automations.length > 0 && (
              <Section
                title={$t('Automatisations')}
                icon={<Zap className="size-4 text-muted-foreground" />}
              >
                <ul className="space-y-1 text-sm">
                  {template.automations.map((a) => (
                    <li key={a.label}>
                      {a.label}
                      {a.description !== undefined && (
                        <span className="text-xs text-muted-foreground"> — {a.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>

      <CreatePanel
        template={template}
        selected={selected}
        project={project}
        me={me}
        aiCount={aiFields.length}
        onBuilding={onBuilding}
        onRemoved={onRemoved}
        onSaved={onSaved}
        onDone={onDone}
      />
    </div>
  )
}

function Refine({
  drafting,
  onRefine,
}: { readonly drafting: boolean; readonly onRefine: (request: string) => void }) {
  const [text, setText] = useState('')
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim() !== '') onRefine(text)
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={$t(
          'Affiner : « ajoute une table des fournisseurs », « moins de colonnes », « des exemples pour un restaurant »…',
        )}
        aria-label={$t('Affiner la proposition')}
        rows={2}
        disabled={drafting}
        className="min-h-0 flex-1 resize-none bg-background text-sm"
      />
      <Button
        type="submit"
        variant="outline"
        disabled={drafting || text.trim() === ''}
        className="gap-1.5"
      >
        {drafting ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {$t('Affiner')}
      </Button>
    </form>
  )
}

function CreatePanel({
  template,
  selected,
  project,
  me,
  aiCount,
  onBuilding,
  onRemoved,
  onSaved,
  onDone,
}: {
  readonly template: Template
  readonly selected: Selected
  readonly project: { readonly id: string; readonly label: string }
  readonly me: Me
  readonly aiCount: number
  readonly onBuilding: (busy: boolean) => void
  readonly onRemoved: () => void
  readonly onSaved: () => void
  readonly onDone: (name: string) => void
}) {
  const [label, setLabel] = useState(template.base.label)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [built, setBuilt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const stepsEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLabel(template.base.label)
    setSteps([])
    setError(null)
    setBuilt(null)
  }, [template])

  const json = () => JSON.stringify(template, null, 2)

  const create = async () => {
    setBusy(true)
    onBuilding(true)
    setError(null)
    setSteps([$t('Base…')])
    let name: string | null = null
    try {
      const created = await api.createBase(label.trim(), template.base.description, project.id)
      name = created.name
      const report = await applyTemplate(template, created.name, {
        onStep: (step) => {
          setSteps((previous) => [...previous, step])
          requestAnimationFrame(() => stepsEnd.current?.scrollIntoView({ block: 'nearest' }))
        },
        aiConsent: consent,
        me: me.id,
      })
      toast.success($t('Base « {label} » créée', { label: label.trim() }), {
        description: report.warnings.length > 0 ? report.warnings.join(' ') : undefined,
      })
      onDone(created.name)
    } catch (e) {
      setError(
        name === null
          ? messageFor(e)
          : $t('La base est créée, mais incomplète : {e}', { e: messageFor(e) }),
      )
      setBuilt(name)
    } finally {
      setBusy(false)
      onBuilding(false)
    }
  }

  return (
    <aside className="sticky top-0 flex h-full max-h-full w-80 shrink-0 flex-col gap-4 self-start border-l bg-muted/20 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="template-base-label">{$t('Libellé de la base')}</Label>
        <Input
          id="template-base-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={busy}
        />
      </div>

      {aiCount > 0 && (
        <div className="space-y-2 rounded-lg border border-violet-500/30 bg-background p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="size-4 text-violet-600" />
            {$tp(aiCount, '{count} champ calculé par l’IA', '{count} champs calculés par l’IA')}
          </p>
          <label
            htmlFor="template-ai-consent"
            className="flex items-start gap-2 text-xs leading-snug"
          >
            <Checkbox
              id="template-ai-consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              disabled={busy}
              className="mt-0.5"
            />
            {$t(
              'J’accepte que les valeurs citées par leurs consignes soient envoyées au fournisseur d’IA de l’instance. Sans cet accord, ce seront des champs ordinaires, avec leurs valeurs d’exemple.',
            )}
          </label>
        </div>
      )}

      <Button
        onClick={() => void create()}
        disabled={busy || label.trim() === ''}
        className="gap-1.5"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        {busy ? $t('Construction…') : $t('Créer la base')}
      </Button>

      {steps.length > 0 && (
        <div
          className="max-h-48 overflow-y-auto rounded-md border bg-background p-2 text-xs scroll-discret"
          aria-live="polite"
        >
          {steps.map((step, index) => (
            <p
              key={`${index}:${step}`}
              className={cn(
                'flex items-center gap-1.5 py-0.5',
                index < steps.length - 1 || !busy ? 'text-muted-foreground' : 'font-medium',
              )}
            >
              {index < steps.length - 1 || !busy ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Loader2 className="size-3 animate-spin" />
              )}
              {step}
            </p>
          ))}
          <div ref={stepsEnd} />
        </div>
      )}
      {error !== null && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          {built !== null && (
            <Button variant="outline" size="sm" onClick={() => onDone(built)}>
              {$t('Ouvrir la base incomplète')}
            </Button>
          )}
        </div>
      )}

      <div className="mt-auto space-y-2 border-t pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileJson className="size-3.5" />
          {$t('Le modèle en JSON')}
        </p>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={async () => {
              if (await copy(json())) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {$t('Copier')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => download('json', json(), template.key)}
          >
            <Download className="size-3.5" />
            {$t('Télécharger')}
          </Button>
        </div>
        {me.isAdmin && selected.kind === 'draft' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5"
            onClick={async () => {
              try {
                await api.importTemplate(template)
                toast.success($t('Ajouté au catalogue de l’instance'))
                onSaved()
              } catch (e) {
                toast.error(messageFor(e))
              }
            }}
          >
            <Server className="size-3.5" />
            {$t('Ajouter au catalogue de l’instance')}
          </Button>
        )}
        {me.isAdmin && selected.kind === 'catalog' && selected.source === 'instance' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-destructive hover:text-destructive"
            onClick={async () => {
              try {
                await api.deleteTemplate(selected.key)
                toast.success($t('Retiré du catalogue de l’instance'))
                onRemoved()
              } catch (e) {
                toast.error(messageFor(e))
              }
            }}
          >
            <Trash2 className="size-3.5" />
            {$t('Retirer de l’instance')}
          </Button>
        )}
      </div>
    </aside>
  )
}

/** An administrator's import: a JSON pasted or read from a file, checked by the server. */
function ImportDialog({
  open,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onDone: (key: string) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<ReadonlyArray<{ path: string; message: string }>>([])
  useEffect(() => {
    if (!open) return
    setText('')
    setError(null)
    setIssues([])
  }, [open])

  const submit = async () => {
    setError(null)
    setIssues([])
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      setError($t('Ce n’est pas du JSON valide.'))
      return
    }
    setBusy(true)
    try {
      const imported = await api.importTemplate(raw)
      toast.success($t('« {label} » ajouté au catalogue de l’instance', { label: imported.label }))
      onDone(imported.key)
    } catch (e) {
      setError(messageFor(e))
      if (e instanceof ApiError && Array.isArray(e.details.issues)) {
        setIssues(e.details.issues as Array<{ path: string; message: string }>)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{$t('Importer un modèle')}</DialogTitle>
          <DialogDescription>
            {$t(
              'Un modèle au format JSON du chapitre 20 — exporté d’une base, proposé par l’IA ou écrit à la main. Il rejoint la galerie de toute l’instance ; un modèle de même clé est remplacé.',
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "format": 1, "key": "mon-modele", "label": "…", "tables": [ … ] }'
          aria-label={$t('JSON du modèle')}
          rows={12}
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer gap-1.5">
              <FileJson className="size-4" />
              {$t('Lire un fichier')}
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file !== undefined) setText(await file.text())
                }}
              />
            </label>
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || text.trim() === ''}
            className="gap-1.5"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {$t('Importer')}
          </Button>
        </div>
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        {issues.length > 0 && (
          <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-muted-foreground">
            {issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>
                <code>{issue.path || '(racine)'}</code> — {issue.message}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
