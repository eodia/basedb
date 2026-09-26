'use client'

import { EnvironmentBadge } from '@/components/app/environment-badge'
import { reportLine } from '@/components/app/environments-editor'
import { FieldIcon, KIND_LABELS } from '@/components/app/field-icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type ApplyReport,
  type ComparedFieldCell,
  type ComparedTableCell,
  type EnvironmentComparison,
  type EnvironmentSummary,
  type PlanStep,
  type ProjectBase,
  type RowComparison,
  type RowSample,
  type StepStatus,
  type StructurePlan,
  type TableRowCounts,
  api,
} from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CircleSlash,
  GitCompareArrows,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Table2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * « Comparer les environnements » — chapter 14, on screen.
 *
 * Two things one does across the environments of a base, and the sidebar of the dialog
 * keeps them apart:
 *
 *   la STRUCTURE — every environment in a column, table by table and field by field,
 *   what differs from production marked; and the migration that carries one onto
 *   another, step by step, each step shown before it is applied;
 *
 *   les LIGNES — one table at a time, the rows of one environment compared with another's
 *   by `_id`, and copied across when asked.
 *
 * Nothing is applied by opening the dialog, choosing a pair or preparing a plan: only the
 * two buttons that say so write anything.
 */

type Pane = { readonly kind: 'structure' } | { readonly kind: 'rows'; readonly lineage: string }

const STATUS: Readonly<Record<StepStatus, { label: string; tone: string; hint: string }>> = {
  ready: {
    label: 'Prêt',
    tone: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
    hint: 'La modification la plus récente est celle de la source.',
  },
  target_newer: {
    label: 'Plus récent dans la cible',
    tone: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    hint: 'La cible a changé cet objet après la source : l’appliquer annulerait ce changement.',
  },
  conflict: {
    label: 'Conflit',
    tone: 'bg-rose-500/15 text-rose-800 dark:text-rose-300',
    hint: 'Les deux environnements l’ont changé depuis leur dernière synchronisation.',
  },
  needs_consent: {
    label: 'IA',
    tone: 'bg-violet-500/15 text-violet-800 dark:text-violet-300',
    hint: 'Les valeurs citées par la consigne partiront chez le fournisseur d’IA.',
  },
}

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

/** What a cell says, to compare it with production's. */
const tableKey = (c: ComparedTableCell | null) =>
  c === null
    ? 'absent'
    : JSON.stringify([c.deleted, c.label, c.description, c.color, c.icon, c.image, c.displayField])
const fieldKey = (c: ComparedFieldCell | null) => (c === null ? 'absent' : JSON.stringify(c))

