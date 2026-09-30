import { quoteIdentifier } from '@basedb/naming'

/**
 * The alias a row rule's columns are qualified with — chapter 05 §16 —, and how each query
 * replaces it with its own. Apart from `rows.ts`: the filter of chapter 08 §4 compiles the
 * rules and also writes them into the sub-queries it builds, and a module each imports from
 * the other would be a cycle.
 */

/** The alias a rule's columns are qualified with until a query names its own. */
export const ROW_ALIAS = 'basedb_row'
const PLACEHOLDER = `${quoteIdentifier(ROW_ALIAS)}.`

/**
 * The predicate as one query writes it: `alias` is the name its table goes by there, a
 * qualified relation (`"b_…"."clients"`) when it has none, and `null` for a statement
 * that names its target `"basedb_row"` itself (`INSERT … AS "basedb_row"`).
 */
export function rowWhere(predicate: string, alias: string | null): string {
  if (predicate === 'TRUE' || alias === null) return predicate
  const prefix = alias.startsWith('"') ? `${alias}.` : `${quoteIdentifier(alias)}.`
  return predicate.replaceAll(PLACEHOLDER, prefix)
}

/** The predicate for a PostgreSQL policy, whose expression names the table's columns bare. */
export function policyExpression(predicate: string): string {
  return predicate.replaceAll(PLACEHOLDER, '')
}
