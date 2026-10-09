import { SYSTEM_COLUMN_DESCRIPTIONS } from '../catalog/description.js'
import {
  type BaseRow,
  type FieldRow,
  type LinkRow,
  type RawCatalog,
  type TableRow,
  baseInEnvironment,
  fieldsByTableOf,
  snapshot,
  targetFactory,
} from '../catalog/projection.js'
import { isFileKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import {
  type Action,
  type ActorGrants,
  type Decision,
  SYSTEM_COLUMNS,
  decide,
} from '../rbac/decide.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * What an agent sees of the catalog — chapter 09 §3 and §4.
 *
 * Built from the SAME snapshot and the SAME decider as every other projection: the agent
 * surface adds no rule of its own to the permissions. What differs is carried by the
 * context — `surface = 'mcp'` makes the decider withhold the fields and bases closed to
 * agents (§12.2) — and by the shape of the answer, which is this chapter's.
 *
 * Every resolution follows the order of §3.2 — tenant, token scope, `mcp_enabled`, live
 * state, `read` — and every failure at any step is the SAME `RESOURCE_NOT_FOUND`: the
 * decider has already folded the five steps into one verdict.
 */

/** The fixed labels of the five system columns — a closed vocabulary, not user data. */
export const SYSTEM_LABELS: Readonly<Record<string, string>> = {
  _id: 'Identifiant',
  _created_at: 'Créé le',
  _updated_at: 'Modifié le',
  _created_by: 'Créé par',
  _updated_by: 'Modifié par',
}

/** A field as the agent may name it. */
export interface AgentField {
  readonly id: string | null
  readonly name: string
  readonly label: string
  readonly kind: string
  readonly system: boolean
  readonly row: FieldRow | null
  /** Writable on THIS surface: a formula, rich text or system column never is (§6.2). */
  readonly writable: boolean
  /** Writable by the rights, whatever this surface refuses — tells the two refusals apart. */
  readonly grantedWrite: boolean
  readonly link: LinkRow | null
}

export interface AgentTable {
  readonly row: TableRow
  readonly base: AgentBase
  /** System columns first, then the readable business fields, in catalog order. */
  readonly fields: readonly AgentField[]
  readonly decisions: Readonly<
    Record<'read' | 'create' | 'update' | 'delete' | 'manage_schema', Decision>
  >
}

export interface AgentBase {
  readonly row: BaseRow
  /** The logical name an agent reads in a conversation: `crm` for `b_t4z56fq_crm`. */
  readonly name: string
  readonly tables: AgentTable[]
}

export interface AgentView {
  readonly ctx: RequestContext
  readonly grants: ActorGrants
  readonly raw: RawCatalog
  /** Visible bases only: at least one readable table, open to agents. */
  readonly bases: readonly AgentBase[]
  readonly tableById: ReadonlyMap<string, AgentTable>
}

/** `b_<tenant>_crm` → `crm`: the part of the schema name a person chose. */
export function logicalName(schemaName: string, tenantRef: string): string {
  const prefix = `b_${tenantRef}_`
  return schemaName.startsWith(prefix) ? schemaName.slice(prefix.length) : schemaName
}

/** The agent surface's operations serve that surface, and it alone. */
export function requireAgentSurface(ctx: RequestContext): void {
  if (ctx.surface !== 'mcp') {
    throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'agent operation off surface' } })
  }
}

const ACTIONS: readonly ('read' | 'create' | 'update' | 'delete' | 'manage_schema')[] = [
  'read',
  'create',
  'update',
  'delete',
  'manage_schema',
]

/** Builds the agent's view of the tenant, from the cached snapshot. */
export async function agentView(pools: Pools, ctx: RequestContext): Promise<AgentView> {
  requireAgentSurface(ctx)
  const { grants, raw } = await snapshot(pools, ctx)
  return buildView(ctx, grants, raw)
}

