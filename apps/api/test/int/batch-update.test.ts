import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * A batch of updates over HTTP — chapter 08 §3.5: what pasting a range of cells and filling
 * a selection of rows in the grid send.
 *
 * What it has to guarantee is the same thing the batch of creations guarantees, turned
 * round: it changes rows exactly as the single update would — same masks, same row rules,
 * same values — or it changes NOTHING, and says which row stopped it. And since the grid
 * hands it to Ctrl+Z as one gesture, its history is one transaction.
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
let base = ''
let tableId = ''
let groupEditors = ''
let fieldIds: Record<string, string> = {}

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

const ROWS = () => `${V1}/data/${base}/visites`

async function createRow(values: Record<string, unknown>, who: Session = admin): Promise<string> {
  const r = await call(who, ROWS(), 'POST', { values })
  expect(r.status, await r.clone().text()).toBe(201)
  return (await data<{ _id: string }>(r))._id
}

/** A row as `who` reads it. */
async function read(id: string, who: Session = admin): Promise<Record<string, unknown>> {
  return data<Record<string, unknown>>(await call(who, `${ROWS()}/${id}`))
}

const batch = (operations: unknown, who: Session = admin) =>
  call(who, `${ROWS()}/batch`, 'POST', { operations })

const change = (id: string, values: Record<string, unknown>) => ({
  op: 'update',
  id,
  data: values,
})

