import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * What the nodes decide without n8n: which fields a workflow may write and how their values
 * are sent, the filter that finds a row to update, what a polling trigger has not yet
 * emitted, and whether a webhook really comes from basedb. Kept apart from the nodes so that
 * it is tested without a running n8n.
 */

/** A field as `GET /meta/bases/<base>` publishes it (basedb chapter 08 §9). */
export interface MetaField {
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly kind: string
  readonly required: boolean
  readonly read_only: boolean
  readonly system: boolean
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly format?: { readonly display: string }
  readonly computed?: unknown
  readonly ai?: boolean
  readonly default?: unknown
  readonly link?: { readonly target?: string }
}

export interface MetaTable {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly actions: readonly string[]
  readonly synced?: boolean
  readonly fields: readonly MetaField[]
}

export interface MetaBase {
  readonly name: string
  readonly label: string
  readonly tables: readonly MetaTable[]
}

/** A person of the workspace, as `GET /meta/users` gives them — what a Person field holds. */
export interface Member {
  readonly id: string
  readonly display_name: string
  readonly email: string
  readonly disabled: boolean
}

/** The kinds a workflow writes. Files and images go through the interface; computed fields
 *  (formulas, lookups, rollups, counts), numbers given by basedb and buttons are read only. */
const WRITABLE: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'link',
  'multi_link',
  'email',
  'url',
  'user',
])

/** The kinds whose value can find a row: one value, compared as it is written. */
const MATCHABLE: ReadonlySet<string> = new Set([
  'short_text',
  'email',
  'url',
  'number',
  'date',
  'select',
  'link',
  'user',
])

export const isWritable = (f: MetaField): boolean =>
  !f.system && !f.read_only && f.ai !== true && f.computed === undefined && WRITABLE.has(f.kind)

/** A column of n8n's field mapper — `ResourceMapperField`, without depending on n8n here. */
export interface Column {
  readonly id: string
  readonly displayName: string
  readonly required: boolean
  readonly defaultMatch: boolean
  readonly canBeUsedToMatch: boolean
  readonly display: boolean
  readonly type: 'string' | 'number' | 'boolean' | 'dateTime' | 'options' | 'array'
  readonly options?: ReadonlyArray<{ readonly name: string; readonly value: string }>
}

function typeOf(f: MetaField): Column['type'] {
  switch (f.kind) {
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'date':
    case 'datetime':
      return 'dateTime'
    case 'select':
    case 'user':
      return 'options'
    case 'multi_select':
    case 'multi_link':
      return 'array'
    default:
      return 'string'
  }
}

/**
 * The columns a workflow fills, for one operation: what it may write — required when basedb
 * requires it and has no default to put in its place — and, to update, the row's `_id`,
 * the natural key, proposed first.
 */
export function columnsOf(
  table: MetaTable,
  operation: 'create' | 'update' | 'upsert',
  members: readonly Member[],
): Column[] {
  const people = members
    .filter((m) => !m.disabled)
    .map((m) => ({ name: m.display_name || m.email, value: m.id }))
  const fields = table.fields.filter(isWritable).map(
    (f): Column => ({
      id: f.name,
      displayName: f.label,
      required: operation === 'create' && f.required && f.default === undefined,
      defaultMatch: false,
      canBeUsedToMatch: operation !== 'create' && MATCHABLE.has(f.kind),
      display: true,
      type: typeOf(f),
      ...(f.kind === 'select'
        ? { options: (f.options ?? []).map((o) => ({ name: o.label, value: o.value })) }
        : f.kind === 'user'
          ? { options: people }
          : {}),
    }),
  )
  if (operation !== 'update') return fields
  return [
    {
      id: '_id',
      displayName: 'ID',
      required: false,
      defaultMatch: true,
      canBeUsedToMatch: true,
      display: true,
      type: 'string',
    },
    ...fields,
  ]
}

/** A date as n8n may hand it: a Luxon `DateTime`, a JavaScript `Date`, or a string. */
interface DateLike {
  toISO?: () => string | null
  toISODate?: () => string | null
  toISOString?: () => string
}

const isDateLike = (v: unknown): v is DateLike =>
  typeof v === 'object' &&
  v !== null &&
  (typeof (v as DateLike).toISO === 'function' || typeof (v as DateLike).toISOString === 'function')

function listOf(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    const text = v.trim()
    if (text === '') return []
    if (text.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(text)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // Not JSON: a list written with commas.
      }
    }
    return text.split(',').map((s) => s.trim())
  }
  return [v]
}

/** A linked row as a workflow may hand it: its `_id`, or the `{ id, display }` basedb reads. */
const idOf = (v: unknown): unknown =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: unknown }).id : v

/**
 * A value as basedb takes it for a field of `kind` — dates to their ISO form, a date without
 * its time, lists from a JSON or comma-separated text, links by their `_id`. What it cannot
 * read is sent as it is: basedb then refuses it by name, which says more than a guess.
 */
