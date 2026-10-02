import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { writeAudit, writeSecurity } from '../audit/journal.js'
import { BasedbError } from '../errors/index.js'
import { type Action, type Target, decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import { loadBaseTarget } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, type Surface, withTransaction } from '../tx/context.js'
import { loadSessionById } from './session.js'

/**
 * Integration tokens — `_basedb.api_token`, chapter 05 §2.3, chapter 08 §11, chapter 09 §9.
 *
 * A token is an identity of its own, not a session: it carries ONE role, a base, the
 * surfaces it may be presented on, and an expiry — none by default. What it may do is
 * its role INTERSECTED with what its creator may do, recomputed at every decision — the
 * decider does that, from the grants `loadGrants` assembles for a token actor.
 *
 * The secret is shown once, at creation, and only its SHA-256 is kept. SHA-256 rather
 * than argon2id, deliberately: 256 bits of randomness are not guessed, and argon2id would
 * add a hundred milliseconds to every single call (08 §11.3).
 */

/**
 * 08 §11.3, revised: a token lives until it is REVOKED unless its creator gives it a
 * lifetime, and a lifetime given is at most a year.
 *
 * No expiry by default because what these tokens feed — an agent's configuration, a
 * sync job — breaks silently the day the token dies, and a token that dies on a schedule
 * nobody remembers is replaced by one pasted in a hurry. What keeps an eternal token in
 * check is elsewhere: it is bound to one base, it carries `delete` only when its creator
 * says so and never a `manage_*`, it is inert the moment its creator is disabled, its
 * last use is shown, and revocation is one click away.
 */
export const TOKEN_DEFAULT_DAYS: number | null = null
export const TOKEN_MAX_DAYS = 365

/** 09 §9.4: how long a verified token is believed without asking the catalog again. */
export const TOKEN_CACHE_MS = 5_000

/** 08 §11.5: `last_used_at` is written at most this often per token. */
const USAGE_THROTTLE_MS = 5 * 60_000

/** `bdb_<prefix8>_<43 base62>` — the prefix is what secret scanners recognize. */
const TOKEN_PATTERN = /^bdb_([a-z0-9]{8})_([0-9A-Za-z]{43})$/

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const PREFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/**
 * What a token lets its bearer do on the data of its base: read; read and write; or read,
 * write and delete — a deleted row is restored from the history.
 */
export type TokenAccess = 'read' | 'write' | 'delete'

/** The verbs of a token's role — `delete` only when asked, never a `manage_*` (05 §2.3). */
const ACTIONS_OF: Readonly<Record<TokenAccess, readonly Action[]>> = {
  read: ['read'],
  write: ['read', 'create', 'update'],
  delete: ['read', 'create', 'update', 'delete'],
}

export interface CreateApiTokenRequest {
  /** What the token is FOR — the screen asks "à quoi sert ce jeton ?" (06 §4). */
  readonly label: string
  readonly baseId: string
  readonly access: TokenAccess
  readonly surfaces: readonly Surface[]
  /** A lifetime in days, 1 to 365 — or none, absent or `null`: the token lives until revoked. */
  readonly expiresInDays?: number | null
  /** The session the request comes from: token creation demands a recent elevation. */
  readonly sessionId: string
}

export interface ApiTokenSummary {
  readonly id: string
  readonly label: string
  /** The eight characters after `bdb_`, enough to recognize a token without holding it. */
  readonly prefix: string
  readonly baseId: string | null
  readonly access: TokenAccess
  readonly surfaces: readonly Surface[]
  readonly createdAt: string
  /** `null`: no expiry — the token lives until it is revoked. */
  readonly expiresAt: string | null
  readonly lastUsedAt: string | null
  readonly revokedAt: string | null
  readonly suspendedAt: string | null
  readonly createdBy: string
}

export interface IssuedApiToken extends ApiTokenSummary {
  /** The secret, in full. Returned by this call and never again. */
  readonly secret: string
}

/** A verified token: who acts through it, and within what. */
export interface VerifiedToken {
  readonly tokenId: string
  readonly userId: string
  readonly tenantRef: string
  readonly baseId: string | null
  readonly expiresAt: Date | null
}

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest()

/** 256 bits written in base 62: 43 characters, left-padded. */
function base62(bytes: Buffer): string {
  let n = BigInt(`0x${bytes.toString('hex')}`)
  let out = ''
  while (n > 0n) {
    out = BASE62[Number(n % 62n)] + out
    n /= 62n
  }
  return out.padStart(43, '0')
}

