'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
import { EnvironmentsEditor, NewEnvironmentsField } from '@/components/app/environments-editor'
import { LookButton, type LookValue, lookOf, sameLook } from '@/components/app/look-picker'
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
import { type DescribedBase, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * What one does to a base as a whole: create it, rename it, delete it.
 *
 * They open from the menu of a base in the sidebar's tree, and chapter 06 makes them
 * wildly asymmetric acts that the dialogs should not flatten:
 *
 *   renommer = un `UPDATE` de catalogue, aucun verrou, pas une migration ;
 *   supprimer = un plan à plusieurs étapes passant par la machine à états.
 *
 * So renaming is a two-field dialog — the label, and the description that documentation
 * and agents read — that closes in a second, and deleting spells out what will happen and
 * asks the label to be typed. That difference is the honest one.
 */

/** What these dialogs read of a base: the tree's line holds it as well as a description. */
export type BaseLike = Pick<
  DescribedBase,
  'name' | 'label' | 'description' | 'color' | 'icon' | 'image'
>

export function EditBaseDialog({
  open,
  base,
  onClose,
  onDone,
  onEnvironmentsChanged,
}: {
  readonly open: boolean
  readonly base: BaseLike
  readonly onClose: () => void
  readonly onDone: () => void
  /** An environment was added, renamed or deleted — the navigation lists them. */
  readonly onEnvironmentsChanged?: () => void
}) {
  const [label, setLabel] = useState(base.label)
  const [description, setDescription] = useState(base.description ?? '')
  const [look, setLook] = useState<LookValue>(lookOf(base))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLabel(base.label)
      setDescription(base.description ?? '')
      setLook(lookOf({ color: base.color, icon: base.icon, image: base.image }))
      setError(null)
    }
  }, [open, base.label, base.description, base.color, base.icon, base.image])

  const submit = async () => {
    const trimmed = label.trim()
    if (trimmed === '' || isTooLong(description) || busy) return

    // Only what changed is sent, and an emptied description is a `null` — "clear it" —
    // not an omission, which would leave the old one in place. The look travels whole.
    const patch: { label?: string; description?: string | null } & Partial<LookValue> = {}
    if (trimmed !== base.label) patch.label = trimmed
    const nextDescription = description.trim() === '' ? null : description.trim()
    if (nextDescription !== (base.description ?? null)) patch.description = nextDescription
    if (!sameLook(look, lookOf(base))) Object.assign(patch, look)
    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.updateBase(base.name, patch)
      onDone()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>Modifier la base</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="base-label">Libellé</Label>
            <div className="flex items-center gap-2">
              {/* The look sits before the name, where the tree draws it. */}
              <LookButton
                look={look}
                label={`Apparence de la base ${label}`.trim()}
                onChange={(patch) => setLook((current) => ({ ...current, ...patch }))}
                disabled={busy}
                className="size-9"
              />
              <Input
                id="base-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Couleur, pictogramme ou image : ce qui distingue la base dans la navigation.
            </p>
          </div>

          <DescriptionField
            id="base-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder="À quoi sert cette base ?"
            disabled={busy}
          />

          {/* Each environment is saved as it is edited: its own row, its own act. */}
          {open && (
            <EnvironmentsEditor
              base={base.name}
              onChanged={() => onEnvironmentsChanged?.()}
              disabled={busy}
            />
          )}

          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={label.trim() === '' || isTooLong(description) || busy}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The deletion confirmation.
 *
 * It asks for the label to be typed. That is not ceremony: the act runs a multi-step
 * migration over every table of the base, and a misplaced click on a menu line is not
 * the same intent as writing out the name of the thing.
 *
 * It also says what deletion is NOT. The tables keep their rows and stay readable in
 * SQL under a `zz_supprime_…` name, and the base can be restored — people who believe
 * "supprimer" means "détruire" hesitate over the right decision for the wrong reason.
 */
export function DeleteBaseDialog({
  open,
  base,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly base: BaseLike
  readonly onClose: () => void
  readonly onDone: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTyped('')
    setError(null)
  }, [open])

  const ready = typed.trim() === base.label && !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const migration = await api.deleteBase(base.name)
      if (migration.status !== 'applied') {
        // The plan ran and stopped on a step. The step's label is far more useful than
        // "la suppression a échoué", and it is what the operator will grep for.
        setError(
          `La migration s’est arrêtée à l’étape « ${migration.step_label ?? '?'} » ` +
            `(${migration.error_code ?? 'inconnue'}).`,
        )
        return
      }
      onDone()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer « {base.label} » ?</DialogTitle>
          <DialogDescription>
            Ses données sont conservées : vous pourrez la restaurer depuis le menu du projet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="confirm-label">
              Saisissez <span className="font-medium text-foreground">{base.label}</span> pour
              confirmer
            </Label>
            <Input
              id="confirm-label"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              autoFocus
              disabled={busy}
            />
          </div>

          {error !== null && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submit()}
            disabled={!ready}
            className={cn(busy && 'opacity-80')}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? 'Suppression…' : 'Supprimer la base'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A new, empty base in a project: a label and what it is for. Its tables are added next,
 * from the base's own menu — or all at once from a template of the gallery (chapter 20).
 */
export function NewBaseDialog({
  open,
  project,
  onClose,
  onDone,
  onGallery,
}: {
  readonly open: boolean
  readonly project: { readonly id: string; readonly label: string }
  readonly onClose: () => void
  /** Receives the logical name of the base created. */
  readonly onDone: (name: string) => void
  /** Opens the gallery of templates instead — and the AI's proposals. */
  readonly onGallery: () => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [environments, setEnvironments] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel('')
    setDescription('')
    setEnvironments([])
    setProgress(null)
    setError(null)
  }, [open])

  const ready = label.trim() !== '' && !isTooLong(description) && !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    let created: { name: string } | null = null
    try {
      created = await api.createBase(
        label.trim(),
        description.trim() === '' ? undefined : description.trim(),
        project.id,
      )
      // The other environments, once production exists: each is a copy of it.
      for (const environment of environments) {
        setProgress(`Création de « ${environment} »…`)
        await api.createEnvironment(created.name, environment)
      }
      onDone(created.name)
    } catch (e) {
      // The base exists even when an environment could not be added: said, and the
      // environments are completed from « Modifier la base ».
      if (created !== null) {
        setError(`La base est créée, mais pas tous ses environnements : ${messageFor(e)}`)
        onDone(created.name)
      } else {
        setError(messageFor(e))
      }
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle base dans {project.label}</DialogTitle>
          <DialogDescription>
            Une base est un schéma PostgreSQL : ses tables y sont de vraies tables, lisibles en SQL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-base-label">Libellé</Label>
            <Input
              id="new-base-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Ex. Ventes"
              autoFocus
              disabled={busy}
            />
          </div>

          <DescriptionField
            id="new-base-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder="À quoi sert cette base ?"
            disabled={busy}
          />

          <button
            type="button"
            onClick={onGallery}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-lg border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-transparent p-3 text-left transition-colors hover:border-violet-500/60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                Partir d’un modèle, ou le demander à l’IA
              </span>
              <span className="block text-xs text-muted-foreground">
                Suivi de tickets, analyse d’avis, CRM… des bases prêtes, avec leurs lignes, leurs
                vues et leur IA.
              </span>
            </span>
          </button>

          <NewEnvironmentsField value={environments} onChange={setEnvironments} disabled={busy} />

          {progress !== null && <p className="text-sm text-muted-foreground">{progress}</p>}
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!ready}
            className={cn(busy && 'opacity-80')}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? 'Création…' : 'Créer la base'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
