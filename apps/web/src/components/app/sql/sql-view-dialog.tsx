'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
import { LookButton, type LookValue, lookOf, sameLook } from '@/components/app/look-picker'
import { SqlEditor } from '@/components/app/sql-editor'
import { Button } from '@/components/ui/button'
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
import { ApiError, type DescribedBase, type SqlView, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Creating a SQL view, or changing one (chapter 11 §1.8): a real PostgreSQL view of the
 * base's schema, which the navigation lists among the tables.
 *
 * What it is called and how it looks, like a table; what it reads, as a `SELECT`. The
 * dialog says the one thing that matters about who reads it: each reader reads it with
 * their own rights, so a view is never a way round a hidden field.
 */
export function SqlViewDialog({
  open,
  base,
  view,
  definition: initial = '',
  onClose,
  onSaved,
  onDeleted,
}: {
  readonly open: boolean
  readonly base: DescribedBase
  /** The view being changed; `null` creates one. */
  readonly view: SqlView | null
  /** The text a new view starts with — the statement of a SQL tab, say. */
  readonly definition?: string
  readonly onClose: () => void
  readonly onSaved: (view: SqlView) => void
  readonly onDeleted?: (id: string) => void
}) {
  const [label, setLabel] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [look, setLook] = useState<LookValue>(lookOf({}))
  const [definition, setDefinition] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<{
    message: string
    position: number | null
  } | null>(null)

  // Opening the dialog opens the view as it is NOW — or a blank one.
  useEffect(() => {
    if (!open) return
    setLabel(view?.label ?? '')
    setName('')
    setDescription(view?.description ?? '')
    setLook(lookOf(view ?? {}))
    setDefinition(view?.definition ?? initial)
    setConfirming(false)
    setError(null)
    setServerError(null)
  }, [open, view, initial])

  const ready = label.trim() !== '' && definition.trim() !== '' && !isTooLong(description) && !busy

  /** PostgreSQL's own words for a text it refused, and where — as the console shows them. */
  const refused = (e: unknown) => {
    if (e instanceof ApiError && e.details.reason === 'hors_base') {
      const what = typeof e.details.object === 'string' ? ` (${e.details.object})` : ''
      setError($t('Une vue ne lit que les tables et les vues de sa base{what}.', { what }))
      return
    }
    if (e instanceof ApiError && typeof e.details.message === 'string') {
      const position = typeof e.details.position === 'number' ? e.details.position : null
      setServerError({ message: e.details.message, position })
      setError(e.details.message)
      return
    }
    setError(messageFor(e))
  }

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    setServerError(null)
    const nextDescription = description.trim() === '' ? null : description.trim()
    try {
      if (view === null) {
        const created = await api.createSqlView(base.name, {
          label: label.trim(),
          definition,
          description: nextDescription,
          ...(name.trim() === '' ? {} : { name: name.trim() }),
          ...look,
        })
        onSaved(created)
      } else {
        const patch: {
          label?: string
          definition?: string
          description?: string | null
        } & Partial<LookValue> = {}
        if (label.trim() !== view.label) patch.label = label.trim()
        // A broken view is put back by saving its text, even unchanged.
        if (definition !== view.definition || view.broken !== null) patch.definition = definition
        if (nextDescription !== view.description) patch.description = nextDescription
        if (!sameLook(look, lookOf(view))) Object.assign(patch, look)
        if (Object.keys(patch).length === 0) return onClose()
        onSaved(await api.updateSqlView(base.name, view.id, patch))
      }
      onClose()
    } catch (e) {
      refused(e)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (view === null) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteSqlView(base.name, view.id)
      onDeleted?.(view.id)
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
      <DialogContent
        className="sm:max-w-2xl"
        // Échap in the editor closes its completion list, not the dialog and its text.
        onEscapeKeyDown={(event) => {
          if ((event.target as Element | null)?.closest?.('.cm-editor')) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {view === null ? $t('Nouvelle vue SQL') : $t('Modifier la vue SQL')}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'Une vraie vue PostgreSQL de la base, rangée parmi ses tables. Chacun la lit avec ses propres droits : elle ne montre jamais un champ qu’on ne voit pas.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {view?.broken != null && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-sm text-amber-800 dark:text-amber-300">
              {$t('{broken} Corrigez sa définition, puis enregistrez pour la remettre en place.', {
                broken: view.broken,
              })}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-1.5">
              <Label htmlFor="sql-view-label">{$t('Libellé')}</Label>
              <div className="flex items-center gap-2">
                <LookButton
                  look={look}
                  label={$t('Apparence de la vue {label}', { label }).trim()}
                  onChange={(patch) => setLook((current) => ({ ...current, ...patch }))}
                  disabled={busy}
                  className="size-9"
                />
                <Input
                  id="sql-view-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={$t('Commandes du mois')}
                  disabled={busy}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sql-view-name">{$t('Nom technique')}</Label>
              {view === null ? (
                <Input
                  id="sql-view-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={$t('tiré du libellé')}
                  className="font-mono text-xs"
                  disabled={busy}
                />
              ) : (
                <p
                  id="sql-view-name"
                  className="flex h-9 items-center truncate rounded-md border bg-muted/40 px-3 font-mono text-xs text-muted-foreground"
                >
                  {view.name}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{$t('Requête')}</Label>
            <div className="flex h-56 flex-col overflow-hidden rounded-md border bg-background">
              <SqlEditor
                value={definition}
                base={base}
                placeholder="SELECT … FROM …"
                onChange={setDefinition}
                onRun={() => void submit()}
                serverError={serverError}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {$t('Un seul')} <code className="font-mono">SELECT</code>
              {$t(', sur les tables et les vues de cette base.')}
            </p>
          </div>

          <DescriptionField
            id="sql-view-description"
            value={description}
            onChange={setDescription}
            placeholder={$t('Ce qu’elle montre')}
            disabled={busy}
          />

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
          {view !== null ? (
            confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{$t('Supprimer la vue ?')}</span>
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
              {busy
                ? $t('Enregistrement…')
                : view === null
                  ? $t('Créer la vue')
                  : $t('Enregistrer')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
