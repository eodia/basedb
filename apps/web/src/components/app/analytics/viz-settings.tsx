'use client'

import { Choice as ChoiceField } from '@/components/ui/choice'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Hint } from '@/components/ui/tooltip'
import { chartModel, pieSlices } from '@/lib/analytics/charts'
import {
  type FormatContext,
  SERIES_DARK,
  SERIES_LIGHT,
  inkOf,
  valueText,
} from '@/lib/analytics/format'
import { VIZ_LABELS, vizFits } from '@/lib/analytics/model'
import type { DescribedBase } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { useMembers } from '@/lib/members'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  type ColorRule,
  type QueryResult,
  type ResultColumn,
  type SeriesSettings,
  VISUALIZATIONS,
  type Visualization,
  type VisualizationSettings,
  type VisualizationType,
} from '@basedb/contracts'
import {
  ArrowDown,
  ArrowUp,
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartNoAxesCombined,
  ChartPie,
  ChartScatter,
  ChevronRight,
  Funnel,
  Gauge,
  Grid3x3,
  Hash,
  type LucideIcon,
  Map as MapGlyph,
  Plus,
  RotateCcw,
  Table2,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'

/**
 * How a result is shown, chosen and tuned — chapter 18 §3: the shapes it can take, then,
 * for the one taken, what it draws, how — its axes, its series, its slices, its labels, its
 * legend —, the colours it takes by value, and how its numbers read.
 */

export const VIZ_ICONS: Readonly<Record<VisualizationType, LucideIcon>> = {
  table: Table2,
  scalar: Hash,
  trend: TrendingUp,
  progress: Target,
  gauge: Gauge,
  bar: ChartColumn,
  row: ChartBar,
  line: ChartLine,
  area: ChartArea,
  combo: ChartNoAxesCombined,
  pie: ChartPie,
  scatter: ChartScatter,
  funnel: Funnel,
  pivot: Grid3x3,
  map: MapGlyph,
}

export function VizPicker({
  value,
  result,
  onChange,
}: {
  readonly value: VisualizationType
  readonly result: QueryResult | null
  readonly onChange: (type: VisualizationType) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {VISUALIZATIONS.map((type) => {
        const Icon = VIZ_ICONS[type]
        const fits = vizFits(type, result)
        return (
          <Hint
            key={type}
            label={
              fits
                ? VIZ_LABELS[type]
                : $t('{vizLabels} — ne convient pas à ce résultat', { vizLabels: VIZ_LABELS[type] })
            }
          >
            <button
              type="button"
              onClick={() => onChange(type)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors hover:bg-accent',
                value === type && 'border-primary bg-primary/10 text-primary',
                !fits && 'opacity-40',
              )}
            >
              <Icon className="size-5" />
              {VIZ_LABELS[type]}
            </button>
          </Hint>
        )
      })}
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 shrink text-muted-foreground">{label}</span>
      <div className="flex min-w-0 shrink-0 justify-end">{children}</div>
    </div>
  )
}

/** A group of settings, folded when not the first thing one reaches for. */
function Section({
  title,
  children,
  open = true,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly open?: boolean
}) {
  const [shown, setShown] = useState(open)
  return (
    <section className="border-b pb-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-expanded={shown}
        className="flex w-full items-center gap-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
      >
        <ChevronRight className={cn('size-3.5 transition-transform', shown && 'rotate-90')} />
        {title}
      </button>
      {shown && <div className="mt-2 space-y-2.5">{children}</div>}
    </section>
  )
}

function Choice({
  value,
  options,
  onChange,
  label,
}: {
  readonly value: string
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly onChange: (value: string) => void
  readonly label: string
}) {
  return (
    <ChoiceField
      value={value}
      onValueChange={onChange}
      options={options}
      aria-label={label}
      className="w-44 max-w-44"
    />
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}) {
  return (
    <Row label={label}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </Row>
  )
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  width = 'w-24',
}: {
  readonly label: string
  readonly value: number | null | undefined
  readonly onChange: (value: number | undefined) => void
  readonly placeholder?: string
  readonly width?: string
}) {
  return (
    <Row label={label}>
      <Input
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(numberOr(e.target.value) ?? undefined)}
        className={cn('h-8', width)}
        aria-label={label}
      />
    </Row>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  readonly label: string
  readonly value: string | undefined
  readonly onChange: (value: string | undefined) => void
  readonly placeholder?: string
}) {
  return (
    <Row label={label}>
      <Input
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        className="h-8 w-36"
        aria-label={label}
      />
    </Row>
  )
}

const numberOr = (text: string): number | null =>
  text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text)

