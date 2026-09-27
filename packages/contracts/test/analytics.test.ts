import { describe, expect, it } from 'vitest'
import {
  cardConstraints,
  cardsFromBlocks,
  citedNames,
  flowLayout,
  parameterFits,
  parameterHasValue,
  periodExpression,
  questionCards,
  resolveDateExpression,
  resultNames,
  sqlVariableNames,
  variableCard,
  withoutVariables,
} from '../src/analytics.js'

/**
 * The vocabulary of chapter 18 that both sides compute: what a date expression covers, what
 * a result's columns are called, where the blocks of the first dashboards land.
 */

// Wednesday 16 September 2026.
const TODAY = '2026-09-16'

describe('a date expression', () => {
  it('reads the current period, the past ones, the next ones', () => {
    expect(resolveDateExpression('today', TODAY)).toEqual({ start: TODAY, end: TODAY })
    expect(resolveDateExpression('thismonth', TODAY)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    })
    expect(resolveDateExpression('thisquarter', TODAY)).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    })
    expect(resolveDateExpression('past7days', TODAY)).toEqual({ start: '2026-09-10', end: TODAY })
    expect(resolveDateExpression('past3months', TODAY)).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    })
    expect(resolveDateExpression('lastmonth', TODAY)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    })
    expect(resolveDateExpression('last2years', TODAY)).toEqual({
      start: '2024-01-01',
      end: '2025-12-31',
    })
    expect(resolveDateExpression('next1week', TODAY)).toEqual({
      start: '2026-09-21',
      end: '2026-09-27',
    })
  })

  it('opens the week on the reader’s day', () => {
    expect(resolveDateExpression('thisweek', TODAY, 1)).toEqual({
      start: '2026-09-14',
      end: '2026-09-20',
    })
    expect(resolveDateExpression('thisweek', TODAY, 0)).toEqual({
      start: '2026-09-13',
      end: '2026-09-19',
    })
  })

  it('reads days, months, quarters, years and spans, open or not', () => {
    expect(resolveDateExpression('2026-02', TODAY)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
    expect(resolveDateExpression('2024-Q1', TODAY)).toEqual({
      start: '2024-01-01',
      end: '2024-03-31',
    })
    expect(resolveDateExpression('2025', TODAY)).toEqual({ start: '2025-01-01', end: '2025-12-31' })
    expect(resolveDateExpression('2026-01-05~2026-02', TODAY)).toEqual({
      start: '2026-01-05',
      end: '2026-02-28',
    })
    expect(resolveDateExpression('~2026-03-01', TODAY)).toEqual({ start: null, end: '2026-03-01' })
    expect(resolveDateExpression('2026-03-01~', TODAY)).toEqual({ start: '2026-03-01', end: null })
  })

  it('reads nothing into what it does not know', () => {
    for (const bad of ['', 'demain', 'past0days', '2026-13', '2026-02-30x', '~', 'x~2026-01-01']) {
      expect(resolveDateExpression(bad, TODAY), bad).toBeNull()
    }
  })

  it('names the period a grouped point stands for', () => {
    expect(periodExpression('2026-03-01', 'month')).toBe('2026-03')
    expect(periodExpression('2026-04-01', 'quarter')).toBe('2026-Q2')
    expect(periodExpression('2026-09-14', 'week')).toBe('2026-09-14~2026-09-20')
    expect(periodExpression('2026-09-14', 'day_of_week')).toBeNull()
  })
})

describe('a result', () => {
  it('names its columns from what they group and compute, once each', () => {
    expect(
      resultNames({
        breakouts: [
          { field: 'jour', unit: 'year' },
          { field: 'jour', unit: 'month' },
          { join: 'c', field: 'ville' },
        ],
        aggregations: [
          { fn: 'count' },
          { fn: 'sum', column: { field: 'montant' } },
          { fn: 'count' },
        ],
      }),
    ).toEqual({
      breakouts: ['jour', 'jour#2', 'c.ville'],
      aggregations: ['count', 'sum:montant', 'count#2'],
    })
  })

  it('finds its variables in a SQL text', () => {
    expect(sqlVariableNames('WHERE {{a}} AND x = {{ b }} [[AND {{a}}]]')).toEqual(['a', 'b'])
  })

  it('ties a filter to columns of a kind it can read', () => {
    expect(parameterFits('date', 'datetime')).toBe(true)
    expect(parameterFits('date', 'number')).toBe(false)
    expect(parameterFits('category', 'multi_select')).toBe(true)
  })
})

describe('the blocks of the first dashboards', () => {
  it('flow on the grid as they sat on three columns', () => {
    expect(
      flowLayout([
        { w: 8, h: 4 },
        { w: 16, h: 8 },
        { w: 8, h: 4 },
      ]).map(({ x, y }) => [x, y]),
    ).toEqual([
      [0, 0],
      [8, 0],
      [0, 8],
    ])
  })

  it('become questions read the same way', () => {
    const [number, chart, list, text] = cardsFromBlocks([
      {
        kind: 'number',
        width: 1,
        title: 'Total',
        table: 't',
        aggregate: 'sum',
        field: 'montant',
        filter: 'statut eq "fait"',
      },
      {
        kind: 'chart',
        width: 2,
        title: '',
        table: 't',
        group_by: 'statut',
        filter: '',
        style: 'bar',
      },
      {
        kind: 'list',
        width: 3,
        title: 'Dernières',
        table: 't',
        fields: ['nom'],
        filter: '',
        sort: '-_created_at',
        limit: 10,
      },
      { kind: 'text', width: 1, title: '', body: '# Lire' },
    ])
    expect(number).toMatchObject({
      x: 0,
      w: 8,
      query: {
        filters: [{ expression: 'statut eq "fait"' }],
        aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
      },
      visualization: { type: 'scalar' },
    })
    expect(chart).toMatchObject({
      x: 8,
      w: 16,
      query: {
        breakouts: [{ field: 'statut' }],
        sort: [{ target: { kind: 'aggregation', index: 0 }, desc: true }],
      },
      visualization: { type: 'row' },
    })
    expect(list).toMatchObject({
      x: 0,
      w: 24,
      query: {
        sort: [{ target: { kind: 'column', column: { field: '_created_at' } }, desc: true }],
        limit: 10,
      },
    })
    expect(text).toMatchObject({ kind: 'text', text: '# Lire' })
  })
})

