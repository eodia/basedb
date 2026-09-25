import { checkConstraintName, qualify, quoteIdentifier } from '@basedb/naming'
import {
  type FieldKind,
  choiceCheck,
  fileShapeCheck,
  isChoiceKind,
  isFileKind,
  pgTypeOf,
  sqlCommentOnColumn,
} from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { allocateName } from '../naming/allocation.js'
import { requireOnField, requireOnTable } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { commentText, normalizeDescription } from './description.js'
import { labelKey } from './operations.js'
import { type SelectOptionInput, normalizeOptions } from './select-options.js'

/**
 * Adding a field to an existing table — chapter 04 §1.3 and §1.10.
 *
 * ONE rule governs the whole operation, and it is not the obvious one: **every field is
 * created nullable.** Making it required is always a separate step, even here, because
 * `ADD COLUMN … NOT NULL` without a default fails on a populated table and v1 has no
 * defaults (§1.5). A caller who wants an obligation fills the column first, then asks
 * for it — and `setFieldRequired` runs the four-step recipe that makes `SET NOT NULL`
 * instantaneous instead of a full table scan.
 */

export interface AddFieldRequest {
  readonly tableId: string
  readonly label: string
  readonly kind: FieldKind
  readonly technicalName?: string
  /** What the field is for — shown in the documentation and to agents. Plain text. */
  readonly description?: string | null
  /**
   * The choices of a `select` or a `multi_select`. The list is not decoration: it becomes
   * a CHECK constraint, so direct SQL is held to it exactly as the API is.
   */
  readonly options?: readonly SelectOptionInput[]
}

export interface AddedField {
  readonly fieldId: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly kind: FieldKind
  /** What was emitted, in order — shown to the caller as every DDL operation does. */
  readonly sql: readonly string[]
}

interface Location {
  readonly tableId: string
  readonly baseId: string
  readonly tableName: string
  readonly schemaName: string
}

async function locate(exec: Executor, tableId: string): Promise<Location> {
  const rows = await exec.query<Location & Record<string, unknown>>(
    `SELECT t.id AS "tableId", t.base_id AS "baseId",
            tn.name AS "tableName", sn.name AS "schemaName"
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1 AND t.is_live`,
    [tableId],
  )
  const found = rows[0]
  // An unknown table and an invisible one answer the same thing everywhere else; here
  // the caller has already been through the enforcement point.
  if (found === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  }
  return found
}

/**
 * Adds a column, its catalog row and its satellite — in ONE transaction.
 *
 * `ALTER TABLE … ADD COLUMN` without a default is a catalogue-only change in
 * PostgreSQL: it takes `ACCESS EXCLUSIVE` for the instant it needs and rewrites nothing,
 * whatever the table's size (§1.10). That is why this one can stay inside a transaction
 * where the link recipe cannot.
 */
