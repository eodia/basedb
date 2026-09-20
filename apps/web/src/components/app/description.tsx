'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DESCRIPTION_MAX } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

/**
 * The pieces every screen uses to write and to show a description.
 *
 * A description is the one sentence that says what a base, a table or a field is FOR. It
 * is read three times — by people in the generated documentation, by agents through the
 * catalog, and here — so the forms that design those objects all ask for it the same way,
 * and it is optional everywhere: an empty text is stored as "none", never as a blank.
 */

/** The counter stays out of the way until this few characters remain. */
const COUNTER_MARGIN = 200

/** What the server measures: the trimmed text. */
const lengthOf = (text: string) => text.trim().length

/** True when a form should refuse to send this text — the server would answer 422. */
export const isTooLong = (text: string) => lengthOf(text) > DESCRIPTION_MAX

/** A description worth showing: `null`, and a stray blank, both mean "none". */
export const hasDescription = (text: string | null | undefined): text is string =>
  text !== null && text !== undefined && text.trim() !== ''

/**
 * "412 / 1000", shown only near the limit.
 *
 * A counter on a box that is nearly always half empty is noise; the moment it is useful is
 * the moment it is close to being wrong, so that is the only moment it appears.
 */
function Counter({ text, className }: { readonly text: string; readonly className?: string }) {
  const length = lengthOf(text)
  if (length < DESCRIPTION_MAX - COUNTER_MARGIN) return null
  return (
    <span
      className={cn(
        'shrink-0 text-xs tabular-nums',
        length > DESCRIPTION_MAX ? 'font-medium text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {length} / {DESCRIPTION_MAX}
    </span>
  )
}

/**
 * The optional "Description" box of a creation or edition dialog.
 *
 * Enter adds a line, since a description may run over several; Ctrl+Entrée is what
 * submits, matching the inline editor below.
 */
export function DescriptionField({
  id,
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
}: {
  readonly id: string
  readonly value: string
  readonly onChange: (next: string) => void
  readonly onSubmit?: () => void
  readonly placeholder: string
  readonly disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {/* A fixed height, so the counter appearing does not nudge the box below it. */}
      <div className="flex h-4 items-center justify-between gap-2">
        <Label htmlFor={id}>
          Description <span className="font-normal opacity-70">(facultatif)</span>
        </Label>
        <Counter text={value} />
      </div>
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (onSubmit !== undefined && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={placeholder}
        aria-invalid={isTooLong(value) || undefined}
        className="max-h-48 min-h-20 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
      />
    </div>
  )
}

/** The state machine of one description being edited in place. */
export interface DescriptionEdit {
  readonly editing: boolean
  readonly draft: string
  readonly saving: boolean
  readonly error: string | null
  readonly begin: () => void
  readonly change: (next: string) => void
  readonly commit: () => void
  readonly cancel: () => void
}

/**
 * Editing a description in place: click, type, then Ctrl+Entrée or click away to save,
 * Échap to give up.
 *
 * `save` receives the trimmed text, or `null` when the box was emptied, and returns once
 * the screen has been refreshed — the box stays open until then, so what one reads next
 * is what the server holds and not the previous text for a frame. A refusal keeps the box
 * open with the server's own reason next to it: the text typed is never thrown away.
 */
export function useDescriptionEdit(
  value: string | null,
  save: (next: string | null) => Promise<void>,
): DescriptionEdit {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs rather than state: both are read by handlers that must see the latest value
  // synchronously. `closing` swallows the blur a textarea can raise while it is being
  // removed, which would otherwise save a second time — or save after an Échap.
  const closing = useRef(false)
  const inFlight = useRef(false)

  const begin = useCallback(() => {
    closing.current = false
    setDraft(value ?? '')
    setError(null)
    setEditing(true)
  }, [value])

  const cancel = useCallback(() => {
    if (inFlight.current) return
    closing.current = true
    setEditing(false)
    setError(null)
  }, [])

  const commit = useCallback(() => {
    if (inFlight.current || closing.current) return
    const text = draft.trim()
    const next = text === '' ? null : text

    // Nothing changed: close without a round trip. It is what makes clicking into the
    // box and out again free.
    if (next === (value ?? null)) {
      closing.current = true
      setEditing(false)
      return
    }

    inFlight.current = true
    setSaving(true)
    setError(null)
    save(next)
      .then(() => {
        closing.current = true
        setEditing(false)
      })
      .catch((e: unknown) => setError(messageFor(e)))
      .finally(() => {
        inFlight.current = false
        setSaving(false)
      })
  }, [draft, save, value])

  return {
    editing,
    draft,
    saving,
    error,
    begin,
    change: setDraft,
    commit,
    cancel,
  }
}

/** Shared by reading and editing, so opening the editor is not a jump in the text. */
const SIZES = { sm: 'text-xs leading-snug', md: 'text-sm leading-snug' } as const
const CLAMPS = { 2: 'line-clamp-2', 3: 'line-clamp-3' } as const

/**
 * From this length a description may be cut short by the clamp, so its native tooltip
 * carries the whole text. Below it the text is fully visible and the tooltip says what a
 * click does instead — repeating a sentence the reader is looking at is noise.
 */
const MAY_BE_CLAMPED = 120

/**
 * A description as it reads. With `onEdit` it is a button that opens the editor; without,
 * plain text — a system column's description is shown but is nobody's to change.
 *
 * Clamped, with the whole text in the tooltip when it is long: a description may be a
 * thousand characters and a list of fields is not the place to read one.
 */
export function DescriptionText({
  text,
  subject,
  size = 'sm',
  lines = 2,
  onEdit,
  disabled,
}: {
  readonly text: string
  /** What it describes, for people who cannot see the row: « le champ Ville ». */
  readonly subject: string
  readonly size?: keyof typeof SIZES
  readonly lines?: keyof typeof CLAMPS
  readonly onEdit?: () => void
  readonly disabled?: boolean
}) {
  const body = (
    <span className={cn('block whitespace-pre-line break-words', CLAMPS[lines], SIZES[size])}>
      {text}
    </span>
  )

  if (onEdit === undefined) {
    return <div className="text-muted-foreground">{body}</div>
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={disabled}
      title={text.length > MAY_BE_CLAMPED ? text : 'Cliquer pour modifier'}
      className={cn(
        // Negative margin and matching padding: the hover wash reaches past the text
        // without moving it.
        '-mx-1.5 block w-[calc(100%+0.75rem)] cursor-text rounded-md px-1.5 py-0.5 text-left text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none',
        'disabled:pointer-events-none',
      )}
    >
      {body}
      <span className="sr-only">Modifier la description pour {subject}</span>
    </button>
  )
}

/** "Ajouter une description" — what an empty description shows, and all it shows. */
export function AddDescription({
  onClick,
  subject,
  disabled,
  className,
}: {
  readonly onClick: () => void
  readonly subject: string
  readonly disabled?: boolean
  readonly className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Ajouter une description pour ${subject}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded text-xs text-muted-foreground/70 transition-[color,opacity]',
        'hover:text-foreground focus-visible:text-foreground focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      <Plus className="size-3" />
      Ajouter une description
    </button>
  )
}

/** The box a description is typed in while `useDescriptionEdit` is open. */
export function DescriptionEditor({
  edit,
  subject,
  placeholder,
  size = 'sm',
}: {
  readonly edit: DescriptionEdit
  readonly subject: string
  readonly placeholder: string
  readonly size?: keyof typeof SIZES
}) {
  return (
    <div className="space-y-1">
      <Textarea
        // Mounted only while editing, so this is what puts the caret in the box.
        autoFocus
        value={edit.draft}
        readOnly={edit.saving}
        onChange={(e) => edit.change(e.target.value)}
        // Leaving the box saves it; `commit` ignores a blur that arrives while closing.
        onBlur={edit.commit}
        onFocus={(e) => {
          // The caret goes after the text: continuing a sentence is the usual edit.
          const end = e.currentTarget.value.length
          e.currentTarget.setSelectionRange(end, end)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            edit.cancel()
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            edit.commit()
          }
        }}
        placeholder={placeholder}
        aria-label={`Description pour ${subject}`}
        aria-invalid={edit.error !== null || isTooLong(edit.draft) || undefined}
        className={cn(
          'max-h-40 min-h-9 py-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          SIZES[size],
          edit.saving && 'opacity-60',
        )}
      />
      <div className="flex min-h-4 items-start gap-2 text-xs text-muted-foreground">
        {edit.error !== null ? (
          <span role="alert" className="text-destructive">
            {edit.error}
          </span>
        ) : (
          <span>{edit.saving ? 'Enregistrement…' : 'Ctrl+Entrée enregistre · Échap annule'}</span>
        )}
        <Counter text={edit.draft} className="ml-auto" />
      </div>
    </div>
  )
}
