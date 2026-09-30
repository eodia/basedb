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
 *
 * `trusted` is how an operator lets through the servers of their own network, and them
 * alone (`BASEDB_WEBHOOK_ALLOW`): a name (`chat.intra.exemple.fr`), a domain and every
 * name under it (`*.intra.exemple.fr`), an address or a range (`10.12.0.0/16`). A target
 * named there, or whose every address falls in a range there, passes whatever its address,
 * its port or its scheme — an internal server often speaks plain HTTP on its own port.
 */

export interface TargetPolicy {
  /** Accept `http:` — development only. */
  readonly allowHttp: boolean
  /** Accept loopback and private addresses — development and tests only. */
  readonly allowPrivate: boolean
  /** The operator's own servers, by name, domain, address or range (`parseTrusted`). */
  readonly trusted?: readonly string[]
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

/** The trusted entries, compiled once per list. */
interface Trust {
  readonly names: ReadonlySet<string>
  /** `.intra.exemple.fr` for `*.intra.exemple.fr`: the domain's names, not the domain. */
  readonly suffixes: readonly string[]
  readonly ranges: BlockList | null
}

const NAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/

/**
 * `BASEDB_WEBHOOK_ALLOW`, read: entries separated by commas or spaces. An entry that is
 * none of a name, a `*.` domain, an address or a range is an error — the instance does not
 * start on a list it would read otherwise than its operator.
 */
export function parseTrusted(raw: string): readonly string[] {
  const entries = raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
  for (const entry of entries) {
    if (trustOf([entry]) === null) throw new Error(`entrée invalide : « ${entry} »`)
  }
  return entries
}

const compiled = new WeakMap<readonly string[], Trust>()

/** The list compiled — or `null` when an entry reads as nothing. */
function trustOf(entries: readonly string[]): Trust | null {
  const names = new Set<string>()
  const suffixes: string[] = []
  let ranges: BlockList | null = null
  for (const entry of entries) {
    const [address, bits, extra] = entry.split('/')
    const family = isIP(address ?? '')
    if (family !== 0 && extra === undefined) {
      const kind = family === 6 ? 'ipv6' : 'ipv4'
      const max = family === 6 ? 128 : 32
      const prefix = bits === undefined ? max : Number(bits)
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null
      ranges ??= new BlockList()
      ranges.addSubnet(address as string, prefix, kind)
    } else if (entry.startsWith('*.') && NAME.test(entry.slice(2))) {
      suffixes.push(entry.slice(1))
    } else if (NAME.test(entry)) {
      names.add(entry)
    } else {
      return null
    }
  }
  return { names, suffixes, ranges }
}

function compiledTrust(policy: TargetPolicy): Trust | null {
  const entries = policy.trusted
  if (entries === undefined || entries.length === 0) return null
  let trust = compiled.get(entries)
  if (trust === undefined) {
    trust = trustOf(entries) ?? { names: new Set(), suffixes: [], ranges: null }
    compiled.set(entries, trust)
  }
  return trust
}

function trustedName(trust: Trust | null, host: string): boolean {
  if (trust === null) return false
  return trust.names.has(host) || trust.suffixes.some((suffix) => host.endsWith(suffix))
}

function trustedAddress(trust: Trust | null, address: string): boolean {
  if (trust?.ranges == null) return false
  const { address: plain, family } = unwrap(address)
  return isIP(plain) !== 0 && trust.ranges.check(plain, family)
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
  const httpsRequired = () =>
    new BasedbError('REQUEST_INVALID', { details: { field: 'url', reason: 'https_requis' } })
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw httpsRequired()
  const plainHttp = url.protocol === 'http:' && !policy.allowHttp
  // A user and a password in the URL would travel to wherever it redirects… and leak.
  if (url.username !== '' || url.password !== '') throw rejected()

  if (policy.allowPrivate) {
    if (plainHttp) throw httpsRequired()
    return url
  }

  // The operator's own servers, by name: any address, any port, any scheme.
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const trust = compiledTrust(policy)
  if (trustedName(trust, host)) return url
  const defaultPort = url.protocol === 'https:' ? '443' : '80'
  const otherPort = url.port !== '' && url.port !== defaultPort
  // No range to resolve against: what only a trusted server may do is refused at once.
  if (trust?.ranges == null) {
    if (plainHttp) throw httpsRequired()
    if (otherPort) throw rejected()
  }

  const addresses =
    isIP(host) !== 0
      ? [host]
      : await lookup(host, { all: true, verbatim: true })
          .then((answers) => answers.map((a) => a.address))
          .catch(() => {
            throw rejected()
          })
  if (addresses.length === 0) throw rejected()
  // …or by range: every address it resolves to inside, none outside.
  if (addresses.every((address) => trustedAddress(trust, address))) return url

  if (plainHttp) throw httpsRequired()
  if (otherPort || !addresses.every(isPublicAddress)) throw rejected()
  return url
}