export function buildView(ctx: RequestContext, grants: ActorGrants, raw: RawCatalog): AgentView {
  const fieldsByTable = fieldsByTableOf(raw)
  const targetOf = targetFactory(ctx, raw, fieldsByTable)
  const linkByField = new Map(raw.links.map((l) => [l.field_id, l]))

  const bases: AgentBase[] = []
  const tableById = new Map<string, AgentTable>()

  for (const baseRow of raw.bases) {
    const base: AgentBase = {
      row: baseRow,
      name: logicalName(baseRow.schema_name, ctx.tenantId),
      tables: [],
    }

    for (const tableRow of raw.tables.filter((t) => t.base_id === baseRow.id)) {
      const target = targetOf(tableRow)
      const decisions = Object.fromEntries(
        ACTIONS.map((action) => [action, decide(ctx, grants, action as Action, target)]),
      ) as unknown as AgentTable['decisions']
      const read = decisions.read
      if (read.verdict !== 'ALLOWED') continue

      const writableByRights = new Set([
        ...(decisions.create.verdict === 'ALLOWED' ? decisions.create.writableFields : []),
        ...(decisions.update.verdict === 'ALLOWED' ? decisions.update.writableFields : []),
      ])

      const fields: AgentField[] = SYSTEM_COLUMNS.map((name) => ({
        id: null,
        name,
        label: SYSTEM_LABELS[name] ?? name,
        kind: 'system',
        system: true,
        row: null,
        writable: false,
        grantedWrite: false,
        link: null,
      }))

      for (const row of fieldsByTable.get(tableRow.id) ?? []) {
        if (!read.readableFields.has(row.id)) continue
        const granted = writableByRights.has(row.id)
        fields.push({
          id: row.id,
          name: row.column,
          label: row.label,
          kind: row.kind,
          system: false,
          row,
          // Rich text is refused in writing on this surface in v1: the agent read it
          // flattened, and writing it back would lose the markup silently (§6.2). Files
          // too: a file is deposited by a person, through the interface or the REST API,
          // and an agent has no bytes to deposit. A field computed by the AI is the
          // kernel's to write: the decider already kept it out of `granted`.
          writable:
            granted &&
            row.kind !== 'formula' &&
            !row.has_ai &&
            !row.is_rich &&
            !isFileKind(row.kind),
          grantedWrite: granted,
          link: linkByField.get(row.id) ?? null,
        })
      }

      const table: AgentTable = { row: tableRow, base, fields, decisions }
      base.tables.push(table)
      tableById.set(tableRow.id, table)
    }

    // A base with no visible table is absent, never empty (§4.1).
    if (base.tables.length > 0) bases.push(base)
  }

  return { ctx, grants, raw, bases, tableById }
}

const notFound = (details: Record<string, unknown> = {}) =>
  new BasedbError('RESOURCE_NOT_FOUND', { details })

/**
 * Resolves a base by logical name, schema name or catalog key (§3.3).
 *
 * The search space is the visible bases, and nothing else: an unknown base, a base
 * outside the token's scope, one closed to agents and one with no readable table all
 * land here, on the same refusal.
 */
export function resolveAgentBase(view: AgentView, reference: string): AgentBase {
  // The environment asked — the MCP address's, or the tool's argument — names the base
  // of the same lineage: `crm` with `recette` is `crm_recette` (chapter 14 §1 bis). The
  // hop is made on the whole catalog, the visibility check on the visible bases after.
  const row = baseInEnvironment(
    view.ctx,
    view.raw.bases,
    (b) =>
      b.id === reference ||
      b.schema_name === reference ||
      logicalName(b.schema_name, view.ctx.tenantId) === reference,
  )
  const base = row === undefined ? undefined : view.bases.find((b) => b.row.id === row.id)
  if (base === undefined) throw notFound()
  return base
}

/** Resolves `base` then `table`, by name or catalog key. */
export function resolveAgentTable(view: AgentView, baseRef: string, tableRef: string): AgentTable {
  const base = resolveAgentBase(view, baseRef)
  const table = base.tables.find((t) => t.row.id === tableRef || t.row.table_name === tableRef)
  if (table === undefined) throw notFound()
  return table
}

/**
 * A field of a readable table, by physical name or catalog key — or `FIELD_UNKNOWN`.
 *
 * ONE path for `select`, `filter`, `sort`, `expand` and `values` (§5.1): a field the
 * bearer cannot read, or withheld from agents, is exactly a field that does not exist.
 */
export function resolveAgentField(table: AgentTable, reference: string, param: string): AgentField {
  const field = table.fields.find((f) => f.name === reference || f.id === reference)
  if (field === undefined) {
    throw new BasedbError('FIELD_UNKNOWN', {
      details: { param, object: { kind: 'table', name: table.row.table_name } },
    })
  }
  return field
}

/** The table a readable link points at, if the bearer can read it. */
export function linkTarget(view: AgentView, field: AgentField): AgentTable | null {
  if (field.link === null) return null
  return view.tableById.get(field.link.target_table_id) ?? null
}

/** The display field of a table, if it is designated AND readable by the bearer. */
export function displayField(table: AgentTable): AgentField | null {
  const id = table.row.display_field_id
  if (id === null) return null
  return table.fields.find((f) => f.id === id) ?? null
}

export { SYSTEM_COLUMN_DESCRIPTIONS }
