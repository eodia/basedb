'use client'

import { type Row, display } from '@/components/app/data-grid'
import { hasDescription } from '@/components/app/description'
import { FieldIcon } from '@/components/app/field-icon'
import { EnumPicker, LinkPicker, type SearchLink } from '@/components/app/pickers'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Field, LinkOption, ReferencedBlock, Table } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { Calendar, ExternalLink, Link2, Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

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

        <dl className="space-y-3.5 px-5 py-5">
          {fields.map((field) => (
            <div
              key={field.name}
              className="grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-1"
            >
              <dt
                className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
                title={field.label}
              >
                <FieldIcon kind={field.kind} />
                <span className="truncate">{field.label}</span>
              </dt>
              <dd className="min-w-0">
                <PanelField
                  field={field}
                  row={row}
                  options={linkOptions[field.name]}
                  onSearchLink={onSearchLink}
                  onCommit={(value) => onCommit(field, value)}
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
                    Plus de {block.count} lignes : le décompte est plafonné.
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

function PanelField({
  field,
  row,
  options,
  onSearchLink,
  onCommit,
}: {
  readonly field: Field
  readonly row: Row
  readonly options?: readonly LinkOption[]
  readonly onSearchLink: SearchLink
  readonly onCommit: (value: unknown) => Promise<void>
}) {
  const present = Object.hasOwn(row, field.name)
  const value = row[field.name]

  const [typed, setTyped] = useState('')
  useEffect(() => {
    // The same reading as in the grid: `487.5000000000` is what the column holds, and
    // the trailing zeros are noise wherever a person is looking.
    setTyped(value === null || value === undefined ? '' : display(String(value), field))
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
      {(field.kind === 'date' || field.kind === 'datetime') && (
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        value={typed}
        readOnly={field.read_only === true}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={cn(
          field.read_only === true && 'text-muted-foreground',
          (field.kind === 'date' || field.kind === 'datetime') && 'pl-8',
        )}
        aria-label={field.label}
      />
    </div>
  )
}

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
