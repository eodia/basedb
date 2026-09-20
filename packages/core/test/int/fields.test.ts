import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addField, setFieldRequired } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Adding a field — chapter 04 §1.3 and §1.10.
 *
 * The interesting part is not the column. It is that a field is ALWAYS born nullable,
 * and that making it required afterwards runs a four-step recipe whose whole purpose is
 * that `SET NOT NULL` never scans the table. A test that only checked the column exists
 * would pass on an implementation that locks a million rows for a minute.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let baseId: string
let schemaName: string
let tableId: string
let tableName: string

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('aucun refus')
}

/** Reads a column as PostgreSQL itself sees it. */
async function column(name: string) {
  const [found] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
      [schemaName, tableName, name],
    ),
  )
  return found
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

  const now = new Date('2026-09-19T12:00:00.000Z')
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000004a',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'CRM' })
  baseId = base.baseId
  schemaName = base.schemaName

  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Contacts',
    fields: [{ label: 'Nom', kind: 'short_text', required: true }],
  })
  tableId = table.tableId
  tableName = table.tableName

  // A populated table: the whole point is that adding a column still works here.
  await pools.withConnection('data', (exec) =>
    exec.query(
      `INSERT INTO "${schemaName}"."${tableName}" ("nom")
       VALUES ('Camille'), ('Thomas'), ('Léa')`,
      [],
      'insert',
    ),
  )
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('§1.3 — a field is born nullable, always', () => {
  it('adds a column to a table that already holds rows', async () => {
    const field = await addField(pools, ctx, {
      tableId,
      label: 'Ville',
      kind: 'short_text',
    })

    expect(field.name).toBe('ville')
    const found = await column('ville')
    expect(found.data_type).toBe('text')
    // NULLABLE, on a populated table: `ADD COLUMN … NOT NULL` without a default would
    // have failed outright here.
    expect(found.is_nullable).toBe('YES')

    // The existing rows are untouched and readable.
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ nom: string; ville: string | null }>(
        `SELECT "nom", "ville" FROM "${schemaName}"."${tableName}" ORDER BY "nom"`,
      ),
    )
    expect(rows.map((r) => r.ville)).toEqual([null, null, null])
  }, 60_000)

  it('gives the column its business label as a comment, for psql', async () => {
    await addField(pools, ctx, { tableId, label: 'Téléphone mobile', kind: 'short_text' })
    const [comment] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ label: string }>(
        `SELECT col_description(c.oid, a.attnum) AS label
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid
          WHERE n.nspname = $1 AND c.relname = $2 AND a.attname = 'telephone_mobile'`,
        [schemaName, tableName],
      ),
    )
    expect(comment.label).toBe('Téléphone mobile')
  }, 60_000)

  it('projects each type onto the column PostgreSQL should hold', async () => {
    const expected: ReadonlyArray<[string, string, string]> = [
      ['Montant', 'number', 'numeric'],
      ['Actif', 'boolean', 'boolean'],
      ['Naissance', 'date', 'date'],
      ['Vu le', 'datetime', 'timestamp with time zone'],
      ['Notes', 'long_text', 'text'],
    ]
    for (const [label, kind, type] of expected) {
      const field = await addField(pools, ctx, { tableId, label, kind: kind as never })
      expect((await column(field.name)).data_type).toBe(type)
    }
  }, 120_000)

  it('refuses a link, which is a sequence of its own', async () => {
    // Folding it in here would hide from the caller that it has a step outside the
    // transaction, and that it can be interrupted between two of them.
    expect(await codeOf(addField(pools, ctx, { tableId, label: 'Client', kind: 'link' }))).toBe(
      'REQUEST_INVALID',
    )
  })

  it('refuses an empty label', async () => {
    expect(await codeOf(addField(pools, ctx, { tableId, label: '   ', kind: 'short_text' }))).toBe(
      'LABEL_EMPTY',
    )
  })

  it('settles a NAME collision by the ordinary mechanism', async () => {
    // Two different labels that slugify the same way: the registry adds the suffix, and
    // nothing is silently truncated to 63 bytes.
    const first = await addField(pools, ctx, { tableId, label: 'Suivi', kind: 'short_text' })
    const second = await addField(pools, ctx, { tableId, label: 'Suivi !', kind: 'short_text' })
    expect(second.name).not.toBe(first.name)
    expect((await column(second.name)).data_type).toBe('text')
  }, 60_000)

  it('refuses a LABEL already taken in the table', async () => {
    // The catalog holds one live field per label per table, and it is right to: two
    // columns called `Ville` would be indistinguishable on every screen.
    await addField(pools, ctx, { tableId, label: 'Secteur', kind: 'short_text' })
    expect(
      await codeOf(addField(pools, ctx, { tableId, label: 'secteur', kind: 'short_text' })),
    ).toBe('DUPLICATE_VALUE')
  }, 60_000)
})

