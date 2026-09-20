import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { listRecords } from '../../src/records/list.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * RBAC end to end — decision loaded from the catalog, mask emitted into the SQL.
 *
 * This is what makes the enforcement point observable rather than tested in isolation:
 * a user whose field is masked does not see it in the response, and the column does not
 * even appear in the emitted query.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext
let tableId: string
let amountFieldId: string
let tenantId: string
let baseId: string

function contextFor(userId: string): RequestContext {
  const t = new Date('2026-09-19T12:00:00Z')
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000000b',
    actor: { kind: 'user', id: userId },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: t,
    deadline: new Date(t.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

/** Creates an ordinary user, with a role carrying the given permissions. */
async function createUser(
  name: string,
  permissions: ReadonlyArray<{ action: string; scopeKind: string; baseId?: string }>,
  maskedFields: ReadonlyArray<{ fieldId: string; access: 'hidden' | 'read_only' }> = [],
): Promise<string> {
  return pools.withConnection('catalog', async (exec) => {
    const [u] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4) RETURNING id`,
      [tenantId, `${name}@basedb.local`, name, admin.actor.id],
      'insert',
    )
    const [r] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
       VALUES ($1, $2, $2, $3, $4) RETURNING id`,
      [tenantId, name, name, admin.actor.id],
      'insert',
    )
    await exec.query(
      'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
      [r.id, u.id, admin.actor.id],
      'insert',
    )
    for (const p of permissions) {
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [r.id, p.scopeKind, p.baseId ?? null, p.action, admin.actor.id],
        'insert',
      )
    }
    for (const f of maskedFields) {
      await exec.query(
        'INSERT INTO _basedb.field_permission (role_id, field_id, access) VALUES ($1, $2, $3)',
        [r.id, f.fieldId, f.access],
        'insert',
      )
    }
    return u.id
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

  tenantId = bootstrap.tenantId
  admin = contextFor(bootstrap.userId)

  const base = await createBase(pools, admin, { label: 'CRM' })
  baseId = base.baseId
  const table = await createTable(pools, admin, {
    baseId: base.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number' },
      { label: 'Payée', kind: 'boolean' },
    ],
  })
  tableId = table.tableId
  amountFieldId = table.fields[1].fieldId

  await pools.withConnection('data', (exec) =>
    exec.query(
      `INSERT INTO ${table.qualifiedName} ("numero", "montant", "payee")
       VALUES ('F-001', 100, true), ('F-002', 200, false)`,
      [],
      'insert',
    ),
  )
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('reading under the actor mask', () => {
  it('the instance administrator sees every field', async () => {
    const r = await listRecords(pools, admin, { tableId })
    expect(r.columns).toEqual([
      '_id',
      '_created_at',
      '_updated_at',
      '_created_by',
      '_updated_by',
      'numero',
      'montant',
      'payee',
    ])
    expect(r.rows).toHaveLength(2)
  })

  it('an ordinary reader sees the same fields', async () => {
    const reader = await createUser('lecteur', [{ action: 'read', scopeKind: 'base', baseId }])
    const r = await listRecords(pools, contextFor(reader), { tableId })
    expect(r.columns).toContain('montant')
    expect(r.rows).toHaveLength(2)
  })

  it('a masked field appears NEITHER in the response NOR in the emitted SQL', async () => {
    const restricted = await createUser(
      'restreint',
      [{ action: 'read', scopeKind: 'base', baseId }],
      [{ fieldId: amountFieldId, access: 'hidden' }],
    )
    const r = await listRecords(pools, contextFor(restricted), { tableId })

    expect(r.columns).not.toContain('montant')
    expect(r.columns).toContain('numero')
    // The mask is applied when BUILDING the SQL, not by filtering the result: the
    // column is never read, hence never transported.
    expect(r.sql).not.toContain('montant')
    for (const row of r.rows) {
      expect(Object.hasOwn(row, 'montant')).toBe(false)
      expect(Object.hasOwn(row, 'numero')).toBe(true)
    }
  })

  it('an actor with no role cannot tell the invisible from the non-existent', async () => {
    const roleless = await createUser('sans_role', [])
    const nonExistent = '018f3c2a-9999-7000-8000-000000000999'

    const onInvisible = listRecords(pools, contextFor(roleless), { tableId })
    const onNonExistent = listRecords(pools, contextFor(roleless), { tableId: nonExistent })

    // Both paths must be indistinguishable from outside: same code, no difference in
    // detail that would betray the table's existence.
    await expect(onInvisible).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
    await expect(onNonExistent).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })
})

describe('SQL builder invariants (§6.2)', () => {
  it('no whole-row form is emitted', async () => {
    const r = await listRecords(pools, admin, { tableId })
    // Comments are stripped first: the mandatory row-predicate marker contains an
    // asterisk, and it is `SELECT *` AS AN EXPRESSION that is forbidden, not the
    // character wherever it sits.
    const code = r.sql.replace(/\/\*[\s\S]*?\*\//g, '')
    // The five banned forms, four of which would escape a search for `SELECT *`.
    for (const banned of ['*', 'to_jsonb', 'row_to_json', 'jsonb_agg', 'COPY']) {
      expect(code, `the form "${banned}" is forbidden`).not.toContain(banned)
    }
  })

  it('the row predicate is emitted in every query (A20)', async () => {
    const r = await listRecords(pools, admin, { tableId })
    // The marker, and not just the predicate: it is what we look for in each statement
    // sent to the `data` pool, and a bare `TRUE` would be indistinguishable from a
    // `TRUE` written for another reason (§4.5).
    expect(r.sql).toContain('/*predicat_lignes:factures*/')
    expect(r.sql).toContain('TRUE')
  })

  it('every projected column is named and quoted', async () => {
    const r = await listRecords(pools, admin, { tableId })
    for (const column of r.columns) {
      expect(r.sql).toContain(`"${column}"`)
    }
  })

  it('cursor pagination is stable on `_id`', async () => {
    const page1 = await listRecords(pools, admin, { tableId, limit: 1 })
    expect(page1.rows).toHaveLength(1)
    expect(page1.nextCursor).not.toBeNull()

    const first = page1.rows[0]._id as string
    const page2 = await listRecords(pools, admin, {
      tableId,
      limit: 1,
      after: page1.nextCursor ?? undefined,
    })
    expect(page2.rows).toHaveLength(1)
    // `_id` is a UUIDv7: orderable and unique, hence no tie to break.
    expect((page2.rows[0]._id as string) > first).toBe(true)
  })

  it('refuses a cursor that is not one, and one minted for another reader', async () => {
    const page = await listRecords(pools, admin, { tableId, limit: 1 })
    const cursor = page.nextCursor
    expect(cursor).not.toBeNull()

    // A raw `_id` is no longer a cursor: §6.2 makes it an encrypted value, which is
    // what keeps business data out of the access logs.
    await expect(
      listRecords(pools, admin, { tableId, limit: 1, after: page.rows[0]._id as string }),
    ).rejects.toMatchObject({ code: 'CURSOR_INVALID' })

    // Bound to its reader: handing it to someone else does not hand over the position.
    const other = await createUser('curieux', [{ action: 'read', scopeKind: 'base', baseId }])
    await expect(
      listRecords(pools, contextFor(other), { tableId, limit: 1, after: cursor ?? undefined }),
    ).rejects.toMatchObject({ code: 'CURSOR_INVALID' })
  })

  it('refuses a cursor whose query has changed', async () => {
    const page = await listRecords(pools, admin, { tableId, limit: 1 })
    expect(page.nextCursor).not.toBeNull()

    // Same reader, same table, another sort: resuming there would silently skip rows,
    // so it is refused rather than served (§6.2).
    await expect(
      listRecords(pools, admin, {
        tableId,
        limit: 1,
        sort: '-_created_at',
        after: page.nextCursor ?? undefined,
      }),
    ).rejects.toMatchObject({ code: 'CURSOR_STALE' })
  })
})
