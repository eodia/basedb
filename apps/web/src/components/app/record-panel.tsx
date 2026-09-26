'use client'

import { AiEmpty } from '@/components/app/ai-pending'
import { DateInput } from '@/components/app/date-picker'
import { hasDescription } from '@/components/app/description'
import { FieldIcon } from '@/components/app/field-icon'
import { FilesField, type Upload } from '@/components/app/files'
import { type Row, display } from '@/components/app/grid/cell'
import { HistoryList } from '@/components/app/history'
import { MarkdownEditor, MarkdownView, UrlLink } from '@/components/app/markdown-text'
import {
  ChoiceChips,
  EnumPicker,
  LinkPicker,
  MultiEnumPicker,
  type SearchLink,
  choicesOf,
} from '@/components/app/pickers'
import { ResizablePanel } from '@/components/app/resizable-panel'
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
  api,
  filesOf,
} from '@/lib/api/client'
import { isDateKind, storedFromText } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { ExternalLink, Link2, Maximize2, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

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
  /** Computes an AI field of this row again. Absent for a reader who may not update it. */
  readonly onRecompute?: (field: Field) => Promise<void>
  /** Opens another row — the one a link points at, or one that points here. */
  readonly onFollowLink?: (table: string, id: string) => void
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
  onRecompute,
  onFollowLink,
}: Props) {
  const title = headline(row, fields)
  const subtitle = secondLine(row, fields)
  const total = referenced.reduce((sum, block) => sum + block.count, 0)
  const [tab, setTab] = useState<'details' | 'history'>('details')
  const recordId = String(row._id)
  // The history of THIS row, reloaded whenever the row changes — a commit in the details
  // tab is an entry the next time the history tab is looked at.
  const loadHistory = useCallback(
    (cursor?: string) => api.recordHistory(table, recordId, cursor),
    [table, recordId],
  )

  return (
    <ResizablePanel panel="record" label="la fiche" className="bg-background">
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'details' | 'history')}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details">Détails</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === 'history' && (
          <div className="px-5 py-4">
            <HistoryList
              load={loadHistory}
              showTable={false}
              reloadKey={String(row._updated_at ?? '')}
              empty="Aucune écriture enregistrée pour cette ligne."
            />
          </div>
        )}

        {tab === 'details' && (
          <FieldList
            fields={fields}
            row={row}
            linkOptions={linkOptions}
            onSearchLink={onSearchLink}
            onCommit={onCommit}
            onUpload={onUpload}
            onRecompute={onRecompute}
            onFollowLink={onFollowLink}
          />
        )}

        {tab === 'details' && referenced.length > 0 && (
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
                    <button
                      key={referencing.id}
                      type="button"
                      disabled={onFollowLink === undefined}
                      onClick={() => onFollowLink?.(block.table, referencing.id)}
                      title="Ouvrir la fiche"
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 disabled:hover:bg-transparent',
                        index > 0 && 'border-t',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-primary">
                        {referencing.display ?? referencing.id.slice(0, 8)}
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
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
    </ResizablePanel>
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
  onRecompute,
  onFollowLink,
}: {
  readonly fields: readonly Field[]
  readonly row: Row
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onCommit: (field: Field, value: unknown) => Promise<void>
  readonly onUpload?: Upload
  readonly onRecompute?: (field: Field) => Promise<void>
  readonly onFollowLink?: (table: string, id: string) => void
}) {
  return (
    <dl className="space-y-3.5 px-5 py-5">
      {fields.map((field) => (
        <div
          key={field.name}
          className={cn(
            'grid grid-cols-[130px_1fr] gap-x-3 gap-y-1',
            // A list of files grows downwards: its label stays with the first line.
            isFileField(field) || field.ai === true || field.kind === 'long_text'
              ? 'items-start'
              : 'items-center',
          )}
        >
          <dt
            className={cn(
              'flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground',
              (isFileField(field) || field.ai === true || field.kind === 'long_text') && 'pt-2',
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
              onRecompute={onRecompute === undefined ? undefined : () => onRecompute(field)}
              onFollowLink={onFollowLink}
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
  initial,
}: {
  readonly table: Table
  readonly fields: readonly Field[]
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onUpload?: Upload
  readonly onClose: () => void
  /**
   * Values the row starts with, in the shape a read gives them — the choice of the kanban
   * column it was added to, the day of the calendar that was clicked.
   */
  readonly initial?: Readonly<Record<string, unknown>>
  /** Writes the row; resolves to the refusal to show, or `null` once it is created. */
  readonly onCreate: (values: Record<string, unknown>) => Promise<string | null>
}) {
  // A formula, or a field this reader may not write, has nothing to be filled with.
  const writable = fields.filter((f) => f.read_only !== true && f.system !== true)

  const [draft, setDraft] = useState<Row>(() => ({ ...emptyDraft(writable), ...initial }) as Row)
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
    <ResizablePanel panel="record" label="la fiche" className="bg-background">
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
    </ResizablePanel>
  )
}

/** Every field present and empty: an absent key would read as a MASKED field. */
export function emptyDraft(fields: readonly Field[]): Row {
  const row: Record<string, unknown> = { _id: '' }
  for (const field of fields) row[field.name] = null
  return row as Row
}

/**
 * The draft in the shape a write takes: a link by its identifier, files by theirs, and
 * nothing for what was left empty — the database's defaults and `NOT NULL` decide those.
 */
export function writeValues(fields: readonly Field[], draft: Row): Record<string, unknown> {
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

export function PanelField({
  field,
  row,
  options,
  onSearchLink,
  onCommit,
  onUpload,
  onRecompute,
  onFollowLink,
  live = false,
}: {
  readonly field: Field
  readonly row: Row
  readonly options?: readonly LinkOption[]
  readonly onSearchLink: SearchLink
  readonly onCommit: (value: unknown) => Promise<void>
  readonly onUpload?: Upload
  readonly onRecompute?: () => Promise<void>
  readonly onFollowLink?: (table: string, id: string) => void
  /**
   * In a form: a long text is taken as it is typed, and its editor stays open. Closed on
   * leaving it, it would shrink under the send button being clicked, and the click be lost.
   */
  readonly live?: boolean
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

  if (field.ai === true) {
    return <AiValue field={field} value={value} onRecompute={onRecompute} />
  }

  if (field.kind === 'link') {
    const link = value as { id: string | null; display: string | null } | null
    const target = field.link?.target
    const id = link?.id ?? null
    const follow =
      onFollowLink === undefined || target === undefined || id === null
        ? undefined
        : () => onFollowLink(target, id)
    if (options === undefined) {
      return link?.id == null ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : (
        // Nothing to edit here: the badge itself is the way to the row.
        <button
          type="button"
          onClick={follow}
          disabled={follow === undefined}
          title="Ouvrir la fiche liée"
        >
          <Badge variant="secondary" className="gap-1.5 font-normal hover:bg-secondary/70">
            <Link2 className="size-3" />
            {link.display ?? link.id.slice(0, 8)}
            <ExternalLink className="size-3 text-muted-foreground" />
          </Badge>
        </button>
      )
    }
    return (
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <LinkPicker
            field={field}
            value={link?.id ?? null}
            display={link?.display ?? null}
            options={options}
            onSearch={onSearchLink}
            onChange={(next) => void onCommit(next)}
            appearance="form"
          />
        </div>
        {follow !== undefined && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={follow}
            aria-label="Ouvrir la fiche liée"
            title="Ouvrir la fiche liée"
          >
            <ExternalLink className="size-4" />
          </Button>
        )}
      </div>
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
      <LongTextField
        field={field}
        value={typeof value === 'string' ? value : ''}
        onCommit={(next) => onCommit(next.trim() === '' ? null : next)}
        live={live}
      />
    )
  }

  if (field.kind === 'url') {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={typed}
          readOnly={field.read_only === true}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          inputMode="url"
          placeholder="https://…"
          aria-label={field.label}
        />
        {typeof value === 'string' && value !== '' && (
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label="Ouvrir le lien"
              title={value}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
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

/**
 * A long text: rendered as Markdown, and written in Markdown — a click on the text, or on
 * « Modifier », opens the editor; leaving it saves, as the other fields of the panel do,
 * and Échap puts the text back as it was.
 */
function LongTextField({
  field,
  value,
  onCommit,
  live,
}: {
  readonly field: Field
  readonly value: string
  readonly onCommit: (next: string) => Promise<void>
  readonly live: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const readOnly = field.read_only === true

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const close = (save: boolean) => {
    setEditing(false)
    if (save && draft !== value) void onCommit(draft)
    else setDraft(value)
  }

  if (editing) {
    return (
      <MarkdownEditor
        value={draft}
        onChange={(next) => {
          setDraft(next)
          if (live) void onCommit(next)
        }}
        onSubmit={() => close(true)}
        onCancel={() => close(false)}
        onBlur={live ? undefined : () => close(true)}
        autoFocus
        minHeight={140}
        label={field.label}
      />
    )
  }
  return (
    <div className="group/long relative">
      {value.trim() === '' ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setEditing(true)}
          className="w-full rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/40 disabled:cursor-default"
        >
          {readOnly ? '—' : 'Écrire… (Markdown)'}
        </button>
      ) : (
        <button
          type="button"
          disabled={readOnly}
          onClick={(e) => {
            // A link inside the text opens; anywhere else, the editor does.
            if ((e.target as HTMLElement).closest('a') !== null) return
            setEditing(true)
          }}
          className="block max-h-72 w-full overflow-y-auto rounded-md bg-muted/40 px-3 py-2 text-left hover:bg-muted/60 disabled:cursor-default scroll-discret"
        >
          <MarkdownView source={value} />
        </button>
      )}
    </div>
  )
}

/** A value computed by the AI, shown as its type shows it. */
function AiShown({ field, value }: { readonly field: Field; readonly value: unknown }) {
  if (field.kind === 'select' || field.kind === 'multi_select') {
    return <ChoiceChips field={field} values={choicesOf(value)} wrap />
  }
  if (field.kind === 'url' && typeof value === 'string') return <UrlLink url={value} />
  if (field.kind === 'long_text' && typeof value === 'string')
    return <MarkdownView source={value} />
  const text =
    field.kind === 'boolean' ? (value === true ? 'Oui' : 'Non') : display(String(value), field)
  return <span className="whitespace-pre-line break-words">{text}</span>
}

/**
 * The value of a field computed by the AI: the model's answer, whole, and the way to ask
 * for it again. The cell is never typed into — what it holds is what the prompt produced
 * for this row.
 */
function AiValue({
  field,
  value,
  onRecompute,
}: {
  readonly field: Field
  readonly value: unknown
  readonly onRecompute?: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="space-y-1.5">
      {empty ? (
        <AiEmpty value={value ?? null} appearance="panel" />
      ) : (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed">
          <AiShown field={field} value={value} />
        </div>
      )}
      {onRecompute !== undefined && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 text-xs text-muted-foreground"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onRecompute()
            } finally {
              setBusy(false)
            }
          }}
        >
          <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} />
          {busy ? 'Calcul en cours…' : 'Recalculer'}
        </Button>
      )}
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
