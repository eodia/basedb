'use client'

import {
  ChartColumnBig,
  Database,
  ExternalLink,
  FolderOpen,
  Loader2,
  RotateCw,
  SquareTerminal,
} from 'lucide-react'
import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AiStar } from '@/components/app/ai-star'
import { CopilotToggle } from '@/components/app/copilot-toggle'
import { SidebarToggle } from '@/components/app/sidebar'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { api, type DescribedBase } from '@/lib/api/client'
import { $t, locale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { useWorkspace } from '@/lib/store/workspace'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * « Tableaux de bord » — insights, beside basedb (chapter 19 §5), shown inside it: its dashboards,
 * its question builder and its SQL over every database Trino reaches, with basedb's own
 * tables among them. The person is signed in to insights by basedb (a one-minute link, then
 * insights' own session), with their rights there. What is built here — a dashboard, a
 * question — insights keeps; a question can feed a synced table of the base.
 */

/** Where the section opens: the dashboards and questions the person may read. */
const HOME = '/browse'

type Place = {
  readonly path: string
  readonly label: string
  readonly icon: ComponentType<{ readonly className?: string }>
  /** Where insights may land once at `path`: the base's data opens its source, schema kept. */
  readonly landings?: readonly string[]
}

/** The assistant's mark, as insights draws it. */
function AssistantIcon({ className }: { readonly className?: string }) {
  return <AiStar size={14} className={className} />
}

/** The places of insights: its dashboards first, then the base's data, a question or SQL over it. */
function placesOf(schema: string): readonly Place[] {
  const base = encodeURIComponent(schema)
  return [
    { path: HOME, label: $t('Tableaux de bord et questions'), icon: FolderOpen },
    {
      path: `/data?catalog=basedb&schema=${base}`,
      label: $t('Données'),
      icon: Database,
      landings: [`/data?schema=${base}`, '/data'],
    },
    {
      path: `/question/new?catalog=basedb&schema=${base}`,
      label: $t('Nouvelle question'),
      icon: ChartColumnBig,
    },
    { path: `/sql?catalog=basedb&schema=${base}`, label: $t('SQL'), icon: SquareTerminal },
    { path: '/assistant', label: $t('Assistant'), icon: AssistantIcon },
  ]
}

/** Whether insights, showing `current`, is at `place`: same page, the place's parameters kept. */
function isAt(current: string, place: string): boolean {
  const here = new URL(current, 'http://insights')
  const there = new URL(place, 'http://insights')
  const samePage =
    here.pathname === there.pathname ||
    (there.pathname !== '/' && here.pathname.startsWith(`${there.pathname}/`))
  return samePage && [...there.searchParams].every(([k, v]) => here.searchParams.get(k) === v)
}

/** The one place insights is at, the most precise when several match. */
function placeAt(current: string, places: readonly Place[]): string | null {
  let best: { path: string; weight: number } | null = null
  for (const p of places) {
    for (const at of [p.path, ...(p.landings ?? [])]) {
      if (!isAt(current, at)) continue
      const url = new URL(at, 'http://insights')
      const weight = [...url.searchParams].length * 1000 + url.pathname.length
      if (best === null || weight > best.weight) best = { path: p.path, weight }
    }
  }
  return best?.path ?? null
}

/**
 * What insights says of itself to the page it is embedded in: where it is, and its copilot —
 * open or not, offered or not (insights without AI has none).
 */
type InsightsMessage =
  | { readonly source: 'insights'; readonly type: 'location'; readonly path: string }
  | {
      readonly source: 'insights'
      readonly type: 'copilot'
      readonly open: boolean
      readonly available: boolean
    }

function isInsightsMessage(data: unknown): data is InsightsMessage {
  const m = data as Record<string, unknown> | null
  if (typeof m !== 'object' || m === null || m.source !== 'insights') return false
  if (m.type === 'copilot') return typeof m.open === 'boolean' && typeof m.available === 'boolean'
  return (
    m.type === 'location' &&
    typeof m.path === 'string' &&
    m.path.startsWith('/') &&
    !m.path.startsWith('//')
  )
}

export function InsightsPanel({ base }: { readonly base: DescribedBase }) {
  const [publicUrl, setPublicUrl] = useState<string | null | undefined>(undefined)
  const [src, setSrc] = useState<string | null>(null)
  const [place, setPlace] = useState(HOME)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const theme = useTheme((s) => s.theme)
  const signedIn = useRef(false)
  // insights said where it is at least once: it follows `navigate` and `theme` messages.
  const speaks = useRef(false)
  const frame = useRef<HTMLIFrameElement>(null)
  // The copilot switch here opens insights' own copilot, which knows its dashboards and
  // questions: the same switch as over the tables, kept in step with insights.
  const copilotOpen = useWorkspace((s) => s.copilotOpen)
  const [copilotOffered, setCopilotOffered] = useState(false)
  // Until insights first said where its copilot is, basedb's switch holds: open stays open.
  const copilotHeard = useRef(false)
  const places = useMemo(() => placesOf(base.name), [base.name])
  const active = placeAt(place, places)

  // Where insights lives, and the path it is served under (`/insights` beside basedb).
  const target = useMemo(() => {
    if (!publicUrl) return null
    try {
      const url = new URL(publicUrl)
      return { origin: url.origin, prefix: url.pathname.replace(/\/$/, '') }
    } catch {
      return null
    }
  }, [publicUrl])

  const post = useCallback(
    (message: Readonly<Record<string, unknown>>) => {
      if (target === null) return false
      const inner = frame.current?.contentWindow
      if (!inner) return false
      inner.postMessage({ source: 'host', ...message }, target.origin)
      return true
    },
    [target],
  )

  // The first page goes through basedb's link, which opens insights' session; the next ones
  // are a message to insights, which moves without reloading — or, if it does not listen,
  // its own addresses under that session.
  const open = useCallback(
    async (path: string, relink = false) => {
      setPlace(path)
      setError(null)
      if (signedIn.current && !relink && speaks.current && post({ type: 'navigate', path })) {
        return
      }
      setLoading(true)
      if (signedIn.current && !relink && publicUrl) {
        setSrc(`${publicUrl}${path}`)
        return
      }
      try {
        const { url } = await api.insightsLink(path, {
          embedded: true,
          theme: useTheme.getState().theme,
          lang: locale(),
        })
        signedIn.current = true
        speaks.current = false
        copilotHeard.current = false
        setSrc(url)
      } catch (e) {
        setError(messageFor(e))
        setLoading(false)
      }
    },
    [publicUrl, post],
  )

  useEffect(() => {
    api
      .insightsStatus()
      .then((s) => setPublicUrl(s.configured ? s.public_url : null))
      .catch((e) => {
        setPublicUrl(null)
        setError(messageFor(e))
      })
  }, [])
  useEffect(() => {
    if (publicUrl) void open(HOME, true)
  }, [publicUrl, open])

  // Where insights went — a link followed inside it — is where the section is.
  useEffect(() => {
    if (target === null) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== target.origin) return
      if (event.source !== frame.current?.contentWindow) return
      if (!isInsightsMessage(event.data)) return
      if (event.data.type === 'copilot') {
        setCopilotOffered(event.data.available)
        const wanted = useWorkspace.getState().copilotOpen
        if (!copilotHeard.current) {
          copilotHeard.current = true
          if (event.data.available && event.data.open !== wanted) {
            frame.current?.contentWindow?.postMessage(
              { source: 'host', type: 'copilot', open: wanted },
              target.origin,
            )
          }
        } else if (event.data.open !== wanted) {
          useWorkspace.getState().setCopilotOpen(event.data.open)
        }
        return
      }
      const path =
        target.prefix !== '' && event.data.path.startsWith(`${target.prefix}/`)
          ? event.data.path.slice(target.prefix.length)
          : event.data.path
      speaks.current = true
      setPlace(path)
      setLoading(false)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [target])

  // The switch moved here (or by Ctrl+J): insights' copilot follows.
  useEffect(() => {
    if (copilotHeard.current) post({ type: 'copilot', open: copilotOpen })
  }, [copilotOpen, post])

  // basedb's theme changes, insights' with it.
  useEffect(() => {
    if (speaks.current) post({ type: 'theme', theme })
  }, [theme, post])

  const openOutside = async () => {
    const tab = window.open('', '_blank')
    try {
      const { url } = await api.insightsLink(place)
      if (tab !== null) tab.location.href = url
    } catch (e) {
      tab?.close()
      setError(messageFor(e))
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <SidebarToggle />
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{$t('Tableaux de bord')}</span>
        {publicUrl && (
          <nav className="ml-3 flex min-w-0 items-center gap-0.5 overflow-x-auto">
            {places.map((p) => {
              const here = p.path === active
              return (
                <Hint key={p.path} label={p.label}>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={p.label}
                    className={cn('h-7 shrink-0 gap-1.5 text-xs', here && 'bg-accent')}
                    onClick={() => void open(p.path)}
                  >
                    <p.icon className="size-3.5" />
                    {/* The page shown keeps its name; the others, on a narrow screen, their icon. */}
                    <span className={cn(!here && 'hidden 2xl:inline')}>{p.label}</span>
                  </Button>
                </Hint>
              )
            })}
          </nav>
        )}
        <div className="flex-1" />
        {publicUrl && (
          <>
            <Hint label={$t('Se reconnecter à insights et recharger')}>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={$t('Recharger')}
                onClick={() => void open(place, true)}
              >
                <RotateCw className="size-3.5" />
              </Button>
            </Hint>
            <Hint label={$t('Ouvrir dans un nouvel onglet')}>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={$t('Ouvrir dans un nouvel onglet')}
                onClick={() => void openOutside()}
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </Hint>
          </>
        )}
        {publicUrl && copilotOffered && <CopilotToggle />}
      </header>
      <main className="relative min-h-0 flex-1">
        {publicUrl === undefined && (
          <Loader2 className="m-10 size-5 animate-spin text-muted-foreground" />
        )}
        {publicUrl === null && (
          <div className="mx-auto max-w-xl space-y-2 p-10 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{$t('insights n’est pas branché.')}</p>
            <p>
              {$t(
                'insights ajoute à basedb des tableaux de bord sur toutes vos bases, internes et externes (PostgreSQL, Oracle, SQL Server… via Trino). Votre administrateur le branche par BASEDB_INSIGHTS_URL, BASEDB_INSIGHTS_PUBLIC_URL et BASEDB_INSIGHTS_SECRET.',
              )}
            </p>
          </div>
        )}
        {error !== null && <p className="p-4 text-sm text-destructive">{error}</p>}
        {publicUrl && src !== null && (
          <>
            {loading && (
              <Loader2 className="absolute top-6 left-1/2 size-5 animate-spin text-muted-foreground" />
            )}
            <iframe
              ref={frame}
              key={src}
              src={src}
              title={$t('Tableaux de bord')}
              className="size-full border-0"
              onLoad={() => setLoading(false)}
              allow="clipboard-write; fullscreen; microphone"
            />
          </>
        )}
      </main>
    </div>
  )
}
