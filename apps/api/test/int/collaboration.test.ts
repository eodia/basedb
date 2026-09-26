import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Collaboration over HTTP — chapter 16.
 *
 * What these guard: Ctrl+Z undoes a write by its transaction and refuses one written over
 * since; reading a row is enough to comment it; a mention notifies only who can read the
 * row; a person field set to someone notifies them; the live stream says that a table
 * changed — and nothing to whoever cannot read it.
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

const ROWS = () => `${V1}/data/${base}/visites`

async function createRow(values: Record<string, unknown>) {
  const r = await call(admin, ROWS(), 'POST', { values })
  expect(r.status).toBe(201)
  return {
    id: (await data<{ _id: string }>(r))._id,
    transaction: r.headers.get('x-basedb-transaction') ?? '',
  }
}
const undo = (transaction: string, session: Session = admin) =>
  call(session, `${V1}/history/undo`, 'POST', { transaction })
const valueIn = async (id: string, field: string) =>
  (await data<Record<string, unknown>>(await call(admin, `${ROWS()}/${id}`)))[field]

describe('Ctrl+Z: undoing a write by its transaction', () => {
  it('rolls a modification back, and redoes it by undoing the undo', async () => {
    const row = await createRow({ nom: 'Lyon', note: 'avant' })
    const patched = await call(admin, `${ROWS()}/${row.id}`, 'PATCH', { values: { note: 'après' } })
    expect(patched.status).toBe(200)
    const transaction = patched.headers.get('x-basedb-transaction') ?? ''
    expect(transaction).toMatch(/^\d+$/)

    const undone = await undo(transaction)
    expect(undone.status).toBe(200)
    expect(await valueIn(row.id, 'note')).toBe('avant')

    const redo = (await data<{ transaction: string }>(undone)).transaction
    expect((await undo(redo)).status).toBe(200)
    expect(await valueIn(row.id, 'note')).toBe('après')
  })

  it('refuses to undo a modification written over since', async () => {
    const row = await createRow({ nom: 'Nice', note: 'un' })
    const first = await call(admin, `${ROWS()}/${row.id}`, 'PATCH', { values: { note: 'deux' } })
    await call(admin, `${ROWS()}/${row.id}`, 'PATCH', { values: { note: 'trois' } })
    const refused = await undo(first.headers.get('x-basedb-transaction') ?? '')
    expect(refused.status).toBe(409)
    expect(await refused.json()).toMatchObject({
      code: 'REVISION_SUPERSEDED',
      details: { fields: ['note'] },
    })
    expect(await valueIn(row.id, 'note')).toBe('trois')
  })

  it('undoes a creation by deleting the row, and a deletion by restoring it', async () => {
    const row = await createRow({ nom: 'Brest' })
    expect((await undo(row.transaction)).status).toBe(200)
    expect((await call(admin, `${ROWS()}/${row.id}`)).status).toBe(404)

    const again = await createRow({ nom: 'Rennes' })
    const deleted = await call(admin, `${ROWS()}/${again.id}`, 'DELETE')
    expect(deleted.status).toBe(204)
    expect((await undo(deleted.headers.get('x-basedb-transaction') ?? '')).status).toBe(200)
    expect(await valueIn(again.id, 'nom')).toBe('Rennes')
  })

  it('undoes only the caller’s own transactions', async () => {
    const row = await createRow({ nom: 'Metz' })
    const theirs = await undo(row.transaction, alice)
    expect(theirs.status).toBe(404)
    expect((await undo('12345678901234')).status).toBe(404)
  })
})

