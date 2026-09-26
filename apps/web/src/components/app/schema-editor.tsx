'use client'

import {
  type AiDraft,
  AiFieldForm,
  AiStatusSummary,
  AiToggle,
  acceptsAi,
  aiDraftOf,
  aiInputOf,
  aiReady,
  emptyAiDraft,
  sameAi,
} from '@/components/app/ai-field'
import {
  FormulaEditor,
  type RollupDraft,
  RollupForm,
  emptyRollup,
  pathsOf,
  rollupInputOf,
  rollupReady,
} from '@/components/app/computed-field-form'
import {
  AddDescription,
  DescriptionEditor,
  DescriptionField,
  DescriptionText,
  hasDescription,
  isTooLong,
  useDescriptionEdit,
} from '@/components/app/description'
import { EditTableDialog } from '@/components/app/edit-table-dialog'
import { FORMAT_LABELS, FieldIcon, KIND_LABELS, KindLabel } from '@/components/app/field-icon'
import { PhysicalRenameDialog, type PhysicalTarget } from '@/components/app/lifecycle-dialogs'
import { NewTableDialog } from '@/components/app/new-table-dialog'
import { LookIcon, OptionBadge } from '@/components/app/option-badge'
import { OptionsEditor } from '@/components/app/options-editor'
import { SortableFields } from '@/components/app/sortable-fields'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type AiFieldInput,
  type AiFieldStatus,
  type DescribedBase,
  type Field,
  type FieldOptionInput,
  type Table,
  api,
} from '@/lib/api/client'
import { describeComputed } from '@/lib/computed'
import { CURRENCIES, type FormatInput, PRESETS, formatOf, formatsFor } from '@/lib/format'
import { messageFor } from '@/lib/messages'
import { type OptionDraft, draftsOf, emptyDraft, optionsOf } from '@/lib/options'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  Check,
  CodeXml,
  Key,
  Link2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
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

/** A field's format as the edition dialog holds it; `null` for a type without formats. */
function formatInputOf(field: Field): FormatInput | null {
  if (formatsFor(field.kind).length === 0) return null
  const display = formatOf(field)
  return {
    display,
    currency: display === 'currency' ? (field.format?.currency ?? 'EUR') : undefined,
    rating_max: display === 'rating' ? (field.format?.rating_max ?? 5) : undefined,
  }
}

/** The kinds whose values come from a list of choices, edited in the same way. */
const hasChoices = (kind: string | undefined) => kind === 'select' || kind === 'multi_select'

/**
 * The kinds that cannot be a table's display column — the catalog's `can_be_display`
 * says no, so the star is not offered rather than refused after a click.
 */
const NOT_DISPLAYABLE = new Set([
  'link',
  'multi_link',
  'long_text',
  'boolean',
  'multi_select',
  'file',
  'image',
])

/** The columns an AI prompt may cite: the table's own, the field itself excluded. */
const citable = (table: Table, self?: string) =>
  table.fields.filter((f) => f.system !== true && f.name !== self)

interface Props {
  readonly base: DescribedBase
  readonly onChanged: () => Promise<void>
  /** The administration role: physical names (chapter 06). */
  readonly administers?: boolean
  /**
   * The tables whose structure the reader may change: `manage_schema` on them. The base's
   * description lists only the DATA verbs of a table, so a « Gestion » granted on one table
   * alone is known from the navigation's projects and handed in here.
   */
  readonly buildable?: ReadonlySet<string>
}

const NOTHING: ReadonlySet<string> = new Set()

