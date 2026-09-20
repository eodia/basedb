import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLinkField, setDisplayColumn } from '../../src/catalog/links.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { listInverseLinks } from '../../src/records/inverse-links.js'
import { listRecords } from '../../src/records/list.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Expansion and inverse links — chapter 08 §5, chapter 04 §6.
 *
 * What is checked here is not that the data comes back, but that it comes back
 * DEDUPLICATED and BOUNDED: `included` is the mechanism that prevents 100 invoices
 * pointing at 3 clients from carrying 100 objects, and the bounds are what keeps a
 * detail view from firing sixty queries.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let schemaName: string
let clients: { tableId: string; tableName: string }
let invoices: { tableId: string; tableName: string }
let dupontId: string

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('no error raised')
}

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

  const now = new Date('2026-09-19T12:00:00.000Z')
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000000f',
    actor: { kind: 'user', id: actor },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'CRM' })
  schemaName = base.schemaName

  const c = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Clients',
    fields: [
      { label: 'Raison sociale', kind: 'short_text', required: true },
      { label: 'Ville', kind: 'short_text' },
      { label: 'Siret', kind: 'short_text' },
    ],
  })
  clients = { tableId: c.tableId, tableName: c.tableName }
  await setDisplayColumn(pools, ctx, { tableId: c.tableId, fieldId: c.fields[0].fieldId })

  const f = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number' },
    ],
  })
  invoices = { tableId: f.tableId, tableName: f.tableName }

  await createLinkField(pools, ctx, {
    tableId: f.tableId,
    targetTableId: c.tableId,
    label: 'Client',
  })

  // Three clients, six invoices — four of them pointing at the same client. That
  // asymmetry is what makes deduplication observable.
  const inserted = await pools.withConnection('data', (exec) =>
    exec.query<{ _id: string; raison_sociale: string }>(
      `INSERT INTO "${schemaName}"."${clients.tableName}" ("raison_sociale", "ville", "siret")
       VALUES ('Dupont SARL', 'Lyon', '111'), ('ACME', 'Paris', '222'),
              ('École du Nord', 'Lille', '333')
       RETURNING "_id", "raison_sociale"`,
      [],
      'insert',
    ),
  )
  dupontId = inserted.find((r) => r.raison_sociale === 'Dupont SARL')?._id ?? ''
  const acmeId = inserted.find((r) => r.raison_sociale === 'ACME')?._id ?? ''

  await pools.withConnection('data', (exec) =>
    exec.query(
      `INSERT INTO "${schemaName}"."${invoices.tableName}" ("numero", "montant", "clients_id")
       VALUES ('F-001', 100, $1), ('F-002', 200, $1), ('F-003', 300, $1), ('F-004', 400, $1),
              ('F-005', 500, $2), ('F-006', 600, NULL)`,
      [dupontId, acmeId],
      'insert',
    ),
  )
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('?expand= — a dedicated annex section', () => {
  it('returns the linked object in `included`, not nested in the row', async () => {
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      expand: 'clients_id',
      sort: 'numero',
    })

    // The shape of `clients_id` stays `{id, display}` whether `expand` is present or
    // not: one single OpenAPI schema per table.
    expect(r.rows[0].clients_id).toMatchObject({ id: dupontId, display: 'Dupont SARL' })
    expect(r.included.clients?.[dupontId]).toMatchObject({ raison_sociale: 'Dupont SARL' })
  })

  it('DEDUPLICATES: six invoices pointing at two clients carry two objects', async () => {
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      expand: 'clients_id',
    })
    expect(r.rows).toHaveLength(6)
    // This is the whole point of the annex section: nesting would have carried five.
    expect(Object.keys(r.included.clients ?? {})).toHaveLength(2)
  })

  it('returns every readable field of the target by default', async () => {
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      expand: 'clients_id',
    })
    const client = r.included.clients?.[dupontId] ?? {}
    // A direct read, since the display column alone is already in the source row
    // without expansion: an expansion returning only id + display would add nothing.
    expect(Object.keys(client).sort()).toEqual(['_id', 'raison_sociale', 'siret', 'ville'])
  })

  it('restricts to the named fields, always adding `_id` and the display column', async () => {
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      expand: 'clients_id(ville)',
    })
    const client = r.included.clients?.[dupontId] ?? {}
    expect(Object.keys(client).sort()).toEqual(['_id', 'raison_sociale', 'ville'])
    expect(client.ville).toBe('Lyon')
    // `siret` was not asked for: it is not read, hence not transported.
    expect(Object.hasOwn(client, 'siret')).toBe(false)
  })

  it('keeps ONE query per target table, expansion included', async () => {
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      expand: 'clients_id',
    })
    // `1 + T`: expanding widens the projection, it does not add a round trip.
    expect(r.linkSql).toHaveLength(1)
    expect(r.linkSql[0]).toContain('= ANY($1::uuid[])')
  })

  it('leaves `included` empty without `expand`', async () => {
    const r = await listRecords(pools, ctx, { tableId: invoices.tableId })
    expect(r.included).toEqual({})
    // The link value is unchanged: that is the schema stability the annex buys.
    expect(r.rows.find((row) => row.numero === 'F-001')?.clients_id).toMatchObject({
      display: 'Dupont SARL',
    })
  })

  it('caps the page at 100 rows as soon as `expand` is present', async () => {
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      expand: 'clients_id',
      limit: 500,
    })
    // The cost of a page is no longer its own rows alone but the target rows it drags
    // along.
    expect(r.sql).toContain('LIMIT 101')
  })

  it('refuses a depth-2 path', async () => {
    expect(
      await codeOf(
        listRecords(pools, ctx, {
          tableId: invoices.tableId,
          expand: 'clients_id.societe_mere_id',
        }),
      ),
    ).toBe('EXPAND_TOO_DEEP')
  })

  it('refuses expanding a readable column that is not a link', async () => {
    // `numero` is perfectly visible: the refusal says the expansion is impossible, not
    // that the field is unknown — which would be a lie the caller can disprove.
    expect(
      await codeOf(listRecords(pools, ctx, { tableId: invoices.tableId, expand: 'numero' })),
    ).toBe('EXPAND_UNAVAILABLE')
  })

  it('answers UNKNOWN FIELD, not "not expandable", for a column that does not exist', async () => {
    // The boundary between the two codes is what does not leak: `EXPAND_UNAVAILABLE` is
    // only ever returned for a column the reader can ALREADY see, so it confirms nothing.
    expect(
      await codeOf(listRecords(pools, ctx, { tableId: invoices.tableId, expand: 'inexistant' })),
    ).toBe('FILTER_FIELD_UNKNOWN')
  })

  it('refuses more than five expanded fields', async () => {
    const tooMany = ['a', 'b', 'c', 'd', 'e', 'f'].join(',')
    expect(
      await codeOf(listRecords(pools, ctx, { tableId: invoices.tableId, expand: tooMany })),
    ).toBe('EXPAND_TOO_WIDE')
  })

  it('refuses combining `expand` with `links=id`', async () => {
    // Expanding requires reading the target rows, which is exactly what `links=id`
    // exists to avoid. Silently ignoring one of the two would be worse.
    expect(
      await codeOf(
        listRecords(pools, ctx, {
          tableId: invoices.tableId,
          expand: 'clients_id',
          links: 'id',
        }),
      ),
    ).toBe('REQUEST_INVALID')
  })
})

