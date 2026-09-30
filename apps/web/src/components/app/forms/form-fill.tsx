'use client'

import { hasDescription } from '@/components/app/description'
import type { Upload } from '@/components/app/files'
import type { Row } from '@/components/app/grid/cell'
import type { SearchLink } from '@/components/app/pickers'
import { PanelField, emptyDraft, prefillOf, writeValues } from '@/components/app/record-panel'
import { Unavailable } from '@/components/app/views/kanban-view'
import {
  type Field,
  type LinkOption,
  type QuizGrade,
  type QuizOutcome,
  filesOf,
} from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { type FormQuestion, type FormSpec, isGraded } from '@/lib/views'
import {
  type FormCondition,
  type QuizAnswer,
  isRightAnswer,
  quizPassed,
  quizPercent,
  scoreQuiz,
  visibleQuestions,
} from '@basedb/contracts'
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
  todayAnswer,
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
import {
  PointsBadge,
  Recap,
  RunningScore,
  ScoreRing,
  Verdict,
  scoreCelebrated,
  scoreHeadline,
} from './quiz'
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
 * hidden is neither required nor sent, whatever was typed into it before. A date question
 * may hold the day before anyone answers it (`prefill`), which the person changes or clears.
 *
 * A quiz is a survey whose questions may have a right answer, worth points. Corrected as
 * it goes (`reveal: each`), each graded answer is checked once given — then locked, green
 * or red, the score in a corner —; otherwise the verdicts wait for the end. The end is the
 * score: a ring that fills, the words that go with it, and the recap. In the application
 * the quiz knows its right answers and scores itself, writing the score into its field;
 * through a shared link it knows none of them, and asks the server (`grade`, `submit`).
 */

interface Question {
  readonly field: Field
  readonly label: string
  readonly help: string | null
  readonly required: boolean
  readonly placeholder: string
  /** Holds the day before an answer. */
  readonly today: boolean
  readonly showIf: FormCondition | null
  readonly widget: AnswerWidget
  /** A quiz's question with a right answer — known here or only to the server. */
  readonly graded: boolean
  readonly points: number
  /** The right answer, when this side knows it: in the application, not through a link. */
  readonly correct: QuizAnswer | null
}

function questionsOf(
  spec: FormSpec,
  fields: readonly Field[],
  quiz: boolean,
  graded: ReadonlySet<string> | undefined,
): Question[] {
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
        today: q.prefill === 'today' && (field.kind === 'date' || field.kind === 'datetime'),
        showIf: q.show_if,
        widget: widgetOf(field),
        graded: quiz && (graded?.has(field.name) ?? isGraded(q, field)),
        points: q.points ?? 1,
        correct: quiz && isGraded(q, field) ? (q.correct ?? null) : null,
      },
    ]
  })
}

/**
 * The draft before any answer: empty, but for the questions that hold the day and the
 * fields' defaults (ch. 04 §1.5) — « the person creating » aside, which the kernel fills
 * for a signed-in respondent.
 */
function firstDraft(questions: readonly Question[]): Row {
  const row: Record<string, unknown> = emptyDraft(questions.map((q) => q.field))
  for (const q of questions) {
    const value = q.today ? todayAnswer(q.field.kind) : prefillOf(q.field, null)
    if (value !== undefined) row[q.field.name] = value
  }
  return row as Row
}

