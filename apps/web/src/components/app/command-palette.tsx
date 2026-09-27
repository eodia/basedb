'use client'

import type { AdminTab } from '@/components/app/admin/admin-panel'
import { VIZ_ICONS } from '@/components/app/analytics/viz-settings'
import { FieldIcon, KIND_LABELS } from '@/components/app/field-icon'
import { LookIcon } from '@/components/app/option-badge'
import type { SettingsTab } from '@/components/app/settings/settings-panel'
import type { BaseIntent, Section, TableIntent } from '@/components/app/sidebar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { type Place, placeOf } from '@/lib/address-bar'
import {
  type Automation,
  type Dashboard,
  type DescribedBase,
  type Field,
  type Me,
  type Project,
  type ProjectBase,
  type Question,
  type SavedView,
  type Table,
  api,
} from '@/lib/api/client'
import { displayStored, isDateKind } from '@/lib/dates'
import { quoteLiteral } from '@/lib/expression'
import { formatNumber } from '@/lib/format'
import { searchClause } from '@/lib/grid'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { htmlToPlain } from '@/lib/rich-text'
import {
  MATCH,
  type Prepared,
  UUID,
  type Visit,
  excerpt,
  fold,
  frecency,
  highlights,
  looksLikeQuestion,
  prepare,
  remember,
  runsOf,
  scoreOf,
  scoreToken,
  tokensOf,
  visits,
} from '@/lib/search'
import { usePalette } from '@/lib/store/palette'
import { useSidebar } from '@/lib/store/sidebar'
import { type Tab, useWorkspace } from '@/lib/store/workspace'
import { type ThemePreference, useTheme } from '@/lib/theme'
import { redo, undo, useJournal } from '@/lib/undo'
import { cn } from '@/lib/utils'
import { KIND_INFO } from '@/lib/views'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Copy,
  CornerDownLeft,
  Database,
  Eye,
  FileCode2,
  FolderKanban,
  FolderPlus,
  History,
  Keyboard,
  Layers,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  type LucideIcon,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Puzzle,
  Redo2,
  RefreshCw,
  Rows3,
  Search,
  Settings,
  Shield,
  Sparkles,
  SquareTerminal,
  Sun,
  Table2,
  Terminal,
  Undo2,
  Upload,
  Users,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { toast } from 'sonner'

/**
 * The command palette — Ctrl+K, or the search field of the top bar.
 *
 * One field for everything the screen can reach: the projects, bases, tables, SQL views,
 * saved queries, saved views, questions, dashboards and automations the reader sees; the
 * columns of their tables; the ROWS themselves, read through the API with the reader's own
 * rights; and every command of the application — create, go to, close, undo, change the
 * theme. What is typed is matched without accents nor case, by word starts, initials and
 * slips (`lib/search.ts`); what was opened often and lately comes first.
 *
 * It reads a few things more than the screen does: when it opens, the dashboards, questions
 * and automations of the project's bases, and the saved views of the current base's
 * tables — each at most every two minutes. The rows are asked for as one types, a few per
 * table, once the typing pauses.
 *
 * Prefixes narrow it, as in an editor: `>` the commands, `#` the tables and other objects,
 * `/` the rows, `?` a question to the copilot. Tab on a table or a base searches INSIDE
 * it: its rows, its views, its columns. A text that reads as a question is offered to the
 * copilot first; an address of the application pasted is followed.
 */

// ── What is searched ─────────────────────────────────────────────────────────────

/** Searching inside one base, or one table — Tab on it. */
type Scope =
  | { readonly kind: 'base'; readonly base: string; readonly label: string }
  | {
      readonly kind: 'table'
      readonly base: string
      readonly table: string
      readonly label: string
    }

/** What the palette lists: everything, or one kind. */
type Filter = 'all' | 'objects' | 'rows' | 'commands' | 'ask'

const PREFIXES: Readonly<Record<string, Filter>> = {
  '>': 'commands',
  '#': 'objects',
  '/': 'rows',
  '?': 'ask',
}

const FILTERS: ReadonlyArray<{
  readonly id: Filter
  readonly label: string
  readonly prefix: string | null
}> = [
  { id: 'all', label: $t('Tout'), prefix: null },
  { id: 'objects', label: $t('Tables et objets'), prefix: '#' },
  { id: 'rows', label: $t('Lignes'), prefix: '/' },
  { id: 'commands', label: $t('Commandes'), prefix: '>' },
  { id: 'ask', label: $t('Copilot'), prefix: '?' },
]

type Group =
  | 'link'
  | 'top'
  | 'ask'
  | 'recent'
  | 'tabs'
  | 'objects'
  | 'rows'
  | 'analytics'
  | 'automations'
  | 'fields'
  | 'places'
  | 'commands'
  | 'suggestions'
  | 'help'

const GROUP_TITLES: Readonly<Record<Group, string>> = {
  link: $t('Adresse'),
  top: $t('Meilleur résultat'),
  ask: $t('Copilot'),
  recent: $t('Récents'),
  tabs: $t('Onglets ouverts'),
  objects: $t('Tables et vues'),
  rows: $t('Lignes'),
  analytics: $t('Questions et tableaux de bord'),
  automations: $t('Automatisations'),
  fields: $t('Colonnes'),
  places: $t('Bases et projets'),
  commands: $t('Commandes'),
  suggestions: $t('Suggestions'),
  help: $t('Raccourcis clavier'),
}

/** The order the groups are drawn in, whatever their scores: a list that holds still. */
const GROUP_ORDER: readonly Group[] = [
  'link',
  'top',
  'recent',
  'tabs',
  'objects',
  'rows',
  'analytics',
  'automations',
  'fields',
  'places',
  'commands',
  'suggestions',
  'ask',
]

/** Which filter shows a group whole — what « N autres résultats » switches to. */
const FILTER_OF: Readonly<Partial<Record<Group, Filter>>> = {
  tabs: 'objects',
  objects: 'objects',
  analytics: 'objects',
  automations: 'objects',
  fields: 'objects',
  places: 'objects',
  rows: 'rows',
  commands: 'commands',
}

/** What the right-hand pane shows of the highlighted result. */
type Detail =
  | { readonly kind: 'row'; readonly table: Table; readonly row: Readonly<Record<string, unknown>> }
  | { readonly kind: 'table'; readonly base: string; readonly table: string }
  | { readonly kind: 'field'; readonly field: Field; readonly table: string }
  | { readonly kind: 'text'; readonly text: string | null }

interface Item {
  /** Stable across keystrokes: the highlight follows it, the memory keeps it. */
  readonly key: string
  readonly group: Group
  readonly title: string
  readonly subtitle?: string
  readonly icon: ReactNode
  readonly searchable: Prepared
  /** A mark on the right: « Ouvert », « Actif », an environment. */
  readonly badge?: string
  /** The key that does the same outside the palette. */
  readonly shortcut?: string
  /** The base it belongs to — ranked higher in the current one. */
  readonly base?: string
  /** The table it belongs to — what a table's scope keeps. */
  readonly table?: string
  /** Tab searches inside it. */
  readonly scope?: Scope
  /** Added to its score: a table before one of its columns. */
  readonly weight: number
  /** Where it leads — kept by the memory, for the rows the palette does not list. */
  readonly place?: Place
  /** False for what makes no sense to offer again among the recent ones. */
  readonly memorable: boolean
  /** A line under the title: where the text was found in a row. */
  readonly snippet?: {
    readonly label: string
    readonly text: string
    readonly lit: ReadonlySet<number>
  }
  readonly detail?: Detail
  /** Keeps the palette open — Tab into a scope, a filter chosen. */
  readonly stays?: boolean
  readonly run: () => void
}

interface Scored {
  readonly item: Item
  readonly score: number
}

/** A row found by the search, with the table that reads it. */
interface RowHit {
  readonly table: Table
  readonly row: Readonly<Record<string, unknown>>
}

/** What the palette reads of a base when it opens, beyond its description. */
interface BaseLists {
  readonly dashboards: readonly Dashboard[]
  readonly questions: readonly Question[]
  readonly automations: readonly Automation[]
}

interface TableView {
  readonly table: string
  readonly view: SavedView
}

const LISTS_TTL = 120_000
const listsCache = new Map<string, { readonly at: number; readonly promise: Promise<BaseLists> }>()
const viewsCache = new Map<
  string,
  { readonly at: number; readonly promise: Promise<readonly TableView[]> }
>()

/** A base's dashboards, questions and automations — each refused one is simply none. */
function listsOf(base: ProjectBase): Promise<BaseLists> {
  const cached = listsCache.get(base.name)
  if (cached !== undefined && Date.now() - cached.at < LISTS_TTL) return cached.promise
  const manages = base.actions.includes('manage_schema')
  const promise = Promise.allSettled([
    api.dashboards(base.name),
    api.questions(base.name),
    // Automations are read under `/admin`: asked only by whoever builds the base.
    manages ? api.automations(base.name) : Promise.resolve([] as readonly Automation[]),
  ]).then(([dashboards, questions, automations]) => ({
    dashboards: dashboards.status === 'fulfilled' ? dashboards.value : [],
    questions: questions.status === 'fulfilled' ? questions.value : [],
    automations: automations.status === 'fulfilled' ? automations.value : [],
  }))
  listsCache.set(base.name, { at: Date.now(), promise })
  return promise
}

