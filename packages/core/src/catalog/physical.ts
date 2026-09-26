import { randomUUID } from 'node:crypto'
import {
  MAX_BASE_SLUG_BYTES,
  MAX_FIELD_NAME_BYTES,
  MAX_TABLE_NAME_BYTES,
  byteLength,
  composeSchemaName,
  hasReservedPrefix,
  isAlphabetA,
  isReservedForScope,
  parseSchemaName,
  qualify,
  quoteIdentifier,
  relegationDate,
  slugify,
} from '@basedb/naming'
import { writeAudit } from '../audit/journal.js'
import { quoteLiteral } from '../ddl/emit.js'
import { type Migration, type MigrationStep, runMigration } from '../ddl/migration.js'
import { BasedbError } from '../errors/index.js'
import { SCOPE_INSTANCE } from '../naming/allocation.js'
import { SYSTEM_COLUMNS, decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import { loadBaseTarget, visibleInside } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { freeName, isAdministration, truncateBytes } from './lifecycle.js'

/**
 * The PHYSICAL name of a base, a table or a field — chapter 06 §2 and §3.
 *
 * Renaming in the database is not a setting: it is an administration act, preceded by an
 * impact analysis, confirmed by typing the current name, and traced with what the
 * administrator had in front of them. The API, the MCP server and the interface resolve
 * names through the catalog and never notice; what breaks is what writes the name by
 * hand — a psql script, a report, a dbt model — and that is exactly what cannot be
 * observed (§2.3). Hence the compatibility alias: a VIEW under the old name, writable,
 * frozen to the columns of the day, that keeps those consumers working until someone
 * decides it has served its time.
 *
 * Three rules hold everything here:
 *
 *   — a name is never released (§2.5): the old name becomes the alias, or stays retired;
 *     renaming to a name the registry already knows is `NAME_RETIRED`, in any state;
 *   — there is no alias for a field (§3.1): a column cannot be doubled under two names
 *     without duplicating data, so a field rename has no safety net, and the screen says
 *     so before anyone confirms;
 *   — nothing is ever dropped with `CASCADE` (§3.4): a view someone built over an alias
 *     is theirs, and a `DROP` that would take it along is refused by name.
 */

/** §2.1: the alias lives 180 days by default — a date, never an automatic drop. */
export const ALIAS_DEFAULT_DAYS = 180

/** §2.5: past five live aliases on one object, it is a governance problem, not the engine's. */
export const MAX_LIVE_ALIASES = 5

/** §3.5: a blank cut shorter than a monthly cycle measures nothing. */
export const BLANK_CUT_MIN_DAYS = 35

/** `zz_alias_` + date + `_`: 18 bytes, leaving 45 to the name (chapter 01 §9.6). */
const CUT_NAME_BYTES = 45

export type PhysicalKind = 'base' | 'table' | 'field'

/** What the rename screen shows before anyone confirms (§2.1, step 2). */
export interface RenameImpact {
  readonly kind: PhysicalKind
  readonly id: string
  readonly label: string
  /** The name as it is typed today: the base's logical name, the table's, the column's. */
  readonly current: string
  readonly qualified: string
  /** The slug of the current label, offered as the new name. */
  readonly suggested: string
  /** A field has no alias (§3.1). */
  readonly aliasAllowed: boolean
  readonly liveAliases: number
  /** `pg_class.reltuples` — an ESTIMATE, `null` when never analysed. */
  readonly estimatedRows: number | null
  readonly bytes: number | null
  readonly webhooks: readonly string[]
  /** Tokens of the base used in the last 30 days — the projection of external workflows. */
  readonly tokens: ReadonlyArray<{ readonly label: string; readonly lastUsedAt: string | null }>
  /** Link columns elsewhere named after this table, which will no longer say so (§2.6). */
  readonly misalignedLinks: ReadonlyArray<{
    readonly table: string
    readonly column: string
    readonly label: string
  }>
  /** Objects unknown to the catalog built on this one — a view in someone's report. */
  readonly dependents: readonly string[]
  /** For a field: the AI prompts citing it, rewritten in the same step. */
  readonly citingPrompts: number
}

export interface RenameResult {
  readonly migration: Migration
  readonly name: string
  /** The alias left under the old name, or `null`. */
  readonly alias: string | null
}

// ── Authorization ─────────────────────────────────────────────────────────────

/**
 * The administration role of §1.2: instance administrator, or `manage_schema` on the
 * tenant. `ADMIN_REQUIRED` for whoever sees the base, `RESOURCE_NOT_FOUND` otherwise.
 */
export async function requireLifecycleAdmin(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<void> {
  const grants = await loadGrants(exec, ctx)
  if (ctx.actor.kind === 'user' && isAdministration(grants)) return
  const target = await loadBaseTarget(exec, ctx, baseId)
  const visible =
    target !== null &&
    (decide(ctx, grants, 'read', target).verdict === 'ALLOWED' ||
      (await visibleInside(exec, ctx, grants, target)))
  throw new BasedbError(visible ? 'ADMIN_REQUIRED' : 'RESOURCE_NOT_FOUND', {
    details: { base: baseId },
  })
}

const originOf = (ctx: RequestContext) =>
  ctx.surface === 'mcp'
    ? ('mcp' as const)
    : ctx.surface === 'rest'
      ? ('rest' as const)
      : ('ui' as const)

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value)

// ── Loading ───────────────────────────────────────────────────────────────────

type BaseRow = {
  readonly id: string
  readonly label: string
  readonly tenant_ref: string
  readonly structure_state: string
  readonly schema_id: string
  readonly schema_name: string
  readonly schema_name_id: string
}

async function loadBase(exec: Executor, ctx: RequestContext, baseId: string): Promise<BaseRow> {
  if (!isUuid(baseId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const [base] = await exec.query<BaseRow>(
    `SELECT b.id::text, b.label, t.ref AS tenant_ref, b.structure_state,
            s.id::text AS schema_id, n.name AS schema_name, s.name_id::text AS schema_name_id
       FROM _basedb.base b
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                    AND s.dropped_at IS NULL
       JOIN _basedb.physical_name n  ON n.id = s.name_id
      WHERE b.id = $1 AND t.ref = $2 AND b.is_live`,
    [baseId, ctx.tenantId],
  )
  if (base === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  return base
}

type TableRow = BaseRow & {
  readonly table_id: string
  readonly table_label: string
  readonly table_name: string
  readonly table_name_id: string
}

async function loadTable(exec: Executor, ctx: RequestContext, tableId: string): Promise<TableRow> {
  if (!isUuid(tableId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const [row] = await exec.query<{ base_id: string; label: string; name: string; name_id: string }>(
    `SELECT t.base_id::text, t.label, n.name, t.name_id::text
       FROM _basedb.table_def t
       JOIN _basedb.physical_name n ON n.id = t.name_id
      WHERE t.id = $1 AND t.is_live`,
    [tableId],
  )
  if (row === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  const base = await loadBase(exec, ctx, row.base_id)
  return {
    ...base,
    table_id: tableId,
    table_label: row.label,
    table_name: row.name,
    table_name_id: row.name_id,
  }
}

type FieldRow = TableRow & {
  readonly field_id: string
  readonly field_label: string
  readonly field_name: string
  readonly field_name_id: string
}

async function loadField(exec: Executor, ctx: RequestContext, fieldId: string): Promise<FieldRow> {
  if (!isUuid(fieldId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const [row] = await exec.query<{
    table_id: string
    label: string
    name: string
    name_id: string
  }>(
    `SELECT f.table_id::text, f.label, n.name, f.name_id::text
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.id = $1 AND f.is_live`,
    [fieldId],
  )
  // A system column has no `field` row, and so no rename (§2.6).
  if (row === undefined || SYSTEM_COLUMNS.includes(row.name)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: fieldId } })
  }
  const table = await loadTable(exec, ctx, row.table_id)
  return {
    ...table,
    field_id: fieldId,
    field_label: row.label,
    field_name: row.name,
    field_name_id: row.name_id,
  }
}

/** The live columns of a table, system columns first: what an alias view projects. */
async function liveColumns(exec: Executor, tableId: string): Promise<string[]> {
  const fields = await exec.query<{ name: string }>(
    `SELECT n.name FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position, f.id`,
    [tableId],
  )
  return [
    ...SYSTEM_COLUMNS,
    ...fields.map((f) => f.name).filter((n) => !SYSTEM_COLUMNS.includes(n)),
  ]
}

/**
 * The statements of one alias view (§3.1): never `SELECT *`, every column aliased
 * explicitly — the view's output names are frozen in its own `pg_attribute` —, the five
 * system columns projected, and `security_invoker` so that a role created later gets no
 * more through the view than through the table.
 */
function aliasView(
  aliasSchema: string,
  viewName: string,
  targetSchema: string,
  targetTable: string,
  columns: readonly string[],
  comment: string,
): string[] {
  const select = columns
    .map((c) => `"t".${quoteIdentifier(c)} AS ${quoteIdentifier(c)}`)
    .join(',\n         ')
  return [
    `CREATE VIEW ${qualify(aliasSchema, viewName)} WITH (security_invoker = true) AS
  SELECT ${select}
    FROM ${qualify(targetSchema, targetTable)} AS "t";`,
    `COMMENT ON VIEW ${qualify(aliasSchema, viewName)} IS ${quoteLiteral(comment)};`,
  ]
}

// ── The name typed by the administrator ────────────────────────────────────────

const BUDGET: Readonly<Record<PhysicalKind, number>> = {
  base: MAX_BASE_SLUG_BYTES,
  table: MAX_TABLE_NAME_BYTES,
  field: MAX_FIELD_NAME_BYTES,
}

/**
 * The name exactly as typed: alphabet A, the budget of its kind, no reserved prefix or
 * word. Nothing is corrected — the suffix loop never applies silently to an
 * administration rename (§2.5): the administrator typed a name, and gets it or a refusal.
 */
function checkName(name: unknown, kind: PhysicalKind): string {
  if (typeof name !== 'string' || !isAlphabetA(name)) {
    throw new BasedbError('IDENTIFIER_INVALID', { details: { name, reason: 'alphabet' } })
  }
  if (byteLength(name) > BUDGET[kind]) {
    throw new BasedbError('NAME_TOO_LONG', { details: { name, maximum: BUDGET[kind] } })
  }
  if (
    hasReservedPrefix(name, kind) ||
    isReservedForScope(name, kind) ||
    (kind === 'field' && SYSTEM_COLUMNS.includes(name))
  ) {
    throw new BasedbError('IDENTIFIER_INVALID', { details: { name, reason: 'reserved' } })
  }
  return name
}

/** The first `<name>_<n>` the registry does not know — offered, never applied (§2.5). */
async function suggestion(
  exec: Executor,
  scopeId: string,
  name: string,
  max: number,
): Promise<string | null> {
  for (let rank = 2; rank <= 99; rank++) {
    const suffix = `_${rank}`
    const candidate = `${truncateBytes(name, max - suffix.length)}${suffix}`
    const [taken] = await exec.query(
      'SELECT 1 FROM _basedb.physical_name WHERE scope_id = $1 AND name = $2',
      [scopeId, candidate],
    )
    if (taken === undefined) return candidate
  }
  return null
}

/**
 * The name is free — in the registry, in any state, and in `pg_catalog`, where an object
 * someone created by hand would make the `ALTER … RENAME` fail mid-step (§2.5).
 */
async function assertNameFree(
  exec: Executor,
  scopeId: string,
  name: string,
  max: number,
  physical:
    | { readonly kind: 'schema' }
    | { readonly kind: 'relation'; readonly schema: string }
    | { readonly kind: 'column'; readonly schema: string; readonly table: string },
): Promise<void> {
  const [known] = await exec.query<{ state: string; allocated_at: string }>(
    'SELECT state, allocated_at::text FROM _basedb.physical_name WHERE scope_id = $1 AND name = $2',
    [scopeId, name],
  )
  if (known !== undefined) {
    throw new BasedbError('NAME_RETIRED', {
      details: {
        name,
        state: known.state,
        since: known.allocated_at,
        suggestion: await suggestion(exec, scopeId, name, max),
      },
    })
  }
  const [outside] =
    physical.kind === 'schema'
      ? await exec.query<{ kind: string; owner: string }>(
          `SELECT 'schema' AS kind, pg_get_userbyid(nspowner) AS owner
             FROM pg_namespace WHERE nspname = $1`,
          [name],
        )
      : physical.kind === 'relation'
        ? await exec.query<{ kind: string; owner: string }>(
            `SELECT c.relkind::text AS kind, pg_get_userbyid(c.relowner) AS owner
               FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = $1 AND c.relname = $2`,
            [physical.schema, name],
          )
        : await exec.query<{ kind: string; owner: string }>(
            `SELECT 'column' AS kind, pg_get_userbyid(c.relowner) AS owner
               FROM pg_attribute a
               JOIN pg_class c     ON c.oid = a.attrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = $1 AND c.relname = $2 AND a.attname = $3
                AND a.attnum > 0 AND NOT a.attisdropped`,
            [physical.schema, physical.table, name],
          )
  if (outside !== undefined) {
    throw new BasedbError('NAME_TAKEN_OUTSIDE_REGISTRY', {
      details: { name, kind: outside.kind, owner: outside.owner },
    })
  }
}

async function liveAliasCount(exec: Executor, kind: 'base' | 'table', id: string): Promise<number> {
  const [row] = await exec.query<{ n: number }>(
    kind === 'base'
      ? `SELECT count(*)::int AS n FROM _basedb.db_schema
          WHERE base_id = $1 AND role = 'alias' AND dropped_at IS NULL`
      : `SELECT count(*)::int AS n FROM _basedb.sql_view_alias v
           JOIN _basedb.db_schema s ON s.id = v.schema_id AND s.role = 'current'
          WHERE v.target_table_id = $1 AND v.dropped_at IS NULL`,
    [id],
  )
  return row?.n ?? 0
}

/** Views and rules outside the catalog built on a relation — by OID, as §3.4 writes it. */
async function dependentsOf(exec: Executor, schema: string, relation: string): Promise<string[]> {
  const rows = await exec.query<{ dependent: string }>(
    `SELECT DISTINCT dn.nspname || '.' || dc.relname AS dependent
       FROM pg_class rc
       JOIN pg_namespace rn ON rn.oid = rc.relnamespace
       JOIN pg_depend d     ON d.refobjid = rc.oid AND d.refclassid = 'pg_class'::regclass
       JOIN pg_rewrite r    ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
       JOIN pg_class dc     ON dc.oid = r.ev_class
       JOIN pg_namespace dn ON dn.oid = dc.relnamespace
      WHERE rn.nspname = $1 AND rc.relname = $2 AND dc.oid <> rc.oid
        AND NOT EXISTS (
          SELECT 1 FROM _basedb.sql_view_alias v
            JOIN _basedb.physical_name vn ON vn.id = v.name_id
            JOIN _basedb.db_schema vs     ON vs.id = v.schema_id
            JOIN _basedb.physical_name sn ON sn.id = vs.name_id
           WHERE v.dropped_at IS NULL AND vn.name = dc.relname AND sn.name = dn.nspname)
      ORDER BY 1`,
    [schema, relation],
  )
  return rows.map((r) => r.dependent)
}

/** Everything outside the schema built on something inside it. */
async function dependentsOfSchema(exec: Executor, schema: string): Promise<string[]> {
  const rows = await exec.query<{ dependent: string }>(
    `SELECT DISTINCT dn.nspname || '.' || dc.relname AS dependent
       FROM pg_depend d
       JOIN pg_rewrite r    ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
       JOIN pg_class dc     ON dc.oid = r.ev_class
       JOIN pg_namespace dn ON dn.oid = dc.relnamespace
       JOIN pg_class rc     ON rc.oid = d.refobjid AND d.refclassid = 'pg_class'::regclass
       JOIN pg_namespace rn ON rn.oid = rc.relnamespace
      WHERE rn.nspname = $1 AND dn.nspname <> $1 AND dc.oid <> rc.oid
      ORDER BY 1`,
    [schema],
  )
  return rows.map((r) => r.dependent)
}

// ── Impact ─────────────────────────────────────────────────────────────────────

/** What a physical rename would touch, WITHOUT doing it (§2.1, step 2). */
export async function renameImpact(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly kind: PhysicalKind; readonly id: string },
): Promise<RenameImpact> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const target =
        request.kind === 'base'
          ? await loadBase(exec, ctx, request.id)
          : request.kind === 'table'
            ? await loadTable(exec, ctx, request.id)
            : await loadField(exec, ctx, request.id)
      await requireLifecycleAdmin(exec, ctx, target.id)
      const baseId = target.id

      const tokens = await exec.query<{ label: string; last_used_at: string | null }>(
        `SELECT label, last_used_at::text FROM _basedb.api_token
          WHERE base_id = $1 AND revoked_at IS NULL AND suspended_at IS NULL
            AND (expires_at IS NULL OR expires_at > clock_timestamp())
            AND last_used_at > clock_timestamp() - interval '30 days'
          ORDER BY last_used_at DESC`,
        [baseId],
      )

      if (request.kind === 'base') {
        const base = target as BaseRow
        const [size] = await exec.query<{ rows: number | null; bytes: number | null }>(
          `SELECT CASE WHEN bool_or(c.reltuples < 0) THEN NULL
                       ELSE sum(c.reltuples)::float8 END AS rows,
                  sum(pg_total_relation_size(c.oid))::float8 AS bytes
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1 AND c.relkind = 'r'`,
          [base.schema_name],
        )
        const hooks = await exec.query<{ label: string }>(
          `SELECT DISTINCT w.label FROM _basedb.webhook w
            WHERE w.base_id = $1 AND w.deleted_at IS NULL AND w.is_active ORDER BY 1`,
          [baseId],
        )
        const slug = parseSchemaName(base.schema_name)?.baseSlug ?? base.schema_name
        return {
          kind: 'base',
          id: base.id,
          label: base.label,
          current: slug,
          qualified: base.schema_name,
          suggested: slugify(base.label, { max: MAX_BASE_SLUG_BYTES, nature: 'base' }).slug,
          aliasAllowed: true,
          liveAliases: await liveAliasCount(exec, 'base', base.id),
          estimatedRows: size?.rows ?? null,
          bytes: size?.bytes ?? null,
          webhooks: hooks.map((h) => h.label),
          tokens: tokens.map((t) => ({ label: t.label, lastUsedAt: t.last_used_at })),
          misalignedLinks: [],
          dependents: await dependentsOfSchema(exec, base.schema_name),
          citingPrompts: 0,
        }
      }

      const table = target as TableRow
      const [size] = await exec.query<{ rows: number; bytes: number }>(
        `SELECT c.reltuples::float8 AS rows, pg_total_relation_size(c.oid)::float8 AS bytes
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2`,
        [table.schema_name, table.table_name],
      )
      const hooks = await exec.query<{ label: string }>(
        `SELECT DISTINCT w.label FROM _basedb.webhook_subscription s
           JOIN _basedb.webhook w ON w.id = s.webhook_id
          WHERE s.table_id = $1 AND w.deleted_at IS NULL AND w.is_active ORDER BY 1`,
        [table.table_id],
      )
      const common = {
        estimatedRows: size === undefined || size.rows < 0 ? null : size.rows,
        bytes: size?.bytes ?? null,
        webhooks: hooks.map((h) => h.label),
        tokens: tokens.map((t) => ({ label: t.label, lastUsedAt: t.last_used_at })),
      }

      if (request.kind === 'table') {
        const links = await exec.query<{ table: string; column: string; label: string }>(
          `SELECT stn.name AS table, fn.name AS column, f.label
             FROM _basedb.field_link_config lc
             JOIN _basedb.field f           ON f.id = lc.field_id AND f.is_live
             JOIN _basedb.physical_name fn  ON fn.id = f.name_id
             JOIN _basedb.table_def st      ON st.id = f.table_id AND st.is_live
             JOIN _basedb.physical_name stn ON stn.id = st.name_id
            WHERE lc.target_table_id = $1 AND fn.name = $2
            ORDER BY 1, 2`,
          [table.table_id, `${table.table_name}_id`],
        )
        return {
          kind: 'table',
          id: table.table_id,
          label: table.table_label,
          current: table.table_name,
          qualified: `${table.schema_name}.${table.table_name}`,
          suggested: slugify(table.table_label, { max: MAX_TABLE_NAME_BYTES, nature: 'table' })
            .slug,
          aliasAllowed: true,
          liveAliases: await liveAliasCount(exec, 'table', table.table_id),
          ...common,
          misalignedLinks: links,
          dependents: await dependentsOf(exec, table.schema_name, table.table_name),
          citingPrompts: 0,
        }
      }

      const field = target as FieldRow
      const [prompts] = await exec.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM _basedb.field_ai_config c
           JOIN _basedb.field f ON f.id = c.field_id AND f.is_live
          WHERE f.table_id = $1 AND c.prompt ~ $2`,
        [field.table_id, `\\{\\{\\s*${field.field_name}\\s*\\}\\}`],
      )
      return {
        kind: 'field',
        id: field.field_id,
        label: field.field_label,
        current: field.field_name,
        qualified: `${field.schema_name}.${field.table_name}.${field.field_name}`,
        suggested: slugify(field.field_label, { max: MAX_FIELD_NAME_BYTES, nature: 'champ' }).slug,
        aliasAllowed: false,
        liveAliases: 0,
        ...common,
        misalignedLinks: [],
        dependents: await dependentsOf(exec, field.schema_name, field.table_name),
        citingPrompts: prompts?.n ?? 0,
      }
    },
    { readOnly: true },
  )
}

// ── Renaming ───────────────────────────────────────────────────────────────────

interface RenameRequest {
  readonly kind: PhysicalKind
  readonly id: string
  readonly name: string
  /** The current name, typed in full (§2.1, step 4). */
  readonly confirm: string
  /** Leave a compatibility alias under the old name — a base or a table only. */
  readonly alias?: boolean
  readonly aliasDays?: number
}

function checkConfirm(confirm: unknown, current: string): void {
  if (confirm !== current) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'confirm', reason: 'saisir_le_nom_actuel' },
    })
  }
}

function checkAliasDays(days: unknown): number {
  if (days === undefined || days === null) return ALIAS_DEFAULT_DAYS
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 3650) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'alias_days' } })
  }
  return days
}

/**
 * Renames a base, a table or a field in the database — §2.4. Administration only. The
 * impact shown on the screen is written, as it was, into the audit line.
 */
export async function renamePhysical(
  pools: Pools,
  ctx: RequestContext,
  request: RenameRequest,
): Promise<RenameResult> {
  const withAlias = request.kind !== 'field' && request.alias !== false
  if (request.kind === 'field' && request.alias === true) {
    // No alias for a column (§3.1): asked for, it is refused rather than silently absent.
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'alias', reason: 'champ' } })
  }
  const days = checkAliasDays(request.aliasDays)
  const impact = await renameImpact(pools, ctx, { kind: request.kind, id: request.id })
  const name = checkName(request.name, request.kind)
  checkConfirm(request.confirm, impact.current)
  if (name === impact.current) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'name', reason: 'inchange' } })
  }
  if (withAlias && impact.liveAliases >= MAX_LIVE_ALIASES) {
    throw new BasedbError('TOO_MANY_ALIASES', { details: { maximum: MAX_LIVE_ALIASES } })
  }

  const planned = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const at = ctx.timestamp
    const stamp = quoteLiteral(at.toISOString())
    const dropAfter = quoteLiteral(new Date(at.getTime() + days * 86_400_000).toISOString())
    const actor = quoteLiteral(ctx.actor.id)
    const newId = randomUUID()
    const comment = (target: string) =>
      `Alias de compatibilité : renommé en « ${target} » le ${at.toISOString().slice(0, 10)}. À ne plus utiliser.`

    if (request.kind === 'base') {
      const base = await loadBase(exec, ctx, request.id)
      if (base.structure_state === 'frozen') {
        throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: base.id } })
      }
      const schema = composeSchemaName(base.tenant_ref, name)
      await assertNameFree(exec, SCOPE_INSTANCE, schema, 63, { kind: 'schema' })
      const aliasSchemaId = randomUUID()
      const steps: MigrationStep[] = [
        {
          label: `Renommer le schéma en ${schema}`,
          lock: 'short',
          statements: [
            `INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version, previous_name_id, allocated_by)
VALUES (${quoteLiteral(newId)}::uuid, 'instance', ${quoteLiteral(SCOPE_INSTANCE)}::uuid,
        ${quoteLiteral(schema)}, 'schema', 'active', 1,
        ${quoteLiteral(base.schema_name_id)}::uuid, ${actor}::uuid);`,
            `UPDATE _basedb.physical_name SET state = ${quoteLiteral(withAlias ? 'alias' : 'retired')},
       state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(base.schema_name_id)}::uuid;`,
            `ALTER SCHEMA ${quoteIdentifier(base.schema_name)} RENAME TO ${quoteIdentifier(schema)};`,
            `UPDATE _basedb.db_schema SET name_id = ${quoteLiteral(newId)}::uuid
 WHERE id = ${quoteLiteral(base.schema_id)}::uuid;`,
            ...(withAlias
              ? [
                  `CREATE SCHEMA ${quoteIdentifier(base.schema_name)};`,
                  `COMMENT ON SCHEMA ${quoteIdentifier(base.schema_name)} IS ${quoteLiteral(comment(schema))};`,
                  `INSERT INTO _basedb.db_schema (id, base_id, role, name_id, drop_after, created_by)
VALUES (${quoteLiteral(aliasSchemaId)}::uuid, ${quoteLiteral(base.id)}::uuid, 'alias',
        ${quoteLiteral(base.schema_name_id)}::uuid, ${dropAfter}::timestamptz, ${actor}::uuid);`,
                ]
              : []),
          ],
        },
      ]

      if (withAlias) {
        // One view per live table, ten per step (§2.4): a transaction of 500 CREATE VIEW
        // would have no bound on its duration and nothing to resume from.
        const tables = await exec.query<{ id: string; name: string }>(
          `SELECT t.id::text, n.name FROM _basedb.table_def t
             JOIN _basedb.physical_name n ON n.id = t.name_id
            WHERE t.base_id = $1 AND t.is_live ORDER BY t.position, t.id`,
          [base.id],
        )
        for (let i = 0; i < tables.length; i += 10) {
          const batch = tables.slice(i, i + 10)
          const statements: string[] = []
          for (const table of batch) {
            const viewNameId = randomUUID()
            statements.push(
              `INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version, allocated_by)
VALUES (${quoteLiteral(viewNameId)}::uuid, 'schema', ${quoteLiteral(aliasSchemaId)}::uuid,
        ${quoteLiteral(table.name)}, 'sql_view', 'active', 1, ${actor}::uuid);`,
              ...aliasView(
                base.schema_name,
                table.name,
                schema,
                table.name,
                await liveColumns(exec, table.id),
                comment(`${schema}.${table.name}`),
              ),
              `INSERT INTO _basedb.sql_view_alias (schema_id, target_table_id, name_id)
VALUES (${quoteLiteral(aliasSchemaId)}::uuid, ${quoteLiteral(table.id)}::uuid,
        ${quoteLiteral(viewNameId)}::uuid);`,
            )
          }
          steps.push({
            label: `Vues d’alias (${i + 1} à ${i + batch.length})`,
            lock: 'short',
            statements,
          })
        }
      }
      return {
        baseId: base.id,
        label: `Renommage physique de la base « ${base.label} »`,
        from: base.schema_name,
        to: schema,
        name,
        alias: withAlias ? base.schema_name : null,
        steps,
      }
    }

    if (request.kind === 'table') {
      const table = await loadTable(exec, ctx, request.id)
      if (table.structure_state === 'frozen') {
        throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: table.id } })
      }
      await assertNameFree(exec, table.schema_id, name, MAX_TABLE_NAME_BYTES, {
        kind: 'relation',
        schema: table.schema_name,
      })
      const statements = [
        `INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version, previous_name_id, allocated_by)
VALUES (${quoteLiteral(newId)}::uuid, 'schema', ${quoteLiteral(table.schema_id)}::uuid,
        ${quoteLiteral(name)}, 'table', 'active', 1,
        ${quoteLiteral(table.table_name_id)}::uuid, ${actor}::uuid);`,
        `UPDATE _basedb.physical_name SET state = ${quoteLiteral(withAlias ? 'alias' : 'retired')},
       state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(table.table_name_id)}::uuid;`,
        `ALTER TABLE ${qualify(table.schema_name, table.table_name)} RENAME TO ${quoteIdentifier(name)};`,
        `UPDATE _basedb.table_def SET name_id = ${quoteLiteral(newId)}::uuid
 WHERE id = ${quoteLiteral(table.table_id)}::uuid;`,
        ...(withAlias
          ? [
              ...aliasView(
                table.schema_name,
                table.table_name,
                table.schema_name,
                name,
                await liveColumns(exec, table.table_id),
                comment(name),
              ),
              `INSERT INTO _basedb.sql_view_alias (schema_id, target_table_id, name_id, drop_after)
