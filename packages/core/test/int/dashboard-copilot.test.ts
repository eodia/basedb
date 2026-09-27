import { catalogMigrations } from '@basedb/catalog-schema'
import type { DashboardCopilotAction } from '@basedb/contracts'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ReadSql } from '../../src/ai/copilot.js'
import { type RunQuery, dashboardCopilotTurn } from '../../src/ai/dashboard-copilot.js'
import type { ProviderTransport } from '../../src/ai/draft.js'
import { runBuilderQuery } from '../../src/analytics/query.js'
import { runSqlQuestion } from '../../src/analytics/sql.js'
import { type Dashboard, createDashboard } from '../../src/catalog/dashboards.js'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { createRecord } from '../../src/records/create.js'
import { Pools } from '../../src/runtime/pool.js'
import { runConsoleSql } from '../../src/sql/console.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The copilot of the dashboards against a real database — chapter 18 §2.6.
 *
 * The provider is scripted: each test says what the model answers and reads back what the
 * kernel sent it. Under test is the kernel's half — what it lets the model see and read,
 * and what it makes of the proposals: questions checked and run once, changes made into a
 * dashboard a save would accept, filter values checked against the filters on screen.
 */

const TENANT_REF = 't4z56fq'
const KEY = 'cle-instance-de-test-0123456789'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let baseId: string
let visitesId: string
let visitesName: string
let dashboard: Dashboard

let script: Array<Record<string, unknown>> = []
const sent: Array<Record<string, unknown>> = []

const transport: ProviderTransport = async (request) => {
  sent.push(request.payload)
  const next = script.shift() ?? { message: 'fin' }
  return { text: JSON.stringify(next), inputTokens: 1, outputTokens: 1 }
}

let readSql: ReadSql
let runQuery: RunQuery

const ask = (
  question: string,
  options: { readData?: boolean; dashboardId?: string | null; values?: Record<string, never> } = {},
) =>
  dashboardCopilotTurn(
    pools,
    ctx,
    transport,
    {
      baseId,
      dashboardId: options.dashboardId === undefined ? dashboard.id : options.dashboardId,
      tab: null,
      values: options.values ?? {},
      messages: [{ role: 'user', content: question }],
      readData: options.readData ?? false,
    },
    { runQuery, readSql },
  )

const only = <T extends DashboardCopilotAction['type']>(
  actions: readonly DashboardCopilotAction[],
  type: T,
) => actions.find((a) => a.type === type) as Extract<DashboardCopilotAction, { type: T }>

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
    requestId: '018f3c2a-0000-7000-8000-0000000000d0',
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
  runQuery = (query, constraints) =>
    query.kind === 'sql'
      ? runSqlQuestion(pools, ctx, KEY, container.getConnectionUri(), {
          baseId,
          query,
          constraints,
          timeZone: 'Europe/Paris',
        })
      : runBuilderQuery(pools, ctx, { baseId, query, constraints, timeZone: 'Europe/Paris' })

  const base = await createBase(pools, ctx, { label: 'Chantiers' })
  baseId = base.baseId
  const table = await createTable(pools, ctx, {
    baseId,
    label: 'Visites',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Montant', kind: 'number' },
      { label: 'Jour', kind: 'date' },
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
  for (const values of [
    { nom: 'Maison Dupont', montant: '1200', jour: '2026-01-10', statut: 'urgent' },
    { nom: 'Entrepôt Leroy', montant: '300', jour: '2026-02-03', statut: 'termine' },
    { nom: 'Atelier Martin', montant: '500', jour: '2026-02-20', statut: 'urgent' },
  ]) {
    await createRecord(pools, ctx, { tableId: visitesId, values })
  }
  dashboard = await createDashboard(pools, ctx, {
    baseId,
    input: {
      label: 'Suivi',
      parameters: [{ id: 'statut', label: 'Statut', type: 'category' }],
      cards: [
        {
          id: 'total',
          tab: null,
          x: 0,
          y: 0,
          w: 6,
          h: 4,
          kind: 'question',
          title: 'Montant total',
          query: {
            kind: 'builder',
            source: visitesId,
            aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
          },
          visualization: { type: 'scalar' },
          mappings: [{ parameter: 'statut', target: { column: { field: 'statut' } } }],
        },
      ],
    },
  })
}, 180_000)

