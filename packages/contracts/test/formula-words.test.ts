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

  it('spells the text and date functions, those that are the same in both left as they are', () => {
    expect(
      formulaInEnglish(
        'STXT([a]; 1; 2) & SUBSTITUE([a]; "x"; "y") & NOMPROPRE([a]) & REPT("-"; 3)',
      ),
    ).toBe('MID([a], 1, 2) & SUBSTITUTE([a], "x", "y") & PROPER([a]) & REPT("-", 3)')
    expect(
      formulaInEnglish(
        'SI(CONTIENT([a]; "x") ET FINITPAR([a]; "y"); TROUVE("x"; [a]); CHERCHE("y"; [a]))',
      ),
    ).toBe('IF(CONTAINS([a], "x") AND ENDSWITH([a], "y"), FIND("x", [a]), SEARCH("y", [a]))')
    expect(formulaInEnglish('JOINDRE_TEXTE(", "; VRAI; [a]; CONCAT([b]; [c]))')).toBe(
      'TEXTJOIN(", ", TRUE, [a], CONCAT([b], [c]))',
    )
    expect(formulaInEnglish('REGEX_REMPLACER([a]; "x"; "y") & REGEX_EXTRAIRE([a]; "z")')).toBe(
      'REGEXREPLACE([a], "x", "y") & REGEXEXTRACT([a], "z")',
    )
    expect(
      formulaInEnglish(
        'HEURE([d]) + MINUTE([d]) + SECONDE([d]) + NO_SEMAINE_ISO([d]) + DATEDIF([d]; [e]; "M")',
      ),
    ).toBe('HOUR([d]) + MINUTE([d]) + SECOND([d]) + ISOWEEKNUM([d]) + DATEDIF([d], [e], "M")')
    expect(formulaInEnglish('AJOUTER_MOIS([d]; 1) + FIN_MOIS([d])')).toBe(
      'ADD_MONTHS([d], 1) + EOMONTH([d])',
    )
  })

  it('writes French on a French screen only', () => {
    expect(formulaDialect('fr')).toBe('fr')
    expect(formulaDialect('pt-BR')).toBe('en')
  })
})
