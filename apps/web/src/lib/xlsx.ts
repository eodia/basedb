import type { Cell } from '@/lib/import'

/**
 * Reading an Excel workbook — `.xlsx`, ECMA-376 — in the browser, without a library.
 *
 * A workbook is a zip of XML parts: `xl/workbook.xml` lists the sheets, a relation file
 * says which part holds each one, `xl/sharedStrings.xml` holds the texts cells point to,
 * and `xl/styles.xml` says which number formats are dates — Excel stores a date as a
 * number of days, and only its format tells it from an amount. Three formats, a few
 * regular expressions: a spreadsheet library would weigh a hundred times this module, and
 * import reads values, never formulas or formatting.
 *
 * The zip is inflated by the browser itself (`DecompressionStream`). The old binary `.xls`
 * is not read: saved again as `.xlsx`, it is.
 */

/** One sheet, as a grid of cells: row after row, empty cells `null`. */
export interface Sheet {
  readonly name: string
  readonly rows: readonly (readonly Cell[])[]
}

export class WorkbookError extends Error {}

// ── The zip ──────────────────────────────────────────────────────────────────────────

interface Entry {
  readonly method: number
  readonly compressedSize: number
  readonly offset: number
}

/** The entries of a zip, by name, from its central directory. */
function entriesOf(bytes: Uint8Array): Map<string, Entry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end record is at the end, after a comment of at most 65 535 bytes.
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end === -1) throw new WorkbookError('not a zip')
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const entries = new Map<string, Entry>()
  const decoder = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new WorkbookError('broken zip')
    const method = view.getUint16(at + 10, true)
    const compressedSize = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const offset = view.getUint32(at + 42, true)
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    entries.set(name.replace(/^\//, ''), { method, compressedSize, offset })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.slice()])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The text of a part, or `null` when the workbook has none by that name. */
async function partOf(
  bytes: Uint8Array,
  entries: Map<string, Entry>,
  name: string,
): Promise<string | null> {
  const entry = entries.get(name)
  if (entry === undefined) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw new WorkbookError('broken zip')
  // The local header repeats the name and has its own extra field: its lengths are its own.
  const start =
    entry.offset +
    30 +
    view.getUint16(entry.offset + 26, true) +
    view.getUint16(entry.offset + 28, true)
  const data = bytes.subarray(start, start + entry.compressedSize)
  const raw =
    entry.method === 0
      ? data
      : entry.method === 8
        ? await inflate(data)
        : (() => {
            throw new WorkbookError('compression')
          })()
  return new TextDecoder().decode(raw)
}

// ── The XML ──────────────────────────────────────────────────────────────────────────

/** `&amp;`, `&#233;`, and Excel's own `_x000D_` for a character XML cannot hold. */
function decodeXml(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
      const e = entity.toLowerCase()
      if (e.startsWith('#x')) return String.fromCodePoint(Number.parseInt(e.slice(2), 16))
      if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)))
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] ?? ''
    })
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
}

function attributes(tag: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out.set(m[1], decodeXml(m[2]))
  return out
}

/** Every element `name`, with its attributes and what it holds (`''` when self-closed). */
function* elements(xml: string, name: string): Generator<[Map<string, string>, string]> {
  const pattern = new RegExp(`<${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${name}>)`, 'g')
  for (const m of xml.matchAll(pattern)) yield [attributes(m[1] ?? ''), m[2] ?? '']
}

/** The text of a string item: its runs joined, its phonetic guides left out. */
function textOf(xml: string): string {
  const plain = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  let out = ''
  for (const [, inner] of elements(plain, 't')) out += decodeXml(inner)
  return out
}

// ── Dates ────────────────────────────────────────────────────────────────────────────

/** The built-in formats that are dates or times (ECMA-376 §18.8.30, and the CJK ones). */
const DATE_FORMAT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58,
])

type Reading = 'number' | 'date' | 'duration'

/** How a custom format reads a number: `dd/mm/yyyy` a date, `[h]:mm` a duration. */
function readingOf(code: string): Reading {
  if (/\[(h+|m+|s+)\]/i.test(code)) return 'duration'
  // Quoted text, escaped characters and bracketed colours or locales say nothing.
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/general/gi, '')
  // No number format holds a d, an m, a y, an h or an s: `0.00`, `#,##0 €`, `0.0E+00`.
  return /[dmyhs]/i.test(bare) ? 'date' : 'number'
}

