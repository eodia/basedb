'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { OptionBadge } from '@/components/app/option-badge'
import { $t, $tp, intlLocale, msg } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleCheck,
  Contact,
  Database,
  FilePlus2,
  Filter,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  type LucideIcon,
  Mail,
  MessageSquareText,
  MousePointer2,
  Package,
  PanelLeft,
  PencilLine,
  Search,
  Sparkles,
  SquareTerminal,
  Table2,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'

/**
 * A window onto the application, beside the sign-in form.
 *
 * Drawn with the application's own tokens and pieces — the field icons, the option chips —
 * so it follows the theme and looks like what opens next. Its data is the demonstration
 * base's, never the visitor's: nobody is signed in yet.
 *
 * Three small scenes play in it, in a loop, named by the tabs above the window:
 * - the tables: a query types itself out and the rows it returns light up; a colleague
 *   changes a cell and the result follows, live; the question changes, and so does the
 *   answer;
 * - a dashboard: its figures and charts rise, then the colleague picks a city in a filter
 *   and every card follows;
 * - an automation: the client the colleague made active sets it off, and its steps run one
 *   after the other — the AI writes a welcome, a task is created, the team is told.
 * The same data, read, watched and acted on by several people at once — which is what
 * basedb is. Asked for less motion, it shows the first answer, still.
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
  [$t('Commerce')]: '#6b7280',
  [$t('Santé')]: '#3b82f6',
  [$t('Éducation')]: '#f59e0b',
  [$t('Industrie')]: '#10b981',
  [$t('Association')]: '#ef4444',
}

const STATUSES: Readonly<Record<Status, string>> = {
  Actif: '#10b981',
  Prospect: '#f59e0b',
  Ancien: '#94a3b8',
}

const CLIENTS: readonly Client[] = [
  {
    name: $t('Boulangerie Martin'),
    sector: $t('Commerce'),
    status: msg('Actif'),
    city: 'Lyon',
    email: 'contact@boulangerie-martin.example',
  },
  {
    name: $t('Clinique des Tilleuls'),
    sector: $t('Santé'),
    status: msg('Actif'),
    city: 'Nantes',
    email: 'communication@tilleuls.example',
  },
  {
    name: $t('Lycée Jean Moulin'),
    sector: $t('Éducation'),
    status: msg('Actif'),
    city: 'Bordeaux',
    email: 'direction@jeanmoulin.example',
  },
  {
    name: $t('Forges du Rhône'),
    sector: $t('Industrie'),
    status: msg('Ancien'),
    city: 'Vienne',
    email: 'marketing@forges-rhone.example',
  },
  {
    name: $t('L’Épicerie fine'),
    sector: $t('Commerce'),
    status: msg('Prospect'),
    city: 'Lyon',
    email: 'gerance@epicerie-fine.example',
  },
  {
    name: $t('Vélo Solidaire'),
    sector: $t('Association'),
    status: msg('Actif'),
    city: 'Grenoble',
    email: 'bonjour@velo-solidaire.example',
  },
]

/** The row the colleague edits — and the client the automation welcomes. */
const EDITED = 4

/** The project's bases, as varied as a team's; the first one unfolded on its tables. */
const BASES = [
  {
    label: $t('CRM'),
    Icon: Database,
    color: '#3b82f6',
    tables: [
      { label: $t('Clients'), Icon: Building2, color: '#3b82f6' },
      { label: $t('Contacts'), Icon: Contact, color: '#8b5cf6' },
      { label: $t('Opportunités'), Icon: Target, color: '#f59e0b' },
    ],
  },
  { label: $t('Stock'), Icon: Package, color: '#f59e0b', tables: [] },
  { label: $t('Recrutement'), Icon: Users, color: '#ec4899', tables: [] },
  { label: $t('Événements'), Icon: CalendarDays, color: '#8b5cf6', tables: [] },
] as const

const COLLEAGUE = { initials: 'LM', name: $t('Léa'), color: '#ec4899' }

type Scene = 'data' | 'dashboard' | 'automation'

/**
 * The scenes, in their order, and how long each one lasts — the tabs fill up over that
 * time. The table's is the longest: it is the one a visitor sees first.
 */
