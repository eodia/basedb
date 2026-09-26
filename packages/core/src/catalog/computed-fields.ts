import { qualify, quoteIdentifier } from '@basedb/naming'
import { type FieldKind, sqlCommentOnColumn } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import {
  type FormulaField,
  type FormulaType,
  type Node,
  emitFormula,
  kindOfType,
  parseFormula,
  resolveFormula,
} from '../formula/language.js'
import { allocateName } from '../naming/allocation.js'
import { requireOnTable } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { commentText } from './description.js'
import { labelKey } from './operations.js'

/**
 * Creating the computed fields — chapter 04 §7 and §7 ter.
 *
 * A formula is parsed, typed and emitted here, from its tree (§7.6): stored when it can
 * be, a generated column; computed at read time when it reads the clock or a computed
 * field (§7.1). A lookup, a rollup and a count have no column at all: their catalog row
 * names the path they follow, and the read builds the rest (records/computed.ts).
 */

export interface FormulaInput {
  readonly expression: string
  /** Where AUJOURDHUI() is read; `Europe/Paris` when the formula uses it and says nothing. */
  readonly timezone?: string | null
}

export type RollupAggregate = 'count' | 'sum' | 'avg' | 'min' | 'max'

export interface RollupInput {
  /** The relation followed, by physical name. */
  readonly via: string
  /** For an incoming path: the table that holds the relation, by physical name. */
  readonly viaTable?: string
  /** The field read on each reached row — a lookup and a rollup. */
  readonly target?: string
  /** How a rollup combines them. */
  readonly aggregate?: RollupAggregate
}

interface TableRef {
  readonly tableId: string
  readonly baseId: string
  readonly tableName: string
  readonly schemaName: string
}

/** The fields of a table a formula may name, with what a computed one yields. */
async function formulaFields(exec: Executor, tableId: string): Promise<FormulaField[]> {
  return exec.query<FormulaField & Record<string, unknown>>(
    `SELECT f.id, f.label, n.name, f.kind,
            CASE WHEN f.kind IN ('lookup', 'rollup', 'count', 'button') THEN false
                 WHEN f.kind = 'formula' THEN coalesce(fc.is_stored, true)
                 ELSE true END AS stored,
            coalesce(rc.result_kind, fc.result_kind) AS "resultKind",
            coalesce(rc.is_multiple, false) AS multiple
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
       LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
       LEFT JOIN _basedb.field_rollup_config rc  ON rc.field_id = f.id
      WHERE f.table_id = $1 AND f.is_live`,
    [tableId],
  )
}

const PG_TYPE: Readonly<Record<FormulaType, string>> = {
  number: 'numeric',
  text: 'text',
  boolean: 'boolean',
  date: 'date',
  datetime: 'timestamptz',
  null: 'text',
}

function typeOfField(field: FormulaField | undefined): FormulaType {
  const kind = field?.stored === false ? (field.resultKind ?? '') : (field?.kind ?? '')
  switch (kind) {
    case 'number':
    case 'autonumber':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    default:
      return 'text'
  }
}

/** The formula of a field, read and typed against the table's fields of the day. */
async function compile(
  exec: Executor,
  tableId: string,
  input: FormulaInput,
  self?: string,
): Promise<{
  readonly ast: Node
  readonly type: FormulaType
  readonly dependencies: readonly string[]
  readonly stored: boolean
  readonly timezone: string | null
  readonly generated: string
}> {
  const fields = (await formulaFields(exec, tableId)).filter((f) => f.id !== self)
  const byKey = new Map(fields.map((f) => [labelKey(f.label), f]))
  const byId = new Map(fields.map((f) => [f.id, f]))
  const resolved = resolveFormula(parseFormula(input.expression), byKey, labelKey)

  const timezone = resolved.usesToday ? (input.timezone ?? 'Europe/Paris') : null
  if (timezone !== null) {
    const [known] = await exec.query<{ ok: boolean }>(
      'SELECT true AS ok FROM pg_timezone_names WHERE name = $1 LIMIT 1',
      [timezone],
    )
    if (known === undefined) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'timezone', reason: 'fuseau_inconnu', timezone },
      })
    }
  }

  // The generated column's expression names columns without a table alias.
  const generated = resolved.stored
    ? emitFormula(resolved.ast, {
        field: (id) => quoteIdentifier(byId.get(id)?.name ?? ''),
        typeOf: (id) => typeOfField(byId.get(id)),
        timezone: timezone ?? 'Europe/Paris',
      })
    : ''
  return { ...resolved, timezone, generated }
}

async function writeDependencies(
  exec: Executor,
  fieldId: string,
  tableId: string,
  dependencies: readonly string[],
): Promise<void> {
  await exec.query(
    'DELETE FROM _basedb.field_formula_dependency WHERE formula_field_id = $1',
    [fieldId],
    'delete',
  )
  for (const id of dependencies) {
    await exec.query(
      `INSERT INTO _basedb.field_formula_dependency (formula_field_id, depends_on_field_id, table_id)
       VALUES ($1, $2, $3)`,
      [fieldId, id, tableId],
      'insert',
    )
  }
}

