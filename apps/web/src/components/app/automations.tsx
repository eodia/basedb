'use client'

import { AutomationCopilot, type FlowBridge } from '@/components/app/automation-copilot'
import { FlowCanvas, STEP_ICONS, StepMenu } from '@/components/app/automation-flow'
import { PathSettings, StepSettings, TriggerSettings } from '@/components/app/automation-steps'
import { CopilotToggle } from '@/components/app/copilot-toggle'
import { SidebarToggle } from '@/components/app/sidebar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ApiError,
  type Automation,
  type AutomationRun,
  type DescribedBase,
  api,
} from '@/lib/api/client'
import { type Slot, TRIGGER_NODE } from '@/lib/automation-layout'
import {
  type Draft,
  type DraftStep,
  STEP_LABELS,
  type StepKind,
  TRIGGER_LABELS,
  TRIGGER_OF_RUN,
  draftOf,
  draftOfDefinition,
  emptyDraft,
  findPath,
  findStep,
  freshId,
  inputOf,
  insertStep,
  locate,
  moveStep,
  newStep,
  refusalOf,
  removeStep,
  replacePath,
  replaceStep,
  runSentence,
  runStepSentence,
  runStepsById,
} from '@/lib/automations'
import { relativeTime } from '@/lib/collab'
import { $t } from '@/lib/i18n'
import { MembersProvider, useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  ArrowDown,
  ArrowUp,
  Ellipsis,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Sparkles,
  Split,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * The automations of a base — chapter 17, on screen: the list with each one's switch and
 * last run; the editor — the flow drawn, the settings of what is chosen on it; and the
 * runs, each laid over the flow to show the way it took and how each step went.
 */

export function AutomationsPanel({ base }: { readonly base: DescribedBase }) {
  return (
    <MembersProvider>
      <Panel base={base} />
    </MembersProvider>
  )
}

function Panel({ base }: { readonly base: DescribedBase }) {
  const [automations, setAutomations] = useState<readonly Automation[] | null>(null)
  const [selected, setSelected] = useState<string | 'new' | null>(null)
  // A new automation opens empty, or with what the copilot proposed on its flow.
  const [seed, setSeed] = useState<{ readonly n: number; readonly draft: Draft | null }>({
    n: 0,
    draft: null,
  })
  const [folded, setFolded] = useState(false)
  // The copilot stays open from one section to the other: the same switch as the tables'.
  const copilotOpen = useWorkspace((s) => s.copilotOpen)
  const setCopilotOpen = useWorkspace((s) => s.setCopilotOpen)
  // Beside the copilot, the flow needs the room: the list folds, and unfolds on demand.
  useEffect(() => {
    if (copilotOpen) setFolded(true)
  }, [copilotOpen])
  /** The editor on screen, as the copilot reaches it. */
  const editor = useRef<FlowBridge | null>(null)
  const register = useCallback((bridge: FlowBridge | null) => {
    editor.current = bridge
  }, [])
  const flow = useMemo<FlowBridge>(
    () => ({
      current: () => editor.current?.current() ?? null,
      lay: (definition) => editor.current?.lay(definition) ?? null,
      open: (definition) => {
        setSeed((s) => ({ n: s.n + 1, draft: draftOfDefinition(definition, base) }))
        setSelected('new')
      },
    }),
    [base],
  )
  const createNew = () => {
    setSeed((s) => ({ n: s.n + 1, draft: null }))
    setSelected('new')
  }
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await api.automations(base.name)
      setAutomations(list)
      setError(null)
      return list
    } catch (e) {
      setError(messageFor(e))
      return null
    }
  }, [base.name])

  useEffect(() => {
    setSelected(null)
    void load().then((list) => {
      if (list !== null && list.length > 0) setSelected(list[0]?.id ?? null)
    })
  }, [load])

  // The last run of each, kept fresh while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => void load(), 10_000)
    return () => clearInterval(timer)
  }, [load])

  const current =
    selected === null || selected === 'new'
      ? null
      : (automations?.find((a) => a.id === selected) ?? null)

  const toggle = async (automation: Automation, enabled: boolean) => {
    try {
      await api.updateAutomation(base.name, automation.id, { enabled })
      await load()
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setFolded(!folded)}
          aria-label={
            folded
              ? $t('Montrer la liste des automatisations')
              : $t('Replier la liste des automatisations')
          }
          title={folded ? $t('Montrer la liste') : $t('Replier la liste')}
          aria-expanded={!folded}
        >
          {folded ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{$t('Automatisations')}</span>
        <div className="flex-1" />
        <CopilotToggle />
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className={cn('w-64 shrink-0 flex-col border-r', folded ? 'hidden' : 'flex')}>
          <div className="p-3">
            <Button className="w-full gap-1.5" size="sm" onClick={createNew}>
              <Plus className="size-4" />
              {$t('Nouvelle automatisation')}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scroll-discret">
            {automations === null && error === null && (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {automations?.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {$t(
                  'Aucune automatisation. Faites faire à la base ce que vous refaites à la main.',
                )}
              </p>
            )}
            {automations?.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-2',
                  selected === a.id ? 'bg-accent' : 'hover:bg-accent/60',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <Zap
                      className={cn(
                        'size-3.5 shrink-0',
                        a.enabled ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className="truncate">{a.label}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {TRIGGER_LABELS[a.trigger.kind]}
                    {a.last_run !== null && (
                      <>
                        {' · '}
                        <RunDot status={a.last_run.status} /> {relativeTime(a.last_run.at)}
                      </>
                    )}
                  </span>
                </button>
                <Switch
                  checked={a.enabled}
                  onCheckedChange={(v) => void toggle(a, v)}
                  aria-label={
                    a.enabled
                      ? $t('Désactiver {label}', { label: a.label })
                      : $t('Activer {label}', { label: a.label })
                  }
                />
              </div>
            ))}
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          {error !== null && <p className="m-4 text-sm text-destructive">{error}</p>}
          {selected === null ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
              <p>{$t('Choisissez une automatisation, ou créez-en une.')}</p>
              {!copilotOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCopilotOpen(true)}
                >
                  <Sparkles className="size-3.5" />
                  {$t('La décrire au Copilot')}
                </Button>
              )}
            </div>
          ) : (
            <Editor
              key={selected === 'new' ? `new:${seed.n}` : selected}
              base={base}
              automation={current}
              initial={selected === 'new' ? seed.draft : null}
              register={register}
              onSaved={async (saved) => {
                await load()
                setSelected(saved.id)
              }}
              onDeleted={async () => {
                const list = await load()
                setSelected(list?.[0]?.id ?? null)
              }}
            />
          )}
        </main>
        {copilotOpen && (
          <AutomationCopilot
            base={base}
            bridge={flow}
            onScreen={current?.label ?? (selected === 'new' ? 'Nouvelle automatisation' : null)}
            onClose={() => setCopilotOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

function RunDot({ status }: { readonly status: string }) {
  const tone =
    status === 'succeeded'
      ? 'bg-emerald-500'
      : status === 'failed'
        ? 'bg-rose-500'
        : status === 'skipped'
          ? 'bg-muted-foreground/50'
          : 'bg-amber-500'
  return <span className={cn('inline-block size-1.5 rounded-full align-middle', tone)} />
}

/** The runs of an automation, read again while one is under way. */
function useRuns(base: DescribedBase, automation: Automation | null, tick: number) {
  const [runs, setRuns] = useState<readonly AutomationRun[] | null>(null)
  const id = automation?.id ?? null
  const load = useCallback(async () => {
    if (id === null) return
    setRuns(await api.automationRuns(base.name, id).catch(() => []))
  }, [base.name, id])

  useEffect(() => {
    void tick
    void load()
  }, [load, tick])

  const pending = useMemo(
    () => (runs ?? []).some((r) => r.status === 'queued' || r.status === 'running'),
    [runs],
  )
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => void load(), 2000)
    return () => clearInterval(timer)
  }, [pending, load])
  return runs
}

