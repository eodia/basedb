'use client'

import { Choice } from '@/components/ui/choice'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { Field } from '@/lib/api/client'
import { editText, parseNumberInput } from '@/lib/format'
import { $t, $tp } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { type FormQuestion, isGraded } from '@/lib/views'
import {
  QUIZ_KINDS,
  QUIZ_MAX_ACCEPTED,
  QUIZ_MAX_POINTS,
  QUIZ_TEXT_KINDS,
  type QuizAnswer,
  type QuizReveal,
} from '@basedb/contracts'
import { Check, Eye, EyeOff, ListChecks, Trophy } from 'lucide-react'
import { useId, useState } from 'react'

/**
 * A quiz's editor (views/view-dialog.tsx): under each question, its right answer and what
 * it is worth; for the whole quiz, when the answers show, the pass mark, and the field the
 * score goes into. A question without a right answer is asked, not graded — a name, a
 * comment — and says so.
 */

const NONE = '__none__'

/** The right answer of one question, in the shape of its field — and its points. */
export function AnswerKeyEditor({
  field,
  question,
  onChange,
}: {
  readonly field: Field
  readonly question: FormQuestion
  readonly onChange: (patch: Partial<FormQuestion>) => void
}) {
  if (!QUIZ_KINDS.includes(field.kind)) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Trophy className="size-3.5" />
        {$t('Question non notée : ce type de champ n’a pas de bonne réponse.')}
      </p>
    )
  }
  const correct = question.correct ?? null
  const set = (next: QuizAnswer | null) => onChange({ correct: next, points: question.points ?? 1 })
  const graded = isGraded(question, field)
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs',
        graded ? 'bg-orange-500/8' : 'bg-muted/60',
      )}
    >
      <Trophy
        className={cn(
          'size-3.5',
          graded ? 'text-orange-600 dark:text-orange-300' : 'text-muted-foreground',
        )}
      />
      <span className="text-muted-foreground">{$t('Bonne réponse')}</span>
      <div className="min-w-0 flex-1">
        <AnswerInput field={field} correct={correct} onChange={set} />
      </div>
      {graded && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Input
            type="number"
            min={1}
            max={QUIZ_MAX_POINTS}
            step={1}
            value={question.points ?? 1}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              if (Number.isFinite(n)) {
                onChange({ points: Math.min(QUIZ_MAX_POINTS, Math.max(1, n)) })
              }
            }}
            className="h-7 w-14 text-xs"
            aria-label={$t('Points de la question {label}', { label: field.label })}
          />
          {$tp(question.points ?? 1, 'point', 'points')}
        </div>
      )}
    </div>
  )
}

/** The answer's own input: the options to pick, yes or no, a number, a day, or the texts accepted. */
function AnswerInput({
  field,
  correct,
  onChange,
}: {
  readonly field: Field
  readonly correct: QuizAnswer | null
  readonly onChange: (next: QuizAnswer | null) => void
}) {
  const options = field.options ?? []
  switch (field.kind) {
    case 'select':
      return (
        <Choice
          size="xs"
          value={typeof correct === 'string' ? correct : NONE}
          onValueChange={(v) => onChange(v === NONE ? null : v)}
          options={[
            { value: NONE, label: $t('Aucune — question non notée') },
            ...options.map((o) => ({ value: o.value, label: o.label })),
          ]}
          aria-label={$t('Bonne réponse de {label}', { label: field.label })}
          className="w-full max-w-64"
        />
      )
    case 'multi_select': {
      const chosen = Array.isArray(correct) ? correct : []
      return (
        <div className="flex flex-wrap gap-1">
          {options.map((o) => {
            const on = chosen.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on ? chosen.filter((v) => v !== o.value) : [...chosen, o.value]
                  onChange(next.length === 0 ? null : next)
                }}
                className={cn(
                  'inline-flex h-6 items-center gap-1 rounded-full border px-2 transition-colors',
                  on
                    ? 'border-orange-500/60 bg-orange-500/15 text-foreground'
                    : 'bg-background text-muted-foreground hover:bg-accent',
                )}
              >
                {on && <Check className="size-3" />}
                {o.label}
              </button>
            )
          })}
        </div>
      )
    }
    case 'boolean':
      return (
        <Choice
          size="xs"
          value={correct === true ? 'true' : correct === false ? 'false' : NONE}
          onValueChange={(v) => onChange(v === NONE ? null : v === 'true')}
          options={[
            { value: NONE, label: $t('Aucune — question non notée') },
            { value: 'true', label: $t('Oui') },
            { value: 'false', label: $t('Non') },
          ]}
          aria-label={$t('Bonne réponse de {label}', { label: field.label })}
          className="w-full max-w-52"
        />
      )
    case 'number':
      return <NumberAnswer field={field} correct={correct} onChange={onChange} />
    case 'date':
      return (
        <Input
          type="date"
          value={typeof correct === 'string' ? correct : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          className="h-7 w-auto text-xs"
          aria-label={$t('Bonne réponse de {label}', { label: field.label })}
        />
      )
    default:
      return QUIZ_TEXT_KINDS.includes(field.kind) ? (
        <TextAnswers field={field} correct={correct} onChange={onChange} />
      ) : null
  }
}

