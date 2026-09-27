'use client'

import { SidebarToggle } from '@/components/app/sidebar'
import { StructureHistory } from '@/components/app/structure-history'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import { Hint } from '@/components/ui/tooltip'
import {
  type DescribedBase,
  type Revision,
  type RevisionChange,
  type RevisionPage,
  api,
} from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Bot,
  ChevronDown,
  Clock,
  Loader2,
  RotateCcw,
  Terminal,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The history — chapter 07 §9 — as a person reads it: who changed what, when, and what it
 * was before.
 *
 * Every write is in it, whoever made it: a person in the grid, a program with a token, an
 * agent, someone in psql. The values are shown as they were THAT day — a choice by its
 * label, a linked row by its name — because the journal froze them; a client renamed
 * since does not rewrite who was invoiced.
 *
 * Two ways back, offered only to whoever may take them: undoing a modification puts its
 * fields back (refused if one changed since, which would erase a later write), restoring
 * a deleted row brings it back under its own identifier.
 */

const TIME = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat(intlLocale(), {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const FULL = new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'long', timeStyle: 'medium' })

/** « Aujourd'hui », « Hier », or the date: what a day heading says. */
function dayOf(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(date, today)) return $t('Aujourd’hui')
  if (same(date, yesterday)) return $t('Hier')
  const text = DAY.format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Who wrote: a person, a person through a token, a SQL session, or nobody known. */
