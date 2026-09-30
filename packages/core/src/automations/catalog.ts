import { AI_KINDS, type AiKind } from '../ai/answer.js'
import { resolveProvider } from '../ai/draft.js'
import { MAX_PROMPT_CHARS } from '../ai/prompt.js'
import { BasedbError } from '../errors/index.js'
import { isAddress } from '../mail/message.js'
import { requireOnBase } from '../rbac/require.js'
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

export type TriggerKind = 'record_created' | 'record_updated' | 'schedule' | 'button'

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
      readonly message: string
    }
  | {
      readonly id: string
      readonly kind: 'webhook'
      /** The row sent; `null`: none. */
      readonly record: RowSource | null
      readonly url: string
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
  /** A row, and a filter it must satisfy; `null`: otherwise — the last path only. */
  readonly when: { readonly record: RowSource; readonly condition: string } | null
  readonly steps: readonly AutomationStep[]
}

/** What chapter 17 first called an action is now a step. */
export type AutomationAction = AutomationStep

export interface AutomationTrigger {
  readonly kind: TriggerKind
  /** The table's catalog key; `null` for a schedule. */
  readonly table: string | null
  /** The watched fields of `record_updated` — none: any change. */
  readonly fields: readonly string[]
  readonly schedule: Schedule | null
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
}

export interface AutomationRun {
  readonly id: string
  readonly trigger: string
  readonly recordId: string | null
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
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
}

/** Steps in all, branches and what they hold included. */
export const MAX_STEPS = 30
/** Branches within branches. */
export const MAX_DEPTH = 3
export const MAX_PATHS = 5
export const MAX_NOTIFIED = 20
/** The recipients an e-mail step names — people and addresses together. */
export const MAX_MAILED = 20
/** The choices an AI step may be asked to pick among. */
export const MAX_AI_OPTIONS = 50

const invalid = (field: string, reason: string, detail?: unknown) =>
  new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })

const TRIGGERS: readonly TriggerKind[] = ['record_created', 'record_updated', 'schedule', 'button']
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
}

/** A text may cite a step only once it has run: one passed on every way here. */
function checkCitations(text: string, scope: Scope, field: string): void {
  for (const path of citationsOf(text)) {
    const head = path[0] as string
    if (path.length > 1 && !scope.steps.has(head)) throw invalid(field, 'etape_inconnue', head)
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
): { readonly ref: string | null; readonly table: TableInfo | null } {
  const ref =
    typeof raw === 'string' && raw !== '' ? raw : scope.trigger === null ? null : TRIGGER_ROW
  if (ref === null || (ref === TRIGGER_ROW && scope.trigger === null)) {
    if (required !== null) throw invalid(field, required)
    return { ref: null, table: null }
  }
  if (ref === TRIGGER_ROW) return { ref, table: scope.trigger }
  const table = scope.steps.get(ref)
  if (table === undefined) throw invalid(field, 'etape_inconnue', ref)
  if (table === null) throw invalid(field, 'etape_sans_ligne', ref)
  return { ref, table }
}

/** Every identifier a flow already carries, so that the new ones do not collide. */
function idsOf(raw: unknown, into: Set<string>): Set<string> {
  if (!Array.isArray(raw)) return into
  for (const item of raw) {
    const step = (item ?? {}) as Record<string, unknown>
    if (typeof step.id === 'string') into.add(step.id)
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
  count: number
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
  depth: number,
): Promise<AutomationStep[]> {
  if (!Array.isArray(raw)) throw invalid(at, 'etapes_invalides')
  const scope = { trigger: outer.trigger, steps: new Map(outer.steps) }
  const out: AutomationStep[] = []
  for (const [index, item] of raw.entries()) {
    const field = `${at}[${index}]`
    const a = (item ?? {}) as Record<string, unknown>
    walk.count++
    if (walk.count > MAX_STEPS) throw invalid('actions', 'trop_d_etapes', MAX_STEPS)
    const id = identifier(walk, a.id, 'e', `${field}.id`)
    try {
      const { step, gives } = await checkedStep(walk, a, id, scope, field, depth)
      out.push(step)
      if (gives !== undefined) scope.steps.set(id, gives)
    } catch (error) {
      throw aboutStep(error, id)
    }
  }
  return out
}

async function checkedStep(
  walk: Walk,
  a: Record<string, unknown>,
  id: string,
  scope: Scope,
  at: string,
  depth: number,
): Promise<{ readonly step: AutomationStep; readonly gives?: TableInfo | null }> {
  switch (a.kind) {
    case 'update_record': {
      const source = rowSource(a.record, scope, `${at}.record`, 'action_sans_ligne')
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
      const message = typeof a.message === 'string' ? a.message.trim() : ''
      if (message === '' || message.length > 5000)
        throw invalid(`${at}.message`, 'message_invalide')
      checkCitations(message, scope, `${at}.message`)
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
        },
      }
    }
    case 'webhook': {
      const source = rowSource(a.record, scope, `${at}.record`, null)
      const url = typeof a.url === 'string' ? a.url.trim() : ''
      await checkTarget(url, walk.targets)
      return { step: { id, kind: 'webhook', record: source.ref, url }, gives: null }
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
      if (depth >= MAX_DEPTH) throw invalid(at, 'branches_trop_profondes', MAX_DEPTH)
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
          const source = rowSource(w.record, scope, `${field}.when.record`, 'condition_sans_ligne')
          const condition = typeof w.condition === 'string' ? w.condition.trim() : ''
          if (condition.length > 4000) throw invalid(`${field}.when.condition`, 'texte_trop_long')
          checkCitations(condition, scope, `${field}.when.condition`)
          when = { record: source.ref as string, condition }
        } else if (index !== raw.length - 1) {
          throw invalid(`${field}.when`, 'sinon_en_dernier')
        }
        const label =
          typeof p.label === 'string' && p.label.trim() !== ''
            ? p.label.trim().slice(0, 60)
            : when === null
              ? 'Sinon'
              : `Chemin ${index + 1}`
        const steps = await checkedSteps(walk, p.steps ?? [], scope, `${field}.steps`, depth + 1)
        paths.push({ id: pathId, label, when, steps })
      }
      return { step: { id, kind: 'branch', paths } }
    }
    default:
      throw invalid(`${at}.kind`, 'action_inconnue', a.kind)
  }
}

