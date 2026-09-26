import { BasedbError } from '../errors/index.js'

/**
 * When an AI field recomputes its rows — a cron expression, read in a time zone.
 *
 * Five fields, the classic ones: minute, hour, day of month, month, day of week. Each takes
 * `*`, a number, a range `a-b`, a list `a,b,c` and a step `*\/n` or `a-b/n`; a day of week
 * is 0–7, Sunday being both 0 and 7. When both days are restricted, a day matching EITHER
 * matches — the rule every cron has, and the one people expect from `0 8 1 * 1`.
 *
 * Read in the author's time zone, not the server's: « tous les jours à 8 h » means 8 h
 * where the person is, summer and winter alike.
 */

/** The shortest gap allowed between two recomputations: each is one call per row. */
export const MIN_INTERVAL_MINUTES = 15

export interface Cron {
  readonly minute: ReadonlySet<number>
  readonly hour: ReadonlySet<number>
  readonly day: ReadonlySet<number>
  readonly month: ReadonlySet<number>
  readonly weekday: ReadonlySet<number>
  /** Whether the day of month / of week were restricted — for the either-or rule. */
  readonly dayRestricted: boolean
  readonly weekdayRestricted: boolean
}

function invalid(reason: string, detail?: string): BasedbError {
  return new BasedbError('REQUEST_INVALID', {
    details: { field: 'refresh', reason, ...(detail === undefined ? {} : { detail }) },
  })
}

function parseField(text: string, min: number, max: number, name: string): Set<number> {
  const values = new Set<number>()
  for (const part of text.split(',')) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part)
    if (match === null) throw invalid('cron_invalide', `${name} : « ${part} »`)
    const [, range, stepText] = match
    const step = stepText === undefined ? 1 : Number(stepText)
    if (step < 1) throw invalid('cron_invalide', `${name} : pas nul`)

    let from = min
    let to = max
    if (range !== '*') {
      const [a, b] = range.split('-').map(Number)
      from = a
      to = b ?? (stepText === undefined ? a : max)
    }
    if (from < min || to > max || from > to) {
      throw invalid('cron_invalide', `${name} : hors de ${min}–${max}`)
    }
    for (let v = from; v <= to; v += step) values.add(v)
  }
  return values
}

/** Parses a five-field expression, or refuses it with what is wrong. */
export function parseCron(expression: string): Cron {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw invalid('cron_invalide', 'cinq champs attendus')
  const [minute, hour, day, month, weekday] = fields
  const weekdays = parseField(weekday, 0, 7, 'jour de semaine')
  // Sunday is 0 and 7: fold 7 onto 0 so one lookup serves both.
  if (weekdays.has(7)) {
    weekdays.delete(7)
    weekdays.add(0)
  }
  return {
    minute: parseField(minute, 0, 59, 'minute'),
    hour: parseField(hour, 0, 23, 'heure'),
    day: parseField(day, 1, 31, 'jour'),
    month: parseField(month, 1, 12, 'mois'),
    weekday: weekdays,
    dayRestricted: day !== '*',
    weekdayRestricted: weekday !== '*',
  }
}

/** Refuses a time zone the runtime does not know, rather than silently reading it as UTC. */
export function checkTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
  } catch {
    throw invalid('fuseau_inconnu', timezone)
  }
  return timezone
}

interface LocalParts {
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly weekday: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()
const WEEKDAYS: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** The wall-clock reading of an instant in a zone — what a cron field is compared to. */
function partsOf(instant: number, timezone: string): LocalParts {
  let format = formatters.get(timezone)
  if (format === undefined) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    })
    formatters.set(timezone, format)
  }
  const parts: Record<string, string> = {}
  for (const p of format.formatToParts(new Date(instant))) parts[p.type] = p.value
  return {
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  }
}

const MINUTE = 60_000

/**
 * The first instant strictly after `after` that the expression matches, in the zone.
 *
 * Walked forward with jumps — a day when the day does not match, an hour when the hour
 * does not — so a monthly schedule is found in a few hundred steps, not half a million.
 * Each step re-reads the wall clock from the instant, so a change of summer time is taken
 * as it comes. `null` for an expression no date satisfies within five years (`0 0 31 2 *`).
 */
export function nextRun(cron: Cron, timezone: string, after: Date): Date | null {
  let t = Math.floor(after.getTime() / MINUTE) * MINUTE + MINUTE
  const limit = after.getTime() + 5 * 366 * 24 * 60 * MINUTE
  while (t < limit) {
    const p = partsOf(t, timezone)
    const dayOk =
      cron.dayRestricted && cron.weekdayRestricted
        ? cron.day.has(p.day) || cron.weekday.has(p.weekday)
        : cron.day.has(p.day) && cron.weekday.has(p.weekday)
    if (!cron.month.has(p.month) || !dayOk) {
      t += ((23 - p.hour) * 60 + (60 - p.minute)) * MINUTE
      continue
    }
    if (!cron.hour.has(p.hour)) {
      t += (60 - p.minute) * MINUTE
      continue
    }
    if (!cron.minute.has(p.minute)) {
      t += MINUTE
      continue
    }
    return new Date(t)
  }
  return null
}

/** The next `count` runs after `from` — what a person checks before saving. */
export function nextRuns(cron: Cron, timezone: string, from: Date, count: number): Date[] {
  const runs: Date[] = []
  let cursor = from
  while (runs.length < count) {
    const next = nextRun(cron, timezone, cursor)
    if (next === null) break
    runs.push(next)
    cursor = next
  }
  return runs
}

/**
 * Validates a schedule as the catalog will hold it: a valid expression, a known zone, a
 * date that exists, and no two runs closer than {@link MIN_INTERVAL_MINUTES} — each run is
 * a call per row, and `* * * * *` on a thousand rows is a thousand calls a minute.
 */
export function checkSchedule(expression: string, timezone: string, now: Date): Cron {
  const cron = parseCron(expression)
  checkTimezone(timezone)
  const runs = nextRuns(cron, timezone, now, 6)
  if (runs.length === 0) throw invalid('cron_sans_date')
  for (let i = 1; i < runs.length; i++) {
    if (runs[i].getTime() - runs[i - 1].getTime() < MIN_INTERVAL_MINUTES * MINUTE) {
      throw invalid('frequence_trop_haute', `${MIN_INTERVAL_MINUTES} min au minimum`)
    }
  }
  return cron
}
