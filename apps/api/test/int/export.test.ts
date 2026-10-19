import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { type Kernel, startKernel } from '@basedb/core'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

/**
 * Taking a whole table, or a whole view, out as a file — chapter 08 §3.7.
 *
 * What it has to guarantee: the file is what the grid would show, read to the end — and
 * NOTHING more than what this reader reads. A column hidden from them is not in it, a row
 * their rules hide is not in it, a filter naming either is refused like a typo; and a table
 * of thousands of rows comes as a stream, page after page, not as one block in memory.
 */

const TENANT_REF = 't4z56fq'
const V1 = `/api/v1/${TENANT_REF}`
const PASSWORD = 'les chaussettes de larchiduchesse'
/** The kernel's bound in this suite: low enough to cross it with a few thousand rows. */
const MAX_ROWS = 3500
const PDF = new TextEncoder().encode('%PDF-1.7\n% un devis\n%%EOF\n')

type Session = { cookie: string; csrf: string; token: string }

let container: StartedPostgreSqlContainer
let kernel: Kernel
let app: ReturnType<typeof createApp>
let directory: string
let admin: Session
let alice: Session
let bob: Session
let aliceId = ''
let base = ''
let visitesId = ''
let groupEditors = ''
let clientField = ''
let fieldIds: Record<string, string> = {}
let sql: (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>
let closeSql: () => Promise<void>

async function signIn(email: string, password: string): Promise<Session> {
  const login = await app.request('/auth/password/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const csrf = ((await login.json()) as { data: { csrf: string } }).data.csrf
  return { cookie, csrf, token: await accessFor(cookie, csrf) }
}

async function accessFor(cookie: string, csrf: string): Promise<string> {
  const issued = await app.request('/auth/session/access', {
    method: 'POST',
    headers: { cookie, 'x-basedb-csrf': csrf },
  })
  return ((await issued.json()) as { data: { token: string } }).data.token
}

async function elevate(session: Session): Promise<Session> {
  const r = await app.request('/auth/elevate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    body: JSON.stringify({ password: PASSWORD }),
  })
  expect(r.status).toBe(200)
  const planted = r.headers.getSetCookie()
  const cookie = planted.find((c) => c.includes('basedb_session'))?.split(';')[0] ?? ''
  const csrf =
    planted
      .find((c) => c.includes('basedb_csrf'))
      ?.split(';')[0]
      ?.split('=')[1] ?? ''
  return { cookie, csrf, token: await accessFor(cookie, csrf) }
}

const call = (session: Session, path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function data<T>(r: Response): Promise<T> {
  return ((await r.json()) as { data: T }).data
}

/** An account, its temporary password changed for a known one. */
async function person(email: string, name: string): Promise<{ id: string; session: Session }> {
  const r = await call(admin, `${V1}/admin/users`, 'POST', { email, display_name: name })
  expect(r.status).toBe(201)
  const created = await data<{ user: { id: string }; temporary_password: string }>(r)
  const first = await signIn(email, created.temporary_password)
  const changed = await app.request('/auth/password/change', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: first.cookie,
      'x-basedb-csrf': first.csrf,
    },
    body: JSON.stringify({ current: created.temporary_password, next: PASSWORD }),
  })
  expect(changed.status).toBe(204)
  return { id: created.user.id, session: await signIn(email, PASSWORD) }
}

const ROWS = (table = 'visites') => `${V1}/data/${base}/${table}`

async function createRow(table: string, values: Record<string, unknown>): Promise<string> {
  const r = await call(admin, ROWS(table), 'POST', { values })
  expect(r.status, await r.clone().text()).toBe(201)
  return (await data<{ _id: string }>(r))._id
}

/** The export route of a table, with a query. */
const exportUrl = (query: Record<string, string>, table = 'visites') =>
  `${ROWS(table)}/export?${new URLSearchParams(query)}`

const exported = (who: Session, query: Record<string, string>, table = 'visites') =>
  call(who, exportUrl(query, table))

/** Every chunk the response delivered, as it delivered them. */
async function chunksOf(r: Response): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  const reader = (r.body as ReadableStream<Uint8Array>).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return out
    out.push(value)
  }
}

const join8 = (chunks: Uint8Array[]) => Buffer.concat(chunks)

// ── Reading what comes back ──────────────────────────────────────────────────────────

/** RFC 4180, as a spreadsheet reads it. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** The CSV of a response as records, header first. Fails if the BOM is not there. */
async function csvRecords(r: Response): Promise<Array<Record<string, string>>> {
  const text = Buffer.from(await r.arrayBuffer()).toString('utf8')
  expect(text.charCodeAt(0)).toBe(0xfeff)
  const [header, ...rows] = parseCsv(text.slice(1))
  return rows.map((cells) =>
    Object.fromEntries((header as string[]).map((name, i) => [name, cells[i] ?? ''])),
  )
}

