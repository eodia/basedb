import type { Field, FieldOption } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import type { Sheet } from '@/lib/xlsx'

/**
 * Reading a file into a table of cells, and turning cells into values a field accepts.
 *
 * Nothing here talks to the server. The browser reads the file and converts it, the API
 * receives rows already shaped like the columns they go into — which is where a mistake is
 * cheap to show (« ligne 41, colonne Montant : nombre invalide ») and not a rolled-back
 * batch of a thousand.
 *
 * Conversions are decided by the FIELD's type, never guessed from the text: a column that
 * holds `007` in a text field stays `007`, and in a number field becomes 7. What is guessed
 * — the type of a column of a NEW table — is guessed once, from the whole column, and shown
 * for the person to change.
 */

/**
 * A cell as read: text from a CSV, anything a JSON value can be, what an Excel cell holds —
 * a date there is already ISO text —, or nothing.
 */
export type Cell = string | number | boolean | null

export interface ParsedTable {
  readonly format: 'csv' | 'json' | 'xlsx'
  /** The separator that was used, for a delimited text. */
  readonly delimiter?: string
  readonly columns: readonly string[]
  readonly rows: readonly (readonly Cell[])[]
}

export class ImportError extends Error {}

// ── Delimited text ───────────────────────────────────────────────────────────────────

export const DELIMITERS: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: ',', label: $t('Virgule') },
  { value: ';', label: $t('Point-virgule') },
  { value: '\t', label: $t('Tabulation') },
  { value: '|', label: $t('Barre verticale') },
]

/**
 * Picks the separator a text uses: the candidate that splits the first lines into the same
 * number of cells, more than one, most often. A French export from a spreadsheet uses `;`
 * because `,` is its decimal mark — counting occurrences alone would pick `,` for
 * `"1,5";"2,5"`, so quotes are honoured and consistency is what decides.
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim() !== '')
  const sample = lines.slice(0, 10)
  let best = ','
  let bestScore = 0

  for (const { value } of DELIMITERS) {
    const counts = sample.map((line) => splitLine(line, value).length - 1)
    const first = counts[0] ?? 0
    if (first === 0) continue
    // Lines that agree with the first one, weighted by how many cells they make.
    const agreeing = counts.filter((c) => c === first).length
    const score = agreeing * first
    if (score > bestScore) {
      best = value
      bestScore = score
    }
  }
  return best
}

/** One line split on a separator, quotes honoured — enough to COUNT cells, not to parse. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i++
      } else quoted = !quoted
    } else if (ch === delimiter && !quoted) {
      cells.push(current)
      current = ''
    } else current += ch
  }
  cells.push(current)
  return cells
}

/**
 * RFC 4180: quoted cells may hold the separator, a line break, and `""` for a quote.
 * Line breaks are `\r\n`, `\n` or `\r`. A BOM is dropped and a wholly blank line skipped.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')

  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (row.some((c) => c.trim() !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"' && cell === '') {
      quoted = true
    } else if (ch === delimiter) {
      endCell()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      endRow()
    } else cell += ch
  }
  if (quoted)
    throw new ImportError($t('Un guillemet n’est jamais refermé : le fichier est tronqué.'))
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

// ── Building the table ───────────────────────────────────────────────────────────────

/** Unique, non-empty column names: `Colonne 3` for a blank one, `Nom (2)` for a repeat. */
function nameColumns(raw: readonly (string | null | undefined)[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((value, index) => {
    const base = (value ?? '').toString().trim() || $t('Colonne {value}', { value: index + 1 })
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1
    seen.set(base.toLowerCase(), n)
    return n === 1 ? base : `${base} (${n})`
  })
}

const blankToNull = (cell: string): Cell => (cell.trim() === '' ? null : cell)

function fromRows(
  format: ParsedTable['format'],
  raw: readonly (readonly Cell[])[],
  hasHeader: boolean,
  delimiter?: string,
): ParsedTable {
  if (raw.length === 0) throw new ImportError($t('Le fichier est vide.'))
  const width = Math.max(...raw.map((r) => r.length))
  const columns = hasHeader
    ? nameColumns(Array.from({ length: width }, (_, i) => raw[0][i] as string | null))
    : nameColumns(Array.from({ length: width }, () => null))
  const body = hasHeader ? raw.slice(1) : raw
  // Ragged rows are padded: a file whose last cells were left off is still a file.
  const rows = body.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null))
  if (rows.length === 0)
    throw new ImportError($t('Le fichier n’a qu’une ligne d’en-tête, aucune donnée.'))
  return { format, delimiter, columns, rows }
}

