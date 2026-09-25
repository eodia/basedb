import { BasedbError } from '../errors/index.js'
import { type Action, decide } from '../rbac/decide.js'
import { loadProjectTarget, requireAction, tenantTarget } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { normalizeDescription } from './description.js'
import { defaultProjectId, labelKey } from './operations.js'
import { BASE_ACTIONS, project, snapshot, targetFactory } from './projection.js'

/**
 * Projects — the level above the base (chapter 02, chapter 05 §15).
 *
 * A project groups bases and has no physical existence: it names no schema, and a base
 * keeps its schema name whatever project holds it. It is what the interface navigates
 * by — one chooses a project, then builds bases in it and tables in each base — and a
 * permission scope: a group granted « Édition » on a project edits every table of every
 * base it holds, those created tomorrow included.
 */

/** How a base or a table looks, as the navigation draws it: keys always present. */
interface Look {
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
}

/** A base of a project, as the navigation shows it. */
export interface ProjectBase extends Look {
  readonly id: string
  /** Logical name — the one in the URL and in the SQL schema. */
  readonly name: string
  readonly label: string
  readonly description: string | null
  /** Verbs held on the base itself: `manage_schema` lets a table be added to it. */
  readonly actions: readonly Action[]
  readonly tables: ReadonlyArray<
    {
      readonly id: string
      readonly name: string
      readonly label: string
      /** Verbs held on the table: what its menu may offer. */
      readonly actions: readonly Action[]
    } & Look
  >
}

export interface ProjectSummary {
  readonly id: string
  readonly label: string
  readonly description: string | null
  /** Verbs held on the project itself: `manage_schema` lets a base be added to it. */
  readonly actions: readonly Action[]
  readonly bases: readonly ProjectBase[]
}

/**
 * The projects the caller can see, each with the bases and tables they can see in it.
 *
 * A project appears when the caller holds a right on it — granted there or on the tenant
 * — or sees at least one of its bases. The same rule as a base, one level up: a project
 * nobody granted and nothing visible inside is absent, not empty.
 */
export async function listProjects(
  pools: Pools,
  ctx: RequestContext,
): Promise<readonly ProjectSummary[]> {
  const { grants, raw } = await snapshot(pools, ctx)
  const bases = project(ctx, grants, raw)
  // The projection lists the DATA verbs of a table; the navigation also wants to know
  // whether its structure may be changed — deleting it is offered on that alone.
  const targetOf = targetFactory(ctx, raw)
  const tableRows = new Map(raw.tables.map((t) => [t.id, t]))
  const tableActions = (id: string, actions: readonly Action[]): readonly Action[] => {
    const row = tableRows.get(id)
    if (row === undefined) return actions
    const manages = decide(ctx, grants, 'manage_schema', targetOf(row)).verdict === 'ALLOWED'
    return manages ? [...actions, 'manage_schema'] : actions
  }

  const out: ProjectSummary[] = []
  for (const row of raw.projects) {
    const target = {
      kind: 'project' as const,
      id: row.id,
      tenantId: ctx.tenantId,
      projectId: row.id,
    }
    const actions = BASE_ACTIONS.filter(
      (action) => decide(ctx, grants, action, target).verdict === 'ALLOWED',
    )
    const inside = bases.filter((b) => b.project.id === row.id)
    if (!actions.includes('read') && inside.length === 0) continue
    out.push({
      id: row.id,
      label: row.label,
      description: row.description,
      actions,
      bases: inside.map((b) => ({
        id: b.id,
        name: b.name,
        label: b.label,
        description: b.description,
        color: b.color,
        icon: b.icon,
        image: b.image,
        actions: b.baseActions,
        tables: b.tables.map((t) => ({
          id: t.id,
          name: t.name,
          label: t.label,
          color: t.color,
          icon: t.icon,
          image: t.image,
          actions: tableActions(t.id, t.actions),
        })),
      })),
    })
  }
  return out
}

function checkLabel(label: string | undefined): string | undefined {
  if (label === undefined) return undefined
  const trimmed = label.trim()
  if (trimmed === '') throw new BasedbError('LABEL_EMPTY')
  if ([...trimmed].length > 255) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: 255 } })
  }
  return trimmed
}

