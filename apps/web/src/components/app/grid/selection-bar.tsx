'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ExportFormat } from '@/lib/export'
import { $t, $tp } from '@/lib/i18n'
import { ChevronDown, Copy, Download, Trash2, X } from 'lucide-react'

/**
 * The bar that appears when rows are selected — chapter 11 §2.5.
 *
 * It REPLACES the toolbar rather than sitting beside it: a second row of controls
 * appearing under the first shifts the grid down by forty pixels, and the row the
 * pointer was about to click moves out from under it.
 *
 * Deletion says how many rows and asks once. It is the only irreversible verb here, and
 * `zz_supprime_` does not apply to rows — a deleted row is deleted (chapter 06 §4 covers
 * fields, tables and bases, not records).
 */

interface Props {
  readonly count: number
  readonly cellCount: number
  readonly deleting: boolean
  readonly editable: boolean
  readonly onClear: () => void
  readonly onDelete: () => void
  readonly onCopy: (format: ExportFormat) => void
  readonly onExport: (format: ExportFormat) => void
}

export function SelectionBar({
  count,
  cellCount,
  deleting,
  editable,
  onClear,
  onDelete,
  onCopy,
  onExport,
}: Props) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-primary/5 px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label={$t('Annuler la sélection')}
      >
        <X className="size-4" />
      </Button>

      <span className="text-sm font-medium">
        {count > 0 ? (
          <>{$tp(count, '{count} ligne sélectionnée', '{count} lignes sélectionnées')}</>
        ) : (
          <>{$tp(cellCount, '{count} cellule sélectionnée', '{count} cellules sélectionnées')}</>
        )}
      </span>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Copy className="size-4" />
            {$t('Copier')}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onCopy('tsv')}>
            {$t('Colonnes séparées par tabulation')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('csv')}>{$t('CSV')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('json')}>{$t('JSON')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('sql')}>INSERT SQL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="size-4" />
            {$t('Exporter')}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{$t('Exporter la sélection')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onExport('csv')}>{$t('CSV')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('json')}>{$t('JSON')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('sql')}>INSERT SQL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editable && count > 0 && (
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={deleting}>
          <Trash2 className="size-4" />
          {deleting ? $t('Suppression…') : $t('Supprimer {count}', { count })}
        </Button>
      )}
    </div>
  )
}
