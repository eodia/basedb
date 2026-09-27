import sanitizeHtml from 'sanitize-html'

/**
 * The `rich` profile of a long text — chapter 04 §2.2: HTML, sanitized on WRITE, on every
 * path — the REST API, MCP, the interface, an import.
 *
 * The document is parsed and emitted again rather than edited as a string: what comes out
 * is canonical — tags closed, attributes kept to the allowed ones, entities minimal — and
 * sanitizing it again gives it back unchanged. That canonical form is what is stored.
 */

/** What a rich text may hold, and nothing else. */
const TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'a',
  'hr',
]

/** Forced on every link: no opener handed over, no referrer, no ranking lent. */
const REL = 'noopener noreferrer nofollow'

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: TAGS,
  allowedAttributes: { a: ['href', 'title', 'rel', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  // A forbidden element goes, its text stays — except where the text is code or style,
  // which the library drops whole (`script`, `style`, `textarea`…).
  disallowedTagsMode: 'discard',
  parser: { lowerCaseTags: true, lowerCaseAttributeNames: true },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href === undefined ? {} : { href: attribs.href }),
        ...(attribs.title === undefined ? {} : { title: attribs.title }),
        rel: REL,
        // A new tab or nothing: no other browsing context may be named.
        ...(attribs.target === undefined ? {} : { target: '_blank' }),
      },
    }),
  },
}

/**
 * The guard the column carries against a direct SQL write (`ck__format`) reads the WHOLE
 * text: a sentence that says « javascript: » or « online = oui » would trip it as surely
 * as an attack. The canonical form therefore never contains its patterns — the colon, or
 * the equal sign, becomes an entity, which reads the same once rendered.
 */
function defuse(html: string): string {
  return html
    .replace(/javascript(\s*):/gi, 'javascript$1&#58;')
    .replace(/(\son[a-z]+\s*)=/gi, '$1&#61;')
}

/** Nothing a reader would see: no text, no rule. */
function blank(html: string): boolean {
  return html.replace(/<(?!hr\b)[^>]*>/gi, '').replace(/&nbsp;|\s/gi, '') === ''
}

/**
 * The canonical form of a rich text, or `''` when nothing is left to read — which the
 * write path then stores as NULL, like every empty text (chapter 04 §1.5).
 */
export function sanitizeRichText(html: string): string {
  const clean = defuse(sanitizeHtml(html, OPTIONS).trim())
  return blank(clean) ? '' : clean
}

/**
 * The patterns `ck__format` refuses — the same three, for a test to hold the sanitizer's
 * output against them, and for the DDL to write.
 */
export const RICH_TEXT_FORBIDDEN: readonly string[] = [
  String.raw`<\s*/?\s*(script|iframe|object|embed|style|link|meta|svg|form|img|base|frame|frameset|applet|math)\b`,
  String.raw`\son[a-z]+\s*=`,
  String.raw`javascript\s*:`,
]

/** A rich text as plain words: for an excerpt, a search, a card. */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|li|h[1-3]|blockquote|pre)>|<br\s*\/?>/gi, '$&\n'), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#58;/g, ':')
    .replace(/&#61;/g, '=')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
