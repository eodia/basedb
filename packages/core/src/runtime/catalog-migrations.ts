import { type CatalogMigration, catalogMigrations } from '@basedb/catalog-schema'
import { Client } from 'pg'
import { BasedbError } from '../errors/index.js'
import { startupOptions } from './pool.js'

/**
 * Catalog migrations — chapter 02, « Versionnement du catalogue lui-même » and « Amorçage ».
 *
 * Each migration of `@basedb/catalog-schema` is applied once, in order, and recorded in
 * `_basedb.catalog_migration` with the checksum of its file. At every start, before
 * anything is applied, what is recorded is checked against what the code ships:
 *
 * - a recorded checksum that differs → `CATALOG_CHECKSUM_MISMATCH`, and nothing starts:
 *   the catalog was built by a text this code does not have;
 * - a recorded version the code does not know → `CATALOG_VERSION_AHEAD`: a newer basedb
 *   upgraded this database, and an older one must not write into a shape it ignores.
 *
 * The sequence runs on a DEDICATED connection, outside the pools, holding the session
 * advisory lock of class `catalog_migration` (1, 1): two processes starting together
 * never migrate at the same time — the second waits, then finds nothing left to do.
 */

/** Lock class `catalog_migration`, key 1: instance scope (chapter 02, `lock_class`). */
const LOCK = 'SELECT pg_try_advisory_lock(1, 1) AS taken'
const UNLOCK = 'SELECT pg_advisory_unlock(1, 1)'

/**
 * How long a process waits for another one migrating the catalog. Long: the second waits
 * for the first to finish, however long its migrations take — it would otherwise fail
 * with nothing wrong. A session lock goes with its connection, so no dead process holds
 * it; only a live one stuck that long makes this give up.
 */
const LOCK_WAIT_MS = 5 * 60_000

/** A migration waiting on a table's lock gives up after `lock_timeout`, and is retried. */
const APPLY_TRIES = 3

/**
 * The installations of basedb 0.1.x: their catalog was built by `0001`, whose
 * `catalog_migration` table nothing wrote into. Found with an empty record, the catalog is
 * theirs, and `0001` is recorded on their behalf before anything else is applied.
 */
const ADOPTED_RELEASE = 'antérieure à 0.2.0'

export interface CatalogState {
  /** The last version recorded; 0 on a database without a catalog. */
  readonly applied: number
  /** The last version this code ships. */
  readonly shipped: number
  /** The migrations this code would apply, by name. */
  readonly pending: readonly string[]
}

interface Recorded {
  readonly version: number
  readonly name: string
  readonly checksum: Buffer
}

/** Opens the dedicated connection: the connection contract, and the chapter's timeouts. */
async function connect(connectionString: string): Promise<Client> {
  const client = new Client({
    connectionString,
    // Without `lock_timeout`, an ALTER waiting for its ACCESS EXCLUSIVE lock queues every
    // read behind it, and the whole application freezes during a deployment.
    options: startupOptions({ lock_timeout: '3s', statement_timeout: '60s' }),
    application_name: 'basedb:catalog',
  })
  // A connection the server closes fails the migration under way, not the process.
  client.on('error', () => undefined)
  await client.connect()
  return client
}

/** What the database records — `null` when it has no catalog at all. */
async function recorded(client: Client): Promise<Recorded[] | null> {
  const { rows } = await client.query<{ catalog: boolean; ledger: boolean }>(
    `SELECT to_regnamespace('_basedb') IS NOT NULL AS catalog,
            to_regclass('_basedb.catalog_migration') IS NOT NULL AS ledger`,
  )
  const state = rows[0]
  if (state === undefined || !state.catalog) return null
  if (!state.ledger) {
    // A `_basedb` schema without its record: not a catalog any version of basedb built.
    throw new BasedbError('CATALOG_DRIFT', { details: { missing: '_basedb.catalog_migration' } })
  }
  const ledger = await client.query<Recorded>(
    'SELECT version, name, checksum FROM _basedb.catalog_migration ORDER BY version',
  )
  return ledger.rows
}

/**
 * Checks the record against the shipped migrations, and says what is left to apply.
 * Throws `CATALOG_VERSION_AHEAD`, `CATALOG_CHECKSUM_MISMATCH` or `CATALOG_DRIFT`.
 */
