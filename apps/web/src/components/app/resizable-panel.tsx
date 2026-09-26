'use client'

import { MAIN_MIN, PANEL_DEFAULTS, PANEL_MIN, type PanelKey, usePanels } from '@/lib/store/panels'
import { cn } from '@/lib/utils'
import { type ReactNode, useCallback, useRef } from 'react'

/** The step of an arrow key on the handle; Shift makes it four times larger. */
const STEP = 16

/**
 * A panel on the right whose width is dragged from its left edge — the record panel, the
 * copilot.
 *
 * The handle is the panel's border, widened for the pointer: a drag moves it, a double
 * click puts the default width back, and from the keyboard it is a separator the arrows
 * move. The width is this browser's preference, kept between visits; the working area
 * always keeps enough room to be read, whatever was stored.
 */
export function ResizablePanel({
  panel,
  label,
  className,
  children,
}: {
  readonly panel: PanelKey
  /** What the handle resizes, for a screen reader: « la fiche », « le Copilot ». */
  readonly label: string
  readonly className?: string
  readonly children: ReactNode
}) {
  const width = usePanels((s) => s.widths[panel] ?? PANEL_DEFAULTS[panel])
  const resize = usePanels((s) => s.resize)
  const persist = usePanels((s) => s.persist)
  const reset = usePanels((s) => s.reset)
  const aside = useRef<HTMLElement>(null)

  /**
   * The widest the panel may be now: the working area it sits beside keeps `MAIN_MIN`, and
   * another panel open next to it — the record and the copilot together — keeps its own.
   */
  const room = useCallback((): number => {
    const self = aside.current
    const parent = self?.parentElement
    if (self === null || parent === null || parent === undefined) return Number.POSITIVE_INFINITY
    let others = 0
    for (const child of Array.from(parent.children)) {
      if (child !== self && child.tagName === 'ASIDE') others += child.getBoundingClientRect().width
    }
    return parent.getBoundingClientRect().width - others - MAIN_MIN
  }, [])

  const apply = useCallback(
    (next: number, limit: number) => resize(panel, Math.min(next, limit)),
    [panel, resize],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const handle = e.currentTarget
      handle.setPointerCapture(e.pointerId)
      // The width as DRAWN, which the window may have narrowed below the stored one, and
      // measured from the origin rather than step by step: a dropped event must not drift.
      const start = aside.current?.getBoundingClientRect().width ?? width
      const limit = room()
      const origin = e.clientX
      // The whole page takes the resize cursor and stops selecting text while it lasts:
      // the pointer leaves the thin handle on the first move.
      const body = document.body.style
      const previous = { cursor: body.cursor, userSelect: body.userSelect }
      body.cursor = 'col-resize'
      body.userSelect = 'none'

      // Dragged LEFT, the panel grows: its left edge is the one that moves.
      const move = (ev: PointerEvent) => apply(start - (ev.clientX - origin), limit)
      const up = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', up)
        handle.removeEventListener('pointercancel', up)
        body.cursor = previous.cursor
        body.userSelect = previous.userSelect
        persist()
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', up)
      handle.addEventListener('pointercancel', up)
    },
    [width, room, apply, persist],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? STEP * 4 : STEP
    const drawn = aside.current?.getBoundingClientRect().width ?? width
    if (e.key === 'ArrowLeft') apply(drawn + step, room())
    else if (e.key === 'ArrowRight') apply(drawn - step, room())
    else if (e.key === 'Home') resize(panel, PANEL_MIN)
    else if (e.key === 'Enter') reset(panel)
    else return
    e.preventDefault()
    persist()
  }

  return (
    <aside
      ref={aside}
      className={cn('relative flex shrink-0 flex-col border-l', className)}
      // `100%` is the working area around the panel: a width stored in a wider window
      // gives way here rather than squeezing the grid.
      style={{ width, minWidth: PANEL_MIN, maxWidth: `calc(100% - ${MAIN_MIN}px)` }}
    >
      {/* The focusable window splitter of the ARIA Authoring Practices. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionner ${label}`}
        aria-valuenow={width}
        aria-valuemin={PANEL_MIN}
        tabIndex={0}
        title="Glisser pour redimensionner — double-clic : largeur par défaut"
        onPointerDown={onPointerDown}
        onDoubleClick={() => reset(panel)}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 -left-[3px] z-30 w-1.5 cursor-col-resize outline-none transition-colors hover:bg-primary/40 focus-visible:bg-primary/60 active:bg-primary/60"
      />
      {children}
    </aside>
  )
}
