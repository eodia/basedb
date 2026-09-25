import { createHash, randomBytes } from 'node:crypto'
import { BasedbError } from '../errors/index.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { checkPasswordPolicy, dummyVerify, hashPassword, verifyPassword } from './password.js'
import {
  ELEVATION_MS,
  type SessionSnapshot,
  accessTokenValid,
  createSession,
  csrfFor,
  csrfValid,
  decodeAccessToken,
  loadSessionById,
  loadSessionByToken,
  mintAccessToken,
  revokeSessions,
  rotateSession,
  sessionUsable,
  setElevation,
  touchSession,
} from './session.js'

/**
 * Authentication operations — chapter 13 §2 and §4.
 *
 * ONE rule governs every response here, with no exception (§2.5): **no answer lets a
 * caller tell a non-existent account from an existing one.** Unknown address, wrong
 * password, disabled, locked or logically deleted account — one code, one body, one
 * message, and the same cost.
 */

/** §2.4 — thresholds, in minutes, for successive lockouts with no success in between. */
const LOCKOUT_MINUTES = [15, 30, 60, 240, 1440] as const
const LOCKOUT_EVERY = 10

/** The email as the catalog stores it, and as a caller may type it. */
export function normalizeEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase()
}

/** Raised for every authentication failure, whatever its cause. */
function refuse(): never {
  throw new BasedbError('CREDENTIALS_INVALID')
}

interface PasswordIdentity {
  readonly identityId: string
  readonly userId: string
  readonly tenantId: string
  readonly tenantRef: string
  readonly email: string
  readonly displayName: string
  readonly passwordHash: string
  readonly failedAttempts: number
  readonly lockedUntil: Date | null
  readonly usable: boolean
}

async function loadPasswordIdentity(
  exec: Executor,
  email: string,
): Promise<PasswordIdentity | null> {
  const rows = await exec.query<{
    id: string
    user_id: string
    tenant_id: string
    tenant_ref: string
    email: string
    display_name: string
    password_hash: string
    failed_attempts: number
    locked_until: Date | null
    usable: boolean
  }>(
    `SELECT i.id, i.user_id, u.tenant_id, t.ref AS tenant_ref,
            u.email, u.display_name, i.password_hash,
            i.failed_attempts, i.locked_until,
            (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS usable
       FROM _basedb.auth_identity i
       JOIN _basedb.app_user u ON u.id = i.user_id
       JOIN _basedb.tenant t   ON t.id = u.tenant_id
      WHERE i.provider = 'password' AND i.subject = $1`,
    [email],
  )

  const row = rows[0]
  if (row === undefined || row.password_hash === null) return null
  return {
    identityId: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    tenantRef: row.tenant_ref,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until === null ? null : new Date(row.locked_until),
    usable: row.usable,
  }
}

/** Records a failure and, every ten of them, moves the lock to its next duration. */
async function recordFailure(exec: Executor, identity: PasswordIdentity): Promise<void> {
  const attempts = identity.failedAttempts + 1
  const step = Math.floor(attempts / LOCKOUT_EVERY) - 1
  const locks = attempts % LOCKOUT_EVERY === 0 && step >= 0

  await exec.query(
    `UPDATE _basedb.auth_identity
        SET failed_attempts = $2,
            locked_until = CASE WHEN $3::boolean
                                THEN clock_timestamp() + make_interval(mins => $4::int)
                                ELSE locked_until END
      WHERE id = $1`,
    [
      identity.identityId,
      attempts,
      locks,
      LOCKOUT_MINUTES[Math.min(step, LOCKOUT_MINUTES.length - 1)] ?? LOCKOUT_MINUTES[0],
    ],
    'update',
  )
}

export interface LoginResult {
  readonly sessionToken: string
  readonly csrfToken: string
  readonly sessionId: string
  readonly absoluteExpiresAt: Date
  readonly userId: string
  readonly tenantRef: string
}

/**
 * Password login — §2.
 *
 * The lockout is EXACT, because it is a row update, where the rate-limiting buckets of
 * chapter 08 are approximate across several application instances (A4). The defence
 * against targeted credential stuffing therefore does not rest on them.
 */
