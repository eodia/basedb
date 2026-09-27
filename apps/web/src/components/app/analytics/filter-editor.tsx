'use client'

import { DateInput } from '@/components/app/date-picker'
import { ExpressionEditor } from '@/components/app/expression-editor'
import { OptionBadge } from '@/components/app/option-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Choice } from '@/components/ui/choice'
import { Input } from '@/components/ui/input'
import { valueText } from '@/lib/analytics/format'
import {
  type ColumnOption,
  DATE_PRESETS,
  OP_LABELS,
  VALUELESS,
  filterOpsFor,
  isNumeric,
  isTemporal,
  tableOf,
} from '@/lib/analytics/model'
import { type DescribedBase, api } from '@/lib/api/client'
import { displayStored, storedFromText } from '@/lib/dates'
import { $t } from '@/lib/i18n'
import { memberName, useMembers } from '@/lib/members'
import { cn } from '@/lib/utils'
import type { BuilderQuery, Filter, FilterOp, FilterValue } from '@basedb/contracts'
import { Check, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

/**
 * A filter of the builder, edited — chapter 18 §3: the operators a column's kind offers,
 * then its values the way that kind is best picked: a choice among its options, a person
 * among the members, a period among the usual ones, a relation among the rows it reaches.
 */

// ── Values a column holds ───────────────────────────────────────────────────

export interface ValueChoice {
  readonly value: string
  readonly label: string
  readonly color?: string | null
}

/**
 * The values to pick a column's filter among: a choice's options, the members, or the most
 * frequent values the reader can see, read by a question of their own.
 */
export function useColumnValues(
  /** `null` where there is no base to ask — a shared dashboard's page. */
  base: DescribedBase | null,
  query: Pick<BuilderQuery, 'source' | 'joins'> | null,
  column: ColumnOption | null,
): { readonly values: readonly ValueChoice[]; readonly loading: boolean } {
  const members = useMembers()
  const [state, setState] = useState<{ values: ValueChoice[]; loading: boolean }>({
    values: [],
    loading: false,
  })
  const kind = column?.kind ?? ''
  const fixed = useMemo((): ValueChoice[] | null => {
    if (column === null) return []
    if (kind === 'select' || kind === 'multi_select') {
      const field = column.field.valueField ?? column.field
      return (field.options ?? []).map((o) => ({
        value: o.value,
        label: o.label,
        color: o.color ?? null,
      }))
    }
    if (kind === 'user')
      return members.map((m) => ({ value: m.id, label: memberName(members, m.id) }))
    if (kind === 'boolean')
      return [
        { value: 'true', label: $t('Oui') },
        { value: 'false', label: $t('Non') },
      ]
    return null
  }, [column, kind, members])
  const key =
    column === null || query === null ? '' : JSON.stringify([query.source, query.joins, column.ref])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says what is read
  useEffect(() => {
    if (fixed !== null || column === null || query === null || base === null) return
    const controller = new AbortController()
    setState({ values: [], loading: true })
    api
      .runQuestion(
        base.name,
        {
          query: {
            kind: 'builder',
            source: query.source,
            ...(query.joins === undefined ? {} : { joins: query.joins }),
            breakouts: [column.ref],
            aggregations: [{ fn: 'count' }],
            sort: [{ target: { kind: 'aggregation', index: 0 }, desc: true }],
            limit: 300,
          },
        },
        controller.signal,
      )
      .then((result) => {
        const dimension = result.columns[0]
        const values = result.rows
          .filter((r) => r[0] !== null && r[0] !== '')
          .map((r) => ({
            value: String(r[0]),
            label:
              dimension === undefined
                ? String(r[0])
                : valueText(dimension, r[0], { base, members }),
          }))
        setState({ values, loading: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ values: [], loading: false })
      })
    return () => controller.abort()
  }, [key, fixed])
  return fixed === null ? state : { values: fixed, loading: false }
}

/** A list of values to tick, searched as one types. */
export function ValuePicker({
  choices,
  loading,
  selected,
  onChange,
  multiple = true,
}: {
  readonly choices: readonly ValueChoice[]
  readonly loading: boolean
  readonly selected: readonly string[]
  readonly onChange: (next: string[]) => void
  readonly multiple?: boolean
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q === '' ? choices : choices.filter((c) => c.label.toLowerCase().includes(q))
  return (
    <div className="flex flex-col gap-2">
      {choices.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={$t('Chercher')}
            aria-label={$t('Chercher une valeur')}
            className="h-8 pl-7 text-sm"
          />
        </div>
      )}
      <div className="max-h-60 overflow-y-auto scroll-discret">
        {loading && <Loader2 className="m-2 size-4 animate-spin text-muted-foreground" />}
        {!loading && shown.length === 0 && (
          <p className="px-1 py-2 text-sm text-muted-foreground">{$t('Aucune valeur.')}</p>
        )}
        {shown.map((choice) => {
          const on = selected.includes(choice.value)
          return (
            // biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control
            <label
              key={choice.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
            >
              {multiple ? (
                <Checkbox
                  checked={on}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...selected, choice.value]
                        : selected.filter((v) => v !== choice.value),
                    )
                  }
                />
              ) : (
                <input
                  type="radio"
                  className="accent-primary"
                  checked={on}
                  onChange={() => onChange([choice.value])}
                />
              )}
              {choice.color !== undefined ? (
                <OptionBadge option={{ label: choice.label, color: choice.color }} />
              ) : (
                <span className="truncate">{choice.label}</span>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ── Days and periods ────────────────────────────────────────────────────────

/** One day, typed or picked, as `YYYY-MM-DD`. */
export function DayField({
  value,
  onChange,
  label,
}: {
  readonly value: string
  readonly onChange: (day: string) => void
  readonly label: string
}) {
  const [text, setText] = useState(value === '' ? '' : displayStored(value, 'date'))
  useEffect(() => setText(value === '' ? '' : displayStored(value, 'date')), [value])
  return (
    <DateInput
      kind="date"
      text={text}
      onTextChange={setText}
      onCommit={(typed) => {
        const stored = storedFromText(typed, 'date')
        if (stored === null) onChange('')
        else if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) onChange(stored)
      }}
      appearance="form"
      clearable
      aria-label={label}
    />
  )
}

/**
 * A period: one of the usual relative ones, or days of one's own — what a date filter of
 * a question and of a dashboard both take, as an expression (`past30days`, `2026-01-01~`).
 */
export function PeriodPicker({
  value,
  onChange,
}: {
  readonly value: string
  readonly onChange: (expression: string) => void
}) {
  const custom = value !== '' && !DATE_PRESETS.some((p) => p.value === value)
  const [from, to] = value.includes('~')
    ? value.split('~')
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? [value, value]
      : ['', '']
  const [range, setRange] = useState({ from: from ?? '', to: to ?? '' })
  const [past, setPast] = useState(() => {
    const m = /^past(\d+)(day|week|month|year)s?$/.exec(value)
    return m === null ? { n: 7, unit: 'day' } : { n: Number(m[1]), unit: m[2] as string }
  })
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={cn(
              'flex items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-accent',
              value === p.value && 'bg-primary/10 font-medium text-primary',
            )}
          >
            {p.label}
            {value === p.value && <Check className="size-3.5" />}
          </button>
        ))}
      </div>
      <div className="space-y-1.5 border-t pt-2">
        <p className="text-xs font-medium text-muted-foreground">{$t('Les derniers')}</p>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={999}
            value={past.n}
            onChange={(e) =>
              setPast((p) => ({ ...p, n: Math.max(1, Number(e.target.value) || 1) }))
            }
            aria-label={$t('Combien de périodes')}
            className="h-8 w-20"
          />
          <Choice
            value={past.unit}
            onValueChange={(unit) => setPast((p) => ({ ...p, unit }))}
            options={[
              { value: 'day', label: $t('jours') },
              { value: 'week', label: $t('semaines') },
              { value: 'month', label: $t('mois') },
              { value: 'year', label: $t('années') },
            ]}
            aria-label={$t('Quelle période')}
            className="w-auto min-w-24"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => onChange(`past${past.n}${past.unit}s`)}
          >
            {$t('Appliquer')}
          </Button>
        </div>
      </div>
      <div className={cn('space-y-1.5 border-t pt-2', custom && 'rounded-md')}>
        <p className="text-xs font-medium text-muted-foreground">{$t('Du … au …')}</p>
        <div className="grid grid-cols-2 gap-1.5">
          <DayField
            value={range.from}
            onChange={(from) => setRange((r) => ({ ...r, from }))}
            label={$t('Premier jour')}
          />
          <DayField
            value={range.to}
            onChange={(to) => setRange((r) => ({ ...r, to }))}
            label={$t('Dernier jour')}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full"
          disabled={range.from === '' && range.to === ''}
          onClick={() => onChange(`${range.from}~${range.to}`)}
        >
          {$t('Appliquer ces dates')}
        </Button>
      </div>
    </div>
  )
}

// ── A filter ────────────────────────────────────────────────────────────────

const defaultOp = (kind: string): FilterOp => {
  if (isTemporal(kind)) return 'date'
  if (isNumeric(kind)) return 'eq'
  return filterOpsFor(kind)[0] ?? 'is'
}

export function FilterEditor({
  base,
  query,
  column,
  initial,
  onDone,
  onBack,
}: {
  readonly base: DescribedBase
  readonly query: BuilderQuery
  readonly column: ColumnOption
  readonly initial?: Filter
  readonly onDone: (filter: Filter) => void
  readonly onBack?: () => void
}) {
  const kind = column.kind
  const start = initial !== undefined && 'op' in initial ? initial : undefined
  const [op, setOp] = useState<FilterOp>(start?.op ?? defaultOp(kind))
  const [values, setValues] = useState<FilterValue[]>(start === undefined ? [] : [...start.values])
  const picks = ['is', 'is_not', 'has_any', 'has_all', 'has_none'].includes(op)
  const { values: choices, loading } = useColumnValues(
    base,
    picks ? query : null,
    picks ? column : null,
  )
  const text = (i: number) => (values[i] === undefined ? '' : String(values[i]))
  const setAt = (i: number, v: FilterValue) =>
    setValues((list) => {
      const next = [...list]
      next[i] = v
      return next
    })
  const number = isNumeric(kind)
  const parse = (raw: string): FilterValue =>
    number && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw
  const ready =
    VALUELESS.has(op) ||
    (op === 'between'
      ? values.length === 2 && values.every((v) => v !== '')
      : values.some((v) => v !== ''))

  return (
    <div className="flex w-80 flex-col gap-3">
      <div className="flex items-center gap-2">
        {onBack !== undefined && (
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ←
          </button>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{column.label}</span>
        <Choice
          value={op}
          onValueChange={(next) => {
            setOp(next as FilterOp)
            setValues([])
          }}
          options={filterOpsFor(kind).map((o) => ({ value: o, label: OP_LABELS[o] }))}
          aria-label={$t('Opérateur')}
          size="xs"
          className="w-auto min-w-28"
        />
      </div>

      {picks && (choices.length > 0 || loading) && (
        <ValuePicker
          choices={choices}
          loading={loading}
          selected={values.map(String)}
          onChange={(next) => setValues(next.map((v) => (kind === 'number' ? Number(v) : v)))}
        />
      )}
      {picks && choices.length === 0 && !loading && (
        <Input
          value={text(0)}
          onChange={(e) =>
            setValues(
              e.target.value
                .split(',')
                .map((s) => parse(s.trim()))
                .filter((s) => s !== ''),
            )
          }
          placeholder={$t('Valeurs, séparées par des virgules')}
          aria-label={$t('Valeurs')}
          className="h-8"
          autoFocus
        />
      )}
      {[
        'contains',
        'not_contains',
        'starts_with',
        'ends_with',
        'eq',
        'ne',
        'gt',
        'gte',
        'lt',
        'lte',
      ].includes(op) && (
        <Input
          type={number ? 'number' : 'text'}
          value={text(0)}
          onChange={(e) => setValues([parse(e.target.value)])}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ready) onDone({ column: column.ref, op, values })
          }}
          aria-label={$t('Valeur')}
          className="h-8"
          autoFocus
        />
      )}
      {op === 'between' && !isTemporal(kind) && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={text(0)}
            onChange={(e) => setAt(0, parse(e.target.value))}
            aria-label={$t('De')}
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">{$t('et')}</span>
          <Input
            type="number"
            value={text(1)}
            onChange={(e) => setAt(1, parse(e.target.value))}
            aria-label="À"
            className="h-8"
          />
        </div>
      )}
      {op === 'between' && isTemporal(kind) && (
        <div className="grid grid-cols-2 gap-1.5">
          <DayField value={text(0)} onChange={(d) => setAt(0, d)} label={$t('Du')} />
          <DayField value={text(1)} onChange={(d) => setAt(1, d)} label={$t('Au')} />
        </div>
      )}
      {(op === 'before' || op === 'after') && (
        <DayField value={text(0)} onChange={(d) => setValues([d])} label={$t('Jour')} />
      )}
      {op === 'date' && (
        <PeriodPicker
          value={text(0)}
          onChange={(expression) =>
            onDone({ column: column.ref, op: 'date', values: [expression] })
          }
        />
      )}

      {op !== 'date' && (
        <Button
          size="sm"
          disabled={!ready}
          onClick={() =>
            onDone({ column: column.ref, op, values: VALUELESS.has(op) ? [] : values })
          }
        >
          {initial === undefined ? $t('Ajouter le filtre') : $t('Mettre à jour le filtre')}
        </Button>
      )}
    </div>
  )
}

