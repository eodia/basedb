/**
 * The filter grammar, as the editor needs to know it — chapter 08 §4.1.
 *
 *   expr      = or_expr
 *   or_expr   = and_expr , { "or" , and_expr }
 *   and_expr  = unary   , { "and" , unary }
 *   unary     = [ "not" ] , primary
 *   primary   = "(" , expr , ")" | predicate
 *   predicate = path , op , [ value ]
 *
 * This module holds NO list of operators and NO list of fields. Both are read from
 * `/meta/bases/{base}`, because chapter 11 §1.3 requires the interface to offer exactly
 * the operators the catalog declares — "l'interface n'en propose jamais un autre et
 * n'en cache aucun". A table copied here would be a second source of truth, and the
 * looser of the two is the one that eventually lies.
 *
 * What lives here is what the SERVER cannot tell us in time: the tokenizer that colours
 * a line as it is typed, the local checks that catch a mistake before a round trip, and
 * the formatter. None of them decides anything — the kernel's parser remains the only
 * authority, and everything here is a courtesy that may be wrong without consequence.
 */

import type { Field } from '@/lib/api/client'

/** The three keywords that combine predicates. Case-insensitive, per §4.1. */
export const KEYWORDS = ['and', 'or', 'not'] as const

/** `is_null` is the only operator without a value; its negation is written `not`. */
export const VALUELESS = new Set(['is_null'])

/**
 * Operators taking a LIST rather than a scalar. `has_any` and `has_all` also take a lone
 * value, but a multiple choice is usually asked about several.
 */
export const LIST_OPERATORS = new Set(['in', 'between', 'has_any', 'has_all'])

/**
 * A text as a string literal of the grammar.
 *
 * The grammar has exactly two escapes, `\"` and `\\`, and a text typed by a person must
 * go through them: an unescaped quote would end the literal early and turn the rest of
 * what was typed into filter syntax.
 */
export function quoteLiteral(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export type TokenKind =
  | 'field'
  | 'operator'
  | 'keyword'
  | 'string'
  | 'number'
  | 'punctuation'
  | 'unknown'

export interface Token {
  readonly kind: TokenKind
  readonly from: number
  readonly to: number
  readonly text: string
}

const SYMBOLS = new Set(['(', ')', '[', ']', ','])

/**
 * Splits an expression into tokens.
 *
 * It mirrors the kernel's lexer, including the one ordering subtlety that matters: a
 * bare date is matched BEFORE a number, because `2026-01-01` starts with four digits and
 * would otherwise read as the integer 2026 followed by an orphan dash.
 *
 * Unlike the kernel's, it never throws. An editor must colour a half-typed line, and
 * half-typed lines are malformed by definition.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const c = input[i]
    if (c === undefined) break

    if (/\s/.test(c)) {
      i++
      continue
    }

    if (SYMBOLS.has(c)) {
      tokens.push({ kind: 'punctuation', from: i, to: i + 1, text: c })
      i++
      continue
    }

    if (c === '"') {
      const start = i
      i++
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && (input[i + 1] === '"' || input[i + 1] === '\\')) i += 2
        else i++
      }
      // An unterminated string runs to the end of the line: that is what someone who has
      // typed the opening quote is looking at, and colouring it as a string is correct.
      if (i < input.length) i++
      tokens.push({ kind: 'string', from: start, to: i, text: input.slice(start, i) })
      continue
    }

    const rest = input.slice(i)

    if (/\d/.test(c)) {
      const date =
        /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/.exec(rest)
      if (date !== null) {
        tokens.push({ kind: 'number', from: i, to: i + date[0].length, text: date[0] })
        i += date[0].length
        continue
      }
    }

    if (/[\d-]/.test(c)) {
      const number = /^-?\d+(?:\.\d+)?(?![\w-])/.exec(rest)
      if (number !== null) {
        tokens.push({ kind: 'number', from: i, to: i + number[0].length, text: number[0] })
        i += number[0].length
        continue
      }
    }

    const word = /^[_a-zA-Z][\w.:+-]*/.exec(rest)
    if (word !== null) {
      tokens.push({ kind: 'unknown', from: i, to: i + word[0].length, text: word[0] })
      i += word[0].length
      continue
    }

    tokens.push({ kind: 'unknown', from: i, to: i + 1, text: c })
    i++
  }

  return classify(tokens)
}

/**
 * Assigns a role to each bare word, by POSITION rather than by dictionary.
 *
 * `contains` is an operator in `nom contains "x"` and a field name in a table that has a
 * column called `contains`. Only the position settles it, and the position is what the
 * grammar fixes: a predicate is `path op [value]`, so the word after a field is an
 * operator and the word after `and`, `or`, `not` or `(` is a field.
 */
