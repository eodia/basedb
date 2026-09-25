import { sqlCommentOnColumn } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { loadGrants } from '../rbac/loader.js'
import { requireOnField } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { commentText } from './description.js'
import { assertManageSchema } from './lifecycle.js'
import { labelKey } from './operations.js'

/**
 * Renaming a field — chapter 06 §1.1.
 *
 * It renames the LABEL, the name a person reads, and never the column: the physical name
 * is allocated once and kept, so a view, an export or a `psql` script written against it
 * keeps working after someone corrects a typo on the screen. That is the whole point of
 * having two registers, and the reason this is one `UPDATE` and not a migration.
 *
 * The label is also what the column's `COMMENT ON` says when the field has no description,
 * so the comment is rewritten in the same transaction — the catalog and `psql` must never
 * disagree about what the column is called.
 */

const MAX_LABEL_CHARS = 255

interface FieldRow extends Record<string, unknown> {
  readonly base_id: string
  readonly table_id: string
  readonly label: string
  readonly description: string | null
  readonly column_name: string
  readonly table_name: string
  readonly schema_name: string
}

export async function setFieldLabel(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string; readonly label: string },
): Promise<{ readonly label: string }> {
  const label = request.label.trim()
  if (label === '') throw new BasedbError('LABEL_EMPTY', { details: { field: request.fieldId } })
  if ([...label].length > MAX_LABEL_CHARS) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: MAX_LABEL_CHARS } })
  }

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    // Building is `manage_schema` on the table (chapter 05 §8).
    await requireOnField(exec, ctx, 'manage_schema', request.fieldId)
    const [field] = await exec.query<FieldRow>(
      `SELECT f.base_id, f.table_id, f.label, f.description,
              cn.name AS column_name, tn.name AS table_name, sn.name AS schema_name
         FROM _basedb.field f
         JOIN _basedb.physical_name cn ON cn.id = f.name_id
         JOIN _basedb.table_def t      ON t.id = f.table_id
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
        WHERE f.id = $1 AND f.is_live AND t.is_live`,
      [request.fieldId],
    )
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.fieldId } })
    }

    await assertManageSchema(exec, ctx, await loadGrants(exec, ctx), field.base_id)

    if (field.label === label) return { label }

    // The uniqueness index is partial on `deleted_at IS NULL`: a label freed by a deletion
    // is available again. Caught here to name the conflict instead of surfacing a
    // constraint violation.
    const clash = await exec.query<{ id: string }>(
      `SELECT id FROM _basedb.field
        WHERE table_id = $1 AND label_key = $2 AND deleted_at IS NULL AND id <> $3`,
      [field.table_id, labelKey(label), request.fieldId],
    )
    if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })

    await exec.query(
      `UPDATE _basedb.field
          SET label = $2, label_key = $3, updated_at = clock_timestamp(), updated_by = $4
        WHERE id = $1`,
      [request.fieldId, label, labelKey(label), ctx.actor.id],
      'update',
    )
    await exec.query(
      sqlCommentOnColumn(
        field.schema_name,
        field.table_name,
        field.column_name,
        commentText(label, field.description),
      ),
      [],
      'ddl',
    )

    return { label }
  })
}
