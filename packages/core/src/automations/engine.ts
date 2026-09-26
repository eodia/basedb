import { type ProjectedField, projectBase } from '../catalog/projection.js'
import { canReadTable, contextOf, emitLive } from '../collab/signals.js'
import { BasedbError } from '../errors/index.js'
import { postToSlack, slackUrlOf } from '../integrations/slack.js'
import { requireOnBase } from '../rbac/require.js'
import { createRecord } from '../records/create.js'
import { listRecords } from '../records/list.js'
import { updateRecord } from '../records/update.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext } from '../tx/context.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'
import { type Automation, type AutomationAction, loadAutomation, nextRunOf } from './catalog.js'

/**
 * Running automations — chapter 17 §2. The drain queues the runs a row triggers, the
 * clock those a schedule does, a button its own; a worker in the API process takes them
 * in batches and runs them, action after action, on the owner's authority decided again.
 */

export const RUNS_PER_HOUR = 100
const BATCH = 10
const WEBHOOK_TIMEOUT_MS = 10_000

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

interface Step {
  readonly action: AutomationAction['kind']
  readonly status: 'succeeded' | 'failed'
  readonly detail?: string
  readonly error_code?: string
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
  if (Array.isArray(value))
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** `{{champ}}`, `{{_id}}` and `{{_maintenant}}` replaced by what the row says. */
export function render(
  template: string,
  row: Readonly<Record<string, unknown>> | null,
  fields: ReadonlyMap<string, ProjectedField>,
  people: ReadonlyMap<string, string> = new Map(),
  now: Date = new Date(),
): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, name: string) => {
    if (name === '_maintenant') return now.toISOString()
    if (row === null) return ''
    if (name === '_id') return String(row._id ?? '')
    return textOf(row[name], fields.get(name), people)
  })
}

/** A value to write: a template is rendered, then read as the field's type expects. */
function valueFor(
  raw: unknown,
  field: ProjectedField | undefined,
  row: Readonly<Record<string, unknown>> | null,
  fields: ReadonlyMap<string, ProjectedField>,
  people: ReadonlyMap<string, string>,
): unknown {
  if (typeof raw !== 'string') return raw
  const text = render(raw, row, fields, people)
  if (field === undefined) return text
  if (text === '') return null
  if (field.kind === 'number') {
    const n = Number(text.replace(',', '.'))
    return Number.isFinite(n) ? n : text
  }
  if (field.kind === 'boolean') return text === 'true' || text === 'oui' || text === '1'
  return text
}

interface Deps {
  readonly targets: TargetPolicy
  /** Opens a Slack connection's sealed address (chapter 19 §1). */
  readonly instanceKey: () => string
}

async function runOne(
  pools: Pools,
  deps: Deps,
  claimed: Claimed,
): Promise<{
  status: 'succeeded' | 'failed' | 'skipped'
  reason: string | null
  errorCode: string | null
  steps: Step[]
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
  const fieldsOf = (tableId: string | null) =>
    new Map((base.tables.find((t) => t.id === tableId)?.fields ?? []).map((f) => [f.name, f]))
  const sourceFields = fieldsOf(automation.trigger.table)

  let row: Record<string, unknown> | null = null
  if (automation.trigger.table !== null && claimed.record_id !== null) {
    const condition = automation.condition === null ? '' : ` and (${automation.condition})`
    const page = await listRecords(pools, ctx, {
      tableId: automation.trigger.table,
      filter: `_id eq "${claimed.record_id}"${condition}`,
      limit: 1,
    })
    row = page.rows[0] ?? null
    if (row === null) {
      return {
        status: 'skipped',
        reason: automation.condition === null ? 'ligne_introuvable' : 'condition_fausse',
        errorCode: null,
        steps: [],
      }
    }
  }

  // The names of the people a row names, for `{{champ}}` of a person field.
  const people = await pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ id: string; name: string }>(
      `SELECT u.id::text, coalesce(nullif(u.display_name, ''), u.email) AS name
         FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id WHERE t.ref = $1`,
      [owner.ref],
    )
    return new Map(rows.map((r) => [r.id, r.name]))
  })

  const steps: Step[] = []
  for (const action of automation.actions) {
    try {
      steps.push(
        await perform(pools, deps, ctx, automation, action, row, sourceFields, fieldsOf, people),
      )
    } catch (error) {
      const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
      const detail =
        error instanceof BasedbError && typeof error.details.reason === 'string'
          ? error.details.reason
          : undefined
      steps.push({
        action: action.kind,
        status: 'failed',
        error_code: code,
        ...(detail ? { detail } : {}),
      })
      return { status: 'failed', reason: null, errorCode: code, steps }
    }
  }
  return { status: 'succeeded', reason: null, errorCode: null, steps }
}

