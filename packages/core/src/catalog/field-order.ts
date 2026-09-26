import { BasedbError } from '../errors/index.js'
import { requireOnTable } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The order of a table's fields — chapter 04 §1.1.
 *
 * It is the CATALOG's order, `field.position`: the order the grid opens with, the API
 * lists, the documentation and the agents read. It is not PostgreSQL's — a column's place
 * in the relation is fixed at `ADD COLUMN`, and moving it would mean rewriting the table
 * under an exclusive lock for a purely visual change. `SELECT *` in psql keeps the order
 * of creation; everything basedb shows follows this one.
 *
 * The five system columns have no place here: they carry no `field` row and are always
 * shown first.
 */

export interface ReorderedFields {
  /** Every live field of the table, by physical name, in its new order. */
  readonly order: readonly string[]
}

export async function reorderFields(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly names: readonly string[] },
): Promise<ReorderedFields> {
  const names = request.names
  if (!Array.isArray(names) || names.length === 0 || names.some((n) => typeof n !== 'string')) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'fields' } })
  }
  const repeated = names.find((n, i) => names.indexOf(n) !== i)
  if (repeated !== undefined) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'fields', reason: 'doublon', detail: repeated },
    })
  }

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    // Arranging the columns is building the table: `manage_schema` (chapter 05 §8).
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const fields = await exec.query<{ id: string; name: string; position: number }>(
      `SELECT f.id, n.name, f.position
         FROM _basedb.field f
         JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL
        ORDER BY f.position, f.created_at`,
      [request.tableId],
    )
    const byName = new Map(fields.map((f) => [f.name, f]))
    const unknown = names.find((n) => !byName.has(n))
    if (unknown !== undefined) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'fields', reason: 'champ_inconnu', detail: unknown },
      })
    }

    // Fields the list does not name — added meanwhile by someone else — keep their
    // relative order after the ones it does: a stale screen cannot lose a column.
    const named = new Set(names)
    const order = [...names, ...fields.filter((f) => !named.has(f.name)).map((f) => f.name)]

    for (const [index, name] of order.entries()) {
      const field = byName.get(name)
      if (field === undefined || field.position === index + 1) continue
      // The position index is not unique: rows may pass through equal positions while
      // they are renumbered, and the version trigger moves `catalog_version` for readers.
      await exec.query(
        `UPDATE _basedb.field
            SET position = $2, updated_at = clock_timestamp(), updated_by = $3
          WHERE id = $1`,
        [field.id, index + 1, ctx.actor.id],
        'update',
      )
    }
    return { order }
  })
}
