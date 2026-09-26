import { BasedbError } from '../errors/index.js'

/**
 * The prompt of an AI field, and the columns it cites — chapter 12 §1.5, chapter 04 §7 bis.
 *
 * A column is cited `{{…}}`, by its label as a person types it or by its physical name.
 * The catalog keeps the PHYSICAL name: it survives a rename of the label, which is the
 * frequent edit, and it is what the value is read under. The screen shows it back with the
 * labels.
 */

/** The longest prompt, in characters — what the catalog's `ck_ai_prompt` holds too. */
export const MAX_PROMPT_CHARS = 8000

/** How much of one cited value travels: a long text is cut, not the call refused. */
export const MAX_VALUE_CHARS = 4000

const REFERENCE = /\{\{\s*([^{}]+?)\s*\}\}/g

/** A column a prompt may cite: its physical name, its label, its kind. */
export interface CitableField {
  readonly name: string
  readonly label: string
  readonly kind: string
}

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

function invalid(reason: string, detail?: string): BasedbError {
  return new BasedbError('REQUEST_INVALID', {
    details: { field: 'prompt', reason, ...(detail === undefined ? {} : { variable: detail }) },
  })
}

/**
 * Rewrites every citation under the physical name it designates, and lists them.
 *
 * A citation that designates nothing is refused by name — a prompt that silently read an
 * empty value where a column was meant would fill a thousand cells with nonsense before
 * anyone noticed. So is a field citing itself: its own value is what it computes.
 */
export function canonicalizePrompt(
  prompt: string,
  fields: readonly CitableField[],
  self: string | null,
): { readonly prompt: string; readonly cited: readonly string[] } {
  const text = prompt.trim()
  if (text === '') throw invalid('consigne_vide')
  if ([...text].length > MAX_PROMPT_CHARS) throw invalid('consigne_trop_longue')

  const byName = new Map(fields.map((f) => [f.name, f]))
  const byLabel = new Map(fields.map((f) => [fold(f.label), f]))
  const cited = new Set<string>()

  const rewritten = text.replace(REFERENCE, (_whole, raw: string) => {
    const found = byName.get(raw) ?? byLabel.get(fold(raw))
    if (found === undefined) throw invalid('variable_inconnue', raw)
    if (found.name === self) throw invalid('variable_circulaire', raw)
    cited.add(found.name)
    return `{{${found.name}}}`
  })
  return { prompt: rewritten, cited: [...cited] }
}

/** The physical names a canonical prompt cites. */
export function citedNames(prompt: string): readonly string[] {
  return [...new Set([...prompt.matchAll(REFERENCE)].map((m) => m[1]))]
}

/** How an empty value reads in a prompt — the model is told what it means. */
export const EMPTY_VALUE = '(vide)'

/**
 * The prompt with the row's values in place of the citations. A column no longer there —
 * deleted since — reads as empty rather than leaving its braces for the model to guess at.
 */
export function renderPrompt(prompt: string, values: ReadonlyMap<string, string>): string {
  return prompt.replace(REFERENCE, (_whole, name: string) => values.get(name) ?? EMPTY_VALUE)
}

/** What the reading of a value needs besides the value: its kind, and how to name it. */
export interface ValueContext {
  readonly kind: string
  /** The labels of a list's choices, by stored value. */
  readonly options?: ReadonlyMap<string, string>
  /** The display value of a linked row, by its identifier. */
  readonly displays?: ReadonlyMap<string, string>
}

/**
 * A value as a person would read it — which is how a model reads it best. A choice by its
 * label, a link by what the target displays, a file by its name, a number without the
 * trailing zeros the column stores. Empty is `(vide)`.
 */
export function formatValue(value: unknown, context: ValueContext): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE
  const text = (() => {
    switch (context.kind) {
      case 'number':
        return String(value)
          .replace(/(\.\d*?)0+$/, '$1')
          .replace(/\.$/, '')
      case 'boolean':
        return value === true ? 'oui' : 'non'
      case 'date':
      case 'datetime':
        return value instanceof Date ? value.toISOString() : String(value)
      case 'select':
        return context.options?.get(String(value)) ?? String(value)
      case 'multi_select':
        return (Array.isArray(value) ? value : [value])
          .map((v) => context.options?.get(String(v)) ?? String(v))
          .join(', ')
      case 'link':
        return context.displays?.get(String(value)) ?? String(value)
      case 'file':
      case 'image':
        return (Array.isArray(value) ? value : [])
          .map((f) => (typeof f === 'object' && f !== null ? String(f.name ?? '') : ''))
          .filter((n) => n !== '')
          .join(', ')
      default:
        return typeof value === 'object' ? JSON.stringify(value) : String(value)
    }
  })()
  if (text === '') return EMPTY_VALUE
  return [...text].slice(0, MAX_VALUE_CHARS).join('')
}