describe('inverse links — chapter 04 §6', () => {
  it('lists the rows referencing a given row', async () => {
    const r = await listInverseLinks(pools, ctx, {
      tableId: clients.tableId,
      recordId: dupontId,
    })

    expect(r.blocks).toHaveLength(1)
    const [block] = r.blocks
    // The label is computed on read: `<source table label> · <field label>`.
    expect(block.label).toBe('Factures · Client')
    expect(block.count).toBe(4)
    expect(block.capped).toBe(false)
  })

  it('sorts `_id` DESC — most recent first, with no extra column', async () => {
    const r = await listInverseLinks(pools, ctx, {
      tableId: clients.tableId,
      recordId: dupontId,
    })
    const ids = r.blocks[0].rows.map((row) => row.id)
    expect([...ids].sort().reverse()).toEqual(ids)
    expect(r.sql.some((s) => s.includes('ORDER BY "_id" DESC'))).toBe(true)
  })

  it('caps the count rather than counting exactly', async () => {
    // An exact `count(*)` on a large source table would cost more than the rest of the
    // page put together.
    const r = await listInverseLinks(pools, ctx, {
      tableId: clients.tableId,
      recordId: dupontId,
    })
    expect(r.sql.some((s) => s.includes('LIMIT 501'))).toBe(true)
  })

  it('carries the row predicate of the source table', async () => {
    const r = await listInverseLinks(pools, ctx, {
      tableId: clients.tableId,
      recordId: dupontId,
    })
    for (const query of r.sql) expect(query).toContain('predicat_lignes')
  })

  it('returns an empty block list for a row nobody references', async () => {
    const [orphan] = await pools.withConnection('data', (exec) =>
      exec.query<{ _id: string }>(
        `INSERT INTO "${schemaName}"."${clients.tableName}" ("raison_sociale")
         VALUES ('Sans facture') RETURNING "_id"`,
        [],
        'insert',
      ),
    )
    const r = await listInverseLinks(pools, ctx, {
      tableId: clients.tableId,
      recordId: orphan._id,
    })
    // The block exists — the link field does — but it is empty.
    expect(r.blocks[0].rows).toEqual([])
    expect(r.blocks[0].count).toBe(0)
  })

  it('refuses a row whose own table is unreadable', async () => {
    expect(
      await codeOf(
        listInverseLinks(pools, ctx, {
          tableId: '018f3c2a-9999-7000-8000-000000000999',
          recordId: dupontId,
        }),
      ),
    ).toBe('RESOURCE_NOT_FOUND')
  })
})

