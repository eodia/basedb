/**
 * `tenantId` generation — chapter 01 §7.
 *
 * An opaque, stable identifier, `t` + 6 characters, of fixed length 7. It is never
 * derived from the tenant's name, precisely so it stays independent of renamings, and
 * it never changes (§7.4).
 */

/**
 * Base 36 minus `0`, `o`, `1`, `l` — exactly 32 characters.
 *
 * 8 digits + 24 letters = 32. The exact size of 32 matters: it is 2⁵, which allows
 * drawing without modulo bias (§7.2).
 */
export const TENANT_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz'

/** Total length of a `tenantId`: `t` + 6 characters. */
export const TENANT_ID_LENGTH = 7

/** Number of attempts before giving up (§7.2 step 5). */
export const TENANT_ID_MAX_ATTEMPTS = 10

const TENANT_ID_PATTERN = /^t[23456789abcdefghijkmnpqrstuvwxyz]{6}$/

/**
 * Draws `count` characters from the §7.1 alphabet using the system's CRYPTOGRAPHIC
 * generator.
 *
 * Never a non-cryptographic pseudo-random generator: a predictable `tenantId` is a
 * predictable schema name, hence an aid to enumeration.
 *
 * Each byte supplies its 5 low bits (value 0–31). Since 256 is a multiple of 32, the
 * distribution is uniform with neither rejection nor modulo bias.
 */
export function randomAlphabetChars(count: number): string {
  const bytes = new Uint8Array(count)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    out += TENANT_ALPHABET[byte & 0b11111]
  }
  return out
}

/**
 * Static denylist, versioned here (§7.2 step 3).
 *
 * Each entry is a COMPLETE 7-character identifier. A construction test rejects any
 * non-conforming entry — wrong length, character outside the alphabet — without which
 * the list would give a false impression of coverage by holding values the generator
 * cannot produce.
 */
export const TENANT_ID_DENYLIST: ReadonlySet<string> = new Set([
  // Terms that would be confusing inside a production schema name.
  'tsystem',
  'ttenant',
  'tadmins',
  'tmaster',
  'tbasedb',
  'tserver',
  'tsecret',
  'tsupers',
  'tstatus',
  // Crude strings the generator can actually reach. "tpublic", "tsalope" and "tconnes"
  // are absent: their letters `l` and `o` lie outside the alphabet, so the generator
  // cannot produce them.
  'tmerdes',
  'tputain',
  'tbatard',
])

/** True if the string has the shape of a `tenantId`: `t` then 6 alphabet characters. */
export function isTenantId(value: string): boolean {
  return TENANT_ID_PATTERN.test(value)
}

/**
 * Proposes a `tenantId`. Uniqueness is NOT guaranteed here: it is guaranteed by the
 * `UNIQUE` constraint in `COLLATE "C"` on the tenant table, against which the caller
 * attempts the insert (§6.4 — uniqueness by constraint, never by a SELECT).
 *
 * A collision is not an incident but an expected event at the scale of a few tens of
 * thousands of tenants (§7.3): hence the insert under constraint and the retry, never
 * an assumption of uniqueness.
 */
export function proposeTenantId(
  randomChars: (count: number) => string = randomAlphabetChars,
): string {
  return `t${randomChars(6)}`
}

/**
 * Draws a `tenantId` outside the denylist. Retrying on a uniqueness collision belongs
 * to the caller, who alone holds the database; after `TENANT_ID_MAX_ATTEMPTS`, give up
 * with `TENANT_ID_EXHAUSTED` and alert operations: either the randomness source is
 * failing or the namespace is saturated, and both deserve a human.
 */
export function proposeAllowedTenantId(
  randomChars: (count: number) => string = randomAlphabetChars,
): string {
  for (let attempt = 0; attempt < TENANT_ID_MAX_ATTEMPTS; attempt++) {
    const candidate = proposeTenantId(randomChars)
    if (!TENANT_ID_DENYLIST.has(candidate)) return candidate
  }
  throw new Error('TENANT_ID_EXHAUSTED')
}
