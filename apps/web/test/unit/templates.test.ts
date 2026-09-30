import { describe, expect, it } from 'vitest'
import type { Field } from '../../src/lib/api/client'
import { filterToLabels, templateValue, textToLabels } from '../../src/lib/template-export'

/**
 * A base exported as a template — chapter 20 §6: the way back gives labels again. (Applying
 * a template is the server's, and its tests live with the builder, in the contracts.)
 */

describe('exporting a base', () => {
  const fields = [
    {
      name: 'statut',
      label: 'Statut',
      kind: 'select',
      description: null,
      options: [{ value: 'resolu', label: 'Résolu', color: null, icon: null, image: null }],
    },
    { name: 'titre', label: 'Titre', kind: 'short_text', description: null },
    {
      name: 'produit',
      label: 'Produit',
      kind: 'link',
      description: null,
      link: { target: 'produits', expandable: true, masked: false, on_delete: 'restrict' },
    },
  ] as unknown as Field[]

  it('writes filters and messages by label again', () => {
    expect(filterToLabels('statut eq "resolu" and titre contains "statut"', fields)).toBe(
      '[Statut] eq "Résolu" and [Titre] contains "statut"',
    )
    expect(textToLabels('Vu : {{titre}} ({{_id}})', fields)).toBe('Vu : {{Titre}} ({{_id}})')
  })

  it('writes values by label, relations by row key', () => {
    const key = (table: string, id: string) =>
      table === 'produits' && id === 'r-app' ? 'produits-1' : undefined
    expect(templateValue('resolu', fields[0] as Field, key, null)).toBe('Résolu')
    expect(templateValue({ id: 'r-app', display: 'App' }, fields[2] as Field, key, null)).toBe(
      '@produits-1',
    )
    expect(templateValue({ id: 'r-autre' }, fields[2] as Field, key, null)).toBeUndefined()
  })
})
