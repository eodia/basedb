import { Pool, type PoolClient, type PoolConfig, types } from 'pg'
import { BasedbError, type SqlOperation, translatePgError } from '../errors/index.js'

/**
 * Driver type parsers, fixed BEFORE any connection is opened.
 *
 * By default the driver returns a PostgreSQL `date` as a JavaScript `Date` object,
 * interpreted in the PROCESS'S LOCAL time zone. Under `Europe/Paris`, March 1st thus
 * becomes February 29th at 11 p.m. — a hire date shown a day early, without a single
 * error message.
 *
 * A `date` is not an instant: it is a calendar day. It is therefore returned as is, in
 * `YYYY-MM-DD`, and no time zone ever applies to it. The connection contract pins
 * `TimeZone = UTC` for `timestamptz`, but that does not protect against this: the
 * conversion happens client-side, after PostgreSQL has done its job correctly.
 */
const OID_DATE = 1082
types.setTypeParser(OID_DATE, (value) => value)

/**
 * Pools and connection contract — chapter 01 §10.3, chapter 10 §3.1.
 *
 * Three pools, on the same host database and the same role. The `catalog` / `data`
 * split exists to allow a later physical separation without a rewrite; it does not
 * concern structure steps, which must stay atomic and therefore use the dedicated pool.
 */

export type PoolName = 'catalog' | 'data' | 'ddl'

export const POOL_NAMES: readonly PoolName[] = ['catalog', 'data', 'ddl'] as const

/**
 * Semantic parameters, set in the connection's STARTUP PACKET, never through a session
 * `SET`.
 *
 * A `SET search_path = ''` executed after connecting is undone by `DISCARD ALL` and by
 * `RESET ALL`, which most pools emit when a connection is returned: the restored value
 * would then be `"$user", public`. Set at startup, the parameter BECOMES the reset
 * value — `DISCARD ALL` restores it instead of destroying it. Otherwise the guarantee
 * would vanish silently, unseen by any test, precisely in the production configuration.
 */
export const CONNECTION_CONTRACT: Readonly<Record<string, string>> = Object.freeze({
  search_path: '',
  TimeZone: 'UTC',
  DateStyle: 'ISO, YMD',
  IntervalStyle: 'iso_8601',
  client_encoding: 'UTF8',
  standard_conforming_strings: 'on',
})

/**
 * Serializes the contract as `options=-c key=value` for the startup packet.
 *
 * An empty value is written `-c search_path=` and definitely NOT `-c search_path=""`:
 * libpq does not interpret the quotes, and the parameter would then hold a two-quote
 * string — a `search_path` that is neither empty nor valid, and that would make every
 * unqualified reference fail in a thoroughly confusing way.
 *
 * Spaces inside a value are escaped with a backslash, as libpq expects for
 * `DateStyle=ISO, YMD`.
 */
export function startupOptions(extra: Readonly<Record<string, string>> = {}): string {
  return Object.entries({ ...CONNECTION_CONTRACT, ...extra })
    .map(([key, value]) => `-c ${key}=${value.replace(/ /g, '\\ ')}`)
    .join(' ')
}

export interface PoolSettings {
  readonly max: number
  /** Lock acquisition delay, beyond which `LOCK_UNAVAILABLE`. */
  readonly lockTimeoutMs: number
  readonly statementTimeoutMs: number
  readonly idleInTransactionTimeoutMs: number
  /**
   * How long a request waits for a connection of a full pool before `SERVICE_UNAVAILABLE`;
   * 0 for no limit. Without one, a pool emptied by slow work queues every request behind
   * it for good — and a transaction that waits for a connection of its own pool sits idle
   * until the server closes it.
   */
  readonly acquireTimeoutMs: number
}

/**
 * Default sizing (chapter 10 §3.2).
 *
 * The `ddl` pool is deliberately narrow: a structure operation takes one advisory lock
 * per base, and adding connections would only lengthen the queue. Its timeouts are
 * longer, since a step may legitimately take a while.
 */
export const DEFAULT_SETTINGS: Readonly<Record<PoolName, PoolSettings>> = Object.freeze({
  catalog: {
    max: 10,
    lockTimeoutMs: 3_000,
    statementTimeoutMs: 15_000,
    idleInTransactionTimeoutMs: 30_000,
    acquireTimeoutMs: 15_000,
  },
  data: {
    max: 20,
    lockTimeoutMs: 3_000,
    statementTimeoutMs: 30_000,
    idleInTransactionTimeoutMs: 30_000,
    acquireTimeoutMs: 15_000,
  },
  ddl: {
    max: 2,
    lockTimeoutMs: 5_000,
    statementTimeoutMs: 600_000,
    idleInTransactionTimeoutMs: 60_000,
    // Structure operations queue behind one another by design (one lock per base).
    acquireTimeoutMs: 0,
  },
})

export interface PoolsOptions {
  readonly connectionString: string
  readonly settings?: Partial<Record<PoolName, Partial<PoolSettings>>>
}

/**
 * The kernel's query executor.
 *
 * EVERY SQL execution goes through it: that is what makes error translation
 * unforgettable (chapter 10 §8.2). It is never exported outside the kernel — an adapter
 * holds no object representing a connection (§2.4, lock 1).
 */
export interface Executor {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    operation?: SqlOperation,
  ): Promise<T[]>
}

