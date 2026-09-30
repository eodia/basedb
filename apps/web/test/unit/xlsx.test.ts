import { crc32, deflateRawSync } from 'node:zlib'
import { readWorkbook, serialToIso } from '@/lib/xlsx'
import { describe, expect, it } from 'vitest'

/**
 * Reading an Excel workbook: a zip of XML parts, built here by hand — the texts in the
 * shared strings, a date told from an amount by its style, the sheets in the workbook's
 * order.
 */

/** A zip holding `parts`, deflated except those named in `stored`. */
function zip(parts: Record<string, string>, stored: readonly string[] = []): Uint8Array {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(parts)) {
    const raw = Buffer.from(text, 'utf8')
    const method = stored.includes(name) ? 0 : 8
    const data = method === 0 ? raw : deflateRawSync(raw)
    const nameBytes = Buffer.from(name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc32(raw), 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc32(raw), 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, data)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(parts).length, 8)
  end.writeUInt16LE(Object.keys(parts).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...locals, directory, end]))
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
const REL = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

function workbook(options: { date1904?: boolean; stored?: readonly string[] } = {}) {
  return zip(
    {
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?>
<workbook ${NS} ${REL}>${options.date1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>'}
<sheets><sheet name="Clients" sheetId="1" r:id="rId1"/><sheet name="Vide" sheetId="2" r:id="rId2"/><sheet name="Notes &amp; idées" sheetId="3" r:id="rId3"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet3.xml"/>
<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
      'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?>
<sst ${NS} count="6" uniqueCount="6">
<si><t>Nom</t></si><si><t>Créé le</t></si><si><t>Montant</t></si>
<si><r><rPr><b/></rPr><t>L'épicerie</t></r><r><t xml:space="preserve"> du coin</t></r></si>
<si><t>007</t></si>
<si><t>Ligne 1_x000D_
Ligne 2</t><rPh sb="0" eb="1"><t>ふりがな</t></rPh></si>
</sst>`,
      'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet ${NS}>
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy\\ hh:mm"/><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>
<cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="46"/></cellXfs>
</styleSheet>`,
      'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<worksheet ${NS}><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="inlineStr"><is><t>Actif</t></is></c><c r="E1" t="inlineStr"><is><t>Durée</t></is></c></row>
<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" s="1"><v>46086</v></c><c r="C2" s="3"><v>1234.5</v></c><c r="D2" t="b"><v>1</v></c><c r="E2" s="4"><v>0.0625</v></c></row>
<row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4" s="2"><v>46086.604166666664</v></c><c r="C4"><f>C2*2</f><v>0.30000000000000004</v></c><c r="D4" t="e"><v>#N/A</v></c></row>
<row r="5"><c r="A5" t="s"><v>5</v></c><c r="C5" t="str"><f>A1&amp;"!"</f><v>Nom!</v></c><c r="G5" s="0"/></row>
<row r="7"><c r="A7" t="inlineStr"><is><t>   </t></is></c></row>
</sheetData></worksheet>`,
      'xl/worksheets/sheet2.xml': `<?xml version="1.0" encoding="UTF-8"?>
<worksheet ${NS}><sheetData/></worksheet>`,
      'xl/worksheets/sheet3.xml': `<?xml version="1.0" encoding="UTF-8"?>
<worksheet ${NS}><sheetData><row><c t="inlineStr"><is><t>a</t></is></c><c><v>2</v></c></row></sheetData></worksheet>`,
    },
    options.stored,
  )
}

describe('reading a workbook', () => {
  it('lists the sheets that hold something, in order, by their names', async () => {
    const sheets = await readWorkbook(workbook())
    expect(sheets.map((s) => s.name)).toEqual(['Clients', 'Notes & idées'])
  })

  it('reads texts, numbers, booleans, dates and durations as a person sees them', async () => {
    const [clients] = await readWorkbook(workbook())
    expect(clients?.rows).toEqual([
      ['Nom', 'Créé le', 'Montant', 'Actif', 'Durée'],
      ["L'épicerie du coin", '2026-03-05', 1234.5, true, 5400],
      [null, null, null, null, null],
      ['007', '2026-03-05T14:30:00', 0.3, null, null],
      ['Ligne 1\r\nLigne 2', null, 'Nom!', null, null],
    ])
  })

  it('places a cell without a reference after the one before it', async () => {
    const sheets = await readWorkbook(workbook())
    expect(sheets[1]?.rows).toEqual([['a', 2]])
  })

  it('reads a part stored without compression', async () => {
    const sheets = await readWorkbook(workbook({ stored: ['xl/worksheets/sheet3.xml'] }))
    expect(sheets[1]?.rows).toEqual([['a', 2]])
  })

  it('counts from 1904 when the workbook says so', async () => {
    const [clients] = await readWorkbook(workbook({ date1904: true }))
    expect(clients?.rows[1]?.[1]).toBe('2030-03-06')
  })

  it('refuses what is not a workbook', async () => {
    await expect(readWorkbook(new TextEncoder().encode('Nom;Montant\nA;1'))).rejects.toThrow()
  })
})

describe('Excel serial dates', () => {
  it('turns a serial into a day, a moment, or a time alone', () => {
    expect(serialToIso(1)).toBe('1899-12-31')
    expect(serialToIso(61)).toBe('1900-03-01')
    expect(serialToIso(45658)).toBe('2025-01-01')
    expect(serialToIso(45658.5)).toBe('2025-01-01T12:00:00')
    expect(serialToIso(0.75)).toBe('18:00')
    expect(serialToIso(0.75 + 30 / 86_400)).toBe('18:00:30')
  })
})
