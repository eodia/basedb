import { qualify, quoteIdentifier } from '@basedb/naming'
import { type Trigger, queueTriggered } from '../automations/engine.js'
import { wantsNotification } from '../collab/notifications.js'
import { LIVE_MAX_IDS, canReadTable, contextOf, emitLive } from '../collab/signals.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { executorOf } from '../runtime/pool.js'
import { scheduleDeliveries } from '../webhooks/dispatch.js'
import { type HistoryField, type HistoryTable, displayText, loadHistoryTables } from './catalog.js'

/**
 * The drain — chapter 07 §1.4.
 *
 * Moves what the capture wrote into `_basedb_local` over to the journals of `_basedb`:
 * one header per (record, statement), one detail line per field that changed, one line
 * of the deletion journal per deletion, and the outgoing events for webhooks. The field
 * each JSON key stands for, the name of each row and of each link target are resolved
 * HERE, from the catalog read now — never in the write path.
 *
 * One transaction per batch, reading the buffers and writing the journals on the same
 * connection, then deleting what it moved: a crash anywhere rolls the whole batch back,
 * and the next pass redoes it. The `ON CONFLICT DO NOTHING` of every insert is kept all
 * the same — it is what the chapter asks of a drain that may one day run on two pools.
 *
 * Serialized by the advisory lock of class `drain` (chapter 02): two API processes
 * polling the same database take turns instead of interleaving.
 */

/** Rows moved per transaction. */
export const DRAIN_BATCH = 500

const DRAIN_LOCK_CLASS = 5

type BufferRow = {
  readonly id: string
  readonly occurred_at: string
  readonly xact_id: string
  readonly base_id: string
  readonly table_id: string
  readonly record_id: string
  readonly op: 'insert' | 'update' | 'delete'
  readonly is_cascade: boolean
  readonly actor_kind: string
  readonly actor_user_id: string | null
  readonly actor_token_id: string | null
  readonly sql_identity: string | null
  readonly bulk_id: string | null
  readonly format_version: number
  readonly before: Record<string, unknown> | null
  readonly after: Record<string, unknown> | null
}

/** One detail line, before it is written. */
interface Detail {
  readonly field: HistoryField
  readonly before: unknown
  readonly after: unknown
}

/** Deep equality of two JSON values, as `IS DISTINCT FROM` on jsonb would see them. */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** The fields that changed, per §3.4: every non-null on insert, every one on delete. */
function detailsOf(row: BufferRow, table: HistoryTable): Detail[] {
  const out: Detail[] = []
  for (const field of table.fields) {
    const before = row.before?.[field.column]
    const after = row.after?.[field.column]
    // A column absent from the JSON is not this table's any more — or not yet.
    if (before === undefined && after === undefined) continue
    if (row.op === 'insert') {
      if (after === null || after === undefined) continue
      out.push({ field, before: undefined, after })
    } else if (row.op === 'update') {
      if (!field.isLive) continue
      if (same(before, after)) continue
      out.push({ field, before, after })
    } else {
      // A deletion keeps the whole row: it is the only copy left (§3.4).
      out.push({ field, before: before ?? null, after: undefined })
    }
  }
  return out
}

/** The label of a choice value, or of each of a list of them. */
function choiceDisplay(field: HistoryField, value: unknown): string | null {
  if (value === null || value === undefined) return null
  const labelOf = (v: unknown) => field.options?.get(String(v)) ?? String(v)
  return displayText(Array.isArray(value) ? value.map(labelOf) : labelOf(value))
}

/**
 * The names of the link targets a batch mentions — the three ranks of §4.2: the target
 * row as it stands, then the batch itself and the journal (a target deleted since), then
 * nothing, which the reader shows as "not kept".
 */
