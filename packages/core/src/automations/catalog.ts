import { createHash, randomBytes } from 'node:crypto'
import { AI_KINDS, type AiKind } from '../ai/answer.js'
import { resolveProvider } from '../ai/draft.js'
import { MAX_PROMPT_CHARS } from '../ai/prompt.js'
import { seal, unseal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { isAddress } from '../mail/message.js'
import { requireOnBase } from '../rbac/require.js'
import { sanitizeRichText } from '../records/rich-text.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'

/**
 * Automations — chapter 17: what one is, and how it is kept. A trigger, a condition, a
 * flow of steps — one after the other, branching on what a row holds, each able to cite
 * what the steps before it found or wrote — acting on the authority of its owner, the
 * last person who saved it. Everything a definition names is checked here, at write time,
 * and read again, with the owner's rights, at every run.
 */

export type TriggerKind =
  | 'record_created'
  | 'record_updated'
  | 'schedule'
  | 'button'
  | 'record_deleted'
  | 'record_matches'
  | 'date_reached'
  | 'webhook'

/** The triggers that carry no table: a clock, and a call from outside. */
export const TABLELESS: ReadonlySet<TriggerKind> = new Set(['schedule', 'webhook'])

/**
 * A date that arrives (chapter 17 §1.1): the date a field of the row holds, moved by days
 * — `-3`: three days before —, at a time of day in a time zone; a date-and-time field keeps
 * its own time.
 */
export interface DateTrigger {
  readonly field: string
  readonly offsetDays: number
  /** `HH:MM`, for a field holding a date alone. */
  readonly at: string
  readonly timezone: string
}

export interface Schedule {
  readonly every: 'hour' | 'day' | 'week'
  /** `HH:MM`; only the minutes count for `hour`. */
  readonly at: string
  /** 1 (Monday) to 7, for `week`. */
  readonly weekday: number
  readonly timezone: string
}

/**
 * The row a step acts on (chapter 17 §1.4): `trigger`, the one that triggered, or the
 * identifier of a step before it that found, created or modified one.
 */
export type RowSource = string

export const TRIGGER_ROW = 'trigger'

export type HttpMethod = 'POST' | 'PUT' | 'PATCH' | 'GET' | 'DELETE'

/** How a webhook's own body is written: JSON, `clé=valeur` pairs, or plain text. */
export type BodyFormat = 'json' | 'form' | 'text'

/**
 * A header a webhook step sends (chapter 17 §1.3). A secret one — a key, a token — is
 * sealed by the instance key, for its base and for the host it was given for, and never
 * read back: the API shows its name alone, a save that leaves its value out keeps it, and
 * a new host asks for it again — it cannot be sent elsewhere by changing the address.
 */
export type WebhookHeader =
  | { readonly name: string; readonly value: string }
  | { readonly name: string; readonly sealed: string; readonly host: string }

/** What a secret header is sealed for: one purpose of the instance key (A25). */
export const WEBHOOK_SECRET = 'automation/webhook-header'

export type AutomationStep =
  | {
      readonly id: string
      readonly kind: 'update_record'
      readonly record: RowSource
      readonly values: Readonly<Record<string, unknown>>
    }
  | {
      readonly id: string
      readonly kind: 'create_record'
      /** The table's catalog key. */
      readonly table: string
      readonly values: Readonly<Record<string, unknown>>
    }
  | {
      readonly id: string
      readonly kind: 'find_record'
      /** The table's catalog key. */
      readonly table: string
      /** In the language of filters, citing what came before; empty: any row. */
      readonly filter: string
      /** `champ` or `-champ`: which row comes first when several match. */
      readonly sort: string | null
    }
  | {
      readonly id: string
      readonly kind: 'notify'
      /** The row the notification is about; `null`: none (a schedule with no row). */
      readonly record: RowSource | null
      readonly users: readonly string[]
      /** A person field of that row, whose person is notified too. */
      readonly userField: string | null
      readonly message: string
    }
  | {
      readonly id: string
      readonly kind: 'email'
      /** The row whose fields name recipients, and that the text cites; `null`: none. */
      readonly record: RowSource | null
      /** People of the tenant: their sign-in address. */
      readonly users: readonly string[]
      /** A person field of that row. */
      readonly userField: string | null
      /** An e-mail field of that row. */
      readonly emailField: string | null
      /** Addresses written out. */
      readonly addresses: readonly string[]
      readonly subject: string
      /** Plain text, or the rich text of the app's editor when `format` is `html`. */
      readonly message: string
      /** One mail per recipient, or one mail to all of them. */
      readonly mode: MailMode
      /** In copy, of a mail sent to all together. */
      readonly cc: readonly string[]
      /** Where an answer goes — an address, or a citation of one; `null`: the owner. */
      readonly replyTo: string | null
      readonly format: 'text' | 'html'
      readonly attachments: readonly MailAttachment[]
    }
  | {
      readonly id: string
      readonly kind: 'webhook'
      /** The row the automation's own body sends; `null`: none. */
      readonly record: RowSource | null
      /** May cite, after its host: `https://api.exemple.fr/clients/{{e2.numero}}`. */
      readonly url: string
      readonly method: HttpMethod
      readonly headers: readonly WebhookHeader[]
      /** Composed, citing what came before; `null`: the automation's own JSON. */
      readonly body: string | null
      readonly format: BodyFormat
      /** Tries again after a network error, a 429 or a 5xx: 0 to 3 times. */
      readonly retries: number
    }
  | {
      readonly id: string
      readonly kind: 'for_each'
      /** The table's catalog key. */
      readonly table: string
      /** In the language of filters, citing what came before; empty: every row. */
      readonly filter: string
      readonly sort: string | null
      /** The rows gone through at most, in the order of `sort`. */
      readonly limit: number
      /** A turn that fails stops the run, or the loop goes on with the next row. */
      readonly onError: 'stop' | 'continue'
      /** Run once per row, which they cite and act on by the loop's identifier. */
      readonly steps: readonly AutomationStep[]
    }
  | { readonly id: string; readonly kind: 'delete_record'; readonly record: RowSource }
  | {
      readonly id: string
      readonly kind: 'aggregate'
      /** The table's catalog key. */
      readonly table: string
      /** In the language of filters, citing what came before; empty: every row. */
      readonly filter: string
      readonly measures: readonly Measure[]
    }
  | {
      readonly id: string
      readonly kind: 'run_automation'
      /** Another automation of the base. */
      readonly automation: string
      /** The row it starts on, when its trigger has a table. */
      readonly record: RowSource | null
    }
  | {
      readonly id: string
      readonly kind: 'document'
      readonly record: RowSource
      /** A document template of that row's table; `null`: the sheet with every field. */
      readonly template: string | null
      /** A file field of that table the PDF is added to; `null`: kept for the run alone. */
      readonly field: string | null
      /** The file's name, citing what came before; empty: the template's and the row's. */
      readonly name: string
    }
  | {
      readonly id: string
      readonly kind: 'wait'
      readonly duration: WaitDuration | null
      readonly until: WaitUntil | null
    }
  | {
      readonly id: string
      readonly kind: 'attempt'
      /** Two ways: the steps tried, then those run if one of them fails. */
      readonly paths: readonly BranchPath[]
    }
  | {
      readonly id: string
      readonly kind: 'slack'
      /** A Slack connection of the base (chapter 19 §1). */
      readonly integration: string
      readonly message: string
    }
  | {
      readonly id: string
      readonly kind: 'ai'
      /** The instruction to the model, citing what came before (§1.6). */
      readonly prompt: string
      /** What the answer is read into — the types of an AI field (chapter 12 §1.5). */
      readonly answer: AiKind
      /** The choices of a `select` answer, by label. */
      readonly options: readonly string[]
      /** The author agreed that what the prompt cites leaves for the provider. */
      readonly consent: true
    }
  | { readonly id: string; readonly kind: 'branch'; readonly paths: readonly BranchPath[] }

/** One way out of a branch: the first whose test holds is taken (chapter 17 §1.5). */
export interface BranchPath {
  readonly id: string
  readonly label: string
  /**
   * A row, and a filter it must satisfy; or a value — what a step before answered —
   * compared with another; `null`: otherwise — the last path only.
   */
  readonly when: RowTest | ValueTest | null
  readonly steps: readonly AutomationStep[]
}

export interface RowTest {
  readonly record: RowSource
  readonly condition: string
}

export type ValueOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'empty'
  | 'not_empty'

export const VALUE_OPERATORS: readonly ValueOperator[] = [
  'eq',
  'ne',
  'contains',
  'not_contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'empty',
  'not_empty',
]

/** A value test: a text citing anything before, compared with another (chapter 17 §1.5). */
export interface ValueTest {
  readonly value: string
  readonly op: ValueOperator
  readonly operand: string
}

export const isValueTest = (when: RowTest | ValueTest): when is ValueTest => 'op' in when

/** One mail per recipient, or one mail to all, who then see each other. */
export type MailMode = 'each' | 'together'

/** What an e-mail step attaches: a PDF a step before made, or the files of a row's field. */
export type MailAttachment =
  | { readonly step: string }
  | { readonly record: RowSource; readonly field: string }

/** A measure an aggregate step computes over the rows it counts. */
export interface Measure {
  readonly fn: 'sum' | 'avg' | 'min' | 'max'
  readonly field: string
}

/** How each measure is cited after the step: `{{e3.somme.montant}}`. */
export const MEASURE_NAMES = { sum: 'somme', avg: 'moyenne', min: 'min', max: 'max' } as const

export interface WaitDuration {
  readonly amount: number
  readonly unit: 'minutes' | 'hours' | 'days'
}

/** Until the date a field of a row holds, moved by days, at a time of day. */
export interface WaitUntil {
  readonly record: RowSource
  readonly field: string
  readonly offsetDays: number
  readonly at: string
  readonly timezone: string
}

/** What chapter 17 first called an action is now a step. */
export type AutomationAction = AutomationStep

export interface AutomationTrigger {
  readonly kind: TriggerKind
  /** The table's catalog key; `null` for a schedule and a webhook. */
  readonly table: string | null
  /** The watched fields of `record_updated` — none: any change. */
  readonly fields: readonly string[]
  readonly schedule: Schedule | null
  /** The date of `date_reached`. */
  readonly date: DateTrigger | null
}

export interface Automation {
  readonly id: string
  readonly baseId: string
  readonly label: string
  readonly description: string | null
  readonly enabled: boolean
  readonly trigger: AutomationTrigger
  readonly condition: string | null
  /** The flow's steps, in order — the API's `actions`. */
  readonly actions: readonly AutomationStep[]
  readonly owner: { readonly id: string; readonly name: string }
  readonly nextRunAt: string | null
  readonly lastRun: { readonly status: string; readonly at: string } | null
  readonly createdAt: string
  readonly updatedAt: string
  /**
   * The address a `webhook` trigger is called at, for whoever builds the base — opened from
   * its sealed form by `revealHook`; `null` when it is not shown, or there is none.
   */
  readonly hook: { readonly path: string } | null
  /** The address, sealed by the instance key, as kept. Never shown. */
  readonly hookSealed: string | null
}

export interface AutomationRun {
  readonly id: string
  readonly trigger: string
  readonly recordId: string | null
  readonly status: 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'skipped'
  /** When a waiting run goes on. */
  readonly resumeAt: string | null
  readonly reason: string | null
  readonly errorCode: string | null
  readonly steps: ReadonlyArray<Record<string, unknown>>
  readonly queuedAt: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

export interface AutomationInput {
  readonly label?: unknown
  readonly description?: unknown
  readonly enabled?: unknown
  readonly trigger?: unknown
  readonly condition?: unknown
  readonly actions?: unknown
  /** A new address for a `webhook` trigger: the old one stops at once. */
  readonly regenerate_hook?: unknown
}

/** Steps in all, branches and what they hold included. */
export const MAX_STEPS = 40
/** Branches within branches. */
export const MAX_DEPTH = 3
export const MAX_PATHS = 5
export const MAX_NOTIFIED = 20
/** The recipients an e-mail step names — people and addresses together. */
export const MAX_MAILED = 50
/** In copy of a mail sent to all together. */
export const MAX_CC = 20
export const MAX_ATTACHMENTS = 10
/** What a mail's attachments may weigh together: what relays accept. */
export const MAX_ATTACHED_BYTES = 15 * 1024 * 1024
/** The measures an aggregate step computes. */
export const MAX_MEASURES = 5
/** The longest a run may wait: a year. */
export const MAX_WAIT_DAYS = 365
/** Automations started by automations, one after the other, at most. */
export const MAX_CHAIN = 3
export const MAX_RETRIES = 3
/** The choices an AI step may be asked to pick among. */
export const MAX_AI_OPTIONS = 50
/** The rows a loop goes through, at most and when none is said. */
export const MAX_LOOP_ROWS = 200
export const DEFAULT_LOOP_ROWS = 50
export const MAX_HEADERS = 20
export const MAX_BODY_CHARS = 10_000
export const HTTP_METHODS: readonly HttpMethod[] = ['POST', 'PUT', 'PATCH', 'GET', 'DELETE']
/** A GET or a DELETE sends no body. */
export const hasBody = (method: HttpMethod) => method !== 'GET' && method !== 'DELETE'
const BODY_FORMATS: readonly BodyFormat[] = ['json', 'form', 'text']
/** A header's name, as HTTP spells one. */
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,100}$/
/** What HTTP itself decides — the connection, the length, the host. */
const FORBIDDEN_HEADERS = new Set([
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'expect',
  'proxy-authorization',
  'proxy-connection',
])

const invalid = (field: string, reason: string, detail?: unknown) =>
  new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })

