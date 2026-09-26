import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Saved views over HTTP — chapter 11 §1.4, chapter 02 (`view_def`).
 *
 * What a screen does with them: create one of each kind, list them in the order of the
 * selector, move them, rename them, reconfigure them, delete them — and the refusals it
 * has to say: a pivot of the wrong type, a label already taken, a key nobody reads.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let base = ''

const auth = () => ({ authorization: `Bearer ${access}` })
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...auth() },
  body: JSON.stringify(body),
})
const read = async <T>(response: Response) => (await response.json()) as T

interface View {
  id: string
  label: string
  kind: string
  position: number
  spec: Record<string, unknown>
  filter_hidden: boolean
}

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

  app = createApp({ kernel })
  await kernel.setPassword({ userId: rows[0].created_by, password: PASSWORD })
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

  const created = await app.request(`${V1}/admin/bases`, json('POST', { label: 'Chantiers' }))
  base = (await read<{ data: { name: string } }>(created)).data.name
  const table = await app.request(
    `${V1}/admin/bases/${base}/tables`,
    json('POST', {
      label: 'Visites',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Jour', kind: 'date' },
      ],
    }),
  )
  expect(table.status).toBe(201)
  const select = await app.request(
    `${V1}/admin/bases/${base}/tables/visites/fields`,
    json('POST', {
      label: 'Statut',
      kind: 'select',
      options: [
        { value: 'a_faire', label: 'À faire' },
        { value: 'fait', label: 'Fait' },
      ],
    }),
  )
  expect(select.status).toBe(201)
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

const ADMIN = () => `${V1}/admin/bases/${base}/tables/visites/views`
const LIST = () => `${V1}/meta/bases/${base}/tables/visites/views`

async function list(): Promise<View[]> {
  const response = await app.request(LIST(), { headers: auth() })
  expect(response.status).toBe(200)
  return (await read<{ data: View[] }>(response)).data
}

describe('saved views over HTTP', () => {
  it('starts with none', async () => {
    expect(await list()).toEqual([])
  })

  it('creates views of several kinds, placed one after the other', async () => {
    const grid = await app.request(
      ADMIN(),
      json('POST', {
        label: 'À traiter',
        kind: 'grid',
        spec: { filter: 'statut eq "a_faire"', sorts: [{ field: 'jour', direction: 'asc' }] },
      }),
    )
    expect(grid.status).toBe(201)
    const created = (await read<{ data: View }>(grid)).data
    expect(created).toMatchObject({ kind: 'grid', position: 1, filter_hidden: false })
    expect(created.spec).toMatchObject({ filter: 'statut eq "a_faire"', page_size: 100 })

    const kanban = await app.request(
      ADMIN(),
      json('POST', { label: 'Tableau', kind: 'kanban', spec: { group_by: 'statut' } }),
    )
    expect(kanban.status).toBe(201)
    expect((await read<{ data: View }>(kanban)).data.position).toBe(2)

    const form = await app.request(
      ADMIN(),
      json('POST', {
        label: 'Nouvelle visite',
        kind: 'form',
        spec: { title: 'Signaler une visite', fields: [{ field: 'nom', required: true }] },
      }),
    )
    expect(form.status).toBe(201)

    expect((await list()).map((v) => v.label)).toEqual(['À traiter', 'Tableau', 'Nouvelle visite'])
  })

  it('refuses a pivot of the wrong type, an unknown key and a label already taken', async () => {
    const wrong = await app.request(
      ADMIN(),
      json('POST', { label: 'Par jour', kind: 'kanban', spec: { group_by: 'jour' } }),
    )
    expect(wrong.status).toBe(400)
    expect(await read(wrong)).toMatchObject({
      code: 'REQUEST_INVALID',
      details: { reason: 'type_de_champ_incompatible', detail: 'jour' },
    })

    const typo = await app.request(
      ADMIN(),
      json('POST', { label: 'Calendrier', kind: 'calendar', spec: { date: 'jour' } }),
    )
    expect(typo.status).toBe(400)
    expect(await read(typo)).toMatchObject({ details: { reason: 'cle_inconnue', detail: 'date' } })

    const taken = await app.request(
      ADMIN(),
      json('POST', { label: 'tableau', kind: 'calendar', spec: { date_field: 'jour' } }),
    )
    expect(taken.status).toBe(422)
    expect((await read<{ code: string }>(taken)).code).toBe('LABEL_DUPLICATE')

    const kind = await app.request(ADMIN(), json('POST', { label: 'Galerie', kind: 'gallery' }))
    expect(kind.status).toBe(400)
  })

  it('moves views in the selector, keeping any the list forgets', async () => {
    const [first, second, third] = await list()
    const moved = await app.request(
      `${ADMIN()}/order`,
      json('PUT', { views: [third?.id, first?.id] }),
    )
    expect(moved.status).toBe(200)
    expect((await list()).map((v) => v.id)).toEqual([third?.id, first?.id, second?.id])
  })

  it('renames and reconfigures a view, the spec replaced whole', async () => {
    const kanban = (await list()).find((v) => v.kind === 'kanban') as View
    const patched = await app.request(
      `${ADMIN()}/${kanban.id}`,
      json('PATCH', {
        label: 'Suivi',
        spec: { group_by: 'statut', card_fields: ['jour'], hide_empty: true },
      }),
    )
    expect(patched.status).toBe(200)
    const view = (await read<{ data: View }>(patched)).data
    expect(view).toMatchObject({ label: 'Suivi', kind: 'kanban' })
    expect(view.spec).toMatchObject({ card_fields: ['jour'], hide_empty: true, sorts: [] })

    const empty = await app.request(`${ADMIN()}/${kanban.id}`, json('PATCH', {}))
    expect(empty.status).toBe(400)
  })

  it('deletes a view without touching anything else', async () => {
    const form = (await list()).find((v) => v.kind === 'form') as View
    const deleted = await app.request(`${ADMIN()}/${form.id}`, {
      method: 'DELETE',
      headers: auth(),
    })
    expect(deleted.status).toBe(204)
    expect((await list()).some((v) => v.id === form.id)).toBe(false)

    // Its label is free again: the unique index covers live views only.
    const again = await app.request(
      ADMIN(),
      json('POST', {
        label: 'Nouvelle visite',
        kind: 'survey',
        spec: { fields: [{ field: 'nom' }, { field: 'statut' }] },
      }),
    )
    expect(again.status).toBe(201)

    const gone = await app.request(`${ADMIN()}/${form.id}`, { method: 'DELETE', headers: auth() })
    expect(gone.status).toBe(404)
  })
})
