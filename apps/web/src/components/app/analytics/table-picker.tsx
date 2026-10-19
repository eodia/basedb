'use client'

import { Input } from '@/components/ui/input'
import type { JoinSuggestion } from '@/lib/analytics/model'
import type { Table } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { Link2, Search, Table2 } from 'lucide-react'
import { useState } from 'react'

/**
 * The tables of a base, to pick one — searched as one types. For a join, the tables the
 * relations of the question lead to come first, each saying through which link: picking one
 * brings the condition that makes its rows meet.
 */

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function Heading({ children }: { readonly children: string }) {
  return (
    <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

export function TableList({
  tables,
  suggestions = [],
  onPick,
}: {
  readonly tables: readonly Table[]
  /** The joins the base's relations suggest, offered before the other tables. */
  readonly suggestions?: readonly JoinSuggestion[]
  readonly onPick: (table: Table, suggestion?: JoinSuggestion) => void
}) {
  const [query, setQuery] = useState('')
  const q = fold(query.trim())
  const matches = (label: string) => q === '' || fold(label).includes(q)
  const related = suggestions.filter((s) => matches(s.label) || matches(s.table.label))
  const shown = tables.filter((t) => matches(t.label))
  return (
    <div className="flex max-h-80 flex-col">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={$t('Chercher une table')}
          aria-label={$t('Chercher une table')}
          className="h-8 pl-7 text-sm"
          autoFocus
        />
      </div>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto scroll-discret">
        {related.length > 0 && (
          <div className="mb-1">
            <Heading>{$t('Tables liées')}</Heading>
            {related.map((s) => (
              <button
                key={`${s.table.id}:${s.left.join ?? ''}.${s.left.field}.${s.right}`}
                type="button"
                onClick={() => onPick(s.table, s)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        )}
        {shown.length > 0 && related.length > 0 && <Heading>{$t('Toutes les tables')}</Heading>}
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
        {shown.length === 0 && related.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted-foreground">{$t('Aucune table.')}</p>
        )}
      </div>
    </div>
  )
}
