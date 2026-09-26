import { startKernel } from '@basedb/core'
import { serve } from '@hono/node-server'
import { createMcpApp } from './app.js'

/**
 * Starts the MCP entry point — chapter 09 §1.2.
 *
 * Its own process, next to the REST API's and on the same database: chapter 10 forbids
 * `apps/api` and `apps/mcp` to reference each other, so each composes its own kernel.
 * The catalog must already be applied — by the API, which owns bootstrap.
 *
 * The pools are sized for the agent surface: statements stop after 5 seconds and locks
 * are waited for 1 second at most (§11.3). An agent retries willingly; a request of
 * theirs that drags on holds a connection for nothing.
 */

/** A variable of the environment, empty counting as unset (`KEY=` in a `.env` file). */
function setting(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? undefined : value
}

const connectionString = setting('DATABASE_URL')
if (connectionString === undefined) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const AGENT_POOL = { statementTimeoutMs: 5_000, lockTimeoutMs: 1_000 } as const

const kernel = startKernel({
  connectionString,
  encryptionKey: setting('BASEDB_ENCRYPTION_KEY'),
  poolSettings: { catalog: AGENT_POOL, data: AGENT_POOL },
})

const port = Number(setting('BASEDB_MCP_PORT') ?? setting('PORT') ?? 8788)
const app = createMcpApp({ kernel, timeoutMs: 30_000 })

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`basedb MCP on http://localhost:${info.port}/mcp`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void kernel.close().then(() => process.exit(0))
  })
}
