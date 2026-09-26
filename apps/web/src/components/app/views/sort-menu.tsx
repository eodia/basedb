'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Field } from '@/lib/api/client'
import { MAX_SORT_TERMS, type SortTerm } from '@/lib/store/workspace'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

/**
 * The sort of a view that has no column headers — a kanban's cards within a column, a
 * calendar's rows within a day. A grid sorts from its headers; everything else from here.
 * The terms themselves show as the toolbar's chips, where they are removed.
 */
export function SortMenu({
  fields,
  sorts,
  onChange,
}: {
  readonly fields: readonly Field[]
  readonly sorts: readonly SortTerm[]
  readonly onChange: (sorts: readonly SortTerm[]) => void
}) {
  const sortable = fields.filter((f) => f.sortable !== false)
  const full = sorts.length >= MAX_SORT_TERMS
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <ArrowUpDown className="size-3.5" />
          Trier
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {full ? 'Trois critères au plus : retirez-en un.' : 'Ajouter un critère de tri'}
        </DropdownMenuLabel>
        {sortable.map((field) => {
          const term = sorts.find((s) => s.field === field.name)
          return (
            <DropdownMenuItem
              key={field.name}
              disabled={full && term === undefined}
              onSelect={() =>
                onChange(
                  term === undefined
                    ? [...sorts, { field: field.name, direction: 'asc' }]
                    : sorts.map((s) =>
                        s.field === field.name
                          ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
                          : s,
                      ),
                )
              }
            >
              <FieldIcon kind={field.kind} />
              <span className="flex-1 truncate">{field.label}</span>
              {term !== undefined &&
                (term.direction === 'asc' ? (
                  <ArrowUp className="size-3.5 text-primary" />
                ) : (
                  <ArrowDown className="size-3.5 text-primary" />
                ))}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
