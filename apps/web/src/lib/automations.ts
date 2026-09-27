import type {
  Automation,
  AutomationAiAnswer,
  AutomationDefinition,
  AutomationInput,
  AutomationPath,
  AutomationRun,
  AutomationSchedule,
  AutomationStep,
  AutomationTriggerKind,
  DescribedBase,
  Field,
  Member,
} from '@/lib/api/client'
import { compileMatcher } from '@/lib/evaluate'
import { check } from '@/lib/expression'
import { $t, $tp } from '@/lib/i18n'
import { sentenceFor } from '@/lib/messages'

/**
 * Automations as the screen edits them — chapter 17. A draft holds what the editor shows —
 * a flow of steps, branches holding paths holding steps, tables by name, values as rows
 * to add and remove — and turns into what the API saves. Kept apart from the screen so
 * that the conversion, the edits of the tree and what each step may cite can be tested.
 */

export interface ValueRow {
  readonly field: string
  readonly value: string
}

/** The triggering row, as a step's `record` names it. */
export const TRIGGER_ROW = 'trigger'

export type DraftStep =
  | {
      readonly id: string
      readonly kind: 'update_record'
      /** `trigger`, or the step whose row it modifies. */
      readonly record: string
      readonly values: readonly ValueRow[]
    }
  | {
      readonly id: string
      readonly kind: 'create_record'
      /** The table's name. */
      readonly table: string
      readonly values: readonly ValueRow[]
    }
  | {
      readonly id: string
      readonly kind: 'find_record'
      readonly table: string
      readonly filter: string
      /** `champ`, `-champ`, or empty. */
      readonly sort: string
    }
  | {
      readonly id: string
      readonly kind: 'notify'
      /** `trigger`, a step, or empty: no row. */
      readonly record: string
      readonly users: readonly string[]
      readonly userField: string
      readonly message: string
    }
  | { readonly id: string; readonly kind: 'webhook'; readonly record: string; readonly url: string }
  | {
      readonly id: string
      readonly kind: 'slack'
      readonly integration: string
      readonly message: string
    }
  | {
      readonly id: string
      readonly kind: 'ai'
      readonly prompt: string
      readonly answer: AutomationAiAnswer
      /** The choices of a `select` answer, one per line as typed — blanks dropped on saving. */
      readonly options: readonly string[]
      /** Given again whenever the prompt changes: what it cites may have changed. */
      readonly consent: boolean
    }
  | { readonly id: string; readonly kind: 'branch'; readonly paths: readonly DraftPath[] }

export interface DraftPath {
  readonly id: string
  readonly label: string
  /** Taken when no path before it was: the last one only. */
  readonly otherwise: boolean
  readonly record: string
  readonly condition: string
  readonly steps: readonly DraftStep[]
}

export type StepKind = DraftStep['kind']

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
  readonly steps: readonly DraftStep[]
}

export const TRIGGER_LABELS: Readonly<Record<AutomationTriggerKind, string>> = {
  record_created: $t('Une ligne est créée'),
  record_updated: $t('Une ligne est modifiée'),
  schedule: $t('À heure fixe'),
  button: $t('On clique sur un bouton'),
}

export const STEP_LABELS: Readonly<Record<StepKind, string>> = {
  update_record: $t('Modifier une ligne'),
  create_record: $t('Créer une ligne'),
  find_record: $t('Chercher une ligne'),
  notify: $t('Prévenir quelqu’un'),
  webhook: $t('Appeler un webhook'),
  slack: $t('Envoyer sur Slack'),
  ai: $t('Demander à l’IA'),
  branch: $t('Condition'),
}

export const STEP_HINTS: Readonly<Record<StepKind, string>> = {
  update_record: $t('Écrire des valeurs dans la ligne, ou dans celle d’une étape'),
  create_record: $t('Dans cette table ou une autre'),
  find_record: $t('La première ligne qui répond à un filtre'),
  notify: $t('Une notification dans basedb'),
  webhook: $t('Un POST en HTTPS'),
  slack: $t('Un message dans un canal connecté'),
  ai: $t('Rédiger, résumer, classer — une réponse pour les étapes suivantes'),
  branch: $t('Des chemins selon ce que dit une ligne'),
}

/** What an AI step's answer is read into, as the editor names it. */
export const AI_ANSWERS: ReadonlyArray<{
  readonly value: AutomationAiAnswer
  readonly label: string
}> = [
  { value: 'long_text', label: $t('Un texte libre') },
  { value: 'short_text', label: $t('Un texte court, sur une ligne') },
  { value: 'number', label: $t('Un nombre') },
  { value: 'boolean', label: $t('Oui ou non') },
  { value: 'date', label: $t('Une date') },
  { value: 'url', label: $t('Une adresse web') },
  { value: 'select', label: $t('Un choix dans une liste') },
]

