import type { DashboardCard, QueryResult, ResultColumn } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import { chartModel, escapeHtml } from '../../src/lib/analytics/charts'
import {
  autoMap,
  blocksOf,
  cardsTaking,
  citedVariables,
  constraintsFor,
  mappingCandidates,
  pointConstraints,
  pointFilterOf,
  tiedVariable,
  variableName,
  withConstraints,
  withoutParameter,
} from '../../src/lib/analytics/dashboard'
import { inkOf, periodText, toCsv, valueText } from '../../src/lib/analytics/format'
import {
  autoVisualization,
  columnsOf,
  describeDate,
  describeFilter,
  drillBy,
  drillFiner,
  drillKeep,
  drillRows,
} from '../../src/lib/analytics/model'
import type { DescribedBase, Question } from '../../src/lib/api/client'

/**
 * The dashboards and questions of chapter 18, on screen: the words for a period, where a
 * click on a point leads, the chart a result reads as, the months a line must not skip,
 * which cards a filter drives.
 */

const field = (name: string, label: string, kind: string, extra: object = {}) => ({
  name,
  label,
  kind,
  description: null,
  ...extra,
})

const base = {
  id: 'b1',
  name: 'agence',
  label: 'Agence',
  description: null,
  project: { id: 'p', label: 'P' },
  environment: {},
  actions: ['manage_schema'],
  tables: [
    {
      id: 't-factures',
      base: 'agence',
      name: 'factures',
      label: 'Factures',
      description: null,
      sql: '',
      actions: [],
      referenced_by: false,
      display_field: 'numero',
      fields: [
        field('numero', 'Numéro', 'short_text'),
        field('emise_le', 'Émise le', 'date'),
        field('montant', 'Montant', 'number', { format: { display: 'currency', currency: 'EUR' } }),
        field('statut', 'Statut', 'select', {
          options: [
            { value: 'a_payer', label: 'À payer', color: '#eda100' },
            { value: 'payee', label: 'Payée', color: '#1baf7a' },
          ],
        }),
        field('client', 'Client', 'link', {
          link: { target: 'clients', expandable: true, masked: false, on_delete: 'restrict' },
        }),
        field('_created_at', '_created_at', 'datetime', { system: true }),
      ],
    },
    {
      id: 't-clients',
      base: 'agence',
      name: 'clients',
      label: 'Clients',
      description: null,
      sql: '',
      actions: [],
      referenced_by: true,
      display_field: 'nom',
      fields: [field('nom', 'Nom', 'short_text'), field('ville', 'Ville', 'short_text')],
    },
  ],
} as unknown as DescribedBase

const context = { base, members: [] }

const month: ResultColumn = {
  name: 'emise_le',
  label: 'Émise le : mois',
  role: 'dimension',
  type: 'date',
  unit: 'month',
  source: { table: 't-factures', field: 'emise_le' },
}
const status: ResultColumn = {
  name: 'statut',
  label: 'Statut',
  role: 'dimension',
  type: 'select',
  source: { table: 't-factures', field: 'statut' },
}
const total: ResultColumn = {
  name: 'sum:montant',
  label: 'Somme de Montant',
  role: 'metric',
  type: 'number',
  source: { table: 't-factures', field: 'montant' },
}

describe('a period', () => {
  it('reads as a person says it', () => {
    expect(describeDate('past30days')).toBe('30 derniers jours')
    expect(describeDate('past4weeks')).toBe('4 dernières semaines')
    expect(describeDate('last2quarters')).toBe('Les 2 trimestres précédents')
    expect(describeDate('lastmonth')).toBe('Le mois dernier')
    expect(describeDate('next1week')).toBe('La semaine prochaine')
    expect(describeDate('2026-03')).toBe('mars 2026')
    expect(describeDate('2026-Q2')).toBe('T2 2026')
    expect(describeDate('2026-01-05~')).toBe('Depuis le 5 janv. 2026')
  })

  it('names a grouped value by the period it stands for', () => {
    expect(periodText('2026-04-01', 'quarter')).toBe('T2 2026')
    expect(periodText('2026-09-01', 'month')).toBe('sept. 2026')
    expect(periodText(1, 'day_of_week')).toBe('lundi')
  })
})

