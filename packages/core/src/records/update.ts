import { qualify, quoteIdentifier } from '@basedb/naming'
import { loadAiDependents, staleAiAssignments } from '../ai/field.js'
import { isFileKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { type Action, type ActorGrants, SYSTEM_COLUMNS, decide } from '../rbac/decide.js'
import { loadFields, loadGrants, loadTarget } from '../rbac/loader.js'
import { ROW_ALIAS } from '../rbac/rows.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { refuseSynced } from '../sync/guard.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { assertLinkScope, linkScopeChecks } from './link-scope.js'
import { type ShapedField, shapeValues, shapedFields } from './values.js'

/**
 * Record updates and deletions — chapter 05 §4.3, chapter 08 §2.
 *
 * An update is never a full replacement: only the supplied fields are written.
 * Replacing the whole row would lose the values of fields the actor cannot see — a read
 * mask would turn into an eraser.
 */

export interface UpdateRecordOptions {
  readonly tableId: string
  readonly recordId: string
  readonly values: Readonly<Record<string, unknown>>
}

export interface DeleteRecordOptions {
  readonly tableId: string
  readonly recordId: string
}

export interface UpdatedRecord {
  readonly row: Record<string, unknown>
  readonly sql: string
  /** The write's transaction — what an undo names (chapter 16 §4). */
  readonly xact: string
  /** The readable `file` and `image` columns of `row`, whose entries a reader links to. */
  readonly fileColumns: readonly string[]
}

/** Physical location and mask, resolved once for any row operation. */
interface RowContext {
  readonly relation: string
  readonly names: Map<string, string>
  readonly readable: readonly string[]
  readonly writable: ReadonlySet<string>
  readonly readableNames: ReadonlySet<string>
  readonly shaped: ReadonlyMap<string, ShapedField>
  readonly fileColumns: readonly string[]
  /**
   * The rows the actor reaches, over the target aliased `"basedb_row"` (05 §16): a row
   * outside them is not found. Evaluated on the row as it was — a row may leave the
   * actor's rows by the change they make, as a task handed to a colleague does.
   */
  readonly rows: string
  readonly grants: ActorGrants
  /** The table's link fields, physical name → field id. */
  readonly links: ReadonlyMap<string, string>
}

async function prepare(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
  action: Action,
): Promise<RowContext> {
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, tableId)

  if (target === null) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })

  const decision = decide(ctx, grants, action, target)
  if (decision.verdict === 'INVISIBLE') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  }
  if (decision.verdict === 'FORBIDDEN') {
    throw new BasedbError('ADMIN_REQUIRED', { details: { table: tableId, action } })
  }
  await refuseSynced(exec, ctx, tableId)

  const fields = await loadFields(exec, tableId)
  const names = new Map([...fields].map(([id, f]) => [id, f.name]))
  const location = await exec.query<{ schema_name: string; table_name: string }>(
    `SELECT sn.name AS schema_name, tn.name AS table_name
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1`,
    [tableId],
  )

  const readable = [...names].filter(([id]) => decision.readableFields.has(id)).map(([, n]) => n)

  return {
    relation: qualify(location[0].schema_name, location[0].table_name),
    names,
    // RETURNING names columns: a field computed at read time has none.
    readable: readable.filter(
      (n) => [...fields.values()].find((f) => f.name === n)?.stored !== false,
    ),
    writable: new Set(
      [...names].filter(([id]) => decision.writableFields.has(id)).map(([, n]) => n),
    ),
    readableNames: new Set(readable),
    shaped: shapedFields(fields),
    fileColumns: [...fields]
      .filter(([id, f]) => decision.readableFields.has(id) && isFileKind(f.kind))
      .map(([, f]) => f.name),
    rows: decision.rowPredicate,
    grants,
    links: new Map(
      [...fields]
        .filter(([, f]) => f.kind === 'link' || f.kind === 'multi_link')
        .map(([id, f]) => [f.name, id]),
    ),
  }
}

