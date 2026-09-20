import { quoteIdentifier } from '@basedb/naming'
import type { FieldKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'

/**
 * Filter parsing and translation — chapter 08 §4, chapter 04 §9.
 *
 * Grammar (EBNF of §4.1):
 *
 *   expr      = or_expr
 *   or_expr   = and_expr , { "or" , and_expr }
 *   and_expr  = unary   , { "and" , unary }
 *   unary     = [ "not" ] , primary
 *   primary   = "(" , expr , ")" | predicate
 *   predicate = path , op , [ value ]
 *
 * `and` binds tighter than `or`, parentheses rule, and keywords are case-insensitive.
 *
 * The four translation rules of §4.5, without exception:
 *
 *   1. an identifier from the filter is NEVER concatenated — it is resolved to a
 *      physical name, re-validated against alphabet B by `quoteIdentifier` before
 *      emission;
 *   2. every value is a bound parameter, with an explicit cast to the column's type,
 *      and a non-coercible value is caught BEFORE emission (`FILTER_VALUE_INVALID`)
 *      rather than surfacing as a server-side `22P02`;
 *   3. `LIKE` metacharacters are escaped and the clause carries `ESCAPE '\'`;
 *   4. every table entering the query brings its own row predicate.
 */

/** The thirteen operators, and no others (chapter 04 §9). */
export const OPERATORS = [
  'eq',
  'ne',
  'eq_ci',
  'contains',
  'starts_with',
  'ends_with',
  'in',
  'is_null',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
] as const

export type Operator = (typeof OPERATORS)[number]

const ORDERING: readonly Operator[] = ['gt', 'gte', 'lt', 'lte', 'between']
const EQUALITY: readonly Operator[] = ['eq', 'ne', 'in']

/**
 * Operators allowed per type (chapter 04, per-type summary).
 *
 * An operator applied to a type that does not declare it yields
 * `FILTER_OPERATOR_INVALID`.
 */
const ALLOWED: Readonly<Record<FieldKind, readonly Operator[]>> = {
  short_text: [...EQUALITY, 'eq_ci', 'contains', 'starts_with', 'ends_with', 'is_null'],
  // Neither equality nor ordering: long text is searched, not compared.
  long_text: ['contains', 'is_null'],
  number: [...EQUALITY, ...ORDERING, 'is_null'],
  boolean: ['eq', 'is_null'],
  date: [...EQUALITY, ...ORDERING, 'is_null'],
  datetime: [...EQUALITY, ...ORDERING, 'is_null'],
  select: [...EQUALITY, 'is_null'],
  // On a link, identifiers are compared: neither case nor substring apply.
  link: [...EQUALITY, 'is_null'],
  formula: [...EQUALITY, ...ORDERING, 'is_null'],
}

/**
 * The operators a type declares, for publication in `/meta`.
 *
 * Chapter 11 §1.3: "Les opérateurs proposés par champ sont EXACTEMENT ceux du
 * récapitulatif normatif de « Types de champs », lus dans `GET /meta/bases/{base}`.
 * L'interface n'en propose jamais un autre et n'en cache aucun." The interface therefore
 * reads this list rather than carrying a copy of it — a second copy is a second thing to
 * forget when a type gains an operator.
 */
export function operatorsFor(kind: FieldKind): readonly Operator[] {
  return ALLOWED[kind] ?? []
}

/** True if the type can be ordered at all. Long text is searched, never compared. */
export function sortableKind(kind: FieldKind): boolean {
  return kind !== 'long_text'
}

/** The five system columns, filterable and sortable as soon as `read` is granted (A18). */
const SYSTEM: Readonly<Record<string, FieldKind>> = {
  _id: 'link',
  _created_at: 'datetime',
  _updated_at: 'datetime',
  _created_by: 'link',
  _updated_by: 'link',
}

/** Explicit SQL cast, per field type (§4.5 rule 2). */
export const CAST: Readonly<Record<FieldKind, string>> = {
  short_text: 'text',
  long_text: 'text',
  select: 'text',
  number: 'numeric',
  boolean: 'boolean',
  date: 'date',
  datetime: 'timestamptz',
  link: 'uuid',
  formula: 'text',
}

/** Bounds of §4.6, checked DURING parsing and not after. */
export const BUDGETS = {
  bytes: 4096,
  predicates: 32,
  depth: 8,
  inElements: 200,
  linkPaths: 4,
} as const

type Scalar = string | number | boolean
type Value = Scalar | readonly Scalar[] | null

type Node =
  | { readonly type: 'or'; readonly left: Node; readonly right: Node }
  | { readonly type: 'and'; readonly left: Node; readonly right: Node }
  | { readonly type: 'not'; readonly inner: Node }
  | {
      readonly type: 'predicate'
      readonly field: string
      readonly op: Operator
      readonly value: Value
    }

/** A column the filter is allowed to name: physical name and type. */
export interface FilterableColumn {
  readonly name: string
  readonly kind: FieldKind
}

/**
 * A target table reachable through a link path, depth 1 (§4.4).
 *
 * Everything is resolved UPSTREAM, inside the catalog transaction: the RBAC decision on
 * the target table, its readable columns, its row predicate. The SQL builder thus stays
 * synchronous and cannot, by construction, fetch from the catalog an item the decision
 * has not validated.
 */
export interface FilterableTarget {
  /** `"schema"."table"`, already quoted. */
  readonly relation: string
  /** The target's readable columns, by physical name. */
  readonly columns: ReadonlyMap<string, FilterableColumn>
  /** Display column, if the target designates one AND it is readable. */
  readonly displayColumn: FilterableColumn | null
  readonly rowPredicate: string
  /** False if the actor lacks `read` on the target: no path is then traversable. */
  readonly readable: boolean
}

export interface BuiltFilter {
  readonly sql: string
  readonly params: readonly unknown[]
}

// ── Lexical analysis ────────────────────────────────────────────────────────

type Token =
  | { readonly t: 'word'; readonly v: string }
  | { readonly t: 'string'; readonly v: string }
  | { readonly t: 'number'; readonly v: number }
  | { readonly t: 'symbol'; readonly v: string }

const SYMBOLS = new Set(['(', ')', '[', ']', ','])

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const c = input[i]

    if (/\s/.test(c)) {
      i++
      continue
    }

    if (SYMBOLS.has(c)) {
      tokens.push({ t: 'symbol', v: c })
      i++
      continue
    }

    if (c === '"') {
      let v = ''
      i++
      while (i < input.length && input[i] !== '"') {
        // The grammar's only two escapes; the URL itself is encoded normally (%20,
        // %22) and decoded before reaching here.
        if (input[i] === '\\' && (input[i + 1] === '"' || input[i + 1] === '\\')) {
          v += input[i + 1]
          i += 2
          continue
        }
        v += input[i]
        i++
      }
      if (i >= input.length) throw malformed('unterminated string')
      i++
      tokens.push({ t: 'string', v })
      continue
    }

    const rest = input.slice(i)

    // A bare date comes BEFORE a number: "2026-01-01" starts with four digits, and the
    // lexer would otherwise see the integer 2026 followed by an orphan dash.
    if (/\d/.test(c)) {
      const date =
        /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/.exec(rest)
      if (date !== null) {
        tokens.push({ t: 'word', v: date[0] })
        i += date[0].length
        continue
      }
    }

    if (/[\d-]/.test(c)) {
      const number = /^-?\d+(?:\.\d+)?(?![\w-])/.exec(rest)
      if (number !== null) {
        tokens.push({ t: 'number', v: Number(number[0]) })
        i += number[0].length
        continue
      }
    }

    // A word covers identifiers, keywords, booleans and bare dates: `_updated_at gte
    // 2026-01-01` must parse without quotes, since that is the form a consumer writes
    // by hand to resume after an outage.
    const word = /^[_a-zA-Z][\w.:+-]*/.exec(rest)
    if (word !== null) {
      tokens.push({ t: 'word', v: word[0] })
      i += word[0].length
      continue
    }

    throw malformed(`unexpected character "${c}"`)
  }

  return tokens
}

