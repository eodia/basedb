import type {
  Automation,
  AutomationAiAnswer,
  AutomationAttachment,
  AutomationBodyFormat,
  AutomationDefinition,
  AutomationHttpMethod,
  AutomationInput,
  AutomationMeasure,
  AutomationPath,
  AutomationRun,
  AutomationSchedule,
  AutomationStep,
  AutomationTriggerKind,
  AutomationValueOp,
  AutomationWaitUnit,
  DescribedBase,
  Field,
  Member,
} from '@/lib/api/client'
import { compileMatcher } from '@/lib/evaluate'
import { check } from '@/lib/expression'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { sentenceFor } from '@/lib/messages'
import { isBlankHtml } from '@/lib/rich-text'

/**
 * Automations as the screen edits them — chapter 17. A draft holds what the editor shows —
 * a flow of steps, branches and attempts holding paths holding steps, tables by name,
 * values as rows to add and remove — and turns into what the API saves. Kept apart from
 * the screen so that the conversion, the edits of the tree and what each step may cite
 * can be tested.
 */

export interface ValueRow {
  readonly field: string
  readonly value: string
}

/** The triggering row, as a step's `record` names it. */
export const TRIGGER_ROW = 'trigger'

/** An e-mail address as the server checks one: one `@`, no space, no bracket. */
const ADDRESS = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/

/** A text that is a citation and nothing else: `{{email}}`, `{{e2.contact}}`. */
const ONLY_CITATION = /^\{\{\s*[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*\s*\}\}$/

/** The addresses an e-mail step names, as typed: split on commas, semicolons, spaces. */
export function addressesOf(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((a) => a.trim().replace(/^mailto:/i, ''))
        .filter((a) => a !== ''),
    ),
  ]
}

/** A header of a webhook step, as the editor shows it. */
export interface DraftHeader {
  readonly name: string
  /** Typed; empty for a secret kept as saved. */
  readonly value: string
  readonly secret: boolean
  /** A secret saved before, never shown: kept unless a new value is typed. */
  readonly kept: boolean
  /** The host a kept secret was given for: another asks for it again. */
  readonly host: string
}

/** What a webhook sends: the automation's own JSON, or a body composed in a format. */
export type DraftBody = 'standard' | AutomationBodyFormat

export const HTTP_METHODS: readonly AutomationHttpMethod[] = [
  'POST',
  'PUT',
  'PATCH',
  'GET',
  'DELETE',
]

/** A GET or a DELETE sends no body. */
export const hasBody = (method: AutomationHttpMethod) => method !== 'GET' && method !== 'DELETE'

/** The rows a loop goes through, at most and when none is said — as the kernel counts them. */
export const MAX_LOOP_ROWS = 200
export const DEFAULT_LOOP_ROWS = 50
/** Conditions, attempts and loops within one another, at most. */
export const MAX_DEPTH = 3
export const MAX_PATHS = 5
/** The recipients a mail names — people and addresses together. */
export const MAX_RECIPIENTS = 50
export const MAX_CC = 20
export const MAX_ATTACHMENTS = 10
export const MAX_MEASURES = 5
export const MAX_RETRIES = 3
/** The longest a run may wait, and how far a date may be moved. */
export const MAX_WAIT_DAYS = 365

/** A mail's attachment, as the editor holds it — as the API does. */
export type DraftAttachment = AutomationAttachment

export interface DraftMeasure {
  readonly fn: AutomationMeasure['fn']
  readonly field: string
}

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
      readonly kind: 'delete_record'
      /** `trigger`, or the step whose row goes to the trash; empty: none chosen yet. */
      readonly record: string
    }
  | {
      readonly id: string
      readonly kind: 'aggregate'
      readonly table: string
      readonly filter: string
      readonly measures: readonly DraftMeasure[]
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
  | {
      readonly id: string
      readonly kind: 'email'
      /** `trigger`, a step, or empty: no row. */
      readonly record: string
      readonly users: readonly string[]
      readonly userField: string
      readonly emailField: string
      /** Addresses written out, as typed — split and checked on saving. */
      readonly addresses: string
      readonly subject: string
      /** The app's rich text — a plain message from the API opens converted. */
      readonly message: string
      readonly mode: 'each' | 'together'
      /** In copy, as typed; sent only with a mail to all together, kept aside otherwise. */
      readonly cc: string
      /** An address or a citation; empty: the automation's owner. */
      readonly replyTo: string
      readonly format: 'html'
      readonly attachments: readonly DraftAttachment[]
    }
  | {
      readonly id: string
      readonly kind: 'webhook'
      /** The row the automation's own JSON sends: `trigger`, a step, or empty: none. */
      readonly record: string
      readonly url: string
      readonly method: AutomationHttpMethod
      readonly headers: readonly DraftHeader[]
      readonly body: DraftBody
      /** The body composed, as typed; kept aside while the automation's JSON is sent. */
      readonly template: string
      readonly retries: number
    }
  | {
      readonly id: string
      readonly kind: 'for_each'
      readonly table: string
      readonly filter: string
      /** `champ`, `-champ`, or empty. */
      readonly sort: string
      readonly limit: number
      readonly onError: 'stop' | 'continue'
      readonly steps: readonly DraftStep[]
    }
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
  | {
      readonly id: string
      readonly kind: 'document'
      /** The row the PDF is made of: `trigger`, a step, or empty: none chosen yet. */
      readonly record: string
      /** A document template of the row's table; empty: the sheet of every field. */
      readonly template: string
      /** A file field the PDF is added to; empty: none. */
      readonly field: string
      /** The file's name, which may cite; empty: the template's label and the row's. */
      readonly name: string
    }
  | {
      readonly id: string
      readonly kind: 'run_automation'
      /** Another automation of the base; empty: none chosen yet. */
      readonly automation: string
      /** The row it runs on, when its trigger has a table; empty: none. */
      readonly record: string
    }
  | {
      readonly id: string
      readonly kind: 'wait'
      /** A duration, or until a date of a row — both kept while the other is chosen. */
      readonly mode: 'duration' | 'until'
      readonly amount: number
      readonly unit: AutomationWaitUnit
      readonly record: string
      readonly field: string
      readonly offsetDays: number
      readonly at: string
      readonly timezone: string
    }
  | { readonly id: string; readonly kind: 'branch'; readonly paths: readonly DraftPath[] }
  | {
      readonly id: string
      readonly kind: 'attempt'
      /** Always two: the steps tried, and those run when one of them fails. */
      readonly paths: readonly DraftPath[]
    }

/**
 * A path of a branch or of an attempt. A branch's tests a row against a filter, or a value
 * against another; an attempt's test nothing — the first is tried, the second taken when a
 * step of the first fails.
 */
export interface DraftPath {
  readonly id: string
  readonly label: string
  /** Taken when no path before it was: the last one only. */
  readonly otherwise: boolean
  readonly test: 'row' | 'value'
  readonly record: string
  readonly condition: string
  /** A text that may cite, compared by `op` with `operand`. */
  readonly value: string
  readonly op: AutomationValueOp
  readonly operand: string
  readonly steps: readonly DraftStep[]
}

export type StepKind = DraftStep['kind']

/** A step that holds paths: a branch, an attempt. */
export type PathHolder = Extract<DraftStep, { kind: 'branch' | 'attempt' }>

const holdsPaths = (step: DraftStep): step is PathHolder =>
  step.kind === 'branch' || step.kind === 'attempt'

/** The date a `date_reached` trigger waits for, as the editor holds it. */
export interface DraftDate {
  readonly field: string
  readonly offsetDays: number
  readonly at: string
  readonly timezone: string
}

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
    readonly date: DraftDate
  }
  readonly condition: string
  readonly steps: readonly DraftStep[]
}

/** Whether a trigger has a table — and so a row the steps may act on and cite. */
export const triggerHasTable = (kind: AutomationTriggerKind) =>
  kind !== 'schedule' && kind !== 'webhook'

export const TRIGGER_LABELS: Readonly<Record<AutomationTriggerKind, string>> = {
  record_created: $t('Une ligne est créée'),
  record_updated: $t('Une ligne est modifiée'),
  record_deleted: $t('Une ligne est supprimée'),
  record_matches: $t('Une ligne entre dans un filtre'),
  button: $t('On clique sur un bouton'),
  schedule: $t('À heure fixe'),
  date_reached: $t('Une date arrive'),
  webhook: $t('Un webhook est reçu'),
}

export const TRIGGER_HINTS: Readonly<Record<AutomationTriggerKind, string>> = {
  record_created: $t('Dès qu’une ligne est ajoutée à une table'),
  record_updated: $t('Quand une ligne change — n’importe quel champ, ou certains'),
  record_deleted: $t('Quand une ligne part à la corbeille'),
  record_matches: $t('Quand une ligne se met à remplir une condition'),
  button: $t('Un champ Bouton cliqué sur une ligne'),
  schedule: $t('Chaque heure, chaque jour, chaque semaine'),
  date_reached: $t('À une date d’une ligne, ou quelques jours avant ou après'),
  webhook: $t('Un programme extérieur appelle son adresse'),
}

/** What a trigger does, said whole — the picker's description of the one highlighted. */
export const TRIGGER_DESCRIPTIONS: Readonly<Record<AutomationTriggerKind, string>> = {
  record_created: $t(
    'Part pour chaque ligne créée dans la table — à la main, par un formulaire, une importation ou l’API. Les étapes citent ses valeurs.',
  ),
  record_updated: $t(
    'Part quand une ligne de la table est modifiée ; seulement quand l’un des champs surveillés change, si vous en choisissez.',
  ),
  record_deleted: $t(
    'Part quand une ligne de la table est supprimée. Les étapes citent la ligne telle qu’elle était, mais ne peuvent plus la modifier.',
  ),
  record_matches: $t(
    'Part quand une ligne créée ou modifiée se met à remplir la condition — une fois, et à nouveau seulement après qu’elle a cessé de la remplir.',
  ),
  button: $t(
    'Part quand quelqu’un clique sur un champ Bouton de la table : sur la ligne de ce bouton, avec ses droits à lui pour la voir.',
  ),
  schedule: $t(
    'Part à heure fixe, sans ligne : pour agir sur des lignes, commencez par les chercher ou les parcourir.',
  ),
  date_reached: $t(
    'Part quand la date d’un champ arrive — le jour même, ou décalée de quelques jours —, à l’heure choisie.',
  ),
  webhook: $t(
    'Part quand un programme extérieur envoie une requête à l’adresse de l’automatisation. Les étapes citent ce qu’il a envoyé.',
  ),
}

