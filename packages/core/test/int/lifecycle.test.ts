import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  deleteBase,
  deleteTable,
  listDeletedBases,
  previewTableDeletion,
  renameBaseLabel,
  restoreBase,
} from '../../src/catalog/lifecycle.js'
import { createLinkField } from '../../src/catalog/links.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Lifecycle of a base — chapter 06, end to end against a real PostgreSQL.
 *
 * The point of running these against a container rather than a mock is that most of the
 * chapter's rules are enforced BY THE DATABASE: `ck_table_base_live` refuses a dead base
 * under a live table, `ck_link_target_live` refuses a dead target under a live link,
 * `uq_physical_name` refuses a name to be reused. A plan that got the order wrong would
 * pass a mocked test and fail here, which is the whole reason the constraints exist.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext
let tenantId: string

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

/** A base with two tables and a real foreign key between them. */
async function makeBase(label: string): Promise<{
  baseId: string
  schemaName: string
  clients: string
  invoices: string
}> {
  const base = await createBase(pools, admin, { label })
  const clients = await createTable(pools, admin, {
    baseId: base.baseId,
    label: 'Clients',
    fields: [{ label: 'Raison sociale', kind: 'short_text', required: true }],
  })
  const invoices = await createTable(pools, admin, {
    baseId: base.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number' },
    ],
  })
  await createLinkField(pools, admin, {
    tableId: invoices.tableId,
    label: 'Client',
    targetTableId: clients.tableId,
  })

  await pools.withConnection('data', (exec) =>
    exec.query(
      `INSERT INTO "${base.schemaName}"."${clients.tableName}" ("raison_sociale")
       VALUES ('Dupont SARL'), ('ACME')`,
      [],
      'insert',
    ),
  )

  return {
    baseId: base.baseId,
    schemaName: base.schemaName,
    clients: clients.tableName,
    invoices: invoices.tableName,
  }
}

/** The catalog identifier of a table, by its label. */
async function tableIdOf(baseId: string, label: string): Promise<string> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      'SELECT id FROM _basedb.table_def WHERE base_id = $1 AND label = $2 AND deleted_at IS NULL',
      [baseId, label],
    ),
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error(`table introuvable : ${label}`)
  return id
}

/** Reads a schema's presence straight from `pg_namespace`, bypassing the catalog. */
async function schemaExists(name: string): Promise<boolean> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{ n: string }>('SELECT count(*) AS n FROM pg_namespace WHERE nspname = $1', [name]),
  )
  return Number(rows[0]?.n ?? 0) > 0
}

async function currentSchemaOf(baseId: string): Promise<string> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{ name: string }>(
      `SELECT n.name FROM _basedb.db_schema s
         JOIN _basedb.physical_name n ON n.id = s.name_id
        WHERE s.base_id = $1 AND s.role = 'current' AND s.dropped_at IS NULL`,
      [baseId],
    ),
  )
  return rows[0]?.name ?? ''
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
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('§1.1 — renaming a label', () => {
  it('changes one catalog row and leaves the schema alone', async () => {
    const base = await makeBase('Ventes')
    const before = await currentSchemaOf(base.baseId)

    const result = await renameBaseLabel(pools, admin, { baseId: base.baseId, label: 'Commerce' })

    expect(result.label).toBe('Commerce')
    // The physical name has NOT moved: that is the whole point of two registers, and
    // every SQL consumer's query keeps working.
    expect(await currentSchemaOf(base.baseId)).toBe(before)
    expect(await schemaExists(before)).toBe(true)
  })

  it('refuses an empty label, and a label another live base already holds', async () => {
    const base = await makeBase('Comptabilité')

    await expect(
      renameBaseLabel(pools, admin, { baseId: base.baseId, label: '   ' }),
    ).rejects.toMatchObject({ code: 'LABEL_EMPTY' })

    await expect(
      renameBaseLabel(pools, admin, { baseId: base.baseId, label: 'Commerce' }),
    ).rejects.toMatchObject({ code: 'LABEL_DUPLICATE' })
  })
})

