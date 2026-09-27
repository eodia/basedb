import type { QueryResult } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import {
  type SavedQuestion,
  choicesOf,
  forVisitor,
  sharedCards,
  sharedRun,
  sharedTables,
  valuesQuery,
  visitorValues,
} from '../../src/analytics/shared-dashboard.js'
import type { Dashboard } from '../../src/catalog/dashboards.js'
import type { ProjectedBase } from '../../src/catalog/projection.js'

/**
 * A shared dashboard's page — chapter 18 §2.5. What these guard: the page learns where the
 * cards sit and how they show, never what they run; of the base, the fields they cite and
 * no other; a visitor gives values to the dashboard's filters and nothing else, and the
 * kernel ties them to each card as the dashboard was built.
 */

const questions = new Map<string, SavedQuestion>([
  [
    'q1',
    {
      label: 'Montant par statut',
      query: {
        kind: 'builder',
        source: 't1',
        aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
        breakouts: [{ field: 'statut' }],
        sort: [{ target: { kind: 'aggregation', index: 0 }, desc: true }],
      },
      visualization: { type: 'pie' },
    },
  ],
])

const dashboard: Dashboard = {
  id: 'd1',
  label: 'Pilotage',
  description: null,
  position: 1,
  updatedAt: '2026-09-27',
  tabs: [],
  parameters: [
    { id: 'statut', label: 'Statut', type: 'category', default: ['fait'] },
    { id: 'periode', label: 'Période', type: 'date' },
  ],
  cards: [
    {
      id: 'c1',
      tab: null,
      x: 0,
      y: 0,
      w: 12,
      h: 6,
      kind: 'question',
      question: 'q1',
      mappings: [
        { parameter: 'statut', target: { column: { field: 'statut' } } },
        { parameter: 'periode', target: { column: { field: 'jour' } } },
      ],
    },
    {
      id: 'c2',
      tab: null,
      x: 12,
      y: 0,
      w: 12,
      h: 6,
      kind: 'question',
      title: 'Lignes',
      query: { kind: 'builder', source: 'visites', fields: [{ field: 'nom' }] },
    },
    { id: 'c3', tab: null, x: 0, y: 6, w: 24, h: 2, kind: 'text', text: 'Bonjour' },
    { id: 'c4', tab: null, x: 0, y: 8, w: 8, h: 4, kind: 'question', question: 'disparue' },
  ],
}

const field = (name: string, system = false) => ({
  name,
  label: name,
  description: null,
  kind: name === 'statut' ? 'select' : 'short_text',
  required: false,
  readOnly: system,
  system,
  unsafeHtml: false,
  ...(name === 'statut' ? { options: [{ value: 'fait', label: 'Fait', color: 'green' }] } : {}),
})

const base = {
  id: 'b1',
  name: 'chantiers',
  label: 'Chantiers',
  tables: [
    {
      id: 't1',
      name: 'visites',
      label: 'Visites',
      fields: [field('nom'), field('note'), field('statut'), field('montant'), field('_id', true)],
    },
    { id: 't2', name: 'sites', label: 'Sites', fields: [field('ville')] },
  ],
} as unknown as ProjectedBase

describe('the cards of a shared dashboard', () => {
  it('say where they sit and how they show, never what they run', () => {
    const cards = sharedCards(dashboard, questions)
    expect(cards[0]).toEqual({
      id: 'c1',
      tab: null,
      x: 0,
      y: 0,
      w: 12,
      h: 6,
      kind: 'question',
      title: 'Montant par statut',
      visualization: { type: 'pie' },
      sorted: true,
      filters: ['statut', 'periode'],
    })
    expect(cards[1]).toMatchObject({ title: 'Lignes', visualization: { type: 'table' } })
    expect(cards[2]).toMatchObject({ kind: 'text', text: 'Bonjour', filters: [] })
    // A card whose question is gone keeps its place, and shows nothing.
    expect(cards[3]).not.toHaveProperty('visualization')
    expect(JSON.stringify(cards)).not.toMatch(/aggregations|source|mappings/)
  })

  it('bring the fields they cite, by the table’s key or its name, and no other', () => {
    const tables = sharedTables(
      base,
      [...questions.values()].map((q) => q.query),
    )
    expect(tables.map((t) => t.fields.map((f) => f.name))).toEqual([['statut', 'montant']])
    // Rows shown without chosen columns: every business field of the table.
    const all = sharedTables(base, [{ kind: 'builder', source: 'visites' }])
    expect(all[0]?.fields.map((f) => f.name)).toEqual(['nom', 'note', 'statut', 'montant'])
    expect(sharedTables(base, [{ kind: 'sql', sql: 'SELECT 1' }])).toEqual([])
  })
})