const TRIGGERS: readonly TriggerKind[] = [
  'record_created',
  'record_updated',
  'schedule',
  'button',
  'record_deleted',
  'record_matches',
  'date_reached',
  'webhook',
]
/** What a document step may add a PDF to, and an e-mail step attach. */
const FILE_KINDS = new Set(['file', 'image'])
/** What a date trigger and a wait read. */
const DATE_KINDS = new Set(['date', 'datetime'])
/**
 * What `sum` and `avg` add up — a computed field when it gives a number, which the run
 * finds out —; `min` and `max` take a date, and a number given in order, too.
 */
const NUMERIC_KINDS = new Set(['number', 'count', 'rollup', 'formula'])
const ORDERED_KINDS = new Set([...NUMERIC_KINDS, 'autonumber', 'date', 'datetime'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A step's or a path's identifier: what `{{e2.champ}}` and `record` name. */
const STEP_ID = /^[a-z][a-z0-9_]{0,31}$/
/** The columns every table has, which a search may sort on. */
const SYSTEM_SORTS = new Set(['_id', '_created_at', '_updated_at'])

/**
 * What a text cites: `{{champ}}` and `{{_id}}` of the triggering row, `{{_maintenant}}`,
 * and `{{e2.champ}}` — a step before, then a path into what it gave.
 */
export const CITATION = /\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/g

export function citationsOf(text: string): string[][] {
  return [...text.matchAll(CITATION)].map((m) => (m[1] as string).split('.'))
}

/** A citation at the start of a text. */
export const CITATION_AT = /^\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/

/**
 * A JSON body with each citation replaced by what `cite` gives for it — told whether it
 * stands inside a string, where it must be text that cannot close it, or outside, where it
 * is a value of its own. What is typed around the citations is left as it is.
 */
export function composeJson(
  template: string,
  cite: (path: string, quoted: boolean) => string,
): string {
  let out = ''
  let quoted = false
  let i = 0
  while (i < template.length) {
    const c = template[i] as string
    if (c === '{') {
      const m = CITATION_AT.exec(template.slice(i))
      if (m !== null) {
        out += cite(m[1] as string, quoted)
        i += m[0].length
        continue
      }
    }
    if (quoted && c === '\\') {
      out += template.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '"') quoted = !quoted
    out += c
    i++
  }
  return out
}

/** A form body's pairs, as written: one `clé=valeur` per line or between `&`. */
export function formPairs(template: string): Array<readonly [string, string]> {
  return template
    .split(/\r?\n|&/)
    .map((pair) => pair.trim())
    .filter((pair) => pair !== '')
    .map((pair) => {
      const at = pair.indexOf('=')
      return at < 0
        ? ([pair, ''] as const)
        : ([pair.slice(0, at).trim(), pair.slice(at + 1).trim()] as const)
    })
}

/** An address as written, its citations stood in for: the host must be written out. */
function urlOf(raw: unknown, field: string): { readonly text: string; readonly plain: string } {
  const text = typeof raw === 'string' ? raw.trim() : ''
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(text)?.[1] ?? ''
  if (authority.includes('{')) throw invalid(field, 'hote_cite')
  return { text, plain: text.replace(CITATION, 'x') }
}

// ── Schedules ────────────────────────────────────────────────────────────────

/** The offset of a time zone at an instant, in milliseconds (local − UTC). */
function offsetOf(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const local = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return local - Math.floor(instant / 1000) * 1000
}

/** The instant a wall-clock time has in a time zone. */
function zoned(y: number, m: number, d: number, h: number, min: number, timezone: string): number {
  const guess = Date.UTC(y, m, d, h, min)
  const first = guess - offsetOf(guess, timezone)
  // Once more, for the day the clocks change.
  return guess - offsetOf(first, timezone)
}

/** The instant a wall-clock time has in a time zone — an agenda's local times too. */
export function utcOf(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  timezone: string,
): number {
  return zoned(y, m, d, h, min, timezone)
}

/** The first run of a schedule strictly after `after`. */
export function nextRunOf(schedule: Schedule, after: Date): Date {
  const [hh, mm] = schedule.at.split(':').map(Number) as [number, number]
  const local = new Date(after.getTime() + offsetOf(after.getTime(), schedule.timezone))
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()
  if (schedule.every === 'hour') {
    for (let i = 0; i <= 25; i++) {
      const at = zoned(y, m, d, local.getUTCHours() + i, mm, schedule.timezone)
      if (at > after.getTime()) return new Date(at)
    }
  }
  for (let i = 0; i <= 8; i++) {
    const at = zoned(y, m, d + i, hh, mm, schedule.timezone)
    if (at <= after.getTime()) continue
    if (schedule.every === 'week') {
      const weekday = new Date(Date.UTC(y, m, d + i)).getUTCDay() || 7
      if (weekday !== schedule.weekday) continue
    }
    return new Date(at)
  }
  return new Date(after.getTime() + 3_600_000)
}

function checkedSchedule(raw: unknown): Schedule {
  const s = (raw ?? {}) as Record<string, unknown>
  const every = s.every
  if (every !== 'hour' && every !== 'day' && every !== 'week') {
    throw invalid('trigger.schedule.every', 'valeur_invalide')
  }
  const at = typeof s.at === 'string' ? s.at : '09:00'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) throw invalid('trigger.schedule.at', 'heure_invalide')
  const weekday = typeof s.weekday === 'number' ? s.weekday : 1
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw invalid('trigger.schedule.weekday', 'valeur_invalide')
  }
  const timezone = typeof s.timezone === 'string' && s.timezone !== '' ? s.timezone : 'Europe/Paris'
  try {
    new Intl.DateTimeFormat('fr', { timeZone: timezone })
  } catch {
    throw invalid('trigger.schedule.timezone', 'fuseau_inconnu')
  }
  return { every, at, weekday, timezone }
}

// ── Validation ───────────────────────────────────────────────────────────────

interface TableInfo {
  readonly id: string
  readonly name: string
  readonly fields: ReadonlyMap<string, string>
}

