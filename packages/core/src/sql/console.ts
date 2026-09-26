import { createHmac } from 'node:crypto'
import { quoteIdentifier } from '@basedb/naming'
import { Pool, type PoolClient } from 'pg'
import { quoteLiteral } from '../ddl/emit.js'
import { BasedbError, translatePgError } from '../errors/index.js'
import { TENANT_SCOPE } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { startupOptions } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The SQL console.
 *
 * **This contradicts a documented decision of the product, deliberately and on the
 * owner's instruction.** Chapter 09 §1 refuses `execute_sql` "même en lecture seule",
 * and chapter 10 §2.2 states that no adapter holds anything able to run a SQL string.
 * The reasons given there are sound and they still apply: arbitrary SQL bypasses the
 * field-by-field mask, makes the audit log uninterpretable — one no longer knows what
 * was read — and admits no volume bound. Nothing below repairs that; it bounds the
 * damage instead.
 *
 * Three guards, and only the first one is real:
 *
 * 1. **A separate PostgreSQL LOGIN role**, `basedb_console`, with its own credentials.
 *    Not `SET ROLE` on the product's connection — a `RESET ROLE` inside the submitted
 *    statement, or inside a `DO $$ … $$` block, would undo that in one line. A distinct
 *    authenticated connection cannot be talked out of its identity.
 *
 *    That role starts with access to NOTHING: PostgreSQL grants no privilege on a new
 *    schema or table to `PUBLIC`, so `_basedb` — password hashes, session tokens, sealed
 *    secrets — is out of reach by default rather than by a blocklist. Before each call
 *    the owner grants exactly one base schema to it and revokes every other.
 *
 * 2. **No `CREATE`.** `SELECT`, `INSERT`, `UPDATE`, `DELETE`. A table created here would
 *    exist in PostgreSQL and not in the catalog, which chapter 06 §7 calls a drift and
 *    treats as an incident. Structure changes keep going through the schema editor,
 *    where they become a migration.
 *
 * 3. **A statement timeout and a row cap**, so that one paste cannot hold a connection
 *    or return a million rows into a browser.
 *
 * Every call is written to `audit_log` with the statement, because the one thing that
 * can still be said about what was read is *who ran what*.
 */

/** The role the console connects as. One per instance, never per user. */
const CONSOLE_ROLE = 'basedb_console'

/** Rows returned by default, and the ceiling a caller may raise it to. */
export const CONSOLE_DEFAULT_LIMIT = 500
export const CONSOLE_MAX_LIMIT = 5_000

/** Long enough for an honest query, short enough that a mistake is not an outage. */
const CONSOLE_STATEMENT_TIMEOUT_MS = 15_000

export interface SqlConsoleRequest {
  readonly baseId: string
  readonly sql: string
  readonly limit?: number
  /**
   * One statement, in a `READ ONLY` transaction — what the copilot runs to read, with
   * nobody reviewing the text before it executes. The console itself never sets it.
   */
  readonly readOnly?: boolean
}

export interface SqlColumn {
  readonly name: string
  /** PostgreSQL type name, as `\d` would print it. */
  readonly dataType: string
}

/**
 * What the driver hands back for a console statement.
 *
 * Declared here rather than imported: `pg` types a multi-statement simple query as one
 * result, and it is in fact an array of them. The cast is at the single call site, and
 * this shape says what that site actually reads.
 */
interface ConsoleQueryResult {
  readonly fields?: ReadonlyArray<{ name: string; dataTypeID: number }>
  readonly rows?: readonly unknown[][]
  readonly rowCount?: number | null
  readonly command?: string
}

export interface SqlConsoleResult {
  readonly columns: readonly SqlColumn[]
  readonly rows: ReadonlyArray<Record<string, unknown>>
  /** Rows the statement touched — its own count, not the number returned. */
  readonly rowCount: number
  /** `SELECT`, `INSERT`, `UPDATE`… as PostgreSQL reports it. */
  readonly command: string
  readonly durationMs: number
  /** True when the row cap cut the result short. */
  readonly truncated: boolean
  /** The schema the statement ran against, unqualified names included. */
  readonly schema: string
}

