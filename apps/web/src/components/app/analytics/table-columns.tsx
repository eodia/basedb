'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  type ColumnOption,
  chosenFields,
  reachableColumns,
  withJoinFor,
} from '@/lib/analytics/model'
import type { DescribedBase } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { type BuilderQuery, QUERY_LIMITS, columnName } from '@basedb/contracts'
import { ChevronDown, Search } from 'lucide-react'
import { type ReactNode, useId, useMemo, useState } from 'react'

/**
 * The columns one table gives a question that lists rows (chapter 18 §3): a chip that says
 * how many — « 3 sur 8 » — and the list to tick them in, « Toutes » or « Aucune » at the top.
 * With every column of the source ticked, the question chooses none: a column added to the
 * table later shows up by itself. A column of a related table ticked brings its join along,
 * and the join goes when its last column is unticked.
 */

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const keyOf = (column: ColumnOption) => columnName(column.ref)

export function TableColumns({
  base,
  query,
  label,
  icon,
  options,
  tone,
  onChange,
}: {
  readonly base: DescribedBase
  readonly query: BuilderQuery
  /** What the chip is called: the table's label. */
  readonly label: string
  readonly icon: ReactNode
  /** The columns of the table, or of the tables it stands for. */
  readonly options: readonly ColumnOption[]
  readonly tone: string
  readonly onChange: (query: BuilderQuery) => void
}) {
  const [search, setSearch] = useState('')
  const uid = useId()
  const reachable = useMemo(() => reachableColumns(base, query), [base, query])
  const chosen = useMemo(() => new Set(chosenFields(base, query).map(columnName)), [base, query])
  const on = (column: ColumnOption) => chosen.has(keyOf(column))
  const ticked = options.filter(on).length
  // The system columns count when ticked, not otherwise: they are not part of « all ».
  const total = options.filter((o) => o.field.system !== true || on(o)).length
  const all = ticked === total && options.every((o) => o.field.system === true || on(o))

  /** The question reading these columns — at least one, and no more than the kernel takes. */
  const apply = (keys: ReadonlySet<string>) => {
    const fields = reachable.filter((c) => keys.has(keyOf(c)))
    if (fields.length === 0 || fields.length > QUERY_LIMITS.fields) return
    let next = query
    for (const column of fields) next = withJoinFor(next, column)
    onChange({ ...next, fields: fields.map((c) => c.ref) })
  }
  const toggle = (column: ColumnOption) => {
    const keys = new Set(chosen)
    if (keys.has(keyOf(column))) keys.delete(keyOf(column))
    else keys.add(keyOf(column))
    apply(keys)
  }
  const businessKeys = options.filter((o) => o.field.system !== true).map(keyOf)
  const ownKeys = options.map(keyOf)
  const none = new Set([...chosen].filter((k) => !ownKeys.includes(k)))

  const q = fold(search.trim())
  const listed =
    q === '' ? options : options.filter((o) => fold(`${o.field.label} ${o.group}`).includes(q))
  const groups = [...new Set(listed.map((o) => o.group))]

  return (
    <Popover modal onOpenChange={(open) => !open && setSearch('')}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 max-w-full items-center gap-2 rounded-lg pr-2 pl-2.5 text-sm font-medium',
            tone,
          )}
        >
          {icon}
          <span className="truncate">{label}</span>
          <span className="shrink-0 text-xs font-normal opacity-70">
            {all ? $t('toutes') : $t('{count} sur {total}', { count: ticked, total })}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="space-y-2 border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={$t('Chercher une colonne')}
              aria-label={$t('Chercher une colonne')}
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 px-1 text-xs">
            <span className="flex-1 text-muted-foreground">
              {$tp(ticked, '{count} colonne affichée', '{count} colonnes affichées')}
            </span>
            <button
              type="button"
              className="font-medium text-primary hover:underline disabled:no-underline disabled:opacity-40"
              disabled={all}
              onClick={() => apply(new Set([...chosen, ...businessKeys]))}
            >
              {$t('Toutes')}
            </button>
            <button
              type="button"
              className="font-medium text-primary hover:underline disabled:no-underline disabled:opacity-40"
              disabled={ticked === 0 || none.size === 0}
              onClick={() => apply(none)}
            >
              {$t('Aucune')}
            </button>
          </div>
        </div>
        <div className="max-h-[340px] overflow-y-auto p-1 scroll-discret">
          {groups.map((group) => (
            <div key={group}>
              {groups.length > 1 && (
                <p className="px-2 pt-1.5 pb-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </p>
              )}
              {listed
                .filter((o) => o.group === group)
                .map((o) => (
                  <label
                    key={keyOf(o)}
                    htmlFor={`${uid}-${keyOf(o)}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={`${uid}-${keyOf(o)}`}
                      checked={on(o)}
                      onCheckedChange={() => toggle(o)}
                    />
                    <FieldIcon kind={o.field.kind} format={o.field.format?.display} />
                    <span className="truncate">{o.field.label}</span>
                  </label>
                ))}
            </div>
          ))}
          {listed.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {$t('Aucune colonne.')}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
