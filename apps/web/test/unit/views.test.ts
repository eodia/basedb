import { describe, expect, it } from 'vitest'
import type { Field, SavedView } from '../../src/lib/api/client'
import {
  andFilter,
  defaultSpec,
  freeLabel,
  gallerySpec,
  isModified,
  kanbanSpec,
  listSpec,
  nextHandOrder,
  orderByHand,
  rangeClause,
  unavailableReason,
  viewStateOf,
} from '../../src/lib/views'

/**
 * Saved views as the screen reads them — chapter 11 §1.6.
 *
 * What these guard: the date clause a calendar joins to the view's filter, the reading of a
 * spec that arrived cut down for the reader, and « Vue modifiée » appearing only when
 * something was really changed.
 */

const field = (name: string, kind: string, extra: Partial<Field> = {}): Field => ({
  name,
  label: name,
  kind,
  description: null,
  ...extra,
})

const TABLE = {
  base: 'b',
  name: 'taches',
  id: 't',
  label: 'Tâches',
  description: null,
  sql: 'b.taches',
  actions: ['read', 'create', 'update'],
  referenced_by: false,
  display_field: null,
  color: null,
  icon: null,
  image: null,
  fields: [
    field('nom', 'short_text', { required: true }),
    field('statut', 'select'),
    field('debut', 'date'),
    field('total', 'formula', { read_only: true }),
  ],
}

const view = (kind: SavedView['kind'], spec: Record<string, unknown>): SavedView => ({
  id: 'v',
  label: 'Vue',
  kind,
  description: null,
  position: 1,
  spec,
  filter_hidden: false,
  created_at: '',
  updated_at: '',
})

describe('rangeClause', () => {
  const from = new Date(2026, 8, 1)
  const to = new Date(2026, 9, 1)

  it('keeps the rows that start in the window, on the start alone', () => {
    expect(rangeClause(field('debut', 'date'), null, from, to)).toBe(
      'debut gte "2026-09-01" and debut lt "2026-10-01"',
    )
  })

  it('with an end, keeps every row that overlaps the window', () => {
    expect(rangeClause(field('debut', 'date'), field('fin', 'date'), from, to)).toBe(
      'debut lt "2026-10-01" and (fin gte "2026-09-01" or (fin is_null and debut gte "2026-09-01"))',
    )
  })
})

describe('andFilter', () => {
  it('joins what is there, each part in parentheses, and drops the empty ones', () => {
    expect(andFilter('', 'statut is_null')).toBe('statut is_null')
    expect(andFilter('a eq 1 or b eq 2', 'statut is_null')).toBe(
      '(a eq 1 or b eq 2) and (statut is_null)',
    )
    expect(andFilter(' ', '')).toBe('')
  })
})

describe('reading a spec', () => {
  it('survives a pivot and lists cut down for the reader', () => {
    const spec = kanbanSpec({ group_by: null, card_fields: ['nom', 3], sorts: [{ field: 1 }] })
    expect(spec).toMatchObject({
      group_by: null,
      card_fields: ['nom'],
      sorts: [],
      hide_empty: false,
    })
  })
})