export async function addField(
  pools: Pools,
  ctx: RequestContext,
  request: AddFieldRequest,
): Promise<AddedField> {
  if (request.label.trim() === '') throw new BasedbError('LABEL_EMPTY')
  const description = normalizeDescription(request.description)

  if (request.kind === 'link') {
    // A link is a three-step sequence with a step outside the transaction, and it has
    // its own operation. Folding it in here would hide that from the caller.
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'kind', reason: 'utiliser createLinkField' },
    })
  }
  if (request.kind === 'formula') {
    // A formula needs an expression, its canonical tree and a result type — none of
    // which exists to be produced yet. Accepting the field and leaving the satellite
    // empty would create a column the catalog considers broken.
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'kind', reason: 'formule_sans_expression' },
    })
  }
  if (isChoiceKind(request.kind) && (request.options ?? []).length === 0) {
    // A select with no option is a column nothing can be written into. Refusing it here
    // is kinder than letting the CHECK refuse every later insert.
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'options', reason: 'liste_vide' },
    })
  }

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    // Building is `manage_schema` on the table (chapter 05 §8).
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const where = await locate(exec, request.tableId)
    const sql: string[] = []

    const column = await allocateName(exec, ctx, {
      label: request.label,
      technicalName: request.technicalName,
      objectKind: 'field',
      scopeKind: 'table',
      scopeId: where.tableId,
    })

    const [position] = await exec.query<{ n: number }>(
      'SELECT COALESCE(MAX(position), 0) + 1 AS n FROM _basedb.field WHERE table_id = $1',
      [where.tableId],
    )

    const [field] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.field
         (table_id, base_id, kind, name_id, label, label_key, description, is_required,
          position, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $9) RETURNING id`,
      [
        where.tableId,
        where.baseId,
        request.kind,
        column.nameId,
        request.label,
        labelKey(request.label),
        description,
        position.n,
        ctx.actor.id,
      ],
      'insert',
    )

    // NULL, always, whatever the caller asked: the obligation is a separate step.
    const add = `ALTER TABLE ${qualify(where.schemaName, where.tableName)} ADD COLUMN ${quoteIdentifier(column.name)} ${pgTypeOf(request.kind)} NULL;`
    await exec.query(add, [], 'ddl')
    sql.push(add)

    const comment = sqlCommentOnColumn(
      where.schemaName,
      where.tableName,
      column.name,
      commentText(request.label, description),
    )
    await exec.query(comment, [], 'ddl')
    sql.push(comment)

    if (isChoiceKind(request.kind)) {
      sql.push(
        ...(await addSelectOptions(
          exec,
          ctx,
          where,
          { id: field.id, kind: request.kind },
          column.name,
          request.options ?? [],
        )),
      )
    } else if (isFileKind(request.kind)) {
      sql.push(
        ...(await addFileShape(
          exec,
          ctx,
          where,
          { id: field.id, kind: request.kind },
          column.name,
        )),
      )
    } else {
      await insertSatellite(exec, field.id, request.kind)
    }

    return {
      fieldId: field.id,
      name: column.name,
      label: request.label,
      description,
      kind: request.kind,
      sql,
    }
  })
}

/**
 * The options of a `select` or a `multi_select`, and the constraint that makes them true
 * in the database.
 *
 * Without `ck_…__enum` a select is a text column with a list drawn on the screen, and
 * the product's central promise — the tables are real, and direct SQL is held to the
 * same rules — would stop at the first `INSERT` written in psql.
 */
async function addSelectOptions(
  exec: Executor,
  ctx: RequestContext,
  where: Location,
  field: { readonly id: string; readonly kind: 'select' | 'multi_select' },
  columnName: string,
  input: readonly SelectOptionInput[],
): Promise<readonly string[]> {
  const fieldId = field.id
  const options = normalizeOptions(input)

  const name = await allocateName(exec, ctx, {
    derivedName: checkConstraintName(where.tableName, columnName, 'enum'),
    objectKind: 'constraint',
    scopeKind: 'table',
    scopeId: where.tableId,
  })

  const [constraint] = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.table_constraint
       (table_id, base_id, kind, name_id, rule, origin, state, created_by)
     VALUES ($1, $2, 'check', $3, 'enum', 'system', 'active', $4) RETURNING id`,
    [where.tableId, where.baseId, name.nameId, ctx.actor.id],
    'insert',
  )
  await exec.query(
    `INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
     VALUES ($1, $2, $3, 1)`,
    [constraint.id, fieldId, where.tableId],
    'insert',
  )

  await exec.query(
    'INSERT INTO _basedb.field_select_config (field_id, kind, enum_constraint_id) VALUES ($1, $2, $3)',
    [fieldId, field.kind, constraint.id],
    'insert',
  )

  for (const [index, option] of options.entries()) {
    await exec.query(
      `INSERT INTO _basedb.select_option (field_id, value, label, color, icon, image, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [fieldId, option.value, option.label, option.color, option.icon, option.image, index + 1],
      'insert',
    )
  }

  // The column is empty — it was created a moment ago — so the constraint is born valid
  // and needs no scaffolding.
  const check = choiceCheck(
    field.kind,
    quoteIdentifier(columnName),
    options.map((o) => o.value),
  )
  const statement = `ALTER TABLE ${qualify(where.schemaName, where.tableName)} ADD CONSTRAINT ${quoteIdentifier(name.name)} CHECK (${check});`
  await exec.query(statement, [], 'ddl')
  return [statement]
}

/**
 * The shape of a `file` or `image` column, held by the database: a JSON array of one to
 * twenty entries, or `NULL`.
 *
 * What each entry says is the kernel's to guarantee — it copies it from `stored_file`
 * on every write. The constraint is the floor under direct SQL: an `UPDATE` written in
 * psql may put the wrong file in a cell, not a string where a list is read.
 */
async function addFileShape(
  exec: Executor,
  ctx: RequestContext,
  where: Location,
  field: { readonly id: string; readonly kind: 'file' | 'image' },
  columnName: string,
): Promise<readonly string[]> {
  const name = await allocateName(exec, ctx, {
    derivedName: checkConstraintName(where.tableName, columnName, 'files'),
    objectKind: 'constraint',
    scopeKind: 'table',
    scopeId: where.tableId,
  })

  const [constraint] = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.table_constraint
       (table_id, base_id, kind, name_id, rule, origin, state, created_by)
     VALUES ($1, $2, 'check', $3, 'files', 'system', 'active', $4) RETURNING id`,
    [where.tableId, where.baseId, name.nameId, ctx.actor.id],
    'insert',
  )
  await exec.query(
    `INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
     VALUES ($1, $2, $3, 1)`,
    [constraint.id, field.id, where.tableId],
    'insert',
  )
  await exec.query(
    'INSERT INTO _basedb.field_file_config (field_id, kind, shape_constraint_id) VALUES ($1, $2, $3)',
    [field.id, field.kind, constraint.id],
    'insert',
  )

  // Born on an empty column, hence valid at once, like the list of a select.
  const statement = `ALTER TABLE ${qualify(where.schemaName, where.tableName)} ADD CONSTRAINT ${quoteIdentifier(name.name)} CHECK (${fileShapeCheck(quoteIdentifier(columnName))});`
  await exec.query(statement, [], 'ddl')
  return [statement]
}

