import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Dashboards and questions over HTTP — chapter 18.
 *
 * What these guard: a dashboard's cards, tabs and filters are checked when saved, and the
 * blocks of the first dashboards still come in, as cards; the dashboards and questions of
 * a base are listed to whoever may read one of its tables, and to nobody else; a question
 * runs with the rights of whoever runs it — a hidden field is an unknown one, a table they
 * do not read answers as absent, a SQL question writes nothing, even for a builder.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'
const TZ = 'Europe/Paris'

type Session = { cookie: string; csrf: string; token: string }

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let admin: Session
let alice: Session
let bob: Session
let aliceId = ''
let base = ''
let visites = ''
/** The link from a visit to its site, by its physical name. */
let site = ''
const sites: Record<string, string> = {}

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

interface Result {
  columns: Array<{
    name: string
    role: string
    type: string
    unit?: string
    bin?: number
    hidden?: boolean
    labels?: Record<string, string>
  }>
  rows: unknown[][]
  truncated: boolean
  record?: { table: string; column: number }
}

const run = (session: Session, body: Record<string, unknown>) =>
  call(session, `${V1}/query/${base}`, 'POST', { timezone: TZ, ...body })

const ask = async (session: Session, query: Record<string, unknown>, extra = {}) => {
  const r = await run(session, { query: { kind: 'builder', source: visites, ...query }, ...extra })
  expect(r.status).toBe(200)
  return data<Result>(r)
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

  const chantiers = await call(admin, `${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Sites',
    fields: [{ label: 'Ville', kind: 'short_text' }],
  })
  expect(chantiers.status).toBe(201)
  expect(
    (
      await call(admin, `${V1}/admin/bases/${base}/tables/sites/display`, 'POST', {
        field: 'ville',
      })
    ).status,
  ).toBe(200)
  for (const ville of ['Lyon', 'Paris']) {
    const r = await call(admin, `${V1}/data/${base}/sites`, 'POST', { values: { ville } })
    expect(r.status).toBe(201)
    sites[ville] = (await data<{ _id: string }>(r))._id
  }

  const table = await call(admin, `${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Visites',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Note', kind: 'short_text' },
      { label: 'Jour', kind: 'date' },
      { label: 'Montant', kind: 'number' },
    ],
  })
  expect(table.status).toBe(201)
  visites = (await data<{ id: string }>(table)).id
  for (const field of [
    { label: 'Responsable', kind: 'user' },
    {
      label: 'Statut',
      kind: 'select',
      options: [
        { value: 'a_faire', label: 'À faire' },
        { value: 'fait', label: 'Fait' },
      ],
    },
  ]) {
    const r = await call(admin, `${V1}/admin/bases/${base}/tables/visites/fields`, 'POST', field)
    expect(r.status).toBe(201)
  }
  const link = await call(admin, `${V1}/admin/bases/${base}/tables/visites/links`, 'POST', {
    label: 'Site',
    target: 'sites',
  })
  expect(link.status).toBe(201)
  site = (await data<{ name: string }>(link)).name

  const rowsToAdd = [
    { nom: 'A', note: 'x', jour: '2026-01-15', montant: 100, statut: 'fait', [site]: sites.Lyon },
    { nom: 'B', jour: '2026-01-20', montant: 50, statut: 'a_faire', [site]: sites.Lyon },
    { nom: 'C', jour: '2026-02-03', montant: 30, statut: 'fait', [site]: sites.Paris },
    { nom: 'D', montant: 20 },
  ]
  for (const values of rowsToAdd) {
    const r = await call(admin, `${V1}/data/${base}/visites`, 'POST', { values })
    expect(r.status, JSON.stringify(await r.clone().json())).toBe(201)
  }

  const a = await person('alice@exemple.fr', 'Alice Martin')
  aliceId = a.id
  alice = a.session
  bob = (await person('bob@exemple.fr', 'Bob Durand')).session

  // Alice reads the visits, but neither their note nor the sites; Bob sees nothing.
  const group = await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Lecteurs' })
  const groupId = (await data<{ id: string }>(group)).id
  expect(
    (await call(admin, `${V1}/admin/groups/${groupId}/members/${aliceId}`, 'PUT')).status,
  ).toBe(204)
  const granted = await call(admin, `${V1}/admin/access`, 'POST', {
    changes: [{ group: groupId, scope: { kind: 'table', id: visites }, level: 'read' }],
  })
  expect(granted.status).toBe(200)
  const access = await data<{ fields: Array<{ id: string; label: string }> }>(
    await call(admin, `${V1}/admin/access/tables/${visites}/fields`),
  )
  const note = access.fields.find((f) => f.label === 'Note')?.id as string
  expect(
    (
      await call(admin, `${V1}/admin/access/fields/${note}`, 'PUT', {
        group: groupId,
        rule: 'hidden',
      })
    ).status,
  ).toBe(200)
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

