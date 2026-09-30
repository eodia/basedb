/**
 * basedb in one container: the API, the MCP server and the interface, behind Caddy on one
 * port. The image's entry point (Dockerfile, target `basedb`).
 *
 *   /api/*, /auth/*, /healthz  → the API        127.0.0.1:8787
 *   /mcp                       → the MCP server 127.0.0.1:8788
 *   everything else            → the interface  127.0.0.1:3001
 *
 * Behind a gateway at `https://gateway.exemple.fr/basedb/`, all of it under `/basedb`
 * (`BASEDB_BASE_PATH`, or the path of `BASEDB_PUBLIC_URL`): the interface's build carries a
 * marker where that path goes, written here before it starts, and the router takes the
 * requests with the path — a gateway that keeps it — or without — one that strips it.
 *
 * The API starts first — it applies the catalog on an empty database — and the MCP server
 * once it answers. If any process stops, the others are stopped too and the container
 * exits: the restart policy starts it again whole, rather than half of it running.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { createInterface } from 'node:readline'

const env = process.env
const INTERNAL = { api: 8787, mcp: 8788, web: 3001 }
// Stopping gracefully first; after this, whatever still runs is killed.
const GRACE_MS = 10_000
// The first start applies the catalog, which takes a few seconds on a slow disk.
const API_READY_MS = 180_000

/** Where the interface's build left the path it is served under (apps/web/next.config.ts). */
const MARKER = '/__basedb_base_path__'

/** `BASEDB_BASE_PATH`, else the path of `BASEDB_PUBLIC_URL`: `/basedb`, or empty at the root. */
function basePathOf() {
  // Empty counts as unset, as everywhere in the compose file; `/` says the root.
  let raw = env.BASEDB_BASE_PATH?.trim() ? env.BASEDB_BASE_PATH : undefined
  if (raw === undefined) {
    try {
      raw = env.BASEDB_PUBLIC_URL ? new URL(env.BASEDB_PUBLIC_URL).pathname : ''
    } catch {
      raw = ''
    }
  }
  const trimmed = raw.trim().replace(/\/+$/, '')
  const path = trimmed === '' ? '' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (!/^(\/[A-Za-z0-9._~-]+)*$/.test(path)) {
    console.error(`[basedb] BASEDB_BASE_PATH « ${raw} » : letters, digits, . _ ~ - and / only`)
    process.exit(1)
  }
  return path
}

const basePath = basePathOf()

const BACKSLASH = String.fromCharCode(92)

/**
 * One file with the path in place of the marker. The marker comes with its slash, so that
 * at the root it goes with it: `/__basedb_base_path__/_next/` → `/_next/`. Its escaped
 * spelling first — `\/` in a regular expression the build wrote as a string, where each
 * `/` of the path must be escaped alike.
 */
function withPath(source, name) {
  let text = source
  for (const slash of [`${BACKSLASH}${BACKSLASH}/`, '/']) {
    text = text.replaceAll(`${slash}${MARKER.slice(1)}`, basePath.split('/').join(slash))
  }
  // The build under a path redirects `/basedb/` to `/basedb`: at the root, that would be
  // `/` to nothing. Next writes no such redirect for the root; neither does this.
  if (basePath === '' && name === 'routes-manifest.json') {
    const manifest = JSON.parse(text)
    manifest.redirects = manifest.redirects.filter(
      (redirect) =>
        !(redirect.internal && redirect.basePath === false && redirect.destination === ''),
    )
    text = JSON.stringify(manifest, null, 2)
  }
  return text
}

/**
 * Writes the path into the interface's build, where its marker is. The originals are kept
 * aside, so that a restart with another path starts again from them.
 */
function placeInterface() {
  const root = '/app/web/apps/web'
  const pristine = '/app/web/.pristine'
  let written = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(js|json|html|rsc|txt|css|meta|body)$/.test(entry.name)) {
        const kept = join(pristine, relative(root, path))
        const source = readFileSync(existsSync(kept) ? kept : path, 'utf8')
        if (!source.includes(MARKER)) continue
        if (!existsSync(kept)) {
          mkdirSync(dirname(kept), { recursive: true })
          writeFileSync(kept, source)
        }
        writeFileSync(path, withPath(source, entry.name))
        written++
      }
    }
  }
  walk(root)
  return written
}

/** The router, when basedb is served under a path — requests taken with it or without. */
function routerUnder(path) {
  return `{
	admin off
	auto_https off
	persist_config off
	servers {
		trusted_proxies static private_ranges
	}
	log {
		level ERROR
	}
}

:{$PORT:3000} {
	encode zstd gzip

	@api path ${path}/api/* ${path}/auth/* ${path}/healthz /api/* /auth/* /healthz
	handle @api {
		uri strip_prefix ${path}
		reverse_proxy 127.0.0.1:8787
	}

	@mcp path ${path}/mcp* /mcp*
	handle @mcp {
		uri strip_prefix ${path}
		reverse_proxy 127.0.0.1:8788 {
			flush_interval -1
		}
	}

	# The interface wants its path: put back when a gateway took it off. The root becomes
	# the path itself, not the path and a slash — which the interface would redirect to the
	# path, which the gateway would take off again, and so on.
	@root path /
	handle @root {
		rewrite * ${path}
		reverse_proxy 127.0.0.1:3001
	}

	@bare not path ${path} ${path}/*
	handle @bare {
		rewrite * ${path}{uri}
		reverse_proxy 127.0.0.1:3001
	}

	handle {
		reverse_proxy 127.0.0.1:3001
	}
}
`
}

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
    // `/`: this page's own origin, whatever the address basedb is reached by — under the
    // path it is served under.
    BASEDB_API: env.BASEDB_API || `${basePath}/`,
    BASEDB_MCP: env.BASEDB_MCP || `${basePath}/mcp`,
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

const placed = placeInterface()
let caddyfile = '/app/Caddyfile'
if (basePath !== '') {
  caddyfile = '/tmp/Caddyfile'
  writeFileSync(caddyfile, routerUnder(basePath))
  console.log(`[basedb] served under ${basePath}/ (${placed} files of the interface set)`)
}

run('proxy', 'caddy', ['run', '--config', caddyfile, '--adapter', 'caddyfile'], {
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
  console.log(
    `[basedb] ready on port ${env.PORT || '3000'}: the interface, ${basePath}/api and ${basePath}/mcp`,
  )
} else if (!stopping) {
  console.error('[basedb] the API did not answer in time: stopping the container')
  stop(1)
}
