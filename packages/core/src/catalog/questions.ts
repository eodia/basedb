import type { QuestionQuery, Visualization } from '@basedb/contracts'
import { writeAudit } from '../audit/journal.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import { loadBaseTarget } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import {
  checkedQuery,
  checkedVisualization,
  invalid,
  requireSeesBase,
  tablesOf,
  text,
} from './dashboards.js'

/**
 * Saved questions — chapter 18 §1: a reading of a base, named, built with the mouse or
 * written in SQL, with the way it is shown — a table, a figure, a chart. The dashboards
 * place them; a tab of the workspace opens one too (chapter 11 §1.7).
 *
 * Three audiences, as saved queries have. `personal`: its author alone sees it, with the
 * mere right to read the base. `base`: whoever reads the base. `groups`: the members of
 * chosen groups, and whoever manages the base. Sharing one is building the base, as a
 * collaborative view is (05 §9): `manage_schema` on it. A dashboard card places only a
 * question of the whole base, so that whoever sees the dashboard sees what the card runs.
 *
 * A question carries no right. Whoever opens it runs it with their own, read only: a SQL
 * question on their own PostgreSQL role, a built one on the read plans of the data routes.
 */

export const QUESTION_AUDIENCES = ['personal', 'base', 'groups'] as const
export type QuestionAudience = (typeof QUESTION_AUDIENCES)[number]

export interface Question {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly kind: 'builder' | 'sql'
  readonly query: QuestionQuery
  readonly visualization: Visualization
  readonly position: number
  readonly audience: QuestionAudience
  /** The groups a `groups` query is open to — empty for the two others. */
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
  readonly owner: { readonly id: string; readonly name: string }
  /** The caller wrote it. */
  readonly mine: boolean
  /** The caller may change it or delete it: its author when personal, a builder when shared. */
  readonly editable: boolean
  readonly updatedAt: string
  readonly updatedBy: { readonly id: string; readonly name: string }
}

export interface QuestionInput {
  readonly label?: unknown
  readonly description?: unknown
  readonly query?: unknown
  readonly visualization?: unknown
  readonly position?: unknown
  readonly audience?: unknown
  /** For `groups`: the groups, by catalog key. Ignored otherwise. */
  readonly groupIds?: unknown
}

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly kind: 'builder' | 'sql'
  readonly query: QuestionQuery
  readonly visualization: Visualization
  readonly position: number
  readonly audience: QuestionAudience
  readonly owner_id: string
  readonly owner_name: string | null
  readonly updated_at: string
  readonly updated_by: string
  readonly updater: string | null
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

const SELECT = `
  SELECT q.id::text, q.label, q.description, q.kind, q.query, q.visualization, q.position,
         q.audience, q.created_by::text AS owner_id, o.display_name AS owner_name,
         q.updated_at::text, q.updated_by::text, u.display_name AS updater,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id::text, 'label', r.label)
                                    ORDER BY r.label)
                     FROM _basedb.question_role qr
                     JOIN _basedb.role r ON r.id = qr.role_id AND r.deleted_at IS NULL
                    WHERE qr.question_id = q.id), '[]'::jsonb) AS groups
    FROM _basedb.question q
    LEFT JOIN _basedb.app_user o ON o.id = q.created_by
    LEFT JOIN _basedb.app_user u ON u.id = q.updated_by`

/**
 * Who may see a question of a base they see — the one rule, written once in SQL: its author,
 * then according to its audience. `$2` is the caller, `$3` whether they manage the base.
 */
const VISIBLE = `
  (q.created_by::text = $2
   OR q.audience = 'base'
   OR (q.audience = 'groups'
       AND ($3::boolean OR EXISTS (
             SELECT 1 FROM _basedb.question_role qr
               JOIN _basedb.role_member m ON m.role_id = qr.role_id
              WHERE qr.question_id = q.id AND m.user_id::text = $2))))`

function shaped(r: Row, ctx: RequestContext, manages: boolean): Question {
  const mine = r.owner_id === ctx.actor.id
  return {
    id: r.id,
    label: r.label,
    description: r.description,
    kind: r.kind,
    query: r.query,
    visualization:
      typeof r.visualization === 'object' && r.visualization !== null && 'type' in r.visualization
        ? r.visualization
        : { type: 'table' },
    position: r.position,
    audience: r.audience,
    groups: r.audience === 'groups' ? r.groups : [],
    owner: { id: r.owner_id, name: r.owner_name ?? '' },
    mine,
    editable: ctx.actor.kind === 'user' && (r.audience === 'personal' ? mine : manages),
    updatedAt: r.updated_at,
    updatedBy: { id: r.updated_by, name: r.updater ?? '' },
  }
}

