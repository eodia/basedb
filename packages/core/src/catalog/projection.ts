import { qualify } from '@basedb/naming'
import { COMPUTED_KINDS } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { type FormulaDialect, type Node, renderFormula } from '../formula/language.js'
import type { ActorGrants } from '../rbac/decide.js'
import { type Action, SYSTEM_COLUMNS, type Target, decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type CatalogVersions, catalogCache, grantsCache, readVersions } from './cache.js'
import { SYSTEM_COLUMN_DESCRIPTIONS } from './description.js'
import type { FieldFormat } from './formats.js'

/**
 * Catalog projection — chapter 08 §9.
 *
 * ONE function, three serializations. `/meta/bases/{base}`, its OpenAPI rendering and
 * its human-readable documentation are three views of the tree built here, from the
 * same catalog and the same effective permissions.
 *
 * That is a security requirement, not an aesthetic one: a carefully filtered OpenAPI
 * specification, flanked by a neighbouring route handing back the full list of tables,
 * the target of every link field and the display columns, filters nothing at all.
 *
 * Consequence: two readers see two different descriptions, and that IS the rule. What a
 * reader cannot read does not appear — no path, no schema, no mention.
 */

/** What a link field discloses, once the reader's rights have been applied. */
export interface ProjectedLink {
  readonly onDelete: 'restrict' | 'set_null' | 'cascade'
  readonly required: boolean
  /**
   * ABSENT when the target table is invisible — not even its name is disclosed (§9.3).
   * The field itself stays described: it belongs to a table the reader can read.
   */
  readonly target?: {
    readonly table: string
    readonly displayField: string | null
  }
  /** A field enters the `expand` enum only when its target is readable. */
  readonly expandable: boolean
  /** True when the target is invisible: `id` is then always null (§5.5 shape). */
  readonly masked: boolean
}

/**
 * The format of a field, published only when it says something: a plain number or a plain
 * text reads as it always did, and saying so on every field would be noise.
 */
function formatOf(field: FieldRow): { format?: FieldFormat } {
  const display = field.kind === 'number' ? field.number_format : field.text_format
  if (display === null || display === 'decimal' || display === 'plain') return {}
  return {
    format: {
      display,
      currency: field.currency_code,
      ratingMax: field.rating_max === null ? null : Number(field.rating_max),
    },
  }
}

export interface ProjectedField {
  readonly name: string
  readonly label: string
  /**
   * What the field is FOR, in the words of whoever designed it — `null` when nobody said.
   * Plain text, bounded (`description.ts`): every serialization shows it as-is, escaped.
   */
  readonly description: string | null
  readonly kind: string
  readonly required: boolean
  /** Readable but not writable. System columns are ALWAYS read-only (A18). */
  readonly readOnly: boolean
  readonly system: boolean
  /**
   * Rich text: the API does NOT re-sanitize on read (§7.6), so the contract is that
   * every consumer sanitizes at render time — and the description has to say so.
   */
  readonly unsafeHtml: boolean
  /**
   * The choices of a `select`, in their order.
   *
   * Published because they are a CHECK constraint on a column the reader can already
   * see: a client that does not know them can only write values the database refuses.
   */
  readonly options?: ReadonlyArray<ProjectedOption>
  readonly link?: ProjectedLink
  /** How the value reads, when it is not plain (`formats.ts`). */
  readonly format?: FieldFormat
  /**
   * Present and `true` when the field is withheld from agents (09 §12.2): on the MCP
   * surface it is exactly an unreadable field. The human reader still sees it — this is
   * what lets the documentation say which columns an agent will not.
   */
  readonly hiddenFromAgents?: boolean
  /**
   * Present and `true` when the field is computed by the AI (chapter 12 §1.5): its value
   * is the model's, written by the kernel, and nobody else's — hence also `readOnly`.
   */
  readonly ai?: boolean
  /** A formula, a lookup, a rollup or a count: what it computes (chapter 04 §7, §7 ter). */
  readonly computed?: ProjectedComputed
  /** A button's label and what it does (chapter 17 §4). */
  readonly button?: ProjectedButton
}

/** A button: its label, its colour, and what a click does. */
export interface ProjectedButton {
  readonly label: string
  readonly color: string | null
  readonly action: 'url' | 'automation'
  readonly url: string | null
  readonly automation: string | null
}

/** What a computed field says of itself, once the reader's rights have been applied. */
export interface ProjectedComputed {
  /** The kind of its value — or of each value, for a list. */
  readonly resultKind: string
  /** A generated column; false when computed at read time. */
  readonly stored: boolean
  /** A list of values: a lookup reaching several rows. */
  readonly multiple: boolean
  /** A formula's expression, written with the labels of the day. */
  readonly expression?: string
  readonly timezone?: string | null
  /** The relation a lookup, a rollup or a count follows, and the table it reaches. */
  readonly via?: {
    readonly field: string
    readonly table: string
    readonly direction: 'outgoing' | 'incoming'
    readonly reached: string
  }
  readonly target?: string | null
  readonly aggregate?: string | null
}