describe('a value', () => {
  it('reads in its field’s format and by its label', () => {
    expect(valueText(total, 1234.5, context)).toBe(
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1234.5),
    )
    expect(valueText(status, 'payee', context)).toBe('Payée')
    expect(valueText(status, null, context)).toBe('Sans valeur')
    expect(
      valueText(
        { ...status, type: 'link', labels: { 'c-1': 'Boulangerie Martin' } },
        'c-1',
        context,
      ),
    ).toBe('Boulangerie Martin')
    // A shared dashboard's page has no list of members: the result names its people.
    expect(
      valueText({ ...status, type: 'user', labels: { 'u-1': 'Alice Martin' } }, 'u-1', context),
    ).toBe('Alice Martin')
  })

  it('goes into a spreadsheet as it reads, decimals with a comma', () => {
    const csv = toCsv(
      { columns: [status, total], rows: [['payee', 12.5]], truncated: false, duration_ms: 1 },
      context,
    )
    expect(csv.slice(1).split('\r\n')).toEqual(['Statut;Somme de Montant', 'Payée;12,5'])
  })

  it('never reaches a tooltip as markup', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&#60;img src=x onerror=&#34;alert(1)&#34;&#62;',
    )
  })
})

describe('the chart of a result', () => {
  it('reads best as a number, a line, bars or a table', () => {
    const q = { kind: 'builder' as const, source: 't-factures' }
    expect(autoVisualization(q)).toBe('table')
    expect(autoVisualization({ ...q, aggregations: [{ fn: 'count' }] })).toBe('scalar')
    expect(
      autoVisualization({
        ...q,
        aggregations: [{ fn: 'count' }],
        breakouts: [{ field: 'emise_le', unit: 'month' }],
      }),
    ).toBe('line')
    expect(
      autoVisualization({
        ...q,
        aggregations: [{ fn: 'count' }],
        breakouts: [{ field: 'statut' }],
      }),
    ).toBe('bar')
  })

  it('keeps time’s pace: a month without a row is a month at zero', () => {
    const result: QueryResult = {
      columns: [month, total],
      rows: [
        ['2026-01-01', 100],
        ['2026-03-01', 50],
      ],
      truncated: false,
      duration_ms: 1,
    }
    const model = chartModel(result, { type: 'bar' }, context, inkOf('light'), false)
    expect(model.categories.map((c) => c.label)).toEqual(['janv. 2026', 'févr. 2026', 'mars 2026'])
    expect(model.series[0]?.values).toEqual([100, 0, 50])
  })

  it('splits by a second dimension, each choice in its own colour and order', () => {
    const result: QueryResult = {
      columns: [month, status, total],
      rows: [
        ['2026-01-01', 'payee', 10],
        ['2026-01-01', 'a_payer', 5],
        ['2026-02-01', 'payee', 7],
      ],
      truncated: false,
      duration_ms: 1,
    }
    const model = chartModel(result, { type: 'bar' }, context, inkOf('light'), false)
    expect(model.series.map((s) => [s.label, s.color, s.values])).toEqual([
      ['À payer', '#eda100', [5, null]],
      ['Payée', '#1baf7a', [10, 7]],
    ])
  })
})

describe('a click on a point', () => {
  const query = {
    kind: 'builder' as const,
    source: 't-factures',
    aggregations: [{ fn: 'sum' as const, column: { field: 'montant' } }],
    breakouts: [{ field: 'emise_le', unit: 'month' as const }],
  }
  const point = { values: [{ column: month, value: '2026-03-01' }] }

  it('opens the rows behind it', () => {
    expect(drillRows(query, point)).toEqual({
      kind: 'builder',
      source: 't-factures',
      filters: [{ column: { field: 'emise_le' }, op: 'date', values: ['2026-03'] }],
    })
  })

  it('opens its period on a finer one, or splits it by another column', () => {
    expect(drillFiner(query, point)?.breakouts).toEqual([{ field: 'emise_le', unit: 'week' }])
    expect(drillBy(query, point, { field: 'statut' })).toMatchObject({
      filters: [{ op: 'date', values: ['2026-03'] }],
      breakouts: [{ field: 'statut' }],
    })
  })

  it('keeps a value alone, or leaves it out', () => {
    const byStatus = { ...query, breakouts: [{ field: 'statut' }] }
    expect(drillKeep(byStatus, status, 'payee', false)?.filters).toEqual([
      { column: { field: 'statut' }, op: 'is_not', values: ['payee'] },
    ])
  })
})

