import { qualify, quoteIdentifier } from '@basedb/naming'
import type { PoolClient } from 'pg'
import { writeAudit } from '../audit/journal.js'
import { quoteLiteral } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { allocateName } from '../naming/allocation.js'
import { decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import { loadBaseTarget, visibleInside } from '../rbac/require.js'
import { type Executor, type Pools, executorOf } from '../runtime/pool.js'
import { readerReach } from '../sql/reader.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { normalizeDescription } from './description.js'
import { type Look, type LookInput, normalizeLook, touchesLook } from './look.js'
import { labelKey } from './operations.js'

/**
 * SQL views — chapter 11 §1.8: real PostgreSQL views of a base's schema, which the
 * navigation lists among its tables, dressed like one — a colour, a pictogram — and marked
 * as a view.
 *
 * The catalog names them, keeps the text they were written with and how they look;
 * PostgreSQL keeps what they are. They are created `WITH (security_invoker = true)`: a view
 * reads its tables with the rights of whoever reads IT, so a view is never a way round a
 * mask. Whoever manages the base reads it through the console; everyone else through their
 * own role (`sql/reader.ts`), where a field hidden from them is a column PostgreSQL
 * refuses. The navigation spares them that refusal: a view that reads a table or a field
 * someone cannot read is not listed for them.
 *
 * Building one is building the base (05 §9): `manage_schema` on it. A view reads this base
 * only — its tables, its other views, and PostgreSQL's own catalog —, which is checked on
 * what PostgreSQL recorded it depends on, not on the text.
 */

export interface SqlView extends Look {
  readonly id: string
  readonly baseId: string
  /** Its name in the schema — what one writes after `FROM`. */
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly definition: string
  /**
   * Why a structure operation had to take the view out of PostgreSQL, `null` while it
   * stands. Its definition stays, to be corrected.
   */
  readonly broken: string | null
  /** The caller may change it: they manage the base's structure. */
  readonly editable: boolean
  readonly updatedAt: string
}

/** A view as the navigation lists it, among the tables of its base. */
export interface SqlViewSummary extends Look {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly broken: boolean
}

export interface SqlViewInput {
  readonly label?: string
  /** A technical name, instead of one derived from the label. At creation only. */
  readonly name?: string
  readonly description?: string | null
  readonly definition?: string
  readonly look?: LookInput
}

const MAX_DEFINITION_CHARS = 100_000
const MAX_LABEL_CHARS = 255

/** The schemas every role reads: a view may cite them without citing another base. */
const SHARED_SCHEMAS: ReadonlySet<string> = new Set(['pg_catalog', 'information_schema'])

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly base_id: string
  readonly name: string
  readonly schema_name: string
  readonly label: string
  readonly description: string | null
  readonly definition: string
  readonly broken_reason: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly updated_at: string
}

const SELECT = `
  SELECT v.id::text, v.base_id::text, vn.name, sn.name AS schema_name, v.label, v.description,
         v.definition, v.broken_reason, v.color, v.icon, v.image, v.updated_at::text
    FROM _basedb.sql_view v
    JOIN _basedb.physical_name vn ON vn.id = v.name_id
    JOIN _basedb.db_schema s      ON s.id = v.schema_id
    JOIN _basedb.physical_name sn ON sn.id = s.name_id`

function shaped(row: Row, manages: boolean): SqlView {
  return {
    id: row.id,
    baseId: row.base_id,
    name: row.name,
    label: row.label,
    description: row.description,
    definition: row.definition,
    broken: row.broken_reason,
    color: row.color,
    icon: row.icon,
    image: row.image,
    editable: manages,
    updatedAt: row.updated_at,
  }
}

// ── What a view reads ─────────────────────────────────────────────────────────────

/** One relation a view reads, through its own text or through another view it reads. */
interface Dependency {
  readonly viewId: string
  readonly schema: string
  readonly relation: string
  /** `pg_class.relkind`: `r` a table, `v` a view… */
  readonly kind: string
  /** The column read, `null` when the relation is read as a whole — `count(*)`. */
  readonly column: string | null
}

