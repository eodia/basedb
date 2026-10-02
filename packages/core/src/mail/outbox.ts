import type { Mailer } from '../auth/operations.js'
import type { NotificationKind } from '../collab/notifications.js'
import type { FileStorage } from '../files/storage.js'
import type { Executor, Pools } from '../runtime/pool.js'
import type { MailFile } from './message.js'
import { notificationMailTexts } from './notification-texts.js'
import { SmtpError } from './smtp.js'

/**
 * The mail queue — chapter 16 §2.4, chapter 17 §1.3.
 *
 * `_basedb.mail_outbox` is filled by a trigger for a notification a person asked to get
 * by mail, and by the « Envoyer un courriel » step of an automation. A loop empties it:
 * the rows due are taken under a lease in a short transaction of their own — no
 * transaction stays open while a relay answers —, then sent.
 *
 * A person's notifications go as ONE mail, whatever their number: those still unread
 * when their ten minutes are up. One read in the meantime is dropped, silently: the mail
 * exists for what was missed. An automation's mail goes as its step rendered it.
 *
 * With no transport, nothing leaves: a notification mail is dropped, an automation's is
 * failed — the step itself refuses to queue one, so that should not happen.
 */

const BATCH = 100
/** A mail taken is out of the queue this long: a sender that dies mid-call gives it back. */
const LEASE = "interval '5 minutes'"
/** Minutes before each new attempt; after the last, the mail is failed. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 360]
/** The notifications a mail lists; the others are counted. */
const LISTED = 10
/** How long a sent or failed mail stays, for whoever looks into a delivery. */
export const MAIL_RETENTION_DAYS = 30

interface Due extends Record<string, unknown> {
  readonly id: string
  readonly origin: 'notification' | 'automation'
  readonly user_id: string | null
  readonly notification_id: string | null
  readonly recipient: string
  readonly reply_to: string | null
  readonly subject: string | null
  readonly body_text: string | null
  readonly body_html: string | null
  readonly also_to: string[] | null
  readonly cc: string[] | null
  readonly attachments: Attachment[] | null
  readonly attempts: number
}

/** A file an automation's mail attaches, by its key in the storage. */
interface Attachment {
  readonly key: string
  readonly name: string
  readonly type: string
  /** Made for this mail — a PDF —: removed once the mail is sent or given up. */
  readonly owned: boolean
}

export interface MailDelivery {
  /** The operator's transport; `undefined` when none is configured. */
  readonly mailer?: Mailer
  /** Where the interface is reached — what a link in a mail points at. */
  readonly publicUrl?: string | null
  /** Where the files an automation's mail attaches are kept. */
  readonly storage?: FileStorage
}

