import { BasedbError } from '../errors/index.js'

/**
 * The formula language — chapter 04 §7.2 to §7.6.
 *
 * Three stages, each with one job:
 *
 *   1. `parseFormula` reads the text a person typed into a tree, fields still named by
 *      their LABEL — the grammar of §7.2, in French, `;` between arguments;
 *   2. `resolveFormula` names each field by its catalog key, types every node, and says
 *      whether the result can be stored — the rules of §7.3 and §7.4;
 *   3. `emitFormula` turns the typed tree into SQL — from the tree alone, never from the
 *      text: field references become physical names, functions come from a closed
 *      table, literals are re-emitted from their typed value (§7.6).
 *
 * `renderFormula` goes back from the tree to text with the labels of the day: a renamed
 * field reads under its new name, and no substitution ever runs on what was typed.
 */

// ── The tree ──────────────────────────────────────────────────────────────────────

export type FormulaType = 'number' | 'text' | 'boolean' | 'date' | 'datetime' | 'null'

export type Operator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '&'
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='
  | 'ET'
  | 'OU'

/** A node as parsed: a field is still its label. */
export type RawNode =
  | { readonly t: 'number'; readonly v: string; readonly at: number }
  | { readonly t: 'text'; readonly v: string; readonly at: number }
  | { readonly t: 'boolean'; readonly v: boolean; readonly at: number }
  | { readonly t: 'null'; readonly at: number }
  | { readonly t: 'field'; readonly label: string; readonly at: number }
  | {
      readonly t: 'call'
      readonly fn: string
      readonly args: readonly RawNode[]
      readonly at: number
    }
  | {
      readonly t: 'binary'
      readonly op: Operator
      readonly left: RawNode
      readonly right: RawNode
      readonly at: number
    }
  | { readonly t: 'not'; readonly e: RawNode; readonly at: number }
  | { readonly t: 'negate'; readonly e: RawNode; readonly at: number }

/** The stored tree (`field_formula_config.ast`): a field is its catalog key. */
export type Node =
  | { readonly t: 'number'; readonly v: string }
  | { readonly t: 'text'; readonly v: string }
  | { readonly t: 'boolean'; readonly v: boolean }
  | { readonly t: 'null' }
  | { readonly t: 'field'; readonly id: string }
  | { readonly t: 'call'; readonly fn: string; readonly args: readonly Node[] }
  | { readonly t: 'binary'; readonly op: Operator; readonly left: Node; readonly right: Node }
  | { readonly t: 'not'; readonly e: Node }
  | { readonly t: 'negate'; readonly e: Node }

export const MAX_FORMULA_CHARS = 4000
export const MAX_FORMULA_DEPTH = 16

function syntax(at: number, detail: string): BasedbError {
  return new BasedbError('FORMULA_SYNTAX', { details: { position: at, detail } })
}

// ── 1. Reading ────────────────────────────────────────────────────────────────────

type Token =
  | { readonly k: 'number'; readonly v: string; readonly at: number }
  | { readonly k: 'text'; readonly v: string; readonly at: number }
  | { readonly k: 'field'; readonly v: string; readonly at: number }
  | { readonly k: 'word'; readonly v: string; readonly at: number }
  | { readonly k: 'op'; readonly v: string; readonly at: number }
  | { readonly k: 'end'; readonly at: number }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i] as string
    if (/\s/.test(ch)) {
      i++
      continue
    }
    const at = i
    if (/[0-9]/.test(ch)) {
      const match = /^[0-9]+(\.[0-9]+)?/.exec(input.slice(i))
      const text = match?.[0] ?? ch
      tokens.push({ k: 'number', v: text, at })
      i += text.length
      continue
    }
    if (ch === '"') {
      // `""` is a quote inside the text, as in a spreadsheet.
      let value = ''
      i++
      for (;;) {
        if (i >= input.length) throw syntax(at, 'texte_non_ferme')
        if (input[i] === '"') {
          if (input[i + 1] === '"') {
            value += '"'
            i += 2
            continue
          }
          i++
          break
        }
        value += input[i]
        i++
      }
      tokens.push({ k: 'text', v: value, at })
      continue
    }
    if (ch === '[') {
      // `]]` is a bracket inside the label: only the closing one is doubled (§7.2).
      let label = ''
      i++
      for (;;) {
        if (i >= input.length) throw syntax(at, 'champ_non_ferme')
        if (input[i] === ']') {
          if (input[i + 1] === ']') {
            label += ']'
            i += 2
            continue
          }
          i++
          break
        }
        label += input[i]
        i++
      }
      tokens.push({ k: 'field', v: label, at })
      continue
    }
    const two = input.slice(i, i + 2)
    if (two === '<>' || two === '<=' || two === '>=') {
      tokens.push({ k: 'op', v: two, at })
      i += 2
      continue
    }
    if ('+-*/&=<>();'.includes(ch)) {
      tokens.push({ k: 'op', v: ch, at })
      i++
      continue
    }
    const word = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(input.slice(i))
    if (word !== null) {
      tokens.push({ k: 'word', v: word[0].toUpperCase(), at })
      i += word[0].length
      continue
    }
    throw syntax(at, `caractere_inattendu:${ch}`)
  }
  tokens.push({ k: 'end', at: input.length })
  return tokens
}