/**
 * Every relation the given views read, down through the views they read. From
 * `pg_depend`, which PostgreSQL keeps exact through every rename: the text may be stale,
 * this never is.
 */
async function dependenciesOf(
  exec: Executor,
  viewIds: readonly string[],
): Promise<ReadonlyMap<string, readonly Dependency[]>> {
  const out = new Map<string, Dependency[]>()
  if (viewIds.length === 0) return out
  const rows = await exec.query<{
    view_id: string
    schema: string
    relation: string
    kind: string
    column: string | null
  }>(
    `WITH RECURSIVE roots AS (
       SELECT v.id AS view_id, c.oid AS rel
         FROM _basedb.sql_view v
         JOIN _basedb.physical_name vn ON vn.id = v.name_id
         JOIN _basedb.db_schema s      ON s.id = v.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
         JOIN pg_namespace n ON n.nspname = sn.name
         JOIN pg_class c     ON c.relnamespace = n.oid AND c.relname = vn.name AND c.relkind = 'v'
        WHERE v.id = ANY($1::uuid[])
     ), deps(view_id, rel, att) AS (
       SELECT roots.view_id, d.refobjid, d.refobjsubid
         FROM roots
         JOIN pg_rewrite r ON r.ev_class = roots.rel
         JOIN pg_depend d  ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
        WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid <> roots.rel
       UNION
       SELECT deps.view_id, d.refobjid, d.refobjsubid
         FROM deps
         JOIN pg_class c   ON c.oid = deps.rel AND c.relkind = 'v'
         JOIN pg_rewrite r ON r.ev_class = c.oid
         JOIN pg_depend d  ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
        WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid <> c.oid
     )
     SELECT DISTINCT deps.view_id::text, n.nspname AS schema, c.relname AS relation,
            c.relkind::text AS kind, a.attname AS "column"
       FROM deps
       JOIN pg_class c     ON c.oid = deps.rel
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = deps.att AND deps.att > 0`,
    [viewIds],
  )
  for (const row of rows) {
    const list = out.get(row.view_id) ?? []
    list.push({
      viewId: row.view_id,
      schema: row.schema,
      relation: row.relation,
      kind: row.kind,
      column: row.column,
    })
    out.set(row.view_id, list)
  }
  return out
}

/**
 * Whether someone who reads `reach` of the schema reads everything a view reads. A view
 * of another view is judged on what that one reads, which the dependencies already hold.
 */
function readsAll(
  dependencies: readonly Dependency[],
  schema: string,
  reach: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  return dependencies.every((d) => {
    if (SHARED_SCHEMAS.has(d.schema)) return true
    if (d.schema !== schema) return false
    if (d.kind === 'v') return true
    if (d.kind !== 'r' && d.kind !== 'p') return false
    const columns = reach.get(d.relation)
    return columns !== undefined && (d.column === null || columns.has(d.column))
  })
}

// ── Reading ───────────────────────────────────────────────────────────────────────

/** What the caller may do on a base: see it, manage it. Unseen, it does not exist. */
async function accessTo(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<{ readonly manages: boolean }> {
  const grants = await loadGrants(exec, ctx)
  const target = await loadBaseTarget(exec, ctx, baseId)
  if (target === null) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  const manages = decide(ctx, grants, 'manage_schema', target).verdict === 'ALLOWED'
  const sees =
    manages ||
    decide(ctx, grants, 'read', target).verdict === 'ALLOWED' ||
    (await visibleInside(exec, ctx, grants, target))
  if (!sees) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  return { manages }
}

/**
 * The views of a base the caller reads: all of them for whoever manages it, those whose
 * every table and field they read for everyone else.
 */
export async function listSqlViews(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<SqlView[]> {
  const { manages, rows } = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const { manages } = await accessTo(exec, ctx, request.baseId)
      const rows = await exec.query<Row>(
        `${SELECT} WHERE v.base_id = $1::uuid ORDER BY v.position, v.label_key`,
        [request.baseId],
      )
      return { manages, rows }
    },
    { readOnly: true },
  )
  if (manages) return rows.map((row) => shaped(row, true))
  return (await readableFor(pools, ctx, request.baseId, rows)).map((row) => shaped(row, false))
}