describe('permissions — what expansion must not leak', () => {
  /** An actor who can read `factures`, but NOT `clients`. */
  async function partialReader(): Promise<RequestContext> {
    const userId = await pools.withConnection('catalog', async (exec) => {
      const [u] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
         SELECT t.id, 'partiel@basedb.local', 'Partiel', $1, $1
           FROM _basedb.tenant t WHERE t.ref = $2 RETURNING id`,
        [ctx.actor.id, TENANT_REF],
        'insert',
      )
      const [r] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
         SELECT t.id, 'Partiel', 'partiel', 'partiel', $1
           FROM _basedb.tenant t WHERE t.ref = $2 RETURNING id`,
        [ctx.actor.id, TENANT_REF],
        'insert',
      )
      await exec.query(
        'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
        [r.id, u.id, ctx.actor.id],
        'insert',
      )
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
         VALUES ($1, 'table', $2, 'read', $3)`,
        [r.id, invoices.tableId, ctx.actor.id],
        'insert',
      )
      return u.id
    })

    const t = new Date('2026-09-19T12:00:00Z')
    return sealContext({
      requestId: '018f3c2a-0000-7000-8000-000000000010',
      actor: { kind: 'user', id: userId },
      tenantId: TENANT_REF,
      surface: 'rest',
      timestamp: t,
      deadline: new Date(t.getTime() + 120_000),
      permissions: { version: '1', rowPredicate: 'TRUE' },
    })
  }

  it('refuses to expand a target the actor cannot read, WITHOUT degrading silently', async () => {
    // The very same code as for a column that is not a link (05 §5.4): from the outside,
    // "this is not a link" and "you cannot see its target" are indistinguishable, so
    // expansion cannot be used to find out which tables exist. And it is a refusal, not
    // a masked object: returning one quietly would make the caller believe they got the
    // data.
    const partial = await partialReader()
    expect(
      await codeOf(
        listRecords(pools, partial, { tableId: invoices.tableId, expand: 'clients_id' }),
      ),
    ).toBe('EXPAND_UNAVAILABLE')
  })

  it('hides a whole block whose source table is unreadable', async () => {
    // Neither block, nor counter, nor mention: a counter visible on a masked table
    // would be a leak.
    const readerOfClientsOnly = await pools.withConnection('catalog', async (exec) => {
      const [u] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
         SELECT t.id, 'clients-seuls@basedb.local', 'Clients seuls', $1, $1
           FROM _basedb.tenant t WHERE t.ref = $2 RETURNING id`,
        [ctx.actor.id, TENANT_REF],
        'insert',
      )
      const [r] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
         SELECT t.id, 'Clients seuls', 'clients_seuls', 'clients_seuls', $1
           FROM _basedb.tenant t WHERE t.ref = $2 RETURNING id`,
        [ctx.actor.id, TENANT_REF],
        'insert',
      )
      await exec.query(
        'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
        [r.id, u.id, ctx.actor.id],
        'insert',
      )
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
         VALUES ($1, 'table', $2, 'read', $3)`,
        [r.id, clients.tableId, ctx.actor.id],
        'insert',
      )
      return u.id
    })

    const t = new Date('2026-09-19T12:00:00Z')
    const restricted = sealContext({
      requestId: '018f3c2a-0000-7000-8000-000000000011',
      actor: { kind: 'user', id: readerOfClientsOnly },
      tenantId: TENANT_REF,
      surface: 'rest',
      timestamp: t,
      deadline: new Date(t.getTime() + 120_000),
      permissions: { version: '1', rowPredicate: 'TRUE' },
    })

    const r = await listInverseLinks(pools, restricted, {
      tableId: clients.tableId,
      recordId: dupontId,
    })
    expect(r.blocks).toEqual([])
    // No query is issued either: masking is not a filter applied afterwards.
    expect(r.sql).toEqual([])
  })
})

