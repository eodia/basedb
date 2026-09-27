import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

/**
 * Where their texts in the other languages are: `i18n/<langue>/<clé>.json`, each the French
 * text → its translation (`localizeTemplate` of `@basedb/contracts` applies it).
 */
export const I18N_DIR = fileURLToPath(new URL('../i18n/', import.meta.url))

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

/**
 * The dictionaries of one language, by template key — empty for a language that has none
 * (French, the templates' own). A file that does not parse is left out.
 */
export function bundledDictionaries(locale: string): Record<string, Record<string, string>> {
  const dir = `${I18N_DIR}${locale}/`
  if (!/^[A-Za-z-]{2,10}$/.test(locale) || !existsSync(dir)) return {}
  const out: Record<string, Record<string, string>> = {}
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try {
      out[file.replace(/\.json$/, '')] = JSON.parse(readFileSync(`${dir}${file}`, 'utf8'))
    } catch {
      // Left out: the template reads in French.
    }
  }
  return out
}