const DASHBOARDS = () => `${V1}/admin/bases/${base}/dashboards`
const QUESTIONS = () => `${V1}/admin/bases/${base}/questions`

describe('a dashboard of blocks, as the first ones were', () => {
  let id = ''

  it('comes in as cards, each block a question of its own', async () => {
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
    const created = await data<{ id: string; cards: Array<Record<string, unknown>> }>(r)
    id = created.id
    expect(created.cards[0]).toMatchObject({
      kind: 'question',
      x: 0,
      y: 0,
      w: 8,
      title: 'Visites',
      query: { kind: 'builder', source: visites, aggregations: [{ fn: 'count' }] },
      visualization: { type: 'scalar' },
    })
    expect(created.cards[1]).toMatchObject({
      x: 8,
      query: { breakouts: [{ field: 'responsable' }] },
      visualization: { type: 'pie' },
    })
    // A list shows twenty rows at most, as it always did.
    expect(created.cards[2]).toMatchObject({
      query: { fields: [{ field: 'nom' }, { field: 'note' }], limit: 20 },
    })
    expect(created.cards[3]).toMatchObject({ kind: 'text', text: '# Consignes', x: 0, w: 24 })
    expect(created.cards[4]).toMatchObject({ kind: 'embed', url: 'https://exemple.fr/meteo' })
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
      cards: [],
    })
    expect(await data<{ label: string; cards: unknown[] }>(patched)).toMatchObject({
      label: 'Suivi hebdo',
      cards: [],
    })
    expect((await call(admin, `${DASHBOARDS()}/${id}`, 'DELETE')).status).toBe(204)
    expect(await data<unknown[]>(await call(admin, `${V1}/meta/bases/${base}/dashboards`))).toEqual(
      [],
    )
  })
})

