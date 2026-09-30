'use client'

import { FormFill } from '@/components/app/forms/form-fill'
import { Login } from '@/components/login'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError, type Field, type SharedForm, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { useTheme } from '@/lib/theme'
import type { FormSpec } from '@/lib/views'
import { Ban, Link2Off, Loader2, Lock } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * A shared form — chapter 15: the page someone opens from a link.
 *
 * Outside the application: no navigation, no table, nothing but the form. A public form
 * answers anyone; a form for members asks to sign in first, and says in whose name the
 * answer goes. What does not answer — an unknown link, a closed form, a group one is not
 * in — says so in a sentence, not with a code.
 */

type Page =
  | { readonly kind: 'loading' }
  | { readonly kind: 'login' }
  | { readonly kind: 'ready'; readonly form: SharedForm }
  | {
      readonly kind: 'refused'
      readonly title: string
      readonly text: string
      readonly icon: 'closed' | 'unknown' | 'locked'
    }

const CLOSED: Readonly<Record<string, string>> = {
  inactive: $t('Son auteur l’a désactivé.'),
  closed: $t('La date limite pour répondre est passée.'),
  full: $t('Le nombre maximal de réponses est atteint.'),
  authority: $t('Ce formulaire est suspendu : son auteur ne peut plus ajouter de réponses.'),
  sans_question: $t('Il ne pose plus aucune question.'),
}

function refusal(error: unknown): Page {
  if (error instanceof ApiError && error.code === 'FORM_CLOSED') {
    const reason = typeof error.details.reason === 'string' ? error.details.reason : ''
    return {
      kind: 'refused',
      icon: 'closed',
      title: $t('Ce formulaire n’accepte plus de réponses'),
      text: CLOSED[reason] ?? $t('Il a été fermé.'),
    }
  }
  if (error instanceof ApiError && error.code === 'FORM_RESTRICTED') {
    return {
      kind: 'refused',
      icon: 'locked',
      title: $t('Formulaire réservé'),
      text: $t('Ce formulaire est réservé à certains groupes, dont vous ne faites pas partie.'),
    }
  }
  if (error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND') {
    return {
      kind: 'refused',
      icon: 'unknown',
      title: $t('Lien introuvable'),
      text: $t(
        'Ce lien ne mène à aucun formulaire : il a pu être remplacé par un autre, ou retiré.',
      ),
    }
  }
  return {
    kind: 'refused',
    icon: 'unknown',
    title: $t('Formulaire indisponible'),
    text: messageFor(error),
  }
}

/** The shared form's questions, as the fields and the spec the form screen reads. */
function screenOf(form: SharedForm): { fields: Field[]; spec: FormSpec } {
  const design = form.design
  return {
    fields: form.questions.map((q) => ({
      name: q.name,
      label: q.label,
      description: null,
      kind: q.kind,
      required: q.required,
      ...(q.options === null ? {} : { options: q.options }),
      // What the question holds before an answer: the field's default (04 §1.5).
      ...(q.default === null || q.default === undefined ? {} : { default: q.default }),
      // A rating reads in stars, an amount with its currency, a phone number as one.
      ...(q.format === null
        ? {}
        : {
            format: {
              display: q.format.display,
              rating_max: q.format.rating_max,
              currency: q.format.currency,
            },
          }),
    })),
    spec: {
      title: form.title,
      description: form.description,
      fields: form.questions.map((q) => ({
        field: q.name,
        required: q.required,
        label: q.label,
        help: q.help ?? '',
        placeholder: q.placeholder ?? '',
        prefill: q.prefill,
        show_if: q.show_if,
        // A quiz's points travel; its right answers stay on the server.
        ...(q.points === null ? {} : { points: q.points }),
      })),
      submit_label: form.submit_label,
      success_message: form.success_message,
      allow_another: form.allow_another,
      theme: design.theme,
      // The server already chose between the form's accent and its table's.
      accent: design.accent ?? '',
      font: design.font,
      align: design.align,
      welcome_label: design.welcome_label,
      show_progress: design.show_progress,
      show_numbers: design.show_numbers,
      auto_advance: design.auto_advance,
      celebrate: design.celebrate,
      end_link_label: design.end_link?.label ?? '',
      end_link_url: design.end_link?.url ?? '',
      // The score is written by the server: the page has no field to write it into.
      score_field: null,
      reveal: form.quiz?.reveal ?? 'each',
      pass_percent: form.quiz?.pass_percent ?? null,
    },
  }
}

const noSearch = async () => ({ options: [], truncated: false, filtered: true })

export default function SharedFormPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState<Page>({ kind: 'loading' })

  useEffect(() => useTheme.getState().initialize(), [])

  const load = useCallback(async () => {
    setPage({ kind: 'loading' })
    try {
      const form = await api.sharedForm(token)
      document.title = form.title
      setPage({ kind: 'ready', form })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'AUTHENTICATION_REQUIRED') {
        setPage({ kind: 'login' })
        return
      }
      setPage(refusal(e))
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const form = page.kind === 'ready' ? page.form : null
  const screen = useMemo(() => (form === null ? null : screenOf(form)), [form])
  // A quiz's graded questions: the page knows which, and asks the server whether an answer is right.
  const graded = useMemo(
    () => new Set(form?.questions.filter((q) => q.points !== null).map((q) => q.name) ?? []),
    [form],
  )

  if (page.kind === 'login') {
    return (
      <div className="relative">
        <p className="absolute top-4 right-0 left-0 z-10 mx-auto w-fit rounded-full border bg-background/90 px-4 py-1.5 text-sm shadow-xs">
          {$t('Connectez-vous pour répondre à ce formulaire.')}
        </p>
        <Login onSignedIn={() => void load()} />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh flex-col bg-muted/30">
        {page.kind === 'loading' && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {page.kind === 'refused' && (
          <div className="flex flex-1 items-center justify-center px-4">
            <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-xs">
              {page.icon === 'closed' ? (
                <Ban className="mx-auto size-8 text-muted-foreground" />
              ) : page.icon === 'locked' ? (
                <Lock className="mx-auto size-8 text-muted-foreground" />
              ) : (
                <Link2Off className="mx-auto size-8 text-muted-foreground" />
              )}
              <h1 className="mt-4 text-lg font-semibold">{page.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{page.text}</p>
            </div>
          </div>
        )}
        {page.kind === 'ready' && screen !== null && (
          <FormFill
            kind={page.form.kind}
            fields={screen.fields}
            spec={screen.spec}
            viewLabel={page.form.title}
            linkOptions={{}}
            onSearchLink={noSearch}
            respondent={page.form.respondent}
            footer={$t('Formulaire propulsé par basedb')}
            graded={graded}
            grade={(field, value) => api.checkSharedAnswer(token, field, value)}
            submit={async (values) => {
              try {
                const answered = await api.submitSharedForm(token, values)
                return answered.quiz
              } catch (e) {
                // Closed while it was being filled: the page says so, not a line under a button.
                if (e instanceof ApiError && e.code === 'FORM_CLOSED') setPage(refusal(e))
                throw e
              }
            }}
          />
        )}
        {page.kind !== 'ready' && (
          <footer className="shrink-0 py-3 text-center text-xs text-muted-foreground">
            {$t('Formulaire propulsé par basedb')}
          </footer>
        )}
      </div>
    </TooltipProvider>
  )
}
