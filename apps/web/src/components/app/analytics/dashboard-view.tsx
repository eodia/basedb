'use client'

import 'react-grid-layout/css/styles.css'
import './grid.css'
import { type DashboardFilterAction, DrillMenu } from '@/components/app/analytics/drill-menu'
import { useColumnValues } from '@/components/app/analytics/filter-editor'
import {
  PARAMETER_ICONS,
  ParameterControl,
  ParameterSettings,
  type ValueSource,
} from '@/components/app/analytics/parameters'
import { type QuestionDraft, QuestionView, draftOf } from '@/components/app/analytics/question-view'
import { ShareDashboardDialog } from '@/components/app/analytics/share-dashboard-dialog'
import { type DrillEvent, VisualizationView } from '@/components/app/analytics/visualization'
import { VIZ_ICONS } from '@/components/app/analytics/viz-settings'
import { MarkdownView } from '@/components/app/markdown-text'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  PARAMETER_LABELS,
  type PointFilter,
  autoMap,
  cardQuestion,
  cardsTaking,
  constraintsFor,
  defaultValues,
  mappingCandidates,
  newId,
  placed,
  pointConstraints,
  pointFilterOf,
  sameTarget,
  sizeFor,
  withConstraints,
  withMapping,
} from '@/lib/analytics/dashboard'
import { valueText } from '@/lib/analytics/format'
import { autoVisualization, columnsOf, findColumn, tableOf } from '@/lib/analytics/model'
import { ApiError, type Dashboard, type DescribedBase, type Question, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { weekStart } from '@/lib/preferences'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_COLUMNS,
  DASHBOARD_ROW_HEIGHT,
  type DashboardCard,
  type DashboardParameter,
  type DashboardTab,
  PARAMETER_TYPES,
  type ParameterType,
  type ParameterValue,
  type QueryResult,
  type ResultColumn,
  type Visualization,
  periodExpression,
  sameColumnRef,
} from '@basedb/contracts'
import {
  AppWindow,
  Copy,
  Ellipsis,
  GripVertical,
  Heading,
  ListFilter,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  SquareTerminal,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import ReactGridLayout, {
  type Layout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'

/**
 * A dashboard — chapter 18 §4: cards on a grid of 24 columns, in tabs, under filters that
 * drive the cards they are tied to. Everyone who sees the base reads it, each card with
 * their own rights; whoever builds the base arranges it — moves and sizes the cards, adds
 * questions, headings, texts and pages, writes filters and ties them — and saves it whole.
 */

interface Content {
  readonly label: string
  readonly description: string | null
  readonly tabs: readonly DashboardTab[]
  readonly cards: readonly DashboardCard[]
  readonly parameters: readonly DashboardParameter[]
}

const contentOf = (d: Dashboard): Content => ({
  label: d.label,
  description: d.description,
  tabs: d.tabs,
  cards: d.cards,
  parameters: d.parameters,
})

type Values = Record<string, ParameterValue | null>

export function DashboardView({
  base,
  dashboard,
  questions,
  builds,
  onSaved,
  onDeleted,
  onDuplicated,
  onExplore,
  onQuestionsChanged,
  onScreen,
  incoming,
}: {
  readonly base: DescribedBase
  readonly dashboard: Dashboard
  readonly questions: ReadonlyMap<string, Question>
  readonly builds: boolean
  readonly onSaved: (dashboard: Dashboard) => void
  readonly onDeleted: () => void
  readonly onDuplicated: (dashboard: Dashboard) => void
  /** Opens a question derived from a card — a click on its title or on one of its points. */
  readonly onExplore: (draft: QuestionDraft) => void
  readonly onQuestionsChanged: () => Promise<void>
  /** What is on screen — the tab, the filters' values —, for the copilot beside it. */
  readonly onScreen?: (screen: { tab: string | null; values: Values }) => void
  /** Values for the filters, set from outside — the copilot's; `seq` says a new request. */
  readonly incoming?: { readonly seq: number; readonly values: Readonly<Values> }
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Content>(() => contentOf(dashboard))
  const content = editing ? draft : contentOf(dashboard)
  const [tab, setTab] = useState<string | null>(dashboard.tabs[0]?.id ?? null)
  const [values, setValues] = useState<Values>(() => defaultValues(dashboard.parameters))
  /** Filters set by a click on a point, on every card that reads the same column. */
  const [pointFilters, setPointFilters] = useState<readonly PointFilter[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [editor, setEditor] = useState<{ card: string | null; draft: QuestionDraft } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: a dashboard opened afresh starts from its defaults
  useEffect(() => {
    setEditing(false)
    setSelected(null)
    setTab(dashboard.tabs[0]?.id ?? null)
    setValues(defaultValues(dashboard.parameters))
    setPointFilters([])
  }, [dashboard.id])

  // A filter added since — by the copilot, from a card — starts from its default.
  useEffect(() => {
    setValues((v) => {
      const missing = dashboard.parameters.filter((p) => !Object.hasOwn(v, p.id))
      if (missing.length === 0) return v
      return { ...v, ...Object.fromEntries(missing.map((p) => [p.id, p.default ?? null])) }
    })
  }, [dashboard.parameters])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `seq` says a new request
  useEffect(() => {
    if (incoming !== undefined) setValues((v) => ({ ...v, ...incoming.values }))
  }, [incoming?.seq])

  const activeTab =
    content.tabs.length === 0
      ? null
      : content.tabs.some((t) => t.id === tab)
        ? tab
        : (content.tabs[0]?.id ?? null)
  const cards = content.cards.filter((c) => content.tabs.length === 0 || c.tab === activeTab)

  useEffect(() => {
    onScreen?.({ tab: activeTab, values })
  }, [onScreen, activeTab, values])

  const update = (patch: Partial<Content>) => setDraft((d) => ({ ...d, ...patch }))
  /** A click's filter: another value of the same column replaces the one there was. */
  const setPoint = (filter: PointFilter) =>
    setPointFilters((list) => [
      ...list.filter((f) => f.table !== filter.table || f.field !== filter.field),
      filter,
    ])
  const setCard = (id: string, change: (card: DashboardCard) => DashboardCard) =>
    setDraft((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? change(c) : c)) }))
  const addCard = (
    card: Omit<DashboardCard, 'id' | 'tab' | 'x' | 'y' | 'w' | 'h'>,
    size = sizeFor(card.kind),
  ) =>
    setDraft((d) => ({
      ...d,
      cards: [
        ...d.cards,
        { ...card, id: newId('c'), tab: activeTab, ...placed(d.cards, activeTab, size) },
      ],
    }))

  const startEditing = () => {
    setDraft(contentOf(dashboard))
    setEditing(true)
    setError(null)
  }
  const cancel = () => {
    setEditing(false)
    setSelected(null)
    setError(null)
  }
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = await api.updateDashboard(base.name, dashboard.id, {
        label: draft.label.trim() || dashboard.label,
        description: draft.description?.trim() || null,
        tabs: draft.tabs,
        cards: draft.cards,
        parameters: draft.parameters,
      })
      setEditing(false)
      setSelected(null)
      onSaved(saved)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const addParameter = (type: ParameterType) => {
    const parameter: DashboardParameter = {
      id: newId('p'),
      label: PARAMETER_LABELS[type],
      type,
      ...(type === 'temporal_unit' ? { default: 'month' } : {}),
    }
    setDraft((d) => ({
      ...d,
      parameters: [...d.parameters, parameter],
      cards: autoMap(d.cards, parameter, base, questions),
    }))
    setSelected(parameter.id)
  }

  const addTab = () => {
    if (draft.tabs.length === 0) {
      const first = { id: newId('t'), label: $t('Onglet 1') }
      const second = { id: newId('t'), label: $t('Onglet 2') }
      setDraft((d) => ({
        ...d,
        tabs: [first, second],
        cards: d.cards.map((c) => ({ ...c, tab: first.id })),
      }))
      setTab(second.id)
      return
    }
    const next = { id: newId('t'), label: $t('Onglet {value}', { value: draft.tabs.length + 1 }) }
    update({ tabs: [...draft.tabs, next] })
    setTab(next.id)
  }
  const removeTab = (id: string) => {
    const rest = draft.tabs.filter((t) => t.id !== id)
    const target = rest[0]?.id ?? null
    const bottom = draft.cards
      .filter((c) => c.tab === target)
      .reduce((m, c) => Math.max(m, c.y + c.h), 0)
    update({
      tabs: rest.length === 1 ? [] : rest,
      cards: draft.cards.map((c) =>
        c.tab === id
          ? { ...c, tab: rest.length === 1 ? null : target, y: c.y + bottom }
          : rest.length === 1
            ? { ...c, tab: null }
            : c,
      ),
    })
    setTab(target)
  }

  // Where a filter's values come from: the first card it is tied to on a column.
  const sourceOf = (parameter: DashboardParameter): ValueSource | null => {
    for (const card of content.cards) {
      const mapping = (card.mappings ?? []).find((m) => m.parameter === parameter.id)
      if (mapping === undefined || !('column' in mapping.target)) continue
      const question = cardQuestion(card, questions)
      if (question === null || question.query.kind !== 'builder') continue
      const column = findColumn(columnsOf(base, question.query), mapping.target.column)
      if (column !== undefined) return { query: question.query, column }
    }
    return null
  }

  const selectedParameter = content.parameters.find((p) => p.id === selected) ?? null
  const layout: Layout = cards.map((c) => ({
    i: c.id,
    x: c.x,
    y: c.y,
    w: c.w,
    h: c.h,
    minW: c.kind === 'heading' ? 4 : 2,
    minH: c.kind === 'heading' ? 1 : 2,
  }))

  const onLayout = (next: Layout) => {
    if (!editing) return
    setDraft((d) => {
      let changed = false
      const cardsNext = d.cards.map((c) => {
        const item = next.find((l) => l.i === c.id)
        if (
          item === undefined ||
          (item.x === c.x && item.y === c.y && item.w === c.w && item.h === c.h)
        )
          return c
        changed = true
        return { ...c, x: item.x, y: item.y, w: item.w, h: item.h }
      })
      return changed ? { ...d, cards: cardsNext } : d
    })
  }

  const { width, containerRef, mounted } = useContainerWidth()
  // A phone reads the cards one under the other; a dashboard being arranged keeps its grid.
  const narrow = !editing && width > 0 && width < 560

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {editing && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-primary/5 px-4 py-2">
            <span className="mr-2 text-sm font-medium">
              {$t('Vous modifiez ce tableau de bord')}
            </span>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> {$t('Question')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => addCard({ kind: 'heading', text: $t('Titre de section') })}
            >
              <Heading className="size-4" /> {$t('Titre')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => addCard({ kind: 'text', text: '' })}
            >
              <Type className="size-4" /> {$t('Texte')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => addCard({ kind: 'embed', url: 'https://' })}
            >
              <AppWindow className="size-4" /> {$t('Page intégrée')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ListFilter className="size-4" /> {$t('Filtre')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PARAMETER_TYPES.map((type) => {
                  const Icon = PARAMETER_ICONS[type]
                  return (
                    <DropdownMenuItem key={type} onSelect={() => addParameter(type)}>
                      <Icon /> {PARAMETER_LABELS[type]}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={addTab}>
              <Plus className="size-4" /> {$t('Onglet')}
            </Button>
            <div className="flex-1" />
            {error !== null && <span className="text-sm text-destructive">{error}</span>}
            <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
              {$t('Annuler')}
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {$t('Enregistrer')}
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 scroll-discret">
          <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 md:px-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {editing ? (
                  <div className="space-y-1.5">
                    <Input
                      value={draft.label}
                      onChange={(e) => update({ label: e.target.value })}
                      aria-label={$t('Nom du tableau de bord')}
                      className="h-10 max-w-xl text-xl font-semibold"
                    />
                    <Input
                      value={draft.description ?? ''}
                      onChange={(e) => update({ description: e.target.value })}
                      placeholder={$t('Description (facultative)')}
                      aria-label={$t('Description du tableau de bord')}
                      className="h-8 max-w-xl text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="truncate text-2xl font-semibold tracking-tight">
                      {dashboard.label}
                    </h1>
                    {dashboard.description !== null && dashboard.description !== '' && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {dashboard.description}
                      </p>
                    )}
                  </>
                )}
              </div>
              {!editing && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={$t('Actualiser')}
                    title={$t('Actualiser')}
                    onClick={() => setRefresh((r) => r + 1)}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  {builds && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setSharing(true)}
                      >
                        <Share2 className="size-3.5" /> {$t('Partager')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={startEditing}
                      >
                        <Pencil className="size-3.5" /> {$t('Modifier')}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={$t('Plus d’actions')}>
                            <Ellipsis className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={async () => {
                              try {
                                const copy = await api.createDashboard(base.name, {
                                  label: `${dashboard.label} (copie)`,
                                  description: dashboard.description,
                                  tabs: dashboard.tabs,
                                  cards: dashboard.cards,
                                  parameters: dashboard.parameters,
                                })
                                onDuplicated(copy)
                              } catch (e) {
                                setError(messageFor(e))
                              }
                            }}
                          >
                            <Copy /> {$t('Dupliquer')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={async () => {
                              if (
                                !window.confirm(
                                  $t('Supprimer le tableau de bord « {label} » ?', {
                                    label: dashboard.label,
                                  }),
                                )
                              )
                                return
                              try {
                                await api.deleteDashboard(base.name, dashboard.id)
                                onDeleted()
                              } catch (e) {
                                setError(messageFor(e))
                              }
                            }}
                          >
                            <Trash2 /> {$t('Supprimer')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              )}
            </div>

            {content.tabs.length > 0 && (
              <nav
                className="flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b scroll-discret"
                aria-label={$t('Onglets du tableau de bord')}
              >
                {content.tabs.map((t) => (
                  <TabButton
                    key={t.id}
                    tab={t}
                    active={t.id === activeTab}
                    editing={editing}
                    onSelect={() => setTab(t.id)}
                    onRename={(label) =>
                      update({ tabs: draft.tabs.map((x) => (x.id === t.id ? { ...x, label } : x)) })
                    }
                    onRemove={() => removeTab(t.id)}
                  />
                ))}
              </nav>
            )}

            {(content.parameters.length > 0 || editing || pointFilters.length > 0) && (
              <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-lg bg-background/95 px-1 py-1 shadow-[0_6px_12px_-10px_rgb(0_0_0/0.25)] backdrop-blur">
                {content.parameters.map((p) => (
                  <ParameterSlot
                    key={p.id}
                    base={base}
                    parameter={p}
                    value={values[p.id] ?? null}
                    source={sourceOf(p)}
                    onChange={(value) => setValues((v) => ({ ...v, [p.id]: value }))}
                    selected={editing && selected === p.id}
                    onSelect={
                      editing ? () => setSelected((s) => (s === p.id ? null : p.id)) : undefined
                    }
                  />
                ))}
                {!editing &&
                  pointFilters.map((f) => (
                    <PointFilterChip
                      key={`${f.table}:${f.field}`}
                      filter={f}
                      onRemove={() => setPointFilters((list) => list.filter((x) => x !== f))}
                    />
                  ))}
                {editing && content.parameters.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {$t(
                      'Ajoutez un filtre depuis la barre ci-dessus : il pilotera les cartes que vous lui reliez.',
                    )}
                  </p>
                )}
              </div>
            )}

            <div ref={containerRef} className="dashboard-grid">
              {cards.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                  <p>
                    {editing
                      ? $t('Ajoutez une question, un titre, un texte ou une page.')
                      : $t('Ce tableau de bord est vide.')}
                  </p>
                  {editing && (
                    <Button size="sm" onClick={() => setAdding(true)}>
                      <Plus className="size-4" /> {$t('Ajouter une question')}
                    </Button>
                  )}
                  {!editing && builds && (
                    <Button size="sm" variant="outline" onClick={startEditing}>
                      <Pencil className="size-3.5" /> {$t('Le remplir')}
                    </Button>
                  )}
                </div>
              )}
              {mounted && cards.length > 0 && narrow && (
                <div className="space-y-3">
                  {[...cards]
                    .sort((a, b) => a.y - b.y || a.x - b.x)
                    .map((card) => (
                      <div
                        key={card.id}
                        style={{ height: card.h * DASHBOARD_ROW_HEIGHT + (card.h - 1) * 12 }}
                      >
                        <CardFrame
                          base={base}
                          card={card}
                          content={content}
                          values={values}
                          questions={questions}
                          editing={false}
                          selected={null}
                          refresh={refresh}
                          onExplore={onExplore}
                          onValues={setValues}
                          pointFilters={pointFilters}
                          onPointFilter={setPoint}
                        />
                      </div>
                    ))}
                </div>
              )}
              {mounted && cards.length > 0 && !narrow && (
                <ReactGridLayout
                  layout={layout}
                  width={width}
                  gridConfig={{
                    cols: DASHBOARD_COLUMNS,
                    rowHeight: DASHBOARD_ROW_HEIGHT,
                    margin: [12, 12],
                    containerPadding: [0, 0],
                  }}
                  dragConfig={{
                    enabled: editing,
                    handle: '.card-handle',
                    cancel: '.card-still',
                    threshold: 3,
                  }}
                  resizeConfig={{ enabled: editing, handles: ['se'] }}
                  compactor={verticalCompactor}
                  onLayoutChange={onLayout}
                >
                  {cards.map((card) => (
                    <div key={card.id}>
                      <CardFrame
                        base={base}
                        card={card}
                        content={content}
                        values={values}
                        questions={questions}
                        editing={editing}
                        selected={selectedParameter}
                        refresh={refresh}
                        onExplore={onExplore}
                        onValues={setValues}
                        pointFilters={pointFilters}
                        onPointFilter={setPoint}
                        onChange={(change) => setCard(card.id, change)}
                        onRemove={() =>
                          update({ cards: draft.cards.filter((c) => c.id !== card.id) })
                        }
                        onDuplicate={() =>
                          setDraft((d) => ({
                            ...d,
                            cards: [
                              ...d.cards,
                              {
                                ...card,
                                id: newId('c'),
                                ...placed(d.cards, card.tab, { w: card.w, h: card.h }),
                              },
                            ],
                          }))
                        }
                        onEditQuestion={() => {
                          const question = cardQuestion(card, questions)
                          if (question === null) return
                          const saved =
                            card.question === undefined ? undefined : questions.get(card.question)
                          setEditor({
                            card: card.id,
                            draft:
                              saved === undefined
                                ? {
                                    id: null,
                                    label: card.title ?? '',
                                    description: null,
                                    query: question.query,
                                    visualization: question.visualization,
                                  }
                                : { ...draftOf(saved), visualization: question.visualization },
                          })
                        }}
                      />
                    </div>
                  ))}
                </ReactGridLayout>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && selectedParameter !== null && (
        <ParameterSettings
          base={base}
          parameter={selectedParameter}
          source={sourceOf(selectedParameter)}
          tied={
            draft.cards.filter((c) =>
              (c.mappings ?? []).some((m) => m.parameter === selectedParameter.id),
            ).length
          }
          onChange={(p) => {
            update({ parameters: draft.parameters.map((x) => (x.id === p.id ? p : x)) })
            if (p.default !== selectedParameter.default)
              setValues((v) => ({ ...v, [p.id]: p.default ?? null }))
          }}
          onRemove={() => {
            update({
              parameters: draft.parameters.filter((x) => x.id !== selectedParameter.id),
              cards: draft.cards.map((c) => withMapping(c, selectedParameter.id, null)),
            })
            setSelected(null)
          }}
          onAutoMap={() =>
            update({ cards: autoMap(draft.cards, selectedParameter, base, questions) })
          }
          onClose={() => setSelected(null)}
        />
      )}

      <ShareDashboardDialog
        base={base}
        dashboard={sharing ? { id: dashboard.id, label: dashboard.label } : null}
        onClose={() => setSharing(false)}
      />

      {adding && (
        <AddQuestionDialog
          questions={[...questions.values()]}
          onClose={() => setAdding(false)}
          onPick={(question) => {
            addCard(
              { kind: 'question', question: question.id },
              sizeFor('question', question.visualization.type),
            )
            setAdding(false)
          }}
          onNew={(kind) => {
            setAdding(false)
            setEditor({
              card: null,
              draft: {
                id: null,
                label: '',
                description: null,
                query: kind === 'sql' ? { kind: 'sql', sql: '' } : null,
                visualization: null,
              },
            })
          }}
        />
      )}

      {editor !== null && (
        <Dialog open onOpenChange={(open) => !open && setEditor(null)}>
          <DialogContent className="flex h-[92vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
            <DialogTitle className="sr-only">{$t('Question')}</DialogTitle>
            <QuestionView
              base={base}
              initial={editor.draft}
              builds={builds}
              backLabel={$t('Fermer')}
              onBack={() => setEditor(null)}
              useLabel={
                editor.card === null ? $t('Ajouter au tableau de bord') : $t('Appliquer à la carte')
              }
              onUse={(used) => {
                if (used.query === null) return
                const visualization: Visualization = used.visualization ?? {
                  type: autoVisualization(used.query),
                }
                if (editor.card === null) {
                  addCard(
                    {
                      kind: 'question',
                      query: used.query,
                      visualization,
                      ...(used.label === '' ? {} : { title: used.label }),
                    },
                    sizeFor('question', visualization.type),
                  )
                } else {
                  setCard(editor.card, (c) => {
                    const { question: _q, ...rest } = c
                    return { ...rest, query: used.query ?? undefined, visualization }
                  })
                }
                setEditor(null)
              }}
              onSaved={async (saved) => {
                await onQuestionsChanged()
                if (editor.card === null) {
                  addCard(
                    { kind: 'question', question: saved.id },
                    sizeFor('question', saved.visualization.type),
                  )
                } else {
                  setCard(editor.card, (c) => {
                    const { query: _q, visualization: _v, ...rest } = c
                    return { ...rest, question: saved.id }
                  })
                }
                setEditor(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function TabButton({
  tab,
  active,
  editing,
  onSelect,
  onRename,
  onRemove,
}: {
  readonly tab: DashboardTab
  readonly active: boolean
  readonly editing: boolean
  readonly onSelect: () => void
  readonly onRename: (label: string) => void
  readonly onRemove: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  return (
    <div
      className={cn(
        '-mb-px flex shrink-0 items-center gap-1 border-b-2 px-3 py-2 text-sm',
        active
          ? 'border-primary font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {renaming ? (
        <input
          defaultValue={tab.label}
          // biome-ignore lint/a11y/noAutofocus: the tab is being renamed, by a double click
          autoFocus
          onBlur={(e) => {
            const label = e.target.value.trim()
            if (label !== '') onRename(label)
            setRenaming(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setRenaming(false)
          }}
          aria-label={$t('Nom de l’onglet')}
          className="w-32 rounded border bg-background px-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => editing && setRenaming(true)}
          title={editing ? $t('Double-cliquez pour renommer') : undefined}
        >
          {tab.label}
        </button>
      )}
      {editing && active && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={$t('Supprimer l’onglet {label}', { label: tab.label })}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** A filter's control, with the labels of its values: a choice's, a person's. */
/** A filter set by a click: said as such, and taken off with a cross. */
function PointFilterChip({
  filter,
  onRemove,
}: {
  readonly filter: PointFilter
  readonly onRemove: () => void
}) {
  return (
    <span
      className="inline-flex h-9 max-w-80 items-center gap-2 rounded-lg border border-dashed border-primary/60 bg-primary/5 pr-1.5 pl-3 text-sm"
      title={$t(
        'Filtre posé d’un clic : il s’applique à chaque carte qui lit cette colonne, et n’est pas enregistré.',
      )}
    >
      <MousePointerClick className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-muted-foreground">{filter.label}</span>
      <span className="truncate font-medium">{filter.text}</span>
      <button
        type="button"
        aria-label={$t('Retirer le filtre {label} : {text}', {
          label: filter.label,
          text: filter.text,
        })}
        onClick={onRemove}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}

function ParameterSlot(props: {
  readonly base: DescribedBase
  readonly parameter: DashboardParameter
  readonly value: ParameterValue | null
  readonly source: ValueSource | null
  readonly onChange: (value: ParameterValue | null) => void
  readonly selected: boolean
  readonly onSelect?: () => void
}) {
  const { values } = useColumnValues(
    props.base,
    props.parameter.type === 'category' ? (props.source?.query ?? null) : null,
    props.parameter.type === 'category' ? (props.source?.column ?? null) : null,
  )
  const labels = useMemo(() => new Map(values.map((v) => [v.value, v.label])), [values])
  return <ParameterControl {...props} labels={labels} />
}

// ── A card ──────────────────────────────────────────────────────────────────

interface CardProps {
  readonly base: DescribedBase
  readonly card: DashboardCard
  readonly content: Content
  readonly values: Values
  readonly questions: ReadonlyMap<string, Question>
  readonly editing: boolean
  /** The filter being tied, in edit mode. */
  readonly selected: DashboardParameter | null
  readonly refresh: number
  readonly onExplore: (draft: QuestionDraft) => void
  readonly onValues: (change: (values: Values) => Values) => void
  /** The filters set by clicks, and the way to set one. */
  readonly pointFilters?: readonly PointFilter[]
  readonly onPointFilter?: (filter: PointFilter) => void
  readonly onChange?: (change: (card: DashboardCard) => DashboardCard) => void
  readonly onRemove?: () => void
  readonly onDuplicate?: () => void
  readonly onEditQuestion?: () => void
}

function CardMenu({ card, onRemove, onDuplicate, onEditQuestion }: CardProps) {
  return (
    <div className="card-still flex shrink-0 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label={$t('Actions sur la carte')}
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {card.kind === 'question' && (
            <DropdownMenuItem onSelect={onEditQuestion}>
              <Pencil /> {$t('Modifier la question')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> {$t('Dupliquer')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={onRemove}>
            <Trash2 /> {$t('Retirer du tableau')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function CardFrame(props: CardProps) {
  const { card, editing } = props
  if (card.kind === 'heading') {
    return (
      <div className="group relative flex size-full items-end border-b-2 border-border pb-1">
        {editing && (
          <GripVertical className="card-handle absolute top-1 -left-1 size-4 cursor-grab text-muted-foreground" />
        )}
        {editing ? (
          <input
            value={card.text ?? ''}
            onChange={(e) => props.onChange?.((c) => ({ ...c, text: e.target.value }))}
            aria-label={$t('Titre de section')}
            className="card-still min-w-0 flex-1 bg-transparent px-3 text-2xl font-semibold tracking-tight outline-none"
          />
        ) : (
          <h2 className="truncate px-1 text-2xl font-semibold tracking-tight">{card.text}</h2>
        )}
        {editing && <CardMenu {...props} />}
      </div>
    )
  }
  return (
    <section
      className={cn(
        'group relative flex size-full min-h-0 flex-col overflow-hidden rounded-xl border bg-background shadow-xs',
        editing && 'ring-primary/30 hover:ring-2',
      )}
    >
      {card.kind === 'text' ? (
        <TextCard {...props} />
      ) : card.kind === 'embed' ? (
        <EmbedCard {...props} />
      ) : (
        <QuestionCard {...props} />
      )}
    </section>
  )
}

function CardHeader({
  props,
  title,
  onTitle,
  children,
}: {
  readonly props: CardProps
  readonly title: string
  readonly onTitle?: () => void
  readonly children?: ReactNode
}) {
  const { card, editing } = props
  return (
    <header
      className={cn(
        'flex shrink-0 items-center gap-1 px-4 pt-3 pb-1',
        editing && 'card-handle cursor-grab',
      )}
    >
      {editing && <GripVertical className="-ml-2 size-4 shrink-0 text-muted-foreground" />}
      {editing && card.kind !== 'text' ? (
        <input
          value={card.title ?? ''}
          placeholder={title}
          onChange={(e) => props.onChange?.((c) => ({ ...c, title: e.target.value }))}
          aria-label={$t('Titre de la carte')}
          className="card-still min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-semibold outline-none hover:bg-accent focus:bg-accent"
        />
      ) : onTitle !== undefined ? (
        <button
          type="button"
          onClick={onTitle}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:text-primary"
          title={$t('Explorer cette question')}
        >
          {title}
        </button>
      ) : (
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>
      )}
      {children}
      {editing && <CardMenu {...props} />}
    </header>
  )
}

function TextCard(props: CardProps) {
  const { card, editing } = props
  return (
    <>
      {editing && <CardHeader props={props} title={$t('Texte')} />}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 scroll-discret">
        {editing ? (
          <Textarea
            value={card.text ?? ''}
            onChange={(e) => props.onChange?.((c) => ({ ...c, text: e.target.value }))}
            placeholder={$t('Markdown : **gras**, listes, liens…')}
            aria-label={$t('Texte de la carte')}
            className="card-still size-full min-h-16 resize-none font-mono text-xs"
          />
        ) : card.text === undefined || card.text === '' ? (
          <p className="text-sm text-muted-foreground">{$t('Texte vide.')}</p>
        ) : (
          <MarkdownView source={card.text} className="text-sm" />
        )}
      </div>
    </>
  )
}

function EmbedCard(props: CardProps) {
  const { card, editing } = props
  return (
    <>
      <CardHeader props={props} title={card.title || $t('Page intégrée')} />
      {editing && (
        <div className="card-still px-4 pb-2">
          <Input
            value={card.url ?? ''}
            onChange={(e) => props.onChange?.((c) => ({ ...c, url: e.target.value }))}
            aria-label={$t('Adresse de la page')}
            className="h-8 font-mono text-xs"
          />
        </div>
      )}
      <div className="min-h-0 flex-1 px-4 pb-4">
        {card.url !== undefined && /^https:\/\/[^/]+/.test(card.url) ? (
          <iframe
            src={card.url}
            title={card.title || $t('Page intégrée')}
            // A page from elsewhere: its scripts run, but in an origin of its own, with
            // nothing of basedb — no session, no data (chapter 18 §2).
            sandbox={$t('allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox')}
            referrerPolicy="no-referrer"
            loading="lazy"
            className={cn('size-full rounded-md border', editing && 'pointer-events-none')}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {$t('Une adresse https, affichée dans un cadre isolé.')}
          </p>
        )}
      </div>
    </>
  )
}

function useCardResult(
  base: DescribedBase,
  card: DashboardCard,
  constraints: unknown,
  refresh: number,
  runnable: boolean,
) {
  const [state, setState] = useState<{
    result: QueryResult | null
    error: ApiError | string | null
    loading: boolean
  }>({
    result: null,
    error: null,
    loading: true,
  })
  const key = JSON.stringify([card.question ?? card.query, constraints, refresh, runnable])
  const latest = useRef(state)
  latest.current = state
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says what the card reads
  useEffect(() => {
    if (!runnable) return
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    const request =
      card.question !== undefined
        ? { question: card.question }
        : { query: card.query as NonNullable<DashboardCard['query']> }
    api
      .runQuestion(
        base.name,
        { ...request, constraints: constraints as never, weekStart: weekStart() },
        controller.signal,
      )
      .then(
        (result) => !controller.signal.aborted && setState({ result, error: null, loading: false }),
      )
      .catch((e) => {
        if (controller.signal.aborted) return
        setState({ result: null, error: e instanceof ApiError ? e : messageFor(e), loading: false })
      })
    return () => controller.abort()
  }, [key])
  return state
}

function QuestionCard(props: CardProps) {
  const { base, card, content, values, questions, editing, selected, refresh, onExplore } = props
  const members = useMembers()
  const requestRecord = useWorkspace((s) => s.requestRecord)
  const question = cardQuestion(card, questions)
  const pointFilters = props.pointFilters
  const constraints = useMemo(
    () => [
      ...constraintsFor(card, content.parameters, values),
      ...pointConstraints(card, pointFilters ?? [], questions, base),
    ],
    [card, content.parameters, values, pointFilters, questions, base],
  )
  const state = useCardResult(base, card, constraints, refresh, question !== null)
  const [drill, setDrill] = useState<DrillEvent | null>(null)
  const query = question?.query ?? null
  const builder = query?.kind === 'builder' ? query : null
  const source = builder === null ? undefined : tableOf(base, builder.source)
  const title = card.title || question?.label || source?.label || $t('Question')
  const visualization: Visualization = card.visualization ??
    question?.visualization ?? {
      type: query === null ? 'table' : autoVisualization(query, state.result),
    }
  const Icon = VIZ_ICONS[visualization.type]

  const explore = () => {
    if (question === null) return
    const merged = builder === null ? question.query : withConstraints(builder, constraints)
    onExplore({
      id: card.question ?? null,
      label: title,
      description: null,
      query: merged,
      visualization,
    })
  }

  // The filters of the dashboard a click on a point can set: those tied on this card to
  // the column the point stands for.
  const dashboardFilters = (event: DrillEvent): DashboardFilterAction[] => {
    const out: DashboardFilterAction[] = []
    const covered = new Set<ResultColumn>()
    for (const mapping of card.mappings ?? []) {
      const parameter = content.parameters.find((p) => p.id === mapping.parameter)
      if (parameter === undefined || !('column' in mapping.target)) continue
      const target = mapping.target.column
      for (const { column, value } of event.point.values) {
        const src = column.source
        if (
          src === undefined ||
          !sameColumnRef(
            { field: src.field, ...(src.join === undefined ? {} : { join: src.join }) },
            target,
          )
        )
          continue
        const text = valueText(column, value, { base, members })
        if (parameter.type === 'category' && value !== null && value !== undefined) {
          out.push({
            label: `${parameter.label} : « ${text} »`,
            apply: () => props.onValues((v) => ({ ...v, [parameter.id]: [String(value)] })),
          })
          covered.add(column)
        }
        if (parameter.type === 'date' && column.unit !== undefined && typeof value === 'string') {
          const period = periodExpression(value, column.unit, weekStart())
          if (period !== null) {
            out.push({
              label: `${parameter.label} : ${text}`,
              apply: () => props.onValues((v) => ({ ...v, [parameter.id]: period })),
            })
            covered.add(column)
          }
        }
      }
    }
    // A column no filter of the dashboard is tied to here: filtered on every card that reads
    // it, by a filter of the click — offered when at least one other card does.
    for (const { column, value } of event.point.values) {
      if (covered.has(column) || props.onPointFilter === undefined) continue
      const filter = pointFilterOf(column, value, weekStart())
      if (filter === null) continue
      const taking = cardsTaking(filter, content.cards, questions, base)
      const text = valueText(column, value, { base, members })
      const onPointFilter = props.onPointFilter
      out.push({
        label: $t('Filtrer le tableau : « {text} »', { text }),
        // Alone to read this column, the card has « Seulement cette valeur » for it.
        ...(taking < 2
          ? { hint: $t('seule carte'), disabled: true }
          : { hint: `${taking} cartes` }),
        apply: () => onPointFilter({ ...filter, label: column.label, text }),
      })
    }
    return out
  }

  const refused =
    state.error instanceof ApiError &&
    (state.error.status === 404 ||
      state.error.status === 403 ||
      state.error.code.includes('UNKNOWN'))

  return (
    <>
      <CardHeader
        props={props}
        title={title}
        onTitle={question === null || editing ? undefined : explore}
      >
        {!editing && state.loading && state.result !== null && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
        {!editing && (
          <Icon className="size-3.5 shrink-0 text-muted-foreground/60 opacity-0 group-hover:opacity-100" />
        )}
      </CardHeader>
      <div
        className={cn(
          'relative min-h-0 flex-1 px-4 pb-3',
          visualization.type === 'table' && 'px-0 pb-0',
        )}
      >
        {question === null ? (
          <p className="text-sm text-muted-foreground">{$t('Cette question a été supprimée.')}</p>
        ) : state.result === null && state.loading ? (
          <div className="flex size-full items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : refused ? (
          <p className="text-sm text-muted-foreground">{$t('Donnée inaccessible.')}</p>
        ) : state.error !== null ? (
          <p className="text-sm text-destructive">
            {typeof state.error === 'string' ? state.error : messageFor(state.error)}
          </p>
        ) : state.result !== null ? (
          <div className={cn('size-full', state.loading && 'opacity-60')}>
            <VisualizationView
              result={state.result}
              visualization={visualization}
              base={base}
              dense
              sorted={(builder?.sort ?? []).length > 0 || query?.kind === 'sql'}
              onDrill={editing ? undefined : setDrill}
              onRecord={(tableId, id) => {
                const t = base.tables.find((x) => x.id === tableId)
                if (t !== undefined) requestRecord({ base: base.name, table: t.name, id })
              }}
            />
          </div>
        ) : null}
        {editing && selected !== null && question !== null && (
          <MappingOverlay
            base={base}
            card={card}
            parameter={selected}
            query={question.query}
            onChange={props.onChange}
          />
        )}
      </div>
      {drill !== null && (
        <DrillMenu
          base={base}
          query={builder === null ? null : withConstraints(builder, constraints)}
          event={drill}
          dashboardFilters={dashboardFilters(drill)}
          onDrill={(next, type) =>
            onExplore({
              id: null,
              label: `${title} — exploration`,
              description: null,
              query: next,
              visualization: type === undefined ? null : { type },
            })
          }
          onClose={() => setDrill(null)}
        />
      )}
    </>
  )
}

function MappingOverlay({
  base,
  card,
  parameter,
  query,
  onChange,
}: {
  readonly base: DescribedBase
  readonly card: DashboardCard
  readonly parameter: DashboardParameter
  readonly query: NonNullable<DashboardCard['query']>
  readonly onChange?: (change: (card: DashboardCard) => DashboardCard) => void
}) {
  const candidates = mappingCandidates(base, parameter.type, query)
  const current = (card.mappings ?? []).find((m) => m.parameter === parameter.id)
  const index =
    current === undefined ? -1 : candidates.findIndex((c) => sameTarget(c.target, current.target))
  return (
    <div className="card-still absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/90 p-3 text-center backdrop-blur-[1px]">
      <p className="text-sm font-medium">
        {$t('Relier « {label} » à', { label: parameter.label })}
      </p>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {$t('Aucune colonne de cette question ne convient.')}
        </p>
      ) : (
        <Choice
          value={String(index)}
          onValueChange={(next) => {
            const target = candidates[Number(next)]?.target ?? null
            onChange?.((c) => withMapping(c, parameter.id, target))
          }}
          options={[
            { value: '-1', label: $t('Aucune colonne') },
            ...candidates.map((c, i) => ({ value: String(i), label: c.label })),
          ]}
          aria-label={$t('Colonne filtrée par {label}', { label: parameter.label })}
          className={cn(
            'w-48 max-w-full bg-background',
            index >= 0 && 'border-primary text-primary',
          )}
        />
      )}
    </div>
  )
}

// ── Adding a question ───────────────────────────────────────────────────────

function AddQuestionDialog({
  questions,
  onClose,
  onPick,
  onNew,
}: {
  readonly questions: readonly Question[]
  readonly onClose: () => void
  readonly onPick: (question: Question) => void
  readonly onNew: (kind: 'builder' | 'sql') => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q === '' ? questions : questions.filter((x) => x.label.toLowerCase().includes(q))
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{$t('Ajouter une question')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-auto flex-col gap-1 py-3"
            onClick={() => onNew('builder')}
          >
            <Plus className="size-5" />
            {$t('Nouvelle question')}
            <span className="text-xs font-normal text-muted-foreground">
              {$t('avec l’éditeur visuel')}
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col gap-1 py-3"
            onClick={() => onNew('sql')}
          >
            <SquareTerminal className="size-5" />
            {$t('Nouvelle question SQL')}
            <span className="text-xs font-normal text-muted-foreground">
              {$t('en lecture seule')}
            </span>
          </Button>
        </div>
        {questions.length > 0 && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={$t('Chercher une question enregistrée')}
                aria-label={$t('Chercher une question enregistrée')}
                className="h-8 pl-7"
              />
            </div>
            <div className="max-h-72 overflow-y-auto scroll-discret">
              {shown.map((question) => {
                const Icon = VIZ_ICONS[question.visualization.type]
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => onPick(question)}
                    className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{question.label}</span>
                      {question.description !== null && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {question.description}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
