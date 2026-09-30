import { qualify, quoteIdentifier } from '@basedb/naming'
import { isFileKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { type Decision, SYSTEM_COLUMNS, decide } from '../rbac/decide.js'
import { loadFields, loadGrants, loadTarget } from '../rbac/loader.js'
import { rowWhere } from '../rbac/rows.js'
import { withMe } from '../rbac/rows.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, actorKey, withTransaction } from '../tx/context.js'
import { COMPUTED_ALIAS, type ComputedColumn, lateralJoin, resolveComputed } from './computed.js'
import {
  decodeCursor,
  encodeCursor,
  fingerprintOf,
  keysetPredicate,
  qualifiedId,
} from './cursor.js'
import { loadLinkFields, resolveDisplays } from './display.js'
import { EXPAND_BUDGETS, parseExpand } from './expand.js'
import {
  CAST,
  type FilterableColumn,
  type FilterableTarget,
  type SortTermPlan,
  buildFilter,
  buildSort,
  resolveColumn,
} from './filter.js'
import {
  type VariableColumn,
  type VariableScope,
  citedNames,
  hasVariables,
  loadScopeExtras,
  resolveText,
} from './variables.js'

/**
 * Reading records — chapter 05 §6.2, chapter 08 §4 and §6.
 *
 * The invariant this module upholds, stated on the DATA side, not the syntax side:
 *
 *   "Every expression of the emitted SQL references only named columns belonging to the
 *    operation's mask."
 *
 * This forbids whole-row constructors by construction. A check looking for the string
 * `SELECT *` would let `to_jsonb(t)`, `row_to_json(t)`, `jsonb_agg(t)` and selecting a
 * composite type through — one of which is the natural shape of the most exposed path,
 * grouped expansion.
 */

export interface ListOptions {
  readonly tableId: string
  /** Page bound. The opaque cursor belongs to chapter 08, not to the kernel. */
  readonly limit?: number
  /**
   * Opaque cursor handed back by the previous page (§6.4).
   *
   * It carries the fingerprint of its query and the sort-key values of the last row, so
   * it resumes correctly under ANY sort and refuses itself as `CURSOR_STALE` the moment
   * the sort, the filter or the projection change.
   */
  readonly after?: string
  /**
   * Total row count — chapter 11 §1.1.
   *
   * Absent by default, and that is the decision, not an omission: counting a large
   * table is a full scan, and paying for it on every page load to fill a "1 240 lignes"
   * label is a bad trade. `exact` makes the caller ask, and the result is capped.
   */
  readonly count?: 'exact'
  /** Filter expression, grammar of §4.1. */
  readonly filter?: string
  /** `field` or `-field`, comma separated (§4.2). */
  readonly sort?: string
  /**
   * Resolution of the display value of links (§5.1).
   *
   * `display` by default, because the interface needs it on every cell. `id` removes
   * the resolution queries ENTIRELY: that is what any sync job should ask for.
   */
  readonly links?: 'display' | 'id'
  /**
   * Link fields to expand (§5.1), with an optional projection:
   * `clients_id(raison_sociale,ville),commerciaux_id`.
   */
  readonly expand?: string
  /**
   * The columns to return, by physical name — every readable one when absent.
   *
   * Resolved against the READ mask like a filter: a column the reader cannot see is an
   * unknown column. `_id` is always returned, since it is what designates the row.
   */
  readonly select?: readonly string[]
  /** Where an exact count stops, below the kernel's own ceiling. */
  readonly countCeiling?: number
  /**
   * The citations of long texts (chapter 04 §2.2, « Variables »): replaced by the row's
   * values by default — what every reader wants —, kept as written with `raw` — what an
   * editor needs, and whoever compares stored values.
   */
  readonly variables?: 'resolve' | 'raw'
}

export interface ListResult {
  readonly rows: ReadonlyArray<Record<string, unknown>>
  /** Columns actually projected, in catalog order. */
  readonly columns: readonly string[]
  /** The emitted SQL, so the non-regression test can inspect it. */
  readonly sql: string
  /** True if at least one row exists beyond this page. */
  readonly hasNextPage: boolean
  /** The cursor that opens the next page, or null when there is none. */
  readonly nextCursor: string | null
  /** Total, only when `count=exact` was asked for. */
  readonly total: number | null
  /** True when the total hit the ceiling: the screen reads "100 000+", never a number. */
  readonly totalCapped: boolean
  /** The batch queries issued to resolve links, if any. */
  readonly linkSql: readonly string[]
  /** Expanded rows, indexed by table name then identifier. Empty without `expand`. */
  readonly included: Readonly<Record<string, Readonly<Record<string, Record<string, unknown>>>>>
  /** The projected `file` and `image` columns, whose entries a reader links to. */
  readonly fileColumns: readonly string[]
}

/** Default page bound (chapter 08). */
export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 500

/**
 * Where an exact count stops — chapter 11 §1.5.
 *
 * Past this, the answer is "100 000+" and `totalCapped` says so. The query itself stops
 * there too: the count runs over a bounded sub-select, so the cost of asking is bounded
 * whatever the table holds. A ceiling that only applied to the DISPLAY would still make
 * someone pay for a full scan of forty million rows.
 */
export const COUNT_CEILING = 100_000

/**
 * Lists a table's records, under the actor's mask.
 *
 * An unknown target and an invisible target produce EXACTLY the same response:
 * `RESOURCE_NOT_FOUND` is raised in both cases, and nothing in the message tells them
 * apart. This is the cadrage's "absence rather than error" rule, and it only holds if
 * both paths are indistinguishable from outside.
 */
export async function listRecords(
  pools: Pools,
  ctx: RequestContext,
  options: ListOptions,
): Promise<ListResult> {
  const expand = parseExpand(options.expand)

  // The page bound drops to 100 as soon as `expand` is present: the cost of a page is
  // no longer its own rows alone but the target rows it drags along (§5.1).
  const ceiling = expand.size > 0 ? EXPAND_BUDGETS.limit : MAX_LIMIT
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, ceiling)

  // The decision and schema resolution run on the `catalog` pool; reading data runs on
  // the `data` pool. The `data` pool NEVER references `_basedb` (§6.3): a defect in a
  // data query cannot reach the permission tables.
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => buildPlan(exec, ctx, options.tableId),
    {
      readOnly: true,
    },
  )

  const selected = { ...plan, columns: selectColumns(plan, options.select) }
  const query = buildSelect(selected, options, limit, {
    actorId: actorKey(ctx),
    tableId: options.tableId,
  })

  // `limit + 1` rows requested, `limit` returned: the extra row decides whether a next
  // page exists without having to count the table.
  const raw = await pools.withConnection('data', (exec) =>
    exec.query<Record<string, unknown>>(query.sql, query.params),
  )

  const fetched = raw.slice(0, limit)
  const hasNextPage = raw.length > limit

  // The cursor is minted from the LAST ROW OF THE PAGE, before link resolution rewrites
  // its link columns into display objects: the key values must be the ones the database
  // compared, not the ones a reader sees.
  const lastRow = fetched[fetched.length - 1]
  const nextCursor =
    hasNextPage && lastRow !== undefined
      ? encodeCursor(
          {
            fingerprint: query.fingerprint,
            keys: query.sortTerms.map((term) => lastRow[term.name] ?? null),
            id: String(lastRow._id),
          },
          { actorId: actorKey(ctx), tableId: options.tableId, fingerprint: query.fingerprint },
        )
      : null

  // A sort column read only to mint the cursor leaves with it: the reader asked for the
  // columns of `select`, and nothing else is returned.
  const page =
    query.sortOnly.length === 0
      ? fetched
      : fetched.map((row) => {
          const copy = { ...row }
          for (const column of query.sortOnly) delete copy[column]
          return copy
        })

  const counted =
    options.count === 'exact'
      ? await pools.withConnection('data', async (exec) => {
          const rows = await exec.query<{ n: string }>(query.countSql, query.countParams)
          const n = Number(rows[0]?.n ?? 0)
          const ceiling = Math.min(options.countCeiling ?? COUNT_CEILING, COUNT_CEILING)
          return { total: Math.min(n, ceiling), capped: n > ceiling }
        })
      : { total: null, capped: false }

  // Link resolution happens AFTER the page, on its rows alone: that is what makes the
  // query count independent of the number of rows read.
  // `links=id` and `expand` are contradictory: expanding requires reading the target
  // rows, which is exactly what `links=id` exists to avoid. The request is refused
  // rather than one of the two silently ignored.
  if ((options.links ?? 'display') === 'id' && expand.size > 0) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { parameter: 'expand', detail: 'incompatible with links=id' },
    })
  }

  const resolved =
    (options.links ?? 'display') === 'id'
      ? { rows: page, sql: [] as readonly string[], included: {} }
      : await withTransaction(
          pools,
          'catalog',
          ctx,
          (exec) =>
            resolveDisplays(pools, ctx, exec, options.tableId, page, expand, new Set(plan.columns)),
          { readOnly: true },
        )

  const rows =
    (options.variables ?? 'resolve') === 'raw'
      ? resolved.rows
      : await resolvePageVariables(
          pools,
          ctx,
          options.tableId,
          plan,
          selected.columns,
          resolved.rows,
        )

  return {
    rows,
    columns: selected.columns,
    sql: query.sql,
    hasNextPage,
    nextCursor,
    total: counted.total,
    totalCapped: counted.capped,
    linkSql: resolved.sql,
    included: resolved.included,
    fileColumns: selected.columns.filter((c) => isFileKind(plan.filterable.get(c)?.kind ?? '')),
  }
}