/**
 * What the caller may do on a base: see it — they read one of its tables, or they build
 * it — and manage it. A base they do not see answers as one that does not exist. A token
 * sees what its role reads, and manages nothing.
 */
async function access(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<{ readonly manages: boolean }> {
  await requireSeesBase(exec, ctx, baseId)
  if (ctx.actor.kind !== 'user') return { manages: false }
  const target = await loadBaseTarget(exec, ctx, baseId)
  if (target === null) return { manages: false }
  const grants = await loadGrants(exec, ctx)
  return { manages: decide(ctx, grants, 'manage_schema', target).verdict === 'ALLOWED' }
}

/** Writing a question is a person's: its author is an account. */
function requirePerson(ctx: RequestContext, baseId: string): void {
  if (ctx.actor.kind !== 'user') {
    throw new BasedbError('ADMIN_REQUIRED', { details: { base: baseId } })
  }
}

/** The queries of a base the caller may see, in their order. */
export async function listQuestions(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Question[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const { manages } = await access(exec, ctx, request.baseId)
      const rows = await exec.query<Row>(
        `${SELECT}
          WHERE q.base_id = $1::uuid AND q.deleted_at IS NULL AND ${VISIBLE}
          ORDER BY q.position, q.created_at`,
        [request.baseId, ctx.actor.id, manages],
      )
      return rows.map((row) => shaped(row, ctx, manages))
    },
    { readOnly: true },
  )
}

/**
 * One question of a base, for whoever may see it — what a tab opens, and what a card
 * placing it runs. The query comes from the catalog, never from the caller: a card cannot
 * make a question say something else than what its author saved.
 */
export async function getQuestion(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<Question> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const { manages } = await access(exec, ctx, request.baseId)
      return shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
    },
    { readOnly: true },
  )
}