export interface ProjectedTable {
  readonly id: string
  readonly name: string
  readonly label: string
  /** What the table holds and what it is used for; `null` when nobody said. */
  readonly description: string | null
  /** What the caller writes in psql — the point of the whole product. */
  readonly sql: string
  /** Only the verbs the reader holds: `read` alone means only the GETs are described. */
  readonly actions: readonly Action[]
  readonly fields: readonly ProjectedField[]
  /** `…/{id}/referenced_by` is described only if at least one inverse group is visible. */
  readonly referencedBy: boolean
  /**
   * The column shown instead of an identifier when this table is a link target.
   *
   * `null` when none is designated — a valid state: the table stays a legitimate target
   * and its cells show the identifier. Withheld when the reader cannot see that column,
   * since naming it would name a field they may not read.
   */
  readonly displayField: string | null
  /** How the table looks — a colour, a pictogram or a picture; keys always present. */
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  /** Kept like a source by the server: its rows are not written by hand (chapter 19 §3). */
  readonly synced: boolean
}

export interface ProjectedBase {
  readonly id: string
  /** Logical name — the one in the URL and in the SQL schema. */
  readonly name: string
  readonly label: string
  /** What this base is for; `null` when nobody said. */
  readonly description: string | null
  /** The project the base belongs to — a catalog grouping, with no physical existence. */
  readonly project: { readonly id: string; readonly label: string }
  /**
   * The verbs the reader holds on the BASE itself — granted on it, its project or the
   * tenant. `manage_schema` here is what lets them add a table.
   */
  readonly baseActions: readonly Action[]
  /** `false` when the base does not exist on the agent surface at all (09 §12.2). */
  readonly agentsEnabled: boolean
  readonly tables: readonly ProjectedTable[]
  /** How the base looks — the same three keys as a table or an option. */
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  /** Which environment of its base this one is (chapter 14). */
  readonly environment: BaseEnvironment
}

/**
 * The environment a base is — production, recette… (chapter 14). The environments of one
 * base share its lineage; production is the one there is before any other.
 */
export interface BaseEnvironment {
  readonly lineage: string
  readonly label: string
  readonly production: boolean
  readonly position: number
}

/** One line of `GET /meta/bases`. */
export interface VisibleBase {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly project: { readonly id: string; readonly label: string }
  /** Readable tables only: the count must not betray those that are masked. */
  readonly tableCount: number
}

export interface BaseRow extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly schema_name: string
  /** `false`: the base does not exist on the agent surface (09 §12.2). */
  readonly mcp_enabled: boolean
  readonly catalog_version: string
  readonly project_id: string
  readonly lineage_id: string
  readonly environment: string
  readonly is_production: boolean
  readonly environment_position: number
}

/** A project: the grouping of bases the interface navigates by (02, 05 §15). */
export interface ProjectRow extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly position: number
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
}

export interface TableRow extends Record<string, unknown> {
  readonly id: string
  readonly base_id: string
  readonly label: string
  readonly description: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly table_name: string
  readonly schema_name: string
  readonly display_field_id: string | null
  readonly synced: boolean
}

export interface FieldRow extends Record<string, unknown> {
  readonly id: string
  readonly table_id: string
  readonly label: string
  readonly description: string | null
  readonly kind: string
  readonly is_required: boolean
  readonly column: string
  readonly is_rich: boolean
  /** `false`: on the agent surface, exactly an unreadable field (09 §12.2). */
  readonly expose_to_agents: boolean
  readonly max_length: number | null
  /** A formula's expression as its author typed it, its result type, and whether stored. */
  readonly formula_expression: string | null
  readonly formula_result_kind: string | null
  readonly formula_is_stored: boolean | null
  /** The AI option is on: a model fills the field (`field_ai_config`). */
  readonly has_ai: boolean
  /** How a number or a short text reads — its display format, currency, stars. */
  readonly number_format: string | null
  readonly currency_code: string | null
  readonly rating_max: number | null
  readonly text_format: string | null
  readonly formula_ast: Node | null
  readonly formula_timezone: string | null
  /** The fields a formula cites, by catalog key. */
  readonly formula_deps: readonly string[] | null
  readonly rollup_direction: 'outgoing' | 'incoming' | null
  readonly rollup_via_id: string | null
  readonly rollup_target_id: string | null
  readonly rollup_aggregate: string | null
  readonly rollup_result_kind: string | null
  readonly rollup_multiple: boolean | null
  readonly button_label: string | null
  readonly button_color: string | null
  readonly button_action: 'url' | 'automation' | null
  readonly button_url: string | null
  readonly button_automation: string | null
}

/**
 * A choice of a `select`, and how it looks. The look is the catalog's alone: no column of
 * the user's table carries it, which is why it can change without a migration. The keys
 * are always present, `null` when unset, so a client reads one shape.
 */