/** The actions first — most automations need no more; then what makes a flow. */
export const STEP_MENU: readonly (readonly StepKind[])[] = [
  ['update_record', 'create_record', 'notify', 'slack', 'webhook'],
  ['find_record', 'ai', 'branch'],
]

const DEFAULT_SCHEDULE: AutomationSchedule = {
  every: 'day',
  at: '09:00',
  weekday: 1,
  timezone: 'Europe/Paris',
}

/** The fields a step may write: neither computed, nor a button, nor read-only. */
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
    label: $t('Nouvelle automatisation'),
    description: '',
    enabled: true,
    trigger: { kind: 'record_created', table, fields: [], schedule: DEFAULT_SCHEDULE },
    condition: '',
    steps: [],
  }
}

// ── The tree ────────────────────────────────────────────────────────────────

/** Every step, depth first, in the order the flow is read. */
export function allSteps(steps: readonly DraftStep[]): DraftStep[] {
  return steps.flatMap((s) =>
    s.kind === 'branch' ? [s, ...s.paths.flatMap((p) => allSteps(p.steps))] : [s],
  )
}

export function findStep(steps: readonly DraftStep[], id: string): DraftStep | null {
  return allSteps(steps).find((s) => s.id === id) ?? null
}

/** A path, and the branch it belongs to. */
export function findPath(
  steps: readonly DraftStep[],
  id: string,
): { readonly branch: Extract<DraftStep, { kind: 'branch' }>; readonly path: DraftPath } | null {
  for (const step of allSteps(steps)) {
    if (step.kind !== 'branch') continue
    const path = step.paths.find((p) => p.id === id)
    if (path !== undefined) return { branch: step, path }
  }
  return null
}

