import { createHash, randomUUID } from 'node:crypto'
import { expectedFormat, parseAnswer } from '../ai/answer.js'
import {
  type ProviderTransport,
  assertQuota,
  computeStepValue,
  resolveProvider,
} from '../ai/draft.js'
import { EMPTY_VALUE, MAX_VALUE_CHARS } from '../ai/prompt.js'
import { unseal } from '../auth/sealing.js'
import { type ProjectedField, projectBase } from '../catalog/projection.js'
import { wantsNotification } from '../collab/notifications.js'
import { canReadTable, contextOf, emitLive } from '../collab/signals.js'
import { renderDocument } from '../documents/render.js'
import { BasedbError } from '../errors/index.js'
import { type FileDeps, uploadFile } from '../files/operations.js'
import { postToSlack, slackUrlOf } from '../integrations/slack.js'
import { isAddress } from '../mail/message.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { requireOnBase } from '../rbac/require.js'
import { aggregateRecords } from '../records/aggregate.js'
import { createRecord } from '../records/create.js'
import { listRecords } from '../records/list.js'
import { richTextToPlain } from '../records/rich-text.js'
import { deleteRecord, updateRecord } from '../records/update.js'
import type { Executor, Pools } from '../runtime/pool.js'
import {
  type RequestContext,
  deadlineExceeded,
  sealContext,
  withTransaction,
} from '../tx/context.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'
import {
  type Automation,
  type AutomationStep,
  type BranchPath,
  CITATION,
  CITATION_AT,
  MAX_ATTACHED_BYTES,
  MAX_CHAIN,
  MEASURE_NAMES,
  TRIGGER_ROW,
  type ValueOperator,
  WEBHOOK_SECRET,
  type WebhookHeader,
  composeJson,
  formPairs,
  hasBody,
  isValueTest,
  loadAutomation,
  nextRunOf,
  stepsOf,
  utcOf,
} from './catalog.js'

/**
 * Running automations — chapter 17 §2. The drain queues the runs a row triggers, the
 * clock those a schedule does, a button its own; a worker in the API process takes them
 * in batches and runs them down their flow, step after step, on the owner's authority
 * decided again, each step able to cite what the steps before it found or wrote.
 */

export const RUNS_PER_HOUR = 100
const BATCH = 10
const WEBHOOK_TIMEOUT_MS = 10_000
/**
 * What one run may take, loops included: the worker runs one at a time, and a loop of
 * slow webhooks must not hold every other automation of the instance back.
 */
export const RUN_BUDGET_MS = 120_000
/** What a webhook's answer may weigh, for the steps after it to cite. */
const ANSWER_BYTES = 65_536

// ── Queuing ──────────────────────────────────────────────────────────────────

/** A revision as the drain hands it: enough to know which automations it triggers. */
export interface Trigger {
  readonly tableId: string
  readonly recordId: string
  readonly op: string
  readonly actorKind: string
  /** The columns an update changed. */
  readonly changed: readonly string[]
  /** A deleted row as it was: what an automation on deletions cites. */
  readonly before?: Readonly<Record<string, unknown>> | null
}

/** Which automations a revision triggers, by their trigger. */
function triggers(
  automation: { readonly trigger_kind: string; readonly fields: readonly string[] | null },
  t: Trigger,
): boolean {
  switch (automation.trigger_kind) {
    case 'record_created':
      return t.op === 'insert'
    case 'record_updated':
      return (
        t.op === 'update' &&
        ((automation.fields ?? []).length === 0 ||
          t.changed.some((c) => (automation.fields ?? []).includes(c)))
      )
    case 'record_deleted':
      return t.op === 'delete'
    // Whether the row enters the filter is decided when the run is taken: every write may.
    case 'record_matches':
      return t.op === 'insert' || t.op === 'update'
    default:
      return false
  }
}

/**
 * Queues the runs a drained batch triggers — in the drain's transaction. A write made by
 * an automation triggers none (chapter 17 §1.1); past the hourly budget, one `skipped`
 * run says so instead of thousands. « Entre dans un filtre » is not counted here: most of
 * the writes it looks at are dropped, and only a row that enters counts.
 */
export async function queueTriggered(exec: Executor, batch: readonly Trigger[]): Promise<void> {
  const eligible = batch.filter((t) => t.actorKind !== 'automation')
  if (eligible.length === 0) return
  const automations = await exec.query<{
    id: string
    table_id: string
    trigger_kind: string
    fields: string[] | null
  }>(
    `SELECT id::text, table_id::text, trigger_kind,
            ARRAY(SELECT jsonb_array_elements_text(coalesce(trigger->'fields', '[]'::jsonb))) AS fields
       FROM _basedb.automation
      WHERE table_id = ANY($1::uuid[]) AND deleted_at IS NULL AND is_enabled
        AND trigger_kind IN ('record_created', 'record_updated', 'record_deleted', 'record_matches')`,
    [[...new Set(eligible.map((t) => t.tableId))]],
  )
  for (const automation of automations) {
    const hits = eligible.filter(
      (t) => t.tableId === automation.table_id && triggers(automation, t),
    )
    if (hits.length === 0) continue
    let room = hits.length
    if (automation.trigger_kind !== 'record_matches') {
      const [used] = await exec.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM _basedb.automation_run
          WHERE automation_id = $1 AND queued_at > pg_catalog.clock_timestamp() - interval '1 hour'
            AND reason IS DISTINCT FROM 'debit'`,
        [automation.id],
      )
      room = Math.max(0, RUNS_PER_HOUR - (used?.n ?? 0))
    }
    const queued = hits.slice(0, room)
    if (queued.length > 0) {
      await exec.query(
        `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id, payload)
         SELECT $1, $2, x.id, x.payload
           FROM jsonb_to_recordset($3::jsonb) AS x(id uuid, payload jsonb)`,
        [
          automation.id,
          automation.trigger_kind,
          JSON.stringify(
            queued.map((t) => ({
              id: t.recordId,
              payload:
                automation.trigger_kind === 'record_deleted'
                  ? { ...(t.before ?? {}), _id: t.recordId }
                  : null,
            })),
          ),
        ],
        'insert',
      )
    }
    if (hits.length > queued.length) {
      await exec.query(
        `INSERT INTO _basedb.automation_run
           (automation_id, trigger_kind, record_id, status, reason, finished_at)
         VALUES ($1, $2, NULL, 'skipped', 'debit', pg_catalog.clock_timestamp())`,
        [automation.id, automation.trigger_kind],
        'insert',
      )
    }
  }
}

/** The schedules due: one run each at most waiting, the next due date moved on. */
export async function queueDue(pools: Pools): Promise<number> {
  return pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    try {
      const due = await exec.query<{
        id: string
        trigger: { schedule: Parameters<typeof nextRunOf>[0] }
      }>(
        `SELECT id::text, trigger FROM _basedb.automation
          WHERE trigger_kind = 'schedule' AND deleted_at IS NULL AND is_enabled
            AND next_run_at <= pg_catalog.clock_timestamp()
          FOR UPDATE SKIP LOCKED`,
      )
      for (const automation of due) {
        await exec.query(
          `INSERT INTO _basedb.automation_run (automation_id, trigger_kind)
           SELECT $1, 'schedule'
            WHERE NOT EXISTS (SELECT 1 FROM _basedb.automation_run
                               WHERE automation_id = $1 AND status IN ('queued', 'running'))`,
          [automation.id],
          'insert',
        )
        // A due date missed while stopped is caught up once, not as many times as missed.
        await exec.query('UPDATE _basedb.automation SET next_run_at = $2 WHERE id = $1', [
          automation.id,
          nextRunOf(automation.trigger.schedule, new Date()).toISOString(),
        ])
      }
      await exec.query('COMMIT')
      return due.length
    } catch (error) {
      await exec.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}

/** How often a date trigger looks for the dates that came due. */
const DATE_SCAN_MS = 60_000
/** How long a search keeps its automation to itself: another process waits that long. */
const DATE_LEASE_MS = 5 * 60_000
/** The furthest back a search looks, after an instance stopped for long. */
const DATE_CATCH_UP_MS = 7 * 86_400_000
/** The rows a search queues at most, for one automation, in one pass. */
const DATE_ROWS = 500

/**
 * The local dates whose moment — the date moved by days, at the time of day — falls in
 * `(from, to]`: the values a date field must hold for a row to come due in that window.
 */
export function datesDue(
  when: { readonly offsetDays: number; readonly at: string; readonly timezone: string },
  from: Date,
  to: Date,
): string[] {
  const out: string[] = []
  const day = 86_400_000
  // Every calendar day the window could touch, one more on each side for the time zones.
  for (
    let t = from.getTime() - (when.offsetDays + 2) * day;
    t <= to.getTime() - (when.offsetDays - 2) * day;
    t += day
  ) {
    const d = new Date(t)
    const iso = d.toISOString().slice(0, 10)
    const moment = momentOf(iso, 'date', when)
    if (moment !== null && moment > from && moment <= to && !out.includes(iso)) out.push(iso)
  }
  return out
}

/**
 * The dates that came due (chapter 17 §1.1): each automation on a date, in turn, looks for
 * the rows whose date — moved by its days, at its time — fell since it last looked, with
 * its owner's rights, and queues a run for each, within the hourly budget. It keeps the
 * automation to itself meanwhile, so that two processes do not queue the same row twice.
 */
export async function queueDates(pools: Pools): Promise<number> {
  const due = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string; scanned_until: string | null }>(
      `UPDATE _basedb.automation
          SET next_run_at = pg_catalog.clock_timestamp() + make_interval(secs => $1)
        WHERE id IN (SELECT id FROM _basedb.automation
                      WHERE trigger_kind = 'date_reached' AND deleted_at IS NULL AND is_enabled
                        AND next_run_at <= pg_catalog.clock_timestamp()
                      ORDER BY next_run_at LIMIT 20 FOR UPDATE SKIP LOCKED)
        RETURNING id::text, scanned_until::text`,
      [DATE_LEASE_MS / 1000],
      'update',
    ),
  )
  for (const claimed of due) {
    const to = new Date()
    const scanned = claimed.scanned_until === null ? to : new Date(claimed.scanned_until)
    const from = new Date(Math.max(scanned.getTime(), to.getTime() - DATE_CATCH_UP_MS))
    await queueDatesOf(pools, claimed.id, from, to).catch(() => undefined)
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        'UPDATE _basedb.automation SET scanned_until = $2, next_run_at = $3 WHERE id = $1',
        [claimed.id, to.toISOString(), new Date(to.getTime() + DATE_SCAN_MS).toISOString()],
        'update',
      ),
    )
  }
  return due.length
}

async function queueDatesOf(pools: Pools, id: string, from: Date, to: Date): Promise<void> {
  if (to <= from) return
  const found = await pools.withConnection('catalog', async (exec) => {
    const automation = await loadAutomation(exec, id)
    if (automation === null) return null
    const [owner] = await exec.query<{ ref: string; active: boolean }>(
      `SELECT t.ref, (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS active
         FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
        WHERE u.id = $1`,
      [automation.owner.id],
    )
    return { automation, owner }
  })
  const automation = found?.automation
  const date = automation?.trigger.date ?? null
  const table = automation?.trigger.table ?? null
  if (automation === undefined || date === null || table === null) return
  if (found?.owner === undefined || !found.owner.active) return
  const ctx = actorOf(found.owner.ref, automation)
  const base = await projectBase(pools, ctx, automation.baseId)
  const kind =
    base.tables.find((t) => t.id === table)?.fields.find((f) => f.name === date.field)?.kind ?? null
  if (kind === null) return
  const quoted = (text: string) => `"${text}"`
  const field = date.field
  let filter: string
  if (kind === 'datetime') {
    // A date and time comes due at its own instant, moved by days.
    const shift = date.offsetDays * 86_400_000
    filter = `${field} gt ${quoted(new Date(from.getTime() - shift).toISOString())} and ${field} lte ${quoted(new Date(to.getTime() - shift).toISOString())}`
  } else {
    const dates = datesDue(date, from, to)
    if (dates.length === 0) return
    filter = `${field} in [${dates.map(quoted).join(', ')}]`
  }
  const page = await listRecords(pools, ctx, { tableId: table, filter, limit: DATE_ROWS })
  if (page.rows.length === 0) return
  await pools.withConnection('catalog', async (exec) => {
    const [used] = await exec.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM _basedb.automation_run
        WHERE automation_id = $1 AND queued_at > pg_catalog.clock_timestamp() - interval '1 hour'
          AND reason IS DISTINCT FROM 'debit'`,
      [id],
    )
    const room = Math.max(0, RUNS_PER_HOUR - (used?.n ?? 0))
    const ids = page.rows.slice(0, room).map((r) => String(r._id))
    if (ids.length > 0) {
      await exec.query(
        `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id)
         SELECT $1, 'date_reached', unnest($2::uuid[])`,
        [id, ids],
        'insert',
      )
    }
    if (page.rows.length > ids.length) {
      await exec.query(
        `INSERT INTO _basedb.automation_run
           (automation_id, trigger_kind, record_id, status, reason, finished_at)
         VALUES ($1, 'date_reached', NULL, 'skipped', 'debit', pg_catalog.clock_timestamp())`,
        [id],
        'insert',
      )
    }
  })
}

