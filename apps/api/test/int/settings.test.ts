import { createSign, generateKeyPairSync } from 'node:crypto'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * One's own settings, over HTTP — chapter 11 §10, chapter 13 §2.6 and §3.5, chapter 16
 * §2.3: the name and the preferences, the address one signs in with, the notifications one
 * refuses, the tokens one minted, and a provider linked from an elevated session.
 *
 * The provider is a real one, small and local, as in the kernel's own OIDC tests: the
 * link goes through discovery, the code exchange and a signed identity token.
 */

const TENANT_REF = 't7regpq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>

type Session = { cookie: string; csrf: string; token: string }

let admin: Session
let alice: Session
let aliceId = ''
let base = ''

/** What the mailer was handed. */
const mails: Array<{ to: string; subject: string; body: string }> = []

/** The fake provider, and what its next `/token` answers. */
let server: Server
let issuer = ''
let nextClaims: Record<string, unknown> = {}
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicJwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'essai', alg: 'RS256' }

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** An RS256 identity token, signed by hand: nothing here needs a JWT library. */
function idToken(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000)
  const head = `${b64({ alg: 'RS256', kid: 'essai', typ: 'JWT' })}.${b64({
    iss: issuer,
    aud: 'client-de-test',
    iat: now,
    exp: now + 600,
    ...claims,
  })}`
  const signature = createSign('RSA-SHA256').update(head).sign(keys.privateKey, 'base64url')
  return `${head}.${signature}`
}

async function signIn(email: string, password: string): Promise<Session> {
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = ((await login.json()) as { data: { csrf: string } }).data.csrf
  return { cookie, csrf, token: await accessFor(cookie, csrf) }
}

async function accessFor(cookie: string, csrf: string): Promise<string> {
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  return ((await issued.json()) as { data: { token: string } }).data.token
}

/** Proves the password again: the session rotates, so a new cookie and token come back. */
async function elevate(session: Session): Promise<Session> {
  const r = await app.request('/auth/elevate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    body: JSON.stringify({ password: PASSWORD }),
  })
  expect(r.status).toBe(200)
  const planted = r.headers.getSetCookie()
  const cookie = planted.find((c) => c.includes('basedb_session'))?.split(';')[0] ?? ''
  const csrf =
    planted
      .find((c) => c.includes('basedb_csrf'))
      ?.split(';')[0]
      ?.split('=')[1] ?? ''
  return { cookie, csrf, token: await accessFor(cookie, csrf) }
}

