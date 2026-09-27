'use client'

import { ColumnList } from '@/components/app/analytics/column-picker'
import type { DrillEvent } from '@/components/app/analytics/visualization'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { valueText } from '@/lib/analytics/format'
import {
  UNIT_LABELS,
  breakoutOn,
  columnsOf,
  drillBy,
  drillFiner,
  drillKeep,
  drillRows,
  groupable,
} from '@/lib/analytics/model'
import type { DescribedBase } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { useMembers } from '@/lib/members'
import { weekStart } from '@/lib/preferences'
import type { BuilderQuery, VisualizationType } from '@basedb/contracts'
import { finerUnit } from '@basedb/contracts'
import { ChevronLeft, Filter, FilterX, LayoutDashboard, Rows3, Split, ZoomIn } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'

/**
 * A click on a point of a chart — chapter 18 §3.4: the rows behind it, a finer period,
 * another way to split it, the value kept alone or left out, the dashboard filtered by it.
 * Each leads to a question of its own, unsaved, the way back kept.
 */

export interface DashboardFilterAction {
  readonly label: string
  /** Said after it, quieter: how many cards it filters. */
  readonly hint?: string
  /** Offered but not possible — and why, in its hint. */
  readonly disabled?: boolean
  readonly apply: () => void
}

function Item({
  icon: Icon,
  children,
  hint,
  disabled = false,
  onClick,
}: {
  readonly icon: typeof Rows3
  readonly children: ReactNode
  readonly hint?: string
  readonly disabled?: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={typeof children === 'string' ? children : undefined}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint !== undefined && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
    </button>
  )
}

export function DrillMenu({
  base,
  query,
  event,
  onDrill,
  dashboardFilters = [],
  onClose,
}: {
  readonly base: DescribedBase
  /** A question built with the mouse: a SQL one has nothing to derive. */
  readonly query: BuilderQuery | null
  readonly event: DrillEvent
  readonly onDrill: (query: BuilderQuery, type?: VisualizationType) => void
  readonly dashboardFilters?: readonly DashboardFilterAction[]
  readonly onClose: () => void
}) {
  const members = useMembers()
  const [splitting, setSplitting] = useState(false)
  const start = weekStart()
  const point = event.point
  const single = point.values.length === 1 ? point.values[0] : undefined
  const temporal = point.values.find((v) => v.column.unit !== undefined)
  const finer = temporal?.column.unit === undefined ? null : finerUnit(temporal.column.unit)
  const title = point.values.map((v) => valueText(v.column, v.value, { base, members })).join(' · ')
  const go = (next: BuilderQuery | null, type?: VisualizationType) => {
    if (next === null) return
    onDrill(next, type)
    onClose()
  }
  const columns = query === null ? [] : columnsOf(base, query).filter((c) => groupable(c.kind))
  const { x, y } = event.at
  const anchor = useMemo(
    () => ({ current: { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) } }),
    [x, y],
  )

  return (
    <Popover modal open onOpenChange={(open) => !open && onClose()}>
      {/* The click itself, in the window: an element placed there would be moved by the
          transform of the grid's card that holds it. */}
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent className="w-72 p-1.5" align="start" sideOffset={4}>
        {splitting && query !== null ? (
          <div className="p-1">
            <button
              type="button"
              onClick={() => setSplitting(false)}
              className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> {$t('Répartir par…')}
            </button>
            <ColumnList
              grouping
              columns={columns}
              onPick={(c, how) =>
                go(
                  drillBy(
                    query,
                    point,
                    how === undefined ? breakoutOn(c) : { ...c.ref, ...how },
                    start,
                  ),
                )
              }
            />
          </div>
        ) : (
          <>
            <p
              className="truncate px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground"
              title={title}
            >
              {title}
            </p>
            {query !== null && (
              <>
                <Item icon={Rows3} onClick={() => go(drillRows(query, point, start), 'table')}>
                  {$t('Voir ces lignes')}
                </Item>
                {finer !== null && (
                  <Item icon={ZoomIn} onClick={() => go(drillFiner(query, point, start))}>
                    {$t('Détailler par {unitLabels}', { unitLabels: UNIT_LABELS[finer] })}
                  </Item>
                )}
                <Item icon={Split} onClick={() => setSplitting(true)}>
                  {$t('Répartir par…')}
                </Item>
                {single !== undefined && (
                  <>
                    <Item
                      icon={Filter}
                      onClick={() => go(drillKeep(query, single.column, single.value, true))}
                    >
                      {$t('Seulement cette valeur')}
                    </Item>
                    <Item
                      icon={FilterX}
                      onClick={() => go(drillKeep(query, single.column, single.value, false))}
                    >
                      {$t('Exclure cette valeur')}
                    </Item>
                  </>
                )}
              </>
            )}
            {dashboardFilters.map((action) => (
              <Item
                key={action.label}
                icon={LayoutDashboard}
                {...(action.hint === undefined ? {} : { hint: action.hint })}
                disabled={action.disabled === true}
                onClick={() => {
                  action.apply()
                  onClose()
                }}
              >
                {action.label}
              </Item>
            ))}
            {query === null && dashboardFilters.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {$t('Rien à explorer depuis une question SQL.')}
              </p>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