export async function login(
  pools: Pools,
  instanceKey: string,
  request: {
    readonly email: string
    readonly password: string
    readonly ip?: string | null
    readonly userAgent?: string | null
    readonly now?: Date
  },
): Promise<LoginResult> {
  const now = request.now ?? new Date()
  const email = normalizeEmail(request.email)

  return pools.withConnection('catalog', async (exec) => {
    const identity = await loadPasswordIdentity(exec, email)

    // No identity: a DUMMY argon2id hash runs anyway. Without it the response time
    // would be the oracle the shared error code is careful to avoid.
    if (identity === null) {
      await dummyVerify(instanceKey)
      refuse()
    }

    // A live lock is never announced — learning about it is learning that the account
    // exists — and it costs the same as an ordinary failure, for the same reason.
    if (identity.lockedUntil !== null && identity.lockedUntil.getTime() > now.getTime()) {
      await dummyVerify(instanceKey)
      refuse()
    }

    const ok = await verifyPassword(instanceKey, identity.passwordHash, request.password)

    // A disabled or deleted account fails exactly like a wrong password, and only after
    // the hash has run: skipping it would make the account's state measurable.
    if (!ok || !identity.usable) {
      await recordFailure(exec, identity)
      refuse()
    }

    await exec.query(
      `UPDATE _basedb.auth_identity
          SET failed_attempts = 0, locked_until = NULL, last_used_at = clock_timestamp()
        WHERE id = $1`,
      [identity.identityId],
      'update',
    )

    const session = await createSession(exec, {
      userId: identity.userId,
      tenantId: identity.tenantId,
      ip: request.ip ?? null,
      userAgent: request.userAgent ?? null,
      now,
    })

    return {
      sessionToken: session.token,
      csrfToken: csrfFor(instanceKey, createHash('sha256').update(session.token).digest()),
      sessionId: session.sessionId,
      absoluteExpiresAt: session.absoluteExpiresAt,
      userId: identity.userId,
      tenantRef: identity.tenantRef,
    }
  })
}

/** A credential, once it has been believed. */
export interface Authenticated {
  readonly userId: string
  readonly tenantRef: string
  readonly sessionId: string
  readonly elevatedUntil: Date | null
}

/**
 * Believes a session cookie — `/auth/*` only.
 *
 * Absent, malformed, unknown, expired, revoked: one and the same refusal. A client must
 * be able to reconnect, so this is a `401` and never a `404`.
 */
export async function authenticateCookie(
  pools: Pools,
  token: string | undefined,
  now: Date = new Date(),
): Promise<Authenticated> {
  if (token === undefined || token === '') throw new BasedbError('AUTHENTICATION_REQUIRED')

  return pools.withConnection('catalog', async (exec) => {
    const snapshot = await loadSessionByToken(exec, token)
    if (snapshot === null || !sessionUsable(snapshot, now)) {
      throw new BasedbError('AUTHENTICATION_REQUIRED')
    }
    await touchSession(exec, snapshot, now)
    return asAuthenticated(snapshot)
  })
}

/**
 * Believes an access token — `/api/v1` only.
 *
 * The fifteen minutes are a RENEWAL period, not an unverified validity window: the
 * session snapshot is re-read here on every request, and its `revoked_at`,
 * `absolute_expires_at` and account state are compared to the clock. A revocation takes
 * effect in seconds, never in fifteen minutes.
 */
export async function authenticateAccessToken(
  pools: Pools,
  instanceKey: string,
  token: string | undefined,
  now: Date = new Date(),
): Promise<Authenticated> {
  const claim = token === undefined ? null : decodeAccessToken(token)
  if (claim === null) throw new BasedbError('AUTHENTICATION_REQUIRED')

  return pools.withConnection('catalog', async (exec) => {
    const snapshot = await loadSessionById(exec, claim.sessionId)
    if (snapshot === null || !sessionUsable(snapshot, now)) {
      throw new BasedbError('AUTHENTICATION_REQUIRED')
    }
    // The signature is checked against the session's CURRENT `token_hash`: rotating it
    // invalidates every token ever minted from this session, with nothing to walk.
    if (!accessTokenValid(instanceKey, claim, snapshot, now)) {
      throw new BasedbError('AUTHENTICATION_REQUIRED')
    }
    await touchSession(exec, snapshot, now)
    return asAuthenticated(snapshot)
  })
}

function asAuthenticated(snapshot: SessionSnapshot): Authenticated {
  return {
    userId: snapshot.userId,
    tenantRef: snapshot.tenantRef,
    sessionId: snapshot.sessionId,
    elevatedUntil: snapshot.elevatedUntil,
  }
}

