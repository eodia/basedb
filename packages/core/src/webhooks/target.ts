import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { BasedbError } from '../errors/index.js'

/**
 * Where a webhook may send rows — chapter 08 §10.8.
 *
 * By ALLOWING, not by forbidding: only a publicly routable unicast address passes, every
 * address of the DNS answer is checked (not just the one a connection would pick), and an
 * IPv4 address mapped into IPv6 is unwrapped before the test — `[::ffff:127.0.0.1]` is the
 * loopback, whatever its spelling. The URL is checked again before every attempt: a name
 * that resolved publicly yesterday may point inside today.
 *
 * `allowPrivate` exists for development and for tests, where the consumer runs on the same
 * machine. It is off unless the operator turns it on, and the product says so.
 */

export interface TargetPolicy {
  /** Accept `http:` — development only. */
  readonly allowHttp: boolean
  /** Accept loopback and private addresses — development and tests only. */
  readonly allowPrivate: boolean
}

export const STRICT_TARGETS: TargetPolicy = { allowHttp: false, allowPrivate: false }

/** Every range that is not the public Internet (IANA special-purpose registries). */
const RESERVED = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  RESERVED.addSubnet(address, prefix, 'ipv4')
}
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  RESERVED.addSubnet(address, prefix, 'ipv6')
}

/** `::ffff:a.b.c.d` → `a.b.c.d`: the mapped form reaches the same host as the plain one. */
function unwrap(address: string): { address: string; family: 'ipv4' | 'ipv6' } {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped !== null) return { address: mapped[1] as string, family: 'ipv4' }
  return { address, family: isIP(address) === 6 ? 'ipv6' : 'ipv4' }
}

export function isPublicAddress(address: string): boolean {
  const { address: plain, family } = unwrap(address)
  if (isIP(plain) === 0) return false
  return !RESERVED.check(plain, family)
}

/**
 * Refused, without saying why: the webhook must not become a scanner of the network. At
 * creation it is a request the caller must change; at delivery the dispatcher records the
 * attempt as `WEBHOOK_TARGET_REJECTED` (08 §10.8).
 */
const rejected = () =>
  new BasedbError('REQUEST_INVALID', { details: { field: 'url', reason: 'cible_refusee' } })

/** The URL as it may be stored: checked for its shape, and its host resolved. */
export async function checkTarget(raw: string, policy: TargetPolicy): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'url' } })
  }
  if (url.protocol !== 'https:' && !(policy.allowHttp && url.protocol === 'http:')) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'url', reason: 'https_requis' } })
  }
  // A user and a password in the URL would travel to wherever it redirects… and leak.
  if (url.username !== '' || url.password !== '') throw rejected()
  const defaultPort = url.protocol === 'https:' ? '443' : '80'
  if (url.port !== '' && url.port !== defaultPort && !policy.allowPrivate) throw rejected()

  if (policy.allowPrivate) return url

  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses =
    isIP(host) !== 0
      ? [host]
      : await lookup(host, { all: true, verbatim: true })
          .then((answers) => answers.map((a) => a.address))
          .catch(() => {
            throw rejected()
          })
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw rejected()
  return url
}
