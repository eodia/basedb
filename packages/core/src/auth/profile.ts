import { type Locale, isLocale } from '@basedb/contracts'
import { checkName } from '../admin/users.js'
import { writeAudit } from '../audit/journal.js'
import { NOTIFICATION_KINDS, type NotificationKind } from '../collab/notifications.js'
import { BasedbError } from '../errors/index.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { requireElevatedSession } from './elevation.js'
import { mailTexts } from './mail-texts.js'
import { type Mailer, normalizeEmail } from './operations.js'

/**
 * One's own account — chapter 11 §10, chapter 13 §2.6: the name the others read, the
 * address one signs in with, and how the product reads for oneself.
 *
 * Nothing here needs a right: a person always acts on their own account, and on nothing
 * else. What changes how one SIGNS IN — the address — wants the password again, like
 * every door (chapter 05 §2.2); what changes how one READS does not.
 */

/** `dmy`: 25/09/2026, the default reading; `iso`: 2026-09-25. */
export type DateFormat = 'dmy' | 'iso'
/** The first day of a calendar week: 1 Monday, 0 Sunday. */
export type WeekStart = 0 | 1

export interface ProfileChange {
  readonly displayName?: unknown
  readonly dateFormat?: unknown
  readonly weekStart?: unknown
  readonly mutedNotifications?: unknown
  /** A language of `LOCALES`, or `null`: the browser's (chapter 11 §10). */
  readonly locale?: unknown
}

/** An integration token acts on a base, never on a person's account. */
function refuseTokenActor(ctx: RequestContext): void {
  if (ctx.actor.kind !== 'user') throw new BasedbError('RESOURCE_NOT_FOUND')
}

function checkDateFormat(value: unknown): DateFormat {
  if (value !== 'dmy' && value !== 'iso') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'date_format' } })
  }
  return value
}

function checkWeekStart(value: unknown): WeekStart {
  if (value !== 0 && value !== 1) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'week_start' } })
  }
  return value
}

/** A language basedb speaks, or `null` — the browser's, whatever it is. */
function checkLocale(value: unknown): Locale | null {
  if (value !== null && !isLocale(value)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'locale' } })
  }
  return value
}

/** A set of natures, each one known — an unknown one is refused, not dropped. */
function checkMuted(value: unknown): NotificationKind[] {
  const known = new Set<string>(NOTIFICATION_KINDS)
  if (!Array.isArray(value) || value.some((k) => typeof k !== 'string' || !known.has(k))) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'muted_notifications' } })
  }
  return NOTIFICATION_KINDS.filter((k) => value.includes(k))
}

/**
 * Renames oneself, and sets how the product reads — each field optional, none changed
 * unless given. The name is held to the rules an administrator's renaming follows.
 */
export async function updateProfile(
  pools: Pools,
  ctx: RequestContext,
  change: ProfileChange,
): Promise<void> {
  refuseTokenActor(ctx)
  const displayName = change.displayName === undefined ? null : checkName(change.displayName)
  const dateFormat = change.dateFormat === undefined ? null : checkDateFormat(change.dateFormat)
  const weekStart = change.weekStart === undefined ? null : checkWeekStart(change.weekStart)
  const muted =
    change.mutedNotifications === undefined ? null : checkMuted(change.mutedNotifications)
  // `null` is a value here — back to the browser's language —, so « given » is its own flag.
  const localeGiven = change.locale !== undefined
  const locale = localeGiven ? checkLocale(change.locale) : null
  if (
    displayName === null &&
    dateFormat === null &&
    weekStart === null &&
    muted === null &&
    !localeGiven
  ) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'display_name, date_format, week_start, muted_notifications, locale' },
    })
  }

  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await exec.query(
      `UPDATE _basedb.app_user u
          SET display_name = coalesce($3, u.display_name),
              date_format = coalesce($4, u.date_format),
              week_start = coalesce($5::smallint, u.week_start),
              muted_notifications = coalesce($6::text[], u.muted_notifications),
              locale = CASE WHEN $7 THEN $8::text ELSE u.locale END,
              updated_at = clock_timestamp(), updated_by = u.id
         FROM _basedb.tenant t
        WHERE u.id = $1 AND t.id = u.tenant_id AND t.ref = $2`,
      [ctx.actor.id, ctx.tenantId, displayName, dateFormat, weekStart, muted, localeGiven, locale],
      'update',
    )
  })
}

/**
 * Changes the address one signs in with — chapter 13 §2.6.
 *
 * The session must have proved the password minutes ago: whoever takes over an open
 * session and changes the address would otherwise steal the account through the next
 * password reset. An account with no password — one that signs in through a provider —
 * keeps the provider's address, which follows it at every sign-in (§3.5).
 *
 * The password identity is keyed on the address: it moves with it, in the same
 * transaction, or the password would stop working. A reset link still open was sent to
 * the old address, and dies. The old address is told, once the change is made, when a
 * mailer is configured: it is the one mailbox that can say "that was not me".
 *
 * Nothing proves the new address belongs to the caller. No mailbox is proved anywhere in
 * the product — a sign-up, an invitation, an administrator's creation — and this is not
 * the place to start: the address is a sign-in name and a reset target, and the one
 * person whose reset it redirects is the caller themself.
 */