function malformed(detail: string): BasedbError {
  // §12 files a malformed parameter under REQUEST_INVALID: the registry carries no
  // syntax code specific to filters, and inventing one would make it diverge.
  return new BasedbError('REQUEST_INVALID', { details: { parameter: 'filter', detail } })
}

function tooComplex(bound: string, value: number): BasedbError {
  return new BasedbError('FILTER_TOO_COMPLEX', { details: { bound, maximum: value } })
}

// ── Syntactic analysis ──────────────────────────────────────────────────────

class Parser {
  private position = 0
  private predicates = 0
  private depth = 0

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): Node {
    if (this.tokens.length === 0) throw malformed('empty filter')
    const tree = this.or()
    if (this.position < this.tokens.length) throw malformed('incomplete expression')
    return tree
  }

  private or(): Node {
    let left = this.and()
    while (this.keyword('or')) left = { type: 'or', left, right: this.and() }
    return left
  }

  private and(): Node {
    // `and` binds tighter than `or`: it therefore occupies the lower level.
    let left = this.unary()
    while (this.keyword('and')) left = { type: 'and', left, right: this.unary() }
    return left
  }

  private unary(): Node {
    if (this.keyword('not')) return { type: 'not', inner: this.unary() }
    return this.primary()
  }

  private primary(): Node {
    if (this.symbol('(')) {
      // The depth counter is kept HERE, during the descent: a recursive parser that
      // only checked the bound afterwards would be a denial of service through stack
      // overflow (§4.6).
      this.depth++
      if (this.depth > BUDGETS.depth) {
        throw tooComplex('parenthesis depth', BUDGETS.depth)
      }
      const inner = this.or()
      if (!this.symbol(')')) throw malformed('missing closing parenthesis')
      this.depth--
      return inner
    }
    return this.predicate()
  }

  private predicate(): Node {
    this.predicates++
    if (this.predicates > BUDGETS.predicates) {
      throw tooComplex('number of predicates', BUDGETS.predicates)
    }

    const field = this.tokens[this.position]
    if (field?.t !== 'word') throw malformed('field name expected')
    this.position++

    const op = this.tokens[this.position]
    if (op?.t !== 'word') throw malformed(`operator expected after "${field.v}"`)
    this.position++

    const name = op.v.toLowerCase()
    if (!(OPERATORS as readonly string[]).includes(name)) {
      throw new BasedbError('FILTER_OPERATOR_INVALID', { details: { operator: op.v } })
    }

    const operator = name as Operator
    // `is_null` is the only predicate without a value, and its negation is written
    // `not`, never through a fourteenth twin operator.
    const value = operator === 'is_null' ? null : this.value()

    return { type: 'predicate', field: field.v, op: operator, value }
  }

  private value(): Value {
    const token = this.tokens[this.position]
    if (token === undefined) throw malformed('value expected')

    if (token.t === 'symbol' && token.v === '[') {
      this.position++
      const list: Scalar[] = []
      while (!this.symbol(']')) {
        const element = this.tokens[this.position]
        if (element === undefined) throw malformed('missing closing bracket')
        list.push(this.scalar(element))
        this.position++
        if (list.length > BUDGETS.inElements) {
          throw tooComplex('elements in a list', BUDGETS.inElements)
        }
        this.symbol(',')
      }
      return list
    }

    this.position++
    return this.scalar(token)
  }

  private scalar(token: Token): Scalar {
    if (token.t === 'string' || token.t === 'number') return token.v
    if (token.t === 'word') {
      if (token.v === 'true' || token.v === 'false') return token.v === 'true'
      return token.v
    }
    throw malformed('invalid value')
  }

  private keyword(word: string): boolean {
    const token = this.tokens[this.position]
    if (token?.t === 'word' && token.v.toLowerCase() === word) {
      this.position++
      return true
    }
    return false
  }

  private symbol(s: string): boolean {
    const token = this.tokens[this.position]
    if (token?.t === 'symbol' && token.v === s) {
      this.position++
      return true
    }
    return false
  }
}

