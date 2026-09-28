'use client'

import { hasDescription } from '@/components/app/description'
import type { Upload } from '@/components/app/files'
import type { Row } from '@/components/app/grid/cell'
import type { SearchLink } from '@/components/app/pickers'
import { PanelField, emptyDraft, writeValues } from '@/components/app/record-panel'
import { Unavailable } from '@/components/app/views/kanban-view'
import { type Field, type LinkOption, filesOf } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import type { FormQuestion, FormSpec } from '@/lib/views'
import { type FormCondition, visibleQuestions } from '@basedb/contracts'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CornerDownLeft,
  ExternalLink,
  Loader2,
  RotateCcw,
  Send,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  type AnswerWidget,
  answerProblem,
  minutesFor,
  normalizeUrl,
  placeholderFor,
  widgetOf,
} from './answers'
import { Celebration } from './celebration'
import {
  ADVANCE_MS,
  ChoiceAnswer,
  ChoicesAnswer,
  DateAnswer,
  LineAnswer,
  LongAnswer,
  RatingAnswer,
  YesNoAnswer,
} from './inputs'
import { lookStyle } from './theme'

/**
 * The form and the survey, answered — chapter 11 §1.4, chapter 15.
 *
 * Both write ONE row with ONE `POST` on sending: nothing exists half-filled, and a required
 * question is asked for before the round trip rather than refused after it. The form shows
 * every question on one page; the survey shows them one by one, full screen — a welcome
 * that says how long it takes, a question per screen that arrives from where one is going,
 * keys for every answer, the next question by itself once a single answer is taken — and
 * both end on a celebration.
 *
 * A question may be asked only when an earlier answer says so (`show_if`); a question
 * hidden is neither required nor sent, whatever was typed into it before.
 */

interface Question {
  readonly field: Field
  readonly label: string
  readonly help: string | null
  readonly required: boolean
  readonly placeholder: string
  readonly showIf: FormCondition | null
  readonly widget: AnswerWidget
}

function questionsOf(spec: FormSpec, fields: readonly Field[]): Question[] {
  return spec.fields.flatMap((q: FormQuestion) => {
    const field = fields.find((f) => f.name === q.field)
    // A field that has become unwritable — made a formula, closed to this reader — has
    // nothing left to be typed into.
    if (field === undefined || field.read_only === true || field.system === true) return []
    return [
      {
        field,
        label: q.label.trim() === '' ? field.label : q.label,
        help:
          q.help.trim() !== ''
            ? q.help
            : hasDescription(field.description)
              ? field.description
              : null,
        required: q.required || field.required === true,
        placeholder: q.placeholder.trim() === '' ? placeholderFor(field) : q.placeholder,
        showIf: q.show_if,
        widget: widgetOf(field),
      },
    ]
  })
}

/** True when the draft holds nothing for this field. */
function isEmpty(field: Field, value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (field.kind === 'link') return typeof (value as { id?: unknown }).id !== 'string'
  if (field.kind === 'file' || field.kind === 'image') return filesOf(value).length === 0
  if (field.kind === 'multi_select' || field.kind === 'multi_link') {
    return !Array.isArray(value) || value.length === 0
  }
  // An unticked box is an answer — « non » — and never a missing one.
  return false
}

/** Where a survey is: its welcome, a question (by field), or its end. */
type Place = { readonly at: 'welcome' } | { readonly at: 'question'; readonly name: string }