function classify(tokens: readonly Token[]): Token[] {
  const out: Token[] = []
  // What the NEXT bare word is expected to be.
  let expect: 'field' | 'operator' | 'value' = 'field'

  for (const token of tokens) {
    if (token.kind !== 'unknown') {
      if (token.kind === 'string' || token.kind === 'number') {
        // A list keeps taking values until it closes; a scalar ends the predicate.
        expect = 'value'
      }
      if (token.text === '(' || token.text === ',' || token.text === '[') {
        if (token.text === '(') expect = 'field'
      }
      if (token.text === ')' || token.text === ']') expect = 'field'
      out.push(token)
      continue
    }

    const lower = token.text.toLowerCase()
    if ((KEYWORDS as readonly string[]).includes(lower)) {
      out.push({ ...token, kind: 'keyword' })
      expect = 'field'
      continue
    }

    if (expect === 'field') {
      out.push({ ...token, kind: 'field' })
      expect = 'operator'
      continue
    }
    if (expect === 'operator') {
      out.push({ ...token, kind: 'operator' })
      expect = VALUELESS.has(lower) ? 'field' : 'value'
      continue
    }

    // A bare word in value position: `true`, `false`, an unquoted date.
    out.push({ ...token, kind: 'number' })
    expect = 'field'
  }

  return out
}

export interface Problem {
  readonly from: number
  readonly to: number
  readonly message: string
  readonly severity: 'error' | 'warning'
}

/**
 * Local checks, run on every keystroke.
 *
 * Deliberately a SUBSET of what the kernel refuses: it flags what it is certain about —
 * an unknown field, an operator the field's type does not declare, an unbalanced
 * parenthesis — and stays silent on everything else. A local check that guesses would
 * mark a valid expression red, and people stop reading a marker that is wrong half the
 * time.
 */
export function check(input: string, fields: readonly Field[]): Problem[] {
  const problems: Problem[] = []
  const byName = new Map(fields.map((f) => [f.name, f]))
  const tokens = tokenize(input)

  let depth = 0
  let lastField: Field | null = null
  let lastFieldToken: Token | null = null

  for (const token of tokens) {
    if (token.text === '(') depth++
    if (token.text === ')') {
      depth--
      if (depth < 0) {
        problems.push({
          from: token.from,
          to: token.to,
          message: 'Parenthèse fermante en trop.',
          severity: 'error',
        })
        depth = 0
      }
    }

    if (token.kind === 'field') {
      // A link path — `client.raison_sociale` — is resolved by the kernel against the
      // target's own mask. Nothing here can check it, so nothing here flags it.
      if (token.text.includes('.')) {
        lastField = null
        lastFieldToken = null
        continue
      }
      const field = byName.get(token.text)
      if (field === undefined) {
        problems.push({
          from: token.from,
          to: token.to,
          message: `Champ inconnu : « ${token.text} ».`,
          severity: 'error',
        })
      }
      lastField = field ?? null
      lastFieldToken = token
      continue
    }

    if (token.kind === 'operator') {
      const operator = token.text.toLowerCase()
      if (lastField === null) continue
      const allowed = lastField.operators
      if (allowed === undefined) continue
      if (!allowed.includes(operator)) {
        problems.push({
          from: token.from,
          to: token.to,
          message:
            `« ${operator} » ne s’applique pas à un champ de type ${lastField.kind}. ` +
            `Opérateurs acceptés : ${allowed.join(', ')}.`,
          severity: 'error',
        })
      }
      lastField = null
      lastFieldToken = null
    }
  }

  if (depth > 0) {
    problems.push({
      from: Math.max(0, input.length - 1),
      to: input.length,
      message: `${depth} parenthèse${depth > 1 ? 's' : ''} non fermée${depth > 1 ? 's' : ''}.`,
      severity: 'error',
    })
  }

  if (lastFieldToken !== null && lastField !== null) {
    problems.push({
      from: lastFieldToken.from,
      to: lastFieldToken.to,
      message: `Il manque un opérateur après « ${lastFieldToken.text} ».`,
      severity: 'warning',
    })
  }

  return problems
}

/**
 * Lays an expression out over several lines.
 *
 * One predicate per line, `and` and `or` leading their line, parentheses indenting. The
 * leading operator is not a style preference: it puts every combinator in one column, so
 * that the shape of a long filter is readable at a glance instead of being reconstructed
 * by finding the word at the end of each line.
 *
 * It never changes what the expression MEANS — it only moves whitespace. An input it
 * cannot make sense of is returned untouched, which is the only safe failure mode for a
 * formatter.
 */
export function format(input: string): string {
  const tokens = tokenize(input)
  if (tokens.length === 0) return input

  const lines: string[] = []
  let depth = 0
  let current = ''

  const flush = () => {
    const text = current.trim()
    if (text !== '') lines.push('  '.repeat(Math.max(0, depth)) + text)
    current = ''
  }

  for (const token of tokens) {
    const lower = token.text.toLowerCase()

    if (token.kind === 'keyword' && (lower === 'and' || lower === 'or')) {
      flush()
      current = lower
      continue
    }

    if (token.text === '(') {
      current += current === '' ? '(' : ' ('
      flush()
      depth++
      continue
    }

    if (token.text === ')') {
      flush()
      depth--
      current = ')'
      flush()
      continue
    }

    // No space before a comma or a closing bracket, none after an opening one.
    if (token.text === ',' || token.text === ']') current += token.text
    else if (current === '' || current.endsWith('[')) current += token.text
    else current += ` ${token.text}`
  }

  flush()
  return lines.join('\n')
}

/** Collapses a formatted expression back to the single line the URL carries. */
export function flatten(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}
