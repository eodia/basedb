import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLinkField, setDisplayColumn } from '../../src/catalog/links.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { listVisibleBases, projectBase } from '../../src/catalog/projection.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Catalog projection — chapter 08 §9.
 *
 * What is checked here is almost entirely NEGATIVE: not what the description contains,
 * but what it must never contain. A description is the first target of reconnaissance —
 * it is the one place where the whole shape of the data is written down in one go.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
/** Bootstrap actor: instance administrator, sees everything. */
let admin: RequestContext
let crmSchema: string
let rhSchema: string
let clients: { tableId: string; tableName: string; displayFieldId: string }
let invoices: { tableId: string; tableName: string; amountFieldId: string }
let salaries: { tableId: string; tableName: string }
let tenantId: string

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('no error raised')
}

/** Builds an actor holding `read` on the named tables, with some fields hidden. */
async function actorReading(
  email: string,
  tableIds: readonly string[],
  hiddenFieldIds: readonly string[] = [],
): Promise<RequestContext> {
  const userId = await pools.withConnection('catalog', async (exec) => {
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
    for (const tableId of tableIds) {
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
         VALUES ($1, 'table', $2, 'read', $3)`,
        [r.id, tableId, admin.actor.id],
        'insert',
      )
    }
    for (const fieldId of hiddenFieldIds) {
      await exec.query(
        `INSERT INTO _basedb.field_permission (role_id, field_id, access)
         VALUES ($1, $2, 'hidden')`,
        [r.id, fieldId],
        'insert',
      )
    }
    return u.id
  })

  const t = new Date('2026-09-19T12:00:00Z')
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000001a',
    actor: { kind: 'user', id: userId },
    tenantId: TENANT_REF,
    surface: 'rest',
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
    return t
  })
  tenantId = bootstrap.id

  const now = new Date('2026-09-19T12:00:00.000Z')
  admin = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000001b',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const crm = await createBase(pools, admin, { label: 'CRM' })
  crmSchema = crm.schemaName

  const c = await createTable(pools, admin, {
    baseId: crm.baseId,
    label: 'Clients',
    fields: [
      { label: 'Raison sociale', kind: 'short_text', required: true },
      { label: 'Ville', kind: 'short_text' },
    ],
  })
  await setDisplayColumn(pools, admin, { tableId: c.tableId, fieldId: c.fields[0].fieldId })
  clients = { tableId: c.tableId, tableName: c.tableName, displayFieldId: c.fields[0].fieldId }

  const f = await createTable(pools, admin, {
    baseId: crm.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number' },
    ],
  })
  invoices = { tableId: f.tableId, tableName: f.tableName, amountFieldId: f.fields[1].fieldId }
  await createLinkField(pools, admin, {
    tableId: f.tableId,
    targetTableId: c.tableId,
    label: 'Client',
  })

  // A third table nobody but the administrator reads: the control group.
  const s = await createTable(pools, admin, {
    baseId: crm.baseId,
    label: 'Salaires',
    fields: [{ label: 'Montant', kind: 'number' }],
  })
  salaries = { tableId: s.tableId, tableName: s.tableName }

  // A SECOND base, wholly unreadable by the restricted actors: it must not merely come
  // back empty, it must be absent.
  const rh = await createBase(pools, admin, { label: 'RH' })
  rhSchema = rh.schemaName
  await createTable(pools, admin, {
    baseId: rh.baseId,
    label: 'Contrats',
    fields: [{ label: 'Intitulé', kind: 'short_text' }],
  })
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('GET /meta/bases — which bases exist, for whom', () => {
  it('shows the administrator every base', async () => {
    const bases = await listVisibleBases(pools, admin)
    expect(bases.map((b) => b.name).sort()).toEqual([crmSchema, rhSchema].sort())
  })

  it('OMITS a base whose every table is unreadable — absent, not empty', async () => {
    // An empty base in the listing would answer the only question that matters to a
    // reconnaissance: does it exist.
    const reader = await actorReading('crm@basedb.local', [clients.tableId, invoices.tableId])
    const bases = await listVisibleBases(pools, reader)
    expect(bases.map((b) => b.name)).toEqual([crmSchema])
  })

  it('counts only the readable tables', async () => {
    // Three tables exist in CRM; this reader holds `read` on two. A count of three would
    // disclose the existence of `salaires`.
    const reader = await actorReading('compte@basedb.local', [clients.tableId, invoices.tableId])
    const [crm] = await listVisibleBases(pools, reader)
    expect(crm.tableCount).toBe(2)
  })

  it('shows nothing at all to an actor holding no grant', async () => {
    const nobody = await actorReading('personne@basedb.local', [])
    expect(await listVisibleBases(pools, nobody)).toEqual([])
  })
})

describe('GET /meta/bases/{base} — the projected description', () => {
  it('accepts the logical name as well as the identifier', async () => {
    const byName = await projectBase(pools, admin, crmSchema)
    const byId = await projectBase(pools, admin, byName.id)
    // No discriminating prefix is needed: a canonical UUID carries dashes, which the
    // logical-name alphabet forbids. The two namespaces cannot collide.
    expect(byId.name).toBe(byName.name)
  })

  it('answers RESOURCE_NOT_FOUND for an invisible base, as for a non-existent one', async () => {
    const reader = await actorReading('sansrh@basedb.local', [clients.tableId])
    expect(await codeOf(projectBase(pools, reader, rhSchema))).toBe('RESOURCE_NOT_FOUND')
    expect(await codeOf(projectBase(pools, reader, 'b_t4z56fq_inexistante'))).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })

  it('gives the qualified SQL name of each table', async () => {
    const crm = await projectBase(pools, admin, crmSchema)
    const table = crm.tables.find((t) => t.name === clients.tableName)
    expect(table?.sql).toBe(`"${crmSchema}"."${clients.tableName}"`)
  })

  it('omits an unreadable table entirely', async () => {
    const reader = await actorReading('sanssalaire@basedb.local', [
      clients.tableId,
      invoices.tableId,
    ])
    const crm = await projectBase(pools, reader, crmSchema)
    expect(crm.tables.map((t) => t.name)).not.toContain(salaries.tableName)
    expect(crm.tables).toHaveLength(2)
  })

  it('omits a masked field from the description', async () => {
    const reader = await actorReading(
      'sansmontant@basedb.local',
      [clients.tableId, invoices.tableId],
      [invoices.amountFieldId],
    )
    const crm = await projectBase(pools, reader, crmSchema)
    const table = crm.tables.find((t) => t.name === invoices.tableName)
    expect(table?.fields.map((f) => f.name)).not.toContain('montant')
    // Absent from the description means absent from the `sort`, `fields` and `expand`
    // enums too — there is only one list, so they cannot drift apart.
    expect(table?.fields.map((f) => f.name)).toContain('numero')
  })

  it('always describes the system columns, always read-only (A18)', async () => {
    const reader = await actorReading('systeme@basedb.local', [clients.tableId])
    const crm = await projectBase(pools, reader, crmSchema)
    const table = crm.tables[0]
    const system = table.fields.filter((f) => f.system)
    expect(system.map((f) => f.name)).toEqual([
      '_id',
      '_created_at',
      '_updated_at',
      '_created_by',
      '_updated_by',
    ])
    expect(system.every((f) => f.readOnly)).toBe(true)
  })

  it('describes only the verbs the reader holds', async () => {
    const reader = await actorReading('lecture@basedb.local', [clients.tableId])
    const crm = await projectBase(pools, reader, crmSchema)
    // `read` without `create`/`update`/`delete`: only the GETs are described.
    expect(crm.tables[0].actions).toEqual(['read'])
    // And every business field is read-only, since nothing is writable.
    expect(crm.tables[0].fields.every((f) => f.readOnly)).toBe(true)
  })
})

describe('link fields — what a description says about a table one cannot see', () => {
  it('names the target and allows expansion when the target is readable', async () => {
    const reader = await actorReading('lien@basedb.local', [clients.tableId, invoices.tableId])
    const crm = await projectBase(pools, reader, crmSchema)
    const link = crm.tables
      .find((t) => t.name === invoices.tableName)
      ?.fields.find((f) => f.link !== undefined)

    expect(link?.link?.target?.table).toBe(clients.tableName)
    expect(link?.link?.target?.displayField).toBe('raison_sociale')
    expect(link?.link?.expandable).toBe(true)
    expect(link?.link?.masked).toBe(false)
    expect(link?.link?.onDelete).toBe('restrict')
  })

  it('keeps the field but SAYS NOTHING of a target it cannot see', async () => {
    // The field belongs to a table the reader can read, so hiding it would lie about
    // the table's shape. But the target's name would disclose a table that, for this
    // reader, does not exist.
    const reader = await actorReading('sansclients@basedb.local', [invoices.tableId])
    const crm = await projectBase(pools, reader, crmSchema)
    const link = crm.tables
      .find((t) => t.name === invoices.tableName)
      ?.fields.find((f) => f.link !== undefined)

    expect(link).toBeDefined()
    expect(link?.link?.target).toBeUndefined()
    // Not in the `expand` enum: expanding it would be refused anyway (05 §5.4), and
    // offering it would confirm there is something to expand.
    expect(link?.link?.expandable).toBe(false)
    expect(link?.link?.masked).toBe(true)
    // What remains is what belongs to the readable table itself: its own constraint.
    expect(link?.link?.onDelete).toBe('restrict')
  })

  it('withholds the display column when THAT field is masked', async () => {
    const reader = await actorReading(
      'sansraison@basedb.local',
      [clients.tableId, invoices.tableId],
      [clients.displayFieldId],
    )
    const crm = await projectBase(pools, reader, crmSchema)
    const link = crm.tables
      .find((t) => t.name === invoices.tableName)
      ?.fields.find((f) => f.link !== undefined)

    // The target stays named — the table is readable — but announcing its display column
    // would name a field this reader cannot see.
    expect(link?.link?.target?.table).toBe(clients.tableName)
    expect(link?.link?.target?.displayField).toBeNull()
  })
})

describe('referenced_by — a path described only when there is something to show', () => {
  it('announces the path when a readable table references this one', async () => {
    const reader = await actorReading('inverse@basedb.local', [clients.tableId, invoices.tableId])
    const crm = await projectBase(pools, reader, crmSchema)
    expect(crm.tables.find((t) => t.name === clients.tableName)?.referencedBy).toBe(true)
  })

  it('does NOT announce it when the only referencing table is unreadable', async () => {
    // The path would return an empty list — and that emptiness would itself say that
    // something references this row from a table the reader cannot see.
    const reader = await actorReading('sansfactures@basedb.local', [clients.tableId])
    const crm = await projectBase(pools, reader, crmSchema)
    expect(crm.tables.find((t) => t.name === clients.tableName)?.referencedBy).toBe(false)
  })

  it('is false on a table nothing references', async () => {
    const crm = await projectBase(pools, admin, crmSchema)
    expect(crm.tables.find((t) => t.name === invoices.tableName)?.referencedBy).toBe(false)
  })
})
