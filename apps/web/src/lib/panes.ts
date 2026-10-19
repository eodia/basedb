'use client'

/**
 * Sizes of resizable panes, remembered by this browser: a preference like the sidebar's and
 * the panels', restored AFTER mount — `localStorage` does not exist where Next.js renders
 * first, and the first paint must agree with the server's. Every access is guarded: a blocked
 * storage costs the size on the next visit, nothing more.
 */
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'basedb.panes'

function read(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {}
  } catch {
    return {}
  }
}

function write(id: string, size: number | null): void {
  try {
    const all = read()
    if (size === null) delete all[id]
    else all[id] = Math.round(size)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Not remembered: the pane still resizes for this visit.
  }
}

export const clampSize = (size: number, min: number, max: number): number =>
  Math.min(Math.max(size, min), max)

/** `[size, setSize, reset]` of a pane, held within its bounds and saved when it settles. */
export function usePaneSize(
  id: string,
  defaultSize: number,
  min: number,
  max: number,
): [number, (size: number, save?: boolean) => void, () => void] {
  const [size, setSizeState] = useState(defaultSize)

  useEffect(() => {
    const saved = read()[id]
    if (typeof saved === 'number' && Number.isFinite(saved))
      setSizeState(clampSize(saved, min, max))
  }, [id, min, max])

  // `save: false` follows a drag; the size it ends on is saved once, by the last call.
  const setSize = useCallback(
    (next: number, save = true) => {
      const clamped = clampSize(next, min, max)
      setSizeState(clamped)
      if (save) write(id, clamped)
    },
    [id, min, max],
  )
  const reset = useCallback(() => {
    setSizeState(defaultSize)
    write(id, null)
  }, [id, defaultSize])
  return [size, setSize, reset]
}
