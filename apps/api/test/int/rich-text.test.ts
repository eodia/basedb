import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Rich text and variables, over HTTP — chapter 04 §2.2.
 *
 * A long text created rich holds HTML: sanitized on every write, guarded by a CHECK
 * against direct SQL, announced as HTML by the description and OpenAPI. A long text —
 * plain or rich — may cite a column of its row, `{{nom}}`: the column keeps the citation,
 * every read serves the row's value in its place, and `variables=raw` gives the text as
 * written, for an editor.
 */

const TENANT_REF = 't7richq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let token = ''
let base = ''
let qualified = ''
let rowId = ''

const call = (path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function data<T>(r: Response): Promise<T> {
  return ((await r.json()) as { data: T }).data
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
  token = ((await issued.json()) as { data: { token: string } }).data.token

  base = (
    await data<{ name: string }>(await call(`${V1}/admin/bases`, 'POST', { label: 'Rédaction' }))
  ).name
  const table = await data<{ sql: string }>(
    await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
      label: 'Articles',
      fields: [{ label: 'Titre', kind: 'short_text' }],
    }),
  )
  qualified = table.sql
  const fields = `${V1}/admin/bases/${base}/tables/articles/fields`
  for (const field of [
    { label: 'Ville', kind: 'short_text' },
    { label: 'Statut', kind: 'select', options: [{ value: 'a_faire', label: 'À faire' }] },
    { label: 'Livraison', kind: 'date' },
    { label: 'Contenu', kind: 'long_text', rich: true },
    { label: 'Notes', kind: 'long_text' },
  ]) {
    expect((await call(fields, 'POST', field)).status).toBe(201)
  }
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('a rich long text', () => {
  it('is a long text alone', async () => {
    const r = await call(`${V1}/admin/bases/${base}/tables/articles/fields`, 'POST', {
      label: 'Court riche',
      kind: 'short_text',
      rich: true,
    })
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({
      code: 'REQUEST_INVALID',
      details: { field: 'rich', reason: 'texte_long_seul' },
    })
  })

  it('is announced as HTML, to the interface and in OpenAPI', async () => {
    const described = await data<{ tables: Array<{ fields: Array<Record<string, unknown>> }> }>(
      await call(`${V1}/meta/bases/${base}`),
    )
    const fields = described.tables[0]?.fields ?? []
    expect(fields.find((f) => f.name === 'contenu')).toMatchObject({ unsafe_html: true })
    expect(fields.find((f) => f.name === 'notes')?.unsafe_html).toBeUndefined()

    const spec = (await (await call(`${V1}/meta/bases/${base}/openapi.json`)).json()) as {
      components: { schemas: Record<string, { properties?: Record<string, { format?: string }> }> }
    }
    const schema = Object.values(spec.components.schemas).find(
      (s) => s.properties?.contenu !== undefined,
    )
    expect(schema?.properties?.contenu?.format).toBe('html')
  })

  it('is sanitized on write, and stores nothing when nothing readable is left', async () => {
    const created = await call(`${V1}/data/${base}/articles`, 'POST', {
      values: {
        titre: 'Un',
        ville: 'Lyon',
        statut: 'a_faire',
        livraison: '2026-10-02',
        contenu:
          '<p onclick="x">Bonjour <script>alert(1)</script><strong>{{ville}}</strong></p><img src="x" onerror="y">',
        notes: 'Statut : {{statut}}, le {{livraison}}. {{inconnu}}',
      },
    })
    expect(created.status).toBe(201)
    rowId = (await data<{ _id: string }>(created))._id

    const raw = await data<Record<string, unknown>>(
      await call(`${V1}/data/${base}/articles/${rowId}?variables=raw`),
    )
    expect(raw.contenu).toBe('<p>Bonjour <strong>{{ville}}</strong></p>')

    const emptied = await call(`${V1}/data/${base}/articles/${rowId}`, 'PATCH', {
      values: { contenu: '<p></p>' },
    })
    expect(emptied.status).toBe(200)
    const after = await data<Record<string, unknown>>(
      await call(`${V1}/data/${base}/articles/${rowId}?variables=raw`),
    )
    expect(after.contenu).toBeNull()
    await call(`${V1}/data/${base}/articles/${rowId}`, 'PATCH', {
      values: { contenu: '<p>Bonjour <strong>{{ville}}</strong></p>' },
    })
  })

  it('refuses the worst forms written in direct SQL — and not a plain sentence', async () => {
    const { Client } = await import('pg')
    const client = new Client({ connectionString: container.getConnectionUri() })
    await client.connect()
    try {
      await expect(
        client.query(`UPDATE ${qualified} SET contenu = '<script>alert(1)</script>'`),
      ).rejects.toMatchObject({ code: '23514' })
      await expect(
        client.query(`UPDATE ${qualified} SET contenu = '<p onmouseover="x">a</p>'`),
      ).rejects.toMatchObject({ code: '23514' })
      await expect(
        client.query(`UPDATE ${qualified} SET contenu = '<a href="JavaScript:x">a</a>'`),
      ).rejects.toMatchObject({ code: '23514' })
      // What the sanitizer writes never trips the guard.
      await client.query(
        `UPDATE ${qualified} SET notes = notes WHERE contenu = '<p>Bonjour <strong>{{ville}}</strong></p>'`,
      )
    } finally {
      await client.end()
    }
  })
})

describe('variables in a long text', () => {
  it('are read with the row’s values, a choice by its label, a date in the reader’s order', async () => {
    const row = await data<Record<string, unknown>>(
      await call(`${V1}/data/${base}/articles/${rowId}`),
    )
    expect(row.contenu).toBe('<p>Bonjour <strong>Lyon</strong></p>')
    // A citation naming no column is just text.
    expect(row.notes).toBe('Statut : À faire, le 02/10/2026. {{inconnu}}')

    const page = await data<Array<Record<string, unknown>>>(
      await call(`${V1}/data/${base}/articles`),
    )
    expect(page[0]?.contenu).toBe('<p>Bonjour <strong>Lyon</strong></p>')
  })

  it('are kept as written with variables=raw — what an editor opens', async () => {
    const page = await data<Array<Record<string, unknown>>>(
      await call(`${V1}/data/${base}/articles?variables=raw`),
    )
    expect(page[0]?.notes).toBe('Statut : {{statut}}, le {{livraison}}. {{inconnu}}')
  })

  it('follow the column they cite', async () => {
    await call(`${V1}/data/${base}/articles/${rowId}`, 'PATCH', { values: { ville: 'Nantes' } })
    const row = await data<Record<string, unknown>>(
      await call(`${V1}/data/${base}/articles/${rowId}`),
    )
    expect(row.contenu).toBe('<p>Bonjour <strong>Nantes</strong></p>')
  })

  it('escape what they insert into HTML', async () => {
    await call(`${V1}/data/${base}/articles/${rowId}`, 'PATCH', {
      values: { ville: '<b>gras</b> & co' },
    })
    const row = await data<Record<string, unknown>>(
      await call(`${V1}/data/${base}/articles/${rowId}`),
    )
    expect(row.contenu).toBe('<p>Bonjour <strong>&lt;b&gt;gras&lt;/b&gt; &amp; co</strong></p>')
  })
})
