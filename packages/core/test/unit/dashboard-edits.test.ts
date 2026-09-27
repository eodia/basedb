import type { DashboardCard, QuestionQuery } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import {
  type EditContext,
  type EditTable,
  checkedFilterValue,
  checkedFilterValues,
  defaultVisualization,
  editDashboard,
  queryForModel,
  queryFromModel,
} from '../../src/ai/dashboard-edits.js'

/**
 * The copilot's changes to a dashboard — chapter 18 §2.6. What these guard: each operation
 * stands or falls alone, and says why it fell; cards land after the others, side by side;
 * a filter is tied only where its column is; the filters already there follow a new card
 * by the columns the others use; values are checked against the filters' types.
 */

const tables: EditTable[] = [
  {
    id: 't-fac',
    name: 'factures',
    label: 'Factures',
    fields: [
      { name: 'montant', label: 'Montant', kind: 'number', options: [] },
      { name: 'emise_le', label: 'Émise le', kind: 'date', options: [] },
      {
        name: 'statut',
        label: 'Statut',
        kind: 'select',
        options: [
          { value: 'payee', label: 'Payée' },
          { value: 'en_attente', label: 'En attente' },
        ],
      },
    ],
  },
  {
    id: 't-cli',
    name: 'clients',
    label: 'Clients',
    fields: [{ name: 'ville', label: 'Ville', kind: 'short_text', options: [] }],
  },
]

const sum: QuestionQuery = {
  kind: 'builder',
  source: 't-fac',
  aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
}

const existing: DashboardCard = {
  id: 'total',
  tab: null,
  x: 0,
  y: 0,
  w: 6,
  h: 4,
  kind: 'question',
  title: 'Total',
  query: sum,
  visualization: { type: 'scalar' },
  mappings: [{ parameter: 'periode', target: { column: { field: 'emise_le' } } }],
}

let n = 0
const context = (over: Partial<EditContext> = {}): EditContext => ({
  tables,
  questions: new Map(),
  tab: null,
  newId: (prefix) => `${prefix}${++n}`,
  check: async (raw) => {
    const query = queryFromModel(raw.query, tables) as QuestionQuery
    if (query.kind === 'builder' && !tables.some((t) => t.id === query.source)) {
      throw new Error('question refusée : table inconnue')
    }
    return {
      query,
      visualization:
        raw.visualization === undefined
          ? defaultVisualization(query)
          : (raw.visualization as never),
    }
  },
  ...over,
})

const current = {
  label: 'Ventes',
  description: null,
  content: {
    tabs: [],
    cards: [existing],
    parameters: [{ id: 'periode', label: 'Période', type: 'date' as const }],
  },
}

describe('the queries the model reads and writes', () => {
  it('name their tables, and come back to their keys', () => {
    expect(queryForModel(sum, tables)).toMatchObject({ source: 'factures' })
    expect(queryFromModel({ kind: 'builder', source: 'Factures' }, tables)).toMatchObject({
      source: 't-fac',
    })
    expect(
      queryFromModel({ source: 'factures', joins: [{ alias: 'c', table: 'clients' }] }, tables),
    ).toMatchObject({ kind: 'builder', joins: [{ table: 't-cli' }] })
  })

  it('show as a number, a curve over time, or bars, when the model says nothing', () => {
    expect(defaultVisualization(sum).type).toBe('scalar')
    expect(
      defaultVisualization({ ...sum, breakouts: [{ field: 'emise_le', unit: 'month' }] }).type,
    ).toBe('line')
    expect(defaultVisualization({ ...sum, breakouts: [{ field: 'statut' }] }).type).toBe('bar')
    expect(defaultVisualization({ kind: 'builder', source: 't-fac' }).type).toBe('table')
  })
})

