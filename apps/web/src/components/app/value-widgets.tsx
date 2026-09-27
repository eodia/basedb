'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import type { Field } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { memberName, useMembers } from '@/lib/members'
import { cn } from '@/lib/utils'
import { Mail, Phone, ScanBarcode, Star } from 'lucide-react'

/**
 * The values that are drawn rather than written — chapter 04 §2.10, §2.11: a rating as
 * stars, a person as a name and a face, an address or a phone number as something one can
 * click. Shared by the grid, the panel and the cards, so a value reads the same everywhere.
 */

export function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/**
 * Stars out of `max`. Clicking a star sets the rating to it; clicking the one already set
 * clears it — the way to say « pas noté ». Read-only without `onChange`.
 */
export function RatingStars({
  value,
  max,
  onChange,
  size = 'sm',
  label,
}: {
  readonly value: unknown
  readonly max: number
  readonly onChange?: (value: number | null) => void
  readonly size?: 'sm' | 'md'
  readonly label?: string
}) {
  const n = Number(value)
  const current = Number.isFinite(n) && value !== null && value !== '' ? Math.round(n) : 0
  const star = size === 'md' ? 'size-5' : 'size-3.5'
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role={onChange === undefined ? 'img' : 'group'}
      aria-label={$t('{value} : {current} sur {max}', { value: label ?? 'Note', current, max })}
    >
      {Array.from({ length: max }, (_, i) => {
        const on = i < current
        const glyph = (
          <Star
            className={cn(star, on ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
          />
        )
        if (onChange === undefined) {
          // biome-ignore lint/suspicious/noArrayIndexKey: a star IS its rank
          return <span key={i}>{glyph}</span>
        }
        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: a star IS its rank
            key={i}
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onChange(i + 1 === current ? null : i + 1)
            }}
            className="rounded-sm transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={$t('{value} sur {max}', { value: i + 1, max })}
            aria-pressed={i + 1 === current}
          >
            {glyph}
          </button>
        )
      })}
    </span>
  )
}

/** A person, by name, with the initials of the name as a face. */
export function UserValue({
  id,
  compact = false,
}: { readonly id: unknown; readonly compact?: boolean }) {
  const members = useMembers()
  if (typeof id !== 'string' || id === '') return <span className="text-muted-foreground">—</span>
  const name = memberName(members, id)
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar className={compact ? 'size-4' : 'size-5'}>
        <AvatarFallback className="bg-primary/15 text-[9px] font-medium text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  )
}

/**
 * Choosing a person of the tenant. The list is the members'; a disabled account is offered
 * only when it is the one already chosen — rows keep saying who they were assigned to, but
 * nobody new is given to someone who has left.
 */
export function UserPicker({
  field,
  value,
  onChange,
  appearance,
}: {
  readonly field: Field
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly appearance: 'cell' | 'form'
}) {
  const members = useMembers()
  const options: ComboboxOption[] = members
    .filter((m) => !m.disabled || m.id === value)
    .map((m) => ({
      value: m.id,
      label: m.display_name || m.email,
      render: <UserValue id={m.id} compact />,
    }))
  return (
    <Combobox
      value={value}
      onValueChange={onChange}
      options={options}
      clearLabel={field.required === true ? undefined : $t('Personne')}
      searchPlaceholder={$t('Rechercher une personne…')}
      className={
        appearance === 'cell'
          ? 'h-7 border-transparent bg-transparent px-1.5 text-xs shadow-none hover:bg-muted [&>svg]:opacity-0 group-hover/row:[&>svg]:opacity-50 data-[state=open]:[&>svg]:opacity-100'
          : ''
      }
      aria-label={field.label}
    >
      {value === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <UserValue id={value} compact={appearance === 'cell'} />
      )}
    </Combobox>
  )
}

/** An address or a number one reaches in a click: `mailto:` or `tel:`. */
export function ContactLink({
  kind,
  value,
  className,
}: {
  readonly kind: 'email' | 'phone'
  readonly value: string
  readonly className?: string
}) {
  const Icon = kind === 'email' ? Mail : Phone
  // A phone number keeps its digits and its leading `+`: spaces and dots are for reading.
  const href = kind === 'email' ? `mailto:${value}` : `tel:${value.replace(/[^\d+]/g, '')}`
  return (
    <a
      href={href}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-primary hover:underline',
        className,
      )}
      title={value}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{value}</span>
    </a>
  )
}

/** A code, as a scanner reads it: fixed-width, whole, to be copied. */
export function BarcodeValue({ value }: { readonly value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-mono" title={value}>
      <ScanBarcode className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </span>
  )
}

/**
 * The values a lookup reached through several rows — chapter 04 §7 ter — as chips, in the
 * order of the rows: a choice with its label, a number with its format, a date read day
 * first. `text` turns one value into what it reads as, the way the field's own cell does.
 */
export function ComputedList({
  values,
  field,
  text,
  wrap = false,
}: {
  readonly values: readonly unknown[]
  readonly field: Field
  readonly text: (value: unknown) => string
  readonly wrap?: boolean
}) {
  if (values.length === 0) return <span className="text-muted-foreground">—</span>
  const shown = wrap ? values : values.slice(0, 3)
  return (
    <span className={cn('flex min-w-0 items-center gap-1', wrap ? 'flex-wrap' : 'overflow-hidden')}>
      {shown.map((v, i) => {
        const option =
          field.kind === 'select' ? field.options?.find((o) => o.value === v) : undefined
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: two rows may read the same value
            key={i}
            className="inline-flex max-w-40 shrink-0 items-center truncate rounded-md bg-muted px-1.5 py-0.5 text-xs"
            style={option?.color ? { backgroundColor: `${option.color}24` } : undefined}
          >
            <span className="truncate">{option?.label ?? text(v)}</span>
          </span>
        )
      })}
      {values.length > shown.length && (
        <span className="shrink-0 text-xs text-muted-foreground">
          +{values.length - shown.length}
        </span>
      )}
    </span>
  )
}
