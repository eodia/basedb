import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * The types and formats beyond the first nine — chapter 04, chapter 02 (« Un type, ou un
 * format ? »): an e-mail held by a CHECK, a number the database gives, a person of the
 * tenant, and numbers or texts that only READ differently.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let base = ''
let me = ''

const auth = () => ({ authorization: `Bearer ${access}` })
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...auth() },
  body: JSON.stringify(body),
})
const read = async <T>(response: Response) => (await response.json()) as T

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()

  const { Client } = await import('pg')
  const client = new Client({ connectionString: container.getConnectionUri() })
  await client.connect()
  await client.query('BEGIN')
  const { rows } = await client.query(
    `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
     VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
     RETURNING id, created_by`,
    [TENANT_REF],
  )
  await client.query(
    `INSERT INTO _basedb.app_user
       (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
     VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
    [rows[0].created_by, rows[0].id],
  )
  await client.query('COMMIT')
  await client.end()
  me = rows[0].created_by

  app = createApp({ kernel })
  await kernel.setPassword({ userId: me, password: PASSWORD })
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

  const created = await app.request(`${V1}/admin/bases`, json('POST', { label: 'Contacts' }))
  base = (await read<{ data: { name: string } }>(created)).data.name
  const table = await app.request(
    `${V1}/admin/bases/${base}/tables`,
    json('POST', {
      label: 'Personnes',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Courriel', kind: 'email' },
      ],
    }),
  )
  expect(table.status).toBe(201)
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

const FIELDS = () => `${V1}/admin/bases/${base}/tables/personnes/fields`
const DATA = () => `${V1}/data/${base}/personnes`

async function describeFields(): Promise<Array<Record<string, unknown>>> {
  const response = await app.request(`${V1}/meta/bases/${base}`, { headers: auth() })
  const body = await read<{
    data: { tables: Array<{ fields: Array<Record<string, unknown>> }> }
  }>(response)
  return body.data.tables[0]?.fields ?? []
}

describe('new types and formats over HTTP', () => {
  it('holds an e-mail to being one, in the API and in the database', async () => {
    const ok = await app.request(
      DATA(),
      json('POST', { values: { nom: 'Léa', courriel: ' mailto:lea@exemple.fr ' } }),
    )
    expect(ok.status).toBe(201)
    expect((await read<{ data: { courriel: string } }>(ok)).data.courriel).toBe('lea@exemple.fr')

    const bad = await app.request(
      DATA(),
      json('POST', { values: { nom: 'X', courriel: 'pas une adresse' } }),
    )
    expect(await read(bad)).toMatchObject({
      code: 'VALUE_INVALID',
      details: { reason: 'adresse_email' },
    })
  })

  it('numbers the rows already there when an autonumber is added, and never lets it be written', async () => {
    await app.request(DATA(), json('POST', { values: { nom: 'Hugo' } }))
    const added = await app.request(FIELDS(), json('POST', { label: 'Numéro', kind: 'autonumber' }))
    expect(added.status).toBe(201)

    const next = await app.request(DATA(), json('POST', { values: { nom: 'Inès' } }))
    expect(next.status).toBe(201)
    const list = await read<{ data: Array<{ nom: string; numero: string }> }>(
      await app.request(`${DATA()}?sort=numero`, { headers: auth() }),
    )
    expect(list.data.map((r) => [r.nom, String(r.numero)])).toEqual([
      ['Léa', '1'],
      ['Hugo', '2'],
      ['Inès', '3'],
    ])

    const write = await app.request(DATA(), json('POST', { values: { nom: 'Zoé', numero: 99 } }))
    expect(write.status).toBeGreaterThanOrEqual(400)

    const required = await app.request(
      `${FIELDS()}/numero/required`,
      json('POST', { required: true }),
    )
    expect(await read(required)).toMatchObject({ details: { reason: 'numero_automatique' } })
  })

  it('writes a table whose columns are called n and o — the history capture’s own letters', async () => {
    // « N° » becomes `n`: the capture trigger once called its transition rows `n` and `o`,
    // and every write of such a table failed on an ambiguous `to_jsonb(n)`.
    for (const [label, kind] of [
      ['N°', 'autonumber'],
      ['O', 'short_text'],
    ]) {
      expect((await app.request(FIELDS(), json('POST', { label, kind }))).status).toBe(201)
    }
    const created = await app.request(DATA(), json('POST', { values: { nom: 'Noé', o: 'un' } }))
    expect(created.status).toBe(201)
    const { data } = await read<{ data: { _id: string } }>(created)

    const current = await app.request(`${DATA()}/${data._id}`, { headers: auth() })
    const updated = await app.request(`${DATA()}/${data._id}`, {
      ...json('PATCH', { values: { o: 'deux' } }),
      headers: {
        'content-type': 'application/json',
        ...auth(),
        'if-match': current.headers.get('etag') ?? '',
      },
    })
    expect(updated.status).toBe(200)
    expect((await read<{ data: { o: string } }>(updated)).data.o).toBe('deux')
  })

  it('assigns a person of the tenant, and no one else', async () => {
    const added = await app.request(FIELDS(), json('POST', { label: 'Responsable', kind: 'user' }))
    expect(added.status).toBe(201)

    const members = await read<{ data: Array<{ id: string; display_name: string }> }>(
      await app.request(`${V1}/meta/users`, { headers: auth() }),
    )
    expect(members.data.map((m) => m.id)).toContain(me)

    const ok = await app.request(DATA(), json('POST', { values: { nom: 'Max', responsable: me } }))
    expect(ok.status).toBe(201)
    const stranger = await app.request(
      DATA(),
      json('POST', {
        values: { nom: 'Max', responsable: '01890a5d-ac96-774b-bcce-b302099a8057' },
      }),
    )
    expect(await read(stranger)).toMatchObject({ details: { reason: 'personne_inconnue' } })

    const filtered = await read<{ data: unknown[] }>(
      await app.request(`${DATA()}?filter=${encodeURIComponent(`responsable eq "${me}"`)}`, {
        headers: auth(),
      }),
    )
    expect(filtered.data).toHaveLength(1)
  })

  it('publishes formats, and changes them without a migration', async () => {
    await app.request(
      FIELDS(),
      json('POST', { label: 'Budget', kind: 'number', format: { display: 'currency' } }),
    )
    await app.request(
      FIELDS(),
      json('POST', {
        label: 'Note',
        kind: 'number',
        format: { display: 'rating', rating_max: 3 },
      }),
    )
    await app.request(
      FIELDS(),
      json('POST', { label: 'Téléphone', kind: 'short_text', format: { display: 'phone' } }),
    )
    const fields = await describeFields()
    const byName = new Map(fields.map((f) => [f.name, f]))
    expect(byName.get('budget')?.format).toEqual({
      display: 'currency',
      currency: 'EUR',
      rating_max: null,
    })
    expect(byName.get('note')?.format).toEqual({ display: 'rating', currency: null, rating_max: 3 })
    expect(byName.get('telephone')?.format).toMatchObject({ display: 'phone' })
    expect(byName.get('nom')?.format).toBeUndefined()
    expect(byName.get('courriel')).toMatchObject({
      kind: 'email',
      operators: expect.arrayContaining(['contains']),
    })

    const patched = await app.request(
      `${FIELDS()}/budget`,
      json('PATCH', { format: { display: 'currency', currency: 'usd' } }),
    )
    expect(patched.status).toBe(200)
    expect((await read<{ data: { format: unknown } }>(patched)).data.format).toEqual({
      display: 'currency',
      currency: 'USD',
      rating_max: null,
    })

    const wrong = await app.request(
      `${FIELDS()}/nom`,
      json('PATCH', { format: { display: 'rating' } }),
    )
    expect(await read(wrong)).toMatchObject({
      details: { field: 'format', reason: 'format_inconnu' },
    })
  })
})