/** Exchanges the cookie for an access token. Writes nothing. */
export async function issueAccessToken(
  pools: Pools,
  instanceKey: string,
  sessionToken: string | undefined,
  csrf: string | undefined,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  if (sessionToken === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')

  return pools.withConnection('catalog', async (exec) => {
    const snapshot = await loadSessionByToken(exec, sessionToken)
    if (snapshot === null || !sessionUsable(snapshot, now)) {
      throw new BasedbError('AUTHENTICATION_REQUIRED')
    }
    // The cookie alone is not enough HERE, and only here: this is the one route that
    // turns a cookie into a credential for the data API. A foreign page can make a
    // browser send the cookie; it cannot make it send this header.
    if (!csrfValid(instanceKey, snapshot.tokenHash, csrf)) {
      throw new BasedbError('AUTHENTICATION_REQUIRED')
    }
    return mintAccessToken(instanceKey, snapshot, now)
  })
}

/** Closes the current session. */
export async function logout(pools: Pools, sessionToken: string | undefined): Promise<void> {
  if (sessionToken === undefined) return
  await pools.withConnection('catalog', async (exec) => {
    const snapshot = await loadSessionByToken(exec, sessionToken)
    if (snapshot === null) return
    await revokeSessions(
      exec,
      { kind: 'one', sessionId: snapshot.sessionId, userId: snapshot.userId },
      'logout',
    )
  })
}

/**
 * Sets a password without checking a previous one — bootstrap, and administration.
 *
 * Separate from `changePassword` on purpose: this one proves nothing about the caller,
 * so it is reachable only from a path that has already proved something else.
 */
export async function setPassword(
  pools: Pools,
  instanceKey: string,
  request: { readonly userId: string; readonly password: string },
): Promise<void> {
  await pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ email: string; display_name: string }>(
      'SELECT email, display_name FROM _basedb.app_user WHERE id = $1',
      [request.userId],
    )
    const user = rows[0]
    if (user === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')

    checkPasswordPolicy(request.password, {
      email: user.email,
      displayName: user.display_name,
    })
    const stored = await hashPassword(instanceKey, request.password)

    await exec.query(
      `INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
       VALUES ($1, 'password', $2, $3)
       ON CONFLICT (provider, subject)
       DO UPDATE SET password_hash = EXCLUDED.password_hash,
                     failed_attempts = 0,
                     locked_until = NULL`,
      [request.userId, normalizeEmail(user.email), stored],
      'insert',
    )

    await exec.query(
      'UPDATE _basedb.app_user SET must_change_password = false WHERE id = $1',
      [request.userId],
      'update',
    )

    // Changing a password closes every session of that user (§4.3): the point of
    // changing it is usually that someone else may know the old one.
    await revokeSessions(exec, { kind: 'all', userId: request.userId }, 'password_changed')
  })
}

/**
 * Changes a password against the current one — §2.3.
 *
 * Every session of the user is closed, THIS ONE INCLUDED, and a fresh one is issued to
 * the caller. Closing them all is the point of changing a password; leaving the caller
 * signed out as well would make the safe action the inconvenient one, which is how it
 * stops being taken.
 */
export async function changePassword(
  pools: Pools,
  instanceKey: string,
  request: {
    readonly userId: string
    readonly current: string
    readonly next: string
    readonly now?: Date
  },
): Promise<IssuedSession> {
  const now = request.now ?? new Date()

  const identity = await pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ email: string }>(
      'SELECT email FROM _basedb.app_user WHERE id = $1',
      [request.userId],
    )
    const email = rows[0]?.email
    if (email === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')
    return loadPasswordIdentity(exec, normalizeEmail(email))
  })

  if (identity === null) refuse()
  if (!(await verifyPassword(instanceKey, identity.passwordHash, request.current))) refuse()

  // The policy is checked AFTER the current password: a refusal tells the caller about
  // their own new password, which they already know, but only once they have proved who
  // they are.
  await setPassword(pools, instanceKey, { userId: request.userId, password: request.next })

  return pools.withConnection('catalog', async (exec) => {
    const session = await createSession(exec, {
      userId: identity.userId,
      tenantId: identity.tenantId,
      now,
    })
    return issued(instanceKey, session.token, session.sessionId)
  })
}

/** Who the caller is — `GET /auth/me`. */
export async function whoAmI(
  pools: Pools,
  authenticated: Authenticated,
): Promise<{
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly tenantRef: string
  readonly isInstanceAdmin: boolean
  /** Member of the Administrators group, or an instance administrator. */
  readonly isAdmin: boolean
  /** A temporary password is in use: the interface asks for a new one before anything. */
  readonly mustChangePassword: boolean
  readonly elevatedUntil: string | null
}> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{
      email: string
      display_name: string
      is_instance_admin: boolean
      must_change_password: boolean
      in_admins: boolean
    }>(
      `SELECT u.email, u.display_name, u.is_instance_admin, u.must_change_password,
              EXISTS (SELECT 1 FROM _basedb.role_member m
                        JOIN _basedb.role r ON r.id = m.role_id
                       WHERE m.user_id = u.id AND r.name = 'tenant_admin'
                         AND r.is_system AND r.deleted_at IS NULL) AS in_admins
         FROM _basedb.app_user u WHERE u.id = $1`,
      [authenticated.userId],
    ),
  )
  const user = rows[0]
  if (user === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')

  return {
    id: authenticated.userId,
    email: user.email,
    displayName: user.display_name,
    tenantRef: authenticated.tenantRef,
    isInstanceAdmin: user.is_instance_admin,
    isAdmin: user.is_instance_admin || user.in_admins,
    mustChangePassword: user.must_change_password,
    elevatedUntil: authenticated.elevatedUntil?.toISOString() ?? null,
  }
}