describe('a question', () => {
  let question = ''

  it('is shared by whoever builds the base, checked against its tables', async () => {
    const r = await call(admin, QUESTIONS(), 'POST', {
      label: 'Montant par mois',
      audience: 'base',
      query: {
        kind: 'builder',
        source: 'visites',
        aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
        breakouts: [{ field: 'jour', unit: 'month' }],
      },
      visualization: { type: 'bar', settings: { values: true } },
    })
    expect(r.status).toBe(201)
    const saved = await data<{ id: string; kind: string; query: { source: string } }>(r)
    question = saved.id
    expect(saved).toMatchObject({ kind: 'builder', query: { source: visites } })

    const unknown = await call(admin, QUESTIONS(), 'POST', {
      label: 'Cassée',
      query: { kind: 'builder', source: visites, breakouts: [{ field: 'absent' }] },
    })
    expect(await unknown.json()).toMatchObject({ details: { reason: 'champ_inconnu' } })
    // A reader keeps queries of their own; sharing one is building the base.
    expect(
      (
        await call(alice, QUESTIONS(), 'POST', {
          label: 'Pour tous',
          audience: 'base',
          query: { kind: 'builder', source: visites },
        })
      ).status,
    ).toBe(403)
    const own = await call(alice, QUESTIONS(), 'POST', {
      label: 'À moi',
      query: { kind: 'builder', source: visites },
    })
    expect(own.status).toBe(201)
    const mine = await data<{ id: string }>(own)
    expect(mine).toMatchObject({ audience: 'personal', mine: true, editable: true })
    const seen = await data<Array<{ id: string }>>(
      await call(admin, `${V1}/meta/bases/${base}/questions`),
    )
    expect(seen.map((q) => q.id)).not.toContain(mine.id)
    expect((await call(alice, `${QUESTIONS()}/${mine.id}`, 'DELETE')).status).toBe(204)
  })

  it('is listed to whoever sees the base, and runs with their rights', async () => {
    const listed = await data<Array<{ id: string }>>(
      await call(alice, `${V1}/meta/bases/${base}/questions`),
    )
    expect(listed.map((q) => q.id)).toEqual([question])
    expect((await call(bob, `${V1}/meta/bases/${base}/questions`)).status).toBe(404)

    const result = await data<Result>(await run(alice, { question }))
    expect(result.columns.map((c) => [c.name, c.role, c.type])).toEqual([
      ['jour', 'dimension', 'date'],
      ['sum:montant', 'metric', 'number'],
    ])
    expect(result.rows).toEqual([
      ['2026-01-01', 150],
      ['2026-02-01', 30],
      [null, 20],
    ])
    expect((await run(bob, { question })).status).toBe(404)
  })

  it('takes a dashboard’s filters: a period, a value, another grouping', async () => {
    const year = await data<Result>(
      await run(admin, {
        question,
        constraints: [
          { target: { column: { field: 'jour' } }, type: 'temporal_unit', value: 'year' },
        ],
      }),
    )
    expect(year.rows).toEqual([
      ['2026-01-01', 180],
      [null, 20],
    ])
    const january = await data<Result>(
      await run(admin, {
        question,
        constraints: [{ target: { column: { field: 'jour' } }, type: 'date', value: '2026-01' }],
      }),
    )
    expect(january.rows).toEqual([['2026-01-01', 150]])
    const done = await ask(
      admin,
      { aggregations: [{ fn: 'count' }] },
      {
        constraints: [
          { target: { column: { field: 'statut' } }, type: 'category', value: ['fait'] },
        ],
      },
    )
    expect(done.rows).toEqual([[2]])
  })

  it('counts by a choice, runs a total, cuts numbers into bins', async () => {
    const byStatus = await ask(admin, {
      aggregations: [{ fn: 'count' }, { fn: 'cum_count' }],
      breakouts: [{ field: 'statut' }],
    })
    expect(byStatus.rows).toEqual([
      ['a_faire', 1, 1],
      ['fait', 2, 3],
      [null, 1, 4],
    ])
    const bins = await ask(admin, {
      aggregations: [{ fn: 'count' }],
      breakouts: [{ field: 'montant', bin: 'auto' }],
    })
    expect(bins.columns[0]).toMatchObject({ bin: 10, type: 'number' })
    expect(bins.rows.map((r) => r[0])).toEqual([20, 30, 50, 100])
  })

  it('filters by relative dates and by what the builder offers', async () => {
    const between = await ask(admin, {
      filters: [{ column: { field: 'jour' }, op: 'between', values: ['2026-01-16', '2026-02-28'] }],
      aggregations: [{ fn: 'count' }],
    })
    expect(between.rows).toEqual([[2]])
    const empty = await ask(admin, {
      filters: [{ column: { field: 'jour' }, op: 'empty', values: [] }],
      aggregations: [{ fn: 'count' }],
    })
    expect(empty.rows).toEqual([[1]])
    const not = await ask(admin, {
      filters: [{ column: { field: 'statut' }, op: 'is_not', values: ['fait'] }],
      aggregations: [{ fn: 'count' }],
    })
    // « Is not » keeps the rows without a value.
    expect(not.rows).toEqual([[2]])
    const past = await ask(admin, {
      filters: [{ column: { field: 'jour' }, op: 'date', values: ['past30years'] }],
      aggregations: [{ fn: 'count' }],
    })
    expect(past.rows).toEqual([[3]])
  })

  it('reads rows as they are, each with its identifier, and link labels', async () => {
    const rows = await ask(admin, {
      fields: [{ field: 'nom' }, { field: 'montant' }, { field: site }],
      sort: [{ target: { kind: 'column', column: { field: 'montant' } }, desc: true }],
      limit: 2,
    })
    expect(rows.rows.map((r) => r.slice(0, 2))).toEqual([
      ['A', 100],
      ['B', 50],
    ])
    expect(rows.truncated).toBe(true)
    expect(rows.record).toEqual({ table: visites, column: 3 })
    expect(rows.columns[3]).toMatchObject({ name: '_row', hidden: true })
    expect(rows.columns[2]?.labels).toEqual({ [sites.Lyon as string]: 'Lyon' })
  })

  it('joins another table, read with its own rights', async () => {
    const joined = {
      joins: [{ alias: 'site', table: 'sites', kind: 'left', left: { field: site }, right: '_id' }],
      aggregations: [{ fn: 'count' }],
      breakouts: [{ join: 'site', field: 'ville' }],
    }
    const r = await run(admin, { query: { kind: 'builder', source: visites, ...joined } })
    expect(r.status).toBe(200)
    expect((await data<Result>(r)).rows).toEqual([
      ['Lyon', 2],
      ['Paris', 1],
      [null, 1],
    ])
    // Alice does not read the sites: the join answers as a table that is not there.
    expect(
      (await run(alice, { query: { kind: 'builder', source: visites, ...joined } })).status,
    ).toBe(404)
  })

  it('never names a field its reader may not see', async () => {
    const hidden = await run(alice, {
      query: {
        kind: 'builder',
        source: visites,
        aggregations: [{ fn: 'count' }],
        breakouts: [{ field: 'note' }],
      },
    })
    expect(hidden.status).toBe(400)
    expect(await hidden.json()).toMatchObject({ code: 'FILTER_FIELD_UNKNOWN' })
    const rows = await ask(alice, { limit: 1 })
    expect(rows.columns.map((c) => c.name)).not.toContain('note')
    const admins = await ask(admin, { limit: 1 })
    expect(admins.columns.map((c) => c.name)).toContain('note')
  })
})

