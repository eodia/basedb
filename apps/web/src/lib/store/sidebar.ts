'use client'

import { create } from 'zustand'

/**
 * Whether the left column is shown in full or reduced to its icons.
 *
 * A preference of this browser, like the theme, and restored the same way: AFTER mount,
 * because `localStorage` does not exist where Next.js renders first. Reduced, the column
 * stays on screen — the bases, the sections and the profile remain one click away, only
 * their labels move into tooltips.
 */

const STORAGE_KEY = 'basedb.sidebar'

interface SidebarState {
  readonly collapsed: boolean
  toggle: () => void
  /** Reads the stored preference. Client only. */
  initialize: () => void
}

export const useSidebar = create<SidebarState>((set, get) => ({
  collapsed: false,

  toggle: () => {
    const collapsed = !get().collapsed
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? 'mini' : 'full')
    } catch {
      // A blocked storage costs the preference on the next visit, nothing more.
    }
    set({ collapsed })
  },

  initialize: () => {
    try {
      set({ collapsed: window.localStorage.getItem(STORAGE_KEY) === 'mini' })
    } catch {
      // Same as above: an unreadable storage opens the column in full.
    }
  },
}))
