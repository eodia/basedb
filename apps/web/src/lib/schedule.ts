/**
 * The schedule of an AI field, as a person builds it — chapter 04 §7 bis.
 *
 * The server holds a cron expression and nothing else: five fields, read in the author's
 * time zone. Nobody should have to write one to say « tous les lundis à 8 h », so the
 * screen offers the frequencies people mean and writes the expression for them — and
 * reads an existing one back into them when it can. What it cannot read back stays an
 * expression, shown as such: nothing is rounded to the nearest preset.
 *
 * The server is the judge of what is allowed (no more often than every 15 minutes, a date
 * that exists, a known zone); this file only builds and describes.
 */

export type Frequency = 'minutes' | 'hours' | 'days' | 'weekly' | 'monthly' | 'custom'

export interface ScheduleDraft {
  readonly frequency: Frequency
  /** Every N minutes, hours or days — for the three frequencies that have an N. */
  readonly every: number
  readonly hour: number
  readonly minute: number
  /** For `weekly`: 0 is Sunday, as in cron. */
  readonly weekdays: readonly number[]
  /** For `monthly`: 1 to 28, so that every month has it. */
  readonly dayOfMonth: number
  /** For `days` every day: Monday to Friday only. */
  readonly workdays: boolean
  /** For `custom`: the expression as typed. */
  readonly cron: string
}

/** The steps that divide an hour, a day: the others would drift at each boundary. */
export const MINUTE_STEPS = [15, 20, 30] as const
export const HOUR_STEPS = [1, 2, 3, 4, 6, 8, 12] as const
export const DAY_STEPS = [1, 2, 3, 5, 7, 10, 15] as const

/** Monday first, as a French week is read; the value is cron's. */
export const WEEKDAYS: ReadonlyArray<{
  readonly value: number
  readonly short: string
  readonly long: string
}> = [
  { value: 1, short: 'L', long: 'lundi' },
  { value: 2, short: 'M', long: 'mardi' },
  { value: 3, short: 'M', long: 'mercredi' },
  { value: 4, short: 'J', long: 'jeudi' },
  { value: 5, short: 'V', long: 'vendredi' },
  { value: 6, short: 'S', long: 'samedi' },
  { value: 0, short: 'D', long: 'dimanche' },
]

export const DEFAULT_SCHEDULE: ScheduleDraft = {
  frequency: 'days',
  every: 1,
  hour: 8,
  minute: 0,
  weekdays: [1],
  dayOfMonth: 1,
  workdays: false,
  cron: '0 8 * * *',
}

/** The zone of the person at the screen — the one « 8 h » means to them. */
export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** The expression a draft stands for. */
export function cronOf(draft: ScheduleDraft): string {
  const { minute, hour } = draft
  switch (draft.frequency) {
    case 'minutes':
      return `*/${draft.every} * * * *`
    case 'hours':
      return draft.every === 1 ? `${minute} * * * *` : `${minute} */${draft.every} * * *`
    case 'days':
      if (draft.every === 1) return `${minute} ${hour} * * ${draft.workdays ? '1-5' : '*'}`
      return `${minute} ${hour} */${draft.every} * *`
    case 'weekly': {
      const days = [...draft.weekdays].sort((a, b) => a - b)
      return `${minute} ${hour} * * ${days.length === 0 ? '1' : days.join(',')}`
    }
    case 'monthly':
      return `${minute} ${hour} ${draft.dayOfMonth} * *`
    case 'custom':
      return draft.cron.trim().split(/\s+/).join(' ')
  }
}

const int = (text: string, min: number, max: number): number | null => {
  if (!/^\d+$/.test(text)) return null
  const n = Number(text)
  return n >= min && n <= max ? n : null
}

/**
 * The draft an expression reads as — a preset when it is one, `custom` otherwise. Built
 * so that `cronOf(draftOf(x))` gives `x` back for every preset it recognizes.
 */
