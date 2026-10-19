import { Readable, pipeline } from 'node:stream'
import { createDeflateRaw } from 'node:zlib'

/**
 * An Excel workbook — `.xlsx`, ECMA-376 — written as a STREAM, without a library.
 *
 * A workbook is a zip of XML parts. The one that grows with the data is the sheet: it is
 * produced page after page, deflated as it goes, and handed to the caller chunk by chunk —
 * a million rows never sit in memory at once. That is why the zip is written with DATA
 * DESCRIPTORS (bit 3 of the flags): the size and the checksum of a part are only known
 * once it has been written, so they follow it instead of preceding it, and the central
 * directory at the end — which Excel reads first — carries them.
 *
 * Texts are INLINE strings (`t="inlineStr"`) rather than shared ones: a shared table is
 * built by looking at every value before writing the first, which is the one thing a
 * stream cannot do. They are strings, never formulas — a cell starting with `=` is shown
 * as written, so none of the neutralising a CSV needs applies here.
 *
 * The importer reads this back (`apps/web/src/lib/xlsx.ts`): the two files are the same
 * format seen from either end.
 */

/** What a cell holds: text, a number, a yes/no, or nothing. */
export type Cell = string | number | boolean | null

// ── Checksums ────────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 of `bytes`, continuing from `crc` (0 to start). */
function crc32(crc: number, bytes: Uint8Array): number {
  let c = (crc ^ 0xffffffff) >>> 0
  for (let i = 0; i < bytes.length; i++)
    c = (CRC_TABLE[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ── The zip ──────────────────────────────────────────────────────────────────────────

/** A part of the archive: its path, and its bytes — all at once or as a stream. */
interface Part {
  readonly name: string
  readonly data: Uint8Array | AsyncIterable<Uint8Array>
}

/** The largest size a classic (non-zip64) archive can describe. */
const ZIP_LIMIT = 0xffffffff

const text = new TextEncoder()

/** The DOS time and date a zip entry carries. */
function dosStamp(at: Date): { time: number; date: number } {
  return {
    time: (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1),
    date:
      (Math.max(0, at.getUTCFullYear() - 1980) << 9) |
      ((at.getUTCMonth() + 1) << 5) |
      at.getUTCDate(),
  }
}

/** A part's bytes, as the chunks a deflater is fed. */
async function* chunksOf(data: Part['data']): AsyncGenerator<Uint8Array> {
  if (data instanceof Uint8Array) {
    yield data
    return
  }
  yield* data
}

/**
 * The deflated bytes of a source, with its checksum and size counted on the way in.
 *
 * `pipeline` carries a failure of the source to the deflater, so the loop below throws it
 * rather than waiting for an end that never comes; the `finally` lets go of both if the
 * reader stops early (a client that hung up).
 */
async function* deflated(
  source: AsyncIterable<Uint8Array>,
  seen: { crc: number; size: number },
): AsyncGenerator<Uint8Array> {
  async function* counted(): AsyncGenerator<Buffer> {
    for await (const chunk of source) {
      seen.crc = crc32(seen.crc, chunk)
      seen.size += chunk.length
      yield Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    }
  }
  // Level 3: the sheet is XML, which squeezes well at any level; the time is better spent
  // answering than compressing a little further.
  const deflate = createDeflateRaw({ level: 3 })
  const input = Readable.from(counted(), { objectMode: false })
  pipeline(input, deflate, () => undefined)
  try {
    for await (const chunk of deflate) yield chunk as Uint8Array
  } finally {
    input.destroy()
    deflate.destroy()
  }
}

function localHeader(name: Uint8Array, at: { time: number; date: number }): Uint8Array {
  const out = Buffer.alloc(30 + name.length)
  out.writeUInt32LE(0x04034b50, 0)
  out.writeUInt16LE(20, 4) // version needed
  // Bit 3: sizes and checksum follow the data. Bit 11: the name is UTF-8.
  out.writeUInt16LE(0x0808, 6)
  out.writeUInt16LE(8, 8) // deflate
  out.writeUInt16LE(at.time, 10)
  out.writeUInt16LE(at.date, 12)
  // crc32, compressed and uncompressed size: zero, they come in the descriptor.
  out.writeUInt16LE(name.length, 26)
  out.set(name, 30)
  return out
}

function dataDescriptor(crc: number, compressed: number, size: number): Uint8Array {
  const out = Buffer.alloc(16)
  out.writeUInt32LE(0x08074b50, 0)
  out.writeUInt32LE(crc, 4)
  out.writeUInt32LE(compressed, 8)
  out.writeUInt32LE(size, 12)
  return out
}

interface Entry {
  readonly name: Uint8Array
  readonly offset: number
  readonly crc: number
  readonly compressed: number
  readonly size: number
}

function centralEntry(entry: Entry, at: { time: number; date: number }): Uint8Array {
  const out = Buffer.alloc(46 + entry.name.length)
  out.writeUInt32LE(0x02014b50, 0)
  out.writeUInt16LE(20, 4) // made by
  out.writeUInt16LE(20, 6) // version needed
  out.writeUInt16LE(0x0808, 8)
  out.writeUInt16LE(8, 10)
  out.writeUInt16LE(at.time, 12)
  out.writeUInt16LE(at.date, 14)
  out.writeUInt32LE(entry.crc, 16)
  out.writeUInt32LE(entry.compressed, 20)
  out.writeUInt32LE(entry.size, 24)
  out.writeUInt16LE(entry.name.length, 28)
  out.writeUInt32LE(entry.offset, 42)
  out.set(entry.name, 46)
  return out
}

/** The parts as a zip archive, produced chunk by chunk. */
export async function* zipOf(
  parts: AsyncIterable<Part> | Iterable<Part>,
  at: Date,
): AsyncGenerator<Uint8Array> {
  const stamp = dosStamp(at)
  const entries: Entry[] = []
  let offset = 0

  for await (const part of parts) {
    const name = text.encode(part.name)
    const head = localHeader(name, stamp)
    const start = offset
    yield head
    offset += head.length

    const seen = { crc: 0, size: 0 }
    let compressed = 0
    for await (const chunk of deflated(chunksOf(part.data), seen)) {
      compressed += chunk.length
      offset += chunk.length
      yield chunk
    }
    // A classic archive cannot describe more: failing is better than a file Excel refuses.
    if (seen.size > ZIP_LIMIT || compressed > ZIP_LIMIT || offset > ZIP_LIMIT) {
      throw new Error('workbook larger than 4 GiB')
    }
    const descriptor = dataDescriptor(seen.crc, compressed, seen.size)
    yield descriptor
    offset += descriptor.length
    entries.push({ name, offset: start, crc: seen.crc, compressed, size: seen.size })
  }

  const directory = offset
  let length = 0
  for (const entry of entries) {
    const record = centralEntry(entry, stamp)
    yield record
    length += record.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(length, 12)
  end.writeUInt32LE(directory, 16)
  yield end
}

// ── The workbook ─────────────────────────────────────────────────────────────────────

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/**
 * What an XML 1.0 document may not contain: most control characters, and the two
 * non-characters. A lone surrogate is out too — it cannot be encoded as UTF-8.
 */
const FORBIDDEN =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to find them
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/** The longest text a cell holds in Excel. */
export const CELL_LIMIT = 32_767

/** Text fit for an XML text node. */
function escapeXml(value: string): string {
  const clean = (value.length > CELL_LIMIT ? value.slice(0, CELL_LIMIT) : value).replace(
    FORBIDDEN,
    '',
  )
  return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeXml(value).replace(/"/g, '&quot;')
}

/** `A`, `B`… `Z`, `AA`… — the letters of a column, from its zero-based position. */
export function columnLetters(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** The columns Excel can hold, and the rows of a sheet. */
export const MAX_COLUMNS = 16_384
export const MAX_ROWS = 1_048_576

/**
 * A sheet name Excel accepts: 31 characters at most, none of `\ / ? * [ ] :`, not empty,
 * not opened or closed by an apostrophe.
 */
export function sheetNameOf(label: string): string {
  const name = label
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(FORBIDDEN, '')
    .replace(/^'+|'+$/g, '')
    .trim()
  const cut = [...name].slice(0, 31).join('').trim()
  return cut === '' ? 'Export' : cut
}

/** A cell's XML, or nothing for an empty one. */
function cellXml(reference: string, value: Cell, style: number): string {
  if (value === null) return ''
  const s = style === 0 ? '' : ` s="${style}"`
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `<c r="${reference}"${s}><v>${value}</v></c>` : ''
  }
  if (typeof value === 'boolean') return `<c r="${reference}"${s} t="b"><v>${value ? 1 : 0}</v></c>`
  if (value === '') return ''
  return `<c r="${reference}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

/**
 * A figure written as a number if a spreadsheet can hold it exactly: Excel keeps fifteen
 * significant digits, so a longer one stays text rather than losing its end silently.
 */
export function numberOf(text: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null
  const digits = text
    .replace(/^-/, '')
    .replace('.', '')
    .replace(/^0+(?=\d)/, '')
  return digits.length <= 15 ? Number(text) : null
}

export interface Sheet {
  /** The name of the tab. */
  readonly name: string
  /** The header row, one text per column. */
  readonly header: readonly string[]
  /** The rows, page after page: a cell per column, in the header's order. */
  readonly pages: AsyncIterable<readonly (readonly Cell[])[]>
}

/** The sheet's XML, chunk by chunk. */
async function* sheetXml(sheet: Sheet): AsyncGenerator<Uint8Array> {
  const widths = sheet.header
    .map((title, i) => {
      // A guess from the header alone: the rows are not known yet. Wide enough to read
      // the title, never so wide that one column hides the others.
      const width = Math.min(40, Math.max(10, [...title].length + 3))
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`
    })
    .join('')
  yield text.encode(
    [
      `${DECLARATION}<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0">`,
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
      `</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths}</cols><sheetData>`,
    ].join(''),
  )

  const letters = sheet.header.map((_, i) => columnLetters(i))
  yield text.encode(
    `<row r="1">${sheet.header.map((title, i) => cellXml(`${letters[i]}1`, title, 1)).join('')}</row>`,
  )

  let row = 1
  for await (const page of sheet.pages) {
    let chunk = ''
    for (const cells of page) {
      row++
      let xml = ''
      for (let i = 0; i < cells.length; i++) {
        xml += cellXml(`${letters[i]}${row}`, cells[i] as Cell, 0)
      }
      chunk += `<row r="${row}">${xml}</row>`
    }
    yield text.encode(chunk)
  }
  yield text.encode('</sheetData></worksheet>')
}

const STYLES = [
  `${DECLARATION}<styleSheet xmlns="${MAIN}">`,
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>',
  '<fills count="2"><fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill></fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>',
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
].join('')

const OFFICE = 'application/vnd.openxmlformats-officedocument.spreadsheetml'

/** An XML part, from its pieces. */
const xml = (...pieces: string[]): Uint8Array => text.encode(pieces.join(''))

/** A workbook of one sheet, as the bytes of an `.xlsx` file. */
export function xlsxOf(sheet: Sheet, at: Date): AsyncGenerator<Uint8Array> {
  const parts: Part[] = [
    {
      name: '[Content_Types].xml',
      data: xml(
        `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`,
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        `<Override PartName="/xl/workbook.xml" ContentType="${OFFICE}.sheet.main+xml"/>`,
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${OFFICE}.worksheet+xml"/>`,
        `<Override PartName="/xl/styles.xml" ContentType="${OFFICE}.styles+xml"/>`,
        '</Types>',
      ),
    },
    {
      name: '_rels/.rels',
      data: xml(
        `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}">`,
        `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: xml(
        `${DECLARATION}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>`,
        `<sheet name="${escapeAttribute(sheetNameOf(sheet.name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: xml(
        `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}">`,
        `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>`,
        `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', data: text.encode(STYLES) },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml(sheet) },
  ]
  return zipOf(parts, at)
}