/** Reads a formula into a tree whose fields are still labels. */
export function parseFormula(input: string): RawNode {
  if ([...input].length > MAX_FORMULA_CHARS) throw syntax(0, 'formule_trop_longue')
  if (input.trim() === '') throw syntax(0, 'formule_vide')
  const tokens = tokenize(input)
  let pos = 0
  const peek = () => tokens[pos] as Token
  const next = () => tokens[pos++] as Token
  const isOp = (v: string) => {
    const t = peek()
    return t.k === 'op' && t.v === v
  }
  const isWord = (v: string) => {
    const t = peek()
    return t.k === 'word' && t.v === v
  }
  const expect = (v: string) => {
    const t = next()
    if (t.k !== 'op' || t.v !== v) throw syntax(t.at, `attendu:${v}`)
  }

  const guard = (depth: number, at: number) => {
    if (depth > MAX_FORMULA_DEPTH) throw syntax(at, 'imbrication_trop_profonde')
  }

  const or = (d: number): RawNode => {
    let left = and(d)
    while (isWord('OU')) {
      const at = next().at
      left = { t: 'binary', op: 'OU', left, right: and(d), at }
    }
    return left
  }
  const and = (d: number): RawNode => {
    let left = not(d)
    while (isWord('ET')) {
      const at = next().at
      left = { t: 'binary', op: 'ET', left, right: not(d), at }
    }
    return left
  }
  const not = (d: number): RawNode => {
    if (isWord('NON')) {
      const at = next().at
      return { t: 'not', e: comparison(d), at }
    }
    return comparison(d)
  }
  const comparison = (d: number): RawNode => {
    const left = sum(d)
    const t = peek()
    if (t.k === 'op' && ['=', '<>', '<', '<=', '>', '>='].includes(t.v)) {
      next()
      return { t: 'binary', op: t.v as Operator, left, right: sum(d), at: t.at }
    }
    return left
  }
  const sum = (d: number): RawNode => {
    let left = product(d)
    for (;;) {
      const t = peek()
      if (t.k !== 'op' || !['+', '-', '&'].includes(t.v)) return left
      next()
      left = { t: 'binary', op: t.v as Operator, left, right: product(d), at: t.at }
    }
  }
  const product = (d: number): RawNode => {
    let left = unary(d)
    for (;;) {
      const t = peek()
      if (t.k !== 'op' || !['*', '/'].includes(t.v)) return left
      next()
      left = { t: 'binary', op: t.v as Operator, left, right: unary(d), at: t.at }
    }
  }
  const unary = (d: number): RawNode => {
    if (isOp('-')) {
      const at = next().at
      return { t: 'negate', e: primary(d), at }
    }
    return primary(d)
  }
  const primary = (d: number): RawNode => {
    const t = next()
    guard(d, t.at)
    switch (t.k) {
      case 'number':
        return { t: 'number', v: t.v, at: t.at }
      case 'text':
        return { t: 'text', v: t.v, at: t.at }
      case 'field':
        return { t: 'field', label: t.v, at: t.at }
      case 'word': {
        if (t.v === 'VRAI' || t.v === 'FAUX') return { t: 'boolean', v: t.v === 'VRAI', at: t.at }
        if (t.v === 'NULL') return { t: 'null', at: t.at }
        if (!isOp('(')) throw syntax(t.at, `mot_inconnu:${t.v}`)
        next()
        const args: RawNode[] = []
        if (!isOp(')')) {
          args.push(or(d + 1))
          while (isOp(';')) {
            next()
            args.push(or(d + 1))
          }
        }
        expect(')')
        return { t: 'call', fn: t.v, args, at: t.at }
      }
      case 'op':
        if (t.v === '(') {
          const inner = or(d + 1)
          expect(')')
          return inner
        }
        throw syntax(t.at, `inattendu:${t.v}`)
      case 'end':
        throw syntax(t.at, 'fin_inattendue')
    }
  }

  const tree = or(0)
  const rest = peek()
  if (rest.k !== 'end') throw syntax(rest.at, 'suite_inattendue')
  return tree
}

