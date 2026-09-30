import { createHmac } from 'node:crypto'
import { qualify, quoteIdentifier } from '@basedb/naming'
import { Pool, type PoolClient } from 'pg'
import { baseTargetOf, fieldsByTableOf, snapshot, targetFactory } from '../catalog/projection.js'
import { quoteLiteral } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { SYSTEM_COLUMNS, decide } from '../rbac/decide.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { startupOptions } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import {
  CONSOLE_DEFAULT_LIMIT,
  CONSOLE_MAX_LIMIT,
  CONSOLE_STATEMENT_TIMEOUT_MS,
  type SqlColumn,
  type SqlConsoleRequest,
  type SqlConsoleResult,
  asStatementError,
  audit,
  resolveTypes,
  uniqueKey,
} from './console.js'
import { readerPolicies } from './row-security.js'

/**
 * SQL for everyone who reads a base — read only, and with their own rights.
 *
 * The console (`console.ts`) is the reach of whoever manages a base's structure: all of its
 * schema, writes included. Everyone else runs SQL too, and there the field-by-field mask
 * is not bypassed: it is handed to PostgreSQL, which enforces it on every statement.
 *
 * 1. **A LOGIN role per person**, `basedb_reader_<id>`, with its own credentials derived
 *    from the instance key — for the console's reason: a `SET ROLE` on a product connection
 *    is undone by a `RESET ROLE` in the submitted text, an authenticated connection is not.
 *    One per person rather than one for all: grants follow the person's rights, and two
 *    people running at the same instant must not read through each other's.
 *
 * 2. **Its grants are the decider's verdict, column by column.** Before each call the owner
 *    brings them in line with what the person reads NOW: `SELECT` on the readable columns
 *    of each readable table, nothing on the others, `USAGE` on this base's schema alone.
 *    A field hidden from the person is a column PostgreSQL refuses them; a table they do
 *    not read, a relation they cannot touch. Only the differences are written, so a call
 *    that finds the rights unchanged grants nothing.
 *
 * 3. **The tables are shadowed by temporary views** of their readable columns, created in
 *    the statement's own transaction: `SELECT * FROM clients` then reads what the person
 *    may see instead of failing on the one column they may not. The temporary schema is
 *    searched first, so an unqualified name finds the view; a qualified one reaches the
 *    table itself, and the column grants answer.
 *
 * 4. **A READ ONLY transaction, one statement, rolled back.** The role holds no write
 *    privilege anyway; the transaction says so a second time, and the extended protocol
 *    refuses a second statement that would try to step out of it.
 *
 * The SQL views of the base (`catalog/sql-views.ts`) are created `security_invoker`: read
 * through them, a table answers with the reader's grants, not with their author's.
 */

/** Longest a role name may be is 63 bytes; this one is 46. */
function roleOf(userId: string): string {
  return `basedb_reader_${userId.replace(/-/g, '')}`
}

/** Derived from the instance key, like the console's: nothing to store, rotated with it. */
function passwordOf(instanceKey: string, userId: string): string {
  return createHmac('sha256', instanceKey).update(`basedb/reader-role/v1/${userId}`).digest('hex')
}

/** What a person reads of one base, as PostgreSQL names it. */
export interface Reach {
  readonly schema: string
  /** Readable table → its readable columns: the system ones and the readable fields'. */
  readonly tables: ReadonlyMap<string, ReadonlySet<string>>
  /** Readable table → the rows the person reaches, as the decider wrote them (05 §16). */
  readonly rows: ReadonlyMap<string, string>
}

/**
 * The person's reach over a base, decided by the decider — the same verdict the data
 * routes render, from the same snapshot.
 *
 * A base with no table they read, and no right on the base itself, does not exist for them.
 */
export async function readerReach(
  pools: Pools,
  ctx: RequestContext,
  baseId: string,
): Promise<Reach> {
  const { grants, raw } = await snapshot(pools, ctx)
  const base = raw.bases.find((b) => b.id === baseId)
  if (base === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })

  const fieldsByTable = fieldsByTableOf(raw)
  const targetOf = targetFactory(ctx, raw, fieldsByTable)
  const tables = new Map<string, ReadonlySet<string>>()
  const rows = new Map<string, string>()
  for (const table of raw.tables.filter((t) => t.base_id === baseId)) {
    const decision = decide(ctx, grants, 'read', targetOf(table))
    if (decision.verdict !== 'ALLOWED') continue
    rows.set(table.table_name, decision.rowPredicate)
    const columns = new Set<string>(SYSTEM_COLUMNS)
    for (const field of fieldsByTable.get(table.id) ?? []) {
      if (decision.readableFields.has(field.id)) columns.add(field.column)
    }
    tables.set(table.table_name, columns)
  }

  if (
    tables.size === 0 &&
    decide(ctx, grants, 'read', baseTargetOf(ctx, base)).verdict !== 'ALLOWED'
  ) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  }
  return { schema: base.schema_name, tables, rows }
}

