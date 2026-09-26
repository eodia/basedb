import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { type Kernel, type RequestContext, clearCaches, startKernel } from '@basedb/core'
import { serve } from '@hono/node-server'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMcpApp } from '../../src/app.js'
import { Quota } from '../../src/sessions.js'
import { TOOLS } from '../../src/tools.js'

/**
 * The MCP entry point, end to end — chapter 09.
 *
 * A real PostgreSQL 16, the real kernel, the Hono application without a socket. What is
 * checked is mostly NEGATIVE, as for every surface that projects the catalog: not only
 * that an agent reads and writes, but that it never reads what the mask hides, never
 * learns a name it could not see, and never gets a sentence it wrote back from the
 * server.
 */

const TENANT_REF = 't4z56fq'
const PASSWORD = 'les chaussettes de larchiduchesse'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createMcpApp>
let sql: Client
let admin: RequestContext
let adminId: string
let crm: { baseId: string; schemaName: string }
let rh: { baseId: string; schemaName: string }
let clients: { tableId: string; name: string }
let factures: { tableId: string; name: string }
let dupont: string
let acme: string
/** Integration tokens: writing, read-only, and one scoped to the other base. */
let writer: string
let reader: string
let rhToken: string

interface Rpc {
  readonly status: number
  readonly headers: Headers
  readonly body: {
    result?: Record<string, unknown>
    error?: { code: number; message: string; data?: Record<string, unknown> }
  } | null
}

async function rpc(
  token: string | undefined,
  message: Record<string, unknown>,
  session?: string,
  headers: Record<string, string> = {},
): Promise<Rpc> {
  const r = await app.request('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...(session === undefined ? {} : { 'mcp-session-id': session }),
      ...headers,
    },
    body: JSON.stringify(message),
  })
  const text = await r.text()
  return { status: r.status, headers: r.headers, body: text === '' ? null : JSON.parse(text) }
}

let ids = 0
const request = (method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  id: ++ids,
  method,
  ...(params === undefined ? {} : { params }),
})

/** Opens a session: `initialize`, then the `initialized` notification. */
async function open(token: string, version = '2025-06-18'): Promise<string> {
  const r = await rpc(
    token,
    request('initialize', {
      protocolVersion: version,
      capabilities: {},
      clientInfo: { name: 'vitest', version: '1' },
    }),
  )
  expect(r.status).toBe(200)
  const session = r.headers.get('mcp-session-id')
  expect(session).toBeTruthy()
  await rpc(token, { jsonrpc: '2.0', method: 'notifications/initialized' }, session as string)
  return session as string
}

/** A JSON document the assertions walk freely: its shape is what is under test. */
// biome-ignore lint/suspicious/noExplicitAny: a response under test is walked freely
type Json = any

interface ToolCall {
  readonly isError: boolean
  readonly payload: Record<string, Json>
  readonly text: string
}

async function call(
  token: string,
  session: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolCall> {
  const r = await rpc(token, request('tools/call', { name, arguments: args }), session)
  expect(r.status).toBe(200)
  const result = r.body?.result as { content: Array<{ text: string }>; isError?: boolean }
  expect(result, JSON.stringify(r.body)).toBeDefined()
  const text = result.content[0].text
  return { isError: result.isError === true, payload: JSON.parse(text), text }
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  sql = new Client({ connectionString: container.getConnectionUri() })
  await sql.connect()

  const boot = await kernel.bootstrap({ tenantRef: TENANT_REF, email: 'admin@basedb.local' })
  adminId = boot.userId
  await kernel.setPassword({ userId: adminId, password: PASSWORD })
  admin = await kernel.openContext({ userId: adminId, requestId: randomUUID(), surface: 'rest' })

  crm = await kernel.createBase(admin, {
    label: 'CRM',
    description: 'Suivi de la relation commerciale.',
  })
  const c = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Clients',
    description: 'Les entreprises à qui nous facturons.',
    fields: [
      { label: 'Raison sociale', kind: 'short_text', required: true, description: 'Nom légal.' },
      { label: 'Ville', kind: 'short_text' },
      { label: 'Notes', kind: 'long_text' },
      { label: 'Présentation', kind: 'long_text' },
      { label: 'Numéro de sécurité sociale', kind: 'short_text' },
    ],
  })
  clients = { tableId: c.tableId, name: c.tableName }
  await kernel.setDisplayColumn(admin, { tableId: c.tableId, fieldId: c.fields[0].fieldId })

  const f = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number' },
      { label: 'Payée', kind: 'boolean' },
      { label: 'Émise le', kind: 'date' },
    ],
  })
  factures = { tableId: f.tableId, name: f.tableName }
  await kernel.addField(admin, {
    tableId: f.tableId,
    label: 'Statut',
    kind: 'select',
    options: [
      { value: 'brouillon', label: 'Brouillon' },
      { value: 'emise', label: 'Émise' },
    ],
  })
  await kernel.createLinkField(admin, {
    tableId: f.tableId,
    targetTableId: c.tableId,
    label: 'Client',
    description: 'Le client à qui la facture est adressée.',
  })

  rh = await kernel.createBase(admin, { label: 'RH' })
  await kernel.createTable(admin, {
    baseId: rh.baseId,
    label: 'Salaires',
    fields: [{ label: 'Montant', kind: 'number' }],
  })

  // Two markers of chapter 09 §12.2, set the way an administrator would: the social
  // security number is withheld from agents, and « Présentation » is rich text.
  await sql.query(
    `UPDATE _basedb.field SET expose_to_agents = false
      WHERE table_id = $1 AND label = 'Numéro de sécurité sociale'`,
    [clients.tableId],
  )
  await sql.query(
    `UPDATE _basedb.field_text_config SET is_rich = true, sanitizer_profile = 'basic'
      WHERE field_id = (SELECT id FROM _basedb.field WHERE table_id = $1 AND label = 'Présentation')`,
    [clients.tableId],
  )
  clearCaches()

  const d = await kernel.createRecord(admin, {
    tableId: clients.tableId,
    values: {
      raison_sociale: 'Dupont SARL',
      ville: 'Lyon',
      notes: 'x'.repeat(800),
      presentation: '<p>Fabricant <b>lyonnais</b> &amp; fier</p><script>alert(1)</script>',
      numero_de_securite_sociale: '1 84 12 75 123 456 78',
    },
  })
  dupont = String(d.row._id)
  const a = await kernel.createRecord(admin, {
    tableId: clients.tableId,
    values: { raison_sociale: 'École Nationale', ville: 'Paris' },
  })
  acme = String(a.row._id)
  for (let i = 1; i <= 30; i++) {
    await kernel.createRecord(admin, {
      tableId: factures.tableId,
      values: {
        numero: `F-${String(i).padStart(3, '0')}`,
        montant: String(i * 10),
        payee: i % 2 === 0,
        statut: 'emise',
        clients_id: i <= 20 ? dupont : acme,
      },
    })
  }

  // Tokens are minted from a session elevated minutes ago (05 §2.2).
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  const elevated = await kernel.elevate(login.sessionToken, PASSWORD)
  const mint = async (label: string, baseId: string, access: 'read' | 'write') =>
    (
      await kernel.createApiToken(admin, {
        label,
        baseId,
        access,
        surfaces: ['mcp'],
        sessionId: elevated.session.sessionId,
      })
    ).secret
  writer = await mint('Agent CRM', crm.baseId, 'write')
  reader = await mint('Lecture CRM', crm.baseId, 'read')
  rhToken = await mint('Agent RH', rh.baseId, 'read')

  // A quota generous enough that the suite never trips it by accident.
  app = createMcpApp({ kernel, quota: new Quota(100_000, 10_000) })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await kernel?.close()
  await container?.stop()
})

