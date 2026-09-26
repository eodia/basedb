import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * The rows of a synced table are its synchronisation's — chapter 19 §3.2: anyone else's
 * write is refused, or the next synchronisation would erase it without a word.
 */
export async function refuseSynced(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<void> {
  if (ctx.actor.kind === 'system') return
  const [synced] = await exec.query<{ yes: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM _basedb.table_sync WHERE table_id = $1) AS yes',
    [tableId],
  )
  if (synced?.yes === true) {
    throw new BasedbError('TABLE_SYNCED', { details: { table: tableId } })
  }
}