describe('the values a visitor gives', () => {
  it('fill the dashboard’s filters, a left-out one keeping its default', () => {
    expect(visitorValues(dashboard.parameters, undefined)).toEqual({
      statut: ['fait'],
      periode: null,
    })
    expect(visitorValues(dashboard.parameters, { statut: null, periode: 'thismonth' })).toEqual({
      statut: null,
      periode: 'thismonth',
    })
  })

  it('refuse a filter the dashboard does not have, or a value of no known shape', () => {
    expect(() => visitorValues(dashboard.parameters, { note: 'x' })).toThrow()
    expect(() => visitorValues(dashboard.parameters, { statut: [{ sql: 1 }] })).toThrow()
    expect(() => visitorValues(dashboard.parameters, ['fait'])).toThrow()
    expect(() => visitorValues(dashboard.parameters, { toString: 'x' })).toThrow()
  })

  it('are tied to a card as the dashboard ties them', () => {
    const run = sharedRun(dashboard, 'c1', questions, { periode: '2026-01' })
    expect(run.query).toBe(questions.get('q1')?.query)
    expect(run.constraints).toEqual([
      { target: { column: { field: 'statut' } }, type: 'category', value: ['fait'] },
      { target: { column: { field: 'jour' } }, type: 'date', value: '2026-01' },
    ])
    // A card with no filter tied takes none, whatever is given.
    expect(sharedRun(dashboard, 'c2', questions, { statut: ['x'] }).constraints).toEqual([])
    expect(() => sharedRun(dashboard, 'c3', questions, {})).toThrow()
    expect(() => sharedRun(dashboard, 'c4', questions, {})).toThrow()
  })
})

describe('the list of a category filter', () => {
  it('reads the values of the first column it is tied to, the most frequent first', () => {
    expect(valuesQuery(dashboard, 'statut', questions)).toEqual({
      kind: 'builder',
      source: 't1',
      breakouts: [{ field: 'statut' }],
      aggregations: [{ fn: 'count' }],
      sort: [{ target: { kind: 'aggregation', index: 0 }, desc: true }],
      limit: 300,
    })
    expect(valuesQuery(dashboard, 'periode', questions)).toBeNull()
    expect(() => valuesQuery(dashboard, 'absent', questions)).toThrow()
  })

  it('labels them by the choice, the link or the person they are', () => {
    const result: QueryResult = {
      columns: [
        {
          name: 'statut',
          label: 'Statut',
          role: 'dimension',
          type: 'select',
          source: { table: 't1', field: 'statut' },
        },
        { name: 'count', label: 'Nombre', role: 'metric', type: 'number' },
      ],
      rows: [
        ['fait', 3],
        ['autre', 1],
        [null, 2],
      ],
      truncated: false,
      duration_ms: 1,
    }
    expect(choicesOf(result, base)).toEqual([
      { value: 'fait', label: 'Fait', color: 'green' },
      { value: 'autre', label: 'autre', color: null },
    ])
  })
})

describe('a result, as a visitor receives it', () => {
  it('keeps no way to open a row', () => {
    const result: QueryResult = {
      columns: [
        { name: '_row', label: '', role: 'dimension', type: 'id', hidden: true },
        { name: 'nom', label: 'Nom', role: 'dimension', type: 'short_text' },
      ],
      rows: [['0190-a', 'A']],
      truncated: false,
      duration_ms: 1,
      record: { table: 't1', column: 0 },
    }
    expect(forVisitor(result)).toEqual({
      columns: [{ name: 'nom', label: 'Nom', role: 'dimension', type: 'short_text' }],
      rows: [['A']],
      truncated: false,
      duration_ms: 1,
    })
  })
})

