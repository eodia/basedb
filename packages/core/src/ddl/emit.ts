import { SYSTEM_COLUMNS, primaryKeyName, qualify, quoteIdentifier } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'

/**
 * DDL generation — chapter 03 §7, chapter 04.
 *
 * Every identifier emitted here is quoted and qualified without exception (chapter 01
 * §10.1). No user-supplied string is concatenated: only physical names from the
 * registry are, and `quoteIdentifier` re-validates alphabet B before emitting — that is
 * an assertion, not sanitization.
 */

/** The nine field types of v1, the multiple choice, and the two kinds that carry files. */
export type FieldKind =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'link'
  | 'formula'
  | 'file'
  | 'image'

/** True when the column holds a list of files rather than a value (chapter 04 §3 bis). */
export const isFileKind = (kind: string): kind is 'file' | 'image' =>
  kind === 'file' || kind === 'image'

/** True for the two kinds whose values are drawn from a list of options. */
export const isChoiceKind = (kind: string): kind is 'select' | 'multi_select' =>
  kind === 'select' || kind === 'multi_select'

export interface NumberConfig {
  readonly precision?: number
  readonly scale?: number
}

/**
 * Projection to PostgreSQL — chapter 04, summary table.
 *
 * `text` rather than `varchar(n)`: length is a check constraint, which can be relaxed
 * without rewriting the table. `numeric` rather than `double precision`: an amount must
 * not drift. `timestamptz` rather than `timestamp`: an absolute instant, rendered in the
 * session's time zone, which the connection contract pins to UTC.
 */
export function pgTypeOf(kind: FieldKind, config: NumberConfig = {}): string {
  switch (kind) {
    case 'short_text':
    case 'long_text':
    case 'select':
      return 'text'
    case 'number': {
      const p = config.precision ?? 38
      const s = config.scale ?? 10
      if (!Number.isInteger(p) || !Number.isInteger(s) || p < 1 || p > 1000 || s < 0 || s > p) {
        throw new BasedbError('VALUE_OUT_OF_RANGE', { details: { precision: p, scale: s } })
      }
      return `numeric(${p},${s})`
    }
    // An array, never a string with separators: the list stays filterable with `&&` and
    // `@>`, and its CHECK is written against the elements themselves.
    case 'multi_select':
      return 'text[]'
    // The bytes live in the file storage; the column holds what a reader needs to list
    // them — identifier, name, type, size — as a JSON array.
    case 'file':
    case 'image':
      return 'jsonb'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'timestamptz'
    case 'link':
      return 'uuid'
    case 'formula':
      // A formula's type is the type of its result; the column is generated `STORED`.
      // It is therefore not decidable without the expression tree.
      throw new BasedbError('INTERNAL_ERROR', {
        details: { reason: 'a formula type comes from its result', kind },
      })
  }
}

/**
 * The body of the `ck_…__enum` of a choice column, given its column already quoted.
 *
 * `IN` for one value. For several, `<@` holds every element to the list, and two more
 * terms close the gaps containment leaves open: an empty array — which `NOT NULL` would
 * let through as "filled" — and a nested one, which `<@` flattens without complaint.
 * A `NULL` element needs no term of its own: it is contained in nothing.
 */
export function choiceCheck(
  kind: 'select' | 'multi_select',
  column: string,
  values: readonly string[],
): string {
  const list = values.map(quoteLiteral).join(', ')
  return kind === 'select'
    ? `${column} IN (${list})`
    : `cardinality(${column}) > 0 AND array_ndims(${column}) = 1 AND ${column} <@ ARRAY[${list}]::text[]`
}

/** The most files one cell holds — the bound of the `ck_…__files` of every file column. */
export const MAX_FILES_PER_VALUE = 20

/**
 * The body of the `ck_…__files` of a `file` or `image` column: a JSON ARRAY of one to
 * {@link MAX_FILES_PER_VALUE} entries. Empty is written `NULL`, so that `NOT NULL` means
 * "at least one file".
 *
 * A `CASE`, not an `AND`: PostgreSQL does not promise to evaluate an `AND` left to right,
 * and `jsonb_array_length` raises on a scalar instead of answering false. And `IS NULL`
 * first, spelled out: the `CASE` answers false for a `NULL`, and the column is born `NULL`
 * on every row of a table that already has some.
 */
