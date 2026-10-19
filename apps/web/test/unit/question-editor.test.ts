import type { BuilderQuery, ResultColumn } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import {
  chosenFields,
  columnsOf,
  compactQuery,
  defaultFields,
  drillRows,
  joinAlias,
  joinSentence,
  joinSuggestions,
  joinable,
  pruneJoins,
  reachableColumns,
  settleQuery,
  suggestedCondition,
  withJoinFor,
  withoutJoin,
} from '../../src/lib/analytics/model'
import type { DescribedBase } from '../../src/lib/api/client'

/**
 * The editor of questions — chapter 18 §3, on screen: the columns of the tables a link leads to
 * offered at every step, the join a choice adds and the last step citing it takes away, the
 * condition a relation suggests for a join written by hand.
 */

const field = (name: string, label: string, kind: string, extra: object = {}) => ({
  name,
  label,
  kind,
  description: null,
  ...extra,
})
const link = (target: string) => ({
  link: { target, expandable: true, masked: false, on_delete: 'restrict' },
})
const system = [
  field('_id', '_id', 'short_text', { system: true }),
  field('_created_at', '_created_at', 'datetime', { system: true }),
]
const table = (name: string, label: string, fields: object[]) => ({
  id: `t-${name}`,
  base: 'agence',
  name,
  label,
  description: null,
  sql: '',
  actions: [],
  referenced_by: false,
  display_field: 'nom',
  fields: [...fields, ...system],
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
    table('projets', 'Projets', [
      field('nom', 'Nom', 'short_text'),
      field('budget', 'Budget', 'number'),
      field('client', 'Client', 'link', link('clients')),
      field('equipe', 'Équipe', 'multi_link', link('membres')),
    ]),
    table('clients', 'Clients', [
      field('nom', 'Nom', 'short_text'),
      field('ville', 'Ville', 'short_text'),
      field('pays', 'Pays', 'link', link('pays')),
    ]),
    table('membres', 'Membres', [field('nom', 'Nom', 'short_text')]),
    table('pays', 'Pays', [field('nom', 'Nom', 'short_text')]),
    table('taches', 'Tâches', [
      field('titre', 'Titre', 'short_text'),
      field('projet', 'Projet', 'link', link('projets')),
    ]),
  ],
} as unknown as DescribedBase

const projets: BuilderQuery = { kind: 'builder', source: 't-projets' }
const byClient = {
  alias: 'client',
  table: 't-clients',
  kind: 'left' as const,
  left: { field: 'client' },
  right: '_id',
  implicit: true as const,
}
const labels = (query: BuilderQuery, filter: (c: { reached?: boolean }) => boolean = () => true) =>
  reachableColumns(base, query)
    .filter(filter)
    .map((c) => c.label)

