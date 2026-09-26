import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Dashboards over HTTP — chapter 18.
 *
 * What these guard: blocks are checked when saved — a table, a field, an address that do
 * not exist or do not suit are refused; the dashboards of a base are listed to whoever
 * may read one of its tables, and to nobody else.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

type Session = { cookie: string; csrf: string; token: string }

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let admin: Session
let alice: Session
let bob: Session
let aliceId = ''
let bobId = ''
let base = ''

async function signIn(email: string, password: string): Promise<Session> {
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = ((await login.json()) as { data: { csrf: string } }).data.csrf
  return { cookie, csrf, token: await accessFor(cookie, csrf) }
}

async function accessFor(cookie: string, csrf: string): Promise<string> {
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  return ((await issued.json()) as { data: { token: string } }).data.token
}

async function elevate(session: Session): Promise<Session> {
  const r = await app.request('/auth/elevate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    body: JSON.stringify({ password: PASSWORD }),
  })
  expect(r.status).toBe(200)
  const planted = r.headers.getSetCookie()
  const cookie = planted.find((c) => c.includes('basedb_session'))?.split(';')[0] ?? ''
  const csrf =
    planted
      .find((c) => c.includes('basedb_csrf'))
      ?.split(';')[0]
      ?.split('=')[1] ?? ''
  return { cookie, csrf, token: await accessFor(cookie, csrf) }
}

const call = (session: Session, path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function data<T>(r: Response): Promise<T> {
  return ((await r.json()) as { data: T }).data
}

/** An account, its temporary password changed for a known one. */
async function person(email: string, name: string): Promise<{ id: string; session: Session }> {
  const r = await call(admin, `${V1}/admin/users`, 'POST', { email, display_name: name })
  expect(r.status).toBe(201)
  const created = await data<{ user: { id: string }; temporary_password: string }>(r)
  const first = await signIn(email, created.temporary_password)
  const changed = await app.request('/auth/password/change', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: first.cookie,
      'x-basedb-csrf': first.csrf,
    },
    body: JSON.stringify({ current: created.temporary_password, next: PASSWORD }),
  })
  expect(changed.status).toBe(204)
  return { id: created.user.id, session: await signIn(email, PASSWORD) }
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
  admin = await elevate(await signIn('bootstrap@basedb.local', PASSWORD))

  const created = await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Chantiers' })
  base = (await data<{ name: string }>(created)).name
  const table = await call(admin, `${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Visites',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Note', kind: 'short_text' },
    ],
  })
  expect(table.status).toBe(201)
  const tableId = (await data<{ id: string }>(table)).id
  const owner = await call(admin, `${V1}/admin/bases/${base}/tables/visites/fields`, 'POST', {
    label: 'Responsable',
    kind: 'user',
  })
  expect(owner.status).toBe(201)

  const a = await person('alice@exemple.fr', 'Alice Martin')
  aliceId = a.id
  alice = a.session
  const b = await person('bob@exemple.fr', 'Bob Durand')
  bobId = b.id
  bob = b.session

  // Alice reads the table; Bob sees nothing of it.
  const group = await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Lecteurs' })
  const groupId = (await data<{ id: string }>(group)).id
  expect(
    (await call(admin, `${V1}/admin/groups/${groupId}/members/${aliceId}`, 'PUT')).status,
  ).toBe(204)
  const granted = await call(admin, `${V1}/admin/access`, 'POST', {
    changes: [{ group: groupId, scope: { kind: 'table', id: tableId }, level: 'read' }],
  })
  expect(granted.status).toBe(200)
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

const DASHBOARDS = () => `${V1}/admin/bases/${base}/dashboards`

describe('a dashboard', () => {
  let id = ''

  it('is saved with its blocks, table names read as keys', async () => {
    const r = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Suivi',
      blocks: [
        { kind: 'number', title: 'Visites', table: 'visites', aggregate: 'count', width: 1 },
        {
          kind: 'chart',
          title: 'Par responsable',
          table: 'visites',
          group_by: 'responsable',
          style: 'pie',
        },
        { kind: 'list', title: 'Dernières', table: 'visites', fields: ['nom', 'note'], limit: 50 },
        { kind: 'text', title: 'À lire', body: '# Consignes', width: 3 },
        { kind: 'embed', title: 'Météo', url: 'https://exemple.fr/meteo', height: 300 },
      ],
    })
    expect(r.status).toBe(201)
    const created = await data<{ id: string; blocks: Array<Record<string, unknown>> }>(r)
    id = created.id
    expect(created.blocks[0]).toMatchObject({ kind: 'number', aggregate: 'count', field: null })
    expect(created.blocks[1]).toMatchObject({
      kind: 'chart',
      group_by: 'responsable',
      style: 'pie',
    })
    // A list shows twenty rows at most.
    expect(created.blocks[2]).toMatchObject({ kind: 'list', limit: 20 })
    expect(created.blocks[0]?.table).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('refuses a block naming what does not exist, or an address that is not https', async () => {
    const field = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Cassé',
      blocks: [{ kind: 'number', table: 'visites', aggregate: 'sum', field: 'absent' }],
    })
    expect(await field.json()).toMatchObject({
      details: { reason: 'champ_inconnu', detail: 'absent' },
    })
    const url = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Cassé',
      blocks: [{ kind: 'embed', url: 'http://exemple.fr' }],
    })
    expect(await url.json()).toMatchObject({ details: { reason: 'adresse_invalide' } })
  })

  it('is listed to whoever reads a table of the base, and to nobody else', async () => {
    const listed = await data<Array<{ id: string }>>(
      await call(alice, `${V1}/meta/bases/${base}/dashboards`),
    )
    expect(listed.map((d) => d.id)).toEqual([id])
    expect((await call(bob, `${V1}/meta/bases/${base}/dashboards`)).status).toBe(404)
    // Building is the builder's: the base is visible to her, the action is refused.
    const refused = await call(alice, `${DASHBOARDS()}/${id}`, 'PATCH', { label: 'Autre' })
    expect(refused.status).toBe(403)
  })

  it('is rewritten, then deleted', async () => {
    const patched = await call(admin, `${DASHBOARDS()}/${id}`, 'PATCH', {
      label: 'Suivi hebdo',
      blocks: [],
    })
    expect(await data<{ label: string; blocks: unknown[] }>(patched)).toMatchObject({
      label: 'Suivi hebdo',
      blocks: [],
    })
    expect((await call(admin, `${DASHBOARDS()}/${id}`, 'DELETE')).status).toBe(204)
    expect(await data<unknown[]>(await call(admin, `${V1}/meta/bases/${base}/dashboards`))).toEqual(
      [],
    )
  })
})