export interface ProjectedOption {
  readonly value: string
  readonly label: string
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
}

interface OptionRow extends Record<string, unknown>, ProjectedOption {
  readonly field_id: string
}

export interface LinkRow extends Record<string, unknown> {
  readonly field_id: string
  readonly target_table_id: string
  readonly on_delete: 'restrict' | 'set_null' | 'cascade'
  /**
   * Physical names of the foreign key and its index, as the registry holds them. A
   * multi-link has no foreign key: `null`, and its index is the GIN of 04 §4 bis.
   */
  readonly fk_constraint: string | null
  readonly fk_index: string
}

/** An application of a base: a named grouping of its tables (02). */
export interface ApplicationRow extends Record<string, unknown> {
  readonly id: string
  readonly base_id: string
  readonly name: string
  readonly label: string
}

export interface RawCatalog {
  readonly projects: readonly ProjectRow[]
  readonly bases: readonly BaseRow[]
  readonly tables: readonly TableRow[]
  readonly fields: readonly FieldRow[]
  readonly links: readonly LinkRow[]
  readonly options: ReadonlyMap<string, ReadonlyArray<ProjectedOption>>
  /** Table → the applications it belongs to, which take part in the decision (05 §1.4). */
  readonly applications: ReadonlyMap<string, readonly string[]>
  readonly applicationRows: readonly ApplicationRow[]
  /** Fields carrying a single-column `UNIQUE` constraint of their own → its name. */
  readonly unique: ReadonlyMap<string, string>
  /** Formula field → the fields its expression reads. */
  readonly formulaSources: ReadonlyMap<string, readonly string[]>
}

/**
 * Loads the tenant's catalog WHOLE, in five queries.
 *
 * Whole, and not "the visible part": §7.2 requires name resolution to happen in memory,
 * on a dictionary holding invisible objects as well, so that a resolution failure and a
 * visibility refusal cost the same. Filtering in SQL would reintroduce the very timing
 * difference the chapter is at pains to remove.
 */