// ── Value coercion ──────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Checks that a value is coercible to the column's type.
 *
 * This check happens BEFORE emission: letting PostgreSQL do it would surface a `22P02`
 * translated into a server error, where the contract requires a 400.
 */
function coerce(value: Scalar, kind: FieldKind, field: string): unknown {
  const invalid = (): never => {
    throw new BasedbError('FILTER_VALUE_INVALID', { details: { field, value: String(value) } })
  }

  switch (kind) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value)
      if (typeof value === 'boolean' || !Number.isFinite(n)) invalid()
      return n
    }
    case 'boolean':
      if (typeof value !== 'boolean') invalid()
      return value
    case 'link':
      if (typeof value !== 'string' || !UUID.test(value)) invalid()
      return value
    case 'date':
      if (typeof value !== 'string' || !DATE.test(value)) invalid()
      return value
    case 'datetime':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) invalid()
      return value
    default:
      if (typeof value === 'boolean') invalid()
      return String(value)
  }
}

// ── SQL translation ─────────────────────────────────────────────────────────

/** Resolves a filter name to an allowed column, or returns `undefined`. */
export function resolveColumn(
  name: string,
  columns: ReadonlyMap<string, FilterableColumn>,
): FilterableColumn | undefined {
  const fromCatalog = columns.get(name)
  if (fromCatalog !== undefined) return fromCatalog

  const system = SYSTEM[name]
  return system === undefined ? undefined : { name, kind: system }
}

