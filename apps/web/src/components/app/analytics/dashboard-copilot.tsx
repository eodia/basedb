'use client'

import { describeValue } from '@/components/app/analytics/parameters'
import type { QuestionDraft } from '@/components/app/analytics/question-view'
import { VisualizationView } from '@/components/app/analytics/visualization'
import { VIZ_ICONS } from '@/components/app/analytics/viz-settings'
import { Reads } from '@/components/app/copilot-panel'
import { ResizablePanel } from '@/components/app/resizable-panel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { newId, placed, sizeFor } from '@/lib/analytics/dashboard'
import { VIZ_LABELS } from '@/lib/analytics/model'
import { type CopilotMessage, type Dashboard, type DescribedBase, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import type {
  DashboardChange,
  DashboardCopilotAction,
  DashboardCopilotAnswer,
  ParameterValue,
  QueryResult,
} from '@basedb/contracts'
import {
  ArrowUp,
  Check,
  Compass,
  Heading,
  LayoutDashboard,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

/**
 * The copilot of the dashboards — chapter 18 §2.6, on screen.
 *
 * A conversation about the dashboards of the base, beside them. The person asks in their
 * words; the answer is a few sentences and CARDS: a question, drawn right there, to open
 * or to put on the dashboard; changes to the dashboard on screen, or a new one; values for
 * its filters. A card changes nothing until its button is pressed, and then goes through
 * the same routes as the editor — one save, which can be undone from the card.
 *
 * By default only the structure leaves the instance. The box under the conversation lets
 * the copilot read the results of the cards, under the filters on screen, to comment them.
 */

type Values = Readonly<Record<string, ParameterValue | null>>

/** What is on screen: the tab shown and the values of the filters. */
export interface DashboardScreen {
  readonly tab: string | null
  readonly values: Values
}

interface Props {
  readonly base: DescribedBase
  /** The dashboard on screen, when there is one. */
  readonly dashboard: Dashboard | null
  readonly screen: DashboardScreen
  readonly builds: boolean
  readonly onClose: () => void
  readonly onOpenQuestion: (draft: QuestionDraft) => void
  /** A dashboard was saved from a card: the list, and the screen, show it. */
  readonly onSaved: (dashboard: Dashboard) => void
  readonly onCreated: (dashboard: Dashboard) => void
  readonly onSetFilters: (values: Values) => void
}

type CardState =
  | { readonly status: 'idle' }
  | { readonly status: 'busy' }
  | {
      readonly status: 'done'
      readonly note: string
      /** What the dashboard was before, to undo — and the version the save made. */
      readonly undo?: { readonly before: Dashboard; readonly after: string }
      /** An undo that failed: the card stays applied, and says why. */
      readonly failure?: string
    }
  | { readonly status: 'error'; readonly note: string }

interface Turn {
  readonly id: number
  readonly question: string
  readonly answer: DashboardCopilotAnswer | null
  readonly error: string | null
  readonly cards: readonly CardState[]
}

interface Conversation {
  readonly turns: readonly Turn[]
  readonly readData: boolean
}

const EMPTY: Conversation = { turns: [], readData: false }

/** Kept while the page lives, per base: closing the panel does not end the conversation. */
const conversations = new Map<string, Conversation>()

let sequence = 0

export function DashboardCopilot({
  base,
  dashboard,
  screen,
  builds,
  onClose,
  onOpenQuestion,
  onSaved,
  onCreated,
  onSetFilters,
}: Props) {
  const [conversation, setConversation] = useState<Conversation>(
    () => conversations.get(base.name) ?? EMPTY,
  )
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setConversation(conversations.get(base.name) ?? EMPTY)
  }, [base.name])

  const update = useCallback(
    (change: (current: Conversation) => Conversation) => {
      setConversation((current) => {
        const next = change(current)
        conversations.set(base.name, next)
        return next
      })
    },
    [base.name],
  )

  const turnCount = conversation.turns.length
  const lastAnswered = conversation.turns.at(-1)?.answer !== null
  useEffect(() => {
    void turnCount
    void lastAnswered
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turnCount, lastAnswered])

  const send = async (text: string) => {
    const question = text.trim()
    if (question === '' || busy) return
    // Past every turn kept: a counter of the module alone would restart under a turn kept.
    const id = Math.max(++sequence, ...conversation.turns.map((t) => t.id + 1))
    sequence = id
    const history: CopilotMessage[] = conversation.turns.flatMap((t) => [
      { role: 'user' as const, content: t.question },
      ...(t.answer === null ? [] : [{ role: 'assistant' as const, content: recap(t) }]),
    ])
    update((c) => ({
      ...c,
      turns: [...c.turns, { id, question, answer: null, error: null, cards: [] }],
    }))
    setPrompt('')
    setBusy(true)
    try {
      const answer = await api.dashboardCopilot(base.name, {
        dashboard: dashboard?.id ?? null,
        tab: screen.tab,
        values: screen.values,
        messages: [...history, { role: 'user', content: question }],
        readData: conversation.readData,
      })
      update((c) => ({
        ...c,
        turns: c.turns.map((t) =>
          t.id === id
            ? { ...t, answer, cards: answer.actions.map(() => ({ status: 'idle' as const })) }
            : t,
        ),
      }))
    } catch (e) {
      update((c) => ({
        ...c,
        turns: c.turns.map((t) => (t.id === id ? { ...t, error: messageFor(e) } : t)),
      }))
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  const setCard = (turnId: number, index: number, state: CardState) =>
    update((c) => ({
      ...c,
      turns: c.turns.map((t) =>
        t.id === turnId ? { ...t, cards: t.cards.map((s, i) => (i === index ? state : s)) } : t,
      ),
    }))

  const act = async (turnId: number, index: number, work: () => Promise<CardState>) => {
    setCard(turnId, index, { status: 'busy' })
    try {
      setCard(turnId, index, await work())
    } catch (e) {
      setCard(turnId, index, {
        status: 'error',
        note: e instanceof Error && !('code' in e) ? e.message : messageFor(e),
      })
    }
  }

  /** Applies a change to the dashboard on screen, or creates the new one. One save. */
  const applyDashboard = async (
    action: Extract<DashboardCopilotAction, { type: 'dashboard' }>,
  ): Promise<CardState> => {
    if (action.target === 'new') {
      const created = await api.createDashboard(base.name, {
        label: action.label,
        description: action.description,
        ...action.content,
      })
      onCreated(created)
      return { status: 'done', note: $t('Tableau de bord créé.') }
    }
    if (dashboard === null || dashboard.id !== action.dashboard) {
      throw new Error('Ouvrez le tableau de bord que cette proposition modifie.')
    }
    if (dashboard.updated_at !== action.basedOn) {
      throw new Error('Le tableau a changé depuis la proposition : redemandez-la.')
    }
    const saved = await api.updateDashboard(base.name, dashboard.id, {
      label: action.label,
      description: action.description,
      ...action.content,
    })
    onSaved(saved)
    return {
      status: 'done',
      note: $t('Modifications appliquées.'),
      undo: { before: dashboard, after: saved.updated_at },
    }
  }

  const undo = async (state: Extract<CardState, { status: 'done' }>): Promise<CardState> => {
    const back = state.undo
    if (back === undefined) return state
    if (dashboard === null || dashboard.id !== back.before.id) {
      throw new Error('Ouvrez le tableau de bord pour annuler.')
    }
    if (dashboard.updated_at !== back.after) {
      throw new Error('Le tableau a changé depuis : l’annulation le remplacerait.')
    }
    const saved = await api.updateDashboard(base.name, dashboard.id, {
      label: back.before.label,
      description: back.before.description,
      tabs: back.before.tabs,
      cards: back.before.cards,
      parameters: back.before.parameters,
    })
    onSaved(saved)
    return { status: 'done', note: $t('Modifications annulées.') }
  }

  /** Puts a question at the bottom of the tab on screen. */
  const addQuestion = async (
    action: Extract<DashboardCopilotAction, { type: 'question' }>,
  ): Promise<CardState> => {
    if (dashboard === null) throw new Error('Ouvrez un tableau de bord.')
    const tab = dashboard.tabs.some((t) => t.id === screen.tab)
      ? screen.tab
      : (dashboard.tabs[0]?.id ?? null)
    const card = {
      id: newId('c'),
      tab,
      kind: 'question' as const,
      title: action.label,
      query: action.query,
      visualization: action.visualization,
      ...placed(dashboard.cards, tab, sizeFor('question', action.visualization.type)),
    }
    const saved = await api.updateDashboard(base.name, dashboard.id, {
      cards: [...dashboard.cards, card],
    })
    onSaved(saved)
    return {
      status: 'done',
      note: $t('Ajoutée à « {label} ».', { label: dashboard.label }),
      undo: { before: dashboard, after: saved.updated_at },
    }
  }

  const restart = () => {
    conversations.delete(base.name)
    setConversation(EMPTY)
    setPrompt('')
    input.current?.focus()
  }

  const suggestions =
    dashboard === null
      ? [
          $t('Crée un tableau de bord de suivi pour cette base'),
          $t('Quels chiffres clés suivre dans cette base ?'),
          $t('Combien de lignes ont été ajoutées ce mois-ci, par table ?'),
        ]
      : [
          $t('Résume ce que montre ce tableau de bord'),
          $t('Ajoute un filtre de période relié aux cartes'),
          $t('Qu’est-ce qui a le plus changé ce mois-ci ?'),
          $t('Ajoute les chiffres clés qui manquent en haut'),
          $t('Montre-moi seulement le mois dernier'),
        ]

  return (
    <ResizablePanel panel="copilot" label={$t('le Copilot')} className="bg-sidebar">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Sparkles className="size-4 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">
          {$t('Copilot')}{' '}
          <span className="font-normal text-muted-foreground">
            · {dashboard?.label ?? $t('Tableaux de bord')}
          </span>
        </span>
        {conversation.turns.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={restart}
            disabled={busy}
            aria-label={$t('Nouvelle conversation')}
            title={$t('Nouvelle conversation')}
          >
            <RotateCcw className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={$t('Fermer le copilot')}
        >
          <X className="size-4" />
        </Button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-discret p-3">
        {conversation.turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {$t(
                'Posez une question sur vos données, demandez une carte, un filtre, un onglet, un nouveau tableau de bord…',
              )}
              {dashboard !== null && (
                <>
                  {' '}
                  {$t('Sur')} <span className="text-foreground">{dashboard.label}</span>{' '}
                  {$t('par défaut.')}
                </>
              )}{' '}
              {$t('Chaque proposition s’applique d’un clic, et rien ne change sans vous.')}
            </p>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => void send(text)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted"
                >
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {conversation.turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            <div className="ml-8 whitespace-pre-line rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              {turn.question}
            </div>

            {turn.answer === null && turn.error === null && (
              <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {conversation.readData
                  ? $t('Réflexion, lecture des résultats au besoin…')
                  : $t('Réflexion…')}
              </p>
            )}

            {turn.error !== null && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                {turn.error}
              </p>
            )}

            {turn.answer !== null && (
              <div className="space-y-2">
                {turn.answer.message !== '' && (
                  <p className="whitespace-pre-line px-1 text-sm leading-relaxed">
                    {turn.answer.message}
                  </p>
                )}
                {turn.answer.reads.length > 0 && <Reads reads={turn.answer.reads} />}
                {turn.answer.actions.map((action, index) => {
                  const state = turn.cards[index] ?? { status: 'idle' }
                  const run = (work: () => Promise<CardState>) => void act(turn.id, index, work)
                  return (
                    <ActionCard
                      // biome-ignore lint/suspicious/noArrayIndexKey: the cards of an answer never move
                      key={index}
                      action={action}
                      base={base}
                      dashboard={dashboard}
                      builds={builds}
                      state={state}
                      onApply={() => {
                        if (action.type === 'dashboard') run(() => applyDashboard(action))
                        else if (action.type === 'set_filters') {
                          run(async () => {
                            onSetFilters(action.values)
                            return { status: 'done', note: $t('Filtres appliqués.') }
                          })
                        } else run(() => addQuestion(action))
                      }}
                      onOpen={() => {
                        if (action.type !== 'question') return
                        onOpenQuestion({
                          id: null,
                          label: action.label,
                          description: null,
                          query: action.query,
                          visualization: action.visualization,
                        })
                      }}
                      onUndo={() => {
                        if (state.status !== 'done') return
                        // An undo that fails leaves the card as it was: applied, undoable.
                        run(() =>
                          undo(state).then(
                            // A question taken off may be put back.
                            (next): CardState =>
                              action.type === 'question' ? { status: 'idle' } : next,
                            (e: unknown) => ({
                              ...state,
                              failure:
                                e instanceof Error && !('code' in e) ? e.message : messageFor(e),
                            }),
                          ),
                        )
                      }}
                    />
                  )
                })}
                {turn.answer.dropped.length > 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    {$t('Écarté : {dropped}.', { dropped: turn.answer.dropped.join(' · ') })}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="shrink-0 space-y-2 border-t p-3">
        <div className="flex items-start gap-2 text-xs">
          <Checkbox
            id="dashboard-copilot-read"
            checked={conversation.readData}
            onCheckedChange={(next) => update((c) => ({ ...c, readData: next === true }))}
            disabled={busy}
            className="mt-px"
          />
          <label
            htmlFor="dashboard-copilot-read"
            className="cursor-pointer leading-snug text-muted-foreground"
          >
            <span className="text-foreground">{$t('Autoriser la lecture des données')}</span>{' '}
            {$t(
              'pour cette conversation : le Copilot peut lire les résultats des cartes et les lignes que vous voyez (50 au plus par lecture) et les envoyer au fournisseur d’IA pour les commenter.',
            )}
          </label>
        </div>
        {!conversation.readData && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="size-3" />
            {$t('Seuls votre demande, la structure de la base et celle des tableaux sont envoyés.')}
          </p>
        )}
        <div className="relative">
          <Textarea
            ref={input}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(prompt)
              }
            }}
            rows={3}
            placeholder={$t(
              'Le chiffre d’affaires par mois, ajoute un filtre par client, pourquoi août baisse…',
            )}
            className="resize-none pr-11 text-sm"
          />
          <Button
            size="icon-sm"
            className="absolute right-2 bottom-2"
            onClick={() => void send(prompt)}
            disabled={busy || prompt.trim() === ''}
            aria-label={$t('Envoyer')}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </div>
    </ResizablePanel>
  )
}

/** The copilot's turn as the next question carries it: its answer, and what became of it. */
function recap(turn: Turn): string {
  const answer = turn.answer
  if (answer === null) return ''
  const lines = answer.actions.map((action, i) => {
    const state = turn.cards[i]
    const outcome =
      state?.status === 'done'
        ? $t('appliquée')
        : state?.status === 'error'
          ? $t('échouée')
          : $t('en attente')
    return `- ${describe(action)} (${outcome})`
  })
  return [
    answer.message,
    ...(lines.length > 0 ? ['Propositions :', ...lines] : []),
    ...(answer.dropped.length > 0
      ? [$t('Écarté par basedb : {dropped}', { dropped: answer.dropped.join(' ; ') })]
      : []),
  ].join('\n')
}

function describe(action: DashboardCopilotAction): string {
  switch (action.type) {
    case 'question':
      return $t('question « {label} » ({vizLabels})', {
        label: action.label,
        vizLabels: VIZ_LABELS[action.visualization.type],
      })
    case 'dashboard':
      return `${action.target === 'new' ? $t('nouveau tableau') : $t('modification du tableau')} « ${action.label} » : ${action.changes.map((c) => c.text).join(' ; ')}`
    case 'set_filters':
      return `filtres : ${action.changes.join(' ; ')}`
  }
}

const CHANGE_ICONS: Readonly<Record<DashboardChange['kind'], typeof Plus>> = {
  add_card: Plus,
  add_text: Type,
  update_card: Pencil,
  remove_card: Trash2,
  add_filter: ListFilter,
  add_tab: Heading,
  rename: Pencil,
}

function ActionCard({
  action,
  base,
  dashboard,
  builds,
  state,
  onApply,
  onOpen,
  onUndo,
}: {
  readonly action: DashboardCopilotAction
  readonly base: DescribedBase
  readonly dashboard: Dashboard | null
  readonly builds: boolean
  readonly state: CardState
  readonly onApply: () => void
  readonly onOpen: () => void
  readonly onUndo: () => void
}) {
  const done = state.status === 'done'
  const header = (icon: ReactNode, title: string) => (
    <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium">
      {icon}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </p>
  )
  const footer = (button: ReactNode) => (
    <>
      {state.status === 'error' && <p className="text-xs text-destructive">{state.note}</p>}
      {state.status === 'done' && state.failure !== undefined && (
        <p className="text-xs text-destructive">{state.failure}</p>
      )}
      {done ? (
        <div className="flex items-center gap-2">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="size-3.5 shrink-0" />
            {state.note}
          </p>
          {state.undo !== undefined && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onUndo}>
              <Undo2 className="size-3.5" />
              {$t('Annuler')}
            </Button>
          )}
        </div>
      ) : (
        button
      )}
    </>
  )
  const busy = state.status === 'busy'

  if (action.type === 'question') {
    const Icon = VIZ_ICONS[action.visualization.type]
    return (
      <div className={cn('rounded-lg border bg-background', done && 'border-emerald-500/40')}>
        {header(<Icon className="size-3.5 text-muted-foreground" />, action.label)}
        <div className="space-y-2 px-3 py-2">
          <QuestionPreview base={base} action={action} />
          {footer(
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={onOpen}>
                <Compass className="size-3.5" />
                {$t('Ouvrir')}
              </Button>
              {builds && dashboard !== null && (
                <Button size="sm" className="flex-1" disabled={busy} onClick={onApply}>
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  {$t('Ajouter au tableau')}
                </Button>
              )}
            </div>,
          )}
        </div>
      </div>
    )
  }

  if (action.type === 'set_filters') {
    return (
      <div className={cn('rounded-lg border bg-background', done && 'border-emerald-500/40')}>
        {header(
          <ListFilter className="size-3.5 text-muted-foreground" />,
          $t('Régler les filtres'),
        )}
        <div className="space-y-2 px-3 py-2">
          <ul className="space-y-1 text-xs">
            {Object.entries(action.values).map(([id, value]) => {
              const parameter = dashboard?.parameters.find((p) => p.id === id)
              return (
                <li key={id} className="flex gap-1.5">
                  <span className="text-muted-foreground">{parameter?.label ?? id} :</span>
                  <span className="min-w-0 truncate font-medium">
                    {parameter === undefined
                      ? String(value)
                      : (describeValue(parameter, value) ?? $t('effacé'))}
                  </span>
                </li>
              )
            })}
          </ul>
          {footer(
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={busy || dashboard === null}
              onClick={onApply}
            >
              {$t('Appliquer les filtres')}
            </Button>,
          )}
        </div>
      </div>
    )
  }

  const title =
    action.target === 'new'
      ? $t('Nouveau tableau « {label} »', { label: action.label })
      : $t('Modifier « {label} »', { label: action.label })
  return (
    <div className={cn('rounded-lg border bg-background', done && 'border-emerald-500/40')}>
      {header(<LayoutDashboard className="size-3.5 text-muted-foreground" />, title)}
      <div className="space-y-2 px-3 py-2">
        <ul className="space-y-1">
          {action.changes.map((change, i) => {
            const Icon = CHANGE_ICONS[change.kind]
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
              <li key={i} className="flex items-start gap-1.5 text-xs">
                <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0">{change.text}</span>
              </li>
            )
          })}
        </ul>
        {footer(
          builds ? (
            <Button size="sm" className="w-full" disabled={busy} onClick={onApply}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {action.target === 'new' ? $t('Créer le tableau') : $t('Appliquer')}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {$t('Modifier les tableaux de bord demande de gérer la base.')}
            </p>
          ),
        )}
      </div>
    </div>
  )
}