type Failure = { code: string; details: { index?: number; field?: string; reason?: string } }

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
      { label: 'Montant', kind: 'number' },
      { label: 'Secret', kind: 'short_text' },
    ],
  })
  expect(table.status, await table.clone().text()).toBe(201)
  tableId = (await data<{ id: string }>(table)).id
  // A list of choices is added once the table exists.
  const statut = await call(admin, `${V1}/admin/bases/${base}/tables/visites/fields`, 'POST', {
    label: 'Statut',
    kind: 'select',
    options: [
      { value: 'ouvert', label: 'Ouvert' },
      { value: 'clos', label: 'Clos' },
    ],
  })
  expect(statut.status, await statut.clone().text()).toBe(201)

  const access = await data<{ fields: Array<{ id: string; name: string }> }>(
    await call(admin, `${V1}/admin/access/tables/${tableId}/fields`),
  )
  fieldIds = Object.fromEntries(access.fields.map((f) => [f.name, f.id]))

  // Alice edits the table, but her group may only READ « note » and cannot see « secret ».
  // Bob reads it and writes nothing.
  const a = await person('alice@exemple.fr', 'Alice Martin')
  alice = a.session
  const b = await person('bob@exemple.fr', 'Bob Durand')
  bob = b.session

  groupEditors = (
    await data<{ id: string }>(
      await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Éditeurs' }),
    )
  ).id
  const readers = (
    await data<{ id: string }>(
      await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Lecteurs' }),
    )
  ).id
  expect(
    (await call(admin, `${V1}/admin/groups/${groupEditors}/members/${a.id}`, 'PUT')).status,
  ).toBe(204)
  expect((await call(admin, `${V1}/admin/groups/${readers}/members/${b.id}`, 'PUT')).status).toBe(
    204,
  )
  const granted = await call(admin, `${V1}/admin/access`, 'POST', {
    changes: [
      { group: groupEditors, scope: { kind: 'table', id: tableId }, level: 'edit' },
      { group: readers, scope: { kind: 'table', id: tableId }, level: 'read' },
    ],
  })
  expect(granted.status).toBe(200)
  for (const [field, rule] of [
    ['note', 'read_only'],
    ['secret', 'hidden'],
  ] as const) {
    const set = await call(admin, `${V1}/admin/access/fields/${fieldIds[field]}`, 'PUT', {
      group: groupEditors,
      rule,
    })
    expect(set.status, await set.clone().text()).toBe(200)
  }
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('a batch of updates', () => {
  it('changes every row — a different field on each — and answers with the shape of §3.5', async () => {
    const [one, two, three] = await Promise.all([
      createRow({ nom: 'Lyon', note: 'a', montant: 10 }),
      createRow({ nom: 'Nantes', note: 'b', montant: 20 }),
      createRow({ nom: 'Brest', note: 'c', montant: 30 }),
    ])

    const r = await batch([
      change(one as string, { nom: 'Lyon-Part-Dieu' }),
      change(two as string, { montant: 25, statut: 'clos' }),
      change(three as string, { note: null, nom: 'Brest-Sud' }),
    ])
    expect(r.status, await r.clone().text()).toBe(200)
    expect(r.headers.get('x-basedb-transaction')).toMatch(/^\d+$/)
    const body = (await r.json()) as {
      atomic: boolean
      results: Array<{ index: number; status: string; id: string }>
      summary: Record<string, number>
    }
    expect(body.atomic).toBe(true)
    expect(body.results).toEqual([
      { index: 0, status: 'updated', id: one },
      { index: 1, status: 'updated', id: two },
      { index: 2, status: 'updated', id: three },
    ])
    expect(body.summary).toEqual({ created: 0, updated: 3, deleted: 0, failed: 0 })

    // What a row does not name stays as it was; `null` empties.
    expect(await read(one as string)).toMatchObject({ nom: 'Lyon-Part-Dieu', note: 'a' })
    expect(await read(two as string)).toMatchObject({
      nom: 'Nantes',
      note: 'b',
      statut: 'clos',
    })
    expect(Number((await read(two as string)).montant)).toBe(25)
    expect(await read(three as string)).toMatchObject({ nom: 'Brest-Sud', note: null })
  })

  it('is all or nothing, and names the row that failed', async () => {
    const [one, two, three] = await Promise.all([
      createRow({ nom: 'Un', montant: 1 }),
      createRow({ nom: 'Deux', montant: 2 }),
      createRow({ nom: 'Trois', montant: 3 }),
    ])
    const r = await batch([
      change(one as string, { nom: 'Un modifié' }),
      change(two as string, { montant: 'vingt' }),
      change(three as string, { nom: 'Trois modifié' }),
    ])
    expect(r.status).toBe(422)
    const failure = (await r.json()) as Failure
    expect(failure).toMatchObject({ code: 'VALUE_INVALID', details: { index: 1 } })
    // The good row that came BEFORE the bad one was not kept, nor the one after.
    expect((await read(one as string)).nom).toBe('Un')
    expect((await read(three as string)).nom).toBe('Trois')
  })

  it('keeps one history: every row has its revision, and one Ctrl+Z takes them all back', async () => {
    const [one, two] = await Promise.all([
      createRow({ nom: 'Avant 1', statut: 'ouvert' }),
      createRow({ nom: 'Avant 2', statut: 'ouvert' }),
    ])
    const r = await batch([
      change(one as string, { nom: 'Après 1' }),
      change(two as string, { nom: 'Après 2', statut: 'clos' }),
    ])
    expect(r.status).toBe(200)
    const transaction = r.headers.get('x-basedb-transaction') ?? ''

    type Page = {
      data: Array<{
        op: string
        actor: { kind: string }
        changes: Array<{ name: string; before?: unknown; after?: unknown }>
      }>
    }
    for (const [id, name] of [
      [one, 'Avant 1'],
      [two, 'Avant 2'],
    ] as const) {
      const history = (await (await call(admin, `${ROWS()}/${id}/history`)).json()) as Page
      expect(history.data.map((h) => h.op)).toEqual(['update', 'insert'])
      expect(history.data[0]?.actor.kind).toBe('user')
      expect(history.data[0]?.changes).toContainEqual(
        expect.objectContaining({ name: 'nom', before: name }),
      )
    }

    const undone = await call(admin, `${V1}/history/undo`, 'POST', { transaction })
    expect(undone.status, await undone.clone().text()).toBe(200)
    const taken = await data<{ revisions: number; transaction: string }>(undone)
    expect(taken.revisions).toBe(2)
    expect(await read(one as string)).toMatchObject({ nom: 'Avant 1', statut: 'ouvert' })
    expect(await read(two as string)).toMatchObject({ nom: 'Avant 2', statut: 'ouvert' })

    // Redo is the undo of the undo.
    expect(
      (await call(admin, `${V1}/history/undo`, 'POST', { transaction: taken.transaction })).status,
    ).toBe(200)
    expect((await read(two as string)).nom).toBe('Après 2')
  })

  it('is refused whole by the undo when someone wrote over one of the rows since', async () => {
    const [one, two] = await Promise.all([createRow({ nom: 'P1' }), createRow({ nom: 'P2' })])
    const r = await batch([
      change(one as string, { nom: 'P1 collé' }),
      change(two as string, { nom: 'P2 collé' }),
    ])
    const transaction = r.headers.get('x-basedb-transaction') ?? ''
    expect(
      (await call(admin, `${ROWS()}/${two}`, 'PATCH', { values: { nom: 'Écrit depuis' } })).status,
    ).toBe(200)

    const undone = await call(admin, `${V1}/history/undo`, 'POST', { transaction })
    expect(undone.status).toBe(409)
    expect(((await undone.json()) as Failure).code).toBe('REVISION_SUPERSEDED')
    // Nothing was taken back, not even the row nobody touched since.
    expect((await read(one as string)).nom).toBe('P1 collé')
    expect((await read(two as string)).nom).toBe('Écrit depuis')
  })
})

