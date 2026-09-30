import { withBase } from '@/lib/base-path'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** The brand's monogram, matching the surrounding navigation icons. */
export function BrandIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="12 12 40 40"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('size-5 shrink-0', className)}
    >
      <path
        fillRule="evenodd"
        d="M16 12h8v14h12c8.4 0 14 5.5 14 13s-5.6 13-14 13H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Zm8 23v8h12c2.6 0 4-1.5 4-4s-1.4-4-4-4H24Z"
      />
      <rect x="32" y="12" width="18" height="8" rx="4" />
    </svg>
  )
}

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
        src={withBase(`/brand/mark${tone === 'light' ? '-light' : ''}.svg`)}
        width={size}
        height={size}
        alt=""
        className="shrink-0"
      />
      {!compact && (
        <span className="font-bold tracking-[-0.045em]" translate="no">
          {$t('basedb')}
        </span>
      )}
    </span>
  )
}
