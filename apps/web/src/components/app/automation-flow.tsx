'use client'

import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import type {
  Automation,
  AutomationRun,
  AutomationTriggerKind,
  DescribedBase,
  Member,
} from '@/lib/api/client'
import {
  END_NODE,
  FRAME_BOTTOM,
  type FlowEdge,
  type FlowNode,
  GAP_Y,
  MERGE_SIZE,
  STEP_SIZE,
  type Slot,
  TRIGGER_NODE,
  frameOf,
  layoutFlow,
  mergeOf,
} from '@/lib/automation-layout'
import {
  type Draft,
  type DraftPath,
  type DraftStep,
  type PathHolder,
  type RunStepRecord,
  STEP_LABELS,
  type StepKind,
  TRIGGER_LABELS,
  allSteps,
  findPath,
  offsetText,
  pathSummary,
  runStepSentence,
  runStepsById,
  stepProblem,
  stepSummary,
  triggerHasTable,
  triggerProblem,
} from '@/lib/automations'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  Background,
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  Handle,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import './automation-flow.css'
import { $t, weekdayNames } from '@/lib/i18n'
import {
  Bell,
  CalendarClock,
  CircleCheck,
  CircleSlash,
  CircleX,
  Clock,
  FilePlus2,
  FileText,
  FileX2,
  Hourglass,
  LifeBuoy,
  ListFilter,
  type LucideIcon,
  Mail,
  Maximize,
  MessageSquareText,
  MousePointerClick,
  PencilLine,
  Plus,
  Repeat,
  Search,
  Sigma,
  Sparkles,
  Split,
  Trash2,
  TriangleAlert,
  Webhook,
  Workflow,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { createContext, useContext, useEffect, useMemo } from 'react'

/**
 * An automation's flow, drawn — chapter 17 on the canvas: the trigger on top, each step a
 * card below it, a condition — or an attempt — opening its paths side by side and having
 * them meet again. A « + » on an edge asks the editor's picker for a step to insert there;
 * a card opens its settings. A run chosen in the list is laid over the flow: each step it
 * passed says how it went, the way it took is drawn, the rest is dimmed.
 */

export const STEP_ICONS: Readonly<Record<StepKind, LucideIcon>> = {
  update_record: PencilLine,
  create_record: FilePlus2,
  find_record: Search,
  delete_record: Trash2,
  aggregate: Sigma,
  notify: Bell,
  email: Mail,
  webhook: Webhook,
  slack: MessageSquareText,
  document: FileText,
  ai: Sparkles,
  branch: Split,
  for_each: Repeat,
  attempt: LifeBuoy,
  wait: Hourglass,
  run_automation: Workflow,
}

const ACTION = 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
const READ = 'bg-teal-500/12 text-teal-700 dark:text-teal-300'
const FLOW = 'bg-amber-500/15 text-amber-700 dark:text-amber-300'

/**
 * Actions in one tone, what reads rows in another, the AI in its own, what shapes the flow
 * in a fourth — a deletion in red, as anything that deletes.
 */
export const STEP_TONES: Readonly<Record<StepKind, string>> = {
  update_record: ACTION,
  create_record: ACTION,
  notify: ACTION,
  email: ACTION,
  webhook: ACTION,
  slack: ACTION,
  document: ACTION,
  delete_record: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  find_record: READ,
  aggregate: READ,
  // The colour of the AI across the product — an AI field's switch, the copilot.
  ai: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  branch: FLOW,
  for_each: FLOW,
  attempt: FLOW,
  wait: FLOW,
  run_automation: FLOW,
}

export const TRIGGER_ICONS: Readonly<Record<AutomationTriggerKind, LucideIcon>> = {
  record_created: Zap,
  record_updated: PencilLine,
  record_deleted: FileX2,
  record_matches: ListFilter,
  button: MousePointerClick,
  schedule: Clock,
  date_reached: CalendarClock,
  webhook: Webhook,
}

/** A trigger in the accent: what sets the flow off. */
export const TRIGGER_TONE = 'bg-primary/12 text-primary'

// ── What the canvas asks of the editor ──────────────────────────────────────

interface FlowActions {
  readonly select: (id: string) => void
  /** Opens the editor's picker for a step to insert there. */
  readonly pick: (slot: Slot) => void
}

const Actions = createContext<FlowActions>({
  select: () => undefined,
  pick: () => undefined,
})

// ── Nodes ───────────────────────────────────────────────────────────────────

interface CardData extends Record<string, unknown> {
  readonly width: number
  readonly height: number
  readonly selected: boolean
  /** A run is laid over the flow and did not come here. */
  readonly dimmed: boolean
}

interface TriggerData extends CardData {
  readonly title: string
  readonly summary: string
  readonly condition: string
  readonly icon: LucideIcon
  readonly problem: string | null
}

interface StepData extends CardData {
  readonly step: DraftStep
  readonly summary: string
  readonly problem: string | null
  readonly run: RunStepRecord | null
}

interface PathData extends CardData {
  readonly path: DraftPath
  /** The branch or the attempt it belongs to. */
  readonly holder: PathHolder | null
  readonly taken: boolean
}

type TriggerNode = Node<TriggerData, 'trigger'>
type StepNode = Node<StepData, 'step'>
type PathNode = Node<PathData, 'path'>
type BareNode = Node<CardData & { readonly append?: number }, 'merge' | 'end' | 'frame'>

/** The edges of a card: in on top, out below — drawn by the edges, not by the card. */
function Ports() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!pointer-events-none !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!pointer-events-none !opacity-0"
      />
    </>
  )
}