describe('inverse links — the display column of the SOURCE table', () => {
  // Placed at the end of the file on purpose: designating a display column on
  // `Factures` is a durable catalog change, and the tests above read the state
  // where the table designates none.
  let numeroFieldId: string

  beforeAll(async () => {
    const [field] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `SELECT f.id FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.table_id = $1 AND n.name = 'numero'`,
        [invoices.tableId],
      ),
    )
    numeroFieldId = field.id
    await setDisplayColumn(pools, ctx, { tableId: invoices.tableId, fieldId: numeroFieldId })
  })

  it('shows the display value instead of a UUID', async () => {
    const r = await listInverseLinks(pools, ctx, {
      tableId: clients.tableId,
      recordId: dupontId,
    })
    const [block] = r.blocks
    // Sorted, because insertion order is NOT the contract: the four UUIDv7s are born in
    // the same millisecond, so their random bits decide the order between them. What is
    // checked here is that each row carries ITS OWN label, not the order — which the
    // `_id DESC` test above covers.
    expect(block.rows.map((row) => row.display).sort()).toEqual([
      'F-001',
      'F-002',
      'F-003',
      'F-004',
    ])
    expect(r.sql.some((s) => s.includes('AS "_display"'))).toBe(true)
  })

  it('withholds the display value when THAT column is masked, keeping the block', async () => {
    // The block must stay: the reader is entitled to know the rows exist and how many.
    // What they lose is the label — and no substitute field is chosen in its place,
    // which would be a leak channel picked at random.
    const masked = await maskedReader()
    const r = await listInverseLinks(pools, masked, {
      tableId: clients.tableId,
      recordId: dupontId,
    })

    expect(r.blocks).toHaveLength(1)
    expect(r.blocks[0].count).toBe(4)
    expect(r.blocks[0].rows.map((row) => row.display)).toEqual([null, null, null, null])
    // The masked column is not read, hence not transported: it is absent from the SQL.
    expect(r.sql.some((s) => s.includes('_display'))).toBe(false)
    expect(r.sql.some((s) => s.includes('numero'))).toBe(false)
  })

  /** Reads both tables, but the display column of `Factures` is hidden. */
  async function maskedReader(): Promise<RequestContext> {
    const userId = await pools.withConnection('catalog', async (exec) => {
      const [u] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
         SELECT t.id, 'masque@basedb.local', 'Masque', $1, $1
           FROM _basedb.tenant t WHERE t.ref = $2 RETURNING id`,
        [ctx.actor.id, TENANT_REF],
        'insert',
      )
      const [r] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
         SELECT t.id, 'Masque', 'masque', 'masque', $1
           FROM _basedb.tenant t WHERE t.ref = $2 RETURNING id`,
        [ctx.actor.id, TENANT_REF],
        'insert',
      )
      await exec.query(
        'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
        [r.id, u.id, ctx.actor.id],
        'insert',
      )
      for (const tableId of [clients.tableId, invoices.tableId]) {
        await exec.query(
          `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
           VALUES ($1, 'table', $2, 'read', $3)`,
          [r.id, tableId, ctx.actor.id],
          'insert',
        )
      }
      await exec.query(
        `INSERT INTO _basedb.field_permission (role_id, field_id, access)
         VALUES ($1, $2, 'hidden')`,
        [r.id, numeroFieldId],
        'insert',
      )
      return u.id
    })

    const t = new Date('2026-09-19T12:00:00Z')
    return sealContext({
      requestId: '018f3c2a-0000-7000-8000-000000000012',
      actor: { kind: 'user', id: userId },
      tenantId: TENANT_REF,
      surface: 'rest',
      timestamp: t,
      deadline: new Date(t.getTime() + 120_000),
      permissions: { version: '1', rowPredicate: 'TRUE' },
    })
  }
})
