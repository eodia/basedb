/**
 * Quizzes — a survey whose questions may have a right answer, worth points (chapter 11
 * §1.4, chapter 15).
 *
 * The same rules on both sides: the screen grades an answer the way the server scores the
 * row, so the score a person is shown is the score the table keeps.
 */
import { isEmptyAnswer } from './forms.js'

/**
 * When the right answers show: `each`, after every question; `end`, on the last screen;
 * `never`, the score alone — a test given again, whose answers must not travel.
 */
export const QUIZ_REVEALS = ['each', 'end', 'never'] as const
export type QuizReveal = (typeof QUIZ_REVEALS)[number]

/** The field kinds a question can be graded on: those with ONE answer that is right. */
export const QUIZ_KINDS: readonly string[] = [
  'select',
  'multi_select',
  'boolean',
  'number',
  'date',
  'short_text',
  'email',
  'url',
]

/** The kinds whose right answer is a list of texts accepted, any of which is right. */
export const QUIZ_TEXT_KINDS: readonly string[] = ['short_text', 'email', 'url']

/** A question is worth one point unless its author says otherwise — at most this many. */
export const QUIZ_MAX_POINTS = 100
/** Texts accepted for one question, at most. */
export const QUIZ_MAX_ACCEPTED = 20

/**
 * A right answer, as the view keeps it: a choice (its value), several (their values), yes
 * or no, a number, a day (`YYYY-MM-DD`), or the texts accepted for a written answer.
 */
export type QuizAnswer = string | number | boolean | readonly string[]

const isText = (value: unknown, max = 255): value is string =>
  typeof value === 'string' && value.trim() !== '' && [...value].length <= max

/** Whether a right answer has the shape its field's kind expects. */
export function quizAnswerFits(kind: string, correct: unknown): correct is QuizAnswer {
  switch (kind) {
    case 'select':
      return isText(correct)
    case 'multi_select':
      return (
        Array.isArray(correct) &&
        correct.length > 0 &&
        correct.every((v) => isText(v)) &&
        new Set(correct).size === correct.length
      )
    case 'boolean':
      return typeof correct === 'boolean'
    case 'number':
      return typeof correct === 'number' && Number.isFinite(correct)
    case 'date':
      return typeof correct === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(correct)
    default:
      return (
        QUIZ_TEXT_KINDS.includes(kind) &&
        Array.isArray(correct) &&
        correct.length > 0 &&
        correct.length <= QUIZ_MAX_ACCEPTED &&
        correct.every((v) => isText(v))
      )
  }
}

/** A text as a person compares it: without case, without accents, its spaces tidied. */
export function looseText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Whether an answer is the right one. Nothing answered is never right. */
export function isRightAnswer(kind: string, correct: QuizAnswer, answer: unknown): boolean {
  if (isEmptyAnswer(answer)) return false
  switch (kind) {
    case 'select':
      return typeof answer === 'string' && answer === correct
    case 'multi_select': {
      if (!Array.isArray(answer) || !Array.isArray(correct)) return false
      const given = new Set(answer.filter((v): v is string => typeof v === 'string'))
      return given.size === correct.length && correct.every((v) => given.has(v))
    }
    case 'boolean':
      return answer === correct
    case 'number': {
      const n = asNumber(answer)
      return typeof correct === 'number' && n !== null && Math.abs(n - correct) < 1e-9
    }
    case 'date':
      return typeof answer === 'string' && answer.slice(0, 10) === correct
    default:
      return (
        typeof answer === 'string' &&
        Array.isArray(correct) &&
        correct.some((accepted) => looseText(accepted) === looseText(answer))
      )
  }
}

/** A question as a quiz grades it: `correct` null, it asks without grading. */
export interface QuizQuestion {
  readonly field: string
  readonly kind: string
  readonly correct: QuizAnswer | null
  readonly points: number
}

/** One graded question, once answered: right or not, the points won, the points it was worth. */
export interface QuizMark {
  readonly field: string
  readonly right: boolean
  readonly points: number
  readonly of: number
}

export interface QuizScore {
  readonly score: number
  readonly max: number
  readonly marks: readonly QuizMark[]
}

/**
 * The score of the answers given to the questions SHOWN: a question an earlier answer hid
 * counts for nothing — neither against the person nor in the total.
 */
export function scoreQuiz(
  questions: readonly QuizQuestion[],
  answers: Readonly<Record<string, unknown>>,
  shown: ReadonlySet<string>,
): QuizScore {
  const marks: QuizMark[] = []
  for (const q of questions) {
    if (q.correct === null || !shown.has(q.field)) continue
    const right = isRightAnswer(q.kind, q.correct, answers[q.field])
    marks.push({ field: q.field, right, points: right ? q.points : 0, of: q.points })
  }
  return {
    score: marks.reduce((sum, m) => sum + m.points, 0),
    max: marks.reduce((sum, m) => sum + m.of, 0),
    marks,
  }
}

/** The score out of a hundred, rounded; zero for a quiz worth nothing. */
export const quizPercent = (score: number, max: number): number =>
  max <= 0 ? 0 : Math.round((score * 100) / max)

/** Whether the pass mark is reached; `null` when the quiz sets none. */
export const quizPassed = (score: number, max: number, passPercent: number | null) =>
  passPercent === null ? null : max > 0 && (score * 100) / max >= passPercent