export const TRIGGER_KEYWORDS: Readonly<Record<AutomationTriggerKind, string>> = {
  record_created: $t('création nouvelle ajoutée insérée||mots-clés de recherche'),
  record_updated: $t('modification changement mise à jour||mots-clés de recherche'),
  record_deleted: $t('suppression effacée corbeille||mots-clés de recherche'),
  record_matches: $t('filtre condition statut devient||mots-clés de recherche'),
  button: $t('bouton clic manuel||mots-clés de recherche'),
  schedule: $t('horaire planifié cron jour semaine heure||mots-clés de recherche'),
  date_reached: $t('date échéance anniversaire rappel relance||mots-clés de recherche'),
  webhook: $t('webhook http api externe appel entrant||mots-clés de recherche'),
}

export interface KindCategory<K extends string> {
  readonly id: string
  readonly label: string
  readonly kinds: readonly K[]
}

export const TRIGGER_CATEGORIES: readonly KindCategory<AutomationTriggerKind>[] = [
  {
    id: 'rows',
    label: $t('Lignes'),
    kinds: ['record_created', 'record_updated', 'record_deleted', 'record_matches', 'button'],
  },
  { id: 'time', label: $t('Temps'), kinds: ['schedule', 'date_reached'] },
  { id: 'outside', label: $t('Extérieur'), kinds: ['webhook'] },
]

export const STEP_LABELS: Readonly<Record<StepKind, string>> = {
  update_record: $t('Modifier une ligne'),
  create_record: $t('Créer une ligne'),
  find_record: $t('Chercher une ligne'),
  delete_record: $t('Supprimer une ligne'),
  aggregate: $t('Compter et additionner'),
  notify: $t('Prévenir quelqu’un'),
  email: $t('Envoyer un courriel'),
  webhook: $t('Appeler un webhook'),
  slack: $t('Envoyer sur Slack'),
  document: $t('Générer un PDF'),
  ai: $t('Demander à l’IA'),
  branch: $t('Condition'),
  for_each: $t('Pour chaque ligne'),
  attempt: $t('Essayer||étape d’automatisation qui rattrape un échec'),
  wait: $t('Attendre||étape d’automatisation'),
  run_automation: $t('Lancer une automatisation'),
}

export const STEP_HINTS: Readonly<Record<StepKind, string>> = {
  update_record: $t('Écrire des valeurs dans la ligne, ou dans celle d’une étape'),
  create_record: $t('Dans cette table ou une autre'),
  find_record: $t('La première ligne qui répond à un filtre'),
  delete_record: $t('Mettre une ligne à la corbeille'),
  aggregate: $t('Les lignes d’un filtre : leur nombre, une somme, une moyenne'),
  notify: $t('Une notification dans basedb'),
  email: $t('À l’équipe ou à l’extérieur, par le serveur d’envoi'),
  webhook: $t('Une requête HTTPS vers un service : méthode, en-têtes, corps'),
  slack: $t('Un message dans un canal connecté'),
  document: $t('Le PDF d’une ligne, d’après un modèle de document'),
  ai: $t('Rédiger, résumer, classer — une réponse pour les étapes suivantes'),
  branch: $t('Des chemins selon ce que dit une ligne'),
  for_each: $t('Répéter des étapes sur chaque ligne qui répond à un filtre'),
  attempt: $t('Rattraper l’échec d’une étape par un autre chemin'),
  wait: $t('Une durée, ou jusqu’à une date d’une ligne'),
  run_automation: $t('Démarrer une autre automatisation de la base'),
}

/** What a step does, said whole — the picker's description of the one highlighted. */
export const STEP_DESCRIPTIONS: Readonly<Record<StepKind, string>> = {
  update_record: $t(
    'Écrit des valeurs dans la ligne déclencheuse, ou dans celle qu’une étape a trouvée ou créée. Une valeur peut citer ce qui précède.',
  ),
  create_record: $t(
    'Ajoute une ligne à une table de la base. Les étapes suivantes la citent ou la modifient.',
  ),
  find_record: $t(
    'Cherche la première ligne qui répond à un filtre, dans l’ordre choisi. Rien trouvé : une condition peut le tester.',
  ),
  delete_record: $t(
    'Met à la corbeille la ligne déclencheuse, ou celle d’une étape, comme toute suppression.',
  ),
  aggregate: $t(
    'Compte les lignes d’une table qui répondent à un filtre, et calcule jusqu’à cinq mesures : somme, moyenne, minimum, maximum.',
  ),
  notify: $t(
    'Une notification dans basedb, à des membres de l’équipe ou à la personne d’un champ, qui ouvre la ligne.',
  ),
  email: $t(
    'Un courriel par le serveur d’envoi de l’instance : à l’équipe, à l’adresse d’un champ ou à des adresses écrites, en texte ou mis en forme, avec des pièces jointes.',
  ),
  webhook: $t(
    'Une requête HTTPS vers un service : méthode, en-têtes, corps. Sa réponse se cite dans les étapes suivantes.',
  ),
  slack: $t('Un message dans un canal Slack connecté à la base.'),
  document: $t(
    'Le PDF d’une ligne, d’après un modèle de document de sa table : ajouté à un champ Document, ou joint à un courriel.',
  ),
  ai: $t(
    'Une consigne au modèle d’IA de l’instance, qui cite ce qui précède. Sa réponse — un texte, un nombre, un choix — sert aux étapes suivantes.',
  ),
  branch: $t(
    'Des chemins selon une ligne ou une valeur : le premier qui convient est pris, « Sinon » quand aucun.',
  ),
  for_each: $t(
    'Répète des étapes sur chaque ligne qui répond à un filtre, jusqu’à 200 lignes par exécution.',
  ),
  attempt: $t(
    'Essaie des étapes ; si l’une échoue, l’exécution continue par un second chemin au lieu de s’arrêter.',
  ),
  wait: $t(
    'Met l’exécution en pause pendant une durée, ou jusqu’à une date d’une ligne, puis reprend à l’étape suivante.',
  ),
  run_automation: $t(
    'Démarre une autre automatisation de la base — sur une ligne, quand son déclencheur en a une.',
  ),
}

export const STEP_KEYWORDS: Readonly<Record<StepKind, string>> = {
  update_record: $t('modifier mettre à jour écrire valeur champ changer||mots-clés de recherche'),
  create_record: $t('ajouter nouvelle insérer enregistrement||mots-clés de recherche'),
  find_record: $t('chercher rechercher trouver filtre||mots-clés de recherche'),
  delete_record: $t('supprimer effacer retirer corbeille||mots-clés de recherche'),
  aggregate: $t(
    'compter somme total moyenne minimum maximum statistiques calcul||mots-clés de recherche',
  ),
  notify: $t('notification alerte prévenir membre||mots-clés de recherche'),
  email: $t('courriel mail email message envoyer||mots-clés de recherche'),
  webhook: $t('webhook http api requête url post||mots-clés de recherche'),
  slack: $t('slack canal message chat||mots-clés de recherche'),
  document: $t('pdf document facture devis imprimer modèle||mots-clés de recherche'),
  ai: $t('ia intelligence artificielle résumer classer rédiger||mots-clés de recherche'),
  branch: $t('condition si sinon test chemin||mots-clés de recherche'),
  for_each: $t('boucle pour chaque répéter parcourir||mots-clés de recherche'),
  attempt: $t('essayer erreur échec rattraper try catch||mots-clés de recherche'),
  wait: $t('attendre pause délai durée plus tard date||mots-clés de recherche'),
  run_automation: $t('lancer automatisation déclencher chaîner||mots-clés de recherche'),
}

/** The steps by what they are about — the picker's categories, in the order shown. */
export const STEP_CATEGORIES: readonly KindCategory<StepKind>[] = [
  {
    id: 'rows',
    label: $t('Lignes'),
    kinds: ['update_record', 'create_record', 'find_record', 'delete_record', 'aggregate'],
  },
  { id: 'communicate', label: $t('Communiquer'), kinds: ['notify', 'email', 'slack', 'webhook'] },
  { id: 'documents', label: $t('Documents'), kinds: ['document'] },
  { id: 'ai', label: $t('IA'), kinds: ['ai'] },
  {
    id: 'logic',
    label: $t('Logique'),
    kinds: ['branch', 'for_each', 'attempt', 'wait', 'run_automation'],
  },
]

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

/** How a path compares a value, in words — and in a sign, for the chip on the canvas. */
export const VALUE_OPS: ReadonlyArray<{
  readonly value: AutomationValueOp
  readonly label: string
  readonly sign: string
}> = [
  { value: 'eq', label: $t('est égal à'), sign: '=' },
  { value: 'ne', label: $t('est différent de'), sign: '≠' },
  { value: 'contains', label: $t('contient'), sign: $t('contient') },
  { value: 'not_contains', label: $t('ne contient pas'), sign: $t('ne contient pas') },
  { value: 'gt', label: $t('est plus grand que'), sign: '>' },
  { value: 'gte', label: $t('est plus grand ou égal à'), sign: '≥' },
  { value: 'lt', label: $t('est plus petit que'), sign: '<' },
  { value: 'lte', label: $t('est plus petit ou égal à'), sign: '≤' },
  { value: 'empty', label: $t('est vide'), sign: $t('est vide') },
  { value: 'not_empty', label: $t('n’est pas vide'), sign: $t('n’est pas vide') },
]

/** Whether a value test compares with something: `empty` and `not_empty` do not. */
export const comparesWith = (op: AutomationValueOp) => op !== 'empty' && op !== 'not_empty'

/** What an aggregate step computes, as the editor names it, and as the steps after cite it. */
export const MEASURE_FNS: ReadonlyArray<{
  readonly value: DraftMeasure['fn']
  readonly label: string
  readonly cited: string
}> = [
  { value: 'sum', label: $t('Somme'), cited: 'somme' },
  { value: 'avg', label: $t('Moyenne||mesure d’une étape d’automatisation'), cited: 'moyenne' },
  { value: 'min', label: $t('Minimum'), cited: 'min' },
  { value: 'max', label: $t('Maximum'), cited: 'max' },
]

