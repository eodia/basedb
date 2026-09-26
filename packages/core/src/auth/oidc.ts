import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose'
import { ensureSystemGroups } from '../admin/groups.js'
import { BasedbError } from '../errors/index.js'
import type { Executor, Pools } from '../runtime/pool.js'
import type { OidcProvider } from './oidc-providers.js'
import { seal, unseal } from './sealing.js'
import { readPolicy } from './signup.js'

/**
 * OIDC — chapter 13 §3.
 *
 * Authorization code with PKCE `S256`, confidential client, `response_mode=query`,
 * mandatory nonce. The implicit and hybrid flows are excluded: they carry an identity
 * token through the URL, hence through browser history, the `Referer` header and every
 * intermediary's logs. PKCE is added ON TOP of the client secret because it neutralizes
 * interception of the code on the way back, which the secret does not protect.
 *
 * The exchange state travels in a sealed cookie. NO SERVER STORAGE, hence no table (A4):
 * ten minutes of state for a flow that either completes or is abandoned does not deserve
 * a row, a write and an expiry sweep.
 */

/** §3.3 — the exchange cookie, and its life. */
export const OIDC_COOKIE = '__Host-basedb_oidc'
export const EXCHANGE_TTL_MS = 10 * 60 * 1000

/** §3.4 point 3 — clock tolerance between us and the provider. */
const CLOCK_TOLERANCE_S = 120

/** §3.4 point 1 — asymmetric only. `none` and the symmetric families are refused. */
const ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512']

/** A network call to a provider never blocks a request indefinitely. */
const HTTP_TIMEOUT_MS = 10_000

/** What the discovery document gives us, and nothing more. */
interface Discovery {
  readonly issuer: string
  readonly authorization_endpoint: string
  readonly token_endpoint: string
  readonly jwks_uri: string
  readonly token_endpoint_auth_methods_supported?: readonly string[]
}

interface CachedDiscovery {
  readonly document: Discovery
  readonly fetchedAt: number
  readonly jwks: ReturnType<typeof createRemoteJWKSet>
}

/**
 * Discovery documents and their key sets, cached per process.
 *
 * `createRemoteJWKSet` does the part that matters: it caches the keys and refreshes them
 * on an unknown `kid`, at most once a minute — which is §3.4 point 1, and which one
 * should not write by hand.
 */
const discoveries = new Map<string, CachedDiscovery>()
const DISCOVERY_TTL_MS = 60 * 60 * 1000

/** For the tests, and for a process that wants to start from a known state. */
export function forgetDiscoveries(): void {
  discoveries.clear()
}

async function discover(issuer: string, now: number): Promise<CachedDiscovery> {
  const cached = discoveries.get(issuer)
  if (cached !== undefined && now - cached.fetchedAt < DISCOVERY_TTL_MS) return cached

  const url = issuer.endsWith('/.well-known/openid-configuration')
    ? issuer
    : `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`

  const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) }).catch(
    () => null,
  )
  // A provider that cannot be reached is an incident, not a caller error: the person in
  // front of the screen did nothing wrong and can do nothing about it.
  if (response === null || !response.ok) {
    throw new BasedbError('INTERNAL_ERROR', { details: { issuer } })
  }

  const document = (await response.json()) as Discovery
  if (
    typeof document.authorization_endpoint !== 'string' ||
    typeof document.token_endpoint !== 'string' ||
    typeof document.jwks_uri !== 'string'
  ) {
    throw new BasedbError('INTERNAL_ERROR', { details: { issuer } })
  }

  const entry: CachedDiscovery = {
    document,
    fetchedAt: now,
    jwks: createRemoteJWKSet(new URL(document.jwks_uri), { timeoutDuration: HTTP_TIMEOUT_MS }),
  }
  discoveries.set(issuer, entry)
  return entry
}

/** The state of one exchange, as the sealed cookie carries it. */
interface Exchange {
  readonly slug: string
  readonly state: string
  readonly nonce: string
  readonly verifier: string
  readonly redirectUri: string
  readonly returnTo: string
  readonly expiresAt: number
}