describe('a new view', () => {
  it('starts on the first field that can hold each pivot', () => {
    expect(defaultSpec('kanban', TABLE, { filter: '', sorts: [] })).toMatchObject({
      group_by: 'statut',
      title_field: 'nom',
    })
    expect(defaultSpec('calendar', TABLE, { filter: '', sorts: [] })).toMatchObject({
      date_field: 'debut',
    })
  })

  it('asks what a person answers — not the status the team sets after —, the required ones required', () => {
    const spec = defaultSpec('form', TABLE, { filter: '', sorts: [] })
    const blank = { label: '', help: '', placeholder: '', show_if: null }
    expect(spec.fields).toEqual([
      { field: 'nom', required: true, ...blank },
      { field: 'debut', required: false, ...blank },
    ])
    // Nothing else to decide: the table's colour, a light theme, confetti at the end.
    expect(spec).toMatchObject({ theme: 'clair', accent: '', auto_advance: true, celebrate: true })
  })

  it('keeps a required status: a form that leaves it out could never be sent', () => {
    const required = {
      ...TABLE,
      fields: TABLE.fields.map((f) => (f.name === 'statut' ? { ...f, required: true } : f)),
    }
    const spec = defaultSpec('survey', required, { filter: '', sorts: [] })
    expect((spec.fields as Array<{ field: string }>).map((q) => q.field)).toContain('statut')
  })

  it('says why a kind cannot be made', () => {
    const plain = { ...TABLE, fields: [field('nom', 'short_text')] }
    expect(unavailableReason('kanban', plain)).toMatch(/Liste de choix/)
    expect(unavailableReason('timeline', plain)).toMatch(/date/)
    expect(unavailableReason('grid', plain)).toBeNull()
  })

  it('takes a label no other view carries', () => {
    const views = [view('kanban', {}), { ...view('kanban', {}), label: 'Kanban' }]
    expect(freeLabel('Kanban', views)).toBe('Kanban 2')
    expect(freeLabel('Calendrier', views)).toBe('Calendrier')
  })
})

describe('Vue modifiée', () => {
  const grid = view('grid', {
    filter: 'statut eq "fait"',
    sorts: [{ field: 'nom', direction: 'asc' }],
    hidden: ['debut'],
    column_widths: { nom: 200 },
    page_size: 100,
  })

  it('is not raised by the view as it opens, nor by a column dragged a few pixels', () => {
    const state = viewStateOf(grid)
    expect(isModified(grid, state)).toBe(false)
    expect(isModified(grid, { ...state, columnWidths: { nom: 204 } })).toBe(false)
  })

  it('is raised by another filter, sort or column set', () => {
    const state = viewStateOf(grid)
    expect(isModified(grid, { ...state, filter: '' })).toBe(true)
    expect(isModified(grid, { ...state, sorts: [] })).toBe(true)
    expect(isModified(grid, { ...state, hidden: [] })).toBe(true)
  })

  it('on a kanban, only looks at the filter and the sort', () => {
    const kanban = view('kanban', { group_by: 'statut', filter: '' })
    const state = viewStateOf(kanban)
    expect(isModified(kanban, { ...state, hidden: ['nom'] })).toBe(false)
    expect(isModified(kanban, { ...state, filter: 'nom eq "a"' })).toBe(true)
  })
})

describe('rows ordered by hand', () => {
  const rows = ['a', 'b', 'c', 'd'].map((_id) => ({ _id }))
  const ids = (list: ReadonlyArray<{ _id: string }>) => list.map((r) => r._id)

  it('draws the rows in the saved order, the rows it does not name after, as they came', () => {
    expect(ids(orderByHand(rows, ['c', 'a']))).toEqual(['c', 'a', 'b', 'd'])
    expect(ids(orderByHand(rows, []))).toEqual(['a', 'b', 'c', 'd'])
    // A row since deleted leaves a hole the order simply skips.
    expect(ids(orderByHand(rows, ['gone', 'd']))).toEqual(['d', 'a', 'b', 'c'])
  })

  it('saves the rows on screen, and keeps the place of those of a page not loaded', () => {
    expect(nextHandOrder(['b', 'a'], ['a', 'x', 'b', 'y'])).toEqual(['b', 'a', 'x', 'y'])
    expect(nextHandOrder(['a', 'b', 'c'], [], 2)).toEqual(['a', 'b'])
  })

  it('reads the order of a gallery and of a list, and what else they keep', () => {
    expect(gallerySpec({ manual_order: ['b', 3, 'a'] })).toMatchObject({
      manual_order: ['b', 'a'],
      card_size: 'medium',
      cover_fit: 'cover',
    })
    expect(listSpec({ group_by: 'statut' })).toMatchObject({ group_by: 'statut', manual_order: [] })
  })
})
