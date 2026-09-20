import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { BATCH_MAX_OPERATIONS, createRecords } from '../../src/records/create.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * A batch of creations — chapter 08 §3.5, `atomic: true`.
 *
 * What a batch has to guarantee is not that rows get in; it is that a batch which fails
 * leaves NOTHING behind, and says which row failed. A file import that half-applies is
 * worse than one that fails: the person cannot tell what is in the table, and the fix —
 * import again — duplicates it.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let actorId: string
let tableId: string
let relation: string

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

const count = async () =>
  (
    await pools.withConnection('data', (exec) =>
      exec.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${relation}`),
    )
  )[0].n

const names = async () =>
  (
    await pools.withConnection('data', (exec) =>
      exec.query<{ nom: string }>(`SELECT "nom" FROM ${relation} ORDER BY "_id"`),
    )
  ).map((r) => r.nom)

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })

  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
  })

  const bootstrap = await pools.withConnection('catalog', async (exec) => {
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
    return t
  })

  actorId = bootstrap.created_by
  const now = new Date('2026-09-20T12:00:00.000Z')
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000006c',
    actor: { kind: 'user', id: actorId },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'CRM' })
  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Contacts',
    fields: [{ label: 'Nom', kind: 'short_text', required: true }],
  })
  tableId = table.tableId
  relation = `"${base.schemaName}"."${table.tableName}"`

  await addField(pools, ctx, { tableId, label: 'Age', kind: 'number' })
  await addField(pools, ctx, {
    tableId,
    label: 'Statut',
    kind: 'select',
    options: [{ value: 'actif' }, { value: 'inactif' }],
  })
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('a batch that goes through', () => {
  it('creates every row, in order, and answers with their identifiers', async () => {
    const before = await count()
    const result = await createRecords(pools, ctx, {
      tableId,
      records: [
        { nom: 'Camille', age: 31, statut: 'actif' },
        { nom: 'Thomas', age: 44, statut: 'inactif' },
        { nom: 'Léa', age: 27, statut: 'actif' },
      ],
    })

    expect(result.ids).toHaveLength(3)
    expect(new Set(result.ids).size).toBe(3)
    expect(await count()).toBe(before + 3)
    // Aligned with the input: the first identifier is Camille's.
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ _id: string; nom: string }>(
        `SELECT "_id", "nom" FROM ${relation} WHERE "_id" = ANY($1::uuid[])`,
        [result.ids],
      ),
    )
    const byId = new Map(rows.map((r) => [r._id, r.nom]))
    expect(result.ids.map((id) => byId.get(id))).toEqual(['Camille', 'Thomas', 'Léa'])
  }, 60_000)

  it('takes rows that name different columns — what a file with holes produces', async () => {
    await createRecords(pools, ctx, {
      tableId,
      records: [
        { nom: 'Seul' },
        { nom: 'Avec âge', age: 50 },
        { nom: 'Sans statut', statut: null },
      ],
    })
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ nom: string; age: string | null; statut: string | null }>(
        `SELECT "nom", "age", "statut" FROM ${relation} WHERE "nom" IN ('Seul', 'Avec âge', 'Sans statut') ORDER BY "nom"`,
      ),
    )
    expect(rows.map((r) => [r.nom, r.age === null ? null : Number(r.age), r.statut])).toEqual([
      ['Avec âge', 50, null],
      ['Sans statut', null, null],
      ['Seul', null, null],
    ])
  }, 60_000)

  it('records the actor on every row, as a single write does', async () => {
    const { ids } = await createRecords(pools, ctx, {
      tableId,
      records: [{ nom: 'A1' }, { nom: 'A2' }],
    })
    const authors = await pools.withConnection('data', (exec) =>
      exec.query<{ _created_by: string; _updated_by: string }>(
        `SELECT "_created_by", "_updated_by" FROM ${relation} WHERE "_id" = ANY($1::uuid[])`,
        [ids],
      ),
    )
    expect(authors).toHaveLength(2)
    for (const row of authors) {
      expect(row._created_by).toBe(actorId)
      expect(row._updated_by).toBe(actorId)
    }
  }, 60_000)

  it('accepts a batch of exactly the bound, and refuses one row more', async () => {
    const records = Array.from({ length: BATCH_MAX_OPERATIONS }, (_, i) => ({ nom: `Lot ${i}` }))
    const before = await count()
    const started = Date.now()
    await createRecords(pools, ctx, { tableId, records })
    expect(await count()).toBe(before + BATCH_MAX_OPERATIONS)
    // The cost of one INSERT per row must stay far inside the 30 s request budget.
    expect(Date.now() - started).toBeLessThan(15_000)

    const tooMany = await failure(
      createRecords(pools, ctx, { tableId, records: [...records, { nom: 'de trop' }] }),
    )
    expect(tooMany.code).toBe('BATCH_TOO_LARGE')
    expect(tooMany.details).toMatchObject({
      operations: BATCH_MAX_OPERATIONS + 1,
      maximum: BATCH_MAX_OPERATIONS,
    })
    expect(await count()).toBe(before + BATCH_MAX_OPERATIONS)
  }, 90_000)
})

describe('a batch that fails leaves nothing behind, and names the row', () => {
  it('a value PostgreSQL refuses: the row is named, and no other row was written', async () => {
    const before = await count()
    const refused = await failure(
      createRecords(pools, ctx, {
        tableId,
        records: [
          { nom: 'Bon 1', age: 10 },
          { nom: 'Bon 2', age: 20 },
          { nom: 'Mauvais', age: 'vingt' },
          { nom: 'Bon 3', age: 30 },
        ],
      }),
    )

    expect(refused.code).toBe('VALUE_INVALID')
    expect(refused.details).toMatchObject({ index: 2 })
    // The two good rows BEFORE the bad one are gone too: all or nothing.
    expect(await count()).toBe(before)
    expect(await names()).not.toContain('Bon 1')
  }, 60_000)

  it('a value outside the list of choices', async () => {
    const before = await count()
    const refused = await failure(
      createRecords(pools, ctx, {
        tableId,
        records: [
          { nom: 'X', statut: 'actif' },
          { nom: 'Y', statut: 'inconnu' },
        ],
      }),
    )
    expect(refused.code).toBe('VALUE_OUT_OF_CONSTRAINT')
    expect(refused.details).toMatchObject({ index: 1 })
    expect(await count()).toBe(before)
  }, 60_000)

  it('a required value that is missing', async () => {
    const before = await count()
    const refused = await failure(
      createRecords(pools, ctx, {
        tableId,
        records: [{ nom: 'Complet' }, { age: 5 }],
      }),
    )
    expect(refused.code).toBe('REQUIRED_VALUE_MISSING')
    expect(refused.details).toMatchObject({ index: 1 })
    expect(await count()).toBe(before)
  }, 60_000)

  it('a field the actor may not write, or that does not exist, before any row is written', async () => {
    const before = await count()
    const system = await failure(
      createRecords(pools, ctx, {
        tableId,
        records: [{ nom: 'Ok' }, { nom: 'Pirate', _created_by: actorId }],
      }),
    )
    expect(system.code).toMatch(/FIELD_NOT_WRITABLE|FILTER_FIELD_UNKNOWN/)
    expect(system.details).toMatchObject({ index: 1 })

    const unknown = await failure(
      createRecords(pools, ctx, { tableId, records: [{ nom: 'Ok' }, { inconnu: 1 }] }),
    )
    expect(unknown.code).toBe('FILTER_FIELD_UNKNOWN')
    expect(unknown.details).toMatchObject({ index: 1, field: 'inconnu' })
    expect(await count()).toBe(before)
  }, 60_000)

  it('an empty batch, and a table that does not exist', async () => {
    expect((await failure(createRecords(pools, ctx, { tableId, records: [] }))).code).toBe(
      'REQUEST_INVALID',
    )
    const ghost = await failure(
      createRecords(pools, ctx, {
        tableId: '018f3c2a-0000-7000-8000-000000000001',
        records: [{ nom: 'x' }],
      }),
    )
    expect(ghost.code).toBe('RESOURCE_NOT_FOUND')
  }, 60_000)
})