export async function createQuestion(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly input: QuestionInput },
): Promise<Question> {
  requirePerson(ctx, request.baseId)
  const input = request.input
  const label = checkLabel(input.label)
  const audience = checkAudience(input.audience ?? 'personal')
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const { manages } = await access(exec, ctx, request.baseId)
    if (audience !== 'personal' && !manages) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
    }
    const groupIds = audience === 'groups' ? await checkGroups(exec, ctx, input.groupIds) : []
    const query = checkedQuery(input.query, await tablesOf(exec, request.baseId), 'query')
    const visualization: Visualization =
      input.visualization === undefined
        ? { type: 'table' }
        : checkedVisualization(input.visualization, 'visualization')
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.question
         (base_id, label, description, kind, query, visualization, position, audience,
          created_by, updated_by)
       SELECT $1, $2, $3, $4, $5::jsonb, $6::jsonb, coalesce(max(position), 0) + 1, $7, $8, $8
         FROM _basedb.question WHERE base_id = $1 AND deleted_at IS NULL
       RETURNING id::text`,
      [
        request.baseId,
        label,
        text(input.description, 2000) || null,
        query.kind,
        JSON.stringify(query),
        JSON.stringify(visualization),
        audience,
        ctx.actor.id,
      ],
      'insert',
    )
    const id = (row as { id: string }).id
    await writeGroups(exec, id, groupIds)
    await writeAudit(exec, ctx, {
      action: 'question.create',
      objectKind: 'question',
      objectId: id,
      objectName: label,
      baseId: request.baseId,
      payload: { audience, groups: groupIds, query },
    })
    return shaped(
      await visibleRow(exec, ctx, { baseId: request.baseId, id }, manages),
      ctx,
      manages,
    )
  })
}

export async function updateQuestion(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string; readonly input: QuestionInput },
): Promise<Question> {
  requirePerson(ctx, request.baseId)
  const input = request.input
  const label = input.label === undefined ? undefined : checkLabel(input.label)
  const audience = input.audience === undefined ? undefined : checkAudience(input.audience)
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const { manages } = await access(exec, ctx, request.baseId)
    const current = shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
    if (!current.editable) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { question: request.id } })
    }
    const nextAudience = audience ?? current.audience
    // Taking a question out of one's own hands, or putting a shared one back into them, is
    // deciding who sees it: a builder's decision on a shared base.
    if (nextAudience !== current.audience && !manages) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
    }
    // A card shows its query to whoever sees the dashboard: it keeps the whole base.
    if (current.audience === 'base' && nextAudience !== 'base') {
      const placed = await dashboardsPlacing(exec, request.baseId, current.id)
      if (placed.length > 0) {
        throw invalid('audience', 'dans_un_tableau_de_bord', placed)
      }
    }
    const description =
      input.description === undefined ? current.description : text(input.description, 2000) || null
    const query =
      input.query === undefined
        ? current.query
        : checkedQuery(input.query, await tablesOf(exec, request.baseId), 'query')
    const visualization =
      input.visualization === undefined
        ? current.visualization
        : checkedVisualization(input.visualization, 'visualization')
    const position =
      typeof input.position === 'number' ? Math.round(input.position) : current.position
    const groupIds =
      nextAudience !== 'groups'
        ? []
        : input.groupIds !== undefined || current.audience !== 'groups'
          ? await checkGroups(exec, ctx, input.groupIds)
          : null
    await exec.query(
      `UPDATE _basedb.question
          SET label = $2, description = $3, kind = $4, query = $5::jsonb,
              visualization = $6::jsonb, position = $7, audience = $8, updated_by = $9,
              updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1`,
      [
        current.id,
        label ?? current.label,
        description,
        query.kind,
        JSON.stringify(query),
        JSON.stringify(visualization),
        position,
        nextAudience,
        ctx.actor.id,
      ],
      'update',
    )
    if (groupIds !== null) {
      await exec.query(
        'DELETE FROM _basedb.question_role WHERE question_id = $1',
        [current.id],
        'delete',
      )
      await writeGroups(exec, current.id, groupIds)
    }
    await writeAudit(exec, ctx, {
      action: 'question.update',
      objectKind: 'question',
      objectId: current.id,
      objectName: label ?? current.label,
      baseId: request.baseId,
      payload: {
        audience: nextAudience,
        ...(groupIds === null ? {} : { groups: groupIds }),
        ...(input.query === undefined ? {} : { query }),
      },
    })
    return shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
  })
}

/**
 * Deletes a question. A dashboard card that placed it then says the question is gone: a
 * dashboard is not rewritten behind its builder's back. The query goes into the journal.
 */
export async function deleteQuestion(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<void> {
  requirePerson(ctx, request.baseId)
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const { manages } = await access(exec, ctx, request.baseId)
    const current = shaped(await visibleRow(exec, ctx, request, manages), ctx, manages)
    if (!current.editable) {
      throw new BasedbError('ADMIN_REQUIRED', { details: { question: request.id } })
    }
    await exec.query(
      'UPDATE _basedb.question SET deleted_at = pg_catalog.clock_timestamp() WHERE id = $1',
      [current.id],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'question.delete',
      objectKind: 'question',
      objectId: current.id,
      objectName: current.label,
      baseId: request.baseId,
      payload: { audience: current.audience, query: current.query },
    })
  })
}

/** The row, when the caller may see it; otherwise the same answer as no row at all. */
async function visibleRow(
  exec: Executor,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
  manages: boolean,
): Promise<Row> {
  const [row] = await exec.query<Row>(
    `${SELECT}
      WHERE q.id::text = $4 AND q.base_id = $1::uuid AND q.deleted_at IS NULL AND ${VISIBLE}`,
    [request.baseId, ctx.actor.id, manages, request.id],
  )
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { question: request.id } })
  }
  return row
}

/** The labels of the live dashboards of a base whose cards place a query, or whose texts cite it. */
async function dashboardsPlacing(
  exec: Executor,
  baseId: string,
  questionId: string,
): Promise<string[]> {
  const rows = await exec.query<{ label: string }>(
    `SELECT d.label FROM _basedb.dashboard d
      WHERE d.base_id = $1 AND d.deleted_at IS NULL
        AND (d.cards @> jsonb_build_array(jsonb_build_object('question', $2::text))
          OR d.cards @> jsonb_build_array(jsonb_build_object('variables',
               jsonb_build_array(jsonb_build_object('question', $2::text)))))
      ORDER BY d.position, d.label`,
    [baseId, questionId],
  )
  return rows.map((r) => r.label)
}

async function writeGroups(exec: Executor, questionId: string, groupIds: readonly string[]) {
  if (groupIds.length === 0) return
  await exec.query(
    `INSERT INTO _basedb.question_role (question_id, role_id)
     SELECT $1::uuid, g::uuid FROM unnest($2::text[]) AS g
     ON CONFLICT DO NOTHING`,
    [questionId, groupIds],
    'insert',
  )
}

/** The groups named, each a live group of the tenant; at least one. */
async function checkGroups(
  exec: Executor,
  ctx: RequestContext,
  raw: unknown,
): Promise<readonly string[]> {
  const list = Array.isArray(raw) ? raw : []
  const asked = [...new Set(list.filter((g): g is string => typeof g === 'string' && g !== ''))]
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

function checkLabel(value: unknown): string {
  const label = typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim() : ''
  if (label === '') throw invalid('label', 'libelle_invalide')
  if ([...label].length > 255) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: 255 } })
  }
  return label
}

function checkAudience(value: unknown): QuestionAudience {
  if (typeof value !== 'string' || !(QUESTION_AUDIENCES as readonly string[]).includes(value)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'audience' } })
  }
  return value as QuestionAudience
}
