import { BasedbError } from '../errors/index.js'
import { parseIcs } from '../integrations/ical.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'

/**
 * The sources of a synced table — chapter 19 §3: a CSV file, an iCalendar feed, a view
 * shared by a basedb. Each is fetched within bounds — https, a public host, 10 seconds,
 * 5 MB, 10 000 rows — and read as columns and keyed rows.
 */

export type SourceKind = 'csv' | 'ics' | 'basedb'
export type ColumnKind = 'short_text' | 'long_text' | 'number' | 'date' | 'datetime'

export interface SourceColumn {
  readonly key: string
  readonly label: string
  readonly kind: ColumnKind
}

export interface SourceRow {
  readonly key: string
  readonly values: Readonly<Record<string, unknown>>
}

export interface SourceData {
  readonly columns: readonly SourceColumn[]
  readonly rows: readonly SourceRow[]
}

export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 10_000
const TIMEOUT_MS = 10_000

const failed = (reason: string) => new BasedbError('SYNC_SOURCE_FAILED', { details: { reason } })

/** The body of an address, within the bounds; a refusal says why. */
async function fetchText(url: string, targets: TargetPolicy, accept: string): Promise<string> {
  const checked = await checkTarget(url, targets).catch(() => {
    throw failed('adresse_refusee')
  })
  let response: Response
  try {
    response = await fetch(checked, {
      headers: { accept, 'user-agent': 'basedb-sync/1' },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw failed('injoignable')
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw failed(`http_${response.status}`)
  }
  const reader = response.body?.getReader()
  if (reader === undefined) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw failed('trop_volumineuse')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/^\uFEFF/, '')
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Rows of a CSV text, RFC 4180: quoted fields, doubled quotes, the separator guessed. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.search(/\r?\n/) === -1 ? text.length : text.search(/\r?\n/))
  const counts = [',', ';', '\t'].map((s) => [s, firstLine.split(s).length] as const)
  const separator = counts.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === separator) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((v) => v !== '')) rows.push(row)
  return rows
}

const NUMBER = /^-?\d+(?:[.,]\d+)?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/

function kindOf(values: readonly string[]): ColumnKind {
  const filled = values.map((v) => v.trim()).filter((v) => v !== '')
  if (filled.length === 0) return 'short_text'
  if (filled.every((v) => NUMBER.test(v))) return 'number'
  if (filled.every((v) => DATE.test(v))) return 'date'
  if (filled.every((v) => DATETIME.test(v))) return 'datetime'
  return filled.some((v) => v.length > 255 || v.includes('\n')) ? 'long_text' : 'short_text'
}

function cellOf(raw: string, kind: ColumnKind): unknown {
  const v = raw.trim()
  if (v === '') return null
  if (kind === 'number') return Number(v.replace(',', '.'))
  if (kind === 'datetime') return new Date(v.replace(' ', 'T')).toISOString()
  return kind === 'long_text' ? raw : v
}

/** Labels made unique and never empty: they become the table's fields. */
function uniqueLabels(labels: readonly string[]): string[] {
  const seen = new Map<string, number>()
  return labels.map((raw, index) => {
    const base = raw.trim().slice(0, 200) || `Colonne ${index + 1}`
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1
    seen.set(base.toLowerCase(), n)
    return n === 1 ? base : `${base} (${n})`
  })
}

/** Keys made unique: a key seen twice keeps its first row, the next one is set apart. */
function uniqueKeys(rows: SourceRow[]): SourceRow[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const n = (seen.get(row.key) ?? 0) + 1
    seen.set(row.key, n)
    return n === 1 ? row : { ...row, key: `${row.key}#${n}` }
  })
}

export function readCsv(text: string): SourceData {
  const [header, ...body] = parseCsv(text)
  if (header === undefined) throw failed('fichier_vide')
  if (body.length > MAX_ROWS) throw failed('trop_de_lignes')
  const labels = uniqueLabels(header)
  const columns: SourceColumn[] = labels.map((label, i) => ({
    key: `c${i}`,
    label,
    kind: kindOf(body.map((r) => r[i] ?? '')),
  }))
  const keyIndex = Math.max(
    0,
    header.findIndex((h) => ['id', 'uid', 'key', 'cle', 'clé'].includes(h.trim().toLowerCase())),
  )
  const rows = body.map((r, index) => ({
    key: (r[keyIndex] ?? '').trim() || `ligne-${index + 1}`,
    values: Object.fromEntries(columns.map((c, i) => [c.key, cellOf(r[i] ?? '', c.kind)])),
  }))
  return { columns, rows: uniqueKeys(rows) }
}

// ── iCalendar ────────────────────────────────────────────────────────────────

const ICS_COLUMNS: readonly SourceColumn[] = [
  { key: 'summary', label: 'Titre', kind: 'short_text' },
  { key: 'start', label: 'Début', kind: 'datetime' },
  { key: 'end', label: 'Fin', kind: 'datetime' },
  { key: 'location', label: 'Lieu', kind: 'short_text' },
  { key: 'description', label: 'Description', kind: 'long_text' },
]