/** One sheet of a workbook, its first row the header or not (`xlsx.ts` reads the file). */
export function parseSheet(sheet: Sheet, options: { hasHeader: boolean }): ParsedTable {
  return fromRows('xlsx', sheet.rows, options.hasHeader)
}

export function parseCsvText(
  text: string,
  options: { delimiter?: string; hasHeader: boolean },
): ParsedTable {
  const delimiter = options.delimiter ?? detectDelimiter(text)
  const rows = parseDelimited(text, delimiter).map((r) => r.map(blankToNull))
  return fromRows('csv', rows, options.hasHeader, delimiter)
}

/** A JSON value as a cell: scalars as themselves, structures as text a person can read. */
function cellOfJson(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() === '' ? null : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

/** Where a JSON document keeps its rows: the array itself, or the array under a usual key. */
function arrayOf(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (value === null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['data', 'rows', 'records', 'items', 'results']) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  const arrays = Object.values(record).filter(Array.isArray)
  return arrays.length === 1 ? (arrays[0] as unknown[]) : null
}

/**
 * Objects (the usual case: one per row, the keys are the columns), or arrays of arrays
 * (a table, first row the header when `hasHeader`), in a document or one per line.
 */
export function parseJsonText(text: string, options: { hasHeader: boolean }): ParsedTable {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    // One JSON value per line — what a log or a database export produces.
    try {
      value = text
        .split(/\r\n|\n|\r/)
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l))
    } catch {
      throw new ImportError($t('Ce fichier n’est pas du JSON valide.'))
    }
  }

  const list = arrayOf(value)
  if (list === null || list.length === 0) {
    throw new ImportError($t('Attendu : une liste de lignes, en objets ou en listes.'))
  }

  if (list.every((item) => Array.isArray(item))) {
    return fromRows(
      'json',
      (list as unknown[][]).map((r) => r.map(cellOfJson)),
      options.hasHeader,
    )
  }
  if (!list.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) {
    throw new ImportError($t('Les lignes doivent toutes être des objets, ou toutes des listes.'))
  }

  const keys: string[] = []
  for (const item of list as Record<string, unknown>[]) {
    for (const key of Object.keys(item)) if (!keys.includes(key)) keys.push(key)
  }
  const rows = (list as Record<string, unknown>[]).map((item) =>
    keys.map((k) => cellOfJson(item[k])),
  )
  return { format: 'json', columns: nameColumns(keys), rows }
}