VALUES (${quoteLiteral(table.schema_id)}::uuid, ${quoteLiteral(table.table_id)}::uuid,
        ${quoteLiteral(table.table_name_id)}::uuid, ${dropAfter}::timestamptz);`,
            ]
          : []),
      ]
      return {
        baseId: table.id,
        label: `Renommage physique de la table « ${table.table_label} »`,
        from: table.table_name,
        to: name,
        name,
        alias: withAlias ? table.table_name : null,
        // The rename and the alias in ONE step: same relation, lock already held, and
        // `CREATE VIEW` only asks an ACCESS SHARE on the source (§2.4).
        steps: [
          {
            label: `Renommer ${table.table_name} en ${name}`,
            lock: 'exclusive' as const,
            statements,
          },
        ],
      }
    }

    const field = await loadField(exec, ctx, request.id)
    if (field.structure_state === 'frozen') {
      throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: field.id } })
    }
    await assertNameFree(exec, field.table_id, name, MAX_FIELD_NAME_BYTES, {
      kind: 'column',
      schema: field.schema_name,
      table: field.table_name,
    })
    // An AI prompt cites columns by physical name (chapter 12): rewritten in the same
    // step, or every cell it computes would read an empty value from now on.
    const citation = `\\{\\{\\s*${field.field_name}\\s*\\}\\}`
    const statements = [
      `INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version, previous_name_id, allocated_by)
