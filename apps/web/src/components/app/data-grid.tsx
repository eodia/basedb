'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Field, LinkOption } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ExternalLink, Link2, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'

/**
 * The grid — chapter 11 §1 and §2.
 *
 * A cell edits IN PLACE and writes on commit; the displayed value then falls back to the
 * server's, always. We never leave on screen a value the database refused — that is how
 * someone ends up believing a write happened.
 *
 * A field absent from the response is MASKED for this reader, not empty: it was never
 * read, so there is nothing to show and nothing to write.
 */

export interface Row extends Record<string, unknown> {
  readonly _id: string
}

interface Props {
  readonly fields: readonly Field[]
  readonly rows: readonly Row[]
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly selectedId: string | null
  readonly onSelect: (row: Row) => void
  readonly onCommit: (id: string, field: Field, value: unknown) => Promise<void>
  readonly onCreate: (values: Record<string, unknown>) => Promise<void>
  readonly onDelete: (id: string) => Promise<void>
  readonly busy: string | null
}

export function DataGrid({
  fields,
  rows,
  linkOptions,
  selectedId,
  onSelect,
  onCommit,
  onCreate,
  onDelete,
  busy,
}: Props) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)

  const toggle = useCallback((id: string) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const submitDraft = useCallback(async () => {
    const values: Record<string, unknown> = {}
    for (const field of fields) {
      const typed = draft[field.name]
      if (typed === undefined || typed === '') continue
      values[field.name] = convert(typed, field)
    }
    if (Object.keys(values).length === 0) return
    setAdding(true)
    try {
      await onCreate(values)
      setDraft({})
    } finally {
      setAdding(false)
    }
  }, [draft, fields, onCreate])

  return (
    <div className="min-h-0 flex-1 overflow-auto scroll-discret">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="sticky left-0 z-20 w-10 border-b bg-background px-3 py-0">
              <span className="sr-only">{$t('Sélection')}</span>
            </th>
            {fields.map((field, index) => (
              <th
                key={field.name}
                className={cn(
                  'min-w-40 border-b border-l bg-background px-3 py-0 text-left font-normal',
                  // The first column stays put while the rest scrolls: a row one cannot
                  // name is a row one cannot act on.
                  index === 0 && 'sticky left-10 z-20 border-l-0',
                )}
              >
                <span className="flex h-10 items-center gap-2">
                  <FieldIcon kind={field.kind} />
                  <span className="truncate font-medium">{field.label}</span>
                </span>
              </th>
            ))}
            <th className="w-12 border-b border-l bg-background px-2 py-0">
              <span className="sr-only">{$t('Actions')}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const id = row._id
            const active = selectedId === id
            return (
              <tr
                key={id}
                className={cn(
                  'group bg-background transition-colors',
                  active ? 'bg-primary/5' : 'hover:bg-muted/50',
                  busy === id && 'opacity-50',
                )}
              >
                <td className="sticky left-0 z-10 border-b bg-inherit px-3 py-0">
                  <span className="flex h-12 items-center">
                    <Checkbox
                      checked={checked.has(id)}
                      onCheckedChange={() => toggle(id)}
                      aria-label={$t('Sélectionner la ligne')}
                    />
                  </span>
                </td>

                {fields.map((field, index) => (
                  <td
                    key={field.name}
                    className={cn(
                      'border-b border-l px-0 py-0',
                      index === 0 && 'sticky left-10 z-10 border-l-0 bg-inherit',
                      // The open row is marked on its first cell, where the eye already
                      // is, rather than by a tint the grid lines would swallow.
                      active && index === 0 && 'ring-2 ring-primary ring-inset',
                      index > 0 && 'relative',
                    )}
                  >
                    <Cell
                      row={row}
                      field={field}
                      options={linkOptions[field.name]}
                      emphasis={index === 0}
                      active={active}
                      onOpen={() => onSelect(row)}
                      onCommit={(value) => onCommit(id, field, value)}
                    />
                  </td>
                ))}

                <td className="border-b border-l px-2 py-0">
                  <span className="flex h-12 items-center justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                          aria-label={$t('Actions sur la ligne')}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onSelect(row)}>
                          <ExternalLink className="size-4" />
                          {$t('Ouvrir la fiche')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void onDelete(id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          {$t('Supprimer')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </td>
              </tr>
            )
          })}

          {/* The new row lives in the grid, not behind a dialog: adding a line is the
              most frequent act there is, and a dialog would put a click in front of it. */}
          <tr className="group bg-background">
            <td className="sticky left-0 z-10 border-b bg-inherit px-3 py-0">
              <span className="flex h-12 items-center text-muted-foreground">
                <Plus className="size-4" />
              </span>
            </td>
            {fields.map((field, index) => (
              <td
                key={field.name}
                className={cn(
                  'border-b border-l px-0 py-0',
                  index === 0 && 'sticky left-10 z-10 border-l-0 bg-inherit',
                )}
              >
                <DraftCell
                  field={field}
                  options={linkOptions[field.name]}
                  value={draft[field.name] ?? ''}
                  placeholder={index === 0 ? $t('Ajouter un enregistrement') : field.label}
                  onChange={(value) => setDraft({ ...draft, [field.name]: value })}
                  onSubmit={submitDraft}
                />
              </td>
            ))}
            <td className="border-b border-l px-2 py-0">
              <span className="flex h-12 items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={submitDraft}
                  disabled={adding}
                  aria-label={$t('Enregistrer la ligne')}
                >
                  <Plus className="size-4" />
                </Button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Types whose value is edited as plain text. A `select` has its own control. */
const TEXTUAL = new Set(['short_text', 'long_text', 'number', 'date', 'datetime'])

function Cell({
  row,
  field,
  options,
  emphasis,
  active,
  onOpen,
  onCommit,
}: {
  readonly row: Row
  readonly field: Field
  readonly options?: readonly LinkOption[]
  readonly emphasis: boolean
  readonly active: boolean
  readonly onOpen: () => void
  readonly onCommit: (value: unknown) => Promise<void>
}) {
  const present = Object.hasOwn(row, field.name)
  const value = row[field.name]

  // Masked for this reader: never read, so there is nothing to show and nothing to write.
  if (!present) {
    return (
      <span
        className="flex h-12 items-center px-3 text-muted-foreground"
        title={$t('Champ masqué')}
      >
        ···
      </span>
    )
  }

  if (field.kind === 'link') {
    const link = value as { id: string | null; display: string | null; masked?: boolean } | null
    if (options === undefined) {
      return (
        <span className="flex h-12 items-center px-3">
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
      <span className="flex h-12 items-center px-2">
        <Select
          value={link?.id ?? ''}
          onValueChange={(next) => void onCommit(next === '' ? null : next)}
        >
          <SelectTrigger
            className={cn(
              'h-8 border-transparent bg-transparent shadow-none hover:bg-muted',
              // The chevron is a control, not a decoration: it shows up when the pointer
              // is on the row, and stays out of the way of reading the rest of the time.
              '[&>svg]:opacity-0 group-hover:[&>svg]:opacity-50 data-[state=open]:[&>svg]:opacity-100',
            )}
          >
            <SelectValue placeholder="—">
              {link?.id == null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Badge variant="secondary" className="gap-1.5 font-normal">
                  <Link2 className="size-3" />
                  {link.display ?? link.id.slice(0, 8)}
                </Badge>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    )
  }

  if (field.kind === 'boolean') {
    return (
      <span className="flex h-12 items-center px-3">
        <Checkbox
          checked={value === true}
          onCheckedChange={(next) => void onCommit(next === true)}
          aria-label={field.label}
        />
      </span>
    )
  }

  if (field.kind === 'select' && field.options !== undefined) {
    const current = typeof value === 'string' ? value : ''
    const chosen = field.options.find((o) => o.value === current)
    return (
      <span className="flex h-12 items-center px-2">
        <Select value={current} onValueChange={(next) => void onCommit(next)}>
          <SelectTrigger
            className={cn(
              'h-8 border-transparent bg-transparent shadow-none hover:bg-muted',
              '[&>svg]:opacity-0 group-hover:[&>svg]:opacity-50 data-[state=open]:[&>svg]:opacity-100',
            )}
          >
            <SelectValue placeholder="—">
              {chosen === undefined ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Badge variant="secondary" className="gap-1.5 font-normal">
                  <span className="size-1.5 rounded-full bg-muted-foreground" />
                  {chosen.label}
                </Badge>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    )
  }

  return (
    <span className="relative flex h-12 items-center">
      {/* The first column doubles as the handle that opens the record: a row is opened
          by its name, which is where a reader's eye already is. */}
      {emphasis && (
        <button
          type="button"
          onClick={onOpen}
          className="absolute right-1 z-10 hidden size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-hover:flex"
          aria-label={$t('Ouvrir la fiche')}
        >
          <ExternalLink className="size-3.5" />
        </button>
      )}
      <EditableText
        value={value}
        field={field}
        emphasis={emphasis}
        active={active}
        onCommit={onCommit}
      />
    </span>
  )
}

function EditableText({
  value,
  field,
  emphasis,
  active,
  onCommit,
}: {
  readonly value: unknown
  readonly field: Field
  readonly emphasis: boolean
  readonly active: boolean
  readonly onCommit: (value: unknown) => Promise<void>
}) {
  const initial = value === null || value === undefined ? '' : String(value)
  const [typed, setTyped] = useState(initial)
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setTyped(initial)
          setEditing(true)
        }}
        disabled={field.read_only === true || !TEXTUAL.has(field.kind)}
        className={cn(
          'h-12 w-full truncate px-3 text-left transition-colors disabled:cursor-default',
          emphasis && 'font-medium',
          field.kind === 'number' && 'text-right tabular-nums',
          initial === '' && 'text-muted-foreground',
        )}
      >
        {initial === '' ? '—' : display(initial, field)}
      </button>
    )
  }

  const commit = () => {
    setEditing(false)
    if (typed === initial) return
    void onCommit(typed === '' ? null : convert(typed, field))
  }

  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: the field was opened by a click, and the caret belongs where the click landed
      autoFocus
      value={typed}
      onChange={(e) => setTyped(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
      className={cn(
        'h-12 w-full bg-background px-3 outline-none ring-2 ring-primary ring-inset',
        active && 'bg-background',
      )}
      aria-label={field.label}
    />
  )
}

function DraftCell({
  field,
  options,
  value,
  placeholder,
  onChange,
  onSubmit,
}: {
  readonly field: Field
  readonly options?: readonly LinkOption[]
  readonly value: string
  readonly placeholder: string
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
}) {
  if (field.kind === 'link' && options !== undefined) {
    return (
      <span className="flex h-12 items-center px-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted">
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    )
  }

  if (field.kind === 'select' && field.options !== undefined) {
    return (
      <span className="flex h-12 items-center px-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted">
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    )
  }

  if (field.read_only === true || field.kind === 'link') {
    return <span className="flex h-12 items-center px-3 text-muted-foreground">—</span>
  }

  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit()
      }}
      className="h-12 w-full bg-transparent px-3 outline-none placeholder:text-muted-foreground focus:bg-background focus:ring-2 focus:ring-primary focus:ring-inset"
      aria-label={field.label}
    />
  )
}

/** How a stored value reads on screen. */
export function display(raw: string, field: Field): string {
  if (field.kind === 'number') {
    // Numbers arrive as decimal strings, without exception: `1234.5600000000` is what
    // the column holds, and trailing zeros are noise to a reader.
    const trimmed = raw.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    return trimmed
  }
  if (field.kind === 'datetime') {
    const parsed = Date.parse(raw)
    return Number.isNaN(parsed) ? raw : new Date(parsed).toLocaleString(intlLocale())
  }
  return raw
}

/** Converts what was typed into what the field's type expects. */
function convert(typed: string, field: Field): unknown {
  if (field.kind === 'number') {
    const parsed = Number(typed.replace(',', '.'))
    // A refusal belongs to the server, which knows the column: sending the text through
    // gets the real error rather than a guess made here.
    return Number.isFinite(parsed) ? parsed : typed
  }
  if (field.kind === 'boolean') return typed === 'true' || typed === 'oui'
  return typed
}
