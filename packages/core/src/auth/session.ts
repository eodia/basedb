import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { BasedbError } from '../errors/index.js'
import type { Executor, Pools } from '../runtime/pool.js'

/**
 * Sessions and access tokens — chapter 13 §4.
 *
 * A session token lives in a cookie and is accepted by `/auth/*` ALONE. Calls to
 * `/api/v1` carry an access token in `Authorization: Bearer`, obtained against the
 * cookie. Two credentials, two surfaces, and a browser that cannot be made to call the
 * data API by a foreign page just because it holds a cookie.
 *
 * The access token is DERIVED from the session and stored nowhere:
 *
 *   bda_ + base64url( session_id ‖ expires_at ‖ HMAC(key, session_id ‖ expires_at ‖ token_hash) )
 *
 * It therefore needs neither a column nor a table, and it carries its binding to the
 * session: rotating `session.token_hash` invalidates every access token ever minted from
 * it, instantly — global revocation with nothing to walk.
 */

/** §4.2, and they are values, not settings. */
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000
export const SESSION_INACTIVITY_MS = 12 * 60 * 60 * 1000
export const ACCESS_TOKEN_MS = 15 * 60 * 1000
/** `last_seen_at` is written at most this often: it is on the hottest path there is. */
export const TOUCH_THROTTLE_MS = 5 * 60 * 1000
/** Beyond this many live sessions, the oldest is revoked. */
export const SESSION_CAP = 10

export const SESSION_COOKIE = '__Host-basedb_session'
/**
 * The CSRF token's cookie — READABLE by the page's own scripts, unlike the session one.
 *
 * That is the point of a double submit: a foreign page can make the browser SEND a
 * cookie, but it cannot READ one belonging to another origin, so it cannot echo the
 * value into a header. The protection therefore rests on the browser's origin rules
 * alone, and not on the CORS configuration being right.
 *
 * It also survives a page reload, where memory does not — which is what lets a returning
 * visitor mint an access token without logging in again.
 */
export const CSRF_COOKIE = '__Host-basedb_csrf'
export const CSRF_HEADER = 'x-basedb-csrf'

const SESSION_PREFIX = 'bds_'
const ACCESS_PREFIX = 'bda_'

export interface SessionSnapshot {
  readonly sessionId: string
  readonly userId: string
  readonly tenantRef: string
  readonly tokenHash: Buffer
  readonly createdAt: Date
  readonly lastSeenAt: Date
  readonly absoluteExpiresAt: Date
  readonly elevatedUntil: Date | null
  readonly revokedAt: Date | null
  readonly ip: string | null
  readonly userAgent: string | null
  /** The account itself: disabled or logically deleted closes every session it owns. */
  readonly userUsable: boolean
}

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest()

/** A fresh session token: 256 bits, base64url, prefixed. */
export function newSessionToken(): { token: string; hash: Buffer } {
  const token = `${SESSION_PREFIX}${randomBytes(32).toString('base64url')}`
  return { token, hash: sha256(token) }
}

/**
 * The CSRF token handed over beside the cookie, and echoed in `X-Basedb-Csrf`.
 *
 * DERIVED from the session rather than stored, exactly like the access token: the
 * server recomputes it to compare, so it needs no column — and rotating the session
 * invalidates it along with everything else. A foreign page can make a browser send the
 * cookie; it cannot make it send this header.
 */
export function csrfFor(instanceKey: string, tokenHash: Buffer): string {
  return createHmac('sha256', instanceKey)
    .update('basedb/csrf/v1')
    .update(tokenHash)
    .digest('base64url')
}

export function csrfValid(
  instanceKey: string,
  tokenHash: Buffer,
  given: string | undefined,
): boolean {
  if (given === undefined) return false
  const expected = Buffer.from(csrfFor(instanceKey, tokenHash))
  const candidate = Buffer.from(given)
  return expected.length === candidate.length && timingSafeEqual(expected, candidate)
}

