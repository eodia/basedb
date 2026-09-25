import { createHash } from 'node:crypto'
import { BasedbError } from '../errors/index.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * Idempotency of data writes — chapter 08 §3.3, taken as is by chapter 09 §6.3.
 *
 * ONE mechanism, ONE place: `_basedb.idempotency_key`, shared by REST and MCP. A key has
 * meaning only within the scope of the actor presenting it — `(actor_kind, actor_id,
 * key)` — so for a token the actor is the token itself, never its creator: two tokens of
 * one person using the same string never meet.
 *
 * The claim is written BEFORE the work, on the catalog pool: the primary key serializes
 * two concurrent retries, which is the whole point. The work then runs on the data pool,
 * and the claim is completed with the response — or dropped if the work wrote nothing.
 */

/** How long a claim is held for the work to finish. */
const LEASE_SECONDS = 60
/** How long a response is remembered (08 §3.3). */
const RETENTION_HOURS = 24

export type Claim =
  | { readonly kind: 'claimed' }
  | { readonly kind: 'replay'; readonly response: Record<string, unknown> }

function actorOf(ctx: RequestContext): { kind: 'user' | 'token'; id: string } {
  return ctx.actor.kind === 'token' && ctx.actor.tokenId !== undefined
    ? { kind: 'token', id: ctx.actor.tokenId }
    : { kind: 'user', id: ctx.actor.id }
}

/** SHA-256 of the parameters, keys sorted at every depth: the same call, the same print. */
export function paramsHash(params: unknown): Buffer {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .sort()
          .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
      )
    }
    return value
  }
  return createHash('sha256')
    .update(JSON.stringify(canonical(params)))
    .digest()
}

/**
 * Claims a key, or says what the earlier call with that key left behind.
 *
 * | Situation                                     | Answer                          |
 * |-----------------------------------------------|---------------------------------|
 * | same key, same print, response kept           | the response, replayed as is    |
 * | same key, different print                     | `IDEMPOTENCY_CONFLICT`          |
 * | same key, lease running, no response yet      | `IDEMPOTENCY_IN_PROGRESS`       |
 * | same key, lease expired, no response          | `IDEMPOTENCY_INTERRUPTED`       |
 * | same key, rights changed since                | `IDEMPOTENCY_STALE`             |
 *
 * An expired lease is NOT reclaimed: telling "the process died before writing" from
 * "it died after" needs the history's `bulk_id`, which the capture does not write yet.
 * Refusing costs the agent one `get_record`; guessing wrong costs a duplicate.
 */
export async function claimIdempotency(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly key: string; readonly tool: string; readonly hash: Buffer },
): Promise<Claim> {
  const actor = actorOf(ctx)
  return pools.withConnection('catalog', async (exec) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const inserted = await exec.query<{ claim_id: string }>(
        `INSERT INTO _basedb.idempotency_key
           (actor_kind, actor_id, key, tool, params_hash, authz_version,
            lease_expires_at, expires_at)
         SELECT $1, $2, $3, $4, $5, t.authz_version,
                clock_timestamp() + make_interval(secs => $7::int),
                clock_timestamp() + make_interval(hours => $8::int)
           FROM _basedb.tenant t
          WHERE t.ref = $6
         ON CONFLICT (actor_kind, actor_id, key) DO NOTHING
         RETURNING claim_id`,
        [
          actor.kind,
          actor.id,
          request.key,
          request.tool,
          request.hash,
          ctx.tenantId,
          LEASE_SECONDS,
          RETENTION_HOURS,
        ],
        'insert',
      )
      if (inserted[0] !== undefined) return { kind: 'claimed' }

      const rows = await exec.query<{
        tool: string
        params_hash: Buffer
        response: Record<string, unknown> | null
        lease_live: boolean
        expired: boolean
        stale: boolean
      }>(
        `SELECT k.tool, k.params_hash, k.response,
                k.lease_expires_at > clock_timestamp() AS lease_live,
                k.expires_at <= clock_timestamp() AS expired,
                k.authz_version <> t.authz_version AS stale
           FROM _basedb.idempotency_key k
           JOIN _basedb.tenant t ON t.ref = $4
          WHERE k.actor_kind = $1 AND k.actor_id = $2 AND k.key = $3`,
        [actor.kind, actor.id, request.key, ctx.tenantId],
      )
      const row = rows[0]
      if (row === undefined) continue

      // Past its retention, the key is free again: the row is only waiting for its purge.
      if (row.expired) {
        await exec.query(
          `DELETE FROM _basedb.idempotency_key
            WHERE actor_kind = $1 AND actor_id = $2 AND key = $3 AND expires_at <= clock_timestamp()`,
          [actor.kind, actor.id, request.key],
          'delete',
        )
        continue
      }

      if (row.tool !== request.tool || !row.params_hash.equals(request.hash)) {
        throw new BasedbError('IDEMPOTENCY_CONFLICT')
      }
      if (row.response !== null) {
        // A kept response is never replayed towards a caller whose rights have moved.
        if (row.stale) throw new BasedbError('IDEMPOTENCY_STALE')
        return { kind: 'replay', response: row.response }
      }
      if (row.lease_live) {
        throw new BasedbError('IDEMPOTENCY_IN_PROGRESS', { details: { retry_after: 1 } })
      }
      throw new BasedbError('IDEMPOTENCY_INTERRUPTED')
    }
    throw new BasedbError('IDEMPOTENCY_IN_PROGRESS', { details: { retry_after: 1 } })
  })
}

/** Keeps the response of the work the claim covered. */
export async function completeIdempotency(
  pools: Pools,
  ctx: RequestContext,
  key: string,
  response: Record<string, unknown>,
): Promise<void> {
  const actor = actorOf(ctx)
  await pools.withConnection('catalog', (exec) =>
    exec.query(
      `UPDATE _basedb.idempotency_key
          SET response = $4::jsonb, http_status = 200
        WHERE actor_kind = $1 AND actor_id = $2 AND key = $3`,
      [actor.kind, actor.id, key, JSON.stringify(response)],
      'update',
    ),
  )
}

/**
 * Drops a claim whose work failed WITHOUT writing: the key is free for the corrected
 * call. A refusal is not a response worth keeping — replaying a `VALUE_INVALID` would
 * only stop the agent from fixing its value under the same key.
 */
export async function releaseIdempotency(
  pools: Pools,
  ctx: RequestContext,
  key: string,
): Promise<void> {
  const actor = actorOf(ctx)
  await pools.withConnection('catalog', (exec) =>
    exec.query(
      `DELETE FROM _basedb.idempotency_key
        WHERE actor_kind = $1 AND actor_id = $2 AND key = $3 AND response IS NULL`,
      [actor.kind, actor.id, key],
      'delete',
    ),
  )
}
