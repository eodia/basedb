import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteField, previewFieldDeletion } from '../../src/catalog/field-deletion.js'
import { addField, setFieldRequired } from '../../src/catalog/fields.js'
import { deleteBase, deleteTable, restoreBase } from '../../src/catalog/lifecycle.js'
import { createLinkField, setDisplayColumn } from '../../src/catalog/links.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Deleting one field — chapter 04 §1.11 and chapter 06 §4.1, against a real PostgreSQL.
 *
 * What matters is what the RELEGATED column no longer imposes: a `NOT NULL` that would
 * refuse every insert, a foreign key that would refuse deleting a target row, a CHECK
 * that would refuse a value nobody sees. Those are facts of PostgreSQL, so they are
 * tested there.
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

interface Fixture {
  readonly baseId: string
  readonly schemaName: string
  readonly clients: { readonly id: string; readonly name: string }
  readonly invoices: { readonly id: string; readonly name: string }
  readonly link: { readonly id: string; readonly name: string }
}

/** Clients ← Factures, a real foreign key, two clients and an invoice pointing at one. */
async function makeBase(label: string): Promise<Fixture> {
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
  const link = await createLinkField(pools, admin, {
    tableId: invoices.tableId,
    label: 'Client',
    targetTableId: clients.tableId,
  })
  await pools.withConnection('data', async (exec) => {
    const [dupont] = await exec.query<{ _id: string }>(
      `INSERT INTO "${base.schemaName}"."${clients.tableName}" ("raison_sociale")
       VALUES ('Dupont SARL'), ('ACME') RETURNING "_id"`,
      [],
      'insert',
    )
    await exec.query(
      `INSERT INTO "${base.schemaName}"."${invoices.tableName}" ("numero", "montant", "${link.name}")
       VALUES ('F-1', 120, $1)`,
      [dupont?._id],
      'insert',
    )
  })
  return {
    baseId: base.baseId,
    schemaName: base.schemaName,
    clients: { id: clients.tableId, name: clients.tableName },
    invoices: { id: invoices.tableId, name: invoices.tableName },
    link: { id: link.fieldId, name: link.name },
  }
}

async function fieldIdOf(tableId: string, label: string): Promise<string> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      'SELECT id FROM _basedb.field WHERE table_id = $1 AND label = $2 AND deleted_at IS NULL',
      [tableId, label],
    ),
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error(`champ introuvable : ${label}`)
  return id
}

async function columnsOf(schema: string, table: string): Promise<string[]> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{ name: string }>(
      `SELECT attname AS name FROM pg_attribute
        WHERE attrelid = to_regclass($1) AND attnum > 0 AND NOT attisdropped
        ORDER BY attnum`,
      [`"${schema}"."${table}"`],
    ),
  )
  return rows.map((r) => r.name)
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise
    return undefined
  } catch (e) {
    return (e as { code?: string }).code
  }
}

describe('§1.11 — relegating the column', () => {
  it('keeps the values under the relegated name, and stops requiring them', async () => {
    const base = await makeBase('Relégation')
    const numero = await fieldIdOf(base.invoices.id, 'Numéro')

    const migration = await deleteField(pools, admin, { fieldId: numero })
    expect(migration.status).toBe('applied')

    const columns = await columnsOf(base.schemaName, base.invoices.name)
    expect(columns).not.toContain('numero')
    expect(columns).toContain('zz_supprime_20260918_numero')

    await pools.withConnection('data', async (exec) => {
      const rows = await exec.query<{ v: string }>(
        `SELECT "zz_supprime_20260918_numero" AS v FROM "${base.schemaName}"."${base.invoices.name}"`,
      )
      expect(rows.map((r) => r.v)).toEqual(['F-1'])
      // The line that matters most: an insert that does not name the column goes through.
      await exec.query(
        `INSERT INTO "${base.schemaName}"."${base.invoices.name}" ("montant") VALUES (5)`,
        [],
        'insert',
      )
    })

    const [catalog] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ live: boolean; required: boolean; state: string; name: string }>(
        `SELECT f.is_live AS live, f.is_required AS required, n.state, n.name
           FROM _basedb.field f JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.id = $1`,
        [numero],
      ),
    )
    expect(catalog).toMatchObject({
      live: false,
      required: false,
      state: 'relegated',
      name: 'zz_supprime_20260918_numero',
    })
  })

  it('frees the label at once, never the physical name', async () => {
    const base = await makeBase('Libellé libéré')
    await deleteField(pools, admin, { fieldId: await fieldIdOf(base.invoices.id, 'Montant') })
    const again = await addField(pools, admin, {
      tableId: base.invoices.id,
      label: 'Montant',
      kind: 'number',
    })
    expect(again.name).not.toBe('montant')
  })

  it('drops the CHECK of a list of choices with the column', async () => {
    const base = await makeBase('Choix')
    const statut = await addField(pools, admin, {
      tableId: base.clients.id,
      label: 'Statut',
      kind: 'select',
      options: [{ value: 'actif', label: 'Actif' }],
    })
    await deleteField(pools, admin, { fieldId: statut.fieldId })
    await pools.withConnection('data', (exec) =>
      exec.query(
        `UPDATE "${base.schemaName}"."${base.clients.name}"
            SET "zz_supprime_20260918_statut" = 'autre chose'`,
        [],
        'update',
      ),
    )
  })

  it('removes the foreign key of a link: the target row it named can be deleted', async () => {
    const base = await makeBase('Lien')
    // Required, to prove the NOT NULL goes with it.
    await setFieldRequired(pools, admin, { fieldId: base.link.id, required: true })
    const preview = await previewFieldDeletion(pools, admin, base.link.id)
    expect(preview.lockedTables).toEqual(['Clients'])

    await deleteField(pools, admin, { fieldId: base.link.id })
    await pools.withConnection('data', (exec) =>
      exec.query(`DELETE FROM "${base.schemaName}"."${base.clients.name}"`, [], 'delete'),
    )
    // Nothing aims at Clients any more: the table itself may go.
    const migration = await deleteTable(pools, admin, { tableId: base.clients.id })
    expect(migration.status).toBe('applied')
  })

  it('deletes a field without a column — a count — as well', async () => {
    const base = await makeBase('Décompte')
    const count = await addField(pools, admin, {
      tableId: base.clients.id,
      label: 'Nombre de factures',
      kind: 'count',
      rollup: { via: base.link.name, viaTable: base.invoices.name },
    })
    const preview = await previewFieldDeletion(pools, admin, count.fieldId)
    expect(preview.relegatedName).toBeNull()
    expect((await deleteField(pools, admin, { fieldId: count.fieldId })).status).toBe('applied')
  })
})