async function loadCatalog(exec: Executor, ctx: RequestContext): Promise<RawCatalog> {
  const tenant = [ctx.tenantId]

  const projects = await exec.query<ProjectRow>(
    `SELECT p.id, p.label, p.description, p.position, p.color, p.icon, p.image
       FROM _basedb.project p
       JOIN _basedb.tenant t ON t.id = p.tenant_id
      WHERE t.ref = $1 AND p.deleted_at IS NULL
      ORDER BY p.position, p.label`,
    tenant,
  )

  const bases = await exec.query<BaseRow>(
    `SELECT b.id, b.label, b.description, b.color, b.icon, b.image, sn.name AS schema_name,
            b.mcp_enabled, b.catalog_version, b.project_id,
            b.lineage_id, b.environment, b.is_production, b.environment_position
       FROM _basedb.base b
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                    AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.ref = $1 AND b.is_live AND b.deleted_at IS NULL
      ORDER BY b.label, NOT b.is_production, b.environment_position, b.environment`,
    tenant,
  )

  const tables = await exec.query<TableRow>(
    `SELECT t.id, t.base_id, t.label, t.description, t.color, t.icon, t.image,
            tn.name AS table_name, sn.name AS schema_name, t.display_field_id,
            EXISTS (SELECT 1 FROM _basedb.table_sync ts WHERE ts.table_id = t.id) AS synced
       FROM _basedb.table_def t
       JOIN _basedb.base b           ON b.id = t.base_id
       JOIN _basedb.tenant te        ON te.id = b.tenant_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE te.ref = $1 AND t.is_live AND t.deleted_at IS NULL
        AND b.is_live AND b.deleted_at IS NULL
      ORDER BY t.position, t.label`,
    tenant,
  )

  const fields = await exec.query<FieldRow>(
    `SELECT f.id, f.table_id, f.label, f.description, f.kind, f.is_required, n.name AS column,
            coalesce(tc.is_rich, false) AS is_rich, f.expose_to_agents, tc.max_length,
            fc.input_expression AS formula_expression, fc.result_kind AS formula_result_kind,
            fc.is_stored AS formula_is_stored,
            EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai,
            nc.display_format AS number_format, nc.currency_code, nc.rating_max,
            tc.display_format AS text_format,
            fc.ast AS formula_ast, fc.timezone AS formula_timezone,
            CASE WHEN fc.field_id IS NULL THEN NULL ELSE ARRAY(
              SELECT d.depends_on_field_id::text FROM _basedb.field_formula_dependency d
               WHERE d.formula_field_id = f.id) END AS formula_deps,
            rc.direction AS rollup_direction, rc.via_field_id AS rollup_via_id,
            rc.target_field_id AS rollup_target_id, rc.aggregate AS rollup_aggregate,
            rc.result_kind AS rollup_result_kind, rc.is_multiple AS rollup_multiple,
            bc.label AS button_label, bc.color AS button_color, bc.action AS button_action,
            bc.url_template AS button_url, bc.automation_id::text AS button_automation
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
       LEFT JOIN _basedb.field_text_config tc    ON tc.field_id = f.id
       LEFT JOIN _basedb.field_number_config nc  ON nc.field_id = f.id
       LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
       LEFT JOIN _basedb.field_rollup_config rc  ON rc.field_id = f.id
       LEFT JOIN _basedb.field_button_config bc  ON bc.field_id = f.id
       JOIN _basedb.table_def t     ON t.id = f.table_id
       JOIN _basedb.base b          ON b.id = t.base_id
       JOIN _basedb.tenant te       ON te.id = b.tenant_id
      WHERE te.ref = $1 AND f.is_live AND f.deleted_at IS NULL AND t.is_live
      ORDER BY f.position, f.label`,
    tenant,
  )

  // The names of a link's constraint and index come from the registry, never recomposed
  // from a pattern: chapter 09 §4.2 publishes them to be quoted in SQL as they are.
  const links = await exec.query<LinkRow>(
    `SELECT lc.field_id, lc.target_table_id, lc.on_delete,
            cn.name AS fk_constraint, xn.name AS fk_index
       FROM _basedb.field_link_config lc
       JOIN _basedb.field f     ON f.id = lc.field_id
       JOIN _basedb.table_def t ON t.id = f.table_id
       JOIN _basedb.base b      ON b.id = t.base_id
       JOIN _basedb.tenant te   ON te.id = b.tenant_id
       LEFT JOIN _basedb.table_constraint c ON c.id = lc.fk_constraint_id
       LEFT JOIN _basedb.physical_name cn   ON cn.id = c.name_id
       JOIN _basedb.table_index x      ON x.id = lc.fk_index_id
       JOIN _basedb.physical_name xn   ON xn.id = x.name_id
      WHERE te.ref = $1 AND lc.fk_dropped_at IS NULL AND f.is_live AND t.is_live`,
    tenant,
  )

  const uniqueRows = await exec.query<{ field_id: string; name: string }>(
    `SELECT min(m.field_id::text)::uuid AS field_id, min(cn.name) AS name
       FROM _basedb.table_constraint c
       JOIN _basedb.physical_name cn          ON cn.id = c.name_id
       JOIN _basedb.table_constraint_member m ON m.constraint_id = c.id
       JOIN _basedb.table_def t ON t.id = c.table_id
       JOIN _basedb.base b      ON b.id = t.base_id
       JOIN _basedb.tenant te   ON te.id = b.tenant_id
      WHERE te.ref = $1 AND c.kind = 'unique' AND c.dropped_at IS NULL AND t.is_live
      GROUP BY c.id
     HAVING count(*) = 1`,
    tenant,
  )

  const dependencyRows = await exec.query<{ formula_field_id: string; field_id: string }>(
    `SELECT d.formula_field_id, d.depends_on_field_id AS field_id
       FROM _basedb.field_formula_dependency d
       JOIN _basedb.table_def t ON t.id = d.table_id
       JOIN _basedb.base b      ON b.id = t.base_id
       JOIN _basedb.tenant te   ON te.id = b.tenant_id
      WHERE te.ref = $1 AND NOT d.formula_is_purged AND NOT d.depends_on_is_purged`,
    tenant,
  )
  const formulaSources = new Map<string, string[]>()
  for (const row of dependencyRows) {
    const list = formulaSources.get(row.formula_field_id) ?? []
    list.push(row.field_id)
    formulaSources.set(row.formula_field_id, list)
  }

  const applicationRows = await exec.query<ApplicationRow>(
    `SELECT a.id, a.base_id, a.name, a.label
       FROM _basedb.application a
       JOIN _basedb.base b    ON b.id = a.base_id
       JOIN _basedb.tenant te ON te.id = b.tenant_id
      WHERE te.ref = $1 AND a.deleted_at IS NULL
      ORDER BY a.position, a.label`,
    tenant,
  )

  const optionRows = await exec.query<OptionRow>(
    `SELECT o.field_id, o.value, o.label, o.color, o.icon, o.image
       FROM _basedb.select_option o
       JOIN _basedb.field f     ON f.id = o.field_id
       JOIN _basedb.table_def t ON t.id = f.table_id
       JOIN _basedb.base b      ON b.id = t.base_id
       JOIN _basedb.tenant te   ON te.id = b.tenant_id
      WHERE te.ref = $1 AND o.deleted_at IS NULL AND f.is_live AND t.is_live
      ORDER BY o.position`,
    tenant,
  )
  const options = new Map<string, ProjectedOption[]>()
  for (const row of optionRows) {
    const list = options.get(row.field_id) ?? []
    list.push({
      value: row.value,
      label: row.label,
      color: row.color,
      icon: row.icon,
      image: row.image,
    })
    options.set(row.field_id, list)
  }

  // Application membership takes part in the decision (05 §1.4): omitting it would make
  // a table granted through an application scope disappear from the description while
  // staying readable through `/data` — two surfaces disagreeing about the same right.
  const rows = await exec.query<{ table_id: string; application_id: string }>(
    `SELECT appt.table_id, appt.application_id
       FROM _basedb.application_table appt
       JOIN _basedb.table_def t ON t.id = appt.table_id
       JOIN _basedb.base b      ON b.id = t.base_id
       JOIN _basedb.tenant te   ON te.id = b.tenant_id
      WHERE te.ref = $1 AND t.is_live`,
    tenant,
  )
  const applications = new Map<string, string[]>()
  for (const row of rows) {
    const list = applications.get(row.table_id) ?? []
    list.push(row.application_id)
    applications.set(row.table_id, list)
  }

  return {
    projects,
    bases,
    tables,
    fields,
    links,
    options,
    applications,
    applicationRows,
    unique: new Map(uniqueRows.map((r) => [r.field_id, r.name])),
    formulaSources,
  }
}

