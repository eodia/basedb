import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Projects, people, groups and the permission grid, over HTTP — chapter 05 §15.
 *
 * One story, told in order: an administrator creates a project, a base in it and a table
 * in the base; creates an account and a group; the newcomer signs in with the temporary
 * password and sees nothing; the group is granted « Lecture » on the project, then
 * « Édition » on the table, and each grant shows at once in what the newcomer can do.
 */

const TENANT_REF = 't7admnq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>

type Session = { cookie: string; csrf: string; token: string }

let admin: Session

/** Signs in and returns the cookie, the CSRF token and a fresh access token. */
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

/** Proves the password again: the session rotates, so a new cookie and token come back. */
async function elevate(session: Session, password: string): Promise<Session> {
  const r = await app.request('/auth/elevate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    body: JSON.stringify({ password }),
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
  admin = await signIn('bootstrap@basedb.local', PASSWORD)
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('projects, people and permissions — one story over HTTP', () => {
  let projectId = ''
  let baseName = ''
  let tableId = ''
  let userId = ''
  let groupId = ''
  let temporary = ''
  let alice: Session

  it('says who administers on /auth/me', async () => {
    const me = await data<{ is_admin: boolean; must_change_password: boolean }>(
      await app.request('/auth/me', { headers: { authorization: `Bearer ${admin.token}` } }),
    )
    expect(me).toMatchObject({ is_admin: true, must_change_password: false })
  })

  it('creates a project, a base in it and a table in the base', async () => {
    const created = await call(admin, `${V1}/admin/projects`, 'POST', { label: 'Commercial' })
    expect(created.status).toBe(201)
    projectId = (await data<{ id: string }>(created)).id

    const again = await call(admin, `${V1}/admin/projects`, 'POST', { label: 'commercial' })
    expect(again.status).toBe(422)
    expect(((await again.json()) as { code: string }).code).toBe('LABEL_DUPLICATE')

    const base = await call(admin, `${V1}/admin/bases`, 'POST', {
      label: 'Ventes',
      project: projectId,
    })
    expect(base.status).toBe(201)
    const made = await data<{ name: string; project: string }>(base)
    expect(made.project).toBe(projectId)
    baseName = made.name

    const table = await call(admin, `${V1}/admin/bases/${baseName}/tables`, 'POST', {
      label: 'Clients',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    expect(table.status).toBe(201)
    tableId = (await data<{ id: string }>(table)).id

    const projects = await data<
      Array<{
        id: string
        actions: string[]
        bases: Array<{ name: string; tables: Array<{ actions: string[] }> }>
      }>
    >(await call(admin, `${V1}/meta/projects`))
    const mine = projects.find((p) => p.id === projectId)
    expect(mine?.actions).toContain('manage_schema')
    expect(mine?.bases.map((b) => b.name)).toEqual([baseName])
    expect(mine?.bases[0].tables).toHaveLength(1)
    // Beyond the data verbs, the navigation learns whether the structure may be changed.
    expect(mine?.bases[0].tables[0].actions).toContain('manage_schema')
  })

  it('refuses to create an account without a recent elevation', async () => {
    const r = await call(admin, `${V1}/admin/users`, 'POST', {
      email: 'alice@exemple.fr',
      display_name: 'Alice Martin',
    })
    expect(r.status).toBe(403)
    expect(((await r.json()) as { code: string }).code).toBe('ELEVATION_REQUIRED')
  })

  it('creates an account with a temporary password, and a group holding it', async () => {
    admin = await elevate(admin, PASSWORD)

    const r = await call(admin, `${V1}/admin/users`, 'POST', {
      email: 'alice@exemple.fr',
      display_name: 'Alice Martin',
    })
    expect(r.status).toBe(201)
    const created = await data<{
      user: { id: string; must_change_password: boolean; groups: Array<{ label: string }> }
      temporary_password: string
    }>(r)
    expect(created.user.must_change_password).toBe(true)
    expect(created.user.groups.map((g) => g.label)).toEqual(['Tous les utilisateurs'])
    expect(created.temporary_password.length).toBeGreaterThanOrEqual(12)
    userId = created.user.id
    temporary = created.temporary_password

    const taken = await call(admin, `${V1}/admin/users`, 'POST', {
      email: 'ALICE@exemple.fr',
      display_name: 'Alice bis',
    })
    expect(taken.status).toBe(409)
    expect(((await taken.json()) as { code: string }).code).toBe('EMAIL_TAKEN')

    // The password is never listed again.
    const listed = await call(admin, `${V1}/admin/users`)
    expect(JSON.stringify(await listed.json())).not.toContain(temporary)

    const group = await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Commerciaux' })
    expect(group.status).toBe(201)
    groupId = (await data<{ id: string }>(group)).id

    const joined = await call(admin, `${V1}/admin/groups/${groupId}/members/${userId}`, 'PUT')
    expect(joined.status).toBe(204)
    const members = await data<Array<{ id: string }>>(
      await call(admin, `${V1}/admin/groups/${groupId}/members`),
    )
    expect(members.map((m) => m.id)).toEqual([userId])
  })

  it('the system groups cannot be renamed', async () => {
    const groups = await data<Array<{ id: string; system: string | null }>>(
      await call(admin, `${V1}/admin/groups`),
    )
    const everyone = groups.find((g) => g.system === 'everyone')
    const r = await call(admin, `${V1}/admin/groups/${everyone?.id}`, 'PATCH', { label: 'Tous' })
    expect(r.status).toBe(409)
    expect(((await r.json()) as { code: string }).code).toBe('GROUP_SYSTEM_IMMUTABLE')
  })

  it('the newcomer signs in, must change the password, and sees nothing yet', async () => {
    alice = await signIn('alice@exemple.fr', temporary)
    const me = await data<{ is_admin: boolean; must_change_password: boolean }>(
      await app.request('/auth/me', { headers: { authorization: `Bearer ${alice.token}` } }),
    )
    expect(me).toMatchObject({ is_admin: false, must_change_password: true })

    expect(await data<unknown[]>(await call(alice, `${V1}/meta/projects`))).toEqual([])
    expect(await data<unknown[]>(await call(alice, `${V1}/meta/bases`))).toEqual([])

    const changed = await app.request('/auth/password/change', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: alice.cookie,
        'x-basedb-csrf': alice.csrf,
      },
      body: JSON.stringify({ current: temporary, next: 'un cheval bleu dans la prairie' }),
    })
    expect(changed.status).toBe(204)
    alice = await signIn('alice@exemple.fr', 'un cheval bleu dans la prairie')
    const after = await data<{ must_change_password: boolean }>(
      await app.request('/auth/me', { headers: { authorization: `Bearer ${alice.token}` } }),
    )
    expect(after.must_change_password).toBe(false)
  })

  it('« Lecture » on the project opens every table of it, and no more', async () => {
    const r = await call(admin, `${V1}/admin/access`, 'POST', {
      changes: [{ group: groupId, scope: { kind: 'project', id: projectId }, level: 'read' }],
    })
    expect(r.status).toBe(200)
    const graph = await data<{
      groups: Array<{ id: string; member_count: number }>
      cells: Record<string, Record<string, { level: string; direct: boolean }>>
    }>(r)
    expect(graph.cells[groupId][`project:${projectId}`]).toEqual({ level: 'read', direct: true })
    expect(graph.cells[groupId][`table:${tableId}`]).toEqual({ level: 'read', direct: false })
    expect(graph.groups.find((g) => g.id === groupId)?.member_count).toBe(1)

    const projects = await data<
      Array<{
        id: string
        actions: string[]
        bases: Array<{ tables: Array<{ actions: string[] }> }>
      }>
    >(await call(alice, `${V1}/meta/projects`))
    expect(projects.map((p) => p.id)).toEqual([projectId])
    expect(projects[0].actions).toEqual(['read'])
    expect(projects[0].bases[0].tables[0].actions).toEqual(['read'])

    const write = await call(alice, `${V1}/data/${baseName}/clients`, 'POST', {
      values: { nom: 'ACME' },
    })
    expect(write.status).toBe(403)

    // Reading is not administering: the accounts are not even said to exist (05 §8).
    const users = await call(alice, `${V1}/admin/users`)
    expect(users.status).toBe(404)
    expect(((await users.json()) as { code: string }).code).toBe('RESOURCE_NOT_FOUND')
  })

  it('« Édition » on the table lets the newcomer write rows in it', async () => {
    const r = await call(admin, `${V1}/admin/access`, 'POST', {
      changes: [{ group: groupId, scope: { kind: 'table', id: tableId }, level: 'edit' }],
    })
    expect(r.status).toBe(200)

    const write = await call(alice, `${V1}/data/${baseName}/clients`, 'POST', {
      values: { nom: 'ACME' },
    })
    expect(write.status).toBe(201)

    // Creating a table is still a change of structure the group was not given.
    const table = await call(alice, `${V1}/admin/bases/${baseName}/tables`, 'POST', {
      label: 'Devis',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })
    expect(table.status).toBe(403)
  })

  it('a project that still holds a base is not deleted', async () => {
    const r = await call(admin, `${V1}/admin/projects/${projectId}`, 'DELETE')
    expect(r.status).toBe(409)
    expect(((await r.json()) as { code: string }).code).toBe('PROJECT_NOT_EMPTY')
  })

  it('a disabled account can no longer sign in', async () => {
    const r = await call(admin, `${V1}/admin/users/${userId}`, 'PATCH', { disabled: true })
    expect(r.status).toBe(200)
    expect((await data<{ disabled: boolean }>(r)).disabled).toBe(true)

    const login = await app.request('/auth/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@exemple.fr',
        password: 'un cheval bleu dans la prairie',
      }),
    })
    expect(login.status).toBe(401)
  })
})