/** The questions that hold something before an answer: emptied, they are sent empty. */
function prefilledNames(questions: readonly Question[]): ReadonlySet<string> {
  const first = firstDraft(questions)
  return new Set(
    questions.flatMap((q) => {
      const value = first[q.field.name]
      return value === null || value === undefined ? [] : [q.field.name]
    }),
  )
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
  graded,
  grade,
}: {
  readonly kind: 'form' | 'survey' | 'quiz'
  readonly fields: readonly Field[]
  readonly spec: FormSpec
  readonly viewLabel: string
  /** The table's colour: the accent, when the form does not choose its own. */
  readonly tableColor?: string | null
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onUpload?: Upload
  /**
   * Sends the answer: the values of the questions answered, by field name. A shared quiz
   * resolves to what the server scored; one scored here, to nothing.
   */
  readonly submit: (values: Record<string, unknown>) => Promise<QuizOutcome | null | undefined>
  readonly onSent?: () => void
  /** Who answers, when a shared form knows it: « Vous répondez en tant que … ». */
  readonly respondent?: string | null
  /** A line at the foot of the screen — a shared form's « propulsé par ». */
  readonly footer?: ReactNode
  /** A shared quiz's graded questions: the page knows which, not their answers. */
  readonly graded?: ReadonlySet<string>
  /** Grades one answer on the server — a shared quiz corrected as it goes. */
  readonly grade?: (field: string, value: unknown) => Promise<QuizGrade>
}) {
  const quiz = kind === 'quiz'
  const questions = useMemo(
    () => questionsOf(spec, fields, quiz, graded),
    [spec, fields, quiz, graded],
  )
  const look = useMemo(() => lookStyle(spec, tableColor), [spec, tableColor])

  const [draft, setDraft] = useState<Row>(() => firstDraft(questions))
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
  // A quiz corrected as it goes: each graded answer's verdict, by field; the score, once sent.
  const [verdicts, setVerdicts] = useState<Readonly<Record<string, QuizGrade>>>({})
  const [checking, setChecking] = useState(false)
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null)
  const [given, setGiven] = useState<Readonly<Record<string, unknown>>>({})
  const stepwise = quiz && spec.reveal === 'each'

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
  // A quiz's verdict takes the keyboard to « Continuer »: Enter goes on, whatever had it.
  const action = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (place.at === 'question' && verdicts[place.name] !== undefined) {
      action.current?.focus({ preventScroll: true })
    }
  }, [verdicts, place])
  // A choice answered by its letter leaves the keyboard on the page itself: Enter still
  // goes on, as it does from inside the question.
  useEffect(() => {
    if (kind === 'form' || sent) return
    const listen = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.target !== document.body) return
      e.preventDefault()
      advance.current()
    }
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [kind, sent])
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
      if (kind !== 'form' && first !== undefined) {
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
    const values = writeValues(answered, latest.current, prefilledNames(now))
    for (const q of now) {
      const v = values[q.field.name]
      if (q.widget === 'url' && typeof v === 'string') values[q.field.name] = normalizeUrl(v)
    }
    if (Object.values(values).every((v) => v === null)) {
      setError($t('Répondez à au moins une question.'))
      return
    }
    // A quiz that knows its right answers scores itself — the server's rules, the same
    // count — and writes its score into its field; one shared by a link is scored there.
    const local = quiz ? scoreHere(now, values) : null
    setBusy(true)
    setError(null)
    try {
      const scored = await submit(values)
      setOutcome(scored ?? local)
      setGiven(values)
      setSent(true)
      onSent?.()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  /** The score of a quiz that knows its answers — and the score written into its field. */
  const scoreHere = (shownNow: readonly Question[], values: Record<string, unknown>) => {
    const known = questions.filter((q) => q.correct !== null)
    if (known.length === 0) return null
    const scored = scoreQuiz(
      known.map((q) => ({
        field: q.field.name,
        kind: q.field.kind,
        correct: q.correct,
        points: q.points,
      })),
      values,
      new Set(shownNow.map((q) => q.field.name)),
    )
    const target = fields.find(
      (f) => f.name === spec.score_field && f.kind === 'number' && f.read_only !== true,
    )
    if (target !== undefined) values[target.name] = scored.score
    return {
      score: scored.score,
      max: scored.max,
      passed: quizPassed(scored.score, scored.max, spec.pass_percent),
      marks:
        spec.reveal === 'never'
          ? []
          : scored.marks.map((m) => ({
              ...m,
              correct: known.find((q) => q.field.name === m.field)?.correct as QuizAnswer,
            })),
    } satisfies QuizOutcome
  }

  const restart = () => {
    const empty = firstDraft(questions)
    latest.current = empty
    setDraft(empty)
    setProblems({})
    setError(null)
    setVerdicts({})
    setOutcome(null)
    setSent(false)
    setDirection('up')
    setPlace({ at: 'welcome' })
  }

  const answer = (q: Question, large: boolean, focus: boolean, onDone?: () => void) => {
    const verdict = verdicts[q.field.name]
    const common = {
      field: q.field,
      value: draft[q.field.name],
      onChange: (v: unknown) => commit(q.field, v),
      large,
      placeholder: q.placeholder,
      autoFocus: focus,
      invalid: problems[q.field.name] !== undefined,
      onDone,
      // Graded, a quiz's answer stays as given, and a choice shows what was right.
      locked: verdict !== undefined,
      correct: verdict?.correct ?? null,
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

  if (sent && outcome !== null) {
    const percent = quizPercent(outcome.score, outcome.max)
    return shell(
      <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
        <Celebration
          accent={look.accent}
          confetti={spec.celebrate && scoreCelebrated(outcome)}
          align="center"
          emblem={<ScoreRing score={outcome.score} max={outcome.max} />}
        >
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {scoreHeadline(percent, outcome.passed)}
          </h1>
          <p className="mt-3 text-lg text-(--fm-muted)">
            {$tp(outcome.max, '{score} sur {count} point', '{score} sur {count} points', {
              score: outcome.score,
            })}
            <span aria-hidden> · </span>
            {new Intl.NumberFormat(intlLocale(), { style: 'percent' }).format(percent / 100)}
          </p>
          {spec.pass_percent !== null && (
            <p className="mt-1 text-sm text-(--fm-muted)">
              {$t('Il fallait {percent} % pour réussir.', { percent: spec.pass_percent })}
            </p>
          )}
          {spec.success_message.trim() !== '' && (
            <p className="mx-auto mt-5 max-w-md whitespace-pre-line text-base text-(--fm-muted)">
              {spec.success_message}
            </p>
          )}
          <div className="flex flex-col items-center">
            <Recap outcome={outcome} questions={questions} answers={given} dark={look.dark} />
          </div>
          <div className="mt-8 mb-6 flex flex-wrap justify-center gap-3">
            {spec.end_link_url.trim() !== '' && (
              <a href={spec.end_link_url} className={accentButton(true)}>
                {spec.end_link_label.trim() === '' ? $t('Continuer') : spec.end_link_label}
                <ExternalLink className="size-4" />
              </a>
            )}
            {spec.allow_another && (
              <button type="button" onClick={restart} className={ghostButton}>
                <RotateCcw className="size-4" />
                {$t('Refaire le quiz')}
              </button>
            )}
          </div>
        </Celebration>
      </div>,
    )
  }

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

  /** A graded answer, checked here when the right answer is known, else on the server. */
  const gradeOne = async (q: Question): Promise<QuizGrade | null> => {
    const value = writeValues([q.field], latest.current)[q.field.name] ?? null
    if (q.correct !== null) {
      const right = isRightAnswer(q.field.kind, q.correct, value)
      return { right, points: right ? q.points : 0, correct: q.correct }
    }
    return grade === undefined ? null : grade(q.field.name, value)
  }

  const next = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (checking) return
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
    // A quiz corrected as it goes stops on a graded answer once, to say whether it was
    // right; a right one goes on by itself when the survey lets choices do so.
    if (stepwise && current.graded && verdicts[current.field.name] === undefined) {
      const name = current.field.name
      setChecking(true)
      setError(null)
      void gradeOne(current)
        .then((verdict) => {
          if (verdict === null) return
          setVerdicts((v) => ({ ...v, [name]: verdict }))
          if (verdict.right && spec.auto_advance) {
            timer.current = setTimeout(() => {
              timer.current = null
              advance.current()
            }, VERDICT_MS)
          }
        })
        .catch((e: unknown) => setError(messageFor(e)))
        .finally(() => setChecking(false))
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
  const verdict = current === undefined ? undefined : verdicts[current.field.name]
  // A graded question waits to be checked: its button says so.
  const toCheck = stepwise && current?.graded === true && verdict === undefined
  const running = Object.values(verdicts).reduce((sum, v) => sum + v.points, 0)
  const worth = visible.filter((q) => q.graded).reduce((sum, q) => sum + q.points, 0)

  return shell(
    <>
      {stepwise && place.at === 'question' && <RunningScore score={running} dark={look.dark} />}
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
                {quiz && worth > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    {$tp(worth, '{count} point à gagner', '{count} points à gagner')}
                  </>
                )}
              </p>
              {quiz && spec.pass_percent !== null && (
                <p className="mt-2 text-sm text-(--fm-muted)">
                  {$t('Il faut {percent} % des points pour réussir.', {
                    percent: spec.pass_percent,
                  })}
                </p>
              )}
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
              {current.graded && (
                <div className={cn('mb-4', centered && 'flex justify-center')}>
                  <PointsBadge points={current.points} />
                </div>
              )}
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
                {verdict !== undefined && (
                  <div className={cn(centered && 'flex justify-center')}>
                    <Verdict
                      right={verdict.right}
                      points={verdict.points}
                      correct={verdict.correct}
                      field={current.field}
                      dark={look.dark}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    'mt-8 flex flex-wrap items-center gap-4',
                    centered && 'justify-center',
                  )}
                >
                  <button
                    ref={action}
                    type="button"
                    onClick={next}
                    disabled={busy || checking}
                    className={accentButton(false)}
                  >
                    {busy || checking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : toCheck ? (
                      <Check className="size-4" />
                    ) : last ? (
                      <Send className="size-4" />
                    ) : verdict !== undefined ? (
                      <ArrowRight className="size-4" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {toCheck
                      ? $t('Vérifier')
                      : last
                        ? submitLabel
                        : verdict !== undefined
                          ? $t('Continuer')
                          : $t('OK')}
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

/** How long a right answer's verdict shows before the next question comes by itself. */
const VERDICT_MS = 1300

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
