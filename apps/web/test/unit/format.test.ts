import { describe, expect, it } from 'vitest'
import type { Field } from '../../src/lib/api/client'
import {
  editText,
  formatDuration,
  formatNumber,
  formatOf,
  parseDuration,
  parseNumberInput,
} from '../../src/lib/format'
import { systemColumns } from '../../src/lib/grid'
import { arrangeFields, emptyView } from '../../src/lib/store/workspace'

/**
 * Display formats — chapter 04 §2.11: a number read as an amount, a percentage, a duration
 * or stars, and what a person types in that form read back into the number.
 */

const number = (format?: Field['format']): Field =>
  ({ name: 'n', label: 'N', kind: 'number', description: null, format }) as Field

/** Intl puts no-break spaces between thousands and before the symbol: compared as spaces. */
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('formatOf', () => {
  it('says decimal or plain when the field names no format', () => {
    expect(formatOf(number())).toBe('decimal')
    expect(formatOf({ kind: 'short_text' } as Field)).toBe('plain')
    expect(formatOf(number({ display: 'currency', currency: 'USD' }))).toBe('currency')
  })
})

describe('formatNumber', () => {
  it('reads an amount in its currency, the French way', () => {
    expect(plain(formatNumber('1234.5', number({ display: 'currency', currency: 'EUR' })))).toBe(
      '1 234,50 €',
    )
  })

  it('reads a percentage as the number it holds, not as a fraction', () => {
    expect(plain(formatNumber('12.5', number({ display: 'percent' })))).toBe('12,5 %')
  })

  it('reads a duration of seconds as h:mm', () => {
    expect(formatNumber('5400', number({ display: 'duration' }))).toBe('1:30')
    expect(formatNumber('3725', number({ display: 'duration' }))).toBe('1:02:05')
  })

  it('draws a rating as stars out of its maximum, clamped', () => {
    expect(formatNumber('3', number({ display: 'rating', rating_max: 5 }))).toBe('★★★☆☆')
    expect(formatNumber('9', number({ display: 'rating', rating_max: 3 }))).toBe('★★★')
  })

  it('rounds an integer and leaves what is no number as it came', () => {
    expect(formatNumber('41.6', number({ display: 'integer' }))).toBe('42')
    expect(formatNumber('abc', number({ display: 'integer' }))).toBe('abc')
  })
})

describe('durations', () => {
  it('reads what a person types for a duration', () => {
    expect(parseDuration('1:30')).toBe(5400)
    expect(parseDuration('1:30:15')).toBe(5415)
    expect(parseDuration('1h30')).toBe(5400)
    expect(parseDuration('2 h')).toBe(7200)
    expect(parseDuration('90 min')).toBe(5400)
    // A bare number in a duration is a number of minutes.
    expect(parseDuration('45')).toBe(2700)
    expect(parseDuration('30 s')).toBe(30)
    expect(parseDuration('bientôt')).toBeNull()
  })

  it('writes a negative duration with its sign', () => {
    expect(formatDuration(-90)).toBe('-0:01:30')
  })
})

describe('typing a number with its format', () => {
  it('opens the editor on what one would type', () => {
    expect(editText('1234.5000', number({ display: 'currency', currency: 'EUR' }))).toBe('1234,5')
    expect(editText('5400', number({ display: 'duration' }))).toBe('1:30')
    expect(editText(null, number())).toBe('')
  })

  it('reads the typed text back into the number it stands for', () => {
    const amount = number({ display: 'currency', currency: 'EUR' })
    expect(parseNumberInput('1 234,50 €', amount)).toBe(1234.5)
    expect(parseNumberInput('12,5 %', number({ display: 'percent' }))).toBe(12.5)
    expect(parseNumberInput('1:30', number({ display: 'duration' }))).toBe(5400)
    // What reads as no number goes to the server as typed, for its refusal to name.
    expect(parseNumberInput('douze', amount)).toBe('douze')
  })
})

describe('system columns in the grid', () => {
  const fields = [
    { name: 'nom', label: 'Nom', kind: 'short_text', description: null },
    { name: '_id', label: '_id', kind: 'system', description: null, system: true },
    { name: '_created_at', label: '_created_at', kind: 'system', description: null, system: true },
    { name: '_created_by', label: '_created_by', kind: 'system', description: null, system: true },
  ] as Field[]

  it('dresses them as read-only fields, and leaves the identifier out', () => {
    const shown = systemColumns(fields)
    expect(shown.map((f) => [f.name, f.label, f.kind, f.read_only])).toEqual([
      ['_created_at', 'Créé le', 'datetime', true],
      ['_created_by', 'Créé par', 'user', true],
    ])
  })

  it('hides them unless a view shows them, apart from the fields one hid', () => {
    const all = [fields[0] as Field, ...systemColumns(fields)]
    const byDefault = arrangeFields(all, emptyView())
    expect(byDefault.visible.map((f) => f.name)).toEqual(['nom'])
    expect(byDefault.hidden).toEqual([])
    expect(byDefault.systemHidden.map((f) => f.name)).toEqual(['_created_at', '_created_by'])

    const asked = arrangeFields(all, {
      ...emptyView(),
      hidden: ['nom'],
      systemColumns: ['_created_by'],
    })
    expect(asked.visible.map((f) => f.name)).toEqual(['_created_by'])
    expect(asked.hidden.map((f) => f.name)).toEqual(['nom'])
    expect(asked.systemHidden.map((f) => f.name)).toEqual(['_created_at'])
  })
})
