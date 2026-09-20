import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clearCaches } from '../../src/catalog/cache.js'
import { commentText } from '../../src/catalog/description.js'
import { setFieldLabel } from '../../src/catalog/field-label.js'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { projectBase } from '../../src/catalog/projection.js'
import { type SelectOptionInput, setSelectOptions } from '../../src/catalog/select-options.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The options of a list of choices, and the label of a field — chapter 04 §3, ch. 06 §1.1.
 *
 * The behaviours worth a real PostgreSQL are the ones that reach the user's table: the
 * `CHECK` that IS the list must follow it — widened, narrowed, left alone when only the
 * look changes — and must never be narrowed under rows that still carry a value.
 */

const TENANT_REF = 't4z56fq'
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let schemaName: string
let tableId: string
let tableName: string
let counter = 0

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

/** A fresh `select` per test: each one starts from a list it fully controls. */
async function newSelect(options: readonly SelectOptionInput[]) {
  counter += 1
  const field = await addField(pools, ctx, {
    tableId,
    label: `Statut ${counter}`,
    kind: 'select',
    options,
  })
  return field
}

/** The live enum constraint(s) of a column, as PostgreSQL holds them. */
async function enumConstraints(column: string) {
  return pools.withConnection('catalog', (exec) =>
    exec.query<{ conname: string; convalidated: boolean; def: string }>(
      `SELECT c.conname, c.convalidated, pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
         JOIN pg_class r     ON r.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = r.relnamespace
        WHERE n.nspname = $1 AND r.relname = $2 AND c.contype = 'c' AND c.conname LIKE $3
        ORDER BY c.conname`,
      [schemaName, tableName, `ck_${tableName}__${column}__enum%`],
    ),
  )
}

async function catalogOptions(fieldId: string) {
  return pools.withConnection('catalog', (exec) =>
    exec.query<{
      value: string
      label: string
      color: string | null
      icon: string | null
      image: string | null
      position: number
    }>(
      `SELECT value, label, color, icon, image, position
         FROM _basedb.select_option WHERE field_id = $1 ORDER BY position`,
      [fieldId],
    ),
  )
}

async function insertRow(column: string, value: string) {
  return pools.withConnection('data', (exec) =>
    exec.query(
      `INSERT INTO "${schemaName}"."${tableName}" ("nom", "${column}") VALUES ('ligne', $1)`,
      [value],
      'insert',
    ),
  )
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

  const now = new Date('2026-09-20T12:00:00.000Z')
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000005b',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'CRM' })
  schemaName = base.schemaName
  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Contacts',
    fields: [{ label: 'Nom', kind: 'short_text', required: true }],
  })
  tableId = table.tableId
  tableName = table.tableName
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('the look of an option is catalog only', () => {
  it('is stored at creation, and published by the projection with a stable shape', async () => {
    const field = await newSelect([
      { value: 'urgent', label: 'Urgent', color: '#E11D48', icon: 'flame' },
      { value: 'logo', label: 'Avec logo', image: PIXEL },
      { value: 'neutre' },
    ])

    expect(await catalogOptions(field.fieldId)).toEqual([
      {
        value: 'urgent',
        label: 'Urgent',
        color: '#e11d48',
        icon: 'flame',
        image: null,
        position: 1,
      },
      { value: 'logo', label: 'Avec logo', color: null, icon: null, image: PIXEL, position: 2 },
      { value: 'neutre', label: 'neutre', color: null, icon: null, image: null, position: 3 },
    ])

    clearCaches()
    const described = await projectBase(pools, ctx, schemaName)
    const projected = described.tables
      .find((t) => t.name === tableName)
      ?.fields.find((f) => f.name === field.name)
    expect(projected?.options).toEqual([
      { value: 'urgent', label: 'Urgent', color: '#e11d48', icon: 'flame', image: null },
      { value: 'logo', label: 'Avec logo', color: null, icon: null, image: PIXEL },
      { value: 'neutre', label: 'neutre', color: null, icon: null, image: null },
    ])
  }, 60_000)

  it('is held by the catalog itself: a colour, an icon, a picture and both at once', async () => {
    const field = await newSelect([{ value: 'a' }])
    const write = (set: string) =>
      pools.withConnection('catalog', (exec) =>
        exec.query(
          `UPDATE _basedb.select_option SET ${set} WHERE field_id = $1`,
          [field.fieldId],
          'update',
        ),
      )

    for (const set of [
      `color = 'rouge'`,
      `color = '#FF0000'`,
      `icon = 'Star'`,
      `image = repeat('x', 16385)`,
      `icon = 'star', image = 'https://example.com/a.png'`,
    ]) {
      const refused = await failure(write(set))
      expect((refused.cause as { code?: string }).code, set).toBe('23514')
    }
    await write(`color = '#ff0000', icon = 'star'`)
  }, 60_000)

  it('changing ONLY the look emits nothing and leaves the constraint alone', async () => {
    const field = await newSelect([{ value: 'a' }, { value: 'b' }])
    const before = await enumConstraints(field.name)
    expect(before).toHaveLength(1)

    const result = await setSelectOptions(pools, ctx, {
      fieldId: field.fieldId,
      // The same two values, reordered, relabelled and dressed.
      options: [
        { value: 'b', label: 'Bravo', color: '#00ff00', icon: 'check' },
        { value: 'a', label: 'Alpha', image: PIXEL },
      ],
    })

    expect(result).toMatchObject({ added: [], removed: [], sql: [] })
    expect(await enumConstraints(field.name)).toEqual(before)
    expect(await catalogOptions(field.fieldId)).toEqual([
      { value: 'b', label: 'Bravo', color: '#00ff00', icon: 'check', image: null, position: 1 },
      { value: 'a', label: 'Alpha', color: null, icon: null, image: PIXEL, position: 2 },
    ])
  }, 60_000)
})