// ── 2. Resolving and typing ───────────────────────────────────────────────────────

/** A field a formula may name, as the catalog describes it. */
export interface FormulaField {
  readonly id: string
  readonly label: string
  /** The physical name: what the SQL cites. */
  readonly name: string
  readonly kind: string
  /** False for a field computed at read time — it has no column to cite (04 §7 ter). */
  readonly stored: boolean
  /** For a computed field: the kind of its value, and whether it is a list. */
  readonly resultKind?: string
  readonly multiple?: boolean
}

/** The kinds a formula reads, as the type of the value it gets. */
function typeOfKind(kind: string): FormulaType | null {
  switch (kind) {
    case 'short_text':
    case 'long_text':
    case 'url':
    case 'email':
    case 'select':
      return 'text'
    case 'number':
    case 'autonumber':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    default:
      return null
  }
}

/** A formula's result, as the kind of a field (`field_formula_config.result_kind`). */
export function kindOfType(type: FormulaType): string {
  switch (type) {
    case 'number':
      return 'number'
    case 'text':
      return 'short_text'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'null':
      return 'short_text'
  }
}

export interface ResolvedFormula {
  readonly ast: Node
  readonly type: FormulaType
  /** The fields it cites, by catalog key. */
  readonly dependencies: readonly string[]
  /**
   * False when it cannot be a generated column: it reads the clock, or a field computed
   * at read time (04 §7.1).
   */
  readonly stored: boolean
  /** It calls AUJOURDHUI() — the field then carries a time zone. */
  readonly usesToday: boolean
}

function mismatch(at: number, detail: string): BasedbError {
  return new BasedbError('FORMULA_TYPE_MISMATCH', { details: { position: at, detail } })
}

/** The functions of §7.3: arity, and the typing of their result from their arguments. */
const FUNCTIONS: Readonly<
  Record<
    string,
    {
      readonly arity: number
      readonly type: (args: readonly FormulaType[], at: number) => FormulaType
      readonly volatile?: boolean
    }
  >
