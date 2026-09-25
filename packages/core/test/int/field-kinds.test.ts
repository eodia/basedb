import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addField } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { setSelectOptions } from '../../src/catalog/select-options.js'
import type { BasedbError } from '../../src/errors/index.js'
import {
  DEFAULT_MAX_FILE_BYTES,
  type FileDeps,
  openFile,
  uploadFile,
  withFileLinks,
} from '../../src/files/operations.js'
import { createFileStorage } from '../../src/files/storage.js'
import { createRecord } from '../../src/records/create.js'
import { listRecords } from '../../src/records/list.js'
import { updateRecord } from '../../src/records/update.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The multiple choice, the document and the image — chapter 04 §3 and §3 bis.
 *
 * What only a real PostgreSQL can say: that the columns are the types announced, that
 * their `CHECK` holds direct SQL to the same rules as the API, that a narrowing of the
 * list counts the rows of an ARRAY column, and that a file goes from deposit to cell to
 * download with the catalog, not the client, deciding what the cell says.
 */

const TENANT_REF = 't4z56fq'
const PDF = new TextEncoder().encode('%PDF-1.7\n% un devis\n%%EOF\n')
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let schemaName: string
let tableId: string
let tableName: string
let directory: string
let files: FileDeps

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

/** A statement written in psql, outside the kernel: what the `CHECK` alone must stop. */
async function direct(sql: string, params: unknown[] = []) {
  return pools.withConnection('data', (exec) => exec.query(sql, params, 'insert'))
}

async function columnType(column: string): Promise<string> {
  const [row] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ t: string }>(
      `SELECT format_type(a.atttypid, a.atttypmod) AS t
         FROM pg_attribute a
         JOIN pg_class r     ON r.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = r.relnamespace
        WHERE n.nspname = $1 AND r.relname = $2 AND a.attname = $3`,
      [schemaName, tableName, column],
    ),
  )
  return row.t
}

async function streamText(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })

  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
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

  const now = new Date('2026-09-25T12:00:00.000Z')
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000006c',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'Chantiers' })
  schemaName = base.schemaName
  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Visites',
    fields: [{ label: 'Nom', kind: 'short_text', required: true }],
  })
  tableId = table.tableId
  tableName = table.tableName

  directory = await mkdtemp(join(tmpdir(), 'basedb-files-'))
  files = {
    pools,
    storage: createFileStorage({ driver: 'local', directory }),
    maxBytes: DEFAULT_MAX_FILE_BYTES,
    linkKey: Buffer.alloc(32, 3),
  }
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
  if (directory !== undefined) await rm(directory, { recursive: true, force: true })
})

