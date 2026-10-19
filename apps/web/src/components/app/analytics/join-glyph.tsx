'use client'

import { cn } from '@/lib/utils'
import type { JoinKind } from '@basedb/contracts'
import { type ComponentType, useId } from 'react'

/**
 * How two tables meet, drawn as two overlapping circles — the source on the left, the joined
 * table on the right — with the rows kept filled in: the left one, the right one, those of
 * both (inner: the overlap only), or all.
 */
export function JoinGlyph({
  kind,
  className,
}: { readonly kind: JoinKind; readonly className?: string }) {
  const clip = `join-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox="0 0 34 22" className={cn('h-4 w-[26px] shrink-0', className)} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="12" cy="11" r="9" />
        </clipPath>
      </defs>
      <g className="fill-current" opacity="0.32">
        {kind === 'left' || kind === 'full' ? <circle cx="12" cy="11" r="9" /> : null}
        {kind === 'right' || kind === 'full' ? <circle cx="22" cy="11" r="9" /> : null}
        {kind === 'inner' ? <circle cx="22" cy="11" r="9" clipPath={`url(#${clip})`} /> : null}
      </g>
      <g fill="none" className="stroke-current" strokeWidth="1.6">
        <circle cx="12" cy="11" r="9" />
        <circle cx="22" cy="11" r="9" />
      </g>
    </svg>
  )
}

const pictogram =
  (kind: JoinKind) =>
  ({ className }: { className?: string }) => (
    <JoinGlyph kind={kind} className={cn(className, 'h-5 w-8')} />
  )

/** The glyphs as pictograms for `Segmented`: one component each, sized by its option. */
export const JOIN_PICTOGRAMS: Readonly<Record<JoinKind, ComponentType<{ className?: string }>>> = {
  left: pictogram('left'),
  inner: pictogram('inner'),
  right: pictogram('right'),
  full: pictogram('full'),
}