/** The parts of a zip, by name — read from the central directory, as Excel does. */
function unzip(bytes: Buffer): Map<string, Buffer> {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  expect(end).toBeGreaterThan(0)
  const count = bytes.readUInt16LE(end + 10)
  let at = bytes.readUInt32LE(end + 16)
  const parts = new Map<string, Buffer>()
  for (let n = 0; n < count; n++) {
    expect(bytes.readUInt32LE(at)).toBe(0x02014b50)
    const crc = bytes.readUInt32LE(at + 16)
    const compressed = bytes.readUInt32LE(at + 20)
    const size = bytes.readUInt32LE(at + 24)
    const nameLength = bytes.readUInt16LE(at + 28)
    const offset = bytes.readUInt32LE(at + 42)
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    // The local header says nothing of the sizes (the descriptor follows the data): the
    // central directory's are the ones that count.
    expect(bytes.readUInt32LE(offset)).toBe(0x04034b50)
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28)
    const inflated = inflateRawSync(bytes.subarray(start, start + compressed))
    expect(inflated.length).toBe(size)
    // The descriptor right after the data repeats them.
    expect(bytes.readUInt32LE(start + compressed)).toBe(0x08074b50)
    expect(bytes.readUInt32LE(start + compressed + 4)).toBe(crc)
    parts.set(name, inflated)
    at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32)
  }
  return parts
}

type Cell = string | number | boolean

/** The cells of the first sheet of a workbook, by reference (`B2`). */
function sheetOf(bytes: Buffer): { cells: Map<string, Cell>; rows: number; parts: Set<string> } {
  const parts = unzip(bytes)
  const xml = (parts.get('xl/worksheets/sheet1.xml') as Buffer).toString('utf8')
  const xmlText = (text: string) =>
    text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
  const cells = new Map<string, Cell>()
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>(.*?)<\/c>/g)) {
    const [, ref, attributes, inner] = m as unknown as [string, string, string, string]
    if (attributes.includes('t="inlineStr"')) {
      cells.set(ref, xmlText(/<t[^>]*>(.*?)<\/t>/s.exec(inner)?.[1] ?? ''))
    } else if (attributes.includes('t="b"')) {
      cells.set(ref, /<v>1<\/v>/.test(inner))
    } else {
      cells.set(ref, Number(/<v>(.*?)<\/v>/.exec(inner)?.[1]))
    }
  }
  return { cells, rows: (xml.match(/<row /g) ?? []).length, parts: new Set(parts.keys()) }
}

// ── The fixtures ─────────────────────────────────────────────────────────────────────

