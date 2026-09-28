'use client'

import type { Field } from '@/lib/api/client'
import { editText, parseNumberInput } from '@/lib/format'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Check, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type AnswerWidget, choiceKey, normalizeUrl, yesNoKeys } from './answers'

/**
 * The answers of a form, drawn in its theme (`--fm-*`, see theme.ts). One widget per sort
 * of answer, each as large as the screen allows in a survey, a little smaller on a
 * one-page form. A choice, a yes or no, a rating take a key as well as a click; taken,
 * they blink once and — in a survey that lets them — call `onDone`, and the next question
 * comes by itself.
 */

interface Common {
  readonly field: Field
  readonly value: unknown
  readonly onChange: (value: unknown) => void
  /** A survey's screen: larger type, keys for the choices. */
  readonly large: boolean
  readonly placeholder: string
  readonly autoFocus?: boolean
  readonly invalid?: boolean
  /** A single answer was taken — the survey may go on by itself. */
  readonly onDone?: () => void
}

/** A key pressed on the page, not typed into a field — and without a modifier. */
function freeKey(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false
  const target = e.target as HTMLElement | null
  if (target === null) return true
  if (target.isContentEditable) return false
  const tag = target.tagName
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT'
}

/** Keys that answer while this widget is on screen — a survey's, one question at a time. */
function useKeys(enabled: boolean, onKey: (key: string) => boolean) {
  const handler = useRef(onKey)
  handler.current = onKey
  useEffect(() => {
    if (!enabled) return
    const listen = (e: KeyboardEvent) => {
      if (!freeKey(e)) return
      if (handler.current(e.key.toUpperCase())) e.preventDefault()
    }
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [enabled])
}

const lineInput = (large: boolean, invalid?: boolean) =>
  cn(
    'w-full border-0 border-b-2 bg-transparent pb-2 text-(--fm-fg) outline-none transition-colors',
    'placeholder:text-(--fm-muted) placeholder:opacity-60 focus:border-(--fm-accent)',
    invalid ? 'border-red-500' : 'border-(--fm-border)',
    large ? 'text-2xl sm:text-3xl' : 'text-lg',
  )

// ── Typed answers ────────────────────────────────────────────────────────────────────

const TYPES: Partial<
  Record<AnswerWidget, { type: string; inputMode?: 'email' | 'tel' | 'url' | 'decimal' }>
> = {
  email: { type: 'email', inputMode: 'email' },
  url: { type: 'url', inputMode: 'url' },
  phone: { type: 'tel', inputMode: 'tel' },
  number: { type: 'text', inputMode: 'decimal' },
  text: { type: 'text' },
}

/** A text, an address, a number: one line, underlined, as wide as the question. */
export function LineAnswer({
  widget,
  field,
  value,
  onChange,
  large,
  placeholder,
  autoFocus,
  invalid,
}: Common & { readonly widget: 'text' | 'email' | 'url' | 'phone' | 'number' }) {
  const [typed, setTyped] = useState(() =>
    value === null || value === undefined
      ? ''
      : widget === 'number' && typeof value === 'number'
        ? editText(value, field)
        : String(value),
  )
  const kind = TYPES[widget] ?? { type: 'text' }
  return (
    <input
      type={kind.type}
      inputMode={kind.inputMode}
      value={typed}
      // biome-ignore lint/a11y/noAutofocus: a survey shows one question per screen, and the caret belongs in its answer
      autoFocus={autoFocus}
      aria-invalid={invalid}
      aria-label={field.label}
      placeholder={placeholder}
      autoComplete={widget === 'email' ? 'email' : widget === 'phone' ? 'tel' : 'off'}
      onChange={(e) => {
        const next = e.target.value
        setTyped(next)
        onChange(
          next.trim() === '' ? null : widget === 'number' ? parseNumberInput(next, field) : next,
        )
      }}
      onBlur={() => {
        // `exemple.fr` is the address everyone means: it gains its `https://`.
        if (widget === 'url' && typed.trim() !== '') {
          const url = normalizeUrl(typed)
          setTyped(url)
          onChange(url)
        }
      }}
      className={lineInput(large, invalid)}
    />
  )
}

/** A longer text: it grows with what is written. In a survey, Maj + Entrée goes to the line. */
export function LongAnswer({
  field,
  value,
  onChange,
  large,
  placeholder,
  autoFocus,
  invalid,
}: Common) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const text = typeof value === 'string' ? value : ''
  // biome-ignore lint/correctness/useExhaustiveDependencies: the height follows the text.
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    el.style.height = 'auto'
    // The content, and the border under it: without it, the last pixels would scroll.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [text])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={text}
      // biome-ignore lint/a11y/noAutofocus: a survey shows one question per screen, and the caret belongs in its answer
      autoFocus={autoFocus}
      aria-invalid={invalid}
      aria-label={field.label}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      className={cn(
        lineInput(large, invalid),
        'max-h-72 resize-none overflow-y-auto [scrollbar-width:thin]',
      )}
    />
  )
}

