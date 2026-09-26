import { randomBytes } from 'node:crypto'
import { writeAudit } from '../audit/journal.js'
import { requireElevatedSession } from '../auth/elevation.js'
import { seal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type TargetPolicy, checkTarget } from './target.js'

/**
 * Webhooks — chapter 08 §10: a base tells another system, within the second, that a row
 * was created, modified or deleted, with the row before and after.
 *
 * Administered like integration tokens (§11): `manage_tokens` on the base, a session
 * elevated minutes ago, and nothing the creator does not hold. The signing secret is shown
 * once and kept SEALED with the instance key — signing needs it in clear, so a hash would
 * not do (§10.5).
 */

export type WebhookEvent = 'create' | 'update' | 'delete'

export const WEBHOOK_EVENTS: readonly WebhookEvent[] = ['create', 'update', 'delete']

/** The purpose a signing secret is sealed under (domain separation, A25). */
export const WEBHOOK_SECRET_PURPOSE = 'webhook/signing'

export interface WebhookSummary {
  readonly id: string
  readonly baseId: string
  readonly label: string
  readonly url: string
  readonly active: boolean
  /** Why it stopped: `failures`, `field_masked` or `manual`. */
  readonly disabledReason: string | null
  readonly createdAt: string
  readonly subscriptions: ReadonlyArray<{
    readonly tableId: string
    readonly tableName: string
    readonly tableLabel: string
    readonly events: readonly WebhookEvent[]
  }>
  /** The last delivery, to see at a glance whether the other side answers. */
  readonly lastDelivery: {
    readonly status: string
    readonly at: string
    readonly responseCode: number | null
  } | null
}

export interface WebhookDelivery {
  readonly id: string
  readonly createdAt: string
  readonly status: string
  readonly attempts: number
  readonly nextAttemptAt: string | null
  readonly deliveredAt: string | null
  readonly responseCode: number | null
  readonly errorCode: string | null
  readonly tableLabel: string | null
  readonly recordId: string
  readonly op: string
}

/**
 * The change feed of a base's tables follows its subscriptions (07 §11.3): a table nobody
 * listens to writes no event, a table somebody listens to writes every one.
 */
export async function refreshChangeFeed(exec: Executor, baseId: string): Promise<void> {
  await exec.query(
    `INSERT INTO _basedb_local.change_feed_state (table_id, is_active, updated_at)
     SELECT t.id,
            EXISTS (SELECT 1 FROM _basedb.webhook_subscription s
                      JOIN _basedb.webhook w ON w.id = s.webhook_id
                     WHERE s.table_id = t.id AND w.is_active AND w.deleted_at IS NULL),
            clock_timestamp()
       FROM _basedb.table_def t
      WHERE t.base_id = $1
     ON CONFLICT (table_id) DO UPDATE
       SET is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at`,
    [baseId],
    'insert',
  )
}

/**
 * A.19: the payload is never cut down, so the subscriber must see EVERYTHING of each table
 * it subscribes to — every field, and the target of every link. What the creator cannot
 * see, the webhook would not be allowed to carry: refused, naming what is missing.
 */
async function assertFullMask(
  exec: Executor,
  ctx: RequestContext,
  tableIds: readonly string[],
): Promise<void> {
  const grants = await loadGrants(exec, ctx)
  const missing: string[] = []
  for (const tableId of tableIds) {
    const target = await loadTarget(exec, ctx, tableId)
    if (target === null) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
    }
    const read = decide(ctx, grants, 'read', target)
    if (read.verdict !== 'ALLOWED') {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
    }
    for (const fieldId of target.fieldIds ?? []) {
      if (!read.readableFields.has(fieldId)) missing.push(fieldId)
    }
    const links = await exec.query<{ target_table_id: string }>(
      `SELECT l.target_table_id::text FROM _basedb.field_link_config l
         JOIN _basedb.field f ON f.id = l.field_id
        WHERE f.table_id = $1 AND f.is_live`,
      [tableId],
    )
    for (const link of links) {
      const linked = await loadTarget(exec, ctx, link.target_table_id)
      if (linked === null || decide(ctx, grants, 'read', linked).verdict !== 'ALLOWED') {
        missing.push(`table:${link.target_table_id}`)
      }
    }
  }
  if (missing.length > 0) {
    throw new BasedbError('WEBHOOK_MASK_INCOMPLETE', { details: { missing } })
  }
}

