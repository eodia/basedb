import net from 'node:net'
import tls from 'node:tls'

/**
 * An SMTP client — RFC 5321, with STARTTLS (RFC 3207) and AUTH PLAIN or LOGIN (RFC 4954).
 *
 * The operator's relay does the delivering: this client says who it is, secures the line,
 * signs in, names the sender and the recipients, and hands over the bytes `message.ts`
 * composed. Six commands do not justify a dependency, as three verbs of S3 did not.
 *
 * A line that is not secured is refused unless the operator asked for it by name
 * (`secure: 'none'`): a password sent in clear to a relay across the internet is a
 * password given away.
 */

export interface SmtpConfig {
  readonly host: string
  readonly port: number
  /** `tls` from the first byte (465), `starttls` after the greeting (587, 25), or `none`. */
  readonly secure: 'tls' | 'starttls' | 'none'
  readonly user?: string | null
  readonly password?: string | null
  /** The name said in `EHLO`: this host's. */
  readonly heloName?: string
  readonly timeoutMs?: number
  /** Certificates of a private relay; on by default, like every TLS client. */
  readonly rejectUnauthorized?: boolean
}

export class SmtpError extends Error {
  constructor(
    message: string,
    /** The server's reply code, when it gave one — 5xx is final, 4xx worth a retry. */
    readonly code: number | null = null,
  ) {
    super(message)
  }

  /** A refusal the server says is final: trying again later would change nothing. */
  get permanent(): boolean {
    return this.code !== null && this.code >= 500
  }
}

interface Reply {
  readonly code: number
  readonly lines: readonly string[]
}

/** One connection, read reply by reply. */
class Session {
  private buffer = ''
  private waiting: Array<(reply: Reply | Error) => void> = []
  private replies: Reply[] = []
  private pending: string[] = []
  private failure: Error | null = null

  constructor(private socket: net.Socket | tls.TLSSocket) {
    this.listen(socket)
  }

  private listen(socket: net.Socket | tls.TLSSocket): void {
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => this.receive(chunk))
    socket.on('error', (e) => this.fail(e))
    socket.on('timeout', () => {
      this.fail(new SmtpError('timeout'))
      socket.destroy()
    })
    socket.on('close', () => this.fail(new SmtpError('connection closed')))
  }

  private receive(chunk: string): void {
    this.buffer += chunk
    let at = this.buffer.indexOf('\n')
    while (at !== -1) {
      const line = this.buffer.slice(0, at).replace(/\r$/, '')
      this.buffer = this.buffer.slice(at + 1)
      this.pending.push(line)
      // `250-…` continues, `250 …` ends the reply.
      if (/^\d{3}(?: |$)/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), lines: this.pending.map((l) => l.slice(4)) }
        this.pending = []
        const next = this.waiting.shift()
        if (next === undefined) this.replies.push(reply)
        else next(reply)
      }
      at = this.buffer.indexOf('\n')
    }
  }

  private fail(error: Error): void {
    if (this.failure !== null) return
    this.failure = error
    for (const next of this.waiting.splice(0)) next(error)
  }

  read(): Promise<Reply> {
    const ready = this.replies.shift()
    if (ready !== undefined) return Promise.resolve(ready)
    if (this.failure !== null) return Promise.reject(this.failure)
    return new Promise((resolve, reject) => {
      this.waiting.push((r) => (r instanceof Error ? reject(r) : resolve(r)))
    })
  }

  /** Sends a command and reads its reply, which must be one of `expected`. */
  async command(line: string, expected: readonly number[], shown = line): Promise<Reply> {
    this.socket.write(`${line}\r\n`)
    return this.expect(expected, shown)
  }

  async expect(expected: readonly number[], what: string): Promise<Reply> {
    const reply = await this.read()
    if (!expected.includes(reply.code)) {
      throw new SmtpError(`${what}: ${reply.code} ${reply.lines.join(' ')}`.trim(), reply.code)
    }
    return reply
  }

  write(data: string): void {
    this.socket.write(data)
  }

  /** The same connection, secured: the replies go on being read from the TLS socket. */
  async upgrade(options: tls.ConnectionOptions): Promise<void> {
    const plain = this.socket
    plain.removeAllListeners('data')
    plain.removeAllListeners('close')
    plain.removeAllListeners('timeout')
    const secured = tls.connect({ ...options, socket: plain as net.Socket })
    await new Promise<void>((resolve, reject) => {
      secured.once('secureConnect', resolve)
      secured.once('error', reject)
    })
    secured.setTimeout(plain.timeout ?? 0)
    this.socket = secured
    this.listen(secured)
  }

  close(): void {
    this.socket.end()
    this.socket.destroy()
  }
}

