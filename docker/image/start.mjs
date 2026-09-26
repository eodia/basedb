/**
 * basedb in one container: the API, the MCP server and the interface, behind Caddy on one
 * port. The image's entry point (Dockerfile, target `basedb`).
 *
 *   /api/*, /auth/*, /healthz  → the API        127.0.0.1:8787
 *   /mcp                       → the MCP server 127.0.0.1:8788
 *   everything else            → the interface  127.0.0.1:3001
 *
 * The API starts first — it applies the catalog on an empty database — and the MCP server
 * once it answers. If any process stops, the others are stopped too and the container
 * exits: the restart policy starts it again whole, rather than half of it running.
 */

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const env = process.env
const INTERNAL = { api: 8787, mcp: 8788, web: 3001 }
// Stopping gracefully first; after this, whatever still runs is killed.
const GRACE_MS = 10_000
// The first start applies the catalog, which takes a few seconds on a slow disk.
const API_READY_MS = 180_000

/** What the interface needs, and nothing more: it holds no secret. */
function interfaceEnv() {
  const keep = ['PATH', 'HOME', 'TZ', 'NODE_ENV', 'NEXT_TELEMETRY_DISABLED']
  const picked = Object.fromEntries(
    keep.filter((k) => env[k] !== undefined).map((k) => [k, env[k]]),
  )
  return {
    ...picked,
    PORT: String(INTERNAL.web),
    HOSTNAME: '127.0.0.1',
    // `/`: this page's own origin, whatever the address basedb is reached by.
    BASEDB_API: env.BASEDB_API || '/',
    BASEDB_MCP: env.BASEDB_MCP || '/mcp',
  }
}

const children = new Map()
let stopping = false
let exitCode = 0

function run(name, command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const [stream, out] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    createInterface({ input: stream }).on('line', (line) => out.write(`[${name}] ${line}\n`))
  }
  child.on('error', (error) => {
    console.error(`[basedb] ${name} could not start: ${error.message}`)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    children.delete(name)
    if (!stopping) {
      console.error(
        `[basedb] ${name} stopped (${signal ?? `code ${code}`}): stopping the container`,
      )
      stop(1)
    }
    if (children.size === 0) process.exit(exitCode)
  })
  children.set(name, child)
}

function stop(code) {
  if (stopping) return
  stopping = true
  exitCode = code
  if (children.size === 0) process.exit(exitCode)
  for (const child of children.values()) child.kill('SIGTERM')
  setTimeout(() => {
    for (const child of children.values()) child.kill('SIGKILL')
  }, GRACE_MS).unref()
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0))

async function answers(url, within) {
  const until = Date.now() + within
  while (!stopping && Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return true
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

const server = '/app/server/apps'

run('proxy', 'caddy', ['run', '--config', '/app/Caddyfile', '--adapter', 'caddyfile'], {
  env: {
    PATH: env.PATH,
    HOME: env.HOME,
    PORT: env.PORT || '3000',
    XDG_DATA_HOME: '/tmp/caddy',
    XDG_CONFIG_HOME: '/tmp/caddy',
  },
})
run('web', 'node', ['apps/web/server.js'], { cwd: '/app/web', env: interfaceEnv() })
run('api', 'node', ['dist/server.js'], {
  cwd: `${server}/api`,
  env: { ...env, PORT: String(INTERNAL.api) },
})

if (await answers(`http://127.0.0.1:${INTERNAL.api}/healthz`, API_READY_MS)) {
  run('mcp', 'node', ['dist/server.js'], {
    cwd: `${server}/mcp`,
    env: { ...env, BASEDB_MCP_PORT: String(INTERNAL.mcp) },
  })
  console.log(`[basedb] ready on port ${env.PORT || '3000'}: the interface, /api and /mcp`)
} else if (!stopping) {
  console.error('[basedb] the API did not answer in time: stopping the container')
  stop(1)
}