describe('multiple choice', () => {
  let tags: string

  beforeAll(async () => {
    const field = await addField(pools, ctx, {
      tableId,
      label: 'Étiquettes',
      kind: 'multi_select',
      options: [{ value: 'urgent', color: '#e11d48' }, { value: 'client' }, { value: 'interne' }],
    })
    tags = field.name
  }, 60_000)

  it('is a text array, and the kernel writes it without repeats', async () => {
    expect(await columnType(tags)).toBe('text[]')
    const { row } = await createRecord(pools, ctx, {
      tableId,
      values: { nom: 'A', [tags]: ['client', 'urgent', 'client'] },
    })
    expect(row[tags]).toEqual(['client', 'urgent'])
  })

  it('writes an empty list as NULL', async () => {
    const { row } = await createRecord(pools, ctx, { tableId, values: { nom: 'B', [tags]: [] } })
    expect(row[tags]).toBeNull()
  })

  it('refuses a value outside the list — through the kernel and in direct SQL alike', async () => {
    const refused = await failure(
      createRecord(pools, ctx, { tableId, values: { nom: 'C', [tags]: ['urgent', 'inconnu'] } }),
    )
    expect(refused.code).toMatch(/^VALUE_/)

    const relation = `"${schemaName}"."${tableName}"`
    for (const literal of [`'{inconnu}'`, `'{}'`, `'{{urgent}}'`, 'ARRAY[NULL]::text[]']) {
      const error = await failure(
        direct(`INSERT INTO ${relation} ("nom", "${tags}") VALUES ('x', ${literal})`),
      )
      expect(error.code, literal).toMatch(/^VALUE_/)
    }
  })

  it('is filtered with has_any and has_all', async () => {
    await createRecord(pools, ctx, { tableId, values: { nom: 'D', [tags]: ['interne'] } })

    const any = await listRecords(pools, ctx, {
      tableId,
      filter: `${tags} has_any ["urgent", "interne"]`,
      sort: 'nom',
    })
    expect(any.rows.map((r) => r.nom)).toEqual(['A', 'D'])

    const all = await listRecords(pools, ctx, {
      tableId,
      filter: `${tags} has_all ["urgent", "client"]`,
    })
    expect(all.rows.map((r) => r.nom)).toEqual(['A'])

    const none = await listRecords(pools, ctx, {
      tableId,
      filter: `not ${tags} has_any "urgent" and not ${tags} is_null`,
    })
    expect(none.rows.map((r) => r.nom)).toEqual(['D'])
  })

  it('refuses to drop a value rows still hold, counting rows per value', async () => {
    const refused = await failure(
      setSelectOptions(pools, ctx, {
        fieldId: (await fieldId(tags)) as string,
        options: [{ value: 'interne' }],
      }),
    )
    expect(refused.code).toBe('OPTION_IN_USE')
    expect(refused.details?.options).toEqual([
      { value: 'client', count: 1 },
      { value: 'urgent', count: 1 },
    ])
  })

  it('regenerates its CHECK when the list grows, and holds new rows to it', async () => {
    const result = await setSelectOptions(pools, ctx, {
      fieldId: (await fieldId(tags)) as string,
      options: [{ value: 'urgent' }, { value: 'client' }, { value: 'interne' }, { value: 'devis' }],
    })
    expect(result.added).toEqual(['devis'])
    expect(result.sql[0]).toContain(`<@ ARRAY['urgent', 'client', 'interne', 'devis']::text[]`)

    const { row } = await createRecord(pools, ctx, {
      tableId,
      values: { nom: 'E', [tags]: ['devis'] },
    })
    expect(row[tags]).toEqual(['devis'])
  })
})

async function fieldId(name: string): Promise<string | undefined> {
  const [row] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ id: string }>(
      `SELECT f.id FROM _basedb.field f JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE f.table_id = $1 AND n.name = $2`,
      [tableId, name],
    ),
  )
  return row?.id
}

