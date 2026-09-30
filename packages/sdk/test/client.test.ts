import { describe, expect, it } from 'vitest'
import { Basedb, BasedbError, filter, literal } from '../src/index.js'

interface Sent {
  readonly url: URL
  readonly init: RequestInit
}

/** A basedb that answers from a script, and remembers what it was asked. */
function fake(answers: Array<(sent: Sent) => Response>) {
  const sent: Sent[] = []
  const db = new Basedb({
    url: 'https://basedb.exemple.fr/',
    token: 'bdb_essai',
    retries: 1,
    fetch: async (input, init) => {
      const s = { url: new URL(input), init }
      sent.push(s)
      const answer = answers.shift()
      if (answer === undefined) throw new Error(`unexpected ${init.method} ${input}`)
      return answer(s)
    },
  })
  return { db, sent }
}

const json =
  (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    })

describe('the filter template', () => {
  it('writes values as literals, never as pieces of the filter', () => {
    const typed = 'x" or statut eq "perdu'
    expect(filter`nom eq ${typed} and montant gte ${10000}`).toBe(
      'nom eq "x\\" or statut eq \\"perdu" and montant gte 10000',
    )
    expect(filter`ville in ${['Lyon', 'Paris']} and actif eq ${true}`).toBe(
      'ville in ["Lyon", "Paris"] and actif eq true',
    )
    expect(filter`_updated_at gte ${new Date(Date.UTC(2026, 8, 30))}`).toBe(
      '_updated_at gte "2026-09-30T00:00:00.000Z"',
    )
    expect(() => literal(null)).toThrow(/is_null/)
    expect(() => literal(Number.NaN)).toThrow(/finite/)
  })
})

describe('the client', () => {
  it('asks /api/v1/<workspace>/data with the token, and reads a page', async () => {
    const { db, sent } = fake([
      json({
        data: [{ _id: 'a' }],
        meta: { has_next_page: true, next_cursor: 'c1', count: 12, count_is_capped: false },
      }),
    ])
    const page = await db
      .base('b_t4z56fq_ventes')
      .table('opportunites')
      .list({ filter: 'statut eq "gagne"', sort: ['-montant', 'nom'], limit: 10, count: true })
    expect(page).toEqual({ rows: [{ _id: 'a' }], next: 'c1', count: 12, countCapped: false })
    const { url, init } = sent[0]
    expect(url.pathname).toBe('/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      filter: 'statut eq "gagne"',
      sort: '-montant,nom',
      limit: '10',
      count: 'exact',
    })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer bdb_essai')
  })

  it('reads every page, following the cursor', async () => {
    const { db, sent } = fake([
      json({
        data: [{ _id: 'a' }, { _id: 'b' }],
        meta: { has_next_page: true, next_cursor: 'c1' },
      }),
      json({ data: [{ _id: 'c' }], meta: { has_next_page: false, next_cursor: null } }),
    ])
    const ids: string[] = []
    for await (const row of db.base('b').table('t').all({ limit: 2 })) ids.push(row._id)
    expect(ids).toEqual(['a', 'b', 'c'])
    expect(sent[1].url.searchParams.get('after')).toBe('c1')
  })

  it('sends values under `values`, and keeps the transaction of a write for undo', async () => {
    const { db, sent } = fake([
      json({ data: { _id: 'r1', nom: 'Acme' } }, 201, { 'x-basedb-transaction': 'tx1' }),
      json({ data: { transaction: 'tx2' } }),
    ])
    const row = await db.base('b').table('clients').create({ nom: 'Acme' })
    expect(JSON.parse(String(sent[0].init.body))).toEqual({ values: { nom: 'Acme' } })
    expect(db.transactionOf(row)).toBe('tx1')
    expect(await db.undo(row)).toEqual({ transaction: 'tx2' })
    expect(sent[1].url.pathname).toBe('/api/v1/t4z56fq/history/undo')
    expect(JSON.parse(String(sent[1].init.body))).toEqual({ transaction: 'tx1' })
  })

  it('raises basedb’s refusal with its code, its details and the request', async () => {
    const { db } = fake([
      json({ code: 'ADMIN_REQUIRED', details: { action: 'delete' }, request_id: 'rq1' }, 403),
    ])
    const refused = await db
      .base('b')
      .table('t')
      .delete('r1')
      .catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(BasedbError)
    expect(refused).toMatchObject({
      code: 'ADMIN_REQUIRED',
      status: 403,
      details: { action: 'delete' },
      requestId: 'rq1',
    })
  })

  it('names what answered when it is not basedb', async () => {
    const { db } = fake([() => new Response('<html>Bad gateway</html>', { status: 502 })])
    await expect(db.bases()).rejects.toMatchObject({ code: 'HTTP_502', status: 502 })
  })

  it('asks again when basedb asks to slow down, as long as it allows', async () => {
    const { db, sent } = fake([
      json({ code: 'RATE_LIMIT_EXCEEDED', request_id: 'r' }, 429, { 'retry-after': '0.01' }),
      json({ data: [] }),
    ])
    expect(await db.users()).toEqual([])
    expect(sent).toHaveLength(2)
  })

  it('aggregates, and deposits a file with its type', async () => {
    const { db, sent } = fake([
      json({
        data: { total: 3, values: { 'montant:sum': '42.00' }, groups: null, groups_capped: false },
      }),
      json({ data: { id: 'f1', name: 'devis.pdf', type: 'application/pdf', size: 3 } }, 201),
    ])
    const table = db.base('b').table('t')
    const summary = await table.aggregate({
      aggregates: { montant: 'sum', nom: 'filled' },
      filter: 'a eq 1',
    })
    expect(summary.total).toBe(3)
    expect(sent[0].url.searchParams.get('aggregates')).toBe('montant:sum,nom:filled')
    const file = await table.upload('devis', new Uint8Array([1, 2, 3]), {
      name: 'devis été.pdf',
      type: 'application/pdf',
    })
    expect(file.id).toBe('f1')
    expect(sent[1].url.pathname).toBe('/api/v1/t4z56fq/files/b/t/devis')
    expect(sent[1].url.searchParams.get('name')).toBe('devis été.pdf')
    expect((sent[1].init.headers as Record<string, string>)['content-type']).toBe('application/pdf')
    expect(table.fileUrl({ url: '/api/v1/t4z56fq/files/f1/devis.pdf?sig=x' })).toBe(
      'https://basedb.exemple.fr/api/v1/t4z56fq/files/f1/devis.pdf?sig=x',
    )
  })
})