export function draftOf(cron: string | null | undefined): ScheduleDraft {
  const text = (cron ?? '').trim().split(/\s+/).join(' ')
  const custom: ScheduleDraft = { ...DEFAULT_SCHEDULE, frequency: 'custom', cron: text }
  const parts = text.split(' ')
  if (parts.length !== 5) return custom
  const [m, h, dom, mon, dow] = parts
  if (mon !== '*') return custom

  const step = (field: string) => /^\*\/(\d+)$/.exec(field)?.[1]
  const minute = int(m, 0, 59)
  const hour = int(h, 0, 23)

  // */N * * * *
  const everyMinutes = step(m)
  if (everyMinutes !== undefined && h === '*' && dom === '*' && dow === '*') {
    const n = Number(everyMinutes)
    return (MINUTE_STEPS as readonly number[]).includes(n)
      ? { ...DEFAULT_SCHEDULE, frequency: 'minutes', every: n }
      : custom
  }
  if (minute === null) return custom

  // M * * * *  and  M */N * * *
  if (dom === '*' && dow === '*' && (h === '*' || step(h) !== undefined)) {
    const n = h === '*' ? 1 : Number(step(h))
    return (HOUR_STEPS as readonly number[]).includes(n)
      ? { ...DEFAULT_SCHEDULE, frequency: 'hours', every: n, minute }
      : custom
  }
  if (hour === null) return custom

  // M H * * *  and  M H * * 1-5
  if (dom === '*' && (dow === '*' || dow === '1-5')) {
    return {
      ...DEFAULT_SCHEDULE,
      frequency: 'days',
      every: 1,
      hour,
      minute,
      workdays: dow === '1-5',
    }
  }
  // M H */N * *
  const everyDays = step(dom)
  if (everyDays !== undefined && dow === '*') {
    const n = Number(everyDays)
    return (DAY_STEPS as readonly number[]).includes(n) && n > 1
      ? { ...DEFAULT_SCHEDULE, frequency: 'days', every: n, hour, minute }
      : custom
  }
  // M H * * 1,3,5
  if (dom === '*' && /^[0-6](,[0-6])*$/.test(dow)) {
    const weekdays = [...new Set(dow.split(',').map(Number))].sort((a, b) => a - b)
    // Written back sorted: only an expression already sorted reads as this preset.
    if (weekdays.join(',') !== dow) return custom
    return { ...DEFAULT_SCHEDULE, frequency: 'weekly', weekdays, hour, minute }
  }
  // M H D * *
  const day = int(dom, 1, 28)
  if (day !== null && dow === '*') {
    return { ...DEFAULT_SCHEDULE, frequency: 'monthly', dayOfMonth: day, hour, minute }
  }
  return custom
}

const time = (hour: number, minute: number) => `${hour} h ${String(minute).padStart(2, '0')}`

const list = (words: readonly string[]) =>
  words.length <= 1
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} et ${words[words.length - 1]}`

/** The draft in a sentence, as the person would have said it. */
export function describe(draft: ScheduleDraft): string {
  switch (draft.frequency) {
    case 'minutes':
      return `Toutes les ${draft.every} minutes`
    case 'hours':
      return draft.every === 1
        ? `Toutes les heures, à la minute ${draft.minute}`
        : `Toutes les ${draft.every} heures, à ${time(0, draft.minute)} puis ${time(draft.every, draft.minute)}, ${time(2 * draft.every, draft.minute)}…`
    case 'days':
      if (draft.every === 1) {
        return draft.workdays
          ? `Du lundi au vendredi à ${time(draft.hour, draft.minute)}`
          : `Tous les jours à ${time(draft.hour, draft.minute)}`
      }
      return `Tous les ${draft.every} jours à ${time(draft.hour, draft.minute)} (le compte repart le 1er du mois)`
    case 'weekly': {
      const names = WEEKDAYS.filter((d) => draft.weekdays.includes(d.value)).map((d) => d.long)
      return `Chaque ${list(names.length === 0 ? ['lundi'] : names)} à ${time(draft.hour, draft.minute)}`
    }
    case 'monthly':
      return `Le ${draft.dayOfMonth === 1 ? '1er' : draft.dayOfMonth} de chaque mois à ${time(draft.hour, draft.minute)}`
    case 'custom':
      return 'Expression cron personnalisée'
  }
}

/** How many recomputations a day this makes, about — `null` for an expression. */
export function runsPerDay(draft: ScheduleDraft): number | null {
  switch (draft.frequency) {
    case 'minutes':
      return 1440 / draft.every
    case 'hours':
      return 24 / draft.every
    case 'days':
      return draft.every === 1 ? (draft.workdays ? 5 / 7 : 1) : 1 / draft.every
    case 'weekly':
      return Math.max(draft.weekdays.length, 1) / 7
    case 'monthly':
      return 1 / 30
    case 'custom':
      return null
  }
}

/** « 1 recalcul par jour », « 4 recalculs par semaine », « 1 recalcul par mois ». */
export function paceOf(draft: ScheduleDraft): string | null {
  const perDay = runsPerDay(draft)
  if (perDay === null) return null
  const say = (n: number, unit: string) => `${n} recalcul${n > 1 ? 's' : ''} par ${unit}`
  if (perDay >= 1) return say(Math.round(perDay), 'jour')
  if (perDay * 7 >= 1) return say(Math.round(perDay * 7), 'semaine')
  return say(Math.max(1, Math.round(perDay * 30)), 'mois')
}