/**
 * Opens an exchange — `GET /auth/oidc/{slug}/start`.
 *
 * The verifier is kept in the cookie and never leaves the browser; only its `S256`
 * digest goes to the provider. That is the whole of PKCE: whoever intercepts the code on
 * the way back cannot exchange it without the verifier.
 */
export async function startOidc(
  instanceKey: string,
  provider: OidcProvider,
  request: { readonly redirectUri: string; readonly returnTo?: string; readonly now?: Date },
): Promise<{ authorizeUrl: string; exchangeCookie: string }> {
  const now = request.now ?? new Date()
  const { document } = await discover(provider.issuer, now.getTime())

  const verifier = randomBytes(32).toString('base64url')
  const exchange: Exchange = {
    slug: provider.slug,
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier,
    redirectUri: request.redirectUri,
    // Only a path is kept, never an absolute address: an open redirect is what turns a
    // login page into a phishing relay.
    returnTo: safeReturn(request.returnTo),
    expiresAt: now.getTime() + EXCHANGE_TTL_MS,
  }

  const parameters = new URLSearchParams({
    response_type: 'code',
    response_mode: 'query',
    client_id: provider.clientId,
    redirect_uri: request.redirectUri,
    scope: provider.scopes,
    state: exchange.state,
    nonce: exchange.nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  })

  return {
    authorizeUrl: `${document.authorization_endpoint}?${parameters}`,
    exchangeCookie: seal(instanceKey, 'oidc-exchange', JSON.stringify(exchange)),
  }
}

/** Keeps a return target to a path of this application. */
function safeReturn(candidate: string | undefined): string {
  if (candidate === undefined) return '/'
  // A leading `//` is a protocol-relative address, which browsers follow off-site.
  return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/'
}

/** The identity a provider asserted, once every check of §3.4 has passed. */
export interface AssertedIdentity {
  readonly subject: string
  readonly email: string
  readonly displayName: string
  readonly returnTo: string
}

/**
 * Completes an exchange — `GET /auth/oidc/{slug}/callback`.
 *
 * Every refusal here is `OIDC_STATE_INVALID` or `OIDC_TOKEN_INVALID`, WITHOUT detail:
 * the caller is either a legitimate browser coming back, in which case nothing is wrong,
 * or something else, in which case a reason is a hint.
 */
export async function completeOidc(
  instanceKey: string,
  provider: OidcProvider,
  request: {
    readonly code: string | undefined
    readonly state: string | undefined
    readonly cookie: string | undefined
    readonly now?: Date
  },
): Promise<AssertedIdentity> {
  const now = request.now ?? new Date()

  const raw =
    request.cookie === undefined ? null : unseal(instanceKey, 'oidc-exchange', request.cookie)
  if (raw === null || request.code === undefined || request.state === undefined) {
    throw new BasedbError('OIDC_STATE_INVALID')
  }

  const exchange = JSON.parse(raw) as Exchange
  // Expired, for another provider, or a state that does not match: one refusal. The
  // comparison is constant time, as §3.4 point 4 requires.
  if (
    exchange.expiresAt <= now.getTime() ||
    exchange.slug !== provider.slug ||
    !constantEquals(exchange.state, request.state)
  ) {
    throw new BasedbError('OIDC_STATE_INVALID')
  }

  const { document, jwks } = await discover(provider.issuer, now.getTime())
  const idToken = await exchangeCode(document, provider, exchange, request.code)

  let payload: JWTPayload
  try {
    const verified = await jwtVerify(idToken, jwks, {
      issuer: document.issuer,
      audience: provider.clientId,
      algorithms: ALGORITHMS,
      clockTolerance: CLOCK_TOLERANCE_S,
    })
    payload = verified.payload
  } catch {
    throw new BasedbError('OIDC_TOKEN_INVALID')
  }

  // `azp` is checked only when present, and then it must be us: a token minted for
  // another client and merely audienced to us is not a login to this application.
  const azp = payload.azp
  if (typeof azp === 'string' && azp !== provider.clientId) {
    throw new BasedbError('OIDC_TOKEN_INVALID')
  }

  if (typeof payload.nonce !== 'string' || !constantEquals(payload.nonce, exchange.nonce)) {
    throw new BasedbError('OIDC_TOKEN_INVALID')
  }

  const subject = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  if (subject === '') throw new BasedbError('OIDC_TOKEN_INVALID')

  const email = await addressOf(document, provider, payload, idToken)
  return {
    subject,
    email,
    displayName:
      typeof payload.name === 'string' && payload.name.trim() !== '' ? payload.name.trim() : email,
    returnTo: exchange.returnTo,
  }
}

