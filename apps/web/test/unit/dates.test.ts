import { describe, expect, it } from 'vitest'
import {
  describe as describeMoment,
  displayStored,
  formatMoment,
  fromStored,
  parseDay,
  parseTime,
  parseTyped,
  splitTyped,
  storedFromText,
  toStored,
} from '../../src/lib/dates'

/**
 * Dates typed day first, and the API's own forms. The reference day is fixed so that a
 * missing or two-digit year reads the same whenever the suite runs.
 */

const TODAY = new Date(2026, 8, 25)

describe('parseDay', () => {
  it.each([
    ['25/09/2026', { year: 2026, month: 9, day: 25 }],
    ['5/9/2026', { year: 2026, month: 9, day: 5 }],
    ['25.09.2026', { year: 2026, month: 9, day: 25 }],
    ['25-09-2026', { year: 2026, month: 9, day: 25 }],
    ['2026-09-25', { year: 2026, month: 9, day: 25 }],
    ['25092026', { year: 2026, month: 9, day: 25 }],
    ['250926', { year: 2026, month: 9, day: 25 }],
  ])('reads %s', (text, day) => {
    expect(parseDay(text, TODAY)).toEqual(day)
  })

  it('takes the current year when none is typed', () => {
    expect(parseDay('14/07', TODAY)).toEqual({ year: 2026, month: 7, day: 14 })
    expect(parseDay('1407', TODAY)).toEqual({ year: 2026, month: 7, day: 14 })
  })

  it('puts a two-digit year in the century closest to today', () => {
    expect(parseDay('01/01/30', TODAY)?.year).toBe(2030)
    expect(parseDay('12/05/85', TODAY)?.year).toBe(1985)
    expect(parseDay('12/05/76', TODAY)?.year).toBe(2076)
    expect(parseDay('12/05/77', TODAY)?.year).toBe(1977)
  })

  it('reads a slashed date DAY first', () => {
    expect(parseDay('05/09/2026', TODAY)).toEqual({ year: 2026, month: 9, day: 5 })
  })

  it('refuses a day the calendar does not have', () => {
    expect(parseDay('30/02/2026', TODAY)).toBeNull()
    expect(parseDay('29/02/2025', TODAY)).toBeNull()
    expect(parseDay('29/02/2024', TODAY)).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseDay('12/13/2026', TODAY)).toBeNull()
  })

  it('refuses what is not a date', () => {
    for (const text of ['', 'demain', '2026', '1/2/3', '25/09/2026x']) {
      expect(parseDay(text, TODAY)).toBeNull()
    }
  })
})

describe('parseTime', () => {
  it.each([
    ['14:30', { hour: 14, minute: 30, second: 0 }],
    ['14h30', { hour: 14, minute: 30, second: 0 }],
    ['14h', { hour: 14, minute: 0, second: 0 }],
    ['9', { hour: 9, minute: 0, second: 0 }],
    ['1430', { hour: 14, minute: 30, second: 0 }],
    ['14:30:15', { hour: 14, minute: 30, second: 15 }],
  ])('reads %s', (text, time) => {
    expect(parseTime(text)).toEqual(time)
  })

  it('refuses an hour the clock does not have', () => {
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('12:60')).toBeNull()
    expect(parseTime('midi')).toBeNull()
  })
})

describe('parseTyped', () => {
  it('reads a day and a time, with or without the « à » between them', () => {
    const expected = {
      day: { year: 2026, month: 9, day: 25 },
      time: { hour: 14, minute: 30, second: 0 },
    }
    expect(parseTyped('25/09/2026 14:30', TODAY)).toEqual(expected)
    expect(parseTyped('25/09/2026 à 14h30', TODAY)).toEqual(expected)
    expect(parseTyped('  25/09  14h30 ', TODAY)).toEqual(expected)
  })

  it('reads a day alone as having no time', () => {
    expect(parseTyped('25/09/2026', TODAY)?.time).toBeNull()
  })

  it('refuses a day followed by something that is not a time', () => {
    expect(parseTyped('25/09/2026 midi', TODAY)).toBeNull()
  })

  it('splits the day from the time', () => {
    expect(splitTyped('25/09/2026 à 14:30')).toEqual({ day: '25/09/2026', time: '14:30' })
    expect(splitTyped('25/09/2026')).toEqual({ day: '25/09/2026', time: '' })
  })
})

describe('the API forms', () => {
  it('writes a date as its calendar day, whatever the zone', () => {
    expect(storedFromText('25/09/2026', 'date', TODAY)).toBe('2026-09-25')
    expect(storedFromText('2509', 'date', TODAY)).toBe('2026-09-25')
    expect(storedFromText('25/09/2026 14:30', 'date', TODAY)).toBe('2026-09-25')
  })

  it('writes a datetime as the instant typed in local time', () => {
    const stored = storedFromText('25/09/2026 14:30', 'datetime', TODAY)
    expect(stored).toBe(new Date(2026, 8, 25, 14, 30).toISOString())
  })

  it('writes a datetime given no time as local midnight', () => {
    expect(storedFromText('25/09/2026', 'datetime', TODAY)).toBe(
      new Date(2026, 8, 25).toISOString(),
    )
  })

  it('writes nothing for an empty text, and hands an unreadable one to the server', () => {
    expect(storedFromText('   ', 'date', TODAY)).toBeNull()
    expect(storedFromText(' 32/13 ', 'date', TODAY)).toBe('32/13')
  })

  it('reads a stored date without shifting it through a zone', () => {
    expect(fromStored('2026-01-01', 'date')).toEqual({
      day: { year: 2026, month: 1, day: 1 },
      time: null,
    })
    expect(displayStored('2026-01-01', 'date')).toBe('01/01/2026')
  })

  it('shows a stored instant in local time, and back again', () => {
    const instant = new Date(2026, 8, 25, 9, 5).toISOString()
    expect(displayStored(instant, 'datetime')).toBe('25/09/2026 09:05')
    const moment = parseTyped(displayStored(instant, 'datetime'), TODAY)
    expect(moment === null ? null : toStored(moment, 'datetime')).toBe(instant)
  })

  it('keeps the seconds an instant has, rather than rounding them away', () => {
    const instant = new Date(2026, 8, 25, 9, 5, 7).toISOString()
    expect(displayStored(instant, 'datetime')).toBe('25/09/2026 09:05:07')
  })

  it('shows as it is a value that does not parse', () => {
    expect(displayStored('pas une date', 'date')).toBe('pas une date')
  })
})

describe('reading back what was understood', () => {
  it('names the day in French', () => {
    const moment = { day: { year: 2026, month: 9, day: 25 }, time: null }
    expect(describeMoment(moment, 'date')).toBe('vendredi 25 septembre 2026')
    expect(formatMoment(moment, 'datetime')).toBe('25/09/2026 00:00')
    expect(
      describeMoment({ ...moment, time: { hour: 14, minute: 30, second: 0 } }, 'datetime'),
    ).toBe('vendredi 25 septembre 2026 à 14:30')
  })
})
