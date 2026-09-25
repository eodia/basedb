'use client'

import { DateInput } from '@/components/app/date-picker'
import { hasDescription } from '@/components/app/description'
import { FieldIcon } from '@/components/app/field-icon'
import { FilesField, type Upload } from '@/components/app/files'
import { type Row, display } from '@/components/app/grid/cell'
import {
  ChoiceChips,
  EnumPicker,
  LinkPicker,
  MultiEnumPicker,
  type SearchLink,
  choicesOf,
} from '@/components/app/pickers'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  type Field,
  type LinkOption,
  type ReferencedBlock,
  type Table,
  filesOf,
} from '@/lib/api/client'
import { isDateKind, storedFromText } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { ExternalLink, Link2, Maximize2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * The detail view — chapter 11 §5.
 *
 * Two things the grid cannot show: a long text with room to breathe, and the rows that
 * REFERENCE this one. The second is the inverse-link summary of chapter 04 §6 — a block
 * whose source table the reader cannot see does not appear at all, not as an empty block
 * and not as a counter.
 */

interface Props {
  readonly table: Table
  readonly row: Row
  readonly fields: readonly Field[]
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly referenced: readonly ReferencedBlock[]
  readonly onClose: () => void
  readonly onCommit: (field: Field, value: unknown) => Promise<void>
  /** Deposits files for a `file` or `image` field, which then commits the list. */
  readonly onUpload?: Upload
}

export function RecordPanel({
  table,
  row,
  fields,
  linkOptions,
  onSearchLink,
  referenced,
  onClose,
  onCommit,
  onUpload,
}: Props) {
  const title = headline(row, fields)
  const subtitle = secondLine(row, fields)
  const total = referenced.reduce((sum, block) => sum + block.count, 0)

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <h2 className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fiche {table.label}
        </h2>
        <Button variant="ghost" size="icon-sm" disabled aria-label="Agrandir">
          <Maximize2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
          <X className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
        <div className="flex items-center gap-3.5 px-5 pt-5">
          <Avatar className="size-12">
            <AvatarFallback className="bg-primary/10 text-sm text-primary">
              {initialsOf(title)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold leading-tight">{title}</h3>
            {subtitle !== null && (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="px-5 pt-4">
          <Tabs defaultValue="details">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details">Détails</TabsTrigger>
              <TabsTrigger value="history" disabled>
                Historique
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <FieldList
          fields={fields}
          row={row}
          linkOptions={linkOptions}
          onSearchLink={onSearchLink}
          onCommit={onCommit}
          onUpload={onUpload}
        />

        {referenced.length > 0 && (
          <div className="border-t px-5 py-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              Éléments liés
              <Badge variant="secondary" className="rounded-full px-1.5 font-normal">
                {total}
              </Badge>
            </h4>

            {referenced.map((block) => (
              <div key={`${block.table}.${block.field}`} className="mb-4 last:mb-0">
                <p className="mb-2 text-sm text-muted-foreground">{block.label}</p>
                <div className="overflow-hidden rounded-lg border">
                  {block.rows.map((referencing, index) => (
                    <div
                      key={referencing.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm',
                        index > 0 && 'border-t',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-primary">
                        {referencing.display ?? referencing.id.slice(0, 8)}
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </div>
                  ))}
                  {block.rows.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Aucune ligne.</p>
                  )}
                </div>
                {block.capped && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Plus de {block.count} lignes.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t px-5 py-3 text-xs text-muted-foreground">
        {modifiedAt(row)}
      </footer>
    </aside>
  )
}

/** A row of the table, label on the left and its editor on the right, for every field given. */
function FieldList({
  fields,
  row,
  linkOptions,
  onSearchLink,
  onCommit,
  onUpload,
}: {
  readonly fields: readonly Field[]
  readonly row: Row
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onCommit: (field: Field, value: unknown) => Promise<void>
  readonly onUpload?: Upload
}) {
  return (
    <dl className="space-y-3.5 px-5 py-5">
      {fields.map((field) => (
        <div
          key={field.name}
          className={cn(
            'grid grid-cols-[130px_1fr] gap-x-3 gap-y-1',
            // A list of files grows downwards: its label stays with the first line.
            isFileField(field) ? 'items-start' : 'items-center',
          )}
        >
          <dt
            className={cn(
              'flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground',
              isFileField(field) && 'pt-2',
            )}
            title={field.label}
          >
            <FieldIcon kind={field.kind} />
            <span className="truncate">{field.label}</span>
            {field.required === true && (
              <span className="text-destructive" title="Obligatoire">
                *
              </span>
            )}
          </dt>
          <dd className="min-w-0">
            <PanelField
              field={field}
              row={row}
              options={linkOptions[field.name]}
              onSearchLink={onSearchLink}
              onCommit={(value) => onCommit(field, value)}
              onUpload={onUpload}
            />
          </dd>
          {/* What the field is for, under the row and across both columns: the label
              column is too narrow to wrap a sentence in. A field with no description
              renders nothing here, so its row is the height it always was. */}
          {hasDescription(field.description) && (
            <dd
              className="col-span-2 line-clamp-3 whitespace-pre-line break-words text-xs leading-snug text-muted-foreground"
              title={field.description}
            >
              {field.description}
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}

/**
 * A record being created — the same panel, filled BEFORE anything is written.
 *
 * Each editor writes into a local draft instead of the API, and "Créer" sends the whole
 * row in one `POST`: a row created empty and then filled field by field would exist,
 * half-made, the moment the first field was typed — and a table with a required field
 * could not take it at all. The draft holds values in the shape a READ gives them, so the
 * editors cannot tell a draft from a row; they are turned into the shape a WRITE takes only
 * when the row is sent.
 *
 * Files are the one thing deposited before the row exists: a deposit changes no row, and
 * the identifiers it returns are what the `POST` cites.
 */
export function NewRecordPanel({
  table,
  fields,
  linkOptions,
  onSearchLink,
  onUpload,
  onClose,
  onCreate,
}: {
  readonly table: Table
  readonly fields: readonly Field[]
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onUpload?: Upload
  readonly onClose: () => void
  /** Writes the row; resolves to the refusal to show, or `null` once it is created. */
  readonly onCreate: (values: Record<string, unknown>) => Promise<string | null>
}) {
  // A formula, or a field this reader may not write, has nothing to be filled with.
  const writable = fields.filter((f) => f.read_only !== true && f.system !== true)

  const [draft, setDraft] = useState<Row>(() => emptyDraft(writable))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The click on "Créer" blurs the text being typed, and that blur is what commits it:
  // the handler reads the draft through a ref so it sees that last commit.
  const latest = useRef(draft)
  latest.current = draft

  const commit = async (field: Field, value: unknown) => {
    // The refusal was about the draft as it was; once it changes, it no longer applies.
    setError(null)
    setDraft((current) => {
      const next = {
        ...current,
        // A link reads as `{ id, display }`; the picker hands back the identifier alone.
        [field.name]:
          field.kind === 'link' && typeof value === 'string' ? { id: value, display: null } : value,
      }
      latest.current = next
      return next
    })
  }

  const create = async () => {
    const values = writeValues(writable, latest.current)
    if (Object.keys(values).length === 0) {
      setError('Renseignez au moins un champ.')
      return
    }
    setBusy(true)
    setError(null)
    const refusal = await onCreate(values)
    setBusy(false)
    if (refusal !== null) setError(refusal)
  }

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <h2 className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nouvelle fiche · {table.label}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
          <X className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-discret">
        <FieldList
          fields={writable}
          row={draft}
          linkOptions={linkOptions}
          onSearchLink={onSearchLink}
          onCommit={commit}
          onUpload={onUpload}
        />
      </div>

      <footer className="shrink-0 space-y-2 border-t px-5 py-3">
        {error !== null && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void create()} disabled={busy}>
            {busy ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </footer>
    </aside>
  )
}

/** Every field present and empty: an absent key would read as a MASKED field. */
function emptyDraft(fields: readonly Field[]): Row {
  const row: Record<string, unknown> = { _id: '' }
  for (const field of fields) row[field.name] = null
  return row as Row
}

/**
 * The draft in the shape a write takes: a link by its identifier, files by theirs, and
 * nothing for what was left empty — the database's defaults and `NOT NULL` decide those.
 */
function writeValues(fields: readonly Field[], draft: Row): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    const value = draft[field.name]
    if (value === null || value === undefined || value === '') continue
    if (field.kind === 'link') {
      const id = (value as { id?: unknown }).id
      if (typeof id === 'string') values[field.name] = id
    } else if (isFileField(field)) {
      const files = filesOf(value)
      if (files.length > 0) values[field.name] = files.map((f) => ({ id: f.id }))
    } else {
      values[field.name] = value
    }
  }
  return values
}

function PanelField({
  field,
  row,
  options,
  onSearchLink,
  onCommit,
  onUpload,
}: {
  readonly field: Field
  readonly row: Row
  readonly options?: readonly LinkOption[]
  readonly onSearchLink: SearchLink
  readonly onCommit: (value: unknown) => Promise<void>
  readonly onUpload?: Upload
}) {
  const present = Object.hasOwn(row, field.name)
  const value = row[field.name]

  const [typed, setTyped] = useState('')
  /** A date already sent and not yet read back: Enter then the blur must not write it twice. */
  const sent = useRef<string | null>(null)
  useEffect(() => {
    // The same reading as in the grid: `487.5000000000` is what the column holds, and
    // the trailing zeros are noise wherever a person is looking.
    setTyped(value === null || value === undefined ? '' : display(String(value), field))
    sent.current = null
  }, [value, field])

  if (!present) {
    return <span className="text-sm text-muted-foreground">Champ masqué</span>
  }

  if (field.kind === 'link') {
    const link = value as { id: string | null; display: string | null } | null
    if (options === undefined) {
      return link?.id == null ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : (
        <Badge variant="secondary" className="gap-1.5 font-normal">
          <Link2 className="size-3" />
          {link.display ?? link.id.slice(0, 8)}
          <ExternalLink className="size-3 text-muted-foreground" />
        </Badge>
      )
    }
    return (
      <LinkPicker
        field={field}
        value={link?.id ?? null}
        display={link?.display ?? null}
        options={options}
        onSearch={onSearchLink}
        onChange={(next) => void onCommit(next)}
        appearance="form"
      />
    )
  }

  if (field.kind === 'select' && field.options !== undefined) {
    return (
      <EnumPicker
        field={field}
        value={typeof value === 'string' && value !== '' ? value : null}
        onChange={(next) => void onCommit(next)}
        appearance="form"
      />
    )
  }

  if (field.kind === 'multi_select') {
    return field.options === undefined || field.read_only === true ? (
      <ChoiceChips field={field} values={choicesOf(value)} wrap />
    ) : (
      <MultiEnumPicker
        field={field}
        value={choicesOf(value)}
        onChange={(next) => void onCommit(next)}
        appearance="form"
      />
    )
  }

  if (field.kind === 'file' || field.kind === 'image') {
    return <FilesField field={field} value={value} onUpload={onUpload} onCommit={onCommit} />
  }

  if (field.kind === 'boolean') {
    return (
      <Checkbox
        checked={value === true}
        disabled={field.read_only === true}
        onCheckedChange={(next) => void onCommit(next === true)}
        aria-label={field.label}
      />
    )
  }

  const commit = () => {
    const initial = value === null || value === undefined ? '' : display(String(value), field)
    if (typed === initial) return
    void onCommit(typed === '' ? null : typed)
  }

  if (isDateKind(field.kind)) {
    const kind = field.kind
    const shown = value === null || value === undefined ? '' : display(String(value), field)
    return (
      <DateInput
        kind={kind}
        text={typed}
        onTextChange={setTyped}
        onCommit={(next) => {
          if (next === shown || next === sent.current) return
          sent.current = next
          void onCommit(storedFromText(next, kind))
        }}
        onCancel={() => setTyped(shown)}
        appearance="form"
        clearable={field.required !== true}
        readOnly={field.read_only === true}
        aria-label={field.label}
      />
    )
  }

  if (field.kind === 'long_text') {
    return (
      <Textarea
        value={typed}
        rows={3}
        readOnly={field.read_only === true}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        aria-label={field.label}
      />
    )
  }

  return (
    <div className="relative">
      <Input
        value={typed}
        readOnly={field.read_only === true}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={cn(field.read_only === true && 'text-muted-foreground')}
        aria-label={field.label}
      />
    </div>
  )
}

const isFileField = (field: Field) => field.kind === 'file' || field.kind === 'image'

/** The row's own name: the display column when there is one, else its identifier. */
function headline(row: Row, fields: readonly Field[]): string {
  const first = fields.find((f) => f.kind === 'short_text' && Object.hasOwn(row, f.name))
  const value = first === undefined ? null : row[first.name]
  return typeof value === 'string' && value.trim() !== '' ? value : row._id.slice(0, 8)
}

/** A second line, when the table offers one that is not the first. */
function secondLine(row: Row, fields: readonly Field[]): string | null {
  const textual = fields.filter((f) => f.kind === 'short_text' && Object.hasOwn(row, f.name))
  const second = textual[1]
  const value = second === undefined ? null : row[second.name]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function initialsOf(title: string): string {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function modifiedAt(row: Row): string {
  const raw = row._updated_at
  if (typeof raw !== 'string') return 'Enregistrement'
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return 'Enregistrement'

  const date = new Date(parsed)
  const sameDay = new Date().toDateString() === date.toDateString()
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return sameDay
    ? `Modifié aujourd’hui à ${time}`
    : `Modifié le ${date.toLocaleDateString('fr-FR')} à ${time}`
}
