'use client'

import {
  AddDescription,
  DescriptionEditor,
  DescriptionField,
  DescriptionText,
  hasDescription,
  isTooLong,
  useDescriptionEdit,
} from '@/components/app/description'
import { FieldIcon, KIND_LABELS, KindLabel } from '@/components/app/field-icon'
import { NewTableDialog } from '@/components/app/new-table-dialog'
import { OptionBadge } from '@/components/app/option-badge'
import { OptionsEditor } from '@/components/app/options-editor'
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
import {
  type DescribedBase,
  type Field,
  type FieldOptionInput,
  type Table,
  api,
} from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { type OptionDraft, draftsOf, emptyDraft, optionsOf } from '@/lib/options'
import { cn } from '@/lib/utils'
import { Check, Key, Link2, Pencil, Plus, Star, Table2, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
 *
 * Descriptions are the opposite kind of act: a catalog `UPDATE` that touches no data, so
 * they are edited in place — click the text, type, click away — on the table and on each
 * field. They are what the generated documentation and the agents read, which is why
 * this is the screen that asks for them, not an afterthought reached through a menu.
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
  const [naming, setNaming] = useState(false)
  const [deleting, setDeleting] = useState<Table | null>(null)
  const [editing, setEditing] = useState<Field | null>(null)

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
          <span className="font-mono text-xs">psql</span> à la seconde suivante, avec sa description
          en commentaire — à défaut, son libellé.
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
            onClick={() => setNaming(true)}
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

            {/* Keyed by table: a half-typed description must not follow one to the next. The
                key is prefixed because the list of fields below is keyed by the same name. */}
            <TableDescription
              key={`description:${table.name}`}
              table={table}
              busy={busy}
              onChanged={onChanged}
            />

            <div key={table.name} className="overflow-hidden rounded-xl border">
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
                  onEdit={() => setEditing(field)}
                  onDescription={async (next) => {
                    // Not through `run`: it locks the whole screen, and rewriting a sentence
                    // is no reason to. The editor shows its own refusal, in place.
                    await api.setFieldDescription(table, field.name, next)
                    await onChanged()
                  }}
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
                    await api.createLink(table, field.label, field.target ?? '', field.description)
                  } else {
                    await api.addField(table, {
                      label: field.label,
                      kind: field.kind,
                      description: field.description,
                      options: field.options,
                    })
                  }
                })
                setAdding(false)
              }}
            />

            <EditFieldDialog
              field={editing}
              table={table}
              onClose={() => setEditing(null)}
              onSaved={onChanged}
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

      <NewTableDialog
        open={naming}
        base={base}
        busy={busy}
        onClose={() => setNaming(false)}
        onSubmit={async (label, description) => {
          await run(async () => {
            const created = await api.createTableIn(base.name, label, description)
            // Land on the table just made: it is what was asked for, and its description
            // is one click away instead of behind a search for the right table.
            setOpenTable(created.name)
          })
          setNaming(false)
        }}
      />
    </div>
  )
}

/**
 * The description of the open table, above its fields — the same in-place editing as on a
 * field row, at the size of a paragraph because it is read as one.
 *
 * Empty, it shows the invitation in full and not on hover: there is exactly one per
 * screen, and it is the description that gives every field below it its context.
 */
