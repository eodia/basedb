import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { type JWK, SignJWT, exportJWK, generateKeyPair } from 'jose'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadProviders } from '../../src/auth/oidc-providers.js'
import { completeOidc, forgetDiscoveries, resolveIdentity, startOidc } from '../../src/auth/oidc.js'
import { loginWithOidc } from '../../src/auth/operations.js'
import { seal } from '../../src/auth/sealing.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'

/**
 * OIDC — chapter 13 §3.
 *
 * Exercised against a REAL provider, small and local: discovery, PKCE, the code
 * exchange and the signature all actually happen. A test that stubbed the verification
 * would prove the linking rules and nothing about the part where forgeries are caught.
 */

const TENANT_REF = 't4z56fq'
const KEY = 'cle-instance-de-test-0123456789'
const REDIRECT = 'http://localhost:9999/auth/oidc/essai/callback'

let container: StartedPostgreSqlContainer
let pools: Pools
let tenantId: string
let adminId: string

/** The fake provider. */
let server: Server
let issuer: string
let privateKey: CryptoKey
let publicJwk: JWK
/** What the next `/token` call hands back, set by each test. */
let nextIdToken: () => Promise<string>

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('aucun refus')
}

/** Signs an identity token, with whatever claims a test wants to try. */
async function signIdToken(
  claims: Record<string, unknown>,
  options: { readonly expired?: boolean } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'essai' })
    .setIssuer(issuer)
    .setAudience('client-de-test')
    .setIssuedAt(options.expired === true ? now - 7200 : now)
    .setExpirationTime(options.expired === true ? now - 3600 : now + 600)
    .sign(privateKey)
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'essai', alg: 'RS256', use: 'sig' }

  server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', issuer)
    const send = (body: unknown) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(body))
    }

    if (url.pathname === '/.well-known/openid-configuration') {
      return send({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
      })
    }
    if (url.pathname === '/jwks') return send({ keys: [publicJwk] })
    if (url.pathname === '/token') {
      // The body is drained so the socket closes cleanly; its contents are checked by
      // the dedicated test below, which intercepts them.
      request.resume()
      request.on('end', () => {
        void nextIdToken().then((id_token) => send({ id_token, token_type: 'Bearer' }))
      })
      return
    }
    response.writeHead(404).end()
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

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
  adminId = bootstrap.created_by
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
  await new Promise<void>((resolve) => server?.close(() => resolve()))
})

/** Declares the provider at instance level, as an operator would. */
async function declare(properties: Record<string, unknown>): Promise<void> {
  await pools.withConnection('catalog', async (exec) => {
    await exec.query(
      `DELETE FROM _basedb.setting WHERE key LIKE 'auth.oidc.%';
       DELETE FROM _basedb.secret WHERE key LIKE 'auth.oidc.%'`,
      [],
      'delete',
    )
    for (const [key, value] of Object.entries({
      issuer,
      client_id: 'client-de-test',
      ...properties,
    })) {
      await exec.query(
        `INSERT INTO _basedb.setting (scope_kind, key, value, updated_by)
         VALUES ('instance', $1, $2::jsonb, $3)`,
        [`auth.oidc.essai.${key}`, JSON.stringify(value), adminId],
        'insert',
      )
    }
    // The client secret lives sealed, so a copy of the database is not a copy of the
    // credentials.
    await exec.query(
      `INSERT INTO _basedb.secret (scope_kind, key, value_encrypted, key_version, updated_by)
       VALUES ('instance', $1, $2, 1, $3)`,
      [
        'auth.oidc.essai.client_secret',
        Buffer.from(seal(KEY, 'oidc-client-secret', 'secret-du-client'), 'utf8'),
        adminId,
      ],
      'insert',
    )
  })
}

async function provider() {
  const found = await pools.withConnection('catalog', (exec) =>
    loadProviders(exec, KEY, TENANT_REF),
  )
  return found[0]
}