let acme = ''
let dupont = ''
const rowIds: Record<string, string> = {}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  directory = await mkdtemp(join(tmpdir(), 'basedb-api-export-'))
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    files: { storage: { driver: 'local', directory } },
    exports: { maxRows: MAX_ROWS },
  })
  await kernel.migrateCatalog()

  const { Client } = await import('pg')
  const client = new Client({ connectionString: container.getConnectionUri() })
  await client.connect()
  sql = async (text, params = []) => (await client.query(text, params)).rows
  closeSql = () => client.end()
  await client.query('BEGIN')
  const { rows } = await client.query(
    `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
     VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
     RETURNING id, created_by`,
    [TENANT_REF],
  )
  await client.query(
    `INSERT INTO _basedb.app_user
       (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
     VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
    [rows[0].created_by, rows[0].id],
  )
  await client.query('COMMIT')

  app = createApp({ kernel })
  await kernel.setPassword({ userId: rows[0].created_by, password: PASSWORD })
  admin = await elevate(await signIn('bootstrap@basedb.local', PASSWORD))

  const created = await call(admin, `${V1}/admin/bases`, 'POST', { label: 'Chantiers' })
  base = (await data<{ name: string }>(created)).name

  // The table a link points at, with the column that stands for a row.
  const clients = await call(admin, `${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  expect(clients.status, await clients.clone().text()).toBe(201)
  expect(
    (
      await call(admin, `${V1}/admin/bases/${base}/tables/clients/display`, 'POST', {
        field: 'nom',
      })
    ).status,
  ).toBe(200)

  const table = await call(admin, `${V1}/admin/bases/${base}/tables`, 'POST', {
    label: 'Visites',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Montant', kind: 'number' },
      { label: 'Secret', kind: 'short_text' },
      { label: 'Note', kind: 'long_text' },
      { label: 'Terminée', kind: 'boolean' },
      { label: 'Jour', kind: 'date' },
      { label: 'Rappel', kind: 'datetime' },
    ],
  })
  expect(table.status, await table.clone().text()).toBe(201)
  visitesId = (await data<{ id: string }>(table)).id

  const FIELDS = `${V1}/admin/bases/${base}/tables/visites/fields`
  for (const body of [
    {
      label: 'Statut',
      kind: 'select',
      options: [
        { value: 'ouvert', label: 'Ouvert' },
        { value: 'clos', label: 'Clôturé' },
      ],
    },
    {
      label: 'Étiquettes',
      kind: 'multi_select',
      options: [
        { value: 'urgent', label: 'Très urgent' },
        { value: 'client', label: 'Client' },
      ],
    },
    { label: 'Responsable', kind: 'user' },
    { label: 'Devis', kind: 'file' },
    { label: 'Compte rendu', kind: 'long_text', rich: true },
  ]) {
    const added = await call(admin, FIELDS, 'POST', body)
    expect(added.status, await added.clone().text()).toBe(201)
  }
  const link = await call(admin, `${V1}/admin/bases/${base}/tables/visites/links`, 'POST', {
    label: 'Client',
    target: 'clients',
  })
  expect(link.status, await link.clone().text()).toBe(201)
  clientField = (await data<{ name: string }>(link)).name

  const access = await data<{ fields: Array<{ id: string; name: string }> }>(
    await call(admin, `${V1}/admin/access/tables/${visitesId}/fields`),
  )
  fieldIds = Object.fromEntries(access.fields.map((f) => [f.name, f.id]))

  // Alice edits the base, but her group cannot see « secret ». Bob reads « visites » alone:
  // the table its links point at is not his.
  const a = await person('alice@exemple.fr', 'Alice Martin')
  alice = a.session
  aliceId = a.id
  const b = await person('bob@exemple.fr', 'Bob Durand')
  bob = b.session
  const graph = await data<{ projects: Array<{ bases: Array<{ name: string; id: string }> }> }>(
    await call(admin, `${V1}/admin/access`),
  )
  const baseId = graph.projects.flatMap((p) => p.bases).find((x) => x.name === base)?.id
  groupEditors = (
    await data<{ id: string }>(
      await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Éditeurs' }),
    )
  ).id
  const readers = (
    await data<{ id: string }>(
      await call(admin, `${V1}/admin/groups`, 'POST', { label: 'Lecteurs' }),
    )
  ).id
  expect(
    (await call(admin, `${V1}/admin/groups/${groupEditors}/members/${a.id}`, 'PUT')).status,
  ).toBe(204)
  expect((await call(admin, `${V1}/admin/groups/${readers}/members/${b.id}`, 'PUT')).status).toBe(
    204,
  )
  const granted = await call(admin, `${V1}/admin/access`, 'POST', {
    changes: [
      { group: groupEditors, scope: { kind: 'base', id: baseId }, level: 'edit' },
      { group: readers, scope: { kind: 'table', id: visitesId }, level: 'read' },
    ],
  })
  expect(granted.status, await granted.clone().text()).toBe(200)
  const hidden = await call(admin, `${V1}/admin/access/fields/${fieldIds.secret}`, 'PUT', {
    group: groupEditors,
    rule: 'hidden',
  })
  expect(hidden.status, await hidden.clone().text()).toBe(200)

  // The rows. Text that a spreadsheet would run, text that needs quoting, accents, a person,
  // a file, a link, a list of choices, an instant.
  acme = await createRow('clients', { nom: 'ACME' })
  dupont = await createRow('clients', { nom: 'Dupont & Fils' })

  const deposit = await app.request(
    `${V1}/files/${base}/visites/devis?name=${encodeURIComponent('devis été.pdf')}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${admin.token}`,
        'content-type': 'application/pdf',
      },
      body: PDF,
    },
  )
  expect(deposit.status, await deposit.clone().text()).toBe(201)
  const file = (await data<{ id: string }>(deposit)).id

  rowIds.lyon = await createRow('visites', {
    nom: 'Lyon, centre',
    montant: 1500.5,
    secret: 'code-1',
    note: 'ligne 1\nligne 2 « citée » "entre guillemets"',
    terminee: true,
    jour: '2026-03-01',
    rappel: '2026-03-01T08:30:00Z',
    statut: 'ouvert',
    etiquettes: ['urgent', 'client'],
    [clientField]: acme,
    responsable: aliceId,
    devis: [{ id: file }],
    compte_rendu: '<p>Bonjour <strong>toi</strong></p><p>Suite</p>',
  })
  rowIds.formule = await createRow('visites', {
    nom: '=1+1',
    montant: -3,
    secret: 'code-2',
    terminee: false,
    statut: 'clos',
    [clientField]: dupont,
  })
  rowIds.horsPortee = await createRow('visites', {
    nom: 'Hors de portée',
    montant: 10,
    secret: 'code-3',
  })
  rowIds.cafe = await createRow('visites', {
    nom: 'Café <crème> & co',
    montant: 2,
    secret: 'code-4',
  })
}, 300_000)

