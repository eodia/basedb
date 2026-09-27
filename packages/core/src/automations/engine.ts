import { expectedFormat, parseAnswer } from '../ai/answer.js'
import {
  type ProviderTransport,
  assertQuota,
  computeStepValue,
  resolveProvider,
} from '../ai/draft.js'
import { EMPTY_VALUE, MAX_VALUE_CHARS } from '../ai/prompt.js'
import { type ProjectedField, projectBase } from '../catalog/projection.js'
import { wantsNotification } from '../collab/notifications.js'
import { canReadTable, contextOf, emitLive } from '../collab/signals.js'
import { BasedbError } from '../errors/index.js'
import { postToSlack, slackUrlOf } from '../integrations/slack.js'
import { requireOnBase } from '../rbac/require.js'
import { createRecord } from '../records/create.js'
import { listRecords } from '../records/list.js'
import { updateRecord } from '../records/update.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'
import {
  type Automation,
  type AutomationStep,
  type BranchPath,
  CITATION,
  TRIGGER_ROW,
  loadAutomation,
  nextRunOf,
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
}

/**
 * Queues the runs a drained batch triggers — in the drain's transaction. A write made by
 * an automation triggers none (chapter 17 §1.1); past the hourly budget, one `skipped`
 * run says so instead of thousands.
 */
export async function queueTriggered(exec: Executor, triggers: readonly Trigger[]): Promise<void> {
  const eligible = triggers.filter((t) => t.actorKind !== 'automation' && t.op !== 'delete')
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
        AND trigger_kind IN ('record_created', 'record_updated')`,
    [[...new Set(eligible.map((t) => t.tableId))]],
  )
  for (const automation of automations) {
    const hits = eligible.filter(
      (t) =>
        t.tableId === automation.table_id &&
        (automation.trigger_kind === 'record_created'
          ? t.op === 'insert'
          : t.op === 'update' &&
            ((automation.fields ?? []).length === 0 ||
              t.changed.some((c) => (automation.fields ?? []).includes(c)))),
    )
    if (hits.length === 0) continue
    const [used] = await exec.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM _basedb.automation_run
        WHERE automation_id = $1 AND queued_at > pg_catalog.clock_timestamp() - interval '1 hour'
          AND reason IS DISTINCT FROM 'debit'`,
      [automation.id],
    )
    const room = Math.max(0, RUNS_PER_HOUR - (used?.n ?? 0))
    const queued = hits.slice(0, room)
    if (queued.length > 0) {
      await exec.query(
        `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id)
         SELECT $1, $2, unnest($3::uuid[])`,
        [automation.id, automation.trigger_kind, queued.map((t) => t.recordId)],
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

// ── Running ──────────────────────────────────────────────────────────────────

interface Claimed extends Record<string, unknown> {
  readonly id: string
  readonly automation_id: string
  readonly trigger_kind: string
  readonly record_id: string | null
}

/** What a run keeps of each step it passed: enough to follow it on the flow (§2.1). */
interface RunStep {
  readonly step: string
  readonly kind: AutomationStep['kind']
  readonly status: 'succeeded' | 'failed' | 'skipped'
  /** The path a branch took; `null`: none held. */
  readonly path?: string | null
  readonly detail?: string
  readonly error_code?: string
  /** How long it took, in milliseconds. */
  readonly ms: number
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
    deadline: new Date(now.getTime() + 60_000),
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
  return String(value)
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

const CITATION_AT = /^\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/

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
  /**
   * The AI provider's transport, handed in by the process that runs the worker — the API.
   * Without it, an AI step fails (`AI_NOT_CONFIGURED`) and says why.
   */
  readonly aiTransport?: ProviderTransport
}

/** A run under way: who acts, what it holds so far, what it has done. */
interface Run extends Citable {
  readonly pools: Pools
  readonly deps: Deps
  readonly ctx: RequestContext
  readonly automation: Automation
  readonly fieldsOf: (tableId: string) => ReadonlyMap<string, ProjectedField>
  readonly rows: Map<string, Held>
  readonly data: Map<string, unknown>
  readonly log: RunStep[]
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

async function runOne(
  pools: Pools,
  deps: Deps,
  claimed: Claimed,
): Promise<{
  status: 'succeeded' | 'failed' | 'skipped'
  reason: string | null
  errorCode: string | null
  steps: RunStep[]
}> {
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
  if (found === null) return { status: 'skipped', reason: 'supprimee', errorCode: null, steps: [] }
  const { automation, owner } = found
  if (!automation.enabled)
    return { status: 'skipped', reason: 'desactivee', errorCode: null, steps: [] }
  if (owner === undefined || !owner.active) {
    return { status: 'skipped', reason: 'proprietaire_inactif', errorCode: null, steps: [] }
  }
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
  }

  const table = automation.trigger.table
  if (table !== null && claimed.record_id !== null) {
    const condition = automation.condition === null ? '' : renderFilter(automation.condition, run)
    const row = await readRow(run, table, claimed.record_id, condition)
    if (row === null) {
      return {
        status: 'skipped',
        reason: automation.condition === null ? 'ligne_introuvable' : 'condition_fausse',
        errorCode: null,
        steps: [],
      }
    }
    hold(run, TRIGGER_ROW, table, row)
  }

  const failed = await runSteps(run, automation.actions)
  return failed === null
    ? { status: 'succeeded', reason: null, errorCode: null, steps: run.log }
    : { status: 'failed', reason: null, errorCode: failed, steps: run.log }
}

/**
 * Runs steps in order, a branch down the path it takes; the first step that fails stops
 * the whole run — what came before stays done — and its code is returned.
 */
async function runSteps(run: Run, steps: readonly AutomationStep[]): Promise<string | null> {
  for (const step of steps) {
    const started = Date.now()
    try {
      if (step.kind === 'branch') {
        const taken = await pathOf(run, step.paths)
        run.log.push({
          step: step.id,
          kind: step.kind,
          status: 'succeeded',
          path: taken?.id ?? null,
          detail: taken?.label ?? 'aucun_chemin',
          ms: Date.now() - started,
        })
        const failed = taken === null ? null : await runSteps(run, taken.steps)
        if (failed !== null) return failed
        continue
      }
      const done = await perform(run, step)
      run.log.push({ step: step.id, kind: step.kind, ...done, ms: Date.now() - started })
    } catch (error) {
      const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
      const detail =
        error instanceof BasedbError && typeof error.details.reason === 'string'
          ? error.details.reason
          : undefined
      run.log.push({
        step: step.id,
        kind: step.kind,
        status: 'failed',
        error_code: code,
        ...(detail ? { detail } : {}),
        ms: Date.now() - started,
      })
      return code
    }
  }
  return null
}

/** The first path whose row exists and satisfies its filter; otherwise, the last. */
async function pathOf(run: Run, paths: readonly BranchPath[]): Promise<BranchPath | null> {
  for (const path of paths) {
    if (path.when === null) return path
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
    const { done, value } = await reader.read()
    if (done) break
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

async function perform(
  run: Run,
  step: Exclude<AutomationStep, { kind: 'branch' }>,
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
    case 'webhook': {
      const url = await checkTarget(step.url, run.deps.targets)
      const held = step.record === null ? undefined : run.rows.get(step.record)
      // What the steps before found or wrote travels too, by their identifiers.
      const steps = Object.fromEntries([
        ...[...run.rows].filter(([k]) => k !== TRIGGER_ROW).map(([k, h]) => [k, h.row]),
        ...run.data,
      ])
      const body = JSON.stringify({
        automation: { id: automation.id, label: automation.label },
        trigger: automation.trigger.kind,
        record: held?.row ?? null,
        steps,
        at: new Date().toISOString(),
      })
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          body,
          headers: {
            'content-type': 'application/json',
            'user-agent': 'basedb-automation/1',
            'x-basedb-automation': automation.id,
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        })
      } catch {
        throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: 'injoignable' } })
      }
      const status = response.status
      if (status < 200 || status >= 300) {
        await response.body?.cancel().catch(() => undefined)
        throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', {
          details: { reason: `http_${status}` },
        })
      }
      // The answer, for the steps after: `{{e3.statut}}`, `{{e3.reponse.numero}}`.
      const answer = await answerOf(response).catch(() => null)
      run.data.set(step.id, { statut: status, reponse: answer })
      return { status: 'succeeded', detail: `${status}` }
    }
  }
}