/**
 * Reading the catalog: ONE transaction, in `REPEATABLE READ` (02 §1896).
 *
 * A transaction alone is not enough. Under `READ COMMITTED`, loading bases, then tables,
 * then fields, then links in four successive queries would produce exactly what a cache
 * must never hold: a snapshot mixing two states, where a field belongs to a table that
 * no longer exists.
 */
const CATALOG_READ = { readOnly: true, isolation: 'repeatable read' } as const

/** The verbs that matter on a base or a project, as the interface offers them. */
export const BASE_ACTIONS: readonly Action[] = [
  'read',
  'create',
  'update',
  'delete',
  'manage_schema',
  'manage_tokens',
]

/** A base as a decision target, from its catalog row. */
export function baseTargetOf(ctx: RequestContext, base: BaseRow): Target {
  return {
    kind: 'base',
    id: base.id,
    tenantId: ctx.tenantId,
    projectId: base.project_id,
    baseId: base.id,
    agentsExcluded: !base.mcp_enabled,
  }
}

/** The four verbs a data route can require. `manage_*` describes no path. */
const DATA_ACTIONS: readonly Action[] = ['read', 'create', 'update', 'delete']

/** Groups the raw fields by table, in catalog order. */
export function fieldsByTableOf(raw: RawCatalog): Map<string, FieldRow[]> {
  const fieldsByTable = new Map<string, FieldRow[]>()
  for (const field of raw.fields) {
    const list = fieldsByTable.get(field.table_id) ?? []
    list.push(field)
    fieldsByTable.set(field.table_id, list)
  }
  return fieldsByTable
}

/**
 * The decision target of a table, as the raw catalog describes it — agent markers
 * included, so that the decider withholds on the `mcp` surface what 09 §12.2 withholds,
 * on this path exactly as on the data path (`loadTarget`).
 */
export function targetFactory(
  ctx: RequestContext,
  raw: RawCatalog,
  fieldsByTable: ReadonlyMap<string, readonly FieldRow[]> = fieldsByTableOf(raw),
): (table: TableRow) => Target {
  const agentsExcluded = new Set(raw.bases.filter((b) => !b.mcp_enabled).map((b) => b.id))
  const projectOf = new Map(raw.bases.map((b) => [b.id, b.project_id]))
  return (table) => {
    const fields = fieldsByTable.get(table.id) ?? []
    return {
      kind: 'table',
      id: table.id,
      tenantId: ctx.tenantId,
      projectId: projectOf.get(table.base_id),
      baseId: table.base_id,
      applicationIds: raw.applications.get(table.id) ?? [],
      fieldIds: fields.map((f) => f.id),
      agentHiddenFieldIds: fields.filter((f) => !f.expose_to_agents).map((f) => f.id),
      agentsExcluded: agentsExcluded.has(table.base_id),
      computedFieldIds: fields
        .filter((f) => COMPUTED_KINDS.has(f.kind) || f.has_ai)
        .map((f) => f.id),
    }
  }
}

/**
 * Builds the projection in memory, from the raw catalog and the actor's grants.
 *
 * Takes no executor on purpose: the projection renders NO decision against the database,
 * exactly as the decider does not read it. That is what makes it testable without a
 * database, and what bounds its cost. `dialect` is the language formulas are written in.
 */
