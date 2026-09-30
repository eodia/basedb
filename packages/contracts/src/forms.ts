/**
 * Forms and surveys — how they look, and which question is asked (chapter 11 §1.4,
 * chapter 15).
 *
 * The same rules on both sides: the screen shows a question when its condition holds, and
 * the server, receiving the answer to a shared form, neither asks for a question that was
 * not shown nor writes what was typed into it before it was hidden.
 */

/** The looks a form can wear: a background, a type, colours that go together. */
export const FORM_THEMES = [
  'clair',
  'doux',
  'aurore',
  'ocean',
  'foret',
  'nuit',
  'papier',
  'minimal',
] as const
export type FormTheme = (typeof FORM_THEMES)[number]

/** `auto`: the theme's own type. */
export const FORM_FONTS = ['auto', 'sans', 'serif', 'rounded', 'mono'] as const
export type FormFont = (typeof FORM_FONTS)[number]

export const FORM_ALIGNS = ['left', 'center'] as const
export type FormAlign = (typeof FORM_ALIGNS)[number]

/**
 * What a question holds before anyone answers it — `today`: a date question the day it is
 * answered, a date-and-time one the minute. The person changes it or clears it.
 */
export const FORM_PREFILLS = ['today'] as const
export type FormPrefill = (typeof FORM_PREFILLS)[number]

/** The field kinds a question can be prefilled with the day. */
export const FORM_PREFILL_KINDS: readonly string[] = ['date', 'datetime']

/**
 * How a condition reads an earlier answer. `answered` and `empty` need no value; `is` and
 * `is_not` compare one (a choice, a text, a number, yes or no); `includes` and `excludes`
 * look into a multiple choice; `gte` and `lte` compare numbers — a rating, a quantity.
 */
export const FORM_CONDITION_OPS = [
  'answered',
  'empty',
  'is',
  'is_not',
  'includes',
  'excludes',
  'gte',
  'lte',
] as const
export type FormConditionOp = (typeof FORM_CONDITION_OPS)[number]

/** « Show this question only if <field> <op> <value> » — the field an earlier question's. */
export interface FormCondition {
  readonly field: string
  readonly op: FormConditionOp
  readonly value: string | number | boolean | null
}

/** The operators that compare with a value: the others read the answer alone. */
export const conditionNeedsValue = (op: FormConditionOp) => op !== 'answered' && op !== 'empty'

/** Nothing was answered: no value, an empty text, an empty choice. `false` is an answer. */
export function isEmptyAnswer(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    // A link reads `{ id, display }`; files a list — an object with nothing in it is nothing.
    const id = (value as { id?: unknown }).id
    return id === undefined ? Object.keys(value).length === 0 : typeof id !== 'string'
  }
  return false
}

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** One answer against its value, compared the way a person would: « oui » is `true`. */
function same(answer: unknown, value: FormCondition['value']): boolean {
  if (typeof value === 'boolean') return answer === value
  if (typeof value === 'number') {
    const n = asNumber(answer)
    return n !== null && n === value
  }
  if (value === null) return isEmptyAnswer(answer)
  if (typeof answer === 'string') return answer.trim().toLowerCase() === value.trim().toLowerCase()
  if (typeof answer === 'number') return asNumber(value) === answer
  if (typeof answer === 'boolean') return String(answer) === value
  return false
}

/** Whether a condition holds for the answer given to the question it reads. */
export function conditionHolds(condition: FormCondition, answer: unknown): boolean {
  switch (condition.op) {
    case 'answered':
      return !isEmptyAnswer(answer)
    case 'empty':
      return isEmptyAnswer(answer)
    case 'is':
      return Array.isArray(answer)
        ? answer.length === 1 && same(answer[0], condition.value)
        : same(answer, condition.value)
    case 'is_not':
      return !conditionHolds({ ...condition, op: 'is' }, answer)
    case 'includes':
      return Array.isArray(answer)
        ? answer.some((a) => same(a, condition.value))
        : same(answer, condition.value)
    case 'excludes':
      return !conditionHolds({ ...condition, op: 'includes' }, answer)
    case 'gte':
    case 'lte': {
      const n = asNumber(answer)
      const bound = asNumber(condition.value)
      if (n === null || bound === null) return false
      return condition.op === 'gte' ? n >= bound : n <= bound
    }
  }
}

/**
 * The questions shown, in order, for the answers given so far. A question whose condition
 * reads a question that is itself hidden reads it as unanswered: hiding a question hides
 * what depended on it, rather than leaving an answer nobody can see decide.
 */
export function visibleQuestions<
  Q extends { readonly field: string; readonly show_if?: FormCondition | null },
>(questions: readonly Q[], answers: Readonly<Record<string, unknown>>): Q[] {
  const shown = new Set<string>()
  const out: Q[] = []
  for (const q of questions) {
    const condition = q.show_if ?? null
    const visible =
      condition === null ||
      conditionHolds(condition, shown.has(condition.field) ? answers[condition.field] : undefined)
    if (visible) {
      shown.add(q.field)
      out.push(q)
    }
  }
  return out
}