export function FormFill({
  kind,
  fields,
  spec,
  viewLabel,
  tableColor,
  linkOptions,
  onSearchLink,
  onUpload,
  submit,
  onSent,
  respondent,
  footer,
}: {
  readonly kind: 'form' | 'survey'
  readonly fields: readonly Field[]
  readonly spec: FormSpec
  readonly viewLabel: string
  /** The table's colour: the accent, when the form does not choose its own. */
  readonly tableColor?: string | null
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onUpload?: Upload
  /** Sends the answer: the values of the questions answered, by field name. */
  readonly submit: (values: Record<string, unknown>) => Promise<void>
  readonly onSent?: () => void
  /** Who answers, when a shared form knows it: « Vous répondez en tant que … ». */
  readonly respondent?: string | null
  /** A line at the foot of the screen — a shared form's « propulsé par ». */
  readonly footer?: ReactNode
}) {
  const questions = useMemo(() => questionsOf(spec, fields), [spec, fields])
  const writable = useMemo(() => questions.map((q) => q.field), [questions])
  const look = useMemo(() => lookStyle(spec, tableColor), [spec, tableColor])

  const [draft, setDraft] = useState<Row>(() => emptyDraft(writable))
  // Handlers read the draft through a ref: an answer taken and the next question asked in
  // the same moment must see that answer.
  const latest = useRef(draft)
  latest.current = draft
  const [problems, setProblems] = useState<Readonly<Record<string, string>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [place, setPlace] = useState<Place>({ at: 'welcome' })
  const [direction, setDirection] = useState<'up' | 'down'>('up')

  const shown = (row: Row) =>
    visibleQuestions(
      questions.map((q) => ({ field: q.field.name, show_if: q.showIf, question: q })),
      row as Record<string, unknown>,
    ).map((v) => v.question)
  const visible = shown(draft)

  const title = spec.title.trim() === '' ? viewLabel : spec.title
  const submitLabel = spec.submit_label.trim() === '' ? $t('Envoyer') : spec.submit_label
  const centered = spec.align === 'center'

  // The next question after a taken answer, once its blink is seen — through a ref, so the
  // timer calls the step with the answer in it.
  const advance = useRef<() => void>(() => undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  if (questions.length === 0) {
    return (
      <Unavailable>
        {$t(
          'Ce formulaire ne pose plus aucune question que vous puissiez remplir : ses champs ont été supprimés, ou ne vous sont pas ouverts.',
        )}
      </Unavailable>
    )
  }

  const commit = (field: Field, value: unknown) => {
    setError(null)
    setProblems((p) => {
      if (p[field.name] === undefined) return p
      const { [field.name]: _gone, ...rest } = p
      return rest
    })
    const next = {
      ...latest.current,
      // A link reads as `{ id, display }`; the picker hands back the identifier alone.
      [field.name]:
        field.kind === 'link' && typeof value === 'string' ? { id: value, display: null } : value,
    } as Row
    latest.current = next
    setDraft(next)
  }

  /** What stops these questions from being sent: an answer missing, or not right yet. */
  const check = (list: readonly Question[]): Record<string, string> => {
    const found: Record<string, string> = {}
    for (const q of list) {
      const value = latest.current[q.field.name]
      if (q.required && isEmpty(q.field, value)) {
        found[q.field.name] = $t('Une réponse est nécessaire ici.')
        continue
      }
      const problem = answerProblem(q.widget, value)
      if (problem !== null) found[q.field.name] = problem
    }
    return found
  }

  const send = async () => {
    const now = shown(latest.current)
    const found = check(now)
    if (Object.keys(found).length > 0) {
      setProblems(found)
      const first = now.find((q) => found[q.field.name] !== undefined)
      if (kind === 'survey' && first !== undefined) {
        setDirection('down')
        setPlace({ at: 'question', name: first.field.name })
      } else {
        setError(
          Object.keys(found).length === 1
            ? $t('« {label} » demande une réponse.', { label: first?.label ?? '' })
            : $t('{lackingCount} questions demandent une réponse.', {
                lackingCount: Object.keys(found).length,
              }),
        )
      }
      return
    }
    // Only what was shown is sent; an address typed without its scheme gains it.
    const answered = now.map((q) => q.field)
    const values = writeValues(answered, latest.current)
    for (const q of now) {
      const v = values[q.field.name]
      if (q.widget === 'url' && typeof v === 'string') values[q.field.name] = normalizeUrl(v)
    }
    if (Object.keys(values).length === 0) {
      setError($t('Répondez à au moins une question.'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await submit(values)
      setSent(true)
      onSent?.()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const restart = () => {
    const empty = emptyDraft(writable)
    latest.current = empty
    setDraft(empty)
    setProblems({})
    setError(null)
    setSent(false)
    setDirection('up')
    setPlace({ at: 'welcome' })
  }

  const answer = (q: Question, large: boolean, focus: boolean, onDone?: () => void) => {
    const common = {
      field: q.field,
      value: draft[q.field.name],
      onChange: (v: unknown) => commit(q.field, v),
      large,
      placeholder: q.placeholder,
      autoFocus: focus,
      invalid: problems[q.field.name] !== undefined,
      onDone,
    }
    switch (q.widget) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
      case 'number':
        return <LineAnswer {...common} widget={q.widget} />
      case 'long_text':
        return <LongAnswer {...common} />
      case 'date':
      case 'datetime':
        return <DateAnswer {...common} />
      case 'choice':
        return <ChoiceAnswer {...common} />
      case 'choices':
        return <ChoicesAnswer {...common} />
      case 'boolean':
        return <YesNoAnswer {...common} />
      case 'rating':
        return <RatingAnswer {...common} />
      case 'panel':
        // A relation, a person, a file: the application's own field, on a neutral card.
        return (
          <div className="max-w-xl rounded-(--fm-radius) bg-background p-3 text-foreground shadow-sm">
            <PanelField
              field={q.field}
              row={draft}
              options={linkOptions[q.field.name]}
              onSearchLink={onSearchLink}
              onCommit={async (value) => commit(q.field, value)}
              onUpload={onUpload}
              live
            />
          </div>
        )
    }
  }

  const shell = (children: ReactNode) => (
    <div
      data-form-screen
      className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', look.dark && 'dark')}
      style={look.style}
    >
      {children}
      {footer !== undefined && (
        <div className="pointer-events-none absolute bottom-3 left-4 z-20 text-xs text-(--fm-muted)">
          {footer}
        </div>
      )}
    </div>
  )

  // ── The end ────────────────────────────────────────────────────────────────────────

  if (sent) {
    return shell(
      <Celebration
        accent={look.accent}
        confetti={spec.celebrate}
        align={centered ? 'center' : 'left'}
      >
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {$t('C’est envoyé !')}
        </h1>
        <p className="mt-3 max-w-md whitespace-pre-line text-lg text-(--fm-muted)">
          {spec.success_message.trim() === ''
            ? $t('Merci, votre réponse a été enregistrée.')
            : spec.success_message}
        </p>
        <div className={cn('mt-8 flex flex-wrap gap-3', centered && 'justify-center')}>
          {spec.end_link_url.trim() !== '' && (
            <a href={spec.end_link_url} className={accentButton(true)}>
              {spec.end_link_label.trim() === '' ? $t('Continuer') : spec.end_link_label}
              <ExternalLink className="size-4" />
            </a>
          )}
          {spec.allow_another && (
            <button type="button" onClick={restart} className={ghostButton}>
              <RotateCcw className="size-4" />
              {$t('Envoyer une autre réponse')}
            </button>
          )}
        </div>
      </Celebration>,
    )
  }

  // ── The form, on one page ──────────────────────────────────────────────────────────

  if (kind === 'form') {
    return shell(
      <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
        <div className="mx-auto w-full max-w-2xl px-6 pt-12 pb-20 sm:pt-16">
          <header className={cn('animate-form-rise', centered && 'text-center')}>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            {spec.description.trim() !== '' && (
              <p className="mt-3 whitespace-pre-line text-lg text-(--fm-muted)">
                {spec.description}
              </p>
            )}
            {respondent != null && <Respondent name={respondent} />}
          </header>
          <div className="mt-12 space-y-12">
            {visible.map((q, i) => (
              <section key={q.field.name} className="animate-form-rise">
                <Heading
                  number={spec.show_numbers ? i + 1 : null}
                  label={q.label}
                  help={q.help}
                  required={q.required}
                  large={false}
                >
                  <div className="mt-4">{answer(q, false, false)}</div>
                  <Problem text={problems[q.field.name]} dark={look.dark} />
                </Heading>
              </section>
            ))}
          </div>
          <footer className="mt-14 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className={accentButton(true)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {submitLabel}
            </button>
            {error !== null && (
              <p role="alert" className="animate-shake text-sm font-medium text-red-500">
                {error}
              </p>
            )}
          </footer>
        </div>
      </div>,
    )
  }

  // ── The survey, one question per screen ────────────────────────────────────────────

  const index = place.at === 'question' ? visible.findIndex((q) => q.field.name === place.name) : -1
  // The question on screen was hidden by an answer given since: the next shown one takes it.
  const current: Question | undefined =
    place.at === 'question'
      ? (visible[index] ??
        visible.find(
          (q) => questions.indexOf(q) > questions.findIndex((x) => x.field.name === place.name),
        ))
      : undefined
  const position = current === undefined ? -1 : visible.indexOf(current)
  const last = position === visible.length - 1

  const go = (to: Place, dir: 'up' | 'down') => {
    setDirection(dir)
    setPlace(to)
  }

  const next = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (place.at === 'welcome') {
      const first = shown(latest.current)[0]
      if (first !== undefined) go({ at: 'question', name: first.field.name }, 'up')
      return
    }
    if (current === undefined) return
    const found = check([current])
    if (Object.keys(found).length > 0) {
      setProblems((p) => ({ ...p, ...found }))
      return
    }
    // Visibility read again: the answer just given may open or close what follows.
    const now = shown(latest.current)
    const at = now.findIndex((q) => q.field.name === current.field.name)
    const following = now[at + 1]
    if (following === undefined) void send()
    else go({ at: 'question', name: following.field.name }, 'up')
  }
  advance.current = next

  const previous = () => {
    if (current === undefined) return
    const now = shown(latest.current)
    const at = now.findIndex((q) => q.field.name === current.field.name)
    const before = now[at - 1]
    go(
      before === undefined ? { at: 'welcome' } : { at: 'question', name: before.field.name },
      'down',
    )
  }

  const later = () => {
    if (!spec.auto_advance) return
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      advance.current()
    }, ADVANCE_MS)
  }

  const progress =
    current === undefined ? 0 : Math.round(((position + (last ? 0.5 : 0)) / visible.length) * 100)

  return shell(
    <>
      {spec.show_progress && place.at === 'question' && (
        <div aria-hidden className="absolute inset-x-0 top-0 z-20 h-1 bg-(--fm-accent-soft)">
          <div
            className="h-full bg-(--fm-accent) transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-discret"
        onKeyDown={(e) => {
          // Enter goes on, as in any survey; Maj + Entrée writes a new line in a long text.
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
          const target = e.target as HTMLElement
          if (
            target.closest('.cm-editor, [role="listbox"], [role="dialog"], [role="combobox"]') !==
            null
          ) {
            return
          }
          if (target.tagName === 'BUTTON' && target.getAttribute('role') === null) return
          e.preventDefault()
          next()
        }}
      >
        {place.at === 'welcome' || current === undefined ? (
          <div
            className={cn(
              'mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16 sm:px-10',
              centered ? 'items-center text-center' : 'items-start',
            )}
          >
            <div className="animate-form-rise">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                {title}
              </h1>
              {spec.description.trim() !== '' && (
                <p className="mt-4 max-w-xl whitespace-pre-line text-lg text-(--fm-muted) sm:text-xl">
                  {spec.description}
                </p>
              )}
              {respondent != null && <Respondent name={respondent} />}
              <div
                className={cn(
                  'mt-10 flex flex-wrap items-center gap-4',
                  centered && 'justify-center',
                )}
              >
                <button
                  type="button"
                  onClick={next}
                  // biome-ignore lint/a11y/noAutofocus: the welcome of a survey is one button: Enter starts it
                  autoFocus
                  className={accentButton(true)}
                >
                  {spec.welcome_label.trim() === '' ? $t('Commencer') : spec.welcome_label}
                  <ArrowRight className="size-4" />
                </button>
                <EnterHint />
              </div>
              <p
                className={cn(
                  'mt-6 flex items-center gap-1.5 text-sm text-(--fm-muted)',
                  centered && 'justify-center',
                )}
              >
                <Clock className="size-4" />
                {$tp(
                  minutesFor(visible.map((q) => q.field)),
                  'Environ {count} minute',
                  'Environ {count} minutes',
                )}
                <span aria-hidden>·</span>
                {$tp(visible.length, '{count} question', '{count} questions')}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20 sm:px-10',
              centered && 'text-center',
            )}
          >
            <div
              key={current.field.name}
              className={direction === 'up' ? 'animate-form-in-up' : 'animate-form-in-down'}
            >
              <Heading
                number={spec.show_numbers ? position + 1 : null}
                label={current.label}
                help={current.help}
                required={current.required}
                large
                centered={centered}
              >
                <div className={cn('mt-8', centered && 'flex justify-center')}>
                  <div className={cn('w-full', centered && 'max-w-xl')}>
                    {answer(current, true, true, later)}
                  </div>
                </div>
                <Problem text={problems[current.field.name]} dark={look.dark} />
                <div
                  className={cn(
                    'mt-8 flex flex-wrap items-center gap-4',
                    centered && 'justify-center',
                  )}
                >
                  <button
                    type="button"
                    onClick={next}
                    disabled={busy}
                    className={accentButton(false)}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : last ? (
                      <Send className="size-4" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {last ? submitLabel : $t('OK')}
                  </button>
                  <EnterHint shift={current.widget === 'long_text'} />
                </div>
                {error !== null && (
                  <p role="alert" className="mt-4 animate-shake text-sm font-medium text-red-500">
                    {error}
                  </p>
                )}
              </Heading>
            </div>
          </div>
        )}
      </div>

      {place.at === 'question' && (
        <nav
          aria-label={$t('Navigation entre les questions')}
          className="absolute right-4 bottom-4 z-20 flex overflow-hidden rounded-(--fm-radius) shadow-lg"
        >
          <button
            type="button"
            onClick={previous}
            aria-label={$t('Question précédente')}
            className="flex size-10 items-center justify-center bg-(--fm-accent) text-(--fm-on-accent) transition-[filter] hover:brightness-110"
          >
            <ChevronUp className="size-5" />
          </button>
          <span aria-hidden className="w-px bg-(--fm-on-accent) opacity-25" />
          <button
            type="button"
            onClick={next}
            disabled={busy}
            aria-label={$t('Question suivante')}
            className="flex size-10 items-center justify-center bg-(--fm-accent) text-(--fm-on-accent) transition-[filter] hover:brightness-110 disabled:opacity-60"
          >
            <ChevronDown className="size-5" />
          </button>
        </nav>
      )}
    </>,
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────────────

const accentButton = (large: boolean) =>
  cn(
    'inline-flex items-center gap-2 rounded-(--fm-radius) bg-(--fm-accent) font-semibold text-(--fm-on-accent) shadow-sm outline-none',
    'transition-[filter,transform,box-shadow] hover:brightness-110 hover:shadow-md active:scale-[0.98] disabled:opacity-60',
    'focus-visible:ring-2 focus-visible:ring-(--fm-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
    large ? 'h-12 px-6 text-base' : 'h-11 px-5 text-base',
  )

const ghostButton = cn(
  'inline-flex h-12 items-center gap-2 rounded-(--fm-radius) border border-(--fm-border) px-5 text-base font-medium text-(--fm-fg)',
  'transition-colors hover:bg-(--fm-accent-soft)',
)

function Heading({
  number,
  label,
  help,
  required,
  large,
  centered = false,
  children,
}: {
  readonly number: number | null
  readonly label: string
  readonly help: string | null
  readonly required: boolean
  readonly large: boolean
  readonly centered?: boolean
  /** The answer and what goes with it — aligned on the question's words, past its number. */
  readonly children: ReactNode
}) {
  return (
    <div className={cn('flex items-start gap-3', centered && 'justify-center')}>
      {number !== null && !centered && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 font-medium tabular-nums text-(--fm-accent)',
            large ? 'mt-2 text-base' : 'mt-0.5 text-sm',
          )}
        >
          {number}
          <ArrowRight className={large ? 'size-4' : 'size-3.5'} />
        </span>
      )}
      <div className={cn('min-w-0', centered ? 'w-full' : 'flex-1')}>
        <h2
          className={cn(
            'font-medium text-balance',
            large ? 'text-2xl leading-snug sm:text-3xl' : 'text-xl leading-snug',
          )}
        >
          {label}
          {required && (
            <span className="ml-1 text-(--fm-accent)" aria-label={$t('obligatoire')}>
              *
            </span>
          )}
        </h2>
        {help !== null && (
          <p
            className={cn(
              'mt-2 whitespace-pre-line text-(--fm-muted)',
              large ? 'text-base sm:text-lg' : 'text-base',
            )}
          >
            {help}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

function Problem({ text, dark }: { readonly text: string | undefined; readonly dark: boolean }) {
  if (text === undefined) return null
  return (
    <p
      role="alert"
      className={cn(
        'mt-4 inline-flex animate-shake items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
        dark ? 'bg-red-500/20 text-red-200' : 'bg-red-50 text-red-700',
      )}
    >
      {text}
    </p>
  )
}

function EnterHint({ shift = false }: { readonly shift?: boolean }) {
  return (
    <span className="hidden items-center gap-1 text-sm text-(--fm-muted) sm:inline-flex">
      {shift
        ? $t('Entrée pour valider · Maj + Entrée pour aller à la ligne')
        : $t('ou appuyez sur Entrée')}
      <CornerDownLeft className="size-3.5" />
    </span>
  )
}

function Respondent({ name }: { readonly name: string }) {
  return (
    <p className="mt-4 text-sm text-(--fm-muted)">
      {$t('Vous répondez en tant que')} <span className="font-medium text-(--fm-fg)">{name}</span>.
    </p>
  )
}