const SCENES: ReadonlyArray<{
  readonly id: Scene
  readonly label: string
  readonly Icon: LucideIcon
  readonly ms: number
}> = [
  { id: 'data', label: $t('Tables'), Icon: Table2, ms: 17000 },
  { id: 'dashboard', label: $t('Tableaux de bord'), Icon: LayoutDashboard, ms: 9500 },
  { id: 'automation', label: $t('Automatisations'), Icon: Zap, ms: 10500 },
]

const SCENE_MS = Object.fromEntries(SCENES.map((s) => [s.id, s.ms])) as Record<Scene, number>

/** Where the window's path says we are. */
const CRUMBS: Readonly<Record<Scene, string>> = {
  data: $t('Clients'),
  dashboard: $t('Tableaux de bord'),
  automation: $t('Automatisations'),
}

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

// ── The dashboard's figures: the whole year, then Lyon alone ─────────────────

interface Figures {
  readonly active: number
  readonly revenue: number
  readonly trend: number
  readonly goal: number
  /** Revenue of the last six months, in thousands. */
  readonly months: readonly number[]
  /** Clients by status — the table's own, as the first scene counts them. */
  readonly statuses: Readonly<Record<Status, number>>
}

const ALL: Figures = {
  active: 4,
  revenue: 184_300,
  trend: 12,
  goal: 68,
  months: [22, 31, 26, 38, 34, 41],
  statuses: { Actif: 4, Prospect: 1, Ancien: 1 },
}

const LYON: Figures = {
  active: 1,
  revenue: 52_600,
  trend: 8,
  goal: 71,
  months: [6, 9, 7, 12, 8, 11],
  statuses: { Actif: 1, Prospect: 1, Ancien: 0 },
}

/** The bars' scale: the busiest month of the year. */
const MONTH_MAX = 44

// ── The automation's steps ───────────────────────────────────────────────────

interface FlowStep {
  readonly id: string
  readonly Icon: LucideIcon
  readonly tone: string
  readonly label: string
  /** What the card says before the run… */
  readonly summary: string
  /** …and after it. */
  readonly done: string
  readonly ms: number
  /** How long the step seems to take, in the scene. */
  readonly takes: number
}

// The tones and labels of the editor's own cards (`automation-flow.tsx`).
const ACTION_TONE = 'bg-sky-500/12 text-sky-700 dark:text-sky-300'

const STEPS: readonly FlowStep[] = [
  {
    id: 'e1',
    Icon: Search,
    tone: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
    label: $t('Chercher une ligne'),
    summary: $t('Le contact principal du client'),
    done: $t('ligne trouvée'),
    ms: 23,
    takes: 600,
  },
  {
    id: 'e2',
    Icon: Sparkles,
    tone: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    label: $t('Demander à l’IA'),
    summary: $t('Rédiger un mot de bienvenue'),
    done: $t('réponse reçue'),
    ms: 842,
    takes: 0,
  },
  {
    id: 'e3',
    Icon: FilePlus2,
    tone: ACTION_TONE,
    label: $t('Créer une ligne'),
    summary: $t('Une tâche d’accueil pour {name}', { name: COLLEAGUE.name }),
    done: $t('fait'),
    ms: 41,
    takes: 600,
  },
  {
    id: 'e4',
    Icon: MessageSquareText,
    tone: ACTION_TONE,
    label: $t('Envoyer sur Slack'),
    summary: $t('Dans le canal #ventes'),
    done: $t('fait'),
    ms: 207,
    takes: 750,
  },
]

const WELCOME = $t(
  'Bienvenue parmi nos clients, {name} ! {colleague} vous appelle cette semaine pour lancer votre premier projet.',
  { name: CLIENTS[EDITED].name, colleague: COLLEAGUE.name },
)

/** Where the automation's run is: nothing yet, running a card, or done. */
interface Run {
  /** The cards the run has passed — the trigger is card 0. */
  readonly passed: number
  /** The card it is on, if any. */
  readonly on: number | null
}

const IDLE: Run = { passed: 0, on: null }

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

/** What the colleague's pointer heads for: a cell of the table, the dashboard's filter. */
type Aim = 'cell' | 'filter'

