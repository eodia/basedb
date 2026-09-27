import { type Kernel, type ProviderTransport, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Automations over HTTP — chapter 17.
 *
 * What these guard: a row written triggers what watches it, on its owner's authority, and
 * says so in the history; a condition stops a run; an automation's own write triggers no
 * other; a button runs one for a row; a clock runs one when due; a definition naming what
 * does not exist is refused when saved. A flow searches, branches down the first path
 * that holds, cites what its steps found or wrote, and keeps each step it passed; one
 * saved before flows reads as it did. An AI step asks the provider with what came before,
 * once its author consented, and its answer is cited by the steps after it.
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
  steps: Array<{
    step: string
    kind: string
    status: string
    path?: string | null
    detail?: string
  }>
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

describe('a flow', () => {
  let flow = ''
  const JOURNAL = () => `${V1}/data/${base}/journal`

  it('is saved with an identifier for each step and path, and its citations checked', async () => {
    const created = await call(AUTOMATIONS(), 'POST', {
      label: 'Aiguillage',
      trigger: { kind: 'record_created', table: 'taches' },
      actions: [
        { kind: 'find_record', table: 'journal', filter: 'entree eq {{nom}}' },
        {
          kind: 'branch',
          paths: [
            {
              label: 'Faite d’emblée',
              when: { record: 'trigger', condition: 'statut eq "fait"' },
              steps: [{ kind: 'update_record', values: { note: 'déjà faite' } }],
            },
            {
              label: 'Déjà au journal',
              when: { record: 'e1', condition: '' },
              steps: [
                { kind: 'update_record', record: 'e1', values: { entree: '{{e1.entree}} (bis)' } },
              ],
            },
            {
              when: null,
              steps: [
                {
                  id: 'ecrire',
                  kind: 'create_record',
                  table: 'journal',
                  values: { entree: '{{nom}}' },
                },
                { kind: 'update_record', values: { note: 'journal {{ecrire._id}}' } },
              ],
            },
          ],
        },
      ],
    })
    expect(created.status).toBe(201)
    const automation = await data<{
      id: string
      actions: Array<{ id: string; kind: string; paths?: Array<Record<string, unknown>> }>
    }>(created)
    flow = automation.id
    expect(automation.actions.map((s) => s.id)).toEqual(['e1', 'e2'])
    expect(automation.actions[1]?.paths?.map((p) => [p.id, p.label])).toEqual([
      ['c1', 'Faite d’emblée'],
      ['c2', 'Déjà au journal'],
      ['c3', 'Sinon'],
    ])
    expect(automation.actions[1]?.paths?.[2]?.steps).toMatchObject([
      { id: 'ecrire', kind: 'create_record' },
      // Numbered in the order the flow is read: e3 and e4 are in the paths above.
      { id: 'e5', kind: 'update_record', record: 'trigger' },
    ])

    // What a path wrote is not there after the branch: it may not have run.
    const after = await call(AUTOMATIONS(), 'POST', {
      label: 'Trop tôt',
      trigger: { kind: 'record_created', table: 'taches' },
      actions: [
        {
          kind: 'branch',
          paths: [
            {
              when: { condition: 'statut eq "fait"' },
              steps: [{ id: 'dedans', kind: 'find_record', table: 'journal' }],
            },
          ],
        },
        { id: 'apres', kind: 'update_record', values: { note: '{{dedans.entree}}' } },
      ],
    })
    expect(after.status).toBe(400)
    expect(await after.json()).toMatchObject({
      details: { reason: 'etape_inconnue', detail: 'dedans', step: 'apres' },
    })

    const otherwise = await call(AUTOMATIONS(), 'POST', {
      label: 'Sinon d’abord',
      trigger: { kind: 'record_created', table: 'taches' },
      actions: [
        {
          kind: 'branch',
          paths: [{ when: null }, { when: { condition: 'statut eq "fait"' } }],
        },
      ],
    })
    expect(await otherwise.json()).toMatchObject({ details: { reason: 'sinon_en_dernier' } })

    const unknownRow = await call(AUTOMATIONS(), 'POST', {
      label: 'Ligne absente',
      trigger: { kind: 'record_created', table: 'taches' },
      actions: [{ kind: 'update_record', record: 'e9', values: { note: 'x' } }],
    })
    expect(await unknownRow.json()).toMatchObject({
      details: { reason: 'etape_inconnue', detail: 'e9' },
    })
  })

  it('takes the other way when nothing is found, and passes what it wrote along', async () => {
    const row = await data<{ _id: string }>(
      await call(TASKS(), 'POST', { values: { nom: 'Poncer' } }),
    )
    await settle()
    const journal = await data<Array<{ _id: string; entree: string }>>(await call(JOURNAL()))
    const written = journal.find((j) => j.entree === 'Poncer')
    expect(written).toBeDefined()
    const task = await data<Record<string, unknown>>(await call(`${TASKS()}/${row._id}`))
    expect(task.note).toBe(`journal ${written?._id}`)

    const [run] = await runsOf(flow)
    expect(run?.status).toBe('succeeded')
    expect(run?.steps.map((s) => [s.step, s.status, s.path ?? s.detail])).toEqual([
      ['e1', 'succeeded', 'aucune'],
      ['e2', 'succeeded', 'c3'],
      ['ecrire', 'succeeded', written?._id],
      ['e5', 'succeeded', 'note'],
    ])
  })

  it('takes the way that holds: a row found, a condition met', async () => {
    await call(TASKS(), 'POST', { values: { nom: 'Poncer' } })
    await settle()
    const journal = await data<Array<{ entree: string }>>(await call(JOURNAL()))
    expect(journal.map((j) => j.entree)).toContain('Poncer (bis)')
    const [found] = await runsOf(flow)
    expect(found?.steps.find((s) => s.kind === 'branch')?.path).toBe('c2')

    const done = await data<{ _id: string }>(
      await call(TASKS(), 'POST', { values: { nom: 'Ébarber', statut: 'fait' } }),
    )
    await settle()
    expect((await data<Record<string, unknown>>(await call(`${TASKS()}/${done._id}`))).note).toBe(
      'déjà faite',
    )
    const [met] = await runsOf(flow)
    expect(met?.steps.find((s) => s.kind === 'branch')?.path).toBe('c1')
  })

  it('reads a definition saved before flows as it always ran', async () => {
    await client.query(
      'UPDATE _basedb.automation SET is_enabled = false, actions = $2::jsonb WHERE id = $1',
      [flow, JSON.stringify([{ kind: 'update_record', values: { note: 'ancienne' } }])],
    )
    const list = await data<Array<{ id: string; actions: unknown[] }>>(await call(AUTOMATIONS()))
    expect(list.find((a) => a.id === flow)?.actions).toEqual([
      { id: 'e1', kind: 'update_record', record: 'trigger', values: { note: 'ancienne' } },
    ])
  })
})

describe('an AI step', () => {
  let automation = ''
  const asked: Array<{ instruction: string; format: unknown }> = []
  /** The provider, stood in for: a choice when one is asked, a summary otherwise. */
  const transport: ProviderTransport = async (request) => {
    const instruction = String(request.payload.instruction)
    asked.push({ instruction, format: request.payload.expected_format })
    const value = request.payload.expected_format === undefined ? `Résumé : ${instruction}` : 'fait'
    return { text: JSON.stringify({ value }), inputTokens: 12, outputTokens: 4 }
  }
  const settleWith = async (aiTransport?: ProviderTransport) => {
    await kernel.drainHistory()
    while ((await kernel.runAutomations(aiTransport === undefined ? {} : { aiTransport })) > 0) {
      await kernel.drainHistory()
    }
  }

  beforeAll(() => {
    process.env.BASEDB_AI_PROVIDER = 'anthropic'
    process.env.BASEDB_AI_MODEL = 'modele-de-test'
    process.env.BASEDB_AI_API_KEY = 'cle-de-test'
  })
  afterAll(() => {
    for (const name of ['BASEDB_AI_PROVIDER', 'BASEDB_AI_MODEL', 'BASEDB_AI_API_KEY']) {
      Reflect.deleteProperty(process.env, name)
    }
  })

  it('is refused without consent, or where no AI is configured', async () => {
    const refused = await call(AUTOMATIONS(), 'POST', {
      label: 'Sans accord',
      trigger: { kind: 'record_created', table: 'journal' },
      actions: [{ kind: 'ai', prompt: 'Résume {{entree}}' }],
    })
    expect(await refused.json()).toMatchObject({
      code: 'AI_CONSENT_REQUIRED',
      details: { reason: 'consentement_requis', step: 'e1' },
    })

    // A step that could never run is refused when written: no AI on the instance.
    Reflect.deleteProperty(process.env, 'BASEDB_AI_PROVIDER')
    const off = await call(AUTOMATIONS(), 'POST', {
      label: 'Sans IA',
      trigger: { kind: 'record_created', table: 'journal' },
      actions: [{ kind: 'ai', prompt: 'Résume {{entree}}', consent: true }],
    })
    process.env.BASEDB_AI_PROVIDER = 'anthropic'
    expect(await off.json()).toMatchObject({ code: 'AI_DISABLED', details: { step: 'e1' } })
  })

  it('asks the provider with what came before, and passes its answer along', async () => {
    const created = await call(AUTOMATIONS(), 'POST', {
      label: 'Tri par l’IA',
      trigger: { kind: 'record_created', table: 'journal' },
      actions: [
        {
          kind: 'ai',
          prompt: 'Cette entrée est-elle close ? {{entree}}',
          answer: 'select',
          options: ['À faire', 'Fait'],
          consent: true,
        },
        {
          kind: 'ai',
          prompt: 'Résume « {{entree}} » ({{e1.reponse}})',
          consent: true,
        },
        {
          kind: 'create_record',
          table: 'taches',
          values: { nom: 'Suite de {{entree}}', note: '{{e2.reponse}}', statut: '{{e1.reponse}}' },
        },
      ],
    })
    expect(created.status).toBe(201)
    const saved = await data<{ id: string; actions: Array<Record<string, unknown>> }>(created)
    automation = saved.id
    expect(saved.actions[0]).toMatchObject({
      id: 'e1',
      kind: 'ai',
      answer: 'select',
      options: ['À faire', 'Fait'],
      consent: true,
    })
    expect(saved.actions[1]).toMatchObject({ kind: 'ai', answer: 'long_text' })

    await call(`${V1}/data/${base}/journal`, 'POST', { values: { entree: 'Chaudière' } })
    await settleWith(transport)

    // The prompts, with the row's value and the first answer in place.
    expect(asked.map((a) => a.instruction)).toEqual([
      'Cette entrée est-elle close ? Chaudière',
      'Résume « Chaudière » (Fait)',
    ])
    expect(asked[0]?.format).toContain('« À faire », « Fait »')
    expect(asked[1]?.format).toBeUndefined()

    const tasks = await data<Array<Record<string, unknown>>>(await call(TASKS()))
    const task = tasks.find((t) => t.nom === 'Suite de Chaudière')
    // The choice the model named by its label is stored by the field's key.
    expect(task).toMatchObject({ statut: 'fait', note: 'Résumé : Résume « Chaudière » (Fait)' })

    const [run] = await runsOf(automation)
    expect(run?.status).toBe('succeeded')
    expect(run?.steps.map((s) => [s.step, s.kind, s.status])).toEqual([
      ['e1', 'ai', 'succeeded'],
      ['e2', 'ai', 'succeeded'],
      ['e3', 'create_record', 'succeeded'],
    ])

    // Logged as the automation's, not as a cell's.
    const { rows } = await client.query(
      `SELECT usage_kind, status, count(*)::int AS n FROM _basedb.ai_call
        GROUP BY usage_kind, status`,
    )
    expect(rows).toEqual([{ usage_kind: 'automation', status: 'accepted', n: 2 }])
  })

  it('fails, and says why, where no provider can be called', async () => {
    await call(`${V1}/data/${base}/journal`, 'POST', { values: { entree: 'Toiture' } })
    await settleWith()
    const [run] = await runsOf(automation)
    expect(run).toMatchObject({ status: 'failed', error_code: 'AI_NOT_CONFIGURED' })
    expect(run?.steps).toMatchObject([{ step: 'e1', status: 'failed' }])
  })
})
