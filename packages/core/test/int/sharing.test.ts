import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Accounts of one's own, projects of one's own, and sharing — chapter 05 §15, chapter 13 §8.
 *
 * Anyone creates an account and projects; whoever manages a project or a base shares it by
 * a link, never beyond what they manage. The tests follow a small team through it, in
 * order, on one instance.
 */

const TENANT = 't4z56fq'
const PASSWORD = 'des tables bien rangees'
const ADMIN_PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminToken: string

interface Person {
  readonly id: string
  readonly ctx: RequestContext
}
const people: Record<string, Person> = {}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('aucun refus')
}

async function reasonOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (e) {
    return (e as { details?: { reason?: unknown } }).details?.reason
  }
  throw new Error('aucun refus')
}

const ctxOf = (userId: string) =>
  kernel.openContext({ userId, requestId: randomUUID(), surface: 'rest' })

async function signUp(name: string, email: string, invitation?: string): Promise<Person> {
  const session = await kernel.signUp({
    tenantRef: TENANT,
    email,
    displayName: name,
    password: PASSWORD,
    invitation,
    requestId: randomUUID(),
  })
  const person = { id: session.userId, ctx: await ctxOf(session.userId) }
  people[name] = person
  return person
}

const projectsOf = async (ctx: RequestContext) =>
  (await kernel.listProjects(ctx)).map((p) => ({ label: p.label, actions: p.actions }))

const directoryOf = async (ctx: RequestContext) =>
  (await kernel.listMembers(ctx)).map((m) => m.displayName).sort()

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@exemple.fr' })
  await kernel.setPassword({ userId: boot.userId, password: ADMIN_PASSWORD })
  admin = await ctxOf(boot.userId)
  adminToken = (await kernel.login({ email: 'admin@exemple.fr', password: ADMIN_PASSWORD }))
    .sessionToken
}, 120_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('an account of one’s own', () => {
  it('is open to anyone by default', async () => {
    expect(await kernel.signupPolicy(TENANT)).toEqual({ open: true, domains: [] })
    const alice = await signUp('Alice Martin', 'alice@exemple.fr')
    const me = await kernel.whoAmI(
      await kernel.authenticateCookie(
        (await kernel.login({ email: 'ALICE@exemple.fr', password: PASSWORD })).sessionToken,
      ),
    )
    expect(me).toMatchObject({ id: alice.id, isAdmin: false, mustChangePassword: false })
    await signUp('Bruno Petit', 'bruno@exemple.fr')
    await signUp('Chloé Durand', 'chloe@exemple.fr')
  })

  it('refuses an address already held', async () => {
    expect(await codeOf(signUp('Autre Alice', 'Alice@Exemple.fr'))).toBe('EMAIL_TAKEN')
  })

  it('sees nothing it was not given, and nobody', async () => {
    const { ctx } = people['Bruno Petit'] as Person
    expect(await projectsOf(ctx)).toEqual([])
    expect(await directoryOf(ctx)).toEqual(['Bruno Petit'])
  })
})

describe('projects of one’s own', () => {
  let alices = ''

  it('anyone creates one, and manages it', async () => {
    const alice = people['Alice Martin'] as Person
    alices = (await kernel.createProject(alice.ctx, { label: 'Mon projet' })).id
    const [mine] = await projectsOf(alice.ctx)
    expect(mine?.label).toBe('Mon projet')
    expect(mine?.actions).toEqual(expect.arrayContaining(['read', 'update', 'manage_schema']))
  })

  it('a name is one’s own: another person may take it too, unaware', async () => {
    const bruno = people['Bruno Petit'] as Person
    await kernel.createProject(bruno.ctx, { label: 'Mon projet' })
    const alice = people['Alice Martin'] as Person
    expect(await codeOf(kernel.createProject(alice.ctx, { label: 'mon projet' }))).toBe(
      'LABEL_DUPLICATE',
    )
  })

  it('stays out of sight of the others', async () => {
    const bruno = people['Bruno Petit'] as Person
    expect((await projectsOf(bruno.ctx)).map((p) => p.label)).toEqual(['Mon projet'])
    expect(
      await codeOf(kernel.scopeSharing(bruno.ctx, { scope: { kind: 'project', id: alices } })),
    ).toBe('RESOURCE_NOT_FOUND')
  })

  it('its manager deletes it', async () => {
    const alice = people['Alice Martin'] as Person
    const spare = await kernel.createProject(alice.ctx, { label: 'Brouillon' })
    await kernel.deleteProject(alice.ctx, { projectId: spare.id })
    expect((await projectsOf(alice.ctx)).map((p) => p.label)).toEqual(['Mon projet'])
  })
})

