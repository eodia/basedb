import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Structure proposals — chapter 09 §7, end to end: an agent proposes, nothing changes, a
 * person approves, and the change is made by the ordinary operations — every check made
 * again at that moment.
 */

const TENANT = 't8p2qrs'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminSession: string
let sql: pg.Client
let crm: { baseId: string; schemaName: string }
let rh: { baseId: string; schemaName: string }
let clients: { tableId: string; name: string }
let commerciaux: string
/** An agent of the administrator, and one of Alice, who manages CRM through her group. */
let agent: RequestContext
let aliceAgent: RequestContext
let aliceToken: { id: string; secret: string }

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
}

const tokenContext = (secret: string) =>
  kernel.openTokenContext({ secret, surface: 'mcp', requestId: randomUUID() })

async function tableExists(schema: string, table: string): Promise<boolean> {
  const { rows } = await sql.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
    [schema, table],
  )
  return rows.length === 1
}

async function columnsOf(schema: string, table: string): Promise<string[]> {
  const { rows } = await sql.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    [schema, table],
  )
  return rows.map((r) => r.column_name)
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await kernel.openContext({
    userId: boot.userId,
    requestId: randomUUID(),
    surface: 'rest',
  })
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  crm = await kernel.createBase(admin, { label: 'CRM' })
  const c = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  clients = { tableId: c.tableId, name: c.tableName }
  rh = await kernel.createBase(admin, { label: 'RH' })
  await kernel.createTable(admin, {
    baseId: rh.baseId,
    label: 'Salariés',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })

  const issued = await kernel.createApiToken(admin, {
    label: 'Agent CRM',
    baseId: crm.baseId,
    access: 'write',
    surfaces: ['mcp'],
    sessionId: adminSession,
  })
  agent = await tokenContext(issued.secret)

  // Alice manages CRM through « Commerciaux » — and mints her own agent.
  commerciaux = (await kernel.createGroup(admin, { label: 'Commerciaux', sessionId: adminSession }))
    .id
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: commerciaux, scope: { kind: 'base', id: crm.baseId }, level: 'manage' }],
    sessionId: adminSession,
  })
  const a = await kernel.createUser(admin, {
    email: 'alice@exemple.fr',
    displayName: 'Alice',
    groupIds: [commerciaux],
    sessionId: adminSession,
  })
  const alicePassword = 'un tout autre secret bien long'
  await kernel.changePassword({
    userId: a.user.id,
    current: a.temporaryPassword,
    next: alicePassword,
  })
  const aliceLogin = await kernel.login({ email: 'alice@exemple.fr', password: alicePassword })
  const aliceSession = (await kernel.elevate(aliceLogin.sessionToken, alicePassword)).session
    .sessionId
  const alice = await kernel.openContext({
    userId: a.user.id,
    requestId: randomUUID(),
    surface: 'rest',
  })
  const mine = await kernel.createApiToken(alice, {
    label: 'Agent d’Alice',
    baseId: crm.baseId,
    access: 'write',
    surfaces: ['mcp'],
    sessionId: aliceSession,
  })
  aliceToken = { id: mine.id, secret: mine.secret }
  aliceAgent = await tokenContext(mine.secret)

  sql = new pg.Client({ connectionString: container.getConnectionUri() })
  await sql.connect()
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await kernel?.close()
  await container?.stop()
})

describe('a table proposed by an agent', () => {
  it('changes nothing until a person approves — then exactly what was shown', async () => {
    const proposed = await kernel.agentProposeCreateTable(agent, {
      base: 'crm',
      label: 'Devis',
      description: 'Les devis envoyés aux clients.',
      fields: [
        { label: 'Numéro', kind: 'short_text', required: true },
        { label: 'Montant', kind: 'number' },
      ],
    })
    expect(proposed.status).toBe('proposed')
    expect(proposed.summaryTemplate).toBe('create_table')
    expect(proposed.summaryParams.table_label).toEqual({ value: 'Devis', provenance: 'user_data' })
    expect(proposed.upSql[0]).toContain('CREATE TABLE')
    expect(proposed.token.label).toBe('Agent CRM')
    expect(Date.parse(proposed.expiresAt) - Date.parse(proposed.requestedAt)).toBe(86_400_000)
    // Nothing in the physical schema, nothing in the catalog.
    expect(await tableExists(crm.schemaName, 'devis')).toBe(false)
    expect((await kernel.projectBase(admin, crm.baseId)).tables.map((t) => t.label)).not.toContain(
      'Devis',
    )

    // The queue of the base shows it; the agent reads it back.
    const queue = await kernel.listProposals(admin, { baseId: crm.baseId })
    expect(queue.map((p) => p.id)).toContain(proposed.id)
    expect((await kernel.agentGetProposal(agent, proposed.id)).status).toBe('proposed')

    const applied = await kernel.approveProposal(admin, { proposalId: proposed.id })
    expect(applied.status).toBe('applied')
    expect(applied.decidedBy?.id).toBe(admin.actor.id)
    expect(await columnsOf(crm.schemaName, 'devis')).toEqual(
      expect.arrayContaining(['_id', 'numero', 'montant']),
    )
    expect((await kernel.agentGetProposal(agent, proposed.id)).status).toBe('applied')

    // Approved once, and only once.
    expect(await codeOf(kernel.approveProposal(admin, { proposalId: proposed.id }))).toBe(
      'MIGRATION_STALE',
    )
  })

  it('only the plain kinds are proposed with a new table', async () => {
    expect(
      await codeOf(
        kernel.agentProposeCreateTable(agent, {
          base: 'crm',
          label: 'Liens',
          fields: [{ label: 'Client', kind: 'link' as never }],
        }),
      ),
    ).toBe('REQUEST_INVALID')
  })
})

