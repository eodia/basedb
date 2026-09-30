import { createHash } from 'node:crypto'
import { BasedbError } from '../errors/index.js'
import type { Pools } from '../runtime/pool.js'
import { authenticateAccessToken } from './operations.js'
import { decodeAccessToken } from './session.js'
import { verifyApiToken } from './tokens.js'

/**
 * Whether a token of basedb is good, and whose it is — for another application: token
 * introspection, RFC 7662 (chapter 13 §11).
 *
 * The tokens basedb issues are checked against its own key and its catalog; nothing outside
 * can verify them. An application that receives one — a chat opened from basedb, a gateway
 * in front of a service — asks here: `active`, and for whom. It proves who IT is with an
 * integration token of the same workspace; a token of another workspace, or none, and the
 * answer is a refusal, never a hint.
 *
 * Every token that is not good reads alike: `{ active: false }` — unknown, expired,
 * revoked, suspended, of another workspace. What `active` tells is read live: a session
 * closed a second ago is inactive now.
 */

export interface Introspection {
  readonly active: boolean
  /** `access_token`: a person's, from a session; `integration_token`: an application's. */
  readonly token_type?: 'access_token' | 'integration_token'
  /** The person — for an integration token, the one who created it. */
  readonly sub?: string
  readonly username?: string
  readonly email?: string
  readonly name?: string
  /** The workspace, as the API's addresses name it. */
  readonly tenant?: string
  /** The person's groups, by label — what an application maps its own roles from. */
  readonly groups?: readonly string[]
  /** Seconds since 1970, as RFC 7662 writes them; absent for a token that never expires. */
  readonly exp?: number
  readonly iat?: number
  /** For an integration token: the base it opens (its id), what it may do, its doors. */
  readonly base?: string | null
  readonly access?: 'read' | 'write'
  readonly surfaces?: readonly string[]
}

const INACTIVE: Introspection = Object.freeze({ active: false })
const INTEGRATION = /^bdb_[a-z0-9]{8}_[0-9A-Za-z]{43}$/

interface Person {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly tenant: string
  readonly groups: readonly string[]
}

async function personOf(pools: Pools, userId: string): Promise<Person | null> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{
      id: string
      email: string
      display_name: string | null
      tenant: string
      groups: string[]
    }>(
      `SELECT u.id::text, u.email, u.display_name, t.ref AS tenant,
              COALESCE(array_agg(r.label ORDER BY r.label) FILTER (WHERE r.id IS NOT NULL), '{}') AS groups
         FROM _basedb.app_user u
         JOIN _basedb.tenant t ON t.id = u.tenant_id
         LEFT JOIN _basedb.role_member m ON m.user_id = u.id
         LEFT JOIN _basedb.role r ON r.id = m.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
        WHERE u.id = $1 AND u.disabled_at IS NULL AND u.deleted_at IS NULL
        GROUP BY u.id, u.email, u.display_name, t.ref`,
      [userId],
    ),
  )
  const row = rows[0]
  return row === undefined
    ? null
    : {
        id: row.id,
        email: row.email,
        name: row.display_name ?? row.email,
        tenant: row.tenant,
        groups: row.groups,
      }
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000)

/** An integration token, read without a surface in mind: what it is, not where it is used. */
async function integrationToken(pools: Pools, secret: string, now: Date) {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{
      created_by: string
      base: string | null
      can_write: boolean
      allowed_surfaces: string[]
      created_at: Date
      expires_at: Date | null
    }>(
      `SELECT tk.created_by::text, tk.base_id::text AS base, tk.allowed_surfaces,
              tk.created_at, tk.expires_at,
              EXISTS (SELECT 1 FROM _basedb.permission p
                       WHERE p.role_id = tk.role_id AND p.action IN ('create', 'update')) AS can_write
         FROM _basedb.api_token tk
        WHERE tk.token_hash = $1
          AND tk.revoked_at IS NULL AND tk.suspended_at IS NULL
          AND (tk.expires_at IS NULL OR tk.expires_at > $2)`,
      [createHash('sha256').update(secret).digest(), now],
    ),
  )
  return rows[0] ?? null
}

/**
 * Introspects `token` for the application holding `caller` — an integration token of the
 * workspace. A caller that does not hold one is refused (`TOKEN_INVALID`, 401).
 */
export async function introspectToken(
  pools: Pools,
  instanceKey: string,
  request: {
    readonly caller: string | undefined
    readonly token: string | undefined
    readonly requestId?: string
    readonly ip?: string | null
  },
  now: Date = new Date(),
): Promise<Introspection> {
  const application = await verifyApiToken(pools, request.caller, 'rest', {
    ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
    ...(request.ip === undefined ? {} : { ip: request.ip }),
  })
  const token = request.token?.trim() ?? ''
  if (token === '') return INACTIVE

  if (INTEGRATION.test(token)) {
    const found = await integrationToken(pools, token, now)
    if (found === null) return INACTIVE
    const person = await personOf(pools, found.created_by)
    if (person === null || person.tenant !== application.tenantRef) return INACTIVE
    return {
      active: true,
      token_type: 'integration_token',
      sub: person.id,
      username: person.email,
      email: person.email,
      name: person.name,
      tenant: person.tenant,
      groups: person.groups,
      iat: seconds(found.created_at),
      ...(found.expires_at === null ? {} : { exp: seconds(found.expires_at) }),
      base: found.base,
      access: found.can_write ? 'write' : 'read',
      surfaces: found.allowed_surfaces,
    }
  }

  const claim = decodeAccessToken(token)
  if (claim === null) return INACTIVE
  let authenticated: Awaited<ReturnType<typeof authenticateAccessToken>>
  try {
    authenticated = await authenticateAccessToken(pools, instanceKey, token, now)
  } catch (error) {
    if (error instanceof BasedbError && error.code === 'AUTHENTICATION_REQUIRED') return INACTIVE
    throw error
  }
  if (authenticated.tenantRef !== application.tenantRef) return INACTIVE
  const person = await personOf(pools, authenticated.userId)
  if (person === null) return INACTIVE
  return {
    active: true,
    token_type: 'access_token',
    sub: person.id,
    username: person.email,
    email: person.email,
    name: person.name,
    tenant: person.tenant,
    groups: person.groups,
    exp: seconds(claim.expiresAt),
  }
}
