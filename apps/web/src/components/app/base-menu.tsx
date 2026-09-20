'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Base, type DeletedBase, type DescribedBase, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronsUpDown,
  Database,
  History,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The base switcher, top-left — and the two verbs that live nowhere else.
 *
 * Renaming and deleting sit here because this is where one names a base, and chapter 06
 * makes them wildly asymmetric acts that the menu should not flatten:
 *
 *   renommer = un `UPDATE` de catalogue, aucun verrou, pas une migration ;
 *   supprimer = un plan à plusieurs étapes passant par la machine à états.
 *
 * So renaming is a one-field dialog that closes in a second, and deleting spells out
 * what will happen and asks the label to be typed. That difference is the honest one.
 */

interface Props {
  readonly bases: readonly Base[]
  readonly base: DescribedBase | null
  readonly busy: boolean
  readonly onOpenBase: (name: string) => void
  readonly onNewBase: () => void
  readonly onChanged: () => void
  readonly onDeleted: (name: string) => void
}

export function BaseMenu({
  bases,
  base,
  busy,
  onOpenBase,
  onNewBase,
  onChanged,
  onDeleted,
}: Props) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState<readonly DeletedBase[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadDeleted = useCallback(async () => {
    try {
      setDeleted(await api.deletedBases())
    } catch {
      // Without the administration role the route answers an absence, not a refusal:
      // the submenu simply does not appear.
      setDeleted([])
    }
  }, [])

  useEffect(() => {
    void loadDeleted()
  }, [loadDeleted])

  return (
    <div className="p-3">
      <DropdownMenu onOpenChange={(open) => open && void loadDeleted()}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <Database className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {base?.label ?? 'Aucune base'}
              </span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                {base?.name ?? 'Base de données'}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Mes bases</DropdownMenuLabel>
          {bases.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucune base visible.</div>
          )}
          {bases.map((b) => (
            <DropdownMenuItem key={b.id} onSelect={() => onOpenBase(b.name)}>
              <Database className="size-4" />
              <span className="min-w-0 flex-1 truncate">{b.label}</span>
              {base?.name === b.name && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={onNewBase} disabled={busy}>
            <Plus className="size-4" />
            Nouvelle base
          </DropdownMenuItem>

          {base !== null && (
            <>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil className="size-4" />
                Renommer « {base.label} »
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDeleting(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Supprimer « {base.label} »
              </DropdownMenuItem>
            </>
          )}

          {deleted.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <History className="size-4" />
                  Bases supprimées ({deleted.length})
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64">
                  <DropdownMenuLabel className="font-normal leading-relaxed">
                    Rien n’a été détruit : les tables ont gardé leurs lignes et leurs index.
                    Restaurer les renomme, ça ne les réimporte pas.
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {deleted.map((d) => (
                    <DropdownMenuItem
                      key={d.id}
                      onSelect={async () => {
                        setError(null)
                        try {
                          await api.restoreBase(d.name)
                          await loadDeleted()
                          onChanged()
                        } catch (e) {
                          setError(messageFor(e))
                        }
                      }}
                    >
                      <History className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{d.label}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {new Date(d.deleted_at).toLocaleDateString('fr-FR')}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {error !== null && (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {base !== null && (
        <>
          <RenameDialog
            open={renaming}
            base={base}
            onClose={() => setRenaming(false)}
            onDone={() => {
              setRenaming(false)
              onChanged()
            }}
          />
          <DeleteDialog
            open={deleting}
            base={base}
            onClose={() => setDeleting(false)}
            onDone={() => {
              setDeleting(false)
              onDeleted(base.name)
              void loadDeleted()
            }}
          />
        </>
      )}
    </div>
  )
}

function RenameDialog({
  open,
  base,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly base: DescribedBase
  readonly onClose: () => void
  readonly onDone: () => void
}) {
  const [label, setLabel] = useState(base.label)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLabel(base.label)
      setError(null)
    }
  }, [open, base.label])

  const submit = async () => {
    const trimmed = label.trim()
    if (trimmed === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.renameBase(base.name, trimmed)
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
          <DialogTitle>Renommer la base</DialogTitle>
          <DialogDescription>
            Le libellé seulement. Le schéma garde son nom{' '}
            <span className="font-mono text-xs">{base.name}</span> : aucune requête SQL écrite
            ailleurs ne casse, et rien n’est migré.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="base-label">Libellé</Label>
          <Input
            id="base-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            autoFocus
          />
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={label.trim() === '' || busy}>
            {busy ? 'Enregistrement…' : 'Renommer'}
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
function DeleteDialog({
  open,
  base,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly base: DescribedBase
  readonly onClose: () => void
  readonly onDone: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTyped('')
    setError(null)
    setProgress(null)
  }, [open])

  const ready = typed.trim() === base.label && !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    setProgress('Exécution du plan…')
    try {
      const migration = await api.deleteBase(base.name)
      if (migration.status !== 'applied') {
        // The plan ran and stopped on a step. The step's label is far more useful than
        // "la suppression a échoué", and it is what the operator will grep for.
        setError(
          `La migration s’est arrêtée à l’étape « ${migration.step_label ?? '?'} » ` +
            `(${migration.error_code ?? 'inconnue'}).`,
        )
        setProgress(null)
        return
      }
      onDone()
    } catch (e) {
      setError(messageFor(e))
      setProgress(null)
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
            {base.tables.length} table{base.tables.length > 1 ? 's' : ''}{' '}
            {base.tables.length > 1 ? 'seront reléguées' : 'sera reléguée'}, par lots de dix, puis
            le schéma <span className="font-mono text-xs">{base.name}</span> sera renommé en{' '}
            <span className="font-mono text-xs">…zz_supprime_…</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/40 p-3 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Rien n’est détruit.</span> Les lignes,
              les index et les numéros d’attribut sont conservés, et les tables restent lisibles en
              SQL direct sous leur nom relégué. La base peut être restaurée.
            </p>
            <p className="mt-2">
              Le libellé « {base.label} » redevient disponible immédiatement. Le nom physique, lui,
              n’est jamais rendu : une base recréée sous ce libellé prendra un autre schéma.
            </p>
          </div>

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

          {progress !== null && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {progress}
            </p>
          )}
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
            {busy ? 'Suppression…' : 'Supprimer la base'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
