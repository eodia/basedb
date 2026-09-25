import { qualify, quoteIdentifier } from '@basedb/naming'
import { INVERSE_BUDGETS } from '../records/inverse-links.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import {
  type AgentBase,
  type AgentField,
  type AgentTable,
  type AgentView,
  SYSTEM_COLUMN_DESCRIPTIONS,
  agentView,
  displayField,
  linkTarget,
  resolveAgentBase,
  resolveAgentTable,
} from './view.js'

/**
 * The schema as an agent reads it — `describe_base` and `describe_table`, chapter 09 §4.
 *
 * Objective: after these two calls an agent knows the graph of relations, knows which
 * value to show instead of an identifier, knows which rows reference the one it reads,
 * and knows how to join two tables in SQL — none of it obtained by trial.
 *
 * Every block is a projection of the catalog, key by key; nothing here is computed from
 * the data. A description is USER DATA: it travels in the result, under
 * `provenance: "user_data"`, and never in a sentence composed here.
 */

/** A notice: a closed code, a fixed sentence, and the visible object it concerns. */
export interface AgentNotice {
  readonly kind: string
  readonly message: string
  readonly field?: string
}

/**
 * What `on_delete` means, in three fixed sentences — composed here, never written by a
 * user, and naming no object: a template whose holes a label fills is not a closed
 * vocabulary (§12.1).
 */
export const ON_DELETE_MEANING: Readonly<Record<string, string>> = {
  restrict:
    "La suppression d'une ligne cible encore référencée par ce champ est refusée (clause ON DELETE NO ACTION).",
  set_null: "La suppression d'une ligne cible vide ce champ dans les lignes qui la référençaient.",
  cascade:
    "La suppression d'une ligne cible supprime en chaîne, par PostgreSQL, les lignes qui la référencent. La surface MCP n'émet jamais de DELETE : un agent ne peut déclencher aucune cascade.",
}

const HIDDEN_TARGET = 'Ce champ pointe vers une table que vous n’êtes pas autorisé à consulter.'

/** `mcp_expose_physical_names` (§4.4): `false` withholds schema, qualified names, SQL. */
async function physicalNamesExposed(pools: Pools, ctx: RequestContext): Promise<boolean> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{ value: unknown }>(
      `SELECT s.value
         FROM _basedb.setting s
         LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
        WHERE s.key = 'mcp_expose_physical_names'
          AND (s.scope_kind = 'instance' OR t.ref = $1)
        ORDER BY (s.scope_kind = 'tenant') DESC
        LIMIT 1`,
      [ctx.tenantId],
    ),
  )
  const value = rows[0]?.value
  return value !== false && value !== 'false'
}

/**
 * Row count estimates, from `pg_class.reltuples` — never a `COUNT(*)`.
 *
 * `-1` means "never analyzed", which is not "empty" (A1): it is rendered `null`.
 */
async function estimates(
  pools: Pools,
  tables: readonly AgentTable[],
): Promise<Map<string, number | null>> {
  const bySchema = new Map<string, string[]>()
  for (const t of tables) {
    const list = bySchema.get(t.row.schema_name) ?? []
    list.push(t.row.table_name)
    bySchema.set(t.row.schema_name, list)
  }
  const out = new Map<string, number | null>()
  for (const [schema, names] of bySchema) {
    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ name: string; n: string }>(
        `SELECT c.relname AS name, c.reltuples::bigint AS n
           FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
          WHERE ns.nspname = $1 AND c.relname = ANY($2::text[]) AND c.relkind IN ('r', 'p')`,
        [schema, names],
      ),
    )
    for (const row of rows) {
      const n = Number(row.n)
      out.set(`${schema}.${row.name}`, n < 0 ? null : n)
    }
  }
  return out
}

const estimateOf = (map: Map<string, number | null>, table: AgentTable) =>
  map.get(`${table.row.schema_name}.${table.row.table_name}`) ?? null

function displayBlock(table: AgentTable) {
  const field = displayField(table)
  return field === null ? undefined : { name: field.name, label: field.label, kind: field.kind }
}

const businessCount = (table: AgentTable) => table.fields.filter((f) => !f.system).length

/** One line of `list_bases`. */
function baseSummary(base: AgentBase, exposed: boolean) {
  return {
    id: base.row.id,
    name: base.name,
    label: base.row.label,
    description: base.row.description,
    ...(exposed ? { schema: base.row.schema_name } : {}),
    table_count: base.tables.length,
  }
}

export async function agentListBases(pools: Pools, ctx: RequestContext) {
  const view = await agentView(pools, ctx)
  const exposed = await physicalNamesExposed(pools, ctx)
  return {
    bases: view.bases.map((b) => baseSummary(b, exposed)),
    has_more: false,
    provenance: 'user_data' as const,
  }
}