/** A table to shadow: its name, and the readable columns it really has. */
interface Shadow {
  readonly table: string
  readonly columns: readonly string[]
}

/**
 * Brings the person's role in line with their reach, and says which tables to shadow.
 *
 * Run by the OWNER, serialized by one advisory lock: two `GRANT`s on the same relation in
 * two transactions can fail with "tuple concurrently updated", and this runs for everyone.
 * It holds the lock for a few catalog reads when nothing changed.
 */
async function provision(
  pools: Pools,
  ctx: RequestContext,
  role: string,
  password: string,
  reach: Reach,
  resetPassword: boolean,
): Promise<readonly Shadow[]> {
  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    await exec.query("SELECT pg_advisory_xact_lock(hashtext('basedb.reader-grants'))")

    const [known] = await exec.query<{ oid: string }>(
      'SELECT oid::text AS oid FROM pg_roles WHERE rolname = $1',
      [role],
    )
    // NOINHERIT and NOBYPASSRLS, as for the console: no privilege picked up from a group
    // the role might be put in, no row policy read past.
    const attributes =
      'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION'
    if (known === undefined) {
      await exec.query(
        `CREATE ROLE ${quoteIdentifier(role)} ${attributes} PASSWORD ${quoteLiteral(password)}`,
        [],
        'ddl',
      )
    } else if (resetPassword) {
      await exec.query(
        `ALTER ROLE ${quoteIdentifier(role)} WITH ${attributes} PASSWORD ${quoteLiteral(password)}`,
        [],
        'ddl',
      )
    }

    // A database whose owner took these from PUBLIC would otherwise refuse the role its
    // connection, or its shadows.
    if (known === undefined || resetPassword) {
      await exec.query(
        `DO $do$ BEGIN
           EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', current_database(), ${quoteLiteral(role)});
         END $do$;`,
        [],
        'ddl',
      )
    }

    // What the tables really hold: a field computed at read time has no column, and a
    // column the catalog does not describe is not one the person reads.
    const physical = await exec.query<{ relname: string; attname: string }>(
      `SELECT c.relname, a.attname
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = ANY($2::text[]) AND c.relkind IN ('r', 'p')
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY c.relname, a.attnum`,
      [reach.schema, [...reach.tables.keys()]],
    )
    const byTable = new Map<string, string[]>()
    for (const row of physical) {
      byTable.set(row.relname, [...(byTable.get(row.relname) ?? []), row.attname])
    }

    for (const statement of await grantsToWrite(exec, role, reach, byTable)) {
      await exec.query(statement, [], 'ddl')
    }
    // The rows, after the columns: PostgreSQL's row security holds the person's rules.
    for (const statement of await readerPolicies(exec, role, reach.schema, reach.rows)) {
      await exec.query(statement, [], 'ddl')
    }

    // Only a table with a column withheld needs a shadow: the others read whole.
    const shadows: Shadow[] = []
    for (const [table, readable] of reach.tables) {
      const all = byTable.get(table) ?? []
      const columns = all.filter((column) => readable.has(column))
      if (columns.length < all.length) shadows.push({ table, columns })
    }
    return shadows
  })
}

/**
 * The `GRANT`s and `REVOKE`s that make the role's privileges its reach — and nothing else:
 * a privilege held and still due is left alone.
 */
