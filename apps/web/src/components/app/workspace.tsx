'use client'

import { CopilotPanel } from '@/components/app/copilot-panel'
import { ExpressionEditor, flatten, format } from '@/components/app/expression-editor'
import type { Row } from '@/components/app/grid/cell'
import { rawText } from '@/components/app/grid/cell'
import { DataGrid } from '@/components/app/grid/data-grid'
import { PaginationBar } from '@/components/app/grid/pagination-bar'
import { SelectionBar } from '@/components/app/grid/selection-bar'
import { RecordPanel } from '@/components/app/record-panel'
import { SqlEditor } from '@/components/app/sql-editor'
import { TabBar } from '@/components/app/tab-bar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ApiError,
  type DescribedBase,
  type Field,
  type LinkOption,
  type ReferencedBlock,
  type Table,
  api,
} from '@/lib/api/client'
import { type ExportFormat, copy, download, serialize } from '@/lib/export'
import { messageFor } from '@/lib/messages'
import {
  DEFAULT_PAGE_SIZE,
  type SortTerm,
  type ViewState,
  arrangeFields,
  sortParameter,
  useActiveTab,
  useWorkspace,
} from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Eye,
  Filter,
  Loader2,
  PanelLeft,
  Play,
  Plus,
  Wand2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

/** What the console hands back, as the client publishes it. */
type SqlResult = Awaited<ReturnType<typeof api.runSql>>

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

interface Props {
  readonly base: DescribedBase
  readonly tables: readonly Table[]
  readonly onToggleSidebar: () => void
  readonly onOpenDoc: () => void
}

