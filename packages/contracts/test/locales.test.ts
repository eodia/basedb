import { describe, expect, it } from 'vitest'
import {
  LOCALES,
  LOCALE_NAMES,
  acceptedLanguages,
  localeOfTag,
  matchLocale,
} from '../src/locales.js'

describe('the languages', () => {
  it('are twenty, each with its own name', () => {
    expect(LOCALES).toHaveLength(20)
    for (const locale of LOCALES) expect(LOCALE_NAMES[locale]).toBeTruthy()
  })

  it('read a tag by its exact form, then by its language', () => {
    expect(localeOfTag('de-CH')).toBe('de')
    expect(localeOfTag('pt-PT')).toBe('pt-BR')
    expect(localeOfTag('zh-TW')).toBe('zh-CN')
    expect(localeOfTag('no')).toBe('nb')
    expect(localeOfTag('EN-us')).toBe('en')
    expect(localeOfTag('ar')).toBeNull()
  })

  it('take the first language spoken, English when none is', () => {
    expect(matchLocale(['ar', 'he', 'de'])).toBe('de')
    expect(matchLocale(['ar'])).toBe('en')
    expect(matchLocale([])).toBe('en')
  })

  it('read an Accept-Language header by weight, then by order', () => {
    expect(acceptedLanguages('fr-CH, fr;q=0.9, en;q=0.8, de;q=0.95, *;q=0.5')).toEqual([
      'fr-CH',
      'de',
      'fr',
      'en',
    ])
    expect(acceptedLanguages(null)).toEqual([])
    expect(acceptedLanguages('x;q=0')).toEqual([])
  })
})
