import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Shared forms — chapter 15.
 *
 * Through the kernel's public interface: a form is shared, answered by someone who holds
 * no right on its table — anonymously when public, signed in when for members —, and the
 * row lands, written on its publisher's authority and attributed to who answered.
 */

const TENANT = 't4z56fq'
const PASSWORD = 'mot-de-passe-de-test'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminSession: string
let base: { baseId: string; schemaName: string }
let tableId: string
let viewId: string
let alice: string
let bob: string
let carol: string
let invites: string
let builders: string

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
}

async function reasonOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (e) {
    return (e as { details?: { reason?: unknown } }).details?.reason
  }
  throw new Error('no error raised')
}

const as = (userId: string) =>
  kernel.openContext({ userId, requestId: randomUUID(), surface: 'rest' })

const settings = {
  access: 'public' as const,
  active: true,
  closesAt: null,
  maxResponses: null,
  groupIds: [] as string[],
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await as(boot.userId)
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  base = await kernel.createBase(admin, { label: 'Événements' })
  const clients = await kernel.createTable(admin, {
    baseId: base.baseId,
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  const table = await kernel.createTable(admin, {
    baseId: base.baseId,
    label: 'Inscriptions',
    fields: [
      { label: 'Nom', kind: 'short_text', required: true },
      { label: 'Email', kind: 'url' },
      { label: 'Note interne', kind: 'long_text' },
    ],
  })
  tableId = table.tableId
  await kernel.addField(admin, {
    tableId,
    label: 'Niveau',
    kind: 'select',
    options: [
      { value: 'debutant', label: 'Débutant' },
      { value: 'confirme', label: 'Confirmé' },
    ],
  })
  await kernel.createLinkField(admin, {
    tableId,
    targetTableId: clients.tableId,
    label: 'Client',
  })
  const view = await kernel.createView(admin, {
    tableId,
    label: 'Inscription',
    kind: 'form',
    spec: {
      title: 'Inscrivez-vous',
      fields: [
        { field: 'nom', required: true, label: 'Votre nom' },
        { field: 'email' },
        { field: 'niveau', help: 'Soyez honnête.' },
        { field: 'clients_id' },
      ],
    },
  })
  viewId = view.id

  invites = (await kernel.createGroup(admin, { label: 'Invités', sessionId: adminSession })).id
  builders = (await kernel.createGroup(admin, { label: 'Constructeurs', sessionId: adminSession }))
    .id
  alice = (
    await kernel.createUser(admin, {
      email: 'alice@exemple.fr',
      displayName: 'Alice',
      groupIds: [invites],
      sessionId: adminSession,
    })
  ).user.id
  bob = (
    await kernel.createUser(admin, {
      email: 'bob@exemple.fr',
      displayName: 'Bob',
      sessionId: adminSession,
    })
  ).user.id
  carol = (
    await kernel.createUser(admin, {
      email: 'carol@exemple.fr',
      displayName: 'Carol',
      groupIds: [builders],
      sessionId: adminSession,
    })
  ).user.id
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: builders, scope: { kind: 'base', id: base.baseId }, level: 'manage' }],
    sessionId: adminSession,
  })
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('sharing a form', () => {
  it('says what a shared link will not ask, before anything is shared', async () => {
    const sharing = await kernel.getFormSharing(admin, { tableId, viewId })
    expect(sharing.share).toBeNull()
    expect(sharing.omitted.map((o) => o.field)).toEqual(['Client'])
    expect(sharing.groups.map((g) => g.label)).toContain('Invités')
  })

  it('publishes a public link, and anyone with it answers — as the form', async () => {
    const sharing = await kernel.saveFormSharing(admin, { tableId, viewId, ...settings })
    const share = sharing.share
    expect(share).toMatchObject({ access: 'public', active: true, state: 'open' })
    expect(share?.token).toMatch(/^[A-Za-z0-9_-]{32}$/)

    const form = await kernel.openSharedForm({
      token: share?.token as string,
      respondent: null,
      requestId: randomUUID(),
    })
    expect(form).toMatchObject({ kind: 'form', title: 'Inscrivez-vous', access: 'public' })
    // The relation is not asked; the field the form does not ask is not either.
    expect(form.questions.map((q) => [q.name, q.label, q.required])).toEqual([
      ['nom', 'Votre nom', true],
      ['email', 'Email', false],
      ['niveau', 'Niveau', false],
    ])
    expect(form.questions[2]?.options?.map((o) => o.label)).toEqual(['Débutant', 'Confirmé'])
    expect(form.questions[2]?.help).toBe('Soyez honnête.')

    await kernel.submitSharedForm({
      token: share?.token as string,
      respondent: null,
      requestId: randomUUID(),
      values: { nom: 'Zoé', email: 'zoe.example', niveau: 'confirme' },
    })
    const rows = await kernel.listRecords(admin, { tableId })
    const zoe = rows.rows.find((r) => r.nom === 'Zoé')
    // The kernel's shaping holds: the address is completed, the author is nobody.
    expect(zoe).toMatchObject({ email: 'https://zoe.example', niveau: 'confirme' })
    expect(zoe?._created_by).toBeNull()
    expect(zoe?._updated_by).toBeNull()

    // The history names the form, not the person who published it as if they had typed.
    await kernel.drainHistory()
    const history = await kernel.recordHistory(admin, {
      tableId,
      recordId: zoe?._id as string,
    })
    const created = history.revisions.find((r) => r.op === 'insert')
    expect(created?.actor).toMatchObject({ kind: 'form', tokenLabel: 'Inscription' })

    const after = await kernel.getFormSharing(admin, { tableId, viewId })
    expect(after.share?.responseCount).toBe(1)
  })

  it('refuses what the form does not ask, and what it requires but lacks', async () => {
    const { share } = await kernel.getFormSharing(admin, { tableId, viewId })
    const token = share?.token as string
    const submit = (values: Record<string, unknown>) =>
      kernel.submitSharedForm({ token, respondent: null, requestId: randomUUID(), values })
    expect(await codeOf(submit({ nom: 'X', note_interne: 'glissé' }))).toBe('REQUEST_INVALID')
    expect(await codeOf(submit({ email: 'x.fr' }))).toBe('REQUIRED_VALUE_MISSING')
    expect(await codeOf(submit({ nom: 'X', clients_id: randomUUID() }))).toBe('REQUEST_INVALID')
  })

  it('closes: deactivated, past its date, full — and a new link retires the old', async () => {
    const { share } = await kernel.getFormSharing(admin, { tableId, viewId })
    const token = share?.token as string
    const open = () => kernel.openSharedForm({ token, respondent: null, requestId: randomUUID() })

    await kernel.saveFormSharing(admin, { tableId, viewId, ...settings, active: false })
    expect(await reasonOf(open())).toBe('inactive')

    await kernel.saveFormSharing(admin, {
      tableId,
      viewId,
      ...settings,
      closesAt: new Date(Date.now() - 60_000).toISOString(),
    })
    expect(await reasonOf(open())).toBe('closed')

    await kernel.saveFormSharing(admin, { tableId, viewId, ...settings, maxResponses: 2 })
    await kernel.submitSharedForm({
      token,
      respondent: null,
      requestId: randomUUID(),
      values: { nom: 'Yves' },
    })
    expect(
      await reasonOf(
        kernel.submitSharedForm({
          token,
          respondent: null,
          requestId: randomUUID(),
          values: { nom: 'Trop tard' },
        }),
      ),
    ).toBe('full')

    await kernel.saveFormSharing(admin, { tableId, viewId, ...settings })
    const renewed = await kernel.regenerateFormShare(admin, { tableId, viewId })
    expect(renewed.share?.token).not.toBe(token)
    expect(await codeOf(open())).toBe('RESOURCE_NOT_FOUND')
    await kernel.openSharedForm({
      token: renewed.share?.token as string,
      respondent: null,
      requestId: randomUUID(),
    })
  })
})