describe('§4.3 — logical deletion', () => {
  it('runs the whole plan and renames the schema with the marker', async () => {
    const base = await makeBase('Stocks')
    const schema = await currentSchemaOf(base.baseId)

    const migration = await deleteBase(pools, admin, { baseId: base.baseId })

    expect(migration.status).toBe('applied')
    expect(migration.stepCount).toBeGreaterThan(1)
    // Every step ran: the counter is written back between two of them, so a plan that
    // stopped early would leave it short.
    expect(migration.step).toBe(migration.stepCount)

    const relegated = await currentSchemaOf(base.baseId)
    expect(relegated).not.toBe(schema)
    // The marker comes AFTER the positional prefix (chapter 01 §9.5), so an operations
    // tool enumerating a tenant's schemas keeps working.
    expect(relegated.startsWith(`b_${TENANT_REF}_zz_supprime_20260918_`)).toBe(true)
    expect(await schemaExists(schema)).toBe(false)
    expect(await schemaExists(relegated)).toBe(true)
  })

  it('destroys nothing: the rows are still there, and readable in direct SQL', async () => {
    const base = await makeBase('Archives')
    await deleteBase(pools, admin, { baseId: base.baseId })
    const relegated = await currentSchemaOf(base.baseId)

    const tables = await pools.withConnection('catalog', (exec) =>
      exec.query<{ name: string }>(
        `SELECT n.name FROM _basedb.table_def t
           JOIN _basedb.physical_name n ON n.id = t.name_id
          WHERE t.base_id = $1 AND n.name LIKE 'zz_supprime_%'`,
        [base.baseId],
      ),
    )
    expect(tables).toHaveLength(2)

    // §4.4: "Données de la colonne ou de la table : conservées, ET LISIBLES EN SQL
    // DIRECT." Read without the product, under the relegated name.
    const relegatedClients = tables.map((t) => t.name).find((n) => n.endsWith('clients'))
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ raison_sociale: string }>(
        `SELECT "raison_sociale" FROM "${relegated}"."${relegatedClients}" ORDER BY 1`,
      ),
    )
    expect(rows.map((r) => r.raison_sociale)).toEqual(['ACME', 'Dupont SARL'])
  })

  it('frees the label immediately, and never the physical name', async () => {
    const base = await makeBase('Éphémère')
    const schema = await currentSchemaOf(base.baseId)
    await deleteBase(pools, admin, { baseId: base.baseId })

    // The label comes back at once: `uq_base_label_live` is partial on `deleted_at`.
    const again = await createBase(pools, admin, { label: 'Éphémère' })
    expect(again.schemaName).not.toBe(schema)

    // The name does not: `uq_physical_name` is not partial, so nothing releases one.
    const taken = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string }>('SELECT count(*) AS n FROM _basedb.physical_name WHERE name = $1', [
        schema,
      ]),
    )
    expect(Number(taken[0]?.n)).toBe(1)
  })

  it('takes the base out of the listing, and puts it in the deleted one', async () => {
    const base = await makeBase('Passagère')
    await deleteBase(pools, admin, { baseId: base.baseId })

    const deleted = await listDeletedBases(pools, admin)
    expect(deleted.map((b) => b.label)).toContain('Passagère')
  })

  it('refuses to delete a base twice', async () => {
    const base = await makeBase('Doublon')
    await deleteBase(pools, admin, { baseId: base.baseId })
    await expect(deleteBase(pools, admin, { baseId: base.baseId })).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    })
  })
})

