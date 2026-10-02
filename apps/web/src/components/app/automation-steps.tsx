'use client'

import { ConfirmDialog } from '@/components/app/admin/users-tab'
import { TRIGGER_ICONS, TRIGGER_TONE } from '@/components/app/automation-flow'
import { TriggerPicker } from '@/components/app/automation-picker'
import { FieldIcon } from '@/components/app/field-icon'
import { RichTextEditor, type VariableChoice } from '@/components/app/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Choice } from '@/components/ui/choice'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import {
  type Automation,
  type AutomationHttpMethod,
  type AutomationValueOp,
  type AutomationWaitUnit,
  type DescribedBase,
  type DocumentTemplate,
  type Field,
  type Integration,
  type Member,
  api,
  hookUrl,
} from '@/lib/api/client'
import {
  AI_ANSWERS,
  type CiteGroup,
  type Draft,
  type DraftAttachment,
  type DraftBody,
  type DraftHeader,
  type DraftMeasure,
  type DraftPath,
  type DraftStep,
  HTTP_METHODS,
  MAX_ATTACHMENTS,
  MAX_CC,
  MAX_LOOP_ROWS,
  MAX_MEASURES,
  MAX_PATHS,
  MAX_RECIPIENTS,
  MAX_RETRIES,
  MAX_WAIT_DAYS,
  MEASURE_FNS,
  type RowChoice,
  TRIGGER_HINTS,
  TRIGGER_LABELS,
  TRIGGER_ROW,
  VALUE_OPS,
  type ValueRow,
  attachmentKey,
  blankPath,
  changeableRows,
  citeGroups,
  comparesWith,
  filterIssue,
  findPath,
  freshId,
  hasBody,
  jsonBodyIssue,
  loopsAround,
  measurableFields,
  notFoundBranch,
  offsetText,
  pathProblem,
  pathSummary,
  rowChoices,
  rowTableOf,
  stepCaption,
  stepsBefore,
  triggerHasTable,
  triggerProblem,
  writableFields,
} from '@/lib/automations'
import { copy } from '@/lib/export'
import { $t, $tp, intlLocale, weekdayNames } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  ArrowDown,
  ArrowUp,
  Braces,
  Check,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  Paperclip,
  Plus,
  RefreshCw,
  Split,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

/**
 * The settings of what is chosen on the flow — chapter 17, one piece at a time: the
 * trigger and its condition, a step, a condition's paths, a path's test. Each form offers
 * what that point of the flow may name: the rows it may act on, the values it may cite —
 * the triggering row's, and those of the steps passed on every way to it.
 */

