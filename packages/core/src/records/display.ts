import { qualify, quoteIdentifier } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadFields, loadGrants, loadTarget } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import { EXPAND_BUDGETS, type ExpandRequest } from './expand.js'

/**
 * Resolving the display value of links — chapter 08 §5.4.
 *
 * ONE extra query per distinct target table, never a join, and never a query per row.
 * The number of queries is `1 + T`, where `T` is the number of distinct READABLE target
 * tables: a property of the schema, independent of the number of rows on the page.
 *
 * The single `LEFT JOIN` was rejected: it returns the target row as many times as it is
 * referenced, complicates computing the cursor key, and prevents applying a projection
 * to the target distinct from the source's.
 */

/** What the API returns for a link cell. */
export interface LinkValue {
  readonly id: string | null
  readonly display: string | null
  /** Present, and true, only when the target table is unreadable (A16). */
  readonly masked?: true
}

/**
 * Unique shape for a link whose target is unreadable (A16).
 *
 * The identifier itself is removed, and this is not excess caution: a UUIDv7 carries a
 * timestamp, which would reveal the creation date of a row forbidden to the reader. An
 * opaque identifier computed by HMAC was rejected — it would remain a stable correlator
 * between two reads.
 */
const MASKED: LinkValue = Object.freeze({ id: null, display: null, masked: true })

/** A link field of the table being read, as the catalog describes it. */
interface LinkField extends Record<string, unknown> {
  readonly column: string
  readonly targetTableId: string
}

/** A target table, resolved once even if several fields designate it. */
interface Target {
  readonly tableId: string
  /** Physical table name: `included` is indexed by it (§5.2). */
  readonly tableName: string
  readonly relation: string
  /** Physical name of the display column, or `null` if the table designates none. */
  readonly displayColumn: string | null
  /** The target's readable columns, which bound what an expansion may project. */
  readonly readableColumns: readonly string[]
  readonly readable: boolean
  readonly rowPredicate: string
}

/**
 * Reads a table's link fields from the catalog, with their target.
 *
 * Only links whose foreign key is in place are kept: a link whose constraint has been
 * dropped no longer designates anything guaranteed.
 */
export async function loadLinkFields(exec: Executor, tableId: string): Promise<LinkField[]> {
  return exec.query<LinkField>(
    `SELECT n.name AS column, lc.target_table_id AS "targetTableId"
       FROM _basedb.field f
       JOIN _basedb.field_link_config lc ON lc.field_id = f.id
       JOIN _basedb.physical_name n      ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND lc.fk_dropped_at IS NULL
      ORDER BY f.position`,
    [tableId],
  )
}

/**
 * Resolves the distinct targets, applying RBAC table by table.
 *
 * A target on which the actor lacks `read` is flagged unreadable and NO query is issued
 * for it: masking is not a post-hoc filter, otherwise the identifiers would travel
 * anyway.
 */
async function resolveTargets(
  exec: Executor,
  ctx: RequestContext,
  fields: readonly LinkField[],
): Promise<Map<string, Target>> {
  const targets = new Map<string, Target>()
  const grants = await loadGrants(exec, ctx)

  for (const field of fields) {
    if (targets.has(field.targetTableId)) continue

    const rbacTarget = await loadTarget(exec, ctx, field.targetTableId)
    const decision = rbacTarget === null ? null : decide(ctx, grants, 'read', rbacTarget)
    const readable = decision !== null && decision.verdict === 'ALLOWED'

    const rows = await exec.query<{
      schema_name: string
      table_name: string
      display_name: string | null
      display_field_id: string | null
    }>(
      `SELECT sn.name AS schema_name, tn.name AS table_name,
              dn.name AS display_name, t.display_field_id
         FROM _basedb.table_def t
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
         LEFT JOIN _basedb.field df    ON df.id = t.display_field_id
         LEFT JOIN _basedb.physical_name dn ON dn.id = df.name_id
        WHERE t.id = $1`,
      [field.targetTableId],
    )

    const t = rows[0]
    if (t === undefined) continue

    // A display field masked for the reader yields `display: null`, with no error and
    // NO substitution: a substitute chosen at random would be a leak channel.
    const displayReadable =
      t.display_field_id !== null &&
      decision !== null &&
      decision.readableFields.has(t.display_field_id)

    // The target's fields are filtered by ITS OWN mask: a field masked on `clients`
    // does not become projectable because it is reached from `factures`.
    const targetFields = readable ? await loadFields(exec, field.targetTableId) : new Map()
    const readableColumns: string[] = []
    for (const [id, column] of targetFields) {
      if (decision?.readableFields.has(id)) readableColumns.push(column.name)
    }

    targets.set(field.targetTableId, {
      tableId: field.targetTableId,
      tableName: t.table_name,
      relation: qualify(t.schema_name, t.table_name),
      displayColumn: displayReadable ? t.display_name : null,
      readableColumns,
      readable,
      rowPredicate: decision?.rowPredicate ?? 'TRUE',
    })
  }

  return targets
}