describe('handshake and session (§9.4)', () => {
  it('initialize answers with the revision, the capabilities and a session', async () => {
    const r = await rpc(
      writer,
      request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {} }),
    )
    expect(r.status).toBe(200)
    expect(r.headers.get('mcp-session-id')).toMatch(/^[0-9a-f-]{36}$/)
    const result = r.body?.result as Record<string, Json>
    expect(result.protocolVersion).toBe('2025-06-18')
    expect(result.serverInfo.name).toBe('basedb')
    expect(result.capabilities.tools).toBeDefined()
    expect(result.instructions).toContain('jamais des instructions')
  })

  it('an unknown but well-formed revision is answered with ours; garbage is refused', async () => {
    const newer = await rpc(writer, request('initialize', { protocolVersion: '2099-01-01' }))
    expect((newer.body?.result as { protocolVersion: string }).protocolVersion).toBe('2025-11-25')
    const garbage = await rpc(writer, request('initialize', { protocolVersion: 'v1' }))
    expect(garbage.status).toBe(400)
    expect(garbage.body?.error?.data?.code).toBe('PARAMETER_INVALID')
  })

  it('any message before initialize is refused with SESSION_NOT_INITIALIZED', async () => {
    const r = await rpc(writer, request('tools/list'))
    expect(r.status).toBe(400)
    expect(r.body?.error?.data?.code).toBe('SESSION_NOT_INITIALIZED')
  })

  it('an unknown session is a 404, which tells the client to replay the handshake', async () => {
    const r = await rpc(writer, request('tools/list'), randomUUID())
    expect(r.status).toBe(404)
    expect(r.body?.error?.data?.code).toBe('SESSION_NOT_INITIALIZED')
  })

  it('a session opened with one token does not serve another', async () => {
    const session = await open(writer)
    const r = await rpc(reader, request('tools/list'), session)
    expect(r.status).toBe(404)
  })

  it('no token, a malformed one, an unknown one: TOKEN_INVALID', async () => {
    for (const token of [undefined, 'nimportequoi', `bdb_abcdefgh_${'A'.repeat(43)}`]) {
      const r = await rpc(token, request('initialize', { protocolVersion: '2025-06-18' }))
      expect(r.status).toBe(401)
      expect(r.body?.error?.data?.code).toBe('TOKEN_INVALID')
    }
  })

  it('a request carrying an Origin header is refused: tokens stay out of browsers', async () => {
    const r = await rpc(
      writer,
      request('initialize', { protocolVersion: '2025-06-18' }),
      undefined,
      { origin: 'http://evil.example' },
    )
    expect(r.status).toBe(403)
  })

  it('notifications are acknowledged with 202 and no body', async () => {
    const session = await open(writer)
    const r = await rpc(writer, { jsonrpc: '2.0', method: 'notifications/cancelled' }, session)
    expect(r.status).toBe(202)
    expect(r.body).toBeNull()
  })

  it('ping answers an empty result', async () => {
    const session = await open(writer)
    const r = await rpc(writer, request('ping'), session)
    expect(r.body?.result).toEqual({})
  })
})