export function Workspace({ base, tables, onToggleSidebar, onOpenDoc }: Props) {
  const tab = useActiveTab()
  const patchView = useWorkspace((s) => s.patchView)
  const setDraft = useWorkspace((s) => s.setDraft)
  const openSql = useWorkspace((s) => s.openSql)
  const checked = useWorkspace((s) => s.checked)
  const setChecked = useWorkspace((s) => s.setChecked)
  const cells = useWorkspace((s) => s.cells)
  const setCells = useWorkspace((s) => s.setCells)
  const copilotOpen = useWorkspace((s) => s.copilotOpen)
  const setCopilotOpen = useWorkspace((s) => s.setCopilotOpen)

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
  const [referenced, setReferenced] = useState<readonly ReferencedBlock[]>([])

  // ── SQL tab ──────────────────────────────────────────────────────────────────
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null)
  const [sqlError, setSqlError] = useState<{ message: string; position: number | null } | null>(
    null,
  )
  const [running, setRunning] = useState(false)
  const formatRef = useRef<(() => void) | null>(null)

  const table = useMemo(
    () => (tab === null ? null : (tables.find((t) => t.name === tab.table) ?? null)),
    [tab, tables],
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
    if (tab?.kind === 'sql') {
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
          kind: kindOfPgType(column.dataType),
          read_only: true,
          system: false,
          sortable: false,
        }
      })
    }
    return table === null ? [] : table.fields.filter((f) => f.system !== true)
  }, [tab?.kind, sqlResult, table])

  const view: ViewState = tab?.view ?? {
    columnWidths: {},
    columnOrder: null,
    pinned: [],
    hidden: [],
    sorts: [],
    filter: '',
    pageSize: DEFAULT_PAGE_SIZE,
    cursors: [],
    total: null,
    totalCapped: false,
  }

  const { visible, hidden } = useMemo(
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
    async (options: { count?: boolean } = {}) => {
      // A SQL tab holds a RESULT, not a page of a table: it reloads by re-running its
      // statement, which only the person who wrote it may decide to do.
      if (tab?.kind === 'sql') return
      if (table === null || tab === null) return
      setLoading(true)
      setError(null)
      try {
        const page = await api.list(table, {
          sort: sortParameter(view.sorts),
          filter: view.filter,
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
    [table, tab?.id, tab?.kind, view.sorts, view.filter, view.pageSize, view.cursors, patchView],
  )

  /**
   * Runs a statement, and shows what comes back.
   *
   * The rows land in the ordinary grid. That is deliberate: sorting, pinning, hiding,
   * selecting, copying and exporting are already written and already familiar, and a
   * second table widget for results would be the same code with different bugs.
   */
  const runSql = useCallback(
    async (statement: string) => {
      if (tab === null || statement.trim() === '') return
      setRunning(true)
      setSqlError(null)
      setError(null)
      try {
        const result = await api.runSql(base.name, statement, view.pageSize)
        setSqlResult(result)
        // The grid keys rows by `_id`, and a result has none: `SELECT 1` identifies
        // nothing. A positional key is the honest substitute — it identifies a row OF
        // THIS RESULT, which is exactly what a result row is.
        setRows(result.rows.map((row, index) => ({ ...row, _id: `#${index}` })))
        setHasNextPage(false)
        setNextCursor(null)
      } catch (e) {
        setRows([])
        setSqlResult(null)
        // The server hands back PostgreSQL's own message and the offset it pointed at,
        // so the editor can put the marker on the offending token rather than on line 1.
        const detail = e instanceof ApiError ? e.details : undefined
        const message = typeof detail?.message === 'string' ? detail.message : messageFor(e)
        const position = typeof detail?.position === 'number' ? detail.position : null
        setSqlError({ message, position })
        setError(message)
      } finally {
        setRunning(false)
      }
    },
    [tab, base.name, view.pageSize],
  )

  useEffect(() => {
    void load()
  }, [load])

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
        resolved[field.name] = page.data.map((row) => ({
          id: String(row._id),
          display: display === null ? String(row._id).slice(0, 8) : String(row[display] ?? ''),
        }))
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

  // ── Acts ─────────────────────────────────────────────────────────────────────

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
      }
    },
    [table, load],
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
      for (const id of checked) {
        await api.deleteRecord(table, id)
        done++
      }
      setChecked(new Set())
    } catch (e) {
      setError(
        `${messageFor(e)} — ${done} ligne${done > 1 ? 's' : ''} sur ${checked.size} supprimée${
          done > 1 ? 's' : ''
        }.`,
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

  if (tab === null) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <Header base={base} onToggleSidebar={onToggleSidebar} onOpenDoc={onOpenDoc} />
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-sm">
            <p className="text-sm text-muted-foreground">
              Choisissez une table à gauche, ou ouvrez un onglet SQL pour interroger la base
              directement.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => openSql(base.name, null, 'Requête 1')}
            >
              <Plus className="size-4" />
              Nouvelle requête SQL
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const someSelected = checked.size > 0 || cells.size > 0
  const isSql = tab.kind === 'sql'

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <Header base={base} table={table} onToggleSidebar={onToggleSidebar} onOpenDoc={onOpenDoc} />

        <TabBar
          onNewSql={() =>
            openSql(
              base.name,
              null,
              `Requête ${useWorkspace.getState().tabs.filter((t) => t.kind === 'sql').length + 1}`,
            )
          }
          copilotOpen={copilotOpen}
          onToggleCopilot={() => setCopilotOpen(!copilotOpen)}
        />

        {/* The SQL pane — an editor, and a splitter that is a real one. */}
        {isSql && (
          <>
            <div
              className="flex shrink-0 flex-col border-b bg-background"
              style={{ height: editorHeight }}
            >
              <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
                <span className="text-xs text-muted-foreground">
                  Sur <span className="font-mono text-foreground">{base.name}</span>
                </span>
                {sqlResult !== null && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {sqlResult.command} · {sqlResult.row_count.toLocaleString('fr-FR')} ligne
                    {sqlResult.row_count > 1 ? 's' : ''} · {sqlResult.duration_ms} ms
                    {sqlResult.truncated && (
                      <span className="ml-1 text-destructive">— tronqué</span>
                    )}
                  </span>
                )}
                <div className="flex-1" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => formatRef.current?.()}
                    >
                      <Wand2 className="size-3.5" />
                      Mettre en forme
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Maj+Alt+F — la sélection, ou tout</TooltipContent>
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
                      Exécuter
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ctrl+Entrée — la sélection, ou tout</TooltipContent>
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
            <Splitter onResize={(delta) => setEditorHeight((h) => Math.max(96, h + delta))} />
          </>
        )}

        {/* Toolbar, or the selection bar that replaces it. */}
        {someSelected ? (
          <SelectionBar
            count={checked.size}
            cellCount={cells.size}
            deleting={deleting}
            editable={!isSql}
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
            hidden={hidden}
            filterOpen={filterOpen}
            loading={loading}
            // On an expression tab the filter IS the pane above and the rows are a
            // result, not a table: offering a second filter control and an "Ajouter"
            // button would be two ways in for one thing, and one verb with nowhere to go.
            editable={!isSql}
            onToggleFilter={() => setFilterOpen((o) => !o)}
            onClearSort={() => patch({ sorts: [], cursors: [] })}
            onDropSort={(field) =>
              patch({ sorts: view.sorts.filter((s) => s.field !== field), cursors: [] })
            }
            onShow={(name) => patch({ hidden: view.hidden.filter((h) => h !== name) })}
            onShowAll={() => patch({ hidden: [] })}
            onAdd={() => void create({})}
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
                  placeholder='montant gt 100 and nom contains "a"'
                  onChange={(next) => setDraft(tab.id, next)}
                  onRun={() => applyFilter(tab.draft)}
                  serverError={error}
                />
              </div>
              <Button size="sm" onClick={() => applyFilter(tab.draft)}>
                Appliquer
              </Button>
              {view.filter !== '' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setDraft(tab.id, '')
                    applyFilter('')
                  }}
                  aria-label="Retirer le filtre"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Treize opérateurs —{' '}
              <span className="font-mono">eq ne eq_ci contains starts_with</span>{' '}
              <span className="font-mono">ends_with in is_null gt gte lt lte between</span> —
              combinés par <span className="font-mono">and or not</span>. Ctrl+Espace complète,
              Maj+Alt+F met en forme.
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
            Cette table n’existe plus dans la base.
          </div>
        ) : isSql && sqlError !== null ? (
          // The refusal goes HERE, not only in the gutter. A marker in the margin says
          // that something is wrong; a console user needs to read what.
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto scroll-discret p-6">
            <div className="w-full max-w-2xl rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">L’ordre a été refusé</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-destructive">
                {sqlError.message}
              </pre>
              <p className="mt-3 text-xs text-muted-foreground">
                Le message vient de PostgreSQL. La console lit et écrit les lignes du schéma{' '}
                <span className="font-mono">{base.name}</span> et rien d’autre : le catalogue{' '}
                <span className="font-mono">_basedb</span> lui est fermé, et les ordres de structure
                passent par l’éditeur de structure.
              </p>
            </div>
          </div>
        ) : isSql && sqlResult === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <p>Écrivez une requête, puis Ctrl+Entrée.</p>
            <p className="text-xs">
              Ctrl+Espace complète les tables et les colonnes, Maj+Alt+F met en forme.
            </p>
          </div>
        ) : (
          <DataGrid
            fields={visible}
            hiddenFields={hidden}
            rows={rows}
            view={view}
            linkOptions={linkOptions}
            sortableFields={sortableFields}
            checked={checked}
            cells={cells}
            busy={busy}
            openedId={opened?._id ?? null}
            editable={!isSql}
            onPatchView={patch}
            onChecked={setChecked}
            onCells={setCells}
            onCommit={commit}
            onCreate={create}
            onDelete={remove}
            // A result row is not a record: it has no identity in the catalog, so there
            // is no detail view to open and nothing the panel could write back to.
            onOpenRecord={(row) => {
              if (!isSql) void openRecord(row)
            }}
            onFilterField={(field) => {
              if (isSql) {
                // On a SQL tab the column menu drops the NAME into the statement, which
                // is the useful thing there. A basedb filter expression would not parse.
                setDraft(tab.id, `${tab.draft}${tab.draft.endsWith(' ') ? '' : ' '}${field.label}`)
                return
              }
              const addition = `${field.name} eq `
              setDraft(tab.id, tab.draft === '' ? addition : `${tab.draft} and ${addition}`)
              setFilterOpen(true)
            }}
          />
        )}

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
          schemaName={isSql ? (sqlResult?.schema ?? base.name) : base.name}
          onPageSize={(size) => patch({ pageSize: size, cursors: [] })}
          onFirst={() => patch({ cursors: [] })}
          onPrevious={() => patch({ cursors: view.cursors.slice(0, -1) })}
          onNext={() => {
            if (nextCursor === null) return
            patch({ cursors: [...view.cursors, nextCursor] })
          }}
          onRefresh={() => (isSql ? void runSql(tab.draft) : void load())}
          onCount={() => {
            setCounting(true)
            void load({ count: true })
          }}
          onExport={onExport}
        />
      </div>

      {opened !== null && table !== null && (
        <RecordPanel
          table={table}
          row={opened}
          fields={businessFields}
          linkOptions={linkOptions}
          referenced={referenced}
          onClose={() => setOpened(null)}
          onCommit={async (field, value) => {
            await commit(opened._id, field, value)
          }}
        />
      )}

      {copilotOpen && (
        <CopilotPanel
          base={base.name}
          table={table}
          fields={businessFields}
          lastError={error}
          onClose={() => setCopilotOpen(false)}
          onUseExpression={(filter, sort) => {
            setDraft(tab.id, format(filter))
            setFilterOpen(true)
            if (sort !== null) {
              const terms: SortTerm[] = sort
                .split(',')
                .map((raw) => raw.trim())
                .filter((raw) => raw !== '')
                .map((raw) =>
                  raw.startsWith('-')
                    ? { field: raw.slice(1), direction: 'desc' as const }
                    : { field: raw, direction: 'asc' as const },
                )
              patch({ sorts: terms.slice(0, 3), cursors: [] })
            }
          }}
        />
      )}
    </div>
  )
}