VALUES (${quoteLiteral(newId)}::uuid, 'table', ${quoteLiteral(field.table_id)}::uuid,
        ${quoteLiteral(name)}, 'field', 'active', 1,
        ${quoteLiteral(field.field_name_id)}::uuid, ${actor}::uuid);`,
      `UPDATE _basedb.physical_name SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(field.field_name_id)}::uuid;`,
      `ALTER TABLE ${qualify(field.schema_name, field.table_name)} RENAME COLUMN ${quoteIdentifier(field.field_name)} TO ${quoteIdentifier(name)};`,
      `UPDATE _basedb.field SET name_id = ${quoteLiteral(newId)}::uuid
 WHERE id = ${quoteLiteral(field.field_id)}::uuid;`,
      `UPDATE _basedb.field_ai_config
   SET prompt = regexp_replace(prompt, ${quoteLiteral(citation)}, ${quoteLiteral(`{{${name}}}`)}, 'g')
 WHERE prompt ~ ${quoteLiteral(citation)}
   AND field_id IN (SELECT id FROM _basedb.field
                     WHERE table_id = ${quoteLiteral(field.table_id)}::uuid);`,
    ]
    return {
      baseId: field.id,
      label: `Renommage physique du champ « ${field.field_label} »`,
      from: field.field_name,
      to: name,
      name,
      alias: null,
      steps: [
        {
          label: `Renommer la colonne ${field.field_name} en ${name}`,
          lock: 'exclusive' as const,
          statements,
        },
      ],
    }
  })

  const migration = await runMigration(pools, ctx, {
    baseId: planned.baseId,
    label: planned.label,
    origin: originOf(ctx),
    steps: planned.steps,
    catalogDiff: {
      operation: `rename_${request.kind}_physical`,
      from: planned.from,
      to: planned.to,
      alias: planned.alias,
    },
    affectedObjects: [{ kind: request.kind, from: planned.from, to: planned.to }],
  })

  // What the administrator had in front of them, copied as it was (§2.1, step 4): six
  // months later, the question is what they saw, not what the same query says today.
  await withTransaction(pools, 'catalog', ctx, (exec) =>
    writeAudit(exec, ctx, {
      action: `physical.rename_${request.kind}`,
      objectKind: request.kind,
      objectId: request.id,
      objectName: planned.from,
      baseId: planned.baseId,
      payload: {
        from: planned.from,
        to: planned.to,
        alias: planned.alias,
        impact: {
          webhooks: impact.webhooks,
          tokens: impact.tokens,
          misaligned_links: impact.misalignedLinks,
          dependents: impact.dependents,
          estimated_rows: impact.estimatedRows,
          bytes: impact.bytes,
        },
      },
    }),
  )
  return { migration, name: planned.name, alias: planned.alias }
}

// ── Aliases ────────────────────────────────────────────────────────────────────

/** A compatibility alias, as the maintenance screen lists it (§3.5). */
export interface AliasSummary {
  readonly id: string
  /** `schema`: the old name of a base; `view`: the old name of a table. */
  readonly kind: 'schema' | 'view'
  /** The name consumers write. */
  readonly name: string
  readonly qualified: string
  /** What it leads to, under its current name. */
  readonly target: string
  readonly targetLabel: string
  readonly createdAt: string
  readonly dropAfter: string | null
  /** A blank cut in progress: the alias is renamed until `until`. */
  readonly blankCut: { readonly from: string; readonly until: string; readonly name: string } | null
  readonly views: number
  /** Objects unknown to the catalog built on the alias: they block its removal. */
  readonly dependents: readonly string[]
}

type AliasRow = {
  readonly id: string
  readonly kind: 'schema' | 'view'
  readonly base_id: string
  readonly name: string
  readonly name_id: string
  readonly schema_id: string
  /** The schema the alias object lives in — for a schema alias, itself. */
  readonly home: string
  readonly target: string
  readonly target_label: string
  readonly created_at: string
  readonly drop_after: string | null
  readonly cut_from: string | null
  readonly cut_until: string | null
  readonly cut_name: string | null
  readonly cut_name_id: string | null
  readonly views: number
}

const ALIASES = `
  SELECT s.id::text, 'schema' AS kind, s.base_id::text, n.name, s.name_id::text,
         s.id::text AS schema_id, n.name AS home, cur.name AS target, b.label AS target_label,
         s.created_at::text, s.drop_after::text, s.blank_cut_from::text AS cut_from,
         s.blank_cut_until::text AS cut_until, cn.name AS cut_name,
         s.blank_cut_name_id::text AS cut_name_id,
         (SELECT count(*)::int FROM _basedb.sql_view_alias v
           WHERE v.schema_id = s.id AND v.dropped_at IS NULL) AS views
    FROM _basedb.db_schema s
    JOIN _basedb.base b             ON b.id = s.base_id
    JOIN _basedb.tenant t           ON t.id = b.tenant_id
    JOIN _basedb.physical_name n    ON n.id = s.name_id
    JOIN _basedb.db_schema cs       ON cs.base_id = s.base_id AND cs.role = 'current'
                                   AND cs.dropped_at IS NULL
    JOIN _basedb.physical_name cur  ON cur.id = cs.name_id
    LEFT JOIN _basedb.physical_name cn ON cn.id = s.blank_cut_name_id
   WHERE s.role = 'alias' AND s.dropped_at IS NULL AND t.ref = $1 AND b.is_live
  UNION ALL
  SELECT v.id::text, 'view' AS kind, s.base_id::text, n.name, v.name_id::text,
         s.id::text AS schema_id, sn.name AS home, sn.name || '.' || tn.name AS target,
         td.label AS target_label, v.created_at::text, v.drop_after::text,
         v.blank_cut_from::text, v.blank_cut_until::text, cn.name, v.blank_cut_name_id::text,
         1 AS views
    FROM _basedb.sql_view_alias v
    JOIN _basedb.db_schema s        ON s.id = v.schema_id AND s.role = 'current'
    JOIN _basedb.base b             ON b.id = s.base_id
    JOIN _basedb.tenant t           ON t.id = b.tenant_id
    JOIN _basedb.physical_name n    ON n.id = v.name_id
    JOIN _basedb.physical_name sn   ON sn.id = s.name_id
    JOIN _basedb.table_def td       ON td.id = v.target_table_id
    JOIN _basedb.physical_name tn   ON tn.id = td.name_id
    LEFT JOIN _basedb.physical_name cn ON cn.id = v.blank_cut_name_id
   WHERE v.dropped_at IS NULL AND t.ref = $1 AND b.is_live`

async function aliasDependents(exec: Executor, alias: AliasRow): Promise<string[]> {
  // During a blank cut the object carries its cut name: that is where PostgreSQL has it.
  const inPlace = alias.cut_name ?? alias.name
  return alias.kind === 'schema'
    ? dependentsOfSchema(exec, inPlace)
    : dependentsOf(exec, alias.home, inPlace)
}

const toSummary = (row: AliasRow, dependents: readonly string[]): AliasSummary => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  qualified: row.kind === 'schema' ? row.name : `${row.home}.${row.name}`,
  target: row.target,
  targetLabel: row.target_label,
  createdAt: new Date(row.created_at).toISOString(),
  dropAfter: row.drop_after === null ? null : new Date(row.drop_after).toISOString(),
  blankCut:
    row.cut_from === null || row.cut_until === null || row.cut_name === null
      ? null
      : {
          from: new Date(row.cut_from).toISOString(),
          until: new Date(row.cut_until).toISOString(),
          name: row.cut_name,
        },
  views: row.views,
  dependents,
})

/** The live aliases of a base — the maintenance screen of §3.5. */
export async function listAliases(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<AliasSummary[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await loadBase(exec, ctx, request.baseId)
      await requireLifecycleAdmin(exec, ctx, request.baseId)
      const rows = await exec.query<AliasRow>(
        `SELECT * FROM (${ALIASES}) a WHERE a.base_id = $2 ORDER BY a.created_at DESC`,
        [ctx.tenantId, request.baseId],
      )
      const out: AliasSummary[] = []
      for (const row of rows) out.push(toSummary(row, await aliasDependents(exec, row)))
      return out
    },
    { readOnly: true },
  )
}

async function loadAlias(exec: Executor, ctx: RequestContext, aliasId: string): Promise<AliasRow> {
  if (!isUuid(aliasId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const [row] = await exec.query<AliasRow>(`SELECT * FROM (${ALIASES}) a WHERE a.id = $2`, [
    ctx.tenantId,
    aliasId,
  ])
  if (row === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { alias: aliasId } })
  await requireLifecycleAdmin(exec, ctx, row.base_id)
  return row
}

async function runAliasPlan(
  pools: Pools,
  ctx: RequestContext,
  alias: AliasRow,
  label: string,
  operation: string,
  steps: readonly MigrationStep[],
  payload: Record<string, unknown>,
): Promise<AliasSummary | null> {
  await runMigration(pools, ctx, {
    baseId: alias.base_id,
    label,
    origin: originOf(ctx),
    steps,
    catalogDiff: { operation, alias: alias.name, kind: alias.kind, ...payload },
  })
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await writeAudit(exec, ctx, {
      action: `alias.${operation}`,
      objectKind: alias.kind === 'schema' ? 'schema' : 'sql_view',
      objectId: alias.id,
      objectName: alias.name,
      baseId: alias.base_id,
      payload,
    })
    const [row] = await exec.query<AliasRow>(`SELECT * FROM (${ALIASES}) a WHERE a.id = $2`, [
      ctx.tenantId,
      alias.id,
    ])
    return row === undefined ? null : toSummary(row, await aliasDependents(exec, row))
  })
}

/**
 * The blank cut of §3.5: the alias is renamed `zz_alias_<date>_<name>` for a while; the
 * consumers it still serves break and say so, and one click puts it back — nothing was
 * destroyed. The only honest way to know whether an alias still serves.
 */
export async function startBlankCut(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly aliasId: string; readonly days?: number },
): Promise<AliasSummary | null> {
  const days = request.days ?? BLANK_CUT_MIN_DAYS
  if (!Number.isInteger(days) || days < BLANK_CUT_MIN_DAYS || days > 3650) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'days', minimum: BLANK_CUT_MIN_DAYS },
    })
  }
  const planned = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const alias = await loadAlias(exec, ctx, request.aliasId)
    if (alias.cut_name !== null) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { alias: alias.id, reason: 'deja_coupe' },
      })
    }
    const at = ctx.timestamp
    const stamp = quoteLiteral(at.toISOString())
    const until = quoteLiteral(new Date(at.getTime() + days * 86_400_000).toISOString())
    const actor = quoteLiteral(ctx.actor.id)
    const wanted = `zz_alias_${relegationDate(at)}_${truncateBytes(alias.name, CUT_NAME_BYTES)}`
    const scopeId = alias.kind === 'schema' ? SCOPE_INSTANCE : alias.schema_id
    const cutName = await freeName(
      exec,
      scopeId,
      wanted,
      new Set(),
      alias.kind === 'schema' ? { kind: 'schema' } : { kind: 'relation', in: alias.home },
    )
    const cutId = randomUUID()
    const table = alias.kind === 'schema' ? '_basedb.db_schema' : '_basedb.sql_view_alias'
    const statements = [
      `INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version, previous_name_id, allocated_by)