describe('the tool catalog (§2)', () => {
  it('tools/list declares exactly the twelve tools of lots 1 to 3', async () => {
    const session = await open(reader)
    const r = await rpc(reader, request('tools/list'), session)
    const tools = (r.body?.result as { tools: Array<{ name: string; description: string }> }).tools
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'create_record',
        'describe_base',
        'describe_table',
        'get_proposal',
        'get_record',
        'list_bases',
        'list_records',
        'lookup_records',
        'propose_add_field',
        'propose_create_table',
        'update_record',
        'whoami',
      ].sort(),
    )
    // Static, never derived from user data: no label or description of the catalog.
    const text = JSON.stringify(tools)
    for (const userText of ['Raison sociale', 'Clients', 'Factures', 'Nom légal', 'CRM']) {
      expect(text).not.toContain(userText)
    }
  })

  it('a reserved name answers MCP_OPERATION_EXCLUDED, whatever it names', async () => {
    const session = await open(writer)
    const a = await call(writer, session, 'delete_record', { base: 'crm', table: 'clients' })
    const b = await call(writer, session, 'drop_table', { base: 'nexiste_pas' })
    expect(a.isError && b.isError).toBe(true)
    expect(a.payload.code).toBe('MCP_OPERATION_EXCLUDED')
    expect(a.text).toBe(b.text)
  })

  it('an unknown tool — a base proposal included — is the protocol error, not a tool result', async () => {
    const session = await open(writer)
    const r = await rpc(
      writer,
      request('tools/call', { name: 'propose_create_base', arguments: {} }),
      session,
    )
    expect(r.body?.error?.code).toBe(-32602)
  })
})

