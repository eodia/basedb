'use client'

import type { Row } from '@/components/app/grid/cell'
import { type Field, type TableRef, api } from '@/lib/api/client'
import { quoteLiteral } from '@/lib/expression'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles } from 'lucide-react'
import {
  type Dispatch,
  type SetStateAction,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * Waiting for the AI worker — chapter 12 §1.5.
 *
 * An AI cell is filled outside any request, by the worker's next pass: a row just added
 * shows its AI columns empty, and nothing tells the screen when they no longer are. So
 * while the page holds such cells, the screen reads THOSE rows again every few seconds
 * and fills in what came back — the AI cells and nothing else, since the person may be
 * editing the rest of the row. Meanwhile the cells say a computation is on its way.
 *
 * Not forever: when nothing has come for two minutes the worker is paused — a quota, a
 * provider down, AI switched off — and the cells go back to « en attente », which is what
 * they are. The next reload of the page starts the watch again.
 *
 * A cell is empty on a new row, and again when a person changes a column its prompt cites:
 * the kernel empties it in the same write, for the worker to compute it anew. Both reach
 * the screen the same way.
 */

/** Between two readings: the worker passes every ten seconds, and a call takes a few. */
const POLL_MS = 3_000
/** Without a single cell filled for this long, the screen stops waiting. */
const PATIENCE_MS = 120_000
/** The filter's own ceiling on a list (`BUDGETS.inElements`). */
const MAX_IDS = 200

/** True while the screen watches for the worker: the empty AI cells are being computed. */
const Waiting = createContext(false)

export const AiWaitingProvider = Waiting.Provider

/** Not computed yet: the worker fills a cell that is NULL, and only one that is. */
function isPending(row: Row, field: Field): boolean {
  return field.ai === true && Object.hasOwn(row, field.name) && row[field.name] === null
}

/** The rows with the AI cells that came back filled — only those, only where still empty. */
function fillAi(
  current: readonly Row[],
  fetched: readonly Row[],
  ai: readonly Field[],
): readonly Row[] {
  const byId = new Map(fetched.map((row) => [row._id, row]))
  let changed = false
  const next = current.map((row) => {
    const found = byId.get(row._id)
    if (found === undefined) return row
    // Any value: a number, a choice, a date are filled too, not only a text.
    const filled = ai.filter(
      (f) => isPending(row, f) && found[f.name] !== null && found[f.name] !== undefined,
    )
    if (filled.length === 0) return row
    changed = true
    const patched: Record<string, unknown> = { ...row, _updated_at: found._updated_at }
    for (const field of filled) patched[field.name] = found[field.name]
    return patched as Row
  })
  return changed ? next : current
}

/**
 * Watches the page's empty AI cells until the worker has filled them. Returns whether it
 * is watching — what `AiWaitingProvider` is given.
 */
export function useAiWatch(
  table: TableRef | null,
  fields: readonly Field[],
  rows: readonly Row[],
  setRows: Dispatch<SetStateAction<readonly Row[]>>,
): boolean {
  const ai = useMemo(() => fields.filter((f) => f.ai === true), [fields])
  // A key rather than a list: the watch restarts when a cell is filled, not at each render.
  // In identifier order, the worker's own: the first rows it fills are the ones asked for.
  const pending = useMemo(
    () =>
      rows
        .filter((row) => ai.some((f) => isPending(row, f)))
        .map((row) => row._id)
        .sort()
        .slice(0, MAX_IDS)
        .join(','),
    [rows, ai],
  )
  // The page as it was when the watch gave up. Any reload since — a row added, a cited
  // value changed — is a new page, and it is watched again.
  const [stalledOn, setStalledOn] = useState<readonly Row[] | null>(null)
  const latest = useRef(rows)
  useEffect(() => {
    latest.current = rows
  }, [rows])
  const watching = table !== null && pending !== '' && stalledOn !== rows

  useEffect(() => {
    if (!watching || table === null) return
    const ids = pending.split(',')
    const filter = `_id in [${ids.map(quoteLiteral).join(', ')}]`
    const since = Date.now()
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const page = await api.list(table, { filter, limit: ids.length })
        if (alive) setRows((current) => fillAi(current, page.data as readonly Row[], ai))
      } catch {
        // A reading that fails is the next one's to make: the banner is for the person's acts.
      }
      if (!alive) return
      if (Date.now() - since >= PATIENCE_MS) setStalledOn(latest.current)
      else timer = setTimeout(tick, POLL_MS)
    }
    timer = setTimeout(tick, POLL_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [watching, table, pending, ai, setRows])

  return watching
}

/** Why a settled cell holds nothing: the model had nothing to work on. */
const NOTHING = $t('Rien à calculer : les colonnes citées sont vides ou insuffisantes')

/**
 * An AI cell with no text. NULL is not computed yet: a green loader while the screen waits
 * for the worker, else « en attente », which is not "nothing" — the next pass fills it.
 * `''` is computed, and the answer was none: the cited columns gave the model nothing to
 * work on. It stays so until one of them changes.
 */
export function AiEmpty({
  value,
  appearance,
}: {
  readonly value: unknown
  readonly appearance: 'cell' | 'panel'
}) {
  const waiting = useContext(Waiting) && value === null
  const Icon = waiting ? Loader2 : Sparkles

  if (value === '') {
    return appearance === 'panel' ? (
      <p className="py-2 text-sm text-muted-foreground">{NOTHING}.</p>
    ) : (
      <span className="flex w-full items-center px-2 text-muted-foreground" title={NOTHING}>
        —
      </span>
    )
  }

  if (appearance === 'panel') {
    return (
      <p className="flex items-center gap-1.5 py-2 text-sm text-muted-foreground">
        <Icon className={cn('size-3.5', waiting && 'animate-spin text-emerald-500')} />
        {waiting ? $t('Calcul en cours…') : $t('Pas encore calculé')}
      </p>
    )
  }
  return (
    <span
      className="flex w-full items-center gap-1.5 px-2 text-xs text-muted-foreground/70"
      title={
        waiting
          ? $t('Calcul en cours : la valeur s’affiche dès que l’IA a répondu')
          : $t('Pas encore calculé : la cellule est remplie au prochain passage de l’IA')
      }
    >
      <Icon className={cn('size-3 shrink-0', waiting && 'animate-spin text-emerald-500')} />
      {waiting ? $t('calcul…') : $t('en attente')}
    </span>
  )
}