// ── Running ──────────────────────────────────────────────────────────────────

interface Claimed extends Record<string, unknown> {
  readonly id: string
  readonly automation_id: string
  readonly trigger_kind: string
  readonly record_id: string | null
  /** What the trigger brought without a row to read again: a webhook's body, a deleted row. */
  readonly payload: unknown
  readonly depth: number
  /** What a run that waited kept, to go on. */
  readonly state: Kept | null
}

/**
 * What a run keeps of each step it passed: enough to follow it on the flow (§2.1). A step
 * inside a loop is kept once, for all its turns: how many, and how they went.
 */
interface RunStep {
  readonly step: string
  readonly kind: AutomationStep['kind']
  readonly status: 'succeeded' | 'failed' | 'skipped'
  /** The path a branch took; `null`: none held. */
  readonly path?: string | null
  /** In a loop, every path a branch took, turn after turn. */
  readonly taken?: readonly string[]
  readonly detail?: string
  readonly error_code?: string
  /** How long it took, in milliseconds — all its turns, in a loop. */
  readonly ms: number
  /** In a loop, the turns it ran. */
  readonly times?: number
  /** A loop left rows beyond its limit. */
  readonly more?: boolean
}

/** The automation's actor: its owner's rights, its own name in the history. */
function actorOf(tenantRef: string, automation: Automation): RequestContext {
  const now = new Date()
  return sealContext({
    requestId: crypto.randomUUID(),
    actor: { kind: 'automation', id: automation.owner.id, tokenId: automation.id },
    tenantId: tenantRef,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + RUN_BUDGET_MS),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

type Row = Readonly<Record<string, unknown>>

/** A row a step acts on or a text cites, with the fields it is read by. */
interface Held {
  readonly table: string
  readonly fields: ReadonlyMap<string, ProjectedField>
  readonly row: Row | null
}

/**
 * What a text may cite at a point of a run (chapter 17 §1.6): the rows held — the
 * triggering one under `trigger`, then each step's — and what webhooks answered.
 */
export interface Citable {
  readonly rows: ReadonlyMap<string, Held>
  readonly data: ReadonlyMap<string, unknown>
  readonly people: ReadonlyMap<string, string>
  readonly now: Date
}

/** A value as a message reads it: a relation by its name, a choice by its label. */
function textOf(
  value: unknown,
  field: ProjectedField | undefined,
  people: ReadonlyMap<string, string>,
): string {
  if (value === null || value === undefined) return ''
  if (field?.kind === 'link') return String((value as { display?: unknown }).display ?? '')
  if (field?.kind === 'multi_link' && Array.isArray(value)) {
    return value.map((v) => String((v as { display?: unknown }).display ?? '')).join(', ')
  }
  if (field?.kind === 'select') {
    return field.options?.find((o) => o.value === value)?.label ?? String(value)
  }
  if (field?.kind === 'multi_select' && Array.isArray(value)) {
    return value
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
      .join(', ')
  }
  if (field?.kind === 'user' && typeof value === 'string') return people.get(value) ?? ''
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  if (Array.isArray(value))
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  // A `numeric` column reads « 1840.5000000000 »: a message says 1840.5.
  if (typeof value === 'string' && field !== undefined && DECIMAL_KINDS.has(field.kind)) {
    return /^-?\d+\.\d+$/.test(value) ? value.replace(/\.?0+$/, '') : value
  }
  return String(value)
}

/** The kinds whose column is a `numeric`, read back with all its decimals. */
const DECIMAL_KINDS = new Set(['number', 'rollup', 'formula'])

/** The kinds a row gives as a text of digits, that a JSON body carries as a number. */
const NUMERIC_KINDS = new Set(['number', 'autonumber', 'count'])

/**
 * A value as a JSON body carries it outside a string: a number, a yes-or-no, nothing, as
 * such; a relation, a choice, a person as a person reads them, several as a list; what a
 * webhook or the AI answered as it came.
 */
function jsonOf(
  value: unknown,
  field: ProjectedField | undefined,
  people: ReadonlyMap<string, string>,
): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (field === undefined) return value
  if (typeof value === 'string' && NUMERIC_KINDS.has(field.kind)) {
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }
  if (field.kind === 'multi_link' || field.kind === 'multi_select') {
    const single = { ...field, kind: field.kind === 'multi_link' ? 'link' : 'select' }
    return (Array.isArray(value) ? value : [value]).map((v) => textOf(v, single, people))
  }
  if (typeof value === 'object' && !['link', 'select', 'user'].includes(field.kind)) return value
  return textOf(value, field, people)
}

function fromRow(held: Held | undefined, name: string): { value: unknown; field?: ProjectedField } {
  if (held?.row === null || held?.row === undefined) return { value: null }
  if (name === '_id') return { value: held.row._id }
  return { value: held.row[name], field: held.fields.get(name) }
}

function dig(value: unknown, path: readonly string[]): unknown {
  let v = value
  for (const key of path) {
    if (v === null || typeof v !== 'object') return null
    v = (v as Record<string, unknown>)[key]
  }
  return v
}

/**
 * What a citation names: `champ` of the triggering row, `_maintenant`, or a step and a
 * path into what it gave — a field of its row, a key of a webhook's answer.
 */
function resolve(
  path: readonly string[],
  scope: Citable,
): { value: unknown; field?: ProjectedField } {
  const [head, ...rest] = path as [string, ...string[]]
  if (rest.length === 0) {
    if (head === '_maintenant') return { value: scope.now.toISOString() }
    return fromRow(scope.rows.get(TRIGGER_ROW), head)
  }
  const held = scope.rows.get(head)
  if (held !== undefined) {
    const found = fromRow(held, rest[0] as string)
    return rest.length === 1 ? found : { value: dig(found.value, rest.slice(1)) }
  }
  return { value: dig(scope.data.get(head), rest) }
}

/** `{{champ}}`, `{{_id}}`, `{{_maintenant}}` and `{{e2.champ}}` replaced by what they read. */
export function render(template: string, scope: Citable): string {
  return template.replace(CITATION, (_, path: string) => {
    const { value, field } = resolve(path.split('.'), scope)
    return textOf(value, field, scope.people)
  })
}

/**
 * A prompt with its citations replaced, for a model (chapter 12 §1.5): an empty value reads
 * `(vide)` — the model is told what it means —, a long one is cut.
 */
export function renderPrompt(template: string, scope: Citable): string {
  return template.replace(CITATION, (_, path: string) => {
    const { value, field } = resolve(path.split('.'), scope)
    const text = textOf(value, field, scope.people)
    return text === '' ? EMPTY_VALUE : [...text].slice(0, MAX_VALUE_CHARS).join('')
  })
}

/** A value as a filter compares it: a relation by its row, a choice by its key. */
function scalarOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.length === 0 ? null : scalarOf(value[0])
  if (value !== null && typeof value === 'object')
    return (value as { id?: unknown }).id ?? JSON.stringify(value)
  return value ?? null
}