/** The extensions an `EHLO` reply announces, upper-cased: `STARTTLS`, `AUTH PLAIN LOGIN`… */
function extensionsOf(reply: Reply): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of reply.lines.slice(1)) {
    const [name, ...rest] = line.trim().split(/\s+/)
    if (name) out.set(name.toUpperCase(), rest.join(' ').toUpperCase())
  }
  return out
}

/** The body with every line that starts with a dot doubled (RFC 5321 §4.5.2). */
export function dotStuff(data: string): string {
  const body = data.endsWith('\r\n') ? data : `${data}\r\n`
  return body.replace(/(^|\r\n)\./g, '$1..')
}

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')

/**
 * Sends one message: `from` and `to` are the envelope, `data` the composed mail. Resolves
 * once the relay has taken it (`250` after the data); a recipient it refuses fails the
 * whole send, which is what one recipient per message makes simple.
 */
export async function sendSmtp(
  config: SmtpConfig,
  envelope: { readonly from: string; readonly to: readonly string[] },
  data: string,
): Promise<string> {
  const timeout = config.timeoutMs ?? 20_000
  const tlsOptions: tls.ConnectionOptions = {
    host: config.host,
    servername: net.isIP(config.host) === 0 ? config.host : undefined,
    rejectUnauthorized: config.rejectUnauthorized ?? true,
    minVersion: 'TLSv1.2',
  }
  const socket = await new Promise<net.Socket | tls.TLSSocket>((resolve, reject) => {
    const s =
      config.secure === 'tls'
        ? tls.connect({ ...tlsOptions, port: config.port }, () => resolve(s))
        : net.connect({ host: config.host, port: config.port }, () => resolve(s))
    s.setTimeout(timeout)
    s.once('error', reject)
    s.once('timeout', () => {
      reject(new SmtpError('timeout'))
      s.destroy()
    })
  })
  const session = new Session(socket)
  try {
    await session.expect([220], 'greeting')
    const helo = config.heloName ?? 'localhost'
    let ehlo = extensionsOf(await session.command(`EHLO ${helo}`, [250]))
    if (config.secure === 'starttls') {
      if (!ehlo.has('STARTTLS')) throw new SmtpError('the relay does not offer STARTTLS')
      await session.command('STARTTLS', [220])
      await session.upgrade(tlsOptions)
      ehlo = extensionsOf(await session.command(`EHLO ${helo}`, [250]))
    }
    if (config.user) {
      const mechanisms = (ehlo.get('AUTH') ?? '').split(' ')
      const password = config.password ?? ''
      if (mechanisms.includes('PLAIN') || !mechanisms.includes('LOGIN')) {
        await session.command(
          `AUTH PLAIN ${b64(`\u0000${config.user}\u0000${password}`)}`,
          [235],
          'AUTH PLAIN',
        )
      } else {
        await session.command('AUTH LOGIN', [334])
        await session.command(b64(config.user), [334], 'AUTH LOGIN user')
        await session.command(b64(password), [235], 'AUTH LOGIN password')
      }
    }
    // An address beyond ASCII asks the relay for SMTPUTF8 (RFC 6531), when it has it.
    const utf8 = [...[envelope.from, ...envelope.to].join('')].some((c) => c.charCodeAt(0) > 127)
    const smtputf8 = utf8 && ehlo.has('SMTPUTF8') ? ' SMTPUTF8' : ''
    await session.command(`MAIL FROM:<${envelope.from}>${smtputf8}`, [250])
    for (const to of envelope.to) await session.command(`RCPT TO:<${to}>`, [250, 251])
    await session.command('DATA', [354])
    session.write(`${dotStuff(data)}.\r\n`)
    const accepted = await session.expect([250], 'DATA')
    await session.command('QUIT', [221]).catch(() => undefined)
    return accepted.lines.join(' ')
  } finally {
    session.close()
  }
}