/** The live tables of a base, by name and by key, with their fields' kinds by name. */
async function tablesOf(exec: Executor, baseId: string): Promise<Map<string, TableInfo>> {
  const rows = await exec.query<{
    id: string
    name: string
    field: string | null
    kind: string | null
  }>(
    `SELECT t.id::text, tn.name, fn.name AS field, f.kind
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       LEFT JOIN _basedb.field f ON f.table_id = t.id AND f.is_live
       LEFT JOIN _basedb.physical_name fn ON fn.id = f.name_id
      WHERE t.base_id = $1 AND t.is_live`,
    [baseId],
  )
  const out = new Map<string, TableInfo>()
  for (const r of rows) {
    const table = out.get(r.id) ?? { id: r.id, name: r.name, fields: new Map<string, string>() }
    if (r.field !== null && r.kind !== null)
      (table.fields as Map<string, string>).set(r.field, r.kind)
    out.set(r.id, table)
  }
  return out
}

function tableByName(tables: Map<string, TableInfo>, name: unknown, field: string): TableInfo {
  const found = [...tables.values()].find((t) => t.name === name || t.id === name)
  if (found === undefined) throw invalid(field, 'table_inconnue', name)
  return found
}

/**
 * What a step may name (chapter 17 §1.4): the triggering row's table, and the steps passed
 * on every way to it — with the table of the row each gave, `null` for a webhook's answer.
 * A step inside a path is not seen after the branch: it may not have run.
 */
interface Scope {
  readonly trigger: TableInfo | null
  readonly steps: ReadonlyMap<string, TableInfo | null>
  /** The triggering row is one just deleted: cited as it was, never acted on. */
  readonly deleted?: boolean
  /** What an outside call sent: cited `{{trigger.client.nom}}`. */
  readonly payload?: boolean
}

/** A text may cite a step only once it has run: one passed on every way here. */
function checkCitations(text: string, scope: Scope, field: string): void {
  for (const path of citationsOf(text)) {
    const head = path[0] as string
    // `{{trigger.…}}`: the triggering row, or what an outside call sent.
    const triggering = head === TRIGGER_ROW && (scope.trigger !== null || scope.payload === true)
    if (path.length > 1 && !triggering && !scope.steps.has(head))
      throw invalid(field, 'etape_inconnue', head)
  }
}

function checkedValues(
  raw: unknown,
  table: TableInfo,
  field: string,
  scope: Scope,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw invalid(field, 'valeurs_invalides')
  const values = raw as Record<string, unknown>
  const names = Object.keys(values)
  if (names.length === 0) throw invalid(field, 'aucune_valeur')
  for (const name of names) {
    if (!table.fields.has(name)) throw invalid(field, 'champ_inconnu', name)
    const value = values[name]
    if (typeof value === 'string') checkCitations(value, scope, `${field}.${name}`)
  }
  return values
}

/** The row a step acts on, and its table: the triggering row unless another is named. */
function rowSource(
  raw: unknown,
  scope: Scope,
  field: string,
  required: string | null,
  acting = false,
): { readonly ref: string | null; readonly table: TableInfo | null } {
  const ref =
    typeof raw === 'string' && raw !== '' ? raw : scope.trigger === null ? null : TRIGGER_ROW
  if (ref === null || (ref === TRIGGER_ROW && scope.trigger === null)) {
    if (required !== null) throw invalid(field, required)
    return { ref: null, table: null }
  }
  // A row just deleted is cited as it was; there is nothing left to write, delete or read.
  if (ref === TRIGGER_ROW && acting && scope.deleted === true)
    throw invalid(field, 'ligne_supprimee')
  if (ref === TRIGGER_ROW) return { ref, table: scope.trigger }
  const table = scope.steps.get(ref)
  if (table === undefined) throw invalid(field, 'etape_inconnue', ref)
  if (table === null) throw invalid(field, 'etape_sans_ligne', ref)
  return { ref, table }
}

/** Every step of a flow, depth first: what paths and loops hold included. */
export function stepsOf(steps: readonly AutomationStep[]): AutomationStep[] {
  return steps.flatMap((s) => [
    s,
    ...(s.kind === 'branch' || s.kind === 'attempt'
      ? s.paths.flatMap((p) => stepsOf(p.steps))
      : []),
    ...(s.kind === 'for_each' ? stepsOf(s.steps) : []),
  ])
}

/** Every identifier a flow already carries, so that the new ones do not collide. */
function idsOf(raw: unknown, into: Set<string>): Set<string> {
  if (!Array.isArray(raw)) return into
  for (const item of raw) {
    const step = (item ?? {}) as Record<string, unknown>
    if (typeof step.id === 'string') into.add(step.id)
    idsOf(step.steps, into)
    for (const p of Array.isArray(step.paths) ? step.paths : []) {
      const path = (p ?? {}) as Record<string, unknown>
      if (typeof path.id === 'string') into.add(path.id)
      idsOf(path.steps, into)
    }
  }
  return into
}

/** A flow being checked: what it may name, and what it has used so far. */
interface Walk {
  readonly exec: Executor
  readonly ctx: RequestContext
  readonly baseId: string
  readonly tables: Map<string, TableInfo>
  readonly targets: TargetPolicy
  /** Identifiers given or made, so that a new one is new. */
  readonly taken: Set<string>
  /** Identifiers met, so that one given twice is refused. */
  readonly seen: Set<string>
  /**
   * The flow is being written, not only carried over: an AI step then needs the AI
   * configured — switching an automation on or off never does.
   */
  readonly writing: boolean
  /**
   * Seals a secret header for keeping; `null` when nothing is kept — a draft checked for
   * the copilot, where a secret left out is taken as given.
   */
  readonly sealing: ((plaintext: string) => string) | null
  /** The headers each webhook step of the saved automation has, by step: what a save keeps. */
  readonly kept: ReadonlyMap<string, readonly WebhookHeader[]>
  /** The automation being saved, which a step may not start; `null` for a new one. */
  readonly self: string | null
  /** The document steps met so far: what an e-mail may attach. */
  readonly documents: Set<string>
  count: number
}

/** Where a step stands: how deep, and inside what — a loop, an attempt. */
interface Place {
  readonly depth: number
  readonly inLoop: boolean
  readonly inAttempt: boolean
}

/** The identifier given, checked, or a new one: `e3` for a step, `c2` for a path. */
function identifier(walk: Walk, raw: unknown, prefix: 'e' | 'c', field: string): string {
  if (raw !== undefined && raw !== null && raw !== '') {
    if (typeof raw !== 'string' || !STEP_ID.test(raw) || raw === TRIGGER_ROW)
      throw invalid(field, 'identifiant_invalide', raw)
    if (walk.seen.has(raw)) throw invalid(field, 'identifiant_en_double', raw)
    walk.seen.add(raw)
    return raw
  }
  let n = 1
  while (walk.taken.has(`${prefix}${n}`)) n++
  const id = `${prefix}${n}`
  walk.taken.add(id)
  walk.seen.add(id)
  return id
}

/** A refusal says which step it is about, so that the screen can show it there. */
function aboutStep(error: unknown, id: string): unknown {
  if (!(error instanceof BasedbError) || 'step' in error.details) return error
  return new BasedbError(error.code, { details: { ...error.details, step: id }, cause: error })
}

async function checkedSteps(
  walk: Walk,
  raw: unknown,
  outer: Scope,
  at: string,
  place: Place,
): Promise<AutomationStep[]> {
  if (!Array.isArray(raw)) throw invalid(at, 'etapes_invalides')
  const scope: Scope = {
    trigger: outer.trigger,
    steps: new Map(outer.steps),
    ...(outer.deleted === true ? { deleted: true } : {}),
    ...(outer.payload === true ? { payload: true } : {}),
  }
  const out: AutomationStep[] = []
  for (const [index, item] of raw.entries()) {
    const field = `${at}[${index}]`
    const a = (item ?? {}) as Record<string, unknown>
    walk.count++
    if (walk.count > MAX_STEPS) throw invalid('actions', 'trop_d_etapes', MAX_STEPS)
    const id = identifier(walk, a.id, 'e', `${field}.id`)
    try {
      const { step, gives } = await checkedStep(walk, a, id, scope, field, place)
      out.push(step)
      if (gives !== undefined) (scope.steps as Map<string, TableInfo | null>).set(id, gives)
    } catch (error) {
      throw aboutStep(error, id)
    }
  }
  return out
}

/** The headers of a webhook step, checked; a secret one sealed, or kept from the save before. */
function checkedHeaders(
  walk: Walk,
  raw: unknown,
  step: string,
  host: string,
  scope: Scope,
  at: string,
): WebhookHeader[] {
  const list = Array.isArray(raw) ? raw : []
  if (list.length > MAX_HEADERS) throw invalid(at, 'trop_d_entetes', MAX_HEADERS)
  const seen = new Set<string>()
  const out: WebhookHeader[] = []
  for (const [index, item] of list.entries()) {
    const h = (item ?? {}) as Record<string, unknown>
    const field = `${at}[${index}]`
    const name = typeof h.name === 'string' ? h.name.trim() : ''
    if (!HEADER_NAME.test(name)) throw invalid(`${field}.name`, 'entete_invalide', name)
    const key = name.toLowerCase()
    if (FORBIDDEN_HEADERS.has(key)) throw invalid(`${field}.name`, 'entete_interdit', name)
    if (seen.has(key)) throw invalid(`${field}.name`, 'entete_en_double', name)
    seen.add(key)
    const value = typeof h.value === 'string' ? h.value : ''
    if (value.length > 4000 || /[\r\n\0]/.test(value))
      throw invalid(`${field}.value`, 'valeur_d_entete_invalide', name)
    if (h.secret !== true) {
      checkCitations(value, scope, `${field}.value`)
      out.push({ name, value })
      continue
    }
    if (value.trim() !== '') {
      // Sealed with what it is for: another base, another host, and it will not open.
      const sealed =
        walk.sealing === null
          ? ''
          : walk.sealing(JSON.stringify({ base: walk.baseId, host, value: value.trim() }))
      out.push({ name, sealed, host })
      continue
    }
    const before = (walk.kept.get(step) ?? []).find(
      (k): k is Extract<WebhookHeader, { sealed: string }> =>
        'sealed' in k && k.name.toLowerCase() === key,
    )
    if (before === undefined) {
      if (walk.sealing !== null) throw invalid(`${field}.value`, 'secret_manquant', name)
      out.push({ name, sealed: '', host })
      continue
    }
    if (before.host !== host) throw invalid(`${field}.value`, 'secret_a_redonner', name)
    out.push(before)
  }
  return out
}

