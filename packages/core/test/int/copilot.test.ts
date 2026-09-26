import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type CopilotAction, type ReadSql, copilotTurn } from '../../src/ai/copilot.js'
import type { ProviderTransport } from '../../src/ai/draft.js'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { createRecord } from '../../src/records/create.js'
import { Pools } from '../../src/runtime/pool.js'
import { runConsoleSql } from '../../src/sql/console.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The copilot against a real database — chapter 12 §1.6.
 *
 * The provider is scripted: each test says what the model answers, round after round, and
 * reads back what the kernel sent it. What is under test is the kernel's half — what it
 * lets the model read, what it hands back, and what it keeps of the proposals.
 */

const TENANT_REF = 't4z56fq'
const KEY = 'cle-instance-de-test-0123456789'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let baseId: string
let visitesId: string
let visitesName: string

/** What the model answers, in order; and what it was sent. */
let script: Array<Record<string, unknown>> = []
const sent: Array<Record<string, unknown>> = []

const transport: ProviderTransport = async (request) => {
  sent.push(request.payload)
  const next = script.shift() ?? { message: 'fin' }
  return { text: JSON.stringify(next), inputTokens: 1, outputTokens: 1 }
}

let readSql: ReadSql

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

const ask = (question: string, readData: boolean) =>
  copilotTurn(
    pools,
    ctx,
    transport,
    {
      baseId,
      tableId: visitesId,
      messages: [{ role: 'user', content: question }],
      readData,
    },
    readSql,
  )

beforeAll(async () => {
  process.env.BASEDB_AI_PROVIDER = 'mistral'
  process.env.BASEDB_AI_MODEL = 'modele-de-test'
  process.env.BASEDB_AI_API_KEY = 'cle-de-test'

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })
  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
    const now = new Date()
    for (let offset = -1; offset <= 1; offset++) {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1))
      for (const journal of ['ai_call', 'audit_log']) {
        await exec.query(
          `CREATE TABLE _basedb.${journal}_${offset + 1} PARTITION OF _basedb.${journal}
             FOR VALUES FROM ('${from.toISOString()}') TO ('${to.toISOString()}')`,
          [],
          'ddl',
        )
      }
    }
  })
  const bootstrap = await pools.withConnection('catalog', async (exec) => {
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
    return t
  })
  const now = new Date()
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-0000000000c0',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'ui',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
  readSql = (id, sql) =>
    runConsoleSql(pools, ctx, KEY, container.getConnectionUri(), {
      baseId: id,
      sql,
      limit: 50,
      readOnly: true,
    })

  const base = await createBase(pools, ctx, { label: 'Chantiers' })
  baseId = base.baseId
  const table = await createTable(pools, ctx, {
    baseId,
    label: 'Visites',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Montant', kind: 'number' },
    ],
  })
  visitesId = table.tableId
  visitesName = table.tableName
  await addField(pools, ctx, {
    tableId: visitesId,
    label: 'Statut',
    kind: 'select',
    options: [
      { value: 'urgent', label: 'Urgent' },
      { value: 'termine', label: 'Terminé' },
    ],
  })
  await createRecord(pools, ctx, {
    tableId: visitesId,
    values: { nom: 'Maison Dupont', montant: '1200', statut: 'urgent' },
  })
  await createRecord(pools, ctx, {
    tableId: visitesId,
    values: { nom: 'Entrepôt Leroy', montant: '300', statut: 'termine' },
  })
}, 180_000)

afterAll(async () => {
  for (const key of ['BASEDB_AI_PROVIDER', 'BASEDB_AI_MODEL', 'BASEDB_AI_API_KEY']) {
    Reflect.deleteProperty(process.env, key)
  }
  await pools?.end()
  await container?.stop()
})