/** Walks the browser's half of the exchange and returns what the callback receives. */
async function roundTrip(): Promise<{ cookie: string; state: string; nonce: string }> {
  const started = await startOidc(KEY, await provider(), { redirectUri: REDIRECT })
  const url = new URL(started.authorizeUrl)
  return {
    cookie: started.exchangeCookie,
    state: url.searchParams.get('state') ?? '',
    nonce: url.searchParams.get('nonce') ?? '',
  }
}

beforeEach(() => {
  forgetDiscoveries()
})

describe('§3.2 — declaration is an operator act', () => {
  it('reads a provider declared at instance level, secret included', async () => {
    await declare({ label: 'Essai', provisioning: 'off' })
    const p = await provider()
    expect(p.slug).toBe('essai')
    expect(p.clientSecret).toBe('secret-du-client')
    // Off by default, and anything that is not exactly `domains` stays off.
    expect(p.provisioning).toBe('off')
  })

  it('ignores a provider whose client secret is missing', async () => {
    await declare({ label: 'Essai' })
    await pools.withConnection('catalog', (exec) =>
      exec.query(`DELETE FROM _basedb.secret WHERE key LIKE 'auth.oidc.%'`, [], 'delete'),
    )
    // Half-declared is not declared: an authorization request without a secret would
    // fail at the provider, later, with a message nobody can act on.
    expect(await provider()).toBeUndefined()
  })

  it('lets a tenant RESTRICT the list, never extend it', async () => {
    await declare({ label: 'Essai' })
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `INSERT INTO _basedb.setting (scope_kind, tenant_id, key, value, updated_by)
         VALUES ('tenant', $1, 'auth.oidc.accepted', '[]'::jsonb, $2)`,
        [tenantId, adminId],
        'insert',
      ),
    )
    expect(await provider()).toBeUndefined()

    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.setting SET value = '["essai"]'::jsonb WHERE key = 'auth.oidc.accepted'`,
        [],
        'update',
      ),
    )
    expect((await provider()).slug).toBe('essai')

    await pools.withConnection('catalog', (exec) =>
      exec.query(`DELETE FROM _basedb.setting WHERE key = 'auth.oidc.accepted'`, [], 'delete'),
    )
  })

  it('refuses a provisioning value it does not recognise', async () => {
    // A misspelt setting must close the door, not open it.
    await declare({ provisioning: 'DOMAINS' })
    expect((await provider()).provisioning).toBe('off')
  })
})

describe('§3.3 — the authorization request', () => {
  it('asks for a code with PKCE S256 and a nonce, and nothing implicit', async () => {
    await declare({})
    const started = await startOidc(KEY, await provider(), { redirectUri: REDIRECT })
    const url = new URL(started.authorizeUrl)

    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('response_mode')).toBe('query')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('nonce')).toBeTruthy()
    expect(url.searchParams.get('state')).toBeTruthy()
    // The verifier stays in the browser: only its digest goes to the provider.
    expect(started.authorizeUrl).not.toContain('code_verifier')
  })

  it('never hands back an off-site return target', async () => {
    // An open redirect is what turns a login page into a phishing relay: the browser
    // arrives at an address it trusts and leaves for one it does not.
    await declare({})
    for (const hostile of ['https://ailleurs.example/vol', '//ailleurs.example', 'javascript:1']) {
      const started = await startOidc(KEY, await provider(), {
        redirectUri: REDIRECT,
        returnTo: hostile,
      })
      const url = new URL(started.authorizeUrl)
      const trip = {
        state: url.searchParams.get('state') ?? '',
        nonce: url.searchParams.get('nonce') ?? '',
      }
      nextIdToken = () =>
        signIdToken({ sub: 'retour', nonce: trip.nonce, email: 'x@y.fr', email_verified: true })

      const asserted = await completeOidc(KEY, await provider(), {
        code: 'c',
        state: trip.state,
        cookie: started.exchangeCookie,
      })
      expect(asserted.returnTo).toBe('/')
    }
  }, 60_000)
})

describe('§3.4 — what a forged token does not get past', () => {
  beforeEach(async () => {
    await declare({})
  })

  it('accepts a well-formed token and asserts the identity', async () => {
    const trip = await roundTrip()
    nextIdToken = () =>
      signIdToken({
        sub: 'sujet-123',
        nonce: trip.nonce,
        email: 'Marie@Exemple.fr',
        email_verified: true,
        name: 'Marie Martin',
      })

    const asserted = await completeOidc(KEY, await provider(), {
      code: 'code-de-test',
      state: trip.state,
      cookie: trip.cookie,
    })
    expect(asserted.subject).toBe('sujet-123')
    // The address is folded: a provider may return it in any case.
    expect(asserted.email).toBe('marie@exemple.fr')
    expect(asserted.displayName).toBe('Marie Martin')
  }, 30_000)

  it('refuses a mismatched state, and a missing cookie, with one code', async () => {
    const trip = await roundTrip()
    nextIdToken = () =>
      signIdToken({ sub: 'x', nonce: trip.nonce, email: 'x@y.fr', email_verified: true })

    for (const attempt of [
      { code: 'c', state: 'autre-chose', cookie: trip.cookie },
      { code: 'c', state: trip.state, cookie: undefined },
      { code: undefined, state: trip.state, cookie: trip.cookie },
    ]) {
      expect(await codeOf(completeOidc(KEY, await provider(), attempt))).toBe('OIDC_STATE_INVALID')
    }
  }, 30_000)

  it('refuses a token whose nonce is not the one we sent', async () => {
    // Without this, a token captured from another login at the same provider would be
    // replayable here.
    const trip = await roundTrip()
    nextIdToken = () =>
      signIdToken({ sub: 'x', nonce: 'un-autre-nonce', email: 'x@y.fr', email_verified: true })

    expect(
      await codeOf(
        completeOidc(KEY, await provider(), {
          code: 'c',
          state: trip.state,
          cookie: trip.cookie,
        }),
      ),
    ).toBe('OIDC_TOKEN_INVALID')
  }, 30_000)

  it('refuses an expired token', async () => {
    const trip = await roundTrip()
    nextIdToken = () =>
      signIdToken(
        { sub: 'x', nonce: trip.nonce, email: 'x@y.fr', email_verified: true },
        { expired: true },
      )

    expect(
      await codeOf(
        completeOidc(KEY, await provider(), { code: 'c', state: trip.state, cookie: trip.cookie }),
      ),
    ).toBe('OIDC_TOKEN_INVALID')
  }, 30_000)

  it('refuses a token signed with `alg: none`', async () => {
    // The one forgery every naive verifier accepts.
    const trip = await roundTrip()
    nextIdToken = async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(
        JSON.stringify({
          iss: issuer,
          aud: 'client-de-test',
          sub: 'usurpateur',
          nonce: trip.nonce,
          email: 'admin@exemple.fr',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 600,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString('base64url')
      return `${header}.${payload}.`
    }

    expect(
      await codeOf(
        completeOidc(KEY, await provider(), { code: 'c', state: trip.state, cookie: trip.cookie }),
      ),
    ).toBe('OIDC_TOKEN_INVALID')
  }, 30_000)

  it('refuses a token minted for another audience', async () => {
    const trip = await roundTrip()
    nextIdToken = () =>
      new SignJWT({ sub: 'x', nonce: trip.nonce, email: 'x@y.fr', email_verified: true })
        .setProtectedHeader({ alg: 'RS256', kid: 'essai' })
        .setIssuer(issuer)
        .setAudience('un-autre-client')
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(privateKey)

    expect(
      await codeOf(
        completeOidc(KEY, await provider(), { code: 'c', state: trip.state, cookie: trip.cookie }),
      ),
    ).toBe('OIDC_TOKEN_INVALID')
  }, 30_000)

  it('refuses an unverified address, unless the domain is declared trusted', async () => {
    const trip = await roundTrip()
    nextIdToken = () => signIdToken({ sub: 'x', nonce: trip.nonce, email: 'x@interne.fr' })

    // A provider that lets anyone claim any address would otherwise turn every OIDC
    // login into a takeover of the matching account.
    expect(
      await codeOf(
        completeOidc(KEY, await provider(), { code: 'c', state: trip.state, cookie: trip.cookie }),
      ),
    ).toBe('OIDC_TOKEN_INVALID')

    await declare({ trusted_domains: ['interne.fr'] })
    const second = await roundTrip()
    nextIdToken = () => signIdToken({ sub: 'x', nonce: second.nonce, email: 'x@interne.fr' })
    const asserted = await completeOidc(KEY, await provider(), {
      code: 'c',
      state: second.state,
      cookie: second.cookie,
    })
    expect(asserted.email).toBe('x@interne.fr')
  }, 60_000)
})

describe('§3.5 — attachment is by `sub`, never by address', () => {
  beforeEach(async () => {
    await declare({})
  })

  const asserted = (subject: string, email: string) => ({
    subject,
    email,
    displayName: email,
    returnTo: '/',
  })

  it('REFUSES to adopt an account that merely shares the address', async () => {
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
         VALUES ($1, 'existant@exemple.fr', 'Existant', $2, $2)
         ON CONFLICT DO NOTHING`,
        [tenantId, adminId],
        'insert',
      ),
    )

    expect(
      await codeOf(
        resolveIdentity(
          pools,
          await provider(),
          TENANT_REF,
          asserted('neuf', 'existant@exemple.fr'),
        ),
      ),
    ).toBe('OIDC_ACCOUNT_LINK_REQUIRED')
  })

  it('refuses to provision when provisioning is off', async () => {
    expect(
      await codeOf(
        resolveIdentity(
          pools,
          await provider(),
          TENANT_REF,
          asserted('inconnu', 'inconnu@ailleurs.fr'),
        ),
      ),
    ).toBe('PROVISIONING_REFUSED')
  })

  it('refuses a domain outside the declared list', async () => {
    await declare({ provisioning: 'domains', provisioning_domains: ['maison.fr'] })
    expect(
      await codeOf(
        resolveIdentity(pools, await provider(), TENANT_REF, asserted('dehors', 'x@ailleurs.fr')),
      ),
    ).toBe('PROVISIONING_REFUSED')
  })

  it('provisions inside the list, WITH NO ROLE AT ALL', async () => {
    await declare({ provisioning: 'domains', provisioning_domains: ['maison.fr'] })
    const resolved = await resolveIdentity(
      pools,
      await provider(),
      TENANT_REF,
      asserted('dedans', 'nouvelle@maison.fr'),
    )
    expect(resolved.provisioned).toBe(true)

    const roles = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM _basedb.role_member WHERE user_id = $1',
        [resolved.userId],
      ),
    )
    // It opens a session, sees nothing, and waits for an administrator. Rights are not
    // handed out from a third party's directory.
    expect(roles[0].n).toBe(0)

    // And it can open a session straight away.
    const session = await loginWithOidc(pools, KEY, resolved, {})
    expect(session.sessionToken.startsWith('bds_')).toBe(true)
  })

  it('finds the same account again by `sub`, even after the address changes', async () => {
    await declare({ provisioning: 'domains', provisioning_domains: ['maison.fr'] })
    const first = await resolveIdentity(
      pools,
      await provider(),
      TENANT_REF,
      asserted('stable', 'avant@maison.fr'),
    )
    const second = await resolveIdentity(
      pools,
      await provider(),
      TENANT_REF,
      asserted('stable', 'apres@maison.fr'),
    )

    // The `sub` is stable, the address is not — which is exactly why the link is made
    // on the one and not on the other.
    expect(second.userId).toBe(first.userId)
    expect(second.provisioned).toBe(false)

    const [user] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ email: string }>('SELECT email FROM _basedb.app_user WHERE id = $1', [
        first.userId,
      ]),
    )
    expect(user.email).toBe('apres@maison.fr')
  })
})
