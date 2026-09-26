import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { reorderFields } from '../../src/catalog/field-order.js'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { projectBase } from '../../src/catalog/projection.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The order of a table's fields — chapter 04 §1.1: the catalog's, set as a whole list,
 * read back by every projection; PostgreSQL's own column order untouched.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let schemaName: string
let tableId: string
let tableName: string

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

/** The business fields as `/meta` lists them. */
async function projected(): Promise<string[]> {
  const base = await projectBase(pools, ctx, schemaName)
  const table = base.tables.find((t) => t.name === tableName)
  return (table?.fields ?? []).filter((f) => !f.system).map((f) => f.name)
}

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
  const now = new Date()
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-0000000000d1',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
  const base = await createBase(pools, ctx, { label: 'Chantiers' })
  schemaName = base.schemaName
  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Visites',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Ville', kind: 'short_text' },
      { label: 'Montant', kind: 'number' },
    ],
  })
  tableId = table.tableId
  tableName = table.tableName
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('the order of the fields', () => {
  it('is the one given, and every reader of the catalog follows it', async () => {
    expect(await projected()).toEqual(['nom', 'ville', 'montant'])
    const result = await reorderFields(pools, ctx, {
      tableId,
      names: ['montant', 'nom', 'ville'],
    })
    expect(result.order).toEqual(['montant', 'nom', 'ville'])
    expect(await projected()).toEqual(['montant', 'nom', 'ville'])
  })

  it('keeps the fields a stale list does not name, after the ones it does', async () => {
    await addField(pools, ctx, { tableId, label: 'Notes', kind: 'long_text' })
    const result = await reorderFields(pools, ctx, { tableId, names: ['ville', 'nom'] })
    expect(result.order).toEqual(['ville', 'nom', 'montant', 'notes'])
    expect(await projected()).toEqual(['ville', 'nom', 'montant', 'notes'])
  })

  it('leaves PostgreSQL’s own column order alone', async () => {
    const [row] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ columns: string[] }>(
        `SELECT array_agg(attname::text ORDER BY attnum) AS columns FROM pg_attribute
          WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped
            AND attname NOT LIKE '\\_%'`,
        [`"${schemaName}"."${tableName}"`],
      ),
    )
    expect(row.columns).toEqual(['nom', 'ville', 'montant', 'notes'])
  })

  it('refuses a name it does not know, and a name given twice', async () => {
    const unknown = await failure(reorderFields(pools, ctx, { tableId, names: ['nom', 'adresse'] }))
    expect(unknown.details).toMatchObject({ reason: 'champ_inconnu', detail: 'adresse' })
    const twice = await failure(reorderFields(pools, ctx, { tableId, names: ['nom', 'nom'] }))
    expect(twice.details).toMatchObject({ reason: 'doublon' })
    const empty = await failure(reorderFields(pools, ctx, { tableId, names: [] }))
    expect(empty.code).toBe('REQUEST_INVALID')
    // Nothing moved.
    expect(await projected()).toEqual(['ville', 'nom', 'montant', 'notes'])
  })
})
