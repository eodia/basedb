import type { FieldKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import {
  type Action,
  type ActorGrants,
  type Permission,
  type Role,
  type ScopeKind,
  TENANT_SCOPE,
  type Target,
} from './decide.js'

/**
 * Loading grants from the catalog — chapter 05 §3.2, steps 5 and 6.
 *
 * The decider NEVER READS the database during a decision: the snapshot is prepared
 * here, once, upstream. The separation is not cosmetic — it makes the decider testable
 * without a database, and bounds the cost of a decision (§3.5).
 */

interface PermissionRow extends Record<string, unknown> {
  readonly role_id: string
  readonly action: Action | null
  readonly scope_kind: ScopeKind | null
  readonly scope_base_id: string | null
  readonly scope_application_id: string | null
  readonly scope_table_id: string | null
}

interface FieldPermissionRow extends Record<string, unknown> {
  readonly role_id: string
  readonly field_id: string
  readonly access: 'hidden' | 'read_only'
}

/**
 * Loads an actor's effective grants.
 *
 * Permissions and field restrictions come in two queries rather than one join: a join
 * would produce the cartesian product of permissions by restrictions, which the code
 * would then have to deduplicate — more rows on the wire, for an identical result.
 */
export async function loadGrants(exec: Executor, ctx: RequestContext): Promise<ActorGrants> {
  const users = await exec.query<{ is_instance_admin: boolean; tenant_ref: string }>(
    `SELECT u.is_instance_admin, t.ref AS tenant_ref
       FROM _basedb.app_user u
       JOIN _basedb.tenant t ON t.id = u.tenant_id
      WHERE u.id = $1 AND u.disabled_at IS NULL AND u.deleted_at IS NULL`,
    [ctx.actor.id],
  )

  const user = users[0]
  if (user === undefined) {
    // An unknown or disabled actor does not get an empty snapshot: it gets a refusal.
    // Empty grants would be indistinguishable from "no role", which is a legitimate
    // state and must not be treated as invalid authentication.
    throw new BasedbError('AUTHENTICATION_REQUIRED', { details: { actor: ctx.actor.id } })
  }

  // Partitioning is checked here TOO, before the decider even runs: a context whose
  // tenant does not match the user's is an anomaly, not a decision to render.
  if (user.tenant_ref !== ctx.tenantId) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tenant: ctx.tenantId } })
  }

  const rows = await exec.query<PermissionRow>(
    `SELECT p.role_id, p.action, p.scope_kind,
            p.scope_base_id, p.scope_application_id, p.scope_table_id
       FROM _basedb.role_member m
       JOIN _basedb.role r ON r.id = m.role_id AND r.deleted_at IS NULL
       LEFT JOIN _basedb.permission p ON p.role_id = r.id
      WHERE m.user_id = $1`,
    [ctx.actor.id],
  )

  const fieldRows = await exec.query<FieldPermissionRow>(
    `SELECT fp.role_id, fp.field_id, fp.access
       FROM _basedb.role_member m
       JOIN _basedb.field_permission fp ON fp.role_id = m.role_id
      WHERE m.user_id = $1`,
    [ctx.actor.id],
  )

  const byRole = new Map<
    string,
    { permissions: Permission[]; restrictions: FieldPermissionRow[] }
  >()

  for (const row of rows) {
    const entry = byRole.get(row.role_id) ?? { permissions: [], restrictions: [] }
    if (row.action !== null && row.scope_kind !== null) {
      const scopeId = scopeIdOf(row)
      if (scopeId !== null)
        entry.permissions.push({ action: row.action, scopeKind: row.scope_kind, scopeId })
    }
    byRole.set(row.role_id, entry)
  }

  for (const row of fieldRows) {
    const entry = byRole.get(row.role_id) ?? { permissions: [], restrictions: [] }
    entry.restrictions.push(row)
    byRole.set(row.role_id, entry)
  }

  const roles: Role[] = [...byRole].map(([id, e]) => ({
    id,
    permissions: e.permissions,
    fieldRestrictions: e.restrictions.map((r) => ({ fieldId: r.field_id, mode: r.access })),
  }))

  return { isInstanceAdmin: user.is_instance_admin, roles }
}

/**
 * A permission's scope is materialized by THREE distinct columns, not by a polymorphic
 * one: that is what lets each carry a real foreign key to the object it designates.
 */
function scopeIdOf(row: PermissionRow): string | null {
  switch (row.scope_kind) {
    case 'tenant':
      // The tenant scope names no object: it holds for the role's tenant.
      return TENANT_SCOPE
    case 'base':
      return row.scope_base_id
    case 'application':
      return row.scope_application_id
    case 'table':
      return row.scope_table_id
    default:
      return null
  }
}

/** Prepares a decision target from the catalog: fields, base, applications. */
export async function loadTarget(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<Target | null> {
  const tables = await exec.query<{
    id: string
    base_id: string
    tenant_ref: string
    table_name: string
    schema_name: string
  }>(
    `SELECT t.id, t.base_id, ten.ref AS tenant_ref,
            tn.name AS table_name, sn.name AS schema_name
       FROM _basedb.table_def t
       JOIN _basedb.base b        ON b.id = t.base_id
       JOIN _basedb.tenant ten    ON ten.id = b.tenant_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s   ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1 AND t.is_live`,
    [tableId],
  )

  const table = tables[0]
  // An unknown name produces EXACTLY the same response as an invisible target (§7.2):
  // hence returning `null` rather than throwing here.
  if (table === undefined) return null

  const fields = await exec.query<{ id: string; name: string }>(
    `SELECT f.id, n.name
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position`,
    [tableId],
  )

  const applications = await exec.query<{ application_id: string }>(
    'SELECT application_id FROM _basedb.application_table WHERE table_id = $1',
    [tableId],
  )

  void ctx

  return {
    kind: 'table',
    id: table.id,
    tenantId: table.tenant_ref,
    baseId: table.base_id,
    applicationIds: applications.map((a) => a.application_id),
    fieldIds: fields.map((f) => f.id),
  }
}

/** Catalog key → physical name mapping, required by the SQL builder. */
export async function loadFieldNames(
  exec: Executor,
  tableId: string,
): Promise<Map<string, string>> {
  const fields = await exec.query<{ id: string; name: string }>(
    `SELECT f.id, n.name
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position`,
    [tableId],
  )
  return new Map(fields.map((f) => [f.id, f.name]))
}

/**
 * A table's fields with their type — required by filtering and sorting.
 *
 * The type comes from the catalog and nowhere else: it is what decides which operators
 * are allowed and which SQL cast is emitted. Inferring it from the received value would
 * let `montant eq "1"` compare text against a `numeric`.
 */
export async function loadFields(
  exec: Executor,
  tableId: string,
): Promise<Map<string, { readonly name: string; readonly kind: FieldKind }>> {
  const fields = await exec.query<{ id: string; name: string; kind: FieldKind }>(
    `SELECT f.id, n.name, f.kind
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position`,
    [tableId],
  )
  return new Map(fields.map((f) => [f.id, { name: f.name, kind: f.kind }]))
}
