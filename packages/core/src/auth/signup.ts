import { createHash } from 'node:crypto'
import { ensureSystemGroups } from '../admin/groups.js'
import { findInvitation } from '../admin/sharing.js'
import { checkName } from '../admin/users.js'
import { writeAudit } from '../audit/journal.js'
import { BasedbError } from '../errors/index.js'
import { requireAdministration } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import { requireElevatedSession } from './elevation.js'
import { type LoginResult, normalizeEmail } from './operations.js'
import { checkPasswordPolicy, hashPassword } from './password.js'
import { createSession, csrfFor } from './session.js'

/**
 * Creating one's own account — chapter 13 §8.
 *
 * Anyone who reaches the instance may create an account, unless an administrator closes
 * it or keeps it to some domains. The account sees nothing it was not given: its own
 * projects, and what others share with it. An invitation opens the door even when it is
 * closed — someone who manages a project asked for that person.
 */

export interface SignupPolicy {
  /** Whether anyone may create an account. */
  readonly open: boolean
  /** Kept to these domains when not empty: `exemple.fr` admits `lea@exemple.fr`. */
  readonly domains: readonly string[]
}

const KEY = 'auth.signup'

/** Open to everyone until an administrator decides otherwise. */
const DEFAULT: SignupPolicy = { open: true, domains: [] }

/** The tenant's policy, read in the caller's transaction — sign-up, and OIDC's first sign-in. */
export async function readPolicy(exec: Executor, tenantRef: string): Promise<SignupPolicy> {
  const [row] = await exec.query<{ value: { open?: unknown; domains?: unknown } }>(
    `SELECT s.value FROM _basedb.setting s
       JOIN _basedb.tenant t ON t.id = s.tenant_id
      WHERE s.scope_kind = 'tenant' AND t.ref = $1 AND s.key = $2`,
    [tenantRef, KEY],
  )
  if (row === undefined) return DEFAULT
  return {
    open: row.value.open !== false,
    domains: Array.isArray(row.value.domains)
      ? row.value.domains.filter((d): d is string => typeof d === 'string')
      : [],
  }
}

/** The policy, as the sign-in screen needs it: whether to offer creating an account. */
export async function signupPolicy(pools: Pools, tenantRef: string): Promise<SignupPolicy> {
  return pools.withConnection('catalog', (exec) => readPolicy(exec, tenantRef))
}

/** The policy, for the administration screen. */
export async function adminSignupPolicy(pools: Pools, ctx: RequestContext): Promise<SignupPolicy> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireAdministration(exec, ctx)
      return readPolicy(exec, ctx.tenantId)
    },
    { readOnly: true },
  )
}

/** `@Exemple.FR ` → `exemple.fr`; `REQUEST_INVALID` for what is not a domain. */
function normalizeDomain(raw: unknown): string {
  const domain = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/^@/, '') : ''
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'domains', value: raw } })
  }
  return domain
}

/** Opens, closes or restricts account creation. Administrators, elevated. */
export async function setSignupPolicy(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly open: boolean
    readonly domains: readonly string[]
    readonly sessionId: string
  },
): Promise<SignupPolicy> {
  if (typeof request.open !== 'boolean' || !Array.isArray(request.domains)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'policy' } })
  }
  const policy: SignupPolicy = {
    open: request.open,
    domains: [...new Set(request.domains.map(normalizeDomain))],
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await requireElevatedSession(exec, ctx, request.sessionId)
    await exec.query(
      `INSERT INTO _basedb.setting (scope_kind, tenant_id, key, value, updated_by)
       SELECT 'tenant', t.id, $2, $3::jsonb, $4 FROM _basedb.tenant t WHERE t.ref = $1
       ON CONFLICT (scope_kind, tenant_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                     updated_at = clock_timestamp()`,
      [ctx.tenantId, KEY, JSON.stringify(policy), ctx.actor.id],
      'insert',
    )
    await writeAudit(exec, ctx, {
      action: 'signup.policy',
      objectKind: 'tenant',
      objectName: ctx.tenantId,
      payload: { ...policy },
    })
    return policy
  })
}

/**
 * Creates an account and signs it in.
 *
 * The address is refused when an account already holds it — which says that it does: a
 * sign-up form cannot hide it without an email to confirm the address, which basedb does
 * not send. The rate limit of `/auth` bounds how fast anyone can ask.
 */
