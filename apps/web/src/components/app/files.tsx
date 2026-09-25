'use client'

import { type Field, type StoredFile, fileHref, filesOf } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import {
  Download,
  FileArchive,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import { type DragEvent, type ReactNode, useRef, useState } from 'react'

/**
 * The cells of `file` and `image` fields — chapter 04 §3 bis, chapter 11.
 *
 * Adding a file is two acts the screen makes look like one: the file is DEPOSITED (it
 * goes to the storage and comes back with an identifier), then the row is WRITTEN with
 * the list it had plus the new identifiers. Removing one is only the second act, the list
 * without it. Either way the list is sent whole and the cell then shows what the server
 * read back — never what was dropped on it.
 *
 * Every picture and every link goes through the signed `url` a read handed out: the
 * browser fetches it without a token, and it expires with the page that carried it.
 */

/** Deposits files for a field; returns those that made it, having said why the others did not. */
export type Upload = (field: Field, files: readonly File[]) => Promise<readonly StoredFile[]>

/** What the file picker offers for an image field — the types the server accepts. */
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif'

const isPicture = (file: StoredFile) => file.type.startsWith('image/') && file.url !== undefined

/** A size as a person reads it: `845 o`, `12 Ko`, `3,4 Mo`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

/** A glyph for a document, from its type: enough to tell a PDF from a spreadsheet at a glance. */
function DocumentGlyph({
  type,
  className,
}: { readonly type: string; readonly className?: string }) {
  const Icon =
    type === 'application/pdf' || type.startsWith('text/') || type.includes('word')
      ? FileText
      : type.includes('sheet') || type.includes('excel') || type === 'text/csv'
        ? FileSpreadsheet
        : type.includes('zip') || type.includes('compressed') || type.includes('tar')
          ? FileArchive
          : FileIcon
  return <Icon aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground', className)} />
}

/**
 * Holds the one hidden `<input type="file">` and the drag-and-drop of a field, and turns
 * both into "these files were added".
 */
function useFileDrop(field: Field, enabled: boolean, onFiles: (files: File[]) => void) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const carriesFiles = (e: DragEvent) => enabled && e.dataTransfer.types.includes('Files')

  return {
    over,
    browse: () => input.current?.click(),
    dropProps: {
      onDragOver: (e: DragEvent) => {
        if (!carriesFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false)
        if (!carriesFiles(e)) return
        e.preventDefault()
        onFiles([...e.dataTransfer.files])
      },
    },
    input: (
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={field.kind === 'image' ? IMAGE_ACCEPT : undefined}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          // Emptied so that choosing the same file again still fires `change`.
          e.target.value = ''
          if (files.length > 0) onFiles(files)
        }}
      />
    ),
  }
}

/** Deposit, then write the list with the newcomers — the two acts of an addition. */
function useAddFiles(
  field: Field,
  current: readonly StoredFile[],
  onUpload: Upload | undefined,
  onCommit: (value: unknown) => Promise<void>,
) {
  const [busy, setBusy] = useState(false)
  const add = async (files: File[]) => {
    if (onUpload === undefined || files.length === 0) return
    setBusy(true)
    try {
      const uploaded = await onUpload(field, files)
      // The files whole, not their identifiers alone: the server reads the `id` of each
      // and nothing else, but a record not yet created shows what its draft holds, and a
      // draft of bare identifiers would show nameless files.
      if (uploaded.length > 0) await onCommit([...current, ...uploaded])
    } finally {
      setBusy(false)
    }
  }
  const remove = (id: string) => {
    const rest = current.filter((f) => f.id !== id)
    return onCommit(rest.length === 0 ? null : rest)
  }
  return { busy, add, remove }
}

/** Opens a file in a new tab, through its signed link. Nothing to open without one. */
function FileAnchor({
  file,
  className,
  children,
}: {
  readonly file: StoredFile
  readonly className?: string
  readonly children: ReactNode
}) {
  if (file.url === undefined) return <span className={className}>{children}</span>
  return (
    <a
      href={fileHref(file.url)}
      target="_blank"
      rel="noreferrer"
      title={`${file.name} · ${formatSize(file.size)}`}
      // The grid selects a cell on mousedown; opening a file is not selecting it.
      onMouseDown={(e) => e.stopPropagation()}
      className={className}
    >
      {children}
    </a>
  )
}

