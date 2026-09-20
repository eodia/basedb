import { describe, expect, it } from 'vitest'
import { SNAPSHOT_TTL_MS, VersionedCache } from '../../src/catalog/cache.js'

/**
 * The cache policy — chapter 05 §7.2.
 *
 * Two mechanisms, and neither replaces the other. The counters catch every WRITE; the
 * 30-second lifetime catches what no write announces — a role or a token reaching its
 * `expires_at`, which moves no row and therefore moves no counter.
 */

const V1 = { catalog: 'aaa', authz: 1 }
const V2 = { catalog: 'bbb', authz: 1 }

describe('VersionedCache', () => {
  it('returns a value while the counters hold still', () => {
    const cache = new VersionedCache<string>(4)
    cache.set('k', V1, 1000, 'valeur')
    expect(cache.get('k', V1, 1000)).toBe('valeur')
  })

  it('drops it as soon as the catalog counter moves', () => {
    const cache = new VersionedCache<string>(4)
    cache.set('k', V1, 1000, 'valeur')
    expect(cache.get('k', V2, 1000)).toBeUndefined()
  })

  it('drops it as soon as the authorization counter moves', () => {
    const cache = new VersionedCache<string>(4)
    cache.set('k', V1, 1000, 'valeur')
    expect(cache.get('k', { catalog: 'aaa', authz: 2 }, 1000)).toBeUndefined()
  })

  it('drops it after 30 seconds even though nothing moved', () => {
    // This is what catches an expiry: a token reaching its date changes no row, so no
    // counter moves, and only the clock notices.
    const cache = new VersionedCache<string>(4)
    cache.set('k', V1, 1000, 'valeur')
    expect(cache.get('k', V1, 1000 + SNAPSHOT_TTL_MS - 1)).toBe('valeur')
    expect(cache.get('k', V1, 1000 + SNAPSHOT_TTL_MS + 1)).toBeUndefined()
  })

  it('evicts the least recently used once full', () => {
    const cache = new VersionedCache<string>(2)
    cache.set('a', V1, 1000, 'A')
    cache.set('b', V1, 1000, 'B')
    // Reading `a` makes `b` the oldest.
    expect(cache.get('a', V1, 1000)).toBe('A')
    cache.set('c', V1, 1000, 'C')

    expect(cache.size).toBe(2)
    expect(cache.get('b', V1, 1000)).toBeUndefined()
    expect(cache.get('a', V1, 1000)).toBe('A')
    expect(cache.get('c', V1, 1000)).toBe('C')
  })

  it('never grows past its bound', () => {
    const cache = new VersionedCache<number>(3)
    for (let i = 0; i < 50; i++) cache.set(`k${i}`, V1, 1000, i)
    expect(cache.size).toBe(3)
  })
})
