import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DESCRIPTION_MAX_CHARS } from '../../src/catalog/description.js'
import { setFieldDescription, setTableDescription } from '../../src/catalog/descriptions.js'
import { addField } from '../../src/catalog/fields.js'
import { updateBase } from '../../src/catalog/lifecycle.js'
import { createLinkField } from '../../src/catalog/links.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { type ProjectedBase, projectBase } from '../../src/catalog/projection.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Descriptions, from the moment they are typed to the moment they are read.
 *
 * A description is written in one place — the catalog — and read in four: the projection
 * (hence `/meta`, OpenAPI, the documentation and, later, the MCP description), and the
 * `COMMENT ON` of the user's own schema. What is checked here is that those readers never
 * disagree, that an edit reaches them at once, and that a bad value leaves nothing behind.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext
let tenantId: string

function contextFor(userId: string, requestId: string): RequestContext {
  const t = new Date('2026-09-19T12:00:00Z')
  return sealContext({
    requestId,
    actor: { kind: 'user', id: userId },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: t,
    deadline: new Date(t.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

/** An actor who can READ everything and manage nothing. */
async function reader(email: string, tableIds: readonly string[]): Promise<RequestContext> {
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
    return u.id
  })
  return contextFor(userId, '018f3c2a-0000-7000-8000-00000000003a')
}

async function tableComment(schema: string, table: string): Promise<string | null> {
  return pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ comment: string | null }>(
      `SELECT obj_description(c.oid) AS comment
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2`,
      [schema, table],
    )
    return rows[0]?.comment ?? null
  })
}

async function columnComment(
  schema: string,
  table: string,
  column: string,
): Promise<string | null> {
  return pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ comment: string | null }>(
      `SELECT col_description(c.oid, a.attnum) AS comment
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attname = $3`,
      [schema, table, column],
    )
    return rows[0]?.comment ?? null
  })
}

const tableOf = (base: ProjectedBase, name: string) => base.tables.find((t) => t.name === name)
const fieldOf = (base: ProjectedBase, table: string, name: string) =>
  tableOf(base, table)?.fields.find((f) => f.name === name)

async function refusalOf(promise: Promise<unknown>): Promise<{ code: string; details: unknown }> {
  try {
    await promise
  } catch (error) {
    const e = error as { code: string; details: unknown }
    return { code: e.code, details: e.details }
  }
  throw new Error('expected a refusal')
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
  admin = contextFor(bootstrap.created_by, '018f3c2a-0000-7000-8000-00000000003b')
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('written at creation', () => {
  it('on a base, a table and its fields — and read back from the projection', async () => {
    const base = await createBase(pools, admin, {
      label: 'Suivi commercial',
      description: '  Clients, devis et factures de l’équipe commerciale.  ',
    })
    // Trimmed on the way in: the column never holds the spaces around what was typed.
    expect(base.description).toBe('Clients, devis et factures de l’équipe commerciale.')

    const created = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      description: 'Une ligne par facture émise.',
      fields: [
        { label: 'Numéro', kind: 'short_text', required: true, description: 'Numéro unique.' },
        { label: 'Montant', kind: 'number' },
      ],
    })

    const projected = await projectBase(pools, admin, base.schemaName)
    expect(projected.description).toBe('Clients, devis et factures de l’équipe commerciale.')
    expect(tableOf(projected, created.tableName)?.description).toBe('Une ligne par facture émise.')
    expect(fieldOf(projected, created.tableName, 'numero')?.description).toBe('Numéro unique.')
    // Nobody described it: `null`, not an empty string and not the label.
    expect(fieldOf(projected, created.tableName, 'montant')?.description).toBeNull()
  })

  it('on a column added later, and on a link', async () => {
    const base = await createBase(pools, admin, { label: 'Ajouts' })
    const clients = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Clients',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    const invoices = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })

    const added = await addField(pools, admin, {
      tableId: invoices.tableId,
      label: 'Montant',
      kind: 'number',
      description: 'Montant hors taxes, en euros.',
    })
    const link = await createLinkField(pools, admin, {
      tableId: invoices.tableId,
      targetTableId: clients.tableId,
      label: 'Client',
      description: 'Le client facturé.',
    })

    expect(added.description).toBe('Montant hors taxes, en euros.')
    expect(link.description).toBe('Le client facturé.')

    const projected = await projectBase(pools, admin, base.schemaName)
    expect(fieldOf(projected, invoices.tableName, added.name)?.description).toBe(
      'Montant hors taxes, en euros.',
    )
    expect(fieldOf(projected, invoices.tableName, link.name)?.description).toBe(
      'Le client facturé.',
    )
  })

  it('and reaches the schema the user can open in psql', async () => {
    const base = await createBase(pools, admin, { label: 'Commentaires' })
    const created = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      description: 'Une ligne par facture émise.',
      fields: [
        { label: 'Numéro', kind: 'short_text', description: 'Numéro unique.' },
        { label: 'Montant', kind: 'number' },
      ],
    })

    // The description where there is one...
    expect(await tableComment(base.schemaName, created.tableName)).toBe(
      'Une ligne par facture émise.',
    )
    expect(await columnComment(base.schemaName, created.tableName, 'numero')).toBe('Numéro unique.')
    // ...and the label where there is none: `\d+` never shows an empty comment.
    expect(await columnComment(base.schemaName, created.tableName, 'montant')).toBe('Montant')
  })
})

