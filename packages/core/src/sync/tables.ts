import { seal, unseal } from '../auth/sealing.js'
import { setDisplayColumn } from '../catalog/links.js'
import { createTable } from '../catalog/operations.js'
import { BasedbError } from '../errors/index.js'
import { requireOnBase } from '../rbac/require.js'
import { createRecords } from '../records/create.js'
import { listRecords } from '../records/list.js'
import { deleteRecord, updateRecord } from '../records/update.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import type { TargetPolicy } from '../webhooks/target.js'
import { type SourceData, type SourceKind, readSource } from './sources.js'

/**
 * Synced tables — chapter 19 §3: a table kept like its source by the server. Created with
 * the source's columns and a key field; at each synchronisation its rows are created,
 * changed and deleted to match — under a system identity, since nobody else may write them.
 */

const PURPOSE = 'sync/source'
const SYSTEM = '00000000-0000-0000-0000-000000000000'
export const KEY_LABEL = 'Clé de synchronisation'

export interface SyncedTable {
  readonly tableId: string
  readonly tableName: string
  readonly label: string
  readonly sourceKind: SourceKind
  readonly host: string
  readonly intervalMinutes: number
  readonly nextSyncAt: string
  readonly lastSyncedAt: string | null
  readonly lastStatus: 'ok' | 'failed' | null
  readonly lastError: string | null
  readonly lastCounts: { created: number; updated: number; deleted: number } | null
}

interface Column {
  readonly key: string
  readonly field: string
  readonly kind: string
}

function systemContext(tenantRef: string): RequestContext {
  const now = new Date()
  return sealContext({
    requestId: crypto.randomUUID(),
    actor: { kind: 'system', id: SYSTEM },
    tenantId: tenantRef,
    surface: 'system',
    timestamp: now,
    deadline: new Date(now.getTime() + 10 * 60_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

const KINDS: readonly SourceKind[] = ['csv', 'ics', 'basedb']

function checkedInterval(raw: unknown): number {
  const n = typeof raw === 'number' ? Math.round(raw) : 60
  if (n < 15 || n > 1440) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'interval_minutes', reason: 'entre_15_et_1440' },
    })
  }
  return n
}

/** Two values as the same cell holds them: a date by its day, a number by its value. */
function same(a: unknown, b: unknown, kind: string): boolean {
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === ''))
    return true
  if (kind === 'number') return Number(a) === Number(b)
  if (kind === 'datetime') return new Date(String(a)).getTime() === new Date(String(b)).getTime()
  if (kind === 'date') return String(a).slice(0, 10) === String(b).slice(0, 10)
  return String(a ?? '') === String(b ?? '')
}

/**
 * Makes a synced table look like its source: rows created, changed, deleted. Returns what
 * it did. Written as the system: the guard lets it, and nobody else.
 */
async function apply(
  pools: Pools,
  ctx: RequestContext,
  tableId: string,
  keyField: string,
  columns: readonly Column[],
  data: SourceData,
): Promise<{ created: number; updated: number; deleted: number }> {
  const existing = new Map<string, Record<string, unknown>>()
  let after: string | undefined
  do {
    const page = await listRecords(pools, ctx, {
      tableId,
      select: [keyField, ...columns.map((c) => c.field)],
      limit: 500,
      after,
      links: 'id',
    })
    for (const row of page.rows) existing.set(String(row[keyField] ?? ''), row)
    after = page.nextCursor ?? undefined
  } while (after !== undefined)

  const valuesOf = (values: Readonly<Record<string, unknown>>) =>
    Object.fromEntries(columns.map((c) => [c.field, values[c.key] ?? null]))

  const toCreate = data.rows.filter((r) => !existing.has(r.key))
  for (let i = 0; i < toCreate.length; i += 1000) {
    const batch = toCreate.slice(i, i + 1000)
    await createRecords(pools, ctx, {
      tableId,
      records: batch.map((r) => ({ [keyField]: r.key, ...valuesOf(r.values) })),
    })
  }

  let updated = 0
  for (const row of data.rows) {
    const current = existing.get(row.key)
    if (current === undefined) continue
    const values = valuesOf(row.values)
    const changed = Object.fromEntries(
      columns
        .filter((c) => !same(current[c.field], values[c.field], c.kind))
        .map((c) => [c.field, values[c.field]]),
    )
    if (Object.keys(changed).length === 0) continue
    await updateRecord(pools, ctx, { tableId, recordId: String(current._id), values: changed })
    updated++
  }

  const keep = new Set(data.rows.map((r) => r.key))
  let deleted = 0
  for (const [key, row] of existing) {
    if (keep.has(key)) continue
    await deleteRecord(pools, ctx, { tableId, recordId: String(row._id) })
    deleted++
  }
  return { created: toCreate.length, updated, deleted }
}

