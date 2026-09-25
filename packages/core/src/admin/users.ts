import { randomInt } from 'node:crypto'
import { writeAudit } from '../audit/journal.js'
import { requireElevatedSession } from '../auth/elevation.js'
import { normalizeEmail } from '../auth/operations.js'
import { hashPassword } from '../auth/password.js'
import { revokeSessions } from '../auth/session.js'
import { BasedbError } from '../errors/index.js'
import { requireAdministration } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import {
  ADMINS,
  EVERYONE,
  type SystemGroupIds,
  assertAnotherAdmin,
  changeMembership,
  ensureSystemGroups,
  loadGroup,
} from './groups.js'

/**
 * Accounts — chapter 05 §8 ("gérer les utilisateurs du tenant"), chapter 13.
 *
 * An administrator creates a person, puts them in groups, deactivates them, resets their
 * password. There is no mail in the loop by default, so a new account — like a reset —
 * receives a TEMPORARY password, shown once to the administrator who hands it over, and
 * the person must choose their own at first sign-in (`must_change_password`). That is
 * what Metabase does without an SMTP server, and what keeps an administrator from
 * knowing a password anyone actually uses.
 *
 * A person is never deleted, only deactivated: their name stays on what they wrote, in
 * the history and in the audit (05 §10.2). Deactivating closes every session at once and
 * leaves every token they minted inert, since a token's rights are bounded by its
 * creator's (05 §2.3).
 */

export interface UserSummary {
  readonly id: string
  readonly email: string
  readonly displayName: string
  /** Member of the Administrators, or an instance administrator. */
  readonly isAdmin: boolean
  readonly disabled: boolean
  readonly mustChangePassword: boolean
  readonly createdAt: string
  readonly lastSeenAt: string | null
  /** The groups the person belongs to, « Tous les utilisateurs » included. */
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** Letters and digits that cannot be mistaken for one another when read aloud. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A temporary password: four groups of five, about 115 bits, easy to dictate. */
export function temporaryPassword(): string {
  const group = () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  return [group(), group(), group(), group()].join('-')
}

async function loadUsers(exec: Executor, ctx: RequestContext): Promise<UserSummary[]> {
  const rows = await exec.query<{
    id: string
    email: string
    display_name: string
    is_instance_admin: boolean
    disabled_at: Date | null
    must_change_password: boolean
    created_at: Date
    last_seen_at: Date | null
    groups: Array<{ id: string; label: string; name: string }> | null
  }>(
    `SELECT u.id, u.email, u.display_name, u.is_instance_admin, u.disabled_at,
            u.must_change_password, u.created_at,
            (SELECT max(s.last_seen_at) FROM _basedb.session s WHERE s.user_id = u.id)
              AS last_seen_at,
            (SELECT json_agg(json_build_object('id', r.id, 'label', r.label, 'name', r.name)
                             ORDER BY (r.name = $2) DESC, (r.name = $3) DESC, r.label)
               FROM _basedb.role_member m
               JOIN _basedb.role r ON r.id = m.role_id AND r.deleted_at IS NULL
                                  AND r.kind = 'group'
              WHERE m.user_id = u.id) AS groups
       FROM _basedb.app_user u
       JOIN _basedb.tenant t ON t.id = u.tenant_id
      WHERE t.ref = $1 AND u.deleted_at IS NULL
        AND (NOT u.is_system OR u.is_instance_admin)
      ORDER BY u.disabled_at IS NOT NULL, lower(u.display_name), lower(u.email)`,
    [ctx.tenantId, ADMINS, EVERYONE],
  )
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    isAdmin: r.is_instance_admin || (r.groups ?? []).some((g) => g.name === ADMINS),
    disabled: r.disabled_at !== null,
    mustChangePassword: r.must_change_password,
    createdAt: new Date(r.created_at).toISOString(),
    lastSeenAt: r.last_seen_at === null ? null : new Date(r.last_seen_at).toISOString(),
    groups: (r.groups ?? []).map((g) => ({ id: g.id, label: g.label })),
  }))
}

/** The tenant's accounts. Administration only. */
export async function listUsers(
  pools: Pools,
  ctx: RequestContext,
): Promise<readonly UserSummary[]> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
    return loadUsers(exec, ctx)
  })
}