/** The rows among `rows` the caller reads everything of. Broken ones read nothing. */
async function readableFor(
  pools: Pools,
  ctx: RequestContext,
  baseId: string,
  rows: readonly Row[],
): Promise<Row[]> {
  const standing = rows.filter((r) => r.broken_reason === null)
  if (standing.length === 0) return []
  const reach = await readerReach(pools, ctx, baseId)
  const dependencies = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) =>
      dependenciesOf(
        exec,
        standing.map((r) => r.id),
      ),
    { readOnly: true },
  )
  return standing.filter((r) => readsAll(dependencies.get(r.id) ?? [], reach.schema, reach.tables))
}

/**
 * The views of several bases, as the navigation lists them. `readable` gives, per base the
 * caller sees, the columns they read of each table; `managed` the bases they manage.
 */
export async function sqlViewSummaries(
  exec: Executor,
  bases: ReadonlyArray<{
    readonly id: string
    readonly schema: string
    readonly readable: ReadonlyMap<string, ReadonlySet<string>>
  }>,
  managed: ReadonlySet<string>,
): Promise<ReadonlyMap<string, readonly SqlViewSummary[]>> {
  const out = new Map<string, SqlViewSummary[]>()
  if (bases.length === 0) return out
  const rows = await exec.query<Row>(
    `${SELECT} WHERE v.base_id = ANY($1::uuid[]) ORDER BY v.position, v.label_key`,
    [bases.map((b) => b.id)],
  )
  if (rows.length === 0) return out
  const judged = rows.filter((r) => !managed.has(r.base_id) && r.broken_reason === null)
  const dependencies = await dependenciesOf(
    exec,
    judged.map((r) => r.id),
  )
  const byId = new Map(bases.map((b) => [b.id, b]))
  for (const row of rows) {
    const base = byId.get(row.base_id)
    if (base === undefined) continue
    if (!managed.has(row.base_id)) {
      if (row.broken_reason !== null) continue
      if (!readsAll(dependencies.get(row.id) ?? [], base.schema, base.readable)) continue
    }
    const list = out.get(row.base_id) ?? []
    list.push({
      id: row.id,
      name: row.name,
      label: row.label,
      broken: row.broken_reason !== null,
      color: row.color,
      icon: row.icon,
      image: row.image,
    })
    out.set(row.base_id, list)
  }
  return out
}

/**
 * One view, for whoever may read it — the same rule as the list: a view someone does not
 * read everything of does not exist for them.
 */
export async function getSqlView(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly viewId: string },
): Promise<SqlView> {
  const { manages, row } = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const { manages } = await accessTo(exec, ctx, request.baseId)
      const [row] = await exec.query<Row>(
        `${SELECT} WHERE v.base_id = $1::uuid AND (v.id::text = $2 OR vn.name = $2)`,
        [request.baseId, request.viewId],
      )
      return { manages, row }
    },
    { readOnly: true },
  )
  if (row === undefined) notFound(request.viewId)
  if (manages) return shaped(row, true)
  const [readable] = await readableFor(pools, ctx, request.baseId, [row])
  if (readable === undefined) notFound(request.viewId)
  return shaped(readable, false)
}

/**
 * The statement that reads a view whole, as its reader will run it — handed to the SQL
 * runner, which decides with whose rights.
 */
export async function sqlViewStatement(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly viewId: string },
): Promise<string> {
  const view = await getSqlView(pools, ctx, request)
  if (view.broken !== null) {
    throw new BasedbError('SQL_VIEW_BROKEN', { details: { view: view.name, reason: view.broken } })
  }
  const [row] = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) =>
      exec.query<{ schema_name: string }>(
        `SELECT sn.name AS schema_name FROM _basedb.sql_view v
           JOIN _basedb.db_schema s      ON s.id = v.schema_id
           JOIN _basedb.physical_name sn ON sn.id = s.name_id
          WHERE v.id = $1::uuid`,
        [view.id],
      ),
    { readOnly: true },
  )
  return `SELECT * FROM ${qualify(row?.schema_name ?? '', view.name)}`
}