describe('a bad description leaves nothing behind', () => {
  it('is refused before the table exists — the third field being the culprit', async () => {
    const base = await createBase(pools, admin, { label: 'Refus' })
    const tooLong = 'x'.repeat(DESCRIPTION_MAX_CHARS + 1)

    const refusal = await refusalOf(
      createTable(pools, admin, {
        baseId: base.baseId,
        label: 'Factures',
        fields: [
          { label: 'A', kind: 'short_text' },
          { label: 'B', kind: 'short_text' },
          { label: 'C', kind: 'short_text', description: tooLong },
        ],
      }),
    )

    expect(refusal.code).toBe('TEXT_TOO_LONG')
    // The message says WHICH field, which is what a form with twenty of them needs.
    expect(refusal.details).toEqual({
      field: 'fields[2].description',
      maximum: DESCRIPTION_MAX_CHARS,
    })

    const rows = await pools.withConnection('catalog', (exec) =>
      exec.query('SELECT 1 FROM _basedb.table_def WHERE base_id = $1', [base.baseId]),
    )
    expect(rows).toHaveLength(0)
  })

  it('is refused on a base as well', async () => {
    const refusal = await refusalOf(
      createBase(pools, admin, { label: 'Trop long', description: 'x'.repeat(1001) }),
    )
    expect(refusal.code).toBe('TEXT_TOO_LONG')
  })
})