describe('a dashboard’s filters', () => {
  const questions = new Map<string, Question>()
  const card = (id: string, source: string, extra: object = {}) => ({
    id,
    tab: null,
    x: 0,
    y: 0,
    w: 12,
    h: 6,
    kind: 'question' as const,
    query: { kind: 'builder' as const, source, aggregations: [{ fn: 'count' as const }] },
    ...extra,
  })

  it('tie to the columns that fit, the base’s own before the system’s', () => {
    const date = { id: 'p1', label: 'Période', type: 'date' as const }
    const cards = autoMap(
      [card('c1', 't-factures'), card('c2', 't-clients')],
      date,
      base,
      questions,
    )
    expect(cards[0]?.mappings).toEqual([
      { parameter: 'p1', target: { column: { field: 'emise_le' } } },
    ])
    // A table without a date of its own is left for its builder to tie.
    expect(cards[1]?.mappings).toBeUndefined()
    expect(
      mappingCandidates(base, 'category', { kind: 'builder', source: 't-factures' }).map(
        (c) => c.label,
      ),
    ).toEqual(['Numéro', 'Montant', 'Statut', 'Client'])
  })

  it('hand a card the values it is tied to, and nothing without one', () => {
    const tied = card('c1', 't-factures', {
      mappings: [{ parameter: 'p1', target: { column: { field: 'statut' } } }],
    })
    const parameters = [{ id: 'p1', label: 'Statut', type: 'category' as const }]
    expect(constraintsFor(tied, parameters, { p1: null })).toEqual([])
    const constraints = constraintsFor(tied, parameters, { p1: ['payee'] })
    expect(constraints).toEqual([
      { target: { column: { field: 'statut' } }, type: 'category', value: ['payee'] },
    ])
    expect(withConstraints(tied.query, constraints).filters).toEqual([
      { column: { field: 'statut' }, op: 'is', values: ['payee'] },
    ])
  })

  it('go into a template as blocks when the cards read as blocks', () => {
    const { blocks, omitted } = blocksOf(
      [
        card('c1', 't-factures', { title: 'Factures' }),
        { id: 'c2', tab: null, x: 0, y: 6, w: 24, h: 2, kind: 'heading' as const, text: 'Détail' },
        {
          id: 'c3',
          tab: null,
          x: 0,
          y: 8,
          w: 12,
          h: 6,
          kind: 'embed' as const,
          url: 'https://exemple.fr',
        },
      ],
      [],
      questions,
    )
    expect(blocks).toEqual([
      {
        kind: 'number',
        width: 2,
        title: 'Factures',
        table: 't-factures',
        aggregate: 'count',
        field: null,
        filter: '',
      },
      { kind: 'text', width: 3, title: '', body: '## Détail' },
    ])
    expect(omitted).toHaveLength(1)
  })
})

describe('the columns of a question', () => {
  it('list the source’s fields, then each join’s, prefixed by its table', () => {
    const columns = columnsOf(base, {
      kind: 'builder',
      source: 't-factures',
      joins: [
        {
          alias: 'clients',
          table: 't-clients',
          kind: 'left',
          left: { field: 'client' },
          right: '_id',
        },
      ],
    })
    expect(columns.map((c) => c.label)).toEqual([
      'Numéro',
      'Émise le',
      'Montant',
      'Statut',
      'Client',
      'Créé le',
      'Clients → Nom',
      'Clients → Ville',
    ])
    expect(
      describeFilter({ column: { field: 'emise_le' }, op: 'date', values: ['thismonth'] }, columns),
    ).toBe('Émise le : Ce mois-ci')
  })
})

describe('a click that filters the whole dashboard', () => {
  const statut: ResultColumn = {
    name: 'statut',
    label: 'Statut',
    role: 'dimension',
    type: 'select',
    source: { table: 't-factures', field: 'statut' },
  }
  const month: ResultColumn = {
    name: 'emise_le:month',
    label: 'Émise le',
    role: 'dimension',
    type: 'date',
    unit: 'month',
    source: { table: 't-factures', field: 'emise_le' },
  }
  const card = (id: string, source: string, extra = {}) => ({
    id,
    tab: null,
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    kind: 'question' as const,
    query: { kind: 'builder' as const, source, aggregations: [{ fn: 'count' as const }], ...extra },
  })
  const questions = new Map<string, Question>()

  it('takes a choice as values, a period as its dates, and nothing from a measure', () => {
    expect(pointFilterOf(statut, 'payee')).toEqual({
      table: 't-factures',
      field: 'statut',
      type: 'category',
      value: ['payee'],
    })
    expect(pointFilterOf(month, '2026-03-01')).toMatchObject({ type: 'date', value: '2026-03' })
    expect(pointFilterOf({ ...statut, role: 'metric' }, 3)).toBeNull()
    expect(pointFilterOf(statut, null)).toBeNull()
    expect(pointFilterOf({ ...statut, source: undefined }, 'payee')).toBeNull()
  })

  it('filters every card that reads the column — by its table, or through a join — and no other', () => {
    const filter = {
      table: 't-factures',
      field: 'statut',
      type: 'category' as const,
      value: ['payee'],
    }
    const cards = [
      card('a', 't-factures'),
      card('b', 'factures'),
      card('c', 't-clients', {
        joins: [
          {
            alias: 'f',
            table: 't-factures',
            kind: 'left',
            left: { field: '_id' },
            right: 'client',
          },
        ],
      }),
      card('d', 't-clients'),
    ]
    expect(cardsTaking(filter, cards, questions, base)).toBe(3)
    const point = { ...filter, label: 'Statut', text: 'Payée' }
    expect(pointConstraints(cards[0] as never, [point], questions, base)).toEqual([
      { target: { column: { field: 'statut' } }, type: 'category', value: ['payee'] },
    ])
    expect(pointConstraints(cards[2] as never, [point], questions, base)).toEqual([
      { target: { column: { join: 'f', field: 'statut' } }, type: 'category', value: ['payee'] },
    ])
    expect(pointConstraints(cards[3] as never, [point], questions, base)).toEqual([])
  })
})

