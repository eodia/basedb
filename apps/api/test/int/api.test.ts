import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * The API, end to end.
 *
 * The tests run WITHOUT OPENING A SOCKET: Hono manipulates the standard `Request` and
 * `Response` objects, so `app.request()` is enough. This is one of the three reasons it
 * was preferred to Fastify (chapter 10 §1.4), and it makes the suite parallelizable
 * without coordinating ports.
 *
 * URL plan of §1.4: `/api/v1/{tenantRef}`, then `/data/`, `/meta/` or `/admin/`. The
 * paths here are written the way an integrator writes them — with logical names, not
 * identifiers — because that is exactly the promise being tested.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let actor: string
/** The access token every `/api/v1` call carries, obtained once by logging in. */
let access = ''
let cookie = ''
let csrf = ''

const PASSWORD = 'les chaussettes de larchiduchesse'

const auth = () => ({ authorization: `Bearer ${access}` })

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...auth() },
  body: JSON.stringify(body),
})

/** `GET` on an authenticated route. */
const GET = (path: string, headers: Record<string, string> = {}) =>
  app.request(path, { headers: { ...auth(), ...headers } })

const DEL = (path: string) => app.request(path, { method: 'DELETE', headers: auth() })

/** Creates a base and returns its logical name. */
async function makeBase(label: string): Promise<string> {
  const r = await app.request(`${V1}/admin/bases`, json({ label }))
  const body = (await r.json()) as { data: { name: string } }
  return body.data.name
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()

  // Bootstrap: the only moment when the catalog is written without going through an
  // operation — it is the first start, and no actor exists yet.
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

  actor = rows[0].created_by
  app = createApp({ kernel })

  // From here on, every `/api/v1` call carries an access token — the crutch of
  // `?actor=<uuid>` is gone, and with it a bearer credential that sat in query strings,
  // access logs and browser history, never expiring and never revocable.
  await kernel.setPassword({ userId: actor, password: PASSWORD })
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
  })
  cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  csrf = ((await login.json()) as { data: { csrf: string } }).data.csrf

  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  access = ((await issued.json()) as { data: { token: string } }).data.token
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('entry points outside the catalog', () => {
  it('the liveness probe answers', async () => {
    const r = await app.request('/healthz')
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual({ status: 'ok' })
  })

  it('every response carries a request identifier', async () => {
    const r = await app.request('/healthz')
    expect(r.headers.get('x-request-id')).toBeTruthy()
  })

  it('the identifier supplied by the caller is preserved', async () => {
    // End-to-end correlation: a client that already holds a trace keeps it.
    const r = await app.request('/healthz', { headers: { 'x-request-id': 'trace-42' } })
    expect(r.headers.get('x-request-id')).toBe('trace-42')
  })

  it('the code registry is published', async () => {
    const r = await app.request('/api/v1/codes')
    const body = (await r.json()) as { codes: Array<{ code: string }> }
    expect(body.codes.length).toBeGreaterThan(200)
    expect(body.codes.map((c) => c.code)).toContain('RESOURCE_NOT_FOUND')
  })
})

describe('full cycle over HTTP', () => {
  let base: string

  it('creates a base and returns the assigned physical name', async () => {
    const r = await app.request(`${V1}/admin/bases`, json({ label: 'CRM' }))
    expect(r.status).toBe(201)
    const body = (await r.json()) as { data: { id: string; name: string } }
    // The name is returned: it is the one the caller will write in their SQL queries —
    // and, from now on, in their URLs.
    expect(body.data.name).toBe(`b_${TENANT_REF}_crm`)
    base = body.data.name
  })

  it('creates a table and returns its qualified SQL name', async () => {
    const r = await app.request(
      `${V1}/admin/bases/${base}/tables`,
      json({
        label: 'Factures',
        fields: [
          { label: 'Numéro', kind: 'short_text', required: true },
          { label: 'Montant', kind: 'number' },
        ],
      }),
    )
    expect(r.status).toBe(201)
    const body = (await r.json()) as {
      data: { name: string; sql: string; fields: Array<{ name: string }> }
    }
    expect(body.data.sql).toBe(`"b_${TENANT_REF}_crm"."factures"`)
    expect(body.data.name).toBe('factures')
    expect(body.data.fields.map((f) => f.name)).toEqual(['numero', 'montant'])
  })

  it('writes then reads back a record, addressed by NAME', async () => {
    const creation = await app.request(
      `${V1}/data/${base}/factures`,
      json({ values: { numero: 'F-2026-001', montant: 1234.56 } }),
    )
    expect(creation.status).toBe(201)
    const created = (await creation.json()) as { data: Record<string, unknown> }
    expect(created.data.numero).toBe('F-2026-001')
    // `_created_by` is filled in by the kernel, never by the caller.
    expect(created.data._created_by).toBe(actor)

    const read = await GET(`${V1}/data/${base}/factures`)
    expect(read.status).toBe(200)
    const body = (await read.json()) as { data: unknown[]; meta: { columns: string[] } }
    expect(body.data).toHaveLength(1)
    expect(body.meta.columns).toContain('numero')
  })

  it('accepts the identifier just as well as the name', async () => {
    // Two namespaces that cannot collide: a canonical UUID carries dashes, which the
    // logical-name alphabet forbids. An integration surviving a rename uses the UUID.
    const meta = await GET(`${V1}/meta/bases/${base}`)
    const described = (await meta.json()) as {
      data: { id: string; tables: Array<{ id: string; name: string }> }
    }
    const table = described.data.tables.find((t) => t.name === 'factures')

    const read = await GET(`${V1}/data/${described.data.id}/${table?.id}`)
    expect(read.status).toBe(200)
    const body = (await read.json()) as { data: unknown[] }
    expect(body.data).toHaveLength(1)
  })
})

