import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

/**
 * `apps/web` ne dépend NI de `@basedb/core`, NI de `@basedb/http`, NI de
 * `@basedb/auth`, NI de `@basedb/ai` — ni directement, ni transitivement (chapitre 10
 * §1.3, interdit 1). Le front parle HTTP, point.
 *
 * Sans cette règle, une action serveur Next.js finirait par ouvrir une connexion
 * PostgreSQL et contourner la couche de permissions.
 */
/**
 * The path basedb is served under — `/basedb` behind a gateway at
 * `https://gateway.exemple.fr/basedb/`, empty at the root of its own address.
 *
 * Next fixes it at build time, and the Docker image is built once for every address: its
 * build carries a marker instead, which the image replaces with `BASEDB_BASE_PATH` as it
 * starts (docker/image/start.mjs). Outside the image, the variable is read here directly.
 */
const BASE_PATH_MARKER = '/__basedb_base_path__'

function basePathOf(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '')
  if (trimmed === '') return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/**
 * The interface as static files (`BASEDB_WEB_STATIC=1`): no Node process at run time.
 * basedb-server serves them (rust-server/crates/web) and does per request what the server
 * of Next does otherwise — the layout's runtime script, the language, `?lang=`, the frame
 * rule of `/v/`, the base path (the build carries the marker, as the image's does). Written
 * to `out-static` (BASEDB_WEB_STATIC_DIR): Next keeps its own build in `.next` beside it,
 * leaving a development server's `.next/dev` alone.
 */
const staticExport = process.env.BASEDB_WEB_STATIC === '1'

const basePath =
  process.env.BASEDB_WEB_STANDALONE === '1' || staticExport
    ? BASE_PATH_MARKER
    : basePathOf(process.env.BASEDB_BASE_PATH)

// A shared view may be framed by another site only at `/v/<jeton>?embed=1`, and only
// when its sharing allows it — which the page checks (ch. 15 §10). Anywhere else under
// `/v/`, no frame.
const headers: NextConfig['headers'] = async () =>
  ['/v/:token'].map((source) => ({
    source,
    missing: [{ type: 'query' as const, key: 'embed', value: '1' }],
    headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }],
  }))

// Development only (scripts/start.mjs): insights, started beside basedb, served under
// `/insights` as the Docker image's proxy serves it — its API straight, its interface
// (built with that base path) as is. Before the pages: `[...address]` takes any path.
const rewrites: NextConfig['rewrites'] = async () => {
  const web = process.env.BASEDB_INSIGHTS_WEB
  const insightsApi = process.env.BASEDB_INSIGHTS_API
  if (!web || !insightsApi) return { beforeFiles: [], afterFiles: [], fallback: [] }
  return {
    beforeFiles: [
      { source: '/insights/api/:path*', destination: `${insightsApi}/api/:path*` },
      { source: '/insights', destination: `${web}/insights` },
      { source: '/insights/:path*', destination: `${web}/insights/:path*` },
    ],
    afterFiles: [],
    fallback: [],
  }
}

const config: NextConfig = {
  transpilePackages: ['@basedb/contracts'],
  ...(basePath === '' ? {} : { basePath }),
  // Inlined where the code must write an address by hand (lib/base-path.ts): the history
  // of the address bar, the links a person copies to share. And whether the pages are
  // static shells (app/layout.tsx, lib/static-shell.ts).
  env: { BASEDB_BASE_PATH_BUILT: basePath, BASEDB_WEB_STATIC_BUILT: staticExport ? '1' : '' },
  // Development only: Next's badge sits bottom-left by default — on the profile menu,
  // which holds the documentation, the integrations and the administration.
  devIndicators: { position: 'bottom-right' },
  // The Docker image (Dockerfile, target `web`) serves a self-contained server:
  // `next build` then traces what it needs into `.next/standalone`, from the root of the
  // monorepo so that the workspace packages come along. Off elsewhere: `next start`
  // does not serve a standalone build.
  ...(process.env.BASEDB_WEB_STANDALONE === '1'
    ? {
        output: 'standalone' as const,
        outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
      }
    : {}),
  // Static files: no server to send headers or rewrite — basedb-server sends the frame rule.
  ...(staticExport
    ? { output: 'export' as const, distDir: process.env.BASEDB_WEB_STATIC_DIR || 'out-static' }
    : { headers, rewrites }),
  // The relay buffers each request body: insights' copilot attachments (20 MB, base64).
  // Its first answer waits for insights' first compilation: more than the 30 s default.
  experimental: { proxyClientMaxBodySize: '30mb', proxyTimeout: 180_000 },
  // No `env` block for BASEDB_API: Next would inline its build-time value into the
  // SERVER code too, and the address the layout reads at run time (app/layout.tsx)
  // would be frozen into the image. The browser gets it from the layout.
}

export default config