export function fileShapeCheck(column: string): string {
  return `${column} IS NULL OR CASE WHEN jsonb_typeof(${column}) = 'array' THEN jsonb_array_length(${column}) BETWEEN 1 AND ${MAX_FILES_PER_VALUE} ELSE false END`
}

/** `CREATE SCHEMA` for a base (chapter 03 §7.1). */
export function sqlCreateSchema(schemaName: string): string {
  return `CREATE SCHEMA ${quoteIdentifier(schemaName)};`
}

/**
 * `DROP SCHEMA … RESTRICT`, never `CASCADE` (invariant I-DDL-3).
 *
 * A purge removes tables one by one, in reverse topological order; the final `RESTRICT`
 * is a safety net, not a means.
 */
export function sqlDropSchema(schemaName: string): string {
  return `DROP SCHEMA ${quoteIdentifier(schemaName)} RESTRICT;`
}

export interface ColumnSpec {
  readonly name: string
  readonly kind: FieldKind
  readonly required: boolean
  readonly numberConfig?: NumberConfig
}

/**
 * The five system columns, present on EVERY user table (chapter 01 §8).
 *
 * `_created_by` and `_updated_by` carry NO foreign key: no constraint crosses the
 * `_basedb` boundary (A9), otherwise a future physical separation of the catalog would
 * become impossible.
 */
const SYSTEM_COLUMN_DEFINITIONS = [
  '"_id"         uuid NOT NULL DEFAULT "_basedb_local"."uuid_generate_v7"()',
  '"_created_at" timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()',
  '"_updated_at" timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()',
  '"_created_by" uuid NULL',
  '"_updated_by" uuid NULL',
] as const

/**
 * `CREATE TABLE` for a user table — template of chapter 03 §7.2.
 *
 * The primary key is named explicitly `pk_<table>`: the name must be readable in an
 * error message and known to the registry, never left to PostgreSQL's automatic naming,
 * which truncates at 63 bytes and appends a counter on collision — the registry would
 * then record a name the database did not assign.
 */
export function sqlCreateTable(
  schemaName: string,
  tableName: string,
  columns: readonly ColumnSpec[],
): string {
  for (const c of columns) {
    if ((SYSTEM_COLUMNS as readonly string[]).includes(c.name)) {
      throw new BasedbError('IDENTIFIER_INVALID', {
        details: { column: c.name, reason: 'reserved system column' },
      })
    }
  }

  const userColumns = columns.map((c) => {
    const type = pgTypeOf(c.kind, c.numberConfig)
    // `NOT NULL` is added to any column whose `is_required` is true — except `formula`,
    // which cannot be required.
    const nullability = c.required && c.kind !== 'formula' ? 'NOT NULL' : 'NULL'
    return `${quoteIdentifier(c.name).padEnd(13)} ${type} ${nullability}`
  })

  const lines = [
    ...SYSTEM_COLUMN_DEFINITIONS,
    ...userColumns,
    `CONSTRAINT ${quoteIdentifier(primaryKeyName(tableName))} PRIMARY KEY ("_id")`,
  ]

  return `CREATE TABLE ${qualify(schemaName, tableName)} (\n  ${lines.join(',\n  ')}\n);`
}

/** `DROP TABLE … RESTRICT`: undoing a creation, never a cascade. */
export function sqlDropTable(schemaName: string, tableName: string): string {
  return `DROP TABLE ${qualify(schemaName, tableName)} RESTRICT;`
}

/**
 * `COMMENT ON`, meant for direct SQL consumers.
 *
 * This is what makes the database readable in `psql` without opening the product: the
 * business label appears in `\d+`, where the physical name alone would say nothing.
 */
export function sqlCommentOnTable(schemaName: string, tableName: string, label: string): string {
  return `COMMENT ON TABLE ${qualify(schemaName, tableName)} IS ${quoteLiteral(label)};`
}

export function sqlCommentOnColumn(
  schemaName: string,
  tableName: string,
  columnName: string,
  label: string,
): string {
  const target = `${qualify(schemaName, tableName)}.${quoteIdentifier(columnName)}`
  return `COMMENT ON COLUMN ${target} IS ${quoteLiteral(label)};`
}

/**
 * SQL literal.
 *
 * `COMMENT ON` accepts no bound parameter: the label, which comes from the user, must
 * therefore be escaped here. This is one of the rare exceptions to "values always go
 * through bound parameters" (chapter 01 §10.2), and it is confined to this single use.
 */
export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}
