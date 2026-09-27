import { writeAudit } from '../audit/journal.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import { loadBaseTarget, visibleInside } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { normalizeDescription } from './description.js'
import { labelKey } from './operations.js'

/**
 * Saved queries — chapter 11 §1.7: a SQL text kept under a base, where the navigation
 * lists it beneath the tables.
 *
 * Three audiences. `personal`: its author alone sees it, with the mere right to read the
 * base. `base`: whoever reads the base. `groups`: the members of chosen groups. Sharing
 * one is building the base, as a collaborative view is (05 §9): `manage_schema` on it.
 *
 * What is shared is the TEXT. Whoever opens a query runs it with their own rights — the
 * console's reach for whoever manages the base, their own tables and fields, read only,
 * for everyone else (`sql/reader.ts`). A query shared to a group therefore never shows its
 * members what its author reads and they do not.
 */

export const QUERY_AUDIENCES = ['personal', 'base', 'groups'] as const
export type QueryAudience = (typeof QUERY_AUDIENCES)[number]

/** Longest statement kept: the CHECK of the catalog, said before the database says it. */
const MAX_STATEMENT_CHARS = 100_000
const MAX_LABEL_CHARS = 255

export interface SavedQuery {
  readonly id: string
  readonly baseId: string
  readonly label: string
  readonly description: string | null
  readonly statement: string
  readonly audience: QueryAudience
  /** The groups a `groups` query is open to — empty for the two others. */
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
  readonly owner: { readonly id: string; readonly name: string }
  /** The caller wrote it. */
  readonly mine: boolean
  /** The caller may change it or delete it: its author when personal, a builder when shared. */
  readonly editable: boolean
  readonly updatedAt: string
}

/** A query as the navigation lists it, under its base. */
export interface QuerySummary {
  readonly id: string
  readonly label: string
  readonly audience: QueryAudience
  readonly mine: boolean
}

export interface QueryInput {
  readonly label?: string
  readonly description?: string | null
  readonly statement?: string
  readonly audience?: QueryAudience
  /** For `groups`: the groups, by catalog key. Ignored otherwise. */
  readonly groupIds?: readonly string[]
}

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly base_id: string
  readonly label: string
  readonly description: string | null
  readonly statement: string
  readonly audience: QueryAudience
  readonly owner_id: string
  readonly owner_name: string
  readonly updated_at: string
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

const SELECT = `
  SELECT q.id::text, q.base_id::text, q.label, q.description, q.statement, q.audience,
         q.owner_id::text, u.display_name AS owner_name, q.updated_at::text,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id::text, 'label', r.label)
                                    ORDER BY r.label)
                     FROM _basedb.saved_query_role qr
                     JOIN _basedb.role r ON r.id = qr.role_id AND r.deleted_at IS NULL
                    WHERE qr.query_id = q.id), '[]'::jsonb) AS groups
    FROM _basedb.saved_query q
    JOIN _basedb.app_user u ON u.id = q.owner_id`

/**
 * Who may see a query of a base they see — the one rule, written once in SQL: its author,
 * then according to its audience. `$2` is the caller, `$3` whether they manage the base.
 */
const VISIBLE = `
  (q.owner_id = $2::uuid
   OR q.audience = 'base'
   OR (q.audience = 'groups'
       AND ($3::boolean OR EXISTS (
             SELECT 1 FROM _basedb.saved_query_role qr
               JOIN _basedb.role_member m ON m.role_id = qr.role_id
              WHERE qr.query_id = q.id AND m.user_id = $2::uuid))))`

function shaped(row: Row, ctx: RequestContext, manages: boolean): SavedQuery {
  const mine = row.owner_id === ctx.actor.id
  return {
    id: row.id,
    baseId: row.base_id,
    label: row.label,
    description: row.description,
    statement: row.statement,
    audience: row.audience,
    groups: row.audience === 'groups' ? row.groups : [],
    owner: { id: row.owner_id, name: row.owner_name },
    mine,
    editable: row.audience === 'personal' ? mine : manages,
    updatedAt: row.updated_at,
  }
}

/**
 * What the caller may do on a base: see it — they read one of its tables, or the base
 * itself — and manage it. A base they do not see answers as one that does not exist.
 */
async function accessTo(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<{ readonly manages: boolean }> {
  const grants = await loadGrants(exec, ctx)
  const target = await loadBaseTarget(exec, ctx, baseId)
  if (target === null || ctx.actor.kind !== 'user') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  }
  const manages = decide(ctx, grants, 'manage_schema', target).verdict === 'ALLOWED'
  const sees =
    manages ||
    decide(ctx, grants, 'read', target).verdict === 'ALLOWED' ||
    (await visibleInside(exec, ctx, grants, target))
  if (!sees) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  return { manages }
}

/** The queries of a base the caller may see, shared ones first, then by label. */
export async function listQueries(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<SavedQuery[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const { manages } = await accessTo(exec, ctx, request.baseId)
      const rows = await exec.query<Row>(
        `${SELECT}
          WHERE q.base_id = $1::uuid AND ${VISIBLE}
          ORDER BY q.audience = 'personal', q.label_key`,
        [request.baseId, ctx.actor.id, manages],
      )
      return rows.map((row) => shaped(row, ctx, manages))
    },
    { readOnly: true },
  )
}

