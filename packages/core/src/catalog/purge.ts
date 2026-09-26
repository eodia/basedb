import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { qualify, quoteIdentifier, slugify } from '@basedb/naming'
import { writeAudit } from '../audit/journal.js'
import { quoteLiteral } from '../ddl/emit.js'
import { type Migration, type MigrationStep, runMigration } from '../ddl/migration.js'
import { BasedbError } from '../errors/index.js'
import { loadGrants } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { TABLE_BATCH } from './lifecycle.js'
import { requireLifecycleAdmin } from './physical.js'

/**
 * The purge — chapter 06 §5: the one irreversible operation of the product.
 *
 * Everything here exists so that nobody sets it off by accident, and so that it can be
 * resumed when it is set off on purpose. Three guarantees stand before it (§5.1):
 *
 *   1. thirty days since the logical deletion — `PURGE_TOO_EARLY` otherwise, which only an
 *      instance administrator may shorten, with a justification written to the audit;
 *   2. an export, finished and verified: one CSV per table, and a manifest that counts
 *      the rows as they were written and fingerprints each file — `EXPORT_UNAVAILABLE`
 *      when it cannot be written, `EXPORT_STALE` when someone wrote since;
 *   3. the exact label, typed, with the row count of the manifest in front of the eyes —
 *      never a `count(*)` run when the screen opens.
 *
 * Then the tables are dropped, ten at a time, and their catalog rows become TOMBSTONES:
 * `purged_at` set, never deleted (A22). The registry keeps every name, `purged`, forever —
 * a purged name is never given to anything else. `DROP SCHEMA` is never `CASCADE`: a view
 * someone built in the schema makes it fail, and the base stays as `RESIDUAL_SCHEMA`, a
 * named state an operator deals with, rather than a silent destruction.
 */

/** §5.1: the minimal delay since `deleted_at`. */
export const PURGE_DELAY_DAYS = 30

/**
 * Past this many rows (estimated), the export is not run in a request: it belongs to a
 * background task this version does not have, and the refusal says so.
 */
export const EXPORT_MAX_ROWS = 2_000_000

const FETCH_ROWS = 1000

export interface DeletedTable {
  readonly id: string
  readonly label: string
  /** Its relegated physical name, `zz_supprime_<date>_<name>`. */
  readonly name: string
  readonly deletedAt: string
  readonly deletedBy: string | null
  /** When the thirty days are up. */
  readonly purgeableFrom: string
}

export interface ExportedTable {
  readonly id: string
  readonly label: string
  readonly name: string
  readonly file: string
  readonly rows: number
  readonly bytes: number
  readonly sha256: string
}

export interface PurgeExport {
  readonly id: string
  readonly directory: string
  readonly createdAt: string
  readonly totalRows: number
  readonly totalBytes: number
  readonly tables: readonly ExportedTable[]
}

export interface PurgeResult {
  readonly migration: Migration
  readonly purgedTables: number
  /** The base's schema could not be dropped: something unknown to basedb lives in it. */
  readonly residualSchema: boolean
}

type Target = {
  readonly kind: 'base' | 'table'
  readonly id: string
  readonly baseId: string
  readonly label: string
  readonly deletedAt: string
  readonly schemaId: string
  readonly schemaName: string
  readonly schemaNameId: string
  readonly tables: ReadonlyArray<{ id: string; label: string; name: string }>
}

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value)

