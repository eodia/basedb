'use client'

import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import type { DocumentImageSource, Field } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Segmented } from './controls'
import { MAX_IMAGE_BYTES } from './model'

/**
 * A picture of a document — a logo, a stamp, a photograph: sent with the template, or
 * read from an image field of the row (chapter 21 §1.3).
 *
 * What is sent is made to fit here, before it leaves: a picture as large as a photograph
 * is drawn again smaller until it weighs less than the server takes, a drawing in SVG is
 * turned into a PNG — a PDF embeds PNG and JPEG, and a picture is never a script.
 */

/** Bytes a `data:` address holds. */
const bytesOf = (dataUrl: string) =>
  Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)

function load(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image'))
    image.src = url
  }).finally(() => URL.revokeObjectURL(url)) as Promise<HTMLImageElement>
}

/**
 * A file as a `data:` address the server takes: a JPEG stays a JPEG, anything else
 * becomes a PNG — transparency kept —, made smaller until it weighs less than the bound.
 */
export async function pictureOf(file: File): Promise<string> {
  const image = await load(file)
  const photo = file.type === 'image/jpeg'
  // A drawing has no size of its own in pixels: drawn at twice its stated size.
  const natural = file.type === 'image/svg+xml' ? 2 : 1
  let width = (image.naturalWidth || 600) * natural
  let height = (image.naturalHeight || 300) * natural
  const most = 1600
  if (Math.max(width, height) > most) {
    const k = most / Math.max(width, height)
    width *= k
    height *= k
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const context = canvas.getContext('2d')
    if (context === null) break
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const url = photo
      ? canvas.toDataURL('image/jpeg', attempt < 3 ? 0.88 - attempt * 0.08 : 0.7)
      : canvas.toDataURL('image/png')
    if (bytesOf(url) <= MAX_IMAGE_BYTES) return url
    if (!photo || attempt >= 2) {
      width *= 0.8
      height *= 0.8
    }
  }
  throw new Error('trop lourde')
}

export function ImageInput({
  value,
  onChange,
  fields,
  allowNone = false,
  label,
}: {
  readonly value: DocumentImageSource | null
  readonly onChange: (next: DocumentImageSource | null) => void
  /** The table's image fields: a picture may be the row's. */
  readonly fields: readonly Field[]
  /** A logo may be none at all. */
  readonly allowNone?: boolean
  readonly label: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode = value?.kind ?? 'upload'

  const pick = async (file: File | undefined) => {
    if (file === undefined) return
    setBusy(true)
    setError(null)
    try {
      onChange({ kind: 'upload', data: await pictureOf(file) })
    } catch {
      setError($t('Cette image ne peut pas être lue. Essayez un PNG ou un JPEG.'))
    } finally {
      setBusy(false)
      if (input.current !== null) input.current.value = ''
    }
  }

  const uploaded = value?.kind === 'upload' && value.data !== '' ? value.data : null

  return (
    <div className="space-y-2">
      {fields.length > 0 && (
        <Segmented
          value={mode}
          onChange={(kind) =>
            kind === 'field'
              ? onChange({ kind: 'field', field: (fields[0] as Field).name })
              : onChange(allowNone ? null : { kind: 'upload', data: '' })
          }
          options={[
            { value: 'upload', label: $t('Image envoyée') },
            { value: 'field', label: $t('Champ de la ligne') },
          ]}
          aria-label={label}
        />
      )}
      {mode === 'field' ? (
        <Choice
          value={value?.kind === 'field' ? value.field : null}
          onValueChange={(field) => onChange({ kind: 'field', field })}
          options={fields.map((f) => ({ value: f.name, label: f.label }))}
          aria-label={$t('Champ image')}
          size="sm"
        />
      ) : (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border p-1',
              // The paper it is printed on, whatever the theme — and a checkerboard, so that a
              // transparent picture shows as one.
              'bg-white bg-[repeating-conic-gradient(#f1f1f1_0%_25%,#ffffff_0%_50%)] bg-[length:12px_12px]',
            )}
          >
            {uploaded !== null ? (
              <img src={uploaded} alt={label} className="max-h-full max-w-full object-contain" />
            ) : (
              <ImagePlus className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {uploaded === null ? $t('Choisir une image…') : $t('Remplacer…')}
            </Button>
            {uploaded !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(allowNone ? null : { kind: 'upload', data: '' })}
              >
                <Trash2 className="size-4" />
                {$t('Retirer')}
              </Button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </div>
      )}
      {mode === 'upload' && (
        <p className={cn('text-xs', error === null ? 'text-muted-foreground' : 'text-destructive')}>
          {error ??
            $t(
              'PNG, JPEG ou SVG ; une image trop lourde est réduite. Un fond transparent reste transparent.',
            )}
        </p>
      )}
    </div>
  )
}
