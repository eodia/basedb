'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExportFormat } from '@/lib/export'
import { PAGE_SIZES } from '@/lib/store/workspace'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Download,
  Hash,
  Loader2,
  RefreshCw,
} from 'lucide-react'

/**
 * The bottom bar — page size, count, exports, refresh, pagination.
 *
 * There is NO jump to page N, and there will not be one: chapter 11 §1.2 states it
 * plainly — `offset` does not exist, a page is resumed from the `_id` the previous one
 * ended on. So the control offers "première", "précédente", "suivante" and nothing
 * else, because those are the three moves a cursor supports. A box to type a page number
 * into would be a control that cannot work.
 *
 * The total is absent until asked for. §1.1: `count` is not computed by default, a
 * button emits `count=exact`, and a capped result reads "100 000+" — never a rounded
 * number invented to fill the slot.
 */

interface Props {
  readonly rowCount: number
  readonly pageIndex: number
  readonly pageSize: number
  readonly hasNextPage: boolean
  readonly total: number | null
  readonly totalCapped: boolean
  readonly counting: boolean
  readonly loading: boolean
  /** False on a SQL tab: a result already knows its size, so there is nothing to count. */
  readonly countable: boolean
  readonly onPageSize: (size: number) => void
  readonly onFirst: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onRefresh: () => void
  readonly onCount: () => void
  readonly onExport: (format: ExportFormat) => void
}

const format = (n: number) => n.toLocaleString('fr-FR')

export function PaginationBar({
  rowCount,
  pageIndex,
  pageSize,
  hasNextPage,
  total,
  totalCapped,
  counting,
  loading,
  countable,
  onPageSize,
  onFirst,
  onPrevious,
  onNext,
  onRefresh,
  onCount,
  onExport,
}: Props) {
  const first = pageIndex * pageSize + 1
  const last = pageIndex * pageSize + rowCount

  return (
    <footer className="flex h-11 shrink-0 items-center gap-2 border-t bg-background px-4 text-xs">
      <span className="hidden text-muted-foreground sm:block">Lignes par page</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 tabular-nums">
            {pageSize}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[9rem]">
          <DropdownMenuRadioGroup
            value={String(pageSize)}
            onValueChange={(v) => onPageSize(Number(v))}
          >
            {PAGE_SIZES.map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)} className="tabular-nums">
                {size}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <span className="tabular-nums text-muted-foreground">
        {rowCount === 0 ? (
          'Aucune ligne'
        ) : (
          <>
            {format(first)}–{format(last)}
            {total !== null && (
              <>
                <span className="mx-1 opacity-40">/</span>
                {totalCapped ? '100 000+' : format(total)}
              </>
            )}
          </>
        )}
      </span>

      {countable && total === null && rowCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={onCount}
              disabled={counting}
            >
              {counting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Hash className="size-3.5" />
              )}
              Compter
            </Button>
          </TooltipTrigger>
          <TooltipContent>Calculer le nombre total de lignes</TooltipContent>
        </Tooltip>
      )}

      <div className="mx-1 h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" disabled={rowCount === 0}>
            <Download className="size-3.5" />
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Exporter la page</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onExport('csv')}>CSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('json')}>JSON</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('sql')}>INSERT SQL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Recharger"
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Recharger la page</TooltipContent>
      </Tooltip>

      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={onFirst}
        disabled={pageIndex === 0 || loading}
        aria-label="Première page"
      >
        <ChevronsLeft className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={onPrevious}
        disabled={pageIndex === 0 || loading}
        aria-label="Page précédente"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <span className="min-w-8 text-center tabular-nums text-muted-foreground">
        {pageIndex + 1}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={onNext}
        disabled={!hasNextPage || loading}
        aria-label="Page suivante"
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </footer>
  )
}
