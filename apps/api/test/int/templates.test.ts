import { createServer as createHttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type Kernel, resetTemplateCatalog, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Base templates over HTTP — chapter 20.
 *
 * A local stand-in plays the public site and its catalog. What these guard: the gallery
 * serves the instance's templates over the site's over the carried ones, each saying its
 * source; a broken template of the site is left out, not the whole catalog; a site that
 * does not answer leaves the carried templates; an import is checked, and refused with
 * the issues that say where.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let stub: ReturnType<typeof createHttpServer>
let siteStatus = 200

const small = (key: string, label: string) => ({
  format: 1,
  key,
  label,
  summary: 'Un modèle du site.',
  tables: [{ key: 'notes', label: 'Notes', fields: [{ label: 'Titre', kind: 'short_text' }] }],
})

const catalogue = {
  format: 1,
  templates: [
    small('demo', 'Démo du site'),
    small('du-site', 'Seulement sur le site'),
    { key: 'casse', label: 'Cassé', tables: [] },
  ],
}

const call = (path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

interface Summary {
  key: string
  label: string
  source: string
  counts: { tables: number; ai_fields: number }
}

async function gallery(): Promise<{
  data: Summary[]
  meta: { site: { error: string | null } | null }
}> {
  return (await (await call(`${V1}/meta/templates`)).json()) as {
    data: Summary[]
    meta: { site: { error: string | null } | null }
  }
}

beforeAll(async () => {
  stub = createHttpServer((req, res) => {
    if (req.url === '/modeles/catalogue.json' && siteStatus === 200) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(catalogue))
      return
    }
    res.writeHead(siteStatus === 200 ? 404 : siteStatus).end()
  })
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', () => resolve()))
  const site = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/modeles/catalogue.json`

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  resetTemplateCatalog()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    webhookTargets: { allowHttp: true, allowPrivate: true },
    templatesUrl: site,
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
}, 240_000)

afterAll(async () => {
  stub?.close()
  await kernel?.close()
  await container?.stop()
  resetTemplateCatalog()
})

describe('the gallery', () => {
  it('serves the site over the carried templates, and leaves out a broken one', async () => {
    const { data, meta } = await gallery()
    expect(meta.site?.error).toBeNull()
    expect(data.find((t) => t.key === 'demo')).toMatchObject({
      label: 'Démo du site',
      source: 'site',
    })
    expect(data.find((t) => t.key === 'du-site')?.source).toBe('site')
    expect(data.find((t) => t.key === 'casse')).toBeUndefined()
    expect(data.find((t) => t.key === 'analyse-avis')).toMatchObject({ source: 'bundled' })
    expect(data.find((t) => t.key === 'analyse-avis')?.counts.ai_fields).toBeGreaterThan(0)
  })

  it('gives a template whole, and says where it comes from', async () => {
    const r = await call(`${V1}/meta/templates/suivi-tickets`)
    const body = (await r.json()) as { data: { tables: unknown[] }; meta: { source: string } }
    expect(body.meta.source).toBe('bundled')
    expect(body.data.tables.length).toBeGreaterThan(1)
    expect((await call(`${V1}/meta/templates/inconnu`)).status).toBe(404)
  })

  it('takes an import of the instance, checked, over the site', async () => {
    const refused = await call(`${V1}/admin/templates`, 'POST', { label: 'Sans table', tables: [] })
    expect(refused.status).toBe(422)
    const error = (await refused.json()) as {
      code: string
      details: { issues: Array<{ path: string }> }
    }
    expect(error.code).toBe('TEMPLATE_INVALID')
    expect(error.details.issues.map((i) => i.path)).toContain('tables')

    const imported = await call(`${V1}/admin/templates`, 'POST', small('demo', 'Démo maison'))
    expect(imported.status).toBe(201)
    expect((await gallery()).data.find((t) => t.key === 'demo')).toMatchObject({
      label: 'Démo maison',
      source: 'instance',
    })
    expect((await call(`${V1}/admin/templates/demo`, 'DELETE')).status).toBe(204)
    expect((await gallery()).data.find((t) => t.key === 'demo')?.source).toBe('site')
  })

  it('falls back on the carried templates when the site does not answer', async () => {
    resetTemplateCatalog()
    siteStatus = 503
    const { data, meta } = await gallery()
    expect(meta.site?.error).toBe('http_503')
    expect(data.find((t) => t.key === 'demo')?.source).toBe('bundled')
    expect(data.find((t) => t.key === 'du-site')).toBeUndefined()
    siteStatus = 200
  })

  it('asks the AI only when it is configured', async () => {
    const created = (await (
      await call(`${V1}/admin/bases`, 'POST', { label: 'Amorce' })
    ).json()) as {
      data: { project: string }
    }
    const r = await call(`${V1}/admin/templates/draft`, 'POST', {
      project: created.data.project,
      request: 'Gérer un club de tennis',
    })
    expect([409, 422]).toContain(r.status)
    expect(['AI_DISABLED', 'AI_NOT_CONFIGURED']).toContain(
      ((await r.json()) as { code: string }).code,
    )
  })
})