async function checkedDefinition(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
  input: AutomationInput,
  current: Automation | null,
  targets: TargetPolicy,
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
  const rawTrigger = (input.trigger ?? current?.trigger ?? {}) as Record<string, unknown>
  const kind = rawTrigger.kind as TriggerKind
  if (!TRIGGERS.includes(kind))
    throw invalid('trigger.kind', 'declencheur_inconnu', rawTrigger.kind)
  let trigger: AutomationTrigger
  if (kind === 'schedule') {
    trigger = { kind, table: null, fields: [], schedule: checkedSchedule(rawTrigger.schedule) }
  } else {
    const table = tableByName(tables, rawTrigger.table, 'trigger.table')
    const fields =
      kind === 'record_updated' && Array.isArray(rawTrigger.fields)
        ? [...new Set(rawTrigger.fields.filter((f): f is string => typeof f === 'string'))]
        : []
    for (const f of fields)
      if (!table.fields.has(f)) throw invalid('trigger.fields', 'champ_inconnu', f)
    trigger = { kind, table: table.id, fields, schedule: null }
  }
  const source = trigger.table === null ? null : (tables.get(trigger.table) ?? null)

  const rawCondition = input.condition === undefined ? current?.condition : input.condition
  const condition =
    typeof rawCondition === 'string' && rawCondition.trim() !== '' ? rawCondition.trim() : null
  if (condition !== null && trigger.table === null)
    throw invalid('condition', 'condition_sans_ligne')
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
    count: 0,
  }
  const actions = await checkedSteps(
    walk,
    rawSteps,
    { trigger: source, steps: new Map() },
    'actions',
    0,
  )
  return { label, description, enabled, trigger, condition, actions }
}

/** Steps as the API shows them — tables by key, `user_field` — and takes them back. */
export function wireSteps(steps: readonly AutomationStep[]): Record<string, unknown>[] {
  return steps.map((s): Record<string, unknown> => {
    switch (s.kind) {
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
        }
      case 'branch':
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
 * are numbered in order, and act on the triggering row, as they always did.
 */
function storedSteps(raw: unknown, hasRow: boolean): AutomationStep[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item, index) => {
    const s = item as Record<string, unknown>
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
}

const COLUMNS = `a.id::text, a.base_id::text, a.label, a.description, a.is_enabled, a.trigger_kind,
       a.table_id::text, a.trigger, a.condition, a.actions, a.owner_id::text,
       coalesce(nullif(u.display_name, ''), u.email) AS owner_name, a.next_run_at::text,
       last.status AS last_status, last.at AS last_at, a.created_at::text, a.updated_at::text`
const FROM = `FROM _basedb.automation a
       JOIN _basedb.app_user u ON u.id = a.owner_id
       LEFT JOIN LATERAL (
         SELECT r.status, coalesce(r.finished_at, r.queued_at)::text AS at
           FROM _basedb.automation_run r WHERE r.automation_id = a.id
          ORDER BY r.queued_at DESC LIMIT 1) last ON true`

function shaped(row: Row): Automation {
  const t = row.trigger as { fields?: string[]; schedule?: Schedule }
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
    },
    condition: row.condition,
    actions: storedSteps(row.actions, row.table_id !== null),
    owner: { id: row.owner_id, name: row.owner_name },
    nextRunAt: row.next_run_at,
    lastRun: row.last_status === null ? null : { status: row.last_status, at: row.last_at ?? '' },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
      return rows.map(shaped)
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
      return checkedDefinition(exec, ctx, request.baseId, request.input, null, targets)
    },
    { readOnly: true },
  )
}

