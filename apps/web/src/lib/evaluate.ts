import type { Field } from './api/client'
import { type Token, tokenize } from './expression'

/**
 * A filter expression evaluated against a row ON SCREEN — the colour rules of a grid
 * (chapter 11 §1.6).
 *
 * The rows are already loaded, and asking the server which of a hundred rows match each
 * of several rules would be a request per rule per page for a matter of paint. The
 * grammar is the kernel's (chapter 08 §4.1) and so are the semantics, down to the one
 * that surprises: a comparison with an empty value is false, as `NULL = x` is in SQL — only
 * `is_null` matches an empty cell. A path through a link (`client.ville`) needs the
 * target's row, which the page does not hold: a rule using one matches nothing.
 *
 * Never throws. A rule that does not parse matches nothing, and the editor that wrote it
 * says why.
 */

export type RowMatcher = (row: Readonly<Record<string, unknown>>) => boolean

type Scalar = string | number | boolean
type Value = Scalar | readonly Scalar[] | null

type Node =
  | { readonly type: 'or' | 'and'; readonly left: Node; readonly right: Node }
  | { readonly type: 'not'; readonly inner: Node }
  | {
      readonly type: 'predicate'
      readonly field: string
      readonly op: string
      readonly value: Value
    }

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function unquote(text: string): string {
  const body = text.endsWith('"') && text.length > 1 ? text.slice(1, -1) : text.slice(1)
  return body.replace(/\\(["\\])/g, '$1')
}

function scalarOf(token: Token): Scalar {
  if (token.kind === 'string') return unquote(token.text)
  if (token.text === 'true' || token.text === 'false') return token.text === 'true'
  const n = Number(token.text)
  return /^-?\d+(\.\d+)?$/.test(token.text) && Number.isFinite(n) ? n : token.text
}

class Parser {
  private at = 0
  constructor(private readonly tokens: readonly Token[]) {}

  parse(): Node {
    const node = this.or()
    if (this.at !== this.tokens.length) throw new Error('trailing')
    return node
  }

  private peek(): Token | undefined {
    return this.tokens[this.at]
  }

  private keyword(word: string): boolean {
    const t = this.peek()
    if (t?.kind === 'keyword' && t.text.toLowerCase() === word) {
      this.at++
      return true
    }
    return false
  }

  private symbol(s: string): boolean {
    const t = this.peek()
    if (t?.kind === 'punctuation' && t.text === s) {
      this.at++
      return true
    }
    return false
  }

  private or(): Node {
    let left = this.and()
    while (this.keyword('or')) left = { type: 'or', left, right: this.and() }
    return left
  }

  private and(): Node {
    let left = this.unary()
    while (this.keyword('and')) left = { type: 'and', left, right: this.unary() }
    return left
  }

  private unary(): Node {
    if (this.keyword('not')) return { type: 'not', inner: this.unary() }
    if (this.symbol('(')) {
      const inner = this.or()
      if (!this.symbol(')')) throw new Error('parenthesis')
      return inner
    }
    const field = this.peek()
    if (field?.kind !== 'field') throw new Error('field')
    this.at++
    const op = this.peek()
    if (op?.kind !== 'operator') throw new Error('operator')
    this.at++
    const name = op.text.toLowerCase()
    if (name === 'is_null') return { type: 'predicate', field: field.text, op: name, value: null }
    if (this.symbol('[')) {
      const list: Scalar[] = []
      while (!this.symbol(']')) {
        const t = this.peek()
        if (t === undefined) throw new Error('bracket')
        this.at++
        if (t.kind !== 'punctuation') list.push(scalarOf(t))
      }
      return { type: 'predicate', field: field.text, op: name, value: list }
    }
    const value = this.peek()
    if (value === undefined || value.kind === 'punctuation' || value.kind === 'keyword') {
      throw new Error('value')
    }
    this.at++
    return { type: 'predicate', field: field.text, op: name, value: scalarOf(value) }
  }
}

/** A cell's value reduced to what a predicate compares: a link by its identifier. */
function cellValue(row: Readonly<Record<string, unknown>>, field: Field): unknown {
  const value = row[field.name]
  if (field.kind === 'link' && value !== null && typeof value === 'object') {
    return (value as { id?: unknown }).id ?? null
  }
  // A multi-link is asked what it holds, by identifier, as a multiple choice is.
  if (field.kind === 'multi_link' && Array.isArray(value)) {
    return value.flatMap((v) => {
      const id = (v as { id?: unknown } | null)?.id
      return typeof id === 'string' ? [id] : []
    })
  }
  return value
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

function compare(a: unknown, b: Scalar, kind: string): number {
  if (kind === 'number' || kind === 'autonumber' || typeof b === 'number')
    return Number(a) - Number(b)
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function test(
  node: Node,
  row: Readonly<Record<string, unknown>>,
  fields: ReadonlyMap<string, Field>,
): boolean {
  switch (node.type) {
    case 'or':
      return test(node.left, row, fields) || test(node.right, row, fields)
    case 'and':
      return test(node.left, row, fields) && test(node.right, row, fields)
    case 'not':
      return !test(node.inner, row, fields)
    case 'predicate': {
      const field = fields.get(node.field)
      // Unknown, masked, or a path through a link: nothing this page can answer.
      if (field === undefined) return false
      const cell = cellValue(row, field)
      if (node.op === 'is_null') return isEmpty(cell)
      if (isEmpty(cell)) return false
      const v = node.value
      const list = Array.isArray(v) ? v : []
      const one = Array.isArray(v) ? null : (v as Scalar | null)
      switch (node.op) {
        case 'eq':
          return (
            one !== null &&
            (field.kind === 'boolean' ? cell === one : compare(cell, one, field.kind) === 0)
          )
        case 'ne':
          return (
            one !== null &&
            (field.kind === 'boolean' ? cell !== one : compare(cell, one, field.kind) !== 0)
          )
        case 'eq_ci':
          return one !== null && fold(String(cell)) === fold(String(one))
        case 'contains':
          return one !== null && fold(String(cell)).includes(fold(String(one)))
        case 'starts_with':
          return one !== null && fold(String(cell)).startsWith(fold(String(one)))
        case 'ends_with':
          return one !== null && fold(String(cell)).endsWith(fold(String(one)))
        case 'in':
          return list.some((item) => compare(cell, item, field.kind) === 0)
        case 'gt':
          return one !== null && compare(cell, one, field.kind) > 0
        case 'gte':
          return one !== null && compare(cell, one, field.kind) >= 0
        case 'lt':
          return one !== null && compare(cell, one, field.kind) < 0
        case 'lte':
          return one !== null && compare(cell, one, field.kind) <= 0
        case 'between': {
          const [low, high] = list
          return (
            low !== undefined &&
            high !== undefined &&
            compare(cell, low, field.kind) >= 0 &&
            compare(cell, high, field.kind) <= 0
          )
        }
        // A single value is a list of one, as the kernel reads it.
        case 'has_any':
          return Array.isArray(cell) && (one === null ? list : [one]).some((i) => cell.includes(i))
        case 'has_all':
          return Array.isArray(cell) && (one === null ? list : [one]).every((i) => cell.includes(i))
        default:
          return false
      }
    }
  }
}

/** Compiles a filter once for many rows; `null` when it does not parse. */
export function compileMatcher(expression: string, fields: readonly Field[]): RowMatcher | null {
  if (expression.trim() === '') return null
  let node: Node
  try {
    node = new Parser(tokenize(expression)).parse()
  } catch {
    return null
  }
  const byName = new Map(fields.map((f) => [f.name, f]))
  return (row) => test(node, row, byName)
}
