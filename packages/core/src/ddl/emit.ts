import {
  SYSTEM_COLUMNS,
  primaryKeyName,
  qualify,
  quoteIdentifier,
  triggerName,
} from '@basedb/naming'
import { BasedbError } from '../errors/index.js'

/**
 * DDL generation — chapter 03 §7, chapter 04.
 *
 * Every identifier emitted here is quoted and qualified without exception (chapter 01
 * §10.1). No user-supplied string is concatenated: only physical names from the
 * registry are, and `quoteIdentifier` re-validates alphabet B before emitting — that is
 * an assertion, not sanitization.
 */

/**
 * The nine field types of v1, the multiple choice, the two kinds that carry files, and the
 * field a model fills.
 */
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
  | 'multi_link'
  | 'formula'
  | 'file'
  | 'image'
  | 'url'
  | 'email'
  | 'autonumber'
  | 'user'
  | 'lookup'
  | 'rollup'
  | 'count'
  | 'button'

/**
 * The kinds whose value the kernel computes and nobody writes: a formula, from its
 * expression. A field computed by the AI is computed too, but that is an OPTION of the
 * field (`field_ai_config`), not a kind: its readers test the option, not this set. The
 * decider withholds both from every write mask, whatever a role grants.
 */
export const COMPUTED_KINDS: ReadonlySet<string> = new Set([
  'formula',
  'autonumber',
  'lookup',
  'rollup',
  'count',
  'button',
])

/**
 * The kinds that have no column at all — computed at read time through a relation
 * (chapter 04 §7 ter). A formula may be one too, when it is not stored (§7.1): that is a
 * property of the field, read with `loadFields(…).stored`, not of its kind.
 */
export const READ_TIME_KINDS: ReadonlySet<string> = new Set(['lookup', 'rollup', 'count'])

/** The kinds with no column and no value at all: a button (chapter 17 §4). */
export const VALUELESS_KINDS: ReadonlySet<string> = new Set(['button'])

/** The longest address a `url` field holds — what browsers and mail clients all accept. */
export const MAX_URL_CHARS = 2048

/**
 * What a `url` field accepts: an `http(s)` address or a `mailto:`, nothing else — never a
 * `javascript:` a reader would click. The kernel's copy of the column's `CHECK`.
 */
export const URL_PATTERN = /^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s]+)$/i

/**
 * The body of the `ck_…__url` of a `url` column: the same rule as {@link URL_PATTERN},
 * written for PostgreSQL, so that direct SQL is held to it too.
 */
export function urlCheck(column: string): string {
  return `${column} IS NULL OR (char_length(${column}) <= ${MAX_URL_CHARS} AND ${column} ~* '^(https?://[^[:space:]]+|mailto:[^[:space:]@]+@[^[:space:]]+)$')`
}

/** The longest address an `email` field holds (RFC 5321's path limit). */
export const MAX_EMAIL_CHARS = 254

/**
 * What an `email` field accepts: one address, a local part, an `@`, a domain with a dot.
 * Deliberately loose — the only proof an address works is a message that arrives — but it
 * refuses what is plainly not one. The kernel's copy of the column's `CHECK`.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The body of the `ck_…__email` of an `email` column, for PostgreSQL. */
export function emailCheck(column: string): string {
  return `${column} IS NULL OR (char_length(${column}) <= ${MAX_EMAIL_CHARS} AND ${column} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')`
}

/**
 * The nullability a column is declared with. An autonumber is an identity, which
 * PostgreSQL always holds `NOT NULL`: saying `NULL` would contradict it.
 */
