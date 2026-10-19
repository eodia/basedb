import { crc32, inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  type Cell,
  columnLetters,
  numberOf,
  sheetNameOf,
  xlsxOf,
} from '../../src/records/export-xlsx.js'
import { type ExportColumn, cellOf, csvField, neutralize } from '../../src/records/export.js'

/**
 * What a file made of a table says: how a value reads as a cell, how a CSV is quoted and
 * kept from running as a formula, and the workbook written as a stream.
 */

const column = (over: Partial<ExportColumn>): ExportColumn => ({
  name: 'c',
  label: 'C',
  kind: 'short_text',
  elementKind: undefined,
  rich: false,
  numeric: false,
  choices: undefined,
  ...over,
})

const NO_ONE = new Map<string, string>()

describe('a value as a cell', () => {
  it('reads a choice by its label, and a list of them in order', () => {
    const choices = new Map([
      ['urgent', 'Très urgent'],
      ['client', 'Client'],
    ])
    expect(cellOf('urgent', column({ kind: 'select', choices }), NO_ONE)).toBe('Très urgent')
    expect(cellOf(['client', 'urgent'], column({ kind: 'multi_select', choices }), NO_ONE)).toBe(
      'Client, Très urgent',
    )
    // A value whose choice was removed from the list keeps its stored value.
    expect(cellOf('ancien', column({ kind: 'select', choices }), NO_ONE)).toBe('ancien')
  })

  it('reads a link by the label of its row, a masked one as nothing', () => {
    const link = column({ kind: 'link' })
    expect(cellOf({ id: 'a', display: 'ACME' }, link, NO_ONE)).toBe('ACME')
    expect(cellOf({ id: 'a', display: null }, link, NO_ONE)).toBe('a')
    expect(cellOf({ id: null, display: null, masked: true }, link, NO_ONE)).toBe('')
    const many = column({ kind: 'multi_link' })
    expect(
      cellOf(
        [
          { id: 'a', display: 'ACME' },
          { id: null, display: null, masked: true },
          { id: 'b', display: 'Dupont' },
        ],
        many,
        NO_ONE,
      ),
    ).toBe('ACME, Dupont')
  })

  it('reads a person by name, a file by its name, an instant and a day in ISO', () => {
    expect(cellOf('u1', column({ kind: 'user' }), new Map([['u1', 'Alice Martin']]))).toBe(
      'Alice Martin',
    )
    expect(cellOf('u2', column({ kind: 'user' }), NO_ONE)).toBe('u2')
    expect(
      cellOf(
        [
          { id: 'f', name: 'devis été.pdf', type: 'application/pdf', size: 3 },
          { id: 'g', name: 'b.png' },
        ],
        column({ kind: 'file' }),
        NO_ONE,
      ),
    ).toBe('devis été.pdf, b.png')
    expect(cellOf(new Date('2026-03-01T08:30:00Z'), column({ kind: 'datetime' }), NO_ONE)).toBe(
      '2026-03-01T08:30:00.000Z',
    )
    expect(cellOf('2026-03-01', column({ kind: 'date' }), NO_ONE)).toBe('2026-03-01')
  })

  it('writes a figure without the zeros that only fill its scale, and a yes/no as a boolean', () => {
    const figure = column({ kind: 'number', numeric: true })
    expect(cellOf('1500.5000000000', figure, NO_ONE)).toBe('1500.5')
    expect(cellOf('3200.0000000000', figure, NO_ONE)).toBe('3200')
    expect(cellOf('-0.50', figure, NO_ONE)).toBe('-0.5')
    expect(cellOf('100', figure, NO_ONE)).toBe('100')
    expect(cellOf(true, column({ kind: 'boolean' }), NO_ONE)).toBe(true)
    expect(cellOf(false, column({ kind: 'boolean' }), NO_ONE)).toBe(false)
    expect(cellOf(null, figure, NO_ONE)).toBeNull()
    expect(cellOf([], column({ kind: 'multi_select' }), NO_ONE)).toBeNull()
  })

  it('reads a rich text as the words it says, a computed value by what it is', () => {
    expect(
      cellOf(
        '<p>Bonjour <strong>toi</strong></p><p>Suite</p>',
        column({ kind: 'long_text', rich: true }),
        NO_ONE,
      ),
    ).toBe('Bonjour toi\nSuite')
    expect(cellOf(12, column({ kind: 'formula' }), NO_ONE)).toBe(12)
    expect(cellOf(['a', 'b'], column({ kind: 'lookup', elementKind: 'short_text' }), NO_ONE)).toBe(
      'a, b',
    )
  })
})

describe('a CSV field', () => {
  it('is quoted as soon as it holds a separator, a quote or a line break', () => {
    expect(csvField('simple')).toBe('simple')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('dit "oui"')).toBe('"dit ""oui"""')
    expect(csvField('une\nautre')).toBe('"une\nautre"')
    expect(csvField(null)).toBe('')
    expect(csvField(12.5)).toBe('12.5')
    expect(csvField(false)).toBe('false')
  })

  it('is kept from running as a formula, and leaves figures and dashes alone', () => {
    for (const dangerous of [
      '=1+1',
      '@SUM(A1)',
      '+cmd|x',
      '-cmd|x',
      '\tx',
      '=HYPERLINK("http://x")',
    ]) {
      expect(neutralize(dangerous), dangerous).toBe(`'${dangerous}`)
    }
    for (const harmless of ['-5', '+33 1 23 45', '- à faire', '-.5', 'Lyon', '', '1+1', 'a=b']) {
      expect(neutralize(harmless), harmless).toBe(harmless)
    }
  })
})