describe('/meta — the catalog projection', () => {
  it('lists the visible bases', async () => {
    const r = await GET(`${V1}/meta/bases`)
    expect(r.status).toBe(200)
    const body = (await r.json()) as {
      data: Array<{ name: string; label: string; table_count: number }>
    }
    const crm = body.data.find((b) => b.name === `b_${TENANT_REF}_crm`)
    expect(crm?.label).toBe('CRM')
    expect(crm?.table_count).toBeGreaterThanOrEqual(1)
  })

  it('describes the tables, their fields and their SQL name', async () => {
    const r = await GET(`${V1}/meta/bases/b_${TENANT_REF}_crm`)
    expect(r.status).toBe(200)
    const body = (await r.json()) as {
      data: {
        tables: Array<{
          name: string
          sql: string
          actions: string[]
          fields: Array<{ name: string; system: boolean; read_only: boolean }>
        }>
      }
    }
    const table = body.data.tables.find((t) => t.name === 'factures')
    expect(table?.sql).toBe(`"b_${TENANT_REF}_crm"."factures"`)
    // The administrator holds every verb.
    expect(table?.actions).toEqual(['read', 'create', 'update', 'delete'])
    // System columns are always described, and always read-only (A18).
    expect(table?.fields.find((f) => f.name === '_id')?.read_only).toBe(true)
    expect(table?.fields.find((f) => f.name === 'numero')?.system).toBe(false)
  })

  it('describes a table so it can be addressed DIRECTLY, with no extra lookup', async () => {
    // The description carries the base name beside the table name, because `{base}/{table}`
    // is what addresses it. Without it the caller holds a description they cannot turn
    // into a URL — which is how the interface ended up calling `/data/undefined/factures`.
    const meta = await GET(`${V1}/meta/bases/b_${TENANT_REF}_crm`)
    const body = (await meta.json()) as {
      data: { tables: Array<{ base: string; name: string }> }
    }
    const table = body.data.tables.find((t) => t.name === 'factures')
    expect(table?.base).toBe(`b_${TENANT_REF}_crm`)

    const read = await GET(`${V1}/data/${table?.base}/${table?.name}`)
    expect(read.status).toBe(200)
  })

  it('answers 404 for a base that does not exist', async () => {
    const r = await GET(`${V1}/meta/bases/b_t4z56fq_fantome`)
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('serves an OpenAPI 3.1 document whose paths are callable as printed', async () => {
    const r = await GET(`${V1}/meta/bases/b_${TENANT_REF}_crm/openapi.json`)
    expect(r.status).toBe(200)
    const spec = (await r.json()) as {
      openapi: string
      servers: Array<{ url: string }>
      paths: Record<string, unknown>
    }
    expect(spec.openapi).toBe('3.1.0')
    // The tenant is in every path: a specification one cannot call as printed is worth
    // nothing.
    expect(spec.servers[0].url).toBe(V1)

    const path = Object.keys(spec.paths).find((p) => p.endsWith('/factures'))
    expect(path).toBe(`/data/b_${TENANT_REF}_crm/factures`)
    const read = await GET(`${V1}${path}`)
    expect(read.status).toBe(200)
  })

  it('serves a readable documentation describing every visible relation', async () => {
    const r = await GET(`${V1}/meta/bases/b_${TENANT_REF}_crm/doc`, { 'x-basedb-locale': 'fr' })
    expect(r.status).toBe(200)
    const body = (await r.json()) as {
      data: { title: string; sections: Array<{ id: string; markdown: string }> }
    }
    expect(body.data.sections.map((s) => s.id)).toContain('factures')
    // It says the one thing a machine contract cannot: what happens in direct SQL.
    const sql = body.data.sections.find((s) => s.id === 'ecrire-en-sql')
    expect(sql?.markdown).toContain('ne s’appliquent pas en SQL direct')
  })

  it('writes the documentation in the language of the screen, one validator per language', async () => {
    const path = `${V1}/meta/bases/b_${TENANT_REF}_crm/doc`
    const french = await GET(path, { 'x-basedb-locale': 'fr' })
    const english = await GET(path, { 'x-basedb-locale': 'en' })
    const body = (await english.json()) as {
      data: { sections: Array<{ id: string; markdown: string }> }
    }
    const sql = body.data.sections.find((s) => s.id === 'ecrire-en-sql')
    expect(sql?.markdown).not.toContain('ne s’appliquent pas en SQL direct')
    expect(english.headers.get('etag')).not.toBe(french.headers.get('etag'))
    expect(english.headers.get('vary')).toContain('X-Basedb-Locale')
  })

  it('carries a validator, and answers 304 when the caller sends it back', async () => {
    const path = `${V1}/meta/bases/b_${TENANT_REF}_crm`
    const first = await GET(path)
    const etag = first.headers.get('etag')
    expect(etag).toBeTruthy()

    // NOT `no-store`: that would forbid the client from keeping the response, hence the
    // validator, hence from ever sending `If-None-Match` — and this 304 would never
    // happen.
    expect(first.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate')
    expect(first.headers.get('vary')).toContain('Authorization')

    const again = await GET(path, { 'if-none-match': etag ?? '' })
    expect(again.status).toBe(304)
    expect(await again.text()).toBe('')
  })

  it('invalidates the validator when the structure changes', async () => {
    const path = `${V1}/meta/bases/b_${TENANT_REF}_crm`
    const before = (await GET(path)).headers.get('etag') ?? ''

    await app.request(
      `${V1}/admin/bases/b_${TENANT_REF}_crm/tables`,
      json({ label: 'Avoirs', fields: [{ label: 'Numéro', kind: 'short_text' }] }),
    )

    const stale = await GET(path, { 'if-none-match': before })
    expect(stale.status).toBe(200)
    expect(stale.headers.get('etag')).not.toBe(before)
  })

  it('protects both serializations exactly like /meta', async () => {
    // A carefully filtered specification served without authentication filters nothing.
    for (const suffix of ['/openapi.json', '/doc']) {
      const r = await app.request(`${V1}/meta/bases/b_${TENANT_REF}_crm${suffix}`)
      expect(r.status).toBe(401)
    }
  })

  it('requires authentication like the rest of the API', async () => {
    // `/meta/*` is the first target of a reconnaissance: it has no reason to be less
    // protected than `/data/*`.
    const r = await app.request(`${V1}/meta/bases`)
    expect(r.status).toBe(401)
  })
})

describe('refusals — one single place of translation', () => {
  it('without a credential it is 401, never 404', async () => {
    // Missing authentication is never disguised as a missing resource: a client must be
    // able to reconnect.
    const r = await app.request(`${V1}/admin/bases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'X' }),
    })
    expect(r.status).toBe(401)
    await expect(r.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' })
  })

  it('answers the same to an absent, a malformed and a forged access token', async () => {
    // Three different situations, one answer. Telling them apart would say which of the
    // caller's attempts got further than the others.
    const codes: string[] = []
    for (const header of [undefined, 'Bearer pas-un-jeton', 'Bearer bda_bnVsbA', 'Basic abc']) {
      const r = await app.request(
        `${V1}/data/b_${TENANT_REF}_crm/factures`,
        header === undefined ? {} : { headers: { authorization: header } },
      )
      expect(r.status).toBe(401)
      codes.push(((await r.json()) as { code: string }).code)
    }
    expect(new Set(codes).size).toBe(1)
    expect(codes[0]).toBe('AUTHENTICATION_REQUIRED')
  })

  it('an empty label is refused with 422', async () => {
    const r = await app.request(`${V1}/admin/bases`, json({ label: '   ' }))
    expect(r.status).toBe(422)
    await expect(r.json()).resolves.toMatchObject({ code: 'LABEL_EMPTY' })
  })

  it('a non-existent table returns 404, with the registry code', async () => {
    const r = await GET(`${V1}/data/b_${TENANT_REF}_crm/fantome`)
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('a caller carried onto another tenant gets 404, never 403', async () => {
    // Answering "you have no right here" would confirm that the tenant exists.
    const r = await GET('/api/v1/tautre1/meta/bases')
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })
})

describe('development account', () => {
  it('is not published outside development', async () => {
    // Not an access check, an absence: the route is not mounted, and the URL answers
    // like any other unknown URL.
    const r = await app.request('/api/v1/dev/account')
    expect(r.status).toBe(404)
  })

  it('publishes the ADDRESS alone in development, when the server has just bootstrapped', async () => {
    const inDevelopment = createApp({ kernel, developmentEmail: 'admin@basedb.local' })
    const r = await inDevelopment.request('/api/v1/dev/account')
    expect(r.status).toBe(200)
    const body = await r.json()
    // The address, so the login form can prefill it. Never the password.
    expect(body).toEqual({ email: 'admin@basedb.local' })
    expect(JSON.stringify(body)).not.toContain('password')
  })

  it('every error carries the request identifier', async () => {
    const r = await app.request(`${V1}/admin/bases`, json({ label: '' }))
    const body = (await r.json()) as { request_id: string }
    expect(body.request_id).toBeTruthy()
    expect(r.headers.get('x-request-id')).toBe(body.request_id)
  })
})

describe('public demo', () => {
  // An address of its own: the rate-limiting bucket of `/auth/*` is shared by every test
  // that sends none.
  const from = { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.21' }
  const demo = () =>
    createApp({
      kernel,
      demo: {
        accounts: [
          { locale: 'fr', email: 'bootstrap@basedb.local' },
          { locale: 'de', email: 'demo-de@basedb.local' },
        ],
        password: PASSWORD,
      },
    })

  it('is not published outside the demo', async () => {
    expect((await app.request('/auth/demo')).status).toBe(404)
  })

  it('publishes the account of the screen’s language, and signs it in whatever password is typed', async () => {
    const target = demo()
    const published = await target.request('/auth/demo', { headers: { 'x-basedb-locale': 'de' } })
    expect(await published.json()).toMatchObject({
      data: { email: 'demo-de@basedb.local', password: PASSWORD, locale: 'de' },
    })
    const french = await target.request('/auth/demo', { headers: { 'x-basedb-locale': 'fr' } })
    expect(((await french.json()) as { data: { email: string } }).data.email).toBe(
      'bootstrap@basedb.local',
    )
    // A wrong password would count towards the lockout, which would close the demo to
    // every visitor at once.
    const login = await target.request('/auth/password/login', {
      method: 'POST',
      headers: from,
      body: JSON.stringify({ email: 'Bootstrap@basedb.local', password: 'pas-le-bon' }),
    })
    expect(login.status).toBe(200)
  })

  it('reads, and refuses a creation by name', async () => {
    const target = demo()
    expect((await target.request(`${V1}/meta/bases`, { headers: auth() })).status).toBe(200)
    const created = await target.request(`${V1}/admin/bases`, json({ label: 'Refusée' }))
    expect(created.status).toBe(403)
    expect(await created.json()).toMatchObject({
      code: 'ACTION_FORBIDDEN',
      details: { reason: 'demo' },
    })
  })
})

describe('first administrator, created from the interface', () => {
  // An address of their own: the rate-limiting bucket of `/auth/*` is shared by every
  // test that sends none.
  const from = { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' }
  const create = (target: ReturnType<typeof createApp>, email: string, name: string) =>
    target.request('/auth/bootstrap', {
      method: 'POST',
      headers: from,
      body: JSON.stringify({ email, display_name: name, password: PASSWORD }),
    })

  it('does not exist once the instance has an administrator, and creates nobody', async () => {
    expect((await app.request('/auth/bootstrap')).status).toBe(404)
    const r = await create(app, 'intrus@exemple.fr', 'Intrus')
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })

    const login = await app.request('/auth/password/login', {
      method: 'POST',
      headers: from,
      body: JSON.stringify({ email: 'intrus@exemple.fr', password: PASSWORD }),
    })
    expect(login.status).toBe(401)
  })

  it('on a fresh instance, the first visitor creates it and leaves signed in', async () => {
    const { Client } = await import('pg')
    const client = new Client({ connectionString: container.getConnectionUri() })
    await client.connect()
    await client.query('CREATE DATABASE premiere_visite')
    await client.end()

    const uri = new URL(container.getConnectionUri())
    uri.pathname = '/premiere_visite'
    const fresh = startKernel({
      connectionString: uri.toString(),
      encryptionKey: 'cle-instance-de-test-0123456789',
    })
    try {
      await fresh.migrateCatalog()
      const first = createApp({ kernel: fresh })

      const open = await first.request('/auth/bootstrap')
      await expect(open.json()).resolves.toEqual({ data: { open: true } })

      const r = await create(first, 'camille@exemple.fr', 'Camille Martin')
      expect(r.status).toBe(200)
      const planted = r.headers.get('set-cookie')?.split(';')[0] ?? ''
      const me = await first.request('/auth/me', { headers: { cookie: planted } })
      await expect(me.json()).resolves.toMatchObject({
        data: {
          email: 'camille@exemple.fr',
          display_name: 'Camille Martin',
          is_instance_admin: true,
          is_admin: true,
          must_change_password: false,
        },
      })

      // Taken: the road is gone, for the next visitor as for this one.
      expect((await first.request('/auth/bootstrap')).status).toBe(404)
      expect((await create(first, 'second@exemple.fr', 'Second')).status).toBe(404)
    } finally {
      await fresh.close()
    }
  })
})

describe('an account of one’s own, and sharing by a link', () => {
  const from = (address: string) => ({
    'content-type': 'application/json',
    'x-forwarded-for': address,
  })

  /** Signs up, and returns the bearer of the new account. */
  async function signUp(email: string, name: string, address: string, invitation?: string) {
    const r = await app.request('/auth/signup', {
      method: 'POST',
      headers: from(address),
      body: JSON.stringify({ email, display_name: name, password: PASSWORD, invitation }),
    })
    expect(r.status).toBe(200)
    const planted = r.headers.get('set-cookie')?.split(';')[0] ?? ''
    const { csrf } = ((await r.json()) as { data: { csrf: string } }).data
    const issued = await app.request('/auth/session/access', {
      method: 'POST',
      headers: { cookie: planted, 'x-basedb-csrf': csrf },
    })
    const token = ((await issued.json()) as { data: { token: string } }).data.token
    return { authorization: `Bearer ${token}` }
  }

  it('anyone signs up, creates a project and invites someone to it', async () => {
    await expect((await app.request('/auth/signup')).json()).resolves.toEqual({
      data: { open: true, domains: [] },
    })
    const lea = await signUp('lea@exemple.fr', 'Léa Martin', '203.0.113.21')

    const created = await app.request(`${V1}/admin/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...lea },
      body: JSON.stringify({ label: 'Atelier' }),
    })
    expect(created.status).toBe(201)
    const project = ((await created.json()) as { data: { id: string } }).data.id

    const invited = await app.request(`${V1}/sharing/project/${project}/invitations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...lea },
      body: JSON.stringify({ email: 'tom@exemple.fr', level: 'edit' }),
    })
    expect(invited.status).toBe(201)
    const { token } = ((await invited.json()) as { data: { token: string } }).data

    // The link's page, before anyone signs in.
    const preview = await app.request('/auth/invitation', {
      method: 'POST',
      headers: from('203.0.113.22'),
      body: JSON.stringify({ token }),
    })
    await expect(preview.json()).resolves.toMatchObject({
      data: {
        scope: { kind: 'project', label: 'Atelier' },
        level: 'edit',
        invited_by: 'Léa Martin',
      },
    })

    const tom = await signUp('tom@exemple.fr', 'Tom Roux', '203.0.113.22', token)
    const accepted = await app.request(`${V1}/invitations/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...tom },
      body: JSON.stringify({ token }),
    })
    await expect(accepted.json()).resolves.toEqual({
      data: { project_id: project, base_id: null },
    })

    const sharing = await app.request(`${V1}/sharing/project/${project}`, { headers: lea })
    const body = (await sharing.json()) as {
      data: { people: Array<{ display_name: string; level: string; you: boolean }> }
    }
    expect(body.data.people.map((p) => [p.display_name, p.level, p.you])).toEqual([
      ['Léa Martin', 'manage', true],
      ['Tom Roux', 'edit', false],
    ])

    // Tom edits, he does not share.
    const refused = await app.request(`${V1}/sharing/project/${project}`, { headers: tom })
    expect(refused.status).toBe(403)
  })
})

describe('temporal types — no time-zone drift', () => {
  it('a `date` comes back as the calendar day, not as an instant', async () => {
    // The driver returns a PostgreSQL `date` as a JavaScript `Date` interpreted in the
    // process's local time zone: under `Europe/Paris`, March 1st becomes February 29th
    // at 11 p.m. A date is a calendar day, and no time zone applies to it.
    const base = await makeBase('Temporal')

    await app.request(
      `${V1}/admin/bases/${base}/tables`,
      json({
        label: 'Events',
        fields: [
          { label: 'Nom', kind: 'short_text', required: true },
          { label: 'Jour', kind: 'date' },
        ],
      }),
    )

    await app.request(
      `${V1}/data/${base}/events`,
      json({ values: { nom: 'Rentrée', jour: '2024-03-01' } }),
    )

    const read = await GET(`${V1}/data/${base}/events`)
    const body = (await read.json()) as { data: Array<Record<string, unknown>> }
    expect(body.data[0].jour).toBe('2024-03-01')
  })
})

describe('full CRUD cycle', () => {
  let base: string
  let recordId: string

  it('creates the table used by the cycle', async () => {
    base = await makeBase('Stock')
    const table = await app.request(
      `${V1}/admin/bases/${base}/tables`,
      json({
        label: 'Articles',
        fields: [
          { label: 'Référence', kind: 'short_text', required: true },
          { label: 'Quantité', kind: 'number' },
        ],
      }),
    )
    expect(table.status).toBe(201)
  })

  it('creates a record', async () => {
    const r = await app.request(
      `${V1}/data/${base}/articles`,
      json({ values: { reference: 'ART-1', quantite: 10 } }),
    )
    expect(r.status).toBe(201)
    const body = (await r.json()) as { data: { _id: string } }
    recordId = body.data._id
  })

  it('updates only the supplied field', async () => {
    const r = await app.request(`${V1}/data/${base}/articles/${recordId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth() },
      body: JSON.stringify({ values: { quantite: 42 } }),
    })
    expect(r.status).toBe(200)
    const body = (await r.json()) as { data: Record<string, unknown> }
    expect(Number(body.data.quantite)).toBe(42)
    // The untouched field keeps its value: an update is never a full replacement.
    expect(body.data.reference).toBe('ART-1')
  })

  it('deletes the record and answers 204', async () => {
    const r = await DEL(`${V1}/data/${base}/articles/${recordId}`)
    expect(r.status).toBe(204)

    const read = await GET(`${V1}/data/${base}/articles`)
    const body = (await read.json()) as { data: unknown[] }
    expect(body.data).toHaveLength(0)
  })

  it('deleting twice returns 404', async () => {
    const r = await DEL(`${V1}/data/${base}/articles/${recordId}`)
    expect(r.status).toBe(404)
  })
})

describe('links and inverse links over HTTP', () => {
  let base: string
  let clientId: string

  it('creates two tables and a real foreign key between them', async () => {
    base = await makeBase('Relations')
    await app.request(
      `${V1}/admin/bases/${base}/tables`,
      json({
        label: 'Clients',
        fields: [{ label: 'Raison sociale', kind: 'short_text', required: true }],
      }),
    )
    await app.request(
      `${V1}/admin/bases/${base}/tables`,
      json({
        label: 'Commandes',
        fields: [{ label: 'Référence', kind: 'short_text', required: true }],
      }),
    )

    // The target is designated by NAME here too.
    const link = await app.request(
      `${V1}/admin/bases/${base}/tables/commandes/links`,
      json({ label: 'Client', target: 'clients' }),
    )
    expect(link.status).toBe(201)
    const body = (await link.json()) as { data: { name: string; target: string } }
    expect(body.data.name).toBe('clients_id')
    expect(body.data.target).toBe('clients')
  })

  it('shows the link in the projected description', async () => {
    const r = await GET(`${V1}/meta/bases/${base}`)
    const body = (await r.json()) as {
      data: {
        tables: Array<{
          name: string
          referenced_by: boolean
          fields: Array<{ name: string; link?: { target: string; expandable: boolean } }>
        }>
      }
    }
    const orders = body.data.tables.find((t) => t.name === 'commandes')
    const link = orders?.fields.find((f) => f.link !== undefined)
    expect(link?.link?.target).toBe('clients')
    expect(link?.link?.expandable).toBe(true)
    // `clients` is referenced, `commandes` is not.
    expect(body.data.tables.find((t) => t.name === 'clients')?.referenced_by).toBe(true)
    expect(orders?.referenced_by).toBe(false)
  })

  it('returns the referencing rows on referenced_by', async () => {
    await app.request(`${V1}/admin/bases/${base}/tables/clients/display`, json({ field: null }))
    const client = await app.request(
      `${V1}/data/${base}/clients`,
      json({ values: { raison_sociale: 'Dupont SARL' } }),
    )
    clientId = ((await client.json()) as { data: { _id: string } }).data._id

    await app.request(
      `${V1}/data/${base}/commandes`,
      json({ values: { reference: 'C-001', clients_id: clientId } }),
    )

    const r = await GET(`${V1}/data/${base}/clients/${clientId}/referenced_by`)
    expect(r.status).toBe(200)
    const body = (await r.json()) as { data: Array<{ label: string; count: number }> }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].label).toBe('Commandes · Client')
    expect(body.data[0].count).toBe(1)
  })

  it('expands the link into `included`, not into the row', async () => {
    const r = await GET(`${V1}/data/${base}/commandes?expand=clients_id`)
    expect(r.status).toBe(200)
    const body = (await r.json()) as {
      data: Array<Record<string, unknown>>
      included: Record<string, Record<string, Record<string, unknown>>>
    }
    expect(body.data[0].clients_id).toMatchObject({ id: clientId })
    expect(body.included.clients?.[clientId]).toMatchObject({ raison_sociale: 'Dupont SARL' })
  })
})

describe('/auth — chapter 13, over HTTP', () => {
  it('plants a cookie a foreign page cannot reach', async () => {
    const r = await app.request('/auth/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
    })
    expect(r.status).toBe(200)

    const planted = r.headers.get('set-cookie') ?? ''
    // `__Host-` is enforced BY THE BROWSER: it refuses the cookie unless it is Secure,
    // path `/`, and carries no Domain — so a sibling host cannot write it.
    expect(planted).toContain('__Host-basedb_session=')
    expect(planted).toContain('HttpOnly')
    expect(planted).toContain('Secure')
    expect(planted).toContain('SameSite=Strict')
    expect(planted).toContain('Path=/')
    expect(planted).not.toContain('Domain=')

    // The session token itself never appears in the body.
    const body = (await r.json()) as { data: { csrf: string; tenant: string } }
    expect(JSON.stringify(body)).not.toContain('bds_')
    expect(body.data.tenant).toBe(TENANT_REF)
  }, 30_000)

  it('plants the CSRF token in a READABLE cookie, so a reload can still mint a token', async () => {
    const r = await app.request('/auth/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
    })
    const planted = r.headers.get('set-cookie') ?? ''

    // Two cookies, and only one of them is HttpOnly. The CSRF token must be readable by
    // the page — a foreign origin cannot read it, which is the whole protection, and
    // memory alone would not survive a reload.
    expect(planted).toContain('__Host-basedb_csrf=')
    const csrfPart = planted.split('__Host-basedb_csrf=')[1] ?? ''
    const csrfAttributes = csrfPart.split(',')[0] ?? ''
    expect(csrfAttributes).not.toContain('HttpOnly')
    expect(csrfAttributes).toContain('SameSite=Strict')
    expect(csrfAttributes).toContain('Secure')

    // And with the two of them a returning visitor mints a token without logging in.
    const cookies = (r.headers.get('set-cookie') ?? '')
      .split(/,(?=\s*__Host-)/)
      .map((c) => c.split(';')[0].trim())
      .join('; ')
    const value = /__Host-basedb_csrf=([^;\s]+)/.exec(cookies)?.[1] ?? ''
    const issued = await app.request('/auth/session/access', {
      method: 'POST',
      headers: { cookie: cookies, 'x-basedb-csrf': decodeURIComponent(value) },
    })
    expect(issued.status).toBe(200)
  }, 30_000)

  it('answers 401 for a wrong password and for an unknown address alike', async () => {
    const codes: string[] = []
    for (const credentials of [
      { email: 'bootstrap@basedb.local', password: 'mauvais mot de passe' },
      { email: 'personne@basedb.local', password: PASSWORD },
      { email: 'bootstrap@basedb.local' },
    ]) {
      const r = await app.request('/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      expect(r.status).toBe(401)
      codes.push(((await r.json()) as { code: string }).code)
    }
    // One code for three situations: nothing here says which account exists.
    expect(new Set(codes)).toEqual(new Set(['CREDENTIALS_INVALID']))
  }, 60_000)

  it('refuses to mint an access token from the cookie alone', async () => {
    // The cookie travels on its own; the header does not. That asymmetry is the whole
    // CSRF defence, and it is demanded on this route only.
    const r = await app.request('/auth/session/access', { method: 'POST', headers: { cookie } })
    expect(r.status).toBe(401)
  })

  it('says who the caller is, with either credential', async () => {
    const byCookie = await app.request('/auth/me', { headers: { cookie } })
    const byToken = await GET('/auth/me')
    expect(byCookie.status).toBe(200)
    expect(byToken.status).toBe(200)

    const me = (await byToken.json()) as { data: { email: string; tenant: string } }
    expect(me.data.email).toBe('bootstrap@basedb.local')
    expect(me.data.tenant).toBe(TENANT_REF)
    expect(JSON.stringify(me)).not.toContain('bds_')
  })

  it('lists the live sessions and marks the current one', async () => {
    const r = await app.request('/auth/sessions', { headers: { cookie } })
    expect(r.status).toBe(200)
    const body = (await r.json()) as { data: Array<{ id: string; current: boolean }> }
    expect(body.data.filter((s) => s.current)).toHaveLength(1)
    // The token never appears in a list its owner is shown.
    expect(JSON.stringify(body)).not.toContain('bds_')
  })

  it('closes the session, and the access tokens with it', async () => {
    // An isolated session, so the suite's own credential survives.
    const login = await app.request('/auth/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
    })
    const isolated = login.headers.get('set-cookie')?.split(';')[0] ?? ''
    const isolatedCsrf = ((await login.json()) as { data: { csrf: string } }).data.csrf

    const issued = await app.request('/auth/session/access', {
      method: 'POST',
      headers: { cookie: isolated, 'x-basedb-csrf': isolatedCsrf },
    })
    const token = ((await issued.json()) as { data: { token: string } }).data.token
    expect(
      (
        await app.request(`${V1}/meta/bases`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(200)

    const out = await app.request('/auth/session', {
      method: 'DELETE',
      headers: { cookie: isolated },
    })
    expect(out.status).toBe(204)
    expect(out.headers.get('set-cookie')).toContain('__Host-basedb_session=;')

    // Nothing was walked to do this: the token is derived from the session, so revoking
    // the session invalidates every token ever minted from it.
    expect(
      (
        await app.request(`${V1}/meta/bases`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(401)
  }, 60_000)

  it('refuses to READ or revoke without the cookie', async () => {
    for (const [path, method] of [
      ['/auth/sessions', 'GET'],
      ['/auth/sessions', 'DELETE'],
      ['/auth/password/change', 'POST'],
    ] as const) {
      const r = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined,
      })
      expect(r.status).toBe(401)
    }
  })

  it('lets a logout succeed even with no session at all', async () => {
    // The chapter lists `204` as the only answer for this route, and rightly: a client
    // whose session has expired must still be able to clear its own state. It discloses
    // nothing — there is nothing to disclose.
    const r = await app.request('/auth/session', { method: 'DELETE' })
    expect(r.status).toBe(204)
    expect(r.headers.get('set-cookie')).toContain('__Host-basedb_session=;')
  })
})

describe('/auth — elevation and reset, over HTTP', () => {
  /** Opens an isolated session, so the suite's own credential is never disturbed. */
  async function freshSession(): Promise<{ cookie: string; csrf: string }> {
    const r = await app.request('/auth/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
    })
    const raw = (r.headers.get('set-cookie') ?? '')
      .split(/,(?=\s*__Host-)/)
      .map((c) => c.split(';')[0].trim())
      .join('; ')
    const value = /__Host-basedb_csrf=([^;\s]+)/.exec(raw)?.[1] ?? ''
    return { cookie: raw, csrf: decodeURIComponent(value) }
  }

  it('raises a session for five minutes and hands back a new cookie', async () => {
    const session = await freshSession()
    const r = await app.request('/auth/elevate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session.cookie },
      body: JSON.stringify({ password: PASSWORD }),
    })
    expect(r.status).toBe(200)

    const body = (await r.json()) as { data: { elevated_until: string } }
    expect(Date.parse(body.data.elevated_until)).toBeGreaterThan(Date.now())
    // The token rotates with the elevation, so a new cookie must be planted.
    expect(r.headers.get('set-cookie')).toContain('__Host-basedb_session=')
  }, 60_000)

  it('refuses to raise a session on a wrong password', async () => {
    const session = await freshSession()
    const r = await app.request('/auth/elevate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session.cookie },
      body: JSON.stringify({ password: 'mauvais mot de passe' }),
    })
    expect(r.status).toBe(401)
    await expect(r.json()).resolves.toMatchObject({ code: 'CREDENTIALS_INVALID' })
  }, 60_000)

  it('answers 202 to a reset request, whatever the address', async () => {
    // The same answer for a real account, an unknown one and a malformed body: the point
    // of the `202` is that it says nothing at all.
    for (const body of [
      { email: 'bootstrap@basedb.local' },
      { email: 'fantome@basedb.local' },
      {},
    ]) {
      const r = await app.request('/auth/password/reset/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(r.status).toBe(202)
      expect(await r.text()).toBe('')
    }
  }, 60_000)

  it('refuses an unknown reset secret with one code', async () => {
    const r = await app.request('/auth/password/reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: 'inconnu', password: 'un mot de passe suffisamment long' }),
    })
    expect(r.status).toBe(400)
    await expect(r.json()).resolves.toMatchObject({ code: 'RESET_TOKEN_INVALID' })
  })
})