describe('a SQL question', () => {
  const query = {
    kind: 'sql',
    sql: 'SELECT count(*)::int AS n FROM visites WHERE {{periode}} [[AND statut = {{statut}}]]',
    variables: [
      { name: 'periode', label: 'Période', type: 'filter', column: 'jour', column_kind: 'date' },
      { name: 'statut', label: 'Statut', type: 'text' },
    ],
  }

  it('fills its variables from the filters, and leaves out what has no value', async () => {
    const all = await data<Result>(await run(alice, { query }))
    expect(all.rows).toEqual([[4]])
    const january = await data<Result>(
      await run(alice, {
        query,
        constraints: [
          { target: { variable: 'periode' }, type: 'date', value: '2026-01' },
          { target: { variable: 'statut' }, type: 'category', value: ['fait'] },
        ],
      }),
    )
    expect(january.rows).toEqual([[1]])
  })

  it('reads with the reader’s own rights, and writes nothing — a builder’s neither', async () => {
    const hidden = await run(alice, { query: { kind: 'sql', sql: 'SELECT note FROM visites' } })
    expect(hidden.status).not.toBe(200)
    const write = await run(admin, { query: { kind: 'sql', sql: 'DELETE FROM visites' } })
    expect(write.status).not.toBe(200)
    expect((await ask(admin, { aggregations: [{ fn: 'count' }] })).rows).toEqual([[4]])
  })
})

