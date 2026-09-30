import { qualify, quoteIdentifier } from '@basedb/naming'
import { isFileKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { type ActorGrants, SYSTEM_COLUMNS, decide } from '../rbac/decide.js'
import { loadFields, loadGrants, loadTarget } from '../rbac/loader.js'
import { ROW_ALIAS } from '../rbac/rows.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { refuseSynced } from '../sync/guard.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { loadDefaults, resolveDefaults, timeZoneOf } from './defaults.js'
import { type LinkScopeCheck, assertLinkScope, linkScopeChecks } from './link-scope.js'
import { currentXact } from './update.js'
import { type ShapedField, shapeValues, shapedFields } from './values.js'

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
  /** The write's transaction — what an undo names (chapter 16 §4). */
  readonly xact: string
  /** The readable `file` and `image` columns of `row`, whose entries a reader links to. */
  readonly fileColumns: readonly string[]
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
    async (exec) => {
      const context = await loadWriteContext(exec, ctx, options.tableId)
      const values = await shapeValues(exec, context.shaped, context.writable, options.values)
      return {
        ...planRow(context, values, context.returning),
        fileColumns: context.fileColumns,
        links: await linkScopeChecks(exec, ctx, context.grants, context.links, values),
      }
    },
    { readOnly: true },
  )

  // In a transaction that carries the actor, never on a bare connection: the capture reads
  // the author from the session variables `withTransaction` sets (chapter 07 §2.1), and an
  // autocommitted write would be historised as a direct SQL session.
  const { rows, xact } = await withTransaction(pools, 'data', ctx, async (exec) => {
    await assertLinkScope(exec, plan.links)
    const inserted = await exec.query(plan.sql, plan.params, 'insert')
    inScope(inserted[0])
    return { rows: inserted, xact: await currentXact(exec) }
  })

  const row = rows[0]
  if (row === undefined) {
    throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'insert without RETURNING' } })
  }
  return { row, sql: plan.sql, fileColumns: plan.fileColumns, xact }
}

/**
 * A row its author could not read is not created (05 §16): its `INSERT` returned whether
 * the author's row predicate holds on it, and a `false` undoes the transaction — so that
 * nobody plants rows into a set they are not shown, nor learns about one by writing.
 */
function inScope(row: Record<string, unknown> | undefined): void {
  if (row === undefined || !(IN_SCOPE in row)) return
  const holds = row[IN_SCOPE]
  delete row[IN_SCOPE]
  if (holds !== true) throw new BasedbError('ROW_OUT_OF_SCOPE')
}

/** The column an `INSERT` returns its author's row predicate under. */
const IN_SCOPE = 'basedb_in_scope'

/**
 * Creates a record on ANOTHER's authority — the answer to a shared form (chapter 15).
 *
 * The rights are decided for `authority`, the person who published the form: what they
 * may create and write, narrowed to `fields`, the form's questions — a field outside them
 * is unknown, exactly as a hidden one is. The row is written, and historised, as `writer`:
 * the person who answered when they are signed in, the form itself when it is public.
 *
 * Nothing is read back: whoever answers a form is not granted a read of the table.
 */
export async function createRecordFor(
  pools: Pools,
  authority: RequestContext,
  writer: RequestContext,
  options: CreateRecordOptions & { readonly fields: ReadonlySet<string> },
): Promise<{ readonly id: string }> {
  const plan = await withTransaction(
    pools,
    'catalog',
    authority,
    async (exec) => {
      const context = await loadWriteContext(exec, authority, options.tableId)
      const asked = (names: ReadonlySet<string>) =>
        new Set([...names].filter((name) => options.fields.has(name)))
      // An answer to a public form has no author; a signed-in one has the respondent.
      const respondent = writer.actor.kind === 'user' ? writer.actor.id : null
      const narrowed: WriteContext = {
        ...context,
        readable: asked(context.readable),
        writable: asked(context.writable),
        actorId: respondent,
        // « Today » where the respondent is — where the form's author is, for a public one.
        defaults: resolveDefaults(context.rawDefaults, {
          actorId: respondent,
          timeZone: await timeZoneOf(exec, respondent ?? authority.actor.id),
          at: writer.timestamp,
        }),
        // A form gathers everyone's answers: an answer is not refused because the person
        // who published the form would not see it among their own rows.
        rowCheck: null,
      }
      const values = await shapeValues(exec, narrowed.shaped, narrowed.writable, options.values)
      return {
        ...planRow(narrowed, values, '"_id"'),
        links: await linkScopeChecks(exec, authority, context.grants, context.links, values),
      }
    },
    { readOnly: true },
  )
  const rows = await withTransaction(pools, 'data', writer, async (exec) => {
    await assertLinkScope(exec, plan.links)
    return exec.query<{ _id: string }>(plan.sql, plan.params, 'insert')
  })
  const row = rows[0]
  if (row === undefined) {
    throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'insert without RETURNING' } })
  }
  return { id: row._id }
}

