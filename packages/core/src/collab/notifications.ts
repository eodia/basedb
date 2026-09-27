import { BasedbError } from '../errors/index.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { canReadTable, emitLive } from './signals.js'

/**
 * The in-app notifications — chapter 16 §2: a mention, a reply in a thread one wrote in,
 * a person field set to oneself. Each names its row; one whose row is no longer readable
 * says so, and opens nothing.
 */

export const NOTIFICATION_RETENTION_DAYS = 90

/** `automation`: an automation's « notify » step (chapter 17), its owner as the actor. */
export type NotificationKind = 'mention' | 'reply' | 'assigned' | 'automation'

/** Every nature of notification (§2.1) — each one a person may refuse (§2.3). */
export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'mention',
  'reply',
  'assigned',
  'automation',
]

/**
 * Whether a person still wants notifications of this nature — asked by every place that
 * writes one (§2.3), BEFORE writing it: a refused notification is never stored, so it
 * never counts as unread and never reaches the stream.
 */
export async function wantsNotification(
  exec: Executor,
  userId: string,
  kind: NotificationKind,
): Promise<boolean> {
  const rows = await exec.query<{ id: string }>(
    `SELECT id FROM _basedb.app_user
      WHERE id = $1 AND NOT ($2 = ANY (muted_notifications))`,
    [userId, kind],
  )
  return rows.length > 0
}

export interface Notification {
  readonly id: string
  readonly kind: NotificationKind
  readonly actor: { readonly id: string; readonly name: string } | null
  readonly base: { readonly name: string; readonly label: string }
  readonly table: { readonly name: string; readonly label: string }
  readonly recordId: string
  readonly commentId: string | null
  readonly excerpt: string
  readonly createdAt: string
  readonly readAt: string | null
  /** Whether the reader may still open the row. */
  readonly readable: boolean
}

export interface NotificationPage {
  readonly notifications: readonly Notification[]
  readonly unread: number
  readonly nextCursor: string | null
}

interface Line extends Record<string, unknown> {
  readonly id: string
  readonly kind: Notification['kind']
  readonly actor_id: string | null
  readonly actor_name: string | null
  readonly base_name: string
  readonly base_label: string
  readonly table_id: string
  readonly table_name: string
  readonly table_label: string
  readonly record_id: string
  readonly comment_id: string | null
  readonly excerpt: string
  readonly created_at: string
  readonly read_at: string | null
}

/** The caller's notifications, newest first, 30 a page. */
export async function listNotifications(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly unread?: boolean; readonly after?: string; readonly limit?: number },
): Promise<NotificationPage> {
  const limit = Math.min(Math.max(request.limit ?? 30, 1), 100)
  let before: [string, string] | null = null
  if (request.after !== undefined && request.after !== '') {
    const [at, id] = request.after.split('|')
    if (at === undefined || id === undefined || Number.isNaN(Date.parse(at))) {
      throw new BasedbError('CURSOR_INVALID', { details: { cursor: request.after } })
    }
    before = [at, id]
  }
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const params: unknown[] = [ctx.actor.id, ctx.tenantId]
      const clauses = ['n.user_id = $1', 't.ref = $2']
      if (request.unread === true) clauses.push('n.read_at IS NULL')
      if (before !== null) {
        params.push(before[0], before[1])
        clauses.push(
          `(n.created_at, n.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
        )
      }
      params.push(limit + 1)
      const rows = await exec.query<Line>(
        `SELECT n.id::text, n.kind, n.actor_id::text,
                coalesce(nullif(a.display_name, ''), a.email) AS actor_name,
                sn.name AS base_name, b.label AS base_label,
                n.table_id::text, tn.name AS table_name, td.label AS table_label,
                n.record_id::text, n.comment_id::text, n.excerpt,
                n.created_at::text, n.read_at::text
           FROM _basedb.notification n
           JOIN _basedb.tenant t ON t.id = n.tenant_id
           JOIN _basedb.base b ON b.id = n.base_id
           JOIN _basedb.table_def td ON td.id = n.table_id
           JOIN _basedb.physical_name tn ON tn.id = td.name_id
           JOIN _basedb.db_schema s ON s.id = td.schema_id
           JOIN _basedb.physical_name sn ON sn.id = s.name_id
           LEFT JOIN _basedb.app_user a ON a.id = n.actor_id
          WHERE ${clauses.join(' AND ')}
          ORDER BY n.created_at DESC, n.id DESC
          LIMIT $${params.length}`,
        params,
      )
      const page = rows.slice(0, limit)
      const readable = new Map<string, boolean>()
      for (const tableId of new Set(page.map((r) => r.table_id))) {
        readable.set(tableId, await canReadTable(exec, ctx, tableId))
      }
      const [count] = await exec.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM _basedb.notification n
           JOIN _basedb.tenant t ON t.id = n.tenant_id
          WHERE n.user_id = $1 AND t.ref = $2 AND n.read_at IS NULL`,
        [ctx.actor.id, ctx.tenantId],
      )
      const last = page[page.length - 1]
      return {
        notifications: page.map((r) => ({
          id: r.id,
          kind: r.kind,
          actor: r.actor_id === null ? null : { id: r.actor_id, name: r.actor_name ?? '' },
          base: { name: r.base_name, label: r.base_label },
          table: { name: r.table_name, label: r.table_label },
          recordId: r.record_id,
          commentId: r.comment_id,
          excerpt: r.excerpt,
          createdAt: r.created_at,
          readAt: r.read_at,
          readable: readable.get(r.table_id) === true,
        })),
        unread: count?.n ?? 0,
        nextCursor:
          rows.length > limit && last !== undefined ? `${last.created_at}|${last.id}` : null,
      }
    },
    { readOnly: true },
  )
}

/** Marks read the notifications named, or all of the caller's. Returns how many changed. */
export async function markNotificationsRead(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly ids?: readonly string[]; readonly all?: boolean },
): Promise<number> {
  const ids = (request.ids ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (request.all !== true && ids.length === 0) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'ids', reason: 'rien_a_marquer' },
    })
  }
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const rows = await exec.query<{ id: string }>(
      `UPDATE _basedb.notification n SET read_at = pg_catalog.clock_timestamp()
         FROM _basedb.tenant t
        WHERE t.id = n.tenant_id AND t.ref = $2 AND n.user_id = $1 AND n.read_at IS NULL
          AND ($3::boolean OR n.id = ANY($4::uuid[]))
        RETURNING n.id::text`,
      [ctx.actor.id, ctx.tenantId, request.all === true, ids],
      'update',
    )
    if (rows.length > 0) await emitLive(exec, { kind: 'notifications', user: ctx.actor.id })
    return rows.length
  })
}

/** Housekeeping: notifications past their retention, presence nobody refreshed. */
export async function purgeCollaboration(pools: Pools): Promise<void> {
  await pools.withConnection('catalog', async (exec) => {
    await exec.query(
      `DELETE FROM _basedb.notification
        WHERE created_at < pg_catalog.clock_timestamp() - make_interval(days => $1)`,
      [NOTIFICATION_RETENTION_DAYS],
      'delete',
    )
    await exec.query(
      `DELETE FROM _basedb.presence
        WHERE seen_at < pg_catalog.clock_timestamp() - interval '5 minutes'`,
      [],
      'delete',
    )
  })
}