/**
 * Configuration satellite, demanded by the `ck_field_config_present` trigger for every
 * type whose `has_config` is true — that is, all of them in v1.
 */
async function insertSatellite(exec: Executor, fieldId: string, kind: FieldKind): Promise<void> {
  const tables: Partial<Record<FieldKind, string>> = {
    short_text: '_basedb.field_text_config',
    long_text: '_basedb.field_text_config',
    number: '_basedb.field_number_config',
    boolean: '_basedb.field_boolean_config',
    date: '_basedb.field_datetime_config',
    datetime: '_basedb.field_datetime_config',
    formula: '_basedb.field_formula_config',
  }

  const table = tables[kind]
  if (table === undefined) return

  // The text and datetime satellites carry the kind, since one table serves two types.
  const carriesKind = table.endsWith('text_config') || table.endsWith('datetime_config')
  await exec.query(
    carriesKind
      ? `INSERT INTO ${table} (field_id, kind) VALUES ($1, $2)`
      : `INSERT INTO ${table} (field_id) VALUES ($1)`,
    carriesKind ? [fieldId, kind] : [fieldId],
    'insert',
  )
}

export interface RequiredResult {
  readonly fieldId: string
  readonly required: boolean
  readonly sql: readonly string[]
}

/**
 * Makes a field required, or stops requiring it — chapter 04 §1.3.
 *
 * The four steps, and why they are four:
 *
 *   1. `ADD CONSTRAINT … CHECK (c IS NOT NULL) NOT VALID` — instant, takes no scan;
 *   2. `VALIDATE CONSTRAINT` — scans, but under a lock that lets reads AND writes
 *      through, which is the whole point of splitting it out;
 *   3. `SET NOT NULL` — instant, because the validated scaffold PROVES the column holds
 *      no null and PostgreSQL 12+ accepts that proof rather than scanning again;
 *   4. drop the scaffold, whose only job was to carry that proof.
 *
 * Done in one statement, `SET NOT NULL` would hold `ACCESS EXCLUSIVE` for the length of
 * a full scan — minutes on a large table, during which nothing reads it either.
 *
 * Step 2 runs OUTSIDE a transaction: a `VALIDATE` inside one would hold its lock until
 * commit, undoing the concurrency it was split out to gain.
 */
