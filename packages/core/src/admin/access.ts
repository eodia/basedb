import { writeAudit } from '../audit/journal.js'
import { requireElevatedSession } from '../auth/elevation.js'
import { BasedbError } from '../errors/index.js'
import type { Action } from '../rbac/decide.js'
import { requireAdministration } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { ADMINS, type GroupSummary, ensureSystemGroups, loadGroup, loadGroups } from './groups.js'

/**
 * Access levels, group by group, over projects, bases and tables — chapter 05 §15.
 *
 * Modelled on Metabase's data permissions. A level is granted to a GROUP on a project,
 * a base or a table, and flows down: « Lecture » on a project reads every table of every
 * base in it, those created tomorrow included. Levels are closed and ordered, each a
 * bundle of the seven verbs of §1.3 — nothing is added to the catalog, which still holds
 * plain `permission` rows:
 *
 *   Aucun accès  —
 *   Lecture      read
 *   Édition      read, create, update, delete
 *   Gestion      read, create, update, delete, manage_schema, manage_tokens
 *
 * Giving a table LESS than its base grants is Metabase's « granulaire »: the grant of the
 * base is pushed down onto each of its tables, and the chosen one is lowered. The base
 * then shows « Granulaire », and a table created in it later inherits nothing from it —
 * which is the honest reading of "each table was set on its own".
 *
 * Rights stay additive across groups (§3.3): a person gets the highest level any of
 * their groups grants. To take a right away from everyone, take it from « Tous les
 * utilisateurs » first.
 */

export type AccessLevel = 'none' | 'read' | 'edit' | 'manage'

export const ACCESS_LEVELS: readonly AccessLevel[] = ['none', 'read', 'edit', 'manage']

const RANK: Readonly<Record<AccessLevel, number>> = { none: 0, read: 1, edit: 2, manage: 3 }

export const LEVEL_ACTIONS: Readonly<Record<AccessLevel, readonly Action[]>> = {
  none: [],
  read: ['read'],
  edit: ['read', 'create', 'update', 'delete'],
  manage: ['read', 'create', 'update', 'delete', 'manage_schema', 'manage_tokens'],
}

/** The highest level whose verbs a set of verbs covers entirely. */
export function levelOf(actions: ReadonlySet<Action>): AccessLevel {
  let found: AccessLevel = 'none'
  for (const level of ACCESS_LEVELS) {
    if (LEVEL_ACTIONS[level].every((a) => actions.has(a))) found = level
  }
  return found
}

const max = (a: AccessLevel, b: AccessLevel): AccessLevel => (RANK[a] >= RANK[b] ? a : b)

export type ScopeKind = 'project' | 'base' | 'table'

export interface AccessTable {
  readonly id: string
  readonly name: string
  readonly label: string
}

export interface AccessBase {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly tables: readonly AccessTable[]
}

export interface AccessProject {
  readonly id: string
  readonly label: string
  readonly bases: readonly AccessBase[]
}

/** What a group has on one node, as the screen shows it. */
export interface AccessCell {
  /** `granular` when the node's children do not all have what the node itself has. */
  readonly level: AccessLevel | 'granular'
  /** True when the level is granted ON this node, not inherited from above. */
  readonly direct: boolean
}

export interface AccessGraph {
  readonly groups: readonly GroupSummary[]
  readonly projects: readonly AccessProject[]
  /** Group → `project:<id>` / `base:<id>` / `table:<id>` → cell. */
  readonly cells: Readonly<Record<string, Readonly<Record<string, AccessCell>>>>
}

export interface AccessChange {
  readonly groupId: string
  readonly scope: { readonly kind: ScopeKind; readonly id: string }
  readonly level: AccessLevel
}

const key = (kind: ScopeKind, id: string) => `${kind}:${id}`

/** Every live project, base and table of the tenant — the administrator sees them all. */
async function loadTree(exec: Executor, ctx: RequestContext): Promise<AccessProject[]> {
  const projects = await exec.query<{ id: string; label: string }>(
    `SELECT p.id, p.label FROM _basedb.project p
       JOIN _basedb.tenant t ON t.id = p.tenant_id
      WHERE t.ref = $1 AND p.deleted_at IS NULL
      ORDER BY p.position, p.label`,
    [ctx.tenantId],
  )
  const bases = await exec.query<{ id: string; project_id: string; label: string; name: string }>(
    `SELECT b.id, b.project_id, b.label, sn.name
       FROM _basedb.base b
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                    AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.ref = $1 AND b.is_live AND b.deleted_at IS NULL
      ORDER BY b.label`,
    [ctx.tenantId],
  )
  const tables = await exec.query<{ id: string; base_id: string; label: string; name: string }>(
    `SELECT td.id, td.base_id, td.label, tn.name
       FROM _basedb.table_def td
       JOIN _basedb.base b           ON b.id = td.base_id
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.physical_name tn ON tn.id = td.name_id
      WHERE t.ref = $1 AND td.is_live AND td.deleted_at IS NULL AND b.is_live
      ORDER BY td.position, td.label`,
    [ctx.tenantId],
  )
  return projects.map((p) => ({
    id: p.id,
    label: p.label,
    bases: bases
      .filter((b) => b.project_id === p.id)
      .map((b) => ({
        id: b.id,
        name: b.name,
        label: b.label,
        tables: tables
          .filter((t) => t.base_id === b.id)
          .map((t) => ({ id: t.id, name: t.name, label: t.label })),
      })),
  }))
}

