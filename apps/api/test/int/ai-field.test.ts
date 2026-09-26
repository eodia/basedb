import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * The AI field over HTTP — chapter 12 §1.5, chapter 04 §7 bis.
 *
 * What the kernel's own tests cannot see: the body a screen sends, the status codes of its
 * refusals, and the preview a person reads while building a schedule. No call leaves:
 * nothing here computes a cell.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let base = ''

const auth = () => ({ authorization: `Bearer ${access}` })
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...auth() },
  body: JSON.stringify(body),
})
const read = async <T>(response: Response) => (await response.json()) as T

beforeAll(async () => {
  process.env.BASEDB_AI_PROVIDER = 'anthropic'
  process.env.BASEDB_AI_MODEL = 'modele-de-test'
  process.env.BASEDB_AI_API_KEY = 'cle-de-test'

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

  const created = await app.request(`${V1}/admin/bases`, json('POST', { label: 'Chantiers' }))
  base = (await read<{ data: { name: string } }>(created)).data.name
  await app.request(
    `${V1}/admin/bases/${base}/tables`,
    json('POST', {
      label: 'Visites',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Notes', kind: 'long_text' },
      ],
    }),
  )
}, 180_000)

afterAll(async () => {
  Reflect.deleteProperty(process.env, 'BASEDB_AI_PROVIDER')
  Reflect.deleteProperty(process.env, 'BASEDB_AI_MODEL')
  Reflect.deleteProperty(process.env, 'BASEDB_AI_API_KEY')
  await kernel?.close()
  await container?.stop()
})

const FIELDS = () => `${V1}/admin/bases/${base}/tables/visites/fields`
const AI = {
  prompt: 'Résume {{Notes}} pour {{ nom }}.',
  refresh: { mode: 'schedule', cron: '0 8 * * 1', timezone: 'Europe/Paris' },
}