/**
 * The queries of several bases at once, as the navigation lists them — for bases the
 * caller already sees, `managed` naming those whose structure they manage.
 */
export async function querySummaries(
  exec: Executor,
  ctx: RequestContext,
  baseIds: readonly string[],
  managed: ReadonlySet<string>,
): Promise<ReadonlyMap<string, readonly QuerySummary[]>> {
  const out = new Map<string, QuerySummary[]>()
  if (baseIds.length === 0 || ctx.actor.kind !== 'user') return out
  const rows = await exec.query<{
    id: string
    base_id: string
    label: string
    audience: QueryAudience
    owner_id: string
  }>(
    `SELECT q.id::text, q.base_id::text, q.label, q.audience, q.owner_id::text
       FROM _basedb.saved_query q
      WHERE q.base_id = ANY($1::uuid[])
        AND ${VISIBLE.replace('$3::boolean', '(q.base_id = ANY($3::uuid[]))')}
      ORDER BY q.audience = 'personal', q.label_key`,
    [baseIds, ctx.actor.id, [...managed]],
  )
  for (const row of rows) {
    const list = out.get(row.base_id) ?? []
    list.push({
      id: row.id,
      label: row.label,
      audience: row.audience,
      mine: row.owner_id === ctx.actor.id,
    })
    out.set(row.base_id, list)
  }
  return out
}

/** One query of a base, for whoever may see it. */
export async function getQuery(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly queryId: string },
): Promise<SavedQuery> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const { manages } = await accessTo(exec, ctx, request.baseId)
      return shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
    },
    { readOnly: true },
  )
}

/**
 * The groups a query may be shared with — offered to whoever may share one on this base.
 * Every group of the tenant: the one a query is meant for may hold nobody yet.
 */
export async function listQueryGroups(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<ReadonlyArray<{ readonly id: string; readonly label: string }>> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const { manages } = await accessTo(exec, ctx, request.baseId)
      if (!manages) throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
      return exec.query<{ id: string; label: string }>(
        `SELECT r.id::text, r.label FROM _basedb.role r
           JOIN _basedb.tenant t ON t.id = r.tenant_id
          WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
          ORDER BY r.label`,
        [ctx.tenantId],
      )
    },
    { readOnly: true },
  )
}