/** A colour: one of the chart palette's, or any other; `undefined` gives it back. */
function ColorPicker({
  value,
  fallback,
  onChange,
  label,
}: {
  readonly value: string | undefined
  readonly fallback?: string
  readonly onChange: (color: string | undefined) => void
  readonly label: string
}) {
  const theme = useTheme((s) => s.theme)
  const palette = theme === 'dark' ? SERIES_DARK : SERIES_LIGHT
  const current = value ?? fallback
  return (
    <fieldset className="flex flex-wrap items-center gap-1" aria-label={label}>
      {palette.map((color, i) => (
        <button
          key={color}
          type="button"
          aria-label={$t('{label} : couleur {value}', { label, value: i + 1 })}
          aria-pressed={current === color}
          onClick={() => onChange(color)}
          className={cn(
            'size-5 rounded-full border-2 border-transparent',
            current === color && 'border-foreground',
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <Hint label={$t('Autre couleur')}>
        <label
          className="relative size-5 cursor-pointer overflow-hidden rounded-full border"
          style={{
            background:
              current !== undefined && !palette.includes(current)
                ? current
                : 'conic-gradient(#e34948, #eda100, #1baf7a, #2a78d6, #4a3aa7, #e34948)',
          }}
        >
          <input
            type="color"
            value={current?.startsWith('#') ? current : '#2a78d6'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={$t('{label} : autre couleur', { label })}
          />
        </label>
      </Hint>
      {value !== undefined && (
        <Hint label={$t('Couleur par défaut')}>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ml-0.5 text-muted-foreground hover:text-foreground"
            aria-label={$t('{label} : couleur par défaut', { label })}
          >
            <RotateCcw className="size-3.5" />
          </button>
        </Hint>
      )}
    </fieldset>
  )
}

const RULE_OPS: ReadonlyArray<{ readonly value: ColorRule['op']; readonly label: string }> = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'between', label: 'entre' },
]

/** Colours by value: the first rule that holds wins. */
function RulesEditor({
  rules,
  columns,
  onChange,
  rows = false,
}: {
  readonly rules: readonly ColorRule[]
  /** The numeric columns a rule may read; empty: it reads the number shown. */
  readonly columns: readonly ResultColumn[]
  readonly onChange: (rules: readonly ColorRule[]) => void
  /** A table: a rule may colour its whole row. */
  readonly rows?: boolean
}) {
  const theme = useTheme((s) => s.theme)
  const set = (i: number, patch: Partial<ColorRule>) =>
    onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      {rules.map((rule, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rules are edited in place, by rank
        <div key={i} className="space-y-1.5 rounded-lg border p-2">
          <div className="flex items-center gap-1.5">
            {columns.length > 0 && (
              <ChoiceField
                value={rule.column ?? ''}
                onValueChange={(next) => set(i, { column: next === '' ? undefined : next })}
                options={[
                  { value: '', label: $t('Toute colonne') },
                  ...columns.map((c) => ({ value: c.name, label: c.label })),
                ]}
                aria-label={$t('Colonne lue')}
                size="xs"
                className="min-w-0 flex-1"
              />
            )}
            <ChoiceField
              value={rule.op}
              onValueChange={(next) => set(i, { op: next as ColorRule['op'] })}
              options={RULE_OPS}
              aria-label={$t('Comparaison')}
              size="xs"
              className="w-auto shrink-0"
            />
            <Input
              type="number"
              value={rule.value}
              onChange={(e) => set(i, { value: numberOr(e.target.value) ?? 0 })}
              aria-label={$t('Valeur')}
              className="h-7 w-20 text-xs"
            />
            {rule.op === 'between' && (
              <Input
                type="number"
                value={rule.value2 ?? ''}
                onChange={(e) => set(i, { value2: numberOr(e.target.value) ?? undefined })}
                aria-label={$t('Seconde valeur')}
                className="h-7 w-20 text-xs"
              />
            )}
            <button
              type="button"
              onClick={() => onChange(rules.filter((_, j) => j !== i))}
              aria-label={$t('Retirer la règle')}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <ColorPicker
              value={rule.color}
              onChange={(color) =>
                set(i, { color: color ?? (theme === 'dark' ? '#e66767' : '#e34948') })
              }
              label={$t('Couleur de la règle')}
            />
            {rows && (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={rule.row === true}
                  onChange={(e) => set(i, { row: e.target.checked || undefined })}
                />
                {$t('Toute la ligne')}
              </label>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...rules,
            {
              op: 'lt',
              value: 0,
              color: theme === 'dark' ? '#e66767' : '#e34948',
              ...(columns[0] === undefined ? {} : { column: columns[0].name }),
            },
          ])
        }
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="size-3.5" />
        {$t('Ajouter une règle')}
      </button>
    </div>
  )
}

/** A thing drawn in its own colour, with a name one may change. */
function ItemStyle({
  name,
  own,
  fallback,
  onChange,
  children,
}: {
  readonly name: string
  readonly own: SeriesSettings
  readonly fallback: string
  readonly onChange: (patch: Partial<SeriesSettings>) => void
  readonly children?: ReactNode
}) {
  return (
    <div className="space-y-1.5 rounded-lg border p-2">
      <Input
        value={own.label ?? ''}
        placeholder={name}
        onChange={(e) => onChange({ label: e.target.value === '' ? undefined : e.target.value })}
        aria-label={$t('Nom de « {name} »', { name })}
        className="h-7 text-xs font-medium"
      />
      <ColorPicker
        value={own.color}
        fallback={fallback}
        onChange={(color) => onChange({ color })}
        label={$t('Couleur de « {name} »', { name })}
      />
      {children}
    </div>
  )
}

// ── The settings ────────────────────────────────────────────────────────────

const AXIS_TYPES = new Set(['bar', 'row', 'line', 'area', 'combo'])

export function VizSettings({
  visualization,
  result,
  base,
  onChange,
}: {
  readonly visualization: Visualization
  readonly result: QueryResult | null
  readonly base: DescribedBase
  readonly onChange: (visualization: Visualization) => void
}) {
  const theme = useTheme((s) => s.theme)
  const members = useMembers()
  const format: FormatContext = useMemo(() => ({ base, members }), [base, members])
  const ink = inkOf(theme)
  const settings: VisualizationSettings = visualization.settings ?? {}
  const set = (patch: Partial<VisualizationSettings>) => {
    const next: Record<string, unknown> = { ...settings, ...patch }
    for (const [k, v] of Object.entries(next)) if (v === undefined) delete next[k]
    onChange({ ...visualization, settings: next as VisualizationSettings })
  }
  const setOwn = (key: string, patch: Partial<SeriesSettings>) => {
    const merged: Record<string, unknown> = { ...(settings.series?.[key] ?? {}), ...patch }
    for (const [k, v] of Object.entries(merged)) if (v === undefined) delete merged[k]
    const series: Record<string, SeriesSettings> = { ...(settings.series ?? {}) }
    if (Object.keys(merged).length === 0) delete series[key]
    else series[key] = merged as SeriesSettings
    set({ series: Object.keys(series).length === 0 ? undefined : series })
  }
  const columns = (result?.columns ?? []).filter((c) => c.hidden !== true)
  const dims = columns.filter((c) => c.role !== 'metric')
  const metrics = columns.filter((c) => c.role === 'metric' || c.type === 'number')
  const named = (list: readonly ResultColumn[]) =>
    list.map((c) => ({ value: c.name, label: c.label }))
  const type = visualization.type
  const palette = ink.series
  const firstDim = settings.dimensions?.[0] ?? dims[0]?.name ?? ''
  const splitDim =
    settings.dimensions?.[1] ?? (settings.dimensions === undefined ? (dims[1]?.name ?? '') : '')
  const chosenMetrics =
    settings.metrics ?? metrics.filter((c) => c.role === 'metric').map((c) => c.name)
  const temporal = columns.find((c) => c.name === firstDim)?.unit !== undefined

  // The series as the chart draws them, keyed as their settings are: a measure by its
  // name, a value of the second dimension by its text.
  const drawn = useMemo(() => {
    if (result === null || !AXIS_TYPES.has(type)) return []
    return chartModel(result, visualization, format, ink, false)
      .series.filter((s) => s.key !== 'other')
      .map((s) => {
        const key = s.split === undefined ? s.key : valueText(s.split.column, s.split.value, format)
        return { key, name: key === s.key ? s.metric.label : key, color: s.color }
      })
  }, [result, visualization, format, ink, type])

  const numberFormat = (
    <Section title={$t('Nombres')} open={false}>
      <TextField
        label={$t('Préfixe')}
        value={settings.prefix}
        onChange={(prefix) => set({ prefix })}
      />
      <TextField
        label={$t('Suffixe')}
        value={settings.suffix}
        onChange={(suffix) => set({ suffix })}
      />
      <NumberField
        label={$t('Décimales')}
        value={settings.decimals}
        onChange={(decimals) =>
          set({ decimals: decimals === undefined ? undefined : Math.min(Math.max(decimals, 0), 6) })
        }
        width="w-20"
      />
      <Toggle
        label={$t('Abréger (1,2 k)')}
        checked={settings.compact === true}
        onChange={(v) => set({ compact: v || undefined })}
      />
    </Section>
  )

  const metricPicker = (
    <Row label={$t('Mesure')}>
      <Choice
        value={settings.metrics?.[0] ?? metrics[0]?.name ?? ''}
        options={named(metrics)}
        onChange={(v) => set({ metrics: [v] })}
        label={$t('Mesure')}
      />
    </Row>
  )
  const dimensionPicker = (
    <Row label={$t('Dimension')}>
      <Choice
        value={firstDim}
        options={named(dims)}
        onChange={(v) => set({ dimensions: [v] })}
        label={$t('Dimension')}
      />
    </Row>
  )
  const legendSettings = (withValues: boolean) => (
    <Section title={$t('Légende')} open={false}>
      <Toggle
        label={$t('Afficher la légende')}
        checked={settings.legend !== false}
        onChange={(v) => set({ legend: v ? undefined : false })}
      />
      {settings.legend !== false && (
        <Row label={$t('Position')}>
          <Choice
            value={settings.legend_position ?? 'auto'}
            options={[
              { value: 'auto', label: $t('Automatique') },
              { value: 'top', label: $t('En haut') },
              { value: 'bottom', label: $t('En bas') },
              { value: 'left', label: $t('À gauche') },
              { value: 'right', label: $t('À droite') },
            ]}
            onChange={(v) =>
              set({
                legend_position:
                  v === 'auto' ? undefined : (v as VisualizationSettings['legend_position']),
              })
            }
            label={$t('Position de la légende')}
          />
        </Row>
      )}
      {withValues && settings.legend !== false && (
        <Toggle
          label={$t('Avec les pourcentages')}
          checked={settings.legend_values !== false}
          onChange={(v) => set({ legend_values: v ? undefined : false })}
        />
      )}
    </Section>
  )
  const colourAndRules = (
    <Section title={$t('Couleur')} open={false}>
      <ColorPicker
        value={settings.color}
        fallback={type === 'progress' ? undefined : palette[0]}
        onChange={(color) => set({ color })}
        label={$t('Couleur')}
      />
      <p className="pt-1 text-xs text-muted-foreground">
        {$t('Selon la valeur — la première règle qui tient :')}
      </p>
      <RulesEditor
        rules={settings.rules ?? []}
        columns={[]}
        onChange={(rules) => set({ rules: rules.length === 0 ? undefined : rules })}
      />
    </Section>
  )

  return (
    <div className="space-y-3">
      {AXIS_TYPES.has(type) && (
        <>
          <Section title={$t('Données')}>
            <Row label={$t('Axe')}>
              <Choice
                value={firstDim}
                options={named(dims)}
                onChange={(v) => set({ dimensions: splitDim === '' ? [v] : [v, splitDim] })}
                label={$t('Colonne de l’axe')}
              />
            </Row>
            <Row label={$t('Séries par')}>
              <Choice
                value={splitDim}
                options={[
                  { value: '', label: $t('Aucune') },
                  ...named(dims.filter((d) => d.name !== firstDim)),
                ]}
                onChange={(v) => set({ dimensions: v === '' ? [firstDim] : [firstDim, v] })}
                label={$t('Colonne des séries')}
              />
            </Row>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">{$t('Mesures')}</span>
              {metrics.map((m) => {
                const on = chosenMetrics.includes(m.name)
                return (
                  <label key={m.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={on}
                      onChange={() =>
                        set({
                          metrics: on
                            ? chosenMetrics.filter((n) => n !== m.name)
                            : [...chosenMetrics, m.name],
                        })
                      }
                    />
                    <span className="truncate">{m.label}</span>
                  </label>
                )
              })}
            </div>
          </Section>

          <Section title={$t('Séries')}>
            {drawn.map((item, index) => (
              <ItemStyle
                key={item.key}
                name={item.name}
                own={settings.series?.[item.key] ?? {}}
                fallback={item.color}
                onChange={(patch) => setOwn(item.key, patch)}
              >
                {type === 'combo' && (
                  <div className="flex gap-2">
                    <Choice
                      value={settings.series?.[item.key]?.display ?? (index === 0 ? 'bar' : 'line')}
                      options={[
                        {
                          value: 'bar',
                          label: $t('Barres||type d’une série d’un graphique combiné'),
                        },
                        { value: 'line', label: $t('Courbe') },
                        { value: 'area', label: $t('Aire') },
                      ]}
                      onChange={(v) =>
                        setOwn(item.key, { display: v as SeriesSettings['display'] })
                      }
                      label={$t('Tracé')}
                    />
                    <Choice
                      value={settings.series?.[item.key]?.axis ?? 'left'}
                      options={[
                        { value: 'left', label: $t('Axe commun') },
                        { value: 'right', label: $t('Second axe') },
                      ]}
                      onChange={(v) =>
                        setOwn(item.key, { axis: v === 'left' ? undefined : 'right' })
                      }
                      label={$t('Axe')}
                    />
                  </div>
                )}
              </ItemStyle>
            ))}
            {type === 'combo' && (
              <p className="text-xs text-muted-foreground">
                {$t(
                  'Un second axe fait lire deux échelles à la fois : réservez-le aux mesures qui ne se comparent pas.',
                )}
              </p>
            )}
          </Section>

          <Section title={$t('Affichage')}>
            {type !== 'line' && (
              <Row label={$t('Empilement')}>
                <Choice
                  value={settings.stack ?? 'none'}
                  options={[
                    { value: 'none', label: $t('Côte à côte') },
                    { value: 'stacked', label: $t('Empilé') },
                    { value: 'percent', label: $t('Empilé à 100 %') },
                  ]}
                  onChange={(v) =>
                    set({ stack: v === 'none' ? undefined : (v as 'stacked' | 'percent') })
                  }
                  label={$t('Empilement')}
                />
              </Row>
            )}
            <Toggle
              label={$t('Valeurs sur le graphique')}
              checked={settings.values === true}
              onChange={(v) => set({ values: v || undefined })}
            />
            {settings.stack === 'stacked' && (
              <Toggle
                label={$t('Total au-dessus des piles')}
                checked={settings.stack_totals === true}
                onChange={(v) => set({ stack_totals: v || undefined })}
              />
            )}
            {(type === 'bar' || type === 'row' || type === 'combo') && (
              <Row label={$t('Largeur des barres')}>
                <Choice
                  value={settings.bar_width ?? 'normal'}
                  options={[
                    { value: 'thin', label: $t('Fines') },
                    { value: 'normal', label: $t('Normales') },
                    { value: 'wide', label: $t('Larges') },
                  ]}
                  onChange={(v) =>
                    set({ bar_width: v === 'normal' ? undefined : (v as 'thin' | 'wide') })
                  }
                  label={$t('Largeur des barres')}
                />
              </Row>
            )}
            {(type === 'line' || type === 'area' || type === 'combo') && (
              <>
                <Row label={$t('Tracé des courbes')}>
                  <Choice
                    value={settings.line_style ?? 'straight'}
                    options={[
                      { value: 'straight', label: $t('Droit') },
                      { value: 'smooth', label: $t('Lissé') },
                      { value: 'step', label: $t('En escalier') },
                    ]}
                    onChange={(v) =>
                      set({ line_style: v === 'straight' ? undefined : (v as 'smooth' | 'step') })
                    }
                    label={$t('Tracé des courbes')}
                  />
                </Row>
                <Row label={$t('Points')}>
                  <Choice
                    value={settings.markers ?? 'auto'}
                    options={[
                      { value: 'auto', label: $t('Automatique') },
                      { value: 'always', label: $t('Toujours') },
                      { value: 'never', label: $t('Jamais') },
                    ]}
                    onChange={(v) =>
                      set({ markers: v === 'auto' ? undefined : (v as 'always' | 'never') })
                    }
                    label={$t('Points des courbes')}
                  />
                </Row>
              </>
            )}
            <Row label={$t('Ordre')}>
              <Choice
                value={settings.sort_values ?? 'none'}
                options={[
                  { value: 'none', label: $t('Celui du résultat') },
                  { value: 'desc', label: $t('Du plus grand au plus petit') },
                  { value: 'asc', label: $t('Du plus petit au plus grand') },
                ]}
                onChange={(v) =>
                  set({ sort_values: v === 'none' ? undefined : (v as 'asc' | 'desc') })
                }
                label={$t('Ordre des catégories')}
              />
            </Row>
            {temporal && (
              <Toggle
                label={$t('Périodes sans ligne à zéro')}
                checked={settings.fill_periods !== false}
                onChange={(v) => set({ fill_periods: v ? undefined : false })}
              />
            )}
          </Section>

          {legendSettings(false)}

          <Section title={$t('Axes')} open={false}>
            <TextField
              label={$t('Titre de l’axe horizontal')}
              value={settings.x_label}
              onChange={(x_label) => set({ x_label })}
            />
            <TextField
              label={$t('Titre de l’axe vertical')}
              value={settings.y_label}
              onChange={(y_label) => set({ y_label })}
            />
            <Toggle
              label={$t('Graduations horizontales')}
              checked={settings.x_axis !== false}
              onChange={(v) => set({ x_axis: v ? undefined : false })}
            />
            <Toggle
              label={$t('Graduations verticales')}
              checked={settings.y_axis !== false}
              onChange={(v) => set({ y_axis: v ? undefined : false })}
            />
            {type !== 'row' && (
              <Row label={$t('Inclinaison des étiquettes')}>
                <Choice
                  value={String(settings.x_rotate ?? 0)}
                  options={[
                    { value: '0', label: $t('Droites') },
                    { value: '30', label: '30°' },
                    { value: '45', label: '45°' },
                    { value: '90', label: $t('Verticales') },
                  ]}
                  onChange={(v) => set({ x_rotate: v === '0' ? undefined : Number(v) })}
                  label={$t('Inclinaison des étiquettes')}
                />
              </Row>
            )}
            <Toggle
              label={$t('Quadrillage')}
              checked={settings.grid_lines !== false}
              onChange={(v) => set({ grid_lines: v ? undefined : false })}
            />
            <NumberField
              label={$t('Minimum')}
              value={settings.y_min}
              onChange={(y_min) => set({ y_min })}
              placeholder="auto"
            />
            <NumberField
              label={$t('Maximum')}
              value={settings.y_max}
              onChange={(y_max) => set({ y_max })}
              placeholder="auto"
            />
            {settings.stack !== 'percent' && (
              <Toggle
                label={$t('Échelle logarithmique')}
                checked={settings.y_scale === 'log'}
                onChange={(v) => set({ y_scale: v ? 'log' : undefined })}
              />
            )}
          </Section>

          <Section title={$t('Objectif')} open={false}>
            <NumberField
              label={$t('Valeur')}
              value={settings.goal}
              onChange={(goal) => set({ goal })}
              width="w-28"
            />
            <TextField
              label={$t('Nom')}
              value={settings.goal_label}
              onChange={(goal_label) => set({ goal_label })}
              placeholder={$t('Objectif')}
            />
          </Section>
          {numberFormat}
        </>
      )}

      {type === 'pie' && result !== null && (
        <>
          <Section title={$t('Données')}>
            {dimensionPicker}
            {metricPicker}
          </Section>
          <Section title={$t('Forme')}>
            <Toggle
              label={$t('Anneau')}
              checked={settings.donut !== false}
              onChange={(v) => set({ donut: v ? undefined : false })}
            />
            {settings.donut !== false && (
              <Row label={$t('Épaisseur')}>
                <input
                  type="range"
                  min={10}
                  max={70}
                  step={2}
                  value={settings.ring_width ?? 32}
                  onChange={(e) => set({ ring_width: Number(e.target.value) })}
                  className="w-32 accent-primary"
                  aria-label={$t('Épaisseur de l’anneau')}
                />
              </Row>
            )}
            <Toggle
              label={$t('Demi-cercle')}
              checked={settings.half === true}
              onChange={(v) => set({ half: v || undefined })}
            />
            <Toggle
              label={$t('Rose (rayon selon la valeur)')}
              checked={settings.rose === true}
              onChange={(v) => set({ rose: v || undefined })}
            />
            {settings.donut !== false && settings.rose !== true && (
              <Toggle
                label={$t('Total au centre')}
                checked={settings.total !== false}
                onChange={(v) => set({ total: v ? undefined : false })}
              />
            )}
          </Section>
          <Section title={$t('Parts')}>
            <Row label={$t('Parts au plus')}>
              <Input
                type="number"
                min={2}
                max={12}
                value={settings.slices_max ?? 8}
                onChange={(e) => set({ slices_max: numberOr(e.target.value) ?? undefined })}
                className="h-8 w-20"
                aria-label={$t('Nombre de parts avant « Autres »')}
              />
            </Row>
            <Toggle
              label={$t('La plus grande d’abord')}
              checked={settings.sort_slices !== false}
              onChange={(v) => set({ sort_slices: v ? undefined : false })}
            />
            {pieSlices(result, visualization, format, ink).map((slice) => (
              <ItemStyle
                key={slice.key}
                name={slice.key}
                own={settings.series?.[slice.key] ?? {}}
                fallback={slice.color}
                onChange={(patch) => setOwn(slice.key, patch)}
              />
            ))}
          </Section>
          <Section title={$t('Étiquettes')}>
            <Row label={$t('Sur les parts')}>
              <Choice
                value={settings.slice_labels ?? 'none'}
                options={[
                  { value: 'none', label: $t('Rien') },
                  { value: 'percent', label: $t('Pourcentage') },
                  { value: 'value', label: $t('Valeur') },
                  { value: 'name', label: $t('Nom') },
                  { value: 'name_percent', label: $t('Nom et pourcentage') },
                  { value: 'name_value', label: $t('Nom et valeur') },
                ]}
                onChange={(v) =>
                  set({
                    slice_labels:
                      v === 'none' ? undefined : (v as VisualizationSettings['slice_labels']),
                  })
                }
                label={$t('Étiquettes des parts')}
              />
            </Row>
            {settings.slice_labels !== undefined && (
              <Toggle
                label={$t('À l’extérieur')}
                checked={settings.labels_outside === true}
                onChange={(v) => set({ labels_outside: v || undefined })}
              />
            )}
          </Section>
          {legendSettings(true)}
          {numberFormat}
        </>
      )}

      {type === 'funnel' && result !== null && (
        <>
          <Section title={$t('Données')}>
            {dimensionPicker}
            {metricPicker}
            <Toggle
              label={$t('Étapes de la plus grande à la plus petite')}
              checked={settings.sort_slices !== false}
              onChange={(v) => set({ sort_slices: v ? undefined : false })}
            />
          </Section>
          <Section title={$t('Étiquettes')}>
            <Toggle
              label={$t('Afficher')}
              checked={settings.slice_labels !== 'none'}
              onChange={(v) => set({ slice_labels: v ? undefined : 'none' })}
            />
            <Toggle
              label={$t('À côté des étapes')}
              checked={settings.labels_outside !== false}
              onChange={(v) => set({ labels_outside: v ? undefined : false })}
            />
          </Section>
          <Section title={$t('Étapes')} open={false}>
            {pieSlices(
              result,
              { ...visualization, settings: { ...settings, slices_max: 12, sort_slices: false } },
              format,
              ink,
            )
              .filter((s) => s.key !== 'Autres')
              .map((slice) => (
                <ItemStyle
                  key={slice.key}
                  name={slice.key}
                  own={settings.series?.[slice.key] ?? {}}
                  fallback={slice.color}
                  onChange={(patch) => setOwn(slice.key, patch)}
                />
              ))}
          </Section>
          {numberFormat}
        </>
      )}

      {(type === 'scalar' || type === 'trend' || type === 'progress' || type === 'gauge') && (
        <>
          <Section title={$t('Données')}>
            {metricPicker}
            {type === 'trend' && (
              <>
                <Row label={$t('Comparer à')}>
                  <Choice
                    value={settings.comparison ?? 'both'}
                    options={[
                      { value: 'both', label: $t('Période précédente et l’an dernier') },
                      { value: 'previous', label: $t('La période précédente') },
                      { value: 'year', label: $t('La même période l’an dernier') },
                    ]}
                    onChange={(v) => set({ comparison: v as 'both' })}
                    label={$t('Comparaison')}
                  />
                </Row>
                <Toggle
                  label={$t('Une baisse est une bonne nouvelle')}
                  checked={settings.invert === true}
                  onChange={(v) => set({ invert: v || undefined })}
                />
              </>
            )}
            {(type === 'progress' || type === 'gauge') && (
              <>
                <NumberField
                  label={$t('Objectif')}
                  value={settings.goal}
                  onChange={(goal) => set({ goal })}
                  width="w-28"
                />
                <TextField
                  label={$t('Nom de l’objectif')}
                  value={settings.goal_label}
                  onChange={(goal_label) => set({ goal_label })}
                  placeholder={$t('Objectif')}
                />
              </>
            )}
            {type === 'gauge' && (
              <>
                <NumberField
                  label={$t('Minimum')}
                  value={settings.min}
                  onChange={(min) => set({ min })}
                  width="w-28"
                />
                <NumberField
                  label={$t('Maximum')}
                  value={settings.max}
                  onChange={(max) => set({ max })}
                  width="w-28"
                />
              </>
            )}
            {type !== 'gauge' && (
              <TextField
                label={$t('Légende sous le chiffre')}
                value={settings.caption}
                onChange={(caption) => set({ caption })}
              />
            )}
          </Section>
          {colourAndRules}
          {numberFormat}
        </>
      )}

      {type === 'scatter' && (
        <>
          <Section title={$t('Données')}>
            <p className="text-xs text-muted-foreground">
              {$t(
                'Deux nombres pour les axes ; un troisième, s’il y est, donne la taille des points.',
              )}
            </p>
            {[0, 1, 2].map((slot) => (
              <Row
                key={slot}
                label={[$t('Horizontal'), $t('Vertical'), $t('Taille')][slot] as string}
              >
                <Choice
                  value={settings.metrics?.[slot] ?? ''}
                  options={[
                    { value: '', label: slot === 2 ? $t('Aucune') : $t('Automatique') },
                    ...named(metrics),
                  ]}
                  onChange={(v) => {
                    const list = [...(settings.metrics ?? [])]
                    list[slot] = v
                    set({ metrics: list.filter((x) => x !== undefined && x !== '') })
                  }}
                  label={[$t('Axe horizontal'), $t('Axe vertical'), $t('Taille')][slot] as string}
                />
              </Row>
            ))}
          </Section>
          <Section title={$t('Axes')} open={false}>
            <TextField
              label={$t('Titre de l’axe horizontal')}
              value={settings.x_label}
              onChange={(x_label) => set({ x_label })}
            />
            <TextField
              label={$t('Titre de l’axe vertical')}
              value={settings.y_label}
              onChange={(y_label) => set({ y_label })}
            />
          </Section>
        </>
      )}

      {type === 'table' && result !== null && (
        <>
          <Section title={$t('Colonnes')}>
            {(() => {
              const order = settings.columns ?? columns.map((c) => c.name)
              const hidden = columns.filter((c) => !order.includes(c.name))
              const move = (i: number, step: number) => {
                const next = [...order]
                const [item] = next.splice(i, 1)
                if (item === undefined) return
                next.splice(Math.max(0, Math.min(next.length, i + step)), 0, item)
                set({ columns: next })
              }
              const rename = (name: string, label: string) => {
                const labels: Record<string, string> = { ...(settings.column_labels ?? {}) }
                if (label.trim() === '') delete labels[name]
                else labels[name] = label
                set({ column_labels: Object.keys(labels).length === 0 ? undefined : labels })
              }
              return (
                <div className="space-y-1">
                  {order.map((name, i) => {
                    const column = columns.find((c) => c.name === name)
                    if (column === undefined) return null
                    return (
                      <div key={name} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked
                          onChange={() => set({ columns: order.filter((n) => n !== name) })}
                          aria-label={$t('Montrer {label}', { label: column.label })}
                        />
                        <Input
                          value={settings.column_labels?.[name] ?? ''}
                          placeholder={column.label}
                          onChange={(e) => rename(name, e.target.value)}
                          aria-label={$t('Nom de la colonne {label}', { label: column.label })}
                          className="h-7 min-w-0 flex-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          aria-label={$t('Monter')}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          aria-label={$t('Descendre')}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>
                    )
                  })}
                  {hidden.map((column) => (
                    <label
                      key={column.name}
                      className="flex items-center gap-1 text-sm text-muted-foreground"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={false}
                        onChange={() => set({ columns: [...order, column.name] })}
                      />
                      <span className="truncate">{column.label}</span>
                    </label>
                  ))}
                </div>
              )
            })()}
          </Section>
          {metrics.length > 0 && (
            <Section title={$t('Barres dans les cellules')} open={false}>
              {metrics.map((m) => {
                const on = (settings.cell_bars ?? []).includes(m.name)
                return (
                  <label key={m.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={on}
                      onChange={() => {
                        const next = on
                          ? (settings.cell_bars ?? []).filter((n) => n !== m.name)
                          : [...(settings.cell_bars ?? []), m.name]
                        set({ cell_bars: next.length === 0 ? undefined : next })
                      }}
                    />
                    <span className="truncate">{m.label}</span>
                  </label>
                )
              })}
              <ColorPicker
                value={settings.color}
                onChange={(color) => set({ color })}
                label={$t('Couleur des barres')}
              />
            </Section>
          )}
          {metrics.length > 0 && (
            <Section title={$t('Couleurs selon la valeur')} open={false}>
              <RulesEditor
                rules={settings.rules ?? []}
                columns={metrics}
                rows
                onChange={(rules) => set({ rules: rules.length === 0 ? undefined : rules })}
              />
            </Section>
          )}
          <Section title={$t('Affichage')} open={false}>
            <Row label={$t('Densité')}>
              <Choice
                value={settings.density ?? 'normal'}
                options={[
                  { value: 'compact', label: $t('Serrée') },
                  { value: 'normal', label: $t('Normale') },
                  { value: 'comfortable', label: $t('Aérée') },
                ]}
                onChange={(v) =>
                  set({ density: v === 'normal' ? undefined : (v as 'compact' | 'comfortable') })
                }
                label={$t('Densité des lignes')}
              />
            </Row>
            <Row label={$t('Lignes par page')}>
              <Choice
                value={String(settings.page_size ?? 100)}
                options={['25', '50', '100', '250', '500'].map((v) => ({ value: v, label: v }))}
                onChange={(v) => set({ page_size: v === '100' ? undefined : Number(v) })}
                label={$t('Lignes par page')}
              />
            </Row>
            <Toggle
              label={$t('Numéros de ligne')}
              checked={settings.row_numbers === true}
              onChange={(v) => set({ row_numbers: v || undefined })}
            />
          </Section>
          {numberFormat}
        </>
      )}

      {type === 'pivot' && (
        <>
          <Section title={$t('Tableau croisé')}>
            {(['pivot_rows', 'pivot_columns', 'pivot_values'] as const).map((key) => {
              const pool = key === 'pivot_values' ? metrics : dims
              const chosen = settings[key] ?? []
              return (
                <div key={key} className="space-y-1">
                  <span className="text-sm text-muted-foreground">
                    {key === 'pivot_rows'
                      ? $t('Lignes')
                      : key === 'pivot_columns'
                        ? $t('Colonnes')
                        : $t('Valeurs')}
                  </span>
                  {pool.map((c) => (
                    <label key={c.name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={chosen.includes(c.name)}
                        onChange={() =>
                          set({
                            [key]: chosen.includes(c.name)
                              ? chosen.filter((n) => n !== c.name)
                              : [...chosen, c.name],
                          })
                        }
                      />
                      <span className="truncate">{c.label}</span>
                    </label>
                  ))}
                </div>
              )
            })}
            <Toggle
              label={$t('Totaux')}
              checked={settings.totals !== false}
              onChange={(v) => set({ totals: v ? undefined : false })}
            />
          </Section>
          <Section title={$t('Couleurs')} open={false}>
            <Toggle
              label={$t('Carte de chaleur')}
              checked={settings.heatmap === true}
              onChange={(v) => set({ heatmap: v || undefined })}
            />
            {settings.heatmap === true && (
              <ColorPicker
                value={settings.color}
                onChange={(color) => set({ color })}
                label={$t('Teinte')}
              />
            )}
            <p className="pt-1 text-xs text-muted-foreground">{$t('Selon la valeur :')}</p>
            <RulesEditor
              rules={settings.rules ?? []}
              columns={metrics}
              onChange={(rules) => set({ rules: rules.length === 0 ? undefined : rules })}
            />
          </Section>
          <Section title={$t('Affichage')} open={false}>
            <Row label={$t('Densité')}>
              <Choice
                value={settings.density ?? 'normal'}
                options={[
                  { value: 'compact', label: $t('Serrée') },
                  { value: 'normal', label: $t('Normale') },
                  { value: 'comfortable', label: $t('Aérée') },
                ]}
                onChange={(v) =>
                  set({ density: v === 'normal' ? undefined : (v as 'compact' | 'comfortable') })
                }
                label={$t('Densité des lignes')}
              />
            </Row>
          </Section>
          {numberFormat}
        </>
      )}

      {type === 'map' && (
        <>
          <Section title={$t('Carte')}>
            <Row label={$t('Régions')}>
              <Choice
                value={settings.region ?? 'fr-regions'}
                options={[
                  { value: 'fr-regions', label: $t('Régions de France') },
                  { value: 'fr-departements', label: $t('Départements de France') },
                  { value: 'world', label: $t('Pays du monde') },
                ]}
                onChange={(v) => set({ region: v as VisualizationSettings['region'] })}
                label={$t('Fond de carte')}
              />
            </Row>
            <Row label={$t('Région (nom ou code)')}>
              <Choice
                value={firstDim}
                options={named(dims)}
                onChange={(v) => set({ dimensions: [v] })}
                label={$t('Colonne des régions')}
              />
            </Row>
            {metricPicker}
            <p className="text-xs text-muted-foreground">
              {$t('Ou des points, par leurs coordonnées :')}
            </p>
            <Row label={$t('Latitude')}>
              <Choice
                value={settings.latitude ?? ''}
                options={[
                  { value: '', label: $t('Aucune') },
                  ...named(columns.filter((c) => c.type === 'number')),
                ]}
                onChange={(v) => set({ latitude: v || undefined })}
                label={$t('Latitude')}
              />
            </Row>
            <Row label={$t('Longitude')}>
              <Choice
                value={settings.longitude ?? ''}
                options={[
                  { value: '', label: $t('Aucune') },
                  ...named(columns.filter((c) => c.type === 'number')),
                ]}
                onChange={(v) => set({ longitude: v || undefined })}
                label={$t('Longitude')}
              />
            </Row>
          </Section>
          <Section title={$t('Couleurs')} open={false}>
            <Row label={$t('Teinte')}>
              <Choice
                value={settings.palette ?? 'blue'}
                options={[
                  { value: 'blue', label: $t('Bleu') },
                  { value: 'green', label: $t('Vert') },
                  { value: 'orange', label: $t('Orange') },
                  { value: 'violet', label: $t('Violet') },
                  { value: 'red', label: $t('Rouge') },
                ]}
                onChange={(v) =>
                  set({
                    palette: v === 'blue' ? undefined : (v as VisualizationSettings['palette']),
                  })
                }
                label={$t('Teinte de la carte')}
              />
            </Row>
            <Toggle
              label={$t('Noms des régions')}
              checked={settings.region_labels === true}
              onChange={(v) => set({ region_labels: v || undefined })}
            />
          </Section>
        </>
      )}
    </div>
  )
}
