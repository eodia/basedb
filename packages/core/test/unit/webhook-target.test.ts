import { describe, expect, it } from 'vitest'
import {
  STRICT_TARGETS,
  checkTarget,
  isPublicAddress,
  parseTrusted,
} from '../../src/webhooks/target.js'

/**
 * Where a webhook may send — chapter 08 §10.8. Allowed, not forbidden: only a public
 * unicast address passes, whatever spelling hides a private one.
 */

describe('a public address', () => {
  it('is a routable unicast address, v4 or v6', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true)
    expect(isPublicAddress('2001:4860:4860::8888')).toBe(true)
  })

  it('is never the loopback, a private range, CGNAT, link-local or the metadata service', () => {
    for (const address of [
      '127.0.0.1',
      '0.0.0.0',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.10',
      '100.64.1.1',
      '169.254.169.254',
      '198.18.0.1',
      '::1',
      'fd00::1',
      'fe80::1',
    ]) {
      expect({ address, public: isPublicAddress(address) }).toEqual({ address, public: false })
    }
  })

  it('is judged after unwrapping an IPv4 address mapped into IPv6', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false)
    expect(isPublicAddress('::ffff:169.254.169.254')).toBe(false)
  })
})

describe('a target URL', () => {
  const codeOf = async (url: string) => {
    try {
      await checkTarget(url, STRICT_TARGETS)
    } catch (e) {
      return (
        (e as { code: string; details: { reason?: string } }).details.reason ??
        (e as { code: string }).code
      )
    }
    return 'accepted'
  }

  it('wants HTTPS, and says so', async () => {
    expect(await codeOf('http://example.com/hook')).toBe('https_requis')
  })

  it('refuses credentials in the URL, another port, and an address that is not public', async () => {
    expect(await codeOf('https://user:secret@example.com/hook')).toBe('cible_refusee')
    expect(await codeOf('https://example.com:8443/hook')).toBe('cible_refusee')
    expect(await codeOf('https://127.0.0.1/hook')).toBe('cible_refusee')
    expect(await codeOf('https://[::ffff:10.0.0.1]/hook')).toBe('cible_refusee')
  })

  it('is relaxed only when the operator says so, for development', async () => {
    const url = await checkTarget('http://127.0.0.1:9999/hook', {
      allowHttp: true,
      allowPrivate: true,
    })
    expect(url.host).toBe('127.0.0.1:9999')
  })
})

describe("the operator's own servers", () => {
  const policy = {
    ...STRICT_TARGETS,
    trusted: parseTrusted('chat.intra.exemple.fr, *.interne.exemple.fr 10.12.0.0/16,fd12::/16'),
  }
  const verdict = async (url: string) =>
    checkTarget(url, policy).then(
      (checked) => checked.host,
      (e: { details: { reason?: string } }) => e.details.reason ?? 'refusee',
    )

  it('pass by name, or under a domain: any scheme, any port, whatever they resolve to', async () => {
    expect(await verdict('http://chat.intra.exemple.fr:8080/basedb')).toBe(
      'chat.intra.exemple.fr:8080',
    )
    expect(await verdict('http://CHAT.intra.exemple.fr/basedb')).toBe('chat.intra.exemple.fr')
    expect(await verdict('https://bot.interne.exemple.fr/hook')).toBe('bot.interne.exemple.fr')
  })

  it('pass by address inside a range', async () => {
    expect(await verdict('http://10.12.3.4:3000/hook')).toBe('10.12.3.4:3000')
    expect(await verdict('http://[fd12::5]:3000/hook')).toBe('[fd12::5]:3000')
    expect(await verdict('http://[::ffff:10.12.0.9]/hook')).toBe('[::ffff:a0c:9]')
  })

  it('are them alone: a neighbour, the domain itself, a close name stay refused', async () => {
    expect(await verdict('http://10.13.0.1/hook')).toBe('https_requis')
    expect(await verdict('https://10.13.0.1/hook')).toBe('cible_refusee')
    expect(await verdict('https://127.0.0.1/hook')).toBe('cible_refusee')
    expect(await verdict('https://interne.exemple.fr.invalid/hook')).toBe('cible_refusee')
    expect(await verdict('https://user:secret@chat.intra.exemple.fr/hook')).toBe('cible_refusee')
    expect(await verdict('ftp://chat.intra.exemple.fr/hook')).toBe('https_requis')
  })

  it('are read strictly: an entry that is nothing is an error', () => {
    expect(parseTrusted('  ')).toEqual([])
    expect(parseTrusted('Chat.Intra,192.168.0.0/24')).toEqual(['chat.intra', '192.168.0.0/24'])
    for (const entry of ['10.0.0.0/33', 'http://chat', '*', '*.', 'chat_intra', '10.0.0.0/8/1']) {
      expect(() => parseTrusted(entry)).toThrow(entry)
    }
  })
})
