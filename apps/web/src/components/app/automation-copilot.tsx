'use client'

import { Reads } from '@/components/app/copilot-panel'
import { ResizablePanel } from '@/components/app/resizable-panel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import {
  type AutomationCopilotAction,
  type AutomationCopilotAnswer,
  type AutomationDefinition,
  type AutomationInput,
  type CopilotMessage,
  type DescribedBase,
  api,
} from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  ArrowUp,
  Check,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Undo2,
  Workflow,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The copilot of the automations — chapter 17 §6, on screen.
 *
 * A conversation about the automations of the base, beside them. The person asks in their
 * words; the answer is a few sentences and CARDS, each an automation proposed whole — the
 * one on screen changed, or a new one — with what it changes, line by line. A card
 * changes nothing until its button is pressed, and even then saves nothing: it lays the
 * proposal on the flow of the editor, where the person reads it, gives the consent its AI
 * steps ask for, and saves — or undoes it from the card.
 *
 * By default only the structure leaves the instance. The box under the conversation lets
 * the copilot read rows, for the conversation.
 */

/** What the panel asks of the editor on screen. */
export interface FlowBridge {
  /** The automation on screen — its identifier once saved, and what its editor shows. */
  readonly current: () => {
    readonly id: string | null
    readonly label: string
    readonly input: AutomationInput
  } | null
  /** Lays a definition on the flow on screen; gives back how to undo it, or `null`. */
  readonly lay: (definition: AutomationDefinition) => (() => boolean) | null
  /** Opens a new automation with this definition on its flow. */
  readonly open: (definition: AutomationDefinition) => void
}

type CardState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'done'
      readonly note: string
      readonly undo?: () => boolean
      /** An undo refused: the flow changed since. */
      readonly failure?: string
    }
  | { readonly status: 'error'; readonly note: string }

