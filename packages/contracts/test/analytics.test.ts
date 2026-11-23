import { describe, expect, it } from 'vitest'
import {
  parameterHasValue,
  periodExpression,
  resolveDateExpression,
  resultNames,
  sqlVariableNames,
} from '../src/analytics.js'

/**
 * The vocabulary of chapter 18 that both sides compute: what a date expression covers, what
 * a result's columns are called, which variables a SQL question asks for.
 */

// Wednesday 16 September 2026.
const TODAY = '2026-09-16'

describe('a date expression', () => {
  it('reads the current period, the past ones, the next ones', () => {
    expect(resolveDateExpression('today', TODAY)).toEqual({ start: TODAY, end: TODAY })
    expect(resolveDateExpression('thismonth', TODAY)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    })
    expect(resolveDateExpression('thisquarter', TODAY)).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    })
    expect(resolveDateExpression('past7days', TODAY)).toEqual({ start: '2026-09-10', end: TODAY })
    expect(resolveDateExpression('past3months', TODAY)).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    })
    expect(resolveDateExpression('lastmonth', TODAY)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    })
    expect(resolveDateExpression('last2years', TODAY)).toEqual({
      start: '2024-01-01',
      end: '2025-12-31',
    })
    expect(resolveDateExpression('next1week', TODAY)).toEqual({
      start: '2026-09-21',
      end: '2026-09-27',
    })
  })

  it('opens the week on the reader’s day', () => {
    expect(resolveDateExpression('thisweek', TODAY, 1)).toEqual({
      start: '2026-09-14',
      end: '2026-09-20',
    })
    expect(resolveDateExpression('thisweek', TODAY, 0)).toEqual({
      start: '2026-09-13',
      end: '2026-09-19',
    })
  })

  it('reads days, months, quarters, years and spans, open or not', () => {
    expect(resolveDateExpression('2026-02', TODAY)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
    expect(resolveDateExpression('2024-Q1', TODAY)).toEqual({
      start: '2024-01-01',
      end: '2024-03-31',
    })
    expect(resolveDateExpression('2025', TODAY)).toEqual({ start: '2025-01-01', end: '2025-12-31' })
    expect(resolveDateExpression('2026-01-05~2026-02', TODAY)).toEqual({
      start: '2026-01-05',
      end: '2026-02-28',
    })
    expect(resolveDateExpression('~2026-03-01', TODAY)).toEqual({ start: null, end: '2026-03-01' })
    expect(resolveDateExpression('2026-03-01~', TODAY)).toEqual({ start: '2026-03-01', end: null })
  })

  it('reads nothing into what it does not know', () => {
    for (const bad of ['', 'demain', 'past0days', '2026-13', '2026-02-30x', '~', 'x~2026-01-01']) {
      expect(resolveDateExpression(bad, TODAY), bad).toBeNull()
    }
  })

  it('names the period a grouped point stands for', () => {
    expect(periodExpression('2026-03-01', 'month')).toBe('2026-03')
    expect(periodExpression('2026-04-01', 'quarter')).toBe('2026-Q2')
    expect(periodExpression('2026-09-14', 'week')).toBe('2026-09-14~2026-09-20')
    expect(periodExpression('2026-09-14', 'day_of_week')).toBeNull()
  })
})

describe('a result', () => {
  it('names its columns from what they group and compute, once each', () => {
    expect(
      resultNames({
        breakouts: [
          { field: 'jour', unit: 'year' },
          { field: 'jour', unit: 'month' },
          { join: 'c', field: 'ville' },
        ],
        aggregations: [
          { fn: 'count' },
          { fn: 'sum', column: { field: 'montant' } },
          { fn: 'count' },
        ],
      }),
    ).toEqual({
      breakouts: ['jour', 'jour#2', 'c.ville'],
      aggregations: ['count', 'sum:montant', 'count#2'],
    })
  })

  it('finds its variables in a SQL text', () => {
    expect(sqlVariableNames('WHERE {{a}} AND x = {{ b }} [[AND {{a}}]]')).toEqual(['a', 'b'])
  })
})

describe('a filter’s value', () => {
  it('says nothing as an empty text, an empty list, a list of nothing', () => {
    expect(parameterHasValue('  ')).toBe(false)
    expect(parameterHasValue([])).toBe(false)
    expect(parameterHasValue([null, null])).toBe(false)
    expect(parameterHasValue([null, 3])).toBe(true)
    expect(parameterHasValue(['fait'])).toBe(true)
  })
})