/** `describe_base` — §4.1. */
export async function agentDescribeBase(pools: Pools, ctx: RequestContext, baseRef: string) {
  const view = await agentView(pools, ctx)
  const base = resolveAgentBase(view, baseRef)
  const exposed = await physicalNamesExposed(pools, ctx)
  const counts = await estimates(pools, base.tables)

  // The graph is computed AFTER projection: an edge appears only when both of its
  // tables are readable, and a link field withheld from agents draws no edge either.
  const relations = []
  for (const table of base.tables) {
    for (const field of table.fields) {
      const target = linkTarget(view, field)
      if (field.link === null || target === null) continue
      relations.push({
        from_table: table.row.table_name,
        from_field: field.name,
        to_table: target.row.table_name,
        to_column: '_id',
        cardinality: 'many_to_one',
        on_delete: field.link.on_delete,
        required: field.row?.is_required ?? false,
      })
    }
  }

  // An application whose tables are all invisible disappears, with no marker and no
  // counter; the others list their visible tables only.
  const visible = new Map(base.tables.map((t) => [t.row.id, t.row.table_name]))
  const applications = view.raw.applicationRows
    .filter((a) => a.base_id === base.row.id)
    .map((a) => ({
      name: a.name,
      label: a.label,
      tables: [...view.raw.applications]
        .filter(([tableId, apps]) => apps.includes(a.id) && visible.has(tableId))
        .map(([tableId]) => visible.get(tableId) as string),
    }))
    .filter((a) => a.tables.length > 0)

  return {
    base: {
      id: base.row.id,
      name: base.name,
      label: base.row.label,
      description: base.row.description,
      ...(exposed ? { schema: base.row.schema_name } : {}),
      catalog_version: Number(base.row.catalog_version),
    },
    tables: base.tables.map((t) => ({
      id: t.row.id,
      name: t.row.table_name,
      label: t.row.label,
      description: t.row.description,
      ...(displayBlock(t) === undefined ? {} : { display_field: displayBlock(t) }),
      field_count: businessCount(t),
      row_count_estimate: estimateOf(counts, t),
    })),
    relations,
    applications,
    provenance: 'user_data' as const,
    notices: [] as AgentNotice[],
  }
}

/** The description of one field, per the projection table of §4.3. */
function describeField(
  view: AgentView,
  table: AgentTable,
  field: AgentField,
  exposed: boolean,
  notices: AgentNotice[],
) {
  if (field.system) {
    return {
      name: field.name,
      label: field.label,
      kind: 'system',
      description: SYSTEM_COLUMN_DESCRIPTIONS[field.name] ?? null,
      access: 'read' as const,
    }
  }

  const row = field.row
  const out: Record<string, unknown> = {
    name: field.name,
    label: field.label,
    kind: field.kind,
    description: row?.description ?? null,
    access: field.writable ? 'write' : 'read',
    required: row?.is_required ?? false,
  }
  if (field.id !== null && view.raw.unique.has(field.id)) out.unique = true
  if (row?.max_length !== null && row?.max_length !== undefined) out.max_length = row.max_length
  if (row?.is_rich === true) out.rich_text = true

  const options = field.id === null ? undefined : view.raw.options.get(field.id)
  if (options !== undefined) out.options = options.map((o) => ({ value: o.value, label: o.label }))

  if (field.kind === 'formula' && row !== null) {
    // The expression names the fields it reads. If one of them is withheld from this
    // bearer, the expression is withheld too — it would name what the mask hides.
    const sources = field.id === null ? [] : (view.raw.formulaSources.get(field.id) ?? [])
    const readable = sources
      .map((id) => table.fields.find((f) => f.id === id))
      .filter((f): f is AgentField => f !== undefined)
    out.formula = {
      readable_expression: readable.length === sources.length ? row.formula_expression : null,
      source_fields: readable.map((f) => f.name),
      result_kind: row.formula_result_kind,
      is_stored: row.formula_is_stored ?? true,
    }
  }

  if (field.link !== null) {
    const target = linkTarget(view, field)
    if (target === null) {
      // An opaque column: no name, no label, no constraint, no SQL — each of them names
      // the target (§4.3). The column's own name still does, by convention (A7).
      out.link = null
      out.expandable = false
      notices.push({ kind: 'link_target_hidden', field: field.name, message: HIDDEN_TARGET })
    } else {
      const targetDisplay = displayBlock(target)
      const qualified = qualify(target.row.schema_name, target.row.table_name)
      out.link = {
        target_table: {
          name: target.row.table_name,
          id: target.row.id,
          label: target.row.label,
          ...(exposed ? { qualified } : {}),
          ...(targetDisplay === undefined ? {} : { display_field: targetDisplay }),
        },
        fk_column: field.name,
        ...(exposed
          ? {
              fk_constraint: field.link.fk_constraint,
              fk_index: field.link.fk_index,
              references: `${qualified}.${quoteIdentifier('_id')}`,
            }
          : {}),
        cardinality: 'many_to_one',
        on_delete: field.link.on_delete,
        on_delete_meaning: ON_DELETE_MEANING[field.link.on_delete],
        // Expanding shows the target's display value: without a readable display field
        // it would reduce to `_id`, which the row already carries.
        expandable: targetDisplay !== undefined,
        ...(exposed
          ? {
              join_sql: `LEFT JOIN ${qualified} AS "c" ON "c"."_id" = "t".${quoteIdentifier(field.name)}`,
            }
          : {}),
      }
    }
  }

  return out
}