async function assertLabelFree(
  exec: Executor,
  ctx: RequestContext,
  label: string,
  except: string | null,
): Promise<void> {
  const clash = await exec.query<{ id: string }>(
    `SELECT p.id FROM _basedb.project p
       JOIN _basedb.tenant t ON t.id = p.tenant_id
      WHERE t.ref = $1 AND p.label_key = $2 AND p.deleted_at IS NULL
        AND ($3::uuid IS NULL OR p.id <> $3::uuid)`,
    [ctx.tenantId, labelKey(label), except],
  )
  if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
}

/** Creates a project. Creating one is administering the tenant's structure. */
export async function createProject(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly label: string; readonly description?: string | null },
): Promise<{ readonly id: string; readonly label: string; readonly description: string | null }> {
  const label = checkLabel(request.label) as string
  const description = normalizeDescription(request.description)

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAction(exec, ctx, 'manage_schema', tenantTarget(ctx))
    await assertLabelFree(exec, ctx, label, null)
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.project
         (tenant_id, label, label_key, description, position, created_by, updated_by)
       SELECT t.id, $2, $3, $4,
              coalesce((SELECT max(position) + 1 FROM _basedb.project WHERE tenant_id = t.id), 0),
              $5, $5
         FROM _basedb.tenant t WHERE t.ref = $1
       RETURNING id`,
      [ctx.tenantId, label, labelKey(label), description, ctx.actor.id],
      'insert',
    )
    return { id: row.id, label, description }
  })
}

/** Renames a project and/or changes what it is for. `manage_schema` on the project. */
export async function updateProject(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly projectId: string
    readonly label?: string
    readonly description?: string | null
  },
): Promise<{ readonly label: string; readonly description: string | null }> {
  const label = checkLabel(request.label)
  const setsDescription = request.description !== undefined
  const description = setsDescription ? normalizeDescription(request.description) : null

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const target = await loadProjectTarget(exec, ctx, request.projectId)
    await requireAction(exec, ctx, 'manage_schema', target, { project: request.projectId })
    if (label !== undefined) await assertLabelFree(exec, ctx, label, target?.id ?? null)
    const [row] = await exec.query<{ label: string; description: string | null }>(
      `UPDATE _basedb.project
          SET label = CASE WHEN $2::boolean THEN $3::text ELSE label END,
              label_key = CASE WHEN $2::boolean THEN $4::text ELSE label_key END,
              description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
              updated_at = clock_timestamp(), updated_by = $7
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING label, description`,
      [
        target?.id,
        label !== undefined,
        label ?? null,
        label === undefined ? null : labelKey(label),
        setsDescription,
        description,
        ctx.actor.id,
      ],
      'update',
    )
    return { label: row.label, description: row.description }
  })
}

/**
 * Deletes an EMPTY project. Its bases are real schemas with real rows: a project that
 * still holds one is refused (`PROJECT_NOT_EMPTY`) — the bases are deleted first, each
 * through its own plan, never swept along by a grouping that has no physical existence.
 */
export async function deleteProject(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly projectId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const target = await loadProjectTarget(exec, ctx, request.projectId)
    // Seeing the project is enough to be told it exists; deleting one is the tenant
    // structure's business, like creating one.
    await requireAction(exec, ctx, 'read', target, { project: request.projectId })
    await requireAction(exec, ctx, 'manage_schema', tenantTarget(ctx), {
      project: request.projectId,
    })
    const [live] = await exec.query<{ n: string }>(
      'SELECT count(*) AS n FROM _basedb.base WHERE project_id = $1 AND deleted_at IS NULL',
      [target?.id],
    )
    if (Number(live?.n ?? 0) > 0) {
      throw new BasedbError('PROJECT_NOT_EMPTY', { details: { bases: Number(live?.n) } })
    }
    // Its grants go with it: a permission naming a project nobody can reach any more
    // would survive in the permission screen as a ghost.
    await exec.query(
      'DELETE FROM _basedb.permission WHERE scope_project_id = $1',
      [target?.id],
      'delete',
    )
    await exec.query(
      `UPDATE _basedb.project
          SET deleted_at = clock_timestamp(), deleted_by = $2, updated_at = clock_timestamp()
        WHERE id = $1`,
      [target?.id, ctx.actor.id],
      'update',
    )
  })
}

export { defaultProjectId }
