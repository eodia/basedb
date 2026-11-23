'use client'

import {
  ArrowUp,
  File,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
  Play,
  Presentation,
  TriangleAlert,
  X,
} from 'lucide-react'
import { type ReactNode, type RefObject, useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { VoiceButton } from '@/components/app/voice-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import { api, type CopilotAttachment, type ReadAttachment } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { replyInWriting } from '@/lib/voice'

/**
 * The attachments of a copilot conversation — chapter 12 §1.6, on screen.
 *
 * Files go INTO the box one writes in, as chips above the text — by the paper clip, by
 * dropping them on it, by pasting a screenshot. The server reads each one once, to its
 * text; an image stays an image, made smaller here, and the model looks at it. A chip
 * opens what it shows, in the box as in the conversation: an image in large, another
 * file in a new tab, from this page's memory — nothing of it is kept on the server.
 *
 * A file attached to one message stays in the conversation: each turn sends the latest
 * ones, five at most, three images among them.
 */

export interface Attachment {
  readonly id: string
  readonly name: string
  readonly kind: ReadAttachment['kind'] | null
  readonly status: 'reading' | 'ready' | 'error'
  /** This page's address of the file — what a click on its chip opens. */
  readonly url: string
  readonly error?: string
  readonly text?: string
  readonly chars?: number
  readonly truncated?: boolean
  readonly parts?: number | null
  readonly image?: { readonly media_type: string; readonly data: string }
}

const MAX_FILES = 5
const MAX_IMAGES = 3
const MAX_BYTES = 20 * 1024 * 1024
/** The longest side of an image sent: what the providers look at, no more. */
const IMAGE_SIDE = 1568
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const ACCEPTED =
  '.pdf,.xlsx,.xlsm,.docx,.pptx,.odt,.ods,.odp,.csv,.tsv,.txt,.md,.json,.xml,.html,.htm,.sql,.log,.yaml,.yml,image/png,image/jpeg,image/gif,image/webp'

let counter = 0

/** The attachments of a turn as the route takes them: the latest first kept, within bounds. */
export function attachmentsToSend(
  history: ReadonlyArray<readonly Attachment[] | undefined>,
): CopilotAttachment[] {
  const all = history.flatMap((list) => list ?? []).filter((a) => a.status === 'ready')
  const kept: Attachment[] = []
  let images = 0
  for (const a of [...all].reverse()) {
    if (kept.length >= MAX_FILES) break
    if (a.image !== undefined) {
      if (images >= MAX_IMAGES) continue
      images++
    }
    kept.unshift(a)
  }
  return kept.map((a) =>
    a.image === undefined ? { name: a.name, text: a.text ?? '' } : { name: a.name, image: a.image },
  )
}

/** The question a message without text asks: to look at what it carries. */
export function questionFor(text: string, attached: readonly Attachment[]): string {
  const question = text.trim()
  if (question !== '' || attached.length === 0) return question
  return $tp(
    attached.length,
    'Voici une pièce jointe : qu’en retiens-tu, et que me proposes-tu ?',
    'Voici {count} pièces jointes : qu’en retiens-tu, et que me proposes-tu ?',
  )
}

/** The files waiting in the box, until they leave with a message. */
export function useAttachments() {
  const [pending, setPendingState] = useState<readonly Attachment[]>([])
  // What is in the box right now, for the handlers that run between two renders.
  const current = useRef<readonly Attachment[]>([])
  const setPending = useCallback((change: (list: readonly Attachment[]) => Attachment[]) => {
    current.current = change(current.current)
    setPendingState(current.current)
  }, [])

  const change = useCallback(
    (id: string, patch: Partial<Attachment>) => {
      setPending((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))
    },
    [setPending],
  )

  const add = useCallback(
    (files: readonly globalThis.File[]) => {
      if (files.length === 0) return
      const list = current.current
      const room = MAX_FILES - list.length
      if (files.length > room) {
        toast.error(
          $tp(MAX_FILES, '{count} pièce jointe au plus.', '{count} pièces jointes au plus.'),
        )
      }
      let imagesLeft = MAX_IMAGES - list.filter((a) => a.kind === 'image').length
      const added: Attachment[] = []
      for (const file of files.slice(0, Math.max(0, room))) {
        const isImage = file.type.startsWith('image/')
        if (isImage && imagesLeft-- <= 0) {
          toast.error($tp(MAX_IMAGES, '{count} image au plus.', '{count} images au plus.'))
          continue
        }
        const attachment: Attachment = {
          id: `pj-${++counter}`,
          name: file.name || $t('Capture d’écran'),
          kind: isImage ? 'image' : null,
          status: 'reading',
          url: URL.createObjectURL(file),
        }
        added.push(attachment)
        void read(file, isImage).then(
          (patch) => change(attachment.id, { ...patch, status: 'ready' }),
          (e) => change(attachment.id, { status: 'error', error: messageFor(e) }),
        )
      }
      setPending((before) => [...before, ...added])
    },
    [change, setPending],
  )

  const remove = useCallback(
    (id: string) => {
      setPending((list) => list.filter((a) => a.id !== id))
    },
    [setPending],
  )

  /** The files ready to leave with the message; those still being read stay in the box. */
  const take = useCallback((): Attachment[] => {
    const ready = current.current.filter((a) => a.status === 'ready')
    setPending((list) => list.filter((a) => a.status === 'reading'))
    return ready
  }, [setPending])

  return {
    pending,
    add,
    remove,
    take,
    reading: pending.some((a) => a.status === 'reading'),
  }
}

async function read(file: globalThis.File, isImage: boolean): Promise<Partial<Attachment>> {
  if (file.size > MAX_BYTES) {
    throw new Error($t('Ce fichier dépasse 20 Mo.'))
  }
  if (isImage) return { kind: 'image', image: await imageOf(file) }
  const read = await api.readAttachment(file)
  return {
    kind: read.kind,
    text: read.text,
    chars: read.chars,
    truncated: read.truncated,
    parts: read.parts,
  }
}

/** An image as the provider takes it: its own bytes when small enough, else redrawn smaller. */
async function imageOf(file: globalThis.File): Promise<{ media_type: string; data: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error($t('Cette image n’a pas pu être lue.'))
  })
  const scale = Math.min(1, IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && IMAGE_TYPES.includes(file.type) && file.size <= 3_500_000) {
    bitmap.close()
    return { media_type: file.type, data: base64Of(await file.arrayBuffer()) }
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (context === null) throw new Error($t('Cette image n’a pas pu être lue.'))
  // A transparent background turns black in a JPEG: white, as on a page.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) }
}