/**
 * Runs a statement against ONE base's schema.
 *
 * `manage_schema` over that base is required: someone who can already add and drop its
 * columns can already read everything in it, so the console gives them no reach they did
 * not have. It gives an ordinary reader a great deal, which is why an ordinary reader
 * does not get it.
 */
export async function runConsoleSql(
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
  if (instanceKey === undefined || instanceKey === '') {
    // The console's credentials are derived from the instance key. Without it there is
    // no way to hold a restricted role, and running unrestricted is not an option.
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'BASEDB_ENCRYPTION_KEY absente' },
    })
  }

  const limit = Math.min(Math.max(1, request.limit ?? CONSOLE_DEFAULT_LIMIT), CONSOLE_MAX_LIMIT)

  // ── Decision and scope, on the catalog ────────────────────────────────────
  const scope = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      const allowed =
        grants.isInstanceAdmin ||
        grants.roles.some((role) =>
          role.permissions.some(
            (p) =>
              p.action === 'manage_schema' &&
              ((p.scopeKind === 'tenant' && p.scopeId === TENANT_SCOPE) ||
                (p.scopeKind === 'base' && p.scopeId === request.baseId)),
          ),
        )
      if (!allowed) {
        throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
      }

      const [target] = await exec.query<{ name: string; label: string }>(
        `SELECT n.name, b.label
           FROM _basedb.base b
           JOIN _basedb.db_schema s ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
           JOIN _basedb.physical_name n ON n.id = s.name_id
           JOIN _basedb.tenant t ON t.id = b.tenant_id
          WHERE b.id = $1 AND b.deleted_at IS NULL AND t.ref = $2`,
        [request.baseId, ctx.tenantId],
      )
      if (target === undefined) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: request.baseId } })
      }

      // Every OTHER schema of this tenant, so the grants can be narrowed to one.
      const others = await exec.query<{ name: string }>(
        `SELECT n.name
           FROM _basedb.db_schema s
           JOIN _basedb.physical_name n ON n.id = s.name_id
           JOIN _basedb.base b ON b.id = s.base_id
          WHERE s.dropped_at IS NULL AND n.name <> $1`,
        [target.name],
      )

      return { schema: target.name, label: target.label, others: others.map((o) => o.name) }
    },
    { readOnly: true },
  )

  const password = consolePassword(instanceKey)
  await provision(pools, ctx, scope.schema, scope.others, password)

  // ── Execution, as the restricted role ─────────────────────────────────────
  const pool = consolePool(connectionString, password, scope.schema)
  const started = Date.now()
  let client: PoolClient | undefined
  try {
    client = await pool.connect()
    // Belt and braces: the pool is opened as `basedb_console`, and this refuses to run
    // if anything ever hands back a connection that is not.
    const who = await client.query<{ role: string }>('SELECT current_user AS role')
    if (who.rows[0]?.role !== CONSOLE_ROLE) {
      throw new BasedbError('INTERNAL_ERROR', {
        details: { reason: 'la console n’est pas sur son rôle restreint' },
      })
    }

    // The history must say WHO wrote through the console, not "a direct SQL session":
    // the person is known here. Session-level, since the statement may run its own
    // `BEGIN` / `COMMIT` — and reset below, the connection being pooled. Not a security
    // boundary (07 §2.3): a statement could change them, and would only lie about itself.
    await client.query(
      `SELECT set_config('basedb.actor_kind', 'user', false),
              set_config('basedb.actor_id', $1, false),
              set_config('basedb.surface', 'rest', false)`,
      [ctx.actor.id],
    )

    // No transaction wrapper: a console must be able to run `BEGIN` / `COMMIT` itself,
    // and wrapping would make the submitted text a nested transaction it cannot control.
    //
    // Except in READ ONLY mode — a statement no person typed, the copilot's. There the
    // wrapper IS the guarantee: a `READ ONLY` transaction refuses any write, down to one
    // hidden in a CTE or a function, and the EXTENDED protocol refuses a second statement,
    // so a `COMMIT; DELETE …` cannot step out of it. The `ROLLBACK` below closes it.
    if (request.readOnly === true) await client.query('BEGIN TRANSACTION READ ONLY')
    const raw = (await client.query({
      text: sql,
      rowMode: 'array' as const,
      ...(request.readOnly === true ? { queryMode: 'extended' as const } : {}),
    })) as unknown as ConsoleQueryResult | ConsoleQueryResult[]
    const results: ConsoleQueryResult[] = Array.isArray(raw) ? raw : [raw]
    // Several statements separated by `;` come back as several results. The LAST one
    // carrying columns is the one shown — that is what a console user expects from
    // `DELETE …; SELECT …;`.
    const last = [...results].reverse().find((r) => (r.fields?.length ?? 0) > 0) ?? results.at(-1)
    if (last === undefined) {
      throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'aucun résultat' } })
    }

    const fields = last.fields ?? []
    const typeNames = await resolveTypes(
      client,
      fields.map((f) => f.dataTypeID),
    )
    const columns: SqlColumn[] = fields.map((f, i) => ({
      name: f.name,
      dataType: typeNames[i] ?? String(f.dataTypeID),
    }))

    const all = (last.rows ?? []) as unknown[][]
    const kept = all.slice(0, limit)
    const rows = kept.map((values) => {
      const row: Record<string, unknown> = {}
      // Positional, not by name: `SELECT 1 AS a, 2 AS a` is legal SQL, and building the
      // object by name would silently drop a column the grid is about to display.
      columns.forEach((column, i) => {
        row[uniqueKey(row, column.name, i)] = values[i] ?? null
      })
      return row
    })

    const outcome = {
      columns,
      rows,
      rowCount: last.rowCount ?? all.length,
      command: String(last.command ?? 'SELECT'),
      durationMs: Date.now() - started,
      truncated: all.length > kept.length,
      schema: scope.schema,
    }

    await audit(pools, ctx, request.baseId, sql, outcome.command, outcome.rowCount, null)
    return outcome
  } catch (error) {
    const refusal = asStatementError(error)
    await audit(pools, ctx, request.baseId, sql, null, null, refusal.code)
    throw refusal
  } finally {
    if (client !== undefined) {
      // What the statement left behind goes with it: an open transaction, and the identity
      // set above, which must not follow the connection to the next caller.
      await client.query('ROLLBACK').catch(() => undefined)
      await client
        .query(
          "SELECT set_config('basedb.actor_kind', '', false), set_config('basedb.actor_id', '', false)",
        )
        .catch(() => undefined)
    }
    client?.release()
  }
}

