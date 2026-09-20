import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  BUDGETS,
  type SlugNature,
  applyNameRestrictions,
  budgetForNature,
  byteLength,
  isAlphabetA,
  isReservedForScope,
  slugify,
} from '../src/index.js'

/** Deterministic generator injected in place of the fallback's cryptographic draw. */
const fixedRandom = (chars: string) => (count: number) => chars.slice(0, count)

const asTable = (label: string) =>
  slugify(label, { max: BUDGETS.table, nature: 'table', randomChars: fixedRandom('k3f9x2') })

describe('chapter 01 §12 — end-to-end examples', () => {
  // Table, MAX = 48. The cases whose final name depends on the suffix loop
  // (`resume_2`, `select_2`, `time_2`, `clients_2`) are checked further down: the loop
  // belongs to allocation, which touches the registry and lives in `@basedb/core`.
  const cases: ReadonlyArray<[label: string, expected: string, why: string]> = [
    ['Clients', 'clients', 'nominal case'],
    ['Résumé', 'resume', 'NFKD then removal of marks'],
    ['Resume', 'resume', 'same slug as "Résumé", the suffix comes from allocation'],
    ['Straße', 'strasse', 'transliteration table'],
    ['ﬁche produit', 'fiche_produit', 'NFKD decomposes the ﬁ ligature'],
    ['İstanbul', 'istanbul', 'NFKD isolates the dot above, removed at step 2'],
    ['Chiffre d’affaires (€)', 'chiffre_d_affaires', 'apostrophe, parentheses and € → _'],
    ['🚀 Lancement 2026', 'lancement_2026', 'emoji → _, stripped at the start'],
    ['2024 ventes', 'n_2024_ventes', 'slug starting with a digit → n_ prefix'],
    ['½ journée', 'n_1_2_journee', 'NFKD splits ½; the fraction slash becomes _'],
    ['Mon.Site.com', 'mon_site_com', 'the dot is free in a label, forbidden in a physical name'],
    ['_id', 'id', 'leading underscores are stripped'],
    [
      'Liste des contrats de prévoyance collective souscrits par les entreprises de plus de cinquante salariés en 2024',
      'liste_des_contrats_de_prevoyance_collective_sous',
      'hard truncation at 48 bytes',
    ],
  ]

  for (const [label, expected, why] of cases) {
    it(`"${label}" → ${expected} (${why})`, () => {
      expect(asTable(label).slug).toBe(expected)
    })
  }

  it('"zz_archive" → x_zz_archive (escaping, not the suffix loop)', () => {
    const { slug } = asTable('zz_archive')
    expect(applyNameRestrictions(slug, 'table', BUDGETS.table).candidate).toBe('x_zz_archive')
  })

  it('"PG monitoring" → x_pg_monitoring', () => {
    const { slug } = asTable('PG monitoring')
    expect(applyNameRestrictions(slug, 'table', BUDGETS.table).candidate).toBe('x_pg_monitoring')
  })

  it('"Клиенты" → fallback, no character retained', () => {
    const result = asTable('Клиенты')
    expect(result.fallbackApplied).toBe(true)
    expect(result.slug).toBe('table_k3f9x2')
  })

  it('"..." → fallback, punctuation only', () => {
    const result = slugify('...', {
      max: BUDGETS.table,
      nature: 'table',
      randomChars: fixedRandom('m7d2qs'),
    })
    expect(result.fallbackApplied).toBe(true)
    expect(result.slug).toBe('table_m7d2qs')
  })

  it('"select" and "Time" are unavailable and go through the suffix loop', () => {
    // catcode R for `select`, catcode C for `time`: the latter avoids
    // `SELECT time FROM t`.
    expect(isReservedForScope(asTable('select').slug, 'table')).toBe(true)
    expect(isReservedForScope(asTable('Time').slug, 'table')).toBe(true)
    // No reserved-word check applies to the base slug (§4).
    expect(isReservedForScope('select', 'base')).toBe(false)
  })
})