describe('a text that cites values', () => {
  const saved = (id: string, source: string) =>
    ({
      id,
      label: id,
      audience: 'base',
      query: { kind: 'builder', source, aggregations: [{ fn: 'count' }] },
      visualization: { type: 'scalar' },
    }) as unknown as Question
  const questions = new Map([
    ['q-factures', saved('q-factures', 't-factures')],
    ['q-clients', saved('q-clients', 't-clients')],
  ])
  const text: DashboardCard = {
    id: 'x',
    tab: null,
    x: 0,
    y: 0,
    w: 12,
    h: 4,
    kind: 'text',
    rich: true,
    text: '<p>{{factures}} factures, {{clients}} clients, sur {{periode}}</p>',
    variables: [
      { name: 'factures', question: 'q-factures' },
      { name: 'clients', question: 'q-clients' },
      { name: 'periode', parameter: 'p1' },
    ],
  }
  const date = { id: 'p1', label: 'Période', type: 'date' as const }
  const onDate = [{ parameter: 'p1', target: { column: { field: 'emise_le' } } }]

  it('names a value by its label: lower case, no accent, once', () => {
    expect(variableName('Chiffre d’affaires 2026', new Set())).toBe('chiffre_d_affaires_2026')
    expect(variableName('Période', new Set(['periode']))).toBe('periode_2')
    expect(variableName('!!!', new Set())).toBe('valeur')
  })

  it('keeps the values it still cites — those it had rather than those offered', () => {
    const kept = [{ name: 'factures', question: 'q-factures', mappings: onDate }]
    const offered = new Map([
      ['clients', { name: 'clients', question: 'q-clients' }],
      ['factures', { name: 'factures', question: 'autre' }],
    ])
    expect(citedVariables('<p>{{clients}} puis {{ factures }}</p>', kept, offered)).toEqual([
      { name: 'clients', question: 'q-clients' },
      kept[0],
    ])
    expect(citedVariables('<p>plus rien</p>', kept, offered)).toEqual([])
  })

  it('ties the queries it cites to a filter, as cards are', () => {
    const [tied] = autoMap([text], date, base, questions)
    expect(tied?.variables).toEqual([
      { name: 'factures', question: 'q-factures', mappings: onDate },
      // Clients have no date of their own.
      { name: 'clients', question: 'q-clients' },
      { name: 'periode', parameter: 'p1' },
    ])
    expect(
      tiedVariable({ name: 'n', question: 'q-factures' }, [], [date], base, questions),
    ).toEqual({ name: 'n', question: 'q-factures', mappings: onDate })
  })

  it('ties a query it keeps as one it names, and leaves a card cited to its own ties', () => {
    const [tied] = autoMap(
      [
        {
          ...text,
          variables: [
            { name: 'mienne', query: { kind: 'builder', source: 't-factures' } },
            { name: 'carte', card: 'c1' },
          ],
        },
      ],
      date,
      base,
      questions,
    )
    expect(tied?.variables).toEqual([
      { name: 'mienne', query: { kind: 'builder', source: 't-factures' }, mappings: onDate },
      { name: 'carte', card: 'c1' },
    ])
  })

  it('loses a filter taken away: its ties, and its value from the words', () => {
    const [tied] = autoMap([text], date, base, questions)
    const without = withoutParameter(tied as DashboardCard, 'p1')
    expect(without.text).toBe('<p>{{factures}} factures, {{clients}} clients, sur </p>')
    expect(without.variables).toEqual([
      { name: 'factures', question: 'q-factures' },
      { name: 'clients', question: 'q-clients' },
    ])
  })

  it('is one card a click filters, and goes into a template as its words', () => {
    const twice: DashboardCard = {
      ...text,
      id: 'y',
      variables: [
        { name: 'a', question: 'q-factures' },
        { name: 'b', question: 'q-factures' },
      ],
    }
    expect(cardsTaking({ table: 't-factures', field: 'statut' }, [twice], questions, base)).toBe(1)
    expect(
      cardsTaking({ table: 't-factures', field: 'statut' }, [text, twice], questions, base),
    ).toBe(2)
    const { blocks, omitted } = blocksOf([text], [], questions)
    expect(blocks).toEqual([
      {
        kind: 'text',
        width: 2,
        title: '',
        body: '{{factures}} factures, {{clients}} clients, sur {{periode}}',
      },
    ])
    expect(omitted).toHaveLength(1)
  })
})
