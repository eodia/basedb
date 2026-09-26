import { describe, expect, it } from 'vitest'
import type { Aggregates, DashboardBlock, Field } from '../../src/lib/api/client'
import { chartSlices, numberText } from '../../src/lib/dashboards'

/**
 * Dashboards as the screen reads them — chapter 18.
 *
 * What these guard: a number reads as its field does — a currency as a currency; a chart
 * names each slice as a person would and gathers the small ones. That every template cites
 * only what it creates is now the shared validator's, checked on the whole catalog by
 * `packages/templates` (chapter 20).
 */

const aggregates = (values: Aggregates['values'], total = 7): Aggregates => ({
  total,
  values,
  groups: null,
  groups_capped: false,
})

describe('a number block', () => {
  const block = (aggregate: 'count' | 'sum', field: string | null) =>
    ({ kind: 'number', aggregate, field, table: 't', width: 1, title: '', filter: '' }) as Extract<
      DashboardBlock,
      { kind: 'number' }
    >

  it('counts rows, and reads a sum as its field', () => {
    // French figures group by a narrow no-break space: compared as plain spaces.
    const plain = (text: string) => text.replace(/\s/g, ' ')
    expect(plain(numberText(block('count', null), aggregates({}, 1234), undefined))).toBe('1 234')
    const budget = {
      name: 'budget',
      kind: 'number',
      format: { display: 'currency', currency: 'EUR' },
    } as Field
    expect(
      plain(numberText(block('sum', 'budget'), aggregates({ 'budget:sum': '1500.5' }), budget)),
    ).toBe('1 500,50 €')
    expect(numberText(block('sum', 'budget'), aggregates({ 'budget:sum': null }), budget)).toBe('—')
  })
})

describe('a chart', () => {
  const statut = {
    name: 'statut',
    kind: 'select',
    options: [
      { value: 'fait', label: 'Fait', color: '#10b981' },
      { value: 'a_faire', label: 'À faire' },
    ],
  } as unknown as Field

  it('names each slice, the largest first, with the choice’s colour', () => {
    const slices = chartSlices(
      [
        { value: null, count: 1 },
        { value: 'a_faire', count: 2 },
        { value: 'fait', count: 5 },
      ],
      statut,
      (id) => id,
    )
    expect(slices.map((s) => [s.label, s.count])).toEqual([
      ['Fait', 5],
      ['À faire', 2],
      ['Sans valeur', 1],
    ])
    expect(slices[0]?.color).toBe('#10b981')
  })

  it('gathers past eight values as « Autres »', () => {
    const groups = Array.from({ length: 11 }, (_, i) => ({ value: `v${i}`, count: 20 - i }))
    const slices = chartSlices(groups, undefined, (id) => id)
    expect(slices).toHaveLength(9)
    expect(slices.at(-1)).toMatchObject({ label: 'Autres', count: 12 + 11 + 10 })
  })
})
