'use client'

import { FieldIcon, KIND_LABELS } from '@/components/app/field-icon'
import { ResizablePanel } from '@/components/app/resizable-panel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import {
  type CopilotAction,
  type CopilotAnswer,
  type CopilotField,
  type CopilotMessage,
  type DescribedBase,
  type Table,
  api,
} from '@/lib/api/client'
import { addFields, createTable, insertRecords, updateRecords } from '@/lib/copilot'
import { $t, $tp } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  ArrowUp,
  Check,
  ChevronRight,
  Columns3,
  Database,
  Eye,
  Filter,
  Loader2,
  Pencil,
  type Plus,
  RotateCcw,
  Rows3,
  Shield,
  Sparkles,
  Table2,
  Terminal,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * The copilot — chapter 12 §1.6.
 *
 * A conversation about the base on screen. The person asks in their words; the answer is
 * a few sentences and, under them, CARDS: a filter, a query, columns, a table, rows to
 * insert or to change. A card changes nothing until its button is pressed, and then goes
 * through the same routes as the forms — the copilot proposes, the person applies.
 *
 * By default only the structure leaves the instance. The box under the conversation lets
 * the copilot READ rows for this conversation — to count, to sum, to answer « lesquelles » —
 * and every read it makes is listed under its answer: what it read is what left.
 */

interface Props {
  readonly base: DescribedBase
  readonly table: Table | null
  readonly view: { readonly filter: string; readonly sort: string | null }
  readonly onClose: () => void
  /** Filters a table's view — the open tab, or the table opened for it. */
  readonly onApplyFilter: (table: string, filter: string, sort: string | null) => void
  /** Opens a query in a new console tab. It runs when the person runs it. */
  readonly onOpenSql: (sql: string) => void
  /** Rereads the base and its rows once a card changed them. */
  readonly onChanged: () => Promise<void>
}

type CardState =
  | { readonly status: 'idle' }
  | { readonly status: 'busy' }
  | { readonly status: 'done'; readonly note: string }
  | { readonly status: 'error'; readonly note: string }

interface Turn {
  readonly id: number
  readonly question: string
  readonly answer: CopilotAnswer | null
  readonly error: string | null
  readonly cards: readonly CardState[]
}

interface Conversation {
  readonly turns: readonly Turn[]
  readonly readData: boolean
  /** Tables created from a card of this conversation, by label: the rows proposed wait for them. */
  readonly created: ReadonlyMap<string, string>
}

const EMPTY: Conversation = { turns: [], readData: false, created: new Map() }

/** Kept while the page lives, per base: closing the panel does not end the conversation. */
const conversations = new Map<string, Conversation>()

let sequence = 0

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

const SUGGESTIONS: ReadonlyArray<{ readonly icon: typeof Plus; readonly text: string }> = [
  { icon: Filter, text: $t('Montre-moi les lignes modifiées cette semaine') },
  { icon: Columns3, text: $t('Ajoute les colonnes utiles pour suivre cette table') },
  { icon: Rows3, text: $t('Génère 20 lignes d’exemple réalistes') },
  { icon: Table2, text: $t('Crée une table liée à celle-ci, avec un jeu d’essai') },
  { icon: Database, text: $t('Combien de lignes par statut ?') },
]