export async function createQuery(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly input: QueryInput },
): Promise<SavedQuery> {
  const input = request.input
  const label = checkLabel(input.label)
  const statement = checkStatement(input.statement)
  const description = normalizeDescription(input.description)
  const audience = checkAudience(input.audience ?? 'personal')

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const { manages } = await accessTo(exec, ctx, request.baseId)
    if (audience !== 'personal' && !manages) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
    }
    const groupIds = audience === 'groups' ? await checkGroups(exec, ctx, input.groupIds) : []
    await assertLabelFree(exec, ctx, request.baseId, label, audience, null)
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.saved_query
         (base_id, label, label_key, description, statement, audience, owner_id, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id::text`,
      [request.baseId, label, labelKey(label), description, statement, audience, ctx.actor.id],
      'insert',
    )
    await writeGroups(exec, row.id, groupIds)
    await writeAudit(exec, ctx, {
      action: 'query.create',
      objectKind: 'saved_query',
      objectId: row.id,
      objectName: label,
      baseId: request.baseId,
      payload: { audience, groups: groupIds, statement },
    })
    return shaped(
      await visibleRow(exec, ctx, { ...request, queryId: row.id }, manages),
      ctx,
      manages,
    )
  })
}

export async function updateQuery(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly queryId: string; readonly input: QueryInput },
): Promise<SavedQuery> {
  const input = request.input
  const label = input.label === undefined ? undefined : checkLabel(input.label)
  const statement = input.statement === undefined ? undefined : checkStatement(input.statement)
  const audience = input.audience === undefined ? undefined : checkAudience(input.audience)
  const setsDescription = input.description !== undefined
  const description = setsDescription ? normalizeDescription(input.description) : null

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const { manages } = await accessTo(exec, ctx, request.baseId)
    const current = shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
    if (!current.editable) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { query: request.queryId } })
    }
    const nextAudience = audience ?? current.audience
    // Taking a query out of one's own hands, or putting a shared one back into them, is
    // deciding who sees it: a builder's decision on a shared base.
    if (nextAudience !== current.audience && !manages) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
    }
    const nextLabel = label ?? current.label
    if (label !== undefined || nextAudience !== current.audience) {
      await assertLabelFree(
        exec,
        ctx,
        request.baseId,
        nextLabel,
        nextAudience,
        current.id,
        current.owner.id,
      )
    }
    const groupIds =
      nextAudience !== 'groups'
        ? []
        : input.groupIds !== undefined || current.audience !== 'groups'
          ? await checkGroups(exec, ctx, input.groupIds)
          : null

    await exec.query(
      `UPDATE _basedb.saved_query
          SET label = $2, label_key = $3,
              description = CASE WHEN $4::boolean THEN $5::text ELSE description END,
              statement = coalesce($6::text, statement),
              audience = $7,
              updated_at = pg_catalog.clock_timestamp(), updated_by = $8
        WHERE id = $1`,
      [
        current.id,
        nextLabel,
        labelKey(nextLabel),
        setsDescription,
        description,
        statement ?? null,
        nextAudience,
        ctx.actor.id,
      ],
      'update',
    )
    if (groupIds !== null) {
      await exec.query(
        'DELETE FROM _basedb.saved_query_role WHERE query_id = $1',
        [current.id],
        'delete',
      )
      await writeGroups(exec, current.id, groupIds)
    }
    await writeAudit(exec, ctx, {
      action: 'query.update',
      objectKind: 'saved_query',
      objectId: current.id,
      objectName: nextLabel,
      baseId: request.baseId,
      payload: {
        audience: nextAudience,
        ...(groupIds === null ? {} : { groups: groupIds }),
        ...(statement === undefined ? {} : { statement }),
      },
    })
    return shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
  })
}

export async function deleteQuery(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly queryId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const { manages } = await accessTo(exec, ctx, request.baseId)
    const current = shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
    if (!current.editable) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { query: request.queryId } })
    }
    await exec.query('DELETE FROM _basedb.saved_query WHERE id = $1', [current.id], 'delete')
    // The text goes into the journal: deleting it is the one step that cannot be undone.
    await writeAudit(exec, ctx, {
      action: 'query.delete',
      objectKind: 'saved_query',
      objectId: current.id,
      objectName: current.label,
      baseId: request.baseId,
      payload: { audience: current.audience, statement: current.statement },
    })
  })
}

/** The row, when the caller may see it; otherwise the same answer as no row at all. */
async function visibleRow(
  exec: Executor,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly queryId: string },
  manages: boolean,
): Promise<Row> {
  const [row] = await exec.query<Row>(
    `${SELECT}
      WHERE q.id::text = $4 AND q.base_id = $1::uuid AND ${VISIBLE}`,
    [request.baseId, ctx.actor.id, manages, request.queryId],
  )
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { query: request.queryId } })
  }
  return row
}

async function writeGroups(exec: Executor, queryId: string, groupIds: readonly string[]) {
  if (groupIds.length === 0) return
  await exec.query(
    `INSERT INTO _basedb.saved_query_role (query_id, role_id)
     SELECT $1::uuid, g::uuid FROM unnest($2::text[]) AS g
     ON CONFLICT DO NOTHING`,
    [queryId, groupIds],
    'insert',
  )
}

/** The groups named, each a live group of the tenant; at least one. */
async function checkGroups(
  exec: Executor,
  ctx: RequestContext,
  raw: readonly string[] | undefined,
): Promise<readonly string[]> {
  const asked = [...new Set((raw ?? []).filter((g) => typeof g === 'string' && g !== ''))]
  if (asked.length === 0) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'groups', reason: 'aucun' } })
  }
  const found = await exec.query<{ id: string }>(
    `SELECT r.id::text FROM _basedb.role r
       JOIN _basedb.tenant t ON t.id = r.tenant_id
      WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
        AND r.id::text = ANY($2::text[])`,
    [ctx.tenantId, asked],
  )
  if (found.length !== asked.length) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'groups', reason: 'inconnu' } })
  }
  return found.map((g) => g.id)
}

/**
 * A label is unique among the shared queries of a base, and among one person's own on it:
 * two people may each keep « Mes relances ».
 */
async function assertLabelFree(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
  label: string,
  audience: QueryAudience,
  except: string | null,
  owner: string = ctx.actor.id,
): Promise<void> {
  const clash = await exec.query<{ id: string }>(
    `SELECT id FROM _basedb.saved_query
      WHERE base_id = $1::uuid AND label_key = $2
        AND ($3::uuid IS NULL OR id <> $3::uuid)
        AND CASE WHEN $4 = 'personal' THEN audience = 'personal' AND owner_id = $5::uuid
                 ELSE audience <> 'personal' END`,
    [baseId, labelKey(label), except, audience, owner],
  )
  if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
}

function checkLabel(value: unknown): string {
  if (typeof value !== 'string') throw new BasedbError('LABEL_EMPTY')
  const label = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (label === '') throw new BasedbError('LABEL_EMPTY')
  if ([...label].length > MAX_LABEL_CHARS) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: MAX_LABEL_CHARS } })
  }
  return label
}

function checkStatement(value: unknown): string {
  const statement = typeof value === 'string' ? value.trim() : ''
  if (statement === '') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'statement', reason: 'vide' } })
  }
  if (statement.length > MAX_STATEMENT_CHARS || statement.includes('\u0000')) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'statement', reason: 'invalide' },
    })
  }
  return statement
}

function checkAudience(value: unknown): QueryAudience {
  if (typeof value !== 'string' || !(QUERY_AUDIENCES as readonly string[]).includes(value)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'audience' } })
  }
  return value as QueryAudience
}