// ── Writing ───────────────────────────────────────────────────────────────────────

/**
 * A transaction on the owner's connection, with one more door than `withTransaction`
 * gives: `single` runs a statement through the EXTENDED protocol, which refuses a second
 * statement. The text of a view is written by a person and run by the owner; without that,
 * `SELECT 1; DROP SCHEMA …` would be two statements, and the second would be the owner's.
 */
async function inStructure<T>(
  pools: Pools,
  work: (exec: Executor, single: (sql: string) => Promise<void>) => Promise<T>,
): Promise<T> {
  const client: PoolClient = await pools.acquire('ddl')
  const exec = executorOf(client)
  try {
    await client.query('BEGIN')
    const result = await work(exec, async (sql) => {
      // `queryMode` is not in `pg`'s types; the driver honours it all the same.
      const extended = { text: sql, queryMode: 'extended' as const }
      await client.query(extended)
    })
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

interface BaseRow extends Record<string, unknown> {
  readonly schema_id: string
  readonly schema_name: string
  readonly structure_state: string
}

async function baseOf(exec: Executor, ctx: RequestContext, baseId: string): Promise<BaseRow> {
  const [base] = await exec.query<BaseRow>(
    `SELECT s.id::text AS schema_id, sn.name AS schema_name, b.structure_state
       FROM _basedb.base b
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE b.id::text = $1 AND t.ref = $2 AND b.is_live`,
    [baseId, ctx.tenantId],
  )
  if (base === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  if (base.structure_state === 'frozen') {
    throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: baseId } })
  }
  return base
}

/** Building a view is building the base: `manage_schema` on it, a person only. */
async function requireBuilder(exec: Executor, ctx: RequestContext, baseId: string) {
  const { manages } = await accessTo(exec, ctx, baseId)
  if (!manages || ctx.surface === 'mcp') {
    throw new BasedbError('ADMIN_REQUIRED', { details: { base: baseId } })
  }
}

/**
 * Creates the view in PostgreSQL — or replaces it — from its definition, then checks what
 * PostgreSQL says it reads. Unqualified names resolve in the base's schema, as in the
 * console.
 */
