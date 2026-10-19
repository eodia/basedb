'use client'

import { ColumnList } from '@/components/app/analytics/column-picker'
import {
  ExpressionFilterEditor,
  FilterEditor,
  useValueLabel,
} from '@/components/app/analytics/filter-editor'
import { JoinEditor } from '@/components/app/analytics/join-editor'
import { JoinGlyph } from '@/components/app/analytics/join-glyph'
import { TableColumns } from '@/components/app/analytics/table-columns'
import { TableList } from '@/components/app/analytics/table-picker'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Hint } from '@/components/ui/tooltip'
import {
  type ColumnOption,
  FN_LABELS,
  aggregationsFor,
  breakoutOn,
  columnsOf,
  compactQuery,
  describeAggregation,
  describeBreakout,
  describeFilter,
  findColumn,
  groupable,
  reachableColumns,
  settleQuery,
  tableOf,
  withJoinFor,
  withoutJoin,
} from '@/lib/analytics/model'
import type { DescribedBase, Table } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  type Aggregation,
  type AggregationFn,
  type Breakout,
  type BuilderQuery,
  COLUMNLESS_FNS,
  type Filter,
  type Join,
  type OrderBy,
  QUERY_LIMITS,
  columnName,
} from '@basedb/contracts'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Columns3,
  Database,
  Filter as FilterIcon,
  Link2,
  ListOrdered,
  Plus,
  Sigma,
  Table2,
  X,
} from 'lucide-react'
import { type ComponentProps, type ReactNode, useEffect, useMemo, useState } from 'react'

/**
 * The notebook of a question — chapter 18 §3, with the mouse: the data and the tables joined
 * to it, the filters, the aggregates by groups, the columns, the order and the bound, one
 * step under the other, each coloured by what it does. It is the left pane of the editor, and
 * the question runs again by itself as it changes: there is no button to press.
 *
 * Every column of a table the source links to is offered at every step. Choosing one adds the
 * join (marked `implicit`, in the query); the last step citing it takes it away again.
 */

type Tone = 'data' | 'filter' | 'summarize' | 'sort'

const TONES: Readonly<Record<Tone, string>> = {
  data: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  filter: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  summarize: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  sort: 'bg-muted text-foreground/80',
}

function Step({
  icon: Icon,
  title,
  tone,
  children,
}: {
  readonly icon: typeof Database
  readonly title: string
  readonly tone: Tone
  readonly children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span
          className={cn('inline-flex size-5 items-center justify-center rounded-md', TONES[tone])}
        >
          <Icon className="size-3" />
        </span>
        <span className="flex-1">{title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card p-2.5">
        {children}
      </div>
    </section>
  )
}

function Pill({
  tone,
  children,
  onClick,
  onRemove,
}: {
  readonly tone: Tone
  readonly children: ReactNode
  readonly onClick?: () => void
  readonly onRemove?: () => void
}) {
  return (
    <span
      className={cn(
        'inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg pl-2.5 text-sm font-medium',
        onRemove === undefined ? 'pr-2.5' : 'pr-1',
        TONES[tone],
      )}
    >
      <button type="button" onClick={onClick} className="truncate text-left">
        {children}
      </button>
      {onRemove !== undefined && (
        <button
          type="button"
          // The pill is often the trigger of a popover: removing it must not open that one.
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={$t('Retirer')}
          className="rounded p-0.5 opacity-60 hover:bg-foreground/10 hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  )
}

/**
 * The trigger of a popover that adds a step: a dashed button, its label after a plus. It is
 * the child of a `PopoverTrigger asChild`, which hands it the props — and the ref — of a button.
 */
function AddButton({
  label,
  className,
  ...props
}: { readonly label?: string } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary',
        className,
      )}
      {...props}
    >
      <Plus className="size-3.5" />
      {label}
    </button>
  )
}

/** A popover opened by a pill, a chip or a dashed button, and closed by what it picks. */
function Picker({
  trigger,
  width = 'w-72',
  open,
  onOpenChange,
  children,
}: {
  readonly trigger: ReactNode
  readonly width?: string
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly children: ReactNode
}) {
  const [own, setOwn] = useState(false)
  const shown = open ?? own
  const change = onOpenChange ?? setOwn
  return (
    <Popover modal open={shown} onOpenChange={change}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className={width}>
        {children}
      </PopoverContent>
    </Popover>
  )
}

// ── The data ────────────────────────────────────────────────────────────────

function SourcePicker({
  base,
  value,
  onPick,
}: {
  readonly base: DescribedBase
  readonly value: string | null
  readonly onPick: (table: Table) => void
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
    <Picker
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold',
            table === undefined
              ? 'border border-dashed border-sky-500/50 text-sky-700 dark:text-sky-300'
              : TONES.data,
          )}
        >
          <Table2 className="size-4" />
          {table === undefined ? $t('Choisir une table') : table.label}
        </button>
      }
    >
      <TableList
        tables={base.tables}
        onPick={(t) => {
          onPick(t)
          setOpen(false)
        }}
      />
    </Picker>
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
  readonly onDone: (filter: Filter, column?: ColumnOption) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const initialColumn =
    filter !== undefined && 'column' in filter ? findColumn(columns, filter.column) : undefined
  const [column, setColumn] = useState<ColumnOption | undefined>(initialColumn)
  const [expression, setExpression] = useState(filter !== undefined && 'expression' in filter)
  const done = (f: Filter, picked?: ColumnOption) => {
    onDone(f, picked)
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
      <PopoverContent align="start" className="w-auto min-w-72">
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
            // The values offered are read through the join the column comes by, not yet in.
            query={withJoinFor(query, column)}
            column={column}
            initial={filter}
            onDone={(f) => done(f, column)}
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
  readonly onDone: (aggregation: Aggregation, column?: ColumnOption) => void
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
      <PopoverContent align="start" className="w-72">
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
                onDone({ fn, column: c.ref }, c)
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
  readonly onDone: (breakout: Breakout, column: ColumnOption) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80">
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
              c,
            )
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ── Sort ────────────────────────────────────────────────────────────────────

