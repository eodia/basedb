import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { useDocumentStorage } from '../../src/documents/images.js'
import type { LaidBlock } from '../../src/documents/layout.js'
import { prepareDocument } from '../../src/documents/render.js'
import { createFileStorage } from '../../src/files/storage.js'
import { type Kernel, startKernel } from '../../src/index.js'
import { Pools } from '../../src/runtime/pool.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Documents — chapter 21: a template checked against the catalog when written; a row read
 * as a document with the rights of whoever asks — a hidden field left out, a linked row the
 * reader does not see left out of the table —, its values written in the template's
 * language; a definition written before themes read as it was drawn; a header, titles and
 * pictures read like the rest; and the PDF it becomes.
 */

const TENANT = 't9dc5ks'
const PASSWORD = 'mot de passe du tenant solide'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const LOGO = `data:image/png;base64,${PNG.toString('base64')}`

let container: StartedPostgreSqlContainer
let kernel: Kernel
let pools: Pools
let directory: string
let admin: RequestContext
let adminSession: string
let invoices: string
let lines: string
let invoice: string
let bob: string
let readers: string
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

/** A definition with every setting of chapter 21 §1. */
const designed = () => ({
  page: { size: 'A4', orientation: 'portrait', valign: 'top' },
  locale: 'fr',
  theme: { accent: '#0F766E', text: '#1e293b', font: 'serif', title_font: 'sans', size: 11 },
  header: {
    show: 'every',
    logo: { kind: 'upload', data: LOGO },
    logo_width: 30,
    left: '<p><strong>Atelier Lumen</strong></p>',
    right: '<h1>FACTURE</h1><p>N° {{numero}}</p>',
    rule: true,
  },
  footer: { html: '<p>Facture {{numero}}</p>', align: 'center', page_numbers: true, rule: true },
  blocks: [
    { kind: 'title', text: 'Facture {{numero}}', subtitle: 'du {{date}}', style: 'band' },
    {
      kind: 'columns',
      widths: [2, 1],
      columns: [
        [
          {
            kind: 'fields',
            fields: ['statut', 'note', 'remise'],
            labels: 'above',
            hide_empty: true,
          },
        ],
        [{ kind: 'image', source: { kind: 'field', field: 'photo' }, width: 100, align: 'right' }],
      ],
    },
    {
      kind: 'rows',
      title: '',
      source: { kind: 'incoming', table: lines, field: 'factures_id' },
      columns: ['designation', 'quantite', 'prix'],
      totals: ['prix'],
      style: 'accent',
      zebra: true,
      headers: { quantite: 'Qté', ailleurs: 'ignoré' },
      widths: { quantite: 10 },
      align: { quantite: 'center' },
    },
    { kind: 'divider', color: 'accent', thickness: 1 },
    { kind: 'spacer', height: 10 },
    { kind: 'text', html: '<p>Merci.</p>', align: 'center', size: 'small', style: 'tint' },
    { kind: 'break' },
  ],
})

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  directory = await mkdtemp(join(tmpdir(), 'basedb-documents-'))
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    files: { storage: { driver: 'local', directory } },
  })
  await kernel.migrateCatalog()
  pools = new Pools({ connectionString: container.getConnectionUri() })
  // The kernel registers its storage on its own pools; these are the test's.
  useDocumentStorage(pools, createFileStorage({ driver: 'local', directory }))
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
  // Files are not among the kinds a table is created with: added one by one.
  await kernel.addField(admin, { tableId: invoices, label: 'Photo', kind: 'image' })
  await kernel.addField(admin, { tableId: invoices, label: 'Remise', kind: 'number' })
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

  const photo = await kernel.uploadFile(admin, {
    tableId: invoices,
    field: 'photo',
    name: 'photo.png',
    type: 'image/png',
    bytes: PNG,
  })
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
          photo: [photo.id],
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

  readers = (await kernel.createGroup(admin, { label: 'Lecteurs', sessionId: adminSession })).id
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
  if (directory !== undefined) await rm(directory, { recursive: true, force: true })
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

