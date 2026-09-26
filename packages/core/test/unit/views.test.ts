import { describe, expect, it } from 'vitest'
import { citedFields, normalizeViewSpec, projectViewSpec } from '../../src/catalog/views.js'
import { BasedbError } from '../../src/errors/index.js'

/**
 * Saved views — the spec a view is stored with (chapter 02, chapter 11 §1.4).
 *
 * Validated at write time, projected for the reader at read time. The rules that matter:
 * a pivot has the type its view needs, a spec names only fields the author sees, and a
 * filter citing a field the reader cannot see hides the view rather than widening it.
 */

const FIELDS = new Map([
  ['nom', 'short_text'],
  ['statut', 'select'],
  ['debut', 'date'],
  ['fin', 'datetime'],
  ['photo', 'image'],
  ['client', 'link'],
  ['total', 'formula'],
  ['notes', 'long_text'],
])

function reason(run: () => unknown): unknown {
  try {
    run()
  } catch (e) {
    expect(e).toBeInstanceOf(BasedbError)
    return (e as BasedbError).details
  }
  throw new Error('expected a refusal')
}

describe('normalizeViewSpec', () => {
  it('fills a grid with its defaults', () => {
    expect(normalizeViewSpec('grid', {}, FIELDS)).toEqual({
      filter: '',
      sorts: [],
      hidden: [],
      pinned: [],
      column_order: [],
      column_widths: {},
      page_size: 100,
    })
  })

  it('clamps column widths rather than refusing a dragged value', () => {
    const spec = normalizeViewSpec('grid', { column_widths: { nom: 9999, notes: 10 } }, FIELDS)
    expect(spec.column_widths).toEqual({ nom: 640, notes: 64 })
  })

  it('requires a kanban to stand on a list of choices', () => {
    expect(reason(() => normalizeViewSpec('kanban', {}, FIELDS))).toMatchObject({
      reason: 'champ_pivot_manquant',
      detail: 'group_by',
    })
    expect(reason(() => normalizeViewSpec('kanban', { group_by: 'debut' }, FIELDS))).toMatchObject({
      reason: 'type_de_champ_incompatible',
      detail: 'debut',
    })
    expect(normalizeViewSpec('kanban', { group_by: 'statut' }, FIELDS)).toMatchObject({
      group_by: 'statut',
      card_fields: [],
      cover_field: null,
      hide_empty: false,
    })
  })

  it('keeps the order of its columns as values, never taken for fields', () => {
    const spec = normalizeViewSpec(
      'kanban',
      { group_by: 'statut', group_order: ['fait', 'a_faire'] },
      FIELDS,
    )
    expect(spec.group_order).toEqual(['fait', 'a_faire'])
    // Not a field list: projected for a reader, the values stay as they are.
    expect(projectViewSpec(spec, new Map([['statut', 'select']])).spec.group_order).toEqual([
      'fait',
      'a_faire',
    ])
    expect(
      reason(() =>
        normalizeViewSpec('kanban', { group_by: 'statut', group_order: ['x', 'x'] }, FIELDS),
      ),
    ).toMatchObject({ reason: 'doublon' })
  })

  it('takes only a picture field for a cover', () => {
    expect(
      reason(() => normalizeViewSpec('kanban', { group_by: 'statut', cover_field: 'nom' }, FIELDS)),
    ).toMatchObject({ reason: 'type_de_champ_incompatible' })
  })

  it('places a calendar on a date, and refuses the same field as its end', () => {
    expect(
      normalizeViewSpec('calendar', { date_field: 'debut', end_field: 'fin' }, FIELDS),
    ).toMatchObject({ date_field: 'debut', end_field: 'fin', mode: 'month' })
    expect(
      reason(() =>
        normalizeViewSpec('calendar', { date_field: 'debut', end_field: 'debut' }, FIELDS),
      ),
    ).toMatchObject({ reason: 'doublon' })
    expect(
      reason(() => normalizeViewSpec('calendar', { date_field: 'nom' }, FIELDS)),
    ).toMatchObject({ reason: 'type_de_champ_incompatible' })
  })

  it('groups a timeline by a list of choices or a link, and nothing else', () => {
    expect(
      normalizeViewSpec('timeline', { start_field: 'debut', group_by: 'client' }, FIELDS),
    ).toMatchObject({ group_by: 'client', scale: 'week' })
    expect(
      reason(() =>
        normalizeViewSpec('timeline', { start_field: 'debut', group_by: 'nom' }, FIELDS),
      ),
    ).toMatchObject({ reason: 'type_de_champ_incompatible' })
  })

  it('asks a form at least one question, never a computed one', () => {
    expect(reason(() => normalizeViewSpec('form', { fields: [] }, FIELDS))).toMatchObject({
      reason: 'formulaire_vide',
    })
    expect(
      reason(() => normalizeViewSpec('survey', { fields: [{ field: 'total' }] }, FIELDS)),
    ).toMatchObject({ reason: 'type_de_champ_incompatible', detail: 'total' })
    expect(
      normalizeViewSpec(
        'form',
        { fields: [{ field: 'nom', required: true, help: ' Qui ? ' }] },
        FIELDS,
      ),
    ).toMatchObject({
      fields: [{ field: 'nom', required: true, label: '', help: 'Qui ?' }],
      allow_another: true,
    })
  })

  it('refuses an unknown key, an unknown field and a repeated one', () => {
    expect(reason(() => normalizeViewSpec('grid', { hiden: [] }, FIELDS))).toMatchObject({
      reason: 'cle_inconnue',
      detail: 'hiden',
    })
    expect(reason(() => normalizeViewSpec('grid', { hidden: ['secret'] }, FIELDS))).toMatchObject({
      reason: 'champ_inconnu',
      detail: 'secret',
    })
    expect(
      reason(() => normalizeViewSpec('grid', { pinned: ['nom', 'nom'] }, FIELDS)),
    ).toMatchObject({ reason: 'doublon' })
    expect(
      reason(() =>
        normalizeViewSpec(
          'form',
          { fields: [{ field: 'nom' }, { field: 'nom', required: true }] },
          FIELDS,
        ),
      ),
    ).toMatchObject({ reason: 'doublon' })
  })

  it('holds a sort to three terms', () => {
    const sorts = ['nom', 'statut', 'debut', 'fin'].map((field) => ({ field, direction: 'asc' }))
    expect(reason(() => normalizeViewSpec('grid', { sorts }, FIELDS))).toMatchObject({
      reason: 'trop_de_tris',
    })
  })
})

