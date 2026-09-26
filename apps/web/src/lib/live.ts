'use client'

import {
  type PointerAt,
  type RemotePointer,
  type Viewer,
  api,
  streamEvents,
} from '@/lib/api/client'
import { useCallback, useEffect, useRef, useState } from 'react'

/** A pointer is sent at most this often; the last position always goes. */
const POINTER_EVERY_MS = 120
/** A pointer that has not moved for this long is taken away. */
const POINTER_IDLE_MS = 60_000

/** A pointer as the stream sends it, or `null` when it names no cell. */
function pointerOf(raw: unknown): PointerAt | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { record, field, x, y } = raw as Record<string, unknown>
  return typeof record === 'string' &&
    typeof field === 'string' &&
    typeof x === 'number' &&
    typeof y === 'number'
    ? { record, field, x, y }
    : null
}

/**
 * The live stream, from a screen — chapter 16 §3.
 *
 * One stream per screen, on the table it shows (or on none: the notifications still
 * arrive). What it hears is a signal: the screen reads again what the signal names. A
 * stream that drops is opened again after a growing delay; the table changing opens a new
 * one, the open row changing only moves the presence.
 */

export interface LiveHandlers {
  /** Rows of the table were written — by someone else when `actor` is not oneself. */
  readonly onRecords?: (ids: readonly string[] | null, actor: string | null) => void
  readonly onComments?: (record: string) => void
  readonly onNotifications?: () => void
}

export function useLive(
  where: {
    readonly base: string | null
    readonly table: string | null
    readonly record: string | null
  },
  handlers: LiveHandlers,
): {
  readonly viewers: readonly Viewer[]
  readonly connected: boolean
  /** The others' pointers over the grid (chapter 16 §3.4). */
  readonly pointers: readonly RemotePointer[]
  /** Sends this screen's pointer, `null` when it leaves the grid. */
  readonly movePointer: (at: PointerAt | null) => void
} {
  const [viewers, setViewers] = useState<readonly Viewer[]>([])
  const [connected, setConnected] = useState(false)
  const [session, setSession] = useState<string | null>(null)
  const [pointers, setPointers] = useState<ReadonlyArray<RemotePointer & { seen: number }>>([])
  // The latest handlers, without reopening the stream when a screen re-renders.
  const latest = useRef(handlers)
  latest.current = handlers
  const record = useRef(where.record)
  record.current = where.record

  const { base, table } = where
  useEffect(() => {
    const controller = new AbortController()
    let delay = 1_000
    let timer: ReturnType<typeof setTimeout> | null = null
    setViewers([])
    setSession(null)
    setPointers([])

    const open = () => {
      streamEvents(
        {
          base: base ?? undefined,
          table: table ?? undefined,
          record: record.current ?? undefined,
        },
        (name, data) => {
          delay = 1_000
          if (name === 'ready') {
            setConnected(true)
            setSession(typeof data.session === 'string' ? data.session : null)
          } else if (name === 'records') {
            const ids = Array.isArray(data.ids) ? (data.ids as string[]) : null
            latest.current.onRecords?.(ids, typeof data.actor === 'string' ? data.actor : null)
          } else if (name === 'comments' && typeof data.record === 'string') {
            latest.current.onComments?.(data.record)
          } else if (name === 'notifications') {
            latest.current.onNotifications?.()
          } else if (name === 'presence' && Array.isArray(data.viewers)) {
            const present = data.viewers as Viewer[]
            setViewers(present)
            // Someone who left the table takes their pointer with them.
            setPointers((all) => all.filter((p) => present.some((v) => v.user === p.user)))
          } else if (name === 'pointer' && typeof data.session === 'string') {
            const from = data.session
            const at = pointerOf(data.at)
            setPointers((all) => [
              ...all.filter((p) => p.session !== from),
              ...(at === null
                ? []
                : [
                    {
                      session: from,
                      user: String(data.user ?? ''),
                      name: String(data.name ?? ''),
                      at,
                      seen: Date.now(),
                    },
                  ]),
            ])
          }
        },
        controller.signal,
      )
        .catch(() => undefined)
        .finally(() => {
          setConnected(false)
          if (controller.signal.aborted) return
          timer = setTimeout(open, delay)
          delay = Math.min(delay * 2, 30_000)
        })
    }
    open()
    return () => {
      controller.abort()
      if (timer !== null) clearTimeout(timer)
    }
  }, [base, table])

  // The open row changed: the presence follows, the stream stays.
  const { record: current } = where
  useEffect(() => {
    if (session === null || base === null || table === null) return
    api.movePresence({ session, base, table, record: current }).catch(() => undefined)
  }, [session, base, table, current])

  // A pointer left still for a minute is taken away: its owner is reading, or gone.
  useEffect(() => {
    const sweep = setInterval(() => {
      const limit = Date.now() - POINTER_IDLE_MS
      setPointers((all) =>
        all.some((p) => p.seen < limit) ? all.filter((p) => p.seen >= limit) : all,
      )
    }, 10_000)
    return () => clearInterval(sweep)
  }, [])

  // This screen's pointer: at most every POINTER_EVERY_MS, the last position always sent,
  // and leaving the grid said at once.
  const pending = useRef<PointerAt | null | undefined>(undefined)
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentAt = useRef(0)
  const movePointer = useCallback(
    (at: PointerAt | null) => {
      if (session === null || base === null || table === null) return
      const flush = () => {
        wait.current = null
        const value = pending.current
        if (value === undefined) return
        pending.current = undefined
        sentAt.current = Date.now()
        api.movePointer({ session, base, table, at: value }).catch(() => undefined)
      }
      pending.current = at
      if (at === null) {
        if (wait.current !== null) clearTimeout(wait.current)
        flush()
        return
      }
      const left = POINTER_EVERY_MS - (Date.now() - sentAt.current)
      if (left <= 0) flush()
      else wait.current ??= setTimeout(flush, left)
    },
    [session, base, table],
  )

  return { viewers, connected, pointers, movePointer }
}