export function readIcs(text: string): SourceData {
  if (!text.includes('BEGIN:VCALENDAR')) throw failed('agenda_illisible')
  const events = parseIcs(text)
  if (events.length > MAX_ROWS) throw failed('trop_de_lignes')
  const rows = events.map((e) => ({
    key: e.uid,
    values: {
      summary: e.summary.slice(0, 255) || null,
      start: e.start,
      end: e.end,
      location: e.location.slice(0, 255) || null,
      description: e.description || null,
    },
  }))
  return { columns: ICS_COLUMNS, rows: uniqueKeys(rows) }
}

// ── A view shared by a basedb ────────────────────────────────────────────────

interface SharedPage {
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly label: string
    readonly kind: string
    readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly computed?: { readonly result_kind: string; readonly multiple: boolean }
  }>
  readonly rows: ReadonlyArray<Record<string, unknown>>
  readonly next_cursor: string | null
}

function sharedKind(kind: string): ColumnKind {
  if (['number', 'rollup', 'count', 'autonumber'].includes(kind)) return 'number'
  if (kind === 'date') return 'date'
  if (kind === 'datetime') return 'datetime'
  if (kind === 'long_text') return 'long_text'
  return 'short_text'
}

function sharedText(
  value: unknown,
  options?: SharedPage['fields'][number]['options'],
): string | null {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) {
    const parts = value.map((v) => sharedText(v, options)).filter((v): v is string => v !== null)
    return parts.length === 0 ? null : parts.join(', ')
  }
  if (typeof value === 'object') {
    const named = value as { display?: unknown; name?: unknown }
    return named.display !== undefined ? String(named.display ?? '') : String(named.name ?? '')
  }
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  const option = options?.find((o) => o.value === value)
  return option?.label ?? String(value)
}

/** The API address of a shared view, from its page link or its API link. */
export function sharedViewApi(url: string): string {
  const parsed = new URL(url)
  const page = /^\/v\/([A-Za-z0-9_-]{16,})\/?$/.exec(parsed.pathname)
  if (page !== null) return `${parsed.origin}/api/v1/views/${page[1]}`
  if (/^\/api\/v1\/views\/[A-Za-z0-9_-]{16,}\/?$/.test(parsed.pathname)) {
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
  }
  throw failed('lien_de_vue_attendu')
}

export async function readSharedView(url: string, targets: TargetPolicy): Promise<SourceData> {
  const api = sharedViewApi(url)
  const pages: SharedPage[] = []
  let next: string | null = null
  do {
    const address: string = next === null ? api : `${api}/rows?after=${encodeURIComponent(next)}`
    const body = JSON.parse(await fetchText(address, targets, 'application/json')) as {
      data?: SharedPage
      meta?: { next_cursor?: string | null }
    }
    if (body.data === undefined) throw failed('vue_illisible')
    pages.push(body.data)
    // The next page's cursor travels in `meta`, as every page of the API.
    next = body.meta?.next_cursor ?? body.data.next_cursor ?? null
    if (pages.reduce((n, p) => n + p.rows.length, 0) > MAX_ROWS) throw failed('trop_de_lignes')
  } while (next !== null)
  const fields = pages[0]?.fields ?? []
  const labels = uniqueLabels(fields.map((f) => f.label))
  const columns: SourceColumn[] = fields.map((f, i) => ({
    key: f.name,
    label: labels[i] as string,
    kind:
      f.computed?.multiple === true ? 'short_text' : sharedKind(f.computed?.result_kind ?? f.kind),
  }))
  const rows = pages
    .flatMap((p) => p.rows)
    .map((row) => ({
      key: String(row._id ?? ''),
      values: Object.fromEntries(
        columns.map((c, i) => {
          const raw = row[c.key]
          const field = fields[i]
          if (c.kind === 'number')
            return [
              c.key,
              typeof raw === 'number'
                ? raw
                : raw === null || raw === undefined || raw === ''
                  ? null
                  : Number(raw),
            ]
          if (c.kind === 'date' || c.kind === 'datetime')
            return [c.key, typeof raw === 'string' ? raw : null]
          return [c.key, sharedText(raw, field?.options)]
        }),
      ),
    }))
  return { columns, rows: uniqueKeys(rows.filter((r) => r.key !== '')) }
}

/** A source, fetched and read. */
export async function readSource(
  kind: SourceKind,
  url: string,
  targets: TargetPolicy,
): Promise<SourceData> {
  switch (kind) {
    case 'csv':
      return readCsv(await fetchText(url, targets, 'text/csv, text/plain;q=0.8, */*;q=0.1'))
    case 'ics':
      return readIcs(await fetchText(url, targets, 'text/calendar, */*;q=0.1'))
    case 'basedb':
      return readSharedView(url, targets)
  }
}
