import { createHash, randomBytes } from 'node:crypto'
import { writeAudit } from '../audit/journal.js'
import { seal, unseal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import { type Dashboard, readDashboard, requireSeesBase } from './dashboards.js'

/**
 * Shared dashboards — chapter 18 §2.5.
 *
 * A dashboard is shared as a data view is (chapter 15 §10): a link, PUBLIC — anyone who
 * has it —, or for MEMBERS — any signed-in member of the tenant, or of chosen groups. It
 * opens the dashboard read-only to someone who holds no right on the base.
 *
 * Its cards then read on the authority of the person who PUBLISHED the share, decided
 * again at every read: a publisher who no longer sees the base — or who left — closes the
 * link with it. And the visitor reads what the dashboard shows, nothing else: its cards
 * as they were built, its filters as they are tied — never a query of their own, never an
 * exploration.
 *
 * The link is a bearer secret. The catalog keeps its hash, to find it, and the secret
 * sealed with the instance key, to show it again to whoever shares — never in clear.
 */

export type DashboardShareAccess = 'public' | 'members'

/** Why a shared dashboard does not open — or `open` when it does. */
export type DashboardShareState = 'open' | 'inactive' | 'authority'

export interface DashboardShare {
  readonly id: string
  readonly dashboardId: string
  readonly access: DashboardShareAccess
  readonly active: boolean
  /** The secret of the link: the page is `/d/<token>`. */
  readonly token: string
  readonly publishedBy: { readonly id: string; readonly name: string | null }
  /** The groups a members' share is reserved to — none: every member. */
  readonly groupIds: readonly string[]
  readonly state: DashboardShareState
  /** The page may be framed by another site. */
  readonly canEmbed: boolean
}

export interface DashboardSharing {
  readonly share: DashboardShare | null
  /** The tenant's groups, to reserve a members' share to some of them. */
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

export interface DashboardShareSettings {
  readonly access: DashboardShareAccess
  readonly active: boolean
  readonly groupIds: readonly string[]
  readonly canEmbed?: boolean
}

const SEAL_PURPOSE = 'dashboard-share'
/** The budget of a read on the publisher's authority: one card, one query. */
const READ_TIMEOUT_MS = 30_000

const hashOf = (token: string) => createHash('sha256').update(token).digest()

/** A fresh link secret: 24 random bytes, base64url — 32 characters, URL-safe. */
const newToken = () => randomBytes(24).toString('base64url')

interface ShareRow extends Record<string, unknown> {
  readonly id: string
  readonly tenant_ref: string
  readonly dashboard_id: string
  readonly base_id: string
  readonly access: DashboardShareAccess
  readonly token_sealed: string
  readonly is_active: boolean
  readonly can_embed: boolean
  readonly published_by: string
  readonly publisher_name: string | null
  readonly publisher_live: boolean
  readonly dashboard_live: boolean
  readonly base_live: boolean
  readonly group_ids: string[]
}

const SHARE_SELECT = `
  SELECT s.id::text, te.ref AS tenant_ref, s.dashboard_id::text, s.base_id::text, s.access,
         s.token_sealed, s.is_active, s.can_embed, s.published_by::text,
         u.display_name AS publisher_name,
         (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS publisher_live,
         d.deleted_at IS NULL AS dashboard_live, b.deleted_at IS NULL AS base_live,
         coalesce((SELECT array_agg(r.role_id::text ORDER BY r.role_id)
                     FROM _basedb.dashboard_share_role r WHERE r.share_id = s.id), '{}') AS group_ids
    FROM _basedb.dashboard_share s
    JOIN _basedb.tenant te   ON te.id = s.tenant_id
    JOIN _basedb.dashboard d ON d.id = s.dashboard_id
    JOIN _basedb.base b      ON b.id = s.base_id
    JOIN _basedb.app_user u  ON u.id = s.published_by`

/** The publisher's context: the authority the cards read on. */
function authorityOf(row: ShareRow, requestId: string): RequestContext {
  const now = new Date()
  return sealContext({
    requestId,
    actor: { kind: 'user', id: row.published_by },
    tenantId: row.tenant_ref,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + READ_TIMEOUT_MS),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

/** May the publisher still see the base — read one of its tables, or build it? */
async function publisherSees(exec: Executor, row: ShareRow, requestId: string): Promise<boolean> {
  if (!row.publisher_live) return false
  try {
    await requireSeesBase(exec, authorityOf(row, requestId), row.base_id)
    return true
  } catch (error) {
    if (error instanceof BasedbError) return false
    throw error
  }
}

const stateOf = (row: ShareRow, allowed: boolean): DashboardShareState =>
  !row.is_active ? 'inactive' : allowed ? 'open' : 'authority'

function toShare(row: ShareRow, instanceKey: string, state: DashboardShareState): DashboardShare {
  // A share sealed under another instance key cannot be shown: it is to be regenerated —
  // said by an empty token rather than by a crash of the dialog.
  const token = unseal(instanceKey, SEAL_PURPOSE, row.token_sealed) ?? ''
  return {
    id: row.id,
    dashboardId: row.dashboard_id,
    access: row.access,
    active: row.is_active,
    token,
    publishedBy: { id: row.published_by, name: row.publisher_name },
    groupIds: row.group_ids,
    state,
    canEmbed: row.can_embed,
  }
}

async function liveDashboard(exec: Executor, baseId: string, id: string): Promise<Dashboard> {
  const dashboard = await readDashboard(exec, baseId, id)
  if (dashboard === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { dashboard: id } })
  }
  return dashboard
}

async function sharingOf(
  exec: Executor,
  ctx: RequestContext,
  instanceKey: string,
  dashboardId: string,
): Promise<DashboardSharing> {
  const groups = await exec.query<{ id: string; label: string }>(
    `SELECT r.id::text, r.label FROM _basedb.role r
       JOIN _basedb.tenant t ON t.id = r.tenant_id
      WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
      ORDER BY r.label`,
    [ctx.tenantId],
  )
  const [row] = await exec.query<ShareRow>(`${SHARE_SELECT} WHERE s.dashboard_id::text = $1`, [
    dashboardId,
  ])
  if (row === undefined) return { share: null, groups }
  const allowed = await publisherSees(exec, row, ctx.requestId)
  return { share: toShare(row, instanceKey, stateOf(row, allowed)), groups }
}

/** How a dashboard is shared: its link and settings, or none. `manage_schema` on the base. */
export async function getDashboardSharing(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly baseId: string; readonly dashboardId: string },
): Promise<DashboardSharing> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      await liveDashboard(exec, request.baseId, request.dashboardId)
      return sharingOf(exec, ctx, instanceKey, request.dashboardId)
    },
    { readOnly: true },
  )
}