async function summaries(
  exec: Executor,
  where: { readonly sql: string; readonly params: readonly unknown[] },
): Promise<WebhookSummary[]> {
  const hooks = await exec.query<{
    id: string
    base_id: string
    label: string
    target_url: string
    is_active: boolean
    disabled_reason: string | null
    created_at: string
  }>(
    `SELECT w.id::text, w.base_id::text, w.label, w.target_url, w.is_active, w.disabled_reason,
            w.created_at::text
       FROM _basedb.webhook w
      WHERE w.deleted_at IS NULL AND ${where.sql}
      ORDER BY w.created_at`,
    where.params,
  )
  if (hooks.length === 0) return []
  const ids = hooks.map((h) => h.id)
  const subs = await exec.query<{
    webhook_id: string
    table_id: string
    table_name: string
    table_label: string
    event: WebhookEvent
  }>(
    `SELECT s.webhook_id::text, s.table_id::text, tn.name AS table_name, t.label AS table_label,
            s.event
       FROM _basedb.webhook_subscription s
       JOIN _basedb.table_def t      ON t.id = s.table_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
      WHERE s.webhook_id = ANY($1::uuid[])
      ORDER BY t.position, s.event`,
    [ids],
  )
  const last = await exec.query<{
    webhook_id: string
    status: string
    at: string
    response_code: number | null
  }>(
    `SELECT DISTINCT ON (d.webhook_id) d.webhook_id::text, d.status,
            coalesce(d.delivered_at, d.created_at)::text AS at, d.response_code
       FROM _basedb.webhook_delivery d
      WHERE d.webhook_id = ANY($1::uuid[])
      ORDER BY d.webhook_id, d.created_at DESC`,
    [ids],
  )
  return hooks.map((h) => {
    const byTable = new Map<
      string,
      { tableId: string; tableName: string; tableLabel: string; events: WebhookEvent[] }
    >()
    for (const s of subs.filter((x) => x.webhook_id === h.id)) {
      const entry = byTable.get(s.table_id) ?? {
        tableId: s.table_id,
        tableName: s.table_name,
        tableLabel: s.table_label,
        events: [],
      }
      entry.events.push(s.event)
      byTable.set(s.table_id, entry)
    }
    const l = last.find((x) => x.webhook_id === h.id)
    return {
      id: h.id,
      baseId: h.base_id,
      label: h.label,
      url: h.target_url,
      active: h.is_active,
      disabledReason: h.disabled_reason,
      createdAt: new Date(h.created_at).toISOString(),
      // In the order of a row's life, whatever order the rows came back in.
      subscriptions: [...byTable.values()].map((s) => ({
        ...s,
        events: WEBHOOK_EVENTS.filter((e) => s.events.includes(e)),
      })),
      lastDelivery:
        l === undefined
          ? null
          : { status: l.status, at: new Date(l.at).toISOString(), responseCode: l.response_code },
    }
  })
}

async function loadWebhook(exec: Executor, ctx: RequestContext, webhookId: string) {
  const [row] = await exec.query<{ id: string; base_id: string; label: string }>(
    `SELECT w.id::text, w.base_id::text, w.label
       FROM _basedb.webhook w
       JOIN _basedb.base b   ON b.id = w.base_id
       JOIN _basedb.tenant t ON t.id = b.tenant_id
      WHERE w.id::text = $1 AND t.ref = $2 AND w.deleted_at IS NULL`,
    [webhookId, ctx.tenantId],
  )
  if (row === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { webhook: webhookId } })
  return row
}

/** A base's webhooks — never a secret. `manage_tokens` on the base. */
export async function listWebhooks(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<WebhookSummary[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_tokens', request.baseId)
      return summaries(exec, { sql: 'w.base_id = $1', params: [request.baseId] })
    },
    { readOnly: true },
  )
}