export interface ResolvedDisplays {
  readonly rows: ReadonlyArray<Record<string, unknown>>
  /** The batch queries issued, so the caller can show them. */
  readonly sql: readonly string[]
  /**
   * Expanded rows, indexed by table NAME then by identifier (§5.2).
   *
   * The linked object is NOT nested inside the row. Three reasons: deduplication — 100
   * invoices pointing at 3 clients carry 3 objects, not 100; schema stability — the
   * shape of `clients_id` stays `{id, display}` whether `expand` is present or not, so
   * one OpenAPI schema per table; and separation of permissions — the target's field
   * projection obeys the rights on THAT table, and keeping it outside the source row
   * avoids one JSON object mixing two sets of rights.
   */
  readonly included: Readonly<Record<string, Readonly<Record<string, Record<string, unknown>>>>>
}

/**
 * Replaces, in a page's rows, link identifiers by their `{ id, display }` shape.
 *
 * `links=id` short-circuits this resolution entirely: not a convenience, but what
 * prevents a table with eight links from issuing nine queries per page for a caller —
 * a sync job, an integration — that only wants identifiers.
 */
export async function resolveDisplays(
  pools: Pools,
  ctx: RequestContext,
  exec: Executor,
  tableId: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  expand: ExpandRequest = new Map(),
  /** The columns the reader may see — the projection the caller already computed. */
  readableColumns: ReadonlySet<string> = new Set(),
): Promise<ResolvedDisplays> {
  const fields = await loadLinkFields(exec, tableId)
  // The early exit is conditioned on the ABSENCE of an expansion: an `expand` naming an
  // impossible column must be refused whether the page is empty or the table carries no
  // link. Otherwise the answer would depend on the data, and an empty page would silently
  // accept a request a full page refuses.
  if (expand.size === 0 && (fields.length === 0 || rows.length === 0)) {
    return { rows, sql: [], included: {} }
  }

  const targets = await resolveTargets(exec, ctx, fields)

  // The bound counts the target tables RESOLVED IN TOTAL, expanded or not: it is the
  // number of round trips that hurts, not the projection width (§5.1).
  const reachable = new Set(
    fields
      .filter((f) => targets.get(f.targetTableId)?.readable === true)
      .map((f) => f.targetTableId),
  )
  if (reachable.size > EXPAND_BUDGETS.targets) {
    throw new BasedbError('EXPAND_TOO_WIDE', {
      details: { bound: 'target tables', maximum: EXPAND_BUDGETS.targets, links: 'id' },
    })
  }

  // Two distinct refusals, and the boundary between them is what does not leak (05 §5.4).
  for (const column of expand.keys()) {
    // A column the reader cannot see AT ALL — absent, or masked — is an unknown field,
    // the same answer as for a typo. Answering "not expandable" here would confirm that
    // the column exists.
    if (!readableColumns.has(column)) {
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: column } })
    }

    const field = fields.find((f) => f.column === column)
    // ONE code for two situations, deliberately: "this field is not a link" and "this
    // link points at a table you cannot see" are indistinguishable from the outside, so
    // expansion cannot be turned into an oracle enumerating which tables exist. And the
    // expansion is NOT degraded silently: returning the masked shape would make the
    // caller believe they obtained the data.
    if (field === undefined || targets.get(field.targetTableId)?.readable !== true) {
      throw new BasedbError('EXPAND_UNAVAILABLE', { details: { field: column } })
    }
  }

  if (fields.length === 0 || rows.length === 0) return { rows, sql: [], included: {} }

  // Step 2: collect the page's non-null identifiers, GROUPED BY TARGET TABLE. Two
  // fields pointing at `clients` share a single set, hence a single query.
  const byTarget = new Map<string, Set<string>>()
  for (const field of fields) {
    const target = targets.get(field.targetTableId)
    if (target === undefined || !target.readable) continue

    for (const row of rows) {
      const value = row[field.column]
      if (typeof value !== 'string') continue
      const set = byTarget.get(field.targetTableId) ?? new Set<string>()
      set.add(value)
      byTarget.set(field.targetTableId, set)
    }
  }

  // Step 4: one query per target, on `_id = ANY(...)`, carrying the row predicate OF
  // THE TARGET. Without it, a reader allowed on `factures` but not on the rows of
  // `clients` would still read their display value.
  const displays = new Map<string, Map<string, string | null>>()
  const included: Record<string, Record<string, Record<string, unknown>>> = {}
  const sql: string[] = []

  // Which target tables are expanded, and with which projection. Several link fields
  // may point at the same table: their projections are merged, since a single batch
  // query serves them both.
  const expandedColumns = new Map<string, Set<string> | null>()
  for (const [column, projection] of expand) {
    const field = fields.find((f) => f.column === column)
    if (field === undefined) continue
    const current = expandedColumns.get(field.targetTableId)
    if (projection === null || current === null) {
      expandedColumns.set(field.targetTableId, null)
      continue
    }
    expandedColumns.set(field.targetTableId, new Set([...(current ?? []), ...projection]))
  }

  for (const [targetTableId, ids] of byTarget) {
    const target = targets.get(targetTableId)
    if (target === undefined) continue

    if (ids.size > EXPAND_BUDGETS.idsPerTarget) {
      throw new BasedbError('EXPAND_TOO_WIDE', {
        details: {
          bound: 'distinct identifiers per target',
          maximum: EXPAND_BUDGETS.idsPerTarget,
          links: 'id',
        },
      })
    }

    const isExpanded = expandedColumns.has(targetTableId)
    const projected = new Set<string>()

    if (isExpanded) {
      const asked = expandedColumns.get(targetTableId)
      // Default: every readable field of the target row, exactly like a direct read.
      // With a projection: the named fields — `_id` and the display column are always
      // added implicitly (§5.3).
      for (const column of target.readableColumns) {
        if (asked === null || asked === undefined || asked.has(column)) projected.add(column)
      }
      // A projection naming an unreadable or non-existent column is simply not
      // projected: refusing would tell the caller which columns the target holds.
      if (target.displayColumn !== null) projected.add(target.displayColumn)
    }

    const parts = ['"_id"']
    if (target.displayColumn !== null) {
      parts.push(`${quoteIdentifier(target.displayColumn)} AS "_display"`)
    }
    for (const column of projected) {
      if (column === target.displayColumn) continue
      parts.push(quoteIdentifier(column))
    }

    const query = `SELECT ${parts.join(', ')}
  FROM ${target.relation}
 WHERE "_id" = ANY($1::uuid[])
   AND ( /*predicat_lignes:${targetTableId}*/ ${target.rowPredicate} );`

    sql.push(query)

    const found = await pools.withConnection('data', (e) =>
      e.query<Record<string, unknown>>(query, [[...ids]]),
    )

    displays.set(
      targetTableId,
      new Map(found.map((r) => [String(r._id), (r._display as string | null) ?? null])),
    )

    if (isExpanded) {
      const byId: Record<string, Record<string, unknown>> = {}
      for (const row of found) {
        // `_display` is an internal alias of the query, not a field of the table: it is
        // dropped, the display column being projected under its own name.
        const { _display, ...rest } = row
        void _display
        if (target.displayColumn !== null && projected.has(target.displayColumn)) {
          rest[target.displayColumn] = row[target.displayColumn] ?? row._display ?? null
        }
        byId[String(row._id)] = rest
      }
      included[target.tableName] = byId
    }
  }

  // Step 5: rebuild the values.
  const rendered = rows.map((row) => {
    const copy: Record<string, unknown> = { ...row }

    for (const field of fields) {
      if (!Object.hasOwn(row, field.column)) continue
      const target = targets.get(field.targetTableId)
      const value = row[field.column]

      if (target === undefined || !target.readable) {
        // Even when the value is null: distinguishing "null" from "unreadable" would
        // tell the reader whether the source row points at a forbidden target.
        copy[field.column] = MASKED
        continue
      }

      if (typeof value !== 'string') {
        copy[field.column] = { id: null, display: null }
        continue
      }

      // A target the batch query did not return is invisible to this actor: its
      // identifier is withheld exactly as for an unreadable table.
      const table = displays.get(field.targetTableId)
      if (table === undefined || !table.has(value)) {
        copy[field.column] = MASKED
        continue
      }

      // Empty or null value on the target row: `display: null`, never an error and
      // never a fallback to another field.
      const display = table.get(value) ?? null
      copy[field.column] = { id: value, display: display === '' ? null : display }
    }

    return copy
  })

  return { rows: rendered, sql, included }
}