async function resolveLinkDisplays(
  exec: Executor,
  rows: readonly BufferRow[],
  details: ReadonlyMap<string, readonly Detail[]>,
): Promise<Map<string, string>> {
  // (target table) → ids wanted.
  const wanted = new Map<string, { field: HistoryField; ids: Set<string> }>()
  for (const list of details.values()) {
    for (const d of list) {
      const target = d.field.target
      if (target === undefined || target.displayColumn === null) continue
      const entry = wanted.get(target.tableId) ?? { field: d.field, ids: new Set<string>() }
      // A multi-link names several rows (04 §4 bis): each is looked up the same way.
      for (const v of [d.before, d.after]) {
        for (const id of Array.isArray(v) ? v : [v]) if (typeof id === 'string') entry.ids.add(id)
      }
      wanted.set(target.tableId, entry)
    }
  }

  const found = new Map<string, string>()
  const key = (tableId: string, id: string) => `${tableId}:${id}`

  for (const [tableId, { field, ids }] of wanted) {
    const target = field.target
    if (target === undefined || target.displayColumn === null || ids.size === 0) continue
    // Rank 1: the row as it stands — under a savepoint, since a target relegated or
    // dropped since would otherwise abort the whole batch instead of this one read.
    await exec.query('SAVEPOINT link_display')
    try {
      const current = await exec.query<{ id: string; display: string | null }>(
        `SELECT "_id"::text AS id, ${quoteIdentifier(target.displayColumn)}::text AS display
           FROM ${qualify(target.schema, target.table)} WHERE "_id" = ANY($1::uuid[])`,
        [[...ids]],
      )
      for (const r of current) if (r.display !== null) found.set(key(tableId, r.id), r.display)
      await exec.query('RELEASE SAVEPOINT link_display')
    } catch {
      // The ranks below still answer.
      await exec.query('ROLLBACK TO SAVEPOINT link_display')
    }
    // Rank 2: this batch — a target deleted in the same transaction — then the journal.
    const missing = [...ids].filter((id) => !found.has(key(tableId, id)))
    for (const row of rows) {
      if (row.table_id !== tableId || !missing.includes(row.record_id)) continue
      const value = (row.before ?? row.after)?.[target.displayColumn]
      const text = displayText(value)
      if (text !== null) found.set(key(tableId, row.record_id), text)
    }
    const still = missing.filter((id) => !found.has(key(tableId, id)))
    if (still.length > 0) {
      const journal = await exec.query<{ record_id: string; record_display: string }>(
        `SELECT DISTINCT ON (record_id) record_id::text, record_display
           FROM _basedb.record_revision
          WHERE table_id = $1 AND record_id = ANY($2::uuid[]) AND record_display IS NOT NULL
          ORDER BY record_id, occurred_at DESC`,
        [tableId, still],
      )
      for (const r of journal) found.set(key(tableId, r.record_id), r.record_display)
    }
  }
  return found
}

/**
 * A person field set to someone notifies them — if they may read the row, and it was not
 * their own gesture (chapter 16 §2.1). Born here, it holds for every write, whatever its
 * surface: the interface, the API, MCP or direct SQL.
 */
async function notifyAssigned(
  exec: Executor,
  assigned: ReadonlyArray<{ row: BufferRow; user: string; display: string | null }>,
): Promise<void> {
  if (assigned.length === 0) return
  const owners = await exec.query<{ id: string; tenant_id: string; ref: string }>(
    `SELECT b.id::text, b.tenant_id::text, t.ref
       FROM _basedb.base b JOIN _basedb.tenant t ON t.id = b.tenant_id
      WHERE b.id = ANY($1::uuid[])`,
    [[...new Set(assigned.map((a) => a.row.base_id))]],
  )
  const byBase = new Map(owners.map((o) => [o.id, o]))
  for (const { row, user, display } of assigned) {
    const owner = byBase.get(row.base_id)
    if (owner === undefined || !/^[0-9a-f-]{36}$/i.test(user)) continue
    const [member] = await exec.query<{ id: string }>(
      `SELECT id::text FROM _basedb.app_user
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND disabled_at IS NULL`,
      [user, owner.tenant_id],
    )
    if (member === undefined) continue
    if (!(await wantsNotification(exec, user, 'assigned'))) continue
    if (!(await canReadTable(exec, contextOf(owner.ref, user, row.id), row.table_id))) continue
    await exec.query(
      `INSERT INTO _basedb.notification
         (tenant_id, user_id, kind, actor_id, base_id, table_id, record_id, excerpt)
       VALUES ($1, $2, 'assigned', $3, $4, $5, $6, $7)`,
      [
        owner.tenant_id,
        user,
        row.actor_user_id,
        row.base_id,
        row.table_id,
        row.record_id,
        (display ?? '').slice(0, 200),
      ],
      'insert',
    )
    await emitLive(exec, { kind: 'notifications', user })
  }
}

