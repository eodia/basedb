import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import { todayIn } from '../../src/records/defaults.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Default values — chapter 04 §1.5: what a row created without a field takes, applied by
 * the kernel whatever the surface, whatever the author's write mask, and never over a
 * value the write named.
 */

const TENANT = 't7df4ks'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminId: string
let adminSession: string
let baseId: string
let baseRef: string
let tableId: string
let alice: string
const f: Record<string, string> = {}

const ctxOf = (userId: string) =>
  kernel.openContext({ userId, requestId: randomUUID(), surface: 'rest' })

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
}

const setDefault = (field: string, value: unknown) =>
  kernel.setFieldDefault(admin, { fieldId: f[field] as string, default: value })

const created = async (ctx: RequestContext, values: Record<string, unknown>) =>
  (await kernel.createRecord(ctx, { tableId, values })).row

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  adminId = boot.userId
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await ctxOf(boot.userId)
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  const base = await kernel.createBase(admin, { label: 'Suivi' })
  baseId = base.baseId
  const table = await kernel.createTable(admin, {
    baseId,
    label: 'Tickets',
    fields: [
      { label: 'Titre', kind: 'short_text' },
      { label: 'Ouvert le', kind: 'date' },
      { label: 'Horodatage', kind: 'datetime' },
      { label: 'Responsable', kind: 'user' },
      { label: 'Priorite', kind: 'number' },
      { label: 'Urgent', kind: 'boolean' },
      { label: 'Contact', kind: 'email' },
    ],
  })
  tableId = table.tableId
  for (const field of table.fields) f[field.name] = field.fieldId
  const statut = await kernel.addField(admin, {
    tableId,
    label: 'Statut',
    kind: 'select',
    options: [{ value: 'nouveau' }, { value: 'en_cours' }, { value: 'clos' }],
  })
  f.statut = statut.fieldId
  const tags = await kernel.addField(admin, {
    tableId,
    label: 'Tags',
    kind: 'multi_select',
    options: [{ value: 'web' }, { value: 'mobile' }],
  })
  f.tags = tags.fieldId
  baseRef = (await kernel.listVisibleBases(admin)).find((b) => b.id === baseId)?.name as string

  const agents = (await kernel.createGroup(admin, { label: 'Agents', sessionId: adminSession })).id
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: agents, scope: { kind: 'base', id: baseId }, level: 'edit' }],
    sessionId: adminSession,
  })
  alice = (
    await kernel.createUser(admin, {
      email: 'alice@exemple.fr',
      displayName: 'Alice',
      groupIds: [agents],
      sessionId: adminSession,
    })
  ).user.id
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('setting a default', () => {
  it('stores each kind in its column form', async () => {
    expect(await setDefault('statut', { kind: 'value', value: 'nouveau' })).toEqual({
      kind: 'value',
      value: 'nouveau',
    })
    expect(await setDefault('ouvert_le', { kind: 'today' })).toEqual({ kind: 'today' })
    expect(await setDefault('horodatage', { kind: 'now' })).toEqual({ kind: 'now' })
    expect(await setDefault('responsable', { kind: 'me' })).toEqual({ kind: 'me' })
    expect(await setDefault('priorite', { kind: 'value', value: '3' })).toEqual({
      kind: 'value',
      value: 3,
    })
    expect(await setDefault('urgent', { kind: 'value', value: false })).toEqual({
      kind: 'value',
      value: false,
    })
    expect(
      await setDefault('contact', { kind: 'value', value: ' mailto:support@exemple.fr' }),
    ).toEqual({ kind: 'value', value: 'support@exemple.fr' })
    expect(await setDefault('tags', { kind: 'value', value: ['web', 'web'] })).toEqual({
      kind: 'value',
      value: ['web'],
    })
  })

  it('refuses a default the field cannot hold', async () => {
    expect(await codeOf(setDefault('titre', { kind: 'today' }))).toBe('REQUEST_INVALID')
    expect(await codeOf(setDefault('statut', { kind: 'value', value: 'inconnu' }))).toBe(
      'VALUE_INVALID',
    )
    expect(await codeOf(setDefault('ouvert_le', { kind: 'value', value: '2026-02-30' }))).toBe(
      'VALUE_INVALID',
    )
    expect(await codeOf(setDefault('priorite', { kind: 'value', value: 'beaucoup' }))).toBe(
      'VALUE_INVALID',
    )
    expect(await codeOf(setDefault('responsable', { kind: 'value', value: randomUUID() }))).toBe(
      'VALUE_INVALID',
    )
    expect(await codeOf(setDefault('titre', { kind: 'value', value: '' }))).toBe('REQUEST_INVALID')
  })

  it('is building the table: someone who only edits rows may not set one', async () => {
    const ctx = await ctxOf(alice)
    expect(
      await codeOf(kernel.setFieldDefault(ctx, { fieldId: f.titre as string, default: null })),
    ).toBe('ADMIN_REQUIRED')
  })

  it('is published with the field, for the screens to prefill', async () => {
    const base = await kernel.projectBase(admin, baseRef)
    const fields = base.tables[0]?.fields ?? []
    const of = (name: string) => fields.find((x) => x.name === name)?.default
    expect(of('statut')).toEqual({ kind: 'value', value: 'nouveau' })
    expect(of('responsable')).toEqual({ kind: 'me' })
    expect(of('titre')).toBeUndefined()
  })
})

