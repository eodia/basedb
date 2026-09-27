'use client'

import { FieldButton } from '@/components/app/field-button'
import { FieldIcon } from '@/components/app/field-icon'
import { type Row, display, rawText } from '@/components/app/grid/cell'
import { longTextExcerpt, urlLabel } from '@/components/app/markdown-text'
import { OptionBadge } from '@/components/app/option-badge'
import { ChoiceChips, LinkChips, choicesOf, linksOf } from '@/components/app/pickers'
import { BarcodeValue, ComputedList, RatingStars, UserValue } from '@/components/app/value-widgets'
import { type Field, type Member, fileHref, filesOf } from '@/lib/api/client'
import { parseTemplate } from '@/lib/card-template'
import { shownField } from '@/lib/computed'
import { formatOf } from '@/lib/format'
import { $t, $tp } from '@/lib/i18n'
import { memberName, useMembers } from '@/lib/members'
import { cn } from '@/lib/utils'
import { Check, ImageOff, Paperclip } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

/**
 * A row as a card — what a kanban column, a calendar day and a timeline bar show.
 *
 * Compact on purpose: a title, then a few values each on its line, read-only. Editing is
 * the detail panel's, which a click opens; a card that took typing would fight the drag.
 */

/** The row's name on a card: its title field, else the beginning of its identifier. */
export function titleOf(row: Row, title: Field | null): string {
  if (title === null) return row._id.slice(0, 8)
  const value = row[title.name]
  if (value === null || value === undefined || value === '') return $t('Sans titre')
  if (title.kind === 'link') {
    const link = value as { display?: string | null; id?: string | null }
    return link.display ?? link.id?.slice(0, 8) ?? $t('Sans titre')
  }
  if (title.kind === 'multi_link') {
    const names = linksOf(value).map((l) => l.display ?? l.id?.slice(0, 8) ?? '…')
    return names.length === 0 ? $t('Sans titre') : names.join(', ')
  }
  if (title.kind === 'select') {
    return title.options?.find((o) => o.value === value)?.label ?? String(value)
  }
  if (title.kind === 'long_text') return longTextExcerpt(String(value), title, 120)
  return display(String(value), title)
}

/** The colour of a row, taken from the choice it carries in `field` — or none. */
export function colorOf(row: Row, field: Field | null): string | null {
  if (field === null) return null
  const value = row[field.name]
  return field.options?.find((o) => o.value === value)?.color ?? null
}

/** A cover picture: the first image of the field, when there is one. */
export function coverOf(row: Row, field: Field | null): string | null {
  if (field === null) return null
  const picture = filesOf(row[field.name]).find((f) => f.type.startsWith('image/') && f.url)
  return picture?.url === undefined ? null : fileHref(picture.url)
}

/** One value, as small as it can be read. */
export function CardValue({ field: given, row }: { readonly field: Field; readonly row: Row }) {
  if (given.kind === 'button') return <FieldButton field={given} row={row} size="xs" />
  const field = shownField(given)
  const value = row[field.name]
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }
  // The values a lookup reached through several rows, in their order.
  if (given.computed?.multiple === true) {
    return (
      <ComputedList
        values={Array.isArray(value) ? value : []}
        field={field}
        text={(v) => (v === null || v === undefined ? '' : display(String(v), field))}
      />
    )
  }
  switch (field.kind) {
    case 'select': {
      const option = field.options?.find((o) => o.value === value)
      return <OptionBadge option={option ?? { label: String(value) }} />
    }
    case 'multi_select':
      return <ChoiceChips field={field} values={choicesOf(value)} />
    case 'boolean':
      return value === true ? (
        <Check className="size-3.5 text-primary" aria-label={$t('Oui')} />
      ) : (
        <span className="text-muted-foreground">{$t('Non')}</span>
      )
    case 'link': {
      const link = value as { display?: string | null; id?: string | null }
      return <span className="truncate">{link.display ?? link.id?.slice(0, 8) ?? '—'}</span>
    }
    case 'multi_link':
      return <LinkChips values={linksOf(value)} />
    case 'file':
    case 'image': {
      const files = filesOf(value)
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Paperclip className="size-3" />
          {$tp(files.length, '{count} fichier', '{count} fichiers')}
        </span>
      )
    }
    case 'long_text':
      return <span className="line-clamp-2">{longTextExcerpt(String(value), field, 140)}</span>
    case 'url':
      return <span className="truncate text-primary">{urlLabel(String(value))}</span>
    case 'email':
      return <span className="truncate text-primary">{String(value)}</span>
    case 'user':
      return <UserValue id={value} compact />
    case 'number':
      if (formatOf(field) === 'rating') {
        return <RatingStars value={value} max={field.format?.rating_max ?? 5} />
      }
      return <span className="truncate">{display(String(value), field)}</span>
    case 'short_text':
      if (formatOf(field) === 'barcode') return <BarcodeValue value={String(value)} />
      return <span className="truncate">{display(String(value), field)}</span>
    default:
      return <span className="truncate">{display(String(value), field)}</span>
  }
}

