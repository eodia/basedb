import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Automations over HTTP — chapter 17.
 *
 * What these guard: a row written triggers what watches it, on its owner's authority, and
 * says so in the history; a condition stops a run; an automation's own write triggers no
 * other; a button runs one for a row; a clock runs one when due; a definition naming what
 * does not exist is refused when saved.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let base = ''
let adminId = ''
let client: import('pg').Client

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
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
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
  adminId = rows[0].created_by
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
    await data<{ name: string }>(await call(`${V1}/admin/bases`, 'POST', { label: 'Atelier' }))
  ).name
  const tasks = await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Tâches',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Note', kind: 'short_text' },
    ],
  })
  expect(tasks.status).toBe(201)
  expect(
    (
      await call(`${V1}/admin/bases/${base}/tables/taches/fields`, 'POST', {
        label: 'Statut',
        kind: 'select',
        options: [
          { value: 'a_faire', label: 'À faire' },
          { value: 'fait', label: 'Fait' },
        ],
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await call(`${V1}/admin/bases/${base}/tables/taches/fields`, 'POST', {
        label: 'Responsable',
        kind: 'user',
      })
    ).status,
  ).toBe(201)
  const journal = await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Journal',
    fields: [{ label: 'Entrée', kind: 'short_text' }],
  })
  expect(journal.status).toBe(201)
}, 240_000)

afterAll(async () => {
  await client?.end()
  await kernel?.close()
  await container?.stop()
})

const AUTOMATIONS = () => `${V1}/admin/bases/${base}/automations`
const TASKS = () => `${V1}/data/${base}/taches`

/** What a write triggers, run to its end. */
async function settle() {
  await kernel.drainHistory()
  while ((await kernel.runAutomations()) > 0) {
    await kernel.drainHistory()
  }
  await kernel.drainHistory()
}

interface Run {
  status: string
  reason: string | null
  error_code: string | null
  steps: Array<{ action: string; status: string }>
}
const runsOf = async (id: string) => data<Run[]>(await call(`${AUTOMATIONS()}/${id}/runs`))

describe('an automation triggered by a row', () => {
  let closing = ''
  let watcher = ''
  let rowId = ''

  it('is saved with what it watches, and refused when it names what does not exist', async () => {
    const created = await call(AUTOMATIONS(), 'POST', {
      label: 'Clôture',
      trigger: { kind: 'record_updated', table: 'taches', fields: ['statut'] },
      condition: 'statut eq "fait"',
      actions: [
        { kind: 'update_record', values: { note: 'Clos : {{nom}}' } },
        { kind: 'create_record', table: 'journal', values: { entree: '{{nom}} est {{statut}}' } },
        { kind: 'notify', user_field: 'responsable', message: '{{nom}} est terminée' },
      ],
    })
    expect(created.status).toBe(201)
    const automation = await data<{
      id: string
      owner: { name: string }
      trigger: { kind: string; fields: string[] }
    }>(created)
    closing = automation.id
    expect(automation).toMatchObject({
      owner: { name: 'Bootstrap' },
      trigger: { kind: 'record_updated', fields: ['statut'] },
    })

    // Any change of the table, to see what an automation's own write does not trigger.
    const any = await call(AUTOMATIONS(), 'POST', {
      label: 'Tout changement',
      trigger: { kind: 'record_updated', table: 'taches' },
      actions: [{ kind: 'create_record', table: 'journal', values: { entree: 'vu' } }],
    })
    watcher = (await data<{ id: string }>(any)).id

    const unknown = await call(AUTOMATIONS(), 'POST', {
      label: 'Cassée',
      trigger: { kind: 'record_created', table: 'taches' },
      actions: [{ kind: 'update_record', values: { absent: 1 } }],
    })
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toMatchObject({
      details: { reason: 'champ_inconnu', detail: 'absent' },
    })
    const clock = await call(AUTOMATIONS(), 'POST', {
      label: 'Sans ligne',
      trigger: { kind: 'schedule', schedule: { every: 'day', at: '08:00' } },
      actions: [{ kind: 'update_record', values: { note: 'x' } }],
    })
    expect(await clock.json()).toMatchObject({ details: { reason: 'action_sans_ligne' } })
  })

  it('runs its actions on the owner’s authority when the row matches', async () => {
    const created = await call(TASKS(), 'POST', {
      values: { nom: 'Peindre', statut: 'a_faire', responsable: adminId },
    })
    rowId = (await data<{ _id: string }>(created))._id
    await call(`${TASKS()}/${rowId}`, 'PATCH', { values: { statut: 'fait' } })
    await settle()

    const row = await data<Record<string, unknown>>(await call(`${TASKS()}/${rowId}`))
    expect(row.note).toBe('Clos : Peindre')
    const journal = await data<Array<{ entree: string }>>(
      await call(`${V1}/data/${base}/journal?sort=_created_at`),
    )
    expect(journal.map((j) => j.entree)).toContain('Peindre est Fait')

    const [run] = await runsOf(closing)
    expect(run).toMatchObject({ status: 'succeeded' })
    expect(run?.steps.map((s) => s.status)).toEqual(['succeeded', 'succeeded', 'succeeded'])

    const notes = await data<Array<{ kind: string; excerpt: string }>>(
      await call(`${V1}/me/notifications`),
    )
    expect(notes[0]).toMatchObject({ kind: 'automation', excerpt: 'Peindre est terminée' })

    // The history says who wrote the note: the automation, on its owner's behalf.
    const history = await data<
      Array<{ actor: { kind: string; token_label: string | null; name: string } }>
    >(await call(`${TASKS()}/${rowId}/history`))
    expect(history[0]?.actor).toMatchObject({
      kind: 'automation',
      token_label: 'Clôture',
      name: 'Bootstrap',
    })
  })

  it('triggers nothing with its own write', async () => {
    // The person's change, once; the automation's note written after it, never.
    const runs = await runsOf(watcher)
    expect(runs).toHaveLength(1)
  })

  it('stops when the condition is false', async () => {
    await call(`${TASKS()}/${rowId}`, 'PATCH', { values: { statut: 'a_faire' } })
    await settle()
    const [last] = await runsOf(closing)
    expect(last).toMatchObject({ status: 'skipped', reason: 'condition_fausse' })
  })
})

