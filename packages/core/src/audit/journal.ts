import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * The two journals an operation writes to — `_basedb.audit_log` and
 * `_basedb.security_log` (chapter 02, chapter 08 §14.1, chapter 09 §13).
 *
 * Both are partitioned by month and carry no foreign key: they must outlive the actor
 * they name. Neither ever holds a cell value: the audit keeps the SHAPE of what was
 * asked, and history (`record_revision`) keeps the values.
 */

export interface AuditEntry {
  readonly action: string
  readonly objectKind: string
  readonly objectId?: string | null
  /** The object's name at the time of the act — a snapshot, not a reference. */
  readonly objectName?: string | null
  readonly baseId?: string | null
  readonly tableId?: string | null
  readonly payload?: Readonly<Record<string, unknown>>
}

/** A request identifier the journal can hold: `request_id` is a `uuid` column. */
function requestIdOf(ctx: RequestContext): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ctx.requestId)
    ? ctx.requestId
    : null
}

/**
 * One `audit_log` row, attributed to the context's actor and surface.
 *
 * `surface` comes from the context, which the entry point sealed itself: it is never
 * read from a header or a parameter (09 §13.1).
 */
export async function writeAudit(
  exec: Executor,
  ctx: RequestContext,
  entry: AuditEntry,
): Promise<void> {
  const token = ctx.actor.kind === 'token' ? (ctx.actor.tokenId ?? null) : null
  await exec.query(
    `INSERT INTO _basedb.audit_log
       (tenant_id, base_id, table_id, actor_kind, actor_user_id, actor_token_id, surface,
        action, object_kind, object_id, object_name, payload, request_id)
     SELECT t.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       FROM _basedb.tenant t
      WHERE t.ref = $1`,
    [
      ctx.tenantId,
      entry.baseId ?? null,
      entry.tableId ?? null,
      ctx.actor.kind,
      ctx.actor.id,
      token,
      ctx.surface,
      entry.action,
      entry.objectKind,
      entry.objectId ?? null,
      entry.objectName ?? null,
      JSON.stringify(entry.payload ?? {}),
      requestIdOf(ctx),
    ],
    'insert',
  )
}

/**
 * One `security_log` row: a refusal, or a response that tells something about the
 * existence of an object. It is from this journal, read after the fact by the drain,
 * that a token is suspended (09 §6.4) — never from a counter kept on the request path.
 */
export async function writeSecurity(
  exec: Executor,
  entry: {
    readonly tokenId?: string | null
    readonly userId?: string | null
    readonly route: string
    readonly errorCode: string
    readonly requestId?: string | null
    readonly ip?: string | null
  },
): Promise<void> {
  const kind = entry.tokenId ? 'token' : entry.userId ? 'user' : 'anonymous'
  if (kind === 'anonymous' && !entry.ip) return
  await exec.query(
    `INSERT INTO _basedb.security_log
       (actor_kind, actor_user_id, actor_token_id, ip, route, error_code, request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      kind,
      kind === 'user' ? entry.userId : null,
      kind === 'token' ? entry.tokenId : null,
      entry.ip ?? null,
      // The route alone, never a query string: that is where filters and cursors travel.
      entry.route.split('?')[0],
      entry.errorCode,
      entry.requestId !== undefined &&
      entry.requestId !== null &&
      /^[0-9a-f-]{36}$/i.test(entry.requestId)
        ? entry.requestId
        : null,
    ],
    'insert',
  )
}
