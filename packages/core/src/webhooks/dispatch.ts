import { createHmac, randomInt } from 'node:crypto'
import { qualify, quoteIdentifier } from '@basedb/naming'
import { unseal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { type HistoryTable, loadHistoryTables } from '../history/catalog.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { executorOf } from '../runtime/pool.js'
import { WEBHOOK_SECRET_PURPOSE } from './manage.js'
import { type TargetPolicy, checkTarget } from './target.js'

/**
 * Sending — chapter 08 §10.2 to §10.7.
 *
 * The drain turns each outgoing event into one delivery per matching subscription; this
 * module sends them. A delivery carries no body: the body is rebuilt from `change_event` at
 * the moment of sending, links named as they are THEN (§10.2). Order is guaranteed per
 * (webhook, table, row) — never globally, or one slow consumer would stall a tenant — and
 * held even across retries by the `NOT EXISTS` guard of §10.6: the next event of a row
 * waits while an earlier one is still pending.
 */

/** Deliveries sent per pass, and events per HTTP call (§10.4). */
const DISPATCH_BATCH = 50

/** §10.7: 10 s, 30 s, 2 min, 10 min, 1 h, 6 h, 24 h, 24 h — then `failed`. */
const BACKOFF_SECONDS = [10, 30, 120, 600, 3_600, 21_600, 86_400, 86_400] as const

/** Consecutive failures after which a webhook is switched off (§10.7). */
const FAILURES_BEFORE_DISABLE = 50

/** §10.8: connection plus response, in all. */
const REQUEST_TIMEOUT_MS = 10_000

const TYPE: Readonly<Record<string, string>> = {
  insert: 'record.created',
  update: 'record.updated',
  delete: 'record.deleted',
}

/**
 * One delivery per (event, active subscription of its table and operation), in the same
 * transaction that moved the events: an event is never drained without its deliveries.
 */
export async function scheduleDeliveries(
  exec: Executor,
  events: ReadonlyArray<{
    readonly id: string
    readonly occurred_at: string
    readonly base_id: string
    readonly table_id: string
    readonly record_id: string
    readonly op: string
  }>,
): Promise<void> {
  if (events.length === 0) return
  await exec.query(
    `INSERT INTO _basedb.webhook_delivery
       (webhook_id, subscription_id, base_id, event_id, event_occurred_at, role_id,
        partition_key, status)
     SELECT w.id, s.id, e.base_id, e.id, e.occurred_at, w.role_id,
            w.id::text || ':' || e.table_id::text || ':' || e.record_id::text, 'pending'
       FROM unnest($1::uuid[], $2::timestamptz[], $3::uuid[], $4::uuid[], $5::uuid[], $6::text[])
              AS e(id, occurred_at, base_id, table_id, record_id, op)
       JOIN _basedb.webhook_subscription s
         ON s.table_id = e.table_id
        AND s.event = CASE e.op WHEN 'insert' THEN 'create' WHEN 'update' THEN 'update' ELSE 'delete' END
       JOIN _basedb.webhook w ON w.id = s.webhook_id AND w.is_active AND w.deleted_at IS NULL`,
    [
      events.map((e) => e.id),
      events.map((e) => e.occurred_at),
      events.map((e) => e.base_id),
      events.map((e) => e.table_id),
      events.map((e) => e.record_id),
      events.map((e) => e.op),
    ],
    'insert',
  )
}

type Due = {
  readonly id: string
  readonly created_at: string
  readonly webhook_id: string
  readonly event_id: string
  readonly event_occurred_at: string
  readonly attempts: number
}

type EventRow = {
  readonly id: string
  readonly occurred_at: string
  readonly base_id: string
  readonly table_id: string
  readonly record_id: string
  readonly op: string
  readonly is_cascade: boolean
  readonly actor_kind: string
  readonly before: Record<string, unknown> | null
  readonly after: Record<string, unknown> | null
}

/** Takes the deliveries that may go now, strictly in order per row (§10.6). */
async function takeDue(exec: Executor): Promise<Due[]> {
  // A delivery left `in_flight` by a sender that stopped mid-call goes back to the queue
  // once its lease is over: otherwise it would hold its row's queue forever.
  await exec.query(
    `UPDATE _basedb.webhook_delivery SET status = 'pending'
      WHERE status = 'in_flight' AND next_attempt_at < clock_timestamp()`,
    [],
    'update',
  )
  // DISTINCT ON cannot be locked: the candidates are chosen first, then locked one by one
  // with SKIP LOCKED — a second sender gets the others.
  const candidates = await exec.query<{ id: string }>(
    `SELECT DISTINCT ON (d.partition_key) d.id::text
       FROM _basedb.webhook_delivery d
      WHERE d.status = 'pending'
        AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= clock_timestamp())
        AND NOT EXISTS (
              SELECT 1 FROM _basedb.webhook_delivery p
               WHERE p.partition_key = d.partition_key
                 AND p.status IN ('pending', 'in_flight')
                 AND (p.created_at, p.id) < (d.created_at, d.id))
      ORDER BY d.partition_key, d.created_at, d.id
      LIMIT $1`,
    [DISPATCH_BATCH],
  )
  if (candidates.length === 0) return []
  const locked = await exec.query<Due>(
    `SELECT id::text, created_at::text, webhook_id::text, event_id::text,
            event_occurred_at::text, attempts
       FROM _basedb.webhook_delivery
      WHERE id = ANY($1::uuid[]) AND status = 'pending'
      ORDER BY created_at, id
      FOR UPDATE SKIP LOCKED`,
    [candidates.map((c) => c.id)],
  )
  if (locked.length > 0) {
    await exec.query(
      `UPDATE _basedb.webhook_delivery
          SET status = 'in_flight', attempts = attempts + 1,
              next_attempt_at = clock_timestamp() + interval '2 minutes'
        WHERE id = ANY($1::uuid[])`,
      [locked.map((d) => d.id)],
      'update',
    )
  }
  return locked
}

/** A row of the capture as the consumer reads it (§10.2): numbers as decimal strings, links named. */
function presentRow(
  row: Record<string, unknown> | null,
  table: HistoryTable | undefined,
  displays: ReadonlyMap<string, string | null>,
): Record<string, unknown> | null {
  if (row === null) return null
  const out: Record<string, unknown> = { ...row }
  for (const field of table?.fields ?? []) {
    if (!(field.column in out)) continue
    const value = out[field.column]
    if (field.kind === 'number' && typeof value === 'number') {
      out[field.column] = String(value)
    } else if (field.target !== undefined) {
      out[field.column] =
        typeof value === 'string'
          ? { id: value, display: displays.get(`${field.target.tableId}:${value}`) ?? null }
          : null
    }
  }
  return out
}

/** The names of the rows the links of a batch point to, as they are now (§10.2). */
async function linkDisplays(
  exec: Executor,
  events: readonly EventRow[],
  tables: ReadonlyMap<string, HistoryTable>,
): Promise<Map<string, string | null>> {
  const wanted = new Map<
    string,
    { schema: string; table: string; column: string; ids: Set<string> }
  >()
  for (const e of events) {
    for (const field of tables.get(e.table_id)?.fields ?? []) {
      const target = field.target
      if (target === undefined || target.displayColumn === null) continue
      const entry = wanted.get(target.tableId) ?? {
        schema: target.schema,
        table: target.table,
        column: target.displayColumn,
        ids: new Set<string>(),
      }
      for (const row of [e.before, e.after]) {
        const v = row?.[field.column]
        if (typeof v === 'string') entry.ids.add(v)
      }
      wanted.set(target.tableId, entry)
    }
  }
  const out = new Map<string, string | null>()
  for (const [tableId, w] of wanted) {
    if (w.ids.size === 0) continue
    const rows = await exec.query<{ id: string; display: string | null }>(
      `SELECT "_id"::text AS id, ${quoteIdentifier(w.column)}::text AS display
         FROM ${qualify(w.schema, w.table)} WHERE "_id" = ANY($1::uuid[])`,
      [[...w.ids]],
    )
    for (const r of rows) out.set(`${tableId}:${r.id}`, r.display)
  }
  return out
}

/** The payload of a batch of events, and the tenant and base names it speaks of. */
async function payloadOf(
  exec: Executor,
  eventIds: readonly Due[],
): Promise<Record<string, unknown>[]> {
  const events = await exec.query<EventRow>(
    `SELECT id::text, occurred_at::text, base_id::text, table_id::text, record_id::text, op,
            is_cascade, actor_kind, before, after
       FROM _basedb.change_event
      WHERE (id, occurred_at) IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
      ORDER BY occurred_at, id`,
    [eventIds.map((d) => d.event_id), eventIds.map((d) => d.event_occurred_at)],
  )
  const tables = await loadHistoryTables(exec, [...new Set(events.map((e) => e.table_id))])
  const names = await exec.query<{ id: string; tenant: string; base: string }>(
    `SELECT b.id::text, t.ref AS tenant, sn.name AS base
       FROM _basedb.base b
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE b.id = ANY($1::uuid[])`,
    [[...new Set(events.map((e) => e.base_id))]],
  )
  const displays = await linkDisplays(exec, events, tables)

  return events.map((e) => {
    const table = tables.get(e.table_id)
    const base = names.find((n) => n.id === e.base_id)
    const before = presentRow(e.before, table, displays)
    const after = presentRow(e.after, table, displays)
    const changed =
      e.op === 'update' && e.before !== null && e.after !== null
        ? (table?.fields ?? [])
            .filter(
              (f) =>
                JSON.stringify(e.before?.[f.column] ?? null) !==
                JSON.stringify(e.after?.[f.column] ?? null),
            )
            .map((f) => f.column)
        : []
    return {
      id: e.id,
      type: TYPE[e.op] ?? e.op,
      occurred_at: new Date(e.occurred_at).toISOString(),
      tenant: base?.tenant ?? null,
      base: base?.base ?? null,
      table: table?.table ?? null,
      record_id: e.record_id,
      actor: { kind: e.actor_kind },
      cause: { kind: e.is_cascade ? 'cascade' : 'direct' },
      before,
      after,
      changed,
    }
  })
}

/** `t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>." + body)>` — §10.5. */
export function signature(secret: string, timestamp: number, body: string): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${v1}`
}

/** When to try again: the §10.7 ladder, ±20 %, and never sooner than `Retry-After`. */
function nextAttempt(attempts: number, retryAfter: string | null): Date {
  const base = BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)] ?? 86_400
  const jitter = 1 + randomInt(-200, 201) / 1000
  let seconds = base * jitter
  const asked = retryAfter === null ? Number.NaN : Number(retryAfter)
  if (Number.isFinite(asked) && asked > seconds) seconds = asked
  return new Date(Date.now() + seconds * 1000)
}

interface Outcome {
  readonly delivered: boolean
  readonly retryable: boolean
  readonly responseCode: number | null
  readonly errorCode: string | null
  readonly retryAfter: string | null
}

/** One HTTP call: no redirect followed, a bounded wait, the answer's body ignored. */
async function send(url: string, body: string, headers: Record<string, string>): Promise<Outcome> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'user-agent': 'basedb-webhook/1', ...headers },
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    await response.body?.cancel().catch(() => undefined)
    const code = response.status
    if (code >= 200 && code < 300) {
      return {
        delivered: true,
        retryable: false,
        responseCode: code,
        errorCode: null,
        retryAfter: null,
      }
    }
    const retryable = code >= 500 || code === 408 || code === 429
    return {
      delivered: false,
      retryable,
      responseCode: code,
      errorCode: retryable ? 'WEBHOOK_TEMPORARY_FAILURE' : 'WEBHOOK_PERMANENT_FAILURE',
      retryAfter: response.headers.get('retry-after'),
    }
  } catch {
    // No network detail is kept: it is what would turn a webhook into a scanner (§10.8).
    return {
      delivered: false,
      retryable: true,
      responseCode: null,
      errorCode: 'WEBHOOK_TEMPORARY_FAILURE',
      retryAfter: null,
    }
  }
}

/**
 * One pass of the sender: takes what is due, sends it grouped by webhook, records the
 * outcome. Returns the deliveries handled.
 */
export async function dispatchWebhooks(
  pools: Pools,
  instanceKey: string,
  policy: TargetPolicy,
): Promise<number> {
  // 1. Take the due deliveries, in a short transaction of their own: the HTTP calls must
  //    not hold a transaction open for the ten seconds a slow consumer may take.
  const client = await pools.acquire('catalog')
  const exec = executorOf(client)
  let due: Due[]
  try {
    await exec.query('BEGIN')
    due = await takeDue(exec)
    await exec.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    client.release()
    throw error
  }

  try {
    if (due.length === 0) return 0
    const byHook = new Map<string, Due[]>()
    for (const d of due) byHook.set(d.webhook_id, [...(byHook.get(d.webhook_id) ?? []), d])

    for (const [webhookId, deliveries] of byHook) {
      const [hook] = await exec.query<{
        target_url: string
        secret: string
        is_active: boolean
        deleted: boolean
      }>(
        `SELECT target_url, convert_from(signing_secret_encrypted, 'UTF8') AS secret, is_active,
                deleted_at IS NOT NULL AS deleted
           FROM _basedb.webhook WHERE id = $1`,
        [webhookId],
      )
      const ids = deliveries.map((d) => d.id)
      if (hook === undefined || !hook.is_active || hook.deleted) {
        await exec.query(
          `UPDATE _basedb.webhook_delivery SET status = 'abandoned' WHERE id = ANY($1::uuid[])`,
          [ids],
          'update',
        )
        continue
      }

      const secret = unseal(instanceKey, WEBHOOK_SECRET_PURPOSE, hook.secret)
      let outcome: Outcome
      if (secret === null) {
        // A secret the instance key cannot open: nothing can be signed, nothing is sent.
        outcome = {
          delivered: false,
          retryable: false,
          responseCode: null,
          errorCode: 'WEBHOOK_PERMANENT_FAILURE',
          retryAfter: null,
        }
      } else {
        try {
          await checkTarget(hook.target_url, policy)
          const body = JSON.stringify({ events: await payloadOf(exec, deliveries) })
          const timestamp = Math.floor(Date.now() / 1000)
          outcome = await send(hook.target_url, body, {
            'x-basedb-signature': signature(secret, timestamp, body),
            'x-basedb-delivery-id': deliveries[0]?.id ?? '',
            'x-basedb-webhook-id': webhookId,
          })
        } catch (error) {
          // The address filter refused the target — revalidated at every attempt (§10.8).
          const refused = error instanceof BasedbError
          outcome = {
            delivered: false,
            retryable: !refused,
            responseCode: null,
            errorCode: refused ? 'WEBHOOK_TARGET_REJECTED' : 'WEBHOOK_TEMPORARY_FAILURE',
            retryAfter: null,
          }
        }
      }

      for (const d of deliveries) {
        const exhausted = d.attempts + 1 >= BACKOFF_SECONDS.length
        const status = outcome.delivered
          ? 'delivered'
          : outcome.retryable && !exhausted
            ? 'pending'
            : 'failed'
        await exec.query(
          `UPDATE _basedb.webhook_delivery
              SET status = $2, response_code = $3, error_code = $4,
                  delivered_at = CASE WHEN $2 = 'delivered' THEN clock_timestamp() END,
                  next_attempt_at = $5
            WHERE id = $1`,
          [
            d.id,
            status,
            outcome.responseCode,
            outcome.errorCode,
            status === 'pending' ? nextAttempt(d.attempts + 1, outcome.retryAfter) : null,
          ],
          'update',
        )
      }

      if (!outcome.delivered) {
        // 50 failures in a row, nothing delivered in between: the webhook is switched off
        // (§10.7), and says so on its screen.
        const [recent] = await exec.query<{ failures: number }>(
          `SELECT count(*)::int AS failures FROM (
             SELECT status FROM _basedb.webhook_delivery
              WHERE webhook_id = $1 AND status IN ('delivered', 'failed')
              ORDER BY created_at DESC LIMIT $2) last
            WHERE status = 'failed'`,
          [webhookId, FAILURES_BEFORE_DISABLE],
        )
        if ((recent?.failures ?? 0) >= FAILURES_BEFORE_DISABLE) {
          await exec.query(
            `UPDATE _basedb.webhook SET is_active = false, disabled_reason = 'failures',
                    updated_at = clock_timestamp()
              WHERE id = $1`,
            [webhookId],
            'update',
          )
        }
      }
    }
    return due.length
  } finally {
    client.release()
  }
}

/** The sender as a background loop: a pass every `intervalMs`, never two at once. */
export function startDispatchLoop(
  pools: Pools,
  instanceKey: () => string,
  policy: TargetPolicy,
  intervalMs: number,
  onError: (error: unknown) => void,
): () => void {
  let running = false
  let stopped = false
  const timer = setInterval(() => {
    if (running || stopped) return
    running = true
    dispatchWebhooks(pools, instanceKey(), policy)
      .catch(onError)
      .finally(() => {
        running = false
      })
  }, intervalMs)
  timer.unref?.()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
