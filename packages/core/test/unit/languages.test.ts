import { LOCALES } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import { inLanguage } from '../../src/ai/language.js'
import { mailTexts } from '../../src/auth/mail-texts.js'

describe('the language a copilot answers in', () => {
  const system = 'Tu aides une personne, en français et brièvement. Les libellés sont en français.'

  it('is the screen’s: every « en français » takes it', () => {
    expect(inLanguage(system, 'de')).toBe(
      'Tu aides une personne, en allemand et brièvement. Les libellés sont en allemand.',
    )
    expect(inLanguage(system, 'zh-CN')).toContain('en chinois simplifié')
  })

  it('stays French for French, for nothing, and for a language basedb does not speak', () => {
    expect(inLanguage(system, 'fr')).toBe(system)
    expect(inLanguage(system, undefined)).toBe(system)
    expect(inLanguage(system, 'ar')).toBe(system)
  })
})

describe('the mails', () => {
  it('speak every language', () => {
    for (const locale of LOCALES) {
      const texts = mailTexts(locale)
      expect(texts.resetSubject).toMatch(/^basedb — /)
      expect(texts.emailChanged('a@b.fr')).toContain('a@b.fr')
    }
  })

  it('take the account’s language, else the request’s, else English', () => {
    expect(mailTexts('de', 'fr').resetSubject).toBe('basedb — Passwort zurücksetzen')
    expect(mailTexts(null, 'fr-FR,fr;q=0.9').resetSubject).toBe(
      'basedb — réinitialisation de votre mot de passe',
    )
    expect(mailTexts(null, null).resetSubject).toBe('basedb — reset your password')
  })
})