describe('documents and images', () => {
  let pieces: string
  let photos: string

  beforeAll(async () => {
    pieces = (await addField(pools, ctx, { tableId, label: 'Pièces jointes', kind: 'file' })).name
    photos = (await addField(pools, ctx, { tableId, label: 'Photos', kind: 'image' })).name
  }, 60_000)

  it('are jsonb columns', async () => {
    expect(await columnType(pieces)).toBe('jsonb')
    expect(await columnType(photos)).toBe('jsonb')
  })

  it('go from deposit to cell, the cell saying what the CATALOG knows of the file', async () => {
    const deposited = await uploadFile(files, ctx, {
      tableId,
      field: pieces,
      name: 'C:\\temp\\devis été.pdf',
      type: 'application/octet-stream',
      bytes: PDF,
    })
    // The type is found in the bytes, the name keeps its accents and loses its directory.
    expect(deposited).toMatchObject({
      name: 'devis été.pdf',
      type: 'application/pdf',
      size: PDF.length,
    })

    // What the client claims about the file is ignored and re-read from the catalog.
    const { row } = await createRecord(pools, ctx, {
      tableId,
      values: { nom: 'F', [pieces]: [{ id: deposited.id, name: 'autre.exe', size: 1 }] },
    })
    expect(row[pieces]).toEqual([
      { id: deposited.id, name: 'devis été.pdf', type: 'application/pdf', size: PDF.length },
    ])

    // A read hands out a link; the link opens the file, and nothing else does.
    const [linked] = withFileLinks(files.linkKey, ctx, [row], [pieces])
    const url = new URL((linked[pieces] as Array<{ url: string }>)[0].url, 'http://api')
    const request = {
      tenant: TENANT_REF,
      id: deposited.id,
      expires: url.searchParams.get('exp') ?? undefined,
      signature: url.searchParams.get('sig') ?? undefined,
    }
    const opened = await openFile(files, request, ctx.timestamp)
    expect(opened).toMatchObject({ type: 'application/pdf', inline: true, name: 'devis été.pdf' })
    expect(Buffer.from(await streamText(opened.body)).equals(Buffer.from(PDF))).toBe(true)

    for (const tampered of [
      { ...request, signature: `${request.signature?.slice(0, -1)}A` },
      { ...request, tenant: 'autre' },
      { ...request, expires: String(Number(request.expires) + 1) },
    ]) {
      expect((await failure(openFile(files, tampered, ctx.timestamp))).code).toBe(
        'RESOURCE_NOT_FOUND',
      )
    }
    // Expired: the same link, a day later.
    const later = new Date(ctx.timestamp.getTime() + 24 * 3600 * 1000)
    expect((await failure(openFile(files, request, later))).code).toBe('RESOURCE_NOT_FOUND')
  })

  it('refuses a file that was not deposited for this very field', async () => {
    const forPieces = await uploadFile(files, ctx, {
      tableId,
      field: pieces,
      name: 'plan.pdf',
      type: 'application/pdf',
      bytes: PDF,
    })
    const refused = await failure(
      createRecord(pools, ctx, { tableId, values: { nom: 'G', [photos]: [forPieces.id] } }),
    )
    expect(refused.code).toBe('VALUE_INVALID')
    expect(refused.details?.reason).toBe('fichier_inconnu')

    const unknown = await failure(
      createRecord(pools, ctx, {
        tableId,
        values: { nom: 'G', [pieces]: ['0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b'] },
      }),
    )
    expect(unknown.details?.reason).toBe('fichier_inconnu')
  })

  it('takes into an image field only what the bytes say is a picture', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
    const refused = await failure(
      uploadFile(files, ctx, {
        tableId,
        field: photos,
        name: 'logo.png',
        type: 'image/png',
        bytes: svg,
      }),
    )
    expect(refused.code).toBe('CONTENT_TYPE_INVALID')

    const png = await uploadFile(files, ctx, {
      tableId,
      field: photos,
      name: 'façade.png',
      type: undefined,
      bytes: PNG,
    })
    expect(png.type).toBe('image/png')

    const created = await createRecord(pools, ctx, {
      tableId,
      values: { nom: 'H', [photos]: [png.id] },
    })
    const updated = await updateRecord(pools, ctx, {
      tableId,
      recordId: String(created.row._id),
      values: { [photos]: [] },
    })
    expect(updated.row[photos]).toBeNull()
    expect(updated.fileColumns).toEqual([pieces, photos])
  })

  it('refuses a deposit into a field that holds no files, or larger than the bound', async () => {
    expect(
      (
        await failure(
          uploadFile(files, ctx, { tableId, field: 'nom', name: 'a', type: undefined, bytes: PDF }),
        )
      ).code,
    ).toBe('REQUEST_INVALID')
    const small = { ...files, maxBytes: 4 }
    expect(
      (
        await failure(
          uploadFile(small, ctx, {
            tableId,
            field: pieces,
            name: 'a',
            type: undefined,
            bytes: PDF,
          }),
        )
      ).code,
    ).toBe('BODY_TOO_LARGE')
  })

  it('holds the column to a list of files in direct SQL', async () => {
    const relation = `"${schemaName}"."${tableName}"`
    for (const literal of [`'"texte"'`, `'[]'`, `'{"id": 1}'`]) {
      const error = await failure(
        direct(`INSERT INTO ${relation} ("nom", "${pieces}") VALUES ('x', $1::jsonb)`, [
          JSON.parse(literal.slice(1, -1)) === undefined ? null : literal.slice(1, -1),
        ]),
      )
      expect(error.code, literal).toMatch(/^VALUE_/)
    }
  })

  it('lists with a link on each file of the projected file columns', async () => {
    const page = await listRecords(pools, ctx, { tableId, filter: `not ${pieces} is_null` })
    expect(page.fileColumns).toEqual([pieces, photos])
    expect(page.rows.map((r) => r.nom)).toEqual(['F'])
  })
})