afterAll(async () => {
  for (const key of ['BASEDB_AI_PROVIDER', 'BASEDB_AI_MODEL', 'BASEDB_AI_API_KEY']) {
    Reflect.deleteProperty(process.env, key)
  }
  await pools?.end()
  await container?.stop()
})

describe('what the copilot of the dashboards sees', () => {
  it('the tables, the dashboard on screen and its cards’ questions — never rows by default', async () => {
    sent.length = 0
    script = [{ message: 'Bonjour.' }]
    const answer = await ask('Que montre ce tableau ?')
    expect(answer.message).toBe('Bonjour.')
    const payload = sent[0] as Record<string, never>
    expect(payload.data_access).toEqual({ cards: false, records: false, sql: false })
    expect(payload.can_edit_dashboards).toBe(true)
    expect(payload.dashboard).toMatchObject({
      label: 'Suivi',
      filters: [{ id: 'statut', type: 'category', has_value: false }],
      cards: [
        {
          id: 'total',
          title: 'Montant total',
          visualization: 'scalar',
          filters: ['statut'],
          // Its table by name, as the model writes it back.
          query: { source: visitesName },
        },
      ],
    })
    expect(JSON.stringify(payload)).not.toContain('Maison Dupont')
  })

  it('reads no result without consent, even when the model asks', async () => {
    sent.length = 0
    script = [
      { message: 'Je regarde.', reads: [{ kind: 'card', card: 'total' }] },
      { message: 'Je ne peux pas lire les résultats.' },
    ]
    const answer = await ask('Combien au total ?')
    expect(answer.reads).toEqual([
      expect.objectContaining({
        kind: 'card',
        rows: 0,
        error: expect.stringContaining('non autorisée'),
      }),
    ])
    expect(JSON.stringify(sent[1])).not.toContain('2000')
  })

  it('with consent, reads a card under the filters on screen, its columns by their labels', async () => {
    sent.length = 0
    script = [
      { message: 'Je regarde.', reads: [{ kind: 'card', card: 'total' }] },
      { message: 'Le montant des visites urgentes est de 1 700.' },
    ]
    const answer = await ask('Combien pour les urgentes ?', {
      readData: true,
      values: { statut: ['urgent'] } as never,
    })
    expect(answer.reads).toEqual([expect.objectContaining({ kind: 'card', rows: 1, error: null })])
    const observation = (sent[1]?.observations as Array<Record<string, never>>)[0]
    expect(observation?.result).toMatchObject({ rows: [[1700]] })
    expect(answer.message).toContain('1 700')
  })

  it('with consent, reads a question of its own, choices by their labels', async () => {
    sent.length = 0
    script = [
      {
        message: 'Je compte.',
        reads: [
          {
            kind: 'question',
            query: {
              kind: 'builder',
              source: visitesName,
              aggregations: [{ fn: 'count' }],
              breakouts: [{ field: 'statut' }],
            },
          },
        ],
      },
      { message: 'Deux urgentes, une terminée.' },
    ]
    await ask('Combien par statut ?', { readData: true })
    const observation = (sent[1]?.observations as Array<Record<string, never>>)[0]
    expect(JSON.stringify(observation?.result)).toContain('Urgent')
  })
})

