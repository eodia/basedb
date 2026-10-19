import { qualify, quoteIdentifier, uniqueConstraintName } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { allocateName } from '../naming/allocation.js'
import { requireOnField } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * A field without duplicates — chapter 04 §1.6.
 *
 * Not a flag of `field`: a row of `table_constraint` of kind `unique`, one member, named
 * `uq_<table>__<colonne>`, which the database holds against every writer, `psql` included.
 * Several empty rows stay allowed (`NULLS DISTINCT`): a field that is not required and has
 * no duplicate is not required by the back door.
 *
 * The plan, in the order of §1.6:
 *
 *   1. the pre-check — `GROUP BY … HAVING count(*) > 1` —, which makes the MESSAGE: the
 *      values that stand in the way, and how many times;
 *   2. `CREATE UNIQUE INDEX CONCURRENTLY`, outside any transaction: it lets writes through
 *      on a table of any size. A duplicate written meanwhile leaves it invalid: the residue
 *      is dropped, and the refusal is the same as the pre-check's;
 *   3. `ADD CONSTRAINT … UNIQUE USING INDEX`: instant, the index carrying the proof.
 *
 * Taking it off is one `DROP CONSTRAINT`, which takes its index with it.
 */

/**
 * The kinds a value of which can be compared for equality and indexed — not a long text, a
 * list, a file, a computed value. A link stays out: one-to-one is not a cardinality the
 * product offers (§4.1).
 */
const UNIQUE_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'email',
  'url',
  'number',
  'date',
  'datetime',
])

/** Texts whose index entry would come near the btree's ~2 704 bytes are refused (§2.1). */
const INDEXABLE_BYTES = 2000

/** How many of the values in the way the refusal names. */
const SAMPLE = 20

interface Located extends Record<string, unknown> {
  readonly table_id: string
  readonly base_id: string
  readonly kind: string
  readonly label: string
  readonly column_name: string
  readonly table_name: string
  readonly schema_name: string
  readonly ai: boolean
}

async function locate(exec: Executor, fieldId: string): Promise<Located> {
  const [field] = await exec.query<Located>(
    `SELECT f.table_id, f.base_id, f.kind, f.label,
            n.name AS column_name, tn.name AS table_name, sn.name AS schema_name,
            EXISTS (SELECT 1 FROM _basedb.field_ai_config c WHERE c.field_id = f.id) AS ai
       FROM _basedb.field f
       JOIN _basedb.physical_name n  ON n.id = f.name_id
       JOIN _basedb.table_def t      ON t.id = f.table_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE f.id = $1 AND f.is_live`,
    [fieldId],
  )
  if (field === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: fieldId } })
  }
  return field
}

/** The field's own unique constraint — one member, this field — when it has one. */
async function constraintOf(
  exec: Executor,
  fieldId: string,
): Promise<{ id: string; name: string; state: string } | undefined> {
  const [found] = await exec.query<{ id: string; name: string; state: string }>(
    `SELECT c.id::text, n.name, c.state
       FROM _basedb.table_constraint c
       JOIN _basedb.physical_name n           ON n.id = c.name_id
       JOIN _basedb.table_constraint_member m ON m.constraint_id = c.id
      WHERE m.field_id = $1 AND c.kind = 'unique' AND c.state <> 'dropped'
        AND (SELECT count(*) FROM _basedb.table_constraint_member o
              WHERE o.constraint_id = c.id) = 1
      ORDER BY c.created_at DESC
      LIMIT 1`,
    [fieldId],
  )
  return found
}

/** The values that appear more than once, and how many times — the refusal's content. */
async function duplicatesOf(
  exec: Executor,
  field: Located,
): Promise<Array<{ value: string; count: number }>> {
  const column = quoteIdentifier(field.column_name)
  const rows = await exec.query<{ value: string; count: string }>(
    `SELECT ${column}::text AS value, count(*) AS count
       FROM ${qualify(field.schema_name, field.table_name)}
      WHERE ${column} IS NOT NULL
      GROUP BY ${column}
     HAVING count(*) > 1
      ORDER BY count(*) DESC, 1
      LIMIT ${SAMPLE}`,
  )
  return rows.map((r) => ({ value: r.value, count: Number(r.count) }))
}

export interface UniqueResult {
  readonly fieldId: string
  readonly unique: boolean
  readonly sql: readonly string[]
}

