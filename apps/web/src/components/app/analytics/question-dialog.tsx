'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
import { AUDIENCES } from '@/components/app/sql/query-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, type QueryAudience, type Question, api } from '@/lib/api/client'
import { $t, groupName } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import type { QuestionQuery, Visualization } from '@basedb/contracts'
import { useEffect, useState } from 'react'

/**
 * Saving a question — built with the mouse or written in SQL — or changing what a saved one
 * is called and who sees it (chapter 18 §1).
 *
 * The three audiences of the saved queries, and the dialog says what each one shares: the
 * question. Whoever opens it runs it with their own rights, so sharing one with a group
 * never shows its members what its author reads and they do not. Sharing is building the
 * base: offered to whoever manages it, the server deciding anyway.
 */
export function QuestionDialog({
  open,
  base,
  manages,
  question,
  draft,
  audience: firstAudience = 'personal',
  onClose,
  onSaved,
}: {
  readonly open: boolean
  /** The base's name. */
  readonly base: string
  /** The caller manages the base's structure: they may share a question. */
  readonly manages: boolean
  /** The question whose properties are changed; `null` saves `draft` as a new one. */
  readonly question: Question | null
  /** What a new question is made of — its name proposed when it has one. */
  readonly draft?: {
    readonly label?: string
    readonly description?: string | null
    readonly query: QuestionQuery
    readonly visualization: Visualization
  }
  /** Who a new question is offered to — the whole base, for one meant for a dashboard. */
  readonly audience?: QueryAudience
  readonly onClose: () => void
  readonly onSaved: (saved: Question) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [audience, setAudience] = useState<QueryAudience>('personal')
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set())
  const [choices, setChoices] = useState<ReadonlyArray<{ id: string; label: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Opening the dialog opens the question as it is NOW — or a blank one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once, as it opens
  useEffect(() => {
    if (!open) return
    setLabel(question?.label ?? draft?.label ?? '')
    setDescription(question?.description ?? draft?.description ?? '')
    setAudience(question?.audience ?? (manages ? firstAudience : 'personal'))
    setGroups(new Set(question?.groups.map((g) => g.id) ?? []))
    setError(null)
  }, [open, question])

  // The groups a question may go to — asked only of whoever may share one.
  useEffect(() => {
    if (!open || !manages) return
    let live = true
    api.queryGroups(base).then(
      (found) => live && setChoices(found),
      () => live && setChoices([]),
    )
    return () => {
      live = false
    }
  }, [open, manages, base])

  const ready =
    label.trim() !== '' &&
    !isTooLong(description) &&
    (audience !== 'groups' || groups.size > 0) &&
    (question !== null || draft !== undefined) &&
    !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    const body = {
      label: label.trim(),
      description: description.trim() === '' ? null : description.trim(),
      audience,
      ...(audience === 'groups' ? { group_ids: [...groups] } : {}),
    }
    try {
      const saved =
        question === null
          ? await api.createQuestion(base, {
              ...body,
              query: (draft as NonNullable<typeof draft>).query,
              visualization: (draft as NonNullable<typeof draft>).visualization,
            })
          : await api.updateQuestion(base, question.id, body)
      onSaved(saved)
      onClose()
    } catch (e) {
      // A question a dashboard places keeps the whole base: the dashboards are named.
      if (
        e instanceof ApiError &&
        e.code === 'REQUEST_INVALID' &&
        e.details.reason === 'dans_un_tableau_de_bord'
      ) {
        const placed = Array.isArray(e.details.detail) ? e.details.detail : []
        setError(
          $t(
            'Un tableau de bord s’en sert ({dashboards}) : elle reste à toute la base. Retirez-la d’abord de ses cartes.',
            { dashboards: placed.map((d) => `« ${String(d)} »`).join(', ') },
          ),
        )
      } else {
        setError(messageFor(e))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {question === null ? $t('Enregistrer la question') : $t('Nom et partage')}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'Elle se range dans les tableaux de bord de la base. Chacun l’exécute avec ses propres droits, en lecture : la partager ne montre jamais ce que vous seul pouvez lire.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="question-label">{$t('Nom')}</Label>
            <Input
              id="question-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder={$t('Chiffre d’affaires par mois')}
              disabled={busy}
              autoFocus
            />
          </div>

          <DescriptionField
            id="question-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder={$t('Ce qu’elle montre, et quand s’en servir')}
            disabled={busy}
          />

          <div className="space-y-2">
            <Label>{$t('Qui la voit')}</Label>
            <fieldset className="grid gap-2 sm:grid-cols-3">
              <legend className="sr-only">{$t('Qui voit la question')}</legend>
              {AUDIENCES.map((choice) => {
                const locked = choice.value !== 'personal' && !manages
                return (
                  <label
                    key={choice.value}
                    htmlFor={`question-audience-${choice.value}`}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      audience === choice.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'hover:bg-accent',
                      (locked || busy) && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <input
                      id={`question-audience-${choice.value}`}
                      type="radio"
                      name="question-audience"
                      value={choice.value}
                      checked={audience === choice.value}
                      disabled={locked || busy}
                      onChange={() => setAudience(choice.value)}
                      className="sr-only"
                    />
                    <choice.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block text-sm font-medium">{choice.title}</span>
                      <span className="block text-xs text-muted-foreground">{choice.text}</span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
            {!manages && (
              <p className="text-xs text-muted-foreground">
                {$t('Partager une question demande de gérer la structure de la base.')}
              </p>
            )}
          </div>

          {audience === 'groups' && (
            <div className="space-y-2">
              <Label>{$t('Groupes')}</Label>
              {choices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {$t('Aucun groupe dans cette organisation.')}
                </p>
              ) : (
                <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {choices.map((group) => (
                    <label
                      key={group.id}
                      htmlFor={`question-group-${group.id}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`question-group-${group.id}`}
                        checked={groups.has(group.id)}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setGroups((was) => {
                            const next = new Set(was)
                            if (checked === true) next.add(group.id)
                            else next.delete(group.id)
                            return next
                          })
                        }
                      />
                      <span className="truncate">{groupName(group.label)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {error !== null && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          <Button onClick={() => void submit()} disabled={!ready}>
            {busy ? $t('Enregistrement…') : $t('Enregistrer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