/** The question, drawn: run with the reader's rights, as any question. */
function QuestionPreview({
  base,
  action,
}: {
  readonly base: DescribedBase
  readonly action: Extract<DashboardCopilotAction, { type: 'question' }>
}) {
  const [state, setState] = useState<{ result: QueryResult | null; error: string | null }>({
    result: null,
    error: null,
  })
  const key = JSON.stringify(action.query)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says what is read
  useEffect(() => {
    const controller = new AbortController()
    api.runQuestion(base.name, { query: action.query }, controller.signal).then(
      (result) => !controller.signal.aborted && setState({ result, error: null }),
      (e) => !controller.signal.aborted && setState({ result: null, error: messageFor(e) }),
    )
    return () => controller.abort()
  }, [base.name, key])
  const compact = ['scalar', 'trend', 'progress'].includes(action.visualization.type)
  return (
    <div className={cn('overflow-hidden rounded-md border', compact ? 'h-28' : 'h-52')}>
      {state.error !== null ? (
        <p className="p-2 text-xs text-destructive">{state.error}</p>
      ) : state.result === null ? (
        <div className="flex size-full items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className={cn('size-full', action.visualization.type !== 'table' && 'p-2')}>
          <VisualizationView
            result={state.result}
            visualization={action.visualization}
            base={base}
            dense
            sorted={
              action.query.kind === 'sql' ||
              (action.query.kind === 'builder' && (action.query.sort ?? []).length > 0)
            }
          />
        </div>
      )}
    </div>
  )
}
