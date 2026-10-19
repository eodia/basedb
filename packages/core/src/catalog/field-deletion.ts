import { randomUUID } from 'node:crypto'
import { qualify, quoteIdentifier, relegatedName } from '@basedb/naming'
import { quoteLiteral } from '../ddl/emit.js'
import { type Migration, runMigration } from '../ddl/migration.js'
import { BasedbError } from '../errors/index.js'
import { SYSTEM_COLUMNS } from '../rbac/decide.js'
import { requireOnTable } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { dropMultiLinks, loadMultiLinks, truncateBytes } from './lifecycle.js'
import { citedFields, viewLoss } from './views.js'

/**
 * Logical deletion of ONE field — chapter 04 §1.11, chapter 06 §4.1.
 *
 * The field leaves the catalog and its column is relegated as `zz_supprime_<date>_<nom>`:
 * its values stay, readable in direct SQL, and the purge does the real `DROP` later. A bare
 * rename would keep every object the field made, with three consequences nobody could
 * explain: a required field leaving a `NOT NULL` column the API no longer writes (every
 * insert refused), a link leaving a ghost foreign key (deletions of the target refused),
 * a unique index refusing duplicates on a field nobody sees. So the column is stripped
 * first — constraints, indexes, `NOT NULL`, identity, generation — and keeps only its
 * type and its values.
 *
 * What would break is refused BEFORE anything is emitted, and named (§4.6): the display
 * column of its table, a computed field reading it (formula, lookup, rollup, AI prompt,
 * button address), a row rule citing it — a rule that no longer compiles shows its group
 * NO row —, a view built on the column in PostgreSQL. Saved views need nothing: their spec
 * is re-projected on read, and a filter naming a field gone hides the view rather than
 * widening it.
 */

/** Something that reads the field, and would stop working without it. */
export interface FieldUser {
  readonly kind: 'formula' | 'lookup' | 'rollup' | 'count' | 'ai' | 'button' | 'row_rule'
  readonly label: string
  /** The table it lives in, when it is not the field's own. */
  readonly table: string | null
}

/** A view built on the column in PostgreSQL. */
export interface ColumnView {
  /** `alias`: a compatibility alias (chapter 06 §3); `sql_view`: a view of the product. */
  readonly kind: 'alias' | 'sql_view' | 'other'
  readonly name: string
}

/** A saved view of the table that names the field where it matters. */
export interface SavedViewLoss {
  readonly label: string
  readonly loses: 'pivot' | 'filter' | 'setting'
}

export interface FieldDeletionPreview {
  readonly label: string
  readonly kind: string
  /** The display column of its table: designate another one first (A15). */
  readonly isDisplay: boolean
  readonly usedBy: readonly FieldUser[]
  readonly views: readonly ColumnView[]
  /**
   * Saved views that lose something with it — not a refusal: their spec is re-projected on
   * read, a pivot gone leaves the view empty and a filter gone hides it, both said there.
   */
  readonly savedViews: readonly SavedViewLoss[]
  /** The tables a link's foreign key locks briefly when it is dropped. */
  readonly lockedTables: readonly string[]
  /** A link in `ON DELETE CASCADE`: deleting a target row will no longer take rows here. */
  readonly cascadeLost: boolean
  /** The column's name once relegated; `null` for a field without a column. */
  readonly relegatedName: string | null
}

interface Located extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly kind: string
  readonly name: string
  readonly name_id: string
  readonly table_id: string
  readonly table_label: string
  readonly table_name: string
  readonly base_id: string
  readonly schema_name: string
  readonly structure_state: string
  readonly is_display: boolean
}

async function locate(exec: Executor, ctx: RequestContext, fieldId: string): Promise<Located> {
  const [field] = await exec.query<Located>(
    `SELECT f.id::text, f.label, f.kind, n.name, f.name_id::text, t.id::text AS table_id,
            t.label AS table_label, tn.name AS table_name, t.base_id::text,
            sn.name AS schema_name, b.structure_state,
            coalesce(t.display_field_id = f.id, false) AS is_display
       FROM _basedb.field f
       JOIN _basedb.physical_name n  ON n.id = f.name_id
       JOIN _basedb.table_def t      ON t.id = f.table_id AND t.deleted_at IS NULL
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
       JOIN _basedb.base b           ON b.id = t.base_id AND b.deleted_at IS NULL
       JOIN _basedb.tenant te        ON te.id = b.tenant_id
      WHERE f.id = $1 AND f.deleted_at IS NULL AND te.ref = $2`,
    [fieldId, ctx.tenantId],
  )
  // A system column has no field of its own to delete.
  if (field === undefined || SYSTEM_COLUMNS.includes(field.name)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: fieldId } })
  }
  return field
}

