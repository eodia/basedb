import { describe, expect, it } from 'vitest'
import type { Field, Table } from '../../src/lib/api/client'
import { describeComputed, effectiveKind, shownField, valueFieldOf } from '../../src/lib/computed'

/**
 * Computed fields on screen — chapter 04 §7 ter, chapter 11 §3: each drawn as the field
 * its value is, with the format and the choices of what it cites.
 */

const montant: Field = {
  name: 'montant',
  label: 'Montant',
  description: null,
  kind: 'number',
  format: { display: 'currency', currency: 'EUR' },
}
const statut: Field = {
  name: 'statut',
  label: 'Statut',
  description: null,
  kind: 'select',
  options: [{ value: 'paye', label: 'Payé', color: '#16a34a', icon: null, image: null }],
}
const factures = {
  name: 'factures',
  label: 'Factures',
  fields: [
    montant,
    statut,
    {
      name: 'clients_id',
      label: 'Client',
      description: null,
      kind: 'link',
      link: { target: 'clients', expandable: true, masked: false, on_delete: 'restrict' },
    },
  ],
} as unknown as Table
const TABLES = [factures]

const total: Field = {
  name: 'total',
  label: 'Total facturé',
  description: null,
  kind: 'rollup',
  computed: {
    result_kind: 'number',
    stored: false,
    multiple: false,
    via: { field: 'clients_id', table: 'factures', direction: 'incoming', reached: 'factures' },
    target: 'montant',
    aggregate: 'sum',
  },
}
const statuts: Field = {
  name: 'statuts',
  label: 'Statuts',
  description: null,
  kind: 'lookup',
  computed: {
    result_kind: 'select',
    stored: false,
    multiple: true,
    via: { field: 'clients_id', table: 'factures', direction: 'incoming', reached: 'factures' },
    target: 'statut',
  },
}

describe('value fields', () => {
  it('reads a sum of amounts as an amount, in its currency', () => {
    const value = valueFieldOf(total, TABLES)
    expect(value).toMatchObject({ kind: 'number', read_only: true })
    expect(value.format).toEqual({ display: 'currency', currency: 'EUR' })
  })

  it('reads a lookup of choices with the choices’ labels and colours', () => {
    expect(valueFieldOf(statuts, TABLES).options?.[0]?.label).toBe('Payé')
  })

  it('draws a computed field read-only, under its own name', () => {
    const shown = shownField({ ...total, valueField: valueFieldOf(total, TABLES) })
    expect(shown).toMatchObject({ name: 'total', kind: 'number', read_only: true })
  })

  it('summarises, groups and filters a list as a list, a value as its kind', () => {
    expect(effectiveKind(statuts)).toBe('lookup')
    expect(effectiveKind(total)).toBe('number')
    expect(effectiveKind(montant)).toBe('number')
  })

  it('says what it reads, in one sentence', () => {
    expect(describeComputed(total, TABLES)).toBe(
      'Somme de « Montant » — lignes de « Factures » liées par « Client »',
    )
  })
})
