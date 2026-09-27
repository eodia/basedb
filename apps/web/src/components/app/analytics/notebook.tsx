'use client'

import { ColumnList } from '@/components/app/analytics/column-picker'
import {
  ExpressionFilterEditor,
  FilterEditor,
  useValueLabel,
} from '@/components/app/analytics/filter-editor'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Hint } from '@/components/ui/tooltip'
import {
  type ColumnOption,
  FN_LABELS,
  aggregationsFor,
  breakoutOn,
  columnsOf,
  describeAggregation,
  describeBreakout,
  describeFilter,
  findColumn,
  groupable,
  joinAlias,
  joinSuggestions,
  tableOf,
} from '@/lib/analytics/model'
import type { DescribedBase, Table } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  type Aggregation,
  type AggregationFn,
  type Breakout,
  type BuilderQuery,
  COLUMNLESS_FNS,
  type Filter,
  type Join,
  type JoinKind,
  type OrderBy,
  columnName,
} from '@basedb/contracts'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Combine,
  ListOrdered,
  Loader2,
  Play,
  Plus,
  Search,
  Table2,
  X,
} from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useState } from 'react'

/**
 * The builder of questions — chapter 18 §3, with the mouse: the data, the tables joined to
 * it, the filters, the aggregates by groups, the order and the bound, one step under the
 * other, each coloured by what it does. What it builds is a query of `@basedb/contracts`;
 * the kernel runs it with the rights of whoever looks.
 */

type Tone = 'data' | 'filter' | 'summarize' | 'neutral'

const TONES: Readonly<Record<Tone, { title: string; panel: string; chip: string; empty: string }>> =
  {
    data: {
      title: 'text-sky-600 dark:text-sky-400',
      panel: 'bg-sky-500/[0.07] dark:bg-sky-400/[0.08]',
      chip: 'bg-sky-600 text-white hover:bg-sky-600/90 dark:bg-sky-500',
      empty: 'border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10',
    },
    filter: {
      title: 'text-violet-600 dark:text-violet-400',
      panel: 'bg-violet-500/[0.07] dark:bg-violet-400/[0.08]',
      chip: 'bg-violet-600 text-white hover:bg-violet-600/90 dark:bg-violet-500',
      empty: 'border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10',
    },
    summarize: {
      title: 'text-emerald-600 dark:text-emerald-400',
      panel: 'bg-emerald-500/[0.07] dark:bg-emerald-400/[0.08]',
      chip: 'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600',
      empty: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10',
    },
    neutral: {
      title: 'text-muted-foreground',
      panel: 'bg-muted/60',
      chip: 'bg-foreground/80 text-background hover:bg-foreground/70',
      empty: 'border-border text-muted-foreground hover:bg-accent',
    },
  }

