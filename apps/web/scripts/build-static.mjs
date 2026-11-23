/**
 * The interface as static files, for basedb-server to serve without Node (next.config.ts,
 * `BASEDB_WEB_STATIC`): `next build`, then the messages of each language beside the pages —
 * the server puts the reader's in the page, as `app/layout.tsx` does otherwise.
 *
 *   pnpm --filter @basedb/web build:static     → apps/web/out-static (BASEDB_WEB_STATIC_DIR)
 *
 * `next build` rewrites `next-env.d.ts` for its own build: it is put back as it was, for the
 * development server beside.
 */

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(web, process.env.BASEDB_WEB_STATIC_DIR || 'out-static')
const nextEnv = join(web, 'next-env.d.ts')
const kept = readFileSync(nextEnv, 'utf8')

const next = createRequire(import.meta.url).resolve('next/dist/bin/next')
const built = spawnSync(process.execPath, [next, 'build'], {
  cwd: web,
  stdio: 'inherit',
  env: { ...process.env, BASEDB_WEB_STATIC: '1' },
})
writeFileSync(nextEnv, kept)
if (built.status !== 0) process.exit(built.status ?? 1)

const locales = join(web, 'src', 'locales')
const into = join(out, '_basedb', 'locales')
mkdirSync(into, { recursive: true })
let copied = 0
for (const name of readdirSync(locales)) {
  if (!name.endsWith('.json')) continue
  copyFileSync(join(locales, name), join(into, name))
  copied++
}
console.log(`[basedb] static interface in ${out} (${copied} catalogs in _basedb/locales)`)