export async function createAutomation(
  pools: Pools,
  ctx: RequestContext,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly input: AutomationInput },
): Promise<Automation> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const d = await checkedDefinition(exec, ctx, request.baseId, request.input, null, targets)
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.automation
         (tenant_id, base_id, label, description, is_enabled, trigger_kind, table_id, trigger,
          condition, actions, owner_id, next_run_at, created_by)
       SELECT b.tenant_id, b.id, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $10
         FROM _basedb.base b WHERE b.id = $1
       RETURNING id::text`,
      [
        request.baseId,
        d.label,
        d.description,
        d.enabled,
        d.trigger.kind,
        d.trigger.table,
        JSON.stringify({ fields: d.trigger.fields, schedule: d.trigger.schedule }),
        d.condition,
        JSON.stringify(d.actions),
        ctx.actor.id,
        d.trigger.schedule === null
          ? null
          : nextRunOf(d.trigger.schedule, ctx.timestamp).toISOString(),
      ],
      'insert',
    )
    return (await loadAutomation(exec, (row as { id: string }).id)) as Automation
  })
}

/** Rewrites an automation; whoever saves it becomes its owner (chapter 17 §1). */
export async function updateAutomation(
  pools: Pools,
  ctx: RequestContext,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly id: string; readonly input: AutomationInput },
): Promise<Automation> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const current = await requireAutomation(exec, ctx, request.baseId, request.id)
    const d = await checkedDefinition(exec, ctx, request.baseId, request.input, current, targets)
    await exec.query(
      `UPDATE _basedb.automation
          SET label = $2, description = $3, is_enabled = $4, trigger_kind = $5, table_id = $6,
              trigger = $7::jsonb, condition = $8, actions = $9::jsonb, owner_id = $10,
              next_run_at = $11, updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1`,
      [
        request.id,
        d.label,
        d.description,
        d.enabled,
        d.trigger.kind,
        d.trigger.table,
        JSON.stringify({ fields: d.trigger.fields, schedule: d.trigger.schedule }),
        d.condition,
        JSON.stringify(d.actions),
        ctx.actor.id,
        d.trigger.schedule === null
          ? null
          : nextRunOf(d.trigger.schedule, ctx.timestamp).toISOString(),
      ],
      'update',
    )
    // Switched off: what was waiting will not run.
    if (!d.enabled) {
      await exec.query(
        `UPDATE _basedb.automation_run SET status = 'skipped', reason = 'desactivee',
                finished_at = pg_catalog.clock_timestamp()
          WHERE automation_id = $1 AND status = 'queued'`,
        [request.id],
        'update',
      )
    }
    return (await loadAutomation(exec, request.id)) as Automation
  })
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
    await exec.query(
      `UPDATE _basedb.automation_run SET status = 'skipped', reason = 'supprimee',
              finished_at = pg_catalog.clock_timestamp()
        WHERE automation_id = $1 AND status = 'queued'`,
      [request.id],
      'update',
    )
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
        reason: string | null
        error_code: string | null
        steps: Array<Record<string, unknown>>
        queued_at: string
        started_at: string | null
        finished_at: string | null
      }>(
        `SELECT id::text, trigger_kind, record_id::text, status, reason, error_code, steps,
                queued_at::text, started_at::text, finished_at::text
           FROM _basedb.automation_run WHERE automation_id = $1
          ORDER BY queued_at DESC LIMIT 50`,
        [request.id],
      )
      return rows.map((r) => ({
        id: r.id,
        trigger: r.trigger_kind,
        recordId: r.record_id,
        status: r.status,
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