function Header({
  base,
  table,
  onToggleSidebar,
  onOpenDoc,
}: {
  readonly base: DescribedBase
  readonly table?: Table | null
  readonly onToggleSidebar: () => void
  readonly onOpenDoc: () => void
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleSidebar}
        aria-label="Replier le panneau"
      >
        <PanelLeft className="size-4" />
      </Button>
      <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Fil d’Ariane">
        <span className="truncate text-muted-foreground">{base.label}</span>
        {table !== null && table !== undefined && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-medium">{table.label}</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {table.sql}
            </span>
          </>
        )}
      </nav>
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={onOpenDoc}>
        <Code2 className="size-4" />
        API
      </Button>
    </header>
  )
}

function Toolbar({
  table,
  view,
  hidden,
  filterOpen,
  loading,
  editable,
  onToggleFilter,
  onClearSort,
  onDropSort,
  onShow,
  onShowAll,
  onAdd,
}: {
  readonly table: Table | null
  readonly view: ViewState
  readonly hidden: readonly Field[]
  readonly filterOpen: boolean
  readonly loading: boolean
  readonly editable: boolean
  readonly onToggleFilter: () => void
  readonly onClearSort: () => void
  readonly onDropSort: (field: string) => void
  readonly onShow: (name: string) => void
  readonly onShowAll: () => void
  readonly onAdd: () => void
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      {editable && (
        <Button
          variant={view.filter === '' && !filterOpen ? 'ghost' : 'secondary'}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onToggleFilter}
        >
          <Filter className="size-3.5" />
          Filtrer
          {view.filter !== '' && (
            <span className="rounded bg-primary/20 px-1 text-[10px] text-primary">1</span>
          )}
        </Button>
      )}

      {/* The sort is shown as CHIPS rather than behind a menu: it is the thing most
          likely to explain why a row is not where someone expects it. */}
      {view.sorts.length > 0 && (
        <div className="flex items-center gap-1">
          {view.sorts.map((term, index) => (
            <button
              key={term.field}
              type="button"
              onClick={() => onDropSort(term.field)}
              className="flex h-7 items-center gap-1 rounded-md bg-secondary px-2 text-xs"
              title="Retirer ce critère de tri"
            >
              {view.sorts.length > 1 && (
                <span className="text-[9px] font-bold tabular-nums text-primary">{index + 1}</span>
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
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={onClearSort}>
            Tout retirer
          </Button>
        </div>
      )}

      {hidden.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
              <Eye className="size-3.5" />
              {hidden.length} cachée{hidden.length > 1 ? 's' : ''}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Colonnes cachées</DropdownMenuLabel>
            {hidden.map((field) => (
              <DropdownMenuItem key={field.name} onSelect={() => onShow(field.name)}>
                <Eye className="size-4" />
                {field.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onShowAll}>Tout réafficher</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex-1" />

      {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}

      {editable && (
        <Button
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onAdd}
          disabled={table === null}
        >
          <Plus className="size-3.5" />
          Ajouter
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