/** A webhook's own body, checked for what its format asks. */
function checkedBody(raw: unknown, format: BodyFormat, scope: Scope, at: string): string {
  const body = typeof raw === 'string' ? raw.trim() : ''
  if (body === '') throw invalid(at, 'corps_vide')
  if (body.length > MAX_BODY_CHARS) throw invalid(at, 'corps_trop_long', MAX_BODY_CHARS)
  checkCitations(body, scope, at)
  if (format === 'json') {
    // Parsed as the run will send it: a citation is a text inside a string, a value outside.
    try {
      JSON.parse(composeJson(body, (_, quoted) => (quoted ? 'x' : '0')))
    } catch {
      throw invalid(at, 'corps_json_invalide')
    }
  } else if (format === 'form') {
    const pairs = body.split(/\r?\n|&/).filter((pair) => pair.trim() !== '')
    if (pairs.some((pair) => !pair.includes('=')) || formPairs(body).some(([key]) => key === ''))
      throw invalid(at, 'corps_formulaire_invalide')
  }
  return body
}

async function checkedStep(
  walk: Walk,
  a: Record<string, unknown>,
  id: string,
  scope: Scope,
  at: string,
  place: Place,
): Promise<{ readonly step: AutomationStep; readonly gives?: TableInfo | null }> {
  switch (a.kind) {
    case 'update_record': {
      const source = rowSource(a.record, scope, `${at}.record`, 'action_sans_ligne', true)
      const table = source.table as TableInfo
      const values = checkedValues(a.values, table, `${at}.values`, scope)
      return {
        step: { id, kind: 'update_record', record: source.ref as string, values },
        gives: table,
      }
    }
    case 'create_record': {
      const table = tableByName(walk.tables, a.table, `${at}.table`)
      const values = checkedValues(a.values, table, `${at}.values`, scope)
      return { step: { id, kind: 'create_record', table: table.id, values }, gives: table }
    }
    case 'find_record': {
      const table = tableByName(walk.tables, a.table, `${at}.table`)
      const filter = typeof a.filter === 'string' ? a.filter.trim() : ''
      if (filter.length > 4000) throw invalid(`${at}.filter`, 'texte_trop_long')
      checkCitations(filter, scope, `${at}.filter`)
      const sort = typeof a.sort === 'string' && a.sort.trim() !== '' ? a.sort.trim() : null
      if (sort !== null) {
        const name = sort.replace(/^-/, '')
        if (!table.fields.has(name) && !SYSTEM_SORTS.has(name))
          throw invalid(`${at}.sort`, 'champ_inconnu', name)
      }
      return { step: { id, kind: 'find_record', table: table.id, filter, sort }, gives: table }
    }
    case 'notify': {
      const source = rowSource(a.record, scope, `${at}.record`, null)
      const users = Array.isArray(a.users)
        ? [...new Set(a.users.filter((u): u is string => typeof u === 'string' && UUID.test(u)))]
        : []
      if (users.length > MAX_NOTIFIED)
        throw invalid(`${at}.users`, 'trop_de_personnes', MAX_NOTIFIED)
      const userField =
        typeof a.user_field === 'string' && a.user_field !== '' ? a.user_field : null
      if (userField !== null && source.table?.fields.get(userField) !== 'user') {
        throw invalid(`${at}.user_field`, 'champ_personne_attendu', userField)
      }
      if (users.length === 0 && userField === null)
        throw invalid(`${at}.users`, 'personne_a_prevenir')
      if (users.length > 0) {
        const known = await walk.exec.query<{ id: string }>(
          `SELECT u.id::text FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
            WHERE t.ref = $1 AND u.id = ANY($2::uuid[]) AND u.deleted_at IS NULL`,
          [walk.ctx.tenantId, users],
        )
        const unknown = users.find((u) => !known.some((k) => k.id === u))
        if (unknown !== undefined) throw invalid(`${at}.users`, 'personne_inconnue', unknown)
      }
      const message = typeof a.message === 'string' ? a.message.trim() : ''
      if (message === '' || message.length > 1000)
        throw invalid(`${at}.message`, 'message_invalide')
      checkCitations(message, scope, `${at}.message`)
      return { step: { id, kind: 'notify', record: source.ref, users, userField, message } }
    }
    case 'email': {
      const source = rowSource(a.record, scope, `${at}.record`, null)
      const users = Array.isArray(a.users)
        ? [...new Set(a.users.filter((u): u is string => typeof u === 'string' && UUID.test(u)))]
        : []
      const addresses = Array.isArray(a.addresses)
        ? [
            ...new Set(
              a.addresses
                .filter((x): x is string => typeof x === 'string')
                .map((x) => x.trim().replace(/^mailto:/i, ''))
                .filter((x) => x !== ''),
            ),
          ]
        : []
      const wrong = addresses.find((x) => !isAddress(x))
      if (wrong !== undefined) throw invalid(`${at}.addresses`, 'adresse_email', wrong)
      if (users.length + addresses.length > MAX_MAILED)
        throw invalid(`${at}.users`, 'trop_de_destinataires', MAX_MAILED)
      const userField =
        typeof a.user_field === 'string' && a.user_field !== '' ? a.user_field : null
      if (userField !== null && source.table?.fields.get(userField) !== 'user') {
        throw invalid(`${at}.user_field`, 'champ_personne_attendu', userField)
      }
      const emailField =
        typeof a.email_field === 'string' && a.email_field !== '' ? a.email_field : null
      if (emailField !== null && source.table?.fields.get(emailField) !== 'email') {
        throw invalid(`${at}.email_field`, 'champ_email_attendu', emailField)
      }
      if (users.length === 0 && addresses.length === 0 && userField === null && emailField === null)
        throw invalid(`${at}.users`, 'destinataire_manquant')
      if (users.length > 0) {
        const known = await walk.exec.query<{ id: string }>(
          `SELECT u.id::text FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
            WHERE t.ref = $1 AND u.id = ANY($2::uuid[]) AND u.deleted_at IS NULL`,
          [walk.ctx.tenantId, users],
        )
        const unknown = users.find((u) => !known.some((k) => k.id === u))
        if (unknown !== undefined) throw invalid(`${at}.users`, 'personne_inconnue', unknown)
      }
      const subject = typeof a.subject === 'string' ? a.subject.trim() : ''
      if (subject === '' || subject.length > 200 || /[\r\n]/.test(subject))
        throw invalid(`${at}.subject`, 'objet_invalide')
      checkCitations(subject, scope, `${at}.subject`)
      const format = a.format === undefined || a.format === null ? 'text' : a.format
      if (format !== 'text' && format !== 'html')
        throw invalid(`${at}.format`, 'format_inconnu', format)
      const written = typeof a.message === 'string' ? a.message.trim() : ''
      // A rich text is kept in the canonical form of the app's rich texts: what the editor
      // writes, nothing a script could hide in.
      const message = format === 'html' ? sanitizeRichText(written) : written
      if (message === '' || message.length > (format === 'html' ? 50_000 : 5000))
        throw invalid(`${at}.message`, 'message_invalide')
      checkCitations(message, scope, `${at}.message`)
      const mode = a.mode === undefined || a.mode === null ? 'each' : a.mode
      if (mode !== 'each' && mode !== 'together')
        throw invalid(`${at}.mode`, 'valeur_invalide', mode)
      const cc = Array.isArray(a.cc)
        ? [
            ...new Set(
              a.cc
                .filter((x): x is string => typeof x === 'string')
                .map((x) => x.trim().replace(/^mailto:/i, ''))
                .filter((x) => x !== ''),
            ),
          ]
        : []
      if (cc.length > 0 && mode !== 'together') throw invalid(`${at}.cc`, 'copie_sans_envoi_groupe')
      if (cc.length > MAX_CC) throw invalid(`${at}.cc`, 'trop_de_destinataires', MAX_CC)
      const wrongCopy = cc.find((x) => !isAddress(x))
      if (wrongCopy !== undefined) throw invalid(`${at}.cc`, 'adresse_email', wrongCopy)
      const replyTo =
        typeof a.reply_to === 'string' && a.reply_to.trim() !== '' ? a.reply_to.trim() : null
      if (replyTo !== null) {
        // An address written out, or what a citation will give: checked again when sent.
        const plain = replyTo.replace(CITATION, '')
        if (replyTo.length > 254 || (plain === replyTo && !isAddress(replyTo)))
          throw invalid(`${at}.reply_to`, 'reponse_a_invalide', replyTo)
        checkCitations(replyTo, scope, `${at}.reply_to`)
      }
      const attachments = checkedAttachments(a.attachments, scope, walk, `${at}.attachments`)
      return {
        step: {
          id,
          kind: 'email',
          record: source.ref,
          users,
          userField,
          emailField,
          addresses,
          subject,
          message,
          mode,
          cc,
          replyTo,
          format,
          attachments,
        },
      }
    }
    case 'webhook': {
      const source = rowSource(a.record, scope, `${at}.record`, null)
      const url = urlOf(a.url, `${at}.url`)
      checkCitations(url.text, scope, `${at}.url`)
      // Its host checked as it is written; what a citation adds is checked again at each run.
      const host = (await checkTarget(url.plain, walk.targets)).host.toLowerCase()
      const method = a.method === undefined || a.method === null ? 'POST' : a.method
      if (typeof method !== 'string' || !(HTTP_METHODS as readonly string[]).includes(method))
        throw invalid(`${at}.method`, 'methode_inconnue', method)
      const format = a.format === undefined || a.format === null ? 'json' : a.format
      if (typeof format !== 'string' || !(BODY_FORMATS as readonly string[]).includes(format))
        throw invalid(`${at}.format`, 'format_inconnu', format)
      const headers = checkedHeaders(walk, a.headers, id, host, scope, `${at}.headers`)
      const composed = a.body !== undefined && a.body !== null
      if (composed && !hasBody(method as HttpMethod))
        throw invalid(`${at}.body`, 'corps_sans_objet', method)
      const body = composed ? checkedBody(a.body, format as BodyFormat, scope, `${at}.body`) : null
      const retries = a.retries === undefined || a.retries === null ? 0 : a.retries
      if (
        typeof retries !== 'number' ||
        !Number.isInteger(retries) ||
        retries < 0 ||
        retries > MAX_RETRIES
      )
        throw invalid(`${at}.retries`, 'reessais_invalides', MAX_RETRIES)
      return {
        step: {
          id,
          kind: 'webhook',
          record: source.ref,
          url: url.text,
          method: method as HttpMethod,
          headers,
          body,
          format: format as BodyFormat,
          retries,
        },
        gives: null,
      }
    }
    case 'for_each': {
      if (place.inLoop) throw invalid(at, 'boucle_dans_boucle')
      if (place.depth >= MAX_DEPTH) throw invalid(at, 'branches_trop_profondes', MAX_DEPTH)
      const table = tableByName(walk.tables, a.table, `${at}.table`)
      const filter = typeof a.filter === 'string' ? a.filter.trim() : ''
      if (filter.length > 4000) throw invalid(`${at}.filter`, 'texte_trop_long')
      checkCitations(filter, scope, `${at}.filter`)
      const sort = typeof a.sort === 'string' && a.sort.trim() !== '' ? a.sort.trim() : null
      if (sort !== null) {
        const name = sort.replace(/^-/, '')
        if (!table.fields.has(name) && !SYSTEM_SORTS.has(name))
          throw invalid(`${at}.sort`, 'champ_inconnu', name)
      }
      const limit = a.limit === undefined || a.limit === null ? DEFAULT_LOOP_ROWS : a.limit
      if (
        typeof limit !== 'number' ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > MAX_LOOP_ROWS
      )
        throw invalid(`${at}.limit`, 'limite_invalide', MAX_LOOP_ROWS)
      const onError = a.on_error === undefined || a.on_error === null ? 'stop' : a.on_error
      if (onError !== 'stop' && onError !== 'continue')
        throw invalid(`${at}.on_error`, 'valeur_invalide', onError)
      // Inside, the loop's identifier names the row of the turn; after it, how many there were.
      const inner: Scope = { ...scope, steps: new Map(scope.steps).set(id, table) }
      const steps = await checkedSteps(walk, a.steps ?? [], inner, `${at}.steps`, {
        ...place,
        depth: place.depth + 1,
        inLoop: true,
      })
      return {
        step: { id, kind: 'for_each', table: table.id, filter, sort, limit, onError, steps },
        gives: null,
      }
    }
    case 'slack': {
      const integration = typeof a.integration === 'string' ? a.integration : ''
      const [found] = await walk.exec.query<{ id: string }>(
        `SELECT id::text FROM _basedb.integration
          WHERE id::text = $1 AND base_id = $2 AND kind = 'slack' AND deleted_at IS NULL`,
        [integration, walk.baseId],
      )
      if (found === undefined) throw invalid(`${at}.integration`, 'connexion_inconnue', integration)
      const message = typeof a.message === 'string' ? a.message.trim() : ''
      if (message === '' || message.length > 3000)
        throw invalid(`${at}.message`, 'message_invalide')
      checkCitations(message, scope, `${at}.message`)
      return { step: { id, kind: 'slack', integration, message } }
    }
    case 'ai': {
      const prompt = typeof a.prompt === 'string' ? a.prompt.trim() : ''
      if (prompt === '') throw invalid(`${at}.prompt`, 'consigne_vide')
      if ([...prompt].length > MAX_PROMPT_CHARS)
        throw invalid(`${at}.prompt`, 'consigne_trop_longue', MAX_PROMPT_CHARS)
      checkCitations(prompt, scope, `${at}.prompt`)
      const answer = a.answer === undefined || a.answer === null ? 'long_text' : a.answer
      if (typeof answer !== 'string' || !(AI_KINDS as readonly string[]).includes(answer))
        throw invalid(`${at}.answer`, 'reponse_inconnue', answer)
      const options =
        answer === 'select' && Array.isArray(a.options)
          ? [
              ...new Set(
                a.options
                  .filter((o): o is string => typeof o === 'string')
                  .map((o) => o.trim())
                  .filter((o) => o !== ''),
              ),
            ]
          : []
      if (answer === 'select' && options.length === 0) throw invalid(`${at}.options`, 'aucun_choix')
      if (options.length > MAX_AI_OPTIONS || options.some((o) => o.length > 255))
        throw invalid(`${at}.options`, 'trop_de_choix', MAX_AI_OPTIONS)
      // As for an AI field (chapter 12 §1.5): what the prompt cites leaves for the provider,
      // and the person who saves the step says they agree to it; a step that could never
      // run — the AI switched off, no provider — is refused when written, not left to fail.
      if (a.consent !== true) {
        throw new BasedbError('AI_CONSENT_REQUIRED', {
          details: { field: `${at}.consent`, reason: 'consentement_requis' },
        })
      }
      if (walk.writing) await resolveProvider(walk.exec, walk.ctx)
      return {
        step: { id, kind: 'ai', prompt, answer: answer as AiKind, options, consent: true },
        gives: null,
      }
    }
    case 'branch': {
      if (place.depth >= MAX_DEPTH) throw invalid(at, 'branches_trop_profondes', MAX_DEPTH)
      const raw = Array.isArray(a.paths) ? a.paths : []
      if (raw.length === 0) throw invalid(`${at}.paths`, 'aucun_chemin')
      if (raw.length > MAX_PATHS) throw invalid(`${at}.paths`, 'trop_de_chemins', MAX_PATHS)
      const paths: BranchPath[] = []
      for (const [index, item] of raw.entries()) {
        const p = (item ?? {}) as Record<string, unknown>
        const field = `${at}.paths[${index}]`
        const pathId = identifier(walk, p.id, 'c', `${field}.id`)
        let when: BranchPath['when'] = null
        if (p.when !== null && p.when !== undefined) {
          const w = p.when as Record<string, unknown>
          if (w.op !== undefined) {
            when = checkedValueTest(w, scope, `${field}.when`)
          } else {
            const source = rowSource(
              w.record,
              scope,
              `${field}.when.record`,
              'condition_sans_ligne',
            )
            const condition = typeof w.condition === 'string' ? w.condition.trim() : ''
            if (condition.length > 4000) throw invalid(`${field}.when.condition`, 'texte_trop_long')
            checkCitations(condition, scope, `${field}.when.condition`)
            when = { record: source.ref as string, condition }
          }
        } else if (index !== raw.length - 1) {
          throw invalid(`${field}.when`, 'sinon_en_dernier')
        }
        const label =
          typeof p.label === 'string' && p.label.trim() !== ''
            ? p.label.trim().slice(0, 60)
            : when === null
              ? 'Sinon'
              : `Chemin ${index + 1}`
        const steps = await checkedSteps(walk, p.steps ?? [], scope, `${field}.steps`, {
          ...place,
          depth: place.depth + 1,
        })
        paths.push({ id: pathId, label, when, steps })
      }
      return { step: { id, kind: 'branch', paths } }
    }
    case 'attempt': {
      if (place.depth >= MAX_DEPTH) throw invalid(at, 'branches_trop_profondes', MAX_DEPTH)
      const raw = Array.isArray(a.paths) ? a.paths : []
      if (raw.length !== 2) throw invalid(`${at}.paths`, 'essai_deux_chemins')
      const paths: BranchPath[] = []
      for (const [index, item] of raw.entries()) {
        const p = (item ?? {}) as Record<string, unknown>
        const field = `${at}.paths[${index}]`
        const pathId = identifier(walk, p.id, 'c', `${field}.id`)
        const label =
          typeof p.label === 'string' && p.label.trim() !== ''
            ? p.label.trim().slice(0, 60)
            : index === 0
              ? 'Essayer'
              : 'En cas d’échec'
        // What failed is cited in the second way: `{{e4.erreur}}`, `{{e4.etape}}`.
        const inner: Scope =
          index === 0 ? scope : { ...scope, steps: new Map(scope.steps).set(id, null) }
        const steps = await checkedSteps(walk, p.steps ?? [], inner, `${field}.steps`, {
          ...place,
          depth: place.depth + 1,
          inAttempt: true,
        })
        paths.push({ id: pathId, label, when: null, steps })
      }
      // After it, `{{e4.erreur}}` reads what failed — empty when nothing did.
      return { step: { id, kind: 'attempt', paths }, gives: null }
    }
    case 'delete_record': {
      const source = rowSource(a.record, scope, `${at}.record`, 'action_sans_ligne', true)
      return { step: { id, kind: 'delete_record', record: source.ref as string } }
    }
    case 'aggregate': {
      const table = tableByName(walk.tables, a.table, `${at}.table`)
      const filter = typeof a.filter === 'string' ? a.filter.trim() : ''
      if (filter.length > 4000) throw invalid(`${at}.filter`, 'texte_trop_long')
      checkCitations(filter, scope, `${at}.filter`)
      const raw = Array.isArray(a.measures) ? a.measures : []
      if (raw.length > MAX_MEASURES)
        throw invalid(`${at}.measures`, 'trop_de_mesures', MAX_MEASURES)
      const measures: Measure[] = []
      for (const [index, item] of raw.entries()) {
        const m = (item ?? {}) as Record<string, unknown>
        const field = typeof m.field === 'string' ? m.field : ''
        const kind = table.fields.get(field)
        const fn = m.fn
        const fits =
          (fn === 'sum' || fn === 'avg') && kind !== undefined
            ? NUMERIC_KINDS.has(kind)
            : (fn === 'min' || fn === 'max') && kind !== undefined && ORDERED_KINDS.has(kind)
        if (!fits) throw invalid(`${at}.measures[${index}]`, 'mesure_invalide', `${fn}:${field}`)
        if (!measures.some((x) => x.fn === fn && x.field === field))
          measures.push({ fn: fn as Measure['fn'], field })
      }
      return {
        step: { id, kind: 'aggregate', table: table.id, filter, measures },
        gives: null,
      }
    }
    case 'run_automation': {
      const target = typeof a.automation === 'string' ? a.automation : ''
      if (!UUID.test(target)) throw invalid(`${at}.automation`, 'automation_inconnue', target)
      if (target === walk.self) throw invalid(`${at}.automation`, 'automation_elle_meme')
      const [found] = await walk.exec.query<{ trigger_kind: TriggerKind; table_id: string | null }>(
        `SELECT trigger_kind, table_id::text FROM _basedb.automation
          WHERE id = $1 AND base_id = $2 AND deleted_at IS NULL`,
        [target, walk.baseId],
      )
      if (found === undefined) throw invalid(`${at}.automation`, 'automation_inconnue', target)
      if (found.table_id === null) {
        return { step: { id, kind: 'run_automation', automation: target, record: null } }
      }
      const source = rowSource(a.record, scope, `${at}.record`, 'ligne_requise')
      if (source.table?.id !== found.table_id) throw invalid(`${at}.record`, 'table_differente')
      return { step: { id, kind: 'run_automation', automation: target, record: source.ref } }
    }
    case 'document': {
      const source = rowSource(a.record, scope, `${at}.record`, 'action_sans_ligne', true)
      const table = source.table as TableInfo
      const template =
        typeof a.template === 'string' && a.template !== '' ? a.template.toLowerCase() : null
      if (template !== null) {
        const [found] = UUID.test(template)
          ? await walk.exec.query<{ id: string }>(
              'SELECT id::text FROM _basedb.document_template WHERE id = $1 AND table_id = $2',
              [template, table.id],
            )
          : []
        if (found === undefined) throw invalid(`${at}.template`, 'modele_inconnu', template)
      }
      const field = typeof a.field === 'string' && a.field !== '' ? a.field : null
      if (field !== null && table.fields.get(field) !== 'file')
        throw invalid(`${at}.field`, 'champ_fichier_attendu', field)
      const name = typeof a.name === 'string' ? a.name.trim().slice(0, 200) : ''
      checkCitations(name, scope, `${at}.name`)
      walk.documents.add(id)
      return {
        step: { id, kind: 'document', record: source.ref as string, template, field, name },
        gives: null,
      }
    }
    case 'wait': {
      if (place.inLoop) throw invalid(at, 'attente_dans_boucle')
      if (place.inAttempt) throw invalid(at, 'attente_dans_essai')
      const d = a.duration as Record<string, unknown> | null | undefined
      const u = a.until as Record<string, unknown> | null | undefined
      if ((d === null || d === undefined) === (u === null || u === undefined))
        throw invalid(at, 'attente_invalide')
      if (d !== null && d !== undefined) {
        const unit = d.unit
        const amount = d.amount
        const days =
          typeof amount === 'number'
            ? unit === 'days'
              ? amount
              : unit === 'hours'
                ? amount / 24
                : unit === 'minutes'
                  ? amount / 1440
                  : Number.NaN
            : Number.NaN
        if (
          typeof amount !== 'number' ||
          !Number.isInteger(amount) ||
          amount < 1 ||
          !(days <= MAX_WAIT_DAYS)
        )
          throw invalid(`${at}.duration`, 'attente_invalide', MAX_WAIT_DAYS)
        return {
          step: {
            id,
            kind: 'wait',
            duration: { amount, unit: unit as WaitDuration['unit'] },
            until: null,
          },
        }
      }
      const w = u as Record<string, unknown>
      const source = rowSource(w.record, scope, `${at}.until.record`, 'action_sans_ligne', true)
      const field = typeof w.field === 'string' ? w.field : ''
      if (!DATE_KINDS.has(source.table?.fields.get(field) ?? ''))
        throw invalid(`${at}.until.field`, 'champ_date_attendu', field)
      const offsetDays = w.offset_days === undefined ? 0 : w.offset_days
      if (
        typeof offsetDays !== 'number' ||
        !Number.isInteger(offsetDays) ||
        Math.abs(offsetDays) > MAX_WAIT_DAYS
      )
        throw invalid(`${at}.until.offset_days`, 'decalage_invalide', MAX_WAIT_DAYS)
      const { at: time, timezone } = checkedTimeOfDay(w, `${at}.until`)
      return {
        step: {
          id,
          kind: 'wait',
          duration: null,
          until: { record: source.ref as string, field, offsetDays, at: time, timezone },
        },
      }
    }
    default:
      throw invalid(`${at}.kind`, 'action_inconnue', a.kind)
  }
}