function EnvironmentSelect({
  environments,
  value,
  onChange,
  label,
}: {
  readonly environments: readonly EnvironmentSummary[]
  readonly value: string
  readonly onChange: (name: string) => void
  readonly label: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {environments.map((env) => (
          <SelectItem key={env.id} value={env.name}>
            {env.environment}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Source → target, with a button that swaps them. */
function Pair({
  environments,
  source,
  target,
  onSource,
  onTarget,
}: {
  readonly environments: readonly EnvironmentSummary[]
  readonly source: string
  readonly target: string
  readonly onSource: (name: string) => void
  readonly onTarget: (name: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <EnvironmentSelect
        environments={environments}
        value={source}
        onChange={onSource}
        label="Environnement source"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          onSource(target)
          onTarget(source)
        }}
        aria-label="Inverser la source et la cible"
        title="Inverser"
      >
        <ArrowLeftRight className="size-4" />
      </Button>
      <EnvironmentSelect
        environments={environments}
        value={target}
        onChange={onTarget}
        label="Environnement cible"
      />
    </div>
  )
}

// ── Structure ───────────────────────────────────────────────────────────────────

function TableCellView({ cell }: { readonly cell: ComparedTableCell | null }) {
  if (cell === null) return <span className="text-muted-foreground">absente</span>
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1.5 font-medium',
        cell.deleted && 'line-through opacity-60',
      )}
    >
      <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{cell.label}</span>
      {cell.deleted && <span className="shrink-0 text-xs font-normal no-underline">supprimée</span>}
    </span>
  )
}

function FieldCellView({ cell }: { readonly cell: ComparedFieldCell | null }) {
  if (cell === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-center gap-1.5">
        <FieldIcon kind={cell.kind} />
        <span className="truncate">{cell.label}</span>
        {cell.required && (
          <span className="shrink-0 text-destructive" title="Obligatoire">
            *
          </span>
        )}
        {cell.ai && <Sparkles className="size-3 shrink-0 text-violet-500" aria-label="IA" />}
      </span>
      <span className="truncate text-[0.7rem] text-muted-foreground">
        {cell.link !== null
          ? `relation → ${cell.link}`
          : cell.options !== null
            ? cell.options.join(', ') || 'aucun choix'
            : (KIND_LABELS[cell.kind] ?? cell.kind)}
      </span>
    </span>
  )
}

function StructureMatrix({
  comparison,
  onlyDifferences,
}: {
  readonly comparison: EnvironmentComparison
  readonly onlyDifferences: boolean
}) {
  const envs = comparison.environments
  const tables = onlyDifferences ? comparison.tables.filter((t) => t.differs) : comparison.tables
  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <Check className="size-6 text-emerald-600" />
        {comparison.tables.length === 0
          ? 'Aucune table dans ces environnements.'
          : 'La structure est la même dans tous les environnements.'}
      </div>
    )
  }
  return (
    <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-background">
        <tr>
          <th className="w-56 border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground">
            Table · champ
          </th>
          {envs.map((env) => (
            <th key={env.id} className="min-w-52 border-b px-3 py-2 text-left">
              <span className="flex items-center gap-2">
                <EnvironmentBadge
                  environment={{
                    label: env.environment,
                    production: env.production,
                    position: env.position,
                  }}
                />
                <span className="truncate font-mono text-[0.7rem] font-normal text-muted-foreground">
                  {env.name}
                </span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tables.map((table) => {
          const reference = table.cells[0] ?? null
          const name = table.cells.find((c) => c !== null)?.label ?? '?'
          const fields = onlyDifferences ? table.fields.filter((f) => f.differs) : table.fields
          return [
            <tr key={table.lineage} className="bg-muted/40">
              <td className="border-b px-3 py-2 font-medium">
                <span className="flex items-center gap-1.5">
                  {name}
                  {table.differs && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-amber-500"
                      aria-label="Diffère"
                    />
                  )}
                </span>
              </td>
              {table.cells.map((cell, index) => (
                <td
                  key={envs[index]?.id ?? index}
                  className={cn(
                    'border-b px-3 py-2',
                    index > 0 && tableKey(cell) !== tableKey(reference) && 'bg-amber-500/10',
                  )}
                >
                  <TableCellView cell={cell} />
                </td>
              ))}
            </tr>,
            ...fields.map((field) => {
              const ref = field.cells[0] ?? null
              const label = field.cells.find((c) => c !== null)?.label ?? '?'
              return (
                <tr key={`${table.lineage}:${field.lineage}`}>
                  <td className="border-b py-1.5 pr-3 pl-7 text-muted-foreground">{label}</td>
                  {field.cells.map((cell, index) => (
                    <td
                      key={envs[index]?.id ?? index}
                      className={cn(
                        'border-b px-3 py-1.5',
                        index > 0 && fieldKey(cell) !== fieldKey(ref) && 'bg-amber-500/10',
                      )}
                    >
                      <FieldCellView cell={cell} />
                    </td>
                  ))}
                </tr>
              )
            }),
          ]
        })}
      </tbody>
    </table>
  )
}