describe('sharing by a link', () => {
  let project = ''
  let base = ''

  beforeAll(async () => {
    const alice = people['Alice Martin'] as Person
    project = (await kernel.listProjects(alice.ctx))[0]?.id as string
    base = (await kernel.createBase(alice.ctx, { label: 'Clients', projectId: project })).baseId
  })

  it('invites at a level; the link says what it offers before anyone signs in', async () => {
    const alice = people['Alice Martin'] as Person
    const invitation = await kernel.inviteToScope(alice.ctx, {
      scope: { kind: 'project', id: project },
      email: 'bruno@exemple.fr',
      level: 'read',
    })
    expect(await kernel.invitationPreview(TENANT, invitation.token)).toMatchObject({
      scope: { kind: 'project', label: 'Mon projet' },
      level: 'read',
      invitedBy: 'Alice Martin',
      email: 'bruno@exemple.fr',
    })

    const bruno = people['Bruno Petit'] as Person
    expect(await kernel.acceptInvitation(bruno.ctx, { token: invitation.token })).toEqual({
      projectId: project,
      baseId: null,
    })
    // Twice, by the same person, is a reload — not an error. By another, the link is spent.
    await kernel.acceptInvitation(bruno.ctx, { token: invitation.token })
    const chloe = people['Chloé Durand'] as Person
    expect(await codeOf(kernel.acceptInvitation(chloe.ctx, { token: invitation.token }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    expect(await codeOf(kernel.invitationPreview(TENANT, invitation.token))).toBe(
      'RESOURCE_NOT_FOUND',
    )

    const shared = (await kernel.listProjects(bruno.ctx)).find((p) => p.id === project)
    expect(shared?.actions).toEqual(['read'])
  })

  it('the people who share a project now see each other — and only them', async () => {
    expect(await directoryOf((people['Alice Martin'] as Person).ctx)).toEqual([
      'Alice Martin',
      'Bruno Petit',
    ])
    expect(await directoryOf((people['Chloé Durand'] as Person).ctx)).toEqual(['Chloé Durand'])
    expect(await directoryOf(admin)).toEqual(
      expect.arrayContaining(['Alice Martin', 'Bruno Petit', 'Chloé Durand']),
    )
  })

  it('only a manager shares, and never their own access', async () => {
    const bruno = people['Bruno Petit'] as Person
    expect(
      await codeOf(
        kernel.inviteToScope(bruno.ctx, {
          scope: { kind: 'project', id: project },
          email: 'x@exemple.fr',
          level: 'read',
        }),
      ),
    ).toBe('ADMIN_REQUIRED')

    const alice = people['Alice Martin'] as Person
    const after = await kernel.setPersonAccess(alice.ctx, {
      scope: { kind: 'project', id: project },
      userId: bruno.id,
      level: 'edit',
    })
    expect(after.people.find((p) => p.userId === bruno.id)).toMatchObject({
      level: 'edit',
      from: 'here',
    })
    expect(
      await reasonOf(
        kernel.setPersonAccess(alice.ctx, {
          scope: { kind: 'project', id: project },
          userId: alice.id,
          level: 'read',
        }),
      ),
    ).toBe('son_propre_acces')
  })

  it('a base’s manager shares that base, not its project', async () => {
    const alice = people['Alice Martin'] as Person
    const chloe = people['Chloé Durand'] as Person
    const invitation = await kernel.inviteToScope(alice.ctx, {
      scope: { kind: 'base', id: base },
      email: 'chloe@exemple.fr',
      level: 'manage',
    })
    expect(await kernel.acceptInvitation(chloe.ctx, { token: invitation.token })).toEqual({
      projectId: project,
      baseId: base,
    })
    // The project shows, because a base in it does; it is not hers to share. Refused as
    // what one cannot see: the kernel judges a project by the tables one reads in it, and
    // this base has none yet.
    expect((await kernel.listProjects(chloe.ctx)).map((p) => p.id)).toEqual([project])
    expect(
      await codeOf(kernel.scopeSharing(chloe.ctx, { scope: { kind: 'project', id: project } })),
    ).toBe('RESOURCE_NOT_FOUND')

    const sharing = await kernel.scopeSharing(chloe.ctx, { scope: { kind: 'base', id: base } })
    const bruno = people['Bruno Petit'] as Person
    expect(sharing.people.find((p) => p.userId === bruno.id)).toMatchObject({
      level: 'edit',
      from: 'project',
    })
    // What comes from the project is changed in the project, by whoever manages it.
    expect(
      await reasonOf(
        kernel.setPersonAccess(chloe.ctx, {
          scope: { kind: 'base', id: base },
          userId: bruno.id,
          level: 'none',
        }),
      ),
    ).toBe('herite')
  })

  it('an invitation gives nothing once its author no longer manages the scope', async () => {
    const chloe = people['Chloé Durand'] as Person
    const invitation = await kernel.inviteToScope(chloe.ctx, {
      scope: { kind: 'base', id: base },
      email: 'dora@exemple.fr',
      level: 'read',
    })
    const alice = people['Alice Martin'] as Person
    await kernel.setPersonAccess(alice.ctx, {
      scope: { kind: 'base', id: base },
      userId: chloe.id,
      level: 'none',
    })
    const dora = await signUp('Dora Lefèvre', 'dora@exemple.fr')
    expect(await codeOf(kernel.acceptInvitation(dora.ctx, { token: invitation.token }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    expect(await projectsOf(chloe.ctx)).toEqual([])
  })

  it('a revoked invitation stops working at once', async () => {
    const alice = people['Alice Martin'] as Person
    const invitation = await kernel.inviteToScope(alice.ctx, {
      scope: { kind: 'project', id: project },
      email: 'eli@exemple.fr',
      level: 'read',
    })
    const pending = await kernel.scopeSharing(alice.ctx, {
      scope: { kind: 'project', id: project },
    })
    expect(pending.invitations.map((i) => i.token)).toContain(invitation.token)
    await kernel.revokeInvitation(alice.ctx, { invitationId: invitation.id })
    expect(await codeOf(kernel.invitationPreview(TENANT, invitation.token))).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })
})

describe('the sign-up policy', () => {
  let elevated = ''

  beforeAll(async () => {
    elevated = (await kernel.elevate(adminToken, ADMIN_PASSWORD)).session.sessionId
  })

  it('is the administrators’ to set, elevated', async () => {
    const alice = people['Alice Martin'] as Person
    expect(
      await codeOf(
        kernel.setSignupPolicy(alice.ctx, { open: false, domains: [], sessionId: elevated }),
      ),
    ).toBe('RESOURCE_NOT_FOUND')
  })

  it('closed, it admits only the invited', async () => {
    await kernel.setSignupPolicy(admin, { open: false, domains: [], sessionId: elevated })
    expect(await codeOf(signUp('Fanny Roux', 'fanny@exemple.fr'))).toBe('RESOURCE_NOT_FOUND')

    const alice = people['Alice Martin'] as Person
    const project = (await kernel.listProjects(alice.ctx))[0]?.id as string
    const invitation = await kernel.inviteToScope(alice.ctx, {
      scope: { kind: 'project', id: project },
      email: 'fanny@exemple.fr',
      level: 'read',
    })
    const fanny = await signUp('Fanny Roux', 'fanny@exemple.fr', invitation.token)
    await kernel.acceptInvitation(fanny.ctx, { token: invitation.token })
    expect((await projectsOf(fanny.ctx)).map((p) => p.label)).toEqual(['Mon projet'])
  })

  it('kept to some domains, it says which', async () => {
    await kernel.setSignupPolicy(admin, {
      open: true,
      domains: ['@Eodia.fr '],
      sessionId: elevated,
    })
    expect(await kernel.signupPolicy(TENANT)).toEqual({ open: true, domains: ['eodia.fr'] })
    expect(await reasonOf(signUp('Gilles Faure', 'gilles@gmail.com'))).toBe('domaine_refuse')
    await signUp('Gilles Faure', 'gilles@eodia.fr')
  })
})
