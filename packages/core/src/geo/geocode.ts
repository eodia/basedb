import { BasedbError } from '../errors/index.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * Addresses as points — chapter 11 §1.9.
 *
 * A geocoding service the operator chooses — Nominatim, OpenStreetMap's, by default;
 * `BASEDB_GEOCODER_URL` for another speaking its protocol, `off` for none — turns an address
 * into a point. Its usage policy is the rule here: one request a second at most, from one
 * queue for the whole instance, a `User-Agent` that names the instance, and every answer
 * kept (`_basedb.geocode`, per tenant) so that an address is asked once — an address not
 * found as well, or it would be asked again at every look at the map.
 *
 * A caller gets at once what is known, and a count of what is still to ask: the map shows
 * its pins as they come, a few more at each call, never a request that waits a minute.
 */

export interface GeocoderConfig {
  /** A Nominatim-compatible service, or `null`: none, and only what is known is given. */
  readonly url: string | null
  readonly userAgent: string
  /** Minimum gap between two requests, in milliseconds — Nominatim's policy: 1 000. */
  readonly spacingMs?: number
  readonly timeoutMs?: number
}

export interface Place {
  readonly lat: number
  readonly lng: number
  readonly label: string
}

/** An address as it is asked and kept: spaces collapsed, lower case. */
export function normalizeAddress(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 500)
}

/** How many new addresses one call asks the service, at most. */
export const ASKED_PER_CALL = 5
/** How many addresses one call may name. */
export const MAX_ADDRESSES = 500

// One queue for the whole process: the service's policy is per client, not per request.
let last = 0
let queue: Promise<unknown> = Promise.resolve()

function paced<T>(config: GeocoderConfig, work: () => Promise<T>): Promise<T> {
  const spacing = config.spacingMs ?? 1_100
  const run = queue.then(async () => {
    const wait = last + spacing - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    try {
      return await work()
    } finally {
      last = Date.now()
    }
  })
  queue = run.catch(() => undefined)
  return run
}

interface NominatimHit {
  readonly lat?: string
  readonly lon?: string
  readonly display_name?: string
  readonly address?: Readonly<Record<string, string>>
}

/**
 * An address as a person writes it — number and street, postcode and town, country —
 * rather than the service's full name of the place, suburb, county and region included.
 */
function shortLabel(hit: NominatimHit): string {
  const a = hit.address
  if (a === undefined) return String(hit.display_name ?? '')
  const street = [a.house_number, a.road ?? a.pedestrian ?? a.square].filter(Boolean).join(' ')
  const town = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality]
    .filter(Boolean)
    .join(' ')
  const parts = [street || a.amenity || a.building, town, a.country].filter(
    (p): p is string => typeof p === 'string' && p !== '',
  )
  return parts.length >= 2 ? parts.join(', ') : String(hit.display_name ?? parts.join(', '))
}

async function ask(config: GeocoderConfig, query: string, limit: number, language: string) {
  const url = new URL('/search', config.url as string)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('q', query)
  const response = await fetch(url, {
    headers: {
      'user-agent': config.userAgent,
      'accept-language': language,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(config.timeoutMs ?? 8_000),
  })
  if (!response.ok) {
    throw new BasedbError('GEOCODER_UNAVAILABLE', { details: { status: response.status } })
  }
  const hits = (await response.json()) as NominatimHit[]
  return (Array.isArray(hits) ? hits : []).flatMap((h): Place[] => {
    const lat = Number(h.lat)
    const lng = Number(h.lon)
    return Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
      ? [{ lat, lng, label: shortLabel(h).slice(0, 500) }]
      : []
  })
}

async function tenantOf(pools: Pools, ctx: RequestContext): Promise<string> {
  const [row] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>('SELECT id::text FROM _basedb.tenant WHERE ref = $1', [
      ctx.tenantId,
    ]),
  )
  if (row === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')
  return row.id
}

/**
 * The points of addresses: those known at once, a few more asked of the service, and how
 * many are left to ask — the caller asks again for them.
 */
export async function geocodeAddresses(
  pools: Pools,
  ctx: RequestContext,
  config: GeocoderConfig,
  request: { readonly addresses: readonly unknown[]; readonly language?: string },
): Promise<{ readonly places: Readonly<Record<string, Place | null>>; readonly pending: number }> {
  if (ctx.actor.kind !== 'user' && ctx.actor.kind !== 'token')
    throw new BasedbError('AUTHENTICATION_REQUIRED')
  const wanted = [
    ...new Set(
      request.addresses
        .filter((a): a is string => typeof a === 'string')
        .map(normalizeAddress)
        .filter((a) => a !== ''),
    ),
  ]
  if (wanted.length > MAX_ADDRESSES) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'addresses', reason: 'trop_d_adresses', maximum: MAX_ADDRESSES },
    })
  }
  const tenant = await tenantOf(pools, ctx)
  const known = await pools.withConnection('catalog', (exec) =>
    exec.query<{ query: string; lat: number | null; lng: number | null; label: string | null }>(
      `SELECT query, lat, lng, label FROM _basedb.geocode
        WHERE tenant_id = $1 AND query = ANY($2::text[])`,
      [tenant, wanted],
    ),
  )
  const places: Record<string, Place | null> = {}
  for (const k of known) {
    places[k.query] =
      k.lat === null || k.lng === null ? null : { lat: k.lat, lng: k.lng, label: k.label ?? '' }
  }
  const missing = wanted.filter((a) => !(a in places))
  if (config.url === null) return { places, pending: 0 }

  const now = missing.slice(0, ASKED_PER_CALL)
  for (const address of now) {
    let found: Place | null
    try {
      found =
        (await paced(config, () => ask(config, address, 1, request.language ?? 'fr')))[0] ?? null
    } catch {
      // Unreachable now: left to a later call rather than remembered as not found.
      break
    }
    places[address] = found
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `INSERT INTO _basedb.geocode (tenant_id, query, lat, lng, label)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, query) DO UPDATE
            SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, label = EXCLUDED.label,
                fetched_at = clock_timestamp()`,
        [tenant, address, found?.lat ?? null, found?.lng ?? null, found?.label ?? null],
        'insert',
      ),
    )
  }
  return { places, pending: wanted.filter((a) => !(a in places)).length }
}

/**
 * Addresses a text may be — what the address input proposes when asked, never key after
 * key: OpenStreetMap's service forbids completing as one types.
 */
export async function searchAddresses(
  config: GeocoderConfig,
  request: { readonly query: string; readonly language?: string },
): Promise<Place[]> {
  const query = request.query.replace(/\s+/g, ' ').trim()
  if (config.url === null || query.length < 3) return []
  return paced(config, () => ask(config, query.slice(0, 300), 5, request.language ?? 'fr'))
}