/** Revokes one session of its owner, or all of them. */
export async function revoke(
  pools: Pools,
  authenticated: Authenticated,
  scope: { readonly kind: 'one'; readonly sessionId: string } | { readonly kind: 'all' },
): Promise<void> {
  await pools.withConnection('catalog', async (exec) => {
    const revoked =
      scope.kind === 'one'
        ? await revokeSessions(
            exec,
            { kind: 'one', sessionId: scope.sessionId, userId: authenticated.userId },
            'revoked_by_owner',
          )
        : await revokeSessions(exec, { kind: 'all', userId: authenticated.userId }, 'revoked_all')

    // A session belonging to someone else answers as a session that does not exist: the
    // identifier of a stranger's session is not something to confirm.
    if (scope.kind === 'one' && revoked === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { session: scope.sessionId } })
    }
  })
}

/** A session handed back to the caller, cookie and CSRF token included. */
export interface IssuedSession {
  readonly sessionToken: string
  readonly csrfToken: string
  readonly sessionId: string
}

function issued(instanceKey: string, token: string, sessionId: string): IssuedSession {
  return {
    sessionToken: token,
    csrfToken: csrfFor(instanceKey, createHash('sha256').update(token).digest()),
    sessionId,
  }
}

/**
 * Elevation — chapter 13 §5.
 *
 * The one mechanism by which a session becomes temporarily capable of permission, token
 * and webhook writes. Five minutes, on the SESSION and not on an object, and never
 * extended by use: a new proof is demanded each time, because an elevation that slid
 * forward on activity would be a permanent one for anyone who keeps working.
 *
 * The session token rotates with it, which invalidates the access tokens in flight. An
 * elevation is never silent.
 */
