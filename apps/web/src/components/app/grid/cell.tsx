'use client'

import { AiEmpty } from '@/components/app/ai-pending'
import { DateInput } from '@/components/app/date-picker'
import { FieldButton } from '@/components/app/field-button'
import { FilesCell, type Upload } from '@/components/app/files'
import { LongTextCell, UrlLink, markdownExcerpt } from '@/components/app/markdown-text'
import {
  ChoiceChips,
  EnumPicker,
  LinkChips,
  LinkPicker,
  MultiEnumPicker,
  MultiLinkPicker,
  type SearchLink,
  choicesOf,
  linksOf,
} from '@/components/app/pickers'
import {
  BarcodeValue,
  ComputedList,
  ContactLink,
  RatingStars,
  UserPicker,
  UserValue,
} from '@/components/app/value-widgets'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { type Field, type LinkOption, filesOf } from '@/lib/api/client'
import { shownField } from '@/lib/computed'
import { type DateKind, displayStored, isDateKind, storedFromText } from '@/lib/dates'
import { editText, formatNumber, formatOf, parseNumberInput } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Link2 } from 'lucide-react'
import { useRef, useState } from 'react'

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
const TEXTUAL = new Set(['short_text', 'long_text', 'url', 'email', 'number', 'date', 'datetime'])

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
  /** Deposits files for a `file` or `image` cell. Absent, such a cell only shows its files. */
  readonly onUpload?: Upload
  /** Opens the row a link points at — Ctrl+click, or Cmd+click, on a link cell. */
  readonly onFollowLink?: (table: string, id: string) => void
}

/**
 * The modifier that follows a link rather than editing it: Ctrl, and Cmd on a Mac — the
 * gesture that opens a link elsewhere in every browser.
 */
export const followsLink = (e: { ctrlKey: boolean; metaKey: boolean }) => e.ctrlKey || e.metaKey