/**
 * Opens a session, and enforces the cap of ten.
 *
 * The cap bounds a small, hot table and — more usefully — keeps the session list
 * readable at a glance by its owner, which is what makes unit revocation usable at all.
 */
export async function createSession(
  exec: Executor,
  request: {
    readonly userId: string
    readonly tenantId: string
    readonly ip?: string | null
    readonly userAgent?: string | null
    readonly now: Date
  },
): Promise<{ token: string; sessionId: string; absoluteExpiresAt: Date }> {
  const { token, hash } = newSessionToken()
  const absoluteExpiresAt = new Date(request.now.getTime() + SESSION_ABSOLUTE_MS)

  const [row] = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.session
       (user_id, tenant_id, token_hash, absolute_expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      request.userId,
      request.tenantId,
      hash,
      absoluteExpiresAt.toISOString(),
      request.ip ?? null,
      // Truncated: a user agent is unbounded input, and the column is read back into a
      // list the owner is shown.
      request.userAgent === null || request.userAgent === undefined
        ? null
        : request.userAgent.slice(0, 200),
    ],
    'insert',
  )

  // Over the cap, the OLDEST live session goes — never the one just opened, which would
  // lock out a user whose ten other sessions are stale browser tabs.
  await exec.query(
    `UPDATE _basedb.session
        SET revoked_at = clock_timestamp(), revoked_reason = 'session_cap'
      WHERE id IN (
        SELECT id FROM _basedb.session
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY created_at DESC
         OFFSET $2
      )`,
    [request.userId, SESSION_CAP],
    'update',
  )

  return { token, sessionId: row.id, absoluteExpiresAt }
}

/** Reads a session by its token, in constant time with respect to the token. */
export async function loadSessionByToken(
  exec: Executor,
  token: string,
): Promise<SessionSnapshot | null> {
  if (!token.startsWith(SESSION_PREFIX)) return null
  const expected = sha256(token)
  const snapshot = await loadSessionBy(exec, 'token_hash = $1', [expected])
  if (snapshot === null) return null
  // The lookup was already an equality on the digest; this makes the comparison explicit
  // and constant time, as §4.1 requires.
  return snapshot.tokenHash.length === expected.length &&
    timingSafeEqual(snapshot.tokenHash, expected)
    ? snapshot
    : null
}

export async function loadSessionById(
  exec: Executor,
  sessionId: string,
): Promise<SessionSnapshot | null> {
  return loadSessionBy(exec, 's.id = $1', [sessionId])
}

async function loadSessionBy(
  exec: Executor,
  where: string,
  values: readonly unknown[],
): Promise<SessionSnapshot | null> {
  const rows = await exec.query<{
    id: string
    user_id: string
    tenant_ref: string
    token_hash: Buffer
    created_at: Date
    last_seen_at: Date
    absolute_expires_at: Date
    elevated_until: Date | null
    revoked_at: Date | null
    ip: string | null
    user_agent: string | null
    user_usable: boolean
  }>(
    `SELECT s.id, s.user_id, t.ref AS tenant_ref, s.token_hash,
            s.created_at, s.last_seen_at, s.absolute_expires_at,
            s.elevated_until, s.revoked_at, host(s.ip) AS ip, s.user_agent,
            (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS user_usable
       FROM _basedb.session s
       JOIN _basedb.app_user u ON u.id = s.user_id
       JOIN _basedb.tenant t   ON t.id = s.tenant_id
      WHERE ${where}`,
    values,
  )

  const row = rows[0]
  if (row === undefined) return null
  return {
    sessionId: row.id,
    userId: row.user_id,
    tenantRef: row.tenant_ref,
    tokenHash: row.token_hash,
    createdAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_seen_at),
    absoluteExpiresAt: new Date(row.absolute_expires_at),
    elevatedUntil: row.elevated_until === null ? null : new Date(row.elevated_until),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
    ip: row.ip,
    userAgent: row.user_agent,
    userUsable: row.user_usable,
  }
}

