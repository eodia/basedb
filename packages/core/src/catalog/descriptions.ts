import { sqlCommentOnColumn, sqlCommentOnTable } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { loadGrants } from '../rbac/loader.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { commentText, normalizeDescription } from './description.js'
import { assertManageSchema } from './lifecycle.js'

/**
 * Editing the description of a table or of a field — chapter 06 §1.1.
 *
 * Like a label, a description belongs to the catalog register: one row, no migration, no
 * lock worth the name. It is not free, though. The catalog row is one half of the story
 * and the `COMMENT ON` in the user's schema is the other — the only thing a person exploring
 * the database in `psql` ever reads — and the two must say the same thing. Hence both are
 * written in the SAME transaction, on the `ddl` pool.
 *
 * The version trigger of `table_def` and `field` moves `catalog_version` on any UPDATE, so
 * the projection, and with it the documentation, the OpenAPI specification and the MCP
 * description, follow without anyone flushing a cache. The description of a BASE is
 * `updateBase`'s business, since `base` carries no such trigger.
 */

/** Where a table lives, for the comment and for the permission check. */
interface TableLocation extends Record<string, unknown> {
  readonly base_id: string
  readonly label: string
  readonly table_name: string
  readonly schema_name: string
}

export async function setTableDescription(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly description: string | null },
): Promise<{ readonly description: string | null }> {
  const description = normalizeDescription(request.description)

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    const [table] = await exec.query<TableLocation>(
      `SELECT t.base_id, t.label, tn.name AS table_name, sn.name AS schema_name
         FROM _basedb.table_def t
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
        WHERE t.id = $1 AND t.is_live`,
      [request.tableId],
    )
    if (table === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
    }

    await assertManageSchema(exec, ctx, await loadGrants(exec, ctx), table.base_id)

    await exec.query(
      `UPDATE _basedb.table_def
          SET description = $2, updated_at = clock_timestamp(), updated_by = $3
        WHERE id = $1`,
      [request.tableId, description, ctx.actor.id],
      'update',
    )
    await exec.query(
      sqlCommentOnTable(table.schema_name, table.table_name, commentText(table.label, description)),
      [],
      'ddl',
    )

    return { description }
  })
}

interface FieldLocation extends TableLocation {
  readonly column_name: string
  readonly field_label: string
}

export async function setFieldDescription(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string; readonly description: string | null },
): Promise<{ readonly description: string | null }> {
  const description = normalizeDescription(request.description)

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    const [field] = await exec.query<FieldLocation>(
      `SELECT f.base_id, f.label AS field_label, t.label,
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

    await exec.query(
      `UPDATE _basedb.field
          SET description = $2, updated_at = clock_timestamp(), updated_by = $3
        WHERE id = $1`,
      [request.fieldId, description, ctx.actor.id],
      'update',
    )
    await exec.query(
      sqlCommentOnColumn(
        field.schema_name,
        field.table_name,
        field.column_name,
        commentText(field.field_label, description),
      ),
      [],
      'ddl',
    )

    return { description }
  })
}
