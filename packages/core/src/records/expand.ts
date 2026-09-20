import { BasedbError } from '../errors/index.js'

/**
 * Parsing and bounds of `?expand=` — chapter 08 §5.1 and §5.4.
 *
 * `?expand=clients_id(raison_sociale,ville),commerciaux_id`
 *
 * Expansion depth is 1, WITHOUT EXCEPTION. The cost of a rank-k expansion is the
 * product of the cardinalities and becomes unpredictable from k = 2; reflexive cycles,
 * which "Field types" does not forbid, would make the bound infinite and would impose
 * graph detection on every request. A caller who needs the second level holds the
 * first level's identifiers and issues a second call with `filter=_id in [...]`, which
 * makes two queries in total, not N.
 */

/** Bounds of §5.1. They are the response contract's, and the only ones. */
export const EXPAND_BUDGETS = {
  /** Expanded fields per request. */
  fields: 5,
  /** Target tables resolved in total, expanded or not. */
  targets: 8,
  /** Page bound once `expand` is present. */
  limit: 100,
  /** Distinct identifiers per target table and per page. */
  idsPerTarget: 500,
} as const

/**
 * What a caller asks to expand: the link column, and the projection restricting the
 * target's fields — `null` meaning "every readable field".
 */
export type ExpandRequest = ReadonlyMap<string, readonly string[] | null>

/**
 * Parses the `expand` parameter.
 *
 * A path containing a dot is refused here rather than resolved: `expand=a.b` is depth 2,
 * and letting it through would give the caller a silent first level instead of the
 * refusal the contract announces.
 */
export function parseExpand(expression: string | undefined): ExpandRequest {
  const request = new Map<string, readonly string[] | null>()
  if (expression === undefined || expression.trim() === '') return request

  // Split on commas OUTSIDE parentheses: `a(x,y),b` has two entries, not three.
  const entries: string[] = []
  let depth = 0
  let current = ''
  for (const c of expression) {
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) {
      entries.push(current)
      current = ''
      continue
    }
    current += c
  }
  entries.push(current)

  for (const raw of entries) {
    const entry = raw.trim()
    if (entry === '') continue

    const match = /^([_a-z][a-z0-9_]*)(?:\(([^)]*)\))?$/i.exec(entry)
    if (match === null) {
      if (entry.includes('.')) {
        throw new BasedbError('EXPAND_TOO_DEEP', { details: { path: entry } })
      }
      throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'expand', detail: entry } })
    }

    const [, column, projection] = match
    const fields =
      projection === undefined
        ? null
        : projection
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f !== '')

    request.set(column, fields)

    if (request.size > EXPAND_BUDGETS.fields) {
      throw new BasedbError('EXPAND_TOO_WIDE', {
        details: { bound: 'expanded fields', maximum: EXPAND_BUDGETS.fields, links: 'id' },
      })
    }
  }

  return request
}