export async function setFieldRequired(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string; readonly required: boolean },
): Promise<RequiredResult> {
  const plan = await withTransaction(pools, 'ddl', ctx, async (exec) => {
    // Building is `manage_schema` on the table (chapter 05 §8).
    await requireOnField(exec, ctx, 'manage_schema', request.fieldId)
    const rows = await exec.query<{
      table_id: string
      base_id: string
      kind: FieldKind
      is_required: boolean
      column_name: string
      table_name: string
      schema_name: string
    }>(
      `SELECT f.table_id, f.base_id, f.kind, f.is_required,
              n.name AS column_name, tn.name AS table_name, sn.name AS schema_name
         FROM _basedb.field f
         JOIN _basedb.physical_name n  ON n.id = f.name_id
         JOIN _basedb.table_def t      ON t.id = f.table_id
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
        WHERE f.id = $1 AND f.is_live`,
      [request.fieldId],
    )

    const field = rows[0]
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.fieldId } })
    }
    // A formula has no value of its own to demand: it is computed, and requiring it
    // would be requiring its inputs by another name.
    if (field.kind === 'formula') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'kind', reason: 'formule' } })
    }

    const relation = qualify(field.schema_name, field.table_name)
    const column = quoteIdentifier(field.column_name)

    // Dropping the obligation is one statement: removing a constraint never scans.
    if (!request.required) {
      const statement = `ALTER TABLE ${relation} ALTER COLUMN ${column} DROP NOT NULL;`
      await exec.query(statement, [], 'ddl')
      await exec.query(
        `UPDATE _basedb.field SET is_required = false, required_state = 'absent' WHERE id = $1`,
        [request.fieldId],
        'update',
      )
      return { done: true as const, sql: [statement] }
    }

    if (field.is_required) return { done: true as const, sql: [] }

    const name = await allocateName(exec, ctx, {
      derivedName: checkConstraintName(field.table_name, field.column_name, 'not_null'),
      objectKind: 'constraint',
      scopeKind: 'table',
      scopeId: field.table_id,
    })

    const [constraint] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.table_constraint
         (table_id, base_id, kind, name_id, rule, origin, state, created_by)
       VALUES ($1, $2, 'check', $3, 'not_null', 'system', 'not_valid', $4) RETURNING id`,
      [field.table_id, field.base_id, name.nameId, ctx.actor.id],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
       VALUES ($1, $2, $3, 1)`,
      [constraint.id, request.fieldId, field.table_id],
      'insert',
    )

    const scaffold = `ALTER TABLE ${relation} ADD CONSTRAINT ${quoteIdentifier(name.name)} CHECK (${column} IS NOT NULL) NOT VALID;`
    await exec.query(scaffold, [], 'ddl')
    await exec.query(
      `UPDATE _basedb.field SET required_state = 'not_valid' WHERE id = $1`,
      [request.fieldId],
      'update',
    )

    return {
      done: false as const,
      relation,
      column,
      constraintId: constraint.id,
      constraintName: name.name,
      sql: [scaffold],
    }
  })

  if (plan.done) return { fieldId: request.fieldId, required: request.required, sql: plan.sql }

  const sql = [...plan.sql]

  // Step 2, OUTSIDE a transaction: a `VALIDATE` inside one holds its lock until commit.
  const validate = `ALTER TABLE ${plan.relation} VALIDATE CONSTRAINT ${quoteIdentifier(plan.constraintName)};`
  try {
    await pools.withConnection('ddl', (exec) => exec.query(validate, [], 'ddl'))
  } catch {
    // The scaffold is REMOVED, not kept. A `NOT VALID` check is still enforced on every
    // new row, so leaving it would half-apply the obligation the caller was just told
    // had failed — every later insert would have to fill a column nobody made required.
    // The offending rows are found with `WHERE "c" IS NULL`, which needs no constraint.
    await pools
      .withConnection('ddl', (exec) =>
        exec.query(
          `ALTER TABLE ${plan.relation} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(plan.constraintName)};`,
          [],
          'ddl',
        ),
      )
      .catch(() => undefined)

    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.table_constraint
            SET state = 'dropped', dropped_at = clock_timestamp()
          WHERE id = $1`,
        [plan.constraintId],
        'update',
      ),
    )
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.field SET required_state = 'absent' WHERE id = $1`,
        [request.fieldId],
        'update',
      ),
    )

    // The caller learns what to do about it, rather than reading a PostgreSQL message
    // about a constraint name they never chose.
    throw new BasedbError('VALIDATION_FAILED', {
      details: { field: request.fieldId, reason: 'lignes_vides' },
    })
  }
  sql.push(validate)

  // Steps 3 and 4: instant, the validated scaffold carrying the proof.
  await withTransaction(pools, 'ddl', ctx, async (exec) => {
    const promote = `ALTER TABLE ${plan.relation} ALTER COLUMN ${plan.column} SET NOT NULL;`
    const drop = `ALTER TABLE ${plan.relation} DROP CONSTRAINT ${quoteIdentifier(plan.constraintName)};`
    await exec.query(promote, [], 'ddl')
    await exec.query(drop, [], 'ddl')
    sql.push(promote, drop)

    await exec.query(
      `UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = clock_timestamp()
        WHERE id = $1`,
      [plan.constraintId],
      'update',
    )
    await exec.query(
      `UPDATE _basedb.field SET is_required = true, required_state = 'active' WHERE id = $1`,
      [request.fieldId],
      'update',
    )
  })

  return { fieldId: request.fieldId, required: true, sql }
}
