import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * The data history — chapter 07, end to end on a real PostgreSQL.
 *
 * What is proved here is the promise of the chapter, not an implementation: every write
 * leaves a trace, whoever makes it — the API, a token, a person in psql — a rolled-back
 * transaction leaves none, the trace names values the way a person reads them, and what
 * a reader may not read stays out of it. Then the two ways back: undoing a modification,
 * restoring a deleted row.
 */

const TENANT = 't4z56fq'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let sql: pg.Client
let crm: { baseId: string; schemaName: string }
let clients: { tableId: string; name: string }
let factures: { tableId: string; name: string }
let acme: string
let dupont: string

const ctxOf = (userId: string) =>
  kernel.openContext({ userId, requestId: randomUUID(), surface: 'rest' })

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
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
  admin = await ctxOf(boot.userId)

  crm = await kernel.createBase(admin, { label: 'CRM' })
  const c = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  clients = { tableId: c.tableId, name: c.tableName }
  await kernel.setDisplayColumn(admin, { tableId: c.tableId, fieldId: c.fields[0].fieldId })

  const f = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text' },
      { label: 'Montant', kind: 'number' },
    ],
  })
  factures = { tableId: f.tableId, name: f.tableName }
  await kernel.setDisplayColumn(admin, { tableId: f.tableId, fieldId: f.fields[0].fieldId })
  await kernel.addField(admin, {
    tableId: f.tableId,
    label: 'Statut',
    kind: 'select',
    options: [
      { value: 'emise', label: 'Émise' },
      { value: 'payee', label: 'Payée' },
    ],
  })
  await kernel.createLinkField(admin, {
    tableId: f.tableId,
    targetTableId: c.tableId,
    label: 'Client',
    onDelete: 'set_null',
  })

  acme = String(
    (await kernel.createRecord(admin, { tableId: c.tableId, values: { nom: 'ACME' } })).row._id,
  )
  dupont = String(
    (await kernel.createRecord(admin, { tableId: c.tableId, values: { nom: 'Dupont SARL' } })).row
      ._id,
  )

  sql = new pg.Client({ connectionString: container.getConnectionUri() })
  await sql.connect()
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await kernel?.close()
  await container?.stop()
})

