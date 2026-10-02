/**
 * MCP over JSON-RPC 2.0 — the protocol vocabulary this entry point speaks, and nothing
 * else (chapter 09 §1.2, §15).
 */

/**
 * The MCP revisions this server speaks, newest first.
 *
 * Negotiation follows the MCP specification: a revision we speak is echoed; any other
 * well-formed one is answered with our newest, which the client then accepts or leaves.
 * Nothing degrades silently — the revision in force is the one stated in the answer. A
 * value that is not a revision at all is refused.
 */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const

export type ProtocolVersion = (typeof PROTOCOL_VERSIONS)[number]

export const LATEST_VERSION: ProtocolVersion = PROTOCOL_VERSIONS[0]

/** `serverInfo`: the product and its version, stated at the handshake (§15). */
export const SERVER_INFO = { name: 'basedb', title: 'basedb', version: '0.6.1' } as const

/** JSON-RPC error codes: the standard ones, and the implementation-defined band. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  /** Session, authentication, quota: refusals of the transport, not of a tool. */
  SERVER_ERROR: -32000,
  /** MCP's code for a resource that does not exist. */
  RESOURCE_NOT_FOUND: -32002,
} as const

export type JsonRpcId = string | number | null

export interface JsonRpcMessage {
  readonly jsonrpc?: unknown
  readonly id?: unknown
  readonly method?: unknown
  readonly params?: unknown
  readonly result?: unknown
  readonly error?: unknown
}

/** A request carries an id; a notification does not, and is never answered. */
export function isRequest(message: JsonRpcMessage): boolean {
  return (
    message.id !== undefined &&
    (typeof message.id === 'string' || typeof message.id === 'number') &&
    typeof message.method === 'string'
  )
}

export function isNotification(message: JsonRpcMessage): boolean {
  return message.id === undefined && typeof message.method === 'string'
}

export function result(id: JsonRpcId, value: unknown) {
  return { jsonrpc: '2.0' as const, id, result: value }
}

export function failure(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: '2.0' as const,
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  }
}

/** The revision to speak for a requested one, or `null` if the request is not a revision. */
export function negotiate(requested: unknown): ProtocolVersion | null {
  if (typeof requested !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) return null
  return (PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? (requested as ProtocolVersion)
    : LATEST_VERSION
}

/** `structuredContent` exists from the 2025-06-18 revision on. */
export function speaksStructuredContent(version: string): boolean {
  return version >= '2025-06-18'
}
