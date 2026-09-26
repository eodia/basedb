import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The official base templates — chapter 20 §3.1: one JSON file per template in
 * `catalog/`, which the public site publishes and which the application carries, as they
 * were when it was built, for when the site cannot be read.
 *
 * Data only: what a template means, and whether it holds, is `@basedb/contracts`'s.
 */

/** Where the files are — the site reads the same directory. */
export const CATALOG_DIR = fileURLToPath(new URL('../catalog/', import.meta.url))

export interface BundledTemplate {
  /** The file's name, `suivi-tickets.json`. */
  readonly file: string
  /** Its JSON, unchecked — `null` when the file does not parse. */
  readonly raw: unknown
}

/** Every file of the catalog, in the order of their names. */
export function bundledTemplates(): BundledTemplate[] {
  return readdirSync(CATALOG_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return { file, raw: JSON.parse(readFileSync(`${CATALOG_DIR}${file}`, 'utf8')) as unknown }
      } catch {
        return { file, raw: null }
      }
    })
}