describe('§6 — the token bucket on /auth', () => {
  it('answers 429 with Retry-After past ten attempts from one address', async () => {
    // A FRESH app, hence a fresh bucket: the limiter lives in process memory, so the
    // suite's own logins would otherwise have spent the allowance.
    const isolated = createApp({ kernel })
    const attempt = () =>
      isolated.request('/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
        body: JSON.stringify({ email: 'bootstrap@basedb.local', password: 'mauvais' }),
      })

    let last = await attempt()
    for (let i = 0; i < 12 && last.status !== 429; i++) last = await attempt()

    expect(last.status).toBe(429)
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0)
    await expect(last.json()).resolves.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' })
  }, 180_000)

  it('counts each address separately', async () => {
    const isolated = createApp({ kernel })
    const from = (address: string) =>
      isolated.request('/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
        body: JSON.stringify({ email: 'bootstrap@basedb.local', password: 'mauvais' }),
      })

    let last = await from('198.51.100.8')
    for (let i = 0; i < 12 && last.status !== 429; i++) last = await from('198.51.100.8')
    expect(last.status).toBe(429)

    // A neighbour is untouched: one exhausted address must not close the door on
    // everyone behind the same proxy-less internet.
    expect((await from('198.51.100.9')).status).toBe(401)
  }, 180_000)
})

