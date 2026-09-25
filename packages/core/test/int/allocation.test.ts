import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BasedbError } from '../../src/errors/index.js'
import { SCOPE_INSTANCE, allocateName, applySuffix } from '../../src/naming/allocation.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../../src/tx/context.js'

/**
 * Name allocation — chapter 01 §6.1, against a real database.
 *
 * Allocation is the ONLY path through which a physical name can come into being: it is
 * therefore the first kernel service that must be proven.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let tenantId: string
let baseId: string
/** Scope of table names: the SCHEMA, never the base (§6.2). */
let schemaId: string

function systemContext(actorId: string): RequestContext {
  const now = new Date('2026-09-19T10:00:00.000Z')
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-000000000001',
    actor: { kind: 'system', id: actorId },
    tenantId: TENANT_REF,
    surface: 'system',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

/** Allocates a table name in the bootstrap schema. */
function allocateTable(label: string) {
  return withTransaction(pools, 'ddl', ctx, (exec) =>
    allocateName(exec, ctx, {
      label,
      objectKind: 'table',
      scopeKind: 'schema',
      scopeId: schemaId,
    }),
  )
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })

  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
  })

  // Bootstrap: the tenant ↔ app_user cycle requires a single transaction with deferred
  // constraints. This is the product's very first start.
  const bootstrap = await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    const [t] = await exec.query<{ id: string; created_by: string }>(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap tenant', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
      [TENANT_REF],
      'insert',
    )
    const [u] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user (id, tenant_id, email, display_name, is_system, created_by, updated_by)
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, $1, $1)
       RETURNING id`,
      [t.created_by, t.id],
      'insert',
    )
    // A base belongs to a project (chapter 02).
    await exec.query(
      `INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
       VALUES ($1, 'Projet', 'projet', $2, $2)`,
      [t.id, u.id],
      'insert',
    )
    const [b] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.base (tenant_id, project_id, label, label_key, created_by, updated_by)
       VALUES ($1, (SELECT id FROM _basedb.project WHERE tenant_id = $1), 'CRM', 'crm', $2, $2)
       RETURNING id`,
      [t.id, u.id],
      'insert',
    )
    await exec.query('COMMIT')
    return { tenantId: t.id, userId: u.id, baseId: b.id }
  })

  tenantId = bootstrap.tenantId
  baseId = bootstrap.baseId
  ctx = systemContext(bootstrap.userId)

  // The base's schema: its name is allocated at INSTANCE scope, then the `db_schema`
  // row references it. This is the sequence the DDL engine will follow.
  schemaId = await withTransaction(pools, 'ddl', ctx, async (exec) => {
    const name = await allocateName(exec, ctx, {
      label: 'CRM',
      objectKind: 'schema',
      scopeKind: 'instance',
      scopeId: SCOPE_INSTANCE,
      tenantId: TENANT_REF,
    })
    expect(name.name).toBe(`b_${TENANT_REF}_crm`)

    const [s] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.db_schema (base_id, role, name_id, created_by)
       VALUES ($1, 'current', $2, $3) RETURNING id`,
      [baseId, name.nameId, ctx.actor.id],
      'insert',
    )
    return s.id
  })
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('chapter 01 §6.1 — the suffix loop', () => {
  it('the bare candidate is rank 1: no `_1` ever exists', () => {
    expect(applySuffix('clients', 1, 48)).toBe('clients')
    expect(applySuffix('clients', 2, 48)).toBe('clients_2')
    expect(applySuffix('clients', 10, 48)).toBe('clients_10')
  })

  it('the suffix re-truncates the candidate to stay within budget', () => {
    // "Going from `_9` to `_10` therefore truncates one byte further."
    const long = 'a'.repeat(48)
    expect(applySuffix(long, 9, 48)).toBe(`${'a'.repeat(46)}_9`)
    expect(applySuffix(long, 10, 48)).toBe(`${'a'.repeat(45)}_10`)
    expect(applySuffix(long, 99, 48)).toHaveLength(48)
  })

  it('strips the trailing `_` that truncation exposes', () => {
    // The budget is consumed to the last byte: 12 bytes of base + `_2`.
    expect(applySuffix('nom_tres_long_', 2, 14)).toBe('nom_tres_lon_2')
    // Here truncation lands ON a `_`, which is removed before the suffix.
    expect(applySuffix('nom_tres_l_ong', 2, 13)).toBe('nom_tres_l_2')
  })
})

describe('allocation against a real database', () => {
  it('allocates the bare candidate when it is free', async () => {
    const r = await allocateTable('Clients')
    expect(r.name).toBe('clients')
    expect(r.rank).toBe(1)
    expect(r.fallbackApplied).toBe(false)
  })

  it('a second label with the same slug receives `_2`', async () => {
    const r = await allocateTable('clients')
    expect(r.name).toBe('clients_2')
    expect(r.rank).toBe(2)
  })

  it('a reserved SQL word goes straight to `_2`, with no `_1`', async () => {
    const r = await allocateTable('Select')
    expect(r.name).toBe('select_2')
    expect(r.rank).toBe(2)
  })

  it('a reserved prefix is escaped, not suffixed', async () => {
    const r = await allocateTable('zz archive')
    expect(r.name).toBe('x_zz_archive')
    expect(r.rank).toBe(1)
  })

  it('a label with no Latin character triggers the fallback', async () => {
    const r = await allocateTable('Клиенты')
    expect(r.fallbackApplied).toBe(true)
    expect(r.name).toMatch(/^table_[2-9a-km-np-z]{6}$/)
  })

  it('a technical name outside alphabet A is refused', async () => {
    await expect(
      withTransaction(pools, 'ddl', ctx, (exec) =>
        allocateName(exec, ctx, {
          technicalName: 'Factures',
          objectKind: 'table',
          scopeKind: 'schema',
          scopeId: schemaId,
        }),
      ),
    ).rejects.toMatchObject({ code: 'IDENTIFIER_INVALID' })
  })

  it('a conforming technical name is taken as is, without slugification', async () => {
    const r = await withTransaction(pools, 'ddl', ctx, (exec) =>
      allocateName(exec, ctx, {
        technicalName: 'factures_2024',
        objectKind: 'table',
        scopeKind: 'schema',
        scopeId: schemaId,
      }),
    )
    expect(r.name).toBe('factures_2024')
  })

  it('the name stays taken whatever the state of its registry row', async () => {
    // A name is NEVER released: neither by relegation, nor by purge (§6.3).
    await withTransaction(pools, 'ddl', ctx, (exec) =>
      exec.query(
        "UPDATE _basedb.physical_name SET state = 'retired' WHERE scope_id = $1 AND name = 'clients'",
        [schemaId],
        'update',
      ),
    )

    const r = await allocateTable('Clients')
    expect(r.name).toBe('clients_3')
  })
})

describe('uniqueness scope (§6.2)', () => {
  it('two distinct schemas may carry tables with the same name', async () => {
    // This is what makes compatibility aliases feasible: an alias schema holds views
    // bearing exactly the names of the current schema's tables.
    const otherSchema = await withTransaction(pools, 'ddl', ctx, async (exec) => {
      const [b] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.base (tenant_id, project_id, label, label_key, created_by, updated_by)
         VALUES ($1, (SELECT id FROM _basedb.project WHERE tenant_id = $1), 'Autre', 'autre', $2, $2)
         RETURNING id`,
        [tenantId, ctx.actor.id],
        'insert',
      )
      const name = await allocateName(exec, ctx, {
        label: 'Autre',
        objectKind: 'schema',
        scopeKind: 'instance',
        scopeId: SCOPE_INSTANCE,
        tenantId: TENANT_REF,
      })
      const [s] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.db_schema (base_id, role, name_id, created_by)
         VALUES ($1, 'current', $2, $3) RETURNING id`,
        [b.id, name.nameId, ctx.actor.id],
        'insert',
      )
      return s.id
    })

    const r = await withTransaction(pools, 'ddl', ctx, (exec) =>
      allocateName(exec, ctx, {
        label: 'Clients',
        objectKind: 'table',
        scopeKind: 'schema',
        scopeId: otherSchema,
      }),
    )
    expect(r.name).toBe('clients')
  })

  it('two tenants may have a base with the same label', async () => {
    // The availability check bears on the ASSEMBLED NAME: `b_t4z56fq_crm` and
    // `b_t9k2mnp_crm` do not collide, and no spurious suffix appears.
    await pools.withConnection('catalog', async (exec) => {
      const [t] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.tenant (ref, label, created_by)
         VALUES ('t9k2mnp', 'Second tenant', $1) RETURNING id`,
        [ctx.actor.id],
        'insert',
      )
      await exec.query(
        `INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
         VALUES ($1, 'Projet', 'projet', $2, $2)`,
        [t.id, ctx.actor.id],
        'insert',
      )
      const [b] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.base (tenant_id, project_id, label, label_key, created_by, updated_by)
         VALUES ($1, (SELECT id FROM _basedb.project WHERE tenant_id = $1), 'CRM', 'crm', $2, $2)
         RETURNING id`,
        [t.id, ctx.actor.id],
        'insert',
      )
      return b.id
    })

    const r = await withTransaction(pools, 'ddl', ctx, (exec) =>
      allocateName(exec, ctx, {
        label: 'CRM',
        objectKind: 'schema',
        scopeKind: 'instance',
        scopeId: SCOPE_INSTANCE,
        tenantId: 't9k2mnp',
      }),
    )
    expect(r.name).toBe('b_t9k2mnp_crm')
    expect(r.rank).toBe(1)
  })
})

describe('connection contract (§10.3)', () => {
  it('search_path is empty and TimeZone is UTC on all three pools', async () => {
    for (const pool of ['catalog', 'data', 'ddl'] as const) {
      const rows = await pools.withConnection(pool, (exec) =>
        exec.query<{ sp: string; tz: string }>(
          "SELECT current_setting('search_path') AS sp, current_setting('TimeZone') AS tz",
        ),
      )
      expect(rows[0].sp, `${pool}: search_path must be empty`).toBe('')
      expect(rows[0].tz, `${pool}: TimeZone must be UTC`).toBe('UTC')
    }
  })

  it('an unqualified reference does not resolve', async () => {
    // The empty `search_path` is what makes it impossible to hijack an object through a
    // schema placed at the head of the path.
    await expect(
      pools.withConnection('catalog', (exec) => exec.query('SELECT 1 FROM physical_name')),
    ).rejects.toBeInstanceOf(BasedbError)
  })
})
