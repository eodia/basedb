'use client'

import { EditTableDialog } from '@/components/app/edit-table-dialog'
import { ImportDialog } from '@/components/app/import-dialog'
import { DeleteTableDialog } from '@/components/app/schema-editor'
import type { DescribedBase, Table } from '@/lib/api/client'
import { useWorkspace } from '@/lib/store/workspace'
import { useEffect, useState } from 'react'
import { create } from 'zustand'

/**
 * What can be done to a table from wherever it is shown: import a file into it, edit its
 * label and look, delete it.
 *
 * The sidebar offers both in the menu of a table and the grid's toolbar offers the import,
 * so the dialogs cannot live in either: two owners would mean two copies of a flow that
 * refreshes the base, reloads an open grid and closes the tabs of a table that is gone.
 * They live in `TableDialogs`, mounted once, and both places ask for them through the store.
 *
 * A store rather than a React context because the host has to be a SIBLING of the screen:
 * a provider would wrap it, and re-indent everything that page renders for the sake of two
 * dialogs.
 */

interface State {
  readonly importing: { readonly table: Table | null } | null
  readonly deleting: Table | null
  readonly editing: Table | null
  /** Opens the import assistant aimed at `table`, or at none — then a new table is proposed. */
  readonly importInto: (table: Table | null) => void
  readonly deleteTable: (table: Table) => void
  readonly editTable: (table: Table) => void
  readonly closeImport: () => void
  readonly closeDelete: () => void
  readonly closeEdit: () => void
}

const useDialogs = create<State>((set) => ({
  importing: null,
  deleting: null,
  editing: null,
  importInto: (table) => set({ importing: { table } }),
  deleteTable: (table) => set({ deleting: table }),
  editTable: (table) => set({ editing: table }),
  closeImport: () => set({ importing: null }),
  closeDelete: () => set({ deleting: null }),
  closeEdit: () => set({ editing: null }),
}))

export function useTableActions() {
  const importInto = useDialogs((s) => s.importInto)
  const deleteTable = useDialogs((s) => s.deleteTable)
  const editTable = useDialogs((s) => s.editTable)
  return { importInto, deleteTable, editTable }
}

export function TableDialogs({
  base,
  administers = false,
  onBaseChanged,
}: {
  readonly base: DescribedBase | null
  /** The administration role: a table's relation may be renamed with its label. */
  readonly administers?: boolean
  /** Reloads the description of the base: a table was created or deleted. */
  readonly onBaseChanged: () => Promise<void> | void
}) {
  const importing = useDialogs((s) => s.importing)
  const deleting = useDialogs((s) => s.deleting)
  const closeImport = useDialogs((s) => s.closeImport)
  const closeDelete = useDialogs((s) => s.closeDelete)
  const editing = useDialogs((s) => s.editing)
  const closeEdit = useDialogs((s) => s.closeEdit)
  const renameTab = useWorkspace((s) => s.rename)

  const openTable = useWorkspace((s) => s.openTable)
  const dropTable = useWorkspace((s) => s.dropTable)
  const reload = useWorkspace((s) => s.reload)

  // A table just created by an import is opened once the reloaded base actually holds it.
  const [toOpen, setToOpen] = useState<string | null>(null)
  useEffect(() => {
    if (toOpen === null || base === null) return
    const found = base.tables.find((t) => t.name === toOpen)
    if (found === undefined) return
    openTable(found, found.label)
    setToOpen(null)
  }, [toOpen, base, openTable])

  return (
    <>
      {base !== null && (
        <ImportDialog
          open={importing !== null}
          base={base}
          initial={importing?.table ?? null}
          onClose={closeImport}
          onImported={async (result) => {
            if (result.createdTable) {
              await onBaseChanged()
              setToOpen(result.table.name)
            }
            // The grid of an open table shows what it held before the import.
            reload()
          }}
        />
      )}

      <EditTableDialog
        table={editing}
        administers={administers}
        onClose={closeEdit}
        onRenamed={async (change) => {
          // Tabs and addresses carry names: those of the old one close, and the table
          // opens again under the new one once the reloaded base holds it.
          if (editing !== null) dropTable(editing.base, change.from)
          await onBaseChanged()
          setToOpen(change.to)
        }}
        onSaved={async (label) => {
          // The tabs open on it carry the label they were opened with.
          if (editing !== null) {
            for (const tab of useWorkspace.getState().tabs) {
              if (tab.kind === 'table' && tab.base === editing.base && tab.table === editing.name) {
                renameTab(tab.id, label)
              }
            }
          }
          await onBaseChanged()
        }}
      />

      <DeleteTableDialog
        table={deleting}
        onClose={closeDelete}
        onDeleted={async () => {
          const gone = deleting
          closeDelete()
          // Its tabs would only fail to load a table that no longer answers.
          if (gone !== null) dropTable(gone.base, gone.name)
          await onBaseChanged()
        }}
      />
    </>
  )
}
