import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Row rules — chapter 05 §16: a group sees only the rows its filter keeps, on every surface
 * — list, write, link, SQL, history — rights stay additive, and « Gestion » sees all.
 */

const TENANT = 't6rw8ks'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminSession: string
let crm: { baseId: string; schemaName: string }
let clients: string
let factures: string
let commerciaux: string
let direction: string
let alice: string
let bob: string
let aliceRow: string
let bobRow: string

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

const namesFor = async (userId: string, tableId = clients) =>
  (await kernel.listRecords(await ctxOf(userId), { tableId })).rows.map((r) => r.nom).sort()

const setRule = (groupId: string, rule: string | null, tableId = clients) =>
  kernel.setRowRule(admin, { groupId, tableId, rule, sessionId: adminSession })

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await ctxOf(boot.userId)
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  crm = await kernel.createBase(admin, { label: 'CRM' })
  clients = (
    await kernel.createTable(admin, {
      baseId: crm.baseId,
      label: 'Clients',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Commercial', kind: 'user' },
      ],
    })
  ).tableId
  factures = (
    await kernel.createTable(admin, {
      baseId: crm.baseId,
      label: 'Factures',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })
  ).tableId
  await kernel.createLinkField(admin, {
    tableId: factures,
    targetTableId: clients,
    label: 'Client',
  })

  commerciaux = (await kernel.createGroup(admin, { label: 'Commerciaux', sessionId: adminSession }))
    .id
  direction = (await kernel.createGroup(admin, { label: 'Direction', sessionId: adminSession })).id
  await kernel.applyAccessChanges(admin, {
    changes: [
      { groupId: commerciaux, scope: { kind: 'base', id: crm.baseId }, level: 'edit' },
      { groupId: direction, scope: { kind: 'base', id: crm.baseId }, level: 'read' },
    ],
    sessionId: adminSession,
  })
  alice = (
    await kernel.createUser(admin, {
      email: 'alice@exemple.fr',
      displayName: 'Alice',
      groupIds: [commerciaux],
      sessionId: adminSession,
    })
  ).user.id
  bob = (
    await kernel.createUser(admin, {
      email: 'bob@exemple.fr',
      displayName: 'Bob',
      groupIds: [commerciaux],
      sessionId: adminSession,
    })
  ).user.id

  aliceRow = String(
    (
      await kernel.createRecord(admin, {
        tableId: clients,
        values: { nom: 'Arc', commercial: alice },
      })
    ).row._id,
  )
  bobRow = String(
    (
      await kernel.createRecord(admin, {
        tableId: clients,
        values: { nom: 'Bois', commercial: bob },
      })
    ).row._id,
  )
  await kernel.createRecord(admin, { tableId: clients, values: { nom: 'Cime' } })
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('setting a rule', () => {
  it('refuses the Administrators, a group that does not reach the table, and a bad filter', async () => {
    const groups = await kernel.listGroups(admin)
    const admins = groups.find((g) => g.system === 'admins')?.id as string
    expect(await codeOf(setRule(admins, 'commercial eq @moi'))).toBe('GROUP_SYSTEM_IMMUTABLE')
    const nobody = (
      await kernel.createGroup(admin, { label: 'Stagiaires', sessionId: adminSession })
    ).id
    expect(await codeOf(setRule(nobody, 'commercial eq @moi'))).toBe('PERMISSION_OUT_OF_SCOPE')
    expect(await codeOf(setRule(commerciaux, 'inconnu eq 1'))).toBe('FILTER_FIELD_UNKNOWN')
  })

  it('keeps a group to its rows, @moi being each of its members', async () => {
    const access = await setRule(commerciaux, 'commercial eq @moi')
    expect(access.groups.find((g) => g.id === commerciaux)?.rule).toBe('commercial eq @moi')
    expect(await namesFor(alice)).toEqual(['Arc'])
    expect(await namesFor(bob)).toEqual(['Bois'])
    // The administrator, who manages everything, sees every row.
    expect((await kernel.listRecords(admin, { tableId: clients })).rows).toHaveLength(3)
  })

  it('says how many rows a person sees, and through which group', async () => {
    const seen = await kernel.effectiveRows(admin, { tableId: clients, userId: alice })
    expect(seen).toMatchObject({ readsTable: true, total: 3, visible: 1 })
    expect(seen.via).toEqual([{ group: 'Commerciaux', rule: 'commercial eq @moi' }])
  })
})

