'use client'

import type { Row } from '@/components/app/grid/cell'
import { type Table, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The rows of a view read page after page — the gallery's and the list's (ch. 11 §1.6):
 * the view's filter and sort, one page, then « Charger plus » for the next, by cursor.
 * Everything is read again when the filter, the sort or `reloadKey` move.
 */
export function usePagedRows({
  table,
  filter,
  sort,
  reloadKey,
  pageSize = 100,
  onError,
}: {
  readonly table: Table
  readonly filter: string
  readonly sort: string
  readonly reloadKey: number
  readonly pageSize?: number
  readonly onError: (message: string | null) => void
}) {
  const [rows, setRows] = useState<readonly Row[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Only the newest read may answer: a slow first page must not overwrite a newer one.
  const latest = useRef(0)

  const load = useCallback(
    async (after: string | null) => {
      const mine = ++latest.current
      setLoading(true)
      try {
        const page = await api.list(table, {
          filter,
          sort,
          limit: pageSize,
          after: after ?? undefined,
        })
        if (mine !== latest.current) return
        setRows((current) => (after === null ? page.data : [...current, ...page.data]) as Row[])
        setCursor(page.meta.has_next_page ? (page.meta.next_cursor ?? null) : null)
        onError(null)
      } catch (e) {
        if (mine === latest.current) onError(messageFor(e))
      } finally {
        if (mine === latest.current) setLoading(false)
      }
    },
    [table, filter, sort, pageSize, onError],
  )

  useEffect(() => {
    void reloadKey
    void load(null)
  }, [load, reloadKey])

  return {
    rows,
    loading,
    hasMore: cursor !== null,
    loadMore: () => (cursor === null ? undefined : void load(cursor)),
  }
}
