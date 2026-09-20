import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `@basedb/catalog-schema` — the DDL of the `_basedb` catalog and the colocated
 * `_basedb_local` schema, with no logic whatsoever (chapter 10 §1.2).
 *
 * The migrations are GENERATED from chapter 02, which is authoritative:
 * `node scripts/extract-catalog-ddl.mjs --write`.
 */

const ROOT = fileURLToPath(new URL('../migrations', import.meta.url))

export interface CatalogMigration {
  /** Order number, taken from the file name. */
  readonly version: number
  readonly name: string
  readonly sql: string
}

/** The catalog migrations, in application order. */
export function catalogMigrations(): CatalogMigration[] {
  return readdirSync(ROOT)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({
      version: Number.parseInt(name.slice(0, 4), 10),
      name,
      sql: readFileSync(join(ROOT, name), 'utf8'),
    }))
}

/** The two schemas of the product, fixed and not configurable (A9). */
export const CATALOG_SCHEMA = '_basedb'
export const LOCAL_SCHEMA = '_basedb_local'
