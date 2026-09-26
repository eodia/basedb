import { BasedbError } from '../errors/index.js'
import { requireOnTable } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type PointerAt, emitLive } from './signals.js'

/**
 * Presence — chapter 16 §3.3: who is looking at a table, and which row each has open.
 * One row per open stream in an unlogged table, refreshed while the stream lives,
 * ignored past a minute: an instance that fell leaves no ghost for longer.
 */

export const PRESENCE_FRESH_SECONDS = 60

export interface Viewer {
  readonly userId: string
  readonly name: string
  readonly recordId: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Places a stream's session on a table — and a row of it — once reading it is allowed. */
export async function enterPresence(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly session: string; readonly tableId: string; readonly recordId: string | null },
): Promise<void> {
  if (!UUID.test(request.session)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'session', reason: 'format' } })
  }
  const recordId =
    request.recordId !== null && UUID.test(request.recordId) ? request.recordId : null
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'read', request.tableId)
    const [previous] = await exec.query<{ table_id: string; user_id: string }>(
      'SELECT table_id::text, user_id::text FROM _basedb.presence WHERE session_id = $1',
      [request.session],
    )
    // A session is its owner's: another's identifier moves nothing.
    if (previous !== undefined && previous.user_id !== ctx.actor.id) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { session: request.session } })
    }
    await exec.query(
      `INSERT INTO _basedb.presence (session_id, tenant_id, user_id, base_id, table_id, record_id)
       SELECT $1, b.tenant_id, $2, b.id, t.id, $4
         FROM _basedb.table_def t JOIN _basedb.base b ON b.id = t.base_id
        WHERE t.id = $3
       ON CONFLICT (session_id) DO UPDATE
          SET base_id = EXCLUDED.base_id, table_id = EXCLUDED.table_id,
              record_id = EXCLUDED.record_id, seen_at = pg_catalog.clock_timestamp()`,
      [request.session, ctx.actor.id, request.tableId, recordId],
      'insert',
    )
    if (previous !== undefined && previous.table_id !== request.tableId) {
      await emitLive(exec, { kind: 'presence', table: previous.table_id })
    }
    await emitLive(exec, { kind: 'presence', table: request.tableId })
  })
}

/**
 * Moves a stream's pointer — chapter 16 §3.4. Nothing is written: the pointer is a signal,
 * sent to those who look at the same table, and gone with the next one. The session must
 * be the caller's and sit on that table, or the pointer goes nowhere.
 */
export async function movePointer(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly session: string; readonly tableId: string; readonly at: PointerAt | null },
): Promise<void> {
  if (!UUID.test(request.session)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'session', reason: 'format' } })
  }
  const at = pointerAt(request.at)
  await pools.withConnection('catalog', async (exec) => {
    const [owner] = await exec.query<{ name: string | null }>(
      `SELECT nullif(u.display_name, '') AS name
         FROM _basedb.presence p JOIN _basedb.app_user u ON u.id = p.user_id
        WHERE p.session_id = $1 AND p.user_id = $2 AND p.table_id = $3`,
      [request.session, ctx.actor.id, request.tableId],
    )
    if (owner === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { session: request.session } })
    }
    await emitLive(exec, {
      kind: 'pointer',
      table: request.tableId,
      session: request.session,
      user: ctx.actor.id,
      name: owner.name ?? 'Utilisateur',
      at,
    })
  })
}

/** A pointer's place as the browser sent it, or `null` when it makes no sense. */
function pointerAt(raw: PointerAt | null): PointerAt | null {
  if (raw === null || typeof raw !== 'object') return null
  const { record, field, x, y } = raw
  if (typeof record !== 'string' || !UUID.test(record)) return null
  if (typeof field !== 'string' || !/^_?[a-z][a-z0-9_]{0,62}$/.test(field)) return null
  if (typeof x !== 'number' || typeof y !== 'number') return null
  const unit = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000
  return { record, field, x: unit(x), y: unit(y) }
}

/** Keeps the sessions of the streams still open alive. */
export async function refreshPresence(pools: Pools, sessions: readonly string[]): Promise<void> {
  if (sessions.length === 0) return
  await pools.withConnection('catalog', (exec) =>
    exec.query(
      `UPDATE _basedb.presence SET seen_at = pg_catalog.clock_timestamp()
        WHERE session_id = ANY($1::uuid[])`,
      [sessions],
      'update',
    ),
  )
}

/** A stream closed: its session leaves, and those who watched the table are told. */
export async function leavePresence(pools: Pools, session: string): Promise<void> {
  if (!UUID.test(session)) return
  await pools.withConnection('catalog', async (exec) => {
    const [gone] = await exec.query<{ table_id: string }>(
      'DELETE FROM _basedb.presence WHERE session_id = $1 RETURNING table_id::text',
      [session],
      'delete',
    )
    if (gone !== undefined) await emitLive(exec, { kind: 'presence', table: gone.table_id })
  })
}

/**
 * Who looks at a table: each person once, with the row they opened last — their name,
 * never their address.
 */
export async function viewersOf(pools: Pools, tableId: string): Promise<Viewer[]> {
  return pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{
      user_id: string
      name: string | null
      record_id: string | null
    }>(
      `SELECT DISTINCT ON (p.user_id) p.user_id::text, nullif(u.display_name, '') AS name,
              p.record_id::text
         FROM _basedb.presence p JOIN _basedb.app_user u ON u.id = p.user_id
        WHERE p.table_id = $1
          AND p.seen_at > pg_catalog.clock_timestamp() - make_interval(secs => $2)
        ORDER BY p.user_id, (p.record_id IS NULL), p.seen_at DESC`,
      [tableId, PRESENCE_FRESH_SECONDS],
    )
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name ?? 'Utilisateur',
      recordId: r.record_id,
    }))
  })
}
