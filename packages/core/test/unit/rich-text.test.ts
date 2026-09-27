import { describe, expect, it } from 'vitest'
import {
  RICH_TEXT_FORBIDDEN,
  richTextToPlain,
  sanitizeRichText,
} from '../../src/records/rich-text.js'

/**
 * The `rich` profile of a long text — chapter 04 §2.2. What is kept, what goes, and the
 * two properties the column relies on: the output is canonical (sanitizing it again gives
 * it back unchanged), and it never trips the column's own guard.
 */

const trips = (html: string) =>
  RICH_TEXT_FORBIDDEN.some((pattern) => new RegExp(pattern, 'i').test(html))

describe('sanitizeRichText', () => {
  it('keeps the formatting the profile allows', () => {
    const html =
      '<h2>Titre</h2><p>Du <strong>gras</strong>, de l’<em>italique</em>, du <u>souligné</u> et du <s>barré</s>.</p><ul><li>un</li></ul><ol><li>deux</li></ol><blockquote><p>cité</p></blockquote><pre><code>x = 1</code></pre><hr />'
    const clean = sanitizeRichText(html)
    for (const tag of [
      'h2',
      'strong',
      'em',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
    ]) {
      expect(clean).toContain(`<${tag}>`)
    }
    expect(clean).toContain('<hr />')
  })

  it('drops scripts, events, styles, images and foreign schemes', () => {
    const clean = sanitizeRichText(
      '<p style="color:red" class="x" id="y" onclick="alert(1)">texte</p><script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://x"></iframe><a href="javascript:alert(1)">lien</a><a href="data:text/html,x">data</a>',
    )
    expect(clean).not.toMatch(/style|class=|id=|onclick|<script|<img|<iframe|javascript:|data:/i)
    expect(clean).toContain('<p>texte</p>')
    expect(clean).toContain('lien')
  })

  it('forces the rel of a link, and only a new tab as its target', () => {
    const clean = sanitizeRichText(
      '<a href="https://exemple.fr" target="_top" rel="opener" title="Voir">site</a>',
    )
    expect(clean).toBe(
      '<a href="https://exemple.fr" title="Voir" rel="noopener noreferrer nofollow" target="_blank">site</a>',
    )
    expect(sanitizeRichText('<a href="mailto:a@b.fr">écrire</a>')).toContain('href="mailto:a@b.fr"')
  })

  it('is canonical: sanitizing its output gives it back unchanged', () => {
    const inputs = [
      '<p>Un <b>b</b> non fermé <i>i',
      '<p>javascript: dans une phrase, et online = oui</p>',
      '<a href="https://x.fr/?q=javascript:1" title="a onb=c">l</a>',
      '<ul><li>un<li>deux</ul>',
    ]
    for (const input of inputs) {
      const once = sanitizeRichText(input)
      expect(sanitizeRichText(once)).toBe(once)
    }
  })

  it('never trips the column’s guard, even on harmless words that look like it', () => {
    const inputs = [
      '<p>javascript: est un langage ; JavaScript : aussi</p>',
      '<p>mode online = actif, et onboarding =ok</p>',
      '<a href="https://x.fr/?next=javascript:go" title="on click = rien">l</a>',
      '<p>&lt;script&gt; écrit en toutes lettres</p>',
      '<script>alert(1)</script><svg onload="x"></svg><math></math><form></form>',
    ]
    for (const input of inputs) expect(trips(sanitizeRichText(input))).toBe(false)
    // The words are still there once rendered.
    expect(richTextToPlain(sanitizeRichText('<p>online = oui</p>'))).toBe('online = oui')
  })

  it('reads an empty document as empty', () => {
    expect(sanitizeRichText('<p></p>')).toBe('')
    expect(sanitizeRichText('<p><br></p><p>&nbsp;</p>')).toBe('')
    expect(sanitizeRichText('<hr>')).toBe('<hr />')
  })
})

describe('richTextToPlain', () => {
  it('keeps the words and the paragraphs, not the markup', () => {
    expect(richTextToPlain('<h2>Titre</h2><p>Un <strong>mot</strong> &amp; un autre</p>')).toBe(
      'Titre\nUn mot & un autre',
    )
  })
})
