/**
 * The two normative alphabets of chapter 01 §2.3.
 *
 * The byte constraint is written explicitly, separately from the regular expression:
 * on the chosen alphabet one character is one byte and both measures coincide, but the
 * explicit constraint guards against a future regression of the alphabet, not against
 * the common case.
 */

/** PostgreSQL's `NAMEDATALEN` limit, in bytes. */
export const MAX_IDENTIFIER_BYTES = 63

const ALPHABET_A = /^[a-z][a-z0-9_]{0,62}$/
// B must be a STRICT SUPERSET of A: its quantifier bound is therefore the same as A's,
// and it is `byteLength <= 63` that bounds the total length. With `{0,61}`, a 63-byte
// name without a leading `_` — say a schema name `b_<tenantId>_<53-byte slug>` —
// satisfies A but violates B: the engine could not emit SQL for an object it had just
// allocated itself.
const ALPHABET_B = /^_?[a-z][a-z0-9_]{0,62}$/

const encoder = new TextEncoder()

/**
 * Length in UTF-8 BYTES, never in UTF-16 units.
 *
 * `'é'.length` is 1 in JavaScript but 2 bytes in UTF-8; every budget in this package is
 * expressed in bytes because `NAMEDATALEN` is.
 */
export function byteLength(value: string): number {
  return encoder.encode(value).length
}

/**
 * Alphabet A — allocated names.
 *
 * Every name produced by slugification, entered as a technical name, or assembled as a
 * derived name. Enforced by the allocation procedure and by the API's input validation.
 */
export function isAlphabetA(name: string): boolean {
  return ALPHABET_A.test(name) && byteLength(name) <= MAX_IDENTIFIER_BYTES
}

/**
 * Alphabet B — emitted names.
 *
 * Every identifier the engine writes into SQL, alphabet A included. A strict superset
 * of A: it additionally allows a leading `_`, reserved for the closed list below, which
 * slugification cannot produce (step 7 strips leading underscores).
 */
export function isAlphabetB(name: string): boolean {
  return ALPHABET_B.test(name) && byteLength(name) <= MAX_IDENTIFIER_BYTES
}

/**
 * Closed list of identifiers with a leading `_`, versioned here (chapter 01 §2.3).
 *
 * Both schema names are fixed and not configurable (A9).
 */
export const LEADING_UNDERSCORE_ALLOWLIST: ReadonlySet<string> = new Set([
  '_basedb',
  '_basedb_local',
  '_id',
  '_created_at',
  '_updated_at',
  '_created_by',
  '_updated_by',
])

/** The five system columns, present on every user table (chapter 01 §8). */
export const SYSTEM_COLUMNS = [
  '_id',
  '_created_at',
  '_updated_at',
  '_created_by',
  '_updated_by',
] as const

export type SystemColumn = (typeof SYSTEM_COLUMNS)[number]