afterAll(async () => {
  await closeSql?.()
  await kernel?.close()
  await container?.stop()
  if (directory !== undefined) await rm(directory, { recursive: true, force: true })
})

// ── The formats ──────────────────────────────────────────────────────────────────────

describe('a table as CSV', () => {
  it('is a download: UTF-8 with a BOM, never cached, named after the table and the day', async () => {
    const r = await exported(admin, { format: 'csv' })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(r.headers.get('content-disposition')).toMatch(
      /^attachment; filename="visites-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    const bytes = Buffer.from(await r.arrayBuffer())
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('writes what the grid shows: labels, names, dates in ISO, the row a link designates', async () => {
    const records = await csvRecords(await exported(admin, { format: 'csv', sort: 'montant' }))
    expect(records).toHaveLength(4)
    const lyon = records.find((r) => r.nom === 'Lyon, centre')
    expect(lyon).toMatchObject({
      montant: '1500.5',
      terminee: 'true',
      jour: '2026-03-01',
      rappel: '2026-03-01T08:30:00.000Z',
      // A choice by its label, a list of them in the order the row holds them.
      statut: 'Ouvert',
      etiquettes: 'Très urgent, Client',
      // The label of the row a link designates, the name of a person, the name of a file.
      [clientField]: 'ACME',
      responsable: 'Alice Martin',
      devis: 'devis été.pdf',
      // A rich text, as the words it reads.
      compte_rendu: 'Bonjour toi\nSuite',
      _id: rowIds.lyon,
    })
    // A field that holds a quote, a comma and a line break survives the round trip.
    expect(lyon?.note).toBe('ligne 1\nligne 2 « citée » "entre guillemets"')
    // The system columns come with the rest, the people by name.
    expect(lyon?._created_by).toBe('Bootstrap')
    expect(lyon?._created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    // Nothing set is empty, not a word.
    const formula = records.find((r) => r.nom === "'=1+1")
    expect(formula).toMatchObject({
      terminee: 'false',
      jour: '',
      statut: 'Clôturé',
      etiquettes: '',
    })
  })

  it('does not let a text become a formula in a spreadsheet, and quotes what needs it', async () => {
    const records = await csvRecords(await exported(admin, { format: 'csv' }))
    // « =1+1 » would be run by Excel: a quote in front makes it text. -3 is a figure: untouched.
    expect(records.map((r) => r.nom)).toContain("'=1+1")
    expect(records.find((r) => r.montant === '-3')).toBeDefined()
    expect(records.map((r) => r.nom)).toContain('Café <crème> & co')
    expect(records.map((r) => r.nom)).toContain('Lyon, centre')
  })

  it('keeps the columns asked for, in the order asked for, and says labels on request', async () => {
    const r = await exported(admin, {
      format: 'csv',
      fields: 'montant,nom',
      headers: 'label',
      sort: '-montant',
    })
    const text = Buffer.from(await r.arrayBuffer())
      .toString('utf8')
      .slice(1)
    expect(parseCsv(text)[0]).toEqual(['Montant', 'Nom'])
    expect(parseCsv(text).slice(1)).toEqual([
      ['1500.5', 'Lyon, centre'],
      ['10', 'Hors de portée'],
      ['2', 'Café <crème> & co'],
      ['-3', "'=1+1"],
    ])
  })
})

describe('a table as JSON', () => {
  it('is the array of the API’s own rows, projected to the columns asked for', async () => {
    const r = await exported(admin, {
      format: 'json',
      fields: 'nom,statut,etiquettes,responsable,devis',
      filter: 'nom eq "Lyon, centre"',
    })
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8')
    const rows = JSON.parse(await r.text()) as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0] as object)).toEqual([
      'nom',
      'statut',
      'etiquettes',
      'responsable',
      'devis',
    ])
    // Choices by their stored value, the person by identifier, a file without its signed link.
    expect(rows[0]).toMatchObject({
      nom: 'Lyon, centre',
      statut: 'ouvert',
      etiquettes: ['urgent', 'client'],
      responsable: aliceId,
    })
    const [devis] = (rows[0] as { devis: Array<Record<string, unknown>> }).devis
    expect(devis).toMatchObject({ name: 'devis été.pdf', type: 'application/pdf' })
    expect(devis).not.toHaveProperty('url')
  })

  it('keeps a link as { id, display }, and is [] for no row at all', async () => {
    const r = await exported(admin, { format: 'json', fields: `nom,${clientField}`, sort: 'nom' })
    const rows = JSON.parse(await r.text()) as Array<Record<string, unknown>>
    expect(rows.find((x) => x.nom === 'Lyon, centre')?.[clientField]).toEqual({
      id: acme,
      display: 'ACME',
    })

    const none = await exported(admin, { format: 'json', filter: 'nom eq "personne"' })
    expect(JSON.parse(await none.text())).toEqual([])
  })
})

describe('a table as an Excel workbook', () => {
  it('is a valid zip of the parts a workbook needs, its sheet named after the table', async () => {
    const r = await exported(admin, { format: 'xlsx', headers: 'label', sort: 'montant' })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(r.headers.get('content-disposition')).toMatch(/filename="visites-[\d-]+\.xlsx"/)
    const bytes = Buffer.from(await r.arrayBuffer())
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])

    const sheet = sheetOf(bytes)
    expect([...sheet.parts].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
    expect(sheet.rows).toBe(5)
    const workbook = (unzip(bytes).get('xl/workbook.xml') as Buffer).toString('utf8')
    expect(workbook).toContain('<sheet name="Visites"')
  })

  it('types its cells: numbers as numbers, yes/no as booleans, text as text, escaped', async () => {
    const r = await exported(admin, {
      format: 'xlsx',
      fields: 'nom,montant,terminee,jour,statut',
      headers: 'label',
      sort: 'montant',
    })
    const { cells } = sheetOf(Buffer.from(await r.arrayBuffer()))
    // The header row says what a person reads.
    expect([cells.get('A1'), cells.get('B1'), cells.get('C1'), cells.get('D1')]).toEqual([
      'Nom',
      'Montant',
      'Terminée',
      'Jour',
    ])
    // Sorted by amount: -3, 2, 10, 1500.5.
    expect(cells.get('B2')).toBe(-3)
    expect(cells.get('B5')).toBe(1500.5)
    expect(cells.get('A2')).toBe('=1+1') // a string in a workbook, never a formula
    expect(cells.get('A3')).toBe('Café <crème> & co')
    expect(cells.get('C5')).toBe(true)
    expect(cells.get('C2')).toBe(false)
    expect(cells.get('D5')).toBe('2026-03-01')
    expect(cells.get('E5')).toBe('Ouvert')
    // Empty cells are not written.
    expect(cells.has('D3')).toBe(false)
  })
})

