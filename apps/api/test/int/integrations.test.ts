import { createServer as createHttpServer } from 'node:http'
import { type AddressInfo, createServer } from 'node:net'
import { type Kernel, startKernel } from '@basedb/core'
import { serve } from '@hono/node-server'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Integrations and synced tables over HTTP — chapter 19.
 *
 * A local stand-in plays Slack, a published CSV and an agenda; the API itself is served
 * for real, so that a view it shares can be the source of a synced table. What these
 * guard: a Slack connection never gives its address back, and posts what an automation
 * says; a synced table follows its source — rows created, changed, deleted — refuses any
 * other write, and keeps its rows when the source fails; a shared calendar publishes a feed.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let base = ''
let stub: ReturnType<typeof createHttpServer>
let stubUrl = ''
let served: ReturnType<typeof serve>
let apiUrl = ''

/** What the stand-in serves, changed by the tests. */
const source = {
  csv: 'id;nom;quantite;arrivee\n1;Vis;120;2026-10-01\n2;Écrous;80;2026-10-02\n3;Rondelles;300;2026-10-03\n',
  csvStatus: 200,
  ics: [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:reunion-1@exemple',
    'SUMMARY:Réunion de chantier',
    'DTSTART:20261005T080000Z',
    'DTEND:20261005T090000Z',
    'LOCATION:Lyon',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:conges@exemple',
    'SUMMARY:Congés',
    'DTSTART;VALUE=DATE:20261012',
    'DTEND;VALUE=DATE:20261017',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n'),
}
const slackMessages: string[] = []

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

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.listen(0, () => {
      const { port } = probe.address() as AddressInfo
      probe.close(() => resolve(port))
    })
  })
}

beforeAll(async () => {
  stub = createHttpServer((req, res) => {
    if (req.method === 'POST' && req.url === '/slack') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        slackMessages.push((JSON.parse(body) as { text: string }).text)
        res.writeHead(200).end('ok')
      })
      return
    }
    if (req.url === '/stock.csv') {
      res.writeHead(source.csvStatus, { 'content-type': 'text/csv' }).end(source.csv)
      return
    }
    if (req.url === '/agenda.ics') {
      res.writeHead(200, { 'content-type': 'text/calendar' }).end(source.ics)
      return
    }
    res.writeHead(404).end()
  })
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', () => resolve()))
  stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    // The stand-ins live on this machine: the development policy lets the server call them.
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
  const port = await freePort()
  served = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' })
  apiUrl = `http://127.0.0.1:${port}`
  await kernel.setPassword({ userId: rows[0].created_by, password: PASSWORD })
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
    await data<{ name: string }>(await call(`${V1}/admin/bases`, 'POST', { label: 'Entrepôt' }))
  ).name
  const table = await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Livraisons',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Jour', kind: 'date' },
    ],
  })
  expect(table.status).toBe(201)
}, 240_000)

afterAll(async () => {
  served?.close()
  stub?.close()
  await kernel?.close()
  await container?.stop()
})

const ADMIN = () => `${V1}/admin/bases/${base}`

describe('Slack', () => {
  let id = ''

  it('keeps the address sealed, and posts a test message', async () => {
    const r = await call(`${ADMIN()}/integrations`, 'POST', {
      label: '#chantier',
      url: `${stubUrl}/slack`,
    })
    expect(r.status).toBe(201)
    const created = await data<{ id: string; hint: string }>(r)
    id = created.id
    expect(created.hint).toBe('…/lack')
    const listed = await (await call(`${ADMIN()}/integrations`)).text()
    expect(listed).not.toContain('127.0.0.1')

    expect((await call(`${ADMIN()}/integrations/${id}/test`, 'POST')).status).toBe(200)
    expect(slackMessages.at(-1)).toContain('#chantier')
  })

  it('carries what an automation says', async () => {
    const automation = await call(`${ADMIN()}/automations`, 'POST', {
      label: 'Prévenir le canal',
      trigger: { kind: 'record_created', table: 'livraisons' },
      actions: [{ kind: 'slack', integration: id, message: 'Nouvelle livraison : {{nom}}' }],
    })
    expect(automation.status).toBe(201)
    await call(`${V1}/data/${base}/livraisons`, 'POST', {
      values: { nom: 'Ciment', jour: '2026-10-09' },
    })
    await kernel.drainHistory()
    await kernel.runAutomations()
    expect(slackMessages.at(-1)).toBe('Nouvelle livraison : Ciment')
  })
})