/** A time of day and a time zone, as a date trigger or a wait gives them. */
function checkedTimeOfDay(
  raw: Record<string, unknown>,
  at: string,
): { readonly at: string; readonly timezone: string } {
  const time = typeof raw.at === 'string' && raw.at !== '' ? raw.at : '09:00'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw invalid(`${at}.at`, 'heure_invalide')
  const timezone =
    typeof raw.timezone === 'string' && raw.timezone !== '' ? raw.timezone : 'Europe/Paris'
  try {
    new Intl.DateTimeFormat('fr', { timeZone: timezone })
  } catch {
    throw invalid(`${at}.timezone`, 'fuseau_inconnu')
  }
  return { at: time, timezone }
}

/**
 * What an e-mail attaches: the PDF a document step before it made — one that ran on every
 * way here —, or the files of a file or image field of a row it may name.
 */
function checkedAttachments(raw: unknown, scope: Scope, walk: Walk, at: string): MailAttachment[] {
  const list = Array.isArray(raw) ? raw : []
  if (list.length > MAX_ATTACHMENTS) throw invalid(at, 'trop_de_pieces_jointes', MAX_ATTACHMENTS)
  const out: MailAttachment[] = []
  for (const [index, item] of list.entries()) {
    const x = (item ?? {}) as Record<string, unknown>
    const field = `${at}[${index}]`
    if (typeof x.step === 'string') {
      if (!walk.documents.has(x.step) || !scope.steps.has(x.step))
        throw invalid(field, 'piece_jointe_invalide', x.step)
      out.push({ step: x.step })
      continue
    }
    const source = rowSource(x.record, scope, `${field}.record`, 'piece_jointe_invalide')
    const name = typeof x.field === 'string' ? x.field : ''
    if (!FILE_KINDS.has(source.table?.fields.get(name) ?? ''))
      throw invalid(`${field}.field`, 'champ_fichier_attendu', name)
    out.push({ record: source.ref as string, field: name })
  }
  return out
}