export function SchemaEditor({ base, onChanged, administers = false, buildable = NOTHING }: Props) {
  const [openTable, setOpenTable] = useState<string | null>(base.tables[0]?.name ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [naming, setNaming] = useState(false)
  const [deleting, setDeleting] = useState<Table | null>(null)
  const [renaming, setRenaming] = useState<Table | null>(null)
  const [editing, setEditing] = useState<Field | null>(null)
  const [physical, setPhysical] = useState<PhysicalTarget | null>(null)

  const table = base.tables.find((t) => t.name === openTable) ?? base.tables[0] ?? null

  // What the server demands (chapter 05 §8): a table is added to a base, or deleted from it,
  // with `manage_schema` on the base; its fields are built with `manage_schema` on the table.
  // « Édition » holds neither: the screen then shows the structure and offers nothing that
  // would only come back refused.
  const buildsBase = base.actions.includes('manage_schema')
  const builds = table !== null && (buildsBase || buildable.has(table.name))

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
        {!buildsBase && !builds && (
          <p className="mt-1 text-sm text-muted-foreground">
            Consultation seule : modifier la structure demande l’accès « Gestion ».
          </p>
        )}
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
              <LookIcon look={t} fallback={Table2} className="text-muted-foreground" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
          {buildsBase && (
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
          )}
        </div>

        {/* Fields */}
        {table !== null && (
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{table.label}</h2>
                <p className="truncate font-mono text-xs text-muted-foreground">{table.name}</p>
              </div>
              {builds && (
                <>
                  <Button size="sm" onClick={() => setAdding(true)} disabled={busy}>
                    <Plus className="size-4" />
                    Champ
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRenaming(table)}
                    disabled={busy}
                  >
                    <Pencil className="size-4" />
                    Modifier
                  </Button>
                </>
              )}
              {buildsBase && (
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
              )}
            </div>

            {/* Keyed by table: a half-typed description must not follow one to the next. The
                key is prefixed because the list of fields below is keyed by the same name. */}
            <TableDescription
              key={`description:${table.name}`}
              table={table}
              busy={busy}
              builds={builds}
              onChanged={onChanged}
            />

            <div key={table.name} className="overflow-hidden rounded-xl border">
              <SortableFields
                table={table}
                disabled={busy || !builds}
                onReorder={(names) =>
                  run(async () => {
                    await api.reorderFields(table, names)
                    // The grid follows the new order: a column order dragged there before,
                    // kept by this browser, would hide it.
                    const state = useWorkspace.getState()
                    for (const tab of state.tabs) {
                      if (tab.base === base.name && tab.table === table.name) {
                        state.patchView(tab.id, { columnOrder: null })
                      }
                    }
                  })
                }
              >
                {(field, index, handle) => (
                  <FieldRow
                    key={field.name}
                    field={field}
                    table={table}
                    first={index === 0}
                    busy={busy}
                    builds={builds}
                    handle={handle}
                    onRequired={(required) =>
                      void run(() => api.setFieldRequired(table, field.name, required))
                    }
                    onDisplay={() => void run(() => api.setDisplayColumn(table, field.name))}
                    onEdit={() => setEditing(field)}
                    onPhysical={
                      administers && field.id !== undefined && field.system !== true
                        ? () =>
                            setPhysical({
                              kind: 'field',
                              id: field.id as string,
                              label: field.label,
                            })
                        : undefined
                    }
                    onDescription={async (next) => {
                      // Not through `run`: it locks the whole screen, and rewriting a sentence
                      // is no reason to. The editor shows its own refusal, in place.
                      await api.setFieldDescription(table, field.name, next)
                      await onChanged()
                    }}
                  />
                )}
              </SortableFields>
            </div>

            <AddFieldDialog
              open={adding}
              table={table}
              base={base}
              onClose={() => setAdding(false)}
              onSubmit={async (field) => {
                // The refusal is said in the dialog, which stays open on what was typed: a
                // prompt rewritten three times is not something to lose to a typo.
                try {
                  if (field.kind === 'link') {
                    await api.createLink(
                      table,
                      field.label,
                      field.target ?? '',
                      field.description,
                      field.multiple,
                    )
                  } else {
                    await api.addField(table, {
                      label: field.label,
                      kind: field.kind,
                      description: field.description,
                      options: field.options,
                      ai: field.ai,
                      format: field.format,
                      formula: field.formula,
                      rollup: field.rollup,
                      button:
                        field.button === undefined
                          ? undefined
                          : {
                              label: field.button.label,
                              action: field.button.action,
                              ...(field.button.action === 'url'
                                ? { url: field.button.url }
                                : { automation: field.button.automation }),
                            },
                    })
                  }
                } catch (e) {
                  return messageFor(e)
                }
                setAdding(false)
                await onChanged()
                return null
              }}
            />

            <EditFieldDialog
              field={editing}
              table={table}
              tables={base.tables}
              onClose={() => setEditing(null)}
              onSaved={onChanged}
            />

            <PhysicalRenameDialog
              target={physical}
              onClose={() => setPhysical(null)}
              onDone={() => {
                setPhysical(null)
                void onChanged()
              }}
            />

            <EditTableDialog
              table={renaming}
              onClose={() => setRenaming(null)}
              onSaved={async (label) => {
                // The tabs open on it carry the label they were opened with.
                const renamed = renaming
                if (renamed !== null) {
                  const { tabs, rename } = useWorkspace.getState()
                  for (const tab of tabs) {
                    if (
                      tab.kind === 'table' &&
                      tab.base === renamed.base &&
                      tab.table === renamed.name
                    ) {
                      rename(tab.id, label)
                    }
                  }
                }
                await onChanged()
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
  builds,
  onChanged,
}: {
  readonly table: Table
  readonly busy: boolean
  /** `manage_schema` on the table: without it the description is read, never edited. */
  readonly builds: boolean
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
          placeholder="À quoi sert cette table ?"
        />
      ) : hasDescription(table.description) ? (
        <DescriptionText
          text={table.description}
          subject={subject}
          size="md"
          lines={3}
          onEdit={builds ? edit.begin : undefined}
          disabled={busy}
        />
      ) : (
        builds && (
          <AddDescription
            onClick={edit.begin}
            subject={subject}
            disabled={busy}
            className="text-sm"
          />
        )
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
            {preview?.row_count != null && preview.row_count > 0
              ? `Ses données (environ ${preview.row_count.toLocaleString('fr-FR')} lignes) restent lisibles en SQL.`
              : 'Ses données restent lisibles en SQL.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {blocked && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              Retirez d’abord les relations qui pointent vers cette table :{' '}
              {preview?.referenced_by.join(', ')}.
            </p>
          )}

          {!blocked && (preview?.locked_tables.length ?? 0) > 0 && (
            <p className="text-muted-foreground">
              Tables verrouillées brièvement : {preview?.locked_tables.join(', ')}.
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
  builds,
  onRequired,
  onDisplay,
  onEdit,
  onPhysical,
  onDescription,
  handle,
}: {
  readonly field: Field
  readonly table: Table
  readonly first: boolean
  readonly busy: boolean
  /** `manage_schema` on the table: without it the row states the field and offers nothing. */
  readonly builds: boolean
  /** The grip that moves the row — a blank of its width for a row that does not move. */
  readonly handle?: React.ReactNode
  readonly onRequired: (required: boolean) => void
  readonly onDisplay: () => void
  readonly onEdit: () => void
  /** Renaming the COLUMN — administration only, and without an alias (chapter 06 §3.1). */
  readonly onPhysical?: () => void
  readonly onDescription: (next: string | null) => Promise<void>
}) {
  const isDisplay = table.display_field === field.name

  // A system column carries a description of the server's own, shown and never edited.
  const editable = builds && field.system !== true
  const subject = `le champ ${field.label}`
  const edit = useDescriptionEdit(field.description, onDescription)
  const described = hasDescription(field.description)

  return (
    <div className={cn('group/row flex items-center gap-3 px-3 py-2.5', !first && 'border-t')}>
      {handle}
      <FieldIcon kind={field.kind} format={field.format?.display} className="size-4" />

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
              placeholder="Que contient ce champ ?"
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
        {hasChoices(field.kind) && (field.options?.length ?? 0) > 0 && (
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

      <span className="flex w-32 shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        {(field.format === undefined ? undefined : FORMAT_LABELS[field.format.display]) ??
          KIND_LABELS[field.kind] ??
          field.kind}
        {/* The AI is an option of the type, said where the type is. */}
        {field.ai === true && (
          <span
            className="inline-flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400"
            title="Rempli par l’IA"
          >
            <Sparkles className="size-3" />
            IA
          </span>
        )}
      </span>

      {/* Required — a switch on the row, because it is an act on the table and not a
          property one ticks while creating a column. */}
      {field.system === true ? (
        <Badge variant="outline" className="w-28 shrink-0 justify-center font-normal">
          <Key className="size-3" />
          système
        </Badge>
      ) : !builds ? (
        // Said, not offered: making a field required is building the table.
        <Badge variant="outline" className="w-28 shrink-0 justify-center font-normal">
          {field.required === true ? <Check className="size-3" /> : <X className="size-3" />}
          {field.required === true ? 'Obligatoire' : 'Facultatif'}
        </Badge>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={field.required === true ? 'secondary' : 'ghost'}
              size="sm"
              className="w-28 shrink-0"
              // A computed value is always there: formula, AI, autonumber are never « required ».
              disabled={
                busy || field.kind === 'formula' || field.kind === 'autonumber' || field.ai === true
              }
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
              ? 'Rendre facultatif'
              : 'Rendre obligatoire (refusé si une ligne est vide)'}
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
            Modifier le libellé
            {hasChoices(field.kind) ? ' et les choix' : ''}
            {field.ai === true ? ' et la consigne de l’IA' : ''}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="size-8 shrink-0" />
      )}

      {onPhysical !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              onClick={onPhysical}
              aria-label={`Renommer en base le champ ${field.label}`}
            >
              <CodeXml className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Renommer la colonne en base ({field.name})</TooltipContent>
        </Tooltip>
      )}

      {builds ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy || field.system === true || NOT_DISPLAYABLE.has(field.kind)}
              onClick={onDisplay}
              aria-label="Désigner comme colonne d’affichage"
            >
              <Star className={cn('size-4', isDisplay && 'fill-primary text-primary')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Colonne d’affichage, montrée dans les relations
          </TooltipContent>
        </Tooltip>
      ) : (
        // The display column is still worth knowing; only the designation is withheld.
        <span
          className="flex size-8 shrink-0 items-center justify-center"
          title={isDisplay ? 'Colonne d’affichage, montrée dans les relations' : undefined}
        >
          {isDisplay && <Star className="size-4 fill-primary text-primary" />}
        </span>
      )}
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
  tables,
  onClose,
  onSaved,
}: {
  readonly field: Field | null
  readonly table: Table
  /** The base's tables: what a lookup or a rollup reads through is named from them. */
  readonly tables: readonly Table[]
  readonly onClose: () => void
  readonly onSaved: () => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [drafts, setDrafts] = useState<OptionDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // An AI field: its status as read on opening, the draft made of it, and whether saving
  // a new prompt recomputes the rows already filled.
  const [status, setStatus] = useState<AiFieldStatus | null>(null)
  const [ai, setAi] = useState<AiDraft | null>(null)
  const [recompute, setRecompute] = useState(true)
  const [swept, setSwept] = useState(false)
  // The AI option: as the field has it, and as the switch now says.
  const wasAi = field?.ai === true
  const [aiOn, setAiOn] = useState(false)
  const [format, setFormat] = useState<FormatInput | null>(null)
  const [expression, setExpression] = useState('')

  const isAi = aiOn
  const columns = useMemo(() => citable(table, field?.name), [table, field])
  const formats = formatsFor(field?.kind ?? '')

  // Opening the dialog opens the field as it is NOW: nothing typed for another field, or
  // before a refusal, is carried over.
  useEffect(() => {
    if (field === null) return
    setLabel(field.label)
    setDrafts(draftsOf(field.options))
    setError(null)
    setStatus(null)
    setAi(null)
    setRecompute(true)
    setSwept(false)
    setAiOn(field.ai === true)
    setFormat(formatInputOf(field))
    setExpression(field.computed?.expression ?? '')
    if (field.ai !== true) return
    let current = true
    api
      .aiFieldStatus(table, field.name)
      .then((read) => {
        if (!current) return
        setStatus(read)
        setAi(aiDraftOf(read, table.fields))
      })
      .catch((e) => current && setError(messageFor(e)))
    return () => {
      current = false
    }
  }, [field, table])

  const isSelect = hasChoices(field?.kind)
  const known = useMemo(() => new Set((field?.options ?? []).map((o) => o.value)), [field])
  const original = useMemo(() => JSON.stringify(optionsOf(draftsOf(field?.options))), [field])
  const originalAi = useMemo(
    () => (status === null ? null : aiDraftOf(status, table.fields)),
    [status, table],
  )

  const next = optionsOf(drafts)
  const optionsChanged = isSelect && JSON.stringify(next) !== original
  const labelChanged = field !== null && label.trim() !== field.label
  // Switched on, a new prompt; kept on, a changed one; switched off, the option removed.
  const aiChanged =
    aiOn && ai !== null && (!wasAi || (originalAi !== null && !sameAi(ai, originalAi)))
  const aiRemoved = wasAi && !aiOn
  const formatChanged =
    field !== null &&
    format !== null &&
    JSON.stringify(format) !== JSON.stringify(formatInputOf(field))
  const formulaChanged =
    field?.kind === 'formula' &&
    expression.trim() !== '' &&
    expression.trim() !== (field.computed?.expression ?? '')
  const ready =
    field !== null &&
    label.trim() !== '' &&
    (!isSelect || next.length > 0) &&
    (!aiChanged || (ai !== null && aiReady(ai, columns))) &&
    (labelChanged || optionsChanged || aiChanged || aiRemoved || formatChanged || formulaChanged) &&
    !busy

  /** Every row again, now — the prompt as saved. */
  const sweep = async () => {
    if (field === null) return
    setBusy(true)
    setError(null)
    try {
      await api.runAiSweep(table, field.name)
      setSwept(true)
      setStatus(await api.aiFieldStatus(table, field.name))
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

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
      if (formatChanged && format !== null) {
        await api.setFieldFormat(table, field.name, format)
        await onSaved()
      }
      if (formulaChanged) {
        await api.setFormula(table, field.name, expression.trim())
        await onSaved()
      }
      if (aiChanged && ai !== null) {
        await api.setAiField(table, field.name, { ...aiInputOf(ai), recompute })
        await onSaved()
      }
      if (aiRemoved) {
        await api.disableAiField(table, field.name)
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
      <DialogContent
        className={cn('max-h-[90vh] overflow-y-auto', isAi ? 'sm:max-w-2xl' : 'sm:max-w-xl')}
      >
        <DialogHeader>
          <DialogTitle>Modifier {field?.label}</DialogTitle>
          <DialogDescription asChild>
            <div>
              {field !== null && <KindLabel kind={field.kind} format={field.format?.display} />}
            </div>
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

          {isSelect && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Choix</p>
              <OptionsEditor value={drafts} onChange={setDrafts} known={known} disabled={busy} />
            </div>
          )}

          {field?.kind === 'formula' && (
            <FormulaEditor
              value={expression}
              onChange={setExpression}
              fields={table.fields.filter((f) => f.name !== field.name)}
              disabled={busy}
            />
          )}

          {field !== null && field.kind !== 'formula' && field.computed !== undefined && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              {describeComputed(field, tables)}
            </p>
          )}

          {formats.length > 0 && format !== null && (
            <div className="space-y-1.5">
              <label htmlFor="edit-field-format" className="text-sm text-muted-foreground">
                Affichage
              </label>
              <Select
                value={format.display}
                onValueChange={(display) =>
                  setFormat({
                    display,
                    currency: display === 'currency' ? (format.currency ?? 'EUR') : undefined,
                    rating_max: display === 'rating' ? (format.rating_max ?? 5) : undefined,
                  })
                }
                disabled={busy}
              >
                <SelectTrigger id="edit-field-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formats.map(([value, name]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <FieldIcon kind={field?.kind ?? ''} format={value} />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Seule la lecture change : les valeurs enregistrées restent les mêmes.
              </p>
            </div>
          )}

          {formats.length > 0 && format !== null && (
            <FormatDetails value={format} onChange={setFormat} disabled={busy} />
          )}

          {field !== null && acceptsAi(field.kind) && (
            <AiToggle
              checked={aiOn}
              onChange={(on) => {
                setAiOn(on)
                // Switched on for the first time: an empty prompt to write, and consent.
                if (on && ai === null) setAi(emptyAiDraft())
              }}
              disabled={busy}
            />
          )}

          {aiRemoved && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              Le champ redeviendra un champ ordinaire : ses valeurs restent, et chacun pourra les
              modifier.
            </p>
          )}

          {isAi && wasAi && status !== null && (
            <div className="space-y-2">
              <AiStatusSummary status={status} />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void sweep()}
                  disabled={busy || status.sweeping || swept}
                >
                  Tout recalculer maintenant
                </Button>
                {swept && (
                  <span className="text-xs text-muted-foreground">
                    Demandé : les lignes sont recalculées en arrière-plan.
                  </span>
                )}
              </div>
            </div>
          )}

          {isAi && ai !== null && (
            <AiFieldForm
              value={ai}
              onChange={setAi}
              fields={columns}
              kind={field?.kind}
              disabled={busy}
            />
          )}

          {aiChanged && (
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="ai-recompute"
                checked={recompute}
                onCheckedChange={(checked) => setRecompute(checked === true)}
                disabled={busy}
              />
              <label htmlFor="ai-recompute" className="cursor-pointer">
                Recalculer aussi les lignes déjà remplies
              </label>
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
  readonly ai?: AiFieldInput
  readonly format?: FormatInput
  /** A relation to several rows: a multi-link (chapter 04 §4 bis). */
  readonly multiple?: boolean
  /** A formula's expression (chapter 04 §7). */
  readonly formula?: { readonly expression: string }
  /** The path of a lookup, a rollup or a count (chapter 04 §7 ter). */
  readonly rollup?: import('@/lib/api/client').RollupInput
  /** A button's label and action (chapter 17 §4). */
  readonly button?: ButtonDraft
}

/** How many stars a rating may be out of. */
const RATING_MAXES = [3, 4, 5, 6, 7, 8, 9, 10]

/**
 * The details a format asks for — the currency of an amount, the number of stars of a
 * rating. Shared by the creation and the edition of a field.
 */
function FormatDetails({
  value,
  onChange,
  disabled,
}: {
  readonly value: FormatInput
  readonly onChange: (next: FormatInput) => void
  readonly disabled?: boolean
}) {
  if (value.display === 'currency') {
    return (
      <div className="space-y-1.5">
        <label htmlFor="field-currency" className="text-sm text-muted-foreground">
          Devise
        </label>
        <Select
          value={value.currency ?? 'EUR'}
          onValueChange={(currency) => onChange({ ...value, currency })}
          disabled={disabled}
        >
          <SelectTrigger id="field-currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  if (value.display === 'rating') {
    return (
      <div className="space-y-1.5">
        <label htmlFor="field-rating-max" className="text-sm text-muted-foreground">
          Nombre d’étoiles
        </label>
        <Select
          value={String(value.rating_max ?? 5)}
          onValueChange={(n) => onChange({ ...value, rating_max: Number(n) })}
          disabled={disabled}
        >
          <SelectTrigger id="field-rating-max">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATING_MAXES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  return null
}

/** What a type means for the rows, said before one creates it. */
const KIND_NOTES: Readonly<Record<string, string>> = {
  file: 'Des fichiers de tout type, jusqu’à 20 par ligne. Ils s’ouvrent dans le navigateur quand c’est sûr (PDF, images), sinon se téléchargent.',
  image:
    'Des images PNG, JPEG, GIF, WebP ou AVIF, jusqu’à 20 par ligne. Le type est vérifié sur le contenu, pas sur le nom.',
  autonumber:
    'Un numéro donné à chaque ligne à sa création, dans l’ordre, lignes existantes comprises. Personne ne le saisit ni ne le modifie.',
  user: 'Une personne de l’espace de travail. Une personne dont le compte est désactivé reste affichée sur ses lignes, mais n’est plus proposée.',
  email: 'Une adresse vérifiée à l’écriture, qui s’ouvre dans la messagerie en un clic.',
  button:
    'Un bouton dans chaque ligne, sans valeur : il ouvre une adresse composée avec la ligne, ou lance une automatisation de la base déclenchée par un bouton.',
}

interface ButtonDraft {
  readonly label: string
  readonly action: 'url' | 'automation'
  readonly url: string
  readonly automation: string
}

const emptyButton = (): ButtonDraft => ({
  label: '',
  action: 'url',
  url: 'https://',
  automation: '',
})

/** A button's settings: its label, and an address or an automation. */
function ButtonForm({
  table,
  base,
  value,
  onChange,
  disabled,
}: {
  readonly table: Table
  readonly base: DescribedBase
  readonly value: ButtonDraft
  readonly onChange: (next: ButtonDraft) => void
  readonly disabled: boolean
}) {
  const [automations, setAutomations] = useState<ReadonlyArray<{
    id: string
    label: string
  }> | null>(null)
  useEffect(() => {
    let current = true
    api
      .automations(base.name)
      .then((list) => {
        if (!current) return
        setAutomations(
          list
            .filter((a) => a.trigger.kind === 'button' && a.trigger.table === table.id)
            .map((a) => ({ id: a.id, label: a.label })),
        )
      })
      .catch(() => current && setAutomations([]))
    return () => {
      current = false
    }
  }, [base.name, table.id])
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Input
        value={value.label}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        placeholder="Libellé du bouton : Relancer"
        aria-label="Libellé du bouton"
        maxLength={60}
        disabled={disabled}
        className="h-8"
      />
      <div className="flex gap-1 rounded-md border p-0.5 text-xs">
        {(['url', 'automation'] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={value.action === a}
            onClick={() => onChange({ ...value, action: a })}
            className={cn(
              'flex-1 rounded px-2 py-1',
              value.action === a ? 'bg-secondary font-medium' : 'text-muted-foreground',
            )}
          >
            {a === 'url' ? 'Ouvrir une adresse' : 'Lancer une automatisation'}
          </button>
        ))}
      </div>
      {value.action === 'url' ? (
        <>
          <Input
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            aria-label="Adresse du bouton"
            disabled={disabled}
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Citez la ligne avec {'{{champ}}'} : https://exemple.fr/devis/{'{{numero}}'}
          </p>
        </>
      ) : automations !== null && automations.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucune automatisation de cette table n’est déclenchée par un bouton. Créez-en une dans «
          Automatisations », puis revenez.
        </p>
      ) : (
        <select
          value={value.automation}
          onChange={(e) => onChange({ ...value, automation: e.target.value })}
          aria-label="Automatisation du bouton"
          disabled={disabled || automations === null}
          className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">Choisir une automatisation</option>
          {automations?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
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
  /** Resolves to the refusal to show, or `null` once the field is created. */
  readonly onSubmit: (draft: Draft) => Promise<string | null>
}) {
  const [label, setLabel] = useState('')
  // A preset is a type, or a type with a format: `number:currency` is a « Monnaie ».
  const [preset, setPreset] = useState<string>('short_text')
  const [format, setFormat] = useState<FormatInput | null>(null)
  const kind =
    preset === 'link' ? 'link' : (PRESETS.find((p) => p.value === preset)?.kind ?? preset)
  const [target, setTarget] = useState('')
  const [multiple, setMultiple] = useState(false)
  const [expression, setExpression] = useState('')
  const [rollup, setRollup] = useState<RollupDraft>(emptyRollup)
  const [button, setButton] = useState<ButtonDraft>(emptyButton)
  const [choices, setChoices] = useState<OptionDraft[]>(() => [emptyDraft()])
  const [description, setDescription] = useState('')
  const [ai, setAi] = useState<AiDraft>(emptyAiDraft)
  const [aiOn, setAiOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targets = base.tables.filter((t) => t.name !== table.name)
  // The relations a lookup, a rollup or a count may follow: this table's, and those aiming here.
  const paths = pathsOf(table, base.tables)
  const readsThrough = kind === 'lookup' || kind === 'rollup' || kind === 'count'
  // The switch only holds for the types that take the option.
  const withAi = aiOn && acceptsAi(kind)
  const parsed = optionsOf(choices)
  const columns = citable(table)

  const ready =
    label.trim() !== '' &&
    (kind !== 'link' || target !== '') &&
    (!hasChoices(kind) || parsed.length > 0) &&
    (kind !== 'formula' || expression.trim() !== '') &&
    (!readsThrough || rollupReady(kind, rollup)) &&
    (kind !== 'button' ||
      (button.label.trim() !== '' &&
        (button.action === 'url' ? button.url.trim().length > 8 : button.automation !== ''))) &&
    (!withAi || aiReady(ai, columns)) &&
    !isTooLong(description) &&
    !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    const refusal = await onSubmit({
      label,
      kind,
      description: description.trim() === '' ? undefined : description.trim(),
      target: kind === 'link' ? target : undefined,
      multiple: kind === 'link' ? multiple : undefined,
      options: hasChoices(kind) ? parsed : undefined,
      ai: withAi ? aiInputOf(ai) : undefined,
      format: format ?? undefined,
      formula: kind === 'formula' ? { expression } : undefined,
      rollup: readsThrough ? rollupInputOf(kind, rollup, paths) : undefined,
      button: kind === 'button' ? { ...button, label: button.label.trim() } : undefined,
    })
    setBusy(false)
    if (refusal !== null) {
      setError(refusal)
      return
    }
    setLabel('')
    setChoices([emptyDraft()])
    setTarget('')
    setMultiple(false)
    setExpression('')
    setRollup(emptyRollup())
    setButton(emptyButton())
    setDescription('')
    setAi(emptyAiDraft())
    setAiOn(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || busy) return
        setError(null)
        onClose()
      }}
    >
      <DialogContent
        className={cn('max-h-[90vh] overflow-y-auto', withAi ? 'sm:max-w-2xl' : 'sm:max-w-xl')}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Nouveau champ dans {table.label}</DialogTitle>
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
            <Select
              value={preset}
              onValueChange={(next) => {
                setPreset(next)
                setFormat(PRESETS.find((p) => p.value === next)?.format ?? null)
              }}
            >
              <SelectTrigger id="field-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <FieldIcon kind={p.kind} format={p.format?.display} />
                      {p.label}
                    </span>
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
              <div className="flex items-start gap-2 pt-1.5 text-sm">
                <Checkbox
                  id="field-multiple"
                  checked={multiple}
                  onCheckedChange={(checked) => setMultiple(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="field-multiple" className="cursor-pointer">
                  Plusieurs lignes par enregistrement
                  <span className="block text-xs text-muted-foreground">
                    {multiple
                      ? 'Une liste ordonnée de lignes : une ligne supprimée de la cible est retirée des listes qui la citent.'
                      : 'Une seule ligne liée : une ligne de la cible encore liée ne peut pas être supprimée.'}
                  </span>
                </label>
              </div>
            </div>
          )}

          {hasChoices(kind) && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {kind === 'multi_select' ? 'Choix (plusieurs par ligne)' : 'Choix'}
              </p>
              <OptionsEditor value={choices} onChange={setChoices} />
            </div>
          )}

          {format !== null && <FormatDetails value={format} onChange={setFormat} disabled={busy} />}

          {kind === 'formula' && (
            <FormulaEditor
              value={expression}
              onChange={setExpression}
              fields={table.fields}
              disabled={busy}
            />
          )}

          {kind === 'button' && (
            <ButtonForm
              table={table}
              base={base}
              value={button}
              onChange={setButton}
              disabled={busy}
            />
          )}

          {readsThrough && (
            <RollupForm
              kind={kind as 'lookup' | 'rollup' | 'count'}
              paths={paths}
              value={rollup}
              onChange={setRollup}
              disabled={busy}
            />
          )}

          {KIND_NOTES[kind] !== undefined && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              {KIND_NOTES[kind]}
            </p>
          )}

          {acceptsAi(kind) && <AiToggle checked={aiOn} onChange={setAiOn} disabled={busy} />}

          {withAi && (
            <AiFieldForm value={ai} onChange={setAi} fields={columns} kind={kind} disabled={busy} />
          )}

          <DescriptionField
            id="field-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder="Que contient ce champ ?"
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
          <Button disabled={!ready} onClick={() => void submit()}>
            {busy ? 'Création…' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
