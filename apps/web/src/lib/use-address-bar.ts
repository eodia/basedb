'use client'

import { withBase, withoutBase } from '@/lib/base-path'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Keeps the address bar in step with the screen, and follows the browser's back and forward.
 *
 * `address` is what the screen shows, as `addressOf` writes it — `null` while there is
 * nothing to say yet, or when the address must stay as it was typed (a page that does not
 * exist). `follow` goes where the address now says, once the browser has moved to another
 * entry of its history.
 *
 * ONE ENTRY PER GESTURE. A click or a key opens a new entry in the history; whatever the
 * screen then settles on by itself — the dashboard it picks, the row a link opens once its
 * table is there, the first table of a base — replaces it rather than adding another, or
 * « précédent » would have to be pressed twice to leave a section. The first address the
 * screen writes replaces the one it was reached by, and so does everything a back or a
 * forward makes the screen do: the entry is the one the browser went to.
 *
 * Nothing is written while a back or a forward is being followed: the screen passes through
 * states on its way there, and an entry left behind by a quick second click must not
 * receive them. Once followed, the entry is written from the screen as it then renders — it
 * may say less than the address did, a row since deleted, a view no longer shared.
 */
export function useAddressBar(address: string | null, follow: () => Promise<void>): void {
  const wanted = useRef(address)
  wanted.current = address
  const following = useRef(follow)
  following.current = follow
  /** A click or a key since the last entry was written. */
  const gesture = useRef(false)
  const written = useRef(false)
  /** The back or forward being followed, `0` for none. */
  const traversing = useRef(0)
  /** Moves once one is followed: the render it causes carries where it led. */
  const [settled, settle] = useState(0)

  const write = useCallback(() => {
    const next = wanted.current
    if (next === null || traversing.current !== 0) return
    // Already what the address says — a reload, a bookmark: the entry is the screen's.
    if (next === `${withoutBase(window.location.pathname)}${window.location.search}`) {
      written.current = true
      return
    }
    const push = gesture.current && written.current
    gesture.current = false
    written.current = true
    // The browser's address carries the path basedb is served under; the screen's does not.
    if (push) window.history.pushState(null, '', withBase(next))
    else window.history.replaceState(null, '', withBase(next))
  }, [])

  useEffect(() => {
    void address
    void settled
    write()
  }, [address, settled, write])

  useEffect(() => {
    let traversal = 0
    const touched = () => {
      gesture.current = true
    }
    const traversed = () => {
      gesture.current = false
      traversal += 1
      const mine = traversal
      traversing.current = mine
      void following
        .current()
        .catch(() => undefined)
        .finally(() => {
          if (traversing.current !== mine) return
          traversing.current = 0
          settle((n) => n + 1)
        })
    }
    // Captured: a component that stops the event must not keep the gesture from counting.
    window.addEventListener('pointerdown', touched, true)
    window.addEventListener('keydown', touched, true)
    window.addEventListener('popstate', traversed)
    return () => {
      window.removeEventListener('pointerdown', touched, true)
      window.removeEventListener('keydown', touched, true)
      window.removeEventListener('popstate', traversed)
    }
  }, [])
}