describe('a field proposed by an agent', () => {
  it('a list of choices, approved, becomes a constrained column', async () => {
    const proposed = await kernel.agentProposeAddField(agent, {
      base: 'crm',
      table: 'clients',
      label: 'Segment',
      kind: 'select',
      options: [{ value: 'pme', label: 'PME' }, { value: 'grand_compte' }],
    })
    expect(proposed.summaryTemplate).toBe('add_field')
    expect(await columnsOf(crm.schemaName, clients.name)).not.toContain('segment')
    await kernel.approveProposal(admin, { proposalId: proposed.id })
    expect(await columnsOf(crm.schemaName, clients.name)).toContain('segment')
    const base = await kernel.projectBase(admin, crm.baseId)
    const table = base.tables.find((t) => t.id === clients.tableId)
    const segment = table?.fields.find((f) => f.label === 'Segment')
    expect(segment?.options?.map((o) => o.value)).toEqual(['pme', 'grand_compte'])
  })

  it('a link: same base only, never cascading, and a target it cannot see does not exist', async () => {
    const link = (target: string, onDelete?: string) =>
      kernel.agentProposeAddField(agent, {
        base: 'crm',
        table: 'devis',
        label: 'Client',
        kind: 'link',
        target,
        ...(onDelete === undefined ? {} : { onDelete }),
      })
    expect(await codeOf(link('clients', 'cascade'))).toBe('MCP_CASCADE_FORBIDDEN')
    expect(await codeOf(link('salaries'))).toBe('RESOURCE_NOT_FOUND')
    expect(await codeOf(link('nexiste_pas'))).toBe('RESOURCE_NOT_FOUND')

    const proposed = await link('clients')
    expect(proposed.summaryTemplate).toBe('add_link_field')
    expect(proposed.affectedObjects.map((o) => o.role)).toEqual(['modified', 'referenced'])
    await kernel.approveProposal(admin, { proposalId: proposed.id })
    expect(await columnsOf(crm.schemaName, 'devis')).toContain('clients_id')
  })

  it('a second proposal on the same object replaces the first', async () => {
    const first = await kernel.agentProposeAddField(agent, {
      base: 'crm',
      table: 'clients',
      label: 'Remarque',
      kind: 'short_text',
    })
    const second = await kernel.agentProposeAddField(agent, {
      base: 'crm',
      table: 'clients',
      label: 'Remarque',
      kind: 'long_text',
    })
    expect((await kernel.agentGetProposal(agent, first.id)).status).toBe('superseded')
    expect((await kernel.agentGetProposal(agent, second.id)).status).toBe('proposed')
    await kernel.rejectProposal(admin, { proposalId: second.id })
  })
})