describe('a text that cites values', () => {
  const texts: Dashboard = {
    ...dashboard,
    cards: [
      {
        id: 't1',
        tab: null,
        x: 0,
        y: 0,
        w: 12,
        h: 4,
        kind: 'text',
        rich: true,
        text: '<p>Montant : <strong>{{montant}}</strong> sur {{periode}}</p>',
        variables: [
          {
            name: 'montant',
            question: 'q1',
            mappings: [{ parameter: 'statut', target: { column: { field: 'statut' } } }],
          },
          { name: 'periode', parameter: 'periode' },
        ],
      },
    ],
  }

  it('tells the page what it cites and the filters it follows, never what it runs', () => {
    const [card] = sharedCards(texts, questions)
    expect(card).toMatchObject({ kind: 'text', rich: true, filters: ['statut', 'periode'] })
    expect(card?.variables).toEqual([
      { name: 'montant', kind: 'question', visualization: { type: 'pie' }, filters: ['statut'] },
      { name: 'periode', kind: 'parameter', parameter: 'periode' },
    ])
    expect(JSON.stringify(card)).not.toContain('q1')
    expect(JSON.stringify(card)).not.toContain('aggregations')
  })

  it('runs a query it cites by its name, its filters tied as the text ties them', () => {
    const run = sharedRun(texts, 't1', questions, { periode: '2026-01' }, 'montant')
    expect(run.query).toBe(questions.get('q1')?.query)
    expect(run.constraints).toEqual([
      { target: { column: { field: 'statut' } }, type: 'category', value: ['fait'] },
    ])
    // A filter's value runs nothing; nor does a name it does not cite, or the text itself.
    expect(() => sharedRun(texts, 't1', questions, {}, 'periode')).toThrow()
    expect(() => sharedRun(texts, 't1', questions, {}, 'absente')).toThrow()
    expect(() => sharedRun(texts, 't1', questions, {})).toThrow()
    expect(() => sharedRun(dashboard, 'c1', questions, {}, 'montant')).toThrow()
  })

  it('lends a category filter the values of a query it cites', () => {
    expect(valuesQuery(texts, 'statut', questions)).toMatchObject({
      source: 't1',
      breakouts: [{ field: 'statut' }],
    })
  })
})

describe('a text that cites a card, or a query of its own', () => {
  const texts: Dashboard = {
    ...dashboard,
    cards: [
      ...dashboard.cards,
      {
        id: 't2',
        tab: null,
        x: 0,
        y: 12,
        w: 12,
        h: 4,
        kind: 'text',
        rich: true,
        text: '<p>{{carte}} — {{mienne}}</p>',
        variables: [
          { name: 'carte', card: 'c1' },
          {
            name: 'mienne',
            query: { kind: 'builder', source: 't2', aggregations: [{ fn: 'count' }] },
            label: 'Sites',
          },
        ],
      },
    ],
  }

  it('reads a card cited under that card’s filters, and shows it as that card does', () => {
    const card = sharedCards(texts, questions).find((c) => c.id === 't2')
    expect(card?.variables).toEqual([
      {
        name: 'carte',
        kind: 'question',
        visualization: { type: 'pie' },
        filters: ['statut', 'periode'],
      },
      { name: 'mienne', kind: 'question', visualization: { type: 'table' }, filters: [] },
    ])
    const run = sharedRun(texts, 't2', questions, { periode: '2026-01' }, 'carte')
    expect(run.query).toBe(questions.get('q1')?.query)
    expect(run.constraints).toHaveLength(2)
  })

  it('runs a query it keeps, under the filters it ties to it — none here', () => {
    const run = sharedRun(texts, 't2', questions, {}, 'mienne')
    expect(run.query).toEqual({ kind: 'builder', source: 't2', aggregations: [{ fn: 'count' }] })
    expect(run.constraints).toEqual([])
  })
})
