import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Kernel, startKernel } from '@basedb/core'
import { Basedb, BasedbError, filter, typesOf } from '@basedb/sdk'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * The TypeScript SDK (`@basedb/sdk`) against this API — its routes, its envelopes, its
 * refusals —, with an integration token as a program would hold one. The SDK is handed the
 * application's own `request` as its `fetch`: every call goes through the whole HTTP stack.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'
const PDF = new TextEncoder().encode('%PDF-1.7\n% un devis\n%%EOF\n')

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let directory: string
let base = ''
let secret = ''
let db: Basedb

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  directory = await mkdtemp(join(tmpdir(), 'basedb-api-sdk-'))
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    files: { storage: { driver: 'local', directory }, maxBytes: 1024 * 1024 },
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT_REF, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  app = createApp({ kernel })

  // A session, elevated: what minting a token asks.
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@basedb.local', password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const elevated = await app.request('/auth/elevate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ password: PASSWORD }),
  })
  const planted = elevated.headers.getSetCookie()
  const session = planted.find((c) => c.includes('basedb_session'))?.split(';')[0] ?? ''
  const csrf =
    planted
      .find((c) => c.includes('basedb_csrf'))
      ?.split(';')[0]
      ?.split('=')[1] ?? ''
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie: session, 'x-basedb-csrf': csrf },
  })
  const access = ((await issued.json()) as { data: { token: string } }).data.token
  const as = (method: string, body: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
    body: JSON.stringify(body),
  })
  const call = async <T>(path: string, method: string, body: unknown) =>
    ((await (await app.request(`${V1}${path}`, as(method, body))).json()) as { data: T }).data

  base = (await call<{ name: string }>('/admin/bases', 'POST', { label: 'Ventes' })).name
  await call(`/admin/bases/${base}/tables`, 'POST', {
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text', required: true }],
  })
  await call(`/admin/bases/${base}/tables`, 'POST', {
    label: 'Opportunités',
    fields: [{ label: 'Titre', kind: 'short_text', required: true }],
  })
  const field = (body: unknown) =>
    call(`/admin/bases/${base}/tables/opportunites/fields`, 'POST', body)
  await field({ label: 'Montant', kind: 'number' })
  await field({
    label: 'Statut',
    kind: 'select',
    options: [{ value: 'nouveau' }, { value: 'gagne' }, { value: 'perdu' }],
  })
  await field({ label: 'Devis', kind: 'file' })
  await call(`/admin/bases/${base}/tables/opportunites/links`, 'POST', {
    label: 'Client',
    target: 'clients',
  })
  secret = (
    await call<{ secret: string }>('/admin/tokens', 'POST', { label: 'SDK', base, access: 'write' })
  ).secret

  db = new Basedb({
    url: 'http://basedb.test',
    token: secret,
    fetch: (input, init) => Promise.resolve(app.request(input, init)),
  })
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
  if (directory !== undefined) await rm(directory, { recursive: true, force: true })
})

describe('the SDK, against the API', () => {
  it('lists the base the token opens, and generates its types', async () => {
    expect((await db.bases()).map((b) => b.name)).toEqual([base])
    const described = await db.base(base).describe()
    expect(described.tables.map((t) => t.name).sort()).toEqual(['clients', 'opportunites'])
    const source = typesOf([described])
    expect(source).toContain('readonly statut: "nouveau" | "gagne" | "perdu" | null')
    expect(source).toContain('readonly clients_id: LinkValue | null')
  })

  it('creates, reads, filters, updates, and undoes', async () => {
    const clients = db.base(base).table('clients')
    const deals = db.base(base).table('opportunites')
    const acme = await clients.create({ nom: 'Acme' })
    const deal = await deals.create({
      titre: 'Audit',
      montant: 12500.5,
      statut: 'nouveau',
      clients_id: acme._id,
    })
    expect(deal).toMatchObject({
      titre: 'Audit',
      montant: '12500.5000000000',
      clients_id: acme._id,
    })

    const read = await deals.get(deal._id)
    // Read as an object — its display value is the target's display field, none here.
    expect(read.clients_id).toMatchObject({ id: acme._id })
    expect((await deals.get(deal._id, { links: 'id' })).clients_id).toBe(acme._id)

    const typed = 'Audit" or titre eq "x'
    expect((await deals.list({ filter: filter`titre eq ${typed}` })).rows).toEqual([])
    expect((await deals.list({ filter: filter`titre eq ${'Audit'}` })).rows).toHaveLength(1)

    const won = await deals.update(deal._id, { statut: 'gagne' })
    expect(won.statut).toBe('gagne')
    await db.undo(won)
    expect((await deals.get(deal._id)).statut).toBe('nouveau')
  })

  it('reads every page, counts and aggregates', async () => {
    const deals = db.base(base).table('opportunites')
    const ids = await deals.createMany(
      Array.from({ length: 5 }, (_, i) => ({ titre: `Lot ${i}`, montant: String(i * 100) })),
    )
    expect(ids).toHaveLength(5)
    const titles: string[] = []
    for await (const row of deals.all({
      filter: filter`titre starts_with ${'Lot'}`,
      sort: 'titre',
      limit: 2,
    })) {
      titles.push(String(row.titre))
    }
    expect(titles).toEqual(['Lot 0', 'Lot 1', 'Lot 2', 'Lot 3', 'Lot 4'])
    expect(await deals.count(filter`titre starts_with ${'Lot'}`)).toBe(5)
    const summary = await deals.aggregate({
      aggregates: { montant: 'sum' },
      filter: filter`titre starts_with ${'Lot'}`,
    })
    expect(summary.total).toBe(5)
    expect(Number(Object.values(summary.values)[0])).toBe(1000)
  })

  it('comments, deposits a file and serves it through its signed link', async () => {
    const deals = db.base(base).table('opportunites')
    const deal = await deals.create({ titre: 'Devis signé' })
    const comment = await deals.comments(deal._id).add('Envoyé au client')
    expect((await deals.comments(deal._id).list()).map((c) => c.body)).toEqual([comment.body])

    const file = await deals.upload('devis', PDF, {
      name: 'devis été.pdf',
      type: 'application/pdf',
    })
    const withFile = await deals.update(deal._id, { devis: [file.id] })
    expect(withFile.devis).toHaveLength(1)
    const [entry] = (await deals.get(deal._id)).devis as Array<{ url: string; name: string }>
    expect(entry.name).toBe('devis été.pdf')
    const download = await app.request(deals.fileUrl(entry))
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(PDF)
  })

  it('raises basedb’s refusals by their code', async () => {
    const deals = db.base(base).table('opportunites')
    const deal = await deals.create({ titre: 'À garder' })
    const refused = await deals.delete(deal._id).catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(BasedbError)
    expect(refused).toMatchObject({ code: 'ADMIN_REQUIRED', status: 403 })
    await expect(deals.update(deal._id, { statut: 'inconnu' })).rejects.toMatchObject({
      code: 'VALUE_OUT_OF_CONSTRAINT',
    })
    await expect(db.base(base).table('factures').list()).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    })
  })
})
