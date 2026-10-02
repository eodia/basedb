import { mkdtemp, rm } from 'node:fs/promises'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Kernel, type MailMessage, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Automations that wait, react to more and do more — chapter 17.
 *
 * What these guard: a deleted row triggers what watches deletions, cited as it was; a row
 * entering a filter triggers once, and again only after leaving it; a date coming due
 * triggers; an outside call to an automation's own address does, with what it sent; a
 * step deletes, counts and adds up, starts another automation, makes a PDF; a branch tests
 * a value; an attempt goes down its second way when its first fails, a webhook tries
 * again; a wait keeps the run until its time, and the run goes on reading its rows anew;
 * a mail goes to all together, in copy, in HTML, with its attachments.
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
let directory = ''
const sent: MailMessage[] = []

/** A service on this machine: answers 503 while `failures` lasts, then 200. */
let failures = 0
let calls = 0
let stub: ReturnType<typeof createServer>
let origin = ''

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

beforeAll(async () => {
  stub = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.resume()
    req.on('end', () => {
      calls++
      if (failures > 0) {
        failures--
        res.writeHead(503).end('occupé')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
    })
  })
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', () => resolve()))
  origin = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`
  directory = await mkdtemp(join(tmpdir(), 'basedb-automations-'))

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    webhookTargets: { allowHttp: true, allowPrivate: true },
    files: { storage: { driver: 'local', directory }, maxBytes: 10 * 1024 * 1024 },
    mailer: async (message) => {
      sent.push(message)
    },
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
  await data(
    await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
      label: 'Tâches',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    }),
  )
  const field = (body: unknown) =>
    call(`${V1}/admin/bases/${base}/tables/taches/fields`, 'POST', body)
  for (const body of [
    {
      label: 'Statut',
      kind: 'select',
      options: [
        { value: 'a_faire', label: 'À faire' },
        { value: 'fait', label: 'Fait' },
      ],
    },
    { label: 'Montant', kind: 'number' },
    { label: 'Échéance', kind: 'date' },
    { label: 'Pièces', kind: 'file' },
    { label: 'Contact', kind: 'email' },
  ]) {
    expect((await field(body)).status).toBe(201)
  }
  await data(
    await call(`${V1}/admin/bases/${base}/tables`, 'POST', {
      label: 'Journal',
      fields: [{ label: 'Entrée', kind: 'short_text' }],
    }),
  )
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await kernel?.close()
  await container?.stop()
  await new Promise((resolve) => stub?.close(resolve))
  if (directory !== '') await rm(directory, { recursive: true, force: true })
})

const AUTOMATIONS = () => `${V1}/admin/bases/${base}/automations`
const TASKS = () => `${V1}/data/${base}/taches`
const JOURNAL = () => `${V1}/data/${base}/journal`

/** What a write triggers, run to its end. */
async function settle() {
  await kernel.drainHistory()
  while ((await kernel.runAutomations()) > 0) await kernel.drainHistory()
  await kernel.drainHistory()
}

interface Run {
  trigger: string
  status: string
  reason: string | null
  error_code: string | null
  resume_at: string | null
  steps: Array<{
    step: string
    kind: string
    status: string
    path?: string | null
    detail?: string
  }>
}
const runsOf = async (id: string) => data<Run[]>(await call(`${AUTOMATIONS()}/${id}/runs`))
const journal = async () =>
  (
    await data<Array<{ entree: string }>>(await call(`${JOURNAL()}?sort=_created_at&limit=200`))
  ).map((r) => r.entree)
const task = async (values: Record<string, unknown>) =>
  (await data<{ _id: string }>(await call(TASKS(), 'POST', { values })))._id
const automation = async (body: Record<string, unknown>) =>
  data<{ id: string; hook: { path: string } | null }>(await call(AUTOMATIONS(), 'POST', body))
const switchOff = (id: string) => call(`${AUTOMATIONS()}/${id}`, 'PATCH', { enabled: false })
const note = (entree: string) => ({
  kind: 'create_record',
  table: 'journal',
  values: { entree },
})

describe('new triggers', () => {
  it('a deleted row triggers what watches deletions, cited as it was — and is not acted on', async () => {
    const refused = await call(AUTOMATIONS(), 'POST', {
      label: 'Impossible',
      trigger: { kind: 'record_deleted', table: 'taches' },
      actions: [{ kind: 'update_record', values: { nom: 'x' } }],
    })
    expect(refused.status).toBe(400)
    expect(((await refused.json()) as { details: { reason: string } }).details.reason).toBe(
      'ligne_supprimee',
    )

    const a = await automation({
      label: 'Trace des suppressions',
      trigger: { kind: 'record_deleted', table: 'taches' },
      actions: [note('Supprimée : {{nom}} ({{montant}})')],
    })
    const id = await task({ nom: 'Vieille facture', montant: 42 })
    await settle()
    expect((await call(`${TASKS()}/${id}`, 'DELETE')).status).toBe(204)
    await settle()
    expect(await journal()).toContain('Supprimée : Vieille facture (42)')
    expect((await runsOf(a.id))[0]).toMatchObject({
      trigger: 'record_deleted',
      status: 'succeeded',
    })
    await switchOff(a.id)
  })

  it('a row entering a filter triggers once, and again only after leaving it', async () => {
    const refused = await call(AUTOMATIONS(), 'POST', {
      label: 'Sans filtre',
      trigger: { kind: 'record_matches', table: 'taches' },
      actions: [note('x')],
    })
    expect(((await refused.json()) as { details: { reason: string } }).details.reason).toBe(
      'condition_requise',
    )

    const a = await automation({
      label: 'Terminées',
      trigger: { kind: 'record_matches', table: 'taches' },
      condition: 'statut eq "fait"',
      actions: [note('Terminée : {{nom}}')],
    })
    const id = await task({ nom: 'Rapport', statut: 'a_faire' })
    await settle()
    expect(await runsOf(a.id)).toHaveLength(0)
    await call(`${TASKS()}/${id}`, 'PATCH', { values: { statut: 'fait' } })
    await settle()
    await call(`${TASKS()}/${id}`, 'PATCH', { values: { montant: 10 } })
    await settle()
    expect(await runsOf(a.id)).toHaveLength(1)
    await call(`${TASKS()}/${id}`, 'PATCH', { values: { statut: 'a_faire' } })
    await settle()
    await call(`${TASKS()}/${id}`, 'PATCH', { values: { statut: 'fait' } })
    await settle()
    expect(await runsOf(a.id)).toHaveLength(2)
    expect((await journal()).filter((e) => e === 'Terminée : Rapport')).toHaveLength(2)
    await switchOff(a.id)
  })

  it('a date coming due triggers, at its time, for each row it fell on', async () => {
    const now = new Date()
    const at = new Date(now.getTime() - 5 * 60_000)
    const time = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`
    const today = at.toISOString().slice(0, 10)
    const a = await automation({
      label: 'Échéances',
      trigger: {
        kind: 'date_reached',
        table: 'taches',
        date: { field: 'echeance', offset_days: 0, at: time, timezone: 'UTC' },
      },
      actions: [note('Échue : {{nom}}')],
    })
    await task({ nom: 'Due aujourd’hui', echeance: today })
    await task({
      nom: 'Due demain',
      echeance: new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10),
    })
    await settle()
    // As if it had last looked an hour ago.
    await sql.query(
      `UPDATE _basedb.automation SET scanned_until = now() - interval '1 hour', next_run_at = now()
        WHERE id = $1`,
      [a.id],
    )
    await settle()
    const entries = await journal()
    expect(entries).toContain('Échue : Due aujourd’hui')
    expect(entries).not.toContain('Échue : Due demain')
    expect((await runsOf(a.id)).map((r) => r.trigger)).toEqual(['date_reached'])
    await switchOff(a.id)
  })

  it('an outside call to its own address triggers it, with what it sent', async () => {
    const a = await automation({
      label: 'Commandes',
      trigger: { kind: 'webhook' },
      actions: [note('Commande de {{trigger.client.nom}} : {{trigger.total}}')],
    })
    expect(a.hook?.path).toMatch(/^\/api\/v1\/hooks\/[A-Za-z0-9_-]{20,}$/)
    const path = a.hook?.path ?? ''
    const answer = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client: { nom: 'Dupont' }, total: 120 }),
    })
    expect(answer.status).toBe(202)
    await settle()
    expect(await journal()).toContain('Commande de Dupont : 120')

    // A new address: the old one stops at once.
    const renewed = await data<{ hook: { path: string } }>(
      await call(`${AUTOMATIONS()}/${a.id}`, 'PATCH', { regenerate_hook: true }),
    )
    expect(renewed.hook.path).not.toBe(path)
    expect((await app.request(path, { method: 'POST', body: '{}' })).status).toBe(404)
    expect(
      (await app.request('/api/v1/hooks/inconnu-0123456789abcdef', { method: 'POST' })).status,
    ).toBe(404)
    await switchOff(a.id)
  })
})

