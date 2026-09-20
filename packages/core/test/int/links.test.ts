import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLinkField, setDisplayColumn } from '../../src/catalog/links.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { listRecords } from '../../src/records/list.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Link fields — chapter 04 §4.
 *
 * What this test seeks to establish is not that a column appears, but that integrity is
 * held BY POSTGRESQL: a deletion written by hand in SQL, without going through the
 * product, must be refused. Integrity held on the application side would let `psql`
 * bypass it, and the cadrage requires the opposite.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let baseId: string
let schemaName: string
let clients: { tableId: string; tableName: string }
let invoices: { tableId: string; tableName: string }

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('no error raised')
}

/** Queries PostgreSQL's own system catalog, not ours. */
async function constraintOf(name: string) {
  const rows = await pools.withConnection('data', (exec) =>
    exec.query<{
      conname: string
      contype: string
      confdeltype: string
      confupdtype: string
      convalidated: boolean
      target: string
    }>(
      `SELECT c.conname, c.contype, c.confdeltype, c.confupdtype, c.convalidated,
              target.relname AS target
         FROM pg_constraint c
         JOIN pg_class t       ON t.oid = c.conrelid
         JOIN pg_namespace n   ON n.oid = t.relnamespace
         LEFT JOIN pg_class target ON target.oid = c.confrelid
        WHERE n.nspname = $1 AND c.conname = $2`,
      [schemaName, name],
    ),
  )
  return rows[0]
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
    requestId: '018f3c2a-0000-7000-8000-00000000000d',
    actor: { kind: 'user', id: actor },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'CRM' })
  baseId = base.baseId
  schemaName = base.schemaName

  const c = await createTable(pools, ctx, {
    baseId,
    label: 'Clients',
    fields: [{ label: 'Raison sociale', kind: 'short_text', required: true }],
  })
  clients = { tableId: c.tableId, tableName: c.tableName }

  const f = await createTable(pools, ctx, {
    baseId,
    label: 'Factures',
    fields: [{ label: 'Numéro', kind: 'short_text', required: true }],
  })
  invoices = { tableId: f.tableId, tableName: f.tableName }
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('creating a link field', () => {
  let link: Awaited<ReturnType<typeof createLinkField>>

  it('names the column after the target table (A7)', async () => {
    link = await createLinkField(pools, ctx, {
      tableId: invoices.tableId,
      targetTableId: clients.tableId,
      label: 'Client',
    })

    expect(link.name).toBe('clients_id')
    expect(link.constraintName).toBe('fk_factures__clients_id')
    expect(link.indexName).toBe('ix_factures__clients_id')
  })

  it('creates a nullable `uuid` column', async () => {
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ data_type: string; is_nullable: string }>(
        `SELECT data_type, is_nullable FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
        [schemaName, invoices.tableName, 'clients_id'],
      ),
    )
    expect(rows[0].data_type).toBe('uuid')
    expect(rows[0].is_nullable).toBe('YES')
  })

  it('installs a REAL foreign key, validated, towards `_id`', async () => {
    const c = await constraintOf('fk_factures__clients_id')
    expect(c.contype).toBe('f')
    expect(c.target).toBe('clients')
    // The constraint is installed NOT VALID then validated: at the end of the operation
    // it must be valid, otherwise old rows would never be checked.
    expect(c.convalidated).toBe(true)
  })

  it('emits `NO ACTION`, not `RESTRICT`, for the restrict behaviour (A13)', async () => {
    // `confdeltype = 'a'` is NO ACTION; `'r'` would be RESTRICT. Both refuse the same
    // deletions, but NO ACTION checks at end of statement, which lets a hierarchical
    // bulk delete succeed.
    const c = await constraintOf('fk_factures__clients_id')
    expect(c.confdeltype).toBe('a')
    expect(c.confupdtype).toBe('a')
  })

  it('creates the composite index `(column, _id)`', async () => {
    // PostgreSQL creates NO index for a foreign key: without this one, every deletion
    // of a client would force a full scan of the invoices. The second term serves
    // listing inverse links sorted by `_id`.
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ indexdef: string }>(
        'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
        [schemaName, 'ix_factures__clients_id'],
      ),
    )
    expect(rows[0].indexdef).toContain('(clients_id, _id)')
  })

  it('carries the target label as an SQL comment', async () => {
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ label: string }>(
        `SELECT col_description(a.attrelid, a.attnum) AS label
           FROM pg_attribute a
           JOIN pg_class c ON c.oid = a.attrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2 AND a.attname = 'clients_id'`,
        [schemaName, invoices.tableName],
      ),
    )
    expect(rows[0].label).toBe('Lien vers Clients')
  })

  it('marks the constraint and the index `active` in the catalog', async () => {
    const rows = await pools.withConnection('catalog', (exec) =>
      exec.query<{ constraint_state: string; index_state: string }>(
        `SELECT tc.state AS constraint_state, ti.state AS index_state
           FROM _basedb.field_link_config lc
           JOIN _basedb.table_constraint tc ON tc.id = lc.fk_constraint_id
           JOIN _basedb.table_index ti      ON ti.id = lc.fk_index_id
          WHERE lc.field_id = $1`,
        [link.fieldId],
      ),
    )
    expect(rows[0].constraint_state).toBe('active')
    expect(rows[0].index_state).toBe('active')
  })
})

describe('integrity is held by PostgreSQL, not by the application', () => {
  let clientId: string

  it('refuses a link value that designates no row', async () => {
    // Written DIRECTLY in SQL, without going through the product: that is the whole
    // point.
    await expect(
      pools.withConnection('data', (exec) =>
        exec.query(
          `INSERT INTO "${schemaName}"."${invoices.tableName}" ("numero", "clients_id")
           VALUES ('F-999', '0195b1f4-6a2e-7c3d-8e9f-1a2b3c4d5e6f')`,
          [],
          'insert',
        ),
      ),
    ).rejects.toMatchObject({ code: 'LINK_TARGET_NOT_FOUND' })
  })

  it('accepts a value that designates an existing row', async () => {
    const [client] = await pools.withConnection('data', (exec) =>
      exec.query<{ _id: string }>(
        `INSERT INTO "${schemaName}"."${clients.tableName}" ("raison_sociale")
         VALUES ('Dupont SARL') RETURNING "_id"`,
        [],
        'insert',
      ),
    )
    clientId = client._id

    const [invoice] = await pools.withConnection('data', (exec) =>
      exec.query<{ clients_id: string }>(
        `INSERT INTO "${schemaName}"."${invoices.tableName}" ("numero", "clients_id")
         VALUES ('F-001', $1) RETURNING "clients_id"`,
        [clientId],
        'insert',
      ),
    )
    expect(invoice.clients_id).toBe(clientId)
  })

  it('refuses deleting a row that is still referenced', async () => {
    // The product's promise: open psql and NOT be able to break the database.
    await expect(
      pools.withConnection('data', (exec) =>
        exec.query(
          `DELETE FROM "${schemaName}"."${clients.tableName}" WHERE "_id" = $1`,
          [clientId],
          // The operation is DECLARED: `23503` does not say on which side the violation
          // occurs, and deleting a referenced row is not the same fault as writing a
          // link to a non-existent target.
          'delete',
        ),
      ),
    ).rejects.toMatchObject({ code: 'ROW_REFERENCED' })
  })
})

describe('refusals, pronounced before any DDL is emitted', () => {
  it('refuses a target in another base', async () => {
    const other = await createBase(pools, ctx, { label: 'Autre base' })
    const elsewhere = await createTable(pools, ctx, {
      baseId: other.baseId,
      label: 'Fournisseurs',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })

    expect(
      await codeOf(
        createLinkField(pools, ctx, {
          tableId: invoices.tableId,
          targetTableId: elsewhere.tableId,
          label: 'Fournisseur',
        }),
      ),
    ).toBe('LINK_CROSS_DATABASE')
  })

  it('refuses `set_null` on a required link', async () => {
    expect(
      await codeOf(
        createLinkField(pools, ctx, {
          tableId: invoices.tableId,
          targetTableId: clients.tableId,
          label: 'Client payeur',
          required: true,
          onDelete: 'set_null',
        }),
      ),
    ).toBe('LINK_SET_NULL_ON_REQUIRED')
  })

  it('refuses a required reflexive link', async () => {
    // No row could ever be inserted: there is nothing to designate.
    expect(
      await codeOf(
        createLinkField(pools, ctx, {
          tableId: invoices.tableId,
          targetTableId: invoices.tableId,
          label: 'Facture d’origine',
          required: true,
        }),
      ),
    ).toBe('LINK_SELF_REQUIRED')
  })

  it('refuses `cascade` without confirmation', async () => {
    expect(
      await codeOf(
        createLinkField(pools, ctx, {
          tableId: invoices.tableId,
          targetTableId: clients.tableId,
          label: 'Client cascade',
          onDelete: 'cascade',
        }),
      ),
    ).toBe('LINK_CASCADE_NOT_GRANTED')
  })

  it('refuses an unknown target table, without saying whether it exists elsewhere', async () => {
    expect(
      await codeOf(
        createLinkField(pools, ctx, {
          tableId: invoices.tableId,
          targetTableId: '018f3c2a-9999-7000-8000-000000000999',
          label: 'Fantôme',
        }),
      ),
    ).toBe('RESOURCE_NOT_FOUND')
  })
})

describe('second link to the same table', () => {
  it('takes the label slug rather than a numeric suffix (A7)', async () => {
    // `clients_id` is taken: the fallback is `client_livre_id`, which says what it
    // designates, where `clients_id_2` would say nothing.
    const second = await createLinkField(pools, ctx, {
      tableId: invoices.tableId,
      targetTableId: clients.tableId,
      label: 'Client livré',
    })

    expect(second.name).toBe('client_livre_id')
    expect(second.constraintName).toBe('fk_factures__client_livre_id')

    const c = await constraintOf('fk_factures__client_livre_id')
    expect(c.contype).toBe('f')
    expect(c.convalidated).toBe(true)
  })

  it('accepts a non-required reflexive link', async () => {
    const reflexive = await createLinkField(pools, ctx, {
      tableId: invoices.tableId,
      targetTableId: invoices.tableId,
      label: 'Facture rectifiée',
    })

    expect(reflexive.name).toBe('factures_id')
    const c = await constraintOf('fk_factures__factures_id')
    expect(c.target).toBe('factures')
  })
})

describe('display value', () => {
  let clientId: string
  let companyNameFieldId: string

  it('returns `{id, display: null}` as long as no column is designated', async () => {
    // A VALID state (A15): a table with no displayable field remains a link target.
    const result = await listRecords(pools, ctx, { tableId: invoices.tableId })
    const withLink = result.rows.find((r) => r.clients_id !== null)
    expect(withLink?.clients_id).toMatchObject({ display: null })
    expect((withLink?.clients_id as { id: string }).id).toBeTruthy()
    clientId = (withLink?.clients_id as { id: string }).id
  })

  it('returns the label once the column is designated', async () => {
    const fields = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `SELECT f.id FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.table_id = $1 AND n.name = 'raison_sociale'`,
        [clients.tableId],
      ),
    )
    companyNameFieldId = fields[0].id

    await setDisplayColumn(pools, ctx, {
      tableId: clients.tableId,
      fieldId: companyNameFieldId,
    })

    const result = await listRecords(pools, ctx, { tableId: invoices.tableId })
    const withLink = result.rows.find((r) => (r.clients_id as { id?: string })?.id === clientId)
    expect(withLink?.clients_id).toEqual({ id: clientId, display: 'Dupont SARL' })
  })

  it('emits only ONE query per target table, whatever the number of rows', async () => {
    // `1 + T`, where T is the number of distinct READABLE target tables: a property of
    // the schema, not of the volume. Three link fields point here to two tables.
    const result = await listRecords(pools, ctx, { tableId: invoices.tableId })
    const targets = new Set(result.linkSql.map((s) => /FROM ([^\n]+)/.exec(s)?.[1]))
    expect(result.linkSql.length).toBe(targets.size)
    for (const query of result.linkSql) {
      expect(query).toContain('= ANY($1::uuid[])')
      // The row predicate of the TARGET: without it, a reader allowed on `factures` but
      // not on the rows of `clients` would read their display value.
      expect(query).toContain('predicat_lignes')
    }
  })

  it('`links=id` removes the resolution queries entirely', async () => {
    const result = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      links: 'id',
    })
    expect(result.linkSql).toEqual([])
    // The value stays the bare identifier, not an object.
    const withLink = result.rows.find((r) => r.clients_id !== null)
    expect(typeof withLink?.clients_id).toBe('string')
  })

  it('refuses to designate a non-displayable type', async () => {
    // A link would display its target, in an unbounded chain; a boolean would designate
    // N rows with two values.
    const link = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `SELECT id FROM _basedb.field WHERE table_id = $1 AND kind = 'link' LIMIT 1`,
        [invoices.tableId],
      ),
    )
    expect(
      await codeOf(
        setDisplayColumn(pools, ctx, {
          tableId: invoices.tableId,
          fieldId: link[0].id,
        }),
      ),
    ).toBe('VALIDATION_FAILED')
  })

  it('accepts removing the designation', async () => {
    const removed = await setDisplayColumn(pools, ctx, {
      tableId: clients.tableId,
      fieldId: null,
    })
    expect(removed.fieldId).toBeNull()

    const result = await listRecords(pools, ctx, { tableId: invoices.tableId })
    const withLink = result.rows.find((r) => (r.clients_id as { id?: string })?.id === clientId)
    expect(withLink?.clients_id).toEqual({ id: clientId, display: null })

    // Put back in place for the following tests.
    await setDisplayColumn(pools, ctx, {
      tableId: clients.tableId,
      fieldId: companyNameFieldId,
    })
  })
})

describe('unreadable target — the unique shape of A16', () => {
  let partial: RequestContext

  beforeAll(async () => {
    partial = await partialReader()
  })

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
      // `read` on the single table `factures`: the `clients` target stays out of reach.
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
      requestId: '018f3c2a-0000-7000-8000-00000000000e',
      actor: { kind: 'user', id: userId },
      tenantId: TENANT_REF,
      surface: 'rest',
      timestamp: t,
      deadline: new Date(t.getTime() + 120_000),
      permissions: { version: '1', rowPredicate: 'TRUE' },
    })
  }

  it('withholds the identifier itself, not merely the label', async () => {
    // A UUIDv7 carries a timestamp: letting it through would reveal the creation date
    // of a row the reader has no right to see.
    const result = await listRecords(pools, partial, { tableId: invoices.tableId })

    const withLink = result.rows.find((r) => r.numero === 'F-001')
    expect(withLink?.clients_id).toEqual({ id: null, display: null, masked: true })
  })

  it('emits NO query towards an unreadable target', async () => {
    // Masking is not a post-hoc filter: without this rule, the identifiers would travel
    // anyway and the query would count against the budget.
    const result = await listRecords(pools, partial, { tableId: invoices.tableId })
    expect(result.linkSql).toEqual([])
  })
})

describe('filters on a link path — §4.4', () => {
  it('translates a path into a correlated EXISTS, not a join', async () => {
    // A join would duplicate source rows as many times as the target is referenced, and
    // would combine FALSELY with `or`.
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      filter: 'clients_id.raison_sociale contains "dupont"',
    })
    expect(r.sql).toContain('EXISTS (SELECT 1')
    expect(r.sql).not.toContain('JOIN')
    expect(r.rows.map((row) => row.numero)).toEqual(['F-001'])
  })

  it('carries the row predicate of the TARGET table inside the EXISTS (I2)', async () => {
    // Without it, a reader allowed on `factures` but not on the rows of `clients` would
    // reconstruct by dichotomy the company name of invisible clients, merely by
    // observing how many invoices come back — with no alarm at all.
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      filter: 'clients_id.raison_sociale eq "Dupont SARL"',
    })
    // The marker names the PATH taken: that is what allows checking that each EXISTS
    // carries the predicate of ITS target, and not that of the source table.
    expect(r.sql).toContain('EXISTS (SELECT 1')
    expect(r.sql).toContain('predicat_lignes:clients_id')
  })

  it('accepts `display` as a reserved identifier', async () => {
    // Writing a filter without knowing the target's structure.
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      filter: 'clients_id.display eq_ci "DUPONT SARL"',
    })
    expect(r.rows.map((row) => row.numero)).toEqual(['F-001'])
  })

  it('applies accent folding across the path', async () => {
    await pools.withConnection('data', (exec) =>
      exec.query(
        `INSERT INTO "${schemaName}"."${clients.tableName}" ("raison_sociale")
         VALUES ('École du Nord')`,
        [],
        'insert',
      ),
    )
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      filter: 'clients_id.raison_sociale contains "ecole"',
    })
    // No invoice points at that client: the filter is correct and returns nothing.
    expect(r.rows).toHaveLength(0)
  })

  it('combines a path with `or` without duplicating rows', async () => {
    const r = await listRecords(pools, ctx, {
      tableId: invoices.tableId,
      filter: 'clients_id.raison_sociale contains "dupont" or numero eq "F-001"',
    })
    // A join would have returned F-001 twice.
    expect(r.rows.map((row) => row.numero)).toEqual(['F-001'])
  })

  it('refuses a path of depth 2', async () => {
    expect(
      await codeOf(
        listRecords(pools, ctx, {
          tableId: invoices.tableId,
          filter: 'clients_id.societe_mere_id.name eq "x"',
        }),
      ),
    ).toBe('EXPAND_TOO_DEEP')
  })

  it('refuses a non-existent target field just like a masked one', async () => {
    expect(
      await codeOf(
        listRecords(pools, ctx, {
          tableId: invoices.tableId,
          filter: 'clients_id.salaire gte 1',
        }),
      ),
    ).toBe('FILTER_FIELD_UNKNOWN')
  })

  it('refuses a path from a field that is not a link', async () => {
    expect(
      await codeOf(
        listRecords(pools, ctx, {
          tableId: invoices.tableId,
          filter: 'numero.raison_sociale eq "x"',
        }),
      ),
    ).toBe('FILTER_FIELD_UNKNOWN')
  })

  it('refuses more than four distinct paths', async () => {
    const tooMany = Array.from(
      { length: 5 },
      (_, i) => `clients_id.raison_sociale eq "v${i}"`,
    ).join(' or ')
    expect(
      await codeOf(listRecords(pools, ctx, { tableId: invoices.tableId, filter: tooMany })),
    ).toBe('FILTER_TOO_COMPLEX')
  })
})
