import { cn } from '@/lib/utils'

/** The wordmark inherits the application's font, including on the login screen. */
export function Brand({
  size = 28,
  tone = 'dark',
  compact = false,
  className,
}: {
  readonly size?: number
  readonly tone?: 'dark' | 'light'
  readonly compact?: boolean
  readonly className?: string
}) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-2.5 leading-none', className)}
      role={compact ? 'img' : undefined}
      aria-label={compact ? 'basedb' : undefined}
    >
      <img
        src={`/brand/mark${tone === 'light' ? '-light' : ''}.svg`}
        width={size}
        height={size}
        alt=""
        className="shrink-0"
      />
      {!compact && (
        <span className="font-bold tracking-[-0.045em]" translate="no">
          basedb
        </span>
      )}
    </span>
  )
}
