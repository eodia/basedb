'use client'

import { create } from 'zustand'

/**
 * Whether the command palette is open, and with what already typed.
 *
 * A store rather than a state of the page: the palette opens from Ctrl+K anywhere, from
 * the search field of the top bar, and from a letter typed on that field — three places
 * that do not share a parent worth threading a callback through.
 */

interface PaletteState {
  readonly open: boolean
  /** What the field holds on opening — a letter typed on the top bar's search field, a `>`. */
  readonly initial: string
  /** Moves at each opening: the palette starts afresh from `initial`. */
  readonly opened: number
  show: (initial?: string) => void
  hide: () => void
  toggle: () => void
}

export const usePalette = create<PaletteState>((set, get) => ({
  open: false,
  initial: '',
  opened: 0,
  show: (initial = '') => set((s) => ({ open: true, initial, opened: s.opened + 1 })),
  hide: () => set({ open: false }),
  toggle: () => (get().open ? get().hide() : get().show()),
}))
