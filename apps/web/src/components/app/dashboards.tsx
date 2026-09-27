'use client'

import {
  DashboardCopilot,
  type DashboardScreen,
} from '@/components/app/analytics/dashboard-copilot'
import { DashboardView } from '@/components/app/analytics/dashboard-view'
import { type QuestionDraft, QuestionView, draftOf } from '@/components/app/analytics/question-view'
import { VIZ_ICONS } from '@/components/app/analytics/viz-settings'
import { CopilotToggle } from '@/components/app/copilot-toggle'
import { SidebarToggle } from '@/components/app/sidebar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Dashboard, type DescribedBase, type Question, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { MembersProvider } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  Compass,
  LayoutDashboard,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  SquareTerminal,
  Workflow,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

/**
 * The dashboards and questions of a base — chapter 18, on screen. Everyone who sees the
 * base reads them, and explores from them, with their own rights: a card citing what they
 * cannot read says so and shows nothing. Whoever builds the base arranges the dashboards
 * and saves the questions.
 */

type View =
  | { readonly kind: 'dashboard'; readonly id: string }
  | {
      readonly kind: 'question'
      readonly draft: QuestionDraft
      readonly from: View | null
      readonly key: number
    }
  | { readonly kind: 'none' }

const LAST_KEY = 'basedb.dashboard.v1'
/** Whether the list of dashboards and questions is folded away — a convenience, per browser. */
const RAIL_KEY = 'basedb.dashboard.rail.v1'

function railFolded(): boolean {
  try {
    return window.localStorage.getItem(RAIL_KEY) === 'folded'
  } catch {
    return false
  }
}

function rememberRail(folded: boolean): void {
  try {
    if (folded) window.localStorage.setItem(RAIL_KEY, 'folded')
    else window.localStorage.removeItem(RAIL_KEY)
  } catch {
    // A private window: the list simply opens unfolded next time.
  }
}

function remembered(base: string): string | null {
  try {
    return window.localStorage.getItem(`${LAST_KEY}.${base}`)
  } catch {
    return null
  }
}

function remember(base: string, id: string): void {
  try {
    window.localStorage.setItem(`${LAST_KEY}.${base}`, id)
  } catch {
    // A private window: the last dashboard is simply not remembered.
  }
}

export function DashboardsPanel({ base }: { readonly base: DescribedBase }) {
  return (
    <MembersProvider>
      <Panel base={base} />
    </MembersProvider>
  )
}

let opened = 0

