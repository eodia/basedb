import { catalogMigrations } from '@basedb/catalog-schema'
import type { BuilderQuery, Join } from '@basedb/contracts'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runBuilderQuery } from '../../src/analytics/query.js'
import { checkedQuery, tablesOf } from '../../src/catalog/dashboards.js'
import { createLinkField } from '../../src/catalog/links.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { createRecord } from '../../src/records/create.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The joins the editor of questions adds on its own — chapter 18 §3.
 *
 * A column of a table the source links to is chosen like any other, and the editor puts the
 * join in the query, marked `implicit`. What this establishes is the kernel's half: the mark
 * survives the check a save makes, and changes nothing to how the question is read — a link
 * is joined on the identifier of its target, a list of links element by element (`= ANY`),
 * each table through the plan of its reader.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let baseId: string
let projetsId: string
let clientsId: string
let membresId: string
let clientLink: string
let teamLink: string

const run = (query: BuilderQuery) =>
  runBuilderQuery(pools, ctx, { baseId, query, timeZone: 'Europe/Paris' })

/** The check a save makes: the tables are the base's, the fields exist. */
const saved = async (raw: BuilderQuery) => {
  const tables = await pools.withConnection('catalog', (exec) => tablesOf(exec, baseId))
  return checkedQuery(raw, tables, 'query') as BuilderQuery
}

const implicitJoin = (alias: string, table: string, link: string): Join => ({
  alias,
  table,
  kind: 'left',
  left: { field: link },
  right: '_id',
  implicit: true,
})

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })
  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
  })
  const actor = await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    const [t] = await exec.query<{ id: string; created_by: string }>(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
      [TENANT_REF],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.app_user
         (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t.created_by
  })
  const now = new Date()
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-0000000000e1',
    actor: { kind: 'user', id: actor },
    tenantId: TENANT_REF,
    surface: 'ui',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  baseId = (await createBase(pools, ctx, { label: 'Agence' })).baseId
  clientsId = (
    await createTable(pools, ctx, {
      baseId,
      label: 'Clients',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Ville', kind: 'short_text' },
      ],
    })
  ).tableId
  membresId = (
    await createTable(pools, ctx, {
      baseId,
      label: 'Membres',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
  ).tableId
  projetsId = (
    await createTable(pools, ctx, {
      baseId,
      label: 'Projets',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Budget', kind: 'number' },
      ],
    })
  ).tableId
  clientLink = (
    await createLinkField(pools, ctx, {
      tableId: projetsId,
      targetTableId: clientsId,
      label: 'Client',
    })
  ).name
  teamLink = (
    await createLinkField(pools, ctx, {
      tableId: projetsId,
      targetTableId: membresId,
      label: 'Équipe',
      multiple: true,
    })
  ).name

  const id = async (tableId: string, values: Record<string, unknown>) =>
    String((await createRecord(pools, ctx, { tableId, values })).row._id)
  const dupont = await id(clientsId, { nom: 'Dupont', ville: 'Rennes' })
  const leroy = await id(clientsId, { nom: 'Leroy', ville: 'Nantes' })
  const anne = await id(membresId, { nom: 'Anne' })
  const bob = await id(membresId, { nom: 'Bob' })
  await id(projetsId, { nom: 'P1', budget: '1000', [clientLink]: dupont, [teamLink]: [anne, bob] })
  await id(projetsId, { nom: 'P2', budget: '500', [clientLink]: dupont, [teamLink]: [anne] })
  await id(projetsId, { nom: 'P3', budget: '300', [clientLink]: leroy, [teamLink]: [] })
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('a question joined through a link by the editor', () => {
  it('keeps the mark through the check a save makes, and the table by its identifier', async () => {
    const query = await saved({
      kind: 'builder',
      source: projetsId,
      joins: [implicitJoin('client', clientsId, clientLink)],
      aggregations: [{ fn: 'sum', column: { field: 'budget' } }],
      breakouts: [{ join: 'client', field: 'ville' }],
    })
    expect(query.joins).toEqual([implicitJoin('client', clientsId, clientLink)])
  })

  it('reads a column of the linked table: the budget by the city of the client', async () => {
    const result = await run({
      kind: 'builder',
      source: projetsId,
      joins: [implicitJoin('client', clientsId, clientLink)],
      aggregations: [{ fn: 'sum', column: { field: 'budget' } }],
      breakouts: [{ join: 'client', field: 'ville' }],
    })
    expect(result.rows).toEqual([
      ['Nantes', 300],
      ['Rennes', 1500],
    ])
    expect(result.columns[0]?.source).toMatchObject({ field: 'ville', join: 'client' })
  })

  it('filters on a column of the linked table, and lists the rows of the source', async () => {
    const listing: BuilderQuery = {
      kind: 'builder',
      source: projetsId,
      joins: [implicitJoin('client', clientsId, clientLink)],
      filters: [{ column: { join: 'client', field: 'ville' }, op: 'is', values: ['Rennes'] }],
      sort: [{ target: { kind: 'column', column: { field: 'nom' } } }],
    }
    // Without columns chosen the kernel reads every column of every table in the query: this is
    // why the editor fixes them when it adds a join, and the table joined then brings none.
    const loose = await run(listing)
    const result = await run({ ...listing, fields: [{ field: 'nom' }, { field: 'budget' }] })
    expect(loose.columns.length).toBeGreaterThan(result.columns.length)
    expect(result.rows.map((r) => r.slice(0, 2))).toEqual([
      ['P1', 1000],
      ['P2', 500],
    ])
    expect(result.columns.filter((c) => c.hidden !== true).map((c) => c.label)).toEqual([
      'Nom',
      'Budget',
    ])
  })

  it('reads a column of the table a list of links leads to, element by element', async () => {
    const result = await run({
      kind: 'builder',
      source: projetsId,
      joins: [implicitJoin('equipe', membresId, teamLink)],
      aggregations: [{ fn: 'count' }],
      breakouts: [{ join: 'equipe', field: 'nom' }],
    })
    // Anne is on two projects, Bob on one, and the project nobody is on has no member.
    expect(Object.fromEntries(result.rows.map((r) => [r[0], r[1]]))).toEqual({
      Anne: 2,
      Bob: 1,
      null: 1,
    })
  })

  it('answers as a join written by hand does: the mark changes nothing', async () => {
    const { implicit: _mark, ...written } = implicitJoin('client', clientsId, clientLink)
    const ask = (join: Join): BuilderQuery => ({
      kind: 'builder',
      source: projetsId,
      joins: [join],
      aggregations: [{ fn: 'count' }],
      breakouts: [{ join: 'client', field: 'nom' }],
    })
    const [marked, plain] = await Promise.all([
      run(ask(implicitJoin('client', clientsId, clientLink))),
      run(ask(written)),
    ])
    expect(marked.rows).toEqual(plain.rows)
    // And a question saved before the mark existed still passes the check, without it.
    expect((await saved(ask(written))).joins).toEqual([written])
  })
})