function Step({
  tone,
  title,
  children,
  onRemove,
}: {
  readonly tone: Tone
  readonly title: string
  readonly children: ReactNode
  readonly onRemove?: () => void
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2">
        <h3 className={cn('text-sm font-semibold', TONES[tone].title)}>{title}</h3>
        {onRemove !== undefined && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={$t('Retirer l’étape {title}', { title })}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className={cn('flex flex-wrap items-center gap-2 rounded-lg p-3', TONES[tone].panel)}>
        {children}
      </div>
    </section>
  )
}

function Chip({
  tone,
  children,
  onRemove,
  ...props
}: {
  readonly tone: Tone
  readonly children: ReactNode
  readonly onRemove?: () => void
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md text-sm font-medium transition-colors',
        TONES[tone].chip,
      )}
    >
      <button type="button" className="flex items-center gap-1.5 px-2.5 py-1.5" {...props}>
        {children}
      </button>
      {onRemove !== undefined && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={$t('Retirer')}
          className="border-l border-white/25 px-1.5 py-1.5 opacity-80 hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  )
}

function AddButton({
  tone,
  children,
  ...props
}: {
  readonly tone: Tone
  readonly children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
        TONES[tone].empty,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function StepAction({
  icon: Icon,
  label,
  onClick,
}: {
  readonly icon: typeof Plus
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} className="h-8 gap-1.5 px-2.5 text-xs">
      <Icon className="size-3.5" />
      {label}
    </Button>
  )
}

// ── Tables ──────────────────────────────────────────────────────────────────

function TableList({
  tables,
  onPick,
}: { readonly tables: readonly Table[]; readonly onPick: (table: Table) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q === '' ? tables : tables.filter((t) => t.label.toLowerCase().includes(q))
  return (
    <div className="flex max-h-80 flex-col">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={$t('Chercher une table')}
          aria-label={$t('Chercher une table')}
          className="h-8 pl-7 text-sm"
          autoFocus
        />
      </div>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto scroll-discret">
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
        {shown.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted-foreground">{$t('Aucune table.')}</p>
        )}
      </div>
    </div>
  )
}

function TablePicker({
  base,
  value,
  onPick,
  tone,
  placeholder,
}: {
  readonly base: DescribedBase
  readonly value: string | null
  readonly onPick: (table: Table) => void
  readonly tone: Tone
  readonly placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const table = value === null ? undefined : tableOf(base, value)
  // A question without a table asks for one first — once the menu that opened it has let go
  // of the focus, else it would close the list as it leaves.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the picker first appears
  useEffect(() => {
    if (value !== null) return
    const timer = setTimeout(() => setOpen(true), 120)
    return () => clearTimeout(timer)
  }, [])
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {table === undefined ? (
          <AddButton tone={tone}>{placeholder}</AddButton>
        ) : (
          <Chip tone={tone}>
            <Table2 className="size-4" />
            {table.label}
          </Chip>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <TableList
          tables={base.tables}
          onPick={(t) => {
            onPick(t)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ── Joins ───────────────────────────────────────────────────────────────────

const JOIN_LABELS: Readonly<Record<JoinKind, string>> = {
  left: $t('Jointure à gauche'),
  inner: $t('Jointure interne'),
  right: $t('Jointure à droite'),
  full: $t('Jointure complète'),
}

function ColumnButton({
  columns,
  value,
  onPick,
  tone,
  placeholder,
}: {
  readonly columns: readonly ColumnOption[]
  readonly value: ColumnOption | undefined
  readonly onPick: (column: ColumnOption) => void
  readonly tone: Tone
  readonly placeholder: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {value === undefined ? (
          <AddButton tone={tone}>{placeholder}</AddButton>
        ) : (
          <Chip tone={tone}>{value.label}</Chip>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <ColumnList
          columns={columns}
          onPick={(c) => {
            onPick(c)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function JoinStep({
  base,
  query,
  index,
  onChange,
  onRemove,
}: {
  readonly base: DescribedBase
  readonly query: BuilderQuery
  readonly index: number
  readonly onChange: (join: Join) => void
  readonly onRemove: () => void
}) {
  const join = (query.joins ?? [])[index] as Join
  const earlier: BuilderQuery = { ...query, joins: (query.joins ?? []).slice(0, index) }
  const leftColumns = columnsOf(base, earlier)
  const all = columnsOf(base, query)
  const rightColumns = all.filter((c) => c.ref.join === join.alias)
  const source = tableOf(base, query.source)
  return (
    <Step tone="data" title={$t('Joindre des données')} onRemove={onRemove}>
      {source !== undefined && (
        <Chip tone="data" disabled>
          {source.label}
        </Chip>
      )}
      <Choice
        value={join.kind}
        onValueChange={(kind) => onChange({ ...join, kind: kind as JoinKind })}
        options={Object.entries(JOIN_LABELS).map(([value, label]) => ({ value, label }))}
        aria-label={$t('Sorte de jointure')}
        className="w-auto min-w-36 bg-background"
      />
      <TablePicker
        base={base}
        value={join.table}
        tone="data"
        placeholder={$t('Choisir une table')}
        onPick={(table) => {
          const suggestion =
            source === undefined
              ? undefined
              : joinSuggestions(base, source).find((s) => s.table.id === table.id)
          onChange({
            ...join,
            table: table.id,
            alias:
              join.table === table.id
                ? join.alias
                : joinAlias(
                    { ...query, joins: (query.joins ?? []).filter((_, i) => i !== index) },
                    table,
                  ),
            ...(suggestion === undefined ? {} : { left: suggestion.left, right: suggestion.right }),
          })
        }}
      />
      <span className="text-sm text-muted-foreground">{$t('sur')}</span>
      <ColumnButton
        columns={leftColumns}
        value={findColumn(leftColumns, join.left)}
        tone="data"
        placeholder={$t('Colonne')}
        onPick={(c) => onChange({ ...join, left: c.ref })}
      />
      <span className="text-sm text-muted-foreground">=</span>
      <ColumnButton
        columns={rightColumns}
        value={findColumn(rightColumns, { join: join.alias, field: join.right })}
        tone="data"
        placeholder={$t('Colonne')}
        onPick={(c) => onChange({ ...join, right: c.ref.field })}
      />
    </Step>
  )
}

// ── Filters ─────────────────────────────────────────────────────────────────

function FilterPopover({
  base,
  query,
  columns,
  filter,
  onDone,
  children,
}: {
  readonly base: DescribedBase
  readonly query: BuilderQuery
  readonly columns: readonly ColumnOption[]
  readonly filter?: Filter
  readonly onDone: (filter: Filter) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const initialColumn =
    filter !== undefined && 'column' in filter ? findColumn(columns, filter.column) : undefined
  const [column, setColumn] = useState<ColumnOption | undefined>(initialColumn)
  const [expression, setExpression] = useState(filter !== undefined && 'expression' in filter)
  const done = (f: Filter) => {
    onDone(f)
    setOpen(false)
  }
  return (
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setColumn(initialColumn)
          setExpression(filter !== undefined && 'expression' in filter)
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto min-w-72">
        {expression ? (
          <ExpressionFilterEditor
            base={base}
            query={query}
            initial={filter !== undefined && 'expression' in filter ? filter.expression : ''}
            onDone={done}
          />
        ) : column === undefined ? (
          <div className="w-72">
            <ColumnList columns={columns.filter((c) => c.kind !== 'button')} onPick={setColumn} />
            <button
              type="button"
              onClick={() => setExpression(true)}
              className="mt-2 w-full rounded-md border-t pt-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              {$t('Écrire une expression de filtre…')}
            </button>
          </div>
        ) : (
          <FilterEditor
            base={base}
            query={query}
            column={column}
            initial={filter}
            onDone={done}
            onBack={filter === undefined ? () => setColumn(undefined) : undefined}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Aggregates and groups ───────────────────────────────────────────────────

const PICKED_FNS: readonly AggregationFn[] = [
  'count',
  'sum',
  'avg',
  'median',
  'min',
  'max',
  'distinct',
  'stddev',
  'cum_count',
  'cum_sum',
]

function AggregationPopover({
  columns,
  value,
  onDone,
  children,
}: {
  readonly columns: readonly ColumnOption[]
  readonly value?: Aggregation
  readonly onDone: (aggregation: Aggregation) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [fn, setFn] = useState<AggregationFn | null>(null)
  const eligible = fn === null ? [] : columns.filter((c) => aggregationsFor(c.kind).includes(fn))
  return (
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setFn(null)
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72">
        {fn === null ? (
          <div className="-mx-1 flex flex-col">
            <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {$t('Fonction')}
            </p>
            {PICKED_FNS.map((f) => {
              const possible =
                COLUMNLESS_FNS.has(f) || columns.some((c) => aggregationsFor(c.kind).includes(f))
              return (
                <button
                  key={f}
                  type="button"
                  disabled={!possible}
                  onClick={() => {
                    if (COLUMNLESS_FNS.has(f)) {
                      onDone({ fn: f })
                      setOpen(false)
                    } else setFn(f)
                  }}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40',
                    value?.fn === f && 'bg-accent',
                  )}
                >
                  {FN_LABELS[f]}
                  {!COLUMNLESS_FNS.has(f) && (
                    <span className="text-muted-foreground"> {$t('de…')}</span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setFn(null)}
              className="mb-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {$t('← {fnLabels} de…', { fnLabels: FN_LABELS[fn] })}
            </button>
            <ColumnList
              columns={eligible}
              onPick={(c) => {
                onDone({ fn, column: c.ref })
                setOpen(false)
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function BreakoutPopover({
  columns,
  onDone,
  children,
}: {
  readonly columns: readonly ColumnOption[]
  readonly onDone: (breakout: Breakout) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80">
        <ColumnList
          grouping
          columns={columns.filter((c) => groupable(c.kind))}
          onPick={(c, how) => {
            const b = breakoutOn(c)
            onDone(
              how === undefined
                ? b
                : {
                    ...c.ref,
                    ...(how.unit === undefined ? {} : { unit: how.unit }),
                    ...(how.bin === undefined ? {} : { bin: how.bin }),
                  },
            )
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ── Sort ────────────────────────────────────────────────────────────────────

function SortPopover({
  query,
  columns,
  onDone,
  children,
}: {
  readonly query: BuilderQuery
  readonly columns: readonly ColumnOption[]
  readonly onDone: (order: OrderBy) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const grouped = (query.aggregations ?? []).length > 0 || (query.breakouts ?? []).length > 0
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72">
        {grouped ? (
          <div className="-mx-1 flex flex-col">
            {(query.breakouts ?? []).map((b, index) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: a grouping is designated by its rank
                key={`b${index}`}
                type="button"
                onClick={() => {
                  onDone({ target: { kind: 'breakout', index } })
                  setOpen(false)
                }}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {describeBreakout(b, columns)}
              </button>
            ))}
            {(query.aggregations ?? []).map((a, index) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: an aggregate is designated by its rank
                key={`a${index}`}
                type="button"
                onClick={() => {
                  onDone({ target: { kind: 'aggregation', index }, desc: true })
                  setOpen(false)
                }}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {describeAggregation(a, columns)}
              </button>
            ))}
          </div>
        ) : (
          <ColumnList
            columns={columns.filter(
              (c) =>
                !['long_text', 'multi_select', 'multi_link', 'lookup', 'file', 'image'].includes(
                  c.kind,
                ),
            )}
            onPick={(c) => {
              onDone({ target: { kind: 'column', column: c.ref } })
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

function sortLabel(order: OrderBy, query: BuilderQuery, columns: readonly ColumnOption[]): string {
  const target = order.target
  if (target.kind === 'aggregation') {
    const a = (query.aggregations ?? [])[target.index]
    return a === undefined ? '?' : describeAggregation(a, columns)
  }
  if (target.kind === 'breakout') {
    const b = (query.breakouts ?? [])[target.index]
    return b === undefined ? '?' : describeBreakout(b, columns)
  }
  return findColumn(columns, target.column)?.label ?? columnName(target.column)
}

// ── The notebook ────────────────────────────────────────────────────────────

export function Notebook({
  base,
  query,
  onChange,
  onRun,
  running,
}: {
  readonly base: DescribedBase
  /** `null` before a table is picked. */
  readonly query: BuilderQuery | null
  readonly onChange: (query: BuilderQuery) => void
  readonly onRun: () => void
  readonly running: boolean
}) {
  const columns = useMemo(() => (query === null ? [] : columnsOf(base, query)), [base, query])
  const valueLabel = useValueLabel()
  const [showSort, setShowSort] = useState((query?.sort ?? []).length > 0)
  const [showLimit, setShowLimit] = useState(query?.limit !== undefined && query?.limit !== null)
  const source = query === null ? undefined : tableOf(base, query.source)

  const update = (patch: Partial<BuilderQuery>) => {
    if (query === null) return
    const next: Record<string, unknown> = { ...query, ...patch }
    for (const key of [
      'joins',
      'filters',
      'aggregations',
      'breakouts',
      'fields',
      'sort',
    ] as const) {
      const list = next[key]
      if (Array.isArray(list) && list.length === 0) next[key] = undefined
    }
    const { limit, ...rest } = next
    onChange((limit === null || limit === undefined ? rest : next) as unknown as BuilderQuery)
  }
  const filters = query?.filters ?? []
  const aggregations = query?.aggregations ?? []
  const breakouts = query?.breakouts ?? []
  const raw = aggregations.length === 0 && breakouts.length === 0

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
      <Step tone="data" title={$t('Données')}>
        <TablePicker
          base={base}
          value={query?.source ?? null}
          tone="data"
          placeholder={$t('Choisir une table')}
          onPick={(table) => onChange({ kind: 'builder', source: table.id })}
        />
        {query !== null && raw && source !== undefined && (
          <FieldsPicker
            columns={columns}
            fields={query.fields}
            onChange={(fields) => update({ fields: fields ?? [] })}
          />
        )}
      </Step>

      {query !== null && (
        <>
          {(query.joins ?? []).map((_, index) => (
            <JoinStep
              // biome-ignore lint/suspicious/noArrayIndexKey: joins are edited in place, by position
              key={index}
              base={base}
              query={query}
              index={index}
              onChange={(join) =>
                update({
                  joins: (query.joins ?? []).map((j, i) => (i === index ? join : j)),
                })
              }
              onRemove={() => {
                const alias = (query.joins ?? [])[index]?.alias
                const keep = <T extends { join?: string }>(list: readonly T[] | undefined) =>
                  (list ?? []).filter((x) => x.join !== alias)
                update({
                  joins: (query.joins ?? []).filter((_, i) => i !== index),
                  filters: filters.filter((f) =>
                    'column' in f ? f.column.join !== alias : f.join !== alias,
                  ),
                  aggregations: aggregations.filter((a) => a.column?.join !== alias),
                  breakouts: keep(breakouts),
                  ...(query.fields === undefined ? {} : { fields: keep(query.fields) }),
                  sort: [],
                })
              }}
            />
          ))}
          <div className="flex gap-2">
            {source !== undefined && (query.joins ?? []).length < 4 && (
              <StepAction
                icon={Combine}
                label={$t('Joindre des données')}
                onClick={() => {
                  const suggestion = joinSuggestions(base, source).find(
                    (s) => !(query.joins ?? []).some((j) => j.table === s.table.id),
                  )
                  const table =
                    suggestion?.table ?? base.tables.find((t) => t.id !== source.id) ?? source
                  update({
                    joins: [
                      ...(query.joins ?? []),
                      {
                        alias: joinAlias(query, table),
                        table: table.id,
                        kind: 'left',
                        left: suggestion?.left ?? { field: '_id' },
                        right: suggestion?.right ?? '_id',
                      },
                    ],
                  })
                }}
              />
            )}
          </div>

          <Step tone="filter" title={$t('Filtre')}>
            {filters.map((f, index) => (
              <FilterPopover
                // biome-ignore lint/suspicious/noArrayIndexKey: filters are edited in place, by position
                key={index}
                base={base}
                query={query}
                columns={columns}
                filter={f}
                onDone={(next) =>
                  update({ filters: filters.map((x, i) => (i === index ? next : x)) })
                }
              >
                <Chip
                  tone="filter"
                  onRemove={() => update({ filters: filters.filter((_, i) => i !== index) })}
                >
                  {describeFilter(f, columns, valueLabel)}
                </Chip>
              </FilterPopover>
            ))}
            <FilterPopover
              base={base}
              query={query}
              columns={columns}
              onDone={(f) => update({ filters: [...filters, f] })}
            >
              {filters.length === 0 ? (
                <AddButton tone="filter">
                  {$t('Ajouter des filtres pour préciser votre réponse')}
                </AddButton>
              ) : (
                <AddButton tone="filter" aria-label={$t('Ajouter un filtre')}>
                  <Plus className="size-4" />
                </AddButton>
              )}
            </FilterPopover>
          </Step>

          <section className="space-y-1.5">
            <h3 className={cn('text-sm font-semibold', TONES.summarize.title)}>{$t('Résumer')}</h3>
            <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr]">
              <div
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg p-3',
                  TONES.summarize.panel,
                )}
              >
                {aggregations.map((a, index) => (
                  <AggregationPopover
                    // biome-ignore lint/suspicious/noArrayIndexKey: aggregates are edited in place, by position
                    key={index}
                    columns={columns}
                    value={a}
                    onDone={(next) =>
                      update({ aggregations: aggregations.map((x, i) => (i === index ? next : x)) })
                    }
                  >
                    <Chip
                      tone="summarize"
                      onRemove={() =>
                        update({
                          aggregations: aggregations.filter((_, i) => i !== index),
                          sort: (query.sort ?? []).filter((s) => s.target.kind !== 'aggregation'),
                        })
                      }
                    >
                      {describeAggregation(a, columns)}
                    </Chip>
                  </AggregationPopover>
                ))}
                <AggregationPopover
                  columns={columns}
                  onDone={(a) => update({ aggregations: [...aggregations, a] })}
                >
                  {aggregations.length === 0 ? (
                    <AddButton tone="summarize">
                      {$t('Choisir une fonction ou une métrique')}
                    </AddButton>
                  ) : (
                    <AddButton tone="summarize" aria-label={$t('Ajouter un agrégat')}>
                      <Plus className="size-4" />
                    </AddButton>
                  )}
                </AggregationPopover>
              </div>
              <span className="self-center text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {$t('par')}
              </span>
              <div
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg p-3',
                  TONES.summarize.panel,
                )}
              >
                {breakouts.map((b, index) => (
                  <BreakoutPopover
                    // biome-ignore lint/suspicious/noArrayIndexKey: groupings are edited in place, by position
                    key={index}
                    columns={columns}
                    onDone={(next) =>
                      update({ breakouts: breakouts.map((x, i) => (i === index ? next : x)) })
                    }
                  >
                    <Chip
                      tone="summarize"
                      onRemove={() =>
                        update({
                          breakouts: breakouts.filter((_, i) => i !== index),
                          sort: (query.sort ?? []).filter((s) => s.target.kind !== 'breakout'),
                        })
                      }
                    >
                      {describeBreakout(b, columns)}
                    </Chip>
                  </BreakoutPopover>
                ))}
                {breakouts.length < 3 && (
                  <BreakoutPopover
                    columns={columns}
                    onDone={(b) => update({ breakouts: [...breakouts, b] })}
                  >
                    {breakouts.length === 0 ? (
                      <AddButton tone="summarize">
                        {$t('Choisissez une colonne de regroupement')}
                      </AddButton>
                    ) : (
                      <AddButton tone="summarize" aria-label={$t('Ajouter un regroupement')}>
                        <Plus className="size-4" />
                      </AddButton>
                    )}
                  </BreakoutPopover>
                )}
              </div>
            </div>
          </section>

          <div className="flex gap-2">
            {!showSort && (
              <StepAction
                icon={ArrowUpDown}
                label={$t('Trier')}
                onClick={() => setShowSort(true)}
              />
            )}
            {!showLimit && (
              <StepAction
                icon={ListOrdered}
                label={$t('Limiter')}
                onClick={() => setShowLimit(true)}
              />
            )}
          </div>

          {showSort && (
            <Step
              tone="neutral"
              title={$t('Trier')}
              onRemove={() => {
                setShowSort(false)
                update({ sort: [] })
              }}
            >
              {(query.sort ?? []).map((order, index) => (
                <Hint
                  // biome-ignore lint/suspicious/noArrayIndexKey: sort terms are edited in place, by position
                  key={index}
                  label={$t('Inverser l’ordre')}
                >
                  {/* Chip forwards props onto its inner button, not its outer span. */}
                  <span className="inline-flex">
                    <Chip
                      tone="neutral"
                      onClick={() =>
                        update({
                          sort: (query.sort ?? []).map((s, i) =>
                            i === index ? { ...s, desc: s.desc !== true } : s,
                          ),
                        })
                      }
                      onRemove={() =>
                        update({ sort: (query.sort ?? []).filter((_, i) => i !== index) })
                      }
                    >
                      {order.desc === true ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      )}
                      {sortLabel(order, query, columns)}
                    </Chip>
                  </span>
                </Hint>
              ))}
              <SortPopover
                query={query}
                columns={columns}
                onDone={(o) => update({ sort: [...(query.sort ?? []), o] })}
              >
                <AddButton tone="neutral">
                  <Plus className="size-4" />
                  {(query.sort ?? []).length === 0 && $t('Choisir une colonne')}
                </AddButton>
              </SortPopover>
            </Step>
          )}

          {showLimit && (
            <Step
              tone="neutral"
              title={$t('Limite')}
              onRemove={() => {
                setShowLimit(false)
                update({ limit: null })
              }}
            >
              <Input
                type="number"
                min={1}
                max={2000}
                value={query.limit ?? ''}
                onChange={(e) =>
                  update({
                    limit: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                  })
                }
                placeholder={$t('Nombre de lignes')}
                aria-label={$t('Nombre de lignes au plus')}
                className="h-9 w-40 bg-background"
              />
            </Step>
          )}

          <Button onClick={onRun} disabled={running} className="h-10 w-full max-w-xs">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {$t('Visualiser')}
          </Button>
        </>
      )}
    </div>
  )
}

/** The columns a question reads as they are: all of them, or those ticked. */
function FieldsPicker({
  columns,
  fields,
  onChange,
}: {
  readonly columns: readonly ColumnOption[]
  readonly fields: BuilderQuery['fields']
  readonly onChange: (fields: BuilderQuery['fields'] | undefined) => void
}) {
  const business = columns.filter((c) => c.field.system !== true)
  const chosen = fields ?? business.map((c) => c.ref)
  const has = (c: ColumnOption) =>
    chosen.some((f) => f.field === c.ref.field && (f.join ?? '') === (c.ref.join ?? ''))
  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
        >
          <Columns3 className="size-4" />
          {fields === undefined
            ? $t('Toutes les colonnes')
            : $tp(fields.length, '{count} colonne', '{count} colonnes')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="mb-2 flex justify-between text-xs">
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-primary hover:underline"
          >
            {$t('Toutes')}
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-muted-foreground hover:underline"
          >
            {$t('Aucune')}
          </button>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto scroll-discret">
          {columns.map((c) => (
            <label
              key={`${c.ref.join ?? ''}.${c.ref.field}`}
              className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={has(c)}
                onChange={() =>
                  onChange(
                    has(c)
                      ? chosen.filter(
                          (f) =>
                            !(f.field === c.ref.field && (f.join ?? '') === (c.ref.join ?? '')),
                        )
                      : [...chosen, c.ref],
                  )
                }
              />
              <span className="truncate">{c.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
