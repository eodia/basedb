import { randomBytes } from 'node:crypto'
import { writeAudit } from '../audit/journal.js'
import { requireElevatedSession } from '../auth/elevation.js'
import { labelKey } from '../catalog/operations.js'
import { BasedbError } from '../errors/index.js'
import { ACTIONS } from '../rbac/decide.js'
import { requireAdministration } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Groups of people — chapter 05 §1.5 and §15.
 *
 * A group is a `_basedb.role` of kind `group`: a named set of people to which access is
 * granted, project by project, base by base, table by table. Rights are never granted
 * to a person directly, only to groups, and a person's rights are the UNION of their
 * groups' — the additive model this chapter already fixed.
 *
 * Two groups exist in every tenant and cannot be renamed nor deleted:
 *
 *   — « Administrateurs » (`tenant_admin`): every verb on the tenant. Its members
 *     administer people, groups and permissions, and see everything;
 *   — « Tous les utilisateurs » (`all_users`): every account is a member, always. What it
 *     is granted, everyone has — which is why it starts with nothing.
 */

export const ADMINS = 'tenant_admin'
export const EVERYONE = 'all_users'

export type SystemGroup = 'admins' | 'everyone'

export interface GroupSummary {
  readonly id: string
  readonly label: string
  /** `admins`, `everyone`, or `null` for a group an administrator created. */
  readonly system: SystemGroup | null
  readonly memberCount: number
}

export interface SystemGroupIds {
  readonly admins: string
  readonly everyone: string
}

/**
 * Makes sure the two system groups exist, the Administrators with every verb on the
 * tenant, and that every live account belongs to « Tous les utilisateurs ».
 *
 * Idempotent: it writes only what is missing. A tenant bootstrapped before groups
 * existed — or by a script — gets them the first time someone administers it, its
 * instance administrators becoming the first Administrators.
 */
