'use client'

import { describeValue } from '@/components/app/analytics/parameters'
import { MarkdownView } from '@/components/app/markdown-text'
import { type Cite, RichTextView } from '@/components/app/rich-text-editor'
import { roles } from '@/lib/analytics/charts'
import {
  type FormatContext,
  fieldOfColumn,
  numberOptions,
  numberText,
  valueText,
} from '@/lib/analytics/format'
import { $t } from '@/lib/i18n'
import type {
  DashboardParameter,
  ParameterValue,
  QueryResult,
  Visualization,
} from '@basedb/contracts'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A dashboard's text as it reads — chapter 18 §2.1: its words, and in place of each value
 * it cites, `{{nom}}`, what that value is now. The dashboard and its shared page both read
 * a text so; each says where its values come from.
 */

/**
 * The value a question gives in a few words — what its « Nombre » shows: its first
 * measure, on its only row or its last; a result with no measure gives its first value.
 * `null` when there is no row.
 */
export function headlineText(
  result: QueryResult,
  visualization: Visualization,
  format: FormatContext,
): string | null {
  const { metrics } = roles(result, visualization.settings)
  const metric = metrics[0]
  const index = metric ?? result.columns.findIndex((c) => c.hidden !== true)
  // A measure reads on its last row — the only one, or the latest period; a value, on the first.
  const row = metric === undefined ? result.rows[0] : result.rows[result.rows.length - 1]
  const column = result.columns[index]
  if (row === undefined || column === undefined) return null
  const value = row[index]
  return typeof value === 'number'
    ? numberText(
        value,
        column,
        fieldOfColumn(format.base, column),
        numberOptions(visualization.settings),
      )
    : valueText(column, value, format)
}

/** A filter's value as a sentence cites it: the value alone, or `null` when it has none. */
export function filterText(
  parameter: DashboardParameter,
  value: ParameterValue | null | undefined,
  labels: ReadonlyMap<string, string> | undefined,
): string | null {
  if (parameter.type === 'text' && typeof value === 'string' && value !== '') return value
  return describeValue(parameter, value, labels)
}

/** A question a text cites, to run: again whenever `key` changes. */
export interface CitedRun {
  readonly name: string
  readonly key: string
  readonly run: (signal: AbortSignal) => Promise<QueryResult>
}

export type CitedResult =
  | { readonly result: QueryResult; readonly failed: false }
  | { readonly result: null; readonly failed: true }

/**
 * The results of the questions a text cites, by name. A name not there yet is being read;
 * a value read before stays shown while it is read again.
 */
export function useCitedResults(runs: readonly CitedRun[]): ReadonlyMap<string, CitedResult> {
  const [results, setResults] = useState<ReadonlyMap<string, CitedResult>>(new Map())
  const latest = useRef(runs)
  latest.current = runs
  const key = JSON.stringify(runs.map((r) => [r.name, r.key]))
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says what the text reads
  useEffect(() => {
    const controller = new AbortController()
    const set = (name: string, value: CitedResult) =>
      !controller.signal.aborted && setResults((m) => new Map(m).set(name, value))
    for (const r of latest.current) {
      r.run(controller.signal).then(
        (result) => set(r.name, { result, failed: false }),
        () => set(r.name, { result: null, failed: true }),
      )
    }
    return () => controller.abort()
  }, [key])
  return results
}

/**
 * What each cited value reads as: its words, `null` while it is read, `undefined` for a
 * name the text does not cite — left as written.
 */
export type CitedValue = (name: string) => string | null | undefined

/** `*`, `_` and their kin in a value are its own characters, not Markdown's. */
const literal = (text: string) => text.replace(/[\\`*_[\]<>|#~]/g, (c) => `\\${c}`)

/** A text of a dashboard, read: rich or Markdown, each value it cites in its place. */
export function TextBody({
  text,
  rich,
  value,
  className,
}: {
  readonly text: string
  readonly rich: boolean
  readonly value: CitedValue
  readonly className?: string
}) {
  const cite = useCallback<Cite>(
    (name) => {
      const shown = value(name)
      if (shown === undefined) return undefined
      if (shown === null) {
        return (
          <Loader2
            className="inline size-3 animate-spin align-baseline text-muted-foreground"
            aria-label={$t('Chargement…')}
          />
        )
      }
      return <span className="tabular-nums">{shown}</span>
    },
    [value],
  )
  if (rich) return <RichTextView html={text} cite={cite} className={className} />
  const source = text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (whole, name: string) => {
    const shown = value(name)
    return shown === undefined ? whole : shown === null ? '…' : literal(shown)
  })
  return <MarkdownView source={source} className={className} />
}