/** A deleted object not yet purged — a live base's table, or a deleted base whole. */
async function loadTarget(
  exec: Executor,
  ctx: RequestContext,
  kind: 'base' | 'table',
  id: string,
): Promise<Target> {
  if (!isUuid(id)) throw new BasedbError('RESOURCE_NOT_FOUND')
  if (kind === 'base') {
    const [base] = await exec.query<{
      label: string
      deleted_at: string
      schema_id: string
      schema_name: string
      schema_name_id: string
    }>(
      `SELECT b.label, b.deleted_at::text, s.id::text AS schema_id, n.name AS schema_name,
              s.name_id::text AS schema_name_id
         FROM _basedb.base b
         JOIN _basedb.tenant t        ON t.id = b.tenant_id
         JOIN _basedb.db_schema s     ON s.base_id = b.id AND s.role = 'current'
                                     AND s.dropped_at IS NULL
         JOIN _basedb.physical_name n ON n.id = s.name_id
        WHERE b.id = $1 AND t.ref = $2 AND b.deleted_at IS NOT NULL AND NOT b.is_purged`,
      [id, ctx.tenantId],
    )
    if (base === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: id } })
    const tables = await exec.query<{ id: string; label: string; name: string }>(
      `SELECT t.id::text, t.label, n.name FROM _basedb.table_def t
         JOIN _basedb.physical_name n ON n.id = t.name_id
        WHERE t.base_id = $1 AND NOT t.is_purged ORDER BY t.position, t.id`,
      [id],
    )
    return {
      kind,
      id,
      baseId: id,
      label: base.label,
      deletedAt: base.deleted_at,
      schemaId: base.schema_id,
      schemaName: base.schema_name,
      schemaNameId: base.schema_name_id,
      tables,
    }
  }
  const [table] = await exec.query<{
    base_id: string
    label: string
    name: string
    deleted_at: string
    schema_id: string
    schema_name: string
    schema_name_id: string
  }>(
    `SELECT t.base_id::text, t.label, n.name, t.deleted_at::text, s.id::text AS schema_id,
            sn.name AS schema_name, s.name_id::text AS schema_name_id
       FROM _basedb.table_def t
       JOIN _basedb.physical_name n  ON n.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
       JOIN _basedb.base b           ON b.id = t.base_id
       JOIN _basedb.tenant te        ON te.id = b.tenant_id
      WHERE t.id = $1 AND te.ref = $2 AND t.deleted_at IS NOT NULL AND NOT t.is_purged
        AND b.is_live`,
    [id, ctx.tenantId],
  )
  if (table === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: id } })
  return {
    kind,
    id,
    baseId: table.base_id,
    label: table.label,
    deletedAt: table.deleted_at,
    schemaId: table.schema_id,
    schemaName: table.schema_name,
    schemaNameId: table.schema_name_id,
    tables: [{ id, label: table.label, name: table.name }],
  }
}

/** The deleted tables of a live base, not yet purged — the screen of deleted objects. */
export async function listDeletedTables(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<DeletedTable[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireLifecycleAdmin(exec, ctx, request.baseId)
      const rows = await exec.query<{
        id: string
        label: string
        name: string
        deleted_at: string
        deleted_by: string | null
      }>(
        `SELECT t.id::text, t.label, n.name, t.deleted_at::text, u.display_name AS deleted_by
           FROM _basedb.table_def t
           JOIN _basedb.physical_name n ON n.id = t.name_id
           JOIN _basedb.base b          ON b.id = t.base_id AND b.is_live
           JOIN _basedb.tenant te       ON te.id = b.tenant_id
           LEFT JOIN _basedb.app_user u ON u.id = t.deleted_by
          WHERE t.base_id = $1 AND te.ref = $2 AND t.deleted_at IS NOT NULL AND NOT t.is_purged
          ORDER BY t.deleted_at DESC`,
        [request.baseId, ctx.tenantId],
      )
      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        name: r.name,
        deletedAt: new Date(r.deleted_at).toISOString(),
        deletedBy: r.deleted_by,
        purgeableFrom: new Date(
          Date.parse(r.deleted_at) + PURGE_DELAY_DAYS * 86_400_000,
        ).toISOString(),
      }))
    },
    { readOnly: true },
  )
}

// ── The export (§5.2) ────────────────────────────────────────────────────────────

/** RFC 4180, with PostgreSQL's convention: NULL is an empty field, '' a quoted one. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text =
    value instanceof Date
      ? value.toISOString()
      : Buffer.isBuffer(value)
        ? `\\x${value.toString('hex')}`
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
  if (text === '') return '""'
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** What tells, at purge time, that nobody wrote since the export. */
type Fingerprint = { readonly rows: number; readonly maxXmin: string }

