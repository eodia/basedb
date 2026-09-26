import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * The multi-link — chapter 04 §4 bis: a `uuid[]` of target rows in the order they were
 * linked, held to its target by two triggers, in PostgreSQL, whoever writes.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let base = ''
const people: Record<string, string> = {}

const auth = () => ({ authorization: `Bearer ${access}` })
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...auth() },
  body: JSON.stringify(body),
})
const read = async <T>(response: Response) => (await response.json()) as T
const DATA = (table: string) => `${V1}/data/${base}/${table}`

async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: container.getConnectionUri() })
  await client.connect()
  try {
    return (await client.query(text, params)).rows as T[]
  } finally {
    await client.end()
  }
}

async function create(table: string, values: Record<string, unknown>): Promise<string> {
  const response = await app.request(DATA(table), json('POST', { values }))
  expect(response.status).toBe(201)
  return (await read<{ data: { _id: string } }>(response)).data._id
}

async function patch(table: string, id: string, values: Record<string, unknown>) {
  const current = await app.request(`${DATA(table)}/${id}`, { headers: auth() })
  return app.request(`${DATA(table)}/${id}`, {
    ...json('PATCH', { values }),
    headers: {
      'content-type': 'application/json',
      ...auth(),
      'if-match': current.headers.get('etag') ?? '',
    },
  })
}

