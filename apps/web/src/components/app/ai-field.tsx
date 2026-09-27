'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Choice } from '@/components/ui/choice'
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
import { Hint } from '@/components/ui/tooltip'
import { type AiFieldInput, type AiFieldStatus, type Field, api } from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { reasonFor, sentenceFor } from '@/lib/messages'
import {
  DAY_STEPS,
  DEFAULT_SCHEDULE,
  type Frequency,
  HOUR_STEPS,
  MINUTE_STEPS,
  type ScheduleDraft,
  WEEKDAYS,
  cronOf,
  describe,
  draftOf,
  localTimezone,
  paceOf,
} from '@/lib/schedule'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  CircleDashed,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * The AI option of a field, as a person sets it — chapter 12 §1.5, chapter 04 §7 bis.
 *
 * The AI is not a type: a text, an address, a number, a choice, a yes-or-no or a date can
 * each be filled by a model, and the option is one switch in the field's form. Switched
 * on, the form below appears; switched off, the field is an ordinary one again.
 *
 * Three things, in the order one thinks of them: what the model is asked for each row
 * (a prompt citing columns), when it runs (as soon as a row exists, again whenever a cited
 * column changes, and on a schedule if wanted), and the consent that the cited values
 * leave for the provider. The consent is a box to tick every time the prompt is saved: the
 * columns cited may have changed.
 *
 * Columns are cited `{{Libellé}}` here — what a person reads. The server keeps them under
 * their physical names, which survive a rename, and gives them back that way; the screen
 * turns them back into labels before showing them.
 */

/** The types the AI option is offered to — the kernel's `AI_KINDS`. */
export const AI_KINDS: readonly string[] = [
  'short_text',
  'long_text',
  'url',
  'number',
  'select',
  'boolean',
  'date',
]

export const acceptsAi = (kind: string | undefined) => kind !== undefined && AI_KINDS.includes(kind)

/** What the model's answer must be, said to the author of a field that is not free text. */
const ANSWER: Readonly<Record<string, string>> = {
  url: 'une adresse web',
  number: $t('un nombre'),
  select: $t('une des valeurs de la liste'),
  boolean: $t('oui ou non'),
  date: $t('une date'),
}