const quote = (text: string) => text.replace(/[\\"]/g, (c) => `\\${c}`)

/**
 * A filter with its citations replaced (chapter 17 §1.6). A text always lands inside a
 * string, its quotes escaped: what a row holds is compared, never read as the filter's
 * own words. A number and a boolean, which cannot be, stay bare.
 */
export function renderFilter(template: string, scope: Citable): string {
  let out = ''
  let quoted = false
  let i = 0
  while (i < template.length) {
    const c = template[i] as string
    if (c === '{') {
      const m = CITATION_AT.exec(template.slice(i))
      if (m !== null) {
        const value = scalarOf(resolve((m[1] as string).split('.'), scope).value)
        const text = quote(value === null ? '' : String(value))
        out +=
          quoted || typeof value === 'number' || typeof value === 'boolean' ? text : `"${text}"`
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

/**
 * A JSON body with its citations replaced (chapter 17 §1.6): inside a string, by the value
 * as a message reads it, escaped so that it cannot close the string; outside, by a JSON
 * value — a number, a yes-or-no, a list —: what a row holds never becomes the body's words.
 */
export function renderJson(template: string, scope: Citable): string {
  return composeJson(template, (path, quoted) => {
    const { value, field } = resolve(path.split('.'), scope)
    return quoted
      ? JSON.stringify(textOf(value, field, scope.people)).slice(1, -1)
      : JSON.stringify(jsonOf(value, field, scope.people))
  })
}

/** A form body: each `clé=valeur` rendered, then encoded as a web form sends it. */
export function renderForm(template: string, scope: Citable): string {
  const form = new URLSearchParams()
  for (const [key, value] of formPairs(template))
    form.append(render(key, scope).trim(), render(value, scope))
  return form.toString()
}

/**
 * An address with what it cites, each value encoded: it adds to a path, never to the host.
 * A value that makes a whole segment `.` or `..` — which an address resolves, encoded or
 * not — would climb the path instead: the step fails rather than call another resource.
 */
export function renderUrl(template: string, scope: Citable): string {
  const url = template.replace(CITATION, (_, path: string) => {
    const { value, field } = resolve(path.split('.'), scope)
    return encodeURIComponent(textOf(value, field, scope.people))
  })
  const path = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '').split(/[?#]/)[0] ?? ''
  if (path.split('/').some((segment) => /^(\.|%2e){1,2}$/i.test(segment))) {
    throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: 'adresse_invalide' } })
  }
  return url
}

/** The kinds a citation reaches as text; any other takes the value itself. */
const TEXT_KINDS = new Set(['short_text', 'long_text', 'email', 'url', 'phone'])
const ALONE = /^\s*\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}\s*$/

/** A value as a field stores it: a relation by its row's identifier. */
function storedOf(value: unknown, field: ProjectedField): unknown {
  // A choice named by its label — what a person, or a model, writes — is stored by its key.
  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
  const choice = (v: unknown) =>
    typeof v === 'string'
      ? (field.options?.find((o) => o.value === v || fold(o.label) === fold(v))?.value ?? v)
      : v
  const idOf = (v: unknown) =>
    v !== null && typeof v === 'object' && 'id' in v
      ? (v as { id: unknown }).id
      : field.kind === 'select' || field.kind === 'multi_select'
        ? choice(v)
        : v
  if (value === undefined || value === null) return null
  if (field.kind === 'multi_link' || field.kind === 'multi_select') {
    return (Array.isArray(value) ? value : [value]).map(idOf).filter((v) => v !== null && v !== '')
  }
  if (Array.isArray(value)) return value.length === 0 ? null : idOf(value[0])
  return idOf(value)
}

/**
 * A value to write. A citation alone passes the value itself — a relation, a choice, a
 * person, a number, from one step to the next — unless the field wants a text; anything
 * else is rendered, then read as the field's type expects.
 */
function valueFor(raw: unknown, field: ProjectedField | undefined, scope: Citable): unknown {
  if (typeof raw !== 'string') return raw
  const alone = ALONE.exec(raw)
  if (alone !== null && field !== undefined && !TEXT_KINDS.has(field.kind)) {
    return storedOf(resolve((alone[1] as string).split('.'), scope).value, field)
  }
  const text = render(raw, scope)
  if (field === undefined) return text
  if (text === '') return null
  if (field.kind === 'number') {
    const n = Number(text.replace(',', '.'))
    return Number.isFinite(n) ? n : text
  }
  if (field.kind === 'boolean') return text === 'true' || text === 'oui' || text === '1'
  // A choice typed by its label, « À faire », is stored by its key.
  if (field.kind === 'select') return storedOf(text, field)
  return text
}

export interface Deps {
  readonly targets: TargetPolicy
  /** Opens a Slack connection's sealed address (chapter 19 §1). */
  readonly instanceKey: () => string
  /** Whether the operator configured a mail transport: without one, an e-mail step fails. */
  readonly mailAvailable?: boolean
  /**
   * The AI provider's transport, handed in by the process that runs the worker — the API.
   * Without it, an AI step fails (`AI_NOT_CONFIGURED`) and says why.
   */
  readonly aiTransport?: ProviderTransport
  /**
   * Where files go: a document step adds its PDF to a file field, an e-mail step leaves its
   * attachments for the mail loop. Without it, both fail and say why.
   */
  readonly files?: FileDeps
}

/** A PDF a document step made, for an e-mail after it to attach. */
interface Made {
  readonly name: string
  readonly bytes: Uint8Array
}

/** A run under way: who acts, what it holds so far, what it has done. */
interface Run extends Citable {
  /** The run's identifier: what a queued mail is traced to. */
  readonly runId: string
  readonly pools: Pools
  readonly deps: Deps
  readonly ctx: RequestContext
  readonly automation: Automation
  readonly fieldsOf: (tableId: string) => ReadonlyMap<string, ProjectedField>
  readonly rows: Map<string, Held>
  readonly data: Map<string, unknown>
  readonly log: RunStep[]
  /** How deep in a chain of automations started by automations. */
  readonly depth: number
  /** The PDFs made so far, by step. */
  readonly files: Map<string, Made>
}

function hold(run: Run, key: string, table: string, row: Row | null): void {
  run.rows.set(key, { table, fields: run.fieldsOf(table), row })
}

/** A row read again with the owner's rights — and a filter it must satisfy, if any. */
async function readRow(run: Run, table: string, id: unknown, filter = ''): Promise<Row | null> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const page = await listRecords(run.pools, run.ctx, {
    tableId: table,
    filter: `_id eq "${id}"${filter === '' ? '' : ` and (${filter})`}`,
    limit: 1,
  })
  return page.rows[0] ?? null
}

/**
 * Where a run stops before its end: a step failed — its code, its identifier —, or it
 * waits, until when and after which step.
 */
type Halt =
  | { readonly failed: string; readonly step: string }
  | { readonly wait: Date; readonly step: string }

/** What a waiting run keeps, to go on where it stopped (chapter 17 §2.3). */
interface Kept {
  /** The flow as it was when the run started: an edit meanwhile does not move it. */
  readonly actions: readonly AutomationStep[]
  /** The step it waits after. */
  readonly after: string
  /** The rows held, by their identifier: read again, as they are then, on going on. */
  readonly rows: Readonly<Record<string, { readonly table: string; readonly id: string | null }>>
  readonly data: Readonly<Record<string, unknown>>
  readonly log: readonly RunStep[]
}

type Outcome =
  | {
      readonly status: 'succeeded' | 'failed' | 'skipped'
      readonly reason: string | null
      readonly errorCode: string | null
      readonly steps: RunStep[]
    }
  | {
      readonly status: 'waiting'
      readonly resumeAt: Date
      readonly state: Kept
      readonly steps: RunStep[]
    }
  /** Nothing to keep: « entre dans un filtre », for a row that did not enter it. */
  | { readonly status: 'discarded' }

const done = (
  status: 'succeeded' | 'failed' | 'skipped',
  reason: string | null,
  errorCode: string | null = null,
  steps: RunStep[] = [],
): Outcome => ({ status, reason, errorCode, steps })

/** A deleted row as a run cites it: the fields the owner reads, as they were. */
function deletedRow(run: Run, table: string, before: unknown): Row | null {
  if (before === null || typeof before !== 'object') return null
  const raw = before as Record<string, unknown>
  const fields = run.fieldsOf(table)
  const row: Record<string, unknown> = { _id: raw._id }
  for (const [name, field] of fields) {
    const value = raw[name]
    // A relation reads by its row; nothing names it any more.
    row[name] =
      field.kind === 'link' && typeof value === 'string'
        ? { id: value, display: null }
        : field.kind === 'multi_link' && Array.isArray(value)
          ? value.map((id) => ({ id, display: null }))
          : (value ?? null)
  }
  return row
}

async function runOne(pools: Pools, deps: Deps, claimed: Claimed): Promise<Outcome> {
  const found = await pools.withConnection('catalog', async (exec) => {
    const automation = await loadAutomation(exec, claimed.automation_id)
    if (automation === null) return null
    const [owner] = await exec.query<{ ref: string; active: boolean }>(
      `SELECT t.ref, (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS active
         FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
        WHERE u.id = $1`,
      [automation.owner.id],
    )
    return { automation, owner }
  })
  if (found === null) return done('skipped', 'supprimee')
  const { automation, owner } = found
  if (!automation.enabled) return done('skipped', 'desactivee')
  if (owner === undefined || !owner.active) return done('skipped', 'proprietaire_inactif')
  const ctx = actorOf(owner.ref, automation)

  // What the owner reads of the base: the fields a message may cite, their choices.
  const base = await projectBase(pools, ctx, automation.baseId)
  const fieldsOf = (tableId: string) =>
    new Map((base.tables.find((t) => t.id === tableId)?.fields ?? []).map((f) => [f.name, f]))

  // The names of the people a row names, for `{{champ}}` of a person field.
  const people = await pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ id: string; name: string }>(
      `SELECT u.id::text, coalesce(nullif(u.display_name, ''), u.email) AS name
         FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id WHERE t.ref = $1`,
      [owner.ref],
    )
    return new Map(rows.map((r) => [r.id, r.name]))
  })

  const run: Run = {
    runId: claimed.id,
    pools,
    deps,
    ctx,
    automation,
    fieldsOf,
    rows: new Map(),
    data: new Map(),
    people,
    now: new Date(),
    log: [],
    depth: claimed.depth,
    files: new Map(),
  }

  // Going on after a wait: the flow as it was, the rows as they are now.
  if (claimed.state !== null) return goOn(run, claimed, claimed.state)

  const table = automation.trigger.table
  if (claimed.trigger_kind === 'webhook') {
    // What the caller sent, cited `{{trigger.client.nom}}`.
    run.data.set(TRIGGER_ROW, claimed.payload ?? {})
  } else if (claimed.trigger_kind === 'record_deleted' && table !== null) {
    // A deleted row has no values left to read a row rule against: an owner under one is
    // told of no deletion, as the deletion journal tells them none (chapter 05 §16).
    const visible = await pools.withConnection('catalog', async (exec) => {
      const target = await loadTarget(exec, ctx, table)
      const read = target === null ? null : decide(ctx, await loadGrants(exec, ctx), 'read', target)
      return read?.verdict === 'ALLOWED' ? read.rowPredicate === 'TRUE' : null
    })
    if (visible === null) return done('skipped', 'ligne_introuvable')
    if (!visible) return done('skipped', 'regle_de_lignes')
    const row = deletedRow(run, table, claimed.payload)
    if (row === null) return done('skipped', 'ligne_introuvable')
    hold(run, TRIGGER_ROW, table, row)
  } else if (table !== null && claimed.record_id !== null) {
    const condition = automation.condition === null ? '' : renderFilter(automation.condition, run)
    const row = await readRow(run, table, claimed.record_id, condition)
    if (claimed.trigger_kind === 'record_matches') {
      const entered = await matched(pools, automation.id, claimed.record_id, row !== null)
      if (!entered) return { status: 'discarded' }
      // Only what enters counts against the hourly budget: every other change of the table
      // was looked at and dropped.
      if ((await usedThisHour(pools, automation.id)) > RUNS_PER_HOUR)
        return done('skipped', 'debit')
    }
    if (row === null) {
      return done(
        'skipped',
        automation.condition === null ? 'ligne_introuvable' : 'condition_fausse',
      )
    }
    hold(run, TRIGGER_ROW, table, row)
  }

  return outcomeOf(run, await runSteps(run, automation.actions), automation.actions)
}