function newSecret(): { secret: string; prefix: string } {
  let prefix = ''
  for (let i = 0; i < 8; i++) prefix += PREFIX_ALPHABET[randomInt(PREFIX_ALPHABET.length)]
  return { secret: `bdb_${prefix}_${base62(randomBytes(32))}`, prefix }
}

/**
 * The base a token is scoped to, as a decision target — with its project: « Gestion »
 * is most often given on a project, and covers its bases (chapter 05 §15).
 */
async function baseTarget(exec: Executor, ctx: RequestContext, baseId: string): Promise<Target> {
  const target = await loadBaseTarget(exec, ctx, baseId)
  if (target === null) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  }
  return target
}

/**
 * The integration administration is a SESSION's business — a token asking to mint,
 * list or revoke tokens gets the answer of an absent route (08 §11.1): a compromised
 * token would otherwise rotate itself forever and outlive its own revocation.
 */
function refuseTokenActor(ctx: RequestContext): void {
  if (ctx.actor.kind !== 'user') throw new BasedbError('RESOURCE_NOT_FOUND')
}

/** `manage_tokens` on the base, or the base does not exist for this caller. */
async function requireManageTokens(
  exec: Executor,
  ctx: RequestContext,
  target: Target,
): Promise<Awaited<ReturnType<typeof loadGrants>>> {
  const grants = await loadGrants(exec, ctx)
  const decision = decide(ctx, grants, 'manage_tokens', target)
  if (decision.verdict === 'INVISIBLE') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: target.id } })
  }
  if (decision.verdict === 'FORBIDDEN') {
    throw new BasedbError('ADMIN_REQUIRED', { details: { action: 'manage_tokens' } })
  }
  return grants
}

function summaryOf(row: TokenRow): ApiTokenSummary {
  return {
    id: row.id,
    label: row.label,
    prefix: row.token_prefix,
    baseId: row.base_id,
    access: row.can_delete ? 'delete' : row.can_write ? 'write' : 'read',
    surfaces: row.allowed_surfaces,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at === null ? null : new Date(row.expires_at).toISOString(),
    lastUsedAt: row.last_used_at === null ? null : new Date(row.last_used_at).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at).toISOString(),
    suspendedAt: row.suspended_at === null ? null : new Date(row.suspended_at).toISOString(),
    createdBy: row.created_by,
  }
}

interface TokenRow extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly token_prefix: string
  readonly base_id: string | null
  readonly allowed_surfaces: Surface[]
  readonly created_at: string | Date
  readonly expires_at: string | Date | null
  readonly last_used_at: string | Date | null
  readonly revoked_at: string | Date | null
  readonly suspended_at: string | Date | null
  readonly created_by: string
  readonly can_write: boolean
  readonly can_delete: boolean
}

const SUMMARY_COLUMNS = `tk.id, tk.label, tk.token_prefix, tk.base_id, tk.allowed_surfaces,
       tk.created_at, tk.expires_at, tk.last_used_at, tk.revoked_at, tk.suspended_at,
       tk.created_by,
       EXISTS (SELECT 1 FROM _basedb.permission p
                WHERE p.role_id = tk.role_id AND p.action IN ('create', 'update')) AS can_write,
       EXISTS (SELECT 1 FROM _basedb.permission p
                WHERE p.role_id = tk.role_id AND p.action = 'delete') AS can_delete`

/**
 * Mints a token — chapter 08 §11, chapter 05 §2.3.
 *
 * Four refusals before anything is written: a token cannot mint a token; the session
 * must have been elevated minutes ago; the caller must hold `manage_tokens` on the base;
 * and every verb the token's role will carry must be one the caller holds there
 * (non-escalation). The role is the token's own, scoped to its base, and carries
 * `read`, plus `create` and `update` for a writing token, plus `delete` for one that
 * deletes — never a `manage_*`.
 */