/** A value test of a branch's path: a text citing what came before, an operator, another. */
function checkedValueTest(w: Record<string, unknown>, scope: Scope, at: string): ValueTest {
  const op = w.op
  if (typeof op !== 'string' || !(VALUE_OPERATORS as readonly string[]).includes(op))
    throw invalid(`${at}.op`, 'operateur_inconnu', op)
  const value = typeof w.value === 'string' ? w.value.trim() : ''
  if (value === '' || value.length > 1000) throw invalid(`${at}.value`, 'valeur_invalide')
  checkCitations(value, scope, `${at}.value`)
  const operand =
    op === 'empty' || op === 'not_empty'
      ? ''
      : typeof w.operand === 'string'
        ? w.operand.trim()
        : typeof w.operand === 'number'
          ? String(w.operand)
          : ''
  if (operand.length > 1000) throw invalid(`${at}.operand`, 'valeur_invalide')
  checkCitations(operand, scope, `${at}.operand`)
  return { value, op: op as ValueOperator, operand }
}

async function checkedDefinition(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
  input: AutomationInput,
  current: Automation | null,
  targets: TargetPolicy,
  sealing: ((plaintext: string) => string) | null,
) {
  const label = typeof input.label === 'string' ? input.label.trim() : (current?.label ?? '')
  if (label === '' || label.length > 255) throw invalid('label', 'libelle_invalide')
  const description =
    input.description === undefined
      ? (current?.description ?? null)
      : typeof input.description === 'string' && input.description.trim() !== ''
        ? input.description.trim().slice(0, 2000)
        : null
  const enabled = input.enabled === undefined ? (current?.enabled ?? true) : input.enabled === true

  const tables = await tablesOf(exec, baseId)
  const rawTrigger = (input.trigger ??
    (current === null ? {} : wireTrigger(current.trigger))) as Record<string, unknown>
  const kind = rawTrigger.kind as TriggerKind
  if (!TRIGGERS.includes(kind))
    throw invalid('trigger.kind', 'declencheur_inconnu', rawTrigger.kind)
  let trigger: AutomationTrigger
  if (kind === 'schedule') {
    trigger = {
      kind,
      table: null,
      fields: [],
      schedule: checkedSchedule(rawTrigger.schedule),
      date: null,
    }
  } else if (kind === 'webhook') {
    trigger = { kind, table: null, fields: [], schedule: null, date: null }
  } else {
    const table = tableByName(tables, rawTrigger.table, 'trigger.table')
    const fields =
      kind === 'record_updated' && Array.isArray(rawTrigger.fields)
        ? [...new Set(rawTrigger.fields.filter((f): f is string => typeof f === 'string'))]
        : []
    for (const f of fields)
      if (!table.fields.has(f)) throw invalid('trigger.fields', 'champ_inconnu', f)
    let date: DateTrigger | null = null
    if (kind === 'date_reached') {
      const d = (rawTrigger.date ?? {}) as Record<string, unknown>
      const field = typeof d.field === 'string' ? d.field : ''
      if (!DATE_KINDS.has(table.fields.get(field) ?? ''))
        throw invalid('trigger.date.field', 'champ_date_attendu', field)
      const offsetDays = d.offset_days === undefined || d.offset_days === null ? 0 : d.offset_days
      if (
        typeof offsetDays !== 'number' ||
        !Number.isInteger(offsetDays) ||
        Math.abs(offsetDays) > MAX_WAIT_DAYS
      )
        throw invalid('trigger.date.offset_days', 'decalage_invalide', MAX_WAIT_DAYS)
      const { at, timezone } = checkedTimeOfDay(d, 'trigger.date')
      date = { field, offsetDays, at, timezone }
    }
    trigger = { kind, table: table.id, fields, schedule: null, date }
  }
  const source = trigger.table === null ? null : (tables.get(trigger.table) ?? null)

  const rawCondition = input.condition === undefined ? current?.condition : input.condition
  const condition =
    typeof rawCondition === 'string' && rawCondition.trim() !== '' ? rawCondition.trim() : null
  if (condition !== null && trigger.table === null)
    throw invalid('condition', 'condition_sans_ligne')
  // « Entre dans un filtre » is the filter itself: without one, nothing to enter.
  if (condition === null && kind === 'record_matches')
    throw invalid('condition', 'condition_requise')
  if (condition !== null && condition.length > 4000) throw invalid('condition', 'texte_trop_long')
  // Checked before any step has run: it cites the triggering row only.
  if (condition !== null)
    checkCitations(condition, { trigger: source, steps: new Map() }, 'condition')

  const rawSteps = input.actions ?? (current === null ? undefined : wireSteps(current.actions))
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) throw invalid('actions', 'aucune_action')
  const walk: Walk = {
    exec,
    ctx,
    baseId,
    tables,
    targets,
    taken: idsOf(rawSteps, new Set()),
    seen: new Set(),
    writing: input.actions !== undefined,
    sealing,
    kept: new Map(
      stepsOf(current?.actions ?? []).flatMap((s) =>
        s.kind === 'webhook' ? [[s.id, s.headers] as const] : [],
      ),
    ),
    self: current?.id ?? null,
    documents: new Set(),
    count: 0,
  }
  const actions = await checkedSteps(
    walk,
    rawSteps,
    {
      trigger: source,
      steps: new Map(),
      ...(kind === 'record_deleted' ? { deleted: true } : {}),
      ...(kind === 'webhook' ? { payload: true } : {}),
    },
    'actions',
    { depth: 0, inLoop: false, inAttempt: false },
  )
  return { label, description, enabled, trigger, condition, actions }
}

