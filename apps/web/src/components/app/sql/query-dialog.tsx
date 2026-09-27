'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
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
import { type QueryAudience, type SavedQuery, api } from '@/lib/api/client'
import { $t, groupName } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Database, Lock, type LucideIcon, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Saving a SQL statement as a query — or changing what a saved one is called and who
 * sees it (chapter 11 §1.8).
 *
 * Three audiences, and the dialog says what each one shares: the TEXT. Whoever opens a
 * query runs it with their own rights, so sharing one with a group never shows its members
 * what its author reads and they do not. Sharing is building the base: offered to whoever
 * manages it, the server deciding anyway.
 */

export const AUDIENCES: ReadonlyArray<{
  readonly value: QueryAudience
  readonly icon: LucideIcon
  readonly title: string
  readonly text: string
}> = [
  {
    value: 'personal',
    icon: Lock,
    title: $t('Personnelle'),
    text: $t('Vous seul la voyez.'),
  },
  {
    value: 'base',
    icon: Database,
    title: $t('Toute la base'),
    text: $t('Quiconque lit la base la voit.'),
  },
  {
    value: 'groups',
    icon: Users,
    title: $t('Des groupes'),
    text: $t('Les membres des groupes choisis.'),
  },
]

/** The icon an audience is shown with, in the navigation and in a tab. */
export const audienceIcon = (audience: QueryAudience): LucideIcon =>
  AUDIENCES.find((a) => a.value === audience)?.icon ?? Lock

export function QueryDialog({
  open,
  base,
  manages,
  query,
  statement,
  onClose,
  onSaved,
  onDeleted,
}: {
  readonly open: boolean
  /** The base's name. */
  readonly base: string
  /** The caller manages the base's structure: they may share a query. */
  readonly manages: boolean
  /** The query whose properties are changed; `null` saves `statement` as a new one. */
  readonly query: SavedQuery | null
  /** The statement to save, or to save the query with. */
  readonly statement: string
  readonly onClose: () => void
  readonly onSaved: (saved: SavedQuery) => void
  /** Offered when given, for a query the caller may change. */
  readonly onDeleted?: (id: string) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [audience, setAudience] = useState<QueryAudience>('personal')
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set())
  const [choices, setChoices] = useState<ReadonlyArray<{ id: string; label: string }>>([])
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Opening the dialog opens the query as it is NOW — or a blank one.
  useEffect(() => {
    if (!open) return
    setLabel(query?.label ?? '')
    setDescription(query?.description ?? '')
    setAudience(query?.audience ?? 'personal')
    setGroups(new Set(query?.groups.map((g) => g.id) ?? []))
    setConfirming(false)
    setError(null)
  }, [open, query])

  // The groups a query may go to — asked only of whoever may share one.
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
    (query !== null || statement.trim() !== '') &&
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
        query === null
          ? await api.createQuery(base, { ...body, statement })
          : await api.updateQuery(base, query.id, body)
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (query === null) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteQuery(base, query.id)
      onDeleted?.(query.id)
      onClose()
    } catch (e) {
      setError(messageFor(e))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {query === null ? $t('Enregistrer la requête') : $t('Propriétés de la requête')}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'Elle se range sous les tables de la base. Chacun l’exécute avec ses propres droits : partager une requête partage son texte, jamais ce que vous pouvez lire.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="query-label">{$t('Nom')}</Label>
            <Input
              id="query-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder={$t('Clients sans commande depuis un an')}
              disabled={busy}
              autoFocus
            />
          </div>

          <DescriptionField
            id="query-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder={$t('Ce qu’elle montre, et quand s’en servir')}
            disabled={busy}
          />

          <div className="space-y-2">
            <Label>{$t('Qui la voit')}</Label>
            <fieldset className="grid gap-2 sm:grid-cols-3">
              <legend className="sr-only">{$t('Qui voit la requête')}</legend>
              {AUDIENCES.map((choice) => {
                const locked = choice.value !== 'personal' && !manages
                return (
                  <label
                    key={choice.value}
                    htmlFor={`query-audience-${choice.value}`}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      audience === choice.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'hover:bg-accent',
                      (locked || busy) && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <input
                      id={`query-audience-${choice.value}`}
                      type="radio"
                      name="query-audience"
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
                {$t('Partager une requête demande de gérer la structure de la base.')}
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
                      htmlFor={`query-group-${group.id}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`query-group-${group.id}`}
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

        <DialogFooter className="sm:justify-between">
          {query !== null && onDeleted !== undefined ? (
            confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {$t('Supprimer la requête ?')}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  {$t('Supprimer')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  {$t('Non')}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <Trash2 className="size-4" />
                {$t('Supprimer')}
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {$t('Annuler')}
            </Button>
            <Button onClick={() => void submit()} disabled={!ready}>
              {busy ? $t('Enregistrement…') : $t('Enregistrer')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
