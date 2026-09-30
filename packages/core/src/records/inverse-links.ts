import { qualify, quoteIdentifier } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { rowWhere } from '../rbac/rows.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Inverse links — chapter 04 §6.
 *
 * A row's detail view lists the rows that reference it. No configuration: the list of
 * incoming link fields is the one the catalog reference query produces over
 * `field_link_config`, served by `idx_link_target`.
 *
 * What this requires is an index on every referencing column. `ix_<table>__<column>` is
 * created as a matter of course with `_id` as its second term (§4.1), which makes the
 * listing sorted without a sort.
 */

/** The three semantic bounds of §6. They are normative; chapter 08 takes them as is. */
export const INVERSE_BUDGETS = {
  /** Blocks loaded at once; beyond that, the rest are collapsed and loaded on demand. */
  blocks: 20,
  /** Rows per block, sorted `"_id" DESC`. */
  rowsPerBlock: 50,
  /** The count is capped: an exact `count(*)` would cost more than the whole page. */
  countCap: 500,
} as const

/** One referencing row, as the detail view shows it. */
export interface ReferencingRow {
  readonly id: string
  /** Display value of the source table, or `null` if it designates no column. */
  readonly display: string | null
  readonly updatedAt: string
}

/** One block: a link field pointing at the row being read. */
export interface InverseLinkBlock {
  /** `<source table label> · <field label>`, computed on read. */
  readonly label: string
  readonly tableId: string
  readonly tableName: string
  readonly fieldName: string
  readonly rows: readonly ReferencingRow[]
  /** Capped count; `true` on `capped` means "500+". */
  readonly count: number
  readonly capped: boolean
}

export interface InverseLinks {
  readonly blocks: readonly InverseLinkBlock[]
  /** True if more blocks exist than the bound loads. */
  readonly truncated: boolean
  readonly sql: readonly string[]
}

interface IncomingLink extends Record<string, unknown> {
  readonly table_id: string
  readonly table_label: string
  readonly table_name: string
  readonly schema_name: string
  readonly field_label: string
  readonly column: string
  readonly display_column: string | null
  /** A multi-link cites the row in a list (chapter 04 §4 bis). */
  readonly kind: 'link' | 'multi_link'
}

/**
 * Lists the link fields pointing AT a table.
 *
 * Only live links whose foreign key is in place: a link whose constraint was dropped no
 * longer guarantees anything, and showing it would promise an integrity that is not
 * enforced.
 */
async function loadIncomingLinks(exec: Executor, targetTableId: string): Promise<IncomingLink[]> {
  return exec.query<IncomingLink>(
    `SELECT t.id          AS table_id,
            t.label       AS table_label,
            tn.name       AS table_name,
            sn.name       AS schema_name,
            f.label       AS field_label,
            n.name        AS column,
            dn.name       AS display_column,
            f.kind
       FROM _basedb.field_link_config lc
       JOIN _basedb.field f           ON f.id = lc.field_id
       JOIN _basedb.physical_name n   ON n.id = f.name_id
       JOIN _basedb.table_def t       ON t.id = f.table_id
       JOIN _basedb.physical_name tn  ON tn.id = t.name_id
       JOIN _basedb.db_schema s       ON s.id = t.schema_id
       JOIN _basedb.physical_name sn  ON sn.id = s.name_id
       LEFT JOIN _basedb.field df     ON df.id = t.display_field_id
       LEFT JOIN _basedb.physical_name dn ON dn.id = df.name_id
      WHERE lc.target_table_id = $1
        AND lc.fk_dropped_at IS NULL
        AND f.is_live AND t.is_live
      ORDER BY t.label, f.position`,
    [targetTableId],
  )
}

/**
 * Lists the rows referencing a given row, block by block.
 *
 * The queries run in a single read-only transaction, one per block — no `UNION ALL`,
 * the projected columns differing from one source table to another.
 *
 * Permissions: a block whose source table is not readable does not appear — no block,
 * no counter, no mention. A counter visible on a masked table would be a leak.
 */