/** `{{nom}}` as a prompt or an address cites a column, spaces allowed inside the braces. */
const citation = (name: string) => `\\{\\{\\s*${name}\\s*\\}\\}`

async function usersOf(exec: Executor, field: Located): Promise<FieldUser[]> {
  const formulas = await exec.query<{ label: string }>(
    `SELECT ff.label
       FROM _basedb.field_formula_dependency d
       JOIN _basedb.field ff ON ff.id = d.formula_field_id AND ff.deleted_at IS NULL
      WHERE d.depends_on_field_id = $1
      ORDER BY ff.position`,
    [field.id],
  )

  // A lookup, a rollup or a count reads THROUGH a relation (`via`) and/or reads a field
  // at the other end (`target`) — in this table or in another one.
  const computed = await exec.query<{
    kind: 'lookup' | 'rollup' | 'count'
    label: string
    table_id: string
    table_label: string
  }>(
    `SELECT rf.kind, rf.label, rt.id::text AS table_id, rt.label AS table_label
       FROM _basedb.field_rollup_config rc
       JOIN _basedb.field rf     ON rf.id = rc.field_id AND rf.deleted_at IS NULL
       JOIN _basedb.table_def rt ON rt.id = rf.table_id AND rt.deleted_at IS NULL
      WHERE rc.via_field_id = $1 OR rc.target_field_id = $1
      ORDER BY rt.label, rf.position`,
    [field.id],
  )

  const prompts = await exec.query<{ label: string }>(
    `SELECT f.label
       FROM _basedb.field_ai_config c
       JOIN _basedb.field f ON f.id = c.field_id AND f.deleted_at IS NULL
      WHERE f.table_id = $1 AND f.id <> $2 AND c.prompt ~ $3
      ORDER BY f.position`,
    [field.table_id, field.id, citation(field.name)],
  )

  const buttons = await exec.query<{ label: string }>(
    `SELECT f.label
       FROM _basedb.field_button_config c
       JOIN _basedb.field f ON f.id = c.field_id AND f.deleted_at IS NULL
      WHERE f.table_id = $1 AND c.url_template ~ $2
      ORDER BY f.position`,
    [field.table_id, citation(field.name)],
  )

  // A row rule is a filter on physical names: compiled without the field, it fails, and a
  // rule that fails shows its group NOTHING (`FALSE`) — a lock-out nobody asked for.
  const rules = await exec.query<{ label: string; filter: string }>(
    `SELECT r.label, rp.filter
       FROM _basedb.row_permission rp
       JOIN _basedb.role r ON r.id = rp.role_id
      WHERE rp.table_id = $1
      ORDER BY r.label`,
    [field.table_id],
  )

  return [
    ...formulas.map((f) => ({ kind: 'formula' as const, label: f.label, table: null })),
    ...computed.map((c) => ({
      kind: c.kind,
      label: c.label,
      table: c.table_id === field.table_id ? null : c.table_label,
    })),
    ...prompts.map((p) => ({ kind: 'ai' as const, label: p.label, table: null })),
    ...buttons.map((b) => ({ kind: 'button' as const, label: b.label, table: null })),
    ...rules
      .filter((r) => citedFields(r.filter).includes(field.name))
      .map((r) => ({ kind: 'row_rule' as const, label: r.label, table: null })),
  ]
}

interface Column extends Record<string, unknown> {
  readonly notnull: boolean
  readonly identity: boolean
  readonly generated: boolean
}

/** The column as PostgreSQL has it — `undefined` for a field that has none (a lookup…). */
async function columnOf(exec: Executor, field: Located): Promise<Column | undefined> {
  const [column] = await exec.query<Column>(
    `SELECT a.attnotnull AS notnull, a.attidentity <> '' AS identity,
            a.attgenerated <> '' AS generated
       FROM pg_attribute a
      WHERE a.attrelid = to_regclass($1) AND a.attname = $2 AND NOT a.attisdropped`,
    [qualify(field.schema_name, field.table_name), field.name],
  )
  return column
}

