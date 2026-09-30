import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Token introspection, RFC 7662 — chapter 13 §11: another application asks whether a token
 * it was handed is good, and whose it is. It proves who it is with an integration token of
 * the workspace; every token that is not good reads alike, `{ active: false }`, and a
 * session closed a second ago is inactive at once.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>

type Session = { cookie: string; csrf: string; token: string }
let admin: Session
let userId = ''
/** The application's own credential: an integration token of the workspace. */
let application = ''
let baseId = ''

const json = async <T>(response: Response) => (await response.json()) as T

async function accessFor(cookie: string, csrf: string): Promise<string> {
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  return (await json<{ data: { token: string } }>(issued)).data.token
}

async function signIn(): Promise<Session> {
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@basedb.local', password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = (await json<{ data: { csrf: string } }>(login)).data.csrf
  return { cookie, csrf, token: await accessFor(cookie, csrf) }
}

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

const call = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
  const r = await app.request(`${V1}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${admin.token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  expect(r.status, await r.clone().text()).toBeLessThan(300)
  return r.status === 204 ? (undefined as T) : (await json<{ data: T }>(r)).data
}

/** Asks about `token` as the application, in a form as RFC 7662 writes it. */
const introspect = (token: string, caller: string | null = application) =>
  app.request('/auth/introspect', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(caller === null ? {} : { authorization: `Bearer ${caller}` }),
    },
    body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString(),
  })

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT_REF, email: 'admin@basedb.local' })
  userId = boot.userId
  await kernel.setPassword({ userId, password: PASSWORD })
  app = createApp({ kernel })
  admin = await elevate(await signIn())

  const group = await call<{ id: string }>('/admin/groups', 'POST', { label: 'Support' })
  await call(`/admin/groups/${group.id}/members/${userId}`, 'PUT')
  const base = await call<{ id: string; name: string }>('/admin/bases', 'POST', { label: 'Chat' })
  baseId = base.id
  application = (
    await call<{ secret: string }>('/admin/tokens', 'POST', {
      label: 'Chat',
      base: base.name,
      access: 'read',
    })
  ).secret
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('token introspection', () => {
  it("tells whose a person's access token is, with their groups", async () => {
    const r = await introspect(admin.token)
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    const answer = await json<Record<string, unknown>>(r)
    expect(answer).toMatchObject({
      active: true,
      token_type: 'access_token',
      sub: userId,
      email: 'admin@basedb.local',
      username: 'admin@basedb.local',
      tenant: TENANT_REF,
      groups: expect.arrayContaining(['Support']),
    })
    expect(answer.exp).toBeGreaterThan(Date.now() / 1000)
  })

  it('reads a JSON body as well as a form', async () => {
    const r = await app.request('/auth/introspect', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${application}` },
      body: JSON.stringify({ token: admin.token }),
    })
    expect(await json<{ active: boolean }>(r)).toMatchObject({ active: true, sub: userId })
  })

  it('tells what an integration token opens', async () => {
    const answer = await json<Record<string, unknown>>(await introspect(application))
    expect(answer).toMatchObject({
      active: true,
      token_type: 'integration_token',
      sub: userId,
      tenant: TENANT_REF,
      base: baseId,
      access: 'read',
    })
    expect(answer.surfaces).toContain('rest')
    expect(answer.iat).toBeLessThanOrEqual(Date.now() / 1000)
  })

  it('answers every token that is not good alike', async () => {
    for (const token of [
      '',
      'nimporte-quoi',
      `${admin.token.slice(0, -4)}AAAA`,
      `bdb_abcdefgh_${'0'.repeat(43)}`,
      // Well formed, naming no session a catalog could hold.
      `bda_${Buffer.from(`pas-une-session.${Date.now() + 60_000}.signature`).toString('base64url')}`,
    ]) {
      const r = await introspect(token)
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ active: false })
    }
  })

  it('refuses an application that does not prove who it is', async () => {
    expect((await introspect(admin.token, null)).status).toBe(401)
    // A person's access token is not an application's credential.
    expect((await introspect(admin.token, admin.token)).status).toBe(401)
  })

  it('says inactive as soon as the session is closed', async () => {
    const other = await signIn()
    expect((await json<{ active: boolean }>(await introspect(other.token))).active).toBe(true)
    await app.request('/auth/session', { method: 'DELETE', headers: { cookie: other.cookie } })
    expect(await json(await introspect(other.token))).toEqual({ active: false })
  })

  it('says inactive once the integration token is revoked', async () => {
    const own = await call<{ id: string; secret: string }>('/admin/tokens', 'POST', {
      label: 'Jetable',
      base: baseId,
      access: 'write',
    })
    expect(await json(await introspect(own.secret))).toMatchObject({
      active: true,
      access: 'write',
    })
    await call(`/admin/tokens/${own.id}`, 'DELETE')
    expect(await json(await introspect(own.secret))).toEqual({ active: false })
  })
})
