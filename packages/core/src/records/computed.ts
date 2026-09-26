import { qualify, quoteIdentifier } from '@basedb/naming'
import type { FieldKind } from '../ddl/emit.js'
import { type FormulaType, type Node, emitFormula } from '../formula/language.js'
import { type ActorGrants, type Decision, decide } from '../rbac/decide.js'
import { loadTarget } from '../rbac/loader.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * Fields computed at read time — chapter 04 §7 ter: lookups, rollups, counts, and the
 * formulas that cannot be stored (§7.1).
 *
 * They have no column. Each becomes an expression of ONE lateral join per read, under
 * the alias `v`, which the projection, the filter, the sort, the cursor and the
 * aggregates then name as they name `t`:
 *
 *   FROM "b_…"."clients" AS t
 *   CROSS JOIN LATERAL (SELECT (SELECT sum(x1."montant") FROM … ) AS "total") AS v
 *
 * Reading through a relation is reading the table it reaches. So a computed field is
 * resolved FOR A READER: the relation it follows, the table it reaches and the field it
 * cites must all be readable by them, and the reached table's row predicate is written
 * into the sub-query — else the field is masked, exactly as a field they may not see.
 */

/** Alias of the lateral join, beside the table's `t`. */
export const COMPUTED_ALIAS = 'v'

/** A computed field, as the read of one reader may project it. */
export interface ComputedColumn {
  readonly id: string
  readonly name: string
  /** The kind the filter and the sort see: the result's, or `lookup` for a list. */
  readonly kind: FieldKind
  /** For a list, the kind of each element. */
  readonly elementKind?: FieldKind
  /** The expression, given the alias of the table being read. */
  readonly expression: (outer: string) => string
}

const LIST_OF_KINDS: ReadonlySet<string> = new Set(['lookup', 'rollup', 'count', 'formula'])

interface RollupRow extends Record<string, unknown> {
  readonly field_id: string
  readonly kind: 'lookup' | 'rollup' | 'count'
  readonly direction: 'outgoing' | 'incoming'
  readonly via_field_id: string
  readonly via_column: string
  readonly via_kind: 'link' | 'multi_link'
  readonly via_table_id: string
  readonly link_target_table_id: string
  readonly via_live: boolean
  readonly target_field_id: string | null
  readonly target_column: string | null
  readonly target_live: boolean | null
  readonly aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max' | null
  readonly result_kind: FieldKind
  readonly is_multiple: boolean
}

interface FormulaRow extends Record<string, unknown> {
  readonly field_id: string
  readonly ast: Node
  readonly timezone: string | null
}

/** A table reached through a relation, as one reader may read it. */
interface Reached {
  readonly relation: string
  readonly tableName: string
  readonly decision: Decision | null
}

/**
 * The computed fields of a table a reader may project, in the order given.
 *
 * `fields` are the table's live fields; only those in `decision.readableFields` and not
 * stored are considered. The result keeps the reader's rights: a field whose path or
 * citation they cannot read is simply absent.
 */
