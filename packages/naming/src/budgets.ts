/**
 * Byte budgets per object kind — chapter 01 §3.4, as required by A6.
 */

/** 63 − length of the `b_<tenantId>_` prefix (§5). */
export const MAX_BASE_SLUG_BYTES = 53

/** A 15-byte reserve below PostgreSQL's limit (§3.4). */
export const MAX_TABLE_NAME_BYTES = 48

/** Same as tables. */
export const MAX_FIELD_NAME_BYTES = 48

/** Raw PostgreSQL limit; distribution in §9.6. */
export const MAX_DERIVED_NAME_BYTES = 63

/**
 * What the 15-byte reserve guarantees: derived names with a SINGLE variable component
 * fit without any trimming.
 *
 *   primary key   `pk_<table>`        → 3 + 48 = 51 ✔
 *   link column   `<target_table>_id` → 48 + 3 = 51 ✔
 *
 * What it does NOT guarantee: names with two or more components — `fk_`, `ix_`, `uq_`,
 * `ck_`, `tg_` — do not fit in the worst case (`fk_` reaches 104 bytes, `ck_` 113).
 * They go through the distribution of §9.6, and that is their NORMAL operation, not an
 * exception.
 */
export const BUDGETS = {
  base: MAX_BASE_SLUG_BYTES,
  table: MAX_TABLE_NAME_BYTES,
  field: MAX_FIELD_NAME_BYTES,
  derived: MAX_DERIVED_NAME_BYTES,
} as const

/**
 * Budget for a slug nature.
 *
 * The mapping is explicit because the two vocabularies do not coincide: `SlugNature`
 * carries the value `champ`, which §3.5 writes into a physical name and which is
 * therefore normative data, whereas `BUDGETS` is an identifier of this codebase and
 * follows its English convention. Indexing one by the other would silently yield
 * `undefined`.
 */
export function budgetForNature(nature: 'base' | 'table' | 'champ'): number {
  return nature === 'base' ? BUDGETS.base : nature === 'table' ? BUDGETS.table : BUDGETS.field
}