/** `describe_table` — §4.2. Never truncated: it is the map, and must be complete. */
export async function agentDescribeTable(
  pools: Pools,
  ctx: RequestContext,
  baseRef: string,
  tableRef: string,
) {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, baseRef, tableRef)
  return describeResolvedTable(pools, ctx, view, table)
}

export async function describeResolvedTable(
  pools: Pools,
  ctx: RequestContext,
  view: AgentView,
  table: AgentTable,
) {
  const exposed = await physicalNamesExposed(pools, ctx)
  const counts = await estimates(pools, [table])
  const notices: AgentNotice[] = []

  const fields = table.fields.map((f) => describeField(view, table, f, exposed, notices))

  // Inverse links, wholly deduced from `field_link_config`: a group appears when the
  // bearer reads the SOURCE table AND the source field (§4.3).
  const inverse = []
  for (const link of view.raw.links) {
    if (link.target_table_id !== table.row.id) continue
    const sourceTableId = view.raw.fields.find((f) => f.id === link.field_id)?.table_id
    const source = sourceTableId === undefined ? undefined : view.tableById.get(sourceTableId)
    const sourceField = source?.fields.find((f) => f.id === link.field_id)
    if (source === undefined || sourceField === undefined) continue
    inverse.push({
      source_table: { name: source.row.table_name, id: source.row.id, label: source.row.label },
      source_field: { name: sourceField.name, label: sourceField.label },
      on_delete: link.on_delete,
      how_to_list: {
        tool: 'list_records',
        base: table.base.name,
        table: source.row.table_name,
        filter: { [sourceField.name]: { op: 'eq', value: '<_id de la ligne>' } },
      },
    })
  }
  // Chapter 04 §6 bounds what is restituted; the surface adds no reduction of its own.
  if (inverse.length > INVERSE_BUDGETS.blocks) {
    notices.push({
      kind: 'inverse_links_truncated',
      message: `Seuls les ${INVERSE_BUDGETS.blocks} premiers liens inverses sont décrits.`,
    })
  }

  const access = {
    read: true,
    create: table.decisions.create.verdict === 'ALLOWED',
    update: table.decisions.update.verdict === 'ALLOWED',
    delete: table.decisions.delete.verdict === 'ALLOWED',
    manage_schema: table.decisions.manage_schema.verdict === 'ALLOWED',
  }
  const display = displayBlock(table)

  return {
    table: {
      id: table.row.id,
      name: table.row.table_name,
      label: table.row.label,
      ...(exposed ? { qualified: qualify(table.row.schema_name, table.row.table_name) } : {}),
      description: table.row.description,
      ...(display === undefined ? {} : { display_field: display }),
      access,
      row_count_estimate: estimateOf(counts, table),
    },
    base: { id: table.base.row.id, name: table.base.name },
    fields,
    inverse_links: inverse.slice(0, INVERSE_BUDGETS.blocks),
    provenance: 'user_data' as const,
    notices,
  }
}

/** `whoami` — identity, scope of the token, and the budgets it runs under. */
export async function agentWhoAmI(
  pools: Pools,
  ctx: RequestContext,
  budgets: Readonly<Record<string, number>>,
) {
  const view = await agentView(pools, ctx)
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{
      token_id: string | null
      label: string | null
      prefix: string | null
      expires_at: Date | null
      base_id: string | null
      display_name: string
    }>(
      `SELECT tk.id AS token_id, tk.label, tk.token_prefix AS prefix, tk.expires_at,
              tk.base_id, u.display_name
         FROM _basedb.app_user u
         LEFT JOIN _basedb.api_token tk ON tk.id = $2::uuid AND tk.created_by = u.id
        WHERE u.id = $1`,
      [ctx.actor.id, ctx.actor.tokenId ?? null],
    ),
  )
  const me = rows[0]
  // The scope base is named only if the bearer can see it: a token with no right on its
  // own base answers normally, with an empty scope (§10, point 5).
  const scopeBase = view.bases.find((b) => b.row.id === me?.base_id) ?? null
  const tables = view.bases.flatMap((b) => b.tables)

  return {
    actor: {
      kind: ctx.actor.kind,
      ...(me?.token_id
        ? {
            token: {
              id: me.token_id,
              label: me.label,
              prefix: me.prefix,
              expires_at: me.expires_at === null ? null : new Date(me.expires_at).toISOString(),
            },
          }
        : {}),
      user: { id: ctx.actor.id, display_name: me?.display_name ?? null },
    },
    tenant: ctx.tenantId,
    scope: {
      base:
        scopeBase === null
          ? null
          : { id: scopeBase.row.id, name: scopeBase.name, label: scopeBase.row.label },
    },
    access: {
      read: tables.length > 0,
      create: tables.some((t) => t.decisions.create.verdict === 'ALLOWED'),
      update: tables.some((t) => t.decisions.update.verdict === 'ALLOWED'),
    },
    budgets,
    provenance: 'user_data' as const,
  }
}