describe('a form for members', () => {
  it('asks to sign in, refuses those outside its groups, and takes the others as themselves', async () => {
    const sharing = await kernel.saveFormSharing(admin, {
      tableId,
      viewId,
      ...settings,
      access: 'members',
      groupIds: [invites],
    })
    const token = sharing.share?.token as string

    expect(
      await codeOf(kernel.openSharedForm({ token, respondent: null, requestId: randomUUID() })),
    ).toBe('AUTHENTICATION_REQUIRED')
    expect(
      await codeOf(
        kernel.openSharedForm({ token, respondent: await as(bob), requestId: randomUUID() }),
      ),
    ).toBe('FORM_RESTRICTED')

    // Alice holds no right on the table: the form is what lets her in.
    const asAlice = await as(alice)
    expect(await codeOf(kernel.createRecord(asAlice, { tableId, values: { nom: 'x' } }))).toMatch(
      /RESOURCE_NOT_FOUND|ADMIN_REQUIRED/,
    )
    const form = await kernel.openSharedForm({
      token,
      respondent: asAlice,
      requestId: randomUUID(),
    })
    expect(form.respondent).toBe('Alice')
    await kernel.submitSharedForm({
      token,
      respondent: asAlice,
      requestId: randomUUID(),
      values: { nom: 'Alice', niveau: 'debutant' },
    })
    const rows = await kernel.listRecords(admin, { tableId })
    expect(rows.rows.find((r) => r.nom === 'Alice')?._created_by).toBe(alice)

    // Closed, it says so before asking anyone to sign in: signing in would not open it.
    await kernel.saveFormSharing(admin, {
      tableId,
      viewId,
      ...settings,
      access: 'members',
      active: false,
      groupIds: [invites],
    })
    const closed = kernel.openSharedForm({ token, respondent: null, requestId: randomUUID() })
    expect(await codeOf(closed)).toBe('FORM_CLOSED')
  })
})

