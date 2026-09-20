import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readVersions } from '../../src/catalog/cache.js'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { projectBase } from '../../src/catalog/projection.js'
import { serveMeta } from '../../src/catalog/serve.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Catalog and authorization cache — chapter 02 § "Schema loading", chapter 05 §7.2,
 * chapter 08 §9.2.
 *
 * The caches are NEVER cleared by hand here. That is the point: what must be proven is
 * that the two counters do the invalidating, not that a test can reach in and empty a
 * map. A cache that only ever refreshes because someone flushed it is not a cache, it is
 * a bug waiting for production.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext
let tenantId: string
let baseId: string
let baseName: string
let clientsTableId: string

async function actorReadingClients(email: string): Promise<{
  ctx: RequestContext
  roleId: string
  permissionId: string
}> {
  const made = await pools.withConnection('catalog', async (exec) => {
    const [u] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
       VALUES ($1, $2, $2, $3, $3) RETURNING id`,
      [tenantId, email, admin.actor.id],
      'insert',
    )
    const [r] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
       VALUES ($1, $2, $2, $2, $3) RETURNING id`,
      [tenantId, email.split('@')[0], admin.actor.id],
      'insert',
    )
    await exec.query(
      'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
      [r.id, u.id, admin.actor.id],
      'insert',
    )
    const [p] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
       VALUES ($1, 'table', $2, 'read', $3) RETURNING id`,
      [r.id, clientsTableId, admin.actor.id],
      'insert',
    )
    return { userId: u.id, roleId: r.id, permissionId: p.id }
  })

  const t = new Date('2026-09-19T12:00:00Z')
  return {
    ctx: sealContext({
      requestId: '018f3c2a-0000-7000-8000-00000000003a',
      actor: { kind: 'user', id: made.userId },
      tenantId: TENANT_REF,
      surface: 'rest',
      timestamp: t,
      deadline: new Date(t.getTime() + 120_000),
      permissions: { version: '1', rowPredicate: 'TRUE' },
    }),
    roleId: made.roleId,
    permissionId: made.permissionId,
  }
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
  tenantId = bootstrap.id

  const now = new Date('2026-09-19T12:00:00.000Z')
  admin = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000003b',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, admin, { label: 'CRM' })
  baseId = base.baseId
  baseName = base.schemaName

  const c = await createTable(pools, admin, {
    baseId: base.baseId,
    label: 'Clients',
    fields: [{ label: 'Raison sociale', kind: 'short_text', required: true }],
  })
  clientsTableId = c.tableId
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

/** Reads the two counters as the cache does. */
async function versions() {
  const v = await pools.withConnection('catalog', (exec) => readVersions(exec, TENANT_REF))
  if (v === null) throw new Error('tenant introuvable')
  return v
}

describe('the counters, kept by triggers', () => {
  it('moves catalog_version when a table is created', async () => {
    const before = await versions()
    await createTable(pools, admin, {
      baseId,
      label: 'Produits',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    const after = await versions()
    expect(after.catalog).not.toBe(before.catalog)
    // A structure change is not an authorization change.
    expect(after.authz).toBe(before.authz)
  })

  it('moves authz_version on a write made in DIRECT SQL', async () => {
    // The whole reason the counter is kept by a trigger: the product's promise is that
    // one writes in SQL, so a counter maintained by the application would be wrong from
    // the first `INSERT` that went around it.
    const before = await versions()
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
         VALUES ($1, 'Direct', 'direct', 'direct', $2)`,
        [tenantId, admin.actor.id],
        'insert',
      ),
    )
    const after = await versions()
    expect(after.authz).toBeGreaterThan(before.authz)
  })

  it('moves when an OPTION of a select is renamed', async () => {
    // Found by looking at the screen: renaming an option left the cache serving the old
    // label until something else happened to move the counter. Everything the projection
    // READS must advance the version, and the option list is read.
    const base = await createBase(pools, admin, { label: 'Choix' })
    const table = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Suivis',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    const field = await addField(pools, admin, {
      tableId: table.tableId,
      label: 'Statut',
      kind: 'select',
      options: [{ value: 'a_faire', label: 'A faire' }],
    })

    const before = await versions()
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.select_option SET label = 'À faire' WHERE field_id = $1`,
        [field.fieldId],
        'update',
      ),
    )
    expect((await versions()).catalog).not.toBe(before.catalog)

    // And the description follows, without anyone flushing anything.
    const described = await projectBase(pools, admin, base.schemaName)
    const statut = described.tables
      .find((t) => t.name === table.tableName)
      ?.fields.find((f) => f.name === 'statut')
    expect(statut?.options?.[0].label).toBe('À faire')
  }, 120_000)

  it('notices a base being dropped, which a maximum would not', async () => {
    const other = await createBase(pools, admin, { label: 'Éphémère' })
    const withBase = await versions()
    await pools.withConnection('catalog', (exec) =>
      // `ck_base_live` ties the two: a base is live exactly while it is not deleted.
      // Flipping one without the other is refused by the catalog, which is the point.
      exec.query(
        `UPDATE _basedb.base SET is_live = false, deleted_at = clock_timestamp(), deleted_by = $2
          WHERE id = $1`,
        [other.baseId, admin.actor.id],
        'update',
      ),
    )
    const without = await versions()
    // The fingerprint spans every live base: a `max(catalog_version)` would have stayed
    // put, and the cache would have described a base that no longer exists.
    expect(without.catalog).not.toBe(withBase.catalog)
  })
})

describe('§05 — a revocation closes the description as fast as it closes the data', () => {
  it('drops a table from the description the moment its permission is removed', async () => {
    const reader = await actorReadingClients('revoque@basedb.local')

    // First read: the table is there, and lands in the cache.
    const before = await projectBase(pools, reader.ctx, baseName)
    expect(before.tables.map((t) => t.name)).toEqual(['clients'])

    await pools.withConnection('catalog', (exec) =>
      exec.query('DELETE FROM _basedb.permission WHERE id = $1', [reader.permissionId], 'delete'),
    )

    // Second read, no cache flush anywhere: the base itself disappears, since it no
    // longer holds a single readable table. A key based on `catalog_version` alone would
    // have kept describing a table whose access was just withdrawn.
    await expect(projectBase(pools, reader.ctx, baseName)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    })
  })

  it('opens a table in the description the moment a permission is granted', async () => {
    const reader = await actorReadingClients('ajout@basedb.local')
    const before = await projectBase(pools, reader.ctx, baseName)
    expect(before.tables).toHaveLength(1)

    const [produits] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `SELECT t.id FROM _basedb.table_def t
           JOIN _basedb.physical_name n ON n.id = t.name_id
          WHERE n.name = 'produits'`,
      ),
    )
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
         VALUES ($1, 'table', $2, 'read', $3)`,
        [reader.roleId, produits.id, admin.actor.id],
        'insert',
      ),
    )

    const after = await projectBase(pools, reader.ctx, baseName)
    expect(after.tables.map((t) => t.name).sort()).toEqual(['clients', 'produits'])
  })
})

