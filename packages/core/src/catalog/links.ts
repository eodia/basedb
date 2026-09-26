import {
  foreignKeyName,
  indexName,
  linkColumnName,
  linkColumnNameFromLabel,
  qualify,
  quoteIdentifier,
  slugify,
} from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { allocateName } from '../naming/allocation.js'
import { requireOnTable } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { commentText, normalizeDescription } from './description.js'
import { labelKey } from './operations.js'

/**
 * Link fields — chapter 04 §4, "Relations" specification.
 *
 * A link is a REAL PostgreSQL foreign key, not an application-level convention: a
 * deletion performed directly in SQL is refused or cascades exactly as one performed
 * through the API. This is the cadrage's central requirement, and it rules out any
 * integrity held on the application side.
 *
 * v1 knows only many-to-one: the column lives on the SOURCE table and carries the
 * target's `_id`. There is no junction table, hence no cardinality to declare.
 */

/** Behaviour on deletion of the target row (§4.2). */
export type OnDelete = 'restrict' | 'set_null' | 'cascade'

export interface CreateLinkFieldRequest {
  readonly tableId: string
  readonly targetTableId: string
  readonly label: string
  readonly required?: boolean
  readonly onDelete?: OnDelete
  readonly technicalName?: string
  /** What the link means — "the client invoiced", not "a link to Clients". Plain text. */
  readonly description?: string | null
  /** The field's lineage, when it copies a relation of another environment (chapter 14). */
  readonly lineageId?: string
}

export interface CreatedLinkField {
  readonly fieldId: string
  readonly label: string
  readonly description: string | null
  /** Physical column name, frozen at creation and never recomputed. */
  readonly name: string
  readonly targetTableName: string
  readonly constraintName: string
  readonly indexName: string
  readonly onDelete: OnDelete
  /** The statements actually emitted, in order, for inspection. */
  readonly sql: readonly string[]
}

/**
 * `ON DELETE` clause emitted, per requested behaviour.
 *
 * `restrict` emits `NO ACTION`, and that is not a lazy synonym (A13): `NO ACTION`
 * refuses exactly the same deletions, but checks AT END OF STATEMENT. A bulk delete
 * that removes, within the same statement, a row and the rows referencing it — a common
 * case for a hierarchical table referencing itself — then succeeds, where `RESTRICT`
 * would fail for no business reason.
 */
const ON_DELETE_CLAUSE: Readonly<Record<OnDelete, string>> = {
  restrict: 'NO ACTION',
  set_null: 'SET NULL',
  cascade: 'CASCADE',
}

interface Location {
  readonly tableId: string
  readonly baseId: string
  readonly schemaName: string
  readonly tableName: string
}

/**
 * Creates a link field, in three steps.
 *
 * The sequence of §4.1 CANNOT fit in a single transaction: `CREATE INDEX CONCURRENTLY`
 * is refused inside a transaction block. The three steps are therefore genuinely
 * distinct, and the catalog carries each physical object's state between them — which
 * is precisely what `physical_state` and the `state` columns are for.
 *
 *   1. catalog + `ADD COLUMN` + `ADD CONSTRAINT … NOT VALID`  (transaction)
 *   2. `CREATE INDEX CONCURRENTLY`                            (outside a transaction)
 *   3. `VALIDATE CONSTRAINT`                                  (transaction)
 *
 * A failure after step 1 leaves a non-terminal state in the catalog, visible and
 * recoverable, rather than a physical object nobody knows the existence of.
 */