describe('a dashboard of cards', () => {
  it('keeps its tabs, its filters, and what each card ties them to', async () => {
    const question = (
      await data<Array<{ id: string }>>(await call(admin, `${V1}/meta/bases/${base}/questions`))
    )[0]?.id
    const r = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Pilotage',
      tabs: [
        { id: 't1', label: 'Vue d’ensemble' },
        { id: 't2', label: 'Détail' },
      ],
      parameters: [{ id: 'p1', label: 'Période', type: 'date', default: 'thisyear' }],
      cards: [
        {
          id: 'c1',
          tab: 't1',
          x: 0,
          y: 0,
          w: 12,
          h: 6,
          kind: 'question',
          question,
          mappings: [{ parameter: 'p1', target: { column: { field: 'jour' } } }],
        },
        { id: 'c2', tab: 'ailleurs', x: 12, y: 0, w: 12, h: 2, kind: 'heading', text: 'Chiffres' },
      ],
    })
    expect(r.status).toBe(201)
    const created = await data<{
      tabs: unknown[]
      parameters: unknown[]
      cards: Array<Record<string, unknown>>
    }>(r)
    expect(created.tabs).toHaveLength(2)
    expect(created.parameters).toEqual([
      { id: 'p1', label: 'Période', type: 'date', default: 'thisyear' },
    ])
    expect(created.cards[0]).toMatchObject({ question, mappings: [{ parameter: 'p1' }] })
    // A card in no tab of the dashboard lands in its first.
    expect(created.cards[1]).toMatchObject({ tab: 't1' })
  })

  it('keeps a rich text sanitized, and of the values it cites those it still cites', async () => {
    const question = (
      await data<Array<{ id: string }>>(await call(admin, `${V1}/meta/bases/${base}/questions`))
    )[0]?.id
    const text = (variables: unknown[], body = '<p>{{total}}</p>') =>
      call(admin, DASHBOARDS(), 'POST', {
        label: 'Lettre',
        parameters: [{ id: 'p1', label: 'Période', type: 'date' }],
        cards: [
          { id: 'c1', tab: null, x: 0, y: 0, w: 12, h: 4, kind: 'text', rich: true, text: body },
        ].map((c) => ({ ...c, variables })),
      })
    const r = await text(
      [
        {
          name: 'total',
          question,
          mappings: [{ parameter: 'p1', target: { column: { field: 'jour' } } }],
        },
        { name: 'periode', parameter: 'p1' },
        { name: 'oubliee', question },
      ],
      '<p onclick="x()">Total : <strong>{{total}}</strong> sur {{ periode }}<script>alert(1)</script></p>',
    )
    expect(r.status).toBe(201)
    const card = (await data<{ cards: Array<Record<string, unknown>> }>(r)).cards[0]
    expect(card).toMatchObject({
      kind: 'text',
      rich: true,
      text: '<p>Total : <strong>{{total}}</strong> sur {{ periode }}</p>',
    })
    // A value the text no longer cites goes.
    expect(card?.variables).toEqual([
      {
        name: 'total',
        question,
        mappings: [{ parameter: 'p1', target: { column: { field: 'jour' } } }],
      },
      { name: 'periode', parameter: 'p1' },
    ])
    const absent = await text([{ name: 'total', question: '00000000-0000-0000-0000-000000000000' }])
    expect(await absent.json()).toMatchObject({ details: { reason: 'question_inconnue' } })
    const filter = await text([{ name: 'total', parameter: 'absent' }])
    expect(await filter.json()).toMatchObject({ details: { reason: 'filtre_inconnu' } })
    const named = await text([{ name: 'Total', question }], '<p>{{Total}}</p>')
    expect(await named.json()).toMatchObject({ details: { reason: 'nom_invalide' } })
    const gone = await text([{ name: 'total', card: 'absente' }])
    expect(await gone.json()).toMatchObject({ details: { reason: 'carte_inconnue' } })
  })

  it('cites a card of the dashboard, or a query of its own kept by its content', async () => {
    const r = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Lettre',
      cards: [
        {
          id: 'c1',
          tab: null,
          x: 0,
          y: 0,
          w: 12,
          h: 4,
          kind: 'question',
          query: { kind: 'builder', source: visites, aggregations: [{ fn: 'count' }] },
        },
        {
          id: 'c2',
          tab: null,
          x: 12,
          y: 0,
          w: 12,
          h: 4,
          kind: 'text',
          rich: true,
          text: '<p>{{visites}} visites, {{mienne}}</p>',
          variables: [
            { name: 'visites', card: 'c1' },
            {
              name: 'mienne',
              label: 'À moi',
              query: { kind: 'builder', source: visites, aggregations: [{ fn: 'count' }] },
              visualization: { type: 'scalar' },
            },
          ],
        },
      ],
    })
    expect(r.status).toBe(201)
    const card = (await data<{ cards: Array<Record<string, unknown>> }>(r)).cards[1]
    expect(card?.variables).toEqual([
      { name: 'visites', card: 'c1' },
      {
        name: 'mienne',
        label: 'À moi',
        query: { kind: 'builder', source: visites, aggregations: [{ fn: 'count' }] },
        visualization: { type: 'scalar' },
      },
    ])
    // A query kept in the text is checked as a card's is.
    const wrong = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Lettre',
      cards: [
        {
          id: 'c2',
          tab: null,
          x: 0,
          y: 0,
          w: 12,
          h: 4,
          kind: 'text',
          text: '{{mienne}}',
          variables: [
            {
              name: 'mienne',
              query: { kind: 'builder', source: visites, fields: [{ field: 'absent' }] },
            },
          ],
        },
      ],
    })
    expect(await wrong.json()).toMatchObject({ details: { reason: 'champ_inconnu' } })
  })

  it('refuses a card off the grid, or tied to a filter it does not have', async () => {
    const wide = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Cassé',
      cards: [{ id: 'c1', tab: null, x: 20, y: 0, w: 8, h: 2, kind: 'text', text: '' }],
    })
    expect(await wide.json()).toMatchObject({ details: { reason: 'position_invalide' } })
    const tied = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Cassé',
      cards: [
        {
          id: 'c1',
          tab: null,
          x: 0,
          y: 0,
          w: 8,
          h: 4,
          kind: 'question',
          query: { kind: 'builder', source: visites },
          mappings: [{ parameter: 'absent', target: { column: { field: 'jour' } } }],
        },
      ],
    })
    expect(await tied.json()).toMatchObject({ details: { reason: 'filtre_inconnu' } })
  })
})