describe('edited afterwards', () => {
  it('a table: the projection follows at once, and so does the comment', async () => {
    const base = await createBase(pools, admin, { label: 'Édition table' })
    const created = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })

    // Read once, so that the projection is in cache: the point is that the edit is not
    // hidden behind it.
    expect(
      tableOf(await projectBase(pools, admin, base.schemaName), created.tableName)?.description,
    ).toBeNull()

    const result = await setTableDescription(pools, admin, {
      tableId: created.tableId,
      description: '  Une ligne par facture.  ',
    })
    expect(result.description).toBe('Une ligne par facture.')

    const after = await projectBase(pools, admin, base.schemaName)
    expect(tableOf(after, created.tableName)?.description).toBe('Une ligne par facture.')
    expect(await tableComment(base.schemaName, created.tableName)).toBe('Une ligne par facture.')
  })

  it('a table: clearing brings the label back into the comment', async () => {
    const base = await createBase(pools, admin, { label: 'Effacement' })
    const created = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      description: 'À effacer.',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })

    for (const empty of [null, '', '   ']) {
      await setTableDescription(pools, admin, {
        tableId: created.tableId,
        description: 'À effacer.',
      })
      await setTableDescription(pools, admin, { tableId: created.tableId, description: empty })
      const after = await projectBase(pools, admin, base.schemaName)
      expect(tableOf(after, created.tableName)?.description).toBeNull()
      expect(await tableComment(base.schemaName, created.tableName)).toBe('Factures')
    }
  })

  it('a field: the projection follows at once, and so does the comment', async () => {
    const base = await createBase(pools, admin, { label: 'Édition champ' })
    const created = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      fields: [{ label: 'Montant', kind: 'number' }],
    })
    const [montant] = created.fields

    await projectBase(pools, admin, base.schemaName)
    await setFieldDescription(pools, admin, {
      fieldId: montant.fieldId,
      description: 'Montant hors taxes.',
    })

    const after = await projectBase(pools, admin, base.schemaName)
    expect(fieldOf(after, created.tableName, montant.name)?.description).toBe('Montant hors taxes.')
    expect(await columnComment(base.schemaName, created.tableName, montant.name)).toBe(
      'Montant hors taxes.',
    )
  })

  it('a base: label and description change together, or apart', async () => {
    const base = await createBase(pools, admin, { label: 'Ancienne', description: 'Avant.' })
    await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Une table',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })

    // Warm the cache: `base` carries no version trigger, so it is `updateBase` itself that
    // has to move the counter — a stale read here is the bug this guards against.
    expect((await projectBase(pools, admin, base.schemaName)).description).toBe('Avant.')

    // Description alone leaves the label...
    await updateBase(pools, admin, { baseId: base.baseId, description: 'Après.' })
    let projected = await projectBase(pools, admin, base.schemaName)
    expect(projected.description).toBe('Après.')
    expect(projected.label).toBe('Ancienne')

    // ...label alone leaves the description...
    await updateBase(pools, admin, { baseId: base.baseId, label: 'Nouvelle' })
    projected = await projectBase(pools, admin, base.schemaName)
    expect(projected.label).toBe('Nouvelle')
    expect(projected.description).toBe('Après.')

    // ...both at once, in one write...
    const both = await updateBase(pools, admin, {
      baseId: base.baseId,
      label: 'Encore',
      description: 'Les deux.',
    })
    expect(both).toEqual({
      label: 'Encore',
      description: 'Les deux.',
      color: null,
      icon: null,
      image: null,
    })

    // ...and `null` is how a description is cleared: leaving it out means "keep".
    await updateBase(pools, admin, { baseId: base.baseId, description: null })
    projected = await projectBase(pools, admin, base.schemaName)
    expect(projected.description).toBeNull()
    expect(projected.label).toBe('Encore')
  })

  it('refuses an over-long description without touching the old one', async () => {
    const base = await createBase(pools, admin, { label: 'Intacte', description: 'Avant.' })
    // A base with no table is not visible, so it could not be read back.
    await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Une table',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })

    const refusal = await refusalOf(
      updateBase(pools, admin, { baseId: base.baseId, description: 'x'.repeat(1001) }),
    )
    expect(refusal.code).toBe('TEXT_TOO_LONG')
    expect((await projectBase(pools, admin, base.schemaName)).description).toBe('Avant.')
  })
})

describe('who may edit', () => {
  it('a reader may not: describing is a change of structure', async () => {
    const base = await createBase(pools, admin, { label: 'Droits' })
    const created = await createTable(pools, admin, {
      baseId: base.baseId,
      label: 'Factures',
      description: 'Intacte.',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })
    const someone = await reader('lecteur-seul@basedb.local', [created.tableId])

    // Thunks, not promises: started one at a time, each refusal is awaited by the time the
    // next one can happen.
    for (const attempt of [
      () =>
        setTableDescription(pools, someone, { tableId: created.tableId, description: 'Piégée.' }),
      () =>
        setFieldDescription(pools, someone, {
          fieldId: created.fields[0].fieldId,
          description: 'Piégée.',
        }),
      () => updateBase(pools, someone, { baseId: base.baseId, description: 'Piégée.' }),
    ]) {
      expect((await refusalOf(attempt())).code).toBe('ADMIN_REQUIRED')
    }

    // And nothing moved, comment included.
    const after = await projectBase(pools, admin, base.schemaName)
    expect(tableOf(after, created.tableName)?.description).toBe('Intacte.')
    expect(await tableComment(base.schemaName, created.tableName)).toBe('Intacte.')
  })
})
