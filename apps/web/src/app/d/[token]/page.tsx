'use client'

import { ParameterControl } from '@/components/app/analytics/parameters'
import {
  type CitedRun,
  type CitedValue,
  TextBody,
  filterText,
  headlineText,
  useCitedResults,
} from '@/components/app/analytics/text-card'
import { VisualizationView } from '@/components/app/analytics/visualization'
import { Login } from '@/components/login'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { FormatBase } from '@/lib/analytics/format'
import {
  ApiError,
  type Field,
  type SharedDashboard,
  type SharedDashboardCard,
  api,
} from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { KnownMembers, useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_ROW_HEIGHT,
  type DashboardParameter,
  type ParameterValue,
  type QueryResult,
  parameterHasValue,
} from '@basedb/contracts'
import { Ban, Eye, Link2Off, Loader2, Lock } from 'lucide-react'
import { useParams } from 'next/navigation'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

/**
 * A shared dashboard — chapter 18 §2.5: the page someone opens from a link, to READ.
 *
 * Outside the application: its tabs, its filters and its cards where they were placed,
 * nothing to change and nothing to explore — a card runs by its identifier, and its
 * filters are tied by the kernel. On a narrow screen the cards stack in their order.
 * Framed by another site (`?embed=1`), the page has no header, and shows nothing unless
 * its sharing allows it.
 */

type Page =
  | { readonly kind: 'loading' }
  | { readonly kind: 'login' }
  | { readonly kind: 'ready'; readonly dashboard: SharedDashboard }
  | {
      readonly kind: 'refused'
      readonly title: string
      readonly text: string
      readonly icon: 'closed' | 'unknown' | 'locked'
    }

type Values = Readonly<Record<string, ParameterValue | null>>
type Choices = ReadonlyArray<{ value: string; label: string; color: string | null }>

const GAP = 12

const CLOSED: Readonly<Record<string, string>> = {
  inactive: $t('La personne qui l’a partagé a désactivé le lien.'),
  authority: $t('Il est suspendu : la personne qui l’a partagé ne voit plus cette base.'),
}

function refusal(error: unknown): Page {
  if (error instanceof ApiError && error.code === 'VIEW_SHARE_CLOSED') {
    const reason = typeof error.details.reason === 'string' ? error.details.reason : ''
    return {
      kind: 'refused',
      icon: 'closed',
      title: $t('Ce tableau de bord n’est plus partagé'),
      text: CLOSED[reason] ?? $t('Le lien a été fermé.'),
    }
  }
  if (error instanceof ApiError && error.code === 'VIEW_SHARE_RESTRICTED') {
    return {
      kind: 'refused',
      icon: 'locked',
      title: $t('Tableau de bord réservé'),
      text: $t(
        'Ce tableau de bord est réservé à certains groupes, dont vous ne faites pas partie.',
      ),
    }
  }
  if (error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND') {
    return {
      kind: 'refused',
      icon: 'unknown',
      title: $t('Lien introuvable'),
      text: $t(
        'Ce lien ne mène à aucun tableau de bord : il a pu être remplacé par un autre, ou retiré.',
      ),
    }
  }
  return {
    kind: 'refused',
    icon: 'unknown',
    title: $t('Tableau de bord indisponible'),
    text: messageFor(error),
  }
}

/** The fields the cards show, as the formatting of their values reads them. */
const formatBaseOf = (dashboard: SharedDashboard): FormatBase => ({
  tables: dashboard.tables.map((t) => ({
    id: t.id,
    fields: t.fields.map((f) => ({ ...f, description: null }) as Field),
  })),
})

const defaultsOf = (dashboard: SharedDashboard): Values =>
  Object.fromEntries(dashboard.parameters.map((p) => [p.id, p.default ?? null]))

