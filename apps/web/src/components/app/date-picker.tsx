'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Hint } from '@/components/ui/tooltip'
import {
  type DateKind,
  dateOfDay,
  dayOfDate,
  describe,
  formatDay,
  formatMoment,
  momentOfDate,
  parseTime,
  parseTyped,
  splitTyped,
} from '@/lib/dates'
import { $t } from '@/lib/i18n'
import { dateFormat } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { CalendarDays, Clock } from 'lucide-react'
import { type KeyboardEvent, useRef, useState } from 'react'

/**
 * A `date` or `datetime` field: typed, or picked from a calendar.
 *
 * Typing stays the fast way in — `25/09/2026`, `25/9/26`, `2509`, `25/09 14h30` — and the
 * calendar follows what is typed, with a line under it saying in words what was
 * understood: a two-digit year or a missing one is guessed, and the guess is shown before
 * it is written.
 *
 * The component holds no value of its own: `text` is the field's, and `onCommit` says when
 * it is final — Enter, a day picked, the focus gone elsewhere. It may say so twice for the
 * same text; the caller knows what is already written and ignores the second.
 */

interface DateInputProps {
  readonly kind: DateKind
  readonly text: string
  readonly onTextChange: (text: string) => void
  readonly onCommit?: (text: string) => void
  /** Escape. */
  readonly onCancel?: () => void
  /**
   * `cell` fills a grid cell and opens its calendar on focus; `form` is the bordered field
   * of a form, whose calendar opens from the button at its start.
   */
  readonly appearance: 'cell' | 'form'
  /** A field that may be empty offers a way to empty it; a required one must not. */
  readonly clearable: boolean
  readonly readOnly?: boolean
  readonly autoFocus?: boolean
  readonly placeholder?: string
  /** Runs first; a handler that calls `preventDefault` keeps the key from the field. */
  readonly onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  readonly className?: string
  readonly 'aria-label': string
}

/** What to type, in the order dates read for this person. */
function placeholderOf(kind: DateKind): string {
  const day = dateFormat() === 'iso' ? 'aaaa-mm-jj' : 'jj/mm/aaaa'
  return kind === 'date' ? day : `${day} hh:mm`
}

const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