type Stats = { readonly n_tup_ins: string; readonly n_tup_upd: string; readonly n_tup_del: string }

async function statsOf(exec: Executor, schema: string, table: string): Promise<Stats | null> {
  // Read fresh: within a transaction, PostgreSQL would otherwise serve a cached snapshot.
  await exec.query('SELECT pg_stat_clear_snapshot()')
  const [row] = await exec.query<Stats>(
    `SELECT n_tup_ins::text, n_tup_upd::text, n_tup_del::text
       FROM pg_stat_user_tables WHERE schemaname = $1 AND relname = $2`,
    [schema, table],
  )
  return row ?? null
}

async function fingerprintOf(exec: Executor, schema: string, table: string): Promise<Fingerprint> {
  const [row] = await exec.query<{ rows: string; max_xmin: string }>(
    `SELECT count(*)::text AS rows, coalesce(max(xmin::text::bigint), 0)::text AS max_xmin
       FROM ${qualify(schema, table)}`,
  )
  return { rows: Number(row?.rows ?? 0), maxXmin: row?.max_xmin ?? '0' }
}

/** Streams one table to a CSV file, counting and hashing as it writes. */
async function exportTable(
  exec: Executor,
  schema: string,
  table: string,
  path: string,
): Promise<{ rows: number; sha256: string; fingerprint: Fingerprint }> {
  const columns = (
    await exec.query<{ name: string }>(
      `SELECT a.attname AS name FROM pg_attribute a
        WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum`,
      [qualify(schema, table)],
    )
  ).map((c) => c.name)

  const hash = createHash('sha256')
  const out = createWriteStream(path, { encoding: 'utf8' })
  const write = (line: string) =>
    new Promise<void>((resolve, reject) => {
      hash.update(line)
      out.write(line, (error) => (error ? reject(error) : resolve()))
    })

  let rows = 0
  let maxXmin = 0n
  try {
    await write(`${columns.map(csvCell).join(',')}\r\n`)
    // A cursor reads under ONE snapshot: the rows counted, hashed and fingerprinted are
    // the same rows, whatever is written meanwhile.
    await exec.query(
      `DECLARE basedb_export NO SCROLL CURSOR FOR
         SELECT xmin::text::bigint AS "__basedb_xmin", * FROM ${qualify(schema, table)}
          ORDER BY "_id"`,
    )
    for (;;) {
      const batch = await exec.query<Record<string, unknown>>(
        `FETCH ${FETCH_ROWS} FROM basedb_export`,
      )
      if (batch.length === 0) break
      let chunk = ''
      for (const row of batch) {
        const xmin = BigInt(String(row.__basedb_xmin))
        if (xmin > maxXmin) maxXmin = xmin
        chunk += `${columns.map((c) => csvCell(row[c])).join(',')}\r\n`
      }
      await write(chunk)
      rows += batch.length
    }
    await exec.query('CLOSE basedb_export')
  } finally {
    await new Promise<void>((resolve) => out.end(resolve))
  }
  return { rows, sha256: hash.digest('hex'), fingerprint: { rows, maxXmin: String(maxXmin) } }
}

/**
 * Exports what a purge would destroy — §5.2. One CSV per table, and a manifest: the
 * catalog extract, the exact row counts, each file's SHA-256, the size of each table and
 * its statistics at the start. The files are never deleted by basedb.
 */