/** A filter written in the grammar of chapter 08 §4, on the source table. */
export function ExpressionFilterEditor({
  base,
  query,
  initial,
  onDone,
}: {
  readonly base: DescribedBase
  readonly query: BuilderQuery
  readonly initial?: string
  readonly onDone: (filter: Filter) => void
}) {
  const [text, setText] = useState(initial ?? '')
  const table = tableOf(base, query.source)
  const fields = (table?.fields ?? []).filter((f) => f.system !== true)
  return (
    <div className="flex w-96 flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {$t('Une expression de filtre, comme dans la barre des vues :')}{' '}
        <code>montant gt 100 and statut eq "fait"</code>.
      </p>
      <div className="min-h-9 rounded-md border">
        <ExpressionEditor
          value={text}
          fields={fields}
          placeholder={$t('statut eq "fait"')}
          onChange={setText}
          onRun={() => text.trim() !== '' && onDone({ expression: text.trim() })}
        />
      </div>
      <Button
        size="sm"
        disabled={text.trim() === ''}
        onClick={() => onDone({ expression: text.trim() })}
      >
        {$t('Appliquer l’expression')}
      </Button>
    </div>
  )
}

/** What a filter value reads as in a chip: a choice's label, a person's name. */
export function useValueLabel() {
  const members = useMembers()
  return (column: ColumnOption | undefined, value: unknown): string => {
    if (column === undefined) return String(value)
    if (column.kind === 'select' || column.kind === 'multi_select') {
      const field = column.field.valueField ?? column.field
      return field.options?.find((o) => o.value === value)?.label ?? String(value)
    }
    if (column.kind === 'user') return memberName(members, value)
    if (column.kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return displayStored(value, 'date')
    }
    return String(value)
  }
}