const MINUTES_PER: Readonly<Record<AutomationWaitUnit, number>> = {
  minutes: 1,
  hours: 60,
  days: 24 * 60,
}

const DEFAULT_SCHEDULE: AutomationSchedule = {
  every: 'day',
  at: '09:00',
  weekday: 1,
  timezone: 'Europe/Paris',
}

const DEFAULT_DATE: DraftDate = {
  field: '',
  offsetDays: 0,
  at: '09:00',
  timezone: 'Europe/Paris',
}

/** A time of day, `HH:MM`. */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** The fields a step may write: neither computed, nor a button, nor read-only. */
export const writableFields = (fields: readonly Field[]) =>
  fields.filter(
    (f) =>
      f.system !== true &&
      f.read_only !== true &&
      f.ai !== true &&
      !['formula', 'lookup', 'rollup', 'count', 'autonumber', 'button'].includes(f.kind),
  )

const COMPUTED = ['formula', 'lookup', 'rollup']

/** A computed field giving one value of these kinds. */
const computes = (f: Field, kinds: readonly string[]) =>
  COMPUTED.includes(f.kind) &&
  f.computed !== undefined &&
  kinds.includes(f.computed.result_kind) &&
  f.computed.multiple !== true

/** A field holding one number: a number, a count, a formula or a rollup giving one. */
export const isNumericField = (f: Field) =>
  f.kind === 'number' || f.kind === 'count' || computes(f, ['number'])

/** A field holding one date: a date or a datetime, or a formula or a rollup giving one. */
export const isDateField = (f: Field) =>
  f.kind === 'date' || f.kind === 'datetime' || computes(f, ['date', 'datetime'])

/** The fields a measure may be taken of: a number for a sum or an average, a date too for the others. */
export const measurableFields = (fields: readonly Field[], fn: DraftMeasure['fn']) =>
  fields.filter(
    (f) =>
      f.system !== true &&
      (isNumericField(f) || ((fn === 'min' || fn === 'max') && isDateField(f))),
  )

export function emptyDraft(base: DescribedBase): Draft {
  const table = base.tables[0]?.name ?? ''
  return {
    label: $t('Nouvelle automatisation'),
    description: '',
    enabled: true,
    trigger: {
      kind: 'record_created',
      table,
      fields: [],
      schedule: DEFAULT_SCHEDULE,
      date: DEFAULT_DATE,
    },
    condition: '',
    steps: [],
  }
}

// ── The tree ────────────────────────────────────────────────────────────────

/** Every step, depth first, in the order the flow is read. */
export function allSteps(steps: readonly DraftStep[]): DraftStep[] {
  return steps.flatMap((s) =>
    holdsPaths(s)
      ? [s, ...s.paths.flatMap((p) => allSteps(p.steps))]
      : s.kind === 'for_each'
        ? [s, ...allSteps(s.steps)]
        : [s],
  )
}

export function findStep(steps: readonly DraftStep[], id: string): DraftStep | null {
  return allSteps(steps).find((s) => s.id === id) ?? null
}

/** A path, and the branch or the attempt it belongs to. */
export function findPath(
  steps: readonly DraftStep[],
  id: string,
): { readonly branch: PathHolder; readonly path: DraftPath } | null {
  for (const step of allSteps(steps)) {
    if (!holdsPaths(step)) continue
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
    ...allSteps(steps).flatMap((s) => [s.id, ...(holdsPaths(s) ? s.paths.map((p) => p.id) : [])]),
  ])
  let n = 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/**
 * The flow with one sequence rewritten: the root (`null`), a path's, or a loop's — a
 * sequence is named by the path or the loop that holds it.
 */
export function editSequence(
  steps: readonly DraftStep[],
  path: string | null,
  edit: (sequence: readonly DraftStep[]) => readonly DraftStep[],
): DraftStep[] {
  if (path === null) return [...edit(steps)]
  return steps.map((s) =>
    holdsPaths(s)
      ? {
          ...s,
          paths: s.paths.map((p) =>
            p.id === path
              ? { ...p, steps: edit(p.steps) }
              : { ...p, steps: editSequence(p.steps, path, edit) },
          ),
        }
      : s.kind === 'for_each'
        ? { ...s, steps: s.id === path ? edit(s.steps) : editSequence(s.steps, path, edit) }
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
    if (s.kind === 'for_each') {
      const found = locate(s.steps, id, s.id)
      if (found !== null) return found
    }
    if (!holdsPaths(s)) continue
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
    holdsPaths(s)
      ? {
          ...s,
          paths: s.paths.map((p) =>
            p.id === id ? edit(p) : { ...p, steps: replacePath(p.steps, id, edit) },
          ),
        }
      : s.kind === 'for_each'
        ? { ...s, steps: replacePath(s.steps, id, edit) }
        : s,
  )
}

/** A path with nothing in it yet: a row test of `record`, or « Sinon ». */
export function blankPath(
  id: string,
  label: string,
  otherwise: boolean,
  record: string,
): DraftPath {
  return {
    id,
    label,
    otherwise,
    test: 'row',
    record,
    condition: '',
    value: '',
    op: 'eq',
    operand: '',
    steps: [],
  }
}

/**
 * The conditions, attempts and loops that hold a step or a path, outermost first: a
 * path's own branch or attempt counts, a step itself does not.
 */
export function holdersOf(steps: readonly DraftStep[], id: string): DraftStep[] {
  const walk = (
    sequence: readonly DraftStep[],
    around: readonly DraftStep[],
  ): DraftStep[] | null => {
    for (const step of sequence) {
      if (step.id === id) return [...around]
      if (holdsPaths(step)) {
        for (const path of step.paths) {
          if (path.id === id) return [...around, step]
          const inner = walk(path.steps, [...around, step])
          if (inner !== null) return inner
        }
      } else if (step.kind === 'for_each') {
        const inner = walk(step.steps, [...around, step])
        if (inner !== null) return inner
      }
    }
    return null
  }
  return walk(steps, []) ?? []
}

/** What holds a sequence — the root's, a path's, a loop's —, the loop that is it included. */
function holdersOfSequence(steps: readonly DraftStep[], sequence: string | null): DraftStep[] {
  if (sequence === null) return []
  const loop = findStep(steps, sequence)
  return loop?.kind === 'for_each'
    ? [...holdersOf(steps, sequence), loop]
    : holdersOf(steps, sequence)
}

// ── What a step may name ────────────────────────────────────────────────────

/**
 * The steps passed on every way to a step or a path (chapter 17 §1.4): those before it
 * in its sequence, and before each branch or loop that holds it — a loop then gives the
 * row of the turn. A path's own condition sees what came before its branch. What a path
 * or a loop holds is not seen after it; a loop passed gives how many rows it went
 * through. An attempt's second path sees the attempt itself — the error it caught —, and
 * so does what follows it, where that error is empty when nothing failed.
 */
export function stepsBefore(steps: readonly DraftStep[], id: string): DraftStep[] | null {
  const walk = (sequence: readonly DraftStep[], seen: readonly DraftStep[]): DraftStep[] | null => {
    const passed = [...seen]
    for (const step of sequence) {
      if (step.id === id) return passed
      if (holdsPaths(step)) {
        for (const [index, path] of step.paths.entries()) {
          const before = step.kind === 'attempt' && index === 1 ? [...passed, step] : passed
          if (path.id === id) return before
          const inner = walk(path.steps, before)
          if (inner !== null) return inner
        }
        if (step.kind === 'attempt') passed.push(step)
      } else if (step.kind === 'for_each') {
        const inner = walk(step.steps, [...passed, step])
        if (inner !== null) return inner
        passed.push(step)
      } else {
        passed.push(step)
      }
    }
    return null
  }
  return walk(steps, [])
}

/** The loops that hold a step, a path or a sequence — itself not counted. */
export function loopsAround(steps: readonly DraftStep[], id: string): string[] {
  return holdersOf(steps, id)
    .filter((s) => s.kind === 'for_each')
    .map((s) => s.id)
}

/** Whether a sequence — the root, a path's, a loop's — is run once per row of a loop. */
export function inLoop(steps: readonly DraftStep[], sequence: string | null): boolean {
  return holdersOfSequence(steps, sequence).some((s) => s.kind === 'for_each')
}

/** Whether a sequence lies in an attempt — either of its paths. */
export function inAttempt(steps: readonly DraftStep[], sequence: string | null): boolean {
  return holdersOfSequence(steps, sequence).some((s) => s.kind === 'attempt')
}

/** A sequence's steps: the root's, a path's, a loop's. */
function sequenceOf(steps: readonly DraftStep[], path: string | null): readonly DraftStep[] {
  if (path === null) return steps
  const loop = findStep(steps, path)
  if (loop?.kind === 'for_each') return loop.steps
  return findPath(steps, path)?.path.steps ?? []
}

/** The steps before a place where a step is about to be inserted. */
export function stepsAtSlot(
  steps: readonly DraftStep[],
  path: string | null,
  index: number,
): DraftStep[] {
  const loop = path === null ? null : findStep(steps, path)
  const before =
    path === null
      ? []
      : [...(stepsBefore(steps, path) ?? []), ...(loop?.kind === 'for_each' ? [loop] : [])]
  return [
    ...before,
    ...sequenceOf(steps, path)
      .slice(0, index)
      .filter((s) => !holdsPaths(s)),
  ]
}

/**
 * Why a kind of step may not go at a place of the flow — no loop in a loop, no wait in a
 * loop or an attempt, no more than three levels of conditions, attempts and loops.
 */
export function unavailableSteps(
  steps: readonly DraftStep[],
  path: string | null,
): Partial<Record<StepKind, string>> {
  const holders = holdersOfSequence(steps, path)
  const out: Partial<Record<StepKind, string>> = {}
  if (holders.length >= MAX_DEPTH) {
    const deep = $t('{max} niveaux imbriqués au plus', { max: MAX_DEPTH })
    out.branch = deep
    out.attempt = deep
    out.for_each = deep
  }
  if (holders.some((s) => s.kind === 'for_each')) {
    out.for_each = $t('Pas de boucle dans une boucle')
    out.wait = $t('Pas d’attente dans une boucle')
  } else if (holders.some((s) => s.kind === 'attempt')) {
    out.wait = $t('Pas d’attente dans « Essayer »')
  }
  return out
}