function StepRow({
  step,
  checked,
  disabled,
  onChange,
  outcome,
}: {
  readonly step: PlanStep
  readonly checked: boolean
  readonly disabled: boolean
  readonly onChange: (checked: boolean) => void
  readonly outcome?: ApplyReport['results'][number]
}) {
  const status = STATUS[step.status]
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        aria-label={step.summary}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-sm', step.destructive && 'text-destructive')}>
            {step.summary}
          </span>
          <span
            className={cn('rounded-full px-1.5 py-0.5 text-[0.7rem] font-medium', status.tone)}
            title={status.hint}
          >
            {status.label}
          </span>
          {step.table.label !== '' && step.field !== undefined && (
            <span className="text-xs text-muted-foreground">{step.table.label}</span>
          )}
        </div>
        {step.changes.map((change) => (
          <p key={change.attribute} className="text-xs text-muted-foreground">
            {change.attribute} :{' '}
            {change.from !== null && (
              <>
                <span className="line-through">{change.from || '(vide)'}</span>
                <ArrowRight className="mx-1 inline size-3" />
              </>
            )}
            <span className="text-foreground">{change.to ?? '(vide)'}</span>
          </p>
        ))}
        {step.status !== 'ready' && step.status !== 'needs_consent' && (
          <p className="text-xs text-amber-700 dark:text-amber-400">{status.hint}</p>
        )}
        {outcome !== undefined && (
          <p
            className={cn(
              'flex items-center gap-1 text-xs',
              outcome.outcome === 'applied'
                ? 'text-emerald-700 dark:text-emerald-400'
                : outcome.outcome === 'failed'
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
          >
            {outcome.outcome === 'applied' ? (
              <Check className="size-3" />
            ) : outcome.outcome === 'failed' ? (
              <X className="size-3" />
            ) : (
              <CircleSlash className="size-3" />
            )}
            {outcome.outcome === 'applied'
              ? 'Appliquée'
              : outcome.outcome === 'failed'
                ? `Échec (${outcome.code ?? '?'})`
                : 'Ignorée'}
            {outcome.note !== undefined && ` — ${outcome.note}`}
          </p>
        )}
      </div>
    </li>
  )
}

function MigrationPanel({
  base,
  environments,
  onApplied,
  onBack,
}: {
  readonly base: string
  readonly environments: readonly EnvironmentSummary[]
  readonly onApplied: (target: string) => void
  readonly onBack: () => void
}) {
  // The usual direction: an environment where one works, into production.
  const [source, setSource] = useState(environments[1]?.name ?? environments[0]?.name ?? '')
  const [target, setTarget] = useState(environments[0]?.name ?? '')
  const [plan, setPlan] = useState<StructurePlan | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ApplyReport | null>(null)

  const load = useCallback(async () => {
    if (source === '' || target === '' || source === target) {
      setPlan(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await api.planStructure(base, source, target)
      setPlan(next)
      setSelected(new Set(next.steps.filter((s) => s.selected).map((s) => s.id)))
    } catch (e) {
      setError(messageFor(e))
      setPlan(null)
    } finally {
      setBusy(false)
    }
  }, [base, source, target])

  useEffect(() => {
    setReport(null)
    void load()
  }, [load])

  const hasAi = plan?.steps.some((s) => s.kind === 'set_ai') === true
  const apply = async () => {
    if (plan === null || selected.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const done = await api.applyStructure(base, {
        source,
        target,
        steps: plan.steps.filter((s) => selected.has(s.id)).map((s) => s.id),
        consent,
      })
      setReport(done)
      onApplied(target)
      // The plan after: what is left, if anything — the report stays on screen.
      const next = await api.planStructure(base, source, target)
      setPlan(next)
      setSelected(new Set(next.steps.filter((s) => s.selected).map((s) => s.id)))
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const sourceEnv = environments.find((e) => e.name === source)
  const targetEnv = environments.find((e) => e.name === target)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b py-3 pr-14 pl-5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Retour à la comparaison
        </Button>
        <div className="flex-1" />
        <Pair
          environments={environments}
          source={source}
          target={target}
          onSource={setSource}
          onTarget={setTarget}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-discret px-5 py-4">
        <h3 className="text-base font-semibold">
          Migrer la structure de « {sourceEnv?.environment ?? '?'} » vers «{' '}
          {targetEnv?.environment ?? '?'} »
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque étape est une opération ordinaire, avec ses contrôles et son historique. Celles qui
          annuleraient une modification plus récente de la cible, ou qui sont en conflit, ne sont
          pas cochées d’office.
          {plan?.lastSync != null && (
            <> Dernière synchronisation : {DATE.format(new Date(plan.lastSync))}.</>
          )}
        </p>

        {error !== null && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {source === target && (
          <p className="mt-6 text-sm text-muted-foreground">
            Choisissez deux environnements différents.
          </p>
        )}

        {busy && plan === null && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {report !== null && (
          <div
            className={cn(
              'mt-4 rounded-md border px-3 py-2 text-sm',
              report.failed > 0
                ? 'border-destructive/30 bg-destructive/5'
                : 'border-emerald-500/30 bg-emerald-500/5',
            )}
          >
            <p className="font-medium">Migration terminée — {reportLine(report)}.</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {report.results.map((r) => (
                <li key={r.id} className="flex items-center gap-1.5">
                  {r.outcome === 'applied' ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : r.outcome === 'failed' ? (
                    <X className="size-3 text-destructive" />
                  ) : (
                    <CircleSlash className="size-3" />
                  )}
                  <span>
                    {r.summary}
                    {r.code !== undefined && ` — ${r.code}`}
                    {r.note !== undefined && ` — ${r.note}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan !== null && plan.steps.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Check className="size-6 text-emerald-600" />
            Rien à migrer : la cible a déjà la structure de la source.
          </div>
        )}

        {plan !== null && plan.steps.length > 0 && (
          <>
            <div className="mt-4 flex items-center gap-3 text-xs">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() =>
                  setSelected(
                    new Set(
                      plan.steps.filter((s) => s.kind !== 'set_ai' || consent).map((s) => s.id),
                    ),
                  )
                }
              >
                Tout cocher
              </button>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setSelected(new Set())}
              >
                Tout décocher
              </button>
              <span className="text-muted-foreground">
                {selected.size} étape{selected.size > 1 ? 's' : ''} sur {plan.steps.length}
              </span>
            </div>
            <ul className="mt-2 divide-y rounded-lg border">
              {plan.steps.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  checked={selected.has(step.id)}
                  disabled={busy || (step.kind === 'set_ai' && !consent)}
                  onChange={(checked) =>
                    setSelected((was) => {
                      const next = new Set(was)
                      if (checked) next.add(step.id)
                      else next.delete(step.id)
                      return next
                    })
                  }
                />
              ))}
            </ul>
          </>
        )}

        {plan !== null && plan.notes.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Différences qu’aucune étape ne règle
            </p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {plan.notes.map((note) => (
                <li
                  key={`${note.table}:${note.field ?? ''}:${note.message}`}
                  className="flex items-start gap-1.5"
                >
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                  <span>
                    <span className="text-foreground">
                      {note.table}
                      {note.field !== undefined && ` · ${note.field}`}
                    </span>{' '}
                    — {note.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {plan !== null && plan.steps.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t px-5 py-3">
          {hasAi && (
            <label
              htmlFor="environments-ai-consent"
              className="flex min-w-0 flex-1 items-start gap-2 text-xs"
            >
              <Checkbox
                id="environments-ai-consent"
                checked={consent}
                onCheckedChange={(v) => {
                  setConsent(v === true)
                  if (v !== true) {
                    setSelected(
                      (was) =>
                        new Set(
                          [...was].filter(
                            (id) => plan.steps.find((s) => s.id === id)?.kind !== 'set_ai',
                          ),
                        ),
                    )
                  }
                }}
                className="mt-0.5"
              />
              <span>
                J’accepte que, pour les champs IA reportés, les valeurs des colonnes citées soient
                envoyées au fournisseur d’IA configuré.
              </span>
            </label>
          )}
          <div className="flex-1" />
          <Button onClick={() => void apply()} disabled={busy || selected.size === 0}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitCompareArrows className="size-4" />
            )}
            Appliquer {selected.size} étape{selected.size > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}

function StructurePane({
  base,
  comparison,
  onApplied,
}: {
  readonly base: string
  readonly comparison: EnvironmentComparison
  readonly onApplied: (target: string) => void
}) {
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const differing = comparison.tables.filter((t) => t.differs).length

  if (migrating) {
    return (
      <MigrationPanel
        base={base}
        environments={comparison.environments}
        onApplied={onApplied}
        onBack={() => setMigrating(false)}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b py-3 pr-14 pl-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">Structure</h3>
          <p className="text-xs text-muted-foreground">
            Un environnement par colonne ; ce qui diffère de la production est surligné.{' '}
            {differing === 0
              ? 'Aucune différence.'
              : `${differing} table${differing > 1 ? 's' : ''} diffère${differing > 1 ? 'nt' : ''}.`}
          </p>
        </div>
        <label htmlFor="environments-only-differences" className="flex items-center gap-2 text-xs">
          <Checkbox
            id="environments-only-differences"
            checked={onlyDifferences}
            onCheckedChange={(v) => setOnlyDifferences(v === true)}
          />
          Seulement les différences
        </label>
        <Button onClick={() => setMigrating(true)} disabled={comparison.environments.length < 2}>
          <GitCompareArrows className="size-4" />
          Appliquer les migrations…
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scroll-discret">
        <StructureMatrix comparison={comparison} onlyDifferences={onlyDifferences} />
      </div>
    </div>
  )
}

// ── Rows ────────────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tone,
}: {
  readonly label: string
  readonly value: number
  readonly tone?: string
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-semibold tabular-nums', value > 0 && tone)}>{value}</p>
    </div>
  )
}

function Samples({
  title,
  rows,
  total,
}: {
  readonly title: string
  readonly rows: readonly RowSample[]
  readonly total: number
}) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        {title}
        {total > rows.length && ` — ${rows.length} premières sur ${total}`}
      </p>
      <ul className="divide-y rounded-lg border text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate">
              {row.display ?? <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>}
            </span>
            {row.changed.length > 0 && (
              <span className="truncate text-xs text-muted-foreground">
                {row.changed.join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RowsPane({
  base,
  lineage,
  source,
  target,
  environments,
  onSource,
  onTarget,
  onSynced,
}: {
  readonly base: string
  readonly lineage: string
  readonly source: string
  readonly target: string
  readonly environments: readonly EnvironmentSummary[]
  readonly onSource: (name: string) => void
  readonly onTarget: (name: string) => void
  readonly onSynced: (target: string) => void
}) {
  const [comparison, setComparison] = useState<RowComparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [insert, setInsert] = useState(true)
  const [update, setUpdate] = useState(true)
  const [remove, setRemove] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    if (source === target) {
      setComparison(null)
      return
    }
    try {
      setComparison(await api.compareRows(base, lineage, source, target))
    } catch (e) {
      setComparison(null)
      setError(messageFor(e))
    }
  }, [base, lineage, source, target])

  useEffect(() => {
    setComparison(null)
    setDone(null)
    void load()
  }, [load])

  const sync = async () => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await api.syncRows(base, lineage, {
        source,
        target,
        insert,
        update,
        delete: remove,
      })
      setDone(
        `${result.inserted} ajoutée${result.inserted > 1 ? 's' : ''}, ${result.updated} mise${result.updated > 1 ? 's' : ''} à jour, ${result.deleted} supprimée${result.deleted > 1 ? 's' : ''}.`,
      )
      onSynced(target)
      await load()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const sourceEnv = environments.find((e) => e.name === source)
  const targetEnv = environments.find((e) => e.name === target)
  const counts = comparison?.counts
  const work =
    counts === undefined
      ? 0
      : (insert ? counts.onlySource : 0) +
        (update ? counts.different : 0) +
        (remove ? counts.onlyTarget : 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b py-3 pr-14 pl-5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">
            {comparison?.table.label ?? 'Lignes'}
          </h3>
          <p className="text-xs text-muted-foreground">
            Les lignes se reconnaissent à leur <span className="font-mono">_id</span>, qu’elles
            gardent d’un environnement à l’autre.
          </p>
        </div>
        <Pair
          environments={environments}
          source={source}
          target={target}
          onSource={onSource}
          onTarget={onTarget}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-discret px-5 py-4">
        {error !== null && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {source === target && (
          <p className="text-sm text-muted-foreground">
            Choisissez deux environnements différents.
          </p>
        )}
        {comparison === null && error === null && source !== target && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {comparison !== null && counts !== undefined && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label={`Seulement dans ${sourceEnv?.environment ?? 'la source'}`}
                value={counts.onlySource}
                tone="text-emerald-700 dark:text-emerald-400"
              />
              <Stat
                label="Différentes"
                value={counts.different}
                tone="text-amber-700 dark:text-amber-400"
              />
              <Stat
                label={`Seulement dans ${targetEnv?.environment ?? 'la cible'}`}
                value={counts.onlyTarget}
                tone="text-rose-700 dark:text-rose-400"
              />
              <Stat label="Identiques" value={counts.identical} />
            </div>

            <div className="space-y-3">
              <Samples
                title={`Seulement dans ${sourceEnv?.environment ?? 'la source'}`}
                rows={comparison.samples.onlySource}
                total={counts.onlySource}
              />
              <Samples
                title="Différentes (colonnes qui diffèrent)"
                rows={comparison.samples.different}
                total={counts.different}
              />
              <Samples
                title={`Seulement dans ${targetEnv?.environment ?? 'la cible'}`}
                rows={comparison.samples.onlyTarget}
                total={counts.onlyTarget}
              />
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Colonnes recopiées :{' '}
                <span className="text-foreground">
                  {comparison.columns.map((c) => c.label).join(', ') || 'aucune'}
                </span>
              </p>
              {comparison.skipped.map((s) => (
                <p key={s.label}>
                  Non recopiée — <span className="text-foreground">{s.label}</span> : {s.reason}
                </p>
              ))}
              {comparison.lastSync !== null && (
                <p>Dernière synchronisation : {DATE.format(new Date(comparison.lastSync))}.</p>
              )}
            </div>
          </>
        )}
      </div>

      {comparison !== null && (
        <div className="flex flex-wrap items-center gap-4 border-t px-5 py-3 text-sm">
          <label htmlFor="rows-insert" className="flex items-center gap-2">
            <Checkbox
              id="rows-insert"
              checked={insert}
              onCheckedChange={(v) => setInsert(v === true)}
            />
            Ajouter les manquantes
          </label>
          <label htmlFor="rows-update" className="flex items-center gap-2">
            <Checkbox
              id="rows-update"
              checked={update}
              onCheckedChange={(v) => setUpdate(v === true)}
            />
            Mettre à jour les différentes
          </label>
          <label htmlFor="rows-delete" className="flex items-center gap-2 text-destructive">
            <Checkbox
              id="rows-delete"
              checked={remove}
              onCheckedChange={(v) => setRemove(v === true)}
            />
            Supprimer celles absentes de la source
          </label>
          <div className="flex-1" />
          {done !== null && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">{done}</span>
          )}
          <Button
            onClick={() => void sync()}
            disabled={busy || work === 0 || (!insert && !update && !remove)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Synchroniser {work > 0 ? `${work} ligne${work > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── The dialog ──────────────────────────────────────────────────────────────────

export function EnvironmentsDialog({
  base,
  onClose,
  onChanged,
}: {
  readonly base: ProjectBase | null
  readonly onClose: () => void
  /** The structure or rows of an environment changed: its screens should reload. */
  readonly onChanged: (name: string) => void
}) {
  const [comparison, setComparison] = useState<EnvironmentComparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pane, setPane] = useState<Pane>({ kind: 'structure' })
  const [rowSource, setRowSource] = useState('')
  const [rowTarget, setRowTarget] = useState('')
  const [counts, setCounts] = useState<readonly TableRowCounts[]>([])

  const name = base?.name ?? ''
  const load = useCallback(async () => {
    if (name === '') return
    setError(null)
    try {
      const next = await api.compareEnvironments(name)
      setComparison(next)
      setRowSource((was) => (was === '' ? (next.environments[0]?.name ?? '') : was))
      setRowTarget((was) => (was === '' ? (next.environments[1]?.name ?? '') : was))
    } catch (e) {
      setError(messageFor(e))
    }
  }, [name])

  useEffect(() => {
    if (base === null) {
      setComparison(null)
      setPane({ kind: 'structure' })
      setRowSource('')
      setRowTarget('')
      setCounts([])
      return
    }
    void load()
  }, [base, load])

  const loadCounts = useCallback(async () => {
    if (name === '' || rowSource === '' || rowTarget === '' || rowSource === rowTarget) {
      setCounts([])
      return
    }
    try {
      setCounts(await api.countRows(name, rowSource, rowTarget))
    } catch {
      setCounts([])
    }
  }, [name, rowSource, rowTarget])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  // The tables of the sidebar: every table live somewhere, by lineage.
  const tables = useMemo(
    () =>
      (comparison?.tables ?? [])
        .map((t) => ({
          lineage: t.lineage,
          label: t.cells.find((c) => c !== null && !c.deleted)?.label ?? null,
        }))
        .filter((t): t is { lineage: string; label: string } => t.label !== null),
    [comparison],
  )
  const environments = comparison?.environments ?? []

  const changed = (target: string) => {
    onChanged(target)
    void load()
    void loadCounts()
  }

  return (
    <Dialog open={base !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
          <div className="border-b px-4 py-3">
            <DialogTitle className="text-sm">Comparer les environnements</DialogTitle>
            <DialogDescription className="truncate text-xs">{base?.label}</DialogDescription>
          </div>
          <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-discret p-2">
            <div className="space-y-0.5">
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Structure
              </p>
              <button
                type="button"
                onClick={() => setPane({ kind: 'structure' })}
                className={cn(
                  'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-sidebar-accent',
                  pane.kind === 'structure' && 'bg-sidebar-accent font-medium',
                )}
              >
                <Layers className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate text-left">Tables et champs</span>
                {comparison?.tables.some((t) => t.differs) && (
                  <span className="size-1.5 rounded-full bg-amber-500" aria-label="Différences" />
                )}
              </button>
            </div>
            <div className="space-y-0.5">
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Synchronisation des lignes
              </p>
              {tables.map((t) => {
                const count = counts.find((c) => c.lineage === t.lineage)
                return (
                  <button
                    key={t.lineage}
                    type="button"
                    onClick={() => setPane({ kind: 'rows', lineage: t.lineage })}
                    className={cn(
                      'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-sidebar-accent',
                      pane.kind === 'rows' &&
                        pane.lineage === t.lineage &&
                        'bg-sidebar-accent font-medium',
                    )}
                  >
                    <Table2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-left">{t.label}</span>
                    {count !== undefined && (
                      <span className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums">
                        {count.source ?? '—'} → {count.target ?? '—'}
                      </span>
                    )}
                  </button>
                )
              })}
              {tables.length === 0 && (
                <p className="px-2 text-xs text-muted-foreground">Aucune table.</p>
              )}
            </div>
          </nav>
          <p className="border-t px-4 py-2 text-[0.7rem] text-muted-foreground">
            Les environnements s’ajoutent depuis « Modifier la base ».
          </p>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {error !== null && (
            <p className="m-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {comparison === null && error === null && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {comparison !== null && environments.length < 2 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
              <Layers className="size-6" />
              <p>
                Cette base n’a qu’un environnement. Ajoutez une recette ou un développement depuis «
                Modifier la base » : ils recevront une copie de sa structure.
              </p>
            </div>
          )}
          {comparison !== null && environments.length >= 2 && pane.kind === 'structure' && (
            <StructurePane base={name} comparison={comparison} onApplied={changed} />
          )}
          {comparison !== null && environments.length >= 2 && pane.kind === 'rows' && (
            <RowsPane
              key={pane.lineage}
              base={name}
              lineage={pane.lineage}
              source={rowSource}
              target={rowTarget}
              environments={environments}
              onSource={setRowSource}
              onTarget={setRowTarget}
              onSynced={changed}
            />
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
