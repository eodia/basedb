import { describe, expect, it } from 'vitest'
import {
  htmlToPlain,
  isBlankHtml,
  pillsToVariables,
  variablesToPills,
} from '../../src/lib/rich-text'

/** A rich text as the interface handles it — chapter 04 §2.2. */

describe('the variables of a rich text', () => {
  it('open as pills and are kept as `{{nom}}`', () => {
    const stored = '<p>Bonjour <strong>{{ville}}</strong>, {{ date_livraison }}</p>'
    const editable = variablesToPills(stored)
    expect(editable).toBe(
      '<p>Bonjour <strong><span data-variable="ville"></span></strong>, <span data-variable="date_livraison"></span></p>',
    )
    // The editor writes a pill back with its label inside: the name alone is kept.
    expect(pillsToVariables('<p><span class="x" data-variable="ville">Ville</span></p>')).toBe(
      '<p>{{ville}}</p>',
    )
    expect(pillsToVariables(editable)).toBe(
      '<p>Bonjour <strong>{{ville}}</strong>, {{date_livraison}}</p>',
    )
  })

  it('leave alone what is not a physical name', () => {
    expect(variablesToPills('{{Ville de départ}}')).toBe('{{Ville de départ}}')
  })
})

describe('a rich text', () => {
  it('is blank when nothing readable is left', () => {
    expect(isBlankHtml('<p></p>')).toBe(true)
    expect(isBlankHtml('<p>&nbsp; </p><p><br></p>')).toBe(true)
    expect(isBlankHtml('<hr>')).toBe(false)
    expect(isBlankHtml('<p>a</p>')).toBe(false)
  })

  it('reads as plain words, blocks apart, entities decoded, cut at the bound', () => {
    expect(htmlToPlain('<h2>Titre</h2><p>Un &amp; deux</p><ul><li>a</li><li>b</li></ul>')).toBe(
      'Titre Un & deux a b',
    )
    expect(htmlToPlain('<p>abcdefghij</p>', 5)).toBe('abcd…')
  })
})