/** Direct grants of the groups, as levels: group → node → level. */
async function loadGrants(
  exec: Executor,
  ctx: RequestContext,
): Promise<Map<string, Map<string, AccessLevel>>> {
  const rows = await exec.query<{ role_id: string; scope: string; action: Action }>(
    `SELECT p.role_id, p.scope_kind || ':' ||
              coalesce(p.scope_project_id, p.scope_base_id, p.scope_table_id)::text AS scope,
            p.action
       FROM _basedb.permission p
       JOIN _basedb.role r   ON r.id = p.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
       JOIN _basedb.tenant t ON t.id = r.tenant_id
      WHERE t.ref = $1 AND p.scope_kind IN ('project', 'base', 'table')`,
    [ctx.tenantId],
  )
  const actions = new Map<string, Map<string, Set<Action>>>()
  for (const row of rows) {
    const byScope = actions.get(row.role_id) ?? new Map<string, Set<Action>>()
    const set = byScope.get(row.scope) ?? new Set<Action>()
    set.add(row.action)
    byScope.set(row.scope, set)
    actions.set(row.role_id, byScope)
  }
  const out = new Map<string, Map<string, AccessLevel>>()
  for (const [role, byScope] of actions) {
    const levels = new Map<string, AccessLevel>()
    for (const [scope, set] of byScope) {
      const level = levelOf(set)
      if (level !== 'none') levels.set(scope, level)
    }
    out.set(role, levels)
  }
  return out
}

/** The cells of one group over the whole tree. */
function cellsOf(
  tree: readonly AccessProject[],
  direct: ReadonlyMap<string, AccessLevel>,
): Record<string, AccessCell> {
  const cells: Record<string, AccessCell> = {}
  // A node shows its own level when every child shows exactly that level too; otherwise
  // it is « granulaire ». A node with no child shows what it has.
  const settle = (nodeKey: string, effective: AccessLevel, children: readonly string[]) => {
    const uniform = children.every((c) => cells[c]?.level === effective)
    cells[nodeKey] = { level: uniform ? effective : 'granular', direct: direct.has(nodeKey) }
  }
  for (const project of tree) {
    const pKey = key('project', project.id)
    const pLevel = direct.get(pKey) ?? 'none'
    for (const base of project.bases) {
      const bKey = key('base', base.id)
      const bLevel = max(pLevel, direct.get(bKey) ?? 'none')
      for (const table of base.tables) {
        const tKey = key('table', table.id)
        cells[tKey] = { level: max(bLevel, direct.get(tKey) ?? 'none'), direct: direct.has(tKey) }
      }
      settle(
        bKey,
        bLevel,
        base.tables.map((t) => key('table', t.id)),
      )
    }
    settle(
      pKey,
      pLevel,
      project.bases.map((b) => key('base', b.id)),
    )
  }
  return cells
}

async function buildGraph(exec: Executor, ctx: RequestContext): Promise<AccessGraph> {
  const groups = await loadGroups(exec, ctx)
  const tree = await loadTree(exec, ctx)
  const grants = await loadGrants(exec, ctx)
  const cells: Record<string, Record<string, AccessCell>> = {}
  for (const group of groups) {
    if (group.system === 'admins') {
      // Every verb on the tenant: « Gestion » everywhere, set nowhere in particular.
      const all = new Map<string, AccessLevel>()
      for (const p of tree) all.set(key('project', p.id), 'manage')
      cells[group.id] = cellsOf(tree, all)
      continue
    }
    cells[group.id] = cellsOf(tree, grants.get(group.id) ?? new Map())
  }
  return { groups, projects: tree, cells }
}

/** The whole grid: groups, projects, bases, tables, and what each group has on each. */
export async function accessGraph(pools: Pools, ctx: RequestContext): Promise<AccessGraph> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
    return buildGraph(exec, ctx)
  })
}

/**
 * Where a node sits: its project, and the keys from the project down to it.
 * `null` when the node is not a live object of the tenant.
 */
function locate(
  tree: readonly AccessProject[],
  scope: AccessChange['scope'],
): { project: AccessProject; path: string[] } | null {
  for (const project of tree) {
    const pKey = key('project', project.id)
    if (scope.kind === 'project' && project.id === scope.id) return { project, path: [pKey] }
    for (const base of project.bases) {
      const bKey = key('base', base.id)
      if (scope.kind === 'base' && base.id === scope.id) return { project, path: [pKey, bKey] }
      for (const table of base.tables) {
        if (scope.kind === 'table' && table.id === scope.id) {
          return { project, path: [pKey, bKey, key('table', table.id)] }
        }
      }
    }
  }
  return null
}