function Panel({ base }: { readonly base: DescribedBase }) {
  const builds = base.actions.includes('manage_schema')
  const [dashboards, setDashboards] = useState<readonly Dashboard[] | null>(null)
  const [questions, setQuestions] = useState<readonly Question[]>([])
  const [view, setView] = useState<View>({ kind: 'none' })
  const [error, setError] = useState<string | null>(null)
  const [folded, setFolded] = useState(false)
  // The copilot stays open from one section to the other: the same switch as the tables'.
  const copilotOpen = useWorkspace((s) => s.copilotOpen)
  const setCopilotOpen = useWorkspace((s) => s.setCopilotOpen)
  const [screen, setScreen] = useState<DashboardScreen>({ tab: null, values: {} })
  const [incoming, setIncoming] = useState<{ seq: number; values: DashboardScreen['values'] }>()
  useEffect(() => setFolded(railFolded()), [])
  const fold = (next: boolean) => {
    setFolded(next)
    rememberRail(next)
  }

  const loadQuestions = useCallback(async () => {
    try {
      setQuestions(await api.questions(base.name))
    } catch (e) {
      setError(messageFor(e))
    }
  }, [base.name])

  const load = useCallback(async () => {
    try {
      const [list, saved] = await Promise.all([api.dashboards(base.name), api.questions(base.name)])
      setDashboards(list)
      setQuestions(saved)
      setError(null)
      return list
    } catch (e) {
      setError(messageFor(e))
      return null
    }
  }, [base.name])

  useEffect(() => {
    setView({ kind: 'none' })
    void load().then((list) => {
      if (list === null || list.length === 0) return
      const last = remembered(base.name)
      const pick = list.find((d) => d.id === last) ?? list[0]
      if (pick !== undefined) setView({ kind: 'dashboard', id: pick.id })
    })
  }, [load, base.name])

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  const openDashboard = (id: string) => {
    remember(base.name, id)
    setView({ kind: 'dashboard', id })
  }
  const openQuestion = (draft: QuestionDraft, from: View | null = null) => {
    opened += 1
    setView({ kind: 'question', draft, from, key: opened })
  }
  const newQuestion = (kind: 'builder' | 'sql') =>
    openQuestion({
      id: null,
      label: '',
      description: null,
      query: kind === 'sql' ? { kind: 'sql', sql: '' } : null,
      visualization: null,
    })

  const create = async () => {
    try {
      const created = await api.createDashboard(base.name, {
        label: $t('Tableau de bord {value}', { value: (dashboards?.length ?? 0) + 1 }),
        cards: [],
      })
      await load()
      openDashboard(created.id)
    } catch (e) {
      setError(messageFor(e))
    }
  }

  const dashboard =
    view.kind === 'dashboard' ? (dashboards?.find((d) => d.id === view.id) ?? null) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden md:inline-flex"
          onClick={() => fold(!folded)}
          aria-label={
            folded
              ? $t('Montrer la liste des tableaux et des questions')
              : $t('Replier la liste des tableaux et des questions')
          }
          title={folded ? $t('Montrer la liste') : $t('Replier la liste')}
          aria-expanded={!folded}
        >
          {folded ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{$t('Tableaux de bord')}</span>
        <div className="flex-1" />
        <CopilotToggle />
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'hidden w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-surface p-2 scroll-discret',
            !folded && 'md:flex',
          )}
        >
          <Group
            title={$t('Tableaux de bord')}
            action={
              builds ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  onClick={() => void create()}
                  aria-label={$t('Nouveau tableau de bord')}
                  title={$t('Nouveau tableau de bord')}
                >
                  <Plus className="size-3.5" />
                </Button>
              ) : null
            }
          >
            {dashboards === null && error === null && (
              <Loader2 className="m-2 size-4 animate-spin text-muted-foreground" />
            )}
            {dashboards?.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">{$t('Aucun tableau de bord.')}</p>
            )}
            {dashboards?.map((d) => (
              <Entry
                key={d.id}
                icon={LayoutDashboard}
                label={d.label}
                active={view.kind === 'dashboard' && view.id === d.id}
                onClick={() => openDashboard(d.id)}
              />
            ))}
          </Group>
          <Group
            title={$t('Questions')}
            action={
              builds ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      aria-label={$t('Nouvelle question')}
                      title={$t('Nouvelle question')}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => newQuestion('builder')}>
                      <Workflow /> {$t('Avec l’éditeur visuel')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => newQuestion('sql')}>
                      <SquareTerminal /> {$t('En SQL')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null
            }
          >
            {questions.length === 0 && dashboards !== null && (
              <p className="px-2 text-xs text-muted-foreground">
                {$t('Aucune question enregistrée.')}
              </p>
            )}
            {questions.map((q) => (
              <Entry
                key={q.id}
                icon={VIZ_ICONS[q.visualization.type]}
                label={q.label}
                active={view.kind === 'question' && view.draft.id === q.id}
                onClick={() => openQuestion(draftOf(q))}
              />
            ))}
          </Group>
          <div className="mt-auto border-t pt-2">
            <Entry
              icon={Compass}
              label={$t('Explorer les données')}
              active={false}
              onClick={() => newQuestion('builder')}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {error !== null && <p className="m-4 text-sm text-destructive">{error}</p>}
          {view.kind === 'question' && (
            <QuestionView
              key={view.key}
              base={base}
              initial={view.draft}
              builds={builds}
              onBack={view.from === null ? undefined : () => setView(view.from ?? { kind: 'none' })}
              backLabel={view.from?.kind === 'dashboard' ? $t('Tableau de bord') : $t('Retour')}
              onSaved={() => void loadQuestions()}
              onDeleted={() => {
                void loadQuestions()
                setView(view.from ?? { kind: 'none' })
              }}
            />
          )}
          {view.kind === 'dashboard' && dashboard !== null && (
            <DashboardView
              base={base}
              dashboard={dashboard}
              questions={byId}
              builds={builds}
              onSaved={(saved) =>
                setDashboards((list) => list?.map((d) => (d.id === saved.id ? saved : d)) ?? list)
              }
              onDeleted={() => {
                void load().then((list) => {
                  const next = list?.[0]
                  setView(
                    next === undefined ? { kind: 'none' } : { kind: 'dashboard', id: next.id },
                  )
                })
              }}
              onDuplicated={(copy) => {
                void load().then(() => openDashboard(copy.id))
              }}
              onExplore={(draft) => openQuestion(draft, view)}
              onQuestionsChanged={loadQuestions}
              onScreen={setScreen}
              incoming={incoming}
            />
          )}
          {view.kind === 'none' && dashboards !== null && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
              <LayoutDashboard className="size-8" />
              <p className="max-w-sm">
                {builds
                  ? $t(
                      'Rassemblez sur une page les chiffres, les graphiques et les tableaux que chacun consulte, sous des filtres communs.',
                    )
                  : $t(
                      'Aucun tableau de bord dans cette base. Vous pouvez explorer ses données avec vos droits.',
                    )}
              </p>
              <div className="flex gap-2">
                {builds && (
                  <Button size="sm" onClick={() => void create()}>
                    {$t('Créer un tableau de bord')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => newQuestion('builder')}>
                  <Compass className="size-4" /> {$t('Explorer les données')}
                </Button>
              </div>
            </div>
          )}
          {/* On a narrow screen, or the list folded, the dashboards in a strip under them. */}
          {view.kind !== 'question' && dashboards !== null && dashboards.length > 1 && (
            <div
              className={cn(
                'flex gap-1 overflow-x-auto border-t px-2 py-1.5',
                !folded && 'md:hidden',
              )}
            >
              {dashboards.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDashboard(d.id)}
                  className={cn(
                    'shrink-0 rounded-md px-2.5 py-1 text-sm',
                    view.kind === 'dashboard' && view.id === d.id
                      ? 'bg-accent font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {copilotOpen && (
          <DashboardCopilot
            base={base}
            dashboard={dashboard}
            screen={dashboard === null ? { tab: null, values: {} } : screen}
            builds={builds}
            onClose={() => setCopilotOpen(false)}
            onOpenQuestion={(draft) => openQuestion(draft, view)}
            onSaved={(saved) =>
              setDashboards((list) => list?.map((d) => (d.id === saved.id ? saved : d)) ?? list)
            }
            onCreated={(created) => {
              void load().then(() => openDashboard(created.id))
            }}
            onSetFilters={(values) => setIncoming((was) => ({ seq: (was?.seq ?? 0) + 1, values }))}
          />
        )}
      </div>
    </div>
  )
}

function Group({
  title,
  action,
  children,
}: { readonly title: string; readonly action: ReactNode; readonly children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Entry({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  readonly icon: typeof LayoutDashboard
  readonly label: string
  readonly active: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
        active
          ? 'bg-accent font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}
