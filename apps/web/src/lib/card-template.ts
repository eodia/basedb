import type { Field } from './api/client'

/**
 * A text with variables — « Livraison le {{Date}} pour {{Client}} » — whose variables are
 * the values of a row (chapter 11 §1.6): a kanban card's description.
 *
 * Written with LABELS on screen, kept with PHYSICAL NAMES in the view: a name survives a
 * relabelling, like every field a view names. The screen turns one into the other when
 * it opens the view and when it saves it.
 */

/** A variable: `{{…}}`, spaces allowed inside the braces. */
const VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g

/** The server's bound (`MAX_CARD_TEMPLATE_CHARS`). */
export const CARD_TEMPLATE_MAX = 500

export type TemplatePart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'field'; readonly field: Field }
  /** A variable no readable field answers to — kept as typed, to be corrected. */
  | { readonly kind: 'unknown'; readonly raw: string }

/** A name compared as a person types it: no case, no accents, no extra spaces. */
const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** The field a variable designates: by physical name first, then by label. */
export function fieldOf(raw: string, fields: readonly Field[]): Field | undefined {
  return fields.find((f) => f.name === raw) ?? fields.find((f) => fold(f.label) === fold(raw))
}

/** The template cut into text and variables, each variable with its field. */
export function parseTemplate(template: string, fields: readonly Field[]): TemplatePart[] {
  const parts: TemplatePart[] = []
  let at = 0
  for (const match of template.matchAll(VARIABLE)) {
    const start = match.index ?? 0
    if (start > at) parts.push({ kind: 'text', text: template.slice(at, start) })
    const raw = match[1] ?? ''
    const field = fieldOf(raw, fields)
    parts.push(field === undefined ? { kind: 'unknown', raw } : { kind: 'field', field })
    at = start + match[0].length
  }
  if (at < template.length) parts.push({ kind: 'text', text: template.slice(at) })
  return parts
}

/** As the view keeps it → as a person reads it: `{{debut}}` becomes `{{Début}}`. */
export function templateToLabels(template: string, fields: readonly Field[]): string {
  return template.replace(VARIABLE, (whole, raw: string) => {
    const field = fieldOf(raw, fields)
    return field === undefined ? whole : `{{${field.label}}}`
  })
}

/**
 * As typed → as the view keeps it: `{{Début}}` becomes `{{debut}}`. A variable nothing
 * answers to is left as typed, and the server says which one when it refuses it.
 */
export function templateToNames(template: string, fields: readonly Field[]): string {
  return template.replace(VARIABLE, (whole, raw: string) => {
    const field = fieldOf(raw, fields)
    return field === undefined ? whole : `{{${field.name}}}`
  })
}
