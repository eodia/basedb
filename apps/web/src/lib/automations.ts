import type {
  Automation,
  AutomationAction,
  AutomationInput,
  AutomationRun,
  AutomationSchedule,
  AutomationTriggerKind,
  DescribedBase,
  Field,
} from '@/lib/api/client'

/**
 * Automations as the screen edits them — chapter 17. A draft holds what the form shows —
 * tables by name, values as rows to add and remove — and turns into what the API saves.
 * Kept apart from the screen so that the conversion can be tested.
 */

export interface ValueRow {
  readonly field: string
  readonly value: string
}

export type DraftAction =
  | { readonly kind: 'update_record'; readonly values: readonly ValueRow[] }
  | { readonly kind: 'create_record'; readonly table: string; readonly values: readonly ValueRow[] }
  | {
      readonly kind: 'notify'
      readonly users: readonly string[]
      readonly userField: string
      readonly message: string
    }
  | { readonly kind: 'webhook'; readonly url: string }
  | { readonly kind: 'slack'; readonly integration: string; readonly message: string }

export interface Draft {
  readonly label: string
  readonly description: string
  readonly enabled: boolean
  readonly trigger: {
    readonly kind: AutomationTriggerKind
    /** The table's name. */
    readonly table: string
    readonly fields: readonly string[]
    readonly schedule: AutomationSchedule
  }
  readonly condition: string
  readonly actions: readonly DraftAction[]
}

export const TRIGGER_LABELS: Readonly<Record<AutomationTriggerKind, string>> = {
  record_created: 'Une ligne est créée',
  record_updated: 'Une ligne est modifiée',
  schedule: 'À heure fixe',
  button: 'On clique sur un bouton',
}

export const ACTION_LABELS: Readonly<Record<DraftAction['kind'], string>> = {
  update_record: 'Modifier la ligne',
  create_record: 'Créer une ligne',
  notify: 'Prévenir quelqu’un',
  webhook: 'Appeler un webhook',
  slack: 'Envoyer sur Slack',
}

const DEFAULT_SCHEDULE: AutomationSchedule = {
  every: 'day',
  at: '09:00',
  weekday: 1,
  timezone: 'Europe/Paris',
}

/** The fields an action may write: neither computed, nor a button, nor read-only. */
export const writableFields = (fields: readonly Field[]) =>
  fields.filter(
    (f) =>
      f.system !== true &&
      f.read_only !== true &&
      f.ai !== true &&
      !['formula', 'lookup', 'rollup', 'count', 'autonumber', 'button'].includes(f.kind),
  )

export function emptyDraft(base: DescribedBase): Draft {
  const table = base.tables[0]?.name ?? ''
  return {
    label: 'Nouvelle automatisation',
    description: '',
    enabled: true,
    trigger: { kind: 'record_created', table, fields: [], schedule: DEFAULT_SCHEDULE },
    condition: '',
    actions: [],
  }
}

const rowsOf = (values: Readonly<Record<string, unknown>>): ValueRow[] =>
  Object.entries(values).map(([field, value]) => ({
    field,
    value: typeof value === 'string' ? value : value === null ? '' : JSON.stringify(value),
  }))

const valuesOf = (rows: readonly ValueRow[]): Record<string, unknown> =>
  Object.fromEntries(rows.filter((r) => r.field !== '').map((r) => [r.field, r.value]))

/** An automation as the form shows it. */
export function draftOf(automation: Automation, base: DescribedBase): Draft {
  const nameOf = (id: string | null) => base.tables.find((t) => t.id === id)?.name ?? ''
  return {
    label: automation.label,
    description: automation.description ?? '',
    enabled: automation.enabled,
    trigger: {
      kind: automation.trigger.kind,
      table: nameOf(automation.trigger.table),
      fields: automation.trigger.fields,
      schedule: automation.trigger.schedule ?? DEFAULT_SCHEDULE,
    },
    condition: automation.condition ?? '',
    actions: automation.actions.map((a): DraftAction => {
      switch (a.kind) {
        case 'update_record':
          return { kind: a.kind, values: rowsOf(a.values) }
        case 'create_record':
          return { kind: a.kind, table: nameOf(a.table), values: rowsOf(a.values) }
        case 'notify':
          return { kind: a.kind, users: a.users, userField: a.user_field ?? '', message: a.message }
        case 'webhook':
          return { kind: a.kind, url: a.url }
        case 'slack':
          return { kind: a.kind, integration: a.integration, message: a.message }
      }
    }),
  }
}

