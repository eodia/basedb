'use client'

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
  type AutomationTriggerKind,
  type DescribedBase,
  type Field,
  type Integration,
  type Member,
  api,
} from '@/lib/api/client'
import {
  AI_ANSWERS,
  type CiteGroup,
  type Draft,
  type DraftPath,
  type DraftStep,
  type RowChoice,
  TRIGGER_LABELS,
  TRIGGER_ROW,
  type ValueRow,
  citeGroups,
  filterIssue,
  freshId,
  pathProblem,
  pathSummary,
  rowChoices,
  rowTableOf,
  stepsBefore,
  writableFields,
} from '@/lib/automations'
import { $t, intlLocale, weekdayNames } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, Braces, Plus, Trash2, X } from 'lucide-react'
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react'

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
  invalid = false,
  className,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly groups: readonly CiteGroup[]
  readonly label: string
  readonly placeholder?: string
  readonly multiline?: boolean
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
          rows={3}
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
      {issue !== null && <p className="text-xs text-amber-600 dark:text-amber-400">{issue}</p>}
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

const fieldsOfTable = (base: DescribedBase, name: string | null) =>
  (base.tables.find((t) => t.name === name)?.fields ?? []).filter((f) => f.system !== true)

/** What a filter on a table may name: its fields, system columns included. */
const filterFieldsOf = (base: DescribedBase, name: string | null) =>
  base.tables.find((t) => t.name === name)?.fields ?? []

// ── The trigger ─────────────────────────────────────────────────────────────

const WEEKDAYS = weekdayNames('long')