/** The saved views of a base's tables — the reader's personal ones included. */
function viewsOf(base: ProjectBase): Promise<readonly TableView[]> {
  const cached = viewsCache.get(base.name)
  if (cached !== undefined && Date.now() - cached.at < LISTS_TTL) return cached.promise
  const promise = Promise.allSettled(
    base.tables.map((t) =>
      api
        .views({ base: base.name, name: t.name })
        .then((found) => found.map((view) => ({ table: t.name, view }))),
    ),
  ).then((all) => all.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
  viewsCache.set(base.name, { at: Date.now(), promise })
  return promise
}

/** What each kind of thing is called: typing « vue » lists the views, « auto » the automations. */
const KIND_WORDS = {
  project: $t('projet||mots-clés de recherche'),
  base: $t('base||mots-clés de recherche'),
  table: $t('table||mots-clés de recherche'),
  view: $t('vue||mots-clés de recherche'),
  sqlview: $t('vue sql||mots-clés de recherche'),
  query: $t('requête sql enregistrée||mots-clés de recherche'),
  field: $t('colonne champ||mots-clés de recherche'),
  dashboard: $t('tableau de bord||mots-clés de recherche'),
  question: $t('question graphique||mots-clés de recherche'),
  automation: $t('automatisation||mots-clés de recherche'),
} as const

/** How many tables the rows are looked for in at once, and how many rows each. */
const ROW_TABLES = 24
const ROWS_PER_TABLE = 3
const ROWS_IN_TABLE = 20
const ROWS_HINTED = 8

// ── What a row is called ─────────────────────────────────────────────────────────

const NUMBER = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 4 })

/** A value as a line of text — a choice by its label, a rich text without its tags. */
function valueText(value: unknown, field?: Field): string {
  if (value === null || value === undefined) return ''
  if (field !== undefined && (field.kind === 'select' || field.kind === 'multi_select')) {
    const labels = new Map((field.options ?? []).map((o) => [o.value, o.label]))
    const values = Array.isArray(value) ? value : [value]
    return values.map((v) => labels.get(String(v)) ?? String(v)).join(', ')
  }
  // A decimal comes as PostgreSQL writes it, `5000.0000000000`: read as its format says.
  if (field?.kind === 'number' && (typeof value === 'string' || typeof value === 'number')) {
    return formatNumber(String(value), field)
  }
  if (typeof value === 'string') {
    if (field?.unsafe_html === true) return htmlToPlain(value, 400)
    if (field !== undefined && isDateKind(field.kind)) return displayStored(value, field.kind)
    return value
  }
  if (typeof value === 'number') return NUMBER.format(value)
  if (typeof value === 'boolean') return value ? $t('Oui') : $t('Non')
  if (Array.isArray(value)) {
    return value
      .map((v) => valueText(v))
      .filter((t) => t !== '')
      .join(', ')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['display', 'label', 'name', 'filename', 'value']) {
      if (record[key] !== undefined && record[key] !== null) return valueText(record[key])
    }
  }
  return ''
}

/** The column a row is named by: its table's display column, else its first text. */
function titleField(table: Table): Field | undefined {
  const display = table.fields.find((f) => f.name === table.display_field)
  return (
    display ??
    table.fields.find((f) => f.system !== true && (f.kind === 'short_text' || f.kind === 'email'))
  )
}

function rowTitle(table: Table, row: Readonly<Record<string, unknown>>): string {
  const field = titleField(table)
  const text = field === undefined ? '' : valueText(row[field.name], field).trim()
  return text !== '' ? text : $t('Ligne {id}', { id: String(row._id).slice(0, 8) })
}

const SEARCHED_KINDS = ['short_text', 'long_text', 'url', 'email', 'select', 'multi_select']

/** The short values that tell a row from its neighbours: a status, an amount, a date. */
const SUMMARY_KINDS = ['select', 'number', 'date', 'datetime', 'short_text', 'email', 'boolean']

/** A few values of a row besides its title — what its line says under it. */
function summaryOf(table: Table, row: Readonly<Record<string, unknown>>): string[] {
  const named = titleField(table)?.name
  return table.fields
    .filter((f) => f.system !== true && f.name !== named && SUMMARY_KINDS.includes(f.kind))
    .flatMap((f) => {
      // A box unticked says nothing worth a place on the line.
      if (f.kind === 'boolean') return row[f.name] === true ? [f.label] : []
      const text = valueText(row[f.name], f).trim()
      return text === '' || text.length > 40 || UUID.test(text) ? [] : [text]
    })
    .slice(0, 3)
}

/** Where the text typed was found in a row, other than its title: that column, and a few words. */
function snippetOf(
  table: Table,
  row: Readonly<Record<string, unknown>>,
  tokens: readonly string[],
): Item['snippet'] {
  if (tokens.length === 0) return undefined
  // Found in its title already: the line under it says something else.
  const title = fold(rowTitle(table, row))
  if (tokens.every((t) => title.includes(t))) return undefined
  const named = titleField(table)?.name
  for (const field of table.fields) {
    if (field.system === true || field.name === named || !SEARCHED_KINDS.includes(field.kind)) {
      continue
    }
    const text = valueText(row[field.name], field)
    if (text === '') continue
    const folded = fold(text)
    if (tokens.some((t) => folded.includes(t))) {
      return { label: field.label, ...excerpt(text, tokens) }
    }
  }
  return undefined
}

// ── Keys, as this computer names them ────────────────────────────────────────────