describe('§6 — restoration', () => {
  it('brings the base back, with its rows, under a fresh name', async () => {
    const base = await makeBase('Reprise')
    await deleteBase(pools, admin, { baseId: base.baseId })
    const relegated = await currentSchemaOf(base.baseId)

    const migration = await restoreBase(pools, admin, { baseId: base.baseId })
    expect(migration.status).toBe('applied')

    const restored = await currentSchemaOf(base.baseId)
    expect(restored).not.toBe(relegated)
    expect(restored.includes('zz_supprime_')).toBe(false)
    expect(await schemaExists(restored)).toBe(true)

    const live = await pools.withConnection('catalog', (exec) =>
      exec.query<{ label: string; name: string }>(
        `SELECT t.label, n.name FROM _basedb.table_def t
           JOIN _basedb.physical_name n ON n.id = t.name_id
          WHERE t.base_id = $1 AND t.deleted_at IS NULL
          ORDER BY t.position`,
        [base.baseId],
      ),
    )
    expect(live.map((t) => t.label)).toEqual(['Clients', 'Factures'])
    // The name is not given back — it is `retired` — so the table returns under a
    // freshly allocated one. That is §4.4's "le plus strict gagne".
    expect(live.every((t) => !t.name.startsWith('zz_supprime_'))).toBe(true)

    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ raison_sociale: string }>(
        `SELECT "raison_sociale" FROM "${restored}"."${live[0]?.name}" ORDER BY 1`,
      ),
    )
    expect(rows.map((r) => r.raison_sociale)).toEqual(['ACME', 'Dupont SARL'])

    // The fields come back live too: the cascade is undone, not just the table row.
    const fields = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string }>(
        `SELECT count(*) AS n FROM _basedb.field f
           JOIN _basedb.table_def t ON t.id = f.table_id
          WHERE t.base_id = $1 AND f.deleted_at IS NULL`,
        [base.baseId],
      ),
    )
    expect(Number(fields[0]?.n)).toBeGreaterThan(0)
  })

  it('refuses to restore a base that was never deleted', async () => {
    const base = await makeBase('Vivante')
    await expect(restoreBase(pools, admin, { baseId: base.baseId })).rejects.toMatchObject({
      code: 'RESTORE_TARGET_MISSING',
    })
  })

  it('refuses when the label was taken back meanwhile', async () => {
    const base = await makeBase('Reprise contrariée')
    await deleteBase(pools, admin, { baseId: base.baseId })
    await createBase(pools, admin, { label: 'Reprise contrariée' })

    await expect(restoreBase(pools, admin, { baseId: base.baseId })).rejects.toMatchObject({
      code: 'LABEL_DUPLICATE',
    })
  })
})

describe('§1.2 — the administration role', () => {
  it('refuses a logical deletion to a `manage_schema` of base scope', async () => {
    const base = await makeBase('Gardée')

    const userId = await pools.withConnection('catalog', async (exec) => {
      const [u] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
         VALUES ($1, 'schema@basedb.local', 'Schéma', $2, $2) RETURNING id`,
        [tenantId, admin.actor.id],
        'insert',
      )
      const [r] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
         VALUES ($1, 'schema', 'schema', 'schema', $2) RETURNING id`,
        [tenantId, admin.actor.id],
        'insert',
      )
      await exec.query(
        'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
        [r.id, u.id, admin.actor.id],
        'insert',
      )
      // `read` with it: without reading a base, no other verb reaches it (05 §3.2, step 9).
      for (const action of ['read', 'manage_schema']) {
        await exec.query(
          `INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
           VALUES ($1, 'base', $2, $3, $4)`,
          [r.id, base.baseId, action, admin.actor.id],
          'insert',
        )
      }
      return u.id
    })

    const limited = contextFor(userId)

    // A lower-scope `manage_schema` may create and modify; it never drops an alias nor
    // renames physically, and the deletion plan does both (§1.2).
    await expect(deleteBase(pools, limited, { baseId: base.baseId })).rejects.toMatchObject({
      code: 'ADMIN_REQUIRED',
    })

    // But it may rename the label, which is not a migration at all.
    await expect(
      renameBaseLabel(pools, limited, { baseId: base.baseId, label: 'Gardée bis' }),
    ).resolves.toMatchObject({ label: 'Gardée bis' })
  })
})

