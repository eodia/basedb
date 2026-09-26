import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import type { Executor } from '../runtime/pool.js'
import { type RequestContext, sealContext } from '../tx/context.js'

/**
 * The live signals — chapter 16 §3: what `NOTIFY basedb_live` carries from the
 * transaction that wrote to every instance, and on to the browsers. A signal names what
 * changed, never a value: the browser reads again, under its own rights.
 */

export const LIVE_CHANNEL = 'basedb_live'
export const DRAIN_CHANNEL = 'basedb_drain'

/** Past this many rows, a signal names the table only: the page is read again whole. */
export const LIVE_MAX_IDS = 100

export type LiveSignal =
  | {
      readonly kind: 'records'
      readonly base: string
      readonly table: string
      /** `null` past `LIVE_MAX_IDS` rows. */
      readonly ids: readonly string[] | null
      readonly ops: readonly string[]
      /** The author, when the batch has a single one. */
      readonly actor: string | null
    }
  | {
      readonly kind: 'comments'
      readonly base: string
      readonly table: string
      readonly record: string
    }
  | { readonly kind: 'notifications'; readonly user: string }
  | { readonly kind: 'presence'; readonly table: string }
  | {
      readonly kind: 'pointer'
      readonly table: string
      /** The stream that moved: not echoed back to it. */
      readonly session: string
      readonly user: string
      readonly name: string
      /** `null`: the pointer left the grid. */
      readonly at: PointerAt | null
    }

/**
 * Where a pointer is, as every screen can place it again: the cell it is over — a row, a
 * column — and where in that cell, from 0 to 1. Pixels would mean nothing on another
 * screen: another width, another scroll, other column widths.
 */
export interface PointerAt {
  readonly record: string
  readonly field: string
  readonly x: number
  readonly y: number
}

/**
 * Emits a signal, delivered at the commit of the transaction under way — or never, if it
 * rolls back. Skipped when the notification queue is more than half full: a signal is a
 * comfort, the write must not fail for it (chapter 07 §11.4).
 */
export async function emitLive(exec: Executor, signal: LiveSignal): Promise<void> {
  await exec.query(
    `SELECT pg_catalog.pg_notify($1, $2)
      WHERE pg_catalog.pg_notification_queue_usage() < 0.5`,
    [LIVE_CHANNEL, JSON.stringify(signal)],
  )
}

/** Reads a signal off the channel; anything else — a foreign payload — is ignored. */
export function parseLive(payload: string): LiveSignal | null {
  try {
    const value = JSON.parse(payload) as { kind?: unknown }
    return typeof value?.kind === 'string' ? (value as LiveSignal) : null
  } catch {
    return null
  }
}

/**
 * A context for someone who is not the caller — the person mentioned, notified, the
 * owner of a stream — to decide what THEY may read. Never used to write.
 */
export function contextOf(tenantRef: string, userId: string, requestId: string): RequestContext {
  const now = new Date()
  return sealContext({
    requestId,
    actor: { kind: 'user', id: userId },
    tenantId: tenantRef,
    surface: 'ui',
    timestamp: now,
    deadline: new Date(now.getTime() + 15_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

/**
 * The columns a person reads in a table, by physical name — what a stream lets through of
 * another's pointer: over a column hidden from the reader, it names no column at all.
 */
export async function readableFieldNames(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<Set<string>> {
  const target = await loadTarget(exec, ctx, tableId)
  if (target === null) return new Set()
  const decision = decide(ctx, await loadGrants(exec, ctx), 'read', target)
  if (decision.verdict !== 'ALLOWED') return new Set()
  const fields = await exec.query<{ id: string; name: string }>(
    `SELECT f.id::text, n.name
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL`,
    [tableId],
  )
  return new Set(fields.filter((f) => decision.readableFields.has(f.id)).map((f) => f.name))
}

/**
 * Whether a person may read a table. The row predicate is constantly true in v1 (A20):
 * reading the table is reading its rows.
 */
export async function canReadTable(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<boolean> {
  const target = await loadTarget(exec, ctx, tableId)
  if (target === null) return false
  const grants = await loadGrants(exec, ctx)
  return decide(ctx, grants, 'read', target).verdict === 'ALLOWED'
}