describe('new steps', () => {
  it('counts and adds up, then a branch tests the value', async () => {
    await task({ nom: 'Lot A', statut: 'fait', montant: 100 })
    await task({ nom: 'Lot B', statut: 'fait', montant: 250 })
    const a = await automation({
      label: 'Bilan',
      trigger: { kind: 'button', table: 'taches' },
      actions: [
        {
          id: 'e1',
          kind: 'aggregate',
          table: 'taches',
          filter: 'statut eq "fait" and nom starts_with "Lot"',
          measures: [
            { fn: 'sum', field: 'montant' },
            { fn: 'max', field: 'montant' },
          ],
        },
        {
          id: 'e2',
          kind: 'branch',
          paths: [
            {
              label: 'Beaucoup',
              when: { value: '{{e1.somme.montant}}', op: 'gte', operand: '300' },
              steps: [
                note(
                  'Bilan : {{e1.nombre}} lots, {{e1.somme.montant}} au total, au plus {{e1.max.montant}}',
                ),
              ],
            },
            { label: 'Sinon', when: null, steps: [note('Bilan maigre')] },
          ],
        },
      ],
    })
    const id = await task({ nom: 'Déclencheur' })
    expect((await call(`${V1}/automations/${a.id}/run`, 'POST', { record: id })).status).toBe(202)
    await settle()
    expect(await journal()).toContain('Bilan : 2 lots, 350 au total, au plus 250')
    await switchOff(a.id)
  })

  it('deletes a row, and starts another automation on a row', async () => {
    const child = await automation({
      label: 'Enfant',
      trigger: { kind: 'button', table: 'taches' },
      actions: [note('Enfant pour {{nom}}')],
    })
    const parent = await automation({
      label: 'Parent',
      trigger: { kind: 'button', table: 'taches' },
      actions: [
        { id: 'e1', kind: 'find_record', table: 'taches', filter: 'nom eq "À jeter"' },
        { id: 'e2', kind: 'delete_record', record: 'e1' },
        { id: 'e3', kind: 'run_automation', automation: child.id, record: 'trigger' },
      ],
    })
    await task({ nom: 'À jeter' })
    const id = await task({ nom: 'Parent de tout' })
    await call(`${V1}/automations/${parent.id}/run`, 'POST', { record: id })
    await settle()
    const left = await data<unknown[]>(
      await call(`${TASKS()}?filter=${encodeURIComponent('nom eq "À jeter"')}`),
    )
    expect(left).toHaveLength(0)
    expect(await journal()).toContain('Enfant pour Parent de tout')
    expect((await runsOf(child.id))[0]).toMatchObject({
      trigger: 'automation',
      status: 'succeeded',
    })
    // An automation may not start itself.
    const self = await call(`${AUTOMATIONS()}/${parent.id}`, 'PATCH', {
      actions: [{ kind: 'run_automation', automation: parent.id, record: 'trigger' }],
    })
    expect(((await self.json()) as { details: { reason: string } }).details.reason).toBe(
      'automation_elle_meme',
    )
    await switchOff(parent.id)
    await switchOff(child.id)
  })

  it('an attempt goes down its second way when its first fails; a webhook tries again', async () => {
    const a = await automation({
      label: 'Essai',
      trigger: { kind: 'button', table: 'taches' },
      actions: [
        {
          id: 'e1',
          kind: 'attempt',
          paths: [
            { steps: [{ id: 'e2', kind: 'webhook', url: `${origin}/a`, retries: 0 }] },
            { steps: [note('Échec de {{e1.etape}} : {{e1.erreur}}')] },
          ],
        },
        { id: 'e4', kind: 'webhook', url: `${origin}/b`, retries: 2 },
        note('Fini'),
      ],
    })
    const id = await task({ nom: 'Appel' })
    failures = 2
    calls = 0
    await call(`${V1}/automations/${a.id}/run`, 'POST', { record: id })
    await settle()
    // The first call fails once, untried again; the second one fails once more, then passes.
    expect(calls).toBe(3)
    const entries = await journal()
    expect(entries).toContain('Échec de e2 : AUTOMATION_WEBHOOK_FAILED')
    expect(entries).toContain('Fini')
    const [run] = await runsOf(a.id)
    expect(run?.status).toBe('succeeded')
    expect(run?.steps.find((s) => s.step === 'e1')).toMatchObject({
      kind: 'attempt',
      detail: 'En cas d’échec',
    })
    await switchOff(a.id)
  }, 60_000)

  it('a wait keeps the run until its time; it goes on reading its rows anew', async () => {
    const inLoop = await call(AUTOMATIONS(), 'POST', {
      label: 'Attente en boucle',
      trigger: { kind: 'button', table: 'taches' },
      actions: [
        {
          kind: 'for_each',
          table: 'taches',
          steps: [{ kind: 'wait', duration: { amount: 1, unit: 'days' } }],
        },
      ],
    })
    expect(((await inLoop.json()) as { details: { reason: string } }).details.reason).toBe(
      'attente_dans_boucle',
    )

    const a = await automation({
      label: 'Relance',
      trigger: { kind: 'button', table: 'taches' },
      actions: [
        note('Avant : {{nom}}'),
        { id: 'e2', kind: 'wait', duration: { amount: 3, unit: 'days' } },
        note('Après : {{nom}}'),
      ],
    })
    const id = await task({ nom: 'Devis 12' })
    await call(`${V1}/automations/${a.id}/run`, 'POST', { record: id })
    await settle()
    const [waiting] = await runsOf(a.id)
    expect(waiting?.status).toBe('waiting')
    expect(Date.parse(waiting?.resume_at ?? '')).toBeGreaterThan(Date.now() + 2 * 86_400_000)
    expect(await journal()).toContain('Avant : Devis 12')
    expect(await journal()).not.toContain('Après : Devis 12')

    // Meanwhile the row changes; when its time comes, the run reads it as it is.
    await call(`${TASKS()}/${id}`, 'PATCH', { values: { nom: 'Devis 12 bis' } })
    await sql.query(
      `UPDATE _basedb.automation_run SET resume_at = now() - interval '1 second'
        WHERE automation_id = $1 AND status = 'waiting'`,
      [a.id],
    )
    await settle()
    expect(await journal()).toContain('Après : Devis 12 bis')
    const [after] = await runsOf(a.id)
    expect(after?.status).toBe('succeeded')
    expect(after?.steps.map((s) => s.step)).toEqual(['e1', 'e2', 'e3'])

    // Switched off while waiting: the run does not go on.
    await call(`${V1}/automations/${a.id}/run`, 'POST', { record: id })
    await settle()
    await switchOff(a.id)
    expect((await runsOf(a.id))[0]).toMatchObject({ status: 'skipped', reason: 'desactivee' })
  })

  it('makes a PDF, adds it to a field, and mails it to all together, in copy, in HTML', async () => {
    const a = await automation({
      label: 'Envoi du devis',
      trigger: { kind: 'button', table: 'taches' },
      actions: [
        {
          id: 'e1',
          kind: 'document',
          record: 'trigger',
          template: null,
          field: 'pieces',
          name: 'Devis {{nom}}',
        },
        {
          id: 'e2',
          kind: 'email',
          record: 'trigger',
          email_field: 'contact',
          addresses: ['compta@exemple.fr'],
          mode: 'together',
          cc: ['direction@exemple.fr'],
          reply_to: '{{contact}}',
          format: 'html',
          subject: 'Votre devis {{nom}}',
          message: '<p>Bonjour, voici le devis <strong>{{nom}}</strong>.</p>',
          attachments: [{ step: 'e1' }],
        },
      ],
    })
    const id = await task({ nom: 'Toit & <fenêtres>', contact: 'client@exemple.fr' })
    await call(`${V1}/automations/${a.id}/run`, 'POST', { record: id })
    await settle()
    expect((await runsOf(a.id))[0]?.status).toBe('succeeded')
    const row = await data<{ pieces: Array<{ name: string }> }>(await call(`${TASKS()}/${id}`))
    // What a file name may not hold becomes a space.
    expect(row.pieces.map((p) => p.name)).toEqual(['Devis Toit & fenêtres.pdf'])

    await sql.query(`UPDATE _basedb.mail_outbox SET not_before = now() WHERE status = 'pending'`)
    await kernel.deliverMails()
    const mail = sent.at(-1)
    expect(mail?.to).toBe('compta@exemple.fr')
    expect(mail?.also).toEqual(['client@exemple.fr'])
    expect(mail?.cc).toEqual(['direction@exemple.fr'])
    expect(mail?.replyTo).toBe('client@exemple.fr')
    expect(mail?.html).toContain('<strong>Toit &amp; &lt;fenêtres&gt;</strong>')
    expect(mail?.body).toContain('voici le devis Toit & <fenêtres>')
    expect(mail?.attachments?.[0]?.name).toBe('Devis Toit & fenêtres.pdf')
    expect(
      Buffer.from(mail?.attachments?.[0]?.bytes ?? [])
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-')
    await switchOff(a.id)
  })
})