/**
 * A file field in the grid: thumbnails for pictures, chips for documents, on one line.
 * A `+` shows on hover, and files dropped on the cell are added.
 */
export function FilesCell({
  field,
  value,
  onUpload,
  onCommit,
}: {
  readonly field: Field
  readonly value: unknown
  readonly onUpload?: Upload
  readonly onCommit: (value: unknown) => Promise<void>
}) {
  const files = filesOf(value)
  const writable = field.read_only !== true && onUpload !== undefined
  const { busy, add } = useAddFiles(field, files, onUpload, onCommit)
  const drop = useFileDrop(field, writable && !busy, (picked) => void add(picked))

  return (
    <span
      {...drop.dropProps}
      className={cn(
        'flex size-full min-w-0 items-center gap-1 px-2',
        drop.over && 'bg-primary/10 ring-1 ring-primary ring-inset',
      )}
    >
      {/* The files are clipped, the `+` is not: a cell full of chips must still take one. */}
      <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {files.length === 0 && !busy && <span className="text-muted-foreground">—</span>}
        {files.map((file) =>
          isPicture(file) ? (
            <FileAnchor key={file.id} file={file} className="shrink-0">
              <img
                src={fileHref(file.url as string)}
                alt={file.name}
                loading="lazy"
                draggable={false}
                className="size-6 rounded-sm border object-cover"
              />
            </FileAnchor>
          ) : (
            <FileAnchor
              key={file.id}
              file={file}
              className="inline-flex min-w-0 max-w-40 shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs hover:bg-accent"
            >
              <DocumentGlyph type={file.type} />
              <span className="truncate">{file.name}</span>
            </FileAnchor>
          ),
        )}
      </span>
      {busy && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
      {writable && !busy && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={drop.browse}
          aria-label={`Ajouter un fichier à ${field.label}`}
          title="Ajouter un fichier (ou déposez-le sur la cellule)"
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      )}
      {drop.input}
    </span>
  )
}

/**
 * A file field in the record panel: pictures as a grid of previews, documents as a list
 * with their size, each removable, and a zone to drop or pick more.
 */
export function FilesField({
  field,
  value,
  onUpload,
  onCommit,
}: {
  readonly field: Field
  readonly value: unknown
  readonly onUpload?: Upload
  readonly onCommit: (value: unknown) => Promise<void>
}) {
  const files = filesOf(value)
  const writable = field.read_only !== true && onUpload !== undefined
  const { busy, add, remove } = useAddFiles(field, files, onUpload, onCommit)
  const drop = useFileDrop(field, writable && !busy, (picked) => void add(picked))

  const pictures = files.filter(isPicture)
  const documents = files.filter((f) => !isPicture(f))

  return (
    <div {...drop.dropProps} className="space-y-2">
      {pictures.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pictures.map((file) => (
            <div key={file.id} className="group/file relative">
              <FileAnchor file={file} className="block">
                <img
                  src={fileHref(file.url as string)}
                  alt={file.name}
                  loading="lazy"
                  className="size-16 rounded-md border object-cover"
                />
              </FileAnchor>
              {writable && (
                <button
                  type="button"
                  onClick={() => void remove(file.id)}
                  aria-label={`Retirer ${file.name}`}
                  className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full border bg-background shadow-sm group-hover/file:flex focus-visible:flex"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-md border">
          {documents.map((file) => (
            <li key={file.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <DocumentGlyph type={file.type} className="size-4" />
              <FileAnchor file={file} className="min-w-0 flex-1 truncate hover:underline">
                {file.name}
              </FileAnchor>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(file.size)}
              </span>
              {file.url !== undefined && (
                <a
                  href={fileHref(file.url, true)}
                  aria-label={`Télécharger ${file.name}`}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Download className="size-3.5" />
                </a>
              )}
              {writable && (
                <button
                  type="button"
                  onClick={() => void remove(file.id)}
                  aria-label={`Retirer ${file.name}`}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writable ? (
        <button
          type="button"
          onClick={drop.browse}
          disabled={busy}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-60',
            drop.over && 'border-primary bg-primary/5 text-foreground',
          )}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          {busy
            ? 'Envoi en cours…'
            : field.kind === 'image'
              ? 'Ajouter des images'
              : 'Ajouter des fichiers'}
        </button>
      ) : (
        files.length === 0 && <span className="text-sm text-muted-foreground">—</span>
      )}
      {drop.input}
    </div>
  )
}
