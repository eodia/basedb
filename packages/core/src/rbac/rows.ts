import { quoteIdentifier } from '@basedb/naming'
import type { FieldKind } from '../ddl/emit.js'
import { quoteLiteral } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { type FilterableColumn, buildFilter } from '../records/filter.js'

/**
 * Rows a group sees — chapter 05 §16.
 *
 * A rule is a filter of chapter 08 §4, written by an administrator on one table for one
 * group: « commercial eq @moi », « region in ["nord", "est"] ». It only ever subtracts,
 * and rights stay additive (§3.3): a person sees the rows that ANY of their groups
 * reading the table sees, and a group without a rule sees them all.
 *
 * The decider holds no SQL and reads no catalog (§6.1). A rule is therefore compiled here,
 * once per decision target, into a TEMPLATE the decider only combines:
 *
 *   — its columns are qualified by a placeholder alias, `"basedb_row"`, that each query
 *     replaces with its own (`rowWhere`) — a predicate that named its columns bare could
 *     bind them to another table of a correlated sub-query without anyone noticing;
 *   — its values are literals, not parameters: the predicate travels as a string inside
 *     the decision, into statements that already number their own parameters. Each value
 *     went through the filter's own coercion first, then `quoteLiteral`;
 *   — `@moi` — the person the decision is for — is a fixed sentinel literal, replaced by
 *     that person's identifier when the decision is made (`personalize`).
 */

// The placeholder alias and its replacement live apart, so that the filter — which this
// module compiles rules with — can use them without importing it back.
export { ROW_ALIAS, policyExpression, rowWhere } from './row-alias.js'
import { ROW_ALIAS } from './row-alias.js'

/** What a rule writes for « the person looking » — in French, and as other languages say it. */
export const ME = '@moi'
const ME_WORDS: readonly string[] = [ME, '@me']

/**
 * Stands for `@moi` in a compiled template. A version-4 UUID nobody is ever given: the
 * catalog draws version-7 identifiers.
 */
const ME_SENTINEL = 'ffffffff-ffff-4fff-bfff-ffffffffffff'

/** Kinds a rule may read: stored values, compared as they are written. */
const RULE_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>([
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'url',
  'email',
  'user',
  'link',
  'multi_link',
  'autonumber',
])

/** A field of the table, as a rule may name it. */
export interface RuleField {
  readonly name: string
  readonly kind: FieldKind
  /** False for a field computed at read time: a rule never reads one. */
  readonly stored: boolean
}

/**
 * The columns a rule may name: the table's stored fields of a comparable kind, and the
 * system columns — `_created_by eq @moi` is the rule « each sees what they created ».
 *
 * No field is masked here, and none should be: a rule is the administrator's, written
 * with the whole table in view, and the mask of the person it applies to plays no part
 * in which rows exist for them.
 */
export function ruleColumns(fields: readonly RuleField[]): Map<string, FilterableColumn> {
  const columns = new Map<string, FilterableColumn>()
  for (const f of fields) {
    if (!f.stored || !RULE_KINDS.has(f.kind)) continue
    columns.set(f.name, { name: f.name, kind: f.kind })
  }
  return columns
}

/** Kinds whose value exists only when read: no column for a rule to compare. */
const READ_TIME_KINDS: ReadonlySet<string> = new Set(['lookup', 'rollup', 'count', 'button'])

/** The system columns, as a rule may name them: `_created_by eq @moi`. */
const SYSTEM_RULE_FIELDS: readonly RuleField[] = [
  { name: '_id', kind: 'link', stored: true },
  { name: '_created_at', kind: 'datetime', stored: true },
  { name: '_updated_at', kind: 'datetime', stored: true },
  { name: '_created_by', kind: 'link', stored: true },
  { name: '_updated_by', kind: 'link', stored: true },
]