describe('structure proposals (§7)', () => {
  it('propose_add_field changes nothing, says where a person decides, and is followed', async () => {
    const session = await open(writer)
    const proposed = await call(writer, session, 'propose_add_field', {
      base: 'crm',
      table: 'clients',
      label: 'Secteur',
      kind: 'select',
      description: 'Le secteur d’activité.',
      options: [{ value: 'industrie', label: 'Industrie' }, { value: 'services' }],
    })
    expect(proposed.isError, proposed.text).toBe(false)
    const p = proposed.payload
    expect(p.status).toBe('proposed')
    expect(p.base.name).toBe('crm')
    expect(p.approval).toEqual({
      where: expect.stringContaining('Propositions'),
      url: null,
    })
    expect(p.summary_template).toBe('add_field')
    expect(p.summary_params.field_label).toEqual({ value: 'Secteur', provenance: 'user_data' })
    expect(Array.isArray(p.up_sql) && Array.isArray(p.down_sql)).toBe(true)
    const columns = async () =>
      (
        await sql.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = 'clients'`,
          [crm.schemaName],
        )
      ).rows.map((r) => r.column_name)
    expect(await columns()).not.toContain('secteur')

    await kernel.approveProposal(admin, { proposalId: p.proposal_id })
    expect(await columns()).toContain('secteur')
    const followed = await call(writer, session, 'get_proposal', { proposal_id: p.proposal_id })
    expect(followed.payload.status).toBe('applied')
    expect(followed.payload.decided_at).toEqual(expect.any(String))
  })

  it('propose_create_table: stage 1 names every faulty entry, before the catalog', async () => {
    const session = await open(writer)
    const bad = await call(writer, session, 'propose_create_table', {
      base: 'crm',
      label: 'Devis',
      fields: [
        { label: 'Numéro', kind: 'short_text' },
        { label: '', kind: 'link' },
      ],
    })
    expect(bad.payload.code).toBe('PARAMETER_INVALID')
    expect(bad.text).toContain('fields[1].label')
    expect(bad.text).toContain('fields[1].kind')

    const ok = await call(writer, session, 'propose_create_table', {
      base: 'crm',
      label: 'Devis',
      fields: [{ label: 'Numéro', kind: 'short_text', required: true }],
    })
    expect(ok.payload.status).toBe('proposed')
    expect(ok.payload.affected_objects[0].role).toBe('created')
    await kernel.rejectProposal(admin, { proposalId: ok.payload.proposal_id })
    const followed = await call(writer, session, 'get_proposal', {
      proposal_id: ok.payload.proposal_id,
    })
    expect(followed.payload.status).toBe('rejected')
  })

  it('cascade is refused by name; a read-only token proposes nothing', async () => {
    const session = await open(writer)
    const cascade = await call(writer, session, 'propose_add_field', {
      base: 'crm',
      table: 'factures',
      label: 'Client bis',
      kind: 'link',
      target: 'clients',
      on_delete: 'cascade',
    })
    expect(cascade.payload.code).toBe('MCP_CASCADE_FORBIDDEN')

    const readSession = await open(reader)
    const refused = await call(reader, readSession, 'propose_add_field', {
      base: 'crm',
      table: 'clients',
      label: 'Autre',
      kind: 'short_text',
    })
    expect(refused.payload.code).toBe('TOKEN_READ_ONLY')
  })

  it('get_proposal: another token’s proposal does not exist', async () => {
    const session = await open(writer)
    const mine = await call(writer, session, 'propose_add_field', {
      base: 'crm',
      table: 'clients',
      label: 'Site web',
      kind: 'short_text',
    })
    const readSession = await open(reader)
    const other = await call(reader, readSession, 'get_proposal', {
      proposal_id: mine.payload.proposal_id,
    })
    expect(other.payload.code).toBe('RESOURCE_NOT_FOUND')
    await kernel.rejectProposal(admin, { proposalId: mine.payload.proposal_id })
  })
})

describe('discovery (§4)', () => {
  it('whoami names the token, its creator and its scope', async () => {
    const session = await open(writer)
    const { payload } = await call(writer, session, 'whoami')
    expect(payload.actor.kind).toBe('token')
    expect(payload.actor.token.label).toBe('Agent CRM')
    expect(payload.scope.base.name).toBe('crm')
    expect(payload.access).toEqual({ read: true, create: true, update: true })
    expect(payload.budgets.rows_written_per_hour).toBe(500)
  })

  it('list_bases shows the token’s base and nothing beyond its scope', async () => {
    const session = await open(writer)
    const { payload } = await call(writer, session, 'list_bases')
    expect(payload.bases.map((b: { name: string }) => b.name)).toEqual(['crm'])
    expect(payload.bases[0].schema).toBe(crm.schemaName)
    expect(payload.provenance).toBe('user_data')
  })

  it('describe_base: tables, display fields, relations', async () => {
    const session = await open(writer)
    const { payload } = await call(writer, session, 'describe_base', { base: 'crm' })
    expect(payload.base.description).toBe('Suivi de la relation commerciale.')
    expect(payload.tables.map((t: { name: string }) => t.name).sort()).toEqual([
      'clients',
      'factures',
    ])
    const c = payload.tables.find((t: { name: string }) => t.name === 'clients')
    expect(c.display_field).toEqual({
      name: 'raison_sociale',
      label: 'Raison sociale',
      kind: 'short_text',
    })
    expect(payload.relations).toEqual([
      expect.objectContaining({
        from_table: 'factures',
        from_field: 'clients_id',
        to_table: 'clients',
        to_column: '_id',
        cardinality: 'many_to_one',
        on_delete: 'restrict',
      }),
    ])
  })

  it('a base outside the token’s scope is RESOURCE_NOT_FOUND, exactly like a missing one', async () => {
    const session = await open(writer)
    const outside = await call(writer, session, 'describe_base', { base: 'rh' })
    const missing = await call(writer, session, 'describe_base', { base: 'nexiste_pas' })
    expect(outside.payload.code).toBe('RESOURCE_NOT_FOUND')
    expect(outside.text).toBe(missing.text)
  })

  it('describe_table: link block, access, withheld and rich fields', async () => {
    const session = await open(writer)
    const f = await call(writer, session, 'describe_table', { base: 'crm', table: 'factures' })
    const link = f.payload.fields.find((x: { name: string }) => x.name === 'clients_id')
    expect(link.kind).toBe('link')
    expect(link.description).toBe('Le client à qui la facture est adressée.')
    expect(link.link.target_table.name).toBe('clients')
    expect(link.link.target_table.display_field.name).toBe('raison_sociale')
    expect(link.link.fk_constraint).toMatch(/^fk_/)
    expect(link.link.fk_index).toMatch(/^ix_/)
    expect(link.link.on_delete_meaning).toContain('refusée')
    expect(link.link.join_sql).toBe(
      `LEFT JOIN "${crm.schemaName}"."clients" AS "c" ON "c"."_id" = "t"."clients_id"`,
    )
    expect(link.link.expandable).toBe(true)
    const statut = f.payload.fields.find((x: { name: string }) => x.name === 'statut')
    expect(statut.options).toEqual([
      { value: 'brouillon', label: 'Brouillon' },
      { value: 'emise', label: 'Émise' },
    ])
    const id = f.payload.fields.find((x: { name: string }) => x.name === '_id')
    expect(id).toMatchObject({ kind: 'system', access: 'read' })
    expect(f.payload.table.access).toEqual({
      read: true,
      create: true,
      update: true,
      delete: false,
      manage_schema: false,
    })

    const c = await call(writer, session, 'describe_table', { base: 'crm', table: 'clients' })
    const names = c.payload.fields.map((x: { name: string }) => x.name)
    // Withheld from agents: absent, with no marker and no counter (§4.2).
    expect(names).not.toContain('numero_de_securite_sociale')
    expect(c.text).not.toContain('curit')
    const rich = c.payload.fields.find((x: { name: string }) => x.name === 'presentation')
    expect(rich).toMatchObject({ rich_text: true, access: 'read' })
    expect(c.payload.inverse_links).toEqual([
      expect.objectContaining({
        source_table: expect.objectContaining({ name: 'factures' }),
        source_field: { name: 'clients_id', label: 'Client' },
        how_to_list: {
          tool: 'list_records',
          base: 'crm',
          table: 'factures',
          filter: { clients_id: { op: 'eq', value: '<_id de la ligne>' } },
        },
      }),
    ])
  })

  it('a read-only token reads `access: read` everywhere and create/update false', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'describe_table', {
      base: 'crm',
      table: 'factures',
    })
    expect(payload.table.access.create).toBe(false)
    expect(payload.fields.every((x: { access: string }) => x.access === 'read')).toBe(true)
  })
})

describe('reading (§5)', () => {
  it('list_records: default page, projection, link values, pagination to the end', async () => {
    const session = await open(reader)
    const first = await call(reader, session, 'list_records', { base: 'crm', table: 'factures' })
    expect(first.isError).toBe(false)
    expect(first.payload.returned).toBe(25)
    expect(first.payload.has_more).toBe(true)
    expect(first.payload.records[0].clients_id).toEqual({ id: dupont, display: 'Dupont SARL' })
    // `numeric` travels as a decimal string, on every surface.
    expect(typeof first.payload.records[0].montant).toBe('string')

    const second = await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'factures',
      cursor: first.payload.next_cursor,
    })
    expect(second.payload.returned).toBe(5)
    expect(second.payload.has_more).toBe(false)
    const all = [...first.payload.records, ...second.payload.records].map((r) => r.numero)
    expect(new Set(all).size).toBe(30)
  })

  it('filter, sort, select, include_count', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'factures',
      select: ['numero', 'montant'],
      filter: { payee: { op: 'eq', value: true }, montant: { op: 'gte', value: 100 } },
      sort: ['-montant'],
      include_count: true,
    })
    expect(payload.count).toBe(11)
    expect(payload.count_is_estimate).toBe(false)
    expect(Object.keys(payload.records[0]).sort()).toEqual(['_id', 'montant', 'numero'])
    expect(payload.records[0].numero).toBe('F-030')
  })

  it('a limit above 100 is clipped without error, and says so', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'factures',
      limit: 1000,
    })
    expect(payload.returned).toBe(30)
    expect(payload.notices.map((n: { kind: string }) => n.kind)).toContain('limit_clipped')
  })

  it('a withheld field is unknown in select, filter and sort alike (§5.1)', async () => {
    const session = await open(reader)
    const probes = [
      { select: ['numero_de_securite_sociale'] },
      { filter: { numero_de_securite_sociale: { op: 'starts_with', value: '1' } } },
      { filter: { numero_de_securite_sociale: { op: 'is_null' } } },
      { sort: ['numero_de_securite_sociale'] },
    ]
    const answers = []
    for (const probe of probes) {
      const r = await call(reader, session, 'list_records', {
        base: 'crm',
        table: 'clients',
        ...probe,
      })
      expect(r.payload.code).toBe('FIELD_UNKNOWN')
      answers.push(r.payload.message)
      // The same answer as for a typo.
      const typo = await call(reader, session, 'list_records', {
        base: 'crm',
        table: 'clients',
        select: ['nexiste_pas'],
      })
      expect(r.payload.message).toBe(typo.payload.message)
    }
  })

  it('stage 1 refuses before the catalog is read, naming only parameters', async () => {
    const session = await open(rhToken)
    const r = await call(rhToken, session, 'list_records', {
      base: 'crm',
      table: 'factures',
      filter: Object.fromEntries(
        Array.from({ length: 11 }, (_, i) => [`f${i}`, { op: 'eq', value: 1 }]),
      ),
    })
    expect(r.payload.code).toBe('PARAMETER_INVALID')
    expect(r.payload.invalid_params).toEqual(['filter'])
    expect(r.text).not.toContain('factures"')
  })

  it('long text is cut at 500 characters, rich text flattened, both said per row', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'clients',
      filter: { _id: { op: 'eq', value: dupont } },
    })
    const row = payload.records[0]
    expect(row.notes).toHaveLength(500)
    expect(row._truncated_fields).toEqual(['notes'])
    expect(row.presentation).toBe('Fabricant lyonnais & fier')
    expect(row._flattened_fields).toEqual(['presentation'])
    expect(JSON.stringify(row)).not.toContain('75 123 456')
  })

  it('get_record: full_fields gives the whole text; a missing row is not found', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'get_record', {
      base: 'crm',
      table: 'clients',
      _id: dupont,
      full_fields: ['notes'],
    })
    expect(payload.record.notes).toHaveLength(800)
    expect(payload.record._truncated_fields).toBeUndefined()
    const missing = await call(reader, session, 'get_record', {
      base: 'crm',
      table: 'clients',
      _id: randomUUID(),
    })
    expect(missing.payload.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('expand with expand_fields nests the target’s fields in the link value', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'factures',
      select: ['numero'],
      expand: ['clients_id'],
      expand_fields: ['clients_id.ville'],
      limit: 1,
    })
    expect(payload.records[0].clients_id).toEqual({
      id: dupont,
      display: 'Dupont SARL',
      fields: { ville: 'Lyon' },
    })
    const withheld = await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'factures',
      expand: ['clients_id'],
      expand_fields: ['clients_id.numero_de_securite_sociale'],
    })
    expect(withheld.payload.code).toBe('FIELD_UNKNOWN')
    const notALink = await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'factures',
      expand: ['numero'],
    })
    expect(notALink.payload.code).toBe('FIELD_NOT_EXPANDABLE')
  })

  it('lookup_records matches without case or accents, and always returns a list', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'lookup_records', {
      base: 'crm',
      table: 'clients',
      value: 'ecole nationale',
    })
    expect(payload.candidates).toEqual([{ _id: acme, display: 'École Nationale' }])
    expect(payload.returned).toBe(1)
    const none = await call(reader, session, 'lookup_records', {
      base: 'crm',
      table: 'clients',
      value: 'Inconnu',
    })
    expect(none.payload.candidates).toEqual([])
  })

  it('a cursor minted for one token does not open for another', async () => {
    const a = await open(reader)
    const page = await call(reader, a, 'list_records', { base: 'crm', table: 'factures' })
    const b = await open(writer)
    const r = await call(writer, b, 'list_records', {
      base: 'crm',
      table: 'factures',
      cursor: page.payload.next_cursor,
    })
    expect(r.payload.code).toBe('CURSOR_INVALID')
  })
})

describe('writing (§6)', () => {
  it('create_record with a link resolved by lookup, read back under the read mask', async () => {
    const session = await open(writer)
    const found = await call(writer, session, 'lookup_records', {
      base: 'crm',
      table: 'clients',
      value: 'DUPONT sarl',
    })
    const { payload, isError } = await call(writer, session, 'create_record', {
      base: 'crm',
      table: 'factures',
      values: {
        numero: 'F-100',
        montant: 1234.5,
        payee: false,
        emise_le: '2026-09-25',
        statut: 'brouillon',
        clients_id: found.payload.candidates[0]._id,
      },
    })
    expect(isError, JSON.stringify(payload)).toBe(false)
    expect(payload.created).toBe(true)
    expect(payload._id).toMatch(/^[0-9a-f-]{36}$/)
    expect(payload.record.numero).toBe('F-100')
    // A decimal string at the column's scale — never a JSON number that could round.
    expect(payload.record.montant).toMatch(/^1234\.50*$/)
    expect(payload.record.clients_id).toEqual({ id: dupont, display: 'Dupont SARL' })
  })

  it('values are checked against their type before anything is sent', async () => {
    const session = await open(writer)
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ numero: 'X', montant: 'beaucoup' }, 'nombre'],
      [{ numero: 'X', payee: 'oui' }, 'booléen'],
      [{ numero: 'X', emise_le: '25/09/2026' }, 'date AAAA-MM-JJ'],
      [{ numero: 'X', statut: 'payee' }, 'une des valeurs de la liste'],
      [{ numero: 'X', clients_id: 'Dupont SARL' }, 'identifiant _id de la ligne cible'],
    ]
    for (const [values, expected] of cases) {
      const { payload } = await call(writer, session, 'create_record', {
        base: 'crm',
        table: 'factures',
        values,
      })
      expect(payload.code).toBe('VALUE_INVALID')
      expect(payload.details.expected).toBe(expected)
      // The agent's value never comes back in the message.
      expect(payload.message).not.toContain('beaucoup')
    }
  })

  it('system columns, rich text and unknown fields are refused by name', async () => {
    const session = await open(writer)
    const system = await call(writer, session, 'create_record', {
      base: 'crm',
      table: 'clients',
      values: { raison_sociale: 'Y', _id: randomUUID() },
    })
    expect(system.payload.code).toBe('FIELD_NOT_WRITABLE')
    const rich = await call(writer, session, 'update_record', {
      base: 'crm',
      table: 'clients',
      _id: dupont,
      values: { presentation: 'texte' },
    })
    expect(rich.payload.code).toBe('FIELD_NOT_WRITABLE')
    expect(rich.payload.hint).toContain('texte riche')
    const withheld = await call(writer, session, 'update_record', {
      base: 'crm',
      table: 'clients',
      _id: dupont,
      values: { numero_de_securite_sociale: '0' },
    })
    expect(withheld.payload.code).toBe('FIELD_UNKNOWN')
  })

  it('a link to a row that does not exist is refused, on the source field', async () => {
    const session = await open(writer)
    const { payload } = await call(writer, session, 'create_record', {
      base: 'crm',
      table: 'factures',
      values: { numero: 'F-999', clients_id: randomUUID() },
    })
    expect(payload.code).toBe('LINK_TARGET_NOT_FOUND')
    expect(payload.details?.field).toBe('clients_id')
    expect(JSON.stringify(payload)).not.toContain('"clients"')
  })

  it('update_record writes the named fields only', async () => {
    const session = await open(writer)
    const { payload } = await call(writer, session, 'update_record', {
      base: 'crm',
      table: 'clients',
      _id: acme,
      values: { ville: 'Marseille' },
    })
    expect(payload.updated).toBe(true)
    expect(payload.record).toMatchObject({ raison_sociale: 'École Nationale', ville: 'Marseille' })
    const missing = await call(writer, session, 'update_record', {
      base: 'crm',
      table: 'clients',
      _id: randomUUID(),
      values: { ville: 'Nulle part' },
    })
    expect(missing.payload.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('a read-only token is told so: TOKEN_READ_ONLY', async () => {
    const session = await open(reader)
    const { payload } = await call(reader, session, 'create_record', {
      base: 'crm',
      table: 'clients',
      values: { raison_sociale: 'Z' },
    })
    expect(payload.code).toBe('TOKEN_READ_ONLY')
  })

  it('idempotency: the same key replays, a different call under it conflicts (§6.3)', async () => {
    const session = await open(writer)
    const args = {
      base: 'crm',
      table: 'clients',
      values: { raison_sociale: 'Idempotente SA' },
      idempotency_key: 'cle-1',
    }
    const first = await call(writer, session, 'create_record', args)
    const again = await call(writer, session, 'create_record', args)
    expect(again.payload._id).toBe(first.payload._id)
    const { rows } = await sql.query(
      `SELECT count(*)::int AS n FROM "${crm.schemaName}"."clients" WHERE raison_sociale = 'Idempotente SA'`,
    )
    expect(rows[0].n).toBe(1)
    const other = await call(writer, session, 'create_record', {
      ...args,
      values: { raison_sociale: 'Autre SA' },
    })
    expect(other.payload.code).toBe('IDEMPOTENCY_CONFLICT')
    // A refused write frees its key: the corrected call goes through under it.
    const bad = await call(writer, session, 'create_record', {
      base: 'crm',
      table: 'factures',
      values: { numero: 'F-500', montant: 'beaucoup' },
      idempotency_key: 'cle-2',
    })
    expect(bad.payload.code).toBe('VALUE_INVALID')
    const fixed = await call(writer, session, 'create_record', {
      base: 'crm',
      table: 'factures',
      values: { numero: 'F-500', montant: 5 },
      idempotency_key: 'cle-2',
    })
    expect(fixed.payload.created).toBe(true)
  })
})

describe('the enforcement point (§10, §12.2)', () => {
  it('a base closed to agents does not exist on this surface', async () => {
    await sql.query('UPDATE _basedb.base SET mcp_enabled = false WHERE id = $1', [rh.baseId])
    clearCaches()
    const session = await open(rhToken)
    const bases = await call(rhToken, session, 'list_bases')
    expect(bases.payload.bases).toEqual([])
    const described = await call(rhToken, session, 'describe_base', { base: 'rh' })
    expect(described.payload.code).toBe('RESOURCE_NOT_FOUND')
    await sql.query('UPDATE _basedb.base SET mcp_enabled = true WHERE id = $1', [rh.baseId])
    clearCaches()
  })

  it('a token whose creator lost every right: empty scope, and nothing named (§10.5)', async () => {
    // A person with no role at all, holding a token on CRM — inserted directly: the
    // kernel would refuse to mint it, which is the point of non-escalation.
    const { rows: users } = await sql.query(
      `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
       SELECT id, 'sansdroit@basedb.local', 'Sans droit', $1, $1 FROM _basedb.tenant WHERE ref = $2
       RETURNING id`,
      [adminId, TENANT_REF],
    )
    const { rows: roles } = await sql.query(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
       SELECT id, 'Vide', 'vide', 'vide', $1 FROM _basedb.tenant WHERE ref = $2 RETURNING id`,
      [adminId, TENANT_REF],
    )
    await sql.query(
      `INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
       VALUES ($1, 'base', $2, 'read', $3)`,
      [roles[0].id, crm.baseId, adminId],
    )
    const secret = `bdb_sansdroi_${'B'.repeat(43)}`
    const { createHash } = await import('node:crypto')
    await sql.query(
      `INSERT INTO _basedb.api_token
         (tenant_id, label, token_prefix, token_hash, role_id, base_id, allowed_surfaces,
          expires_at, created_by)
       SELECT id, 'Orphelin', 'sansdroi', $1, $2, $3, ARRAY['mcp'], now() + interval '1 day', $4
         FROM _basedb.tenant WHERE ref = $5`,
      [
        createHash('sha256').update(secret).digest(),
        roles[0].id,
        crm.baseId,
        users[0].id,
        TENANT_REF,
      ],
    )

    const session = await open(secret)
    const who = await call(secret, session, 'whoami')
    expect(who.isError).toBe(false)
    expect(who.payload.scope.base).toBeNull()
    const bases = await call(secret, session, 'list_bases')
    expect(bases.payload.bases).toEqual([])
    const replies = [
      await call(secret, session, 'describe_base', { base: 'crm' }),
      await call(secret, session, 'describe_table', { base: 'crm', table: 'factures' }),
      await call(secret, session, 'list_records', { base: 'crm', table: 'factures' }),
      await call(secret, session, 'get_record', { base: 'crm', table: 'clients', _id: dupont }),
      await call(secret, session, 'lookup_records', { base: 'crm', table: 'clients', value: 'x' }),
      await call(secret, session, 'create_record', {
        base: 'crm',
        table: 'clients',
        values: { raison_sociale: 'x' },
      }),
    ]
    for (const r of replies) {
      expect(r.payload.code).toBe('RESOURCE_NOT_FOUND')
      for (const name of ['clients', 'factures', 'raison_sociale', 'CRM', 'Dupont']) {
        expect(r.text).not.toContain(name)
      }
    }
  })

  it('revocation closes the session at the next message', async () => {
    const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
    const elevated = await kernel.elevate(login.sessionToken, PASSWORD)
    const issued = await kernel.createApiToken(admin, {
      label: 'Éphémère',
      baseId: crm.baseId,
      access: 'read',
      surfaces: ['mcp'],
      sessionId: elevated.session.sessionId,
    })
    const session = await open(issued.secret)
    expect((await call(issued.secret, session, 'whoami')).isError).toBe(false)
    await kernel.revokeApiToken(admin, {
      tokenId: issued.id,
      sessionId: elevated.session.sessionId,
    })
    const r = await rpc(issued.secret, request('tools/list'), session)
    expect(r.status).toBe(401)
    expect(r.body?.error?.data?.code).toBe('TOKEN_REVOKED')
  })

  it('a token lives until revoked unless given a lifetime, and a lifetime is a year at most', async () => {
    const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
    const elevated = await kernel.elevate(login.sessionToken, PASSWORD)
    const mint = (expiresInDays?: number | null) =>
      kernel.createApiToken(admin, {
        label: `Durée ${String(expiresInDays)}`,
        baseId: crm.baseId,
        access: 'read',
        surfaces: ['mcp'],
        expiresInDays,
        sessionId: elevated.session.sessionId,
      })

    const eternal = await mint()
    expect(eternal.expiresAt).toBeNull()
    const session = await open(eternal.secret)
    const whoami = await call(eternal.secret, session, 'whoami')
    expect(whoami.isError).toBe(false)

    const month = await mint(30)
    const days = (Date.parse(month.expiresAt as string) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)

    await expect(mint(400)).rejects.toMatchObject({ code: 'TOKEN_EXPIRY_REQUIRED' })
    await expect(mint(0)).rejects.toMatchObject({ code: 'TOKEN_EXPIRY_REQUIRED' })
  })

  it('a token cannot be minted without an elevated session', async () => {
    const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
    await expect(
      kernel.createApiToken(admin, {
        label: 'Sans élévation',
        baseId: crm.baseId,
        access: 'read',
        surfaces: ['mcp'],
        sessionId: login.sessionId,
      }),
    ).rejects.toMatchObject({ code: 'ELEVATION_REQUIRED' })
  })
})

