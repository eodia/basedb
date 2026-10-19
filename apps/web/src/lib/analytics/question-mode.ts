import { type BuilderQuery, type QuestionQuery, sqlVariableNames } from '@basedb/contracts'

/**
 * The two ways to write a question — built with the mouse, or in SQL — which the editor's
 * switch moves between (chapter 18 §1.8): when going from one to the other costs the person
 * something, and how a SQL question is run. Pure, to be tested.
 */

/**
 * Whether a question built with the mouse holds more than its table: a join, a filter, a
 * summary, a choice of columns, a sort, a bound. A SQL text is not made of these — it does not
 * convert — so the person is asked before they are given up.
 */
export function hasSteps(query: BuilderQuery | null): boolean {
  if (query === null) return false
  return (
    (query.joins ?? []).length > 0 ||
    (query.filters ?? []).length > 0 ||
    (query.aggregations ?? []).length > 0 ||
    (query.breakouts ?? []).length > 0 ||
    (query.fields ?? []).length > 0 ||
    (query.sort ?? []).length > 0 ||
    (query.limit !== undefined && query.limit !== null)
  )
}

/** What changing mode throws away, if anything: the steps of a built question, or a SQL text. */
export function givenUpBySwitching(query: QuestionQuery | null): 'steps' | 'text' | null {
  if (query === null) return null
  if (query.kind === 'sql') return query.sql.trim() === '' ? null : 'text'
  return hasSteps(query) ? 'steps' : null
}

/**
 * Whether a SQL question runs in the console — with the console's reach: writes, several
 * statements. Only a draft does, and only for whoever manages the base's structure: what is
 * saved is shared, and a `DELETE` saved as a question would run the day someone opened it. A
 * text with variables is a question made to be shared, run as one: read only, on the reader.
 */
export function runsInConsole(
  query: QuestionQuery | null,
  options: { readonly saved: boolean; readonly manages: boolean },
): boolean {
  return (
    query?.kind === 'sql' &&
    !options.saved &&
    options.manages &&
    sqlVariableNames(query.sql).length === 0
  )
}
