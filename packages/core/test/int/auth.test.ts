import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  authenticateAccessToken,
  authenticateCookie,
  changePassword,
  confirmPasswordReset,
  dropElevation,
  elevate,
  issueAccessToken,
  login,
  logout,
  requestPasswordReset,
  revoke,
  setPassword,
  whoAmI,
} from '../../src/auth/operations.js'
import { SESSION_CAP, listLiveSessions } from '../../src/auth/session.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'

/**
 * Authentication — chapter 13 §2 and §4.
 *
 * Most of what matters here is NEGATIVE, and one rule governs it: no response lets a
 * caller tell a non-existent account from an existing one. The tests that check two
 * different situations answer the same thing are the ones worth having.
 */

const TENANT_REF = 't4z56fq'
const KEY = 'cle-instance-de-test-0123456789'
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let pools: Pools
let tenantId: string
let aliceId: string

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('aucun refus')
}

async function makeUser(email: string, displayName: string): Promise<string> {
  const [u] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
       VALUES ($1, $2, $3, (SELECT created_by FROM _basedb.tenant WHERE ref = $4),
                            (SELECT created_by FROM _basedb.tenant WHERE ref = $4))
       RETURNING id`,
      [tenantId, email, displayName, TENANT_REF],
      'insert',
    ),
  )
  return u.id
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })

  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
  })

  const bootstrap = await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    const [t] = await exec.query<{ id: string; created_by: string }>(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
      [TENANT_REF],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.app_user
         (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t
  })
  tenantId = bootstrap.id

  aliceId = await makeUser('alice@exemple.fr', 'Alice Martin')
  await setPassword(pools, KEY, { userId: aliceId, password: PASSWORD })
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

/** The code a reset mail carries on a line of its own, when no link is known. */
const codeIn = (body: string) => body.split('\n\n')[1] ?? ''

describe('§2.5 — no answer distinguishes an account that exists', () => {
  it('answers the same code for a wrong password and an unknown address', async () => {
    const wrong = await codeOf(login(pools, KEY, { email: 'alice@exemple.fr', password: 'faux' }))
    const unknown = await codeOf(
      login(pools, KEY, { email: 'personne@exemple.fr', password: PASSWORD }),
    )
    expect(wrong).toBe('CREDENTIALS_INVALID')
    expect(unknown).toBe(wrong)
  })

  it('costs about the same for an unknown address as for a known one', async () => {
    // Without the dummy hash, an existing account would cost ~60 ms and an unknown one
    // nothing at all — the very oracle the shared code exists to avoid.
    const startKnown = process.hrtime.bigint()
    await codeOf(login(pools, KEY, { email: 'alice@exemple.fr', password: 'mauvais mot de passe' }))
    const known = Number(process.hrtime.bigint() - startKnown)

    const startUnknown = process.hrtime.bigint()
    await codeOf(
      login(pools, KEY, { email: 'fantome@exemple.fr', password: 'mauvais mot de passe' }),
    )
    const unknown = Number(process.hrtime.bigint() - startUnknown)

    expect(unknown).toBeGreaterThan(known / 4)
  }, 30_000)

  it('accepts the address whatever its case and surrounding spaces', async () => {
    const session = await login(pools, KEY, {
      email: '  ALICE@Exemple.FR ',
      password: PASSWORD,
    })
    expect(session.sessionToken.startsWith('bds_')).toBe(true)
  }, 30_000)
})

describe('§4 — sessions and access tokens', () => {
  it('opens a session, exchanges it, and believes the access token', async () => {
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const access = await issueAccessToken(pools, KEY, session.sessionToken, session.csrfToken)

    expect(access.token.startsWith('bda_')).toBe(true)
    const who = await authenticateAccessToken(pools, KEY, access.token)
    expect(who.userId).toBe(aliceId)
    expect(who.tenantRef).toBe(TENANT_REF)
  }, 30_000)

  it('refuses an access token whose signature was not minted from this session', async () => {
    const a = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const b = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const accessA = await issueAccessToken(pools, KEY, a.sessionToken, a.csrfToken)
    const accessB = await issueAccessToken(pools, KEY, b.sessionToken, b.csrfToken)

    // Splice A's session identifier onto B's signature: the HMAC covers both, so it
    // cannot survive the transplant.
    const payloadA = Buffer.from(accessA.token.slice(4), 'base64url').toString('utf8')
    const payloadB = Buffer.from(accessB.token.slice(4), 'base64url').toString('utf8')
    const forged = `bda_${Buffer.from(
      `${payloadA.split('.').slice(0, 2).join('.')}.${payloadB.split('.')[2]}`,
    ).toString('base64url')}`

    expect(await codeOf(authenticateAccessToken(pools, KEY, forged))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
  }, 30_000)

  it('refuses an access token signed with another instance key', async () => {
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const access = await issueAccessToken(pools, KEY, session.sessionToken, session.csrfToken)
    expect(await codeOf(authenticateAccessToken(pools, 'autre-cle', access.token))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
  }, 30_000)

  it('REVOKING THE SESSION invalidates the access tokens instantly', async () => {
    // The whole point of deriving the token instead of storing it: there is nothing to
    // walk, and no list of issued tokens to keep in step.
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const access = await issueAccessToken(pools, KEY, session.sessionToken, session.csrfToken)
    expect((await authenticateAccessToken(pools, KEY, access.token)).userId).toBe(aliceId)

    await logout(pools, session.sessionToken)

    expect(await codeOf(authenticateAccessToken(pools, KEY, access.token))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
  }, 30_000)

  it('refuses to mint an access token without the CSRF header', async () => {
    // The one route that turns a cookie into a credential for the data API. A foreign
    // page can make a browser send the cookie; it cannot make it send this header.
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    for (const csrf of [undefined, '', 'mauvais-jeton']) {
      expect(await codeOf(issueAccessToken(pools, KEY, session.sessionToken, csrf))).toBe(
        'AUTHENTICATION_REQUIRED',
      )
    }
    // And with the right one it works, so the refusal above is about the header alone.
    const ok = await issueAccessToken(pools, KEY, session.sessionToken, session.csrfToken)
    expect(ok.token.startsWith('bda_')).toBe(true)
  }, 30_000)

  it('refuses the CSRF token of ANOTHER session', async () => {
    const mine = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const other = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    expect(await codeOf(issueAccessToken(pools, KEY, mine.sessionToken, other.csrfToken))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
  }, 30_000)

  it('refuses an absent, malformed or unknown credential with one single code', async () => {
    for (const candidate of [undefined, '', 'pas-un-jeton', 'bda_nimportequoi', 'bds_autre']) {
      expect(await codeOf(authenticateAccessToken(pools, KEY, candidate))).toBe(
        'AUTHENTICATION_REQUIRED',
      )
    }
  })

  it('caps live sessions at ten, dropping the oldest', async () => {
    const isolated = await makeUser('plafond@exemple.fr', 'Plafond Test')
    await setPassword(pools, KEY, { userId: isolated, password: PASSWORD })

    const tokens: string[] = []
    for (let i = 0; i < SESSION_CAP + 2; i++) {
      const s = await login(pools, KEY, { email: 'plafond@exemple.fr', password: PASSWORD })
      tokens.push(s.sessionToken)
    }

    const live = await listLiveSessions(pools, isolated)
    expect(live).toHaveLength(SESSION_CAP)
    // The oldest is gone; the newest still works.
    expect(await codeOf(authenticateCookie(pools, tokens[0]))).toBe('AUTHENTICATION_REQUIRED')
    expect((await authenticateCookie(pools, tokens[tokens.length - 1])).userId).toBe(isolated)
  }, 120_000)
})

describe('§2.4 — lockout, which is exact because it is a row', () => {
  it('locks after ten consecutive failures, and never says so', async () => {
    const target = await makeUser('verrou@exemple.fr', 'Verrou Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })

    for (let i = 0; i < 10; i++) {
      await codeOf(login(pools, KEY, { email: 'verrou@exemple.fr', password: 'mauvais' }))
    }

    // The RIGHT password now fails too — and with the same code as a wrong one, because
    // learning about the lock is learning that the account exists.
    expect(
      await codeOf(login(pools, KEY, { email: 'verrou@exemple.fr', password: PASSWORD })),
    ).toBe('CREDENTIALS_INVALID')

    const [row] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ failed_attempts: number; locked_until: Date | null }>(
        `SELECT failed_attempts, locked_until FROM _basedb.auth_identity
          WHERE subject = 'verrou@exemple.fr'`,
      ),
    )
    expect(row.failed_attempts).toBeGreaterThanOrEqual(10)
    expect(row.locked_until).not.toBeNull()
  }, 180_000)

  it('resets the counter on a successful login', async () => {
    const target = await makeUser('compteur@exemple.fr', 'Compteur Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })

    for (let i = 0; i < 3; i++) {
      await codeOf(login(pools, KEY, { email: 'compteur@exemple.fr', password: 'mauvais' }))
    }
    await login(pools, KEY, { email: 'compteur@exemple.fr', password: PASSWORD })

    const [row] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ failed_attempts: number }>(
        `SELECT failed_attempts FROM _basedb.auth_identity WHERE subject = 'compteur@exemple.fr'`,
      ),
    )
    expect(row.failed_attempts).toBe(0)
  }, 120_000)
})

describe('§4.3 — what closes a session', () => {
  it('a password change closes every session of that user', async () => {
    const target = await makeUser('rotation@exemple.fr', 'Rotation Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })

    const first = await login(pools, KEY, { email: 'rotation@exemple.fr', password: PASSWORD })
    const second = await login(pools, KEY, { email: 'rotation@exemple.fr', password: PASSWORD })

    await changePassword(pools, KEY, {
      userId: target,
      current: PASSWORD,
      next: 'un tout autre mot de passe honnete',
    })

    // The point of changing a password is usually that someone else may know the old one.
    for (const session of [first, second]) {
      expect(await codeOf(authenticateCookie(pools, session.sessionToken))).toBe(
        'AUTHENTICATION_REQUIRED',
      )
    }
    const after = await login(pools, KEY, {
      email: 'rotation@exemple.fr',
      password: 'un tout autre mot de passe honnete',
    })
    expect(after.userId).toBe(target)
  }, 180_000)

  it('a disabled account closes its sessions without touching them', async () => {
    const target = await makeUser('desactive@exemple.fr', 'Desactive Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })
    const session = await login(pools, KEY, { email: 'desactive@exemple.fr', password: PASSWORD })
    const access = await issueAccessToken(pools, KEY, session.sessionToken, session.csrfToken)

    await pools.withConnection('catalog', (exec) =>
      exec.query(
        'UPDATE _basedb.app_user SET disabled_at = clock_timestamp() WHERE id = $1',
        [target],
        'update',
      ),
    )

    // No session row was written: the account's state is re-read on every request.
    expect(await codeOf(authenticateAccessToken(pools, KEY, access.token))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
  }, 60_000)

  it('refuses to revoke a session belonging to someone else, as if it did not exist', async () => {
    const other = await makeUser('autrui@exemple.fr', 'Autrui Test')
    await setPassword(pools, KEY, { userId: other, password: PASSWORD })
    const theirs = await login(pools, KEY, { email: 'autrui@exemple.fr', password: PASSWORD })

    const mine = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const me = await authenticateCookie(pools, mine.sessionToken)

    expect(await codeOf(revoke(pools, me, { kind: 'one', sessionId: theirs.sessionId }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    // And theirs still works.
    expect((await authenticateCookie(pools, theirs.sessionToken)).userId).toBe(other)
  }, 60_000)
})

describe('who the caller is', () => {
  it('answers with the identity and the tenant, never with a secret', async () => {
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const who = await whoAmI(pools, await authenticateCookie(pools, session.sessionToken))

    expect(who).toMatchObject({
      id: aliceId,
      email: 'alice@exemple.fr',
      displayName: 'Alice Martin',
      tenantRef: TENANT_REF,
      isInstanceAdmin: false,
    })
    expect(JSON.stringify(who)).not.toContain('bds_')
  }, 30_000)

  it('refuses a password that fails the policy, naming its reason', async () => {
    // It speaks to someone who has already proved their identity: there is nothing to
    // withhold from them about their own new password.
    expect(await codeOf(setPassword(pools, KEY, { userId: aliceId, password: 'court' }))).toBe(
      'PASSWORD_POLICY_VIOLATION',
    )
  })
})

describe('§5 — elevation', () => {
  it('lasts five minutes, on the session, proved by the current password', async () => {
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const before = new Date()
    const raised = await elevate(pools, KEY, session.sessionToken, PASSWORD)

    expect(raised.elevatedUntil.getTime() - before.getTime()).toBeGreaterThan(4 * 60_000)
    expect(raised.elevatedUntil.getTime() - before.getTime()).toBeLessThanOrEqual(5 * 60_000 + 2000)

    const who = await authenticateCookie(pools, raised.session.sessionToken)
    expect(who.elevatedUntil).not.toBeNull()
  }, 60_000)

  it('ROTATES the session token, invalidating the access tokens in flight', async () => {
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const before = await issueAccessToken(pools, KEY, session.sessionToken, session.csrfToken)
    expect((await authenticateAccessToken(pools, KEY, before.token)).userId).toBe(aliceId)

    const raised = await elevate(pools, KEY, session.sessionToken, PASSWORD)

    // An elevation is never silent: the token minted before it stops working, and the
    // old cookie with it.
    expect(await codeOf(authenticateAccessToken(pools, KEY, before.token))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
    expect(await codeOf(authenticateCookie(pools, session.sessionToken))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
    // The new one works, and it is elevated.
    expect(
      (await authenticateCookie(pools, raised.session.sessionToken)).elevatedUntil,
    ).not.toBeNull()
  }, 60_000)

  it('refuses a wrong proof exactly like a failed login', async () => {
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    expect(await codeOf(elevate(pools, KEY, session.sessionToken, 'mauvais mot de passe'))).toBe(
      'CREDENTIALS_INVALID',
    )
    // And the session is untouched: a failed elevation is not a logout.
    expect((await authenticateCookie(pools, session.sessionToken)).userId).toBe(aliceId)
  }, 60_000)

  it('can be dropped before its five minutes are up', async () => {
    const session = await login(pools, KEY, { email: 'alice@exemple.fr', password: PASSWORD })
    const raised = await elevate(pools, KEY, session.sessionToken, PASSWORD)
    await dropElevation(pools, raised.session.sessionToken)
    expect((await authenticateCookie(pools, raised.session.sessionToken)).elevatedUntil).toBeNull()
  }, 60_000)
})

describe('§2.3 — password reset', () => {
  it('answers nothing, and sends nothing, for an address it does not know', async () => {
    const sent: string[] = []
    const mailer = async (m: { to: string }) => {
      sent.push(m.to)
    }
    // No throw, no signal: the caller cannot tell this apart from a real request.
    await requestPasswordReset(pools, { email: 'fantome@exemple.fr', mailer })
    await requestPasswordReset(pools, { email: 'alice@exemple.fr', mailer })
    expect(sent).toEqual(['alice@exemple.fr'])
  }, 30_000)

  it('sends nothing to a disabled account', async () => {
    const target = await makeUser('gele@exemple.fr', 'Gele Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        'UPDATE _basedb.app_user SET disabled_at = clock_timestamp() WHERE id = $1',
        [target],
        'update',
      ),
    )

    const sent: string[] = []
    await requestPasswordReset(pools, {
      email: 'gele@exemple.fr',
      mailer: async (m) => {
        sent.push(m.to)
      },
    })
    expect(sent).toEqual([])
  }, 30_000)

  it('consumes the challenge once, and only once', async () => {
    const target = await makeUser('oubli@exemple.fr', 'Oubli Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })

    let secret = ''
    await requestPasswordReset(pools, {
      email: 'oubli@exemple.fr',
      mailer: async (m) => {
        secret = codeIn(m.body)
      },
    })
    expect(secret).toMatch(/^[\w-]{43}$/)

    const chosen = 'un mot de passe tout neuf et long'
    await confirmPasswordReset(pools, KEY, { secret, password: chosen })
    const after = await login(pools, KEY, { email: 'oubli@exemple.fr', password: chosen })
    expect(after.userId).toBe(target)

    // Replaying the link fails: the row was consumed in the statement that found it.
    expect(await codeOf(confirmPasswordReset(pools, KEY, { secret, password: chosen }))).toBe(
      'RESET_TOKEN_INVALID',
    )
  }, 120_000)

  it('sends a link to the interface when its address is known — never one from the request', async () => {
    const target = await makeUser('lien@exemple.fr', 'Lien Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })
    let body = ''
    await requestPasswordReset(pools, {
      email: 'lien@exemple.fr',
      publicUrl: 'https://basedb.exemple.fr/',
      mailer: async (m) => {
        body = m.body
      },
    })
    const link = /https:\/\/basedb\.exemple\.fr\/\?reinitialisation=([\w-]{43})/.exec(body)
    expect(link).not.toBeNull()
    await confirmPasswordReset(pools, KEY, {
      secret: link?.[1] as string,
      password: 'encore un mot de passe tout neuf',
    })
  })

  it('refuses an unknown or expired secret with the same code', async () => {
    for (const secret of ['inconnu', '', 'a'.repeat(43)]) {
      expect(await codeOf(confirmPasswordReset(pools, KEY, { secret, password: PASSWORD }))).toBe(
        'RESET_TOKEN_INVALID',
      )
    }
  })

  it('opening a second reset closes the first', async () => {
    const target = await makeUser('deuxfois@exemple.fr', 'Deux Fois')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })

    const secrets: string[] = []
    const mailer = async (m: { body: string }) => {
      secrets.push(codeIn(m.body))
    }
    await requestPasswordReset(pools, { email: 'deuxfois@exemple.fr', mailer })
    await requestPasswordReset(pools, { email: 'deuxfois@exemple.fr', mailer })

    // Two live links would be two chances for a leaked mailbox, for no gain to the
    // legitimate holder.
    expect(
      await codeOf(confirmPasswordReset(pools, KEY, { secret: secrets[0], password: PASSWORD })),
    ).toBe('RESET_TOKEN_INVALID')
    await confirmPasswordReset(pools, KEY, {
      secret: secrets[1],
      password: 'encore un autre mot de passe',
    })
  }, 120_000)
})

describe('§2.3 — a password change hands back a session', () => {
  it('closes the others and keeps the caller signed in', async () => {
    const target = await makeUser('continuite@exemple.fr', 'Continuite Test')
    await setPassword(pools, KEY, { userId: target, password: PASSWORD })

    const elsewhere = await login(pools, KEY, {
      email: 'continuite@exemple.fr',
      password: PASSWORD,
    })
    const fresh = await changePassword(pools, KEY, {
      userId: target,
      current: PASSWORD,
      next: 'un mot de passe de remplacement',
    })

    // The other session is gone; the caller holds a working one.
    expect(await codeOf(authenticateCookie(pools, elsewhere.sessionToken))).toBe(
      'AUTHENTICATION_REQUIRED',
    )
    expect((await authenticateCookie(pools, fresh.sessionToken)).userId).toBe(target)
    // And its CSRF token is the one that goes with it.
    const issued = await issueAccessToken(pools, KEY, fresh.sessionToken, fresh.csrfToken)
    expect(issued.token.startsWith('bda_')).toBe(true)
  }, 120_000)
})