export async function listInverseLinks(
  pools: Pools,
  ctx: RequestContext,
  options: { readonly tableId: string; readonly recordId: string },
): Promise<InverseLinks> {
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      // The row being read must itself be readable: without this check, inverse links
      // would count the rows referencing a row the actor cannot see.
      const target = await loadTarget(exec, ctx, options.tableId)
      if (target === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: options.tableId } })
      }
      const grants = await loadGrants(exec, ctx)
      if (decide(ctx, grants, 'read', target).verdict !== 'ALLOWED') {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: options.tableId } })
      }

      const incoming = await loadIncomingLinks(exec, options.tableId)
      const readable: Array<IncomingLink & { rowPredicate: string }> = []

      for (const link of incoming) {
        const source = await loadTarget(exec, ctx, link.table_id)
        if (source === null) continue
        const decision = decide(ctx, grants, 'read', source)
        if (decision.verdict !== 'ALLOWED') continue

        // A display column masked for this reader yields `display: null`, never a
        // substitute field — which would be a leak channel chosen at random.
        const displayReadable =
          link.display_column !== null &&
          [...(await loadIncomingDisplayFieldId(exec, link.table_id))].every((id) =>
            decision.readableFields.has(id),
          )

        readable.push({
          ...link,
          display_column: displayReadable ? link.display_column : null,
          rowPredicate: decision.rowPredicate,
        })
      }

      return readable
    },
    { readOnly: true },
  )

  const truncated = plan.length > INVERSE_BUDGETS.blocks
  const kept = plan.slice(0, INVERSE_BUDGETS.blocks)

  const blocks: InverseLinkBlock[] = []
  const sql: string[] = []

  for (const link of kept) {
    const relation = qualify(link.schema_name, link.table_name)
    const column = quoteIdentifier(link.column)
    // A multi-link holds the row in a list: `@>`, served by its GIN index.
    const cites =
      link.kind === 'multi_link' ? `${column} @> ARRAY[$1::uuid]` : `${column} = $1::uuid`

    const projection =
      link.display_column === null
        ? '"_id", "_updated_at"'
        : `"_id", ${quoteIdentifier(link.display_column)} AS "_display", "_updated_at"`

    // Sorted `"_id" DESC`: a UUIDv7 is ordered in time, so this is "most recent first"
    // with no extra column — and the `(column, _id)` index serves it without a sort.
    const rowsQuery = `SELECT ${projection}
  FROM ${relation}
 WHERE ${cites}
   AND ( /*predicat_lignes:${link.table_name}*/ ${rowWhere(link.rowPredicate, relation)} )
 ORDER BY "_id" DESC
 LIMIT ${INVERSE_BUDGETS.rowsPerBlock};`

    // The count is CAPPED at the bound plus one: an exact `count(*)` on a large source
    // table would cost more than the rest of the page put together.
    const countQuery = `SELECT count(*)::int AS n
  FROM (SELECT 1
          FROM ${relation}
         WHERE ${cites}
           AND ( /*predicat_lignes:${link.table_name}*/ ${rowWhere(link.rowPredicate, relation)} )
         LIMIT ${INVERSE_BUDGETS.countCap + 1}) t;`

    sql.push(rowsQuery, countQuery)

    const rows = await pools.withConnection('data', (exec) =>
      exec.query<{ _id: string; _display?: string | null; _updated_at: string }>(rowsQuery, [
        options.recordId,
      ]),
    )
    const [counted] = await pools.withConnection('data', (exec) =>
      exec.query<{ n: number }>(countQuery, [options.recordId]),
    )

    blocks.push({
      label: `${link.table_label} · ${link.field_label}`,
      tableId: link.table_id,
      tableName: link.table_name,
      fieldName: link.column,
      rows: rows.map((r) => ({
        id: r._id,
        display: r._display ?? null,
        updatedAt: String(r._updated_at),
      })),
      count: Math.min(counted.n, INVERSE_BUDGETS.countCap),
      capped: counted.n > INVERSE_BUDGETS.countCap,
    })
  }

  return { blocks, truncated, sql }
}

/** The identifier of a table's display field, empty when it designates none. */
async function loadIncomingDisplayFieldId(
  exec: Executor,
  tableId: string,
): Promise<ReadonlySet<string>> {
  const rows = await exec.query<{ display_field_id: string | null }>(
    'SELECT display_field_id FROM _basedb.table_def WHERE id = $1',
    [tableId],
  )
  const id = rows[0]?.display_field_id
  return id === null || id === undefined ? new Set() : new Set([id])
}