export function project(
  ctx: RequestContext,
  grants: ActorGrants,
  raw: RawCatalog,
  dialect: FormulaDialect = 'fr',
): ProjectedBase[] {
  const fieldsByTable = fieldsByTableOf(raw)
  const projectById = new Map(raw.projects.map((p) => [p.id, p]))
  const linkByField = new Map(raw.links.map((l) => [l.field_id, l]))
  const tableById = new Map(raw.tables.map((t) => [t.id, t]))
  const fieldById = new Map(raw.fields.map((f) => [f.id, f]))
  const targetOf = targetFactory(ctx, raw, fieldsByTable)

  // Readability of every table is settled FIRST: a link's projection depends on whether
  // its target is readable, and that target may sit in a table processed later.
  const readable = new Map<string, ReadonlySet<string>>()
  for (const table of raw.tables) {
    const decision = decide(ctx, grants, 'read', targetOf(table))
    if (decision.verdict === 'ALLOWED') readable.set(table.id, decision.readableFields)
  }

  // An inverse group is visible when the SOURCE table is readable — the table the rows
  // come from, not the one being read.
  const referenced = new Set<string>()
  for (const link of raw.links) {
    const source = fieldById.get(link.field_id)
    if (source !== undefined && readable.has(source.table_id)) referenced.add(link.target_table_id)
  }

  const projected: ProjectedBase[] = []

  for (const base of raw.bases) {
    const tables: ProjectedTable[] = []

    for (const table of raw.tables.filter((t) => t.base_id === base.id)) {
      const readableFields = readable.get(table.id)
      // No path, no schema, no mention: the table does not exist for this reader.
      if (readableFields === undefined) continue

      const target = targetOf(table)
      // A synced table is written by its source alone (ch. 19 §3): whatever the grants,
      // it is read and nothing else — its fields read-only, its rows neither added nor
      // removed.
      const synced = table.synced === true
      const writable: ReadonlySet<string> = synced
        ? new Set()
        : decide(ctx, grants, 'update', target).writableFields
      const actions = DATA_ACTIONS.filter(
        (action) =>
          (!synced || action === 'read') &&
          decide(ctx, grants, action, target).verdict === 'ALLOWED',
      )

      // System columns are always described in read, and always read-only (A18). They
      // carry no `field` row, hence no field permission: they are not projected from the
      // catalog but stated here.
      const fields: ProjectedField[] = SYSTEM_COLUMNS.map((name) => ({
        name,
        label: name,
        description: SYSTEM_COLUMN_DESCRIPTIONS[name] ?? null,
        kind: 'system',
        required: false,
        readOnly: true,
        system: true,
        unsafeHtml: false,
      }))

      for (const field of fieldsByTable.get(table.id) ?? []) {
        if (!readableFields.has(field.id)) continue

        const link = linkByField.get(field.id)
        let projectedLink: ProjectedLink | undefined

        if (link !== undefined) {
          const targetTable = tableById.get(link.target_table_id)
          const targetReadable = readable.get(link.target_table_id)

          if (targetTable === undefined || targetReadable === undefined) {
            // The field stays described — it belongs to a table the reader can read —
            // but nothing of its target is said: not its name, not its display column.
            // And it does NOT enter the `expand` enum, since expanding it would be
            // refused anyway (05 §5.4).
            projectedLink = {
              onDelete: link.on_delete,
              required: field.is_required,
              expandable: false,
              masked: true,
            }
          } else {
            // The display column must itself be readable: announcing it would name a
            // field this reader cannot see.
            const displayId = targetTable.display_field_id
            const display =
              displayId !== null && targetReadable.has(displayId)
                ? (fieldById.get(displayId)?.column ?? null)
                : null

            projectedLink = {
              onDelete: link.on_delete,
              required: field.is_required,
              target: { table: targetTable.table_name, displayField: display },
              // An expansion follows one row: a multi-link is not expandable (04 §4 bis).
              expandable: field.kind === 'link',
              masked: false,
            }
          }
        }

        // A computed field says what it computes — and is absent for a reader who could not
        // read what it reads through (chapter 04 §7 ter.2).
        let computed: ProjectedComputed | undefined
        if (field.rollup_via_id !== null && field.rollup_direction !== null) {
          const via = fieldById.get(field.rollup_via_id)
          const viaLink = via === undefined ? undefined : linkByField.get(via.id)
          if (via === undefined || viaLink === undefined) continue
          const reachedId =
            field.rollup_direction === 'outgoing' ? viaLink.target_table_id : via.table_id
          const reachedFields = readable.get(reachedId)
          const viaReadable =
            field.rollup_direction === 'outgoing'
              ? readableFields.has(via.id)
              : reachedFields?.has(via.id) === true
          const targetReadable =
            field.rollup_target_id === null || reachedFields?.has(field.rollup_target_id) === true
          if (reachedFields === undefined || !viaReadable || !targetReadable) continue
          computed = {
            resultKind: field.rollup_result_kind ?? 'number',
            stored: false,
            multiple: field.rollup_multiple === true,
            via: {
              field: via.column,
              table: tableById.get(via.table_id)?.table_name ?? '',
              direction: field.rollup_direction,
              reached: tableById.get(reachedId)?.table_name ?? '',
            },
            target:
              field.rollup_target_id === null
                ? null
                : (fieldById.get(field.rollup_target_id)?.column ?? null),
            aggregate: field.rollup_aggregate,
          }
        } else if (field.kind === 'formula' && field.formula_ast !== null) {
          // Computed at read time, a formula over a field the reader cannot see would
          // say what the field holds.
          if (
            field.formula_is_stored === false &&
            !(field.formula_deps ?? []).every((id) => readableFields.has(id))
          ) {
            continue
          }
          computed = {
            resultKind: field.formula_result_kind ?? 'short_text',
            stored: field.formula_is_stored !== false,
            multiple: false,
            expression: renderFormula(
              field.formula_ast,
              (id) => fieldById.get(id)?.label ?? '?',
              dialect,
            ),
            timezone: field.formula_timezone,
          }
        }

        fields.push({
          name: field.column,
          label: field.label,
          description: field.description,
          kind: field.kind,
          required: field.is_required,
          readOnly: !writable.has(field.id),
          system: false,
          unsafeHtml: field.is_rich,
          ...(computed === undefined ? {} : { computed }),
          ...(field.button_action === null || field.button_label === null
            ? {}
            : {
                button: {
                  label: field.button_label,
                  color: field.button_color,
                  action: field.button_action,
                  url: field.button_url,
                  automation: field.button_automation,
                },
              }),
          ...(raw.options.has(field.id) ? { options: raw.options.get(field.id) } : {}),
          ...(projectedLink === undefined ? {} : { link: projectedLink }),
          ...(field.expose_to_agents ? {} : { hiddenFromAgents: true }),
          ...(field.has_ai ? { ai: true } : {}),
          ...formatOf(field),
        })
      }

      const ownDisplay =
        table.display_field_id !== null && readableFields.has(table.display_field_id)
          ? (fieldById.get(table.display_field_id)?.column ?? null)
          : null

      tables.push({
        id: table.id,
        name: table.table_name,
        label: table.label,
        description: table.description,
        sql: qualify(table.schema_name, table.table_name),
        actions,
        fields,
        referencedBy: referenced.has(table.id),
        displayField: ownDisplay,
        color: table.color,
        icon: table.icon,
        image: table.image,
        synced,
      })
    }

    // A base appears if and only if the caller holds `read` on at least one of its
    // tables (§9.1). A base with none is therefore absent, not empty.
    // A base appears when the caller reads at least one of its tables (§9.1) — or holds
    // a right on the base itself, granted there, on its project or on the tenant. The
    // second case is what lets whoever may build a base see it while it is still empty;
    // it discloses nothing a reconnaissance could not ask for, since the grant names it.
    const baseActions = BASE_ACTIONS.filter(
      (action) => decide(ctx, grants, action, baseTargetOf(ctx, base)).verdict === 'ALLOWED',
    )
    if (tables.length > 0 || baseActions.includes('read')) {
      const project = projectById.get(base.project_id)
      projected.push({
        id: base.id,
        name: base.schema_name,
        label: base.label,
        description: base.description,
        project: { id: base.project_id, label: project?.label ?? '' },
        baseActions,
        agentsEnabled: base.mcp_enabled,
        tables,
        color: base.color,
        icon: base.icon,
        image: base.image,
        environment: environmentOf(base),
      })
    }
  }

  return projected
}

