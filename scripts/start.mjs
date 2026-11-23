/**
 * Starts the whole stack — PostgreSQL, the server, the interface — in one command.
 *
 *   node scripts/start.mjs          (or: corepack pnpm start / corepack pnpm dev)
 *
 * Builds `basedb-server` with cargo (rust-server/, debug profile — `BASEDB_CARGO_PROFILE=release`
 * for the optimized one, `BASEDB_CARGO_TOOLCHAIN=stable-x86_64-pc-windows-gnu` to name a
 * toolchain), then starts it on :8787 (API, and MCP on :8788) and `next dev` on :3200 — each
 * on the next free port when that one is taken. The server applies the catalog and
 * bootstraps an administrator; Ctrl+C stops everything, container included.
 *
 * insights, when its repository sits beside this one (`../insights`, installed), starts
 * with it and is served under `/insights` of the interface, as in the Docker image
 * (scripts/insights-dev.mjs). `BASEDB_INSIGHTS=0` leaves it out.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { planInsights, startInsights } from './insights-dev.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// The operator's own settings — an AI provider and its key, say — from a `.env` at the
// root, when there is one; git ignores it. What the shell already sets wins:
// `loadEnvFile` never overrides a variable. The servers inherit them below.
if (existsSync(`${ROOT}.env`)) process.loadEnvFile(`${ROOT}.env`)

const grey = (s) => `[90m${s}[0m`
const bold = (s) => `[1m${s}[0m`
const green = (s) => `[32m${s}[0m`
const cyan = (s) => `[36m${s}[0m`
const red = (s) => `[31m${s}[0m`

/** A free port, asked of the operating system rather than guessed. */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

/**
 * A port asked for by name, when it is free — else any free port.
 *
 * The MCP entry point prefers a FIXED port: an MCP client's configuration names it, and
 * a port that changed at every launch would mean editing that configuration each time.
 */
function preferredPort(port) {
  return new Promise((resolve) => {
    const s = createServer()
    s.unref()
    s.once('error', () => resolve(freePort()))
    s.listen(port, () => s.close(() => resolve(port)))
  })
}

function require_(condition, message) {
  if (!condition) {
    console.error(`${red('✗')} ${message}`)
    process.exit(1)
  }
}

// The server: rust-server's `basedb-server`, built by cargo before anything starts — a
// compilation error stops here rather than behind a blank interface.
const PROFILE = process.env.BASEDB_CARGO_PROFILE === 'release' ? 'release' : 'debug'
const TOOLCHAIN = process.env.BASEDB_CARGO_TOOLCHAIN
  ? [`+${process.env.BASEDB_CARGO_TOOLCHAIN}`]
  : []
const MANIFEST = `${ROOT}rust-server/Cargo.toml`
require_(
  spawnSync('cargo', [...TOOLCHAIN, '--version'], { stdio: 'ignore' }).status === 0,
  'cargo is not on the PATH. Install Rust (https://rustup.rs, stable toolchain), see rust-server/README.md.',
)
console.log(grey(`  cargo build -p basedb-server (${PROFILE})…`))
const built = spawnSync(
  'cargo',
  // biome-ignore format: the command reads better on one line
  [...TOOLCHAIN, 'build', '--manifest-path', MANIFEST, '-p', 'basedb-server', ...(PROFILE === 'release' ? ['--release'] : [])],
  { stdio: 'inherit' },
)
require_(built.status === 0, 'basedb-server did not build.')
const TARGET = process.env.CARGO_TARGET_DIR || `${ROOT}rust-server/target`
const SERVER = `${TARGET}/${PROFILE}/basedb-server${process.platform === 'win32' ? '.exe' : ''}`
require_(existsSync(SERVER), `basedb-server not found at ${SERVER}.`)

require_(
  spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0,
  'Docker is not responding. Start it, or provide DATABASE_URL yourself.',
)

const CONTAINER = 'basedb-local'
const pgPort = await freePort()
const apiPort = await preferredPort(8787)
const webPort = await preferredPort(3200)
const mcpPort = await preferredPort(8788)
const insights = await planInsights({ root: ROOT, webPort })

console.log(`\n${bold('basedb')} ${grey('— local stack')}\n`)

// PostgreSQL. The previous container is removed: two instances on different ports would
// confuse more than they would help.
spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' })
spawnSync(
  'docker',
  // biome-ignore format: the command reads better on one line
  ['run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=basedb', '-p', `${pgPort}:5432`, 'postgres:16-alpine'],
  { stdio: 'ignore' },
)

/** Synchronous wait, without depending on a `sleep` Windows does not have. */
function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

process.stdout.write(grey('  PostgreSQL 16 starting…'))
let ready = false
for (let i = 0; i < 60 && !ready; i++) {
  // A REAL query, not `pg_isready`: the official image starts a temporary server for
  // `initdb`, during which the socket already listens but every connection is refused
  // with `57P03 the database system is starting up`. The probe must therefore test what
  // we actually want to do — run SQL.
  ready =
    spawnSync('docker', ['exec', CONTAINER, 'psql', '-U', 'postgres', '-c', 'SELECT 1'], {
      stdio: 'ignore',
    }).status === 0
  if (!ready) wait(1000)
}
require_(ready, '\nPostgreSQL did not start.')
console.log(`\r  ${green('✓')} PostgreSQL     ${cyan(`localhost:${pgPort}`)}          `)

const DATABASE_URL = `postgres://postgres:basedb@localhost:${pgPort}/postgres`

