/**
 * insights beside basedb in development — the same arrangement as the Docker image
 * (chapter 19 §5), without building it: insights' server (Rust, `apps/server`, built by
 * cargo) and interface are started from its own repository, and basedb's interface serves it under `/insights` (apps/web/next.config.ts
 * relays there). One command, one address, one sign-in.
 *
 * insights is looked for beside basedb (`../insights`, or `BASEDB_INSIGHTS_DIR`), installed
 * (`pnpm install` done there). Skipped with `BASEDB_INSIGHTS=0`, or when `BASEDB_INSIGHTS_URL`
 * already names an insights started by hand. Its own `.env` keeps its settings — its catalog,
 * its Trino, its AI —; what wires it to basedb is given here and wins.
 *
 * insights' own development servers may run at the same time, from the same folder: this
 * interface builds into `.next-basedb` rather than `.next`, and this server takes another
 * port when 4200 is taken. Trino keeps asking 4200 (below): that other API then decides, from the
 * same catalog and with the same secret — read from insights' `.env` for that reason.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { isAbsolute, join, resolve } from 'node:path'
import { parseEnv } from 'node:util'

/**
 * The port Trino asks before every statement (`OPA_URL` of insights' docker-compose.yml
 * names `host.docker.internal:4200`): this server's, when free.
 */
const OPA_PORT = 4200

/** `+toolchain` for cargo, as for basedb-server (scripts/start.mjs). */
const TOOLCHAIN = process.env.BASEDB_CARGO_TOOLCHAIN
  ? [`+${process.env.BASEDB_CARGO_TOOLCHAIN}`]
  : []

/** Signs insights' sign-in links: shared by both, development only. */
const DEV_SECRET = 'developpement-seulement-secret-sso-basedb-insights'

/** `HOST_SSO_SECRET` of insights' `.env`, when it sets one long enough. */
function secretOf(dir) {
  const file = join(dir, '.env')
  if (!existsSync(file)) return undefined
  const secret = parseEnv(readFileSync(file, 'utf8')).HOST_SSO_SECRET?.trim()
  return secret !== undefined && secret.length >= 32 ? secret : undefined
}

function listens(port, host) {
  return new Promise((done) => {
    const s = createServer()
    s.unref()
    s.once('error', () => done(false))
    s.listen(port, host, () => s.close(() => done(true)))
  })
}

/** Free on both stacks: on Windows, `::` can be had while `0.0.0.0` (insights' API) is taken. */
async function free(port) {
  return (await listens(port, '0.0.0.0')) && (await listens(port, '::'))
}

function anyPort() {
  return new Promise((done, fail) => {
    const s = createServer()
    s.unref()
    s.on('error', fail)
    s.listen(0, () => {
      const { port } = s.address()
      s.close(() => done(port))
    })
  })
}

/**
 * What starting insights takes, or why it is not started (`{ skipped }`): its directory,
 * its ports, and the variables basedb's API, MCP server and interface need to reach it.
 */
export async function planInsights({ root, webPort }) {
  if (process.env.BASEDB_INSIGHTS === '0') return { skipped: 'BASEDB_INSIGHTS=0' }
  if ((process.env.BASEDB_INSIGHTS_URL ?? '').trim() !== '') {
    return { skipped: `BASEDB_INSIGHTS_URL=${process.env.BASEDB_INSIGHTS_URL}` }
  }
  const given = (process.env.BASEDB_INSIGHTS_DIR ?? '').trim()
  const dir =
    given === ''
      ? resolve(root, '..', 'insights')
      : isAbsolute(given)
        ? given
        : resolve(root, given)
  const manifest = join(dir, 'apps/server/Cargo.toml')
  const next = join(dir, 'apps/web/node_modules/next/dist/bin/next')
  if (!existsSync(manifest)) {
    return { skipped: `no insights 0.7+ (its Rust server) at ${dir} (BASEDB_INSIGHTS_DIR)` }
  }
  if (!existsSync(next)) {
    return { skipped: `insights at ${dir} is not installed: run pnpm install there` }
  }
  // Built before anything starts, as basedb-server is: the first build takes a few minutes.
  const built = spawnSync(
    'cargo',
    [...TOOLCHAIN, 'build', '--release', '--manifest-path', manifest, '-p', 'eodia-server'],
    { stdio: 'inherit', cwd: dir },
  )
  if (built.status !== 0) return { skipped: `insights' server did not build (${manifest})` }
  const target = process.env.INSIGHTS_CARGO_TARGET_DIR || join(dir, 'apps/server/target')
  const server = join(
    target,
    'release',
    `eodia-server${process.platform === 'win32' ? '.exe' : ''}`,
  )
  if (!existsSync(server)) return { skipped: `insights' server not found at ${server}` }
  const secret = process.env.BASEDB_INSIGHTS_SECRET?.trim() || secretOf(dir) || DEV_SECRET
  const webOrigin = `http://localhost:${webPort}`
  const apiPort = (await free(OPA_PORT)) ? OPA_PORT : await anyPort()
  const insightsWebPort = await anyPort()
  const api = `http://localhost:${apiPort}`
  return {
    dir,
    server,
    next,
    secret,
    webOrigin,
    apiPort,
    /** Trino asks another insights server, on 4200, rather than this one. */
    sharedOpa: apiPort !== OPA_PORT,
    webPort: insightsWebPort,
    publicUrl: `${webOrigin}/insights`,
    /** For basedb's API and MCP server. */
    basedbEnv: {
      BASEDB_INSIGHTS_URL: api,
      BASEDB_INSIGHTS_PUBLIC_URL: `${webOrigin}/insights`,
      BASEDB_INSIGHTS_SECRET: secret,
    },
    /** For basedb's interface, which relays `/insights`. */
    basedbWebEnv: {
      BASEDB_INSIGHTS_WEB: `http://localhost:${insightsWebPort}`,
      BASEDB_INSIGHTS_API: api,
    },
  }
}

/**
 * Starts insights' server (which migrates its catalog and runs its jobs in process) and its
 * interface, with `start(name, command, args, env, cwd)` — the caller's own launcher.
 */
export function startInsights(plan, start, { apiPort }) {
  const wiring = {
    INSIGHTS_BASE_PATH: '/insights',
    PUBLIC_URL: plan.publicUrl,
    // basedb, its host application.
    HOST_SSO_SECRET: plan.secret,
    HOST_SSO_ISSUER: 'basedb',
    HOST_ACCESS_URL: `http://localhost:${apiPort}/api/insights/reader`,
    HOST_PUBLIC_URL: plan.webOrigin,
  }
  const api = start(
    'ins·api',
    plan.server,
    [],
    { ...wiring, RUST_PORT: String(plan.apiPort) },
    plan.dir,
  )
  const web = start(
    'ins·web',
    'node',
    [plan.next, 'dev', '--port', String(plan.webPort)],
    { ...wiring, API_URL: `http://localhost:${plan.apiPort}`, INSIGHTS_DIST_DIR: '.next-basedb' },
    join(plan.dir, 'apps/web'),
  )
  return [api, web]
}
