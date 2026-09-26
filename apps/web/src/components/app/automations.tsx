'use client'

import { SidebarToggle } from '@/components/app/sidebar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  type Automation,
  type AutomationRun,
  type AutomationTriggerKind,
  type DescribedBase,
  type Field,
  type Integration,
  type Member,
  api,
} from '@/lib/api/client'
import {
  ACTION_LABELS,
  type Draft,
  type DraftAction,
  TRIGGER_LABELS,
  TRIGGER_OF_RUN,
  type ValueRow,
  draftOf,
  emptyDraft,
  inputOf,
  newAction,
  runSentence,
  writableFields,
} from '@/lib/automations'
import { relativeTime } from '@/lib/collab'
import { MembersProvider, useMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, Braces, Loader2, Play, Plus, Trash2, X, Zap } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

/**
 * The automations of a base — chapter 17, on screen: the list with each one's switch and
 * last run; the editor — when, if, then; and the runs, action by action, with why a run
 * did nothing when it did nothing.
 */

const NONE = '__aucun__'

export function AutomationsPanel({
  base,
  onBack,
}: {
  readonly base: DescribedBase
  readonly onBack: () => void
}) {
  return (
    <MembersProvider>
      <Panel base={base} onBack={onBack} />
    </MembersProvider>
  )
}