/** The reading of each cell style, by its index — what a cell's `s` names. */
function stylesOf(xml: string | null): Reading[] {
  if (xml === null) return []
  const custom = new Map<number, Reading>()
  for (const [attrs] of elements(xml, 'numFmt')) {
    custom.set(Number(attrs.get('numFmtId')), readingOf(attrs.get('formatCode') ?? ''))
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? ''
  return [...elements(cellXfs, 'xf')].map(([attrs]) => {
    const id = Number(attrs.get('numFmtId') ?? 0)
    if (custom.has(id)) return custom.get(id) as Reading
    if (id === 46) return 'duration'
    return DATE_FORMAT_IDS.has(id) ? 'date' : 'number'
  })
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/**
 * A serial date as ISO text: `2026-03-05`, `2026-03-05T14:30:00`, or `14:30` for a time
 * alone. Day 0 of the 1900 system is 30 December 1899 — Excel counts a 29 February 1900
 * that never was, which this origin absorbs for every date after it.
 */
export function serialToIso(serial: number, date1904 = false): string {
  const seconds = Math.round(serial * 86_400)
  const days = Math.floor(seconds / 86_400)
  const rest = seconds - days * 86_400
  const clock = `${pad(Math.floor(rest / 3600))}:${pad(Math.floor(rest / 60) % 60)}`
  const withSeconds = rest % 60 === 0 ? clock : `${clock}:${pad(rest % 60)}`
  if (days === 0 && !date1904 && serial < 1) return withSeconds
  const origin = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const day = new Date(origin + days * 86_400_000)
  const iso = `${pad(day.getUTCFullYear(), 4)}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`
  return rest === 0 ? iso : `${iso}T${clock}:${pad(rest % 60)}`
}

// ── The workbook ─────────────────────────────────────────────────────────────────────

/** `AB12` → column 27 (0-based) — the letters alone count. */
function columnOf(reference: string): number {
  let n = 0
  for (const ch of reference.replace(/\d+$/, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

/**
 * A number as a person typed it: binary floating point writes `0.1 + 0.2` as
 * `0.30000000000000004`, and Excel shows fifteen significant digits — so does this.
 */
const tidy = (n: number) => Number(n.toPrecision(15))

function cellValue(
  attrs: Map<string, string>,
  inner: string,
  shared: readonly string[],
  styles: readonly Reading[],
  date1904: boolean,
): Cell {
  const type = attrs.get('t') ?? 'n'
  if (type === 'inlineStr') return textOf(/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '')
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1]
  if (raw === undefined) return null
  const v = decodeXml(raw)
  switch (type) {
    case 's':
      return shared[Number(v)] ?? null
    case 'str':
      return v
    case 'b':
      return v === '1'
    case 'e':
      return null
    case 'd':
      return v
    default: {
      const n = Number(v)
      if (!Number.isFinite(n)) return null
      const reading = styles[Number(attrs.get('s') ?? 0)] ?? 'number'
      if (reading === 'date') return serialToIso(n, date1904)
      // A duration is a number of seconds, as a duration field holds it.
      if (reading === 'duration') return Math.round(n * 86_400)
      return tidy(n)
    }
  }
}

/** The grid of one sheet — empty rows at the end and empty columns on the right dropped. */
function gridOf(
  xml: string,
  shared: readonly string[],
  styles: readonly Reading[],
  date1904: boolean,
): Cell[][] {
  const data = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] ?? ''
  const grid: Cell[][] = []
  let rowIndex = -1
  for (const [rowAttrs, rowXml] of elements(data, 'row')) {
    const r = Number(rowAttrs.get('r'))
    rowIndex = Number.isInteger(r) && r > 0 ? r - 1 : rowIndex + 1
    const row: Cell[] = []
    let column = -1
    for (const [attrs, inner] of elements(rowXml, 'c')) {
      const reference = attrs.get('r')
      column = reference === undefined ? column + 1 : columnOf(reference)
      const value = cellValue(attrs, inner, shared, styles, date1904)
      row[column] = typeof value === 'string' && value.trim() === '' ? null : value
    }
    grid[rowIndex] = Array.from(row, (c) => c ?? null)
  }
  const rows = Array.from(grid, (r) => r ?? [])
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === null)) rows.pop()
  const width = Math.max(
    0,
    ...rows.map((r) => {
      let w = r.length
      while (w > 0 && r[w - 1] === null) w--
      return w
    }),
  )
  return rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null))
}

/** Every sheet of a workbook that holds something, in the workbook's order. */
export async function readWorkbook(bytes: Uint8Array): Promise<Sheet[]> {
  const entries = entriesOf(bytes)
  const workbook = await partOf(bytes, entries, 'xl/workbook.xml')
  if (workbook === null) throw new WorkbookError('no workbook')
  const rels = (await partOf(bytes, entries, 'xl/_rels/workbook.xml.rels')) ?? ''
  const targets = new Map<string, string>()
  for (const [attrs] of elements(rels, 'Relationship')) {
    const target = attrs.get('Target') ?? ''
    targets.set(
      attrs.get('Id') ?? '',
      target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`,
    )
  }
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(workbook)
  const sharedXml = (await partOf(bytes, entries, 'xl/sharedStrings.xml')) ?? ''
  const shared = [...elements(sharedXml, 'si')].map(([, inner]) => textOf(inner))
  const styles = stylesOf(await partOf(bytes, entries, 'xl/styles.xml'))

  const sheets: Sheet[] = []
  for (const [attrs] of elements(workbook, 'sheet')) {
    const path = targets.get(attrs.get('r:id') ?? '')
    if (path === undefined) continue
    const xml = await partOf(bytes, entries, path)
    if (xml === null) continue
    const rows = gridOf(xml, shared, styles, date1904)
    if (rows.length > 0) sheets.push({ name: attrs.get('name') ?? '', rows })
  }
  return sheets
}

/** An `.xlsx` by its name or its first bytes — a zip starts with `PK`. */
export const isWorkbookName = (name: string) => /\.(xlsx|xlsm)$/i.test(name)