/** A date, or a date and an hour — the device's own picker, in the theme's light or dark. */
export function DateAnswer({ field, value, onChange, large, autoFocus, invalid }: Common) {
  const withTime = field.kind === 'datetime'
  const shown =
    typeof value !== 'string' || value === ''
      ? ''
      : withTime
        ? localInput(value)
        : value.slice(0, 10)
  return (
    <input
      type={withTime ? 'datetime-local' : 'date'}
      value={shown}
      // biome-ignore lint/a11y/noAutofocus: a survey shows one question per screen, and the caret belongs in its answer
      autoFocus={autoFocus}
      aria-invalid={invalid}
      aria-label={field.label}
      onChange={(e) => {
        const v = e.target.value
        if (v === '') onChange(null)
        else onChange(withTime ? new Date(v).toISOString() : v)
      }}
      className={cn(lineInput(large, invalid), 'w-auto min-w-56')}
    />
  )
}

/** An instant as a `datetime-local` input reads it: the reader's own time, to the minute. */
function localInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Choices ──────────────────────────────────────────────────────────────────────────

function OptionCard({
  keyLabel,
  label,
  color,
  on,
  blink,
  large,
  role,
  onClick,
}: {
  readonly keyLabel: string | null
  readonly label: string
  readonly color?: string | null
  readonly on: boolean
  readonly blink: boolean
  readonly large: boolean
  readonly role: 'radio' | 'checkbox'
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-(--fm-radius) border px-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.99]',
        large ? 'py-3 text-lg' : 'py-2.5 text-base',
        on
          ? 'border-(--fm-accent) bg-(--fm-accent-soft) shadow-[0_0_0_1px_var(--fm-accent)]'
          : 'border-(--fm-border) bg-(--fm-field) hover:border-(--fm-accent-line) hover:bg-(--fm-accent-soft)',
        blink && 'animate-form-blink',
      )}
    >
      {keyLabel !== null && (
        <kbd
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-[calc(var(--fm-radius)*0.5)] border font-sans text-xs font-semibold transition-colors',
            on
              ? 'border-(--fm-accent) bg-(--fm-accent) text-(--fm-on-accent)'
              : 'border-(--fm-accent-line) bg-(--fm-surface) text-(--fm-accent)',
          )}
        >
          {keyLabel}
        </kbd>
      )}
      {color != null && (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <Check
        aria-hidden
        className={cn(
          'size-5 shrink-0 text-(--fm-accent) transition-[opacity,scale] duration-200',
          on ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
      />
    </button>
  )
}

/** The time a taken answer blinks before the next question comes. */
export const ADVANCE_MS = 420

/** One choice among the field's options. */
export function ChoiceAnswer({ field, value, onChange, large, onDone }: Common) {
  const options = field.options ?? []
  const current = typeof value === 'string' ? value : null
  const [blink, setBlink] = useState<string | null>(null)
  const take = (v: string) => {
    // On a one-page form a second click leaves the question unanswered; a survey keeps it.
    const next = !large && current === v ? null : v
    onChange(next)
    if (next === null) return
    setBlink(v)
    setTimeout(() => setBlink(null), ADVANCE_MS)
    onDone?.()
  }
  useKeys(large, (key) => {
    const i = key.length === 1 ? key.charCodeAt(0) - 65 : -1
    const option = i >= 0 ? options[i] : undefined
    if (option === undefined) return false
    take(option.value)
    return true
  })
  return (
    <div role="radiogroup" aria-label={field.label} className="flex max-w-xl flex-col gap-2">
      {options.map((o, i) => (
        <OptionCard
          key={o.value}
          role="radio"
          keyLabel={choiceKey(i)}
          label={o.label}
          color={o.color}
          on={current === o.value}
          blink={blink === o.value}
          large={large}
          onClick={() => take(o.value)}
        />
      ))}
    </div>
  )
}

/** Several choices among the field's options. */
export function ChoicesAnswer({ field, value, onChange, large }: Common) {
  const options = field.options ?? []
  const chosen = Array.isArray(value) ? (value as string[]) : []
  const toggle = (v: string) => {
    const next = chosen.includes(v) ? chosen.filter((c) => c !== v) : [...chosen, v]
    onChange(next.length === 0 ? null : next)
  }
  useKeys(large, (key) => {
    const i = key.length === 1 ? key.charCodeAt(0) - 65 : -1
    const option = i >= 0 ? options[i] : undefined
    if (option === undefined) return false
    toggle(option.value)
    return true
  })
  return (
    <div className="max-w-xl">
      <p className="mb-2.5 text-sm text-(--fm-muted)">{$t('Plusieurs réponses possibles')}</p>
      <div
        // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would draw a frame and a legend the question already is
        role="group"
        aria-label={field.label}
        className="flex flex-col gap-2"
      >
        {options.map((o, i) => (
          <OptionCard
            key={o.value}
            role="checkbox"
            keyLabel={choiceKey(i)}
            label={o.label}
            color={o.color}
            on={chosen.includes(o.value)}
            blink={false}
            large={large}
            onClick={() => toggle(o.value)}
          />
        ))}
      </div>
    </div>
  )
}

/** Yes or no: two cards, a key each — the letters of the words in the reader's language. */
export function YesNoAnswer({ field, value, onChange, large, onDone }: Common) {
  const keys = yesNoKeys()
  const [blink, setBlink] = useState<boolean | null>(null)
  const take = (v: boolean) => {
    const next = !large && value === v ? null : v
    onChange(next)
    if (next === null) return
    setBlink(v)
    setTimeout(() => setBlink(null), ADVANCE_MS)
    onDone?.()
  }
  useKeys(large, (key) => {
    if (key === keys.yes) take(true)
    else if (key === keys.no) take(false)
    else return false
    return true
  })
  return (
    <div role="radiogroup" aria-label={field.label} className="grid max-w-md grid-cols-2 gap-2">
      <OptionCard
        role="radio"
        keyLabel={keys.yes}
        label={keys.yesLabel}
        on={value === true}
        blink={blink === true}
        large={large}
        onClick={() => take(true)}
      />
      <OptionCard
        role="radio"
        keyLabel={keys.no}
        label={keys.noLabel}
        on={value === false}
        blink={blink === false}
        large={large}
        onClick={() => take(false)}
      />
    </div>
  )
}

/** A rating: stars from one to the field's maximum, the digits as keys. */
export function RatingAnswer({ field, value, onChange, large, onDone }: Common) {
  const max = field.format?.rating_max ?? 5
  const current = typeof value === 'number' ? Math.round(value) : 0
  const [hover, setHover] = useState(0)
  const [pulse, setPulse] = useState(0)
  const take = (n: number) => {
    const next = !large && current === n ? null : n
    onChange(next)
    if (next === null) return
    setPulse(n)
    setTimeout(() => setPulse(0), ADVANCE_MS)
    onDone?.()
  }
  useKeys(large, (key) => {
    const n = key === '0' ? 10 : Number(key)
    if (!Number.isInteger(n) || n < 1 || n > max) return false
    take(n)
    return true
  })
  const lit = hover > 0 ? hover : current
  return (
    <div
      role="radiogroup"
      aria-label={field.label}
      className="flex flex-wrap items-end gap-1.5 sm:gap-2.5"
      onMouseLeave={() => setHover(0)}
    >
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        const on = n <= lit
        return (
          <button
            key={n}
            type="button"
            // biome-ignore lint/a11y/useSemanticElements: answer cards with a key and a check, the ARIA radio pattern — a native input cannot hold them
            role="radio"
            aria-checked={current === n}
            aria-label={$t('{value} sur {max}', { value: n, max })}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => take(n)}
            className="group flex flex-col items-center gap-1 rounded-(--fm-radius) p-1 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-(--fm-accent)"
          >
            <Star
              className={cn(
                'transition-[color,fill,scale] duration-150',
                large ? 'size-10 sm:size-12' : 'size-8',
                on ? 'fill-(--fm-accent) text-(--fm-accent)' : 'text-(--fm-border)',
                pulse === n && 'animate-form-pop',
              )}
              strokeWidth={1.5}
            />
            <span className="text-xs tabular-nums text-(--fm-muted)">{n}</span>
          </button>
        )
      })}
    </div>
  )
}