export async function createApiToken(
  pools: Pools,
  ctx: RequestContext,
  request: CreateApiTokenRequest,
  now: Date = new Date(),
): Promise<IssuedApiToken> {
  refuseTokenActor(ctx)

  const label = typeof request.label === 'string' ? request.label.normalize('NFC').trim() : ''
  if (label === '') throw new BasedbError('LABEL_EMPTY')
  if ([...label].length > 200) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: 200 } })
  }
  if (!Object.hasOwn(ACTIONS_OF, request.access)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'access' } })
  }
  const surfaces = [...new Set(request.surfaces)]
  if (surfaces.length === 0 || surfaces.some((s) => s !== 'rest' && s !== 'mcp')) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'surfaces' } })
  }
  // `null` is "no expiry"; a lifetime that is given is held to its bounds.
  const days = request.expiresInDays ?? TOKEN_DEFAULT_DAYS
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > TOKEN_MAX_DAYS)) {
    throw new BasedbError('TOKEN_EXPIRY_REQUIRED', { details: { maximum_days: TOKEN_MAX_DAYS } })
  }

  const issued = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    // A recent proof of the password, on THIS actor's session (05 §2.2): a script
    // injected into a page must not be able to mint a door out of the instance.
    const session = await loadSessionById(exec, request.sessionId)
    if (
      session === null ||
      session.userId !== ctx.actor.id ||
      session.revokedAt !== null ||
      session.elevatedUntil === null ||
      session.elevatedUntil.getTime() <= now.getTime()
    ) {
      throw new BasedbError('ELEVATION_REQUIRED')
    }

    const target = await baseTarget(exec, ctx, request.baseId)
    const grants = await requireManageTokens(exec, ctx, target)

    // Non-escalation: nothing the caller does not hold, at the scope the token will use.
    const actions = ACTIONS_OF[request.access]
    const missing = actions.filter((a) => decide(ctx, grants, a, target).verdict !== 'ALLOWED')
    if (missing.length > 0) {
      throw new BasedbError('ROLE_NOT_DELEGABLE', { details: { missing } })
    }

    const { secret, prefix } = newSecret()
    const [tenant] = await exec.query<{ id: string }>(
      'SELECT id FROM _basedb.tenant WHERE ref = $1',
      [ctx.tenantId],
    )

    const roleLabel = `Jeton d'intégration ${prefix}`
    // `kind = 'token'`: the token's own role, never a group — without it the role would
    // show among the groups of the administration, and its level could be changed there.
    const [role] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, kind, created_by)
       VALUES ($1, $2, lower($2), $3, 'token', $4) RETURNING id`,
      [tenant.id, roleLabel, `jeton_${prefix}`, ctx.actor.id],
      'insert',
    )
    for (const action of actions) {
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
         VALUES ($1, 'base', $2, $3, $4)`,
        [role.id, target.id, action, ctx.actor.id],
        'insert',
      )
    }

    const [row] = await exec.query<TokenRow>(
      `WITH inserted AS (
         INSERT INTO _basedb.api_token
           (tenant_id, label, token_prefix, token_hash, role_id, base_id, allowed_surfaces,
            expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::text[],
                 clock_timestamp() + make_interval(days => $8::int), $9)
         -- A NULL lifetime makes the sum NULL: no expiry, spelled by the column itself.
         RETURNING *)
       SELECT ${SUMMARY_COLUMNS} FROM inserted tk`,
      [tenant.id, label, prefix, sha256(secret), role.id, target.id, surfaces, days, ctx.actor.id],
      'insert',
    )

    // A token opens a door with a role's rights: its creation must be loud (05 §2.2).
    await writeAudit(exec, ctx, {
      action: 'token.create',
      objectKind: 'api_token',
      objectId: row.id,
      objectName: label,
      baseId: target.id,
      payload: { prefix, access: request.access, surfaces, expires_in_days: days },
    })

    return { ...summaryOf(row), access: request.access, secret }
  })

  return issued
}

/** The tenant's tokens the caller administers — metadata only, never a secret. */
export async function listApiTokens(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<readonly ApiTokenSummary[]> {
  refuseTokenActor(ctx)
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const target = await baseTarget(exec, ctx, request.baseId)
      await requireManageTokens(exec, ctx, target)
      const rows = await exec.query<TokenRow>(
        `SELECT ${SUMMARY_COLUMNS}
           FROM _basedb.api_token tk
          WHERE tk.base_id = $1
          ORDER BY tk.created_at DESC`,
        [target.id],
      )
      return rows.map(summaryOf)
    },
    { readOnly: true },
  )
}

/** A token of one's own, with the base it opens — the settings list them all at once. */
export interface OwnApiToken extends ApiTokenSummary {
  /** `null` once the base is deleted: the token opens nothing any more. */
  readonly base: {
    readonly name: string
    readonly label: string
    readonly environment: string
    readonly production: boolean
  } | null
}

