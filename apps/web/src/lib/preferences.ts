/**
 * How dates read for the person signed in — chapter 11 §10: the order of a date's parts,
 * and the day a week opens on.
 *
 * Held here, outside React, and read by the formatters at the moment they run: a date is
 * formatted in a hundred places, from a grid cell to a calendar header, and threading a
 * preference through each of them would make every one of them a place to forget it.
 * A screen showing dates is remounted when one comes back to it from the settings, so it
 * reads the new value then.
 *
 * The account holds them, not the browser: someone who changes computers finds their
 * dates as they left them. The theme stays with the browser (`theme.ts`), because
 * « suivre le système » depends on the device.
 */

/** `dmy`: 25/09/2026, the reading the product is written for; `iso`: 2026-09-25. */
export type DateFormat = 'dmy' | 'iso'
/** The first day of a calendar week: 1 Monday, 0 Sunday — as `Date.getDay()` counts. */
export type WeekStart = 0 | 1

export interface DatePreferences {
  readonly dateFormat: DateFormat
  readonly weekStart: WeekStart
}

let current: DatePreferences = { dateFormat: 'dmy', weekStart: 1 }

/** Takes the signed-in account's preferences — at sign-in, and after each change. */
export function applyPreferences(preferences: DatePreferences): void {
  current = { dateFormat: preferences.dateFormat, weekStart: preferences.weekStart }
}

export const dateFormat = (): DateFormat => current.dateFormat
export const weekStart = (): WeekStart => current.weekStart
