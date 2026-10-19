'use client'

import { JOIN_PICTOGRAMS, JoinGlyph } from '@/components/app/analytics/join-glyph'
import { TableList } from '@/components/app/analytics/table-picker'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import { Segmented } from '@/components/ui/segmented'
import {
  JOIN_LABELS,
  JOIN_SHORT,
  columnsOf,
  joinAlias,
  joinSentence,
  joinSuggestions,
  joinable,
  suggestedCondition,
  tableOf,
} from '@/lib/analytics/model'
import type { DescribedBase, Table } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import {
  type BuilderQuery,
  type ColumnRef,
  JOIN_KINDS,
  type Join,
  type JoinKind,
  columnName,
} from '@basedb/contracts'
import { ChevronDown, Table2 } from 'lucide-react'
import { useState } from 'react'

/**
 * A join the person writes (chapter 18 §3): the table, how rows meet — left, inner, right,
 * full, each drawn as the two circles it keeps — and the columns they meet on. The
 * condition the base's relations suggest is already there: « Lignes reliées quand A égale
 * B », where A may be a column of an earlier join as well as of the source.
 */

const KIND_OPTIONS = JOIN_KINDS.map((kind) => ({
  value: kind,
  label: kind,
  icon: JOIN_PICTOGRAMS[kind],
}))

export function JoinEditor({
  base,
  query,
  initial,
  onApply,
  onRemove,
}: {
  readonly base: DescribedBase
  readonly query: BuilderQuery
  /** The join being changed; absent for a new one. */
  readonly initial?: Join
  readonly onApply: (join: Join) => void
  readonly onRemove?: () => void
}) {
  const joins = query.joins ?? []
  const position =
    initial === undefined ? joins.length : joins.findIndex((j) => j.alias === initial.alias)
  // The query as this join sees it: the joins before it, written by hand.
  const earlier: BuilderQuery = {
    ...query,
    joins: joins
      .slice(0, position < 0 ? joins.length : position)
      .filter((j) => j.implicit !== true),
  }
  const source = tableOf(base, query.source)
  const [target, setTarget] = useState<Table | null>(
    initial === undefined ? null : (tableOf(base, initial.table) ?? null),
  )
  const [kind, setKind] = useState<JoinKind>(initial?.kind ?? 'left')
  const [left, setLeft] = useState<ColumnRef | null>(initial?.left ?? null)
  const [right, setRight] = useState<string | null>(initial?.right ?? null)

  if (target === null) {
    return (
      <div className="w-72">
        <TableList
          tables={base.tables}
          suggestions={joinSuggestions(base, earlier)}
          onPick={(table, suggestion) => {
            setTarget(table)
            const condition =
              suggestion === undefined ? suggestedCondition(base, earlier, table) : suggestion
            setLeft(condition?.left ?? null)
            setRight(condition?.right ?? null)
          }}
        />
      </div>
    )
  }

  const leftColumns = columnsOf(base, earlier).filter((c) => c.kind !== 'button')
  const leftColumn =
    left === null ? undefined : leftColumns.find((c) => columnName(c.ref) === columnName(left))
  const rightColumns = columnsOf(base, { kind: 'builder', source: target.id }).filter(
    (c) =>
      c.kind !== 'button' &&
      (c.field.name === right || leftColumn === undefined || joinable(leftColumn.kind, c.kind)),
  )
  const ready =
    leftColumn !== undefined && right !== null && rightColumns.some((c) => c.ref.field === right)
  const sourceLabel = source?.label ?? query.source
  // The condition may start from another join: its side is then named after that table.
  const leftTable = leftColumn?.table.label ?? sourceLabel

  return (
    <div className="w-[22rem] space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-1.5">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-sm font-semibold shadow-xs">
          <Table2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{sourceLabel}</span>
        </span>
        <JoinGlyph kind={kind} className="h-5 w-8 text-primary" />
        {initial === undefined ? (
          <button
            type="button"
            onClick={() => setTarget(null)}
            aria-label={$t('Changer de table')}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-left text-sm font-semibold shadow-xs hover:ring-1 hover:ring-primary/40"
          >
            <Table2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{target.label}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-sm font-semibold shadow-xs">
            <Table2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{target.label}</span>
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">{$t('Type de jointure')}</div>
        <Segmented
          value={kind}
          onValueChange={setKind}
          options={KIND_OPTIONS.map((o) => ({
            ...o,
            label: $t(JOIN_SHORT[o.value]),
            hint: $t(JOIN_LABELS[o.value]),
          }))}
          aria-label={$t('Type de jointure')}
        />
        <p className="text-xs text-muted-foreground">
          {joinSentence(kind, sourceLabel, target.label)}
        </p>
      </div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{$t('Lignes reliées quand')}</div>
        <div className="flex items-center gap-1.5 pt-0.5 text-xs font-medium">
          <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{leftTable}</span>
        </div>
        <Choice
          value={left === null ? null : columnName(left)}
          onValueChange={(name) => {
            const next = leftColumns.find((c) => columnName(c.ref) === name)
            setLeft(next?.ref ?? null)
            // A column of another family cannot be met: the other side is chosen anew.
            const current = rightColumns.find((c) => c.ref.field === right)
            if (next !== undefined && current !== undefined && !joinable(next.kind, current.kind))
              setRight(null)
          }}
          options={leftColumns.map((c) => ({ value: columnName(c.ref), label: c.label }))}
          placeholder={$t('Colonne de la source')}
          aria-label={$t('Colonne de la source')}
          className="w-full"
        />
        <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {$t('égale')}
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{target.label}</span>
        </div>
        <Choice
          value={right}
          onValueChange={setRight}
          options={rightColumns.map((c) => ({ value: c.ref.field, label: c.field.label }))}
          placeholder={$t('Colonne de {table}', { table: target.label })}
          aria-label={$t('Colonne de {table}', { table: target.label })}
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-2">
        {onRemove !== undefined && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
            {$t('Retirer')}
          </Button>
        )}
        <span className="flex-1" />
        <Button
          size="sm"
          disabled={!ready}
          onClick={() => {
            if (left === null || right === null) return
            onApply({
              alias: initial?.alias ?? joinAlias(query, target),
              table: target.id,
              kind,
              left,
              right,
            })
          }}
        >
          {initial === undefined ? $t('Joindre') : $t('Appliquer')}
        </Button>
      </div>
    </div>
  )
}