/** Wraps a client so that every PostgreSQL error is translated. */
export function executorOf(client: PoolClient): Executor {
  return {
    async query(sql, params = [], operation = 'select') {
      try {
        const { rows } = await client.query(sql, params as unknown[])
        return rows
      } catch (error) {
        throw translatePgError(error as { code?: string }, operation)
      }
    },
  }
}

/** Who borrowed a connection, and when — said if the server closes it while it is out. */
const borrowed = new WeakMap<object, { readonly at: number; readonly by: Error }>()

/** The calls of the kernel that led to a borrowing, without the driver's own frames. */
function callers(by: Error): string {
  return (by.stack ?? '')
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => !/node_modules|node:internal|runtime[\\/]pool\.[jt]s/.test(line))
    .slice(0, 4)
    .join(' ← ')
}

/**
 * A connection the server closes — a restart, a network cut, a timeout it enforces, such as
 * `idle_in_transaction_session_timeout` — must not take the process down. node-postgres
 * emits `error` on the client, and on the pool for an idle one; with no listener, Node
 * throws it (« Unhandled 'error' event »): the API stops, and the container with it. And
 * while a connection is borrowed, the pool has taken its own listener off.
 *
 * So every client carries a listener for its whole life, and every pool one too. A dead
 * client is dropped by the pool when it is released; the request that held it fails alone.
 */
export function survive(pool: Pool, name: string): Pool {
  // The clients' listener below says it; the pool's only keeps Node from throwing.
  pool.on('error', () => undefined)
  pool.on('connect', (client) => {
    client.on('error', (error: Error & { code?: string }) => {
      const out = borrowed.get(client)
      const held =
        out === undefined
          ? 'au repos'
          : `empruntée depuis ${Math.round((Date.now() - out.at) / 1000)} s par ${callers(out.by)}`
      console.error(
        `PostgreSQL (${name}) : connexion fermée par le serveur${error.code ? ` [${error.code}]` : ''} — ${error.message} ; ${held}`,
      )
    })
  })
  // `Pools.acquire` says better who borrowed; this is for the pools that borrow directly.
  pool.on('acquire', (client) => borrowed.set(client, { at: Date.now(), by: new Error() }))
  pool.on('release', (_error, client) => borrowed.delete(client))
  return pool
}

export class Pools {
  private readonly pools: Map<PoolName, Pool> = new Map()
  /** Connections whose contract has already been checked, by object identity. */
  private readonly verified: WeakSet<PoolClient> = new WeakSet()

  constructor(options: PoolsOptions) {
    for (const name of POOL_NAMES) {
      const settings = { ...DEFAULT_SETTINGS[name], ...options.settings?.[name] }
      const config: PoolConfig = {
        connectionString: options.connectionString,
        max: settings.max,
        options: startupOptions({
          lock_timeout: `${settings.lockTimeoutMs}ms`,
          statement_timeout: `${settings.statementTimeoutMs}ms`,
          idle_in_transaction_session_timeout: `${settings.idleInTransactionTimeoutMs}ms`,
        }),
        application_name: `basedb:${name}`,
        connectionTimeoutMillis: settings.acquireTimeoutMs,
        // A peer gone without a word — a network cut — is noticed, not waited on forever.
        keepAlive: true,
        keepAliveInitialDelayMillis: 30_000,
      }
      this.pools.set(name, survive(new Pool(config), name))
    }
  }

  /**
   * Borrows a connection and applies the FIRST-USE ASSERTION to it: `search_path` must
   * be empty and `TimeZone` must be `UTC`. Otherwise the connection is removed from the
   * pool and the `CONNECTION_CONTRACT_BROKEN` incident is raised.
   */
  async acquire(name: PoolName): Promise<PoolClient> {
    const pool = this.pools.get(name)
    if (pool === undefined) throw new BasedbError('INTERNAL_ERROR', { details: { pool: name } })

    let client: PoolClient
    try {
      client = await pool.connect()
    } catch (error) {
      // No connection within `acquireTimeoutMs`, or none the server accepts.
      throw translatePgError(error as { code?: string })
    }
    // Here, the stack still leads to the caller — through its awaits.
    borrowed.set(client, { at: Date.now(), by: new Error() })
    if (this.verified.has(client)) return client

    try {
      const { rows } = await client.query<{ search_path: string; timezone: string }>(
        "SELECT current_setting('search_path') AS search_path, current_setting('TimeZone') AS timezone",
      )
      const contract = rows[0]
      if (contract.search_path !== '' || contract.timezone !== 'UTC') {
        // Removed from the pool, not returned: an off-contract connection must not be
        // handed out again.
        client.release(new Error('CONNECTION_CONTRACT_BROKEN'))
        throw new BasedbError('CONNECTION_CONTRACT_BROKEN', {
          details: { pool: name, search_path: contract.search_path, TimeZone: contract.timezone },
        })
      }
      this.verified.add(client)
      return client
    } catch (error) {
      if (error instanceof BasedbError) throw error
      client.release(error as Error)
      throw translatePgError(error as { code?: string })
    }
  }

  /** Borrows a connection, runs the work, returns the connection whatever happens. */
  async withConnection<T>(name: PoolName, work: (exec: Executor) => Promise<T>): Promise<T> {
    const client = await this.acquire(name)
    try {
      return await work(executorOf(client))
    } finally {
      client.release()
    }
  }

  async end(): Promise<void> {
    await Promise.all([...this.pools.values()].map((p) => p.end()))
  }
}