> = {
  SI: {
    arity: 3,
    type: ([c, a, b], at) => {
      expectType(c, ['boolean'], at, 'SI')
      return unify(a as FormulaType, b as FormulaType, at)
    },
  },
  SIVIDE: { arity: 2, type: ([a, b], at) => unify(a as FormulaType, b as FormulaType, at) },
  ESTVIDE: { arity: 1, type: () => 'boolean' },
  ARRONDI: { arity: 2, type: (args, at) => numbers(args, at, 'ARRONDI') },
  ABS: { arity: 1, type: (args, at) => numbers(args, at, 'ABS') },
  PLAFOND: { arity: 1, type: (args, at) => numbers(args, at, 'PLAFOND') },
  PLANCHER: { arity: 1, type: (args, at) => numbers(args, at, 'PLANCHER') },
  MIN: { arity: 2, type: (args, at) => ordered(args, at, 'MIN') },
  MAX: { arity: 2, type: (args, at) => ordered(args, at, 'MAX') },
  MAJUSCULE: { arity: 1, type: (args, at) => texts(args, at, 'MAJUSCULE') },
  MINUSCULE: { arity: 1, type: (args, at) => texts(args, at, 'MINUSCULE') },
  SANSESPACES: { arity: 1, type: (args, at) => texts(args, at, 'SANSESPACES') },
  LONGUEUR: {
    arity: 1,
    type: (args, at) => {
      texts(args, at, 'LONGUEUR')
      return 'number'
    },
  },
  GAUCHE: { arity: 2, type: ([x, n], at) => textAndCount(x, n, at, 'GAUCHE') },
  DROITE: { arity: 2, type: ([x, n], at) => textAndCount(x, n, at, 'DROITE') },
  TEXTE: {
    arity: 1,
    type: ([x], at) => {
      // Every date-to-text conversion of PostgreSQL depends on the session: refused (§7.3).
      if (x === 'date' || x === 'datetime') {
        throw new BasedbError('FORMULA_FUNCTION_NOT_IMMUTABLE', {
          details: { position: at, function: 'TEXTE' },
        })
      }
      expectType(x, ['number', 'boolean', 'text'], at, 'TEXTE')
      return 'text'
    },
  },
  NOMBRE: {
    arity: 1,
    type: (args, at) => {
      texts(args, at, 'NOMBRE')
      return 'number'
    },
  },
  ANNEE: { arity: 1, type: (args, at) => datePart(args, at, 'ANNEE') },
  MOIS: { arity: 1, type: (args, at) => datePart(args, at, 'MOIS') },
  JOUR: { arity: 1, type: (args, at) => datePart(args, at, 'JOUR') },
  JOURSEMAINE: { arity: 1, type: (args, at) => datePart(args, at, 'JOURSEMAINE') },
  JOURS: {
    arity: 2,
    type: ([a, b], at) => {
      expectType(a, ['date'], at, 'JOURS')
      expectType(b, ['date'], at, 'JOURS')
      return 'number'
    },
  },
  AJOUTER_JOURS: {
    arity: 2,
    type: ([d, n], at) => {
      expectType(d, ['date'], at, 'AJOUTER_JOURS')
      expectType(n, ['number'], at, 'AJOUTER_JOURS')
      return 'date'
    },
  },
  DATE: {
    arity: 3,
    type: (args, at) => {
      numbers(args, at, 'DATE')
      return 'date'
    },
  },
  AUJOURDHUI: { arity: 0, type: () => 'date', volatile: true },
  MAINTENANT: { arity: 0, type: () => 'datetime', volatile: true },
}

/** The names a formula may call, for completion and documentation. */
export const FORMULA_FUNCTIONS: readonly string[] = Object.keys(FUNCTIONS)

function expectType(
  actual: FormulaType | undefined,
  allowed: readonly FormulaType[],
  at: number,
  where: string,
): void {
  if (actual === undefined || actual === 'null') return
  if (!allowed.includes(actual)) throw mismatch(at, `${where}:${actual}`)
}

function unify(a: FormulaType, b: FormulaType, at: number): FormulaType {
  if (a === 'null') return b
  if (b === 'null' || a === b) return a
  throw mismatch(at, `${a}≠${b}`)
}

function numbers(args: readonly FormulaType[], at: number, where: string): FormulaType {
  for (const a of args) expectType(a, ['number'], at, where)
  return 'number'
}

function texts(args: readonly FormulaType[], at: number, where: string): FormulaType {
  for (const a of args) expectType(a, ['text'], at, where)
  return 'text'
}

function textAndCount(
  x: FormulaType | undefined,
  n: FormulaType | undefined,
  at: number,
  where: string,
): FormulaType {
  expectType(x, ['text'], at, where)
  expectType(n, ['number'], at, where)
  return 'text'
}

function ordered(args: readonly FormulaType[], at: number, where: string): FormulaType {
  const [a, b] = args as [FormulaType, FormulaType]
  expectType(a, ['number', 'date', 'datetime'], at, where)
  expectType(b, ['number', 'date', 'datetime'], at, where)
  return unify(a, b, at)
}

function datePart(args: readonly FormulaType[], at: number, where: string): FormulaType {
  const [d] = args
  // On a date and time, the day depends on the time zone: refused, as §7.3 says.
  if (d === 'datetime') {
    throw new BasedbError('FORMULA_FUNCTION_NOT_IMMUTABLE', {
      details: { position: at, function: where, reason: 'date_et_heure' },
    })
  }
  expectType(d, ['date'], at, where)
  return 'number'
}

/**
 * Names fields by their catalog key, types the tree, and decides whether it can be
 * stored. `fields` is keyed by the label comparison key (chapter 01), so `[prix ht]` and
 * `[Prix HT]` name the same field.
 */