/** The scenes: which one plays, and where each of them is. */
function useScenes(measure: (target: Aim) => Spot | null) {
  const [scene, setScene] = useState<Scene>('data')
  const [cycle, setCycle] = useState(0)
  const [still, setStill] = useState(false)
  // The table.
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [clause, setClause] = useState<string | null>(null)
  const [edited, setEdited] = useState<Status>(CLIENTS[EDITED].status)
  const [editing, setEditing] = useState(false)
  // The colleague, wherever they are.
  const [cursor, setCursor] = useState<{ spot: Spot; present: boolean } | null>(null)
  const [pressing, setPressing] = useState(false)
  // The dashboard.
  const [grown, setGrown] = useState(false)
  const [lyon, setLyon] = useState(false)
  // The automation.
  const [run, setRun] = useState<Run>(IDLE)
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    // Asked for less motion: the first answer, at once, and nothing moving after it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true)
      setText(query(BY_STATUS))
      setClause(BY_STATUS)
      return
    }

    // Unmounting clears the pending timer, and the scenes simply never wake up again.
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer)
          resolve()
        }, ms)
        timers.add(timer)
      })
    /** Waits until a scene has lasted its time, so that its tab fills up as it ends. */
    const until = (deadline: number) => sleep(Math.max(0, deadline - performance.now()))

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
      const spot = measure('cell')
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
    // The colleague comes to the dashboard's filter, and picks a city.
    const filter = async () => {
      const spot = measure('filter')
      if (spot === null) return
      setCursor({ spot: { x: spot.x + 180, y: spot.y + 160 }, present: false })
      await sleep(60)
      setCursor({ spot, present: true })
      await sleep(1000)
      setPressing(true)
      await sleep(180)
      setLyon(true)
      await sleep(240)
      setPressing(false)
      await sleep(700)
      setCursor({ spot: { x: spot.x + 150, y: spot.y + 110 }, present: false })
    }
    // The run, card after card; the AI's step lasts as long as its answer takes to write.
    const automate = async () => {
      setRun({ passed: 0, on: 0 })
      await sleep(800)
      for (let i = 1; i <= STEPS.length; i += 1) {
        setRun({ passed: i, on: i })
        const step = STEPS[i - 1]
        if (step.id === 'e2') {
          await sleep(350)
          for (let n = 1; n <= WELCOME.length; n += 1) {
            setAnswer(WELCOME.slice(0, n))
            await sleep(22)
          }
          await sleep(250)
        } else {
          await sleep(step.takes)
        }
        setRun({ passed: i + 1, on: null })
        await sleep(260)
      }
    }

    void (async () => {
      for (;;) {
        // The tables: a query, a colleague's change, another query, another change.
        let start = performance.now()
        setScene('data')
        await sleep(1100)
        await ask(BY_STATUS, 34)
        await sleep(1600)
        await edit('Actif')
        await sleep(2200)
        await ask(BY_CITY)
        await sleep(2000)
        await edit('Prospect')
        await until(start + SCENE_MS.data)

        // A dashboard: its figures rise, then a filter narrows every card to Lyon.
        start = performance.now()
        setScene('dashboard')
        await sleep(650)
        setGrown(true)
        await sleep(2900)
        await filter()
        await until(start + SCENE_MS.dashboard)

        // An automation: the client made active sets it off.
        start = performance.now()
        setScene('automation')
        await sleep(900)
        await automate()
        await until(start + SCENE_MS.automation)

        // Back to the table, as it was: every scene starts again from its beginning.
        show('')
        setClause(null)
        setGrown(false)
        setLyon(false)
        setRun(IDLE)
        setAnswer('')
        setCycle((c) => c + 1)
      }
    })()

    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [measure])

  return {
    scene,
    cycle,
    still,
    text,
    typing,
    clause,
    edited,
    editing,
    cursor,
    pressing,
    grown,
    lyon,
    run,
    answer,
  }
}

/** A number that runs to its new value rather than jumping to it. */
function Counter({
  value,
  format,
}: { readonly value: number; readonly format: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900)
      const next = origin + (value - origin) * (1 - (1 - t) ** 3)
      from.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{format(shown)}</>
}