/** A data route, with the Bearer. */
const call = (session: Session, path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

/** An `/auth` route, with the cookie. */
const own = (session: Session, path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: session.cookie,
      'x-basedb-csrf': session.csrf,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function data<T>(r: Response): Promise<T> {
  return ((await r.json()) as { data: T }).data
}

async function refusal(r: Response): Promise<{ code: string; details?: Record<string, unknown> }> {
  return (await r.json()) as { code: string; details?: Record<string, unknown> }
}

/** An account, its temporary password changed for a known one. */
async function person(email: string, name: string): Promise<{ id: string; session: Session }> {
  const r = await call(admin, `${V1}/admin/users`, 'POST', { email, display_name: name })
  expect(r.status).toBe(201)
  const created = await data<{ user: { id: string }; temporary_password: string }>(r)
  const first = await signIn(email, created.temporary_password)
  const changed = await own(first, '/auth/password/change', 'POST', {
    current: created.temporary_password,
    next: PASSWORD,
  })
  expect(changed.status).toBe(204)
  return { id: created.user.id, session: await signIn(email, PASSWORD) }
}

beforeAll(async () => {
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
      request.resume()
      request.on('end', () => send({ id_token: idToken(nextClaims), token_type: 'Bearer' }))
      return
    }
    response.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    mailer: async (message) => {
      mails.push(message)
    },
    oidcProviders: [
      {
        slug: 'essai',
        label: 'Essai',
        issuer,
        clientId: 'client-de-test',
        clientSecret: 'secret-du-client',
        scopes: 'openid email profile',
        provisioning: 'off',
        provisioningDomains: [],
        trustedDomains: [],
      },
    ],
  })
  await kernel.migrateCatalog()

  const { Client } = await import('pg')
  const client = new Client({ connectionString: container.getConnectionUri() })
  await client.connect()
  await client.query('BEGIN')
  const { rows } = await client.query(
    `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
     VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
     RETURNING id, created_by`,
    [TENANT_REF],
  )
  await client.query(
    `INSERT INTO _basedb.app_user
       (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
     VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
    [rows[0].created_by, rows[0].id],
  )
  await client.query('COMMIT')
  await client.end()

  app = createApp({ kernel, tenantRef: TENANT_REF })
  await kernel.setPassword({ userId: rows[0].created_by, password: PASSWORD })
  admin = await elevate(await signIn('bootstrap@basedb.local', PASSWORD))

  const created = await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Chantiers' })
  base = (await data<{ name: string }>(created)).name
  const table = await call(admin, `${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Visites',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  expect(table.status).toBe(201)
  const tableId = (await data<{ id: string }>(table)).id

  const a = await person('alice@exemple.fr', 'Alice Martin')
  aliceId = a.id
  alice = a.session
  await person('bob@exemple.fr', 'Bob Durand')

  // Alice reads the table: a mention may reach her.
  const group = await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Lecteurs' })
  const groupId = (await data<{ id: string }>(group)).id
  expect(
    (await call(admin, `${V1}/admin/groups/${groupId}/members/${aliceId}`, 'PUT')).status,
  ).toBe(204)
  const granted = await call(admin, `${V1}/admin/access`, 'POST', {
    changes: [{ group: groupId, scope: { kind: 'table', id: tableId }, level: 'read' }],
  })
  expect(granted.status).toBe(200)
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
  await new Promise<void>((resolve) => server?.close(() => resolve()))
})

type MeBody = {
  email: string
  display_name: string
  has_password: boolean
  date_format: string
  week_start: number
  muted_notifications: string[]
}

describe('the profile and the preferences', () => {
  it('reads the defaults on /auth/me', async () => {
    const me = await data<MeBody>(await own(alice, '/auth/me'))
    expect(me).toMatchObject({
      display_name: 'Alice Martin',
      has_password: true,
      date_format: 'dmy',
      week_start: 1,
      muted_notifications: [],
    })
  })

  it('renames oneself and sets how dates read, and answers the account as it now is', async () => {
    const r = await own(alice, '/auth/me', 'PATCH', {
      display_name: '  Alice M.  ',
      date_format: 'iso',
      week_start: 0,
    })
    expect(r.status).toBe(200)
    expect(await data<MeBody>(r)).toMatchObject({
      display_name: 'Alice M.',
      date_format: 'iso',
      week_start: 0,
    })
    // The others read the new name.
    const people = await data<Array<{ id: string; display_name: string }>>(
      await call(admin, `${V1}/meta/users`),
    )
    expect(people.find((p) => p.id === aliceId)?.display_name).toBe('Alice M.')
  })

  it('refuses an empty name, an unknown format, and a change of nothing', async () => {
    expect((await refusal(await own(alice, '/auth/me', 'PATCH', { display_name: ' ' }))).code).toBe(
      'LABEL_EMPTY',
    )
    const format = await refusal(await own(alice, '/auth/me', 'PATCH', { date_format: 'mdy' }))
    expect(format).toMatchObject({ code: 'REQUEST_INVALID', details: { field: 'date_format' } })
    const week = await refusal(await own(alice, '/auth/me', 'PATCH', { week_start: 3 }))
    expect(week).toMatchObject({ code: 'REQUEST_INVALID', details: { field: 'week_start' } })
    expect((await refusal(await own(alice, '/auth/me', 'PATCH', {}))).code).toBe('REQUEST_INVALID')
  })

  it('keeps a language of its own, or none — the browser’s', async () => {
    type Language = { locale: string | null }
    expect((await data<Language>(await own(alice, '/auth/me'))).locale).toBeNull()
    const chosen = await own(alice, '/auth/me', 'PATCH', { locale: 'pt-BR' })
    expect((await data<Language>(chosen)).locale).toBe('pt-BR')
    const unknown = await refusal(await own(alice, '/auth/me', 'PATCH', { locale: 'xx' }))
    expect(unknown).toMatchObject({ code: 'REQUEST_INVALID', details: { field: 'locale' } })
    // `null` is a choice: back to the browser's language.
    const back = await own(alice, '/auth/me', 'PATCH', { locale: null })
    expect((await data<Language>(back)).locale).toBeNull()
  })

  it('wants the session cookie: an access token alone changes nothing', async () => {
    const r = await app.request('/auth/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${alice.token}` },
      body: JSON.stringify({ display_name: 'Quelqu’un d’autre' }),
    })
    expect(r.status).toBe(401)
  })
})

