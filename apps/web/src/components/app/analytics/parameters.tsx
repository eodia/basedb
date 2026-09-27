'use client'

import {
  PeriodPicker,
  type ValueChoice,
  ValuePicker,
  useColumnValues,
} from '@/components/app/analytics/filter-editor'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { PARAMETER_LABELS, hasValue } from '@/lib/analytics/dashboard'
import { type ColumnOption, PERIOD_UNITS, UNIT_LABELS, describeDate } from '@/lib/analytics/model'
import type { DescribedBase } from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type {
  BuilderQuery,
  DashboardParameter,
  NumberOperator,
  ParameterValue,
  TemporalTruncation,
} from '@basedb/contracts'
import { CalendarDays, ChevronDown, Hash, ListFilter, Rows3, Type, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'

/**
 * The filters of a dashboard — chapter 18 §4: one control per filter, above the cards it
 * drives; a period, values to pick, a text, bounds, or how dates are grouped.
 */

export const PARAMETER_ICONS = {
  date: CalendarDays,
  category: ListFilter,
  text: Type,
  number: Hash,
  temporal_unit: Rows3,
} as const

/** Where a filter's values come from: the first column a card ties it to. */
export interface ValueSource {
  readonly query: Pick<BuilderQuery, 'source' | 'joins'>
  readonly column: ColumnOption
}

const OPERATOR_LABELS: Readonly<Record<NumberOperator, string>> = {
  eq: $t('Égal à'),
  between: $t('Entre'),
  gte: $t('Au moins'),
  lte: $t('Au plus'),
}

/** A filter's value in a few words, for its control. */
export function describeValue(
  parameter: DashboardParameter,
  value: ParameterValue | null | undefined,
  labels: ReadonlyMap<string, string> = new Map(),
): string | null {
  if (!hasValue(value)) return null
  switch (parameter.type) {
    case 'date':
      return describeDate(String(value))
    case 'temporal_unit':
      return (
        UNIT_LABELS[String(Array.isArray(value) ? value[0] : value) as TemporalTruncation] ??
        String(value)
      )
    case 'text':
      return $t('contient « {String} »', { String: String(value) })
    case 'number': {
      const [a, b] = Array.isArray(value) ? value : [value]
      const n = (x: unknown) => (typeof x === 'number' ? x.toLocaleString(intlLocale()) : '…')
      switch (parameter.operator ?? 'eq') {
        case 'between':
          return `${n(a)} – ${n(b)}`
        case 'gte':
          return `≥ ${n(a)}`
        case 'lte':
          return `≤ ${n(b ?? a)}`
        default:
          return `= ${n(a)}`
      }
    }
    case 'category': {
      const list = (Array.isArray(value) ? value : [value]).map(
        (v) => labels.get(String(v)) ?? String(v),
      )
      return list.length > 2
        ? `${list.slice(0, 2).join(', ')} +${list.length - 2}`
        : list.join(', ')
    }
  }
}

/** The editor of a filter's value, by its type. */
export function ValueEditor({
  base,
  parameter,
  value,
  source,
  given,
  onChange,
}: {
  /** `null` on a shared dashboard's page, which lists its values through `given`. */
  readonly base: DescribedBase | null
  readonly parameter: DashboardParameter
  readonly value: ParameterValue | null
  readonly source: ValueSource | null
  /** The values to choose among, when they come from elsewhere than a card's column. */
  readonly given?: { readonly values: readonly ValueChoice[]; readonly loading: boolean }
  readonly onChange: (value: ParameterValue | null) => void
}) {
  const read = useColumnValues(
    given === undefined ? base : null,
    parameter.type === 'category' && given === undefined ? (source?.query ?? null) : null,
    parameter.type === 'category' && given === undefined ? (source?.column ?? null) : null,
  )
  const { values: choices, loading } = given ?? read
  const [text, setText] = useState(typeof value === 'string' ? value : '')
  const bounds = Array.isArray(value) ? value : []
  const [low, setLow] = useState(typeof bounds[0] === 'number' ? String(bounds[0]) : '')
  const [high, setHigh] = useState(typeof bounds[1] === 'number' ? String(bounds[1]) : '')

  switch (parameter.type) {
    case 'date':
      return <PeriodPicker value={typeof value === 'string' ? value : ''} onChange={onChange} />
    case 'temporal_unit':
      return (
        <div className="flex flex-col">
          {(parameter.units ?? PERIOD_UNITS).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => onChange(unit)}
              className={cn(
                'rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                value === unit && 'bg-primary/10 font-medium text-primary',
              )}
            >
              {UNIT_LABELS[unit]}
            </button>
          ))}
        </div>
      )
    case 'category':
      return source === null && given === undefined ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {$t('Reliez ce filtre à une carte pour choisir parmi ses valeurs.')}
          </p>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={$t('Valeurs, séparées par des virgules')}
            aria-label={$t('Valeurs')}
            className="h-8"
          />
          <Button
            size="sm"
            className="w-full"
            onClick={() =>
              onChange(
                text
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s !== ''),
              )
            }
          >
            {$t('Appliquer')}
          </Button>
        </div>
      ) : (
        <ValuePicker
          choices={choices}
          loading={loading}
          selected={(Array.isArray(value) ? value : []).map(String)}
          multiple={parameter.multiple !== false}
          onChange={(next) => onChange(next)}
        />
      )
    case 'text':
      return (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            onChange(text.trim() === '' ? null : text.trim())
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={$t('Contient…')}
            aria-label={$t('Texte')}
            className="h-8"
            autoFocus
          />
          <Button type="submit" size="sm" className="w-full">
            {$t('Appliquer')}
          </Button>
        </form>
      )
    case 'number': {
      const operator = parameter.operator ?? 'eq'
      const n = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s))
      return (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const next =
              operator === 'between'
                ? [n(low), n(high)]
                : operator === 'lte'
                  ? [null, n(low)]
                  : [n(low)]
            onChange(next.some((x) => x !== null) ? next : null)
          }}
        >
          <p className="text-xs text-muted-foreground">{OPERATOR_LABELS[operator]}</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={low}
              onChange={(e) => setLow(e.target.value)}
              aria-label={$t('Valeur')}
              className="h-8"
              autoFocus
            />
            {operator === 'between' && (
              <>
                <span className="text-xs text-muted-foreground">{$t('et')}</span>
                <Input
                  type="number"
                  value={high}
                  onChange={(e) => setHigh(e.target.value)}
                  aria-label={$t('Borne haute')}
                  className="h-8"
                />
              </>
            )}
          </div>
          <Button type="submit" size="sm" className="w-full">
            {$t('Appliquer')}
          </Button>
        </form>
      )
    }
  }
}

