import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * A base built from a template by the server, in one operation — chapter 20 §4: a template
 * of the catalog or one given whole, the build told step by step when asked, and a step that
 * fails leaving no base behind.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''

const as = (method: string, body?: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { 'content-type': 'application/json', authorization: `Bearer ${access}`, ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const json = async <T>(response: Response) => (await response.json()) as T

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT_REF, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  app = createApp({ kernel })
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@basedb.local', password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = (await json<{ data: { csrf: string } }>(login)).data.csrf
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  access = (await json<{ data: { token: string } }>(issued)).data.token
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

const bases = async () =>
  (
    await json<{ data: Array<{ name: string; label: string }> }>(
      await app.request(`${V1}/meta/bases`, as('GET')),
    )
  ).data

/** A template given whole: two tables, a relation, a formula, rows, a view, an automation. */
const OWN = {
  key: 'chat',
  label: 'Chat',
  base: { label: 'Chat' },
  tables: [
    {
      key: 'agents',
      label: 'Agents',
      fields: [
        { label: 'Nom', kind: 'short_text', required: true },
        { label: 'Actif', kind: 'boolean' },
      ],
    },
    {
      key: 'messages',
      label: 'Messages',
      fields: [
        { label: 'Sujet', kind: 'short_text' },
        { label: 'Texte', kind: 'long_text' },
        { label: 'Jetons', kind: 'number' },
        { label: 'Coût', kind: 'formula', formula: '[Jetons] * 2' },
        {
          label: 'Statut',
          kind: 'select',
          options: [{ label: 'Envoyé' }, { label: 'Lu' }],
        },
      ],
    },
  ],
  links: [{ from: 'messages', label: 'Agent', to: 'agents', multiple: false }],
  rows: {
    agents: [{ $key: 'a1', Nom: 'Assistant', Actif: true }],
    messages: [{ Sujet: 'Accueil', Texte: 'Bonjour', Jetons: 12, Statut: 'Envoyé', Agent: '@a1' }],
  },
  views: [
    {
      table: 'messages',
      label: 'Par statut',
      kind: 'kanban',
      spec: { group_by: 'Statut' },
    },
  ],
  automations: [
    {
      label: 'Lu à la création',
      enabled: true,
      trigger: { kind: 'record_created', table: 'messages', fields: [], schedule: null },
      condition: '',
      actions: [{ kind: 'update_record', values: { Statut: 'Lu' } }],
    },
  ],
}

describe('a base from a template, built by the server', () => {
  it('builds a template of the catalog, and says what it built otherwise', async () => {
    const r = await app.request(`${V1}/admin/bases`, as('POST', { template: 'crm', label: 'CRM' }))
    expect(r.status).toBe(201)
    const body = await json<{
      data: { name: string; label: string }
      meta: { template: { ai_degraded: number; sampled: boolean } }
    }>(r)
    expect(body.data.label).toBe('CRM')
    // No consent given: the AI fields become ordinary fields, with their sample values.
    expect(body.meta.template.ai_degraded).toBeGreaterThan(0)
    expect(body.meta.template.sampled).toBe(true)
    const meta = await json<{ data: { tables: Array<{ name: string }> } }>(
      await app.request(`${V1}/meta/bases/${body.data.name}`, as('GET')),
    )
    expect(meta.data.tables.length).toBe(4)
  })

  it('builds a template given whole: relations, formulas, rows resolved by their keys', async () => {
    const r = await app.request(`${V1}/admin/bases`, as('POST', { template: OWN, rows: true }))
    expect(r.status).toBe(201)
    const { data } = await json<{ data: { name: string } }>(r)
    const rows = await json<{ data: Array<Record<string, unknown>> }>(
      await app.request(`${V1}/data/${data.name}/messages?links=id`, as('GET')),
    )
    const [message] = rows.data
    expect(message).toMatchObject({ texte: 'Bonjour', statut: 'envoye', cout: '24.0000000000' })
    const agents = await json<{ data: Array<{ _id: string }> }>(
      await app.request(`${V1}/data/${data.name}/agents`, as('GET')),
    )
    expect(message?.agents_id).toBe(agents.data[0]?._id)
    const views = await json<{ data: Array<{ label: string; kind: string }> }>(
      await app.request(`${V1}/meta/bases/${data.name}/tables/messages/views`, as('GET')),
    )
    expect(views.data.map((v) => [v.label, v.kind])).toEqual([['Par statut', 'kanban']])
  })

  it('tells each step as it starts, then the base, to a client that asks', async () => {
    const r = await app.request(
      `${V1}/admin/bases`,
      as(
        'POST',
        { template: OWN, label: 'Chat pas à pas', rows: false },
        { accept: 'application/x-ndjson' },
      ),
    )
    expect(r.headers.get('content-type')).toContain('application/x-ndjson')
    const lines = (await r.text())
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>)
    const steps = lines.flatMap((l) =>
      l.step === undefined ? [] : [(l.step as { kind: string }).kind],
    )
    expect(steps.slice(0, 2)).toEqual(['table', 'table'])
    expect(steps).toContain('link')
    expect(steps).toContain('view')
    expect(steps).not.toContain('rows')
    expect(lines.at(-1)).toMatchObject({ data: { label: 'Chat pas à pas' } })
  })

  it('refuses a template that does not hold, before building anything', async () => {
    const before = (await bases()).length
    const r = await app.request(
      `${V1}/admin/bases`,
      as('POST', { template: { ...OWN, tables: [] } }),
    )
    expect(r.status).toBe(422)
    expect((await json<{ code: string }>(r)).code).toBe('TEMPLATE_INVALID')
    expect((await bases()).length).toBe(before)
  })

  it('leaves no base behind when a step fails, and names the step', async () => {
    const before = (await bases()).map((b) => b.label)
    const broken = {
      ...OWN,
      label: 'Cassé',
      base: { label: 'Cassé' },
      // Checked as a template, refused by the formula engine: its step fails half-way,
      // after the tables, their fields and the relation are built.
      tables: OWN.tables.map((t) =>
        t.key !== 'messages'
          ? t
          : {
              ...t,
              fields: t.fields.map((f) =>
                f.label === 'Coût' ? { ...f, formula: 'FONCTION_INCONNUE([Jetons])' } : f,
              ),
            },
      ),
    }
    const r = await app.request(`${V1}/admin/bases`, as('POST', { template: broken }))
    expect(r.status).toBeGreaterThanOrEqual(400)
    const refusal = await json<{
      code: string
      details: { template: { step: { kind: string }; discarded: boolean } }
    }>(r)
    expect(refusal.details.template).toMatchObject({
      step: { kind: 'computed', label: 'Coût' },
      discarded: true,
    })
    expect((await bases()).map((b) => b.label)).toEqual(before)
  })
})
