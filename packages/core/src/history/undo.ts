import { qualify } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { rowWhere } from '../rbac/rows.js'
import { currentXact } from '../records/update.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { refuseSynced } from '../sync/guard.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { loadHistoryTables } from './catalog.js'
import { drainHistory } from './drain.js'
import { type LoadedRevision, loadRevision, restoreIn, revertIn } from './read.js'

/**
 * Undoing a write by its transaction — chapter 16 §4: what Ctrl+Z asks.
 *
 * The revisions of the transaction whose author is the caller, less than a day old, are
 * undone in ONE transaction: the deleted rows restored first, then the modifications
 * rolled back, then the created rows deleted — a restored row may be what a link points
 * to again, a link rolled back may stop pointing to a row about to go. Anything written
 * since by someone else refuses the whole (`REVISION_SUPERSEDED`). The undo is an
 * ordinary write: it returns its own transaction, and undoing it again is redoing.
 */

export const UNDO_WINDOW_HOURS = 24
export const UNDO_MAX_REVISIONS = 1_000

export interface Undone {
  /** The undo's own transaction — what a redo names. */
  readonly transaction: string
  readonly revisions: number
  readonly tables: readonly string[]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The revisions of a transaction by its author, oldest first. */
async function revisionsOf(pools: Pools, ctx: RequestContext, transaction: string) {
  return pools.withConnection('catalog', async (exec) => {
    const drained = await exec.query<{ id: string }>(
      `SELECT id::text FROM _basedb.record_revision
        WHERE xact_id = $1::xid8 AND actor_user_id = $2
          AND occurred_at > pg_catalog.clock_timestamp() - make_interval(hours => $3)
        ORDER BY occurred_at, id
        LIMIT $4`,
      [transaction, ctx.actor.id, UNDO_WINDOW_HOURS, UNDO_MAX_REVISIONS + 1],
    )
    const [pending] = await exec.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM _basedb_local.revision_buffer
        WHERE xact_id = $1::xid8 AND drained_at IS NULL`,
      [transaction],
    )
    return { ids: drained.map((r) => r.id), pending: (pending?.n ?? 0) > 0 }
  })
}

/**
 * Deletes a row the transaction created — if it still has the values of its creation.
 * A column the AI fills afterwards is not a write of anyone's, and does not count.
 */
async function deleteCreatedIn(
  exec: Executor,
  ctx: RequestContext,
  revision: LoadedRevision,
): Promise<void> {
  const { header } = revision
  await refuseSynced(exec, ctx, header.table_id)
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, header.table_id)
  if (target === null || decide(ctx, grants, 'read', target).verdict !== 'ALLOWED') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: header.id } })
  }
  const remove = decide(ctx, grants, 'delete', target)
  if (remove.verdict !== 'ALLOWED') {
    throw new BasedbError('ADMIN_REQUIRED', {
      details: { table: header.table_id, action: 'delete' },
    })
  }
  const table = (await loadHistoryTables(exec, [header.table_id])).get(header.table_id)
  if (table === undefined || !table.isLive) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: header.id } })
  }
  const where = qualify(table.schema, table.table)
  const [current] = await exec.query<{ row: Record<string, unknown> }>(
    `SELECT pg_catalog.to_jsonb(_t) AS row FROM ${where} _t
      WHERE "_id" = $1 AND ( /*predicat_lignes*/ ${rowWhere(remove.rowPredicate, '_t')} )
        FOR UPDATE`,
    [header.record_id],
  )
  // Gone already — or out of the rows the undoer sees: there is nothing left to undo.
  if (current === undefined) return

  const ai = await exec.query<{ field_id: string }>(
    'SELECT field_id::text FROM _basedb.field_ai_config WHERE field_id = ANY($1::uuid[])',
    [table.fields.map((f) => f.id)],
  )
  const filledByAi = new Set(ai.map((r) => r.field_id))
  const created = new Map(revision.fields.map((f) => [f.field_id, f.after_value ?? null]))
  const stale = table.fields
    .filter((f) => f.isLive && !filledByAi.has(f.id))
    .filter(
      (f) =>
        JSON.stringify(current.row[f.column] ?? null) !== JSON.stringify(created.get(f.id) ?? null),
    )
    .map((f) => f.column)
  if (stale.length > 0) {
    throw new BasedbError('REVISION_SUPERSEDED', { details: { fields: stale } })
  }
  await exec.query(`DELETE FROM ${where} WHERE "_id" = $1`, [header.record_id], 'delete')
}

export async function undoTransaction(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly transaction: string },
): Promise<Undone> {
  const transaction = String(request.transaction ?? '')
  if (!/^\d{1,20}$/.test(transaction)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { transaction } })
  }

  // The drain may be running elsewhere, under its lock: the revisions can be a moment late.
  let found = { ids: [] as string[], pending: false }
  for (let attempt = 0; attempt < 8; attempt++) {
    await drainHistory(pools).catch(() => undefined)
    found = await revisionsOf(pools, ctx, transaction)
    if (!found.pending) break
    await sleep(150)
  }
  if (found.ids.length === 0) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { transaction } })
  }
  if (found.ids.length > UNDO_MAX_REVISIONS) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'transaction', reason: 'trop_de_revisions', maximum: UNDO_MAX_REVISIONS },
    })
  }

  return withTransaction(pools, 'data', ctx, async (exec) => {
    const revisions: LoadedRevision[] = []
    for (const id of found.ids) {
      const revision = await loadRevision(exec, id)
      if (revision !== null) revisions.push(revision)
    }
    const of = (op: string) => revisions.filter((r) => r.header.op === op)
    for (const revision of of('delete')) await restoreIn(exec, ctx, revision)
    for (const revision of of('update').reverse()) await revertIn(exec, ctx, revision)
    for (const revision of of('insert').reverse()) await deleteCreatedIn(exec, ctx, revision)
    return {
      transaction: await currentXact(exec),
      revisions: revisions.length,
      tables: [...new Set(revisions.map((r) => r.header.table_id))],
    }
  })
}