describe('§4.6 — what stands in the way is refused, and named', () => {
  it('refuses the display column of its table', async () => {
    const base = await makeBase('Affichage')
    const raison = await fieldIdOf(base.clients.id, 'Raison sociale')
    await setDisplayColumn(pools, admin, { tableId: base.clients.id, fieldId: raison })
    expect((await previewFieldDeletion(pools, admin, raison)).isDisplay).toBe(true)
    expect(await codeOf(deleteField(pools, admin, { fieldId: raison }))).toBe(
      'DISPLAY_FIELD_IN_USE',
    )
  })

  it('refuses a field a formula reads, and a relation a count follows', async () => {
    const base = await makeBase('Formule')
    await addField(pools, admin, {
      tableId: base.invoices.id,
      label: 'Double',
      kind: 'formula',
      formula: { expression: '[Montant] * 2' },
    })
    await addField(pools, admin, {
      tableId: base.clients.id,
      label: 'Nombre de factures',
      kind: 'count',
      rollup: { via: base.link.name, viaTable: base.invoices.name },
    })

    const montant = await fieldIdOf(base.invoices.id, 'Montant')
    expect((await previewFieldDeletion(pools, admin, montant)).usedBy).toEqual([
      { kind: 'formula', label: 'Double', table: null },
    ])
    expect(await codeOf(deleteField(pools, admin, { fieldId: montant }))).toBe(
      'FIELD_USED_BY_FORMULA',
    )

    expect((await previewFieldDeletion(pools, admin, base.link.id)).usedBy).toEqual([
      { kind: 'count', label: 'Nombre de factures', table: 'Clients' },
    ])
    expect(await codeOf(deleteField(pools, admin, { fieldId: base.link.id }))).toBe(
      'FIELD_USED_BY_FORMULA',
    )
  })

  it('refuses a column a view of PostgreSQL is built on', async () => {
    const base = await makeBase('Vue tierce')
    await pools.withConnection('ddl', (exec) =>
      exec.query(
        `CREATE VIEW "${base.schemaName}"."rapport" AS
           SELECT "montant" FROM "${base.schemaName}"."${base.invoices.name}"`,
        [],
        'ddl',
      ),
    )
    const montant = await fieldIdOf(base.invoices.id, 'Montant')
    expect((await previewFieldDeletion(pools, admin, montant)).views).toEqual([
      { kind: 'other', name: `${base.schemaName}.rapport` },
    ])
    expect(await codeOf(deleteField(pools, admin, { fieldId: montant }))).toBe('DEPENDENT_OBJECT')
  })
})

describe('§6 — restoring the base', () => {
  it('leaves a field deleted on its own deleted', async () => {
    const base = await makeBase('Restauration')
    const montant = await fieldIdOf(base.invoices.id, 'Montant')
    await deleteField(pools, admin, { fieldId: montant })
    await deleteBase(pools, admin, { baseId: base.baseId })
    expect((await restoreBase(pools, admin, { baseId: base.baseId })).status).toBe('applied')

    const fields = await pools.withConnection('catalog', (exec) =>
      exec.query<{ label: string; live: boolean }>(
        'SELECT label, is_live AS live FROM _basedb.field WHERE table_id = $1 ORDER BY position',
        [base.invoices.id],
      ),
    )
    expect(fields.find((f) => f.label === 'Montant')?.live).toBe(false)
    expect(fields.find((f) => f.label === 'Numéro')?.live).toBe(true)
  })
})
