import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Computed fields — chapter 04 §7 and §7 ter: a formula stored when it can be, computed
 * at read time when it reads the clock or a computed field; lookups, rollups and counts
 * that read through a relation, filtered and sorted like any column.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let access = ''
let base = ''
const clients: Record<string, string> = {}

const auth = () => ({ authorization: `Bearer ${access}` })
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...auth() },
  body: JSON.stringify(body),
})
const read = async <T>(response: Response) => (await response.json()) as T
const DATA = (table: string) => `${V1}/data/${base}/${table}`
const FIELDS = (table: string) => `${V1}/admin/bases/${base}/tables/${table}/fields`

async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: container.getConnectionUri() })
  await client.connect()
  try {
    return (await client.query(text, params)).rows as T[]
  } finally {
    await client.end()
  }
}

async function create(table: string, values: Record<string, unknown>): Promise<string> {
  const response = await app.request(DATA(table), json('POST', { values }))
  expect(response.status).toBe(201)
  return (await read<{ data: { _id: string } }>(response)).data._id
}

async function addField(table: string, body: Record<string, unknown>): Promise<string> {
  const response = await app.request(FIELDS(table), json('POST', body))
  const payload = await read<{ data: { name: string }; code?: string; details?: unknown }>(response)
  if (response.status !== 201) throw new Error(JSON.stringify(payload))
  return payload.data.name
}

async function rows<T>(table: string, query = ''): Promise<T[]> {
  const response = await app.request(`${DATA(table)}${query}`, { headers: auth() })
  const payload = await read<{ data: T[]; code?: string }>(response)
  if (response.status !== 200) throw new Error(JSON.stringify(payload))
  return payload.data
}

