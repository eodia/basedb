import { createHash } from 'node:crypto'
import { ensureSystemGroups } from '../admin/groups.js'
import { checkName } from '../admin/users.js'
import { writeAudit } from '../audit/journal.js'
import { BasedbError } from '../errors/index.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { sealContext } from '../tx/context.js'
import { type LoginResult, normalizeEmail } from './operations.js'
import { checkPasswordPolicy, hashPassword } from './password.js'
import { createSession, csrfFor } from './session.js'

/**
 * Bootstrap — chapter 13 §7.
 *
 * Two roads lead to the instance's first administrator. The server takes one at startup
 * when the operator names the account (`BASEDB_ADMIN_EMAIL`); otherwise the first person
 * to open the interface takes the other, with their own address and password. Either
 * way this is the only write in the product that no authorization decision covers: no
 * actor exists yet to carry one.
 */

/** Runs the work in one transaction, rolled back on any failure. */
async function transaction<T>(exec: Executor, work: () => Promise<T>): Promise<T> {
  await exec.query('BEGIN')
  try {
    const result = await work()
    await exec.query('COMMIT')
    return result
  } catch (error) {
    await exec.query('ROLLBACK').catch(() => undefined)
    throw error
  }
}

/**
 * One tenant, its first administrator, its two system groups and a first project.
 *
 * The tenant ↔ app_user cycle requires a single transaction with deferred constraints:
 * each one requires the other. The caller holds that transaction.
 */
async function createInstance(
  exec: Executor,
  request: { readonly tenantRef: string; readonly email: string; readonly displayName: string },
): Promise<{ readonly tenantId: string; readonly userId: string }> {
  const [t] = await exec.query<{ id: string; created_by: string }>(
    `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
     VALUES ($1, $2, true, _basedb_local.uuid_generate_v7())
     RETURNING id, created_by`,
    [request.tenantRef, request.tenantRef],
    'insert',
  )
  await exec.query(
    `INSERT INTO _basedb.app_user
       (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
     VALUES ($1, $2, $3, $4, true, true, $1, $1)`,
    [t.created_by, t.id, request.email, request.displayName],
    'insert',
  )
  // The two system groups — the first account is an Administrator, and belongs to
  // everyone — and a first project to create bases in (chapter 05 §15).
  await ensureSystemGroups(exec, request.tenantRef, t.created_by)
  await exec.query(
    `INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
     VALUES ($1, 'Projet principal', 'projet principal', $2, $2)`,
    [t.id, t.created_by],
    'insert',
  )
  return { tenantId: t.id, userId: t.created_by }
}

/**
 * The server's road: the tenant's first administrator, created if missing.
 *
 * Idempotent — restarting does not create a second administrator. Without an address it
 * only finds: creating an account nobody named is exactly what it must not do.
 */
export async function bootstrapInstance(
  pools: Pools,
  request: { readonly tenantRef: string; readonly email?: string },
): Promise<{
  readonly tenantId: string
  readonly userId: string
  readonly email: string
  readonly alreadyDone: boolean
}> {
  return pools.withConnection('catalog', async (exec) => {
    const [found] = await exec.query<{ tenant_id: string; user_id: string; email: string }>(
      `SELECT t.id AS tenant_id, u.id AS user_id, u.email
         FROM _basedb.tenant t
         JOIN _basedb.app_user u ON u.tenant_id = t.id AND u.is_instance_admin
        WHERE t.ref = $1
        ORDER BY u.created_at
        LIMIT 1`,
      [request.tenantRef],
    )
    if (found !== undefined) {
      return {
        tenantId: found.tenant_id,
        userId: found.user_id,
        email: found.email,
        alreadyDone: true,
      }
    }
    const email = request.email
    if (email === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tenant: request.tenantRef } })
    }

    const created = await transaction(exec, () =>
      createInstance(exec, { tenantRef: request.tenantRef, email, displayName: 'Administration' }),
    )
    return { ...created, email, alreadyDone: false }
  })
}

/** Whether the instance has no administrator yet — across every tenant. */
async function isOpen(exec: Executor): Promise<boolean> {
  const [row] = await exec.query<{ open: boolean }>(
    'SELECT NOT EXISTS (SELECT 1 FROM _basedb.app_user WHERE is_instance_admin) AS open',
  )
  return row?.open === true
}

/**
 * Whether the interface's road is open: no administrator exists on the instance.
 *
 * Instance-wide on purpose. Asked per tenant, changing `BASEDB_TENANT` after the fact
 * would reopen it — for anyone.
 */
export async function bootstrapOpen(pools: Pools): Promise<boolean> {
  return pools.withConnection('catalog', isOpen)
}

/**
 * The interface's road: the first person to reach an instance with no administrator
 * creates it, with their own address, name and password, and is signed in.
 *
 * Open to whoever comes first — the operator's decision, made knowing it: the published
 * ports listen on `127.0.0.1` until someone puts the instance on a domain. Once an
 * administrator exists, by this road or the server's, it answers `404`: the bootstrap no
 * longer exists.
 */
export async function bootstrapAdministrator(
  pools: Pools,
  instanceKey: string,
  request: {
    readonly tenantRef: string
    readonly email: string
    readonly displayName: string
    readonly password: string
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
  // Hashed before the transaction: argon2id takes its time, and the lock below waits for
  // nobody's hash.
  const stored = await hashPassword(instanceKey, password)
  const now = request.now ?? new Date()

  return pools.withConnection('catalog', (exec) =>
    transaction(exec, async () => {
      // Two first visits at once: the second waits here, then finds the first one's
      // administrator and is refused.
      await exec.query("SELECT pg_advisory_xact_lock(hashtext('basedb.bootstrap'))")
      if (!(await isOpen(exec))) throw new BasedbError('RESOURCE_NOT_FOUND')

      const { tenantId, userId } = await createInstance(exec, {
        tenantRef: request.tenantRef,
        email,
        displayName,
      })
      await exec.query(
        `INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
         VALUES ($1, 'password', $2, $3)`,
        [userId, normalizeEmail(email), stored],
        'insert',
      )
      await writeAudit(
        exec,
        sealContext({
          requestId: request.requestId,
          actor: { kind: 'user', id: userId },
          tenantId: request.tenantRef,
          surface: 'ui',
          timestamp: now,
          deadline: now,
          permissions: { version: '1', rowPredicate: 'TRUE' },
        }),
        {
          action: 'bootstrap.consumed',
          objectKind: 'app_user',
          objectId: userId,
          objectName: displayName,
        },
      )

      const session = await createSession(exec, {
        userId,
        tenantId,
        ip: request.ip ?? null,
        userAgent: request.userAgent ?? null,
        now,
      })
      return {
        sessionToken: session.token,
        csrfToken: csrfFor(instanceKey, createHash('sha256').update(session.token).digest()),
        sessionId: session.sessionId,
        absoluteExpiresAt: session.absoluteExpiresAt,
        userId,
        tenantRef: request.tenantRef,
      }
    }),
  )
}
