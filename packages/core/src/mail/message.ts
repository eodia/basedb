import { randomBytes } from 'node:crypto'

/**
 * A mail as it leaves — RFC 5322 headers, a MIME body (RFC 2045–2047), CRLF line ends.
 *
 * Every part is UTF-8 in base64: no line of it can start with a dot or run past 76
 * characters, whatever the text, so nothing a person wrote can be read by a server as the
 * end of the message or as a header. Headers are the one place a text reaches the wire as
 * itself, which is why every header value is refused if it holds a line break: a subject
 * that could carry one could carry a `Bcc:` too.
 */

export interface Address {
  readonly address: string
  readonly name?: string | null
}

export interface OutgoingMail {
  readonly from: Address
  readonly to: readonly Address[]
  readonly replyTo?: Address | null
  readonly subject: string
  /** The plain text: what every client can show. */
  readonly text: string
  /** The same, laid out — shown by the clients that can. */
  readonly html?: string | null
  /** Written by a machine, not a person (RFC 3834): out-of-office replies stay silent. */
  readonly automatic?: boolean
  /** A `List-Unsubscribe` address, for a mail a person may stop receiving. */
  readonly unsubscribe?: string | null
}

export class MailFormatError extends Error {}

/** An address a mail may carry: one `@`, no space, no bracket, no line break. */
const ADDRESS = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/

export function isAddress(text: string): boolean {
  return text.length <= 254 && ADDRESS.test(text)
}

function headerValue(value: string): string {
  if (/[\r\n]/.test(value)) throw new MailFormatError('line break in a header')
  return value
}

/** A text a header may carry as itself: printable ASCII, nothing else. */
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

/**
 * A header text as RFC 2047 encoded words when it is not plain ASCII: base64 of UTF-8, cut
 * on character boundaries so that no word splits a character, 75 characters at most each.
 */
export function encodeWords(text: string): string {
  headerValue(text)
  if (PRINTABLE_ASCII.test(text)) return text
  const words: string[] = []
  let chunk = ''
  for (const ch of text) {
    // 45 bytes of text make 60 of base64: with `=?UTF-8?B?` and `?=`, 72 characters.
    if (Buffer.byteLength(chunk + ch, 'utf8') > 45) {
      words.push(chunk)
      chunk = ''
    }
    chunk += ch
  }
  if (chunk !== '') words.push(chunk)
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join('\r\n ')
}

/** `Nom <adresse>`, the name encoded or quoted as it needs to be. */
export function formatAddress(a: Address): string {
  if (!isAddress(a.address)) throw new MailFormatError(`not an address: ${a.address}`)
  const name = a.name?.trim() ?? ''
  if (name === '') return a.address
  const shown = PRINTABLE_ASCII.test(name)
    ? /^[\w .!#$%&'*+/=?^`{|}~-]*$/.test(name)
      ? name
      : `"${name.replace(/(["\\])/g, '\\$1')}"`
    : encodeWords(name)
  return `${shown} <${a.address}>`
}

/** base64, 76 characters a line. */
function base64Lines(text: string): string {
  return (
    Buffer.from(text, 'utf8')
      .toString('base64')
      .match(/.{1,76}/g) ?? []
  ).join('\r\n')
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** RFC 5322 §3.3, in UTC: `Wed, 30 Sep 2026 10:00:00 +0000`. */
export function mailDate(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${DAYS[at.getUTCDay()]}, ${pad(at.getUTCDate())} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())} +0000`
}

/**
 * The mail as its bytes will be sent, lines ended by CRLF, and the identifier it carries.
 * `domain` is the right-hand side of the `Message-ID`: the sender's.
 */
export function composeMail(
  mail: OutgoingMail,
  options: { readonly at: Date; readonly domain: string },
): { readonly data: string; readonly messageId: string } {
  if (mail.to.length === 0) throw new MailFormatError('no recipient')
  const messageId = `<${randomBytes(12).toString('hex')}.${options.at.getTime()}@${options.domain}>`
  const headers = [
    `Date: ${mailDate(options.at)}`,
    `From: ${formatAddress(mail.from)}`,
    `To: ${mail.to.map(formatAddress).join(',\r\n ')}`,
    ...(mail.replyTo ? [`Reply-To: ${formatAddress(mail.replyTo)}`] : []),
    `Subject: ${encodeWords(mail.subject)}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    ...(mail.automatic ? ['Auto-Submitted: auto-generated'] : []),
    ...(mail.unsubscribe ? [`List-Unsubscribe: <${headerValue(mail.unsubscribe)}>`] : []),
  ]
  const text = [
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(mail.text),
  ]
  let body: string[]
  if (mail.html) {
    const boundary = `basedb-${randomBytes(12).toString('hex')}`
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    body = [
      `--${boundary}`,
      ...text,
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Lines(mail.html),
      `--${boundary}--`,
    ]
  } else {
    headers.push(text[0] as string, text[1] as string)
    body = [text[3] as string]
  }
  return { data: [...headers, '', ...body, ''].join('\r\n'), messageId }
}