describe('the columns a question can cite', () => {
  it('are the source’s, then those of the tables its links lead to', () => {
    const columns = reachableColumns(base, projets)
    expect(columns.filter((c) => c.join === undefined).map((c) => c.label)).toEqual([
      'Nom',
      'Budget',
      'Client',
      'Équipe',
      'Identifiant',
      'Créé le',
    ])
    expect(columns.filter((c) => c.join?.alias === 'client').map((c) => c.label)).toEqual([
      'Client → Nom',
      'Client → Ville',
      'Client → Pays',
      'Client → Identifiant',
      'Client → Créé le',
    ])
    // A list of links is a relation too: the kernel joins it element by element.
    expect(columns.filter((c) => c.join?.alias === 'equipe').map((c) => c.label)).toEqual([
      'Équipe → Nom',
      'Équipe → Identifiant',
      'Équipe → Créé le',
    ])
  })

  it('wear the join choosing them adds, marked as the editor’s own', () => {
    const [nom] = reachableColumns(base, projets).filter((c) => c.ref.join === 'client')
    expect(nom).toMatchObject({
      ref: { join: 'client', field: 'nom' },
      reached: true,
      group: 'Clients (par Client)',
      join: byClient,
    })
    expect(withJoinFor(projets, nom).joins).toEqual([byClient])
    // Once joined, the join is not added a second time, and its columns are no longer « reached ».
    const joined = withJoinFor(projets, nom)
    expect(withJoinFor(joined, nom)).toBe(joined)
    expect(reachableColumns(base, joined).filter((c) => c.join?.alias === 'client')).toSatisfy(
      (list: Array<{ reached?: boolean }>) =>
        list.length > 0 && list.every((c) => c.reached !== true),
    )
  })

  it('go one link deep: the links of a related table are not offered', () => {
    expect(labels(projets)).not.toContain('Pays → Nom')
    expect(labels(projets).some((l) => l.startsWith('Client → Pays'))).toBe(true)
  })

  it('are not offered twice when a join written by hand already makes the relation', () => {
    const written = {
      alias: 'societes',
      table: 't-clients',
      kind: 'inner' as const,
      left: { field: 'client' },
      right: '_id',
    }
    const query: BuilderQuery = { ...projets, joins: [written] }
    const columns = reachableColumns(base, query)
    expect(columns.filter((c) => c.join?.alias === 'societes')).toHaveLength(5)
    expect(columns.some((c) => c.reached === true && c.table.id === 't-clients')).toBe(false)
    // The join the person wrote keeps the name of its table, not of the link.
    expect(columns.find((c) => c.ref.join === 'societes')?.label).toBe('Clients → Nom')
  })

  it('take a free alias, numbered past the first, when a join written by hand has theirs', () => {
    const written = {
      alias: 'client',
      table: 't-taches',
      kind: 'left' as const,
      left: { field: '_id' },
      right: 'projet',
    }
    const query: BuilderQuery = { ...projets, joins: [written] }
    const reached = reachableColumns(base, query).find(
      (c) => c.reached === true && c.table.id === 't-clients',
    )
    expect(reached?.join?.alias).toBe('client2')
  })

  it('stop at the bound of joins', () => {
    const joins = ['a', 'b', 'c', 'd'].map((alias) => ({
      alias,
      table: 't-membres',
      kind: 'left' as const,
      left: { field: 'equipe' },
      right: '_id',
    }))
    expect(reachableColumns(base, { ...projets, joins }).some((c) => c.reached === true)).toBe(
      false,
    )
  })

  it('stay those of the joins already in the query for what a dashboard maps its filters to', () => {
    expect(columnsOf(base, projets).every((c) => c.join === undefined)).toBe(true)
  })
})

describe('the joins a question adds on its own', () => {
  const grouped: BuilderQuery = {
    ...projets,
    joins: [byClient],
    aggregations: [{ fn: 'sum', column: { field: 'budget' } }],
    breakouts: [{ join: 'client', field: 'ville' }],
  }

  it('stay while a step cites a column of theirs', () => {
    expect(pruneJoins(grouped)).toBe(grouped)
    const cited: BuilderQuery[] = [
      {
        ...projets,
        joins: [byClient],
        filters: [{ column: { join: 'client', field: 'ville' }, op: 'is', values: ['Rennes'] }],
      },
      {
        ...projets,
        joins: [byClient],
        filters: [{ expression: 'ville eq "Rennes"', join: 'client' }],
      },
      {
        ...projets,
        joins: [byClient],
        aggregations: [{ fn: 'distinct', column: { join: 'client', field: 'nom' } }],
      },
      {
        ...projets,
        joins: [byClient],
        fields: [{ field: 'nom' }, { join: 'client', field: 'nom' }],
      },
      {
        ...projets,
        joins: [byClient],
        sort: [{ target: { kind: 'column', column: { join: 'client', field: 'nom' } } }],
      },
    ]
    for (const query of cited) expect(pruneJoins(query).joins).toEqual([byClient])
  })

  it('go when the last step citing them goes', () => {
    const { breakouts: _gone, ...rest } = grouped
    expect(pruneJoins(rest)).toEqual({
      kind: 'builder',
      source: 't-projets',
      aggregations: [{ fn: 'sum', column: { field: 'budget' } }],
    })
  })

  it('leave a join written by hand where it is, cited or not', () => {
    // A question saved before the mark existed has none on any join.
    const { implicit: _mark, ...written } = byClient
    const query: BuilderQuery = { ...projets, joins: [written] }
    expect(pruneJoins(query)).toBe(query)
    const both: BuilderQuery = { ...projets, joins: [written, { ...byClient, alias: 'client2' }] }
    expect(pruneJoins(both).joins).toEqual([written])
  })

  it('go with a join written by hand that they started from, never before', () => {
    const written = {
      alias: 'societes',
      table: 't-clients',
      kind: 'left' as const,
      left: { field: 'client' },
      right: '_id',
    }
    const onWritten = {
      alias: 'pays',
      table: 't-pays',
      kind: 'left' as const,
      left: { join: 'societes', field: 'pays' },
      right: '_id',
      implicit: true as const,
    }
    const query: BuilderQuery = {
      ...projets,
      joins: [written, onWritten],
      breakouts: [{ join: 'pays', field: 'nom' }],
    }
    expect(pruneJoins(query)).toBe(query)
    expect(withoutJoin(query, 'societes')).toEqual({ kind: 'builder', source: 't-projets' })
  })
})