/** Reads a file's text by what it is: `.json` and anything opening on `[` or `{` are JSON. */
export function parseText(
  name: string,
  text: string,
  options: { delimiter?: string; hasHeader: boolean },
): ParsedTable {
  const looksJson = /\.(json|ndjson|jsonl)$/i.test(name) || /^\s*[[{]/.test(text)
  return looksJson && !/\.(csv|tsv|txt)$/i.test(name)
    ? parseJsonText(text, options)
    : parseCsvText(text, options)
}

// ── Types ────────────────────────────────────────────────────────────────────────────

const TRUE_WORDS = ['true', 'vrai', 'oui', 'yes', 'y', 'o', 'x']
const FALSE_WORDS = ['false', 'faux', 'non', 'no', 'n']

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** `1 234,56`, `1.234,56`, `1,234.56` and `-3` all read as numbers; `12abc` does not. */
export function parseNumber(raw: Cell): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  let text = raw.replace(/[\s  ]/g, '')
  if (text === '') return null
  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  if (comma !== -1 && dot !== -1) {
    // Both present: the LAST one is the decimal mark, the other groups thousands.
    text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (comma !== -1) {
    // A lone comma is a decimal comma: this is a French product, and `12,5` is twelve and a half.
    if ((text.match(/,/g) ?? []).length > 1) return null
    text = text.replace(',', '.')
  }
  return /^[+-]?\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

export function parseBoolean(raw: Cell): boolean | null {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw === 1 ? true : raw === 0 ? false : null
  if (typeof raw !== 'string') return null
  const word = fold(raw)
  if (TRUE_WORDS.includes(word) || word === '1') return true
  if (FALSE_WORDS.includes(word) || word === '0') return false
  return null
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** A real calendar day: `2026-02-30` is refused, not rolled into March. */
function isoDate(year: number, month: number, day: number): string | null {
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

interface DateParts {
  readonly date: string
  /** `HH:mm:ss[.fff]` with the zone, when the text carried a time. */
  readonly time: string | null
}

/**
 * `2026-03-05`, `2026-03-05T14:30`, `05/03/2026`, `05-03-2026 14:30:15` and `5.3.2026`.
 * A slashed date is DAY first — the reading of the people this product is written for —
 * and a year of two digits is refused rather than guessed into a century.
 */
export function parseDateParts(raw: Cell): DateParts | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()

  let match =
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(
      text,
    )
  let date: string | null = null
  if (match !== null) {
    date = isoDate(Number(match[1]), Number(match[2]), Number(match[3]))
  } else {
    match =
      /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(
        text,
      )
    if (match === null) return null
    date = isoDate(Number(match[3]), Number(match[2]), Number(match[1]))
  }
  if (date === null) return null

  if (match[4] === undefined) return { date, time: null }
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] ?? 0)
  if (hour > 23 || minute > 59 || second > 59) return null
  const zone = match[8] === undefined ? '' : match[8].toUpperCase()
  return { date, time: `${pad(hour)}:${pad(minute)}:${pad(second)}${match[7] ?? ''}${zone}` }
}

export type Kind = 'short_text' | 'long_text' | 'url' | 'number' | 'boolean' | 'date' | 'datetime'

/** A web address as a cell holds it: with its scheme, or starting with `www.`. */
const ADDRESS = /^(https?:\/\/|www\.)[^\s]+$/i

/** The longest text a `short_text` is offered for: beyond it a person means a paragraph. */
export const SHORT_TEXT_MAX = 255

/**
 * The type a column most plausibly is, read from ALL its values — one stray word among a
 * thousand numbers makes it text, which is the honest answer. An empty column is text.
 *
 * `0` and `1` alone are numbers, not booleans: a column of counts that happens to hold
 * only zeros and ones must not silently become a checkbox.
 */
export function inferKind(values: readonly Cell[]): Kind {
  const present = values.filter((v) => v !== null && !(typeof v === 'string' && v.trim() === ''))
  if (present.length === 0) return 'short_text'

  if (
    present.every(
      (v) =>
        typeof v === 'boolean' ||
        (typeof v === 'string' && /^(true|false|vrai|faux|oui|non|yes|no)$/i.test(fold(v))),
    )
  ) {
    return 'boolean'
  }
  if (present.every((v) => parseNumber(v) !== null)) {
    // A number with a leading zero — `007`, `04 78 12` — is an identifier.
    const identifier = present.some(
      (v) => typeof v === 'string' && /^0\d/.test(v.trim()) && !/[.,]/.test(v),
    )
    if (!identifier) return 'number'
  }
  const parts = present.map(parseDateParts)
  if (parts.every((p) => p !== null)) {
    return parts.some((p) => p?.time !== null) ? 'datetime' : 'date'
  }
  // Every value an address: a column of links, drawn as links.
  if (present.every((v) => typeof v === 'string' && ADDRESS.test(v.trim()))) return 'url'
  const longest = Math.max(...present.map((v) => String(v).length))
  return longest > SHORT_TEXT_MAX ? 'long_text' : 'short_text'
}

/** The kinds a column can be imported INTO: the ones a cell of text can honestly become. */
export const IMPORTABLE_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'url',
  'email',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
])

