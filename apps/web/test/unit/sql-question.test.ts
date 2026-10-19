import { describe, expect, it } from 'vitest'
import { givenUpBySwitching, hasSteps, runsInConsole } from '../../src/lib/analytics/question-mode'
import { queryResultOfSql, wroteData } from '../../src/lib/analytics/sql-result'
import type { SqlResult } from '../../src/lib/api/client'
import { questionOfSqlTab } from '../../src/lib/store/workspace'

/**
 * A question written in SQL — chapter 11 §1.7 and chapter 18 §1: run as a draft by whoever
 * manages the base, it keeps the console's reach and its result is read like a question's;
 * saved, it is read only. And what changing the editor's mode gives up.
 */

const result = (over: Partial<SqlResult> = {}): SqlResult => ({
  columns: [],
  rows: [],
  row_count: 0,
  command: 'SELECT',
  duration_ms: 3,
  truncated: false,
  schema: 'b_demo',
  mode: 'console',
  ...over,
})

describe('the result of a statement run in the console', () => {
  it('reads as a question’s: typed columns, rows as lists, numbers as numbers', () => {
    const read = queryResultOfSql(
      result({
        columns: [
          { name: 'statut', dataType: 'text' },
          { name: 'total', dataType: 'bigint' },
          { name: 'le', dataType: 'timestamp with time zone' },
          { name: 'ok', dataType: 'boolean' },
          { name: 'doc', dataType: 'jsonb' },
        ],
        rows: [
          { statut: 'fait', total: '12', le: '2026-03-01T10:00:00.000Z', ok: true, doc: { a: 1 } },
          { statut: null, total: null, le: null, ok: false, doc: null },
        ],
        row_count: 2,
        duration_ms: 8,
      }),
    )
    expect(read.columns.map((c) => [c.name, c.type, c.role])).toEqual([
      ['statut', 'text', 'dimension'],
      ['total', 'number', 'metric'],
      ['le', 'datetime', 'dimension'],
      ['ok', 'boolean', 'dimension'],
      ['doc', 'json', 'dimension'],
    ])
    expect(read.rows).toEqual([
      ['fait', 12, '2026-03-01T10:00:00.000Z', true, { a: 1 }],
      [null, null, null, false, null],
    ])
    expect(read).toMatchObject({ truncated: false, duration_ms: 8 })
  })

  it('keeps both values of a column name used twice', () => {
    const read = queryResultOfSql(
      result({
        columns: [
          { name: 'a', dataType: 'integer' },
          { name: 'a', dataType: 'integer' },
        ],
        rows: [{ a: 1, a__1: 2 }],
      }),
    )
    expect(read.rows).toEqual([[1, 2]])
  })

  it('says whether the statement wrote', () => {
    expect(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'insert'].every(wroteData)).toBe(true)
    expect(['SELECT', 'SHOW', 'EXPLAIN'].some(wroteData)).toBe(false)
    // A statement that wrote nothing returns no column at all.
    expect(queryResultOfSql(result({ command: 'UPDATE', row_count: 3 })).columns).toEqual([])
  })
})

describe('the editor’s mode', () => {
  const built = { kind: 'builder' as const, source: 't-clients' }

  it('gives up nothing on a question with only its table, or none at all', () => {
    expect(hasSteps(null)).toBe(false)
    expect(hasSteps(built)).toBe(false)
    expect(givenUpBySwitching(null)).toBeNull()
    expect(givenUpBySwitching(built)).toBeNull()
    expect(givenUpBySwitching({ kind: 'sql', sql: '  ' })).toBeNull()
  })

  it('asks before the steps of a built question, or a SQL text, are given up', () => {
    for (const steps of [
      {
        joins: [
          { alias: 'a', table: 't', kind: 'left' as const, left: { field: 'x' }, right: '_id' },
        ],
      },
      { filters: [{ column: { field: 'x' }, op: 'is' as const, values: ['1'] }] },
      { aggregations: [{ fn: 'count' as const }] },
      { breakouts: [{ field: 'x' }] },
      { fields: [{ field: 'x' }] },
      { sort: [{ target: { kind: 'column' as const, column: { field: 'x' } } }] },
      { limit: 10 },
    ]) {
      expect(givenUpBySwitching({ ...built, ...steps })).toBe('steps')
    }
    expect(givenUpBySwitching({ kind: 'sql', sql: 'SELECT 1' })).toBe('text')
  })
})

describe('where a SQL question runs', () => {
  const select = { kind: 'sql' as const, sql: 'DELETE FROM clients WHERE id = 1' }

  it('in the console for a draft of whoever manages the base — and nowhere else', () => {
    expect(runsInConsole(select, { saved: false, manages: true })).toBe(true)
    // Saved, it is shared: read only.
    expect(runsInConsole(select, { saved: true, manages: true })).toBe(false)
    // Whoever does not manage the base has no console.
    expect(runsInConsole(select, { saved: false, manages: false })).toBe(false)
    expect(runsInConsole(null, { saved: false, manages: true })).toBe(false)
    expect(runsInConsole({ kind: 'builder', source: 't' }, { saved: false, manages: true })).toBe(
      false,
    )
  })

  it('on the reader when the text has variables: it is made to be shared', () => {
    const withVariable = {
      kind: 'sql' as const,
      sql: 'SELECT * FROM clients WHERE ville = {{ville}}',
    }
    expect(runsInConsole(withVariable, { saved: false, manages: true })).toBe(false)
  })
})

describe('a SQL tab of an earlier version', () => {
  const tab = {
    id: 'tab-1',
    kind: 'sql',
    base: 'crm',
    table: null,
    label: 'Requête 1',
    draft: 'SELECT 1',
    queryId: null,
  }

  it('comes back as an unsaved SQL question holding its text', () => {
    expect(questionOfSqlTab(tab)).toMatchObject({
      id: 'tab-1',
      kind: 'question',
      draft: '',
      questionId: null,
      question: {
        id: null,
        label: 'Requête 1',
        query: { kind: 'sql', sql: 'SELECT 1' },
        visualization: null,
      },
    })
    expect(questionOfSqlTab(tab)).not.toHaveProperty('queryId')
  })

  it('keeps the identifier of a saved query — it is the question’s — and the text left in the tab', () => {
    const saved = questionOfSqlTab({ ...tab, queryId: 'q-1', draft: 'SELECT 2' })
    expect(saved).toMatchObject({
      kind: 'question',
      questionId: 'q-1',
      question: { id: 'q-1', query: { kind: 'sql', sql: 'SELECT 2' } },
    })
    // A saved query whose text was never touched is read again from the server.
    expect(questionOfSqlTab({ ...tab, queryId: 'q-1', draft: '' })).toMatchObject({
      questionId: 'q-1',
      question: null,
    })
  })

  it('leaves every other tab as it is', () => {
    const table = { id: 't', kind: 'table', base: 'crm', table: 'clients' }
    expect(questionOfSqlTab(table)).toBe(table)
    expect(questionOfSqlTab(null)).toBeNull()
  })
})