describe('the changes to a dashboard', () => {
  it('add cards after the others, side by side, the filters already there following them', async () => {
    const edited = await editDashboard(
      current,
      [
        {
          op: 'add_card',
          title: 'Nombre',
          query: { source: 'factures', aggregations: [{ fn: 'count' }] },
        },
        {
          op: 'add_card',
          title: 'Moyenne',
          query: {
            source: 'factures',
            aggregations: [{ fn: 'avg', column: { field: 'montant' } }],
          },
        },
        {
          op: 'add_card',
          title: 'Villes',
          query: {
            source: 'clients',
            breakouts: [{ field: 'ville' }],
            aggregations: [{ fn: 'count' }],
          },
        },
      ],
      context(),
    )
    expect(edited.dropped).toEqual([])
    const [, first, second, third] = edited.content.cards
    expect([first?.x, first?.y, second?.x, second?.y]).toEqual([0, 4, 6, 4])
    expect(third).toMatchObject({ x: 12, y: 4, w: 12 })
    // The period follows the invoices by their date; the clients have none.
    expect(first?.mappings).toEqual([
      { parameter: 'periode', target: { column: { field: 'emise_le' } } },
    ])
    expect(third?.mappings).toBeUndefined()
    expect(edited.changes[0]?.text).toBe(
      'Ajouter « Nombre » (chiffre), reliée au filtre « Période »',
    )
  })

  it('ties a new filter to each card that has its column, and refuses one no card has', async () => {
    const edited = await editDashboard(
      current,
      [
        {
          op: 'add_filter',
          label: 'Statut',
          type: 'category',
          field: 'statut',
          default: ['Payée'],
        },
        { op: 'add_filter', label: 'Ville', type: 'category', field: 'ville' },
        { op: 'add_filter', label: 'Montant', type: 'date', field: 'montant' },
      ],
      context(),
    )
    const statut = edited.content.parameters.find((p) => p.label === 'Statut')
    // A choice named by its label, written as the column stores it.
    expect(statut).toMatchObject({ type: 'category', multiple: true, default: ['payee'] })
    expect(edited.content.cards[0]?.mappings).toContainEqual({
      parameter: statut?.id,
      target: { column: { field: 'statut' } },
    })
    expect(edited.dropped).toEqual([
      expect.stringContaining('aucune carte n’a de colonne « ville »'),
      expect.stringContaining('« montant »'),
    ])
  })

  it('changes a card’s look over its settings, removes one, says what it cannot find', async () => {
    const edited = await editDashboard(
      current,
      [
        { op: 'update_card', card: 'Total', visualization: { settings: { suffix: ' €' } } },
        { op: 'update_card', card: 'total', w: 30 },
        { op: 'remove_card', card: 'absente' },
      ],
      context(),
    )
    const card = edited.content.cards[0]
    expect(card?.visualization).toEqual({ type: 'scalar', settings: { suffix: ' €' } })
    // Wider than the grid: as wide as it.
    expect(card).toMatchObject({ w: 24, x: 0 })
    expect(edited.dropped).toEqual([expect.stringContaining('carte inconnue')])
    const removed = await editDashboard(current, [{ op: 'remove_card', card: 'total' }], context())
    expect(removed.content.cards).toEqual([])
  })

  it('a first tab gathers the cards there were, and a card lands in the tab named', async () => {
    const edited = await editDashboard(
      current,
      [
        { op: 'add_tab', label: 'Détail' },
        { op: 'add_text', text: 'Les factures', heading: true, tab: 'Détail' },
      ],
      context(),
    )
    const [overview, detail] = edited.content.tabs
    expect(overview?.label).toBe('Vue d’ensemble')
    expect(edited.content.cards[0]?.tab).toBe(overview?.id)
    expect(edited.content.cards[1]).toMatchObject({ kind: 'heading', tab: detail?.id, y: 0, w: 24 })
  })

  it('keeps what stands when a question is refused, and says why', async () => {
    const edited = await editDashboard(
      current,
      [
        { op: 'add_card', title: 'Ailleurs', query: { source: 'inconnue' } },
        { op: 'rename', label: 'Ventes 2026' },
      ],
      context(),
    )
    expect(edited.label).toBe('Ventes 2026')
    expect(edited.dropped).toEqual(['question refusée : table inconnue'])
    expect(edited.changes.map((c) => c.kind)).toEqual(['rename'])
  })
})

describe('the values of the filters on screen', () => {
  it('fit their filter’s type', () => {
    expect(checkedFilterValue({ type: 'date' }, 'lastmonth')).toBe('lastmonth')
    expect(checkedFilterValue({ type: 'date' }, 3)).toBeUndefined()
    expect(checkedFilterValue({ type: 'number' }, [10, null])).toEqual([10, null])
    expect(checkedFilterValue({ type: 'number' }, ['dix'])).toBeUndefined()
    expect(checkedFilterValue({ type: 'temporal_unit', units: ['month', 'year'] }, 'week')).toBe(
      undefined,
    )
    expect(checkedFilterValue({ type: 'temporal_unit' }, 'week')).toBe('week')
    expect(checkedFilterValue({ type: 'category' }, null)).toBeNull()
  })

  it('name the filters by their identifier or their label, and drop the others', () => {
    const checked = checkedFilterValues(
      { Période: 'thismonth', inconnu: 'x' },
      [{ id: 'periode', label: 'Période', type: 'date' }],
      () => [],
    )
    expect(checked.values).toEqual({ periode: 'thismonth' })
    expect(checked.dropped).toEqual([expect.stringContaining('filtre inconnu')])
  })
})
