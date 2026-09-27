import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { automationCopilotTurn } from '../../src/ai/automation-copilot.js'
import type { ReadSql } from '../../src/ai/copilot.js'
import type { ProviderTransport } from '../../src/ai/draft.js'
import {
  type Automation,
  createAutomation,
  listAutomations,
  wireSteps,
} from '../../src/automations/catalog.js'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { createRecord } from '../../src/records/create.js'
import { Pools } from '../../src/runtime/pool.js'
import { runConsoleSql } from '../../src/sql/console.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The copilot of the automations against a real database — chapter 17 §6.
 *
 * The provider is scripted: each test says what the model answers and reads back what the
 * kernel sent it. Under test is the kernel's half — what the model sees (the structure, the
 * automation on screen, people by reference, never an identifier nor a value), and what it
 * makes of a proposal: checked as a save would be, handed over whole with what it changes,
 * never saved; set aside with the reason when it does not hold, the model corrected once.
 */

const TENANT_REF = 't4z56fq'
const KEY = 'cle-instance-de-test-0123456789'
const TARGETS = { allowHttp: false, allowPrivate: false }

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let userId: string
let baseId: string
let tachesId: string
let closing: Automation
let readSql: ReadSql

let script: Array<Record<string, unknown>> = []
const sent: Array<Record<string, unknown>> = []

const transport: ProviderTransport = async (request) => {
  sent.push(request.payload)
  const next = script.shift() ?? { message: 'fin' }
  return { text: JSON.stringify(next), inputTokens: 1, outputTokens: 1 }
}

/** The automation on screen as its editor would send it: tables by name. */
const onScreen = () => ({
  label: closing.label,
  description: closing.description,
  enabled: closing.enabled,
  trigger: { ...closing.trigger, table: 'taches' },
  condition: closing.condition,
  actions: wireSteps(closing.actions),
})

const ask = (question: string, options: { readData?: boolean; screen?: boolean } = {}) =>
  automationCopilotTurn(
    pools,
    ctx,
    transport,
    {
      baseId,
      automationId: options.screen === false ? null : closing.id,
      draft: options.screen === false ? null : onScreen(),
      messages: [{ role: 'user', content: question }],
      readData: options.readData ?? false,
    },
    { targets: TARGETS, readSql },
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
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Marie Curie', true, true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t
  })
  userId = bootstrap.created_by
  const now = new Date()
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-0000000000e0',
    actor: { kind: 'user', id: userId },
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

  baseId = (await createBase(pools, ctx, { label: 'Atelier' })).baseId
  const table = await createTable(pools, ctx, {
    baseId,
    label: 'Tâches',
    fields: [
      { label: 'Titre', kind: 'short_text' },
      { label: 'Notes', kind: 'long_text' },
    ],
  })
  tachesId = table.tableId
  await addField(pools, ctx, {
    tableId: tachesId,
    label: 'Statut',
    kind: 'select',
    options: [
      { value: 'a_faire', label: 'À faire' },
      { value: 'fait', label: 'Fait' },
    ],
  })
  await createRecord(pools, ctx, {
    tableId: tachesId,
    values: { titre: 'Poncer la porte', statut: 'a_faire' },
  })
  closing = await createAutomation(pools, ctx, TARGETS, {
    baseId,
    input: {
      label: 'Clôture',
      trigger: { kind: 'record_updated', table: 'taches', fields: ['statut'] },
      condition: 'statut eq "fait"',
      actions: [{ kind: 'update_record', values: { notes: 'Close le {{_maintenant}}' } }],
    },
  })
}, 180_000)

afterAll(async () => {
  for (const name of ['BASEDB_AI_PROVIDER', 'BASEDB_AI_MODEL', 'BASEDB_AI_API_KEY']) {
    Reflect.deleteProperty(process.env, name)
  }
  await pools?.end()
  await container?.stop()
})

describe('what the copilot of the automations sees', () => {
  it('the structure and the automation on screen — people by reference, no identifier', async () => {
    script = [{ message: 'Elle note l’heure quand une tâche passe à Fait.', actions: [] }]
    sent.length = 0
    const answer = await ask('Que fait cette automatisation ?')
    expect(answer.message).toBe('Elle note l’heure quand une tâche passe à Fait.')
    const payload = sent[0] as {
      intent: string
      automation: unknown
      people: unknown
      tables: Array<{ fields: Array<{ name: string }> }>
    }
    expect(payload.intent).toBe('automation_copilot')
    expect(payload.automation).toMatchObject({
      label: 'Clôture',
      saved: true,
      trigger: { kind: 'record_updated', table: 'taches', fields: ['statut'] },
      condition: 'statut eq "fait"',
      steps: [{ id: 'e1', kind: 'update_record', record: 'trigger' }],
    })
    expect(payload.people).toEqual([{ ref: 'p1', name: 'Marie Curie' }])
    expect(payload.tables[0]?.fields.map((f) => f.name)).toContain('statut')
    // Nobody's identifier, and not one value of a row, left for the provider.
    expect(JSON.stringify(payload)).not.toContain(userId)
    expect(JSON.stringify(payload)).not.toContain('Poncer la porte')
  })
})

