'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { type Row, display } from '@/components/app/grid/cell'
import { markdownExcerpt, urlLabel } from '@/components/app/markdown-text'
import { OptionBadge } from '@/components/app/option-badge'
import { ChoiceChips, choicesOf } from '@/components/app/pickers'
import { type Field, fileHref, filesOf } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { Check, Paperclip } from 'lucide-react'
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
  if (value === null || value === undefined || value === '') return 'Sans titre'
  if (title.kind === 'link') {
    const link = value as { display?: string | null; id?: string | null }
    return link.display ?? link.id?.slice(0, 8) ?? 'Sans titre'
  }
  if (title.kind === 'select') {
    return title.options?.find((o) => o.value === value)?.label ?? String(value)
  }
  if (title.kind === 'long_text') return markdownExcerpt(String(value), 120)
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
export function CardValue({ field, row }: { readonly field: Field; readonly row: Row }) {
  const value = row[field.name]
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
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
        <Check className="size-3.5 text-primary" aria-label="Oui" />
      ) : (
        <span className="text-muted-foreground">Non</span>
      )
    case 'link': {
      const link = value as { display?: string | null; id?: string | null }
      return <span className="truncate">{link.display ?? link.id?.slice(0, 8) ?? '—'}</span>
    }
    case 'file':
    case 'image': {
      const files = filesOf(value)
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Paperclip className="size-3" />
          {files.length} fichier{files.length > 1 ? 's' : ''}
        </span>
      )
    }
    case 'long_text':
      return <span className="line-clamp-2">{markdownExcerpt(String(value), 140)}</span>
    case 'url':
      return <span className="truncate text-primary">{urlLabel(String(value))}</span>
    default:
      return <span className="truncate">{display(String(value), field)}</span>
  }
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
            <FieldIcon kind={field.kind} className="size-3" />
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
  color,
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
  readonly color?: string | null
  readonly selected?: boolean
  readonly className?: string
  readonly style?: CSSProperties
  readonly onOpen?: () => void
  readonly children?: ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color' | 'title'>) {
  return (
    <div
      {...rest}
      // biome-ignore lint/a11y/useSemanticElements: a card holds block content — a cover, a list of values — which a <button> may not contain
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.()
      }}
      className={cn(
        // A hand: a click opens the row — and, on a board, a press drags it.
        'group/card relative cursor-pointer overflow-hidden rounded-lg border bg-card text-left shadow-xs outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40',
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
          className="h-28 w-full border-b object-cover"
        />
      )}
      <div className="px-3 py-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{titleOf(row, title)}</p>
        <CardFields row={row} fields={fields} />
        {children}
      </div>
    </div>
  )
}