describe('what the capture records', () => {
  let invoice: string

  it('a creation, with the author and the values as a person reads them', async () => {
    const created = await kernel.createRecord(admin, {
      tableId: factures.tableId,
      values: { numero: 'F-001', montant: '1240.00', statut: 'emise', clients_id: acme },
    })
    invoice = String(created.row._id)

    const page = await kernel.recordHistory(admin, {
      tableId: factures.tableId,
      recordId: invoice,
    })
    expect(page.revisions).toHaveLength(1)
    const [creation] = page.revisions
    expect(creation.op).toBe('insert')
    expect(creation.recordDisplay).toBe('F-001')
    expect(creation.actor.kind).toBe('user')
    expect(creation.actor.userId).toBe(admin.actor.id)
    expect(creation.actor.name).not.toBeNull()
    const byLabel = new Map(creation.changes.map((c) => [c.label, c]))
    expect(byLabel.get('Montant')?.after).toBe(1240)
    // A choice is shown by its label, a link by the name of the row it points to.
    expect(byLabel.get('Statut')?.afterDisplay).toBe('Émise')
    expect(byLabel.get('Client')?.afterDisplay).toBe('ACME')
    expect(creation.changes.every((c) => !('before' in c))).toBe(true)
  })

  it('a modification: only what changed, before and after', async () => {
    await kernel.updateRecord(admin, {
      tableId: factures.tableId,
      recordId: invoice,
      values: { statut: 'payee', clients_id: dupont },
    })
    const [latest] = (
      await kernel.recordHistory(admin, { tableId: factures.tableId, recordId: invoice })
    ).revisions
    expect(latest.op).toBe('update')
    expect(latest.changes.map((c) => c.label).sort()).toEqual(['Client', 'Statut'])
    const client = latest.changes.find((c) => c.label === 'Client')
    expect([client?.beforeDisplay, client?.afterDisplay]).toEqual(['ACME', 'Dupont SARL'])
    expect(latest.actions).toContain('revert')
  })

  it('a rolled-back transaction leaves no trace', async () => {
    await sql.query('BEGIN')
    await sql.query(
      `UPDATE "${crm.schemaName}"."${factures.name}" SET numero = 'ANNULÉ' WHERE "_id" = $1`,
      [invoice],
    )
    await sql.query('ROLLBACK')
    const page = await kernel.recordHistory(admin, { tableId: factures.tableId, recordId: invoice })
    expect(page.revisions).toHaveLength(2)
  })

  it('a direct SQL write is historised, and says it came from a SQL session', async () => {
    await sql.query(
      `UPDATE "${crm.schemaName}"."${factures.name}" SET montant = 99 WHERE "_id" = $1`,
      [invoice],
    )
    const [latest] = (
      await kernel.recordHistory(admin, { tableId: factures.tableId, recordId: invoice })
    ).revisions
    expect(latest.actor.kind).toBe('sql_direct')
    expect(latest.actor.sqlIdentity).toMatch(/^session \d+/)
    expect(latest.changes.map((c) => [c.label, c.before, c.after])).toEqual([['Montant', 1240, 99]])
  })

  it('TRUNCATE is refused: it would empty a table without a trace', async () => {
    await expect(sql.query(`TRUNCATE "${crm.schemaName}"."${factures.name}"`)).rejects.toThrow(
      /TRUNCATE_FORBIDDEN/,
    )
  })

  it('the journals refuse to be rewritten', async () => {
    await expect(sql.query('DELETE FROM _basedb.record_revision')).rejects.toThrow(
      /HISTORY_IMMUTABLE/,
    )
  })

  it('undoing a modification puts its fields back — once, and never over a later change', async () => {
    const page = await kernel.recordHistory(admin, { tableId: factures.tableId, recordId: invoice })
    const statusChange = page.revisions.find((r) => r.changes.some((c) => c.label === 'Statut'))
    const sqlChange = page.revisions[0]

    // The latest change (Montant 1240 → 99) is undone.
    await kernel.revertRevision(admin, { revisionId: sqlChange.id })
    const after = await kernel.listRecords(admin, { tableId: factures.tableId })
    expect(Number(after.rows.find((r) => r._id === invoice)?.montant)).toBe(1240)

    // The status change is older, and nothing touched Statut or Client since: undone too.
    await kernel.revertRevision(admin, { revisionId: statusChange?.id as string })
    const reread = await kernel.listRecords(admin, { tableId: factures.tableId })
    const row = reread.rows.find((r) => r._id === invoice)
    expect(row?.statut).toBe('emise')

    // Undoing the Montant change again would overwrite the value it put back: refused.
    expect(await codeOf(kernel.revertRevision(admin, { revisionId: sqlChange.id }))).toBe(
      'REVISION_SUPERSEDED',
    )
  })

  it('a deletion keeps the whole row, and the row comes back under its own identifier', async () => {
    await kernel.deleteRecord(admin, { tableId: factures.tableId, recordId: invoice })
    const [deletion] = (
      await kernel.recordHistory(admin, { tableId: factures.tableId, recordId: invoice })
    ).revisions
    expect(deletion.op).toBe('delete')
    expect(deletion.changes.map((c) => c.label)).toEqual(
      expect.arrayContaining(['Numéro', 'Montant', 'Statut', 'Client']),
    )
    expect(deletion.actions).toEqual(['restore'])

    await kernel.restoreRecord(admin, { revisionId: deletion.id })
    const rows = (await kernel.listRecords(admin, { tableId: factures.tableId })).rows
    expect(rows.find((r) => r._id === invoice)?.numero).toBe('F-001')

    // Restored once: a second restoration would duplicate a row that is back.
    expect(await codeOf(kernel.restoreRecord(admin, { revisionId: deletion.id }))).toBe(
      'RESTORE_RECORD_PRESENT',
    )
    const [restoration] = (
      await kernel.recordHistory(admin, { tableId: factures.tableId, recordId: invoice })
    ).revisions
    expect(restoration.op).toBe('insert')
  })

  it('the activity of a base lists every table the reader can read, newest first', async () => {
    const page = await kernel.baseHistory(admin, { baseId: crm.baseId, limit: 3 })
    expect(page.revisions).toHaveLength(3)
    expect(page.nextCursor).not.toBeNull()
    const next = await kernel.baseHistory(admin, {
      baseId: crm.baseId,
      limit: 3,
      cursor: page.nextCursor as string,
    })
    const first = page.revisions.map((r) => r.id)
    expect(next.revisions.some((r) => first.includes(r.id))).toBe(false)
    expect(Date.parse(next.revisions[0].occurredAt)).toBeLessThanOrEqual(
      Date.parse(page.revisions[2].occurredAt),
    )
  })
})

describe('what a reader may see of it', () => {
  it('a person without read on the table does not see its history at all', async () => {
    const stranger = await kernel.createUser(admin, {
      email: 'etranger@exemple.fr',
      displayName: 'Étranger',
      sessionId: (
        await kernel.elevate(
          (
            await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
          ).sessionToken,
          PASSWORD,
        )
      ).session.sessionId,
    })
    const ctx = await ctxOf(stranger.user.id)
    expect(
      await codeOf(kernel.recordHistory(ctx, { tableId: factures.tableId, recordId: acme })),
    ).toBe('RESOURCE_NOT_FOUND')
    expect(await codeOf(kernel.baseHistory(ctx, { baseId: crm.baseId }))).toBe('RESOURCE_NOT_FOUND')
  })
})
