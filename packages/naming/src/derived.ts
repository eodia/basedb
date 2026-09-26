import { byteLength } from './alphabet.js'
import { MAX_DERIVED_NAME_BYTES } from './budgets.js'

/**
 * Derived object names — chapter 01 §9.
 *
 * These names appear verbatim in the PostgreSQL error messages surfaced to the user:
 * they must be readable. The DOUBLE UNDERSCORE separates components (table / column /
 * rule). It stays ambiguous if a name itself contains `__` — which is not a problem:
 * these names are never parsed by a program, the constraint ↔ object association is
 * carried by the registry. The `__` is there for the human eye reading an error
 * message.
 */

/** A pattern segment: fixed (prefix, separator, closed suffix) or variable. */
export type Segment = { fixed: string } | { variable: string }

/** Maximum number of columns named in a unique constraint (§9.6 step 2). */
export const MAX_UNIQUE_COLUMNS_NAMED = 3

/**
 * Budget distribution across variable components — §9.6 step 4.
 *
 * `part = budget ÷ n` (integer division); components shorter than `part` keep their
 * length and the bytes they do not use are redistributed equally among the remaining
 * components; repeat until stable; the remainder of the integer division goes to the
 * components in pattern order.
 *
 * No cryptographic digest is used (A6): it would produce an opaque suffix precisely
 * where the name needs to be recognizable.
 */
export function distributeBudget(lengths: readonly number[], budget: number): number[] {
  const n = lengths.length
  const allocated = new Array<number>(n).fill(0)
  const settled = new Array<boolean>(n).fill(false)
  let remaining = budget
  let free = n

  while (free > 0) {
    const part = Math.floor(remaining / free)
    let settledThisRound = false

    for (let i = 0; i < n; i++) {
      if (settled[i]) continue
      if (lengths[i] <= part) {
        allocated[i] = lengths[i]
        settled[i] = true
        remaining -= lengths[i]
        free--
        settledThisRound = true
      }
    }

    if (settledThisRound) continue

    // No component fits within its share any more: distribute and leave. The remainder
    // of the integer division goes to components in pattern order.
    let rest = remaining - part * free
    for (let i = 0; i < n; i++) {
      if (settled[i]) continue
      allocated[i] = part + (rest > 0 ? 1 : 0)
      if (rest > 0) rest--
    }
    break
  }

  return allocated
}

/** Truncate a component, then strip any trailing `_` (§9.6 step 5). */
function trimComponent(value: string, max: number): string {
  const cut = value.slice(0, max)
  return cut.replace(/_+$/, '')
}

/**
 * Assembles a derived name, distributing the budget when needed (§9.6).
 *
 * Example: table `liste_des_contrats_de_prevoyance_collective_sous` (48 bytes), column
 * `client_livre_id` (15). Fixed parts of `fk_…__…`: 5 bytes, budget 58; the components
 * sum to 63, so distribution is required. `part` = 29; the column (15) fits and returns
 * 14 bytes, the table receives 43. Result, 63 bytes:
 *
 *   fk_liste_des_contrats_de_prevoyance_collective__client_livre_id
 *
 * Readable at both ends, which is the point: this is the name PostgreSQL will show in
 * the violation message.
 */
export function assembleDerivedName(segments: readonly Segment[]): string {
  const fixedBytes = segments.reduce(
    (sum, seg) => ('fixed' in seg ? sum + byteLength(seg.fixed) : sum),
    0,
  )
  const variables = segments.filter((seg): seg is { variable: string } => 'variable' in seg)
  const variableBytes = variables.reduce((sum, seg) => sum + byteLength(seg.variable), 0)

  // Step 3: if the components sum within budget, assemble as is.
  if (fixedBytes + variableBytes <= MAX_DERIVED_NAME_BYTES) {
    return segments.map((seg) => ('fixed' in seg ? seg.fixed : seg.variable)).join('')
  }

  const budget = MAX_DERIVED_NAME_BYTES - fixedBytes
  const allocation = distributeBudget(
    variables.map((seg) => byteLength(seg.variable)),
    budget,
  )

  let index = 0
  return segments
    .map((seg) => ('fixed' in seg ? seg.fixed : trimComponent(seg.variable, allocation[index++])))
    .join('')
}

/** Primary key: `pk_<table>`. */
export function primaryKeyName(table: string): string {
  return assembleDerivedName([{ fixed: 'pk_' }, { variable: table }])
}

/** Foreign key: `fk_<table>__<column>`. */
export function foreignKeyName(table: string, column: string): string {
  return assembleDerivedName([
    { fixed: 'fk_' },
    { variable: table },
    { fixed: '__' },
    { variable: column },
  ])
}

/** Index: `ix_<table>__<column>[__<column>…]`. */
export function indexName(table: string, columns: readonly string[]): string {
  const segments: Segment[] = [{ fixed: 'ix_' }, { variable: table }]
  for (const column of columns) {
    segments.push({ fixed: '__' }, { variable: column })
  }
  return assembleDerivedName(segments)
}

