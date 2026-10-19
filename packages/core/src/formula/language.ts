import { FORMULA_ENGLISH, type FormulaDialect, formulaDialect } from '@basedb/contracts'
import { BasedbError } from '../errors/index.js'

/**
 * The formula language — chapter 04 §7.2 to §7.6.
 *
 * Three stages, each with one job:
 *
 *   1. `parseFormula` reads the text a person typed into a tree, fields still named by
 *      their LABEL — the grammar of §7.2, in French or in English, `;` or `,` between
 *      arguments;
 *   2. `resolveFormula` names each field by its catalog key, types every node, and says
 *      whether the result can be stored — the rules of §7.3 and §7.4;
 *   3. `emitFormula` turns the typed tree into SQL — from the tree alone, never from the
 *      text: field references become physical names, functions come from a closed
 *      table, literals are re-emitted from their typed value (§7.6).
 *
 * `renderFormula` goes back from the tree to text with the labels of the day: a renamed
 * field reads under its new name, and no substitution ever runs on what was typed.
 *
 * The tree spells every word in French — the stored spelling. A formula is typed in either
 * language, and rendered in the reader's: French on a French screen, English on any other.
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

export { type FormulaDialect, formulaDialect }

const FROM_ENGLISH: ReadonlyMap<string, string> = new Map(
  Object.entries(FORMULA_ENGLISH).map(([french, english]) => [english, french]),
)

/** A word as the tree spells it, whichever language it was typed in. */
const canonical = (word: string): string => FROM_ENGLISH.get(word) ?? word

/** A word of the tree in the reader's language. */
const spell = (word: string, dialect: FormulaDialect): string =>
  dialect === 'en' ? (FORMULA_ENGLISH[word] ?? word) : word

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
    if ('+-*/&=<>();,'.includes(ch)) {
      // `,` separates arguments as `;` does — the decimal is the point, so it means nothing else.
      tokens.push({ k: 'op', v: ch === ',' ? ';' : ch, at })
      i++
      continue
    }
    const word = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(input.slice(i))
    if (word !== null) {
      tokens.push({ k: 'word', v: canonical(word[0].toUpperCase()), at })
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
   * False when it cannot be a generated column: it reads the clock, a day or an hour out of
   * a date and time, or a field computed at read time (04 §7.1).
   */
  readonly stored: boolean
  /** It calls AUJOURDHUI(). */
  readonly usesToday: boolean
  /**
   * It reads a day or an hour out of a date and time, or calls AUJOURDHUI() — the field
   * then carries a time zone, and a formula over a date and time is computed at read time.
   */
  readonly usesTimezone: boolean
  /**
   * The regular expressions it writes, which only the database can say are well formed:
   * the catalog asks it before the formula is saved (see `checkRegexPatterns`).
   */
  readonly patterns: readonly RegexPattern[]
}

/** A regular expression written in a formula, with where and in which function. */
export interface RegexPattern {
  readonly pattern: string
  readonly fn: string
  readonly position: number
}

function mismatch(at: number, detail: string): BasedbError {
  return new BasedbError('FORMULA_TYPE_MISMATCH', { details: { position: at, detail } })
}

/** What a function's own checks see, once the types of its arguments agree. */
interface CallCheck {
  readonly nodes: readonly Node[]
  readonly types: readonly FormulaType[]
  /** Where each argument starts, and where the call does. */
  readonly ats: readonly number[]
  readonly at: number
}

interface FunctionSpec {
  /** How many arguments it takes — at least this many, and at most `max`, which defaults to it. */
  readonly arity: number
  readonly max?: number
  readonly type: (args: readonly FormulaType[], at: number) => FormulaType
  /** It reads the clock: the formula is computed at read time. */
  readonly volatile?: boolean
  /**
   * The arguments read as a day. A date and time given there is read in the time zone of
   * the formula, and the formula is then computed at read time: a generated column depends
   * on no time zone (§7.3).
   */
  readonly days?: readonly number[]
  /** The argument that is a regular expression, which must be written in the formula. */
  readonly pattern?: number
  /** The checks that need the written value of an argument: a format, a unit, a pattern. */
  readonly check?: (call: CallCheck) => void
}