export async function elevate(
  pools: Pools,
  instanceKey: string,
  sessionToken: string | undefined,
  password: string,
  now: Date = new Date(),
): Promise<{ session: IssuedSession; elevatedUntil: Date }> {
  if (sessionToken === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')

  return pools.withConnection('catalog', async (exec) => {
    const snapshot = await loadSessionByToken(exec, sessionToken)
    if (snapshot === null || !sessionUsable(snapshot, now)) {
      throw new BasedbError('AUTHENTICATION_REQUIRED')
    }

    const [user] = await exec.query<{ email: string }>(
      'SELECT email FROM _basedb.app_user WHERE id = $1',
      [snapshot.userId],
    )
    const identity =
      user === undefined ? null : await loadPasswordIdentity(exec, normalizeEmail(user.email))

    // A wrong proof answers exactly like a failed login. An account with no password
    // identity lands here too: chapter 13 sends it through a fresh OIDC round trip,
    // which belongs to §3 and is not written yet.
    if (identity === null) {
      await dummyVerify(instanceKey)
      refuse()
    }
    if (!(await verifyPassword(instanceKey, identity.passwordHash, password))) {
      await recordFailure(exec, identity)
      refuse()
    }

    const rotated = await rotateSession(exec, snapshot, 'elevated', now)
    const elevatedUntil = new Date(now.getTime() + ELEVATION_MS)
    await setElevation(exec, rotated.sessionId, elevatedUntil)

    return {
      session: issued(instanceKey, rotated.token, rotated.sessionId),
      elevatedUntil,
    }
  })
}

/** Drops an elevation before its five minutes are up. */
export async function dropElevation(
  pools: Pools,
  sessionToken: string | undefined,
  now: Date = new Date(),
): Promise<void> {
  if (sessionToken === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')
  await pools.withConnection('catalog', async (exec) => {
    const snapshot = await loadSessionByToken(exec, sessionToken)
    if (snapshot === null || !sessionUsable(snapshot, now)) {
      throw new BasedbError('AUTHENTICATION_REQUIRED')
    }
    await setElevation(exec, snapshot.sessionId, null)
  })
}

/** §2.3 — a reset challenge lives thirty minutes and is used once. */
const RESET_TTL_MS = 30 * 60 * 1000

/** What the product hands to an operator's SMTP, when one is configured. */
export interface MailMessage {
  readonly to: string
  readonly subject: string
  readonly body: string
}

export type Mailer = (message: MailMessage) => Promise<void>

/**
 * Opens a password reset — §2.3.
 *
 * Answers NOTHING, always, and immediately: the route replies `202` whatever happens,
 * without waiting for delivery. An account that is unknown, disabled, or whose only
 * identity comes from an OIDC provider receives nothing at all — creating a password by
 * email would walk around the provider the tenant deliberately chose.
 *
 * With no mailer configured nothing leaves, and nothing is logged either: a reset link
 * in a log file is a reset link anyone with the log can use.
 */
export async function requestPasswordReset(
  pools: Pools,
  request: { readonly email: string; readonly now?: Date; readonly mailer?: Mailer },
): Promise<void> {
  const now = request.now ?? new Date()
  const email = normalizeEmail(request.email)

  const secret = await pools.withConnection('catalog', async (exec) => {
    const identity = await loadPasswordIdentity(exec, email)
    if (identity === null || !identity.usable) return null

    // Open challenges of the same user are consumed first: two live links would mean two
    // chances for a leaked mailbox, for no gain to the legitimate holder.
    await exec.query(
      `UPDATE _basedb.confirmation_challenge
          SET consumed_at = clock_timestamp()
        WHERE actor_user_id = $1 AND operation = 'password.reset' AND consumed_at IS NULL`,
      [identity.userId],
      'update',
    )

    const value = randomBytes(32).toString('base64url')
    await exec.query(
      `INSERT INTO _basedb.confirmation_challenge
         (actor_user_id, operation, target_kind, target_id, challenge_hash, expires_at)
       VALUES ($1, 'password.reset', 'app_user', $1, $2, $3)`,
      [
        identity.userId,
        createHash('sha256').update(value).digest(),
        new Date(now.getTime() + RESET_TTL_MS).toISOString(),
      ],
      'insert',
    )
    return { value, email: identity.email }
  })

  if (secret === null || request.mailer === undefined) return

  // Delivery failures are swallowed: the caller already has their `202`, and telling
  // them apart from a refusal would answer the question the `202` exists to hide.
  await request
    .mailer({
      to: secret.email,
      subject: 'basedb — réinitialisation de votre mot de passe',
      body: secret.value,
    })
    .catch(() => undefined)
}

/**
 * Consumes a reset challenge and applies the new password — §2.3.
 *
 * Same effects as a change, global revocation included. No session is issued: whoever
 * arrives here proved they hold a mailbox, not that they hold the account, and the
 * login that follows is the second proof.
 */
export async function confirmPasswordReset(
  pools: Pools,
  instanceKey: string,
  request: { readonly secret: string; readonly password: string; readonly now?: Date },
): Promise<void> {
  const now = request.now ?? new Date()

  const userId = await pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ id: string; actor_user_id: string }>(
      `UPDATE _basedb.confirmation_challenge
          SET consumed_at = clock_timestamp()
        WHERE challenge_hash = $1
          AND operation = 'password.reset'
          AND consumed_at IS NULL
          AND expires_at > $2
        RETURNING id, actor_user_id`,
      [createHash('sha256').update(request.secret).digest(), now.toISOString()],
      'update',
    )
    return rows[0]?.actor_user_id ?? null
  })

  // Unknown, expired, already used: one refusal. The update above is what makes it
  // single-use — the row is consumed in the same statement that finds it, so two
  // simultaneous attempts cannot both succeed.
  if (userId === null) throw new BasedbError('RESET_TOKEN_INVALID')

  await setPassword(pools, instanceKey, { userId, password: request.password })
}

/**
 * Opens a session for an identity a provider has asserted — §3.5.
 *
 * Separate from `login`: there is no password here, nothing to hash, and no lockout to
 * keep. What replaced the proof is the round trip to the provider, which
 * `completeOidc` has already validated in full.
 */
export async function loginWithOidc(
  pools: Pools,
  instanceKey: string,
  resolved: { readonly userId: string; readonly tenantId: string },
  context: { readonly ip?: string | null; readonly userAgent?: string | null; readonly now?: Date },
): Promise<IssuedSession> {
  const now = context.now ?? new Date()
  return pools.withConnection('catalog', async (exec) => {
    const session = await createSession(exec, {
      userId: resolved.userId,
      tenantId: resolved.tenantId,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      now,
    })
    return issued(instanceKey, session.token, session.sessionId)
  })
}
