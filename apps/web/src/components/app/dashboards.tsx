'use client'

import {
  DashboardCopilot,
  type DashboardScreen,
} from '@/components/app/analytics/dashboard-copilot'
import { DashboardView } from '@/components/app/analytics/dashboard-view'
import { QuestionDialog } from '@/components/app/analytics/question-dialog'
import { type QuestionDraft, QuestionView, draftOf } from '@/components/app/analytics/question-view'
import { VIZ_ICONS } from '@/components/app/analytics/viz-settings'
import { CopilotToggle } from '@/components/app/copilot-toggle'
import { SidebarToggle } from '@/components/app/sidebar'
import { audienceIcon } from '@/components/app/sql/query-dialog'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Hint } from '@/components/ui/tooltip'
import type { DashboardFocus } from '@/lib/address-bar'
import { type Dashboard, type DescribedBase, type Question, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { MembersProvider } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  Compass,
  Ellipsis,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Pencil,
  Plus,
  SquareTerminal,
  Trash2,
  Workflow,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * The dashboards and questions of a base — chapter 18, on screen. Everyone who sees the
 * base reads them, and explores from them, with their own rights: a card citing what they
 * cannot read says so and shows nothing. Anyone keeps questions of their own; whoever
 * builds the base arranges the dashboards and shares the questions.
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

export function DashboardsPanel({
  base,
  focus = null,
  onFocus,
  onOpenInTab,
}: {
  readonly base: DescribedBase
  /** What the address names: a dashboard, or a saved question — shown once they are read. */
  readonly focus?: DashboardFocus | null
  /** What the panel shows, for the address: told whenever it shows something else. */
  readonly onFocus?: (focus: DashboardFocus | null) => void
  /** A question opened in a tab of the workspace, among the tables. */
  readonly onOpenInTab?: (question: Question) => void
}) {
  return (
    <MembersProvider>
      <Panel base={base} focus={focus} onFocus={onFocus} onOpenInTab={onOpenInTab} />
    </MembersProvider>
  )
}

let opened = 0

function Panel({
  base,
  focus,
  onFocus,
  onOpenInTab,
}: {
  readonly base: DescribedBase
  readonly focus: DashboardFocus | null
  readonly onFocus?: ((focus: DashboardFocus | null) => void) | undefined
  readonly onOpenInTab?: ((question: Question) => void) | undefined
}) {
  const builds = base.actions.includes('manage_schema')
  const [dashboards, setDashboards] = useState<readonly Dashboard[] | null>(null)
  const [questions, setQuestions] = useState<readonly Question[]>([])
  /** A question of the list being renamed or shared, or deleted. */
  const [editing, setEditing] = useState<Question | null>(null)
  const [deleting, setDeleting] = useState<Question | null>(null)
  const [removing, setRemoving] = useState(false)
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

  // Read when the list is, not followed: the panel reads it again for another base, and the
  // address names what the panel shows once it has told it.
  const focusAtLoad = useRef(focus)
  focusAtLoad.current = focus
  useEffect(() => {
    setView({ kind: 'none' })
    // The dashboard the address names, else the one last opened here, else the first. A
    // question named is opened below, once the questions are read.
    const wanted = focusAtLoad.current
    void load().then((list) => {
      if (list === null || list.length === 0 || wanted?.kind === 'question') return
      const last = remembered(base.name)
      const pick =
        list.find((d) => d.id === wanted?.id) ?? list.find((d) => d.id === last) ?? list[0]
      if (pick !== undefined) setView({ kind: 'dashboard', id: pick.id })
    })
  }, [load, base.name])

  // Another address — the browser's back, a link: the panel shows what it names. Keyed on the
  // address alone, never on the view: a dashboard just clicked must not be taken back by the
  // address that has not heard of it yet.
  const focusKind = focus?.kind ?? null
  const focusId = focus?.id ?? null
  // The address last followed. A list read again — a dashboard just created, a question just
  // saved — is no new address: the panel may already show what was created, which the address
  // has not heard of yet, and following the old address again would send the two after each
  // other forever.
  const followed = useRef<string | null>(null)
  useEffect(() => {
    if (focusKind === null || focusId === null) {
      // An address naming nothing: the next one is followed, even the one before it.
      followed.current = null
      return
    }
    if (dashboards === null) return
    const address = `${focusKind}:${focusId}`
    if (followed.current === address) return
    const question = focusKind === 'question' ? questions.find((q) => q.id === focusId) : undefined
    // What it names may not be read yet: followed once it is.
    if (focusKind === 'dashboard' ? !dashboards.some((d) => d.id === focusId) : !question) return
    followed.current = address
    const key = opened + 1
    setView((current) => {
      if (focusKind === 'dashboard') {
        if (current.kind === 'dashboard' && current.id === focusId) return current
        return dashboards.some((d) => d.id === focusId)
          ? { kind: 'dashboard', id: focusId }
          : current
      }
      if (question === undefined) return current
      if (current.kind === 'question' && current.draft.id === focusId) return current
      return { kind: 'question', draft: draftOf(question), from: null, key }
    })
    opened = key
  }, [focusKind, focusId, dashboards, questions])

  // What the panel shows, told to the address. Nothing while the list is read: the address
  // still names what the panel is about to show.
  const tell = useRef(onFocus)
  tell.current = onFocus
  const shownKind =
    view.kind === 'dashboard'
      ? 'dashboard'
      : view.kind === 'question' && view.draft.id !== null
        ? 'question'
        : null
  const shownId =
    view.kind === 'dashboard' ? view.id : view.kind === 'question' ? view.draft.id : null
  const nothing = view.kind === 'none' && dashboards?.length === 0
  useEffect(() => {
    if (shownKind !== null && shownId !== null) tell.current?.({ kind: shownKind, id: shownId })
    else if (nothing || view.kind === 'question') tell.current?.(null)
  }, [shownKind, shownId, nothing, view.kind])

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

  /** A question gone from the list: its view closes, its tabs keep what they were editing. */
  const remove = async (question: Question) => {
    setRemoving(true)
    try {
      await api.deleteQuestion(base.name, question.id)
      useWorkspace.getState().detachQuestion(question.id)
      if (view.kind === 'question' && view.draft.id === question.id) {
        setView(view.from ?? { kind: 'none' })
      }
      setDeleting(null)
      await loadQuestions()
    } catch (e) {
      setError(messageFor(e))
      setDeleting(null)
    } finally {
      setRemoving(false)
    }
  }

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
        <Hint label={folded ? $t('Montrer la liste') : $t('Replier la liste')}>
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
            aria-expanded={!folded}
          >
            {folded ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </Hint>
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
                <Hint label={$t('Nouveau tableau de bord')}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    onClick={() => void create()}
                    aria-label={$t('Nouveau tableau de bord')}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </Hint>
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
              <DropdownMenu>
                <Hint label={$t('Nouvelle question')}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      aria-label={$t('Nouvelle question')}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </Hint>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => newQuestion('builder')}>
                    <Workflow /> {$t('Avec l’éditeur visuel')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => newQuestion('sql')}>
                    <SquareTerminal /> {$t('En SQL')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          >
            {questions.length === 0 && dashboards !== null && (
              <p className="px-2 text-xs text-muted-foreground">
                {$t('Aucune question enregistrée.')}
              </p>
            )}
            {questions.map((q) => (
              <QuestionEntry
                key={q.id}
                question={q}
                active={view.kind === 'question' && view.draft.id === q.id}
                onOpen={() => openQuestion(draftOf(q))}
                onOpenInTab={onOpenInTab === undefined ? undefined : () => onOpenInTab(q)}
                onEdit={() => setEditing(q)}
                onDelete={() => setDeleting(q)}
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
              question={view.draft.id === null ? null : (byId.get(view.draft.id) ?? null)}
              manages={builds}
              onBack={view.from === null ? undefined : () => setView(view.from ?? { kind: 'none' })}
              backLabel={view.from?.kind === 'dashboard' ? $t('Tableau de bord') : $t('Retour')}
              onSaved={(saved) => {
                useWorkspace.getState().renameQuestion(saved.id, saved.label)
                void loadQuestions()
              }}
              onDeleted={() => {
                if (view.draft.id !== null) useWorkspace.getState().detachQuestion(view.draft.id)
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

      <QuestionDialog
        open={editing !== null}
        base={base.name}
        manages={builds}
        question={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          useWorkspace.getState().renameQuestion(saved.id, saved.label)
          void loadQuestions()
        }}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => !next && !removing && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {$t('Supprimer la question « {label} » ?', { label: deleting?.label })}
            </DialogTitle>
            <DialogDescription>
              {deleting?.audience === 'personal'
                ? $t('Elle disparaît de vos questions.')
                : $t(
                    'Elle disparaît pour tous ceux qui la voient. Les tableaux de bord qui la montrent le diront.',
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={removing}>
              {$t('Annuler')}
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={() => deleting !== null && void remove(deleting)}
            >
              {removing ? $t('Suppression…') : $t('Supprimer la question')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * A saved question of the list: opened with a click; opened in a tab, renamed, shared or
 * deleted from its menu — a right click, or the button that shows on hover.
 */
function QuestionEntry({
  question,
  active,
  onOpen,
  onOpenInTab,
  onEdit,
  onDelete,
}: {
  readonly question: Question
  readonly active: boolean
  readonly onOpen: () => void
  readonly onOpenInTab: (() => void) | undefined
  readonly onEdit: () => void
  readonly onDelete: () => void
}) {
  const Chart = VIZ_ICONS[question.visualization.type]
  const Audience = audienceIcon(question.audience)
  const hint =
    question.audience === 'personal'
      ? $t('Question personnelle')
      : question.audience === 'base'
        ? $t('Question partagée avec toute la base')
        : $t('Question partagée avec des groupes')
  const entries = (kit: {
    readonly Item: typeof DropdownMenuItem | typeof ContextMenuItem
    readonly Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator
  }) => (
    <>
      <kit.Item onSelect={onOpen}>
        <FolderOpen className="size-4" />
        {$t('Ouvrir')}
      </kit.Item>
      {onOpenInTab !== undefined && (
        <kit.Item onSelect={onOpenInTab}>
          <PanelTop className="size-4" />
          {$t('Ouvrir dans un onglet')}
        </kit.Item>
      )}
      {question.editable && (
        <>
          <kit.Item onSelect={onEdit}>
            <Pencil className="size-4" />
            {$t('Nom et partage…')}
          </kit.Item>
          <kit.Separator />
          <kit.Item variant="destructive" onSelect={onDelete}>
            <Trash2 className="size-4" />
            {$t('Supprimer')}
          </kit.Item>
        </>
      )}
    </>
  )
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/question relative">
          <Hint label={hint}>
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                'flex w-full items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-left text-sm',
                active
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Chart className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{question.label}</span>
              {question.audience !== 'base' && (
                <Audience
                  className="size-3 shrink-0 text-muted-foreground/70 transition-opacity group-hover/question:opacity-0"
                  aria-hidden
                />
              )}
            </button>
          </Hint>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={$t('Actions sur la question {label}', { label: question.label })}
                className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/question:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <Ellipsis className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {entries({ Item: DropdownMenuItem, Separator: DropdownMenuSeparator })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {entries({ Item: ContextMenuItem, Separator: ContextMenuSeparator })}
      </ContextMenuContent>
    </ContextMenu>
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
