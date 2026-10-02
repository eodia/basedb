import { BasedbError } from '../errors/index.js'
import { requireOnTable } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type DocumentSpec, normalizeSpec, readSpec } from './spec.js'

/**
 * The document templates of a table — chapter 21 §2. Whoever reads the table sees their
 * names, to print a row with one; whoever builds the table (`manage_schema`) writes them,
 * and reads their definition — which names columns a reader may not see.
 */

export interface DocumentTemplate {
  readonly id: string
  readonly tableId: string
  readonly label: string
  /** Given to whoever builds the table; `null` to a reader. */
  readonly spec: DocumentSpec | null
  readonly position: number
  readonly updatedAt: string
}

interface TemplateRow extends Record<string, unknown> {
  readonly id: string
  readonly table_id: string
  readonly label: string
  readonly spec: unknown
  readonly position: number
  readonly updated_at: string
}

/** A template as stored, its definition read as it reads today — settings added since at their default. */
const ofRow = (row: TemplateRow, withSpec: boolean): DocumentTemplate => ({
  id: row.id,
  tableId: row.table_id,
  label: row.label,
  spec: withSpec ? readSpec(row.spec) : null,
  position: row.position,
  updatedAt: row.updated_at,
})

function checkedLabel(label: unknown): string {
  const text = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : ''
  if (text === '' || text.length > 120) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'label', reason: 'libelle_invalide' },
    })
  }
  return text
}

export async function listDocumentTemplates(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string },
): Promise<DocumentTemplate[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnTable(exec, ctx, 'read', request.tableId)
      let builds = true
      try {
        await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
      } catch {
        builds = false
      }
      const rows = await exec.query<TemplateRow>(
        `SELECT id::text, table_id::text, label, spec, position, updated_at::text
           FROM _basedb.document_template WHERE table_id = $1
          ORDER BY position, label`,
        [request.tableId],
      )
      return rows.map((r) => ofRow(r, builds))
    },
    { readOnly: true },
  )
}

/** One template, for rendering it: its table's read right is checked by the rendering. */
export async function readTemplate(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly id: string },
): Promise<DocumentTemplate> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnTable(exec, ctx, 'read', request.tableId)
      const [row] = await exec.query<TemplateRow>(
        `SELECT id::text, table_id::text, label, spec, position, updated_at::text
           FROM _basedb.document_template WHERE id::text = $1 AND table_id = $2`,
        [request.id, request.tableId],
      )
      if (row === undefined) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { template: request.id } })
      }
      return ofRow(row, true)
    },
    { readOnly: true },
  )
}

export async function createDocumentTemplate(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly label: unknown; readonly spec: unknown },
): Promise<DocumentTemplate> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const label = checkedLabel(request.label)
    const spec = await normalizeSpec(exec, request.tableId, request.spec)
    const [row] = await exec.query<TemplateRow>(
      `INSERT INTO _basedb.document_template (table_id, label, spec, position, created_by, updated_by)
       SELECT $1, $2, $3::jsonb, coalesce(max(position) + 1, 0), $4, $4
         FROM _basedb.document_template WHERE table_id = $1
       RETURNING id::text, table_id::text, label, spec, position, updated_at::text`,
      [
        request.tableId,
        label,
        JSON.stringify(spec),
        ctx.actor.kind === 'user' ? ctx.actor.id : null,
      ],
      'insert',
    )
    return ofRow(row as TemplateRow, true)
  })
}

export async function updateDocumentTemplate(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly id: string
    readonly label?: unknown
    readonly spec?: unknown
  },
): Promise<DocumentTemplate> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const label = request.label === undefined ? null : checkedLabel(request.label)
    const spec =
      request.spec === undefined ? null : await normalizeSpec(exec, request.tableId, request.spec)
    const [row] = await exec.query<TemplateRow>(
      `UPDATE _basedb.document_template
          SET label = coalesce($3, label), spec = coalesce($4::jsonb, spec),
              updated_at = clock_timestamp(), updated_by = $5
        WHERE id::text = $1 AND table_id = $2
        RETURNING id::text, table_id::text, label, spec, position, updated_at::text`,
      [
        request.id,
        request.tableId,
        label,
        spec === null ? null : JSON.stringify(spec),
        ctx.actor.kind === 'user' ? ctx.actor.id : null,
      ],
      'update',
    )
    if (row === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { template: request.id } })
    }
    return ofRow(row, true)
  })
}

export async function deleteDocumentTemplate(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly id: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const rows = await exec.query(
      'DELETE FROM _basedb.document_template WHERE id::text = $1 AND table_id = $2 RETURNING id',
      [request.id, request.tableId],
      'delete',
    )
    if (rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { template: request.id } })
    }
  })
}
