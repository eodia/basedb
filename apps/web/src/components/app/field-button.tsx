'use client'

import type { Row } from '@/components/app/grid/cell'
import { type Field, api } from '@/lib/api/client'
import { buttonUrl } from '@/lib/automations'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { ExternalLink, Loader2, Zap } from 'lucide-react'
import { type MouseEvent, useState } from 'react'
import { toast } from 'sonner'

/**
 * A button field, drawn in a cell, a card or the detail view — chapter 17 §4. It opens an
 * address composed with what the reader sees of the row, or launches an automation for
 * the row; either way it says what happened.
 */
export function FieldButton({
  field,
  row,
  fields = [],
  size = 'sm',
}: {
  readonly field: Field
  readonly row: Row
  /** The table's fields: a choice cited in an address reads by its label. */
  readonly fields?: readonly Field[]
  readonly size?: 'xs' | 'sm'
}) {
  const [busy, setBusy] = useState(false)
  const config = field.button
  if (config === undefined) return null

  const click = async (event: MouseEvent) => {
    // A card or a row under the button would open too.
    event.stopPropagation()
    if (config.action === 'url') {
      const href = config.url === null ? null : buttonUrl(config.url, row, fields)
      if (href === null) {
        toast.error('L’adresse de ce bouton n’est pas valide.')
        return
      }
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    if (config.automation === null) return
    setBusy(true)
    try {
      await api.runAutomation(config.automation, row._id)
      toast(`« ${config.label} » lancé`)
    } catch (e) {
      toast.error(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const Icon = busy ? Loader2 : config.action === 'url' ? ExternalLink : Zap
  return (
    <button
      type="button"
      onClick={(e) => void click(e)}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={busy}
      title={config.action === 'url' ? 'Ouvrir' : 'Lancer l’automatisation'}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border bg-background font-medium shadow-xs transition-colors hover:bg-accent disabled:opacity-60',
        size === 'xs' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
      )}
      style={config.color === null ? undefined : { borderColor: config.color, color: config.color }}
    >
      <Icon className={cn('size-3.5 shrink-0', busy && 'animate-spin')} />
      <span className="truncate">{config.label}</span>
    </button>
  )
}
