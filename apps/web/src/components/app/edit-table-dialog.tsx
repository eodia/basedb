'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
import { usePhysicalRename } from '@/components/app/lifecycle-dialogs'
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
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { useEffect, useRef, useState } from 'react'

/**
 * Editing a table: what it is called, what it is for, how it looks.
 *
 * All three are catalog writes. The label is renamed, never the relation — the dialog says
 * so, with the name `psql` keeps using — and the look is the one a choice of a list wears,
 * picked with the same button. What did not change is not sent.
 *
 * An administrator may rename the relation too, from the same dialog (chapter 06 §2): a
 * box under the label, and only ticked, what that rename would touch. The label is saved
 * first; a rename refused after it leaves the dialog open, the label kept.
 */
export function EditTableDialog({
  table,
  administers = false,
  onClose,
  onSaved,
  onRenamed,
}: {
  /** The table being edited; `null` keeps the dialog closed. */
  readonly table: Table | null
  /** The administration role: the relation may be renamed too. */
  readonly administers?: boolean
  readonly onClose: () => void
  /** Called with the label the table now has. */
  readonly onSaved: (label: string) => Promise<void> | void
  /** The relation was renamed: its name before, and after. */
  readonly onRenamed?: (change: {
    readonly from: string
    readonly to: string
  }) => Promise<void> | void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [look, setLook] = useState<LookValue>(lookOf({}))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // What was saved already, when a rename that followed was refused: not sent twice.
  const saved = useRef<{ label: string; description: string | null } | null>(null)

  const physical = usePhysicalRename({
    target: table === null ? null : { kind: 'table', id: table.id, label: table.label },
    current: table?.name ?? '',
    label,
    administers,
  })

  // Opening the dialog opens the table as it is NOW.
  useEffect(() => {
    if (table === null) return
    setLabel(table.label)
    setDescription(table.description ?? '')
    setLook(lookOf(table))
    setError(null)
    saved.current = null
  }, [table])

  const ready =
    table !== null && label.trim() !== '' && !isTooLong(description) && physical.ready && !busy

  const submit = async () => {
    if (table === null || !ready) return
    const was = saved.current ?? { label: table.label, description: table.description ?? null }
    const patch: { label?: string; description?: string | null } & Partial<LookValue> = {}
    if (label.trim() !== was.label) patch.label = label.trim()
    const nextDescription = description.trim() === '' ? null : description.trim()
    if (nextDescription !== was.description) patch.description = nextDescription
    if (saved.current === null && !sameLook(look, lookOf(table))) Object.assign(patch, look)
    if (Object.keys(patch).length === 0 && !physical.asked) return onClose()

    setBusy(true)
    setError(null)
    try {
      if (Object.keys(patch).length > 0) {
        await api.updateTable(table, patch)
        saved.current = { label: label.trim(), description: nextDescription }
        await onSaved(patch.label ?? was.label)
      }
      const renamed = await physical.run()
      if (renamed !== null) await onRenamed?.(renamed)
      onClose()
    } catch (e) {
      setError(
        saved.current === null
          ? messageFor(e)
          : $t('Libellé enregistré, mais le nom en base n’a pas changé : {e}', {
              e: messageFor(e),
            }),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={table !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{$t('Modifier la table')}</DialogTitle>
          <DialogDescription>
            {$t('Son libellé, sa description et son apparence.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="table-label">{$t('Libellé')}</Label>
            <div className="flex items-center gap-2">
              <LookButton
                look={look}
                label={$t('Apparence de la table {label}', { label }).trim()}
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
              {$t('Couleur, pictogramme ou image : ce qui distingue la table dans la navigation.')}
            </p>
          </div>

          {physical.element}

          <DescriptionField
            id="table-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder={$t('Que contient cette table ?')}
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
            {$t('Annuler')}
          </Button>
          <Button onClick={() => void submit()} disabled={!ready}>
            {busy
              ? $t('Enregistrement…')
              : physical.asked
                ? $t('Enregistrer et renommer en base')
                : $t('Enregistrer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