describe('the workbook', () => {
  it('names columns as a spreadsheet does', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702, 16383].map(columnLetters)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
      'XFD',
    ])
  })

  it('names its sheet within the rules of Excel', () => {
    expect(sheetNameOf('Visites')).toBe('Visites')
    expect(sheetNameOf('Chiffres: [2026] / bilan?')).toBe('Chiffres   2026    bilan')
    expect(sheetNameOf("'quoted'")).toBe('quoted')
    expect(sheetNameOf('')).toBe('Export')
    expect(sheetNameOf('x'.repeat(60))).toHaveLength(31)
  })

  it('writes a number only when a spreadsheet can hold it exactly', () => {
    expect(numberOf('12')).toBe(12)
    expect(numberOf('-0.5')).toBe(-0.5)
    expect(numberOf('123456789012345')).toBe(123456789012345)
    expect(numberOf('1234567890123456')).toBeNull()
    expect(numberOf('12abc')).toBeNull()
    expect(numberOf('')).toBeNull()
  })

  /** A zip, read from its central directory: the way Excel reads it. */
  function unzip(bytes: Buffer): Map<string, string> {
    const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    const count = bytes.readUInt16LE(end + 10)
    let at = bytes.readUInt32LE(end + 16)
    const parts = new Map<string, string>()
    for (let n = 0; n < count; n++) {
      const crc = bytes.readUInt32LE(at + 16)
      const compressed = bytes.readUInt32LE(at + 20)
      const size = bytes.readUInt32LE(at + 24)
      const nameLength = bytes.readUInt16LE(at + 28)
      const offset = bytes.readUInt32LE(at + 42)
      const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8')
      const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28)
      const inflated = inflateRawSync(bytes.subarray(start, start + compressed))
      expect(inflated.length, name).toBe(size)
      expect(crc32(inflated), name).toBe(crc)
      parts.set(name, inflated.toString('utf8'))
      at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32)
    }
    return parts
  }

  async function made(pages: Cell[][][], header = ['Nom', 'Montant']): Promise<Buffer> {
    async function* rows() {
      for (const page of pages) yield page
    }
    const chunks: Uint8Array[] = []
    for await (const chunk of xlsxOf({ name: 'Visites', header, pages: rows() }, new Date())) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  it('is a zip whose parts carry their checksum and size, in a central directory', async () => {
    const parts = unzip(await made([[['Lyon', 1.5]]]))
    expect([...parts.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ])
    expect(parts.get('xl/workbook.xml')).toContain(
      '<sheet name="Visites" sheetId="1" r:id="rId1"/>',
    )
  })

  it('writes the header in bold, then each cell by its type, empty ones not at all', async () => {
    const sheet = unzip(
      await made([
        [
          ['Lyon', 1.5],
          ['', null],
        ],
        [['=1+1', true]],
      ]),
    ).get('xl/worksheets/sheet1.xml') as string
    expect(sheet).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    )
    expect(sheet).toContain(
      '<row r="1"><c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Nom</t></is></c>',
    )
    expect(sheet).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">Lyon</t></is></c><c r="B2"><v>1.5</v></c>',
    )
    // Row 3 holds nothing.
    expect(sheet).toContain('<row r="3"></row>')
    // A text that starts with « = » is a string, and a yes/no is a boolean.
    expect(sheet).toContain(
      '<c r="A4" t="inlineStr"><is><t xml:space="preserve">=1+1</t></is></c><c r="B4" t="b"><v>1</v></c>',
    )
  })

  it('escapes markup, and drops what XML cannot carry', async () => {
    const sheet = unzip(await made([[['<b>&"x"</b>', 'a\u0000b\u001fc\ud800d😀']]])).get(
      'xl/worksheets/sheet1.xml',
    ) as string
    expect(sheet).toContain('&lt;b&gt;&amp;"x"&lt;/b&gt;')
    expect(sheet).toContain('<t xml:space="preserve">abcd😀</t>')
    // biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to find them
    expect(sheet).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/)
  })

  it('holds a long sheet without holding it whole: many pages, many chunks', async () => {
    const pages: Cell[][][] = Array.from({ length: 40 }, (_, p) =>
      Array.from({ length: 500 }, (_, i) => [`Mesure ${p * 500 + i}`, p * 500 + i] as Cell[]),
    )
    const bytes = await made(pages)
    const sheet = unzip(bytes).get('xl/worksheets/sheet1.xml') as string
    expect((sheet.match(/<row /g) ?? []).length).toBe(20_001)
    expect(sheet).toContain('<c r="B20001"><v>19999</v></c>')
    // Squeezed: well under what the sheet weighs.
    expect(bytes.length).toBeLessThan(sheet.length / 4)
  })

  it('fails the stream when its source fails, instead of ending a file that stops short', async () => {
    async function* broken(): AsyncGenerator<Cell[][]> {
      yield [['a', 1]]
      throw new Error('la lecture a échoué')
    }
    const read = async () => {
      for await (const _ of xlsxOf(
        { name: 'x', header: ['A', 'B'], pages: broken() },
        new Date(),
      )) {
        // drained
      }
    }
    await expect(read()).rejects.toThrow('la lecture a échoué')
  })
})
