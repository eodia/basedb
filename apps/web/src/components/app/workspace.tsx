'use client'

import { AiWaitingProvider, useAiWatch } from '@/components/app/ai-pending'
import { NotificationBell, Viewers } from '@/components/app/collab'
import { SearchField } from '@/components/app/command-palette'
import { CopilotPanel } from '@/components/app/copilot-panel'
import { CopilotToggle } from '@/components/app/copilot-toggle'
import { EnvironmentBadge } from '@/components/app/environment-badge'
import { ExpressionEditor, flatten, format } from '@/components/app/expression-editor'
import { FieldIcon } from '@/components/app/field-icon'
import type { Row } from '@/components/app/grid/cell'
import { rawText } from '@/components/app/grid/cell'
import { DataGrid, type RowColor, groupKey } from '@/components/app/grid/data-grid'
import { ColorMenu, GroupMenu, HeightMenu, SearchBox } from '@/components/app/grid/grid-toolbar'
import { PaginationBar } from '@/components/app/grid/pagination-bar'
import { SelectionBar } from '@/components/app/grid/selection-bar'
import { LookIcon } from '@/components/app/option-badge'
import type { SearchLink } from '@/components/app/pickers'
import { QuestionTab } from '@/components/app/question-tab'
import { NewRecordPanel, RecordPanel } from '@/components/app/record-panel'
import { SidebarToggle } from '@/components/app/sidebar'
import { SqlEditor } from '@/components/app/sql-editor'
import { SqlIllustration } from '@/components/app/sql-illustration'
import { QueryDialog, audienceIcon } from '@/components/app/sql/query-dialog'
import { SqlViewDialog } from '@/components/app/sql/sql-view-dialog'
import { TabBar } from '@/components/app/tab-bar'
import { TableEmptyState } from '@/components/app/table-empty-state'
import { TableFieldsProvider } from '@/components/app/table-fields'
import { CalendarView } from '@/components/app/views/calendar-view'
import { FormView } from '@/components/app/views/form-view'
import { GalleryView } from '@/components/app/views/gallery-view'
import { KanbanView, Unavailable } from '@/components/app/views/kanban-view'
import { ListView } from '@/components/app/views/list-view'
import { ShareFormDialog } from '@/components/app/views/share-dialog'
import { SortMenu } from '@/components/app/views/sort-menu'
import { TimelineView } from '@/components/app/views/timeline-view'
import { ViewDialog, type ViewDraft } from '@/components/app/views/view-dialog'
import { ViewSwitcher } from '@/components/app/views/view-switcher'
import { WorkspaceIllustration } from '@/components/app/workspace-illustration'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Hint, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type Aggregates,
  ApiError,
  type AppNotification,
  type BaseEnvironment,
  type DescribedBase,
  type Field,
  type LinkOption,
  type ReferencedBlock,
  type SavedQuery,
  type SavedView,
  type SqlResult,
  type SqlView,
  type StoredFile,
  type Table,
  type ViewKind,
  api,
} from '@/lib/api/client'
import { withValueFields } from '@/lib/computed'
import { compileMatcher } from '@/lib/evaluate'
import { type ExportFormat, copy, download, serialize } from '@/lib/export'
import { quoteLiteral } from '@/lib/expression'
import { searchClause, systemColumns } from '@/lib/grid'
import { $t, $tp, groupName, intlLocale } from '@/lib/i18n'
import { useLive } from '@/lib/live'
import { MembersProvider } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import {
  ROW_HEIGHTS,
  type SortTerm,
  type ViewState,
  arrangeFields,
  emptyView,
  sortParameter,
  useActiveTab,
  useWorkspace,
} from '@/lib/store/workspace'
import { asOneStep, configureJournal, journalKey, redo, startJournal, undo } from '@/lib/undo'
import { cn } from '@/lib/utils'
import {
  KIND_INFO,
  andFilter,
  calendarSpec,
  formSpec,
  freeLabel,
  gallerySpec,
  isModified,
  kanbanSpec,
  listSpec,
  specFromState,
  timelineSpec,
  viewStateOf,
} from '@/lib/views'
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Ellipsis,
  Eye,
  Filter,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Wand2,
  X,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * The working area — chapter 11 §1.
 *
 * One tab is one open thing, and everything the screen holds about it lives in
 * `useWorkspace`: the sort, the filter, the column overlay, the cursor stack. Switching
 * tabs restores a view instead of reloading a default one, which is the only reason tabs
 * are worth having.
 *
 * Two shapes, and the difference is the point:
 *
 *   un onglet TABLE occupe toute la page — c'est une grille, elle veut la largeur ;
 *   un onglet SQL partage la hauteur entre l'éditeur et le résultat.
 */

/**
 * Maps a PostgreSQL type name onto one of the nine kinds the grid renders.
 *
 * A guess, and it only decides the icon and whether the column is right-aligned — no
 * value is converted on the way in. `SELECT count(*)` comes back as `bigint`, which
 * nothing in the catalog would ever produce, so the mapping has to be by shape rather
 * than by lookup.
 */
function kindOfPgType(dataType: string): string {
  const type = dataType.toLowerCase()
  if (/int|numeric|decimal|real|double|money|serial/.test(type)) return 'number'
  if (type.startsWith('bool')) return 'boolean'
  if (type === 'date') return 'date'
  if (type.startsWith('timestamp') || type.startsWith('time')) return 'datetime'
  if (type === 'uuid') return 'link'
  if (/json|xml|bytea|\[\]/.test(type)) return 'long_text'
  return 'short_text'
}

/** How many rows of a link's target a picker lists at once. The API's own default page. */
const LINK_PAGE = 50

/** A row of a link's target as a picker lists it: its identifier and what to call it. */
function linkOptionOf(row: Record<string, unknown>, display: string | null): LinkOption {
  return {
    id: String(row._id),
    display: display === null ? String(row._id).slice(0, 8) : String(row[display] ?? ''),
  }
}

interface Props {
  readonly base: DescribedBase
  readonly tables: readonly Table[]
  /** Rereads the base's description — the copilot changed its structure. */
  readonly onBaseChanged?: () => Promise<void>
  /** The environments that are not production, by base name — what the tabs mark. */
  readonly environments?: ReadonlyMap<string, BaseEnvironment>
  /** The reader's account — to tell their own writes, mentions and presence apart. */
  readonly self?: string | null
  /**
   * A saved query or a SQL view was created, renamed, shared or deleted: the navigation,
   * which lists them under the base, reads them again.
   */
  readonly onNavigationChanged?: () => void
}

/** `-date,nom` as the view keeps it: three terms at most. */
function sortTerms(sort: string): SortTerm[] {
  return sort
    .split(',')
    .map((raw) => raw.trim())
    .filter((raw) => raw !== '')
    .map((raw) =>
      raw.startsWith('-')
        ? { field: raw.slice(1), direction: 'desc' as const }
        : { field: raw, direction: 'asc' as const },
    )
    .slice(0, 3)
}

