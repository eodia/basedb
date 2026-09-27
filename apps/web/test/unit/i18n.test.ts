import { afterEach, describe, expect, it } from 'vitest'
import { $t, $tp, dayLabel, monthNames, weekdayNames } from '../../src/lib/i18n'

/** The page's language and messages, as `app/layout.tsx` hands them over. */
function serve(locale: string, messages: Record<string, unknown>) {
  ;(globalThis as { window?: unknown }).window = { __BASEDB_I18N__: { locale, messages } }
}

afterEach(() => {
  ;(globalThis as { window?: unknown }).window = undefined
})

describe('a sentence', () => {
  it('reads in French when nothing is served, its values in place', () => {
    expect($t('Nouveau champ dans {table}', { table: 'Clients' })).toBe(
      'Nouveau champ dans Clients',
    )
    // A `{name}` with no value, a basedb variable, stays as written.
    expect($t('Écrivez {{Ville}} pour {who}', { who: 'vous' })).toBe('Écrivez {{Ville}} pour vous')
    expect($t('Actif{suffix}', { suffix: false })).toBe('Actif')
  })

  it('reads its translation, and falls back to French when there is none', () => {
    serve('de', { Enregistrer: 'Speichern' })
    expect($t('Enregistrer')).toBe('Speichern')
    expect($t('Annuler')).toBe('Annuler')
  })

  it('keeps the spaces the code put around it', () => {
    serve('en', { ' · modifié': '· edited' })
    expect($t(' · modifié')).toBe(' · edited')
  })

  it('shows the word alone in French, and its meaning to the translator', () => {
    expect($t('Moyenne||hauteur de ligne')).toBe('Moyenne')
    serve('en', { 'Moyenne||hauteur de ligne': 'Medium', Moyenne: 'Average' })
    expect($t('Moyenne||hauteur de ligne')).toBe('Medium')
    expect($t('Moyenne')).toBe('Average')
  })
})

describe('a sentence with a number', () => {
  it('takes the French singular for 0 and 1', () => {
    expect($tp(0, '{count} ligne', '{count} lignes')).toBe('0 ligne')
    expect($tp(1, '{count} ligne', '{count} lignes')).toBe('1 ligne')
    expect($tp(2, '{count} ligne', '{count} lignes')).toBe('2 lignes')
  })

  it('takes the form its language asks for', () => {
    serve('pl', {
      '{count} lignes': {
        one: '{count} wiersz',
        few: '{count} wiersze',
        many: '{count} wierszy',
        other: '{count} wiersza',
      },
    })
    expect($tp(1, '{count} ligne', '{count} lignes')).toBe('1 wiersz')
    expect($tp(3, '{count} ligne', '{count} lignes')).toBe('3 wiersze')
    expect($tp(5, '{count} ligne', '{count} lignes')).toBe('5 wierszy')
    expect($tp(1.5, '{count} ligne', '{count} lignes')).toBe('1,5 wiersza')
  })

  it('writes the number as its language does', () => {
    serve('en', { '{count} lignes': { one: '{count} row', other: '{count} rows' } })
    expect($tp(12345, '{count} ligne', '{count} lignes')).toBe('12,345 rows')
  })
})

describe('the calendar', () => {
  it('names months and days in the language of the page, Monday first', () => {
    serve('de', {})
    expect(monthNames('long')[0]).toBe('Januar')
    expect(weekdayNames('long')[0]).toBe('Montag')
    serve('fr', {})
    expect(weekdayNames('long')[6]).toBe('dimanche')
    expect(dayLabel('2026-09-14')).toBe('14 sept. 2026')
  })
})