/** What the SQL builder is allowed to name, and nothing more. */
interface BuildContext {
  readonly columns: ReadonlyMap<string, FilterableColumn>
  readonly links: ReadonlyMap<string, FilterableTarget>
  /** Correlated alias of an `EXISTS`, unique within the query. */
  readonly nextAlias: () => string
}

/**
 * Translates a filter into a `WHERE` fragment.
 *
 * `columns` contains ONLY the fields of the read mask. A masked field is therefore
 * indistinguishable from a non-existent one — otherwise `filter=salaire gte 50000`,
 * then 25000, then 37500, would read by dichotomy a column the actor has no right to
 * see, merely by observing which rows come back (§4.3).
 */
export function buildFilter(
  expression: string,
  columns: ReadonlyMap<string, FilterableColumn>,
  options: {
    readonly alias?: string
    readonly firstParameter?: number
    readonly links?: ReadonlyMap<string, FilterableTarget>
  } = {},
): BuiltFilter {
  const bytes = Buffer.byteLength(expression, 'utf8')
  if (bytes > BUDGETS.bytes) {
    throw new BasedbError('FILTER_TOO_LONG', { details: { bytes, maximum: BUDGETS.bytes } })
  }

  const tree = new Parser(tokenize(expression)).parse()
  const params: unknown[] = []
  const base = options.firstParameter ?? 1
  const prefix = options.alias === undefined ? '' : `${quoteIdentifier(options.alias)}.`

  const bind = (v: unknown): number => {
    params.push(v)
    return base + params.length - 1
  }

  let paths = 0
  const context: BuildContext = {
    columns,
    links: options.links ?? new Map(),
    nextAlias: () => {
      paths++
      if (paths > BUDGETS.linkPaths) {
        throw tooComplex('distinct link paths', BUDGETS.linkPaths)
      }
      return `l${paths}`
    },
  }

  return { sql: emit(tree, context, prefix, bind), params }
}

function emit(
  node: Node,
  context: BuildContext,
  prefix: string,
  bind: (v: unknown) => number,
): string {
  switch (node.type) {
    case 'or':
      return `(${emit(node.left, context, prefix, bind)} OR ${emit(node.right, context, prefix, bind)})`
    case 'and':
      return `(${emit(node.left, context, prefix, bind)} AND ${emit(node.right, context, prefix, bind)})`
    case 'not':
      return `NOT (${emit(node.inner, context, prefix, bind)})`
    case 'predicate':
      return predicate(node, context, prefix, bind)
  }
}

function predicate(
  node: { readonly field: string; readonly op: Operator; readonly value: Value },
  context: BuildContext,
  prefix: string,
  bind: (v: unknown) => number,
): string {
  if (node.field.includes('.')) return linkPath(node, context, prefix, bind)

  const column = resolveColumn(node.field, context.columns)
  if (column === undefined) {
    // Non-existent field and unreadable field: the two causes are never separated.
    throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: node.field } })
  }

  return comparison(`${prefix}${quoteIdentifier(column.name)}`, column, node, bind)
}