describe('the filters a card applies', () => {
  const parameters = [
    { id: 'p', label: 'Période', type: 'date' as const },
    { id: 'n', label: 'Montant', type: 'number' as const, operator: 'gte' as const },
    { id: 's', label: 'Statut', type: 'category' as const },
  ]
  const mappings = [
    { parameter: 'p', target: { column: { field: 'jour' } } },
    { parameter: 'n', target: { variable: 'seuil' } },
    { parameter: 's', target: { column: { field: 'statut' } } },
    { parameter: 'absent', target: { column: { field: 'x' } } },
  ]

  it('are the tied filters that say something, with their operator', () => {
    expect(cardConstraints(mappings, parameters, { p: 'thisyear', n: [100], s: [] })).toEqual([
      { target: { column: { field: 'jour' } }, type: 'date', value: 'thisyear' },
      { target: { variable: 'seuil' }, type: 'number', operator: 'gte', value: [100] },
    ])
    expect(cardConstraints(undefined, parameters, { p: 'thisyear' })).toEqual([])
  })

  it('leave out an empty text, an empty list, a list of nothing', () => {
    expect(parameterHasValue('  ')).toBe(false)
    expect(parameterHasValue([])).toBe(false)
    expect(parameterHasValue([null, null])).toBe(false)
    expect(parameterHasValue([null, 3])).toBe(true)
    expect(parameterHasValue(['fait'])).toBe(true)
  })
})

describe('a text that cites values', () => {
  it('cites each name once, in order, spaces allowed inside the braces', () => {
    expect(citedNames('<p>{{ total }} sur {{periode}}, {{total}}, {{Pas_un_nom}} {x}</p>')).toEqual(
      ['total', 'periode'],
    )
  })

  it('runs the queries it cites, as cards in its place, and nothing for a filter', () => {
    const cards = questionCards([
      { id: 'q', tab: null, x: 0, y: 0, w: 6, h: 4, kind: 'question', question: 'q1' },
      {
        id: 't',
        tab: 'o1',
        x: 6,
        y: 0,
        w: 12,
        h: 4,
        kind: 'text',
        text: '{{a}} {{b}}',
        variables: [
          { name: 'a', question: 'q2', mappings: [{ parameter: 'p', target: { variable: 'v' } }] },
          { name: 'b', parameter: 'p' },
        ],
      },
      { id: 'h', tab: null, x: 0, y: 4, w: 24, h: 2, kind: 'heading', text: 'Titre' },
    ])
    expect(cards.map((c) => [c.id, c.question])).toEqual([
      ['q', 'q1'],
      ['t', 'q2'],
    ])
    expect(cards[1]).toMatchObject({
      kind: 'question',
      tab: 'o1',
      mappings: [{ parameter: 'p', target: { variable: 'v' } }],
    })
  })
})

describe('a text citing a card, or a query of its own', () => {
  const chart = {
    id: 'c1',
    tab: null,
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    kind: 'question' as const,
    query: { kind: 'builder' as const, source: 't1' },
    mappings: [{ parameter: 'p', target: { column: { field: 'jour' } } }],
  }
  const text = {
    id: 't',
    tab: null,
    x: 6,
    y: 0,
    w: 12,
    h: 4,
    kind: 'text' as const,
    text: '<p>{{carte}} et {{mienne}}, sur {{periode}}</p>',
    variables: [
      { name: 'carte', card: 'c1' },
      { name: 'mienne', query: { kind: 'sql' as const, sql: 'SELECT 1' }, label: 'À moi' },
      { name: 'periode', parameter: 'p' },
    ],
  }

  it('runs the card it cites, under that card’s own filters', () => {
    expect(variableCard(text, { name: 'carte', card: 'c1' }, [chart, text])).toBe(chart)
    expect(variableCard(text, { name: 'carte', card: 'absente' }, [chart, text])).toBeNull()
    expect(variableCard(text, { name: 'mienne', query: chart.query })).toMatchObject({
      id: 't',
      kind: 'question',
      query: chart.query,
    })
    // The card is already among the dashboard's questions: not twice.
    expect(questionCards([chart, text]).map((c) => c.id)).toEqual(['c1', 't'])
  })

  it('loses a value gone, and the words that cited it', () => {
    const left = withoutVariables(text, (v) => 'card' in v && v.card === 'c1')
    expect(left.text).toBe('<p> et {{mienne}}, sur {{periode}}</p>')
    expect(left.variables?.map((v) => v.name)).toEqual(['mienne', 'periode'])
    expect(withoutVariables(text, () => false)).toBe(text)
  })
})