/**
 * Turns a failure into something a console user can act on.
 *
 * This is the ONE place in the product where a raw PostgreSQL message crosses the
 * boundary, and it is a considered exception rather than an oversight. Chapter 05's
 * disclosure rule exists so that a message cannot describe an object the reader has no
 * right to see; here the reader holds `manage_schema` over the schema they are querying,
 * and they wrote the statement themselves. "column « nom » does not exist,
 * LINE 1: SELECT nom…" IS the answer. A named code alone would make the tool useless,
 * and people would go run their query in psql instead — which is worse, not better.
 *
 * A failure WITHOUT a SQLSTATE is not the statement's fault — a lost connection, a pool
 * that could not be opened — and falls back to the ordinary translation, which discloses
 * nothing.
 */
function asStatementError(error: unknown): BasedbError {
  if (error instanceof BasedbError) return error

  const pg = error as {
    code?: string
    message?: string
    detail?: string
    hint?: string
    position?: string
  }
  if (typeof pg.code !== 'string' || !/^[0-9A-Z]{5}$/.test(pg.code)) {
    return translatePgError(pg, 'select')
  }

  return new BasedbError('REQUEST_INVALID', {
    cause: error,
    details: {
      parameter: 'sql',
      sqlstate: pg.code,
      message: pg.message ?? null,
      detail: pg.detail ?? null,
      hint: pg.hint ?? null,
      // A character offset, so the editor can put the caret on the offending token.
      position: pg.position === undefined ? null : Number(pg.position),
    },
  })
}