export function resolveFormula(
  raw: RawNode,
  fields: ReadonlyMap<string, FormulaField>,
  keyOf: (label: string) => string,
): ResolvedFormula {
  const dependencies = new Set<string>()
  let stored = true
  let usesToday = false

  const walk = (node: RawNode): { node: Node; type: FormulaType } => {
    switch (node.t) {
      case 'number':
        return { node: { t: 'number', v: node.v }, type: 'number' }
      case 'text':
        return { node: { t: 'text', v: node.v }, type: 'text' }
      case 'boolean':
        return { node: { t: 'boolean', v: node.v }, type: 'boolean' }
      case 'null':
        return { node: { t: 'null' }, type: 'null' }
      case 'field': {
        const field = fields.get(keyOf(node.label))
        if (field === undefined) {
          throw new BasedbError('FORMULA_FIELD_NOT_FOUND', {
            details: { position: node.at, field: node.label },
          })
        }
        if (field.kind === 'link' || field.kind === 'multi_link') {
          throw new BasedbError('FORMULA_LINK_FORBIDDEN', {
            details: { position: node.at, field: node.label },
          })
        }
        if (field.kind === 'formula') {
          // A generated column cannot read another: no chains, the expression is rewritten.
          throw new BasedbError('FORMULA_DEPENDS_ON_FORMULA', {
            details: { position: node.at, field: node.label },
          })
        }
        const computed = !field.stored
        if (computed && field.multiple === true) {
          throw mismatch(node.at, `liste:${node.label}`)
        }
        const type = typeOfKind(computed ? (field.resultKind ?? '') : field.kind)
        if (type === null) throw mismatch(node.at, `type_de_champ:${node.label}`)
        if (computed) stored = false
        dependencies.add(field.id)
        return { node: { t: 'field', id: field.id }, type }
      }
      case 'call': {
        const spec = FUNCTIONS[node.fn]
        if (spec === undefined) throw syntax(node.at, `fonction_inconnue:${node.fn}`)
        if (node.args.length !== spec.arity) {
          throw syntax(node.at, `arguments:${node.fn}:${spec.arity}`)
        }
        const args = node.args.map(walk)
        if (spec.volatile === true) {
          stored = false
          if (node.fn === 'AUJOURDHUI') usesToday = true
        }
        const type = spec.type(
          args.map((a) => a.type),
          node.at,
        )
        return { node: { t: 'call', fn: node.fn, args: args.map((a) => a.node) }, type }
      }
      case 'binary': {
        const left = walk(node.left)
        const right = walk(node.right)
        const out = (type: FormulaType) => ({
          node: { t: 'binary' as const, op: node.op, left: left.node, right: right.node },
          type,
        })
        const l = left.type
        const r = right.type
        switch (node.op) {
          case 'ET':
          case 'OU':
            expectType(l, ['boolean'], node.at, node.op)
            expectType(r, ['boolean'], node.at, node.op)
            return out('boolean')
          case '&':
            // Dates would go through a session-dependent conversion: refused (§7.3).
            if (l === 'date' || l === 'datetime' || r === 'date' || r === 'datetime') {
              throw new BasedbError('FORMULA_FUNCTION_NOT_IMMUTABLE', {
                details: { position: node.at, function: '&' },
              })
            }
            return out('text')
          case '=':
          case '<>':
          case '<':
          case '<=':
          case '>':
          case '>=':
            unify(l, r, node.at)
            return out('boolean')
          case '-':
            // Two dates: the days between them. A date and a number: the date moved.
            if (l === 'date' && r === 'date') return out('number')
            if (l === 'date' && (r === 'number' || r === 'null')) return out('date')
            return out(numbers([l, r], node.at, node.op))
          case '+':
            if (l === 'date' && (r === 'number' || r === 'null')) return out('date')
            if (r === 'date' && l === 'number') return out('date')
            return out(numbers([l, r], node.at, node.op))
          case '*':
          case '/':
            return out(numbers([l, r], node.at, node.op))
        }
        throw syntax(node.at, `operateur:${node.op}`)
      }
      case 'not': {
        const e = walk(node.e)
        expectType(e.type, ['boolean'], node.at, 'NON')
        return { node: { t: 'not', e: e.node }, type: 'boolean' }
      }
      case 'negate': {
        const e = walk(node.e)
        expectType(e.type, ['number'], node.at, '-')
        return { node: { t: 'negate', e: e.node }, type: 'number' }
      }
    }
  }

  const { node, type } = walk(raw)
  if (type === 'null') throw mismatch(0, 'resultat_toujours_vide')
  return { ast: node, type, dependencies: [...dependencies], stored, usesToday }
}

