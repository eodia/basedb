/**
 * The languages basedb speaks — the interface, its messages, the mails it sends.
 *
 * French is the source: every text is written in French first, and the other languages
 * translate it. A person's language is a preference of their account (`app_user.locale`);
 * with none, the interface takes the first language of the browser it can speak, and
 * English when it speaks none of them.
 */

export const LOCALES = [
  'fr',
  'en',
  'de',
  'es',
  'it',
  'pt-BR',
  'nl',
  'pl',
  'cs',
  'sv',
  'da',
  'nb',
  'fi',
  'ro',
  'hu',
  'tr',
  'uk',
  'ja',
  'zh-CN',
  'ko',
] as const

export type Locale = (typeof LOCALES)[number]

/** The language the texts are written in. */
export const SOURCE_LOCALE: Locale = 'fr'

/** The language of a browser that asks for none of ours. */
export const FALLBACK_LOCALE: Locale = 'en'

/** Each language by its own name — what a language picker lists. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  'pt-BR': 'Português (Brasil)',
  nl: 'Nederlands',
  pl: 'Polski',
  cs: 'Čeština',
  sv: 'Svenska',
  da: 'Dansk',
  nb: 'Norsk bokmål',
  fi: 'Suomi',
  ro: 'Română',
  hu: 'Magyar',
  tr: 'Türkçe',
  uk: 'Українська',
  ja: '日本語',
  'zh-CN': '简体中文',
  ko: '한국어',
}

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

/**
 * The language a tag asks for, if we speak it: the exact tag first, then its language
 * alone — `pt-PT` reads Brazilian Portuguese, any Chinese reads simplified Chinese, and
 * Norwegian in any of its forms reads bokmål.
 */
export function localeOfTag(tag: string): Locale | null {
  const clean = tag.trim().toLowerCase()
  if (clean === '') return null
  const exact = LOCALES.find((l) => l.toLowerCase() === clean)
  if (exact !== undefined) return exact
  const language = clean.split(/[-_]/)[0] ?? ''
  if (language === 'pt') return 'pt-BR'
  if (language === 'zh') return 'zh-CN'
  if (language === 'no' || language === 'nn' || language === 'nb') return 'nb'
  return LOCALES.find((l) => l.toLowerCase() === language) ?? null
}

/**
 * The first language of a list we speak — a browser's `navigator.languages`, or the
 * tags of an `Accept-Language` header in order of preference — and English otherwise.
 */
export function matchLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const found = localeOfTag(tag)
    if (found !== null) return found
  }
  return FALLBACK_LOCALE
}

/** The tags of an `Accept-Language` header, most wanted first. */
export function acceptedLanguages(header: string | null | undefined): string[] {
  if (header === null || header === undefined) return []
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const weight = q === undefined ? 1 : Number(q.slice(2))
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, index }
    })
    .filter((entry) => entry.tag !== '' && entry.tag !== '*' && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((entry) => entry.tag)
}
