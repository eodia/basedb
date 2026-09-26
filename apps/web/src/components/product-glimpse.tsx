'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { OptionBadge } from '@/components/app/option-badge'
import { cn } from '@/lib/utils'
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Contact,
  Database,
  FolderKanban,
  Mail,
  MousePointer2,
  Package,
  PanelLeft,
  Search,
  SquareTerminal,
  Table2,
  Target,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A window onto the application, beside the sign-in form.
 *
 * Drawn with the application's own tokens and pieces — the field icons, the option chips —
 * so it follows the theme and looks like what opens next. Its data is the demonstration
 * base's, never the visitor's: nobody is signed in yet.
 *
 * A small scene plays in it, in a loop: a query types itself out and the rows it returns
 * light up; a colleague changes a cell and the result follows, live; the question changes,
 * and so does the answer. The same table, read and written by several people at once —
 * which is what basedb is. Asked for less motion, it shows the first answer, still.
 */

type Status = 'Actif' | 'Prospect' | 'Ancien'

interface Client {
  readonly name: string
  readonly sector: string
  readonly status: Status
  readonly city: string
  readonly email: string
}

const SECTORS: Readonly<Record<string, string>> = {
  Commerce: '#6b7280',
  Santé: '#3b82f6',
  Éducation: '#f59e0b',
  Industrie: '#10b981',
  Association: '#ef4444',
}

const STATUSES: Readonly<Record<Status, string>> = {
  Actif: '#10b981',
  Prospect: '#f59e0b',
  Ancien: '#94a3b8',
}

const CLIENTS: readonly Client[] = [
  {
    name: 'Boulangerie Martin',
    sector: 'Commerce',
    status: 'Actif',
    city: 'Lyon',
    email: 'contact@boulangerie-martin.example',
  },
  {
    name: 'Clinique des Tilleuls',
    sector: 'Santé',
    status: 'Actif',
    city: 'Nantes',
    email: 'communication@tilleuls.example',
  },
  {
    name: 'Lycée Jean Moulin',
    sector: 'Éducation',
    status: 'Actif',
    city: 'Bordeaux',
    email: 'direction@jeanmoulin.example',
  },
  {
    name: 'Forges du Rhône',
    sector: 'Industrie',
    status: 'Ancien',
    city: 'Vienne',
    email: 'marketing@forges-rhone.example',
  },
  {
    name: 'L’Épicerie fine',
    sector: 'Commerce',
    status: 'Prospect',
    city: 'Lyon',
    email: 'gerance@epicerie-fine.example',
  },
  {
    name: 'Vélo Solidaire',
    sector: 'Association',
    status: 'Actif',
    city: 'Grenoble',
    email: 'bonjour@velo-solidaire.example',
  },
]

/** The row the colleague edits. */
const EDITED = 4

/** The project's bases, as varied as a team's; the first one unfolded on its tables. */
const BASES = [
  {
    label: 'CRM',
    Icon: Database,
    color: '#3b82f6',
    tables: [
      { label: 'Clients', Icon: Building2, color: '#3b82f6' },
      { label: 'Contacts', Icon: Contact, color: '#8b5cf6' },
      { label: 'Opportunités', Icon: Target, color: '#f59e0b' },
    ],
  },
  { label: 'Stock', Icon: Package, color: '#f59e0b', tables: [] },
  { label: 'Recrutement', Icon: Users, color: '#ec4899', tables: [] },
  { label: 'Événements', Icon: CalendarDays, color: '#8b5cf6', tables: [] },
] as const

const COLLEAGUE = { initials: 'LM', name: 'Léa', color: '#ec4899' }

/** The two questions the scene asks, in turn. */
const BY_STATUS = "statut = 'Actif'"
const BY_CITY = "ville = 'Lyon'"
const PREFIX = 'select nom, ville\n  from clients\n where '
const query = (clause: string) => `${PREFIX}${clause};`

const matches = (clause: string, client: Client) =>
  clause === BY_STATUS ? client.status === 'Actif' : client.city === 'Lyon'

// Fixed widths, wider than the window: the last column runs off its edge, as more of the
// table would. Narrower screens drop « Secteur », so that « Statut » — what the scene is
// about — stays in sight beside the navigation.
const COLUMNS =
  'grid-cols-[2.25rem_10.5rem_6.5rem_6.5rem_16rem] xl:grid-cols-[2.25rem_10.5rem_7.75rem_6.5rem_6.5rem_16rem]'

