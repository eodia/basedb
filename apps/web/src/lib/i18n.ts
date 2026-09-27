import {
  LOCALES,
  LOCALE_NAMES,
  type Locale,
  SOURCE_LOCALE,
  isLocale,
  matchLocale,
} from '@basedb/contracts'

/**
 * The interface in the reader's language — chapter 11 §10.
 *
 * Every text is written in French, in place, and handed to `$t`: the French sentence IS
 * the key. The page carries the messages of its language (`app/layout.tsx` puts them in
 * `window.__BASEDB_I18N__` before any script of the application runs), and `$t` reads
 * them; a sentence nobody has translated yet reads in French rather than not at all.
 *
 * The language does not change while a page lives: choosing another one reloads it. That
 * is what lets a table of labels call `$t` once, when its module loads.
 */

/** A message: a sentence, or one per plural category of the language (CLDR). */
export type Message = string | Readonly<Partial<Record<Intl.LDMLPluralRule, string>>>

export type Messages = Readonly<Record<string, Message>>

interface Loaded {
  readonly locale: Locale
  readonly messages: Messages
}

declare global {
  interface Window {
    __BASEDB_I18N__?: Loaded
  }
}

const SOURCE: Loaded = { locale: SOURCE_LOCALE, messages: {} }

/** What the page was served with — French, on the server and before the layout's script. */
function loaded(): Loaded {
  if (typeof window === 'undefined') return SOURCE
  return window.__BASEDB_I18N__ ?? SOURCE
}

/** The language of the page. */
export const locale = (): Locale => loaded().locale

/** The tag `Intl` formats numbers and dates with. */
export const intlLocale = (): string => loaded().locale

/** Values given to a message: `{name}` in its text is replaced by `values.name`. */
export type Values = Readonly<Record<string, string | number | boolean | null | undefined>>

/** A value as a sentence shows it: nothing for `false`, as JSX shows `{cond && 'text'}`. */
function valueText(value: Values[string]): string {
  return value === null || value === undefined || value === false ? '' : String(value)
}

function interpolate(text: string, values: Values | undefined): string {
  if (values === undefined) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? valueText(values[name]) : whole,
  )
}

/**
 * A French sentence in the reader's language. `{name}` in the sentence is replaced by
 * `values.name` — in every language, since the translation keeps the same names:
 * `$t('Nouveau champ dans {table}', { table: table.label })`.
 *
 * A `{name}` with no value is left as it is: `{{Ville}}`, a variable written in a text
 * shown as an example, stays readable.
 */
export function $t(french: string, values?: Values): string {
  const message = loaded().messages[french]
  if (message === undefined) return interpolate(shown(french), values)
  const text = typeof message === 'string' ? message : (message.other ?? shown(french))
  return interpolate(sameEdges(shown(french), text), values)
}

/**
 * One French word, two meanings: « Moyenne » is an average and a medium row height, and
 * other languages say them apart. The key then carries its meaning after `||` —
 * `$t('Moyenne||hauteur de ligne')` —, which French does not show and a translator reads.
 */
const CONTEXT = '||'

function shown(french: string): string {
  const at = french.indexOf(CONTEXT)
  return at === -1 ? french : french.slice(0, at)
}

/**
 * The spaces around a sentence are the code's — `$t('Ligne {row} : ') + reason` —, not
 * the translator's: a translation keeps those of the French.
 */
function sameEdges(french: string, text: string): string {
  const lead = /^\s*/.exec(french)?.[0] ?? ''
  const trail = /\s*$/.exec(french)?.[0] ?? ''
  return `${lead}${text.trim()}${trail}`
}

/**
 * A French text translated where it is SHOWN, not where it is written: a status that is
 * also a key, a group name the server stores. `msg` only marks it for the catalog
 * (`tooling/i18n/extract.mjs`); the display calls `$t` on the value.
 */
export const msg = <T extends string>(french: T): T => french

/** The two groups every tenant has, named in French by the server (`admin/groups.ts`). */
const SYSTEM_GROUPS: ReadonlySet<string> = new Set([
  msg('Administrateurs'),
  msg('Tous les utilisateurs'),
])

/** A group's name as the reader reads it: the system groups in their language. */
export const groupName = (label: string): string => (SYSTEM_GROUPS.has(label) ? $t(label) : label)

