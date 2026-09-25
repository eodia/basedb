import type { RequestContext, Surface } from '../tx/context.js'

/**
 * Single enforcement point for permissions — chapter 05 §3.2 and §6.1.
 *
 * It does NOT return a boolean: a decision of the form "yes, but on these columns"
 * cannot be reconstructed elsewhere without duplicating the logic. It never reads the
 * database during a decision — it works on a snapshot prepared upstream.
 */

/** CLOSED list of the seven verbs of v1 (§1.3). No other exists. */
export const ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'manage_schema',
  'manage_permissions',
  'manage_tokens',
] as const

export type Action = (typeof ACTIONS)[number]

/** `instance ⊃ tenant ⊃ project ⊃ base ⊃ {application, table} ⊃ field` (§1.4, §15). */
export type ScopeKind = 'tenant' | 'project' | 'base' | 'application' | 'table'

export type Verdict = 'ALLOWED' | 'INVISIBLE' | 'FORBIDDEN'

/**
 * Marker for the tenant scope.
 *
 * A tenant-scoped permission names no object: it holds for the role's tenant, hence for
 * the context's, since the partitioning of step 2 has already ruled out any other
 * possibility.
 */
export const TENANT_SCOPE = '*'

/** An elementary catalog permission: one verb at one scope. */
export interface Permission {
  readonly action: Action
  readonly scopeKind: ScopeKind
  readonly scopeId: string
}

/** Field restriction: it grants nothing, it only subtracts (§4). */
export interface FieldRestriction {
  readonly fieldId: string
  readonly mode: 'hidden' | 'read_only'
}

/** A role as the decider consumes it, already resolved from the catalog. */
export interface Role {
  readonly id: string
  readonly permissions: readonly Permission[]
  readonly fieldRestrictions: readonly FieldRestriction[]
}

/** The target of a decision, designated by its CATALOG KEY, never by its name. */
export interface Target {
  readonly kind: 'table' | 'base' | 'project' | 'tenant'
  readonly id: string
  readonly tenantId: string | null
  /** The project a base or a table belongs to: a grant on it covers them (§15). */
  readonly projectId?: string
  readonly baseId?: string
  /** Applications the table belongs to, evaluated AT DECISION TIME (§1.4). */
  readonly applicationIds?: readonly string[]
  /** Fields of the table, in catalog order. */
  readonly fieldIds?: readonly string[]
  /**
   * Fields marked `field.expose_to_agents = false` (chapter 09 §12.2). On the `mcp`
   * surface they are treated EXACTLY as unreadable fields, whatever the rights: the
   * content leaves for a third-party model, and a user's right to read a column does not
   * settle whether an agent should.
   */
  readonly agentHiddenFieldIds?: readonly string[]
  /** `base.mcp_enabled = false`: on the `mcp` surface the target does not exist. */
  readonly agentsExcluded?: boolean
}

/** Snapshot of an actor's grants, computed once by the kernel. */
export interface ActorGrants {
  readonly isInstanceAdmin: boolean
  readonly roles: readonly Role[]
  /** For a token: the base it is bound to, or `null` if it spans the whole tenant. */
  readonly tokenBaseId?: string | null
  /** Surfaces on which the token is acceptable. */
  readonly tokenAllowedSurfaces?: readonly Surface[]
  /**
   * For a token: its one role (`api_token.role_id`). The token's capabilities are the
   * INTERSECTION of this role and of its creator's grants — `roles` above — recomputed at
   * every decision (05 §2.3). Without it a token would be a frozen escalation: a creator
   * demoted since would go on acting through it.
   */
  readonly tokenRole?: Role
}

export interface Decision {
  readonly verdict: Verdict
  readonly readableFields: ReadonlySet<string>
  readonly writableFields: ReadonlySet<string>
  /** Included in `readableFields` minus `writableFields`. */
  readonly clearableFields: ReadonlySet<string>
  /** Constantly true in v1 (A20), but ALWAYS emitted by the query builder. */
  readonly rowPredicate: 'TRUE'
  /** Stable code, meant for the log, NEVER for the client. */
  readonly reason: string
}

/** The five system columns, always readable as soon as `read` is granted (A18). */
export const SYSTEM_COLUMNS: readonly string[] = [
  '_id',
  '_created_at',
  '_updated_at',
  '_created_by',
  '_updated_by',
]

const EMPTY: ReadonlySet<string> = new Set()

function deny(verdict: Verdict, reason: string): Decision {
  return {
    verdict,
    readableFields: EMPTY,
    writableFields: EMPTY,
    clearableFields: EMPTY,
    rowPredicate: 'TRUE',
    reason,
  }
}

