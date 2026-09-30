/**
 * basedb's filter grammar (chapter 08 §4), written with values that cannot break it:
 *
 *   filter`statut eq ${statut} and montant gte ${10000}`
 *   filter`client_id.ville in ${['Lyon', 'Paris']} and _updated_at gte ${since}`
 *
 * Each interpolated value becomes a literal — a text quoted and escaped, a number or a
 * boolean as written, a `Date` as its ISO instant, a list in brackets. A text typed by a
 * user thus stays a value, never a piece of the filter. Field names and operators are
 * written in the template itself.
 */

/** One value as the grammar writes it. */
export function literal(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`A filter value must be finite: ${value}`)
    return String(value)
  }
  if (typeof value === 'bigint' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`
  if (value === null || value === undefined) {
    throw new TypeError('A filter has no null value: write `field is_null`')
  }
  throw new TypeError(`A filter value cannot be ${typeof value}`)
}

/** A filter whose interpolated values are literals. */
export function filter(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  return strings.reduce(
    (out, text, i) => out + text + (i < values.length ? literal(values[i]) : ''),
    '',
  )
}
