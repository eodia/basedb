import { describe, expect, it } from 'vitest'
import { choicesAsValues } from '../../src/ai/copilot.js'

/**
 * The copilot's filters — chapter 12 §1.6. A model sees a list's labels and writes them;
 * the column stores values. What is compared to a list column is put back into values.
 */

const FIELDS = [
  { name: 'nom', kind: 'short_text', options: [] },
  { name: 'ville', kind: 'short_text', options: [] },
  {
    name: 'statut',
    kind: 'select',
    options: [
      { value: 'actif', label: 'Actif' },
      { value: 'perdu', label: 'Perdu' },
      { value: 'a_relancer', label: 'À relancer' },
    ],
  },
  {
    name: 'tags',
    kind: 'multi_select',
    options: [{ value: 'urgent', label: 'Urgent' }],
  },
]

describe('choices in a proposed filter', () => {
  it('are written as the column stores them', () => {
    expect(choicesAsValues('statut eq "Actif"', FIELDS)).toBe('statut eq "actif"')
    expect(choicesAsValues('ville eq "Lyon" and statut eq "A relancer"', FIELDS)).toBe(
      'ville eq "Lyon" and statut eq "a_relancer"',
    )
    expect(choicesAsValues('statut in ["Actif", "Perdu"]', FIELDS)).toBe(
      'statut in ["actif", "perdu"]',
    )
    expect(choicesAsValues('tags has_any ["Urgent"]', FIELDS)).toBe('tags has_any ["urgent"]')
  })

  it('compare a value with eq, where the model compared a label with eq_ci', () => {
    expect(choicesAsValues('statut eq_ci "actif"', FIELDS)).toBe('statut eq "actif"')
  })

  it('leave everything else alone', () => {
    // A text column that happens to hold a label, a choice that does not exist, a value.
    expect(choicesAsValues('nom eq "Actif"', FIELDS)).toBe('nom eq "Actif"')
    expect(choicesAsValues('statut eq "Inconnu"', FIELDS)).toBe('statut eq "Inconnu"')
    expect(choicesAsValues('statut eq "actif"', FIELDS)).toBe('statut eq "actif"')
    expect(choicesAsValues('statut is_null', FIELDS)).toBe('statut is_null')
  })
})