async function remove(table: string, id: string) {
  const current = await app.request(`${DATA(table)}/${id}`, { headers: auth() })
  return app.request(`${DATA(table)}/${id}`, {
    method: 'DELETE',
    headers: { ...auth(), 'if-match': current.headers.get('etag') ?? '' },
  })
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()

  const [bootstrap] = await sql<{ id: string; created_by: string }>(
    `WITH t AS (
       INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by)
     INSERT INTO _basedb.app_user
       (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
     SELECT created_by, id, 'bootstrap@basedb.local', 'Bootstrap', true, true, created_by, created_by
       FROM t
     RETURNING id, id AS created_by`,
    [TENANT_REF],
  )

  app = createApp({ kernel })
  await kernel.setPassword({ userId: bootstrap.id, password: PASSWORD })
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = (await read<{ data: { csrf: string } }>(login)).data.csrf
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  access = (await read<{ data: { token: string } }>(issued)).data.token

  const created = await app.request(`${V1}/admin/bases`, json('POST', { label: 'Projets' }))
  base = (await read<{ data: { name: string } }>(created)).data.name
  for (const label of ['Personnes', 'Taches']) {
    const table = await app.request(
      `${V1}/admin/bases/${base}/tables`,
      json('POST', { label, fields: [{ label: 'Nom', kind: 'short_text' }] }),
    )
    expect(table.status).toBe(201)
  }
  await app.request(
    `${V1}/admin/bases/${base}/tables/personnes/display`,
    json('POST', { field: 'nom' }),
  )
  for (const nom of ['Léa', 'Hugo', 'Inès']) people[nom] = await create('personnes', { nom })
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('multi-links over HTTP', () => {
  it('creates the field: a uuid[] column, its GIN index, its two triggers', async () => {
    const added = await app.request(
      `${V1}/admin/bases/${base}/tables/taches/links`,
      json('POST', { label: 'Assignées', target: 'personnes', multiple: true }),
    )
    expect(added.status).toBe(201)
    expect((await read<{ data: Record<string, unknown> }>(added)).data).toMatchObject({
      kind: 'multi_link',
      name: 'personnes_ids',
      constraint: null,
      on_delete: 'set_null',
    })

    const [column] = await sql<{ type: string }>(
      `SELECT format_type(a.atttypid, a.atttypmod) AS type
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = 'taches' AND a.attname = 'personnes_ids'`,
      [base],
    )
    expect(column?.type).toBe('uuid[]')
    const triggers = await sql<{ tgname: string }>(
      `SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND t.tgname LIKE '%\\_\\_ml%' ORDER BY 1`,
      [base],
    )
    expect(triggers.map((t) => t.tgname)).toEqual([
      'tg_personnes__mlt_taches_personnes_ids',
      'tg_taches__ml_personnes_ids',
    ])
    const [index] = await sql<{ method: string }>(
      `SELECT am.amname AS method FROM pg_index i
         JOIN pg_class x ON x.oid = i.indexrelid JOIN pg_am am ON am.oid = x.relam
        WHERE x.relname = 'ix_taches__personnes_ids'`,
    )
    expect(index?.method).toBe('gin')
  })

  it('writes ids or objects, keeps their order, drops repeats, reads displays', async () => {
    const id = await create('taches', {
      nom: 'Cadrage',
      personnes_ids: [people.Hugo, { id: people.Léa }, people.Hugo],
    })
    const row = await read<{ data: { personnes_ids: unknown } }>(
      await app.request(`${DATA('taches')}/${id}`, { headers: auth() }),
    )
    expect(row.data.personnes_ids).toEqual([
      { id: people.Hugo, display: 'Hugo' },
      { id: people.Léa, display: 'Léa' },
    ])

    const empty = await patch('taches', id, { personnes_ids: [] })
    expect(empty.status).toBe(200)
    expect((await read<{ data: { personnes_ids: unknown } }>(empty)).data.personnes_ids).toBeNull()
  })

  it('refuses a row that does not exist, through the API and in raw SQL', async () => {
    const ghost = '01890a5d-ac96-774b-bcce-b302099a8057'
    const refused = await app.request(
      DATA('taches'),
      json('POST', { values: { nom: 'X', personnes_ids: [people.Léa, ghost] } }),
    )
    expect(await read(refused)).toMatchObject({
      code: 'LINK_TARGET_NOT_FOUND',
      details: { id: ghost },
    })

    await expect(
      sql(
        `INSERT INTO "${base}"."taches" (nom, personnes_ids, _created_by, _updated_by)
           VALUES ('SQL', ARRAY[$1::uuid], _basedb_local.uuid_generate_v7(), _basedb_local.uuid_generate_v7())`,
        [ghost],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      sql(
        `INSERT INTO "${base}"."taches" (nom, personnes_ids, _created_by, _updated_by)
           VALUES ('SQL', ARRAY[$1::uuid, $1::uuid], _basedb_local.uuid_generate_v7(), _basedb_local.uuid_generate_v7())`,
        [people.Léa],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('filters on what the list holds, and through it to the target', async () => {
    await create('taches', { nom: 'Maquettes', personnes_ids: [people.Inès, people.Hugo] })
    await create('taches', { nom: 'Recette', personnes_ids: [people.Inès] })
    const names = async (filter: string) =>
      (
        await read<{ data: Array<{ nom: string }> }>(
          await app.request(`${DATA('taches')}?filter=${encodeURIComponent(filter)}&sort=nom`, {
            headers: auth(),
          }),
        )
      ).data.map((r) => r.nom)

    expect(await names(`personnes_ids has_any "${people.Hugo}"`)).toEqual(['Maquettes'])
    expect(await names(`personnes_ids has_all ["${people.Inès}", "${people.Hugo}"]`)).toEqual([
      'Maquettes',
    ])
    expect(await names('personnes_ids.nom eq "Inès"')).toEqual(['Maquettes', 'Recette'])
    expect(await names('personnes_ids is_null')).toEqual(['Cadrage'])
  })

  it('lists the rows that cite a row, in its inverse links', async () => {
    const blocks = await read<{ data: Array<{ field: string; count: number }> }>(
      await app.request(`${DATA('personnes')}/${people.Inès}/referenced_by`, { headers: auth() }),
    )
    expect(blocks.data).toMatchObject([{ field: 'personnes_ids', count: 2 }])
  })

  it('removes a deleted row from the lists, keeping the order of the others', async () => {
    const gone = await remove('personnes', people.Inès)
    expect(gone.status).toBe(204)
    const rows = await read<{ data: Array<{ nom: string; personnes_ids: unknown }> }>(
      await app.request(`${DATA('taches')}?sort=nom`, { headers: auth() }),
    )
    expect(rows.data.map((r) => [r.nom, r.personnes_ids])).toEqual([
      ['Cadrage', null],
      ['Maquettes', [{ id: people.Hugo, display: 'Hugo' }]],
      ['Recette', null],
    ])
  })

  it('refuses the deletion of a row still cited, when the relation says restrict', async () => {
    const added = await app.request(
      `${V1}/admin/bases/${base}/tables/taches/links`,
      json('POST', {
        label: 'Relecteurs',
        target: 'personnes',
        multiple: true,
        on_delete: 'restrict',
      }),
    )
    expect(added.status).toBe(201)
    const name = (await read<{ data: { name: string } }>(added)).data.name
    await create('taches', { nom: 'Revue', [name]: [people.Léa] })

    const refused = await remove('personnes', people.Léa)
    expect(await read(refused)).toMatchObject({ code: 'ROW_REFERENCED' })
  })
})