export async function createLinkField(
  pools: Pools,
  ctx: RequestContext,
  request: CreateLinkFieldRequest,
): Promise<CreatedLinkField> {
  const onDelete = request.onDelete ?? 'restrict'
  const required = request.required ?? false
  const description = normalizeDescription(request.description)

  // ── Step 1: catalog and non-blocking DDL ──────────────────────────────────
  const plan = await withTransaction(pools, 'ddl', ctx, async (exec) => {
    // A link constrains BOTH tables: `manage_schema` on the source and on the target
    // (chapter 05 §8), whatever surface asks.
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    await requireOnTable(exec, ctx, 'manage_schema', request.targetTableId)
    const source = await resolveTable(exec, request.tableId)
    const target = await resolveTable(exec, request.targetTableId)

    check(source, target, onDelete, required)

    // The column name follows A7: `<target table>_id`, failing that the slug of the
    // field's label followed by `_id`, and only as a last resort a numeric suffix.
    const labelSlug = slugify(request.label, { max: 60, nature: 'champ' }).slug
    const columnName = await allocateName(exec, ctx, {
      technicalName: request.technicalName,
      derivedName:
        request.technicalName === undefined ? linkColumnName(target.tableName) : undefined,
      derivedFallbacks:
        request.technicalName === undefined ? [linkColumnNameFromLabel(labelSlug)] : undefined,
      objectKind: 'field',
      scopeKind: 'table',
      scopeId: source.tableId,
    })

    const [position] = await exec.query<{ n: number }>(
      'SELECT COALESCE(MAX(position), 0) + 1 AS n FROM _basedb.field WHERE table_id = $1',
      [source.tableId],
    )

    const [field] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.field
         (table_id, base_id, kind, name_id, label, label_key, description, is_required,
          position, created_by, updated_by, lineage_id)
       VALUES ($1, $2, 'link', $3, $4, $5, $6, $7, $8, $9, $9,
               coalesce($10::uuid, _basedb_local.uuid_generate_v7())) RETURNING id`,
      [
        source.tableId,
        source.baseId,
        columnName.nameId,
        request.label,
        labelKey(request.label),
        description,
        required,
        position.n,
        ctx.actor.id,
        request.lineageId ?? null,
      ],
      'insert',
    )

    const fkName = foreignKeyName(source.tableName, columnName.name)
    const ixName = indexName(source.tableName, [columnName.name])

    // The constraint is born `not_valid` and the index `pending`: those are the real
    // states of the objects at the end of this transaction, and the following steps
    // will advance them.
    const constraint = await registerObject(exec, ctx, {
      table: '_basedb.table_constraint',
      columns: 'kind, origin, state',
      values: "'foreign_key', 'system', 'not_valid'",
      name: fkName,
      source,
      fieldId: field.id,
      members: '_basedb.table_constraint_member',
      memberKey: 'constraint_id',
    })

    const index = await registerObject(exec, ctx, {
      table: '_basedb.table_index',
      columns: 'method, origin, state',
      values: "'btree', 'system', 'pending'",
      name: ixName,
      source,
      fieldId: field.id,
      members: '_basedb.table_index_member',
      memberKey: 'index_id',
    })

    await exec.query(
      `INSERT INTO _basedb.field_link_config
         (field_id, base_id, is_required, target_table_id, fk_constraint_id, fk_index_id, on_delete)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [field.id, source.baseId, required, target.tableId, constraint.id, index.id, onDelete],
      'insert',
    )

    const relation = qualify(source.schemaName, source.tableName)
    const column = quoteIdentifier(columnName.name)

    // The column is born NULLable even for a required link: it is empty, so `NOT NULL`
    // would fail as soon as a row exists. The requirement constraint belongs to a later
    // step, after the column has been filled.
    const sql = [
      `ALTER TABLE ${relation} ADD COLUMN ${column} uuid NULL;`,
      `COMMENT ON COLUMN ${relation}.${column} IS ${literal(commentText(`Lien vers ${target.label}`, description))};`,
      `ALTER TABLE ${relation}
  ADD CONSTRAINT ${quoteIdentifier(fkName)}
  FOREIGN KEY (${column}) REFERENCES ${qualify(target.schemaName, target.tableName)} ("_id")
  ON DELETE ${ON_DELETE_CLAUSE[onDelete]} ON UPDATE NO ACTION NOT VALID;`,
    ]

    for (const statement of sql) await exec.query(statement, [], 'ddl')

    return {
      fieldId: field.id,
      name: columnName.name,
      fkName,
      ixName,
      constraintId: constraint.id,
      indexId: index.id,
      relation,
      targetTableName: target.tableName,
      sql,
    }
  })

  // ── Step 2: the index, outside a transaction ──────────────────────────────
  //
  // The index carries ("column", "_id"), not the column alone: the second term serves
  // listing inverse links sorted by `_id` with no extra sort. And PostgreSQL creates NO
  // index for a foreign key — without this one, every deletion of a target row would
  // force a full scan of the source table.
  const indexSql = `CREATE INDEX CONCURRENTLY ${quoteIdentifier(plan.ixName)}
  ON ${plan.relation} (${quoteIdentifier(plan.name)}, "_id");`

  await advance(pools, plan.indexId, '_basedb.table_index', 'building', indexSql, 'active')

  // ── Step 3: validating the constraint ─────────────────────────────────────
  //
  // Scans the table under a lock that still lets writes through. On this path the
  // column has just been created and holds only nulls, so no orphan pre-check is
  // useful — it would bear on emptiness.
  const validateSql = `ALTER TABLE ${plan.relation} VALIDATE CONSTRAINT ${quoteIdentifier(plan.fkName)};`

  await advance(
    pools,
    plan.constraintId,
    '_basedb.table_constraint',
    'validating',
    validateSql,
    'active',
  )

  return {
    fieldId: plan.fieldId,
    label: request.label,
    description,
    name: plan.name,
    targetTableName: plan.targetTableName,
    constraintName: plan.fkName,
    indexName: plan.ixName,
    onDelete,
    sql: [...plan.sql, indexSql, validateSql],
  }
}