async function writeView(
  exec: Executor,
  single: (sql: string) => Promise<void>,
  schema: string,
  name: string,
  definition: string,
  baseId: string,
  replace: boolean,
): Promise<void> {
  await exec.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}`)
  const head = `CREATE ${replace ? 'OR REPLACE ' : ''}VIEW ${qualify(schema, name)} WITH (security_invoker = true) AS\n`
  try {
    await exec.query('SAVEPOINT sql_view_write')
    await single(`${head}${definition}`)
  } catch (error) {
    // A view whose columns change cannot be replaced in place: it is made again — unless
    // another view reads it, which PostgreSQL then names.
    const code = (error as { code?: string }).code
    if (!replace || (code !== '42P16' && code !== '42804')) throw definitionError(error, head)
    await exec.query('ROLLBACK TO SAVEPOINT sql_view_write')
    await assertUnread(exec, schema, name)
    try {
      await exec.query(`DROP VIEW ${qualify(schema, name)} RESTRICT`)
      const create = `CREATE VIEW ${qualify(schema, name)} WITH (security_invoker = true) AS\n`
      await single(`${create}${definition}`)
    } catch (again) {
      throw definitionError(
        again,
        `CREATE VIEW ${qualify(schema, name)} WITH (security_invoker = true) AS\n`,
      )
    }
  }
  await exec.query('RELEASE SAVEPOINT sql_view_write')
  await exec.query('SET LOCAL search_path TO DEFAULT')
  await assertInsideBase(exec, schema, name, baseId)
}

/**
 * A view reads its own base and nothing else: its live tables, its other views, and
 * PostgreSQL's catalog. Neither another base, nor `_basedb`, nor a function outside
 * `pg_catalog` — read from what PostgreSQL recorded, which a clever text cannot hide.
 */
async function assertInsideBase(
  exec: Executor,
  schema: string,
  name: string,
  baseId: string,
): Promise<void> {
  const outside = await exec.query<{ what: string }>(
    `SELECT n.nspname || '.' || c.relname AS what
       FROM pg_rewrite r
       JOIN pg_depend d    ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
       JOIN pg_class c     ON d.refclassid = 'pg_class'::regclass AND c.oid = d.refobjid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE r.ev_class = $1::regclass AND c.oid <> r.ev_class
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND NOT (n.nspname = $2 AND (
              EXISTS (SELECT 1 FROM _basedb.table_def t
                        JOIN _basedb.physical_name tn ON tn.id = t.name_id
                       WHERE t.base_id = $3::uuid AND t.is_live AND tn.name = c.relname)
           OR EXISTS (SELECT 1 FROM _basedb.sql_view v
                        JOIN _basedb.physical_name vn ON vn.id = v.name_id
                       WHERE v.base_id = $3::uuid AND vn.name = c.relname)))
     UNION
     SELECT n.nspname || '.' || p.proname
       FROM pg_rewrite r
       JOIN pg_depend d    ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
       JOIN pg_proc p      ON d.refclassid = 'pg_proc'::regclass AND p.oid = d.refobjid
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE r.ev_class = $1::regclass AND n.nspname <> 'pg_catalog'
      LIMIT 1`,
    [qualify(schema, name), schema, baseId],
  )
  if (outside[0] !== undefined) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'definition', reason: 'hors_base', object: outside[0].what },
    })
  }
}

/**
 * PostgreSQL's own message, for the person who wrote the text — the console's exception
 * (`sql/console.ts`), for the console's reason. The position is brought back into the
 * text they typed, past the `CREATE VIEW … AS` they did not.
 */
function definitionError(error: unknown, head: string): BasedbError {
  if (error instanceof BasedbError) return error
  const pg = error as {
    code?: string
    message?: string
    detail?: string
    hint?: string
    position?: string
  }
  if (typeof pg.code !== 'string' || !/^[0-9A-Z]{5}$/.test(pg.code)) {
    return new BasedbError('INTERNAL_ERROR', { cause: error })
  }
  const position = pg.position === undefined ? null : Number(pg.position) - head.length
  return new BasedbError('REQUEST_INVALID', {
    cause: error,
    details: {
      field: 'definition',
      sqlstate: pg.code,
      message: pg.message ?? null,
      detail: pg.detail ?? null,
      hint: pg.hint ?? null,
      position: position !== null && position > 0 ? position : null,
    },
  })
}

export async function createSqlView(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly input: SqlViewInput },
): Promise<SqlView> {
  const input = request.input
  const label = checkLabel(input.label)
  const definition = checkDefinition(input.definition)
  const description = normalizeDescription(input.description)
  const look = lookOf(input.look) ?? { color: null, icon: null, image: null }

  return inStructure(pools, async (exec, single) => {
    await requireBuilder(exec, ctx, request.baseId)
    const base = await baseOf(exec, ctx, request.baseId)
    await assertLabelFree(exec, request.baseId, label, null)
    const allocated = await allocateName(exec, ctx, {
      ...(input.name === undefined || input.name.trim() === ''
        ? { label }
        : { technicalName: input.name.trim() }),
      objectKind: 'sql_view',
      scopeKind: 'schema',
      scopeId: base.schema_id,
    })
    await writeView(
      exec,
      single,
      base.schema_name,
      allocated.name,
      definition,
      request.baseId,
      false,
    )
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.sql_view
         (base_id, schema_id, name_id, label, label_key, description, color, icon, image,
          position, definition, created_by, updated_by)
       SELECT $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9,
              coalesce((SELECT max(position) + 1 FROM _basedb.sql_view WHERE base_id = $1::uuid), 0),
              $10, $11, $11
       RETURNING id::text`,
      [
        request.baseId,
        base.schema_id,
        allocated.nameId,
        label,
        labelKey(label),
        description,
        look.color,
        look.icon,
        look.image,
        definition,
        ctx.actor.id,
      ],
      'insert',
    )
    await exec.query(
      `COMMENT ON VIEW ${qualify(base.schema_name, allocated.name)} IS ${quoteLiteral(label)}`,
    )
    await writeAudit(exec, ctx, {
      action: 'sql_view.create',
      objectKind: 'sql_view',
      objectId: row.id,
      objectName: allocated.name,
      baseId: request.baseId,
      payload: { label, definition },
    })
    return shaped(await rowOf(exec, request.baseId, row.id), true)
  })
}

