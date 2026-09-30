import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { MailMessage } from '../../src/auth/operations.js'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Mail — chapter 16 §2.4 and chapter 17 §1.3: a notification left unread becomes one mail
 * per person, one read in time none at all; an automation's « Envoyer un courriel » is
 * queued with its text rendered, and goes by the operator's relay, retried when it fails.
 */

const TENANT = 't8mx3ks'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let silent: Kernel
let sql: pg.Client
let admin: RequestContext
let adminSession: string
let baseId: string
let tableId: string
let alice: string
let bob: string
const sent: MailMessage[] = []
let failing = false

const ctxOf = (k: Kernel, userId: string) =>
  k.openContext({ userId, requestId: randomUUID(), surface: 'rest' })

/** The queue's rows due now, as if their ten minutes were up. */
const bringForward = () =>
  sql.query(
    `UPDATE _basedb.mail_outbox SET not_before = clock_timestamp() WHERE status = 'pending'`,
  )

const outbox = async () =>
  (
    await sql.query<{ origin: string; recipient: string; status: string; attempts: number }>(
      'SELECT origin, recipient, status, attempts FROM _basedb.mail_outbox ORDER BY created_at',
    )
  ).rows

async function settle(k: Kernel) {
  await k.drainHistory()
  while ((await k.runAutomations()) > 0) await k.drainHistory()
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const common = {
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    publicUrl: 'https://basedb.exemple.fr/',
  }
  kernel = startKernel({
    ...common,
    mailer: async (message) => {
      if (failing) throw new Error('relais indisponible')
      sent.push(message)
    },
  })
  silent = startKernel(common)
  await kernel.migrateCatalog()
  sql = new pg.Client({ connectionString: container.getConnectionUri() })
  await sql.connect()

  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await ctxOf(kernel, boot.userId)
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  baseId = (await kernel.createBase(admin, { label: 'Ventes' })).baseId
  const table = await kernel.createTable(admin, {
    baseId,
    label: 'Commandes',
    fields: [
      { label: 'Numero', kind: 'short_text' },
      { label: 'Contact', kind: 'email' },
      { label: 'Responsable', kind: 'user' },
    ],
  })
  tableId = table.tableId
  const team = (await kernel.createGroup(admin, { label: 'Équipe', sessionId: adminSession })).id
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: team, scope: { kind: 'base', id: baseId }, level: 'edit' }],
    sessionId: adminSession,
  })
  const person = async (email: string, displayName: string) =>
    (
      await kernel.createUser(admin, {
        email,
        displayName,
        groupIds: [team],
        sessionId: adminSession,
      })
    ).user.id
  alice = await person('alice@exemple.fr', 'Alice Martin')
  bob = await person('bob@exemple.fr', 'Bob Durand')
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await silent?.close()
  await kernel?.close()
  await container?.stop()
})

beforeEach(async () => {
  sent.length = 0
  failing = false
  await sql.query('DELETE FROM _basedb.mail_outbox')
})

async function mention(who: string, name: string, text = 'Tu peux regarder ?') {
  const row = await kernel.createRecord(admin, { tableId, values: { numero: randomUUID() } })
  await kernel.addComment(admin, {
    tableId,
    recordId: String(row.row._id),
    body: `@[${name}](user:${who}) ${text}`,
  })
  return String(row.row._id)
}

describe('a notification left unread', () => {
  it('is queued for ten minutes, then goes as a mail that says what the bell says', async () => {
    const record = await mention(alice, 'Alice Martin')
    expect(await outbox()).toMatchObject([
      { origin: 'notification', recipient: 'alice@exemple.fr', status: 'pending' },
    ])
    // Not yet: the ten minutes are not up.
    expect(await kernel.deliverMails()).toBe(0)
    await bringForward()
    expect(await kernel.deliverMails()).toBe(1)
    expect(sent).toHaveLength(1)
    const mail = sent[0] as MailMessage
    expect(mail.to).toBe('alice@exemple.fr')
    expect(mail.subject).toBe('Administration vous a mentionné dans Commandes')
    expect(mail.body).toContain('Tu peux regarder ?')
    expect(mail.body).toContain(
      `https://basedb.exemple.fr/bases/ventes/tables/commandes?ligne=${record}`,
    )
    expect(mail.body).toContain('https://basedb.exemple.fr/parametres/notifications')
    expect(mail.automatic).toBe(true)
    expect(await outbox()).toMatchObject([{ status: 'sent' }])
  })

  it('goes as ONE mail when several wait', async () => {
    await mention(bob, 'Bob Durand', 'un')
    await mention(bob, 'Bob Durand', 'deux')
    await mention(bob, 'Bob Durand', 'trois')
    await bringForward()
    expect(await kernel.deliverMails()).toBe(1)
    expect(sent[0]?.subject).toBe('3 notifications non lues dans basedb')
    expect(sent[0]?.body).toMatch(/un[\s\S]*deux[\s\S]*trois/)
  })

  it('is dropped once read in time: the mail is for what was missed', async () => {
    await mention(alice, 'Alice Martin')
    await kernel.markNotificationsRead(await ctxOf(kernel, alice), { all: true })
    await bringForward()
    expect(await kernel.deliverMails()).toBe(0)
    expect(sent).toHaveLength(0)
    expect(await outbox()).toEqual([])
  })

  it('is not queued for a nature the person does not want by mail', async () => {
    await kernel.updateProfile(await ctxOf(kernel, alice), { mailedNotifications: ['reply'] })
    await mention(alice, 'Alice Martin')
    expect(await outbox()).toEqual([])
    await kernel.updateProfile(await ctxOf(kernel, alice), {
      mailedNotifications: ['mention', 'reply', 'assigned', 'automation'],
    })
  })

  it('is retried when the relay fails, and goes once it answers', async () => {
    await mention(alice, 'Alice Martin')
    await bringForward()
    failing = true
    expect(await kernel.deliverMails()).toBe(0)
    expect(await outbox()).toMatchObject([{ status: 'pending', attempts: 1 }])
    const [row] = (
      await sql.query<{ last_error: string; later: boolean }>(
        'SELECT last_error, not_before > clock_timestamp() AS later FROM _basedb.mail_outbox',
      )
    ).rows
    expect(row).toEqual({ last_error: 'relais indisponible', later: true })
    failing = false
    await bringForward()
    expect(await kernel.deliverMails()).toBe(1)
  })

  it('leaves nothing behind on an instance that sends no mail', async () => {
    await mention(alice, 'Alice Martin')
    await bringForward()
    expect(await silent.deliverMails()).toBe(0)
    expect(await outbox()).toEqual([])
  })
})

