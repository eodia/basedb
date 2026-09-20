import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BUDGETS, slugify } from '../src/index.js'

/**
 * Locale independence — chapter 10 §7.4.
 *
 * Two targeted checks rather than one global job: the static ban on locale-dependent
 * APIs, and replaying these tests under `LC_ALL=tr_TR.UTF-8`.
 */

const SRC = join(fileURLToPath(new URL('../src', import.meta.url)))

/**
 * The real hazard in JavaScript: `toLowerCase` is locale-independent, its `Locale`
 * variants are not. An accidental substitution would produce different physical names
 * depending on the machine running the engine — unacceptable for a value written into
 * DDL, replayed in a migration and compared across environments.
 */
const FORBIDDEN = ['toLocaleLowerCase', 'toLocaleUpperCase', 'localeCompare', 'Intl.Collator']

describe('static ban on locale-dependent APIs', () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

  it('the package does contain sources to inspect', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    it(`src/${file} uses no locale-dependent API`, () => {
      const source = readFileSync(join(SRC, file), 'utf8')
      // Comments quote these names to explain the ban: only code lines are examined,
      // comment lines are set aside.
      const code = source
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n')
      for (const api of FORBIDDEN) {
        expect(code, `${file} must not call ${api}`).not.toContain(api)
      }
    })
  }
})

describe('case folding stays stable under any locale', () => {
  // This block is replayed by CI under LC_ALL=tr_TR.UTF-8. Under the Turkish locale, a
  // locale-dependent folding would turn `I` into `ı` (dotless i), and `Istanbul` would
  // yield `_stanbul` after filtering — the test would then fail right here.
  const asTable = (label: string) => slugify(label, { max: BUDGETS.table, nature: 'table' }).slug

  it('uppercase I → i, never ı', () => {
    expect(asTable('Istanbul')).toBe('istanbul')
    expect(asTable('IL EST ICI')).toBe('il_est_ici')
  })

  it('İ (I with dot above) → i', () => {
    expect(asTable('İstanbul')).toBe('istanbul')
  })

  it('effective process locale, for information', () => {
    // Does not fail the suite: documents which locale the job ran under.
    const locale = process.env.LC_ALL ?? process.env.LANG ?? '(unset)'
    expect(typeof locale).toBe('string')
  })
})
