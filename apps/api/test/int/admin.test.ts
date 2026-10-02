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
    // The webhook consumer of the last story runs on this machine.
    webhookTargets: { allowHttp: true, allowPrivate: true },
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

  it('« Gestion » on the project lets the newcomer mint a token for a base of it', async () => {
    const asked = {
      base: baseName,
      label: 'Agent d’Alice',
      access: 'write',
      surfaces: ['mcp'],
      expires_in_days: 30,
    }
    alice = await elevate(alice, 'un cheval bleu dans la prairie')
    // Reading and writing are not managing: the base's doors are not hers to open.
    const refused = await call(alice, `${V1}/admin/tokens`, 'POST', asked)
    expect(refused.status).toBe(403)
    expect(((await refused.json()) as { code: string }).code).toBe('ADMIN_REQUIRED')

    // Given on the project, « Gestion » covers its bases — tokens included.
    const project = (level: string) =>
      call(admin, `${V1}/admin/access`, 'POST', {
        changes: [{ group: groupId, scope: { kind: 'project', id: projectId }, level }],
      })
    expect((await project('manage')).status).toBe(200)
    const minted = await call(alice, `${V1}/admin/tokens`, 'POST', asked)
    expect(minted.status).toBe(201)
    const listed = await data<Array<{ label: string }>>(
      await call(alice, `${V1}/admin/tokens?base=${baseName}`),
    )
    expect(listed.map((t) => t.label)).toContain('Agent d’Alice')
    expect((await project('read')).status).toBe(200)
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

describe('the history of a row, over HTTP — chapter 07', () => {
  it('names who wrote what, and offers the way back', async () => {
    const base = await data<{ name: string }>(
      await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Historique HTTP' }),
    )
    await call(admin, `${V1}/admin/bases/${base.name}/tables`, 'POST', {
      label: 'Notes',
      fields: [{ label: 'Texte', kind: 'short_text' }],
    })
    const rows = `${V1}/data/${base.name}/notes`

    const created = await data<{ _id: string }>(
      await call(admin, rows, 'POST', { values: { texte: 'premier jet' } }),
    )
    await call(admin, `${rows}/${created._id}`, 'PATCH', { values: { texte: 'version relue' } })

    type Page = {
      data: Array<{
        id: string
        op: string
        actor: { kind: string }
        changes: Array<{ label: string; before?: unknown; after?: unknown }>
        actions: string[]
      }>
      meta: { next_cursor: string | null }
    }
    const history = (await (await call(admin, `${rows}/${created._id}/history`)).json()) as Page
    expect(history.data.map((r) => r.op)).toEqual(['update', 'insert'])
    expect(history.data[0].actor.kind).toBe('user')
    expect(history.data[0].changes).toEqual([
      expect.objectContaining({ label: 'Texte', before: 'premier jet', after: 'version relue' }),
    ])
    expect(history.data[0].actions).toEqual(['revert'])

    // Undone: the text is back to what it was.
    const reverted = await call(admin, `${V1}/history/${history.data[0].id}/revert`, 'POST')
    expect(reverted.status).toBe(200)
    const row = await data<{ texte: string }>(await call(admin, `${rows}/${created._id}`))
    expect(row.texte).toBe('premier jet')

    // Deleted, then restored from the activity of the base.
    expect((await call(admin, `${rows}/${created._id}`, 'DELETE')).status).toBe(204)
    const activity = (await (
      await call(admin, `${V1}/meta/bases/${base.name}/history`)
    ).json()) as Page
    const deletion = activity.data.find((r) => r.op === 'delete')
    expect(deletion?.actions).toEqual(['restore'])
    const restored = await call(admin, `${V1}/history/${deletion?.id}/restore`, 'POST')
    expect(restored.status).toBe(201)
    expect((await call(admin, `${rows}/${created._id}`)).status).toBe(200)
  })
})

describe('webhooks and the deletion journal, over HTTP — chapter 08 §10, §6.5', () => {
  it('a webhook is created, delivers a signed row, and lists its deliveries', async () => {
    const { createServer } = await import('node:http')
    const bodies: string[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        bodies.push(body)
        res.statusCode = 204
        res.end()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port

    try {
      const base = await data<{ name: string }>(
        await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Webhooks HTTP' }),
      )
      await call(admin, `${V1}/admin/bases/${base.name}/tables`, 'POST', {
        label: 'Tickets',
        fields: [{ label: 'Sujet', kind: 'short_text' }],
      })

      const created = await call(admin, `${V1}/admin/webhooks`, 'POST', {
        base: base.name,
        label: 'Support',
        url: `http://127.0.0.1:${port}/in`,
        subscriptions: [{ table: 'tickets', events: ['create', 'delete'] }],
      })
      expect(created.status).toBe(201)
      const hook = await data<{ id: string; secret: string }>(created)
      expect(hook.secret).toMatch(/^whsec_/)

      const listed = await call(admin, `${V1}/admin/webhooks?base=${base.name}`)
      expect(JSON.stringify(await listed.json())).not.toContain(hook.secret)

      const rows = `${V1}/data/${base.name}/tickets`
      const ticket = await data<{ _id: string }>(
        await call(admin, rows, 'POST', { values: { sujet: 'Imprimante' } }),
      )
      await kernel.drainHistory()
      await kernel.dispatchWebhooks()
      expect(bodies).toHaveLength(1)
      expect(JSON.parse(bodies[0] as string).events[0]).toMatchObject({
        type: 'record.created',
        table: 'tickets',
        record_id: ticket._id,
      })

      const deliveries = await data<Array<{ status: string; response_code: number }>>(
        await call(admin, `${V1}/admin/webhooks/${hook.id}/deliveries`),
      )
      expect(deliveries[0]).toMatchObject({ status: 'delivered', response_code: 204 })

      // A deletion reaches the deletion journal, where a late consumer catches up.
      const since = new Date(Date.now() - 60_000).toISOString()
      await call(admin, `${rows}/${ticket._id}`, 'DELETE')
      const deleted = await data<Array<{ _id: string; cause: string }>>(
        await call(admin, `${rows}/deleted?since=${encodeURIComponent(since)}`),
      )
      expect(deleted).toEqual([expect.objectContaining({ _id: ticket._id, cause: 'direct' })])
    } finally {
      server.close()
    }
  })
})

describe('the proposals queue, over HTTP — chapter 09 §7', () => {
  it('lists what an agent proposed, approves one, refuses another; a token decides nothing', async () => {
    const base = await data<{ name: string }>(
      await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Propositions HTTP' }),
    )
    await call(admin, `${V1}/admin/bases/${base.name}/tables`, 'POST', {
      label: 'Contacts',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    const minted = await call(admin, `${V1}/admin/tokens`, 'POST', {
      label: 'Agent de test',
      base: base.name,
      access: 'write',
    })
    expect(minted.status).toBe(201)
    const secret = (await data<{ secret: string }>(minted)).secret
    const agent = await kernel.openTokenContext({
      secret,
      surface: 'mcp',
      requestId: crypto.randomUUID(),
    })
    const first = await kernel.agentProposeAddField(agent, {
      base: base.name,
      table: 'contacts',
      label: 'Téléphone',
      kind: 'short_text',
    })
    const second = await kernel.agentProposeAddField(agent, {
      base: base.name,
      table: 'contacts',
      label: 'Fax',
      kind: 'short_text',
    })

    // The navigation counts them, for whoever decides.
    const projects = await data<Array<{ bases: Array<{ name: string; openProposals: number }> }>>(
      await call(admin, `${V1}/meta/projects`),
    )
    const counted = projects.flatMap((p) => p.bases).find((b) => b.name === base.name)
    expect(counted?.openProposals).toBe(2)

    const queue = await data<Array<{ id: string; status: string; token: { label: string } }>>(
      await call(admin, `${V1}/admin/proposals?base=${base.name}`),
    )
    expect(queue.map((p) => p.id).sort()).toEqual([first.id, second.id].sort())
    expect(queue[0]?.token.label).toBe('Agent de test')

    // A token is not a person: it neither reads the queue nor approves.
    const asToken = (path: string, method = 'GET') =>
      app.request(path, { method, headers: { authorization: `Bearer ${secret}` } })
    expect((await asToken(`${V1}/admin/proposals?base=${base.name}`)).status).toBe(401)
    expect((await asToken(`${V1}/admin/proposals/${first.id}/approve`, 'POST')).status).toBe(401)

    const approved = await call(admin, `${V1}/admin/proposals/${first.id}/approve`, 'POST')
    expect(approved.status).toBe(200)
    expect((await data<{ status: string }>(approved)).status).toBe('applied')
    const rejected = await call(admin, `${V1}/admin/proposals/${second.id}/reject`, 'POST')
    expect((await data<{ status: string }>(rejected)).status).toBe('rejected')

    const meta = await data<{ tables: Array<{ name: string; fields: Array<{ name: string }> }> }>(
      await call(admin, `${V1}/meta/bases/${base.name}`),
    )
    const names = meta.tables.find((t) => t.name === 'contacts')?.fields.map((f) => f.name)
    expect(names).toContain('telephone')
    expect(names).not.toContain('fax')

    const again = await call(admin, `${V1}/admin/proposals/${first.id}/approve`, 'POST')
    expect(again.status).toBe(422)
    expect(((await again.json()) as { code: string }).code).toBe('MIGRATION_STALE')
  })
})

describe('field rules, over HTTP — chapter 05 §4', () => {
  it('reads the rules of a table, sets one, and tells what a person ends up with', async () => {
    const base = await data<{ name: string; id: string }>(
      await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Champs HTTP' }),
    )
    const table = await data<{ id: string; fields: Array<{ id: string; label: string }> }>(
      await call(admin, `${V1}/admin/bases/${base.name}/tables`, 'POST', {
        label: 'Salariés',
        fields: [
          { label: 'Nom', kind: 'short_text' },
          { label: 'Salaire', kind: 'number' },
        ],
      }),
    )
    const graph = await data<{
      projects: Array<{ bases: Array<{ name: string; id: string }> }>
    }>(await call(admin, `${V1}/admin/access`))
    const baseId = graph.projects.flatMap((p) => p.bases).find((b) => b.name === base.name)?.id
    const group = await data<{ id: string }>(
      await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Paie HTTP' }),
    )
    const granted = await call(admin, `${V1}/admin/access`, 'POST', {
      changes: [{ group: group.id, scope: { kind: 'base', id: baseId }, level: 'edit' }],
    })
    expect(granted.status).toBe(200)

    const access = await data<{
      fields: Array<{ id: string; label: string }>
      groups: Array<{ id: string; level: string; rules: Record<string, string> }>
    }>(await call(admin, `${V1}/admin/access/tables/${table.id}/fields`))
    expect(access.fields.map((f) => f.label)).toEqual(['Nom', 'Salaire'])
    expect(access.groups.find((g) => g.id === group.id)).toMatchObject({ level: 'edit', rules: {} })

    const salaire = access.fields[1]?.id as string
    const set = await call(admin, `${V1}/admin/access/fields/${salaire}`, 'PUT', {
      group: group.id,
      rule: 'hidden',
    })
    expect(set.status).toBe(200)
    const after = await data<{ groups: Array<{ id: string; rules: Record<string, string> }> }>(set)
    expect(after.groups.find((g) => g.id === group.id)?.rules).toEqual({ [salaire]: 'hidden' })

    // A person of their own: the story above ends with Alice disabled.
    const person = (
      await data<{ user: { id: string } }>(
        await call(admin, `${V1}/admin/users`, 'POST', {
          email: 'paie@exemple.fr',
          display_name: 'Paul Paie',
        }),
      )
    ).user.id
    await call(admin, `${V1}/admin/groups/${group.id}/members/${person}`, 'PUT')
    const mask = await data<{
      reads_table: boolean
      fields: Array<{ id: string; level: string; restricted_by: Array<{ group: string }> }>
    }>(await call(admin, `${V1}/admin/access/tables/${table.id}/mask?user=${person}`))
    expect(mask.reads_table).toBe(true)
    expect(mask.fields.find((f) => f.id === salaire)).toMatchObject({
      level: 'hidden',
      restricted_by: [{ group: 'Paie HTTP', rule: 'hidden' }],
    })

    const bad = await call(admin, `${V1}/admin/access/fields/${salaire}`, 'PUT', {
      group: group.id,
      rule: 'everything',
    })
    expect(bad.status).toBe(400)
  })
})

describe('physical names and the purge, over HTTP — chapter 06', () => {
  it('renames a table in the database, lists its alias, and refuses an export with nowhere to go', async () => {
    const base = await data<{ name: string }>(
      await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Cycle HTTP' }),
    )
    const table = await data<{ id: string }>(
      await call(admin, `${V1}/admin/bases/${base.name}/tables`, 'POST', {
        label: 'Clients',
        fields: [{ label: 'Nom', kind: 'short_text' }],
      }),
    )

    const impact = await data<{ current: string; alias_allowed: boolean; qualified: string }>(
      await call(admin, `${V1}/admin/physical/table/${table.id}`),
    )
    expect(impact).toMatchObject({ current: 'clients', alias_allowed: true })
    // The suggestion follows the label typed in the same dialog.
    const typed = await data<{ suggested: string }>(
      await call(
        admin,
        `${V1}/admin/physical/table/${table.id}?label=${encodeURIComponent('Comptes')}`,
      ),
    )
    expect(typed.suggested).toBe('comptes')

    const renamed = await call(admin, `${V1}/admin/physical/table/${table.id}/rename`, 'POST', {
      name: 'comptes',
      confirm: 'clients',
    })
    expect(renamed.status).toBe(200)
    expect(await data<{ name: string; alias: string }>(renamed)).toMatchObject({
      name: 'comptes',
      alias: 'clients',
    })
    const aliases = await data<Array<{ name: string; kind: string; target: string }>>(
      await call(admin, `${V1}/admin/aliases?base=${base.name}`),
    )
    expect(aliases).toEqual([
      expect.objectContaining({
        name: 'clients',
        kind: 'view',
        target: expect.stringMatching(/\.comptes$/),
      }),
    ])

    const retired = await call(admin, `${V1}/admin/physical/table/${table.id}/rename`, 'POST', {
      name: 'clients',
      confirm: 'comptes',
    })
    expect(retired.status).toBe(409)
    expect(((await retired.json()) as { code: string }).code).toBe('NAME_RETIRED')

    // A field is addressed by its names — its catalog id is not in the description.
    const field = `${V1}/admin/bases/${base.name}/tables/comptes/fields/nom/physical`
    const fieldImpact = await data<{ current: string; suggested: string; alias_allowed: boolean }>(
      await call(admin, `${field}?label=${encodeURIComponent('Raison sociale')}`),
    )
    expect(fieldImpact).toMatchObject({
      current: 'nom',
      suggested: 'raison_sociale',
      alias_allowed: false,
    })
    const column = await call(admin, `${field}/rename`, 'POST', {
      name: 'raison_sociale',
      confirm: 'nom',
    })
    expect(column.status).toBe(200)
    const described = await data<{ tables: Array<{ fields: Array<{ name: string }> }> }>(
      await call(admin, `${V1}/meta/bases/${base.name}`),
    )
    expect(described.tables[0]?.fields.map((f) => f.name)).toContain('raison_sociale')

    await call(admin, `${V1}/admin/bases/${base.name}/tables/comptes`, 'DELETE')
    const deleted = await data<Array<{ id: string; label: string }>>(
      await call(admin, `${V1}/admin/bases/${base.name}/deleted-tables`),
    )
    expect(deleted.map((d) => d.label)).toEqual(['Clients'])
    const exported = await call(admin, `${V1}/admin/purge/exports`, 'POST', {
      kind: 'table',
      id: table.id,
    })
    expect(exported.status).toBe(503)
    expect(((await exported.json()) as { code: string }).code).toBe('EXPORT_UNAVAILABLE')
  })
})