describe('the decision', () => {
  it('a refusal is recorded, closes the proposal, and cannot be approved afterwards', async () => {
    const proposed = await kernel.agentProposeAddField(agent, {
      base: 'crm',
      table: 'clients',
      label: 'Chiffre d’affaires',
      kind: 'number',
    })
    const rejected = await kernel.rejectProposal(admin, { proposalId: proposed.id })
    expect(rejected.status).toBe('rejected')
    expect(rejected.decidedBy?.id).toBe(admin.actor.id)
    expect((await kernel.agentGetProposal(agent, proposed.id)).status).toBe('rejected')
    expect(await codeOf(kernel.approveProposal(admin, { proposalId: proposed.id }))).toBe(
      'MIGRATION_STALE',
    )
    expect(await columnsOf(crm.schemaName, clients.name)).not.toContain('chiffre_d_affaires')
  })

  it('a structure changed since the proposal: PROPOSAL_STALE, nothing applied', async () => {
    const proposed = await kernel.agentProposeAddField(agent, {
      base: 'crm',
      table: 'clients',
      label: 'Pays',
      kind: 'short_text',
    })
    await kernel.addField(admin, { tableId: clients.tableId, label: 'Ville', kind: 'short_text' })
    expect(await codeOf(kernel.approveProposal(admin, { proposalId: proposed.id }))).toBe(
      'PROPOSAL_STALE',
    )
    expect(await columnsOf(crm.schemaName, clients.name)).not.toContain('pays')
    await kernel.rejectProposal(admin, { proposalId: proposed.id })
  })

  it('after 24 hours: PROPOSAL_EXPIRED, and it stays expired', async () => {
    const proposed = await kernel.agentProposeAddField(agent, {
      base: 'crm',
      table: 'clients',
      label: 'Téléphone',
      kind: 'short_text',
    })
    await sql.query(
      `UPDATE _basedb.migration SET requested_at = now() - interval '25 hours' WHERE id = $1`,
      [proposed.id],
    )
    expect(await codeOf(kernel.approveProposal(admin, { proposalId: proposed.id }))).toBe(
      'PROPOSAL_EXPIRED',
    )
    expect((await kernel.agentGetProposal(agent, proposed.id)).status).toBe('expired')
  })

  it('a proposal is read back by its author only', async () => {
    const proposed = await kernel.agentProposeAddField(agent, {
      base: 'crm',
      table: 'clients',
      label: 'Courriel',
      kind: 'short_text',
    })
    expect(await codeOf(kernel.agentGetProposal(aliceAgent, proposed.id))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    await kernel.rejectProposal(admin, { proposalId: proposed.id })
  })

  it('no more than five open proposals per token', async () => {
    const open: string[] = []
    for (let i = 1; i <= 5; i++) {
      open.push(
        (
          await kernel.agentProposeAddField(agent, {
            base: 'crm',
            table: 'clients',
            label: `Champ ${i}`,
            kind: 'short_text',
          })
        ).id,
      )
    }
    expect(
      await codeOf(
        kernel.agentProposeAddField(agent, {
          base: 'crm',
          table: 'clients',
          label: 'Champ 6',
          kind: 'short_text',
        }),
      ),
    ).toBe('TOO_MANY_OPEN_PROPOSALS')
    for (const id of open) await kernel.rejectProposal(admin, { proposalId: id })
  })
})

describe('the person behind the token (§7.6)', () => {
  it('rights lowered since the proposal: AUTHORIZATION_REVOKED, and no new proposal', async () => {
    const proposed = await kernel.agentProposeAddField(aliceAgent, {
      base: 'crm',
      table: 'clients',
      label: 'Origine',
      kind: 'short_text',
    })
    await kernel.applyAccessChanges(admin, {
      changes: [{ groupId: commerciaux, scope: { kind: 'base', id: crm.baseId }, level: 'edit' }],
      sessionId: adminSession,
    })
    expect(await codeOf(kernel.approveProposal(admin, { proposalId: proposed.id }))).toBe(
      'AUTHORIZATION_REVOKED',
    )
    expect(await columnsOf(crm.schemaName, clients.name)).not.toContain('origine')
    expect(
      await codeOf(
        kernel.agentProposeAddField(await tokenContext(aliceToken.secret), {
          base: 'crm',
          table: 'clients',
          label: 'Source',
          kind: 'short_text',
        }),
      ),
    ).toBe('PERMISSION_DENIED')
    await kernel.applyAccessChanges(admin, {
      changes: [{ groupId: commerciaux, scope: { kind: 'base', id: crm.baseId }, level: 'manage' }],
      sessionId: adminSession,
    })
    await kernel.rejectProposal(admin, { proposalId: proposed.id })
  })

  it('a token revoked since the proposal: AUTHORIZATION_REVOKED', async () => {
    const proposed = await kernel.agentProposeAddField(aliceAgent, {
      base: 'crm',
      table: 'clients',
      label: 'Canal',
      kind: 'short_text',
    })
    await kernel.revokeApiToken(admin, { tokenId: aliceToken.id, sessionId: adminSession })
    expect(await codeOf(kernel.approveProposal(admin, { proposalId: proposed.id }))).toBe(
      'AUTHORIZATION_REVOKED',
    )
  })

  it('the queue is for those who manage the structure', async () => {
    const reader = await kernel.createUser(admin, {
      email: 'lecteur@exemple.fr',
      displayName: 'Lecteur',
      sessionId: adminSession,
    })
    const ctx = await kernel.openContext({
      userId: reader.user.id,
      requestId: randomUUID(),
      surface: 'rest',
    })
    expect(await codeOf(kernel.listProposals(ctx, { baseId: crm.baseId }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })
})
