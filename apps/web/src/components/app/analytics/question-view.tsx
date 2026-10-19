'use client'

import { DrillMenu } from '@/components/app/analytics/drill-menu'
import { Notebook } from '@/components/app/analytics/notebook'
import { QuestionDialog } from '@/components/app/analytics/question-dialog'
import {
  SqlQuestionEditor,
  testConstraints,
  variablesOf,
} from '@/components/app/analytics/sql-question'
import { type DrillEvent, VisualizationView } from '@/components/app/analytics/visualization'
import { VizPicker, VizSettings } from '@/components/app/analytics/viz-settings'
import { SqlIllustration } from '@/components/app/sql-illustration'
import { AUDIENCES, audienceIcon } from '@/components/app/sql/query-dialog'
import { SqlViewDialog } from '@/components/app/sql/sql-view-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Pane } from '@/components/ui/pane'
import { Segmented } from '@/components/ui/segmented'
import { TabRow } from '@/components/ui/tab-row'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import { toCsv } from '@/lib/analytics/format'
import { autoVisualization, tableOf } from '@/lib/analytics/model'
import { givenUpBySwitching, runsInConsole } from '@/lib/analytics/question-mode'
import { queryResultOfSql, wroteData } from '@/lib/analytics/sql-result'
import {
  ApiError,
  type DescribedBase,
  type QueryAudience,
  type Question,
  type SqlView,
  api,
} from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { weekStart } from '@/lib/preferences'
import { type QuestionDraft, useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  type BuilderQuery,
  QUERY_LIMITS,
  type QueryResult,
  type QuestionQuery,
  type Visualization,
} from '@basedb/contracts'
import {
  ArrowLeft,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Ellipsis,
  Eye,
  Loader2,
  PanelLeft,
  PanelRight,
  PencilLine,
  RefreshCw,
  Square,
  Trash2,
  TriangleAlert,
  Undo2,
  Workflow,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A question, opened — chapter 18 §1: among the dashboards, or in a tab of the workspace.
 * Built with the mouse in its notebook or written in SQL — a switch in the header says which,
 * and one the editor cannot convert asks first; run with the rights of whoever looks, read
 * only; drawn the way it reads best, or the way its author chose; explored by a click on a
 * point, each step a question of its own that can be walked back. Anyone keeps their own;
 * whoever builds the base shares them, or puts them in a dashboard.
 *
 * Three panes side by side, each as wide as the person drags it: the notebook on the left
 * (the question's steps), the result in the middle (the chart, or its data), the settings on
 * the right (the visualization, or the question's details). A question built with the mouse
 * runs again by itself a moment after each change; one written in SQL waits to be run.
 *
 * The SQL mode is the console and the saved queries of earlier versions, made one: the same
 * editor, its variables, the chart. A draft not yet saved, for whoever manages the base,
 * runs in the console — writes, several statements — and says when it wrote; a saved question,
 * or a text with variables, runs read only, as everyone's does.
 */

export type { QuestionDraft }

export const draftOf = (question: Question): QuestionDraft => ({
  id: question.id,
  label: question.label,
  description: question.description,
  query: question.query,
  visualization: question.visualization,
})

const complete = (query: QuestionQuery | null): query is QuestionQuery =>
  query !== null && (query.kind === 'sql' ? query.sql.trim() !== '' : query.source !== '')

/** How long a change waits for the next one before the question runs again. */
const RERUN_AFTER = 350

/** The right pane opens by itself where there is room enough for a chart beside it. */
const roomForSettings = () => typeof window === 'undefined' || window.innerWidth >= 1500

const UPDATED = new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' })

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[\\/:*?"<>|]+/g, '-') || 'question'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

type View = 'viz' | 'data'
type Panel = 'viz' | 'details'

/** A tab of a row of tabs: the active one carries `aria-selected`, the row keeps it in view. */
function Tab({
  active,
  onClick,
  underlined = false,
  children,
}: {
  readonly active: boolean
  readonly onClick: () => void
  readonly underlined?: boolean
  readonly children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        underlined ? 'relative py-3 text-[15px]' : 'rounded-md px-2.5 py-1 text-sm',
        underlined
          ? active
            ? 'font-semibold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary'
            : 'text-muted-foreground hover:text-foreground'
          : active
            ? 'bg-muted font-medium'
            : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function QuestionView({
  base,
  initial,
  question: savedQuestion = null,
  manages,
  saveAudience = 'personal',
  onSaved,
  onDeleted,
  onBack,
  backLabel = $t('Retour'),
  onUse,
  useLabel = $t('Ajouter au tableau de bord'),
  onDraftChange,
  onOpenRows,
  onSqlViewSaved,
}: {
  readonly base: DescribedBase
  readonly initial: QuestionDraft
  /** The saved question, as the server knows it — who sees it, whether the caller may change it. */
  readonly question?: Question | null
  /** The caller manages the base's structure: they may share a question. */
  readonly manages: boolean
  /** Who a new question is offered to when saved — the whole base, for a dashboard's. */
  readonly saveAudience?: QueryAudience
  readonly onSaved?: (question: Question) => void
  readonly onDeleted?: () => void
  readonly onBack?: () => void
  readonly backLabel?: string
  /** In a dashboard being edited: the question goes into it. */
  readonly onUse?: (draft: QuestionDraft) => void
  readonly useLabel?: string
  /** Each change of the draft — a tab keeps it for when it comes back. */
  readonly onDraftChange?: (draft: QuestionDraft) => void
  /**
   * The rows behind a point of the chart open in a tab of their own, the screen they come
   * from staying as it was. Absent, they replace the question, the way back kept.
   */
  readonly onOpenRows?: (draft: QuestionDraft) => void
  /**
   * A SQL view made of the question's text — « Enregistrer comme vue SQL… », offered to whoever
   * manages the base when this is given.
   */
  readonly onSqlViewSaved?: (view: SqlView) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState<Question | null>(savedQuestion)
  useEffect(() => setSaved(savedQuestion), [savedQuestion])
  // A draft not saved is its builder's; a saved question, its author's or its base's builders'.
  const editable = draft.id === null || saved === null || saved.editable
  const [properties, setProperties] = useState(false)
  const [copying, setCopying] = useState(false)
  const [history, setHistory] = useState<QuestionDraft[]>([])
  const [dirty, setDirty] = useState(false)
  const sql = draft.query?.kind === 'sql'
  const [result, setResult] = useState<QueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<ApiError | string | null>(null)
  const [view, setView] = useState<View>('viz')
  const [panel, setPanel] = useState<Panel | null>(() => (roomForSettings() ? 'viz' : null))
  const [showNotebook, setShowNotebook] = useState(true)
  const [drill, setDrill] = useState<DrillEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState(false)
  /** What the statement last run in the console did — its command, the rows it touched. */
  const [execution, setExecution] = useState<{
    readonly command: string
    readonly rows: number
  } | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const members = useMembers()
  const requestRecord = useWorkspace((s) => s.requestRecord)
  const controller = useRef<AbortController | null>(null)
  // The builder query the result on screen was asked for: a change that leaves it as it was
  // — an exploration just run, a step walked back — has nothing to run again.
  const lastRun = useRef<string | null>(null)

  /**
   * Runs the question. A draft of whoever manages the base, written in SQL, goes through the
   * console — with `selection`, the text selected in the editor alone, as the console always
   * did —; every other question goes through the kernel's question, read only.
   */
  const run = useCallback(
    async (query: QuestionQuery | null = draft.query, selection?: string) => {
      if (!complete(query)) return
      // The previous request, still in flight, is of no use any more.
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current
      lastRun.current = query.kind === 'builder' ? JSON.stringify(query) : null
      setRunning(true)
      setError(null)
      try {
        if (query.kind === 'sql' && runsInConsole(query, { saved: draft.id !== null, manages })) {
          const text = selection === undefined || selection.trim() === '' ? query.sql : selection
          const raw = await api.runSql(base.name, text, QUERY_LIMITS.rows)
          if (current.signal.aborted) return
          setResult(queryResultOfSql(raw))
          setExecution({ command: raw.command, rows: raw.row_count })
          return
        }
        const constraints = query.kind === 'sql' ? testConstraints(variablesOf(query), values) : []
        const next = await api.runQuestion(
          base.name,
          { query, constraints, weekStart: weekStart() },
          current.signal,
        )
        if (current.signal.aborted) return
        setResult(next)
        setExecution(null)
      } catch (e) {
        if (current.signal.aborted) return
        setResult(null)
        setExecution(null)
        setError(e instanceof ApiError ? e : messageFor(e))
      } finally {
        if (!current.signal.aborted) setRunning(false)
      }
    },
    [base.name, draft.query, draft.id, manages, values],
  )

  const cancel = () => {
    controller.current?.abort()
    setRunning(false)
  }

  const query = draft.query
  const builder = query?.kind === 'builder' ? query : null

  // A question written in SQL runs once, as it is opened — then when asked — but a draft that
  // would run in the console never does: nobody has decided to run its text for real, and what
  // it holds may write. One built with the mouse runs as it is opened, and again a moment after
  // each change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, on what it was opened on
  useEffect(() => {
    if (
      initial.query?.kind === 'sql' &&
      !runsInConsole(initial.query, { saved: initial.id !== null, manages })
    ) {
      void run(initial.query)
    }
    return () => controller.current?.abort()
  }, [])
  const builderKey = builder !== null && complete(builder) ? JSON.stringify(builder) : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the serialized query
  useEffect(() => {
    if (builder === null || builderKey === null || lastRun.current === builderKey) return
    const timer = setTimeout(() => void run(builder), lastRun.current === null ? 0 : RERUN_AFTER)
    return () => clearTimeout(timer)
  }, [builderKey])

  const change = (patch: Partial<QuestionDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setDirty(true)
  }
  const draftChanged = useRef(onDraftChange)
  draftChanged.current = onDraftChange
  useEffect(() => draftChanged.current?.(draft), [draft])
  const visualization: Visualization = draft.visualization ?? {
    type: query === null ? 'table' : autoVisualization(query, result),
  }
  const shown: Visualization = view === 'data' ? { type: 'table' } : visualization

  /**
   * Changes the way the question is written. A SQL text does not become steps, nor steps a SQL
   * text: what the other mode held is given up, and the person is asked first when it is
   * something.
   */
  const switchMode = (mode: 'builder' | 'sql') => {
    if ((mode === 'sql') === sql) return
    const losing = givenUpBySwitching(query)
    if (losing !== null) {
      const ok = window.confirm(
        losing === 'steps'
          ? $t(
              'Passer au SQL ? Les étapes de l’éditeur visuel ne se convertissent pas en SQL : la question repart d’un texte vide.',
            )
          : $t(
              'Passer à l’éditeur visuel ? Le texte SQL ne se convertit pas en étapes : la question repart de zéro.',
            ),
      )
      if (!ok) return
    }
    controller.current?.abort()
    lastRun.current = null
    setResult(null)
    setExecution(null)
    setError(null)
    setRunning(false)
    change({ query: mode === 'sql' ? { kind: 'sql', sql: '' } : null, visualization: null })
  }

  const explore = (next: BuilderQuery, type?: Visualization['type']) => {
    setHistory((h) => [...h, draft])
    const derived: QuestionDraft = {
      id: null,
      label: draft.label === '' ? $t('Exploration') : `${draft.label} — exploration`,
      description: null,
      query: next,
      visualization: type === undefined ? null : { type },
    }
    setDraft(derived)
    setDirty(true)
    setView('viz')
    void run(next)
  }
  const back = () => {
    const previous = history[history.length - 1]
    if (previous === undefined) return
    setHistory((h) => h.slice(0, -1))
    setDraft(previous)
    void run(previous.query)
  }

  const errorText = error === null ? null : typeof error === 'string' ? error : messageFor(error)
  const serverError =
    error instanceof ApiError && sql
      ? {
          // PostgreSQL's own words, and the offset it pointed at — the editor marks the token.
          message:
            typeof error.details.message === 'string' ? error.details.message : (errorText ?? ''),
          position: typeof error.details.position === 'number' ? error.details.position : null,
        }
      : null
  const refused =
    error instanceof ApiError &&
    (error.status === 404 || error.status === 403 || error.code.includes('UNKNOWN'))

  const table = builder === null ? undefined : tableOf(base, builder.source)
  const title =
    draft.label ||
    (table === undefined
      ? sql
        ? $t('Nouvelle question SQL')
        : $t('Nouvelle question')
      : table.label)

  /** Saves in place what the caller may change; anything else is saved anew. */
  const save = async () => {
    if (!complete(query)) return
    if (draft.id === null || !editable) {
      setSaving(true)
      return
    }
    setError(null)
    try {
      const updated = await api.updateQuestion(base.name, draft.id, {
        label: draft.label.trim() === '' ? title : draft.label.trim(),
        description: draft.description,
        query,
        visualization,
      })
      done(updated)
    } catch (e) {
      setError(messageFor(e))
    }
  }
  const done = (question: Question) => {
    setSaved(question)
    setDraft({
      id: question.id,
      label: question.label,
      description: question.description,
      query: question.query,
      visualization: question.visualization,
    })
    setDirty(false)
    setHistory([])
    onSaved?.(question)
  }
  const remove = async () => {
    if (draft.id === null) return
    if (
      !window.confirm(
        $t('Supprimer la question « {label} » ? Les tableaux de bord qui la montrent le diront.', {
          label: draft.label,
        }),
      )
    )
      return
    try {
      await api.deleteQuestion(base.name, draft.id)
      onDeleted?.()
    } catch (e) {
      setError(messageFor(e))
    }
  }
  const Audience = saved === null ? null : audienceIcon(saved.audience)
  const audience = AUDIENCES.find((a) => a.value === (saved?.audience ?? 'personal'))
  const hasNotebook = !sql
  /** The next run of the text is the console's. */
  const inConsole = runsInConsole(query, { saved: draft.id !== null, manages })
  /** A SQL view of the text can be made, by whoever builds the base. */
  const canMakeView = manages && sql && complete(query) && onSqlViewSaved !== undefined
  const wrote = execution !== null && wroteData(execution.command)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        {onBack !== undefined && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 px-2">
            <ArrowLeft className="size-4" />
            {backLabel}
          </Button>
        )}
        {history.length > 0 && (
          <Hint label={$t('Revenir à l’étape précédente')}>
            <Button
              variant="ghost"
              size="sm"
              onClick={back}
              className="gap-1 px-2"
              aria-label={$t('Revenir à l’étape précédente')}
            >
              <Undo2 className="size-4" />
            </Button>
          </Hint>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {Audience !== null && draft.id !== null && (
            <Audience className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {editable ? (
            <input
              value={draft.label}
              placeholder={title}
              onChange={(e) => change({ label: e.target.value })}
              aria-label={$t('Nom de la question')}
              className="w-full min-w-0 truncate rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold outline-none hover:bg-accent/60 focus:bg-accent/60"
            />
          ) : (
            <h2 className="truncate px-1 text-lg font-semibold">{title}</h2>
          )}
        </div>
        {dirty && draft.id !== null && (
          <span className="text-xs text-muted-foreground">{$t('Modifiée')}</span>
        )}
        <Segmented
          inline
          value={sql ? 'sql' : 'builder'}
          onValueChange={switchMode}
          options={[
            { value: 'builder', label: $t('Éditeur visuel'), icon: Workflow },
            { value: 'sql', label: $t('SQL'), icon: Code2 },
          ]}
          aria-label={$t('Façon d’écrire la question')}
          className="w-auto"
        />
        {hasNotebook && (
          <Hint label={showNotebook ? $t('Masquer le carnet') : $t('Afficher le carnet')}>
            <Button
              variant={showNotebook ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-pressed={showNotebook}
              aria-label={showNotebook ? $t('Masquer le carnet') : $t('Afficher le carnet')}
              onClick={() => setShowNotebook((s) => !s)}
            >
              <PanelLeft className="size-4" />
            </Button>
          </Hint>
        )}
        <Hint label={panel === null ? $t('Afficher les réglages') : $t('Masquer les réglages')}>
          <Button
            variant={panel === null ? 'ghost' : 'secondary'}
            size="icon-sm"
            aria-pressed={panel !== null}
            aria-label={panel === null ? $t('Afficher les réglages') : $t('Masquer les réglages')}
            onClick={() => setPanel(panel === null ? 'viz' : null)}
          >
            <PanelRight className="size-4" />
          </Button>
        </Hint>
        {onUse !== undefined && complete(query) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUse({ ...draft, visualization: draft.visualization ?? visualization })}
          >
            {useLabel}
          </Button>
        )}
        {complete(query) && (draft.id === null || dirty || canMakeView) && (
          <div className="flex">
            <Button
              size="sm"
              className={cn(canMakeView && 'rounded-r-none')}
              disabled={draft.id !== null && !dirty}
              onClick={() => void save()}
            >
              {draft.id !== null && !editable ? $t('Enregistrer une copie') : $t('Enregistrer')}
            </Button>
            {canMakeView && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-l-none border-l border-primary-foreground/30 px-1.5"
                    aria-label={$t('Autres façons d’enregistrer')}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={draft.id !== null && !dirty}
                    onSelect={() => void save()}
                  >
                    <Copy /> {$t('Enregistrer la question')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setViewing(true)}>
                    <Eye /> {$t('Enregistrer comme vue SQL…')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        {draft.id !== null && (
          <DropdownMenu>
            <Hint label={$t('Plus d’actions')}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={$t('Plus d’actions')}>
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end">
              {editable && (
                <DropdownMenuItem onSelect={() => setProperties(true)}>
                  <PencilLine /> {$t('Nom et partage…')}
                </DropdownMenuItem>
              )}
              {complete(query) && (
                <DropdownMenuItem onSelect={() => setCopying(true)}>
                  <Copy /> {$t('Enregistrer une copie…')}
                </DropdownMenuItem>
              )}
              {editable && onDeleted !== undefined && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
                    <Trash2 /> {$t('Supprimer la question')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: the steps of the question. */}
        {hasNotebook && showNotebook && (
          <Pane
            id="question.notebook"
            side="left"
            defaultSize={420}
            min={300}
            max={760}
            className="flex flex-col border-r bg-muted/20"
          >
            <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
              <Notebook base={base} query={builder} onChange={(next) => change({ query: next })} />
            </div>
          </Pane>
        )}

        {/* Middle: the result. */}
        <div className="flex min-w-[280px] min-h-0 flex-1 flex-col">
          {sql && query?.kind === 'sql' && (
            <SqlQuestionEditor
              base={base}
              query={query}
              onChange={(next) => change({ query: next })}
              onRun={(selection) => void run(undefined, selection)}
              running={running}
              console={inConsole}
              error={serverError}
              values={values}
              onValues={setValues}
            />
          )}

          <TabRow className="shrink-0 items-center gap-1 border-b px-3 py-1.5">
            <Tab active={view === 'viz'} onClick={() => setView('viz')}>
              {$t('Visualisation')}
            </Tab>
            <Tab active={view === 'data'} onClick={() => setView('data')}>
              {$t('Données')}
            </Tab>
            <span className="min-w-4 flex-1" />
            {result !== null && !wrote && (
              <span className="px-1 text-xs text-muted-foreground">
                {$t('{rowsCount}{value} · {duration_ms} ms', {
                  rowsCount: $tp(result.rows.length, '{count} ligne', '{count} lignes'),
                  value: result.truncated && $t(' (les premières)'),
                  duration_ms: result.duration_ms,
                })}
              </span>
            )}
            <Hint label={$t('Télécharger en CSV')}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={$t('Télécharger en CSV')}
                disabled={result === null}
                onClick={() => result !== null && download(title, toCsv(result, { base, members }))}
              >
                <Download className="size-4" />
              </Button>
            </Hint>
            {running ? (
              <Hint label={$t('Annuler')}>
                <Button variant="ghost" size="icon-sm" aria-label={$t('Annuler')} onClick={cancel}>
                  <Square className="size-3.5 fill-current" />
                </Button>
              </Hint>
            ) : (
              <Hint label={$t('Relancer')}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={$t('Relancer')}
                  onClick={() => void run()}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </Hint>
            )}
          </TabRow>

          <div className="relative min-h-0 flex-1 overflow-auto p-4 scroll-discret">
            {running && result === null && (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {wrote && execution !== null && (
              <output className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {$t('{command} · {rows}', {
                      command: execution.command,
                      rows: $tp(
                        execution.rows,
                        '{count} ligne modifiée',
                        '{count} lignes modifiées',
                      ),
                    })}
                  </p>
                  <p className="text-xs opacity-90">
                    {$t(
                      'Cette exécution a changé les données de la base : un brouillon exécute avec la console, qui écrit. Enregistrée, la question ne fait que lire.',
                    )}
                  </p>
                </div>
              </output>
            )}
            {errorText !== null && !sql && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {refused
                  ? $t('Cette question cite une donnée qui vous est inaccessible.')
                  : errorText}
              </p>
            )}
            {errorText !== null && sql && serverError === null && (
              <p className="text-sm text-destructive">{errorText}</p>
            )}
            {result !== null && !(wrote && result.columns.length === 0) && (
              <div className={cn('h-full min-h-72', running && 'opacity-60')}>
                <VisualizationView
                  result={result}
                  visualization={shown}
                  base={base}
                  sorted={(builder?.sort ?? []).length > 0 || sql}
                  onDrill={setDrill}
                  onRecord={(tableId, id) => {
                    const t = base.tables.find((x) => x.id === tableId)
                    if (t !== undefined) requestRecord({ base: base.name, table: t.name, id })
                  }}
                />
              </div>
            )}
            {result === null && !running && errorText === null && (
              <div className="flex h-full p-4 text-center">
                <div className="m-auto w-full max-w-sm">
                  {sql && <SqlIllustration />}
                  <p className="text-sm text-muted-foreground">
                    {sql
                      ? $t('Écrivez une requête, puis exécutez-la.')
                      : $t('Rien à montrer encore.')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: how it is drawn, and what it is. */}
        {panel !== null && (
          <Pane
            as="aside"
            id="question.settings"
            side="right"
            defaultSize={320}
            min={260}
            max={600}
            className="flex flex-col border-l"
          >
            <TabRow className="h-12 shrink-0 items-center gap-6 border-b px-5">
              <Tab underlined active={panel === 'viz'} onClick={() => setPanel('viz')}>
                {$t('Visualisation')}
              </Tab>
              <Tab underlined active={panel === 'details'} onClick={() => setPanel('details')}>
                {$t('Détails')}
              </Tab>
            </TabRow>
            <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
              {panel === 'viz' ? (
                <div className="space-y-4 p-4">
                  <VizPicker
                    value={visualization.type}
                    result={result}
                    onChange={(type) => {
                      change({
                        visualization: {
                          type,
                          ...(visualization.settings === undefined
                            ? {}
                            : { settings: visualization.settings }),
                        },
                      })
                      setView('viz')
                    }}
                  />
                  <VizSettings
                    visualization={visualization}
                    result={result}
                    base={base}
                    onChange={(v) => change({ visualization: v })}
                  />
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="question-description" className="text-xs text-muted-foreground">
                      {$t('Description')}
                    </Label>
                    <Textarea
                      id="question-description"
                      value={draft.description ?? ''}
                      readOnly={!editable}
                      rows={4}
                      placeholder={$t('À quoi sert cette question ?')}
                      onChange={(e) =>
                        change({ description: e.target.value === '' ? null : e.target.value })
                      }
                    />
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <dt className="w-24 shrink-0 text-muted-foreground">{$t('Requête')}</dt>
                      <dd>{sql ? $t('SQL') : $t('Éditeur visuel')}</dd>
                    </div>
                    {table !== undefined && (
                      <div className="flex gap-3">
                        <dt className="w-24 shrink-0 text-muted-foreground">{$t('Table')}</dt>
                        <dd className="min-w-0 truncate">{table.label}</dd>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <dt className="w-24 shrink-0 text-muted-foreground">{$t('Portée')}</dt>
                      <dd className="min-w-0">
                        {saved === null ? $t('Pas encore enregistrée') : audience?.title}
                        {saved !== null && audience !== undefined && (
                          <span className="block text-xs text-muted-foreground">
                            {audience.text}
                          </span>
                        )}
                      </dd>
                    </div>
                    {saved !== null && (
                      <div className="flex gap-3">
                        <dt className="w-24 shrink-0 text-muted-foreground">{$t('Modifiée')}</dt>
                        <dd className="min-w-0">
                          {$t('{date}, par {name}', {
                            date: UPDATED.format(new Date(saved.updated_at)),
                            name: saved.updated_by.name,
                          })}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {saved !== null && editable && (
                    <Button variant="outline" size="sm" onClick={() => setProperties(true)}>
                      <PencilLine className="size-4" /> {$t('Nom et partage…')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Pane>
        )}
      </div>

      {drill !== null && (
        <DrillMenu
          base={base}
          query={builder}
          event={drill}
          onDrill={explore}
          {...(onOpenRows === undefined
            ? {}
            : {
                onOpenRows: (rows: BuilderQuery, label: string) =>
                  onOpenRows({
                    id: null,
                    label,
                    description: null,
                    query: rows,
                    visualization: { type: 'table' },
                  }),
              })}
          onClose={() => setDrill(null)}
        />
      )}

      {complete(query) && (
        <QuestionDialog
          open={saving || copying}
          base={base.name}
          manages={manages}
          question={null}
          audience={saveAudience}
          draft={{
            label: copying ? $t('{label} (copie)', { label: title }) : draft.label || title,
            description: draft.description,
            query,
            visualization,
          }}
          onClose={() => {
            setSaving(false)
            setCopying(false)
          }}
          onSaved={done}
        />
      )}

      {viewing && query?.kind === 'sql' && onSqlViewSaved !== undefined && (
        <SqlViewDialog
          open
          base={base}
          view={null}
          definition={query.sql}
          onClose={() => setViewing(false)}
          onSaved={onSqlViewSaved}
        />
      )}

      {saved !== null && (
        <QuestionDialog
          open={properties}
          base={base.name}
          manages={manages}
          question={saved}
          onClose={() => setProperties(false)}
          onSaved={(question) => {
            setSaved(question)
            setDraft((d) => ({ ...d, label: question.label, description: question.description }))
            onSaved?.(question)
          }}
        />
      )}
    </div>
  )
}