function compare(
  rows: readonly Recorded[],
  shipped: readonly CatalogMigration[],
): CatalogMigration[] {
  rows.forEach((row, index) => {
    const migration = shipped[row.version - 1]
    if (migration === undefined) {
      throw new BasedbError('CATALOG_VERSION_AHEAD', {
        details: { recorded: row.version, shipped: shipped.length, name: row.name },
      })
    }
    // A hole in the record — version 3 without 2 — is a record someone edited.
    if (row.version !== index + 1) {
      throw new BasedbError('CATALOG_DRIFT', { details: { missing_version: index + 1 } })
    }
    if (!Buffer.from(row.checksum).equals(migration.checksum)) {
      throw new BasedbError('CATALOG_CHECKSUM_MISMATCH', {
        details: { version: row.version, name: row.name },
      })
    }
  })
  return shipped.slice(rows.length)
}

/** Where the catalog stands, checked — without applying anything. */
export async function inspectCatalog(
  connectionString: string,
  shipped: readonly CatalogMigration[] = catalogMigrations(),
): Promise<CatalogState> {
  const client = await connect(connectionString)
  try {
    const rows = await recorded(client)
    // A 0.1.x catalog, not adopted yet: `0001` is behind it, the rest ahead.
    const effective = rows !== null && rows.length === 0 ? adopted(shipped) : (rows ?? [])
    const pending = compare(effective, shipped)
    return {
      applied: effective.length,
      shipped: shipped.length,
      pending: pending.map((m) => m.name),
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}

function adopted(shipped: readonly CatalogMigration[]): Recorded[] {
  const first = shipped[0]
  return first === undefined
    ? []
    : [{ version: first.version, name: first.name, checksum: first.checksum }]
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** PostgreSQL gave up waiting for a lock (`lock_timeout`). */
const lockTimedOut = (error: unknown) => (error as { code?: string }).code === '55P03'

export interface MigrateOptions {
  /** Said after each migration applied. */
  readonly onApplied?: (name: string, ms: number) => void
  /** Said once, when another process is already migrating and this one waits for it. */
  readonly onWaiting?: () => void
  /** The migrations to apply — the package's; a test gives its own. */
  readonly migrations?: readonly CatalogMigration[]
  readonly lockWaitMs?: number
}

/**
 * Brings the catalog to the version this code ships. Returns the migrations applied,
 * in order; none when it already stood there.
 */
export async function migrateCatalog(
  connectionString: string,
  release: string,
  options: MigrateOptions = {},
): Promise<string[]> {
  const shipped = options.migrations ?? catalogMigrations()
  const client = await connect(connectionString)
  let locked = false
  try {
    const deadline = Date.now() + (options.lockWaitMs ?? LOCK_WAIT_MS)
    for (let waiting = false; ; waiting = true) {
      const { rows } = await client.query<{ taken: boolean }>(LOCK)
      locked = rows[0]?.taken === true
      if (locked) break
      if (Date.now() >= deadline) {
        throw new BasedbError('LOCK_UNAVAILABLE', { details: { lock: 'catalog_migration' } })
      }
      if (!waiting) options.onWaiting?.()
      await pause(1000)
    }

    const rows = await recorded(client)
    if (rows !== null && rows.length === 0) {
      // A 0.1.x installation: its catalog is `0001`'s, recorded now on its behalf.
      const [first] = adopted(shipped)
      if (first !== undefined) {
        await client.query(
          `INSERT INTO _basedb.catalog_migration (version, name, checksum, app_release, duration_ms)
           VALUES ($1, $2, $3, $4, 0)`,
          [first.version, first.name, first.checksum, ADOPTED_RELEASE],
        )
      }
    }
    const pending = compare(rows === null ? [] : ((await recorded(client)) ?? []), shipped)

    const applied: string[] = []
    for (const migration of pending) {
      const started = performance.now()
      for (let attempt = 1; ; attempt++) {
        try {
          // One transaction per migration: a failure leaves the catalog at the previous
          // version, recorded as such, and the next start resumes from there.
          await client.query('BEGIN')
          await client.query(migration.sql)
          await client.query(
            `INSERT INTO _basedb.catalog_migration (version, name, checksum, app_release, duration_ms)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              migration.version,
              migration.name,
              migration.checksum,
              release,
              Math.round(performance.now() - started),
            ],
          )
          await client.query('COMMIT')
          break
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined)
          if (lockTimedOut(error) && attempt < APPLY_TRIES) {
            await pause(1000 * attempt)
            continue
          }
          throw new Error(
            `Migration de catalogue ${migration.name} : ${(error as Error).message}`,
            { cause: error },
          )
        }
      }
      const ms = Math.round(performance.now() - started)
      applied.push(migration.name)
      options.onApplied?.(migration.name, ms)
    }
    return applied
  } finally {
    if (locked) await client.query(UNLOCK).catch(() => undefined)
    await client.end().catch(() => undefined)
  }
}
