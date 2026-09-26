import { describe, expect, it } from 'vitest'
import { STRICT_TARGETS, checkTarget, isPublicAddress } from '../../src/webhooks/target.js'

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
