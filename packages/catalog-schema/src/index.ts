import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `@basedb/catalog-schema` — the DDL of the `_basedb` catalog and the colocated
 * `_basedb_local` schema, with no logic whatsoever (chapter 10 §1.2).
 *
 * One file per catalog migration, `NNNN_nom.sql`, numbered from 1 without a gap and
 * applied in that order at startup (chapter 02, « Amorçage »). A migration that has been
 * PUBLISHED is never edited again: an installation has applied it, recorded its checksum,
 * and refuses to start on a catalog whose history it cannot vouch for. What changes after
 * it goes into the next one. `migrations/sealed.json` lists the published ones, and
 * `node scripts/catalog-migrations.mjs` creates, seals and checks them.
 */

const ROOT = fileURLToPath(new URL('../migrations', import.meta.url))

const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/

export interface CatalogMigration {
  /** Order number, taken from the file name: 1, 2, 3… without a gap. */
  readonly version: number
  readonly name: string
  readonly sql: string
  /** SHA-256 of the file, what `_basedb.catalog_migration.checksum` records. */
  readonly checksum: Buffer
}

/**
 * The checksum of a migration's text. Line endings are brought to LF first: a checkout
 * on Windows turns them into CRLF, and a migration must not look tampered with for it.
 */
export function checksumOf(sql: string): Buffer {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest()
}

/**
 * The catalog migrations, in application order.
 *
 * A misnamed file, or a gap in the numbering, stops everything here: applied in the
 * wrong order, or with one missing, a migration would build a catalog nobody tested.
 */
export function catalogMigrations(): CatalogMigration[] {
  const files = readdirSync(ROOT)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  return files.map((name, index) => {
    const match = NAME.exec(name)
    if (match === null) {
      throw new Error(`Migration de catalogue mal nommée : ${name} (attendu NNNN_nom.sql).`)
    }
    const version = Number.parseInt(match[1] as string, 10)
    if (version !== index + 1) {
      throw new Error(
        `Migrations de catalogue non consécutives : ${name} devrait porter le numéro ${index + 1}.`,
      )
    }
    const sql = readFileSync(join(ROOT, name), 'utf8')
    return { version, name, sql, checksum: checksumOf(sql) }
  })
}

/** A published migration, as `migrations/sealed.json` freezes it. */
export interface SealedMigration {
  readonly version: number
  readonly name: string
  /** Hex SHA-256 — `checksumOf` of the file as it was published. */
  readonly sha256: string
  /** The first version of basedb that shipped it. */
  readonly release: string
}

/** The published migrations: their text may never change again. */
export function sealedMigrations(): readonly SealedMigration[] {
  return JSON.parse(readFileSync(join(ROOT, 'sealed.json'), 'utf8')) as SealedMigration[]
}

/** The two schemas of the product, fixed and not configurable (A9). */
export const CATALOG_SCHEMA = '_basedb'
export const LOCAL_SCHEMA = '_basedb_local'
