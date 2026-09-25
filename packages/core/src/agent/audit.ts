import { createHmac } from 'node:crypto'
import { writeAudit, writeSecurity } from '../audit/journal.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * One audit line per agent call — chapter 09 §13.
 *
 * Reads included, unlike REST: an agent's read is an operating fact in itself — volume,
 * hours, scope — and the trace of reference when exfiltration is suspected.
 *
 * The parameters of a call CONTAIN DATA — a filter on an e-mail address, a value handed
 * to `lookup_records`. Logging them would turn the audit into a second store of personal
 * data, with another retention and other readers. So the SHAPE is logged, never the
 * content: field names and operators as they were asked, each value replaced by a
 * truncated keyed digest that correlates two calls carrying the same value without ever
 * restoring it. The values of a write are not logged at all: before and after live in
 * the history, which already carries author and date.
 */

export interface AgentCall {
  readonly tool: string
  readonly sessionId: string | null
  /** `clientInfo` as declared at `initialize` — logged with `verified: false`, trusted by nothing. */
  readonly client: { readonly name?: unknown; readonly version?: unknown } | null
  readonly params: Readonly<Record<string, unknown>>
  /** `null` for a success, the registry code otherwise. */
  readonly outcome: string | null
  readonly returned?: number
  readonly truncated?: boolean
  readonly objectKind: string
  readonly objectId?: string | null
  readonly objectName?: string | null
  readonly baseId?: string | null
  readonly tableId?: string | null
}

/** The codes that say something about the existence of an object, or refuse an act. */
const SECURITY_OUTCOMES: ReadonlySet<string> = new Set([
  'RESOURCE_NOT_FOUND',
  'FIELD_UNKNOWN',
  'PERMISSION_DENIED',
  'TOKEN_READ_ONLY',
  'FIELD_NOT_WRITABLE',
  'LINK_TARGET_NOT_FOUND',
  'MCP_OPERATION_EXCLUDED',
  'QUOTA_EXCEEDED',
])

const bounded = (value: unknown, max = 128): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined

/** The shape of a call's parameters, and nothing of their values. */
export function paramsShape(
  params: Readonly<Record<string, unknown>>,
  digest: (value: unknown) => string,
): Record<string, unknown> {
  const names = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((v) => typeof v === 'string').map((v) => bounded(v))
      : undefined

  const shape: Record<string, unknown> = {}
  for (const key of ['base', 'table']) {
    const v = bounded(params[key])
    if (v !== undefined) shape[key] = v
  }
  if (typeof params._id === 'string') shape._id = bounded(params._id, 64)
  for (const key of ['select', 'sort', 'expand', 'expand_fields', 'full_fields']) {
    const v = names(params[key])
    if (v !== undefined) shape[key] = v
  }
  if (typeof params.limit === 'number') shape.limit = params.limit
  if (params.cursor !== undefined) shape.cursor = true
  if (params.include_count !== undefined) shape.include_count = params.include_count === true
  if (params.idempotency_key !== undefined) shape.idempotency_key = true

  const filter = params.filter
  if (filter !== null && typeof filter === 'object' && !Array.isArray(filter)) {
    shape.filter = Object.entries(filter as Record<string, unknown>).map(([field, p]) => {
      const predicate = (p ?? {}) as { op?: unknown; value?: unknown }
      return {
        field: bounded(field),
        op: bounded(predicate.op, 16),
        ...(predicate.value === undefined ? {} : { value_digest: digest(predicate.value) }),
      }
    })
  }
  // `lookup_records.value`: its digest, and only that (§5.3 rule 4).
  if (params.value !== undefined) shape.value_digest = digest(params.value)
  // The values of a write: which fields, never what was written.
  const values = params.values
  if (values !== null && typeof values === 'object' && !Array.isArray(values)) {
    shape.values = Object.keys(values).map((k) => bounded(k))
  }
  return shape
}

/** `h:` and eight hex digits of an HMAC under the instance key (A25). */
export function valueDigest(instanceKey: string, value: unknown): string {
  return `h:${createHmac('sha256', instanceKey)
    .update(JSON.stringify(value ?? null))
    .digest('hex')
    .slice(0, 8)}`
}

/**
 * Writes the audit line of one call, and a security line when the call was refused or
 * told something about the existence of an object.
 *
 * `surface` is the context's, sealed by the entry point: never a header, never a
 * parameter.
 */
export async function recordAgentCall(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  call: AgentCall,
): Promise<void> {
  await pools.withConnection('catalog', async (exec) => {
    await writeAudit(exec, ctx, {
      action: `mcp.${call.tool}`,
      objectKind: call.objectKind,
      objectId: call.objectId ?? null,
      objectName: call.objectName ?? null,
      baseId: call.baseId ?? null,
      tableId: call.tableId ?? null,
      payload: {
        mcp: {
          tool: call.tool,
          session_id: call.sessionId,
          client: {
            name: bounded(call.client?.name) ?? null,
            version: bounded(call.client?.version, 64) ?? null,
            verified: false,
          },
          params_shape: paramsShape(call.params, (v) => valueDigest(instanceKey, v)),
          outcome: call.outcome ?? 'ok',
          ...(call.returned === undefined ? {} : { returned: call.returned }),
          ...(call.truncated === undefined ? {} : { truncated: call.truncated }),
        },
      },
    })

    if (call.outcome !== null && SECURITY_OUTCOMES.has(call.outcome)) {
      await writeSecurity(exec, {
        tokenId: ctx.actor.kind === 'token' ? (ctx.actor.tokenId ?? null) : null,
        userId: ctx.actor.kind === 'token' ? null : ctx.actor.id,
        route: `/mcp/${call.tool}`,
        errorCode: call.outcome,
        requestId: ctx.requestId,
      })
    }
  })
}