describe('/admin — adding a field to a live table', () => {
  let schema: string

  it('creates the table this section works on', async () => {
    schema = await makeBase('Schéma')
    const r = await app.request(
      `${V1}/admin/bases/${schema}/tables`,
      json({ label: 'Contacts', fields: [{ label: 'Nom', kind: 'short_text', required: true }] }),
    )
    expect(r.status).toBe(201)
    await app.request(`${V1}/data/${schema}/contacts`, json({ values: { nom: 'Camille' } }))
  }, 60_000)

  it('adds a column, nullable, and says so', async () => {
    const r = await app.request(
      `${V1}/admin/bases/${schema}/tables/contacts/fields`,
      json({ label: 'Ville', kind: 'short_text' }),
    )
    expect(r.status).toBe(201)

    const body = (await r.json()) as {
      data: { name: string; kind: string; required: boolean }
      meta: { sql: string[] }
    }
    expect(body.data.name).toBe('ville')
    // Nullable, whatever anyone asked: the table already holds a row.
    expect(body.data.required).toBe(false)
    expect(body.meta.sql[0]).toContain('ADD COLUMN "ville" text NULL')
    expect(body.meta.sql[1]).toContain('COMMENT ON COLUMN')
  }, 60_000)

  it('shows the new column in the description immediately', async () => {
    // The catalog counter moved with the column, so nothing served a stale shape.
    const r = await GET(`${V1}/meta/bases/${schema}`)
    const body = (await r.json()) as {
      data: { tables: Array<{ name: string; fields: Array<{ name: string }> }> }
    }
    const contacts = body.data.tables.find((t) => t.name === 'contacts')
    expect(contacts?.fields.map((f) => f.name)).toContain('ville')
  })

  it('accepts a value in the new column straight away', async () => {
    const r = await app.request(
      `${V1}/data/${schema}/contacts`,
      json({ values: { nom: 'Thomas', ville: 'Lyon' } }),
    )
    expect(r.status).toBe(201)
    await expect(r.json()).resolves.toMatchObject({ data: { ville: 'Lyon' } })
  }, 30_000)

  it('runs the four steps when the column is made required', async () => {
    // Fill it first: the obligation is a promise about existing rows, not only future
    // ones, and v1 has no default to fill them with.
    const page = await GET(`${V1}/data/${schema}/contacts`)
    const rows = (await page.json()) as { data: Array<{ _id: string; ville: string | null }> }
    for (const row of rows.data) {
      if (row.ville === null) {
        await app.request(`${V1}/data/${schema}/contacts/${row._id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...auth() },
          body: JSON.stringify({ values: { ville: 'Paris' } }),
        })
      }
    }

    const r = await app.request(
      `${V1}/admin/bases/${schema}/tables/contacts/fields/ville/required`,
      json({ required: true }),
    )
    expect(r.status).toBe(200)

    const body = (await r.json()) as { data: { required: boolean }; meta: { sql: string[] } }
    expect(body.data.required).toBe(true)
    expect(body.meta.sql).toHaveLength(4)
    expect(body.meta.sql[1]).toContain('VALIDATE CONSTRAINT')
    expect(body.meta.sql[2]).toContain('SET NOT NULL')

    // And the obligation is now real: an empty value is refused.
    const refused = await app.request(
      `${V1}/data/${schema}/contacts`,
      json({ values: { nom: 'Sans ville' } }),
    )
    expect(refused.status).toBe(422)
  }, 120_000)

  it('REFUSES the obligation when a row would break it, and leaves the column alone', async () => {
    await app.request(
      `${V1}/admin/bases/${schema}/tables/contacts/fields`,
      json({ label: 'Téléphone', kind: 'short_text' }),
    )
    const r = await app.request(
      `${V1}/admin/bases/${schema}/tables/contacts/fields/telephone/required`,
      json({ required: true }),
    )
    expect(r.status).toBeGreaterThanOrEqual(400)

    // Still writable without it: a half-applied obligation would be worse than none.
    const after = await app.request(
      `${V1}/data/${schema}/contacts`,
      json({ values: { nom: 'Léa', ville: 'Lille' } }),
    )
    expect(after.status).toBe(201)
  }, 120_000)

  it('makes a select a CHECK the database itself enforces', async () => {
    const created = await app.request(
      `${V1}/admin/bases/${schema}/tables/contacts/fields`,
      json({
        label: 'Statut',
        kind: 'select',
        options: [
          { value: 'actif', label: 'Actif' },
          { value: 'inactif', label: 'Inactif' },
        ],
      }),
    )
    expect(created.status).toBe(201)
    const body = (await created.json()) as { meta: { sql: string[] } }
    expect(body.meta.sql.join(' ')).toContain('CHECK ("statut" IN')

    const ok = await app.request(
      `${V1}/data/${schema}/contacts`,
      json({ values: { nom: 'Hugo', ville: 'Nantes', statut: 'actif' } }),
    )
    expect(ok.status).toBe(201)

    // Outside the list: refused, and by PostgreSQL rather than by a check written here.
    const refused = await app.request(
      `${V1}/data/${schema}/contacts`,
      json({ values: { nom: 'Emma', ville: 'Brest', statut: 'inventé' } }),
    )
    expect(refused.status).toBeGreaterThanOrEqual(400)
  }, 120_000)

  it('refuses a field on a table the caller cannot see, as if it did not exist', async () => {
    const r = await app.request(
      `${V1}/admin/bases/${schema}/tables/fantome/fields`,
      json({ label: 'X', kind: 'short_text' }),
    )
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('refuses a link here, and names the operation that does it', async () => {
    const r = await app.request(
      `${V1}/admin/bases/${schema}/tables/contacts/fields`,
      json({ label: 'Client', kind: 'link' }),
    )
    expect(r.status).toBe(400)
    await expect(r.json()).resolves.toMatchObject({ code: 'REQUEST_INVALID' })
  })
})

describe('/admin — descriptions over HTTP', () => {
  const patch = (path: string, body: unknown) =>
    app.request(`${V1}${path}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth() },
      body: JSON.stringify(body),
    })

  let schema = ''
  let table = ''

  it('takes a description on a base, a table and its fields, and answers with it', async () => {
    const base = await app.request(
      `${V1}/admin/bases`,
      json({ label: 'Descriptions', description: 'Ce que fait cette base.' }),
    )
    expect(base.status).toBe(201)
    const created = (await base.json()) as { data: { name: string; description: string } }
    expect(created.data.description).toBe('Ce que fait cette base.')
    schema = created.data.name

    const r = await app.request(
      `${V1}/admin/bases/${schema}/tables`,
      json({
        label: 'Factures',
        description: 'Une ligne par facture.',
        fields: [{ label: 'Numéro', kind: 'short_text', description: 'Numéro unique.' }],
      }),
    )
    expect(r.status).toBe(201)
    const body = (await r.json()) as {
      data: { name: string; description: string; fields: Array<{ description: string | null }> }
    }
    expect(body.data.description).toBe('Une ligne par facture.')
    expect(body.data.fields[0].description).toBe('Numéro unique.')
    table = body.data.name

    const field = await app.request(
      `${V1}/admin/bases/${schema}/tables/${table}/fields`,
      json({ label: 'Montant', kind: 'number', description: 'Hors taxes.' }),
    )
    expect(field.status).toBe(201)
    await expect(field.json()).resolves.toMatchObject({ data: { description: 'Hors taxes.' } })
  })

  it('serves it in /meta, in OpenAPI and in the readable documentation', async () => {
    const meta = (await (await GET(`${V1}/meta/bases/${schema}`)).json()) as {
      data: {
        description: string
        tables: Array<{ description: string; fields: Array<{ name: string; description: string }> }>
      }
    }
    expect(meta.data.description).toBe('Ce que fait cette base.')
    expect(meta.data.tables[0].description).toBe('Une ligne par facture.')
    expect(meta.data.tables[0].fields.find((f) => f.name === 'numero')?.description).toBe(
      'Numéro unique.',
    )

    const list = (await (await GET(`${V1}/meta/bases`)).json()) as {
      data: Array<{ name: string; description: string | null }>
    }
    expect(list.data.find((b) => b.name === schema)?.description).toBe('Ce que fait cette base.')

    const openapi = (await (await GET(`${V1}/meta/bases/${schema}/openapi.json`)).json()) as {
      components: { schemas: Record<string, { description: string }> }
    }
    expect(openapi.components.schemas.FacturesRead.description).toBe('Une ligne par facture.')

    const doc = (await (await GET(`${V1}/meta/bases/${schema}/doc`)).json()) as {
      data: { sections: Array<{ id: string; group: string; markdown: string }> }
    }
    const factures = doc.data.sections.find((s) => s.id === 'factures')
    expect(factures?.group).toBe('Tables')
    expect(factures?.markdown).toContain('Une ligne par facture.')
    expect(factures?.markdown).toContain('| Numéro unique. |')
  })

  it('edits the description of a base, without touching its label', async () => {
    const r = await patch(`/admin/bases/${schema}`, { description: 'Remplacée.' })
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toMatchObject({
      data: { label: 'Descriptions', description: 'Remplacée.' },
    })
    // Visible on the very next read: nothing waits for a cache to expire.
    const meta = (await (await GET(`${V1}/meta/bases/${schema}`)).json()) as {
      data: { description: string }
    }
    expect(meta.data.description).toBe('Remplacée.')
  })

  it('edits the description of a table and of a field', async () => {
    const t = await patch(`/admin/bases/${schema}/tables/${table}`, { description: 'Nouvelle.' })
    expect(t.status).toBe(200)
    await expect(t.json()).resolves.toMatchObject({
      data: { name: table, description: 'Nouvelle.' },
    })

    const f = await patch(`/admin/bases/${schema}/tables/${table}/fields/numero`, {
      description: 'Identifiant lisible.',
    })
    expect(f.status).toBe(200)
    await expect(f.json()).resolves.toMatchObject({
      data: { name: 'numero', description: 'Identifiant lisible.' },
    })

    const meta = (await (await GET(`${V1}/meta/bases/${schema}`)).json()) as {
      data: {
        tables: Array<{ description: string; fields: Array<{ name: string; description: string }> }>
      }
    }
    expect(meta.data.tables[0].description).toBe('Nouvelle.')
    expect(meta.data.tables[0].fields.find((x) => x.name === 'numero')?.description).toBe(
      'Identifiant lisible.',
    )
  })

  it('clears a description with null, or with an empty string', async () => {
    for (const empty of [null, '']) {
      await patch(`/admin/bases/${schema}/tables/${table}`, { description: 'À effacer.' })
      const r = await patch(`/admin/bases/${schema}/tables/${table}`, { description: empty })
      expect(r.status).toBe(200)
      await expect(r.json()).resolves.toMatchObject({ data: { description: null } })
    }
  })

  it('refuses a description that is too long, with the field and the bound', async () => {
    const r = await patch(`/admin/bases/${schema}/tables/${table}`, {
      description: 'x'.repeat(1001),
    })
    expect(r.status).toBe(422)
    await expect(r.json()).resolves.toMatchObject({
      code: 'TEXT_TOO_LONG',
      details: { field: 'description', maximum: 1000 },
    })
  })

  it('refuses a PATCH that says nothing, rather than answering as if it had worked', async () => {
    for (const path of [
      `/admin/bases/${schema}`,
      `/admin/bases/${schema}/tables/${table}`,
      `/admin/bases/${schema}/tables/${table}/fields/numero`,
    ]) {
      const r = await patch(path, {})
      expect(r.status).toBe(400)
      await expect(r.json()).resolves.toMatchObject({ code: 'REQUEST_INVALID' })
    }
  })

  it('refuses a description that is not text', async () => {
    const r = await patch(`/admin/bases/${schema}/tables/${table}`, { description: 42 })
    expect(r.status).toBe(400)
    await expect(r.json()).resolves.toMatchObject({
      code: 'REQUEST_INVALID',
      details: { field: 'description' },
    })
  })

  it('answers a table or a field it cannot see as if it did not exist', async () => {
    const t = await patch(`/admin/bases/${schema}/tables/fantome`, { description: 'x' })
    expect(t.status).toBe(404)
    const f = await patch(`/admin/bases/${schema}/tables/${table}/fields/fantome`, {
      description: 'x',
    })
    expect(f.status).toBe(404)
  })

  it('needs a token, like every other admin route', async () => {
    const r = await app.request(`${V1}/admin/bases/${schema}/tables/${table}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    })
    expect(r.status).toBe(401)
  })
})

describe('/admin — editing a field over HTTP', () => {
  const send = (method: 'PATCH' | 'PUT', path: string, body: unknown) =>
    app.request(`${V1}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...auth() },
      body: JSON.stringify(body),
    })

  const PIXEL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

  let schema = ''
  let table = ''
  let fieldPath = ''

  type Meta = {
    data: {
      tables: Array<{
        name: string
        fields: Array<{
          name: string
          label: string
          options?: Array<{
            value: string
            label: string
            color: string | null
            icon: string | null
            image: string | null
          }>
        }>
      }>
    }
  }
  const field = async (name: string) => {
    const meta = (await (await GET(`${V1}/meta/bases/${schema}`)).json()) as Meta
    return meta.data.tables.find((t) => t.name === table)?.fields.find((f) => f.name === name)
  }

  it('creates a list of choices that already carries its look', async () => {
    const base = await app.request(`${V1}/admin/bases`, json({ label: 'Édition de champ' }))
    schema = ((await base.json()) as { data: { name: string } }).data.name
    const t = await app.request(
      `${V1}/admin/bases/${schema}/tables`,
      json({ label: 'Tickets', fields: [{ label: 'Titre', kind: 'short_text' }] }),
    )
    table = ((await t.json()) as { data: { name: string } }).data.name

    const created = await app.request(
      `${V1}/admin/bases/${schema}/tables/${table}/fields`,
      json({
        label: 'Priorité',
        kind: 'select',
        options: [
          { value: 'haute', label: 'Haute', color: '#DC2626', icon: 'flame' },
          { value: 'basse', label: 'Basse', image: PIXEL },
        ],
      }),
    )
    expect(created.status).toBe(201)
    fieldPath = `/admin/bases/${schema}/tables/${table}/fields/priorite`

    expect((await field('priorite'))?.options).toEqual([
      { value: 'haute', label: 'Haute', color: '#dc2626', icon: 'flame', image: null },
      { value: 'basse', label: 'Basse', color: null, icon: null, image: PIXEL },
    ])
  })

  it('renames a field — its label only, never its column', async () => {
    const r = await send('PATCH', fieldPath, { label: 'Urgence' })
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toMatchObject({ data: { name: 'priorite', label: 'Urgence' } })

    // Still `priorite` for psql, `Urgence` for people.
    expect((await field('priorite'))?.label).toBe('Urgence')
  })

  it('takes a label and a description in one call, and answers with both', async () => {
    const r = await send('PATCH', fieldPath, {
      label: 'Priorité',
      description: 'Niveau d’urgence.',
    })
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toMatchObject({
      data: { name: 'priorite', label: 'Priorité', description: 'Niveau d’urgence.' },
    })
  })

  it('refuses a label already taken, an empty one and one that is not text', async () => {
    const taken = await send('PATCH', fieldPath, { label: 'titre' })
    expect(taken.status).toBe(422)
    await expect(taken.json()).resolves.toMatchObject({ code: 'LABEL_DUPLICATE' })

    const empty = await send('PATCH', fieldPath, { label: '   ' })
    await expect(empty.json()).resolves.toMatchObject({ code: 'LABEL_EMPTY' })

    const notText = await send('PATCH', fieldPath, { label: 42 })
    expect(notText.status).toBe(400)
    await expect(notText.json()).resolves.toMatchObject({
      code: 'REQUEST_INVALID',
      details: { field: 'label' },
    })
  })

  it('replaces the options: the look alone emits no SQL, a new value regenerates the CHECK', async () => {
    const look = await send('PUT', `${fieldPath}/options`, {
      options: [
        { value: 'basse', label: 'Basse', color: '#16a34a', icon: 'arrow-down' },
        { value: 'haute', label: 'Haute', color: '#dc2626', icon: 'flame' },
      ],
    })
    expect(look.status).toBe(200)
    await expect(look.json()).resolves.toMatchObject({
      data: { added: [], removed: [] },
      meta: { sql: [] },
    })
    // Reordered: `basse` now comes first.
    expect((await field('priorite'))?.options?.map((o) => o.value)).toEqual(['basse', 'haute'])

    const widened = await send('PUT', `${fieldPath}/options`, {
      options: [{ value: 'basse' }, { value: 'haute' }, { value: 'critique', color: '#000' }],
    })
    expect(widened.status).toBe(200)
    const body = (await widened.json()) as {
      data: { added: string[]; options: Array<{ value: string; color: string | null }> }
      meta: { sql: string[] }
    }
    expect(body.data.added).toEqual(['critique'])
    expect(body.data.options[2]).toMatchObject({ value: 'critique', color: '#000000' })
    expect(body.meta.sql).toHaveLength(2)

    // The new value is now writable through /data — the CHECK follows the list.
    const row = await app.request(
      `${V1}/data/${schema}/${table}`,
      json({ values: { priorite: 'critique' } }),
    )
    expect(row.status).toBe(201)
  })

  it('refuses to drop an option that rows still carry, with the count', async () => {
    const r = await send('PUT', `${fieldPath}/options`, {
      options: [{ value: 'basse' }, { value: 'haute' }],
    })
    expect(r.status).toBe(422)
    await expect(r.json()).resolves.toMatchObject({
      code: 'OPTION_IN_USE',
      details: { options: [{ value: 'critique', count: 1 }] },
    })
    expect((await field('priorite'))?.options?.map((o) => o.value)).toEqual([
      'basse',
      'haute',
      'critique',
    ])
  })

  it('refuses a list that is not one, and a look the catalog would not hold', async () => {
    const notList = await send('PUT', `${fieldPath}/options`, { options: 'haute' })
    expect(notList.status).toBe(400)

    const badColor = await send('PUT', `${fieldPath}/options`, {
      options: [{ value: 'basse', color: 'rouge' }],
    })
    expect(badColor.status).toBe(400)
    await expect(badColor.json()).resolves.toMatchObject({
      code: 'REQUEST_INVALID',
      details: { reason: 'couleur_invalide' },
    })

    const notASelect = await send(
      'PUT',
      `/admin/bases/${schema}/tables/${table}/fields/titre/options`,
      { options: [{ value: 'a' }] },
    )
    expect(notASelect.status).toBe(400)
  })

  it('needs a token, and lets a browser preflight a PUT', async () => {
    const anonymous = await app.request(`${V1}${fieldPath}/options`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ options: [{ value: 'a' }] }),
    })
    expect(anonymous.status).toBe(401)

    const preflight = await app.request(`${V1}${fieldPath}/options`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PUT',
      },
    })
    expect(preflight.headers.get('access-control-allow-methods')).toContain('PUT')
  })
})