/**
 * Translates `<link_field>.<target_field>` into a correlated `EXISTS` — §4.4, invariant
 * I2.
 *
 * An `EXISTS`, never a join: a join would duplicate source rows as many times as the
 * target is referenced, and would combine FALSELY with `or`.
 *
 * And the `EXISTS` carries the row predicate of the TARGET table. Without it, a reader
 * allowed on `factures` but not on the rows of `clients` would reconstruct by dichotomy
 * the company name of invisible clients, merely by observing how many invoices come
 * back — with no row of `clients` ever returned, hence no alarm at all.
 */
function linkPath(
  node: { readonly field: string; readonly op: Operator; readonly value: Value },
  context: BuildContext,
  prefix: string,
  bind: (v: unknown) => number,
): string {
  const [linkName, targetField, ...rest] = node.field.split('.')

  // Depth 1, without exception: the cost of a rank-k expansion is the product of the
  // cardinalities, and reflexive cycles would make the bound infinite.
  if (rest.length > 0 || targetField === undefined || targetField === '') {
    throw new BasedbError('EXPAND_TOO_DEEP', { details: { path: node.field } })
  }

  // The explicit annotation is not decorative: without it, TypeScript does not treat
  // the call as a point of no return and does not narrow types downstream.
  const unknownField: () => never = () => {
    // Unreadable target, masked field, non-existent field: one and the same response.
    // Telling them apart would allow enumerating the structure of a forbidden table.
    throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: node.field } })
  }

  const link = context.columns.get(linkName)
  if (link === undefined || link.kind !== 'link') unknownField()

  const target = context.links.get(linkName)
  // When the target table is unreadable, the link field supports only `is_null` and its
  // negation (A16): no path traverses it.
  if (target === undefined || !target.readable) unknownField()

  // `display` is a reserved identifier designating the target's display column. It lets
  // a filter be written without knowing the target's structure.
  const column =
    targetField === 'display' ? target.displayColumn : resolveColumn(targetField, target.columns)

  if (column === null) {
    // `display_field_id` is nullable, so a target without a display column is a valid
    // state: the filter, however, has nothing to bear on.
    throw new BasedbError('FILTER_DISPLAY_UNAVAILABLE', { details: { path: node.field } })
  }
  if (column === undefined) unknownField()

  const alias = context.nextAlias()
  const q = quoteIdentifier(alias)
  const inner = comparison(`${q}.${quoteIdentifier(column.name)}`, column, node, bind)

  return `EXISTS (SELECT 1
              FROM ${target.relation} AS ${q}
             WHERE ${q}."_id" = ${prefix}${quoteIdentifier(linkName)}
               AND ( /*predicat_lignes:${linkName}*/ ${target.rowPredicate} )
               AND ${inner})`
}

/** Emits the comparison itself, once the column is resolved and the right checked. */
function comparison(
  col: string,
  column: FilterableColumn,
  node: { readonly field: string; readonly op: Operator; readonly value: Value },
  bind: (v: unknown) => number,
): string {
  if (!ALLOWED[column.kind].includes(node.op)) {
    throw new BasedbError('FILTER_OPERATOR_INVALID', {
      details: { field: node.field, operator: node.op, type: column.kind },
    })
  }

  const cast = CAST[column.kind]
  const scalar = (v: Value): string => {
    if (Array.isArray(v)) throw malformed(`"${node.op}" does not take a list`)
    return `$${bind(coerce(v as Scalar, column.kind, node.field))}::${cast}`
  }

  switch (node.op) {
    case 'is_null':
      return `${col} IS NULL`
    case 'eq':
      return `${col} = ${scalar(node.value)}`
    case 'ne':
      return `${col} <> ${scalar(node.value)}`
    case 'gt':
      return `${col} > ${scalar(node.value)}`
    case 'gte':
      return `${col} >= ${scalar(node.value)}`
    case 'lt':
      return `${col} < ${scalar(node.value)}`
    case 'lte':
      return `${col} <= ${scalar(node.value)}`

    case 'in': {
      if (!Array.isArray(node.value)) throw malformed('"in" takes a list')
      const list = node.value.map((v) => coerce(v, column.kind, node.field))
      return `${col} = ANY($${bind(list)}::${cast}[])`
    }

    case 'between': {
      if (!Array.isArray(node.value) || node.value.length !== 2) {
        throw malformed('"between" takes a list of two bounds')
      }
      const low = coerce(node.value[0], column.kind, node.field)
      const high = coerce(node.value[1], column.kind, node.field)
      // Bounds included.
      return `${col} BETWEEN $${bind(low)}::${cast} AND $${bind(high)}::${cast}`
    }

    // `fold_v1` is applied identically to the column AND to the parameter: a comparison
    // folded on one side only would be asymmetric.
    case 'eq_ci':
      return `_basedb_local.fold_v1(${col}) = _basedb_local.fold_v1(${scalar(node.value)})`
    case 'contains':
      return like(col, node, bind, "'%' || ", " || '%'")
    case 'starts_with':
      return like(col, node, bind, '', " || '%'")
    case 'ends_with':
      return like(col, node, bind, "'%' || ", '')
  }
}

