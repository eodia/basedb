import net from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { composeMail, encodeWords, formatAddress, mailDate } from '../../src/mail/message.js'
import { SmtpError, dotStuff, sendSmtp } from '../../src/mail/smtp.js'

/**
 * Mail — the message as it leaves, and the SMTP conversation that hands it over, against a
 * relay played here on a local port.
 */

const AT = new Date('2026-09-30T08:05:09Z')

describe('composing a mail', () => {
  it('writes a subject in plain ASCII as itself, anything else as encoded words', () => {
    expect(encodeWords('Hello')).toBe('Hello')
    const encoded = encodeWords('Échéance dépassée — « Clients »')
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/)
    const decoded = encoded
      .split('\r\n ')
      .map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8'))
      .join('')
    expect(decoded).toBe('Échéance dépassée — « Clients »')
    expect(encoded.split('\r\n ').every((w) => w.length <= 75)).toBe(true)
  })

  it('refuses a line break in a header: a subject must not smuggle a Bcc', () => {
    expect(() => encodeWords('Bonjour\r\nBcc: tous@exemple.fr')).toThrow()
    expect(() =>
      composeMail(
        {
          from: { address: 'basedb@exemple.fr' },
          to: [{ address: 'lea@exemple.fr' }],
          subject: 'x\nBcc: a@b.fr',
          text: 't',
        },
        { at: AT, domain: 'exemple.fr' },
      ),
    ).toThrow()
  })

  it('quotes or encodes a display name, and refuses what is not an address', () => {
    expect(formatAddress({ address: 'a@exemple.fr', name: 'Léa Martin' })).toMatch(
      /^=\?UTF-8\?B\?.+\?= <a@exemple\.fr>$/,
    )
    expect(formatAddress({ address: 'a@exemple.fr', name: 'Martin, Léa' })).toContain('=?UTF-8?B?')
    expect(formatAddress({ address: 'a@exemple.fr', name: 'Ventes (CRM)' })).toBe(
      '"Ventes (CRM)" <a@exemple.fr>',
    )
    expect(() => formatAddress({ address: 'a@exemple.fr>\r\nBcc: x@y.fr' })).toThrow()
  })

  it('dates in RFC 5322 form', () => {
    expect(mailDate(AT)).toBe('Wed, 30 Sep 2026 08:05:09 +0000')
  })

  it('carries the text in base64, and the HTML beside it as an alternative', () => {
    const { data, messageId } = composeMail(
      {
        from: { address: 'basedb@exemple.fr', name: 'basedb' },
        to: [{ address: 'lea@exemple.fr' }],
        subject: 'Relance',
        text: '.début de ligne\nFin',
        html: '<p>Fin</p>',
        automatic: true,
      },
      { at: AT, domain: 'exemple.fr' },
    )
    expect(messageId).toMatch(/^<[0-9a-f]+\.\d+@exemple\.fr>$/)
    expect(data).toContain('Auto-Submitted: auto-generated')
    expect(data).toContain('Content-Type: multipart/alternative')
    expect(data).toContain(Buffer.from('.début de ligne\nFin').toString('base64'))
    expect(data.split('\r\n').every((line) => line.length <= 998)).toBe(true)
  })
})

describe('dot-stuffing', () => {
  it('doubles a dot that starts a line, so the data cannot end early', () => {
    expect(dotStuff('a\r\n.\r\nb')).toBe('a\r\n..\r\nb\r\n')
    expect(dotStuff('.x')).toBe('..x\r\n')
  })
})