/** Syntax colours for the few words the console ever shows, typed or half typed. */
function Highlighted({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/(\bselect\b|\bfrom\b|\bwhere\b|'[^']*'?)/).map((part, i) =>
        part === '' ? null : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: pieces of one string, in order
            key={i}
            className={
              part.startsWith("'")
                ? 'text-syn-string'
                : /^(select|from|where)$/.test(part)
                  ? 'text-syn-keyword'
                  : undefined
            }
          >
            {part}
          </span>
        ),
      )}
    </>
  )
}

interface Spot {
  readonly x: number
  readonly y: number
}

/** The scene: what the console shows, which query ran, and where the colleague is. */
function useScene(measure: () => Spot | null) {
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [clause, setClause] = useState<string | null>(null)
  const [edited, setEdited] = useState<Status>(CLIENTS[EDITED].status)
  const [cursor, setCursor] = useState<{ spot: Spot; present: boolean } | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    // Asked for less motion: the first answer, at once, and nothing moving after it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(query(BY_STATUS))
      setClause(BY_STATUS)
      return
    }

    // Unmounting clears the pending timer, and the scene simply never wakes up again.
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer)
          resolve()
        }, ms)
        timers.add(timer)
      })

    let shown = ''
    const show = (next: string) => {
      shown = next
      setText(next)
    }
    // Erases back to what the two texts share, then types the rest — as someone would.
    const typeTo = async (target: string, pace = 38) => {
      setTyping(true)
      let common = 0
      while (common < Math.min(shown.length, target.length) && shown[common] === target[common]) {
        common += 1
      }
      while (shown.length > common) {
        show(shown.slice(0, -1))
        await sleep(20)
      }
      while (shown.length < target.length) {
        show(target.slice(0, shown.length + 1))
        await sleep(pace)
      }
      setTyping(false)
    }
    const ask = async (next: string, pace?: number) => {
      setClause(null)
      await typeTo(query(next), pace)
      await sleep(320)
      setClause(next)
    }
    // The colleague comes to the cell, changes it, and leaves.
    const edit = async (to: Status) => {
      const spot = measure()
      if (spot === null) return
      setCursor({ spot: { x: spot.x + 200, y: spot.y + 150 }, present: false })
      await sleep(60)
      setCursor({ spot, present: true })
      await sleep(1000)
      setEditing(true)
      await sleep(420)
      setEdited(to)
      await sleep(1000)
      setEditing(false)
      await sleep(260)
      setCursor({ spot: { x: spot.x + 140, y: spot.y - 90 }, present: false })
    }

    void (async () => {
      await sleep(1100)
      await ask(BY_STATUS, 34)
      for (;;) {
        await sleep(2000)
        await edit('Actif')
        await sleep(2600)
        await ask(BY_CITY)
        await sleep(2600)
        await edit('Prospect')
        await sleep(1800)
        await ask(BY_STATUS)
      }
    })()

    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [measure])

  return { text, typing, clause, edited, cursor, editing }
}