export async function exportForPurge(
  pools: Pools,
  ctx: RequestContext,
  exportDir: string | undefined,
  request: { readonly kind: 'base' | 'table'; readonly id: string },
): Promise<PurgeExport> {
  const target = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const found = await loadTarget(exec, ctx, request.kind, request.id)
      await requireLifecycleAdmin(exec, ctx, found.baseId)
      return found
    },
    { readOnly: true },
  )
  if (exportDir === undefined || exportDir === '') {
    throw new BasedbError('EXPORT_UNAVAILABLE', { details: { reason: 'repertoire_absent' } })
  }

  const at = ctx.timestamp
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')
  const slug = slugify(target.label, { max: 40, nature: 'table' }).slug
  const directory = join(
    exportDir,
    ctx.tenantId,
    `${stamp}-${target.kind}-${slug}-${target.id.slice(0, 8)}`,
  )
  try {
    await mkdir(directory, { recursive: true })
  } catch (error) {
    throw new BasedbError('EXPORT_UNAVAILABLE', {
      details: { reason: 'repertoire_inaccessible', directory },
      cause: error,
    })
  }

  const exported = await withTransaction(
    pools,
    'data',
    ctx,
    async (exec) => {
      // Estimated first: past the cap, nothing is written at all.
      const [estimate] = await exec.query<{ rows: number }>(
        `SELECT coalesce(sum(greatest(c.reltuples, 0)), 0)::float8 AS rows
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = ANY($2::text[])`,
        [target.schemaName, target.tables.map((t) => t.name)],
      )
      if ((estimate?.rows ?? 0) > EXPORT_MAX_ROWS) {
        throw new BasedbError('EXPORT_UNAVAILABLE', {
          details: { reason: 'trop_volumineux', maximum: EXPORT_MAX_ROWS },
        })
      }
      const out = []
      for (const table of target.tables) {
        const stats = await statsOf(exec, target.schemaName, table.name)
        const [size] = await exec.query<{ bytes: number }>(
          'SELECT pg_total_relation_size($1::regclass)::float8 AS bytes',
          [qualify(target.schemaName, table.name)],
        )
        const file = `${table.name}.csv`
        let written: Awaited<ReturnType<typeof exportTable>>
        try {
          written = await exportTable(exec, target.schemaName, table.name, join(directory, file))
        } catch (error) {
          if (error instanceof BasedbError) throw error
          throw new BasedbError('EXPORT_UNAVAILABLE', {
            details: { reason: 'ecriture', file },
            cause: error,
          })
        }
        out.push({ ...table, file, bytes: size?.bytes ?? 0, stats, ...written })
      }
      return out
    },
    { readOnly: true, isolation: 'repeatable read', retries: 0 },
  )

  const catalog = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) =>
      exec.query<Record<string, unknown>>(
        `SELECT t.id, t.label, tn.name, t.deleted_at,
                (SELECT coalesce(jsonb_agg(jsonb_build_object(
                          'id', f.id, 'label', f.label, 'name', fn.name, 'kind', f.kind,
                          'deleted_at', f.deleted_at) ORDER BY f.position), '[]'::jsonb)
                   FROM _basedb.field f JOIN _basedb.physical_name fn ON fn.id = f.name_id
                  WHERE f.table_id = t.id) AS fields
           FROM _basedb.table_def t JOIN _basedb.physical_name tn ON tn.id = t.name_id
          WHERE t.id = ANY($1::uuid[])`,
        [target.tables.map((t) => t.id)],
      ),
    { readOnly: true },
  )

  const manifest = {
    format: 1,
    tenant: ctx.tenantId,
    kind: target.kind,
    target: { id: target.id, label: target.label, deleted_at: target.deletedAt },
    base_id: target.baseId,
    schema: target.schemaName,
    created_at: at.toISOString(),
    catalog,
    tables: exported.map((t) => ({
      id: t.id,
      label: t.label,
      name: t.name,
      file: t.file,
      rows: t.rows,
      sha256: t.sha256,
      bytes: t.bytes,
      stats: t.stats,
      fingerprint: t.fingerprint,
    })),
  }
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  try {
    await writeFile(join(directory, 'manifest.json'), manifestText, 'utf8')
  } catch (error) {
    throw new BasedbError('EXPORT_UNAVAILABLE', {
      details: { reason: 'ecriture', file: 'manifest.json' },
      cause: error,
    })
  }

  const totalRows = exported.reduce((n, t) => n + t.rows, 0)
  const id = randomUUID()
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await exec.query(
      `INSERT INTO _basedb.purge_export
         (id, tenant_id, base_id, table_id, directory, manifest, total_rows, created_by)
       SELECT $1, t.id, $2, $3, $4, $5::jsonb, $6, $7 FROM _basedb.tenant t WHERE t.ref = $8`,
      [
        id,
        target.baseId,
        target.kind === 'table' ? target.id : null,
        directory,
        JSON.stringify(manifest),
        totalRows,
        ctx.actor.id,
        ctx.tenantId,
      ],
      'insert',
    )
    await writeAudit(exec, ctx, {
      action: 'purge.export',
      objectKind: target.kind,
      objectId: target.id,
      objectName: target.label,
      baseId: target.baseId,
      payload: { export: id, directory, rows: totalRows },
    })
  })

  return {
    id,
    directory,
    createdAt: at.toISOString(),
    totalRows,
    totalBytes: exported.reduce((n, t) => n + t.bytes, 0),
    tables: exported.map((t) => ({
      id: t.id,
      label: t.label,
      name: t.name,
      file: t.file,
      rows: t.rows,
      bytes: t.bytes,
      sha256: t.sha256,
    })),
  }
}

