import { type Locale, isLocale } from '@basedb/contracts'
import type { Catalog } from './catalog.js'
import { cs } from './cs.js'
import { da } from './da.js'
import { de } from './de.js'
import { en } from './en.js'
import { es } from './es.js'
import { fi } from './fi.js'
import { hu } from './hu.js'
import { it } from './it.js'
import { ja } from './ja.js'
import { ko } from './ko.js'
import { nb } from './nb.js'
import { nl } from './nl.js'
import { pl } from './pl.js'
import { ptBR } from './pt-BR.js'
import { ro } from './ro.js'
import { sv } from './sv.js'
import { tr } from './tr.js'
import { uk } from './uk.js'
import { zhCN } from './zh-CN.js'

export type { Catalog }

/** Says a French sentence in the reader's language, with its values filled in. */
export type Say = (french: string, values?: Readonly<Record<string, string | number>>) => string

export const CATALOGS: Readonly<Record<Exclude<Locale, 'fr'>, Catalog>> = {
  en,
  de,
  es,
  it,
  'pt-BR': ptBR,
  nl,
  pl,
  cs,
  sv,
  da,
  nb,
  fi,
  ro,
  hu,
  tr,
  uk,
  ja,
  'zh-CN': zhCN,
  ko,
}

/**
 * The `t` of one language. A language basedb does not speak, and a sentence its catalog
 * lacks, are written in French: a missing translation must never cost a whole page.
 */
export function sayer(language: string): Say {
  const catalog = isLocale(language) && language !== 'fr' ? CATALOGS[language] : undefined
  return (french, values) => {
    const text = catalog?.[french] ?? french
    if (values === undefined) return text
    // One pass over the sentence, never over what it inserts: a value may hold braces.
    return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : whole,
    )
  }
}
