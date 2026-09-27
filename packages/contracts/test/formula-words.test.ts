import { describe, expect, it } from 'vitest'
import { FORMULA_ENGLISH, formulaDialect, formulaInEnglish } from '../src/formula-words.js'

describe('the two spellings of formulas', () => {
  it('gives each word one English spelling, none a French word of the language', () => {
    const english = Object.values(FORMULA_ENGLISH)
    expect(new Set(english).size).toBe(english.length)
    for (const word of english) expect(Object.keys(FORMULA_ENGLISH)).not.toContain(word)
  })

  it('writes a formula in English, its citations and its texts untouched', () => {
    expect(formulaInEnglish('SI([Et]; "ou; non"; NON VRAI ET [Prix [HT]]] > 0)')).toBe(
      'IF([Et], "ou; non", NOT TRUE AND [Prix [HT]]] > 0)',
    )
    expect(formulaInEnglish('jours(aujourdhui(); [Fin])')).toBe('DAYS(TODAY(), [Fin])')
    expect(formulaInEnglish('ABS([x]) + INCONNU(1.5)')).toBe('ABS([x]) + INCONNU(1.5)')
  })

  it('writes French on a French screen only', () => {
    expect(formulaDialect('fr')).toBe('fr')
    expect(formulaDialect('pt-BR')).toBe('en')
  })
})