describe('chapter 10 §7.4 — properties over arbitrary Unicode strings', () => {
  const natures: SlugNature[] = ['base', 'table', 'champ']
  const budgetOf = budgetForNature

  const arbLabel = fc.string({ minLength: 1, maxLength: 255 })
  const arbNature = fc.constantFrom(...natures)

  it('the result always satisfies alphabet A', () => {
    fc.assert(
      fc.property(arbLabel, arbNature, (label, nature) => {
        const { slug } = slugify(label, { max: budgetOf(nature), nature })
        return isAlphabetA(slug)
      }),
      { numRuns: 2000 },
    )
  })

  it('the length in BYTES never exceeds the applicable budget', () => {
    fc.assert(
      fc.property(arbLabel, arbNature, (label, nature) => {
        const max = budgetOf(nature)
        const { slug, fallbackApplied } = slugify(label, { max, nature })
        // The fallback name is short by construction (`nature` + `_` + 6) and is not
        // subject to truncation: it is checked separately.
        return fallbackApplied ? byteLength(slug) <= max : byteLength(slug) <= max
      }),
      { numRuns: 2000 },
    )
  })

  it('never a leading, trailing or doubled _', () => {
    fc.assert(
      fc.property(arbLabel, arbNature, (label, nature) => {
        const { slug } = slugify(label, { max: budgetOf(nature), nature })
        return !slug.startsWith('_') && !slug.endsWith('_') && !slug.includes('__')
      }),
      { numRuns: 2000 },
    )
  })

  it('idempotence: slug(slug(x)) = slug(x)', () => {
    fc.assert(
      fc.property(arbLabel, arbNature, (label, nature) => {
        const max = budgetOf(nature)
        const once = slugify(label, { max, nature })
        if (once.fallbackApplied) return true // the fallback draws randomness, out of contract
        const twice = slugify(once.slug, { max, nature })
        return twice.slug === once.slug
      }),
      { numRuns: 2000 },
    )
  })

  it('stability across normalization forms: NFC and NFD give the same slug', () => {
    fc.assert(
      fc.property(arbLabel, arbNature, (label, nature) => {
        const max = budgetOf(nature)
        const nfc = slugify(label.normalize('NFC'), { max, nature })
        const nfd = slugify(label.normalize('NFD'), { max, nature })
        if (nfc.fallbackApplied || nfd.fallbackApplied)
          return nfc.fallbackApplied === nfd.fallbackApplied
        return nfc.slug === nfd.slug
      }),
      { numRuns: 2000 },
    )
  })

  it('determinism: two calls on the same input give the same result', () => {
    fc.assert(
      fc.property(arbLabel, arbNature, (label, nature) => {
        const max = budgetOf(nature)
        const a = slugify(label, { max, nature, randomChars: fixedRandom('aaaaaa') })
        const b = slugify(label, { max, nature, randomChars: fixedRandom('aaaaaa') })
        return a.slug === b.slug && a.fallbackApplied === b.fallbackApplied
      }),
      { numRuns: 1000 },
    )
  })
})

describe('locale independence', () => {
  // `toLowerCase` is locale-independent; its `Locale` variants are not. This test holds
  // under any locale, and the CI job replays it under tr_TR.UTF-8.
  it('uppercase I never becomes a dotless i (Turkish folding)', () => {
    expect(asTable('Istanbul').slug).toBe('istanbul')
    expect(asTable('İstanbul').slug).toBe('istanbul')
    expect(asTable('IIII').slug).toBe('iiii')
  })

  it('the dotless ı is caught by the transliteration table', () => {
    expect(asTable('ıstanbul').slug).toBe('istanbul')
  })
})

describe('chapter 01 §3.2 step 2 — invisible characters removed, never replaced', () => {
  // Replacing them with `_` would introduce phantom separators into the physical name:
  // the worst possible outcome, because it is undetectable on reading.
  const invisibles: ReadonlyArray<[name: string, char: string]> = [
    ['soft hyphen U+00AD', '­'],
    ['zero width space U+200B', '​'],
    ['zero width non-joiner U+200C', '‌'],
    ['zero width joiner U+200D', '‍'],
    ['left-to-right mark U+200E', '‎'],
    ['variation selector U+FE00', '︀'],
    ['variation selector U+FE0F', '️'],
  ]

  for (const [name, char] of invisibles) {
    it(`${name} disappears without leaving a separator`, () => {
      expect(asTable(`cli${char}ents`).slug).toBe('clients')
    })
  }

  it('variation selectors are indeed of category Mn', () => {
    // Justifies that the U+FE00–U+FE0F range named by §3.2 is covered by \p{Mn} without
    // being repeated in the expression.
    for (let cp = 0xfe00; cp <= 0xfe0f; cp++) {
      expect(/\p{Mn}/u.test(String.fromCodePoint(cp))).toBe(true)
    }
  })
})
