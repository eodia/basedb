#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { Basedb } from './client.js'
import { typesOf } from './generate.js'
import type { MetaBase } from './meta.js'

/**
 * `basedb-sdk types` — the types of the tables a token opens, written as TypeScript:
 *
 *   npx @basedb/sdk types --url https://basedb.example.com --token bdb_… --out src/basedb.ts
 *
 * The address and the token may come from the environment instead (`BASEDB_URL`,
 * `BASEDB_TOKEN`, `BASEDB_WORKSPACE`), so that no secret stays in a script. Every base the
 * token opens, or only those named with `--base`.
 */

const USAGE = `basedb-sdk types [options]

  --url <address>        where basedb is served            (or BASEDB_URL)
  --token <token>        an integration token, bdb_…       (or BASEDB_TOKEN)
  --workspace <ref>      the workspace, t4z56fq by default (or BASEDB_WORKSPACE)
  --base <name>          a base, by technical name; repeat for several — all by default
  --out <file>           where to write the types — standard output by default
`

function parse(argv: readonly string[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [key, inline] = arg.slice(2).split('=', 2)
    const value = inline ?? argv[++i]
    if (value === undefined) throw new Error(`--${key} needs a value`)
    out.set(key, [...(out.get(key) ?? []), value])
  }
  return out
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv
  if (command !== 'types') {
    process.stderr.write(USAGE)
    return command === undefined || command === '--help' || command === 'help' ? 0 : 2
  }
  const args = parse(rest)
  const url = args.get('url')?.[0] ?? process.env.BASEDB_URL
  const token = args.get('token')?.[0] ?? process.env.BASEDB_TOKEN
  if (url === undefined || token === undefined) {
    process.stderr.write(`basedb-sdk: an address and a token are needed.\n\n${USAGE}`)
    return 2
  }
  const db = new Basedb({
    url,
    token,
    workspace: args.get('workspace')?.[0] ?? process.env.BASEDB_WORKSPACE,
  })
  const names = args.get('base') ?? (await db.bases()).map((b) => b.name)
  const bases: MetaBase[] = []
  for (const name of names) bases.push(await db.base(name).describe())
  const source = typesOf(bases, { source: url.replace(/\/+$/, '') })
  const out = args.get('out')?.[0]
  if (out === undefined) process.stdout.write(source)
  else {
    writeFileSync(out, source)
    const tables = bases.reduce((n, b) => n + b.tables.length, 0)
    process.stderr.write(`basedb-sdk: ${bases.length} base(s), ${tables} table(s) → ${out}\n`)
  }
  return 0
}

// `exitCode`, not `exit()`: the process ends once fetch's connections have closed — cut
// short, Node on Windows aborts on a handle that is still closing.
main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    process.stderr.write(`basedb-sdk: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  },
)
