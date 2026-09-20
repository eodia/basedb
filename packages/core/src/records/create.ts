import { qualify, quoteIdentifier } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { SYSTEM_COLUMNS, decide } from '../rbac/decide.js'
import { loadFieldNames, loadGrants, loadTarget } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Record writes — chapter 05 §4.3, chapter 08 §2.
 *
 * Two distinct masks, and this is essential: the `RETURNING` clause is projected with
 * the READ mask, never with the write one (§6.2, mechanism 2). Without that
 * distinction, writing to a read-only field would make it reappear in the response, and
 * a write would become a read channel.
 */

export interface CreateRecordOptions {
  readonly tableId: string
  /** Values by physical field name. A field outside the mask is a refusal, not an omission. */
  readonly values: Readonly<Record<string, unknown>>
}

export interface CreatedRecord {
  readonly row: Record<string, unknown>
  readonly sql: string
}

/**
 * Creates a record.
 *
 * A field absent from the write mask FAILS the operation instead of being silently
 * dropped: accepting a request while discarding part of what it asks would let the
 * caller believe their write went through as submitted.
 */
export async function createRecord(
  pools: Pools,
  ctx: RequestContext,
  options: CreateRecordOptions,
): Promise<CreatedRecord> {
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => buildWritePlan(exec, ctx, options),
    { readOnly: true },
  )

  const rows = await pools.withConnection('data', (exec) =>
    exec.query(plan.sql, plan.params, 'insert'),
  )

  const row = rows[0]
  if (row === undefined) {
    throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'insert without RETURNING' } })
  }
  return { row, sql: plan.sql }
}

interface WritePlan {
  readonly sql: string
  readonly params: readonly unknown[]
}

async function buildWritePlan(
  exec: Executor,
  ctx: RequestContext,
  options: CreateRecordOptions,
): Promise<WritePlan> {
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, options.tableId)

  if (target === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: options.tableId } })
  }

  const decision = decide(ctx, grants, 'create', target)
  if (decision.verdict === 'INVISIBLE') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: options.tableId } })
  }
  if (decision.verdict === 'FORBIDDEN') {
    throw new BasedbError('ADMIN_REQUIRED', {
      details: { table: options.tableId, action: 'create' },
    })
  }

  const names = await loadFieldNames(exec, options.tableId)
  const byName = new Map([...names].map(([id, name]) => [name, id]))

  const location = await exec.query<{ schema_name: string; table_name: string }>(
    `SELECT sn.name AS schema_name, tn.name AS table_name
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1`,
    [options.tableId],
  )

  const columns: string[] = []
  const params: unknown[] = []

  for (const [name, value] of Object.entries(options.values)) {
    const fieldId = byName.get(name)

    // An unknown field and an invisible field get the same response: without this, a
    // write request would become a way to enumerate hidden columns.
    if (fieldId === undefined || !decision.readableFields.has(fieldId)) {
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: name } })
    }

    if (!decision.writableFields.has(fieldId)) {
      throw new BasedbError('FIELD_NOT_WRITABLE', { details: { field: name } })
    }

    columns.push(name)
    params.push(value)
  }

  if (columns.length === 0) {
    throw new BasedbError('REQUIRED_VALUE_MISSING', {
      details: { reason: 'no writable value supplied' },
    })
  }

  // `_created_by` and `_updated_by` are filled in by the kernel, never by the caller:
  // they appear in no write mask (A18).
  columns.push('_created_by', '_updated_by')
  params.push(ctx.actor.id, ctx.actor.id)

  const projection = columns.map((c) => quoteIdentifier(c)).join(', ')
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

  // RETURNING projected with the READ mask: writing to a field does not grant the right
  // to read it back.
  const readable = [...names].filter(([id]) => decision.readableFields.has(id)).map(([, n]) => n)
  const returning = [...SYSTEM_COLUMNS, ...readable].map((c) => quoteIdentifier(c)).join(', ')

  const relation = qualify(location[0].schema_name, location[0].table_name)

  return {
    sql: `INSERT INTO ${relation} (${projection})
VALUES (${placeholders})
RETURNING ${returning};`,
    params,
  }
}
