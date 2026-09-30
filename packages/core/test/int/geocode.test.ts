import { randomUUID } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Geocoding — chapter 11 §1.9: an address asked of the service once, a few per call, the
 * answer kept — an address not found as well —, and what the service is sent named by a
 * `User-Agent`. The service is played here by a local server.
 */

const TENANT = 't2gx5ks'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let offline: Kernel
let admin: RequestContext
let server: http.Server
const asked: Array<{ q: string; agent: string | undefined }> = []

const KNOWN: Readonly<Record<string, [number, number]>> = {
  '12 rue des lilas, lyon': [45.76, 4.84],
  '1 place du capitole, toulouse': [43.6, 1.44],
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    asked.push({ q, agent: req.headers['user-agent'] })
    const hit = KNOWN[q]
    const limit = Number(url.searchParams.get('limit') ?? 1)
    const hits =
      hit !== undefined
        ? [{ lat: String(hit[0]), lon: String(hit[1]), display_name: `${q}, France` }]
        : q.startsWith('rue')
          ? Array.from({ length: 8 }, (_, i) => ({
              lat: '45',
              lon: '4',
              display_name: `${q} ${i}`,
            })).slice(0, limit)
          : []
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(hits))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const common = {
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  }
  kernel = startKernel({ ...common, geocoder: { url, userAgent: 'basedb-test', spacingMs: 0 } })
  offline = startKernel({ ...common, geocoder: { url: null, userAgent: 'basedb-test' } })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  admin = await kernel.openContext({
    userId: boot.userId,
    requestId: randomUUID(),
    surface: 'rest',
  })
}, 240_000)

afterAll(async () => {
  await offline?.close()
  await kernel?.close()
  await container?.stop()
  server?.close()
})

describe('geocoding addresses', () => {
  it('asks a few per call, says how many are left, and names itself', async () => {
    const addresses = [
      '12 rue des Lilas,  Lyon',
      '1 place du Capitole, Toulouse',
      'nulle part 1',
      'nulle part 2',
      'nulle part 3',
      'nulle part 4',
      'nulle part 5',
    ]
    const first = await kernel.geocode(admin, { addresses })
    expect(first.pending).toBe(2)
    expect(first.places['12 rue des lilas, lyon']).toEqual({
      lat: 45.76,
      lng: 4.84,
      label: '12 rue des lilas, lyon, France',
    })
    expect(first.places['nulle part 1']).toBeNull()
    expect(asked.every((a) => a.agent === 'basedb-test')).toBe(true)

    const second = await kernel.geocode(admin, { addresses })
    expect(second.pending).toBe(0)
    expect(Object.keys(second.places)).toHaveLength(7)
    expect(asked).toHaveLength(7)
  })

  it('never asks twice — an address not found either', async () => {
    const before = asked.length
    const again = await kernel.geocode(admin, {
      addresses: ['NULLE PART 1', '12 rue des lilas, lyon'],
    })
    expect(again.pending).toBe(0)
    expect(asked.length).toBe(before)
  })

  it('gives only what is known when no service is configured', async () => {
    const found = await offline.geocode(admin, {
      addresses: ['12 rue des lilas, lyon', 'jamais cherchée'],
    })
    expect(found).toEqual({
      places: {
        '12 rue des lilas, lyon': {
          lat: 45.76,
          lng: 4.84,
          label: '12 rue des lilas, lyon, France',
        },
      },
      pending: 0,
    })
  })

  it('proposes five addresses at most for a text, and nothing under three characters', async () => {
    expect(await kernel.searchAddresses(admin, { query: 'rue de la paix' })).toHaveLength(5)
    expect(await kernel.searchAddresses(admin, { query: 'ru' })).toEqual([])
    expect(await offline.searchAddresses(admin, { query: 'rue de la paix' })).toEqual([])
  })
})