// ── The purge (§5.3) ─────────────────────────────────────────────────────────────

type ManifestTable = {
  readonly id: string
  readonly name: string
  readonly file: string
  readonly sha256: string
  readonly fingerprint: Fingerprint
}

/** The catalog of one table becomes a tombstone: `purged_at` everywhere, names `purged`. */
function tombstone(
  schema: string,
  table: { id: string; name: string },
  stamp: string,
  actor: string,
) {
  const id = `${quoteLiteral(table.id)}::uuid`
  return [
    `DROP TABLE IF EXISTS ${qualify(schema, table.name)} RESTRICT;`,
    // Formulas first: `ck_dep_purge_order` wants a formula purged no later than its inputs.
    `UPDATE _basedb.field SET purged_at = ${stamp}::timestamptz, purged_by = ${actor}::uuid, is_purged = true
 WHERE table_id = ${id} AND NOT is_purged AND kind = 'formula';`,
    `UPDATE _basedb.field SET purged_at = ${stamp}::timestamptz, purged_by = ${actor}::uuid, is_purged = true
 WHERE table_id = ${id} AND NOT is_purged;`,
    `UPDATE _basedb.table_index
   SET state = 'dropped', dropped_at = coalesce(dropped_at, ${stamp}::timestamptz),
       state_changed_at = ${stamp}::timestamptz
 WHERE table_id = ${id} AND state <> 'dropped';`,
    `UPDATE _basedb.table_constraint
   SET state = 'dropped', dropped_at = coalesce(dropped_at, ${stamp}::timestamptz),
       state_changed_at = ${stamp}::timestamptz
 WHERE table_id = ${id} AND state <> 'dropped';`,
    // Every name the table carried — its own, its fields', its indexes', its
    // constraints', its triggers' — stays in the registry, `purged`, for good.
    `UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = ${stamp}::timestamptz
 WHERE state <> 'purged' AND (
       scope_id = ${id}
    OR id IN (SELECT name_id FROM _basedb.table_def WHERE id = ${id})
    OR id IN (SELECT name_id FROM _basedb.table_index WHERE table_id = ${id})
    OR id IN (SELECT name_id FROM _basedb.table_constraint WHERE table_id = ${id}));`,
    `UPDATE _basedb.table_def
   SET purged_at = ${stamp}::timestamptz, purged_by = ${actor}::uuid, is_purged = true
 WHERE id = ${id};`,
  ]
}

/**
 * Purges a deleted table, or a deleted base whole — §5.3. Administration only, never
 * from the agent surface; thirty days after the deletion; after an export that nobody
 * has written past; with the label typed in full.
 */
