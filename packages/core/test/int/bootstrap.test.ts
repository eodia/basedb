import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import { Pools } from '../../src/runtime/pool.js'

/**
 * The first administrator — chapter 13 §7.
 *
 * The interface's road is open to whoever comes first, and to them alone: once an
 * administrator exists, by that road or the server's, it is gone. The tests run in
 * order on one instance, from its very first visit.
 */

const TENANT_REF = 't4z56fq'
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let pools: Pools

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('aucun refus')
}

const visit = (overrides: Partial<Parameters<Kernel['bootstrapAdministrator']>[0]> = {}) => ({
  tenantRef: TENANT_REF,
  email: 'Camille@Exemple.fr',
  displayName: 'Camille Martin',
  password: PASSWORD,
  requestId: crypto.randomUUID(),
  ...overrides,
})

const count = async (sql: string) => {
  const rows = await pools.withConnection('catalog', (exec) => exec.query<{ n: number }>(sql))
  return rows[0]?.n
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  pools = new Pools({ connectionString: container.getConnectionUri() })
}, 120_000)

afterAll(async () => {
  await pools?.end()
  await kernel?.close()
  await container?.stop()
})

describe('an instance with no administrator', () => {
  it('is open to the interface', async () => {
    expect(await kernel.bootstrapOpen()).toBe(true)
  })

  it('the server, given no address, finds nobody and invents nobody', async () => {
    expect(await codeOf(kernel.bootstrap({ tenantRef: TENANT_REF }))).toBe('RESOURCE_NOT_FOUND')
    expect(await kernel.bootstrapOpen()).toBe(true)
  })

  it('refuses what it would refuse any account, and stays open', async () => {
    expect(await codeOf(kernel.bootstrapAdministrator(visit({ password: 'court' })))).toBe(
      'PASSWORD_POLICY_VIOLATION',
    )
    // The password may not carry the name it protects.
    expect(
      await codeOf(kernel.bootstrapAdministrator(visit({ password: 'camille martin 2026' }))),
    ).toBe('PASSWORD_POLICY_VIOLATION')
    expect(await codeOf(kernel.bootstrapAdministrator(visit({ email: 'pas-une-adresse' })))).toBe(
      'REQUEST_INVALID',
    )
    expect(await codeOf(kernel.bootstrapAdministrator(visit({ displayName: '   ' })))).toBe(
      'LABEL_EMPTY',
    )
    expect(await kernel.bootstrapOpen()).toBe(true)
  })
})

describe('the first visit', () => {
  let email = ''

  it('creates the administrator ONCE, even when two visitors arrive together', async () => {
    const results = await Promise.allSettled([
      kernel.bootstrapAdministrator(visit()),
      kernel.bootstrapAdministrator(
        visit({ email: 'dominique@exemple.fr', displayName: 'Dominique Petit' }),
      ),
    ])
    const won = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const lost = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []))
    expect(won).toHaveLength(1)
    expect(lost.map((e) => (e as { code: string }).code)).toEqual(['RESOURCE_NOT_FOUND'])

    // The winner leaves signed in, as an instance administrator with a password of their
    // own — nothing to change at the next sign-in.
    const me = await kernel.whoAmI(await kernel.authenticateCookie(won[0]?.sessionToken))
    expect(me).toMatchObject({
      tenantRef: TENANT_REF,
      isInstanceAdmin: true,
      isAdmin: true,
      mustChangePassword: false,
    })
    email = me.email
    expect(await kernel.bootstrapOpen()).toBe(false)
  })

  it('leaves an account that signs in, whatever the case of its address', async () => {
    const session = await kernel.login({ email: email.toUpperCase(), password: PASSWORD })
    expect(session.tenantRef).toBe(TENANT_REF)
  })

  it('leaves a project to create bases in', async () => {
    expect(await count('SELECT count(*)::int AS n FROM _basedb.project')).toBe(1)
  })

  it('is written to the audit log', async () => {
    expect(
      await count(
        "SELECT count(*)::int AS n FROM _basedb.audit_log WHERE action = 'bootstrap.consumed'",
      ),
    ).toBe(1)
  })

  it('closes the road for good', async () => {
    expect(
      await codeOf(
        kernel.bootstrapAdministrator(visit({ email: 'tard@exemple.fr', displayName: 'Tard' })),
      ),
    ).toBe('RESOURCE_NOT_FOUND')
  })

  it('the server then finds that administrator, and creates no other', async () => {
    const found = await kernel.bootstrap({ tenantRef: TENANT_REF, email: 'admin@exemple.fr' })
    expect(found).toMatchObject({ email, alreadyDone: true })
    expect(
      await count('SELECT count(*)::int AS n FROM _basedb.app_user WHERE is_instance_admin'),
    ).toBe(1)
  })
})