async function administering(
  exec: Executor,
  ctx: RequestContext,
  sessionId: string,
): Promise<SystemGroupIds> {
  await requireAdministration(exec, ctx)
  await requireElevatedSession(exec, ctx, sessionId)
  return ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
}

/** Stores a temporary password, to be changed at the next sign-in. */
async function storeTemporaryPassword(
  exec: Executor,
  instanceKey: string,
  userId: string,
  email: string,
): Promise<string> {
  const password = temporaryPassword()
  const stored = await hashPassword(instanceKey, password)
  await exec.query(
    `INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
     VALUES ($1, 'password', $2, $3)
     ON CONFLICT (provider, subject)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   failed_attempts = 0,
                   locked_until = NULL`,
    [userId, normalizeEmail(email), stored],
    'insert',
  )
  await exec.query(
    'UPDATE _basedb.app_user SET must_change_password = true WHERE id = $1',
    [userId],
    'update',
  )
  return password
}

async function loadUser(
  exec: Executor,
  ctx: RequestContext,
  userId: string,
): Promise<{ id: string; email: string; display_name: string; disabled_at: Date | null }> {
  const rows = await exec.query<{
    id: string
    email: string
    display_name: string
    disabled_at: Date | null
  }>(
    `SELECT u.id, u.email, u.display_name, u.disabled_at
       FROM _basedb.app_user u
       JOIN _basedb.tenant t ON t.id = u.tenant_id
      WHERE u.id::text = $1 AND t.ref = $2 AND u.deleted_at IS NULL`,
    [userId, ctx.tenantId],
  )
  const user = rows[0]
  if (user === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { user: userId } })
  return user
}

function checkName(displayName: unknown): string {
  const name = typeof displayName === 'string' ? displayName.normalize('NFC').trim() : ''
  if (name === '') throw new BasedbError('LABEL_EMPTY', { details: { field: 'display_name' } })
  if ([...name].length > 120) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { field: 'display_name', maximum: 120 } })
  }
  return name
}

/**
 * Creates an account, puts it in « Tous les utilisateurs » and in the groups asked for,
 * and returns its temporary password — the only time it is ever shown.
 */
export async function createUser(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: {
    readonly email: string
    readonly displayName: string
    readonly groupIds?: readonly string[]
    readonly sessionId: string
  },
): Promise<{ readonly user: UserSummary; readonly temporaryPassword: string }> {
  const email = typeof request.email === 'string' ? request.email.trim() : ''
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'email' } })
  }
  const displayName = checkName(request.displayName)

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const system = await administering(exec, ctx, request.sessionId)

    const taken = await exec.query<{ id: string }>(
      `SELECT u.id FROM _basedb.app_user u
         JOIN _basedb.tenant t ON t.id = u.tenant_id
        WHERE t.ref = $1 AND lower(u.email) = lower($2) AND u.deleted_at IS NULL`,
      [ctx.tenantId, email],
    )
    if (taken.length > 0) throw new BasedbError('EMAIL_TAKEN', { details: { field: 'email' } })

    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
       SELECT t.id, $2, $3, $4, $4 FROM _basedb.tenant t WHERE t.ref = $1
       RETURNING id`,
      [ctx.tenantId, email, displayName, ctx.actor.id],
      'insert',
    )

    const groups = new Set([system.everyone, ...(request.groupIds ?? [])])
    for (const groupId of groups) {
      if (groupId === system.everyone) {
        await exec.query(
          `INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [system.everyone, row.id, ctx.actor.id],
          'insert',
        )
        continue
      }
      await changeMembership(exec, ctx, await loadGroup(exec, ctx, groupId), row.id, true)
    }

    const password = await storeTemporaryPassword(exec, instanceKey, row.id, email)
    await writeAudit(exec, ctx, {
      action: 'user.create',
      objectKind: 'app_user',
      objectId: row.id,
      objectName: displayName,
    })

    const user = (await loadUsers(exec, ctx)).find((u) => u.id === row.id) as UserSummary
    return { user, temporaryPassword: password }
  })
}

/**
 * Renames, deactivates or reactivates an account.
 *
 * Deactivating closes every session of the person at once. Nobody deactivates their own
 * account — the person who would lock themselves out is the one at the keyboard — and
 * the last active Administrator cannot be deactivated.
 */
