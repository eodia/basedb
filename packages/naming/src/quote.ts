import { isAlphabetB } from './alphabet.js'

/**
 * SQL contract — chapter 01 §10.
 *
 * The security invariant (§10.2):
 *
 *   "No user-supplied string is ever concatenated into SQL. Only physical names taken
 *    from the registry are. Values always go through bound parameters."
 *
 * This module carries the second of the three redundant checks that uphold it: on
 * reading, before quoting, alphabet B is re-validated. This is an ASSERTION, not
 * sanitization: we do not try to repair the name, we refuse to emit SQL.
 *
 * Validation is against B and not A, otherwise the engine could emit neither `"_id"`
 * nor `"_basedb_local"`, hence no query at all.
 */

/** Thrown when an identifier fails alphabet B before emission. */
export class IdentifierInvalidError extends Error {
  readonly code = 'IDENTIFIER_INVALID'
  readonly identifier: string

  constructor(identifier: string) {
    super(`IDENTIFIER_INVALID: ${JSON.stringify(identifier)}`)
    this.name = 'IdentifierInvalidError'
    this.identifier = identifier
  }
}

/**
 * Identifier quoting, SYSTEMATIC — including when the identifier contains no character
 * that requires it. A rule without exceptions is verifiable by reading; a conditional
 * rule is not.
 *
 * The double quote is escaped by doubling it. Our identifiers never contain one —
 * their alphabet is `[a-z0-9_]` — but the escaping is applied anyway: defense in depth
 * that costs nothing and guards against a future regression of the alphabet.
 */
export function quoteIdentifier(identifier: string): string {
  if (!isAlphabetB(identifier)) throw new IdentifierInvalidError(identifier)
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * EXPLICIT qualification: every reference to a relation, a sequence, a non-native type
 * or a function carries its schema.
 *
 *   `"b_t4z56fq_crm"."factures"`
 *   `"_basedb_local"."uuid_generate_v7"`
 *
 * No generated query depends on the current schema. The `search_path` is empty on every
 * connection, but it is explicit qualification, without exception, that provides the
 * real protection: the session's temporary schema remains implicitly searched for
 * relations and types, even when absent from the path.
 */
export function qualify(schema: string, object: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(object)}`
}

/** Column qualification: `"schema"."table"."column"`. */
export function qualifyColumn(schema: string, table: string, column: string): string {
  return `${qualify(schema, table)}.${quoteIdentifier(column)}`
}