/** What the API saves. */
export function inputOf(draft: Draft): AutomationInput {
  const schedule = draft.trigger.kind === 'schedule'
  return {
    label: draft.label.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    enabled: draft.enabled,
    trigger: {
      kind: draft.trigger.kind,
      table: schedule ? null : draft.trigger.table,
      fields: draft.trigger.kind === 'record_updated' ? draft.trigger.fields : [],
      schedule: schedule ? draft.trigger.schedule : null,
    },
    condition: schedule || draft.condition.trim() === '' ? null : draft.condition.trim(),
    actions: draft.actions.map((a): AutomationAction => {
      switch (a.kind) {
        case 'update_record':
          return { kind: a.kind, values: valuesOf(a.values) }
        case 'create_record':
          return { kind: a.kind, table: a.table, values: valuesOf(a.values) }
        case 'notify':
          return {
            kind: a.kind,
            users: a.users,
            user_field: a.userField === '' ? null : a.userField,
            message: a.message,
          }
        case 'webhook':
          return { kind: a.kind, url: a.url.trim() }
        case 'slack':
          return { kind: a.kind, integration: a.integration, message: a.message }
      }
    }),
  }
}

/** A new action of a kind, preset on what the trigger's table offers. */
export function newAction(kind: DraftAction['kind'], base: DescribedBase): DraftAction {
  switch (kind) {
    case 'update_record':
      return { kind, values: [{ field: '', value: '' }] }
    case 'create_record':
      return { kind, table: base.tables[0]?.name ?? '', values: [{ field: '', value: '' }] }
    case 'notify':
      return { kind, users: [], userField: '', message: '' }
    case 'webhook':
      return { kind, url: 'https://' }
    case 'slack':
      return { kind, integration: '', message: '' }
  }
}

const RUN_REASONS: Readonly<Record<string, string>> = {
  condition_fausse: 'la condition n’était pas remplie',
  ligne_introuvable: 'la ligne n’existe plus',
  desactivee: 'l’automatisation était désactivée',
  supprimee: 'l’automatisation a été supprimée',
  proprietaire_inactif: 'son propriétaire n’a plus de compte actif',
  debit: 'plus de 100 exécutions dans l’heure',
}

/** A run in a sentence: what happened, and why not. */
export function runSentence(run: AutomationRun): string {
  switch (run.status) {
    case 'queued':
      return 'En attente'
    case 'running':
      return 'En cours'
    case 'succeeded':
      return 'Réussie'
    case 'skipped':
      return `Écartée : ${RUN_REASONS[run.reason ?? ''] ?? run.reason ?? 'raison inconnue'}`
    case 'failed':
      return `Échouée${run.error_code === null ? '' : ` (${run.error_code})`}`
  }
}

export const TRIGGER_OF_RUN: Readonly<Record<string, string>> = {
  record_created: 'ligne créée',
  record_updated: 'ligne modifiée',
  schedule: 'horloge',
  button: 'bouton',
  test: 'essai',
}

/** A button's address, composed from the row the reader sees: a hidden field is empty. */
export function buttonUrl(
  template: string,
  row: Readonly<Record<string, unknown>>,
  fields: readonly Field[],
): string | null {
  const text = template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, name: string) => {
    if (name === '_id') return encodeURIComponent(String(row._id ?? ''))
    const field = fields.find((f) => f.name === name)
    const value = row[name]
    if (field === undefined || value === null || value === undefined) return ''
    if (field.kind === 'select') {
      return encodeURIComponent(
        field.options?.find((o) => o.value === value)?.label ?? String(value),
      )
    }
    if (typeof value === 'object') {
      return encodeURIComponent(String((value as { display?: unknown }).display ?? ''))
    }
    return encodeURIComponent(String(value))
  })
  return /^(https?:\/\/|mailto:)/i.test(text) ? text : null
}
