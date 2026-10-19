import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * The buttons of a table's toolbar — chapter 11 §1.6.
 *
 * What these guard: a button opens an address or starts an automation whose trigger fits
 * its target; pressing it queues one run per row ticked, per row of the view on screen,
 * or one with no row; rows outside the target, or past what one press may start, are
 * refused whole; the automation's hourly budget still holds.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let sql: pg.Client
let access = ''
let base = ''
let onRow = ''
let elsewhere = ''
let noRow = ''
const rows: string[] = []

const call = (path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
async function data<T>(r: Response): Promise<T> {
  const text = await r.text()
  if (r.status >= 300) throw new Error(`${r.status} ${text}`)
  return (JSON.parse(text) as { data: T }).data
}
async function refusal(r: Response): Promise<{ status: number; code: string; details: never }> {
  const body = (await r.json()) as { code: string; details: never }
  return { status: r.status, code: body.code, details: body.details }
}

const BUTTONS = () => `${V1}/data/${base}/taches/buttons`
type Button = {
  id: string
  label: string
  action: string
  target: string
  url: string | null
  automation: { id: string; label: string } | null
  confirm: boolean
}
const runsOf = async (automation: string) =>
  (
    await sql.query<{ record_id: string | null }>(
      'SELECT record_id::text FROM _basedb.automation_run WHERE automation_id = $1',
      [automation],
    )
  ).rows.map((r) => r.record_id)
const clearRuns = () => sql.query('DELETE FROM _basedb.automation_run')

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const { Client } = await import('pg')
  sql = new Client({ connectionString: container.getConnectionUri() })
  await sql.connect()

  const boot = await kernel.bootstrap({ tenantRef: TENANT_REF, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  app = createApp({ kernel })
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@basedb.local', password: PASSWORD }),
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
  for (const label of ['Tâches', 'Journal']) {
    await data(
      await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
        label,
        fields: [{ label: label === 'Journal' ? 'Entrée' : 'Nom', kind: 'short_text' }],
      }),
    )
  }
  for (let i = 1; i <= 120; i++) {
    const created = await data<{ _id: string }>(
      await call(`${V1}/data/${base}/taches`, 'POST', {
        values: { nom: i <= 3 ? `Urgent ${i}` : `Tâche ${i}` },
      }),
    )
    rows.push(created._id)
  }
  const automation = async (body: Record<string, unknown>) =>
    (await data<{ id: string }>(await call(`${V1}/admin/bases/${base}/automations`, 'POST', body)))
      .id
  const note = { kind: 'create_record', table: 'journal', values: { entree: 'clic' } }
  onRow = await automation({
    label: 'Sur la ligne',
    trigger: { kind: 'button', table: 'taches' },
    actions: [note],
  })
  elsewhere = await automation({
    label: 'Sur le journal',
    trigger: { kind: 'button', table: 'journal' },
    actions: [note],
  })
  noRow = await automation({ label: 'Sans ligne', trigger: { kind: 'webhook' }, actions: [note] })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await kernel?.close()
  await container?.stop()
})

describe('setting a button', () => {
  it('opens an address, or starts an automation that fits its target', async () => {
    const link = await data<Button>(
      await call(BUTTONS(), 'POST', {
        label: 'Aide',
        action: 'url',
        url: 'https://exemple.fr/aide',
      }),
    )
    expect(link).toMatchObject({ action: 'url', url: 'https://exemple.fr/aide', automation: null })
    const run = await data<Button>(
      await call(BUTTONS(), 'POST', {
        label: 'Relancer',
        action: 'automation',
        automation: onRow,
        target: 'selection',
        confirm: true,
        color: '#16A34A',
      }),
    )
    expect(run).toMatchObject({
      target: 'selection',
      confirm: true,
      automation: { id: onRow, label: 'Sur la ligne' },
    })
    const list = await data<Button[]>(await call(BUTTONS()))
    expect(list.map((b) => b.label)).toEqual(['Aide', 'Relancer'])

    const renamed = await data<Button>(
      await call(`${BUTTONS()}/${link.id}`, 'PATCH', { label: 'Mode d’emploi' }),
    )
    expect(renamed).toMatchObject({ label: 'Mode d’emploi', url: 'https://exemple.fr/aide' })
    expect((await call(`${BUTTONS()}/${link.id}`, 'DELETE')).status).toBe(204)
    expect((await data<Button[]>(await call(BUTTONS()))).map((b) => b.label)).toEqual(['Relancer'])
  })

  it('refuses a script, an automation of another table, or a target that does not fit', async () => {
    const refused = async (body: Record<string, unknown>) =>
      (await refusal(await call(BUTTONS(), 'POST', { label: 'X', ...body }))).details
    expect(await refused({ action: 'url', url: 'javascript:alert(1)' })).toMatchObject({
      reason: 'adresse_invalide',
    })
    expect(
      await refused({ action: 'automation', automation: elsewhere, target: 'selection' }),
    ).toMatchObject({ reason: 'declencheur_bouton' })
    expect(
      await refused({ action: 'automation', automation: noRow, target: 'view' }),
    ).toMatchObject({ reason: 'declencheur_bouton' })
    expect(
      await refused({ action: 'automation', automation: onRow, target: 'none' }),
    ).toMatchObject({ reason: 'automatisation_sans_table' })
    expect(
      await refused({ action: 'automation', automation: onRow, target: 'partout' }),
    ).toMatchObject({ reason: 'cible_inconnue' })
  })
})