/** A new identifier, `e4` or `c2`, unused anywhere in the flow nor in `also`. */
export function freshId(
  steps: readonly DraftStep[],
  prefix: 'e' | 'c',
  also: readonly string[] = [],
): string {
  const taken = new Set([
    ...also,
    ...allSteps(steps).flatMap((s) => [
      s.id,
      ...(s.kind === 'branch' ? s.paths.map((p) => p.id) : []),
    ]),
  ])
  let n = 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/** The flow with one sequence — the root (`null`) or a path's — rewritten. */
export function editSequence(
  steps: readonly DraftStep[],
  path: string | null,
  edit: (sequence: readonly DraftStep[]) => readonly DraftStep[],
): DraftStep[] {
  if (path === null) return [...edit(steps)]
  return steps.map((s) =>
    s.kind === 'branch'
      ? {
          ...s,
          paths: s.paths.map((p) =>
            p.id === path
              ? { ...p, steps: edit(p.steps) }
              : { ...p, steps: editSequence(p.steps, path, edit) },
          ),
        }
      : s,
  )
}

export function insertStep(
  steps: readonly DraftStep[],
  path: string | null,
  index: number,
  step: DraftStep,
): DraftStep[] {
  return editSequence(steps, path, (seq) => [...seq.slice(0, index), step, ...seq.slice(index)])
}

/** Where a step is: the sequence that holds it, and its place there. */
export function locate(
  steps: readonly DraftStep[],
  id: string,
  path: string | null = null,
): { readonly path: string | null; readonly index: number; readonly length: number } | null {
  const index = steps.findIndex((s) => s.id === id)
  if (index >= 0) return { path, index, length: steps.length }
  for (const s of steps) {
    if (s.kind !== 'branch') continue
    for (const p of s.paths) {
      const found = locate(p.steps, id, p.id)
      if (found !== null) return found
    }
  }
  return null
}

export function replaceStep(steps: readonly DraftStep[], id: string, next: DraftStep): DraftStep[] {
  const where = locate(steps, id)
  if (where === null) return [...steps]
  return editSequence(steps, where.path, (seq) => seq.map((s) => (s.id === id ? next : s)))
}

export function removeStep(steps: readonly DraftStep[], id: string): DraftStep[] {
  const where = locate(steps, id)
  if (where === null) return [...steps]
  return editSequence(steps, where.path, (seq) => seq.filter((s) => s.id !== id))
}

/** One place up (-1) or down (+1) in its own sequence. */
export function moveStep(steps: readonly DraftStep[], id: string, delta: number): DraftStep[] {
  const where = locate(steps, id)
  if (where === null) return [...steps]
  const to = where.index + delta
  if (to < 0 || to >= where.length) return [...steps]
  return editSequence(steps, where.path, (seq) => {
    const next = [...seq]
    const [moved] = next.splice(where.index, 1)
    if (moved !== undefined) next.splice(to, 0, moved)
    return next
  })
}

export function replacePath(
  steps: readonly DraftStep[],
  id: string,
  edit: (path: DraftPath) => DraftPath,
): DraftStep[] {
  return steps.map((s) =>
    s.kind === 'branch'
      ? {
          ...s,
          paths: s.paths.map((p) =>
            p.id === id ? edit(p) : { ...p, steps: replacePath(p.steps, id, edit) },
          ),
        }
      : s,
  )
}

// ── What a step may name ────────────────────────────────────────────────────

/**
 * The steps passed on every way to a step or a path (chapter 17 §1.4): those before it
 * in its sequence, and before each branch that holds it. A path's own condition sees what
 * came before its branch. What a path holds is not seen after the branch.
 */
export function stepsBefore(steps: readonly DraftStep[], id: string): DraftStep[] | null {
  const walk = (sequence: readonly DraftStep[], seen: readonly DraftStep[]): DraftStep[] | null => {
    const passed = [...seen]
    for (const step of sequence) {
      if (step.id === id) return passed
      if (step.kind === 'branch') {
        for (const path of step.paths) {
          if (path.id === id) return passed
          const inner = walk(path.steps, passed)
          if (inner !== null) return inner
        }
      } else {
        passed.push(step)
      }
    }
    return null
  }
  return walk(steps, [])
}

/** The steps before a place where a step is about to be inserted. */
export function stepsAtSlot(
  steps: readonly DraftStep[],
  path: string | null,
  index: number,
): DraftStep[] {
  const before = path === null ? [] : (stepsBefore(steps, path) ?? [])
  const sequence = path === null ? steps : (findPath(steps, path)?.path.steps ?? [])
  return [...before, ...sequence.slice(0, index).filter((s) => s.kind !== 'branch')]
}

/** The table a step's row belongs to, by name; `null` when it gives no row. */
export function rowTableOf(draft: Draft, id: string): string | null {
  if (id === TRIGGER_ROW) return draft.trigger.kind === 'schedule' ? null : draft.trigger.table
  const step = findStep(draft.steps, id)
  if (step === null) return null
  if (step.kind === 'find_record' || step.kind === 'create_record') return step.table
  if (step.kind === 'update_record') return rowTableOf(draft, step.record)
  return null
}

export interface RowChoice {
  /** `trigger` or a step's identifier. */
  readonly value: string
  readonly label: string
  /** The table's name. */
  readonly table: string
}

/** The rows a step may act on at a point: the triggering one, then those steps gave. */
export function rowChoices(
  draft: Draft,
  base: DescribedBase,
  before: readonly DraftStep[],
): RowChoice[] {
  const labelOf = (name: string) => base.tables.find((t) => t.name === name)?.label ?? name
  const out: RowChoice[] = []
  if (draft.trigger.kind !== 'schedule' && draft.trigger.table !== '') {
    out.push({
      value: TRIGGER_ROW,
      label: $t('La ligne déclencheuse ({table})', { table: labelOf(draft.trigger.table) }),
      table: draft.trigger.table,
    })
  }
  for (const step of before) {
    const table = rowTableOf(draft, step.id)
    if (table === null || table === '') continue
    out.push({ value: step.id, label: `${stepCaption(step)} (${labelOf(table)})`, table })
  }
  return out
}

/** A step as a menu names it: `e2 · Chercher une ligne`. */
export const stepCaption = (step: DraftStep) => `${step.id} · ${STEP_LABELS[step.kind]}`

export interface CiteGroup {
  readonly label: string
  readonly items: ReadonlyArray<{ readonly label: string; readonly token: string }>
}

/** What a text may cite at a point: the triggering row, then each step before it. */
export function citeGroups(
  draft: Draft,
  base: DescribedBase,
  before: readonly DraftStep[],
): CiteGroup[] {
  const fieldsOf = (name: string | null) =>
    (base.tables.find((t) => t.name === name)?.fields ?? []).filter(
      (f) => f.system !== true && f.kind !== 'button',
    )
  const groups: CiteGroup[] = []
  if (draft.trigger.kind !== 'schedule') {
    groups.push({
      label: $t('La ligne déclencheuse'),
      items: [
        ...fieldsOf(draft.trigger.table).map((f) => ({ label: f.label, token: `{{${f.name}}}` })),
        { label: $t('Identifiant'), token: '{{_id}}' },
      ],
    })
  }
  for (const step of before) {
    if (step.kind === 'ai') {
      groups.push({
        label: stepCaption(step),
        items: [{ label: $t('Sa réponse'), token: `{{${step.id}.reponse}}` }],
      })
      continue
    }
    if (step.kind === 'webhook') {
      groups.push({
        label: stepCaption(step),
        items: [
          { label: $t('Code de réponse'), token: `{{${step.id}.statut}}` },
          { label: $t('Réponse (une clé : .reponse.clé)'), token: `{{${step.id}.reponse}}` },
        ],
      })
      continue
    }
    const table = rowTableOf(draft, step.id)
    if (table === null) continue
    groups.push({
      label: stepCaption(step),
      items: [
        ...fieldsOf(table).map((f) => ({ label: f.label, token: `{{${step.id}.${f.name}}}` })),
        { label: $t('Identifiant'), token: `{{${step.id}._id}}` },
      ],
    })
  }
  groups.push({
    label: $t('Autre'),
    items: [{ label: $t('Maintenant'), token: '{{_maintenant}}' }],
  })
  return groups
}

// ── Filters ─────────────────────────────────────────────────────────────────

const CITATION_AT = /^\{\{\s*[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*\s*\}\}/

/**
 * A filter with each citation stood in for by a plain text — as the run will do, a
 * citation lands in a string — so that what was typed around it can be checked.
 */
export function withoutCitations(text: string): string {
  let out = ''
  let quoted = false
  let i = 0
  while (i < text.length) {
    const m = CITATION_AT.exec(text.slice(i))
    if (m !== null) {
      out += quoted ? 'x' : '"x"'
      i += m[0].length
      continue
    }
    const c = text[i] as string
    if (quoted && c === '\\') {
      out += text.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '"') quoted = !quoted
    out += c
    i++
  }
  return out
}

/** The columns every table has, which a filter may name. */
const SYSTEM_COLUMNS = ['_id', '_created_at', '_updated_at', '_created_by', '_updated_by']

/**
 * What is wrong with a filter as typed — an unknown field, an operator its type refuses,
 * a sentence that does not parse — or `null`. A courtesy before the run: the kernel's
 * parser stays the judge.
 */
export function filterIssue(text: string, fields: readonly Field[]): string | null {
  if (text.trim() === '') return null
  const known = [
    // A system column declares no operator: the kernel's parser knows its own.
    ...fields.map((f) => (f.system === true ? { ...f, operators: undefined } : f)),
    ...SYSTEM_COLUMNS.filter((name) => !fields.some((f) => f.name === name)).map(
      (name) => ({ name, label: name, kind: 'short_text' }) as Field,
    ),
  ]
  const plain = withoutCitations(text)
  const problem = check(plain, known).find((p) => p.severity === 'error')
  if (problem !== undefined) return problem.message
  return compileMatcher(plain, known) === null
    ? $t(
        'Filtre illisible : « champ opérateur valeur », reliés par and, or — eq, ne, gt, gte, lt, lte, contains, in, is_null…',
      )
    : null
}

// ── From the API, and back ──────────────────────────────────────────────────

const rowsOf = (values: Readonly<Record<string, unknown>>): ValueRow[] =>
  Object.entries(values).map(([field, value]) => ({
    field,
    value: typeof value === 'string' ? value : value === null ? '' : JSON.stringify(value),
  }))

const valuesOf = (rows: readonly ValueRow[]): Record<string, unknown> =>
  Object.fromEntries(rows.filter((r) => r.field !== '').map((r) => [r.field, r.value]))

/** An automation as the editor shows it; a step saved without identifier gets one. */
export function draftOf(automation: Automation, base: DescribedBase): Draft {
  const nameOf = (id: string | null) => base.tables.find((t) => t.id === id)?.name ?? ''
  const hasRow = automation.trigger.table !== null
  let n = 0
  const idOf = (id: string | undefined) => id ?? `e${++n}`
  const stepsOf = (steps: readonly AutomationStep[]): DraftStep[] =>
    steps.map((a): DraftStep => {
      switch (a.kind) {
        case 'update_record':
          return {
            id: idOf(a.id),
            kind: a.kind,
            record: a.record ?? TRIGGER_ROW,
            values: rowsOf(a.values),
          }
        case 'create_record':
          return { id: idOf(a.id), kind: a.kind, table: nameOf(a.table), values: rowsOf(a.values) }
        case 'find_record':
          return {
            id: idOf(a.id),
            kind: a.kind,
            table: nameOf(a.table),
            filter: a.filter,
            sort: a.sort ?? '',
          }
        case 'notify':
          return {
            id: idOf(a.id),
            kind: a.kind,
            record: a.record === undefined ? (hasRow ? TRIGGER_ROW : '') : (a.record ?? ''),
            users: a.users,
            userField: a.user_field ?? '',
            message: a.message,
          }
        case 'webhook':
          return {
            id: idOf(a.id),
            kind: a.kind,
            record: a.record === undefined ? (hasRow ? TRIGGER_ROW : '') : (a.record ?? ''),
            url: a.url,
          }
        case 'slack':
          return { id: idOf(a.id), kind: a.kind, integration: a.integration, message: a.message }
        case 'ai':
          return {
            id: idOf(a.id),
            kind: a.kind,
            prompt: a.prompt,
            answer: a.answer ?? 'long_text',
            options: a.options ?? [],
            consent: a.consent === true,
          }
        case 'branch':
          return {
            id: idOf(a.id),
            kind: a.kind,
            paths: a.paths.map((p, i) => ({
              id: p.id ?? `c${i + 1}`,
              label: p.label,
              otherwise: p.when === null,
              record: p.when?.record ?? TRIGGER_ROW,
              condition: p.when?.condition ?? '',
              steps: stepsOf(p.steps),
            })),
          }
      }
    })
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
    steps: stepsOf(automation.actions),
  }
}

/** A definition the copilot proposes, as the editor shows it. */
export function draftOfDefinition(definition: AutomationDefinition, base: DescribedBase): Draft {
  return draftOf(
    {
      ...definition,
      id: '',
      owner: { id: '', name: '' },
      next_run_at: null,
      last_run: null,
      created_at: '',
      updated_at: '',
    },
    base,
  )
}

function stepInput(a: DraftStep): AutomationStep {
  switch (a.kind) {
    case 'update_record':
      return { id: a.id, kind: a.kind, record: a.record, values: valuesOf(a.values) }
    case 'create_record':
      return { id: a.id, kind: a.kind, table: a.table, values: valuesOf(a.values) }
    case 'find_record':
      return {
        id: a.id,
        kind: a.kind,
        table: a.table,
        filter: a.filter.trim(),
        sort: a.sort === '' ? null : a.sort,
      }
    case 'notify':
      return {
        id: a.id,
        kind: a.kind,
        record: a.record === '' ? null : a.record,
        users: a.users,
        user_field: a.userField === '' ? null : a.userField,
        message: a.message,
      }
    case 'webhook':
      return {
        id: a.id,
        kind: a.kind,
        record: a.record === '' ? null : a.record,
        url: a.url.trim(),
      }
    case 'slack':
      return { id: a.id, kind: a.kind, integration: a.integration, message: a.message }
    case 'ai':
      return {
        id: a.id,
        kind: a.kind,
        prompt: a.prompt.trim(),
        answer: a.answer,
        options:
          a.answer === 'select' ? a.options.map((o) => o.trim()).filter((o) => o !== '') : [],
        consent: a.consent,
      }
    case 'branch':
      return {
        id: a.id,
        kind: a.kind,
        paths: a.paths.map(
          (p): AutomationPath => ({
            id: p.id,
            label: p.label.trim(),
            when: p.otherwise ? null : { record: p.record, condition: p.condition.trim() },
            steps: p.steps.map(stepInput),
          }),
        ),
      }
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
    actions: draft.steps.map(stepInput),
  }
}

/**
 * A new step of a kind at a place of the flow, preset on what is there: the row it acts
 * on is the triggering one when there is one. A new branch comes with a path and its
 * « Sinon ».
 */
export function newStep(kind: StepKind, draft: Draft, base: DescribedBase, id: string): DraftStep {
  const row = draft.trigger.kind === 'schedule' ? '' : TRIGGER_ROW
  switch (kind) {
    case 'update_record':
      return { id, kind, record: row, values: [{ field: '', value: '' }] }
    case 'create_record':
      return { id, kind, table: base.tables[0]?.name ?? '', values: [{ field: '', value: '' }] }
    case 'find_record':
      return { id, kind, table: base.tables[0]?.name ?? '', filter: '', sort: '' }
    case 'notify':
      return { id, kind, record: row, users: [], userField: '', message: '' }
    case 'webhook':
      return { id, kind, record: row, url: 'https://' }
    case 'slack':
      return { id, kind, integration: '', message: '' }
    case 'ai':
      return { id, kind, prompt: '', answer: 'long_text', options: [], consent: false }
    case 'branch': {
      const first = freshId(draft.steps, 'c')
      const second = freshId(draft.steps, 'c', [first])
      return {
        id,
        kind,
        paths: [
          { id: first, label: $t('Si'), otherwise: false, record: row, condition: '', steps: [] },
          {
            id: second,
            label: $t('Sinon'),
            otherwise: true,
            record: row,
            condition: '',
            steps: [],
          },
        ],
      }
    }
  }
}

// ── What the editor says of a step ──────────────────────────────────────────

const personOf = (members: readonly Member[], id: string) => {
  const m = members.find((x) => x.id === id)
  return m === undefined ? $t('une personne') : m.display_name || m.email
}

/** A step in a line, for its card on the flow. */
export function stepSummary(
  step: DraftStep,
  draft: Draft,
  base: DescribedBase,
  members: readonly Member[],
): string {
  const tableLabel = (name: string | null) =>
    base.tables.find((t) => t.name === name)?.label ?? name ?? ''
  const fieldLabels = (table: string | null, rows: readonly ValueRow[]) => {
    const fields = base.tables.find((t) => t.name === table)?.fields ?? []
    return rows
      .filter((r) => r.field !== '')
      .map((r) => fields.find((f) => f.name === r.field)?.label ?? r.field)
      .join(', ')
  }
  const on = (record: string) =>
    record === TRIGGER_ROW ? '' : record === '' ? '' : $t(' · ligne de {record}', { record })
  switch (step.kind) {
    case 'update_record':
      return `${fieldLabels(rowTableOf(draft, step.record), step.values) || $t('Aucun champ')}${on(step.record)}`
    case 'create_record':
      return $t('Dans {table}{value}', {
        table: tableLabel(step.table),
        value: step.values.some((v) => v.field !== '')
          ? ` · ${fieldLabels(step.table, step.values)}`
          : '',
      })
    case 'find_record':
      return $t('Dans {table}{value}', {
        table: tableLabel(step.table),
        value: step.filter.trim() === '' ? '' : ` · ${step.filter.trim()}`,
      })
    case 'notify': {
      const people = step.users.map((u) => personOf(members, u))
      if (step.userField !== '')
        people.push($t('le champ {userField}', { userField: step.userField }))
      return people.length === 0 ? $t('Personne à prévenir') : people.join(', ')
    }
    case 'webhook':
      try {
        return new URL(step.url).host || step.url
      } catch {
        return step.url
      }
    case 'slack':
      return step.message.trim() === '' ? $t('Aucun message') : step.message
    case 'ai':
      return step.prompt.trim() === ''
        ? $t('Aucune consigne')
        : step.prompt.replace(/\s+/g, ' ').trim()
    case 'branch':
      return $tp(step.paths.length, '{count} chemin', '{count} chemins')
  }
}

const CITED = /\{\{\s*([A-Za-z0-9_]+)\.[A-Za-z0-9_.]+\s*\}\}/g

/** The steps a text cites: `{{e2.champ}}` names `e2`. */
const citedSteps = (text: string) => [...text.matchAll(CITED)].map((m) => m[1] as string)

/** The steps a step names — the row it acts on, the steps its texts cite. */
export function referencesOf(step: DraftStep): string[] {
  const valueTexts = (rows: readonly ValueRow[]) => rows.flatMap((r) => citedSteps(r.value))
  const row = (record: string) => (record === TRIGGER_ROW || record === '' ? [] : [record])
  switch (step.kind) {
    case 'update_record':
      return [...row(step.record), ...valueTexts(step.values)]
    case 'create_record':
      return valueTexts(step.values)
    case 'find_record':
      return citedSteps(step.filter)
    case 'notify':
      return [...row(step.record), ...citedSteps(step.message)]
    case 'webhook':
      return row(step.record)
    case 'slack':
      return citedSteps(step.message)
    case 'ai':
      return citedSteps(step.prompt)
    case 'branch':
      return []
  }
}

/** The first step named that has not surely run before: moved after, or in another path. */
function missingReference(names: readonly string[], draft: Draft, at: string): string | null {
  const before = new Set((stepsBefore(draft.steps, at) ?? []).map((s) => s.id))
  const missing = names.find((n) => !before.has(n))
  if (missing === undefined) return null
  return findStep(draft.steps, missing) === null
    ? $t('Cite {missing}, qui n’existe plus', { missing })
    : $t('Cite {missing}, qui n’a pas forcément eu lieu avant', { missing })
}

/** What stops a step from being saved, said before the API does; `null`: nothing. */
export function stepProblem(step: DraftStep, draft: Draft): string | null {
  const missing = missingReference(referencesOf(step), draft, step.id)
  if (missing !== null) return missing
  switch (step.kind) {
    case 'update_record':
      if (step.record === '') return $t('Aucune ligne à modifier')
      return step.values.some((v) => v.field !== '') ? null : $t('Aucun champ à écrire')
    case 'create_record':
      if (step.table === '') return $t('Choisissez une table')
      return step.values.some((v) => v.field !== '') ? null : $t('Aucun champ à écrire')
    case 'find_record':
      return step.table === '' ? $t('Choisissez une table') : null
    case 'notify':
      if (step.users.length === 0 && step.userField === '') return $t('Personne à prévenir')
      if (step.message.trim() === '') return $t('Message vide')
      return step.record === '' ? $t('Aucune ligne : la notification ne partira pas') : null
    case 'webhook':
      return /^https:\/\/[^/]+/.test(step.url.trim()) ? null : $t('Adresse https attendue')
    case 'slack':
      if (step.integration === '') return $t('Choisissez un canal')
      return step.message.trim() === '' ? $t('Message vide') : null
    case 'ai':
      if (step.prompt.trim() === '') return $t('Consigne vide')
      if (step.answer === 'select' && !step.options.some((o) => o.trim() !== ''))
        return $t('Aucun choix proposé')
      return step.consent ? null : $t('Accord à donner pour l’envoi au fournisseur')
    case 'branch':
      for (const path of step.paths) {
        const problem = pathProblem(path, draft)
        if (problem !== null) return `${path.label || $t('Un chemin')} : ${problem}`
      }
      return null
  }
}

/** What is wrong with a path's test; `null`: nothing. */
export function pathProblem(path: DraftPath, draft: Draft): string | null {
  if (path.otherwise) return null
  if (path.record === '') return $t('aucune ligne à tester')
  // The triggering row always exists: with no filter, the paths after it are never taken.
  const branch = findPath(draft.steps, path.id)?.branch
  const last = branch?.paths[branch.paths.length - 1]?.id === path.id
  if (path.record === TRIGGER_ROW && path.condition.trim() === '' && !last)
    return $t('toujours pris : donnez-lui une condition')
  const names = [
    ...(path.record === TRIGGER_ROW ? [] : [path.record]),
    ...citedSteps(path.condition),
  ]
  const missing = missingReference(names, draft, path.id)
  return missing === null ? null : missing.charAt(0).toLowerCase() + missing.slice(1)
}

/** A path's test in a line. */
export function pathSummary(path: DraftPath): string {
  if (path.otherwise) return $t('quand aucun autre ne convient')
  const row = path.record === TRIGGER_ROW ? '' : `${path.record} : `
  if (path.condition.trim() === '')
    return path.record === TRIGGER_ROW
      ? $t('Toujours')
      : $t('{record} a trouvé une ligne', { record: path.record })
  return `${row}${path.condition.trim()}`
}

// ── Runs ────────────────────────────────────────────────────────────────────

const RUN_REASONS: Readonly<Record<string, string>> = {
  condition_fausse: $t('la condition n’était pas remplie'),
  ligne_introuvable: $t('la ligne n’existe plus'),
  desactivee: $t('l’automatisation était désactivée'),
  supprimee: $t('l’automatisation a été supprimée'),
  proprietaire_inactif: $t('son propriétaire n’a plus de compte actif'),
  debit: $t('plus de 100 exécutions dans l’heure'),
}

/** A run in a sentence: what happened, and why not. */
export function runSentence(run: AutomationRun): string {
  switch (run.status) {
    case 'queued':
      return $t('En attente')
    case 'running':
      return $t('En cours')
    case 'succeeded':
      return $t('Réussie')
    case 'skipped':
      return $t('Écartée : {value}', {
        value: RUN_REASONS[run.reason ?? ''] ?? run.reason ?? $t('raison inconnue'),
      })
    case 'failed':
      return $t('Échouée{value}', { value: run.error_code === null ? '' : ` (${run.error_code})` })
  }
}

export const TRIGGER_OF_RUN: Readonly<Record<string, string>> = {
  record_created: $t('ligne créée'),
  record_updated: $t('ligne modifiée'),
  schedule: 'horloge',
  button: 'bouton',
  test: 'essai',
}

export type RunStepRecord = AutomationRun['steps'][number]

/**
 * A run's steps by the step they are about. A run from before flows names none: its
 * steps are, in order, those of the flow's first level.
 */
export function runStepsById(
  run: AutomationRun,
  steps: readonly DraftStep[],
): Map<string, RunStepRecord> {
  return new Map(
    run.steps.flatMap((s, i): [string, RunStepRecord][] => {
      const id = s.step ?? steps[i]?.id
      return id === undefined ? [] : [[id, s]]
    }),
  )
}

/** A step of a run in a sentence. */
export function runStepSentence(record: RunStepRecord): string {
  if (record.status === 'failed') {
    const code = record.error_code ?? 'INTERNAL_ERROR'
    const sentence = sentenceFor(code)
    return sentence === code
      ? $t('échec ({code})', { code })
      : $t('échec : {replace}', { replace: sentence.replace(/\.$/, '') })
  }
  if (record.status === 'skipped')
    return record.detail === 'aucune_ligne' ? $t('passée : aucune ligne') : $t('passée')
  if (record.kind === 'find_record')
    return record.detail === 'aucune' ? $t('aucune ligne trouvée') : $t('ligne trouvée')
  if (record.kind === 'branch')
    return record.path === null
      ? $t('aucun chemin ne convenait')
      : $t('chemin « {detail} »', { detail: record.detail })
  if (record.kind === 'ai')
    return record.detail === undefined
      ? $t('réponse reçue')
      : $t('réponse de {detail} caractères', { detail: record.detail })
  if (record.kind === 'notify')
    return $tp(
      Number(record.detail ?? 0),
      '{count} personne prévenue',
      '{count} personnes prévenues',
    )
  return $t('fait')
}

// ── Refusals ────────────────────────────────────────────────────────────────

/** Why the API refused a definition (`REQUEST_INVALID`), by the reason it gives. */
const REFUSALS: Readonly<Record<string, (detail: string) => string>> = {
  libelle_invalide: () => $t('Donnez un nom à l’automatisation.'),
  declencheur_inconnu: () => $t('Choisissez un déclencheur.'),
  table_inconnue: (d) => $t('La table « {d} » n’existe pas, ou plus.', { d }),
  champ_inconnu: (d) => $t('Le champ « {d} » n’existe pas, ou plus.', { d }),
  heure_invalide: () => $t('Heure invalide.'),
  fuseau_inconnu: () => $t('Fuseau horaire inconnu.'),
  condition_sans_ligne: () =>
    $t('Une condition teste une ligne : à heure fixe, cherchez-en une d’abord.'),
  action_sans_ligne: () =>
    $t('Cette étape n’a pas de ligne sur laquelle agir : à heure fixe, cherchez-en une d’abord.'),
  etape_inconnue: (d) =>
    $t(
      'L’étape {d} n’existe pas, ou n’a pas forcément eu lieu avant celle-ci : elle vient après, ou dans un autre chemin.',
      { d },
    ),
  etape_sans_ligne: (d) => $t('L’étape {d} ne donne pas de ligne.', { d }),
  sinon_en_dernier: () => $t('« Sinon » ne peut être que le dernier chemin.'),
  aucun_chemin: () => $t('Une condition a au moins un chemin.'),
  trop_de_chemins: (d) => $t('{d} chemins au plus par condition.', { d }),
  branches_trop_profondes: (d) => $t('{d} conditions imbriquées au plus.', { d }),
  aucune_action: () => $t('Ajoutez au moins une étape.'),
  trop_d_etapes: (d) => $t('{d} étapes au plus.', { d }),
  valeurs_invalides: () => $t('Des valeurs sont invalides.'),
  aucune_valeur: () => $t('Choisissez au moins un champ à écrire.'),
  personne_a_prevenir: () => $t('Choisissez qui prévenir.'),
  personne_inconnue: () => $t('Une personne à prévenir n’a plus de compte.'),
  trop_de_personnes: (d) => $t('{d} personnes au plus.', { d }),
  champ_personne_attendu: () => $t('Le champ à prévenir doit être un champ Personne.'),
  message_invalide: () => $t('Le message est vide ou trop long.'),
  connexion_inconnue: () => $t('Ce canal Slack n’est plus connecté.'),
  texte_trop_long: () => $t('Un filtre est trop long : 4 000 caractères au plus.'),
  identifiant_invalide: (d) => $t('Identifiant d’étape invalide : « {d} ».', { d }),
  identifiant_en_double: (d) => $t('Deux étapes portent l’identifiant « {d} ».', { d }),
  consigne_vide: () => $t('Écrivez la consigne de l’étape IA.'),
  consigne_trop_longue: (d) => $t('Consigne trop longue : {d} caractères au plus.', { d }),
  reponse_inconnue: () => $t('Choisissez la réponse attendue de l’étape IA.'),
  aucun_choix: () => $t('Proposez au moins un choix à l’IA.'),
  trop_de_choix: (d) => $t('{d} choix au plus, de 255 caractères chacun.', { d }),
  consentement_requis: () =>
    $t('Donnez votre accord à l’envoi au fournisseur d’IA de ce que la consigne cite.'),
}

/** A refusal of the API as the editor says it, and the step it is about when it names one. */
export function refusalOf(details: Readonly<Record<string, unknown>>): {
  readonly sentence: string | null
  readonly step: string | null
} {
  const reason = typeof details.reason === 'string' ? details.reason : ''
  const detail = details.detail === undefined ? '' : String(details.detail)
  const say = REFUSALS[reason]
  return {
    sentence: say === undefined ? null : say(detail),
    step: typeof details.step === 'string' ? details.step : null,
  }
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
