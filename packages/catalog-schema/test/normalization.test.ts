import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Confronting the folding function with the document — chapter 04 §1.8.
 *
 * The chapter is authoritative on the body of `fold_v1`. The SQL file is an operational
 * copy of it, and this test exists so that the copy cannot drift: the divergence would
 * be invisible otherwise. The function is declared `IMMUTABLE` and expression indexes
 * are built on it — a body that changes without the indexes being rebuilt makes them
 * WRONG without raising a single error, the only symptom being a row that cannot be
 * found by equality.
 *
 * The test fails in both directions: document changed without the file, file changed
 * without the document.
 */

const CHAPTER = fileURLToPath(
  new URL('../../../docs/architecture/04-types-de-champs.md', import.meta.url),
)
const FILE = fileURLToPath(new URL('../sql/fonctions-normalisation.sql', import.meta.url))

/** The ```sql blocks of the document that create a `_basedb_local` function. */
function chapterFunctions(): string[] {
  const markdown = readFileSync(CHAPTER, 'utf8')
  return [...markdown.matchAll(/```sql\n([\s\S]*?)```/g)]
    .map((m) => m[1].trim())
    .filter((body) => /^CREATE\s+FUNCTION\s+_basedb_local\./i.test(body))
}

/** Whitespace normalized: formatting is not what this test watches. */
function fingerprint(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

describe('fold_v1', () => {
  it('is defined exactly once in chapter 04', () => {
    expect(chapterFunctions()).toHaveLength(1)
  })

  it('has in the SQL file exactly the body the chapter fixes', () => {
    const [expected] = chapterFunctions()
    const file = readFileSync(FILE, 'utf8')

    // The file additionally carries a comment header and a COMMENT ON; it is the
    // definition itself that must match, character for character.
    const definition = /CREATE FUNCTION[\s\S]*?\$\$;/.exec(file)
    expect(definition).not.toBeNull()
    expect(fingerprint(definition?.[0] ?? '')).toBe(fingerprint(expected))
  })

  it('carries the four qualifiers its use in indexes depends on', () => {
    // `IMMUTABLE`: without it, PostgreSQL refuses the expression index. `STRICT`:
    // folding a NULL stays NULL, so the row satisfies no LIKE. The pinned
    // `search_path`: the SQL contract forbids any dependency on the session.
    const [body] = chapterFunctions()
    for (const qualifier of ['IMMUTABLE', 'STRICT', 'PARALLEL SAFE', 'SET search_path']) {
      expect(body).toContain(qualifier)
    }
  })

  it('collates the argument of lower() explicitly', () => {
    // Without that clause, the function would take the host database's default
    // collation, which basedb does not choose: folding Turkish, Greek or Lithuanian
    // would differ from one installation to another.
    const [body] = chapterFunctions()
    expect(body).toContain('COLLATE "und-x-icu"')
  })
})
