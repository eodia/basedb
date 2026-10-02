'use client'

import { RichTextEditor } from '@/components/app/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Choice } from '@/components/ui/choice'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Hint } from '@/components/ui/tooltip'
import type {
  DocumentAlign,
  DocumentBlock,
  DocumentColumnBlock,
  DocumentColumnsBlock,
  DocumentFieldsBlock,
  DocumentRowsBlock,
  Field,
  Table,
} from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  Braces,
  ChevronRight,
  Copy,
  Ellipsis,
  GripVertical,
  Plus,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { BlockPicker, metaOf } from './block-picker'
import { type SegmentOption, Segmented, Setting } from './controls'
import { ImageInput } from './image-input'
import {
  type BlockKind,
  COLUMN_KINDS,
  type RowsChoice,
  imageFields,
  newBlock,
  numeric,
  plainOf,
  shown,
  sourceKey,
} from './model'

/**
 * The blocks of a template, as cards: a handle to drag, the block's name and what it
 * shows, its settings under it once opened. A columns block holds lists of its own, set
 * the same way.
 */

/** What every block's editor needs: the table, the relations, how to change the block. */
interface Context {
  readonly table: Table
  readonly sources: readonly RowsChoice[]
}

const alignOptions = (): SegmentOption<DocumentAlign>[] => [
  {
    value: 'left',
    label: $t('Aligné à gauche'),
    icon: <TextAlignStart className="size-3.5" />,
  },
  { value: 'center', label: $t('Centré'), icon: <TextAlignCenter className="size-3.5" /> },
  { value: 'right', label: $t('Aligné à droite'), icon: <TextAlignEnd className="size-3.5" /> },
]

/** A text may also be justified. */
const textAlignOptions = (): SegmentOption<DocumentAlign | 'justify'>[] => [
  ...alignOptions(),
  { value: 'justify', label: $t('Justifié'), icon: <TextAlignJustify className="size-3.5" /> },
]

/** One line saying what a block shows, for its card while it is closed. */
export function summaryOf(block: DocumentBlock, ctx: Context): string {
  switch (block.kind) {
    case 'text': {
      const text = plainOf(block.html)
      return text === '' ? $t('Texte vide') : text
    }
    case 'title':
      return block.text === '' ? $t('Sans titre') : block.text
    case 'fields':
      return block.fields.length === 0
        ? $t('Tous les champs que le lecteur peut lire')
        : block.fields
            .map((name) => ctx.table.fields.find((f) => f.name === name)?.label ?? name)
            .join(', ')
    case 'rows':
      return (
        ctx.sources.find((s) => s.value === sourceKey(block.source))?.label ??
        $t('Relation introuvable')
      )
    case 'image':
      return block.source.kind === 'field'
        ? (ctx.table.fields.find((f) => f.name === (block.source as { field: string }).field)
            ?.label ?? '')
        : block.source.data === ''
          ? $t('Aucune image choisie')
          : $t('Image envoyée')
    case 'columns':
      return $tp(block.columns.length, '{count} colonne', '{count} colonnes')
    case 'divider':
      return block.color === 'accent'
        ? $t('Couleur d’accent')
        : block.color === 'text'
          ? $t('Couleur du texte')
          : $t('Gris clair')
    case 'spacer':
      return $t('{height} mm', { height: block.height })
    case 'break':
      return $t('La suite commence sur une nouvelle page.')
  }
}

// ── The list ─────────────────────────────────────────────────────────────────