export function TriggerSettings({
  draft,
  base,
  automation,
  onChange,
}: {
  readonly draft: Draft
  readonly base: DescribedBase
  readonly automation: Automation | null
  readonly onChange: (patch: Partial<Draft>) => void
}) {
  const setTrigger = (patch: Partial<Draft['trigger']>) =>
    onChange({ trigger: { ...draft.trigger, ...patch } })
  const schedule = draft.trigger.kind === 'schedule'
  const sourceFields = fieldsOfTable(base, draft.trigger.table)
  const setSchedule = (patch: Partial<Draft['trigger']['schedule']>) =>
    setTrigger({ schedule: { ...draft.trigger.schedule, ...patch } })

  return (
    <div className="space-y-6">
      <Section title={$t('Quand')}>
        <Choice
          value={draft.trigger.kind}
          onValueChange={(v) => setTrigger({ kind: v as AutomationTriggerKind })}
          options={(Object.keys(TRIGGER_LABELS) as AutomationTriggerKind[]).map((k) => ({
            value: k,
            label: TRIGGER_LABELS[k],
          }))}
          aria-label={$t('Déclencheur')}
        />
        {!schedule && (
          <TableSelect
            base={base}
            value={draft.trigger.table}
            onChange={(table) => setTrigger({ table, fields: [] })}
            label={$t('Table du déclencheur')}
          />
        )}
        {draft.trigger.kind === 'record_updated' && (
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
        {schedule && (
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
        {schedule && automation?.next_run_at !== null && automation?.next_run_at !== undefined && (
          <p className="text-xs text-muted-foreground">
            {$t('Prochaine exécution : {value}', {
              value: new Date(automation.next_run_at).toLocaleString(intlLocale()),
            })}
          </p>
        )}
        {schedule && (
          <p className="text-xs text-muted-foreground">
            {$t(
              'Une horloge n’a pas de ligne : pour agir sur une ligne, commencez par « Chercher une ligne ».',
            )}
          </p>
        )}
      </Section>

      {!schedule && (
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

// ── A step ──────────────────────────────────────────────────────────────────

export function StepSettings({
  step,
  draft,
  base,
  members,
  onChange,
  onSelect,
}: {
  readonly step: DraftStep
  readonly draft: Draft
  readonly base: DescribedBase
  readonly members: readonly Member[]
  readonly onChange: (next: DraftStep) => void
  readonly onSelect: (id: string) => void
}) {
  const before = stepsBefore(draft.steps, step.id) ?? []
  const groups = citeGroups(draft, base, before)
  const rows = rowChoices(draft, base, before)

  switch (step.kind) {
    case 'update_record': {
      const table = rowTableOf(draft, step.record)
      return (
        <div className="space-y-5">
          <RowSelect
            choices={rows}
            value={step.record}
            onChange={(record) => onChange({ ...step, record, values: [{ field: '', value: '' }] })}
            label={$t('La ligne à modifier')}
          />
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
                  { value: 'asc', label: 'croissant' },
                  { value: 'desc', label: $t('décroissant') },
                ]}
                aria-label={$t('Sens du tri')}
                className="w-32"
                disabled={sortField === ''}
              />
            </div>
          </Section>
          <OutputHint step={step} />
        </div>
      )
    }
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
    case 'webhook':
      return (
        <div className="space-y-5">
          <Section title={$t('Adresse')}>
            <Input
              value={step.url}
              onChange={(e) => onChange({ ...step, url: e.target.value })}
              aria-label={$t('Adresse du webhook')}
              className="h-8 font-mono text-sm"
            />
          </Section>
          <RowSelect
            choices={rows}
            value={step.record}
            onChange={(record) => onChange({ ...step, record })}
            label={$t('La ligne envoyée')}
            none={$t('Aucune ligne')}
          />
          <p className="text-xs text-muted-foreground">
            {$t('Un')} <code>POST</code>{' '}
            {$t(
              'JSON : l’automatisation, le déclencheur, la ligne, et ce que les étapes précédentes ont trouvé ou écrit. Adresse',
            )}{' '}
            <code>https</code> {$t('publique seulement ; 10 secondes au plus.')}
          </p>
          <OutputHint step={step} />
        </div>
      )
    case 'slack':
      return <SlackSettings base={base} step={step} groups={groups} onChange={onChange} />
    case 'ai':
      return <AiSettings base={base} step={step} groups={groups} onChange={onChange} />
    case 'branch':
      return <BranchSettings step={step} draft={draft} onChange={onChange} onSelect={onSelect} />
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
  const text =
    step.kind === 'ai'
      ? $t(
          'Les étapes suivantes citent sa réponse, {{{id}.reponse}} : dans un message, dans une valeur à écrire — un nombre, oui ou non, une date, un choix passent tels quels dans un champ du même type.',
          { id: step.id },
        )
      : step.kind === 'webhook'
        ? $t('Les étapes suivantes citent sa réponse : {{{id}.statut}}, {{{id2}.reponse.clé}}.', {
            id: step.id,
            id2: step.id,
          })
        : step.kind === 'find_record'
          ? $t(
              'Les étapes suivantes citent la ligne trouvée — {{{id}.champ}} — ou la modifient. Rien trouvé : celles qui la modifient sont passées ; une condition peut le tester.',
              { id: step.id },
            )
          : $t(
              'Les étapes suivantes citent la ligne créée — {{{id}.champ}}, {{{id2}._id}} — ou la modifient.',
              { id: step.id, id2: step.id },
            )
  return <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">{text}</p>
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
    const row = draft.trigger.kind === 'schedule' ? '' : TRIGGER_ROW
    const path: DraftPath = {
      id,
      label: $t('Chemin {value}', { value: tests.length + 1 }),
      otherwise: false,
      record: row,
      condition: '',
      steps: [],
    }
    setPaths([...tests, path, ...(otherwise === undefined ? [] : [otherwise])])
    onSelect(id)
  }
  const addOtherwise = () => {
    const id = freshId(draft.steps, 'c')
    setPaths([
      ...step.paths,
      { id, label: $t('Sinon'), otherwise: true, record: '', condition: '', steps: [] },
    ])
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
            disabled={step.paths.length >= 5}
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
              disabled={step.paths.length >= 5}
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
  const before = stepsBefore(draft.steps, path.id) ?? []
  const rows = rowChoices(draft, base, before)
  const table = path.record === '' ? null : rowTableOf(draft, path.record)
  return (
    <div className="space-y-5">
      <Section title={$t('Nom')}>
        <Input
          value={path.label}
          onChange={(e) => onChange({ ...path, label: e.target.value })}
          aria-label={$t('Nom du chemin')}
          maxLength={60}
          className="h-8"
        />
      </Section>
      {path.otherwise ? (
        <p className="text-sm text-muted-foreground">
          {$t('Pris quand aucun chemin avant lui ne convient.')}
        </p>
      ) : (
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
              groups={citeGroups(draft, base, before)}
              label={$t('Condition du chemin')}
              placeholder={$t('statut eq "fait"')}
            />
          </Section>
        </>
      )}
    </div>
  )
}
