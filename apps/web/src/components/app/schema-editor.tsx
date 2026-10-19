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
  DefaultValueEditor,
  acceptsDefault,
  defaultReady,
  sameDefault,
} from '@/components/app/default-value'
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
import {
  FORMAT_LABELS,
  FieldIcon,
  KIND_LABELS,
  KindLabel,
  shownFormat,
} from '@/components/app/field-icon'
import { usePhysicalRename } from '@/components/app/lifecycle-dialogs'
import { LookButton, type LookValue, lookOf } from '@/components/app/look-picker'
import { NewTableDialog } from '@/components/app/new-table-dialog'
import { LookIcon, OptionBadge } from '@/components/app/option-badge'
import { OptionsEditor } from '@/components/app/options-editor'
import { SortableFields } from '@/components/app/sortable-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Choice } from '@/components/ui/choice'
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
import { Hint, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type AiFieldInput,
  type AiFieldStatus,
  type AutomationHttpMethod,
  type DescribedBase,
  type Field,
  type FieldDefault,
  type FieldDeletionPreview,
  type FieldOptionInput,
  type Table,
  api,
} from '@/lib/api/client'
import { describeComputed } from '@/lib/computed'
import { CURRENCIES, type FormatInput, PRESETS, formatOf, formatsFor } from '@/lib/format'
import { $t, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { type OptionDraft, draftsOf, emptyDraft, optionsOf } from '@/lib/options'
import { useWorkspace } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import { Check, Key, Link2, Pencil, Plus, Sparkles, Table2, Tag, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

/**
 * The kinds a value of which the database can demand: not a computed one — a formula, a
 * lookup, a button have no value of their own — nor a number the database gives itself.
 */
const acceptsRequired = (kind: string) =>
  !['formula', 'autonumber', 'lookup', 'rollup', 'count', 'button'].includes(kind)

/** The kinds the kernel holds without duplicate (ch. 04 §1.6) — its own list, mirrored. */
const UNIQUE_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'email',
  'url',
  'number',
  'date',
  'datetime',
])

/** The kinds whose values come from a list of choices, edited in the same way. */
const hasChoices = (kind: string | undefined) => kind === 'select' || kind === 'multi_select'

/**
 * The kinds that cannot be a table's display column — the catalog's `can_be_display`
 * says no, so they are not offered rather than refused after a choice.
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
  /**
   * The table to show, asked for from that table's menu in the navigation. Each request
   * carries its instant: asking again for the same table, after wandering off, brings it
   * back.
   */
  readonly focus?: { readonly table: string; readonly at: number } | null
  /** The table now shown, for the address bar to name it. */
  readonly onShown?: (table: string | null) => void
}

const NOTHING: ReadonlySet<string> = new Set()