describe('an automation that sends an e-mail', () => {
  const definition = {
    label: 'Commande reçue',
    enabled: true,
    trigger: { kind: 'record_created', table: 'commandes' },
    actions: [
      {
        kind: 'email',
        record: 'trigger',
        users: [] as string[],
        user_field: 'responsable',
        email_field: 'contact',
        addresses: ['compta@exemple.fr', 'COMPTA@exemple.fr'],
        subject: 'Commande {{numero}} reçue',
        message: 'Bonjour,\nla commande {{numero}} est bien arrivée.',
      },
    ],
  }

  it('is refused when it names nobody, or an address that is not one', async () => {
    const refused = async (action: Record<string, unknown>) => {
      try {
        await kernel.createAutomation(admin, {
          baseId,
          input: { ...definition, actions: [{ ...definition.actions[0], ...action }] },
        })
      } catch (e) {
        return (e as { details?: { reason?: string } }).details?.reason
      }
      return null
    }
    expect(await refused({ user_field: null, email_field: null, addresses: [] })).toBe(
      'destinataire_manquant',
    )
    expect(await refused({ addresses: ['pas une adresse'] })).toBe('adresse_email')
    expect(await refused({ email_field: 'numero' })).toBe('champ_email_attendu')
    expect(await refused({ subject: '' })).toBe('objet_invalide')
  })

  it('queues one mail per mailbox, its text rendered, an answer going to its owner', async () => {
    // The rows written before it are behind it: it triggers on what comes after.
    await settle(kernel)
    const automation = await kernel.createAutomation(admin, { baseId, input: definition })
    await kernel.createRecord(admin, {
      tableId,
      values: { numero: 'C-42', contact: 'client@exemple.fr', responsable: bob },
    })
    await settle(kernel)
    const runs = await kernel.listAutomationRuns(admin, { baseId, id: automation.id })
    expect(runs[0]?.status).toBe('succeeded')
    expect(runs[0]?.steps[0]).toMatchObject({ kind: 'email', status: 'succeeded', detail: '3' })
    expect(await kernel.deliverMails()).toBe(3)
    expect(sent.map((m) => m.to).sort()).toEqual([
      'bob@exemple.fr',
      'client@exemple.fr',
      'compta@exemple.fr',
    ])
    expect(sent[0]).toMatchObject({
      subject: 'Commande C-42 reçue',
      body: 'Bonjour,\nla commande C-42 est bien arrivée.',
      replyTo: 'admin@basedb.local',
      automatic: true,
    })
    await kernel.deleteAutomation(admin, { baseId, id: automation.id })
  })

  it('fails its run on an instance that sends no mail, and says why', async () => {
    await settle(silent)
    const automation = await silent.createAutomation(await ctxOf(silent, admin.actor.id), {
      baseId,
      input: definition,
    })
    await silent.createRecord(await ctxOf(silent, admin.actor.id), {
      tableId,
      values: { numero: 'C-43', contact: 'client@exemple.fr' },
    })
    await settle(silent)
    const runs = await silent.listAutomationRuns(await ctxOf(silent, admin.actor.id), {
      baseId,
      id: automation.id,
    })
    expect(runs[0]).toMatchObject({ status: 'failed', errorCode: 'MAIL_NOT_CONFIGURED' })
    expect(await outbox()).toEqual([])
  })
})