describe('the question after a change', () => {
  const nom = reachableColumns(base, projets).find(
    (c) => c.ref.join === 'client' && c.ref.field === 'nom',
  )
  const business = [{ field: 'nom' }, { field: 'budget' }, { field: 'client' }, { field: 'equipe' }]

  it('fixes the columns of a list of rows when a join is added, or the kernel reads all of the table', () => {
    expect(defaultFields(base, projets)).toEqual(business)
    const joined = withJoinFor(
      { ...projets, fields: [...business, { join: 'client', field: 'nom' }] },
      nom,
    )
    expect(settleQuery(base, joined).fields).toEqual([
      ...business,
      { join: 'client', field: 'nom' },
    ])
    // A question that chose none and cites a column of the join in a filter reads the default.
    const filtered = withJoinFor(
      {
        ...projets,
        filters: [{ column: { join: 'client', field: 'ville' }, op: 'is', values: ['Rennes'] }],
      },
      nom,
    )
    expect(settleQuery(base, filtered).fields).toEqual(business)
    expect(chosenFields(base, settleQuery(base, filtered))).toEqual(business)
  })

  it('frees them again when the join goes and they are back to the default', () => {
    const query: BuilderQuery = {
      ...projets,
      joins: [byClient],
      fields: [...business, { join: 'client', field: 'nom' }],
    }
    const back = settleQuery(base, { ...query, fields: business })
    expect(back).toEqual({ kind: 'builder', source: 't-projets' })
    // A choice of its own stays.
    expect(settleQuery(base, { ...projets, fields: [{ field: 'nom' }] }).fields).toEqual([
      { field: 'nom' },
    ])
  })

  it('leaves a grouped question to its summary', () => {
    const grouped: BuilderQuery = {
      ...projets,
      joins: [byClient],
      aggregations: [{ fn: 'count' }],
      breakouts: [{ join: 'client', field: 'ville' }],
    }
    expect(settleQuery(base, grouped)).toBe(grouped)
  })

  it('drops the empty lists and the missing bound', () => {
    expect(compactQuery({ ...projets, filters: [], sort: [], limit: null })).toEqual(projets)
    expect(compactQuery({ ...projets, limit: 10 })).toEqual({ ...projets, limit: 10 })
  })

  it('takes a join away with everything that cites it', () => {
    const query: BuilderQuery = {
      ...projets,
      joins: [byClient],
      filters: [
        { column: { join: 'client', field: 'ville' }, op: 'is', values: ['Rennes'] },
        { column: { field: 'nom' }, op: 'contains', values: ['a'] },
      ],
      aggregations: [{ fn: 'sum', column: { field: 'budget' } }],
      breakouts: [{ join: 'client', field: 'ville' }],
      sort: [
        { target: { kind: 'breakout', index: 0 } },
        { target: { kind: 'aggregation', index: 0 }, desc: true },
      ],
    }
    expect(withoutJoin(query, 'client')).toEqual({
      kind: 'builder',
      source: 't-projets',
      filters: [{ column: { field: 'nom' }, op: 'contains', values: ['a'] }],
      aggregations: [{ fn: 'sum', column: { field: 'budget' } }],
      // The grouping went: the sort that counted it by rank went with it.
      sort: [{ target: { kind: 'aggregation', index: 0 }, desc: true }],
    })
  })
})