/**
 * The surface RESTRICTS, it never grants (§1.2).
 *
 * A token presented on a surface absent from its allowed surfaces is not "less
 * authorized": it is invalid.
 */
function surfaceAcceptable(grants: ActorGrants, surface: Surface): boolean {
  if (grants.tokenAllowedSurfaces === undefined) return true
  return grants.tokenAllowedSurfaces.includes(surface)
}

/** True if a permission's scope covers the target (§1.4, downward inheritance). */
function scopeCovers(permission: Permission, target: Target): boolean {
  switch (permission.scopeKind) {
    case 'tenant':
      return (
        target.tenantId !== null &&
        (permission.scopeId === TENANT_SCOPE || permission.scopeId === target.tenantId)
      )
    case 'project':
      return permission.scopeId === (target.kind === 'project' ? target.id : target.projectId)
    case 'base':
      return permission.scopeId === (target.kind === 'base' ? target.id : target.baseId)
    case 'table':
      return target.kind === 'table' && permission.scopeId === target.id
    case 'application':
      // A table belonging to several applications is covered by an authorization on
      // EACH of them, and membership is evaluated here, never frozen: adding a table to
      // an application grants access immediately.
      return (target.applicationIds ?? []).includes(permission.scopeId)
  }
}

/**
 * Decides on an access — the nine steps of §3.2, in this exact order.
 *
 * Two invariants rest on this numbering:
 *
 *   — `FORBIDDEN` is NEVER returned for a target the actor cannot read, which makes
 *     "absence rather than error" verifiable at a glance;
 *   — no path crosses a tenant boundary within a single decision, instance
 *     administrators included.
 */
export function decide(
  ctx: RequestContext,
  grants: ActorGrants,
  action: Action,
  target: Target,
): Decision {
  // 1. No actor context → 401. Missing authentication is never disguised as a missing
  //    resource: a client must be able to reconnect.
  if (ctx.actor.id === '') return deny('FORBIDDEN', 'AUTHENTICATION_REQUIRED')

  // 2. Partitioning, WITHOUT EXCEPTION, instance administrators included. Instance
  //    objects (`tenantId === null`) are handled by step 3.
  if (target.tenantId !== null && target.tenantId !== ctx.tenantId) {
    return deny('INVISIBLE', 'TENANT_MISMATCH')
  }

  if (grants.tokenAllowedSurfaces !== undefined && !surfaceAcceptable(grants, ctx.surface)) {
    return deny('FORBIDDEN', 'TOKEN_INVALID')
  }

  // 4. Token scope: bound to one base, it sees nothing beyond it. Checked BEFORE the
  //    instance administrator's full mask: a token keeps its scope whoever created it.
  if (
    grants.tokenBaseId !== undefined &&
    grants.tokenBaseId !== null &&
    grants.tokenBaseId !== (target.kind === 'base' ? target.id : target.baseId)
  ) {
    return deny('INVISIBLE', 'TOKEN_SCOPE')
  }

  // The agent surface's two markers (09 §12.2), independent of the permissions: a base
  // closed to agents does not exist there, and a field withheld from them is exactly an
  // unreadable field — absent from the mask, hence from every projection, filter, sort,
  // expansion and display value built on it.
  if (ctx.surface === 'mcp' && target.agentsExcluded === true) {
    return deny('INVISIBLE', 'MCP_DISABLED')
  }
  const declared = target.fieldIds ?? []
  const withheld = new Set<string>(ctx.surface === 'mcp' ? (target.agentHiddenFieldIds ?? []) : [])
  const allFields = declared.filter((f) => !withheld.has(f))

  // 3, 5, 6 and 7. The actor's own reach on the target.
  const own = reach(grants.isInstanceAdmin, grants.roles, target, allFields)

  // 9. Verdict. `read` first: without it, the target does not exist for this actor.
  if (own === null) return deny('INVISIBLE', 'NO_READ')

  let { capabilities, readable, writable } = own
  let reason = grants.isInstanceAdmin ? 'INSTANCE_ADMIN' : 'GRANTED'

  // A token: its role, intersected with its creator's reach, at every decision.
  if (grants.tokenRole !== undefined) {
    const bound = reach(false, [grants.tokenRole], target, allFields)
    if (bound === null) return deny('INVISIBLE', 'NO_READ')
    capabilities = new Set([...capabilities].filter((a) => bound.capabilities.has(a)))
    readable = new Set([...readable].filter((f) => bound.readable.has(f)))
    writable = new Set([...writable].filter((f) => bound.writable.has(f)))
    reason = 'TOKEN_BOUND'
  }

  // Table visible, no readable field: the only coherent outcome is `INVISIBLE`.
  // Otherwise the SQL builder would have to emit an empty column list — invalid SQL —
  // or fall back on `*`, that is, violate the invariant of §6.2; and a list of n empty
  // objects would disclose the cardinality of a table we meant to hide.
  const businessFields = [...readable].filter((f) => !SYSTEM_COLUMNS.includes(f))
  if (declared.length > 0 && businessFields.length === 0) return deny('INVISIBLE', 'EMPTY_MASK')

  if (!capabilities.has(action)) {
    // Which side refused matters to the agent surface: a read-only TOKEN is fixed by
    // issuing another token, a user without the right by asking for it (09 §14.5).
    const tokenRefused =
      grants.tokenRole !== undefined && !reachCapabilities(grants.tokenRole, target).has(action)
    return deny('FORBIDDEN', tokenRefused ? 'TOKEN_ACTION_NOT_GRANTED' : 'ACTION_NOT_GRANTED')
  }

  // Clearable: readable, not writable. Without this set, the REST adapter would have to
  // re-test "is this a link with an unreadable target?" itself, that is, carry an
  // authorization rule outside the enforcement point.
  const clearable = new Set([...readable].filter((f) => !writable.has(f)))

  return {
    verdict: 'ALLOWED',
    readableFields: readable,
    writableFields: writable,
    clearableFields: clearable,
    rowPredicate: 'TRUE',
    reason,
  }
}

