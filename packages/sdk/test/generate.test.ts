import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'
import { pascal } from '../src/generate.js'
import { type MetaBase, typesOf } from '../src/index.js'

/** A base of the test instance, as `/meta` described it: every kind of field. */
const VENTES = JSON.parse(
  readFileSync(new URL('./fixtures/ventes.json', import.meta.url), 'utf8'),
) as MetaBase

const HERE = fileURLToPath(new URL('.', import.meta.url))
const TMP = `${HERE}.tmp-types/`

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

/** The diagnostics of a program using the generated types — none expected. */
function compile(files: Record<string, string>): string[] {
  mkdirSync(TMP, { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(`${TMP}${name}`, text)
  const program = ts.createProgram(
    Object.keys(files).map((n) => `${TMP}${n}`),
    {
      strict: true,
      noEmit: true,
      noUnusedLocals: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
      skipLibCheck: true,
    },
  )
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('the generated types', () => {
  const source = typesOf([VENTES], { module: '../../src/index.js' })

  it('type each kind as basedb reads and takes it', () => {
    expect(source).toContain('export interface Opportunites extends SystemColumns {')
    expect(source).toContain('readonly titre: string\n')
    expect(source).toContain('readonly montant: Decimal | null')
    expect(source).toContain('readonly statut: "nouveau" | "gagne" | "perdu" | null')
    expect(source).toContain('readonly etiquettes: ReadonlyArray<"urgent" | "export"> | null')
    expect(source).toContain('readonly clients_id: LinkValue | null')
    expect(source).toContain('readonly piece: ReadonlyArray<FileValue> | null')
    expect(source).toContain('readonly double: Decimal | null')
    expect(source).toContain('montant?: number | Decimal | null')
    expect(source).toContain('rappel?: IsoDateTime | Date | null')
    expect(source).toContain('clients_ids?: ReadonlyArray<LinkWrite> | null')
  })

  it('create with every required field, and nothing basedb computes', () => {
    const create = source.slice(source.indexOf('export interface OpportunitesCreate'))
    const body = create.slice(0, create.indexOf('}'))
    expect(body).toContain('  titre: string\n')
    expect(body).not.toMatch(/numero|double/)
  })

  it('leave a required field with a default out of what a creation must give', () => {
    const withDefault: MetaBase = {
      ...VENTES,
      tables: VENTES.tables.map((t) => ({
        ...t,
        fields: t.fields.map((f) => (f.name === 'titre' ? { ...f, default: 'Sans titre' } : f)),
      })),
    }
    expect(typesOf([withDefault])).toContain('  titre?: string\n')
  })

  it('compile, and refuse a table, a field or a value that does not exist', () => {
    const errors = compile({
      'schema.ts': source,
      'use.ts': `import { Basedb, filter } from '../../src/index.js'
import type { Schema } from './schema.js'

const db = new Basedb<Schema>({ url: 'https://basedb.exemple.fr', token: 'bdb_x' })
const deals = db.base('b_t4z56fq_ventes_sdk').table('opportunites')

export async function use(): Promise<string[]> {
  const created = await deals.create({ titre: 'Audit', montant: 12500.5, statut: 'gagne', clients_id: 'id' })
  const linked: string | null = created.clients_id
  const row = await deals.get(created._id)
  const amount: string | null = row.montant
  const name: string | null | undefined = row.clients_id?.display
  const page = await deals.list({ filter: filter\`statut eq \${'gagne'}\`, links: 'id' })
  const ids: Array<string | null> = page.rows.map((r) => r.clients_id)
  await deals.update(row._id, { statut: null, rappel: new Date() })

  // @ts-expect-error — no such table
  db.base('b_t4z56fq_ventes_sdk').table('factures')
  // @ts-expect-error — no such base
  db.base('b_t4z56fq_autre')
  // @ts-expect-error — titre is required to create
  await deals.create({ statut: 'gagne' })
  // @ts-expect-error — not a choice of the list
  await deals.update(row._id, { statut: 'abandonne' })
  // @ts-expect-error — computed by basedb, never written
  await deals.update(row._id, { double: 3 })
  // @ts-expect-error — a number reads as decimal text
  const wrong: number = row.montant

  return [String(linked), String(amount), String(name), ...ids.map(String), String(wrong)]
}
`,
    })
    expect(errors).toEqual([])
  })

  it('name the types after the tables, and after their base when there are several', () => {
    expect(pascal('opportunites')).toBe('Opportunites')
    expect(pascal('b_t4z56fq_ventes_sdk')).toBe('VentesSdk')
    expect(pascal('2026_budget')).toBe('T2026Budget')
    const two = typesOf([VENTES, { ...VENTES, name: 'b_t4z56fq_achats', label: 'Achats' }])
    expect(two).toContain('export interface VentesSdkClients extends SystemColumns')
    expect(two).toContain('export interface AchatsClients extends SystemColumns')
  })
})