// ── What the reader may not read ─────────────────────────────────────────────────────

describe('the reader’s rights, exactly as for a page', () => {
  it('leaves a hidden column out of the file — and refuses to be asked for it', async () => {
    const mine = await csvRecords(await exported(alice, { format: 'csv' }))
    expect(Object.keys(mine[0] as object)).not.toContain('secret')
    expect(Object.keys(mine[0] as object)).toContain('nom')
    // The administrator, for contrast, reads it.
    const all = await csvRecords(await exported(admin, { format: 'csv' }))
    expect(Object.keys(all[0] as object)).toContain('secret')

    // A column one cannot read is an unknown one: the same code as for a typo, parameter
    // by parameter.
    for (const [hiddenQuery, typoQuery, code] of [
      [
        { format: 'csv', fields: 'nom,secret' },
        { format: 'csv', fields: 'nom,inconnu' },
        'FILTER_FIELD_UNKNOWN',
      ],
      [
        { format: 'json', filter: 'secret eq "code-1"' },
        { format: 'json', filter: 'inconnu eq "code-1"' },
        'FILTER_FIELD_UNKNOWN',
      ],
      [
        { format: 'xlsx', sort: 'secret' },
        { format: 'xlsx', sort: 'inconnu' },
        'SORT_FIELD_UNKNOWN',
      ],
    ] as const) {
      const refused = await exported(alice, hiddenQuery)
      const typo = await exported(alice, typoQuery)
      expect(refused.status, JSON.stringify(hiddenQuery)).toBe(400)
      expect(typo.status).toBe(400)
      const body = (await refused.json()) as { code: string }
      expect(body.code).toBe(code)
      expect(((await typo.json()) as { code: string }).code).toBe(code)
    }
    // And a refusal is the API’s usual body, not a file.
    const json = await (await exported(alice, { format: 'csv', fields: 'secret' })).json()
    expect(json).toMatchObject({ code: 'FILTER_FIELD_UNKNOWN', details: { field: 'secret' } })
  })

  it('leaves out a row the reader’s rules hide, and a filter cannot bring it back', async () => {
    const before = await csvRecords(await exported(alice, { format: 'csv' }))
    expect(before.map((r) => r.nom)).toContain('Hors de portée')

    const rule = await call(admin, `${V1}/admin/access/tables/${visitesId}/rows`, 'PUT', {
      group: groupEditors,
      rule: 'nom ne "Hors de portée"',
    })
    expect(rule.status, await rule.clone().text()).toBe(200)
    try {
      const mine = await csvRecords(await exported(alice, { format: 'csv' }))
      expect(mine).toHaveLength(3)
      expect(mine.map((r) => r.nom)).not.toContain('Hors de portée')

      const asked = await csvRecords(
        await exported(alice, { format: 'csv', filter: 'nom eq "Hors de portée"' }),
      )
      expect(asked).toEqual([])
      const sheet = sheetOf(
        Buffer.from(await (await exported(alice, { format: 'xlsx' })).arrayBuffer()),
      )
      expect(sheet.rows).toBe(4)
      const json = JSON.parse(await (await exported(alice, { format: 'json' })).text()) as unknown[]
      expect(json).toHaveLength(3)
      // The administrator is not held by the group's rule.
      expect(await csvRecords(await exported(admin, { format: 'csv' }))).toHaveLength(4)
    } finally {
      await call(admin, `${V1}/admin/access/tables/${visitesId}/rows`, 'PUT', {
        group: groupEditors,
        rule: null,
      })
    }
  })

  it('writes nothing of a link to a table the reader cannot read', async () => {
    const records = await csvRecords(await exported(bob, { format: 'csv' }))
    expect(records).toHaveLength(4)
    expect(records.every((r) => r[clientField] === '')).toBe(true)
    const json = JSON.parse(
      await (await exported(bob, { format: 'json', fields: `nom,${clientField}` })).text(),
    ) as Array<Record<string, unknown>>
    expect(json.find((r) => r.nom === 'Lyon, centre')?.[clientField]).toEqual({
      id: null,
      display: null,
      masked: true,
    })
    expect(JSON.stringify(json)).not.toContain('ACME')
  })

  it('answers for a table one cannot see as for one that is not there', async () => {
    const hidden = await exported(bob, { format: 'csv' }, 'clients')
    const missing = await exported(bob, { format: 'csv' }, 'nexistepas')
    expect(hidden.status).toBe(404)
    expect(missing.status).toBe(404)
    const a = (await hidden.json()) as { code: string; details: Record<string, unknown> }
    const b = (await missing.json()) as { code: string; details: Record<string, unknown> }
    expect(a.code).toBe('RESOURCE_NOT_FOUND')
    expect(b.code).toBe(a.code)
  })
})