export async function purge(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly kind: 'base' | 'table'
    readonly id: string
    readonly exportId: string
    readonly confirm: string
    /** An instance administrator's shortcut past the thirty days — justified, audited. */
    readonly early?: { readonly justification: string }
  },
): Promise<PurgeResult> {
  if (ctx.surface === 'mcp') throw new BasedbError('MCP_OPERATION_EXCLUDED')

  const planned = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const target = await loadTarget(exec, ctx, request.kind, request.id)
    await requireLifecycleAdmin(exec, ctx, target.baseId)

    if (request.confirm !== target.label) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'confirm', reason: 'saisir_le_libelle' },
      })
    }

    // Guarantee 1 — the delay, or a justified shortcut by an instance administrator.
    const due = Date.parse(target.deletedAt) + PURGE_DELAY_DAYS * 86_400_000
    const early = Date.now() < due
    if (early) {
      const grants = await loadGrants(exec, ctx)
      const justification = request.early?.justification?.trim() ?? ''
      if (!grants.isInstanceAdmin || justification === '') {
        throw new BasedbError('PURGE_TOO_EARLY', {
          details: { purgeable_from: new Date(due).toISOString() },
        })
      }
    }

    // Guarantee 2 — the export: this target's, unused, its files intact.
    if (!isUuid(request.exportId)) throw new BasedbError('EXPORT_UNAVAILABLE')
    const [exported] = await exec.query<{
      directory: string
      manifest: { tables: ManifestTable[] }
      total_rows: string
    }>(
      `SELECT e.directory, e.manifest, e.total_rows::text FROM _basedb.purge_export e
         JOIN _basedb.tenant t ON t.id = e.tenant_id
        WHERE e.id = $1 AND t.ref = $2 AND e.used_at IS NULL AND e.base_id = $3
          AND e.table_id IS NOT DISTINCT FROM $4`,
      [request.exportId, ctx.tenantId, target.baseId, target.kind === 'table' ? target.id : null],
    )
    if (exported === undefined) {
      throw new BasedbError('EXPORT_UNAVAILABLE', { details: { reason: 'export_inconnu' } })
    }
    const listed = new Map(exported.manifest.tables.map((t) => [t.id, t]))
    for (const table of target.tables) {
      const entry = listed.get(table.id)
      // A table deleted since the export, into this base: it was not exported.
      if (entry === undefined)
        throw new BasedbError('EXPORT_STALE', { details: { table: table.name } })
      let content: Buffer
      try {
        content = await readFile(join(exported.directory, entry.file))
      } catch (error) {
        throw new BasedbError('EXPORT_UNAVAILABLE', {
          details: { reason: 'fichier_absent', file: entry.file },
          cause: error,
        })
      }
      if (createHash('sha256').update(content).digest('hex') !== entry.sha256) {
        throw new BasedbError('EXPORT_UNAVAILABLE', {
          details: { reason: 'fichier_altere', file: entry.file },
        })
      }
      // Anyone who wrote since — directly in SQL, the schema is open to them — moved the
      // row count or the newest `xmin`: the export no longer holds what is destroyed.
      const now = await fingerprintOf(exec, target.schemaName, table.name)
      if (now.rows !== entry.fingerprint.rows || now.maxXmin !== entry.fingerprint.maxXmin) {
        throw new BasedbError('EXPORT_STALE', { details: { table: table.name } })
      }
      // And nothing built on it outside the catalog: `DROP … RESTRICT` would fail mid-plan.
      const [dependent] = await exec.query<{ name: string }>(
        `SELECT dn.nspname || '.' || dc.relname AS name
           FROM pg_depend d
           JOIN pg_rewrite r    ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
           JOIN pg_class dc     ON dc.oid = r.ev_class
           JOIN pg_namespace dn ON dn.oid = dc.relnamespace
          WHERE d.refclassid = 'pg_class'::regclass
            AND d.refobjid = $1::regclass AND dc.oid <> d.refobjid
          LIMIT 1`,
        [qualify(target.schemaName, table.name)],
      )
      if (dependent !== undefined) {
        throw new BasedbError('DEPENDENT_OBJECT', {
          details: { dependent: dependent.name, referenced: table.name },
        })
      }
    }

    const stamp = quoteLiteral(ctx.timestamp.toISOString())
    const actor = quoteLiteral(ctx.actor.id)
    const steps: MigrationStep[] = []
    if (target.kind === 'base') {
      // Frozen for the whole operation: no restoration, no other structure change (§5.3).
      steps.push({
        label: 'Geler la structure de la base',
        lock: 'none',
        statements: [
          `UPDATE _basedb.base SET structure_state = 'frozen' WHERE id = ${quoteLiteral(target.baseId)}::uuid;`,
        ],
      })
    }
    for (let i = 0; i < target.tables.length; i += TABLE_BATCH) {
      const batch = target.tables.slice(i, i + TABLE_BATCH)
      steps.push({
        label: `Détruire ${batch.length} table${batch.length > 1 ? 's' : ''}`,
        lock: 'exclusive',
        statements: batch.flatMap((t) => tombstone(target.schemaName, t, stamp, actor)),
      })
    }
    if (target.kind === 'base') {
      const dropSchema = `DROP SCHEMA ${quoteIdentifier(target.schemaName)} RESTRICT`
      steps.push({
        label: `Détruire le schéma ${target.schemaName}`,
        lock: 'short',
        statements: [
          // An object unknown to basedb in the schema: the tables are gone, which cannot
          // be undone, and the schema stays — RESIDUAL_SCHEMA, visible, for an operator.
          `DO $purge$
BEGIN
  EXECUTE ${quoteLiteral(dropSchema)};
  UPDATE _basedb.db_schema SET dropped_at = ${stamp}::timestamptz
   WHERE id = ${quoteLiteral(target.schemaId)}::uuid;
  UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = ${stamp}::timestamptz
   WHERE id = ${quoteLiteral(target.schemaNameId)}::uuid;
EXCEPTION WHEN dependent_objects_still_exist THEN
  NULL;
END
$purge$;`,
          `UPDATE _basedb.base
   SET purged_at = ${stamp}::timestamptz, purged_by = ${actor}::uuid, is_purged = true
 WHERE id = ${quoteLiteral(target.baseId)}::uuid;`,
        ],
      })
    }
    await exec.query(
      'UPDATE _basedb.purge_export SET used_at = clock_timestamp(), used_by = $2 WHERE id = $1',
      [request.exportId, ctx.actor.id],
      'update',
    )
    if (early) {
      await writeAudit(exec, ctx, {
        action: 'purge.early',
        objectKind: target.kind,
        objectId: target.id,
        objectName: target.label,
        baseId: target.baseId,
        payload: {
          purgeable_from: new Date(due).toISOString(),
          justification: request.early?.justification ?? '',
        },
      })
    }
    return { target, steps, rows: Number(exported.total_rows), directory: exported.directory }
  })

  const migration = await runMigration(pools, ctx, {
    baseId: planned.target.baseId,
    label: `Purge ${planned.target.kind === 'base' ? 'de la base' : 'de la table'} « ${planned.target.label} »`,
    origin: ctx.surface === 'rest' ? 'rest' : 'ui',
    steps: planned.steps,
    catalogDiff: {
      operation: `purge_${planned.target.kind}`,
      target: planned.target.label,
      tables: planned.target.tables.map((t) => t.name),
      export: request.exportId,
    },
    affectedObjects: planned.target.tables.map((t) => ({
      kind: 'table',
      name: t.name,
      label: t.label,
    })),
  })

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [schema] = await exec.query<{ dropped: boolean }>(
      'SELECT dropped_at IS NOT NULL AS dropped FROM _basedb.db_schema WHERE id = $1',
      [planned.target.schemaId],
    )
    const residual = planned.target.kind === 'base' && schema?.dropped !== true
    await writeAudit(exec, ctx, {
      action: `purge.${planned.target.kind}`,
      objectKind: planned.target.kind,
      objectId: planned.target.id,
      objectName: planned.target.label,
      baseId: planned.target.baseId,
      payload: {
        export: request.exportId,
        directory: planned.directory,
        rows: planned.rows,
        tables: planned.target.tables.map((t) => t.name),
        residual_schema: residual,
      },
    })
    return { migration, purgedTables: planned.target.tables.length, residualSchema: residual }
  })
}
