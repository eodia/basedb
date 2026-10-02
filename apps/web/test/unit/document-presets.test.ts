import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countBlocks, sendable, sourcesOf } from '../../src/components/app/documents/model'
import { type PresetId, buildPreset } from '../../src/components/app/documents/presets'
import type { DocumentBlock, Field, Table } from '../../src/lib/api/client'

/**
 * The starting points of a document template — chapter 21: built from the table they are
 * for, its name, dates, amounts, picture and linked rows; what a table lacks is left out.
 */

const field = (name: string, kind: string, extra: Partial<Field> = {}): Field =>
  ({
    name,
    label: name[0]?.toUpperCase() + name.slice(1),
    kind,
    description: null,
    ...extra,
  }) as Field

const euro = { format: { display: 'currency', currency: 'EUR' } }

const table = (id: string, name: string, fields: Field[], display: string | null): Table =>
  ({
    id,
    name,
    base: 'b_t_ventes',
    label: name[0]?.toUpperCase() + name.slice(1),
    display_field: display,
    fields,
  }) as unknown as Table

const clients = table('t1', 'clients', [field('nom', 'short_text')], 'nom')
const invoices = table(
  't2',
  'factures',
  [
    field('numero', 'short_text'),
    field('date', 'date'),
    field('client', 'link', {
      link: { target: 'clients', expandable: true, masked: false, on_delete: 'restrict' },
    }),
    field('statut', 'select'),
    field('total_ht', 'number', euro),
    field('total_ttc', 'number', euro),
    field('notes', 'long_text'),
  ],
  'numero',
)
const lines = table(
  't3',
  'lignes',
  [
    field('designation', 'short_text'),
    field('quantite', 'number'),
    field('prix', 'number', euro),
    field('montant', 'number', euro),
    field('facture', 'link', {
      link: { target: 'factures', expandable: true, masked: false, on_delete: 'cascade' },
    }),
  ],
  'designation',
)
const products = table(
  't4',
  'produits',
  [
    field('nom', 'short_text'),
    field('categorie', 'select'),
    field('prix', 'number', euro),
    field('photo', 'image'),
    field('description', 'long_text'),
  ],
  'nom',
)
const bare = table('t5', 'notes', [field('texte', 'long_text')], null)
const all = [clients, invoices, lines, products, bare]

const build = (id: PresetId, t: Table) => buildPreset(id, t, sourcesOf(t, all))
const kinds = (blocks: readonly DocumentBlock[]): string[] =>
  blocks.flatMap((b) => [
    b.kind,
    ...(b.kind === 'columns' ? b.columns.flat().map((i) => i.kind) : []),
  ])

describe('a starting point', () => {
  it('builds an invoice from the table: its number, its client, its lines and their total', () => {
    const { label, spec } = build('invoice', invoices)
    expect(label).toBe('Facture')
    expect(spec.header).toMatchObject({ show: 'every', rule: true })
    expect(spec.header.right).toContain('{{numero}}')
    expect(spec.header.right).toContain('{{date}}')
    const rows = spec.blocks.find((b) => b.kind === 'rows')
    expect(rows).toMatchObject({
      source: { kind: 'incoming', table: 't3', field: 'facture' },
      columns: ['designation', 'quantite', 'prix', 'montant'],
      totals: ['montant'],
      style: 'accent',
    })
    const summary = spec.blocks
      .flatMap((b) => (b.kind === 'columns' ? b.columns.flat() : [b]))
      .find((b) => b.kind === 'fields' && b.labels === 'summary')
    expect(summary).toMatchObject({ fields: ['total_ht', 'total_ttc'] })
    expect(JSON.stringify(spec.blocks)).toContain('{{client}}')
  })

  it('leaves out what a table does not have, never an empty block', () => {
    const quote = build('quote', bare).spec
    expect(kinds(quote.blocks)).not.toContain('rows')
    const sheet = build('sheet', bare).spec
    expect(kinds(sheet.blocks)).not.toContain('image')
    expect(sheet.blocks[0]).toMatchObject({ kind: 'title', text: 'Notes' })
    const invoice = build('invoice', bare).spec
    expect(kinds(invoice.blocks)).not.toContain('rows')
    expect(JSON.stringify(invoice)).not.toContain('{{numero}}')
  })

  it('shows the picture of a record sheet from its image field', () => {
    const { spec } = build('sheet', products)
    const picture = spec.blocks
      .flatMap((b) => (b.kind === 'columns' ? b.columns.flat() : [b]))
      .find((b) => b.kind === 'image')
    expect(picture).toMatchObject({ source: { kind: 'field', field: 'photo' } })
    expect(JSON.stringify(spec.blocks)).toContain('{{description}}')
  })

  it('sets a certificate in landscape, centred, framed, in a serif', () => {
    const { spec } = build('certificate', clients)
    expect(spec.page).toEqual({ size: 'A4', orientation: 'landscape', valign: 'center' })
    expect(spec.theme).toMatchObject({ border: 'double', font: 'serif', title_font: 'serif' })
    expect(JSON.stringify(spec.blocks)).toContain('{{nom}}')
  })

  it('stays within the bounds the server sets, with nothing left to choose', () => {
    for (const id of ['blank', 'invoice', 'quote', 'sheet', 'certificate'] as const) {
      for (const t of all) {
        const { spec } = build(id, t)
        expect(countBlocks(spec.blocks)).toBeLessThanOrEqual(50)
        expect(sendable(spec)).toEqual(spec)
        if (process.env.BASEDB_PRESET_SAMPLES !== undefined && t.name !== 'clients')
          writeFileSync(
            join(process.env.BASEDB_PRESET_SAMPLES, `preset-${id}-${t.name}.json`),
            JSON.stringify(spec, null, 2),
          )
      }
    }
  })
})