/**
 * Unique constraint: `uq_<table>__<c1>[__<c2>__<c3>][__etc]`.
 *
 * At most three columns are named; beyond that, the pattern ends with the fixed
 * component `__etc`. Without this bound, `uq_` would have no upper bound (§9.6 step 2).
 */
export function uniqueConstraintName(table: string, columns: readonly string[]): string {
  const named = columns.slice(0, MAX_UNIQUE_COLUMNS_NAMED)
  const segments: Segment[] = [{ fixed: 'uq_' }, { variable: table }]
  for (const column of named) {
    segments.push({ fixed: '__' }, { variable: column })
  }
  if (columns.length > MAX_UNIQUE_COLUMNS_NAMED) {
    segments.push({ fixed: '__etc' })
  }
  return assembleDerivedName(segments)
}

/**
 * Check constraint: `ck_<table>__<column>__<rule>`.
 *
 * The `<rule>` suffix comes from a closed vocabulary defined in chapter 04: it
 * therefore counts as a fixed part in the distribution.
 */
export function checkConstraintName(table: string, column: string, rule: string): string {
  return assembleDerivedName([
    { fixed: 'ck_' },
    { variable: table },
    { fixed: '__' },
    { variable: column },
    { fixed: `__${rule}` },
  ])
}

/**
 * Trigger: `tg_<table>__<role>`.
 *
 * The `<role>` suffix comes from the list of triggers installed on a user table, for
 * which chapter 07 is normative (A10); this module only fixes the pattern and budget.
 */
export function triggerName(table: string, role: string): string {
  return assembleDerivedName([{ fixed: 'tg_' }, { variable: table }, { fixed: `__${role}` }])
}

/**
 * Explicit sequence: `<table>__<column>_seq`.
 *
 * Since `_id` is a v7 `uuid` served by `_basedb_local.uuid_generate_v7()` (A9), no
 * identity sequence is created for the primary key. A sequence exists only if a field
 * type from chapter 04 uses one, and its name is allocated in the registry BEFORE the
 * DDL that uses it is emitted.
 */
export function sequenceName(table: string, column: string): string {
  return assembleDerivedName([
    { variable: table },
    { fixed: '__' },
    { variable: column },
    { fixed: '_seq' },
  ])
}

/**
 * Column of a link field: `<target_table>_id` (§9.3).
 *
 * `<target_table>` is the physical name of the target table as it appears in the
 * registry, WITHOUT transformation: no singularization, no pluralization, no
 * translation. Morphological inflection is language-dependent and never reliable; a
 * `clients` table yields `clients_id`.
 *
 * The chosen name is frozen at creation and is NEVER recomputed: physically renaming
 * the target table does not rename the link column.
 */
export function linkColumnName(targetTable: string): string {
  return assembleDerivedName([{ variable: targetTable }, { fixed: '_id' }])
}

/**
 * Fallback link column name when `<target_table>_id` is already taken — typically a
 * second link to the same target table, or a pre-existing user column of the same name
 * (§9.3, A7).
 *
 * A field labelled "Client livré" pointing at `clients` yields `client_livre_id`, far
 * more telling than `clients_id_2`. The numeric suffix loop of §6.1 comes into play
 * only as a last resort, and belongs to allocation.
 */
export function linkColumnNameFromLabel(fieldSlug: string): string {
  return assembleDerivedName([{ variable: fieldSlug }, { fixed: '_id' }])
}

/**
 * Column of a multi-link field: `<target_table>_ids` — chapter 04 §4 bis. The plural
 * mark is the only difference with `linkColumnName`: a column that holds several rows
 * says so, and a second relation to the same table then falls back on its label.
 */
export function multiLinkColumnName(targetTable: string): string {
  return assembleDerivedName([{ variable: targetTable }, { fixed: '_ids' }])
}

/** Fallback multi-link column name: the slug of the field's label, then `_ids`. */
export function multiLinkColumnNameFromLabel(fieldSlug: string): string {
  return assembleDerivedName([{ variable: fieldSlug }, { fixed: '_ids' }])
}

/**
 * The trigger that holds a multi-link's list on its source table: `tg_<table>__ml_<column>`
 * (chapter 07 §1.2). One per field, since one per table could not say which column.
 */
export function multiLinkTriggerName(table: string, column: string): string {
  return assembleDerivedName([
    { fixed: 'tg_' },
    { variable: table },
    { fixed: '__ml_' },
    { variable: column },
  ])
}

/**
 * The trigger on the TARGET table that answers the deletion of a row a multi-link cites:
 * `tg_<target>__mlt_<source>_<column>`. Named after both, since a table may be the target
 * of several multi-links, from several tables.
 */
export function multiLinkTargetTriggerName(target: string, source: string, column: string): string {
  return assembleDerivedName([
    { fixed: 'tg_' },
    { variable: target },
    { fixed: '__mlt_' },
    { variable: source },
    { fixed: '_' },
    { variable: column },
  ])
}