/**
 * A value as it reads inside a sentence — its text, no widget: the label of a choice, the
 * name of a person, a date in the reader's order. Empty when the row has none.
 */
export function valueText(row: Row, given: Field, members: readonly Member[]): string {
  const field = shownField(given)
  const value = row[field.name]
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value) && given.computed?.multiple === true) {
    return value
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map((v) => display(String(v), field))
      .join(', ')
  }
  switch (field.kind) {
    case 'select':
      return field.options?.find((o) => o.value === value)?.label ?? String(value)
    case 'boolean':
      return value === true ? $t('Oui') : $t('Non')
    case 'user':
      return memberName(members, value)
    case 'long_text':
      return longTextExcerpt(String(value), field, 140)
    case 'url':
      return urlLabel(String(value))
    case 'link':
    case 'multi_link':
    case 'multi_select':
    case 'file':
    case 'image':
      return rawText(row, field)
    default:
      return display(String(value), field)
  }
}

/**
 * A card's description: its template, the row's values in place of the variables — set
 * apart, so the eye finds them in the sentence. A value the row does not have reads « — ».
 */
export function CardDescription({
  template,
  row,
  fields,
}: {
  readonly template: string
  /** Every field the reader sees: a variable may name any of them. */
  readonly fields: readonly Field[]
  readonly row: Row
}) {
  const members = useMembers()
  if (template.trim() === '') return null
  const parts = parseTemplate(template, fields)
  return (
    <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
      {parts.map((part, index) => {
        const key = `${index}`
        if (part.kind === 'text') return <span key={key}>{part.text}</span>
        if (part.kind === 'unknown') return <span key={key}>{`{{${part.raw}}}`}</span>
        const text = valueText(row, part.field, members)
        return (
          <span key={key} className={text === '' ? undefined : 'font-medium text-foreground'}>
            {text === '' ? '—' : text}
          </span>
        )
      })}
    </p>
  )
}

/** The values under a card's title, each introduced by its field's pictogram. */
export function CardFields({
  row,
  fields,
}: {
  readonly row: Row
  readonly fields: readonly Field[]
}) {
  if (fields.length === 0) return null
  return (
    <dl className="mt-1.5 space-y-1">
      {fields.map((field) => (
        <div
          key={field.name}
          className="flex min-w-0 items-center gap-1.5 text-xs"
          title={field.label}
        >
          <dt className="shrink-0 text-muted-foreground">
            <FieldIcon kind={field.kind} format={field.format?.display} className="size-3" />
            <span className="sr-only">{field.label}</span>
          </dt>
          <dd className="flex min-w-0 flex-1 items-center">
            <CardValue field={field} row={row} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A card: cover, coloured edge, title and values. The frame of every card-shaped view. */
export function RecordCard({
  row,
  title,
  fields,
  cover,
  coverClassName,
  coverPlaceholder = false,
  color,
  description,
  selected = false,
  className,
  style,
  onOpen,
  children,
  ...rest
}: {
  readonly row: Row
  readonly title: Field | null
  readonly fields: readonly Field[]
  readonly cover?: string | null
  /** A gallery's cover: taller, cropped or whole (ch. 11 §1.6). */
  readonly coverClassName?: string
  /** Keeps the cover's place when the row has no image, so the cards stay aligned. */
  readonly coverPlaceholder?: boolean
  readonly color?: string | null
  /** Under the title, before the values: a kanban's description (`CardDescription`). */
  readonly description?: ReactNode
  readonly selected?: boolean
  readonly className?: string
  readonly style?: CSSProperties
  readonly onOpen?: () => void
  readonly children?: ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color' | 'title'>) {
  return (
    <div
      {...rest}
      // A card that opens nothing — a shared view's, read only — is no button.
      role={onOpen === undefined ? undefined : 'button'}
      tabIndex={onOpen === undefined ? undefined : 0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.()
      }}
      className={cn(
        'group/card relative overflow-hidden rounded-lg border bg-card text-left shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40',
        // A hand: a click opens the row — and, on a board, a press drags it.
        onOpen !== undefined && 'cursor-pointer hover:shadow-md',
        selected && 'ring-2 ring-primary',
        className,
      )}
      style={style}
    >
      {color !== null && color !== undefined && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: color }}
        />
      )}
      {cover !== null && cover !== undefined && (
        <img
          src={cover}
          alt=""
          loading="lazy"
          draggable={false}
          className={cn('h-28 w-full border-b object-cover', coverClassName)}
        />
      )}
      {(cover === null || cover === undefined) && coverPlaceholder && (
        <div
          aria-hidden
          className={cn(
            'flex h-28 w-full items-center justify-center border-b bg-muted/50 text-muted-foreground',
            coverClassName,
          )}
        >
          <ImageOff className="size-5" />
        </div>
      )}
      <div className="px-3 py-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{titleOf(row, title)}</p>
        {description}
        <CardFields row={row} fields={fields} />
        {children}
      </div>
    </div>
  )
}