describe('citedFields', () => {
  it('reads the field before each operator, not the values', () => {
    expect(
      citedFields('statut eq "nom eq x" and (not debut is_null or client.nom contains a)'),
    ).toEqual(['statut', 'debut', 'client'])
  })
})

describe('projectViewSpec', () => {
  const reader = new Map([
    ['nom', 'short_text'],
    ['debut', 'date'],
  ])

  it('removes what the reader does not see, and nulls a pivot they cannot see', () => {
    const { spec, filterHidden } = projectViewSpec(
      {
        filter: '',
        sorts: [
          { field: 'statut', direction: 'asc' },
          { field: 'nom', direction: 'desc' },
        ],
        group_by: 'statut',
        card_fields: ['nom', 'notes'],
      },
      reader,
    )
    expect(filterHidden).toBe(false)
    expect(spec).toMatchObject({
      sorts: [{ field: 'nom', direction: 'desc' }],
      group_by: null,
      card_fields: ['nom'],
    })
  })

  it('hides a view whose filter cites a field the reader cannot see', () => {
    const { spec, filterHidden } = projectViewSpec({ filter: 'statut eq "fait"' }, reader)
    expect(filterHidden).toBe(true)
    expect(spec.filter).toBe('')
  })

  it('drops the questions a reader cannot answer', () => {
    const { spec } = projectViewSpec(
      { fields: [{ field: 'nom' }, { field: 'statut' }], title: 'Inscription' },
      reader,
    )
    expect(spec.fields).toEqual([{ field: 'nom' }])
  })
})