export async function ensureSystemGroups(
  exec: Executor,
  tenantRef: string,
  actorId: string,
): Promise<SystemGroupIds> {
  const [tenant] = await exec.query<{ id: string }>(
    'SELECT id FROM _basedb.tenant WHERE ref = $1',
    [tenantRef],
  )
  if (tenant === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')

  const ensure = async (name: string, label: string): Promise<{ id: string; created: boolean }> => {
    const found = await exec.query<{ id: string }>(
      `SELECT id FROM _basedb.role
        WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [tenant.id, name],
    )
    if (found[0] !== undefined) return { id: found[0].id, created: false }
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, is_system, kind, created_by)
       VALUES ($1, $2, $3, $4, true, 'group', $5) RETURNING id`,
      [tenant.id, label, labelKey(label), name, actorId],
      'insert',
    )
    return { id: row.id, created: true }
  }

  const admins = await ensure(ADMINS, 'Administrateurs')
  if (admins.created) {
    for (const action of ACTIONS) {
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, action, granted_by)
         VALUES ($1, 'tenant', $2, $3) ON CONFLICT DO NOTHING`,
        [admins.id, action, actorId],
        'insert',
      )
    }
    // The first Administrators are the tenant's instance administrators: without them,
    // nobody could administer the groups this very call created.
    await exec.query(
      `INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
       SELECT $1, u.id, $3 FROM _basedb.app_user u
        WHERE u.tenant_id = $2 AND u.is_instance_admin AND u.deleted_at IS NULL
       ON CONFLICT DO NOTHING`,
      [admins.id, tenant.id, actorId],
      'insert',
    )
  }

  const everyone = await ensure(EVERYONE, 'Tous les utilisateurs')
  await exec.query(
    `INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
     SELECT $1, u.id, $3 FROM _basedb.app_user u
      WHERE u.tenant_id = $2 AND u.deleted_at IS NULL AND NOT u.is_system
        AND NOT EXISTS (SELECT 1 FROM _basedb.role_member m
                         WHERE m.role_id = $1 AND m.user_id = u.id)`,
    [everyone.id, tenant.id, actorId],
    'insert',
  )
  // The bootstrap account is `is_system`: it is still a person who signs in, so it
  // belongs to everyone too.
  await exec.query(
    `INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
     SELECT $1, u.id, $3 FROM _basedb.app_user u
      WHERE u.tenant_id = $2 AND u.deleted_at IS NULL AND u.is_instance_admin
     ON CONFLICT DO NOTHING`,
    [everyone.id, tenant.id, actorId],
    'insert',
  )

  return { admins: admins.id, everyone: everyone.id }
}

/** What a system group is, from its technical name. */
function systemOf(name: string, isSystem: boolean): SystemGroup | null {
  if (!isSystem) return null
  if (name === ADMINS) return 'admins'
  if (name === EVERYONE) return 'everyone'
  return null
}

/** The groups of the tenant, system groups first. Administration only. */
export async function listGroups(
  pools: Pools,
  ctx: RequestContext,
): Promise<readonly GroupSummary[]> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
    return loadGroups(exec, ctx)
  })
}

export async function loadGroups(
  exec: Executor,
  ctx: RequestContext,
): Promise<readonly GroupSummary[]> {
  const rows = await exec.query<{
    id: string
    label: string
    name: string
    is_system: boolean
    members: string
  }>(
    `SELECT r.id, r.label, r.name, r.is_system,
            (SELECT count(*) FROM _basedb.role_member m
               JOIN _basedb.app_user u ON u.id = m.user_id AND u.deleted_at IS NULL
              WHERE m.role_id = r.id) AS members
       FROM _basedb.role r
       JOIN _basedb.tenant t ON t.id = r.tenant_id
      WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
      ORDER BY (r.name = $2) DESC, (r.name = $3) DESC, r.label`,
    [ctx.tenantId, ADMINS, EVERYONE],
  )
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    system: systemOf(r.name, r.is_system),
    memberCount: Number(r.members),
  }))
}

/** A live group of the tenant — or `RESOURCE_NOT_FOUND`. */
export async function loadGroup(
  exec: Executor,
  ctx: RequestContext,
  groupId: string,
): Promise<{ id: string; label: string; system: SystemGroup | null }> {
  const rows = await exec.query<{ id: string; label: string; name: string; is_system: boolean }>(
    `SELECT r.id, r.label, r.name, r.is_system
       FROM _basedb.role r
       JOIN _basedb.tenant t ON t.id = r.tenant_id
      WHERE r.id::text = $1 AND t.ref = $2 AND r.kind = 'group' AND r.deleted_at IS NULL`,
    [groupId, ctx.tenantId],
  )
  const row = rows[0]
  if (row === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { group: groupId } })
  return { id: row.id, label: row.label, system: systemOf(row.name, row.is_system) }
}

function checkLabel(label: string): string {
  const trimmed = typeof label === 'string' ? label.normalize('NFC').trim() : ''
  if (trimmed === '') throw new BasedbError('LABEL_EMPTY')
  if ([...trimmed].length > 120)
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: 120 } })
  return trimmed
}

async function assertLabelFree(
  exec: Executor,
  ctx: RequestContext,
  label: string,
  except: string | null,
): Promise<void> {
  const clash = await exec.query<{ id: string }>(
    `SELECT r.id FROM _basedb.role r
       JOIN _basedb.tenant t ON t.id = r.tenant_id
      WHERE t.ref = $1 AND r.label_key = $2 AND r.deleted_at IS NULL
        AND ($3::uuid IS NULL OR r.id <> $3::uuid)`,
    [ctx.tenantId, labelKey(label), except],
  )
  if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
}

/** The preamble of every write: administration, a recent elevation, the system groups. */
async function administering(
  exec: Executor,
  ctx: RequestContext,
  sessionId: string,
): Promise<SystemGroupIds> {
  await requireAdministration(exec, ctx)
  await requireElevatedSession(exec, ctx, sessionId)
  return ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
}

export async function createGroup(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly label: string; readonly sessionId: string },
): Promise<GroupSummary> {
  const label = checkLabel(request.label)
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await administering(exec, ctx, request.sessionId)
    await assertLabelFree(exec, ctx, label, null)
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, kind, created_by)
       SELECT t.id, $2, $3, $4, 'group', $5 FROM _basedb.tenant t WHERE t.ref = $1
       RETURNING id`,
      [
        ctx.tenantId,
        label,
        labelKey(label),
        `groupe_${randomBytes(6).toString('hex')}`,
        ctx.actor.id,
      ],
      'insert',
    )
    await writeAudit(exec, ctx, {
      action: 'group.create',
      objectKind: 'role',
      objectId: row.id,
      objectName: label,
    })
    return { id: row.id, label, system: null, memberCount: 0 }
  })
}

export async function renameGroup(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly groupId: string; readonly label: string; readonly sessionId: string },
): Promise<{ readonly label: string }> {
  const label = checkLabel(request.label)
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await administering(exec, ctx, request.sessionId)
    const group = await loadGroup(exec, ctx, request.groupId)
    if (group.system !== null) throw new BasedbError('GROUP_SYSTEM_IMMUTABLE')
    await assertLabelFree(exec, ctx, label, group.id)
    await exec.query(
      'UPDATE _basedb.role SET label = $2, label_key = $3 WHERE id = $1',
      [group.id, label, labelKey(label)],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'group.rename',
      objectKind: 'role',
      objectId: group.id,
      objectName: label,
      payload: { previous: group.label },
    })
    return { label }
  })
}

