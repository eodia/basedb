'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Cell selection — the mouse and keyboard shortcuts of a grid.
 *
 * The model is the spreadsheet one, because that is the one everybody already knows:
 *
 *   clic                 pose l'ancre et sélectionne une cellule
 *   clic + glisser       étend le rectangle depuis l'ancre
 *   Maj + clic           étend le rectangle jusqu'au clic, ancre inchangée
 *   Ctrl + clic          ajoute ou retire une cellule, sans toucher au rectangle
 *   flèches              déplacent ancre et curseur ensemble
 *   Maj + flèches        déplacent le curseur seul, donc étendent le rectangle
 *   Origine / Fin        bord de la ligne ; avec Ctrl, coin de la grille
 *   Ctrl + A             tout
 *   Ctrl + C             copie le rectangle en TSV
 *   Échap                annule la sélection
 *
 * Two references rather than two states, and that is deliberate: the anchor and the
 * cursor change on every pointer move during a drag, and re-rendering the grid sixty
 * times a second to store a coordinate nothing displays would cost more than the
 * selection itself.
 */

export interface CellRef {
  readonly rowIndex: number
  readonly column: string
}

export const cellKey = (rowIndex: number, column: string) => `${rowIndex}:${column}`

export function parseCellKey(key: string): CellRef {
  const cut = key.indexOf(':')
  return { rowIndex: Number.parseInt(key.slice(0, cut), 10), column: key.slice(cut + 1) }
}

interface Options {
  readonly rowCount: number
  readonly columns: readonly string[]
  readonly selected: ReadonlySet<string>
  readonly setSelected: (next: ReadonlySet<string>) => void
  /** How many rows a `PageUp` jumps. The page size, so the two agree. */
  readonly pageJump: number
  /** True while a cell editor is open: every shortcut then belongs to the editor. */
  readonly editing: boolean
  readonly onCopy: () => void
}

export function useCellSelection({
  rowCount,
  columns,
  selected,
  setSelected,
  pageJump,
  editing,
  onCopy,
}: Options) {
  const anchor = useRef<CellRef | null>(null)
  const cursor = useRef<CellRef | null>(null)
  const dragging = useRef(false)

  /** Every cell of the rectangle spanned by two corners. */
  const rectangle = useCallback(
    (from: CellRef, toRow: number, toColumn: string): ReadonlySet<string> => {
      const a = columns.indexOf(from.column)
      const b = columns.indexOf(toColumn)
      if (a === -1 || b === -1) return new Set()
      const next = new Set<string>()
      for (let r = Math.min(from.rowIndex, toRow); r <= Math.max(from.rowIndex, toRow); r++) {
        for (let c = Math.min(a, b); c <= Math.max(a, b); c++) {
          const column = columns[c]
          if (column !== undefined) next.add(cellKey(r, column))
        }
      }
      return next
    },
    [columns],
  )

  const onCellPointerDown = useCallback(
    (rowIndex: number, column: string, e: React.MouseEvent) => {
      // Left button only: a right click opens the context menu on whatever is already
      // selected, and must not collapse that selection to one cell first.
      if (e.button !== 0) return
      dragging.current = true

      if (e.shiftKey && anchor.current !== null) {
        cursor.current = { rowIndex, column }
        setSelected(rectangle(anchor.current, rowIndex, column))
        return
      }

      if (e.ctrlKey || e.metaKey) {
        anchor.current = { rowIndex, column }
        cursor.current = { rowIndex, column }
        const key = cellKey(rowIndex, column)
        const next = new Set(selected)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        setSelected(next)
        return
      }

      anchor.current = { rowIndex, column }
      cursor.current = { rowIndex, column }
      setSelected(new Set([cellKey(rowIndex, column)]))
    },
    [rectangle, selected, setSelected],
  )

  const onCellPointerEnter = useCallback(
    (rowIndex: number, column: string) => {
      if (!dragging.current || anchor.current === null) return
      cursor.current = { rowIndex, column }
      setSelected(rectangle(anchor.current, rowIndex, column))
    },
    [rectangle, setSelected],
  )

  const endDrag = useCallback(() => {
    dragging.current = false
  }, [])

  // A pointer released outside the grid — over the sidebar, out of the window — must end
  // the drag too, otherwise the next hover over a cell keeps extending a selection
  // nobody is holding any more.
  useEffect(() => {
    const up = () => {
      dragging.current = false
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  useEffect(() => {
    if (editing) return

    const NAVIGATION = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ])

    const handler = (e: KeyboardEvent) => {
      // A shortcut aimed at the grid must not fire while someone is typing a filter, a
      // label or a password. The grid has no focus of its own to check against, so the
      // target's nature is what decides.
      const target = e.target as HTMLElement | null
      if (
        target !== null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]') !== null)
      ) {
        return
      }

      if (rowCount === 0 || columns.length === 0) return

      const first = columns[0]
      const last = columns[columns.length - 1]
      if (first === undefined || last === undefined) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        anchor.current = { rowIndex: 0, column: first }
        cursor.current = { rowIndex: rowCount - 1, column: last }
        setSelected(rectangle({ rowIndex: 0, column: first }, rowCount - 1, last))
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selected.size > 0) {
        e.preventDefault()
        onCopy()
        return
      }

      if (e.key === 'Escape' && selected.size > 0) {
        setSelected(new Set())
        anchor.current = null
        cursor.current = null
        return
      }

      if (!NAVIGATION.has(e.key)) return
      const base = anchor.current
      if (base === null) return

      // With Shift the cursor moves and the anchor stays; without it, both move.
      const from = e.shiftKey ? (cursor.current ?? base) : base
      const fromColumn = columns.indexOf(from.column)
      if (fromColumn === -1) return

      let row = from.rowIndex
      let column = fromColumn
      e.preventDefault()

      switch (e.key) {
        case 'ArrowUp':
          row = Math.max(0, row - 1)
          break
        case 'ArrowDown':
          row = Math.min(rowCount - 1, row + 1)
          break
        case 'ArrowLeft':
          column = Math.max(0, column - 1)
          break
        case 'ArrowRight':
          column = Math.min(columns.length - 1, column + 1)
          break
        case 'Home':
          column = 0
          if (e.ctrlKey || e.metaKey) row = 0
          break
        case 'End':
          column = columns.length - 1
          if (e.ctrlKey || e.metaKey) row = rowCount - 1
          break
        case 'PageUp':
          row = Math.max(0, row - pageJump)
          break
        case 'PageDown':
          row = Math.min(rowCount - 1, row + pageJump)
          break
      }

      const name = columns[column]
      if (name === undefined) return
      cursor.current = { rowIndex: row, column: name }

      if (e.shiftKey) {
        setSelected(rectangle(base, row, name))
      } else {
        anchor.current = { rowIndex: row, column: name }
        setSelected(new Set([cellKey(row, name)]))
      }

      // Scrolled AFTER paint: with a virtualized body the target row may not exist in
      // the DOM at the instant the key is handled.
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-cell="${CSS.escape(cellKey(row, name))}"]`)
          ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      })
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [rowCount, columns, selected, setSelected, pageJump, editing, onCopy, rectangle])

  /** Drops the selection — called when the underlying rows change. */
  const clear = useCallback(() => {
    anchor.current = null
    cursor.current = null
    setSelected(new Set())
  }, [setSelected])

  return { onCellPointerDown, onCellPointerEnter, endDrag, clear }
}
