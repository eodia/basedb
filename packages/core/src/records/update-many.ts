import { quoteIdentifier } from '@basedb/naming'
import { loadAiDependents } from '../ai/field.js'
import { BasedbError } from '../errors/index.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { BATCH_MAX_OPERATIONS, withIndex } from './create.js'
import { assertLinkScope } from './link-scope.js'
import { type UpdatePlan, currentXact, planUpdate, prepare } from './update.js'

/**
 * A batch of updates — chapter 08 §3.5, `atomic: true`: what pasting a range of cells and
 * filling a selection of rows ask for.
 *
 * It is the update of ONE row, repeated: the same masks, the same row predicate, the same
 * shaping of the values, the same refusals — `planUpdate` is the very function the single
 * update uses, so a value cannot be good in one and bad in the other. Each row names its
 * own fields (a paste writes different columns on different rows), and an update is never
 * a replacement: a field a row does not name is left as it is.
 *
 * ONE transaction on the data pool: either every row is changed or none is, and the
 * history of the table records the whole batch under that one transaction — the identity
 * the response returns, and the one Ctrl+Z undoes (chapter 16 §4). Every revision is
 * written per row, as an update always is (chapter 07 §5.1): the batch loses nothing of
 * what each row held before.
 *
 * Every refusal names the row: `details.index` is its position in `updates`.
 */

export interface RecordUpdate {
  readonly recordId: string
  /** The fields to change, by physical name — the ones left out stay as they are. */
  readonly values: Readonly<Record<string, unknown>>
}

export interface UpdateRecordsOptions {
  readonly tableId: string
  /** One entry per row to change, in order. A row appears once. */
  readonly updates: readonly RecordUpdate[]
}

export interface UpdatedRecords {
  /** The identifiers of the rows changed, aligned with `updates`. */
  readonly ids: readonly string[]
  /** The statement of the first row, as every write shows what it emitted. */
  readonly sql: string
  /** The write's transaction — what an undo names (chapter 16 §4). */
  readonly xact: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function updateRecords(
  pools: Pools,
  ctx: RequestContext,
  options: UpdateRecordsOptions,
): Promise<UpdatedRecords> {
  const { updates } = options
  if (updates.length === 0) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'operations', reason: 'lot_vide' },
    })
  }
  if (updates.length > BATCH_MAX_OPERATIONS) {
    throw new BasedbError('BATCH_TOO_LARGE', {
      details: { operations: updates.length, maximum: BATCH_MAX_OPERATIONS },
    })
  }

  // A row named twice would be written twice, the second over the first: whichever the
  // caller meant, it is not what a batch is for. Refused before anything is read.
  const seen = new Set<string>()
  for (const [index, { recordId }] of updates.entries()) {
    const key = recordId.toLowerCase()
    if (seen.has(key)) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'operations', index, reason: 'ligne_en_double' },
      })
    }
    seen.add(key)
  }

  const plans = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const c = await prepare(exec, ctx, options.tableId, 'update')
      const dependents = await loadAiDependents(exec, options.tableId)
      const planned: UpdatePlan[] = []
      for (const [index, update] of updates.entries()) {
        try {
          // An identifier that is none names no row: the answer of a row that is not there.
          if (!UUID.test(update.recordId)) {
            throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: update.recordId } })
          }
          planned.push(
            await planUpdate(exec, ctx, c, {
              dependents,
              recordId: update.recordId.toLowerCase(),
              values: update.values,
              // The batch answers no row: an update never reads back what it cannot show.
              returning: quoteIdentifier('_id'),
            }),
          )
        } catch (error) {
          throw withIndex(error, index)
        }
      }
      return planned
    },
    { readOnly: true },
  )

  const { ids, xact } = await withTransaction(pools, 'data', ctx, async (exec) => {
    // The rows are written in the order of their identifiers, whatever the order of the
    // request: two batches over the same rows then wait for each other instead of each
    // holding the row the other needs.
    const idOf = (index: number) => (updates[index]?.recordId ?? '').toLowerCase()
    const order = updates.map((_, index) => index).sort((a, b) => (idOf(a) < idOf(b) ? -1 : 1))

    const changed: string[] = new Array(updates.length)
    for (const index of order) {
      const plan = plans[index] as UpdatePlan
      try {
        await assertLinkScope(exec, plan.links)
        const [row] = await exec.query<{ _id: string }>(plan.sql, plan.params, 'update')
        // A missing row and an invisible row answer alike: the caller does not learn that
        // a record exists elsewhere.
        if (row === undefined) {
          throw new BasedbError('RESOURCE_NOT_FOUND', {
            details: { record: updates[index]?.recordId },
          })
        }
        changed[index] = row._id
      } catch (error) {
        throw withIndex(error, index)
      }
    }
    return { ids: changed, xact: await currentXact(exec) }
  })

  return { ids, sql: (plans[0] as UpdatePlan).sql, xact }
}