export function Cell({
  row,
  field: given,
  options,
  onSearchLink,
  emphasis,
  editing,
  onStartEdit,
  onEndEdit,
  onCommit,
  onUpload,
  onFollowLink,
}: CellProps) {
  // A computed field is drawn as the field its value is, read-only (chapter 04 §7 ter).
  const field = shownField(given)
  const present = Object.hasOwn(row, field.name)
  const value = row[field.name]

  if (given.computed?.multiple === true && present) {
    return (
      <span className="flex w-full min-w-0 items-center px-2">
        <ComputedList
          values={Array.isArray(value) ? value : []}
          field={field}
          text={(v) => (v === null || v === undefined ? '' : display(String(v), field))}
        />
      </span>
    )
  }

  // A button has no value: it is drawn, whatever the row holds (chapter 17 §4).
  if (given.kind === 'button') {
    return (
      <span className="flex w-full min-w-0 items-center px-2">
        <FieldButton field={given} row={row} size="xs" />
      </span>
    )
  }

  if (!present) {
    return (
      <span className="flex w-full items-center px-2 text-muted-foreground/60" title="Champ masqué">
        ···
      </span>
    )
  }

  if (field.ai === true) {
    // Written by the kernel alone, whatever the type: shown, never edited. Empty is not
    // computed YET — the next pass fills it — and says so, rather than a dash that reads as
    // "nothing".
    if (value === null || value === undefined || value === '') {
      return <AiEmpty value={value ?? null} appearance="cell" />
    }
    if (field.kind === 'select' || field.kind === 'multi_select') {
      return (
        <span className="flex w-full min-w-0 items-center px-2">
          <ChoiceChips field={field} values={choicesOf(value)} />
        </span>
      )
    }
    if (field.kind === 'url' && typeof value === 'string') {
      return (
        <span className="flex w-full min-w-0 items-center px-2">
          <UrlLink url={value} />
        </span>
      )
    }
    const text =
      field.kind === 'boolean'
        ? value === true
          ? 'Oui'
          : 'Non'
        : field.kind === 'long_text'
          ? markdownExcerpt(String(value))
          : display(String(value), field)
    return (
      <span
        className={cn(
          'block w-full truncate px-2',
          emphasis && 'font-medium',
          field.kind === 'number' && 'text-right tabular-nums',
        )}
        title={String(value)}
      >
        {text}
      </span>
    )
  }

  if (field.kind === 'long_text') {
    // Chapter 11 §1.1 used to show a bare "renseigné / vide" here, to spare the TOAST read.
    // The text is on the wire anyway, and a column one cannot read from the grid is one
    // nobody reads: one line of it, the whole of it rendered on hover, and an editor in
    // place on a double click.
    return (
      <LongTextCell
        value={value}
        label={field.label}
        readOnly={field.read_only === true}
        editing={editing}
        emphasis={emphasis}
        onStartEdit={onStartEdit}
        onEndEdit={onEndEdit}
        onCommit={(next) => onCommit(next)}
      />
    )
  }

  if (field.kind === 'link') {
    const link = value as { id: string | null; display: string | null } | null
    const target = field.link?.target
    const id = link?.id ?? null
    const followable = onFollowLink !== undefined && target !== undefined && id !== null
    // Caught on the way DOWN: the picker must not open, nor the grid move its selection,
    // for a click that means « take me there ».
    const intercept = followable
      ? {
          onPointerDownCapture: (e: React.PointerEvent) => {
            if (!followsLink(e)) return
            e.preventDefault()
            e.stopPropagation()
          },
          onMouseDownCapture: (e: React.MouseEvent) => {
            if (!followsLink(e)) return
            e.preventDefault()
            e.stopPropagation()
          },
          onClickCapture: (e: React.MouseEvent) => {
            if (!followsLink(e)) return
            e.preventDefault()
            e.stopPropagation()
            onFollowLink(target, id)
          },
          title: `Ctrl+clic : ouvrir « ${link?.display ?? id.slice(0, 8)} »`,
        }
      : {}
    if (options === undefined) {
      return (
        <span className="flex w-full items-center px-2" {...intercept}>
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
      <span className="flex w-full items-center px-1" {...intercept}>
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

  // Several rows of the target, chosen as a multiple choice is (chapter 04 §4 bis).
  if (field.kind === 'multi_link') {
    const links = linksOf(value)
    const target = field.link?.target
    const follow =
      onFollowLink === undefined || target === undefined
        ? undefined
        : (id: string) => onFollowLink(target, id)
    if (options === undefined) {
      return (
        <span className="flex w-full min-w-0 items-center px-2">
          <LinkChips values={links} onFollow={follow} />
        </span>
      )
    }
    return (
      <span className="flex w-full min-w-0 items-center px-1">
        <MultiLinkPicker
          field={field}
          value={links}
          options={options}
          onSearch={onSearchLink}
          onChange={(next) => void onCommit(next)}
          appearance="cell"
        />
      </span>
    )
  }

  if (field.kind === 'user') {
    const id = typeof value === 'string' && value !== '' ? value : null
    return (
      <span className="flex w-full min-w-0 items-center px-1">
        {field.read_only === true ? (
          <span className="px-1">
            <UserValue id={id} compact />
          </span>
        ) : (
          <UserPicker
            field={field}
            value={id}
            onChange={(next) => void onCommit(next)}
            appearance="cell"
          />
        )}
      </span>
    )
  }

  if (field.kind === 'number' && formatOf(field) === 'rating') {
    return (
      <span className="flex w-full items-center px-2">
        <RatingStars
          value={value}
          max={field.format?.rating_max ?? 5}
          label={field.label}
          onChange={field.read_only === true ? undefined : (next) => void onCommit(next)}
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

  if (field.kind === 'multi_select') {
    if (field.options === undefined || field.read_only === true) {
      return (
        <span className="flex w-full min-w-0 items-center px-2">
          <ChoiceChips field={field} values={choicesOf(value)} />
        </span>
      )
    }
    return (
      <span className="flex w-full min-w-0 items-center px-1">
        <MultiEnumPicker
          field={field}
          value={choicesOf(value)}
          onChange={(next) => void onCommit(next)}
          appearance="cell"
        />
      </span>
    )
  }

  if (field.kind === 'file' || field.kind === 'image') {
    return <FilesCell field={field} value={value} onUpload={onUpload} onCommit={onCommit} />
  }

  const initial = value === null || value === undefined ? '' : String(value)

  if (editing && isDateKind(field.kind)) {
    const shown = display(initial, field)
    return (
      <DateEditor
        initial={shown}
        kind={field.kind}
        field={field}
        onCancel={onEndEdit}
        onCommit={async (next) => {
          onEndEdit()
          if (next === shown) return
          await onCommit(next === '' ? null : convert(next, field))
        }}
      />
    )
  }

  if (editing) {
    const typed = editText(value, field)
    return (
      <TextEditor
        initial={typed}
        field={field}
        onCancel={onEndEdit}
        onCommit={async (next) => {
          onEndEdit()
          if (next === typed) return
          await onCommit(next === '' ? null : convert(next, field))
        }}
      />
    )
  }

  const format = formatOf(field)
  if ((field.kind === 'email' || format === 'phone') && initial !== '') {
    return (
      <span
        className="flex w-full min-w-0 items-center px-2"
        onDoubleClick={() => {
          if (isTextual(field)) onStartEdit()
        }}
      >
        <ContactLink kind={field.kind === 'email' ? 'email' : 'phone'} value={initial} />
      </span>
    )
  }
  if (format === 'barcode' && initial !== '') {
    return (
      <span
        className="flex w-full min-w-0 items-center px-2"
        onDoubleClick={() => {
          if (isTextual(field)) onStartEdit()
        }}
      >
        <BarcodeValue value={initial} />
      </span>
    )
  }

  if (field.kind === 'url' && initial !== '') {
    return (
      <span
        className="flex w-full min-w-0 items-center px-2"
        onDoubleClick={() => {
          if (isTextual(field)) onStartEdit()
        }}
      >
        <UrlLink url={initial} />
      </span>
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
        (field.kind === 'number' || field.kind === 'autonumber') && 'text-right tabular-nums',
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

/**
 * A `date` or `datetime` cell being edited: typed day first, or picked from the calendar
 * that opens under it.
 */
function DateEditor({
  initial,
  kind,
  field,
  onCommit,
  onCancel,
}: {
  readonly initial: string
  readonly kind: DateKind
  readonly field: Field
  readonly onCommit: (value: string) => Promise<void>
  readonly onCancel: () => void
}) {
  const [typed, setTyped] = useState(initial)
  // The editor ends at its first word: Enter, a day picked, a blur and the popup closing
  // can all say "done" for the same edit, and only one of them writes.
  const settled = useRef(false)
  const settle = (act: () => void) => {
    if (settled.current) return
    settled.current = true
    act()
  }

  return (
    <DateInput
      kind={kind}
      text={typed}
      onTextChange={setTyped}
      onCommit={(next) => settle(() => void onCommit(next))}
      onCancel={() => settle(onCancel)}
      onKeyDown={(e) => {
        // As in the text editor: the grid listens on `window`, and Tab ends the edit here.
        e.stopPropagation()
        if (e.key === 'Tab') {
          e.preventDefault()
          settle(() => void onCommit(typed))
        }
      }}
      appearance="cell"
      clearable={field.required !== true}
      autoFocus
      className="bg-background"
      aria-label={field.label}
    />
  )
}

/** How a stored value reads on screen. */
export function display(raw: string, field: Field): string {
  if (field.kind === 'number') {
    // A format — a currency, a percentage, a duration, stars — reads the number its way.
    if (formatOf(field) !== 'decimal') return formatNumber(raw, field)
    // Numbers arrive as decimal strings, without exception: `1234.5600000000` is what
    // the column holds, and trailing zeros are noise to a reader.
    return raw.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  }
  // Day first, as the field is typed: `25/09/2026`, `25/09/2026 14:30` in the reader's time.
  if (isDateKind(field.kind)) return displayStored(raw, field.kind)
  return raw
}

/** Converts what was typed into what the field's type expects. */
export function convert(typed: string, field: Field): unknown {
  if (field.kind === 'number') {
    // A duration typed `1:30`, an amount typed with its symbol and its French comma. A
    // refusal belongs to the server, which knows the column: what does not read as a
    // number goes through as typed, and gets the real error rather than a guess made here.
    return parseNumberInput(typed, field)
  }
  if (field.kind === 'boolean') return typed === 'true' || typed === 'oui'
  if (isDateKind(field.kind)) return storedFromText(typed, field.kind)
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
  if (field.kind === 'multi_link') {
    return linksOf(value)
      .filter((l) => l.masked !== true)
      .map((l) => l.display ?? l.id ?? '')
      .join(', ')
  }
  // What a person reads in the cell, as a spreadsheet would paste it back: the labels of
  // the choices, the names of the files.
  if (field.kind === 'multi_select') {
    return choicesOf(value)
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
      .join(', ')
  }
  if (field.kind === 'file' || field.kind === 'image') {
    return filesOf(value)
      .map((f) => f.name)
      .join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
