import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createBase, createTable } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { listRecords } from '../../src/records/list.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Filters and sorting against a real PostgreSQL — chapter 08 §4.
 *
 * The unit test checks the SHAPE of the SQL; this one checks that it runs and returns
 * the right rows. Both are necessary: a fragment can be well formed and wrong — an
 * unfolded `LIKE`, a missing cast, a forgotten collation all pass textual inspection and
 * fail against the server.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let tableId: string
let relation: string

/** Returns the error code raised by a rejected promise. */
async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('no error raised')
}

/**
 * The invoice numbers a filter returns.
 *
 * The default sort is `numero`, not the natural order: five rows inserted by a single
 * statement receive UUIDv7s born in the same millisecond, hence tie-broken by their
 * random part. The `_id` order is perfectly stable — that is what makes pagination
 * work — but it is not the insertion order, and a test assuming otherwise would fail
 * half the time.
 */
async function numbers(options: { filter?: string; sort?: string; limit?: number }) {
  const r = await listRecords(pools, ctx, {
    tableId,
    filter: options.filter,
    sort: options.sort ?? 'numero',
    limit: options.limit,
  })
  return r.rows.map((row) => row.numero)
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })

  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
  })

  const actor = await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    const [t] = await exec.query<{ id: string; created_by: string }>(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
      [TENANT_REF],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.app_user
         (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t.created_by
  })

  const now = new Date('2026-09-19T12:00:00.000Z')
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000000c',
    actor: { kind: 'user', id: actor },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'CRM' })
  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number' },
      { label: 'Payée', kind: 'boolean' },
      { label: 'Client', kind: 'short_text' },
    ],
  })
  tableId = table.tableId
  relation = table.qualifiedName

  // The accents and casing of the client names are there so that folding is REALLY
  // exercised: "Éodia" and "eodia" must match each other.
  await pools.withConnection('data', (exec) =>
    exec.query(
      `INSERT INTO ${relation} ("numero", "montant", "payee", "client") VALUES
         ('F-001', 100.00, true,  'Éodia'),
         ('F-002', 250.50, false, 'Zebra SARL'),
         ('F-003', 999.99, false, 'école du Nord'),
         ('F-004',  50.00, true,  'remise 100% garantie'),
         ('F-005', 250.50, false, NULL)`,
      [],
      'insert',
    ),
  )
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('the emitted SQL', () => {
  it('carries the row-predicate marker, even when constant', () => {
    // The marker is what the non-regression test looks for in EVERY statement sent to
    // the `data` pool; a statement lacking it must fail.
    return listRecords(pools, ctx, { tableId }).then((r) => {
      expect(r.sql).toContain('/*predicat_lignes:factures*/')
    })
  })

  it('asks for one row more than the page to know whether more remain', async () => {
    const r = await listRecords(pools, ctx, { tableId, limit: 2 })
    expect(r.sql).toContain('LIMIT 3')
    expect(r.rows).toHaveLength(2)
    expect(r.hasNextPage).toBe(true)

    const all = await listRecords(pools, ctx, { tableId, limit: 50 })
    expect(all.hasNextPage).toBe(false)
  })
})

describe('operators, against the server', () => {
  it('compares numbers without treating them as text', async () => {
    // Without the `::numeric` cast, the comparison would bear on strings and "50.00"
    // would be greater than "100.00".
    expect(await numbers({ filter: 'montant gt 100' })).toEqual(['F-002', 'F-003', 'F-005'])
    expect(await numbers({ filter: 'montant between [50, 100]' })).toEqual(['F-001', 'F-004'])
  })

  it('applies `eq` sensitive to case and accents', async () => {
    expect(await numbers({ filter: 'client eq "Éodia"' })).toEqual(['F-001'])
    expect(await numbers({ filter: 'client eq "eodia"' })).toEqual([])
  })

  it('applies `eq_ci` insensitive to case AND accents', async () => {
    // `fold_v1` is what works here: without it, none of these three forms would find
    // the row.
    for (const typed of ['eodia', 'EODIA', 'éodia', 'Eodia']) {
      expect(await numbers({ filter: `client eq_ci "${typed}"` })).toEqual(['F-001'])
    }
  })

  it('searches a substring without caring about accents', async () => {
    expect(await numbers({ filter: 'client contains "ecole"' })).toEqual(['F-003'])
    expect(await numbers({ filter: 'client starts_with "ZEB"' })).toEqual(['F-002'])
    expect(await numbers({ filter: 'client ends_with "SARL"' })).toEqual(['F-002'])
  })

  it('treats a typed `%` as a character, not as a wildcard', async () => {
    // Without escaping, this filter would bring back the four non-null rows.
    expect(await numbers({ filter: 'client contains "100%"' })).toEqual(['F-004'])
    expect(await numbers({ filter: 'client contains "%"' })).toEqual(['F-004'])
  })

  it('treats a typed `_` as a character, not as a wildcard', async () => {
    expect(await numbers({ filter: 'numero contains "F_0"' })).toEqual([])
    expect(await numbers({ filter: 'numero contains "F-0"' })).toHaveLength(5)
  })

  it('applies `in` through a bound array', async () => {
    expect(await numbers({ filter: 'numero in ["F-001", "F-003"]' })).toEqual(['F-001', 'F-003'])
  })

  it('tells `is_null` apart from its negation', async () => {
    expect(await numbers({ filter: 'client is_null' })).toEqual(['F-005'])
    expect(await numbers({ filter: 'not client is_null' })).toHaveLength(4)
  })

  it('does not include NULLs in an inequality, as SQL requires', async () => {
    // `client ne "Éodia"` does NOT return F-005: in SQL, NULL <> 'x' is NULL, hence
    // false. The kernel does not correct that semantics, it exposes it as is.
    const r = await numbers({ filter: 'client ne "Éodia"' })
    expect(r).not.toContain('F-005')
    expect(r).toEqual(['F-002', 'F-003', 'F-004'])
  })
})