describe('what it proposes', () => {
  it('a new automation, checked as a save would be, and nothing saved', async () => {
    script = [
      {
        message: 'Je propose une automatisation qui prévient Marie.',
        actions: [
          {
            type: 'automation',
            target: 'new',
            label: 'Tâche terminée',
            trigger: { kind: 'record_updated', table: 'taches', fields: ['statut'] },
            condition: 'statut eq "fait"',
            steps: [{ kind: 'notify', users: ['p1'], message: '{{titre}} est terminée' }],
          },
        ],
      },
    ]
    const before = (await listAutomations(pools, ctx, { baseId })).length
    const answer = await ask('Préviens Marie quand une tâche est finie', { screen: false })
    expect(answer.dropped).toEqual([])
    const [action] = answer.actions
    expect(action).toMatchObject({ type: 'automation', target: 'new', aiSteps: 0 })
    // The reference is brought back to the person it stood for; the table to its key.
    expect(action?.definition.trigger.table).toBe(tachesId)
    expect(action?.definition.actions).toMatchObject([
      { id: 'e1', kind: 'notify', users: [userId], record: 'trigger' },
    ])
    expect(action?.changes).toEqual([
      'Quand une ligne est modifiée dans Tâches',
      'Seulement si statut eq "fait"',
      'e1 · Prévenir quelqu’un : « {{titre}} est terminée »',
    ])
    expect((await listAutomations(pools, ctx, { baseId })).length).toBe(before)
  })

  it('changes to the one on screen, its steps kept, said line by line', async () => {
    script = [
      {
        message: 'Je propose de faire résumer la tâche par l’IA.',
        actions: [
          {
            type: 'automation',
            target: 'current',
            steps: [
              { id: 'e1', kind: 'update_record', values: { notes: 'Close le {{_maintenant}}' } },
              { kind: 'ai', prompt: 'Résume {{titre}}', answer: 'short_text' },
              { kind: 'update_record', values: { notes: '{{e2.reponse}}' } },
            ],
          },
        ],
      },
    ]
    const answer = await ask('Fais résumer la tâche par l’IA dans les notes')
    const [action] = answer.actions
    expect(action).toMatchObject({ target: 'current', aiSteps: 1 })
    expect(action?.changes).toEqual([
      'Ajoute e2 · Demander à l’IA : « Résume {{titre}} »',
      'Ajoute e3 · Modifier une ligne : notes',
    ])
    // The label and the trigger are the screen's; the consent is the person's to give.
    expect(action?.definition).toMatchObject({ label: 'Clôture', condition: 'statut eq "fait"' })
    expect(action?.definition.actions[1]).toMatchObject({ kind: 'ai', consent: false })
  })

  it('sets aside what does not hold, and has the model correct it once', async () => {
    script = [
      {
        message: 'Voici.',
        actions: [
          {
            type: 'automation',
            target: 'new',
            trigger: { kind: 'record_created', table: 'taches' },
            steps: [{ kind: 'update_record', values: { priorite: 'haute' } }],
          },
        ],
      },
      {
        message: 'Voici, corrigé.',
        actions: [
          {
            type: 'automation',
            target: 'new',
            trigger: { kind: 'record_created', table: 'taches' },
            steps: [{ kind: 'update_record', values: { notes: 'À trier' } }],
          },
        ],
      },
    ]
    sent.length = 0
    const answer = await ask('Marque les nouvelles tâches comme prioritaires', { screen: false })
    const rejected = (sent[1] as { rejected?: { reasons: string[] } }).rejected
    expect(rejected?.reasons[0]).toMatch(/automatisation refusée : REQUEST_INVALID \(champ_inconnu/)
    // The names it may use travel with the refusal.
    expect(rejected?.reasons[0]).toContain('taches (titre, notes, statut')
    expect(answer).toMatchObject({ message: 'Voici, corrigé.', dropped: [] })
    expect(answer.actions).toHaveLength(1)
  })

  it('reads rows only with the person’s consent', async () => {
    const read = { kind: 'records', table: 'taches', fields: ['titre'], limit: 5 }
    script = [{ message: '', reads: [read] }, { message: 'Une tâche à faire.' }]
    const refused = await ask('Quelles tâches sont à faire ?')
    expect(refused.reads[0]?.error).not.toBeNull()
    script = [{ message: '', reads: [read] }, { message: 'Une tâche à faire.' }]
    const allowed = await ask('Quelles tâches sont à faire ?', { readData: true })
    expect(allowed.reads[0]).toMatchObject({ error: null, rows: 1 })
  })
})