export async function updateSqlView(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly viewId: string; readonly input: SqlViewInput },
): Promise<SqlView> {
  const input = request.input
  const label = input.label === undefined ? undefined : checkLabel(input.label)
  const definition = input.definition === undefined ? undefined : checkDefinition(input.definition)
  const setsDescription = input.description !== undefined
  const description = setsDescription ? normalizeDescription(input.description) : null
  const look = lookOf(input.look)

  return inStructure(pools, async (exec, single) => {
    await requireBuilder(exec, ctx, request.baseId)
    const current = await rowOf(exec, request.baseId, request.viewId)
    if (label !== undefined) await assertLabelFree(exec, request.baseId, label, current.id)
    // A new text — or a broken view's own one, saved again: PostgreSQL gets the view back.
    if (definition !== undefined) {
      await baseOf(exec, ctx, request.baseId)
      await writeView(
        exec,
        single,
        current.schema_name,
        current.name,
        definition ?? current.definition,
        request.baseId,
        current.broken_reason === null,
      )
    }
    await exec.query(
      `UPDATE _basedb.sql_view
          SET label = coalesce($2, label), label_key = coalesce($3, label_key),
              description = CASE WHEN $4::boolean THEN $5::text ELSE description END,
              definition = coalesce($6, definition),
              broken_reason = CASE WHEN $6::text IS NULL THEN broken_reason END,
              color = CASE WHEN $7::boolean THEN $8::text ELSE color END,
              icon  = CASE WHEN $7::boolean THEN $9::text ELSE icon END,
              image = CASE WHEN $7::boolean THEN $10::text ELSE image END,
              updated_at = pg_catalog.clock_timestamp(), updated_by = $11
        WHERE id = $1::uuid`,
      [
        current.id,
        label ?? null,
        label === undefined ? null : labelKey(label),
        setsDescription,
        description,
        definition ?? null,
        look !== null,
        look?.color ?? null,
        look?.icon ?? null,
        look?.image ?? null,
        ctx.actor.id,
      ],
      'update',
    )
    if (label !== undefined) {
      await exec.query(
        `COMMENT ON VIEW ${qualify(current.schema_name, current.name)} IS ${quoteLiteral(label)}`,
      )
    }
    await writeAudit(exec, ctx, {
      action: 'sql_view.update',
      objectKind: 'sql_view',
      objectId: current.id,
      objectName: current.name,
      baseId: request.baseId,
      payload: {
        ...(label === undefined ? {} : { label }),
        ...(definition === undefined ? {} : { definition }),
      },
    })
    return shaped(await rowOf(exec, request.baseId, current.id), true)
  })
}

/**
 * Deletes a view — from PostgreSQL and from the catalog. Its name stays taken, as every
 * name does. Refused while another view reads it: PostgreSQL names which.
 */
export async function deleteSqlView(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly viewId: string },
): Promise<void> {
  await inStructure(pools, async (exec) => {
    await requireBuilder(exec, ctx, request.baseId)
    const current = await rowOf(exec, request.baseId, request.viewId)
    await assertUnread(exec, current.schema_name, current.name)
    await exec.query(`DROP VIEW IF EXISTS ${qualify(current.schema_name, current.name)} RESTRICT`)
    await exec.query(
      `UPDATE _basedb.physical_name SET state = 'retired', state_changed_at = pg_catalog.clock_timestamp()
        WHERE id = (SELECT name_id FROM _basedb.sql_view WHERE id = $1::uuid)`,
      [current.id],
      'update',
    )
    await exec.query('DELETE FROM _basedb.sql_view WHERE id = $1::uuid', [current.id], 'delete')
    await writeAudit(exec, ctx, {
      action: 'sql_view.delete',
      objectKind: 'sql_view',
      objectId: current.id,
      objectName: current.name,
      baseId: request.baseId,
      payload: { label: current.label, definition: current.definition },
    })
  })
}

