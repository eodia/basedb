'use client'

import { DrillMenu } from '@/components/app/analytics/drill-menu'
import { useValueLabel } from '@/components/app/analytics/filter-editor'
import { Notebook } from '@/components/app/analytics/notebook'
import { QuestionDialog } from '@/components/app/analytics/question-dialog'
import {
  SqlQuestionEditor,
  testConstraints,
  variablesOf,
} from '@/components/app/analytics/sql-question'
import { type DrillEvent, VisualizationView } from '@/components/app/analytics/visualization'
import { VIZ_ICONS, VizPicker, VizSettings } from '@/components/app/analytics/viz-settings'
import { SqlIllustration } from '@/components/app/sql-illustration'
import { audienceIcon } from '@/components/app/sql/query-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Hint } from '@/components/ui/tooltip'
import { toCsv } from '@/lib/analytics/format'
import {
  VIZ_LABELS,
  autoVisualization,
  columnsOf,
  describeFilter,
  tableOf,
} from '@/lib/analytics/model'
import {
  ApiError,
  type DescribedBase,
  type QueryAudience,
  type Question,
  api,
} from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { weekStart } from '@/lib/preferences'
import { type QuestionDraft, useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import type {
  BuilderQuery,
  QueryResult,
  QuestionQuery,
  Visualization,
  VisualizationType,
} from '@basedb/contracts'
import {
  ArrowLeft,
  Copy,
  Download,
  Ellipsis,
  Loader2,
  NotebookPen,
  PencilLine,
  RefreshCw,
  Settings2,
  Table2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A question, opened — chapter 18 §1: among the dashboards, or in a tab of the workspace.
 * Built with the mouse in its notebook or written in SQL; run with the rights of whoever
 * looks, read only; drawn the way it reads best, or the way its author chose; explored by
 * a click on a point, each step a question of its own that can be walked back. Anyone
 * keeps their own; whoever builds the base shares them, or puts them in a dashboard.
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

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[\\/:*?"<>|]+/g, '-') || 'question'}.csv`
  link.click()
  URL.revokeObjectURL(url)
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
  const [mode, setMode] = useState<'notebook' | 'result'>(
    !sql && (initial.id === null || !complete(initial.query)) && initial.visualization === null
      ? 'notebook'
      : 'result',
  )
  const [result, setResult] = useState<QueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<ApiError | string | null>(null)
  const [settings, setSettings] = useState(false)
  const [rawTable, setRawTable] = useState(false)
  const [drill, setDrill] = useState<DrillEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const members = useMembers()
  const requestRecord = useWorkspace((s) => s.requestRecord)
  const valueLabel = useValueLabel()
  const controller = useRef<AbortController | null>(null)

  const run = useCallback(
    async (query: QuestionQuery | null = draft.query) => {
      if (!complete(query)) return
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current
      setRunning(true)
      setError(null)
      try {
        const constraints = query.kind === 'sql' ? testConstraints(variablesOf(query), values) : []
        const next = await api.runQuestion(
          base.name,
          { query, constraints, weekStart: weekStart() },
          current.signal,
        )
        if (!current.signal.aborted) setResult(next)
      } catch (e) {
        if (current.signal.aborted) return
        setResult(null)
        setError(e instanceof ApiError ? e : messageFor(e))
      } finally {
        if (!current.signal.aborted) setRunning(false)
      }
    },
    [base.name, draft.query, values],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, on what it was opened on
  useEffect(() => {
    if (mode === 'result') void run(initial.query)
    return () => controller.current?.abort()
  }, [])

  const change = (patch: Partial<QuestionDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setDirty(true)
  }
  const draftChanged = useRef(onDraftChange)
  draftChanged.current = onDraftChange
  useEffect(() => draftChanged.current?.(draft), [draft])
  const query = draft.query
  const visualization: Visualization = draft.visualization ?? {
    type: query === null ? 'table' : autoVisualization(query, result),
  }
  const shown: Visualization = rawTable ? { type: 'table' } : visualization
  const builder = query?.kind === 'builder' ? query : null
  const columns = builder === null ? [] : columnsOf(base, builder)

  const explore = (next: BuilderQuery, type?: VisualizationType) => {
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
    setRawTable(false)
    setMode('result')
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
          message: errorText ?? '',
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
        {!sql && query !== null && (
          <Button
            variant={mode === 'notebook' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              if (mode === 'notebook') {
                setMode('result')
                void run()
              } else setMode('notebook')
            }}
            className="gap-1.5"
          >
            <NotebookPen className="size-4" />
            {mode === 'notebook' ? $t('Voir le résultat') : $t('Éditeur')}
          </Button>
        )}
        {onUse !== undefined && complete(query) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUse({ ...draft, visualization: draft.visualization ?? visualization })}
          >
            {useLabel}
          </Button>
        )}
        {complete(query) && (draft.id === null || dirty) && (
          <Button size="sm" onClick={() => void save()}>
            {draft.id !== null && !editable ? $t('Enregistrer une copie') : $t('Enregistrer')}
          </Button>
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

      {sql && query?.kind === 'sql' && (
        <SqlQuestionEditor
          base={base}
          query={query}
          onChange={(next) => change({ query: next })}
          onRun={() => void run()}
          running={running}
          error={serverError}
          values={values}
          onValues={setValues}
        />
      )}

      {builder !== null && mode === 'result' && (builder.filters ?? []).length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
          {(builder.filters ?? []).map((f, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: filters are listed in place, by position
              key={index}
              className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 py-0.5 pr-1 pl-2.5 text-xs font-medium text-violet-700 dark:text-violet-300"
            >
              {describeFilter(f, columns, valueLabel)}
              <button
                type="button"
                aria-label={$t('Retirer le filtre')}
                className="rounded-full p-0.5 hover:bg-violet-500/20"
                onClick={() => {
                  const next = {
                    ...builder,
                    filters: (builder.filters ?? []).filter((_, i) => i !== index),
                  }
                  change({ query: next })
                  void run(next)
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {settings && mode === 'result' && (
          <aside className="w-80 shrink-0 space-y-4 overflow-y-auto border-r p-4 scroll-discret">
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
                setRawTable(false)
              }}
            />
            <VizSettings
              visualization={visualization}
              result={result}
              base={base}
              onChange={(v) => change({ visualization: v })}
            />
          </aside>
        )}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-auto scroll-discret">
          {!sql && mode === 'notebook' ? (
            <Notebook
              base={base}
              query={builder}
              onChange={(next) => change({ query: next })}
              onRun={() => {
                setMode('result')
                void run()
              }}
              running={running}
            />
          ) : (
            <div className="flex size-full min-h-72 flex-col p-4">
              {running && result === null && (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
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
              {result !== null && (
                <div className={cn('min-h-0 flex-1', running && 'opacity-60')}>
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
                <div className="flex flex-1 p-4 text-center">
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
          )}
        </div>
      </div>

      {mode === 'result' && (
        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t px-3 py-1.5">
          <Popover modal>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                {(() => {
                  const Icon = VIZ_ICONS[visualization.type]
                  return <Icon className="size-4" />
                })()}
                {VIZ_LABELS[visualization.type]}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="top">
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
                  setRawTable(false)
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant={settings ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => setSettings((s) => !s)}
          >
            <Settings2 className="size-4" />
            {$t('Réglages')}
          </Button>
          <div className="flex-1" />
          {result !== null && (
            <span className="text-xs text-muted-foreground">
              {$t('{rowsCount}{value} · {duration_ms} ms', {
                rowsCount: $tp(result.rows.length, '{count} ligne', '{count} lignes'),
                value: result.truncated && $t(' (les premières)'),
                duration_ms: result.duration_ms,
              })}
            </span>
          )}
          <Hint label={$t('Voir les données en tableau')}>
            <Button
              variant={rawTable ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label={$t('Voir les données en tableau')}
              onClick={() => setRawTable((r) => !r)}
              disabled={visualization.type === 'table'}
            >
              <Table2 className="size-4" />
            </Button>
          </Hint>
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
          <Hint label={$t('Relancer')}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={$t('Relancer')}
              onClick={() => void run()}
            >
              <RefreshCw className={cn('size-4', running && 'animate-spin')} />
            </Button>
          </Hint>
        </footer>
      )}

      {drill !== null && (
        <DrillMenu
          base={base}
          query={builder}
          event={drill}
          onDrill={explore}
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