export async function resolveComputed(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  decision: Decision,
  fields: ReadonlyMap<
    string,
    { readonly name: string; readonly kind: FieldKind; readonly stored?: boolean }
  >,
): Promise<ComputedColumn[]> {
  const wanted = [...fields].filter(
    ([id, f]) => f.stored === false && LIST_OF_KINDS.has(f.kind) && decision.readableFields.has(id),
  )
  if (wanted.length === 0) return []

  const rollups = await exec.query<RollupRow>(
    `SELECT rc.field_id, rc.kind, rc.direction, rc.via_field_id, vn.name AS via_column,
            vf.kind AS via_kind, vf.table_id AS via_table_id,
            lc.target_table_id AS link_target_table_id,
            (vf.is_live AND lc.fk_dropped_at IS NULL) AS via_live,
            rc.target_field_id, tn.name AS target_column, tf.is_live AS target_live,
            rc.aggregate, rc.result_kind, rc.is_multiple
       FROM _basedb.field_rollup_config rc
       JOIN _basedb.field vf             ON vf.id = rc.via_field_id
       JOIN _basedb.physical_name vn     ON vn.id = vf.name_id
       JOIN _basedb.field_link_config lc ON lc.field_id = vf.id
       LEFT JOIN _basedb.field tf        ON tf.id = rc.target_field_id
       LEFT JOIN _basedb.physical_name tn ON tn.id = tf.name_id
      WHERE rc.field_id = ANY($1::uuid[])`,
    [wanted.map(([id]) => id)],
  )
  const formulas = await exec.query<FormulaRow>(
    `SELECT field_id, ast, timezone FROM _basedb.field_formula_config
      WHERE field_id = ANY($1::uuid[]) AND NOT is_stored`,
    [wanted.map(([id]) => id)],
  )

  // One decision per reached table, taken once.
  const reached = new Map<string, Reached | null>()
  const reach = async (tableId: string): Promise<Reached | null> => {
    if (reached.has(tableId)) return reached.get(tableId) ?? null
    const target = await loadTarget(exec, ctx, tableId)
    const verdict = target === null ? null : decide(ctx, grants, 'read', target)
    const [location] = await exec.query<{ schema_name: string; table_name: string }>(
      `SELECT sn.name AS schema_name, tn.name AS table_name
         FROM _basedb.table_def t
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
        WHERE t.id = $1 AND t.is_live`,
      [tableId],
    )
    const value =
      location === undefined || verdict === null || verdict.verdict !== 'ALLOWED'
        ? null
        : {
            relation: qualify(location.schema_name, location.table_name),
            tableName: location.table_name,
            decision: verdict,
          }
    reached.set(tableId, value)
    return value
  }

  // Inner aliases are unique across the whole lateral join.
  let counter = 0
  const byId = new Map<string, ComputedColumn>()

  for (const row of rollups) {
    const field = fields.get(row.field_id)
    if (field === undefined || !row.via_live) continue
    if (row.target_field_id !== null && row.target_live !== true) continue

    // The relation followed must itself be readable where it lives: on this table for an
    // outgoing path, on the other one for an incoming path.
    const reachedId = row.direction === 'outgoing' ? row.link_target_table_id : row.via_table_id
    const other = await reach(reachedId)
    if (other === null || other.decision === null) continue
    if (row.direction === 'outgoing' && !decision.readableFields.has(row.via_field_id)) continue
    if (row.direction === 'incoming' && !other.decision.readableFields.has(row.via_field_id)) {
      continue
    }
    if (row.target_field_id !== null && !other.decision.readableFields.has(row.target_field_id)) {
      continue
    }

    counter++
    const x = quoteIdentifier(`x${counter}`)
    const u = quoteIdentifier(`u${counter}`)
    const via = quoteIdentifier(row.via_column)
    const predicate = `( /*predicat_lignes:${other.tableName}*/ ${other.decision.rowPredicate} )`
    const value = row.target_column === null ? null : `${x}.${quoteIdentifier(row.target_column)}`

    /** `FROM … WHERE …` of the rows reached, and the order they come in. */
    const rowsOf = (outer: string): { from: string; order: string } => {
      const o = quoteIdentifier(outer)
      if (row.direction === 'outgoing' && row.via_kind === 'multi_link') {
        return {
          from: `FROM unnest(${o}.${via}) WITH ORDINALITY AS ${u}("_u_id", "_u_ord")
                  JOIN ${other.relation} AS ${x} ON ${x}."_id" = ${u}."_u_id"
                 WHERE ${predicate}`,
          order: `${u}."_u_ord"`,
        }
      }
      const reachedBy =
        row.direction === 'outgoing'
          ? `${x}."_id" = ${o}.${via}`
          : row.via_kind === 'multi_link'
            ? `${x}.${via} @> ARRAY[${o}."_id"]`
            : `${x}.${via} = ${o}."_id"`
      return {
        from: `FROM ${other.relation} AS ${x} WHERE ${reachedBy} AND ${predicate}`,
        order: `${x}."_id"`,
      }
    }

    const expression = (outer: string): string => {
      const { from, order } = rowsOf(outer)
      switch (row.kind) {
        case 'count':
          return `(SELECT count(*)::numeric ${from})`
        case 'rollup': {
          const fn = row.aggregate ?? 'count'
          const agg = fn === 'count' ? `count(${value})::numeric` : `${fn}(${value})`
          return `(SELECT ${agg} ${from})`
        }
        case 'lookup':
          return row.is_multiple
            ? `(SELECT array_agg(${value} ORDER BY ${order}) ${from} AND ${value} IS NOT NULL)`
            : `(SELECT ${value} ${from} LIMIT 1)`
      }
    }

    byId.set(row.field_id, {
      id: row.field_id,
      name: field.name,
      kind: row.kind === 'lookup' && row.is_multiple ? 'lookup' : row.result_kind,
      ...(row.kind === 'lookup' && row.is_multiple ? { elementKind: row.result_kind } : {}),
      expression,
    })
  }

  // A formula computed at read time names stored columns of `t` and computed ones by
  // their expression, inlined: the lateral cannot read its own siblings.
  const typeOfKind = (kind: string): FormulaType =>
    kind === 'number' || kind === 'autonumber'
      ? 'number'
      : kind === 'boolean'
        ? 'boolean'
        : kind === 'date'
          ? 'date'
          : kind === 'datetime'
            ? 'datetime'
            : 'text'
  for (const row of formulas) {
    const field = fields.get(row.field_id)
    if (field === undefined) continue
    const cited = citedIds(row.ast)
    // Every field it cites must be readable, and every computed one resolved for this
    // reader: a formula over a masked field would say what the field holds.
    const readable = cited.every(
      (id) =>
        decision.readableFields.has(id) &&
        (fields.get(id)?.stored !== false || byId.has(id)) &&
        fields.has(id),
    )
    if (!readable) continue
    const [config] = await exec.query<{ result_kind: FieldKind }>(
      'SELECT result_kind FROM _basedb.field_formula_config WHERE field_id = $1',
      [row.field_id],
    )
    byId.set(row.field_id, {
      id: row.field_id,
      name: field.name,
      kind: config?.result_kind ?? 'short_text',
      expression: (outer) =>
        emitFormula(row.ast, {
          field: (id) => {
            const computed = byId.get(id)
            if (computed !== undefined) return computed.expression(outer)
            return `${quoteIdentifier(outer)}.${quoteIdentifier(fields.get(id)?.name ?? '')}`
          },
          typeOf: (id) => {
            const computed = byId.get(id)
            return typeOfKind(computed?.elementKind ?? computed?.kind ?? fields.get(id)?.kind ?? '')
          },
          timezone: row.timezone ?? 'Europe/Paris',
        }),
    })
  }

  // In the catalog order of the fields.
  return wanted.flatMap(([id]) => {
    const column = byId.get(id)
    return column === undefined ? [] : [column]
  })
}

/** The catalog keys a stored formula tree cites. */
export function citedIds(ast: Node): string[] {
  const out = new Set<string>()
  const walk = (node: Node): void => {
    switch (node.t) {
      case 'field':
        out.add(node.id)
        return
      case 'call':
        for (const a of node.args) walk(a)
        return
      case 'binary':
        walk(node.left)
        walk(node.right)
        return
      case 'not':
      case 'negate':
        walk(node.e)
        return
      default:
        return
    }
  }
  walk(ast)
  return [...out]
}

/** `CROSS JOIN LATERAL (SELECT …) AS v`, or nothing when no computed field is read. */
export function lateralJoin(columns: readonly ComputedColumn[], outer: string): string {
  if (columns.length === 0) return ''
  const items = columns.map((c) => `${c.expression(outer)} AS ${quoteIdentifier(c.name)}`)
  return `\n  CROSS JOIN LATERAL (SELECT ${items.join(',\n    ')}) AS ${quoteIdentifier(COMPUTED_ALIAS)}`
}