describe('the rights of the single update, row by row', () => {
  it('refuses a field the author reads but may not write — and writes nothing', async () => {
    const [one, two] = await Promise.all([createRow({ nom: 'D1' }), createRow({ nom: 'D2' })])
    const r = await batch(
      [change(one as string, { nom: 'D1 modifié' }), change(two as string, { note: 'interdit' })],
      alice,
    )
    expect(r.status).toBe(403)
    expect((await r.json()) as Failure).toMatchObject({
      code: 'FIELD_NOT_WRITABLE',
      details: { index: 1, field: 'note' },
    })
    expect((await read(one as string)).nom).toBe('D1')
    expect((await read(two as string)).note).toBeNull()
  })

  it('answers a field the author cannot see like one that does not exist', async () => {
    const one = await createRow({ nom: 'E1', secret: 'S' })
    const hidden = await batch([change(one, { secret: 'lu' })], alice)
    const unknown = await batch([change(one, { fantome: 'x' })], alice)
    expect(hidden.status).toBe(400)
    const asHidden = (await hidden.json()) as Failure
    expect(asHidden).toMatchObject({ code: 'FILTER_FIELD_UNKNOWN', details: { index: 0 } })
    expect(((await unknown.json()) as Failure).code).toBe(asHidden.code)
    expect((await read(one)).secret).toBe('S')
  })

  it('lets the author write what the mask allows', async () => {
    const [one, two] = await Promise.all([createRow({ nom: 'F1' }), createRow({ nom: 'F2' })])
    const r = await batch(
      [change(one as string, { nom: 'F1 par Alice' }), change(two as string, { montant: 5 })],
      alice,
    )
    expect(r.status, await r.clone().text()).toBe(200)
    expect((await read(one as string, alice)).nom).toBe('F1 par Alice')
  })

  it('refuses a reader who may not update at all', async () => {
    const one = await createRow({ nom: 'G1' })
    const r = await batch([change(one, { nom: 'G1 lecteur' })], bob)
    expect(r.status).toBe(403)
    expect(((await r.json()) as Failure).code).toBe('ADMIN_REQUIRED')
    expect((await read(one)).nom).toBe('G1')
  })

  it('refuses a row outside the rows the author reaches, as a row that is not there', async () => {
    const mine = await createRow({ nom: 'Visible' })
    const other = await createRow({ nom: 'Hors de portée' })
    const rule = await call(admin, `${V1}/admin/access/tables/${tableId}/rows`, 'PUT', {
      group: groupEditors,
      rule: 'nom ne "Hors de portée"',
    })
    expect(rule.status, await rule.clone().text()).toBe(200)
    try {
      const r = await batch(
        [change(mine, { nom: 'Visible modifiée' }), change(other, { nom: 'Piratée' })],
        alice,
      )
      expect(r.status).toBe(404)
      expect((await r.json()) as Failure).toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
        details: { index: 1 },
      })
      expect((await read(mine)).nom).toBe('Visible')
      expect((await read(other)).nom).toBe('Hors de portée')
    } finally {
      await call(admin, `${V1}/admin/access/tables/${tableId}/rows`, 'PUT', {
        group: groupEditors,
        rule: null,
      })
    }
  })
})