const columns = async (table: string) =>
  (
    await sql<{ attname: string }>(
      `SELECT a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped`,
      [base, table],
    )
  ).map((r) => r.attname)

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()

  const [bootstrap] = await sql<{ id: string }>(
    `WITH t AS (
       INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by)
     INSERT INTO _basedb.app_user
       (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
     SELECT created_by, id, 'bootstrap@basedb.local', 'Bootstrap', true, true, created_by, created_by
       FROM t
     RETURNING id`,
    [TENANT_REF],
  )

  app = createApp({ kernel })
  await kernel.setPassword({ userId: bootstrap.id, password: PASSWORD })
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bootstrap@basedb.local', password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = (await read<{ data: { csrf: string } }>(login)).data.csrf
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  access = (await read<{ data: { token: string } }>(issued)).data.token

  const created = await app.request(`${V1}/admin/bases`, json('POST', { label: 'Ventes' }))
  base = (await read<{ data: { name: string } }>(created)).data.name
  const tables: Array<[string, Array<{ label: string; kind: string }>]> = [
    [
      'Clients',
      [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Ville', kind: 'short_text' },
      ],
    ],
    [
      'Factures',
      [
        { label: 'Numéro', kind: 'short_text' },
        { label: 'Montant', kind: 'number' },
        { label: 'Échéance', kind: 'date' },
      ],
    ],
  ]
  for (const [label, fields] of tables) {
    const table = await app.request(
      `${V1}/admin/bases/${base}/tables`,
      json('POST', { label, fields }),
    )
    expect(table.status).toBe(201)
  }
  await app.request(
    `${V1}/admin/bases/${base}/tables/clients/display`,
    json('POST', { field: 'nom' }),
  )
  const link = await app.request(
    `${V1}/admin/bases/${base}/tables/factures/links`,
    json('POST', { label: 'Client', target: 'clients' }),
  )
  expect(link.status).toBe(201)

  clients.acme = await create('clients', { nom: 'ACME', ville: 'Lyon' })
  clients.globex = await create('clients', { nom: 'Globex', ville: 'Nice' })
  clients.initech = await create('clients', { nom: 'Initech', ville: 'Brest' })
  for (const [numero, montant, echeance, client] of [
    ['F1', 100, '2020-01-10', clients.acme],
    ['F2', 250, '2020-02-10', clients.acme],
    ['F3', 40, '2099-01-01', clients.globex],
  ] as const) {
    await create('factures', { numero, montant, echeance, clients_id: client })
  }
}, 180_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('formulas', () => {
  it('stores a formula it can store: a generated column, read-only', async () => {
    const name = await addField('factures', {
      label: 'TTC',
      kind: 'formula',
      formula: { expression: '[Montant] * 1.2' },
    })
    expect(await columns('factures')).toContain(name)
    const list = await rows<{ numero: string; ttc: string }>('factures', '?sort=numero')
    expect(list.map((r) => [r.numero, Number(r.ttc)])).toEqual([
      ['F1', 120],
      ['F2', 300],
      ['F3', 48],
    ])
    const written = await app.request(
      DATA('factures'),
      json('POST', { values: { numero: 'X', ttc: 1 } }),
    )
    expect(written.status).toBeGreaterThanOrEqual(400)
  })

  it('computes a formula that reads the clock at read time, filters and sorts on it', async () => {
    const name = await addField('factures', {
      label: 'Retard',
      kind: 'formula',
      formula: { expression: 'JOURS(AUJOURDHUI(); [Échéance])' },
    })
    // No column: the value exists only when read.
    expect(await columns('factures')).not.toContain(name)
    const late = await rows<{ numero: string; retard: string }>(
      'factures',
      `?filter=${encodeURIComponent('retard gt 0')}&sort=-retard`,
    )
    expect(late.map((r) => r.numero)).toEqual(['F1', 'F2'])
    expect(Number(late[0]?.retard)).toBeGreaterThan(Number(late[1]?.retard))
  })

  it('refuses what it cannot compute, by name', async () => {
    const refused = await app.request(
      FIELDS('factures'),
      json('POST', { label: 'Faux', kind: 'formula', formula: { expression: '[Numéro] * 2' } }),
    )
    expect(await read(refused)).toMatchObject({ code: 'FORMULA_TYPE_MISMATCH' })
    const link = await app.request(
      FIELDS('factures'),
      json('POST', { label: 'Lien', kind: 'formula', formula: { expression: '[Client]' } }),
    )
    expect(await read(link)).toMatchObject({ code: 'FORMULA_LINK_FORBIDDEN' })
  })

  it('rewrites a formula, which becomes computed at read time when it reads the clock', async () => {
    const patched = await app.request(
      `${FIELDS('factures')}/ttc`,
      json('PATCH', { formula: { expression: 'SI(AUJOURDHUI() > [Échéance]; [Montant]; 0)' } }),
    )
    expect(patched.status).toBe(200)
    expect(await columns('factures')).not.toContain('ttc')
    const list = await rows<{ numero: string; ttc: string }>('factures', '?sort=numero')
    expect(list.map((r) => Number(r.ttc))).toEqual([100, 250, 0])
  })
})