/** The switch that makes a field computed by the AI. */
export function AiToggle({
  checked,
  onChange,
  disabled,
}: {
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  readonly disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
      <Sparkles className="size-4 shrink-0 text-violet-500" />
      <label htmlFor="field-ai" className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{$t('IA')}</span>
        <span className="block text-xs text-muted-foreground">
          {$t('Le champ est rempli par l’IA, ligne par ligne, à partir d’une consigne.')}
        </span>
      </label>
      <Switch id="field-ai" checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

export interface AiDraft {
  /** Columns cited by label, `{{Notes}}`. */
  readonly prompt: string
  readonly refresh: 'if_empty' | 'schedule'
  readonly schedule: ScheduleDraft
  /** The zone the schedule is read in: the author's, or the one it was saved with. */
  readonly timezone: string
  readonly consent: boolean
}

export function emptyAiDraft(): AiDraft {
  return {
    prompt: '',
    refresh: 'if_empty',
    schedule: DEFAULT_SCHEDULE,
    timezone: localTimezone(),
    consent: false,
  }
}

const REFERENCE = /\{\{\s*([^{}]+?)\s*\}\}/g

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** The field a citation designates — by label, as typed, or by physical name. */
function resolve(raw: string, fields: readonly Field[]): Field | undefined {
  return fields.find((f) => f.name === raw) ?? fields.find((f) => fold(f.label) === fold(raw))
}

/** The citations of a prompt, each with the field it designates, or none. */
function citationsOf(prompt: string, fields: readonly Field[]) {
  const seen = new Map<string, Field | null>()
  for (const match of prompt.matchAll(REFERENCE)) {
    const raw = match[1]
    if (!seen.has(raw)) seen.set(raw, resolve(raw, fields) ?? null)
  }
  return [...seen].map(([raw, field]) => ({ raw, field }))
}

/** The draft an existing field opens with: its prompt in labels, its schedule read back. */
export function aiDraftOf(status: AiFieldStatus, fields: readonly Field[]): AiDraft {
  const prompt = status.prompt.replace(REFERENCE, (whole, name: string) => {
    const label =
      fields.find((f) => f.name === name)?.label ?? status.cited.find((c) => c.name === name)?.label
    return label === undefined ? whole : `{{${label}}}`
  })
  return {
    prompt,
    refresh: status.refresh.mode,
    schedule: status.refresh.mode === 'schedule' ? draftOf(status.refresh.cron) : DEFAULT_SCHEDULE,
    timezone: status.refresh.timezone ?? localTimezone(),
    // Never carried over: saving is consenting again.
    consent: false,
  }
}

export function aiInputOf(draft: AiDraft): AiFieldInput {
  return {
    prompt: draft.prompt.trim(),
    refresh:
      draft.refresh === 'schedule'
        ? { mode: 'schedule', cron: cronOf(draft.schedule), timezone: draft.timezone }
        : { mode: 'if_empty' },
    consent: draft.consent,
  }
}

/** Whether the draft can be sent: the server judges the rest, and says why. */
export function aiReady(draft: AiDraft, fields: readonly Field[]): boolean {
  if (draft.prompt.trim() === '' || !draft.consent) return false
  if (citationsOf(draft.prompt, fields).some((c) => c.field === null)) return false
  if (draft.refresh === 'schedule') {
    if (draft.schedule.frequency === 'weekly' && draft.schedule.weekdays.length === 0) return false
    if (draft.schedule.frequency === 'custom' && draft.schedule.cron.trim() === '') return false
  }
  return true
}

/** Whether two drafts ask for the same thing — the consent aside. */
export function sameAi(a: AiDraft, b: AiDraft): boolean {
  const x = aiInputOf(a)
  const y = aiInputOf(b)
  return (
    x.prompt === y.prompt &&
    x.refresh.mode === y.refresh.mode &&
    (x.refresh.cron ?? null) === (y.refresh.cron ?? null) &&
    (x.refresh.timezone ?? null) === (y.refresh.timezone ?? null)
  )
}

export function AiFieldForm({
  value,
  onChange,
  fields,
  kind,
  disabled,
}: {
  readonly value: AiDraft
  readonly onChange: (next: AiDraft) => void
  /** The columns the prompt may cite: the table's, the field itself excluded. */
  readonly fields: readonly Field[]
  /** The field's type: what the answer is read into. */
  readonly kind?: string
  readonly disabled?: boolean
}) {
  const cited = citationsOf(value.prompt, fields)
  const known = cited.filter((c) => c.field !== null).map((c) => c.field?.label ?? '')

  return (
    <div className="space-y-5">
      <PromptEditor
        value={value.prompt}
        onChange={(prompt) => onChange({ ...value, prompt })}
        fields={fields}
        disabled={disabled}
      />
      {kind !== undefined && ANSWER[kind] !== undefined && (
        <p className="-mt-3 text-xs text-muted-foreground">
          {$t(
            'La réponse doit être {answer} : le modèle en est averti, et une réponse qui n’en contient pas laisse la cellule vide.',
            { answer: ANSWER[kind] },
          )}
        </p>
      )}

      <RefreshEditor value={value} onChange={onChange} disabled={disabled} />

      <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
        <Checkbox
          id="ai-consent"
          checked={value.consent}
          onCheckedChange={(next) => onChange({ ...value, consent: next === true })}
          disabled={disabled}
          className="mt-0.5"
        />
        <label htmlFor="ai-consent" className="cursor-pointer leading-snug">
          {$t(
            'J’accepte que, pour chaque ligne, les valeurs{value} soient envoyées au fournisseur d’IA configuré sur cette instance.',
            {
              value:
                known.length === 0
                  ? $t(' des colonnes citées')
                  : $t(' de {columns}', {
                      columns: known.map((k) => $t('« {name} »', { name: k })).join(', '),
                    }),
            },
          )}
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {$t('Un appel par ligne et par calcul, journalisé et plafonné par heure.')}
          </span>
        </label>
      </div>
    </div>
  )
}

function PromptEditor({
  value,
  onChange,
  fields,
  disabled,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly fields: readonly Field[]
  readonly disabled?: boolean
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  /** Where the caret goes once the menu has closed: just after what was inserted. */
  const caret = useRef<number | null>(null)
  const cited = citationsOf(value, fields)

  // At the caret, or in place of the selection: where the person was typing.
  const insert = (field: Field) => {
    const box = area.current
    const token = `{{${field.label}}}`
    const start = box?.selectionStart ?? value.length
    const end = box?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + token + value.slice(end))
    caret.current = start + token.length
  }

  // The menu hands the focus back to its button when it closes; after an insertion the
  // person is writing the prompt, so it goes back to the prompt, caret after the column.
  const restore = (event: Event) => {
    const at = caret.current
    if (at === null) return
    event.preventDefault()
    caret.current = null
    requestAnimationFrame(() => {
      area.current?.focus()
      area.current?.setSelectionRange(at, at)
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-2">
        <label htmlFor="ai-prompt" className="text-sm text-muted-foreground">
          {$t('Consigne')}
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled || fields.length === 0}>
              <Plus className="size-3.5" />
              {$t('Insérer une colonne')}
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-72 overflow-y-auto"
            onCloseAutoFocus={restore}
          >
            {fields.map((f) => (
              <DropdownMenuItem key={f.name} onSelect={() => insert(f)}>
                <FieldIcon kind={f.kind} />
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Textarea
        id="ai-prompt"
        ref={area}
        value={value}
        rows={5}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={$t('Résume {{Notes}} en une phrase, sur un ton neutre.')}
        className="font-mono text-[13px] leading-relaxed"
      />
      {cited.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{$t('Colonnes citées :')}</span>
          {cited.map((c) =>
            c.field === null ? (
              <Hint key={c.raw} label={$t('Aucune colonne lisible de la table ne porte ce nom')}>
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
                  {$t('{raw} — inconnue', { raw: c.raw })}
                </span>
              </Hint>
            ) : (
              <span key={c.raw} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                <FieldIcon kind={c.field.kind} className="size-3" />
                {c.field.label}
              </span>
            ),
          )}
        </div>
      )}
      <p className="text-xs leading-snug text-muted-foreground">
        {$t(
          'Ce que le modèle doit écrire pour chaque ligne. Chaque {{colonne}} est remplacée par la valeur de la ligne ; la réponse est écrite dans la cellule, lue dans le type du champ. Quand l’une de ces colonnes change, la cellule est recalculée.',
        )}
      </p>
    </div>
  )
}

const FREQUENCIES: ReadonlyArray<{ readonly value: Frequency; readonly label: string }> = [
  { value: 'minutes', label: $t('Toutes les N minutes') },
  { value: 'hours', label: $t('Toutes les N heures') },
  { value: 'days', label: $t('Tous les jours') },
  { value: 'weekly', label: $t('Chaque semaine') },
  { value: 'monthly', label: $t('Chaque mois') },
  { value: 'custom', label: $t('Expression cron (avancé)') },
]

function RefreshEditor({
  value,
  onChange,
  disabled,
}: {
  readonly value: AiDraft
  readonly onChange: (next: AiDraft) => void
  readonly disabled?: boolean
}) {
  const schedule = value.schedule
  const set = (patch: Partial<ScheduleDraft>) =>
    onChange({ ...value, schedule: { ...schedule, ...patch } })

  const choice = (mode: AiDraft['refresh'], title: string, hint: string, Icon: typeof Plus) => (
    <label
      className={cn(
        'flex flex-1 cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40',
        value.refresh === mode
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:bg-muted/60',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        name="ai-refresh"
        value={mode}
        checked={value.refresh === mode}
        disabled={disabled}
        onChange={() => onChange({ ...value, refresh: mode })}
        className="sr-only"
      />
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
      </span>
    </label>
  )

  const time = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
  const setTime = (text: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(text)
    if (match !== null) set({ hour: Number(match[1]), minute: Number(match[2]) })
  }

  const needsTime =
    schedule.frequency === 'days' ||
    schedule.frequency === 'weekly' ||
    schedule.frequency === 'monthly'
  const pace = paceOf(schedule)

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm text-muted-foreground">{$t('Rafraîchissement')}</legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        {choice(
          'if_empty',
          $t('Quand une colonne citée change'),
          $t(
            'Chaque ligne est calculée dès qu’elle existe, puis de nouveau dès qu’une colonne citée change.',
          ),
          CircleDashed,
        )}
        {choice(
          'schedule',
          $t('Selon un planning'),
          $t('En plus, toutes les lignes sont recalculées à intervalles réguliers.'),
          CalendarClock,
        )}
      </div>

      {value.refresh === 'schedule' && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={schedule.frequency}
              onValueChange={(next) => {
                const frequency = next as Frequency
                // Each frequency opens on an N it offers; the expression opens on the
                // one the presets made, so switching to it shows what they meant.
                const every =
                  frequency === 'minutes'
                    ? MINUTE_STEPS[0]
                    : frequency === 'hours'
                      ? HOUR_STEPS[0]
                      : frequency === 'days'
                        ? DAY_STEPS[0]
                        : schedule.every
                set({
                  frequency,
                  every,
                  ...(frequency === 'custom' ? { cron: cronOf(schedule) } : {}),
                })
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 w-56" aria-label={$t('Fréquence')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(schedule.frequency === 'minutes' ||
              schedule.frequency === 'hours' ||
              schedule.frequency === 'days') && (
              <Choice
                value={String(schedule.every)}
                onValueChange={(n) => set({ every: Number(n) })}
                options={(schedule.frequency === 'minutes'
                  ? MINUTE_STEPS
                  : schedule.frequency === 'hours'
                    ? HOUR_STEPS
                    : DAY_STEPS
                ).map((n) => ({
                  value: String(n),
                  label:
                    schedule.frequency === 'minutes'
                      ? `${n} minutes`
                      : schedule.frequency === 'hours'
                        ? n === 1
                          ? $t('chaque heure')
                          : `${n} heures`
                        : n === 1
                          ? $t('chaque jour')
                          : $t('tous les {n} jours', { n }),
                }))}
                aria-label={$t('Intervalle')}
                disabled={disabled}
                className="w-40"
              />
            )}

            {schedule.frequency === 'hours' && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {$t('à la minute')}
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={schedule.minute}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isInteger(n) && n >= 0 && n <= 59) set({ minute: n })
                  }}
                  disabled={disabled}
                  className="h-8 w-16"
                  aria-label={$t('Minute de l’heure')}
                />
              </span>
            )}

            {schedule.frequency === 'monthly' && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {$t('le')}
                <Choice
                  value={String(schedule.dayOfMonth)}
                  onValueChange={(d) => set({ dayOfMonth: Number(d) })}
                  options={Array.from({ length: 28 }, (_, i) => ({
                    value: String(i + 1),
                    label: i === 0 ? '1er' : String(i + 1),
                  }))}
                  aria-label={$t('Jour du mois')}
                  disabled={disabled}
                  className="w-24"
                />
              </span>
            )}

            {needsTime && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                à
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={disabled}
                  className="h-8 w-28"
                  aria-label={$t('Heure')}
                />
              </span>
            )}
          </div>

          {schedule.frequency === 'days' && schedule.every === 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="ai-workdays"
                checked={schedule.workdays}
                onCheckedChange={(next) => set({ workdays: next === true })}
                disabled={disabled}
              />
              <label htmlFor="ai-workdays" className="cursor-pointer">
                {$t('Du lundi au vendredi seulement')}
              </label>
            </div>
          )}

          {schedule.frequency === 'weekly' && (
            <fieldset className="flex gap-1">
              <legend className="sr-only">{$t('Jours de la semaine')}</legend>
              {WEEKDAYS.map((d) => {
                const on = schedule.weekdays.includes(d.value)
                return (
                  <Hint key={d.value} label={d.long}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={disabled}
                      onClick={() =>
                        set({
                          weekdays: on
                            ? schedule.weekdays.filter((v) => v !== d.value)
                            : [...schedule.weekdays, d.value],
                        })
                      }
                      className={cn(
                        'size-8 rounded-full border text-xs font-medium transition-colors',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                      )}
                    >
                      {d.short}
                    </button>
                  </Hint>
                )
              })}
            </fieldset>
          )}

          {schedule.frequency === 'custom' && (
            <CronInput
              value={schedule.cron}
              onChange={(cron) => set({ cron })}
              disabled={disabled}
            />
          )}

          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{describe(schedule)}</span>
              <span className="text-muted-foreground">
                {' '}
                {$t('· fuseau {timezone}', { timezone: value.timezone })}
              </span>
            </p>
            <SchedulePreview cron={cronOf(schedule)} timezone={value.timezone} />
            {pace !== null && (
              <p className="text-xs text-muted-foreground">
                {$t('≈ {pace}. Chaque recalcul appelle le modèle une fois par ligne de la table.', {
                  pace,
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </fieldset>
  )
}

const CRON_PARTS = [
  { name: 'minute', range: '0–59' },
  { name: 'heure', range: '0–23' },
  { name: $t('jour du mois'), range: '1–31' },
  { name: 'mois', range: '1–12' },
  { name: $t('jour de semaine'), range: $t('0–7, 0 et 7 = dimanche') },
] as const

function CronInput({
  value,
  onChange,
  disabled,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly disabled?: boolean
}) {
  const [help, setHelp] = useState(false)
  const parts = value
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '')
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="0 8 * * 1-5"
          className="h-8 max-w-56 font-mono"
          aria-label={$t('Expression cron')}
          spellCheck={false}
        />
        <Button variant="link" size="sm" className="px-0" onClick={() => setHelp(!help)}>
          {help ? $t('Masquer l’aide') : $t('Aide')}
        </Button>
      </div>
      {help && (
        <div className="space-y-2 rounded-md border bg-background p-3 text-xs">
          {/* The expression as typed, each of its five parts over what it means. */}
          <table className="w-full table-fixed border-collapse text-center">
            <tbody>
              <tr className="font-mono text-sm">
                {CRON_PARTS.map((part, i) => (
                  <td key={part.name} className="border-b pb-1">
                    {parts[i] ?? '·'}
                  </td>
                ))}
              </tr>
              <tr className="align-top">
                {CRON_PARTS.map((part) => (
                  <td key={part.name} className="px-1 pt-1">
                    {part.name}
                    <span className="block text-muted-foreground">{part.range}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="text-muted-foreground">
            <code>*</code> {$t('toutes les valeurs ·')} <code>1,15</code> {$t('une liste ·')}{' '}
            <code>1-5</code> {$t('un intervalle ·')} <code>*/6</code> {$t('un pas.')}
          </p>
          <ul className="space-y-0.5">
            {[
              ['0 8 * * 1-5', $t('du lundi au vendredi à 8 h')],
              ['*/30 * * * *', $t('toutes les 30 minutes')],
              ['0 */6 * * *', $t('toutes les 6 heures')],
              ['0 9 1 * *', $t('le 1er de chaque mois à 9 h')],
              ['0 7 * * 1', $t('chaque lundi à 7 h')],
            ].map(([cron, meaning]) => (
              <li key={cron}>
                <button
                  type="button"
                  className="font-mono text-primary hover:underline"
                  onClick={() => onChange(cron)}
                  disabled={disabled}
                >
                  {cron}
                </button>{' '}
                <span className="text-muted-foreground">— {meaning}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            {$t('Au plus un recalcul toutes les 15 minutes.')}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * The next runs, from the server — the one that will run them, so what is shown is what
 * will happen, summer time included. A refusal is shown in place, as the person types.
 */
function SchedulePreview({ cron, timezone }: { readonly cron: string; readonly timezone: string }) {
  const [state, setState] = useState<{ runs?: readonly string[]; error?: string }>({})

  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      api
        .previewSchedule(cron, timezone)
        .then((result) => current && setState({ runs: result.runs }))
        .catch((e) => current && setState({ error: reasonFor(e) }))
    }, 300)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [cron, timezone])

  const format = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale(), {
        timeZone: timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [timezone],
  )

  if (state.error !== undefined) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
        <AlertTriangle className="size-3.5" />
        {state.error}
      </p>
    )
  }
  if (state.runs === undefined) return null
  return (
    <p className="text-xs text-muted-foreground">
      {$t('Prochains passages : {map}', {
        map: state.runs.map((r) => format.format(new Date(r))).join(' · '),
      })}
    </p>
  )
}

const when = (iso: string | null) =>
  iso === null
    ? null
    : new Date(iso).toLocaleString(intlLocale(), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })

/** How the field is doing — what the edit dialog opens with. */
export function AiStatusSummary({ status }: { readonly status: AiFieldStatus }) {
  const lastRun = when(status.last_run_at)
  const next = when(status.next_sweep_at)
  return (
    <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <p>
        {$tp(status.computed_count, '{count} cellule calculée', '{count} cellules calculées')}
        {lastRun !== null && $t(' · dernier passage le {lastRun}', { lastRun })}
        {status.refresh.mode === 'schedule' &&
          next !== null &&
          $t(' · prochain recalcul le {next}', { next })}
      </p>
      {status.sweeping && <p>{$t('Recalcul de toutes les lignes en cours…')}</p>}
      {status.last_error !== null && (
        <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>
            {$t('Dernier incident{value} : {last_error}', {
              value: status.last_error_at !== null && ` (${when(status.last_error_at)})`,
              last_error: sentenceFor(status.last_error),
            })}
          </span>
        </p>
      )}
    </div>
  )
}
