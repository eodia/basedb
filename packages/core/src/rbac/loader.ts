import { COMPUTED_KINDS, type FieldKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext, Surface } from '../tx/context.js'
import {
  type Action,
  type ActorGrants,
  type FieldRestriction,
  type Permission,
  type Role,
  type ScopeKind,
  TENANT_SCOPE,
  type Target,
} from './decide.js'
import { compileRowRules } from './rows.js'

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
  readonly scope_project_id: string | null
  readonly scope_base_id: string | null
  readonly scope_application_id: string | null
  readonly scope_table_id: string | null
}

interface FieldPermissionRow extends Record<string, unknown> {
  readonly role_id: string
  readonly field_id: string
  /** The catalog's vocabulary (`_basedb.field_permission`), not the decider's. */
  readonly access: 'hidden' | 'read' | 'write'
}

/**
 * The catalog says `read` where the decider says `read_only`, and `write` — no
 * restriction at all — has no decider counterpart: a restriction only ever subtracts.
 */
function restrictionOf(row: FieldPermissionRow): FieldRestriction | null {
  if (row.access === 'hidden') return { fieldId: row.field_id, mode: 'hidden' }
  if (row.access === 'read') return { fieldId: row.field_id, mode: 'read_only' }
  return null
}

/**
 * Loads an actor's effective grants.
 *
 * Permissions and field restrictions come in two queries rather than one join: a join
 * would produce the cartesian product of permissions by restrictions, which the code
 * would then have to deduplicate — more rows on the wire, for an identical result.
 */
export async function loadGrants(exec: Executor, ctx: RequestContext): Promise<ActorGrants> {
  // A system context — an internal process, never an adapter, since only the kernel seals
  // one — has no verb removed inside its tenant (§6.4). Partitioning still holds: the
  // decider compares every target's tenant with the context's before anything else.
  if (ctx.actor.kind === 'system') return { isInstanceAdmin: true, roles: [] }
  // An answer to a public form holds no right: the share decided on its publisher's.
  if (ctx.actor.kind === 'form') return { isInstanceAdmin: false, roles: [] }

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
            p.scope_project_id, p.scope_base_id, p.scope_application_id, p.scope_table_id
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

  const roles = rolesOf(rows, fieldRows)
  const grants: ActorGrants = { isInstanceAdmin: user.is_instance_admin, roles }

  // A user acts with their roles; a token with its creator's roles AND its own, the two
  // intersected by the decider at every decision (05 §2.3).
  if (ctx.actor.kind !== 'token' || ctx.actor.tokenId === undefined) return grants
  return { ...grants, ...(await loadTokenBounds(exec, ctx.actor.id, ctx.actor.tokenId)) }
}

/**
 * The bounds a token adds to its creator's grants: its one role, its base, its surfaces.
 *
 * Read at every snapshot, never carried by the context: the context says WHO acts, the
 * catalog says what that token may still do. A token revoked, expired or suspended since
 * the context was opened is refused here — the revocation writes `api_token`, which moves
 * `authz_version` and so empties every cached snapshot.
 */
async function loadTokenBounds(
  exec: Executor,
  userId: string,
  tokenId: string,
): Promise<
  Pick<ActorGrants, 'tokenRole' | 'tokenBaseId' | 'tokenBaseIds' | 'tokenAllowedSurfaces'>
