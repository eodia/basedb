import type { SqlResult } from '@/lib/api/client'
import { type QueryResult, type ResultColumn, sqlColumnType } from '@basedb/contracts'

/**
 * What a statement run in the console gives, read as the result of a question — chapter 11
 * §1.7. A SQL question is a statement like any other; run as a draft by whoever manages the
 * base, it goes through the console, whose result carries PostgreSQL's own type names and one
 * object per row. The chart and the table read a `QueryResult`: its columns typed the way the
 * kernel types those of a question run on the reader (`sqlColumnType`), its rows as lists.
 */

/** The keys the server gave a row's values: a repeated column name is suffixed by its rank. */
function keysOf(columns: ReadonlyArray<{ readonly name: string }>): string[] {
  const seen = new Set<string>()
  return columns.map((column, index) => {
    const key = seen.has(column.name) ? `${column.name}__${index}` : column.name
    seen.add(column.name)
    return key
  })
}

export function queryResultOfSql(result: SqlResult): QueryResult {
  const keys = keysOf(result.columns)
  const columns: ResultColumn[] = result.columns.map((column) => {
    const type = sqlColumnType(column.dataType)
    return {
      name: column.name,
      label: column.name,
      role: type === 'number' ? 'metric' : 'dimension',
      type,
    }
  })
  const rows = result.rows.map((row) =>
    columns.map((column, i) => {
      const value = row[keys[i] as string]
      if (value === null || value === undefined) return null
      if (column.type === 'number' && typeof value === 'string') {
        const n = Number(value)
        return Number.isFinite(n) ? n : value
      }
      return value
    }),
  )
  return { columns, rows, truncated: result.truncated, duration_ms: result.duration_ms }
}

/** The commands that change what the base holds. */
const WRITES: ReadonlySet<string> = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'COPY'])

/** Whether a statement, as PostgreSQL names its command, wrote — it did more than read. */
export const wroteData = (command: string): boolean => WRITES.has(command.toUpperCase())