export async function changeEmail(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly email: unknown
    readonly sessionId: string
    readonly mailer?: Mailer
    /** The caller's `Accept-Language`: the mail's language when the account has none. */
    readonly acceptLanguage?: string | null
  },
): Promise<{ readonly email: string }> {
  refuseTokenActor(ctx)
  const email = typeof request.email === 'string' ? request.email.normalize('NFC').trim() : ''
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'email' } })
  }

  const previous = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [user] = await exec.query<{
      email: string
      display_name: string
      tenant_id: string
      has_password: boolean
      locale: string | null
    }>(
      `SELECT u.email, u.display_name, u.tenant_id, u.locale,
              EXISTS (SELECT 1 FROM _basedb.auth_identity i
                       WHERE i.user_id = u.id AND i.provider = 'password') AS has_password
         FROM _basedb.app_user u
         JOIN _basedb.tenant t ON t.id = u.tenant_id
        WHERE u.id = $1 AND t.ref = $2`,
      [ctx.actor.id, ctx.tenantId],
    )
    if (user === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')
    // Asked before the elevation, which such an account could never obtain anyway: the
    // refusal then says why, instead of asking for a password that does not exist.
    if (!user.has_password) {
      throw new BasedbError('ACTION_FORBIDDEN', { details: { reason: 'adresse_du_fournisseur' } })
    }
    await requireElevatedSession(exec, ctx, request.sessionId)
    if (user.email === email) return null

    const taken = await exec.query<{ id: string }>(
      `SELECT u.id FROM _basedb.app_user u
        WHERE u.tenant_id = $1 AND lower(u.email) = lower($2)
          AND u.deleted_at IS NULL AND u.id <> $4
       UNION ALL
       SELECT i.user_id FROM _basedb.auth_identity i
        WHERE i.provider = 'password' AND i.subject = $3 AND i.user_id <> $4`,
      [user.tenant_id, email, normalizeEmail(email), ctx.actor.id],
    )
    if (taken.length > 0) throw new BasedbError('EMAIL_TAKEN', { details: { field: 'email' } })

    await exec.query(
      `UPDATE _basedb.app_user
          SET email = $2, updated_at = clock_timestamp(), updated_by = $1
        WHERE id = $1`,
      [ctx.actor.id, email],
      'update',
    )
    await exec.query(
      `UPDATE _basedb.auth_identity SET subject = $2
        WHERE user_id = $1 AND provider = 'password'`,
      [ctx.actor.id, normalizeEmail(email)],
      'update',
    )
    await exec.query(
      `UPDATE _basedb.confirmation_challenge SET consumed_at = clock_timestamp()
        WHERE actor_user_id = $1 AND operation = 'password.reset' AND consumed_at IS NULL`,
      [ctx.actor.id],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'user.email_change',
      objectKind: 'app_user',
      objectId: ctx.actor.id,
      objectName: user.display_name,
      payload: { previous: user.email, next: email },
    })
    return { address: user.email, locale: user.locale }
  })

  // Only a real change is announced, and a failed delivery does not undo it: the change
  // is made, and the journal holds it.
  if (previous !== null && normalizeEmail(previous.address) !== normalizeEmail(email)) {
    const texts = mailTexts(previous.locale, request.acceptLanguage)
    await request
      .mailer?.({
        to: previous.address,
        subject: texts.emailChangedSubject,
        body: texts.emailChanged(email),
      })
      .catch(() => undefined)
  }
  return { email }
}

/** One way in to an account: the password, or a provider's identity. */
export interface OwnIdentity {
  /** `password`, or the provider's slug. */
  readonly provider: string
  readonly createdAt: string
  readonly lastUsedAt: string | null
}

/** The ways the caller signs in — never a subject, never a hash. */
export async function listOwnIdentities(
  pools: Pools,
  userId: string,
): Promise<readonly OwnIdentity[]> {
  const rows = await pools.withConnection('catalog', (exec) =>
    exec.query<{ provider: string; created_at: Date; last_used_at: Date | null }>(
      `SELECT provider, created_at, last_used_at FROM _basedb.auth_identity
        WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    ),
  )
  return rows.map((r) => ({
    provider: r.provider === 'password' ? 'password' : r.provider.replace(/^oidc:/, ''),
    createdAt: new Date(r.created_at).toISOString(),
    lastUsedAt: r.last_used_at === null ? null : new Date(r.last_used_at).toISOString(),
  }))
}