const UNSORTABLE = ['long_text', 'multi_select', 'multi_link', 'lookup', 'file', 'image']

function SortPopover({
  query,
  columns,
  onDone,
  children,
}: {
  readonly query: BuilderQuery
  readonly columns: readonly ColumnOption[]
  readonly onDone: (order: OrderBy, column?: ColumnOption) => void
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const grouped = (query.aggregations ?? []).length > 0 || (query.breakouts ?? []).length > 0
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72">
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
            columns={columns.filter((c) => !UNSORTABLE.includes(c.kind))}
            onPick={(c) => {
              onDone({ target: { kind: 'column', column: c.ref } }, c)
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
}: {
  readonly base: DescribedBase
  /** `null` before a table is picked. */
  readonly query: BuilderQuery | null
  readonly onChange: (query: BuilderQuery) => void
}) {
  const columns = useMemo(
    () => (query === null ? [] : reachableColumns(base, query)),
    [base, query],
  )
  const valueLabel = useValueLabel()
  const [joinOpen, setJoinOpen] = useState<string | 'new' | null>(null)
  const source = query === null ? undefined : tableOf(base, query.source)

  /**
   * The question after a change: the joins the columns chosen need added, the lists left
   * empty and the bound left out dropped, the joins nothing cites any more taken away.
   */
  const commit = (next: BuilderQuery, ...chosen: Array<ColumnOption | undefined>) => {
    let full = next
    for (const column of chosen) full = withJoinFor(full, column)
    onChange(settleQuery(base, compactQuery(full)))
  }
  const update = (patch: Partial<BuilderQuery>, ...chosen: Array<ColumnOption | undefined>) => {
    if (query !== null) commit({ ...query, ...patch }, ...chosen)
  }

  const joins = query?.joins ?? []
  const filters = query?.filters ?? []
  const aggregations = query?.aggregations ?? []
  const breakouts = query?.breakouts ?? []
  const sort = query?.sort ?? []
  const listing = aggregations.length === 0 && breakouts.length === 0

  const sourceColumns = columns.filter((c) => c.join === undefined)
  const written = joins.filter((j) => j.implicit !== true)
  const related = columns.filter((c) => c.join?.implicit === true)

  return (
    <div className="space-y-5 p-4">
      <Step icon={Database} title={$t('Données')} tone="data">
        <SourcePicker
          base={base}
          value={query?.source ?? null}
          onPick={(table) => onChange({ kind: 'builder', source: table.id })}
        />
        {joins.map((j) => {
          const joined = tableOf(base, j.table)
          const name = joined?.label ?? j.alias
          if (j.implicit === true) {
            return (
              <Hint key={j.alias} label={$t('Jointure ajoutée par une colonne choisie.')}>
                <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-muted px-2.5 text-xs text-muted-foreground">
                  <Link2 className="size-3" />
                  {name}
                </span>
              </Hint>
            )
          }
          return (
            <Picker
              key={j.alias}
              width="w-auto"
              open={joinOpen === j.alias}
              onOpenChange={(o) => setJoinOpen(o ? j.alias : null)}
              trigger={
                <span>
                  <Pill
                    tone="data"
                    onRemove={() => {
                      if (query !== null) commit(withoutJoin(query, j.alias))
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <JoinGlyph kind={j.kind} className="h-3.5 w-[22px]" />
                      {name}
                    </span>
                  </Pill>
                </span>
              }
            >
              {query !== null && (
                <JoinEditor
                  base={base}
                  query={query}
                  initial={j}
                  onApply={(next: Join) => {
                    update({ joins: joins.map((x) => (x.alias === j.alias ? next : x)) })
                    setJoinOpen(null)
                  }}
                  onRemove={() => {
                    commit(withoutJoin(query, j.alias))
                    setJoinOpen(null)
                  }}
                />
              )}
            </Picker>
          )
        })}
        {query !== null && source !== undefined && joins.length < QUERY_LIMITS.joins && (
          <Picker
            width="w-auto"
            open={joinOpen === 'new'}
            onOpenChange={(o) => setJoinOpen(o ? 'new' : null)}
            trigger={<AddButton label={$t('Joindre des données')} />}
          >
            <JoinEditor
              base={base}
              query={query}
              onApply={(next) => {
                // Columns chosen one by one take the new table's in, as they would have by default.
                const added = columnsOf(base, { ...query, joins: [...joins, next] })
                  .filter((c) => c.join?.alias === next.alias && c.field.system !== true)
                  .map((c) => c.ref)
                update({
                  joins: [...joins, next],
                  ...(query.fields === undefined ? {} : { fields: [...query.fields, ...added] }),
                })
                setJoinOpen(null)
              }}
            />
          </Picker>
        )}
      </Step>

      {query !== null && (
        <>
          <Step icon={FilterIcon} title={$t('Filtrer')} tone="filter">
            {filters.map((f, index) => (
              <FilterPopover
                // biome-ignore lint/suspicious/noArrayIndexKey: filters are edited in place, by position
                key={index}
                base={base}
                query={query}
                columns={columns}
                filter={f}
                onDone={(next, column) =>
                  update({ filters: filters.map((x, i) => (i === index ? next : x)) }, column)
                }
              >
                <span>
                  <Pill
                    tone="filter"
                    onRemove={() => update({ filters: filters.filter((_, i) => i !== index) })}
                  >
                    {describeFilter(f, columns, valueLabel)}
                  </Pill>
                </span>
              </FilterPopover>
            ))}
            <FilterPopover
              base={base}
              query={query}
              columns={columns}
              onDone={(f, column) => update({ filters: [...filters, f] }, column)}
            >
              <AddButton label={$t('Filtre')} />
            </FilterPopover>
          </Step>

          <Step icon={Sigma} title={$t('Résumer')} tone="summarize">
            {aggregations.map((a, index) => (
              <AggregationPopover
                // biome-ignore lint/suspicious/noArrayIndexKey: aggregates are edited in place, by position
                key={index}
                columns={columns}
                value={a}
                onDone={(next, column) =>
                  update(
                    { aggregations: aggregations.map((x, i) => (i === index ? next : x)) },
                    column,
                  )
                }
              >
                <span>
                  <Pill
                    tone="summarize"
                    onRemove={() =>
                      update({
                        aggregations: aggregations.filter((_, i) => i !== index),
                        sort: sort.filter((s) => s.target.kind !== 'aggregation'),
                      })
                    }
                  >
                    {describeAggregation(a, columns)}
                  </Pill>
                </span>
              </AggregationPopover>
            ))}
            <AggregationPopover
              columns={columns}
              onDone={(a, column) => update({ aggregations: [...aggregations, a] }, column)}
            >
              <AddButton label={$t('Mesure')} />
            </AggregationPopover>
            <span className="self-center px-1 text-sm text-muted-foreground">{$t('par')}</span>
            {breakouts.map((b, index) => (
              <BreakoutPopover
                // biome-ignore lint/suspicious/noArrayIndexKey: groupings are edited in place, by position
                key={index}
                columns={columns}
                onDone={(next, column) =>
                  update({ breakouts: breakouts.map((x, i) => (i === index ? next : x)) }, column)
                }
              >
                <span>
                  <Pill
                    tone="summarize"
                    onRemove={() =>
                      update({
                        breakouts: breakouts.filter((_, i) => i !== index),
                        sort: sort.filter((s) => s.target.kind !== 'breakout'),
                      })
                    }
                  >
                    {describeBreakout(b, columns)}
                  </Pill>
                </span>
              </BreakoutPopover>
            ))}
            {breakouts.length < QUERY_LIMITS.breakouts && (
              <BreakoutPopover
                columns={columns}
                onDone={(b, column) => update({ breakouts: [...breakouts, b] }, column)}
              >
                <AddButton label={$t('Regroupement')} />
              </BreakoutPopover>
            )}
          </Step>

          <Step icon={Columns3} title={$t('Colonnes')} tone="sort">
            {listing ? (
              <>
                <TableColumns
                  base={base}
                  query={query}
                  label={source?.label ?? query.source}
                  icon={<Table2 className="size-4 shrink-0" />}
                  options={sourceColumns}
                  tone={TONES.data}
                  onChange={commit}
                />
                {written.map((j) => (
                  <TableColumns
                    key={j.alias}
                    base={base}
                    query={query}
                    label={tableOf(base, j.table)?.label ?? j.alias}
                    icon={<JoinGlyph kind={j.kind} className="h-3.5 w-[22px]" />}
                    options={columns.filter((c) => c.join?.alias === j.alias)}
                    tone={TONES.data}
                    onChange={commit}
                  />
                ))}
                {related.length > 0 && (
                  <TableColumns
                    base={base}
                    query={query}
                    label={$t('Tables liées')}
                    icon={<Link2 className="size-4 shrink-0" />}
                    options={related}
                    tone={TONES.sort}
                    onChange={commit}
                  />
                )}
              </>
            ) : (
              <span className="self-center text-sm text-muted-foreground">
                {$t('Le résumé décide des colonnes du résultat.')}
              </span>
            )}
          </Step>

          <Step icon={ListOrdered} title={$t('Trier et limiter')} tone="sort">
            {sort.map((order, index) => (
              <Hint
                // biome-ignore lint/suspicious/noArrayIndexKey: sort terms are edited in place, by position
                key={index}
                label={$t('Inverser l’ordre')}
              >
                <span className="inline-flex">
                  <Pill
                    tone="sort"
                    onClick={() =>
                      update({
                        sort: sort.map((s, i) =>
                          i === index ? { ...s, desc: s.desc !== true } : s,
                        ),
                      })
                    }
                    onRemove={() => update({ sort: sort.filter((_, i) => i !== index) })}
                  >
                    <span className="inline-flex items-center gap-1">
                      {order.desc === true ? (
                        <ArrowDownAZ className="size-3.5" />
                      ) : (
                        <ArrowUpAZ className="size-3.5" />
                      )}
                      {sortLabel(order, query, columns)}
                    </span>
                  </Pill>
                </span>
              </Hint>
            ))}
            {sort.length < QUERY_LIMITS.sort && (
              <SortPopover
                query={query}
                columns={columns}
                onDone={(o, column) => update({ sort: [...sort, o] }, column)}
              >
                <AddButton label={$t('Tri')} />
              </SortPopover>
            )}
            <span className="flex items-center gap-1.5 pl-2 text-sm text-muted-foreground">
              {$t('Limite')}
              <Input
                type="number"
                min={1}
                max={QUERY_LIMITS.rows}
                value={query.limit ?? ''}
                onChange={(e) =>
                  update({
                    limit: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                  })
                }
                placeholder={$t('aucune')}
                aria-label={$t('Nombre de lignes au plus')}
                className="h-8 w-24"
              />
            </span>
          </Step>
        </>
      )}
    </div>
  )
}