> {
  const tokens = await exec.query<{
    role_id: string
    base_id: string | null
    allowed_surfaces: Surface[]
    environments: string[] | null
  }>(
    // A token of the whole base opens every live base of its base's lineage — read here,
    // at each snapshot, so that an environment added tomorrow is opened tomorrow.
    `SELECT tk.role_id, tk.base_id, tk.allowed_surfaces,
            CASE WHEN tk.all_environments THEN
              (SELECT array_agg(e.id::text) FROM _basedb.base own
                 JOIN _basedb.base e ON e.lineage_id = own.lineage_id
                                    AND e.tenant_id = own.tenant_id
                                    AND e.is_live AND e.deleted_at IS NULL
                WHERE own.id = tk.base_id)
            END AS environments
       FROM _basedb.api_token tk
       JOIN _basedb.role r ON r.id = tk.role_id AND r.deleted_at IS NULL
      WHERE tk.id = $1 AND tk.created_by = $2
        AND tk.revoked_at IS NULL AND tk.suspended_at IS NULL
        AND (tk.expires_at IS NULL OR tk.expires_at > clock_timestamp())`,
    [tokenId, userId],
  )
  const token = tokens[0]
  if (token === undefined) throw new BasedbError('TOKEN_INVALID')

  const rows = await exec.query<PermissionRow>(
    `SELECT p.role_id, p.action, p.scope_kind,
            p.scope_project_id, p.scope_base_id, p.scope_application_id, p.scope_table_id
       FROM _basedb.permission p
      WHERE p.role_id = $1`,
    [token.role_id],
  )
  const fieldRows = await exec.query<FieldPermissionRow>(
    'SELECT fp.role_id, fp.field_id, fp.access FROM _basedb.field_permission fp WHERE fp.role_id = $1',
    [token.role_id],
  )

  return {
    tokenRole: rolesOf(rows, fieldRows)[0] ?? {
      id: token.role_id,
      permissions: [],
      fieldRestrictions: [],
    },
    tokenBaseId: token.base_id,
    ...(token.environments === null ? {} : { tokenBaseIds: token.environments }),
    tokenAllowedSurfaces: token.allowed_surfaces,
  }
}

/** Groups permission and restriction rows by role. */
function rolesOf(rows: readonly PermissionRow[], fieldRows: readonly FieldPermissionRow[]): Role[] {
  const byRole = new Map<string, { permissions: Permission[]; restrictions: FieldRestriction[] }>()

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
    const restriction = restrictionOf(row)
    if (restriction !== null) entry.restrictions.push(restriction)
    byRole.set(row.role_id, entry)
  }

  return [...byRole].map(([id, e]) => ({
    id,
    permissions: e.permissions,
    fieldRestrictions: e.restrictions,
  }))
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
    case 'project':
      return row.scope_project_id
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
    mcp_enabled: boolean
    project_id: string
  }>(
    `SELECT t.id, t.base_id, ten.ref AS tenant_ref,
            tn.name AS table_name, sn.name AS schema_name, b.mcp_enabled, b.project_id
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

  const fields = await exec.query<{
    id: string
    name: string
    kind: string
    expose_to_agents: boolean
    has_ai: boolean
  }>(
    `SELECT f.id, n.name, f.kind, f.expose_to_agents,
            EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai
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

  // The row rules of the table, compiled against its fields as they are now (05 §16).
  const ruleRows = await exec.query<{ role_id: string; filter: string }>(
    'SELECT role_id::text, filter FROM _basedb.row_permission WHERE table_id = $1',
    [tableId],
  )
  const rowRules = compileRowRules(
    ruleRows.map((r) => ({ roleId: r.role_id, filter: r.filter })),
    fields,
  )

  return {
    kind: 'table',
    id: table.id,
    tenantId: table.tenant_ref,
    projectId: table.project_id,
    baseId: table.base_id,
    applicationIds: applications.map((a) => a.application_id),
    fieldIds: fields.map((f) => f.id),
    agentHiddenFieldIds: fields.filter((f) => !f.expose_to_agents).map((f) => f.id),
    agentsExcluded: !table.mcp_enabled,
    // A formula by its kind; a field computed by the AI by its option.
    computedFieldIds: fields.filter((f) => COMPUTED_KINDS.has(f.kind) || f.has_ai).map((f) => f.id),
    rowRules,
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
): Promise<
  Map<
    string,
    {
      readonly name: string
      readonly kind: FieldKind
      readonly stored: boolean
      /** A long text holding HTML, sanitized on every write (chapter 04 §2.2). */
      readonly rich: boolean
    }
  >
> {
  // `stored` is false for a field with no column: a lookup, a rollup, a count, and a
  // formula computed at read time (chapter 04 §7.1, §7 ter). Whoever builds SQL over
  // columns reads it before naming one.
  const fields = await exec.query<{
    id: string
    name: string
    kind: FieldKind
    stored: boolean
    rich: boolean
  }>(
    `SELECT f.id, n.name, f.kind,
            CASE WHEN f.kind IN ('lookup', 'rollup', 'count', 'button') THEN false
                 WHEN f.kind = 'formula' THEN coalesce(fc.is_stored, true)
                 ELSE true END AS stored,
            coalesce(tc.is_rich, false) AS rich
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
       LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
       LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position`,
    [tableId],
  )
  return new Map(
    fields.map((f) => [f.id, { name: f.name, kind: f.kind, stored: f.stored, rich: f.rich }]),
  )
}
