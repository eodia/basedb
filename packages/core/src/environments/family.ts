import { labelKey } from '../catalog/operations.js'
import { sqlCreateSchema } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { SCOPE_INSTANCE, allocateName } from '../naming/allocation.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The environments of a base — chapter 14.
 *
 * A base can come in several environments — production, recette, développement — and
 * each is a base of its own: its schema, its tables, its rows, its rights. What makes
 * them one base is their LINEAGE: they share `base.lineage_id`, their label, their
 * description and their look; they differ by `environment`. Production is the one that
 * was there first, the default, and the only one whose label the project holds unique.
 *
 * An environment is created as a copy of the STRUCTURE of another — production, unless
 * told otherwise: its tables and fields are recreated with the same lineage, so that the
 * comparison knows the « Clients » of recette is the « Clients » of production whatever
 * either is called by then. Rows are not copied: that is what the synchronization of
 * `rows.ts` is for, table by table, when someone asks.
 */

/** The longest environment label: a badge, not a sentence (`ck_base_environment`). */
export const MAX_ENVIRONMENT_CHARS = 60

export interface EnvironmentSummary {
  /** The base that IS this environment. */
  readonly id: string
  /** Its logical name — the schema, the URL. */
  readonly name: string
  readonly environment: string
  readonly production: boolean
  readonly position: number
  readonly tableCount: number
  readonly createdAt: string
  /** The environment it was copied from, when it was — a bare key. */
  readonly forkedFrom: string | null
}

export interface Family {
  readonly lineageId: string
  readonly projectId: string
  readonly label: string
  readonly description: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly mcpEnabled: boolean
  /** Production first, then in the order they were given. */
  readonly environments: readonly EnvironmentSummary[]
}

interface FamilyRow extends Record<string, unknown> {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly mcp_enabled: boolean
  readonly project_id: string
  readonly lineage_id: string
  readonly environment: string
  readonly is_production: boolean
  readonly environment_position: number
  readonly table_count: number
  readonly created_at: Date
  readonly forked_from_base_id: string | null
}

/**
 * Every live environment of the base `baseId` belongs to — `baseId` itself included.
 * An unknown base, or one of another tenant, answers `RESOURCE_NOT_FOUND`.
 */
export async function loadFamily(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<Family> {
  const rows = await exec.query<FamilyRow>(
    `SELECT b.id, sn.name, b.label, b.description, b.color, b.icon, b.image, b.mcp_enabled,
            b.project_id, b.lineage_id, b.environment, b.is_production,
            b.environment_position, b.created_at, b.forked_from_base_id,
            (SELECT count(*) FROM _basedb.table_def t
              WHERE t.base_id = b.id AND t.deleted_at IS NULL)::int AS table_count
       FROM _basedb.base b
       JOIN _basedb.tenant te        ON te.id = b.tenant_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                    AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE te.ref = $2 AND b.deleted_at IS NULL
        AND b.lineage_id = (SELECT x.lineage_id FROM _basedb.base x WHERE x.id::text = $1)
      ORDER BY NOT b.is_production, b.environment_position, b.created_at`,
    [baseId, ctx.tenantId],
  )
  const self = rows.find((r) => r.id === baseId)
  if (self === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  const head = rows.find((r) => r.is_production) ?? self
  return {
    lineageId: self.lineage_id,
    projectId: head.project_id,
    label: head.label,
    description: head.description,
    color: head.color,
    icon: head.icon,
    image: head.image,
    mcpEnabled: head.mcp_enabled,
    environments: rows.map((r) => ({
      id: r.id,
      name: r.name,
      environment: r.environment,
      production: r.is_production,
      position: r.environment_position,
      tableCount: r.table_count,
      createdAt: new Date(r.created_at).toISOString(),
      forkedFrom: r.forked_from_base_id,
    })),
  }
}

/**
 * Two distinct environments of one base, the first the SOURCE, the second the TARGET —
 * refused with `ENVIRONMENT_MISMATCH` otherwise: comparing two unrelated bases would
 * compare nothing, table by table, and applying one to the other would copy a structure
 * into a base it never belonged to.
 */
export async function loadPair(
  exec: Executor,
  ctx: RequestContext,
  sourceBaseId: string,
  targetBaseId: string,
): Promise<{
  readonly family: Family
  readonly source: EnvironmentSummary
  readonly target: EnvironmentSummary
}> {
  const family = await loadFamily(exec, ctx, sourceBaseId)
  const source = family.environments.find((e) => e.id === sourceBaseId)
  const target = family.environments.find((e) => e.id === targetBaseId)
  if (source === undefined || target === undefined || source.id === target.id) {
    throw new BasedbError('ENVIRONMENT_MISMATCH', {
      details: { source: sourceBaseId, target: targetBaseId },
    })
  }
  return { family, source, target }
}

/** Lists the environments of a base: what the base's form edits. `manage_schema` on it. */
export async function listEnvironments(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Family> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      return loadFamily(exec, ctx, request.baseId)
    },
    { readOnly: true },
  )
}

function checkEnvironmentLabel(raw: string): string {
  const label = raw.trim().replace(/\s+/g, ' ')
  if (label === '') throw new BasedbError('LABEL_EMPTY', { details: { field: 'environment' } })
  if ([...label].length > MAX_ENVIRONMENT_CHARS) {
    throw new BasedbError('LABEL_TOO_LONG', {
      details: { field: 'environment', maximum: MAX_ENVIRONMENT_CHARS },
    })
  }
  return label
}

/**
 * Creates the EMPTY base of a new environment — same lineage, label, description, look
 * and project as the base, a schema of its own, and the base-level grants of the
 * environment it copies. Its structure is laid by `applyStructure`, next.
 *
 * The schema is named after the base AND the environment — `b_t4z56fq_crm_recette` —
 * so that psql says which one a query reads.
 */
