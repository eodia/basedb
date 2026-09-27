/**
 * A rich text — the HTML variant of a long text (chapter 04 §2.2) — as the interface
 * handles it, and the variables a long text may carry (chapter 04 §2.2, « Variables »).
 *
 * The server sanitizes on write and serves the canonical form; nothing here is a security
 * boundary. What the screen adds is the round trip of a variable: stored as `{{nom}}`, a
 * run of text the sanitizer keeps, it is edited as a pill — `<span data-variable>` —
 * which the editor's schema understands and a person cannot type half of.
 */

/** A variable as stored: a physical name between double braces. */
const STORED = /\{\{\s*([a-z0-9_]+)\s*\}\}/g

/** A pill as the editor writes it back. */
const PILL = /<span[^>]*data-variable="([a-z0-9_]+)"[^>]*>[\s\S]*?<\/span>/g

/** Stored → editable: each `{{nom}}` becomes a pill the editor parses as one atom. */
export function variablesToPills(html: string): string {
  return html.replace(STORED, (_whole, name: string) => `<span data-variable="${name}"></span>`)
}

/** Editable → stored: each pill becomes `{{nom}}` again. */
export function pillsToVariables(html: string): string {
  return html.replace(PILL, (_whole, name: string) => `{{${name}}}`)
}

/**
 * What an editor hands back when nothing was written — `<p></p>` — is no text: the cell is
 * emptied, as the server would store it anyway.
 */
export function isBlankHtml(html: string): boolean {
  return html.replace(/<(?!hr\b)[^>]*>/gi, '').replace(/&nbsp;|\s/gi, '') === ''
}

/** A rich text as plain words: for a grid cell, a card, an excerpt. */
export function htmlToPlain(html: string, max = Number.POSITIVE_INFINITY): string {
  const text = html
    .replace(/<\/(p|li|h[1-3]|blockquote|pre)>|<br\s*\/?>/gi, '$& ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#58;/g, ':')
    .replace(/&#61;/g, '=')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