/** Creates a webhook. The secret is in the result and nowhere else, ever. */
export async function createWebhook(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  policy: TargetPolicy,
  request: {
    readonly baseId: string
    readonly label: string
    readonly url: string
    readonly subscriptions: ReadonlyArray<{
      readonly tableId: string
      readonly events: readonly WebhookEvent[]
    }>
    readonly sessionId: string
  },
): Promise<{ readonly webhook: WebhookSummary; readonly secret: string }> {
  const label = typeof request.label === 'string' ? request.label.normalize('NFC').trim() : ''
  if (label === '') throw new BasedbError('LABEL_EMPTY')
  if ([...label].length > 200)
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: 200 } })
  if (request.subscriptions.length === 0) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'subscriptions' } })
  }
  for (const s of request.subscriptions) {
    if (s.events.length === 0 || s.events.some((e) => !WEBHOOK_EVENTS.includes(e))) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'events' } })
    }
  }
  const url = await checkTarget(request.url, policy)

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_tokens', request.baseId)
    await requireElevatedSession(exec, ctx, request.sessionId)

    const tableIds = [...new Set(request.subscriptions.map((s) => s.tableId))]
    const own = await exec.query<{ id: string }>(
      'SELECT id::text FROM _basedb.table_def WHERE id = ANY($1::uuid[]) AND base_id = $2 AND is_live',
      [tableIds, request.baseId],
    )
    if (own.length !== tableIds.length) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: 'subscriptions' } })
    }
    await assertFullMask(exec, ctx, tableIds)

    // The webhook's own role: `read` on its base, never listed as a group (§10.3).
    const [tenant] = await exec.query<{ id: string }>(
      'SELECT id FROM _basedb.tenant WHERE ref = $1',
      [ctx.tenantId],
    )
    const suffix = randomBytes(4).toString('hex')
    const [role] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, kind, created_by)
       VALUES ($1, $2, lower($2), $3, 'token', $4) RETURNING id`,
      [tenant?.id, `Webhook ${label} ${suffix}`, `webhook_${suffix}`, ctx.actor.id],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
       VALUES ($1, 'base', $2, 'read', $3)`,
      [role?.id, request.baseId, ctx.actor.id],
      'insert',
    )

    const secret = `whsec_${randomBytes(32).toString('base64url')}`
    const sealed = seal(instanceKey, WEBHOOK_SECRET_PURPOSE, secret)
    const [hook] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.webhook
         (base_id, role_id, label, target_url, signing_secret_encrypted, signing_key_version,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, convert_to($5, 'UTF8'), 1, $6, $6) RETURNING id::text`,
      [request.baseId, role?.id, label, url.toString(), sealed, ctx.actor.id],
      'insert',
    )
    for (const s of request.subscriptions) {
      for (const event of new Set(s.events)) {
        await exec.query(
          `INSERT INTO _basedb.webhook_subscription (webhook_id, table_id, event)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [hook?.id, s.tableId, event],
          'insert',
        )
      }
    }
    await refreshChangeFeed(exec, request.baseId)
    await writeAudit(exec, ctx, {
      action: 'webhook.create',
      objectKind: 'webhook',
      objectId: hook?.id ?? null,
      objectName: label,
      payload: { host: url.host, tables: tableIds.length },
    })

    const [webhook] = await summaries(exec, { sql: 'w.id = $1', params: [hook?.id] })
    return { webhook: webhook as WebhookSummary, secret }
  })
}

/**
 * Stops or restarts a webhook. Restarting checks the mask again (§10.3): a field hidden
 * meanwhile would otherwise be carried to the other side.
 */