export function SchemaEditor({
  base,
  onChanged,
  administers = false,
  buildable = NOTHING,
  focus = null,
  onShown,
}: Props) {
  const [openTable, setOpenTable] = useState<string | null>(
    focus?.table ?? base.tables[0]?.name ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [naming, setNaming] = useState(false)
  const [deleting, setDeleting] = useState<Table | null>(null)
  const [renaming, setRenaming] = useState<Table | null>(null)
  const [editing, setEditing] = useState<Field | null>(null)
  const [removing, setRemoving] = useState<Field | null>(null)

  const table = base.tables.find((t) => t.name === openTable) ?? base.tables[0] ?? null

  // Said upward each time it changes — through a ref: the caller's function is a new one at
  // every render, and the table is what moves the address, not the render.
  const shown = useRef(onShown)
  shown.current = onShown
  const shownName = table?.name ?? null
  useEffect(() => shown.current?.(shownName), [shownName])

  // A new request from the navigation wins over the table chosen here since.
  useEffect(() => {
    if (focus !== null) setOpenTable(focus.table)
  }, [focus])

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
        <h1 className="text-xl font-semibold tracking-tight">
          {$t('Tables et champs de {label}', { label: base.label })}
        </h1>
        {!buildsBase && !builds && (
          <p className="mt-1 text-sm text-muted-foreground">
            {$t('Consultation seule : modifier la structure demande l’accès « Gestion ».')}
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
              {$t('Nouvelle table')}
            </Button>
          )}
        </div>

        {/* Fields */}
        {table !== null && (
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3">
              <TableHeading
                key={`heading:${table.name}`}
                table={table}
                busy={busy}
                builds={builds}
                onSaved={async (label) => {
                  if (label !== undefined) relabelTabs(table, label)
                  await onChanged()
                }}
              />
              {builds && (
                <Button size="sm" onClick={() => setAdding(true)} disabled={busy}>
                  <Plus className="size-4" />
                  {$t('Champ')}
                </Button>
              )}
              {/* The name in the database is the administration's (chapter 06 §2): the one
                  thing of the table that still needs a dialog, for what it touches. */}
              {builds && administers && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRenaming(table)}
                  disabled={busy}
                >
                  <Pencil className="size-4" />
                  {$t('Nom en base…')}
                </Button>
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
                  {$t('Supprimer')}
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

            <RowTitle
              table={table}
              busy={busy}
              builds={builds}
              onChange={(name) => void run(() => api.setDisplayColumn(table, name))}
            />

            <div key={table.name} className="overflow-hidden rounded-xl border">
              <SortableFields
                table={table}
                // Where the eye lands after the last field: adding the next one, right there.
                after={
                  builds ? (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      disabled={busy}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50',
                        table.fields.some((f) => f.system !== true) && 'border-t',
                      )}
                    >
                      <Plus className="size-4" />
                      {$t('Ajouter un champ')}
                    </button>
                  ) : undefined
                }
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
                    onEdit={() => setEditing(field)}
                    onDelete={() => setRemoving(field)}
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
                    // A webhook is an automation of one step, made here and named after
                    // the button: its runs, its retries, its headers are the automations'.
                    const hook =
                      field.button?.action === 'webhook'
                        ? await api.createAutomation(base.name, {
                            label: $t('Bouton « {label} » de {table}', {
                              label: field.label,
                              table: table.label,
                            }),
                            enabled: true,
                            trigger: { kind: 'button', table: table.id },
                            actions: [
                              {
                                kind: 'webhook',
                                url: field.button.webhookUrl.trim(),
                                method: field.button.webhookMethod,
                              },
                            ],
                          })
                        : null
                    try {
                      await api.addField(table, {
                        label: field.label,
                        kind: field.kind,
                        rich: field.rich,
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
                                action: field.button.action === 'url' ? 'url' : 'automation',
                                ...(field.button.action === 'url'
                                  ? { url: field.button.url }
                                  : { automation: hook?.id ?? field.button.automation }),
                              },
                      })
                    } catch (e) {
                      // The field refused, its automation goes too: nothing left half-made.
                      if (hook !== null)
                        await api.deleteAutomation(base.name, hook.id).catch(() => {})
                      throw e
                    }
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
              administers={administers}
              onClose={() => setEditing(null)}
              onSaved={onChanged}
            />

            <DeleteFieldDialog
              field={removing}
              table={table}
              onClose={() => setRemoving(null)}
              onDeleted={async () => {
                setRemoving(null)
                await onChanged()
              }}
            />

            <EditTableDialog
              table={renaming}
              administers={administers}
              onClose={() => setRenaming(null)}
              onRenamed={async (change) => {
                // Tabs carry the old name, and would only fail to load it: they close.
                // This screen follows the table under its new name.
                const renamed = renaming
                if (renamed !== null) useWorkspace.getState().dropTable(renamed.base, change.from)
                if (openTable === change.from || openTable === null) setOpenTable(change.to)
                await onChanged()
              }}
              onSaved={async (label) => {
                if (renaming !== null) relabelTabs(renaming, label)
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
        onSubmit={async (label, description, look) => {
          await run(async () => {
            const created = await api.createTableIn(base.name, label, description, look)
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

/** The tabs open on a table carry the label they were opened with: they follow a new one. */
function relabelTabs(table: Table, label: string) {
  const { tabs, rename } = useWorkspace.getState()
  for (const tab of tabs) {
    if (tab.kind === 'table' && tab.base === table.base && tab.table === table.name) {
      rename(tab.id, label)
    }
  }
}

/**
 * The open table's name and look, changed where they are read — what « Modifier la table »
 * used to ask for in a dialog. Both are catalog writes that touch no row: the look is saved
 * as soon as it is picked, the label on Entrée or when the box is left, Échap giving it up.
 */
function TableHeading({
  table,
  busy,
  builds,
  onSaved,
}: {
  readonly table: Table
  readonly busy: boolean
  readonly builds: boolean
  /** Called once saved, with the new label when it changed. */
  readonly onSaved: (label?: string) => Promise<void>
}) {
  const [look, setLook] = useState<LookValue>(() => lookOf(table))
  const [label, setLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setLook(lookOf(table)), [table])

  const save = async (patch: { label?: string } & Partial<LookValue>) => {
    setSaving(true)
    setError(null)
    try {
      await api.updateTable(table, patch)
      setLabel(null)
      await onSaved(patch.label)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setSaving(false)
    }
  }

  const commit = () => {
    if (label === null) return
    const next = label.trim()
    if (next === '' || next === table.label) setLabel(null)
    else void save({ label: next })
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {builds ? (
        <LookButton
          look={look}
          label={$t('Apparence de la table {label}', { label: table.label })}
          onChange={(patch) => {
            // The look is one value: what was picked a moment ago is sent with this choice.
            const next = { ...look, ...patch }
            setLook(next)
            void save(next)
          }}
          disabled={busy || saving}
          className="size-9"
        />
      ) : (
        <LookIcon look={table} fallback={Table2} className="size-5 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        {label !== null ? (
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                e.preventDefault()
                setLabel(null)
              }
            }}
            aria-label={$t('Libellé de la table')}
            disabled={saving}
            autoFocus
            className="h-8 max-w-sm text-base font-semibold"
          />
        ) : builds ? (
          <Hint label={$t('Renommer la table')}>
            <button
              type="button"
              onClick={() => setLabel(table.label)}
              disabled={busy || saving}
              className="group/title flex max-w-full items-center gap-1.5 rounded-md text-left"
            >
              <h2 className="truncate text-base font-semibold">{table.label}</h2>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100 [@media(hover:none)]:opacity-100" />
            </button>
          </Hint>
        ) : (
          <h2 className="truncate text-base font-semibold">{table.label}</h2>
        )}
        <p className="truncate font-mono text-xs text-muted-foreground">{table.name}</p>
        {error !== null && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
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
  const subject = $t('la table {label}', { label: table.label })
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
          placeholder={$t('À quoi sert cette table ?')}
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
 * What names a row of the table — the catalog's display column (chapter 04 §5).
 *
 * A setting of the TABLE, so it is chosen at the table's level, in words, with what it is
 * for: a star on one field row said neither. Only the kinds the catalog accepts are
 * offered, and « Aucun » is a valid answer (A15) — the rows are then named by their number.
 */
function RowTitle({
  table,
  busy,
  builds,
  onChange,
}: {
  readonly table: Table
  readonly busy: boolean
  readonly builds: boolean
  readonly onChange: (name: string | null) => void
}) {
  const current = table.fields.find((f) => f.name === table.display_field) ?? null
  const choices = table.fields.filter((f) => f.system !== true && !NOT_DISPLAYABLE.has(f.kind))

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Tag className="size-4 text-muted-foreground" />
          {$t('Titre des lignes')}
        </span>
        {builds ? (
          <Choice
            value={current?.name ?? ''}
            onValueChange={(name) => onChange(name === '' ? null : name)}
            options={[
              { value: '', label: $t('Aucun') },
              ...choices.map((f) => ({
                value: f.name,
                label: f.label,
                render: (
                  <span className="flex items-center gap-2">
                    <FieldIcon kind={f.kind} format={shownFormat(f)} />
                    {f.label}
                  </span>
                ),
              })),
            ]}
            aria-label={$t('Titre des lignes')}
            disabled={busy}
            className="w-60"
          />
        ) : (
          <span className="text-sm">{current?.label ?? $t('Aucun')}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {$t(
          'Ce qui désigne une ligne de « {table} » ailleurs : dans les relations qui la citent, les recherches et les listes où on la choisit.',
          { table: table.label },
        )}
      </p>
    </div>
  )
}

/** A reader of a field, as the confirmation names it — one whole sentence per kind. */
function userOf(user: FieldDeletionPreview['used_by'][number]): string {
  const label = user.label
  const what =
    user.kind === 'formula'
      ? $t('La formule « {label} »', { label })
      : user.kind === 'lookup'
        ? $t('La recherche « {label} »', { label })
        : user.kind === 'rollup'
          ? $t('Le cumul « {label} »', { label })
          : user.kind === 'count'
            ? $t('Le décompte « {label} »', { label })
            : user.kind === 'ai'
              ? $t('La consigne d’IA du champ « {label} »', { label })
              : user.kind === 'button'
                ? $t('Le bouton « {label} »', { label })
                : $t('La règle de lignes du groupe « {label} »', { label })
  return user.table === null
    ? what
    : $t('{what}, dans la table « {table} »', { what, table: user.table })
}

/**
 * The preview as this screen reads it. An API older than the screen answers without the
 * lists it added since — the saved views were the last — and an absent list is an empty
 * one, not a reason for the dialog to fail.
 */
function completePreview(read: Partial<FieldDeletionPreview>): FieldDeletionPreview {
  return {
    label: read.label ?? '',
    kind: read.kind ?? '',
    is_display: read.is_display ?? false,
    used_by: read.used_by ?? [],
    views: read.views ?? [],
    saved_views: read.saved_views ?? [],
    locked_tables: read.locked_tables ?? [],
    cascade_lost: read.cascade_lost ?? false,
    relegated_name: read.relegated_name ?? null,
  }
}

/**
 * The confirmation for deleting a field — chapter 04 §1.11, chapter 06 §4.1.
 *
 * Like the table's, it asks the server first: what reads the field — a formula, a lookup
 * in another table, a row rule, a view built in SQL — is the server's to know, and a
 * screen that learned it from a refusal after the click would have nothing to say before.
 * Whatever stands in the way is named, with the place to remedy it; nothing is offered
 * while it stands.
 *
 * It also says what deletion is NOT: the values stay, in a renamed column, readable in SQL.
 */
function DeleteFieldDialog({
  field,
  table,
  onClose,
  onDeleted,
}: {
  readonly field: Field | null
  readonly table: Table
  readonly onClose: () => void
  readonly onDeleted: () => Promise<void>
}) {
  const [preview, setPreview] = useState<FieldDeletionPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (field === null) return
    let current = true
    setError(null)
    setPreview(null)
    api
      .fieldDeletionPreview(table, field.name)
      .then((read) => current && setPreview(completePreview(read)))
      .catch((e) => current && setError(messageFor(e)))
    return () => {
      current = false
    }
  }, [field, table])

  const blocked =
    preview !== null &&
    (preview.is_display || preview.used_by.length > 0 || preview.views.length > 0)
  const ready = field !== null && preview !== null && !blocked && !busy

  const submit = async () => {
    if (!ready || field === null) return
    setBusy(true)
    setError(null)
    try {
      const migration = await api.deleteField(table, field.name)
      if (migration.status !== 'applied') {
        setError(
          `${$t('La migration s’est arrêtée à l’étape « {value} » ', {
            value: migration.step_label ?? '?',
          })}(${migration.error_code ?? 'inconnue'}).`,
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
    <Dialog open={field !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {$t('Supprimer le champ « {label} » ?', { label: field?.label })}
          </DialogTitle>
          <DialogDescription>
            {preview === null
              ? $t('Vérification de ce qui lit ce champ…')
              : preview.relegated_name !== null
                ? $t(
                    'Il disparaît de la table, des vues, de l’API et des formulaires. Ses valeurs restent lisibles en SQL, dans la colonne {column}.',
                    { column: preview.relegated_name },
                  )
                : $t(
                    'Il disparaît de la table, des vues, de l’API et des formulaires. C’est un champ calculé : aucune valeur n’est perdue.',
                  )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {preview !== null && blocked && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              {preview.is_display && (
                <p>
                  {$t(
                    'C’est le titre des lignes de « {table} » : choisissez-en un autre au-dessus de la liste des champs.',
                    { table: table.label },
                  )}
                </p>
              )}
              {preview.used_by.length > 0 && (
                <>
                  <p>
                    {$t('D’autres éléments le lisent : modifiez-les ou supprimez-les d’abord.')}
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {preview.used_by.map((u) => (
                      <li key={`${u.kind}:${u.table ?? ''}:${u.label}`}>{userOf(u)}</li>
                    ))}
                  </ul>
                </>
              )}
              {preview.views.length > 0 && (
                <>
                  <p>{$t('Des vues SQL sont construites sur sa colonne :')}</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {preview.views.map((v) => (
                      <li key={`${v.kind}:${v.name}`}>
                        {v.kind === 'alias'
                          ? $t('l’alias de compatibilité {name}', { name: v.name })
                          : v.kind === 'sql_view'
                            ? $t('la vue SQL « {name} »', { name: v.name })
                            : $t('{name}, créée hors de basedb', { name: v.name })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {preview !== null && !blocked && preview.saved_views.length > 0 && (
            <div className="space-y-1 text-muted-foreground">
              <p>{$t('Des vues enregistrées s’en servent :')}</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {preview.saved_views.map((v) => (
                  <li key={v.label}>
                    {v.loses === 'pivot'
                      ? $t(
                          '« {label} » se range sur ce champ : elle restera vide jusqu’à ce que vous en choisissiez un autre.',
                          { label: v.label },
                        )
                      : v.loses === 'filter'
                        ? $t(
                            '« {label} » le filtre : elle sera masquée jusqu’à ce que son filtre soit corrigé.',
                            { label: v.label },
                          )
                        : $t(
                            '« {label} » s’en sert pour un réglage (couleur, titre, image…), qui sera retiré.',
                            { label: v.label },
                          )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview !== null && !blocked && preview.cascade_lost && (
            <p className="text-muted-foreground">
              {$t(
                'Supprimer une ligne liée n’emportera plus les lignes de « {table} » qui la citent.',
                { table: table.label },
              )}
            </p>
          )}

          {preview !== null && !blocked && preview.locked_tables.length > 0 && (
            <p className="text-muted-foreground">
              {$t('Tables verrouillées brièvement : {locked_tables}.', {
                locked_tables: preview.locked_tables.join(', '),
              })}
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
            {$t('Annuler')}
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={!ready}>
            {busy ? $t('Suppression…') : $t('Supprimer le champ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          `${$t('La migration s’est arrêtée à l’étape « {value} » ', {
            value: migration.step_label ?? '?',
          })}(${migration.error_code ?? 'inconnue'}).`,
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
          <DialogTitle>
            {$t('Supprimer la table « {label} » ?', { label: table?.label })}
          </DialogTitle>
          <DialogDescription>
            {preview?.row_count != null && preview.row_count > 0
              ? $t('Ses données (environ {row_count} lignes) restent lisibles en SQL.', {
                  row_count: preview.row_count.toLocaleString(intlLocale()),
                })
              : $t('Ses données restent lisibles en SQL.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {blocked && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              {$t(
                'Retirez d’abord les relations qui pointent vers cette table : {referenced_by}.',
                { referenced_by: preview?.referenced_by.join(', ') },
              )}
            </p>
          )}

          {!blocked && (preview?.locked_tables.length ?? 0) > 0 && (
            <p className="text-muted-foreground">
              {$t('Tables verrouillées brièvement : {locked_tables}.', {
                locked_tables: preview?.locked_tables.join(', '),
              })}
            </p>
          )}

          {!blocked && (
            <div className="space-y-1.5">
              <label htmlFor="confirm-table" className="text-sm text-muted-foreground">
                {$t('Saisissez')}{' '}
                <span className="font-medium text-foreground">{table?.label}</span>{' '}
                {$t('pour confirmer')}
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
            {$t('Annuler')}
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={!ready}>
            {busy ? $t('Suppression…') : $t('Supprimer la table')}
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
  onEdit,
  onDelete,
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
  readonly onEdit: () => void
  readonly onDelete: () => void
  /** Renaming the COLUMN — administration only, and without an alias (chapter 06 §3.1). */
  readonly onDescription: (next: string | null) => Promise<void>
}) {
  const isDisplay = table.display_field === field.name

  // A system column carries a description of the server's own, shown and never edited.
  const editable = builds && field.system !== true
  const subject = $t('le champ {label}', { label: field.label })
  const edit = useDescriptionEdit(field.description, onDescription)
  const described = hasDescription(field.description)

  return (
    <div className={cn('group/row flex items-center gap-3 px-3 py-2.5', !first && 'border-t')}>
      {handle}
      <FieldIcon kind={field.kind} format={shownFormat(field)} className="size-4" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{field.label}</span>
          {/* Said where the field is read, in words: what names a row of the table. */}
          {isDisplay && (
            <Hint label={$t('Le titre des lignes : c’est lui qu’on lit dans les relations')}>
              <Badge variant="outline" className="gap-1 border-primary/40 font-normal text-primary">
                <Tag className="size-3" />
                {$t('Titre||titre des lignes d’une table')}
              </Badge>
            </Hint>
          )}
          {field.link?.target !== undefined && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Link2 className="size-3" />
              {field.link.target}
            </Badge>
          )}
          {field.link?.masked === true && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {$t('cible non visible')}
            </Badge>
          )}
          {/* The rules of the column, said and not switched here: they are changed in the
              field's dialog, where what a refusal names can be read. */}
          {field.system === true && (
            <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
              <Key className="size-3" />
              {$t('système')}
            </Badge>
          )}
          {field.required === true && field.system !== true && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {$t('Obligatoire')}
            </Badge>
          )}
          {field.unique === true && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {$t('Sans doublon')}
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
              placeholder={$t('Que contient ce champ ?')}
            />
          </div>
        ) : (
          described && (
            <div className="mt-1">
              <DescriptionText
                text={
                  // The server describes its system columns in French: fixed sentences,
                  // translated like the interface's own (as the grid does).
                  field.system === true && typeof field.description === 'string'
                    ? $t(field.description)
                    : field.description
                }
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
        {FORMAT_LABELS[shownFormat(field) ?? ''] ?? KIND_LABELS[field.kind] ?? field.kind}
        {/* The AI is an option of the type, said where the type is. */}
        {field.ai === true && (
          <Hint label={$t('Rempli par l’IA')}>
            <span className="inline-flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400">
              <Sparkles className="size-3" />
              {$t('IA')}
            </span>
          </Hint>
        )}
      </span>

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
              aria-label={$t('Modifier le champ {label}', { label: field.label })}
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {$t('Modifier le libellé{value}{value2}', {
              value: hasChoices(field.kind) ? $t(' et les choix') : '',
              value2: field.ai === true ? $t(' et la consigne de l’IA') : '',
            })}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="size-8 shrink-0" />
      )}

      {/* Deleting: the title of the rows is refused by the server (A15), so it is said here
          rather than offered and refused — the remedy is one choice above the list. */}
      {editable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy || isDisplay}
                onClick={onDelete}
                aria-label={$t('Supprimer le champ {label}', { label: field.label })}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {isDisplay
              ? $t('C’est le titre des lignes : choisissez-en un autre avant de le supprimer.')
              : $t('Supprimer le champ')}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="size-8 shrink-0" />
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
  administers,
  onClose,
  onSaved,
}: {
  readonly field: Field | null
  readonly table: Table
  /** The base's tables: what a lookup or a rollup reads through is named from them. */
  readonly tables: readonly Table[]
  /** The administration role: the column may be renamed in the database too. */
  readonly administers: boolean
  readonly onClose: () => void
  readonly onSaved: () => Promise<void>
}) {
  const [label, setLabel] = useState('')
  // A system column has no name of its own to change (chapter 06 §2.6).
  const physical = usePhysicalRename({
    target:
      field === null || field.system === true
        ? null
        : {
            kind: 'field',
            base: table.base,
            table: table.name,
            field: field.name,
            label: field.label,
          },
    current: field?.name ?? '',
    label,
    administers: administers && field?.system !== true,
  })
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
  // What a row created without the field takes (ch. 04 §1.5).
  const [byDefault, setByDefault] = useState<FieldDefault | null>(null)
  // The rules of the column: an obligation, no duplicate.
  const [required, setRequired] = useState(false)
  const [unique, setUnique] = useState(false)

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
    setByDefault(field.default ?? null)
    setRequired(field.required === true)
    setUnique(field.unique === true)
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
  const takesDefault = field !== null && acceptsDefault(field) && !aiOn
  const takesRequired = field !== null && acceptsRequired(field.kind) && !aiOn
  const takesUnique = field !== null && UNIQUE_KINDS.has(field.kind) && !aiOn
  const requiredChanged = takesRequired && field !== null && required !== (field.required === true)
  const uniqueChanged = takesUnique && field !== null && unique !== (field.unique === true)
  const defaultChanged =
    takesDefault && field !== null && !sameDefault(byDefault, field.default ?? null)
  const ready =
    field !== null &&
    label.trim() !== '' &&
    (!isSelect || next.length > 0) &&
    (!aiChanged || (ai !== null && aiReady(ai, columns))) &&
    (!defaultChanged || defaultReady(byDefault)) &&
    (labelChanged ||
      optionsChanged ||
      aiChanged ||
      aiRemoved ||
      formatChanged ||
      formulaChanged ||
      defaultChanged ||
      requiredChanged ||
      uniqueChanged ||
      physical.asked) &&
    physical.ready &&
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
      // After the choices: a default may name one just added.
      if (defaultChanged) {
        await api.setFieldDefault(table, field.name, byDefault)
        await onSaved()
      }
      if (formatChanged && format !== null) {
        await api.setFieldFormat(table, field.name, format)
        await onSaved()
      }
      // The rules last among the catalog's: each may be refused for the rows as they are —
      // an empty one, a value in double — and says which.
      if (uniqueChanged) {
        await api.setFieldUnique(table, field.name, unique)
        await onSaved()
      }
      if (requiredChanged) {
        await api.setFieldRequired(table, field.name, required)
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
      // Last: the column's name is what every step above addressed it by.
      if ((await physical.run()) !== null) await onSaved()
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
          <DialogTitle>{$t('Modifier {label}', { label: field?.label })}</DialogTitle>
          <DialogDescription asChild>
            <div>
              {field !== null && <KindLabel kind={field.kind} format={field.format?.display} />}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-field-label" className="text-sm text-muted-foreground">
              {$t('Libellé')}
            </label>
            <Input
              id="edit-field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              disabled={busy}
              autoFocus
            />
            {field?.system !== true && physical.element}
          </div>

          {isSelect && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{$t('Choix')}</p>
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
                {$t('Affichage')}
              </label>
              <Choice
                id="edit-field-format"
                value={format.display}
                onValueChange={(display) =>
                  setFormat({
                    display,
                    currency: display === 'currency' ? (format.currency ?? 'EUR') : undefined,
                    rating_max: display === 'rating' ? (format.rating_max ?? 5) : undefined,
                  })
                }
                options={formats.map(([value, name]) => ({
                  value,
                  label: name,
                  render: (
                    <span className="flex items-center gap-2">
                      <FieldIcon kind={field?.kind ?? ''} format={value} />
                      {name}
                    </span>
                  ),
                }))}
                aria-label={$t('Format d’affichage')}
                disabled={busy}
                size="default"
              />
              <p className="text-xs text-muted-foreground">
                {$t('Seule la lecture change : les valeurs enregistrées restent les mêmes.')}
              </p>
            </div>
          )}

          {formats.length > 0 && format !== null && (
            <FormatDetails value={format} onChange={setFormat} disabled={busy} />
          )}

          {takesDefault && field !== null && (
            <DefaultValueEditor
              field={{
                ...field,
                // The choices as they are being edited: a default may pick a new one.
                ...(isSelect
                  ? {
                      options: next.map((o) => ({
                        value: o.value,
                        label: o.label ?? o.value,
                        color: o.color ?? null,
                        icon: o.icon ?? null,
                        image: o.image ?? null,
                      })),
                    }
                  : {}),
              }}
              value={byDefault}
              onChange={setByDefault}
              disabled={busy}
            />
          )}

          {(takesRequired || takesUnique) && (
            <fieldset className="space-y-2.5">
              <legend className="mb-1.5 text-sm text-muted-foreground">{$t('Règles')}</legend>
              {takesRequired && (
                <div className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id="field-required"
                    checked={required}
                    onCheckedChange={(checked) => setRequired(checked === true)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <label htmlFor="field-required" className="cursor-pointer">
                    {$t('Obligatoire')}
                    <span className="block text-xs text-muted-foreground">
                      {$t(
                        'Chaque ligne doit le remplir. Refusé tant qu’une ligne existante est vide.',
                      )}
                    </span>
                  </label>
                </div>
              )}
              {takesUnique && (
                <div className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id="field-unique"
                    checked={unique}
                    onCheckedChange={(checked) => setUnique(checked === true)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <label htmlFor="field-unique" className="cursor-pointer">
                    {$t('Pas de doublon')}
                    <span className="block text-xs text-muted-foreground">
                      {$t(
                        'Deux lignes ne peuvent pas avoir la même valeur, même écrite en SQL. Les lignes vides restent permises ; « Dupont » et « dupont » sont deux valeurs.',
                      )}
                    </span>
                  </label>
                </div>
              )}
            </fieldset>
          )}

          {field !== null && acceptsAi(field.kind) && field.unsafe_html !== true && (
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
              {$t(
                'Le champ redeviendra un champ ordinaire : ses valeurs restent, et chacun pourra les modifier.',
              )}
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
                  {$t('Tout recalculer maintenant')}
                </Button>
                {swept && (
                  <span className="text-xs text-muted-foreground">
                    {$t('Demandé : les lignes sont recalculées en arrière-plan.')}
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
                {$t('Recalculer aussi les lignes déjà remplies')}
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
            {$t('Annuler')}
          </Button>
          <Button disabled={!ready} onClick={() => void save()}>
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
  /** A long text that holds HTML (chapter 04 §2.2). */
  readonly rich?: boolean
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
          {$t('Devise')}
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
          {$t('Nombre d’étoiles')}
        </label>
        <Choice
          id="field-rating-max"
          value={String(value.rating_max ?? 5)}
          onValueChange={(n) => onChange({ ...value, rating_max: Number(n) })}
          options={RATING_MAXES.map((n) => ({ value: String(n), label: String(n) }))}
          aria-label={$t('Nombre d’étoiles')}
          disabled={disabled}
          size="default"
        />
      </div>
    )
  }
  return null
}

/** What a type means for the rows, said before one creates it. */
const KIND_NOTES: Readonly<Record<string, string>> = {
  file: $t(
    'Des fichiers de tout type, jusqu’à 20 par ligne. Ils s’ouvrent dans le navigateur quand c’est sûr (PDF, images), sinon se téléchargent.',
  ),
  image: $t(
    'Des images PNG, JPEG, GIF, WebP ou AVIF, jusqu’à 20 par ligne. Le type est vérifié sur le contenu, pas sur le nom.',
  ),
  autonumber: $t(
    'Un numéro donné à chaque ligne à sa création, dans l’ordre, lignes existantes comprises. Personne ne le saisit ni ne le modifie.',
  ),
  user: $t(
    'Une personne de l’espace de travail. Une personne dont le compte est désactivé reste affichée sur ses lignes, mais n’est plus proposée.',
  ),
  email: $t('Une adresse vérifiée à l’écriture, qui s’ouvre dans la messagerie en un clic.'),
  button: $t(
    'Un bouton dans chaque ligne, sans valeur : il ouvre une adresse composée avec la ligne, appelle un webhook avec la ligne, ou lance une automatisation de la base déclenchée par un bouton.',
  ),
}

interface ButtonDraft {
  readonly label: string
  /** `webhook`: an automation of one webhook step, created with the button. */
  readonly action: 'url' | 'automation' | 'webhook'
  readonly url: string
  readonly automation: string
  readonly webhookUrl: string
  readonly webhookMethod: AutomationHttpMethod
}

/** The methods a webhook step accepts, POST first: what a button sends most often. */
const HTTP_METHODS: readonly AutomationHttpMethod[] = ['POST', 'PUT', 'PATCH', 'GET', 'DELETE']

const emptyButton = (): ButtonDraft => ({
  label: '',
  action: 'url',
  url: 'https://',
  automation: '',
  webhookUrl: 'https://',
  webhookMethod: 'POST',
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
        placeholder={$t('Libellé du bouton : Relancer')}
        aria-label={$t('Libellé du bouton')}
        maxLength={60}
        disabled={disabled}
        className="h-8"
      />
      <div className="flex gap-1 rounded-md border p-0.5 text-xs">
        {(['url', 'webhook', 'automation'] as const).map((a) => (
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
            {a === 'url'
              ? $t('Ouvrir une adresse')
              : a === 'webhook'
                ? $t('Appeler un webhook')
                : $t('Lancer une automatisation')}
          </button>
        ))}
      </div>
      {value.action === 'url' ? (
        <>
          <Input
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            aria-label={$t('Adresse du bouton')}
            disabled={disabled}
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Citez la ligne avec {'{{champ}}'} : https://exemple.fr/devis/{'{{numero}}'}
          </p>
        </>
      ) : value.action === 'webhook' ? (
        <>
          <div className="flex gap-2">
            <Choice
              value={value.webhookMethod}
              onValueChange={(method) =>
                onChange({ ...value, webhookMethod: method as AutomationHttpMethod })
              }
              options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
              aria-label={$t('Méthode du webhook')}
              disabled={disabled}
              className="w-28 shrink-0"
            />
            <Input
              value={value.webhookUrl}
              onChange={(e) => onChange({ ...value, webhookUrl: e.target.value })}
              aria-label={$t('Adresse du webhook')}
              disabled={disabled}
              className="h-8 font-mono text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {$t(
              'Chaque clic envoie la ligne en JSON à cette adresse. Une automatisation est créée pour l’appeler : ses exécutions, ses en-têtes et son corps se règlent dans « Automatisations ».',
            )}
          </p>
        </>
      ) : automations !== null && automations.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {$t(
            'Aucune automatisation de cette table n’est déclenchée par un bouton. Créez-en une dans « Automatisations », puis revenez.',
          )}
        </p>
      ) : (
        <Choice
          value={value.automation === '' ? null : value.automation}
          onValueChange={(automation) => onChange({ ...value, automation })}
          options={(automations ?? []).map((a) => ({ value: a.id, label: a.label }))}
          placeholder={$t('Choisir une automatisation')}
          aria-label={$t('Automatisation du bouton')}
          disabled={disabled || automations === null}
        />
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
  // The rich variant of a long text: HTML, and no AI — a model writes plain text.
  const rich = PRESETS.find((p) => p.value === preset)?.rich === true
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
  const withAi = aiOn && acceptsAi(kind) && !rich
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
        (button.action === 'url'
          ? button.url.trim().length > 8
          : button.action === 'webhook'
            ? button.webhookUrl.trim().length > 8
            : button.automation !== ''))) &&
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
      rich: rich ? true : undefined,
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
          <DialogTitle>{$t('Nouveau champ dans {label}', { label: table.label })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="field-label" className="text-sm text-muted-foreground">
              {$t('Libellé')}
            </label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={$t('Ville')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="field-kind" className="text-sm text-muted-foreground">
              {$t('Type')}
            </label>
            <Choice
              id="field-kind"
              value={preset}
              onValueChange={(next) => {
                setPreset(next)
                setFormat(PRESETS.find((p) => p.value === next)?.format ?? null)
              }}
              options={[
                ...PRESETS.map((p) => ({
                  value: p.value,
                  label: p.label,
                  render: (
                    <span className="flex items-center gap-2">
                      <FieldIcon
                        kind={p.kind}
                        format={p.rich === true ? 'html' : p.format?.display}
                      />
                      {p.label}
                    </span>
                  ),
                })),
                ...(targets.length > 0
                  ? [
                      {
                        value: 'link',
                        label: KIND_LABELS.link ?? $t('Lien'),
                        render: <KindLabel kind="link" />,
                      },
                    ]
                  : []),
              ]}
              aria-label={$t('Type du champ')}
              size="default"
            />
          </div>

          {kind === 'link' && (
            <div className="space-y-1.5">
              <label htmlFor="field-target" className="text-sm text-muted-foreground">
                {$t('Table cible')}
              </label>
              <Choice
                id="field-target"
                value={target === '' ? null : target}
                onValueChange={setTarget}
                options={targets.map((t) => ({ value: t.name, label: t.label }))}
                placeholder={$t('Choisir une table')}
                aria-label={$t('Table liée')}
                size="default"
              />
              <div className="flex items-start gap-2 pt-1.5 text-sm">
                <Checkbox
                  id="field-multiple"
                  checked={multiple}
                  onCheckedChange={(checked) => setMultiple(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="field-multiple" className="cursor-pointer">
                  {$t('Plusieurs lignes par enregistrement')}
                  <span className="block text-xs text-muted-foreground">
                    {multiple
                      ? $t(
                          'Une liste ordonnée de lignes : une ligne supprimée de la cible est retirée des listes qui la citent.',
                        )
                      : $t(
                          'Une seule ligne liée : une ligne de la cible encore liée ne peut pas être supprimée.',
                        )}
                  </span>
                </label>
              </div>
            </div>
          )}

          {hasChoices(kind) && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {kind === 'multi_select' ? $t('Choix (plusieurs par ligne)') : $t('Choix')}
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

          {acceptsAi(kind) && !rich && (
            <AiToggle checked={aiOn} onChange={setAiOn} disabled={busy} />
          )}

          {withAi && (
            <AiFieldForm value={ai} onChange={setAi} fields={columns} kind={kind} disabled={busy} />
          )}

          <DescriptionField
            id="field-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder={$t('Que contient ce champ ?')}
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
          <Button disabled={!ready} onClick={() => void submit()}>
            {busy ? $t('Création…') : $t('Créer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