describe('a template, designed', () => {
  it('reads as it was drawn when it was written before themes', async () => {
    // Stored as the first version of the editor wrote it: no theme, a footer of one line.
    const [row] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `INSERT INTO _basedb.document_template (table_id, label, spec, position)
         VALUES ($1, 'Ancienne', $2::jsonb, 99) RETURNING id::text`,
        [
          invoices,
          JSON.stringify({
            page: { size: 'A4', orientation: 'portrait' },
            locale: 'fr',
            footer: 'SIRET 123 — {{numero}}',
            blocks: [
              { kind: 'text', html: '<p>{{numero}}</p>' },
              { kind: 'fields', fields: [] },
            ],
          }),
        ],
      ),
    )
    const listed = await kernel.listDocumentTemplates(admin, { tableId: invoices })
    const old = listed.find((t) => t.id === row?.id)
    expect(old?.spec).toMatchObject({
      page: { size: 'A4', orientation: 'portrait', valign: 'top' },
      theme: { accent: '#1d4ed8', text: '#111827', font: 'sans', size: 10, margin: 20 },
      header: { show: 'none', logo: null },
      footer: { html: '<p>SIRET 123 — {{numero}}</p>', page_numbers: true },
      blocks: [
        { kind: 'text', align: 'left', size: 'normal', style: 'plain' },
        { kind: 'fields', columns: 1, labels: 'beside', hide_empty: false },
      ],
    })
    const laid = (
      await prepareDocument(pools, admin, {
        tableId: invoices,
        recordId: invoice,
        templateId: row?.id as string,
      })
    ).laid
    expect(laid.footer.html).toBe('<p>SIRET 123 — F-1</p>')
    expect(laid.header).toBeNull()
  })

  it('checks colours, pictures and columns when written', async () => {
    const bad = (change: (s: ReturnType<typeof designed>) => unknown) =>
      reasonOf(
        kernel.createDocumentTemplate(admin, {
          tableId: invoices,
          label: 'X',
          spec: change(designed()),
        }),
      )
    expect(await bad((s) => ({ ...s, theme: { ...s.theme, accent: 'red' } }))).toBe(
      'couleur_invalide',
    )
    expect(await bad((s) => ({ ...s, theme: { ...s.theme, size: 40 } }))).toBe('valeur_hors_bornes')
    // A picture is what its bytes are: an HTML page called a PNG is not one.
    const html = Buffer.from('<html><script>alert(1)</script></html>').toString('base64')
    expect(
      await bad((s) => ({
        ...s,
        header: { ...s.header, logo: { kind: 'upload', data: `data:image/png;base64,${html}` } },
      })),
    ).toBe('image_invalide')
    expect(
      await bad((s) => ({
        ...s,
        header: {
          ...s.header,
          logo: { kind: 'upload', data: 'data:image/svg+xml;base64,PHN2Zz4=' },
        },
      })),
    ).toBe('image_invalide')
    const heavy = Buffer.concat([PNG, Buffer.alloc(400 * 1024)]).toString('base64')
    expect(
      await bad((s) => ({
        ...s,
        blocks: [
          { kind: 'image', source: { kind: 'upload', data: `data:image/png;base64,${heavy}` } },
        ],
      })),
    ).toBe('image_trop_lourde')
    expect(
      await bad((s) => ({
        ...s,
        blocks: [{ kind: 'image', source: { kind: 'field', field: 'note' } }],
      })),
    ).toBe('champ_image_attendu')
    expect(
      await bad((s) => ({
        ...s,
        blocks: [
          {
            kind: 'columns',
            columns: [[{ kind: 'break' }], [{ kind: 'text', html: '<p>a</p>' }]],
          },
        ],
      })),
    ).toBe('bloc_interdit_en_colonne')
    expect(
      await bad((s) => ({
        ...s,
        blocks: [{ kind: 'columns', columns: [[{ kind: 'fields', fields: ['disparu'] }], []] }],
      })),
    ).toBe('champ_inconnu')
    const many = Array.from({ length: 30 }, () => ({ kind: 'spacer', height: 5 }))
    expect(await bad((s) => ({ ...s, blocks: [{ kind: 'columns', columns: [many, many] }] }))).toBe(
      'trop_de_blocs',
    )
  })

  it('stores what it was given, colours and pictures in their canonical form', async () => {
    const template = await kernel.createDocumentTemplate(admin, {
      tableId: invoices,
      label: 'Facture soignée',
      spec: designed(),
    })
    expect(template.spec?.theme).toMatchObject({ accent: '#0f766e', font: 'serif', size: 11 })
    expect(template.spec?.header.logo).toEqual({ kind: 'upload', data: LOGO })
    expect(template.spec?.blocks[2]).toMatchObject({
      headers: { quantite: 'Qté' },
      widths: { quantite: 10 },
      align: { quantite: 'center' },
    })
  })

  it('cites the row in its header and titles, and sets its pictures', async () => {
    const draft = { label: 'Brouillon', spec: designed() }
    const laid = (
      await prepareDocument(pools, admin, {
        tableId: invoices,
        recordId: invoice,
        templateId: null,
        draft,
      })
    ).laid
    expect(laid.header).toMatchObject({
      show: 'every',
      right: '<h1>FACTURE</h1><p>N° F-1</p>',
      rule: true,
    })
    expect(laid.header?.logo?.equals(PNG)).toBe(true)
    expect(laid.footer).toEqual({
      html: '<p>Facture F-1</p>',
      align: 'center',
      pageNumbers: true,
      rule: true,
    })
    const [title, columns, table] = laid.blocks as [LaidBlock, LaidBlock, LaidBlock]
    expect(title).toMatchObject({
      kind: 'title',
      text: 'Facture F-1',
      subtitle: 'du 30 septembre 2026',
    })
    // An empty field is left out when asked.
    expect(columns).toMatchObject({
      kind: 'columns',
      widths: [2, 1],
      columns: [
        [
          {
            kind: 'fields',
            labels: 'above',
            rows: [
              { label: 'Statut', value: 'Émise' },
              { label: 'Note', value: 'À régler' },
            ],
          },
        ],
        [{ kind: 'image', width: 100, align: 'right' }],
      ],
    })
    const picture = (columns as Extract<LaidBlock, { kind: 'columns' }>).columns[1]?.[0]
    expect((picture as Extract<LaidBlock, { kind: 'image' }>).data.equals(PNG)).toBe(true)
    expect(table).toMatchObject({
      kind: 'table',
      style: 'accent',
      zebra: true,
      columns: [
        { label: 'Designation', numeric: false, width: null },
        { label: 'Qté', numeric: true, align: 'center', width: 10 },
        { label: 'Prix', numeric: true, width: null },
      ],
    })
    const bytes = await kernel.renderDocument(admin, {
      tableId: invoices,
      recordId: invoice,
      templateId: null,
      draft,
    })
    expect(bytes.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    if (process.env.BASEDB_PDF_SAMPLES)
      await writeFile(join(process.env.BASEDB_PDF_SAMPLES, 'int-designed.pdf'), bytes.bytes)
  })

  it('shows no picture of a field the reader may not read', async () => {
    const access = await kernel.fieldAccess(admin, { tableId: invoices })
    const photo = access.fields.find((f) => f.name === 'photo')?.id as string
    await kernel.setFieldRule(admin, {
      groupId: readers,
      fieldId: photo,
      rule: 'hidden',
      sessionId: adminSession,
    })
    const saved = await kernel.createDocumentTemplate(admin, {
      tableId: invoices,
      label: 'Avec photo',
      spec: {
        ...designed(),
        header: { show: 'none' },
        blocks: [
          { kind: 'image', source: { kind: 'field', field: 'photo' } },
          { kind: 'text', html: '<p>x</p>' },
        ],
      },
    })
    const asBob = (
      await prepareDocument(pools, await ctxOf(bob), {
        tableId: invoices,
        recordId: invoice,
        templateId: saved.id,
      })
    ).laid
    expect(asBob.blocks.map((b) => b.kind)).toEqual(['html'])
    const asAdmin = (
      await prepareDocument(pools, admin, {
        tableId: invoices,
        recordId: invoice,
        templateId: saved.id,
      })
    ).laid
    expect(asAdmin.blocks.map((b) => b.kind)).toEqual(['image', 'html'])
    await kernel.setFieldRule(admin, {
      groupId: readers,
      fieldId: photo,
      rule: null,
      sessionId: adminSession,
    })
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
    expect(laid.footer.html).toBe('<p>Facture F-1 — merci</p>')
    const [text, fields, table] = laid.blocks as [LaidBlock, LaidBlock, LaidBlock]
    expect(text).toMatchObject({
      kind: 'html',
      html: '<h1>Facture F-1</h1><p>Émise le 30 septembre 2026.</p>',
    })
    expect(fields).toMatchObject({
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
    expect(fieldsBlock).toMatchObject({
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
    expect(fields.rows.map((r) => r.label)).toEqual([
      'Numero',
      'Date',
      'Payee',
      'Note',
      'Photo',
      'Remise',
      'Statut',
    ])
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