describe('the way in', () => {
  it('opens to an access token and to an integration token — never to the cookie alone', async () => {
    const withCookie = await app.request(exportUrl({ format: 'csv' }), {
      headers: { cookie: admin.cookie },
    })
    expect(withCookie.status).toBe(401)
    const anonymous = await app.request(exportUrl({ format: 'csv' }))
    expect(anonymous.status).toBe(401)

    const minted = await call(admin, `${V1}/admin/tokens`, 'POST', {
      label: 'Export programme',
      base,
      access: 'read',
      surfaces: ['rest'],
    })
    expect(minted.status, await minted.clone().text()).toBe(201)
    const secret = (await data<{ secret: string }>(minted)).secret
    const r = await app.request(exportUrl({ format: 'csv', fields: 'nom' }), {
      headers: { authorization: `Bearer ${secret}` },
    })
    expect(r.status).toBe(200)
    expect((await csvRecords(r)).map((x) => x.nom).sort()).toEqual([
      "'=1+1",
      'Café <crème> & co',
      'Hors de portée',
      'Lyon, centre',
    ])
  })

  it('refuses a format it does not write, and a header row it cannot say', async () => {
    for (const query of [{ format: 'pdf' }, {}, { format: 'csv', headers: 'tout' }]) {
      const r = await exported(admin, query)
      expect(r.status, JSON.stringify(query)).toBe(400)
      expect(((await r.json()) as { code: string }).code).toBe('REQUEST_INVALID')
    }
  })

  it('applies the filter and the sort of the grid, and refuses a filter that is not one', async () => {
    const some = await csvRecords(
      await exported(admin, { format: 'csv', filter: 'montant gt 5', sort: 'montant' }),
    )
    expect(some.map((r) => r.nom)).toEqual(['Hors de portée', 'Lyon, centre'])
    const reversed = await csvRecords(
      await exported(admin, { format: 'csv', filter: 'montant gt 5', sort: '-montant' }),
    )
    expect(reversed.map((r) => r.nom)).toEqual(['Lyon, centre', 'Hors de portée'])

    // The same refusal as the list gives for the same expression.
    const bad = await exported(admin, { format: 'csv', filter: 'montant gt' })
    const list = await call(admin, `${ROWS()}?filter=${encodeURIComponent('montant gt')}`)
    expect(bad.status).toBe(400)
    expect(list.status).toBe(400)
    expect(((await bad.json()) as { code: string }).code).toBe(
      ((await list.json()) as { code: string }).code,
    )
  })
})

