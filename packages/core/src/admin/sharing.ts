import { createHash, randomBytes } from 'node:crypto'
import { writeAudit } from '../audit/journal.js'
import { seal, unseal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants as loadActorGrants } from '../rbac/loader.js'
import { loadBaseTarget, loadProjectTarget, requireAction } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import {
  type AccessLevel,
  type AccessProject,
  LEVEL_ACTIONS,
  RANK,
  applyLevel,
  key,
  loadGrants,
  loadTree,
  locate,
  max,
  writeLevels,
} from './access.js'

/**
 * Sharing a project or a base — chapter 05 §15.8.
 *
 * Whoever MANAGES a project or a base shares it: they invite people by a link, at a level,
 * change what someone they shared with may do, or take it back. No elevation is asked: it
 * is the everyday gesture of a team, not the administration of the tenant. It never goes
 * beyond the scope: a base's manager shares that base, not its project, and no level is
 * higher than « Gestion », which they hold.
 *
 * What is shared with a person lands on their own role — a role of kind `person` whose only
 * member is them — so that the decider, which knows roles and nothing else, needs no change.
 */

export interface ShareScope {
  readonly kind: 'project' | 'base'
  readonly id: string
}

/** The levels a share may give: « none » is taking it back, never an invitation. */
export const SHARE_LEVELS: readonly AccessLevel[] = ['read', 'edit', 'manage']

/** An invitation link lives a week, then asks to be made again. */
export const INVITATION_DAYS = 7

const SEAL_PURPOSE = 'invitation'
const hashOf = (token: string) => createHash('sha256').update(token).digest()

/** A fresh link secret: 24 random bytes, base64url — 32 characters, URL-safe. */
const newToken = () => randomBytes(24).toString('base64url')

export interface SharedPerson {
  readonly userId: string
  readonly displayName: string
  readonly email: string
  /** What they may do on the scope, all their direct shares counted. */
  readonly level: AccessLevel | 'granular'
  /**
   * Where it comes from: given on this scope, or on the project above it — which only the
   * project's sharing changes.
   */
  readonly from: 'here' | 'project'
  readonly you: boolean
}

export interface SharedGroup {
  readonly id: string
  readonly label: string
  readonly level: AccessLevel | 'granular'
}

export interface PendingInvitation {
  readonly id: string
  readonly email: string
  readonly level: AccessLevel
  readonly expiresAt: string
  readonly invitedBy: string
  /** The link's secret, shown again to whoever manages the scope, so it can be resent. */
  readonly token: string
}

export interface ScopeSharing {
  readonly scope: { readonly kind: 'project' | 'base'; readonly id: string; readonly label: string }
  readonly people: readonly SharedPerson[]
  readonly groups: readonly SharedGroup[]
  readonly invitations: readonly PendingInvitation[]
}

interface Where {
  readonly project: AccessProject
  readonly path: readonly string[]
  readonly label: string
}

function checkScope(scope: ShareScope | undefined): ShareScope {
  if (
    scope === undefined ||
    (scope.kind !== 'project' && scope.kind !== 'base') ||
    typeof scope.id !== 'string'
  ) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'scope' } })
  }
  return scope
}

function checkLevel(level: unknown, allowNone: boolean): AccessLevel {
  const allowed: readonly unknown[] = allowNone ? ['none', ...SHARE_LEVELS] : SHARE_LEVELS
  if (!allowed.includes(level)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'level' } })
  }
  return level as AccessLevel
}

/**
 * Checks that the actor manages the scope, and places it in its project.
 *
 * `RESOURCE_NOT_FOUND` for what the actor cannot see, `ADMIN_REQUIRED` for what they see
 * without managing it — the answers every write of the kernel gives.
 */
async function requireSharing(
  exec: Executor,
  ctx: RequestContext,
  scope: ShareScope,
): Promise<Where> {
  if (ctx.actor.kind !== 'user') throw new BasedbError('RESOURCE_NOT_FOUND')
  const target =
    scope.kind === 'project'
      ? await loadProjectTarget(exec, ctx, scope.id)
      : await loadBaseTarget(exec, ctx, scope.id)
  await requireAction(exec, ctx, 'manage_schema', target, { [scope.kind]: scope.id })
  return placed(exec, ctx, scope)
}