const rules = new Map<string, Intl.PluralRules>()
function pluralRule(tag: string, count: number): Intl.LDMLPluralRule {
  let rule = rules.get(tag)
  if (rule === undefined) {
    rule = new Intl.PluralRules(tag)
    rules.set(tag, rule)
  }
  return rule.select(count)
}

/**
 * A French sentence that depends on a number, in the reader's language: its singular
 * and its plural, in French — the plural is the key —, and `{count}` in either replaced
 * by the number as the language writes it. `$tp(n, '{count} ligne', '{count} lignes')`.
 *
 * Each language has its own categories (Polish has four, Japanese one): the catalog holds
 * the forms of the reader's language, chosen by `Intl.PluralRules`.
 */
export function $tp(count: number, one: string, other: string, values?: Values): string {
  const { locale: tag, messages } = loaded()
  const message = messages[other]
  let text: string
  if (typeof message === 'object') {
    text = message[pluralRule(tag, count)] ?? message.other ?? other
  } else if (typeof message === 'string') {
    text = message
  } else {
    // French: 0 and 1 are singular.
    text = pluralRule(SOURCE_LOCALE, count) === 'one' ? one : other
  }
  return interpolate(text, { count: formatCount(count), ...values })
}

/** The months in the reader's language, January first: « janv. », « Jan », « 1月 ». */
export function monthNames(style: 'long' | 'short'): string[] {
  const format = new Intl.DateTimeFormat(intlLocale(), { month: style, timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, m) => format.format(Date.UTC(2021, m, 15)))
}

/** The days of the week in the reader's language, Monday first. */
export function weekdayNames(style: 'long' | 'short'): string[] {
  const format = new Intl.DateTimeFormat(intlLocale(), { weekday: style, timeZone: 'UTC' })
  // 1 March 2021 was a Monday.
  return Array.from({ length: 7 }, (_, d) => format.format(Date.UTC(2021, 2, 1 + d)))
}

/** A calendar day (`2026-09-14`) as the language writes it: « 14 sept. 2026 », « Sep 14, 2026 ». */
export function dayLabel(day: string, month: 'short' | 'long' = 'short'): string {
  const [y, m, d] = [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))]
  if (!Number.isFinite(y + m + d)) return day
  return new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month,
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d))
}

/** A month of a year (`2026`, 9) as the language writes it: « sept. 2026 », « Sep 2026 ». */
export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month - 1, 15))
}

/** A count as the language writes it — `12 345` in French, `12,345` in English. */
export function formatCount(count: number): string {
  return count.toLocaleString(intlLocale())
}

/**
 * The language the browser asks for, among ours — what « the browser's language » means
 * in the settings, where the account holds no choice.
 */
export function browserLocale(): Locale {
  if (typeof navigator === 'undefined') return SOURCE_LOCALE
  return matchLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
}

/**
 * The cookie the server reads to serve a page in a language (`app/layout.tsx`): the
 * account's choice, remembered by this browser — the login screen and the shared pages
 * need it before anyone is known. No choice: no cookie, and the browser's language.
 */
export const LOCALE_COOKIE = 'basedb-locale'

export function rememberLocale(chosen: Locale | null): void {
  const year = 60 * 60 * 24 * 365
  document.cookie =
    chosen === null
      ? `${LOCALE_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${LOCALE_COOKIE}=${chosen}; path=/; max-age=${year}; samesite=lax`
}

/** The choice this browser remembers, if any. */
export function rememberedLocale(): Locale | null {
  if (typeof document === 'undefined') return null
  const found = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
  const value = found?.slice(LOCALE_COOKIE.length + 1)
  return isLocale(value) ? value : null
}

/**
 * Brings the page in line with the account: the language it holds, else the browser's.
 * Returns true when the page is being reloaded in another language — nothing more should
 * be drawn meanwhile.
 *
 * It never loops: with no choice the server already served the browser's language, and
 * only a remembered choice gone stale needs undoing; with one, the page reloads only
 * once the cookie holds it — a browser that refuses cookies keeps the page it has.
 */
export function followAccountLocale(chosen: Locale | null): boolean {
  if (typeof window === 'undefined') return false
  const remembered = rememberedLocale()
  if (chosen === null) {
    if (remembered === null) return false
    rememberLocale(null)
    if (rememberedLocale() !== null) return false
    window.location.reload()
    return true
  }
  if (remembered !== chosen) rememberLocale(chosen)
  if (chosen === locale() || rememberedLocale() !== chosen) return false
  window.location.reload()
  return true
}

export { LOCALES, LOCALE_NAMES, type Locale }