async function perform(
  pools: Pools,
  deps: Deps,
  ctx: RequestContext,
  automation: Automation,
  action: AutomationAction,
  row: Record<string, unknown> | null,
  sourceFields: ReadonlyMap<string, ProjectedField>,
  fieldsOf: (tableId: string | null) => Map<string, ProjectedField>,
  people: ReadonlyMap<string, string>,
): Promise<Step> {
  switch (action.kind) {
    case 'update_record': {
      if (row === null || automation.trigger.table === null) {
        throw new BasedbError('REQUEST_INVALID', { details: { reason: 'action_sans_ligne' } })
      }
      const values = Object.fromEntries(
        Object.entries(action.values).map(([name, raw]) => [
          name,
          valueFor(raw, sourceFields.get(name), row, sourceFields, people),
        ]),
      )
      await updateRecord(pools, ctx, {
        tableId: automation.trigger.table,
        recordId: String(row._id),
        values,
      })
      return { action: action.kind, status: 'succeeded', detail: Object.keys(values).join(', ') }
    }
    case 'create_record': {
      const target = fieldsOf(action.table)
      const values = Object.fromEntries(
        Object.entries(action.values).map(([name, raw]) => [
          name,
          valueFor(raw, target.get(name), row, sourceFields, people),
        ]),
      )
      const created = await createRecord(pools, ctx, { tableId: action.table, values })
      return { action: action.kind, status: 'succeeded', detail: String(created.row._id ?? '') }
    }
    case 'notify': {
      const recipients = new Set(action.users)
      if (action.userField !== null && row !== null) {
        const person = row[action.userField]
        if (typeof person === 'string' && person !== '') recipients.add(person)
      }
      const message = render(action.message, row, sourceFields, people).slice(0, 200)
      const notified = await pools.withConnection('catalog', async (exec) => {
        let count = 0
        await exec.query('BEGIN')
        try {
          for (const user of recipients) {
            const table = automation.trigger.table
            if (table === null || row === null) {
              // A schedule names no row: the notification points at none it could open.
              continue
            }
            if (!(await canReadTable(exec, contextOf(ctx.tenantId, user, ctx.requestId), table)))
              continue
            await exec.query(
              `INSERT INTO _basedb.notification
                 (tenant_id, user_id, kind, actor_id, base_id, table_id, record_id, excerpt)
               SELECT b.tenant_id, $1, 'automation', $2, b.id, $3, $4, $5
                 FROM _basedb.base b WHERE b.id = $6`,
              [user, automation.owner.id, table, String(row._id), message, automation.baseId],
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
      return { action: action.kind, status: 'succeeded', detail: `${notified}` }
    }
    case 'slack': {
      const url = await pools.withConnection('catalog', (exec) =>
        slackUrlOf(exec, deps.instanceKey(), { baseId: automation.baseId, id: action.integration }),
      )
      if (url === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { reason: 'connexion_supprimee' } })
      }
      const status = await postToSlack(url, render(action.message, row, sourceFields, people))
      return { action: action.kind, status: 'succeeded', detail: `${status}` }
    }
    case 'webhook': {
      const url = await checkTarget(action.url, deps.targets)
      const body = JSON.stringify({
        automation: { id: automation.id, label: automation.label },
        trigger: automation.trigger.kind,
        record: row,
        at: new Date().toISOString(),
      })
      let status: number
      try {
        const response = await fetch(url, {
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
        await response.body?.cancel().catch(() => undefined)
        status = response.status
      } catch {
        throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: 'injoignable' } })
      }
      if (status < 200 || status >= 300) {
        throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', {
          details: { reason: `http_${status}` },
        })
      }
      return { action: action.kind, status: 'succeeded', detail: `${status}` }
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
