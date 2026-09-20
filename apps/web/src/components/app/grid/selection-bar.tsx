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
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Annuler la sélection">
        <X className="size-4" />
      </Button>

      <span className="text-sm font-medium">
        {count > 0 ? (
          <>
            {count} ligne{count > 1 ? 's' : ''} sélectionnée{count > 1 ? 's' : ''}
          </>
        ) : (
          <>
            {cellCount} cellule{cellCount > 1 ? 's' : ''} sélectionnée{cellCount > 1 ? 's' : ''}
          </>
        )}
      </span>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Copy className="size-4" />
            Copier
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onCopy('tsv')}>
            Colonnes séparées par tabulation
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('csv')}>CSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('json')}>JSON</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy('sql')}>INSERT SQL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="size-4" />
            Exporter
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal leading-relaxed">
            Les lignes sélectionnées, telles qu’elles ont été lues. Le produit n’a pas de route
            d’export (décision A21) : rien n’est relu du serveur.
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onExport('csv')}>CSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('json')}>JSON</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('sql')}>INSERT SQL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editable && count > 0 && (
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={deleting}>
          <Trash2 className="size-4" />
          {deleting ? 'Suppression…' : `Supprimer ${count}`}
        </Button>
      )}
    </div>
  )
}
