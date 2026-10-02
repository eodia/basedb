import type { MailMessage, Mailer } from '../auth/operations.js'
import { type Address, composeMail, isAddress } from './message.js'
import { type SmtpConfig, sendSmtp } from './smtp.js'

/**
 * The operator's relay as the kernel's `Mailer`: one message, one recipient, composed here
 * and handed over by `smtp.ts`. The adapter builds it from `BASEDB_SMTP_*`.
 */

/** `basedb <no-reply@exemple.fr>` or a bare address, as an operator writes a sender. */
export function parseAddress(text: string): Address | null {
  const trimmed = text.trim()
  const bracketed = /^(.*)<([^<>]+)>$/.exec(trimmed)
  const address = (bracketed?.[2] ?? trimmed).trim()
  if (!isAddress(address)) return null
  const name = bracketed?.[1]?.trim().replace(/^"(.*)"$/, '$1') ?? ''
  return name === '' ? { address } : { address, name }
}

export function smtpMailer(config: SmtpConfig, from: Address): Mailer {
  const domain = from.address.slice(from.address.lastIndexOf('@') + 1)
  return async (message: MailMessage) => {
    const replyTo =
      message.replyTo !== undefined && isAddress(message.replyTo)
        ? { address: message.replyTo }
        : null
    const { data } = composeMail(
      {
        from,
        to: [message.to, ...(message.also ?? [])].map((address) => ({ address })),
        cc: (message.cc ?? []).map((address) => ({ address })),
        replyTo,
        subject: message.subject,
        text: message.body,
        html: message.html ?? null,
        automatic: message.automatic ?? false,
        attachments: message.attachments ?? [],
      },
      { at: new Date(), domain },
    )
    // Every mailbox the mail names, copies included, is a recipient of the envelope.
    const recipients = [message.to, ...(message.also ?? []), ...(message.cc ?? [])]
    await sendSmtp(config, { from: from.address, to: [...new Set(recipients)] }, data)
  }
}