describe('pressing a button', () => {
  const button = async (target: string, automation: string) =>
    data<Button>(
      await call(BUTTONS(), 'POST', {
        label: `Lancer (${target})`,
        action: 'automation',
        automation,
        target,
      }),
    )
  const press = (id: string, body: unknown) => call(`${BUTTONS()}/${id}/press`, 'POST', body)

  it('starts one run per row ticked', async () => {
    await clearRuns()
    const b = await button('selection', onRow)
    const ticked = [rows[0], rows[1], rows[1], rows[5]] as string[]
    expect(await data<{ runs: number }>(await press(b.id, { records: ticked }))).toEqual({
      runs: 3,
    })
    expect((await runsOf(onRow)).sort()).toEqual([rows[0], rows[1], rows[5]].sort())
    expect((await refusal(await press(b.id, { records: [] }))).details).toMatchObject({
      reason: 'aucune_ligne',
    })
  })

  it('starts one run per row of the view, its filter included', async () => {
    await clearRuns()
    const b = await button('view', onRow)
    const pressed = await data<{ runs: number }>(
      await press(b.id, { filter: 'nom starts_with "Urgent"' }),
    )
    expect(pressed.runs).toBe(3)
    expect((await runsOf(onRow)).sort()).toEqual(rows.slice(0, 3).sort())
    // The whole table is past what one press may start: refused whole, nothing queued.
    await clearRuns()
    const all = await refusal(await press(b.id, {}))
    expect(all.details).toMatchObject({ reason: 'trop_de_lignes', maximum: 100 })
    expect(await runsOf(onRow)).toEqual([])
  })

  it('starts one run with no row, and holds to the hourly budget', async () => {
    await clearRuns()
    const b = await button('none', noRow)
    expect(await data<{ runs: number }>(await press(b.id, {}))).toEqual({ runs: 1 })
    expect(await runsOf(noRow)).toEqual([null])
    // Ninety-nine more runs this hour: the budget has none left.
    await sql.query(
      `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, status)
       SELECT $1, 'button', 'succeeded' FROM generate_series(1, 99)`,
      [noRow],
    )
    const spent = await refusal(await press(b.id, {}))
    expect(spent).toMatchObject({ status: 429, code: 'RATE_LIMIT_EXCEEDED' })
  })

  it('refuses a switched-off automation, and an address button', async () => {
    const b = await button('selection', onRow)
    await call(`${V1}/admin/bases/${base}/automations/${onRow}`, 'PATCH', { enabled: false })
    expect((await refusal(await press(b.id, { records: [rows[0]] }))).code).toBe(
      'AUTOMATION_DISABLED',
    )
    await call(`${V1}/admin/bases/${base}/automations/${onRow}`, 'PATCH', { enabled: true })
    const link = await data<Button>(
      await call(BUTTONS(), 'POST', { label: 'Site', action: 'url', url: 'https://exemple.fr' }),
    )
    expect((await refusal(await press(link.id, {}))).details).toMatchObject({
      reason: 'bouton_sans_automatisation',
    })
  })
})