/** Chapter 08 §3.6: a batch carries at most this many operations (`BATCH_TOO_LARGE`). */
export const BATCH_MAX_OPERATIONS = 1000

export interface CreateRecordsOptions {
  readonly tableId: string
  /** One entry per row to create, in order: values by physical field name. */
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>
}

export interface CreatedRecords {
  /** The identifiers of the rows created, aligned with `records`. */
  readonly ids: readonly string[]
  /** The statement of the first row, as every write shows what it emitted. */
  readonly sql: string
  /** The write's transaction — what an undo names (chapter 16 §4). */
  readonly xact: string
}

/**
 * Creates many records at once, ALL OR NOTHING — chapter 08 §3.5, `atomic: true`.
 *
 * One transaction on the data pool: either every row is written or none is, so a file
 * that is half good never leaves half a table behind. The rows are checked against the
 * masks first, in one catalog read, so a refusal for a field a caller may not write is
 * raised before any row is inserted; what only PostgreSQL can decide — a value that is
 * not a number, a list that does not hold the choice — comes back from the row that
 * caused it.
 *
 * Every refusal names the row: `details.index` is its position in `records`. Without it
 * a 1 000-row batch that fails would say "a value is invalid" and leave the caller to
 * find which of a thousand.
 *
 * One `INSERT` per row inside the transaction, and not one multi-row `INSERT`. A single
 * statement would be faster, but PostgreSQL reports an error against the statement and
 * not the row, so the index — the part of the answer a person needs — would be lost, and
 * rows naming different columns would have to be padded with `DEFAULT`. The bound of
 * 1 000 rows keeps the cost of the round trips inside the request's budget.
 */
export async function createRecords(
  pools: Pools,
  ctx: RequestContext,
  options: CreateRecordsOptions,
): Promise<CreatedRecords> {
  const { records } = options
  if (records.length === 0) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'operations', reason: 'lot_vide' },
    })
  }
  if (records.length > BATCH_MAX_OPERATIONS) {
    throw new BasedbError('BATCH_TOO_LARGE', {
      details: { operations: records.length, maximum: BATCH_MAX_OPERATIONS },
    })
  }

  const plans = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const context = await loadWriteContext(exec, ctx, options.tableId)
      const planned: Array<WritePlan & { readonly links: readonly LinkScopeCheck[] }> = []
      for (const [index, raw] of records.entries()) {
        try {
          const values = await shapeValues(exec, context.shaped, context.writable, raw)
          planned.push({
            ...planRow(context, values, quoteIdentifier('_id')),
            links: await linkScopeChecks(exec, ctx, context.grants, context.links, values),
          })
        } catch (error) {
          throw withIndex(error, index)
        }
      }
      return planned
    },
    { readOnly: true },
  )

  const { ids, xact } = await withTransaction(pools, 'data', ctx, async (exec) => {
    const created: string[] = []
    for (const [index, plan] of plans.entries()) {
      try {
        await assertLinkScope(exec, plan.links)
        const [row] = await exec.query<{ _id: string }>(plan.sql, plan.params, 'insert')
        inScope(row)
        created.push(row._id)
      } catch (error) {
        throw withIndex(error, index)
      }
    }
    return { ids: created, xact: await currentXact(exec) }
  })

  return { ids, sql: plans[0].sql, xact }
}

/** The same refusal, now carrying the position of the row that caused it. */
function withIndex(error: unknown, index: number): unknown {
  if (!(error instanceof BasedbError)) return error
  return new BasedbError(error.code, {
    details: { ...error.details, index },
    cause: error.cause,
    incidentId: error.incidentId,
  })
}

interface WritePlan {
  readonly sql: string
  readonly params: readonly unknown[]
}

/** What one catalog read settles for every row written to a table by one actor. */
interface WriteContext {
  readonly relation: string
  /** Physical names the actor may READ — a field outside it is unknown, not merely refused. */
  readonly readable: ReadonlySet<string>
  readonly writable: ReadonlySet<string>
  /** `_created_by`: `null` for an answer to a public form, which has no author. */
  readonly actorId: string | null
  /** The `RETURNING` list of a single-row write: the READ mask, never the write one. */
  readonly returning: string
  /** The fields whose value is reshaped before it is written, by physical name. */
  readonly shaped: ReadonlyMap<string, ShapedField>
  /** The readable `file` and `image` columns. */
  readonly fileColumns: readonly string[]
  /** The author's row predicate, when rules narrow it: the row created must satisfy it. */
  readonly rowCheck: string | null
  /** What the decision was made on, for the rows the links written name. */
  readonly grants: ActorGrants
  /** The table's link fields, physical name → field id. */
  readonly links: ReadonlyMap<string, string>
  /** The table's defaults (04 §1.5), as the catalog holds them. */
  readonly rawDefaults: Awaited<ReturnType<typeof loadDefaults>>
  /** What they give this write, by physical name: a field the write does not name takes it. */
  readonly defaults: ReadonlyMap<string, unknown>
}