/**
 * The views PostgreSQL built on the column — by attribute number, which is how it tracks
 * them: a `RENAME COLUMN` would go through, and the view would keep showing the values of
 * a field said to be gone.
 */
async function viewsOn(exec: Executor, field: Located): Promise<ColumnView[]> {
  const rows = await exec.query<{
    schema: string
    name: string
    alias: boolean
    label: string | null
  }>(
    `SELECT DISTINCT dn.nspname AS schema, dc.relname AS name,
            EXISTS (SELECT 1 FROM _basedb.sql_view_alias v
                      JOIN _basedb.physical_name vn ON vn.id = v.name_id
                      JOIN _basedb.db_schema vs     ON vs.id = v.schema_id
                      JOIN _basedb.physical_name vsn ON vsn.id = vs.name_id
                     WHERE v.dropped_at IS NULL AND vn.name = dc.relname
                       AND vsn.name = dn.nspname) AS alias,
            (SELECT sv.label FROM _basedb.sql_view sv
               JOIN _basedb.physical_name svn ON svn.id = sv.name_id
               JOIN _basedb.db_schema ss      ON ss.id = sv.schema_id
               JOIN _basedb.physical_name ssn ON ssn.id = ss.name_id
              WHERE svn.name = dc.relname AND ssn.name = dn.nspname
              LIMIT 1) AS label
       FROM pg_attribute a
       JOIN pg_depend d     ON d.refclassid = 'pg_class'::regclass AND d.refobjid = a.attrelid
                           AND d.refobjsubid = a.attnum
       JOIN pg_rewrite r    ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
       JOIN pg_class dc     ON dc.oid = r.ev_class
       JOIN pg_namespace dn ON dn.oid = dc.relnamespace
      WHERE a.attrelid = to_regclass($1) AND a.attname = $2 AND dc.oid <> a.attrelid
      ORDER BY 1, 2`,
    [qualify(field.schema_name, field.table_name), field.name],
  )
  return rows.map((r) =>
    r.alias
      ? { kind: 'alias' as const, name: `${r.schema}.${r.name}` }
      : r.label !== null
        ? { kind: 'sql_view' as const, name: r.label }
        : { kind: 'other' as const, name: `${r.schema}.${r.name}` },
  )
}

interface Link extends Record<string, unknown> {
  readonly kind: 'link' | 'multi_link'
  readonly on_delete: string
  readonly target_label: string
}

async function linkOf(exec: Executor, field: Located): Promise<Link | undefined> {
  const [link] = await exec.query<Link>(
    `SELECT lc.kind, lc.on_delete, tt.label AS target_label
       FROM _basedb.field_link_config lc
       JOIN _basedb.table_def tt ON tt.id = lc.target_table_id
      WHERE lc.field_id = $1 AND lc.fk_dropped_at IS NULL`,
    [field.id],
  )
  return link
}

/**
 * The relegated name, free in the registry of the table AND among its columns — a column
 * relegated by hand, or predating basedb, may hold it without the registry knowing (§4.1).
 */
