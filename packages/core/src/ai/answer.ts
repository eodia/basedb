import { shapeUrl } from '../records/values.js'

/**
 * What a field computed by the AI expects from the model, and how an answer becomes its
 * value — chapter 04 §7 bis, chapter 12 §1.5.
 *
 * The AI is an OPTION of a field, not a type: a short text, a long text, an address, a
 * number, a choice, a yes-or-no, a date can each be computed by a model. The model always
 * answers a string; this module says, per type, which string is asked for — told to the
 * model as the expected format — and reads the answer back into the column's type. An
 * answer that holds no value of that type is not forced into one: it is refused, and the
 * cell stays empty.
 */

/** The types a field computed by the AI may have — the CHECK of `field_ai_config.kind`. */
export const AI_KINDS = [
  'short_text',
  'long_text',
  'url',
  'number',
  'select',
  'boolean',
  'date',
] as const

export type AiKind = (typeof AI_KINDS)[number]

export const isAiKind = (kind: string): kind is AiKind =>
  (AI_KINDS as readonly string[]).includes(kind)

/**
 * The text types, whose answer is written as it comes. For them an empty answer is a
 * value, `''` — the cell is settled, and the worker does not ask again at every pass. The
 * other types have no such value: an empty or unreadable answer leaves the cell `NULL`,
 * and the row is tried again later, less and less often.
 */
export const isTextualAi = (kind: string): boolean => kind === 'short_text' || kind === 'long_text'

/** One choice of a `select`, as the field declares it. */
export interface AiOption {
  readonly value: string
  readonly label: string
}

const quote = (text: string) => `« ${text} »`

/** What the model is told the value must look like. `undefined`: free text. */
export function expectedFormat(
  kind: AiKind,
  options: readonly AiOption[] = [],
): string | undefined {
  switch (kind) {
    case 'short_text':
      return 'un texte court, sur une seule ligne'
    case 'long_text':
      return undefined
    case 'url':
      return 'une adresse web complète commençant par https:// (ou mailto: pour une adresse e-mail), et rien d’autre'
    case 'number':
      return 'un nombre seul, en chiffres, avec un point décimal si besoin (ex. 1234.5), sans unité ni texte'
    case 'select':
      return `exactement une de ces valeurs, recopiée telle quelle : ${options.map((o) => quote(o.label)).join(', ')}`
    case 'boolean':
      return '« oui » ou « non », et rien d’autre'
    case 'date':
      return 'une date au format AAAA-MM-JJ, et rien d’autre'
  }
}

/** Case, accents, surrounding quotes and a final full stop do not make a choice. */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/^[\s"'«»“”‘’`]+|[\s"'«»“”‘’`.!]+$/g, '')
    .replace(/\s+/g, ' ')

const THOUSANDS = /[\s\u00a0\u202f]/g
const NUMBER = /-?\d{1,3}(?:[\s\u00a0\u202f]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/

/** A calendar date that exists: `2026-02-30` is not one. */
function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date.toISOString().slice(0, 10)
}

/**
 * Reads an answer into the column's type. `null`: no value of that type is in it — the
 * caller refuses the answer rather than writing something the model did not say.
 */
export function parseAnswer(
  kind: AiKind,
  answer: string,
  options: readonly AiOption[] = [],
): unknown | null {
  const text = answer.trim()
  switch (kind) {
    case 'long_text':
      return text
    case 'short_text':
      // One line: a model that wraps its sentence does not make a short text a paragraph.
      return text.replace(/\s*\n\s*/g, ' ')
    case 'url': {
      if (text === '') return null
      const found = text.match(/(https?:\/\/|mailto:)[^\s<>"'«»)\]]+/i)?.[0] ?? text.split(/\s+/)[0]
      try {
        return shapeUrl('ai', found?.replace(/[.,;:]+$/, '') ?? '')
      } catch {
        return null
      }
    }
    case 'number': {
      const found = text.match(NUMBER)?.[0]
      if (found === undefined) return null
      return found.replace(THOUSANDS, '').replace(',', '.')
    }
    case 'select': {
      const wanted = fold(text)
      if (wanted === '') return null
      const exact = options.find((o) => fold(o.value) === wanted || fold(o.label) === wanted)
      if (exact !== undefined) return exact.value
      // « Catégorie : PME. » — one choice named inside the answer, and only one.
      const named = options.filter(
        (o) => wanted.includes(fold(o.label)) || wanted.includes(fold(o.value)),
      )
      return named.length === 1 ? (named[0]?.value ?? null) : null
    }
    case 'boolean': {
      const word = fold(text).split(/[\s,;:]/)[0] ?? ''
      if (['oui', 'yes', 'true', 'vrai', '1'].includes(word)) return true
      if (['non', 'no', 'false', 'faux', '0'].includes(word)) return false
      return null
    }
    case 'date': {
      const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/)
      if (iso !== null) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
      const fr = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (fr !== null) return isoDate(Number(fr[3]), Number(fr[2]), Number(fr[1]))
      return null
    }
  }
}