function authorOf(r: Revision): {
  name: string
  hint: string | null
  icon: 'user' | 'token' | 'sql'
} {
  switch (r.actor.kind) {
    case 'user':
      return { name: r.actor.name ?? $t('Utilisateur'), hint: null, icon: 'user' }
    case 'token':
    case 'mcp':
      return {
        name: r.actor.name ?? $t('Jeton d’intégration'),
        hint:
          r.actor.token_label === null
            ? $t('par un jeton')
            : $t('par le jeton « {token_label} »', { token_label: r.actor.token_label }),
        icon: 'token',
      }
    case 'sql_direct':
      return { name: $t('Session SQL directe'), hint: r.actor.sql_identity, icon: 'sql' }
    case 'system':
      return { name: 'basedb', hint: $t('opération système'), icon: 'user' }
    // An answer to a public form (chapter 15): nobody signed in wrote it.
    case 'form':
      return {
        name:
          r.actor.token_label === null
            ? $t('Formulaire partagé')
            : $t('Formulaire « {token_label} »', { token_label: r.actor.token_label }),
        hint:
          r.actor.name === null
            ? $t('réponse publique')
            : $t('réponse publique · publié par {name}', { name: r.actor.name }),
        icon: 'token',
      }
    // An automation's write (chapter 17 §2.2): its name, and who answers for it.
    case 'automation':
      return {
        name:
          r.actor.token_label === null
            ? $t('Automatisation')
            : $t('Automatisation « {token_label} »', { token_label: r.actor.token_label }),
        hint: r.actor.name === null ? null : $t('au nom de {name}', { name: r.actor.name }),
        icon: 'token',
      }
    default:
      return { name: $t('Auteur inconnu'), hint: r.actor.sql_identity, icon: 'sql' }
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')

/** A value as a person reads it: what the journal named it, else the value itself. */
function shown(change: RevisionChange, side: 'before' | 'after'): string | null {
  const display = side === 'before' ? change.before_display : change.after_display
  if (display !== null) return display
  const value = side === 'before' ? change.before : change.after
  if (value === undefined) return null
  if (value === null || value === '') return null
  if (typeof value === 'boolean') return value ? $t('Oui') : $t('Non')
  if (typeof value === 'number') return value.toLocaleString(intlLocale())
  if (Array.isArray(value))
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  if (change.kind === 'datetime' && typeof value === 'string') {
    const at = Date.parse(value)
    if (!Number.isNaN(at)) return FULL.format(new Date(at))
  }
  // A link whose target's name was not kept: the journal says so rather than show an id.
  if (change.kind === 'link') return $t('ligne liée (nom non conservé)')
  return String(value)
}

function Value({ text }: { readonly text: string | null }) {
  return text === null ? (
    <span className="italic text-muted-foreground">{$t('vide')}</span>
  ) : (
    <span className="break-words">{text}</span>
  )
}

/** The fields of an entry: « Statut : Émise → Payée », the first few, the rest on demand. */
function Changes({ revision }: { readonly revision: Revision }) {
  const [open, setOpen] = useState(false)
  const all = revision.changes
  const visible = open ? all : all.slice(0, 4)
  if (all.length === 0) return null
  return (
    <ul className="mt-1.5 space-y-1 text-[13px]">
      {visible.map((c) => (
        <li key={c.field_id} className="flex flex-wrap items-baseline gap-x-1.5">
          <span className={cn('text-muted-foreground', c.name === null && 'line-through')}>
            {c.label} :
          </span>
          {revision.op === 'update' ? (
            <>
              <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                <Value text={shown(c, 'before')} />
              </span>
              <ArrowRight className="size-3 shrink-0 self-center text-muted-foreground" />
              <Value text={shown(c, 'after')} />
            </>
          ) : (
            <Value text={shown(c, revision.op === 'delete' ? 'before' : 'after')} />
          )}
        </li>
      ))}
      {all.length > 4 && (
        <li>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
            {open
              ? $t('Réduire')
              : $tp(all.length - 4, '{count} autre champ', '{count} autres champs')}
          </button>
        </li>
      )}
    </ul>
  )
}

function Entry({
  revision,
  showTable,
  busy,
  onAct,
}: {
  readonly revision: Revision
  readonly showTable: boolean
  readonly busy: boolean
  readonly onAct: (revision: Revision, action: 'revert' | 'restore') => void
}) {
  const author = authorOf(revision)
  const name = revision.record_display ?? $t('ligne sans libellé')
  const verb =
    revision.op === 'insert'
      ? $t('a créé')
      : revision.op === 'update'
        ? $t('a modifié')
        : revision.cascade
          ? $t('a supprimé, en chaîne,')
          : $t('a supprimé')

  return (
    <li className="flex gap-3 py-3">
      <Hint label={author.hint ?? undefined}>
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
            author.icon === 'user'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {author.icon === 'token' ? (
            <Bot className="size-3.5" />
          ) : author.icon === 'sql' ? (
            <Terminal className="size-3.5" />
          ) : (
            initials(author.name)
          )}
        </span>
      </Hint>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <span className="font-medium">{author.name}</span>
          <span className="text-muted-foreground">{verb}</span>
          <span className="font-medium">« {name} »</span>
          {showTable && (
            <span className="text-muted-foreground">
              {$t('dans')} <span className="text-foreground">{revision.table.label}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <Hint label={FULL.format(new Date(revision.occurred_at))}>
            <time dateTime={revision.occurred_at}>
              {TIME.format(new Date(revision.occurred_at))}
            </time>
          </Hint>
          {author.hint !== null && <span className="truncate">· {author.hint}</span>}
        </div>
        <Changes revision={revision} />
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {revision.actions.includes('revert') && (
          <Hint label={$t('Remettre les valeurs d’avant cette modification')}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy}
              onClick={() => onAct(revision, 'revert')}
            >
              <Undo2 className="size-3.5" />
              {$t('Annuler')}
            </Button>
          </Hint>
        )}
        {revision.actions.includes('restore') && (
          <Hint label={$t('Rétablir cette ligne telle qu’elle était')}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy}
              onClick={() => onAct(revision, 'restore')}
            >
              <RotateCcw className="size-3.5" />
              {$t('Restaurer')}
            </Button>
          </Hint>
        )}
      </div>
    </li>
  )
}

/**
 * A history feed, newest first, grouped by day, with « Voir plus » as long as the cursor
 * says there is more. `load` fetches a page; `reloadKey` refetches from the start.
 */
export function HistoryList({
  load,
  showTable,
  reloadKey,
  empty,
}: {
  readonly load: (cursor?: string) => Promise<RevisionPage>
  readonly showTable: boolean
  readonly reloadKey?: string
  readonly empty: string
}) {
  const [revisions, setRevisions] = useState<readonly Revision[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reload = useWorkspace((s) => s.reload)

  const first = useCallback(async () => {
    setError(null)
    try {
      const page = await load()
      setRevisions(page.data)
      setCursor(page.meta.next_cursor)
    } catch (e) {
      setRevisions([])
      setError(messageFor(e))
    }
  }, [load])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` is the signal to reload
  useEffect(() => {
    setRevisions(null)
    void first()
  }, [first, reloadKey])

  const next = async () => {
    if (cursor === null) return
    setMore(true)
    try {
      const page = await load(cursor)
      setRevisions((was) => [...(was ?? []), ...page.data])
      setCursor(page.meta.next_cursor)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setMore(false)
    }
  }

  const act = async (revision: Revision, action: 'revert' | 'restore') => {
    setBusy(true)
    setError(null)
    try {
      if (action === 'revert') await api.revertRevision(revision.id)
      else await api.restoreRevision(revision.id)
      // The grid shows the row as it was before: it reloads, and so does this list, whose
      // first entry is now the write just made.
      reload()
      await first()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  if (revisions === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Day headings, in the order of the entries.
  const days: Array<{ day: string; items: Revision[] }> = []
  for (const r of revisions) {
    const day = dayOf(r.occurred_at)
    const last = days[days.length - 1]
    if (last?.day === day) last.items.push(r)
    else days.push({ day, items: [r] })
  }

  return (
    <div>
      {error !== null && (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {revisions.length === 0 && error === null && (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      )}
      {days.map(({ day, items }) => (
        <section key={day} className="mb-2">
          <h3 className="sticky top-0 z-10 bg-background py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {day}
          </h3>
          <ul className="divide-y">
            {items.map((r) => (
              <Entry key={r.id} revision={r} showTable={showTable} busy={busy} onAct={act} />
            ))}
          </ul>
        </section>
      ))}
      {cursor !== null && (
        <div className="flex justify-center py-3">
          <Button variant="outline" size="sm" onClick={() => void next()} disabled={more}>
            {more && <Loader2 className="size-4 animate-spin" />}
            {$t('Voir plus')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** The « Historique » section of a base: its activity, filterable by table. */
export function HistoryPanel({
  base,
  onBack,
}: {
  readonly base: DescribedBase
  readonly onBack: () => void
}) {
  const [table, setTable] = useState<string>('')
  // The rows, or the structure (chapter 07 §8.1) — the latter to whoever builds the base.
  const [view, setView] = useState<'rows' | 'structure'>('rows')
  const structure = base.actions.includes('manage_schema')
  const load = useCallback(
    (cursor?: string) =>
      api.baseHistory(base.name, { table: table === '' ? undefined : table, cursor }),
    [base.name, table],
  )

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <span className="text-sm text-muted-foreground">{base.project.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{$t('Historique')}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onBack}>
          {$t('Retour aux données')}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="size-5 text-muted-foreground" />
                {$t('Historique')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {view === 'rows'
                  ? $t(
                      'Chaque écriture, d’où qu’elle vienne — l’interface, l’API, un agent ou le SQL direct —, avec les valeurs d’avant.',
                    )
                  : $t(
                      'Chaque modification des tables, des champs, de leurs choix et de leur IA, avec ce qu’ils étaient avant.',
                    )}
              </p>
            </div>
            {structure && (
              <div className="flex rounded-lg bg-muted p-0.5 text-sm" role="tablist">
                {(['rows', 'structure'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      'rounded-md px-3 py-1',
                      view === v ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    {v === 'rows' ? $t('Données') : $t('Structure')}
                  </button>
                ))}
              </div>
            )}
            {view === 'rows' && (
              <Choice
                value={table === '' ? 'all' : table}
                onValueChange={(v) => setTable(v === 'all' ? '' : v)}
                options={[
                  { value: 'all', label: $t('Toutes les tables') },
                  ...base.tables.map((t) => ({ value: t.name, label: t.label })),
                ]}
                aria-label={$t('Table')}
                size="default"
                className="w-56"
              />
            )}
          </div>

          {view === 'structure' ? (
            <StructureHistory base={base.name} />
          ) : (
            <>
              <HistoryList
                load={load}
                showTable={table === ''}
                empty={$t('Aucune écriture pour l’instant.')}
              />

              <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trash2 className="size-3.5" />
                {$t('Une ligne supprimée se restaure depuis son entrée « a supprimé ».')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
