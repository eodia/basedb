'use client'

import { type Field, type TableRef, api } from '@/lib/api/client'
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * The table a long text belongs to, and its columns — what an editor of a long text needs
 * beyond the cell: the columns it may cite (chapter 04 §2.2, « Variables »), and where to
 * read the text as it was written.
 *
 * A context rather than props: a cell is drawn deep inside the grid, knowing only its own
 * field, and threading the table through every layer for one kind of cell would thread it
 * through all of them.
 */

interface TableFields {
  readonly table: TableRef | null
  readonly fields: readonly Field[]
}

const Context = createContext<TableFields>({ table: null, fields: [] })

export function TableFieldsProvider({
  table,
  fields,
  children,
}: {
  readonly table: TableRef | null
  readonly fields: readonly Field[]
  readonly children: ReactNode
}) {
  const value = useMemo(() => ({ table, fields }), [table, fields])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useTableFields = () => useContext(Context)

/** The columns a long text may cite: those that hold a value, itself aside. */
export function citableColumns(fields: readonly Field[], self: string): Field[] {
  return fields.filter((f) => f.name !== self && f.kind !== 'button' && f.system !== true)
}

/**
 * A long text AS WRITTEN — `{{nom}}` and all —, read when its editor opens: every other
 * read serves it with the row's values in place of its citations. `null` while it is
 * read. A row not yet written — a draft, a form — or no table to ask: the text shown, which
 * is the text as written.
 */
export function useRawText(rowId: string | null, field: string, open: boolean, shown: string) {
  const { table } = useTableFields()
  const [raw, setRaw] = useState<string | null>(null)
  // Read through a ref: the page read again while the editor is open must not read the
  // row again — the draft would start over.
  const fallback = useRef(shown)
  fallback.current = shown

  useEffect(() => {
    if (!open) {
      setRaw(null)
      return
    }
    if (table === null || rowId === null) {
      setRaw(fallback.current)
      return
    }
    let live = true
    api.rawRecord(table, rowId).then(
      (row) => {
        if (!live) return
        const value = row[field]
        setRaw(typeof value === 'string' ? value : '')
      },
      // Unreadable now: the text shown is the best there is.
      () => live && setRaw(fallback.current),
    )
    return () => {
      live = false
    }
  }, [open, table, rowId, field])

  return raw
}