async function freeColumnName(exec: Executor, field: Located, at: Date): Promise<string> {
  const wanted = relegatedName(field.name, at)
  for (let rank = 1; rank <= 99; rank++) {
    const suffix = rank === 1 ? '' : `_${rank}`
    const candidate = `${truncateBytes(wanted, 63 - Buffer.byteLength(suffix, 'utf8'))}${suffix}`
    const [taken] = await exec.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM _basedb.physical_name WHERE scope_id = $1 AND name = $2)
            + (SELECT count(*) FROM pg_attribute
                WHERE attrelid = to_regclass($3) AND attname = $2) AS n`,
      [field.table_id, candidate, qualify(field.schema_name, field.table_name)],
    )
    if (Number(taken?.n ?? 0) === 0) return candidate
  }
  throw new BasedbError('NAME_COLLISION_UNRESOLVED', { details: { name: wanted } })
}

/** The collaborative views, and the reader's own: another person's are theirs to know. */
async function savedViewsOf(
  exec: Executor,
  ctx: RequestContext,
  field: Located,
): Promise<SavedViewLoss[]> {
  const views = await exec.query<{ label: string; spec: Record<string, unknown> }>(
    `SELECT label, spec FROM _basedb.view_def
      WHERE table_id = $1 AND deleted_at IS NULL AND (owner_id IS NULL OR owner_id = $2)
      ORDER BY position, label`,
    [field.table_id, ctx.actor.id],
  )
  return views.flatMap((v) => {
    const loses = viewLoss(v.spec ?? {}, field.name)
    return loses === null ? [] : [{ label: v.label, loses }]
  })
}

/** What deleting a field would do, WITHOUT doing it — for the confirmation screen. */
export async function previewFieldDeletion(
  pools: Pools,
  ctx: RequestContext,
  fieldId: string,
): Promise<FieldDeletionPreview> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const field = await locate(exec, ctx, fieldId)
      await requireOnTable(exec, ctx, 'manage_schema', field.table_id)
      const link = await linkOf(exec, field)
      const column = await columnOf(exec, field)
      return {
        label: field.label,
        kind: field.kind,
        isDisplay: field.is_display,
        usedBy: await usersOf(exec, field),
        views: column === undefined ? [] : await viewsOn(exec, field),
        savedViews: await savedViewsOf(exec, ctx, field),
        lockedTables:
          link === undefined || link.target_label === field.table_label ? [] : [link.target_label],
        cascadeLost: link?.on_delete === 'cascade',
        relegatedName: column === undefined ? null : relegatedName(field.name, ctx.timestamp),
      }
    },
    { readOnly: true },
  )
}

/**
 * Deletes one field, logically — one migration, one step under a short exclusive lock:
 * every statement of §1.11 is instantaneous, none rewrites the table.
 */
export async function deleteField(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string },
): Promise<Migration> {
  const plan = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const field = await locate(exec, ctx, request.fieldId)
    if (field.structure_state === 'frozen') {
      throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: field.base_id } })
    }
    await requireOnTable(exec, ctx, 'manage_schema', field.table_id)

    // The refusals, in the order of §1.11 — all before a single statement is planned.
    if (field.is_display) {
      throw new BasedbError('DISPLAY_FIELD_IN_USE', {
        details: { field: field.label, table: field.table_label },
      })
    }
    const users = await usersOf(exec, field)
    if (users.length > 0) {
      throw new BasedbError('FIELD_USED_BY_FORMULA', {
        details: { field: field.label, by: users },
      })
    }
    const column = await columnOf(exec, field)
    const views = column === undefined ? [] : await viewsOn(exec, field)
    const alias = views.filter((v) => v.kind === 'alias')
    if (alias.length > 0) {
      throw new BasedbError('COLUMN_HAS_VIEW_DEPENDENCIES', {
        details: { field: field.label, views: alias.map((v) => v.name) },
      })
    }
    const blocker = views[0]
    if (blocker !== undefined) {
      throw new BasedbError('DEPENDENT_OBJECT', {
        details: {
          dependent: blocker.name,
          referenced: field.label,
          ...(blocker.kind === 'sql_view' ? { kind: 'sql_view' } : {}),
        },
      })
    }

    const at = ctx.timestamp
    const stamp = quoteLiteral(at.toISOString())
    const actor = quoteLiteral(ctx.actor.id)
    const id = `${quoteLiteral(field.id)}::uuid`
    const table = qualify(field.schema_name, field.table_name)
    const statements: string[] = []

    // 4–6. The foreign key and the triggers of a relation, every constraint and index the
    // field is a member of. Constraints first: an index backing one goes with it.
    const link = await linkOf(exec, field)
    if (link?.kind === 'multi_link') {
      statements.push(...dropMultiLinks(await loadMultiLinks(exec, 'f.id = $1', field.id), stamp))
    } else if (link !== undefined) {
      statements.push(
        `UPDATE _basedb.field_link_config SET fk_dropped_at = ${stamp}::timestamptz WHERE field_id = ${id};`,
      )
    }

    const constraints = await exec.query<{ id: string; name: string }>(
      `SELECT DISTINCT c.id::text, n.name
         FROM _basedb.table_constraint c
         JOIN _basedb.table_constraint_member m ON m.constraint_id = c.id
         JOIN _basedb.physical_name n           ON n.id = c.name_id
        WHERE m.field_id = $1 AND c.state <> 'dropped' AND c.kind <> 'primary_key'
        ORDER BY 2`,
      [field.id],
    )
    for (const c of constraints) {
      statements.push(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(c.name)};`)
      statements.push(
        `UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = ${stamp}::timestamptz, state_changed_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(c.id)}::uuid;`,
      )
    }

    const indexes = await exec.query<{ id: string; name: string }>(
      `SELECT DISTINCT ix.id::text, n.name
         FROM _basedb.table_index ix
         JOIN _basedb.table_index_member m ON m.index_id = ix.id
         JOIN _basedb.physical_name n      ON n.id = ix.name_id
        WHERE m.field_id = $1 AND ix.state <> 'dropped'
        ORDER BY 2`,
      [field.id],
    )
    for (const ix of indexes) {
      statements.push(`DROP INDEX IF EXISTS ${qualify(field.schema_name, ix.name)};`)
      statements.push(
        `UPDATE _basedb.table_index SET state = 'dropped', dropped_at = ${stamp}::timestamptz, state_changed_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(ix.id)}::uuid;`,
      )
    }

    // 7–8. The column keeps its type and its values, and imposes nothing on anyone: no
    // generation that a write of another column would recompute (and could fail on), no
    // identity, no `NOT NULL` — the most important line, without which every later insert
    // fails on a column the API no longer writes. Then the relegated name.
    const nameId = randomUUID()
    const relegated = column === undefined ? null : await freeColumnName(exec, field, at)
    if (column !== undefined && relegated !== null) {
      const col = quoteIdentifier(field.name)
      if (column.generated)
        statements.push(`ALTER TABLE ${table} ALTER COLUMN ${col} DROP EXPRESSION;`)
      if (column.identity)
        statements.push(`ALTER TABLE ${table} ALTER COLUMN ${col} DROP IDENTITY;`)
      // An identity is NOT NULL by construction, whatever `attnotnull` said before its drop.
      if (column.notnull || column.identity) {
        statements.push(`ALTER TABLE ${table} ALTER COLUMN ${col} DROP NOT NULL;`)
      }
      statements.push(`ALTER TABLE ${table} RENAME COLUMN ${col} TO ${quoteIdentifier(relegated)};`)
    }

    // The registry: the old name retired, never freed; the new one relegated and chained.
    // A field without a column gets the same bookkeeping, so that its name is not reused
    // either and the restoration of a base leaves it deleted.
    const registered = relegated ?? (await freeColumnName(exec, field, at))
    statements.push(`INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version,
        previous_name_id, allocated_by)
VALUES (${quoteLiteral(nameId)}::uuid, 'table', ${quoteLiteral(field.table_id)}::uuid,
        ${quoteLiteral(registered)}, 'field', 'relegated', 1,
        ${quoteLiteral(field.name_id)}::uuid, ${actor}::uuid);`)
    statements.push(`UPDATE _basedb.physical_name
   SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(field.name_id)}::uuid;`)

    statements.push(`UPDATE _basedb.field
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid, is_live = false,
       name_id = ${quoteLiteral(nameId)}::uuid, is_required = false, required_state = 'absent'
 WHERE id = ${id};`)

    return {
      baseId: field.base_id,
      label: field.label,
      tableLabel: field.table_label,
      relegated,
      locked:
        link === undefined || link.target_label === field.table_label ? [] : [link.target_label],
      statements,
    }
  })

  return runMigration(pools, ctx, {
    baseId: plan.baseId,
    label: `Suppression logique du champ « ${plan.label} » de « ${plan.tableLabel} »`,
    origin: ctx.surface === 'mcp' ? 'mcp' : ctx.surface === 'rest' ? 'rest' : 'ui',
    steps: [
      { label: `Reléguer « ${plan.label} »`, statements: plan.statements, lock: 'exclusive' },
    ],
    catalogDiff: {
      operation: 'delete_field',
      table: plan.tableLabel,
      field: plan.label,
      relegated_name: plan.relegated,
      locked_tables: plan.locked,
    },
    affectedObjects: [{ kind: 'field', label: plan.label, relegated: plan.relegated }],
  })
}