const cardClass = (selected: boolean, dimmed: boolean) =>
  cn(
    'flex w-full items-center gap-3 rounded-xl border bg-card px-3 text-left shadow-xs transition-[box-shadow,opacity,border-color]',
    'hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected && 'border-primary ring-2 ring-primary/25 hover:border-primary',
    dimmed && 'opacity-40',
  )

function TriggerCard({ id, data }: NodeProps<TriggerNode>) {
  const { select } = useContext(Actions)
  const Icon = data.icon
  return (
    <div style={{ width: data.width, height: data.height }}>
      <Ports />
      <button
        type="button"
        onClick={() => select(id)}
        className={cardClass(data.selected, data.dimmed)}
        style={{ height: data.height }}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            TRIGGER_TONE,
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {$t('Quand')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{data.title}</span>
            {data.problem !== null && (
              <TriangleAlert
                className="size-3.5 shrink-0 text-amber-500"
                aria-label={data.problem}
              />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {data.problem ?? data.summary}
            {data.problem === null && data.condition !== '' && (
              <>
                {$t(' · si ')}
                <span className="font-mono">{data.condition}</span>
              </>
            )}
          </span>
        </span>
      </button>
    </div>
  )
}

function RunMark({ run }: { readonly run: RunStepRecord }) {
  // A wait passed holds the run until it goes on: an hourglass, not a tick.
  const waits = run.kind === 'wait' && run.status === 'succeeded'
  const Icon = waits
    ? Hourglass
    : run.status === 'succeeded'
      ? CircleCheck
      : run.status === 'failed'
        ? CircleX
        : CircleSlash
  return (
    <Hint label={runStepSentence(run)}>
      <span
        className={cn(
          'flex items-center gap-1 text-[11px]',
          waits
            ? 'text-sky-600 dark:text-sky-400'
            : run.status === 'succeeded'
              ? 'text-emerald-600 dark:text-emerald-400'
              : run.status === 'failed'
                ? 'text-destructive'
                : 'text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
        {run.ms !== undefined && (
          <span className="tabular-nums">{$t('{ms} ms', { ms: run.ms })}</span>
        )}
      </span>
    </Hint>
  )
}

function StepCard({ id, data }: NodeProps<StepNode>) {
  const { select } = useContext(Actions)
  const Icon = STEP_ICONS[data.step.kind]
  return (
    <div style={{ width: data.width, height: data.height }}>
      <Ports />
      <button
        type="button"
        onClick={() => select(id)}
        className={cn(
          cardClass(data.selected, data.dimmed),
          data.run?.status === 'failed' && 'border-destructive/60',
        )}
        style={{ height: data.height }}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            STEP_TONES[data.step.kind],
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{STEP_LABELS[data.step.kind]}</span>
            {data.problem !== null && data.run === null && (
              <TriangleAlert
                className="size-3.5 shrink-0 text-amber-500"
                aria-label={data.problem}
              />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {data.run === null ? (data.problem ?? data.summary) : runStepSentence(data.run)}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 self-stretch py-2">
          <span className="font-mono text-[10px] text-muted-foreground/80">{data.step.id}</span>
          {data.run !== null && <RunMark run={data.run} />}
        </span>
      </button>
    </div>
  )
}

function PathChip({ id, data }: NodeProps<PathNode>) {
  const { select } = useContext(Actions)
  const summary = pathSummary(data.path, data.holder)
  const attempt = data.holder?.kind === 'attempt'
  // An attempt's second path is taken only when a step of the first fails.
  const rescue = attempt && data.holder?.paths[1]?.id === data.path.id
  return (
    <div style={{ width: data.width, height: data.height }} className="flex justify-center">
      <Ports />
      <Hint label={summary}>
        <button
          type="button"
          onClick={() => select(id)}
          className={cn(
            'flex h-full max-w-full items-center gap-1.5 rounded-full border bg-card px-3 text-xs shadow-xs transition-[opacity,border-color]',
            'hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            (data.path.otherwise || rescue) && 'border-dashed',
            rescue && 'border-rose-500/45 text-rose-700 dark:text-rose-300',
            data.taken && 'border-primary text-primary',
            data.selected && 'border-primary ring-2 ring-primary/25',
            data.dimmed && 'opacity-40',
          )}
        >
          {attempt &&
            (rescue ? (
              <TriangleAlert className="size-3 shrink-0" />
            ) : (
              <LifeBuoy className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
            ))}
          <span className="shrink-0 font-medium">{data.path.label || $t('Chemin')}</span>
          {!data.path.otherwise && !attempt && (
            <span className="truncate font-mono text-[11px] text-muted-foreground">{summary}</span>
          )}
        </button>
      </Hint>
    </div>
  )
}

function MergeDot({ data }: NodeProps<BareNode>) {
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className={cn('rounded-full bg-border', data.dimmed && 'opacity-40')}
    >
      <Ports />
    </div>
  )
}

/**
 * A loop's frame, under its steps: a dashed outline, and the arrow that goes from the end
 * of a turn back up to the loop's card — drawn here, in the frame's own coordinates, whose
 * top is the card's middle.
 */
function LoopFrame({ data }: NodeProps<BareNode>) {
  const { width: w, height: h } = data
  const right = w - 14
  const r = 8
  const fromX = w / 2 + MERGE_SIZE / 2 + 2
  const fromY = h - FRAME_BOTTOM - MERGE_SIZE / 2
  const toX = w / 2 + STEP_SIZE.w / 2 + 3
  const boxTop = STEP_SIZE.h / 2 + 12
  return (
    <div
      style={{ width: w, height: h }}
      className={cn('pointer-events-none relative', data.dimmed && 'opacity-40')}
    >
      <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden="true">
        <rect
          x={0.5}
          y={boxTop}
          width={w - 1}
          height={h - boxTop - 0.5}
          rx={14}
          className="fill-amber-500/[0.04] stroke-amber-500/40"
          strokeDasharray="5 4"
        />
        <path
          d={`M ${fromX} ${fromY} H ${right - r} Q ${right} ${fromY} ${right} ${fromY - r} V ${r} Q ${right} 0 ${right - r} 0 H ${toX}`}
          className="fill-none stroke-amber-500/70"
          strokeWidth={1.5}
        />
        <path
          d={`M ${toX + 6} -4 L ${toX} 0 L ${toX + 6} 4`}
          className="fill-none stroke-amber-500/70"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-500/40 bg-card text-amber-700 dark:text-amber-300"
        style={{ left: right, top: (fromY + boxTop) / 2 }}
      >
        <Repeat className="size-3" />
      </span>
    </div>
  )
}

function EndButton({ data }: NodeProps<BareNode>) {
  const { pick } = useContext(Actions)
  return (
    <div style={{ width: data.width, height: data.height }} className="flex justify-center">
      <Ports />
      <Button
        variant="outline"
        size="sm"
        onClick={() => pick({ path: null, index: data.append ?? 0 })}
        className={cn(
          'nodrag h-9 gap-1.5 rounded-full bg-card shadow-xs',
          data.dimmed && 'opacity-40',
        )}
      >
        <Plus className="size-4" />
        {$t('Ajouter une étape')}
      </Button>
    </div>
  )
}

const NODE_TYPES = {
  trigger: TriggerCard,
  step: StepCard,
  path: PathChip,
  merge: MergeDot,
  end: EndButton,
  frame: LoopFrame,
}

// ── Edges ───────────────────────────────────────────────────────────────────

interface LinkData extends Record<string, unknown> {
  readonly insert: Slot | null
  readonly bend: FlowEdge['bend']
  /** A run laid over the flow went this way. */
  readonly taken: boolean
  readonly dimmed: boolean
}

type LinkEdge = Edge<LinkData, 'link'>

function Link({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<LinkEdge>) {
  const { pick } = useContext(Actions)
  const centerY =
    data?.bend === 'source'
      ? sourceY + GAP_Y / 2
      : data?.bend === 'target'
        ? targetY - GAP_Y / 2
        : undefined
  // The « + » sits on the stretch that leaves the source: halfway down it, before a turn.
  const plusY = data?.bend === 'target' ? (sourceY + targetY - GAP_Y / 2) / 2 : sourceY + GAP_Y / 2
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
    ...(centerY === undefined ? {} : { centerY }),
  })
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={cn(
          'automation-flow__link',
          data?.taken && 'automation-flow__link--taken',
          data?.dimmed && 'opacity-40',
        )}
      />
      {data?.insert !== null && data?.insert !== undefined && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${sourceX}px, ${plusY}px)`,
              pointerEvents: 'all',
            }}
          >
            <Hint label={$t('Ajouter une étape ici')}>
              <button
                type="button"
                aria-label={$t('Ajouter une étape ici')}
                onClick={() => data.insert !== null && pick(data.insert)}
                className="flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-3" />
              </button>
            </Hint>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const EDGE_TYPES = { link: Link }

// ── The canvas ──────────────────────────────────────────────────────────────

const WEEKDAYS = weekdayNames('long')

function triggerSummary(draft: Draft, base: DescribedBase): string {
  const t = draft.trigger
  if (t.kind === 'schedule') {
    const s = t.schedule
    if (s.every === 'hour') return $t('Toutes les heures, à la minute {at}', { at: s.at.slice(3) })
    if (s.every === 'week')
      return $t('Le {value} à {at}', { value: WEEKDAYS[s.weekday - 1] ?? WEEKDAYS[0], at: s.at })
    return $t('Chaque jour à {at}', { at: s.at })
  }
  if (t.kind === 'webhook') return $t('Une requête à l’adresse de l’automatisation')
  const table = base.tables.find((x) => x.name === t.table)
  if (t.kind === 'date_reached' && t.date.field !== '') {
    const field = table?.fields.find((f) => f.name === t.date.field)
    return $t('{field} de {table}, {offset}', {
      field: field?.label ?? t.date.field,
      table: table?.label ?? t.table,
      offset: offsetText(t.date.offsetDays),
    })
  }
  return $t('Dans {table}', { table: table?.label ?? $t('une table') })
}

export interface FlowCanvasProps {
  readonly draft: Draft
  readonly base: DescribedBase
  readonly members: readonly Member[]
  /** The automations of the base, what a step that starts one names; `null` while read. */
  readonly automations: readonly Automation[] | null
  readonly selected: string
  readonly onSelect: (id: string) => void
  /** Asks for a step to insert at a place: the editor's picker opens. */
  readonly onPick: (slot: Slot) => void
  /** The run laid over the flow, if any. */
  readonly run: AutomationRun | null
  /** A piece to bring into view — a step just added. */
  readonly focus: string | null
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}

function Canvas({
  draft,
  base,
  members,
  automations,
  selected,
  onSelect,
  onPick,
  run,
  focus,
}: FlowCanvasProps) {
  const theme = useTheme((s) => s.theme)
  const flow = useReactFlow()
  const layout = useMemo(() => layoutFlow(draft), [draft])

  // What a run laid over the flow reached: the steps it passed, the paths it took.
  const overlay = useMemo(() => {
    if (run === null) return null
    const steps = runStepsById(run, draft.steps)
    const reached = new Set<string>([TRIGGER_NODE, ...steps.keys()])
    for (const [id, record] of steps) {
      if (record.kind === 'for_each') {
        reached.add(mergeOf(id))
        reached.add(frameOf(id))
        continue
      }
      if (record.kind === 'attempt') {
        // The steps are tried; the second path is reached when one of them failed.
        const attempt = allSteps(draft.steps).find((s) => s.id === id)
        if (attempt?.kind === 'attempt') {
          attempt.paths.forEach((path, index) => {
            if (index === 0 || path.steps.some((s) => steps.has(s.id))) reached.add(path.id)
          })
        }
        reached.add(mergeOf(id))
        if (typeof record.path === 'string') reached.add(record.path)
        for (const path of record.taken ?? []) reached.add(path)
        continue
      }
      if (record.kind !== 'branch') continue
      reached.add(mergeOf(id))
      if (typeof record.path === 'string') reached.add(record.path)
      // In a loop, every path a turn took.
      for (const path of record.taken ?? []) reached.add(path)
    }
    if (run.status === 'succeeded') reached.add(END_NODE)
    return { steps, reached }
  }, [run, draft.steps])

  const nodes = useMemo((): Node[] => {
    const steps = new Map(allSteps(draft.steps).map((s) => [s.id, s]))
    const dimmed = (id: string) => overlay !== null && !overlay.reached.has(id)
    return layout.nodes.map((n: FlowNode): Node => {
      const common = {
        id: n.id,
        position: { x: n.x, y: n.y },
        draggable: false,
        selectable: false,
      }
      const card = { width: n.w, height: n.h, selected: selected === n.id, dimmed: dimmed(n.id) }
      switch (n.kind) {
        case 'trigger':
          return {
            ...common,
            type: 'trigger',
            data: {
              ...card,
              title: TRIGGER_LABELS[draft.trigger.kind],
              summary: triggerSummary(draft, base),
              condition: triggerHasTable(draft.trigger.kind) ? draft.condition.trim() : '',
              icon: TRIGGER_ICONS[draft.trigger.kind],
              problem: run === null ? triggerProblem(draft) : null,
            } satisfies TriggerData,
          }
        case 'step': {
          const step = steps.get(n.id) as DraftStep
          return {
            ...common,
            type: 'step',
            data: {
              ...card,
              step,
              summary: stepSummary(step, draft, base, members, automations ?? []),
              problem: stepProblem(step, draft, automations),
              run: overlay?.steps.get(n.id) ?? null,
            } satisfies StepData,
          }
        }
        case 'path': {
          const found = findPath(draft.steps, n.id)
          return {
            ...common,
            type: 'path',
            data: {
              ...card,
              path: found?.path as DraftPath,
              holder: found?.branch ?? null,
              taken: overlay?.reached.has(n.id) ?? false,
            } satisfies PathData,
          }
        }
        case 'frame':
          // A loop's frame is drawn, not reached: neither clicked (automation-flow.css) nor
          // tabbed to.
          return { ...common, type: n.kind, focusable: false, data: card }
        default:
          // The button at the end adds after the last step of the first level.
          return { ...common, type: n.kind, data: { ...card, append: draft.steps.length } }
      }
    })
  }, [layout, draft, base, members, automations, selected, overlay, run])

  const edges = useMemo(
    (): LinkEdge[] =>
      layout.edges.map((e) => {
        const taken = overlay?.reached.has(e.source) === true && overlay.reached.has(e.target)
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'link',
          selectable: false,
          focusable: false,
          data: {
            // Over a run, the flow is read, not edited.
            insert: overlay === null ? e.insert : null,
            bend: e.bend,
            taken,
            dimmed: overlay !== null && !taken,
          },
        }
      }),
    [layout, overlay],
  )

  // A step just added comes into view, at the zoom the person chose.
  useEffect(() => {
    if (focus === null) return
    const node = layout.nodes.find((n) => n.id === focus)
    if (node === undefined) return
    const timer = setTimeout(() => {
      void flow.setCenter(node.x + node.w / 2, node.y + node.h / 2, {
        zoom: flow.getZoom(),
        duration: 250,
      })
    }, 30)
    return () => clearTimeout(timer)
  }, [focus, layout, flow])

  const actions = useMemo(() => ({ select: onSelect, pick: onPick }), [onSelect, onPick])

  return (
    <Actions.Provider value={actions}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        minZoom={0.3}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ maxZoom: 1, minZoom: 0.6, padding: 0.12 }}
        colorMode={theme}
        className="automation-flow"
        aria-label={$t('Le flux de l’automatisation')}
      >
        <Background gap={20} size={1.2} />
        <Panel position="bottom-left" className="flex gap-1">
          <Hint label={$t('Zoom avant')}>
            <Button
              variant="outline"
              size="icon-sm"
              className="bg-card"
              aria-label={$t('Zoom avant')}
              onClick={() => void flow.zoomIn({ duration: 150 })}
            >
              <ZoomIn className="size-4" />
            </Button>
          </Hint>
          <Hint label={$t('Zoom arrière')}>
            <Button
              variant="outline"
              size="icon-sm"
              className="bg-card"
              aria-label={$t('Zoom arrière')}
              onClick={() => void flow.zoomOut({ duration: 150 })}
            >
              <ZoomOut className="size-4" />
            </Button>
          </Hint>
          <Hint label={$t('Tout voir')}>
            <Button
              variant="outline"
              size="icon-sm"
              className="bg-card"
              aria-label={$t('Tout voir')}
              onClick={() => void flow.fitView({ maxZoom: 1, padding: 0.12, duration: 200 })}
            >
              <Maximize className="size-4" />
            </Button>
          </Hint>
        </Panel>
      </ReactFlow>
    </Actions.Provider>
  )
}
