import { TENANT_ID_LENGTH } from './tenant.js'

/**
 * Relegation: naming of logical deletion — chapter 01 §9.5.
 */

/** `zz_supprime_` (12) + date (8) + `_` (1) = 21 bytes. */
export const RELEGATION_PREFIX_BYTES = 21

/** 63 − 21 = 42 bytes for the former name of a table or field. */
export const MAX_RELEGATED_NAME_BYTES = 42

/**
 * 2 + 7 + 1 (positional prefix) + 12 + 8 + 1 (marker) = 31 bytes, leaving 32 bytes for
 * the base slug, which is therefore re-truncated from 53 to 32 on this occasion.
 */
export const MAX_RELEGATED_BASE_SLUG_BYTES = 32

// The marker is French because it lands in the user's database as a schema and table
// name prefix: chapter 01 §9.5 fixes it, so it is normative data, not an identifier
// this codebase may rename.
const MARKER = 'zz_supprime_'

/** Date in UTC, `YYYYMMDD` format without separators. */
export function relegationDate(at: Date): string {
  const year = at.getUTCFullYear().toString().padStart(4, '0')
  const month = (at.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = at.getUTCDate().toString().padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Relegated name of a table or field: `zz_supprime_<YYYYMMDD>_<name>`.
 *
 * The former name is truncated to 42 bytes.
 *
 * Relegation on the same day: deleting a "Remise" field, recreating it, then deleting
 * it again the same day would produce the same name twice. The suffix loop of §6.1
 * applies as everywhere else, and belongs to allocation.
 */
export function relegatedName(name: string, at: Date): string {
  return `${MARKER}${relegationDate(at)}_${name.slice(0, MAX_RELEGATED_NAME_BYTES)}`
}

/**
 * Relegated name of a schema: `b_<tenantId>_zz_supprime_<YYYYMMDD>_<base slug>`.
 *
 * The marker comes AFTER the positional prefix, never before it. Positional reading as
 * defined in §5 is thereby preserved — an operations tool enumerating a tenant's
 * schemas keeps working.
 *
 * Putting the marker first would have produced `zz_supprime_20260918_b_t4z56fq_crm`,
 * unreadable by position and 84 bytes long in the worst case, hence over the limit.
 */
export function relegatedSchemaName(tenantId: string, baseSlug: string, at: Date): string {
  const slug = baseSlug.slice(0, MAX_RELEGATED_BASE_SLUG_BYTES)
  return `b_${tenantId}_${MARKER}${relegationDate(at)}_${slug}`
}

/** True if the name carries the relegation marker, for a table or a field. */
export function isRelegatedName(name: string): boolean {
  return name.startsWith(MARKER)
}

/**
 * True if the schema name carries the relegation marker, read by position after the
 * `b_<tenantId>_` prefix.
 */
export function isRelegatedSchemaName(schemaName: string): boolean {
  return schemaName.slice(3 + TENANT_ID_LENGTH).startsWith(MARKER)
}