function Editor({
  base,
  automation,
  initial,
  register,
  onSaved,
  onDeleted,
}: {
  readonly base: DescribedBase
  readonly automation: Automation | null
  /** What a new automation opens with — a proposal of the copilot. */
  readonly initial: Draft | null
  /** Gives the copilot the editor's flow, to read and to lay a proposal on. */
  readonly register: (bridge: FlowBridge | null) => void
  readonly onSaved: (saved: Automation) => Promise<void>
  readonly onDeleted: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(
    () => initial ?? (automation === null ? emptyDraft(base) : draftOf(automation, base)),
  )
  const draftRef = useRef(draft)
  draftRef.current = draft
  // What was last saved, to say when the draft differs from it.
  const [savedAs, setSavedAs] = useState(() => JSON.stringify(inputOf(draft)))
  const [selected, setSelected] = useState<string>(TRIGGER_NODE)
  const [tab, setTab] = useState<'settings' | 'runs'>('settings')
  const [focus, setFocus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{
    readonly text: string
    readonly step: string | null
  } | null>(null)
  const [runsTick, setRunsTick] = useState(0)
  const [shownRun, setShownRun] = useState<string | null>(null)
  const members = useMembers()
  const runs = useRuns(base, automation, runsTick)

  // The copilot reads what is on screen, and lays a proposal on it — unsaved, undoable
  // while nothing was changed since.
  useEffect(() => {
    register({
      current: () => ({
        id: automation?.id ?? null,
        label: draftRef.current.label,
        input: inputOf(draftRef.current),
      }),
      lay: (definition) => {
        const before = draftRef.current
        const next = draftOfDefinition(definition, base)
        setDraft(next)
        setSelected(TRIGGER_NODE)
        setTab('settings')
        setShownRun(null)
        const laid = JSON.stringify(inputOf(next))
        return () => {
          if (JSON.stringify(inputOf(draftRef.current)) !== laid) return false
          setDraft(before)
          return true
        }
      },
      open: () => undefined,
    })
    return () => register(null)
  }, [register, automation, base])
  const run = runs?.find((r) => r.id === shownRun) ?? null
  const dirty = JSON.stringify(inputOf(draft)) !== savedAs

  const select = useCallback((id: string) => {
    setSelected(id)
    setTab('settings')
  }, [])

  const insert = (slot: Slot, kind: StepKind) => {
    const id = freshId(draft.steps, 'e')
    const step = newStep(kind, draft, base, id)
    setDraft((d) => ({ ...d, steps: insertStep(d.steps, slot.path, slot.index, step) }))
    setSelected(id)
    setFocus(id)
    setTab('settings')
    setShownRun(null)
  }

  const setSteps = (edit: (steps: readonly DraftStep[]) => DraftStep[]) =>
    setDraft((d) => ({ ...d, steps: edit(d.steps) }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved =
        automation === null
          ? await api.createAutomation(base.name, inputOf(draft))
          : await api.updateAutomation(base.name, automation.id, inputOf(draft))
      // Read back as the API keeps it: the identifiers it gave, the texts it trimmed.
      const kept = draftOf(saved, base)
      setDraft(kept)
      setSavedAs(JSON.stringify(inputOf(kept)))
      await onSaved(saved)
    } catch (e) {
      // A refusal about a step is shown on it.
      const refusal = e instanceof ApiError ? refusalOf(e.details) : null
      setError({ text: refusal?.sentence ?? messageFor(e), step: refusal?.step ?? null })
      if (refusal !== null && refusal.step !== null && findStep(draft.steps, refusal.step)) {
        select(refusal.step)
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (automation === null) return
    setBusy(true)
    try {
      await api.deleteAutomation(base.name, automation.id)
      await onDeleted()
    } catch (e) {
      setError({ text: messageFor(e), step: null })
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <Input
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          aria-label={$t('Nom de l’automatisation')}
          className="h-8 w-72 max-w-full font-semibold"
          maxLength={255}
        />
        <label htmlFor="automation-enabled" className="flex items-center gap-2 text-sm">
          <Switch
            id="automation-enabled"
            checked={draft.enabled}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
          />
          {$t('Active')}
        </label>
        <div className="flex-1" />
        {dirty && automation !== null && (
          <span className="text-xs text-muted-foreground">
            {$t('Modifications non enregistrées')}
          </span>
        )}
        {automation !== null && (
          <TestRun
            base={base}
            automation={automation}
            disabled={busy || dirty}
            onRan={(id) => {
              setRunsTick((t) => t + 1)
              setShownRun(id)
              setTab('runs')
            }}
            onError={(text) => setError(text === null ? null : { text, step: null })}
          />
        )}
        <Button onClick={() => void save()} disabled={busy || draft.steps.length === 0} size="sm">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {automation === null ? $t('Créer') : $t('Enregistrer')}
        </Button>
        {automation !== null && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={$t('Autres actions')}>
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={busy}
                onSelect={() => void remove()}
              >
                <Trash2 className="size-4" />
                {$t('Supprimer l’automatisation')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {error !== null && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-destructive/8 px-4 py-2 text-sm text-destructive">
          <span className="min-w-0 flex-1">
            {error.step !== null && <span className="font-mono">{error.step} · </span>}
            {error.text}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={$t('Fermer le message')}
            onClick={() => setError(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <FlowCanvas
            draft={draft}
            base={base}
            members={members}
            selected={tab === 'settings' ? selected : ''}
            onSelect={select}
            onInsert={insert}
            run={run}
            focus={focus}
          />
          {run !== null && (
            <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 whitespace-nowrap rounded-full border bg-card px-3 py-1 text-xs shadow-sm">
              <RunDot status={run.status} />
              <span className="truncate font-medium">{runSentence(run)}</span>
              <span className="text-muted-foreground">· {relativeTime(run.queued_at)}</span>
              <button
                type="button"
                onClick={() => setShownRun(null)}
                className="ml-1 rounded-sm text-muted-foreground hover:text-foreground"
                aria-label={$t('Ne plus montrer cette exécution')}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {draft.steps.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
              <p className="rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-xs">
                {$t('Réglez le déclencheur, puis ajoutez ce qu’elle doit faire.')}
              </p>
            </div>
          )}
        </div>
        <aside className="flex w-[360px] shrink-0 flex-col border-l bg-background">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'settings' | 'runs')}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="border-b px-3 py-2">
              <TabsList className="w-full">
                <TabsTrigger value="settings" className="flex-1">
                  {$t('Réglages||onglet d’une automatisation')}
                </TabsTrigger>
                <TabsTrigger value="runs" className="flex-1" disabled={automation === null}>
                  {$t('Exécutions')}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="settings" className="min-h-0 flex-1 overflow-y-auto scroll-discret">
              <Inspector
                draft={draft}
                base={base}
                automation={automation}
                selected={selected}
                onSelect={select}
                onDraft={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                onSteps={setSteps}
                onInsert={insert}
              />
            </TabsContent>
            <TabsContent value="runs" className="min-h-0 flex-1 overflow-y-auto scroll-discret">
              <Runs
                runs={runs}
                draft={draft}
                shown={shownRun}
                onShow={(id) => setShownRun((current) => (current === id ? null : id))}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  )
}

/** The settings of what is chosen on the flow, and what can be done with it. */
function Inspector({
  draft,
  base,
  automation,
  selected,
  onSelect,
  onDraft,
  onSteps,
  onInsert,
}: {
  readonly draft: Draft
  readonly base: DescribedBase
  readonly automation: Automation | null
  readonly selected: string
  readonly onSelect: (id: string) => void
  readonly onDraft: (patch: Partial<Draft>) => void
  readonly onSteps: (edit: (steps: readonly DraftStep[]) => DraftStep[]) => void
  readonly onInsert: (slot: Slot, kind: StepKind) => void
}) {
  const members = useMembers()

  if (selected === TRIGGER_NODE) {
    return (
      <Pane
        icon={<Zap className="size-4" />}
        title={$t('Déclencheur')}
        tone="bg-primary/12 text-primary"
      >
        <TriggerSettings draft={draft} base={base} automation={automation} onChange={onDraft} />
        {draft.steps.length === 0 && (
          <StepMenu onPick={(kind) => onInsert({ path: null, index: 0 }, kind)} align="start">
            <Button variant="outline" size="sm" className="mt-6 w-full gap-1.5">
              <Plus className="size-4" />
              {$t('Ajouter une étape')}
            </Button>
          </StepMenu>
        )}
      </Pane>
    )
  }

  const step = findStep(draft.steps, selected)
  if (step !== null) {
    const where = locate(draft.steps, step.id)
    const Icon = STEP_ICONS[step.kind]
    return (
      <Pane
        icon={<Icon className="size-4" />}
        title={STEP_LABELS[step.kind]}
        id={step.id}
        tone="bg-muted text-foreground"
        footer={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={where === null || where.index === 0}
              onClick={() => onSteps((s) => moveStep(s, step.id, -1))}
              aria-label={$t('Monter l’étape')}
              title={$t('Monter l’étape')}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={where === null || where.index === where.length - 1}
              onClick={() => onSteps((s) => moveStep(s, step.id, 1))}
              aria-label={$t('Descendre l’étape')}
              title={$t('Descendre l’étape')}
            >
              <ArrowDown className="size-4" />
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                onSteps((s) => removeStep(s, step.id))
                onSelect(TRIGGER_NODE)
              }}
            >
              <Trash2 className="size-4" />
              {step.kind === 'branch'
                ? $t('Retirer la condition et ses chemins')
                : $t('Retirer l’étape')}
            </Button>
          </>
        }
      >
        <StepSettings
          step={step}
          draft={draft}
          base={base}
          members={members}
          onChange={(next) => onSteps((s) => replaceStep(s, step.id, next))}
          onSelect={onSelect}
        />
      </Pane>
    )
  }

  const found = findPath(draft.steps, selected)
  if (found !== null) {
    const { branch, path } = found
    return (
      <Pane
        icon={<Split className="size-4" />}
        title={path.otherwise ? $t('Chemin « Sinon »') : $t('Chemin')}
        id={path.id}
        tone="bg-amber-500/15 text-amber-700 dark:text-amber-300"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => onSelect(branch.id)}>
              {$t('Tous les chemins')}
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={branch.paths.length === 1}
              onClick={() => {
                onSteps((s) =>
                  replaceStep(s, branch.id, {
                    ...branch,
                    paths: branch.paths.filter((p) => p.id !== path.id),
                  }),
                )
                onSelect(branch.id)
              }}
            >
              <Trash2 className="size-4" />
              {$t('Retirer le chemin')}
            </Button>
          </>
        }
      >
        <PathSettings
          path={path}
          draft={draft}
          base={base}
          onChange={(next) => onSteps((s) => replacePath(s, path.id, () => next))}
        />
        <StepMenu
          onPick={(kind) => onInsert({ path: path.id, index: path.steps.length }, kind)}
          align="start"
        >
          <Button variant="outline" size="sm" className="mt-6 w-full gap-1.5">
            <Plus className="size-4" />
            {$t('Ajouter une étape à ce chemin')}
          </Button>
        </StepMenu>
      </Pane>
    )
  }

  return (
    <p className="p-6 text-center text-sm text-muted-foreground">
      {$t('Choisissez une étape sur le flux pour la régler.')}
    </p>
  )
}

function Pane({
  icon,
  title,
  id,
  tone,
  footer,
  children,
}: {
  readonly icon: ReactNode
  readonly title: string
  readonly id?: string
  readonly tone: string
  readonly footer?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span className={cn('flex size-7 items-center justify-center rounded-md', tone)}>
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        {id !== undefined && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {id}
          </span>
        )}
      </div>
      <div className="flex-1 px-4 pb-4">{children}</div>
      {footer !== undefined && (
        <div className="sticky bottom-0 flex items-center gap-1 border-t bg-background px-2 py-2">
          {footer}
        </div>
      )}
    </div>
  )
}

/** « Tester » : an ordinary run, on a row chosen among the first of the table. */
function TestRun({
  base,
  automation,
  disabled,
  onRan,
  onError,
}: {
  readonly base: DescribedBase
  readonly automation: Automation
  readonly disabled: boolean
  readonly onRan: (run: string) => void
  readonly onError: (message: string | null) => void
}) {
  const table = base.tables.find((t) => t.id === automation.trigger.table) ?? null
  const [rows, setRows] = useState<ReadonlyArray<{ id: string; label: string }> | null>(null)
  const [busy, setBusy] = useState(false)
  const title = disabled
    ? $t('Enregistrez d’abord : l’essai exécute ce qui est enregistré')
    : undefined

  const run = async (record: string | null) => {
    setBusy(true)
    onError(null)
    try {
      const queued = await api.runAutomation(automation.id, record)
      onRan(queued.run)
    } catch (e) {
      onError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const loadRows = async () => {
    if (table === null || rows !== null) return
    const page = await api.list(table, { limit: 20 }).catch(() => null)
    const display = table.display_field
    setRows(
      (page?.data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r._id),
        label: display === null ? String(r._id).slice(0, 8) : String(r[display] ?? '—'),
      })),
    )
  }

  if (table === null) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy || disabled}
        title={title}
        onClick={() => void run(null)}
        className="gap-1.5"
      >
        <Play className="size-4" />
        {$t('Tester')}
      </Button>
    )
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && void loadRows()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || disabled}
          title={title}
          className="gap-1.5"
        >
          <Play className="size-4" />
          {$t('Tester sur une ligne')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
        {rows === null && (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {rows?.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">{$t('La table est vide.')}</p>
        )}
        {rows?.map((r) => (
          <DropdownMenuItem key={r.id} onSelect={() => void run(r.id)}>
            <span className="truncate">{r.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The runs, newest first; one chosen is laid over the flow, and told step by step. */
function Runs({
  runs,
  draft,
  shown,
  onShow,
}: {
  readonly runs: readonly AutomationRun[] | null
  readonly draft: Draft
  readonly shown: string | null
  readonly onShow: (id: string) => void
}) {
  if (runs === null) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (runs.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        {$t('Pas encore d’exécution. « Tester » en lance une sur la ligne de votre choix.')}
      </p>
    )
  }
  return (
    <div className="space-y-1 p-2">
      <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
        {$t(
          'Les 50 dernières, gardées 30 jours. Choisissez-en une pour voir, sur le flux, le chemin qu’elle a pris.',
        )}
      </p>
      {runs.map((run) => {
        const open = run.id === shown
        const steps = open ? runStepsById(run, draft.steps) : null
        return (
          <div
            key={run.id}
            className={cn(
              'rounded-md border',
              open ? 'border-primary/50 bg-accent/40' : 'border-transparent',
            )}
          >
            <button
              type="button"
              onClick={() => onShow(run.id)}
              aria-expanded={open}
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-accent/60"
            >
              <span className="flex items-center gap-2 text-sm">
                <RunDot status={run.status} />
                <span className="truncate font-medium">{runSentence(run)}</span>
              </span>
              <span className="block pl-3.5 text-xs text-muted-foreground">
                {TRIGGER_OF_RUN[run.trigger] ?? run.trigger} · {relativeTime(run.queued_at)}
              </span>
            </button>
            {steps !== null && steps.size > 0 && (
              <ol className="space-y-0.5 px-2 pb-2 pl-5.5 text-xs">
                {[...steps].map(([id, record]) => {
                  const step = findStep(draft.steps, id)
                  const label =
                    step === null
                      ? (STEP_LABELS[(record.kind ?? record.action) as StepKind] ?? id)
                      : STEP_LABELS[step.kind]
                  return (
                    <li
                      key={id}
                      className={cn(
                        'flex gap-1.5',
                        record.status === 'failed' ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      <span className="font-mono text-[11px]">{id}</span>
                      <span className="min-w-0">
                        {label} — {runStepSentence(record)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}