export function DateInput({
  kind,
  text,
  onTextChange,
  onCommit,
  onCancel,
  appearance,
  clearable,
  readOnly = false,
  autoFocus = false,
  placeholder,
  onKeyDown,
  className,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => firstOfMonth(new Date()))
  const wrapper = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  /** Set by Escape, read by the close that follows it: a cancelled edit commits nothing. */
  const cancelled = useRef(false)
  /** True when the calendar, not the text, should have the focus once it opens. */
  const focusCalendar = useRef(false)
  /** True while the popup hands the focus back: a focus nobody asked for opens nothing. */
  const quiet = useRef(false)

  const typed = parseTyped(text)
  const empty = text.trim() === ''
  const selected = typed === null ? undefined : dateOfDay(typed.day)
  const parts = splitTyped(text)

  const change = (next: string) => {
    onTextChange(next)
    // The calendar turns to the month being typed as soon as the text reads as a day.
    const moment = parseTyped(next)
    if (moment !== null) setMonth(firstOfMonth(dateOfDay(moment.day)))
  }

  const finish = (next: string) => {
    setOpen(false)
    onCommit?.(next)
  }

  const cancel = () => {
    setOpen(false)
    onCancel?.()
  }

  const openChange = (next: boolean) => {
    if (next) {
      setMonth(firstOfMonth(selected ?? new Date()))
      setOpen(true)
      return
    }
    setOpen(false)
    focusCalendar.current = false
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    // Dismissed by a click or a focus elsewhere. While the caret is still in the field,
    // its own blur settles the text; otherwise this is the last word.
    if (document.activeElement !== input.current) onCommit?.(text)
  }

  const pick = (date: Date) => {
    const day = dayOfDate(date)
    if (kind === 'date') {
      const next = formatDay(day)
      change(next)
      finish(next)
      return
    }
    // A day picked keeps the time already there: the day and the hour are chosen apart.
    change(formatMoment({ day, time: typed?.time ?? parseTime(parts.time) }, 'datetime'))
  }

  const changeTime = (time: string) => {
    const day = typed === null ? formatDay(dayOfDate(new Date())) : formatDay(typed.day)
    change(time === '' ? day : `${day} ${time}`)
  }

  const now = () => {
    const date = new Date()
    date.setSeconds(0, 0)
    const next = formatMoment(momentOfDate(date), kind)
    change(next)
    finish(next)
  }

  /** The day the arrow keys start from: the chosen one, else today, else the first. */
  const focusDay = () => {
    const days = content.current
    const target =
      days?.querySelector<HTMLButtonElement>('[data-selected] button') ??
      days?.querySelector<HTMLButtonElement>('[data-today] button') ??
      days?.querySelector<HTMLButtonElement>('[role="gridcell"]:not([data-outside]) button')
    target?.focus()
  }

  const hint = empty
    ? $t('Saisissez {kind} ou choisissez un jour.', { kind: placeholderOf(kind) })
    : typed === null
      ? $t('Date non reconnue.')
      : describe(typed, kind)

  if (readOnly) {
    return (
      <input
        value={text}
        readOnly
        className={cn(
          appearance === 'form'
            ? 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm text-muted-foreground shadow-xs outline-none'
            : 'size-full bg-transparent px-2 text-xs outline-none',
          className,
        )}
        aria-label={ariaLabel}
      />
    )
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverAnchor asChild>
        <div ref={wrapper} className={cn('relative', appearance === 'cell' && 'size-full')}>
          {appearance === 'form' && (
            <Hint label={$t('Ouvrir le calendrier')}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    focusCalendar.current = true
                  }}
                  className="absolute left-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={$t('Ouvrir le calendrier')}
                >
                  <CalendarDays className="size-4" />
                </button>
              </PopoverTrigger>
            </Hint>
          )}
          <input
            ref={input}
            // biome-ignore lint/a11y/noAutofocus: the field was opened by a double click, and the caret belongs there
            autoFocus={autoFocus}
            value={text}
            placeholder={placeholder ?? placeholderOf(kind)}
            inputMode={kind === 'date' ? 'numeric' : 'text'}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!empty && typed === null ? true : undefined}
            onChange={(e) => change(e.target.value)}
            onFocus={() => {
              if (!quiet.current && appearance === 'cell' && !open) openChange(true)
            }}
            onClick={() => {
              if (appearance === 'cell' && !open) openChange(true)
            }}
            onBlur={(e) => {
              // Into the calendar — a month chosen, a time typed — is not away.
              const to = e.relatedTarget
              if (
                to instanceof Node &&
                (wrapper.current?.contains(to) || content.current?.contains(to))
              ) {
                return
              }
              setOpen(false)
              onCommit?.(text)
            }}
            onKeyDown={(e) => {
              onKeyDown?.(e)
              if (e.defaultPrevented) return
              if (e.key === 'Enter') {
                e.preventDefault()
                finish(text)
              } else if (e.key === 'Escape') {
                // Open, the popup's own Escape has already cancelled.
                if (!open) cancel()
              } else if (e.key === 'ArrowDown' && (open || e.altKey)) {
                // Down into the calendar, whose arrow keys then move from day to day.
                e.preventDefault()
                if (open) focusDay()
                else {
                  focusCalendar.current = true
                  openChange(true)
                }
              }
            }}
            className={cn(
              appearance === 'form'
                ? [
                    'flex h-9 w-full min-w-0 rounded-md border bg-transparent py-1 pr-3 pl-9 text-sm shadow-xs outline-none transition-[color,box-shadow]',
                    'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25',
                    'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                  ]
                : 'size-full bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground aria-invalid:text-destructive',
              className,
            )}
            aria-label={ariaLabel}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        ref={content}
        className="w-auto p-0"
        onOpenAutoFocus={(e) => {
          // The caret stays where it is — one types a date as often as one picks it —
          // unless the calendar was asked for with the button or the arrow key.
          e.preventDefault()
          if (focusCalendar.current) {
            focusCalendar.current = false
            focusDay()
          }
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          // A day picked with the keyboard leaves the focus nowhere: it goes back to the
          // field. A click elsewhere has put it where it belongs, and it stays there.
          const active = document.activeElement
          if (active === null || active === document.body) {
            quiet.current = true
            input.current?.focus()
            quiet.current = false
          }
        }}
        onEscapeKeyDown={() => {
          cancelled.current = true
          onCancel?.()
        }}
        onInteractOutside={(e) => {
          // The field is the popup's other half: clicking back into it closes nothing.
          if (e.target instanceof Node && wrapper.current?.contains(e.target)) e.preventDefault()
        }}
        onMouseDown={(e) => {
          // React events cross portals. Without this, a click in the calendar would reach
          // the grid cell that hosts the field and start a selection there.
          e.stopPropagation()
          // A day clicked must not take the caret from the field, or its blur would
          // commit half a date. The month and year lists and the time field do need the
          // focus, and have it — the blur ignores a focus that stays in here.
          if (!(e.target instanceof Element && e.target.closest('select, input'))) {
            e.preventDefault()
          }
        }}
      >
        <Calendar
          mode="single"
          required
          selected={selected}
          onSelect={pick}
          month={month}
          onMonthChange={setMonth}
          captionLayout="dropdown"
          startMonth={new Date(Math.min(1900, selected?.getFullYear() ?? 1900), 0)}
          endMonth={
            new Date(Math.max(new Date().getFullYear() + 30, selected?.getFullYear() ?? 0), 11)
          }
        />

        {kind === 'datetime' && (
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={parts.time}
              placeholder="hh:mm"
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => changeTime(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  finish(text)
                }
              }}
              className="h-8 w-full min-w-0 rounded-md border bg-transparent px-2 text-sm tabular-nums outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
              aria-label={$t('Heure')}
            />
          </div>
        )}

        <div className="space-y-2 border-t px-3 py-2">
          <p
            aria-live="polite"
            className={cn(
              'text-xs first-letter:uppercase',
              !empty && typed === null ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {hint}
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={now}>
              {kind === 'date' ? $t('Aujourd’hui') : $t('Maintenant')}
            </Button>
            {clearable && !empty && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  change('')
                  finish('')
                }}
              >
                {$t('Effacer')}
              </Button>
            )}
            {kind === 'datetime' && (
              <Button size="sm" className="h-7 text-xs" onClick={() => finish(text)}>
                {$t('Valider')}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