describe('an AI field over HTTP', () => {
  it('is refused without consent, and with a citation that designates nothing', async () => {
    const without = await app.request(
      FIELDS(),
      json('POST', { label: 'Résumé', kind: 'short_text', ai: AI }),
    )
    expect(without.status).toBe(409)
    expect((await read<{ code: string }>(without)).code).toBe('AI_CONSENT_REQUIRED')

    const unknown = await app.request(
      FIELDS(),
      json('POST', {
        label: 'Résumé',
        kind: 'short_text',
        ai: { ...AI, prompt: 'Résume {{Adresse}}', consent: true },
      }),
    )
    expect(unknown.status).toBe(400)
    expect((await read<{ details: Record<string, unknown> }>(unknown)).details).toMatchObject({
      reason: 'variable_inconnue',
      variable: 'Adresse',
    })

    const malformed = await app.request(
      FIELDS(),
      json('POST', { label: 'Résumé', kind: 'short_text', ai: { prompt: 3, refresh: {} } }),
    )
    expect(malformed.status).toBe(400)
  })

  it('is created with consent, and reads back under physical names', async () => {
    const created = await app.request(
      FIELDS(),
      json('POST', { label: 'Résumé', kind: 'short_text', ai: { ...AI, consent: true } }),
    )
    expect(created.status).toBe(201)
    expect((await read<{ data: { kind: string } }>(created)).data.kind).toBe('short_text')

    const status = await app.request(`${FIELDS()}/resume/ai`, { headers: auth() })
    expect(status.status).toBe(200)
    const body = (await read<{ data: Record<string, unknown> }>(status)).data
    expect(body).toMatchObject({
      prompt: 'Résume {{notes}} pour {{nom}}.',
      cited: [
        { name: 'notes', label: 'Notes' },
        { name: 'nom', label: 'Nom' },
      ],
      refresh: { mode: 'schedule', cron: '0 8 * * 1', timezone: 'Europe/Paris' },
      sweeping: false,
      computed_count: 0,
    })
    expect(typeof body.next_sweep_at).toBe('string')
  })

  it('is read-only for everyone, in /meta and in writing', async () => {
    const meta = await app.request(`${V1}/meta/bases/${base}`, { headers: auth() })
    const tables = (
      await read<{
        data: {
          tables: Array<{ name: string; fields: Array<{ name: string; read_only: boolean }> }>
        }
      }>(meta)
    ).data.tables
    const field = tables[0].fields.find((f) => f.name === 'resume')
    expect(field?.read_only).toBe(true)

    const written = await app.request(
      `${V1}/data/${base}/visites`,
      json('POST', { values: { nom: 'A', resume: 'à la main' } }),
    )
    expect((await read<{ code: string }>(written)).code).toBe('FIELD_NOT_WRITABLE')
  })

  it('changes its schedule with a fresh consent, within the allowed pace', async () => {
    const tooOften = await app.request(
      `${FIELDS()}/resume/ai`,
      json('PUT', {
        ...AI,
        refresh: { mode: 'schedule', cron: '*/5 * * * *', timezone: 'Europe/Paris' },
        consent: true,
      }),
    )
    expect(tooOften.status).toBe(400)
    expect((await read<{ details: { reason: string } }>(tooOften)).details.reason).toBe(
      'frequence_trop_haute',
    )

    const noConsent = await app.request(
      `${FIELDS()}/resume/ai`,
      json('PUT', { ...AI, refresh: { mode: 'if_empty' } }),
    )
    expect(noConsent.status).toBe(409)

    const changed = await app.request(
      `${FIELDS()}/resume/ai`,
      json('PUT', { ...AI, refresh: { mode: 'if_empty' }, consent: true, recompute: true }),
    )
    expect(changed.status).toBe(200)
    expect((await read<{ data: Record<string, unknown> }>(changed)).data).toMatchObject({
      refresh: { mode: 'if_empty', cron: null, timezone: null },
      next_sweep_at: null,
      sweeping: true,
    })
  })

  it('schedules a recomputation of every row', async () => {
    const run = await app.request(`${FIELDS()}/resume/ai/run`, json('POST', {}))
    expect(run.status).toBe(202)
    expect((await read<{ data: unknown }>(run)).data).toEqual({ scheduled: true })

    const notAi = await app.request(`${FIELDS()}/nom/ai/run`, json('POST', {}))
    expect(notAi.status).toBe(400)
  })

  it('previews a schedule in the author’s zone, and refuses what it would refuse', async () => {
    const preview = await app.request(
      `${V1}/ai/schedule/preview`,
      json('POST', { cron: '0 8 * * 1-5', timezone: 'Europe/Paris' }),
    )
    expect(preview.status).toBe(200)
    const runs = (await read<{ data: { runs: string[] } }>(preview)).data.runs
    expect(runs).toHaveLength(5)
    const paris = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(new Set(runs.map((r) => paris.format(new Date(r))))).toEqual(new Set(['08:00']))

    for (const [cron, reason] of [
      ['* * * * *', 'frequence_trop_haute'],
      ['0 0 31 2 *', 'cron_sans_date'],
      ['0 8 * *', 'cron_invalide'],
    ]) {
      const refused = await app.request(
        `${V1}/ai/schedule/preview`,
        json('POST', { cron, timezone: 'Europe/Paris' }),
      )
      expect(refused.status, cron).toBe(400)
      expect((await read<{ details: { reason: string } }>(refused)).details.reason).toBe(reason)
    }

    const anonymous = await app.request(`${V1}/ai/schedule/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cron: '0 8 * * *' }),
    })
    expect(anonymous.status).toBe(401)
  })
})

describe('the copilot route', () => {
  it('refuses a conversation it cannot read, and a caller it does not know', async () => {
    const url = `${V1}/ai/bases/${base}/copilot`
    for (const body of [
      {},
      { messages: 'bonjour' },
      { messages: [{ role: 'system', content: 'x' }] },
      { messages: [{ role: 'user', content: 'x' }], read_data: 'oui' },
      { messages: [{ role: 'user', content: 'x' }], table: 3 },
    ]) {
      const refused = await app.request(url, json('POST', body))
      expect(refused.status, JSON.stringify(body)).toBe(400)
    }
    const anonymous = await app.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }),
    })
    expect(anonymous.status).toBe(401)
  })
})
