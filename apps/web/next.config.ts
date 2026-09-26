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
  // No `env` block for BASEDB_API: Next would inline its build-time value into the
  // SERVER code too, and the address the layout reads at run time (app/layout.tsx)
  // would be frozen into the image. The browser gets it from the layout.
}

export default config