/**
 * Trades the code for an identity token.
 *
 * The provider's access token is neither stored nor reused, and no refresh token is
 * asked for: basedb calls no API of the provider, so holding either would be keeping a
 * credential for nothing — which is how credentials leak.
 */
async function exchangeCode(
  document: Discovery,
  provider: OidcProvider,
  exchange: Exchange,
  code: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: exchange.redirectUri,
    code_verifier: exchange.verifier,
    client_id: provider.clientId,
  })

  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' }
  const methods = document.token_endpoint_auth_methods_supported ?? ['client_secret_basic']
  if (methods.includes('client_secret_basic')) {
    const credentials = `${encodeURIComponent(provider.clientId)}:${encodeURIComponent(provider.clientSecret)}`
    headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`
  } else {
    body.set('client_secret', provider.clientSecret)
  }

  const response = await fetch(document.token_endpoint, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  }).catch(() => null)

  if (response === null || !response.ok) throw new BasedbError('OIDC_TOKEN_INVALID')

  const payload = (await response.json().catch(() => null)) as { id_token?: unknown } | null
  if (payload === null || typeof payload.id_token !== 'string') {
    throw new BasedbError('OIDC_TOKEN_INVALID')
  }
  return payload.id_token
}

/**
 * The address, and the condition on which it is believed — §3.4 point 5.
 *
 * `userinfo` is queried ONLY when the identity token carries no address: one round trip
 * we can avoid on every login is one we should.
 */
async function addressOf(
  document: Discovery,
  provider: OidcProvider,
  payload: JWTPayload,
  idToken: string,
): Promise<string> {
  let email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  let verified = payload.email_verified === true

  if (email === '') {
    const endpoint = `${document.issuer.replace(/\/$/, '')}/userinfo`
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    }).catch(() => null)

    if (response?.ok === true) {
      const info = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (typeof info.email === 'string') email = info.email.trim().toLowerCase()
      verified = verified || info.email_verified === true
    }
  }

  if (email === '') throw new BasedbError('OIDC_TOKEN_INVALID')

  // An unverified address is accepted only where the operator has said this provider
  // verifies it. Without that, a provider letting anyone claim any address would turn
  // every OIDC login into a takeover of the matching account.
  const domain = email.slice(email.lastIndexOf('@') + 1)
  if (!verified && !provider.trustedDomains.includes(domain)) {
    throw new BasedbError('OIDC_TOKEN_INVALID')
  }
  return email
}

function constantEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Turns an asserted identity into a basedb user — §3.5.
 *
 * ATTACHMENT IS BY `sub`, NEVER BY ADDRESS. A provider that lets someone claim an
 * address it has not verified would otherwise turn every OIDC login into a takeover of
 * the matching password account. The link is made in the other direction: sign in with
 * the password, then `POST /auth/oidc/{slug}/link` from an elevated session.
 */
export async function resolveIdentity(
  pools: Pools,
  provider: OidcProvider,
  tenantRef: string,
  asserted: AssertedIdentity,
): Promise<{ userId: string; tenantId: string; provisioned: boolean }> {
  return pools.withConnection('catalog', async (exec) => {
    const [tenant] = await exec.query<{ id: string; created_by: string }>(
      'SELECT id, created_by FROM _basedb.tenant WHERE ref = $1',
      [tenantRef],
    )
    if (tenant === undefined) throw new BasedbError('OIDC_PROVIDER_UNKNOWN')

    // 1. A link already exists for this `sub`.
    const existing = await exec.query<{ user_id: string }>(
      `SELECT i.user_id
         FROM _basedb.auth_identity i
         JOIN _basedb.app_user u ON u.id = i.user_id
        WHERE i.provider = $1 AND i.subject = $2
          AND u.tenant_id = $3 AND u.disabled_at IS NULL AND u.deleted_at IS NULL`,
      [`oidc:${provider.slug}`, asserted.subject, tenant.id],
    )
    const linked = existing[0]?.user_id
    if (linked !== undefined) {
      // The address follows the provider, but only into a place that is free.
      await exec.query(
        `UPDATE _basedb.app_user u
            SET email = $2
          WHERE u.id = $1 AND lower(u.email) <> $2
            AND NOT EXISTS (
              SELECT 1 FROM _basedb.app_user o
               WHERE o.tenant_id = u.tenant_id AND lower(o.email) = $2 AND o.id <> u.id)`,
        [linked, asserted.email],
        'update',
      )
      return { userId: linked, tenantId: tenant.id, provisioned: false }
    }

    // 2. The address belongs to a live account with no identity for this provider.
    const byAddress = await exec.query<{ id: string }>(
      `SELECT id FROM _basedb.app_user
        WHERE tenant_id = $1 AND lower(email) = $2
          AND disabled_at IS NULL AND deleted_at IS NULL`,
      [tenant.id, asserted.email],
    )
    if (byAddress.length > 0) {
      // The residual disclosure is assumed by §3.5: this tells the caller that the
      // address they just proved at the provider has an account here. They already
      // demonstrated control of it, so the rule of §2.5 does not reach this far.
      throw new BasedbError('OIDC_ACCOUNT_LINK_REQUIRED', { details: { slug: provider.slug } })
    }

    // 3. Nobody matches: provisioning decides, and it is OFF by default.
    const domain = asserted.email.slice(asserted.email.lastIndexOf('@') + 1).toLowerCase()
    let admitted = false
    if (provider.provisioning === 'domains') {
      admitted = provider.provisioningDomains.includes(domain)
    } else if (provider.provisioning === 'signup') {
      // As a password sign-up would be: open, and on an admitted domain (chapter 13 §8).
      const policy = await readPolicy(exec, tenantRef)
      admitted = policy.open && (policy.domains.length === 0 || policy.domains.includes(domain))
    }
    if (!admitted) {
      throw new BasedbError('PROVISIONING_REFUSED', { details: { slug: provider.slug } })
    }

    const [created] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4) RETURNING id`,
      [tenant.id, asserted.email, asserted.displayName, tenant.created_by],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.auth_identity (user_id, provider, subject)
       VALUES ($1, $2, $3)`,
      [created.id, `oidc:${provider.slug}`, asserted.subject],
      'insert',
    )

    // The account is created WITH NO RIGHT: it opens a session, sees nothing, and waits —
    // for an administrator, or for someone to share a project with it. Rights are not
    // handed out from a third party's directory. Created as a sign-up, it belongs to
    // « Tous les utilisateurs », as every account signed up with a password does.
    if (provider.provisioning === 'signup') await ensureSystemGroups(exec, tenantRef, created.id)
    return { userId: created.id, tenantId: tenant.id, provisioned: true }
  })
}

/** Links an OIDC identity to the caller's account — requires an elevated session. */
export async function linkIdentity(
  exec: Executor,
  provider: OidcProvider,
  userId: string,
  subject: string,
): Promise<void> {
  await exec.query(
    `INSERT INTO _basedb.auth_identity (user_id, provider, subject)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider, subject) DO NOTHING`,
    [userId, `oidc:${provider.slug}`, subject],
    'insert',
  )
}

/**
 * Unlinks one — refused on the last identity.
 *
 * An account with no identity at all is an account nobody can sign into, and nothing in
 * the product would say so until someone tried.
 */
export async function unlinkIdentity(exec: Executor, slug: string, userId: string): Promise<void> {
  const remaining = await exec.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM _basedb.auth_identity WHERE user_id = $1',
    [userId],
  )
  if ((remaining[0]?.n ?? 0) <= 1) {
    throw new BasedbError('REQUEST_INVALID', { details: { reason: 'derniere_identite' } })
  }

  await exec.query(
    'DELETE FROM _basedb.auth_identity WHERE user_id = $1 AND provider = $2',
    [userId, `oidc:${slug}`],
    'delete',
  )
}