export const isImportable = (field: Field) =>
  field.system !== true && field.read_only !== true && IMPORTABLE_KINDS.has(field.kind)

export type Converted =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: string }

const fail = (reason: string): Converted => ({ ok: false, reason })

/**
 * A cell as the value its field takes. An empty cell is `null` — "nothing" — whatever the
 * type; a cell that cannot be read comes back with WHY, for the screen to show.
 */
export function convert(
  cell: Cell,
  kind: string,
  options: readonly FieldOption[] | undefined,
): Converted {
  if (cell === null || (typeof cell === 'string' && cell.trim() === '')) {
    return { ok: true, value: null }
  }

  switch (kind) {
    case 'short_text':
    case 'long_text':
      return { ok: true, value: String(cell).trim() }

    case 'url': {
      // The server gives a bare domain its `https://`, and refuses what is no address.
      const text = String(cell).trim()
      return /\s/.test(text) ? fail($t('adresse web invalide')) : { ok: true, value: text }
    }

    case 'email': {
      // The server checks the address; a `mailto:` copied from a page is taken off here too.
      const text = String(cell)
        .trim()
        .replace(/^mailto:/i, '')
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
        ? { ok: true, value: text }
        : fail($t('adresse e-mail invalide'))
    }

    case 'number': {
      const n = parseNumber(cell)
      return n === null ? fail($t('nombre invalide')) : { ok: true, value: n }
    }

    case 'boolean': {
      const b = parseBoolean(cell)
      return b === null ? fail($t('attendu oui/non, vrai/faux ou 1/0')) : { ok: true, value: b }
    }

    case 'date': {
      const parts = parseDateParts(cell)
      return parts === null
        ? fail($t('date invalide (jj/mm/aaaa ou aaaa-mm-jj)'))
        : { ok: true, value: parts.date }
    }

    case 'datetime': {
      const parts = parseDateParts(cell)
      if (parts === null) return fail($t('date et heure invalides'))
      // No zone is read as UTC, which is what the database's connection contract says the
      // instant is stored in; a date alone is midnight.
      return { ok: true, value: `${parts.date}T${parts.time ?? '00:00:00'}` }
    }

    case 'select': {
      const wanted = fold(String(cell))
      const found = (options ?? []).find(
        (o) => fold(o.value) === wanted || fold(o.label) === wanted,
      )
      return found === undefined
        ? fail($t('valeur absente de la liste'))
        : { ok: true, value: found.value }
    }

    // Several choices in one cell, as a spreadsheet writes them: `urgent, client` or
    // `urgent; client`. Each is found as a single choice is — by value or by label.
    case 'multi_select': {
      const values: string[] = []
      for (const part of String(cell).split(/[;,\n]/)) {
        const wanted = fold(part)
        if (wanted === '') continue
        const found = (options ?? []).find(
          (o) => fold(o.value) === wanted || fold(o.label) === wanted,
        )
        if (found === undefined)
          return fail($t('« {part} » absent de la liste', { part: part.trim() }))
        if (!values.includes(found.value)) values.push(found.value)
      }
      return { ok: true, value: values.length === 0 ? null : values }
    }

    default:
      return fail($t('ce type ne s’importe pas'))
  }
}

// ── Matching columns to fields ───────────────────────────────────────────────────────

/**
 * For each column of the file, the field it most plausibly feeds — by label, then by name,
 * folded so case and accents do not matter — or `null`. A field takes at most one column:
 * two columns both called `Nom` do not both write to it.
 */
export function matchColumns(
  columns: readonly string[],
  fields: readonly Field[],
): (string | null)[] {
  const taken = new Set<string>()
  return columns.map((column) => {
    const key = fold(column)
    const found = fields.find(
      (f) => !taken.has(f.name) && (fold(f.label) === key || fold(f.name) === key),
    )
    if (found === undefined) return null
    taken.add(found.name)
    return found.name
  })
}

/** `clients_2026.csv` becomes `Clients 2026`: a label to start from, not a name to keep. */
export function labelFromFileName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return base === '' ? $t('Import') : base.charAt(0).toUpperCase() + base.slice(1)
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size))
  return chunks
}