export default function SharedDashboardPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState<Page>({ kind: 'loading' })
  // Read after the first paint: the server does not know whether the page is framed.
  const [frame, setFrame] = useState<{ embed: boolean; framed: boolean } | null>(null)
  const [values, setValues] = useState<Values>({})
  const [tab, setTab] = useState<string | null>(null)
  const [choices, setChoices] = useState<Readonly<Record<string, Choices>>>({})

  useEffect(() => useTheme.getState().initialize(), [])
  useEffect(() => {
    let framed = true
    try {
      framed = window.self !== window.top
    } catch {
      // A cross-origin parent refuses to be read: framed, then.
    }
    setFrame({ embed: new URLSearchParams(window.location.search).get('embed') === '1', framed })
  }, [])

  const load = useCallback(async () => {
    setPage({ kind: 'loading' })
    try {
      const dashboard = await api.sharedDashboard(token)
      document.title = dashboard.title
      setValues(defaultsOf(dashboard))
      setTab(dashboard.tabs[0]?.id ?? null)
      setPage({ kind: 'ready', dashboard })
      // The lists of the category filters, read once: the values the dashboard offers.
      for (const parameter of dashboard.parameters) {
        if (parameter.type !== 'category') continue
        api.sharedParameterValues(token, parameter.id).then(
          (list) => setChoices((c) => ({ ...c, [parameter.id]: list })),
          () => setChoices((c) => ({ ...c, [parameter.id]: [] })),
        )
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'AUTHENTICATION_REQUIRED') {
        setPage({ kind: 'login' })
        return
      }
      setPage(refusal(e))
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const dashboard = page.kind === 'ready' ? page.dashboard : null
  const base = useMemo(() => (dashboard === null ? null : formatBaseOf(dashboard)), [dashboard])
  // The labels of the category filters' values, for a text citing one.
  const labels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(choices).map(([id, list]) => [
          id,
          new Map(list.map((c) => [c.value, c.label])) as ReadonlyMap<string, string>,
        ]),
      ),
    [choices],
  )

  if (frame === null) return null

  // Framed by another site while its sharing does not allow it: nothing is shown.
  const refusedFrame =
    frame.framed && (page.kind !== 'ready' || !page.dashboard.can_embed) && page.kind !== 'loading'
  const bare = frame.embed && frame.framed

  if (page.kind === 'login' && !frame.framed) {
    return (
      <div className="relative">
        <p className="absolute top-4 right-0 left-0 z-10 mx-auto w-fit rounded-full border bg-background/90 px-4 py-1.5 text-sm shadow-xs">
          {$t('Connectez-vous pour lire ce tableau de bord.')}
        </p>
        <Login onSignedIn={() => void load()} />
      </div>
    )
  }

  const shown: Page =
    refusedFrame && page.kind === 'ready'
      ? {
          kind: 'refused',
          icon: 'locked',
          title: $t('Intégration non autorisée'),
          text: $t(
            'Ce tableau de bord ne peut pas être affiché dans une autre page. Ouvrez son lien directement.',
          ),
        }
      : page.kind === 'login'
        ? {
            kind: 'refused',
            icon: 'locked',
            title: $t('Connexion nécessaire'),
            text: $t(
              'Ce tableau de bord est réservé aux membres : ouvrez son lien directement pour vous connecter.',
            ),
          }
        : page

  const activeTab =
    dashboard === null || dashboard.tabs.length === 0
      ? null
      : dashboard.tabs.some((t) => t.id === tab)
        ? tab
        : (dashboard.tabs[0]?.id ?? null)
  const cards =
    dashboard === null
      ? []
      : dashboard.cards
          .filter((c) => dashboard.tabs.length === 0 || c.tab === activeTab)
          .sort((a, b) => a.y - b.y || a.x - b.x)
  // The filters that drive a card of the tab shown: the others would change nothing.
  const inUse = new Set(cards.flatMap((c) => c.filters))
  const parameters = dashboard?.parameters.filter((p) => inUse.has(p.id)) ?? []

  return (
    <TooltipProvider delayDuration={300}>
      <KnownMembers members={[]}>
        <div className="flex h-dvh flex-col bg-muted/30">
          {shown.kind === 'ready' && !bare && (
            <header className="shrink-0 border-b bg-background px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-lg font-semibold">{shown.dashboard.title}</h1>
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Eye className="size-3" />
                  {$t('Lecture seule')}
                </span>
                {shown.dashboard.reader !== null && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {$t('Connecté : {reader}', { reader: shown.dashboard.reader })}
                  </span>
                )}
              </div>
              {shown.dashboard.description !== null && shown.dashboard.description !== '' && (
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  {shown.dashboard.description}
                </p>
              )}
            </header>
          )}

          {shown.kind === 'loading' && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {shown.kind === 'refused' && (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-xs">
                {shown.icon === 'closed' ? (
                  <Ban className="mx-auto size-8 text-muted-foreground" />
                ) : shown.icon === 'locked' ? (
                  <Lock className="mx-auto size-8 text-muted-foreground" />
                ) : (
                  <Link2Off className="mx-auto size-8 text-muted-foreground" />
                )}
                <h1 className="mt-4 text-lg font-semibold">{shown.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{shown.text}</p>
              </div>
            </div>
          )}
          {shown.kind === 'ready' && base !== null && (
            <main className="min-h-0 flex-1 overflow-auto scroll-discret">
              <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6">
                {shown.dashboard.tabs.length > 1 && (
                  <div
                    role="tablist"
                    aria-label={$t('Onglets du tableau de bord')}
                    className="flex gap-1 overflow-x-auto overflow-y-hidden border-b"
                  >
                    {shown.dashboard.tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={t.id === activeTab}
                        onClick={() => setTab(t.id)}
                        className={cn(
                          '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors',
                          t.id === activeTab
                            ? 'border-primary font-medium text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {parameters.length > 0 && (
                  <div className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 bg-muted/95 px-1 py-2 backdrop-blur">
                    {parameters.map((parameter) => {
                      const list = choices[parameter.id]
                      return (
                        <ParameterControl
                          key={parameter.id}
                          base={null}
                          parameter={parameter}
                          value={values[parameter.id] ?? null}
                          source={null}
                          {...(parameter.type === 'category'
                            ? { given: { values: list ?? [], loading: list === undefined } }
                            : {})}
                          labels={new Map((list ?? []).map((c) => [c.value, c.label]))}
                          onChange={(value) => setValues((v) => ({ ...v, [parameter.id]: value }))}
                        />
                      )
                    })}
                  </div>
                )}

                <div
                  className="flex flex-col gap-3 md:grid md:grid-cols-24"
                  style={{ gridAutoRows: `${DASHBOARD_ROW_HEIGHT}px` }}
                >
                  {cards.map((card) => (
                    <SharedCard
                      key={card.id}
                      token={token}
                      card={card}
                      base={base}
                      values={values}
                      parameters={shown.dashboard.parameters}
                      labels={labels}
                    />
                  ))}
                </div>
                {cards.length === 0 && (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    {$t('Cet onglet est vide.')}
                  </p>
                )}
              </div>
            </main>
          )}

          {!bare && (
            <footer className="shrink-0 py-2 text-center text-xs text-muted-foreground">
              {$t('Tableau de bord partagé avec basedb')}
            </footer>
          )}
        </div>
      </KnownMembers>
    </TooltipProvider>
  )
}

/** A card where it was placed: on the grid from medium screens, stacked below. */
function SharedCard({
  token,
  card,
  base,
  values,
  parameters,
  labels,
}: {
  readonly token: string
  readonly card: SharedDashboardCard
  readonly base: FormatBase
  readonly values: Values
  readonly parameters: readonly DashboardParameter[]
  readonly labels: Readonly<Record<string, ReadonlyMap<string, string>>>
}) {
  const height = card.h * DASHBOARD_ROW_HEIGHT + (card.h - 1) * GAP
  const style = {
    '--cell-column': `${card.x + 1} / span ${card.w}`,
    '--cell-row': `${card.y + 1} / span ${card.h}`,
    '--cell-height': `${height}px`,
  } as CSSProperties
  const place =
    'h-[var(--cell-height)] min-w-0 md:h-auto md:[grid-column:var(--cell-column)] md:[grid-row:var(--cell-row)]'

  if (card.kind === 'heading') {
    return (
      <div className={cn(place, 'flex items-end border-b-2 border-border pb-1')} style={style}>
        <h2 className="truncate px-1 text-2xl font-semibold tracking-tight">{card.text}</h2>
      </div>
    )
  }
  return (
    <section
      className={cn(
        place,
        'flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background shadow-xs',
      )}
      style={style}
    >
      {card.kind === 'text' ? (
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 scroll-discret">
          {card.text !== undefined && card.text !== '' && (
            <SharedText
              token={token}
              card={card}
              base={base}
              values={values}
              parameters={parameters}
              labels={labels}
            />
          )}
        </div>
      ) : card.kind === 'embed' ? (
        <>
          <CardTitle title={card.title || $t('Page intégrée')} />
          <div className="min-h-0 flex-1 px-4 pb-4">
            {card.url !== undefined && /^https:\/\/[^/]+/.test(card.url) && (
              <iframe
                src={card.url}
                title={card.title || $t('Page intégrée')}
                // A page from elsewhere: its scripts run, but in an origin of its own.
                sandbox={$t(
                  'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox',
                )}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="size-full rounded-md border"
              />
            )}
          </div>
        </>
      ) : (
        <SharedQuestion token={token} card={card} base={base} values={values} />
      )}
    </section>
  )
}

/**
 * A text and the values it cites: each query run by the kernel under its name, on the
 * publisher's authority, again when one of its filters changes; a filter, as its control says.
 */
function SharedText({
  token,
  card,
  base,
  values,
  parameters,
  labels,
}: {
  readonly token: string
  readonly card: SharedDashboardCard
  readonly base: FormatBase
  readonly values: Values
  readonly parameters: readonly DashboardParameter[]
  readonly labels: Readonly<Record<string, ReadonlyMap<string, string>>>
}) {
  const members = useMembers()
  const variables = card.variables ?? []
  const runs = variables.flatMap((variable): CitedRun[] => {
    if (variable.kind !== 'question') return []
    const own = Object.fromEntries(
      variable.filters.map((id) => [id, parameterHasValue(values[id]) ? values[id] : null]),
    )
    return [
      {
        name: variable.name,
        key: JSON.stringify(own),
        run: (signal) => api.runSharedCard(token, card.id, own, signal, variable.name),
      },
    ]
  })
  const results = useCitedResults(runs)
  const value = useCallback<CitedValue>(
    (name) => {
      const variable = variables.find((v) => v.name === name)
      if (variable === undefined) return undefined
      if (variable.kind === 'parameter') {
        const parameter = parameters.find((p) => p.id === variable.parameter)
        if (parameter === undefined) return undefined
        return filterText(parameter, values[parameter.id], labels[parameter.id]) ?? '—'
      }
      const read = results.get(name)
      if (read === undefined) return null
      if (read.failed) return '—'
      return headlineText(read.result, variable.visualization, { base, members }) ?? '—'
    },
    [variables, parameters, values, labels, results, base, members],
  )
  return (
    <TextBody text={card.text ?? ''} rich={card.rich === true} value={value} className="text-sm" />
  )
}

function CardTitle({ title, busy = false }: { readonly title: string; readonly busy?: boolean }) {
  return (
    <header className="flex shrink-0 items-center gap-1 px-4 pt-3 pb-1">
      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>
      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </header>
  )
}

/** A question card: run by the kernel on the publisher's authority, again when its filters change. */
function SharedQuestion({
  token,
  card,
  base,
  values,
}: {
  readonly token: string
  readonly card: SharedDashboardCard
  readonly base: FormatBase
  readonly values: Values
}) {
  const [state, setState] = useState<{
    result: QueryResult | null
    error: string | null
    loading: boolean
  }>({ result: null, error: null, loading: true })
  // Only the values of the filters tied to the card: another filter changes nothing here.
  const own = useMemo(
    () =>
      Object.fromEntries(
        card.filters.map((id) => [id, parameterHasValue(values[id]) ? values[id] : null]),
      ),
    [card.filters, values],
  )
  const key = JSON.stringify(own)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says what the card reads
  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    api.runSharedCard(token, card.id, own, controller.signal).then(
      (result) => !controller.signal.aborted && setState({ result, error: null, loading: false }),
      (e) => {
        if (controller.signal.aborted) return
        const refused = e instanceof ApiError && (e.status === 404 || e.status === 403)
        setState({
          result: null,
          error: refused ? $t('Donnée inaccessible.') : messageFor(e),
          loading: false,
        })
      },
    )
    return () => controller.abort()
  }, [token, card.id, key])

  const visualization = card.visualization ?? { type: 'table' as const }
  return (
    <>
      <CardTitle
        title={card.title || $t('Question')}
        busy={state.loading && state.result !== null}
      />
      <div
        className={cn(
          'relative min-h-0 flex-1 px-4 pb-3',
          visualization.type === 'table' && 'px-0 pb-0',
        )}
      >
        {state.result === null && state.loading ? (
          <div className="flex size-full items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : state.error !== null ? (
          <p className="text-sm text-muted-foreground">{state.error}</p>
        ) : state.result !== null ? (
          <div className={cn('size-full', state.loading && 'opacity-60')}>
            <VisualizationView
              result={state.result}
              visualization={visualization}
              base={base}
              dense
              sorted={card.sorted}
            />
          </div>
        ) : null}
      </div>
    </>
  )
}