describe('the address one signs in with', () => {
  it('demands an elevated session', async () => {
    const r = await own(alice, '/auth/me/email', 'PUT', { email: 'alice.m@exemple.fr' })
    expect(r.status).toBe(403)
    expect((await refusal(r)).code).toBe('ELEVATION_REQUIRED')
  })

  it('refuses an address another account holds', async () => {
    alice = await elevate(alice)
    const r = await own(alice, '/auth/me/email', 'PUT', { email: 'BOB@exemple.fr' })
    expect(r.status).toBe(409)
    expect((await refusal(r)).code).toBe('EMAIL_TAKEN')
  })

  it('moves the password with the address, and tells the old one', async () => {
    mails.length = 0
    const r = await own(alice, '/auth/me/email', 'PUT', { email: 'alice.m@exemple.fr' })
    expect(r.status).toBe(200)
    expect((await data<MeBody>(r)).email).toBe('alice.m@exemple.fr')

    expect(mails).toHaveLength(1)
    expect(mails[0]?.to).toBe('alice@exemple.fr')
    expect(mails[0]?.body).toContain('alice.m@exemple.fr')
    // No language on the account, none on the request: English.
    expect(mails[0]?.subject).toBe('basedb — your sign-in address has changed')

    // The new address signs in; the old one no longer does.
    alice = await signIn('alice.m@exemple.fr', PASSWORD)
    const old = await app.request('/auth/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@exemple.fr', password: PASSWORD }),
    })
    expect(old.status).toBe(401)
  })
})

describe('the notifications one refuses', () => {
  const unread = async () =>
    ((await (await call(alice, `${V1}/me/notifications`)).json()) as { meta: { unread: number } })
      .meta.unread

  const mention = async () => {
    const row = await call(admin, `${V1}/data/${base}/visites`, 'POST', {
      values: { nom: 'Lyon' },
    })
    expect(row.status).toBe(201)
    const id = (await data<{ _id: string }>(row))._id
    const r = await call(admin, `${V1}/data/${base}/visites/${id}/comments`, 'POST', {
      body: `Tu regardes, @[Alice](user:${aliceId}) ?`,
    })
    expect(r.status).toBe(201)
    // Refused, a mention is not « unreachable »: Alice can read the row.
    expect(((await r.json()) as { meta: { unreachable: string[] } }).meta.unreachable).toEqual([])
  }

  it('refuses an unknown nature', async () => {
    const r = await own(alice, '/auth/me', 'PATCH', { muted_notifications: ['mention', 'tout'] })
    expect(await refusal(r)).toMatchObject({
      code: 'REQUEST_INVALID',
      details: { field: 'muted_notifications' },
    })
  })

  it('writes nothing for a refused nature, and again once it is accepted', async () => {
    const before = await unread()
    const muted = await own(alice, '/auth/me', 'PATCH', { muted_notifications: ['mention'] })
    expect((await data<MeBody>(muted)).muted_notifications).toEqual(['mention'])
    await mention()
    expect(await unread()).toBe(before)

    await own(alice, '/auth/me', 'PATCH', { muted_notifications: [] })
    await mention()
    expect(await unread()).toBe(before + 1)
  })
})