describe('the rows behind a point of an implicit join', () => {
  it('keep the join their filter needs, and read the columns the question showed', () => {
    const ville: ResultColumn = {
      name: 'client.ville',
      label: 'Client → Ville',
      role: 'dimension',
      type: 'short_text',
      source: { table: 't-clients', field: 'ville', join: 'client' },
    }
    const query: BuilderQuery = {
      ...projets,
      joins: [byClient],
      aggregations: [{ fn: 'sum', column: { field: 'budget' } }],
      breakouts: [{ join: 'client', field: 'ville' }],
    }
    const rows = settleQuery(
      base,
      drillRows(query, { values: [{ column: ville, value: 'Rennes' }] }),
    )
    expect(rows).toEqual({
      kind: 'builder',
      source: 't-projets',
      joins: [byClient],
      filters: [{ column: { join: 'client', field: 'ville' }, op: 'is', values: ['Rennes'] }],
      fields: [{ field: 'nom' }, { field: 'budget' }, { field: 'client' }, { field: 'equipe' }],
    })
  })
})

describe('a join written by hand', () => {
  it('starts from the condition the relations suggest', () => {
    const taches: BuilderQuery = { kind: 'builder', source: 't-taches' }
    const table = (name: string) =>
      base.tables.find((t) => t.name === name) as DescribedBase['tables'][number]
    // A link of the source to the table: the source’s column equals the table’s identifier.
    expect(suggestedCondition(base, taches, table('projets'))).toEqual({
      left: { field: 'projet' },
      right: '_id',
    })
    // A link of the table to the source: the other way round.
    expect(suggestedCondition(base, projets, table('taches'))).toEqual({
      left: { field: '_id' },
      right: 'projet',
    })
    // Nothing relates them: the person chooses.
    expect(suggestedCondition(base, taches, table('pays'))).toBeNull()
  })

  it('may start from the columns of an earlier join', () => {
    const written = {
      alias: 'societes',
      table: 't-clients',
      kind: 'left' as const,
      left: { field: 'client' },
      right: '_id',
    }
    const query: BuilderQuery = { ...projets, joins: [written] }
    const pays = base.tables.find((t) => t.name === 'pays') as DescribedBase['tables'][number]
    expect(suggestedCondition(base, query, pays)).toEqual({
      left: { join: 'societes', field: 'pays' },
      right: '_id',
    })
    expect(joinSuggestions(base, query).map((s) => s.label)).toContain('Pays (par Pays)')
    // A join added on its own is not a place to start from.
    const implicit: BuilderQuery = { ...projets, joins: [byClient] }
    expect(suggestedCondition(base, implicit, pays)).toBeNull()
  })

  it('takes a free alias, numbered past the first', () => {
    const query: BuilderQuery = { ...projets, joins: [{ ...byClient, alias: 'membres' }] }
    const membres = base.tables.find((t) => t.name === 'membres') as DescribedBase['tables'][number]
    expect(joinAlias(query, membres)).toBe('membres2')
    expect(joinAlias(projets, membres)).toBe('membres')
  })

  it('meets only columns the kernel can compare, and says what it keeps', () => {
    expect(joinable('link', 'id')).toBe(true)
    expect(joinable('multi_link', 'link')).toBe(true)
    expect(joinable('short_text', 'select')).toBe(true)
    expect(joinable('number', 'short_text')).toBe(false)
    expect(joinable('lookup', 'number')).toBe(true)
    expect(joinSentence('inner', 'Projets', 'Clients')).toBe(
      'Seulement les lignes présentes des deux côtés.',
    )
    expect(joinSentence('left', 'Projets', 'Clients')).toContain('Projets')
    expect(
      joinSentence('right', 'Projets', 'Clients').startsWith('Toutes les lignes de Clients'),
    ).toBe(true)
  })
})