describe('a synced table', () => {
  interface Synced {
    table: string
    last_status: string | null
    last_error: string | null
    last_counts: { created: number; updated: number; deleted: number } | null
  }
  let stock: Synced

  it('is created from a CSV, typed by its content', async () => {
    const r = await call(`${ADMIN()}/synced-tables`, 'POST', {
      label: 'Stock',
      source: { kind: 'csv', url: `${stubUrl}/stock.csv` },
      interval_minutes: 60,
    })
    expect(r.status).toBe(201)
    stock = await data<Synced>(r)
    expect(stock).toMatchObject({
      last_status: 'ok',
      last_counts: { created: 3, updated: 0, deleted: 0 },
    })

    const meta = await data<{
      tables: Array<{
        name: string
        synced?: boolean
        actions: string[]
        fields: Array<{ label: string; kind: string; read_only?: boolean; system?: boolean }>
      }>
    }>(await call(`${V1}/meta/bases/${base}`))
    const described = meta.tables.find((t) => t.name === stock.table)
    // The meta says it before any write is tried: read, and nothing else — even to an admin.
    expect(described).toMatchObject({ synced: true, actions: ['read'] })
    expect(described?.fields.every((f) => f.read_only === true)).toBe(true)
    const fields = described?.fields ?? []
    expect(fields.map((f) => [f.label, f.kind])).toEqual(
      expect.arrayContaining([
        ['Clé de synchronisation', 'short_text'],
        ['nom', 'short_text'],
        ['quantite', 'number'],
        ['arrivee', 'date'],
      ]),
    )
    const rows = await data<Array<{ nom: string; quantite: string }>>(
      await call(`${V1}/data/${base}/${stock.table}?sort=nom`),
    )
    expect(rows.map((r) => r.nom)).toEqual(['Écrous', 'Rondelles', 'Vis'])
  })

  it('refuses any write but its synchronisation’s', async () => {
    const refused = await call(`${V1}/data/${base}/${stock.table}`, 'POST', {
      values: { nom: 'Clous' },
    })
    expect(refused.status).toBe(409)
    expect(await refused.json()).toMatchObject({ code: 'TABLE_SYNCED' })
  })

  it('follows its source: rows created, changed, deleted', async () => {
    source.csv =
      'id;nom;quantite;arrivee\n1;Vis;150;2026-10-01\n3;Rondelles;300;2026-10-03\n4;Chevilles;60;2026-10-04\n'
    const r = await call(`${ADMIN()}/synced-tables/${stock.table}/run`, 'POST')
    expect(await data<Synced>(r)).toMatchObject({
      last_status: 'ok',
      last_counts: { created: 1, updated: 1, deleted: 1 },
    })
    const rows = await data<Array<{ nom: string; quantite: string }>>(
      await call(`${V1}/data/${base}/${stock.table}?sort=nom`),
    )
    expect(rows.map((r) => [r.nom, Number(r.quantite)])).toEqual([
      ['Chevilles', 60],
      ['Rondelles', 300],
      ['Vis', 150],
    ])
  })

  it('keeps its rows when the source fails, and says so', async () => {
    source.csvStatus = 500
    const failed = await call(`${ADMIN()}/synced-tables/${stock.table}/run`, 'POST')
    expect(failed.status).toBe(502)
    expect(await failed.json()).toMatchObject({
      code: 'SYNC_SOURCE_FAILED',
      details: { reason: 'http_500' },
    })
    const [listed] = await data<Synced[]>(await call(`${ADMIN()}/synced-tables`))
    expect(listed).toMatchObject({
      last_status: 'failed',
      last_error: 'SYNC_SOURCE_FAILED : http_500',
    })
    expect(await data<unknown[]>(await call(`${V1}/data/${base}/${stock.table}`))).toHaveLength(3)
    source.csvStatus = 200
  })

  it('imports an agenda', async () => {
    const r = await call(`${ADMIN()}/synced-tables`, 'POST', {
      label: 'Agenda',
      source: { kind: 'ics', url: `${stubUrl}/agenda.ics` },
      interval_minutes: 30,
    })
    expect(r.status).toBe(201)
    const agenda = await data<Synced>(r)
    const rows = await data<Array<{ titre: string; debut: string; lieu: string | null }>>(
      await call(`${V1}/data/${base}/${agenda.table}?sort=debut`),
    )
    expect(rows.map((e) => e.titre)).toEqual(['Réunion de chantier', 'Congés'])
    expect(new Date(rows[0]?.debut as string).toISOString()).toBe('2026-10-05T08:00:00.000Z')
    expect(rows[0]?.lieu).toBe('Lyon')
  })

  it('reads a view another base shares', async () => {
    const view = await data<{ id: string }>(
      await call(`${ADMIN()}/tables/livraisons/views`, 'POST', {
        label: 'Publiée',
        kind: 'grid',
        spec: {},
      }),
    )
    const shared = await call(`${ADMIN()}/tables/livraisons/views/${view.id}/share`, 'PUT', {
      access: 'public',
      active: true,
    })
    const token = (await data<{ share: { token: string } }>(shared)).share.token
    const r = await call(`${ADMIN()}/synced-tables`, 'POST', {
      label: 'Livraisons copiées',
      source: { kind: 'basedb', url: `${apiUrl}/api/v1/views/${token}` },
      interval_minutes: 15,
    })
    expect(r.status).toBe(201)
    const copy = await data<Synced>(r)
    const rows = await data<Array<{ nom: string }>>(await call(`${V1}/data/${base}/${copy.table}`))
    expect(rows.map((row) => row.nom)).toEqual(['Ciment'])
  })
})

describe('the feed of a shared calendar', () => {
  it('publishes the rows as events, for a public share only', async () => {
    const view = await data<{ id: string }>(
      await call(`${ADMIN()}/tables/livraisons/views`, 'POST', {
        label: 'Calendrier',
        kind: 'calendar',
        spec: { date_field: 'jour', title_field: 'nom' },
      }),
    )
    const shareOf = async (access: string) =>
      (
        await data<{ share: { token: string } }>(
          await call(`${ADMIN()}/tables/livraisons/views/${view.id}/share`, 'PUT', {
            access,
            active: true,
          }),
        )
      ).share.token
    const token = await shareOf('public')
    const feed = await app.request(`/api/v1/views/${token}/calendar.ics`)
    expect(feed.status).toBe(200)
    expect(feed.headers.get('content-type')).toContain('text/calendar')
    const text = await feed.text()
    expect(text).toContain('BEGIN:VEVENT')
    expect(text).toContain('SUMMARY:Ciment')
    expect(text).toContain('DTSTART;VALUE=DATE:20261009')
    expect(text).toContain('DTEND;VALUE=DATE:20261010')

    await shareOf('members')
    const restricted = await app.request(`/api/v1/views/${token}/calendar.ics`)
    expect(restricted.status).toBe(403)
  })
})