describe('resources (§4.5) and audit (§13)', () => {
  it('the schema resource is describe_base plus every describe_table', async () => {
    const session = await open(reader)
    const list = await rpc(reader, request('resources/list'), session)
    const resources = (list.body?.result as { resources: Array<{ uri: string }> }).resources
    expect(resources.map((r) => r.uri)).toEqual(['basedb://schema/crm'])
    const read = await rpc(
      reader,
      request('resources/read', { uri: 'basedb://schema/crm' }),
      session,
    )
    const contents = (read.body?.result as { contents: Array<{ text: string }> }).contents
    const document = JSON.parse(contents[0].text)
    expect(document.tables.map((t: { table: { name: string } }) => t.table.name).sort()).toEqual([
      'clients',
      'factures',
    ])
    const missing = await rpc(
      reader,
      request('resources/read', { uri: 'basedb://schema/rh' }),
      session,
    )
    expect(missing.body?.error?.code).toBe(-32002)
  })

  it('one audit line per call, with the shape of the parameters and never their values', async () => {
    const session = await open(reader)
    await call(reader, session, 'list_records', {
      base: 'crm',
      table: 'clients',
      filter: { ville: { op: 'eq', value: 'Valeur-Secrete-Lyon' } },
    })
    const { rows } = await sql.query(
      `SELECT surface, actor_kind, action, payload
         FROM _basedb.audit_log
        WHERE action = 'mcp.list_records'
        ORDER BY occurred_at DESC LIMIT 1`,
    )
    expect(rows[0].surface).toBe('mcp')
    expect(rows[0].actor_kind).toBe('token')
    const shape = rows[0].payload.mcp.params_shape
    expect(shape.filter[0]).toMatchObject({ field: 'ville', op: 'eq' })
    expect(shape.filter[0].value_digest).toMatch(/^h:[0-9a-f]{8}$/)
    expect(JSON.stringify(rows[0].payload)).not.toContain('Valeur-Secrete')
    expect(rows[0].payload.mcp.client).toEqual({ name: 'vitest', version: '1', verified: false })
  })

  it('refusals that reveal existence are also written to the security journal', async () => {
    const session = await open(reader)
    await call(reader, session, 'describe_base', { base: 'rh' })
    const { rows } = await sql.query(
      `SELECT route, error_code FROM _basedb.security_log
        WHERE route = '/mcp/describe_base' ORDER BY occurred_at DESC LIMIT 1`,
    )
    expect(rows[0]).toEqual({ route: '/mcp/describe_base', error_code: 'RESOURCE_NOT_FOUND' })
  })
})