export function Section({
  title,
  hint,
  children,
}: {
  readonly title: string
  readonly hint?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {hint !== undefined && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** A remark under a form: what a step gives, what it does that is not plain. */
function Note({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">{children}</p>
  )
}

/** What is wrong, said where it is typed. */
function Warning({ children }: { readonly children: ReactNode }) {
  return <p className="text-xs text-amber-600 dark:text-amber-400">{children}</p>
}

/** A few ways of doing one thing, side by side: one chosen. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  readonly value: T
  readonly options: ReadonlyArray<{ readonly value: T; readonly label: string }>
  readonly onChange: (value: T) => void
  readonly label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full rounded-md border bg-muted/40 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          // biome-ignore lint/a11y/useSemanticElements: a segmented control, the ARIA radio pattern
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-[5px] px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            o.value === value
              ? 'bg-background font-medium text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FieldSelect({
  fields,
  value,
  onChange,
  placeholder = $t('Choisir un champ'),
  label,
  className,
}: {
  readonly fields: readonly Field[]
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly label: string
  readonly className?: string
}) {
  return (
    <Choice
      value={value}
      onValueChange={onChange}
      options={[
        {
          value: '',
          label: placeholder,
          render: <span className="text-muted-foreground">{placeholder}</span>,
        },
        ...fields.map((f) => ({ value: f.name, label: f.label })),
      ]}
      aria-label={label}
      className={cn(value === '' && 'text-muted-foreground', className)}
    />
  )
}

function TableSelect({
  base,
  value,
  onChange,
  label,
}: {
  readonly base: DescribedBase
  readonly value: string
  readonly onChange: (table: string) => void
  readonly label: string
}) {
  return (
    <Choice
      value={value === '' ? null : value}
      onValueChange={onChange}
      options={base.tables.map((t) => ({
        value: t.name,
        label: $t('dans {label}', { label: t.label }),
      }))}
      placeholder={$t('Choisir une table')}
      aria-label={label}
    />
  )
}

/**
 * A text that may cite — the triggering row, a step before, now: a menu beside it puts a
 * citation where the caret was, then gives the text back its focus, the caret after
 * what was cited, to go on typing.
 */
function CitingText({
  value,
  onChange,
  groups,
  label,
  placeholder,
  multiline = false,
  rows = 3,
  invalid = false,
  className,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly groups: readonly CiteGroup[]
  readonly label: string
  readonly placeholder?: string
  readonly multiline?: boolean
  /** The lines a multiline text shows. */
  readonly rows?: number
  readonly invalid?: boolean
  readonly className?: string
}) {
  const target = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const cited = useRef(false)
  const cite = (token: string) => {
    const el = target.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`)
    cited.current = true
    // Back to the text at once, not when the menu has finished fading: what is typed
    // next goes after the citation.
    const at = start + token.length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at, at)
    })
  }
  const props = {
    ref: target,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder,
    'aria-label': label,
    'aria-invalid': invalid,
  }
  return (
    <div className={cn('flex gap-1.5', multiline ? 'items-start' : 'items-center')}>
      {multiline ? (
        <Textarea
          {...props}
          rows={rows}
          className={cn('min-h-0 flex-1 resize-none text-sm', className)}
        />
      ) : (
        <Input {...props} className={cn('h-8', className)} />
      )}
      <DropdownMenu modal={false}>
        <Hint label={$t('Citer une valeur')}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={$t('Citer une valeur')}
              className="shrink-0"
            >
              <Braces className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent
          align="end"
          className="max-h-80 w-72 overflow-y-auto"
          onCloseAutoFocus={(e) => {
            // The text has the focus back already; the button must not take it.
            if (cited.current) e.preventDefault()
            cited.current = false
          }}
        >
          {groups.map((group, g) => (
            <div key={group.label}>
              {g > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
              {group.items.map((item) => (
                <DropdownMenuItem key={item.token} onSelect={() => cite(item.token)}>
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto truncate pl-3 font-mono text-[11px] text-muted-foreground">
                    {item.token}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Which row a step acts on — shown only when there is a choice to make. */
function RowSelect({
  choices,
  value,
  onChange,
  label,
  none,
}: {
  readonly choices: readonly RowChoice[]
  readonly value: string
  readonly onChange: (value: string) => void
  readonly label: string
  /** What « no row » is called, when a step may have none. */
  readonly none?: string
}) {
  const alone = choices.length === 1 && choices[0]?.value === value && none === undefined
  if (alone) return null
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Choice
        value={value === '' && none === undefined ? null : value}
        onValueChange={onChange}
        options={[
          ...(none === undefined ? [] : [{ value: '', label: none }]),
          ...choices.map((c) => ({ value: c.value, label: c.label })),
        ]}
        placeholder={$t('Choisir une ligne')}
        aria-label={label}
      />
    </div>
  )
}

/** A filter, in the language of filters, that may cite; what is wrong said as it is typed. */
function FilterInput({
  value,
  onChange,
  fields,
  groups,
  label,
  placeholder,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Every field of the table filtered, system columns included. */
  readonly fields: readonly Field[]
  readonly groups: readonly CiteGroup[]
  readonly label: string
  readonly placeholder: string
}) {
  const issue = filterIssue(value, fields)
  return (
    <div className="space-y-1">
      <CitingText
        value={value}
        onChange={onChange}
        groups={groups}
        label={label}
        placeholder={placeholder}
        invalid={issue !== null}
        className="font-mono text-sm"
      />
      {issue !== null && <Warning>{issue}</Warning>}
    </div>
  )
}

function ValueRows({
  rows,
  targetFields,
  groups,
  onChange,
}: {
  readonly rows: readonly ValueRow[]
  readonly targetFields: readonly Field[]
  readonly groups: readonly CiteGroup[]
  readonly onChange: (rows: ValueRow[]) => void
}) {
  const writable = writableFields(targetFields)
  const setRow = (index: number, patch: Partial<ValueRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={`${index}:${row.field}`} className="space-y-1 rounded-md border p-2">
          <div className="flex items-center gap-1.5">
            <FieldSelect
              fields={writable}
              value={row.field}
              onChange={(field) => setRow(index, { field })}
              label={$t('Champ {value}', { value: index + 1 })}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              aria-label={$t('Retirer le champ {value}', { value: index + 1 })}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <CitingText
            value={row.value}
            onChange={(value) => setRow(index, { value })}
            groups={groups}
            label={$t('Valeur {value}', { value: index + 1 })}
            placeholder={$t('Valeur, ou {{champ}}')}
          />
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => onChange([...rows, { field: '', value: '' }])}
      >
        <Plus className="size-3.5" />
        {$t('Champ')}
      </Button>
    </div>
  )
}

function MessageInput({
  value,
  onChange,
  groups,
  label,
  placeholder,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly groups: readonly CiteGroup[]
  readonly label: string
  readonly placeholder: string
}) {
  return (
    <CitingText
      value={value}
      onChange={onChange}
      groups={groups}
      label={label}
      placeholder={placeholder}
      multiline
    />
  )
}

/** A shift of days around a date: how many, and before or after — 0, the day itself. */
function OffsetInput({
  value,
  onChange,
  label,
}: {
  readonly value: number
  readonly onChange: (days: number) => void
  readonly label: string
}) {
  const days = Math.abs(value)
  // The direction is kept while the number is 0: « 3 days before » is typed 3 after it.
  const [before, setBefore] = useState(value <= 0)
  useEffect(() => {
    if (value !== 0) setBefore(value < 0)
  }, [value])
  const signed = (n: number, back: boolean) => (back ? -n : n)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          max={MAX_WAIT_DAYS}
          value={Number.isFinite(days) ? days : ''}
          onChange={(e) => onChange(signed(e.target.valueAsNumber, before))}
          aria-label={label}
          className="h-8 w-20"
        />
        <Choice
          value={before ? 'before' : 'after'}
          onValueChange={(v) => {
            setBefore(v === 'before')
            onChange(signed(days, v === 'before'))
          }}
          options={[
            { value: 'before', label: $tp(days, 'jour avant', 'jours avant') },
            { value: 'after', label: $tp(days, 'jour après', 'jours après') },
          ]}
          aria-label={$t('Avant ou après la date')}
          className="flex-1"
        />
      </div>
      <p className="text-xs text-muted-foreground">{offsetText(value)}</p>
    </div>
  )
}

const fieldsOfTable = (base: DescribedBase, name: string | null) =>
  (base.tables.find((t) => t.name === name)?.fields ?? []).filter((f) => f.system !== true)

/** What a filter on a table may name: its fields, system columns included. */
const filterFieldsOf = (base: DescribedBase, name: string | null) =>
  base.tables.find((t) => t.name === name)?.fields ?? []

/** The fields a date is read from: a date, or a date and time. */
const dateFieldsOf = (base: DescribedBase, name: string | null) =>
  fieldsOfTable(base, name).filter((f) => f.kind === 'date' || f.kind === 'datetime')

// ── The trigger ─────────────────────────────────────────────────────────────

const WEEKDAYS = weekdayNames('long')

export function TriggerSettings({
  draft,
  base,
  automation,
  onChange,
  onRegenerateHook,
}: {
  readonly draft: Draft
  readonly base: DescribedBase
  readonly automation: Automation | null
  readonly onChange: (patch: Partial<Draft>) => void
  /** A new address for a webhook trigger, the old one stopping at once. */
  readonly onRegenerateHook: () => Promise<void>
}) {
  const [picking, setPicking] = useState(false)
  const kind = draft.trigger.kind
  const setTrigger = (patch: Partial<Draft['trigger']>) =>
    onChange({ trigger: { ...draft.trigger, ...patch } })
  const withTable = triggerHasTable(kind)
  const sourceFields = fieldsOfTable(base, draft.trigger.table)
  const setSchedule = (patch: Partial<Draft['trigger']['schedule']>) =>
    setTrigger({ schedule: { ...draft.trigger.schedule, ...patch } })
  const setDate = (patch: Partial<Draft['trigger']['date']>) =>
    setTrigger({ date: { ...draft.trigger.date, ...patch } })
  const Icon = TRIGGER_ICONS[kind]
  const problem = triggerProblem(draft)

  return (
    <div className="space-y-6">
      <Section title={$t('Quand')}>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="group flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              TRIGGER_TONE,
            )}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{TRIGGER_LABELS[kind]}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {TRIGGER_HINTS[kind]}
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-primary group-hover:underline">
            {$t('Changer')}
          </span>
        </button>
        <TriggerPicker
          open={picking}
          current={kind}
          onPick={(next) => {
            setPicking(false)
            setTrigger({
              kind: next,
              // A trigger with a table starts on the first, if none was chosen yet.
              table:
                triggerHasTable(next) && draft.trigger.table === ''
                  ? (base.tables[0]?.name ?? '')
                  : draft.trigger.table,
            })
          }}
          onClose={() => setPicking(false)}
        />
        {withTable && (
          <TableSelect
            base={base}
            value={draft.trigger.table}
            onChange={(table) =>
              setTrigger({ table, fields: [], date: { ...draft.trigger.date, field: '' } })
            }
            label={$t('Table du déclencheur')}
          />
        )}
        {kind === 'record_updated' && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs text-muted-foreground">
              {$t('Surveiller seulement ces champs (aucun coché : tout changement).')}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {sourceFields
                .filter((f) => f.kind !== 'button')
                .map((f) => (
                  <label
                    key={f.name}
                    htmlFor={`watch-${f.name}`}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      id={`watch-${f.name}`}
                      checked={draft.trigger.fields.includes(f.name)}
                      onCheckedChange={(v) =>
                        setTrigger({
                          fields:
                            v === true
                              ? [...draft.trigger.fields, f.name]
                              : draft.trigger.fields.filter((n) => n !== f.name),
                        })
                      }
                    />
                    {f.label}
                  </label>
                ))}
            </div>
          </div>
        )}
        {kind === 'record_deleted' && (
          <p className="text-xs text-muted-foreground">
            {$t(
              'Les étapes citent la ligne telle qu’elle était avant d’être supprimée ; elles ne peuvent plus la modifier, la supprimer ni en faire un PDF. Si son propriétaire ne lit cette table qu’à travers une règle de lignes, l’exécution est écartée.',
            )}
          </p>
        )}
        {kind === 'schedule' && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Choice
              value={draft.trigger.schedule.every}
              onValueChange={(v) => setSchedule({ every: v as 'hour' | 'day' | 'week' })}
              options={[
                { value: 'hour', label: $t('Toutes les heures') },
                { value: 'day', label: $t('Chaque jour') },
                { value: 'week', label: $t('Chaque semaine') },
              ]}
              aria-label={$t('Fréquence')}
            />
            {draft.trigger.schedule.every === 'week' ? (
              <Choice
                value={String(draft.trigger.schedule.weekday)}
                onValueChange={(v) => setSchedule({ weekday: Number(v) })}
                options={WEEKDAYS.map((d, i) => ({
                  value: String(i + 1),
                  label: $t('le {day}', { day: d }),
                }))}
                aria-label={$t('Jour')}
              />
            ) : (
              <span />
            )}
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">
                {draft.trigger.schedule.every === 'hour' ? $t('À la minute') : 'À'}
              </span>
              <Input
                type="time"
                value={draft.trigger.schedule.at}
                onChange={(e) => setSchedule({ at: e.target.value })}
                aria-label={$t('Heure')}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">{$t('Fuseau')}</span>
              <Input
                value={draft.trigger.schedule.timezone}
                onChange={(e) => setSchedule({ timezone: e.target.value })}
                aria-label={$t('Fuseau horaire')}
                className="h-8"
              />
            </div>
          </div>
        )}
        {kind === 'schedule' &&
          automation?.next_run_at !== null &&
          automation?.next_run_at !== undefined && (
            <p className="text-xs text-muted-foreground">
              {$t('Prochaine exécution : {value}', {
                value: new Date(automation.next_run_at).toLocaleString(intlLocale()),
              })}
            </p>
          )}
        {kind === 'schedule' && (
          <p className="text-xs text-muted-foreground">
            {$t(
              'Une horloge n’a pas de ligne : pour agir sur des lignes, commencez par « Chercher une ligne » ou « Pour chaque ligne ».',
            )}
          </p>
        )}
      </Section>

      {kind === 'date_reached' && (
        <Section
          title={$t('La date')}
          hint={$t(
            'Seules les dates atteintes après l’enregistrement — ou la réactivation — font partir l’automatisation : une date déjà passée, non.',
          )}
        >
          <FieldSelect
            fields={dateFieldsOf(base, draft.trigger.table)}
            value={draft.trigger.date.field}
            onChange={(field) => setDate({ field })}
            placeholder={$t('Choisir un champ date')}
            label={$t('Champ date du déclencheur')}
          />
          <OffsetInput
            value={draft.trigger.date.offsetDays}
            onChange={(offsetDays) => setDate({ offsetDays })}
            label={$t('Jours de décalage')}
          />
          <TimeAndZone
            at={draft.trigger.date.at}
            timezone={draft.trigger.date.timezone}
            datetime={
              sourceFields.find((f) => f.name === draft.trigger.date.field)?.kind === 'datetime'
            }
            onChange={setDate}
          />
        </Section>
      )}

      {kind === 'webhook' && (
        <WebhookAddress automation={automation} onRegenerate={onRegenerateHook} />
      )}

      {kind === 'record_matches' && (
        <Section
          title={$t('La condition où la ligne entre')}
          hint={$t(
            'Requise. L’automatisation part quand une ligne créée ou modifiée se met à la remplir — une fois : pour repartir, la ligne doit d’abord avoir cessé de la remplir.',
          )}
        >
          <FilterInput
            value={draft.condition}
            onChange={(condition) => onChange({ condition })}
            fields={filterFieldsOf(base, draft.trigger.table)}
            groups={citeGroups(draft, base, [])}
            label={$t('Condition')}
            placeholder={$t('statut eq "a_relancer"')}
          />
        </Section>
      )}

      {withTable && kind !== 'record_matches' && (
        <Section
          title={$t('Seulement si')}
          hint={$t(
            'Facultatif — évalué sur la ligne au moment d’agir. Non rempli : l’exécution est écartée, et le dit.',
          )}
        >
          <FilterInput
            value={draft.condition}
            onChange={(condition) => onChange({ condition })}
            fields={filterFieldsOf(base, draft.trigger.table)}
            groups={citeGroups(draft, base, [])}
            label={$t('Condition')}
            placeholder={$t('statut eq "fait"')}
          />
        </Section>
      )}

      {problem !== null && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlert className="size-3.5 shrink-0" />
          {problem}
        </p>
      )}

      <Section title={$t('Description')}>
        <Textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={$t('À quoi sert-elle ? (facultatif)')}
          aria-label={$t('Description de l’automatisation')}
          rows={2}
          className="min-h-0 resize-none text-sm"
        />
        {automation !== null && (
          <p className="text-xs text-muted-foreground">
            {$t(
              'Agit avec les droits de {name}, qui l’a enregistrée en dernier. L’enregistrer vous en rend propriétaire.',
              { name: automation.owner.name },
            )}
          </p>
        )}
      </Section>
    </div>
  )
}

/** A time of day and its time zone — the time ignored for a date that carries its own. */
function TimeAndZone({
  at,
  timezone,
  datetime,
  onChange,
}: {
  readonly at: string
  readonly timezone: string
  /** The date read carries its time: the time typed here does not count. */
  readonly datetime: boolean
  readonly onChange: (patch: { at?: string; timezone?: string }) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">{$t('À||heure du jour')}</span>
          <Input
            type="time"
            value={at}
            disabled={datetime}
            onChange={(e) => onChange({ at: e.target.value })}
            aria-label={$t('Heure')}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">{$t('Fuseau')}</span>
          <Input
            value={timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            aria-label={$t('Fuseau horaire')}
            className="h-8"
          />
        </div>
      </div>
      {datetime && (
        <p className="text-xs text-muted-foreground">
          {$t('Une date et heure arrive à son heure à elle : l’heure ci-dessus ne sert pas.')}
        </p>
      )}
    </div>
  )
}

/**
 * Where an external program calls a `webhook` automation: its address, to copy; a new one
 * when the old has leaked; how to call it, and how the steps cite what it sent.
 */
function WebhookAddress({
  automation,
  onRegenerate,
}: {
  readonly automation: Automation | null
  readonly onRegenerate: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState<'url' | 'curl' | null>(null)
  const hook = automation?.trigger.kind === 'webhook' ? (automation.hook ?? null) : null
  const copyText = async (what: 'url' | 'curl', text: string) => {
    if (!(await copy(text))) return
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }
  const explained = (
    <Note>
      {$t(
        'Les étapes citent ce qui a été envoyé : {{trigger.montant}}, {{trigger.client.nom}} — une clé d’un JSON ou d’un formulaire, à n’importe quelle profondeur ; {{trigger.texte}} pour un texte simple.',
      )}
    </Note>
  )
  if (hook === null) {
    return (
      <Section title={$t('L’adresse à appeler')}>
        <p className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          {automation === null || automation.trigger.kind !== 'webhook'
            ? $t('Enregistrez l’automatisation : son adresse apparaîtra ici.')
            : $t('Son adresse n’est montrée qu’à qui construit la base.')}
        </p>
        {explained}
      </Section>
    )
  }
  const url = hookUrl(hook.path)
  const slash = String.fromCharCode(92)
  const curl = [
    `curl -X POST '${url}' ${slash}`,
    `  -H 'Content-Type: application/json' ${slash}`,
    `  -d '{"client": {"nom": "Dupont"}, "montant": 120}'`,
  ].join('\n')
  return (
    <Section
      title={$t('L’adresse à appeler')}
      hint={$t('Gardez-la pour vous : qui la connaît peut lancer l’automatisation.')}
    >
      <div className="flex items-center gap-1.5">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label={$t('Adresse du webhook entrant')}
          className="h-8 min-w-0 flex-1 font-mono text-xs"
        />
        <Hint label={copied === 'url' ? $t('Copiée') : $t('Copier l’adresse')}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={$t('Copier l’adresse')}
            onClick={() => void copyText('url', url)}
          >
            {copied === 'url' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </Hint>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => setConfirming(true)}
        >
          <RefreshCw className="size-3.5" />
          {$t('Changer d’adresse')}
        </Button>
        {!automation?.enabled && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {$t('Désactivée : elle répond 404.')}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {$t(
          'Une requête POST — un JSON, un formulaire ou un texte, 64 Kio au plus — lance l’automatisation et reçoit 202. Une adresse inconnue répond 404 ; au-delà du débit horaire, 429.',
        )}
      </p>
      <div className="relative">
        <pre className="scroll-discret overflow-x-auto rounded-md border bg-muted/50 p-2.5 pr-9 font-mono text-[11px] leading-relaxed">
          {curl}
        </pre>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-1 right-1 bg-background/90"
          aria-label={$t('Copier l’exemple')}
          onClick={() => void copyText('curl', curl)}
        >
          {copied === 'curl' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      {explained}
      <ConfirmDialog
        open={confirming}
        title={$t('Changer l’adresse du webhook ?')}
        body={$t(
          'L’adresse actuelle cessera aussitôt de répondre : les programmes qui l’appellent devront recevoir la nouvelle.',
        )}
        action={$t('Changer l’adresse')}
        destructive
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await onRegenerate()
          setConfirming(false)
        }}
      />
    </Section>
  )
}

// ── A step ──────────────────────────────────────────────────────────────────

export function StepSettings({
  step,
  draft,
  base,
  members,
  automation,
  automations,
  onChange,
  onSelect,
  onInsertAfter,
}: {
  readonly step: DraftStep
  readonly draft: Draft
  readonly base: DescribedBase
  readonly members: readonly Member[]
  /** The automation edited — not one a step may start. */
  readonly automation: Automation | null
  /** The automations of the base; `null` while read. */
  readonly automations: readonly Automation[] | null
  readonly onChange: (next: DraftStep) => void
  readonly onSelect: (id: string) => void
  /** Adds right after this step one made for it, and opens it — or what `open` names. */
  readonly onInsertAfter: (
    make: (id: string) => DraftStep,
    open?: (step: DraftStep) => string,
  ) => void
}) {
  const before = stepsBefore(draft.steps, step.id) ?? []
  const around = loopsAround(draft.steps, step.id)
  const groups = citeGroups(draft, base, before, around)
  const rows = rowChoices(draft, base, before, around)
  // A row deleted is cited, never changed.
  const changeable = changeableRows(draft, rows)

  switch (step.kind) {
    case 'update_record': {
      const table = rowTableOf(draft, step.record)
      return (
        <div className="space-y-5">
          {changeable.length === 0 ? (
            <Warning>{$t('Aucune ligne à modifier ici : cherchez-en une d’abord.')}</Warning>
          ) : (
            <RowSelect
              choices={changeable}
              value={step.record}
              onChange={(record) =>
                onChange({ ...step, record, values: [{ field: '', value: '' }] })
              }
              label={$t('La ligne à modifier')}
            />
          )}
          <Section title={$t('Écrire')}>
            <ValueRows
              rows={step.values}
              targetFields={fieldsOfTable(base, table)}
              groups={groups}
              onChange={(values) => onChange({ ...step, values })}
            />
          </Section>
          <CitationHint />
        </div>
      )
    }
    case 'create_record':
      return (
        <div className="space-y-5">
          <TableSelect
            base={base}
            value={step.table}
            onChange={(table) => onChange({ ...step, table, values: [{ field: '', value: '' }] })}
            label={$t('Table où créer')}
          />
          <Section title={$t('Écrire')}>
            <ValueRows
              rows={step.values}
              targetFields={fieldsOfTable(base, step.table)}
              groups={groups}
              onChange={(values) => onChange({ ...step, values })}
            />
          </Section>
          <CitationHint />
          <OutputHint step={step} />
        </div>
      )
    case 'find_record': {
      const fields = fieldsOfTable(base, step.table)
      const descending = step.sort.startsWith('-')
      const sortField = step.sort.replace(/^-/, '')
      return (
        <div className="space-y-5">
          <TableSelect
            base={base}
            value={step.table}
            onChange={(table) => onChange({ ...step, table, filter: '', sort: '' })}
            label={$t('Table où chercher')}
          />
          <Section
            title={$t('La ligne qui')}
            hint={$t('Dans le langage des filtres ; vide : n’importe quelle ligne.')}
          >
            <FilterInput
              value={step.filter}
              onChange={(filter) => onChange({ ...step, filter })}
              fields={filterFieldsOf(base, step.table)}
              groups={groups}
              label={$t('Filtre de la recherche')}
              placeholder="email eq {{email}}"
            />
          </Section>
          <Section title={$t('Si plusieurs répondent, la première par')}>
            <div className="flex gap-1.5">
              <FieldSelect
                fields={fields.filter((f) => f.kind !== 'button')}
                value={sortField}
                onChange={(name) =>
                  onChange({ ...step, sort: name === '' ? '' : `${descending ? '-' : ''}${name}` })
                }
                placeholder={$t('Ordre de création')}
                label={$t('Trier par')}
                className="flex-1"
              />
              <Choice
                value={descending ? 'desc' : 'asc'}
                onValueChange={(v) =>
                  sortField !== '' &&
                  onChange({ ...step, sort: `${v === 'desc' ? '-' : ''}${sortField}` })
                }
                options={[
                  { value: 'asc', label: $t('croissant') },
                  { value: 'desc', label: $t('décroissant') },
                ]}
                aria-label={$t('Sens du tri')}
                className="w-32"
                disabled={sortField === ''}
              />
            </div>
          </Section>
          <OutputHint step={step} />
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-1.5"
              onClick={() =>
                onInsertAfter(
                  (id) => notFoundBranch(draft, step.id, id),
                  (branch) =>
                    branch.kind === 'branch' ? (branch.paths[0]?.id ?? branch.id) : branch.id,
                )
              }
            >
              <Split className="size-4" />
              {$t('Si aucune ligne n’est trouvée…')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {$t(
                'Ajoute juste après une condition : un chemin quand rien n’est trouvé, l’autre avec la ligne trouvée.',
              )}
            </p>
          </div>
        </div>
      )
    }
    case 'delete_record': {
      const chosen = changeable.find((r) => r.value === step.record)
      return (
        <div className="space-y-5">
          {changeable.length === 0 ? (
            <Warning>{$t('Aucune ligne à supprimer ici : cherchez-en une d’abord.')}</Warning>
          ) : (
            <RowSelect
              choices={changeable}
              value={step.record}
              onChange={(record) => onChange({ ...step, record })}
              label={$t('La ligne à supprimer')}
            />
          )}
          {chosen !== undefined && (
            <Note>
              {$t(
                '« {row} » part à la corbeille, comme toute suppression : elle peut en être restaurée.',
                { row: chosen.label },
              )}
            </Note>
          )}
        </div>
      )
    }
    case 'aggregate':
      return <AggregateSettings step={step} base={base} groups={groups} onChange={onChange} />
    case 'notify': {
      const people = members.filter((m) => !m.disabled)
      const table = step.record === '' ? null : rowTableOf(draft, step.record)
      return (
        <div className="space-y-5">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {$t('Une notification ouvre une ligne : à heure fixe, cherchez-en une d’abord.')}
            </p>
          ) : (
            <RowSelect
              choices={rows}
              value={step.record}
              onChange={(record) => onChange({ ...step, record, userField: '' })}
              label={$t('À propos de la ligne')}
            />
          )}
          <Section title={$t('Qui prévenir')}>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {people.map((m) => (
                <label
                  key={m.id}
                  htmlFor={`notify-${step.id}-${m.id}`}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <Checkbox
                    id={`notify-${step.id}-${m.id}`}
                    checked={step.users.includes(m.id)}
                    onCheckedChange={(v) =>
                      onChange({
                        ...step,
                        users:
                          v === true ? [...step.users, m.id] : step.users.filter((u) => u !== m.id),
                      })
                    }
                  />
                  {m.display_name || m.email}
                </label>
              ))}
            </div>
            {table !== null && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {$t('et la personne du champ')}
                </span>
                <FieldSelect
                  fields={fieldsOfTable(base, table).filter((f) => f.kind === 'user')}
                  value={step.userField}
                  onChange={(userField) => onChange({ ...step, userField })}
                  placeholder={$t('Aucun champ')}
                  label={$t('Champ personne à prévenir')}
                />
              </div>
            )}
          </Section>
          <Section title={$t('Message')}>
            <MessageInput
              value={step.message}
              onChange={(message) => onChange({ ...step, message })}
              groups={groups}
              label={$t('Message')}
              placeholder="{{nom}} est terminée"
            />
          </Section>
        </div>
      )
    }
    case 'email':
      return (
        <EmailSettings
          step={step}
          draft={draft}
          base={base}
          members={members}
          before={before}
          rows={rows}
          groups={groups}
          onChange={onChange}
        />
      )
    case 'webhook':
      return <WebhookSettings step={step} rows={rows} groups={groups} onChange={onChange} />
    case 'for_each':
      return <LoopSettings step={step} base={base} groups={groups} onChange={onChange} />
    case 'slack':
      return <SlackSettings base={base} step={step} groups={groups} onChange={onChange} />
    case 'ai':
      return <AiSettings base={base} step={step} groups={groups} onChange={onChange} />
    case 'document':
      return (
        <DocumentSettings
          step={step}
          draft={draft}
          base={base}
          rows={changeable}
          groups={groups}
          onChange={onChange}
        />
      )
    case 'run_automation':
      return (
        <RunAutomationSettings
          step={step}
          base={base}
          automation={automation}
          automations={automations}
          rows={rows}
          onChange={onChange}
        />
      )
    case 'wait':
      return (
        <WaitSettings step={step} draft={draft} base={base} rows={changeable} onChange={onChange} />
      )
    case 'branch':
      return <BranchSettings step={step} draft={draft} onChange={onChange} onSelect={onSelect} />
    case 'attempt':
      return <AttemptSettings step={step} onSelect={onSelect} />
  }
}

/**
 * « Demander à l’IA » : a prompt citing what came before, as an AI field's cites its row —
 * chapter 17 §1.3, chapter 12 §1.5 —, the answer expected, and the consent that what it
 * cites leaves for the provider, given again whenever the prompt changes.
 */
function AiSettings({
  base,
  step,
  groups,
  onChange,
}: {
  readonly base: DescribedBase
  readonly step: Extract<DraftStep, { kind: 'ai' }>
  readonly groups: readonly CiteGroup[]
  readonly onChange: (next: DraftStep) => void
}) {
  // The lists a choice may be taken from: every choice field of the base.
  const lists = base.tables.flatMap((t) =>
    t.fields
      .filter((f) => f.kind === 'select' && (f.options?.length ?? 0) > 0)
      .map((f) => ({ key: `${t.name}.${f.name}`, label: `${t.label} › ${f.label}`, field: f })),
  )
  return (
    <div className="space-y-5">
      <Section
        title={$t('Consigne')}
        hint={$t(
          'Chaque citation est remplacée par sa valeur au moment d’agir ; une valeur vide se lit « (vide) ».',
        )}
      >
        <CitingText
          value={step.prompt}
          onChange={(prompt) => onChange({ ...step, prompt, consent: false })}
          groups={groups}
          label={$t('Consigne de l’IA')}
          placeholder={$t('Résume {{notes}} en une phrase, sur un ton neutre.')}
          multiline
          className="font-mono text-[13px] leading-relaxed"
        />
      </Section>
      <Section title={$t('Réponse attendue')}>
        <Choice
          value={step.answer}
          onValueChange={(v) => onChange({ ...step, answer: v as typeof step.answer })}
          options={AI_ANSWERS}
          aria-label={$t('Réponse attendue')}
        />
        {step.answer !== 'long_text' && step.answer !== 'short_text' && (
          <p className="text-xs text-muted-foreground">
            {$t(
              'Le modèle en est averti ; une réponse qui n’en contient pas fait échouer l’étape.',
            )}
          </p>
        )}
        {step.answer === 'select' && (
          <div className="space-y-1.5">
            <Textarea
              value={step.options.join('\n')}
              onChange={(e) => onChange({ ...step, options: e.target.value.split('\n') })}
              placeholder={$t('Urgent\nNormal\nPlus tard')}
              aria-label={$t('Choix proposés, un par ligne')}
              rows={4}
              className="min-h-0 resize-none text-sm"
            />
            {lists.length > 0 && (
              <Choice
                value={null}
                onValueChange={(key) => {
                  const list = lists.find((l) => l.key === key)
                  if (list !== undefined)
                    onChange({ ...step, options: (list.field.options ?? []).map((o) => o.label) })
                }}
                options={lists.map((l) => ({ value: l.key, label: l.label }))}
                placeholder={$t('Reprendre les choix d’un champ…')}
                aria-label={$t('Reprendre les choix d’un champ')}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {$t(
                'Un choix par ligne. Écrite dans un champ Choix, la réponse y est rangée au choix de même libellé.',
              )}
            </p>
          </div>
        )}
      </Section>
      <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
        <Checkbox
          id={`ai-consent-${step.id}`}
          checked={step.consent}
          onCheckedChange={(next) => onChange({ ...step, consent: next === true })}
          className="mt-0.5"
        />
        <label htmlFor={`ai-consent-${step.id}`} className="cursor-pointer leading-snug">
          {$t(
            'J’accepte qu’à chaque exécution, ce que cite cette consigne soit envoyé au fournisseur d’IA configuré sur cette instance.',
          )}
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {$t(
              'Un appel par exécution, journalisé et plafonné par heure avec les champs IA. À redonner quand la consigne change.',
            )}
          </span>
        </label>
      </div>
      <OutputHint step={step} />
    </div>
  )
}

/** What a composed body looks like, by format. */
const BODY_PLACEHOLDERS: Readonly<Record<Exclude<DraftBody, 'standard'>, string>> = {
  json: '{\n  "titre": "{{nom}}",\n  "montant": {{montant}}\n}',
  form: 'titre={{nom}}\nmontant={{montant}}',
  text: '{{nom}} : {{montant}}',
}

/**
 * « Appeler un webhook » : a request to a service — chapter 17 §1.3. Its method; its
 * address, which may cite after its host; its headers, a secret one sealed and never shown
 * again; what it sends: the automation's own JSON, or a body composed in JSON, as a form,
 * or as text, citing what came before; and how many times it is tried again.
 */
function WebhookSettings({
  step,
  rows,
  groups,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'webhook' }>
  readonly rows: readonly RowChoice[]
  readonly groups: readonly CiteGroup[]
  readonly onChange: (next: DraftStep) => void
}) {
  const setHeader = (index: number, patch: Partial<DraftHeader>) =>
    onChange({
      ...step,
      headers: step.headers.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    })
  const issue = step.body === 'json' ? jsonBodyIssue(step.template) : null
  const BODY_HINTS: Readonly<Record<Exclude<DraftBody, 'standard'>, string>> = {
    json: $t(
      'Entre guillemets, une citation est du texte ; hors guillemets, une valeur : un nombre, oui ou non, une liste.',
    ),
    form: $t('Une paire clé=valeur par ligne, envoyée encodée comme un formulaire web.'),
    text: $t('Envoyé tel quel, chaque citation remplacée par sa valeur.'),
  }
  return (
    <div className="space-y-5">
      <Section title={$t('Adresse')}>
        <div className="flex items-center gap-1.5">
          <Choice
            value={step.method}
            onValueChange={(v) => onChange({ ...step, method: v as AutomationHttpMethod })}
            options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
            aria-label={$t('Méthode HTTP')}
            className="w-28 shrink-0 font-mono"
          />
          <div className="min-w-0 flex-1">
            <CitingText
              value={step.url}
              onChange={(url) => onChange({ ...step, url })}
              groups={groups}
              label={$t('Adresse du webhook')}
              placeholder="https://api.exemple.fr/clients/{{e2.numero}}"
              className="font-mono text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {$t(
            'L’adresse peut citer après son hôte, chaque valeur encodée. Adresse https publique seulement ; 10 secondes au plus ; une réponse autre que 2xx fait échouer l’étape.',
          )}
        </p>
      </Section>
      <Section
        title={$t('En-têtes')}
        hint={$t(
          'Une clé d’API, un jeton : laissez-le secret. Chiffré, il n’est plus jamais affiché, et ne part que vers l’hôte pour lequel vous l’avez donné.',
        )}
      >
        {step.headers.map((header, index) => (
          <HeaderRow
            // biome-ignore lint/suspicious/noArrayIndexKey: headers have no identity of their own
            key={index}
            header={header}
            index={index}
            groups={groups}
            onChange={(patch) => setHeader(index, patch)}
            onRemove={() =>
              onChange({ ...step, headers: step.headers.filter((_, i) => i !== index) })
            }
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={step.headers.length >= 20}
          onClick={() =>
            onChange({
              ...step,
              headers: [
                ...step.headers,
                { name: '', value: '', secret: true, kept: false, host: '' },
              ],
            })
          }
        >
          <Plus className="size-3.5" />
          {$t('En-tête||en-tête HTTP')}
        </Button>
      </Section>
      {hasBody(step.method) ? (
        <Section title={$t('Corps')}>
          <Choice
            value={step.body}
            onValueChange={(v) => onChange({ ...step, body: v as DraftBody })}
            options={[
              { value: 'standard', label: $t('Les données de l’automatisation, en JSON') },
              { value: 'json', label: $t('Un JSON à composer') },
              { value: 'form', label: $t('Un formulaire, clé=valeur') },
              { value: 'text', label: $t('Un texte') },
            ]}
            aria-label={$t('Corps de la requête')}
          />
          {step.body === 'standard' ? (
            <>
              <RowSelect
                choices={rows}
                value={step.record}
                onChange={(record) => onChange({ ...step, record })}
                label={$t('La ligne envoyée')}
                none={$t('Aucune ligne')}
              />
              <p className="text-xs text-muted-foreground">
                {$t(
                  'L’automatisation, le déclencheur, la ligne, et ce que les étapes précédentes ont trouvé ou écrit.',
                )}
              </p>
            </>
          ) : (
            <div className="space-y-1">
              <CitingText
                value={step.template}
                onChange={(template) => onChange({ ...step, template })}
                groups={groups}
                label={$t('Corps de la requête')}
                placeholder={BODY_PLACEHOLDERS[step.body]}
                multiline
                rows={6}
                invalid={issue !== null}
                className="font-mono text-[13px] leading-relaxed"
              />
              {issue !== null && <Warning>{issue}</Warning>}
              <p className="text-xs text-muted-foreground">{BODY_HINTS[step.body]}</p>
            </div>
          )}
        </Section>
      ) : (
        <p className="text-xs text-muted-foreground">
          {$t('Une requête {method} n’envoie pas de corps.', { method: step.method })}
        </p>
      )}
      <Section
        title={$t('Si le service ne répond pas')}
        hint={$t(
          'Une erreur réseau, une réponse 429 ou 5xx : un nouvel essai après 2, puis 5, puis 10 secondes, dans le temps de l’exécution.',
        )}
      >
        <Choice
          value={String(step.retries)}
          onValueChange={(v) => onChange({ ...step, retries: Number(v) })}
          options={Array.from({ length: MAX_RETRIES + 1 }, (_, n) => ({
            value: String(n),
            label:
              n === 0
                ? $t('Ne pas réessayer')
                : $tp(n, 'Réessayer {count} fois', 'Réessayer {count} fois'),
          }))}
          aria-label={$t('Nouvelles tentatives')}
        />
      </Section>
      <OutputHint step={step} />
    </div>
  )
}

/**
 * A header: its name, and its value — typed, citing what came before, or secret: typed
 * once, then shown only as kept, to be replaced rather than read.
 */
function HeaderRow({
  header,
  index,
  groups,
  onChange,
  onRemove,
}: {
  readonly header: DraftHeader
  readonly index: number
  readonly groups: readonly CiteGroup[]
  readonly onChange: (patch: Partial<DraftHeader>) => void
  readonly onRemove: () => void
}) {
  const n = index + 1
  return (
    <div className="space-y-1 rounded-md border p-2">
      <div className="flex items-center gap-1.5">
        <Input
          value={header.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Authorization"
          aria-label={$t('Nom de l’en-tête {n}', { n })}
          className="h-8 flex-1 font-mono text-sm"
        />
        <Hint
          label={
            header.secret
              ? $t('Secret : chiffré, jamais réaffiché')
              : $t('En clair : visible, peut citer une valeur')
          }
        >
          <Button
            variant={header.secret ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-pressed={header.secret}
            aria-label={$t('Valeur secrète de l’en-tête {n}', { n })}
            onClick={() =>
              onChange(
                header.secret
                  ? { secret: false, kept: false, value: header.kept ? '' : header.value }
                  : { secret: true },
              )
            }
          >
            {header.secret ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
          </Button>
        </Hint>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={$t('Retirer l’en-tête {n}', { n })}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {header.kept ? (
        <div className="flex items-center gap-1.5">
          <span className="flex h-8 min-w-0 flex-1 items-center truncate rounded-md border border-dashed px-2.5 text-xs text-muted-foreground">
            {header.host === ''
              ? $t('Secret enregistré')
              : $t('Secret enregistré, pour {host}', { host: header.host })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onChange({ kept: false, value: '' })}
          >
            {$t('Remplacer')}
          </Button>
        </div>
      ) : header.secret ? (
        <Input
          type="password"
          autoComplete="off"
          value={header.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={$t('Valeur secrète')}
          aria-label={$t('Valeur de l’en-tête {n}', { n })}
          className="h-8 font-mono text-sm"
        />
      ) : (
        <CitingText
          value={header.value}
          onChange={(value) => onChange({ value })}
          groups={groups}
          label={$t('Valeur de l’en-tête {n}', { n })}
          placeholder={$t('Valeur, ou {{champ}}')}
          className="font-mono text-sm"
        />
      )}
    </div>
  )
}

/**
 * « Pour chaque ligne » : the rows of a table that answer a filter — which may cite what
 * came before —, in an order, up to a limit; the steps inside run once for each, and cite
 * the row of the turn by the loop's identifier. A row whose step fails stops the run, or
 * is passed.
 */
function LoopSettings({
  step,
  base,
  groups,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'for_each' }>
  readonly base: DescribedBase
  readonly groups: readonly CiteGroup[]
  readonly onChange: (next: DraftStep) => void
}) {
  const fields = fieldsOfTable(base, step.table)
  const descending = step.sort.startsWith('-')
  const sortField = step.sort.replace(/^-/, '')
  return (
    <div className="space-y-5">
      <TableSelect
        base={base}
        value={step.table}
        onChange={(table) => onChange({ ...step, table, filter: '', sort: '' })}
        label={$t('Table à parcourir')}
      />
      <Section
        title={$t('Les lignes qui')}
        hint={$t('Dans le langage des filtres ; vide : toutes les lignes.')}
      >
        <FilterInput
          value={step.filter}
          onChange={(filter) => onChange({ ...step, filter })}
          fields={filterFieldsOf(base, step.table)}
          groups={groups}
          label={$t('Filtre de la boucle')}
          placeholder="payee eq false and relancee eq false"
        />
      </Section>
      <Section title={$t('Dans l’ordre de')}>
        <div className="flex gap-1.5">
          <FieldSelect
            fields={fields.filter((f) => f.kind !== 'button')}
            value={sortField}
            onChange={(name) =>
              onChange({ ...step, sort: name === '' ? '' : `${descending ? '-' : ''}${name}` })
            }
            placeholder={$t('Ordre de création')}
            label={$t('Trier par')}
            className="flex-1"
          />
          <Choice
            value={descending ? 'desc' : 'asc'}
            onValueChange={(v) =>
              sortField !== '' &&
              onChange({ ...step, sort: `${v === 'desc' ? '-' : ''}${sortField}` })
            }
            options={[
              { value: 'asc', label: $t('croissant') },
              { value: 'desc', label: $t('décroissant') },
            ]}
            aria-label={$t('Sens du tri')}
            className="w-32"
            disabled={sortField === ''}
          />
        </div>
      </Section>
      <Section
        title={$t('Au plus')}
        hint={$t(
          'De 1 à {max} lignes par exécution. Pour traiter les suivantes à la prochaine, faites sortir du filtre celles qui sont traitées — une case « relancée », une date.',
          { max: MAX_LOOP_ROWS },
        )}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={MAX_LOOP_ROWS}
            value={Number.isFinite(step.limit) ? step.limit : ''}
            onChange={(e) => onChange({ ...step, limit: e.target.valueAsNumber })}
            aria-label={$t('Nombre de lignes au plus')}
            className="h-8 w-24"
          />
          <span className="text-sm text-muted-foreground">
            {$tp(Number.isFinite(step.limit) ? step.limit : 0, 'ligne', 'lignes')}
          </span>
        </div>
      </Section>
      <Section title={$t('Si une étape échoue sur une ligne')}>
        <Choice
          value={step.onError}
          onValueChange={(v) => onChange({ ...step, onError: v as 'stop' | 'continue' })}
          options={[
            { value: 'stop', label: $t('Arrêter l’exécution') },
            { value: 'continue', label: $t('Passer à la ligne suivante') },
          ]}
          aria-label={$t('Si une étape échoue sur une ligne')}
        />
      </Section>
      <OutputHint step={step} />
    </div>
  )
}

/**
 * « Compter et additionner » : the rows of a table a filter keeps — which may cite —,
 * counted, and up to five measures of their fields: a sum, an average, a minimum, a
 * maximum, which the steps after cite.
 */
function AggregateSettings({
  step,
  base,
  groups,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'aggregate' }>
  readonly base: DescribedBase
  readonly groups: readonly CiteGroup[]
  readonly onChange: (next: DraftStep) => void
}) {
  const fields = fieldsOfTable(base, step.table)
  const setMeasure = (index: number, patch: Partial<DraftMeasure>) =>
    onChange({
      ...step,
      measures: step.measures.map((m, i) => {
        if (i !== index) return m
        const next = { ...m, ...patch }
        // A sum of a date makes no sense: the field is chosen again.
        return measurableFields(fields, next.fn).some((f) => f.name === next.field)
          ? next
          : { ...next, field: '' }
      }),
    })
  return (
    <div className="space-y-5">
      <TableSelect
        base={base}
        value={step.table}
        onChange={(table) => onChange({ ...step, table, filter: '', measures: [] })}
        label={$t('Table où compter')}
      />
      <Section
        title={$t('Les lignes qui')}
        hint={$t('Dans le langage des filtres ; vide : toutes les lignes.')}
      >
        <FilterInput
          value={step.filter}
          onChange={(filter) => onChange({ ...step, filter })}
          fields={filterFieldsOf(base, step.table)}
          groups={groups}
          label={$t('Filtre des lignes comptées')}
          placeholder="client eq {{_id}} and payee eq false"
        />
      </Section>
      <Section
        title={$t('Mesures')}
        hint={$t(
          'Leur nombre est toujours compté. Jusqu’à {max} mesures : la somme ou la moyenne d’un nombre, le minimum ou le maximum d’un nombre ou d’une date.',
          { max: MAX_MEASURES },
        )}
      >
        {step.measures.map((m, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: measures have no identity of their own
            key={index}
            className="flex items-center gap-1.5"
          >
            <Choice
              value={m.fn}
              onValueChange={(fn) => setMeasure(index, { fn: fn as DraftMeasure['fn'] })}
              options={MEASURE_FNS.map((f) => ({ value: f.value, label: f.label }))}
              aria-label={$t('Mesure {n}', { n: index + 1 })}
              className="w-32 shrink-0"
            />
            <FieldSelect
              fields={measurableFields(fields, m.fn)}
              value={m.field}
              onChange={(field) => setMeasure(index, { field })}
              label={$t('Champ de la mesure {n}', { n: index + 1 })}
              className="min-w-0 flex-1"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                onChange({ ...step, measures: step.measures.filter((_, i) => i !== index) })
              }
              aria-label={$t('Retirer la mesure {n}', { n: index + 1 })}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={step.measures.length >= MAX_MEASURES}
          onClick={() =>
            onChange({ ...step, measures: [...step.measures, { fn: 'sum', field: '' }] })
          }
        >
          <Plus className="size-3.5" />
          {$t('Mesure')}
        </Button>
      </Section>
      <OutputHint step={step} />
    </div>
  )
}

/**
 * « Générer un PDF » : a row, a document template of its table — or the sheet of every
 * field —, the file's name, and a file field it may be added to; a later mail attaches it.
 */
function DocumentSettings({
  step,
  draft,
  base,
  rows,
  groups,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'document' }>
  readonly draft: Draft
  readonly base: DescribedBase
  readonly rows: readonly RowChoice[]
  readonly groups: readonly CiteGroup[]
  readonly onChange: (next: DraftStep) => void
}) {
  const table = step.record === '' ? null : rowTableOf(draft, step.record)
  const [templates, setTemplates] = useState<readonly DocumentTemplate[] | null>(null)
  useEffect(() => {
    if (table === null || table === '') {
      setTemplates([])
      return
    }
    let live = true
    setTemplates(null)
    api
      .documentTemplates({ base: base.name, name: table })
      .then((list) => live && setTemplates(list))
      .catch(() => live && setTemplates([]))
    return () => {
      live = false
    }
  }, [base.name, table])
  const lost =
    templates !== null && step.template !== '' && !templates.some((t) => t.id === step.template)
  return (
    <div className="space-y-5">
      {rows.length === 0 ? (
        <Warning>{$t('Aucune ligne dont faire un PDF ici : cherchez-en une d’abord.')}</Warning>
      ) : (
        <RowSelect
          choices={rows}
          value={step.record}
          onChange={(record) => onChange({ ...step, record, template: '', field: '' })}
          label={$t('La ligne dont faire le PDF')}
        />
      )}
      <Section title={$t('Modèle')}>
        <Choice
          value={templates === null && step.template !== '' ? null : step.template}
          onValueChange={(template) => onChange({ ...step, template })}
          options={[
            { value: '', label: $t('La fiche de la ligne : tous ses champs') },
            ...(templates ?? []).map((t) => ({ value: t.id, label: t.label })),
            ...(lost ? [{ value: step.template, label: $t('Un modèle supprimé') }] : []),
          ]}
          placeholder={$t('Lecture des modèles…')}
          aria-label={$t('Modèle de document')}
          disabled={templates === null}
        />
        {lost && <Warning>{$t('Ce modèle n’existe plus pour cette table.')}</Warning>}
      </Section>
      <Section
        title={$t('Nom du fichier')}
        hint={$t('Vide : le nom du modèle et celui de la ligne.')}
      >
        <CitingText
          value={step.name}
          onChange={(name) => onChange({ ...step, name })}
          groups={groups}
          label={$t('Nom du fichier PDF')}
          placeholder="Devis {{numero}}"
        />
      </Section>
      <Section title={$t('Ranger aussi dans')}>
        <FieldSelect
          fields={fieldsOfTable(base, table).filter((f) => f.kind === 'file')}
          value={step.field}
          onChange={(field) => onChange({ ...step, field })}
          placeholder={$t('Aucun champ : ne pas le ranger')}
          label={$t('Champ Document où ranger le PDF')}
        />
      </Section>
      <OutputHint step={step} />
    </div>
  )
}

/**
 * « Lancer une automatisation » : another of the base, started as if its trigger had
 * happened — on a row of its table when it has one.
 */
function RunAutomationSettings({
  step,
  base,
  automation,
  automations,
  rows,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'run_automation' }>
  readonly base: DescribedBase
  readonly automation: Automation | null
  readonly automations: readonly Automation[] | null
  readonly rows: readonly RowChoice[]
  readonly onChange: (next: DraftStep) => void
}) {
  const others = (automations ?? []).filter((a) => a.id !== automation?.id)
  const target = others.find((a) => a.id === step.automation) ?? null
  const tableOf = (a: Automation | null) =>
    a === null || a.trigger.table === null
      ? null
      : (base.tables.find((t) => t.id === a.trigger.table) ?? null)
  const table = tableOf(target)
  const matching = table === null ? [] : rows.filter((r) => r.table === table.name)
  return (
    <div className="space-y-5">
      <Section title={$t('L’automatisation à lancer')}>
        {automations === null ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : others.length === 0 ? (
          <Warning>{$t('Aucune autre automatisation dans cette base.')}</Warning>
        ) : (
          <Choice
            value={step.automation === '' ? null : step.automation}
            onValueChange={(id) => {
              const next = others.find((a) => a.id === id) ?? null
              const nextTable = tableOf(next)
              const candidates =
                nextTable === null ? [] : rows.filter((r) => r.table === nextTable.name)
              // A single row of its table at hand: that one.
              onChange({
                ...step,
                automation: id,
                record: candidates.length === 1 ? (candidates[0]?.value ?? '') : '',
              })
            }}
            options={others.map((a) => {
              const Icon = TRIGGER_ICONS[a.trigger.kind]
              return {
                value: a.id,
                label: a.label,
                render: (
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.label}</span>
                  </span>
                ),
              }
            })}
            placeholder={$t('Choisir une automatisation')}
            aria-label={$t('Automatisation à lancer')}
          />
        )}
        {step.automation !== '' && automations !== null && target === null && (
          <Warning>{$t('Cette automatisation n’existe plus.')}</Warning>
        )}
        {target !== null && (
          <p className="text-xs text-muted-foreground">
            {$t('Son déclencheur : {trigger}.', { trigger: TRIGGER_LABELS[target.trigger.kind] })}
          </p>
        )}
      </Section>
      {table !== null && (
        <Section
          title={$t('Sur la ligne')}
          hint={$t('Elle part sur une ligne de « {table} », la table de son déclencheur.', {
            table: table.label,
          })}
        >
          {matching.length === 0 ? (
            <Warning>
              {$t('Aucune ligne de « {table} » à lui donner ici : cherchez-en une d’abord.', {
                table: table.label,
              })}
            </Warning>
          ) : (
            <Choice
              value={step.record === '' ? null : step.record}
              onValueChange={(record) => onChange({ ...step, record })}
              options={matching.map((r) => ({ value: r.value, label: r.label }))}
              placeholder={$t('Choisir une ligne')}
              aria-label={$t('Ligne donnée à l’automatisation lancée')}
            />
          )}
        </Section>
      )}
      <Note>
        {$t(
          'Elle part comme si son déclencheur avait eu lieu, avec les droits de son propriétaire, et n’attend pas qu’elle finisse. Trois automatisations au plus se lancent ainsi l’une l’autre.',
        )}
      </Note>
    </div>
  )
}

const WAIT_UNITS: ReadonlyArray<{ readonly value: AutomationWaitUnit; readonly label: string }> = [
  { value: 'minutes', label: $t('minutes') },
  { value: 'hours', label: $t('heures') },
  { value: 'days', label: $t('jours') },
]

/**
 * « Attendre » : a pause of the run — for a duration, or until a date a row holds, moved
 * by days, at a time — after which it goes on from the next step.
 */
function WaitSettings({
  step,
  draft,
  base,
  rows,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'wait' }>
  readonly draft: Draft
  readonly base: DescribedBase
  readonly rows: readonly RowChoice[]
  readonly onChange: (next: DraftStep) => void
}) {
  const table = step.record === '' ? null : rowTableOf(draft, step.record)
  const dates = dateFieldsOf(base, table)
  return (
    <div className="space-y-5">
      <Segmented
        value={step.mode}
        options={[
          { value: 'duration', label: $t('Une durée') },
          { value: 'until', label: $t('Jusqu’à une date') },
        ]}
        onChange={(mode) => onChange({ ...step, mode })}
        label={$t('Attendre une durée, ou une date')}
      />
      {step.mode === 'duration' ? (
        <Section
          title={$t('Pendant')}
          hint={$t('De 1 minute à {max} jours.', { max: MAX_WAIT_DAYS })}
        >
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              value={Number.isFinite(step.amount) ? step.amount : ''}
              onChange={(e) => onChange({ ...step, amount: e.target.valueAsNumber })}
              aria-label={$t('Durée de l’attente')}
              className="h-8 w-24"
            />
            <Choice
              value={step.unit}
              onValueChange={(unit) => onChange({ ...step, unit: unit as AutomationWaitUnit })}
              options={WAIT_UNITS}
              aria-label={$t('Unité de la durée')}
              className="flex-1"
            />
          </div>
        </Section>
      ) : (
        <Section
          title={$t('Jusqu’à la date')}
          hint={$t('Une date déjà passée : l’exécution continue aussitôt.')}
        >
          {rows.length === 0 ? (
            <Warning>
              {$t('Aucune ligne dont attendre une date ici : cherchez-en une d’abord.')}
            </Warning>
          ) : (
            <RowSelect
              choices={rows}
              value={step.record}
              onChange={(record) => onChange({ ...step, record, field: '' })}
              label={$t('La ligne')}
            />
          )}
          <FieldSelect
            fields={dates}
            value={step.field}
            onChange={(field) => onChange({ ...step, field })}
            placeholder={$t('Choisir un champ date')}
            label={$t('Champ date à attendre')}
          />
          <OffsetInput
            value={step.offsetDays}
            onChange={(offsetDays) => onChange({ ...step, offsetDays })}
            label={$t('Jours de décalage')}
          />
          <TimeAndZone
            at={step.at}
            timezone={step.timezone}
            datetime={dates.find((f) => f.name === step.field)?.kind === 'datetime'}
            onChange={(patch) => onChange({ ...step, ...patch })}
          />
        </Section>
      )}
      <Note>
        {$t(
          'L’exécution reste en pause jusque-là, puis reprend à l’étape suivante ; les lignes qu’elle tient sont relues à ce moment. Pas d’attente dans une boucle ni dans « Essayer ».',
        )}
      </Note>
    </div>
  )
}

function CitationHint() {
  return (
    <p className="text-xs text-muted-foreground">
      {$t('Une valeur peut citer :')} <code>{'{{champ}}'}</code> {$t('pour la ligne déclencheuse,')}{' '}
      <code>{'{{e2.champ}}'}</code>{' '}
      {$t(
        'pour une étape précédente. Une citation seule passe la valeur telle quelle — une relation, une personne, un choix.',
      )}
    </p>
  )
}

/** What the steps after may cite of this one. */
function OutputHint({ step }: { readonly step: DraftStep }) {
  const text = (() => {
    switch (step.kind) {
      case 'ai':
        return $t(
          'Les étapes suivantes citent sa réponse, {{{id}.reponse}} : dans un message, dans une valeur à écrire — un nombre, oui ou non, une date, un choix passent tels quels dans un champ du même type.',
          { id: step.id },
        )
      case 'webhook':
        return $t(
          'Les étapes suivantes citent sa réponse : {{{id}.statut}}, {{{id2}.reponse.clé}}.',
          { id: step.id, id2: step.id },
        )
      case 'for_each':
        return step.onError === 'continue'
          ? $t(
              'Les étapes de la boucle citent la ligne du tour — {{{id}.champ}} — ou la modifient. Après la boucle, {{{id2}.nombre}} dit combien de lignes elle a parcourues. Une ligne dont une étape échoue est passée ; le compte rendu dit combien.',
              { id: step.id, id2: step.id },
            )
          : $t(
              'Les étapes de la boucle citent la ligne du tour — {{{id}.champ}} — ou la modifient. Après la boucle, {{{id2}.nombre}} dit combien de lignes elle a parcourues. Une étape qui échoue arrête l’exécution.',
              { id: step.id, id2: step.id },
            )
      case 'find_record':
        return $t(
          'Les étapes suivantes citent la ligne trouvée — {{{id}.champ}} — ou la modifient. Rien trouvé : celles qui la modifient sont passées ; une condition peut le tester.',
          { id: step.id },
        )
      case 'aggregate':
        return $t(
          'Les étapes suivantes citent le nombre de lignes, {{{id}.nombre}}, et chaque mesure : {{{id2}.somme.champ}}, {{{id3}.moyenne.champ}}, {{{id4}.min.champ}}, {{{id5}.max.champ}}.',
          { id: step.id, id2: step.id, id3: step.id, id4: step.id, id5: step.id },
        )
      case 'document':
        return $t(
          'Fait avec les droits du propriétaire de l’automatisation. Les étapes suivantes citent le nom du fichier, {{{id}.nom}} ; un courriel le joint.',
          { id: step.id },
        )
      case 'attempt':
        return $t(
          'Dans le second chemin, les étapes citent {{{id}.erreur}} — le code de l’erreur — et {{{id2}.etape}} — l’étape qui a échoué.',
          { id: step.id, id2: step.id },
        )
      default:
        return $t(
          'Les étapes suivantes citent la ligne créée — {{{id}.champ}}, {{{id2}._id}} — ou la modifient.',
          { id: step.id, id2: step.id },
        )
    }
  })()
  return <Note>{text}</Note>
}

/**
 * A mail, by the instance's relay (chapter 17 §1.3): to people of the team, the person or
 * the address a row names, addresses written out — one mail each, or one to all, with
 * people in copy; in rich text; with the PDFs of steps before and the files
 * of rows attached. An answer goes to whoever owns the automation, unless said otherwise.
 * Said up front when the instance cannot send mail: the step would fail.
 */
function EmailSettings({
  step,
  draft,
  base,
  members,
  before,
  rows,
  groups,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'email' }>
  readonly draft: Draft
  readonly base: DescribedBase
  readonly members: readonly Member[]
  readonly before: readonly DraftStep[]
  readonly rows: readonly RowChoice[]
  readonly groups: readonly CiteGroup[]
  readonly onChange: (next: DraftStep) => void
}) {
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    api
      .resume()
      .then((me) => live && setAvailable(me?.mailAvailable === true))
      .catch(() => live && setAvailable(null))
    return () => {
      live = false
    }
  }, [])
  const people = members.filter((m) => !m.disabled)
  const table = step.record === '' ? null : rowTableOf(draft, step.record)
  const fields = table === null ? [] : fieldsOfTable(base, table)
  return (
    <div className="space-y-5">
      {available === false && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {$t(
            'Cette instance n’envoie pas de courriels : aucun serveur d’envoi n’y est configuré. L’étape échouera tant que l’exploitant n’en aura pas réglé un.',
          )}
        </p>
      )}
      {rows.length > 0 && (
        <RowSelect
          choices={rows}
          value={step.record}
          onChange={(record) => onChange({ ...step, record, userField: '', emailField: '' })}
          label={$t('À propos de la ligne')}
          none={$t('Aucune ligne')}
        />
      )}
      <Section title={$t('À qui')}>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {people.map((m) => (
            <label
              key={m.id}
              htmlFor={`email-${step.id}-${m.id}`}
              className="flex items-center gap-1.5 text-sm"
            >
              <Checkbox
                id={`email-${step.id}-${m.id}`}
                checked={step.users.includes(m.id)}
                onCheckedChange={(v) =>
                  onChange({
                    ...step,
                    users:
                      v === true ? [...step.users, m.id] : step.users.filter((u) => u !== m.id),
                  })
                }
              />
              {m.display_name || m.email}
            </label>
          ))}
        </div>
        {table !== null && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{$t('la personne du champ')}</span>
              <FieldSelect
                fields={fields.filter((f) => f.kind === 'user')}
                value={step.userField}
                onChange={(userField) => onChange({ ...step, userField })}
                placeholder={$t('Aucun champ')}
                label={$t('Champ personne destinataire')}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{$t('l’adresse du champ')}</span>
              <FieldSelect
                fields={fields.filter((f) => f.kind === 'email')}
                value={step.emailField}
                onChange={(emailField) => onChange({ ...step, emailField })}
                placeholder={$t('Aucun champ')}
                label={$t('Champ e-mail destinataire')}
              />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{$t('et ces adresses')}</span>
          <Input
            value={step.addresses}
            onChange={(e) => onChange({ ...step, addresses: e.target.value })}
            placeholder="compta@exemple.fr, direction@exemple.fr"
            aria-label={$t('Adresses destinataires')}
            className="h-8 text-sm"
          />
        </div>
      </Section>
      <Section
        title={$t('Envoi')}
        hint={
          step.mode === 'each'
            ? $t('Un courriel à chacun : personne ne voit les autres adresses.')
            : $t('Un seul courriel à tous : les destinataires se voient les uns les autres.')
        }
      >
        <Segmented
          value={step.mode}
          options={[
            { value: 'each', label: $t('Un courriel chacun') },
            { value: 'together', label: $t('Un seul, à tous') },
          ]}
          onChange={(mode) => onChange({ ...step, mode })}
          label={$t('Mode d’envoi')}
        />
        {step.mode === 'together' && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{$t('En copie')}</span>
            <Input
              value={step.cc}
              onChange={(e) => onChange({ ...step, cc: e.target.value })}
              placeholder="direction@exemple.fr"
              aria-label={$t('Adresses en copie')}
              className="h-8 text-sm"
            />
          </div>
        )}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{$t('Répondre à')}</span>
          <CitingText
            value={step.replyTo}
            onChange={(replyTo) => onChange({ ...step, replyTo })}
            groups={groups}
            label={$t('Adresse de réponse')}
            placeholder={$t('Vide : qui possède l’automatisation')}
          />
        </div>
      </Section>
      <Section title={$t('Objet')}>
        <CitingText
          value={step.subject}
          onChange={(subject) => onChange({ ...step, subject })}
          groups={groups}
          label={$t('Objet du courriel')}
          placeholder="Commande {{numero}} expédiée"
        />
      </Section>
      <Section title={$t('Message')}>
        <RichMessage
          value={step.message}
          onChange={(message) => onChange({ ...step, message })}
          groups={groups}
        />
      </Section>
      <Attachments
        step={step}
        base={base}
        before={before}
        rows={rows}
        onChange={(attachments) => onChange({ ...step, attachments })}
      />
      <p className="text-xs text-muted-foreground">
        {$t(
          'Au plus {max} destinataires, {cc} adresses en copie et {files} pièces jointes, 15 Mo en tout.',
          { max: MAX_RECIPIENTS, cc: MAX_CC, files: MAX_ATTACHMENTS },
        )}
      </p>
    </div>
  )
}

/**
 * A mail's formatted body, in the app's rich text, each citation a pill. The editor tidies
 * what it opens and says so: only what the person writes changes the step.
 */
function RichMessage({
  value,
  onChange,
  groups,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly groups: readonly CiteGroup[]
}) {
  const touched = useRef(false)
  const touch = () => {
    touched.current = true
  }
  const variables = useMemo(
    (): VariableChoice[] =>
      groups.flatMap((g) =>
        g.items.map((item) => {
          const name = item.token.slice(2, -2)
          const owner = name.includes('.') ? name.slice(0, name.indexOf('.')) : null
          return {
            name,
            label:
              owner === null || owner === TRIGGER_ROW ? item.label : `${owner} · ${item.label}`,
            group: g.label,
          }
        }),
      ),
    [groups],
  )
  return (
    <div onPointerDown={touch} onKeyDown={touch} onPaste={touch} onDrop={touch}>
      <RichTextEditor
        value={value}
        onChange={(next) => touched.current && onChange(next)}
        variables={variables}
        variablesLabel={$t('Citer')}
        placeholder={$t('Bonjour, …')}
      />
    </div>
  )
}

/** What a mail attaches: the PDF of a document step before it, a file field of a row. */
function Attachments({
  step,
  base,
  before,
  rows,
  onChange,
}: {
  readonly step: Extract<DraftStep, { kind: 'email' }>
  readonly base: DescribedBase
  readonly before: readonly DraftStep[]
  readonly rows: readonly RowChoice[]
  readonly onChange: (attachments: DraftAttachment[]) => void
}) {
  const offered = [
    ...before.flatMap((s) =>
      s.kind === 'document'
        ? [
            {
              attachment: { step: s.id } as DraftAttachment,
              label: s.name.trim() === '' ? stepCaption(s) : `${s.id} · ${s.name.trim()}`,
              kind: 'document',
            },
          ]
        : [],
    ),
    ...rows.flatMap((r) =>
      fieldsOfTable(base, r.table)
        .filter((f) => f.kind === 'file' || f.kind === 'image')
        .map((f) => ({
          attachment: { record: r.value, field: f.name } as DraftAttachment,
          label: $t('{field} — {row}', { field: f.label, row: r.label }),
          kind: f.kind,
        })),
    ),
  ]
  const attached = new Set(step.attachments.map(attachmentKey))
  const labelOf = (a: DraftAttachment) =>
    offered.find((o) => attachmentKey(o.attachment) === attachmentKey(a))?.label ??
    ('step' in a ? a.step : `${a.record} · ${a.field}`)
  const left = offered.filter((o) => !attached.has(attachmentKey(o.attachment)))
  return (
    <Section
      title={$t('Pièces jointes')}
      hint={$t(
        'Le PDF d’une étape « Générer un PDF » d’avant, les fichiers d’un champ d’une ligne.',
      )}
    >
      {step.attachments.length > 0 && (
        <ul className="space-y-1">
          {step.attachments.map((a) => (
            <li
              key={attachmentKey(a)}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-sm"
            >
              {'step' in a ? (
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FieldIcon kind="file" className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{labelOf(a)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                onClick={() =>
                  onChange(step.attachments.filter((x) => attachmentKey(x) !== attachmentKey(a)))
                }
                aria-label={$t('Retirer la pièce jointe {label}', { label: labelOf(a) })}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {offered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {$t('Rien à joindre ici : ajoutez avant une étape « Générer un PDF ».')}
        </p>
      ) : (
        <Choice
          value={null}
          onValueChange={(key) => {
            const found = left.find((o) => attachmentKey(o.attachment) === key)
            if (found !== undefined) onChange([...step.attachments, found.attachment])
          }}
          options={left.map((o) => ({
            value: attachmentKey(o.attachment),
            label: o.label,
            render: (
              <span className="flex min-w-0 items-center gap-2">
                {o.kind === 'document' ? (
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FieldIcon kind={o.kind} className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{o.label}</span>
              </span>
            ),
          }))}
          placeholder={$t('Joindre…')}
          aria-label={$t('Ajouter une pièce jointe')}
          disabled={left.length === 0 || step.attachments.length >= MAX_ATTACHMENTS}
        />
      )}
    </Section>
  )
}

/** « Envoyer sur Slack » : a connection of the base, and a message composed from what came before. */
function SlackSettings({
  base,
  step,
  groups,
  onChange,
}: {
  readonly base: DescribedBase
  readonly step: Extract<DraftStep, { kind: 'slack' }>
  readonly groups: readonly CiteGroup[]
  readonly onChange: (next: DraftStep) => void
}) {
  const [integrations, setIntegrations] = useState<readonly Integration[] | null>(null)
  useEffect(() => {
    let live = true
    api
      .integrations(base.name)
      .then((list) => live && setIntegrations(list))
      .catch(() => live && setIntegrations([]))
    return () => {
      live = false
    }
  }, [base.name])
  if (integrations?.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {$t(
          'Aucun canal Slack n’est connecté à cette base : connectez-en un dans « Intégrations ».',
        )}
      </p>
    )
  }
  return (
    <div className="space-y-5">
      <Choice
        value={step.integration === '' ? null : step.integration}
        onValueChange={(integration) => onChange({ ...step, integration })}
        options={(integrations ?? []).map((i) => ({ value: i.id, label: i.label }))}
        placeholder={$t('Choisir un canal')}
        aria-label={$t('Canal Slack')}
      />
      <Section title={$t('Message')}>
        <MessageInput
          value={step.message}
          onChange={(message) => onChange({ ...step, message })}
          groups={groups}
          label={$t('Message Slack')}
          placeholder="{{nom}} vient d’être livrée"
        />
      </Section>
    </div>
  )
}

// ── A condition and its paths ───────────────────────────────────────────────

function BranchSettings({
  step,
  draft,
  onChange,
  onSelect,
}: {
  readonly step: Extract<DraftStep, { kind: 'branch' }>
  readonly draft: Draft
  readonly onChange: (next: DraftStep) => void
  readonly onSelect: (id: string) => void
}) {
  const otherwise = step.paths.find((p) => p.otherwise)
  const tests = step.paths.filter((p) => !p.otherwise)
  const setPaths = (paths: DraftPath[]) => onChange({ ...step, paths })
  const move = (index: number, delta: number) => {
    const next = [...tests]
    const [moved] = next.splice(index, 1)
    if (moved !== undefined) next.splice(index + delta, 0, moved)
    setPaths([...next, ...(otherwise === undefined ? [] : [otherwise])])
  }
  const add = () => {
    const id = freshId(draft.steps, 'c')
    const row = triggerHasTable(draft.trigger.kind) ? TRIGGER_ROW : ''
    const path = blankPath(id, $t('Chemin {value}', { value: tests.length + 1 }), false, row)
    setPaths([...tests, path, ...(otherwise === undefined ? [] : [otherwise])])
    onSelect(id)
  }
  const addOtherwise = () => {
    const id = freshId(draft.steps, 'c')
    setPaths([...step.paths, blankPath(id, $t('Sinon'), true, '')])
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {$t(
          'Le premier chemin dont la condition est remplie est pris, et lui seul ; « Sinon » quand aucun ne l’est. Les chemins se rejoignent ensuite, et le flux continue.',
        )}
      </p>
      <Section title={$t('Chemins')}>
        <div className="divide-y rounded-md border">
          {step.paths.map((path) => {
            const index = tests.indexOf(path)
            const problem = pathProblem(path, draft)
            return (
              <div key={path.id} className="flex items-center gap-1 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(path.id)}
                  className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block truncate text-sm font-medium">{path.label}</span>
                  <span
                    className={cn(
                      'block truncate font-mono text-[11px]',
                      problem === null
                        ? 'text-muted-foreground'
                        : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {problem ?? pathSummary(path)}
                  </span>
                </button>
                {!path.otherwise && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={$t('Monter le chemin {label}', { label: path.label })}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === tests.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={$t('Descendre le chemin {label}', { label: path.label })}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </>
                )}
                <Hint label={path.steps.length > 0 ? $t('Retire aussi ses étapes') : undefined}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={step.paths.length === 1}
                    onClick={() => setPaths(step.paths.filter((p) => p.id !== path.id))}
                    aria-label={$t('Retirer le chemin {label}', { label: path.label })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </Hint>
              </div>
            )
          })}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={step.paths.length >= MAX_PATHS}
            onClick={add}
          >
            <Plus className="size-3.5" />
            {$t('Chemin')}
          </Button>
          {otherwise === undefined && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={step.paths.length >= MAX_PATHS}
              onClick={addOtherwise}
            >
              <Plus className="size-3.5" />
              {$t('Sinon')}
            </Button>
          )}
        </div>
      </Section>
    </div>
  )
}

/**
 * « Essayer » : the steps of its first path are tried; when one fails, the run goes on
 * with the second, then after the block — the second skipped when nothing failed.
 */
function AttemptSettings({
  step,
  onSelect,
}: {
  readonly step: Extract<DraftStep, { kind: 'attempt' }>
  readonly onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {$t(
          'Les étapes du premier chemin sont essayées. Si l’une échoue, l’exécution ne s’arrête pas : elle passe au second chemin, puis continue après le bloc. Si rien n’échoue, le second chemin est sauté.',
        )}
      </p>
      <Section title={$t('Chemins')}>
        <div className="divide-y rounded-md border">
          {step.paths.map((path, index) => (
            <button
              key={path.id}
              type="button"
              onClick={() => onSelect(path.id)}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {index === 0 ? (
                <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
              ) : (
                <TriangleAlert className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{path.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {pathSummary(path, step)} ·{' '}
                  {$tp(path.steps.length, '{count} étape', '{count} étapes')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Section>
      <OutputHint step={step} />
    </div>
  )
}

export function PathSettings({
  path,
  draft,
  base,
  onChange,
}: {
  readonly path: DraftPath
  readonly draft: Draft
  readonly base: DescribedBase
  readonly onChange: (next: DraftPath) => void
}) {
  const holder = findPath(draft.steps, path.id)?.branch ?? null
  const before = stepsBefore(draft.steps, path.id) ?? []
  const around = loopsAround(draft.steps, path.id)
  const rows = rowChoices(draft, base, before, around)
  const groups = citeGroups(draft, base, before, around)
  const table = path.record === '' ? null : rowTableOf(draft, path.record)
  const name = (
    <Section title={$t('Nom')}>
      <Input
        value={path.label}
        onChange={(e) => onChange({ ...path, label: e.target.value })}
        aria-label={$t('Nom du chemin')}
        maxLength={60}
        className="h-8"
      />
    </Section>
  )
  if (holder?.kind === 'attempt') {
    const rescue = holder.paths[1]?.id === path.id
    return (
      <div className="space-y-5">
        {name}
        <p className="text-sm text-muted-foreground">
          {rescue
            ? $t(
                'Pris quand une étape du premier chemin échoue ; sauté sinon. Ses étapes citent {{{id}.erreur}}, le code de l’erreur, et {{{id2}.etape}}, l’étape qui a échoué.',
                { id: holder.id, id2: holder.id },
              )
            : $t(
                'Ses étapes sont essayées l’une après l’autre ; à la première qui échoue, l’exécution passe au second chemin.',
              )}
        </p>
      </div>
    )
  }
  const problem = pathProblem(path, draft)
  return (
    <div className="space-y-5">
      {name}
      {path.otherwise ? (
        <p className="text-sm text-muted-foreground">
          {$t('Pris quand aucun chemin avant lui ne convient.')}
        </p>
      ) : (
        <>
          <Segmented
            value={path.test}
            options={[
              { value: 'row', label: $t('Tester une ligne') },
              { value: 'value', label: $t('Comparer une valeur') },
            ]}
            onChange={(test) => onChange({ ...path, test })}
            label={$t('Ce que le chemin teste')}
          />
          {path.test === 'row' ? (
            <>
              <RowSelect
                choices={rows}
                value={path.record}
                onChange={(record) => onChange({ ...path, record })}
                label={$t('La ligne testée')}
              />
              <Section
                title={$t('Si')}
                hint={$t(
                  'Dans le langage des filtres. Vide : le chemin est pris dès que la ligne existe — après « Chercher une ligne », quand elle a trouvé.',
                )}
              >
                <FilterInput
                  value={path.condition}
                  onChange={(condition) => onChange({ ...path, condition })}
                  fields={filterFieldsOf(base, table)}
                  groups={groups}
                  label={$t('Condition du chemin')}
                  placeholder={$t('statut eq "fait"')}
                />
              </Section>
            </>
          ) : (
            <Section
              title={$t('Si')}
              hint={$t(
                'Deux nombres se comparent en nombres, deux dates dans l’ordre du temps ; un texte, sans tenir compte des majuscules ni des accents.',
              )}
            >
              <CitingText
                value={path.value}
                onChange={(value) => onChange({ ...path, value })}
                groups={groups}
                label={$t('Valeur testée')}
                placeholder="{{e2.reponse}}"
                className="font-mono text-sm"
              />
              <Choice
                value={path.op}
                onValueChange={(op) => onChange({ ...path, op: op as AutomationValueOp })}
                options={VALUE_OPS.map((o) => ({ value: o.value, label: o.label }))}
                aria-label={$t('Comparaison')}
              />
              {comparesWith(path.op) && (
                <CitingText
                  value={path.operand}
                  onChange={(operand) => onChange({ ...path, operand })}
                  groups={groups}
                  label={$t('Valeur de comparaison')}
                  placeholder={$t('Urgent, 100, ou {{montant}}')}
                />
              )}
            </Section>
          )}
          {problem !== null && <Warning>{problem}</Warning>}
        </>
      )}
    </div>
  )
}
