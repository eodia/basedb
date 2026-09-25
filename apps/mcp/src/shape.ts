import type { AgentColumn } from '@basedb/core'

/**
 * Transport adaptations of the agent surface — chapter 09 §11.2 and §12.1.
 *
 * Truncation and flattening are adaptations OF THIS SURFACE, signalled row by row. The
 * representation of values — ISO 8601 dates in UTC, decimals as strings — belongs to the
 * kernel and is the same on every surface; nothing here touches it.
 */

/** §11.2: beyond this, a text value is cut, and the row says which fields were. */
export const TEXT_PREVIEW_CHARS = 500
/** §11.2: the size of one tool response, in characters. */
export const RESPONSE_BUDGET_CHARS = 40_000

/**
 * Control characters, and the bidirectional overrides that make a text read differently
 * from what it contains — a classic way to hide an instruction in a cell (§12.1). Tab,
 * line feed and carriage return stay: they are part of ordinary text.
 */
const CONTROL =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

export function stripControls(text: string): string {
  return text.replace(CONTROL, '')
}

/** Every string of a result, controls removed — keys are ours and left alone. */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return stripControls(value) as T
  if (Array.isArray(value)) return value.map(sanitizeDeep) as T
  if (value instanceof Date) return value
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeDeep(v)]),
    ) as T
  }
  return value
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
}

/**
 * Rich text flattened to plain text: markup has no value for an agent, and it carries
 * vectors. Block ends become line breaks so paragraphs survive; the rest of the markup
 * goes; entities are decoded; nothing Markdown is produced.
 */
export function flattenHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name.startsWith('#x') || name.startsWith('#X')) {
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
      }
      if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
      return ENTITIES[name.toLowerCase()] ?? entity
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const TEXTUAL: ReadonlySet<string> = new Set(['short_text', 'long_text', 'formula'])

/**
 * One row for transport: rich text flattened, long text cut at 500 characters — except
 * the fields named in `full`, which `get_record` asks for whole. The row lists what was
 * touched under `_truncated_fields` and `_flattened_fields`: names starting with an
 * underscore, which no user field can take (chapter 01, alphabet B).
 */
export function shapeRow(
  row: Readonly<Record<string, unknown>>,
  columns: readonly AgentColumn[],
  full: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  const truncated: string[] = []
  const flattened: string[] = []

  for (const column of columns) {
    let value = out[column.name]
    if (typeof value !== 'string') continue
    if (column.rich) {
      value = flattenHtml(value)
      flattened.push(column.name)
    }
    if (TEXTUAL.has(column.kind) && !full.has(column.name)) {
      const chars = [...(value as string)]
      if (chars.length > TEXT_PREVIEW_CHARS) {
        value = chars.slice(0, TEXT_PREVIEW_CHARS).join('')
        truncated.push(column.name)
      }
    }
    out[column.name] = value
  }

  if (truncated.length > 0) out._truncated_fields = truncated
  if (flattened.length > 0) out._flattened_fields = flattened
  return out
}

/**
 * How many whole rows fit the response budget, once the envelope is counted.
 *
 * Truncation is by WHOLE ROWS, never in the middle of an object: a half row would read
 * as a complete one.
 */
export function rowsWithinBudget(
  envelope: Readonly<Record<string, unknown>>,
  rows: ReadonlyArray<Record<string, unknown>>,
  budget: number = RESPONSE_BUDGET_CHARS,
): number {
  let used = JSON.stringify({ ...envelope, records: [] }).length
  for (const [i, row] of rows.entries()) {
    used += JSON.stringify(row).length + 1
    if (used > budget) return i
  }
  return rows.length
}
