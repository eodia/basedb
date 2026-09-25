/**
 * Starts the whole stack — PostgreSQL, the API, the interface — in one command.
 *
 *   node scripts/start.mjs
 *
 * Picks free ports, applies the catalog, bootstraps an administrator, then keeps both
 * servers in the foreground. Ctrl+C stops everything, container included.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

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

require_(
  existsSync(`${ROOT}apps/api/dist/server.js`),
  'The API is not compiled.\n  Run: corepack pnpm exec tsc -b apps/api',
)
require_(
  spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0,
  'Docker is not responding. Start it, or provide DATABASE_URL yourself.',
)

const CONTAINER = 'basedb-local'
const pgPort = await freePort()
const apiPort = await freePort()
const webPort = await freePort()
// The MCP entry point is optional: compiled, it starts; otherwise the stack runs without.
const withMcp = existsSync(`${ROOT}apps/mcp/dist/server.js`)
const mcpPort = withMcp ? await preferredPort(8788) : null

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

/** Starts a child process and relays its output, prefixed. */
function start(name, command, args, env, cwd = ROOT) {
  // No `shell: true`: both processes are launched by `node` with an explicit path, so
  // there is nothing to interpret — and a shell would concatenate the arguments without
  // escaping them.
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
const DEV_PASSWORD = 'developpement-basedb'

const api = start('api', 'node', ['apps/api/dist/server.js'], {
  DATABASE_URL,
  PORT: String(apiPort),
  BASEDB_MIGRATE: '1',
  BASEDB_BOOTSTRAP: '1',
  BASEDB_ENCRYPTION_KEY: process.env.BASEDB_ENCRYPTION_KEY ?? DEV_KEY,
  BASEDB_ADMIN_PASSWORD: process.env.BASEDB_ADMIN_PASSWORD ?? DEV_PASSWORD,
  // Reset links are printed here rather than sent: this container is thrown away, and
  // there is no SMTP to configure against it.
  BASEDB_DEV_MAIL: '1',
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
    if (mcpPort !== null) {
      console.log(`  ${green('✓')} MCP            ${cyan(`http://localhost:${mcpPort}/mcp`)}`)
    }
    console.log(`\n  ${bold('Connexion')}   ${cyan(found[1])}   ${cyan(DEV_PASSWORD)}`)
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
    ...(mcpPort === null ? {} : { BASEDB_MCP: `http://localhost:${mcpPort}/mcp` }),
  },
  `${ROOT}apps/web`,
)

// The MCP entry point: its own process on the same database, as chapter 10 wants
// (`apps/api` and `apps/mcp` never reference each other). It applies nothing — the API
// owns the catalog — and opens no connection before its first request, so it can start
// alongside the API.
const mcp =
  mcpPort === null
    ? null
    : start('mcp', 'node', ['apps/mcp/dist/server.js'], {
        DATABASE_URL,
        BASEDB_MCP_PORT: String(mcpPort),
        BASEDB_ENCRYPTION_KEY: process.env.BASEDB_ENCRYPTION_KEY ?? DEV_KEY,
      })
const children = [api, web, ...(mcp === null ? [] : [mcp])]

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
