import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Pools, startupOptions } from '../../src/runtime/pool.js'

/**
 * A connection the server closes does not take the process down — chapter 10 §3.1.
 *
 * Seen in production: a transaction left idle past `idle_in_transaction_session_timeout`;
 * PostgreSQL closed the connection, node-postgres emitted `error` on a client the pool had
 * lent — and so had no listener on —, and Node threw it: the API stopped, and the container
 * with it. Here the server closes a borrowed connection and an idle one; the process lives
 * on, the request that held the connection fails alone, the next ones are served, and the
 * log says who held the connection.
 */

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: Client
const logged: string[] = []

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({
    connectionString: container.getConnectionUri(),
    settings: { catalog: { idleInTransactionTimeoutMs: 300 } },
  })
  admin = new Client({ connectionString: container.getConnectionUri(), options: startupOptions() })
  await admin.connect()
}, 120_000)

afterAll(async () => {
  await admin?.end()
  await pools?.end()
  await container?.stop()
})

afterEach(() => {
  vi.restoreAllMocks()
  logged.length = 0
})

const listen = () =>
  vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    logged.push(parts.map(String).join(' '))
  })

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A transaction left idle while something else is awaited — what closed it in production. */
async function holdIdleTransaction(): Promise<void> {
  await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    await pause(1_000)
    await exec.query('SELECT 1')
  })
}

describe('a connection the server closes', () => {
  it('fails the request that held it in an idle transaction, and only that one', async () => {
    listen()
    await expect(holdIdleTransaction()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })

    const rows = await pools.withConnection('catalog', (exec) => exec.query('SELECT 1 AS one'))
    expect(rows).toEqual([{ one: 1 }])
    expect(logged.join('\n')).toMatch(
      /PostgreSQL \(catalog\).*\[25P03\].*empruntée depuis \d+ s par/,
    )
    expect(logged.join('\n')).toMatch(/holdIdleTransaction/)
  })

  it('drops an idle connection the server ended, and serves the next request', async () => {
    listen()
    await pools.withConnection('data', (exec) => exec.query('SELECT 1'))
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'basedb:data'`,
    )
    await pause(300)

    const rows = await pools.withConnection('data', (exec) => exec.query('SELECT 2 AS two'))
    expect(rows).toEqual([{ two: 2 }])
    expect(logged.join('\n')).toMatch(/PostgreSQL \(data\).*au repos/)
  })
})