/**
 * Whether a row enters the filter of « entre dans un filtre » now: in it and not before.
 * The set of rows in it is kept in the catalog; a row that leaves it is taken out, so that
 * coming back is entering again.
 */
async function matched(
  pools: Pools,
  automationId: string,
  recordId: string,
  inside: boolean,
): Promise<boolean> {
  return pools.withConnection('catalog', async (exec) => {
    if (!inside) {
      await exec.query(
        'DELETE FROM _basedb.automation_match WHERE automation_id = $1 AND record_id = $2',
        [automationId, recordId],
        'delete',
      )
      return false
    }
    const rows = await exec.query(
      `INSERT INTO _basedb.automation_match (automation_id, record_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING record_id`,
      [automationId, recordId],
      'insert',
    )
    return rows.length > 0
  })
}

async function usedThisHour(pools: Pools, automationId: string): Promise<number> {
  const [used] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM _basedb.automation_run
        WHERE automation_id = $1 AND queued_at > pg_catalog.clock_timestamp() - interval '1 hour'
          AND reason IS DISTINCT FROM 'debit'`,
      [automationId],
    ),
  )
  return used?.n ?? 0
}

/** How a run ends — or waits: then, what it keeps to go on. */
function outcomeOf(run: Run, halt: Halt | null, actions: readonly AutomationStep[]): Outcome {
  if (halt === null) return done('succeeded', null, null, run.log)
  if ('failed' in halt) return done('failed', null, halt.failed, run.log)
  const rows: Record<string, { table: string; id: string | null }> = {}
  for (const [key, held] of run.rows) {
    const id = held.row?._id
    rows[key] = { table: held.table, id: typeof id === 'string' ? id : null }
  }
  return {
    status: 'waiting',
    resumeAt: halt.wait,
    state: {
      actions,
      after: halt.step,
      rows,
      data: Object.fromEntries(run.data),
      log: run.log,
    },
    steps: run.log,
  }
}

/**
 * A run that waited goes on: what it held read again with the owner's rights — a row
 * deleted meanwhile is held as none —, then the steps after the one it waited at.
 */
async function goOn(run: Run, claimed: Claimed, kept: Kept): Promise<Outcome> {
  for (const [key, value] of Object.entries(kept.data)) run.data.set(key, value)
  run.log.push(...kept.log)
  for (const [key, { table, id }] of Object.entries(kept.rows)) {
    if (key === TRIGGER_ROW && claimed.trigger_kind === 'record_deleted') {
      hold(run, key, table, deletedRow(run, table, claimed.payload))
      continue
    }
    hold(run, key, table, id === null ? null : await readRow(run, table, id))
  }
  const halt = await resumeFrom(run, kept.actions, kept.after)
  return outcomeOf(run, halt === 'absent' ? null : halt, kept.actions)
}

/**
 * The steps after `target`, wherever it stands: down the path of a branch that holds it,
 * then on after the branch.
 */
async function resumeFrom(
  run: Run,
  steps: readonly AutomationStep[],
  target: string,
): Promise<Halt | null | 'absent'> {
  for (const [index, step] of steps.entries()) {
    if (step.id === target) return runSteps(run, steps.slice(index + 1))
    if (step.kind !== 'branch' && step.kind !== 'attempt') continue
    for (const path of step.paths) {
      if (!stepsOf(path.steps).some((s) => s.id === target)) continue
      const halt = await resumeFrom(run, path.steps, target)
      if (halt !== null && halt !== 'absent') return halt
      return runSteps(run, steps.slice(index + 1))
    }
  }
  return 'absent'
}

/** A step that failed, as the run keeps it: its code, and the reason the kernel gave. */
function failure(step: AutomationStep, error: unknown, started: number): RunStep {
  const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
  const detail =
    error instanceof BasedbError && typeof error.details.reason === 'string'
      ? error.details.reason
      : undefined
  return {
    step: step.id,
    kind: step.kind,
    status: 'failed',
    error_code: code,
    ...(detail ? { detail } : {}),
    ms: Date.now() - started,
  }
}

const RANK = { skipped: 0, succeeded: 1, failed: 2 } as const

/**
 * Keeps what a step did. Inside a loop, a step kept on an earlier turn is kept once: its
 * turns counted, its time added up, the worst of how they went and what that one said —
 * the people notified, the mails queued, summed.
 */
function logStep(run: Run, entry: RunStep, repeat: boolean): void {
  const index = repeat ? run.log.findIndex((e) => e.step === entry.step) : -1
  const before = run.log[index]
  const path = entry.path === undefined || entry.path === null ? [] : [entry.path]
  if (before === undefined) {
    run.log.push(
      repeat
        ? {
            ...entry,
            times: 1,
            ...(entry.kind === 'branch' || entry.kind === 'attempt' ? { taken: path } : {}),
          }
        : entry,
    )
    return
  }
  const worse = RANK[entry.status] >= RANK[before.status]
  const counted =
    (entry.kind === 'notify' || entry.kind === 'email') &&
    entry.status === 'succeeded' &&
    before.status === 'succeeded'
  const container = entry.kind === 'branch' || entry.kind === 'attempt'
  run.log[index] = {
    ...(worse ? entry : before),
    ...(counted ? { detail: String(Number(before.detail ?? 0) + Number(entry.detail ?? 0)) } : {}),
    // A branch says the last path a turn took, not that the last turn took none.
    ...(container && (entry.path ?? null) === null && (before.path ?? null) !== null
      ? { path: before.path, detail: before.detail }
      : {}),
    ...(container ? { taken: [...new Set([...(before.taken ?? []), ...path])] } : {}),
    ms: before.ms + entry.ms,
    times: (before.times ?? 1) + 1,
  }
}

/**
 * Runs steps in order, a branch down the path it takes, a loop once per row, an attempt
 * down its second way if its first fails; the first step that fails stops the whole run —
 * what came before stays done. A wait stops it too, to go on later. `repeat`: these steps
 * are a loop's, run again at each turn.
 */
async function runSteps(
  run: Run,
  steps: readonly AutomationStep[],
  repeat = false,
): Promise<Halt | null> {
  for (const step of steps) {
    const started = Date.now()
    if (step.kind === 'for_each') {
      const halt = await runLoop(run, step)
      if (halt !== null) return halt
      continue
    }
    if (step.kind === 'attempt') {
      const halt = await runAttempt(run, step, repeat)
      if (halt !== null) return halt
      continue
    }
    try {
      if (step.kind === 'branch') {
        const taken = await pathOf(run, step.paths)
        logStep(
          run,
          {
            step: step.id,
            kind: step.kind,
            status: 'succeeded',
            path: taken?.id ?? null,
            detail: taken?.label ?? 'aucun_chemin',
            ms: Date.now() - started,
          },
          repeat,
        )
        const halt = taken === null ? null : await runSteps(run, taken.steps, repeat)
        if (halt !== null) return halt
        continue
      }
      if (step.kind === 'wait') {
        const until = await waitUntil(run, step)
        const now = Date.now()
        logStep(
          run,
          {
            step: step.id,
            kind: step.kind,
            status: 'succeeded',
            detail: until === null ? 'aucune_date' : until.toISOString(),
            ms: Date.now() - started,
          },
          repeat,
        )
        // A date already past, or none to wait for: the run goes on at once.
        if (until === null || until.getTime() <= now + 1000) continue
        return { wait: until, step: step.id }
      }
      const result = await perform(run, step)
      logStep(run, { step: step.id, kind: step.kind, ...result, ms: Date.now() - started }, repeat)
    } catch (error) {
      const failed = failure(step, error, started)
      logStep(run, failed, repeat)
      return { failed: failed.error_code ?? 'INTERNAL_ERROR', step: step.id }
    }
  }
  return null
}

/** The units a wait counts in, in milliseconds. */
const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const

/**
 * When a wait ends: after its duration, or at the date a field holds — moved by days, at a
 * time of day for a date alone. `null`: the row or its date is missing; the run goes on.
 */
async function waitUntil(
  run: Run,
  step: Extract<AutomationStep, { kind: 'wait' }>,
): Promise<Date | null> {
  if (step.duration !== null) {
    return new Date(Date.now() + step.duration.amount * UNIT_MS[step.duration.unit])
  }
  const until = step.until
  if (until === null) return null
  const held = run.rows.get(until.record)
  const value = held?.row?.[until.field]
  return momentOf(value, held?.fields.get(until.field)?.kind ?? '', until)
}

/** The instant a date or date-and-time value comes due, moved by days, at a time of day. */
export function momentOf(
  value: unknown,
  kind: string,
  when: { readonly offsetDays: number; readonly at: string; readonly timezone: string },
): Date | null {
  if (typeof value !== 'string' || value === '') return null
  if (kind === 'datetime') {
    const t = Date.parse(value)
    return Number.isNaN(t) ? null : new Date(t + when.offsetDays * UNIT_MS.days)
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m === null) return null
  const [hh, mm] = when.at.split(':').map(Number) as [number, number]
  return new Date(
    utcOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + when.offsetDays, hh, mm, when.timezone),
  )
}

/**
 * An attempt (chapter 17 §1.5): its first way runs; if a step of it fails, the run goes on
 * down the second, which cites what failed — `{{e4.erreur}}`, `{{e4.etape}}` —, then on
 * after the block. A failure of the second way stops the run, as anywhere.
 */
async function runAttempt(
  run: Run,
  step: Extract<AutomationStep, { kind: 'attempt' }>,
  repeat: boolean,
): Promise<Halt | null> {
  const started = Date.now()
  const [tried, fallback] = step.paths as [BranchPath, BranchPath]
  const at = repeat
    ? -1
    : run.log.push({ step: step.id, kind: step.kind, status: 'succeeded', ms: 0 }) - 1
  const halt = await runSteps(run, tried.steps, repeat)
  const failed = halt !== null && 'failed' in halt ? halt : null
  run.data.set(step.id, { erreur: failed?.failed ?? '', etape: failed?.step ?? '' })
  const entry: RunStep = {
    step: step.id,
    kind: step.kind,
    status: 'succeeded',
    path: failed === null ? tried.id : fallback.id,
    detail: failed === null ? tried.label : fallback.label,
    ms: Date.now() - started,
  }
  if (at >= 0) run.log[at] = entry
  else logStep(run, entry, repeat)
  if (halt !== null && failed === null) return halt
  return failed === null ? null : runSteps(run, fallback.steps, repeat)
}

/**
 * A loop (chapter 17 §1.3): the rows its filter finds, in its order, up to its limit —
 * read once, with the owner's rights —, its steps run once for each, citing the row of the
 * turn by the loop's identifier. A failure stops the run — or, when the loop says so, only
 * that turn; so does a run that has used up its time. After it, the loop gives how many
 * rows it went through.
 */
async function runLoop(
  run: Run,
  step: Extract<AutomationStep, { kind: 'for_each' }>,
): Promise<Halt | null> {
  const started = Date.now()
  // Kept first, so that the run reads in the order of the flow; told how it went at the end.
  const at = run.log.push({ step: step.id, kind: step.kind, status: 'succeeded', ms: 0 }) - 1
  let page: Awaited<ReturnType<typeof listRecords>>
  try {
    page = await listRecords(run.pools, run.ctx, {
      tableId: step.table,
      ...(step.filter === '' ? {} : { filter: renderFilter(step.filter, run) }),
      ...(step.sort === null ? {} : { sort: step.sort }),
      limit: step.limit,
    })
  } catch (error) {
    run.log[at] = failure(step, error, started)
    return { failed: run.log[at]?.error_code ?? 'INTERNAL_ERROR', step: step.id }
  }
  const inner = stepsOf(step.steps).map((s) => s.id)
  const forget = () => {
    for (const id of inner) {
      run.rows.delete(id)
      run.data.delete(id)
    }
  }
  let turns = 0
  let failures = 0
  let halt: Halt | null = null
  let outOfTime = false
  for (const row of page.rows) {
    if (deadlineExceeded(run.ctx, new Date())) {
      outOfTime = true
      halt = { failed: 'DEADLINE_EXCEEDED', step: step.id }
      break
    }
    // Each turn starts clean: nothing a turn before found is cited by mistake.
    forget()
    hold(run, step.id, step.table, row)
    const turn = await runSteps(run, step.steps, true)
    if (turn !== null && 'failed' in turn && step.onError === 'continue') {
      failures++
      continue
    }
    if (turn !== null) {
      halt = turn
      break
    }
    turns++
  }
  forget()
  run.rows.delete(step.id)
  run.data.set(step.id, { nombre: turns, echecs: failures })
  run.log[at] = {
    step: step.id,
    kind: step.kind,
    status: outOfTime ? 'failed' : 'succeeded',
    ...(outOfTime ? { error_code: 'DEADLINE_EXCEEDED' } : {}),
    detail: failures > 0 ? `${turns}/${failures}` : String(turns),
    ...(page.hasNextPage ? { more: true } : {}),
    ms: Date.now() - started,
  }
  return halt
}

/** Text compared the way a person reads it: without accents, without case. */
const folded = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** A number when the text reads as one, a comma for the decimal point included. */
function numberOf(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** Whether a value test holds: numbers as numbers, dates in order, text as read. */
export function holds(value: string, op: ValueOperator, operand: string): boolean {
  if (op === 'empty') return value.trim() === ''
  if (op === 'not_empty') return value.trim() !== ''
  const a = numberOf(value)
  const b = numberOf(operand)
  const compared =
    a !== null && b !== null
      ? Math.sign(a - b)
      : folded(value) < folded(operand)
        ? -1
        : folded(value) > folded(operand)
          ? 1
          : 0
  switch (op) {
    case 'eq':
      return compared === 0
    case 'ne':
      return compared !== 0
    case 'contains':
      return folded(value).includes(folded(operand))
    case 'not_contains':
      return !folded(value).includes(folded(operand))
    case 'gt':
      return compared > 0
    case 'gte':
      return compared >= 0
    case 'lt':
      return compared < 0
    case 'lte':
      return compared <= 0
  }
}

/** The first path whose test holds — a row and its filter, or a value —; else the last. */
async function pathOf(run: Run, paths: readonly BranchPath[]): Promise<BranchPath | null> {
  for (const path of paths) {
    if (path.when === null) return path
    if (isValueTest(path.when)) {
      if (holds(render(path.when.value, run), path.when.op, render(path.when.operand, run)))
        return path
      continue
    }
    const held = run.rows.get(path.when.record)
    if (held?.row === null || held?.row === undefined) continue
    if (path.when.condition === '') return path
    const filter = renderFilter(path.when.condition, run)
    if ((await readRow(run, held.table, held.row._id, filter)) !== null) return path
  }
  return null
}

const valuesFor = (
  values: Readonly<Record<string, unknown>>,
  fields: ReadonlyMap<string, ProjectedField>,
  run: Run,
) =>
  Object.fromEntries(
    Object.entries(values).map(([name, raw]) => [name, valueFor(raw, fields.get(name), run)]),
  )

/** A webhook's answer, read up to 64 KiB: JSON when it is, text otherwise. */
async function answerOf(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (reader === undefined) return null
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < ANSWER_BYTES) {
    const { done: ended, value } = await reader.read()
    if (ended) break
    chunks.push(value)
    size += value.byteLength
  }
  await reader.cancel().catch(() => undefined)
  const text = new TextDecoder().decode(Buffer.concat(chunks).subarray(0, ANSWER_BYTES))
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * A secret header, opened for the host it was given for. Sealed for another base, another
 * host — its address changed around it — or not opening at all: the step fails, and the
 * secret is sent nowhere.
 */
function openSecret(
  run: Run,
  header: Extract<WebhookHeader, { sealed: string }>,
  url: URL,
): string {
  const opened = unseal(run.deps.instanceKey(), WEBHOOK_SECRET, header.sealed)
  let secret: { base?: unknown; host?: unknown; value?: unknown } | null = null
  try {
    secret = opened === null ? null : JSON.parse(opened)
  } catch {
    secret = null
  }
  if (secret === null || secret.base !== run.automation.baseId || typeof secret.value !== 'string')
    throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: 'secret_illisible' } })
  if (secret.host !== url.host.toLowerCase())
    throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: 'secret_autre_hote' } })
  return secret.value
}

/** What a webhook step sends, and as what: its own body composed, or the automation's JSON. */
function bodyOf(
  run: Run,
  step: Extract<AutomationStep, { kind: 'webhook' }>,
): { readonly text: string; readonly type: string } {
  if (step.body === null) {
    const held = step.record === null ? undefined : run.rows.get(step.record)
    // What the steps before found or wrote travels too, by their identifiers.
    const steps = Object.fromEntries([
      ...[...run.rows].filter(([k]) => k !== TRIGGER_ROW).map(([k, h]) => [k, h.row]),
      ...run.data,
    ])
    return {
      text: JSON.stringify({
        automation: { id: run.automation.id, label: run.automation.label },
        trigger: run.automation.trigger.kind,
        record: held?.row ?? null,
        steps,
        at: new Date().toISOString(),
      }),
      type: 'application/json',
    }
  }
  switch (step.format) {
    case 'json': {
      const text = renderJson(step.body, run)
      try {
        JSON.parse(text)
      } catch {
        throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', {
          details: { reason: 'corps_json_invalide' },
        })
      }
      return { text, type: 'application/json' }
    }
    case 'form':
      return { text: renderForm(step.body, run), type: 'application/x-www-form-urlencoded' }
    case 'text':
      return { text: render(step.body, run), type: 'text/plain; charset=utf-8' }
  }
}

/** The waits between a webhook's tries: 2, 5, then 10 seconds. */
const RETRY_MS = [2_000, 5_000, 10_000] as const

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** An HTML text with what it cites written in, each value escaped: it adds words, never tags. */
export function renderHtml(template: string, scope: Citable): string {
  const escaped = (text: string) =>
    text.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    )
  return template.replace(CITATION, (_, path: string) => {
    const { value, field } = resolve(path.split('.'), scope)
    return escaped(textOf(value, field, scope.people))
  })
}

/** A file kept for a mail: its key in the storage, and whether the mail owns it. */
interface Attached {
  readonly key: string
  readonly name: string
  readonly type: string
  readonly size: number
  /** Made for this mail — a PDF —, removed with it; a field's file is only borrowed. */
  readonly owned: boolean
}

/** A PDF rendered for a row with the owner's rights, and the name it is given. */
async function documentFor(
  run: Run,
  step: Extract<AutomationStep, { kind: 'document' }>,
): Promise<{ readonly held: Held; readonly row: Row; readonly made: Made }> {
  const held = run.rows.get(step.record)
  const row = held?.row ?? null
  if (held === undefined || row === null)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { reason: 'aucune_ligne' } })
  const rendered = await renderDocument(run.pools, run.ctx, {
    tableId: held.table,
    recordId: String(row._id),
    templateId: step.template,
  })
  // What a file name may not hold, on any system the PDF ends up on, becomes a space.
  const named = render(step.name, run)
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const name = named === '' ? rendered.filename : /\.pdf$/i.test(named) ? named : `${named}.pdf`
  return { held, row, made: { name: name.slice(0, 200), bytes: rendered.bytes } }
}

/** The files an e-mail step attaches, left in the storage for the mail loop to send. */
async function attachmentsOf(
  run: Run,
  step: Extract<AutomationStep, { kind: 'email' }>,
): Promise<Attached[]> {
  if (step.attachments.length === 0) return []
  const files = run.deps.files
  if (files === undefined)
    throw new BasedbError('SERVICE_UNAVAILABLE', { details: { reason: 'stockage_absent' } })
  const out: Attached[] = []
  for (const attachment of step.attachments) {
    if ('step' in attachment) {
      let made = run.files.get(attachment.step)
      // Not in memory any more — the run waited since —: made again, as it would be now.
      if (made === undefined) {
        const source = stepsOf(run.automation.actions).find((s) => s.id === attachment.step)
        if (source?.kind !== 'document')
          throw new BasedbError('RESOURCE_NOT_FOUND', { details: { reason: 'document_perdu' } })
        made = (await documentFor(run, source)).made
      }
      // A key as the storage keeps any file; the mail knows it owns this one.
      const key = `${run.automation.baseId}/${randomUUID()}`
      await files.storage.put(key, made.bytes, 'application/pdf')
      out.push({
        key,
        name: made.name,
        type: 'application/pdf',
        size: made.bytes.length,
        owned: true,
      })
      continue
    }
    const held = run.rows.get(attachment.record)
    const value = held?.row?.[attachment.field]
    // A field the owner does not read attaches nothing, as it cites nothing.
    if (held === undefined || !held.fields.has(attachment.field) || !Array.isArray(value)) continue
    const ids = value
      .map((v) => (typeof v === 'string' ? v : (v as { id?: unknown })?.id))
      .filter((id): id is string => typeof id === 'string')
    if (ids.length === 0) continue
    const stored = await run.pools.withConnection('catalog', (exec) =>
      exec.query<{ storage_key: string; name: string; mime_type: string; size_bytes: string }>(
        `SELECT storage_key, name, mime_type, size_bytes::text FROM _basedb.stored_file
          WHERE id = ANY($1::uuid[]) AND base_id = $2`,
        [ids, run.automation.baseId],
      ),
    )
    for (const f of stored) {
      out.push({
        key: f.storage_key,
        name: f.name,
        type: f.mime_type,
        size: Number(f.size_bytes),
        owned: false,
      })
    }
  }
  const total = out.reduce((sum, a) => sum + a.size, 0)
  if (total > MAX_ATTACHED_BYTES) {
    for (const a of out) if (a.owned) await files.storage.delete(a.key).catch(() => undefined)
    throw new BasedbError('BODY_TOO_LARGE', {
      details: { reason: 'pieces_jointes_trop_lourdes', size: total, maximum: MAX_ATTACHED_BYTES },
    })
  }
  return out
}

async function perform(
  run: Run,
  step: Exclude<AutomationStep, { kind: 'branch' | 'for_each' | 'attempt' | 'wait' }>,
): Promise<{ status: 'succeeded' | 'skipped'; detail?: string }> {
  const { pools, ctx, automation } = run
  switch (step.kind) {
    case 'update_record': {
      const held = run.rows.get(step.record)
      // A search that found nothing: the step has nothing to do, the run goes on.
      if (held?.row === null || held?.row === undefined)
        return { status: 'skipped', detail: 'aucune_ligne' }
      const values = valuesFor(step.values, held.fields, run)
      const id = String(held.row._id)
      await updateRecord(pools, ctx, { tableId: held.table, recordId: id, values })
      // What comes next reads the row as this step left it.
      const row = await readRow(run, held.table, id)
      hold(run, step.record, held.table, row)
      hold(run, step.id, held.table, row)
      return { status: 'succeeded', detail: Object.keys(values).join(', ') }
    }
    case 'create_record': {
      const values = valuesFor(step.values, run.fieldsOf(step.table), run)
      const created = await createRecord(pools, ctx, { tableId: step.table, values })
      const id = String(created.row._id ?? '')
      hold(run, step.id, step.table, await readRow(run, step.table, id))
      return { status: 'succeeded', detail: id }
    }
    case 'delete_record': {
      const held = run.rows.get(step.record)
      if (held?.row === null || held?.row === undefined)
        return { status: 'skipped', detail: 'aucune_ligne' }
      const id = String(held.row._id)
      // Deleted as any row is — to the trash, with its history; still cited as it was.
      await deleteRecord(pools, ctx, { tableId: held.table, recordId: id })
      return { status: 'succeeded', detail: id }
    }
    case 'find_record': {
      const page = await listRecords(pools, ctx, {
        tableId: step.table,
        ...(step.filter === '' ? {} : { filter: renderFilter(step.filter, run) }),
        ...(step.sort === null ? {} : { sort: step.sort }),
        limit: 1,
      })
      const row = page.rows[0] ?? null
      hold(run, step.id, step.table, row)
      return { status: 'succeeded', detail: row === null ? 'aucune' : String(row._id) }
    }
    case 'aggregate': {
      const result = await aggregateRecords(pools, ctx, {
        tableId: step.table,
        ...(step.filter === '' ? {} : { filter: renderFilter(step.filter, run) }),
        aggregates: step.measures.map((m) => ({ field: m.field, fn: m.fn })),
      })
      // `{{e3.nombre}}`, `{{e3.somme.montant}}`: numbers as numbers.
      const out: Record<string, unknown> = { nombre: result.total }
      for (const m of step.measures) {
        const raw = result.values[`${m.field}:${m.fn}`] ?? null
        // PostgreSQL gives a numeric as text, `250.0000000000`: a number here. A date stays.
        const n = typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw
        const name = MEASURE_NAMES[m.fn]
        out[name] = {
          ...((out[name] as Record<string, unknown>) ?? {}),
          [m.field]: typeof n === 'number' && !Number.isFinite(n) ? raw : n,
        }
      }
      run.data.set(step.id, out)
      return { status: 'succeeded', detail: String(result.total) }
    }
    case 'run_automation': {
      if (run.depth + 1 >= MAX_CHAIN) {
        throw new BasedbError('REQUEST_INVALID', {
          details: { reason: 'chaine_trop_longue', maximum: MAX_CHAIN },
        })
      }
      const target = await pools.withConnection('catalog', (exec) =>
        loadAutomation(exec, step.automation),
      )
      if (target === null || target.baseId !== automation.baseId)
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { reason: 'automation_inconnue' } })
      if (!target.enabled)
        throw new BasedbError('AUTOMATION_DISABLED', { details: { automation: target.id } })
      const held = step.record === null ? undefined : run.rows.get(step.record)
      const recordId = held?.row?._id ?? null
      if (target.trigger.table !== null) {
        if (held === undefined || recordId === null)
          return { status: 'skipped', detail: 'aucune_ligne' }
        if (held.table !== target.trigger.table) {
          throw new BasedbError('REQUEST_INVALID', { details: { reason: 'table_differente' } })
        }
      }
      if ((await usedThisHour(pools, target.id)) >= RUNS_PER_HOUR) {
        throw new BasedbError('RATE_LIMIT_EXCEEDED', { details: { reason: 'debit' } })
      }
      const [queued] = await pools.withConnection('catalog', (exec) =>
        exec.query<{ id: string }>(
          `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id, depth)
           VALUES ($1, 'automation', $2, $3) RETURNING id::text`,
          [target.id, target.trigger.table === null ? null : recordId, run.depth + 1],
          'insert',
        ),
      )
      return { status: 'succeeded', detail: queued?.id }
    }
    case 'document': {
      const { held, row, made } = await documentFor(run, step)
      run.files.set(step.id, made)
      run.data.set(step.id, { nom: made.name })
      if (step.field === null) return { status: 'succeeded', detail: made.name }
      const files = run.deps.files
      if (files === undefined)
        throw new BasedbError('SERVICE_UNAVAILABLE', { details: { reason: 'stockage_absent' } })
      // Deposited for the field, then added to what it already holds.
      const uploaded = await uploadFile(files, ctx, {
        tableId: held.table,
        field: step.field,
        name: made.name,
        type: 'application/pdf',
        bytes: made.bytes,
      })
      const before = Array.isArray(row[step.field]) ? (row[step.field] as unknown[]) : []
      const id = String(row._id)
      await updateRecord(pools, ctx, {
        tableId: held.table,
        recordId: id,
        values: { [step.field]: [...before, uploaded.id] },
      })
      const fresh = await readRow(run, held.table, id)
      hold(run, step.record, held.table, fresh)
      return { status: 'succeeded', detail: made.name }
    }
    case 'notify': {
      const held = step.record === null ? undefined : run.rows.get(step.record)
      const row = held?.row ?? null
      // A notification opens a row: with none — a schedule, a search that found nothing —
      // there is nothing to point at.
      if (held === undefined || row === null) return { status: 'skipped', detail: 'aucune_ligne' }
      const recipients = new Set(step.users)
      if (step.userField !== null) {
        const person = row[step.userField]
        if (typeof person === 'string' && person !== '') recipients.add(person)
      }
      const message = render(step.message, run).slice(0, 200)
      const notified = await pools.withConnection('catalog', async (exec) => {
        let count = 0
        await exec.query('BEGIN')
        try {
          for (const user of recipients) {
            if (
              !(await canReadTable(exec, contextOf(ctx.tenantId, user, ctx.requestId), held.table))
            )
              continue
            // Refused in the person's settings (chapter 16 §2.3): not counted as notified.
            if (!(await wantsNotification(exec, user, 'automation'))) continue
            await exec.query(
              `INSERT INTO _basedb.notification
                 (tenant_id, user_id, kind, actor_id, base_id, table_id, record_id, excerpt)
               SELECT b.tenant_id, $1, 'automation', $2, b.id, $3, $4, $5
                 FROM _basedb.base b WHERE b.id = $6`,
              [user, automation.owner.id, held.table, String(row._id), message, automation.baseId],
              'insert',
            )
            await emitLive(exec, { kind: 'notifications', user })
            count++
          }
          await exec.query('COMMIT')
        } catch (error) {
          await exec.query('ROLLBACK').catch(() => undefined)
          throw error
        }
        return count
      })
      return { status: 'succeeded', detail: `${notified}` }
    }
    case 'ai': {
      const transport = run.deps.aiTransport
      if (transport === undefined) {
        throw new BasedbError('AI_NOT_CONFIGURED', { details: { reason: 'transport_absent' } })
      }
      // The provider the owner's tenant uses, and the hourly ceiling of background work,
      // shared with the AI cells.
      const config = await withTransaction(
        pools,
        'catalog',
        ctx,
        async (exec) => {
          const found = await resolveProvider(exec, ctx)
          await assertQuota(exec, ctx, 'field_compute')
          return found
        },
        { readOnly: true },
      )
      const options = step.options.map((label) => ({ value: label, label }))
      const text = await computeStepValue(pools, ctx, transport, config, {
        baseId: automation.baseId,
        automationLabel: automation.label,
        instruction: renderPrompt(step.prompt, run),
        format: expectedFormat(step.answer, options),
      })
      const read = parseAnswer(step.answer, text, options)
      if (read === null) {
        throw new BasedbError('AI_RESPONSE_UNUSABLE', {
          details: { reason: 'type_attendu', kind: step.answer },
        })
      }
      // What the steps after cite, `{{e3.reponse}}`: a number as a number, a yes-or-no as
      // a boolean, a choice by its label. The answer itself is not kept in the run (§2.1).
      const answer = step.answer === 'number' ? Number(read) : read
      run.data.set(step.id, { reponse: answer })
      return { status: 'succeeded', detail: `${[...text].length}` }
    }
    case 'email':
      return mail(run, step)
    case 'slack': {
      const url = await pools.withConnection('catalog', (exec) =>
        slackUrlOf(exec, run.deps.instanceKey(), {
          baseId: automation.baseId,
          id: step.integration,
        }),
      )
      if (url === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { reason: 'connexion_supprimee' } })
      }
      const status = await postToSlack(url, render(step.message, run))
      return { status: 'succeeded', detail: `${status}` }
    }
    case 'webhook':
      return webhook(run, step)
  }
}

/**
 * An e-mail (chapter 17 §1.3): queued, not sent — the mail loop hands it to the operator's
 * relay, and retries. One per recipient, or one to all together with a copy; in plain
 * text, or in the app's rich text with a text version; with the files it attaches.
 */
async function mail(
  run: Run,
  step: Extract<AutomationStep, { kind: 'email' }>,
): Promise<{ status: 'succeeded' | 'skipped'; detail?: string }> {
  const { pools, ctx, automation } = run
  if (run.deps.mailAvailable !== true) {
    throw new BasedbError('MAIL_NOT_CONFIGURED', { details: { reason: 'transport_absent' } })
  }
  const held = step.record === null ? undefined : run.rows.get(step.record)
  const row = held?.row ?? null
  const people = new Set(step.users)
  if (step.userField !== null && row !== null) {
    const person = row[step.userField]
    if (typeof person === 'string' && person !== '') people.add(person)
  }
  /** By address, lower-cased: one mail per mailbox, whoever named it. */
  const recipients = new Map<string, { address: string; user: string | null }>()
  const add = (address: string, user: string | null) => {
    const key = address.toLowerCase()
    // A person of the tenant keeps their account; otherwise the first spelling stays.
    if (!recipients.has(key) || user !== null) recipients.set(key, { address, user })
  }
  for (const address of step.addresses) add(address, null)
  if (step.emailField !== null && row !== null) {
    const written = row[step.emailField]
    if (typeof written === 'string' && isAddress(written.trim())) add(written.trim(), null)
  }
  const subject =
    render(step.subject, run).replace(/\s+/g, ' ').trim().slice(0, 300) || automation.label
  const html = step.format === 'html' ? renderHtml(step.message, run).slice(0, 200_000) : null
  const body = (html === null ? render(step.message, run) : richTextToPlain(html)).slice(0, 20_000)
  const answerTo = step.replyTo === null ? null : render(step.replyTo, run).trim()
  if (answerTo !== null && answerTo !== '' && !isAddress(answerTo)) {
    throw new BasedbError('REQUEST_INVALID', { details: { reason: 'reponse_a_invalide' } })
  }
  const queued = await pools.withConnection('catalog', async (exec) => {
    const [owner] = await exec.query<{ email: string }>(
      'SELECT email FROM _basedb.app_user WHERE id = $1',
      [automation.owner.id],
    )
    // A person of the tenant, by their sign-in address — if they may read what the mail
    // is about, as for a notification.
    if (people.size > 0) {
      const found = await exec.query<{ id: string; email: string }>(
        `SELECT id::text, email FROM _basedb.app_user
          WHERE id = ANY($1::uuid[]) AND disabled_at IS NULL AND deleted_at IS NULL`,
        [[...people]],
      )
      for (const person of found) {
        if (
          held !== undefined &&
          !(await canReadTable(exec, contextOf(ctx.tenantId, person.id, ctx.requestId), held.table))
        )
          continue
        add(person.email, person.id)
      }
    }
    return { owner, list: [...recipients.values()] }
  })
  if (queued.list.length === 0) return { status: 'skipped', detail: 'aucun_destinataire' }
  // Left in the storage for the mail loop; a PDF made for it goes with it.
  const attached = await attachmentsOf(run, step)
  const replyTo = answerTo === null || answerTo === '' ? (queued.owner?.email ?? null) : answerTo
  // Together: one mail, the first recipient its row, the others beside it.
  const mails =
    step.mode === 'together'
      ? [{ first: queued.list[0] as (typeof queued.list)[number], also: queued.list.slice(1) }]
      : queued.list.map((first) => ({ first, also: [] as typeof queued.list }))
  await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    try {
      for (const [index, m] of mails.entries()) {
        await exec.query(
          `INSERT INTO _basedb.mail_outbox
             (tenant_id, origin, automation_id, run_id, user_id, recipient, reply_to,
              subject, body_text, body_html, also_to, cc, attachments)
           SELECT b.tenant_id, 'automation', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
             FROM _basedb.base b WHERE b.id = $12`,
          [
            automation.id,
            run.runId,
            m.first.user,
            m.first.address,
            replyTo,
            subject,
            body,
            html,
            m.also.length === 0 ? null : m.also.map((r) => r.address),
            step.cc.length === 0 ? null : step.cc,
            // A PDF made for the mail is owned by the first of them, borrowed by the others.
            attached.length === 0
              ? null
              : JSON.stringify(attached.map((a) => ({ ...a, owned: a.owned && index === 0 }))),
            automation.baseId,
          ],
          'insert',
        )
      }
      await exec.query('COMMIT')
    } catch (error) {
      await exec.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
  return { status: 'succeeded', detail: `${queued.list.length}` }
}

/**
 * A webhook (chapter 17 §1.3): the address with what it cites, each value encoded — and
 * its host checked again, as at every run: a name that resolved publicly yesterday may
 * point inside today. Tried again after a network error, a 429 or a 5xx, as many times as
 * the step says, within the run's time.
 */
async function webhook(
  run: Run,
  step: Extract<AutomationStep, { kind: 'webhook' }>,
): Promise<{ status: 'succeeded'; detail: string }> {
  const url = await checkTarget(renderUrl(step.url, run), run.deps.targets)
  const headers: Record<string, string> = {
    'user-agent': 'basedb-automation/1',
    'x-basedb-automation': run.automation.id,
  }
  let body: string | undefined
  if (hasBody(step.method)) {
    const composed = bodyOf(run, step)
    body = composed.text
    headers['content-type'] = composed.type
  }
  // The step's own headers last: a Content-Type it names is the one sent.
  for (const header of step.headers) {
    headers[header.name.toLowerCase()] =
      'sealed' in header
        ? openSecret(run, header, url)
        : render(header.value, run).replace(/[\r\n]+/g, ' ')
  }
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null
    try {
      response = await fetch(url, {
        method: step.method,
        ...(body === undefined ? {} : { body }),
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      })
    } catch {
      response = null
    }
    const status = response?.status ?? 0
    const again = response === null || status === 429 || status >= 500
    const wait = RETRY_MS[attempt] ?? RETRY_MS[RETRY_MS.length - 1]
    if (
      again &&
      attempt < step.retries &&
      !deadlineExceeded(run.ctx, new Date(Date.now() + wait + WEBHOOK_TIMEOUT_MS))
    ) {
      await response?.body?.cancel().catch(() => undefined)
      await pause(wait)
      continue
    }
    if (response === null) {
      throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: 'injoignable' } })
    }
    if (status < 200 || status >= 300) {
      await response.body?.cancel().catch(() => undefined)
      throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: `http_${status}` } })
    }
    // The answer, for the steps after: `{{e3.statut}}`, `{{e3.reponse.numero}}`.
    const answer = await answerOf(response).catch(() => null)
    run.data.set(step.id, { statut: status, reponse: answer })
    return { status: 'succeeded', detail: `${status}` }
  }
}

/** One pass of the worker: the schedules and dates due, then a batch of the queue. */
export async function runAutomations(pools: Pools, deps: Deps): Promise<number> {
  await queueDue(pools)
  await queueDates(pools)
  // Queued runs, and waiting ones whose time has come — then running, no longer waiting.
  const claimed = await pools.withConnection('catalog', (exec) =>
    exec.query<Claimed>(
      `UPDATE _basedb.automation_run
          SET status = 'running', resume_at = NULL,
              started_at = coalesce(started_at, pg_catalog.clock_timestamp())
        WHERE id IN (SELECT id FROM _basedb.automation_run
                      WHERE status = 'queued'
                         OR (status = 'waiting' AND resume_at <= pg_catalog.clock_timestamp())
                      ORDER BY coalesce(resume_at, queued_at) LIMIT $1 FOR UPDATE SKIP LOCKED)
        RETURNING id::text, automation_id::text, trigger_kind, record_id::text, payload, depth,
                  state`,
      [BATCH],
      'update',
    ),
  )
  for (const run of claimed) {
    let outcome: Outcome
    try {
      outcome = await runOne(pools, deps, run)
    } catch (error) {
      const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
      outcome = done('failed', null, code)
    }
    await pools.withConnection('catalog', (exec) => {
      if (outcome.status === 'discarded')
        return exec.query('DELETE FROM _basedb.automation_run WHERE id = $1', [run.id], 'delete')
      if (outcome.status === 'waiting') {
        return exec.query(
          `UPDATE _basedb.automation_run
              SET status = 'waiting', resume_at = $2, state = $3::jsonb, steps = $4::jsonb
            WHERE id = $1`,
          [
            run.id,
            outcome.resumeAt.toISOString(),
            JSON.stringify(outcome.state),
            JSON.stringify(outcome.steps),
          ],
          'update',
        )
      }
      return exec.query(
        `UPDATE _basedb.automation_run
            SET status = $2, reason = $3, error_code = $4, steps = $5::jsonb, state = NULL,
                finished_at = pg_catalog.clock_timestamp()
          WHERE id = $1`,
        [run.id, outcome.status, outcome.reason, outcome.errorCode, JSON.stringify(outcome.steps)],
        'update',
      )
    })
  }
  return claimed.length
}

/** The worker, as a background loop: a pass every `intervalMs`, never two at once. */
export function startAutomationWorker(
  pools: Pools,
  deps: Deps,
  intervalMs: number,
  onError: (error: unknown) => void,
): () => void {
  let running = false
  const timer = setInterval(() => {
    if (running) return
    running = true
    runAutomations(pools, deps)
      .catch(onError)
      .finally(() => {
        running = false
      })
  }, intervalMs)
  return () => clearInterval(timer)
}

/**
 * Queues a run for one row — a button clicked (reading the row is enough), or a test from
 * the screen (building the base is required). The row must be readable by whoever asks.
 */
export async function requestRun(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly automationId: string; readonly recordId: string | null },
): Promise<{ readonly runId: string }> {
  const automation = await pools.withConnection('catalog', (exec) =>
    loadAutomation(exec, request.automationId),
  )
  if (automation === null) {
    throw new BasedbError('AUTOMATION_DISABLED', { details: { automation: request.automationId } })
  }
  const table = automation.trigger.table
  const byButton = automation.trigger.kind === 'button'
  if (!byButton) {
    await pools.withConnection('catalog', (exec) =>
      requireOnBase(exec, ctx, 'manage_schema', automation.baseId),
    )
  }
  if (!automation.enabled) {
    throw new BasedbError('AUTOMATION_DISABLED', { details: { automation: automation.id } })
  }
  if (table !== null) {
    if (request.recordId === null || !/^[0-9a-f-]{36}$/i.test(request.recordId)) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'record', reason: 'ligne_requise' },
      })
    }
    const page = await listRecords(pools, ctx, {
      tableId: table,
      filter: `_id eq "${request.recordId.toLowerCase()}"`,
      limit: 1,
    })
    if (page.rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: request.recordId } })
    }
  }
  const [run] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id)
       VALUES ($1, $2, $3) RETURNING id::text`,
      [automation.id, byButton ? 'button' : 'test', table === null ? null : request.recordId],
      'insert',
    ),
  )
  return { runId: (run as { id: string }).id }
}