/** The scenes' tabs, above the window; the one playing fills up over its time. */
function SceneTabs({
  scene,
  cycle,
  still,
}: { readonly scene: Scene; readonly cycle: number; readonly still: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2 short:mt-4">
      {SCENES.map((s, i) => {
        const on = s.id === scene
        return (
          <span
            key={s.id}
            className={cn(
              'relative flex animate-in fade-in slide-in-from-bottom-1 items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-300 fill-mode-both',
              on
                ? 'border-primary/30 bg-background text-foreground shadow-xs'
                : 'border-transparent text-muted-foreground',
            )}
            style={{ animationDelay: `${320 + i * 70}ms` }}
          >
            <s.Icon className={cn('size-3.5', on && 'text-primary')} />
            {s.label}
            {on && !still && <Progress key={cycle} ms={s.ms} />}
          </span>
        )
      })}
    </div>
  )
}

function Progress({ ms }: { readonly ms: number }) {
  const bar = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const animation = bar.current?.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: ms, easing: 'linear', fill: 'forwards' },
    )
    return () => animation?.cancel()
  }, [ms])
  return (
    <span
      ref={bar}
      className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary/60"
    />
  )
}

/** One scene's screen in the window: they lie on each other, and the one playing shows. */
function Screen({ shown, children }: { readonly shown: boolean; readonly children: ReactNode }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col transition-[opacity,translate] duration-500 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      {children}
    </div>
  )
}

