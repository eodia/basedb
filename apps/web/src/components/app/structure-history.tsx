'use client'

import { Button } from '@/components/ui/button'
import { type StructureEvent, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import {
  ArrowRight,
  Database,
  List,
  Loader2,
  type LucideIcon,
  Settings2,
  Sparkles,
  Table2,
  TextCursorInput,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The structure history of a base — chapter 07 §8.1, on screen.
 *
 * Not the rows: the tables, the fields, their choices and their AI option. One line per
 * act, with what changed from what to what and who did it — a person, an agent through
 * its token, or someone in psql, who is named as such.
 */

const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

const ICONS: Readonly<Record<StructureEvent['object'], LucideIcon>> = {
  base: Database,
  table: Table2,
  field: TextCursorInput,
  ai: Sparkles,
  option: List,
  config: Settings2,
}

function dayOf(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (date.toDateString() === today.toDateString()) return 'Aujourd’hui'
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'
  const text = DAY.format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function authorOf(event: StructureEvent): string {
  if (event.actor.kind === 'sql_direct') return 'SQL direct'
  if (event.actor.kind === 'system') return 'basedb'
  return event.actor.name ?? 'Utilisateur supprimé'
}

export function StructureHistory({ base }: { readonly base: string }) {
  const [events, setEvents] = useState<readonly StructureEvent[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (before?: string) => {
      setLoading(true)
      setError(null)
      try {
        const page = await api.structureHistory(base, before)
        setEvents((was) => (before === undefined ? page.events : [...was, ...page.events]))
        setNext(page.next)
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setLoading(false)
      }
    },
    [base],
  )

  useEffect(() => {
    setEvents([])
    void load()
  }, [load])

  const days: Array<{ day: string; events: StructureEvent[] }> = []
  for (const event of events) {
    const day = dayOf(event.at)
    const last = days[days.length - 1]
    if (last?.day === day) last.events.push(event)
    else days.push({ day, events: [event] })
  }

  return (
    <div className="space-y-5">
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
      {days.map(({ day, events: list }) => (
        <section key={day} className="space-y-1">
          <h2 className="text-xs font-medium text-muted-foreground">{day}</h2>
          <ul className="divide-y rounded-lg border">
            {list.map((event) => {
              const Icon = ICONS[event.object]
              return (
                <li key={event.id} className="flex items-start gap-3 px-3 py-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm">
                      {event.summary}
                      {event.table !== null && event.object !== 'table' && (
                        <span className="text-muted-foreground"> · {event.table}</span>
                      )}
                    </p>
                    {event.changes.map((change) => (
                      <p key={change.attribute} className="text-xs text-muted-foreground">
                        {change.attribute} :{' '}
                        <span className="line-through">{change.from ?? '(vide)'}</span>
                        <ArrowRight className="mx-1 inline size-3" />
                        <span className="text-foreground">{change.to ?? '(vide)'}</span>
                      </p>
                    ))}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{authorOf(event)}</p>
                    <p>{TIME.format(new Date(event.at))}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {loading && (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && events.length === 0 && error === null && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucune modification de structure enregistrée.
        </p>
      )}
      {next !== null && !loading && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => void load(next)}>
            Plus ancien
          </Button>
        </div>
      )}
    </div>
  )
}
