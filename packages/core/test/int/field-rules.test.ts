import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Field rules, group by group — chapter 05 §4 and the screen §3.3 requires: a rule set by
 * an administrator is what every surface enforces, rights stay additive across groups, and
 * the effective mask of a person says which group opens what.
 */

const TENANT = 't5fq9rs'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminSession: string
let rh: { baseId: string; schemaName: string }
let employes: string
let fields: { nom: string; salaire: string; poste: string }
let commerciaux: string
let paie: string
let admins: string
let alice: { id: string; ctx: () => Promise<RequestContext> }
let row: string

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
}

const rule = (groupId: string, fieldId: string, value: 'hidden' | 'read_only' | null) =>
  kernel.setFieldRule(admin, { groupId, fieldId, rule: value, sessionId: adminSession })

const columnsFor = async (ctx: RequestContext) =>
  (await kernel.listRecords(ctx, { tableId: employes })).columns

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await kernel.openContext({
    userId: boot.userId,
    requestId: randomUUID(),
    surface: 'rest',
  })
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  rh = await kernel.createBase(admin, { label: 'RH' })
  const t = await kernel.createTable(admin, {
    baseId: rh.baseId,
    label: 'Employés',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Salaire', kind: 'number' },
      { label: 'Poste', kind: 'short_text' },
    ],
  })
  employes = t.tableId
  fields = {
    nom: t.fields[0].fieldId,
    salaire: t.fields[1].fieldId,
    poste: t.fields[2].fieldId,
  }
  row = String(
    (
      await kernel.createRecord(admin, {
        tableId: employes,
        values: { nom: 'Dupont', salaire: '3000', poste: 'Comptable' },
      })
    ).row._id,
  )

  const groups = await kernel.listGroups(admin)
  admins = groups.find((g) => g.system === 'admins')?.id as string
  commerciaux = (await kernel.createGroup(admin, { label: 'Commerciaux', sessionId: adminSession }))
    .id
  paie = (await kernel.createGroup(admin, { label: 'Paie', sessionId: adminSession })).id
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: commerciaux, scope: { kind: 'base', id: rh.baseId }, level: 'edit' }],
    sessionId: adminSession,
  })

  const a = await kernel.createUser(admin, {
    email: 'alice@exemple.fr',
    displayName: 'Alice',
    groupIds: [commerciaux],
    sessionId: adminSession,
  })
  alice = {
    id: a.user.id,
    ctx: () => kernel.openContext({ userId: a.user.id, requestId: randomUUID(), surface: 'rest' }),
  }
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('a rule, set for a group', () => {
  it('hides a field on every read, and the screen says so', async () => {
    const access = await rule(commerciaux, fields.salaire, 'hidden')
    const group = access.groups.find((g) => g.id === commerciaux)
    expect(group?.level).toBe('edit')
    expect(group?.rules).toEqual({ [fields.salaire]: 'hidden' })

    expect(await columnsFor(await alice.ctx())).not.toContain('salaire')
    expect(
      await codeOf(
        kernel.listRecords(await alice.ctx(), { tableId: employes, filter: 'salaire gt 1000' }),
      ),
    ).toBe('FILTER_FIELD_UNKNOWN')

    const mask = await kernel.effectiveFieldMask(admin, { tableId: employes, userId: alice.id })
    expect(mask.readsTable).toBe(true)
    const salaire = mask.fields.find((f) => f.id === fields.salaire)
    expect(salaire).toMatchObject({
      level: 'hidden',
      readableVia: [],
      restrictedBy: [{ group: 'Commerciaux', rule: 'hidden' }],
    })
    expect(mask.fields.find((f) => f.id === fields.nom)?.level).toBe('write')
  })

  it('read-only: seen, never written', async () => {
    await rule(commerciaux, fields.poste, 'read_only')
    expect(await columnsFor(await alice.ctx())).toContain('poste')
    expect(
      await codeOf(
        kernel.updateRecord(await alice.ctx(), {
          tableId: employes,
          recordId: row,
          values: { poste: 'Directrice' },
        }),
      ),
    ).toBe('FIELD_NOT_WRITABLE')
    await kernel.updateRecord(await alice.ctx(), {
      tableId: employes,
      recordId: row,
      values: { nom: 'Dupont-Martin' },
    })
  })

  it('rights stay additive: another group of the person reopens the field, and is named', async () => {
    await kernel.applyAccessChanges(admin, {
      changes: [{ groupId: paie, scope: { kind: 'table', id: employes }, level: 'read' }],
      sessionId: adminSession,
    })
    await kernel.setGroupMembership(admin, {
      groupId: paie,
      userId: alice.id,
      member: true,
      sessionId: adminSession,
    })
    expect(await columnsFor(await alice.ctx())).toContain('salaire')
    const mask = await kernel.effectiveFieldMask(admin, { tableId: employes, userId: alice.id })
    const salaire = mask.fields.find((f) => f.id === fields.salaire)
    // Read, not write: the only group that writes hides it, the one that opens it reads.
    expect(salaire).toMatchObject({
      level: 'read',
      readableVia: ['Paie'],
      restrictedBy: [{ group: 'Commerciaux', rule: 'hidden' }],
    })
    await kernel.setGroupMembership(admin, {
      groupId: paie,
      userId: alice.id,
      member: false,
      sessionId: adminSession,
    })
  })

  it('lifted, the field is back', async () => {
    const access = await rule(commerciaux, fields.salaire, null)
    expect(access.groups.find((g) => g.id === commerciaux)?.rules).toEqual({
      [fields.poste]: 'read_only',
    })
    expect(await columnsFor(await alice.ctx())).toContain('salaire')
  })
})

describe('what cannot be set', () => {
  it('a rule for a group that does not reach the table: PERMISSION_OUT_OF_SCOPE', async () => {
    const other = (await kernel.createGroup(admin, { label: 'Externe', sessionId: adminSession }))
      .id
    expect(await codeOf(rule(other, fields.salaire, 'hidden'))).toBe('PERMISSION_OUT_OF_SCOPE')
  })

  it('a rule for the Administrators: GROUP_SYSTEM_IMMUTABLE', async () => {
    expect(await codeOf(rule(admins, fields.salaire, 'hidden'))).toBe('GROUP_SYSTEM_IMMUTABLE')
  })

  it('without a recent elevation: ELEVATION_REQUIRED', async () => {
    const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
    expect(
      await codeOf(
        kernel.setFieldRule(admin, {
          groupId: commerciaux,
          fieldId: fields.nom,
          rule: 'hidden',
          sessionId: login.sessionId,
        }),
      ),
    ).toBe('ELEVATION_REQUIRED')
  })

  it('the screen is the Administrators’: anyone else finds nothing', async () => {
    const ctx = await alice.ctx()
    expect(await codeOf(kernel.fieldAccess(ctx, { tableId: employes }))).toBe('RESOURCE_NOT_FOUND')
    expect(
      await codeOf(kernel.effectiveFieldMask(ctx, { tableId: employes, userId: alice.id })),
    ).toBe('RESOURCE_NOT_FOUND')
  })
})