function TableDescription({
  table,
  busy,
  onChanged,
}: {
  readonly table: Table
  readonly busy: boolean
  readonly onChanged: () => Promise<void>
}) {
  const subject = `la table ${table.label}`
  const edit = useDescriptionEdit(table.description, async (next) => {
    await api.setTableDescription(table, next)
    await onChanged()
  })

  return (
    <div className="mb-4">
      {edit.editing ? (
        <DescriptionEditor
          edit={edit}
          subject={subject}
          size="md"
          placeholder="À quoi sert cette table ? Visible dans la documentation et par les agents."
        />
      ) : hasDescription(table.description) ? (
        <DescriptionText
          text={table.description}
          subject={subject}
          size="md"
          lines={3}
          onEdit={edit.begin}
          disabled={busy}
        />
      ) : (
        <AddDescription
          onClick={edit.begin}
          subject={subject}
          disabled={busy}
          className="text-sm"
        />
      )}
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
export function DeleteTableDialog({
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
  onEdit,
  onDescription,
}: {
  readonly field: Field
  readonly table: Table
  readonly first: boolean
  readonly busy: boolean
  readonly onRequired: (required: boolean) => void
  readonly onDisplay: () => void
  readonly onEdit: () => void
  readonly onDescription: (next: string | null) => Promise<void>
}) {
  const isDisplay = table.display_field === field.name

  // A system column carries a description of the server's own, shown and never edited.
  const editable = field.system !== true
  const subject = `le champ ${field.label}`
  const edit = useDescriptionEdit(field.description, onDescription)
  const described = hasDescription(field.description)

  return (
    <div className={cn('group/row flex items-center gap-3 px-3 py-2.5', !first && 'border-t')}>
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

        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-xs text-muted-foreground">{field.name}</span>
          {/* The invitation shares the line the technical name already occupies and shows
              on hover or focus: a table of twenty fields does not want twenty of them, and
              a row that grows when the pointer arrives is worse than either. */}
          {editable && !described && !edit.editing && (
            <AddDescription
              onClick={edit.begin}
              subject={subject}
              disabled={busy}
              className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            />
          )}
        </div>

        {edit.editing ? (
          <div className="mt-1.5">
            <DescriptionEditor
              edit={edit}
              subject={subject}
              placeholder="Que contient ce champ ? Sens, format, unité… Visible dans la documentation et par les agents."
            />
          </div>
        ) : (
          described && (
            <div className="mt-1">
              <DescriptionText
                text={field.description}
                subject={subject}
                onEdit={editable ? edit.begin : undefined}
                disabled={busy}
              />
            </div>
          )
        )}

        {/* The choices as they will look, so the colours picked in the editor are seen where
            the field is read — and a list nobody dressed stays as quiet as it was. */}
        {field.kind === 'select' && (field.options?.length ?? 0) > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {field.options?.slice(0, 8).map((o) => (
              <OptionBadge key={o.value} option={o} />
            ))}
            {(field.options?.length ?? 0) > 8 && (
              <span className="self-center text-xs text-muted-foreground">
                +{(field.options?.length ?? 0) - 8}
              </span>
            )}
          </div>
        )}
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

      {/* A system column is the server's own: nothing here to edit, and no button that would
          only ever be disabled. The slot is kept so the columns of the list stay aligned. */}
      {editable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              onClick={onEdit}
              aria-label={`Modifier le champ ${field.label}`}
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Modifier le libellé{field.kind === 'select' ? ' et les choix' : ''}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="size-8 shrink-0" />
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

/**
 * Editing a field: what it is called and, for a list of choices, the choices.
 *
 * The label is renamed in the catalog and never in the column, so this is safe on a table of
 * any size and for any script written against the column. The type is shown and not offered:
 * changing it is a copy of the whole column (chapter 03), a different act from this one, and
 * a dialog that pretended otherwise would be worse than one that says so.
 *
 * The list is sent whole. Which values were added, re-dressed or removed is the server's to
 * work out — and its to refuse: dropping a choice that rows still carry comes back as
 * `OPTION_IN_USE` with the count, and the dialog stays open on the list as it was typed.
 */
function EditFieldDialog({
  field,
  table,
  onClose,
  onSaved,
}: {
  readonly field: Field | null
  readonly table: Table
  readonly onClose: () => void
  readonly onSaved: () => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [drafts, setDrafts] = useState<OptionDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Opening the dialog opens the field as it is NOW: nothing typed for another field, or
  // before a refusal, is carried over.
  useEffect(() => {
    if (field === null) return
    setLabel(field.label)
    setDrafts(draftsOf(field.options))
    setError(null)
  }, [field])

  const isSelect = field?.kind === 'select'
  const known = useMemo(() => new Set((field?.options ?? []).map((o) => o.value)), [field])
  const original = useMemo(() => JSON.stringify(optionsOf(draftsOf(field?.options))), [field])

  const next = optionsOf(drafts)
  const optionsChanged = isSelect && JSON.stringify(next) !== original
  const labelChanged = field !== null && label.trim() !== field.label
  const ready =
    field !== null &&
    label.trim() !== '' &&
    (!isSelect || next.length > 0) &&
    (labelChanged || optionsChanged) &&
    !busy

  const save = async () => {
    if (field === null || !ready) return
    setBusy(true)
    setError(null)
    try {
      // Each step refreshes the screen: a rename that went through must show even when
      // the choices that follow are refused.
      if (labelChanged) {
        await api.setFieldLabel(table, field.name, label.trim())
        await onSaved()
      }
      if (optionsChanged) {
        await api.setFieldOptions(table, field.name, next)
        await onSaved()
      }
      onClose()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={field !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifier {field?.label}</DialogTitle>
          <DialogDescription>
            Le libellé change dans le catalogue, pas dans la colonne :{' '}
            <span className="font-mono text-xs">{field?.name}</span> reste le nom que voit{' '}
            <span className="font-mono text-xs">psql</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-field-label" className="text-sm text-muted-foreground">
              Libellé
            </label>
            <Input
              id="edit-field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              disabled={busy}
              autoFocus
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Type :{' '}
            <span className="font-medium text-foreground">
              {field === null ? '' : (KIND_LABELS[field.kind] ?? field.kind)}
            </span>{' '}
            — un type ne se change pas depuis cet écran.
          </p>

          {isSelect && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Choix</p>
              <OptionsEditor value={drafts} onChange={setDrafts} known={known} disabled={busy} />
              <p className="text-xs text-muted-foreground">
                La liste est une contrainte <span className="font-mono">CHECK</span> : ajouter ou
                retirer un choix la régénère, sans bloquer les écritures. Retirer un choix que des
                lignes portent encore est refusé, avec leur nombre. La couleur, le pictogramme et
                l’image ne concernent que l’écran : la colonne ne les connaît pas.
              </p>
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
            Annuler
          </Button>
          <Button disabled={!ready} onClick={() => void save()}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Draft {
  readonly label: string
  readonly kind: string
  /** Absent, not empty, when the box was left blank. */
  readonly description?: string
  readonly target?: string
  readonly options?: readonly FieldOptionInput[]
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
  const [choices, setChoices] = useState<OptionDraft[]>(() => [emptyDraft()])
  const [description, setDescription] = useState('')

  const targets = base.tables.filter((t) => t.name !== table.name)
  const parsed = optionsOf(choices)

  const ready =
    label.trim() !== '' &&
    (kind !== 'link' || target !== '') &&
    (kind !== 'select' || parsed.length > 0) &&
    !isTooLong(description)

  const submit = () => {
    if (!ready) return
    void onSubmit({
      label,
      kind,
      description: description.trim() === '' ? undefined : description.trim(),
      target: kind === 'link' ? target : undefined,
      options: kind === 'select' ? parsed : undefined,
    })
    setLabel('')
    setChoices([emptyDraft()])
    setTarget('')
    setDescription('')
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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
                    <KindLabel kind={k} />
                  </SelectItem>
                ))}
                {targets.length > 0 && (
                  <SelectItem value="link">
                    <KindLabel kind="link" />
                  </SelectItem>
                )}
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
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Choix</p>
              <OptionsEditor value={choices} onChange={setChoices} />
              <p className="text-xs text-muted-foreground">
                La liste devient une contrainte <span className="font-mono">CHECK</span> : une
                valeur hors liste est refusée par PostgreSQL, pas seulement par l’écran.
              </p>
            </div>
          )}

          <DescriptionField
            id="field-description"
            value={description}
            onChange={setDescription}
            onSubmit={submit}
            placeholder="Que contient ce champ ? Sens, format, unité… Visible dans la documentation et par les agents."
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!ready} onClick={submit}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
