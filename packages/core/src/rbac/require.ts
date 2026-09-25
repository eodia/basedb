import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import { type Action, type ActorGrants, type Target, decide } from './decide.js'
import { loadGrants, loadTarget } from './loader.js'

/**
 * Demanding a right — the one shape of every check made by a structure or an
 * administration operation (chapter 05 §3.2, §8).
 *
 * A target the actor cannot see answers `RESOURCE_NOT_FOUND`, exactly like one that does
 * not exist; a target they can see but not act on answers `ADMIN_REQUIRED`. The
 * decision itself is the decider's, never recomputed here: a check written by hand next
 * to an operation is how two operations end up disagreeing about the same right.
 */

/** A base as a decision target — `null` when it is not a live base of the tenant. */
export async function loadBaseTarget(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<Target | null> {
  const rows = await exec.query<{ id: string; project_id: string; mcp_enabled: boolean }>(
    `SELECT b.id, b.project_id, b.mcp_enabled
       FROM _basedb.base b
       JOIN _basedb.tenant t ON t.id = b.tenant_id
      WHERE b.id::text = $1 AND t.ref = $2 AND b.is_live AND b.deleted_at IS NULL`,
    [baseId, ctx.tenantId],
  )
  const base = rows[0]
  if (base === undefined) return null
  return {
    kind: 'base',
    id: base.id,
    tenantId: ctx.tenantId,
    projectId: base.project_id,
    baseId: base.id,
    agentsExcluded: !base.mcp_enabled,
  }
}

/** A project as a decision target — `null` when it is not a live project of the tenant. */
export async function loadProjectTarget(
  exec: Executor,
  ctx: RequestContext,
  projectId: string,
): Promise<Target | null> {
  const rows = await exec.query<{ id: string }>(
    `SELECT p.id
       FROM _basedb.project p
       JOIN _basedb.tenant t ON t.id = p.tenant_id
      WHERE p.id::text = $1 AND t.ref = $2 AND p.deleted_at IS NULL`,
    [projectId, ctx.tenantId],
  )
  const project = rows[0]
  if (project === undefined) return null
  return { kind: 'project', id: project.id, tenantId: ctx.tenantId, projectId: project.id }
}

/** The tenant itself: where projects are created and people administered. */
export function tenantTarget(ctx: RequestContext): Target {
  return { kind: 'tenant', id: ctx.tenantId, tenantId: ctx.tenantId }
}

/**
 * Demands `action` on `target`, and returns the grants it was decided on.
 *
 * `target === null` — an object that does not exist — is refused exactly like an
 * invisible one.
 */
export async function requireAction(
  exec: Executor,
  ctx: RequestContext,
  action: Action,
  target: Target | null,
  details: Readonly<Record<string, unknown>> = {},
): Promise<ActorGrants> {
  const grants = await loadGrants(exec, ctx)
  if (target === null) throw new BasedbError('RESOURCE_NOT_FOUND', { details })
  const decision = decide(ctx, grants, action, target)
  if (decision.verdict === 'INVISIBLE') {
    // A base or a project is also visible through what is read inside it: to someone who
    // reads one of its tables, it exists, and a refusal says so rather than hiding it.
    if (await visibleInside(exec, ctx, grants, target)) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { ...details, action } })
    }
    throw new BasedbError('RESOURCE_NOT_FOUND', { details })
  }
  // Visible but not granted: the code every write of the kernel already answers for this
  // condition — one code per condition (A23).
  if (decision.verdict === 'FORBIDDEN') {
    throw new BasedbError('ADMIN_REQUIRED', { details: { ...details, action } })
  }
  return grants
}

/**
 * True when the actor reads at least one table of a base or of a project — the
 * visibility rule of the projection (08 §9.1), applied to a refusal.
 */
export async function visibleInside(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  target: Target,
): Promise<boolean> {
  if (target.kind !== 'base' && target.kind !== 'project') return false
  const tables = await exec.query<{ id: string }>(
    target.kind === 'base'
      ? 'SELECT id FROM _basedb.table_def WHERE base_id = $1 AND is_live AND deleted_at IS NULL'
      : `SELECT t.id FROM _basedb.table_def t
           JOIN _basedb.base b ON b.id = t.base_id
          WHERE b.project_id = $1 AND t.is_live AND t.deleted_at IS NULL AND b.is_live`,
    [target.id],
  )
  for (const table of tables) {
    const tableTarget = await loadTarget(exec, ctx, table.id)
    if (tableTarget !== null && decide(ctx, grants, 'read', tableTarget).verdict === 'ALLOWED') {
      return true
    }
  }
  return false
}

/** `requireAction` on a table, loaded by its catalog key. */
export async function requireOnTable(
  exec: Executor,
  ctx: RequestContext,
  action: Action,
  tableId: string,
): Promise<ActorGrants> {
  return requireAction(exec, ctx, action, await loadTarget(exec, ctx, tableId), {
    table: tableId,
  })
}

/** `requireAction` on a base, loaded by its catalog key. */
export async function requireOnBase(
  exec: Executor,
  ctx: RequestContext,
  action: Action,
  baseId: string,
): Promise<ActorGrants> {
  return requireAction(exec, ctx, action, await loadBaseTarget(exec, ctx, baseId), {
    base: baseId,
  })
}

/**
 * True when the actor administers the tenant: people, groups and permissions
 * (`manage_permissions` at tenant scope — the Administrators group, or an instance
 * administrator).
 */
export function administers(ctx: RequestContext, grants: ActorGrants): boolean {
  return decide(ctx, grants, 'manage_permissions', tenantTarget(ctx)).verdict === 'ALLOWED'
}

/**
 * Demands the administration of the tenant. Refused as an absence: the list of people
 * and groups is not something a non-administrator learns exists (05 §8).
 */
export async function requireAdministration(
  exec: Executor,
  ctx: RequestContext,
): Promise<ActorGrants> {
  const grants = await loadGrants(exec, ctx)
  if (ctx.actor.kind !== 'user' || !administers(ctx, grants)) {
    throw new BasedbError('RESOURCE_NOT_FOUND')
  }
  return grants
}

/** `requireAction` on the table a field belongs to. */
export async function requireOnField(
  exec: Executor,
  ctx: RequestContext,
  action: Action,
  fieldId: string,
): Promise<ActorGrants> {
  const rows = await exec.query<{ table_id: string }>(
    'SELECT table_id FROM _basedb.field WHERE id::text = $1 AND is_live',
    [fieldId],
  )
  const tableId = rows[0]?.table_id
  if (tableId === undefined) {
    await loadGrants(exec, ctx)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: fieldId } })
  }
  return requireAction(exec, ctx, action, await loadTarget(exec, ctx, tableId), {
    field: fieldId,
  })
}
