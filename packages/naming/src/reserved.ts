import { isReservedWord } from './reserved-words.js'
import { truncateHard } from './slug.js'

/**
 * Forbidden names, reserved prefixes and escaping — chapter 01 §4.
 *
 * The prohibition applies EXCLUSIVELY to the physical name. No label is forbidden for
 * being a reserved word: a field may be called "Select", "_id" or "pg_stat". Only its
 * projection is constrained.
 *
 * Two families of unavailability, and two DISTINCT treatments. This is the point not to
 * conflate: a suffix appended at the end of a name obviously does not fix a forbidden
 * prefix.
 */

/** Scope of a name, which determines the applicable checks. */
export type NameScope = 'base' | 'table' | 'field'

/**
 * Reserved prefixes per scope.
 *
 * For bases, only `zz_` is escaped, so that the relegation marker of §9.5 stays
 * unambiguous when reading a list of schemas. No `pg_` or `_` check applies to the base
 * slug: the `b_<tenantId>_` prefix makes the assembled schema name structurally
 * disjoint from those families.
 */
const RESERVED_PREFIXES: Record<NameScope, readonly string[]> = {
  base: ['zz_'],
  table: ['pg_', 'zz_', '_'],
  field: ['pg_', 'zz_', '_'],
}

/** Escape prefix for a reserved prefix (§4). */
export const ESCAPE_PREFIX = 'x_'

/**
 * Escapes a reserved prefix, ONCE, before any availability check.
 *
 *   `zz_archive`     → `x_zz_archive`
 *   `pg_monitoring`  → `x_pg_monitoring`
 *
 * The transformation is safe by construction: `x_` is none of the three reserved
 * prefixes, so its output cannot re-trigger the escaping.
 *
 * Rejected alternative: adding `x_` to the reserved prefix list "to make the
 * transformation idempotent" — that would produce the opposite, the escaping forbidding
 * its own output and looping on `x_x_…`.
 *
 * If the result exceeds `max`, it is truncated again.
 */
export function escapeReservedPrefix(candidate: string, scope: NameScope, max: number): string {
  const prefixes = RESERVED_PREFIXES[scope]
  const hit = prefixes.some((prefix) => candidate.startsWith(prefix))
  if (!hit) return candidate
  return truncateHard(`${ESCAPE_PREFIX}${candidate}`, max)
}

/**
 * True if the candidate carries a reserved prefix for this scope.
 */
export function hasReservedPrefix(candidate: string, scope: NameScope): boolean {
  return RESERVED_PREFIXES[scope].some((prefix) => candidate.startsWith(prefix))
}

/**
 * True if the candidate must go through the suffix loop because it is a reserved word.
 *
 * The filter applies to the FINAL CANDIDATE — that is, after slugification and
 * escaping — and concerns only tables and fields: no reserved-word check applies to the
 * base slug (§4).
 *
 * `catcode = 'C'` is included deliberately: PostgreSQL accepts `timestamp` or
 * `interval` as a column name, but `SELECT timestamp FROM t` is confusing at best and a
 * syntax error at worst, depending on position. The cost of forbidding them is a `_2`
 * on labels like "Time"; the opposite cost is an identifier that forces quoting, for
 * life.
 */
export function isReservedForScope(candidate: string, scope: NameScope): boolean {
  if (scope === 'base') return false
  return isReservedWord(candidate)
}

/**
 * Applies the forbidden-name checks of §4 to an already slugified candidate, and
 * returns the corrected candidate together with whether a suffix loop is needed.
 *
 * The suffix loop itself belongs to the allocation procedure (§6.1), which touches the
 * registry and therefore lives in `@basedb/core`: this package performs no I/O.
 */
export function applyNameRestrictions(
  candidate: string,
  scope: NameScope,
  max: number,
): { candidate: string; needsSuffixLoop: boolean } {
  const escaped = escapeReservedPrefix(candidate, scope, max)
  return { candidate: escaped, needsSuffixLoop: isReservedForScope(escaped, scope) }
}

export { isReservedWord, RESERVED_WORDS, type Catcode } from './reserved-words.js'