/** Moves a base's views into the given order. Those not named keep their place after. */
export async function reorderSqlViews(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly order: readonly string[] },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireBuilder(exec, ctx, request.baseId)
    await exec.query(
      `UPDATE _basedb.sql_view v SET position = o.n
         FROM unnest($2::text[]) WITH ORDINALITY AS o(id, n)
        WHERE v.base_id = $1::uuid AND v.id::text = o.id`,
      [request.baseId, request.order],
      'update',
    )
  })
}

/**
 * Refuses to take a view out of PostgreSQL while another view reads it — naming that one,
 * rather than letting `DROP … RESTRICT` fail with a bare `2BP01`.
 */
async function assertUnread(exec: Executor, schema: string, name: string): Promise<void> {
  const readers = await exec.query<{ name: string }>(
    `SELECT DISTINCT dc.relname AS name
       FROM pg_depend d
       JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
       JOIN pg_class dc  ON dc.oid = r.ev_class
      WHERE d.refclassid = 'pg_class'::regclass
        AND d.refobjid = to_regclass($1) AND dc.oid <> d.refobjid`,
    [qualify(schema, name)],
  )
  if (readers[0] !== undefined) {
    throw new BasedbError('DEPENDENT_OBJECT', {
      details: { dependent: readers[0].name, referenced: name, kind: 'sql_view' },
    })
  }
}

async function rowOf(exec: Executor, baseId: string, viewId: string): Promise<Row> {
  const [row] = await exec.query<Row>(
    `${SELECT} WHERE v.base_id = $1::uuid AND (v.id::text = $2 OR vn.name = $2)`,
    [baseId, viewId],
  )
  if (row === undefined) notFound(viewId)
  return row
}

function notFound(viewId: string): never {
  throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: viewId } })
}

/** A label is unique among the tables and views of a base: the navigation lists them together. */
async function assertLabelFree(
  exec: Executor,
  baseId: string,
  label: string,
  except: string | null,
): Promise<void> {
  const clash = await exec.query<{ id: string }>(
    `SELECT id::text FROM _basedb.sql_view
      WHERE base_id = $1::uuid AND label_key = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)
     UNION ALL
     SELECT id::text FROM _basedb.table_def
      WHERE base_id = $1::uuid AND label_key = $2 AND deleted_at IS NULL`,
    [baseId, labelKey(label), except],
  )
  if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
}

function checkLabel(value: unknown): string {
  if (typeof value !== 'string') throw new BasedbError('LABEL_EMPTY')
  const label = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (label === '') throw new BasedbError('LABEL_EMPTY')
  if ([...label].length > MAX_LABEL_CHARS) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: MAX_LABEL_CHARS } })
  }
  return label
}

/** The query, as typed — less a final `;`, which `CREATE VIEW … AS` would not take. */
function checkDefinition(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().replace(/;\s*$/, '').trimEnd() : ''
  if (text === '') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'definition', reason: 'vide' } })
  }
  if (text.length > MAX_DEFINITION_CHARS || text.includes('\u0000')) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'definition', reason: 'invalide' },
    })
  }
  return text
}

function lookOf(raw: LookInput | undefined): Look | null {
  if (raw === undefined || !touchesLook(raw)) return null
  return normalizeLook(
    raw,
    (reason) => new BasedbError('REQUEST_INVALID', { details: { field: 'look', reason } }),
  )
}

// ── Through the structure's own operations ────────────────────────────────────────

/** A view taken out of PostgreSQL for a structure step, and how to put it back. */
export interface DetachedView {
  readonly id: string
  readonly schema: string
  readonly name: string
  /** What PostgreSQL held — exact whatever was renamed since the text was written. */
  readonly compiled: string
}

/**
 * Takes out of PostgreSQL every SQL view that reads `column` of a table — or the table
 * itself when `column` is null —, directly or through another view, so a structure step
 * PostgreSQL would otherwise refuse can run. Innermost first in the result: the order
 * `reattachSqlViews` puts them back in.
 */