/** How many texts CONCAT and JOINDRE_TEXTE join. */
const MAX_JOINED = 32

/** What a function that reads a day accepts: a date, or a date and time read in the zone. */
const DAYS: readonly FormulaType[] = ['date', 'datetime']

/** The functions of §7.3: arity, and the typing of their result from their arguments. */
const FUNCTIONS: Readonly<Record<string, FunctionSpec>> = {
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
  STXT: {
    arity: 3,
    type: ([x, start, length], at) => {
      expectType(x, ['text'], at, 'STXT')
      expectType(start, ['number'], at, 'STXT')
      expectType(length, ['number'], at, 'STXT')
      return 'text'
    },
  },
  SUBSTITUE: { arity: 3, type: (args, at) => texts(args, at, 'SUBSTITUE') },
  TROUVE: { arity: 2, type: (args, at) => position(args, at, 'TROUVE') },
  CHERCHE: { arity: 2, type: (args, at) => position(args, at, 'CHERCHE') },
  CONTIENT: { arity: 2, type: (args, at) => test(args, at, 'CONTIENT') },
  COMMENCEPAR: { arity: 2, type: (args, at) => test(args, at, 'COMMENCEPAR') },
  FINITPAR: { arity: 2, type: (args, at) => test(args, at, 'FINITPAR') },
  NOMPROPRE: { arity: 1, type: (args, at) => texts(args, at, 'NOMPROPRE') },
  REPT: { arity: 2, type: ([x, n], at) => textAndCount(x, n, at, 'REPT') },
  CONCAT: { arity: 1, max: MAX_JOINED, type: (args, at) => joined(args, at, 'CONCAT') },
  JOINDRE_TEXTE: {
    arity: 3,
    max: MAX_JOINED + 2,
    type: ([separator, ignore, ...parts], at) => {
      expectType(separator, ['text'], at, 'JOINDRE_TEXTE')
      expectType(ignore, ['boolean'], at, 'JOINDRE_TEXTE')
      return joined(parts, at, 'JOINDRE_TEXTE')
    },
    check: ({ nodes, at, ats }) => {
      // The separator is repeated between the parts and the ignoring is a choice of the
      // formula's author, not of a row: both are written, never read from a field.
      writtenText(nodes[0], ats[0] ?? at, 'JOINDRE_TEXTE:separateur')
      if (nodes[1]?.t !== 'boolean') {
        throw syntax(ats[1] ?? at, 'valeur_ecrite_attendue:JOINDRE_TEXTE:ignorer_vides')
      }
    },
  },
  REGEX_CORRESPOND: {
    arity: 2,
    pattern: 1,
    type: (args, at) => {
      texts(args, at, 'REGEX_CORRESPOND')
      return 'boolean'
    },
  },
  REGEX_EXTRAIRE: { arity: 2, pattern: 1, type: (args, at) => texts(args, at, 'REGEX_EXTRAIRE') },
  REGEX_REMPLACER: {
    arity: 3,
    pattern: 1,
    type: (args, at) => texts(args, at, 'REGEX_REMPLACER'),
  },
  TEXTE: {
    arity: 1,
    max: 2,
    days: [0],
    type: ([x, format], at) => {
      if (format === undefined) {
        // Every date-to-text conversion of PostgreSQL depends on the session: refused (§7.3).
        // A date is written with a format, which the formula spells out itself.
        if (x === 'date' || x === 'datetime') {
          throw new BasedbError('FORMULA_FUNCTION_NOT_IMMUTABLE', {
            details: { position: at, function: 'TEXTE', reason: 'date_en_texte' },
          })
        }
        expectType(x, ['number', 'boolean', 'text'], at, 'TEXTE')
        return 'text'
      }
      expectType(x, ['date', 'datetime'], at, 'TEXTE')
      expectType(format, ['text'], at, 'TEXTE')
      return 'text'
    },
    check: ({ nodes, types, at, ats }) => {
      if (nodes.length < 2) return
      const format = writtenText(nodes[1], ats[1] ?? at, 'TEXTE:format')
      const parts = parseDateFormat(format, ats[1] ?? at)
      // A date has no hour: the format that asks for one is refused, not printed as zeros.
      if (types[0] === 'date' && parts.some((p) => TIME_UNITS.has(p.k))) {
        throw mismatch(at, 'TEXTE:heure_sur_date')
      }
    },
  },
  NOMBRE: {
    arity: 1,
    type: (args, at) => {
      texts(args, at, 'NOMBRE')
      return 'number'
    },
  },
  ANNEE: { arity: 1, days: [0], type: (args, at) => datePart(args, at, 'ANNEE') },
  MOIS: { arity: 1, days: [0], type: (args, at) => datePart(args, at, 'MOIS') },
  JOUR: { arity: 1, days: [0], type: (args, at) => datePart(args, at, 'JOUR') },
  JOURSEMAINE: { arity: 1, days: [0], type: (args, at) => datePart(args, at, 'JOURSEMAINE') },
  NO_SEMAINE_ISO: { arity: 1, days: [0], type: (args, at) => datePart(args, at, 'NO_SEMAINE_ISO') },
  HEURE: { arity: 1, days: [0], type: (args, at) => timePart(args, at, 'HEURE') },
  MINUTE: { arity: 1, days: [0], type: (args, at) => timePart(args, at, 'MINUTE') },
  SECONDE: { arity: 1, days: [0], type: (args, at) => timePart(args, at, 'SECONDE') },
  JOURS: {
    arity: 2,
    days: [0, 1],
    type: ([a, b], at) => {
      expectType(a, DAYS, at, 'JOURS')
      expectType(b, DAYS, at, 'JOURS')
      return 'number'
    },
  },
  AJOUTER_JOURS: {
    arity: 2,
    days: [0],
    type: ([d, n], at) => {
      expectType(d, DAYS, at, 'AJOUTER_JOURS')
      expectType(n, ['number'], at, 'AJOUTER_JOURS')
      return 'date'
    },
  },
  AJOUTER_MOIS: {
    arity: 2,
    days: [0],
    type: ([d, n], at) => {
      expectType(d, DAYS, at, 'AJOUTER_MOIS')
      expectType(n, ['number'], at, 'AJOUTER_MOIS')
      return 'date'
    },
  },
  FIN_MOIS: {
    arity: 1,
    max: 2,
    days: [0],
    type: ([d, n], at) => {
      expectType(d, DAYS, at, 'FIN_MOIS')
      if (n !== undefined) expectType(n, ['number'], at, 'FIN_MOIS')
      return 'date'
    },
  },
  DATEDIF: {
    arity: 3,
    days: [0, 1],
    type: ([start, end, unit], at) => {
      expectType(start, DAYS, at, 'DATEDIF')
      expectType(end, DAYS, at, 'DATEDIF')
      expectType(unit, ['text'], at, 'DATEDIF')
      return 'number'
    },
    check: ({ nodes, at, ats }) => {
      dateDifUnit(writtenText(nodes[2], ats[2] ?? at, 'DATEDIF:unite'), ats[2] ?? at)
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

/** The position of a text in another, or nothing: two texts in, a number out. */
function position(args: readonly FormulaType[], at: number, where: string): FormulaType {
  texts(args, at, where)
  return 'number'
}

/** A question asked of two texts. */
function test(args: readonly FormulaType[], at: number, where: string): FormulaType {
  texts(args, at, where)
  return 'boolean'
}

/**
 * Values joined into one text, as `&` joins them: a date goes through a conversion that
 * depends on the session, and is refused (§7.3).
 */
function joined(args: readonly FormulaType[], at: number, where: string): FormulaType {
  for (const a of args) {
    if (a === 'date' || a === 'datetime') {
      throw new BasedbError('FORMULA_FUNCTION_NOT_IMMUTABLE', {
        details: { position: at, function: where, reason: 'date_en_texte' },
      })
    }
  }
  return 'text'
}

/**
 * A part of a date. On a date and time the day depends on the time zone: the formula is
 * then read in the zone it carries and computed at read time (§7.3).
 */
function datePart(args: readonly FormulaType[], at: number, where: string): FormulaType {
  expectType(args[0], DAYS, at, where)
  return 'number'
}

/** A part of the time of day: only a date and time has one. */
function timePart(args: readonly FormulaType[], at: number, where: string): FormulaType {
  expectType(args[0], ['datetime'], at, where)
  return 'number'
}

/** A text the formula writes itself — a format, a unit, a pattern — not one read from a field. */
function writtenText(node: Node | undefined, at: number, where: string): string {
  if (node?.t !== 'text') throw syntax(at, `texte_ecrit_attendu:${where}`)
  return node.v
}

// ── What a formula writes in a text: a date format, a unit, a pattern ──────────────

type TimeUnit = 'hour' | 'minute' | 'second'

type FormatPart =
  | { readonly k: 'text'; readonly v: string }
  | { readonly k: 'year'; readonly digits: 2 | 4 }
  | { readonly k: 'month' | 'day' | TimeUnit; readonly digits: 1 | 2 }

const TIME_UNITS: ReadonlySet<string> = new Set<TimeUnit>(['hour', 'minute', 'second'])

/** The letters of a format, French and English alike: `jj/mm/aaaa` and `dd/mm/yyyy`. */
const FORMAT_LETTERS: Readonly<Record<string, 'year' | 'month' | 'day' | 'hour' | 'second'>> = {
  y: 'year',
  a: 'year',
  m: 'month',
  d: 'day',
  j: 'day',
  h: 'hour',
  s: 'second',
}

/**
 * Reads the format of `TEXTE(date; format)`. It is spelled out in SQL from numeric parts
 * only — never `to_char`, which depends on the session — so month and day names, which
 * would depend on a language, are not part of it. A letter that is not a code is refused
 * rather than printed; `\` writes the next character as it is.
 *
 * As in a spreadsheet, `m` is a minute right after the hour or right before the second,
 * and a month everywhere else.
 */
function parseDateFormat(format: string, at: number): FormatPart[] {
  const chars = [...format]
  const parts: FormatPart[] = []
  const literal = (v: string) => {
    const last = parts[parts.length - 1]
    if (last?.k === 'text') parts[parts.length - 1] = { k: 'text', v: last.v + v }
    else parts.push({ k: 'text', v })
  }
  let i = 0
  while (i < chars.length) {
    const ch = chars[i] as string
    if (ch === '\\') {
      const next = chars[i + 1]
      if (next === undefined) throw syntax(at, 'format_inconnu:\\')
      literal(next)
      i += 2
      continue
    }
    if (!/^[A-Za-z]$/.test(ch)) {
      literal(ch)
      i++
      continue
    }
    const unit = FORMAT_LETTERS[ch.toLowerCase()]
    let run = 1
    while (chars[i + run]?.toLowerCase() === ch.toLowerCase()) run++
    const code = chars.slice(i, i + run).join('')
    if (unit === undefined) throw syntax(at, `format_inconnu:${ch}`)
    if (unit === 'year') {
      if (run !== 2 && run !== 4) throw syntax(at, `format_inconnu:${code}`)
      parts.push({ k: 'year', digits: run })
    } else {
      // Three or four letters would be a name — « lun. », « septembre » — which a column
      // cannot give in every language.
      if (run > 2) throw syntax(at, `format_inconnu:${code}`)
      parts.push({ k: unit, digits: run as 1 | 2 })
    }
    i += run
  }
  // A month between an hour and a second is a minute.
  const codes = parts.filter((p) => p.k !== 'text')
  return parts.map((p) => {
    if (p.k !== 'month') return p
    const index = codes.indexOf(p)
    return codes[index - 1]?.k === 'hour' || codes[index + 1]?.k === 'second'
      ? ({ k: 'minute', digits: p.digits } as const)
      : p
  })
}

/** What `DATEDIF` counts between two dates: whole years, whole months, days, or the months left over after the years. */
const DATEDIF_UNITS: ReadonlySet<string> = new Set(['Y', 'M', 'D', 'YM'])

function dateDifUnit(unit: string, at: number): string {
  const upper = unit.toUpperCase()
  if (!DATEDIF_UNITS.has(upper)) throw syntax(at, `unite_inconnue:${unit}`)
  return upper
}

/**
 * A regular expression that must be written in the formula, never read from a field: a
 * pattern that varied by row could be invalid for one of them and make that row unwritable
 * for good. A back-reference makes PostgreSQL's matcher exponential, which a generated
 * column would pay on every write: refused.
 */
function regexPattern(node: Node | undefined, at: number, where: string): string {
  const pattern = writtenText(node, at, `${where}:motif`)
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '\\') continue
    const next = pattern[i + 1]
    if (next !== undefined && next >= '1' && next <= '9') {
      throw syntax(at, `motif_refuse:${where}:reference_arriere`)
    }
    i++
  }
  return pattern
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
  const patterns: RegexPattern[] = []
  let stored = true
  let usesToday = false
  let zoned = false

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
        const max = spec.max ?? spec.arity
        if (node.args.length < spec.arity || node.args.length > max) {
          const expected = max === spec.arity ? `${spec.arity}` : `${spec.arity}-${max}`
          throw syntax(node.at, `arguments:${node.fn}:${expected}`)
        }
        const args = node.args.map(walk)
        if (spec.volatile === true) {
          stored = false
          if (node.fn === 'AUJOURDHUI') usesToday = true
        }
        const types = args.map((a) => a.type)
        const type = spec.type(types, node.at)
        const nodes = args.map((a) => a.node)
        const ats = node.args.map((a) => a.at)
        spec.check?.({ nodes, types, ats, at: node.at })
        if (spec.pattern !== undefined) {
          patterns.push({
            pattern: regexPattern(nodes[spec.pattern], ats[spec.pattern] ?? node.at, node.fn),
            fn: node.fn,
            position: ats[spec.pattern] ?? node.at,
          })
        }
        // A date and time read as a day takes the zone of the formula, which no generated
        // column can carry (§7.3): the formula is computed at read time, like AUJOURDHUI().
        if (spec.days?.some((i) => types[i] === 'datetime') === true) {
          stored = false
          zoned = true
        }
        return { node: { t: 'call', fn: node.fn, args: nodes }, type }
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
  return {
    ast: node,
    type,
    dependencies: [...dependencies],
    stored,
    usesToday,
    usesTimezone: usesToday || zoned,
    patterns,
  }
}

// ── 3. Emitting SQL ───────────────────────────────────────────────────────────────

export interface EmitContext {
  /** The SQL that reads a field, by catalog key: a quoted column, or a sub-query. */
  readonly field: (id: string) => string
  /** The type of a field's value, to emit the conversions `&` and `TEXTE` need. */
  readonly typeOf: (id: string) => FormulaType
  /** Where AUJOURDHUI() is read, and where a date and time is read as a day or an hour. */
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

/**
 * A number turned into an `int` between two bounds, and empty when it is: `greatest` and
 * `least` ignore an absent value, which would turn « vide » into a bound. A number written
 * in the formula becomes the bounded integer itself. Fractions are cut, as a spreadsheet does.
 */
function intArg(node: Node, sql: string, lo: number, hi: number): string {
  if (node.t === 'number') return String(Math.min(Math.max(Math.trunc(Number(node.v)), lo), hi))
  return `(CASE WHEN ${sql} IS NULL THEN NULL ELSE trunc(least(greatest(${sql}, ${lo}), ${hi}))::int END)`
}

/**
 * The SQL a formula may reach before it is refused. A function that repeats an argument —
 * a format, a division — repeats what the argument holds, and nesting such calls multiplies
 * the text: a ceiling answers that with an error, not with the memory of the server.
 */
const MAX_SQL_CHARS = 200_000

/** The bounds of the integers a formula passes to PostgreSQL: characters, repeats, months. */
const MAX_CHARS = 1_000_000
const MAX_REPEATED = 32_767
const MAX_MONTHS = 12_000

/** A regular expression as a literal, checked again at emission: a stored tree is not trusted. */
function regexLiteral(node: Node, where: string): string {
  return `${literal(regexPattern(node, 0, where))}::text`
}

/**
 * A date within the years a date is written in. A date column also holds `infinity` and
 * years past 294 276, which a timestamp does not: the conversions below would raise on them,
 * and a row that raises is a row nobody can write again. Outside the years: empty.
 */
function withinYears(sql: string): string {
  return `(CASE WHEN ${sql} BETWEEN '0001-01-01'::date AND '9999-12-31'::date THEN ${sql} END)`
}

/**
 * `TEXTE(date; format)` in SQL: numeric parts only, so that the text is the same everywhere.
 * `local` is the date, or the wall-clock time of a date and time; it is read once per code,
 * and empty outside the years 1 to 9999.
 */
function dateFormatSql(
  parts: readonly FormatPart[],
  local: string,
  kind: 'date' | 'datetime',
): string {
  const pad = (sql: string, digits: number) =>
    digits === 2 ? `lpad(${sql}::text, 2, '0')` : `${sql}::text`
  const pieces = parts.map((p) => {
    switch (p.k) {
      case 'text':
        return literal(p.v)
      case 'year':
        return p.digits === 4
          ? `lpad(extract(year from ${local})::int::text, 4, '0')`
          : `lpad((extract(year from ${local})::int % 100)::text, 2, '0')`
      case 'second':
        // `extract(second …)` carries the fraction.
        return pad(`floor(extract(second from ${local}))::int`, p.digits)
      default:
        return pad(`extract(${p.k} from ${local})::int`, p.digits)
    }
  })
  const [first, last] =
    kind === 'date'
      ? [`'0001-01-01'::date`, `'9999-12-31'::date`]
      : [`'0001-01-01'::timestamp`, `'9999-12-31 23:59:59.999999'::timestamp`]
  const text = pieces.length === 0 ? `''::text` : pieces.join(' || ')
  return `(CASE WHEN ${local} BETWEEN ${first} AND ${last} THEN ${text} END)`
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
    const sql = emitNode(node)
    if (sql.length > MAX_SQL_CHARS) {
      throw new BasedbError('FORMULA_SYNTAX', { details: { detail: 'formule_trop_complexe' } })
    }
    return sql
  }

  /** The zone a date and time is read in: validated here, as AUJOURDHUI() has always done. */
  const zone = (): string => {
    if (!TIMEZONE.test(context.timezone)) {
      throw new BasedbError('FORMULA_SYNTAX', { details: { timezone: context.timezone } })
    }
    return literal(context.timezone)
  }

  const emitNode = (node: Node): string => {
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
        // The SQL of the nth argument, and of its node when it is written in the formula.
        const arg = (i: number) => a[i] as string
        const written = (i: number) => node.args[i] as Node
        // A date and time read as a day is that day in the zone of the formula.
        const wall = (i: number) => `(${arg(i)} AT TIME ZONE ${zone()})`
        const day = (i: number) => (t[i] === 'datetime' ? `${wall(i)}::date` : arg(i))
        const fold = (i: number) => `_basedb_local.fold_v1(${arg(i)})`
        const months = (i: number) => intArg(written(i), arg(i), -MAX_MONTHS, MAX_MONTHS)
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
          case 'STXT':
            return `substr(${a[0]}, ${intArg(written(1), arg(1), 1, MAX_CHARS)}, ${intArg(written(2), arg(2), 0, MAX_CHARS)})`
          case 'SUBSTITUE':
            return `replace(${a[0]}, ${a[1]}, ${a[2]})`
          case 'TROUVE':
            return `nullif(strpos(${a[1]}, ${a[0]}), 0)::numeric`
          case 'CHERCHE': {
            // A text written in the formula is lowered here: PostgreSQL cannot apply a collation to
            // a constant inside a generated column.
            const lowered = (i: number) => {
              const n = written(i)
              return n.t === 'text'
                ? `${literal(n.v.toLowerCase())}::text`
                : `lower(${arg(i)} COLLATE "und-x-icu")`
            }
            return `nullif(strpos(${lowered(1)}, ${lowered(0)}), 0)::numeric`
          }
          // These three read as the grid's filters do: case and accents do not count.
          case 'CONTIENT':
            return `(strpos(${fold(0)}, ${fold(1)}) > 0)`
          case 'COMMENCEPAR':
            return `starts_with(${fold(0)}, ${fold(1)})`
          case 'FINITPAR':
            return `starts_with(reverse(${fold(0)}), reverse(${fold(1)}))`
          case 'NOMPROPRE':
            return `initcap(${a[0]} COLLATE "und-x-icu")`
          case 'REPT': {
            // A text that would pass the spreadsheet's 32 767 characters is empty, not an
            // error: `repeat` refuses past 1 GB, and the row would not be written.
            const count = intArg(written(1), arg(1), 0, MAX_REPEATED)
            return `(CASE WHEN length(${a[0]})::bigint * ${count} > ${MAX_REPEATED} THEN NULL ELSE repeat(${a[0]}, ${count}) END)`
          }
          case 'CONCAT':
            return `(${node.args.map((_, i) => `coalesce(${asText(arg(i), t[i] as FormulaType)}, '')`).join(' || ')})`
          case 'JOINDRE_TEXTE': {
            const separator = writtenText(written(0), 0, 'JOINDRE_TEXTE:separateur')
            const flag = written(1)
            const ignore = flag.t === 'boolean' && flag.v
            const parts = node.args
              .slice(2)
              .map((_, i) => asText(arg(i + 2), t[i + 2] as FormulaType))
            const sep = literal(separator)
            if (!ignore) {
              return `(${parts.map((p) => `coalesce(${p}, '')`).join(` || ${sep} || `)})`
            }
            // Each part brings the separator before it when it is not empty, and the first
            // separator is cut. Emptiness is a length, never a comparison with '': PostgreSQL
            // cannot compare two texts when it has no collation for them, as in a constant.
            const all = parts
              .map((p, i) => {
                const part = written(i + 2)
                if (part.t === 'text')
                  return part.v === '' ? "''" : `(${sep} || ${literal(part.v)})`
                return `(CASE WHEN length(${p}) > 0 THEN ${sep} || ${p} ELSE '' END)`
              })
              .join(' || ')
            return `substr(${all}, ${[...separator].length + 1})`
          }
          case 'REGEX_CORRESPOND':
            return `((${a[0]}) COLLATE "und-x-icu" ~ ${regexLiteral(written(1), 'REGEX_CORRESPOND')})`
          case 'REGEX_EXTRAIRE':
            return `substring((${a[0]}) COLLATE "und-x-icu", ${regexLiteral(written(1), 'REGEX_EXTRAIRE')})`
          case 'REGEX_REMPLACER':
            return `regexp_replace((${a[0]}) COLLATE "und-x-icu", ${regexLiteral(written(1), 'REGEX_REMPLACER')}, ${a[2]}, 'g')`
          case 'TEXTE': {
            if (node.args.length === 1) return asText(arg(0), t[0] as FormulaType)
            const format = parseDateFormat(writtenText(written(1), 0, 'TEXTE:format'), 0)
            return t[0] === 'datetime'
              ? dateFormatSql(format, wall(0), 'datetime')
              : dateFormatSql(format, `(${arg(0)})`, 'date')
          }
          case 'NOMBRE':
            return `(CASE WHEN ${a[0]} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${a[0]})::numeric ELSE NULL END)`
          case 'ANNEE':
            return `extract(year from ${day(0)})::numeric`
          case 'MOIS':
            return `extract(month from ${day(0)})::numeric`
          case 'JOUR':
            return `extract(day from ${day(0)})::numeric`
          case 'JOURSEMAINE':
            return `extract(isodow from ${day(0)})::numeric`
          case 'NO_SEMAINE_ISO':
            return `extract(week from ${day(0)})::numeric`
          case 'HEURE':
            return `extract(hour from ${wall(0)})::numeric`
          case 'MINUTE':
            return `extract(minute from ${wall(0)})::numeric`
          case 'SECONDE':
            return `floor(extract(second from ${wall(0)}))::numeric`
          case 'JOURS':
            return `((${day(0)} - ${day(1)})::numeric)`
          case 'AJOUTER_JOURS':
            return `(${day(0)} + ${boundedInt(arg(1), -100000, 100000)})`
          case 'AJOUTER_MOIS':
            return `(${withinYears(day(0))} + make_interval(months => ${months(1)}))::date`
          case 'FIN_MOIS': {
            const shift = node.args.length === 2 ? months(1) : '0'
            return `(date_trunc('month', ${withinYears(day(0))} + make_interval(months => ${shift})) + interval '1 month' - interval '1 day')::date`
          }
          case 'DATEDIF': {
            const unit = dateDifUnit(writtenText(written(2), 0, 'DATEDIF:unite'), 0)
            // `age` of timestamps, not of dates: the date version resolves to a STABLE one.
            const age = `age(${withinYears(day(1))}::timestamp, ${withinYears(day(0))}::timestamp)`
            switch (unit) {
              case 'Y':
                return `extract(year from ${age})::numeric`
              case 'M':
                return `(extract(year from ${age}) * 12 + extract(month from ${age}))::numeric`
              case 'YM':
                return `extract(month from ${age})::numeric`
              default:
                return `((${withinYears(day(1))} - ${withinYears(day(0))})::numeric)`
            }
          }
          case 'DATE':
            return `_basedb_local.safe_date_v1(${a[0]}, ${a[1]}, ${a[2]})`
          case 'AUJOURDHUI':
            return `(pg_catalog.now() AT TIME ZONE ${zone()})::date`
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
 * The text of a stored tree, with today's labels and in the reader's language — what the
 * editor shows. Parentheses are written where precedence needs them, so re-reading the
 * text gives the same tree.
 */
export function renderFormula(
  ast: Node,
  labelOf: (id: string) => string,
  dialect: FormulaDialect = 'fr',
): string {
  const word = (w: string) => spell(w, dialect)
  const separator = dialect === 'en' ? ', ' : '; '
  const render = (node: Node, parent = 0): string => {
    switch (node.t) {
      case 'number':
        return node.v
      case 'text':
        return `"${node.v.replace(/"/g, '""')}"`
      case 'boolean':
        return word(node.v ? 'VRAI' : 'FAUX')
      case 'null':
        return 'NULL'
      case 'field':
        return `[${labelOf(node.id).replace(/]/g, ']]')}]`
      case 'not': {
        const text = `${word('NON')} ${render(node.e, 4)}`
        return parent > 3 ? `(${text})` : text
      }
      case 'negate':
        return `-${render(node.e, 7)}`
      case 'call':
        return `${word(node.fn)}(${node.args.map((a) => render(a)).join(separator)})`
      case 'binary': {
        const p = PRECEDENCE[node.op]
        const text = `${render(node.left, p)} ${word(node.op)} ${render(node.right, p + 1)}`
        return p < parent ? `(${text})` : text
      }
    }
  }
  return render(ast)
}