/**
 * Emits a statement outside a transaction, framing the emission with the catalog state.
 *
 * The intermediate state is set BEFORE emission: if the process dies during the
 * `CREATE INDEX CONCURRENTLY`, the catalog holds `building`, a non-terminal state that
 * monitoring flags beyond 24 h. Setting the state afterwards would suggest the step had
 * never started, and an invalid index would linger with nothing pointing at it.
 */
async function advance(
  pools: Pools,
  objectId: string,
  table: string,
  stateDuring: string,
  statement: string,
  finalState: string,
): Promise<void> {
  const setState = async (state: string) => {
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE ${table} SET state = $2, state_changed_at = pg_catalog.clock_timestamp()
          WHERE id = $1`,
        [objectId, state],
        'update',
      ),
    )
  }

  await setState(stateDuring)
  // Outside a transaction: `CREATE INDEX CONCURRENTLY` is refused inside a transaction
  // block, and `VALIDATE CONSTRAINT` would hold a lock there far longer than needed.
  await pools.withConnection('ddl', (exec) => exec.query(statement, [], 'ddl'))
  await setState(finalState)
}

/** Registers a constraint or an index in the catalog, with its name and its member. */
async function registerObject(
  exec: Executor,
  ctx: RequestContext,
  o: {
    readonly table: string
    readonly columns: string
    readonly values: string
    readonly name: string
    readonly source: Location
    readonly fieldId: string
    readonly members: string
    readonly memberKey: string
  },
): Promise<{ readonly id: string }> {
  // The derived name is recorded in the registry like any other physical name: that is
  // what guarantees it is never reassigned, and that a collision is settled by the
  // ordinary mechanism rather than by a special rule.
  const name = await allocateName(exec, ctx, {
    derivedName: o.name,
    objectKind: o.table.endsWith('index') ? 'index' : 'constraint',
    scopeKind: 'table',
    scopeId: o.source.tableId,
  })

  const [object] = await exec.query<{ id: string }>(
    `INSERT INTO ${o.table} (table_id, base_id, name_id, ${o.columns}, created_by)
     VALUES ($1, $2, $3, ${o.values}, $4) RETURNING id`,
    [o.source.tableId, o.source.baseId, name.nameId, ctx.actor.id],
    'insert',
  )

  await exec.query(
    `INSERT INTO ${o.members} (${o.memberKey}, field_id, table_id, position) VALUES ($1, $2, $3, 1)`,
    [object.id, o.fieldId, o.source.tableId],
    'insert',
  )

  return object
}

/** The refusals of §4.2, all pronounced before a single DDL statement is emitted. */
function check(
  source: Location & { label: string },
  target: Location & { label: string },
  onDelete: OnDelete,
  required: boolean,
): void {
  if (source.baseId !== target.baseId) {
    // A foreign key across bases would tie two schemas that the lifecycle treats
    // independently: deleting one base would break another.
    throw new BasedbError('LINK_CROSS_DATABASE', {
      details: { source: source.tableName, target: target.tableName },
    })
  }

  if (required && onDelete === 'set_null') {
    throw new BasedbError('LINK_SET_NULL_ON_REQUIRED', { details: { table: source.tableName } })
  }

  if (required && source.tableId === target.tableId) {
    // A required reflexive link would make the FIRST insert impossible: there is no row
    // to designate while the table is empty.
    throw new BasedbError('LINK_SELF_REQUIRED', { details: { table: source.tableName } })
  }

  if (onDelete === 'cascade') {
    // The cascade is executed by PostgreSQL (A14): a deletion performed in raw SQL
    // cascades too. It requires a typed confirmation and a `cascade_grant` row, which
    // the kernel cannot yet produce.
    throw new BasedbError('LINK_CASCADE_NOT_GRANTED', {
      details: { reason: 'cascade confirmation is not implemented yet' },
    })
  }
}

async function resolveTable(
  exec: Executor,
  tableId: string,
): Promise<Location & { label: string }> {
  const rows = await exec.query<{
    id: string
    base_id: string
    label: string
    schema_name: string
    table_name: string
  }>(
    `SELECT t.id, t.base_id, t.label, sn.name AS schema_name, tn.name AS table_name
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1 AND t.is_live`,
    [tableId],
  )

  const t = rows[0]
  if (t === undefined) {
    // Absence, never a message that would distinguish "non-existent" from "invisible".
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  }

  return {
    tableId: t.id,
    baseId: t.base_id,
    label: t.label,
    schemaName: t.schema_name,
    tableName: t.table_name,
  }
}

/** SQL literal, for comments only — never for a data value. */
function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * Designates a table's display column (chapter 04 §6).
 *
 * The four `table_def` columns are written together: `display_field_id` and its three
 * mirrors. This is not redundancy but the support of a composite foreign key — it is
 * then the DATABASE that guarantees the designated field belongs to this table, is
 * live, and has a type that can serve as a display. An application-level check would
 * let the same mistake through when made in raw SQL.
 */
export async function setDisplayColumn(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly fieldId: string | null },
): Promise<{ readonly fieldId: string | null; readonly name: string | null }> {
  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    // Building is `manage_schema` on the table (chapter 05 §8).
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    // A null designation is a VALID state (A15): a table with no displayable field
    // remains a legitimate link target, its links simply yield `display: null`.
    if (request.fieldId === null) {
      await exec.query(
        `UPDATE _basedb.table_def
            SET display_field_id = NULL, display_field_kind = NULL,
                display_field_is_live = NULL, display_field_can_be_display = NULL,
                updated_by = $2, updated_at = pg_catalog.clock_timestamp()
          WHERE id = $1`,
        [request.tableId, ctx.actor.id],
        'update',
      )
      return { fieldId: null, name: null }
    }

    const rows = await exec.query<{
      kind: string
      is_live: boolean
      can_be_display: boolean
      name: string
    }>(
      `SELECT f.kind, f.is_live, k.can_be_display, n.name
         FROM _basedb.field f
         JOIN _basedb.field_kind k     ON k.code = f.kind
         JOIN _basedb.physical_name n  ON n.id = f.name_id
        WHERE f.id = $1 AND f.table_id = $2`,
      [request.fieldId, request.tableId],
    )

    const field = rows[0]
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.fieldId } })
    }
    if (!field.can_be_display) {
      // The registry carries no dedicated code: this is a business validation, and
      // `fk_display_kind` would refuse it anyway — but with a foreign-key diagnostic
      // unreadable to the caller.
      throw new BasedbError('VALIDATION_FAILED', {
        details: {
          violations: [
            { field: request.fieldId, type: field.kind, reason: 'type cannot be displayed' },
          ],
        },
      })
    }

    await exec.query(
      `UPDATE _basedb.table_def
          SET display_field_id = $2, display_field_kind = $3,
              display_field_is_live = $4, display_field_can_be_display = $5,
              updated_by = $6, updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1`,
      [
        request.tableId,
        request.fieldId,
        field.kind,
        field.is_live,
        field.can_be_display,
        ctx.actor.id,
      ],
      'update',
    )

    return { fieldId: request.fieldId, name: field.name }
  })
}