/** A base row's environment, as every serialization names it. */
export function environmentOf(base: BaseRow): BaseEnvironment {
  return {
    lineage: base.lineage_id,
    label: base.environment,
    production: base.is_production,
    position: base.environment_position,
  }
}

/** Everything a projection needs, read once and reused while the counters hold still. */
export interface Snapshot {
  readonly grants: ActorGrants
  readonly raw: RawCatalog
  readonly versions: CatalogVersions
}

/**
 * Reads the counters, then the catalog and the grants — from cache when they have not
 * moved.
 *
 * One query instead of six on a hit. The counters are read INSIDE the same
 * `REPEATABLE READ` transaction as any reload, so a snapshot can never mix a version
 * taken before a write with a catalog read after it.
 */
export async function snapshot(pools: Pools, ctx: RequestContext): Promise<Snapshot> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const versions = await readVersions(exec, ctx.tenantId)
      // An unknown tenant is not an empty catalog: it is a refusal, and the same one a
      // caller carried onto someone else's tenant receives.
      if (versions === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tenant: ctx.tenantId } })
      }

      const now = Date.now()

      let raw = catalogCache.get(ctx.tenantId, versions, now) as RawCatalog | undefined
      if (raw === undefined) {
        raw = await loadCatalog(exec, ctx)
        catalogCache.set(ctx.tenantId, versions, now, raw)
      }

      // Grants are cached PER ACTOR, and invalidated by the same counters: any write to
      // `role`, `permission`, `app_user`… moves `authz_version`, so a revocation closes
      // the description as fast as it closes the data.
      // Keyed by TENANT AND actor, not by actor alone: the counters of two tenants
      // could coincide, and an actor must never be served a snapshot computed under
      // someone else's partition. A token is an actor of its own — its grants are its
      // creator's intersected with its role — so it never shares its creator's entry.
      const grantsKey = `${ctx.tenantId}|${ctx.actor.id}|${ctx.actor.tokenId ?? ''}`
      let grants = grantsCache.get(grantsKey, versions, now)
      if (grants === undefined) {
        grants = await loadGrants(exec, ctx)
        grantsCache.set(grantsKey, versions, now, grants)
      }

      return { grants, raw, versions }
    },
    CATALOG_READ,
  )
}