describe('creating a row', () => {
  it('fills what the write does not name, from the person creating it', async () => {
    const ctx = await ctxOf(alice)
    const before = todayIn('Europe/Paris', new Date())
    const row = await created(ctx, { titre: 'Écran blanc' })
    const after = todayIn('Europe/Paris', new Date())
    expect(row).toMatchObject({
      statut: 'nouveau',
      responsable: alice,
      urgent: false,
      contact: 'support@exemple.fr',
      tags: ['web'],
    })
    expect(Number(row.priorite)).toBe(3)
    expect([before, after]).toContain(String(row.ouvert_le))
    expect(Math.abs(Date.parse(String(row.horodatage)) - Date.now())).toBeLessThan(60_000)
  })

  it('still refuses a write that names nothing: defaults are not a value supplied', async () => {
    expect(await codeOf(created(admin, {}))).toBe('REQUIRED_VALUE_MISSING')
  })

  it('never overrides a value the write named — `null` included', async () => {
    const row = await created(admin, {
      titre: 'Choisi',
      statut: 'clos',
      responsable: null,
      tags: ['mobile'],
    })
    expect(row).toMatchObject({ statut: 'clos', responsable: null, tags: ['mobile'] })
  })

  it('fills a field the author may not write: it is the table’s rule', async () => {
    const groups = await kernel.listGroups(admin)
    const agents = groups.find((g) => g.label === 'Agents')?.id as string
    await kernel.setFieldRule(admin, {
      groupId: agents,
      fieldId: f.statut as string,
      rule: 'read_only',
      sessionId: adminSession,
    })
    const ctx = await ctxOf(alice)
    expect(await codeOf(created(ctx, { titre: 'x', statut: 'clos' }))).toBe('FIELD_NOT_WRITABLE')
    expect(await created(ctx, { titre: 'Sans statut' })).toMatchObject({ statut: 'nouveau' })
  })

  it('applies to a batch, row by row', async () => {
    const { ids } = await kernel.createRecords(admin, {
      tableId,
      records: [{ titre: 'Un' }, { titre: 'Deux', priorite: 1 }],
    })
    const rows = (await kernel.listRecords(admin, { tableId })).rows.filter((r) =>
      ids.includes(String(r._id)),
    )
    expect(rows.map((r) => [r.titre, Number(r.priorite), r.responsable]).sort()).toEqual([
      ['Deux', 1, adminId],
      ['Un', 3, adminId],
    ])
  })

  it('ignores a choice removed since, rather than failing every row', async () => {
    const canal = await kernel.addField(admin, {
      tableId,
      label: 'Canal',
      kind: 'select',
      options: [{ value: 'mail' }, { value: 'tel' }],
    })
    await kernel.setFieldDefault(admin, {
      fieldId: canal.fieldId,
      default: { kind: 'value', value: 'tel' },
    })
    // Removed while no row holds it yet — a choice in use cannot be removed.
    await kernel.setSelectOptions(admin, { fieldId: canal.fieldId, options: [{ value: 'mail' }] })
    const row = await created(admin, { titre: 'Après' })
    expect(row[canal.name]).toBeNull()
    const base = await kernel.projectBase(admin, baseRef)
    expect(base.tables[0]?.fields.find((x) => x.name === canal.name)?.default).toBeUndefined()
  })

  it('stops once removed', async () => {
    await setDefault('priorite', null)
    expect((await created(admin, { titre: 'Fin' })).priorite).toBeNull()
  })
})

describe('an answer to a public form', () => {
  it('takes the defaults of the fields it does not ask; « me » stays empty', async () => {
    const view = await kernel.createView(admin, {
      tableId,
      label: 'Signaler',
      kind: 'form',
      spec: { title: 'Signaler un problème', fields: [{ field: 'titre', required: true }] },
    })
    const sharing = await kernel.saveFormSharing(admin, {
      tableId,
      viewId: view.id,
      access: 'public',
      active: true,
      closesAt: null,
      maxResponses: null,
      groupIds: [],
    })
    await kernel.submitSharedForm({
      token: sharing.share?.token as string,
      respondent: null,
      requestId: randomUUID(),
      values: { titre: 'Depuis le formulaire' },
    })
    const row = (await kernel.listRecords(admin, { tableId })).rows.find(
      (r) => r.titre === 'Depuis le formulaire',
    )
    expect(row).toMatchObject({ urgent: false, tags: ['web'], responsable: null })
    expect(row?.ouvert_le).not.toBeNull()
  })
})