/**
 * `LIKE` on the folded form, metacharacters escaped.
 *
 * The pattern is assembled in SQL rather than in JavaScript: the bordering `%` stay
 * wildcards, while those the user typed are escaped inside the bound value. Without
 * this, `contains "100%"` would become a full table scan.
 */
function like(
  col: string,
  node: { readonly value: Value; readonly field: string },
  bind: (v: unknown) => number,
  before: string,
  after: string,
): string {
  if (Array.isArray(node.value)) throw malformed('this operator does not take a list')
  const escaped = String(node.value).replace(/([\\%_])/g, '\\$1')
  const parameter = `_basedb_local.fold_v1($${bind(escaped)}::text)`
  return `_basedb_local.fold_v1(${col}) LIKE ${before}${parameter}${after} ESCAPE '\\'`
}

// ── Sorting ─────────────────────────────────────────────────────────────────

/** One resolved sort term, with everything a cursor needs to resume on it. */
export interface SortTermPlan {
  readonly name: string
  readonly kind: FieldKind
  readonly descending: boolean
  /** The `ORDER BY` fragment, collation included, without the direction. */
  readonly expression: string
}

export interface BuiltSort {
  readonly sql: string
  readonly columns: readonly string[]
  readonly terms: readonly SortTermPlan[]
}

/** The types whose comparison must carry the linguistic collation. */
const TEXTUAL: ReadonlySet<FieldKind> = new Set(['short_text', 'select', 'formula'])

/**
 * Translates `sort=-date_emission,numero` into an `ORDER BY`.
 *
 * `_id` is ALWAYS appended last. It is the tie-break: without it, two rows with the
 * same value may swap places between two pages, and pagination skips or repeats rows
 * with nothing to signal it.
 */
export function buildSort(
  expression: string | undefined,
  columns: ReadonlyMap<string, FilterableColumn>,
  alias?: string,
): BuiltSort {
  const prefix = alias === undefined ? '' : `${quoteIdentifier(alias)}.`
  const parts: string[] = []
  const named: string[] = []
  const terms: SortTermPlan[] = []

  for (const raw of (expression ?? '').split(',')) {
    const trimmed = raw.trim()
    if (trimmed === '') continue

    const descending = trimmed.startsWith('-')
    const name = descending ? trimmed.slice(1) : trimmed

    const column = resolveColumn(name, columns)
    if (column === undefined) {
      // Same rule as for filters: a masked field behaves like an absent one, otherwise
      // `sort=salaire` would hand over the full ordering of a masked column.
      throw new BasedbError('SORT_FIELD_UNKNOWN', { details: { field: name } })
    }
    if (column.kind === 'long_text') {
      throw new BasedbError('SORT_UNAVAILABLE', { details: { field: name, type: column.kind } })
    }
    if (named.includes(column.name)) {
      throw malformed(`repeated sort field: "${name}"`)
    }

    const collate = TEXTUAL.has(column.kind) ? ' COLLATE "und-x-icu"' : ''
    const direction = descending ? 'DESC' : 'ASC'
    const fragment = `${prefix}${quoteIdentifier(column.name)}${collate}`
    parts.push(`${fragment} ${direction}`)
    named.push(column.name)
    terms.push({ name: column.name, kind: column.kind, descending, expression: fragment })
  }

  parts.push(`${prefix}"_id" ASC`)
  return { sql: parts.join(', '), columns: named, terms }
}