/** What an incoming webhook may carry: as much as a webhook's answer is read. */
export const HOOK_BYTES = 65_536

/**
 * A call to an automation's own address (chapter 17 §1.1): its secret finds it — an
 * unknown one and a switched-off automation read the same —, what it sent is kept for the
 * steps to cite, and a run is queued, within the hourly budget.
 */
export async function receiveHook(
  pools: Pools,
  request: { readonly secret: string; readonly payload: unknown },
): Promise<{ readonly runId: string }> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(request.secret)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { reason: 'adresse_inconnue' } })
  }
  const hash = createHash('sha256').update(request.secret).digest()
  const [automation] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      `SELECT id::text FROM _basedb.automation
        WHERE hook_hash = $1 AND trigger_kind = 'webhook' AND deleted_at IS NULL AND is_enabled`,
      [hash],
    ),
  )
  if (automation === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { reason: 'adresse_inconnue' } })
  }
  if ((await usedThisHour(pools, automation.id)) >= RUNS_PER_HOUR) {
    throw new BasedbError('RATE_LIMIT_EXCEEDED', { details: { reason: 'debit' } })
  }
  const [run] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, payload)
       VALUES ($1, 'webhook', $2::jsonb) RETURNING id::text`,
      [automation.id, JSON.stringify(request.payload ?? {})],
      'insert',
    ),
  )
  return { runId: (run as { id: string }).id }
}