/** Where a step about to be inserted goes, in words: after which step, or at the start of what. */
export function slotCaption(
  draft: Draft,
  slot: { readonly path: string | null; readonly index: number },
): string {
  const previous = sequenceOf(draft.steps, slot.path)[slot.index - 1]
  if (previous !== undefined) return $t('Après {step}', { step: stepCaption(previous) })
  if (slot.path === null) return $t('Juste après le déclencheur')
  const loop = findStep(draft.steps, slot.path)
  if (loop?.kind === 'for_each') return $t('Au début de la boucle {id}', { id: loop.id })
  const label = findPath(draft.steps, slot.path)?.path.label || slot.path
  return $t('Au début du chemin « {label} »', { label })
}

/** The table a step's row belongs to, by name; `null` when it gives no row. */
export function rowTableOf(draft: Draft, id: string): string | null {
  if (id === TRIGGER_ROW) return triggerHasTable(draft.trigger.kind) ? draft.trigger.table : null
  const step = findStep(draft.steps, id)
  if (step === null) return null
  if (step.kind === 'find_record' || step.kind === 'create_record' || step.kind === 'for_each')
    return step.table
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

/**
 * The rows a step may act on at a point: the triggering one, then those steps gave — the
 * row of the turn of each loop `around` it; a loop passed gives none.
 */
export function rowChoices(
  draft: Draft,
  base: DescribedBase,
  before: readonly DraftStep[],
  around: readonly string[] = [],
): RowChoice[] {
  const labelOf = (name: string) => base.tables.find((t) => t.name === name)?.label ?? name
  const out: RowChoice[] = []
  if (triggerHasTable(draft.trigger.kind) && draft.trigger.table !== '') {
    out.push({
      value: TRIGGER_ROW,
      label: $t('La ligne déclencheuse ({table})', { table: labelOf(draft.trigger.table) }),
      table: draft.trigger.table,
    })
  }
  for (const step of before) {
    if (step.kind === 'for_each' && !around.includes(step.id)) continue
    const table = rowTableOf(draft, step.id)
    if (table === null || table === '') continue
    const label =
      step.kind === 'for_each'
        ? $t('{step} · la ligne du tour ({table})', { step: step.id, table: labelOf(table) })
        : `${stepCaption(step)} (${labelOf(table)})`
    out.push({ value: step.id, label, table })
  }
  return out
}

/**
 * The rows a step may change — modify, delete, make a PDF of, wait for a date of: a row
 * deleted is cited as it was, never acted on.
 */
export function changeableRows(draft: Draft, rows: readonly RowChoice[]): RowChoice[] {
  return draft.trigger.kind === 'record_deleted'
    ? rows.filter((r) => r.value !== TRIGGER_ROW)
    : [...rows]
}

/** A step as a menu names it: `e2 · Chercher une ligne`. */
export const stepCaption = (step: DraftStep) => `${step.id} · ${STEP_LABELS[step.kind]}`

export interface CiteGroup {
  readonly label: string
  readonly items: ReadonlyArray<{ readonly label: string; readonly token: string }>
}

/** A citation of the body a webhook trigger received: `{{trigger.client.nom}}`. */
const TRIGGER_KEY = /\{\{\s*trigger\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/g

/** The keys of the body received that the flow already cites — what the menu offers again. */
export function triggerKeys(draft: Draft): string[] {
  const texts = allSteps(draft.steps).flatMap((s) => [
    ...citingTexts(s),
    ...(holdsPaths(s)
      ? s.paths.flatMap((p) => [p.condition, ...(p.test === 'value' ? [p.value, p.operand] : [])])
      : []),
  ])
  const keys = new Set(
    texts.flatMap((t) => [...t.matchAll(TRIGGER_KEY)].map((m) => m[1] as string)),
  )
  return [...keys].sort((a, b) => a.localeCompare(b))
}

/**
 * What a text may cite at a point: the triggering row — or the request a webhook
 * received —, then each step before it: the row of the turn of a loop `around` it, how
 * many rows a loop passed went through, what a count, a PDF, an AI or a webhook gave,
 * the error an attempt caught.
 */
export function citeGroups(
  draft: Draft,
  base: DescribedBase,
  before: readonly DraftStep[],
  around: readonly string[] = [],
): CiteGroup[] {
  const tableOf = (name: string | null) => base.tables.find((t) => t.name === name)
  const fieldsOf = (name: string | null) =>
    (tableOf(name)?.fields ?? []).filter((f) => f.system !== true && f.kind !== 'button')
  const groups: CiteGroup[] = []
  if (draft.trigger.kind === 'webhook') {
    groups.push({
      label: $t('La requête reçue'),
      items: [
        ...triggerKeys(draft)
          .filter((k) => k !== 'texte')
          .map((k) => ({ label: k, token: `{{trigger.${k}}}` })),
        { label: $t('Le corps, s’il est du texte'), token: '{{trigger.texte}}' },
      ],
    })
  } else if (triggerHasTable(draft.trigger.kind)) {
    groups.push({
      label:
        draft.trigger.kind === 'record_deleted'
          ? $t('La ligne supprimée, telle qu’elle était')
          : $t('La ligne déclencheuse'),
      items: [
        ...fieldsOf(draft.trigger.table).map((f) => ({ label: f.label, token: `{{${f.name}}}` })),
        { label: $t('Identifiant'), token: '{{_id}}' },
      ],
    })
  }
  for (const step of before) {
    const own = (items: CiteGroup['items']) => groups.push({ label: stepCaption(step), items })
    if (step.kind === 'for_each' && !around.includes(step.id)) {
      own([
        { label: $t('Nombre de lignes parcourues'), token: `{{${step.id}.nombre}}` },
        // A loop that goes on after a failing row says how many failed.
        ...(step.onError === 'continue'
          ? [{ label: $t('Nombre de lignes en échec'), token: `{{${step.id}.echecs}}` }]
          : []),
      ])
      continue
    }
    if (step.kind === 'ai') {
      own([{ label: $t('Sa réponse'), token: `{{${step.id}.reponse}}` }])
      continue
    }
    if (step.kind === 'webhook') {
      own([
        { label: $t('Code de réponse'), token: `{{${step.id}.statut}}` },
        { label: $t('Réponse (une clé : .reponse.clé)'), token: `{{${step.id}.reponse}}` },
      ])
      continue
    }
    if (step.kind === 'aggregate') {
      const fields = tableOf(step.table)?.fields ?? []
      own([
        { label: $t('Nombre de lignes'), token: `{{${step.id}.nombre}}` },
        ...step.measures
          .filter((m) => m.field !== '')
          .map((m) => {
            const fn = MEASURE_FNS.find((f) => f.value === m.fn)
            const field = fields.find((f) => f.name === m.field)?.label ?? m.field
            return {
              label: `${fn?.label ?? m.fn} · ${field}`,
              token: `{{${step.id}.${fn?.cited ?? m.fn}.${m.field}}}`,
            }
          }),
      ])
      continue
    }
    if (step.kind === 'document') {
      own([{ label: $t('Nom du fichier'), token: `{{${step.id}.nom}}` }])
      continue
    }
    if (step.kind === 'attempt') {
      own([
        { label: $t('Code de l’erreur'), token: `{{${step.id}.erreur}}` },
        { label: $t('L’étape qui a échoué'), token: `{{${step.id}.etape}}` },
      ])
      continue
    }
    const table = rowTableOf(draft, step.id)
    if (table === null) continue
    own([
      ...fieldsOf(table).map((f) => ({ label: f.label, token: `{{${step.id}.${f.name}}}` })),
      { label: $t('Identifiant'), token: `{{${step.id}._id}}` },
    ])
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

// ── Webhooks ────────────────────────────────────────────────────────────────

/** The host an address names, as typed — `''` when it names none. */
export function hostOf(url: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(url.trim())?.[1]?.toLowerCase() ?? ''
}

/**
 * A JSON body with each citation stood in for as the run will put it — text inside a
 * string, a value outside — so that what was typed around them can be parsed.
 */
export function withoutJsonCitations(text: string): string {
  let out = ''
  let quoted = false
  let i = 0
  while (i < text.length) {
    const m = text[i] === '{' ? CITATION_AT.exec(text.slice(i)) : null
    if (m !== null) {
      out += quoted ? 'x' : '0'
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

/** What is wrong with a JSON body as typed, or `null`: a courtesy, the kernel stays the judge. */
export function jsonBodyIssue(text: string): string | null {
  if (text.trim() === '') return null
  try {
    JSON.parse(withoutJsonCitations(text))
    return null
  } catch {
    return $t(
      'JSON invalide : des guillemets doubles autour des clés et des textes, une virgule entre deux valeurs.',
    )
  }
}

/** What stops a webhook step from being saved, said before the API does. */
function webhookProblem(step: Extract<DraftStep, { kind: 'webhook' }>): string | null {
  const host = hostOf(step.url)
  if (!/^https:\/\//i.test(step.url.trim()) || host === '') return $t('Adresse https attendue')
  if (host.includes('{')) return $t('L’hôte de l’adresse s’écrit en toutes lettres, sans citation.')
  for (const h of step.headers) {
    if (h.name.trim() === '') {
      if (h.value !== '' || h.kept) return $t('Un en-tête n’a pas de nom')
      continue
    }
    if (h.secret && !h.kept && h.value.trim() === '')
      return $t('Donnez la valeur secrète de « {name} »', { name: h.name.trim() })
    if (h.kept && h.host !== '' && h.host !== host)
      return $t('L’adresse a changé d’hôte : redonnez la valeur de « {name} »', {
        name: h.name.trim(),
      })
  }
  if (!Number.isInteger(step.retries) || step.retries < 0 || step.retries > MAX_RETRIES)
    return $t('De 0 à {max} nouvelles tentatives', { max: MAX_RETRIES })
  if (!hasBody(step.method) || step.body === 'standard') return null
  if (step.template.trim() === '') return $t('Corps vide')
  return step.body === 'json' ? jsonBodyIssue(step.template) : null
}

// ── Mails ───────────────────────────────────────────────────────────────────

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A plain text as the rich editor opens it: a paragraph per line, its characters escaped. */
export function htmlOfText(text: string): string {
  if (text.trim() === '') return ''
  return text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

/** A rich text as plain text: a line per paragraph, an item per line, its entities read. */
export function textOfHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|li|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** How a mail's attachment is told apart in a list — and in a menu's value. */
export const attachmentKey = (a: DraftAttachment) =>
  'step' in a ? `step:${a.step}` : `field:${a.record}:${a.field}`

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
  const pathsOf = (paths: readonly AutomationPath[], attempt: boolean): DraftPath[] =>
    paths.map((p, i) => {
      const id = p.id ?? `c${i + 1}`
      const blank = blankPath(id, p.label, !attempt && p.when === null, TRIGGER_ROW)
      const when = p.when
      const path: DraftPath =
        when === null
          ? attempt
            ? { ...blank, record: '' }
            : blank
          : 'value' in when
            ? { ...blank, test: 'value', value: when.value, op: when.op, operand: when.operand }
            : { ...blank, record: when.record, condition: when.condition }
      return { ...path, steps: stepsOf(p.steps) }
    })
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
        case 'delete_record':
          return { id: idOf(a.id), kind: a.kind, record: a.record }
        case 'aggregate':
          return {
            id: idOf(a.id),
            kind: a.kind,
            table: nameOf(a.table),
            filter: a.filter,
            measures: a.measures.map((m) => ({ fn: m.fn, field: m.field })),
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
        case 'email':
          return {
            id: idOf(a.id),
            kind: a.kind,
            record: a.record ?? '',
            users: a.users,
            userField: a.user_field ?? '',
            emailField: a.email_field ?? '',
            addresses: a.addresses.join(', '),
            subject: a.subject,
            // Written in rich text: a plain message opens as one paragraph per line, and
            // goes back as HTML once saved.
            message: a.format === 'html' ? a.message : htmlOfText(a.message),
            mode: a.mode ?? 'each',
            cc: (a.cc ?? []).join(', '),
            replyTo: a.reply_to ?? '',
            format: 'html',
            attachments: a.attachments ?? [],
          }
        case 'webhook':
          return {
            id: idOf(a.id),
            kind: a.kind,
            record: a.record === undefined ? (hasRow ? TRIGGER_ROW : '') : (a.record ?? ''),
            url: a.url,
            method: a.method ?? 'POST',
            headers: (a.headers ?? []).map((h) => ({
              name: h.name,
              value: h.value ?? '',
              secret: h.secret === true,
              kept: h.secret === true && h.value === null,
              host: h.host ?? '',
            })),
            body: a.body === null || a.body === undefined ? 'standard' : (a.format ?? 'json'),
            template: a.body ?? '',
            retries: a.retries ?? 0,
          }
        case 'for_each':
          return {
            id: idOf(a.id),
            kind: a.kind,
            table: nameOf(a.table),
            filter: a.filter,
            sort: a.sort ?? '',
            limit: a.limit ?? DEFAULT_LOOP_ROWS,
            onError: a.on_error ?? 'stop',
            steps: stepsOf(a.steps),
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
        case 'document':
          return {
            id: idOf(a.id),
            kind: a.kind,
            record: a.record,
            template: a.template ?? '',
            field: a.field ?? '',
            name: a.name,
          }
        case 'run_automation':
          return { id: idOf(a.id), kind: a.kind, automation: a.automation, record: a.record ?? '' }
        case 'wait':
          return {
            id: idOf(a.id),
            kind: a.kind,
            mode: a.until === null ? 'duration' : 'until',
            amount: a.duration?.amount ?? 1,
            unit: a.duration?.unit ?? 'days',
            record: a.until?.record ?? (hasRow ? TRIGGER_ROW : ''),
            field: a.until?.field ?? '',
            offsetDays: a.until?.offset_days ?? 0,
            at: a.until?.at ?? DEFAULT_DATE.at,
            timezone: a.until?.timezone ?? DEFAULT_DATE.timezone,
          }
        case 'branch':
          return { id: idOf(a.id), kind: a.kind, paths: pathsOf(a.paths, false) }
        case 'attempt':
          return { id: idOf(a.id), kind: a.kind, paths: pathsOf(a.paths, true) }
      }
    })
  const date = automation.trigger.date
  return {
    label: automation.label,
    description: automation.description ?? '',
    enabled: automation.enabled,
    trigger: {
      kind: automation.trigger.kind,
      table: nameOf(automation.trigger.table),
      fields: automation.trigger.fields,
      schedule: automation.trigger.schedule ?? DEFAULT_SCHEDULE,
      date:
        date === null || date === undefined
          ? DEFAULT_DATE
          : {
              field: date.field,
              offsetDays: date.offset_days,
              at: date.at,
              timezone: date.timezone,
            },
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

function pathInput(p: DraftPath, attempt: boolean): AutomationPath {
  return {
    id: p.id,
    label: p.label.trim(),
    when:
      attempt || p.otherwise
        ? null
        : p.test === 'value'
          ? {
              value: p.value.trim(),
              op: p.op,
              operand: comparesWith(p.op) ? p.operand.trim() : '',
            }
          : { record: p.record, condition: p.condition.trim() },
    steps: p.steps.map(stepInput),
  }
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
    case 'delete_record':
      return { id: a.id, kind: a.kind, record: a.record }
    case 'aggregate':
      return {
        id: a.id,
        kind: a.kind,
        table: a.table,
        filter: a.filter.trim(),
        measures: a.measures.filter((m) => m.field !== '').map((m) => ({ ...m })),
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
    case 'email':
      return {
        id: a.id,
        kind: a.kind,
        record: a.record === '' ? null : a.record,
        users: a.users,
        user_field: a.userField === '' ? null : a.userField,
        email_field: a.emailField === '' ? null : a.emailField,
        addresses: addressesOf(a.addresses),
        subject: a.subject.trim(),
        message: a.message,
        mode: a.mode,
        // Kept aside while each recipient gets a mail of their own: none sees the others.
        cc: a.mode === 'together' ? addressesOf(a.cc) : [],
        reply_to: a.replyTo.trim() === '' ? null : a.replyTo.trim(),
        format: a.format,
        attachments: a.attachments.map((x) => ({ ...x })),
      }
    case 'webhook': {
      const composed = hasBody(a.method) && a.body !== 'standard'
      return {
        id: a.id,
        kind: a.kind,
        record: a.record === '' ? null : a.record,
        url: a.url.trim(),
        method: a.method,
        // A row left blank is dropped; a secret kept goes back without its value.
        headers: a.headers
          .filter((h) => h.name.trim() !== '' || h.value !== '' || h.kept)
          .map((h) =>
            h.secret
              ? { name: h.name.trim(), value: h.kept ? null : h.value, secret: true }
              : { name: h.name.trim(), value: h.value, secret: false },
          ),
        body: composed ? a.template.trim() : null,
        format: a.body === 'standard' ? 'json' : a.body,
        retries: a.retries,
      }
    }
    case 'for_each':
      return {
        id: a.id,
        kind: a.kind,
        table: a.table,
        filter: a.filter.trim(),
        sort: a.sort === '' ? null : a.sort,
        limit: a.limit,
        on_error: a.onError,
        steps: a.steps.map(stepInput),
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
    case 'document':
      return {
        id: a.id,
        kind: a.kind,
        record: a.record,
        template: a.template === '' ? null : a.template,
        field: a.field === '' ? null : a.field,
        name: a.name.trim(),
      }
    case 'run_automation':
      return {
        id: a.id,
        kind: a.kind,
        automation: a.automation,
        record: a.record === '' ? null : a.record,
      }
    case 'wait':
      return {
        id: a.id,
        kind: a.kind,
        duration: a.mode === 'duration' ? { amount: a.amount, unit: a.unit } : null,
        until:
          a.mode === 'until'
            ? {
                record: a.record,
                field: a.field,
                offset_days: a.offsetDays,
                at: a.at,
                timezone: a.timezone.trim(),
              }
            : null,
      }
    case 'branch':
      return { id: a.id, kind: a.kind, paths: a.paths.map((p) => pathInput(p, false)) }
    case 'attempt':
      return { id: a.id, kind: a.kind, paths: a.paths.map((p) => pathInput(p, true)) }
  }
}

/** What the API saves. */
export function inputOf(draft: Draft): AutomationInput {
  const kind = draft.trigger.kind
  const withTable = triggerHasTable(kind)
  const date = draft.trigger.date
  return {
    label: draft.label.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    enabled: draft.enabled,
    trigger: {
      kind,
      table: withTable ? draft.trigger.table : null,
      fields: kind === 'record_updated' ? draft.trigger.fields : [],
      schedule: kind === 'schedule' ? draft.trigger.schedule : null,
      ...(kind === 'date_reached'
        ? {
            date: {
              field: date.field,
              offset_days: date.offsetDays,
              at: date.at,
              timezone: date.timezone.trim(),
            },
          }
        : {}),
    },
    condition: !withTable || draft.condition.trim() === '' ? null : draft.condition.trim(),
    actions: draft.steps.map(stepInput),
  }
}

/**
 * A new step of a kind at a place of the flow, preset on what is there: the row it acts
 * on is the triggering one when there is one — and it may be changed. A new branch comes
 * with a path and its « Sinon », an attempt with its two paths.
 */
export function newStep(kind: StepKind, draft: Draft, base: DescribedBase, id: string): DraftStep {
  const row = triggerHasTable(draft.trigger.kind) ? TRIGGER_ROW : ''
  // A row deleted is cited, not acted on.
  const changeable = draft.trigger.kind === 'record_deleted' ? '' : row
  const table = base.tables[0]?.name ?? ''
  switch (kind) {
    case 'update_record':
      return { id, kind, record: changeable, values: [{ field: '', value: '' }] }
    case 'create_record':
      return { id, kind, table, values: [{ field: '', value: '' }] }
    case 'find_record':
      return { id, kind, table, filter: '', sort: '' }
    case 'delete_record':
      return { id, kind, record: changeable }
    case 'aggregate':
      return { id, kind, table, filter: '', measures: [] }
    case 'notify':
      return { id, kind, record: row, users: [], userField: '', message: '' }
    case 'email':
      return {
        id,
        kind,
        record: row,
        users: [],
        userField: '',
        emailField: '',
        addresses: '',
        subject: '',
        message: '',
        mode: 'each',
        cc: '',
        replyTo: '',
        format: 'html',
        attachments: [],
      }
    case 'webhook':
      return {
        id,
        kind,
        record: row,
        url: 'https://',
        method: 'POST',
        headers: [],
        body: 'standard',
        template: '',
        retries: 0,
      }
    case 'for_each':
      return {
        id,
        kind,
        table,
        filter: '',
        sort: '',
        limit: DEFAULT_LOOP_ROWS,
        onError: 'stop',
        steps: [],
      }
    case 'slack':
      return { id, kind, integration: '', message: '' }
    case 'ai':
      return { id, kind, prompt: '', answer: 'long_text', options: [], consent: false }
    case 'document':
      return { id, kind, record: changeable, template: '', field: '', name: '' }
    case 'run_automation':
      return { id, kind, automation: '', record: '' }
    case 'wait':
      return {
        id,
        kind,
        mode: 'duration',
        amount: 1,
        unit: 'days',
        record: changeable,
        field: '',
        offsetDays: 0,
        at: DEFAULT_DATE.at,
        timezone: DEFAULT_DATE.timezone,
      }
    case 'branch': {
      const first = freshId(draft.steps, 'c')
      const second = freshId(draft.steps, 'c', [first])
      return {
        id,
        kind,
        paths: [blankPath(first, $t('Si'), false, row), blankPath(second, $t('Sinon'), true, row)],
      }
    }
    case 'attempt': {
      const first = freshId(draft.steps, 'c')
      const second = freshId(draft.steps, 'c', [first])
      return {
        id,
        kind,
        paths: [
          blankPath(first, $t('Essayer||premier chemin d’une étape « Essayer »'), false, ''),
          blankPath(second, $t('En cas d’échec'), false, ''),
        ],
      }
    }
  }
}

/**
 * « Si aucune ligne n’est trouvée… », after a search: a condition whose first path tests
 * that the search found nothing — its row has no identifier —, the other going on with
 * the row found.
 */
export function notFoundBranch(draft: Draft, find: string, id: string): DraftStep {
  const first = freshId(draft.steps, 'c')
  const second = freshId(draft.steps, 'c', [first])
  return {
    id,
    kind: 'branch',
    paths: [
      {
        ...blankPath(first, $t('Aucune ligne trouvée'), false, find),
        test: 'value',
        value: `{{${find}._id}}`,
        op: 'empty',
      },
      blankPath(second, $t('Ligne trouvée'), true, find),
    ],
  }
}

// ── What the editor says of a step ──────────────────────────────────────────

const personOf = (members: readonly Member[], id: string) => {
  const m = members.find((x) => x.id === id)
  return m === undefined ? $t('une personne') : m.display_name || m.email
}

/** A duration in words: « 3 jours », « 1 heure ». */
export function durationText(amount: number, unit: AutomationWaitUnit): string {
  const n = Number.isFinite(amount) ? amount : 0
  if (unit === 'minutes') return $tp(n, '{count} minute', '{count} minutes')
  if (unit === 'hours') return $tp(n, '{count} heure', '{count} heures')
  return $tp(n, '{count} jour', '{count} jours')
}

/** A shift of days in words: « le jour même », « 3 jours avant », « 1 jour après ». */
export function offsetText(days: number): string {
  if (!Number.isFinite(days) || days === 0) return $t('le jour même')
  return days < 0
    ? $tp(-days, '{count} jour avant', '{count} jours avant')
    : $tp(days, '{count} jour après', '{count} jours après')
}

/** A step in a line, for its card on the flow. */
export function stepSummary(
  step: DraftStep,
  draft: Draft,
  base: DescribedBase,
  members: readonly Member[],
  automations: readonly Automation[] = [],
): string {
  const tableLabel = (name: string | null) =>
    base.tables.find((t) => t.name === name)?.label ?? name ?? ''
  const fieldLabel = (table: string | null, name: string) =>
    base.tables.find((t) => t.name === table)?.fields.find((f) => f.name === name)?.label ?? name
  const fieldLabels = (table: string | null, rows: readonly ValueRow[]) =>
    rows
      .filter((r) => r.field !== '')
      .map((r) => fieldLabel(table, r.field))
      .join(', ')
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
    case 'for_each':
    case 'aggregate':
      return $t('Dans {table}{value}', {
        table: tableLabel(step.table),
        value: step.filter.trim() === '' ? '' : ` · ${step.filter.trim()}`,
      })
    case 'delete_record':
      return step.record === ''
        ? $t('Aucune ligne à supprimer')
        : step.record === TRIGGER_ROW
          ? $t('La ligne déclencheuse')
          : $t('La ligne de {record}', { record: step.record })
    case 'notify': {
      const people = step.users.map((u) => personOf(members, u))
      if (step.userField !== '')
        people.push($t('le champ {userField}', { userField: step.userField }))
      return people.length === 0 ? $t('Personne à prévenir') : people.join(', ')
    }
    case 'email': {
      const to = [
        ...step.users.map((u) => personOf(members, u)),
        ...(step.userField === ''
          ? []
          : [$t('le champ {userField}', { userField: step.userField })]),
        ...(step.emailField === ''
          ? []
          : [$t('le champ {userField}', { userField: step.emailField })]),
        ...addressesOf(step.addresses),
      ]
      const subject = step.subject.trim() === '' ? $t('Sans objet') : step.subject.trim()
      return to.length === 0 ? $t('Aucun destinataire') : `${subject} → ${to.join(', ')}`
    }
    case 'webhook':
      return `${step.method} ${hostOf(step.url) || step.url}`
    case 'slack':
      return step.message.trim() === '' ? $t('Aucun message') : step.message
    case 'ai':
      return step.prompt.trim() === ''
        ? $t('Aucune consigne')
        : step.prompt.replace(/\s+/g, ' ').trim()
    case 'document': {
      const what =
        step.name.trim() !== ''
          ? step.name.trim()
          : step.template === ''
            ? $t('La fiche de la ligne')
            : $t('Un modèle de document')
      const into =
        step.field === '' ? '' : ` → ${fieldLabel(rowTableOf(draft, step.record), step.field)}`
      return `${what}${into}${on(step.record)}`
    }
    case 'run_automation': {
      if (step.automation === '') return $t('Aucune automatisation choisie')
      const target = automations.find((a) => a.id === step.automation)
      return target === undefined ? $t('Une autre automatisation') : target.label
    }
    case 'wait':
      if (step.mode === 'duration') return durationText(step.amount, step.unit)
      return step.field === ''
        ? $t('Jusqu’à une date à choisir')
        : $t('Jusqu’à {field}, {offset}', {
            field: fieldLabel(rowTableOf(draft, step.record), step.field),
            offset: offsetText(step.offsetDays),
          })
    case 'branch':
      return $tp(step.paths.length, '{count} chemin', '{count} chemins')
    case 'attempt':
      return $t('Un second chemin si une étape échoue')
  }
}

const CITED = /\{\{\s*([A-Za-z0-9_]+)\.[A-Za-z0-9_.]+\s*\}\}/g

/** The steps a text cites: `{{e2.champ}}` names `e2`; `{{trigger.clé}}` names the request. */
const citedSteps = (text: string) =>
  [...text.matchAll(CITED)].map((m) => m[1] as string).filter((name) => name !== TRIGGER_ROW)

/** The texts of a step that may cite, as it sends them. */
function citingTexts(step: DraftStep): string[] {
  switch (step.kind) {
    case 'update_record':
    case 'create_record':
      return step.values.map((r) => r.value)
    case 'find_record':
    case 'for_each':
    case 'aggregate':
      return [step.filter]
    case 'notify':
    case 'slack':
      return [step.message]
    case 'email':
      return [step.subject, step.message, step.replyTo]
    case 'webhook':
      return [
        step.url,
        ...step.headers.flatMap((h) => (h.secret ? [] : [h.value])),
        ...(step.body !== 'standard' && hasBody(step.method) ? [step.template] : []),
      ]
    case 'ai':
      return [step.prompt]
    case 'document':
      return [step.name]
    case 'delete_record':
    case 'run_automation':
    case 'wait':
    case 'branch':
    case 'attempt':
      return []
  }
}

/** The steps a step names — the row it acts on, what it attaches, the steps its texts cite. */
export function referencesOf(step: DraftStep): string[] {
  const row = (record: string) => (record === TRIGGER_ROW || record === '' ? [] : [record])
  const rows = (): string[] => {
    switch (step.kind) {
      case 'update_record':
      case 'notify':
      case 'delete_record':
      case 'document':
      case 'run_automation':
        return row(step.record)
      case 'email':
        return [
          ...row(step.record),
          ...step.attachments.flatMap((a) => ('step' in a ? [a.step] : row(a.record))),
        ]
      case 'webhook':
        return step.body === 'standard' && hasBody(step.method) ? row(step.record) : []
      case 'wait':
        return step.mode === 'until' ? row(step.record) : []
      default:
        return []
    }
  }
  return [...rows(), ...citingTexts(step).flatMap(citedSteps)]
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

/** What a row deleted refuses: the steps that would change it. */
const deletedRow = (draft: Draft, record: string) =>
  draft.trigger.kind === 'record_deleted' && record === TRIGGER_ROW
    ? $t('La ligne supprimée se cite, mais ne se change plus')
    : null

/** What stops a step from being saved, said before the API does; `null`: nothing. */
export function stepProblem(
  step: DraftStep,
  draft: Draft,
  automations: readonly Automation[] | null = null,
): string | null {
  const missing = missingReference(referencesOf(step), draft, step.id)
  if (missing !== null) return missing
  const holders = holdersOf(draft.steps, step.id)
  if ((holdsPaths(step) || step.kind === 'for_each') && holders.length >= MAX_DEPTH)
    return $t('{max} niveaux imbriqués au plus', { max: MAX_DEPTH })
  switch (step.kind) {
    case 'update_record':
      if (step.record === '') return $t('Aucune ligne à modifier')
      return (
        deletedRow(draft, step.record) ??
        (step.values.some((v) => v.field !== '') ? null : $t('Aucun champ à écrire'))
      )
    case 'create_record':
      if (step.table === '') return $t('Choisissez une table')
      return step.values.some((v) => v.field !== '') ? null : $t('Aucun champ à écrire')
    case 'find_record':
      return step.table === '' ? $t('Choisissez une table') : null
    case 'delete_record':
      if (step.record === '') return $t('Aucune ligne à supprimer')
      return deletedRow(draft, step.record)
    case 'aggregate':
      if (step.table === '') return $t('Choisissez une table')
      if (step.measures.length > MAX_MEASURES)
        return $t('{max} mesures au plus', { max: MAX_MEASURES })
      return step.measures.some((m) => m.field === '') ? $t('Une mesure n’a pas de champ') : null
    case 'for_each':
      if (step.table === '') return $t('Choisissez une table')
      if (loopsAround(draft.steps, step.id).length > 0) return $t('Pas de boucle dans une boucle')
      return Number.isInteger(step.limit) && step.limit >= 1 && step.limit <= MAX_LOOP_ROWS
        ? null
        : $t('De 1 à {max} lignes', { max: MAX_LOOP_ROWS })
    case 'notify':
      if (step.users.length === 0 && step.userField === '') return $t('Personne à prévenir')
      if (step.message.trim() === '') return $t('Message vide')
      return step.record === '' ? $t('Aucune ligne : la notification ne partira pas') : null
    case 'email':
      return emailProblem(step)
    case 'webhook':
      return webhookProblem(step)
    case 'slack':
      if (step.integration === '') return $t('Choisissez un canal')
      return step.message.trim() === '' ? $t('Message vide') : null
    case 'ai':
      if (step.prompt.trim() === '') return $t('Consigne vide')
      if (step.answer === 'select' && !step.options.some((o) => o.trim() !== ''))
        return $t('Aucun choix proposé')
      return step.consent ? null : $t('Accord à donner pour l’envoi au fournisseur')
    case 'document':
      if (step.record === '') return $t('Aucune ligne dont faire le PDF')
      return deletedRow(draft, step.record)
    case 'run_automation': {
      if (step.automation === '') return $t('Choisissez l’automatisation à lancer')
      if (automations === null) return null
      const target = automations.find((a) => a.id === step.automation)
      if (target === undefined) return $t('Cette automatisation n’existe plus')
      return target.trigger.table !== null && step.record === ''
        ? $t('Choisissez la ligne sur laquelle la lancer')
        : null
    }
    case 'wait':
      return waitProblem(step, draft, holders)
    case 'branch':
      for (const path of step.paths) {
        const problem = pathProblem(path, draft)
        if (problem !== null) return `${path.label || $t('Un chemin')} : ${problem}`
      }
      return null
    case 'attempt':
      return step.paths.length === 2 ? null : $t('« Essayer » a exactement deux chemins')
  }
}

function emailProblem(step: Extract<DraftStep, { kind: 'email' }>): string | null {
  const written = addressesOf(step.addresses)
  const wrong = written.find((a) => !ADDRESS.test(a))
  if (wrong !== undefined) return $t('Adresse invalide : {wrong}', { wrong })
  if (
    step.users.length === 0 &&
    step.userField === '' &&
    step.emailField === '' &&
    written.length === 0
  )
    return $t('Aucun destinataire')
  if (step.users.length + written.length > MAX_RECIPIENTS)
    return $t('{max} destinataires au plus', { max: MAX_RECIPIENTS })
  if (step.mode === 'together') {
    const cc = addressesOf(step.cc)
    const wrongCc = cc.find((a) => !ADDRESS.test(a))
    if (wrongCc !== undefined) return $t('Adresse en copie invalide : {wrong}', { wrong: wrongCc })
    if (cc.length > MAX_CC) return $t('{max} adresses en copie au plus', { max: MAX_CC })
  }
  const replyTo = step.replyTo.trim()
  if (replyTo !== '' && !ADDRESS.test(replyTo) && !ONLY_CITATION.test(replyTo))
    return $t('Répondre à : une adresse, ou une citation')
  if (step.attachments.length > MAX_ATTACHMENTS)
    return $t('{max} pièces jointes au plus', { max: MAX_ATTACHMENTS })
  if (step.subject.trim() === '') return $t('Objet vide')
  return isBlankHtml(step.message) ? $t('Message vide') : null
}

function waitProblem(
  step: Extract<DraftStep, { kind: 'wait' }>,
  draft: Draft,
  holders: readonly DraftStep[],
): string | null {
  if (holders.some((s) => s.kind === 'for_each')) return $t('Pas d’attente dans une boucle')
  if (holders.some((s) => s.kind === 'attempt')) return $t('Pas d’attente dans « Essayer »')
  if (step.mode === 'duration') {
    const minutes = step.amount * MINUTES_PER[step.unit]
    return Number.isInteger(step.amount) &&
      step.amount >= 1 &&
      minutes <= MAX_WAIT_DAYS * MINUTES_PER.days
      ? null
      : $t('De 1 minute à {max} jours', { max: MAX_WAIT_DAYS })
  }
  if (step.record === '') return $t('Aucune ligne dont attendre la date')
  const deleted = deletedRow(draft, step.record)
  if (deleted !== null) return deleted
  if (step.field === '') return $t('Choisissez le champ date')
  if (!Number.isInteger(step.offsetDays) || Math.abs(step.offsetDays) > MAX_WAIT_DAYS)
    return $t('Décalage de −{max} à {max} jours', { max: MAX_WAIT_DAYS })
  return TIME.test(step.at) ? null : $t('Heure invalide')
}

/** What is wrong with a path's test; `null`: nothing. */
export function pathProblem(path: DraftPath, draft: Draft): string | null {
  if (path.otherwise) return null
  const holder = findPath(draft.steps, path.id)?.branch
  // An attempt's paths test nothing: the first is tried, the second taken on a failure.
  if (holder?.kind === 'attempt') return null
  if (path.test === 'value') {
    if (path.value.trim() === '') return $t('aucune valeur à tester')
    if (comparesWith(path.op) && path.operand.trim() === '')
      return $t('à quoi la comparer ? « est vide » teste une valeur absente')
    const missing = missingReference(
      [...citedSteps(path.value), ...(comparesWith(path.op) ? citedSteps(path.operand) : [])],
      draft,
      path.id,
    )
    return missing === null ? null : missing.charAt(0).toLowerCase() + missing.slice(1)
  }
  if (path.record === '') return $t('aucune ligne à tester')
  // The triggering row always exists: with no filter, the paths after it are never taken.
  const last = holder?.paths[holder.paths.length - 1]?.id === path.id
  if (path.record === TRIGGER_ROW && path.condition.trim() === '' && !last)
    return $t('toujours pris : donnez-lui une condition')
  const names = [
    ...(path.record === TRIGGER_ROW ? [] : [path.record]),
    ...citedSteps(path.condition),
  ]
  const missing = missingReference(names, draft, path.id)
  return missing === null ? null : missing.charAt(0).toLowerCase() + missing.slice(1)
}

/** A path's test in a line; an attempt's paths say when they run. */
export function pathSummary(path: DraftPath, holder: PathHolder | null = null): string {
  if (holder?.kind === 'attempt')
    return holder.paths[0]?.id === path.id
      ? $t('les étapes essayées')
      : $t('si une étape essayée échoue')
  if (path.otherwise) return $t('quand aucun autre ne convient')
  if (path.test === 'value') {
    const op = VALUE_OPS.find((o) => o.value === path.op)?.sign ?? path.op
    const value = path.value.trim() || '…'
    return comparesWith(path.op) ? `${value} ${op} ${path.operand.trim() || '…'}` : `${value} ${op}`
  }
  const row = path.record === TRIGGER_ROW ? '' : `${path.record} : `
  if (path.condition.trim() === '')
    return path.record === TRIGGER_ROW
      ? $t('Toujours')
      : $t('{record} a trouvé une ligne', { record: path.record })
  return `${row}${path.condition.trim()}`
}

/** What stops the trigger from being saved, said before the API does; `null`: nothing. */
export function triggerProblem(draft: Draft): string | null {
  const t = draft.trigger
  if (triggerHasTable(t.kind) && t.table === '') return $t('Choisissez une table')
  if (t.kind === 'record_matches' && draft.condition.trim() === '')
    return $t('Donnez le filtre où la ligne doit entrer')
  if (t.kind === 'date_reached') {
    if (t.date.field === '') return $t('Choisissez le champ date à surveiller')
    if (!Number.isInteger(t.date.offsetDays) || Math.abs(t.date.offsetDays) > MAX_WAIT_DAYS)
      return $t('Décalage de −{max} à {max} jours', { max: MAX_WAIT_DAYS })
    if (!TIME.test(t.date.at)) return $t('Heure invalide')
  }
  return null
}

// ── Runs ────────────────────────────────────────────────────────────────────

const RUN_REASONS: Readonly<Record<string, string>> = {
  condition_fausse: $t('la condition n’était pas remplie'),
  ligne_introuvable: $t('la ligne n’existe plus'),
  desactivee: $t('l’automatisation était désactivée'),
  supprimee: $t('l’automatisation a été supprimée'),
  proprietaire_inactif: $t('son propriétaire n’a plus de compte actif'),
  debit: $t('plus de 100 exécutions dans l’heure'),
  regle_de_lignes: $t(
    'son propriétaire ne lit cette table qu’à travers une règle de lignes : une ligne supprimée ne lui est pas montrée',
  ),
}

/** An instant as the reader's language writes it: « 3 oct. 2026, 09:00 ». */
export function instantText(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  )
}

/** A run in a sentence: what happened, and why not. */
export function runSentence(run: AutomationRun): string {
  switch (run.status) {
    case 'queued':
      return $t('En attente')
    case 'running':
      return $t('En cours')
    case 'waiting':
      return run.resume_at === null || run.resume_at === undefined
        ? $t('En pause')
        : $t('En pause, reprend le {date}', { date: instantText(run.resume_at) })
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
  record_deleted: $t('ligne supprimée'),
  record_matches: $t('ligne entrée dans le filtre'),
  date_reached: $t('date atteinte'),
  webhook: $t('webhook reçu'),
  automation: $t('lancée par une automatisation'),
  schedule: $t('horloge||ce qui a lancé une exécution'),
  button: $t('bouton||ce qui a lancé une exécution'),
  test: $t('essai||ce qui a lancé une exécution'),
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

/** Why a step failed, when the kernel says it in a word of its own rather than a code. */
const STEP_FAILURES: Readonly<Record<string, string>> = {
  chaine_trop_longue: $t('trop d’automatisations lancées l’une par l’autre — 3 au plus'),
  automation_inconnue: $t('l’automatisation à lancer n’existe plus'),
  table_differente: $t('la ligne donnée n’est pas de la table de l’automatisation lancée'),
  pieces_jointes_trop_lourdes: $t('les pièces jointes dépassent 15 Mo'),
  document_perdu: $t('le PDF à joindre ne se retrouve plus'),
  stockage_absent: $t('cette instance n’a pas de stockage de fichiers'),
  reponse_a_invalide: $t('l’adresse de réponse citée n’est pas une adresse e-mail'),
}

/** A step of a run in a sentence. */
export function runStepSentence(record: RunStepRecord): string {
  if (record.status === 'failed') {
    const code = record.error_code ?? 'INTERNAL_ERROR'
    const own = STEP_FAILURES[code] ?? STEP_FAILURES[record.detail ?? '']
    if (own !== undefined) return $t('échec : {replace}', { replace: own })
    const sentence = sentenceFor(code)
    return sentence === code
      ? $t('échec ({code})', { code })
      : $t('échec : {replace}', { replace: sentence.replace(/\.$/, '') })
  }
  // A step inside a loop says how many turns it ran.
  const sentence = stepSentence(record)
  return record.times === undefined || record.times < 2
    ? sentence
    : `${sentence} · ${$tp(record.times, '{count} fois', '{count} fois')}`
}

function stepSentence(record: RunStepRecord): string {
  if (record.status === 'skipped')
    return record.detail === 'aucune_ligne'
      ? $t('passée : aucune ligne')
      : record.detail === 'aucun_destinataire'
        ? $t('passée : aucun destinataire')
        : $t('passée')
  if (record.kind === 'for_each') {
    // `12`, or `10/2` when a loop went on after 2 failing rows.
    const [through, failing] = (record.detail ?? '0').split('/')
    const turns = $tp(Number(through ?? 0), '{count} ligne parcourue', '{count} lignes parcourues')
    const limited = record.more === true ? $t('{turns} — limite atteinte', { turns }) : turns
    const failed = Number(failing ?? 0)
    return failed > 0
      ? `${limited} · ${$tp(failed, '{count} en échec', '{count} en échec')}`
      : limited
  }
  if (record.kind === 'find_record')
    return record.detail === 'aucune' ? $t('aucune ligne trouvée') : $t('ligne trouvée')
  if (record.kind === 'branch' && (record.taken?.length ?? 0) > 1)
    return $tp(record.taken?.length ?? 0, '{count} chemin pris', '{count} chemins pris')
  if (record.kind === 'branch')
    return record.path === null
      ? $t('aucun chemin ne convenait')
      : $t('chemin « {detail} »', { detail: record.detail })
  // An attempt names the path it ended on: the first when nothing failed.
  if (record.kind === 'attempt')
    return record.detail === undefined
      ? $t('fait')
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
  if (record.kind === 'email')
    return $tp(
      Number(record.detail ?? 0),
      '{count} courriel en partance',
      '{count} courriels en partance',
    )
  if (record.kind === 'webhook' && record.detail !== undefined)
    return $t('réponse {detail}', { detail: record.detail })
  if (record.kind === 'aggregate' && record.detail !== undefined && record.detail !== '')
    return $tp(Number(record.detail), '{count} ligne comptée', '{count} lignes comptées')
  if (record.kind === 'delete_record') return $t('ligne mise à la corbeille')
  if (record.kind === 'document')
    return record.detail === undefined || record.detail === ''
      ? $t('PDF généré')
      : $t('« {detail} » généré', { detail: record.detail })
  if (record.kind === 'run_automation') return $t('automatisation lancée')
  if (record.kind === 'wait' && record.detail === 'aucune_date')
    return $t('aucune date à attendre : l’exécution a continué')
  if (record.kind === 'wait' && record.detail !== undefined && record.detail !== '')
    return $t('attente jusqu’au {date}', { date: instantText(record.detail) })
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
  champ_email_attendu: () => $t('Le champ d’adresse doit être un champ E-mail.'),
  adresse_email: (d) => $t('« {d} » n’est pas une adresse e-mail.', { d }),
  trop_de_destinataires: (d) => $t('{d} destinataires au plus.', { d }),
  destinataire_manquant: () => $t('Choisissez au moins un destinataire.'),
  objet_invalide: () => $t('L’objet est vide, trop long, ou sur plusieurs lignes.'),
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
  cible_refusee: () =>
    $t('Cette adresse n’est pas joignable depuis le serveur, ou pointe vers un réseau privé.'),
  https_requis: () => $t('Une adresse en https est attendue.'),
  hote_cite: () => $t('L’hôte de l’adresse s’écrit en toutes lettres, sans citation.'),
  methode_inconnue: (d) => $t('Méthode HTTP inconnue : « {d} ».', { d }),
  format_inconnu: (d) => $t('Format de corps inconnu : « {d} ».', { d }),
  trop_d_entetes: (d) => $t('{d} en-têtes au plus.', { d }),
  entete_invalide: (d) => $t('Nom d’en-tête invalide : « {d} ».', { d }),
  entete_interdit: (d) => $t('L’en-tête « {d} » est fixé par HTTP lui-même.', { d }),
  entete_en_double: (d) => $t('L’en-tête « {d} » est donné deux fois.', { d }),
  valeur_d_entete_invalide: (d) =>
    $t('La valeur de l’en-tête « {d} » est trop longue, ou sur plusieurs lignes.', { d }),
  secret_manquant: (d) => $t('Donnez la valeur secrète de l’en-tête « {d} ».', { d }),
  secret_a_redonner: (d) =>
    $t(
      'L’adresse a changé d’hôte : redonnez la valeur secrète de l’en-tête « {d} », qui ne part pas ailleurs.',
      { d },
    ),
  secret_impossible: () =>
    $t('Cette instance n’a pas de clé de chiffrement : elle ne peut garder aucun secret.'),
  corps_vide: () => $t('Le corps de la requête est vide.'),
  corps_trop_long: (d) => $t('Corps trop long : {d} caractères au plus.', { d }),
  corps_json_invalide: () => $t('Le corps n’est pas un JSON valide.'),
  corps_formulaire_invalide: () => $t('Chaque ligne du formulaire s’écrit clé=valeur.'),
  corps_sans_objet: (d) => $t('Une requête {method} n’envoie pas de corps.', { method: d }),
  boucle_dans_boucle: () => $t('Une boucle ne peut pas en contenir une autre.'),
  limite_invalide: (d) => $t('Une boucle parcourt de 1 à {d} lignes.', { d }),
  ligne_supprimee: () =>
    $t(
      'La ligne déclencheuse est supprimée : une étape peut la citer, mais plus la modifier, la supprimer, en faire un PDF ni attendre une de ses dates.',
    ),
  condition_requise: () =>
    $t('« Une ligne entre dans un filtre » demande une condition : le filtre où la ligne entre.'),
  champ_date_attendu: (d) =>
    $t('Le champ « {d} » doit être une date, ou une date et heure.', { d }),
  decalage_invalide: () => $t('Le décalage va de −365 à 365 jours.'),
  attente_invalide: () =>
    $t(
      'Une attente dure de 1 minute à 365 jours, ou va jusqu’à la date d’une ligne : l’un ou l’autre.',
    ),
  attente_dans_boucle: () => $t('Une attente ne peut pas être dans une boucle.'),
  attente_dans_essai: () => $t('Une attente ne peut pas être dans « Essayer ».'),
  automation_inconnue: () =>
    $t('L’automatisation à lancer n’existe pas, ou plus, dans cette base.'),
  automation_elle_meme: () => $t('Une automatisation ne peut pas se lancer elle-même.'),
  ligne_requise: () =>
    $t(
      'L’automatisation à lancer agit sur une ligne de sa table : choisissez sur laquelle la lancer.',
    ),
  table_differente: () =>
    $t('La ligne donnée n’est pas de la table qu’attend l’automatisation à lancer.'),
  modele_inconnu: () => $t('Ce modèle de document n’existe pas, ou plus, pour cette table.'),
  champ_fichier_attendu: (d) => $t('Le champ « {d} » doit être un champ Document.', { d }),
  mesure_invalide: (d) =>
    $t(
      'Mesure impossible sur « {d} » : une somme ou une moyenne veut un nombre, un minimum ou un maximum un nombre ou une date.',
      { d },
    ),
  trop_de_mesures: (d) => $t('{d} mesures au plus.', { d }),
  piece_jointe_invalide: () =>
    $t(
      'Une pièce jointe est le PDF d’une étape précédente, ou un champ Document ou Image d’une ligne.',
    ),
  trop_de_pieces_jointes: (d) => $t('{d} pièces jointes au plus.', { d }),
  copie_sans_envoi_groupe: () =>
    $t('Des adresses en copie supposent un seul courriel à tous : choisissez cet envoi.'),
  reponse_a_invalide: () =>
    $t('« Répondre à » attend une adresse e-mail, ou une citation qui en donne une.'),
  essai_deux_chemins: () => $t('« Essayer » a exactement deux chemins.'),
  operateur_inconnu: (d) => $t('Opérateur de comparaison inconnu : « {d} ».', { d }),
  reessais_invalides: () => $t('Un webhook se réessaie de 0 à 3 fois.'),
  valeur_invalide: () =>
    $t('Une valeur à comparer est vide, ou trop longue : 1 000 caractères au plus.'),
  action_inconnue: (d) => $t('Type d’étape inconnu : « {d} ».', { d }),
  etapes_invalides: () => $t('Les étapes de l’automatisation sont illisibles.'),
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