function base64Of(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

// ── On screen ─────────────────────────────────────────────────────────────────

const KIND_ICONS = {
  pdf: FileText,
  document: FileText,
  text: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  image: File,
} as const

function detailOf(a: Attachment): string {
  if (a.status === 'reading') return $t('Lecture…')
  if (a.status === 'error') return a.error ?? $t('Illisible')
  const parts =
    a.parts === null || a.parts === undefined
      ? null
      : a.kind === 'pdf'
        ? $tp(a.parts, '{count} page', '{count} pages')
        : a.kind === 'sheet'
          ? $tp(a.parts, '{count} feuille', '{count} feuilles')
          : a.kind === 'slides'
            ? $tp(a.parts, '{count} diapositive', '{count} diapositives')
            : null
  const chars =
    a.chars === undefined ? null : $tp(a.chars, '{count} caractère', '{count} caractères')
  return [parts, chars].filter((v) => v !== null).join(' · ')
}

/** The chips of some attachments — in the box, removable; in a message, to reopen. */
export function AttachmentChips({
  attachments,
  onRemove,
  tone = 'plain',
}: {
  readonly attachments: readonly Attachment[]
  readonly onRemove?: (id: string) => void
  /** `onPrimary`: in a message bubble, on the primary colour. */
  readonly tone?: 'plain' | 'onPrimary'
}) {
  const [shown, setShown] = useState<Attachment | null>(null)
  if (attachments.length === 0) return null
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {attachments.map((a) => {
          const Icon = a.kind === null ? File : KIND_ICONS[a.kind]
          const open = () => (a.kind === 'image' ? setShown(a) : window.open(a.url, '_blank'))
          return (
            <div
              key={a.id}
              className={cn(
                'group relative flex max-w-full items-center gap-2 rounded-lg border text-left',
                a.kind === 'image' ? 'p-0.5' : 'py-1 pr-2 pl-1.5',
                tone === 'onPrimary'
                  ? 'border-primary-foreground/25 bg-primary-foreground/10'
                  : 'bg-background',
                a.status === 'error' && 'border-destructive/40',
              )}
            >
              <Hint
                label={a.kind === 'image' ? $t('Agrandir') : $t('Ouvrir dans un nouvel onglet')}
              >
                <button
                  type="button"
                  onClick={open}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  {a.kind === 'image' ? (
                    <img
                      src={a.url}
                      alt={a.name}
                      className="size-12 rounded-md object-cover"
                      draggable={false}
                    />
                  ) : (
                    <>
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md',
                          tone === 'onPrimary' ? 'bg-primary-foreground/15' : 'bg-muted',
                        )}
                      >
                        {a.status === 'reading' ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : a.status === 'error' ? (
                          <TriangleAlert className="size-3.5 text-destructive" />
                        ) : (
                          <Icon className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-40 truncate text-xs font-medium">
                          {a.name}
                        </span>
                        <span
                          className={cn(
                            'block max-w-40 truncate text-[10px]',
                            a.status === 'error'
                              ? 'text-destructive'
                              : tone === 'onPrimary'
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground',
                          )}
                        >
                          {detailOf(a)}
                          {a.truncated === true && ` · ${$t('tronqué')}`}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              </Hint>
              {a.kind === 'image' && a.status === 'reading' && (
                <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-white drop-shadow" />
              )}
              {onRemove !== undefined && (
                <button
                  type="button"
                  onClick={() => onRemove(a.id)}
                  aria-label={$t('Retirer {name}', { name: a.name })}
                  className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm group-hover:flex hover:text-foreground focus-visible:flex"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <Dialog open={shown !== null} onOpenChange={(open) => !open && setShown(null)}>
        <DialogContent className="max-w-[min(92vw,1200px)] p-3">
          <DialogTitle className="truncate pr-8 text-sm">{shown?.name}</DialogTitle>
          {shown !== null && (
            <img
              src={shown.url}
              alt={shown.name}
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** The person's consent, for one conversation, to the copilot reading the data they see. */
export interface CopilotAccess {
  readonly allowed: boolean
  readonly onChange: (allowed: boolean) => void
  /** What it lets the copilot do, and what leaves for the AI provider. */
  readonly hint: string
}

/**
 * The box one writes to a copilot in, as in insights: the files on top, the text, then the
 * paper clip, « Autoriser l'accès », the microphone and the send button. Enter sends,
 * Maj+Entrée goes to the next line; a question dictated is sent once one stops speaking, and
 * its answer read aloud (`speakReply`).
 */
export function CopilotComposer({
  value,
  onChange,
  onSend,
  onDictated,
  busy,
  placeholder,
  inputRef,
  attachments,
  access,
  footer,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onSend: () => void
  /** A question dictated, to send as is; without it, no microphone. */
  readonly onDictated?: (text: string) => void
  readonly busy: boolean
  readonly placeholder: string
  readonly inputRef: RefObject<HTMLTextAreaElement | null>
  readonly attachments: ReturnType<typeof useAttachments>
  readonly access?: CopilotAccess
  readonly footer?: ReactNode
}) {
  const picker = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const { pending, add, remove, reading } = attachments
  const ready = pending.some((a) => a.status === 'ready')
  const canSend = !busy && !reading && (value.trim() !== '' || ready)
  const send = () => {
    replyInWriting()
    onSend()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop zone around the prompt — files are also attached through its button
    <div
      className={cn(
        'rounded-md border bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        dragging && 'border-primary ring-[3px] ring-primary/30',
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return
        e.preventDefault()
        setDragging(false)
        add([...e.dataTransfer.files])
      }}
    >
      {pending.length > 0 && (
        <div className="px-2.5 pt-2.5">
          <AttachmentChips attachments={pending} onRemove={remove} />
        </div>
      )}
      <Textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const files = [...e.clipboardData.files]
          if (files.length === 0) return
          e.preventDefault()
          add(files)
        }}
        onKeyDown={(e) => {
          // Enter sends, Maj+Entrée goes to the next line — the convention of every chat
          // box, and the one people's fingers already know.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (canSend) send()
          }
        }}
        rows={3}
        placeholder={dragging ? $t('Déposez vos fichiers ici') : placeholder}
        aria-label={$t('Votre demande au Copilot')}
        className="resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        <input
          ref={picker}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            add([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <Hint
          label={$t(
            'Joindre des fichiers — PDF, Excel, Word, PowerPoint, CSV, texte, images. Vous pouvez aussi les déposer ou les coller ici.',
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => picker.current?.click()}
            disabled={busy}
            aria-label={$t('Joindre des fichiers')}
          >
            <Paperclip className="size-4" />
          </Button>
        </Hint>
        {access !== undefined && (
          <Hint label={access.hint}>
            <button
              type="button"
              onClick={() => access.onChange(!access.allowed)}
              disabled={busy}
              aria-pressed={access.allowed}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium transition-colors disabled:opacity-50',
                access.allowed
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Play className={cn('size-3', access.allowed && 'fill-current')} />
              {$t('Autoriser l’accès')}
            </button>
          </Hint>
        )}
        {pending.length > 0 && (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {$t('Leur contenu sera envoyé au fournisseur d’IA.')}
          </span>
        )}
        {footer}
        <span className="flex-1" />
        {onDictated !== undefined && (
          <VoiceButton onText={onChange} onSend={onDictated} disabled={busy || reading} />
        )}
        <Button size="icon-sm" onClick={send} disabled={!canSend} aria-label={$t('Envoyer')}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