/** A trigger as the API shows it — `offset_days` — and takes it back. */
export function wireTrigger(trigger: AutomationTrigger): Record<string, unknown> {
  return {
    kind: trigger.kind,
    table: trigger.table,
    fields: trigger.fields,
    schedule: trigger.schedule,
    date:
      trigger.date === null
        ? null
        : {
            field: trigger.date.field,
            offset_days: trigger.date.offsetDays,
            at: trigger.date.at,
            timezone: trigger.date.timezone,
          },
  }
}

/**
 * Steps as the API shows them — tables by key, `user_field` — and takes them back. A secret
 * header shows its name and the host it was given for: its value never leaves the kernel.
 */
export function wireSteps(steps: readonly AutomationStep[]): Record<string, unknown>[] {
  return steps.map((s): Record<string, unknown> => {
    switch (s.kind) {
      case 'webhook':
        return {
          id: s.id,
          kind: s.kind,
          record: s.record,
          url: s.url,
          method: s.method,
          headers: s.headers.map((h) =>
            'sealed' in h
              ? { name: h.name, value: null, secret: true, host: h.host }
              : { name: h.name, value: h.value, secret: false },
          ),
          body: s.body,
          format: s.format,
          retries: s.retries,
        }
      case 'for_each':
        return {
          id: s.id,
          kind: s.kind,
          table: s.table,
          filter: s.filter,
          sort: s.sort,
          limit: s.limit,
          on_error: s.onError,
          steps: wireSteps(s.steps),
        }
      case 'wait':
        return {
          id: s.id,
          kind: s.kind,
          duration: s.duration,
          until:
            s.until === null
              ? null
              : {
                  record: s.until.record,
                  field: s.until.field,
                  offset_days: s.until.offsetDays,
                  at: s.until.at,
                  timezone: s.until.timezone,
                },
        }
      case 'notify':
        return {
          id: s.id,
          kind: s.kind,
          record: s.record,
          users: s.users,
          user_field: s.userField,
          message: s.message,
        }
      case 'email':
        return {
          id: s.id,
          kind: s.kind,
          record: s.record,
          users: s.users,
          user_field: s.userField,
          email_field: s.emailField,
          addresses: s.addresses,
          subject: s.subject,
          message: s.message,
          mode: s.mode,
          cc: s.cc,
          reply_to: s.replyTo,
          format: s.format,
          attachments: s.attachments,
        }
      case 'branch':
      case 'attempt':
        return {
          id: s.id,
          kind: s.kind,
          paths: s.paths.map((p) => ({
            id: p.id,
            label: p.label,
            when: p.when,
            steps: wireSteps(p.steps),
          })),
        }
      default:
        return { ...s }
    }
  })
}

/**
 * Steps as stored. Those saved before flows had neither identifiers nor a row named: they
 * are numbered in order, and act on the triggering row, as they always did. A webhook
 * saved before it could be composed posts the automation's own JSON, as it did.
 */
function storedSteps(raw: unknown, hasRow: boolean): AutomationStep[] {
  if (!Array.isArray(raw)) return []
  const within = (s: Record<string, unknown>): Record<string, unknown> => ({
    ...s,
    ...(s.kind === 'webhook'
      ? {
          method: s.method ?? 'POST',
          headers: s.headers ?? [],
          body: s.body ?? null,
          format: s.format ?? 'json',
          retries: s.retries ?? 0,
        }
      : {}),
    // Saved before mails could be sent together, in HTML, with attachments: as they were.
    ...(s.kind === 'email'
      ? {
          mode: s.mode ?? 'each',
          cc: s.cc ?? [],
          replyTo: s.replyTo ?? null,
          format: s.format ?? 'text',
          attachments: s.attachments ?? [],
        }
      : {}),
    ...(s.kind === 'for_each' ? { onError: s.onError ?? 'stop' } : {}),
    ...(Array.isArray(s.steps) ? { steps: s.steps.map(within) } : {}),
    ...(Array.isArray(s.paths)
      ? {
          paths: s.paths.map((p: Record<string, unknown>) => ({
            ...p,
            steps: Array.isArray(p.steps) ? p.steps.map(within) : [],
          })),
        }
      : {}),
  })
  return raw.map((item, index) => {
    const s = within(item as Record<string, unknown>)
    const id = typeof s.id === 'string' ? s.id : `e${index + 1}`
    if (s.kind === 'update_record') return { ...s, id, record: s.record ?? TRIGGER_ROW }
    if (s.kind === 'notify' || s.kind === 'webhook')
      return { ...s, id, record: s.record === undefined ? (hasRow ? TRIGGER_ROW : null) : s.record }
    return { ...s, id }
  }) as AutomationStep[]
}

// ── Reading ──────────────────────────────────────────────────────────────────

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly base_id: string
  readonly label: string
  readonly description: string | null
  readonly is_enabled: boolean
  readonly trigger_kind: TriggerKind
  readonly table_id: string | null
  readonly trigger: Record<string, unknown>
  readonly condition: string | null
  readonly actions: unknown
  readonly owner_id: string
  readonly owner_name: string
  readonly next_run_at: string | null
  readonly last_status: string | null
  readonly last_at: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly hook_sealed: string | null
}

const COLUMNS = `a.id::text, a.base_id::text, a.label, a.description, a.is_enabled, a.trigger_kind,
       a.table_id::text, a.trigger, a.condition, a.actions, a.owner_id::text,
       coalesce(nullif(u.display_name, ''), u.email) AS owner_name, a.next_run_at::text,
       last.status AS last_status, last.at AS last_at, a.created_at::text, a.updated_at::text,
       a.hook_sealed`
const FROM = `FROM _basedb.automation a
       JOIN _basedb.app_user u ON u.id = a.owner_id
       LEFT JOIN LATERAL (
         SELECT r.status, coalesce(r.finished_at, r.queued_at)::text AS at
           FROM _basedb.automation_run r WHERE r.automation_id = a.id
          ORDER BY r.queued_at DESC LIMIT 1) last ON true`

function shaped(row: Row): Automation {
  const t = row.trigger as { fields?: string[]; schedule?: Schedule; date?: DateTrigger }
  return {
    id: row.id,
    baseId: row.base_id,
    label: row.label,
    description: row.description,
    enabled: row.is_enabled,
    trigger: {
      kind: row.trigger_kind,
      table: row.table_id,
      fields: t.fields ?? [],
      schedule: t.schedule ?? null,
      date: t.date ?? null,
    },
    condition: row.condition,
    actions: storedSteps(row.actions, row.table_id !== null),
    owner: { id: row.owner_id, name: row.owner_name },
    nextRunAt: row.next_run_at,
    lastRun: row.last_status === null ? null : { status: row.last_status, at: row.last_at ?? '' },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hook: null,
    hookSealed: row.hook_sealed,
  }
}

/** What a webhook trigger's secret is sealed for: one purpose of the instance key (A25). */
export const HOOK_SECRET = 'automation/hook'

/** A webhook trigger's address, under the API, from its secret. */
export const hookPath = (secret: string) => `/api/v1/hooks/${secret}`