/**
 * The tokens the caller minted, on every base — chapter 11 §10.
 *
 * Where a base's list answers "who opened this base", this one answers "which doors did
 * I open", which is the question a person asks when a laptop is lost. No right is needed
 * beyond being their creator: the list names only doors the caller made, and never a
 * secret. The live ones first, then the dead, newest first in each.
 */
export async function listOwnApiTokens(
  pools: Pools,
  ctx: RequestContext,
): Promise<readonly OwnApiToken[]> {
  refuseTokenActor(ctx)
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const rows = await exec.query<
        TokenRow & {
          base_name: string | null
          base_label: string | null
          environment: string | null
          is_production: boolean | null
        }
      >(
        `SELECT ${SUMMARY_COLUMNS},
                sn.name AS base_name, b.label AS base_label,
                b.environment, b.is_production
           FROM _basedb.api_token tk
           JOIN _basedb.tenant t ON t.id = tk.tenant_id
           LEFT JOIN _basedb.base b
                  ON b.id = tk.base_id AND b.is_live AND b.deleted_at IS NULL
           LEFT JOIN _basedb.db_schema s
                  ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
           LEFT JOIN _basedb.physical_name sn ON sn.id = s.name_id
          WHERE tk.created_by = $1 AND t.ref = $2
          ORDER BY (tk.revoked_at IS NULL
                    AND (tk.expires_at IS NULL OR tk.expires_at > clock_timestamp())) DESC,
                   tk.created_at DESC`,
        [ctx.actor.id, ctx.tenantId],
      )
      return rows.map((row) => ({
        ...summaryOf(row),
        base:
          row.base_name === null || row.base_label === null
            ? null
            : {
                name: row.base_name,
                label: row.base_label,
                environment: row.environment ?? 'Production',
                production: row.is_production !== false,
              },
      }))
    },
    { readOnly: true },
  )
}

/**
 * Revokes a token — at once, and for good (08 §11.4).
 *
 * Whoever holds `manage_tokens` on its base may, and so may its creator, always: closing
 * a door one opened takes nothing away from anyone, and a creator who has since lost the
 * right — or whose base is gone — must not be left holding a door they cannot shut.
 *
 * The write moves `authz_version`, which empties every cached snapshot, and the token
 * cache of this process is dropped here; another process believes the token for at most
 * `TOKEN_CACHE_MS` more.
 */
export async function revokeApiToken(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tokenId: string; readonly sessionId: string },
  now: Date = new Date(),
): Promise<void> {
  refuseTokenActor(ctx)
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const session = await loadSessionById(exec, request.sessionId)
    if (
      session === null ||
      session.userId !== ctx.actor.id ||
      session.elevatedUntil === null ||
      session.elevatedUntil.getTime() <= now.getTime()
    ) {
      throw new BasedbError('ELEVATION_REQUIRED')
    }

    const tokens = await exec.query<{
      id: string
      base_id: string | null
      label: string
      created_by: string
    }>(
      `SELECT tk.id, tk.base_id, tk.label, tk.created_by
         FROM _basedb.api_token tk
         JOIN _basedb.tenant t ON t.id = tk.tenant_id
        WHERE tk.id::text = $1 AND t.ref = $2`,
      [request.tokenId, ctx.tenantId],
    )
    const token = tokens[0]
    if (token === undefined || token.base_id === null) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { token: request.tokenId } })
    }
    if (token.created_by !== ctx.actor.id) {
      await requireManageTokens(exec, ctx, await baseTarget(exec, ctx, token.base_id))
    }

    await exec.query(
      `UPDATE _basedb.api_token
          SET revoked_at = coalesce(revoked_at, clock_timestamp()),
              revoked_by = coalesce(revoked_by, $2)
        WHERE id = $1`,
      [token.id, ctx.actor.id],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'token.revoke',
      objectKind: 'api_token',
      objectId: token.id,
      objectName: token.label,
      baseId: token.base_id,
    })
  })
  verified.clear()
}

/** Tokens believed for a few seconds, keyed by the hash of their secret. */
const verified = new Map<string, { readonly token: VerifiedToken; readonly at: number }>()
/** When each token last had its `last_used_at` written. */
const touched = new Map<string, number>()

/** For the tests, and after a revocation. */
export function forgetVerifiedTokens(): void {
  verified.clear()
  touched.clear()
}

