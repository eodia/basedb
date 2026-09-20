import { describe, expect, it } from 'vitest'
import { escapeLabel } from '../../src/catalog/labels.js'

/**
 * Neutralizing catalog labels — chapter 08 §7.6, decision 4.
 *
 * Two properties, and the second is the one that broke: a label must come out INERT for
 * a viewer that interprets Markdown and HTML, and it must come out READABLE once that
 * viewer has rendered it. Escaping that disfigures an ordinary label is not a safe
 * escaping, it is a broken one.
 */

/** What a Markdown/HTML viewer displays, once it has done its job. */
function asRendered(escaped: string): string {
  return escaped
    .replace(/\\([\\`*_[\]()#!|>~])/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

describe('escapeLabel', () => {
  it('neutralizes a tag that would execute on the documentation reader', () => {
    const escaped = escapeLabel('Client <img src=x onerror=alert(1)>')
    expect(escaped).not.toContain('<img')
    expect(escaped).toContain('&lt;img')
  })

  it('neutralizes Markdown emphasis, links and headings', () => {
    expect(escapeLabel('**gras**')).toBe('\\*\\*gras\\*\\*')
    expect(escapeLabel('[texte](http://ailleurs)')).toBe('\\[texte\\]\\(http://ailleurs\\)')
    expect(escapeLabel('# titre')).toBe('\\# titre')
  })

  it('leaves an apostrophe readable once rendered', () => {
    // The bug this test pins: `&#39;` carries a `#`, which the Markdown pass escaped
    // into `&\#39;` — an entity no viewer decodes any more. Every French label with an
    // apostrophe came out as `Date d&#39;émission` on screen.
    const escaped = escapeLabel("Date d'émission")
    expect(escaped).not.toContain('\\#')
    expect(asRendered(escaped)).toBe("Date d'émission")
  })

  it('renders back to the original label, whatever it contains', () => {
    // Escaping is not censorship: what the reader sees is what the user typed.
    for (const label of [
      'Raison sociale',
      "Date d'émission",
      'Client <img src=x onerror=alert(1)> **sociale**',
      'Montant (€) & taxes',
      'Prix « TTC » — remise 50%',
      '`code`',
    ]) {
      expect(asRendered(escapeLabel(label))).toBe(label)
    }
  })

  it('leaves an ordinary label almost untouched', () => {
    // A label with no active character must not collect backslashes: hyphens and full
    // stops only matter at the start of a line, and the generator never puts one there.
    expect(escapeLabel('Raison sociale')).toBe('Raison sociale')
    expect(escapeLabel('Chiffre d’affaires 2026 - N-1')).toBe('Chiffre d’affaires 2026 - N-1')
  })
})