describe('comments, mentions and notifications', () => {
  let rowId = ''
  let commentId = ''

  it('a mention notifies whoever can read the row, and names who cannot', async () => {
    rowId = (await createRow({ nom: 'Toulouse' })).id
    const r = await call(admin, `${ROWS()}/${rowId}/comments`, 'POST', {
      body: `Tu peux regarder @[Alice Martin](user:${aliceId}) ? Et @[Bob Durand](user:${bobId})`,
    })
    expect(r.status).toBe(201)
    const body = (await r.json()) as {
      data: { id: string; mentions: string[]; author: { name: string }; can_edit: boolean }
      meta: { unreachable: string[] }
    }
    commentId = body.data.id
    expect(body.data.mentions).toEqual([aliceId, bobId])
    expect(body.data.author.name).toBe('Bootstrap')
    expect(body.data.can_edit).toBe(true)
    expect(body.meta.unreachable).toEqual([bobId])

    const mine = (await (await call(alice, `${V1}/me/notifications`)).json()) as {
      data: Array<{ kind: string; excerpt: string; readable: boolean; table: { name: string } }>
      meta: { unread: number }
    }
    expect(mine.meta.unread).toBe(1)
    expect(mine.data[0]).toMatchObject({
      kind: 'mention',
      readable: true,
      table: { name: 'visites' },
    })
    expect(mine.data[0]?.excerpt).toContain('@Alice Martin')
    const theirs = (await (await call(bob, `${V1}/me/notifications`)).json()) as {
      meta: { unread: number }
    }
    expect(theirs.meta.unread).toBe(0)
  })

  it('reading is enough to comment; a reply notifies the thread', async () => {
    const listed = await data<Array<{ id: string }>>(
      await call(alice, `${ROWS()}/${rowId}/comments`),
    )
    expect(listed.map((c) => c.id)).toEqual([commentId])
    const reply = await call(alice, `${ROWS()}/${rowId}/comments`, 'POST', { body: 'Je regarde.' })
    expect(reply.status).toBe(201)

    const adminNotes = await data<Array<{ kind: string; actor: { name: string } }>>(
      await call(admin, `${V1}/me/notifications?unread=true`),
    )
    expect(adminNotes[0]).toMatchObject({ kind: 'reply', actor: { name: 'Alice Martin' } })
  })

  it('a comment is its author’s to edit; a row one cannot read has none', async () => {
    const edit = await call(alice, `${V1}/comments/${commentId}`, 'PATCH', { body: 'Modifié' })
    expect(edit.status).toBe(403)
    expect(await edit.json()).toMatchObject({
      code: 'ACTION_FORBIDDEN',
      details: { reason: 'auteur_seul' },
    })
    expect((await call(bob, `${ROWS()}/${rowId}/comments`)).status).toBe(404)

    const own = await call(admin, `${V1}/comments/${commentId}`, 'PATCH', { body: 'Relu.' })
    expect(own.status).toBe(200)
    expect(await data<{ body: string; edited_at: string | null }>(own)).toMatchObject({
      body: 'Relu.',
    })
  })

  it('refuses a mention of someone who is not a member', async () => {
    const r = await call(admin, `${ROWS()}/${rowId}/comments`, 'POST', {
      body: '@[Personne](user:00000000-0000-4000-8000-000000000000)',
    })
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ details: { reason: 'mention_inconnue' } })
  })

  it('marks notifications read', async () => {
    const marked = await call(alice, `${V1}/me/notifications/read`, 'POST', { all: true })
    expect(await data<{ marked: number }>(marked)).toEqual({ marked: 1 })
    const after = (await (await call(alice, `${V1}/me/notifications`)).json()) as {
      meta: { unread: number }
    }
    expect(after.meta.unread).toBe(0)
  })

  it('a person field set to someone notifies them, from the drain', async () => {
    await createRow({ nom: 'Lille', responsable: aliceId })
    await kernel.drainHistory()
    const notes = await data<Array<{ kind: string; excerpt: string }>>(
      await call(alice, `${V1}/me/notifications?unread=true`),
    )
    expect(notes[0]).toMatchObject({ kind: 'assigned' })
  })
})

