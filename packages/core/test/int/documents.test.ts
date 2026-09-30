import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { LaidBlock } from '../../src/documents/layout.js'
import { prepareDocument } from '../../src/documents/render.js'
import { type Kernel, startKernel } from '../../src/index.js'
import { Pools } from '../../src/runtime/pool.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Documents — chapter 21: a template checked against the catalog when written; a row read
 * as a document with the rights of whoever asks — a hidden field left out, a linked row the
 * reader does not see left out of the table —, its values written in the template's
 * language; and the PDF it becomes.
 */

const TENANT = 't9dc5ks'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let pools: Pools
let admin: RequestContext
let adminSession: string
let invoices: string
let lines: string
let invoice: string
let bob: string
let templateId: string

const ctxOf = (userId: string) =>
  kernel.openContext({ userId, requestId: randomUUID(), surface: 'rest' })

async function reasonOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return String((e as { details?: { reason?: string } }).details?.reason ?? (e as Error).message)
  }
  throw new Error('no error raised')
}

const euros = (n: number) =>
  new Intl.NumberFormat('fr', { style: 'currency', currency: 'EUR' }).format(n)

const spec = () => ({
  locale: 'fr',
  footer: 'Facture {{numero}} — merci',
  blocks: [
    { kind: 'text', html: '<h1>Facture {{numero}}</h1><p>Émise le {{date}}.</p>' },
    { kind: 'fields', fields: ['statut', 'payee', 'note'] },
    {
      kind: 'rows',
      title: 'Détail',
      source: { kind: 'incoming', table: lines, field: 'factures_id' },
      columns: ['designation', 'quantite', 'prix'],
      totals: ['prix', 'designation'],
    },
  ],
})

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  pools = new Pools({ connectionString: container.getConnectionUri() })
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await ctxOf(boot.userId)
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  const base = await kernel.createBase(admin, { label: 'Facturation' })
  invoices = (
    await kernel.createTable(admin, {
      baseId: base.baseId,
      label: 'Factures',
      fields: [
        { label: 'Numero', kind: 'short_text' },
        { label: 'Date', kind: 'date' },
        { label: 'Payee', kind: 'boolean' },
        { label: 'Note', kind: 'long_text' },
      ],
    })
  ).tableId
  await kernel.addField(admin, {
    tableId: invoices,
    label: 'Statut',
    kind: 'select',
    options: [
      { value: 'emise', label: 'Émise' },
      { value: 'payee', label: 'Payée' },
    ],
  })
  const created = await kernel.createTable(admin, {
    baseId: base.baseId,
    label: 'Lignes',
    fields: [
      { label: 'Designation', kind: 'short_text' },
      { label: 'Quantite', kind: 'number' },
      { label: 'Prix', kind: 'number' },
    ],
  })
  lines = created.tableId
  const prix = created.fields.find((f) => f.name === 'prix')?.fieldId as string
  await kernel.setFieldFormat(admin, {
    fieldId: prix,
    format: { display: 'currency', currency: 'EUR' },
  })
  await kernel.createLinkField(admin, { tableId: lines, targetTableId: invoices, label: 'Facture' })

  invoice = String(
    (
      await kernel.createRecord(admin, {
        tableId: invoices,
        values: {
          numero: 'F-1',
          date: '2026-09-30',
          payee: false,
          statut: 'emise',
          note: 'À régler',
        },
      })
    ).row._id,
  )
  await kernel.createRecords(admin, {
    tableId: lines,
    records: [
      { designation: 'Pain', quantite: 1, prix: 12.5, factures_id: invoice },
      { designation: 'Croissants', quantite: 6, prix: 3, factures_id: invoice },
    ],
  })

  const readers = (await kernel.createGroup(admin, { label: 'Lecteurs', sessionId: adminSession }))
    .id
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: readers, scope: { kind: 'base', id: base.baseId }, level: 'read' }],
    sessionId: adminSession,
  })
  bob = (
    await kernel.createUser(admin, {
      email: 'bob@exemple.fr',
      displayName: 'Bob',
      groupIds: [readers],
      sessionId: adminSession,
    })
  ).user.id
}, 240_000)

afterAll(async () => {
  await pools?.end()
  await kernel?.close()
  await container?.stop()
})