describe('the set of values is the CHECK, and it follows', () => {
  it('adding an option regenerates the constraint in three steps, on a populated table', async () => {
    const field = await newSelect([{ value: 'a' }, { value: 'b' }])
    await insertRow(field.name, 'a')
    const [old] = await enumConstraints(field.name)

    const result = await setSelectOptions(pools, ctx, {
      fieldId: field.fieldId,
      options: [{ value: 'a' }, { value: 'b' }, { value: 'c', label: 'Ceci', color: '#123456' }],
    })

    expect(result.added).toEqual(['c'])
    expect(result.removed).toEqual([])
    // `DROP` and `ADD … NOT VALID` in one statement, then the `VALIDATE` on its own.
    expect(result.sql).toHaveLength(2)
    expect(result.sql[0]).toMatch(/DROP CONSTRAINT .* ADD CONSTRAINT .* NOT VALID;$/)
    expect(result.sql[1]).toMatch(/VALIDATE CONSTRAINT/)

    const constraints = await enumConstraints(field.name)
    expect(constraints).toHaveLength(1)
    // A regeneration consumes a NEW name: the registry never gives one back.
    expect(constraints[0].conname).not.toBe(old.conname)
    expect(constraints[0].conname).toMatch(/__enum_2$/)
    expect(constraints[0].convalidated).toBe(true)
    expect(constraints[0].def).toContain("'c'")

    const state = await pools.withConnection('catalog', (exec) =>
      exec.query<{ state: string; current: boolean }>(
        `SELECT k.state, (k.id = sc.enum_constraint_id) AS current
           FROM _basedb.field_select_config sc
           JOIN _basedb.table_constraint_member m ON m.field_id = sc.field_id
           JOIN _basedb.table_constraint k ON k.id = m.constraint_id AND k.rule = 'enum'
          WHERE sc.field_id = $1 ORDER BY k.created_at`,
        [field.fieldId],
      ),
    )
    expect(state).toEqual([
      { state: 'dropped', current: false },
      { state: 'active', current: true },
    ])

    // The row written before is still there; the new value now goes in, a stranger does not.
    await insertRow(field.name, 'c')
    const stranger = await failure(insertRow(field.name, 'z'))
    expect((stranger.cause as { code?: string }).code).toBe('23514')
  }, 90_000)

  it('removing an UNUSED option narrows the constraint', async () => {
    const field = await newSelect([{ value: 'a' }, { value: 'b' }, { value: 'c' }])
    await insertRow(field.name, 'a')

    const result = await setSelectOptions(pools, ctx, {
      fieldId: field.fieldId,
      options: [{ value: 'a' }, { value: 'b' }],
    })

    expect(result.removed).toEqual(['c'])
    expect((await catalogOptions(field.fieldId)).map((o) => o.value)).toEqual(['a', 'b'])
    const [constraint] = await enumConstraints(field.name)
    expect(constraint.convalidated).toBe(true)
    expect(constraint.def).not.toContain("'c'")

    const refused = await failure(insertRow(field.name, 'c'))
    expect((refused.cause as { code?: string }).code).toBe('23514')
  }, 90_000)

  it('removing a USED option is refused with the count, and nothing moves', async () => {
    const field = await newSelect([{ value: 'a' }, { value: 'b' }, { value: 'c' }])
    await insertRow(field.name, 'b')
    await insertRow(field.name, 'b')
    await insertRow(field.name, 'a')
    const before = await enumConstraints(field.name)

    const refused = await failure(
      setSelectOptions(pools, ctx, {
        fieldId: field.fieldId,
        // Drops `b` (carried by two rows) and `c` (unused) and dresses `a`.
        options: [{ value: 'a', color: '#ff0000' }],
      }),
    )

    expect(refused.code).toBe('OPTION_IN_USE')
    expect(refused.details).toMatchObject({ options: [{ value: 'b', count: 2 }] })

    // All or nothing: not the removal of `c`, not the colour of `a`, not the constraint.
    expect((await catalogOptions(field.fieldId)).map((o) => [o.value, o.color])).toEqual([
      ['a', null],
      ['b', null],
      ['c', null],
    ])
    expect(await enumConstraints(field.name)).toEqual(before)
    await insertRow(field.name, 'b')
  }, 90_000)

  it('renaming a value is not renaming: it is one added and one removed', async () => {
    const field = await newSelect([{ value: 'ancien' }])
    await insertRow(field.name, 'ancien')

    const refused = await failure(
      setSelectOptions(pools, ctx, { fieldId: field.fieldId, options: [{ value: 'nouveau' }] }),
    )
    expect(refused.code).toBe('OPTION_IN_USE')
  }, 60_000)
})

