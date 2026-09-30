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

/** Marks an element that keeps Ctrl+K for itself — the Markdown editor makes a link with it. */
export const KEEPS_MOD_K = 'data-keeps-mod-k'

/**
 * Whether a key pressed on the page is the palette's Ctrl+K (⌘K on a Mac).
 *
 * The listener captures: it hears the key before anything under the focus, since a cell
 * being typed in stops its keys on their way, and the browser would then take Ctrl+K for
 * its own search. An element that wants the shortcut says so, by `KEEPS_MOD_K`. The K is
 * read as typed, else by its place on the keyboard: on a Cyrillic or a Korean layout, that
 * key types another letter.
 */
export function isPaletteKey(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false
  const key = event.key.toLowerCase()
  if (key !== 'k' && (/^[a-z]$/u.test(key) || event.code !== 'KeyK')) return false
  const target = event.target as Element | null
  return typeof target?.closest !== 'function' || target.closest(`[${KEEPS_MOD_K}]`) === null
}