export function Workspace({
  base,
  tables,
  onBaseChanged,
  environments,
  self = null,
  onNavigationChanged,
}: Props) {
  const tab = useActiveTab()
  const patchView = useWorkspace((s) => s.patchView)
  const setDraft = useWorkspace((s) => s.setDraft)
  const openSql = useWorkspace((s) => s.openSql)
  const openNewQuestion = useWorkspace((s) => s.openNewQuestion)
  const openTableTab = useWorkspace((s) => s.openTable)
  const reloadRows = useWorkspace((s) => s.reload)
  const checked = useWorkspace((s) => s.checked)
  const setChecked = useWorkspace((s) => s.setChecked)
  const cells = useWorkspace((s) => s.cells)
  const setCells = useWorkspace((s) => s.setCells)
  const copilotOpen = useWorkspace((s) => s.copilotOpen)
  const reloadTick = useWorkspace((s) => s.reloadTick)
  const setCopilotOpen = useWorkspace((s) => s.setCopilotOpen)
  const switchView = useWorkspace((s) => s.switchView)
  const pendingRecord = useWorkspace((s) => s.pendingRecord)
  const requestRecord = useWorkspace((s) => s.requestRecord)
  const attachQuery = useWorkspace((s) => s.attachQuery)
  const detachQuery = useWorkspace((s) => s.detachQuery)
  const openSqlViewTab = useWorkspace((s) => s.openSqlView)
  const dropSqlView = useWorkspace((s) => s.dropSqlView)
  const renameSqlView = useWorkspace((s) => s.renameSqlView)

  const [rows, setRows] = useState<readonly Row[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [linkOptions, setLinkOptions] = useState<Record<string, readonly LinkOption[]>>({})
  const [loading, setLoading] = useState(false)
  const [counting, setCounting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [editorHeight, setEditorHeight] = useState(180)
  const [opened, setOpened] = useState<Row | null>(null)
  /** True while the right panel holds a record being created rather than an existing one. */
  const [drafting, setDrafting] = useState(false)
  /** What that record starts with — a kanban column's choice, a calendar day. */
  const [draftValues, setDraftValues] = useState<Readonly<Record<string, unknown>>>({})
  const [referenced, setReferenced] = useState<readonly ReferencedBlock[]>([])

  // ── Saved views (ch. 11 §1.4) ─────────────────────────────────────────────────────
  const [views, setViews] = useState<readonly SavedView[]>([])
  /** The table whose views `views` holds — until then, a tab's view is not judged gone. */
  const [viewsOf, setViewsOf] = useState<string | null>(null)
  const [viewDialog, setViewDialog] = useState<{
    readonly kind: ViewKind
    readonly view?: SavedView
    readonly fromLayout?: boolean
  } | null>(null)
  /** The form or survey being shared (chapter 15), when its dialog is open. */
  const [sharing, setSharing] = useState<SavedView | null>(null)
  /**
   * Moves when rows were written while a view other than a grid is on screen: a kanban,
   * a calendar, a timeline read their own rows, and this is what asks them to again.
   */
  const [dataTick, setDataTick] = useState(0)

  // ── SQL tabs: a statement's, a saved query's, a SQL view's ────────────────────
  // One result per tab: coming back to a SQL tab finds what it showed, not the result of
  // the last statement run in another one.
  const [results, setResults] = useState<Readonly<Record<string, SqlResult>>>({})
  const [sqlErrors, setSqlErrors] = useState<
    Readonly<Record<string, { readonly message: string; readonly position: number | null }>>
  >({})
  const sqlResult = tab === null ? null : (results[tab.id] ?? null)
  const sqlError = tab === null ? null : (sqlErrors[tab.id] ?? null)
  const [running, setRunning] = useState(false)
  const formatRef = useRef<(() => void) | null>(null)
  /** The saved queries and SQL views the tabs show, as the server last described them. */
  const [savedQueries, setSavedQueries] = useState<Readonly<Record<string, SavedQuery>>>({})
  const [sqlViews, setSqlViews] = useState<Readonly<Record<string, SqlView>>>({})
  /** « Enregistrer sous », or a query's name and audience: `query` null saves a new one. */
  const [queryDialog, setQueryDialog] = useState<{ readonly query: SavedQuery | null } | null>(null)
  const [sqlViewDialog, setSqlViewDialog] = useState<{
    readonly view: SqlView | null
    readonly definition?: string
  } | null>(null)
  const [savingQuery, setSavingQuery] = useState(false)
  /** The tabs already read on opening — a saved query run once, a SQL view read once. */
  const autoRan = useRef(new Set<string>())

  const table = useMemo(
    () => (tab === null ? null : (tables.find((t) => t.name === tab.table) ?? null)),
    [tab, tables],
  )
  /** What the active tab is — a result tab (`sql`, `sqlview`) holds no page of a table. */
  const tabKind = tab?.kind ?? null
  const resultTab = tabKind === 'sql' || tabKind === 'sqlview'

  /** The saved view on screen, `null` for the table's own grid. */
  const activeView = useMemo(
    () =>
      tab === null || tab.kind !== 'table' || tab.viewId === null
        ? null
        : (views.find((v) => v.id === tab.viewId) ?? null),
    [tab, views],
  )
  const viewKind: ViewKind = activeView?.kind ?? 'grid'

  // The panel shows the row as the LAST LOAD returned it, not as it was when the panel
  // opened: a commit reloads the page, and a snapshot would keep displaying the value that
  // was just changed — a checkbox that refuses to uncheck. The snapshot only stands in for
  // a row that has left the page (filtered out, on another page). Outside the grid there is
  // no page: the row is read again after each commit instead.
  const openedRow = useMemo(
    () =>
      opened === null
        ? null
        : viewKind === 'grid'
          ? (rows.find((r) => r._id === opened._id) ?? opened)
          : opened,
    [opened, rows, viewKind],
  )

  /**
   * The columns the grid draws.
   *
   * On a table tab they come from the CATALOG, with their real types. On a SQL tab the
   * catalog knows nothing — `SELECT count(*), now()` has no fields — so they are
   * synthesised from the result's own column list, and the PostgreSQL type name is
   * mapped onto the nearest of the nine the grid renders. It only affects alignment and
   * the icon; nothing is converted on the way in.
   */
  const businessFields = useMemo(() => {
    if (resultTab) {
      // The key must be the one the SERVER built, which de-duplicates a repeated column
      // name as `nom__3`. `SELECT 1 AS a, 2 AS a` is legal SQL and a grid that keyed by
      // name alone would show the second value twice.
      const seen = new Set<string>()
      return (sqlResult?.columns ?? []).map((column, index) => {
        const key = seen.has(column.name) ? `${column.name}__${index}` : column.name
        seen.add(column.name)
        return {
          name: key,
          label: column.name,
          // A column of a result set is not in the catalog, so there is nothing to describe.
          description: null,
          kind: kindOfPgType(column.dataType),
          read_only: true,
          system: false,
          sortable: false,
        }
      })
    }
    // The system columns follow, hidden unless a view shows them (`systemColumns`). A
    // computed field carries the field its value reads as, built from the base's tables.
    return table === null
      ? []
      : [
          ...withValueFields(
            table.fields.filter((f) => f.system !== true),
            base.tables,
          ),
          ...systemColumns(table.fields),
        ]
  }, [resultTab, sqlResult, table, base.tables])

  const view: ViewState = tab?.view ?? emptyView()

  /** The filter the rows are read with: the view's, and the quick search over it. */
  const effectiveFilter = useMemo(
    () =>
      resultTab ? view.filter : andFilter(view.filter, searchClause(businessFields, view.search)),
    [resultTab, view.filter, view.search, businessFields],
  )

  /**
   * The sort the rows are read with. Grouped, the grid reads them sorted by the group
   * first: each group is then ONE run of rows, however many pages it spans.
   */
  const effectiveSorts = useMemo(
    () =>
      view.groupBy === null
        ? view.sorts
        : [
            { field: view.groupBy, direction: 'asc' as const },
            ...view.sorts.filter((s) => s.field !== view.groupBy),
          ].slice(0, 3),
    [view.sorts, view.groupBy],
  )

  const { visible, hidden, systemHidden } = useMemo(
    () => arrangeFields(businessFields, view),
    [businessFields, view],
  )

  const sortableFields = useMemo(
    () => new Set(businessFields.filter((f) => f.sortable !== false).map((f) => f.name)),
    [businessFields],
  )

  // ── Loading ──────────────────────────────────────────────────────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tab.id` and not `tab` — the tab object is rebuilt on every view patch, and depending on it would refetch the page each time a column is dragged or pinned.
  const load = useCallback(
    async (options: { count?: boolean; auto?: boolean } = {}) => {
      // A SQL tab holds a RESULT, not a page of a table: it reloads by re-running its
      // statement, which only the person who wrote it may decide to do.
      if (resultTab) return
      if (table === null || tab === null) return
      // A kanban, a calendar, a timeline read their own rows: a write asks them to read
      // again, and there is no page of the grid to load under them.
      if (viewKind !== 'grid') {
        if (options.auto !== true) setDataTick((t) => t + 1)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const page = await api.list(table, {
          sort: sortParameter(effectiveSorts),
          filter: effectiveFilter,
          limit: view.pageSize,
          after: view.cursors[view.cursors.length - 1],
          count: options.count === true,
        })
        setRows(page.data as readonly Row[])
        setNextCursor(page.meta.next_cursor)
        setHasNextPage(page.meta.has_next_page)
        if (options.count === true) {
          patchView(tab.id, {
            total: page.meta.count,
            totalCapped: page.meta.count_is_capped,
          })
        }
      } catch (e) {
        setError(messageFor(e))
        setRows([])
        setHasNextPage(false)
      } finally {
        setLoading(false)
        setCounting(false)
      }
    },
    // `tab.id` rather than `tab`: the object is rebuilt on every view patch, and
    // depending on it would reload the page each time a column is dragged.
    [
      table,
      tab?.id,
      resultTab,
      viewKind,
      effectiveSorts,
      effectiveFilter,
      view.pageSize,
      view.cursors,
      patchView,
    ],
  )

  /**
   * Runs a statement, and shows what comes back.
   *
   * The rows land in the ordinary grid. That is deliberate: sorting, pinning, hiding,
   * selecting, copying and exporting are already written and already familiar, and a
   * second table widget for results would be the same code with different bugs.
   */
  /** A result kept for a tab, or its refusal — the one or the other, never both. */
  const settle = useCallback((id: string, outcome: { result: SqlResult } | { error: unknown }) => {
    if ('result' in outcome) {
      setResults((was) => ({ ...was, [id]: outcome.result }))
      setSqlErrors(({ [id]: _gone, ...rest }) => rest)
      return
    }
    setResults(({ [id]: _gone, ...rest }) => rest)
    // The server hands back PostgreSQL's own message and the offset it pointed at, so
    // the editor can put the marker on the offending token rather than on line 1.
    const e = outcome.error
    const detail = e instanceof ApiError ? e.details : undefined
    const message = typeof detail?.message === 'string' ? detail.message : messageFor(e)
    const position = typeof detail?.position === 'number' ? detail.position : null
    setSqlErrors((was) => ({ ...was, [id]: { message, position } }))
    setError(message)
  }, [])

  const runSql = useCallback(
    async (statement: string, options: { readonly readOnly?: boolean } = {}) => {
      if (tab === null || statement.trim() === '') return
      const id = tab.id
      setRunning(true)
      setError(null)
      try {
        settle(id, { result: await api.runSql(base.name, statement, view.pageSize, options) })
      } catch (e) {
        settle(id, { error: e })
      } finally {
        setRunning(false)
      }
    },
    [tab, base.name, view.pageSize, settle],
  )

  /** Reads a SQL view's rows — with the reader's reach, as a statement would be read. */
  const readSqlView = useCallback(async () => {
    if (tab === null || tab.kind !== 'sqlview' || tab.sqlViewId === null) return
    const { id, sqlViewId } = tab
    setRunning(true)
    setError(null)
    try {
      const described = await api.sqlView(base.name, sqlViewId)
      setSqlViews((was) => ({ ...was, [sqlViewId]: described }))
      settle(id, { result: await api.readSqlView(base.name, sqlViewId, view.pageSize) })
    } catch (e) {
      settle(id, { error: e })
    } finally {
      setRunning(false)
    }
  }, [tab, base.name, view.pageSize, settle])

  // A result tab's grid shows ITS result. The grid keys rows by `_id`, and a result has
  // none — `SELECT 1` identifies nothing —: a positional key is the honest substitute, it
  // identifies a row OF THIS RESULT, which is exactly what a result row is.
  useEffect(() => {
    if (!resultTab) return
    setRows(
      sqlResult === null ? [] : sqlResult.rows.map((row, index) => ({ ...row, _id: `#${index}` })),
    )
    setHasNextPage(false)
    setNextCursor(null)
  }, [resultTab, sqlResult])

  // The saved query a SQL tab shows: what it is called, who sees it, who may change it —
  // read again when the navigation renamed it (the tab's label moved) or changed it (a
  // reload was asked for).
  const queryId = tab?.kind === 'sql' ? tab.queryId : null
  const tabLabel = tab?.label ?? null
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tabLabel` and `reloadTick` are the signals.
  useEffect(() => {
    if (queryId === null) return
    let live = true
    api.query(base.name, queryId).then(
      (found) => live && setSavedQueries((was) => ({ ...was, [queryId]: found })),
      (e) => {
        // Deleted, or no longer shared with this reader: the tab keeps its text, unsaved.
        if (live && e instanceof ApiError && e.code === 'RESOURCE_NOT_FOUND') detachQuery(queryId)
      },
    )
    return () => {
      live = false
    }
  }, [base.name, queryId, detachQuery, tabLabel, reloadTick])

  // A saved query opened runs at once — read only: nobody has decided yet to run its text
  // for real, and a shared one may hold a write its reader never looked at. A SQL view's
  // tab reads its rows. Once each: after that, « Exécuter » and « Actualiser » decide.
  const tabId = tab?.id ?? null
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the tab alone — the statement typed since must not run by itself.
  useEffect(() => {
    if (tab === null || autoRan.current.has(tab.id)) return
    if (results[tab.id] !== undefined || sqlErrors[tab.id] !== undefined) return
    if (tab.kind === 'sql' && tab.queryId !== null) {
      autoRan.current.add(tab.id)
      void runSql(tab.draft, { readOnly: true })
    } else if (tab.kind === 'sqlview') {
      autoRan.current.add(tab.id)
      void readSqlView()
    }
  }, [tabId])

  // A SQL view changed elsewhere — edited from the navigation: its open tab reads it again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadTick` alone is the signal.
  useEffect(() => {
    if (tab?.kind === 'sqlview' && autoRan.current.has(tab.id)) void readSqlView()
  }, [reloadTick])

  /**
   * « Enregistrer » in a SQL tab: its text into the saved query it shows, when the reader
   * may change it; otherwise a new query, named in a dialog.
   */
  const saveQuery = useCallback(async () => {
    if (tab === null || tab.kind !== 'sql') return
    const current = tab.queryId === null ? null : (savedQueries[tab.queryId] ?? null)
    if (current === null || !current.editable) {
      setQueryDialog({ query: null })
      return
    }
    setSavingQuery(true)
    try {
      const saved = await api.updateQuery(base.name, current.id, { statement: tab.draft })
      setSavedQueries((was) => ({ ...was, [saved.id]: saved }))
      toast.success($t('« {label} » enregistrée', { label: saved.label }))
    } catch (e) {
      toast.error(messageFor(e))
    } finally {
      setSavingQuery(false)
    }
  }, [tab, savedQueries, base.name])

  // `reloadTick` is not read: it moves when rows were written from outside the grid — an
  // import — and it is what makes the open table fetch them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    void load({ auto: true })
  }, [load, reloadTick])

  // ── Summary bar and group counts (ch. 11 §1.6) ───────────────────────────────────
  const [aggregates, setAggregates] = useState<Aggregates | null>(null)
  const summaryEntries = useMemo(
    () =>
      Object.entries(view.summaries).filter(([name]) =>
        businessFields.some((f) => f.name === name),
      ),
    [view.summaries, businessFields],
  )
  // Asked for only when a summary or a grouping is on screen — aggregating is a scan of
  // what the filter keeps — and again whenever the page is read again: a write moved it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `rows` is what says the data moved
  useEffect(() => {
    if (tab?.kind !== 'table' || table === null || viewKind !== 'grid') {
      setAggregates(null)
      return
    }
    if (view.groupBy === null && summaryEntries.length === 0) {
      setAggregates(null)
      return
    }
    let current = true
    api
      .aggregate(table, {
        filter: effectiveFilter,
        aggregates: summaryEntries.map(([field, fn]) => ({ field, fn })),
        group: view.groupBy,
      })
      .then((result) => {
        if (current) setAggregates(result)
      })
      .catch(() => {
        // A summary that cannot be computed shows nothing; the rows are not affected.
        if (current) setAggregates(null)
      })
    return () => {
      current = false
    }
  }, [tab?.kind, table, viewKind, effectiveFilter, summaryEntries, view.groupBy, rows])

  const groupField = useMemo(
    () =>
      view.groupBy === null ? null : (businessFields.find((f) => f.name === view.groupBy) ?? null),
    [view.groupBy, businessFields],
  )
  const groupCounts = useMemo(
    () =>
      aggregates?.groups == null
        ? null
        : new Map(aggregates.groups.map((g) => [groupKey(g.value), g.count] as const)),
    [aggregates],
  )

  // ── Row colours ──────────────────────────────────────────────────────────────────
  const colorMatchers = useMemo(
    () =>
      view.colorRules.flatMap((rule) => {
        const match = compileMatcher(rule.filter, businessFields)
        return match === null ? [] : [{ color: rule.color, style: rule.style, match }]
      }),
    [view.colorRules, businessFields],
  )
  const colorField = useMemo(
    () =>
      (businessFields.find((f) => f.name === view.colorField && f.kind === 'select') as
        | Field
        | undefined) ?? null,
    [view.colorField, businessFields],
  )
  // A row takes the colour AND the style of what colours it: the first rule it satisfies,
  // else its choice in the list.
  const rowColor = useCallback(
    (row: Row): RowColor | null => {
      for (const rule of colorMatchers) {
        if (rule.match(row)) return { color: rule.color, style: rule.style }
      }
      if (colorField === null) return null
      const color = colorField.options?.find((o) => o.value === row[colorField.name])?.color
      return color == null ? null : { color, style: view.colorStyle }
    },
    [colorMatchers, colorField, view.colorStyle],
  )
  const colored = colorMatchers.length > 0 || colorField !== null

  /** The saved views of the open table, in the order of its selector. */
  const loadViews = useCallback(async () => {
    if (table === null) {
      setViews([])
      setViewsOf(null)
      return
    }
    try {
      setViews(await api.views(table))
    } catch {
      // A table whose views cannot be read still has its own grid.
      setViews([])
    } finally {
      setViewsOf(table.name)
    }
  }, [table])

  useEffect(() => {
    void loadViews()
  }, [loadViews])

  // The AI cells the worker has yet to fill, read again until they are: a row just added
  // shows its value as soon as the model has answered, without a reload.
  const aiWaiting = useAiWatch(table, businessFields, rows, setRows)

  /** The options of every link column — so no cell ever asks anyone to type a UUID. */
  const resolveLinks = useCallback(async () => {
    if (table === null) return
    const resolved: Record<string, readonly LinkOption[]> = {}
    for (const field of table.fields) {
      const target = field.link?.target
      if (target === undefined) continue
      const display = field.link?.target_display_field ?? null
      try {
        const page = await api.list(
          { base: table.base, name: target },
          display === null ? {} : { sort: display },
        )
        resolved[field.name] = page.data.map((row) => linkOptionOf(row, display))
      } catch {
        // A target the reader cannot read has no options: the cell falls back to
        // showing what it has, which is the display value the server resolved.
      }
    }
    setLinkOptions(resolved)
  }, [table])

  useEffect(() => {
    void resolveLinks()
  }, [resolveLinks])

  /**
   * The rows of a link's target that match a text — what a link picker asks for as it is
   * typed into.
   *
   * The server does the matching whenever it can. The rows loaded above are one page, and
   * a target longer than that would never offer the rows past it. It can when the target's
   * display column is text, because `contains` is a text operator and refuses any other
   * type; for a number, a date or no display column at all, the first rows come back
   * as they are and the picker narrows them, saying so.
   */
  const searchLink = useCallback<SearchLink>(
    async (field, query) => {
      const target = field.link?.target
      if (table === null || target === undefined) {
        return { options: [], truncated: false, filtered: true }
      }

      const display = field.link?.target_display_field ?? null
      const displayKind = base.tables
        .find((t) => t.name === target)
        ?.fields.find((f) => f.name === display)?.kind
      const needle = query.trim()
      const server =
        display !== null && needle !== '' && ['short_text', 'long_text'].includes(displayKind ?? '')

      const page = await api.list(
        { base: table.base, name: target },
        {
          ...(display === null ? {} : { sort: display }),
          ...(server ? { filter: `${display} contains ${quoteLiteral(needle)}` } : {}),
          limit: LINK_PAGE,
        },
      )
      return {
        options: page.data.map((row) => linkOptionOf(row, display)),
        truncated: page.meta.has_next_page,
        filtered: server || needle === '',
      }
    },
    [table, base],
  )

  // ── Acts ─────────────────────────────────────────────────────────────────────

  /**
   * Outside the grid the panel's row is on no page the screen holds: after a write it is
   * read again by its identifier, or the panel would keep showing the value just changed.
   */
  const rereadOpened = useCallback(
    async (id: string) => {
      if (table === null || viewKind === 'grid') return
      try {
        const fresh = (await api.getRecord(table, id)) as Row
        setOpened((current) => (current?._id === id ? fresh : current))
      } catch {
        // A row gone meanwhile: the panel keeps what it showed, the view no longer has it.
      }
    },
    [table, viewKind],
  )

  const commit = useCallback(
    async (id: string, field: Field, value: unknown) => {
      if (table === null) return
      setBusy(id)
      setError(null)
      try {
        await api.updateRecord(table, id, { [field.name]: value })
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setBusy(null)
        // Reloaded either way: we never leave on screen a value the database refused.
        await load()
        await rereadOpened(id)
      }
    },
    [table, load, rereadOpened],
  )

  /**
   * Computes an AI field of one row again, now, and reads the row back. The call is the
   * model's, so it takes seconds; the button says so meanwhile.
   */
  const recompute = useCallback(
    async (id: string, field: Field) => {
      if (table === null) return
      setError(null)
      try {
        await api.runAiCell(table, field.name, id)
      } catch (e) {
        setError(messageFor(e))
      } finally {
        await load()
        await rereadOpened(id)
      }
    },
    [table, load, rereadOpened],
  )

  /**
   * Deposits files for a field, one after the other. What made it is returned — the cell
   * then writes it into the row —, and the first refusal is said in the banner and stops
   * the rest: a file too large is usually one of several picked together.
   */
  const upload = useCallback(
    async (field: Field, files: readonly File[]): Promise<readonly StoredFile[]> => {
      if (table === null) return []
      setError(null)
      const done: StoredFile[] = []
      for (const file of files) {
        try {
          done.push(await api.uploadFile(table, field.name, file))
        } catch (e) {
          setError(`${file.name} : ${messageFor(e)}`)
          break
        }
      }
      return done
    },
    [table],
  )

  const create = useCallback(
    async (values: Record<string, unknown>) => {
      if (table === null) return
      setError(null)
      try {
        await api.createRecord(table, values)
        await load()
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [table, load],
  )

  const remove = useCallback(
    async (id: string) => {
      if (table === null) return
      setBusy(id)
      setError(null)
      try {
        await api.deleteRecord(table, id)
        await load()
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setBusy(null)
      }
    },
    [table, load],
  )

  /** Opens the detail view, and asks for the rows that reference this one (§5.2). */
  const openRecord = useCallback(
    async (row: Row) => {
      setDrafting(false)
      setOpened(row)
      setReferenced([])
      if (table === null) return
      try {
        setReferenced(await api.referencedBy(table, row._id))
      } catch {
        // A table with no inverse group simply has none to show.
        setReferenced([])
      }
    },
    [table],
  )

  /**
   * The row a link points at, waiting for its table to be the one on screen: following a
   * link to another table opens that table's tab first, and the panel once it is there.
   */
  const [following, setFollowing] = useState<{ table: string; id: string } | null>(null)

  /**
   * Follows a link — Ctrl+click on a link cell, the link of the panel, a row that points
   * here: the target table's tab, then the row in the panel, read by its identifier since
   * it may be on no page loaded.
   */
  const followLink = useCallback(
    (target: string, id: string) => {
      const found = base.tables.find((t) => t.name === target)
      if (found === undefined) {
        setError($t('Cette table ne vous est pas ouverte.'))
        return
      }
      setDrafting(false)
      if (table?.name !== target) {
        // The panel of the row left behind does not follow to the other tab.
        setOpened(null)
        openTableTab(found, found.label)
      }
      setFollowing({ table: target, id })
    },
    [base.tables, table, openTableTab],
  )

  useEffect(() => {
    if (following === null || table === null || table.name !== following.table) return
    let current = true
    api
      .getRecord(table, following.id)
      .then((row) => {
        if (current) void openRecord(row as Row)
      })
      .catch((e) => {
        if (current) setError(messageFor(e))
      })
      .finally(() => {
        if (current) setFollowing(null)
      })
    return () => {
      current = false
    }
  }, [following, table, openRecord])

  /**
   * Writes the record the panel drafted, then shows it as any other: the panel turns into
   * the new row's detail view, which is where one checks what the database kept. A refusal
   * is handed back to the panel, which stays open on what was typed.
   */
  const createFromPanel = useCallback(
    async (values: Record<string, unknown>): Promise<string | null> => {
      if (table === null) return null
      try {
        const created = (await api.createRecord(table, values)) as Row
        await load()
        void openRecord(created)
        return null
      } catch (e) {
        return messageFor(e)
      }
    },
    [table, load, openRecord],
  )

  // A draft belongs to the table it was opened on.
  const tableName = table?.name
  // biome-ignore lint/correctness/useExhaustiveDependencies: the draft is closed WHEN the table changes, which is what the dependency says
  useEffect(() => setDrafting(false), [tableName])

  /**
   * Deletes the selected rows.
   *
   * One call per row, because the API has no bulk endpoint and inventing one on the
   * client — a loop called a batch — would report a partial failure as a total one. The
   * first refusal stops the loop and says how many went through, which is the truth.
   */
  const removeChecked = useCallback(async () => {
    if (table === null || checked.size === 0) return
    setDeleting(true)
    setError(null)
    let done = 0
    try {
      // One gesture, one Ctrl+Z: every deletion of the selection is undone together.
      await asOneStep(
        $tp(checked.size, 'suppression de {count} ligne', 'suppression de {count} lignes'),
        async () => {
          for (const id of checked) {
            await api.deleteRecord(table, id)
            done++
          }
        },
      )
      setChecked(new Set())
    } catch (e) {
      setError(
        `${messageFor(e)} — ${$tp(done, '{count} ligne sur {total} supprimée.', '{count} lignes sur {total} supprimées.', { total: checked.size })}`,
      )
    } finally {
      setDeleting(false)
      await load()
    }
  }, [table, checked, setChecked, load])

  // ── Exports ──────────────────────────────────────────────────────────────────

  /** The rows an export covers: the selection when there is one, the page otherwise. */
  const exportRows = useCallback((): readonly Row[] => {
    if (checked.size > 0) return rows.filter((r) => checked.has(r._id))
    if (cells.size > 0) {
      const indexes = new Set(
        [...cells].map((key) => Number.parseInt(key.slice(0, key.indexOf(':')), 10)),
      )
      return rows.filter((_, i) => indexes.has(i))
    }
    return rows
  }, [checked, cells, rows])

  const onExport = useCallback(
    (format: ExportFormat) => {
      const name = table?.name ?? 'export'
      download(format, serialize(format, exportRows(), visible, table?.sql ?? name), name)
    },
    [table, visible, exportRows],
  )

  const onCopy = useCallback(
    (format: ExportFormat) => {
      const name = table?.sql ?? 'table'
      void copy(serialize(format, exportRows(), visible, name))
    },
    [table, visible, exportRows],
  )

  // ── Sorting, filtering, paging ───────────────────────────────────────────────

  const patch = useCallback(
    (next: Partial<ViewState>) => {
      if (tab !== null) patchView(tab.id, next)
    },
    [tab, patchView],
  )

  const applyFilter = useCallback(
    (expression: string) => {
      // Every change of sort, filter or projection THROWS the cursor: it is bound to
      // the fingerprint of its query, and replaying it under another one would skip or
      // repeat rows (ch. 11 §1.2).
      patch({ filter: flatten(expression), cursors: [], total: null })
    },
    [patch],
  )

  // ── Views ────────────────────────────────────────────────────────────────────

  /**
   * Shows a saved view — `null`: the table's own grid, as it was left — in the open tab.
   * A saved view opens as it was SAVED: its filter, its sort, its columns; whatever was
   * tried over it before is not carried over.
   */
  const enterView = useCallback(
    (target: SavedView | null) => {
      if (tab === null) return
      if (target === null) {
        switchView(tab.id, null, null, format(tab.ownView?.filter ?? ''))
      } else {
        const state = viewStateOf(target, tab.view)
        switchView(tab.id, target.id, state, format(state.filter))
      }
      setError(null)
      setFilterOpen(false)
    },
    [tab, switchView],
  )

  // A tab showing a view deleted since — by someone else, on another screen — falls back
  // on the table's own grid rather than on an empty screen.
  useEffect(() => {
    if (tab === null || tab.kind !== 'table' || tab.viewId === null) return
    if (table === null || viewsOf !== table.name) return
    if (!views.some((v) => v.id === tab.viewId)) enterView(null)
  }, [tab, table, views, viewsOf, enterView])

  // The view an address names — a bookmark, the browser's back: shown once the table's views
  // are read. One no longer there leaves the grid as it is, and the address says so.
  const pendingView = useWorkspace((s) => s.pendingView)
  const requestView = useWorkspace((s) => s.requestView)
  useEffect(() => {
    if (pendingView === null || tab === null || tab.kind !== 'table' || table === null) return
    if (tab.base !== pendingView.base || tab.table !== pendingView.table) return
    if (viewsOf !== table.name) return
    requestView(null)
    if (tab.viewId === pendingView.viewId) return
    const target =
      pendingView.viewId === null ? null : views.find((v) => v.id === pendingView.viewId)
    if (target !== undefined) enterView(target)
  }, [pendingView, tab, table, views, viewsOf, enterView, requestView])

  /** A view as the server returned it, put in the list at once — before the list reloads. */
  const keepView = useCallback((saved: SavedView) => {
    setViews((current) =>
      current.some((v) => v.id === saved.id)
        ? current.map((v) => (v.id === saved.id ? saved : v))
        : [...current, saved],
    )
  }, [])

  const submitView = useCallback(
    async (draft: ViewDraft): Promise<string | null> => {
      if (table === null || viewDialog === null) return null
      try {
        const saved =
          viewDialog.view === undefined
            ? await api.createView(table, draft)
            : await api.updateView(table, viewDialog.view.id, {
                label: draft.label,
                description: draft.description,
                spec: draft.spec,
              })
        keepView(saved)
        // What was just built or reconfigured is what the screen then shows.
        enterView(saved)
        setViewDialog(null)
        void loadViews()
        return null
      } catch (e) {
        return messageFor(e)
      }
    },
    [table, viewDialog, keepView, enterView, loadViews],
  )

  const renameView = useCallback(
    async (target: SavedView, label: string): Promise<string | null> => {
      if (table === null) return null
      try {
        keepView(await api.updateView(table, target.id, { label }))
        return null
      } catch (e) {
        return messageFor(e)
      }
    },
    [table, keepView],
  )

  const duplicateView = useCallback(
    async (target: SavedView) => {
      if (table === null) return
      try {
        // A reader who does not build duplicates for themselves: a personal copy.
        const copy = await api.createView(table, {
          label: freeLabel(`${target.label} (copie)`, views),
          kind: target.kind,
          description: target.description,
          spec: target.spec,
          personal: target.personal || !base.actions.includes('manage_schema'),
        })
        keepView(copy)
        enterView(copy)
        void loadViews()
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [table, views, keepView, enterView, loadViews, base.actions],
  )

  /** Locks or unlocks a collaborative view (ch. 11 §1.6). */
  const lockView = useCallback(
    async (target: SavedView, locked: boolean) => {
      if (table === null) return
      try {
        keepView(await api.updateView(table, target.id, { locked }))
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [table, keepView],
  )

  const deleteView = useCallback(
    async (target: SavedView) => {
      if (table === null) return
      try {
        await api.deleteView(table, target.id)
        if (tab?.viewId === target.id) enterView(null)
        setViews((current) => current.filter((v) => v.id !== target.id))
        void loadViews()
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [table, tab?.viewId, enterView, loadViews],
  )

  const reorderViews = useCallback(
    async (ids: readonly string[]) => {
      if (table === null) return
      try {
        await api.reorderViews(table, ids)
      } catch (e) {
        setError(messageFor(e))
      } finally {
        await loadViews()
      }
    },
    [table, loadViews],
  )

  /** Writes what was changed on screen — filter, sort, columns — into the view on screen. */
  const saveView = useCallback(async () => {
    if (table === null || activeView === null) return
    try {
      keepView(
        await api.updateView(table, activeView.id, { spec: specFromState(activeView, view) }),
      )
    } catch (e) {
      setError(messageFor(e))
    }
  }, [table, activeView, view, keepView])

  /**
   * The order of a kanban's columns, written into the view as SAVED — not with the filter
   * being tried over it, which stays a proposal until someone saves it. A refusal is
   * thrown back: the board puts its columns where they were.
   */
  const saveGroupOrder = useCallback(
    async (order: readonly string[]) => {
      if (table === null || activeView === null) return
      keepView(
        await api.updateView(table, activeView.id, {
          spec: { ...activeView.spec, group_order: order },
        }),
      )
    },
    [table, activeView, keepView],
  )

  /** The rows' order by hand, written into the view as saved — like the columns' order. */
  const saveManualOrder = useCallback(
    async (order: readonly string[]) => {
      if (table === null || activeView === null) return
      keepView(
        await api.updateView(table, activeView.id, {
          spec: { ...activeView.spec, manual_order: order },
        }),
      )
    },
    [table, activeView, keepView],
  )

  // Another table on screen — a tab, a base, a template just built: the panel of a row of
  // the table left behind closes, rather than drawing that row with this table's fields.
  // A link followed opens its row afterwards, once the table is there.
  const tableKey = `${base.name}/${table?.name ?? ''}`
  useEffect(() => {
    void tableKey
    setOpened(null)
    setDrafting(false)
  }, [tableKey])

  // The row in the panel is part of the address; and the browser going back to where no row
  // was open closes it. Gone from the screen with the workspace.
  const setShownRecord = useWorkspace((s) => s.setShownRecord)
  const closeRecordTick = useWorkspace((s) => s.closeRecordTick)
  const shownId = opened?._id ?? null
  useEffect(() => setShownRecord(shownId), [shownId, setShownRecord])
  useEffect(() => () => setShownRecord(null), [setShownRecord])
  useEffect(() => {
    if (closeRecordTick > 0) setOpened(null)
  }, [closeRecordTick])

  /** Opens the new-record panel, the row already holding `values`. */
  const addRecord = useCallback((values: Readonly<Record<string, unknown>>) => {
    setOpened(null)
    setDraftValues(values)
    setDrafting(true)
  }, [])

  const bumpData = useCallback(() => setDataTick((t) => t + 1), [])

  // ── Collaboration (chapter 16) ────────────────────────────────────────────────────
  const [commentsTick, setCommentsTick] = useState(0)
  const [notificationsTick, setNotificationsTick] = useState(0)
  const onSql = tab !== null && tab.kind !== 'table'
  const live = useLive(
    {
      base: base.name,
      table: onSql ? null : (table?.name ?? null),
      record: opened?._id ?? null,
    },
    {
      // Someone else wrote: the page is read again, and the open row with it. One's own
      // writes are already on screen.
      onRecords: (ids, actor) => {
        if (actor !== null && actor === self) return
        reloadRows()
        bumpData()
        const openId = opened?._id
        if (openId !== undefined && (ids === null || ids.includes(openId))) {
          void rereadOpened(openId)
        }
      },
      onComments: () => setCommentsTick((t) => t + 1),
      onNotifications: () => setNotificationsTick((t) => t + 1),
    },
  )

  /** A notification opens its row — here, or in its own base (the page opens it). */
  const openNotification = useCallback(
    (n: AppNotification) => {
      if (n.base.name === base.name) followLink(n.table.name, n.record_id)
      else requestRecord({ base: n.base.name, table: n.table.name, id: n.record_id })
    },
    [base.name, followLink, requestRecord],
  )
  useEffect(() => {
    if (pendingRecord === null || pendingRecord.base !== base.name) return
    requestRecord(null)
    followLink(pendingRecord.table, pendingRecord.id)
  }, [pendingRecord, base.name, followLink, requestRecord])

  // The undo journal: one per tab, hearing every write (chapter 16 §4).
  useEffect(() => startJournal(), [])
  const fieldLabels = useMemo(
    () => new Map((table?.fields ?? []).map((f) => [f.name, f.label])),
    [table],
  )
  useEffect(() => {
    configureJournal({
      labelOf: (name) => fieldLabels.get(name) ?? name,
      applied: () => {
        reloadRows()
        bumpData()
        if (opened !== null) void rereadOpened(opened._id)
      },
    })
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = journalKey(event)
      if (action === null) return
      event.preventDefault()
      void (action === 'undo' ? undo() : redo())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const headerTools = (
    <>
      {!onSql && <Viewers viewers={live.viewers} self={self} />}
      <NotificationBell tick={notificationsTick} onOpen={openNotification} />
    </>
  )

  if (tab === null) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <Header base={base} tools={headerTools} />
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-6 text-center">
          <div className="my-auto w-full max-w-md py-6">
            <WorkspaceIllustration />
            <h1 className="text-xl font-semibold tracking-tight">{$t('À vous d’explorer.')}</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {$t('Choisissez une table ou ouvrez une requête SQL.')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => openSql(base.name, null, $t('Requête 1'))}
            >
              <Plus className="size-4" />
              {$t('Nouvelle requête SQL')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const someSelected = checked.size > 0 || cells.size > 0
  // A statement's result, a saved query's, a SQL view's rows: the grid shows a RESULT.
  const isSql = tab.kind !== 'table'
  const shownQuery = tab.queryId === null ? null : (savedQueries[tab.queryId] ?? null)
  const shownView = tab.sqlViewId === null ? null : (sqlViews[tab.sqlViewId] ?? null)
  const manages = base.actions.includes('manage_schema')
  // The grid shows a SQL result, the table's own rows and every saved grid; the other
  // kinds draw themselves.
  const gridShown = isSql || viewKind === 'grid'
  const dataView = isSql || KIND_INFO[viewKind].data
  // Building a view is building the base (ch. 05 §9): the verb is held on the base.
  const canManageViews = table !== null && base.actions.includes('manage_schema')
  /**
   * Whether the view on screen may be written: its owner's, when personal; a builder's,
   * when collaborative and not locked (ch. 11 §1.6).
   */
  const canEditView =
    activeView !== null && (activeView.personal || (canManageViews && !activeView.locked))
  const modified = activeView !== null && isModified(activeView, view)
  const ownGridArranged =
    view.filter !== '' ||
    view.sorts.length > 0 ||
    view.hidden.length > 0 ||
    view.pinned.length > 0 ||
    view.columnOrder !== null ||
    view.groupBy !== null ||
    Object.keys(view.summaries).length > 0 ||
    view.colorField !== null ||
    view.colorRules.length > 0 ||
    view.rowHeight !== 'short' ||
    view.systemColumns.length > 0

  return (
    <AiWaitingProvider value={aiWaiting}>
      <MembersProvider>
        {/* The top bar spans the width; the copilot and the record open beneath it. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            base={base}
            table={table}
            tools={
              <>
                {headerTools}
                <CopilotToggle />
              </>
            }
          />
          <div className="flex min-h-0 min-w-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <TabBar
                tables={tables}
                environments={environments}
                onNew={(kind) => {
                  const tabs = useWorkspace.getState().tabs
                  if (kind === 'statement') {
                    openSql(
                      base.name,
                      null,
                      $t('Requête {value}', {
                        value: tabs.filter((t) => t.kind === 'sql').length + 1,
                      }),
                    )
                  } else {
                    openNewQuestion(
                      base.name,
                      kind,
                      $t('Question {count}', {
                        count: tabs.filter((t) => t.kind === 'question').length + 1,
                      }),
                    )
                  }
                }}
              />

              {tab.kind === 'question' ? (
                <QuestionTab
                  key={tab.id}
                  base={base}
                  tab={tab}
                  manages={manages}
                  onNavigationChanged={() => onNavigationChanged?.()}
                />
              ) : (
                <>
                  {/* The SQL pane — an editor, and a splitter that is a real one. */}
                  {tab.kind === 'sql' && (
                    <>
                      <div
                        className="flex shrink-0 flex-col border-b bg-background"
                        style={{ height: editorHeight }}
                      >
                        <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
                          {shownQuery !== null ? (
                            <QueryTitle
                              query={shownQuery}
                              modified={shownQuery.statement !== tab.draft}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {$t('Sur')} <span className="text-foreground">{base.label}</span>
                            </span>
                          )}
                          {sqlResult !== null && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {$t('{command} · {row_count} · {duration_ms} ms', {
                                command: sqlResult.command,
                                row_count: $tp(
                                  sqlResult.row_count,
                                  '{count} ligne',
                                  '{count} lignes',
                                ),
                                duration_ms: sqlResult.duration_ms,
                              })}
                              {sqlResult.truncated && (
                                <span className="ml-1 text-destructive">{$t('— tronqué')}</span>
                              )}
                            </span>
                          )}
                          {sqlResult?.mode === 'reader' && <ReaderBadge />}
                          <div className="flex-1" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => void saveQuery()}
                                disabled={savingQuery || tab.draft.trim() === ''}
                              >
                                {savingQuery ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Save className="size-3.5" />
                                )}
                                {$t('Enregistrer')}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {shownQuery?.editable === true
                                ? $t('Enregistrer le texte de « {label} »', {
                                    label: shownQuery.label,
                                  })
                                : $t('Ranger cette requête sous les tables de la base')}
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-7"
                                aria-label={$t('Autres actions sur la requête')}
                              >
                                <Ellipsis className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              <DropdownMenuItem
                                disabled={tab.draft.trim() === ''}
                                onSelect={() => setQueryDialog({ query: null })}
                              >
                                <BookmarkPlus className="size-4" />
                                {$t('Enregistrer sous…')}
                              </DropdownMenuItem>
                              {shownQuery?.editable === true && (
                                <DropdownMenuItem
                                  onSelect={() => setQueryDialog({ query: shownQuery })}
                                >
                                  <Pencil className="size-4" />
                                  {$t('Nom et partage…')}
                                </DropdownMenuItem>
                              )}
                              {manages && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={tab.draft.trim() === ''}
                                    onSelect={() =>
                                      setSqlViewDialog({ view: null, definition: tab.draft })
                                    }
                                  >
                                    <Eye className="size-4" />
                                    {$t('Créer une vue SQL…')}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => formatRef.current?.()}
                              >
                                <Wand2 className="size-3.5" />
                                {$t('Mettre en forme')}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{$t('Maj+Alt+F')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => void runSql(tab.draft)}
                                disabled={running}
                              >
                                {running ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Play className="size-3.5" />
                                )}
                                {$t('Exécuter')}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{$t('Ctrl+Entrée')}</TooltipContent>
                          </Tooltip>
                        </div>

                        <SqlEditor
                          value={tab.draft}
                          base={base}
                          onChange={(next) => setDraft(tab.id, next)}
                          onRun={(statement) => void runSql(statement)}
                          serverError={sqlError}
                          onReady={(api) => {
                            formatRef.current = api.format
                          }}
                        />
                      </div>
                      <Splitter
                        onResize={(delta) => setEditorHeight((h) => Math.max(96, h + delta))}
                      />
                    </>
                  )}

                  {/* A SQL view: what it is, how many rows it gave, and a way to read it again. */}
                  {tab.kind === 'sqlview' && (
                    <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-background px-3">
                      <LookIcon
                        look={shownView ?? {}}
                        fallback={Eye}
                        className="text-muted-foreground"
                      />
                      <span className="truncate text-sm font-medium">
                        {shownView?.label ?? tab.label}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                        {$t('Vue SQL')}
                      </span>
                      {shownView !== null && (
                        <code className="hidden truncate font-mono text-xs text-muted-foreground md:inline">
                          {shownView.name}
                        </code>
                      )}
                      {sqlResult !== null && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {$t('{row_count} · {duration_ms} ms', {
                            row_count: $tp(sqlResult.row_count, '{count} ligne', '{count} lignes'),
                            duration_ms: sqlResult.duration_ms,
                          })}
                          {sqlResult.truncated && (
                            <span className="ml-1 text-destructive">{$t('— tronqué')}</span>
                          )}
                        </span>
                      )}
                      {sqlResult?.mode === 'reader' && <ReaderBadge />}
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => void readSqlView()}
                        disabled={running}
                      >
                        {running ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        {$t('Actualiser')}
                      </Button>
                      {shownView?.editable === true && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => setSqlViewDialog({ view: shownView })}
                        >
                          <Pencil className="size-3.5" />
                          {$t('Modifier la vue…')}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Toolbar, or the selection bar that replaces it. */}
                  {someSelected ? (
                    <SelectionBar
                      count={checked.size}
                      cellCount={cells.size}
                      deleting={deleting}
                      editable={!isSql && table?.actions.includes('delete') === true}
                      onClear={() => {
                        setChecked(new Set())
                        setCells(new Set())
                      }}
                      onDelete={() => void removeChecked()}
                      onCopy={onCopy}
                      onExport={onExport}
                    />
                  ) : (
                    <Toolbar
                      table={table}
                      view={view}
                      hidden={gridShown ? hidden : []}
                      systemHidden={gridShown ? systemHidden : []}
                      filterOpen={filterOpen}
                      loading={gridShown && loading}
                      filterable={dataView}
                      switcher={
                        !isSql && table !== null ? (
                          <ViewSwitcher
                            views={views}
                            activeId={activeView?.id ?? null}
                            canManage={canManageViews}
                            modified={modified}
                            onSelect={(id) => {
                              if (id === (activeView?.id ?? null)) return
                              enterView(
                                id === null ? null : (views.find((v) => v.id === id) ?? null),
                              )
                            }}
                            onCreate={(kind) => setViewDialog({ kind })}
                            onConfigure={(target) =>
                              setViewDialog({ kind: target.kind, view: target })
                            }
                            onRename={renameView}
                            onDuplicate={(target) => void duplicateView(target)}
                            onDelete={deleteView}
                            onReorder={reorderViews}
                            onShare={(target) => setSharing(target)}
                            onLock={(target, locked) => void lockView(target, locked)}
                          />
                        ) : undefined
                      }
                      sortMenu={
                        !isSql && !gridShown && dataView ? (
                          <SortMenu
                            fields={businessFields}
                            sorts={view.sorts}
                            onChange={(sorts) => patch({ sorts, cursors: [] })}
                          />
                        ) : undefined
                      }
                      gridTools={
                        !isSql && table !== null && gridShown ? (
                          <>
                            <GroupMenu
                              fields={businessFields}
                              value={view.groupBy}
                              onChange={(groupBy) => patch({ groupBy, cursors: [], total: null })}
                            />
                            <ColorMenu
                              fields={businessFields}
                              field={view.colorField}
                              rules={view.colorRules}
                              colorStyle={view.colorStyle}
                              onField={(colorField) => patch({ colorField })}
                              onRules={(colorRules) => patch({ colorRules })}
                              onStyle={(colorStyle) => patch({ colorStyle })}
                            />
                            <HeightMenu
                              value={view.rowHeight}
                              onChange={(rowHeight) => patch({ rowHeight })}
                            />
                          </>
                        ) : undefined
                      }
                      search={
                        !isSql && table !== null && dataView ? (
                          <SearchBox
                            value={view.search}
                            onChange={(text) => patch({ search: text, cursors: [], total: null })}
                          />
                        ) : undefined
                      }
                      viewActions={
                        isSql || table === null ? undefined : (
                          <>
                            {modified && activeView !== null && (
                              <div className="flex items-center gap-0.5 rounded-md bg-amber-500/10 pl-2 text-xs">
                                <span className="text-amber-700 dark:text-amber-400">
                                  {$t('Vue modifiée')}
                                </span>
                                {canEditView && (
                                  <Hint
                                    label={$t(
                                      'Enregistrer le filtre, le tri et les colonnes dans la vue, pour tous',
                                    )}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 px-2 text-xs"
                                      onClick={() => void saveView()}
                                    >
                                      <Save className="size-3.5" />
                                      {$t('Enregistrer')}
                                    </Button>
                                  </Hint>
                                )}
                                <Hint label={$t('Revenir à la vue telle qu’elle est enregistrée')}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 px-2 text-xs"
                                    onClick={() => enterView(activeView)}
                                  >
                                    <RotateCcw className="size-3.5" />
                                    {$t('Rétablir')}
                                  </Button>
                                </Hint>
                              </div>
                            )}
                            {activeView?.locked && (
                              <Hint
                                label={$t(
                                  'Vue verrouillée : déverrouillez-la depuis le sélecteur pour la modifier',
                                )}
                              >
                                <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
                                  <Lock className="size-3.5" />
                                  {$t('Verrouillée')}
                                </span>
                              </Hint>
                            )}
                            {activeView !== null && canEditView && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() =>
                                  setViewDialog({ kind: activeView.kind, view: activeView })
                                }
                              >
                                <Settings2 className="size-3.5" />
                                {$t('Configurer')}
                              </Button>
                            )}
                            {activeView === null && ownGridArranged && (
                              <Hint
                                label={
                                  canManageViews
                                    ? $t('Garder ce filtre, ce tri et ces colonnes dans une vue')
                                    : $t(
                                        'Garder ce filtre, ce tri et ces colonnes dans une vue personnelle',
                                      )
                                }
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 px-2 text-xs"
                                  onClick={() => setViewDialog({ kind: 'grid', fromLayout: true })}
                                >
                                  <BookmarkPlus className="size-3.5" />
                                  {$t('Enregistrer comme vue')}
                                </Button>
                              </Hint>
                            )}
                          </>
                        )
                      }
                      // On an expression tab the filter IS the pane above and the rows are a
                      // result, not a table: offering a second filter control and an "Ajouter"
                      // button would be two ways in for one thing, and one verb with nowhere to go.
                      editable={!isSql}
                      // Adding writes rows: not offered where the reader may not.
                      writable={table?.actions.includes('create') === true}
                      onToggleFilter={() => setFilterOpen((o) => !o)}
                      onClearSort={() => patch({ sorts: [], cursors: [] })}
                      onDropSort={(field) =>
                        patch({ sorts: view.sorts.filter((s) => s.field !== field), cursors: [] })
                      }
                      onShow={(name) => patch({ hidden: view.hidden.filter((h) => h !== name) })}
                      onShowAll={() => patch({ hidden: [] })}
                      onShowSystem={(name) =>
                        patch({ systemColumns: [...view.systemColumns, name] })
                      }
                      onAdd={() => addRecord({})}
                    />
                  )}

                  {/* On a table tab the filter is an inline strip; on an expression tab it is the
                pane above, and showing both would be two editors of one thing. */}
                  {!isSql && filterOpen && table !== null && (
                    <div className="shrink-0 border-b bg-background px-4 py-2">
                      <div className="flex items-start gap-2">
                        <div className="flex min-h-9 flex-1 rounded-lg border">
                          <ExpressionEditor
                            value={tab.draft}
                            fields={businessFields}
                            placeholder={$t('montant gt 100 and nom contains "a"')}
                            onChange={(next) => setDraft(tab.id, next)}
                            onRun={() => applyFilter(tab.draft)}
                            serverError={error}
                          />
                        </div>
                        <Button size="sm" onClick={() => applyFilter(tab.draft)}>
                          {$t('Appliquer')}
                        </Button>
                        {view.filter !== '' && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setDraft(tab.id, '')
                              applyFilter('')
                            }}
                            aria-label={$t('Retirer le filtre')}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {$t('Ctrl+Espace pour l’autocomplétion.')}
                      </p>
                    </div>
                  )}

                  {error !== null && !filterOpen && !isSql && (
                    <div className="mx-4 my-2 shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  {/* A SQL tab has no table by design — its columns come from the result. The
                missing-table message belongs to a table tab whose table was deleted. */}
                  {!isSql && table === null ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                      {$t('Cette table n’existe plus.')}
                    </div>
                  ) : isSql && sqlError !== null ? (
                    // The refusal goes HERE, not only in the gutter. A marker in the margin says
                    // that something is wrong; a console user needs to read what.
                    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto scroll-discret p-6">
                      <div className="w-full max-w-2xl rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                        <p className="text-sm font-medium text-destructive">
                          {tab.kind === 'sqlview'
                            ? $t('La vue ne peut pas être lue')
                            : $t('Erreur SQL')}
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-destructive">
                          {sqlError.message}
                        </pre>
                        {tab.kind === 'sqlview' && shownView?.editable === true && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setSqlViewDialog({ view: shownView })}
                          >
                            <Pencil className="size-4" />
                            {$t('Modifier la vue…')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : isSql && sqlResult === null ? (
                    <div className="scroll-discret flex min-h-0 flex-1 overflow-auto p-6">
                      <div className="m-auto w-full max-w-sm text-center">
                        {tab.kind !== 'sqlview' && !running && <SqlIllustration />}
                        <p className="text-sm text-muted-foreground">
                          {tab.kind === 'sqlview'
                            ? $t('Lecture de la vue…')
                            : running
                              ? $t('Exécution…')
                              : $t('Écrivez une requête, puis Ctrl+Entrée.')}
                        </p>
                      </div>
                    </div>
                  ) : activeView?.filter_hidden === true ? (
                    // Shown unfiltered, it would show more than it was made to: it is not shown.
                    <Unavailable>
                      {$t(
                        'Le filtre de cette vue porte sur un champ qui ne vous est pas ouvert, ou qui n’existe plus : elle ne peut pas vous être montrée.',
                      )}
                    </Unavailable>
                  ) : !gridShown && table !== null && activeView !== null ? (
                    activeView.kind === 'kanban' ? (
                      <KanbanView
                        key={activeView.id}
                        table={table}
                        fields={businessFields}
                        spec={kanbanSpec(activeView.spec)}
                        filter={effectiveFilter}
                        sort={sortParameter(view.sorts)}
                        reloadKey={dataTick + reloadTick}
                        openedId={opened?._id ?? null}
                        onOpen={(row) => void openRecord(row)}
                        onAdd={table.actions.includes('create') ? addRecord : undefined}
                        onReorderColumns={canEditView ? saveGroupOrder : undefined}
                        onReorderCards={canEditView ? saveManualOrder : undefined}
                        onError={setError}
                      />
                    ) : activeView.kind === 'calendar' ? (
                      <CalendarView
                        key={activeView.id}
                        table={table}
                        fields={businessFields}
                        spec={calendarSpec(activeView.spec)}
                        filter={effectiveFilter}
                        sort={sortParameter(view.sorts)}
                        reloadKey={dataTick + reloadTick}
                        openedId={opened?._id ?? null}
                        onOpen={(row) => void openRecord(row)}
                        onAdd={table.actions.includes('create') ? addRecord : undefined}
                        onError={setError}
                      />
                    ) : activeView.kind === 'timeline' ? (
                      <TimelineView
                        key={activeView.id}
                        table={table}
                        fields={businessFields}
                        spec={timelineSpec(activeView.spec)}
                        filter={effectiveFilter}
                        sort={sortParameter(view.sorts)}
                        reloadKey={dataTick + reloadTick}
                        openedId={opened?._id ?? null}
                        onOpen={(row) => void openRecord(row)}
                        onError={setError}
                      />
                    ) : activeView.kind === 'gallery' ? (
                      <GalleryView
                        key={activeView.id}
                        table={table}
                        fields={businessFields}
                        spec={gallerySpec(activeView.spec)}
                        filter={effectiveFilter}
                        sort={sortParameter(view.sorts)}
                        reloadKey={dataTick + reloadTick}
                        openedId={opened?._id ?? null}
                        onOpen={(row) => void openRecord(row)}
                        onReorder={canEditView ? saveManualOrder : undefined}
                        onError={setError}
                      />
                    ) : activeView.kind === 'list' ? (
                      <ListView
                        key={activeView.id}
                        table={table}
                        fields={businessFields}
                        spec={listSpec(activeView.spec)}
                        filter={effectiveFilter}
                        sort={sortParameter(view.sorts)}
                        reloadKey={dataTick + reloadTick}
                        openedId={opened?._id ?? null}
                        onOpen={(row) => void openRecord(row)}
                        onReorder={canEditView ? saveManualOrder : undefined}
                        onError={setError}
                      />
                    ) : (
                      <FormView
                        // A reconfigured form starts a fresh draft: its questions changed.
                        key={`${activeView.id}:${activeView.updated_at}`}
                        kind={activeView.kind === 'survey' ? 'survey' : 'form'}
                        table={table}
                        fields={businessFields}
                        spec={formSpec(activeView.spec)}
                        viewLabel={activeView.label}
                        linkOptions={linkOptions}
                        onSearchLink={searchLink}
                        onUpload={upload}
                        onCreated={bumpData}
                        onShare={canManageViews ? () => setSharing(activeView) : undefined}
                      />
                    )
                  ) : (
                    <TableFieldsProvider
                      table={isSql ? null : table}
                      fields={isSql ? [] : businessFields}
                    >
                      <DataGrid
                        fields={visible}
                        hiddenFields={hidden}
                        rows={rows}
                        view={view}
                        linkOptions={linkOptions}
                        onSearchLink={searchLink}
                        sortableFields={sortableFields}
                        checked={checked}
                        cells={cells}
                        busy={busy}
                        openedId={opened?._id ?? null}
                        editable={!isSql}
                        canCreate={!isSql && table?.actions.includes('create') === true}
                        emptyState={
                          (isSql ? running : loading || error !== null) ? null : (
                            <TableEmptyState
                              kind={
                                isSql
                                  ? 'result'
                                  : view.cursors.length > 0
                                    ? 'page'
                                    : effectiveFilter !== ''
                                      ? 'filtered'
                                      : 'empty'
                              }
                              onAdd={
                                !isSql && table?.actions.includes('create') === true
                                  ? () => addRecord({})
                                  : undefined
                              }
                              onFirstPage={() => patch({ cursors: [] })}
                            />
                          )
                        }
                        canDelete={!isSql && table?.actions.includes('delete') === true}
                        onPatchView={patch}
                        onChecked={setChecked}
                        onCells={setCells}
                        onCommit={commit}
                        onUpload={upload}
                        onCreate={create}
                        onDelete={remove}
                        // A result row is not a record: it has no identity in the catalog, so there
                        // is no detail view to open and nothing the panel could write back to.
                        onOpenRecord={(row) => {
                          if (!isSql) void openRecord(row)
                        }}
                        onFollowLink={isSql ? undefined : followLink}
                        rowHeight={ROW_HEIGHTS[view.rowHeight]}
                        groupField={isSql ? null : groupField}
                        groupCounts={groupCounts}
                        summaries={isSql ? undefined : view.summaries}
                        summaryValues={aggregates?.values ?? null}
                        summaryTotal={aggregates?.total ?? null}
                        onSummary={
                          isSql
                            ? undefined
                            : (field, fn) => {
                                const { [field]: _dropped, ...rest } = view.summaries
                                patch({ summaries: fn === null ? rest : { ...rest, [field]: fn } })
                              }
                        }
                        rowColor={isSql || !colored ? undefined : rowColor}
                        // The others' pointers on this table — one's own other windows left out.
                        pointers={isSql ? [] : live.pointers.filter((p) => p.user !== self)}
                        onPointer={isSql ? undefined : live.movePointer}
                        onFilterField={(field) => {
                          if (isSql) {
                            // On a SQL tab the column menu drops the NAME into the statement, which
                            // is the useful thing there. A basedb filter expression would not parse.
                            setDraft(
                              tab.id,
                              `${tab.draft}${tab.draft.endsWith(' ') ? '' : ' '}${field.label}`,
                            )
                            return
                          }
                          const addition = `${field.name} eq `
                          setDraft(
                            tab.id,
                            tab.draft === '' ? addition : `${tab.draft} and ${addition}`,
                          )
                          setFilterOpen(true)
                        }}
                      />
                    </TableFieldsProvider>
                  )}

                  {gridShown && (
                    <PaginationBar
                      rowCount={rows.length}
                      // A result is not a page: there is no cursor to walk, so the bar shows the
                      // first page and nothing else. The limit still matters — it is the row cap the
                      // statement runs under — and "recharger" re-runs the statement.
                      pageIndex={isSql ? 0 : view.cursors.length}
                      pageSize={view.pageSize}
                      hasNextPage={isSql ? false : hasNextPage}
                      total={isSql ? (sqlResult?.row_count ?? null) : view.total}
                      totalCapped={isSql ? (sqlResult?.truncated ?? false) : view.totalCapped}
                      counting={counting}
                      loading={isSql ? running : loading}
                      countable={!isSql}
                      onPageSize={(size) => patch({ pageSize: size, cursors: [] })}
                      onFirst={() => patch({ cursors: [] })}
                      onPrevious={() => patch({ cursors: view.cursors.slice(0, -1) })}
                      onNext={() => {
                        if (nextCursor === null) return
                        patch({ cursors: [...view.cursors, nextCursor] })
                      }}
                      onRefresh={() =>
                        tab.kind === 'sqlview'
                          ? void readSqlView()
                          : isSql
                            ? void runSql(tab.draft)
                            : void load()
                      }
                      onCount={() => {
                        setCounting(true)
                        void load({ count: true })
                      }}
                      onExport={onExport}
                    />
                  )}
                </>
              )}
            </div>

            {drafting && table !== null && (
              <NewRecordPanel
                // A fresh draft for each table, and for each place it was asked from: the
                // panel's state is its draft.
                key={`${table.name}:${JSON.stringify(draftValues)}`}
                initial={draftValues}
                table={table}
                fields={businessFields}
                linkOptions={linkOptions}
                onSearchLink={searchLink}
                onUpload={upload}
                onClose={() => setDrafting(false)}
                onCreate={createFromPanel}
              />
            )}

            {!drafting && openedRow !== null && table !== null && (
              <RecordPanel
                table={table}
                row={openedRow}
                fields={businessFields}
                linkOptions={linkOptions}
                onSearchLink={searchLink}
                referenced={referenced}
                onClose={() => setOpened(null)}
                onCommit={async (field, value) => {
                  await commit(openedRow._id, field, value)
                }}
                onUpload={upload}
                onRecompute={
                  table.actions.includes('update')
                    ? (field) => recompute(openedRow._id, field)
                    : undefined
                }
                onFollowLink={followLink}
                self={self}
                commentsTick={commentsTick}
                viewers={live.viewers}
              />
            )}

            {table !== null && (
              <ShareFormDialog table={table} view={sharing} onClose={() => setSharing(null)} />
            )}

            {table !== null && viewDialog !== null && (
              <ViewDialog
                open
                table={table}
                views={views}
                kind={viewDialog.kind}
                view={viewDialog.view}
                current={{ filter: view.filter, sorts: view.sorts }}
                layout={viewDialog.fromLayout === true ? view : undefined}
                canBuild={canManageViews}
                onClose={() => setViewDialog(null)}
                onSubmit={submitView}
              />
            )}

            {queryDialog !== null && tab.kind === 'sql' && (
              <QueryDialog
                open
                base={base.name}
                manages={manages}
                query={queryDialog.query}
                statement={tab.draft}
                onClose={() => setQueryDialog(null)}
                onSaved={(saved) => {
                  setSavedQueries((was) => ({ ...was, [saved.id]: saved }))
                  // A new query — « Enregistrer sous » too — becomes the one this tab shows.
                  attachQuery(tab.id, saved.id, saved.label)
                  onNavigationChanged?.()
                }}
                onDeleted={(id) => {
                  detachQuery(id)
                  onNavigationChanged?.()
                }}
              />
            )}

            {sqlViewDialog !== null && (
              <SqlViewDialog
                open
                base={base}
                view={sqlViewDialog.view}
                definition={sqlViewDialog.definition}
                onClose={() => setSqlViewDialog(null)}
                onSaved={(saved) => {
                  setSqlViews((was) => ({ ...was, [saved.id]: saved }))
                  onNavigationChanged?.()
                  if (sqlViewDialog.view === null) {
                    // Made from a SQL tab: the view opens, read with the reader's reach.
                    openSqlViewTab(base.name, saved)
                    return
                  }
                  renameSqlView(saved.id, saved.label)
                  // Its text changed: what the tab shows is read again.
                  if (tab.kind === 'sqlview' && tab.sqlViewId === saved.id) void readSqlView()
                }}
                onDeleted={(id) => {
                  dropSqlView(id)
                  onNavigationChanged?.()
                }}
              />
            )}

            {copilotOpen && (
              <CopilotPanel
                base={base}
                table={table}
                view={{
                  filter: view.filter,
                  sort: view.sorts.length === 0 ? null : sortParameter(view.sorts),
                }}
                onClose={() => setCopilotOpen(false)}
                onApplyFilter={(name, filter, sort) => {
                  const target = base.tables.find((t) => t.name === name)
                  if (target === undefined) return
                  // The open tab when it shows that table; else the table, opened for it.
                  const id = table?.name === name ? tab.id : openTableTab(target, target.label)
                  const text = format(filter)
                  setDraft(id, text)
                  patchView(id, {
                    filter: flatten(text),
                    ...(sort === null ? {} : { sorts: sortTerms(sort) }),
                    cursors: [],
                    total: null,
                  })
                  setFilterOpen(true)
                }}
                onOpenSql={(sql) => {
                  const id = openSql(base.name, null, $t('Requête du Copilot'))
                  setDraft(id, sql)
                }}
                onChanged={async () => {
                  await onBaseChanged?.()
                  reloadRows()
                }}
              />
            )}
          </div>
        </div>
      </MembersProvider>
    </AiWaitingProvider>
  )
}

/** A saved query's name, whom it is shared with, and whether its text was changed since. */
function QueryTitle({
  query,
  modified,
}: {
  readonly query: SavedQuery
  readonly modified: boolean
}) {
  const Audience = audienceIcon(query.audience)
  const audience =
    query.audience === 'personal'
      ? $t('Requête personnelle')
      : query.audience === 'base'
        ? $t('Partagée avec toute la base')
        : $t('Partagée avec {map}', { map: query.groups.map((g) => groupName(g.label)).join(', ') })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          <Audience className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-foreground">{query.label}</span>
          {modified && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-amber-500"
              aria-label={$t('modifiée')}
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {audience}
        {query.mine ? '' : $t(' · par {name}', { name: query.owner.name })}
        {modified ? $t(' · texte modifié, non enregistré') : ''}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Said beside a result read with the reader's own reach: what they do not see does not
 * exist for the statement, which is why a column may be « missing ».
 */
function ReaderBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">
          <ShieldCheck className="size-3" />
          {$t('Vos droits')}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {$t(
          'Lecture seule, avec vos propres droits : les tables et les champs qui ne vous sont pas ouverts n’existent pas pour cette requête.',
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function Header({
  base,
  table,
  tools,
}: {
  readonly base: DescribedBase
  readonly table?: Table | null
  /** Who else is here, the bell and the copilot — on the right. */
  readonly tools?: ReactNode
}) {
  // The breadcrumb and the tools share what the search leaves, in equal halves: the
  // search stays in the middle of the bar, whatever either side holds.
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <SidebarToggle />
      <nav
        className="flex min-w-0 flex-1 basis-0 items-center gap-2 text-sm"
        aria-label={$t('Fil d’Ariane')}
      >
        <span className="truncate text-muted-foreground">{base.label}</span>
        {/* Outside production, which environment is being written to is never implicit. */}
        {base.environment !== undefined && !base.environment.production && (
          <EnvironmentBadge environment={base.environment} />
        )}
        {table !== null && table !== undefined && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-medium">{table.label}</span>
            {table.synced === true && (
              <Hint
                label={$t(
                  'Ses lignes viennent d’une source extérieure et ne s’écrivent pas à la main (Intégrations)',
                )}
              >
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                  <RefreshCw className="size-3" />
                  {$t('Synchronisée')}
                </span>
              </Hint>
            )}
          </>
        )}
      </nav>
      <SearchField className="w-9 shrink-0 sm:w-full sm:max-w-md sm:shrink" />
      <div className="flex flex-1 basis-0 items-center justify-end gap-2">{tools}</div>
    </header>
  )
}

function Toolbar({
  table,
  view,
  hidden,
  systemHidden,
  filterOpen,
  loading,
  editable,
  writable,
  filterable = true,
  switcher,
  sortMenu,
  gridTools,
  search,
  viewActions,
  onToggleFilter,
  onClearSort,
  onDropSort,
  onShow,
  onShowAll,
  onShowSystem,
  onAdd,
}: {
  readonly table: Table | null
  readonly view: ViewState
  readonly hidden: readonly Field[]
  /** The system columns not shown: « Créé le », « Modifié par »… */
  readonly systemHidden: readonly Field[]
  readonly filterOpen: boolean
  readonly loading: boolean
  readonly editable: boolean
  readonly writable: boolean
  /** The rows shown are filtered and sorted — not so on a form, which shows none. */
  readonly filterable?: boolean
  /** The view selector: first, to the left of « Filtrer ». */
  readonly switcher?: ReactNode
  /** The sort of a view without column headers. */
  readonly sortMenu?: ReactNode
  /** Group, colours, row height — a grid's own presentation. */
  readonly gridTools?: ReactNode
  /** The quick search, on the right. */
  readonly search?: ReactNode
  /** Save, revert, configure the view on screen. */
  readonly viewActions?: ReactNode
  readonly onToggleFilter: () => void
  readonly onClearSort: () => void
  readonly onDropSort: (field: string) => void
  readonly onShow: (name: string) => void
  readonly onShowAll: () => void
  readonly onShowSystem: (name: string) => void
  readonly onAdd: () => void
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      {switcher}

      {editable && filterable && (
        <Button
          variant={view.filter === '' && !filterOpen ? 'ghost' : 'secondary'}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onToggleFilter}
        >
          <Filter className="size-3.5" />
          {$t('Filtrer')}
          {view.filter !== '' && (
            <span className="rounded bg-primary/20 px-1 text-[10px] text-primary">1</span>
          )}
        </Button>
      )}

      {sortMenu}

      {/* The sort is shown as CHIPS rather than behind a menu: it is the thing most
          likely to explain why a row is not where someone expects it. */}
      {filterable && view.sorts.length > 0 && (
        <div className="flex items-center gap-1">
          {view.sorts.map((term, index) => (
            <Hint key={term.field} label={$t('Retirer ce critère de tri')}>
              <button
                type="button"
                onClick={() => onDropSort(term.field)}
                className="flex h-7 items-center gap-1 rounded-md bg-secondary px-2 text-xs"
              >
                {view.sorts.length > 1 && (
                  <span className="text-[9px] font-bold tabular-nums text-primary">
                    {index + 1}
                  </span>
                )}
                {term.direction === 'asc' ? (
                  <ArrowUp className="size-3 text-primary" />
                ) : (
                  <ArrowDown className="size-3 text-primary" />
                )}
                <span className="max-w-24 truncate">
                  {table?.fields.find((f) => f.name === term.field)?.label ?? term.field}
                </span>
                <X className="size-3 opacity-50" />
              </button>
            </Hint>
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={onClearSort}>
            {$t('Tout retirer')}
          </Button>
        </div>
      )}

      {(hidden.length > 0 || systemHidden.length > 0) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
              <Eye className="size-3.5" />
              {hidden.length > 0
                ? $tp(hidden.length, '{count} cachée', '{count} cachées')
                : $t('Colonnes')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {hidden.length > 0 && (
              <>
                <DropdownMenuLabel>{$t('Colonnes cachées')}</DropdownMenuLabel>
                {hidden.map((field) => (
                  <DropdownMenuItem key={field.name} onSelect={() => onShow(field.name)}>
                    <Eye className="size-4" />
                    {field.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={onShowAll}>{$t('Tout réafficher')}</DropdownMenuItem>
              </>
            )}
            {hidden.length > 0 && systemHidden.length > 0 && <DropdownMenuSeparator />}
            {systemHidden.length > 0 && (
              <>
                <DropdownMenuLabel>{$t('Informations système')}</DropdownMenuLabel>
                {systemHidden.map((field) => (
                  <DropdownMenuItem key={field.name} onSelect={() => onShowSystem(field.name)}>
                    <FieldIcon kind={field.kind} className="size-4" />
                    {field.label}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {gridTools}

      {viewActions}

      <div className="flex-1" />

      {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}

      {search}

      {editable && writable && (
        <Button
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onAdd}
          disabled={table === null}
        >
          <Plus className="size-3.5" />
          {$t('Ajouter')}
        </Button>
      )}
    </div>
  )
}

/**
 * The divider between the editor and the grid.
 *
 * Pointer capture, like the column handles: the pointer leaves the four-pixel strip on
 * the first move, and without capture the drag would end there.
 */
function Splitter({ onResize }: { readonly onResize: (delta: number) => void }) {
  const lastY = useRef(0)

  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault()
        lastY.current = e.clientY
        const target = e.currentTarget
        target.setPointerCapture(e.pointerId)
        const move = (ev: PointerEvent) => {
          onResize(ev.clientY - lastY.current)
          lastY.current = ev.clientY
        }
        const up = () => {
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerup', up)
        }
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', up)
      }}
      className={cn(
        'group relative h-1.5 shrink-0 cursor-row-resize bg-border/40 transition-colors hover:bg-primary/40',
      )}
      aria-hidden
    />
  )
}

/** Re-exported for the record panel, which renders the same values. */
export { rawText }
export type { Row }
