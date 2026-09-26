'use client'

import { hasDescription } from '@/components/app/description'
import type { Upload } from '@/components/app/files'
import type { Row } from '@/components/app/grid/cell'
import type { SearchLink } from '@/components/app/pickers'
import { PanelField, emptyDraft, writeValues } from '@/components/app/record-panel'
import { Unavailable } from '@/components/app/views/kanban-view'
import { Button } from '@/components/ui/button'
import { type Field, type LinkOption, type Table, api, filesOf } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import type { FormQuestion, FormSpec } from '@/lib/views'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CornerDownLeft,
  Loader2,
  Send,
  Share2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * The form and the survey — a row asked for, rather than shown (ch. 11 §1.4).
 *
 * Both write ONE row with ONE `POST` on sending, like the new-record panel: nothing exists
 * half-filled, and a required field is asked for before the round trip rather than
 * refused after it. The form shows every question on one page; the survey shows them one
 * by one — a welcome, a question per screen with a progress bar, and a thank-you.
 *
 * A question is required when the view says so, or when the field itself is: a form cannot
 * make a required column optional, since the database would refuse the row anyway.
 */

interface Question {
  readonly field: Field
  readonly label: string
  readonly help: string | null
  readonly required: boolean
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
      },
    ]
  })
}

/** True when the draft holds nothing for this field. */
function isEmpty(field: Field, value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (field.kind === 'link') return typeof (value as { id?: unknown }).id !== 'string'
  if (field.kind === 'file' || field.kind === 'image') return filesOf(value).length === 0
  if (field.kind === 'multi_select') return !Array.isArray(value) || value.length === 0
  // An unticked box is an answer — « non » — and never a missing one.
  return false
}

/**
 * The form as the application shows it, to whoever may add rows to its table — and, to
 * whoever builds it, the way to share it (chapter 15).
 */
export function FormView({
  kind,
  table,
  fields,
  spec,
  viewLabel,
  linkOptions,
  onSearchLink,
  onUpload,
  onCreated,
  onShare,
}: {
  readonly kind: 'form' | 'survey'
  readonly table: Table
  readonly fields: readonly Field[]
  readonly spec: FormSpec
  readonly viewLabel: string
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onUpload?: Upload
  /** A row was written: the other views of the table have one more. */
  readonly onCreated: () => void
  /** Opens the sharing of this form — offered to whoever builds the table. */
  readonly onShare?: () => void
}) {
  const share =
    onShare === undefined ? null : (
      <div className="absolute top-3 right-4 z-10">
        <Button variant="outline" size="sm" onClick={onShare} className="bg-background">
          <Share2 className="size-4" />
          Partager
        </Button>
      </div>
    )
  if (!table.actions.includes('create')) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        {share}
        <Unavailable>
          Vous ne pouvez pas ajouter de lignes à « {table.label} » : ce formulaire ne vous est pas
          ouvert.
        </Unavailable>
      </div>
    )
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {share}
      <FormFill
        kind={kind}
        fields={fields}
        spec={spec}
        viewLabel={viewLabel}
        linkOptions={linkOptions}
        onSearchLink={onSearchLink}
        onUpload={onUpload}
        submit={async (values) => {
          await api.createRecord(table, values)
        }}
        onSent={onCreated}
      />
    </div>
  )
}

/**
 * Filling a form or a survey in, and sending it — wherever it is answered: in the
 * application, or through a shared link (chapter 15), which says how the answer is sent.
 */