describe('a button, a clock', () => {
  it('a button field runs its automation for the row, and has no value', async () => {
    const automation = await data<{ id: string }>(
      await call(AUTOMATIONS(), 'POST', {
        label: 'Relancer',
        trigger: { kind: 'button', table: 'taches' },
        actions: [{ kind: 'update_record', values: { note: 'relancée' } }],
      }),
    )
    const field = await call(`${V1}/admin/bases/${base}/tables/taches/fields`, 'POST', {
      label: 'Relance',
      kind: 'button',
      button: { label: 'Relancer', action: 'automation', automation: automation.id },
    })
    expect(field.status).toBe(201)

    const meta = await data<{
      tables: Array<{
        name: string
        fields: Array<{ name: string; kind: string; button?: unknown }>
      }>
    }>(await call(`${V1}/meta/bases/${base}`))
    const relance = meta.tables
      .find((t) => t.name === 'taches')
      ?.fields.find((f) => f.kind === 'button')
    expect(relance?.button).toMatchObject({ label: 'Relancer', action: 'automation' })

    const row = await data<Record<string, unknown>>(
      await call(TASKS(), 'POST', { values: { nom: 'Vernir' } }),
    )
    expect(row).not.toHaveProperty(relance?.name as string)
    const clicked = await call(`${V1}/automations/${automation.id}/run`, 'POST', {
      record: row._id,
    })
    expect(clicked.status).toBe(202)
    await settle()
    expect((await data<Record<string, unknown>>(await call(`${TASKS()}/${row._id}`))).note).toBe(
      'relancée',
    )

    // Switched off, the button says so.
    await call(`${AUTOMATIONS()}/${automation.id}`, 'PATCH', { enabled: false })
    const refused = await call(`${V1}/automations/${automation.id}/run`, 'POST', {
      record: row._id,
    })
    expect(refused.status).toBe(409)
    expect(await refused.json()).toMatchObject({ code: 'AUTOMATION_DISABLED' })
  })

  it('a schedule runs once when due', async () => {
    const automation = await data<{ id: string; next_run_at: string }>(
      await call(AUTOMATIONS(), 'POST', {
        label: 'Chaque matin',
        trigger: {
          kind: 'schedule',
          schedule: { every: 'day', at: '07:30', timezone: 'Europe/Paris' },
        },
        actions: [
          {
            kind: 'create_record',
            table: 'journal',
            values: { entree: 'bonjour {{_maintenant}}' },
          },
        ],
      }),
    )
    expect(new Date(automation.next_run_at).getTime()).toBeGreaterThan(Date.now())
    await client.query(
      `UPDATE _basedb.automation SET next_run_at = now() - interval '1 minute' WHERE id = $1`,
      [automation.id],
    )
    await settle()
    const [run] = await runsOf(automation.id)
    expect(run).toMatchObject({ status: 'succeeded' })
    const journal = await data<Array<{ entree: string }>>(await call(`${V1}/data/${base}/journal`))
    expect(journal.some((j) => j.entree.startsWith('bonjour 20'))).toBe(true)
  })
})
