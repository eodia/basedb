'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * The AI's mark, as insights draws it: a four-pointed star and its little sister, in the
 * copilot's violet gradient — the same mark on both sides of the integration.
 */
export function AiStar({
  size = 16,
  className,
}: {
  readonly size?: number
  readonly className?: string
}) {
  const id = useId()
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
    >
      <defs>
        <linearGradient id={id} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0abfc" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5-.7-5.6-4.9-9.8-10.5-10.5C7.1 11.3 11.3 7.1 12 1.5z"
      />
      <path
        fill={`url(#${id})`}
        d="M19.5 2c.25 1.6 1.4 2.75 3 3-1.6.25-2.75 1.4-3 3-.25-1.6-1.4-2.75-3-3 1.6-.25 2.75-1.4 3-3z"
      />
    </svg>
  )
}
