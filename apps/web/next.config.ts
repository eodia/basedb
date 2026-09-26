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
const config: NextConfig = {
  transpilePackages: ['@basedb/contracts'],
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
  // A shared view may be framed by another site only at `/v/<jeton>?embed=1`, and only
  // when its sharing allows it — which the page checks (ch. 15 §10). Anywhere else under
  // `/v/`, no frame.
  async headers() {
    return [
      {
        source: '/v/:token',
        missing: [{ type: 'query', key: 'embed', value: '1' }],
        headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }],
      },
    ]
  },
  // No `env` block for BASEDB_API: Next would inline its build-time value into the
  // SERVER code too, and the address the layout reads at run time (app/layout.tsx)
  // would be frozen into the image. The browser gets it from the layout.
}

export default config