/**
 * Deletes a group. Its members lose what it granted at once: the role is marked deleted,
 * which the grants loader ignores, and the write moves `authz_version`. The rows stay,
 * for the audit of who could do what, and when.
 */
export async function deleteGroup(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly groupId: string; readonly sessionId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await administering(exec, ctx, request.sessionId)
    const group = await loadGroup(exec, ctx, request.groupId)
    if (group.system !== null) throw new BasedbError('GROUP_SYSTEM_IMMUTABLE')
    await exec.query(
      'UPDATE _basedb.role SET deleted_at = clock_timestamp(), deleted_by = $2 WHERE id = $1',
      [group.id, ctx.actor.id],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'group.delete',
      objectKind: 'role',
      objectId: group.id,
      objectName: group.label,
    })
  })
}

/** The members of a group: id, name and address. Administration only. */
export async function listGroupMembers(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly groupId: string },
): Promise<ReadonlyArray<{ id: string; email: string; displayName: string }>> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    const group = await loadGroup(exec, ctx, request.groupId)
    const rows = await exec.query<{ id: string; email: string; display_name: string }>(
      `SELECT u.id, u.email, u.display_name
         FROM _basedb.role_member m
         JOIN _basedb.app_user u ON u.id = m.user_id AND u.deleted_at IS NULL
        WHERE m.role_id = $1
        ORDER BY u.display_name, u.email`,
      [group.id],
    )
    return rows.map((r) => ({ id: r.id, email: r.email, displayName: r.display_name }))
  })
}

/**
 * Adds or removes one person from one group.
 *
 * « Tous les utilisateurs » is not edited: everyone is in it, always. The last
 * Administrator cannot leave the Administrators — an instance nobody can administer is
 * repaired only from the database (05 §12).
 */
export async function setGroupMembership(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly groupId: string
    readonly userId: string
    readonly member: boolean
    readonly sessionId: string
  },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await administering(exec, ctx, request.sessionId)
    const group = await loadGroup(exec, ctx, request.groupId)
    await changeMembership(exec, ctx, group, request.userId, request.member)
  })
}

/** One membership change, with the two system rules. Shared with the account screen. */
export async function changeMembership(
  exec: Executor,
  ctx: RequestContext,
  group: { id: string; label: string; system: SystemGroup | null },
  userId: string,
  member: boolean,
): Promise<void> {
  if (group.system === 'everyone') throw new BasedbError('GROUP_SYSTEM_IMMUTABLE')

  const users = await exec.query<{ id: string; label: string }>(
    `SELECT u.id, u.display_name AS label FROM _basedb.app_user u
       JOIN _basedb.tenant t ON t.id = u.tenant_id
      WHERE u.id::text = $1 AND t.ref = $2 AND u.deleted_at IS NULL`,
    [userId, ctx.tenantId],
  )
  const user = users[0]
  if (user === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { user: userId } })

  if (member) {
    await exec.query(
      `INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [group.id, user.id, ctx.actor.id],
      'insert',
    )
  } else {
    if (group.system === 'admins') await assertAnotherAdmin(exec, group.id, user.id)
    await exec.query(
      'DELETE FROM _basedb.role_member WHERE role_id = $1 AND user_id = $2',
      [group.id, user.id],
      'delete',
    )
  }
  await writeAudit(exec, ctx, {
    action: member ? 'group.member_add' : 'group.member_remove',
    objectKind: 'role',
    objectId: group.id,
    objectName: group.label,
    payload: { user: user.id },
  })
}

/**
 * Refuses to leave the Administrators without an ACTIVE member other than `userId`
 * (`LAST_TENANT_ADMIN`). The lock serializes two administrators demoting each other at
 * the same moment, each of whom would otherwise see the other still there.
 */
export async function assertAnotherAdmin(
  exec: Executor,
  adminsGroupId: string,
  userId: string,
): Promise<void> {
  await exec.query('SELECT id FROM _basedb.role WHERE id = $1 FOR UPDATE', [adminsGroupId])
  const [row] = await exec.query<{ n: string }>(
    `SELECT count(*) AS n FROM _basedb.role_member m
       JOIN _basedb.app_user u ON u.id = m.user_id
      WHERE m.role_id = $1 AND m.user_id <> $2
        AND u.deleted_at IS NULL AND u.disabled_at IS NULL`,
    [adminsGroupId, userId],
  )
  if (Number(row?.n ?? 0) === 0) throw new BasedbError('LAST_TENANT_ADMIN')
}