async function loadWriteContext(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<WriteContext> {
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, tableId)

  if (target === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  }

  const decision = decide(ctx, grants, 'create', target)
  if (decision.verdict === 'INVISIBLE') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  }
  if (decision.verdict === 'FORBIDDEN') {
    throw new BasedbError('ADMIN_REQUIRED', {
      details: { table: tableId, action: 'create' },
    })
  }
  await refuseSynced(exec, ctx, tableId)

  const fields = await loadFields(exec, tableId)
  const names = new Map([...fields].map(([id, f]) => [id, f.name]))

  const rawDefaults = await loadDefaults(exec, tableId)
  const timed = [...rawDefaults.values()].some((d) => d.kind === 'today')
  const defaults = resolveDefaults(rawDefaults, {
    actorId: ctx.actor.id,
    timeZone: timed ? await timeZoneOf(exec, ctx.actor.id) : 'UTC',
    at: ctx.timestamp,
  })

  const location = await exec.query<{ schema_name: string; table_name: string }>(
    `SELECT sn.name AS schema_name, tn.name AS table_name
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1`,
    [tableId],
  )

  // RETURNING projected with the READ mask: writing to a field does not grant the right
  // to read it back.
  // A field computed at read time has no column to return: the row is read again for it.
  const readable = [...names]
    .filter(([id]) => decision.readableFields.has(id) && fields.get(id)?.stored !== false)
    .map(([, n]) => n)

  return {
    relation: qualify(location[0].schema_name, location[0].table_name),
    readable: new Set(readable),
    writable: new Set(
      [...names].filter(([id]) => decision.writableFields.has(id)).map(([, n]) => n),
    ),
    actorId: ctx.actor.id,
    returning: [...SYSTEM_COLUMNS, ...readable].map((c) => quoteIdentifier(c)).join(', '),
    shaped: shapedFields(fields),
    fileColumns: [...fields]
      .filter(([id, f]) => decision.readableFields.has(id) && isFileKind(f.kind))
      .map(([, f]) => f.name),
    rowCheck: decision.rowPredicate === 'TRUE' ? null : decision.rowPredicate,
    grants,
    links: new Map(
      [...fields]
        .filter(([, f]) => f.kind === 'link' || f.kind === 'multi_link')
        .map(([id, f]) => [f.name, id]),
    ),
    rawDefaults,
    defaults,
  }
}

/** One row against the masks: the statement to run and its parameters. */
function planRow(
  context: WriteContext,
  values: Readonly<Record<string, unknown>>,
  returning: string,
): WritePlan {
  const columns: string[] = []
  const params: unknown[] = []

  for (const [name, value] of Object.entries(values)) {
    // An unknown field and an invisible field get the same response: without this, a
    // write request would become a way to enumerate hidden columns.
    if (!context.readable.has(name)) {
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: name } })
    }

    if (!context.writable.has(name)) {
      throw new BasedbError('FIELD_NOT_WRITABLE', { details: { field: name } })
    }

    columns.push(name)
    params.push(value)
  }

  // A write that names nothing is refused before the defaults fill it: a body that put its
  // values in the wrong place must not come back as a row made of defaults.
  if (columns.length === 0) {
    throw new BasedbError('REQUIRED_VALUE_MISSING', {
      details: { reason: 'no writable value supplied' },
    })
  }

  // What the write does not name takes the field's default — whatever the author's write
  // mask: like `_created_by`, it is the table's rule, not the author's write (04 §1.5).
  for (const [name, value] of context.defaults) {
    if (Object.hasOwn(values, name)) continue
    columns.push(name)
    params.push(value)
  }

  // `_created_by` and `_updated_by` are filled in by the kernel, never by the caller:
  // they appear in no write mask (A18).
  columns.push('_created_by', '_updated_by')
  params.push(context.actorId, context.actorId)

  const projection = columns.map((c) => quoteIdentifier(c)).join(', ')
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

  // The target named as the rule templates name it: the check reads the row inserted.
  if (context.rowCheck !== null) {
    return {
      sql: `INSERT INTO ${context.relation} AS ${quoteIdentifier(ROW_ALIAS)} (${projection})
VALUES (${placeholders})
RETURNING ${returning},
          ( /*predicat_lignes*/ ${context.rowCheck} ) AS ${quoteIdentifier(IN_SCOPE)};`,
      params,
    }
  }
  return {
    sql: `INSERT INTO ${context.relation} (${projection})
VALUES (${placeholders})
RETURNING ${returning};`,
    params,
  }
}