// ── 3. Emitting SQL ───────────────────────────────────────────────────────────────

export interface EmitContext {
  /** The SQL that reads a field, by catalog key: a quoted column, or a sub-query. */
  readonly field: (id: string) => string
  /** The type of a field's value, to emit the conversions `&` and `TEXTE` need. */
  readonly typeOf: (id: string) => FormulaType
  /** Where AUJOURDHUI() is read. */
  readonly timezone: string
}

const NUMBER = /^[0-9]+(\.[0-9]+)?$/
const TIMEZONE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/

/** A text literal, re-emitted from its value: quotes doubled, nothing else interpreted. */
function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** `least(greatest(x, lo), hi)::int`: every cast to int is bounded (§7.3, first rule). */
function boundedInt(sql: string, lo: number, hi: number): string {
  return `least(greatest(${sql}, ${lo}), ${hi})::int`
}

/** A value as text, for `&` and `TEXTE`: numbers without their trailing zeros. */
function asText(sql: string, type: FormulaType): string {
  switch (type) {
    case 'number':
      return `trim_scale(${sql})::text`
    case 'boolean':
      return `CASE WHEN ${sql} THEN 'VRAI' WHEN NOT ${sql} THEN 'FAUX' END`
    default:
      return `${sql}::text`
  }
}

/** The SQL of a typed tree. */
export function emitFormula(ast: Node, context: EmitContext): string {
  const typeOf = (node: Node): FormulaType => {
    switch (node.t) {
      case 'number':
        return 'number'
      case 'text':
        return 'text'
      case 'boolean':
        return 'boolean'
      case 'null':
        return 'null'
      case 'field':
        return context.typeOf(node.id)
      case 'not':
        return 'boolean'
      case 'negate':
        return 'number'
      case 'call': {
        const spec = FUNCTIONS[node.fn]
        return spec === undefined ? 'null' : spec.type(node.args.map(typeOf), 0)
      }
      case 'binary': {
        const l = typeOf(node.left)
        const r = typeOf(node.right)
        if (['ET', 'OU', '=', '<>', '<', '<=', '>', '>='].includes(node.op)) return 'boolean'
        if (node.op === '&') return 'text'
        if (node.op === '-' && l === 'date' && r === 'date') return 'number'
        if ((node.op === '-' || node.op === '+') && (l === 'date' || r === 'date')) return 'date'
        return 'number'
      }
    }
  }

  const emit = (node: Node): string => {
    switch (node.t) {
      case 'number':
        // Re-validated at emission: the tree is stored, and a stored tree is not trusted.
        if (!NUMBER.test(node.v))
          throw new BasedbError('FORMULA_SYNTAX', { details: { value: node.v } })
        return `${node.v}::numeric`
      case 'text':
        return `${literal(node.v)}::text`
      case 'boolean':
        return node.v ? 'TRUE' : 'FALSE'
      case 'null':
        return 'NULL'
      case 'field':
        return context.field(node.id)
      case 'not':
        return `(NOT ${emit(node.e)})`
      case 'negate':
        return `(-${emit(node.e)})`
      case 'binary': {
        const l = emit(node.left)
        const r = emit(node.right)
        const lt = typeOf(node.left)
        const rt = typeOf(node.right)
        switch (node.op) {
          case 'ET':
            return `(${l} AND ${r})`
          case 'OU':
            return `(${l} OR ${r})`
          case '&':
            // `||` and not `concat()`, which is STABLE; an absent value is an empty text.
            return `(coalesce(${asText(l, lt)}, '') || coalesce(${asText(r, rt)}, ''))`
          case '/':
            // A division by zero would make the row unwritable forever: it gives « vide ».
            return `(CASE WHEN ${r} = 0 OR ${r} IS NULL THEN NULL ELSE ${l} / ${r} END)`
          case '-':
            if (lt === 'date' && rt === 'date') return `((${l} - ${r})::numeric)`
            if (lt === 'date') return `(${l} - ${boundedInt(r, -100000, 100000)})`
            return `(${l} - ${r})`
          case '+':
            if (lt === 'date') return `(${l} + ${boundedInt(r, -100000, 100000)})`
            if (rt === 'date') return `(${r} + ${boundedInt(l, -100000, 100000)})`
            return `(${l} + ${r})`
          default:
            return `(${l} ${node.op} ${r})`
        }
      }
      case 'call': {
        const a = node.args.map(emit)
        const t = node.args.map(typeOf)
        switch (node.fn) {
          case 'SI':
            return `(CASE WHEN ${a[0]} THEN ${a[1]} ELSE ${a[2]} END)`
          case 'SIVIDE':
            return `coalesce(${a[0]}, ${a[1]})`
          case 'ESTVIDE':
            return `(${a[0]} IS NULL)`
          case 'ARRONDI':
            return `round(${a[0]}, ${boundedInt(a[1] as string, -1000, 1000)})`
          case 'ABS':
            return `abs(${a[0]})`
          case 'PLAFOND':
            return `ceil(${a[0]})`
          case 'PLANCHER':
            return `floor(${a[0]})`
          case 'MIN':
            return `least(${a[0]}, ${a[1]})`
          case 'MAX':
            return `greatest(${a[0]}, ${a[1]})`
          case 'MAJUSCULE':
            return `upper(${a[0]} COLLATE "und-x-icu")`
          case 'MINUSCULE':
            return `lower(${a[0]} COLLATE "und-x-icu")`
          case 'SANSESPACES':
            return `btrim(${a[0]})`
          case 'LONGUEUR':
            return `length(${a[0]})::numeric`
          case 'GAUCHE':
            return `left(${a[0]}, ${boundedInt(a[1] as string, 0, 1000000)})`
          case 'DROITE':
            return `right(${a[0]}, ${boundedInt(a[1] as string, 0, 1000000)})`
          case 'TEXTE':
            return asText(a[0] as string, t[0] as FormulaType)
          case 'NOMBRE':
            return `(CASE WHEN ${a[0]} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${a[0]})::numeric ELSE NULL END)`
          case 'ANNEE':
            return `extract(year from ${a[0]})::numeric`
          case 'MOIS':
            return `extract(month from ${a[0]})::numeric`
          case 'JOUR':
            return `extract(day from ${a[0]})::numeric`
          case 'JOURSEMAINE':
            return `extract(isodow from ${a[0]})::numeric`
          case 'JOURS':
            return `((${a[0]} - ${a[1]})::numeric)`
          case 'AJOUTER_JOURS':
            return `(${a[0]} + ${boundedInt(a[1] as string, -100000, 100000)})`
          case 'DATE':
            return `_basedb_local.safe_date_v1(${a[0]}, ${a[1]}, ${a[2]})`
          case 'AUJOURDHUI': {
            if (!TIMEZONE.test(context.timezone)) {
              throw new BasedbError('FORMULA_SYNTAX', { details: { timezone: context.timezone } })
            }
            return `(pg_catalog.now() AT TIME ZONE ${literal(context.timezone)})::date`
          }
          case 'MAINTENANT':
            return 'pg_catalog.now()'
        }
        throw new BasedbError('FORMULA_SYNTAX', { details: { function: node.fn } })
      }
    }
  }

  return emit(ast)
}