/** An automation with its webhook address opened — for whoever builds the base. */
export function revealHook(automation: Automation, instanceKey?: () => string): Automation {
  if (automation.hookSealed === null || instanceKey === undefined) return automation
  const secret = unseal(instanceKey(), HOOK_SECRET, automation.hookSealed)
  return secret === null ? automation : { ...automation, hook: { path: hookPath(secret) } }
}

/** A new secret address: what is kept of it, sealed and hashed. */
function newHook(instanceKey: (() => string) | undefined): { sealed: string; hash: Buffer } {
  if (instanceKey === undefined) throw invalid('trigger', 'secret_impossible')
  const secret = randomBytes(24).toString('base64url')
  return {
    sealed: seal(instanceKey(), HOOK_SECRET, secret),
    hash: createHash('sha256').update(secret).digest(),
  }
}

/** One automation of a base, by key — absent and foreign read the same. */
export async function loadAutomation(exec: Executor, id: string): Promise<Automation | null> {
  if (!UUID.test(id)) return null
  const [row] = await exec.query<Row>(
    `SELECT ${COLUMNS} ${FROM} WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id],
  )
  return row === undefined ? null : shaped(row)
}

async function requireAutomation(exec: Executor, ctx: RequestContext, baseId: string, id: string) {
  const found = await loadAutomation(exec, id)
  if (found === null || found.baseId !== baseId) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { automation: id } })
  }
  return found
}

export async function listAutomations(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
  instanceKey?: () => string,
): Promise<Automation[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      const rows = await exec.query<Row>(
        `SELECT ${COLUMNS} ${FROM}
          WHERE a.base_id = $1 AND a.deleted_at IS NULL
          ORDER BY a.created_at`,
        [request.baseId],
      )
      return rows.map((row) => revealHook(shaped(row), instanceKey))
    },
    { readOnly: true },
  )
}

// ── Writing ──────────────────────────────────────────────────────────────────

/**
 * A definition checked as a save would check it — tables, fields, rows, citations, the
 * AI — and given back as it would be saved, identifiers included; nothing is written. What
 * the copilot proposes goes through here (chapter 17 §5).
 */
export async function checkAutomationDraft(
  pools: Pools,
  ctx: RequestContext,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly input: AutomationInput },
): Promise<Awaited<ReturnType<typeof checkedDefinition>>> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      // Nothing kept: a secret header given or left out is taken as it is, and never sealed.
      return checkedDefinition(exec, ctx, request.baseId, request.input, null, targets, null)
    },
    { readOnly: true },
  )
}

/**
 * How a save seals a webhook's secret headers: by the instance key. Without it — a kernel
 * started with none — a secret header is refused rather than kept in the clear.
 */
function sealingBy(instanceKey: (() => string) | undefined) {
  return (plaintext: string) => {
    if (instanceKey === undefined) throw invalid('headers', 'secret_impossible')
    return seal(instanceKey(), WEBHOOK_SECRET, plaintext)
  }
}

export async function createAutomation(
  pools: Pools,
  ctx: RequestContext,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly input: AutomationInput },
  instanceKey?: () => string,
): Promise<Automation> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const d = await checkedDefinition(
      exec,
      ctx,
      request.baseId,
      request.input,
      null,
      targets,
      sealingBy(instanceKey),
    )
    const hook = d.trigger.kind === 'webhook' ? newHook(instanceKey) : null
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.automation
         (tenant_id, base_id, label, description, is_enabled, trigger_kind, table_id, trigger,
          condition, actions, owner_id, next_run_at, created_by, hook_sealed, hook_hash,
          scanned_until)
       SELECT b.tenant_id, b.id, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $10,
              $12, $13, $14
         FROM _basedb.base b WHERE b.id = $1
       RETURNING id::text`,
      [
        request.baseId,
        d.label,
        d.description,
        d.enabled,
        d.trigger.kind,
        d.trigger.table,
        storedTrigger(d.trigger),
        d.condition,
        JSON.stringify(d.actions),
        ctx.actor.id,
        nextDueOf(d.trigger, ctx.timestamp),
        hook?.sealed ?? null,
        hook?.hash ?? null,
        // A date that arrives counts from now on: those already past are not caught up.
        d.trigger.kind === 'date_reached' ? ctx.timestamp.toISOString() : null,
      ],
      'insert',
    )
    return revealHook(
      (await loadAutomation(exec, (row as { id: string }).id)) as Automation,
      instanceKey,
    )
  })
}

/** The trigger's own settings, as kept beside its kind and table. */
const storedTrigger = (trigger: AutomationTrigger) =>
  JSON.stringify({ fields: trigger.fields, schedule: trigger.schedule, date: trigger.date })

/** When the worker next looks at it: a schedule's next run, a date trigger's next search. */
function nextDueOf(trigger: AutomationTrigger, now: Date): string | null {
  if (trigger.schedule !== null) return nextRunOf(trigger.schedule, now).toISOString()
  if (trigger.kind === 'date_reached') return now.toISOString()
  return null
}

/** Rewrites an automation; whoever saves it becomes its owner (chapter 17 §1). */
export async function updateAutomation(
  pools: Pools,
  ctx: RequestContext,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly id: string; readonly input: AutomationInput },
  instanceKey?: () => string,
): Promise<Automation> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const current = await requireAutomation(exec, ctx, request.baseId, request.id)
    const d = await checkedDefinition(
      exec,
      ctx,
      request.baseId,
      request.input,
      current,
      targets,
      sealingBy(instanceKey),
    )
    // A webhook keeps its address, unless a new one is asked for; another trigger has none.
    const hook =
      d.trigger.kind !== 'webhook'
        ? null
        : current.hookSealed === null || request.input.regenerate_hook === true
          ? newHook(instanceKey)
          : 'kept'
    // A date trigger searches from now on when it is new, changed, or switched back on: what
    // came due meanwhile is not caught up. Otherwise it goes on from where it was.
    const sameDates =
      current.trigger.kind === 'date_reached' &&
      d.trigger.kind === 'date_reached' &&
      current.trigger.table === d.trigger.table &&
      JSON.stringify(current.trigger.date) === JSON.stringify(d.trigger.date) &&
      (current.enabled || !d.enabled)
    await exec.query(
      `UPDATE _basedb.automation
          SET label = $2, description = $3, is_enabled = $4, trigger_kind = $5, table_id = $6,
              trigger = $7::jsonb, condition = $8, actions = $9::jsonb, owner_id = $10,
              next_run_at = CASE WHEN $14 THEN next_run_at ELSE $11::timestamptz END,
              hook_sealed = CASE WHEN $12 THEN hook_sealed ELSE $13 END,
              hook_hash = CASE WHEN $12 THEN hook_hash ELSE $15::bytea END,
              scanned_until = CASE WHEN $14 THEN scanned_until ELSE $16::timestamptz END,
              updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1`,
      [
        request.id,
        d.label,
        d.description,
        d.enabled,
        d.trigger.kind,
        d.trigger.table,
        storedTrigger(d.trigger),
        d.condition,
        JSON.stringify(d.actions),
        ctx.actor.id,
        nextDueOf(d.trigger, ctx.timestamp),
        hook === 'kept',
        hook === null || hook === 'kept' ? null : hook.sealed,
        sameDates,
        hook === null || hook === 'kept' ? null : hook.hash,
        d.trigger.kind === 'date_reached' ? ctx.timestamp.toISOString() : null,
      ],
      'update',
    )
    // « Entre dans un filtre » remembers which rows are in it: another filter, another set.
    if (
      current.trigger.kind === 'record_matches' &&
      (d.trigger.kind !== 'record_matches' ||
        current.condition !== d.condition ||
        current.trigger.table !== d.trigger.table)
    ) {
      await exec.query(
        'DELETE FROM _basedb.automation_match WHERE automation_id = $1',
        [request.id],
        'delete',
      )
    }
    // Switched off: what was queued or waiting will not run.
    if (!d.enabled) await stopRuns(exec, request.id, 'desactivee')
    return revealHook((await loadAutomation(exec, request.id)) as Automation, instanceKey)
  })
}

/** The runs queued or waiting of an automation switched off or deleted: they will not run. */
async function stopRuns(exec: Executor, id: string, reason: string): Promise<void> {
  await exec.query(
    `UPDATE _basedb.automation_run SET status = 'skipped', reason = $2, resume_at = NULL,
            finished_at = pg_catalog.clock_timestamp()
      WHERE automation_id = $1 AND status IN ('queued', 'waiting')`,
    [id, reason],
    'update',
  )
}

export async function deleteAutomation(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    await requireAutomation(exec, ctx, request.baseId, request.id)
    await exec.query(
      'UPDATE _basedb.automation SET deleted_at = pg_catalog.clock_timestamp() WHERE id = $1',
      [request.id],
      'update',
    )
    await stopRuns(exec, request.id, 'supprimee')
  })
}

export async function listAutomationRuns(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<AutomationRun[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      await requireAutomation(exec, ctx, request.baseId, request.id)
      const rows = await exec.query<{
        id: string
        trigger_kind: string
        record_id: string | null
        status: AutomationRun['status']
        resume_at: string | null
        reason: string | null
        error_code: string | null
        steps: Array<Record<string, unknown>>
        queued_at: string
        started_at: string | null
        finished_at: string | null
      }>(
        `SELECT id::text, trigger_kind, record_id::text, status, resume_at::text, reason,
                error_code, steps, queued_at::text, started_at::text, finished_at::text
           FROM _basedb.automation_run WHERE automation_id = $1
          ORDER BY queued_at DESC LIMIT 50`,
        [request.id],
      )
      return rows.map((r) => ({
        id: r.id,
        trigger: r.trigger_kind,
        recordId: r.record_id,
        status: r.status,
        resumeAt: r.resume_at === null ? null : new Date(r.resume_at).toISOString(),
        reason: r.reason,
        errorCode: r.error_code,
        steps: r.steps,
        queuedAt: r.queued_at,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
      }))
    },
    { readOnly: true },
  )
}