export function BlockList({
  blocks,
  keys,
  opened,
  onToggle,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
  onInsert,
  added,
  ctx,
}: {
  readonly blocks: readonly DocumentBlock[]
  /** One per block: what React and the drag know it by. */
  readonly keys: readonly string[]
  readonly opened: ReadonlySet<string>
  readonly onToggle: (key: string) => void
  readonly onChange: (index: number, block: DocumentBlock) => void
  readonly onMove: (from: number, to: number) => void
  readonly onRemove: (index: number) => void
  readonly onDuplicate: (index: number) => void
  /** Asks for a block to be inserted at `index`. */
  readonly onInsert: (index: number) => void
  /** The block just added, brought into view. */
  readonly added?: string | null
  readonly ctx: Context
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over === null || active.id === over.id) return
    onMove(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={[...keys]} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {blocks.map((block, i) => {
            const key = keys[i] as string
            return (
              <SortableCard key={key} id={key}>
                {(handle) => (
                  <BlockCard
                    block={block}
                    handle={handle}
                    open={opened.has(key)}
                    onToggle={() => onToggle(key)}
                    first={i === 0}
                    last={i === blocks.length - 1}
                    onMove={(by) => onMove(i, i + by)}
                    onRemove={() => onRemove(i)}
                    onDuplicate={() => onDuplicate(i)}
                    onInsertAfter={() => onInsert(i + 1)}
                    reveal={key === added}
                    ctx={ctx}
                  >
                    <BlockSettings block={block} onChange={(b) => onChange(i, b)} ctx={ctx} />
                  </BlockCard>
                )}
              </SortableCard>
            )
          })}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function SortableCard({
  id,
  children,
}: {
  readonly id: string
  readonly children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const handle = (
    <Hint label={$t('Glisser pour déplacer le bloc')}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={$t('Déplacer le bloc')}
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
    </Hint>
  )
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-90 shadow-lg')}
    >
      {children(handle)}
    </li>
  )
}

function BlockCard({
  block,
  handle,
  open,
  onToggle,
  first,
  last,
  onMove,
  onRemove,
  onDuplicate,
  onInsertAfter,
  reveal = false,
  ctx,
  children,
}: {
  readonly block: DocumentBlock
  readonly handle: ReactNode
  readonly open: boolean
  readonly onToggle: () => void
  readonly first: boolean
  readonly last: boolean
  readonly onMove: (by: -1 | 1) => void
  readonly onRemove: () => void
  readonly onDuplicate: () => void
  readonly onInsertAfter?: () => void
  /** Scrolled into view when it appears. */
  readonly reveal?: boolean
  readonly ctx: Context
  readonly children: ReactNode
}) {
  const meta = metaOf(block.kind)
  const body = useId()
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reveal) card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [reveal])
  return (
    <div
      ref={card}
      className={cn(
        'rounded-lg border bg-card transition-shadow',
        open && 'shadow-sm ring-1 ring-primary/15',
      )}
    >
      <div className="flex items-center gap-1 py-1 pr-1 pl-1.5">
        {handle}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={body}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-accent/50"
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            <meta.icon className="size-3.5" />
          </span>
          <span className="shrink-0 text-sm font-medium">{meta.label}</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {summaryOf(block, ctx)}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={first}
          onClick={() => onMove(-1)}
          aria-label={$t('Monter')}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={last}
          onClick={() => onMove(1)}
          aria-label={$t('Descendre')}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label={$t('Actions sur le bloc')}
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {onInsertAfter !== undefined && (
              <DropdownMenuItem onSelect={onInsertAfter}>
                <Plus className="size-4" />
                {$t('Insérer un bloc après')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="size-4" />
              {$t('Dupliquer')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2 className="size-4" />
              {$t('Supprimer le bloc')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div id={body} className="border-t p-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * A rich text the person writes. The editor tidies what it opens — a paragraph after a
 * closing list — and says so: only what is written here changes the template.
 */
export function RichField({
  value,
  onChange,
  fields,
  placeholder,
  minHeight = 'min-h-20',
}: {
  readonly value: string
  readonly onChange: (html: string) => void
  readonly fields: readonly Field[]
  readonly placeholder: string
  readonly minHeight?: string
}) {
  const touched = useRef(false)
  const touch = () => {
    touched.current = true
  }
  return (
    <div onPointerDown={touch} onKeyDown={touch} onPaste={touch} onDrop={touch}>
      <RichTextEditor
        value={value}
        onChange={(html) => touched.current && html !== value && onChange(html)}
        fields={fields}
        placeholder={placeholder}
        contentClassName={minHeight}
      />
    </div>
  )
}

export function BlockSettings({
  block,
  onChange,
  ctx,
}: {
  readonly block: DocumentBlock
  readonly onChange: (next: DocumentBlock) => void
  readonly ctx: Context
}): ReactNode {
  switch (block.kind) {
    case 'text':
      return (
        <div className="space-y-3">
          <RichField
            value={block.html}
            onChange={(html) => onChange({ ...block, html })}
            fields={shown(ctx.table.fields)}
            placeholder={$t('Écrire, et citer une colonne avec le menu « Colonne »…')}
            minHeight="min-h-24"
          />
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <Setting label={$t('Alignement')}>
              {() => (
                <Segmented
                  value={block.align}
                  onChange={(align) => onChange({ ...block, align })}
                  options={textAlignOptions()}
                  aria-label={$t('Alignement')}
                />
              )}
            </Setting>
            <Setting label={$t('Taille')}>
              {() => (
                <Segmented
                  value={block.size}
                  onChange={(size) => onChange({ ...block, size })}
                  options={[
                    { value: 'small', label: $t('Petite') },
                    { value: 'normal', label: $t('Normale') },
                    { value: 'large', label: $t('Grande') },
                  ]}
                  aria-label={$t('Taille du texte')}
                />
              )}
            </Setting>
            <Setting label={$t('Habillage')}>
              {(id) => (
                <Choice
                  id={id}
                  value={block.style}
                  onValueChange={(style) =>
                    onChange({ ...block, style: style as typeof block.style })
                  }
                  options={[
                    { value: 'plain', label: $t('Aucun') },
                    { value: 'tint', label: $t('Fond teinté') },
                    { value: 'border', label: $t('Encadré') },
                    { value: 'bar', label: $t('Barre d’accent à gauche') },
                  ]}
                  aria-label={$t('Habillage')}
                  className="w-48"
                />
              )}
            </Setting>
          </div>
        </div>
      )
    case 'title':
      return <TitleSettings block={block} onChange={onChange} ctx={ctx} />
    case 'fields':
      return <FieldsSettings block={block} onChange={onChange} ctx={ctx} />
    case 'rows':
      return <RowsSettings block={block} onChange={onChange} ctx={ctx} />
    case 'image':
      return (
        <div className="space-y-3">
          <ImageInput
            value={block.source}
            onChange={(source) => source !== null && onChange({ ...block, source })}
            fields={imageFields(ctx.table)}
            label={$t('Image')}
          />
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <Setting label={$t('Largeur')}>
              {() => (
                <Segmented
                  value={block.width}
                  onChange={(width) => onChange({ ...block, width })}
                  options={[20, 33, 50, 75, 100].map((w) => ({ value: w, label: `${w} %` }))}
                  aria-label={$t('Largeur de l’image')}
                />
              )}
            </Setting>
            <Setting label={$t('Position')}>
              {() => (
                <Segmented
                  value={block.align}
                  onChange={(align) => onChange({ ...block, align })}
                  options={alignOptions()}
                  aria-label={$t('Position de l’image')}
                />
              )}
            </Setting>
          </div>
        </div>
      )
    case 'divider':
      return (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Setting label={$t('Couleur')}>
            {() => (
              <Segmented
                value={block.color}
                onChange={(color) => onChange({ ...block, color })}
                options={[
                  { value: 'light', label: $t('Gris clair') },
                  { value: 'accent', label: $t('Accent') },
                  { value: 'text', label: $t('Texte') },
                ]}
                aria-label={$t('Couleur du trait')}
              />
            )}
          </Setting>
          <Setting label={$t('Épaisseur')}>
            {() => (
              <Segmented
                value={block.thickness}
                onChange={(thickness) => onChange({ ...block, thickness })}
                options={[
                  { value: 0.5, label: $t('Fin') },
                  { value: 1, label: $t('Moyen') },
                  { value: 2, label: $t('Épais') },
                  { value: 4, label: $t('Très épais') },
                ]}
                aria-label={$t('Épaisseur du trait')}
              />
            )}
          </Setting>
          <Setting label={$t('Longueur')}>
            {() => (
              <Segmented
                value={block.width}
                onChange={(width) => onChange({ ...block, width })}
                options={[25, 50, 80, 100].map((w) => ({ value: w, label: `${w} %` }))}
                aria-label={$t('Longueur du trait, centré')}
              />
            )}
          </Setting>
        </div>
      )
    case 'spacer':
      return (
        <Setting label={$t('Hauteur')}>
          {() => (
            <Segmented
              value={block.height}
              onChange={(height) => onChange({ ...block, height })}
              options={[4, 8, 16, 30, 60].map((h) => ({ value: h, label: `${h} mm` }))}
              aria-label={$t('Hauteur de l’espace')}
            />
          )}
        </Setting>
      )
    case 'columns':
      return <ColumnsSettings block={block} onChange={onChange} ctx={ctx} />
    case 'break':
      return (
        <p className="text-xs text-muted-foreground">
          {$t('La suite commence sur une nouvelle page.')}
        </p>
      )
  }
}

/** Plain text that may cite columns: an input, and a menu that inserts `{{colonne}}`. */
function CitingInput({
  value,
  onChange,
  fields,
  placeholder,
  label,
  id,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly fields: readonly Field[]
  readonly placeholder: string
  readonly label: string
  readonly id?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const insert = (name: string) => {
    const at = input.current?.selectionStart ?? value.length
    const cited = `{{${name}}}`
    onChange(`${value.slice(0, at)}${cited}${value.slice(at)}`)
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(at + cited.length, at + cited.length)
    })
  }
  return (
    <div className="flex gap-1.5">
      <Input
        ref={input}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-8"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs">
            <Braces className="size-3.5" />
            {$t('Colonne')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
          {fields.map((f) => (
            <DropdownMenuItem key={f.name} onSelect={() => insert(f.name)}>
              <span className="truncate">{f.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TitleSettings({
  block,
  onChange,
  ctx,
}: {
  readonly block: Extract<DocumentBlock, { kind: 'title' }>
  readonly onChange: (next: DocumentBlock) => void
  readonly ctx: Context
}) {
  const fields = shown(ctx.table.fields)
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Setting label={$t('Titre')}>
          {(id) => (
            <CitingInput
              id={id}
              value={block.text}
              onChange={(text) => onChange({ ...block, text })}
              fields={fields}
              placeholder={$t('Facture {{numero}}')}
              label={$t('Titre')}
            />
          )}
        </Setting>
        <Setting label={$t('Sous-titre')}>
          {(id) => (
            <CitingInput
              id={id}
              value={block.subtitle}
              onChange={(subtitle) => onChange({ ...block, subtitle })}
              fields={fields}
              placeholder={$t('Facultatif')}
              label={$t('Sous-titre')}
            />
          )}
        </Setting>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Setting label={$t('Style')}>
          {(id) => (
            <Choice
              id={id}
              value={block.style}
              onValueChange={(style) => onChange({ ...block, style: style as typeof block.style })}
              options={[
                { value: 'plain', label: $t('Sobre') },
                { value: 'accent', label: $t('En couleur d’accent') },
                { value: 'underline', label: $t('Souligné d’un trait') },
                { value: 'band', label: $t('Sur un bandeau') },
                { value: 'bleed', label: $t('Sur un bandeau pleine largeur') },
              ]}
              aria-label={$t('Style du titre')}
              className="w-56"
            />
          )}
        </Setting>
        <Setting label={$t('Taille')}>
          {() => (
            <Segmented
              value={block.size}
              onChange={(size) => onChange({ ...block, size })}
              options={[
                { value: 'medium', label: $t('Moyen') },
                { value: 'large', label: $t('Grand') },
                { value: 'huge', label: $t('Très grand') },
              ]}
              aria-label={$t('Taille du titre')}
            />
          )}
        </Setting>
        <Setting label={$t('Alignement')}>
          {() => (
            <Segmented
              value={block.align}
              onChange={(align) => onChange({ ...block, align })}
              options={alignOptions()}
              aria-label={$t('Alignement du titre')}
            />
          )}
        </Setting>
      </div>
    </div>
  )
}

function Checks({
  fields,
  chosen,
  onChange,
}: {
  readonly fields: readonly Field[]
  readonly chosen: readonly string[]
  readonly onChange: (next: string[]) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {fields.map((f) => (
        <label
          key={f.name}
          htmlFor={`${id}-${f.name}`}
          className="flex items-center gap-1.5 text-sm"
        >
          <Checkbox
            id={`${id}-${f.name}`}
            checked={chosen.includes(f.name)}
            onCheckedChange={(v) =>
              onChange(v === true ? [...chosen, f.name] : chosen.filter((n) => n !== f.name))
            }
          />
          {f.label}
        </label>
      ))}
    </div>
  )
}

function FieldsSettings({
  block,
  onChange,
  ctx,
}: {
  readonly block: DocumentFieldsBlock
  readonly onChange: (next: DocumentBlock) => void
  readonly ctx: Context
}) {
  const switchId = useId()
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Checks
          fields={shown(ctx.table.fields)}
          chosen={block.fields}
          onChange={(fields) => onChange({ ...block, fields })}
        />
        <p className="text-xs text-muted-foreground">
          {$t(
            'Dans l’ordre où ils sont cochés. Aucun coché : tous les champs que le lecteur peut lire.',
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Setting label={$t('Disposition')}>
          {() => (
            <Segmented
              value={block.labels}
              onChange={(labels) => onChange({ ...block, labels })}
              options={[
                { value: 'beside', label: $t('Libellé à gauche') },
                { value: 'above', label: $t('Libellé au-dessus') },
                { value: 'summary', label: $t('Récapitulatif') },
              ]}
              aria-label={$t('Disposition des champs')}
            />
          )}
        </Setting>
        {block.labels !== 'summary' && (
          <Setting label={$t('Par ligne')}>
            {() => (
              <Segmented
                value={block.columns}
                onChange={(columns) => onChange({ ...block, columns })}
                options={[1, 2, 3].map((n) => ({
                  value: n as 1 | 2 | 3,
                  label: String(n),
                }))}
                aria-label={$t('Champs par ligne')}
              />
            )}
          </Setting>
        )}
        <label htmlFor={switchId} className="flex h-8 items-center gap-2 text-sm">
          <Switch
            id={switchId}
            checked={block.hide_empty}
            onCheckedChange={(hide_empty) => onChange({ ...block, hide_empty })}
          />
          {$t('Masquer les champs vides')}
        </label>
      </div>
      {block.labels === 'summary' && (
        <p className="text-xs text-muted-foreground">
          {$t(
            'Les valeurs à droite, la dernière en gras sur un trait d’accent : des totaux, un montant dû.',
          )}
        </p>
      )}
    </div>
  )
}

function RowsSettings({
  block,
  onChange,
  ctx,
}: {
  readonly block: DocumentRowsBlock
  readonly onChange: (next: DocumentBlock) => void
  readonly ctx: Context
}) {
  const found = ctx.sources.find((s) => s.value === sourceKey(block.source))
  const theirs = found === undefined ? [] : shown(found.table.fields)
  const columns = block.columns.flatMap((name) => theirs.filter((f) => f.name === name))
  const [details, setDetails] = useState(false)
  const zebraId = useId()
  const without = <T,>(record: Readonly<Record<string, T>>, key: string) => {
    const { [key]: _, ...rest } = record
    return rest
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Setting label={$t('Lignes à lister')}>
          {(id) => (
            <Choice
              id={id}
              value={found?.value ?? null}
              onValueChange={(v) => {
                const next = ctx.sources.find((s) => s.value === v)
                if (next !== undefined)
                  onChange({
                    ...block,
                    source: next.source,
                    columns: [],
                    totals: [],
                    headers: {},
                    widths: {},
                    align: {},
                  })
              }}
              options={ctx.sources.map((s) => ({ value: s.value, label: s.label }))}
              placeholder={$t('Lignes à lister')}
              aria-label={$t('Lignes à lister')}
            />
          )}
        </Setting>
        <Setting label={$t('Titre du tableau')}>
          {(id) => (
            <Input
              id={id}
              value={block.title}
              onChange={(e) => onChange({ ...block, title: e.target.value })}
              placeholder={$t('Facultatif')}
              className="h-8"
            />
          )}
        </Setting>
      </div>
      <Setting label={$t('Colonnes, dans cet ordre')}>
        {() => (
          <Checks
            fields={theirs}
            chosen={block.columns}
            onChange={(next) =>
              onChange({
                ...block,
                columns: theirs.map((f) => f.name).filter((n) => next.includes(n)),
                totals: block.totals.filter((t) => next.includes(t)),
              })
            }
          />
        )}
      </Setting>
      {columns.some(numeric) && (
        <Setting label={$t('Totaux sous le tableau')}>
          {() => (
            <Checks
              fields={columns.filter(numeric)}
              chosen={block.totals}
              onChange={(totals) => onChange({ ...block, totals })}
            />
          )}
        </Setting>
      )}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Setting label={$t('Style')}>
          {() => (
            <Segmented
              value={block.style}
              onChange={(style) => onChange({ ...block, style })}
              options={[
                { value: 'light', label: $t('Sobre') },
                { value: 'accent', label: $t('En-tête coloré') },
                { value: 'lines', label: $t('Filets') },
              ]}
              aria-label={$t('Style du tableau')}
            />
          )}
        </Setting>
        <label htmlFor={zebraId} className="flex h-8 items-center gap-2 text-sm">
          <Switch
            id={zebraId}
            checked={block.zebra}
            onCheckedChange={(zebra) => onChange({ ...block, zebra })}
          />
          {$t('Une ligne sur deux teintée')}
        </label>
      </div>
      {columns.length > 0 && (
        <div className="rounded-md border">
          <button
            type="button"
            onClick={() => setDetails((d) => !d)}
            aria-expanded={details}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn('size-3.5 transition-transform', details && 'rotate-90')} />
            {$t('En-têtes, largeurs et alignements des colonnes')}
          </button>
          {details && (
            <div className="space-y-2 border-t p-3">
              {columns.map((f) => (
                <div
                  key={f.name}
                  className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-2"
                >
                  <Input
                    value={block.headers[f.name] ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...block,
                        headers:
                          e.target.value === ''
                            ? without(block.headers, f.name)
                            : { ...block.headers, [f.name]: e.target.value },
                      })
                    }
                    placeholder={f.label}
                    aria-label={$t('En-tête de la colonne {label}', { label: f.label })}
                    className="h-8"
                  />
                  <div className="relative">
                    <Input
                      type="number"
                      min={3}
                      max={95}
                      value={block.widths[f.name] ?? ''}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        onChange({
                          ...block,
                          widths:
                            e.target.value === '' || !Number.isFinite(n)
                              ? without(block.widths, f.name)
                              : {
                                  ...block.widths,
                                  [f.name]: Math.min(95, Math.max(3, Math.round(n))),
                                },
                        })
                      }}
                      placeholder={$t('auto')}
                      aria-label={$t('Largeur de la colonne {label}, en pour cent', {
                        label: f.label,
                      })}
                      className="h-8 pr-6"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <Segmented
                    value={block.align[f.name] ?? (numeric(f) ? 'right' : 'left')}
                    onChange={(a: DocumentAlign) =>
                      onChange({ ...block, align: { ...block.align, [f.name]: a } })
                    }
                    options={alignOptions()}
                    aria-label={$t('Alignement de la colonne {label}', { label: f.label })}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {$t('Une largeur vide se règle sur ce que la colonne contient.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Columns ──────────────────────────────────────────────────────────────────

const WIDTHS: Readonly<Record<2 | 3, ReadonlyArray<{ value: string; label: string }>>> = {
  2: [
    { value: '1,1', label: '½ · ½' },
    { value: '2,1', label: '⅔ · ⅓' },
    { value: '1,2', label: '⅓ · ⅔' },
    { value: '3,2', label: '⅗ · ⅖' },
  ],
  3: [
    { value: '1,1,1', label: '⅓ · ⅓ · ⅓' },
    { value: '2,1,1', label: '½ · ¼ · ¼' },
    { value: '1,2,1', label: '¼ · ½ · ¼' },
    { value: '1,1,2', label: '¼ · ¼ · ½' },
  ],
}

function ColumnsSettings({
  block,
  onChange,
  ctx,
}: {
  readonly block: DocumentColumnsBlock
  readonly onChange: (next: DocumentBlock) => void
  readonly ctx: Context
}) {
  const [tab, setTab] = useState(0)
  const [picking, setPicking] = useState<number | null>(null)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const n = block.columns.length as 2 | 3
  const shownTab = Math.min(tab, n - 1)
  const column = block.columns[shownTab] ?? []
  const setColumn = (blocks: readonly DocumentColumnBlock[]) =>
    onChange({ ...block, columns: block.columns.map((c, i) => (i === shownTab ? blocks : c)) })
  const toggle = (key: string) =>
    setOpened((o) => {
      const next = new Set(o)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const widthsValue = block.widths.join(',')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Setting label={$t('Colonnes')}>
          {() => (
            <Segmented
              value={n}
              onChange={(count) => {
                const columns =
                  count > n
                    ? [...block.columns, []]
                    : // The third column's blocks join the second: nothing is lost.
                      [
                        block.columns[0] ?? [],
                        [...(block.columns[1] ?? []), ...(block.columns[2] ?? [])],
                      ]
                onChange({ ...block, columns, widths: columns.map(() => 1) })
              }}
              options={[
                { value: 2 as const, label: '2' },
                { value: 3 as const, label: '3' },
              ]}
              aria-label={$t('Nombre de colonnes')}
            />
          )}
        </Setting>
        <Setting label={$t('Largeurs')}>
          {(id) => (
            <Choice
              id={id}
              value={WIDTHS[n].some((w) => w.value === widthsValue) ? widthsValue : null}
              onValueChange={(v) => onChange({ ...block, widths: v.split(',').map(Number) })}
              options={WIDTHS[n]}
              aria-label={$t('Largeurs des colonnes')}
              className="w-36"
            />
          )}
        </Setting>
      </div>
      <div className="rounded-md border">
        <div role="tablist" className="flex border-b">
          {block.columns.map((c, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place
              key={i}
              type="button"
              role="tab"
              aria-selected={i === shownTab}
              onClick={() => setTab(i)}
              className={cn(
                '-mb-px flex-1 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                i === shownTab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {$t('Colonne {number}', { number: i + 1 })}
              <span className="ml-1.5 text-muted-foreground">({c.length})</span>
            </button>
          ))}
        </div>
        <div role="tabpanel" className="space-y-2 p-2">
          {column.length === 0 && (
            <p className="px-1 py-2 text-center text-xs text-muted-foreground">
              {$t('Colonne vide.')}
            </p>
          )}
          {column.map((inner, j) => {
            const key = `${shownTab}:${j}`
            return (
              <BlockCard
                key={key}
                block={inner}
                handle={<span className="size-1" />}
                open={opened.has(key)}
                onToggle={() => toggle(key)}
                first={j === 0}
                last={j === column.length - 1}
                onMove={(by) => {
                  const next = [...column]
                  const [moved] = next.splice(j, 1)
                  next.splice(j + by, 0, moved as DocumentColumnBlock)
                  setColumn(next)
                }}
                onRemove={() => setColumn(column.filter((_, k) => k !== j))}
                onDuplicate={() =>
                  setColumn([...column.slice(0, j + 1), inner, ...column.slice(j + 1)])
                }
                ctx={ctx}
              >
                <BlockSettings
                  block={inner}
                  onChange={(b) =>
                    setColumn(column.map((x, k) => (k === j ? (b as DocumentColumnBlock) : x)))
                  }
                  ctx={ctx}
                />
              </BlockCard>
            )
          })}
          <Button
            variant="ghost"
            size="sm"
            className="w-full border border-dashed text-muted-foreground"
            onClick={() => setPicking(shownTab)}
          >
            <Plus className="size-4" />
            {$t('Ajouter dans cette colonne')}
          </Button>
        </div>
      </div>
      <BlockPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        kinds={COLUMN_KINDS}
        onPick={(kind: BlockKind) => {
          const made = newBlock(kind, ctx.table, ctx.sources)
          if (made === null) return
          setOpened((o) => new Set(o).add(`${shownTab}:${column.length}`))
          setColumn([...column, made as DocumentColumnBlock])
        }}
      />
    </div>
  )
}