describe('reading through a relation', () => {
  it('rolls up and counts the rows that point here, filtered and sorted', async () => {
    await addField('clients', {
      label: 'Total facturé',
      kind: 'rollup',
      rollup: { via: 'clients_id', via_table: 'factures', target: 'montant', aggregate: 'sum' },
    })
    await addField('clients', {
      label: 'Nombre de factures',
      kind: 'count',
      rollup: { via: 'clients_id', via_table: 'factures' },
    })
    const list = await rows<{
      nom: string
      total_facture: string | null
      nombre_de_factures: string
    }>('clients', '?sort=-total_facture')
    expect(
      list.map((r) => [
        r.nom,
        r.total_facture === null ? null : Number(r.total_facture),
        Number(r.nombre_de_factures),
      ]),
    ).toEqual([
      // Descending puts nulls first, as a sort on a column does.
      ['Initech', null, 0],
      ['ACME', 350, 2],
      ['Globex', 40, 1],
    ])
    const big = await rows<{ nom: string }>(
      'clients',
      `?filter=${encodeURIComponent('nombre_de_factures gte 1 and total_facture gt 100')}`,
    )
    expect(big.map((r) => r.nom)).toEqual(['ACME'])
  })

  it('looks up a field of the row a link designates', async () => {
    await addField('factures', {
      label: 'Ville du client',
      kind: 'lookup',
      rollup: { via: 'clients_id', target: 'ville' },
    })
    const list = await rows<{ numero: string; ville_du_client: string }>(
      'factures',
      `?filter=${encodeURIComponent('ville_du_client eq "Lyon"')}&sort=numero`,
    )
    expect(list.map((r) => [r.numero, r.ville_du_client])).toEqual([
      ['F1', 'Lyon'],
      ['F2', 'Lyon'],
    ])
  })

  it('looks up several rows as a list, asked what it holds', async () => {
    await addField('clients', {
      label: 'Numéros',
      kind: 'lookup',
      rollup: { via: 'clients_id', via_table: 'factures', target: 'numero' },
    })
    const list = await rows<{ nom: string; numeros: string[] | null }>('clients', '?sort=nom')
    expect(list.map((r) => [r.nom, r.numeros])).toEqual([
      ['ACME', ['F1', 'F2']],
      ['Globex', ['F3']],
      ['Initech', null],
    ])
    const found = await rows<{ nom: string }>(
      'clients',
      `?filter=${encodeURIComponent('numeros has_any "F3"')}`,
    )
    expect(found.map((r) => r.nom)).toEqual(['Globex'])
  })

  it('lets a formula cite a rollup, and summarises it over the whole filter', async () => {
    await addField('clients', {
      label: 'Total TTC',
      kind: 'formula',
      formula: { expression: 'SIVIDE([Total facturé]; 0) * 1.2' },
    })
    const list = await rows<{ nom: string; total_ttc: string }>('clients', '?sort=nom')
    expect(list.map((r) => Number(r.total_ttc))).toEqual([420, 48, 0])

    const response = await app.request(
      `${DATA('clients')}/aggregate?aggregates=total_facture:sum,nombre_de_factures:max`,
      { headers: auth() },
    )
    const { data } = await read<{ data: { values: Record<string, unknown> } }>(response)
    expect(Number(data.values['total_facture:sum'])).toBe(390)
    expect(Number(data.values['nombre_de_factures:max'])).toBe(2)
  })

  it('publishes what each computed field computes', async () => {
    const meta = await read<{
      data: { tables: Array<{ name: string; fields: Array<Record<string, unknown>> }> }
    }>(await app.request(`${V1}/meta/bases/${base}`, { headers: auth() }))
    const fields = meta.data.tables.find((t) => t.name === 'clients')?.fields ?? []
    expect(fields.find((f) => f.name === 'total_facture')).toMatchObject({
      kind: 'rollup',
      read_only: true,
      sortable: true,
      computed: {
        result_kind: 'number',
        stored: false,
        via: { field: 'clients_id', table: 'factures', direction: 'incoming', reached: 'factures' },
        target: 'montant',
        aggregate: 'sum',
      },
    })
    expect(fields.find((f) => f.name === 'numeros')).toMatchObject({
      operators: ['has_any', 'has_all', 'is_null'],
      sortable: false,
      computed: { multiple: true, result_kind: 'short_text' },
    })
    // Typed in French; read back in English by a screen that is not French.
    expect(fields.find((f) => f.name === 'total_ttc')).toMatchObject({
      computed: { expression: 'IFBLANK([Total facturé], 0) * 1.2', stored: false },
    })
  })

  it('writes formulas in French for a French screen, and reads English from any', async () => {
    await addField('clients', {
      label: 'Nom court',
      kind: 'formula',
      formula: { expression: 'IF(ISBLANK([Nom]), "?", LEFT(UPPER([Nom]), 3))' },
    })
    const names = await rows<{ nom: string; nom_court: string }>('clients', '?sort=nom')
    expect(names.map((r) => r.nom_court)).toEqual(['ACM', 'GLO', 'INI'])

    const meta = await read<{
      data: { tables: Array<{ name: string; fields: Array<Record<string, unknown>> }> }
    }>(
      await app.request(`${V1}/meta/bases/${base}`, {
        headers: { ...auth(), 'x-basedb-locale': 'fr' },
      }),
    )
    const fields = meta.data.tables.find((t) => t.name === 'clients')?.fields ?? []
    expect(fields.find((f) => f.name === 'nom_court')).toMatchObject({
      computed: { expression: 'SI(ESTVIDE([Nom]); "?"; GAUCHE(MAJUSCULE([Nom]); 3))' },
    })
  })
})