/** Reads server-sent events off a stream until one of `name` arrives. */
async function nextEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  name: string,
  buffer: { text: string },
): Promise<Record<string, unknown>> {
  const decoder = new TextDecoder()
  const deadline = Date.now() + 10_000
  for (;;) {
    const blocks = buffer.text.split('\n\n')
    buffer.text = blocks.pop() ?? ''
    for (const block of blocks) {
      const event = /^event: (.*)$/m.exec(block)?.[1]
      const payload = /^data: (.*)$/m.exec(block)?.[1]
      if (event === name) return JSON.parse(payload ?? '{}') as Record<string, unknown>
    }
    if (Date.now() > deadline) throw new Error(`no ${name} event`)
    const { value, done } = await reader.read()
    if (done) throw new Error('stream closed')
    buffer.text += decoder.decode(value, { stream: true })
  }
}

describe('the live stream', () => {
  it('signals a write to a table, with who wrote it', async () => {
    const controller = new AbortController()
    const response = await app.request(`${V1}/events?base=${base}&table=visites`, {
      headers: { authorization: `Bearer ${admin.token}` },
      signal: controller.signal,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    const buffer = { text: '' }
    const ready = await nextEvent(reader, 'ready', buffer)
    expect(ready.session).toMatch(/^[0-9a-f-]{36}$/)

    const presence = await nextEvent(reader, 'presence', buffer)
    expect(presence.viewers).toEqual([
      { user: expect.any(String), name: 'Bootstrap', record: null },
    ])

    const row = await createRow({ nom: 'Dijon' })
    await kernel.drainHistory()
    const signal = await nextEvent(reader, 'records', buffer)
    expect(signal).toMatchObject({ ids: [row.id], ops: ['insert'] })
    controller.abort()
    await reader.cancel().catch(() => undefined)
  })

  it('carries a pointer to the others on the table — placed by cell, never back to its sender', async () => {
    const open = async (session: Session) => {
      const controller = new AbortController()
      const response = await app.request(`${V1}/events?base=${base}&table=visites`, {
        headers: { authorization: `Bearer ${session.token}` },
        signal: controller.signal,
      })
      const reader = (response.body as ReadableStream<Uint8Array>).getReader()
      const buffer = { text: '' }
      const ready = await nextEvent(reader, 'ready', buffer)
      return { controller, reader, buffer, session: String(ready.session) }
    }
    const watching = await open(admin)
    const moving = await open(alice)
    const row = await createRow({ nom: 'Nancy' })

    const point = (at: unknown, who: Session = alice, session = moving.session) =>
      call(who, `${V1}/presence/pointer`, 'POST', { session, base, table: 'visites', at })

    expect((await point({ record: row.id, field: 'nom', x: 0.25, y: 1.7 })).status).toBe(204)
    const seen = await nextEvent(watching.reader, 'pointer', watching.buffer)
    // Placed by cell, clamped into it; the sender's name, never its address.
    expect(seen).toMatchObject({
      session: moving.session,
      name: 'Alice Martin',
      at: { record: row.id, field: 'nom', x: 0.25, y: 1 },
    })

    // A column the reader does not read names nothing: the pointer shows nowhere.
    await new Promise((resolve) => setTimeout(resolve, 60))
    await point({ record: row.id, field: 'colonne_inconnue', x: 0.5, y: 0.5 })
    expect(await nextEvent(watching.reader, 'pointer', watching.buffer)).toMatchObject({ at: null })

    // Another's stream moves nothing.
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect((await point(null, admin)).status).toBe(404)

    for (const s of [watching, moving]) {
      s.controller.abort()
      await s.reader.cancel().catch(() => undefined)
    }
  })

  it('is refused on a table the reader cannot read', async () => {
    const response = await app.request(`${V1}/events?base=${base}&table=visites`, {
      headers: { authorization: `Bearer ${bob.token}` },
    })
    expect(response.status).toBe(404)
  })
})
