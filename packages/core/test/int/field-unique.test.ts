import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteField } from '../../src/catalog/field-deletion.js'
import { setFieldUnique } from '../../src/catalog/field-unique.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * A field without duplicates — chapter 04 §1.6, against a real PostgreSQL: the guarantee
 * is the database's, so is the test.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext

function contextFor(userId: string): RequestContext {
  const t = new Date('2026-09-18T12:00:00Z')
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000000c',
    actor: { kind: 'user', id: userId },
    tenantId: TENANT_REF,
    surface: 'ui',
    timestamp: t,
    deadline: new Date(t.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
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
    return { tenantId: t.id, userId: t.created_by }
  })

  admin = contextFor(bootstrap.userId)
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

async function makeTable(label: string): Promise<{
  schema: string
  table: string
  tableId: string
  numero: string
}> {
  const base = await createBase(pools, admin, { label })
  const table = await createTable(pools, admin, {
    baseId: base.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text' },
      { label: 'Notes', kind: 'long_text' },
    ],
  })
  const [numero] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      `SELECT id FROM _basedb.field WHERE table_id = $1 AND label = 'Numéro'`,
      [table.tableId],
    ),
  )
  return {
    schema: base.schemaName,
    table: table.tableName,
    tableId: table.tableId,
    numero: numero?.id ?? '',
  }
}

async function insert(t: { schema: string; table: string }, values: readonly (string | null)[]) {
  await pools.withConnection('data', async (exec) => {
    for (const v of values) {
      await exec.query(
        `INSERT INTO "${t.schema}"."${t.table}" ("numero") VALUES ($1)`,
        [v],
        'insert',
      )
    }
  })
}

async function failure(promise: Promise<unknown>): Promise<{ code?: string; details?: unknown }> {
  try {
    await promise
    return {}
  } catch (e) {
    return e as { code?: string; details?: unknown }
  }
}

describe('§1.6 — no duplicate', () => {
  it('refuses while values repeat, and names them with their count', async () => {
    const t = await makeTable('Doublons')
    await insert(t, ['F-1', 'F-2', 'F-2', 'F-3', 'F-3', 'F-3', null, null])
    const refused = await failure(setFieldUnique(pools, admin, { fieldId: t.numero, unique: true }))
    expect(refused.code).toBe('DUPLICATE_VALUE')
    expect(refused.details).toMatchObject({
      field: 'Numéro',
      duplicates: [
        { value: 'F-3', count: 3 },
        { value: 'F-2', count: 2 },
      ],
    })
    // Nothing left behind: no constraint, no index.
    const [left] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string }>(
        `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = $1 AND indexname LIKE 'uq_%'`,
        [t.schema],
      ),
    )
    expect(Number(left?.n)).toBe(0)
  })

  it('then holds every writer to it, psql included — empty rows stay allowed', async () => {
    const t = await makeTable('Unicité')
    await insert(t, ['F-1', 'F-2', null])
    const result = await setFieldUnique(pools, admin, { fieldId: t.numero, unique: true })
    expect(result.unique).toBe(true)

    await insert(t, [null, 'F-3'])
    expect((await failure(insert(t, ['F-1']))).code).toBeDefined()

    const [state] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ state: string; kind: string }>(
        `SELECT c.state, c.kind FROM _basedb.table_constraint c
           JOIN _basedb.table_constraint_member m ON m.constraint_id = c.id
          WHERE m.field_id = $1 AND c.kind = 'unique'`,
        [t.numero],
      ),
    )
    expect(state).toEqual({ state: 'active', kind: 'unique' })
  })

  it('is taken off in one statement, and duplicates are allowed again', async () => {
    const t = await makeTable('Retrait')
    await insert(t, ['F-1'])
    await setFieldUnique(pools, admin, { fieldId: t.numero, unique: true })
    await setFieldUnique(pools, admin, { fieldId: t.numero, unique: false })
    await insert(t, ['F-1'])
  })

  it('is not offered on a long text', async () => {
    const t = await makeTable('Texte long')
    const [notes] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `SELECT id FROM _basedb.field WHERE table_id = $1 AND label = 'Notes'`,
        [t.tableId],
      ),
    )
    const refused = await failure(
      setFieldUnique(pools, admin, { fieldId: notes?.id ?? '', unique: true }),
    )
    expect(refused.code).toBe('REQUEST_INVALID')
  })

  it('goes with the field when it is deleted', async () => {
    const t = await makeTable('Suppression')
    await insert(t, ['F-1'])
    await setFieldUnique(pools, admin, { fieldId: t.numero, unique: true })
    await deleteField(pools, admin, { fieldId: t.numero })
    await pools.withConnection('data', (exec) =>
      exec.query(
        `INSERT INTO "${t.schema}"."${t.table}" ("zz_supprime_20260918_numero") VALUES ('F-1')`,
        [],
        'insert',
      ),
    )
  })
})