async function placed(exec: Executor, ctx: RequestContext, scope: ShareScope): Promise<Where> {
  const tree = await loadTree(exec, ctx)
  const where = locate(tree, scope)
  if (where === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { [scope.kind]: scope.id } })
  }
  const base = where.project.bases.find((b) => key('base', b.id) === where.path.at(-1))
  return { ...where, label: scope.kind === 'project' ? where.project.label : (base?.label ?? '') }
}

/**
 * The person's own role, created on first use. It is `is_system` — nobody names it, lists
 * it or deletes it — and its label is a key no group label can take.
 */
export async function personalRole(
  exec: Executor,
  ctx: RequestContext,
  userId: string,
): Promise<string> {
  const [found] = await exec.query<{ id: string }>(
    `SELECT r.id FROM _basedb.role r
       JOIN _basedb.role_member m ON m.role_id = r.id
      WHERE r.kind = 'person' AND m.user_id = $1 AND r.deleted_at IS NULL`,
    [userId],
  )
  if (found !== undefined) return found.id
  const [role] = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.role (tenant_id, label, label_key, name, is_system, kind, created_by)
     SELECT u.tenant_id, 'Accès de ' || u.display_name, '#person:' || u.id::text,
            'person_' || replace(u.id::text, '-', ''), true, 'person', $2
       FROM _basedb.app_user u WHERE u.id = $1
     RETURNING id`,
    [userId, ctx.actor.id],
    'insert',
  )
  await exec.query(
    'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
    [role.id, userId, ctx.actor.id],
    'insert',
  )
  return role.id
}

/**
 * Gives a person « Gestion » on a project they have just created: whoever creates a
 * project manages it, and shares it (§15.1).
 */
export async function grantCreator(
  exec: Executor,
  ctx: RequestContext,
  projectId: string,
): Promise<void> {
  const role = await personalRole(exec, ctx, ctx.actor.id)
  for (const action of LEVEL_ACTIONS.manage) {
    await exec.query(
      `INSERT INTO _basedb.permission (role_id, scope_kind, scope_project_id, action, granted_by)
       VALUES ($1, 'project', $2, $3, $4) ON CONFLICT DO NOTHING`,
      [role, projectId, action, ctx.actor.id],
      'insert',
    )
  }
}

/** A role's level on the scope's node, and whether it comes from the project above. */
function levelAt(
  where: Where,
  levels: ReadonlyMap<string, AccessLevel> | undefined,
): { level: AccessLevel | 'granular'; from: 'here' | 'project' } | null {
  if (levels === undefined) return null
  const node = where.path.at(-1) as string
  const projectKey = key('project', where.project.id)
  const fromProject = levels.get(projectKey) ?? 'none'
  let effective: AccessLevel = 'none'
  for (const n of where.path) effective = max(effective, levels.get(n) ?? 'none')
  if (effective !== 'none') {
    return {
      level: effective,
      from: node !== projectKey && fromProject === effective ? 'project' : 'here',
    }
  }
  // Nothing on the node itself, but something below it: « sur une partie ».
  const below = [...levels.keys()].some((k) => k !== node && isUnder(where, k))
  return below ? { level: 'granular', from: 'here' } : null
}

function isUnder(where: Where, nodeKey: string): boolean {
  const node = where.path.at(-1) as string
  if (node.startsWith('project:')) {
    return where.project.bases.some(
      (b) => key('base', b.id) === nodeKey || b.tables.some((t) => key('table', t.id) === nodeKey),
    )
  }
  const base = where.project.bases.find((b) => key('base', b.id) === node)
  return base?.tables.some((t) => key('table', t.id) === nodeKey) ?? false
}

async function sharingOf(
  exec: Executor,
  ctx: RequestContext,
  instanceKey: string,
  scope: ShareScope,
  where: Where,
): Promise<ScopeSharing> {
  const personal = await loadGrants(exec, ctx, 'person')
  const owners = await exec.query<{
    role_id: string
    user_id: string
    display_name: string
    email: string
  }>(
    `SELECT r.id AS role_id, u.id AS user_id, u.display_name, u.email
       FROM _basedb.role r
       JOIN _basedb.role_member m ON m.role_id = r.id
       JOIN _basedb.app_user u    ON u.id = m.user_id AND u.deleted_at IS NULL
      WHERE r.kind = 'person' AND r.deleted_at IS NULL AND r.id = ANY($1::uuid[])`,
    [[...personal.keys()]],
  )
  const people: SharedPerson[] = []
  for (const owner of owners) {
    const at = levelAt(where, personal.get(owner.role_id))
    if (at === null) continue
    people.push({
      userId: owner.user_id,
      displayName: owner.display_name,
      email: owner.email,
      level: at.level,
      from: at.from,
      you: owner.user_id === ctx.actor.id,
    })
  }
  people.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'))

  const grouped = await loadGrants(exec, ctx, 'group')
  const labels = await exec.query<{ id: string; label: string }>(
    `SELECT r.id, r.label FROM _basedb.role r
      WHERE r.kind = 'group' AND r.deleted_at IS NULL AND r.id = ANY($1::uuid[])
      ORDER BY r.label`,
    [[...grouped.keys()]],
  )
  const groups: SharedGroup[] = []
  for (const group of labels) {
    const at = levelAt(where, grouped.get(group.id))
    if (at !== null) groups.push({ id: group.id, label: group.label, level: at.level })
  }

  const rows = await exec.query<{
    id: string
    email: string
    level: AccessLevel
    expires_at: Date
    invited_by: string
    token_sealed: string
  }>(
    `SELECT i.id, i.email, i.level, i.expires_at, u.display_name AS invited_by, i.token_sealed
       FROM _basedb.invitation i
       JOIN _basedb.app_user u ON u.id = i.created_by
      WHERE (i.scope_project_id = $1 OR i.scope_base_id = $1)
        AND i.accepted_at IS NULL AND i.revoked_at IS NULL
        AND i.expires_at > clock_timestamp()
      ORDER BY i.created_at`,
    [scope.id],
  )
  const invitations: PendingInvitation[] = rows.flatMap((r) => {
    const token = unseal(instanceKey, SEAL_PURPOSE, r.token_sealed)
    return token === null
      ? []
      : [
          {
            id: r.id,
            email: r.email,
            level: r.level,
            expiresAt: new Date(r.expires_at).toISOString(),
            invitedBy: r.invited_by,
            token,
          },
        ]
  })

  return {
    scope: { kind: scope.kind, id: scope.id, label: where.label },
    people,
    groups,
    invitations,
  }
}

/** Who has access to a project or a base, and who is invited to it. Its managers only. */
export async function scopeSharing(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly scope: ShareScope },
): Promise<ScopeSharing> {
  const scope = checkScope(request.scope)
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) =>
      sharingOf(exec, ctx, instanceKey, scope, await requireSharing(exec, ctx, scope)),
    { readOnly: false },
  )
}

/**
 * Invites someone to a project or a base: a link, valid a week, which gives the level to
 * whoever opens it and signs in — or creates their account.
 */
export async function inviteToScope(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly scope: ShareScope; readonly email: string; readonly level: AccessLevel },
): Promise<PendingInvitation> {
  const scope = checkScope(request.scope)
  const level = checkLevel(request.level, false)
  const email = typeof request.email === 'string' ? request.email.trim() : ''
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'email' } })
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const where = await requireSharing(exec, ctx, scope)
    const token = newToken()
    const [row] = await exec.query<{ id: string; expires_at: Date }>(
      `INSERT INTO _basedb.invitation
         (tenant_id, scope_kind, scope_project_id, scope_base_id, level, email,
          token_hash, token_sealed, expires_at, created_by)
       SELECT t.id, $2, $3, $4, $5, $6, $7, $8,
              clock_timestamp() + make_interval(days => $9), $10
         FROM _basedb.tenant t WHERE t.ref = $1
       RETURNING id, expires_at`,
      [
        ctx.tenantId,
        scope.kind,
        scope.kind === 'project' ? scope.id : null,
        scope.kind === 'base' ? scope.id : null,
        level,
        email,
        hashOf(token),
        seal(instanceKey, SEAL_PURPOSE, token),
        INVITATION_DAYS,
        ctx.actor.id,
      ],
      'insert',
    )
    await writeAudit(exec, ctx, {
      action: 'invitation.create',
      objectKind: scope.kind,
      objectId: scope.id,
      objectName: where.label,
      payload: { email, level },
    })
    const [me] = await exec.query<{ display_name: string }>(
      'SELECT display_name FROM _basedb.app_user WHERE id = $1',
      [ctx.actor.id],
    )
    return {
      id: row.id,
      email,
      level,
      expiresAt: new Date(row.expires_at).toISOString(),
      invitedBy: me?.display_name ?? '',
      token,
    }
  })
}

/** Takes back a pending invitation: its link stops working at once. */
export async function revokeInvitation(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly invitationId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [row] = await exec.query<{
      scope_kind: 'project' | 'base'
      scope_id: string
      email: string
    }>(
      `SELECT i.scope_kind, coalesce(i.scope_project_id, i.scope_base_id)::text AS scope_id,
              i.email
         FROM _basedb.invitation i
         JOIN _basedb.tenant t ON t.id = i.tenant_id
        WHERE i.id::text = $1 AND t.ref = $2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL`,
      [request.invitationId, ctx.tenantId],
    )
    if (row === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { invitation: request.invitationId } })
    }
    const where = await requireSharing(exec, ctx, { kind: row.scope_kind, id: row.scope_id })
    await exec.query(
      'UPDATE _basedb.invitation SET revoked_at = clock_timestamp() WHERE id::text = $1',
      [request.invitationId],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'invitation.revoke',
      objectKind: row.scope_kind,
      objectId: row.scope_id,
      objectName: where.label,
      payload: { email: row.email },
    })
  })
}

/**
 * Changes what a person the scope was shared with may do there — « none » takes it back.
 *
 * Only what was given on this scope: an access that comes from the project is changed in
 * the project's sharing, never from one of its bases, whose manager does not manage it.
 * And never one's own: a manager lowering themselves could leave a project nobody manages.
 */
export async function setPersonAccess(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly scope: ShareScope; readonly userId: string; readonly level: AccessLevel },
): Promise<ScopeSharing> {
  const scope = checkScope(request.scope)
  const level = checkLevel(request.level, true)
  if (request.userId === ctx.actor.id) {
    throw new BasedbError('ACTION_FORBIDDEN', { details: { reason: 'son_propre_acces' } })
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const where = await requireSharing(exec, ctx, scope)
    const personal = await loadGrants(exec, ctx, 'person')
    const [owner] = await exec.query<{ role_id: string; display_name: string }>(
      `SELECT r.id AS role_id, u.display_name
         FROM _basedb.role r
         JOIN _basedb.role_member m ON m.role_id = r.id
         JOIN _basedb.app_user u    ON u.id = m.user_id
         JOIN _basedb.tenant t      ON t.id = u.tenant_id
        WHERE r.kind = 'person' AND r.deleted_at IS NULL AND u.id::text = $1 AND t.ref = $2`,
      [request.userId, ctx.tenantId],
    )
    const levels = owner === undefined ? undefined : personal.get(owner.role_id)
    const at = levelAt(where, levels)
    // Someone the scope was never shared with: sharing starts with an invitation, the
    // directory of the tenant is not a list to pick strangers from.
    if (owner === undefined || levels === undefined || at === null) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { user: request.userId } })
    }
    if (at.from === 'project') {
      throw new BasedbError('ACTION_FORBIDDEN', { details: { reason: 'herite' } })
    }

    const mine = new Map(levels)
    applyLevel(where.project, where.path, level, mine)
    await writeLevels(exec, ctx, where.project, owner.role_id, mine)
    await writeAudit(exec, ctx, {
      action: 'share.set',
      objectKind: scope.kind,
      objectId: scope.id,
      objectName: where.label,
      payload: { user: request.userId, level },
    })
    return sharingOf(exec, ctx, instanceKey, scope, where)
  })
}

interface InvitationRow {
  readonly id: string
  readonly scope_kind: 'project' | 'base'
  readonly scope_id: string
  readonly level: AccessLevel
  readonly email: string
  readonly expires_at: Date
  readonly accepted_by: string | null
  readonly created_by: string
  readonly invited_by: string
}

/** A pending, unexpired invitation of the tenant, by its link's secret; `null` otherwise. */
export async function findInvitation(
  exec: Executor,
  tenantRef: string,
  token: string,
  options: { readonly lock?: boolean; readonly acceptedBy?: string } = {},
): Promise<InvitationRow | null> {
  if (typeof token !== 'string' || token.length < 16 || token.length > 128) return null
  const [row] = await exec.query<InvitationRow & Record<string, unknown>>(
    `SELECT i.id, i.scope_kind, coalesce(i.scope_project_id, i.scope_base_id)::text AS scope_id,
            i.level, i.email, i.expires_at, i.accepted_by, i.created_by,
            u.display_name AS invited_by
       FROM _basedb.invitation i
       JOIN _basedb.tenant t   ON t.id = i.tenant_id
       JOIN _basedb.app_user u ON u.id = i.created_by
      WHERE i.token_hash = $1 AND t.ref = $2 AND i.revoked_at IS NULL
        AND i.expires_at > clock_timestamp()
        AND (i.accepted_at IS NULL OR i.accepted_by::text = $3)
      ${options.lock === true ? 'FOR UPDATE OF i' : ''}`,
    [hashOf(token), tenantRef, options.acceptedBy ?? null],
  )
  return row ?? null
}

export interface InvitationPreview {
  readonly scope: { readonly kind: 'project' | 'base'; readonly label: string }
  /** The project a base belongs to — the same label as `scope` for a project. */
  readonly project: string
  readonly level: AccessLevel
  readonly email: string
  readonly invitedBy: string
  readonly expiresAt: string
}

/**
 * What an invitation offers, for its link's page — before anyone signs in. The link's
 * secret is what proves the right to know it; a wrong or spent one finds nothing.
 */
export async function invitationPreview(
  pools: Pools,
  tenantRef: string,
  token: string,
): Promise<InvitationPreview> {
  return pools.withConnection('catalog', async (exec) => {
    const row = await findInvitation(exec, tenantRef, token)
    if (row === null || row.accepted_by !== null) throw new BasedbError('RESOURCE_NOT_FOUND')
    const [labels] = await exec.query<{ label: string; project: string }>(
      row.scope_kind === 'project'
        ? `SELECT p.label, p.label AS project FROM _basedb.project p
            WHERE p.id::text = $1 AND p.deleted_at IS NULL`
        : `SELECT b.label, p.label AS project
             FROM _basedb.base b JOIN _basedb.project p ON p.id = b.project_id
            WHERE b.id::text = $1 AND b.deleted_at IS NULL AND b.is_live`,
      [row.scope_id],
    )
    if (labels === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')
    return {
      scope: { kind: row.scope_kind, label: labels.label },
      project: labels.project,
      level: row.level,
      email: row.email,
      invitedBy: row.invited_by,
      expiresAt: new Date(row.expires_at).toISOString(),
    }
  })
}

/**
 * Accepts an invitation as the signed-in person: they receive its level on its scope —
 * never less than they already had there — and the link is spent.
 *
 * The one who invited must still manage the scope: an invitation made by someone who has
 * since lost that right gives nothing. Accepting twice, by the same person, is not an
 * error: a reload of the page after signing up lands here again.
 */
export async function acceptInvitation(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly token: string },
): Promise<{ readonly projectId: string; readonly baseId: string | null }> {
  if (ctx.actor.kind !== 'user') throw new BasedbError('RESOURCE_NOT_FOUND')

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const row = await findInvitation(exec, ctx.tenantId, request.token, {
      lock: true,
      acceptedBy: ctx.actor.id,
    })
    if (row === null) throw new BasedbError('RESOURCE_NOT_FOUND')
    const scope: ShareScope = { kind: row.scope_kind, id: row.scope_id }

    // The inviter's right, checked now rather than when they made the link.
    const inviter = sealContext({ ...ctx, actor: { kind: 'user', id: row.created_by } })
    const target =
      scope.kind === 'project'
        ? await loadProjectTarget(exec, inviter, scope.id)
        : await loadBaseTarget(exec, inviter, scope.id)
    const inviterGrants = await loadActorGrants(exec, inviter)
    if (
      target === null ||
      decide(inviter, inviterGrants, 'manage_schema', target).verdict !== 'ALLOWED'
    ) {
      throw new BasedbError('RESOURCE_NOT_FOUND')
    }

    const where = await placed(exec, ctx, scope)
    if (row.accepted_by === null) {
      const role = await personalRole(exec, ctx, ctx.actor.id)
      const personal = await loadGrants(exec, ctx, 'person')
      const mine = new Map(personal.get(role) ?? [])
      let held: AccessLevel = 'none'
      for (const node of where.path) held = max(held, mine.get(node) ?? 'none')
      if (RANK[row.level] > RANK[held]) {
        applyLevel(where.project, where.path, row.level, mine)
        await writeLevels(exec, ctx, where.project, role, mine)
      }
      await exec.query(
        `UPDATE _basedb.invitation SET accepted_at = clock_timestamp(), accepted_by = $2
          WHERE id = $1`,
        [row.id, ctx.actor.id],
        'update',
      )
      await writeAudit(exec, ctx, {
        action: 'invitation.accept',
        objectKind: scope.kind,
        objectId: scope.id,
        objectName: where.label,
        payload: { level: row.level },
      })
    }
    return { projectId: where.project.id, baseId: scope.kind === 'base' ? scope.id : null }
  })
}
