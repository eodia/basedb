import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Shared forms over HTTP — chapter 15.
 *
 * What the share dialog and the page of a link do with the API: share a form view, open
 * it and answer it with no bearer at all, reserve it to signed-in members, retire a link,
 * close it, stop sharing it — and the bound on answers from one address.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let shareRoute = ''

const auth = () => ({ authorization: `Bearer ${access}` })
const json = (method: string, body: unknown, headers: Record<string, string> = auth()) => ({
  method,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})
const read = async <T>(response: Response) => (await response.json()) as T

interface Sharing {
  share: {
    token: string
    access: string
    active: boolean
    state: string
    response_count: number
    published_by: { id: string; name: string | null }
  } | null
  groups: Array<{ id: string; label: string }>
  omitted: Array<{ field: string; reason: string }>
}

const PUBLIC = { access: 'public', active: true, closes_at: null, max_responses: null, groups: [] }

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

  const created = await app.request(`${V1}/admin/bases`, json('POST', { label: 'Salons' }))
  const base = (await read<{ data: { name: string } }>(created)).data.name
  const table = await app.request(
    `${V1}/admin/bases/${base}/tables`,
    json('POST', {
      label: 'Visiteurs',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Société', kind: 'short_text' },
      ],
    }),
  )
  expect(table.status).toBe(201)
  const view = await app.request(
    `${V1}/admin/bases/${base}/tables/visiteurs/views`,
    json('POST', {
      label: 'Badge',
      kind: 'form',
      spec: {
        title: 'Demander un badge',
        fields: [{ field: 'nom', required: true }, { field: 'societe' }],
      },
    }),
  )
  expect(view.status).toBe(201)
  const viewId = (await read<{ data: { id: string } }>(view)).data.id
  shareRoute = `${V1}/admin/bases/${base}/tables/visiteurs/views/${viewId}/share`
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

const share = async (settings: Record<string, unknown>) => {
  const response = await app.request(shareRoute, json('PUT', settings))
  expect(response.status).toBe(200)
  return (await read<{ data: Sharing }>(response)).data
}
const open = (token: string, headers: Record<string, string> = {}) =>
  app.request(`/api/v1/forms/${token}`, { headers })
const answer = (token: string, values: unknown, headers: Record<string, string> = {}) =>
  app.request(`/api/v1/forms/${token}`, json('POST', { values }, headers))

describe('a public form', () => {
  it('is shared from the dialog, and answered with no bearer at all', async () => {
    const before = await app.request(shareRoute, { headers: auth() })
    expect((await read<{ data: Sharing }>(before)).data).toMatchObject({ share: null, omitted: [] })

    const sharing = await share(PUBLIC)
    const token = sharing.share?.token as string
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(sharing.share).toMatchObject({
      access: 'public',
      state: 'open',
      published_by: { name: 'Bootstrap' },
    })

    const page = await open(token)
    expect(page.status).toBe(200)
    const form = (
      await read<{
        data: { title: string; respondent: string | null; questions: Array<{ name: string }> }
      }>(page)
    ).data
    expect(form).toMatchObject({ title: 'Demander un badge', respondent: null, access: 'public' })
    expect(form.questions.map((q) => q.name)).toEqual(['nom', 'societe'])

    const sent = await answer(token, { nom: 'Ada', societe: 'Analytique' })
    expect(sent.status).toBe(201)
    expect(await read(sent)).toEqual({ data: { received: true } })

    const unknown = await answer(token, { nom: 'Ada', _created_by: 'x' })
    expect(unknown.status).toBe(400)
    expect(await read(unknown)).toMatchObject({
      code: 'REQUEST_INVALID',
      details: { reason: 'question_inconnue' },
    })
    const lacking = await answer(token, { societe: 'Sans nom' })
    expect(lacking.status).toBe(422)
    expect(await read(lacking)).toMatchObject({ code: 'REQUIRED_VALUE_MISSING' })

    const after = await app.request(shareRoute, { headers: auth() })
    expect((await read<{ data: Sharing }>(after)).data.share?.response_count).toBe(1)
  })

  it('bounds the answers from one address to one link', async () => {
    const token = (await share(PUBLIC)).share?.token as string
    const from = { 'x-forwarded-for': '203.0.113.9' }
    for (let i = 0; i < 20; i++) {
      expect((await answer(token, { societe: 'rafale' }, from)).status).toBe(422)
    }
    const refused = await answer(token, { nom: 'Vingt et unième' }, from)
    expect(refused.status).toBe(429)
    expect(refused.headers.get('retry-after')).not.toBeNull()
    // Another address is not held back by this one.
    const other = await answer(token, { nom: 'Voisin' }, { 'x-forwarded-for': '203.0.113.10' })
    expect(other.status).toBe(201)
  })
})

describe('a form for members', () => {
  it('asks for a sign-in, and a valid bearer answers as the person', async () => {
    const token = (await share({ ...PUBLIC, access: 'members' })).share?.token as string

    const anonymous = await open(token)
    expect(anonymous.status).toBe(401)
    expect(await read(anonymous)).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' })
    // A stale bearer is no bearer: the page asks for a sign-in, it does not break.
    const stale = await open(token, { authorization: 'Bearer ceci-nest-pas-un-jeton' })
    expect(stale.status).toBe(401)

    const signed = await open(token, auth())
    expect(signed.status).toBe(200)
    expect((await read<{ data: { respondent: string } }>(signed)).data.respondent).toBe('Bootstrap')
    expect((await answer(token, { nom: 'Moi' }, auth())).status).toBe(201)
  })
})

describe('the link of a form', () => {
  it('is retired by a new one, closes, and goes with the sharing', async () => {
    const old = (await share(PUBLIC)).share?.token as string
    const regenerated = await app.request(`${shareRoute}/regenerate`, {
      method: 'POST',
      headers: auth(),
    })
    expect(regenerated.status).toBe(200)
    const token = (await read<{ data: Sharing }>(regenerated)).data.share?.token as string
    expect(token).not.toBe(old)
    expect((await open(old)).status).toBe(404)
    expect((await open(token)).status).toBe(200)

    await share({ ...PUBLIC, active: false })
    const closed = await open(token)
    expect(closed.status).toBe(409)
    expect(await read(closed)).toMatchObject({
      code: 'FORM_CLOSED',
      details: { reason: 'inactive' },
    })

    const stopped = await app.request(shareRoute, { method: 'DELETE', headers: auth() })
    expect(stopped.status).toBe(204)
    expect((await open(token)).status).toBe(404)
    const after = await app.request(shareRoute, { headers: auth() })
    expect((await read<{ data: Sharing }>(after)).data.share).toBeNull()
  })
})