describe('refusals', () => {
  it('a field that is not a list of choices', async () => {
    const text = await addField(pools, ctx, { tableId, label: 'Commentaire', kind: 'short_text' })
    const refused = await failure(
      setSelectOptions(pools, ctx, { fieldId: text.fieldId, options: [{ value: 'a' }] }),
    )
    expect(refused.code).toBe('REQUEST_INVALID')
    expect(refused.details).toMatchObject({ reason: 'pas_une_liste_de_choix' })
  }, 60_000)

  it('an unknown field, and an invalid list before anything is written', async () => {
    const unknown = await failure(
      setSelectOptions(pools, ctx, {
        fieldId: '018f3c2a-0000-7000-8000-000000000001',
        options: [{ value: 'a' }],
      }),
    )
    expect(unknown.code).toBe('RESOURCE_NOT_FOUND')

    const field = await newSelect([{ value: 'a' }])
    const bad = await failure(
      setSelectOptions(pools, ctx, {
        fieldId: field.fieldId,
        options: [{ value: 'a', color: 'rouge' }],
      }),
    )
    expect(bad.details).toMatchObject({ reason: 'couleur_invalide' })
    expect((await catalogOptions(field.fieldId)).map((o) => o.color)).toEqual([null])
  }, 60_000)
})

describe('the label of a field', () => {
  async function commentOf(column: string): Promise<string | null> {
    const [row] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ comment: string | null }>(
        `SELECT col_description(c.oid, a.attnum) AS comment
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid
          WHERE n.nspname = $1 AND c.relname = $2 AND a.attname = $3`,
        [schemaName, tableName, column],
      ),
    )
    return row.comment
  }

  it('renames the label and never the column, and the comment follows', async () => {
    const field = await addField(pools, ctx, { tableId, label: 'Ville', kind: 'short_text' })

    const renamed = await setFieldLabel(pools, ctx, { fieldId: field.fieldId, label: '  Commune ' })
    expect(renamed).toEqual({ label: 'Commune' })

    const [row] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ label: string; label_key: string }>(
        'SELECT label, label_key FROM _basedb.field WHERE id = $1',
        [field.fieldId],
      ),
    )
    expect(row).toEqual({ label: 'Commune', label_key: 'commune' })

    // The physical column is the one it was born with: psql scripts keep working.
    expect(await commentOf(field.name)).toBe(commentText('Commune', null))
    const columns = await pools.withConnection('catalog', (exec) =>
      exec.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
        [schemaName, tableName, field.name],
      ),
    )
    expect(columns).toHaveLength(1)
  }, 60_000)

  it('keeps the description as the comment when there is one', async () => {
    const field = await addField(pools, ctx, {
      tableId,
      label: 'Pays',
      kind: 'short_text',
      description: 'Pays du siège',
    })
    await setFieldLabel(pools, ctx, { fieldId: field.fieldId, label: 'Pays du siège social' })
    expect(await commentOf(field.name)).toBe(commentText('Pays du siège social', 'Pays du siège'))
  }, 60_000)

  it('refuses a label already taken in the table — case and spacing aside — an empty one and a long one', async () => {
    const a = await addField(pools, ctx, { tableId, label: 'Code postal', kind: 'short_text' })
    const b = await addField(pools, ctx, { tableId, label: 'Région', kind: 'short_text' })

    const taken = await failure(
      setFieldLabel(pools, ctx, { fieldId: b.fieldId, label: '  CODE   postal ' }),
    )
    expect(taken.code).toBe('LABEL_DUPLICATE')

    expect(
      (await failure(setFieldLabel(pools, ctx, { fieldId: b.fieldId, label: '  ' }))).code,
    ).toBe('LABEL_EMPTY')
    expect(
      (await failure(setFieldLabel(pools, ctx, { fieldId: b.fieldId, label: 'é'.repeat(256) })))
        .code,
    ).toBe('LABEL_TOO_LONG')

    // Keeping its own label is not a clash with itself.
    expect(await setFieldLabel(pools, ctx, { fieldId: a.fieldId, label: 'Code postal' })).toEqual({
      label: 'Code postal',
    })
  }, 60_000)
})