function checkSettings(raw: DashboardShareSettings): DashboardShareSettings {
  if (raw.access !== 'public' && raw.access !== 'members') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'access' } })
  }
  if (typeof raw.active !== 'boolean') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'active' } })
  }
  if (!Array.isArray(raw.groupIds) || raw.groupIds.some((g) => typeof g !== 'string')) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'groups' } })
  }
  if (raw.canEmbed !== undefined && typeof raw.canEmbed !== 'boolean') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'can_embed' } })
  }
  // Groups reserve a members' share; a public one is open to anyone, and keeps none.
  return { ...raw, groupIds: raw.access === 'public' ? [] : [...new Set(raw.groupIds)] }
}

/**
 * Shares a dashboard, or changes how it is shared. Whoever saves becomes its publisher:
 * the cards read on THEIR authority from then on. `manage_schema` on the base.
 */
export async function saveDashboardSharing(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly baseId: string; readonly dashboardId: string } & DashboardShareSettings,
): Promise<DashboardSharing> {
  const settings = checkSettings(request)
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const dashboard = await liveDashboard(exec, request.baseId, request.dashboardId)
    const canEmbed = settings.canEmbed === true
    if (settings.groupIds.length > 0) {
      const known = await exec.query<{ id: string }>(
        `SELECT r.id::text FROM _basedb.role r JOIN _basedb.tenant t ON t.id = r.tenant_id
          WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
            AND r.id::text = ANY($2::text[])`,
        [ctx.tenantId, settings.groupIds],
      )
      if (known.length !== settings.groupIds.length) {
        throw new BasedbError('REQUEST_INVALID', { details: { field: 'groups' } })
      }
    }

    const [existing] = await exec.query<{ id: string }>(
      'SELECT id::text FROM _basedb.dashboard_share WHERE dashboard_id::text = $1',
      [request.dashboardId],
    )
    let shareId: string
    if (existing === undefined) {
      const token = newToken()
      const [created] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.dashboard_share
           (tenant_id, dashboard_id, base_id, access, token_hash, token_sealed, is_active,
            can_embed, published_by, created_by)
         SELECT t.id, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $9
           FROM _basedb.tenant t WHERE t.ref = $1
         RETURNING id::text`,
        [
          ctx.tenantId,
          request.dashboardId,
          request.baseId,
          settings.access,
          hashOf(token),
          seal(instanceKey, SEAL_PURPOSE, token),
          settings.active,
          canEmbed,
          ctx.actor.id,
        ],
        'insert',
      )
      if (created === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')
      shareId = created.id
    } else {
      shareId = existing.id
      await exec.query(
        `UPDATE _basedb.dashboard_share
            SET access = $2, is_active = $3, can_embed = $4, published_by = $5,
                updated_at = clock_timestamp()
          WHERE id = $1::uuid`,
        [shareId, settings.access, settings.active, canEmbed, ctx.actor.id],
        'update',
      )
    }
    await exec.query(
      'DELETE FROM _basedb.dashboard_share_role WHERE share_id = $1::uuid',
      [shareId],
      'delete',
    )
    for (const roleId of settings.groupIds) {
      await exec.query(
        'INSERT INTO _basedb.dashboard_share_role (share_id, role_id) VALUES ($1::uuid, $2::uuid)',
        [shareId, roleId],
        'insert',
      )
    }
    await writeAudit(exec, ctx, {
      action: existing === undefined ? 'dashboard_share.create' : 'dashboard_share.update',
      objectKind: 'dashboard',
      objectId: request.dashboardId,
      objectName: dashboard.label,
      baseId: request.baseId,
      payload: {
        access: settings.access,
        active: settings.active,
        groups: settings.groupIds,
        can_embed: canEmbed,
      },
    })
    return sharingOf(exec, ctx, instanceKey, request.dashboardId)
  })
}

/** A new link for a shared dashboard: the old one stops working at once. */
export async function regenerateDashboardShare(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly baseId: string; readonly dashboardId: string },
): Promise<DashboardSharing> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const dashboard = await liveDashboard(exec, request.baseId, request.dashboardId)
    const token = newToken()
    const updated = await exec.query<{ id: string }>(
      `UPDATE _basedb.dashboard_share
          SET token_hash = $2, token_sealed = $3, published_by = $4,
              updated_at = clock_timestamp()
        WHERE dashboard_id::text = $1
        RETURNING id::text`,
      [request.dashboardId, hashOf(token), seal(instanceKey, SEAL_PURPOSE, token), ctx.actor.id],
      'update',
    )
    if (updated.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { share: request.dashboardId } })
    }
    await writeAudit(exec, ctx, {
      action: 'dashboard_share.regenerate',
      objectKind: 'dashboard',
      objectId: request.dashboardId,
      objectName: dashboard.label,
      baseId: request.baseId,
    })
    return sharingOf(exec, ctx, instanceKey, request.dashboardId)
  })
}

/** Stops sharing a dashboard: the link is forgotten. */
export async function deleteDashboardShare(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly dashboardId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const dashboard = await liveDashboard(exec, request.baseId, request.dashboardId)
    await exec.query(
      'DELETE FROM _basedb.dashboard_share WHERE dashboard_id::text = $1',
      [request.dashboardId],
      'delete',
    )
    await writeAudit(exec, ctx, {
      action: 'dashboard_share.delete',
      objectKind: 'dashboard',
      objectId: request.dashboardId,
      objectName: dashboard.label,
      baseId: request.baseId,
    })
  })
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** A shared dashboard, admitted: what it is, and on whose authority its cards read. */
export interface AdmittedDashboard {
  readonly authority: RequestContext
  readonly baseId: string
  readonly dashboard: Dashboard
  readonly access: DashboardShareAccess
  readonly canEmbed: boolean
  /** Who reads, when the share is for members: « Vous lisez en tant que … ». */
  readonly reader: string | null
}

/**
 * Opens the door of a shared dashboard: the link, its state, the reader for a members'
 * share, and the publisher's authority — the whole door, checked in one place for the
 * page, for each card and for each list of values alike.
 */
export async function admitSharedDashboard(
  pools: Pools,
  request: {
    readonly token: string
    readonly reader: RequestContext | null
    readonly requestId: string
  },
): Promise<AdmittedDashboard> {
  return pools.withConnection('catalog', async (exec) => {
    const [row] = await exec.query<ShareRow>(`${SHARE_SELECT} WHERE s.token_hash = $1`, [
      hashOf(request.token),
    ])
    // An unknown link, a deleted dashboard or a deleted base: nothing is there.
    if (row === undefined || !row.dashboard_live || !row.base_live) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { share: 'inconnu' } })
    }
    // A closed share says so before it asks anyone to sign in: signing in would not open it.
    const state = stateOf(row, await publisherSees(exec, row, request.requestId))
    if (state !== 'open') {
      throw new BasedbError('VIEW_SHARE_CLOSED', { details: { reason: state } })
    }

    let reader: string | null = null
    if (row.access === 'members') {
      const person = request.reader
      if (person === null || person.actor.kind !== 'user') {
        throw new BasedbError('AUTHENTICATION_REQUIRED', { details: { dashboard: 'membres' } })
      }
      // A member of another tenant finds nothing here, as anywhere else.
      if (person.tenantId !== row.tenant_ref) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { share: 'inconnu' } })
      }
      const [found] = await exec.query<{ display_name: string | null; member: boolean }>(
        `SELECT u.display_name,
                (cardinality($2::text[]) = 0 OR EXISTS (
                   SELECT 1 FROM _basedb.role_member m
                    WHERE m.user_id = u.id AND m.role_id::text = ANY($2::text[]))) AS member
           FROM _basedb.app_user u WHERE u.id = $1`,
        [person.actor.id, row.group_ids],
      )
      if (found === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')
      if (!found.member) throw new BasedbError('VIEW_SHARE_RESTRICTED')
      reader = found.display_name
    }

    const dashboard = await readDashboard(exec, row.base_id, row.dashboard_id)
    if (dashboard === null) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { share: 'inconnu' } })
    }
    return {
      authority: authorityOf(row, request.requestId),
      baseId: row.base_id,
      dashboard,
      access: row.access,
      canEmbed: row.can_embed,
      reader,
    }
  })
}
