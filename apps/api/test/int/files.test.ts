import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Multiple choice, documents and images, over HTTP — chapter 04 §3 and §3 bis.
 *
 * What the kernel's own tests cannot see: the deposit route and its size bound, the
 * download route that takes NO token, and the headers that keep a file from running
 * anything on the API's origin.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'
const PDF = new TextEncoder().encode('%PDF-1.7\n% un devis\n%%EOF\n')

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let directory: string
let access = ''
let base = ''

const auth = () => ({ authorization: `Bearer ${access}` })
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...auth() },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  directory = await mkdtemp(join(tmpdir(), 'basedb-api-files-'))
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    files: { storage: { driver: 'local', directory }, maxBytes: 1024 },
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
  const csrf = ((await login.json()) as { data: { csrf: string } }).data.csrf
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  access = ((await issued.json()) as { data: { token: string } }).data.token

  const created = await app.request(`${V1}/admin/bases`, json('POST', { label: 'Chantiers' }))
  base = ((await created.json()) as { data: { name: string } }).data.name
  await app.request(
    `${V1}/admin/bases/${base}/tables`,
    json('POST', { label: 'Visites', fields: [{ label: 'Nom', kind: 'short_text' }] }),
  )
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
  if (directory !== undefined) await rm(directory, { recursive: true, force: true })
})

describe('the three kinds, over HTTP', () => {
  it('creates a multiple choice, and filters it with has_any', async () => {
    const field = await app.request(
      `${V1}/admin/bases/${base}/tables/visites/fields`,
      json('POST', {
        label: 'Étiquettes',
        kind: 'multi_select',
        options: [{ value: 'urgent' }, { value: 'client' }],
      }),
    )
    expect(field.status).toBe(201)

    const row = await app.request(
      `${V1}/data/${base}/visites`,
      json('POST', { values: { nom: 'A', etiquettes: ['urgent', 'urgent', 'client'] } }),
    )
    expect(((await row.json()) as { data: Record<string, unknown> }).data.etiquettes).toEqual([
      'urgent',
      'client',
    ])

    const filter = encodeURIComponent('etiquettes has_any ["client"]')
    const read = await app.request(`${V1}/data/${base}/visites?filter=${filter}`, {
      headers: auth(),
    })
    expect(((await read.json()) as { data: unknown[] }).data).toHaveLength(1)

    const meta = await app.request(`${V1}/meta/bases/${base}`, { headers: auth() })
    const described = (await meta.json()) as {
      data: { tables: Array<{ fields: Array<Record<string, unknown>> }> }
    }
    const projected = described.data.tables[0].fields.find((f) => f.name === 'etiquettes')
    expect(projected).toMatchObject({
      kind: 'multi_select',
      operators: ['has_any', 'has_all', 'is_null'],
      sortable: false,
    })
  })

  it('deposits a document, writes it into a row, and serves it through the signed link', async () => {
    const field = await app.request(
      `${V1}/admin/bases/${base}/tables/visites/fields`,
      json('POST', { label: 'Devis', kind: 'file' }),
    )
    expect(field.status).toBe(201)

    const deposit = await app.request(
      `${V1}/files/${base}/visites/devis?name=${encodeURIComponent('devis été.pdf')}`,
      { method: 'POST', headers: { ...auth(), 'content-type': 'application/pdf' }, body: PDF },
    )
    expect(deposit.status).toBe(201)
    const file = ((await deposit.json()) as { data: Record<string, unknown> }).data
    expect(file).toMatchObject({ name: 'devis été.pdf', type: 'application/pdf', size: PDF.length })

    const written = await app.request(
      `${V1}/data/${base}/visites`,
      json('POST', { values: { nom: 'B', devis: [{ id: file.id }] } }),
    )
    const row = ((await written.json()) as { data: Record<string, unknown> }).data
    const [entry] = row.devis as Array<{ url: string }>
    expect(entry.url).toMatch(new RegExp(`^${V1}/files/${String(file.id)}/`))

    // NO Authorization header: the link is the credential.
    const download = await app.request(entry.url)
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toBe('application/pdf')
    expect(download.headers.get('content-disposition')).toBe(
      `inline; filename="devis _t_.pdf"; filename*=UTF-8''devis%20%C3%A9t%C3%A9.pdf`,
    )
    expect(download.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(PDF)

    const forced = await app.request(`${entry.url}&download=1`)
    expect(forced.headers.get('content-disposition')?.startsWith('attachment;')).toBe(true)

    const forged = await app.request(
      entry.url.replace(/sig=[^&]+/, 'sig=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    )
    expect(forged.status).toBe(404)
  })

  it('serves a document of an unsafe type as an attachment, sandboxed', async () => {
    const html = new TextEncoder().encode('<script>alert(document.cookie)</script>')
    const deposit = await app.request(`${V1}/files/${base}/visites/devis?name=page.html`, {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'text/html' },
      body: html,
    })
    const file = ((await deposit.json()) as { data: { id: string } }).data
    const written = await app.request(
      `${V1}/data/${base}/visites`,
      json('POST', { values: { nom: 'C', devis: [file.id] } }),
    )
    const row = ((await written.json()) as { data: Record<string, unknown> }).data
    const [entry] = row.devis as Array<{ url: string }>

    const download = await app.request(entry.url)
    expect(download.headers.get('content-disposition')?.startsWith('attachment;')).toBe(true)
    expect(download.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('refuses a deposit over the bound, and a picture that is not one', async () => {
    const big = await app.request(`${V1}/files/${base}/visites/devis?name=gros.bin`, {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/octet-stream' },
      body: new Uint8Array(2048),
    })
    expect(big.status).toBe(413)
    expect(((await big.json()) as { code: string }).code).toBe('BODY_TOO_LARGE')

    await app.request(
      `${V1}/admin/bases/${base}/tables/visites/fields`,
      json('POST', { label: 'Photos', kind: 'image' }),
    )
    const svg = await app.request(`${V1}/files/${base}/visites/photos?name=logo.png`, {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'image/png' },
      body: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    })
    expect(svg.status).toBe(415)
  })

  it('refuses a deposit without a token', async () => {
    const r = await app.request(`${V1}/files/${base}/visites/devis?name=a.pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/pdf' },
      body: PDF,
    })
    expect(r.status).toBe(401)
  })
})