export async function updateUser(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly userId: string
    readonly displayName?: string
    readonly disabled?: boolean
    readonly sessionId: string
  },
): Promise<UserSummary> {
  const displayName = request.displayName === undefined ? undefined : checkName(request.displayName)

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const system = await administering(exec, ctx, request.sessionId)
    const user = await loadUser(exec, ctx, request.userId)

    if (displayName !== undefined) {
      await exec.query(
        `UPDATE _basedb.app_user
            SET display_name = $2, updated_at = clock_timestamp(), updated_by = $3
          WHERE id = $1`,
        [user.id, displayName, ctx.actor.id],
        'update',
      )
    }

    if (request.disabled === true && user.disabled_at === null) {
      if (user.id === ctx.actor.id) {
        throw new BasedbError('ACTION_FORBIDDEN', { details: { reason: 'soi_meme' } })
      }
      const admins = await exec.query<{ n: string }>(
        'SELECT count(*) AS n FROM _basedb.role_member WHERE role_id = $1 AND user_id = $2',
        [system.admins, user.id],
      )
      if (Number(admins[0]?.n ?? 0) > 0) await assertAnotherAdmin(exec, system.admins, user.id)
      await exec.query(
        `UPDATE _basedb.app_user
            SET disabled_at = clock_timestamp(), updated_at = clock_timestamp(), updated_by = $2
          WHERE id = $1`,
        [user.id, ctx.actor.id],
        'update',
      )
      await revokeSessions(exec, { kind: 'all', userId: user.id }, 'account_disabled')
      await writeAudit(exec, ctx, {
        action: 'user.disable',
        objectKind: 'app_user',
        objectId: user.id,
        objectName: user.display_name,
      })
    } else if (request.disabled === false && user.disabled_at !== null) {
      await exec.query(
        `UPDATE _basedb.app_user
            SET disabled_at = NULL, updated_at = clock_timestamp(), updated_by = $2
          WHERE id = $1`,
        [user.id, ctx.actor.id],
        'update',
      )
      await writeAudit(exec, ctx, {
        action: 'user.enable',
        objectKind: 'app_user',
        objectId: user.id,
        objectName: user.display_name,
      })
    }

    return (await loadUsers(exec, ctx)).find((u) => u.id === user.id) as UserSummary
  })
}

/** A new temporary password for an account; every session of it is closed. */
export async function resetUserPassword(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly userId: string; readonly sessionId: string },
): Promise<{ readonly temporaryPassword: string }> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await administering(exec, ctx, request.sessionId)
    const user = await loadUser(exec, ctx, request.userId)
    const password = await storeTemporaryPassword(exec, instanceKey, user.id, user.email)
    await revokeSessions(exec, { kind: 'all', userId: user.id }, 'password_reset')
    await writeAudit(exec, ctx, {
      action: 'user.password_reset',
      objectKind: 'app_user',
      objectId: user.id,
      objectName: user.display_name,
    })
    return { temporaryPassword: password }
  })
}

/**
 * Sets the groups of an account to exactly `groupIds` — « Tous les utilisateurs »
 * excepted, which holds everyone whatever is asked.
 */
export async function setUserGroups(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly userId: string
    readonly groupIds: readonly string[]
    readonly sessionId: string
  },
): Promise<UserSummary> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const system = await administering(exec, ctx, request.sessionId)
    const user = await loadUser(exec, ctx, request.userId)

    const current = await exec.query<{ role_id: string }>(
      `SELECT m.role_id FROM _basedb.role_member m
         JOIN _basedb.role r ON r.id = m.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
        WHERE m.user_id = $1`,
      [user.id],
    )
    const wanted = new Set(request.groupIds.filter((id) => id !== system.everyone))
    const held = new Set(current.map((r) => r.role_id).filter((id) => id !== system.everyone))

    for (const groupId of wanted) {
      if (!held.has(groupId)) {
        await changeMembership(exec, ctx, await loadGroup(exec, ctx, groupId), user.id, true)
      }
    }
    for (const groupId of held) {
      if (!wanted.has(groupId)) {
        await changeMembership(exec, ctx, await loadGroup(exec, ctx, groupId), user.id, false)
      }
    }

    return (await loadUsers(exec, ctx)).find((u) => u.id === user.id) as UserSummary
  })
}