/** A table's fields, by physical name and kind, as a rule compiles against them. */
export function ruleFieldsOf(fields: ReadonlyArray<{ name: string; kind: string }>): RuleField[] {
  return [
    ...SYSTEM_RULE_FIELDS.filter((s) => !fields.some((f) => f.name === s.name)),
    ...fields.map((f) => ({
      name: f.name,
      kind: f.kind as FieldKind,
      stored: !READ_TIME_KINDS.has(f.kind),
    })),
  ]
}

/**
 * The rules of one table, compiled — role → template. A rule that no longer compiles, a
 * field it names having been deleted since, becomes `FALSE`: it shows nothing rather
 * than everything.
 */
export function compileRowRules(
  rules: ReadonlyArray<{ readonly roleId: string; readonly filter: string }>,
  fields: ReadonlyArray<{ name: string; kind: string }>,
): Map<string, string> {
  const compiled = new Map<string, string>()
  if (rules.length === 0) return compiled
  const ruleFields = ruleFieldsOf(fields)
  for (const rule of rules) {
    try {
      compiled.set(rule.roleId, compileRowRule(rule.filter, ruleFields))
    } catch {
      compiled.set(rule.roleId, 'FALSE')
    }
  }
  return compiled
}

/**
 * `@moi` outside any string, turned into the sentinel as a quoted value. Inside a string
 * — « "écrit par @moi" » — it is text, and stays text.
 */
function withSentinel(filter: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < filter.length; i++) {
    const c = filter[i]
    if (inString) {
      out += c
      if (c === '\\' && i + 1 < filter.length) {
        out += filter[i + 1]
        i++
      } else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    const word = ME_WORDS.find(
      (w) => filter.startsWith(w, i) && !/[\p{L}\p{N}_]/u.test(filter[i + w.length] ?? ''),
    )
    if (word !== undefined) {
      out += `"${ME_SENTINEL}"`
      i += word.length - 1
      continue
    }
    out += c
  }
  return out
}

/**
 * A filter a person writes — a view's, a search's — where `@moi` is that person: « Mes
 * tâches » is `assigne_a eq @moi`, whoever opens the view.
 */
export function withMe(filter: string, personId: string): string {
  if (!filter.includes('@')) return filter
  return withSentinel(filter).replaceAll(`"${ME_SENTINEL}"`, `"${personId}"`)
}

/** A bound value, written back as a literal of the same type. */
function literalOf(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BasedbError('FILTER_VALUE_INVALID')
    return String(value)
  }
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return quoteLiteral(value.toISOString())
  if (Array.isArray(value)) return `ARRAY[${value.map(literalOf).join(', ')}]`
  return quoteLiteral(String(value))
}

/**
 * Compiles one rule into its template — or refuses it with the filter's own codes:
 * `FILTER_FIELD_UNKNOWN` for a field that is not a stored one of the table,
 * `FILTER_OPERATOR_INVALID`, `FILTER_VALUE_INVALID`, `REQUEST_INVALID` for a syntax error.
 *
 * A path through a link (`client.commercial`) is refused: the target's rows would have
 * their own rules, read with the person's rights at every query, and a rule is meant to
 * be read at a glance.
 */
export function compileRowRule(filter: string, fields: readonly RuleField[]): string {
  const trimmed = filter.trim()
  if (trimmed === '') {
    throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'filter', detail: 'empty' } })
  }
  const built = buildFilter(withSentinel(trimmed), ruleColumns(fields), { alias: ROW_ALIAS })
  let sql = built.sql
  // From the highest index down: `$1` is a prefix of `$10`.
  for (let n = built.params.length; n >= 1; n--) {
    sql = sql.replaceAll(`$${n}`, literalOf(built.params[n - 1]))
  }
  return sql
}

/** A template for one person: `@moi` becomes them. */
export function personalize(template: string, personId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(personId))
    return template.replaceAll(quoteLiteral(ME_SENTINEL), 'NULL')
  return template.replaceAll(quoteLiteral(ME_SENTINEL), quoteLiteral(personId))
}
