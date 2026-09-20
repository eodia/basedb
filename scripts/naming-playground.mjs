/**
 * Naming playground — runs a label through the whole chain of chapter 01 and shows
 * what the engine would make of it.
 *
 *   node scripts/naming-playground.mjs "Liste des contrats de prévoyance"
 *   node scripts/naming-playground.mjs            # replays the examples of §12
 *
 * Requires `@basedb/naming` to be compiled: `corepack pnpm exec tsc -b packages/naming`.
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const distUrl = new URL('../packages/naming/dist/index.js', import.meta.url)
if (!existsSync(fileURLToPath(distUrl))) {
  console.error(
    'The @basedb/naming package is not compiled.\n' +
      'Run first:  corepack pnpm exec tsc -b packages/naming',
  )
  process.exit(1)
}

const n = await import(distUrl.href)

const TENANT = 't4z56fq'

/** Normative examples of chapter 01 §12, replayed when no label is supplied. */
const EXAMPLES = [
  'Clients',
  'Résumé',
  'Straße',
  'ﬁche produit',
  'İstanbul',
  "Chiffre d'affaires (€)",
  '🚀 Lancement 2026',
  '2024 ventes',
  '½ journée',
  'select',
  'Time',
  'Mon.Site.com',
  '_id',
  'zz_archive',
  'PG monitoring',
  'Клиенты',
  '...',
  'Liste des contrats de prévoyance collective souscrits par les entreprises de plus de cinquante salariés en 2024',
]

const grey = (s) => `[90m${s}[0m`
const bold = (s) => `[1m${s}[0m`
const green = (s) => `[32m${s}[0m`
const yellow = (s) => `[33m${s}[0m`

/** Unrolls a label for a given scope: slug, restrictions, proposed final name. */
function process_(label, scope) {
  // `champ` is the normative value of `SlugNature`, which ends up inside a physical
  // name: it stays French, unlike the scope identifier.
  const nature = scope === 'field' ? 'champ' : scope
  const max = n.budgetForNature(nature)

  const { slug, fallbackApplied } = n.slugify(label, { max, nature })
  const { candidate, needsSuffixLoop } = n.applyNameRestrictions(slug, scope, max)

  const notes = []
  if (fallbackApplied) notes.push(yellow('SLUG_FALLBACK_APPLIED'))
  if (candidate !== slug) notes.push(grey(`escaped from "${slug}"`))
  if (needsSuffixLoop) {
    const code = n.RESERVED_WORDS.get(candidate)
    notes.push(yellow(`reserved word (catcode ${code}) → suffix loop: ${candidate}_2`))
  }

  return { name: candidate, bytes: n.byteLength(candidate), notes }
}

function show(label) {
  console.log(`\n${bold(`"${label}"`)}`)

  // Computed once per scope: the fallback of §3.5 draws randomness, so two calls on the
  // same label would not give the same name.
  const results = {
    base: process_(label, 'base'),
    table: process_(label, 'table'),
    field: process_(label, 'field'),
  }

  for (const scope of ['base', 'table', 'field']) {
    const { name, bytes, notes } = results[scope]
    const suffix = notes.length ? `  ${notes.join('  ')}` : ''
    console.log(`  ${scope.padEnd(6)} ${green(name.padEnd(50))} ${grey(`${bytes} B`)}${suffix}`)
  }

  // What it gives in the database: assembled schema and objects derived from the table.
  const table = results.table.name
  const schema = n.composeSchemaName(TENANT, results.base.name)

  console.log(grey('  ─ derived from the table name ─'))
  console.log(`  schema   ${schema} ${grey(`${n.byteLength(schema)} B`)}`)
  console.log(`  pk       ${n.primaryKeyName(table)}`)
  console.log(
    `  fk       ${n.foreignKeyName(table, 'clients_id')} ${grey(`${n.byteLength(n.foreignKeyName(table, 'clients_id'))} B`)}`,
  )
  console.log(`  index    ${n.indexName(table, ['clients_id'])}`)
  console.log(`  link     ${n.linkColumnName(table)}`)
  console.log(`  relegated ${n.relegatedName(table, new Date(Date.UTC(2026, 8, 18)))}`)
  console.log(`  SQL      ${n.qualify(schema, table)}`)
}

const args = process.argv.slice(2)
const labels = args.length > 0 ? args : EXAMPLES

if (args.length === 0) {
  console.log(grey('No label supplied — replaying the normative examples of chapter 01 §12.'))
  console.log(grey(`example tenantId: ${TENANT}`))
}

for (const label of labels) {
  show(label)
}

console.log()