/** Creates a synced table from its source, and fills it. */
export async function createSyncedTable(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  targets: TargetPolicy,
  request: {
    readonly baseId: string
    readonly label: unknown
    readonly source: { readonly kind?: unknown; readonly url?: unknown }
    readonly intervalMinutes?: unknown
  },
): Promise<SyncedTable> {
  const kind = request.source.kind as SourceKind
  if (!KINDS.includes(kind)) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'source.kind', reason: 'source_inconnue' },
    })
  }
  const url = typeof request.source.url === 'string' ? request.source.url.trim() : ''
  const label = typeof request.label === 'string' ? request.label.trim().slice(0, 255) : ''
  if (label === '') {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'label', reason: 'libelle_invalide' },
    })
  }
  const interval = checkedInterval(request.intervalMinutes)
  await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => requireOnBase(exec, ctx, 'manage_schema', request.baseId),
    {
      readOnly: true,
    },
  )
  const data = await readSource(kind, url, targets)
  if (data.columns.length === 0) {
    throw new BasedbError('SYNC_SOURCE_FAILED', { details: { reason: 'aucune_colonne' } })
  }

  const created = await createTable(pools, ctx, {
    baseId: request.baseId,
    label,
    description: `Synchronisée depuis ${new URL(url).host}.`,
    fields: [
      { label: KEY_LABEL, kind: 'short_text' },
      ...data.columns.map((c) => ({
        label: c.label === KEY_LABEL ? `${c.label} (source)` : c.label,
        kind: c.kind,
      })),
    ],
  })
  const [keyField, ...fields] = created.fields
  if (keyField === undefined)
    throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'sync key field' } })
  const columns: Column[] = data.columns.map((c, i) => ({
    key: c.key,
    field: (fields[i] as { name: string }).name,
    kind: c.kind,
  }))
  // The first column names a row, as it does in the source.
  if (fields[0] !== undefined) {
    await setDisplayColumn(pools, ctx, {
      tableId: created.tableId,
      fieldId: fields[0].fieldId,
    }).catch(() => undefined)
  }

  const tenantRef = ctx.tenantId
  await withTransaction(pools, 'catalog', ctx, (exec) =>
    exec.query(
      `INSERT INTO _basedb.table_sync
         (table_id, base_id, source_kind, url_sealed, url_host, interval_minutes, key_field_id,
          columns, next_sync_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb,
               pg_catalog.clock_timestamp() + make_interval(mins => $6), $9)`,
      [
        created.tableId,
        request.baseId,
        kind,
        seal(instanceKey, PURPOSE, url),
        new URL(url).host,
        interval,
        keyField.fieldId,
        JSON.stringify(columns),
        ctx.actor.id,
      ],
      'insert',
    ),
  )
  const counts = await apply(
    pools,
    systemContext(tenantRef),
    created.tableId,
    keyField.name,
    columns,
    data,
  )
  await pools.withConnection('catalog', (exec) =>
    exec.query(
      `UPDATE _basedb.table_sync SET last_synced_at = pg_catalog.clock_timestamp(),
              last_status = 'ok', last_error = NULL, last_counts = $2::jsonb
        WHERE table_id = $1`,
      [created.tableId, JSON.stringify(counts)],
      'update',
    ),
  )
  const [synced] = await listSyncedTables(pools, ctx, {
    baseId: request.baseId,
    tableId: created.tableId,
  })
  return synced as SyncedTable
}

/** The synced tables of a base, with how their last synchronisation went. */
export async function listSyncedTables(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly tableId?: string },
): Promise<SyncedTable[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      const rows = await exec.query<{
        table_id: string
        table_name: string
        label: string
        source_kind: SourceKind
        url_host: string
        interval_minutes: number
        next_sync_at: string
        last_synced_at: string | null
        last_status: 'ok' | 'failed' | null
        last_error: string | null
        last_counts: SyncedTable['lastCounts']
      }>(
        `SELECT s.table_id::text, tn.name AS table_name, t.label, s.source_kind, s.url_host,
                s.interval_minutes, s.next_sync_at::text, s.last_synced_at::text,
                s.last_status, s.last_error, s.last_counts
           FROM _basedb.table_sync s
           JOIN _basedb.table_def t ON t.id = s.table_id AND t.is_live
           JOIN _basedb.physical_name tn ON tn.id = t.name_id
          WHERE s.base_id = $1 AND ($2::uuid IS NULL OR s.table_id = $2::uuid)
          ORDER BY t.label`,
        [request.baseId, request.tableId ?? null],
      )
      return rows.map((r) => ({
        tableId: r.table_id,
        tableName: r.table_name,
        label: r.label,
        sourceKind: r.source_kind,
        host: r.url_host,
        intervalMinutes: r.interval_minutes,
        nextSyncAt: r.next_sync_at,
        lastSyncedAt: r.last_synced_at,
        lastStatus: r.last_status,
        lastError: r.last_error,
        lastCounts: r.last_counts,
      }))
    },
    { readOnly: true },
  )
}