describe('the stdio relay (§1.2)', () => {
  it('carries a session end to end: initialize, tools/list, a tool call', async () => {
    const server = serve({ fetch: app.fetch, port: 0 })
    await new Promise((resolve) => server.once('listening', resolve))
    const { port } = server.address() as AddressInfo
    const relay = fileURLToPath(new URL('../../dist/relay.js', import.meta.url))

    const child = spawn(process.execPath, [relay, '--url', `http://localhost:${port}/mcp`], {
      env: { ...process.env, BASEDB_MCP_TOKEN: reader },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const lines: Array<Record<string, Json>> = []
    let buffer = ''
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        lines.push(JSON.parse(buffer.slice(0, index)))
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
      }
    })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`)
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'relay-test' },
      },
    })
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_bases', arguments: {} },
    })

    const deadline = Date.now() + 15_000
    while (lines.length < 3 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    child.stdin.end()
    await new Promise((resolve) => child.once('exit', resolve))
    server.close()

    const byId = new Map(lines.map((l) => [l.id, l]))
    expect(byId.get(1)?.result?.protocolVersion).toBe('2025-06-18')
    expect(byId.get(2)?.result?.tools).toHaveLength(TOOLS.length)
    const listed = JSON.parse(byId.get(3)?.result?.content[0].text)
    expect(listed.bases[0].name).toBe('crm')
    // The token never leaves through the relay's own output.
    expect(stderr).not.toContain(reader)
    expect(JSON.stringify(lines)).not.toContain(reader)
  })
})
