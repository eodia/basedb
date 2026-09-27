'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Input } from '@/components/ui/input'
import {
  type ColumnOption,
  UNIT_GROUPS,
  UNIT_LABELS,
  isNumeric,
  isTemporal,
} from '@/lib/analytics/model'
import { $t, intlLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Breakout, TemporalUnit } from '@basedb/contracts'
import { ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

/**
 * The columns of a query, to pick one — grouped by the table they come from, searched as
 * one types. A grouping picks a date's period or a number's bins beside it.
 */

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function ColumnList({
  columns,
  onPick,
  grouping = false,
  selected,
  autoFocus = true,
}: {
  readonly columns: readonly ColumnOption[]
  readonly onPick: (column: ColumnOption, how?: Pick<Breakout, 'unit' | 'bin'>) => void
  /** Offer a date's periods and a number's bins. */
  readonly grouping?: boolean
  readonly selected?: (column: ColumnOption) => boolean
  readonly autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const groups = useMemo(() => {
    const q = fold(query.trim())
    const out = new Map<string, ColumnOption[]>()
    for (const column of columns) {
      if (q !== '' && !fold(column.field.label).includes(q) && !fold(column.group).includes(q))
        continue
      out.set(column.group, [...(out.get(column.group) ?? []), column])
    }
    return [...out.entries()]
  }, [columns, query])

  const key = (c: ColumnOption) => `${c.ref.join ?? ''}.${c.ref.field}`

  return (
    <div className="flex max-h-[min(26rem,70vh)] flex-col">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={$t('Chercher une colonne')}
          aria-label={$t('Chercher une colonne')}
          className="h-8 pl-7 text-sm"
          autoFocus={autoFocus}
        />
      </div>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto scroll-discret">
        {groups.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">{$t('Aucune colonne.')}</p>
        )}
        {groups.map(([group, list]) => (
          <div key={group} className="mb-1">
            {groups.length > 1 && (
              <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group}
              </p>
            )}
            {list.map((column) => {
              const expandable = grouping && (isTemporal(column.kind) || isNumeric(column.kind))
              const expanded = open === key(column)
              return (
                <div key={key(column)}>
                  <div
                    className={cn(
                      'group flex items-center rounded-md hover:bg-accent',
                      selected?.(column) === true && 'bg-primary/10 text-primary',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onPick(column)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
                    >
                      <FieldIcon kind={column.field.kind} format={column.field.format?.display} />
                      <span className="truncate">{column.field.label}</span>
                    </button>
                    {expandable && (
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : key(column))}
                        className="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                        aria-expanded={expanded}
                      >
                        {isTemporal(column.kind) ? $t('par mois') : 'tranches'}
                        <ChevronRight
                          className={cn('size-3 transition-transform', expanded && 'rotate-90')}
                        />
                      </button>
                    )}
                  </div>
                  {expanded && isTemporal(column.kind) && (
                    <div className="mb-1 ml-7 grid grid-cols-2 gap-x-2">
                      {UNIT_GROUPS.map((g) => (
                        <div key={g.label} className="contents">
                          {g.units.map((unit: TemporalUnit) => (
                            <button
                              key={unit}
                              type="button"
                              onClick={() => onPick(column, { unit })}
                              className="rounded px-2 py-1 text-left text-xs hover:bg-accent"
                            >
                              {UNIT_LABELS[unit]}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {expanded && isNumeric(column.kind) && (
                    <div className="mb-1 ml-7 flex flex-col">
                      <button
                        type="button"
                        onClick={() => onPick(column, {})}
                        className="rounded px-2 py-1 text-left text-xs hover:bg-accent"
                      >
                        {$t('Chaque valeur')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onPick(column, { bin: 'auto' })}
                        className="rounded px-2 py-1 text-left text-xs hover:bg-accent"
                      >
                        {$t('Tranches automatiques')}
                      </button>
                      {[1, 10, 100, 1000].map((bin) => (
                        <button
                          key={bin}
                          type="button"
                          onClick={() => onPick(column, { bin })}
                          className="rounded px-2 py-1 text-left text-xs hover:bg-accent"
                        >
                          {$t('Tranches de {bin}', { bin: bin.toLocaleString(intlLocale()) })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
