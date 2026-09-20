'use client'

import { EnumPicker, LinkPicker, type SearchLink } from '@/components/app/pickers'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { Field, LinkOption } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { Link2 } from 'lucide-react'
import { useState } from 'react'

/**
 * One cell — chapter 11 §2 and §3.
 *
 * A cell edits IN PLACE and writes on commit; the displayed value then falls back to the
 * server's, always. We never leave on screen a value the database refused — that is how
 * someone ends up believing a write happened.
 *
 * A field ABSENT from the response is masked for this reader, not empty: it was never
 * read, so there is nothing to show and nothing to write. The three dots say so, and the
 * cell offers no way in.
 */

export interface Row extends Record<string, unknown> {
  readonly _id: string
}

/** The row's height, in pixels. Read by the virtualizer, so it is a number, not a class. */
export const ROW_HEIGHT = 36

/** Types whose value is edited as plain text. The others carry their own control. */
const TEXTUAL = new Set(['short_text', 'long_text', 'number', 'date', 'datetime'])

/** True when this cell opens an editor on double-click rather than on a single one. */
export function isTextual(field: Field): boolean {
  return field.read_only !== true && TEXTUAL.has(field.kind)
}

interface CellProps {
  readonly row: Row
  readonly field: Field
  readonly options?: readonly LinkOption[]
  readonly onSearchLink: SearchLink
  readonly emphasis: boolean
  readonly editing: boolean
  readonly onStartEdit: () => void
  readonly onEndEdit: () => void
  readonly onCommit: (value: unknown) => Promise<void>
}

export function Cell({
  row,
  field,
  options,
  onSearchLink,
  emphasis,
  editing,
  onStartEdit,
  onEndEdit,
  onCommit,
}: CellProps) {
  const present = Object.hasOwn(row, field.name)
  const value = row[field.name]

  if (!present) {
    return (
      <span
        className="flex w-full items-center px-2 text-muted-foreground/60"
        title="Champ masqué : il n’a pas été lu, donc il n’est pas ici."
      >
        ···
      </span>
    )
  }

  if (field.kind === 'long_text') {
    // Chapter 11 §1.1: a long-text column shows a binary "renseigné / vide" indicator,
    // never an excerpt — an excerpt would require reading the value, and reading it is
    // what triggers TOAST.
    //
    // HALF DONE, and the half that is missing is the server's: §1.1 also says such a
    // column is never PROJECTED in a list, so the response should carry a presence flag
    // rather than the text. It currently carries the text, and this cell declines to
    // display it. The screen is therefore right and the wire is not; excluding the
    // column from the projection belongs to `buildPlan`.
    const filled = value === true || (typeof value === 'string' && value !== '')
    return (
      <span className="flex w-full items-center gap-1.5 px-2 text-xs">
        <span className={cn('size-1.5 rounded-full', filled ? 'bg-primary' : 'bg-border')} />
        <span className="text-muted-foreground">{filled ? 'Renseigné' : 'Vide'}</span>
      </span>
    )
  }

  if (field.kind === 'link') {
    const link = value as { id: string | null; display: string | null } | null
    if (options === undefined) {
      return (
        <span className="flex w-full items-center px-2">
          {link?.id == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <Link2 className="size-3" />
              {link.display ?? link.id.slice(0, 8)}
            </Badge>
          )}
        </span>
      )
    }
    return (
      <span className="flex w-full items-center px-1">
        <LinkPicker
          field={field}
          value={link?.id ?? null}
          display={link?.display ?? null}
          options={options}
          onSearch={onSearchLink}
          onChange={(next) => void onCommit(next)}
          appearance="cell"
        />
      </span>
    )
  }

  if (field.kind === 'boolean') {
    return (
      <span className="flex w-full items-center px-2">
        <Checkbox
          checked={value === true}
          disabled={field.read_only === true}
          onCheckedChange={(next) => void onCommit(next === true)}
          aria-label={field.label}
        />
      </span>
    )
  }

  if (field.kind === 'select' && field.options !== undefined) {
    return (
      <span className="flex w-full items-center px-1">
        <EnumPicker
          field={field}
          value={typeof value === 'string' && value !== '' ? value : null}
          onChange={(next) => void onCommit(next)}
          appearance="cell"
        />
      </span>
    )
  }

  const initial = value === null || value === undefined ? '' : String(value)

  if (editing) {
    return (
      <TextEditor
        initial={initial}
        field={field}
        onCancel={onEndEdit}
        onCommit={async (next) => {
          onEndEdit()
          if (next === initial) return
          await onCommit(next === '' ? null : convert(next, field))
        }}
      />
    )
  }

  return (
    <button
      type="button"
      // A single click selects — the grid's mousedown handler does that. The editor is
      // opened by a double click, which is the spreadsheet convention and the only way
      // to keep click-drag selection usable on a text column.
      onDoubleClick={() => {
        if (isTextual(field)) onStartEdit()
      }}
      tabIndex={-1}
      className={cn(
        'w-full truncate px-2 text-left',
        emphasis && 'font-medium',
        field.kind === 'number' && 'text-right tabular-nums',
        initial === '' && 'text-muted-foreground',
      )}
    >
      {initial === '' ? '—' : display(initial, field)}
    </button>
  )
}

function TextEditor({
  initial,
  field,
  onCommit,
  onCancel,
}: {
  readonly initial: string
  readonly field: Field
  readonly onCommit: (value: string) => Promise<void>
  readonly onCancel: () => void
}) {
  const [typed, setTyped] = useState(initial)

  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: the editor was opened by a double click, and the caret belongs where the click landed
      autoFocus
      value={typed}
      onChange={(e) => setTyped(e.target.value)}
      onBlur={() => void onCommit(typed)}
      onKeyDown={(e) => {
        // The keys are stopped here: the grid listens on `window` for navigation, and an
        // arrow pressed inside an input means "move the caret", not "move the cursor".
        e.stopPropagation()
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          void onCommit(typed)
        }
        if (e.key === 'Escape') onCancel()
      }}
      className="size-full bg-background px-2 text-xs outline-none"
      aria-label={field.label}
    />
  )
}

/** How a stored value reads on screen. */
export function display(raw: string, field: Field): string {
  if (field.kind === 'number') {
    // Numbers arrive as decimal strings, without exception: `1234.5600000000` is what
    // the column holds, and trailing zeros are noise to a reader.
    return raw.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  }
  if (field.kind === 'datetime') {
    const parsed = Date.parse(raw)
    return Number.isNaN(parsed) ? raw : new Date(parsed).toLocaleString('fr-FR')
  }
  return raw
}

/** Converts what was typed into what the field's type expects. */
export function convert(typed: string, field: Field): unknown {
  if (field.kind === 'number') {
    const parsed = Number(typed.replace(',', '.'))
    // A refusal belongs to the server, which knows the column: sending the text through
    // gets the real error rather than a guess made here.
    return Number.isFinite(parsed) ? parsed : typed
  }
  if (field.kind === 'boolean') return typed === 'true' || typed === 'oui'
  return typed
}

/** The raw text of a cell, for the clipboard and for the exports. */
export function rawText(row: Row, field: Field): string {
  const value = row[field.name]
  if (value === null || value === undefined) return ''
  if (field.kind === 'link') {
    const link = value as { id: string | null; display: string | null }
    return link.display ?? link.id ?? ''
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
