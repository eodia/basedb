import { createHmac, randomUUID } from 'node:crypto'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Webhooks — chapter 08 §10, end to end: a real PostgreSQL, a real HTTP consumer on this
 * machine (the only reason the target policy is relaxed here), and the whole path — the
 * capture in the write's transaction, the drain, the delivery, the signature.
 */

const TENANT = 't4z56fq'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let sessionId: string
let sql: pg.Client
let server: Server
let url: string
let crm: { baseId: string; schemaName: string }
let clients: { tableId: string; name: string }
let commandes: { tableId: string; name: string }
let acme: string

/** What the consumer received, and what it answers next. */
const received: Array<{ headers: Record<string, string>; body: string }> = []
let answer = 200

async function pump(): Promise<void> {
  await kernel.drainHistory()
  await kernel.dispatchWebhooks()
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    webhookTargets: { allowHttp: true, allowPrivate: true },
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await kernel.openContext({
    userId: boot.userId,
    requestId: randomUUID(),
    surface: 'rest',
  })
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  sessionId = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  crm = await kernel.createBase(admin, { label: 'CRM' })
  const c = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  clients = { tableId: c.tableId, name: c.tableName }
  await kernel.setDisplayColumn(admin, { tableId: c.tableId, fieldId: c.fields[0].fieldId })
  const o = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Commandes',
    fields: [
      { label: 'Numéro', kind: 'short_text' },
      { label: 'Montant', kind: 'number' },
    ],
  })
  commandes = { tableId: o.tableId, name: o.tableName }
  await kernel.createLinkField(admin, {
    tableId: o.tableId,
    targetTableId: c.tableId,
    label: 'Client',
    onDelete: 'set_null',
  })
  acme = String(
    (await kernel.createRecord(admin, { tableId: c.tableId, values: { nom: 'ACME' } })).row._id,
  )

  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      received.push({ headers: req.headers as Record<string, string>, body })
      res.statusCode = answer
      res.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`

  sql = new pg.Client({ connectionString: container.getConnectionUri() })
  await sql.connect()
}, 240_000)

afterAll(async () => {
  await sql?.end()
  server?.close()
  await kernel?.close()
  await container?.stop()
})

describe('a webhook, from the write to the consumer', () => {
  let secret: string
  let webhookId: string

  it('is created with a secret shown once, and lights the change feed of its table', async () => {
    const created = await kernel.createWebhook(admin, {
      baseId: crm.baseId,
      label: 'Synchro ERP',
      url,
      subscriptions: [{ tableId: commandes.tableId, events: ['create', 'update', 'delete'] }],
      sessionId,
    })
    secret = created.secret
    webhookId = created.webhook.id
    expect(secret).toMatch(/^whsec_/)
    expect(created.webhook.subscriptions).toEqual([
      expect.objectContaining({
        tableName: commandes.name,
        events: ['create', 'update', 'delete'],
      }),
    ])
    const listed = JSON.stringify(await kernel.listWebhooks(admin, { baseId: crm.baseId }))
    expect(listed).not.toContain(secret)

    const feed = await sql.query<{ is_active: boolean }>(
      'SELECT is_active FROM _basedb_local.change_feed_state WHERE table_id = $1',
      [commandes.tableId],
    )
    expect(feed.rows[0]?.is_active).toBe(true)
  })

  it('delivers the whole row, signed, with numbers as decimals and links named', async () => {
    const row = await kernel.createRecord(admin, {
      tableId: commandes.tableId,
      values: { numero: 'C-1', montant: '42.50', clients_id: acme },
    })
    await pump()

    expect(received).toHaveLength(1)
    const [call] = received
    // §10.5: HMAC-SHA256 over "<t>." + the raw body.
    const [, t, v1] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(call.headers['x-basedb-signature']) ?? []
    const expected = createHmac('sha256', secret).update(`${t}.${call.body}`).digest('hex')
    expect(v1).toBe(expected)

    const { events } = JSON.parse(call.body)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'record.created',
      tenant: TENANT,
      base: crm.schemaName,
      table: commandes.name,
      record_id: row.row._id,
      actor: { kind: 'user' },
      cause: { kind: 'direct' },
      before: null,
    })
    expect(Number(events[0].after.montant)).toBe(42.5)
    expect(typeof events[0].after.montant).toBe('string')
    expect(events[0].after.clients_id).toEqual({ id: acme, display: 'ACME' })
  })

  it('a direct SQL write triggers it too — the capture is in the database', async () => {
    received.length = 0
    await sql.query(
      `UPDATE "${crm.schemaName}"."${commandes.name}" SET montant = 50 WHERE numero = 'C-1'`,
    )
    await pump()
    const [event] = JSON.parse(received[0]?.body ?? '{"events":[]}').events
    expect(event).toMatchObject({
      type: 'record.updated',
      actor: { kind: 'sql_direct' },
      changed: ['montant'],
    })
    expect(Number(event.before.montant)).toBe(42.5)
    expect(Number(event.after.montant)).toBe(50)
  })

  it('a failing consumer keeps the delivery pending, to be tried again later', async () => {
    received.length = 0
    answer = 503
    await sql.query(
      `UPDATE "${crm.schemaName}"."${commandes.name}" SET montant = 51 WHERE numero = 'C-1'`,
    )
    await pump()
    expect(received).toHaveLength(1)
    const [latest] = await kernel.listDeliveries(admin, { webhookId })
    expect(latest).toMatchObject({ status: 'pending', attempts: 1, responseCode: 503 })
    expect(Date.parse(latest.nextAttemptAt ?? '')).toBeGreaterThan(Date.now())

    // Once due again, and the consumer back, it goes — and nothing else overtook it.
    answer = 200
    await sql.query(
      `UPDATE _basedb.webhook_delivery SET next_attempt_at = clock_timestamp() - interval '1 second'
        WHERE status = 'pending'`,
    )
    await pump()
    const [redelivered] = await kernel.listDeliveries(admin, { webhookId })
    expect(redelivered).toMatchObject({ status: 'delivered', attempts: 2, responseCode: 200 })
  })

  it('a deletion is delivered, and stays in the deletion journal for a late consumer', async () => {
    received.length = 0
    const [order] = (await kernel.listRecords(admin, { tableId: commandes.tableId })).rows
    await kernel.deleteRecord(admin, { tableId: commandes.tableId, recordId: String(order._id) })
    await pump()
    const [event] = JSON.parse(received[0]?.body ?? '{"events":[]}').events
    expect(event).toMatchObject({ type: 'record.deleted', after: null })

    const journal = await kernel.listDeletions(admin, {
      tableId: commandes.tableId,
      since: new Date(Date.now() - 3_600_000).toISOString(),
    })
    expect(journal.deletions.map((d) => d.id)).toEqual([order._id])
  })

  it('stopped, it sends nothing more and its table writes no event', async () => {
    received.length = 0
    await kernel.setWebhookActive(admin, { webhookId, active: false, sessionId })
    await kernel.createRecord(admin, { tableId: commandes.tableId, values: { numero: 'C-2' } })
    await pump()
    expect(received).toHaveLength(0)
    const feed = await sql.query<{ is_active: boolean }>(
      'SELECT is_active FROM _basedb_local.change_feed_state WHERE table_id = $1',
      [commandes.tableId],
    )
    expect(feed.rows[0]?.is_active).toBe(false)
  })
})