/** Two identical column names must not collapse into one key. */
function uniqueKey(row: Record<string, unknown>, name: string, index: number): string {
  if (!(name in row)) return name
  return `${name}__${index}`
}

/**
 * The console role's password, DERIVED from the instance key.
 *
 * Derived rather than stored: every process computes the same value without a shared
 * secret table, a rotation of the instance key rotates it, and a database dump contains
 * no credential — the key lives outside the database (A25).
 */
function consolePassword(instanceKey: string): string {
  return createHmac('sha256', instanceKey).update('basedb/console-role/v1').digest('hex')
}

/**
 * Creates the role if needed, and narrows its grants to the one target schema.
 *
 * Run by the OWNER, before every call. Re-granting each time looks wasteful; it is what
 * makes the role's reach a function of the request rather than of the history of
 * requests — a schema granted for a base the caller visited an hour ago would otherwise
 * still be readable.
 */
async function provision(
  pools: Pools,
  ctx: RequestContext,
  schema: string,
  others: readonly string[],
  password: string,
): Promise<void> {
  await pools.withConnection('ddl', async (exec) => {
    await exec.query(
      `DO $do$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(CONSOLE_ROLE)}) THEN
           EXECUTE 'CREATE ROLE ' || quote_ident(${quoteLiteral(CONSOLE_ROLE)});
         END IF;
       END
       $do$;`,
      [],
      'ddl',
    )

    // NOINHERIT and NOBYPASSRLS are not decoration: the first stops the role picking up
    // privileges from any group it might be put in, the second stops it reading past a
    // row policy the product may add later.
    await exec.query(
      `ALTER ROLE ${quoteIdentifier(CONSOLE_ROLE)}
         WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
         PASSWORD ${quoteLiteral(password)}`,
      [],
      'ddl',
    )

    // Defensive, and cheap: PostgreSQL grants nothing on these by default, so this
    // only matters if someone ever grants them by hand.
    for (const internal of ['_basedb', '_basedb_local']) {
      await exec.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA ${quoteIdentifier(internal)} FROM ${quoteIdentifier(CONSOLE_ROLE)}`,
        [],
        'ddl',
      )
      await exec.query(
        `REVOKE ALL ON SCHEMA ${quoteIdentifier(internal)} FROM ${quoteIdentifier(CONSOLE_ROLE)}`,
        [],
        'ddl',
      )
    }

    for (const other of others) {
      await exec.query(
        `REVOKE ALL ON SCHEMA ${quoteIdentifier(other)} FROM ${quoteIdentifier(CONSOLE_ROLE)}`,
        [],
        'ddl',
      )
      await exec.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA ${quoteIdentifier(other)} FROM ${quoteIdentifier(CONSOLE_ROLE)}`,
        [],
        'ddl',
      )
    }

    // USAGE, not CREATE: the console reads and writes rows, it does not make objects the
    // catalog would not know about.
    await exec.query(
      `GRANT USAGE ON SCHEMA ${quoteIdentifier(schema)} TO ${quoteIdentifier(CONSOLE_ROLE)}`,
      [],
      'ddl',
    )
    await exec.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${quoteIdentifier(schema)}
         TO ${quoteIdentifier(CONSOLE_ROLE)}`,
      [],
      'ddl',
    )
    await exec.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${quoteIdentifier(schema)}
         TO ${quoteIdentifier(CONSOLE_ROLE)}`,
      [],
      'ddl',
    )

    void ctx
  })
}

/**
 * One pool per (schema, credentials), kept for the process.
 *
 * `search_path` is set in the STARTUP PACKET rather than by a `SET`, for the reason the
 * connection contract gives: a `DISCARD ALL` on return to the pool restores the startup
 * value instead of destroying it. So unqualified names resolve to the base's schema for
 * the whole life of the connection, and a submitted `SET search_path` only lasts the
 * session it was typed in.
 */
