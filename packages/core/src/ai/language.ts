import { type Locale, isLocale } from '@basedb/contracts'

/**
 * The language a copilot answers in — the reader's (chapter 11 §10, chapter 12).
 *
 * The instructions to the model are written in French, as the rest of the kernel; they
 * say « en français » where the answer's language goes. The request carries the language
 * of the screen, and that phrase takes it: a person reading the interface in German gets
 * answers — and proposed labels — in German.
 */

/** Each language as French names it. */
const NAMES: Readonly<Record<Locale, string>> = {
  fr: 'français',
  en: 'anglais',
  de: 'allemand',
  es: 'espagnol',
  it: 'italien',
  'pt-BR': 'portugais du Brésil',
  nl: 'néerlandais',
  pl: 'polonais',
  cs: 'tchèque',
  sv: 'suédois',
  da: 'danois',
  nb: 'norvégien (bokmål)',
  fi: 'finnois',
  ro: 'roumain',
  hu: 'hongrois',
  tr: 'turc',
  uk: 'ukrainien',
  ja: 'japonais',
  'zh-CN': 'chinois simplifié',
  ko: 'coréen',
}

/** The instructions, with « en français » turned into the reader's language. */
export function inLanguage(system: string, language: string | null | undefined): string {
  if (!isLocale(language) || language === 'fr') return system
  return system.replaceAll('en français', `en ${NAMES[language]}`)
}
