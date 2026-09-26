import type { PoolClient } from 'pg'
import { BasedbError, isRetryable } from '../errors/index.js'
import { type Executor, type PoolName, type Pools, executorOf } from '../runtime/pool.js'

/**
 * Request context and transaction boundaries — chapter 10 §4.
 *
 * The context is an EXPLICIT PARAMETER, the first argument of every operation. Rejected
 * alternative: contextual async storage (`AsyncLocalStorage`), which makes the
 * dependency invisible — a missed propagation is not visible on reading, and an
 * operation started outside a request would silently inherit a foreign context.
 */

/**
 * Internal brand that makes the context NON-FORGEABLE (§2.4, lock 2).
 *
 * The type is opaque: no literal shape satisfies it. An adapter can neither invent nor
 * modify it, and therefore has no way to assert an identity the kernel has not checked.
 */
declare const BRAND: unique symbol

/**
 * `form`: an answer to a PUBLIC shared form (chapter 15) — nobody signed in wrote it. Its
 * `id` is the person who published the form, who answers for it, and its `tokenId` the
 * share; it holds no right of its own, and the kernel never decides anything for it.
 */
export type ActorKind = 'user' | 'token' | 'system' | 'form'
export type Surface = 'ui' | 'rest' | 'mcp' | 'system'

export interface Actor {
  readonly kind: ActorKind
  readonly id: string
  readonly tokenId?: string
}

/**
 * Snapshot of effective permissions, computed once by the kernel and frozen for the
 * whole operation.
 */
export interface PermissionSnapshot {
  readonly version: string
  /**
   * Row predicate, constantly true in v1 (A20). It appears in the signature already so
   * that the query builder emits it and the non-regression test can be written, without
   * implementing anything.
   */
  readonly rowPredicate: 'TRUE'
}

export interface RequestContext {
  readonly [BRAND]: true
  readonly requestId: string
  readonly actor: Actor
  readonly tenantId: string
  readonly surface: Surface
  /** Frozen at creation: the kernel's ONLY source of time. */
  readonly timestamp: Date
  /** Instant beyond which no new statement is issued (§4.3). */
  readonly deadline: Date
  readonly permissions: PermissionSnapshot
  readonly schemaVersion: string | null
  readonly idempotencyKey: string | null
  readonly language: string
}

export interface ContextInput {
  readonly requestId: string
  readonly actor: Actor
  readonly tenantId: string
  readonly surface: Surface
  readonly timestamp: Date
  readonly deadline: Date
  readonly permissions: PermissionSnapshot
  readonly schemaVersion?: string | null
  readonly idempotencyKey?: string | null
  readonly language?: string
}

/**
 * The kernel's only context factory.
 *
 * It is NOT exported outside the package: the `identity` module calls it after checking
 * a credential against `_basedb.session` or `_basedb.api_token`, and it alone. This is
 * lock 3 of §2.4 — the adapter asserts no identity, it forwards a credential that the
 * kernel verifies.
 */
export function sealContext(input: ContextInput): RequestContext {
  // The brand is purely static: `declare const` does not exist at runtime, so the
  // object carries no trace of it. That is enough — the guarantee sought is that no
  // adapter can WRITE a literal satisfying `RequestContext`, and the compiler upholds
  // it.
  return Object.freeze({
    requestId: input.requestId,
    actor: Object.freeze({ ...input.actor }),
    tenantId: input.tenantId,
    surface: input.surface,
    timestamp: input.timestamp,
    deadline: input.deadline,
    permissions: Object.freeze({ ...input.permissions }),
    schemaVersion: input.schemaVersion ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    language: input.language ?? 'fr',
  }) as RequestContext
}

/**
 * Who acts, as a binding key — for a cursor, a cache entry, an idempotency claim.
 *
 * A token is an actor of its own, distinct from the person who created it: its rights
 * are narrower, and a cursor minted for one must not open for the other (08 §6.2).
 */
export function actorKey(ctx: RequestContext): string {
  return ctx.actor.tokenId === undefined ? ctx.actor.id : `${ctx.actor.id}:${ctx.actor.tokenId}`
}

/** True if the context's deadline has passed: no statement may be issued any more. */
export function deadlineExceeded(ctx: RequestContext, now: Date): boolean {
  return now.getTime() >= ctx.deadline.getTime()
}

/** Raises `DEADLINE_EXCEEDED` if the deadline has been crossed (§4.3). */
export function assertDeadline(ctx: RequestContext, now: Date): void {
  if (deadlineExceeded(ctx, now)) {
    throw new BasedbError('DEADLINE_EXCEEDED', {
      details: { requestId: ctx.requestId, deadline: ctx.deadline.toISOString() },
    })
  }
}

export type IsolationLevel = 'read committed' | 'repeatable read' | 'serializable'

export interface TransactionOptions {
  readonly isolation?: IsolationLevel
  readonly readOnly?: boolean
  /** Number of retries on a serialization error (§4.3). */
  readonly retries?: number
}

/**
 * Opens a transaction, propagates the actor through session variables, runs, commits.
 *
 * The actor and surface values are set as session variables BECAUSE THAT IS WHERE the
 * capture function reads them (chapter 07): without them, a write would be recorded in
 * history with no author.
 */
export async function withTransaction<T>(
  pools: Pools,
  pool: PoolName,
  ctx: RequestContext,
  work: (exec: Executor) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const maxAttempts = (options.retries ?? 2) + 1
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const client: PoolClient = await pools.acquire(pool)
    const exec = executorOf(client)
    try {
      const level = options.isolation ?? 'read committed'
      await exec.query(
        `BEGIN ISOLATION LEVEL ${level.toUpperCase()}${options.readOnly === true ? ' READ ONLY' : ''}`,
      )
      await setSessionContext(exec, ctx)
      const result = await work(exec)
      await exec.query('COMMIT')
      return result
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // The transaction was already broken: the original error takes precedence.
      }
      lastError = error
      const pg = (error as BasedbError).cause as { code?: string } | undefined
      const retryable = pg !== undefined && isRetryable(pg)
      if (!retryable || attempt === maxAttempts - 1) throw error
    } finally {
      client.release()
    }
  }

  throw lastError
}

/**
 * Session variables read by `_basedb_local.capture_v1()` (chapter 07).
 *
 * `set_config(..., true)` scopes them to the transaction: they disappear on COMMIT as
 * on ROLLBACK, and therefore cannot leak into the next request served by the same
 * pooled connection.
 */
async function setSessionContext(exec: Executor, ctx: RequestContext): Promise<void> {
  await exec.query(
    `SELECT set_config('basedb.actor_kind', $1, true),
            set_config('basedb.actor_id',   $2, true),
            set_config('basedb.surface',    $3, true),
            set_config('basedb.request_id', $4, true),
            set_config('basedb.token_id',   $5, true)`,
    // A token writes in its creator's name AND its own: the history says "Alice, through
    // the token Synchro", which is both who answers for it and which door it came by.
    [ctx.actor.kind, ctx.actor.id, ctx.surface, ctx.requestId, ctx.actor.tokenId ?? ''],
  )
}
