'use client'

import { useEffect } from 'react'

/**
 * The browser tab's title, kept in step with what is open.
 *
 * `metadata.title` in `layout.tsx` is static, and it has to be: it is what the server
 * renders, and the server does not know which table someone opened. So the title is set
 * from the client, once the screen knows.
 *
 * It is not decoration. Anyone working on two bases at once has two tabs open, and
 * "basedb" twice in the tab strip tells them nothing — the title is the only thing that
 * distinguishes the two before clicking. It is also what lands in the browser's history
 * and in a bookmark.
 *
 * The most specific segment comes FIRST, because a tab strip truncates from the right:
 * "Factures — Démo · b…" keeps the useful word when the tab is narrow, whereas
 * "basedb · Démo — Fac…" keeps the useless one.
 */

const PRODUCT = 'basedb'

export function useTitle(segments: ReadonlyArray<string | null | undefined>): void {
  // Joined before the effect rather than inside it: an array literal is a new reference
  // on every render, and depending on it would rewrite the title sixty times a second
  // while a column is being dragged.
  const joined = segments
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => segment !== undefined && segment !== '')
    .join(' — ')

  useEffect(() => {
    document.title = joined === '' ? PRODUCT : `${joined} · ${PRODUCT}`
  }, [joined])
}
