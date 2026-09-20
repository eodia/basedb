'use client'

import { FieldIcon, KIND_LABELS } from '@/components/app/field-icon'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type DescribedBase, type Field, type Table, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Check, Key, Link2, Plus, Star, Table2, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The schema editor — chapter 11 §6.
 *
 * What it shows is the catalog's own idea of the table, not a picture of it: the types,
 * the obligations, the link targets and the display column all come back from
 * `/meta/bases`, so a change made here or in psql reads the same way a second later.
 *
 * The one thing it refuses to hide is chapter 04 §1.3: a field is BORN NULLABLE, and
 * making it required is a distinct act on a table that may already hold rows. The form
 * says so, and the obligation is a switch on the row rather than a checkbox in the
 * creation dialog.
 */

/** The types one can create here. `formula` needs an expression nothing writes yet. */
const CREATABLE = [
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
] as const

interface Props {
  readonly base: DescribedBase
  readonly onChanged: () => Promise<void>
}

export function SchemaEditor({ base, onChanged }: Props) {
  const [openTable, setOpenTable] = useState<string | null>(base.tables[0]?.name ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Table | null>(null)

  const table = base.tables.find((t) => t.name === openTable) ?? base.tables[0] ?? null

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      setBusy(true)
      setError(null)
      try {
        await work()
        await onChanged()
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setBusy(false)
      }
    },
    [onChanged],
  )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Structure de {base.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce que vous voyez ici est le catalogue lui-même. Une colonne ajoutée apparaît dans{' '}
          <span className="font-mono text-xs">psql</span> à la seconde suivante, avec son libellé en
          commentaire.
        </p>
      </div>

      {error !== null && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Tables */}
        <div className="w-56 shrink-0 space-y-0.5">
          {base.tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenTable(t.name)}
              className={cn(
                'flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-colors hover:bg-accent',
                table?.name === t.name && 'bg-accent font-medium',
              )}
            >
              <Table2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const label = window.prompt('Libellé de la table')
                if (label === null || label.trim() === '') return
                await api.createTableIn(base.name, label)
              })
            }
          >
            <Plus className="size-4" />
            Nouvelle table
          </Button>
        </div>

        {/* Fields */}
        {table !== null && (
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{table.label}</h2>
                <p className="truncate font-mono text-xs text-muted-foreground">{table.sql}</p>
              </div>
              <Button size="sm" onClick={() => setAdding(true)} disabled={busy}>
                <Plus className="size-4" />
                Champ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleting(table)}
                disabled={busy}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border">
              {table.fields.map((field, index) => (
                <FieldRow
                  key={field.name}
                  field={field}
                  table={table}
                  first={index === 0}
                  busy={busy}
                  onRequired={(required) =>
                    void run(() => api.setFieldRequired(table, field.name, required))
                  }
                  onDisplay={() => void run(() => api.setDisplayColumn(table, field.name))}
                />
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Les colonnes système — <span className="font-mono">_id</span>,{' '}
              <span className="font-mono">_created_at</span>,{' '}
              <span className="font-mono">_updated_at</span>,{' '}
              <span className="font-mono">_created_by</span>,{' '}
              <span className="font-mono">_updated_by</span> — existent sur chaque table et ne se
              règlent pas : elles portent la pagination par curseur et la reprise incrémentale.
            </p>

            <AddFieldDialog
              open={adding}
              table={table}
              base={base}
              onClose={() => setAdding(false)}
              onSubmit={async (field) => {
                await run(async () => {
                  if (field.kind === 'link') {
                    await api.createLink(table, field.label, field.target ?? '')
                  } else {
                    await api.addField(table, {
                      label: field.label,
                      kind: field.kind,
                      options: field.options,
                    })
                  }
                })
                setAdding(false)
              }}
            />

            <DeleteTableDialog
              table={deleting}
              onClose={() => setDeleting(null)}
              onDeleted={async () => {
                setDeleting(null)
                // The open table is chosen by name, and that name is now relegated: fall
                // back before the description comes back without it.
                setOpenTable(base.tables.find((t) => t.name !== deleting?.name)?.name ?? null)
                await onChanged()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The confirmation for deleting a table — chapter 06 §4.2.
 *
 * It asks the server what the act would do BEFORE showing anything, because the two
 * facts that decide the answer are both server-side: whether a live link elsewhere still
 * aims at this table, and which other tables the step will briefly lock. §4.2 asks the
 * screen to name those, and a screen that named them after the fact would be a screen
 * that did not need to.
 *
 * It also says what deletion is NOT. The rows stay, the indexes stay, the table is
 * renamed and remains readable in direct SQL. People hesitate over the right decision
 * for the wrong reason when "supprimer" is left to mean "détruire".
 */
function DeleteTableDialog({
  table,
  onClose,
  onDeleted,
}: {
  readonly table: Table | null
  readonly onClose: () => void
  readonly onDeleted: () => Promise<void>
}) {
  const [preview, setPreview] = useState<{
    label: string
    row_count: number | null
    referenced_by: readonly string[]
    locked_tables: readonly string[]
    relegated_name: string
  } | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (table === null) return
    setTyped('')
    setError(null)
    setPreview(null)
    api
      .tableDeletionPreview(table)
      .then(setPreview)
      .catch((e) => setError(messageFor(e)))
  }, [table])

  const blocked = (preview?.referenced_by.length ?? 0) > 0
  const ready = table !== null && typed.trim() === table.label && !busy && !blocked

  const submit = async () => {
    if (!ready || table === null) return
    setBusy(true)
    setError(null)
    try {
      const migration = await api.deleteTable(table)
      if (migration.status !== 'applied') {
        setError(
          `La migration s’est arrêtée à l’étape « ${migration.step_label ?? '?'} » ` +
            `(${migration.error_code ?? 'inconnue'}).`,
        )
        return
      }
      await onDeleted()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={table !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer la table « {table?.label} » ?</DialogTitle>
          <DialogDescription>
            Elle sera renommée{' '}
            <span className="font-mono text-xs">{preview?.relegated_name ?? '…'}</span> dans le
            schéma <span className="font-mono text-xs">{table?.base}</span>, et ses champs suivront
            dans la même étape.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/40 p-3 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Rien n’est détruit.</span> Les lignes
              {preview?.row_count != null && preview.row_count > 0 && (
                <> — environ {preview.row_count.toLocaleString('fr-FR')} —</>
              )}{' '}
              et les index sont conservés, et la table reste lisible en SQL direct sous son nom
              relégué.
            </p>
            <p className="mt-2">
              Le libellé « {table?.label} » redevient disponible immédiatement. Le nom physique,
              lui, n’est jamais rendu : une table recréée sous ce libellé prendra{' '}
              <span className="font-mono text-xs">{table?.name}_2</span>.
            </p>
          </div>

          {blocked && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              <p className="font-medium">Un lien actif vise encore cette table.</p>
              <p className="mt-1">
                Retirez d’abord {preview?.referenced_by.join(', ')} — la base refuserait une cible
                morte sous un lien vivant.
              </p>
            </div>
          )}

          {!blocked && (preview?.locked_tables.length ?? 0) > 0 && (
            <p className="text-muted-foreground">
              L’étape gèlera brièvement {preview?.locked_tables.join(', ')} : détacher une clé
              étrangère prend aussi un verrou sur la table référencée.
            </p>
          )}

          {!blocked && (
            <div className="space-y-1.5">
              <label htmlFor="confirm-table" className="text-sm text-muted-foreground">
                Saisissez <span className="font-medium text-foreground">{table?.label}</span> pour
                confirmer
              </label>
              <Input
                id="confirm-table"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                autoFocus
                disabled={busy}
              />
            </div>
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
          <Button variant="destructive" onClick={() => void submit()} disabled={!ready}>
            {busy ? 'Suppression…' : 'Supprimer la table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  field,
  table,
  first,
  busy,
  onRequired,
  onDisplay,
}: {
  readonly field: Field
  readonly table: Table
  readonly first: boolean
  readonly busy: boolean
  readonly onRequired: (required: boolean) => void
  readonly onDisplay: () => void
}) {
  const isDisplay = table.display_field === field.name

  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5', !first && 'border-t')}>
      <FieldIcon kind={field.kind} className="size-4" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{field.label}</span>
          {field.link?.target !== undefined && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Link2 className="size-3" />
              {field.link.target}
            </Badge>
          )}
          {field.link?.masked === true && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              cible non visible
            </Badge>
          )}
        </div>
        <span className="truncate font-mono text-xs text-muted-foreground">{field.name}</span>
      </div>

      <span className="w-32 shrink-0 text-sm text-muted-foreground">
        {KIND_LABELS[field.kind] ?? field.kind}
      </span>

      {/* Required — a switch on the row, because it is an act on the table and not a
          property one ticks while creating a column. */}
      {field.system === true ? (
        <Badge variant="outline" className="w-28 shrink-0 justify-center font-normal">
          <Key className="size-3" />
          système
        </Badge>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={field.required === true ? 'secondary' : 'ghost'}
              size="sm"
              className="w-28 shrink-0"
              disabled={busy || field.kind === 'formula'}
              onClick={() => onRequired(field.required !== true)}
            >
              {field.required === true ? (
                <>
                  <Check className="size-3.5" />
                  Obligatoire
                </>
              ) : (
                <>
                  <X className="size-3.5" />
                  Facultatif
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {field.required === true
              ? 'Retirer l’obligation : une seule instruction, aucun balayage.'
              : 'Rendre obligatoire : échafaudage, validation, puis SET NOT NULL — la table n’est jamais bloquée le temps d’un balayage. Échoue si une ligne est vide.'}
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy || field.system === true || field.kind === 'link'}
            onClick={onDisplay}
            aria-label="Désigner comme colonne d’affichage"
          >
            <Star className={cn('size-4', isDisplay && 'fill-primary text-primary')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Colonne d’affichage : ce qui est montré à la place d’un UUID dans une cellule de lien.
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

interface Draft {
  readonly label: string
  readonly kind: string
  readonly target?: string
  readonly options?: ReadonlyArray<{ value: string; label?: string }>
}

function AddFieldDialog({
  open,
  table,
  base,
  onClose,
  onSubmit,
}: {
  readonly open: boolean
  readonly table: Table
  readonly base: DescribedBase
  readonly onClose: () => void
  readonly onSubmit: (draft: Draft) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<string>('short_text')
  const [target, setTarget] = useState('')
  const [options, setOptions] = useState('')

  const targets = base.tables.filter((t) => t.name !== table.name)
  const parsed = options
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => ({ value: line }))

  const ready =
    label.trim() !== '' &&
    (kind !== 'link' || target !== '') &&
    (kind !== 'select' || parsed.length > 0)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau champ dans {table.label}</DialogTitle>
          <DialogDescription>
            Le champ est créé <strong>facultatif</strong>, toujours. Une colonne obligatoire ne peut
            pas naître sur une table qui contient déjà des lignes — remplissez-la, puis rendez-la
            obligatoire depuis la liste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="field-label" className="text-sm text-muted-foreground">
              Libellé
            </label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ville"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="field-kind" className="text-sm text-muted-foreground">
              Type
            </label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="field-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATABLE.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
                {targets.length > 0 && <SelectItem value="link">Lien</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {kind === 'link' && (
            <div className="space-y-1.5">
              <label htmlFor="field-target" className="text-sm text-muted-foreground">
                Table cible
              </label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="field-target">
                  <SelectValue placeholder="Choisir une table" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Une vraie clé étrangère PostgreSQL, vérifiée par la base : supprimer une ligne
                encore référencée sera refusé, y compris en SQL direct.
              </p>
            </div>
          )}

          {kind === 'select' && (
            <div className="space-y-1.5">
              <label htmlFor="field-options" className="text-sm text-muted-foreground">
                Choix, un par ligne
              </label>
              <textarea
                id="field-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                rows={4}
                placeholder={'actif\na_contacter\ninactif'}
                className="flex w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
              />
              <p className="text-xs text-muted-foreground">
                La liste devient une contrainte <span className="font-mono">CHECK</span> : une
                valeur hors liste est refusée par PostgreSQL, pas seulement par l’écran.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!ready}
            onClick={() => {
              void onSubmit({
                label,
                kind,
                target: kind === 'link' ? target : undefined,
                options: kind === 'select' ? parsed : undefined,
              })
              setLabel('')
              setOptions('')
              setTarget('')
            }}
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