/** A dashboard: three figures, the revenue by month, the clients by status. */
function DashboardScreen({
  grown,
  lyon,
  pressing,
  filterRef,
}: {
  readonly grown: boolean
  readonly lyon: boolean
  readonly pressing: boolean
  readonly filterRef: RefObject<HTMLSpanElement | null>
}) {
  const figures = lyon ? LYON : ALL
  const tag = intlLocale()
  const money = (n: number) =>
    new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(n)
  const whole = (n: number) => new Intl.NumberFormat(tag).format(Math.round(n))
  const percent = (n: number) =>
    new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(n / 100)
  // The last six months, as the language names them.
  const now = new Date()
  const months = figures.months.map((_, i) =>
    new Intl.DateTimeFormat(tag, { month: 'short' }).format(
      new Date(now.getFullYear(), now.getMonth() - 5 + i, 1),
    ),
  )
  const statuses = Object.keys(STATUSES) as Status[]
  const clients = statuses.reduce((n, s) => n + figures.statuses[s], 0)
  let turned = 0

  // The right padding keeps the cards clear of the part of the window the page cuts off.
  return (
    <div className="flex flex-col gap-3 py-4 pr-28 pl-4 short:gap-2.5 short:py-3.5">
      <div>
        <div className="text-base font-semibold tracking-tight">{$t('Suivi commercial')}</div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{$t('Période')}</span>
            <span className="font-medium">{$t('Cette année')}</span>
          </span>
          <span
            ref={filterRef}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 transition-[background-color,border-color,scale] duration-200',
              lyon && 'border-primary/30 bg-primary/5',
              pressing && 'scale-95',
            )}
          >
            <Filter className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{$t('Ville')}</span>
            <span
              // The new value pops in where the old one was.
              key={String(lyon)}
              className="animate-in fade-in zoom-in-90 font-medium duration-300"
            >
              {lyon ? 'Lyon' : $t('Toutes')}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(3,minmax(8.5rem,1fr))] gap-2.5">
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">{$t('Clients actifs')}</div>
          <div className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight xl:text-2xl">
            <Counter value={grown ? figures.active : 0} format={whole} />
          </div>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">{$t('Chiffre d’affaires')}</div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-semibold tabular-nums tracking-tight xl:text-2xl">
              <Counter value={grown ? figures.revenue : 0} format={money} />
            </span>
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium text-emerald-600 transition-opacity duration-500 dark:text-emerald-400',
                grown ? 'opacity-100' : 'opacity-0',
              )}
            >
              <TrendingUp className="size-3.5" />
              {percent(figures.trend)}
            </span>
          </div>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">{$t('Objectif annuel')}</div>
          <div className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight xl:text-2xl">
            <Counter value={grown ? figures.goal : 0} format={percent} />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-900 ease-out"
              style={{ width: `${grown ? figures.goal : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(12rem,1fr)_12rem] gap-2.5">
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs font-medium">{$t('Chiffre d’affaires par mois')}</div>
          <div className="mt-3 flex h-32 items-end gap-2 border-b pb-px short:h-24">
            {figures.months.map((value, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: the months, in order
                key={i}
                className="flex-1 rounded-t-sm bg-[#2a78d6] transition-[height] duration-700 ease-out dark:bg-[#3987e5]"
                style={{
                  height: `${grown ? (value / MONTH_MAX) * 100 : 0}%`,
                  transitionDelay: `${i * 70}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex gap-2 text-[10px] text-muted-foreground">
            {months.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the months, in order
              <span key={i} className="flex-1 truncate text-center">
                {m}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs font-medium">{$t('Clients par statut')}</div>
          <div className="mt-2 flex items-center gap-3">
            <svg
              aria-hidden="true"
              viewBox="0 0 42 42"
              className="size-20 shrink-0 -rotate-90 short:size-16"
            >
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                strokeWidth="6"
                className="stroke-muted"
              />
              {statuses.map((status) => {
                const share = grown ? (figures.statuses[status] / clients) * 100 : 0
                const offset = -turned
                turned += share
                return (
                  <circle
                    key={status}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    strokeWidth="6"
                    stroke={STATUSES[status]}
                    strokeDasharray={`${share} ${100 - share}`}
                    strokeDashoffset={offset}
                    className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out"
                  />
                )
              })}
            </svg>
            <ul className="flex min-w-0 flex-1 flex-col gap-1 text-[11px]">
              {statuses.map((status) => (
                <li key={status} className="flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUSES[status] }}
                  />
                  <span className="truncate">{$t(status)}</span>
                  <span className="ml-auto pl-1 text-muted-foreground tabular-nums">
                    <Counter value={grown ? figures.statuses[status] : 0} format={whole} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/** An automation, drawn as the editor draws it: the trigger, then its steps, run one by one. */
function AutomationScreen({ run, answer }: { readonly run: Run; readonly answer: string }) {
  const finished = run.passed > STEPS.length
  const started = run.on !== null || run.passed > 0
  return (
    <>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b px-3.5 text-[13px]">
        <span className="truncate font-medium">{$t('Bienvenue aux nouveaux clients')}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <span className="flex h-4 w-7 items-center rounded-full bg-primary p-0.5">
            <span className="ml-auto size-3 rounded-full bg-background" />
          </span>
          {$t('Active')}
        </span>
      </div>
      <div className="relative flex-1 bg-surface bg-[image:radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] px-6 pt-4">
        {/* The run, as the editor pins it over the flow. */}
        <div
          className={cn(
            'mb-3 inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs shadow-xs transition-[opacity,translate] duration-300',
            started ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              finished ? 'bg-emerald-500' : 'animate-pulse bg-amber-500',
            )}
          />
          <span key={String(finished)} className="animate-in fade-in font-medium duration-300">
            {finished ? $t('Réussie') : $t('En cours')}
          </span>
          <span className="text-muted-foreground">
            · {finished ? $t('à l’instant') : CLIENTS[EDITED].name}
          </span>
        </div>

        <FlowCard
          Icon={PencilLine}
          tone="bg-primary/12 text-primary"
          overline={$t('Quand')}
          label={$t('Une ligne est modifiée')}
          summary={`${$t('Clients')} · ${$t('Statut')} = ${$t('Actif')}`}
          on={run.on === 0}
        />
        {STEPS.map((step, i) => {
          const at = i + 1
          const passed = run.passed > at
          return (
            <div key={step.id}>
              <Edge taken={run.passed >= at} />
              <FlowCard
                Icon={step.Icon}
                tone={step.tone}
                id={step.id}
                label={step.label}
                summary={passed ? step.done : step.summary}
                on={run.on === at}
                done={passed ? step.ms : undefined}
              >
                {step.id === 'e2' && answer !== '' && (
                  <span className="mt-2 block animate-in fade-in slide-in-from-top-1 rounded-lg border border-violet-500/20 bg-violet-500/5 px-2.5 py-2 text-[12px] leading-snug duration-300">
                    {answer}
                    {run.on === at && (
                      <span className="ml-px inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-violet-500" />
                    )}
                  </span>
                )}
              </FlowCard>
            </div>
          )
        })}
      </div>
    </>
  )
}

/** The line between two cards; the run draws it in the accent as it goes down. */
function Edge({ taken }: { readonly taken: boolean }) {
  return (
    <div className="relative h-4 w-[18.5rem] short:h-3">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/35" />
      <span
        className={cn(
          'absolute inset-y-0 left-1/2 w-0.5 origin-top -translate-x-1/2 bg-primary transition-transform duration-300',
          taken ? 'scale-y-100' : 'scale-y-0',
        )}
      />
    </div>
  )
}

function FlowCard({
  Icon,
  tone,
  overline,
  id,
  label,
  summary,
  on,
  done,
  children,
}: {
  readonly Icon: LucideIcon
  readonly tone: string
  readonly overline?: string
  readonly id?: string
  readonly label: string
  readonly summary: string
  readonly on: boolean
  /** How long the step took, once it has run. */
  readonly done?: number
  /** What the step produced, under it. */
  readonly children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'w-[18.5rem] rounded-xl border bg-background px-3 py-2 shadow-xs transition-shadow duration-300 short:py-1.5',
        on && 'ring-2 ring-primary/40',
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tone)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          {overline !== undefined && (
            <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {overline}
            </span>
          )}
          <span className="block truncate text-[13px] font-medium">{label}</span>
          <span
            key={summary}
            className="block animate-in fade-in truncate text-[11px] text-muted-foreground duration-300"
          >
            {summary}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 self-stretch justify-center">
          {id !== undefined && (
            <span className="font-mono text-[10px] text-muted-foreground/80">{id}</span>
          )}
          {on && id !== undefined && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          {done !== undefined && (
            <span className="flex animate-in zoom-in-75 fade-in items-center gap-1 text-[11px] text-emerald-600 duration-300 dark:text-emerald-400">
              <CircleCheck className="size-3.5" />
              <span className="tabular-nums">{$t('{ms} ms', { ms: done })}</span>
            </span>
          )}
        </span>
      </div>
      {children}
    </div>
  )
}

export function ProductGlimpse() {
  const stage = useRef<HTMLDivElement>(null)
  const cell = useRef<HTMLSpanElement>(null)
  const filterChip = useRef<HTMLSpanElement>(null)
  // Where the colleague heads, read when they set off: the rows are shorter on a short
  // screen, and the dashboard's filter sits where its title leaves it.
  const measure = useCallback((target: Aim): Spot | null => {
    const element = target === 'cell' ? cell.current : filterChip.current
    if (stage.current === null || element === null) return null
    const origin = stage.current.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    return target === 'cell'
      ? { x: box.left - origin.left + 44, y: box.top - origin.top + 18 }
      : { x: box.left - origin.left + box.width * 0.55, y: box.top - origin.top + box.height * 0.6 }
  }, [])
  const {
    scene,
    cycle,
    still,
    text,
    typing,
    clause,
    edited,
    editing,
    cursor,
    pressing,
    grown,
    lyon,
    run,
    answer,
  } = useScenes(measure)

  const rows = CLIENTS.map((c, i) => (i === EDITED ? { ...c, status: edited } : c))
  const hits = clause === null ? 0 : rows.filter((c) => matches(clause, c)).length

  return (
    <div className="relative hidden flex-col overflow-hidden border-l bg-surface lg:flex">
      <div className="px-[12%] pt-[max(2.5rem,7vh)] pb-8 short:pb-6">
        <h2 className="max-w-lg animate-in fade-in slide-in-from-bottom-2 text-[1.75rem] leading-tight font-semibold tracking-tight text-balance duration-500 fill-mode-both [animation-delay:120ms]">
          {$t('Organisez tout ce qui compte, en équipe.')}
        </h2>
        <p className="mt-3 max-w-lg animate-in fade-in slide-in-from-bottom-2 text-[15px] leading-relaxed text-muted-foreground duration-500 fill-mode-both [animation-delay:220ms]">
          {$t(
            'Suivi commercial, stock, recrutement, événements… Créez les bases dont vous avez besoin, reliez vos tables et partagez-les en quelques clics — sur une vraie base de données.',
          )}
        </p>
        <div aria-hidden="true">
          <SceneTabs scene={scene} cycle={cycle} still={still} />
        </div>
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
                <span className="block truncate font-semibold">{$t('Agence Lumen')}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {$t('Projet · 4 bases')}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </div>
            <div className="mx-2.5 mb-2 flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs text-muted-foreground">
              <Search className="size-3.5" />
              {$t('Filtrer les bases et les tables')}
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
                            'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-300',
                            j === 0 && scene === 'data' && 'bg-sidebar-accent font-medium',
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
            {/* The open base's screens, as the sidebar gathers them. */}
            <div className="mx-2 mt-4 animate-in fade-in rounded-lg border bg-background p-1 duration-300 fill-mode-both [animation-delay:900ms]">
              <div className="px-2 pt-1 pb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {$t('Base · {label}', { label: BASES[0].label })}
              </div>
              {(
                [
                  ['dashboard', LayoutDashboard, $t('Tableaux de bord')],
                  ['automation', Zap, $t('Automatisations')],
                ] as const
              ).map(([id, Icon, label]) => (
                <div
                  key={id}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-300',
                    scene === id && 'bg-sidebar-accent font-medium',
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-11 shrink-0 items-center gap-3 border-b px-3.5 text-[13px]">
              <PanelLeft className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">{$t('CRM')}</span>
              <span className="text-muted-foreground">/</span>
              <span
                key={scene}
                className="animate-in fade-in slide-in-from-bottom-1 font-medium duration-300"
              >
                {CRUMBS[scene]}
              </span>
              {/* Who else has the base open. */}
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

            <div ref={stage} className="relative min-h-0 flex-1">
              <Screen shown={scene === 'data'}>
                <div className="flex h-10 shrink-0 items-center gap-4 border-b px-3.5 text-[13px]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Table2 className="size-4 text-primary" />
                    {$t('Toutes les lignes')}
                  </span>
                  <span className="text-muted-foreground">{$t('Filtrer')}</span>
                  <span className="text-muted-foreground">{$t('Colonnes')}</span>
                  <span className="text-muted-foreground">{$t('Grouper')}</span>
                </div>

                <div className="relative w-max min-w-full bg-background text-[13px]">
                  <div
                    className={cn(
                      'grid h-9 items-center border-b bg-surface font-medium text-foreground',
                      COLUMNS,
                    )}
                  >
                    <span className="pl-3 text-xs text-muted-foreground">#</span>
                    <span className="flex items-center gap-1.5 px-2.5">
                      <FieldIcon kind="short_text" />
                      {$t('Nom')}
                    </span>
                    <span className="hidden items-center gap-1.5 px-2.5 xl:flex">
                      <FieldIcon kind="select" />
                      {$t('Secteur')}
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5">
                      <FieldIcon kind="select" />
                      {$t('Statut')}
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5">
                      <FieldIcon kind="short_text" />
                      {$t('Ville')}
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5">
                      <FieldIcon kind="email" />
                      {$t('E-mail')}
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
                        <span className="pl-3 text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </span>
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
                            option={{ label: $t(client.status), color: STATUSES[client.status] }}
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
                </div>
              </Screen>

              <Screen shown={scene === 'dashboard'}>
                <DashboardScreen
                  grown={grown}
                  lyon={lyon}
                  pressing={pressing}
                  filterRef={filterChip}
                />
              </Screen>

              <Screen shown={scene === 'automation'}>
                <AutomationScreen run={run} answer={answer} />
              </Screen>

              {/* The colleague's pointer, with their name, as basedb shows it live. */}
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
                  className={cn(
                    'size-4 drop-shadow-sm transition-transform duration-150',
                    pressing && 'scale-75',
                  )}
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

      {/* The same table, read in SQL — while the tables play. */}
      <div
        aria-hidden="true"
        className="absolute bottom-[7%] left-[6%] w-[22rem] short:bottom-[4%]"
      >
        <div
          className={cn(
            'transition-[opacity,translate] duration-500 ease-out',
            scene === 'data'
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-4 opacity-0',
          )}
        >
          <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 overflow-hidden rounded-xl border border-code-border bg-code text-code-foreground shadow-[0_24px_60px_-16px_rgb(0_0_0/0.45)] duration-500 fill-mode-both [animation-delay:650ms]">
            <div className="flex items-center gap-2 border-b border-code-border px-4 py-2.5 text-xs text-syn-comment short:hidden">
              <SquareTerminal className="size-3.5" />
              {$t('Console SQL')}
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
              {$tp(hits, 'ligne', 'lignes')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