describe('writing under a rule', () => {
  it('finds no row outside it, to change or to delete', async () => {
    const asAlice = await ctxOf(alice)
    expect(
      await codeOf(
        kernel.updateRecord(asAlice, { tableId: clients, recordId: bobRow, values: { nom: 'X' } }),
      ),
    ).toBe('RESOURCE_NOT_FOUND')
    expect(await codeOf(kernel.deleteRecord(asAlice, { tableId: clients, recordId: bobRow }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })

  it('refuses to create a row its author would not see, and creates one they would', async () => {
    const asAlice = await ctxOf(alice)
    expect(
      await codeOf(
        kernel.createRecord(asAlice, {
          tableId: clients,
          values: { nom: 'Dune', commercial: bob },
        }),
      ),
    ).toBe('ROW_OUT_OF_SCOPE')
    expect(await namesFor(admin.actor.id)).not.toContain('Dune')
    await kernel.createRecord(asAlice, {
      tableId: clients,
      values: { nom: 'Elan', commercial: alice },
    })
    expect(await namesFor(alice)).toEqual(['Arc', 'Elan'])
  })

  it('refuses a link to a row the author does not see', async () => {
    const asAlice = await ctxOf(alice)
    expect(
      await codeOf(
        kernel.createRecord(asAlice, {
          tableId: factures,
          values: { numero: 'F-1', clients_id: bobRow },
        }),
      ),
    ).toBe('LINK_TARGET_NOT_FOUND')
    await kernel.createRecord(asAlice, {
      tableId: factures,
      values: { numero: 'F-2', clients_id: aliceRow },
    })
  })

  it('lets a row leave its author’s rows by the change they make', async () => {
    const asAlice = await ctxOf(alice)
    const elan = (await kernel.listRecords(asAlice, { tableId: clients })).rows.find(
      (r) => r.nom === 'Elan',
    )
    await kernel.updateRecord(asAlice, {
      tableId: clients,
      recordId: String(elan?._id),
      values: { commercial: bob },
    })
    expect(await namesFor(alice)).toEqual(['Arc'])
    expect(await namesFor(bob)).toEqual(['Bois', 'Elan'])
  })
})

describe('rights stay additive', () => {
  it('a group without a rule gives back every row', async () => {
    await kernel.setUserGroups(admin, {
      userId: alice,
      groupIds: [commerciaux, direction],
      sessionId: adminSession,
    })
    expect(await namesFor(alice)).toEqual(['Arc', 'Bois', 'Cime', 'Elan'])
    await kernel.setUserGroups(admin, {
      userId: alice,
      groupIds: [commerciaux],
      sessionId: adminSession,
    })
    expect(await namesFor(alice)).toEqual(['Arc'])
  })
})

describe('the other surfaces', () => {
  it('SQL written in the interface reads the same rows, qualified or not', async () => {
    const asAlice = await ctxOf(alice)
    const bare = await kernel.runSql(asAlice, {
      baseId: crm.baseId,
      sql: 'SELECT nom FROM clients ORDER BY nom',
    })
    expect(bare.rows.map((r) => r.nom)).toEqual(['Arc'])
    const qualified = await kernel.runSql(asAlice, {
      baseId: crm.baseId,
      sql: `SELECT count(*)::int AS n FROM ${crm.schemaName}.clients`,
    })
    expect(qualified.rows[0]?.n).toBe(1)
  })

  it('the history of the base shows the rows the reader sees, and no other', async () => {
    const page = await kernel.baseHistory(await ctxOf(alice), { baseId: crm.baseId })
    const records = new Set(page.revisions.map((r) => r.recordId))
    expect(records.has(aliceRow)).toBe(true)
    expect(records.has(bobRow)).toBe(false)
  })

  it('a lifted rule gives every row back, in SQL too', async () => {
    await setRule(commerciaux, null)
    expect(await namesFor(alice)).toEqual(['Arc', 'Bois', 'Cime', 'Elan'])
    const all = await kernel.runSql(await ctxOf(alice), {
      baseId: crm.baseId,
      sql: 'SELECT count(*)::int AS n FROM clients',
    })
    expect(all.rows[0]?.n).toBe(4)
  })
})