/** A relay on a local port: it records what it is told and answers like a real one. */
function relay(options: { refuse?: string; auth?: string } = {}) {
  const heard: string[] = []
  const messages: string[] = []
  const server = net.createServer((socket) => {
    let data: string | null = null
    let buffer = ''
    socket.write('220 relais.test ESMTP\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      for (;;) {
        if (data !== null) {
          const end = buffer.indexOf('\r\n.\r\n')
          if (end === -1) return
          data += buffer.slice(0, end + 2)
          buffer = buffer.slice(end + 5)
          messages.push(data)
          data = null
          socket.write('250 2.0.0 Ok: queued as 42\r\n')
          continue
        }
        const at = buffer.indexOf('\r\n')
        if (at === -1) return
        const line = buffer.slice(0, at)
        buffer = buffer.slice(at + 2)
        heard.push(line)
        if (line.startsWith('EHLO')) {
          socket.write(
            `250-relais.test\r\n250-SIZE 10240000\r\n250 AUTH ${options.auth ?? 'PLAIN LOGIN'}\r\n`,
          )
        } else if (line.startsWith('AUTH PLAIN')) socket.write('235 2.7.0 Authenticated\r\n')
        else if (line === 'AUTH LOGIN') socket.write('334 VXNlcm5hbWU6\r\n')
        else if (heard.at(-2) === 'AUTH LOGIN') socket.write('334 UGFzc3dvcmQ6\r\n')
        else if (heard.at(-3) === 'AUTH LOGIN') socket.write('235 2.7.0 Authenticated\r\n')
        else if (line.startsWith('MAIL FROM')) socket.write('250 2.1.0 Ok\r\n')
        else if (line.startsWith('RCPT TO')) {
          socket.write(
            options.refuse !== undefined && line.includes(options.refuse)
              ? '550 5.1.1 No such user\r\n'
              : '250 2.1.5 Ok\r\n',
          )
        } else if (line === 'DATA') {
          data = ''
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n')
        } else if (line === 'QUIT') {
          socket.write('221 2.0.0 Bye\r\n')
          socket.end()
        } else socket.write('502 5.5.2 Error\r\n')
      }
    })
  })
  const port = new Promise<number>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port)),
  )
  return { heard, messages, port, close: () => server.close() }
}

let open: ReturnType<typeof relay> | null = null
afterEach(() => {
  open?.close()
  open = null
})

describe('the SMTP conversation', () => {
  it('signs in, names sender and recipient, and hands over the mail intact', async () => {
    open = relay()
    const { data } = composeMail(
      {
        from: { address: 'basedb@exemple.fr' },
        to: [{ address: 'lea@exemple.fr' }],
        subject: 'Relance',
        text: 'Bonjour',
      },
      { at: AT, domain: 'exemple.fr' },
    )
    const answer = await sendSmtp(
      { host: '127.0.0.1', port: await open.port, secure: 'none', user: 'u', password: 'p' },
      { from: 'basedb@exemple.fr', to: ['lea@exemple.fr'] },
      data,
    )
    expect(answer).toContain('queued')
    expect(open.heard[0]).toMatch(/^EHLO /)
    expect(Buffer.from(open.heard[1]?.slice('AUTH PLAIN '.length) ?? '', 'base64').toString()).toBe(
      '\0u\0p',
    )
    expect(open.heard.slice(2, 5)).toEqual([
      'MAIL FROM:<basedb@exemple.fr>',
      'RCPT TO:<lea@exemple.fr>',
      'DATA',
    ])
    expect(open.messages[0]).toBe(data)
  })

  it('falls back to AUTH LOGIN when the relay offers nothing else', async () => {
    open = relay({ auth: 'LOGIN' })
    await sendSmtp(
      { host: '127.0.0.1', port: await open.port, secure: 'none', user: 'u', password: 'p' },
      { from: 'a@exemple.fr', to: ['b@exemple.fr'] },
      'Subject: x\r\n\r\ny\r\n',
    )
    expect(open.heard.slice(1, 4)).toEqual(['AUTH LOGIN', 'dQ==', 'cA=='])
  })

  it('says a refused recipient is final, and never sends the data', async () => {
    open = relay({ refuse: 'inconnu@' })
    const error = await sendSmtp(
      { host: '127.0.0.1', port: await open.port, secure: 'none' },
      { from: 'a@exemple.fr', to: ['inconnu@exemple.fr'] },
      'Subject: x\r\n\r\ny\r\n',
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SmtpError)
    expect((error as SmtpError).permanent).toBe(true)
    expect(open.messages).toEqual([])
  })

  it('refuses to go on in clear when STARTTLS was asked and is not offered', async () => {
    open = relay()
    await expect(
      sendSmtp(
        { host: '127.0.0.1', port: await open.port, secure: 'starttls', user: 'u', password: 'p' },
        { from: 'a@exemple.fr', to: ['b@exemple.fr'] },
        'x',
      ),
    ).rejects.toThrow(/STARTTLS/)
    expect(open.heard.some((l) => l.startsWith('AUTH'))).toBe(false)
  })
})
