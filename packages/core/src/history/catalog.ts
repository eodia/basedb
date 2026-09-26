import type { Executor } from '../runtime/pool.js'

/**
 * What the history needs to know about a table to read its buffer rows and its journal:
 * where it lives, which JSON key is which field, and how to name a value — chapter 07 §3.2,
 * §4.2.
 *
 * Read from the catalog AT THE TIME OF USE, never frozen into the triggers: a field added
 * yesterday is historised from its first write, and a field deleted since keeps its label
 * in yesterday's entries.
 */

export interface HistoryField {
  readonly id: string
  readonly kind: string
  readonly label: string
  /** The physical column — the key of the buffer's JSON. */
  readonly column: string
  readonly isLive: boolean
  /** A link: its target, and the column that names a row of it. */
  readonly target?: {
    readonly tableId: string
    readonly schema: string
    readonly table: string
    readonly displayColumn: string | null
  }
  /** A list of choices: value → label, deleted options included. */
  readonly options?: ReadonlyMap<string, string>
}

export interface HistoryTable {
  readonly id: string
  readonly baseId: string
  readonly label: string
  readonly schema: string
  readonly table: string
  readonly isLive: boolean
  /** The column whose value names a row, when the table designates one (A15). */
  readonly displayColumn: string | null
  readonly fields: readonly HistoryField[]
}

/** The tables named, with every field — live or deleted — whose column is known. */
export async function loadHistoryTables(
  exec: Executor,
  tableIds: readonly string[],
): Promise<Map<string, HistoryTable>> {
  const out = new Map<string, HistoryTable>()
  if (tableIds.length === 0) return out

  const tables = await exec.query<{
    id: string
    base_id: string
    label: string
    schema_name: string
    table_name: string
    is_live: boolean
    display_column: string | null
  }>(
    `SELECT t.id, t.base_id, t.label, sn.name AS schema_name, tn.name AS table_name,
            t.is_live, dn.name AS display_column
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
       LEFT JOIN _basedb.field df         ON df.id = t.display_field_id
       LEFT JOIN _basedb.physical_name dn ON dn.id = df.name_id
      WHERE t.id = ANY($1::uuid[])`,
    [tableIds],
  )

  const fields = await exec.query<{
    id: string
    table_id: string
    kind: string
    label: string
    column_name: string
    is_live: boolean
    target_table_id: string | null
  }>(
    `SELECT f.id, f.table_id, f.kind, f.label, fn.name AS column_name, f.is_live,
            l.target_table_id
       FROM _basedb.field f
       JOIN _basedb.physical_name fn ON fn.id = f.name_id
       LEFT JOIN _basedb.field_link_config l ON l.field_id = f.id
      WHERE f.table_id = ANY($1::uuid[]) AND NOT f.is_purged
      ORDER BY f.position`,
    [tableIds],
  )

  // Link targets may sit outside the tables asked for: read them once, shallowly.
  const targetIds = [
    ...new Set(fields.map((f) => f.target_table_id).filter((id): id is string => id !== null)),
  ]
  const targets = new Map<string, { schema: string; table: string; displayColumn: string | null }>()
  if (targetIds.length > 0) {
    const rows = await exec.query<{
      id: string
      schema_name: string
      table_name: string
      display_column: string | null
    }>(
      `SELECT t.id, sn.name AS schema_name, tn.name AS table_name, dn.name AS display_column
         FROM _basedb.table_def t
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
         LEFT JOIN _basedb.field df         ON df.id = t.display_field_id
         LEFT JOIN _basedb.physical_name dn ON dn.id = df.name_id
        WHERE t.id = ANY($1::uuid[])`,
      [targetIds],
    )
    for (const r of rows) {
      targets.set(r.id, {
        schema: r.schema_name,
        table: r.table_name,
        displayColumn: r.display_column,
      })
    }
  }

  const choiceFields = fields.filter((f) => f.kind === 'select' || f.kind === 'multi_select')
  const options = new Map<string, Map<string, string>>()
  if (choiceFields.length > 0) {
    const rows = await exec.query<{ field_id: string; value: string; label: string }>(
      'SELECT field_id, value, label FROM _basedb.select_option WHERE field_id = ANY($1::uuid[])',
      [choiceFields.map((f) => f.id)],
    )
    for (const r of rows) {
      const map = options.get(r.field_id) ?? new Map<string, string>()
      map.set(r.value, r.label)
      options.set(r.field_id, map)
    }
  }

  for (const t of tables) {
    out.set(t.id, {
      id: t.id,
      baseId: t.base_id,
      label: t.label,
      schema: t.schema_name,
      table: t.table_name,
      isLive: t.is_live,
      displayColumn: t.display_column,
      fields: fields
        .filter((f) => f.table_id === t.id)
        .map((f) => {
          const target = f.target_table_id === null ? undefined : targets.get(f.target_table_id)
          return {
            id: f.id,
            kind: f.kind,
            label: f.label,
            column: f.column_name,
            isLive: f.is_live,
            ...(target === undefined || f.target_table_id === null
              ? {}
              : { target: { tableId: f.target_table_id, ...target } }),
            ...(options.has(f.id) ? { options: options.get(f.id) } : {}),
          }
        }),
    })
  }
  return out
}

/** At most this many characters of a display value: a list label, not a copy (§4.2). */
export const DISPLAY_MAX = 200

/** A value as a person reads it in a list: text, lists joined, long values cut. */
export function displayText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  let text: string
  if (Array.isArray(value)) {
    text = value
      .map((v) =>
        typeof v === 'object' && v !== null && 'name' in v
          ? String((v as { name: unknown }).name)
          : String(v),
      )
      .join(', ')
  } else if (typeof value === 'object') {
    text = JSON.stringify(value)
  } else {
    text = String(value)
  }
  const chars = [...text]
  return chars.length > DISPLAY_MAX ? `${chars.slice(0, DISPLAY_MAX - 1).join('')}…` : text
}