/**
 * The citations of a page's long texts, replaced — chapter 04 §2.2, « Variables ».
 *
 * Nothing more is read when no long text of the page cites anything, which is the common
 * case. Otherwise: the cited columns the page did not project are read for the rows that
 * cite them, in one query under the same mask; then the labels, names and the reader's
 * reading of dates, in one catalog round trip.
 */
async function resolvePageVariables(
  pools: Pools,
  ctx: RequestContext,
  tableId: string,
  plan: Plan,
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  const texts = columns.filter((c) => plan.filterable.get(c)?.kind === 'long_text')
  if (texts.length === 0) return rows
  const citing = rows.filter((row) => texts.some((c) => hasVariables(row[c])))
  if (citing.length === 0) return rows

  const cited = citedNames(citing.flatMap((row) => texts.map((c) => row[c]).filter(hasVariables)))
  const all = await withTransaction(pools, 'catalog', ctx, (exec) => loadFields(exec, tableId), {
    readOnly: true,
  })
  const byName = new Map([...all.values()].map((f) => [f.name, f]))
  // What the reader reads — `filterable` IS the read mask, computed fields included.
  const readable = new Map<string, VariableColumn>()
  for (const name of cited) {
    const column = plan.filterable.get(name)
    if (column !== undefined) {
      readable.set(name, { name, kind: column.kind, rich: byName.get(name)?.rich === true })
    }
  }

  const missing = [...readable.keys()].filter((name) => !columns.includes(name))
  const extra = new Map<string, Record<string, unknown>>()
  if (missing.length > 0) {
    const ids = citing.map((row) => JSON.stringify(String(row._id)))
    const page = await listRecords(pools, ctx, {
      tableId,
      filter: `_id in [${ids.join(', ')}]`,
      select: missing,
      limit: ids.length,
      variables: 'raw',
    })
    for (const row of page.rows) extra.set(String(row._id), row)
  }
  const full = (row: Record<string, unknown>) => {
    const more = extra.get(String(row._id))
    return more === undefined ? row : { ...more, ...row }
  }

  const people = new Set<string>()
  for (const row of citing) {
    const values = full(row)
    for (const column of readable.values()) {
      const value = values[column.name]
      if (column.kind === 'user' && typeof value === 'string') people.add(value)
    }
  }
  const extras = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) =>
      loadScopeExtras(exec, {
        tableId,
        actorId: ctx.actor.id,
        choiceFields: [...readable.values()]
          .filter((c) => c.kind === 'select' || c.kind === 'multi_select')
          .map((c) => c.name),
        people: [...people],
      }),
    { readOnly: true },
  )
  const scope: VariableScope = { readable, known: new Set(byName.keys()), ...extras }

  return rows.map((row) => {
    if (!texts.some((c) => hasVariables(row[c]))) return row
    const values = full(row)
    const copy = { ...row }
    for (const c of texts) {
      const text = row[c]
      if (hasVariables(text))
        copy[c] = resolveText(text, values, scope, byName.get(c)?.rich === true)
    }
    return copy
  })
}

