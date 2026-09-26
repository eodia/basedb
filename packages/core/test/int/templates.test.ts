import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProviderTransport } from '../../src/ai/draft.js'
import { createBase } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { Pools } from '../../src/runtime/pool.js'
import { deleteTemplate, importTemplate, listTemplates } from '../../src/templates/catalog.js'
import { draftTemplate } from '../../src/templates/draft.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Base templates in the kernel — chapter 20.
 *
 * The provider is scripted: each test says what the model answers and reads back what the
 * kernel sent it. What these guard: the AI receives the sentence, the previous proposal and
 * the date — nothing of any base; its proposal is repaired and the repair is said; an
 * unusable one is refused; proposing a base demands the right to build in the project;
 * only an administrator of the instance imports a template, which then wins over the others.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext
let member: RequestContext
let projectId = ''

let script: unknown[] = []
const sent: Array<Record<string, unknown>> = []
const transport: ProviderTransport = async (request) => {
  sent.push(request.payload)
  return { text: JSON.stringify(script.shift() ?? {}), inputTokens: 1, outputTokens: 1 }
}

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

const contextOf = (id: string): RequestContext => {
  const now = new Date()
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-0000000000d0',
    actor: { kind: 'user', id },
    tenantId: TENANT_REF,
    surface: 'ui',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

const proposal = {
  template: {
    label: 'Club de tennis',
    summary: 'Les adhérents et leurs réservations.',
    tables: [
      {
        key: 'adherents',
        label: 'Adhérents',
        fields: [
          { label: 'Nom', kind: 'short_text' },
          { label: 'Niveau', kind: 'select', options: ['Débutant', 'Confirmé'] },
        ],
      },
    ],
    rows: { adherents: [{ Nom: 'Léa', Niveau: 'Expert' }] },
    views: [
      { table: 'adherents', label: 'Par niveau', kind: 'kanban', spec: { group_by: 'Niveau' } },
    ],
  },
  explanation: 'Une table des adhérents, classés par niveau.',
}

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
  const ids = await pools.withConnection('catalog', async (exec) => {
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
    const [m] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user
         (tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
       VALUES ($1, 'alice@exemple.fr', 'Alice', false, false, $2, $2) RETURNING id`,
      [t.id, t.created_by],
      'insert',
    )
    await exec.query('COMMIT')
    return { admin: t.created_by, member: m.id }
  })
  admin = contextOf(ids.admin)
  member = contextOf(ids.member)
  projectId = (await createBase(pools, admin, { label: 'Amorce' })).projectId
}, 240_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('a template proposed by the AI', () => {
  it('sends the sentence and the date, and nothing of any base', async () => {
    script = [proposal]
    sent.length = 0
    const draft = await draftTemplate(pools, admin, transport, {
      projectId,
      request: 'Gérer mon club de tennis',
    })
    expect(Object.keys(sent[0] ?? {}).sort()).toEqual(['intent', 'request', 'today'])
    expect(sent[0]).toMatchObject({ intent: 'template_draft', request: 'Gérer mon club de tennis' })
    expect(draft.template.key).toBe('club-de-tennis')
    expect(draft.explanation).toBe('Une table des adhérents, classés par niveau.')
    // The row's unknown choice is dropped, and said.
    expect(draft.template.rows.adherents?.[0]).toEqual({ Nom: 'Léa' })
    expect(draft.issues).toEqual([
      { path: 'rows.adherents[0].Niveau', message: 'choix « Expert » inconnu' },
    ])
  })

  it('refines the previous proposal, which travels with the new sentence', async () => {
    script = [proposal]
    sent.length = 0
    await draftTemplate(pools, admin, transport, {
      projectId,
      request: 'Ajoute les réservations de courts',
      previous: proposal.template,
    })
    expect((sent[0]?.previous as { label: string }).label).toBe('Club de tennis')
  })

  it('is refused when nothing of it holds', async () => {
    script = [{ template: { label: 'Vide', summary: '', tables: [] }, explanation: '' }]
    const error = await failure(
      draftTemplate(pools, admin, transport, { projectId, request: 'Rien' }),
    )
    expect(error.code).toBe('AI_RESPONSE_UNUSABLE')
  })

  it('demands the right to build in the project', async () => {
    const error = await failure(
      draftTemplate(pools, member, transport, { projectId, request: 'Un club' }),
    )
    expect(['ADMIN_REQUIRED', 'RESOURCE_NOT_FOUND']).toContain(error.code)
  })
})

describe('the templates of the instance', () => {
  const config = { url: null, targets: { allowHttp: false, allowPrivate: false } }

  it('are imported by an administrator only, and win over the carried ones', async () => {
    const own = { ...proposal.template, key: 'demo', label: 'Notre démo', rows: {} }
    expect((await failure(importTemplate(pools, member, own))).code).toBe('ADMIN_REQUIRED')
    const invalid = await failure(importTemplate(pools, admin, { label: 'Sans table', tables: [] }))
    expect(invalid.code).toBe('TEMPLATE_INVALID')

    await importTemplate(pools, admin, own)
    const listing = await listTemplates(pools, member, config)
    expect(listing.site).toBeNull()
    expect(listing.templates.find((t) => t.key === 'demo')).toMatchObject({
      label: 'Notre démo',
      source: 'instance',
    })
    expect(listing.templates.find((t) => t.key === 'suivi-tickets')?.source).toBe('bundled')

    await deleteTemplate(pools, admin, 'demo')
    const after = await listTemplates(pools, member, config)
    expect(after.templates.find((t) => t.key === 'demo')?.source).toBe('bundled')
  })
})