describe('§4.2 — deleting one table', () => {
  it('refuses while a live link still aims at it, and names the culprit', async () => {
    const base = await makeBase('Liée')
    const clients = await tableIdOf(base.baseId, 'Clients')

    // `ck_link_target_live` would refuse it anyway; the point is that the refusal is
    // named and says WHICH link stands in the way.
    await expect(deleteTable(pools, admin, { tableId: clients })).rejects.toMatchObject({
      code: 'TABLE_REFERENCED',
    })
  })

  it('relegates the table that BEARS the link, and keeps its rows', async () => {
    const base = await makeBase('Portante')
    const invoices = await tableIdOf(base.baseId, 'Factures')

    await pools.withConnection('data', (exec) =>
      exec.query(
        `INSERT INTO "${base.schemaName}"."${base.invoices}" ("numero") VALUES ('F-1'), ('F-2')`,
        [],
        'insert',
      ),
    )

    const migration = await deleteTable(pools, admin, { tableId: invoices })
    expect(migration.status).toBe('applied')

    // Out of the catalog…
    const live = await pools.withConnection('catalog', (exec) =>
      exec.query<{ label: string }>(
        'SELECT label FROM _basedb.table_def WHERE base_id = $1 AND deleted_at IS NULL',
        [base.baseId],
      ),
    )
    expect(live.map((t) => t.label)).toEqual(['Clients'])

    // …and its fields with it: `ck_field_table_live` forbids a live field under a dead
    // table, so the cascade is not optional.
    const fields = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string }>(
        `SELECT count(*) AS n FROM _basedb.field
          WHERE table_id = $1 AND deleted_at IS NULL`,
        [invoices],
      ),
    )
    expect(Number(fields[0]?.n)).toBe(0)

    // …but the rows are still there, under the relegated name (§4.4).
    const [relegated] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ name: string }>(
        `SELECT n.name FROM _basedb.table_def t
           JOIN _basedb.physical_name n ON n.id = t.name_id
          WHERE t.id = $1`,
        [invoices],
      ),
    )
    expect(relegated?.name.startsWith('zz_supprime_')).toBe(true)

    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ numero: string }>(
        `SELECT "numero" FROM "${base.schemaName}"."${relegated?.name}" ORDER BY 1`,
      ),
    )
    expect(rows.map((r) => r.numero)).toEqual(['F-1', 'F-2'])

    // The foreign key it bore is gone, and the catalog says so rather than implying it.
    const links = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string }>(
        `SELECT count(*) AS n FROM _basedb.field_link_config lc
           JOIN _basedb.field f ON f.id = lc.field_id
          WHERE f.table_id = $1 AND lc.fk_dropped_at IS NULL`,
        [invoices],
      ),
    )
    expect(Number(links[0]?.n)).toBe(0)
  })

  it('frees the label, and hands a recreated table a fresh physical name', async () => {
    const base = await makeBase('Recyclée')
    const invoices = await tableIdOf(base.baseId, 'Factures')
    await deleteTable(pools, admin, { tableId: invoices })

    const again = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })
    // The label came back at once; the name did not — `uq_physical_name` is not partial.
    expect(again.tableName).not.toBe(base.invoices)
    expect(again.tableName.startsWith('factures')).toBe(true)
  })

  it('tells the confirmation screen what it will lock, before it locks it', async () => {
    const base = await makeBase('Annoncée')
    const invoices = await tableIdOf(base.baseId, 'Factures')

    const preview = await previewTableDeletion(pools, admin, invoices)
    expect(preview.label).toBe('Factures')
    expect(preview.referencedBy).toEqual([])
    // §4.2: dropping a foreign key takes `ACCESS EXCLUSIVE` on the referenced table too,
    // and the screen names it.
    expect(preview.lockedTables).toEqual(['Clients'])
    expect(preview.relegatedName.startsWith('zz_supprime_')).toBe(true)

    const clients = await tableIdOf(base.baseId, 'Clients')
    const blocked = await previewTableDeletion(pools, admin, clients)
    expect(blocked.referencedBy).toEqual(['Factures.Client'])
  })
})