describe('what the copilot sees', () => {
  it('the structure, what the person may do, and the table on screen — never rows by default', async () => {
    sent.length = 0
    script = [{ message: 'Bonjour.' }]
    const answer = await ask('Que contient cette base ?', false)
    expect(answer.message).toBe('Bonjour.')
    const payload = sent[0]
    expect(payload.data_access).toEqual({ records: false, sql: false })
    expect(payload.focus).toMatchObject({ table: visitesName })
    const tables = payload.tables as Array<{ name: string; fields: Array<Record<string, unknown>> }>
    const statut = tables[0].fields.find((f) => f.name === 'statut')
    expect(statut).toMatchObject({ kind: 'select', options: ['Urgent', 'Terminé'] })
    expect(JSON.stringify(payload)).not.toContain('Maison Dupont')
  })

  it('reads nothing without consent, even when the model asks', async () => {
    sent.length = 0
    script = [
      { message: 'Je regarde.', reads: [{ kind: 'records', table: visitesName, count: true }] },
      { message: 'Je ne peux pas lire les données.' },
    ]
    const answer = await ask('Combien de visites ?', false)
    expect(answer.reads).toEqual([
      expect.objectContaining({
        kind: 'records',
        rows: 0,
        error: expect.stringContaining('non autorisée'),
      }),
    ])
    expect(JSON.stringify(sent[1])).not.toContain('Maison Dupont')
    expect(answer.message).toBe('Je ne peux pas lire les données.')
  })

  it('with consent, reads through the ordinary read and answers from it', async () => {
    sent.length = 0
    script = [
      {
        message: '…',
        reads: [{ kind: 'records', table: visitesName, filter: 'statut eq "urgent"', count: true }],
      },
      { message: 'Il y a une visite urgente : Maison Dupont.' },
    ]
    const answer = await ask('Quelles visites sont urgentes ?', true)
    expect(answer.message).toContain('Maison Dupont')
    expect(answer.reads).toEqual([
      expect.objectContaining({ kind: 'records', rows: 1, error: null }),
    ])
    const observation = (sent[1].observations as Array<{ result: Record<string, unknown> }>)[0]
    expect(observation.result).toMatchObject({ total: 1 })
    expect(JSON.stringify(observation.result.rows)).toContain('Maison Dupont')
    // The consent is the person's: the SQL route is open to them too, as an administrator.
    expect(sent[0].data_access).toEqual({ records: true, sql: true })
  })

  it('reads by SQL in a READ ONLY transaction that nothing can step out of', async () => {
    sent.length = 0
    script = [
      {
        message: '…',
        reads: [
          {
            kind: 'sql',
            sql: `SELECT statut, sum(montant) AS total FROM ${visitesName} GROUP BY statut ORDER BY statut`,
          },
          {
            kind: 'sql',
            sql: `WITH d AS (DELETE FROM ${visitesName} RETURNING 1) SELECT count(*) FROM d`,
          },
          { kind: 'sql', sql: `SELECT 1; DELETE FROM ${visitesName}` },
        ],
      },
      { message: 'Total : 1500.' },
    ]
    const answer = await ask('Montant par statut ?', true)
    expect(answer.reads[0]).toMatchObject({ kind: 'sql', rows: 2, error: null })
    expect(answer.reads[1].error).not.toBeNull()
    expect(answer.reads[2].error).not.toBeNull()
    // The totals went to the model, as the observation of the first read.
    const observed = (sent[1].observations as Array<{ result?: { rows: unknown[][] } }>)[0]
    expect(observed.result?.rows).toHaveLength(2)
    // Both rows are still there: neither the CTE nor the second statement wrote anything.
    const counted = await readSql(baseId, `SELECT count(*) AS n FROM ${visitesName}`)
    expect(Object.values(counted.rows[0])[0]).toBe('2')
  })
})

