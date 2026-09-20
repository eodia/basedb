'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
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
import type { DescribedBase } from '@/lib/api/client'
import { useEffect, useState } from 'react'

/**
 * Names a table and says what it is for — its first column is added, and the others are
 * added from the structure editor.
 *
 * Shared by the sidebar and the structure editor: both create a table in the open base,
 * and having each carry its own copy of the form is how the description box would have
 * reached one of them only.
 */
export function NewTableDialog({
  open,
  base,
  busy,
  onClose,
  onSubmit,
}: {
  readonly open: boolean
  readonly base: DescribedBase
  readonly busy: boolean
  readonly onClose: () => void
  /** `description` is absent, not empty, when the box was left blank. */
  readonly onSubmit: (label: string, description?: string) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const ready = label.trim() !== '' && !isTooLong(description) && !busy

  // Reopening the dialog opens an empty one: the name of the table created a minute ago
  // is not a suggestion for the next.
  useEffect(() => {
    if (open) {
      setLabel('')
      setDescription('')
    }
  }, [open])

  const submit = () => {
    if (ready)
      void onSubmit(label.trim(), description.trim() === '' ? undefined : description.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle table dans {base.label}</DialogTitle>
          <DialogDescription>
            Une vraie table PostgreSQL dans le schéma{' '}
            <span className="font-mono text-xs">{base.name}</span>, avec ses colonnes système et une
            colonne <span className="font-mono text-xs">Nom</span>. Les autres s’ajoutent depuis la
            structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="table-label" className="text-sm text-muted-foreground">
              Libellé
            </label>
            <Input
              id="table-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Factures"
              autoFocus
            />
          </div>

          <DescriptionField
            id="table-description"
            value={description}
            onChange={setDescription}
            onSubmit={submit}
            placeholder="À quoi sert cette table ? Visible dans la documentation et par les agents."
            disabled={busy}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button disabled={!ready} onClick={submit}>
            {busy ? 'Création…' : 'Créer la table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
