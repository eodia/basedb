import { checkConstraintName, qualify, quoteIdentifier } from '@basedb/naming'
import { urlCheck } from '../ddl/emit.js'
import { allocateName } from '../naming/allocation.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * The constraint of a `url` field — chapter 04, « Lien URL ».
 *
 * A text column the interface draws as a link, and that direct SQL is held to as well: an
 * `http(s)` address or a `mailto:`, 2 048 characters at most. Without the `CHECK`, the
 * first `UPDATE` written in psql could put `javascript:…` in a cell every reader then
 * clicks — the one value a hyperlink column must never hold.
 */
export async function addUrlCheck(
  exec: Executor,
  ctx: RequestContext,
  where: {
    readonly tableId: string
    readonly baseId: string
    readonly tableName: string
    readonly schemaName: string
  },
  fieldId: string,
  columnName: string,
): Promise<readonly string[]> {
  const name = await allocateName(exec, ctx, {
    derivedName: checkConstraintName(where.tableName, columnName, 'url'),
    objectKind: 'constraint',
    scopeKind: 'table',
    scopeId: where.tableId,
  })
  const [constraint] = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.table_constraint
       (table_id, base_id, kind, name_id, rule, origin, state, created_by)
     VALUES ($1, $2, 'check', $3, 'url', 'system', 'active', $4) RETURNING id`,
    [where.tableId, where.baseId, name.nameId, ctx.actor.id],
    'insert',
  )
  await exec.query(
    `INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
     VALUES ($1, $2, $3, 1)`,
    [constraint.id, fieldId, where.tableId],
    'insert',
  )
  // Born on an empty column — or with its table — hence valid at once.
  const statement = `ALTER TABLE ${qualify(where.schemaName, where.tableName)} ADD CONSTRAINT ${quoteIdentifier(name.name)} CHECK (${urlCheck(quoteIdentifier(columnName))});`
  await exec.query(statement, [], 'ddl')
  return [statement]
}