/** A number, typed as the field reads it — a comma in French, the field's format. */
function NumberAnswer({
  field,
  correct,
  onChange,
}: {
  readonly field: Field
  readonly correct: QuizAnswer | null
  readonly onChange: (next: QuizAnswer | null) => void
}) {
  const [typed, setTyped] = useState(() =>
    typeof correct === 'number' ? editText(correct, field) : '',
  )
  return (
    <Input
      inputMode="decimal"
      value={typed}
      onChange={(e) => {
        setTyped(e.target.value)
        const n = parseNumberInput(e.target.value, field)
        onChange(typeof n === 'number' && Number.isFinite(n) ? n : null)
      }}
      placeholder={$t('Aucune — question non notée')}
      className="h-7 w-full max-w-52 text-xs"
      aria-label={$t('Bonne réponse de {label}', { label: field.label })}
    />
  )
}

/** The texts accepted, separated by semicolons: any of them is right, case and accents aside. */
function TextAnswers({
  field,
  correct,
  onChange,
}: {
  readonly field: Field
  readonly correct: QuizAnswer | null
  readonly onChange: (next: QuizAnswer | null) => void
}) {
  const [typed, setTyped] = useState(() => (Array.isArray(correct) ? correct.join(' ; ') : ''))
  return (
    <Input
      value={typed}
      onChange={(e) => {
        setTyped(e.target.value)
        const accepted = e.target.value
          .split(';')
          .map((t) => t.trim())
          .filter((t, i, all) => t !== '' && all.indexOf(t) === i)
          .slice(0, QUIZ_MAX_ACCEPTED)
        onChange(accepted.length === 0 ? null : accepted)
      }}
      placeholder={$t('Paris ; Lutèce — plusieurs réponses acceptées, séparées par ;')}
      className="h-7 w-full text-xs"
      maxLength={2000}
      aria-label={$t('Bonne réponse de {label}', { label: field.label })}
    />
  )
}

const REVEALS: ReadonlyArray<{
  readonly value: QuizReveal
  readonly icon: typeof Eye
  readonly title: string
  readonly text: string
}> = [
  {
    value: 'each',
    icon: ListChecks,
    title: $t('Après chaque question'),
    text: $t('Chaque réponse est corrigée aussitôt, en vert ou en rouge.'),
  },
  {
    value: 'end',
    icon: Eye,
    title: $t('À la fin'),
    text: $t('Le score, puis le corrigé de chaque question.'),
  },
  {
    value: 'never',
    icon: EyeOff,
    title: $t('Jamais'),
    text: $t('Le score seul : les bonnes réponses restent secrètes.'),
  },
]

/** How the whole quiz grades: when the answers show, the pass mark, where the score goes. */
export function GradingSettings({
  reveal,
  passPercent,
  scoreField,
  numberFields,
  graded,
  total,
  onChange,
}: {
  readonly reveal: QuizReveal
  readonly passPercent: number | null
  readonly scoreField: string | null
  /** The number fields the score may go into — none of them a question. */
  readonly numberFields: readonly Field[]
  /** How many questions are graded, and the points they are worth together. */
  readonly graded: number
  readonly total: number
  readonly onChange: (key: 'reveal' | 'pass_percent' | 'score_field', value: unknown) => void
}) {
  const passId = useId()
  return (
    <div className="space-y-4">
      <p
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
          graded === 0
            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200'
            : 'bg-orange-500/8 text-foreground',
        )}
      >
        <Trophy className="size-4 shrink-0 text-orange-600 dark:text-orange-300" />
        {graded === 0
          ? $t('Aucune question notée : donnez la bonne réponse d’au moins une question.')
          : `${$tp(graded, '{count} question notée', '{count} questions notées')} · ${$tp(total, '{count} point au total', '{count} points au total')}`}
      </p>

      <div>
        <p className="mb-2 text-sm font-medium">{$t('Corriger')}</p>
        <div role="radiogroup" aria-label={$t('Corriger')} className="grid gap-2 sm:grid-cols-3">
          {REVEALS.map((r) => {
            const on = reveal === r.value
            const Icon = r.icon
            return (
              <button
                key={r.value}
                type="button"
                // biome-ignore lint/a11y/useSemanticElements: cards that say what they choose, the ARIA radio pattern
                role="radio"
                aria-checked={on}
                onClick={() => onChange('reveal', r.value)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-shadow',
                  on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent/50',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className={cn('size-4', on ? 'text-primary' : 'text-muted-foreground')} />
                  {r.title}
                </span>
                <span className="text-xs text-muted-foreground">{r.text}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Switch
              id={passId}
              checked={passPercent !== null}
              onCheckedChange={(v) => onChange('pass_percent', v ? 50 : null)}
            />
            <label htmlFor={passId}>{$t('Seuil de réussite')}</label>
          </div>
          {passPercent !== null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Input
                type="number"
                min={1}
                max={100}
                value={passPercent}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value))
                  if (Number.isFinite(n)) onChange('pass_percent', Math.min(100, Math.max(1, n)))
                }}
                className="h-8 w-20 text-sm"
                aria-label={$t('Pourcentage des points pour réussir')}
              />
              {$t('% des points pour réussir')}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm">{$t('Enregistrer le score dans')}</p>
          <Choice
            value={scoreField ?? NONE}
            onValueChange={(v) => onChange('score_field', v === NONE ? null : v)}
            options={[
              { value: NONE, label: $t('Nulle part — le score est seulement affiché') },
              ...numberFields.map((f) => ({ value: f.name, label: f.label })),
            ]}
            aria-label={$t('Champ du score')}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            {numberFields.length === 0
              ? $t('Ajoutez un champ nombre à la table pour y garder chaque score.')
              : $t('Un champ nombre : triez la grille dessus, et voilà le classement.')}
          </p>
        </div>
      </div>
    </div>
  )
}
