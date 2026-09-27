import { type Locale, acceptedLanguages, isLocale, matchLocale } from '@basedb/contracts'
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, type Messages } from './i18n'

/**
 * The language a page is served in, and its messages — chapter 11 §10.
 *
 * The account's choice travels in a cookie (`lib/i18n.ts`), since the page is drawn before
 * anyone is known; without one, the browser's `Accept-Language` decides, and English
 * answers a browser that speaks none of our languages.
 */

/** The catalogs, one module each: only the served language's is read. */
const CATALOGS: Readonly<Record<Exclude<Locale, 'fr'>, () => Promise<{ default: Messages }>>> = {
  en: () => import('@/locales/en.json'),
  de: () => import('@/locales/de.json'),
  es: () => import('@/locales/es.json'),
  it: () => import('@/locales/it.json'),
  'pt-BR': () => import('@/locales/pt-BR.json'),
  nl: () => import('@/locales/nl.json'),
  pl: () => import('@/locales/pl.json'),
  cs: () => import('@/locales/cs.json'),
  sv: () => import('@/locales/sv.json'),
  da: () => import('@/locales/da.json'),
  nb: () => import('@/locales/nb.json'),
  fi: () => import('@/locales/fi.json'),
  ro: () => import('@/locales/ro.json'),
  hu: () => import('@/locales/hu.json'),
  tr: () => import('@/locales/tr.json'),
  uk: () => import('@/locales/uk.json'),
  ja: () => import('@/locales/ja.json'),
  'zh-CN': () => import('@/locales/zh-CN.json'),
  ko: () => import('@/locales/ko.json'),
}

export async function requestLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(chosen)) return chosen
  return matchLocale(acceptedLanguages((await headers()).get('accept-language')))
}

export async function messagesOf(locale: Locale): Promise<Messages> {
  // French is the source: its sentences are the keys.
  if (locale === 'fr') return {}
  return (await CATALOGS[locale]()).default
}

/**
 * The script that hands the page its language, as JavaScript source: `<` is escaped, so
 * that no message — `</script>` typed as a label — can close the tag it is written in.
 */
export function i18nScript(locale: Locale, messages: Messages): string {
  const json = JSON.stringify({ locale, messages }).replaceAll('<', '\\' + 'u003c')
  return `window.__BASEDB_I18N__=${json}`
}

/** A French sentence in the served language — for what the server writes itself. */
export function translate(messages: Messages, french: string): string {
  const message = messages[french]
  return typeof message === 'string' ? message : (message?.other ?? french)
}