export async function setWebhookActive(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly webhookId: string; readonly active: boolean; readonly sessionId: string },
): Promise<WebhookSummary> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const hook = await loadWebhook(exec, ctx, request.webhookId)
    await requireOnBase(exec, ctx, 'manage_tokens', hook.base_id)
    await requireElevatedSession(exec, ctx, request.sessionId)
    if (request.active) {
      const tables = await exec.query<{ table_id: string }>(
        'SELECT DISTINCT table_id::text FROM _basedb.webhook_subscription WHERE webhook_id = $1',
        [hook.id],
      )
      await assertFullMask(
        exec,
        ctx,
        tables.map((t) => t.table_id),
      )
    }
    await exec.query(
      `UPDATE _basedb.webhook
          SET is_active = $2, disabled_reason = CASE WHEN $2 THEN NULL ELSE 'manual' END,
              updated_at = clock_timestamp(), updated_by = $3
        WHERE id = $1`,
      [hook.id, request.active, ctx.actor.id],
      'update',
    )
    if (!request.active) {
      // What waited for it will not go: abandoned, and visible as such.
      await exec.query(
        `UPDATE _basedb.webhook_delivery SET status = 'abandoned'
          WHERE webhook_id = $1 AND status IN ('pending', 'in_flight')`,
        [hook.id],
        'update',
      )
    }
    await refreshChangeFeed(exec, hook.base_id)
    await writeAudit(exec, ctx, {
      action: request.active ? 'webhook.activate' : 'webhook.deactivate',
      objectKind: 'webhook',
      objectId: hook.id,
      objectName: hook.label,
    })
    const [summary] = await summaries(exec, { sql: 'w.id = $1', params: [hook.id] })
    return summary as WebhookSummary
  })
}

/** Deletes a webhook: nothing more is sent, and its history of deliveries stays. */
export async function deleteWebhook(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly webhookId: string; readonly sessionId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const hook = await loadWebhook(exec, ctx, request.webhookId)
    await requireOnBase(exec, ctx, 'manage_tokens', hook.base_id)
    await requireElevatedSession(exec, ctx, request.sessionId)
    await exec.query(
      `UPDATE _basedb.webhook
          SET is_active = false, disabled_reason = 'manual', deleted_at = clock_timestamp(),
              deleted_by = $2, updated_at = clock_timestamp(), updated_by = $2
        WHERE id = $1`,
      [hook.id, ctx.actor.id],
      'update',
    )
    await exec.query(
      `UPDATE _basedb.webhook_delivery SET status = 'abandoned'
        WHERE webhook_id = $1 AND status IN ('pending', 'in_flight')`,
      [hook.id],
      'update',
    )
    await refreshChangeFeed(exec, hook.base_id)
    await writeAudit(exec, ctx, {
      action: 'webhook.delete',
      objectKind: 'webhook',
      objectId: hook.id,
      objectName: hook.label,
    })
  })
}

/** The last deliveries of a webhook, newest first (§10.9) — states, never bodies. */
export async function listDeliveries(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly webhookId: string; readonly limit?: number },
): Promise<WebhookDelivery[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const hook = await loadWebhook(exec, ctx, request.webhookId)
      await requireOnBase(exec, ctx, 'manage_tokens', hook.base_id)
      const rows = await exec.query<{
        id: string
        created_at: string
        status: string
        attempts: number
        next_attempt_at: string | null
        delivered_at: string | null
        response_code: number | null
        error_code: string | null
        table_label: string | null
        record_id: string
        op: string
      }>(
        `SELECT d.id::text, d.created_at::text, d.status, d.attempts, d.next_attempt_at::text,
                d.delivered_at::text, d.response_code, d.error_code, t.label AS table_label,
                e.record_id::text, e.op
           FROM _basedb.webhook_delivery d
           JOIN _basedb.change_event e ON e.id = d.event_id AND e.occurred_at = d.event_occurred_at
           LEFT JOIN _basedb.table_def t ON t.id = e.table_id
          WHERE d.webhook_id = $1
          ORDER BY d.created_at DESC
          LIMIT $2`,
        [hook.id, Math.min(Math.max(request.limit ?? 50, 1), 200)],
      )
      const iso = (v: string | null) => (v === null ? null : new Date(v).toISOString())
      return rows.map((r) => ({
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        status: r.status,
        attempts: r.attempts,
        nextAttemptAt: iso(r.next_attempt_at),
        deliveredAt: iso(r.delivered_at),
        responseCode: r.response_code,
        errorCode: r.error_code,
        tableLabel: r.table_label,
        recordId: r.record_id,
        op: r.op,
      }))
    },
    { readOnly: true },
  )
}