async function takeDue(pools: Pools): Promise<Due[]> {
  return pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    try {
      const due = await exec.query<Due>(
        `SELECT id::text, origin, user_id::text, notification_id::text, recipient, reply_to,
                subject, body_text, body_html, also_to, cc, attachments, attempts
           FROM _basedb.mail_outbox
          WHERE status = 'pending' AND not_before <= clock_timestamp()
          ORDER BY not_before
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [BATCH],
      )
      if (due.length > 0) {
        await exec.query(
          `UPDATE _basedb.mail_outbox
              SET attempts = attempts + 1, not_before = clock_timestamp() + ${LEASE}
            WHERE id = ANY($1::uuid[])`,
          [due.map((d) => d.id)],
          'update',
        )
      }
      await exec.query('COMMIT')
      return due.map((d) => ({ ...d, attempts: d.attempts + 1 }))
    } catch (error) {
      await exec.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  })
}

async function markSent(exec: Executor, ids: readonly string[]): Promise<void> {
  await exec.query(
    `UPDATE _basedb.mail_outbox SET status = 'sent', done_at = clock_timestamp(), last_error = NULL
      WHERE id = ANY($1::uuid[])`,
    [ids],
    'update',
  )
}

/** A refused send: retried later, or failed for good after the last attempt. */
async function markFailed(exec: Executor, rows: readonly Due[], error: unknown): Promise<void> {
  const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500)
  const final = error instanceof SmtpError && error.permanent
  for (const row of rows) {
    const wait = BACKOFF_MINUTES[row.attempts - 1]
    if (final || wait === undefined) {
      await exec.query(
        `UPDATE _basedb.mail_outbox
            SET status = 'failed', done_at = clock_timestamp(), last_error = $2
          WHERE id = $1`,
        [row.id, reason],
        'update',
      )
    } else {
      await exec.query(
        `UPDATE _basedb.mail_outbox
            SET not_before = clock_timestamp() + make_interval(mins => $2), last_error = $3
          WHERE id = $1`,
        [row.id, wait, reason],
        'update',
      )
    }
  }
}

const TENANT_PREFIX = /^b_t[23456789abcdefghijkmnpqrstuvwxyz]{6}_(?=.)/

/** The address of a row in the interface, as its address bar writes it. */
export function rowLink(publicUrl: string, base: string, table: string, record: string): string {
  const root = publicUrl.replace(/\/+$/, '')
  const baseWord = encodeURIComponent(base.replace(TENANT_PREFIX, ''))
  return `${root}/bases/${baseWord}/tables/${encodeURIComponent(table)}?ligne=${encodeURIComponent(record)}`
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

interface Item extends Record<string, unknown> {
  readonly id: string
  readonly kind: NotificationKind
  readonly read: boolean
  readonly excerpt: string
  readonly record_id: string
  readonly actor: string | null
  readonly table_label: string
  readonly table_name: string
  readonly base_name: string
}

/** The mail of one person's unread notifications: its subject, its text, its HTML. */
export function notificationMail(
  locale: string | null,
  recipient: { readonly name: string },
  items: readonly Item[],
  publicUrl: string | null,
): { readonly subject: string; readonly text: string; readonly html: string } {
  const t = notificationMailTexts(locale)
  const sentenceOf = (item: Item) =>
    t.sentence[item.kind](item.actor ?? t.someone, item.table_label)
  const listed = items.slice(0, LISTED)
  const subject = items.length === 1 ? sentenceOf(items[0] as Item) : t.several(items.length)
  const text: string[] = [t.greeting(recipient.name), '']
  const html: string[] = [`<p>${escapeHtml(t.greeting(recipient.name))}</p>`]
  for (const item of listed) {
    const link =
      publicUrl === null
        ? null
        : rowLink(publicUrl, item.base_name, item.table_name, item.record_id)
    text.push(sentenceOf(item))
    if (item.excerpt !== '') text.push(`  ${item.excerpt}`)
    if (link !== null) text.push(`  ${link}`)
    text.push('')
    html.push(
      `<p><strong>${escapeHtml(sentenceOf(item))}</strong>${
        item.excerpt === '' ? '' : `<br><em>${escapeHtml(item.excerpt)}</em>`
      }${link === null ? '' : `<br><a href="${escapeHtml(link)}">${escapeHtml(t.open)}</a>`}</p>`,
    )
  }
  if (items.length > listed.length) {
    text.push(t.more(items.length - listed.length), '')
    html.push(`<p>${escapeHtml(t.more(items.length - listed.length))}</p>`)
  }
  const settings =
    publicUrl === null ? null : `${publicUrl.replace(/\/+$/, '')}/parametres/notifications`
  text.push('—', t.why, settings === null ? t.settings : `${t.settings} ${settings}`)
  html.push(
    `<p style="color:#6b7280;font-size:12px">${escapeHtml(t.why)}<br>${
      settings === null
        ? escapeHtml(t.settings)
        : `<a href="${escapeHtml(settings)}" style="color:#6b7280">${escapeHtml(t.settings)}</a>`
    }</p>`,
  )
  return { subject, text: text.join('\n'), html: html.join('\n') }
}

/** One person's notification mails, due together: sent as one, or dropped. */
async function sendNotifications(
  exec: Executor,
  delivery: Required<Pick<MailDelivery, 'mailer'>> & MailDelivery,
  userId: string,
  rows: readonly Due[],
): Promise<number> {
  const [user] = await exec.query<{
    email: string
    display_name: string
    locale: string | null
    mailed: string[]
    gone: boolean
  }>(
    `SELECT email, display_name, locale, mailed_notifications AS mailed,
            (disabled_at IS NOT NULL OR deleted_at IS NOT NULL) AS gone
       FROM _basedb.app_user WHERE id = $1`,
    [userId],
  )
  const found = await exec.query<Item>(
    `SELECT n.id::text, n.kind, n.read_at IS NOT NULL AS read, n.excerpt, n.record_id::text,
            a.display_name AS actor, t.label AS table_label, tn.name AS table_name,
            sn.name AS base_name
       FROM _basedb.notification n
       LEFT JOIN _basedb.app_user a  ON a.id = n.actor_id
       JOIN _basedb.table_def t      ON t.id = n.table_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE n.id = ANY($1::uuid[])
      ORDER BY n.created_at`,
    [rows.map((r) => r.notification_id)],
  )
  const wanted = user !== undefined && !user.gone
  const items = found.filter((i) => wanted && !i.read && (user?.mailed ?? []).includes(i.kind))
  const kept = new Set(items.map((i) => i.id))
  const sent = rows.filter((r) => r.notification_id !== null && kept.has(r.notification_id))
  // Read since, no longer wanted, or no longer anyone's: nothing to say — and nothing kept.
  const dropped = rows.filter((r) => !sent.includes(r))
  if (dropped.length > 0) {
    await exec.query(
      'DELETE FROM _basedb.mail_outbox WHERE id = ANY($1::uuid[])',
      [dropped.map((r) => r.id)],
      'delete',
    )
  }
  if (items.length === 0 || user === undefined) return 0
  const mail = notificationMail(
    user.locale,
    { name: user.display_name },
    items,
    delivery.publicUrl ?? null,
  )
  try {
    await delivery.mailer({
      to: user.email,
      subject: mail.subject,
      body: mail.text,
      html: mail.html,
      automatic: true,
    })
  } catch (error) {
    await markFailed(exec, sent, error)
    return 0
  }
  await markSent(
    exec,
    sent.map((r) => r.id),
  )
  return 1
}

/** One pass: the mails due, sent. Resolves to the number of mails that left. */
export async function deliverMails(pools: Pools, delivery: MailDelivery): Promise<number> {
  const due = await takeDue(pools)
  if (due.length === 0) return 0
  return pools.withConnection('catalog', async (exec) => {
    const mailer = delivery.mailer
    if (mailer === undefined) {
      await exec.query(
        `DELETE FROM _basedb.mail_outbox WHERE id = ANY($1::uuid[]) AND origin = 'notification'`,
        [due.map((d) => d.id)],
        'delete',
      )
      await exec.query(
        `UPDATE _basedb.mail_outbox
            SET status = 'failed', done_at = clock_timestamp(), last_error = 'no_transport'
          WHERE id = ANY($1::uuid[]) AND origin = 'automation'`,
        [due.map((d) => d.id)],
        'update',
      )
      return 0
    }
    let sent = 0
    const byUser = new Map<string, Due[]>()
    for (const d of due) {
      if (d.origin !== 'notification' || d.user_id === null) continue
      byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d])
    }
    for (const [userId, rows] of byUser) {
      sent += await sendNotifications(exec, { ...delivery, mailer }, userId, rows)
    }
    for (const d of due) {
      if (d.origin !== 'automation') continue
      try {
        await mailer({
          to: d.recipient,
          subject: d.subject ?? '',
          body: d.body_text ?? '',
          ...(d.body_html === null ? {} : { html: d.body_html }),
          ...(d.reply_to === null ? {} : { replyTo: d.reply_to }),
          ...(d.also_to === null ? {} : { also: d.also_to }),
          ...(d.cc === null ? {} : { cc: d.cc }),
          ...(d.attachments === null
            ? {}
            : { attachments: await filesOf(delivery.storage, d.attachments) }),
          automatic: true,
        })
        await markSent(exec, [d.id])
        await release(delivery.storage, d)
        sent += 1
      } catch (error) {
        await markFailed(exec, [d], error)
        if (final(d, error)) await release(delivery.storage, d)
      }
    }
    return sent
  })
}

/** Whether a refusal was the last: given up, not tried again. */
const final = (row: Due, error: unknown) =>
  (error instanceof SmtpError && error.permanent) || BACKOFF_MINUTES[row.attempts - 1] === undefined

/** The bytes of the files a mail attaches, read from the storage. */
async function filesOf(
  storage: FileStorage | undefined,
  attachments: readonly Attachment[],
): Promise<MailFile[]> {
  if (storage === undefined) throw new SmtpError('no file storage for the attachments', 550)
  const out: MailFile[] = []
  for (const a of attachments) {
    const chunks: Uint8Array[] = []
    const reader = (await storage.get(a.key)).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    out.push({ name: a.name, type: a.type, bytes: Buffer.concat(chunks) })
  }
  return out
}

/** The files made for a mail — a PDF — go once it is sent or given up; a field's stay. */
async function release(storage: FileStorage | undefined, row: Due): Promise<void> {
  for (const a of row.attachments ?? []) {
    if (a.owned) await storage?.delete(a.key).catch(() => undefined)
  }
}

/** Sent and failed mails are kept a month, then forgotten. */
export async function purgeMails(exec: Executor): Promise<void> {
  await exec.query(
    `DELETE FROM _basedb.mail_outbox
      WHERE status IN ('sent', 'failed')
        AND done_at < clock_timestamp() - make_interval(days => $1)`,
    [MAIL_RETENTION_DAYS],
    'delete',
  )
}

/** The sender as a background loop: a pass every `intervalMs`, never two at once. */
export function startMailLoop(
  pools: Pools,
  delivery: MailDelivery,
  intervalMs: number,
  onError: (error: unknown) => void,
): () => void {
  let running = false
  let stopped = false
  const timer = setInterval(() => {
    if (running || stopped) return
    running = true
    deliverMails(pools, delivery)
      .catch(onError)
      .finally(() => {
        running = false
      })
  }, intervalMs)
  timer.unref?.()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
