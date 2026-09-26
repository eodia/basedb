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

    const kind = await app.request(ADMIN(), json('POST', { label: 'Mosaïque', kind: 'mosaique' }))
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

describe('aggregates over HTTP', () => {
  const DATA = () => `${V1}/data/${base}/visites`

  it('summarises every row the filter keeps, and counts the groups', async () => {
    for (const [nom, jour, statut] of [
      ['Lyon', '2026-09-01', 'fait'],
      ['Nice', '2026-09-03', 'fait'],
      ['Brest', '2026-09-10', 'a_faire'],
      ['', null, null],
    ]) {
      const created = await app.request(DATA(), json('POST', { values: { nom, jour, statut } }))
      expect(created.status).toBe(201)
    }

    const response = await app.request(
      `${DATA()}/aggregate?aggregates=nom:filled,nom:empty,jour:min,jour:max,statut:unique&group=statut`,
      { headers: auth() },
    )
    expect(response.status).toBe(200)
    const { data } = await read<{
      data: {
        total: number
        values: Record<string, unknown>
        groups: Array<{ value: unknown; count: number }>
      }
    }>(response)
    expect(data.total).toBe(4)
    expect(data.values).toEqual({
      'nom:filled': 3,
      'nom:empty': 1,
      'jour:min': '2026-09-01',
      'jour:max': '2026-09-10',
      'statut:unique': 2,
    })
    expect(data.groups).toEqual([
      { value: null, count: 1 },
      { value: 'a_faire', count: 1 },
      { value: 'fait', count: 2 },
    ])

    const filtered = await app.request(
      `${DATA()}/aggregate?aggregates=nom:filled&filter=${encodeURIComponent('statut eq "fait"')}`,
      { headers: auth() },
    )
    expect((await read<{ data: { total: number } }>(filtered)).data.total).toBe(2)
  })

  it('refuses a sum of a text, and a field nobody can see', async () => {
    const sum = await app.request(`${DATA()}/aggregate?aggregates=nom:sum`, { headers: auth() })
    expect(sum.status).toBe(400)
    expect(await read(sum)).toMatchObject({ details: { reason: 'agregat_invalide' } })

    const unknown = await app.request(`${DATA()}/aggregate?aggregates=secret:filled`, {
      headers: auth(),
    })
    expect((await read<{ code: string }>(unknown)).code).toBe('FILTER_FIELD_UNKNOWN')
  })

  it('groups and summarises by who created a row and when', async () => {
    const response = await app.request(
      `${DATA()}/aggregate?aggregates=_created_at:max,_created_by:unique&group=_created_by`,
      { headers: auth() },
    )
    expect(response.status).toBe(200)
    const { data } = await read<{
      data: { values: Record<string, unknown>; groups: Array<{ count: number }> }
    }>(response)
    expect(data.values['_created_by:unique']).toBe(1)
    expect(data.groups).toHaveLength(1)
    expect(data.groups[0]?.count).toBe(4)
  })
})

describe('system columns in a view', () => {
  it('shows them on request, sorts by them, and never asks them in a form', async () => {
    const grid = await app.request(
      ADMIN(),
      json('POST', {
        label: 'Récentes',
        kind: 'grid',
        spec: {
          sorts: [{ field: '_created_at', direction: 'desc' }],
          system_columns: ['_created_at', '_created_by'],
        },
      }),
    )
    expect(grid.status).toBe(201)
    expect((await read<{ data: View }>(grid)).data.spec).toMatchObject({
      sorts: [{ field: '_created_at', direction: 'desc' }],
      system_columns: ['_created_at', '_created_by'],
    })

    const form = await app.request(
      ADMIN(),
      json('POST', {
        label: 'Formulaire système',
        kind: 'form',
        spec: { fields: [{ field: '_created_by' }] },
      }),
    )
    expect(form.status).toBe(400)
    expect(await read(form)).toMatchObject({
      details: { reason: 'type_de_champ_incompatible', detail: '_created_by' },
    })
  })
})

describe('a view shared to be read', () => {
  it('shows the fields and the rows of the view, and nothing else', async () => {
    const created = await app.request(
      ADMIN(),
      json('POST', {
        label: 'Faites',
        kind: 'grid',
        spec: {
          filter: 'statut eq "fait"',
          sorts: [{ field: 'nom', direction: 'desc' }],
          hidden: ['jour'],
        },
      }),
    )
    const view = (await read<{ data: View }>(created)).data
    const shared = await app.request(
      `${ADMIN()}/${view.id}/share`,
      json('PUT', { access: 'public', active: true, can_embed: true }),
    )
    expect(shared.status).toBe(200)
    const share = (
      await read<{ data: { share: { token: string; can_embed: boolean; view_kind: string } } }>(
        shared,
      )
    ).data.share
    expect(share).toMatchObject({ can_embed: true, view_kind: 'grid' })

    // No bearer: the link is the door.
    const page = await app.request(`/api/v1/views/${share.token}`)
    expect(page.status).toBe(200)
    const { data } = await read<{
      data: {
        kind: string
        can_embed: boolean
        fields: Array<{ name: string }>
        rows: Array<Record<string, unknown>>
        spec: Record<string, unknown>
      }
    }>(page)
    expect(data).toMatchObject({ kind: 'grid', can_embed: true })
    expect(data.fields.map((f) => f.name)).toEqual(['nom', 'statut'])
    expect(data.rows.map((r) => r.nom)).toEqual(['Nice', 'Lyon'])
    // What the view hides, and its filter, stay out of the page.
    expect(data.rows[0]).not.toHaveProperty('jour')
    expect(data.rows[0]).not.toHaveProperty('_created_by')
    expect(data.spec).not.toHaveProperty('filter')

    // Switched off, the page says so; opened as a form, the link is nothing.
    await app.request(
      `${ADMIN()}/${view.id}/share`,
      json('PUT', { access: 'public', active: false }),
    )
    expect(await read(await app.request(`/api/v1/views/${share.token}`))).toMatchObject({
      code: 'VIEW_SHARE_CLOSED',
      details: { reason: 'inactive' },
    })
    expect((await app.request(`/api/v1/forms/${share.token}`)).status).toBe(404)
  })
})