// ── A big table ──────────────────────────────────────────────────────────────────────

describe('a table of thousands of rows', () => {
  const ROWS_IN_TABLE = 3200

  it('is filled', async () => {
    const made = await call(admin, `${V1}/admin/bases/${base}/tables`, 'POST', {
      label: 'Mesures',
      fields: [
        { label: 'Rang', kind: 'number' },
        { label: 'Libellé', kind: 'short_text' },
      ],
    })
    expect(made.status, await made.clone().text()).toBe(201)
    for (let from = 1; from <= ROWS_IN_TABLE; from += 1000) {
      const to = Math.min(from + 999, ROWS_IN_TABLE)
      const operations = []
      for (let n = from; n <= to; n++) {
        operations.push({ op: 'create', data: { rang: n, libelle: `Mesure n° ${n}` } })
      }
      const r = await call(admin, `${ROWS('mesures')}/batch`, 'POST', { atomic: true, operations })
      expect(r.status, (await r.clone().text()).slice(0, 300)).toBe(200)
    }
  }, 120_000)

  it('arrives in pieces — a stream, page after page — and complete, in order, once each', async () => {
    const r = await exported(
      admin,
      { format: 'csv', fields: 'rang,libelle', sort: 'rang' },
      'mesures',
    )
    expect(r.status).toBe(200)
    // No length is announced: the end is not known when the first byte leaves.
    expect(r.headers.get('content-length')).toBeNull()
    const chunks = await chunksOf(r)
    // 3 200 rows are seven pages of 500: more than one piece, none of them the whole.
    expect(chunks.length).toBeGreaterThan(3)
    const total = chunks.reduce((n, c) => n + c.length, 0)
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThan(total / 3)

    const rows = parseCsv(join8(chunks).toString('utf8').slice(1))
    expect(rows[0]).toEqual(['rang', 'libelle'])
    expect(rows).toHaveLength(ROWS_IN_TABLE + 1)
    expect(rows.slice(1).map((x) => Number(x[0]))).toEqual(
      Array.from({ length: ROWS_IN_TABLE }, (_, i) => i + 1),
    )
    expect(rows[ROWS_IN_TABLE]).toEqual([String(ROWS_IN_TABLE), `Mesure n° ${ROWS_IN_TABLE}`])
  })

  it('is complete in the other direction too, and as JSON and as a workbook', async () => {
    const down = await csvRecords(
      await exported(admin, { format: 'csv', fields: 'rang', sort: '-rang' }, 'mesures'),
    )
    expect(down).toHaveLength(ROWS_IN_TABLE)
    expect(down[0]).toEqual({ rang: String(ROWS_IN_TABLE) })
    expect(new Set(down.map((x) => x.rang)).size).toBe(ROWS_IN_TABLE)

    const json = JSON.parse(
      await (
        await exported(admin, { format: 'json', fields: 'rang', sort: 'rang' }, 'mesures')
      ).text(),
    ) as Array<{ rang: string }>
    expect(json).toHaveLength(ROWS_IN_TABLE)
    // JSON is what the API says: a figure at its column’s scale, as a text.
    expect(json.at(-1)).toEqual({ rang: '3200.0000000000' })

    const sheet = sheetOf(
      Buffer.from(
        await (
          await exported(admin, { format: 'xlsx', fields: 'rang,libelle', sort: 'rang' }, 'mesures')
        ).arrayBuffer(),
      ),
    )
    expect(sheet.rows).toBe(ROWS_IN_TABLE + 1)
    expect(sheet.cells.get(`A${ROWS_IN_TABLE + 1}`)).toBe(ROWS_IN_TABLE)
    expect(sheet.cells.get(`B${ROWS_IN_TABLE + 1}`)).toBe(`Mesure n° ${ROWS_IN_TABLE}`)
  })

  it('exports the view’s filter only', async () => {
    const some = await csvRecords(
      await exported(
        admin,
        { format: 'csv', fields: 'rang', filter: 'rang between [1000, 1499]', sort: 'rang' },
        'mesures',
      ),
    )
    expect(some).toHaveLength(500)
    expect(some[0]).toEqual({ rang: '1000' })
    expect(some.at(-1)).toEqual({ rang: '1499' })
  })

  it('is refused BEFORE its first byte past the bound — and not when a filter brings it under', async () => {
    const more = []
    for (let n = ROWS_IN_TABLE + 1; n <= ROWS_IN_TABLE + 400; n++) {
      more.push({ op: 'create', data: { rang: n, libelle: `Mesure n° ${n}` } })
    }
    expect(
      (await call(admin, `${ROWS('mesures')}/batch`, 'POST', { atomic: true, operations: more }))
        .status,
    ).toBe(200)

    for (const format of ['csv', 'json', 'xlsx']) {
      const refused = await exported(admin, { format }, 'mesures')
      expect(refused.status, format).toBe(400)
      expect(refused.headers.get('content-type')).toContain('application/json')
      expect(refused.headers.get('content-disposition')).toBeNull()
      expect(await refused.json()).toMatchObject({
        code: 'REQUEST_INVALID',
        details: { reason: 'export_trop_gros', maximum: MAX_ROWS },
      })
    }
    const fits = await csvRecords(
      await exported(admin, { format: 'csv', fields: 'rang', filter: 'rang lte 3000' }, 'mesures'),
    )
    expect(fits).toHaveLength(3000)
  })
})