describe('a template', () => {
  it('is checked against the catalog when written', async () => {
    const bad = (change: Record<string, unknown>) =>
      reasonOf(
        kernel.createDocumentTemplate(admin, {
          tableId: invoices,
          label: 'X',
          spec: { ...spec(), ...change },
        }),
      )
    expect(await bad({ locale: 'xx' })).toBe('langue_inconnue')
    expect(await bad({ blocks: [{ kind: 'fields', fields: ['disparu'] }] })).toBe('champ_inconnu')
    expect(
      await bad({
        blocks: [
          {
            kind: 'rows',
            source: { kind: 'incoming', table: lines, field: 'designation' },
            columns: ['designation'],
          },
        ],
      }),
    ).toBe('lien_vers_la_table_attendu')
    expect(await bad({ blocks: [] })).toBe('aucun_bloc')
  })

  it('is written by whoever builds the table, and its definition read by them alone', async () => {
    const template = await kernel.createDocumentTemplate(admin, {
      tableId: invoices,
      label: 'Facture',
      spec: spec(),
    })
    templateId = template.id
    expect(template.spec?.blocks).toHaveLength(3)
    // A text column among the totals is kept as written: it sums nothing (see below).
    expect(template.spec?.blocks[2]).toMatchObject({ totals: ['prix', 'designation'] })
    const reader = await ctxOf(bob)
    expect(
      await reasonOf(
        kernel.createDocumentTemplate(reader, { tableId: invoices, label: 'Y', spec: spec() }),
      ),
    ).not.toBe('')
    const seen = await kernel.listDocumentTemplates(reader, { tableId: invoices })
    expect(seen).toEqual([
      expect.objectContaining({ id: templateId, label: 'Facture', spec: null }),
    ])
  })
})

describe('a row as a document', () => {
  const blocksOf = async (ctx: RequestContext, template: string | null = templateId) =>
    (
      await prepareDocument(pools, ctx, {
        tableId: invoices,
        recordId: invoice,
        templateId: template,
      })
    ).laid

  it('says the row in the template’s language: dates, amounts, choices, yes and no', async () => {
    const laid = await blocksOf(admin)
    expect(laid.title).toBe('Facture — F-1')
    expect(laid.footer).toBe('Facture F-1 — merci')
    const [text, fields, table] = laid.blocks as [LaidBlock, LaidBlock, LaidBlock]
    expect(text).toEqual({
      kind: 'html',
      html: '<h1>Facture F-1</h1><p>Émise le 30 septembre 2026.</p>',
    })
    expect(fields).toEqual({
      kind: 'fields',
      rows: [
        { label: 'Statut', value: 'Émise' },
        { label: 'Payee', value: 'non' },
        { label: 'Note', value: 'À régler' },
      ],
    })
    expect(table).toMatchObject({
      kind: 'table',
      title: 'Détail',
      columns: [
        { label: 'Designation', numeric: false },
        { label: 'Quantite', numeric: true },
        { label: 'Prix', numeric: true },
      ],
      rows: [
        ['Pain', '1', euros(12.5)],
        ['Croissants', '6', euros(3)],
      ],
      totals: ['Total', null, euros(15.5)],
    })
  })

  it('is read with the reader’s rights: a hidden field and an unseen line are left out', async () => {
    const groups = await kernel.listGroups(admin)
    const readers = groups.find((g) => g.label === 'Lecteurs')?.id as string
    const access = await kernel.fieldAccess(admin, { tableId: invoices })
    const payee = access.fields.find((f) => f.name === 'payee')?.id as string
    await kernel.setFieldRule(admin, {
      groupId: readers,
      fieldId: payee,
      rule: 'hidden',
      sessionId: adminSession,
    })
    await kernel.setRowRule(admin, {
      groupId: readers,
      tableId: lines,
      rule: 'quantite gt 1',
      sessionId: adminSession,
    })
    const laid = await blocksOf(await ctxOf(bob))
    const [, fieldsBlock, table] = laid.blocks as [LaidBlock, LaidBlock, LaidBlock]
    expect(fieldsBlock).toEqual({
      kind: 'fields',
      rows: [
        { label: 'Statut', value: 'Émise' },
        { label: 'Note', value: 'À régler' },
      ],
    })
    expect(table).toMatchObject({
      rows: [['Croissants', '6', euros(3)]],
      totals: ['Total', null, euros(3)],
    })
  })

  it('is not found for a row the reader cannot read', async () => {
    const outsider = (
      await kernel.createUser(admin, {
        email: 'eve@exemple.fr',
        displayName: 'Eve',
        sessionId: adminSession,
      })
    ).user.id
    const code = await kernel
      .renderDocument(await ctxOf(outsider), { tableId: invoices, recordId: invoice, templateId })
      .then(
        () => 'rendu',
        (e: { code?: string }) => e.code,
      )
    expect(code).toBe('RESOURCE_NOT_FOUND')
  })

  it('reads as a sheet with no template: every field, under the row’s name', async () => {
    const laid = await blocksOf(admin, null)
    expect(laid.blocks[0]).toEqual({ kind: 'html', html: '<h1>F-1</h1>' })
    const fields = laid.blocks[1] as Extract<LaidBlock, { kind: 'fields' }>
    expect(fields.rows.map((r) => r.label)).toEqual(['Numero', 'Date', 'Payee', 'Note', 'Statut'])
  })

  it('becomes a PDF', async () => {
    const document = await kernel.renderDocument(admin, {
      tableId: invoices,
      recordId: invoice,
      templateId,
    })
    expect(document.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(document.filename).toBe('Facture — F-1.pdf')
  })
})