export function FormFill({
  kind,
  fields,
  spec,
  viewLabel,
  linkOptions,
  onSearchLink,
  onUpload,
  submit,
  onSent,
  respondent,
}: {
  readonly kind: 'form' | 'survey'
  readonly fields: readonly Field[]
  readonly spec: FormSpec
  readonly viewLabel: string
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onUpload?: Upload
  /** Sends the answer: the values of the questions answered, by field name. */
  readonly submit: (values: Record<string, unknown>) => Promise<void>
  readonly onSent?: () => void
  /** Who answers, when a shared form knows it: « Vous répondez en tant que … ». */
  readonly respondent?: string | null
}) {
  const questions = useMemo(() => questionsOf(spec, fields), [spec, fields])
  const writable = useMemo(() => questions.map((q) => q.field), [questions])

  const [draft, setDraft] = useState<Row>(() => emptyDraft(writable))
  // The click on « Envoyer » blurs the text being typed, and that blur is what commits it:
  // the handlers read the draft through a ref so they see that last commit.
  const latest = useRef(draft)
  latest.current = draft
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  /** The survey's screen: -1 the welcome, then one per question. */
  const [step, setStep] = useState(-1)

  const title = spec.title.trim() === '' ? viewLabel : spec.title

  // Each screen of the survey takes the keyboard where the answer goes.
  const questionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (step < 0) return
    questionRef.current?.querySelector<HTMLElement>('input, textarea, button, [tabindex]')?.focus()
  }, [step])

  if (questions.length === 0) {
    return (
      <Unavailable>
        Ce formulaire ne pose plus aucune question que vous puissiez remplir : ses champs ont été
        supprimés, ou ne vous sont pas ouverts.
      </Unavailable>
    )
  }

  const commit = async (field: Field, value: unknown) => {
    setError(null)
    setMissing((m) => {
      if (!m.has(field.name)) return m
      const next = new Set(m)
      next.delete(field.name)
      return next
    })
    setDraft((current) => {
      const next = {
        ...current,
        // A link reads as `{ id, display }`; the picker hands back the identifier alone.
        [field.name]:
          field.kind === 'link' && typeof value === 'string' ? { id: value, display: null } : value,
      } as Row
      latest.current = next
      return next
    })
  }

  const unanswered = (list: readonly Question[]) =>
    list.filter((q) => q.required && isEmpty(q.field, latest.current[q.field.name]))

  const send = async () => {
    const lacking = unanswered(questions)
    if (lacking.length > 0) {
      setMissing(new Set(lacking.map((q) => q.field.name)))
      setError(
        lacking.length === 1
          ? `« ${lacking[0]?.label} » est obligatoire.`
          : `${lacking.length} questions obligatoires sont sans réponse.`,
      )
      if (kind === 'survey') setStep(questions.findIndex((q) => q === lacking[0]))
      return
    }
    const values = writeValues(writable, latest.current)
    if (Object.keys(values).length === 0) {
      setError('Répondez à au moins une question.')
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
    setMissing(new Set())
    setError(null)
    setSent(false)
    setStep(-1)
  }

  const field = (q: Question) => (
    <QuestionBlock
      key={q.field.name}
      question={q}
      missing={missing.has(q.field.name)}
      large={kind === 'survey'}
    >
      <PanelField
        field={q.field}
        row={draft}
        options={linkOptions[q.field.name]}
        onSearchLink={onSearchLink}
        onCommit={(value) => commit(q.field, value)}
        onUpload={onUpload}
        live
      />
    </QuestionBlock>
  )

  if (sent) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <p className="max-w-md whitespace-pre-line text-base">
            {spec.success_message.trim() === ''
              ? 'Merci, votre réponse a été enregistrée.'
              : spec.success_message}
          </p>
          {spec.allow_another && (
            <Button variant="outline" onClick={restart} className="mt-2">
              Envoyer une autre réponse
            </Button>
          )}
        </div>
      </Shell>
    )
  }

  const submitLabel = spec.submit_label.trim() === '' ? 'Envoyer' : spec.submit_label

  if (kind === 'form') {
    return (
      <Shell>
        <header className="border-b pb-5">
          <h1 className="text-xl font-semibold">{title}</h1>
          {spec.description.trim() !== '' && (
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {spec.description}
            </p>
          )}
          {respondent != null && (
            <p className="mt-3 text-xs text-muted-foreground">
              Vous répondez en tant que{' '}
              <span className="font-medium text-foreground">{respondent}</span>.
            </p>
          )}
        </header>
        <div className="space-y-6 py-6">{questions.map((q) => field(q))}</div>
        <footer className="flex items-center gap-3 border-t pt-5">
          <Button onClick={() => void send()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitLabel}
          </Button>
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </footer>
      </Shell>
    )
  }

  // ── The survey ─────────────────────────────────────────────────────────────────────

  const current = step >= 0 ? questions[step] : undefined
  const last = step === questions.length - 1

  const next = () => {
    if (current !== undefined && unanswered([current]).length > 0) {
      setMissing(new Set([current.field.name]))
      setError(`« ${current.label} » est obligatoire.`)
      return
    }
    setError(null)
    if (last) void send()
    else setStep((s) => s + 1)
  }

  return (
    <Shell>
      {/* Decoration: the « 3 / 7 » over each question says the same in words. */}
      <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(Math.max(0, step) / questions.length) * 100}%` }}
        />
      </div>

      {current === undefined ? (
        <div className="flex min-h-80 flex-col justify-center gap-4 py-10">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {spec.description.trim() !== '' && (
            <p className="whitespace-pre-line text-base text-muted-foreground">
              {spec.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {questions.length} question{questions.length > 1 ? 's' : ''}
          </p>
          <div>
            <Button size="lg" onClick={() => setStep(0)} autoFocus>
              Commencer
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-80 flex-col justify-center gap-6 py-10"
          onKeyDown={(e) => {
            // Enter goes on, as in any questionnaire — except in a long text, where it is a
            // new line. The field commits on the same key first; the next screen waits for it.
            const target = e.target as HTMLElement
            if (e.key !== 'Enter' || e.shiftKey || target.tagName === 'TEXTAREA') return
            if (target.closest('.cm-editor, [role="listbox"], [role="dialog"]') !== null) return
            setTimeout(next, 0)
          }}
        >
          <p className="text-xs font-medium tabular-nums text-primary">
            {step + 1} / {questions.length}
          </p>
          <div ref={questionRef}>{field(current)}</div>
          <div className="flex items-center gap-3">
            <Button onClick={next} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : last ? (
                <Send className="size-4" />
              ) : null}
              {last ? submitLabel : 'Suivant'}
              {!last && <ArrowRight className="size-4" />}
            </Button>
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              ou Entrée <CornerDownLeft className="size-3" />
            </span>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              <ArrowLeft className="size-4" />
              Précédent
            </Button>
          </div>
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 scroll-discret">
      <div className="mx-auto my-6 w-full max-w-2xl rounded-xl border bg-background p-6 shadow-xs sm:p-8">
        {children}
      </div>
    </div>
  )
}

function QuestionBlock({
  question,
  missing,
  large,
  children,
}: {
  readonly question: Question
  readonly missing: boolean
  readonly large: boolean
  readonly children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className={cn('font-medium', large ? 'text-lg' : 'text-sm')}>
        {question.label}
        {question.required && (
          <span className="ml-0.5 text-destructive" title="Obligatoire">
            *
          </span>
        )}
      </p>
      {question.help !== null && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{question.help}</p>
      )}
      <div className={cn('rounded-md', missing && 'ring-2 ring-destructive/40 ring-offset-2')}>
        {children}
      </div>
    </div>
  )
}