export interface Plan {
  readonly schemaName: string
  readonly tableName: string
  readonly columns: readonly string[]
  readonly filterable: ReadonlyMap<string, FilterableColumn>
  /** Targets reachable through a link path, decided upstream (§4.4). */
  readonly links: ReadonlyMap<string, FilterableTarget>
  readonly decision: Decision
  /**
   * The fields computed at read time this reader may see (chapter 04 §7 ter), projected
   * by one lateral join under the alias `v`.
   */
  readonly computed: readonly ComputedColumn[]
}

/** The lateral join of a plan's computed fields, given the alias of its table. */
export function planLateral(plan: Plan, alias: string): string {
  return lateralJoin(plan.computed, alias)
}

/**
 * Resolves the tables reachable through a link path, with their RBAC decision.
 *
 * Everything is decided HERE, inside the catalog transaction: the SQL builder receives
 * a closed set of targets and columns, and therefore cannot reach a table whose access
 * has not been settled.
 */
async function resolveFilterableLinks(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<Map<string, FilterableTarget>> {
  const fields = await loadLinkFields(exec, tableId)
  const links = new Map<string, FilterableTarget>()
  if (fields.length === 0) return links

  const grants = await loadGrants(exec, ctx)

  for (const field of fields) {
    const target = await loadTarget(exec, ctx, field.targetTableId)
    const decision = target === null ? null : decide(ctx, grants, 'read', target)
    const readable = decision !== null && decision.verdict === 'ALLOWED'

    const location = await exec.query<{
      schema_name: string
      table_name: string
      display_field_id: string | null
    }>(
      `SELECT sn.name AS schema_name, tn.name AS table_name, t.display_field_id
         FROM _basedb.table_def t
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
        WHERE t.id = $1`,
      [field.targetTableId],
    )
    const loc = location[0]
    if (loc === undefined) continue

    // The target's fields are filtered by ITS OWN mask: a field masked on `clients`
    // does not become filterable because it is reached from `factures`.
    const targetFields = readable ? await loadFields(exec, field.targetTableId) : new Map()
    const columns = new Map<string, FilterableColumn>()
    let displayColumn: FilterableColumn | null = null

    for (const [id, column] of targetFields) {
      if (decision === null || !decision.readableFields.has(id)) continue
      // A field computed at read time has no column a path could name.
      if (column.stored === false) continue
      columns.set(column.name, column)
      if (id === loc.display_field_id) displayColumn = column
    }

    links.set(field.column, {
      relation: qualify(loc.schema_name, loc.table_name),
      columns,
      displayColumn,
      rowPredicate: decision?.rowPredicate ?? 'TRUE',
      readable,
    })
  }

  return links
}

/**
 * What reading a table is allowed to touch, decided once — its readable columns, the
 * targets its link paths may reach, its row predicate. Shared with the aggregates, which
 * must see exactly the rows and columns a page would.
 */
export async function buildPlan(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<Plan> {
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, tableId)

  // Unknown name and invisible target: same response, same code, no difference in
  // message.
  if (target === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  }

  const decision = decide(ctx, grants, 'read', target)
  if (decision.verdict !== 'ALLOWED') {
    throw new BasedbError(
      decision.verdict === 'INVISIBLE' ? 'RESOURCE_NOT_FOUND' : 'ADMIN_REQUIRED',
      { details: { table: tableId } },
    )
  }

  const fields = await loadFields(exec, tableId)
  const location = await exec.query<{ schema_name: string; table_name: string }>(
    `SELECT sn.name AS schema_name, tn.name AS table_name
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1`,
    [tableId],
  )

  // System columns first, then the readable business fields, in catalog order. An empty
  // list is refused as a programming error — the verdict should have been INVISIBLE
  // (§3.2 step 9).
  const readable = [...fields].filter(([id]) => decision.readableFields.has(id))
  if (readable.length === 0) {
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'empty mask reached the SQL builder', table: tableId },
    })
  }

  // The fields computed at read time, resolved FOR THIS READER: one whose path or
  // citation they cannot read is left out, as a masked field is (04 §7 ter.2).
  const computed = await resolveComputed(exec, ctx, grants, decision, fields)
  const computedByName = new Map(computed.map((c) => [c.name, c]))
  const shown = readable.filter(([, c]) => c.stored !== false || computedByName.has(c.name))
  const columns = [...SYSTEM_COLUMNS, ...shown.map(([, c]) => c.name)]

  // The filterable-column table contains ONLY the read mask: that is what makes a
  // masked field indistinguishable from a non-existent one (§4.3). A computed field is
  // read under the lateral's alias, with the kind of its result.
  const filterable = new Map<string, FilterableColumn>(
    shown.map(([, c]) => {
      const virtual = computedByName.get(c.name)
      return [
        c.name,
        virtual === undefined
          ? c
          : {
              name: c.name,
              kind: virtual.kind,
              alias: COMPUTED_ALIAS,
              stored: false,
              ...(virtual.elementKind === undefined ? {} : { elementKind: virtual.elementKind }),
            },
      ]
    }),
  )
  return {
    schemaName: location[0].schema_name,
    tableName: location[0].table_name,
    columns,
    filterable,
    links: await resolveFilterableLinks(exec, ctx, tableId),
    decision,
    computed,
  }
}