/** Changes the rhythm of a synced table. */
export async function updateSyncedTable(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly tableId: string; readonly intervalMinutes: unknown },
): Promise<SyncedTable> {
  const interval = checkedInterval(request.intervalMinutes)
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const rows = await exec.query(
      `UPDATE _basedb.table_sync
          SET interval_minutes = $3,
              next_sync_at = coalesce(last_synced_at, pg_catalog.clock_timestamp()) + make_interval(mins => $3)
        WHERE table_id::text = $1 AND base_id = $2 RETURNING table_id`,
      [request.tableId, request.baseId, interval],
      'update',
    )
    if (rows.length === 0)
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
  })
  const [synced] = await listSyncedTables(pools, ctx, request)
  return synced as SyncedTable
}

/** Stops synchronising: the table becomes an ordinary one, with its rows. */
export async function stopSyncedTable(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly tableId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const rows = await exec.query(
      'DELETE FROM _basedb.table_sync WHERE table_id::text = $1 AND base_id = $2 RETURNING table_id',
      [request.tableId, request.baseId],
      'delete',
    )
    if (rows.length === 0)
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
  })
}

/**
 * Synchronises one table now. A source that fails deletes nothing: the failure is noted,
 * and the next attempt comes at the next due date.
 */
export async function syncTable(
  pools: Pools,
  instanceKey: string,
  targets: TargetPolicy,
  tableId: string,
): Promise<SyncedTable['lastCounts']> {
  const found = await pools.withConnection('catalog', async (exec) => {
    const [row] = await exec.query<{
      source_kind: SourceKind
      url_sealed: string
      interval_minutes: number
      key_field: string
      columns: Column[]
      tenant_ref: string
    }>(
      `SELECT s.source_kind, s.url_sealed, s.interval_minutes, kn.name AS key_field, s.columns,
              te.ref AS tenant_ref
         FROM _basedb.table_sync s
         JOIN _basedb.field kf ON kf.id = s.key_field_id
         JOIN _basedb.physical_name kn ON kn.id = kf.name_id
         JOIN _basedb.base b ON b.id = s.base_id
         JOIN _basedb.tenant te ON te.id = b.tenant_id
        WHERE s.table_id = $1`,
      [tableId],
    )
    return row
  })
  if (found === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  const note = (status: 'ok' | 'failed', error: string | null, counts: unknown) =>
    pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.table_sync
            SET last_synced_at = pg_catalog.clock_timestamp(), last_status = $2, last_error = $3,
                last_counts = coalesce($4::jsonb, last_counts),
                next_sync_at = pg_catalog.clock_timestamp() + make_interval(mins => interval_minutes)
          WHERE table_id = $1`,
        [tableId, status, error, counts === null ? null : JSON.stringify(counts)],
        'update',
      ),
    )
  try {
    const url = unseal(instanceKey, PURPOSE, found.url_sealed)
    if (url === null)
      throw new BasedbError('SYNC_SOURCE_FAILED', { details: { reason: 'adresse_illisible' } })
    const data = await readSource(found.source_kind, url, targets)
    const counts = await apply(
      pools,
      systemContext(found.tenant_ref),
      tableId,
      found.key_field,
      found.columns,
      data,
    )
    await note('ok', null, counts)
    return counts
  } catch (error) {
    const reason =
      error instanceof BasedbError
        ? `${error.code}${typeof error.details.reason === 'string' ? ` : ${error.details.reason}` : ''}`
        : 'INTERNAL_ERROR'
    await note('failed', reason, null)
    throw error
  }
}

/** « Synchroniser maintenant », for whoever builds the base. */
export async function runSyncedTable(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly tableId: string },
): Promise<SyncedTable> {
  const [current] = await listSyncedTables(pools, ctx, request)
  if (current === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
  await syncTable(pools, instanceKey, targets, current.tableId)
  const [synced] = await listSyncedTables(pools, ctx, request)
  return synced as SyncedTable
}

/** The tables due, synchronised one after the other. */
export async function syncDue(
  pools: Pools,
  instanceKey: string,
  targets: TargetPolicy,
): Promise<number> {
  const due = await pools.withConnection('catalog', (exec) =>
    exec.query<{ table_id: string }>(
      `SELECT table_id::text FROM _basedb.table_sync
        WHERE next_sync_at <= pg_catalog.clock_timestamp() ORDER BY next_sync_at LIMIT 5`,
    ),
  )
  for (const { table_id } of due) {
    await syncTable(pools, instanceKey, targets, table_id).catch(() => undefined)
  }
  return due.length
}

/** The worker: the tables due, every `intervalMs`, never two passes at once. */
export function startSyncWorker(
  pools: Pools,
  instanceKey: () => string,
  targets: TargetPolicy,
  intervalMs: number,
  onError: (error: unknown) => void,
): () => void {
  let running = false
  const timer = setInterval(() => {
    if (running) return
    running = true
    syncDue(pools, instanceKey(), targets)
      .catch(onError)
      .finally(() => {
        running = false
      })
  }, intervalMs)
  return () => clearInterval(timer)
}