// ── 4. Rendering ──────────────────────────────────────────────────────────────────

const PRECEDENCE: Readonly<Record<Operator, number>> = {
  OU: 1,
  ET: 2,
  '=': 4,
  '<>': 4,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '&': 5,
  '*': 6,
  '/': 6,
}

/**
 * The text of a stored tree, with today's labels — what the editor shows. Parentheses
 * are written where precedence needs them, so re-reading the text gives the same tree.
 */
export function renderFormula(ast: Node, labelOf: (id: string) => string): string {
  const render = (node: Node, parent = 0): string => {
    switch (node.t) {
      case 'number':
        return node.v
      case 'text':
        return `"${node.v.replace(/"/g, '""')}"`
      case 'boolean':
        return node.v ? 'VRAI' : 'FAUX'
      case 'null':
        return 'NULL'
      case 'field':
        return `[${labelOf(node.id).replace(/]/g, ']]')}]`
      case 'not':
        return parent > 3 ? `(NON ${render(node.e, 4)})` : `NON ${render(node.e, 4)}`
      case 'negate':
        return `-${render(node.e, 7)}`
      case 'call':
        return `${node.fn}(${node.args.map((a) => render(a)).join('; ')})`
      case 'binary': {
        const p = PRECEDENCE[node.op]
        const text = `${render(node.left, p)} ${node.op} ${render(node.right, p + 1)}`
        return p < parent ? `(${text})` : text
      }
    }
  }
  return render(ast)
}