describe('the tokens one minted', () => {
  type Own = {
    id: string
    label: string
    revoked_at: string | null
    base: { name: string; label: string } | null
  }

  it('lists them on every base, with the base they open — and only one’s own', async () => {
    const other = await data<{ name: string }>(
      await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Éphémère' }),
    )
    const minted = await call(admin, `${V1}/admin/tokens`, 'POST', {
      label: 'Synchronisation',
      base: other.name,
      access: 'read',
    })
    expect(minted.status).toBe(201)
    const tokenId = (await data<{ id: string }>(minted)).id

    const mine = await data<Own[]>(await call(admin, `${V1}/me/tokens`))
    expect(mine.find((t) => t.id === tokenId)).toMatchObject({
      label: 'Synchronisation',
      base: { name: other.name, label: 'Éphémère' },
    })
    expect(await data<Own[]>(await call(alice, `${V1}/me/tokens`))).toEqual([])

    // Someone else, elevated, still cannot close it: it is neither theirs nor their base.
    alice = await elevate(alice)
    expect((await call(alice, `${V1}/admin/tokens/${tokenId}`, 'DELETE')).status).not.toBe(204)

    // Its base gone, its creator still closes it.
    expect((await call(admin, `${V1}/admin/bases/${other.name}`, 'DELETE')).status).toBe(200)
    const orphan = (await data<Own[]>(await call(admin, `${V1}/me/tokens`))).find(
      (t) => t.id === tokenId,
    )
    expect(orphan?.base).toBeNull()
    admin = await elevate(admin)
    expect((await call(admin, `${V1}/admin/tokens/${tokenId}`, 'DELETE')).status).toBe(204)
    const revoked = (await data<Own[]>(await call(admin, `${V1}/me/tokens`))).find(
      (t) => t.id === tokenId,
    )
    expect(revoked?.revoked_at).not.toBeNull()
  })
})

describe('a provider linked from the settings', () => {
  type Ways = {
    password: boolean
    providers: Array<{ slug: string; label: string; linked_at: string | null }>
  }

  /** Opens a link exchange, then comes back from the provider as the browser would. */
  async function linkAs(session: Session, subject: string, email: string) {
    const opened = await own(session, '/auth/oidc/essai/link', 'POST', {
      return_to: '/?parametres=profil&lien=essai',
    })
    expect(opened.status).toBe(200)
    const exchange =
      opened.headers
        .getSetCookie()
        .find((c) => c.includes('basedb_oidc'))
        ?.split(';')[0] ?? ''
    const url = new URL((await data<{ url: string }>(opened)).url)
    nextClaims = {
      sub: subject,
      nonce: url.searchParams.get('nonce'),
      email,
      email_verified: true,
    }
    // The return is a cross-site navigation: the session cookie does not ride it, only the
    // exchange's.
    return app.request(
      `/auth/oidc/essai/callback?code=code-de-test&state=${encodeURIComponent(
        url.searchParams.get('state') ?? '',
      )}`,
      { headers: { cookie: exchange } },
    )
  }

  it('lists the providers of the instance, none linked yet', async () => {
    const ways = await data<Ways>(await own(admin, '/auth/identities'))
    expect(ways).toEqual({
      password: true,
      providers: [{ slug: 'essai', label: 'Essai', linked_at: null, last_used_at: null }],
    })
  })

  it('demands an elevated session to open the exchange', async () => {
    const fresh = await signIn('bootstrap@basedb.local', PASSWORD)
    const r = await own(fresh, '/auth/oidc/essai/link', 'POST', {})
    expect(r.status).toBe(403)
    expect((await refusal(r)).code).toBe('ELEVATION_REQUIRED')
  })

  it('links on the return, opens no session, and comes back to the settings', async () => {
    admin = await elevate(admin)
    const back = await linkAs(admin, 'sujet-admin', 'admin@fournisseur.fr')
    expect(back.status).toBe(302)
    expect(back.headers.get('location')).toBe('/?parametres=profil&lien=essai')
    expect(back.headers.getSetCookie().some((c) => c.includes('basedb_session='))).toBe(false)

    const ways = await data<Ways>(await own(admin, '/auth/identities'))
    expect(ways.providers[0]?.linked_at).not.toBeNull()
  })

  it('refuses, in words, an identity that already opens another account', async () => {
    const bob = await elevate(await signIn('bob@exemple.fr', PASSWORD))
    const back = await linkAs(bob, 'sujet-admin', 'admin@fournisseur.fr')
    expect(back.status).toBe(302)
    expect(back.headers.get('location')).toBe(
      '/?connexion=REQUEST_INVALID&raison=identite_deja_liee',
    )
    const ways = await data<Ways>(await own(bob, '/auth/identities'))
    expect(ways.providers[0]?.linked_at).toBeNull()
  })

  it('unlinks from an elevated session', async () => {
    admin = await elevate(admin)
    expect((await own(admin, '/auth/oidc/essai/link', 'DELETE')).status).toBe(204)
    const ways = await data<Ways>(await own(admin, '/auth/identities'))
    expect(ways.providers[0]?.linked_at).toBeNull()
  })
})
