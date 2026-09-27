import { BasedbError } from '../errors/index.js'

/**
 * The reader's time — where « today » is, and when a day starts. A question groups a
 * moment by the day it falls on for whoever looks, and « this month » is theirs: a reader
 * in Paris at 00:30 on the 1st is in the new month, the server in UTC is not yet.
 */

const zones = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = zones.get(timeZone)
  if (format === undefined) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    zones.set(timeZone, format)
  }
  return format
}

/** An IANA zone the runtime knows, `UTC` when none is given. */
export function validTimeZone(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'UTC'
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'timezone', reason: 'fuseau_inconnu' },
    })
  }
  try {
    formatter(value)
    return value
  } catch {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'timezone', reason: 'fuseau_inconnu' },
    })
  }
}

function partsOf(instant: number, timeZone: string) {
  const parts = formatter(timeZone).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Minutes the zone is ahead of UTC at an instant. */
function offsetAt(instant: number, timeZone: string): number {
  const p = partsOf(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000)
}

/** Today, `YYYY-MM-DD`, in the zone. */
export function todayIn(timeZone: string, now: number = Date.now()): string {
  const p = partsOf(now, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** The instant a day opens in the zone, as ISO 8601 in UTC. */
export function zonedMidnight(day: string, timeZone: string): string {
  const guess = Date.parse(`${day}T00:00:00Z`)
  const first = offsetAt(guess, timeZone)
  let instant = guess - first * 60_000
  // Across a change of offset the first guess is an hour off: take the offset in force then.
  const second = offsetAt(instant, timeZone)
  if (second !== first) instant = guess - second * 60_000
  return new Date(instant).toISOString()
}