describe('a shared dashboard', () => {
  let id = ''
  let token = ''
  let groupId = ''
  const SHARE = () => `${DASHBOARDS()}/${id}/share`
  const visit = (path: string, method = 'GET', body?: unknown, session?: Session) =>
    app.request(`/api/v1/dashboards/${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(session === undefined ? {} : { authorization: `Bearer ${session.token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  beforeAll(async () => {
    const question = (
      await data<Array<{ id: string; label: string }>>(
        await call(admin, `${V1}/meta/bases/${base}/questions`),
      )
    ).find((q) => q.label === 'Montant par mois')?.id
    const r = await call(admin, DASHBOARDS(), 'POST', {
      label: 'Chantiers en cours',
      description: 'Pour les partenaires',
      parameters: [{ id: 'statut', label: 'Statut', type: 'category', multiple: true }],
      cards: [
        {
          id: 'total',
          tab: null,
          x: 0,
          y: 0,
          w: 12,
          h: 4,
          kind: 'question',
          title: 'Montant par statut',
          query: {
            kind: 'builder',
            source: visites,
            aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
            breakouts: [{ field: 'statut' }],
          },
          visualization: { type: 'pie' },
          mappings: [{ parameter: 'statut', target: { column: { field: 'statut' } } }],
        },
        {
          id: 'auteurs',
          tab: null,
          x: 12,
          y: 0,
          w: 12,
          h: 4,
          kind: 'question',
          title: 'Par auteur',
          query: {
            kind: 'builder',
            source: visites,
            aggregations: [{ fn: 'count' }],
            breakouts: [{ field: '_created_by' }],
          },
        },
        {
          id: 'lignes',
          tab: null,
          x: 0,
          y: 4,
          w: 24,
          h: 6,
          kind: 'question',
          query: { kind: 'builder', source: visites, fields: [{ field: 'nom' }] },
        },
        {
          id: 'mot',
          tab: null,
          x: 0,
          y: 10,
          w: 24,
          h: 2,
          kind: 'text',
          rich: true,
          text: '<p>Bonjour : {{montant}} au total</p>',
          variables: [
            {
              name: 'montant',
              question,
              mappings: [{ parameter: 'statut', target: { column: { field: 'statut' } } }],
            },
          ],
        },
      ],
    })
    expect(r.status).toBe(201)
    id = (await data<{ id: string }>(r)).id
    const groups = await data<Array<{ id: string; label: string }>>(
      await call(admin, `${V1}/admin/groups`),
    )
    groupId = groups.find((g) => g.label === 'Lecteurs')?.id as string
  })

  it('is not shared until someone shares it, and only by who builds the base', async () => {
    const none = await data<{ share: unknown; groups: unknown[] }>(await call(admin, SHARE()))
    expect(none.share).toBeNull()
    expect((await call(alice, SHARE(), 'PUT', { access: 'public' })).status).not.toBe(200)
  })

  it('opens by its link to anyone, with what the cards show and nothing else', async () => {
    const r = await call(admin, SHARE(), 'PUT', { access: 'public' })
    expect(r.status).toBe(200)
    const sharing = await data<{ share: { token: string; state: string; access: string } }>(r)
    expect(sharing.share).toMatchObject({ state: 'open', access: 'public' })
    token = sharing.share.token
    expect(token).toHaveLength(32)

    const page = await visit(token)
    expect(page.status).toBe(200)
    const opened = await data<{
      title: string
      cards: Array<Record<string, unknown>>
      tables: Array<{ fields: Array<{ name: string }> }>
    }>(page)
    expect(opened.title).toBe('Chantiers en cours')
    expect(opened.cards.map((c) => c.id)).toEqual(['total', 'auteurs', 'lignes', 'mot'])
    expect(opened.cards[0]).toMatchObject({
      title: 'Montant par statut',
      visualization: { type: 'pie' },
      filters: ['statut'],
    })
    // Never what a card runs.
    expect(JSON.stringify(opened.cards)).not.toContain('aggregations')
    // Of the table, the fields the cards cite: the note is in none of them.
    const names = opened.tables.flatMap((t) => t.fields.map((f) => f.name))
    expect(names).toEqual(expect.arrayContaining(['statut', 'montant', 'nom']))
    expect(names).not.toContain('note')
  })

  it('runs a card on the publisher’s authority, its filters tied by the dashboard', async () => {
    const all = await visit(`${token}/cards/total`, 'POST', {})
    expect(all.status).toBe(200)
    const every = await data<Result>(all)
    expect(every.rows).toEqual(
      expect.arrayContaining([
        ['fait', 130],
        ['a_faire', 50],
      ]),
    )
    const done = await data<Result>(
      await visit(`${token}/cards/total`, 'POST', { values: { statut: ['fait'] } }),
    )
    expect(done.rows).toEqual([['fait', 130]])
    // A filter the dashboard does not have, or a query of the visitor's: nothing of the kind.
    const unknown = await visit(`${token}/cards/total`, 'POST', { values: { note: 'x' } })
    expect(unknown.status).toBe(400)
    const smuggled = await data<Result>(
      await visit(`${token}/cards/total`, 'POST', {
        query: { kind: 'sql', sql: 'SELECT note FROM visites' },
      }),
    )
    expect(smuggled.columns.map((c) => c.name)).not.toContain('note')
    expect((await visit(`${token}/cards/mot`, 'POST', {})).status).toBe(404)
  })

  it('runs a query a text cites, by its name, tied as the text ties it', async () => {
    const page = await data<{ cards: Array<Record<string, unknown>> }>(await visit(token))
    const text = page.cards.find((c) => c.id === 'mot')
    expect(text).toMatchObject({
      rich: true,
      text: '<p>Bonjour : {{montant}} au total</p>',
      variables: [{ name: 'montant', kind: 'question', filters: ['statut'] }],
      filters: ['statut'],
    })
    // Never what it runs, nor which query.
    expect(JSON.stringify(text)).not.toContain('aggregations')
    expect(Object.keys((text?.variables as object[])[0] ?? {})).not.toContain('question')
    const sum = (result: Result) => result.rows.reduce((t, row) => t + Number(row[1] ?? 0), 0)
    const every = await visit(`${token}/cards/mot/variables/montant`, 'POST', {})
    expect(every.status).toBe(200)
    const byStatus = await data<Result>(await visit(`${token}/cards/total`, 'POST', {}))
    expect(sum(await data<Result>(every))).toBe(sum(byStatus))
    const done = await data<Result>(
      await visit(`${token}/cards/mot/variables/montant`, 'POST', { values: { statut: ['fait'] } }),
    )
    expect(sum(done)).toBe(130)
    // A name the text does not cite, or a card that is no text: nothing to run.
    expect((await visit(`${token}/cards/mot/variables/absente`, 'POST', {})).status).toBe(404)
    expect((await visit(`${token}/cards/total/variables/montant`, 'POST', {})).status).toBe(404)
  })

  it('names people, and keeps no way to open a row', async () => {
    const authors = await data<Result>(await visit(`${token}/cards/auteurs`, 'POST', {}))
    expect(Object.values(authors.columns[0]?.labels ?? {})).toEqual(['Bootstrap'])
    const rows = await data<Result>(await visit(`${token}/cards/lignes`, 'POST', {}))
    expect(rows.columns.every((c) => c.hidden !== true)).toBe(true)
    expect(rows.record).toBeUndefined()
    expect(rows.rows).toHaveLength(4)
  })

  it('lists the values a filter offers, by their labels', async () => {
    const values = await data<Array<{ value: string; label: string }>>(
      await visit(`${token}/parameters/statut/values`),
    )
    expect(values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'fait', label: 'Fait' }),
        expect.objectContaining({ value: 'a_faire', label: 'À faire' }),
      ]),
    )
    expect((await visit(`${token}/parameters/absent/values`)).status).toBe(404)
  })

  it('for members, asks to sign in; for a group, admits its members alone', async () => {
    await call(admin, SHARE(), 'PUT', { access: 'members' })
    expect((await visit(token)).status).toBe(401)
    // Bob holds no right on the base: the link opens it to him all the same.
    expect((await visit(token, 'GET', undefined, bob)).status).toBe(200)
    await call(admin, SHARE(), 'PUT', { access: 'members', groups: [groupId] })
    const refused = await visit(token, 'GET', undefined, bob)
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ code: 'VIEW_SHARE_RESTRICTED' })
    const page = await data<{ reader: string }>(await visit(token, 'GET', undefined, alice))
    expect(page.reader).toBe('Alice Martin')
  })

  it('closes when turned off, changes link when regenerated, and is forgotten', async () => {
    await call(admin, SHARE(), 'PUT', { access: 'public', active: false })
    const closed = await visit(token)
    expect(closed.status).toBe(409)
    expect(await closed.json()).toMatchObject({ code: 'VIEW_SHARE_CLOSED' })
    await call(admin, SHARE(), 'PUT', { access: 'public', active: true })
    const renewed = await data<{ share: { token: string } }>(
      await call(admin, `${SHARE()}/regenerate`, 'POST'),
    )
    expect(renewed.share.token).not.toBe(token)
    expect((await visit(token)).status).toBe(404)
    expect((await visit(renewed.share.token)).status).toBe(200)
    expect((await call(admin, SHARE(), 'DELETE')).status).toBe(204)
    expect((await visit(renewed.share.token)).status).toBe(404)
  })
})