const consolePools = new Map<string, Pool>()

function consolePool(connectionString: string, password: string, schema: string): Pool {
  const key = `${schema} ${connectionString}`
  const existing = consolePools.get(key)
  if (existing !== undefined) return existing

  const url = new URL(connectionString)
  url.username = CONSOLE_ROLE
  url.password = password

  const pool = new Pool({
    connectionString: url.toString(),
    max: 4,
    options: startupOptions({
      search_path: `${schema},public`,
      statement_timeout: `${CONSOLE_STATEMENT_TIMEOUT_MS}ms`,
      idle_in_transaction_session_timeout: '30000ms',
    }),
    application_name: 'basedb:console',
  })
  // A pool that throws on an idle client error takes the process down with it.
  pool.on('error', () => undefined)
  consolePools.set(key, pool)
  return pool
}

/** Closes the console pools — called when the kernel shuts down. */
export async function closeConsolePools(): Promise<void> {
  const pools = [...consolePools.values()]
  consolePools.clear()
  await Promise.all(pools.map((p) => p.end().catch(() => undefined)))
}

/** OID → type name, so a column reads `numeric` rather than `1700`. */
const typeNameCache = new Map<number, string>()

async function resolveTypes(
  client: PoolClient,
  oids: readonly number[],
): Promise<readonly string[]> {
  const missing = [...new Set(oids)].filter((oid) => !typeNameCache.has(oid))
  if (missing.length > 0) {
    // `pg_type` is world-readable, so the restricted role can do this itself.
    const { rows } = await client.query<{ oid: string; name: string }>(
      'SELECT oid::text AS oid, format_type(oid, NULL) AS name FROM pg_type WHERE oid = ANY($1::oid[])',
      [missing],
    )
    for (const row of rows) typeNameCache.set(Number(row.oid), row.name)
  }
  return oids.map((oid) => typeNameCache.get(oid) ?? String(oid))
}

/**
 * Writes the call to `audit_log`, whatever its outcome.
 *
 * The STATEMENT is recorded. Chapter 09 objects that arbitrary SQL makes the log
 * uninterpretable — one cannot tell which rows were read — and that is true and not
 * fixable here. What remains knowable is who ran what, and that is worth keeping: it is
 * the only thread an investigation would have.
 */
async function audit(
  pools: Pools,
  ctx: RequestContext,
  baseId: string,
  sql: string,
  command: string | null,
  rowCount: number | null,
  errorCode: string | null,
): Promise<void> {
  await pools
    .withConnection('catalog', async (exec: Executor) => {
      await exec.query(
        `INSERT INTO _basedb.audit_log
           (tenant_id, base_id, actor_kind, actor_user_id, surface, action, object_kind,
            object_id, payload, request_id)
         SELECT t.id, $2::uuid, $3, $4::uuid, $5, 'sql.console', 'base', $2::uuid,
                jsonb_build_object('sql', $6::text, 'command', $7::text,
                                   'row_count', $8::int, 'error_code', $9::text),
                $10::uuid
           FROM _basedb.tenant t WHERE t.ref = $1`,
        [
          ctx.tenantId,
          baseId,
          ctx.actor.kind === 'token' ? 'token' : ctx.actor.kind === 'system' ? 'system' : 'user',
          ctx.actor.kind === 'user' ? ctx.actor.id : null,
          ctx.surface === 'mcp' ? 'mcp' : ctx.surface === 'rest' ? 'rest' : 'ui',
          sql.slice(0, 20_000),
          command,
          rowCount,
          errorCode,
          ctx.requestId.length === 36 ? ctx.requestId : null,
        ],
        'insert',
      )
    })
    .catch(() => {
      // A log that cannot be written must not swallow the answer, nor the refusal. It is
      // a gap in the journal, visible as one.
    })
}