export function nullabilityOf(kind: FieldKind, required: boolean): string {
  if (kind === 'autonumber') return ''
  return required && kind !== 'formula' ? 'NOT NULL' : 'NULL'
}

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
    // An address, as text: the interface draws it as a link, the CHECK keeps it one.
    case 'url':
    case 'email':
      return 'text'
    // A number the database gives each row, in order, from the day the field exists — the
    // rows already there included, numbered as the table stores them.
    case 'autonumber':
      return 'bigint GENERATED BY DEFAULT AS IDENTITY'
    // The identifier of a user of the tenant, with no foreign key across `_basedb` (A9).
    case 'user':
      return 'uuid'
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
    // The target rows, in the order they were linked: no foreign key can bear on an array,
    // so two shared triggers hold the list to the target (chapter 04 §4 bis).
    case 'multi_link':
      return 'uuid[]'
    case 'formula':
      // A formula's type is the type of its result; the column is generated `STORED`.
      // It is therefore not decidable without the expression tree.
      throw new BasedbError('INTERNAL_ERROR', {
        details: { reason: 'a formula type comes from its result', kind },
      })
    // Computed at read time: no column exists (chapter 04 §7 ter).
    case 'lookup':
    case 'rollup':
    case 'count':
    case 'button':
      throw new BasedbError('INTERNAL_ERROR', {
        details: { reason: 'a field computed at read time has no column', kind },
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
    // which cannot be required, and an autonumber, which always is.
    const nullability = nullabilityOf(c.kind, c.required)
    return `${quoteIdentifier(c.name).padEnd(13)} ${type} ${nullability}`.trimEnd()
  })

  const lines = [
    ...SYSTEM_COLUMN_DEFINITIONS,
    ...userColumns,
    `CONSTRAINT ${quoteIdentifier(primaryKeyName(tableName))} PRIMARY KEY ("_id")`,
  ]

  return `CREATE TABLE ${qualify(schemaName, tableName)} (\n  ${lines.join(',\n  ')}\n);`
}

/** The version of the capture contract every trigger of this build references (07 §17). */
export const CAPTURE_FORMAT_VERSION = 1

/** The five roles of the triggers installed on a user table — the closed list of 07 §1.2. */
export const TRIGGER_ROLES = [
  'system',
  'capture_ins',
  'capture_upd',
  'capture_del',
  'capture_trunc',
] as const

/**
 * The five triggers of a user table — chapter 07 §1.2, normative.
 *
 * `system` keeps `_updated_at` and `_updated_by` honest whoever writes; the three
 * `capture_*` feed the history buffers, one per operation since PostgreSQL refuses
 * transition tables on a multi-event trigger; `capture_trunc` refuses `TRUNCATE`, which
 * no DML trigger would see. The capture arguments are the table's catalog keys and the
 * format version: they never change, so no column migration ever recreates a trigger.
 */
export function sqlTableTriggers(
  schemaName: string,
  tableName: string,
  baseId: string,
  tableId: string,
): { readonly names: readonly string[]; readonly statements: readonly string[] } {
  const on = qualify(schemaName, tableName)
  const name = (role: (typeof TRIGGER_ROLES)[number]) =>
    quoteIdentifier(triggerName(tableName, role))
  const capture = `_basedb_local.capture_v1(${quoteLiteral(baseId)}, ${quoteLiteral(tableId)}, '${CAPTURE_FORMAT_VERSION}')`
  return {
    names: TRIGGER_ROLES.map((role) => triggerName(tableName, role)),
    statements: [
      `CREATE TRIGGER ${name('system')} BEFORE INSERT OR UPDATE ON ${on}
  FOR EACH ROW EXECUTE FUNCTION _basedb_local.set_updated_at();`,
      `CREATE TRIGGER ${name('capture_ins')} AFTER INSERT ON ${on}
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION ${capture};`,
      `CREATE TRIGGER ${name('capture_upd')} AFTER UPDATE ON ${on}
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION ${capture};`,
      `CREATE TRIGGER ${name('capture_del')} AFTER DELETE ON ${on}
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION ${capture};`,
      `CREATE TRIGGER ${name('capture_trunc')} BEFORE TRUNCATE ON ${on}
  FOR EACH STATEMENT EXECUTE FUNCTION _basedb_local.assert_no_truncate();`,
    ],
  }
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