// insights' own services — its catalog, Trino — from its docker-compose.yml. Trino takes
// a minute to answer; insights waits for it, and its pages open meanwhile.
if (insights.dir !== undefined) {
  const up = spawnSync('docker', ['compose', 'up', '-d', 'catalog', 'trino'], {
    cwd: insights.dir,
    stdio: 'ignore',
  })
  if (up.status !== 0) {
    console.log(
      `  ${red('✗')} insights       ${grey(`docker compose up failed in ${insights.dir}`)}`,
    )
  }
}

/** Starts a child process and relays its output, prefixed. */
function start(name, command, args, env, cwd = ROOT) {
  // No `shell: true`: every process is launched with an explicit path, so there is
  // nothing to interpret — and a shell would concatenate the arguments without escaping
  // them.
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env } })
  const prefix = grey(`  ${name.padEnd(4)} │ `)
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (line.trim() !== '') console.log(prefix + line)
      }
    })
  }
  return child
}

// A FIXED development key and password, printed below. Fixed on purpose: a value that
// changed on every launch would log you out of your own browser each time, and this is
// a throwaway container. Production sets both from the environment, and the server
// refuses to authenticate without a key rather than inventing one.
const DEV_KEY = 'developpement-seulement-ne-pas-utiliser-en-production'
const DEV_EMAIL = 'admin@basedb.local'
const DEV_PASSWORD = 'developpement-basedb'

const api = start('api', SERVER, [], {
  DATABASE_URL,
  PORT: String(apiPort),
  // MCP is served on the API's `/mcp` and, for the clients configured with it, on its own port.
  BASEDB_MCP_PORT: String(mcpPort),
  BASEDB_MIGRATE: '1',
  BASEDB_BOOTSTRAP: '1',
  BASEDB_ENCRYPTION_KEY: process.env.BASEDB_ENCRYPTION_KEY || DEV_KEY,
  // Named here, so the administrator exists before the interface opens. Production
  // names nobody: there, the first visit to the interface creates it.
  BASEDB_ADMIN_EMAIL: process.env.BASEDB_ADMIN_EMAIL || DEV_EMAIL,
  BASEDB_ADMIN_PASSWORD: process.env.BASEDB_ADMIN_PASSWORD || DEV_PASSWORD,
  // The login form is prefilled with that address.
  BASEDB_DEV_LOGIN: '1',
  // Reset links are printed here rather than sent: this container is thrown away, and
  // there is no SMTP to configure against it.
  BASEDB_DEV_MAIL: '1',
  // insights is wired here by its addresses (insights-dev.mjs), or not at all: the `1` a
  // `.env` copied from `.env.example` holds is docker compose's, not this server's.
  BASEDB_INSIGHTS: '0',
  ...(insights.basedbEnv ?? {}),
})

// The credentials are announced once the API says it has bootstrapped: having to hunt
// them out of a log would be the first friction of getting started.
let announced = false
api.stdout.on('data', (chunk) => {
  const found = /Bootstrap(?:ped| already done) — (\S+)/.exec(String(chunk))
  if (found !== null && !announced) {
    announced = true
    console.log(`\n  ${green('✓')} API            ${cyan(`http://localhost:${apiPort}`)}`)
    console.log(`  ${green('✓')} Interface      ${cyan(`http://localhost:${webPort}`)}`)
    console.log(`  ${green('✓')} MCP            ${cyan(`http://localhost:${mcpPort}/mcp`)}`)
    if (insights.dir !== undefined) {
      console.log(`  ${green('✓')} insights       ${cyan(insights.publicUrl)}`)
      if (insights.sharedOpa) {
        console.log(
          grey(
            `                   port 4200 taken: Trino asks the insights server there, not this one (${insights.apiPort})`,
          ),
        )
      }
    } else {
      console.log(grey(`  · insights       not started: ${insights.skipped}`))
    }
    console.log(
      `\n  ${bold('Connexion')}   ${cyan(found[1])}   ${cyan(process.env.BASEDB_ADMIN_PASSWORD || DEV_PASSWORD)}`,
    )
    console.log(grey(`\n  psql "${DATABASE_URL}"`))
    console.log(grey('  Ctrl+C stops everything, container included.\n'))

    // The browser opens itself when asked for it — the VSCode launch asks. Done here
    // rather than by the editor's `serverReadyAction`, which reads the process output
    // and behaves differently depending on which console a launch attaches to. The
    // script is the one that knows the port and knows the interface is up.
    if (process.env.BASEDB_OPEN === '1') {
      const [command, prefix] =
        process.platform === 'win32' ? ['cmd', ['/c', 'start', '']] : ['open', []]
      spawn(command, [...prefix, `http://localhost:${webPort}`], {
        stdio: 'ignore',
        detached: true,
      }).unref()
    }
  }
})

// Next's cache is removed on every launch. `next build` and `next dev` write into the
// SAME directory with different formats: after a build, the development server serves
// chunks that do not exist and the screen stays blank, with nothing to explain why.
// Recompiling costs a second.
rmSync(`${ROOT}apps/web/.next`, { recursive: true, force: true })

const web = start(
  'web',
  'node',
  ['node_modules/next/dist/bin/next', 'dev', '--port', String(webPort)],
  {
    BASEDB_API: `http://localhost:${apiPort}`,
    BASEDB_MCP: `http://localhost:${mcpPort}/mcp`,
    ...(insights.basedbWebEnv ?? {}),
  },
  `${ROOT}apps/web`,
)

const children = [
  api,
  web,
  ...(insights.dir === undefined ? [] : startInsights(insights, start, { apiPort })),
]

let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  console.log(grey('\n  stopping…'))
  for (const p of children) p.kill()
  spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' })
  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop)
for (const p of children) p.on('exit', stop)