describe('the authority of a share', () => {
  it('is its publisher’s, decided again at every answer', async () => {
    const asCarol = await as(carol)
    const sharing = await kernel.saveFormSharing(asCarol, { tableId, viewId, ...settings })
    expect(sharing.share?.publishedBy.id).toBe(carol)
    const token = sharing.share?.token as string
    await kernel.submitSharedForm({
      token,
      respondent: null,
      requestId: randomUUID(),
      values: { nom: 'Par Carol' },
    })

    // Carol may now only read the base: her forms close with her right.
    await kernel.applyAccessChanges(admin, {
      changes: [{ groupId: builders, scope: { kind: 'base', id: base.baseId }, level: 'read' }],
      sessionId: adminSession,
    })
    expect(
      await reasonOf(kernel.openSharedForm({ token, respondent: null, requestId: randomUUID() })),
    ).toBe('authority')
    const state = await kernel.getFormSharing(admin, { tableId, viewId })
    expect(state.share?.state).toBe('authority')

    // Saving it again makes the admin its publisher, and it opens again.
    await kernel.saveFormSharing(admin, { tableId, viewId, ...settings })
    await kernel.openSharedForm({ token, respondent: null, requestId: randomUUID() })
  })

  it('stops with the form: a deleted view leaves nothing to answer', async () => {
    const { share } = await kernel.getFormSharing(admin, { tableId, viewId })
    await kernel.deleteView(admin, { tableId, viewId })
    expect(
      await codeOf(
        kernel.openSharedForm({
          token: share?.token as string,
          respondent: null,
          requestId: randomUUID(),
        }),
      ),
    ).toBe('RESOURCE_NOT_FOUND')
  })
})

describe('a survey that looks its own way and asks only what an answer calls for', () => {
  it('keeps its look, and refuses a condition on a later question or a colour that is not one', async () => {
    const create = (spec: Record<string, unknown>) =>
      kernel.createView(admin, { tableId, label: `Essai ${randomUUID()}`, kind: 'survey', spec })
    expect(
      await reasonOf(
        create({
          fields: [
            { field: 'nom', required: true },
            { field: 'email', show_if: { field: 'niveau', op: 'is', value: 'confirme' } },
            { field: 'niveau' },
          ],
        }),
      ),
    ).toBe('condition_invalide')
    expect(
      await reasonOf(create({ fields: [{ field: 'nom', required: true }], accent: 'rouge' })),
    ).toBe('valeur_invalide')
    expect(
      await reasonOf(create({ fields: [{ field: 'nom', required: true }], theme: 'fluo' })),
    ).toBe('valeur_invalide')

    const survey = await create({
      fields: [{ field: 'nom', required: true }],
      theme: 'nuit',
      font: 'serif',
    })
    // What it left out reads as the defaults: nothing to decide to make a good one.
    expect(survey.spec).toMatchObject({
      theme: 'nuit',
      accent: '',
      font: 'serif',
      align: 'left',
      show_progress: true,
      auto_advance: true,
      celebrate: true,
      end_link_url: '',
    })
  })

  it('does not ask, nor write, a question an earlier answer hid', async () => {
    const survey = await kernel.createView(admin, {
      tableId,
      label: 'Parcours',
      kind: 'survey',
      spec: {
        fields: [
          { field: 'nom', required: true },
          { field: 'niveau', required: true },
          {
            field: 'email',
            required: true,
            placeholder: 'https://votre-site.fr',
            show_if: { field: 'niveau', op: 'is', value: 'confirme' },
          },
        ],
        theme: 'ocean',
        celebrate: false,
        end_link_label: 'Retour au site',
        end_link_url: 'https://exemple.fr',
      },
    })
    const { share } = await kernel.saveFormSharing(admin, {
      tableId,
      viewId: survey.id,
      ...settings,
    })
    const token = share?.token as string
    const form = await kernel.openSharedForm({ token, respondent: null, requestId: randomUUID() })
    expect(form.design).toMatchObject({
      theme: 'ocean',
      celebrate: false,
      endLink: { label: 'Retour au site', url: 'https://exemple.fr' },
    })
    expect(form.questions.find((q) => q.name === 'email')).toMatchObject({
      placeholder: 'https://votre-site.fr',
      showIf: { field: 'niveau', op: 'is', value: 'confirme' },
    })

    const submit = (values: Record<string, unknown>) =>
      kernel.submitSharedForm({ token, respondent: null, requestId: randomUUID(), values })
    // A beginner is not asked for an address: not required — and not written, if typed
    // before the level was changed.
    await submit({ nom: 'Léon', niveau: 'debutant', email: 'https://garde.fr' })
    // A confirmed one is.
    expect(await codeOf(submit({ nom: 'Maxime', niveau: 'confirme' }))).toBe(
      'REQUIRED_VALUE_MISSING',
    )
    await submit({ nom: 'Maxime', niveau: 'confirme', email: 'https://maxime.fr' })

    const rows = (await kernel.listRecords(admin, { tableId })).rows
    expect(rows.find((r) => r.nom === 'Léon')).toMatchObject({ niveau: 'debutant', email: null })
    expect(rows.find((r) => r.nom === 'Maxime')).toMatchObject({ email: 'https://maxime.fr' })
  })
})