const subscribeNothing = () => () => {}
/** ⌘ on a Mac, Ctrl elsewhere — read on the client only, where the platform is known. */
function useModKey(): string {
  return useSyncExternalStore(
    subscribeNothing,
    () => (/Mac|iPhone|iPad/u.test(navigator.userAgent) ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  )
}

function Kbd({
  children,
  className,
}: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5 rounded border bg-muted px-1 font-mono text-[0.65rem] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

// ── The field in the top bar ─────────────────────────────────────────────────────

/**
 * The search field of the top bar. It is the palette's door rather than a field of its own:
 * a click opens it, and a letter typed on it opens it with that letter — the field one
 * sees is the one one types in.
 */
export function SearchField({ className }: { readonly className?: string }) {
  const show = usePalette((s) => s.show)
  const mod = useModKey()
  return (
    <button
      type="button"
      onClick={() => show()}
      onKeyDown={(e) => {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.key === ' ') return
        e.preventDefault()
        show(e.key)
      }}
      aria-keyshortcuts="Control+K Meta+K"
      aria-label={$t('Rechercher partout')}
      className={cn(
        'group flex h-8 min-w-0 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:border-ring/40 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate text-left sm:block">
        {$t('Rechercher tables, lignes, commandes…')}
      </span>
      <span className="ml-auto hidden shrink-0 items-center gap-0.5 md:flex">
        <Kbd>{mod}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}

// ── The palette ──────────────────────────────────────────────────────────────────

interface Props {
  readonly me: Me
  readonly projects: readonly Project[]
  /** The project browsed — whose bases' dashboards and questions are read. */
  readonly project: Project | null
  /** The current base: its commands, its rows. */
  readonly base: DescribedBase | null
  /** Every base described so far: their columns are searched. */
  readonly described: Readonly<Record<string, DescribedBase>>
  readonly section: Section
  /** Describes a base the palette needs the columns of. */
  readonly describe: (name: string) => Promise<DescribedBase>
  /** Goes where an address would lead. */
  readonly onGo: (place: Place) => void
  /** Shows an open tab. */
  readonly onTab: (id: string) => void
  readonly onBase: (name: string, intent: BaseIntent) => void
  readonly onTable: (base: string, table: string, intent: TableIntent) => void
  readonly onNewProject: () => void
  readonly onNewBase: () => void
  readonly onGallery: (key: string | null) => void
  /** Puts a question to the copilot of a base. */
  readonly onAskCopilot: (base: string, text: string) => void
  readonly onSignOut: () => void
}

export function CommandPalette(props: Props) {
  const open = usePalette((s) => s.open)
  const opened = usePalette((s) => s.opened)
  const initial = usePalette((s) => s.initial)
  const hide = usePalette((s) => s.hide)
  const toggle = usePalette((s) => s.toggle)

  // Ctrl+K, anywhere — unless something under the focus took it first: the Markdown
  // editor makes a link with it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.shiftKey) return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && hide()}>
      {open && <Palette key={opened} {...props} initial={initial} onClose={hide} />}
    </Dialog>
  )
}

function Palette({
  me,
  projects,
  project,
  base,
  described,
  section,
  describe,
  onGo,
  onTab,
  onBase,
  onTable,
  onNewProject,
  onNewBase,
  onGallery,
  onAskCopilot,
  onSignOut,
  initial,
  onClose,
}: Props & { readonly initial: string; readonly onClose: () => void }) {
  const startFilter = PREFIXES[initial.charAt(0)]
  const [filter, setFilter] = useState<Filter>(startFilter ?? 'all')
  const [query, setQuery] = useState(startFilter === undefined ? initial : initial.slice(1))
  const [scope, setScope] = useState<Scope | null>(null)
  const [help, setHelp] = useState(false)
  /** The highlighted result, by key: it stays on it while the rows come in. */
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  /** An action ran: the focus is left to what it opened, not given back to the field. */
  const ran = useRef(false)
  const listId = useId()
  const mod = useModKey()

  const tabs = useWorkspace((s) => s.tabs)
  const activeId = useWorkspace((s) => s.activeId)
  const copilotOpen = useWorkspace((s) => s.copilotOpen)
  const preference = useTheme((s) => s.preference)
  const collapsed = useSidebar((s) => s.collapsed)
  const done = useJournal((s) => s.done)
  const undone = useJournal((s) => s.undone)
  const [memory] = useState<readonly Visit[]>(() => visits())

  const allBases = useMemo(() => projects.flatMap((p) => p.bases), [projects])
  const projectBaseOf = useMemo(() => new Map(allBases.map((b) => [b.name, b])), [allBases])
  const projectOf = useMemo(
    () => new Map(projects.flatMap((p) => p.bases.map((b) => [b.name, p] as const))),
    [projects],
  )

  /** The base the commands and the rows speak of: the one searched in, else the current one. */
  const targetName = scope?.base ?? base?.name ?? null
  const target = targetName === null ? null : (projectBaseOf.get(targetName) ?? null)
  const targetDescribed = targetName === null ? null : (described[targetName] ?? null)
  const activeTab = tabs.find((t) => t.id === activeId) ?? null

  // ── What is read when the palette opens ─────────────────────────────────────────

  const [lists, setLists] = useState<Readonly<Record<string, BaseLists>>>({})
  const [views, setViews] = useState<Readonly<Record<string, readonly TableView[]>>>({})

  // The project's bases: their dashboards, questions and automations, and their columns.
  const projectBases = project?.bases
  useEffect(() => {
    let stale = false
    for (const b of (projectBases ?? []).slice(0, 8)) {
      void listsOf(b).then((found) => {
        if (!stale) setLists((was) => ({ ...was, [b.name]: found }))
      })
    }
    return () => {
      stale = true
    }
  }, [projectBases])

  const describedRef = useRef(described)
  describedRef.current = described
  useEffect(() => {
    for (const b of (projectBases ?? []).slice(0, 8)) {
      if (describedRef.current[b.name] === undefined) void describe(b.name).catch(() => undefined)
    }
  }, [projectBases, describe])

  // The base searched in: its saved views, its lists, its columns — it may be of another project.
  useEffect(() => {
    if (target === null) return
    let stale = false
    void viewsOf(target).then((found) => {
      if (!stale) setViews((was) => ({ ...was, [target.name]: found }))
    })
    void listsOf(target).then((found) => {
      if (!stale) setLists((was) => ({ ...was, [target.name]: found }))
    })
    if (describedRef.current[target.name] === undefined) {
      void describe(target.name).catch(() => undefined)
    }
    return () => {
      stale = true
    }
  }, [target, describe])

  // ── The rows ────────────────────────────────────────────────────────────────────

  const [rows, setRows] = useState<{
    readonly hits: readonly RowHit[]
    readonly loading: boolean
  }>({ hits: [], loading: false })
  const tokens = useMemo(() => tokensOf(query), [query])
  const text = query.trim()
  const searchesRows = (filter === 'all' || filter === 'rows') && !help

  useEffect(() => {
    if (!searchesRows || targetDescribed === null) {
      setRows({ hits: [], loading: false })
      return
    }
    const tables = targetDescribed.tables
    const inTable = scope?.kind === 'table' ? tables.find((t) => t.name === scope.table) : undefined
    // Outside a table, a letter would bring back every row: two, at least.
    if (inTable === undefined && Array.from(text).length < 2) {
      setRows({ hits: [], loading: false })
      return
    }
    let stale = false
    setRows((was) => ({ ...was, loading: true }))
    const timer = window.setTimeout(() => {
      void findRows(tables, inTable, text).then((hits) => {
        if (!stale) setRows({ hits, loading: false })
      })
    }, 180)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [searchesRows, targetDescribed, scope, text])

  // ── Everything else, gathered once per change of what the screen knows ─────────────

  const go = useCallback(
    (place: Place) => () => {
      onGo(place)
    },
    [onGo],
  )

  const objects = useMemo(() => {
    const items: Item[] = []
    const openTables = new Set(
      tabs.filter((t) => t.kind === 'table').map((t) => `${t.base}.${t.table}`),
    )
    for (const p of projects) {
      items.push({
        key: `project:${p.id}`,
        group: 'places',
        title: p.label,
        subtitle: $tp(p.bases.length, 'Projet · {count} base', 'Projet · {count} bases'),
        icon: <LookIcon look={p} fallback={FolderKanban} />,
        searchable: prepare({
          title: p.label,
          keywords: `${KIND_WORDS.project} ${p.description ?? ''}`,
        }),
        weight: -4,
        place: { kind: 'project', project: p.id },
        memorable: true,
        detail: { kind: 'text', text: p.description },
        run: go({ kind: 'project', project: p.id }),
      })
      for (const b of p.bases) {
        const environment = b.environment.production ? undefined : b.environment.label
        items.push({
          key: `base:${b.name}`,
          group: 'places',
          title: b.label,
          subtitle: $t('Base · {project}', { project: p.label }),
          icon: <LookIcon look={b} fallback={Database} />,
          searchable: prepare({
            title: b.label,
            name: b.name,
            keywords: KIND_WORDS.base,
            context: p.label,
          }),
          ...(environment === undefined ? {} : { badge: environment }),
          base: b.name,
          scope: { kind: 'base', base: b.name, label: b.label },
          weight: 0,
          place: { kind: 'base', base: b.name },
          memorable: true,
          detail: { kind: 'text', text: b.description },
          run: go({ kind: 'base', base: b.name }),
        })
        const where = environment === undefined ? b.label : `${b.label} · ${environment}`
        for (const t of b.tables) {
          const place: Place = {
            kind: 'table',
            base: b.name,
            table: t.name,
            view: null,
            record: null,
          }
          items.push({
            key: `table:${b.name}.${t.name}`,
            group: 'objects',
            title: t.label,
            subtitle: $t('Table · {base}', { base: where }),
            icon: <LookIcon look={t} fallback={Table2} />,
            searchable: prepare({
              title: t.label,
              name: t.name,
              keywords: KIND_WORDS.table,
              context: `${b.label} ${p.label}`,
            }),
            ...(openTables.has(`${b.name}.${t.name}`) ? { badge: $t('Ouvert') } : {}),
            base: b.name,
            table: t.name,
            scope: { kind: 'table', base: b.name, table: t.name, label: t.label },
            weight: 6,
            place,
            memorable: true,
            detail: { kind: 'table', base: b.name, table: t.name },
            run: go(place),
          })
        }
        for (const v of b.sqlViews ?? []) {
          const place: Place = { kind: 'sqlview', base: b.name, id: v.id }
          items.push({
            key: `sqlview:${v.id}`,
            group: 'objects',
            title: v.label,
            subtitle: $t('Vue SQL · {base}', { base: where }),
            icon: <LookIcon look={v} fallback={Eye} />,
            searchable: prepare({
              title: v.label,
              name: v.name,
              keywords: KIND_WORDS.sqlview,
              context: `${b.label} ${p.label}`,
            }),
            ...(v.broken ? { badge: $t('À corriger') } : {}),
            base: b.name,
            weight: 3,
            place,
            memorable: true,
            run: go(place),
          })
        }
        for (const q of b.queries ?? []) {
          const place: Place = { kind: 'query', base: b.name, id: q.id }
          items.push({
            key: `query:${q.id}`,
            group: 'objects',
            title: q.label,
            subtitle: $t('Requête enregistrée · {base}', { base: where }),
            icon: <FileCode2 className="size-4" />,
            searchable: prepare({
              title: q.label,
              keywords: KIND_WORDS.query,
              context: `${b.label} ${p.label}`,
            }),
            base: b.name,
            weight: 2,
            place,
            memorable: true,
            run: go(place),
          })
        }
      }
    }
    return items
  }, [projects, tabs, go])

  const fields = useMemo(() => {
    const items: Item[] = []
    for (const d of Object.values(described)) {
      for (const t of d.tables) {
        const place: Place = {
          kind: 'table',
          base: d.name,
          table: t.name,
          view: null,
          record: null,
        }
        for (const f of t.fields) {
          if (f.system === true || f.kind === 'button') continue
          items.push({
            key: `field:${d.name}.${t.name}.${f.name}`,
            group: 'fields',
            title: f.label,
            subtitle: $t('Colonne de « {table} » · {base}', { table: t.label, base: d.label }),
            icon: <FieldIcon kind={f.kind} className="size-4" />,
            searchable: prepare({
              title: f.label,
              name: f.name,
              keywords: KIND_WORDS.field,
              context: `${t.label} ${d.label}`,
            }),
            base: d.name,
            table: t.name,
            weight: -10,
            place,
            memorable: false,
            detail: { kind: 'field', field: f, table: t.label },
            run: go(place),
          })
        }
      }
    }
    return items
  }, [described, go])

  const extras = useMemo(() => {
    const items: Item[] = []
    for (const [name, found] of Object.entries(lists)) {
      const b = projectBaseOf.get(name)
      if (b === undefined) continue
      for (const d of found.dashboards) {
        const place: Place = {
          kind: 'dashboards',
          base: name,
          focus: { kind: 'dashboard', id: d.id },
        }
        items.push({
          key: `dashboard:${d.id}`,
          group: 'analytics',
          title: d.label,
          subtitle: $t('Tableau de bord · {base}', { base: b.label }),
          icon: <LayoutDashboard className="size-4" />,
          searchable: prepare({
            title: d.label,
            keywords: `${KIND_WORDS.dashboard} ${d.description ?? ''}`,
            context: b.label,
          }),
          base: name,
          weight: 3,
          place,
          memorable: true,
          detail: { kind: 'text', text: d.description },
          run: go(place),
        })
      }
      for (const q of found.questions) {
        const place: Place = { kind: 'question', base: name, id: q.id }
        const chart = q.visualization.type
        const Icon =
          chart !== 'table' ? VIZ_ICONS[chart] : q.kind === 'sql' ? SquareTerminal : Workflow
        items.push({
          key: `question:${q.id}`,
          group: 'analytics',
          title: q.label,
          subtitle: $t('Question · {base}', { base: b.label }),
          icon: <Icon className="size-4" />,
          searchable: prepare({
            title: q.label,
            keywords: `${KIND_WORDS.question} ${q.description ?? ''}`,
            context: b.label,
          }),
          base: name,
          weight: 2,
          place,
          memorable: true,
          detail: { kind: 'text', text: q.description },
          run: go(place),
        })
      }
      for (const a of found.automations) {
        const place: Place = { kind: 'automations', base: name, automation: a.id }
        items.push({
          key: `automation:${a.id}`,
          group: 'automations',
          title: a.label,
          subtitle: $t('Automatisation · {base}', { base: b.label }),
          icon: <Zap className="size-4" />,
          searchable: prepare({
            title: a.label,
            keywords: `${KIND_WORDS.automation} ${a.description ?? ''}`,
            context: b.label,
          }),
          ...(a.enabled ? {} : { badge: $t('En pause') }),
          base: name,
          weight: 0,
          place,
          memorable: true,
          detail: { kind: 'text', text: a.description },
          run: go(place),
        })
      }
    }
    for (const [name, found] of Object.entries(views)) {
      const b = projectBaseOf.get(name)
      if (b === undefined) continue
      const labels = new Map(b.tables.map((t) => [t.name, t.label]))
      for (const { table, view } of found) {
        const place: Place = { kind: 'table', base: name, table, view: view.id, record: null }
        const Icon = KIND_INFO[view.kind]?.icon ?? Rows3
        const tableLabel = labels.get(table) ?? table
        items.push({
          key: `view:${view.id}`,
          group: 'objects',
          title: view.label,
          subtitle: $t('Vue de « {table} » · {kind}', {
            table: tableLabel,
            kind: KIND_INFO[view.kind]?.label ?? view.kind,
          }),
          icon: <Icon className="size-4" />,
          searchable: prepare({
            title: view.label,
            keywords: `${KIND_WORDS.view} ${view.description ?? ''}`,
            context: `${tableLabel} ${b.label}`,
          }),
          ...(view.personal ? { badge: $t('Personnelle') } : {}),
          base: name,
          table,
          weight: 1,
          place,
          memorable: true,
          detail: { kind: 'text', text: view.description },
          run: go(place),
        })
      }
    }
    return items
  }, [lists, views, projectBaseOf, go])

  // The tabs the index does not already hold: a statement, a question not saved.
  const tabItems = useMemo(
    () =>
      tabs.map((t): Item => {
        const b = projectBaseOf.get(t.base)
        return {
          key: `tab:${t.id}`,
          group: 'tabs',
          title: t.label,
          subtitle: $t('Onglet · {base}', { base: b?.label ?? t.base }),
          icon: <TabIcon tab={t} />,
          searchable: prepare({ title: t.label, context: b?.label ?? t.base }),
          ...(t.id === activeId ? { badge: $t('Actif') } : {}),
          base: t.base,
          weight: 0,
          memorable: false,
          run: () => onTab(t.id),
        }
      }),
    [tabs, activeId, projectBaseOf, onTab],
  )
  const unsavedTabs = useMemo(
    () =>
      tabItems.filter((item) => {
        const tab = tabs.find((t) => `tab:${t.id}` === item.key)
        return (
          tab !== undefined &&
          ((tab.kind === 'sql' && tab.queryId === null) ||
            (tab.kind === 'question' && tab.questionId === null))
        )
      }),
    [tabItems, tabs],
  )

  // ── The commands ────────────────────────────────────────────────────────────────

  const commands = useMemo(() => {
    const items: Item[] = []
    const add = (
      id: string,
      title: string,
      category: string,
      Icon: LucideIcon,
      run: () => void,
      options: {
        readonly keywords?: string
        readonly shortcut?: string
        readonly badge?: string
        readonly place?: Place
        readonly weight?: number
        readonly memorable?: boolean
        readonly stays?: boolean
        /** What it acts on — what a scope keeps. */
        readonly base?: string
        readonly table?: string
      } = {},
    ) =>
      items.push({
        key: `command:${id}`,
        group: 'commands',
        title,
        subtitle: category,
        icon: <Icon className="size-4" />,
        searchable: prepare({ title, keywords: options.keywords ?? '', context: category }),
        ...(options.badge === undefined ? {} : { badge: options.badge }),
        ...(options.shortcut === undefined ? {} : { shortcut: options.shortcut }),
        ...(options.place === undefined ? {} : { place: options.place }),
        ...(options.base === undefined ? {} : { base: options.base }),
        ...(options.table === undefined ? {} : { table: options.table }),
        weight: options.weight ?? 0,
        memorable: options.memorable ?? true,
        ...(options.stays === undefined ? {} : { stays: options.stays }),
        run,
      })

    const goTo = $t('Aller à')
    const create = $t('Créer')
    if (target !== null) {
      const name = target.name
      const label = target.label
      const manages = target.actions.includes('manage_schema')
      const at = (place: Place) => () => onGo(place)
      /** A command acting on this base: a scope into it keeps it. */
      const here: typeof add = (id, title, category, Icon, run, options = {}) =>
        add(id, title, category, Icon, run, { ...options, base: name })
      here(
        `structure:${name}`,
        $t('Structure de « {base} »', { base: label }),
        goTo,
        Layers,
        at({ kind: 'section', base: name, section: 'structure' }),
        {
          keywords: $t('schéma colonnes champs tables||mots-clés de recherche'),
          place: { kind: 'section', base: name, section: 'structure' },
        },
      )
      here(
        `history:${name}`,
        $t('Historique de « {base} »', { base: label }),
        goTo,
        History,
        at({ kind: 'section', base: name, section: 'history' }),
        {
          keywords: $t('journal modifications versions||mots-clés de recherche'),
          place: { kind: 'section', base: name, section: 'history' },
        },
      )
      here(
        `dashboards:${name}`,
        $t('Tableaux de bord de « {base} »', { base: label }),
        goTo,
        LayoutDashboard,
        at({ kind: 'dashboards', base: name, focus: null }),
        {
          keywords: $t('graphiques statistiques indicateurs||mots-clés de recherche'),
          place: { kind: 'dashboards', base: name, focus: null },
        },
      )
      if (manages) {
        here(
          `automations:${name}`,
          $t('Automatisations de « {base} »', { base: label }),
          goTo,
          Zap,
          at({ kind: 'automations', base: name, automation: null }),
          {
            keywords: $t('règles déclencheurs workflows||mots-clés de recherche'),
            place: { kind: 'automations', base: name, automation: null },
          },
        )
        here(
          `integrations:${name}`,
          $t('Intégrations de « {base} »', { base: label }),
          goTo,
          Puzzle,
          at({ kind: 'section', base: name, section: 'integrations' }),
          {
            keywords: $t('synchronisation connecteurs sources||mots-clés de recherche'),
            place: { kind: 'section', base: name, section: 'integrations' },
          },
        )
      }
      here(
        `doc:${name}`,
        $t('Documentation API et MCP de « {base} »', { base: label }),
        goTo,
        BookOpen,
        at({ kind: 'section', base: name, section: 'doc' }),
        {
          keywords: $t('rest openapi mcp agents développeurs||mots-clés de recherche'),
          place: { kind: 'section', base: name, section: 'doc' },
        },
      )
      here(`sql:${name}`, $t('Nouvelle requête SQL'), create, Terminal, () => onBase(name, 'sql'), {
        keywords: $t('console select||mots-clés de recherche'),
        weight: 4,
      })
      here(`question:${name}`, $t('Nouvelle question'), create, Workflow, () =>
        onBase(name, 'question'),
      )
      here(`question-sql:${name}`, $t('Nouvelle question SQL'), create, SquareTerminal, () =>
        onBase(name, 'question-sql'),
      )
      if (manages) {
        here(
          `new-table:${name}`,
          $t('Nouvelle table dans « {base} »', { base: label }),
          create,
          Plus,
          () => onBase(name, 'new-table'),
          { keywords: $t('ajouter créer table||mots-clés de recherche'), weight: 4 },
        )
        here(
          `new-sql-view:${name}`,
          $t('Nouvelle vue SQL dans « {base} »', { base: label }),
          create,
          Eye,
          () => onBase(name, 'new-sql-view'),
        )
      }
    }
    if (project?.actions.includes('manage_schema') === true) {
      add('new-base', $t('Nouvelle base'), create, Database, onNewBase, {
        keywords: $t('ajouter créer base||mots-clés de recherche'),
      })
      add('gallery', $t('Partir d’un modèle'), create, Sparkles, () => onGallery(null), {
        keywords: $t('modèles galerie gabarit||mots-clés de recherche'),
      })
      add('demo', $t('Base de démonstration'), create, Sparkles, () => onGallery('demo'), {
        keywords: $t('exemple démo essai||mots-clés de recherche'),
      })
    }
    add('new-project', $t('Nouveau projet'), create, FolderPlus, onNewProject)

    // The table on screen, or the one searched in.
    const tableRef =
      scope?.kind === 'table'
        ? { base: scope.base, table: scope.table }
        : section === 'data' && activeTab?.kind === 'table' && activeTab.table !== null
          ? { base: activeTab.base, table: activeTab.table }
          : null
    const tableOf =
      tableRef === null
        ? undefined
        : projectBaseOf.get(tableRef.base)?.tables.find((t) => t.name === tableRef.table)
    if (tableRef !== null && tableOf !== undefined) {
      const category = $t('Table')
      const onTableAdd: typeof add = (id, title, category, Icon, run, options = {}) =>
        add(id, title, category, Icon, run, { ...options, ...tableRef })
      if (tableOf.actions.includes('create')) {
        onTableAdd(
          `import:${tableRef.base}.${tableRef.table}`,
          $t('Importer dans « {table} »', { table: tableOf.label }),
          category,
          Upload,
          () => onTable(tableRef.base, tableRef.table, 'import'),
          { keywords: $t('csv excel fichier charger||mots-clés de recherche') },
        )
      }
      if (tableOf.actions.includes('manage_schema')) {
        onTableAdd(
          `edit-table:${tableRef.base}.${tableRef.table}`,
          $t('Modifier la table « {table} »', { table: tableOf.label }),
          category,
          Settings,
          () => onTable(tableRef.base, tableRef.table, 'edit'),
          { keywords: $t('renommer description apparence||mots-clés de recherche') },
        )
      }
    }
    if (section === 'data' && activeTab !== null) {
      add('reload', $t('Recharger les lignes'), $t('Données'), RefreshCw, () =>
        useWorkspace.getState().reload(),
      )
    }

    const lastDone = done[done.length - 1]
    if (lastDone !== undefined) {
      add(
        'undo',
        $t('Annuler : {label}', { label: lastDone.label }),
        $t('Données'),
        Undo2,
        () => void undo(),
        { shortcut: `${mod}+Z`, memorable: false, weight: 6 },
      )
    }
    const lastUndone = undone[undone.length - 1]
    if (lastUndone !== undefined) {
      add(
        'redo',
        $t('Rétablir : {label}', { label: lastUndone.label }),
        $t('Données'),
        Redo2,
        () => void redo(),
        { shortcut: `${mod}+Y`, memorable: false },
      )
    }

    if (tabs.length > 0) {
      const category = $t('Onglets')
      const { close, closeOthers, closeAll } = useWorkspace.getState()
      const index = tabs.findIndex((t) => t.id === activeId)
      if (activeId !== null) {
        add('close-tab', $t('Fermer l’onglet'), category, X, () => close(activeId), {
          shortcut: 'Alt+W',
          memorable: false,
        })
      }
      if (tabs.length > 1) {
        const next = tabs[(index + 1) % tabs.length]
        const previous = tabs[(index - 1 + tabs.length) % tabs.length]
        if (next !== undefined) {
          add('next-tab', $t('Onglet suivant'), category, ArrowRight, () => onTab(next.id), {
            shortcut: 'Ctrl+Tab',
            memorable: false,
          })
        }
        if (previous !== undefined) {
          add(
            'previous-tab',
            $t('Onglet précédent'),
            category,
            ArrowLeft,
            () => onTab(previous.id),
            { shortcut: 'Ctrl+Maj+Tab', memorable: false },
          )
        }
        if (activeId !== null) {
          add('close-others', $t('Fermer les autres onglets'), category, XCircle, () =>
            closeOthers(activeId),
          )
        }
      }
      add('close-all', $t('Fermer tous les onglets'), category, XCircle, closeAll)
    }

    const view = $t('Affichage')
    const themes: ReadonlyArray<readonly [ThemePreference, string, LucideIcon, string]> = [
      ['light', $t('Thème clair'), Sun, $t('jour lumineux blanc||mots-clés de recherche')],
      ['dark', $t('Thème sombre'), Moon, $t('nuit noir foncé||mots-clés de recherche')],
      [
        'system',
        $t('Thème du système'),
        Monitor,
        $t('automatique appareil||mots-clés de recherche'),
      ],
    ]
    for (const [id, title, Icon, keywords] of themes) {
      add(`theme:${id}`, title, view, Icon, () => useTheme.getState().setPreference(id), {
        keywords: `${$t('thème apparence couleurs||mots-clés de recherche')} ${keywords}`,
        ...(preference === id ? { badge: $t('Actif') } : {}),
      })
    }
    add(
      'sidebar',
      collapsed ? $t('Agrandir le panneau latéral') : $t('Réduire le panneau latéral'),
      view,
      PanelLeft,
      () => useSidebar.getState().toggle(),
      { keywords: $t('navigation menu gauche||mots-clés de recherche'), memorable: false },
    )
    if (section === 'data' || section === 'dashboards' || section === 'automations') {
      add(
        'copilot',
        copilotOpen ? $t('Fermer le Copilot') : $t('Ouvrir le Copilot'),
        view,
        Sparkles,
        () => useWorkspace.getState().setCopilotOpen(!copilotOpen),
        { keywords: $t('ia assistant intelligence artificielle||mots-clés de recherche') },
      )
    }
    add(
      'copy-link',
      $t('Copier le lien de cette page'),
      view,
      Copy,
      () => {
        void navigator.clipboard.writeText(window.location.href).then(
          () => toast($t('Lien copié')),
          () => toast.error($t('Le lien n’a pas pu être copié.')),
        )
      },
      { keywords: $t('adresse url partager||mots-clés de recherche'), memorable: false },
    )
    add('shortcuts', $t('Raccourcis clavier'), $t('Aide'), Keyboard, () => setHelp(true), {
      keywords: $t('touches clavier aide||mots-clés de recherche'),
      memorable: false,
      stays: true,
    })

    const settings = $t('Paramètres')
    const settingsTabs: ReadonlyArray<readonly [SettingsTab, string, string]> = [
      ['profile', $t('Profil'), 'profil'],
      ['security', $t('Sécurité'), 'securite'],
      ['appearance', $t('Apparence'), 'apparence'],
      ['notifications', $t('Notifications'), 'notifications'],
      ['tokens', $t('Jetons'), 'jetons'],
    ]
    for (const [id, label, slug] of settingsTabs) {
      const place: Place = { kind: 'settings', tab: slug }
      add(
        `settings:${id}`,
        $t('Paramètres : {tab}', { tab: label }),
        settings,
        Settings,
        () => onGo(place),
        {
          keywords: $t('réglages préférences compte||mots-clés de recherche'),
          place,
        },
      )
    }
    if (me.isAdmin) {
      const admin = $t('Administration')
      const adminTabs: ReadonlyArray<readonly [AdminTab, string, string, LucideIcon]> = [
        ['users', $t('Utilisateurs'), 'utilisateurs', Users],
        ['groups', $t('Groupes'), 'groupes', Users],
        ['permissions', $t('Permissions'), 'permissions', Shield],
      ]
      for (const [id, label, slug, Icon] of adminTabs) {
        const place: Place = { kind: 'admin', tab: slug }
        add(
          `admin:${id}`,
          $t('Administration : {tab}', { tab: label }),
          admin,
          Icon,
          () => onGo(place),
          { keywords: $t('droits accès membres invitations||mots-clés de recherche'), place },
        )
      }
    }
    add('sign-out', $t('Se déconnecter'), $t('Compte'), LogOut, onSignOut, {
      keywords: $t('quitter déconnexion sortir||mots-clés de recherche'),
      memorable: false,
      weight: -6,
    })
    return items
  }, [
    target,
    project,
    scope,
    section,
    activeTab,
    activeId,
    tabs,
    projectBaseOf,
    done,
    undone,
    preference,
    collapsed,
    copilotOpen,
    me.isAdmin,
    mod,
    onGo,
    onBase,
    onTable,
    onTab,
    onNewBase,
    onNewProject,
    onGallery,
    onSignOut,
  ])

  // ── The rows, as results ──────────────────────────────────────────────────────────

  const rowItems = useMemo(
    () =>
      rows.hits.map(({ table, row }): Item => {
        const id = String(row._id)
        const title = rowTitle(table, row)
        const place: Place = {
          kind: 'table',
          base: table.base,
          table: table.name,
          view: null,
          record: id,
        }
        const b = projectBaseOf.get(table.base)
        const snippet = snippetOf(table, row, tokens)
        return {
          key: `row:${table.base}.${table.name}.${id}`,
          group: 'rows',
          title,
          // Where it is, unless one searches inside its table — then what else it holds.
          subtitle: [
            ...(scope?.kind === 'table' ? [] : [table.label]),
            ...(table.base === base?.name || b === undefined || scope !== null ? [] : [b.label]),
            // What the extract already quotes is not said twice.
            ...summaryOf(table, row).filter(
              (value) => snippet === undefined || !tokens.some((t) => fold(value).includes(t)),
            ),
          ]
            .slice(0, 4)
            .join(' · '),
          icon: <LookIcon look={table} fallback={Rows3} />,
          searchable: prepare({ title, keywords: snippet?.text ?? '', context: table.label }),
          base: table.base,
          table: table.name,
          weight: 0,
          place,
          memorable: true,
          ...(snippet === undefined ? {} : { snippet }),
          detail: { kind: 'row', table, row },
          run: () => onGo(place),
        }
      }),
    [rows.hits, tokens, projectBaseOf, base?.name, scope, onGo],
  )

  // ── What the field says, beyond words to find ─────────────────────────────────────

  const questionWords = useMemo(
    () =>
      new Set(
        tokensOf(
          $t(
            'combien quel quelle quels quelles qui quoi comment pourquoi où quand est-ce montre montre-moi affiche liste trouve donne calcule compare résume||mots qui commencent une question, séparés par des espaces',
          ),
        ),
      ),
    [],
  )
  const asks = text !== '' && (filter === 'ask' || looksLikeQuestion(text, questionWords))
  const targetLabel = target?.label ?? targetName
  const askItem = useMemo(
    (): Item | null =>
      text === '' || targetName === null
        ? null
        : {
            key: 'ask',
            group: 'ask',
            title: $t('Demander au Copilot : « {question} »', { question: text }),
            subtitle: $t(
              'Il répond sur « {base} », et propose filtres, requêtes et modifications',
              { base: targetLabel },
            ),
            icon: <Sparkles className="size-4 text-primary" />,
            searchable: prepare({ title: text }),
            weight: 0,
            memorable: false,
            detail: {
              kind: 'text',
              text: $t(
                'Le Copilot s’ouvre à droite et reçoit la question. Il lit la structure de la base, pas ses lignes, sauf si vous l’y autorisez ; il propose, et rien ne change avant que vous appliquiez une proposition.',
              ),
            },
            run: () => onAskCopilot(targetName, text),
          },
    [text, targetName, targetLabel, onAskCopilot],
  )

  /** An address of the application, pasted: followed. */
  const linkItem = useMemo((): Item | null => {
    if (!/^(https?:\/\/|\/(bases|projets|parametres|administration)\b)/u.test(text)) return null
    let url: URL
    try {
      url = new URL(text, window.location.origin)
    } catch {
      return null
    }
    if (url.origin !== window.location.origin) return null
    const place = placeOf(url.pathname, url.search, me.tenant)
    if (place === null) return null
    return {
      key: 'link',
      group: 'link',
      title: $t('Ouvrir ce lien'),
      subtitle: `${url.pathname}${url.search}`,
      icon: <Link2 className="size-4" />,
      searchable: prepare({ title: text }),
      weight: 0,
      memorable: false,
      run: () => onGo(place),
    }
  }, [text, me.tenant, onGo])

  // ── Ranking ─────────────────────────────────────────────────────────────────────

  const byKey = useMemo(() => new Map(memory.map((v) => [v.key, v])), [memory])

  const sections = useMemo((): ReadonlyArray<{
    readonly group: Group
    readonly items: readonly Item[]
    readonly more: number
  }> => {
    if (help) return []
    const inScope = (item: Item) => {
      if (scope === null) return true
      if (item.base !== scope.base) return false
      if (scope.kind === 'base') return item.group !== 'places'
      // Inside a table: its rows, its views, its columns, its commands — not itself.
      return item.table === scope.table && !item.key.startsWith('table:')
    }
    const passes = (item: Item) => {
      if (!inScope(item)) return false
      switch (filter) {
        case 'all':
          return true
        case 'objects':
          return FILTER_OF[item.group] === 'objects'
        case 'rows':
          return item.group === 'rows'
        case 'commands':
          return item.group === 'commands'
        case 'ask':
          return item.group === 'ask'
      }
    }
    const pool = [...unsavedTabs, ...objects, ...extras, ...fields, ...commands].filter(passes)
    const capOf = (group: Group) =>
      filter !== 'all' || scope !== null ? 60 : group === 'objects' || group === 'rows' ? 6 : 4

    const grouped = (scored: readonly Scored[]) => {
      const out: Array<{ group: Group; items: Item[]; more: number }> = []
      for (const group of GROUP_ORDER) {
        const members = scored.filter((s) => s.item.group === group).map((s) => s.item)
        if (members.length === 0) continue
        const cap = capOf(group)
        out.push({
          group,
          items: members.slice(0, cap),
          more: Math.max(0, members.length - cap),
        })
      }
      return out
    }

    const now = Date.now()
    const boost = (item: Item) =>
      item.weight +
      frecency(byKey.get(item.key), now) +
      (item.base !== undefined && item.base === base?.name ? 8 : 0)

    // Nothing typed: what one comes back to, rather than everything.
    if (tokens.length === 0) {
      if (filter === 'ask') return []
      if (scope !== null || filter !== 'all') {
        const natural = [...pool, ...(filter === 'objects' ? [] : rowItems.filter(passes))]
          .filter((item) => item.group !== 'fields' || scope?.kind === 'table')
          .sort((a, b) => boost(b) - boost(a))
          .map((item) => ({ item, score: 0 }))
        return grouped(natural)
      }
      const known = new Map(pool.map((item) => [item.key, item]))
      const recent = memory
        .filter((v) => v.count > 0)
        .slice(0, 12)
        .flatMap((v): Item[] => {
          const live = known.get(v.key)
          if (live !== undefined) return [{ ...live, group: 'recent' }]
          // A row, or what the index no longer holds: shown as it was, led to where it was.
          if (v.place === null || !v.key.startsWith('row:')) return []
          const place = v.place
          return [
            {
              key: v.key,
              group: 'recent',
              title: v.title,
              ...(v.subtitle === null ? {} : { subtitle: v.subtitle }),
              icon: <Rows3 className="size-4" />,
              searchable: prepare({ title: v.title }),
              weight: 0,
              place,
              memorable: true,
              run: () => onGo(place),
            },
          ]
        })
        .slice(0, 5)
      const open = tabItems.slice(0, 8)
      // The tables of the base on screen not already open: the tabs list those.
      const tablesHere = pool
        .filter(
          (item) =>
            item.key.startsWith('table:') && item.base === base?.name && item.badge === undefined,
        )
        .slice(0, 6)
      const suggested = commands
        .filter((c) =>
          ['command:sql:', 'command:question:', 'command:new-table:', 'command:dashboards:'].some(
            (prefix) => c.key.startsWith(prefix),
          ),
        )
        .map((c) => ({ ...c, group: 'suggestions' as const }))
      return [
        ...(recent.length > 0 ? [{ group: 'recent' as const, items: recent, more: 0 }] : []),
        ...(open.length > 0
          ? [{ group: 'tabs' as const, items: open, more: Math.max(0, tabItems.length - 8) }]
          : []),
        ...(tablesHere.length > 0
          ? [{ group: 'objects' as const, items: tablesHere, more: 0 }]
          : []),
        ...(suggested.length > 0
          ? [{ group: 'suggestions' as const, items: suggested, more: 0 }]
          : []),
      ]
    }

    const scored: Scored[] = []
    for (const item of pool) {
      const score = scoreOf(tokens, item.searchable)
      if (score > 0) scored.push({ item, score: score + boost(item) })
    }
    scored.sort((a, b) => b.score - a.score)

    // The rows were found by the server, in any column: those whose title holds the text
    // come first, the others after, in the order they came.
    const rowsScored = rowItems
      .filter(passes)
      .map((item, index) => ({
        item,
        score: (scoreOf(tokens, item.searchable) || 30) + boost(item) - index * 0.01,
      }))
      .sort((a, b) => b.score - a.score)

    const out: Array<{ group: Group; items: readonly Item[]; more: number }> = []
    if (linkItem !== null) out.push({ group: 'link', items: [linkItem], more: 0 })
    if (asks && askItem !== null) out.push({ group: 'ask', items: [askItem], more: 0 })
    // The best result, alone on top — when it is good enough to be called that.
    const best = scored[0]
    const topped = filter === 'all' && best !== undefined && best.score >= MATCH.word && !asks
    if (topped) out.push({ group: 'top', items: [{ ...best.item, group: 'top' }], more: 0 })
    out.push(...grouped([...(topped ? scored.slice(1) : scored), ...rowsScored]))
    if (!asks && askItem !== null && (filter === 'all' || filter === 'ask')) {
      out.push({ group: 'ask', items: [askItem], more: 0 })
    }
    return out
  }, [
    help,
    scope,
    filter,
    unsavedTabs,
    objects,
    extras,
    fields,
    commands,
    rowItems,
    tokens,
    byKey,
    base?.name,
    memory,
    tabItems,
    linkItem,
    asks,
    askItem,
    onGo,
  ])

  /**
   * The groups as drawn: each thing once — a recent one is not suggested again —, and under
   * a group cut short, « N autres résultats », which shows it whole under its filter.
   */
  const layout = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ readonly group: Group; readonly items: readonly Item[] }> = []
    for (const s of sections) {
      const items = s.items.filter((item) => !seen.has(item.key))
      for (const item of items) seen.add(item.key)
      const whole = FILTER_OF[s.group]
      if (s.more > 0 && whole !== undefined && whole !== filter) {
        items.push({
          key: `more:${s.group}`,
          group: s.group,
          title: $tp(s.more, '{count} autre résultat', '{count} autres résultats'),
          icon: <Search className="size-4" />,
          searchable: prepare({ title: '' }),
          weight: 0,
          memorable: false,
          detail: { kind: 'text', text: $t('Entrée pour voir tous les résultats de ce groupe.') },
          stays: true,
          run: () => {
            setFilter(whole)
            setActiveKey(null)
          },
        })
      }
      if (items.length > 0) out.push({ group: s.group, items })
    }
    return out
  }, [sections, filter])
  const flat = useMemo(() => layout.flatMap((s) => s.items), [layout])

  const activeIndex = Math.max(
    0,
    activeKey === null ? 0 : flat.findIndex((item) => item.key === activeKey),
  )
  const active = flat[activeIndex]

  useEffect(() => {
    void activeIndex
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // ── Acts ──────────────────────────────────────────────────────────────────────────

  const choose = (item: Item) => {
    if (item.stays === true) {
      item.run()
      input.current?.focus()
      return
    }
    if (item.memorable && item.group !== 'ask') {
      remember({
        key: item.key,
        title: item.title,
        subtitle: item.subtitle ?? null,
        kind: item.key.split(':')[0] ?? '',
        place: item.place ?? null,
      })
    }
    ran.current = true
    onClose()
    // Once the palette has let go of the focus: a dialog the action opens must get it.
    window.setTimeout(item.run, 0)
  }

  const enter = (next: Scope) => {
    setScope(next)
    setQuery('')
    setActiveKey(null)
    if (filter === 'commands' || filter === 'ask') setFilter('all')
  }

  const type = (value: string) => {
    const prefix = PREFIXES[value.charAt(0)]
    // Typed alone, first: a prefix. Pasted with more — an address, say —, a text.
    if (prefix !== undefined && value.length === 1 && filter === 'all' && scope === null) {
      setFilter(prefix)
      setQuery(value.slice(1))
    } else {
      setQuery(value)
    }
    setActiveKey(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const move = (to: number) => {
      e.preventDefault()
      if (flat.length === 0) return
      const index = (to + flat.length) % flat.length
      setActiveKey(flat[index]?.key ?? null)
    }
    switch (e.key) {
      case 'ArrowDown':
        return move(activeIndex + 1)
      case 'ArrowUp':
        return move(activeIndex - 1)
      case 'PageDown':
        return move(Math.min(flat.length - 1, activeIndex + 8))
      case 'PageUp':
        return move(Math.max(0, activeIndex - 8))
      case 'Enter': {
        e.preventDefault()
        if (e.nativeEvent.isComposing) return
        if (active !== undefined) choose(active)
        return
      }
      case 'Tab': {
        e.preventDefault()
        if (active?.scope !== undefined) enter(active.scope)
        return
      }
      case 'Backspace': {
        if (query !== '') return
        if (help) setHelp(false)
        else if (scope !== null) setScope(null)
        else if (filter !== 'all') setFilter('all')
        return
      }
    }
  }

  const placeholder = help
    ? $t('Raccourcis clavier')
    : scope !== null
      ? $t('Rechercher dans « {label} »…', { label: scope.label })
      : filter === 'commands'
        ? $t('Rechercher une commande…')
        : filter === 'objects'
          ? $t('Rechercher une table, une vue, un tableau de bord…')
          : filter === 'rows'
            ? $t('Rechercher dans les lignes de « {base} »…', {
                base: target?.label ?? targetName ?? '',
              })
            : filter === 'ask'
              ? $t('Posez votre question au Copilot…')
              : $t('Rechercher une table, une ligne, une commande…')

  const nothing =
    !help &&
    flat.length === 0 &&
    !(rows.loading && searchesRows) &&
    (tokens.length > 0 || filter === 'rows' || filter === 'ask')

  return (
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      className="top-[10vh] flex max-h-[80vh] w-[calc(100%-2rem)] max-w-3xl translate-y-0 flex-col gap-0 overflow-hidden p-0"
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        input.current?.focus()
      }}
      onCloseAutoFocus={(e) => {
        if (ran.current) e.preventDefault()
      }}
      onEscapeKeyDown={(e) => {
        // Back out of a scope, the help, a filter — then out of the palette.
        if (help || scope !== null || filter !== 'all') {
          e.preventDefault()
          if (help) setHelp(false)
          else if (scope !== null) setScope(null)
          else setFilter('all')
        }
      }}
    >
      <DialogTitle className="sr-only">{$t('Rechercher partout')}</DialogTitle>

      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        {scope !== null && (
          <button
            type="button"
            onClick={() => {
              setScope(null)
              input.current?.focus()
            }}
            className="flex max-w-48 shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15"
            aria-label={$t('Ne plus chercher dans « {label} »', { label: scope.label })}
          >
            {scope.kind === 'table' ? (
              <Table2 className="size-3 shrink-0" />
            ) : (
              <Database className="size-3 shrink-0" />
            )}
            <span className="truncate">{scope.label}</span>
            <X className="size-3 shrink-0 opacity-70" />
          </button>
        )}
        <input
          ref={input}
          role="combobox"
          aria-expanded
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={active === undefined ? undefined : `${listId}-${activeIndex}`}
          value={query}
          placeholder={placeholder}
          onChange={(e) => type(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
        />
        {rows.loading && searchesRows && (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        <Kbd className="hidden sm:inline-flex">{$t('Échap')}</Kbd>
      </div>

      {/* The filters: a click, or a prefix typed first. */}
      <div className="scroll-discret flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id)
              setHelp(false)
              setActiveKey(null)
              input.current?.focus()
            }}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
              filter === f.id && !help
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            {f.label}
            {f.prefix !== null && <Kbd className="h-4 min-w-4 text-[0.6rem]">{f.prefix}</Kbd>}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* biome-ignore lint/a11y/useFocusableInteractive: focus stays in the search box, which points at the highlighted option with aria-activedescendant */}
        <div
          ref={list}
          id={listId}
          // biome-ignore lint/a11y/useSemanticElements: a <select> cannot host a search box — the combobox pattern of the ARIA Authoring Practices
          role="listbox"
          className="scroll-discret min-h-0 min-w-0 flex-1 overflow-y-auto p-1.5"
        >
          {help ? (
            <Shortcuts mod={mod} />
          ) : (
            <>
              {layout.map((s) => (
                <div key={s.group} className="mb-1" role="presentation">
                  <p className="px-2.5 pt-2 pb-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {GROUP_TITLES[s.group]}
                    {s.group === 'rows' && target !== null && scope === null && (
                      <span className="normal-case tracking-normal"> · {target.label}</span>
                    )}
                  </p>
                  {s.items.map((item) => {
                    const at = flat.indexOf(item)
                    return (
                      <Row
                        key={item.key}
                        id={`${listId}-${at}`}
                        item={item}
                        tokens={tokens}
                        active={at === activeIndex}
                        onHover={() => at !== activeIndex && setActiveKey(item.key)}
                        onChoose={() => choose(item)}
                      />
                    )
                  })}
                </div>
              ))}
              {rows.loading && searchesRows && rowItems.length === 0 && tokens.length > 0 && (
                <p className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {$t('Recherche dans les lignes…')}
                </p>
              )}
              {nothing && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {filter === 'rows' && tokens.length === 0
                    ? $t('Tapez au moins deux lettres pour chercher dans les lignes.')
                    : filter === 'ask'
                      ? $t('Écrivez votre question : le Copilot y répond avec vos données.')
                      : $t('Rien ne correspond à « {query} ».', { query: text })}
                </div>
              )}
            </>
          )}
        </div>

        {!help && active !== undefined && (
          <Preview item={active} described={described} projectBaseOf={projectBaseOf} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t bg-muted/30 px-3 py-1.5 text-[0.7rem] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          {$t('parcourir')}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd>
          {$t('ouvrir')}
        </span>
        {active?.scope !== undefined && (
          <span className="flex items-center gap-1">
            <Kbd>Tab</Kbd>
            {$t('chercher dedans')}
          </span>
        )}
        {(scope !== null || filter !== 'all' || help) && (
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>⌫</Kbd>
            {$t('revenir')}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setHelp((was) => !was)
            input.current?.focus()
          }}
          className="ml-auto flex items-center gap-1 rounded px-1 hover:text-foreground"
        >
          <Keyboard className="size-3.5" />
          {$t('Raccourcis')}
        </button>
      </div>
    </DialogContent>
  )
}

/** The rows a text finds in a base's tables, or in one of them — with the reader's rights. */
async function findRows(
  tables: readonly Table[],
  inTable: Table | undefined,
  text: string,
): Promise<RowHit[]> {
  const ask = (table: Table, filter: string, limit: number, sort?: string) =>
    api
      .list(
        { base: table.base, name: table.name },
        { ...(filter === '' ? {} : { filter }), ...(sort === undefined ? {} : { sort }), limit },
      )
      .then((page) => page.data.map((row) => ({ table, row })))
      .catch(() => [] as RowHit[])

  const clauseFor = (table: Table, needle: string) =>
    UUID.test(needle) ? `_id eq ${quoteLiteral(needle)}` : searchClause(table.fields, needle)
  const searchable = (clause: string) => clause !== '_id is_null'

  // One table: its rows matching, or its latest ones when nothing is typed.
  if (inTable !== undefined) {
    if (text === '') {
      const latest = await ask(inTable, '', ROWS_IN_TABLE, '-_updated_at')
      return latest.length > 0 ? latest : ask(inTable, '', ROWS_IN_TABLE)
    }
    const clause = clauseFor(inTable, text)
    return searchable(clause) ? ask(inTable, clause, ROWS_IN_TABLE) : []
  }

  const searches: Array<Promise<RowHit[]>> = []
  // « clients paris »: the first word names a table, the rest is looked for in it.
  const words = text.split(/\s+/u)
  if (words.length >= 2 && !UUID.test(text)) {
    const head = fold(words[0] as string)
    const named = tables.find(
      (t) =>
        scoreToken(head, fold(t.label)) >= MATCH.word ||
        scoreToken(head, fold(t.name)) >= MATCH.word,
    )
    const rest = words.slice(1).join(' ')
    if (named !== undefined) {
      const clause = clauseFor(named, rest)
      if (searchable(clause)) searches.push(ask(named, clause, ROWS_HINTED))
    }
  }
  for (const table of tables.slice(0, ROW_TABLES)) {
    const clause = clauseFor(table, text)
    if (searchable(clause)) searches.push(ask(table, clause, UUID.test(text) ? 1 : ROWS_PER_TABLE))
  }
  const found = (await Promise.all(searches)).flat()
  const seen = new Set<string>()
  return found.filter(({ table, row }) => {
    const key = `${table.name}.${String(row._id)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Drawing ──────────────────────────────────────────────────────────────────────

function TabIcon({ tab }: { readonly tab: Tab }) {
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
  return <Icon className="size-4" />
}

function Lit({ text, lit }: { readonly text: string; readonly lit: ReadonlySet<number> }) {
  return (
    <>
      {runsOf(text, lit).map((run, i) =>
        run.lit ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one text, in order, never reordered
          <mark key={i} className="rounded-[2px] bg-primary/15 text-inherit">
            {run.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  )
}

function Row({
  id,
  item,
  tokens,
  active,
  onHover,
  onChoose,
}: {
  readonly id: string
  readonly item: Item
  readonly tokens: readonly string[]
  readonly active: boolean
  readonly onHover: () => void
  readonly onChoose: () => void
}) {
  const lit = useMemo(() => highlights(item.title, tokens), [item.title, tokens])
  const more = item.key.startsWith('more:')
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the options never take focus — see the list
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard belongs to the search box, which drives this list through aria-activedescendant
    <div
      id={id}
      // biome-ignore lint/a11y/useSemanticElements: an <option> cannot live outside a <select> — see the list
      role="option"
      aria-selected={active}
      data-active={active}
      // Keeps the caret in the search box: a click on a result must not blur it.
      onMouseDown={(e) => e.preventDefault()}
      // `mousemove`, not `mouseenter`: the arrow keys scroll the list under a still pointer.
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn(
        'flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm',
        active ? 'bg-accent text-accent-foreground' : 'text-foreground',
        more && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground',
          active && 'text-foreground',
        )}
      >
        {item.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate">{more ? item.title : <Lit text={item.title} lit={lit} />}</div>
        {item.snippet !== undefined ? (
          <div className="truncate text-xs text-muted-foreground">
            <span className="text-foreground/70">{item.snippet.label}</span>
            {' · '}
            <Lit text={item.snippet.text} lit={item.snippet.lit} />
            {item.subtitle !== undefined && <span> — {item.subtitle}</span>}
          </div>
        ) : (
          item.subtitle !== undefined && (
            <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
          )
        )}
      </div>
      {item.badge !== undefined && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
          {item.badge}
        </span>
      )}
      {item.shortcut !== undefined && <Kbd className="shrink-0">{item.shortcut}</Kbd>}
      {active && item.scope !== undefined && (
        <span className="hidden shrink-0 items-center gap-1 text-[0.7rem] text-muted-foreground sm:flex">
          <Kbd>Tab</Kbd>
          {$t('chercher dedans')}
        </span>
      )}
      {active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )
}

/** What the highlighted result holds — a row's values, a table's columns — on wide screens. */
function Preview({
  item,
  described,
  projectBaseOf,
}: {
  readonly item: Item
  readonly described: Readonly<Record<string, DescribedBase>>
  readonly projectBaseOf: ReadonlyMap<string, ProjectBase>
}) {
  // Drawn for every result, if only its name: the list keeps its width from one to the next.
  const detail = item.detail
  let body: ReactNode = null
  if (detail === undefined || (detail.kind === 'text' && (detail.text ?? '').trim() === '')) {
    body = (
      <p className="text-xs text-muted-foreground">
        {item.scope !== undefined
          ? $t('Entrée pour l’ouvrir, Tab pour chercher dedans.')
          : item.key.startsWith('command:')
            ? $t('Entrée pour lancer la commande.')
            : $t('Entrée pour l’ouvrir.')}
      </p>
    )
  } else if (detail.kind === 'row') {
    const shown = detail.table.fields
      .filter((f) => f.system !== true && f.kind !== 'button')
      .map((f) => ({ field: f, text: valueText(detail.row[f.name], f).trim() }))
      .filter(({ text }) => text !== '' && !UUID.test(text))
      .slice(0, 14)
    body = (
      <dl className="space-y-2">
        {shown.map(({ field, text }) => (
          <div key={field.name} className="min-w-0">
            <dt className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
              <FieldIcon kind={field.kind} className="size-3" />
              <span className="truncate">{field.label}</span>
            </dt>
            <dd className="line-clamp-3 break-words text-xs">{text}</dd>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="text-xs text-muted-foreground">{$t('Cette ligne est vide.')}</p>
        )}
      </dl>
    )
  } else if (detail.kind === 'table') {
    const table = described[detail.base]?.tables.find((t) => t.name === detail.table)
    const listed = projectBaseOf.get(detail.base)?.tables.find((t) => t.name === detail.table)
    const columns = (table?.fields ?? []).filter((f) => f.system !== true)
    body = (
      <div className="space-y-3">
        {table?.description !== null && table?.description !== undefined && (
          <p className="text-xs leading-relaxed">{table.description}</p>
        )}
        <p className="font-mono text-[0.7rem] text-muted-foreground">
          {listed?.name ?? detail.table}
        </p>
        {columns.length > 0 && (
          <div>
            <p className="mb-1 text-[0.7rem] text-muted-foreground">
              {$tp(columns.length, '{count} colonne', '{count} colonnes')}
            </p>
            <ul className="space-y-1">
              {columns.slice(0, 16).map((f) => (
                <li key={f.name} className="flex min-w-0 items-center gap-1.5 text-xs">
                  <FieldIcon kind={f.kind} className="size-3" />
                  <span className="truncate">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  } else if (detail.kind === 'field') {
    body = (
      <div className="space-y-2 text-xs">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <FieldIcon kind={detail.field.kind} className="size-3" />
          {KIND_LABELS[detail.field.kind] ?? detail.field.kind}
          {' · '}
          {detail.table}
        </p>
        <p className="font-mono text-[0.7rem] text-muted-foreground">{detail.field.name}</p>
        {typeof detail.field.description === 'string' && detail.field.description !== '' && (
          <p className="leading-relaxed">{detail.field.description}</p>
        )}
      </div>
    )
  } else {
    body = <p className="text-xs leading-relaxed">{detail.text}</p>
  }

  return (
    <aside className="scroll-discret hidden w-64 shrink-0 overflow-y-auto border-l bg-muted/20 p-4 md:block">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
          {item.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.subtitle !== undefined && (
            <p className="truncate text-[0.7rem] text-muted-foreground">{item.subtitle}</p>
          )}
        </div>
      </div>
      {body}
    </aside>
  )
}

/** Every key of the application, in one place. */
function Shortcuts({ mod }: { readonly mod: string }) {
  const groups: ReadonlyArray<{
    readonly title: string
    readonly keys: ReadonlyArray<readonly [readonly string[], string]>
  }> = [
    {
      title: $t('Recherche'),
      keys: [
        [[mod, 'K'], $t('Ouvrir ou fermer la recherche')],
        [['↑', '↓'], $t('Parcourir les résultats')],
        [['↵'], $t('Ouvrir le résultat')],
        [['Tab'], $t('Chercher dans la table ou la base choisie')],
        [['⌫'], $t('Revenir en arrière, champ vide')],
        [['>'], $t('Seulement les commandes')],
        [['#'], $t('Seulement les tables et objets')],
        [['/'], $t('Seulement les lignes')],
        [['?'], $t('Poser une question au Copilot')],
      ],
    },
    {
      title: $t('Onglets'),
      keys: [
        [['Alt', 'W'], $t('Fermer l’onglet')],
        [['Ctrl', 'Tab'], $t('Onglet suivant')],
        [['Ctrl', 'Maj', 'Tab'], $t('Onglet précédent')],
        [[$t('Clic molette')], $t('Fermer un onglet')],
      ],
    },
    {
      title: $t('Grille'),
      keys: [
        [[mod, 'A'], $t('Tout sélectionner')],
        [[mod, 'C'], $t('Copier les cellules choisies')],
        [[mod, $t('clic')], $t('Suivre une relation')],
        [[mod, 'Z'], $t('Annuler la dernière écriture')],
        [[mod, 'Y'], $t('Rétablir l’écriture annulée')],
      ],
    },
    {
      title: $t('Texte'),
      keys: [
        [[mod, '↵'], $t('Envoyer un commentaire, enregistrer une description')],
        [[mod, 'B'], $t('Gras')],
        [[mod, 'I'], $t('Italique')],
        [[mod, 'K'], $t('Lien, dans l’éditeur de texte')],
      ],
    },
  ]
  return (
    <div className="grid gap-x-6 gap-y-4 p-2 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            {g.title}
          </p>
          <ul className="space-y-1">
            {g.keys.map(([keys, label]) => (
              <li key={label} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{label}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
        <Clock className="size-3.5" />
        {$t('Les résultats ouverts souvent et récemment remontent en tête.')}
      </p>
    </div>
  )
}