export function CopilotPanel({
  base,
  table,
  view,
  onClose,
  onApplyFilter,
  onOpenSql,
  onChanged,
}: Props) {
  const [conversation, setConversation] = useState<Conversation>(
    () => conversations.get(base.name) ?? EMPTY,
  )
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  // Another base, another conversation.
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

  // The latest message in view, as a conversation reads.
  const turnCount = conversation.turns.length
  const lastAnswered = conversation.turns.at(-1)?.answer !== null
  useEffect(() => {
    void turnCount
    void lastAnswered
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turnCount, lastAnswered])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (question === '' || busy) return
      const id = ++sequence
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
        const answer = await api.copilot(base.name, {
          table: table?.name ?? null,
          filter: view.filter.trim() === '' ? null : view.filter,
          sort: view.sort,
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
    },
    [busy, conversation, update, base.name, table, view],
  )

  // A question put from the command palette: sent as if typed here, once the panel is free.
  const asked = useWorkspace((s) => s.copilotAsk)
  useEffect(() => {
    if (asked === null || busy) return
    // Taken from the store, not from this render: an effect run twice sends it once.
    const store = useWorkspace.getState()
    if (store.copilotAsk?.seq !== asked.seq) return
    store.clearCopilotAsk()
    void send(asked.text)
  }, [asked, busy, send])

  const setCard = useCallback(
    (turnId: number, index: number, state: CardState) =>
      update((c) => ({
        ...c,
        turns: c.turns.map((t) =>
          t.id === turnId ? { ...t, cards: t.cards.map((s, i) => (i === index ? state : s)) } : t,
        ),
      })),
    [update],
  )

  const apply = useCallback(
    async (turnId: number, index: number, action: CopilotAction, extra: ApplyExtra) => {
      setCard(turnId, index, { status: 'busy' })
      try {
        const note = await run(action, extra)
        setCard(turnId, index, { status: 'done', note })
      } catch (e) {
        setCard(turnId, index, {
          status: 'error',
          note: e instanceof Error && !('code' in e) ? e.message : messageFor(e),
        })
      }
    },
    [setCard],
  )

  /** What applying a card does — the ordinary routes, one after the other. */
  const run = async (action: CopilotAction, extra: ApplyExtra): Promise<string> => {
    const options = { aiConsent: extra.aiConsent, created: conversation.created }
    switch (action.type) {
      case 'filter':
        onApplyFilter(action.table, action.filter, action.sort)
        return $t('Filtre appliqué.')
      case 'sql':
        onOpenSql(action.sql)
        return $t('Ouverte dans la console.')
      case 'add_fields': {
        const fields = action.fields.filter((_, i) => extra.selected?.[i] !== false)
        await addFields({ base: base.name, name: action.table }, fields, options)
        await onChanged()
        return $tp(fields.length, '{count} colonne ajoutée.', '{count} colonnes ajoutées.')
      }
      case 'create_table': {
        const name = await createTable(base.name, action, options)
        update((c) => ({ ...c, created: new Map([...c.created, [fold(action.label), name]]) }))
        await onChanged()
        return $t('Table créée.')
      }
      case 'insert_records': {
        const fresh = await api.describeBase(base.name)
        const created = await insertRecords(fresh, action, conversation.created)
        await onChanged()
        return $tp(created, '{count} ligne insérée.', '{count} lignes insérées.')
      }
      case 'update_records': {
        const done = await updateRecords(base, action)
        await onChanged()
        return $tp(done, '{count} ligne modifiée.', '{count} lignes modifiées.')
      }
    }
  }

  const restart = () => {
    conversations.delete(base.name)
    setConversation(EMPTY)
    setPrompt('')
    input.current?.focus()
  }

  return (
    <ResizablePanel panel="copilot" label={$t('le Copilot')} className="bg-sidebar">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Sparkles className="size-4 text-primary" />
        <span className="flex-1 truncate text-sm font-medium">
          {$t('Copilot')} <span className="font-normal text-muted-foreground">· {base.label}</span>
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
                'Demandez un filtre, une requête, des colonnes, une table, des lignes d’exemple…',
              )}
              {table !== null && (
                <>
                  {' '}
                  {$t('Sur')} <span className="text-foreground">{table.label}</span>{' '}
                  {$t('par défaut.')}
                </>
              )}{' '}
              {$t('Chaque proposition s’applique d’un clic, et rien ne change sans vous.')}
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => void send(s.text)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted"
                >
                  <s.icon className="size-3.5 shrink-0 text-muted-foreground" />
                  {s.text}
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
                  ? $t('Réflexion, lecture des données au besoin…')
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
                {turn.answer.actions.map((action, index) => (
                  <ActionCard
                    // biome-ignore lint/suspicious/noArrayIndexKey: the cards of an answer never move
                    key={index}
                    action={action}
                    base={base}
                    state={turn.cards[index] ?? { status: 'idle' }}
                    onApply={(extra) => void apply(turn.id, index, action, extra)}
                  />
                ))}
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
            id="copilot-read"
            checked={conversation.readData}
            onCheckedChange={(next) => update((c) => ({ ...c, readData: next === true }))}
            disabled={busy}
            className="mt-px"
          />
          <label
            htmlFor="copilot-read"
            className="cursor-pointer leading-snug text-muted-foreground"
          >
            <span className="text-foreground">{$t('Autoriser la lecture des données')}</span>{' '}
            {$t(
              'pour cette conversation : le Copilot peut lire des lignes que vous voyez (50 au plus par lecture) et les envoyer au fournisseur d’IA pour répondre.',
            )}
          </label>
        </div>
        {!conversation.readData && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="size-3" />
            {$t('Seuls votre demande et la structure de la base sont envoyés.')}
          </p>
        )}
        <div className="relative">
          <Textarea
            ref={input}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Maj+Entrée goes to the next line — the convention of every
              // chat box, and the one people's fingers already know.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(prompt)
              }
            }}
            rows={3}
            placeholder={$t(
              'Ajoute une colonne priorité, génère 30 visites, combien de visites urgentes…',
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

/**
 * The copilot's turn as the next question carries it: its answer, and what became of its
 * proposals — so « insère-les » or « encore 20 » refer to something.
 */
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
    // What basedb set aside, so that « et la liste ? » is answered by a corrected proposal.
    ...(answer.dropped.length > 0
      ? [$t('Écarté par basedb : {dropped}', { dropped: answer.dropped.join(' ; ') })]
      : []),
  ].join('\n')
}