describe('§3 — a select is a list the DATABASE holds to', () => {
  it('writes the options and the constraint that enforces them', async () => {
    const field = await addField(pools, ctx, {
      tableId,
      label: 'Statut',
      kind: 'select',
      options: [
        { value: 'actif', label: 'Actif' },
        { value: 'a_contacter', label: 'À contacter' },
        { value: 'inactif', label: 'Inactif' },
      ],
    })

    const stored = await pools.withConnection('catalog', (exec) =>
      exec.query<{ value: string; label: string; position: number }>(
        'SELECT value, label, position FROM _basedb.select_option WHERE field_id = $1 ORDER BY position',
        [field.fieldId],
      ),
    )
    expect(stored.map((o) => o.value)).toEqual(['actif', 'a_contacter', 'inactif'])
    expect(stored[1].label).toBe('À contacter')

    // A value outside the list is refused BY POSTGRESQL, not by the application: a
    // script writing in direct SQL is held to exactly the same list.
    await expect(
      pools.withConnection('data', (exec) =>
        exec.query(
          `INSERT INTO "${schemaName}"."${tableName}" ("nom", "statut") VALUES ('X', 'inventé')`,
          [],
          'insert',
        ),
      ),
    ).rejects.toBeDefined()

    // And a value inside it goes through.
    await pools.withConnection('data', (exec) =>
      exec.query(
        `INSERT INTO "${schemaName}"."${tableName}" ("nom", "statut") VALUES ('Y', 'actif')`,
        [],
        'insert',
      ),
    )
  }, 60_000)

  it('refuses a select with no option, and one with a duplicate', async () => {
    // A column nothing can ever be written into is not a field, it is a trap.
    expect(
      await codeOf(addField(pools, ctx, { tableId, label: 'Vide', kind: 'select', options: [] })),
    ).toBe('REQUEST_INVALID')

    expect(
      await codeOf(
        addField(pools, ctx, {
          tableId,
          label: 'Doublon',
          kind: 'select',
          options: [{ value: 'a' }, { value: 'a' }],
        }),
      ),
    ).toBe('DUPLICATE_VALUE')
  })
})