/**
 * Is this session still usable, at this instant?
 *
 * Four independent reasons to say no, re-read on EVERY request. The 15 minutes of an
 * access token are a renewal period, not an unverified validity window: a revocation
 * takes effect in 30 seconds at worst — the freshness bound of the snapshot — never in
 * fifteen minutes.
 */
export function sessionUsable(snapshot: SessionSnapshot, now: Date): boolean {
  if (snapshot.revokedAt !== null) return false
  if (!snapshot.userUsable) return false
  if (snapshot.absoluteExpiresAt.getTime() <= now.getTime()) return false
  return now.getTime() - snapshot.lastSeenAt.getTime() < SESSION_INACTIVITY_MS
}

/** Mints an access token bound to the session. Nothing is written. */
export function mintAccessToken(
  instanceKey: string,
  snapshot: SessionSnapshot,
  now: Date,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + ACCESS_TOKEN_MS)
  const payload = `${snapshot.sessionId}.${expiresAt.getTime()}`
  const signature = signAccess(instanceKey, payload, snapshot.tokenHash)
  const token = `${ACCESS_PREFIX}${Buffer.from(`${payload}.${signature}`).toString('base64url')}`
  return { token, expiresAt }
}

function signAccess(instanceKey: string, payload: string, tokenHash: Buffer): string {
  return createHmac('sha256', instanceKey).update(payload).update(tokenHash).digest('base64url')
}

/** What an access token claims, before anything has been checked. */
export interface AccessClaim {
  readonly sessionId: string
  readonly expiresAt: Date
  readonly signature: string
  readonly payload: string
}

/**
 * Decodes an access token WITHOUT trusting it.
 *
 * Returns the session it claims, so the caller can load that session and only then
 * verify the signature against its `token_hash`. Splitting decode from verify is what
 * lets the signature be checked against a secret the token does not carry.
 */
export function decodeAccessToken(token: string): AccessClaim | null {
  if (!token.startsWith(ACCESS_PREFIX)) return null
  let decoded: string
  try {
    decoded = Buffer.from(token.slice(ACCESS_PREFIX.length), 'base64url').toString('utf8')
  } catch {
    return null
  }

  const parts = decoded.split('.')
  if (parts.length !== 3) return null
  const [sessionId, expires, signature] = parts
  const at = Number(expires)
  if (!Number.isFinite(at)) return null
  return { sessionId, expiresAt: new Date(at), signature, payload: `${sessionId}.${expires}` }
}