async function grantsToWrite(
  exec: Executor,
  role: string,
  reach: Reach,
  columnsOf: ReadonlyMap<string, readonly string[]>,
): Promise<string[]> {
  const who = quoteIdentifier(role)
  const statements: string[] = []

  // Every schema the role holds anything on, the one it is about to read excepted: what
  // was granted for another base an hour ago must not stay reachable by qualifying a name.
  const schemas = await exec.query<{ nspname: string }>(
    `SELECT DISTINCT n.nspname
       FROM pg_namespace n
       CROSS JOIN LATERAL aclexplode(n.nspacl) x
      WHERE x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
    [role],
  )
  for (const { nspname } of schemas) {
    if (nspname !== reach.schema) {
      statements.push(`REVOKE ALL ON SCHEMA ${quoteIdentifier(nspname)} FROM ${who}`)
    }
  }
  if (!schemas.some((s) => s.nspname === reach.schema)) {
    statements.push(`GRANT USAGE ON SCHEMA ${quoteIdentifier(reach.schema)} TO ${who}`)
  }

  // What it holds in this schema: on whole relations, and column by column.
  const held = await exec.query<{
    relname: string
    relkind: string
    attname: string | null
    privilege: string
  }>(
    `SELECT c.relname, c.relkind::text AS relkind, NULL::text AS attname, x.privilege_type AS privilege
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(c.relacl) x
      WHERE n.nspname = $2 AND x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)
     UNION ALL
     SELECT c.relname, c.relkind::text, a.attname, x.privilege_type
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE n.nspname = $2 AND x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)
        AND a.attnum > 0 AND NOT a.attisdropped`,
    [role, reach.schema],
  )

  // The SQL views of the schema: `SELECT` on the view, the tables answering beneath it.
  const views = new Set(
    (
      await exec.query<{ relname: string }>(
        `SELECT c.relname
           FROM _basedb.sql_view v
           JOIN _basedb.physical_name vn ON vn.id = v.name_id
           JOIN _basedb.db_schema s ON s.id = v.schema_id
           JOIN _basedb.physical_name sn ON sn.id = s.name_id
           JOIN pg_namespace n ON n.nspname = sn.name
           JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = vn.name AND c.relkind = 'v'
          WHERE sn.name = $1 AND v.broken_reason IS NULL`,
        [reach.schema],
      )
    ).map((v) => v.relname),
  )

  const revokeWhole = new Set<string>()
  const grantedColumns = new Map<string, Set<string>>()
  const grantedViews = new Set<string>()
  for (const row of held) {
    const readable = reach.tables.get(row.relname)
    if (row.attname === null) {
      if (views.has(row.relname) && row.privilege === 'SELECT') grantedViews.add(row.relname)
      else revokeWhole.add(row.relname)
      continue
    }
    if (readable === undefined) {
      revokeWhole.add(row.relname)
      continue
    }
    if (row.privilege === 'SELECT' && readable.has(row.attname)) {
      const set = grantedColumns.get(row.relname) ?? new Set<string>()
      set.add(row.attname)
      grantedColumns.set(row.relname, set)
    } else {
      statements.push(
        `REVOKE ${row.privilege} (${quoteIdentifier(row.attname)}) ON ${qualify(reach.schema, row.relname)} FROM ${who}`,
      )
    }
  }
  for (const relation of revokeWhole) {
    // Revoking on the relation revokes its column privileges with it.
    statements.push(`REVOKE ALL ON ${qualify(reach.schema, relation)} FROM ${who}`)
    grantedColumns.delete(relation)
    grantedViews.delete(relation)
  }

  // What is due and not held — among the columns the table really has: granting one it
  // does not would fail the whole call.
  for (const [table, readable] of reach.tables) {
    const granted = grantedColumns.get(table) ?? new Set<string>()
    const missing = (columnsOf.get(table) ?? []).filter((c) => readable.has(c) && !granted.has(c))
    if (missing.length > 0) {
      statements.push(
        `GRANT SELECT (${missing.map(quoteIdentifier).join(', ')}) ON ${qualify(reach.schema, table)} TO ${who}`,
      )
    }
  }
  for (const view of views) {
    if (!grantedViews.has(view)) {
      statements.push(`GRANT SELECT ON ${qualify(reach.schema, view)} TO ${who}`)
    }
  }
  return statements
}

/**
 * Runs a statement against ONE base, read only, with the caller's own rights.
 *
 * A person only: a token acts on the data routes, never on SQL.
 */
export async function runReaderSql(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string | undefined,
  connectionString: string,
  request: SqlConsoleRequest,
): Promise<SqlConsoleResult> {
  const sql = request.sql.trim()
  if (sql === '') {
    throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'sql', detail: 'vide' } })
  }
  if (ctx.actor.kind !== 'user') {
    throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
  }
  if (instanceKey === undefined || instanceKey === '') {
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'BASEDB_ENCRYPTION_KEY absente' },
    })
  }

  const limit = Math.min(Math.max(1, request.limit ?? CONSOLE_DEFAULT_LIMIT), CONSOLE_MAX_LIMIT)
  const reach = await readerReach(pools, ctx, request.baseId)
  const role = roleOf(ctx.actor.id)
  const password = passwordOf(instanceKey, ctx.actor.id)

  let shadows = await provision(pools, ctx, role, password, reach, false)
  const started = Date.now()
  let client: PoolClient | undefined
  try {
    try {
      client = await readerPool(connectionString, role, password, reach.schema).connect()
    } catch (error) {
      // The instance key changed since the role was made: its password follows it.
      if ((error as { code?: string }).code !== '28P01') throw error
      await dropReaderPool(role, reach.schema)
      shadows = await provision(pools, ctx, role, password, reach, true)
      client = await readerPool(connectionString, role, password, reach.schema).connect()
    }
    const who = await client.query<{ role: string }>('SELECT current_user AS role')
    if (who.rows[0]?.role !== role) {
      throw new BasedbError('INTERNAL_ERROR', {
        details: { reason: 'la lecture SQL n’est pas sur le rôle de la personne' },
      })
    }

    await client.query('BEGIN')
    if (shadows.length > 0) {
      await client.query(
        shadows
          .map(
            (s) =>
              `CREATE TEMPORARY VIEW ${quoteIdentifier(s.table)} AS SELECT ${s.columns
                .map(quoteIdentifier)
                .join(', ')} FROM ${qualify(reach.schema, s.table)};`,
          )
          .join('\n'),
      )
    }
    // After the shadows — creating them is a write — and before the statement. A
    // transaction may always turn read only; it cannot turn back once it has read.
    await client.query('SET TRANSACTION READ ONLY')
    // `queryMode` is not in `pg`'s types; the driver honours it all the same.
    const statement = { text: sql, rowMode: 'array' as const, queryMode: 'extended' as const }
    const result = (await client.query(statement)) as unknown as {
      fields?: ReadonlyArray<{ name: string; dataTypeID: number }>
      rows?: unknown[][]
      rowCount?: number | null
      command?: string
    }

    const fields = result.fields ?? []
    const typeNames = await resolveTypes(
      client,
      fields.map((f) => f.dataTypeID),
    )
    const columns: SqlColumn[] = fields.map((f, i) => ({
      name: f.name,
      dataType: typeNames[i] ?? String(f.dataTypeID),
    }))
    const all = result.rows ?? []
    const kept = all.slice(0, limit)
    const rows = kept.map((values) => {
      const row: Record<string, unknown> = {}
      columns.forEach((column, i) => {
        row[uniqueKey(row, column.name, i)] = values[i] ?? null
      })
      return row
    })

    const outcome: SqlConsoleResult = {
      columns,
      rows,
      rowCount: result.rowCount ?? all.length,
      command: String(result.command ?? 'SELECT'),
      durationMs: Date.now() - started,
      truncated: all.length > kept.length,
      schema: reach.schema,
      mode: 'reader',
    }
    await audit(pools, ctx, request.baseId, sql, outcome.command, outcome.rowCount, null, 'reader')
    return outcome
  } catch (error) {
    const refusal = asStatementError(error)
    await audit(pools, ctx, request.baseId, sql, null, null, refusal.code, 'reader')
    throw refusal
  } finally {
    if (client !== undefined) {
      // Everything the call made goes with it — the shadows too, even if the statement was
      // a bare `COMMIT` that saved them from the rollback.
      await client.query('ROLLBACK').catch(() => undefined)
      await client.query('DISCARD ALL').catch(() => undefined)
      client.release()
    }
  }
}

/**
 * One pool per (person, schema), kept for the process, its connections closed when idle.
 * `search_path` in the startup packet, for the reason the console gives.
 */
const readerPools = new Map<string, Pool>()

function readerPool(
  connectionString: string,
  role: string,
  password: string,
  schema: string,
): Pool {
  const key = `${role} ${schema}`
  const existing = readerPools.get(key)
  if (existing !== undefined) return existing

  const url = new URL(connectionString)
  url.username = role
  url.password = password
  const pool = new Pool({
    connectionString: url.toString(),
    max: 2,
    idleTimeoutMillis: 30_000,
    options: startupOptions({
      search_path: schema,
      statement_timeout: `${CONSOLE_STATEMENT_TIMEOUT_MS}ms`,
      idle_in_transaction_session_timeout: '30000ms',
    }),
    application_name: 'basedb:reader',
  })
  pool.on('error', () => undefined)
  readerPools.set(key, pool)
  return pool
}

async function dropReaderPool(role: string, schema: string): Promise<void> {
  const key = `${role} ${schema}`
  const pool = readerPools.get(key)
  readerPools.delete(key)
  await pool?.end().catch(() => undefined)
}

/** Closes the reader pools — called when the kernel shuts down. */
export async function closeReaderPools(): Promise<void> {
  const pools = [...readerPools.values()]
  readerPools.clear()
  await Promise.all(pools.map((p) => p.end().catch(() => undefined)))
}