describe('boolean combinations', () => {
  it('gives `and` precedence over `or`, against the server', async () => {
    // `payee eq false and montant gt 900 or numero eq "F-001"` reads as
    // `(payee=false and montant>900) or numero='F-001'`.
    expect(
      await numbers({ filter: 'payee eq false and montant gt 900 or numero eq "F-001"' }),
    ).toEqual(['F-001', 'F-003'])
  })

  it('lets parentheses take precedence', async () => {
    expect(
      await numbers({ filter: 'payee eq false and (montant gt 900 or numero eq "F-001")' }),
    ).toEqual(['F-003'])
  })
})

describe('sorting', () => {
  it('orders numbers numerically', async () => {
    // The AMOUNTS are asserted, not the numbers: two rows carry 250.50 and their
    // relative order comes from the `_id` tie-break, which insertion does not fix.
    // `numeric` is returned as a STRING, at the declared scale — "50.0000000000" — so
    // that an amount never loses precision through a JavaScript double.
    const ascending = await listRecords(pools, ctx, { tableId, sort: 'montant' })
    expect(ascending.rows.map((r) => Number(r.montant))).toEqual([50, 100, 250.5, 250.5, 999.99])

    const descending = await listRecords(pools, ctx, { tableId, sort: '-montant' })
    expect(descending.rows.map((r) => Number(r.montant))).toEqual([999.99, 250.5, 250.5, 100, 50])
  })

  it('breaks ties stably from one call to the next', async () => {
    // F-002 and F-005 carry the same amount. Without the `_id` tie-break, their
    // relative order could change between two pages — and pagination would skip rows.
    const a = await listRecords(pools, ctx, { tableId, sort: 'montant' })
    const b = await listRecords(pools, ctx, { tableId, sort: 'montant' })
    expect(a.rows.map((r) => r.numero)).toEqual(b.rows.map((r) => r.numero))
    expect(a.sql).toContain('"_id" ASC')
  })

  it('orders text with the ICU collation, not the instance one', async () => {
    // "école" sorts between "Éodia" and "remise" under a linguistic collation; under
    // collation C, the accented lowercase letter would come after "Zebra".
    const r = await listRecords(pools, ctx, { tableId, sort: 'client' })
    expect(r.sql).toContain('COLLATE "und-x-icu"')
    const clients = r.rows.map((row) => row.client)
    expect(clients).toEqual(['école du Nord', 'Éodia', 'remise 100% garantie', 'Zebra SARL', null])
  })
})

describe('refusals', () => {
  it('refuses a non-existent field just like a masked one', async () => {
    expect(await codeOf(numbers({ filter: 'salaire gte 1' }))).toBe('FILTER_FIELD_UNKNOWN')
  })

  it('refuses an operator the type does not declare', async () => {
    expect(await codeOf(numbers({ filter: 'payee gt true' }))).toBe('FILTER_OPERATOR_INVALID')
  })

  it('refuses a non-coercible value BEFORE touching the server', async () => {
    // The server would return a 22P02 translated into an internal error; the contract
    // requires a 400.
    expect(await codeOf(numbers({ filter: 'montant gt "beaucoup"' }))).toBe('FILTER_VALUE_INVALID')
  })

  it('refuses to combine a cursor with an explicit sort', async () => {
    // A cursor compared on `_id` alone would skip or repeat rows as soon as the order
    // is no longer that of `_id`.
    expect(
      await codeOf(
        listRecords(pools, ctx, {
          tableId,
          sort: 'montant',
          after: '0195b1f4-6a2e-7c3d-8e9f-1a2b3c4d5e6f',
        }),
      ),
    ).toBe('CURSOR_INVALID')
  })
})

describe('pagination', () => {
  it('walks every row without duplicate or gap', async () => {
    // The reference is the single page, not the insertion order: what the test checks
    // is that splitting into pages returns EXACTLY the same sequence.
    const whole = await listRecords(pools, ctx, { tableId, limit: 50 })
    const expected = whole.rows.map((r) => r.numero)

    const seen: unknown[] = []
    let after: string | undefined

    for (let page = 0; page < 10; page++) {
      const r = await listRecords(pools, ctx, { tableId, limit: 2, after })
      seen.push(...r.rows.map((row) => row.numero))
      if (!r.hasNextPage) break
      // The cursor is opaque and comes from the previous page: it carries the sort-key
      // values, so this walk stays correct under any sort, not just under `_id`.
      after = r.nextCursor ?? undefined
    }

    expect(seen).toEqual(expected)
    expect(new Set(seen).size).toBe(5)
  })
})
