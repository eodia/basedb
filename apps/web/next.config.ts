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
  env: {
    BASEDB_API: process.env.BASEDB_API ?? 'http://localhost:8787',
  },
}

export default config
