import { checkConstraintName, qualify, quoteIdentifier } from '@basedb/naming'
import { emailCheck, urlCheck } from '../ddl/emit.js'
import { allocateName } from '../naming/allocation.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * The constraint of a `url` or an `email` field — chapter 04, « Lien URL », « E-mail ».
 *
 * A text column the interface draws as a link, and that direct SQL is held to as well. For
 * a URL: an `http(s)` address or a `mailto:`, 2 048 characters at most — without the
 * `CHECK`, the first `UPDATE` written in psql could put `javascript:…` in a cell every
 * reader then clicks. For an e-mail: one address, 254 characters at most.
 */

type Where = {
  readonly tableId: string
  readonly baseId: string
  readonly tableName: string
  readonly schemaName: string
}

const BODIES: Readonly<Record<'url' | 'email', (column: string) => string>> = {
  url: urlCheck,
  email: emailCheck,
}

export async function addPatternCheck(
  exec: Executor,
  ctx: RequestContext,
  where: Where,
  fieldId: string,
  columnName: string,
  rule: 'url' | 'email',
): Promise<readonly string[]> {
  const name = await allocateName(exec, ctx, {
    derivedName: checkConstraintName(where.tableName, columnName, rule),
    objectKind: 'constraint',
    scopeKind: 'table',
    scopeId: where.tableId,
  })
  const [constraint] = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.table_constraint
       (table_id, base_id, kind, name_id, rule, origin, state, created_by)
     VALUES ($1, $2, 'check', $3, $4, 'system', 'active', $5) RETURNING id`,
    [where.tableId, where.baseId, name.nameId, rule, ctx.actor.id],
    'insert',
  )
  await exec.query(
    `INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
     VALUES ($1, $2, $3, 1)`,
    [constraint.id, fieldId, where.tableId],
    'insert',
  )
  // Born on an empty column — or with its table — hence valid at once.
  const statement = `ALTER TABLE ${qualify(where.schemaName, where.tableName)} ADD CONSTRAINT ${quoteIdentifier(name.name)} CHECK (${BODIES[rule](quoteIdentifier(columnName))});`
  await exec.query(statement, [], 'ddl')
  return [statement]
}

export function addUrlCheck(
  exec: Executor,
  ctx: RequestContext,
  where: Where,
  fieldId: string,
  columnName: string,
): Promise<readonly string[]> {
  return addPatternCheck(exec, ctx, where, fieldId, columnName, 'url')
}
