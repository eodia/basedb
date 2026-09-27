import { describe, expect, it } from 'vitest'
import { checkBuilderQuery, filterExpression, niceWidth } from '../../src/analytics/query.js'
import { renderSql } from '../../src/analytics/sql.js'
import { todayIn, zonedMidnight } from '../../src/analytics/time.js'
import { buildFilter } from '../../src/records/filter.js'

/**
 * What a question built with the mouse becomes before it reaches PostgreSQL — chapter 18 §3:
 * filters in the grammar of chapter 08 §4, relative dates as days of the reader's zone, a
 * SQL question with its variables written in.
 */

const CLOCK = { today: '2026-09-16', timeZone: 'Europe/Paris', weekStart: 1 as const }

describe('a filter of the builder', () => {
  it('is an expression the grammar parses', () => {
    const columns = new Map([
      ['statut', { name: 'statut', kind: 'select' as const }],
      ['jour', { name: 'jour', kind: 'date' as const }],
      ['vu', { name: 'vu', kind: 'datetime' as const }],
      ['tags', { name: 'tags', kind: 'multi_select' as const }],
      ['nom', { name: 'nom', kind: 'short_text' as const }],
    ])
    const cases: Array<[string, string, Parameters<typeof filterExpression>[2]]> = [
      ['statut', 'select', { op: 'is', values: ['fait', 'a "b"'] }],
      ['statut', 'select', { op: 'is_not', values: ['fait'] }],
      ['statut', 'select', { op: 'empty', values: [] }],
      ['tags', 'multi_select', { op: 'is', values: ['urgent'] }],
      ['tags', 'multi_select', { op: 'has_none', values: ['urgent'] }],
      ['nom', 'short_text', { op: 'not_contains', values: ['x\\y'] }],
      ['jour', 'date', { op: 'date', values: ['thismonth'] }],
      ['jour', 'date', { op: 'date', values: ['2026-01-01~'] }],
      ['vu', 'datetime', { op: 'date', values: ['today'] }],
      ['vu', 'datetime', { op: 'after', values: ['2026-03-28'] }],
    ]
    for (const [name, kind, filter] of cases) {
      const text = filterExpression(name, kind, filter, CLOCK)
      expect(() => buildFilter(text, columns), text).not.toThrow()
    }
  })

  it('keeps the rows without a value when it excludes one', () => {
    expect(filterExpression('statut', 'select', { op: 'is_not', values: ['fait'] }, CLOCK)).toBe(
      '(not statut in ["fait"] or statut is_null)',
    )
  })

  it('reads a relative date as days, and a moment as the instants of the reader’s zone', () => {
    expect(filterExpression('jour', 'date', { op: 'date', values: ['thismonth'] }, CLOCK)).toBe(
      'jour between ["2026-09-01", "2026-09-30"]',
    )
    expect(filterExpression('vu', 'datetime', { op: 'date', values: ['today'] }, CLOCK)).toBe(
      '(vu gte "2026-09-15T22:00:00.000Z" and vu lt "2026-09-16T22:00:00.000Z")',
    )
  })

  it('asks for the value it needs', () => {
    expect(() =>
      filterExpression('nom', 'short_text', { op: 'contains', values: [] }, CLOCK),
    ).toThrow()
    expect(() =>
      filterExpression('jour', 'date', { op: 'date', values: ['hier'] }, CLOCK),
    ).toThrow()
  })
})

describe('a query received', () => {
  it('is refused when it cites a join it does not declare', () => {
    expect(() =>
      checkBuilderQuery({ source: 't', breakouts: [{ join: 'absent', field: 'x' }] }),
    ).toThrow()
    expect(() =>
      checkBuilderQuery({
        source: 't',
        joins: [{ alias: 'a', table: 'u', left: { join: 'b', field: 'x' }, right: '_id' }],
      }),
    ).toThrow()
  })

  it('keeps what it knows and bounds the rest', () => {
    expect(
      checkBuilderQuery({
        source: 't',
        limit: 1e9,
        breakouts: [{ field: 'jour', unit: 'month', extra: 1 }],
      }),
    ).toEqual({
      kind: 'builder',
      source: 't',
      breakouts: [{ field: 'jour', unit: 'month' }],
      limit: 2000,
    })
  })
})

describe('the bins of a number', () => {
  it('have a width that reads well', () => {
    expect(niceWidth(20, 100)).toBe(10)
    expect(niceWidth(0, 1234)).toBe(200)
    expect(niceWidth(5, 5)).toBe(1)
  })
})

describe('the reader’s zone', () => {
  it('knows when a day opens there, across a change of hour', () => {
    expect(zonedMidnight('2026-03-29', 'Europe/Paris')).toBe('2026-03-28T23:00:00.000Z')
    expect(zonedMidnight('2026-03-30', 'Europe/Paris')).toBe('2026-03-29T22:00:00.000Z')
    expect(zonedMidnight('2026-06-01', 'UTC')).toBe('2026-06-01T00:00:00.000Z')
  })

  it('knows which day it is there', () => {
    // 23:30 UTC on 16 September is already the 17th in Paris.
    expect(todayIn('Europe/Paris', Date.parse('2026-09-16T23:30:00Z'))).toBe('2026-09-17')
    expect(todayIn('UTC', Date.parse('2026-09-16T23:30:00Z'))).toBe('2026-09-16')
  })
})

describe('a SQL question', () => {
  const query = {
    kind: 'sql' as const,
    sql: 'SELECT * FROM t WHERE {{periode}} [[AND statut IN ({{statut}})]] AND n > {{seuil}}',
    variables: [
      {
        name: 'periode',
        label: 'Période',
        type: 'filter' as const,
        column: 'jour',
        column_kind: 'date' as const,
      },
      { name: 'statut', label: 'Statut', type: 'text' as const },
      { name: 'seuil', label: 'Seuil', type: 'number' as const, default: ['10'] as const },
    ],
  }

  it('reads TRUE for a filter without value, and drops the optional part', () => {
    expect(renderSql(query, new Map(), CLOCK)).toBe('SELECT * FROM t WHERE TRUE  AND n > 10')
  })

  it('writes its values as quoted literals', () => {
    const values = new Map([
      ['periode', { value: 'thismonth', type: 'date' as const }],
      ['statut', { value: ["a'b", 'c'], type: 'category' as const }],
      ['seuil', { value: [3, null], type: 'number' as const }],
    ])
    expect(renderSql(query, values, CLOCK)).toBe(
      "SELECT * FROM t WHERE ((jour) >= '2026-09-01' AND (jour) <= '2026-09-30') AND statut IN ('a''b', 'c') AND n > 3",
    )
  })

  it('refuses a number that is not one, and a required variable left empty', () => {
    expect(() =>
      renderSql(
        query,
        new Map([['seuil', { value: '1; DROP TABLE t', type: 'text' as const }]]),
        CLOCK,
      ),
    ).toThrow()
    expect(() =>
      renderSql(
        {
          kind: 'sql',
          sql: 'SELECT {{x}}',
          variables: [{ name: 'x', label: 'x', type: 'text', required: true }],
        },
        new Map(),
        CLOCK,
      ),
    ).toThrow()
  })
})
