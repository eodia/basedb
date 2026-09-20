import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Vertical slice of the kernel — exit criterion no. 8 of phase 2:
 *
 *   "One base, one table and the four column types of the vertical slice, created and
 *    populated EXCLUSIVELY by kernel operations, with no API and no interface, and read
 *    back in raw SQL with readable names."
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext

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
      `INSERT INTO _basedb.app_user (id, tenant_id, email, display_name, is_system, created_by, updated_by)
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t.created_by
  })

  const now = new Date('2026-09-19T12:00:00.000Z')
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000000a',
    actor: { kind: 'system', id: actor },
    tenantId: TENANT_REF,
    surface: 'system',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('one base, one table, four column types', () => {
  let schemaName: string
  let tableName: string

  it('creates the base and its PostgreSQL schema', async () => {
    const base = await createBase(pools, ctx, { label: 'CRM' })
    expect(base.schemaName).toBe(`b_${TENANT_REF}_crm`)
    schemaName = base.schemaName

    const rows = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string }>('SELECT count(*)::text AS n FROM pg_namespace WHERE nspname = $1', [
        base.schemaName,
      ]),
    )
    expect(Number(rows[0].n)).toBe(1)

    const table = await createTable(pools, ctx, {
      baseId: base.baseId,
      label: 'Factures',
      fields: [
        { label: 'Numéro', kind: 'short_text', required: true },
        { label: 'Montant', kind: 'number' },
        { label: 'Payée', kind: 'boolean' },
        { label: "Date d'émission", kind: 'date' },
      ],
    })

    tableName = table.tableName
    expect(table.tableName).toBe('factures')
    expect(table.fields.map((f) => f.name)).toEqual([
      'numero',
      'montant',
      'payee',
      'date_d_emission',
    ])
    expect(table.qualifiedName).toBe(`"b_${TENANT_REF}_crm"."factures"`)
  })

  it('the table exists in the database with its system and business columns', async () => {
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ column_name: string; data_type: string; is_nullable: string }>(
        `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position`,
        [schemaName, tableName],
      ),
    )

    expect(rows.map((r) => r.column_name)).toEqual([
      '_id',
      '_created_at',
      '_updated_at',
      '_created_by',
      '_updated_by',
      'numero',
      'montant',
      'payee',
      'date_d_emission',
    ])

    const byName = new Map(rows.map((r) => [r.column_name, r]))
    expect(byName.get('numero')?.data_type).toBe('text')
    expect(byName.get('montant')?.data_type).toBe('numeric')
    expect(byName.get('payee')?.data_type).toBe('boolean')
    expect(byName.get('date_d_emission')?.data_type).toBe('date')
    // `is_required` becomes `NOT NULL`.
    expect(byName.get('numero')?.is_nullable).toBe('NO')
    expect(byName.get('montant')?.is_nullable).toBe('YES')
  })

  it('the primary key carries the normative name `pk_<table>`', async () => {
    // Never left to PostgreSQL's automatic naming: the name must be readable in an
    // error message and known to the registry.
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ conname: string }>(
        `SELECT c.conname FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = $1 AND t.relname = $2 AND c.contype = 'p'`,
        [schemaName, tableName],
      ),
    )
    expect(rows[0].conname).toBe('pk_factures')
  })

  it('the business labels are readable in raw SQL', async () => {
    // This is the product's central promise: open psql and understand the database
    // without opening the product.
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ object: string; label: string }>(
        `SELECT 'table' AS object, obj_description(c.oid) AS label
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2
          UNION ALL
         SELECT a.attname, col_description(a.attrelid, a.attnum)
           FROM pg_attribute a
           JOIN pg_class c ON c.oid = a.attrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0
            AND col_description(a.attrelid, a.attnum) IS NOT NULL`,
        [schemaName, tableName],
      ),
    )

    const byObject = new Map(rows.map((r) => [r.object, r.label]))
    expect(byObject.get('table')).toBe('Factures')
    expect(byObject.get('numero')).toBe('Numéro')
    expect(byObject.get('date_d_emission')).toBe("Date d'émission")
  })

  it('the table accepts a DIRECT SQL write and serves its defaults', async () => {
    // The cadrage requires data to live in real tables usable directly in SQL: an
    // insert written by hand must work.
    const inserted = await pools.withConnection('data', (exec) =>
      exec.query<{ _id: string; numero: string; created: string }>(
        `INSERT INTO "${schemaName}"."${tableName}" ("numero", "montant", "payee", "date_d_emission")
         VALUES ('F-2026-001', 1234.56, false, DATE '2026-09-19')
         RETURNING "_id", "numero", "_created_at"::text AS created`,
        [],
        'insert',
      ),
    )

    expect(inserted[0].numero).toBe('F-2026-001')
    // `_id` is served by `_basedb_local.uuid_generate_v7()`, version 7.
    expect(inserted[0]._id[14]).toBe('7')
    // `_created_at` is rendered in UTC, because the connection contract pins the zone.
    expect(inserted[0].created).toContain('+00')
  })

  it('the required field refuses a null value', async () => {
    await expect(
      pools.withConnection('data', (exec) =>
        exec.query(
          `INSERT INTO "${schemaName}"."${tableName}" ("montant") VALUES (1)`,
          [],
          'insert',
        ),
      ),
    ).rejects.toMatchObject({ code: 'REQUIRED_VALUE_MISSING' })
  })

  it('the catalog and the physical database agree', async () => {
    // The central invariant: every catalog field has its column, and conversely.
    const drifts = await pools.withConnection('catalog', (exec) =>
      exec.query<{ drift: string }>(
        `WITH in_catalog AS (
           SELECT n.name
             FROM _basedb.field f
             JOIN _basedb.physical_name n ON n.id = f.name_id
             JOIN _basedb.table_def t ON t.id = f.table_id
             JOIN _basedb.physical_name tn ON tn.id = t.name_id
            WHERE tn.name = $2 AND f.is_live
         ), in_database AS (
           SELECT a.attname AS name
             FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace ns ON ns.oid = c.relnamespace
            WHERE ns.nspname = $1 AND c.relname = $2
              AND a.attnum > 0 AND NOT a.attisdropped
              AND a.attname NOT LIKE '\\_%'
         )
         SELECT name AS drift FROM in_catalog EXCEPT SELECT name FROM in_database
         UNION ALL
         SELECT name FROM in_database EXCEPT SELECT name FROM in_catalog`,
        [schemaName, tableName],
      ),
    )
    expect(drifts.map((d) => d.drift)).toEqual([])
  })
})