export async function setFieldUnique(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string; readonly unique: boolean },
): Promise<UniqueResult> {
  const plan = await withTransaction(pools, 'ddl', ctx, async (exec) => {
    // Building is `manage_schema` on the table (chapter 05 §8).
    await requireOnField(exec, ctx, 'manage_schema', request.fieldId)
    const field = await locate(exec, request.fieldId)
    const relation = qualify(field.schema_name, field.table_name)
    const existing = await constraintOf(exec, request.fieldId)

    if (!request.unique) {
      if (existing === undefined) return { done: true as const, sql: [] }
      const statement = `ALTER TABLE ${relation} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(existing.name)};`
      await exec.query(statement, [], 'ddl')
      // The index of an abandoned build is not the constraint's: it goes too.
      const residue = `DROP INDEX IF EXISTS ${qualify(field.schema_name, existing.name)};`
      await exec.query(residue, [], 'ddl')
      await exec.query(
        `UPDATE _basedb.table_constraint
            SET state = 'dropped', dropped_at = clock_timestamp(), state_changed_at = clock_timestamp()
          WHERE id = $1`,
        [existing.id],
        'update',
      )
      return { done: true as const, sql: [statement] }
    }

    if (existing?.state === 'active') return { done: true as const, sql: [] }
    if (existing !== undefined) {
      // A build left half-way by another request — or by a crash: not a second one.
      throw new BasedbError('MIGRATION_IN_PROGRESS', { details: { field: field.label } })
    }

    if (!UNIQUE_KINDS.has(field.kind)) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'unique', reason: 'type_sans_unicite', kind: field.kind },
      })
    }
    // A value only the model writes, after the row exists: a duplicate answer would make
    // the computation fail where nobody can see it.
    if (field.ai) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'unique', reason: 'champ_ia' } })
    }

    const column = quoteIdentifier(field.column_name)
    if (field.kind === 'short_text' || field.kind === 'email' || field.kind === 'url') {
      const [longest] = await exec.query<{ bytes: number | null }>(
        `SELECT max(octet_length(${column}))::int AS bytes FROM ${relation}`,
      )
      if ((longest?.bytes ?? 0) > INDEXABLE_BYTES) {
        throw new BasedbError('INDEX_LENGTH_EXCEEDED', {
          details: { field: field.label, bytes: longest?.bytes, maximum: INDEXABLE_BYTES },
        })
      }
    }

    const duplicates = await duplicatesOf(exec, field)
    if (duplicates.length > 0) {
      throw new BasedbError('DUPLICATE_VALUE', {
        details: { field: field.label, duplicates },
      })
    }

    const name = await allocateName(exec, ctx, {
      derivedName: uniqueConstraintName(field.table_name, [field.column_name]),
      objectKind: 'constraint',
      scopeKind: 'table',
      scopeId: field.table_id,
    })
    const [constraint] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.table_constraint
         (table_id, base_id, kind, name_id, origin, state, created_by)
       VALUES ($1, $2, 'unique', $3, 'user', 'building', $4) RETURNING id`,
      [field.table_id, field.base_id, name.nameId, ctx.actor.id],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
       VALUES ($1, $2, $3, 1)`,
      [constraint.id, request.fieldId, field.table_id],
      'insert',
    )
    return {
      done: false as const,
      field,
      relation,
      column,
      constraintId: constraint.id,
      name: name.name,
    }
  })

  if (plan.done) return { fieldId: request.fieldId, unique: request.unique, sql: plan.sql }

  const index = qualify(plan.field.schema_name, plan.name)
  const build = `CREATE UNIQUE INDEX CONCURRENTLY ${quoteIdentifier(plan.name)} ON ${plan.relation} (${plan.column});`
  // The residue of a build that did not finish goes at once: an invalid unique index is
  // still updated on every write, and the catalog must not say a constraint is coming.
  const abandon = async () => {
    await pools
      .withConnection('ddl', (exec) =>
        exec.query(`DROP INDEX CONCURRENTLY IF EXISTS ${index};`, [], 'ddl'),
      )
      .catch(() => undefined)
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.table_constraint
            SET state = 'dropped', dropped_at = clock_timestamp(), state_changed_at = clock_timestamp()
          WHERE id = $1`,
        [plan.constraintId],
        'update',
      ),
    )
  }

  // Step 2, OUTSIDE a transaction: `CONCURRENTLY` refuses to run inside one.
  try {
    await pools.withConnection('ddl', (exec) => exec.query(build, [], 'ddl'))
  } catch (e) {
    await abandon()
    // A duplicate written while the index was being built: the same refusal as the
    // pre-check's, with what is in the way now.
    const duplicates = await pools
      .withConnection('data', (exec) => duplicatesOf(exec, plan.field))
      .catch(() => [])
    if (duplicates.length > 0) {
      throw new BasedbError('DUPLICATE_VALUE', {
        details: { field: plan.field.label, duplicates },
      })
    }
    throw e
  }

  // Step 3: the constraint over the index — instant, and the state the catalog says.
  const attach = `ALTER TABLE ${plan.relation} ADD CONSTRAINT ${quoteIdentifier(plan.name)} UNIQUE USING INDEX ${quoteIdentifier(plan.name)};`
  try {
    await withTransaction(pools, 'ddl', ctx, async (exec) => {
      await exec.query(attach, [], 'ddl')
      await exec.query(
        `UPDATE _basedb.table_constraint
            SET state = 'active', state_changed_at = clock_timestamp()
          WHERE id = $1`,
        [plan.constraintId],
        'update',
      )
    })
  } catch (e) {
    await abandon()
    throw e
  }

  return { fieldId: request.fieldId, unique: true, sql: [build, attach] }
}
