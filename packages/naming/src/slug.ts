import { byteLength } from './alphabet.js'
import { randomAlphabetChars } from './tenant.js'

/**
 * Slugification — chapter 01 §3.
 *
 * Input: a Unicode label ALREADY VALIDATED by §2.2 (non-empty, at most 255 characters,
 * stored in NFC) and a byte budget. The caller guarantees that validation;
 * slugification does not re-bound its input and does not re-validate it.
 *
 * The algorithm is pure and deterministic, with the single exception of the fallback
 * rule (§3.5), which draws randomness. It consults neither the catalog nor the
 * database: it is the allocation procedure (§6.1) that turns its output into a
 * physical name.
 */

/** Version of the algorithm, carried by `slug_version` in the registry (§3.8). */
export const SLUG_VERSION = 1

/**
 * The transliteration table of §3.3, applied AFTER lowercasing — its keys are
 * therefore lowercase.
 *
 * Closed for v1: it covers the Latin letters whose NFKD decomposition does not yield an
 * ASCII base. Any added entry changes the names produced, so it is versioned along with
 * the algorithm and has no retroactive effect.
 */
export const TRANSLITERATION: ReadonlyMap<string, string> = new Map([
  ['ß', 'ss'],
  ['æ', 'ae'],
  ['œ', 'oe'],
  ['ø', 'o'],
  ['þ', 'th'],
  ['ŋ', 'ng'],
  ['ƀ', 'b'],
  // `ı` → `i` acts as a safety net under step 3: if an implementation mistakenly
  // applied Turkish case folding, `I` would become `ı` and be brought back to `i` here
  // rather than turned into `_`.
  ['ı', 'i'],
  ['ł', 'l'],
  ['đ', 'd'],
  ['ð', 'd'],
  ['ħ', 'h'],
  ['ə', 'e'],
  ['ĸ', 'k'],
])

/**
 * Marks and invisible characters removed (not replaced) at steps 2 and 4.
 *
 * §3.2 names the variation selectors U+FE00–U+FE0F separately; they are of Unicode
 * category Mn and therefore already covered by `\p{Mn}`. Repeating them as a range
 * would add nothing — a test verifies this rather than assuming it.
 */
const MARKS_AND_INVISIBLES = /(?:\p{Mn}|\p{Me}|\p{Cc}|\p{Cf})/gu
/** Step 4: case folding creates marks, but never Cc. */
const MARKS_ONLY = /(?:\p{Mn}|\p{Me}|\p{Cf})/gu

/**
 * Object kind, which prefixes the fallback name of §3.5.
 *
 * `champ` is French on purpose: §3.5 fixes the produced PHYSICAL NAME as
 * `<nature>_<6 chars>`, with `<nature>` being `base`, `table` or `champ`. That value
 * ends up inside a column name in the user's database, so it is normative data — like
 * an error code — and not an identifier this codebase is free to rename.
 */
export type SlugNature = 'base' | 'table' | 'champ'

export interface SlugifyOptions {
  /** Byte budget (§3.4). */
  max: number
  /** Object kind, for the fallback name. */
  nature: SlugNature
  /**
   * Randomness source for the fallback, injectable for tests. Defaults to the system's
   * cryptographic generator (§7.2).
   */
  randomChars?: (count: number) => string
}

export interface SlugResult {
  slug: string
  /**
   * True if the fallback rule of §3.5 applied. The trigger is not silent: the creation
   * response carries the `SLUG_FALLBACK_APPLIED` warning, and the interface then offers
   * to enter a technical name (§2.4).
   */
  fallbackApplied: boolean
}

/**
 * HARD truncation to `max` bytes, then removal of any trailing `_` (§3.4).
 *
 * Rejected alternative: backing up to the last `_` so as not to cut a word — it
 * introduces a heuristic that two implementations would not apply identically, and
 * produces unpredictable lengths.
 *
 * The input is pure ASCII at this point (from step 6 onward), so one character is one
 * byte.
 */
export function truncateHard(value: string, max: number): string {
  const cut = byteLength(value) <= max ? value : value.slice(0, max)
  return cut.endsWith('_') ? cut.replace(/_+$/, '') : cut
}

/** Applies the transliteration table character by character (step 5). */
function transliterate(value: string): string {
  let out = ''
  for (const char of value) {
    out += TRANSLITERATION.get(char) ?? char
  }
  return out
}

/**
 * The ten steps of §3.2, in this exact order.
 *
 * From step 6 onward the string is pure ASCII: one character is one byte and the
 * character/byte distinction disappears. This is deliberate, and it is the main reason
 * for transliteration.
 */
export function slugify(label: string, options: SlugifyOptions): SlugResult {
  const { max, nature } = options

  // 1. NFKD normalization — compatibility decomposition. Handles diacritics,
  //    ligatures, full-width forms, subscripts, superscripts, fractions, the Turkish
  //    `İ` and composed symbols in one pass.
  let s = label.normalize('NFKD')

  // 2. PURE removal (not replacement) of marks and invisible characters. Replacing
  //    them with `_` would introduce phantom separators into the physical name: the
  //    worst possible outcome, because it is undetectable on reading.
  s = s.replace(MARKS_AND_INVISIBLES, '')

  // 3. Lowercasing in the ROOT LOCALE. `toLowerCase()` applies the default Unicode
  //    table, with no locale; `toLocaleLowerCase()` is forbidden here, since folding is
  //    locale-dependent for Turkish, Azeri and Lithuanian.
  s = s.toLowerCase()

  // 4. Second removal of marks. It is not redundant: full case folding CREATES
  //    combining marks (U+0130 folds to `i` + U+0307). A mark produced at step 3 and
  //    not filtered here would become a `_` at step 6 — a phantom separator.
  s = s.replace(MARKS_ONLY, '')

  // 5. Transliteration through an explicit table. Characters absent from the table are
  //    not transliterated: they fall through to step 6.
  s = transliterate(s)

  // 6. Filtering. Any character outside [a-z0-9] becomes `_`. This covers spaces,
  //    punctuation, symbols, remaining emoji, and every non-Latin script.
  s = s.replace(/[^a-z0-9]/g, '_')

  // 7. Collapse runs of `_`, then strip leading and trailing ones.
  s = s.replace(/_{2,}/g, '_').replace(/^_+/, '').replace(/_+$/, '')

  // 8. Empty slug → fallback rule of §3.5. The only non-deterministic point, and an
  //    accepted one: the function returns a proposal, the registry settles the name.
  if (s.length === 0) {
    const random = options.randomChars ?? randomAlphabetChars
    return { slug: `${nature}_${random(6)}`, fallbackApplied: true }
  }

  // 9. Slug starting with a digit → `n_` prefix (§3.6). PostgreSQL accepts
  //    "2024_sales" when quoted, but forcing manual quoting for this reason alone is a
  //    permanent cost for SQL consumers.
  if (/^[0-9]/.test(s)) {
    s = `n_${s}`
  }

  // 10. Truncation, then another removal of the trailing `_` that truncation may have
  //     exposed.
  return { slug: truncateHard(s, max), fallbackApplied: false }
}