/** Verifies the claim against the session it names. */
export function accessTokenValid(
  instanceKey: string,
  claim: AccessClaim,
  snapshot: SessionSnapshot,
  now: Date,
): boolean {
  if (claim.expiresAt.getTime() <= now.getTime()) return false
  const expected = Buffer.from(signAccess(instanceKey, claim.payload, snapshot.tokenHash))
  const given = Buffer.from(claim.signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/**
 * Writes `last_seen_at`, at most once every five minutes.
 *
 * Unthrottled, this would be a row update on every single request of the busiest path in
 * the product — for a column read only to enforce a twelve-hour inactivity window.
 */
export async function touchSession(
  exec: Executor,
  snapshot: SessionSnapshot,
  now: Date,
): Promise<void> {
  if (now.getTime() - snapshot.lastSeenAt.getTime() < TOUCH_THROTTLE_MS) return
  await exec.query(
    'UPDATE _basedb.session SET last_seen_at = $2 WHERE id = $1 AND revoked_at IS NULL',
    [snapshot.sessionId, now.toISOString()],
    'update',
  )
}

/**
 * Revokes sessions. Every revocation records its reason, and the trigger on `session`
 * bumps `tenant.authz_version` in the same transaction — so a cached snapshot is dropped
 * without anyone having to remember to drop it.
 */
export async function revokeSessions(
  exec: Executor,
  scope:
    | { readonly kind: 'one'; readonly sessionId: string; readonly userId: string }
    | { readonly kind: 'all'; readonly userId: string },
  reason: string,
): Promise<number> {
  const rows =
    scope.kind === 'one'
      ? await exec.query<{ id: string }>(
          `UPDATE _basedb.session
              SET revoked_at = clock_timestamp(), revoked_reason = $3
            WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
            RETURNING id`,
          [scope.sessionId, scope.userId, reason],
          'update',
        )
      : await exec.query<{ id: string }>(
          `UPDATE _basedb.session
              SET revoked_at = clock_timestamp(), revoked_reason = $2
            WHERE user_id = $1 AND revoked_at IS NULL
            RETURNING id`,
          [scope.userId, reason],
          'update',
        )
  return rows.length
}

/** The live sessions of their owner, which is what makes unit revocation usable. */
export async function listLiveSessions(
  pools: Pools,
  userId: string,
): Promise<
  ReadonlyArray<{
    id: string
    createdAt: string
    lastSeenAt: string
    ip: string | null
    userAgent: string | null
  }>
> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{
      id: string
      created_at: Date
      last_seen_at: Date
      ip: string | null
      user_agent: string | null
    }>(
      `SELECT id, created_at, last_seen_at, host(ip) AS ip, user_agent
         FROM _basedb.session
        WHERE user_id = $1 AND revoked_at IS NULL
          AND absolute_expires_at > clock_timestamp()
        ORDER BY last_seen_at DESC`,
      [userId],
    ),
  )
  return rows.map((r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
    ip: r.ip,
    userAgent: r.user_agent,
  }))
}

/** Raised identically for an absent, malformed, unknown, expired or revoked credential. */
export function refuseAuthentication(): never {
  throw new BasedbError('AUTHENTICATION_REQUIRED')
}

/**
 * Rotates a session's token — chapter 13 §4.2.
 *
 * Rotation happens at each authentication, each elevation and each password change, and
 * the old token is revoked IN THE SAME TRANSACTION. Its effect reaches further than the
 * cookie: every access token ever minted from this session was signed over the old
 * `token_hash`, so all of them stop verifying at once.
 */
export async function rotateSession(
  exec: Executor,
  snapshot: SessionSnapshot,
  reason: string,
  now: Date,
): Promise<{ token: string; sessionId: string; absoluteExpiresAt: Date }> {
  await exec.query(
    `UPDATE _basedb.session
        SET revoked_at = clock_timestamp(), revoked_reason = $2
      WHERE id = $1 AND revoked_at IS NULL`,
    [snapshot.sessionId, reason],
    'update',
  )

  const [tenant] = await exec.query<{ id: string }>(
    'SELECT id FROM _basedb.tenant WHERE ref = $1',
    [snapshot.tenantRef],
  )

  // The new session inherits neither the elevation nor the absolute expiry: an elevation
  // is proved again, and the thirty days are not extendable (§4.2).
  return createSession(exec, {
    userId: snapshot.userId,
    tenantId: tenant.id,
    ip: snapshot.ip,
    userAgent: snapshot.userAgent,
    now,
  })
}

/** §5 — an elevation lasts five minutes, and is never extended by use. */
export const ELEVATION_MS = 5 * 60 * 1000

export async function setElevation(
  exec: Executor,
  sessionId: string,
  until: Date | null,
): Promise<void> {
  await exec.query(
    'UPDATE _basedb.session SET elevated_until = $2 WHERE id = $1',
    [sessionId, until === null ? null : until.toISOString()],
    'update',
  )
}

/** Is this session elevated, at this instant? */
export function elevated(snapshot: SessionSnapshot, now: Date): boolean {
  return snapshot.elevatedUntil !== null && snapshot.elevatedUntil.getTime() > now.getTime()
}
