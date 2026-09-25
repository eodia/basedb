import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setTableDescription } from '../../src/catalog/descriptions.js'
import { updateBase } from '../../src/catalog/lifecycle.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { projectBase } from '../../src/catalog/projection.js'
import { listProjects } from '../../src/catalog/projects.js'
import { updateTable } from '../../src/catalog/table-edit.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * How a base and a table look, and what a table is called — chapter 02, chapter 06 §1.1.
 *
 * The look is the one a choice of a list wears, under the same rules; it lives in the
 * catalog alone and reaches every reader of it — `/meta`, the navigation — at once. A
 * table's label moves in the catalog and in its `COMMENT ON`, never in its name.
 */

const TENANT_REF = 't4z56fq'
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
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
  const now = new Date('2026-09-25T12:00:00Z')
  admin = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000007d',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('the look of a base', () => {
  it('is stored normalized, published by /meta and by the navigation, and replaced whole', async () => {
    const base = await createBase(pools, admin, { label: 'Chantiers' })
    await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Visites',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })

    // Warm the cache first: `updateBase` must move the version itself.
    expect((await projectBase(pools, admin, base.schemaName)).color).toBeNull()

    const dressed = await updateBase(pools, admin, {
      baseId: base.baseId,
      look: { color: '#E11D48', icon: 'hard-hat' },
    })
    expect(dressed).toMatchObject({ color: '#e11d48', icon: 'hard-hat', image: null })

    const projected = await projectBase(pools, admin, base.schemaName)
    expect(projected).toMatchObject({ color: '#e11d48', icon: 'hard-hat', image: null })
    const navigation = (await listProjects(pools, admin)).flatMap((p) => p.bases)
    expect(navigation.find((b) => b.id === base.baseId)).toMatchObject({
      color: '#e11d48',
      icon: 'hard-hat',
    })

    // Naming one key replaces the look: the colour does not outlive the pictogram.
    const pictured = await updateBase(pools, admin, { baseId: base.baseId, look: { image: PIXEL } })
    expect(pictured).toMatchObject({ color: null, icon: null, image: PIXEL })

    // A label change leaves the look alone.
    const renamed = await updateBase(pools, admin, { baseId: base.baseId, label: 'Chantiers 2026' })
    expect(renamed).toMatchObject({ label: 'Chantiers 2026', image: PIXEL })
  })

  it('refuses what a choice of a list refuses, with the same reasons', async () => {
    const base = await createBase(pools, admin, { label: 'Refus' })
    const refused = async (look: Record<string, string>) =>
      (await failure(updateBase(pools, admin, { baseId: base.baseId, look }))).details?.reason

    expect(await refused({ color: 'rouge' })).toBe('couleur_invalide')
    expect(await refused({ icon: 'Hard Hat' })).toBe('icone_invalide')
    expect(await refused({ image: 'javascript:alert(1)' })).toBe('image_invalide')
    expect(await refused({ image: 'data:image/svg+xml;base64,PHN2Zz4=' })).toBe('image_invalide')
    expect(await refused({ icon: 'star', image: PIXEL })).toBe('icone_et_image')
  })

  it('is held by the catalog itself, whoever writes', async () => {
    const base = await createBase(pools, admin, { label: 'Direct' })
    for (const set of [
      `color = 'rouge'`,
      `icon = 'A B'`,
      `icon = 'star', image = 'https://x/a.png'`,
    ]) {
      const error = await failure(
        pools.withConnection('catalog', (exec) =>
          exec.query(`UPDATE _basedb.base SET ${set} WHERE id = $1`, [base.baseId], 'update'),
        ),
      )
      expect(error.code, set).toMatch(/^(VALUE_|VALIDATION|CHECK|INTERNAL)/)
    }
  })
})

describe('a table: its label and its look', () => {
  it('renames the label and the COMMENT, never the relation', async () => {
    const base = await createBase(pools, admin, { label: 'Commerce' })
    const factures = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })
    const updated = await updateTable(pools, admin, {
      tableId: factures.tableId,
      label: 'Factures clients',
      look: { color: '#2563eb', icon: 'receipt' },
    })
    expect(updated).toEqual({
      label: 'Factures clients',
      color: '#2563eb',
      icon: 'receipt',
      image: null,
    })

    const projected = await projectBase(pools, admin, base.schemaName)
    const table = projected.tables.find((t) => t.id === factures.tableId)
    // The name the SQL is written against has not moved.
    expect(table).toMatchObject({
      name: factures.tableName,
      label: 'Factures clients',
      color: '#2563eb',
      icon: 'receipt',
    })

    const [comment] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ comment: string }>(
        `SELECT obj_description(c.oid) AS comment
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2`,
        [base.schemaName, factures.tableName],
      ),
    )
    // Without a description, the comment IS the label — and follows it.
    expect(comment.comment).toBe('Factures clients')

    // With one, the comment is the description, and a rename leaves it as it is.
    await setTableDescription(pools, admin, {
      tableId: factures.tableId,
      description: 'Une ligne par facture.',
    })
    await updateTable(pools, admin, { tableId: factures.tableId, label: 'Factures émises' })
    const [again] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ comment: string }>(
        `SELECT obj_description(c.oid) AS comment
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2`,
        [base.schemaName, factures.tableName],
      ),
    )
    expect(again.comment).toBe('Une ligne par facture.')
  })

  it('refuses a label another live table of the base already has', async () => {
    const base = await createBase(pools, admin, { label: 'Doublons' })
    await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Clients',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    const other = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Prospects',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    const clash = await failure(
      updateTable(pools, admin, { tableId: other.tableId, label: 'clients' }),
    )
    expect(clash.code).toBe('LABEL_DUPLICATE')

    // The look alone is not a rename, and needs no free label.
    const dressed = await updateTable(pools, admin, {
      tableId: other.tableId,
      look: { color: '#abc' },
    })
    expect(dressed).toEqual({ label: 'Prospects', color: '#aabbcc', icon: null, image: null })
  })
})