describe('§1.3 — the four steps that keep SET NOT NULL instant', () => {
  it('makes a filled column required, and emits the four statements in order', async () => {
    const field = await addField(pools, ctx, { tableId, label: 'Référence', kind: 'short_text' })
    await pools.withConnection('data', (exec) =>
      exec.query(
        `UPDATE "${schemaName}"."${tableName}" SET "reference" = 'R-' || left("_id"::text, 4)`,
        [],
        'update',
      ),
    )

    const result = await setFieldRequired(pools, ctx, { fieldId: field.fieldId, required: true })

    expect(result.required).toBe(true)
    // The order is the recipe, and the recipe is the point: scaffold, validate, promote,
    // drop. A `SET NOT NULL` on its own would hold the table for a full scan.
    expect(result.sql[0]).toContain('CHECK ("reference" IS NOT NULL) NOT VALID')
    expect(result.sql[1]).toContain('VALIDATE CONSTRAINT')
    expect(result.sql[2]).toContain('SET NOT NULL')
    expect(result.sql[3]).toContain('DROP CONSTRAINT')

    expect((await column('reference')).is_nullable).toBe('NO')
  }, 120_000)

  it('leaves no scaffolding behind', async () => {
    // The scaffold's only job was to carry the proof; a constraint that outlived it
    // would be checked on every write, forever, for nothing.
    const remaining = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = $1 AND t.relname = $2 AND c.conname LIKE '%not_null%'`,
        [schemaName, tableName],
      ),
    )
    expect(remaining[0].n).toBe(0)
  })

  it('records the obligation in the catalog as well as in the column', async () => {
    const [row] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ is_required: boolean; required_state: string }>(
        `SELECT f.is_required, f.required_state
           FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.table_id = $1 AND n.name = 'reference'`,
        [tableId],
      ),
    )
    expect(row.is_required).toBe(true)
    expect(row.required_state).toBe('active')
  })

  it('REFUSES when a row would break the promise, and leaves NOTHING behind', async () => {
    const field = await addField(pools, ctx, { tableId, label: 'Obligatoire', kind: 'short_text' })
    // Left empty on purpose: the validation must fail rather than quietly succeed.
    expect(
      await codeOf(setFieldRequired(pools, ctx, { fieldId: field.fieldId, required: true })),
    ).toBe('VALIDATION_FAILED')

    // The column stays nullable — a half-applied obligation would be worse than none.
    expect((await column('obligatoire')).is_nullable).toBe('YES')

    // And the scaffold is GONE. A `NOT VALID` check is still enforced on new rows, so
    // keeping it would force every later insert to fill a column nobody made required —
    // the obligation applying in the one direction the caller did not ask for.
    const remaining = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = $1 AND c.conname LIKE '%obligatoire%'`,
        [tableName],
      ),
    )
    expect(remaining[0].n).toBe(0)

    // Which means a row can still be written WITHOUT filling the column that failed.
    // `reference` is supplied because it is required at this point in the file, and the
    // check here is about `obligatoire` alone.
    await pools.withConnection('data', (exec) =>
      exec.query(
        `INSERT INTO "${schemaName}"."${tableName}" ("nom", "reference")
         VALUES ('Après l échec', 'R-0')`,
        [],
        'insert',
      ),
    )
  }, 120_000)

  it('drops an obligation in one statement', async () => {
    const [field] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `SELECT f.id FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.table_id = $1 AND n.name = 'reference'`,
        [tableId],
      ),
    )

    const result = await setFieldRequired(pools, ctx, { fieldId: field.id, required: false })
    // Removing a constraint never scans, so there is nothing to split.
    expect(result.sql).toHaveLength(1)
    expect(result.sql[0]).toContain('DROP NOT NULL')
    expect((await column('reference')).is_nullable).toBe('YES')
  }, 60_000)

  it('refuses a formula, which cannot exist without its expression', async () => {
    // The satellite demands an expression, its canonical tree and a result type. A field
    // accepted here with none of them would be a column the catalog itself calls broken.
    expect(await codeOf(addField(pools, ctx, { tableId, label: 'Calcul', kind: 'formula' }))).toBe(
      'REQUEST_INVALID',
    )
  })
})

describe('what a new field does to the rest of the product', () => {
  it('appears in the projection, and therefore in the API and its documentation', async () => {
    const { projectBase } = await import('../../src/catalog/projection.js')
    const base = await projectBase(pools, ctx, schemaName)
    const contacts = base.tables.find((t) => t.name === tableName)

    // The catalog counter moved when the column was added, so no cache kept the old
    // shape: the description follows the structure without anyone flushing anything.
    expect(contacts?.fields.map((f) => f.name)).toContain('ville')
    expect(contacts?.fields.find((f) => f.name === 'statut')?.kind).toBe('select')
    void baseId
  }, 60_000)
})