/** One batch. Returns how many buffer rows it moved; `0` when there was nothing to do. */
async function drainBatch(exec: Executor): Promise<number> {
  const [locked] = await exec.query<{ ok: boolean }>(
    'SELECT pg_try_advisory_xact_lock($1, 0) AS ok',
    [DRAIN_LOCK_CLASS],
  )
  if (locked?.ok !== true) return 0

  const rows = await exec.query<BufferRow>(
    `SELECT id::text, occurred_at::text, xact_id::text, base_id::text, table_id::text,
            record_id::text, op, is_cascade, actor_kind, actor_user_id::text,
            actor_token_id::text, sql_identity, bulk_id::text, format_version, before, after
       FROM _basedb_local.revision_buffer
      WHERE drained_at IS NULL
      ORDER BY occurred_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED`,
    [DRAIN_BATCH],
  )

  if (rows.length > 0) {
    const tables = await loadHistoryTables(exec, [...new Set(rows.map((r) => r.table_id))])
    const details = new Map<string, readonly Detail[]>()
    for (const row of rows) {
      const table = tables.get(row.table_id)
      details.set(row.id, table === undefined ? [] : detailsOf(row, table))
    }
    const links = await resolveLinkDisplays(exec, rows, details)
    /** What each table's batch tells the browsers (chapter 16 §3.1). */
    const touched = new Map<
      string,
      { base: string; ids: Set<string>; ops: Set<string>; actors: Set<string | null> }
    >()
    /** The people a person field was just set to (chapter 16 §2.1). */
    const assigned: Array<{ row: BufferRow; user: string; display: string | null }> = []
    /** What the batch may trigger (chapter 17 §2.1). */
    const triggers: Trigger[] = []

    for (const row of rows) {
      const table = tables.get(row.table_id)
      const list = details.get(row.id) ?? []
      // A modification that touched no field the catalog knows — a relegated column, a
      // column added by hand — is not history (§3.2): it names nothing a reader knows.
      if (row.op === 'update' && list.length === 0) continue

      const recordDisplay =
        table?.displayColumn === null || table === undefined
          ? null
          : displayText((row.after ?? row.before)?.[table.displayColumn])

      const batch = touched.get(row.table_id) ?? {
        base: row.base_id,
        ids: new Set<string>(),
        ops: new Set<string>(),
        actors: new Set<string | null>(),
      }
      batch.ids.add(row.record_id)
      batch.ops.add(row.op)
      batch.actors.add(row.actor_user_id)
      touched.set(row.table_id, batch)
      triggers.push({
        tableId: row.table_id,
        recordId: row.record_id,
        op: row.op,
        actorKind: row.actor_kind,
        changed: list.map((d) => d.field.column),
        // What an automation on deletions cites of the row: as it was.
        ...(row.op === 'delete' ? { before: row.before } : {}),
      })
      if (row.op !== 'delete') {
        for (const d of list) {
          if (d.field.kind !== 'user' || typeof d.after !== 'string' || d.after === '') continue
          if (d.after === d.before || d.after === row.actor_user_id) continue
          assigned.push({ row, user: d.after, display: recordDisplay })
        }
      }

      await exec.query(
        `INSERT INTO _basedb.record_revision
           (id, occurred_at, xact_id, base_id, table_id, record_id, op, is_cascade, bulk_id,
            record_display, actor_kind, actor_user_id, actor_token_id, sql_identity,
            format_version)
         VALUES ($1, $2::timestamptz, $3::xid8, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15)
         ON CONFLICT (id, occurred_at) DO NOTHING`,
        [
          row.id,
          row.occurred_at,
          row.xact_id,
          row.base_id,
          row.table_id,
          row.record_id,
          row.op,
          row.is_cascade,
          row.bulk_id,
          recordDisplay,
          row.actor_kind,
          row.actor_user_id,
          row.actor_token_id,
          row.sql_identity,
          row.format_version,
        ],
        'insert',
      )

      for (const d of list) {
        const display = (value: unknown): string | null => {
          if (value === undefined || value === null) return null
          if (d.field.target !== undefined && typeof value === 'string') {
            return links.get(`${d.field.target.tableId}:${value}`) ?? null
          }
          // The rows of a multi-link, in their order; one whose name was not kept says so.
          if (d.field.target !== undefined && Array.isArray(value)) {
            const tableId = d.field.target.tableId
            return value
              .map((id) => links.get(`${tableId}:${String(id)}`) ?? 'ligne non conservée')
              .join(', ')
          }
          if (d.field.kind === 'select' || d.field.kind === 'multi_select') {
            return choiceDisplay(d.field, value)
          }
          if (d.field.kind === 'file' || d.field.kind === 'image') return displayText(value)
          return null
        }
        await exec.query(
          `INSERT INTO _basedb.record_revision_field
             (revision_id, occurred_at, base_id, field_id, field_kind, before_value,
              after_value, before_display, after_display)
           VALUES ($1, $2::timestamptz, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
           ON CONFLICT (revision_id, occurred_at, field_id) DO NOTHING`,
          [
            row.id,
            row.occurred_at,
            row.base_id,
            d.field.id,
            d.field.kind,
            // `undefined` is "not concerned" — SQL NULL; `null` is "was empty" — jsonb null.
            d.before === undefined ? null : JSON.stringify(d.before),
            d.after === undefined ? null : JSON.stringify(d.after),
            display(d.before),
            display(d.after),
          ],
          'insert',
        )
      }

      if (row.op === 'delete') {
        await exec.query(
          `INSERT INTO _basedb.record_deletion
             (base_id, table_id, record_id, deleted_at, deleted_by, actor_kind, is_cascade,
              revision_id)
           VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8)
           ON CONFLICT (table_id, deleted_at, record_id) DO NOTHING`,
          [
            row.base_id,
            row.table_id,
            row.record_id,
            row.occurred_at,
            row.actor_user_id,
            row.actor_kind,
            row.is_cascade,
            row.id,
          ],
          'insert',
        )
      }
    }

    await exec.query('DELETE FROM _basedb_local.revision_buffer WHERE id = ANY($1::uuid[])', [
      rows.map((r) => r.id),
    ])

    await notifyAssigned(exec, assigned)
    await queueTriggered(exec, triggers)
    for (const [table, batch] of touched) {
      await emitLive(exec, {
        kind: 'records',
        base: batch.base,
        table,
        ids: batch.ids.size > LIVE_MAX_IDS ? null : [...batch.ids],
        ops: [...batch.ops],
        actor: batch.actors.size === 1 ? ([...batch.actors][0] ?? null) : null,
      })
    }
  }

  // The outgoing events ride along: same transaction, same lock (07 §1.4, step 3).
  const events = await exec.query<{
    id: string
    occurred_at: string
    base_id: string
    table_id: string
    record_id: string
    op: string
  }>(
    `WITH moved AS (
       DELETE FROM _basedb_local.change_event_buffer
        WHERE id IN (SELECT id FROM _basedb_local.change_event_buffer
                      WHERE drained_at IS NULL
                      ORDER BY occurred_at, id
                      LIMIT $1
                      FOR UPDATE SKIP LOCKED)
       RETURNING *)
     INSERT INTO _basedb.change_event
       (id, occurred_at, base_id, table_id, record_id, op, is_cascade, xact_id, actor_kind,
        actor_user_id, actor_token_id, format_version, before, after)
     SELECT id, occurred_at, base_id, table_id, record_id, op, is_cascade, xact_id,
            actor_kind, actor_user_id, actor_token_id, format_version, before, after
       FROM moved
     ON CONFLICT (id, occurred_at) DO NOTHING
     RETURNING id::text, occurred_at::text, base_id::text, table_id::text, record_id::text, op`,
    [DRAIN_BATCH],
  )
  // Each event leaves with its deliveries, in the same transaction (08 §10.1).
  await scheduleDeliveries(exec, events)

  return rows.length + events.length
}

/**
 * Drains until the buffers are empty or a batch finds the lock taken. Returns the rows
 * moved. Safe to call from anywhere, any number of times: a pass with nothing to do is
 * one indexed read.
 */
export async function drainHistory(pools: Pools): Promise<number> {
  let total = 0
  for (;;) {
    const client = await pools.acquire('catalog')
    const exec = executorOf(client)
    let moved = 0
    try {
      await exec.query('BEGIN')
      moved = await drainBatch(exec)
      await exec.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
    total += moved
    if (moved < DRAIN_BATCH) return total
  }
}

/** The drain as a background loop: a pass every `intervalMs`, never two at once. */
export function startDrainLoop(
  pools: Pools,
  intervalMs: number,
  onError: (error: unknown) => void,
): () => void {
  let running = false
  let stopped = false
  const timer = setInterval(() => {
    if (running || stopped) return
    running = true
    drainHistory(pools)
      .catch(onError)
      .finally(() => {
        running = false
      })
  }, intervalMs)
  // A loop that holds the process open would keep a finished test runner alive.
  timer.unref?.()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
