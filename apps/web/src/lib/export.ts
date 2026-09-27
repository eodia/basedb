import type { Field } from '@/lib/api/client'
import { $t } from '@/lib/i18n'

/**
 * Exporting what is ON SCREEN — and only that.
 *
 * Decision A21 of chapter 00 refuses an export ENTRY POINT: "un flux illimité percerait
 * le plafond que toutes les autres règles construisent", and chapter 08 §1 repeats that
 * extraction happens through cursor pagination, bounded and subject to the same
 * permissions. Nothing here contradicts it: these functions serialize the rows the
 * browser already holds — the page the reader was allowed to read, masked fields absent
 * because they were never projected. No route is called, no second read happens, and a
 * million rows cannot be pulled by widening a parameter.
 *
 * That is also why the bottom bar's button says "Exporter la page" rather than
 * "Exporter la table".
 */

export type ExportFormat = 'csv' | 'json' | 'sql' | 'tsv'

type Row = Record<string, unknown>

/** Renders one value for a text format. `null` is empty, not the word "null". */
function scalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * RFC 4180 quoting: a field is quoted as soon as it carries a separator, a quote or a
 * newline, and an inner quote is doubled.
 */
function csvCell(value: unknown): string {
  const text = scalar(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: readonly Row[], fields: readonly Field[]): string {
  // The header carries the PHYSICAL names, not the labels: a CSV is read by a program
  // far more often than by a person, and the physical name is the one that matches the
  // column in psql. The label would also collide as soon as two tables share one.
  const header = fields.map((f) => csvCell(f.name)).join(',')
  const body = rows.map((row) => fields.map((f) => csvCell(row[f.name])).join(','))
  return [header, ...body].join('\r\n')
}

/** Tab-separated, for the clipboard: that is the form a spreadsheet pastes as a grid. */
export function toTsv(rows: readonly Row[], fields: readonly Field[]): string {
  const cell = (value: unknown) => scalar(value).replace(/[\t\r\n]/g, ' ')
  const header = fields.map((f) => cell(f.name)).join('\t')
  const body = rows.map((row) => fields.map((f) => cell(row[f.name])).join('\t'))
  return [header, ...body].join('\n')
}

export function toJson(rows: readonly Row[], fields: readonly Field[]): string {
  // Projected to the VISIBLE columns rather than dumped whole: exporting `_id` and the
  // four system columns when the screen hides them would surprise, and the rows also
  // carry link display values the grid resolved for the eye.
  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const field of fields) out[field.name] = row[field.name] ?? null
    return out
  })
  return JSON.stringify(projected, null, 2)
}

/** A SQL literal. Doubling the quote is the whole of it — these strings go to a file. */
function sqlLiteral(value: unknown, kind: string): string {
  if (value === null || value === undefined) return 'NULL'
  if (kind === 'number') return Number.isFinite(Number(value)) ? String(value) : 'NULL'
  if (kind === 'boolean') return value === true ? 'TRUE' : 'FALSE'
  const quoted = (text: string) => `'${text.replace(/'/g, "''")}'`
  if (kind === 'multi_select' && Array.isArray(value)) {
    return `ARRAY[${value.map((v) => quoted(String(v))).join(', ')}]::text[]`
  }
  if ((kind === 'file' || kind === 'image') && Array.isArray(value)) {
    // The signed links are left out: they expire, and the column never held them.
    const files = value.map((f) => {
      const { url: _url, ...stored } = f as Record<string, unknown>
      return stored
    })
    return `${quoted(JSON.stringify(files))}::jsonb`
  }
  return quoted(scalar(value))
}

/**
 * `INSERT` statements against the REAL table.
 *
 * The qualified name is the one the product publishes — `b_<tenant>_<base>.<table>` —
 * because that is exactly what one would type in psql. This is the product's whole
 * premise made literal: the export runs against the database as it stands, with no
 * mapping layer to look up.
 */
export function toSql(
  rows: readonly Row[],
  fields: readonly Field[],
  qualifiedName: string,
): string {
  if (rows.length === 0)
    return $t('-- Aucune ligne à exporter depuis {qualifiedName}.\n', { qualifiedName })
  const columns = fields.map((f) => `"${f.name}"`).join(', ')
  const lines = rows.map((row) => {
    const values = fields.map((f) => sqlLiteral(row[f.name], f.kind)).join(', ')
    return `INSERT INTO ${qualifiedName} (${columns}) VALUES (${values});`
  })
  return `${lines.join('\n')}\n`
}

export function serialize(
  format: ExportFormat,
  rows: readonly Row[],
  fields: readonly Field[],
  qualifiedName: string,
): string {
  switch (format) {
    case 'csv':
      return toCsv(rows, fields)
    case 'tsv':
      return toTsv(rows, fields)
    case 'json':
      return toJson(rows, fields)
    case 'sql':
      return toSql(rows, fields, qualifiedName)
  }
}

const MIME: Readonly<Record<ExportFormat, string>> = {
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  json: 'application/json;charset=utf-8',
  sql: 'application/sql;charset=utf-8',
}

/**
 * Hands the file to the browser.
 *
 * A `Blob` and an object URL, revoked right after: a `data:` URI would cap out on a
 * page of a few thousand rows, and Chrome refuses those over 2 MB from a click.
 *
 * The BOM on CSV is not decoration — Excel on Windows reads a CSV without one as
 * Windows-1252, and every accented label in this product comes out mangled.
 */
export function download(format: ExportFormat, content: string, baseName: string): void {
  const payload = format === 'csv' ? `﻿${content}` : content
  const blob = new Blob([payload], { type: MIME[format] })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${baseName}.${format}`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** True when the clipboard is usable — it is not, outside a secure context. */
export function canCopy(): boolean {
  return typeof navigator !== 'undefined' && navigator.clipboard !== undefined
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