/** One pass of the worker: the schedules due, then a batch of the queue. */
export async function runAutomations(pools: Pools, deps: Deps): Promise<number> {
  await queueDue(pools)
  const claimed = await pools.withConnection('catalog', (exec) =>
    exec.query<Claimed>(
      `UPDATE _basedb.automation_run SET status = 'running', started_at = pg_catalog.clock_timestamp()
        WHERE id IN (SELECT id FROM _basedb.automation_run WHERE status = 'queued'
                      ORDER BY queued_at LIMIT $1 FOR UPDATE SKIP LOCKED)
        RETURNING id::text, automation_id::text, trigger_kind, record_id::text`,
      [BATCH],
      'update',
    ),
  )
  for (const run of claimed) {
    let outcome: Awaited<ReturnType<typeof runOne>>
    try {
      outcome = await runOne(pools, deps, run)
    } catch (error) {
      const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
      outcome = { status: 'failed', reason: null, errorCode: code, steps: [] }
    }
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.automation_run
            SET status = $2, reason = $3, error_code = $4, steps = $5::jsonb,
                finished_at = pg_catalog.clock_timestamp()
          WHERE id = $1`,
        [run.id, outcome.status, outcome.reason, outcome.errorCode, JSON.stringify(outcome.steps)],
        'update',
      ),
    )
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
