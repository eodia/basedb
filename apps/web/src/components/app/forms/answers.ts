import type { Field } from '@/lib/api/client'
import { formatOf } from '@/lib/format'
import { $t } from '@/lib/i18n'

/**
 * What a form decides for its author, so that they decide nothing they do not want to —
 * an example in each empty field, the time a survey takes, the keys that answer — and the
 * checks an answer passes before the next question.
 */

/** How a field is asked on screen — one widget per sort of answer. */
export type AnswerWidget =
  | 'text'
  | 'long_text'
  | 'email'
  | 'url'
  | 'phone'
  | 'number'
  | 'rating'
  | 'boolean'
  | 'choice'
  | 'choices'
  | 'date'
  | 'datetime'
  /** Anything else — a relation, a person, a file: the application's own field. */
  | 'panel'

export function widgetOf(field: Field): AnswerWidget {
  switch (field.kind) {
    case 'short_text':
      return formatOf(field) === 'phone' ? 'phone' : 'text'
    case 'long_text':
      return 'long_text'
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'number':
      return formatOf(field) === 'rating' ? 'rating' : 'number'
    case 'boolean':
      return 'boolean'
    case 'select':
      return field.options === undefined ? 'panel' : 'choice'
    case 'multi_select':
      return field.options === undefined ? 'panel' : 'choices'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    default:
      return 'panel'
  }
}

/** The example in an empty field, when the form does not give one. */
export function placeholderFor(field: Field): string {
  switch (widgetOf(field)) {
    case 'email':
      return $t('nom@exemple.fr')
    case 'url':
      return 'https://'
    case 'phone':
      return $t('+33 6 12 34 56 78')
    case 'number':
      return formatOf(field) === 'currency' ? $t('Un montant') : $t('Un nombre')
    default:
      return $t('Tapez votre réponse ici…')
  }
}

/** Seconds a person takes, by sort of answer — to say how long a survey is before it starts. */
const SECONDS: Readonly<Record<AnswerWidget, number>> = {
  text: 9,
  long_text: 28,
  email: 8,
  url: 9,
  phone: 9,
  number: 6,
  rating: 4,
  boolean: 3,
  choice: 5,
  choices: 7,
  date: 7,
  datetime: 9,
  panel: 10,
}

/** Minutes, rounded up — never less than one. */
export const minutesFor = (fields: readonly Field[]) =>
  Math.max(1, Math.ceil(fields.reduce((sum, f) => sum + SECONDS[widgetOf(f)], 0) / 60))

/** The key that picks the n-th choice: A, B, C… — then none past Z. */
export const choiceKey = (index: number) => (index < 26 ? String.fromCharCode(65 + index) : null)

/**
 * The keys of « Oui » and « Non » in the reader's language: their first letters — O and N,
 * Y and N, J and N, Т and Н. A script typed through an input method — はい, 是, 예 — has no
 * such key: Y and N then, as on the keyboard; and A and B when the two letters are one.
 */
export function yesNoKeys(): { yes: string; no: string; yesLabel: string; noLabel: string } {
  const yesLabel = $t('Oui')
  const noLabel = $t('Non')
  const typed = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]$/u
  const yes = yesLabel.trim().charAt(0).toUpperCase()
  const no = noLabel.trim().charAt(0).toUpperCase()
  if (!typed.test(yes) || !typed.test(no)) return { yes: 'Y', no: 'N', yesLabel, noLabel }
  return yes !== no ? { yes, no, yesLabel, noLabel } : { yes: 'A', no: 'B', yesLabel, noLabel }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * An address typed without its scheme — `exemple.fr` — is the address everyone means:
 * the form adds `https://` rather than refusing it.
 */
export function normalizeUrl(text: string): string {
  const t = text.trim()
  if (t === '' || /^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Why an answer cannot be sent as it is — or `null` when it can. */
export function answerProblem(widget: AnswerWidget, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (widget === 'email' && typeof value === 'string' && !EMAIL.test(value.trim())) {
    return $t('Cette adresse e-mail ne semble pas complète.')
  }
  if (widget === 'number' && typeof value === 'string') {
    return $t('Un nombre est attendu ici.')
  }
  if (widget === 'url' && typeof value === 'string' && !/^https?:\/\/\S+\.\S+/i.test(value)) {
    return $t('Cette adresse web ne semble pas complète.')
  }
  return null
}
