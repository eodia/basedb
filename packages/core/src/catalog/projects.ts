import { grantCreator } from '../admin/sharing.js'
import { BasedbError } from '../errors/index.js'
import { openProposalCounts } from '../proposals/index.js'
import { type Action, decide } from '../rbac/decide.js'
import { loadProjectTarget, requireAction } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { normalizeDescription } from './description.js'
import { type LookInput, normalizeLook, touchesLook } from './look.js'
import { defaultProjectId, labelKey } from './operations.js'
import {
  BASE_ACTIONS,
  type BaseEnvironment,
  project,
  snapshot,
  targetFactory,
} from './projection.js'

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
  /** Agent proposals awaiting a decision — counted for those who decide, 0 for others. */
  readonly openProposals: number
  /**
   * Which environment of its base this one is (chapter 14). The navigation shows one line
   * per base, and the environments of a base — same `lineage` — behind a badge.
   */
  readonly environment: BaseEnvironment
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

export interface ProjectSummary extends Look {
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

  // The badge of the « Propositions » queue — for the bases whose structure one manages.
  const deciding = bases.filter((b) => b.baseActions.includes('manage_schema')).map((b) => b.id)
  const open =
    deciding.length === 0
      ? new Map<string, number>()
      : await withTransaction(pools, 'catalog', ctx, (exec) => openProposalCounts(exec, deciding), {
          readOnly: true,
        })

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
      color: row.color,
      icon: row.icon,
      image: row.image,
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
        openProposals: open.get(b.id) ?? 0,
        environment: b.environment,
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

/** The look of a project, validated like a base's; `null` when the request says nothing of it. */
function lookOf(raw: LookInput | undefined): Look | null {
  if (raw === undefined || !touchesLook(raw)) return null
  return normalizeLook(
    raw,
    (reason) => new BasedbError('REQUEST_INVALID', { details: { field: 'look', reason } }),
  )
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

/**
 * A project's name is unique among the projects of the person who created it — not in
 * the tenant: a name taken by a project one cannot see must neither block nor reveal it.
 */
async function assertLabelFree(
  exec: Executor,
  ctx: RequestContext,
  label: string,
  except: string | null,
  creator: string,
): Promise<void> {
  const clash = await exec.query<{ id: string }>(
    `SELECT p.id FROM _basedb.project p
       JOIN _basedb.tenant t ON t.id = p.tenant_id
      WHERE t.ref = $1 AND p.label_key = $2 AND p.deleted_at IS NULL
        AND p.created_by = $4::uuid
        AND ($3::uuid IS NULL OR p.id <> $3::uuid)`,
    [ctx.tenantId, labelKey(label), except, creator],
  )
  if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
}

/** Creates a project. Creating one is administering the tenant's structure. */
export async function createProject(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly label: string
    readonly description?: string | null
    readonly look?: LookInput
  },
): Promise<
  { readonly id: string; readonly label: string; readonly description: string | null } & Look
> {
  const label = checkLabel(request.label) as string
  const description = normalizeDescription(request.description)
  const look = lookOf(request.look) ?? { color: null, icon: null, image: null }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    // Every person creates their own projects (§15.1); a token, which acts on one base,
    // never does.
    if (ctx.actor.kind !== 'user') throw new BasedbError('RESOURCE_NOT_FOUND')
    await assertLabelFree(exec, ctx, label, null, ctx.actor.id)
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.project
         (tenant_id, label, label_key, description, color, icon, image, position,
          created_by, updated_by)
       SELECT t.id, $2, $3, $4, $6, $7, $8,
              coalesce((SELECT max(position) + 1 FROM _basedb.project WHERE tenant_id = t.id), 0),
              $5, $5
         FROM _basedb.tenant t WHERE t.ref = $1
       RETURNING id`,
      [
        ctx.tenantId,
        label,
        labelKey(label),
        description,
        ctx.actor.id,
        look.color,
        look.icon,
        look.image,
      ],
      'insert',
    )
    // Whoever creates a project manages it — and shares it.
    await grantCreator(exec, ctx, row.id)
    return { id: row.id, label, description, ...look }
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
    /** The three keys are one value, as for a base: naming any of them replaces the look. */
    readonly look?: LookInput
  },
): Promise<{ readonly label: string; readonly description: string | null } & Look> {
  const label = checkLabel(request.label)
  const setsDescription = request.description !== undefined
  const description = setsDescription ? normalizeDescription(request.description) : null
  const look = lookOf(request.look)

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const target = await loadProjectTarget(exec, ctx, request.projectId)
    await requireAction(exec, ctx, 'manage_schema', target, { project: request.projectId })
    if (label !== undefined) {
      const [owner] = await exec.query<{ created_by: string }>(
        'SELECT created_by FROM _basedb.project WHERE id = $1',
        [target?.id],
      )
      await assertLabelFree(exec, ctx, label, target?.id ?? null, owner?.created_by ?? ctx.actor.id)
    }
    const [row] = await exec.query<
      { label: string; description: string | null } & Look & Record<string, unknown>
    >(
      `UPDATE _basedb.project
          SET label = CASE WHEN $2::boolean THEN $3::text ELSE label END,
              label_key = CASE WHEN $2::boolean THEN $4::text ELSE label_key END,
              description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
              color = CASE WHEN $8::boolean THEN $9::text ELSE color END,
              icon = CASE WHEN $8::boolean THEN $10::text ELSE icon END,
              image = CASE WHEN $8::boolean THEN $11::text ELSE image END,
              updated_at = clock_timestamp(), updated_by = $7
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING label, description, color, icon, image`,
      [
        target?.id,
        label !== undefined,
        label ?? null,
        label === undefined ? null : labelKey(label),
        setsDescription,
        description,
        ctx.actor.id,
        look !== null,
        look?.color ?? null,
        look?.icon ?? null,
        look?.image ?? null,
      ],
      'update',
    )
    return {
      label: row.label,
      description: row.description,
      color: row.color,
      icon: row.icon,
      image: row.image,
    }
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
    // Whoever manages the project deletes it, as whoever created it did.
    await requireAction(exec, ctx, 'manage_schema', target, { project: request.projectId })
    const [live] = await exec.query<{ n: string }>(
      'SELECT count(*) AS n FROM _basedb.base WHERE project_id = $1 AND deleted_at IS NULL',
      [target?.id],
    )
    if (Number(live?.n ?? 0) > 0) {
      throw new BasedbError('PROJECT_NOT_EMPTY', { details: { bases: Number(live?.n) } })
    }
    // Its grants go with it: a permission naming a project nobody can reach any more
    // would survive in the permission screen as a ghost. Its pending invitations too.
    await exec.query(
      'DELETE FROM _basedb.permission WHERE scope_project_id = $1',
      [target?.id],
      'delete',
    )
    await exec.query(
      `UPDATE _basedb.invitation SET revoked_at = clock_timestamp()
        WHERE scope_project_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [target?.id],
      'update',
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
