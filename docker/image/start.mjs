/**
 * The entry point of the image `basedb-insights` (Dockerfile): basedb and insights in one
 * container, built on insights' published image (0.7.0 or later). basedb-server answers on
 * the container's port and relays insights under `/insights` itself (BASEDB_INSIGHTS=1,
 * rust-server/crates/server/src/front.rs); this file only starts the three processes:
 *
 *   basedb-server        0.0.0.0:PORT (3000) — basedb, and insights under /insights
 *   insights' server     0.0.0.0:4200        — its API, MCP and jobs; Trino asks it (OPA)
 *   insights' interface  0.0.0.0:3100        — Next, its base path written at start (unpublished)
 *
 * Its catalog is a database of its own beside basedb's (`insights`, created here when
 * missing); Trino is a service of its own (docker-compose.yml). Nothing
 * else to configure but INSIGHTS_OPA_SECRET. insights' own variables are given with an
 * `INSIGHTS_` prefix (INSIGHTS_SMTP_URL → SMTP_URL). The basedb image alone runs no Node:
 * this file is for this target only.
 */

import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { createInterface } from 'node:readline'

const env = process.env
// NAME_FILE stands for NAME when NAME is unset — the secrets the compose file draws, read as
// basedb-server reads them (rust-server/crates/base/src/config.rs), and insights' as well.
for (const [key, path] of Object.entries(env)) {
  const name = key.endsWith('_FILE') ? key.slice(0, -5) : ''
  if (!/^(DATABASE_URL|BASEDB_.+|INSIGHTS_.+|.+_API_KEY)$/.test(name)) continue
  if (!path?.trim() || env[name]?.trim()) continue
  try {
    env[name] = readFileSync(path.trim(), 'utf8').replace(/[\r\n]+$/, '')
  } catch (error) {
    fail(`${key}: ${path} cannot be read (${error.message})`)
  }
}
const PORT = env.PORT || '3000'
const INSIGHTS = { server: 4200, web: 3100 }
// Stopping gracefully first; after this, whatever still runs is killed.
const GRACE_MS = 10_000
// The first start applies the catalog, which takes a few seconds on a slow disk.
const READY_MS = 180_000

/** Unset, or empty: as everywhere in the compose file. */
const blank = (name) => !env[name]?.trim()

function fail(message) {
  console.error(`[basedb] ${message}`)
  process.exit(1)
}

/** `BASEDB_BASE_PATH`, else the path of `BASEDB_PUBLIC_URL`: `/basedb`, or empty. */
function basePathOf() {
  let raw = env.BASEDB_BASE_PATH?.trim() ? env.BASEDB_BASE_PATH : undefined
  if (raw === undefined) {
    try {
      raw = env.BASEDB_PUBLIC_URL ? new URL(env.BASEDB_PUBLIC_URL).pathname : ''
    } catch {
      raw = ''
    }
  }
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed === '' ? '' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

const basePath = basePathOf()
const insightsOn = /^(1|true|yes|on)$/i.test(env.BASEDB_INSIGHTS?.trim() ?? '')
// insights elsewhere (BASEDB_INSIGHTS_HOST another host than this container — `basedb`, its
// compose service, is this one): basedb-server alone, which relays it there.
const here = ['', '127.0.0.1', 'localhost', 'basedb', hostname()]
const remote = !insightsOn || !here.includes(env.BASEDB_INSIGHTS_HOST?.trim() ?? '')

const withDatabase = (url, name) => {
  const address = new URL(url)
  address.pathname = `/${name}`
  return address.toString()
}

/** What insights needs from basedb's settings, and basedb's settings for insights. */
function insightsSettings() {
  if (blank('INSIGHTS_OPA_SECRET')) {
    fail(
      'BASEDB_INSIGHTS=1: set INSIGHTS_OPA_SECRET, the secret of Trino’s OPA_URL (openssl rand -hex 24)',
    )
  }
  if (blank('INSIGHTS_DATABASE_URL') && blank('DATABASE_URL')) {
    fail('BASEDB_INSIGHTS=1: set DATABASE_URL, or INSIGHTS_DATABASE_URL for insights’ catalog')
  }
  if (blank('INSIGHTS_SECRET_KEY') && blank('BASEDB_ENCRYPTION_KEY')) {
    fail('BASEDB_INSIGHTS=1: set BASEDB_ENCRYPTION_KEY, or INSIGHTS_SECRET_KEY')
  }
  let origin
  try {
    origin = blank('BASEDB_PUBLIC_URL') ? undefined : new URL(env.BASEDB_PUBLIC_URL).origin
  } catch {
    origin = undefined
  }
  origin ??= `http://localhost:${env.BASEDB_PORT || PORT}`
  // basedb-server reaches insights here; the rest of its defaults are its own (config.rs).
  env.BASEDB_INSIGHTS_HOST = '127.0.0.1'
  if (blank('BASEDB_INSIGHTS_URL')) env.BASEDB_INSIGHTS_URL = `http://127.0.0.1:${INSIGHTS.server}`
  if (blank('BASEDB_INSIGHTS_PUBLIC_URL'))
    env.BASEDB_INSIGHTS_PUBLIC_URL = `${origin}${basePath}/insights`
  // Each start its own, when unset: its tokens live a few minutes at most.
  if (blank('BASEDB_INSIGHTS_SECRET'))
    env.BASEDB_INSIGHTS_SECRET = randomBytes(32).toString('base64url')
  const own = env.INSIGHTS_DATABASE_URL?.trim()
  return {
    database: own || withDatabase(env.DATABASE_URL, 'insights'),
    // Where to create it when missing: basedb's database, or the server's `postgres` one.
    admin: own ? withDatabase(own, 'postgres') : env.DATABASE_URL,
    // Its key for the secrets it keeps (64 hex digits), derived from basedb's unless set.
    secretKey:
      env.INSIGHTS_SECRET_KEY?.trim() ||
      createHash('sha256').update(`basedb-insights:${env.BASEDB_ENCRYPTION_KEY}`).digest('hex'),
    basedbUrl: (env.BASEDB_PUBLIC_URL?.trim() || `${origin}${basePath}`).replace(/\/+$/, ''),
  }
}

/** Of the container's environment, what insights' processes may have. */
const PASSED = [
  'PATH',
  'HOME',
  'TZ',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
]
/** Kept from its interface, which has no use for them. */
const SECRETS = new Set(['DATABASE_URL', 'SECRET_KEY', 'OPA_SECRET', 'HOST_SSO_SECRET'])
/** basedb's providers, as insights names them. */
const AI_PROVIDERS = {
  openai: 'openai',
  anthropic: 'anthropic',
  mistral: 'mistral',
  openai_compatible: 'openai-compatible',
}

/** insights' AI is basedb's (BASEDB_AI_*) unless it is given its own (INSIGHTS_AI_PROVIDER). */
function insightsAi() {
  const provider = AI_PROVIDERS[env.BASEDB_AI_PROVIDER?.trim() ?? '']
  if (!blank('INSIGHTS_AI_PROVIDER') || provider === undefined) return {}
  const vendor = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    mistral: 'MISTRAL_API_KEY',
  }
  const key = env.BASEDB_AI_API_KEY?.trim() || env[vendor[env.BASEDB_AI_PROVIDER.trim()]]?.trim()
  const ai = { AI_PROVIDER: provider }
  if (key) ai.AI_API_KEY = key
  if (!blank('BASEDB_AI_MODEL')) ai.AI_MODEL = env.BASEDB_AI_MODEL.trim()
  if (!blank('BASEDB_AI_BASE_URL')) ai.AI_BASE_URL = env.BASEDB_AI_BASE_URL.trim()
  if (!blank('BASEDB_AI_PROVIDER_SSL_VERIFY'))
    ai.AI_PROVIDER_SSL_VERIFY = env.BASEDB_AI_PROVIDER_SSL_VERIFY.trim()
  return ai
}

