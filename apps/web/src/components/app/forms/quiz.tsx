'use client'

import type { Field, QuizOutcome } from '@/lib/api/client'
import { displayStored } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { $t, $tp } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { quizPercent } from '@basedb/contracts'
import { Check, Trophy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { yesNoKeys } from './answers'

/**
 * A quiz's pieces, drawn in its form's theme (form-fill.tsx): what a question is worth,
 * the verdict under an answer, the score that fills its ring at the end, the words that
 * go with it, and the recap of every graded question.
 */

/** An answer as a person reads it: a choice by its label, a number in its format, a day written. */
export function answerText(field: Field, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const label = (v: unknown) => field.options?.find((o) => o.value === v)?.label ?? String(v)
  switch (field.kind) {
    case 'select':
      return label(value)
    case 'multi_select':
      return (Array.isArray(value) ? value : [value]).map(label).join(', ')
    case 'boolean': {
      const keys = yesNoKeys()
      return value === true ? keys.yesLabel : keys.noLabel
    }
    case 'number':
      return formatNumber(String(value), field)
    case 'date':
    case 'datetime':
      return typeof value === 'string' ? displayStored(value, field.kind) : String(value)
    default:
      // A written answer's right answer is the list of texts accepted: the first says it.
      return Array.isArray(value) ? String(value[0] ?? '—') : String(value)
  }
}

/** What a question is worth, over its words. */
export function PointsBadge({ points }: { readonly points: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-(--fm-accent-soft) px-2.5 py-1 text-xs font-semibold text-(--fm-accent)">
      <Trophy className="size-3.5" />
      {$tp(points, '{count} point', '{count} points')}
    </span>
  )
}

/** The score so far, in a corner of a quiz that corrects as it goes: it pops when it grows. */
export function RunningScore({ score, dark }: { readonly score: number; readonly dark: boolean }) {
  return (
    <div
      className={cn(
        'absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur',
        dark ? 'bg-white/10 text-white' : 'bg-white/80 text-(--fm-fg)',
      )}
    >
      <Trophy className="size-4 text-(--fm-accent)" />
      <span key={score} className="animate-form-pop tabular-nums">
        {$tp(score, '{count} point', '{count} points')}
      </span>
    </div>
  )
}

/** Right or not, under the answer — and, when not, the answer that was. */
export function Verdict({
  right,
  points,
  correct,
  field,
  dark,
}: {
  readonly right: boolean
  readonly points: number
  readonly correct: unknown
  readonly field: Field
  readonly dark: boolean
}) {
  return (
    <output
      className={cn(
        'mt-6 flex max-w-xl animate-form-rise items-start gap-3 rounded-(--fm-radius) px-4 py-3',
        right
          ? dark
            ? 'bg-emerald-500/20 text-emerald-100'
            : 'bg-emerald-50 text-emerald-900'
          : dark
            ? 'bg-red-500/20 text-red-100'
            : 'bg-red-50 text-red-900',
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 animate-form-pop items-center justify-center rounded-full text-white',
          right ? 'bg-emerald-500' : 'bg-red-500',
        )}
      >
        {right ? (
          <Check className="size-4" strokeWidth={3} />
        ) : (
          <X className="size-4" strokeWidth={3} />
        )}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold">
          {right
            ? $tp(points, 'Bonne réponse ! +{count} point', 'Bonne réponse ! +{count} points')
            : $t('Ce n’est pas ça.')}
        </p>
        {!right && (
          <p className="mt-0.5 text-sm opacity-90">
            {$t('La bonne réponse : {answer}', { answer: answerText(field, correct) })}
          </p>
        )}
      </div>
    </output>
  )
}

/** The score, filling its ring from nothing — counted up, unless motion is unwelcome. */
export function ScoreRing({ score, max }: { readonly score: number; readonly max: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(score)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400)
      setShown(score * (1 - (1 - t) ** 3))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    // The ring waits for the screen to settle before it fills.
    const wait = setTimeout(() => {
      frame = requestAnimationFrame(tick)
    }, 350)
    return () => {
      clearTimeout(wait)
      cancelAnimationFrame(frame)
    }
  }, [score])
  const radius = 52
  const around = 2 * Math.PI * radius
  const fraction = max > 0 ? Math.min(1, shown / max) : 0
  return (
    <div className="relative size-44 animate-form-pop">
      <svg viewBox="0 0 120 120" aria-hidden="true" className="size-44 -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--fm-accent-soft)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--fm-accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={around}
          strokeDashoffset={around * (1 - fraction)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-semibold tracking-tight tabular-nums">
          {Math.round(shown)}
        </span>
        <span className="text-sm text-(--fm-muted)">{$t('sur {max}', { max })}</span>
      </div>
    </div>
  )
}

/** The words over a score: the pass mark's verdict when there is one, else how well it went. */
export function scoreHeadline(percent: number, passed: boolean | null): string {
  if (passed === true) return $t('Réussi !')
  if (passed === false) return $t('Pas cette fois…')
  if (percent === 100) return $t('Sans faute !')
  if (percent >= 75) return $t('Bravo !')
  if (percent >= 50) return $t('Pas mal !')
  return $t('Vous ferez mieux la prochaine fois')
}

/** Whether a score is worth confetti: passed, or three quarters without a pass mark. */
export const scoreCelebrated = (outcome: QuizOutcome) =>
  outcome.passed ?? quizPercent(outcome.score, outcome.max) >= 75

/** Every graded question, right or not: the answer given, and the right one when it was not. */
export function Recap({
  outcome,
  questions,
  answers,
  dark,
}: {
  readonly outcome: QuizOutcome
  readonly questions: ReadonlyArray<{ readonly field: Field; readonly label: string }>
  readonly answers: Readonly<Record<string, unknown>>
  readonly dark: boolean
}) {
  const lines = outcome.marks.flatMap((mark) => {
    const question = questions.find((q) => q.field.name === mark.field)
    return question === undefined ? [] : [{ mark, question }]
  })
  if (lines.length === 0) return null
  return (
    <ol className="mt-10 w-[min(36rem,calc(100vw-3rem))] divide-y divide-(--fm-border) overflow-hidden rounded-(--fm-radius) border border-(--fm-border) bg-(--fm-surface) text-left">
      {lines.map(({ mark, question }) => (
        <li key={mark.field} className="flex items-start gap-3 px-4 py-3">
          <span
            className={cn(
              'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white',
              mark.right ? 'bg-emerald-500' : 'bg-red-500',
            )}
          >
            {mark.right ? (
              <Check className="size-3.5" strokeWidth={3} />
            ) : (
              <X className="size-3.5" strokeWidth={3} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{question.label}</p>
            {mark.right ? (
              <p className="mt-0.5 text-sm text-(--fm-muted)">
                {answerText(question.field, answers[mark.field])}
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-sm text-(--fm-muted) line-through decoration-red-500/60">
                  {answerText(question.field, answers[mark.field])}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-sm font-medium',
                    dark ? 'text-emerald-300' : 'text-emerald-700',
                  )}
                >
                  {answerText(question.field, mark.correct)}
                </p>
              </>
            )}
          </div>
          <span
            className={cn(
              'shrink-0 pt-0.5 text-sm font-semibold tabular-nums',
              mark.right ? 'text-(--fm-accent)' : 'text-(--fm-muted)',
            )}
          >
            {mark.right ? `+${mark.points}` : `0 / ${mark.of}`}
          </span>
        </li>
      ))}
    </ol>
  )
}
