'use client'

import { ApiError, type Write, api, onWrite } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { reasonFor } from '@/lib/messages'
import { toast } from 'sonner'
import { create } from 'zustand'

/**
 * The undo journal — chapter 16 §4, on screen.
 *
 * Every data write names its transaction; the journal stacks them, one step per gesture —
 * a pasted range, a batch of deletions, an import are ONE step however many writes they
 * took. Ctrl+Z asks the server to undo the last step's transactions, newest first; the
 * undo is itself a write, whose transactions make the step Ctrl+Shift+Z redoes. Fifty
 * steps, for this tab only.
 */

export interface Step {
  readonly label: string
  readonly transactions: readonly string[]
}

interface Journal {
  readonly done: readonly Step[]
  readonly undone: readonly Step[]
  readonly busy: boolean
}

export const JOURNAL_LIMIT = 50

export const useJournal = create<Journal>(() => ({ done: [], undone: [], busy: false }))

/** What a field is called on screen: set by the screen that knows the table. */
let labelOf: (name: string) => string = (name) => name
/** What the screen does once an undo or a redo has landed: read again. */
let applied: () => void = () => {}

export function configureJournal(options: {
  readonly labelOf: (name: string) => string
  readonly applied: () => void
}): void {
  labelOf = options.labelOf
  applied = options.applied
}

/** The gesture a write was, in words. */
export function describeWrite(write: Write, label: (name: string) => string = labelOf): string {
  if (write.method === 'DELETE') return $t('suppression d’une ligne')
  if (write.path.endsWith('/batch')) return $t('import de lignes')
  if (write.method === 'POST') return $t('création d’une ligne')
  try {
    const values = (JSON.parse(write.body ?? '{}') as { values?: Record<string, unknown> }).values
    const names = Object.keys(values ?? {})
    if (names.length === 1)
      return $t('modification de « {names} »', { names: label(names[0] as string) })
  } catch {
    // An unreadable body is still a modification.
  }
  return $t('modification d’une ligne')
}

/** The gesture under way, when several writes are one step. */
let gathering: { label: string; transactions: string[] } | null = null

function push(step: Step): void {
  useJournal.setState((j) => ({
    done: [...j.done, step].slice(-JOURNAL_LIMIT),
    // A new gesture forgets what could have been redone, as in any editor.
    undone: [],
  }))
}

/** Starts hearing the writes; returns the stop. One journal per tab. */
export function startJournal(): () => void {
  onWrite((write) => {
    if (gathering !== null) {
      gathering.transactions.push(write.transaction)
      return
    }
    push({ label: describeWrite(write), transactions: [write.transaction] })
  })
  return () => onWrite(null)
}

/** Runs `work` as ONE step — its writes are undone together. */
export async function asOneStep<T>(label: string, work: () => Promise<T>): Promise<T> {
  if (gathering !== null) return work()
  const mine = { label, transactions: [] as string[] }
  gathering = mine
  try {
    return await work()
  } finally {
    gathering = null
    if (mine.transactions.length > 0) push({ label, transactions: mine.transactions })
  }
}

/** Why an undo was refused, in a sentence. */
function refusal(error: unknown): string {
  if (error instanceof ApiError && error.code === 'REVISION_SUPERSEDED') {
    const fields = Array.isArray(error.details.fields) ? (error.details.fields as string[]) : []
    const names = fields.map((f) => `« ${labelOf(f)} »`)
    if (names.length === 1) return $t('{names} a été modifié depuis.', { names: names[0] })
    if (names.length > 1) return $t('{names} ont été modifiés depuis.', { names: names.join(', ') })
    return $t('La ligne a été modifiée depuis.')
  }
  if (error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND') {
    return $t('Cette écriture est introuvable ou trop ancienne.')
  }
  return reasonFor(error)
}

async function replay(from: 'done' | 'undone'): Promise<void> {
  const state = useJournal.getState()
  const stack = state[from]
  const step = stack[stack.length - 1]
  if (step === undefined || state.busy) return
  useJournal.setState({ busy: true })
  const counter: string[] = []
  try {
    for (const transaction of [...step.transactions].reverse()) {
      counter.push((await api.undoTransaction(transaction)).transaction)
    }
    const inverse: Step = { label: step.label, transactions: counter }
    useJournal.setState((j) =>
      from === 'done'
        ? { done: j.done.slice(0, -1), undone: [...j.undone, inverse] }
        : { undone: j.undone.slice(0, -1), done: [...j.done, inverse].slice(-JOURNAL_LIMIT) },
    )
    const verb = from === 'done' ? $t('Annulé') : $t('Rétabli')
    toast(`${verb} : ${step.label}`, {
      action:
        from === 'done'
          ? { label: $t('Rétablir||refaire une écriture annulée'), onClick: () => void redo() }
          : { label: $t('Annuler||défaire la dernière écriture'), onClick: () => void undo() },
    })
  } catch (error) {
    // The step is dropped: it cannot be replayed as it stands. What did go through is
    // itself a step, the other way.
    useJournal.setState((j) => {
      const rest = { [from]: j[from].slice(0, -1) } as Partial<Journal>
      if (counter.length === 0) return rest
      const partial: Step = { label: step.label, transactions: counter }
      return from === 'done'
        ? { ...rest, undone: [...j.undone, partial] }
        : { ...rest, done: [...j.done, partial] }
    })
    toast.error(
      from === 'done'
        ? $t('Annulation impossible : {reason}', { reason: refusal(error) })
        : $t('Rétablissement impossible : {reason}', { reason: refusal(error) }),
    )
  } finally {
    useJournal.setState({ busy: false })
    applied()
  }
}

export const undo = () => replay('done')
export const redo = () => replay('undone')

/** Whether a key press is the journal's — never inside something being typed. */
export function journalKey(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const target = event.target as HTMLElement | null
  if (
    target !== null &&
    (target.isContentEditable ||
      target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') !== null)
  ) {
    return null
  }
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !event.shiftKey) return 'redo'
  return null
}
