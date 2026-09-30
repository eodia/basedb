import { type IncomingHttpHeaders, type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * A webhook step composed — chapter 17 §1.3.
 *
 * What these guard: a step sends the method, the address, the headers and the body it was
 * given, each citing what came before without ever reading it as its own words; a secret
 * header is sealed, never shown again nor stored in the clear, kept by a save that leaves
 * it out, and asked for again when the address changes host; what the service answers is
 * cited by the steps after it; a definition that could not be sent is refused when saved.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'
const SECRET = 'Bearer jeton-tres-secret-42'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let client: import('pg').Client
let stub: Server
let origin = ''
let access = ''
let base = ''

interface Received {
  readonly method: string
  readonly url: string
  readonly headers: IncomingHttpHeaders
  readonly body: string
}
const received: Received[] = []

const auth = () => ({ authorization: `Bearer ${access}` })
const call = (path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...auth() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
async function data<T>(r: Response): Promise<T> {
  return ((await r.json()) as { data: T }).data
}

beforeAll(async () => {
  // The service called: it keeps what it received, and answers with an identifier.
  stub = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      received.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body,
      })
      res.writeHead(201, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: `ext-${received.length}` }))
    })
  })
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', () => resolve()))
  origin = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    // The service lives on this machine: the development policy lets the server call it.
    webhookTargets: { allowHttp: true, allowPrivate: true },
  })
  await kernel.migrateCatalog()

  const { Client } = await import('pg')
  client = new Client({ connectionString: container.getConnectionUri() })
  await client.connect()
  await client.query('BEGIN')
  const { rows } = await client.query(
    `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
     VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
     RETURNING id, created_by`,
    [TENANT_REF],
  )
  const adminId = rows[0].created_by
  await client.query(
    `INSERT INTO _basedb.app_user
       (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
     VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
    [adminId, rows[0].id],
  )
  await client.query('COMMIT')

  app = createApp({ kernel })
  await kernel.setPassword({ userId: adminId, password: PASSWORD })
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = ((await login.json()) as { data: { csrf: string } }).data.csrf
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  access = ((await issued.json()) as { data: { token: string } }).data.token

  base = (
    await data<{ name: string }>(await call(`${V1}/admin/bases`, 'POST', { label: 'Ventes' }))
  ).name
  const table = await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Commandes',
    fields: [
      { label: 'Client', kind: 'short_text' },
      { label: 'Montant', kind: 'number' },
      { label: 'Référence', kind: 'short_text' },
    ],
  })
  expect(table.status).toBe(201)
}, 240_000)

afterAll(async () => {
  await client?.end()
  await kernel?.close()
  await container?.stop()
  await new Promise<void>((resolve) => (stub ? stub.close(() => resolve()) : resolve()))
})

const AUTOMATIONS = () => `${V1}/admin/bases/${base}/automations`
const ORDERS = () => `${V1}/data/${base}/commandes`

async function settle() {
  await kernel.drainHistory()
  while ((await kernel.runAutomations()) > 0) {
    await kernel.drainHistory()
  }
}

interface Run {
  status: string
  error_code: string | null
  steps: Array<{ step: string; status: string; detail?: string; error_code?: string }>
}
const runsOf = async (id: string) => data<Run[]>(await call(`${AUTOMATIONS()}/${id}/runs`))

describe('a webhook composed', () => {
  let automation = ''
  let order = ''

  it('is saved with its secret sealed, and shows its name alone', async () => {
    const created = await call(AUTOMATIONS(), 'POST', {
      label: 'Vers l’ERP',
      trigger: { kind: 'record_created', table: 'commandes' },
      actions: [
        {
          kind: 'webhook',
          method: 'PUT',
          url: `${origin}/clients/{{client}}/commandes?ref={{_id}}`,
          headers: [
            { name: 'Authorization', value: SECRET, secret: true },
            { name: 'X-Trace', value: 'commande {{reference}}' },
          ],
          body: '{"client": "{{client}}", "montant": {{montant}}, "note": "dit \\"{{reference}}\\""}',
          format: 'json',
        },
        { kind: 'update_record', values: { reference: 'ERP {{e1.reponse.id}} ({{e1.statut}})' } },
      ],
    })
    expect(created.status).toBe(201)
    const saved = await data<{ id: string; actions: Array<Record<string, unknown>> }>(created)
    automation = saved.id
    expect(saved.actions[0]).toMatchObject({
      method: 'PUT',
      format: 'json',
      headers: [
        { name: 'Authorization', value: null, secret: true, host: new URL(origin).host },
        { name: 'X-Trace', value: 'commande {{reference}}', secret: false },
      ],
    })
    // Neither the API nor the catalog holds the secret in the clear.
    expect(JSON.stringify(saved)).not.toContain('jeton-tres-secret')
    const { rows } = await client.query('SELECT actions::text AS a FROM _basedb.automation')
    expect(rows.map((r: { a: string }) => r.a).join()).not.toContain('jeton-tres-secret')
  })

  it('sends the method, the address, the headers and the body it was given', async () => {
    const row = await data<{ _id: string }>(
      await call(ORDERS(), 'POST', {
        values: { client: 'Dupont & fils', montant: 1250.5, reference: 'A"7' },
      }),
    )
    order = row._id
    await settle()

    const [sent] = received
    expect(sent?.method).toBe('PUT')
    expect(sent?.url).toBe(`/clients/Dupont%20%26%20fils/commandes?ref=${order}`)
    expect(sent?.headers.authorization).toBe(SECRET)
    expect(sent?.headers['x-trace']).toBe('commande A"7')
    expect(sent?.headers['content-type']).toBe('application/json')
    expect(JSON.parse(sent?.body ?? '')).toEqual({
      client: 'Dupont & fils',
      montant: 1250.5,
      note: 'dit "A"7"',
    })

    // What the service answered is cited by the step after it.
    const written = await data<Record<string, unknown>>(await call(`${ORDERS()}/${order}`))
    expect(written.reference).toBe('ERP ext-1 (201)')
    const [run] = await runsOf(automation)
    expect(run).toMatchObject({ status: 'succeeded' })
  })

  it('keeps its secret through a save that leaves it out', async () => {
    const renamed = await call(`${AUTOMATIONS()}/${automation}`, 'PATCH', { label: 'Vers l’ERP 2' })
    expect(renamed.status).toBe(200)
    const list = await data<Array<{ id: string; actions: unknown[] }>>(await call(AUTOMATIONS()))
    // Sent back as read — the secret without its value — it is kept.
    const again = await call(`${AUTOMATIONS()}/${automation}`, 'PATCH', {
      actions: list.find((a) => a.id === automation)?.actions,
    })
    expect(again.status).toBe(200)

    await call(`${ORDERS()}`, 'POST', { values: { client: 'Martin', montant: 3, reference: 'B' } })
    await settle()
    expect(received.at(-1)?.headers.authorization).toBe(SECRET)
  })

  it('asks for its secret again when the address changes host', async () => {
    const list = await data<Array<{ id: string; actions: Array<Record<string, unknown>> }>>(
      await call(AUTOMATIONS()),
    )
    const actions = list.find((a) => a.id === automation)?.actions ?? []
    const elsewhere = actions.map((s, i) =>
      i === 0 ? { ...s, url: `http://localhost:${new URL(origin).port}/ailleurs` } : s,
    )
    const refused = await call(`${AUTOMATIONS()}/${automation}`, 'PATCH', { actions: elsewhere })
    expect(refused.status).toBe(400)
    expect(await refused.json()).toMatchObject({
      details: { reason: 'secret_a_redonner', detail: 'Authorization', step: 'e1' },
    })
  })

  it('sends a form, and a GET with no body', async () => {
    const created = await call(AUTOMATIONS(), 'POST', {
      label: 'SMS',
      trigger: { kind: 'button', table: 'commandes' },
      actions: [
        {
          kind: 'webhook',
          url: `${origin}/sms`,
          body: 'To={{client}}\nBody=Commande {{reference}} partie',
          format: 'form',
        },
        { kind: 'webhook', method: 'GET', url: `${origin}/suivi/{{e1.reponse.id}}` },
      ],
    })
    expect(created.status).toBe(201)
    const { id } = await data<{ id: string }>(created)
    const before = received.length
    await call(`${V1}/automations/${id}/run`, 'POST', { record: order })
    await settle()
    const [form, get] = received.slice(before)
    expect(form?.method).toBe('POST')
    expect(form?.headers['content-type']).toBe('application/x-www-form-urlencoded')
    expect(Object.fromEntries(new URLSearchParams(form?.body))).toEqual({
      To: 'Dupont & fils',
      Body: 'Commande ERP ext-1 (201) partie',
    })
    expect(get).toMatchObject({ method: 'GET', body: '' })
    expect(get?.url).toBe(`/suivi/ext-${before + 1}`)
    expect(get?.headers['content-type']).toBeUndefined()
  })

  it('is refused when it could not be sent as written', async () => {
    const refusal = async (step: Record<string, unknown>) =>
      (
        await call(AUTOMATIONS(), 'POST', {
          label: 'Refusée',
          trigger: { kind: 'record_created', table: 'commandes' },
          actions: [{ kind: 'webhook', url: `${origin}/x`, ...step }],
        })
      ).json()
    expect(await refusal({ url: 'http://{{client}}.exemple.fr/x' })).toMatchObject({
      details: { reason: 'hote_cite' },
    })
    expect(await refusal({ method: 'GET', body: '{}' })).toMatchObject({
      details: { reason: 'corps_sans_objet' },
    })
    expect(await refusal({ body: '{"a": {{montant}', format: 'json' })).toMatchObject({
      details: { reason: 'corps_json_invalide' },
    })
    expect(await refusal({ body: 'To={{client}}\nsans égal', format: 'form' })).toMatchObject({
      details: { reason: 'corps_formulaire_invalide' },
    })
    expect(await refusal({ headers: [{ name: 'Host', value: 'x' }] })).toMatchObject({
      details: { reason: 'entete_interdit', detail: 'Host' },
    })
    expect(
      await refusal({ headers: [{ name: 'Authorization', value: null, secret: true }] }),
    ).toMatchObject({ details: { reason: 'secret_manquant', detail: 'Authorization' } })
    expect(await refusal({ method: 'TRACE' })).toMatchObject({
      details: { reason: 'methode_inconnue' },
    })
  })
})
