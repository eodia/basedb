import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Projects, groups, accounts and the permission grid — chapter 05 §15.
 *
 * Through the kernel's public interface only, as an adapter sees it. What is checked is
 * the group model: rights granted to GROUPS on projects, bases and tables, flowing
 * down, additive across groups — and « granulaire » when a table is given less than its
 * base.
 */

const TENANT = 't4z56fq'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminSession: string
let ventes: string
let crm: { baseId: string; schemaName: string }
let clients: string
let factures: string
let alice: { id: string; password: string }
let bob: { id: string; password: string }
let commerciaux: string
let everyone: string
let admins: string

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

/** A session of the administrator, elevated a moment ago. */
async function elevated(): Promise<string> {
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  return (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId
}

const set = (groupId: string, kind: 'project' | 'base' | 'table', id: string, level: string) =>
  kernel.applyAccessChanges(admin, {
    changes: [{ groupId, scope: { kind, id }, level: level as never }],
    sessionId: adminSession,
  })

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
  adminSession = await elevated()

  ventes = (await kernel.createProject(admin, { label: 'Ventes' })).id
  crm = await kernel.createBase(admin, { label: 'CRM', projectId: ventes })
  clients = (
    await kernel.createTable(admin, {
      baseId: crm.baseId,
      label: 'Clients',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
  ).tableId
  factures = (
    await kernel.createTable(admin, {
      baseId: crm.baseId,
      label: 'Factures',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })
  ).tableId

  const groups = await kernel.listGroups(admin)
  admins = groups.find((g) => g.system === 'admins')?.id as string
  everyone = groups.find((g) => g.system === 'everyone')?.id as string
  commerciaux = (await kernel.createGroup(admin, { label: 'Commerciaux', sessionId: adminSession }))
    .id

  const a = await kernel.createUser(admin, {
    email: 'alice@exemple.fr',
    displayName: 'Alice',
    groupIds: [commerciaux],
    sessionId: adminSession,
  })
  alice = { id: a.user.id, password: a.temporaryPassword }
  const b = await kernel.createUser(admin, {
    email: 'bob@exemple.fr',
    displayName: 'Bob',
    sessionId: adminSession,
  })
  bob = { id: b.user.id, password: b.temporaryPassword }
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('bootstrap and system groups', () => {
  it('a server that restarts finds its catalog and its administrator in place', async () => {
    // What a container does on every start: migrate, bootstrap. Neither may fail twice.
    expect(await kernel.migrateCatalog()).toBe(0)
    const again = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
    expect(again.alreadyDone).toBe(true)
    expect((await kernel.listProjects(admin)).length).toBeGreaterThan(0)
  })

  it('a fresh tenant has a first project, the Administrators and « Tous les utilisateurs »', async () => {
    const projects = await kernel.listProjects(admin)
    expect(projects.map((p) => p.label)).toEqual(['Projet principal', 'Ventes'])
    const groups = await kernel.listGroups(admin)
    expect(groups.slice(0, 2).map((g) => [g.label, g.system])).toEqual([
      ['Administrateurs', 'admins'],
      ['Tous les utilisateurs', 'everyone'],
    ])
  })

  it('every account belongs to « Tous les utilisateurs », and the first one administers', async () => {
    const users = await kernel.listUsers(admin)
    for (const user of users) expect(user.groups.map((g) => g.id)).toContain(everyone)
    expect(users.find((u) => u.email === 'admin@basedb.local')?.isAdmin).toBe(true)
    expect(users.find((u) => u.id === alice.id)?.groups.map((g) => g.label)).toEqual([
      'Tous les utilisateurs',
      'Commerciaux',
    ])
  })

  it('system groups are neither renamed, nor deleted, nor left by everyone', async () => {
    expect(
      await codeOf(
        kernel.renameGroup(admin, { groupId: admins, label: 'X', sessionId: adminSession }),
      ),
    ).toBe('GROUP_SYSTEM_IMMUTABLE')
    expect(
      await codeOf(kernel.deleteGroup(admin, { groupId: everyone, sessionId: adminSession })),
    ).toBe('GROUP_SYSTEM_IMMUTABLE')
    expect(
      await codeOf(
        kernel.setGroupMembership(admin, {
          groupId: everyone,
          userId: alice.id,
          member: false,
          sessionId: adminSession,
        }),
      ),
    ).toBe('GROUP_SYSTEM_IMMUTABLE')
  })
})

describe('accounts', () => {
  it('a new account signs in with its temporary password, then must choose its own', async () => {
    const login = await kernel.login({ email: 'alice@exemple.fr', password: alice.password })
    const who = await kernel.authenticateCookie(login.sessionToken)
    expect((await kernel.whoAmI(who)).mustChangePassword).toBe(true)
    await kernel.changePassword({
      userId: alice.id,
      current: alice.password,
      next: 'un tout autre secret bien long',
    })
    alice.password = 'un tout autre secret bien long'
    const again = await kernel.login({ email: 'alice@exemple.fr', password: alice.password })
    const me = await kernel.whoAmI(await kernel.authenticateCookie(again.sessionToken))
    expect(me.mustChangePassword).toBe(false)
    expect(me.isAdmin).toBe(false)
  })

  it('administration writes demand an elevated session', async () => {
    const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
    expect(
      await codeOf(
        kernel.createUser(admin, {
          email: 'carole@exemple.fr',
          displayName: 'Carole',
          sessionId: login.sessionId,
        }),
      ),
    ).toBe('ELEVATION_REQUIRED')
  })

  it('an address is taken once per tenant', async () => {
    expect(
      await codeOf(
        kernel.createUser(admin, {
          email: 'ALICE@exemple.fr',
          displayName: 'Alice bis',
          sessionId: adminSession,
        }),
      ),
    ).toBe('EMAIL_TAKEN')
  })

  it('a non-administrator does not see that people or groups exist', async () => {
    const asAlice = await ctxOf(alice.id)
    expect(await codeOf(kernel.listUsers(asAlice))).toBe('RESOURCE_NOT_FOUND')
    expect(await codeOf(kernel.accessGraph(asAlice))).toBe('RESOURCE_NOT_FOUND')
  })

  it('nobody deactivates themselves, and the last Administrator stays', async () => {
    expect(
      await codeOf(
        kernel.updateUser(admin, {
          userId: admin.actor.id,
          disabled: true,
          sessionId: adminSession,
        }),
      ),
    ).toBe('ACTION_FORBIDDEN')
    expect(
      await codeOf(
        kernel.setGroupMembership(admin, {
          groupId: admins,
          userId: admin.actor.id,
          member: false,
          sessionId: adminSession,
        }),
      ),
    ).toBe('LAST_TENANT_ADMIN')
  })

  it('a deactivated account cannot sign in; reactivated, it can again', async () => {
    await kernel.updateUser(admin, { userId: bob.id, disabled: true, sessionId: adminSession })
    expect(await codeOf(kernel.login({ email: 'bob@exemple.fr', password: bob.password }))).toBe(
      'CREDENTIALS_INVALID',
    )
    await kernel.updateUser(admin, { userId: bob.id, disabled: false, sessionId: adminSession })
    await expect(
      kernel.login({ email: 'bob@exemple.fr', password: bob.password }),
    ).resolves.toBeDefined()
  })

  it('a reset hands out a new temporary password, and the old one stops working', async () => {
    const { temporaryPassword } = await kernel.resetUserPassword(admin, {
      userId: bob.id,
      sessionId: adminSession,
    })
    expect(await codeOf(kernel.login({ email: 'bob@exemple.fr', password: bob.password }))).toBe(
      'CREDENTIALS_INVALID',
    )
    bob.password = temporaryPassword
    await expect(
      kernel.login({ email: 'bob@exemple.fr', password: bob.password }),
    ).resolves.toBeDefined()
  })
})

describe('access levels by group', () => {
  it('without any grant, a person sees no project', async () => {
    const asAlice = await ctxOf(alice.id)
    expect(await kernel.listProjects(asAlice)).toEqual([])
    expect(await codeOf(kernel.projectBase(asAlice, crm.schemaName))).toBe('RESOURCE_NOT_FOUND')
  })

  it('« Lecture » on a project reads every table of every base in it', async () => {
    await set(commerciaux, 'project', ventes, 'read')
    const asAlice = await ctxOf(alice.id)
    const [project] = await kernel.listProjects(asAlice)
    expect(project?.label).toBe('Ventes')
    expect(project?.actions).toEqual(['read'])
    expect(project?.bases[0]?.tables.map((t) => t.label)).toEqual(['Clients', 'Factures'])
    const rows = await kernel.listRecords(asAlice, { tableId: clients })
    expect(rows.rows).toEqual([])
    expect(
      await codeOf(kernel.createRecord(asAlice, { tableId: clients, values: { nom: 'X' } })),
    ).not.toBe('RESOURCE_NOT_FOUND')
  })

  it('« Édition » on one table lets that table be written, and no other', async () => {
    await set(commerciaux, 'table', factures, 'edit')
    const asAlice = await ctxOf(alice.id)
    await expect(
      kernel.createRecord(asAlice, { tableId: factures, values: { numero: 'F-1' } }),
    ).resolves.toBeDefined()
    expect(
      await codeOf(kernel.createRecord(asAlice, { tableId: clients, values: { nom: 'Y' } })),
    ).toBe('ADMIN_REQUIRED')
  })

  it('a table given less than its project makes the project and the base « granulaire »', async () => {
    const graph = await set(commerciaux, 'table', clients, 'none')
    const cells = graph.cells[commerciaux] ?? {}
    expect(cells[`project:${ventes}`]?.level).toBe('granular')
    expect(cells[`base:${crm.baseId}`]?.level).toBe('granular')
    expect(cells[`table:${clients}`]).toEqual({ level: 'none', direct: false })
    expect(cells[`table:${factures}`]?.level).toBe('edit')

    const asAlice = await ctxOf(alice.id)
    const [project] = await kernel.listProjects(asAlice)
    expect(project?.bases[0]?.tables.map((t) => t.label)).toEqual(['Factures'])
    expect(await codeOf(kernel.listRecords(asAlice, { tableId: clients }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })

  it('a level set on the project again replaces every level below it', async () => {
    const graph = await set(commerciaux, 'project', ventes, 'read')
    const cells = graph.cells[commerciaux] ?? {}
    expect(cells[`project:${ventes}`]).toEqual({ level: 'read', direct: true })
    expect(cells[`table:${clients}`]).toEqual({ level: 'read', direct: false })
    expect(cells[`table:${factures}`]).toEqual({ level: 'read', direct: false })
  })

  it('« Gestion » on a project lets a base be built in it — but not a project', async () => {
    await set(commerciaux, 'project', ventes, 'manage')
    const asAlice = await ctxOf(alice.id)
    const created = await kernel.createBase(asAlice, { label: 'Relances', projectId: ventes })
    const table = await kernel.createTable(asAlice, {
      baseId: created.baseId,
      label: 'Appels',
      fields: [{ label: 'Objet', kind: 'short_text' }],
    })
    expect(table.tableName).toBe('appels')
    expect(await codeOf(kernel.createProject(asAlice, { label: 'Le mien' }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })

  it('an empty base is visible to whoever holds a right on it', async () => {
    const empty = await kernel.createBase(admin, { label: 'Vide', projectId: ventes })
    const asAlice = await ctxOf(alice.id)
    const [project] = await kernel.listProjects(asAlice)
    const base = project?.bases.find((b) => b.id === empty.baseId)
    expect(base?.tables).toEqual([])
    expect(base?.actions).toContain('manage_schema')
  })

  it('rights add up across groups: « Tous les utilisateurs » gives everyone', async () => {
    const asBob = await ctxOf(bob.id)
    expect(await kernel.listProjects(asBob)).toEqual([])
    await set(everyone, 'base', crm.baseId, 'read')
    const [project] = await kernel.listProjects(asBob)
    expect(project?.bases.map((b) => b.label)).toEqual(['CRM'])
    await set(everyone, 'base', crm.baseId, 'none')
    expect(await kernel.listProjects(asBob)).toEqual([])
  })

  it('deleting a group takes away what it granted', async () => {
    const temp = await kernel.createGroup(admin, { label: 'Temporaire', sessionId: adminSession })
    await kernel.setGroupMembership(admin, {
      groupId: temp.id,
      userId: bob.id,
      member: true,
      sessionId: adminSession,
    })
    await set(temp.id, 'project', ventes, 'read')
    expect((await kernel.listProjects(await ctxOf(bob.id))).length).toBe(1)
    await kernel.deleteGroup(admin, { groupId: temp.id, sessionId: adminSession })
    expect(await kernel.listProjects(await ctxOf(bob.id))).toEqual([])
  })

  it('the Administrators are not edited from the grid', async () => {
    expect(await codeOf(set(admins, 'project', ventes, 'none'))).toBe('GROUP_SYSTEM_IMMUTABLE')
  })
})

describe('projects', () => {
  it('a project that still holds a base is not deleted', async () => {
    expect(await codeOf(kernel.deleteProject(admin, { projectId: ventes }))).toBe(
      'PROJECT_NOT_EMPTY',
    )
    const spare = await kernel.createProject(admin, { label: 'Éphémère' })
    await kernel.deleteProject(admin, { projectId: spare.id })
    expect((await kernel.listProjects(admin)).map((p) => p.label)).not.toContain('Éphémère')
  })

  it('a base label is unique in its project, not in the tenant', async () => {
    const other = await kernel.createProject(admin, { label: 'Achats' })
    await expect(
      kernel.createBase(admin, { label: 'CRM', projectId: other.id }),
    ).resolves.toBeDefined()
    expect(await codeOf(kernel.createBase(admin, { label: 'CRM', projectId: ventes }))).toBe(
      'LABEL_DUPLICATE',
    )
  })
})

describe('reading through a relation, under the reader’s rights', () => {
  it('masks a count whose rows the reader may not read, as a field they may not see', async () => {
    const link = await kernel.createLinkField(admin, {
      tableId: factures,
      targetTableId: clients,
      label: 'Client',
    })
    await kernel.addField(admin, {
      tableId: clients,
      label: 'Nombre de factures',
      kind: 'count',
      rollup: { via: link.name, viaTable: 'factures' },
    })
    expect((await kernel.listRecords(admin, { tableId: clients })).columns).toContain(
      'nombre_de_factures',
    )

    // Alice reads the clients, not the invoices: counting them would say how many exist.
    await set(commerciaux, 'table', clients, 'read')
    await set(commerciaux, 'table', factures, 'none')
    const asAlice = await ctxOf(alice.id)
    const page = await kernel.listRecords(asAlice, { tableId: clients })
    expect(page.columns).not.toContain('nombre_de_factures')
    expect(
      await codeOf(
        kernel.listRecords(asAlice, { tableId: clients, filter: 'nombre_de_factures gt 0' }),
      ),
    ).toBe('FILTER_FIELD_UNKNOWN')
  })
})

describe('personal and locked views', () => {
  it('lets a reader build a view of their own, seen by nobody else', async () => {
    await set(commerciaux, 'table', clients, 'read')
    const asAlice = await ctxOf(alice.id)
    // Building for everyone is building the base; for oneself, reading is enough.
    expect(
      await codeOf(
        kernel.createView(asAlice, { tableId: clients, label: 'Mes clients', kind: 'grid' }),
      ),
    ).toBe('ADMIN_REQUIRED')
    const mine = await kernel.createView(asAlice, {
      tableId: clients,
      label: 'Mes clients',
      kind: 'grid',
      personal: true,
    })
    expect(mine).toMatchObject({ personal: true, locked: false })

    // The administrator neither sees it nor can change it: it is Alice's business.
    expect((await kernel.listViews(admin, { tableId: clients })).map((v) => v.id)).not.toContain(
      mine.id,
    )
    expect(
      await codeOf(kernel.updateView(admin, { tableId: clients, viewId: mine.id, label: 'X' })),
    ).toBe('RESOURCE_NOT_FOUND')
    // A collaborative view may bear the same label: labels are unique per owner.
    await expect(
      kernel.createView(admin, { tableId: clients, label: 'Mes clients', kind: 'grid' }),
    ).resolves.toBeDefined()

    const renamed = await kernel.updateView(asAlice, {
      tableId: clients,
      viewId: mine.id,
      label: 'Clients suivis',
    })
    expect(renamed.label).toBe('Clients suivis')
    expect((await kernel.listViews(asAlice, { tableId: clients })).map((v) => v.label)).toContain(
      'Clients suivis',
    )
  })

  it('refuses to change a locked view until it is unlocked', async () => {
    const view = await kernel.createView(admin, {
      tableId: clients,
      label: 'Référence',
      kind: 'grid',
    })
    const locked = await kernel.updateView(admin, {
      tableId: clients,
      viewId: view.id,
      locked: true,
    })
    expect(locked.locked).toBe(true)
    expect(
      await codeOf(kernel.updateView(admin, { tableId: clients, viewId: view.id, label: 'Autre' })),
    ).toBe('VIEW_LOCKED')
    expect(await codeOf(kernel.deleteView(admin, { tableId: clients, viewId: view.id }))).toBe(
      'VIEW_LOCKED',
    )
    // Unlocked in the same gesture as the change it allows.
    const changed = await kernel.updateView(admin, {
      tableId: clients,
      viewId: view.id,
      label: 'Référence 2026',
      locked: false,
    })
    expect(changed).toMatchObject({ label: 'Référence 2026', locked: false })
  })
})
