/**
 * The catalog migrations — `packages/catalog-schema/migrations/NNNN_nom.sql`.
 *
 *   node scripts/catalog-migrations.mjs status          # each migration, sealed or not
 *   node scripts/catalog-migrations.mjs new <nom>       # the next file, ready to fill
 *   node scripts/catalog-migrations.mjs seal <version>  # freezes the unsealed ones, at a release
 *   node scripts/catalog-migrations.mjs check           # a sealed migration was edited?
 *   node scripts/catalog-migrations.mjs check --release # …and nothing left unsealed
 *
 * A published migration is never edited again: installations applied it and recorded its
 * checksum, and they refuse to start on a catalog whose history they cannot vouch for.
 * Whatever changes after it goes into the next one. `seal` runs when a version is tagged;
 * the publication workflow runs `check --release` and stops on anything unsealed.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../packages/catalog-schema/migrations', import.meta.url))
const SEALED = join(ROOT, 'sealed.json')
const NAME = /^(\d{4})_([a-z0-9_]+)\.sql$/

/** As `checksumOf` in `@basedb/catalog-schema`: SHA-256, line endings brought to LF. */
const checksumOf = (text) =>
  createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex')

function migrations() {
  return readdirSync(ROOT)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name, index) => {
      const match = NAME.exec(name)
      if (match === null) fail(`${name} : nom attendu NNNN_nom.sql (minuscules, chiffres, _).`)
      const version = Number.parseInt(match[1], 10)
      if (version !== index + 1) fail(`${name} devrait porter le numéro ${index + 1}.`)
      return { version, name, sha256: checksumOf(readFileSync(join(ROOT, name), 'utf8')) }
    })
}

const sealed = () => JSON.parse(readFileSync(SEALED, 'utf8'))

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/** Every sealed migration still exists, under its name, with its text. */
function verify(all, frozen) {
  const problems = []
  for (const s of frozen) {
    const found = all.find((m) => m.version === s.version)
    if (found === undefined) problems.push(`${s.name} (scellée en ${s.release}) a disparu.`)
    else if (found.name !== s.name)
      problems.push(`${s.name} (scellée) a été renommée en ${found.name}.`)
    else if (found.sha256 !== s.sha256) {
      const original = `git show v${s.release}:packages/catalog-schema/migrations/${s.name}`
      problems.push(
        `${s.name} a été modifiée après sa publication en ${s.release}. Remettez-la telle quelle (${original}) et écrivez le changement dans une nouvelle migration : pnpm catalog new <nom>`,
      )
    }
  }
  return problems
}

const [command, argument] = process.argv.slice(2)
const all = migrations()
const frozen = sealed()

switch (command) {
  case 'status': {
    for (const m of all) {
      const s = frozen.find((f) => f.version === m.version)
      const state =
        s === undefined
          ? 'à sceller'
          : s.sha256 === m.sha256
            ? `scellée (${s.release})`
            : 'MODIFIÉE'
      console.log(`${m.name.padEnd(40)} ${state}`)
    }
    break
  }

  case 'new': {
    if (argument === undefined || !/^[a-z0-9_]+$/.test(argument)) {
      fail('Donnez un nom en minuscules, chiffres et _ : new ajout_des_rappels')
    }
    const version = all.length + 1
    const name = `${String(version).padStart(4, '0')}_${argument}.sql`
    writeFileSync(
      join(ROOT, name),
      `-- ────────────────────────────────────────────────────────────────────────
-- ${String(version).padStart(4, '0')} — <ce que cette migration change, et pourquoi>
--
-- Appliquée au démarrage, dans sa propre transaction, après toutes les précédentes.
-- Ni transaction explicite, ni CREATE INDEX CONCURRENTLY : elle s'exécute déjà dans une.
-- Une fois publiée, elle ne change plus : la correction va dans la suivante.
-- ────────────────────────────────────────────────────────────────────────

`,
    )
    console.log(`✓ ${name} créée.`)
    break
  }

  case 'seal': {
    if (argument === undefined || !/^\d+\.\d+\.\d+/.test(argument)) {
      fail('Donnez la version publiée : seal 0.2.0')
    }
    const problems = verify(all, frozen)
    if (problems.length > 0) fail(problems.join('\n  '))
    const fresh = all.filter((m) => !frozen.some((s) => s.version === m.version))
    if (fresh.length === 0) {
      console.log('Rien à sceller.')
      break
    }
    const next = [...frozen, ...fresh.map((m) => ({ ...m, release: argument }))]
    writeFileSync(SEALED, `${JSON.stringify(next, null, 2)}\n`)
    for (const m of fresh) console.log(`✓ ${m.name} scellée pour ${argument}.`)
    break
  }

  case 'check': {
    const problems = verify(all, frozen)
    if (argument === '--release') {
      for (const m of all.filter((m) => !frozen.some((s) => s.version === m.version))) {
        problems.push(
          `${m.name} n'est pas scellée : node scripts/catalog-migrations.mjs seal <version>, puis commit.`,
        )
      }
    }
    if (problems.length > 0) fail(problems.join('\n  '))
    console.log(`✓ ${all.length} migration(s) de catalogue, ${frozen.length} scellée(s), intactes.`)
    break
  }

  default:
    fail('Commandes : status, new <nom>, seal <version>, check [--release]')
}
