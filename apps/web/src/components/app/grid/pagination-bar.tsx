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
import { type TableRef, api } from '@/lib/api/client'
import { type ExportFormat, saveBlob } from '@/lib/export'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
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
import { useState } from 'react'
import { toast } from 'sonner'

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

/**
 * What "Exporter toute la vue" sends the server: the table, and the view's own filter (the
 * quick search included), sort and visible columns — the server reads every row they keep,
 * not the page.
 */
export interface ExportViewSpec {
  readonly table: TableRef
  readonly filter: string
  readonly sort: string
  readonly fields: readonly string[]
}

type WholeFormat = 'csv' | 'xlsx' | 'json'

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
  /** Absent on a SQL result, which is not a table: only the page exports there. */
  readonly exportView?: ExportViewSpec
}

const format = (n: number) => n.toLocaleString(intlLocale())

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
  exportView,
}: Props) {
  const first = pageIndex * pageSize + 1
  const last = pageIndex * pageSize + rowCount
  const [exporting, setExporting] = useState(false)

  /**
   * The whole view as a file. The server streams it; the browser holds the bytes until the
   * last one has come, then offers the file. A toast says it is under way — a long table
   * takes a while — and a refusal (too many rows, too many exports at once) is read there.
   */
  const exportWhole = (kind: WholeFormat) => {
    if (exportView === undefined || exporting) return
    setExporting(true)
    const done = api
      .exportView(exportView.table, {
        format: kind,
        filter: exportView.filter,
        sort: exportView.sort,
        fields: exportView.fields,
        // A workbook is read by a person: the labels. A CSV keeps the physical names, as
        // the page's CSV does — the ones that match the column in psql.
        headers: kind === 'xlsx' ? 'label' : 'name',
      })
      .then(({ blob, filename }) => {
        saveBlob(blob, filename ?? `${exportView.table.name}.${kind}`)
      })
      .finally(() => setExporting(false))
    toast.promise(done, {
      loading:
        total !== null && !totalCapped
          ? $tp(total, 'Export de {count} ligne en cours…', 'Export de {count} lignes en cours…')
          : $t('Export en cours…'),
      success: $t('Export terminé'),
      error: (e) => messageFor(e),
    })
  }

  return (
    // A CONTAINER query, not a window one: the panel on the right can be widened until the
    // grid is narrow in a wide window, and the label must give way to the buttons then.
    <footer className="@container flex h-11 shrink-0 items-center gap-2 border-t bg-background px-4 text-xs">
      <span className="hidden whitespace-nowrap text-muted-foreground @xl:block">
        {$t('Lignes par page')}
      </span>
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

      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
        {rowCount === 0 ? (
          $t('Aucune ligne')
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
              {$t('Compter')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{$t('Calculer le nombre total de lignes')}</TooltipContent>
        </Tooltip>
      )}

      <div className="mx-1 h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" disabled={rowCount === 0}>
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{$t('Exporter la page')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onExport('csv')}>{$t('CSV')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('json')}>{$t('JSON')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport('sql')}>INSERT SQL</DropdownMenuItem>
          {exportView !== undefined && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{$t('Exporter toute la vue')}</DropdownMenuLabel>
              <DropdownMenuItem disabled={exporting} onSelect={() => exportWhole('csv')}>
                {$t('CSV')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exporting} onSelect={() => exportWhole('xlsx')}>
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exporting} onSelect={() => exportWhole('json')}>
                {$t('JSON')}
              </DropdownMenuItem>
            </>
          )}
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
            aria-label={$t('Recharger')}
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{$t('Recharger la page')}</TooltipContent>
      </Tooltip>

      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={onFirst}
        disabled={pageIndex === 0 || loading}
        aria-label={$t('Première page')}
      >
        <ChevronsLeft className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={onPrevious}
        disabled={pageIndex === 0 || loading}
        aria-label={$t('Page précédente')}
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
        aria-label={$t('Page suivante')}
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </footer>
  )
}