/** One process' environment: its own `INSIGHTS_*` variables, then what wires it in. */
function insightsEnv(settings, secrets, wiring) {
  const passed = PASSED.filter((k) => env[k] !== undefined).map((k) => [k, env[k]])
  const given = Object.entries(env)
    .filter(([k, v]) => k.startsWith('INSIGHTS_') && v?.trim())
    .map(([k, v]) => [k.slice('INSIGHTS_'.length), v])
    .filter(([k]) => secrets || !SECRETS.has(k))
  return {
    ...Object.fromEntries(passed),
    TRINO_URL: 'http://trino:8080',
    ...(secrets ? insightsAi() : {}),
    ...Object.fromEntries(given),
    NODE_ENV: 'production',
    PUBLIC_URL: env.BASEDB_INSIGHTS_PUBLIC_URL,
    HOST_PUBLIC_URL: settings.basedbUrl,
    INSIGHTS_BASE_PATH: `${basePath}/insights`,
    ...wiring,
  }
}

const children = new Map()
let stopping = false
let exitCode = 0

function run(name, command, args, childEnv) {
  const child = spawn(command, args, {
    cwd: '/app',
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
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
      stop(code || 1)
    }
    if (children.size === 0) process.exit(exitCode)
  })
  children.set(name, child)
  return child
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

/** Runs to its end: `basedb-server create-database`, insights' catalog when missing. */
function once(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('exit', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

const settings = insightsOn && !remote ? insightsSettings() : undefined

if (
  settings &&
  !(await once('basedb-server', ['create-database', settings.database, settings.admin]))
) {
  fail(
    "insights: its database could not be reached or created: give PostgreSQL's user the CREATEDB right, or create it and set INSIGHTS_DATABASE_URL",
  )
}

run('basedb', 'basedb-server', [], env)

if (settings) {
  if (!(await answers(`http://127.0.0.1:${PORT}/healthz`, READY_MS))) {
    if (!stopping) {
      console.error('[basedb] basedb-server did not answer in time: stopping the container')
      stop(1)
    }
  } else {
    // After basedb: insights asks it for its source as it starts.
    run(
      'insights',
      '/app/docker/entrypoint.sh',
      ['server'],
      insightsEnv(settings, true, {
        DATABASE_URL: settings.database,
        SECRET_KEY: settings.secretKey,
        // basedb, its host application (insights' HOST_*).
        HOST_SSO_SECRET: env.BASEDB_INSIGHTS_SECRET,
        HOST_SSO_ISSUER: 'basedb',
        HOST_ACCESS_URL: `http://127.0.0.1:${PORT}/api/insights/reader`,
        RUST_PORT: String(INSIGHTS.server),
        // Trino asks it for each query (OPA_URL): reachable on the compose network, unpublished.
        RUST_HOST: '0.0.0.0',
        INPROCESS_WORKER: '1',
      }),
    )
    run(
      'insights-web',
      '/app/docker/entrypoint.sh',
      ['web'],
      insightsEnv(settings, false, { WEB_PORT: String(INSIGHTS.web) }),
    )
    console.log(`[basedb] insights under ${basePath}/insights`)
  }
}