export async function signUp(
  pools: Pools,
  instanceKey: string,
  request: {
    readonly tenantRef: string
    readonly email: string
    readonly displayName: string
    readonly password: string
    /** The secret of an invitation link: it admits the account even when sign-up is closed. */
    readonly invitation?: string
    readonly requestId: string
    readonly ip?: string | null
    readonly userAgent?: string | null
    readonly now?: Date
  },
): Promise<LoginResult> {
  const email = typeof request.email === 'string' ? request.email.trim() : ''
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'email' } })
  }
  const displayName = checkName(request.displayName)
  const password = typeof request.password === 'string' ? request.password : ''
  checkPasswordPolicy(password, { email, displayName })
  // Hashed before the transaction: argon2id takes its time.
  const stored = await hashPassword(instanceKey, password)
  const now = request.now ?? new Date()

  return pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    try {
      const result = await create(exec)
      await exec.query('COMMIT')
      return result
    } catch (error) {
      await exec.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })

  async function create(exec: Executor): Promise<LoginResult> {
    const [tenant] = await exec.query<{ id: string }>(
      'SELECT id FROM _basedb.tenant WHERE ref = $1 AND deleted_at IS NULL',
      [request.tenantRef],
    )
    // No tenant yet: the instance waits for its first administrator, not for accounts.
    if (tenant === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')

    const invited =
      request.invitation !== undefined &&
      (await findInvitation(exec, request.tenantRef, request.invitation)) !== null
    if (!invited) {
      const policy = await readPolicy(exec, request.tenantRef)
      if (!policy.open) throw new BasedbError('RESOURCE_NOT_FOUND')
      const domain = email.split('@').pop()?.toLowerCase() ?? ''
      if (policy.domains.length > 0 && !policy.domains.includes(domain)) {
        throw new BasedbError('REQUEST_INVALID', {
          details: { field: 'email', reason: 'domaine_refuse', domains: policy.domains },
        })
      }
    }

    const taken = await exec.query<{ id: string }>(
      `SELECT u.id FROM _basedb.app_user u
        WHERE u.tenant_id = $1 AND lower(u.email) = lower($2) AND u.deleted_at IS NULL
       UNION ALL
       SELECT i.user_id FROM _basedb.auth_identity i
        WHERE i.provider = 'password' AND i.subject = $3`,
      [tenant.id, email, normalizeEmail(email)],
    )
    if (taken.length > 0) throw new BasedbError('EMAIL_TAKEN', { details: { field: 'email' } })

    // Its own author: nobody else created it.
    const [user] = await exec.query<{ id: string }>(
      `WITH fresh AS (SELECT _basedb_local.uuid_generate_v7() AS id)
       INSERT INTO _basedb.app_user (id, tenant_id, email, display_name, created_by, updated_by)
       SELECT fresh.id, $1, $2, $3, fresh.id, fresh.id FROM fresh
       RETURNING id`,
      [tenant.id, email, displayName],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
       VALUES ($1, 'password', $2, $3)`,
      [user.id, normalizeEmail(email), stored],
      'insert',
    )
    // « Tous les utilisateurs », which every account belongs to.
    await ensureSystemGroups(exec, request.tenantRef, user.id)

    const ctx = sealContext({
      requestId: request.requestId,
      actor: { kind: 'user', id: user.id },
      tenantId: request.tenantRef,
      surface: 'ui',
      timestamp: now,
      deadline: now,
      permissions: { version: '1', rowPredicate: 'TRUE' },
    })
    await writeAudit(exec, ctx, {
      action: 'user.signup',
      objectKind: 'app_user',
      objectId: user.id,
      objectName: displayName,
      payload: { invited },
    })

    const session = await createSession(exec, {
      userId: user.id,
      tenantId: tenant.id,
      ip: request.ip ?? null,
      userAgent: request.userAgent ?? null,
      now,
    })
    return {
      sessionToken: session.token,
      csrfToken: csrfFor(instanceKey, createHash('sha256').update(session.token).digest()),
      sessionId: session.sessionId,
      absoluteExpiresAt: session.absoluteExpiresAt,
      userId: user.id,
      tenantRef: request.tenantRef,
    }
  }
}