export function ProductGlimpse() {
  const grid = useRef<HTMLDivElement>(null)
  const cell = useRef<HTMLSpanElement>(null)
  // Where the edited cell sits in the grid, read when the colleague heads for it: the rows
  // are shorter on a short screen.
  const measure = useCallback((): Spot | null => {
    if (grid.current === null || cell.current === null) return null
    const origin = grid.current.getBoundingClientRect()
    const target = cell.current.getBoundingClientRect()
    return { x: target.left - origin.left + 44, y: target.top - origin.top + 18 }
  }, [])
  const { text, typing, clause, edited, cursor, editing } = useScene(measure)

  const rows = CLIENTS.map((c, i) => (i === EDITED ? { ...c, status: edited } : c))
  const hits = clause === null ? 0 : rows.filter((c) => matches(clause, c)).length

  return (
    <div className="relative hidden flex-col overflow-hidden border-l bg-surface lg:flex">
      <div className="px-[12%] pt-[max(2.5rem,7vh)] pb-8 short:pb-6">
        <h2 className="max-w-lg animate-in fade-in slide-in-from-bottom-2 text-[1.75rem] leading-tight font-semibold tracking-tight text-balance duration-500 fill-mode-both [animation-delay:120ms]">
          Organisez tout ce qui compte, en équipe.
        </h2>
        <p className="mt-3 max-w-lg animate-in fade-in slide-in-from-bottom-2 text-[15px] leading-relaxed text-muted-foreground duration-500 fill-mode-both [animation-delay:220ms]">
          Suivi commercial, stock, recrutement, événements… Créez les bases dont vous avez besoin,
          reliez vos tables et partagez-les en quelques clics — sur une vraie base de données.
        </p>
      </div>

      {/* The window: it runs off the right and bottom edges, as a glimpse does. */}
      <div aria-hidden="true" className="relative flex-1">
        <div className="absolute top-0 -right-24 -bottom-24 left-[12%] flex animate-in fade-in slide-in-from-bottom-10 overflow-hidden rounded-tl-xl border bg-background shadow-[0_32px_80px_-24px_rgb(0_0_0/0.28)] duration-700 ease-out fill-mode-both [animation-delay:250ms]">
          <nav className="flex w-44 shrink-0 flex-col border-r bg-sidebar text-[13px] xl:w-52">
            {/* The project switcher, where the application has it. */}
            <div className="flex items-center gap-2.5 p-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background">
                <FolderKanban className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">Agence Lumen</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Projet · 4 bases
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </div>
            <div className="mx-2.5 mb-2 flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs text-muted-foreground">
              <Search className="size-3.5" />
              Filtrer les bases et les tables
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              {BASES.map((b, i) => (
                <div
                  key={b.label}
                  className="animate-in fade-in slide-in-from-left-1 duration-300 fill-mode-both"
                  style={{ animationDelay: `${600 + i * 70}ms` }}
                >
                  <div className="flex items-center gap-1.5 rounded-md px-1 py-1.5 font-semibold">
                    {b.tables.length > 0 ? (
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <b.Icon className="size-4 shrink-0" style={{ color: b.color }} />
                    <span className="truncate">{b.label}</span>
                  </div>
                  {b.tables.length > 0 && (
                    <div className="ml-3 flex flex-col gap-0.5 border-l pl-2">
                      {b.tables.map((t, j) => (
                        <div
                          key={t.label}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1.5',
                            j === 0 && 'bg-sidebar-accent font-medium',
                          )}
                        >
                          <t.Icon className="size-4 shrink-0" style={{ color: t.color }} />
                          <span className="truncate">{t.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-11 shrink-0 items-center gap-3 border-b px-3.5 text-[13px]">
              <PanelLeft className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">CRM</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">Clients</span>
              {/* Who else has the table open. */}
              <span className="mr-28 ml-auto flex -space-x-1.5">
                {[COLLEAGUE, { initials: 'TR', color: '#3b82f6' }].map((p, i) => (
                  <span
                    key={p.initials}
                    className="grid size-6 animate-in zoom-in-50 fade-in place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background duration-300 fill-mode-both"
                    style={{ backgroundColor: p.color, animationDelay: `${1000 + i * 120}ms` }}
                  >
                    {p.initials}
                  </span>
                ))}
              </span>
            </header>

            <div className="flex h-10 shrink-0 items-center gap-4 border-b px-3.5 text-[13px]">
              <span className="flex items-center gap-1.5 font-medium">
                <Table2 className="size-4 text-primary" />
                Toutes les lignes
              </span>
              <span className="text-muted-foreground">Filtrer</span>
              <span className="text-muted-foreground">Colonnes</span>
              <span className="text-muted-foreground">Grouper</span>
            </div>

            <div ref={grid} className="relative w-max min-w-full bg-background text-[13px]">
              <div
                className={cn(
                  'grid h-9 items-center border-b bg-surface font-medium text-foreground',
                  COLUMNS,
                )}
              >
                <span className="pl-3 text-xs text-muted-foreground">#</span>
                <span className="flex items-center gap-1.5 px-2.5">
                  <FieldIcon kind="short_text" />
                  Nom
                </span>
                <span className="hidden items-center gap-1.5 px-2.5 xl:flex">
                  <FieldIcon kind="select" />
                  Secteur
                </span>
                <span className="flex items-center gap-1.5 px-2.5">
                  <FieldIcon kind="select" />
                  Statut
                </span>
                <span className="flex items-center gap-1.5 px-2.5">
                  <FieldIcon kind="short_text" />
                  Ville
                </span>
                <span className="flex items-center gap-1.5 px-2.5">
                  <FieldIcon kind="email" />
                  E-mail
                </span>
              </div>

              {rows.map((client, i) => {
                const hit = clause !== null && matches(clause, client)
                // Rows light up one after the other, and go out together.
                const delay = hit ? `${i * 70}ms` : '0ms'
                return (
                  <div
                    key={client.name}
                    className={cn(
                      'relative grid h-10 items-center border-b transition-colors duration-500 short:h-9',
                      COLUMNS,
                      hit && 'bg-primary/10',
                    )}
                    style={{ transitionDelay: delay }}
                  >
                    <span
                      className={cn(
                        'absolute inset-y-0 left-0 w-0.5 origin-top bg-primary transition-[opacity,scale] duration-500',
                        hit ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0',
                      )}
                      style={{ transitionDelay: delay }}
                    />
                    <span className="pl-3 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="truncate px-2.5 font-medium">{client.name}</span>
                    <span className="hidden px-2.5 xl:block">
                      <OptionBadge
                        option={{ label: client.sector, color: SECTORS[client.sector] }}
                      />
                    </span>
                    <span
                      ref={i === EDITED ? cell : undefined}
                      className="flex h-full items-center rounded-sm px-2.5 transition-shadow duration-200"
                      style={
                        i === EDITED && editing
                          ? { boxShadow: `inset 0 0 0 2px ${COLLEAGUE.color}` }
                          : undefined
                      }
                    >
                      <OptionBadge
                        // A new chip for a new value: it pops in, where the old one was.
                        key={client.status}
                        option={{ label: client.status, color: STATUSES[client.status] }}
                        className={cn(
                          i === EDITED &&
                            'animate-in zoom-in-75 fade-in duration-300 fill-mode-both',
                        )}
                      />
                    </span>
                    <span className="truncate px-2.5">{client.city}</span>
                    <span className="flex min-w-0 items-center gap-1.5 px-2.5 text-primary">
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </span>
                  </div>
                )
              })}

              {/* The colleague's pointer, with their name, as the grid shows it live. */}
              <div
                className="pointer-events-none absolute top-0 left-0 z-10 flex items-start"
                style={{
                  translate: `${cursor?.spot.x ?? 480}px ${cursor?.spot.y ?? 320}px`,
                  opacity: cursor?.present === true ? 1 : 0,
                  transition:
                    'translate 950ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 280ms ease-out',
                }}
              >
                <MousePointer2
                  className="size-4 drop-shadow-sm"
                  style={{ color: COLLEAGUE.color, fill: COLLEAGUE.color }}
                />
                <span
                  className="mt-3 -ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium text-white shadow-sm"
                  style={{ backgroundColor: COLLEAGUE.color }}
                >
                  {COLLEAGUE.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The same table, read in SQL. */}
      <div
        aria-hidden="true"
        className="absolute bottom-[7%] left-[6%] w-[22rem] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 overflow-hidden rounded-xl border border-code-border bg-code text-code-foreground shadow-[0_24px_60px_-16px_rgb(0_0_0/0.45)] duration-500 fill-mode-both [animation-delay:650ms] short:bottom-[4%]"
      >
        <div className="flex items-center gap-2 border-b border-code-border px-4 py-2.5 text-xs text-syn-comment short:hidden">
          <SquareTerminal className="size-3.5" />
          Console SQL
          <span
            className={cn(
              'ml-auto size-1.5 rounded-full transition-colors duration-300',
              typing ? 'bg-syn-number' : clause !== null ? 'bg-primary' : 'bg-syn-comment/40',
            )}
          />
        </div>
        <pre className="min-h-[5.25rem] px-4 pt-3 font-mono text-[13px] leading-6 whitespace-pre">
          <Highlighted text={text} />
          <span
            className={cn(
              'ml-px inline-block h-4 w-[7px] translate-y-[3px] bg-code-foreground/70',
              !typing && 'animate-pulse',
            )}
          />
        </pre>
        <p
          className={cn(
            'flex gap-1 px-4 pb-3 font-mono text-[13px] leading-6 text-syn-comment transition-opacity duration-300',
            clause !== null ? 'opacity-100' : 'opacity-0',
          )}
        >
          --
          <span
            // The count changes with the data: the new number slides in.
            key={hits}
            className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            {hits}
          </span>
          {hits > 1 ? 'lignes' : 'ligne'}
        </p>
      </div>
    </div>
  )
}
