import { describe, expect, it } from 'vitest'
import {
  type OptionDraft,
  draftsOf,
  emptyDraft,
  normalizeHex,
  optionsOf,
  parseOptionsJson,
  serializeOptions,
  slugify,
  valuesOf,
} from '../../src/lib/options'

/**
 * The list of choices as the editor holds it.
 *
 * What matters is the seam with the server: the value a new option is stored under, that an
 * existing one is never renamed, and that the JSON a person copies is the JSON the editor
 * takes back.
 */

const draft = (over: Partial<OptionDraft>): OptionDraft => ({ ...emptyDraft(), ...over })

describe('the stored value of an option', () => {
  it('is the slug of its label: ASCII, lowercase, words joined by _', () => {
    expect(slugify('À contacter !')).toBe('a_contacter')
    expect(slugify('  Été  2026 ')).toBe('ete_2026')
    expect(slugify('***')).toBe('option')
    expect(slugify('x'.repeat(300))).toHaveLength(200)
  })

  it('never renames an existing option, even after its label was edited', () => {
    const [existing] = draftsOf([
      { value: 'actif', label: 'Actif', color: null, icon: null, image: null },
    ])
    expect(valuesOf([{ ...existing, label: 'Totalement différent' }])).toEqual(['actif'])
  })

  it('de-duplicates a new option against the others, existing ones first', () => {
    const values = valuesOf([
      draft({ label: 'Actif' }),
      draft({ label: 'Actif' }),
      draft({ value: 'actif', label: 'Déjà là', locked: true }),
    ])
    expect(values).toEqual(['actif_2', 'actif_3', 'actif'])
  })
})

describe('the list sent to the API', () => {
  it('drops blank rows, keeps the order, and sends a key only when it is set', () => {
    const sent = optionsOf([
      draft({ label: 'Haute', color: '#dc2626', icon: 'flame' }),
      draft({}),
      draft({ label: 'Basse', image: 'https://example.com/a.png' }),
    ])
    expect(sent).toEqual([
      { value: 'haute', label: 'Haute', color: '#dc2626', icon: 'flame' },
      { value: 'basse', label: 'Basse', image: 'https://example.com/a.png' },
    ])
  })

  it('a row with only a value keeps it as its label', () => {
    expect(optionsOf([draft({ value: 'x', locked: true, label: '' })])).toEqual([
      { value: 'x', label: 'x' },
    ])
  })
})

describe('colours', () => {
  it('completes #abc and folds case', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex(' #DC2626 ')).toBe('#dc2626')
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
  })
})

describe('the JSON of a list', () => {
  const known = new Set(['actif'])

  it('what the editor copies is what the editor takes back, values locked or not', () => {
    const original = [
      draft({
        value: 'actif',
        label: 'Actif',
        color: '#16a34a',
        icon: 'circle-check',
        locked: true,
      }),
      draft({ label: 'À contacter', color: '#ea580c' }),
    ]
    const parsed = parseOptionsJson(serializeOptions(original), known)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(optionsOf(parsed.drafts)).toEqual(optionsOf(original))
    // `actif` is in the catalog, so it comes back locked; the new one does not.
    expect(parsed.drafts.map((d) => d.locked)).toEqual([true, false])
  })

  it('takes a plain list of texts, and the { "options": […] } the API answers with', () => {
    const texts = parseOptionsJson('["Actif", "Inactif"]', new Set())
    expect(texts.ok && optionsOf(texts.drafts)).toEqual([
      { value: 'actif', label: 'Actif' },
      { value: 'inactif', label: 'Inactif' },
    ])

    const wrapped = parseOptionsJson('{"options":[{"value":"a","label":"A"}]}', new Set())
    expect(wrapped.ok && wrapped.drafts[0].value).toBe('a')
  })

  it('derives the missing half: a label from a value, a value from a label', () => {
    const parsed = parseOptionsJson('[{"value":"a"},{"label":"Bravo"}]', new Set())
    expect(parsed.ok && parsed.drafts.map((d) => [d.value, d.label])).toEqual([
      ['a', 'a'],
      ['bravo', 'Bravo'],
    ])
  })

  it.each([
    ['not json', 'JSON valide'],
    ['{"a":1}', 'liste'],
    ['[]', 'vide'],
    ['[1]', 'ni un texte ni un objet'],
    ['[{}]', 'ni « value » ni « label »'],
    ['[{"label":"A","color":"rouge"}]', 'couleur invalide'],
    ['[{"label":"A","icon":"Bad Name"}]', 'pictogramme invalide'],
    ['[{"label":"A","image":"http://x/a.png"}]', 'image invalide'],
    ['[{"label":"A","icon":"star","image":"https://x/a.png"}]', 'pas les deux'],
    ['[{"label":"A"},{"label":"a"}]', 'deux fois'],
  ])('refuses %s with its reason', (text, reason) => {
    const parsed = parseOptionsJson(text, new Set())
    expect(parsed.ok).toBe(false)
    expect(!parsed.ok && parsed.error).toContain(reason)
  })
})