// ── Bounds, and the journal ──────────────────────────────────────────────────────────

describe('what an export is bounded by, and what it leaves behind', () => {
  it('lets one actor run three at once, and no more — and a fourth waits for a slot', async () => {
    const open: Response[] = []
    for (let n = 0; n < 3; n++) {
      const r = await exported(admin, { format: 'csv' })
      expect(r.status).toBe(200)
      open.push(r)
    }
    const fourth = await exported(admin, { format: 'csv' })
    expect(fourth.status).toBe(429)
    expect(await fourth.json()).toMatchObject({
      code: 'CONCURRENCY_LIMIT_EXCEEDED',
      details: { exports: 3 },
    })
    // Someone else is not held by it.
    expect((await exported(alice, { format: 'csv', fields: 'nom' })).status).toBe(200)

    // A client that hangs up gives its slot back.
    for (const r of open) await r.body?.cancel()
    const again = await exported(admin, { format: 'csv' })
    expect(again.status).toBe(200)
    await again.arrayBuffer()
  })

  it('writes who took what, in which shape and how many rows — never a value', async () => {
    const secret = 'valeur-secrete-du-filtre'
    const r = await exported(alice, {
      format: 'json',
      fields: 'nom',
      filter: `nom eq "${secret}"`,
      sort: '-montant',
    })
    expect(r.status).toBe(200)
    await r.arrayBuffer()

    const journal = await sql(
      `SELECT actor_kind, actor_user_id::text AS actor, surface, object_kind, object_name,
              table_id::text AS table_id, payload
         FROM _basedb.audit_log
        WHERE action = 'records.export'
        ORDER BY occurred_at`,
    )
    const last = journal.at(-1) as Record<string, unknown>
    expect(last).toMatchObject({
      actor_kind: 'user',
      actor: aliceId,
      surface: 'rest',
      object_kind: 'table',
      object_name: 'visites',
      table_id: visitesId,
    })
    expect(last.payload).toEqual({
      export: {
        format: 'json',
        columns: ['nom'],
        filtered: true,
        sort: '-montant',
        rows: 0,
        outcome: 'complete',
      },
    })
    // Not a word of the filter, nor of any cell.
    expect(JSON.stringify(journal)).not.toContain(secret)

    // A whole export counts its rows, and the integration token is named as the actor.
    const rows = journal.map((e) => (e.payload as { export: { rows: number } }).export.rows)
    expect(rows).toContain(4)
    expect(journal.some((e) => e.actor_kind === 'token')).toBe(true)
    expect(
      journal.some(
        (e) => (e.payload as { export: { outcome: string } }).export.outcome === 'aborted',
      ),
    ).toBe(true)
  })

  it('stops at once when the reader of the stream stops, and lets go of the connection', async () => {
    const r = await exported(
      admin,
      { format: 'csv', fields: 'rang,libelle', sort: 'rang', filter: 'rang lte 3000' },
      'mesures',
    )
    const reader = (r.body as ReadableStream<Uint8Array>).getReader()
    await reader.read()
    await reader.cancel()
    // The pool has all its connections back: the next export goes through.
    const next = await exported(admin, { format: 'csv', fields: 'nom' })
    expect(next.status).toBe(200)
    await next.arrayBuffer()
  })
})