export async function createEnvironmentBase(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly baseId: string
    readonly environment: string
    /** The environment copied — production when absent. */
    readonly sourceBaseId?: string
  },
): Promise<{ readonly environment: EnvironmentSummary; readonly sourceBaseId: string }> {
  const label = checkEnvironmentLabel(request.environment)

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const family = await loadFamily(exec, ctx, request.baseId)
    const source =
      request.sourceBaseId === undefined
        ? (family.environments.find((e) => e.production) ?? family.environments[0])
        : family.environments.find((e) => e.id === request.sourceBaseId)
    if (source === undefined) {
      throw new BasedbError('ENVIRONMENT_MISMATCH', {
        details: { source: request.sourceBaseId ?? null },
      })
    }
    // Copying a structure is building one: `manage_schema` on what is copied too.
    await requireOnBase(exec, ctx, 'manage_schema', source.id)
    if (family.environments.some((e) => labelKey(e.environment) === labelKey(label))) {
      throw new BasedbError('LABEL_DUPLICATE', { details: { label, field: 'environment' } })
    }

    const [tenant] = await exec.query<{ id: string; ref: string }>(
      'SELECT id, ref FROM _basedb.tenant WHERE ref = $1 AND deleted_at IS NULL',
      [ctx.tenantId],
    )
    if (tenant === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')

    const position = Math.max(0, ...family.environments.map((e) => e.position)) + 1
    const [base] = await exec.query<{ id: string; created_at: Date }>(
      `INSERT INTO _basedb.base
         (tenant_id, project_id, label, label_key, description, color, icon, image,
          mcp_enabled, lineage_id, environment, environment_key, is_production,
          environment_position, forked_from_base_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, $13, $14, $15, $15)
       RETURNING id, created_at`,
      [
        tenant.id,
        family.projectId,
        family.label,
        labelKey(family.label),
        family.description,
        family.color,
        family.icon,
        family.image,
        family.mcpEnabled,
        family.lineageId,
        label,
        labelKey(label),
        position,
        source.id,
        ctx.actor.id,
      ],
      'insert',
    )

    const name = await allocateName(exec, ctx, {
      label: `${family.label} ${label}`,
      objectKind: 'schema',
      scopeKind: 'instance',
      scopeId: SCOPE_INSTANCE,
      tenantId: tenant.ref,
    })
    await exec.query(
      `INSERT INTO _basedb.db_schema (base_id, role, name_id, created_by)
       VALUES ($1, 'current', $2, $3)`,
      [base.id, name.nameId, ctx.actor.id],
      'insert',
    )
    await exec.query(sqlCreateSchema(name.name), [], 'ddl')

    // Who was granted the base is granted its new environment: a restriction written on
    // production would otherwise not exist in recette, where the same rows may land.
    await exec.query(
      `INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
       SELECT p.role_id, 'base', $2, p.action, $3
         FROM _basedb.permission p
        WHERE p.scope_kind = 'base' AND p.scope_base_id = $1
       ON CONFLICT DO NOTHING`,
      [source.id, base.id, ctx.actor.id],
      'insert',
    )

    return {
      sourceBaseId: source.id,
      environment: {
        id: base.id,
        name: name.name,
        environment: label,
        production: false,
        position,
        tableCount: 0,
        createdAt: new Date(base.created_at).toISOString(),
        forkedFrom: source.id,
      },
    }
  })
}

/** Renames an environment — its badge, not its schema. `manage_schema` on it. */
export async function renameEnvironment(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly environment: string },
): Promise<EnvironmentSummary> {
  const label = checkEnvironmentLabel(request.environment)
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const family = await loadFamily(exec, ctx, request.baseId)
    const clash = family.environments.find(
      (e) => e.id !== request.baseId && labelKey(e.environment) === labelKey(label),
    )
    if (clash !== undefined) {
      throw new BasedbError('LABEL_DUPLICATE', { details: { label, field: 'environment' } })
    }
    await exec.query(
      `UPDATE _basedb.base
          SET environment = $2, environment_key = $3, catalog_version = catalog_version + 1,
              updated_at = clock_timestamp(), updated_by = $4
        WHERE id = $1`,
      [request.baseId, label, labelKey(label), ctx.actor.id],
      'update',
    )
    await exec.query("SELECT pg_notify('basedb_catalog', $1::text)", [request.baseId])
    const self = family.environments.find((e) => e.id === request.baseId)
    if (self === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')
    return { ...self, environment: label }
  })
}

/**
 * The environment a deletion may remove on its own: anything but production, which is
 * the base itself — deleting it is deleting the base, every environment with it.
 */
export async function assertDeletableEnvironment(
  pools: Pools,
  ctx: RequestContext,
  baseId: string,
): Promise<void> {
  await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', baseId)
      const family = await loadFamily(exec, ctx, baseId)
      const self = family.environments.find((e) => e.id === baseId)
      if (self?.production === true) {
        throw new BasedbError('ENVIRONMENT_IS_PRODUCTION', { details: { base: baseId } })
      }
    },
    { readOnly: true },
  )
}

/**
 * Every live environment of a base, production LAST: the order in which deleting the
 * base removes them — so that a failure half-way leaves a base that still has its
 * production, rather than environments without one.
 */
export async function deletionOrder(
  pools: Pools,
  ctx: RequestContext,
  baseId: string,
): Promise<readonly string[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const family = await loadFamily(exec, ctx, baseId)
      return [...family.environments]
        .sort((a, b) => Number(a.production) - Number(b.production))
        .map((e) => e.id)
    },
    { readOnly: true },
  )
}
