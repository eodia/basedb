'use client'

import { Input } from '@/components/ui/input'
import { Hint } from '@/components/ui/tooltip'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { type ReactNode, useEffect, useId, useState } from 'react'

/**
 * The small controls of the template editor: a choice among a few shown side by side, a
 * labelled setting, a colour among swatches or typed.
 */

export interface SegmentOption<T extends string | number> {
  readonly value: T
  readonly label: string
  /** Shown instead of the label, which then names it for a screen reader and a tooltip. */
  readonly icon?: ReactNode
}

/** A choice among two to five, all in sight: a row of buttons, one pressed. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  className,
}: {
  readonly value: T
  readonly onChange: (next: T) => void
  readonly options: readonly SegmentOption<T>[]
  readonly 'aria-label': string
  readonly className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex max-w-full flex-wrap rounded-md bg-muted p-0.5', className)}
    >
      {options.map((o) => {
        const button = (
          <button
            key={String(o.value)}
            type="button"
            // biome-ignore lint/a11y/useSemanticElements: a segmented control, the ARIA radio pattern
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.icon === undefined ? undefined : o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 min-w-7 items-center justify-center gap-1 whitespace-nowrap rounded px-2.5 text-xs font-medium text-muted-foreground transition-colors',
              'focus-visible:outline-2 focus-visible:outline-ring',
              value === o.value
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'hover:text-foreground',
            )}
          >
            {o.icon ?? o.label}
          </button>
        )
        return o.icon === undefined ? (
          button
        ) : (
          <Hint key={String(o.value)} label={o.label}>
            {button}
          </Hint>
        )
      })}
    </div>
  )
}

/** A setting: its name above, what sets it below, a line of help under it. */
export function Setting({
  label,
  hint,
  children,
  className,
}: {
  readonly label: string
  readonly hint?: string
  readonly children: (id: string) => ReactNode
  readonly className?: string
}) {
  const id = useId()
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children(id)}
      {hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A titled group of settings in a panel. */
export function Section({
  title,
  description,
  children,
}: {
  readonly title: string
  readonly description?: string
  readonly children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description !== undefined && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

const HEX = /^#[0-9a-f]{6}$/i

/** A colour: one of the swatches, or any typed as `#rrggbb` or picked from the system's. */
export function ColorPicker({
  value,
  onChange,
  swatches,
  label,
  id,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly swatches: readonly string[]
  readonly label: string
  readonly id?: string
}) {
  // What is typed stays as typed until it is a colour.
  const [typed, setTyped] = useState(value)
  useEffect(() => setTyped(value), [value])
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {swatches.map((c) => (
        <Hint key={c} label={c}>
          <button
            type="button"
            onClick={() => onChange(c)}
            aria-label={$t('{label} : {color}', { label, color: c })}
            aria-pressed={value.toLowerCase() === c}
            className={cn(
              'flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110',
              value.toLowerCase() === c && 'ring-2 ring-ring',
            )}
            style={{ backgroundColor: c }}
          >
            {value.toLowerCase() === c && (
              <Check className="size-3.5 text-white mix-blend-difference" />
            )}
          </button>
        </Hint>
      ))}
      <div className="ml-1 flex items-center gap-1">
        <label
          className="relative size-6 cursor-pointer overflow-hidden rounded-full border"
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">{$t('Autre couleur')}</span>
          <input
            type="color"
            value={HEX.test(value) ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={id}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value)
            const next = e.target.value.trim()
            if (HEX.test(next)) onChange(next.toLowerCase())
          }}
          aria-label={label}
          spellCheck={false}
          className="h-7 w-24 font-mono text-xs"
        />
      </div>
    </div>
  )
}
