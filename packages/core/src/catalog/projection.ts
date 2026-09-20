import { qualify } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import type { ActorGrants } from '../rbac/decide.js'
import { type Action, SYSTEM_COLUMNS, type Target, decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type CatalogVersions, catalogCache, grantsCache, readVersions } from './cache.js'
import { SYSTEM_COLUMN_DESCRIPTIONS } from './description.js'

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
}

export interface ProjectedBase {
  readonly id: string
  /** Logical name — the one in the URL and in the SQL schema. */
  readonly name: string
  readonly label: string
  /** What this base is for; `null` when nobody said. */
  readonly description: string | null
  readonly tables: readonly ProjectedTable[]
}

/** One line of `GET /meta/bases`. */
export interface VisibleBase {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  /** Readable tables only: the count must not betray those that are masked. */
  readonly tableCount: number
}

interface BaseRow extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly schema_name: string
}

interface TableRow extends Record<string, unknown> {
  readonly id: string
  readonly base_id: string
  readonly label: string
  readonly description: string | null
  readonly table_name: string
  readonly schema_name: string
  readonly display_field_id: string | null
}

interface FieldRow extends Record<string, unknown> {
  readonly id: string
  readonly table_id: string
  readonly label: string
  readonly description: string | null
  readonly kind: string
  readonly is_required: boolean
  readonly column: string
  readonly is_rich: boolean
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

interface LinkRow extends Record<string, unknown> {
  readonly field_id: string
  readonly target_table_id: string
  readonly on_delete: 'restrict' | 'set_null' | 'cascade'
}

interface RawCatalog {
  readonly bases: readonly BaseRow[]
  readonly tables: readonly TableRow[]
  readonly fields: readonly FieldRow[]
  readonly links: readonly LinkRow[]
  readonly options: ReadonlyMap<string, ReadonlyArray<ProjectedOption>>
  readonly applications: ReadonlyMap<string, readonly string[]>
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

  const bases = await exec.query<BaseRow>(
    `SELECT b.id, b.label, b.description, sn.name AS schema_name
       FROM _basedb.base b
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                    AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.ref = $1 AND b.is_live AND b.deleted_at IS NULL
      ORDER BY b.label`,
    tenant,
  )

  const tables = await exec.query<TableRow>(
    `SELECT t.id, t.base_id, t.label, t.description, tn.name AS table_name,
            sn.name AS schema_name, t.display_field_id
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
            coalesce(tc.is_rich, false) AS is_rich
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
       LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
       JOIN _basedb.table_def t     ON t.id = f.table_id
       JOIN _basedb.base b          ON b.id = t.base_id
       JOIN _basedb.tenant te       ON te.id = b.tenant_id
      WHERE te.ref = $1 AND f.is_live AND f.deleted_at IS NULL AND t.is_live
      ORDER BY f.position, f.label`,
    tenant,
  )

  const links = await exec.query<LinkRow>(
    `SELECT lc.field_id, lc.target_table_id, lc.on_delete
       FROM _basedb.field_link_config lc
       JOIN _basedb.field f     ON f.id = lc.field_id
       JOIN _basedb.table_def t ON t.id = f.table_id
       JOIN _basedb.base b      ON b.id = t.base_id
       JOIN _basedb.tenant te   ON te.id = b.tenant_id
      WHERE te.ref = $1 AND lc.fk_dropped_at IS NULL AND f.is_live AND t.is_live`,
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

  return { bases, tables, fields, links, options, applications }
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

/** The four verbs a data route can require. `manage_*` describes no path. */
const DATA_ACTIONS: readonly Action[] = ['read', 'create', 'update', 'delete']

/**
 * Builds the projection in memory, from the raw catalog and the actor's grants.
 *
 * Takes no executor on purpose: the projection renders NO decision against the database,
 * exactly as the decider does not read it. That is what makes it testable without a
 * database, and what bounds its cost.
 */
export function project(
  ctx: RequestContext,
  grants: ActorGrants,
  raw: RawCatalog,
): ProjectedBase[] {
  const fieldsByTable = new Map<string, FieldRow[]>()
  for (const field of raw.fields) {
    const list = fieldsByTable.get(field.table_id) ?? []
    list.push(field)
    fieldsByTable.set(field.table_id, list)
  }

  const linkByField = new Map(raw.links.map((l) => [l.field_id, l]))
  const tableById = new Map(raw.tables.map((t) => [t.id, t]))
  const fieldById = new Map(raw.fields.map((f) => [f.id, f]))

  const targetOf = (table: TableRow): Target => ({
    kind: 'table',
    id: table.id,
    tenantId: ctx.tenantId,
    baseId: table.base_id,
    applicationIds: raw.applications.get(table.id) ?? [],
    fieldIds: (fieldsByTable.get(table.id) ?? []).map((f) => f.id),
  })

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
      const writable = decide(ctx, grants, 'update', target).writableFields
      const actions = DATA_ACTIONS.filter(
        (action) => decide(ctx, grants, action, target).verdict === 'ALLOWED',
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
              expandable: true,
              masked: false,
            }
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
          ...(raw.options.has(field.id) ? { options: raw.options.get(field.id) } : {}),
          ...(projectedLink === undefined ? {} : { link: projectedLink }),
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
      })
    }

    // A base appears if and only if the caller holds `read` on at least one of its
    // tables (§9.1). A base with none is therefore absent, not empty.
    if (tables.length > 0) {
      projected.push({
        id: base.id,
        name: base.schema_name,
        label: base.label,
        description: base.description,
        tables,
      })
    }
  }

  return projected
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
      // someone else's partition.
      const grantsKey = `${ctx.tenantId}|${ctx.actor.id}`
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