/**
 * The columns a `select` keeps, in catalog order, `_id` always first.
 *
 * A name outside the read mask is refused exactly like an unknown one: a `select` that
 * answered differently for a masked column would enumerate the mask.
 */
function selectColumns(plan: Plan, select: readonly string[] | undefined): readonly string[] {
  if (select === undefined) return plan.columns
  for (const name of select) {
    if (!plan.columns.includes(name)) {
      throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: name } })
    }
  }
  const wanted = new Set(['_id', ...select])
  return plan.columns.filter((c) => wanted.has(c))
}

/** Alias of the main table, so that every emitted column is qualified. */
const ALIAS = 't'

/**
 * Builds the `SELECT`.
 *
 * Every column is named and quoted; the row predicate is emitted in EVERY query, even
 * when it is `TRUE` (A20), and carries the `predicat_lignes` marker that the
 * non-regression test looks for in each statement sent to the `data` pool.
 */
export function buildSelect(
  plan: Plan,
  options: ListOptions,
  limit: number,
  /** Who is reading, and what: a cursor is bound to both (chapter 08 §6.2). */
  binding: { readonly actorId: string; readonly tableId: string },
): {
  readonly sql: string
  readonly params: readonly unknown[]
  readonly countSql: string
  readonly countParams: readonly unknown[]
  readonly sortTerms: readonly SortTermPlan[]
  readonly fingerprint: string
  /** Sort columns read for the cursor alone, outside the requested projection. */
  readonly sortOnly: readonly string[]
} {
  const prefix = `${quoteIdentifier(ALIAS)}.`
  const relation = qualify(plan.schemaName, plan.tableName)

  const params: unknown[] = []
  // The marker is MANDATORY, including when the predicate is constant: it is what the
  // test looks for in every statement sent to the `data` pool, and a statement lacking
  // it fails the suite. The interpolated name is a physical name validated against
  // alphabet B, so it cannot close the comment.
  const clauses = [
    `( /*predicat_lignes:${plan.tableName}*/ ${rowWhere(plan.decision.rowPredicate, ALIAS)} )`,
  ]

  if (options.filter !== undefined && options.filter.trim() !== '') {
    const filter = buildFilter(withMe(options.filter, binding.actorId), plan.filterable, {
      alias: ALIAS,
      firstParameter: params.length + 1,
      links: plan.links,
    })
    params.push(...filter.params)
    clauses.push(`( ${filter.sql} )`)
  }

  const sort = buildSort(options.sort, plan.filterable, ALIAS)

  // The count is taken over the page's clauses MINUS the cursor: a total that shrank as
  // one paged forward would be worse than no total at all. It is captured here, before
  // the keyset predicate is appended.
  const countParams = [...params]
  const lateral = planLateral(plan, ALIAS)
  const countSql = `SELECT count(*) AS n
  FROM (SELECT 1
          FROM ${relation} AS ${quoteIdentifier(ALIAS)}${lateral}
         WHERE ${clauses.join('\n   AND ')}
         LIMIT ${Math.min(options.countCeiling ?? COUNT_CEILING, COUNT_CEILING) + 1}) AS bounded;`

  const fingerprint = fingerprintOf({
    sort: options.sort ?? '',
    filter: options.filter ?? '',
    columns: plan.columns,
  })

  if (options.after !== undefined && options.after !== '') {
    const cursor = decodeCursor(options.after, {
      actorId: binding.actorId,
      tableId: binding.tableId,
      fingerprint,
    })
    clauses.push(
      keysetPredicate(
        sort.terms,
        cursor.keys,
        cursor.id,
        qualifiedId(ALIAS),
        params,
        (term) => CAST[term.kind],
      ),
    )
  }

  // The cursor is minted from the sort-key values of the last row, so every sort column
  // is read — even one a `select` left out, which the caller then drops.
  const sortOnly = sort.terms.map((t) => t.name).filter((name) => !plan.columns.includes(name))
  // A computed field is read from the lateral join, under its own name.
  const computedNames = new Set(plan.computed.map((c) => c.name))
  const projection = [...plan.columns, ...sortOnly]
    .map((c) =>
      computedNames.has(c)
        ? `${quoteIdentifier(COMPUTED_ALIAS)}.${quoteIdentifier(c)}`
        : `${prefix}${quoteIdentifier(c)}`,
    )
    .join(', ')

  const sql = `SELECT ${projection}
  FROM ${relation} AS ${quoteIdentifier(ALIAS)}${lateral}
 WHERE ${clauses.join('\n   AND ')}
 ORDER BY ${sort.sql}
 LIMIT ${limit + 1};`

  return { sql, params, countSql, countParams, sortTerms: sort.terms, fingerprint, sortOnly }
}

/** Exposes field-name resolution, for tests and neighbouring callers. */
export { resolveColumn }
