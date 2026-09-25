/**
 * Dates as a person types and reads them, and as the API holds them.
 *
 * On screen a date is DAY first — `25/09/2026`, `25/09/2026 14:30` — the reading of the
 * people this product is written for. On the wire a `date` is a calendar day
 * (`2026-09-25`) and a `datetime` an instant in UTC (`2026-09-25T12:30:00.000Z`), which
 * the screen shows in the reader's own time.
 *
 * A day is never carried as a `Date` here except at the edges: a `Date` is an instant,
 * and an instant read in another zone is another day.
 */

export type DateKind = 'date' | 'datetime'

export const isDateKind = (kind: string): kind is DateKind => kind === 'date' || kind === 'datetime'

/** A calendar day, month counted from 1. */
export interface Day {
  readonly year: number
  readonly month: number
  readonly day: number
}

export interface Time {
  readonly hour: number
  readonly minute: number
  readonly second: number
}

/** What a field holds, read: a day, and the time of day when one was given. */
export interface Moment {
  readonly day: Day
  readonly time: Time | null
}

const MIDNIGHT: Time = { hour: 0, minute: 0, second: 0 }

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** A real calendar day: `30/02` is refused, not rolled into March. */
function dayOf(year: number, month: number, day: number): Day | null {
  const probe = new Date(year, month - 1, day)
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null
  }
  return { year, month, day }
}

/**
 * A two-digit year, in the century that puts it closest to today: typed in 2026, `30` is
 * 2030 and `85` is 1985. The calendar and the line under it show the reading at once,
 * so a wrong guess is seen before it is written.
 */
function fullYear(twoDigits: number, today: Date): number {
  const current = today.getFullYear()
  const year = Math.floor(current / 100) * 100 + twoDigits
  if (year > current + 50) return year - 100
  if (year <= current - 50) return year + 100
  return year
}

function yearOf(raw: string | undefined, today: Date): number {
  if (raw === undefined) return today.getFullYear()
  return raw.length === 2 ? fullYear(Number(raw), today) : Number(raw)
}

/**
 * `25/09/2026`, `25.9.26`, `25-09`, `25092026`, `250926`, `2509` and `2026-09-25`. Without
 * a year, the current one.
 */
export function parseDay(text: string, today: Date = new Date()): Day | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso !== null) return dayOf(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const slashed = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?$/.exec(text)
  if (slashed !== null) {
    return dayOf(yearOf(slashed[3], today), Number(slashed[2]), Number(slashed[1]))
  }

  // Digits only, as a numeric keypad types them: day, month, then the year if any.
  const packed = /^(\d{2})(\d{2})(\d{4}|\d{2})?$/.exec(text)
  if (packed !== null) {
    return dayOf(yearOf(packed[3], today), Number(packed[2]), Number(packed[1]))
  }
  return null
}

/** `14:30`, `14h30`, `14h`, `14`, `1430` and `14:30:15`. */
export function parseTime(text: string): Time | null {
  const match =
    /^(\d{1,2})(?:[:hH](\d{2})?(?::(\d{2}))?)?$/.exec(text) ?? /^(\d{2})(\d{2})$/.exec(text)
  if (match === null) return null
  const hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  const second = Number(match[3] ?? 0)
  if (hour > 23 || minute > 59 || second > 59) return null
  return { hour, minute, second }
}

/**
 * A typed text cut in two: the day, and what follows the first space — the time. The `à`
 * of « 25/09/2026 à 14:30 » is what a French speaker writes between them, and is dropped.
 */
export function splitTyped(text: string): { readonly day: string; readonly time: string } {
  const trimmed = text.trim()
  const space = trimmed.search(/\s/)
  if (space === -1) return { day: trimmed, time: '' }
  return {
    day: trimmed.slice(0, space),
    time: trimmed.slice(space).trim().replace(/^à\s*/i, ''),
  }
}

/** A typed text as a moment, or `null` when it does not read as one. */
export function parseTyped(text: string, today: Date = new Date()): Moment | null {
  const trimmed = text.trim()
  if (trimmed === '') return null

  // A whole instant, pasted as the API writes it.
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const parsed = Date.parse(trimmed)
    return Number.isNaN(parsed) ? null : momentOfDate(new Date(parsed))
  }

  const parts = splitTyped(trimmed)
  const day = parseDay(parts.day, today)
  if (day === null) return null
  if (parts.time === '') return { day, time: null }
  const time = parseTime(parts.time)
  return time === null ? null : { day, time }
}

export const formatDay = (day: Day) => `${pad(day.day)}/${pad(day.month)}/${pad(day.year, 4)}`

/** Seconds only when there are some: `14:30`, but `14:30:15` is not rounded away. */
export const formatTime = (time: Time) =>
  `${pad(time.hour)}:${pad(time.minute)}${time.second === 0 ? '' : `:${pad(time.second)}`}`

/** How a moment reads in a field of this kind: a `datetime` always shows its time. */
export function formatMoment(moment: Moment, kind: DateKind): string {
  if (kind === 'date') return formatDay(moment.day)
  return `${formatDay(moment.day)} ${formatTime(moment.time ?? MIDNIGHT)}`
}

/** The day at local midnight, for the calendar. */
export const dateOfDay = (day: Day) => new Date(day.year, day.month - 1, day.day)

export const dayOfDate = (date: Date): Day => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
})

/** An instant, read in the reader's own time. */
export const momentOfDate = (date: Date): Moment => ({
  day: dayOfDate(date),
  time: { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() },
})

/** A value as the API sends it, read — or `null` when it is not one. */
export function fromStored(raw: string, kind: DateKind): Moment | null {
  if (kind === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (match === null) return null
    const day = dayOf(Number(match[1]), Number(match[2]), Number(match[3]))
    return day === null ? null : { day, time: null }
  }
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : momentOfDate(new Date(parsed))
}

/** A moment as the API takes it. A `datetime` given no time is midnight, local. */
export function toStored(moment: Moment, kind: DateKind): string {
  const { day } = moment
  if (kind === 'date') return `${pad(day.year, 4)}-${pad(day.month)}-${pad(day.day)}`
  const time = moment.time ?? MIDNIGHT
  return new Date(
    day.year,
    day.month - 1,
    day.day,
    time.hour,
    time.minute,
    time.second,
  ).toISOString()
}

/** A stored value as it reads on screen; one that does not parse is shown as it is. */
export function displayStored(raw: string, kind: DateKind): string {
  const moment = fromStored(raw, kind)
  return moment === null ? raw : formatMoment(moment, kind)
}

/**
 * What a typed text writes: the API's own form, `null` for nothing. A text that reads as
 * no date goes through untouched — the server knows the column, and its refusal says why
 * better than a guess made here.
 */
export function storedFromText(text: string, kind: DateKind, today?: Date): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const moment = parseTyped(trimmed, today)
  return moment === null ? trimmed : toStored(moment, kind)
}

const LONG_DAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** « vendredi 25 septembre 2026 à 14:30 » — what was understood, in words. */
export function describe(moment: Moment, kind: DateKind): string {
  const day = LONG_DAY.format(dateOfDay(moment.day))
  return kind === 'date' ? day : `${day} à ${formatTime(moment.time ?? MIDNIGHT)}`
}
