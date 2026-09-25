'use client'

import { optionIcon } from '@/lib/option-icons'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'

/**
 * How a choice of a list looks: a colour of any hue, and either a pictogram or a picture.
 *
 * The keys are read with `?? null` because the catalog may be served by an API older than
 * this screen, whose options carry only a value and a label. That is a plain option, not
 * one with an `undefined` colour to trip over.
 */
export interface OptionLook {
  readonly color?: string | null
  readonly icon?: string | null
  readonly image?: string | null
}

export const hasLook = (option: OptionLook) =>
  (option.color ?? null) !== null ||
  (option.icon ?? null) !== null ||
  (option.image ?? null) !== null

/**
 * The pictogram, the picture, or — with a colour and nothing else — a dot.
 *
 * A pictogram this build does not know draws nothing rather than a placeholder: the name
 * survives in the catalog, and a list pasted from elsewhere is not broken by it.
 */
export function OptionGlyph({
  look,
  className,
}: {
  readonly look: OptionLook
  readonly className?: string
}) {
  const image = look.image ?? null
  const color = look.color ?? null
  if (image !== null) {
    // A plain <img>: a data URL or an arbitrary host leaves nothing for an image optimiser.
    return (
      <img
        src={image}
        alt=""
        draggable={false}
        className={cn('size-4 shrink-0 rounded-sm object-cover', className)}
      />
    )
  }

  const icon = optionIcon(look.icon)
  if (icon !== undefined) {
    return (
      <icon.Icon
        aria-hidden
        className={cn('size-3.5 shrink-0', className)}
        style={color === null ? undefined : { color }}
      />
    )
  }

  if (color !== null) {
    return (
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-full', className)}
        style={{ backgroundColor: color }}
      />
    )
  }
  return null
}

/**
 * A base or a table as the navigation draws it: its picture, else its pictogram, else the
 * glyph of its kind — a pictogram and a kind's glyph both wearing the colour, when there is
 * one. Unlike `OptionGlyph`, it never draws nothing: a line of the tree needs an icon.
 */
export function LookIcon({
  look,
  fallback: Fallback,
  className,
}: {
  readonly look: OptionLook
  readonly fallback: LucideIcon
  readonly className?: string
}) {
  const image = look.image ?? null
  if (image !== null) {
    return (
      <img
        src={image}
        alt=""
        draggable={false}
        className={cn('size-4 shrink-0 rounded-sm object-cover', className)}
      />
    )
  }
  const color = look.color ?? null
  const Icon = optionIcon(look.icon)?.Icon ?? Fallback
  const style: CSSProperties | undefined = color === null ? undefined : { color }
  return <Icon aria-hidden className={cn('size-4 shrink-0', className)} style={style} />
}

/**
 * A choice as a chip.
 *
 * With a colour, the chip is that colour at 14 % over the surface and its text is the colour
 * mixed into the foreground: whatever hue was picked — a pale yellow included — the text
 * stays readable, in light and in dark, without anyone computing a contrast.
 */
export function OptionBadge({
  option,
  className,
}: {
  readonly option: OptionLook & { readonly label: string }
  readonly className?: string
}) {
  const color = option.color ?? null
  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-normal leading-tight',
        color === null && 'bg-secondary text-secondary-foreground',
        className,
      )}
      style={
        color === null
          ? undefined
          : {
              backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
              color: `color-mix(in oklab, ${color} 65%, var(--foreground))`,
            }
      }
    >
      <OptionGlyph look={option} />
      <span className="truncate">{option.label}</span>
    </span>
  )
}