function Panel({ base, onBack }: { readonly base: DescribedBase; readonly onBack: () => void }) {
  const [automations, setAutomations] = useState<readonly Automation[] | null>(null)
  const [selected, setSelected] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await api.automations(base.name)
      setAutomations(list)
      setError(null)
      return list
    } catch (e) {
      setError(messageFor(e))
      return null
    }
  }, [base.name])

  useEffect(() => {
    setSelected(null)
    void load().then((list) => {
      if (list !== null && list.length > 0) setSelected(list[0]?.id ?? null)
    })
  }, [load])

  // The last run of each, kept fresh while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => void load(), 10_000)
    return () => clearInterval(timer)
  }, [load])

  const current =
    selected === null || selected === 'new'
      ? null
      : (automations?.find((a) => a.id === selected) ?? null)

  const toggle = async (automation: Automation, enabled: boolean) => {
    try {
      await api.updateAutomation(base.name, automation.id, { enabled })
      await load()
    } catch (e) {
      setError(messageFor(e))
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Automatisations</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onBack}>
          Retour aux données
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r">
          <div className="p-3">
            <Button className="w-full gap-1.5" size="sm" onClick={() => setSelected('new')}>
              <Plus className="size-4" />
              Nouvelle automatisation
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scroll-discret">
            {automations === null && error === null && (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {automations?.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Aucune automatisation. Faites faire à la base ce que vous refaites à la main.
              </p>
            )}
            {automations?.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-2',
                  selected === a.id ? 'bg-accent' : 'hover:bg-accent/60',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <Zap
                      className={cn(
                        'size-3.5 shrink-0',
                        a.enabled ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className="truncate">{a.label}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {TRIGGER_LABELS[a.trigger.kind]}
                    {a.last_run !== null && (
                      <>
                        {' · '}
                        <RunDot status={a.last_run.status} /> {relativeTime(a.last_run.at)}
                      </>
                    )}
                  </span>
                </button>
                <Switch
                  checked={a.enabled}
                  onCheckedChange={(v) => void toggle(a, v)}
                  aria-label={a.enabled ? `Désactiver ${a.label}` : `Activer ${a.label}`}
                />
              </div>
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto scroll-discret">
          {error !== null && <p className="m-4 text-sm text-destructive">{error}</p>}
          {selected === null ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Choisissez une automatisation, ou créez-en une.
            </p>
          ) : (
            <Editor
              key={selected}
              base={base}
              automation={current}
              onSaved={async (saved) => {
                await load()
                setSelected(saved.id)
              }}
              onDeleted={async () => {
                const list = await load()
                setSelected(list?.[0]?.id ?? null)
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function RunDot({ status }: { readonly status: string }) {
  const tone =
    status === 'succeeded'
      ? 'bg-emerald-500'
      : status === 'failed'
        ? 'bg-rose-500'
        : status === 'skipped'
          ? 'bg-muted-foreground/50'
          : 'bg-amber-500'
  return <span className={cn('inline-block size-1.5 rounded-full align-middle', tone)} />
}

function Section({
  title,
  hint,
  children,
}: {
  readonly title: string
  readonly hint?: string
  readonly children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
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
  placeholder = 'Choisir un champ',
  label,
}: {
  readonly fields: readonly Field[]
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly label: string
}) {
  return (
    <Select
      value={value === '' ? NONE : value}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn('h-8', value === '' && 'text-muted-foreground')}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">{placeholder}</span>
        </SelectItem>
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A menu that adds `{{champ}}` at the end of a text: citing the row. */
function Cite({
  fields,
  onCite,
}: {
  readonly fields: readonly Field[]
  readonly onCite: (token: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Citer la ligne" title="Citer la ligne">
          <Braces className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
        {fields
          .filter((f) => f.kind !== 'button')
          .map((f) => (
            <DropdownMenuItem key={f.name} onSelect={() => onCite(`{{${f.name}}}`)}>
              {f.label}
              <span className="ml-auto pl-3 font-mono text-[11px] text-muted-foreground">
                {`{{${f.name}}}`}
              </span>
            </DropdownMenuItem>
          ))}
        <DropdownMenuItem onSelect={() => onCite('{{_maintenant}}')}>
          Maintenant
          <span className="ml-auto pl-3 font-mono text-[11px] text-muted-foreground">
            {'{{_maintenant}}'}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Editor({
  base,
  automation,
  onSaved,
  onDeleted,
}: {
  readonly base: DescribedBase
  readonly automation: Automation | null
  readonly onSaved: (saved: Automation) => Promise<void>
  readonly onDeleted: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    automation === null ? emptyDraft(base) : draftOf(automation, base),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runsTick, setRunsTick] = useState(0)
  const members = useMembers()

  const source = base.tables.find((t) => t.name === draft.trigger.table) ?? null
  const sourceFields = source?.fields.filter((f) => f.system !== true) ?? []
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setTrigger = (patch: Partial<Draft['trigger']>) =>
    setDraft((d) => ({ ...d, trigger: { ...d.trigger, ...patch } }))
  const setAction = (index: number, next: DraftAction) =>
    setDraft((d) => ({ ...d, actions: d.actions.map((a, i) => (i === index ? next : a)) }))
  const moveAction = (index: number, step: number) =>
    setDraft((d) => {
      const actions = [...d.actions]
      const [moved] = actions.splice(index, 1)
      if (moved !== undefined) actions.splice(index + step, 0, moved)
      return { ...d, actions }
    })

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved =
        automation === null
          ? await api.createAutomation(base.name, inputOf(draft))
          : await api.updateAutomation(base.name, automation.id, inputOf(draft))
      await onSaved(saved)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (automation === null) return
    setBusy(true)
    try {
      await api.deleteAutomation(base.name, automation.id)
      await onDeleted()
    } catch (e) {
      setError(messageFor(e))
      setBusy(false)
    }
  }

  const schedule = draft.trigger.kind === 'schedule'

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-6 py-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={draft.label}
            onChange={(e) => set({ label: e.target.value })}
            aria-label="Nom de l’automatisation"
            className="h-9 text-base font-semibold"
            maxLength={255}
          />
          <Textarea
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="À quoi sert-elle ? (facultatif)"
            aria-label="Description de l’automatisation"
            rows={2}
            className="min-h-0 resize-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-2 text-sm">
          <Switch
            id="automation-enabled"
            checked={draft.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
          <label htmlFor="automation-enabled">Active</label>
        </div>
      </div>
      {automation !== null && (
        <p className="-mt-4 text-xs text-muted-foreground">
          Agit avec les droits de {automation.owner.name}, qui l’a enregistrée en dernier.
          L’enregistrer vous en rend propriétaire.
        </p>
      )}

      <Section title="Quand">
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={draft.trigger.kind}
            onValueChange={(v) => setTrigger({ kind: v as AutomationTriggerKind })}
          >
            <SelectTrigger aria-label="Déclencheur" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TRIGGER_LABELS) as AutomationTriggerKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {TRIGGER_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!schedule && (
            <Select
              value={draft.trigger.table}
              onValueChange={(v) => setTrigger({ table: v, fields: [] })}
            >
              <SelectTrigger aria-label="Table du déclencheur" className="h-8">
                <SelectValue placeholder="Choisir une table" />
              </SelectTrigger>
              <SelectContent>
                {base.tables.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    dans {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {draft.trigger.kind === 'record_updated' && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Surveiller seulement ces champs (aucun coché : tout changement).
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
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Select
              value={draft.trigger.schedule.every}
              onValueChange={(v) =>
                setTrigger({
                  schedule: { ...draft.trigger.schedule, every: v as 'hour' | 'day' | 'week' },
                })
              }
            >
              <SelectTrigger aria-label="Fréquence" className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Toutes les heures</SelectItem>
                <SelectItem value="day">Chaque jour</SelectItem>
                <SelectItem value="week">Chaque semaine</SelectItem>
              </SelectContent>
            </Select>
            {draft.trigger.schedule.every === 'week' && (
              <Select
                value={String(draft.trigger.schedule.weekday)}
                onValueChange={(v) =>
                  setTrigger({ schedule: { ...draft.trigger.schedule, weekday: Number(v) } })
                }
              >
                <SelectTrigger aria-label="Jour" className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(
                    (d, i) => (
                      <SelectItem key={d} value={String(i + 1)}>
                        le {d}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
            <span className="text-muted-foreground">
              {draft.trigger.schedule.every === 'hour' ? 'à la minute' : 'à'}
            </span>
            <Input
              type="time"
              value={draft.trigger.schedule.at}
              onChange={(e) =>
                setTrigger({ schedule: { ...draft.trigger.schedule, at: e.target.value } })
              }
              aria-label="Heure"
              className="h-8 w-28"
            />
            <Input
              value={draft.trigger.schedule.timezone}
              onChange={(e) =>
                setTrigger({ schedule: { ...draft.trigger.schedule, timezone: e.target.value } })
              }
              aria-label="Fuseau horaire"
              className="h-8 w-40"
            />
          </div>
        )}
        {automation?.next_run_at !== null && automation?.next_run_at !== undefined && schedule && (
          <p className="text-xs text-muted-foreground">
            Prochaine exécution : {new Date(automation.next_run_at).toLocaleString('fr-FR')}
          </p>
        )}
      </Section>

      {!schedule && (
        <Section
          title="Si"
          hint="Facultatif — dans le langage des filtres, évalué sur la ligne au moment d’agir."
        >
          <Input
            value={draft.condition}
            onChange={(e) => set({ condition: e.target.value })}
            placeholder='statut eq "fait"'
            aria-label="Condition"
            className="h-8 font-mono text-sm"
          />
        </Section>
      )}

      <Section title="Alors" hint="Dans l’ordre ; la première qui échoue arrête les suivantes.">
        {draft.actions.map((action, index) => (
          <div key={`${index}:${action.kind}`} className="rounded-lg border">
            <div className="flex items-center gap-1 border-b bg-muted/40 px-3 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">{index + 1}.</span>
              <span className="flex-1 text-sm font-medium">{ACTION_LABELS[action.kind]}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={index === 0}
                onClick={() => moveAction(index, -1)}
                aria-label="Monter l’action"
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={index === draft.actions.length - 1}
                onClick={() => moveAction(index, 1)}
                aria-label="Descendre l’action"
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => set({ actions: draft.actions.filter((_, i) => i !== index) })}
                aria-label="Retirer l’action"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-2 p-3">
              <ActionBody
                action={action}
                base={base}
                sourceFields={sourceFields}
                members={members}
                onChange={(next) => setAction(index, next)}
              />
            </div>
          </div>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="size-4" />
              Ajouter une action
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(ACTION_LABELS) as DraftAction['kind'][])
              .filter((k) => !(schedule && k === 'update_record'))
              .map((k) => (
                <DropdownMenuItem
                  key={k}
                  onSelect={() => set({ actions: [...draft.actions, newAction(k, base)] })}
                >
                  {ACTION_LABELS[k]}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <div className="flex items-center gap-2 border-t pt-4">
        {error !== null && <p className="mr-auto text-sm text-destructive">{error}</p>}
        {automation !== null && (
          <Button
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => void remove()}
          >
            Supprimer
          </Button>
        )}
        {automation !== null && (
          <TestRun
            base={base}
            automation={automation}
            onRan={() => setRunsTick((t) => t + 1)}
            onError={setError}
          />
        )}
        <Button onClick={() => void save()} disabled={busy || draft.actions.length === 0}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {automation === null ? 'Créer' : 'Enregistrer'}
        </Button>
      </div>

      {automation !== null && <Runs base={base} automation={automation} tick={runsTick} />}
    </div>
  )
}

function ValueRows({
  rows,
  targetFields,
  citeFields,
  onChange,
}: {
  readonly rows: readonly ValueRow[]
  readonly targetFields: readonly Field[]
  readonly citeFields: readonly Field[]
  readonly onChange: (rows: ValueRow[]) => void
}) {
  const writable = writableFields(targetFields)
  const setRow = (index: number, patch: Partial<ValueRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-1.5">
      {rows.map((row, index) => (
        <div
          key={`${index}:${row.field}`}
          className="grid grid-cols-[180px_1fr_auto_auto] items-center gap-1.5"
        >
          <FieldSelect
            fields={writable}
            value={row.field}
            onChange={(field) => setRow(index, { field })}
            label={`Champ ${index + 1}`}
          />
          <Input
            value={row.value}
            onChange={(e) => setRow(index, { value: e.target.value })}
            placeholder="Valeur, ou {{champ}}"
            aria-label={`Valeur ${index + 1}`}
            className="h-8"
          />
          <Cite
            fields={citeFields}
            onCite={(token) => setRow(index, { value: `${row.value}${token}` })}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            aria-label={`Retirer le champ ${index + 1}`}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => onChange([...rows, { field: '', value: '' }])}
      >
        <Plus className="size-3.5" />
        Champ
      </Button>
    </div>
  )
}

function ActionBody({
  action,
  base,
  sourceFields,
  members,
  onChange,
}: {
  readonly action: DraftAction
  readonly base: DescribedBase
  readonly sourceFields: readonly Field[]
  readonly members: readonly Member[]
  readonly onChange: (next: DraftAction) => void
}) {
  switch (action.kind) {
    case 'update_record':
      return (
        <ValueRows
          rows={action.values}
          targetFields={sourceFields}
          citeFields={sourceFields}
          onChange={(values) => onChange({ ...action, values })}
        />
      )
    case 'create_record': {
      const target = base.tables.find((t) => t.name === action.table)
      return (
        <>
          <Select
            value={action.table}
            onValueChange={(table) => onChange({ ...action, table, values: [] })}
          >
            <SelectTrigger aria-label="Table où créer" className="h-8 w-64">
              <SelectValue placeholder="Choisir une table" />
            </SelectTrigger>
            <SelectContent>
              {base.tables.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  dans {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ValueRows
            rows={action.values}
            targetFields={target?.fields ?? []}
            citeFields={sourceFields}
            onChange={(values) => onChange({ ...action, values })}
          />
        </>
      )
    }
    case 'notify': {
      const people = members.filter((m) => !m.disabled)
      return (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {people.map((m) => (
              <label
                key={m.id}
                htmlFor={`notify-${m.id}`}
                className="flex items-center gap-1.5 text-sm"
              >
                <Checkbox
                  id={`notify-${m.id}`}
                  checked={action.users.includes(m.id)}
                  onCheckedChange={(v) =>
                    onChange({
                      ...action,
                      users:
                        v === true
                          ? [...action.users, m.id]
                          : action.users.filter((u) => u !== m.id),
                    })
                  }
                />
                {m.display_name || m.email}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-[180px_1fr] items-center gap-1.5">
            <span className="text-sm text-muted-foreground">et la personne du champ</span>
            <FieldSelect
              fields={sourceFields.filter((f) => f.kind === 'user')}
              value={action.userField}
              onChange={(userField) => onChange({ ...action, userField })}
              placeholder="Aucun champ"
              label="Champ personne à prévenir"
            />
          </div>
          <div className="flex items-start gap-1.5">
            <Textarea
              value={action.message}
              onChange={(e) => onChange({ ...action, message: e.target.value })}
              placeholder="{{nom}} est terminée"
              aria-label="Message"
              rows={2}
              className="min-h-0 flex-1 resize-none text-sm"
            />
            <Cite
              fields={sourceFields}
              onCite={(token) => onChange({ ...action, message: `${action.message}${token}` })}
            />
          </div>
        </>
      )
    }
    case 'webhook':
      return (
        <>
          <Input
            value={action.url}
            onChange={(e) => onChange({ ...action, url: e.target.value })}
            aria-label="Adresse du webhook"
            className="h-8 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Un <code>POST</code> JSON : l’automatisation, le déclencheur et la ligne. Adresse
            <code> https</code> publique seulement ; 10 secondes au plus.
          </p>
        </>
      )
    case 'slack':
      return (
        <SlackAction base={base} action={action} sourceFields={sourceFields} onChange={onChange} />
      )
  }
}

/** « Envoyer sur Slack » : a connection of the base, and a message composed from the row. */
function SlackAction({
  base,
  action,
  sourceFields,
  onChange,
}: {
  readonly base: DescribedBase
  readonly action: Extract<DraftAction, { kind: 'slack' }>
  readonly sourceFields: readonly Field[]
  readonly onChange: (next: DraftAction) => void
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
        Aucun canal Slack n’est connecté à cette base : connectez-en un dans « Intégrations ».
      </p>
    )
  }
  return (
    <>
      <Select
        value={action.integration}
        onValueChange={(integration) => onChange({ ...action, integration })}
      >
        <SelectTrigger aria-label="Canal Slack" className="h-8 w-64">
          <SelectValue placeholder="Choisir un canal" />
        </SelectTrigger>
        <SelectContent>
          {(integrations ?? []).map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-start gap-1.5">
        <Textarea
          value={action.message}
          onChange={(e) => onChange({ ...action, message: e.target.value })}
          placeholder="{{nom}} vient d’être livrée"
          aria-label="Message Slack"
          rows={2}
          className="min-h-0 flex-1 resize-none text-sm"
        />
        <Cite
          fields={sourceFields}
          onCite={(token) => onChange({ ...action, message: `${action.message}${token}` })}
        />
      </div>
    </>
  )
}

/** « Tester » : an ordinary run, on a row chosen among the first of the table. */
function TestRun({
  base,
  automation,
  onRan,
  onError,
}: {
  readonly base: DescribedBase
  readonly automation: Automation
  readonly onRan: () => void
  readonly onError: (message: string | null) => void
}) {
  const table = base.tables.find((t) => t.id === automation.trigger.table) ?? null
  const [rows, setRows] = useState<ReadonlyArray<{ id: string; label: string }> | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (record: string | null) => {
    setBusy(true)
    onError(null)
    try {
      await api.runAutomation(automation.id, record)
      onRan()
    } catch (e) {
      onError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const loadRows = async () => {
    if (table === null || rows !== null) return
    const page = await api.list(table, { limit: 20 }).catch(() => null)
    const display = table.display_field
    setRows(
      (page?.data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r._id),
        label: display === null ? String(r._id).slice(0, 8) : String(r[display] ?? '—'),
      })),
    )
  }

  if (table === null) {
    return (
      <Button variant="outline" disabled={busy} onClick={() => void run(null)} className="gap-1.5">
        <Play className="size-4" />
        Tester
      </Button>
    )
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && void loadRows()}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy} className="gap-1.5">
          <Play className="size-4" />
          Tester sur une ligne
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
        {rows === null && (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {rows?.map((r) => (
          <DropdownMenuItem key={r.id} onSelect={() => void run(r.id)}>
            <span className="truncate">{r.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The runs, newest first, action by action — read again while one is under way. */
function Runs({
  base,
  automation,
  tick,
}: {
  readonly base: DescribedBase
  readonly automation: Automation
  readonly tick: number
}) {
  const [runs, setRuns] = useState<readonly AutomationRun[] | null>(null)
  const load = useCallback(async () => {
    setRuns(await api.automationRuns(base.name, automation.id).catch(() => []))
  }, [base.name, automation.id])

  useEffect(() => {
    void tick
    void load()
  }, [load, tick])

  const pending = useMemo(
    () => (runs ?? []).some((r) => r.status === 'queued' || r.status === 'running'),
    [runs],
  )
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => void load(), 2000)
    return () => clearInterval(timer)
  }, [pending, load])

  return (
    <Section title="Exécutions" hint="Les 50 dernières, gardées 30 jours.">
      {runs === null && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {runs?.length === 0 && (
        <p className="text-sm text-muted-foreground">Pas encore d’exécution.</p>
      )}
      <div className="divide-y rounded-lg border">
        {runs?.map((run) => (
          <div key={run.id} className="px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <RunDot status={run.status} />
              <span className="font-medium">{runSentence(run)}</span>
              <span className="text-xs text-muted-foreground">
                · {TRIGGER_OF_RUN[run.trigger] ?? run.trigger} · {relativeTime(run.queued_at)}
              </span>
            </div>
            {run.steps.length > 0 && (
              <ol className="mt-1 space-y-0.5 pl-4 text-xs text-muted-foreground">
                {run.steps.map((step, i) => (
                  <li
                    key={`${run.id}:${i}`}
                    className={cn(step.status === 'failed' && 'text-destructive')}
                  >
                    {i + 1}. {ACTION_LABELS[step.action as DraftAction['kind']] ?? step.action} —{' '}
                    {step.status === 'succeeded' ? 'fait' : `échec (${step.error_code ?? '?'})`}
                    {step.detail !== undefined && step.status === 'failed'
                      ? ` : ${step.detail}`
                      : ''}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}