describe('/data — a batch over HTTP', () => {
  let schema = ''
  let table = ''

  const batch = (body: unknown, headers: Record<string, string> = auth()) =>
    app.request(`${V1}/data/${schema}/${table}/batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  const created = (rows: Array<Record<string, unknown>>) => ({
    operations: rows.map((data) => ({ op: 'create', data })),
  })
  const total = async () => {
    const r = await GET(`${V1}/data/${schema}/${table}?count=exact&limit=1`)
    return ((await r.json()) as { meta: { count: number } }).meta.count
  }

  it('sets up a table', async () => {
    const base = await app.request(`${V1}/admin/bases`, json({ label: 'Lots' }))
    schema = ((await base.json()) as { data: { name: string } }).data.name
    const t = await app.request(
      `${V1}/admin/bases/${schema}/tables`,
      json({
        label: 'Contacts',
        fields: [
          { label: 'Nom', kind: 'short_text' },
          { label: 'Age', kind: 'number' },
        ],
      }),
    )
    table = ((await t.json()) as { data: { name: string } }).data.name
    expect(table).toBe('contacts')
  })

  it('creates every row and answers with the shape of chapter 08 §3.5', async () => {
    const r = await batch(created([{ nom: 'Camille', age: 31 }, { nom: 'Thomas' }, { nom: 'Léa' }]))
    expect(r.status).toBe(200)
    const body = (await r.json()) as {
      atomic: boolean
      results: Array<{ index: number; status: string; id: string }>
      summary: Record<string, number>
    }
    expect(body.atomic).toBe(true)
    expect(body.results.map((x) => [x.index, x.status])).toEqual([
      [0, 'created'],
      [1, 'created'],
      [2, 'created'],
    ])
    expect(body.results.every((x) => /^[0-9a-f-]{36}$/.test(x.id))).toBe(true)
    expect(body.summary).toEqual({ created: 3, updated: 0, deleted: 0, failed: 0 })
    expect(await total()).toBe(3)
  })

  it('is all or nothing, and names the row that failed', async () => {
    const r = await batch(
      created([{ nom: 'Bon' }, { nom: 'Mauvais', age: 'vingt' }, { nom: 'Bon 2' }]),
    )
    expect(r.status).toBe(422)
    await expect(r.json()).resolves.toMatchObject({
      code: 'VALUE_INVALID',
      details: { index: 1 },
    })
    // The good row that came BEFORE the bad one was not kept.
    expect(await total()).toBe(3)
  })

  it('refuses a field that does not exist, naming the row and the field', async () => {
    const r = await batch(created([{ nom: 'Ok' }, { fantome: 1 }]))
    expect(r.status).toBeGreaterThanOrEqual(400)
    await expect(r.json()).resolves.toMatchObject({
      code: 'FILTER_FIELD_UNKNOWN',
      details: { index: 1, field: 'fantome' },
    })
    expect(await total()).toBe(3)
  })

  it('refuses by name what it does not do yet, instead of answering as if it had', async () => {
    const update = await batch({ operations: [{ op: 'update', id: 'x', data: { nom: 'y' } }] })
    expect(update.status).toBe(400)
    await expect(update.json()).resolves.toMatchObject({
      code: 'REQUEST_INVALID',
      details: { index: 0, reason: 'seul_create_est_pris_en_charge' },
    })

    const partial = await batch({ atomic: false, ...created([{ nom: 'x' }]) })
    expect(partial.status).toBe(400)
    await expect(partial.json()).resolves.toMatchObject({
      code: 'REQUEST_INVALID',
      details: { field: 'atomic' },
    })

    for (const bad of [
      {},
      { operations: 'oui' },
      { operations: [] },
      { operations: [{ op: 'create' }] },
    ]) {
      expect((await batch(bad)).status).toBe(400)
    }
    expect(await total()).toBe(3)
  })

  it('refuses more than a thousand operations with 413', async () => {
    const r = await batch(created(Array.from({ length: 1001 }, (_, i) => ({ nom: `n${i}` }))))
    expect(r.status).toBe(413)
    await expect(r.json()).resolves.toMatchObject({ code: 'BATCH_TOO_LARGE' })
    expect(await total()).toBe(3)
  })

  it('needs a token, and is described in OpenAPI', async () => {
    expect((await batch(created([{ nom: 'x' }]), {})).status).toBe(401)

    const openapi = (await (await GET(`${V1}/meta/bases/${schema}/openapi.json`)).json()) as {
      paths: Record<string, { post?: { summary: string } }>
    }
    expect(openapi.paths[`/data/${schema}/${table}/batch`]?.post?.summary).toContain('plusieurs')
  })
})

// Last in the file on purpose: elevating ROTATES the session token, which invalidates
// every access token minted from it, the suite's shared one included.
describe('integration tokens — chapter 08 §11', () => {
  // The session elevated by the second test, reused by the third: `/auth` is rate limited,
  // and a fresh sign-in this late in the file would meet the bucket, not the feature.
  const elevatedSession = { cookie: '', csrf: '' }

  it('refuses to mint a token without a recent elevation', async () => {
    const base = await makeBase('Jetons sans élévation')
    const r = await app.request(
      `${V1}/admin/tokens`,
      json({ label: 'Agent', base, access: 'read' }),
    )
    expect(r.status).toBe(403)
    expect(((await r.json()) as { code: string }).code).toBe('ELEVATION_REQUIRED')
  })

  it('mints once, for both doors by default, lists without the secret, and revokes', async () => {
    const base = await makeBase('Jetons élevés')
    const elevated = await app.request('/auth/elevate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ password: PASSWORD }),
    })
    expect(elevated.status).toBe(200)
    const planted = elevated.headers.getSetCookie()
    const session = planted.find((c) => c.includes('basedb_session'))?.split(';')[0] ?? ''
    const csrfValue =
      planted
        .find((c) => c.includes('basedb_csrf'))
        ?.split(';')[0]
        ?.split('=')[1] ?? ''
    const issued = await app.request('/auth/session/access', {
      method: 'POST',
      headers: { cookie: session, 'x-basedb-csrf': csrfValue },
    })
    const fresh = ((await issued.json()) as { data: { token: string } }).data.token
    elevatedSession.cookie = session
    elevatedSession.csrf = csrfValue
    const as = (init: RequestInit = {}) => ({
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${fresh}` },
    })

    const r = await app.request(
      `${V1}/admin/tokens`,
      as({ method: 'POST', body: JSON.stringify({ label: 'Agent CRM', base, access: 'write' }) }),
    )
    expect(r.status).toBe(201)
    const token = ((await r.json()) as { data: Record<string, unknown> }).data
    expect(token.secret).toMatch(/^bdb_[a-z0-9]{8}_[0-9A-Za-z]{43}$/)
    expect(token).toMatchObject({
      label: 'Agent CRM',
      access: 'write',
      surfaces: ['rest', 'mcp'],
    })

    const listed = await app.request(`${V1}/admin/tokens?base=${base}`, as())
    const rows = ((await listed.json()) as { data: Array<Record<string, unknown>> }).data
    expect(rows).toHaveLength(1)
    expect(rows[0].prefix).toBe(String(token.secret).slice(4, 12))
    expect(JSON.stringify(rows)).not.toContain(String(token.secret))

    const unknown = await app.request(
      `${V1}/admin/tokens`,
      as({
        method: 'POST',
        body: JSON.stringify({ label: 'Autre', base, access: 'read', surfaces: ['webhook'] }),
      }),
    )
    expect(unknown.status).toBe(400)

    const revoked = await app.request(`${V1}/admin/tokens/${token.id}`, as({ method: 'DELETE' }))
    expect(revoked.status).toBe(204)
    const after = await app.request(`${V1}/admin/tokens?base=${base}`, as())
    const [row] = ((await after.json()) as { data: Array<Record<string, unknown>> }).data
    expect(row.revoked_at).not.toBeNull()
  })
  it('opens the data routes of its base to a program — and nothing else', async () => {
    const issued = await app.request('/auth/session/access', {
      method: 'POST',
      headers: { cookie: elevatedSession.cookie, 'x-basedb-csrf': elevatedSession.csrf },
    })
    const person = ((await issued.json()) as { data: { token: string } }).data.token
    const bearing = (credential: string) => (method: string, path: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    const asPerson = bearing(person)

    const baseOf = async (label: string) => {
      const r = await asPerson('POST', `${V1}/admin/bases`, { label })
      const name = ((await r.json()) as { data: { name: string } }).data.name
      await asPerson('POST', `${V1}/admin/bases/${name}/tables`, {
        label: 'Contacts',
        fields: [{ label: 'Nom', kind: 'short_text' }],
      })
      return name
    }
    const base = await baseOf('Jetons REST')
    const other = await baseOf('Jetons REST autre')

    const mint = async (body: Record<string, unknown>) => {
      const r = await asPerson('POST', `${V1}/admin/tokens`, { base, ...body })
      expect(r.status).toBe(201)
      return ((await r.json()) as { data: { secret: string } }).data.secret
    }
    const writer = bearing(await mint({ label: 'Synchro', access: 'write' }))
    const agentOnly = bearing(await mint({ label: 'Agent', access: 'read', surfaces: ['mcp'] }))

    // Its base, and only its base, exists for it.
    const listed = await writer('GET', `${V1}/meta/bases`)
    expect(listed.status).toBe(200)
    const names = ((await listed.json()) as { data: Array<{ name: string }> }).data.map(
      (b) => b.name,
    )
    expect(names).toEqual([base])

    // Read, create, modify.
    const created = await writer('POST', `${V1}/data/${base}/contacts`, { values: { nom: 'ACME' } })
    expect(created.status).toBe(201)
    const row = ((await created.json()) as { data: { _id: string } }).data
    const read = await writer('GET', `${V1}/data/${base}/contacts`)
    expect(((await read.json()) as { data: unknown[] }).data).toHaveLength(1)
    const updated = await writer('PATCH', `${V1}/data/${base}/contacts/${row._id}`, {
      values: { nom: 'ACME SA' },
    })
    expect(updated.status).toBe(200)

    // Never delete; another base does not exist.
    const deleted = await writer('DELETE', `${V1}/data/${base}/contacts/${row._id}`)
    expect(deleted.status).toBe(403)
    expect((await writer('GET', `${V1}/data/${other}/contacts`)).status).toBe(404)

    // The routes of a person stay a person's: administration, SQL console.
    expect((await writer('GET', `${V1}/admin/tokens?base=${base}`)).status).toBe(401)
    expect((await writer('POST', `${V1}/sql/${base}`, { sql: 'SELECT 1' })).status).toBe(401)
    expect((await writer('GET', `${V1}/meta/projects`)).status).toBe(401)

    // A token minted for MCP alone is refused here, and says why.
    const refused = await agentOnly('GET', `${V1}/data/${base}/contacts`)
    expect(refused.status).toBe(401)
    expect(((await refused.json()) as { code: string }).code).toBe('TOKEN_INVALID')
  })
})
