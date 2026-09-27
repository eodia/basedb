import { loadGrants } from '../rbac/loader.js'
import { loadBaseTarget } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import {
  type SqlConsoleRequest,
  type SqlConsoleResult,
  holdsConsole,
  runConsoleSql,
} from './console.js'
import { runReaderSql } from './reader.js'

/**
 * Runs SQL on a base with the caller's reach — the one door the interface's SQL tabs, its
 * saved queries and its SQL views go through.
 *
 * Whoever manages the base's structure gets the console: all of its schema, writes
 * included. Everyone else who sees the base gets the reader: their own tables and fields,
 * read only. Nobody is refused SQL for not managing the base any more; they are refused
 * what they could not read by any other route.
 */
export async function runSql(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string | undefined,
  connectionString: string,
  request: SqlConsoleRequest,
): Promise<SqlConsoleResult> {
  const console = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) =>
      holdsConsole(
        ctx,
        await loadGrants(exec, ctx),
        await loadBaseTarget(exec, ctx, request.baseId),
      ),
    { readOnly: true },
  )
  return console
    ? runConsoleSql(pools, ctx, instanceKey, connectionString, request)
    : runReaderSql(pools, ctx, instanceKey, connectionString, request)
}