/**
 * Believes a presented token for one surface — or refuses it with the code that names
 * why (05 §3.2 step 4): unknown, or not allowed here → `TOKEN_INVALID`; expired →
 * `TOKEN_EXPIRED`; revoked → `TOKEN_REVOKED`; suspended → `TOKEN_SUSPENDED`.
 *
 * Revalidated at every message of an agent session, with a cache of five seconds at
 * most (09 §9.4): a session lives for hours, and without this the mandatory expiry and
 * the revocation would mean nothing to it.
 */
export async function verifyApiToken(
  pools: Pools,
  secret: string | undefined,
  surface: Surface,
  meta: { readonly requestId?: string; readonly ip?: string | null } = {},
  now: Date = new Date(),
): Promise<VerifiedToken> {
  if (secret === undefined || !TOKEN_PATTERN.test(secret)) {
    throw new BasedbError('TOKEN_INVALID')
  }
  const hash = sha256(secret)
  const key = `${surface}|${hash.toString('hex')}`

  const cached = verified.get(key)
  if (
    cached !== undefined &&
    now.getTime() - cached.at < TOKEN_CACHE_MS &&
    (cached.token.expiresAt === null || cached.token.expiresAt.getTime() > now.getTime())
  ) {
    return cached.token
  }
  verified.delete(key)

  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{
      id: string
      created_by: string
      base_id: string | null
      allowed_surfaces: Surface[]
      expires_at: Date | null
      revoked_at: Date | null
      suspended_at: Date | null
      token_hash: Buffer
      tenant_ref: string
      creator_usable: boolean
    }>(
      `SELECT tk.id, tk.created_by, tk.base_id, tk.allowed_surfaces, tk.expires_at,
              tk.revoked_at, tk.suspended_at, tk.token_hash, t.ref AS tenant_ref,
              (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS creator_usable
         FROM _basedb.api_token tk
         JOIN _basedb.tenant t   ON t.id = tk.tenant_id
         JOIN _basedb.app_user u ON u.id = tk.created_by
        WHERE tk.token_hash = $1`,
      [hash],
    ),
  )

  const row = rows[0]
  const refuse = async (
    code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_REVOKED' | 'TOKEN_SUSPENDED',
  ) => {
    // Every refusal of a KNOWN token is a security event: it is the drain that reads
    // them, after the fact, to alert or suspend (09 §6.4, §13.3).
    if (row !== undefined) {
      await pools
        .withConnection('catalog', (exec) =>
          writeSecurity(exec, {
            tokenId: row.id,
            route: `/${surface}`,
            errorCode: code,
            requestId: meta.requestId,
            ip: meta.ip,
          }),
        )
        .catch(() => undefined)
    }
    throw new BasedbError(code)
  }

  if (row === undefined || !timingSafeEqual(row.token_hash, hash)) return refuse('TOKEN_INVALID')
  // A token presented on a surface it was not issued for is not "less authorized": it
  // is unknown here (05 §1.2).
  if (!row.allowed_surfaces.includes(surface)) return refuse('TOKEN_INVALID')
  if (row.revoked_at !== null) return refuse('TOKEN_REVOKED')
  // No expiry is `NULL`, never a date: `new Date(null)` would be 1970, and expired.
  if (row.expires_at !== null && new Date(row.expires_at).getTime() <= now.getTime()) {
    return refuse('TOKEN_EXPIRED')
  }
  if (row.suspended_at !== null) return refuse('TOKEN_SUSPENDED')
  // A creator disabled or deleted leaves the token inert, with no action on the token.
  if (!row.creator_usable) return refuse('TOKEN_INVALID')

  const token: VerifiedToken = {
    tokenId: row.id,
    userId: row.created_by,
    tenantRef: row.tenant_ref,
    baseId: row.base_id,
    expiresAt: row.expires_at === null ? null : new Date(row.expires_at),
  }
  verified.set(key, { token, at: now.getTime() })

  // `last_used_at`: at most once every five minutes, outside the request's work, and a
  // failure costs nothing but the timestamp (08 §11.5).
  const last = touched.get(row.id) ?? 0
  if (now.getTime() - last >= USAGE_THROTTLE_MS) {
    touched.set(row.id, now.getTime())
    void pools
      .withConnection('catalog', (exec) =>
        exec.query(
          'UPDATE _basedb.api_token SET last_used_at = clock_timestamp() WHERE id = $1',
          [row.id],
          'update',
        ),
      )
      .catch(() => undefined)
  }

  return token
}