describe('§08 §9.2 — the validator', () => {
  it('does not move while nothing moves', async () => {
    const first = await serveMeta(pools, admin, 'meta', baseName)
    const second = await serveMeta(pools, admin, 'meta', baseName)
    expect(second.etag).toBe(first.etag)
    expect(second.body).toEqual(first.body)
  })

  it('answers 304 WITHOUT building the document', async () => {
    const first = await serveMeta(pools, admin, 'meta', baseName)
    const revalidated = await serveMeta(pools, admin, 'meta', baseName, first.etag)

    expect(revalidated.notModified).toBe(true)
    // Nothing was serialized: that is the property the chapter asks for, and the only
    // observable proof of it from here.
    expect(revalidated.body).toBeUndefined()
    expect(revalidated.bytes).toBe(0)
  })

  it('accepts a weakened validator and a list, as a proxy may send them', async () => {
    const first = await serveMeta(pools, admin, 'meta', baseName)
    const weak = await serveMeta(pools, admin, 'meta', baseName, `W/${first.etag}`)
    expect(weak.notModified).toBe(true)

    const list = await serveMeta(pools, admin, 'meta', baseName, `"autre", ${first.etag}`)
    expect(list.notModified).toBe(true)
  })

  it('moves when the structure changes', async () => {
    const before = await serveMeta(pools, admin, 'meta', baseName)
    await createTable(pools, admin, {
      baseId,
      label: 'Commandes',
      fields: [{ label: 'Référence', kind: 'short_text' }],
    })
    const after = await serveMeta(pools, admin, 'meta', baseName)
    expect(after.etag).not.toBe(before.etag)
    // And the old validator no longer validates.
    const stale = await serveMeta(pools, admin, 'meta', baseName, before.etag)
    expect(stale.notModified).toBe(false)
  })

  it('differs between two readers of the same base', async () => {
    // The rights fingerprint enters the `ETag` so that a copy kept by one actor can
    // never be validated for another — otherwise the narrower of the two would
    // revalidate into the wider one's document.
    const reader = await actorReadingClients('distinct@basedb.local')
    const ofAdmin = await serveMeta(pools, admin, 'meta', baseName)
    const ofReader = await serveMeta(pools, reader.ctx, 'meta', baseName)
    expect(ofReader.etag).not.toBe(ofAdmin.etag)
  })

  it('gives the three serializations three distinct validators', async () => {
    // Same base, same rights, three documents behind three URLs: one shared validator
    // would let a client revalidate an OpenAPI document into a documentation one.
    const [meta, openapi, doc] = await Promise.all([
      serveMeta(pools, admin, 'meta', baseName),
      serveMeta(pools, admin, 'openapi', baseName),
      serveMeta(pools, admin, 'doc', baseName),
    ])
    expect(new Set([meta.etag, openapi.etag, doc.etag]).size).toBe(3)
  })
})