VALUES (${quoteLiteral(cutId)}::uuid, ${quoteLiteral(alias.kind === 'schema' ? 'instance' : 'schema')},
        ${quoteLiteral(scopeId)}::uuid, ${quoteLiteral(cutName)},
        ${quoteLiteral(alias.kind === 'schema' ? 'schema' : 'sql_view')}, 'relegated', 1,
        ${quoteLiteral(alias.name_id)}::uuid, ${actor}::uuid);`,
      `UPDATE _basedb.physical_name SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(alias.name_id)}::uuid;`,
      alias.kind === 'schema'
        ? `ALTER SCHEMA ${quoteIdentifier(alias.name)} RENAME TO ${quoteIdentifier(cutName)};`
        : `ALTER VIEW ${qualify(alias.home, alias.name)} RENAME TO ${quoteIdentifier(cutName)};`,
      `UPDATE ${table}
   SET blank_cut_from = ${stamp}::timestamptz, blank_cut_until = ${until}::timestamptz,
       blank_cut_name_id = ${quoteLiteral(cutId)}::uuid
 WHERE id = ${quoteLiteral(alias.id)}::uuid;`,
    ]
    return { alias, cutName, statements }
  })
  return runAliasPlan(
    pools,
    ctx,
    planned.alias,
    `Coupure à blanc de l’alias ${planned.alias.name}`,
    'blank_cut',
    [
      {
        label: `Renommer ${planned.alias.name} en ${planned.cutName}`,
        lock: 'short',
        statements: planned.statements,
      },
    ],
    { cut_name: planned.cutName, days },
  )
}

/** Puts a cut alias back under its name — one operation, the object was never destroyed. */
export async function endBlankCut(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly aliasId: string },
): Promise<AliasSummary | null> {
  const planned = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const alias = await loadAlias(exec, ctx, request.aliasId)
    if (alias.cut_name === null || alias.cut_name_id === null) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { alias: alias.id, reason: 'pas_coupe' },
      })
    }
    // The name was free when cut; someone may have created an object under it since.
    const [outside] =
      alias.kind === 'schema'
        ? await exec.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [alias.name])
        : await exec.query(
            `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = $1 AND c.relname = $2`,
            [alias.home, alias.name],
          )
    if (outside !== undefined) {
      throw new BasedbError('NAME_TAKEN_OUTSIDE_REGISTRY', { details: { name: alias.name } })
    }
    const stamp = quoteLiteral(ctx.timestamp.toISOString())
    const table = alias.kind === 'schema' ? '_basedb.db_schema' : '_basedb.sql_view_alias'
    const statements = [
      alias.kind === 'schema'
        ? `ALTER SCHEMA ${quoteIdentifier(alias.cut_name)} RENAME TO ${quoteIdentifier(alias.name)};`
        : `ALTER VIEW ${qualify(alias.home, alias.cut_name)} RENAME TO ${quoteIdentifier(alias.name)};`,
      `UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(alias.cut_name_id)}::uuid;`,
      `UPDATE _basedb.physical_name SET state = 'alias', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(alias.name_id)}::uuid;`,
      `UPDATE ${table}
   SET blank_cut_from = NULL, blank_cut_until = NULL, blank_cut_name_id = NULL
 WHERE id = ${quoteLiteral(alias.id)}::uuid;`,
    ]
    return { alias, statements }
  })
  return runAliasPlan(
    pools,
    ctx,
    planned.alias,
    `Remise en service de l’alias ${planned.alias.name}`,
    'blank_cut_end',
    [{ label: `Rétablir ${planned.alias.name}`, lock: 'short', statements: planned.statements }],
    {},
  )
}

/**
 * Drops an alias — after its term, or forced, always confirmed by typing its name.
 * Never with `CASCADE`: a view someone built on it blocks the drop, by name (§3.4).
 */
export async function dropAlias(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly aliasId: string; readonly confirm: string },
): Promise<void> {
  const planned = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const alias = await loadAlias(exec, ctx, request.aliasId)
    checkConfirm(request.confirm, alias.name)
    const dependents = await aliasDependents(exec, alias)
    if (dependents.length > 0) {
      throw new BasedbError('DEPENDENT_OBJECT', {
        details: { alias: alias.name, dependents },
      })
    }
    const stamp = quoteLiteral(ctx.timestamp.toISOString())
    const inPlace = alias.cut_name ?? alias.name
    const closeNames = [
      `UPDATE _basedb.physical_name SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(alias.name_id)}::uuid;`,
      ...(alias.cut_name_id === null
        ? []
        : [
            `UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(alias.cut_name_id)}::uuid;`,
          ]),
    ]

    if (alias.kind === 'view') {
      return {
        alias,
        steps: [
          {
            label: `Supprimer la vue d’alias ${alias.name}`,
            lock: 'short' as const,
            statements: [
              `DROP VIEW ${qualify(alias.home, inPlace)} RESTRICT;`,
              `UPDATE _basedb.sql_view_alias SET dropped_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(alias.id)}::uuid;`,
              ...closeNames,
            ],
          },
        ],
      }
    }

    const views = await exec.query<{ id: string; name: string; name_id: string }>(
      `SELECT v.id::text, n.name, v.name_id::text FROM _basedb.sql_view_alias v
         JOIN _basedb.physical_name n ON n.id = v.name_id
        WHERE v.schema_id = $1 AND v.dropped_at IS NULL`,
      [alias.id],
    )
    const steps: MigrationStep[] = []
    for (let i = 0; i < views.length; i += 10) {
      const batch = views.slice(i, i + 10)
      steps.push({
        label: `Supprimer ${batch.length} vue${batch.length > 1 ? 's' : ''} d’alias`,
        lock: 'short',
        statements: batch.flatMap((view) => [
          `DROP VIEW IF EXISTS ${qualify(inPlace, view.name)} RESTRICT;`,
          `UPDATE _basedb.sql_view_alias SET dropped_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(view.id)}::uuid;`,
          `UPDATE _basedb.physical_name SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(view.name_id)}::uuid;`,
        ]),
      })
    }
    steps.push({
      label: `Supprimer le schéma d’alias ${alias.name}`,
      lock: 'short',
      statements: [
        // RESTRICT: an object we do not know about in the alias schema makes this fail
        // rather than disappear (§3.5).
        `DROP SCHEMA ${quoteIdentifier(inPlace)} RESTRICT;`,
        `UPDATE _basedb.db_schema SET dropped_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(alias.id)}::uuid;`,
        ...closeNames,
      ],
    })
    return { alias, steps }
  })
  await runAliasPlan(
    pools,
    ctx,
    planned.alias,
    `Suppression de l’alias ${planned.alias.name}`,
    'drop',
    planned.steps,
    { drop_after: planned.alias.drop_after },
  )
}