/** The bases visible to the caller — `GET /meta/bases`. */
export async function listVisibleBases(
  pools: Pools,
  ctx: RequestContext,
): Promise<readonly VisibleBase[]> {
  const { grants, raw } = await snapshot(pools, ctx)
  return project(ctx, grants, raw).map((base) => ({
    id: base.id,
    name: base.name,
    label: base.label,
    description: base.description,
    color: base.color,
    icon: base.icon,
    image: base.image,
    project: base.project,
    tableCount: base.tables.length,
  }))
}

/**
 * The projected description of one base — `GET /meta/bases/{base}`.
 *
 * `reference` is a logical name or a UUID, and telling them apart needs no prefix: a
 * canonical UUID carries dashes, which alphabet B of chapter 01 forbids in a logical
 * name (§1.1). The two namespaces cannot collide.
 */
export async function projectBase(
  pools: Pools,
  ctx: RequestContext,
  reference: string,
): Promise<ProjectedBase> {
  const { grants, raw } = await snapshot(pools, ctx)
  const found = project(ctx, grants, raw).find((b) => b.name === reference || b.id === reference)
  // A base with no readable table is absent from the projection, so it lands here — the
  // very same refusal as a base that does not exist, which is the point.
  if (found === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: reference } })
  }
  return found
}

/** A table designated by name, once resolved and checked for visibility. */
export interface ResolvedTable {
  readonly tableId: string
  readonly baseId: string
  readonly tableName: string
  readonly baseName: string
}

/**
 * Resolves `{base}/{table}` — chapter 08 §1.1.
 *
 * Each segment is a logical name or a UUID, told apart by shape alone. The promise of
 * the product is that an integrator writes `/data/crm/factures` without consulting a
 * lookup table, exactly as they write `"b_t4z56fq_crm"."factures"` in SQL.
 *
 * An unknown name and an invisible table produce the SAME refusal, and both are decided
 * on the in-memory catalog: a resolution failure and a visibility refusal therefore cost
 * the same, which is what closes the timing oracle of §7.2.
 */
export async function resolveTable(
  pools: Pools,
  ctx: RequestContext,
  baseRef: string,
  tableRef: string,
): Promise<ResolvedTable> {
  const { grants, raw } = await snapshot(pools, ctx)
  const bases = project(ctx, grants, raw)

  const base = bases.find((b) => b.name === baseRef || b.id === baseRef)
  const table = base?.tables.find((t) => t.name === tableRef || t.id === tableRef)
  if (base === undefined || table === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseRef, table: tableRef } })
  }

  return { tableId: table.id, baseId: base.id, tableName: table.name, baseName: base.name }
}

/**
 * Resolves a base for a SCHEMA operation, without the visibility rule of §9.1.
 *
 * `/meta/bases` shows a base only when the caller reads at least one of its tables, and
 * that rule is right for a description: an empty base in the listing would answer the
 * only question a reconnaissance asks. But it cannot double as a resolution rule — a
 * base that has just been created has no table at all, so applying it would make adding
 * the FIRST table impossible.
 *
 * Tenant partitioning still applies: the catalog is loaded scoped to `ctx.tenantId`, and
 * the operation that follows renders its own decision.
 */
export async function resolveBase(
  pools: Pools,
  ctx: RequestContext,
  reference: string,
): Promise<{ readonly baseId: string; readonly baseName: string }> {
  const { raw } = await snapshot(pools, ctx)
  const base = raw.bases.find((b) => b.schema_name === reference || b.id === reference)
  if (base === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: reference } })
  }
  return { baseId: base.id, baseName: base.schema_name }
}

/**
 * Resolves `{base}/{table}/{field}` to a catalog key — by NAME, like the rest of the
 * URL plan.
 *
 * The identifier is deliberately not published by `/meta`: a UUIDv7 carries the instant
 * it was minted, so handing them out would tell every reader when each column was added.
 * The name is what the caller already sees, and it is enough to designate one.
 */
export async function resolveField(
  pools: Pools,
  ctx: RequestContext,
  baseRef: string,
  tableRef: string,
  fieldRef: string,
): Promise<{ readonly fieldId: string; readonly tableId: string; readonly name: string }> {
  const table = await resolveTable(pools, ctx, baseRef, tableRef)

  return pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ id: string; name: string }>(
      `SELECT f.id, n.name
         FROM _basedb.field f
         JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE f.table_id = $1 AND f.is_live AND (n.name = $2 OR f.id::text = $2)`,
      [table.tableId, fieldRef],
    )
    const found = rows[0]
    // Unknown, or masked for this reader: the same refusal, since the projection already
    // decided what this reader can see.
    if (found === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: fieldRef } })
    }
    return { fieldId: found.id, tableId: table.tableId, name: found.name }
  })
}