interface Turn {
  readonly id: number
  readonly question: string
  readonly answer: AutomationCopilotAnswer | null
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

export function AutomationCopilot({
  base,
  bridge,
  onScreen,
  onClose,
}: {
  readonly base: DescribedBase
  readonly bridge: FlowBridge
  /** The label of the automation on screen, for the header; `null`: none. */
  readonly onScreen: string | null
  readonly onClose: () => void
}) {
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
    const current = bridge.current()
    try {
      const answer = await api.automationCopilot(base.name, {
        automation: current?.id ?? null,
        draft: current?.input ?? null,
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

  const apply = (turnId: number, index: number, action: AutomationCopilotAction) => {
    if (action.target === 'new') {
      bridge.open(action.definition)
      setCard(turnId, index, {
        status: 'done',
        note: $t('Ouverte dans l’éditeur : relisez-la, puis créez-la.'),
      })
      return
    }
    const undo = bridge.lay(action.definition)
    if (undo === null) {
      setCard(turnId, index, {
        status: 'error',
        note: $t('Ouvrez l’automatisation que cette proposition modifie.'),
      })
      return
    }
    setCard(turnId, index, {
      status: 'done',
      note: $t('Posée sur le flux : relisez-la, puis enregistrez.'),
      undo,
    })
  }

  const revert = (turnId: number, index: number, state: Extract<CardState, { status: 'done' }>) => {
    if (state.undo === undefined) return
    if (state.undo()) setCard(turnId, index, { status: 'idle' })
    else {
      setCard(turnId, index, {
        ...state,
        failure: $t('Le flux a changé depuis : l’annulation effacerait ces changements.'),
      })
    }
  }

  const restart = () => {
    conversations.delete(base.name)
    setConversation(EMPTY)
    setPrompt('')
    input.current?.focus()
  }

  const suggestions =
    onScreen === null
      ? [
          $t('Quelles automatisations seraient utiles pour cette base ?'),
          $t('Chaque lundi matin, préviens-moi de ce qui est en retard'),
          $t('Quand une ligne est créée, fais-la résumer par l’IA'),
        ]
      : [
          $t('Explique ce que fait cette automatisation'),
          $t('Pourquoi sa dernière exécution a-t-elle échoué ?'),
          $t('Ajoute une étape qui prévient la bonne personne'),
          $t('Simplifie-la'),
        ]

  return (
    <ResizablePanel panel="copilot" label={$t('le Copilot')} className="bg-sidebar">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Sparkles className="size-4 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">
          {$t('Copilot')}{' '}
          <span className="font-normal text-muted-foreground">
            · {onScreen ?? $t('Automatisations')}
          </span>
        </span>
        {conversation.turns.length > 0 && (
          <Hint label={$t('Nouvelle conversation')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={restart}
              disabled={busy}
              aria-label={$t('Nouvelle conversation')}
            >
              <RotateCcw className="size-4" />
            </Button>
          </Hint>
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
                'Décrivez ce que la base doit faire d’elle-même, demandez une étape, une condition, ou pourquoi une exécution a échoué.',
              )}
              {onScreen !== null && (
                <>
                  {' '}
                  {$t('Sur')} <span className="text-foreground">{onScreen}</span>{' '}
                  {$t('par défaut.')}
                </>
              )}{' '}
              {$t('Chaque proposition se pose sur le flux, et rien n’est enregistré sans vous.')}
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
                  ? $t('Réflexion, lecture des lignes au besoin…')
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
                  return (
                    <ProposalCard
                      // biome-ignore lint/suspicious/noArrayIndexKey: the cards of an answer never move
                      key={index}
                      action={action}
                      state={state}
                      onApply={() => apply(turn.id, index, action)}
                      onUndo={() => state.status === 'done' && revert(turn.id, index, state)}
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
            id="automation-copilot-read"
            checked={conversation.readData}
            onCheckedChange={(next) => update((c) => ({ ...c, readData: next === true }))}
            disabled={busy}
            className="mt-px"
          />
          <label
            htmlFor="automation-copilot-read"
            className="cursor-pointer leading-snug text-muted-foreground"
          >
            <span className="text-foreground">{$t('Autoriser la lecture des données')}</span>{' '}
            {$t(
              'pour cette conversation : le Copilot peut lire les lignes que vous voyez (50 au plus par lecture) et les envoyer au fournisseur d’IA.',
            )}
          </label>
        </div>
        {!conversation.readData && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="size-3" />
            {$t(
              'Seuls votre demande, la structure de la base et ses automatisations sont envoyés.',
            )}
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
            placeholder={$t('Quand une facture est payée, clos le projet et préviens le client…')}
            aria-label={$t('Votre demande au Copilot')}
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
        ? $t('posée sur le flux')
        : state?.status === 'error'
          ? $t('échouée')
          : $t('en attente')
    const what = action.target === 'new' ? $t('nouvelle automatisation') : 'modification'
    return `- ${what} « ${action.definition.label} » : ${action.changes.join(' ; ')} (${outcome})`
  })
  return [
    answer.message,
    ...(lines.length > 0 ? ['Propositions :', ...lines] : []),
    ...(answer.dropped.length > 0
      ? [$t('Écarté par basedb : {dropped}', { dropped: answer.dropped.join(' ; ') })]
      : []),
  ].join('\n')
}

/** The icon a line of changes opens with. */
const iconOf = (line: string) =>
  line.startsWith('Ajoute') ? Plus : line.startsWith('Retire') ? Minus : Pencil

function ProposalCard({
  action,
  state,
  onApply,
  onUndo,
}: {
  readonly action: AutomationCopilotAction
  readonly state: CardState
  readonly onApply: () => void
  readonly onUndo: () => void
}) {
  const done = state.status === 'done'
  const title =
    action.target === 'new'
      ? $t('Nouvelle automatisation « {label} »', { label: action.definition.label })
      : $t('Modifier « {label} »', { label: action.definition.label })
  return (
    <div className={cn('rounded-lg border bg-background', done && 'border-emerald-500/40')}>
      <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium">
        <Workflow className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </p>
      <div className="space-y-2 px-3 py-2">
        <ul className="space-y-1">
          {action.changes.map((change, i) => {
            const Icon = action.target === 'new' ? Plus : iconOf(change)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
              <li key={i} className="flex items-start gap-1.5 text-xs">
                <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-words">{change}</span>
              </li>
            )
          })}
        </ul>
        {action.aiSteps > 0 && (
          <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            {$tp(
              action.aiSteps,
              'Son étape IA demande votre accord, dans ses réglages, avant l’enregistrement.',
              'Ses étapes IA demandent votre accord, dans leurs réglages, avant l’enregistrement.',
            )}
          </p>
        )}
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
          <Button size="sm" className="w-full" onClick={onApply}>
            {action.target === 'new' ? $t('Ouvrir dans l’éditeur') : $t('Poser sur le flux')}
          </Button>
        )}
      </div>
    </div>
  )
}