function describe(action: CopilotAction): string {
  switch (action.type) {
    case 'filter':
      return $t('filtre sur {table} : {filter}', { table: action.table, filter: action.filter })
    case 'sql':
      return $t('requête SQL : {sql}', { sql: action.sql })
    case 'add_fields':
      return $t('colonnes pour {table} : {map}', {
        table: action.table,
        map: action.fields.map((f) => f.label).join(', '),
      })
    case 'create_table':
      return `table ${action.label} (${action.fields.map((f) => f.label).join(', ')})`
    case 'insert_records':
      return $t('{recordsCount} lignes pour {table}', {
        recordsCount: action.records.length,
        table: action.table,
      })
    case 'update_records':
      return $t('{updatesCount} modifications dans {table}', {
        updatesCount: action.updates.length,
        table: action.table,
      })
  }
}

/** What was read to answer: shown folded, because it is what left the instance. */
export function Reads({
  reads,
}: {
  readonly reads: ReadonlyArray<Pick<CopilotAnswer['reads'][number], 'text' | 'rows' | 'error'>>
}) {
  const [open, setOpen] = useState(false)
  const rows = reads.reduce((n, r) => n + r.rows, 0)
  return (
    <div className="rounded-lg border bg-background/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-muted-foreground"
      >
        <Eye className="size-3.5" />
        {$tp(reads.length, '{count} lecture', '{count} lectures')} ·{' '}
        {$tp(
          rows,
          '{count} ligne envoyée au fournisseur',
          '{count} lignes envoyées au fournisseur',
        )}
        <ChevronRight
          className={cn('ml-auto size-3.5 transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && (
        <ul className="space-y-1.5 border-t px-2.5 py-2">
          {reads.map((read, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
            <li key={i}>
              <code className="block whitespace-pre-wrap break-words font-mono text-[11px]">
                {read.text}
              </code>
              <span
                className={cn(
                  'text-[11px]',
                  read.error === null ? 'text-muted-foreground' : 'text-destructive',
                )}
              >
                {read.error ?? $tp(read.rows, '{count} ligne', '{count} lignes')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface ApplyExtra {
  /** For `add_fields`: which of the proposed columns are kept. */
  readonly selected?: readonly boolean[]
  /** For an AI column: the person's yes to the cited values leaving. */
  readonly aiConsent: boolean
}

const ICON: Readonly<Record<CopilotAction['type'], typeof Plus>> = {
  filter: Filter,
  sql: Terminal,
  add_fields: Columns3,
  create_table: Table2,
  insert_records: Rows3,
  update_records: Pencil,
}

function ActionCard({
  action,
  base,
  state,
  onApply,
}: {
  readonly action: CopilotAction
  readonly base: DescribedBase
  readonly state: CardState
  readonly onApply: (extra: ApplyExtra) => void
}) {
  const fields = action.type === 'add_fields' || action.type === 'create_table' ? action.fields : []
  const [selected, setSelected] = useState<boolean[]>(() => fields.map(() => true))
  const [aiConsent, setAiConsent] = useState(false)
  const Icon = ICON[action.type]
  const labelOf = (name: string) => base.tables.find((t) => t.name === name)?.label ?? name
  const hasAi = fields.some((f, i) => f.prompt !== null && selected[i] !== false)
  const done = state.status === 'done'
  const ready =
    state.status !== 'busy' &&
    !done &&
    (!hasAi || aiConsent) &&
    (action.type !== 'add_fields' || selected.some(Boolean))

  const [title, button] = (() => {
    switch (action.type) {
      case 'filter':
        return [$t('Filtrer {table}', { table: labelOf(action.table) }), $t('Appliquer le filtre')]
      case 'sql':
        return [$t('Requête SQL'), $t('Ouvrir dans la console')]
      case 'add_fields':
        return [
          $tp(
            action.fields.length,
            '{count} colonne pour {table}',
            '{count} colonnes pour {table}',
            {
              table: labelOf(action.table),
            },
          ),
          $t('Ajouter'),
        ]
      case 'create_table':
        return [$t('Nouvelle table « {label} »', { label: action.label }), $t('Créer la table')]
      case 'insert_records':
        return [
          $tp(action.records.length, '{count} ligne pour {table}', '{count} lignes pour {table}', {
            table: action.pending ? action.table : labelOf(action.table),
          }),
          $tp(action.records.length, 'Insérer {count} ligne', 'Insérer {count} lignes'),
        ]
      case 'update_records':
        return [
          $tp(
            action.updates.length,
            '{count} modification dans {table}',
            '{count} modifications dans {table}',
            { table: labelOf(action.table) },
          ),
          $t('Appliquer les modifications'),
        ]
    }
  })()

  return (
    <div className={cn('rounded-lg border bg-background', done && 'border-emerald-500/40')}>
      <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </p>

      <div className="space-y-2 px-3 py-2">
        {action.type === 'filter' && (
          <Code>
            {action.filter === '' ? $t('(aucun filtre)') : action.filter}
            {action.sort !== null && `\ntri : ${action.sort}`}
          </Code>
        )}
        {action.type === 'sql' && <Code>{action.sql}</Code>}

        {(action.type === 'add_fields' || action.type === 'create_table') && (
          <FieldList
            fields={fields}
            selectable={action.type === 'add_fields' && !done}
            selected={selected}
            onToggle={(i) => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))}
            labelOf={labelOf}
          />
        )}

        {action.type === 'insert_records' && (
          <RowsPreview
            rows={action.records}
            base={base}
            table={action.pending ? null : action.table}
          />
        )}
        {action.type === 'update_records' && (
          <RowsPreview
            rows={action.updates.map((u) => ({ _id: u.id.slice(0, 8), ...u.values }))}
            base={base}
            table={action.table}
          />
        )}

        {hasAi && !done && (
          <div className="flex items-start gap-2 text-[11px]">
            <Checkbox
              id={`copilot-ai-${title}`}
              checked={aiConsent}
              onCheckedChange={(next) => setAiConsent(next === true)}
              className="mt-px"
            />
            <label
              htmlFor={`copilot-ai-${title}`}
              className="cursor-pointer leading-snug text-muted-foreground"
            >
              {$t(
                'J’accepte que les valeurs citées par la colonne IA soient envoyées au fournisseur, ligne par ligne.',
              )}
            </label>
          </div>
        )}

        {state.status === 'error' && <p className="text-xs text-destructive">{state.note}</p>}

        {done ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="size-3.5" />
            {state.note}
          </p>
        ) : (
          <Button
            size="sm"
            variant={action.type === 'filter' || action.type === 'sql' ? 'outline' : 'default'}
            className="w-full"
            disabled={!ready}
            onClick={() => onApply({ selected, aiConsent })}
          >
            {state.status === 'busy' && <Loader2 className="size-3.5 animate-spin" />}
            {button}
          </Button>
        )}
      </div>
    </div>
  )
}

function Code({ children }: { readonly children: React.ReactNode }) {
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-relaxed">
      {children}
    </pre>
  )
}

function FieldList({
  fields,
  selectable,
  selected,
  onToggle,
  labelOf,
}: {
  readonly fields: readonly CopilotField[]
  readonly selectable: boolean
  readonly selected: readonly boolean[]
  readonly onToggle: (index: number) => void
  readonly labelOf: (name: string) => string
}) {
  return (
    <ul className="space-y-1.5">
      {fields.map((field, i) => (
        <li
          key={field.label}
          className={cn(
            'flex items-start gap-2 text-xs',
            // Set aside by the person: still listed, so the card says what was left out.
            !selectable && selected[i] === false && 'line-through opacity-50',
          )}
        >
          {selectable && (
            <Checkbox
              checked={selected[i] !== false}
              onCheckedChange={() => onToggle(i)}
              aria-label={$t('Garder {label}', { label: field.label })}
              className="mt-px"
            />
          )}
          <FieldIcon kind={field.kind} className="mt-px" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{field.label}</span>{' '}
            <span className="text-muted-foreground">
              {KIND_LABELS[field.kind] ?? field.kind}
              {field.target !== null && ` → ${labelOf(field.target)}`}
            </span>
            {field.options.length > 0 && (
              <span className="block truncate text-[11px] text-muted-foreground">
                {field.options.join(' · ')}
              </span>
            )}
            {field.prompt !== null && (
              <span className="block text-[11px] italic text-muted-foreground">{field.prompt}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The first rows, as a small table: enough to judge the proposal before applying it. */
function RowsPreview({
  rows,
  base,
  table,
}: {
  readonly rows: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly base: DescribedBase
  readonly table: string | null
}) {
  const columns = useMemo(() => [...new Set(rows.flatMap((r) => Object.keys(r)))], [rows])
  const known = base.tables.find((t) => t.name === table)
  const header = (key: string) => known?.fields.find((f) => f.name === key)?.label ?? key
  const shown = rows.slice(0, 5)
  const text = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (Array.isArray(value)) return value.map(text).join(', ')
    if (typeof value === 'object') {
      const o = value as Record<string, unknown>
      return String(o.display ?? o.id ?? JSON.stringify(o))
    }
    const option = known?.fields.flatMap((f) => f.options ?? []).find((o) => o.value === value)
    return option?.label ?? String(value)
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-[11px]">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-2 py-1 text-left font-medium">
                {header(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a preview, never reordered
            <tr key={i} className="border-t">
              {columns.map((c) => (
                <td key={c} className="max-w-40 truncate px-2 py-1" title={text(row[c])}>
                  {text(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <p className="border-t px-2 py-1 text-[11px] text-muted-foreground">
          {$tp(rows.length - shown.length, '… et {count} autre', '… et {count} autres')}
        </p>
      )}
    </div>
  )
}
