import type { QuestionQuery, Visualization } from '@basedb/contracts'
import { BasedbError } from '../errors/index.js'
import { requireOnBase } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
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
 * Saved questions — chapter 18 §3: a reading of a base, named, with the way it is shown.
 * Built with the mouse or written in SQL; the dashboards place them, and a question opened
 * alone is explored from there.
 *
 * Kept as dashboards are: whoever sees the base sees its questions, whoever builds it
 * writes them. A question carries no right — each reader runs it with their own — so its
 * list is the same for all, and the answers are not.
 */

export interface Question {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly kind: 'builder' | 'sql'
  readonly query: QuestionQuery
  readonly visualization: Visualization
  readonly position: number
  readonly updatedAt: string
  readonly updatedBy: { readonly id: string; readonly name: string }
}

export interface QuestionInput {
  readonly label?: unknown
  readonly description?: unknown
  readonly query?: unknown
  readonly visualization?: unknown
  readonly position?: unknown
}

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly kind: 'builder' | 'sql'
  readonly query: QuestionQuery
  readonly visualization: Visualization
  readonly position: number
  readonly updated_at: string
  readonly updated_by: string
  readonly updater: string | null
}

const SELECT = `
  SELECT q.id::text, q.label, q.description, q.kind, q.query, q.visualization, q.position,
         q.updated_at::text, q.updated_by::text, u.display_name AS updater
    FROM _basedb.question q
    LEFT JOIN _basedb.app_user u ON u.id = q.updated_by`

const shaped = (r: Row): Question => ({
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
  updatedAt: r.updated_at,
  updatedBy: { id: r.updated_by, name: r.updater ?? '' },
})

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
      await requireSeesBase(exec, ctx, request.baseId)
      const rows = await exec.query<Row>(
        `${SELECT}
          WHERE q.base_id = $1 AND q.deleted_at IS NULL
          ORDER BY q.position, q.created_at`,
        [request.baseId],
      )
      return rows.map(shaped)
    },
    { readOnly: true },
  )
}

export async function createQuestion(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly input: QuestionInput },
): Promise<Question> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const label = text(request.input.label, 255)
    if (label === '') throw invalid('label', 'libelle_invalide')
    const query = checkedQuery(request.input.query, await tablesOf(exec, request.baseId), 'query')
    const visualization: Visualization =
      request.input.visualization === undefined
        ? { type: 'table' }
        : checkedVisualization(request.input.visualization, 'visualization')
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.question
         (base_id, label, description, kind, query, visualization, position, created_by, updated_by)
       SELECT $1, $2, $3, $4, $5::jsonb, $6::jsonb, coalesce(max(position), 0) + 1, $7, $7
         FROM _basedb.question WHERE base_id = $1 AND deleted_at IS NULL
       RETURNING id::text`,
      [
        request.baseId,
        label,
        text(request.input.description, 2000) || null,
        query.kind,
        JSON.stringify(query),
        JSON.stringify(visualization),
        ctx.actor.id,
      ],
      'insert',
    )
    const [created] = await exec.query<Row>(`${SELECT} WHERE q.id = $1`, [row?.id])
    return shaped(created as Row)
  })
}

export async function updateQuestion(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string; readonly input: QuestionInput },
): Promise<Question> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const [found] = await exec.query<Row>(
      `${SELECT} WHERE q.id::text = $1 AND q.base_id = $2 AND q.deleted_at IS NULL`,
      [request.id, request.baseId],
    )
    if (found === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { question: request.id } })
    }
    const current = shaped(found)
    const input = request.input
    const label = input.label === undefined ? current.label : text(input.label, 255)
    if (label === '') throw invalid('label', 'libelle_invalide')
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
    await exec.query(
      `UPDATE _basedb.question
          SET label = $2, description = $3, kind = $4, query = $5::jsonb,
              visualization = $6::jsonb, position = $7, updated_by = $8,
              updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1`,
      [
        found.id,
        label,
        description,
        query.kind,
        JSON.stringify(query),
        JSON.stringify(visualization),
        position,
        ctx.actor.id,
      ],
      'update',
    )
    const [row] = await exec.query<Row>(`${SELECT} WHERE q.id = $1`, [found.id])
    return shaped(row as Row)
  })
}

/**
 * Deletes a question. A dashboard card that placed it then says the question is gone:
 * a dashboard is not rewritten behind its builder's back.
 */
export async function deleteQuestion(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const rows = await exec.query(
      `UPDATE _basedb.question SET deleted_at = pg_catalog.clock_timestamp()
        WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [request.id, request.baseId],
      'update',
    )
    if (rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { question: request.id } })
    }
  })
}

/**
 * One saved question, for whoever sees its base — what a card placing it runs. The query
 * comes from the catalog, never from the caller: a card cannot make a question say
 * something else than what its builder saved.
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
      await requireSeesBase(exec, ctx, request.baseId)
      const [row] = await exec.query<Row>(
        `${SELECT} WHERE q.id::text = $1 AND q.base_id = $2 AND q.deleted_at IS NULL`,
        [request.id, request.baseId],
      )
      if (row === undefined) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { question: request.id } })
      }
      return shaped(row)
    },
    { readOnly: true },
  )
}