export function toWrite(kind: string, value: unknown): unknown {
  if (value === undefined || value === null) return null
  switch (kind) {
    case 'number': {
      if (value === '') return null
      const n = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(n) ? n : value
    }
    case 'boolean':
      if (value === 'true') return true
      if (value === 'false') return false
      return value
    case 'date': {
      if (value === '') return null
      if (isDateLike(value)) {
        return value.toISODate?.() ?? value.toISOString?.().slice(0, 10) ?? value
      }
      const text = String(value)
      return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text
    }
    case 'datetime':
      if (value === '') return null
      return isDateLike(value) ? (value.toISO?.() ?? value.toISOString?.() ?? value) : value
    case 'multi_select':
      return listOf(value).map(String)
    case 'multi_link':
      return listOf(value).map(idOf)
    case 'link':
      return value === '' ? null : idOf(value)
    case 'select':
    case 'user':
      return value === '' ? null : value
    default:
      return typeof value === 'string' ? value : String(value)
  }
}

/** The values of a row to send: each mapped field converted, what is not a field left out. */
export function valuesOf(
  table: MetaTable,
  mapped: Readonly<Record<string, unknown>>,
  leaveOut: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of table.fields) {
    if (!isWritable(f) || leaveOut.includes(f.name) || !(f.name in mapped)) continue
    out[f.name] = toWrite(f.kind, mapped[f.name])
  }
  return out
}

/** A value in basedb's filter grammar: a number or a boolean as written, a text quoted. */
export function literal(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(String(value))
}

/** The filter that finds the rows whose matching columns hold these values. */
export function matchFilter(
  table: MetaTable,
  columns: readonly string[],
  mapped: Readonly<Record<string, unknown>>,
): string {
  return columns
    .map((name) => {
      const field = table.fields.find((f) => f.name === name)
      const value = field === undefined ? mapped[name] : toWrite(field.kind, mapped[name])
      return value === null || value === undefined || value === ''
        ? `${name} is_null`
        : `${name} eq ${literal(value)}`
    })
    .join(' and ')
}

// ── The polling trigger ──────────────────────────────────────────────────────────────

/** What a polling trigger remembers between two polls. */
export interface PollState {
  /** The instant of the last row emitted — basedb's own clock, never n8n's. */
  since?: string
  /** The rows emitted at exactly that instant: basedb's timestamps are read to the
   *  millisecond, so the next poll asks from it again, and leaves these out. */
  seen?: string[]
}

type Row = Readonly<Record<string, unknown>>

const keyOf = (row: Row, column: string) => `${String(row._id)}@${String(row[column])}`

/**
 * The rows of a poll not yet emitted — `rows` asked from `state.since` included, in the
 * order of `column` —, and the state that the next poll starts from.
 */
export function freshRows(
  rows: readonly Row[],
  column: '_created_at' | '_updated_at',
  state: PollState,
): { fresh: Row[]; next: PollState } {
  const seen = new Set(state.seen ?? [])
  const fresh = rows.filter((r) => !seen.has(keyOf(r, column)))
  const last = rows.at(-1)
  if (last === undefined) return { fresh, next: state }
  const since = String(last[column])
  const atLast = rows.filter((r) => String(r[column]) === since).map((r) => keyOf(r, column))
  return {
    fresh,
    next: {
      since,
      seen: since === state.since ? [...new Set([...(state.seen ?? []), ...atLast])] : atLast,
    },
  }
}

/** The filter of a poll: from `since`, the reader's own filter kept. */
export function pollFilter(column: string, since: string, extra: string): string {
  const from = `${column} gte ${literal(since)}`
  return extra.trim() === '' ? from : `${from} and (${extra})`
}

// ── The webhook trigger ──────────────────────────────────────────────────────────────

/**
 * Whether a delivery comes from basedb: `X-Basedb-Signature: t=<unix>,v1=<hex>` with
 * `v1 = HMAC-SHA256(secret, "<t>." + raw body)`, and `t` within five minutes of now
 * (basedb chapter 08 §10.5) — an old delivery replayed by someone else is refused.
 */
export function verifySignature(
  secret: string,
  header: string | undefined,
  raw: Buffer | string,
  now: number = Date.now(),
): 'valid' | 'missing' | 'stale' | 'invalid' {
  if (header === undefined || header === '') return 'missing'
  const parts = new Map(
    header.split(',').map((p) => {
      const at = p.indexOf('=')
      return [p.slice(0, at).trim(), p.slice(at + 1).trim()] as const
    }),
  )
  const t = parts.get('t')
  const v1 = parts.get('v1')
  if (t === undefined || v1 === undefined || !/^\d+$/.test(t)) return 'missing'
  if (Math.abs(now / 1000 - Number(t)) > 300) return 'stale'
  const expected = createHmac('sha256', secret)
    .update(`${t}.`)
    .update(typeof raw === 'string' ? Buffer.from(raw) : raw)
    .digest()
  const given = Buffer.from(v1, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected) ? 'valid' : 'invalid'
}

/** An event of a delivery, as basedb sends it. */
export interface WebhookEvent {
  readonly id: string
  readonly type: string
  readonly base: string
  readonly table: string
  readonly record_id: string
  readonly [key: string]: unknown
}

/** The events a trigger keeps: of the types it listens to, and of its tables if it names some. */
export function eventsFor(
  body: unknown,
  types: readonly string[],
  tables: readonly string[],
): WebhookEvent[] {
  const events = (body as { events?: unknown } | null)?.events
  if (!Array.isArray(events)) return []
  return (events as WebhookEvent[]).filter(
    (e) =>
      (types.length === 0 || types.includes(e.type)) &&
      (tables.length === 0 || tables.includes(e.table)),
  )
}
