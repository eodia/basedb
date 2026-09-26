import { describe, expect, it } from 'vitest'
import type { ProjectedField, ProjectedTable } from '../../src/catalog/projection.js'
import { pageSpec, peopleIn, sharedRow, shownFields } from '../../src/forms/shared-view.js'

/**
 * A data view read through its link — chapter 15 §10.
 *
 * What these guard: the page gets the fields the view shows and nothing else, a relation
 * and a person by their name alone, and a spec cut to its presentation — the order by hand
 * only when no sort decides the order.
 */

const field = (name: string, kind: string, extra: Partial<ProjectedField> = {}) =>
  ({ name, label: name, kind, system: false, ...extra }) as unknown as ProjectedField

const table = {
  displayField: 'nom',
  fields: [
    field('nom', 'short_text'),
    field('statut', 'select'),
    field('client', 'link'),
    field('equipe', 'multi_link'),
    field('responsable', 'user'),
    field('secret', 'short_text'),
    field('_created_by', 'user', { system: true }),
  ],
} as unknown as ProjectedTable

describe('the fields a shared view shows', () => {
  it('takes the pivots and the card fields, the display column when no title is chosen', () => {
    const shown = shownFields('kanban', { group_by: 'statut', card_fields: ['responsable'] }, table)
    expect(shown.map((f) => f.name)).toEqual(['nom', 'statut', 'responsable'])
  })

  it('takes a grid’s columns in its order, without the hidden ones or the system ones', () => {
    const shown = shownFields(
      'grid',
      { column_order: ['statut', 'nom'], hidden: ['secret', 'equipe'] },
      table,
    )
    expect(shown.map((f) => f.name)).toEqual(['statut', 'nom', 'client', 'responsable'])
  })
})

describe('a row as the page receives it', () => {
  const fields = table.fields.filter((f) =>
    ['nom', 'client', 'equipe', 'responsable'].includes(f.name),
  )
  const row = {
    _id: 'r1',
    nom: 'Lyon',
    client: { id: 'c1', display: 'ACME' },
    equipe: [
      { id: 'e1', display: 'Alice' },
      { id: 'e2', display: null },
    ],
    responsable: 'u1',
    secret: 'caché',
  }

  it('names the people it holds, once', () => {
    expect(peopleIn([row, { ...row, _id: 'r2' }], fields)).toEqual(['u1'])
  })

  it('gives a relation and a person by their name, never an identifier of theirs', () => {
    const out = sharedRow(row, fields, new Map([['u1', 'Marie']]))
    expect(out).toEqual({
      _id: 'r1',
      nom: 'Lyon',
      client: { display: 'ACME' },
      equipe: [{ display: 'Alice' }, { display: null }],
      responsable: { display: 'Marie' },
    })
    // Someone whose name is not known reads as nobody in particular.
    expect(sharedRow(row, fields).responsable).toEqual({ display: null })
  })
})

describe('the spec as the page reads it', () => {
  const spec = {
    filter: 'secret eq "x"',
    title_field: 'secret',
    card_fields: ['statut', 'secret'],
    card_size: 'large',
    manual_order: ['r2', 'r1'],
  }

  it('keeps the presentation, naming only fields it shows — never the filter', () => {
    const out = pageSpec(spec, new Set(['nom', 'statut']))
    expect(out).toEqual({
      title_field: null,
      card_fields: ['statut'],
      card_size: 'large',
      manual_order: ['r2', 'r1'],
    })
  })

  it('leaves out the order by hand when a sort decides the order', () => {
    expect(pageSpec(spec, new Set(['nom']), true)).not.toHaveProperty('manual_order')
  })
})
