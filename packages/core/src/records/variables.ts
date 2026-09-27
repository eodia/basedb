import type { Executor } from '../runtime/pool.js'
import { richTextToPlain } from './rich-text.js'

/**
 * Variables in a long text — chapter 04 §2.2, « Variables ».
 *
 * A long text, plain or rich, may cite a column of its own row: `{{nom_physique}}`. The
 * column keeps the citation as written, so direct SQL reads it as such; every surface of
 * the product — the API, MCP, a shared view, an automation's message — reads the text
 * with the row's value in its place, as THIS reader sees that value:
 *
 *   - a column the reader cannot see gives nothing — neither its value nor its name,
 *     which is exactly what a masked field is (chapter 08 I3);
 *   - a citation that names no column is left as it was written: it is just text;
 *   - a relation reads by its display value, a choice by its label, a person by their
 *     name, a date in the reader's own order and time zone;
 *   - one pass, no chaining: a long text cited inside another is inserted with its own
 *     citations removed, so no cycle can form;
 *   - in a rich text, what is inserted is escaped: a value is never markup.
 */

/** A citation: a physical name between double braces, spaces allowed inside. */
export const VARIABLE = /\{\{\s*([a-z0-9_]+)\s*\}\}/g
const HAS_VARIABLE = /\{\{\s*[a-z0-9_]+\s*\}\}/

export const hasVariables = (text: unknown): text is string =>
  typeof text === 'string' && HAS_VARIABLE.test(text)

/** A column as a citation reads it. */
export interface VariableColumn {
  readonly name: string
  readonly kind: string
  readonly rich?: boolean
}

/** Everything a citation needs to read, for one reader and one table. */
export interface VariableScope {
  /** The columns the reader reads, by physical name. */
  readonly readable: ReadonlyMap<string, VariableColumn>
  /** Every live column of the table: a name among them the reader cannot see gives nothing. */
  readonly known: ReadonlySet<string>
  /** The label of each choice, by field then value. */
  readonly labels: ReadonlyMap<string, ReadonlyMap<string, string>>
  /** The name of each person a row names. */
  readonly people: ReadonlyMap<string, string>
  readonly dateFormat: 'dmy' | 'iso'
  readonly timezone: string
}

/** A calendar day, `YYYY-MM-DD`, in the reader's order. */
function dayText(value: string, format: 'dmy' | 'iso'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match === null) return value
  return format === 'iso'
    ? `${match[1]}-${match[2]}-${match[3]}`
    : `${match[3]}/${match[2]}/${match[1]}`
}

/** An instant, in the reader's time zone and order. */
function instantText(value: unknown, format: 'dmy' | 'iso', timezone: string): string {
  const at = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(at.getTime())) return String(value)
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at)
  } catch {
    // An unknown zone reads as UTC rather than failing the whole page.
    return instantText(at, format, 'UTC')
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const day =
    format === 'iso'
      ? `${get('year')}-${get('month')}-${get('day')}`
      : `${get('day')}/${get('month')}/${get('year')}`
  return `${day} ${get('hour')}:${get('minute')}`
}

/** A value as a sentence reads it. Empty when the row holds nothing. */
export function textOfValue(value: unknown, column: VariableColumn, scope: VariableScope): string {
  if (value === null || value === undefined || value === '') return ''
  const label = (v: unknown) => scope.labels.get(column.name)?.get(String(v)) ?? String(v)
  const display = (v: unknown) =>
    typeof v === 'object' && v !== null
      ? String((v as { display?: unknown; id?: unknown }).display ?? '')
      : String(v)
  switch (column.kind) {
    case 'link':
      return display(value)
    case 'multi_link':
      return Array.isArray(value)
        ? value
            .map(display)
            .filter((t) => t !== '')
            .join(', ')
        : ''
    case 'select':
      return label(value)
    case 'multi_select':
      return Array.isArray(value) ? value.map(label).join(', ') : label(value)
    case 'user':
      return scope.people.get(String(value)) ?? ''
    case 'boolean':
      return value === true ? 'oui' : 'non'
    case 'date':
      return dayText(String(value), scope.dateFormat)
    case 'datetime':
      return instantText(value, scope.dateFormat, scope.timezone)
    case 'number':
      return String(value)
        .replace(/(\.\d*?)0+$/, '$1')
        .replace(/\.$/, '')
    case 'long_text': {
      const text = column.rich === true ? richTextToPlain(String(value)) : String(value)
      // No chaining: what the cited text cites is not followed.
      return text.replace(VARIABLE, '').trim()
    }
    case 'file':
    case 'image':
      return Array.isArray(value)
        ? value.map((f) => String((f as { name?: unknown }).name ?? '')).join(', ')
        : ''
    default:
      if (Array.isArray(value))
        return value.map((v) => textOfValue(v, { ...column, kind: '' }, scope)).join(', ')
      if (value instanceof Date) return instantText(value, scope.dateFormat, scope.timezone)
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A text with each citation replaced by what it reads in `row`. */
export function resolveText(
  text: string,
  row: Readonly<Record<string, unknown>>,
  scope: VariableScope,
  html: boolean,
): string {
  return text.replace(VARIABLE, (whole, name: string) => {
    const column = scope.readable.get(name)
    if (column === undefined) return scope.known.has(name) ? '' : whole
    const value = textOfValue(row[name], column, scope)
    return html ? escapeHtml(value) : value
  })
}

/** The names a set of texts cites. */
export function citedNames(texts: Iterable<string>): Set<string> {
  const names = new Set<string>()
  for (const text of texts)
    for (const match of text.matchAll(VARIABLE)) names.add(match[1] as string)
  return names
}

/**
 * What the scope needs beyond the columns, read from the catalog: the labels of the
 * choices cited, the names of the people cited, and the reader's own reading of dates.
 */
export async function loadScopeExtras(
  exec: Executor,
  request: {
    readonly tableId: string
    readonly actorId: string
    readonly choiceFields: readonly string[]
    readonly people: readonly string[]
  },
): Promise<Pick<VariableScope, 'labels' | 'people' | 'dateFormat' | 'timezone'>> {
  const labels = new Map<string, Map<string, string>>()
  if (request.choiceFields.length > 0) {
    const rows = await exec.query<{ field: string; value: string; label: string }>(
      `SELECT n.name AS field, o.value, o.label
         FROM _basedb.select_option o
         JOIN _basedb.field f ON f.id = o.field_id
         JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE f.table_id = $1 AND f.is_live AND o.deleted_at IS NULL AND n.name = ANY($2::text[])`,
      [request.tableId, request.choiceFields],
    )
    for (const r of rows) {
      const own = labels.get(r.field) ?? new Map<string, string>()
      own.set(r.value, r.label)
      labels.set(r.field, own)
    }
  }
  const people = new Map<string, string>()
  const ids = request.people.filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (ids.length > 0) {
    const rows = await exec.query<{ id: string; name: string }>(
      `SELECT id::text, coalesce(nullif(display_name, ''), email) AS name
         FROM _basedb.app_user WHERE id = ANY($1::uuid[])`,
      [ids],
    )
    for (const r of rows) people.set(r.id, r.name)
  }
  const [reader] = await exec.query<{ date_format: string; timezone: string }>(
    'SELECT date_format, timezone FROM _basedb.app_user WHERE id = $1',
    [request.actorId],
  )
  return {
    labels,
    people,
    dateFormat: reader?.date_format === 'iso' ? 'iso' : 'dmy',
    timezone: reader?.timezone ?? 'Europe/Paris',
  }
}
