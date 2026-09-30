import { qualify } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { type ActorGrants, decide } from '../rbac/decide.js'
import { loadTarget } from '../rbac/loader.js'
import { ROW_ALIAS } from '../rbac/rows.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * A link written to rows its author does not see — chapter 05 §16.
 *
 * The foreign key accepts any row that exists: without this check, writing an identifier
 * into a link would tell its author whether a row they are not shown exists, and would
 * tie their row to it. The answer is the one a row that does not exist gets,
 * `LINK_TARGET_NOT_FOUND` — « inexistante ou invisible » (A23).
 *
 * Settled in two steps, on the two pools: which links need it, while the write is planned
 * in the catalog transaction; the rows themselves, in the data transaction that writes.
 */

export interface LinkScopeCheck {
  /** The target, `"schema"."table"`, already quoted. */
  readonly relation: string
  /** The author's row predicate on the target, over the placeholder alias. */
  readonly predicate: string
  readonly ids: readonly string[]
}

/** The identifiers a link value names: one, a list, or `{ id }` objects. */
function idsOf(value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(idsOf)
  if (typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return [(value as { id: string }).id]
  }
  return []
}

/**
 * The checks the values written into a table's links call for — none when the targets
 * carry no row rule for this author. Run in the CATALOG transaction.
 *
 * `links` maps a written field's physical name to its field id, for the link fields only.
 */
export async function linkScopeChecks(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  links: ReadonlyMap<string, string>,
  values: Readonly<Record<string, unknown>>,
): Promise<LinkScopeCheck[]> {
  const written = [...links].filter(([name]) => idsOf(values[name]).length > 0)
  if (written.length === 0) return []
  const targets = await exec.query<{
    field_id: string
    target_table_id: string
    schema_name: string
    table_name: string
  }>(
    `SELECT flc.field_id::text, flc.target_table_id::text, sn.name AS schema_name,
            tn.name AS table_name
       FROM _basedb.field_link_config flc
       JOIN _basedb.table_def t      ON t.id = flc.target_table_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE flc.field_id = ANY($1::uuid[])`,
    [written.map(([, id]) => id)],
  )
  const checks: LinkScopeCheck[] = []
  for (const [name, fieldId] of written) {
    const link = targets.find((t) => t.field_id === fieldId)
    if (link === undefined) continue
    const target = await loadTarget(exec, ctx, link.target_table_id)
    if (target === null) continue
    const decision = decide(ctx, grants, 'read', target)
    // An unreadable target is refused by the mask before this (§5.1): nothing to add.
    if (decision.verdict !== 'ALLOWED' || decision.rowPredicate === 'TRUE') continue
    checks.push({
      relation: qualify(link.schema_name, link.table_name),
      predicate: decision.rowPredicate,
      ids: [...new Set(idsOf(values[name]))],
    })
  }
  return checks
}

/** The rows each check names, all visible to the author — or `LINK_TARGET_NOT_FOUND`. */
export async function assertLinkScope(
  exec: Executor,
  checks: readonly LinkScopeCheck[],
): Promise<void> {
  for (const check of checks) {
    const [row] = await exec.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM ${check.relation} AS "${ROW_ALIAS}"
        WHERE "_id" = ANY($1::uuid[])
          AND ( /*predicat_lignes*/ ${check.predicate} )`,
      [check.ids],
    )
    if ((row?.n ?? 0) < check.ids.length) throw new BasedbError('LINK_TARGET_NOT_FOUND')
  }
}
