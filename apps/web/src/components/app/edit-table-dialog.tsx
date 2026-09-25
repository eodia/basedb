'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
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
import { type Table, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { useEffect, useState } from 'react'

/**
 * Editing a table: what it is called, what it is for, how it looks.
 *
 * All three are catalog writes. The label is renamed, never the relation — the dialog says
 * so, with the name `psql` keeps using — and the look is the one a choice of a list wears,
 * picked with the same button. What did not change is not sent.
 */
export function EditTableDialog({
  table,
  onClose,
  onSaved,
}: {
  /** The table being edited; `null` keeps the dialog closed. */
  readonly table: Table | null
  readonly onClose: () => void
  /** Called with the label the table now has. */
  readonly onSaved: (label: string) => Promise<void> | void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [look, setLook] = useState<LookValue>(lookOf({}))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Opening the dialog opens the table as it is NOW.
  useEffect(() => {
    if (table === null) return
    setLabel(table.label)
    setDescription(table.description ?? '')
    setLook(lookOf(table))
    setError(null)
  }, [table])

  const ready = table !== null && label.trim() !== '' && !isTooLong(description) && !busy

  const submit = async () => {
    if (table === null || !ready) return
    const patch: { label?: string; description?: string | null } & Partial<LookValue> = {}
    if (label.trim() !== table.label) patch.label = label.trim()
    const nextDescription = description.trim() === '' ? null : description.trim()
    if (nextDescription !== (table.description ?? null)) patch.description = nextDescription
    if (!sameLook(look, lookOf(table))) Object.assign(patch, look)
    if (Object.keys(patch).length === 0) return onClose()

    setBusy(true)
    setError(null)
    try {
      await api.updateTable(table, patch)
      await onSaved(patch.label ?? table.label)
      onClose()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={table !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la table</DialogTitle>
          <DialogDescription>
            Le nom technique <code className="font-mono text-xs">{table?.sql}</code> ne change pas :
            les requêtes SQL et les intégrations continuent de fonctionner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="table-label">Libellé</Label>
            <div className="flex items-center gap-2">
              <LookButton
                look={look}
                label={`Apparence de la table ${label}`.trim()}
                onChange={(patch) => setLook((current) => ({ ...current, ...patch }))}
                disabled={busy}
                className="size-9"
              />
              <Input
                id="table-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                disabled={busy}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Couleur, pictogramme ou image : ce qui distingue la table dans la navigation.
            </p>
          </div>

          <DescriptionField
            id="table-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder="Que contient cette table ?"
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

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!ready}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