describe('what the copilot may propose', () => {
  it('keeps what fits the catalog and the rights, and says what it drops', async () => {
    script = [
      {
        message: 'Voici mes propositions.',
        actions: [
          { type: 'filter', table: visitesName, filter: 'montant gt 500', sort: '-montant' },
          { type: 'filter', table: visitesName, filter: 'couleur eq "rouge"' },
          { type: 'sql', sql: `SELECT count(*) FROM ${visitesName}` },
          { type: 'sql', sql: `DELETE FROM ${visitesName}` },
          {
            type: 'add_fields',
            table: visitesName,
            fields: [
              { label: 'Priorité', kind: 'select', options: ['Haute', 'Basse', 'haute'] },
              { label: 'Nom', kind: 'short_text' },
              { label: 'Couleur', kind: 'hologram' },
              { label: 'Résumé', kind: 'long_text', prompt: 'Résume {{Nom}}' },
            ],
          },
          {
            type: 'insert_records',
            table: visitesName,
            records: [
              { nom: 'Villa Bernard', montant: 450, statut: 'Terminé', inconnue: 'x' },
              { Nom: 'Bureaux Martin', montant: 'beaucoup', statut: 'Inexistant' },
            ],
          },
        ],
      },
    ]
    const answer = await ask('Propose-moi des choses', false)
    const types = answer.actions.map((a) => a.type)
    expect(types).toEqual(['filter', 'sql', 'add_fields', 'insert_records'])
    expect(answer.dropped).toHaveLength(2)

    const fields = (answer.actions[2] as Extract<CopilotAction, { type: 'add_fields' }>).fields
    expect(fields.map((f) => [f.label, f.kind])).toEqual([
      ['Priorité', 'select'],
      ['Résumé', 'long_text'],
    ])
    expect(fields[0].options).toEqual(['Haute', 'Basse'])

    const records = (answer.actions[3] as Extract<CopilotAction, { type: 'insert_records' }>)
      .records
    // A choice named by its label is written by its value; what does not fit is left out.
    expect(records).toEqual([
      { nom: 'Villa Bernard', montant: '450', statut: 'termine' },
      { nom: 'Bureaux Martin' },
    ])
  })

  it('proposes a new table with its rows, the rows waiting for the table', async () => {
    script = [
      {
        message: 'Un jeu d’essai.',
        actions: [
          {
            type: 'create_table',
            label: 'Techniciens',
            fields: [
              { label: 'Nom complet', kind: 'short_text' },
              { label: 'Spécialité', kind: 'select', options: ['Plomberie', 'Électricité'] },
              { label: 'Visite', kind: 'link', target: visitesName },
            ],
          },
          {
            type: 'insert_records',
            table: 'Techniciens',
            records: [
              { 'Nom complet': 'Alice Martin', Spécialité: 'Plomberie', Visite: 'Maison Dupont' },
            ],
          },
          { type: 'create_table', label: 'Visites', fields: [] },
        ],
      },
    ]
    const answer = await ask('Crée une table de techniciens avec des exemples', false)
    expect(answer.actions.map((a) => a.type)).toEqual(['create_table', 'insert_records'])
    expect(answer.actions[1]).toMatchObject({
      pending: true,
      records: [
        {
          'Nom complet': 'Alice Martin',
          Spécialité: 'Plomberie',
          Visite: { display: 'Maison Dupont' },
        },
      ],
    })
    expect(answer.dropped[0]).toContain('existe déjà')
  })

  it('takes a table named by its label, or not named at all, as the model often does', async () => {
    script = [
      {
        message: 'Voici des lignes.',
        actions: [
          { type: 'insert_records', table: 'Visites', records: [{ Nom: 'Par libellé' }] },
          { type: 'insert_records', rows: [{ nom: 'Sans table' }] },
          {
            type: 'insert_records',
            table: `b_x."${visitesName}"`,
            records: [{ nom: 'Qualifiée' }],
          },
        ],
      },
    ]
    const answer = await ask('Des lignes', false)
    expect(answer.dropped).toEqual([])
    expect(answer.actions.map((a) => (a.type === 'insert_records' ? a.table : a.type))).toEqual([
      visitesName,
      visitesName,
      visitesName,
    ])
  })

  it('tells the model what it set aside, once, and keeps the corrected answer', async () => {
    sent.length = 0
    script = [
      {
        message: 'Voici 2 clients.',
        actions: [{ type: 'insert_records', table: 'Clients', records: [{ nom: 'A' }] }],
      },
      {
        message: 'Corrigé : sur Visites.',
        actions: [{ type: 'insert_records', table: visitesName, records: [{ nom: 'A' }] }],
      },
    ]
    const answer = await ask('Deux lignes', false)
    expect(sent).toHaveLength(2)
    expect(sent[1].rejected).toMatchObject({
      reasons: ['lignes pour une table inconnue (« Clients »)'],
    })
    expect(answer.message).toBe('Corrigé : sur Visites.')
    expect(answer.actions).toHaveLength(1)
    expect(answer.dropped).toEqual([])
  })

  it('changes only rows it read, by their identifier', async () => {
    script = [
      {
        message: '…',
        actions: [
          {
            type: 'update_records',
            table: visitesName,
            updates: [
              { id: 'pas-un-identifiant', values: { statut: 'Urgent' } },
              { id: '0190a000-0000-7000-8000-000000000001', values: { statut: 'Urgent' } },
            ],
          },
        ],
      },
    ]
    const answer = await ask('Passe-les en urgent', false)
    expect(answer.actions).toEqual([
      {
        type: 'update_records',
        table: visitesName,
        updates: [{ id: '0190a000-0000-7000-8000-000000000001', values: { statut: 'urgent' } }],
      },
    ])
  })

  it('answers the last message of a conversation, and refuses one that ends on its own words', async () => {
    const refused = await failure(
      copilotTurn(
        pools,
        ctx,
        transport,
        { baseId, messages: [{ role: 'assistant', content: 'Bonjour' }] },
        readSql,
      ),
    )
    expect(refused.code).toBe('REQUEST_INVALID')
  })
})