/** A filter's control in the bar. */
export function ParameterControl({
  base,
  parameter,
  value,
  source,
  given,
  labels,
  onChange,
  selected = false,
  onSelect,
}: {
  readonly base: DescribedBase | null
  readonly parameter: DashboardParameter
  readonly value: ParameterValue | null
  readonly source: ValueSource | null
  readonly given?: { readonly values: readonly ValueChoice[]; readonly loading: boolean }
  readonly labels?: ReadonlyMap<string, string>
  readonly onChange: (value: ParameterValue | null) => void
  /** Being edited: its ties shown on the cards. */
  readonly selected?: boolean
  /** In edit mode, a click selects the filter rather than opening its value. */
  readonly onSelect?: () => void
}) {
  const [open, setOpen] = useState(false)
  const Icon = PARAMETER_ICONS[parameter.type]
  const summary = describeValue(parameter, value, labels)
  const face = (
    <button
      type="button"
      onClick={onSelect}
      className="inline-flex h-9 min-w-0 items-center gap-2 px-3 text-sm"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn('truncate', summary === null ? 'font-medium' : 'text-muted-foreground')}>
        {parameter.label}
      </span>
      {summary !== null && <span className="truncate font-medium">{summary}</span>}
      {(summary === null || onSelect !== undefined) && (
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
  const frame = (control: ReactNode) => (
    <span
      className={cn(
        'inline-flex max-w-80 items-center rounded-lg border bg-background shadow-xs transition-colors hover:bg-accent',
        summary !== null && 'border-primary/50 bg-primary/5',
        selected && 'ring-2 ring-primary',
      )}
    >
      {control}
      {summary !== null && onSelect === undefined && (
        <button
          type="button"
          aria-label={$t('Effacer {label}', { label: parameter.label })}
          onClick={() => onChange(null)}
          className="mr-1.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  )
  if (onSelect !== undefined) return frame(face)
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      {frame(<PopoverTrigger asChild>{face}</PopoverTrigger>)}
      <PopoverContent className="w-80">
        <ValueEditor
          base={base}
          parameter={parameter}
          value={value}
          source={source}
          {...(given === undefined ? {} : { given })}
          onChange={(next) => {
            onChange(next)
            if (parameter.type !== 'category') setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** A filter's settings, while the dashboard is edited. */
export function ParameterSettings({
  base,
  parameter,
  source,
  tied,
  onChange,
  onRemove,
  onAutoMap,
  onClose,
}: {
  readonly base: DescribedBase
  readonly parameter: DashboardParameter
  readonly source: ValueSource | null
  /** How many cards it drives. */
  readonly tied: number
  readonly onChange: (parameter: DashboardParameter) => void
  readonly onRemove: () => void
  readonly onAutoMap: () => void
  readonly onClose: () => void
}) {
  const set = (patch: Partial<DashboardParameter>) => {
    const next: Record<string, unknown> = { ...parameter, ...patch }
    for (const [k, v] of Object.entries(next)) if (v === undefined || v === null) delete next[k]
    onChange(next as unknown as DashboardParameter)
  }
  return (
    <aside className="w-80 shrink-0 space-y-4 overflow-y-auto border-l bg-background p-4 scroll-discret">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {$t('Filtre · {parameterLabels}', { parameterLabels: PARAMETER_LABELS[parameter.type] })}
        </h3>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={$t('Fermer les réglages du filtre')}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="space-y-1 text-sm">
        <span className="text-muted-foreground">{$t('Nom')}</span>
        <Input
          value={parameter.label}
          onChange={(e) => set({ label: e.target.value })}
          aria-label={$t('Nom du filtre')}
          className="h-8"
          maxLength={120}
        />
      </div>
      {parameter.type === 'category' && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{$t('Plusieurs valeurs')}</span>
          <Switch
            aria-label={$t('Plusieurs valeurs')}
            checked={parameter.multiple !== false}
            onCheckedChange={(on) => set({ multiple: on ? undefined : false })}
          />
        </div>
      )}
      {parameter.type === 'number' && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{$t('Comparaison')}</span>
          <Choice
            value={parameter.operator ?? 'eq'}
            onValueChange={(next) => set({ operator: next as NumberOperator })}
            options={Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }))}
            aria-label={$t('Comparaison')}
          />
        </div>
      )}
      {parameter.type === 'temporal_unit' && (
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">{$t('Périodes proposées')}</span>
          {PERIOD_UNITS.map((unit) => {
            const units = parameter.units ?? PERIOD_UNITS
            const on = units.includes(unit)
            return (
              <label key={unit} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={on}
                  onChange={() => {
                    const next = on
                      ? units.filter((u) => u !== unit)
                      : PERIOD_UNITS.filter((u) => u === unit || units.includes(u))
                    set({ units: next.length === PERIOD_UNITS.length ? undefined : next })
                  }}
                />
                {UNIT_LABELS[unit]}
              </label>
            )
          })}
        </div>
      )}
      <div className="space-y-1.5 text-sm">
        <span className="text-muted-foreground">{$t('Valeur par défaut')}</span>
        <div className="rounded-lg border p-2">
          <ValueEditor
            base={base}
            parameter={parameter}
            value={parameter.default ?? null}
            source={source}
            onChange={(value) => set({ default: value ?? undefined })}
          />
        </div>
        {hasValue(parameter.default) && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => set({ default: undefined })}
          >
            {$t('Retirer la valeur par défaut')}
          </Button>
        )}
      </div>
      <div className="space-y-2 border-t pt-3">
        <p className="text-sm text-muted-foreground">
          {tied === 0
            ? $t('Relié à aucune carte.')
            : $tp(tied, 'Relié à {count} carte.', 'Relié à {count} cartes.')}{' '}
          {$t('Choisissez sur chaque carte la colonne qu’il filtre.')}
        </p>
        <Button variant="outline" size="sm" className="w-full" onClick={onAutoMap}>
          {$t('Relier à toutes les cartes compatibles')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          {$t('Supprimer le filtre')}
        </Button>
      </div>
    </aside>
  )
}
