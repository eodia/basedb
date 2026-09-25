import { sqlCommentOnTable } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { loadGrants } from '../rbac/loader.js'
import { requireOnTable } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { commentText } from './description.js'
import { assertManageSchema } from './lifecycle.js'
import { type Look, type LookInput, normalizeLook, touchesLook } from './look.js'
import { labelKey } from './operations.js'

/**
 * Editing a table — its label and its look (chapter 06 §1.1, chapter 02).
 *
 * The same register as a field's label: the name a person reads, never the relation's.
 * The table keeps its physical name, so every view, export and `psql` script written
 * against it keeps working after a rename on the screen. One `UPDATE` of `table_def`,
 * whose version trigger moves `catalog_version`, and — when the label moves — the
 * `COMMENT ON TABLE` rewritten in the same transaction, since it is what `psql` shows.
 */

const MAX_LABEL_CHARS = 255

interface TableRow extends Record<string, unknown> {
  readonly base_id: string
  readonly label: string
  readonly description: string | null
  readonly table_name: string
  readonly schema_name: string
}

export interface UpdatedTable extends Look {
  readonly label: string
}

export async function updateTable(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly label?: string
    /** Replaces the whole look when any of its keys is named, like `updateBase`. */
    readonly look?: LookInput
  },
): Promise<UpdatedTable> {
  const label = request.label?.trim()
  if (label !== undefined) {
    if (label === '') throw new BasedbError('LABEL_EMPTY', { details: { table: request.tableId } })
    if ([...label].length > MAX_LABEL_CHARS) {
      throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: MAX_LABEL_CHARS } })
    }
  }
  const setsLook = request.look !== undefined && touchesLook(request.look)
  const look = setsLook
    ? normalizeLook(
        request.look as LookInput,
        (reason) => new BasedbError('REQUEST_INVALID', { details: { field: 'look', reason } }),
      )
    : null

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    // Building is `manage_schema` on the table (chapter 05 §8).
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const [table] = await exec.query<TableRow>(
      `SELECT t.base_id, t.label, t.description, tn.name AS table_name, sn.name AS schema_name
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

    const renames = label !== undefined && label !== table.label
    if (renames) {
      // Unique among the base's live tables: the index is partial on `deleted_at IS NULL`,
      // so a label freed by a deletion is available again. Named here rather than
      // surfaced as a constraint violation.
      const clash = await exec.query<{ id: string }>(
        `SELECT id FROM _basedb.table_def
          WHERE base_id = $1 AND label_key = $2 AND deleted_at IS NULL AND id <> $3`,
        [table.base_id, labelKey(label), request.tableId],
      )
      if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
    }

    const [row] = await exec.query<UpdatedTable & Record<string, unknown>>(
      `UPDATE _basedb.table_def
          SET label = CASE WHEN $2::boolean THEN $3::text ELSE label END,
              label_key = CASE WHEN $2::boolean THEN $4::text ELSE label_key END,
              color = CASE WHEN $5::boolean THEN $6::text ELSE color END,
              icon = CASE WHEN $5::boolean THEN $7::text ELSE icon END,
              image = CASE WHEN $5::boolean THEN $8::text ELSE image END,
              updated_at = clock_timestamp(), updated_by = $9
        WHERE id = $1
        RETURNING label, color, icon, image`,
      [
        request.tableId,
        renames,
        label ?? null,
        label === undefined ? null : labelKey(label),
        setsLook,
        look?.color ?? null,
        look?.icon ?? null,
        look?.image ?? null,
        ctx.actor.id,
      ],
      'update',
    )

    if (renames) {
      await exec.query(
        sqlCommentOnTable(
          table.schema_name,
          table.table_name,
          commentText(row.label, table.description),
        ),
        [],
        'ddl',
      )
    }

    return { label: row.label, color: row.color, icon: row.icon, image: row.image }
  })
}