/** A formula field: a generated column when it can be one, else nothing but a tree. */
export async function addFormulaField(
  exec: Executor,
  ctx: RequestContext,
  where: TableRef,
  field: { readonly id: string; readonly name: string; readonly label: string },
  description: string | null,
  input: FormulaInput,
): Promise<string[]> {
  const compiled = await compile(exec, where.tableId, input, field.id)
  await exec.query(
    `INSERT INTO _basedb.field_formula_config
       (field_id, input_expression, ast, result_kind, is_stored, timezone)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
    [
      field.id,
      input.expression,
      JSON.stringify(compiled.ast),
      kindOfType(compiled.type),
      compiled.stored,
      compiled.timezone,
    ],
    'insert',
  )
  await writeDependencies(exec, field.id, where.tableId, compiled.dependencies)
  if (!compiled.stored) return []

  // A generated column rewrites the table under ACCESS EXCLUSIVE (§7.1).
  const relation = qualify(where.schemaName, where.tableName)
  const add = `ALTER TABLE ${relation} ADD COLUMN ${quoteIdentifier(field.name)} ${PG_TYPE[compiled.type]}
  GENERATED ALWAYS AS (${compiled.generated}) STORED;`
  await exec.query(add, [], 'ddl')
  const comment = sqlCommentOnColumn(
    where.schemaName,
    where.tableName,
    field.name,
    commentText(field.label, description),
  )
  await exec.query(comment, [], 'ddl')
  return [add, comment]
}

/**
 * Replaces a formula's expression — §7.7. A stored formula is `DROP COLUMN` then `ADD
 * COLUMN` under the same physical name; one that becomes, or stops being, computed at
 * read time gains or loses its column.
 */
export async function setFormula(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly field: string; readonly formula: FormulaInput },
): Promise<{ readonly stored: boolean; readonly sql: readonly string[] }> {
  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const where = await tableRef(exec, request.tableId)
    const [field] = await exec.query<{
      id: string
      label: string
      description: string | null
      is_stored: boolean
    }>(
      `SELECT f.id, f.label, f.description, fc.is_stored
         FROM _basedb.field f
         JOIN _basedb.physical_name n ON n.id = f.name_id
         JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
        WHERE f.table_id = $1 AND n.name = $2 AND f.is_live AND f.kind = 'formula'`,
      [request.tableId, request.field],
    )
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.field } })
    }
    const compiled = await compile(exec, where.tableId, request.formula, field.id)
    const relation = qualify(where.schemaName, where.tableName)
    const column = quoteIdentifier(request.field)
    const sql: string[] = []
    if (field.is_stored) {
      const drop = `ALTER TABLE ${relation} DROP COLUMN ${column};`
      await exec.query(drop, [], 'ddl')
      sql.push(drop)
    }
    if (compiled.stored) {
      const add = `ALTER TABLE ${relation} ADD COLUMN ${column} ${PG_TYPE[compiled.type]}
  GENERATED ALWAYS AS (${compiled.generated}) STORED;`
      await exec.query(add, [], 'ddl')
      sql.push(add)
      const comment = sqlCommentOnColumn(
        where.schemaName,
        where.tableName,
        request.field,
        commentText(field.label, field.description),
      )
      await exec.query(comment, [], 'ddl')
      sql.push(comment)
    }
    await exec.query(
      `UPDATE _basedb.field_formula_config
          SET input_expression = $2, ast = $3::jsonb, result_kind = $4, is_stored = $5,
              timezone = $6
        WHERE field_id = $1`,
      [
        field.id,
        request.formula.expression,
        JSON.stringify(compiled.ast),
        kindOfType(compiled.type),
        compiled.stored,
        compiled.timezone,
      ],
      'update',
    )
    await writeDependencies(exec, field.id, where.tableId, compiled.dependencies)
    await exec.query(
      'UPDATE _basedb.field SET updated_at = pg_catalog.clock_timestamp(), updated_by = $2 WHERE id = $1',
      [field.id, ctx.actor.id],
      'update',
    )
    return { stored: compiled.stored, sql }
  })
}

async function tableRef(exec: Executor, tableId: string): Promise<TableRef> {
  const [row] = await exec.query<TableRef & Record<string, unknown>>(
    `SELECT t.id AS "tableId", t.base_id AS "baseId",
            tn.name AS "tableName", sn.name AS "schemaName"
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1 AND t.is_live`,
    [tableId],
  )
  if (row === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  return row
}

/** What a lookup may cite: one value per row, stored — never a list, a file or a path. */
const LOOKABLE: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'url',
  'email',
  'user',
  'autonumber',
  'formula',
])

function refuse(reason: string, detail?: Record<string, unknown>): never {
  throw new BasedbError('REQUEST_INVALID', { details: { field: 'rollup', reason, ...detail } })
}

/**
 * A lookup, a rollup or a count — §7 ter: its path checked, its result typed, and a
 * catalog row. No column.
 */
export async function addRollupField(
  exec: Executor,
  ctx: RequestContext,
  where: TableRef,
  field: { readonly id: string; readonly kind: 'lookup' | 'rollup' | 'count' },
  input: RollupInput,
): Promise<void> {
  // The relation followed: of this table (outgoing), or of another aiming here (incoming).
  const incoming = input.viaTable !== undefined && input.viaTable !== ''
  const [via] = await exec.query<{
    id: string
    kind: 'link' | 'multi_link'
    table_id: string
    target_table_id: string
  }>(
    `SELECT f.id, f.kind, f.table_id, lc.target_table_id
       FROM _basedb.field f
       JOIN _basedb.physical_name n      ON n.id = f.name_id
       JOIN _basedb.field_link_config lc ON lc.field_id = f.id
       JOIN _basedb.table_def t          ON t.id = f.table_id
       JOIN _basedb.physical_name tn     ON tn.id = t.name_id
      WHERE n.name = $1 AND f.is_live AND lc.fk_dropped_at IS NULL AND t.is_live
        AND t.base_id = $2 AND tn.name = $3`,
    [input.via, where.baseId, incoming ? input.viaTable : where.tableName],
  )
  if (via === undefined) refuse('relation_inconnue', { via: input.via })
  if (incoming && via.target_table_id !== where.tableId) {
    refuse('relation_ne_designe_pas_la_table', { via: input.via })
  }
  const reachedId = incoming ? via.table_id : via.target_table_id
  // Reading through the relation is reading the table reached: its author must be able to.
  await requireOnTable(exec, ctx, 'read', reachedId)

  let resultKind: FieldKind = 'number'
  let targetId: string | null = null
  if (field.kind !== 'count') {
    if (input.target === undefined || input.target === '') refuse('champ_cible_manquant')
    const [target] = await exec.query<{
      id: string
      kind: FieldKind
      result_kind: FieldKind | null
      stored: boolean
    }>(
      `SELECT f.id, f.kind, fc.result_kind, coalesce(fc.is_stored, true) AS stored
         FROM _basedb.field f
         JOIN _basedb.physical_name n ON n.id = f.name_id
         LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
        WHERE f.table_id = $1 AND n.name = $2 AND f.is_live`,
      [reachedId, input.target],
    )
    if (target === undefined) refuse('champ_cible_inconnu', { target: input.target })
    // One level: a lookup of a lookup would be a list of lists (§7 ter.1).
    if (!LOOKABLE.has(target.kind) || !target.stored) {
      refuse('type_de_champ_incompatible', { target: input.target, kind: target.kind })
    }
    targetId = target.id
    const valueKind: FieldKind =
      target.kind === 'formula'
        ? (target.result_kind ?? 'short_text')
        : target.kind === 'autonumber'
          ? 'number'
          : target.kind
    if (field.kind === 'lookup') {
      resultKind = valueKind
    } else {
      const aggregate = input.aggregate
      if (aggregate === undefined) refuse('agregat_manquant')
      if ((aggregate === 'sum' || aggregate === 'avg') && valueKind !== 'number') {
        refuse('agregat_incompatible', { aggregate, kind: valueKind })
      }
      if (
        (aggregate === 'min' || aggregate === 'max') &&
        !['number', 'date', 'datetime'].includes(valueKind)
      ) {
        refuse('agregat_incompatible', { aggregate, kind: valueKind })
      }
      resultKind = aggregate === 'min' || aggregate === 'max' ? valueKind : 'number'
    }
  }

  const multiple = field.kind === 'lookup' && !(via.kind === 'link' && !incoming)
  await exec.query(
    `INSERT INTO _basedb.field_rollup_config
       (field_id, kind, via_field_id, direction, target_field_id, aggregate, result_kind, is_multiple)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      field.id,
      field.kind,
      via.id,
      incoming ? 'incoming' : 'outgoing',
      targetId,
      field.kind === 'rollup' ? (input.aggregate ?? null) : null,
      resultKind,
      multiple,
    ],
    'insert',
  )
  void ctx
}

/** Allocates the field row of a computed field: a physical name, never a column of its own. */
export async function insertComputedField(
  exec: Executor,
  ctx: RequestContext,
  where: TableRef,
  request: {
    readonly label: string
    readonly kind: FieldKind
    readonly technicalName?: string
    readonly description: string | null
    readonly lineageId?: string
  },
): Promise<{ readonly id: string; readonly name: string }> {
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
        position, created_by, updated_by, lineage_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $9,
             coalesce($10::uuid, _basedb_local.uuid_generate_v7())) RETURNING id`,
    [
      where.tableId,
      where.baseId,
      request.kind,
      column.nameId,
      request.label,
      labelKey(request.label),
      request.description,
      position.n,
      ctx.actor.id,
      request.lineageId ?? null,
    ],
    'insert',
  )
  return { id: field.id, name: column.name }
}