/** What some roles can do, and see, on one target — `null` when they cannot read it. */
interface Reach {
  readonly capabilities: ReadonlySet<Action>
  readonly readable: ReadonlySet<string>
  readonly writable: ReadonlySet<string>
}

/** The verbs one role holds on the target, scopes resolved. */
function reachCapabilities(role: Role, target: Target): ReadonlySet<Action> {
  const capabilities = new Set<Action>()
  for (const permission of role.permissions) {
    if (scopeCovers(permission, target)) capabilities.add(permission.action)
  }
  return capabilities
}

function reach(
  isInstanceAdmin: boolean,
  roles: readonly Role[],
  target: Target,
  allFields: readonly string[],
): Reach | null {
  // 3. Instance administrator: full mask, INSIDE the context's tenant.
  if (isInstanceAdmin) return { capabilities: new Set(ACTIONS), ...mask(allFields, []) }

  // 5, 6 and 7. Collect the roles, union their capabilities on the target.
  //
  // Only roles that grant `read` ON THIS TARGET take part in the mask: a role with no
  // right here can neither open nor restrict a field.
  const capabilities = new Set<Action>()
  const readingRoles: Role[] = []

  for (const role of roles) {
    const held = reachCapabilities(role, target)
    for (const action of held) capabilities.add(action)
    if (held.has('read')) readingRoles.push(role)
  }

  if (!capabilities.has('read')) return null

  // 8. Field mask.
  return { capabilities, ...mask(allFields, readingRoles, capabilities) }
}

/**
 * Computes the field mask.
 *
 * The UNION wins: a role without a restriction cancels another's restriction. Role
 * accumulation is additive, with no `deny` rule — this is the trap §3.3 names, and it
 * is a decision, not an oversight.
 */
function mask(
  allFields: readonly string[],
  readingRoles: readonly Role[],
  capabilities: ReadonlySet<Action> = new Set(ACTIONS),
): { readonly readable: ReadonlySet<string>; readonly writable: ReadonlySet<string> } {
  const hidden = new Set<string>()
  const readOnly = new Set<string>()

  // A field is subtracted only if EVERY role granting access subtracts it: the
  // intersection, not the union. This is the trap §3.3 names — Bob, with `rh` having no
  // field rule and `support` hiding `salaire`, SEES `salaire`. Taking the union here
  // would silently turn each role into a veto over all the others, the opposite of an
  // additive model.
  if (readingRoles.length > 0) {
    for (const field of allFields) {
      const modes = readingRoles.map(
        (r) => r.fieldRestrictions.find((f) => f.fieldId === field)?.mode,
      )
      if (modes.every((m) => m === 'hidden')) hidden.add(field)
      else if (modes.every((m) => m === 'hidden' || m === 'read_only')) readOnly.add(field)
    }
  }

  const readable = new Set(allFields.filter((f) => !hidden.has(f)))
  // System columns are ALWAYS readable as soon as `read` is granted, are never
  // writable, and cannot carry a field restriction (A18).
  for (const systemColumn of SYSTEM_COLUMNS) readable.add(systemColumn)

  const canWrite = capabilities.has('create') || capabilities.has('update')
  const writable = new Set(
    canWrite ? allFields.filter((f) => !hidden.has(f) && !readOnly.has(f)) : [],
  )

  return { readable, writable }
}
