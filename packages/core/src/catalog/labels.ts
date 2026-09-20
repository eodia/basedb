/**
 * Neutralizing catalog labels — chapter 08 §7.6, decision 4.
 *
 * A label is written by a user and read back inside a document that a viewer renders:
 * OpenAPI `title`/`description` fields go through Swagger UI or Redoc, which interpret
 * Markdown and part of HTML, and the readable documentation is Markdown by definition.
 * Injected as-is, `Client <img src=x onerror=…>` executes its script on whoever reads
 * the documentation — an administrator, most likely.
 *
 * So the escaping happens at GENERATION, not at rendering: there is one generator and
 * an unknown number of viewers.
 */

/**
 * HTML entities, in an order that matters: `&` first, otherwise the ampersands this
 * function introduces would be escaped a second time.
 */
const HTML: ReadonlyArray<readonly [RegExp, string]> = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  // `&apos;` and NOT `&#39;`: the numeric form carries a `#`, which the Markdown pass
  // below would escape into `&\#39;` — an entity no viewer decodes any more. French
  // labels are full of apostrophes, so this would have disfigured almost every one.
  [/'/g, '&apos;'],
]

/**
 * Markdown punctuation that OPENS a construct: emphasis, link, image, heading, quote,
 * table, code.
 *
 * `-` and `.` are left alone deliberately: they only matter at the start of a line, they
 * appear in ordinary labels, and backslash-escaping them would disfigure every legitimate
 * label to neutralize a case the generator avoids by never placing a label first on a
 * line.
 */
const MARKDOWN = /([\\`*_[\]()#!|>~])/g

/**
 * Renders a label inert for a Markdown or HTML viewer.
 *
 * The result is NOT meant to be unescaped: it is what the document carries, and a viewer
 * displaying it literally shows the original label, character for character.
 */
export function escapeLabel(label: string): string {
  let escaped = label
  for (const [pattern, entity] of HTML) escaped = escaped.replace(pattern, entity)
  return escaped.replace(MARKDOWN, '\\$1')
}