function childrenOf(project: AccessProject, nodeKey: string): string[] {
  if (nodeKey.startsWith('project:')) return project.bases.map((b) => key('base', b.id))
  if (nodeKey.startsWith('base:')) {
    const base = project.bases.find((b) => key('base', b.id) === nodeKey)
    return (base?.tables ?? []).map((t) => key('table', t.id))
  }
  return []
}

function descendantsOf(project: AccessProject, nodeKey: string): string[] {
  const out: string[] = []
  for (const child of childrenOf(project, nodeKey))
    out.push(child, ...descendantsOf(project, child))
  return out
}

/**
 * Sets one level on one node for one group, in the grants of that group's project — the
 * rule of Metabase, applied to the catalog's rows:
 *
 *   1. an ancestor granting MORE than the chosen level is exploded: its grant moves down
 *      onto each of its children, so that the chosen node alone can be lowered;
 *   2. the node receives the level, and its descendants lose their own grants — a level
 *      chosen on a base is the level of every table in it;
 *   3. a grant no higher than what its ancestors already give is dropped as redundant.
 */
export function applyLevel(
  project: AccessProject,
  path: readonly string[],
  level: AccessLevel,
  grants: Map<string, AccessLevel>,
): void {
  const node = path[path.length - 1] as string
  for (const ancestor of path.slice(0, -1)) {
    const held = grants.get(ancestor) ?? 'none'
    if (RANK[held] <= RANK[level]) continue
    grants.delete(ancestor)
    for (const child of childrenOf(project, ancestor)) {
      grants.set(child, max(grants.get(child) ?? 'none', held))
    }
  }
  for (const descendant of descendantsOf(project, node)) grants.delete(descendant)
  if (level === 'none') grants.delete(node)
  else grants.set(node, level)

  // Redundancy, top-down: a child granted nothing more than its parent already gives.
  const walk = (nodeKey: string, inherited: AccessLevel) => {
    const own = grants.get(nodeKey)
    if (own !== undefined && RANK[own] <= RANK[inherited]) grants.delete(nodeKey)
    const effective = max(inherited, grants.get(nodeKey) ?? 'none')
    for (const child of childrenOf(project, nodeKey)) walk(child, effective)
  }
  walk(key('project', project.id), 'none')
}

/**
 * Applies changes to the grid, in one transaction, and returns the new grid.
 *
 * The Administrators are not edited: they hold every verb on the tenant, and an
 * administrator without rights would be a contradiction the screen cannot express.
 */
export async function applyAccessChanges(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly changes: readonly AccessChange[]; readonly sessionId: string },
): Promise<AccessGraph> {
  for (const change of request.changes) {
    if (!(ACCESS_LEVELS as readonly string[]).includes(change.level)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'level' } })
    }
    if (!['project', 'base', 'table'].includes(change.scope?.kind)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'scope' } })
    }
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await requireElevatedSession(exec, ctx, request.sessionId)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
    const tree = await loadTree(exec, ctx)
    const grants = await loadGrants(exec, ctx)

    for (const change of request.changes) {
      const group = await loadGroup(exec, ctx, change.groupId)
      if (group.system === 'admins') throw new BasedbError('GROUP_SYSTEM_IMMUTABLE')
      const where = locate(tree, change.scope)
      if (where === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { scope: change.scope.id } })
      }

      const mine = grants.get(group.id) ?? new Map<string, AccessLevel>()
      applyLevel(where.project, where.path, change.level, mine)
      grants.set(group.id, mine)

      // The group's rows over this project are rewritten from its levels. Each write moves
      // `authz_version` through the catalog trigger, so every cached decision is dropped.
      const subtree = [
        key('project', where.project.id),
        ...descendantsOf(where.project, key('project', where.project.id)),
      ]
      const ids = (kind: ScopeKind) =>
        subtree.filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1))
      await exec.query(
        `DELETE FROM _basedb.permission
          WHERE role_id = $1
            AND (scope_project_id = ANY($2::uuid[]) OR scope_base_id = ANY($3::uuid[])
                 OR scope_table_id = ANY($4::uuid[]))`,
        [group.id, ids('project'), ids('base'), ids('table')],
        'delete',
      )
      for (const [scope, level] of mine) {
        if (!subtree.includes(scope)) continue
        const [kind, id] = scope.split(':') as [ScopeKind, string]
        for (const action of LEVEL_ACTIONS[level]) {
          await exec.query(
            `INSERT INTO _basedb.permission
               (role_id, scope_kind, scope_project_id, scope_base_id, scope_table_id,
                action, granted_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              group.id,
              kind,
              kind === 'project' ? id : null,
              kind === 'base' ? id : null,
              kind === 'table' ? id : null,
              action,
              ctx.actor.id,
            ],
            'insert',
          )
        }
      }

      await writeAudit(exec, ctx, {
        action: 'permission.set',
        objectKind: change.scope.kind,
        objectId: change.scope.id,
        objectName: group.label,
        payload: { group: group.id, level: change.level },
      })
    }

    return buildGraph(exec, ctx)
  })
}

export { ADMINS }