describe('what a batch of updates refuses before it writes', () => {
  it('a row that does not exist, or no identifier at all, names its position', async () => {
    const one = await createRow({ nom: 'H1' })
    const ghost = '0190a0b2-0000-7000-8000-000000000001'
    const missing = await batch([change(one, { nom: 'H1 modifié' }), change(ghost, { nom: 'x' })])
    expect(missing.status).toBe(404)
    expect((await missing.json()) as Failure).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      details: { index: 1 },
    })
    expect((await read(one)).nom).toBe('H1')

    const malformed = await batch([change('pas-un-identifiant', { nom: 'x' })])
    expect(malformed.status).toBe(404)
    expect(((await malformed.json()) as Failure).details.index).toBe(0)

    const none = await batch([{ op: 'update', data: { nom: 'x' } }])
    expect(none.status).toBe(400)
    expect((await none.json()) as Failure).toMatchObject({
      code: 'REQUEST_INVALID',
      details: { index: 0, reason: 'id_attendu' },
    })
  })

  it('a row named twice, a row with nothing to write, an empty batch', async () => {
    const one = await createRow({ nom: 'I1' })
    const twice = await batch([change(one, { nom: 'a' }), change(one, { nom: 'b' })])
    expect(twice.status).toBe(400)
    expect((await twice.json()) as Failure).toMatchObject({
      details: { index: 1, reason: 'ligne_en_double' },
    })

    const nothing = await batch([change(one, {})])
    expect(nothing.status).toBe(422)
    expect(((await nothing.json()) as Failure).details.index).toBe(0)

    expect((await batch([])).status).toBe(400)
    expect((await read(one)).nom).toBe('I1')
  })

  it('what the spec describes and is not done yet is refused by name', async () => {
    const one = await createRow({ nom: 'J1' })
    const guarded = await batch([{ op: 'update', id: one, if_match: '"abc"', data: { nom: 'x' } }])
    expect(guarded.status).toBe(400)
    expect(((await guarded.json()) as Failure).details.reason).toBe(
      'if_match_n_est_pas_pris_en_charge',
    )

    const mixed = await batch([change(one, { nom: 'x' }), { op: 'create', data: { nom: 'y' } }])
    expect(mixed.status).toBe(400)
    expect((await mixed.json()) as Failure).toMatchObject({
      details: { index: 1, reason: 'un_seul_genre_d_operation_par_lot' },
    })

    const removal = await batch([{ op: 'delete', id: one }])
    expect(removal.status).toBe(400)
    expect(((await removal.json()) as Failure).details.reason).toBe(
      'seuls_create_et_update_sont_pris_en_charge',
    )
    expect((await read(one)).nom).toBe('J1')
  })

  it('refuses more than a thousand operations with 413', async () => {
    const one = await createRow({ nom: 'K1' })
    const r = await batch(Array.from({ length: 1001 }, () => change(one, { nom: 'x' })))
    expect(r.status).toBe(413)
    expect(((await r.json()) as Failure).code).toBe('BATCH_TOO_LARGE')
  })

  it('needs a token', async () => {
    const r = await app.request(`${ROWS()}/batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [change('x', { nom: 'y' })] }),
    })
    expect(r.status).toBe(401)
  })
})

describe('a thousand rows in one transaction', () => {
  it('changes the lot, and one undo takes it back', async () => {
    const created = await batch(
      Array.from({ length: 1000 }, (_, i) => ({ op: 'create', data: { nom: `Lot ${i}` } })),
    )
    expect(created.status, await created.clone().text()).toBe(200)
    const ids = ((await created.json()) as { results: Array<{ id: string }> }).results.map(
      (x) => x.id,
    )

    const r = await batch(ids.map((id) => change(id, { statut: 'clos' })))
    expect(r.status, await r.clone().text()).toBe(200)
    const transaction = r.headers.get('x-basedb-transaction') ?? ''
    const closed = await call(
      admin,
      `${ROWS()}?filter=${encodeURIComponent('statut eq "clos"')}&count=exact&limit=1`,
    )
    expect(
      ((await closed.json()) as { meta: { count: number } }).meta.count,
    ).toBeGreaterThanOrEqual(1000)

    const undone = await call(admin, `${V1}/history/undo`, 'POST', { transaction })
    expect(undone.status, await undone.clone().text()).toBe(200)
    expect((await read(ids[999] as string)).statut).toBeNull()
  }, 120_000)
})