export async function detachSqlViews(
  exec: Executor,
  schema: string,
  table: string,
  column: string | null,
): Promise<readonly DetachedView[]> {
  const found = await exec.query<{ id: string; name: string; compiled: string; depth: number }>(
    `WITH RECURSIVE readers(rel, depth) AS (
       SELECT r.ev_class, 1
         FROM pg_depend d
         JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
        WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid = to_regclass($1)
          AND r.ev_class <> d.refobjid
          AND ($2::text IS NULL OR d.refobjsubid = (
                SELECT attnum FROM pg_attribute WHERE attrelid = to_regclass($1) AND attname = $2))
       UNION
       SELECT r.ev_class, readers.depth + 1
         FROM readers
         JOIN pg_depend d  ON d.refclassid = 'pg_class'::regclass AND d.refobjid = readers.rel
         JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
        WHERE r.ev_class <> readers.rel
     )
     SELECT v.id::text, c.relname AS name, pg_get_viewdef(c.oid, true) AS compiled,
            max(readers.depth) AS depth
       FROM readers
       JOIN pg_class c     ON c.oid = readers.rel
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN _basedb.physical_name vn ON vn.name = c.relname
       JOIN _basedb.sql_view v       ON v.name_id = vn.id
       JOIN _basedb.db_schema s      ON s.id = v.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id AND sn.name = n.nspname
      GROUP BY v.id, c.relname, c.oid
      ORDER BY max(readers.depth)`,
    [qualify(schema, table), column],
  )
  if (found.length === 0) return []
  // One statement for all: PostgreSQL drops a set whose members read one another.
  await exec.query(
    `DROP VIEW IF EXISTS ${found.map((v) => qualify(schema, v.name)).join(', ')} RESTRICT`,
  )
  return found.map((v) => ({ id: v.id, schema, name: v.name, compiled: v.compiled }))
}

/**
 * Puts detached views back, innermost first. One that no longer holds — the column it read
 * came back of another type — stays out, `broken`, with its definition kept.
 */
export async function reattachSqlViews(
  exec: Executor,
  views: readonly DetachedView[],
  reason: string,
): Promise<void> {
  for (const view of views) {
    await exec.query('SAVEPOINT sql_view_reattach')
    try {
      await exec.query(`SET LOCAL search_path TO ${quoteIdentifier(view.schema)}`)
      await exec.query(
        `CREATE VIEW ${qualify(view.schema, view.name)} WITH (security_invoker = true) AS\n${view.compiled}`,
      )
      await exec.query('SET LOCAL search_path TO DEFAULT')
      await exec.query('RELEASE SAVEPOINT sql_view_reattach')
    } catch {
      await exec.query('ROLLBACK TO SAVEPOINT sql_view_reattach')
      await exec.query(
        `UPDATE _basedb.sql_view SET broken_reason = $2, updated_at = pg_catalog.clock_timestamp()
          WHERE id = $1::uuid`,
        [view.id, reason],
        'update',
      )
    }
  }
}

/**
 * The statements that take every SQL view of a base out of PostgreSQL and the catalog —
 * for the purge of the base, which destroys its schema.
 */
export async function purgeSqlViewStatements(
  exec: Executor,
  baseId: string,
  schema: string,
  stamp: string,
): Promise<readonly string[]> {
  const views = await exec.query<{ id: string; name: string }>(
    `SELECT v.id::text, vn.name FROM _basedb.sql_view v
       JOIN _basedb.physical_name vn ON vn.id = v.name_id
      WHERE v.base_id = $1::uuid`,
    [baseId],
  )
  if (views.length === 0) return []
  return [
    `DROP VIEW IF EXISTS ${views.map((v) => qualify(schema, v.name)).join(', ')} RESTRICT;`,
    `UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = ${stamp}::timestamptz
 WHERE id IN (SELECT name_id FROM _basedb.sql_view WHERE base_id = ${quoteLiteral(baseId)}::uuid);`,
    `DELETE FROM _basedb.sql_view WHERE base_id = ${quoteLiteral(baseId)}::uuid;`,
  ]
}