describe('what the copilot of the dashboards proposes', () => {
  it('a question, checked and run once, its table by key, shown as the model did not say', async () => {
    script = [
      {
        message: 'Voici le montant par mois.',
        actions: [
          {
            type: 'question',
            label: 'Montant par mois',
            query: {
              kind: 'builder',
              source: visitesName,
              aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
              breakouts: [{ field: 'jour', unit: 'month' }],
            },
          },
        ],
      },
    ]
    const answer = await ask('Le montant par mois ?')
    const question = only(answer.actions, 'question')
    expect(question).toMatchObject({
      label: 'Montant par mois',
      query: { source: visitesId },
      visualization: { type: 'line' },
    })
    expect(answer.dropped).toEqual([])
  })

  it('sets aside a question that does not run, and keeps the model’s correction', async () => {
    sent.length = 0
    const good = {
      kind: 'builder',
      source: visitesName,
      aggregations: [{ fn: 'count' }],
    }
    script = [
      {
        message: 'Voici.',
        actions: [
          {
            type: 'question',
            label: 'Nombre',
            query: { ...good, breakouts: [{ field: 'inexistant' }] },
          },
        ],
      },
      { message: 'Corrigé.', actions: [{ type: 'question', label: 'Nombre', query: good }] },
    ]
    const answer = await ask('Combien de visites ?')
    expect(sent[1]?.rejected).toMatchObject({ reasons: [expect.stringContaining('refusée')] })
    expect(answer.message).toBe('Corrigé.')
    expect(only(answer.actions, 'question').visualization).toEqual({ type: 'scalar' })
    expect(answer.dropped).toEqual([])
  })

  it('changes to the dashboard, made into what a save takes', async () => {
    script = [
      {
        message: 'Voici les modifications.',
        actions: [
          {
            type: 'dashboard',
            target: 'current',
            operations: [
              {
                op: 'add_card',
                title: 'Montant par mois',
                query: {
                  kind: 'builder',
                  source: visitesName,
                  aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
                  breakouts: [{ field: 'jour', unit: 'month' }],
                },
                visualization: { type: 'bar' },
              },
              {
                op: 'add_filter',
                label: 'Période',
                type: 'date',
                field: 'jour',
                default: 'thisyear',
              },
              { op: 'update_card', card: 'total', visualization: { type: 'trend' } },
              { op: 'remove_card', card: 'absente' },
            ],
          },
        ],
      },
    ]
    const answer = await ask('Ajoute le montant par mois et un filtre de période')
    const change = only(answer.actions, 'dashboard')
    expect(change).toMatchObject({
      target: 'current',
      dashboard: dashboard.id,
      basedOn: dashboard.updatedAt,
    })
    expect(change.changes.map((c) => c.kind)).toEqual(['add_card', 'add_filter', 'update_card'])
    // One operation fell, and said why; the others stand.
    expect(answer.dropped).toEqual([expect.stringContaining('carte inconnue')])
    const added = change.content.cards.find((c) => c.title === 'Montant par mois')
    // Under the card already there, tied to the new filter by its date.
    expect(added).toMatchObject({ x: 0, y: 4, w: 12, query: { source: visitesId } })
    const period = change.content.parameters.find((p) => p.label === 'Période')
    expect(period).toMatchObject({ type: 'date', default: 'thisyear' })
    // The filter already there follows the new card by the column the others use.
    expect(added?.mappings).toEqual([
      { parameter: 'statut', target: { column: { field: 'statut' } } },
      { parameter: period?.id, target: { column: { field: 'jour' } } },
    ])
    expect(change.changes[0]?.text).toContain('reliée au filtre « Statut »')
    expect(change.content.cards.find((c) => c.id === 'total')?.visualization?.type).toBe('trend')
  })

  it('a new dashboard, when asked for one', async () => {
    script = [
      {
        message: 'Voici un tableau.',
        actions: [
          {
            type: 'dashboard',
            target: 'new',
            label: 'Visites',
            operations: [
              { op: 'add_text', text: 'Chiffres clés', heading: true },
              {
                op: 'add_card',
                title: 'Visites',
                query: { kind: 'builder', source: visitesName, aggregations: [{ fn: 'count' }] },
              },
              {
                op: 'add_card',
                title: 'Montant',
                query: {
                  kind: 'builder',
                  source: visitesName,
                  aggregations: [{ fn: 'sum', column: { field: 'montant' } }],
                },
              },
            ],
          },
        ],
      },
    ]
    const answer = await ask('Crée un tableau des visites', { dashboardId: null })
    const created = only(answer.actions, 'dashboard')
    expect(created).toMatchObject({ target: 'new', dashboard: null, label: 'Visites' })
    // Two numbers side by side, under the heading.
    expect(created.content.cards.map((c) => [c.kind, c.x, c.y, c.w])).toEqual([
      ['heading', 0, 0, 24],
      ['question', 0, 2, 6],
      ['question', 6, 2, 6],
    ])
  })

  it('values for the filters on screen, a choice named by its label', async () => {
    script = [
      {
        message: 'Je filtre sur les urgentes.',
        actions: [{ type: 'set_filters', values: { statut: ['Urgent'], periode: 'thismonth' } }],
      },
    ]
    const answer = await ask('Seulement les urgentes')
    expect(only(answer.actions, 'set_filters').values).toEqual({ statut: ['urgent'] })
    expect(answer.dropped).toEqual([expect.stringContaining('filtre inconnu')])
  })
})
