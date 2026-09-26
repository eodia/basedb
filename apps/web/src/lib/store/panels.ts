'use client'

import { create } from 'zustand'

/**
 * The width of the panels on the right — the record's, and the copilot's.
 *
 * A preference of this browser, like the sidebar's, and restored the same way: AFTER mount,
 * because `localStorage` does not exist where Next.js renders first. The record panel and
 * the new-record panel share one width: they are the same place on the screen, and a panel
 * that changed size between reading a row and creating one would be a panel that moves.
 */

const STORAGE_KEY = 'basedb.panels'

export type PanelKey = 'record' | 'copilot'

export const PANEL_DEFAULTS: Readonly<Record<PanelKey, number>> = { record: 400, copilot: 420 }

export const PANEL_MIN = 320
export const PANEL_MAX = 960

/**
 * What the working area keeps whatever the panel's width, beside the sidebar: a grid and
 * its toolbar still have room to be read. The panel enforces it against the space it is
 * actually given, which only it can measure.
 */
export const MAIN_MIN = 480

/** A width within the panel's own bounds. */
export function clampWidth(width: number): number {
  return Math.round(Math.max(PANEL_MIN, Math.min(width, PANEL_MAX)))
}

interface PanelsState {
  readonly widths: Readonly<Partial<Record<PanelKey, number>>>
  /** Sets a width, in memory — called on every move of a drag. */
  resize: (panel: PanelKey, width: number) => void
  /** Writes the widths to storage — called once the drag is over. */
  persist: () => void
  /** Back to the width the panel is designed for. */
  reset: (panel: PanelKey) => void
  /** Reads the stored widths. Client only. */
  initialize: () => void
}

export const usePanels = create<PanelsState>((set, get) => ({
  widths: {},

  resize: (panel, width) => set({ widths: { ...get().widths, [panel]: clampWidth(width) } }),

  persist: () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(get().widths))
    } catch {
      // A blocked storage costs the width on the next visit, nothing more.
    }
  },

  reset: (panel) => {
    const { [panel]: _dropped, ...rest } = get().widths
    set({ widths: rest })
    get().persist()
  },

  initialize: () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === null) return
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const widths: Partial<Record<PanelKey, number>> = {}
      for (const panel of Object.keys(PANEL_DEFAULTS) as PanelKey[]) {
        const width = parsed[panel]
        if (typeof width === 'number' && Number.isFinite(width)) widths[panel] = width
      }
      set({ widths })
    } catch {
      // A corrupted value opens the panels at their default width.
    }
  },
}))