/** Partially updates a record, under the write mask. */
export async function updateRecord(
  pools: Pools,
  ctx: RequestContext,
  options: UpdateRecordOptions,
): Promise<UpdatedRecord> {
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const c = await prepare(exec, ctx, options.tableId, 'update')

      const assignments: string[] = []
      const params: unknown[] = []
      /** The parameter holding each assigned column's new value. */
      const placeholders = new Map<string, string>()
      const values = await shapeValues(exec, c.shaped, c.writable, options.values)

      for (const [name, value] of Object.entries(values)) {
        // Unknown field and invisible field: same response. Without this, an update
        // would become a way to enumerate hidden columns.
        if (!c.readableNames.has(name)) {
          throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: name } })
        }
        if (!c.writable.has(name)) {
          throw new BasedbError('FIELD_NOT_WRITABLE', { details: { field: name } })
        }
        params.push(value)
        placeholders.set(name, `$${params.length}`)
        assignments.push(`${quoteIdentifier(name)} = $${params.length}`)
      }

      if (assignments.length === 0) {
        throw new BasedbError('REQUIRED_VALUE_MISSING', {
          details: { reason: 'no writable value supplied' },
        })
      }

      // An AI cell answers for the values its prompt cites: change one, and the cell is
      // emptied for the worker to compute again (chapter 12 §1.5).
      const dependents = await loadAiDependents(exec, options.tableId)
      assignments.push(...staleAiAssignments(dependents, placeholders))

      // `_updated_at` and `_updated_by` are held by the kernel, never by the caller.
      params.push(ctx.actor.id)
      assignments.push(`"_updated_by" = $${params.length}`)
      assignments.push('"_updated_at" = pg_catalog.clock_timestamp()')

      params.push(options.recordId)
      const returning = [...SYSTEM_COLUMNS, ...c.readable].map((x) => quoteIdentifier(x)).join(', ')
      const links = await linkScopeChecks(exec, ctx, c.grants, c.links, values)

      return {
        links,
        sql: `UPDATE ${c.relation} AS ${quoteIdentifier(ROW_ALIAS)}
   SET ${assignments.join(',\n       ')}
 WHERE "_id" = $${params.length}
   AND ( /*predicat_lignes*/ ${c.rows} )
RETURNING ${returning};`,
        params,
        fileColumns: c.fileColumns,
      }
    },
    { readOnly: true },
  )

  // With the actor, so that the history names who changed the row (chapter 07 §2.1).
  const { rows, xact } = await withTransaction(pools, 'data', ctx, async (exec) => {
    await assertLinkScope(exec, plan.links)
    return {
      rows: await exec.query(plan.sql, plan.params, 'update'),
      xact: await currentXact(exec),
    }
  })

  const row = rows[0]
  // A missing row and an invisible row return the same code: the caller does not learn
  // that a record exists elsewhere.
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: options.recordId } })
  }
  return { row, sql: plan.sql, fileColumns: plan.fileColumns, xact }
}

/**
 * Deletes a record.
 *
 * Deleting a ROW is physical — it is deleting a FIELD or a TABLE that is logical
 * (chapter 06). A row still referenced by a foreign key is refused by PostgreSQL, and
 * the executor translates that refusal into `ROW_REFERENCED`.
 */
export async function deleteRecord(
  pools: Pools,
  ctx: RequestContext,
  options: DeleteRecordOptions,
): Promise<{ readonly deleted: string; readonly sql: string; readonly xact: string }> {
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const c = await prepare(exec, ctx, options.tableId, 'delete')
      return {
        sql: `DELETE FROM ${c.relation} AS ${quoteIdentifier(ROW_ALIAS)}
 WHERE "_id" = $1 AND ( /*predicat_lignes*/ ${c.rows} )
RETURNING "_id";`,
        params: [options.recordId],
      }
    },
    { readOnly: true },
  )

  // With the actor, so that the history names who deleted the row (chapter 07 §2.1).
  const { rows, xact } = await withTransaction(pools, 'data', ctx, async (exec) => ({
    rows: await exec.query<{ _id: string }>(plan.sql, plan.params, 'delete'),
    xact: await currentXact(exec),
  }))

  const row = rows[0]
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: options.recordId } })
  }
  return { deleted: row._id, sql: plan.sql, xact }
}

/**
 * The identity of the transaction under way — the `xact_id` its writes are captured
 * with (chapter 07 §3.1), which an undo names (chapter 16 §4).
 */
export async function currentXact(exec: Executor): Promise<string> {
  const [row] = await exec.query<{ xact: string }>(
    'SELECT pg_catalog.pg_current_xact_id()::text AS xact',
  )
  return row?.xact ?? ''
}
