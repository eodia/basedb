import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import { loadSessionById } from './session.js'

/**
 * Demands a session ELEVATED minutes ago — chapter 05 §2.2.
 *
 * Every write on people, groups, permissions and integration tokens goes through here: a
 * session opened last week is not a proof that the person at the keyboard is its owner,
 * and a script injected into a page must not be able to hand itself a role. The session
 * is read from the catalog and must belong to the context's actor; the adapter only says
 * WHICH session the request came from, it asserts nothing about it.
 */
export async function requireElevatedSession(
  exec: Executor,
  ctx: RequestContext,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  // An integration token has no session to elevate, and administers nothing.
  if (ctx.actor.kind !== 'user') throw new BasedbError('RESOURCE_NOT_FOUND')
  const session = await loadSessionById(exec, sessionId)
  if (
    session === null ||
    session.userId !== ctx.actor.id ||
    session.revokedAt !== null ||
    session.elevatedUntil === null ||
    session.elevatedUntil.getTime() <= now.getTime()
  ) {
    throw new BasedbError('ELEVATION_REQUIRED')
  }
}
