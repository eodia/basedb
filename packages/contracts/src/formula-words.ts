/**
 * The two spellings of the formula language — chapter 04 §7.2.
 *
 * The stored tree spells every word in French. A formula is typed in either language, and
 * written back in the reader's: French on a French screen, English on any other. The kernel
 * reads and renders with this table; a template served in another language than French
 * gives its formulas in English with it too.
 */

/** The language a formula is written in. */
export type FormulaDialect = 'fr' | 'en'

/** A French screen reads formulas in French; every other screen, in English. */
export function formulaDialect(language: string): FormulaDialect {
  return language === 'fr' ? 'fr' : 'en'
}

/**
 * The English spelling of each word of the language whose French one differs. ABS, MIN,
 * MAX, DATE and NULL are the same in both.
 */
export const FORMULA_ENGLISH: Readonly<Record<string, string>> = {
  SI: 'IF',
  SIVIDE: 'IFBLANK',
  ESTVIDE: 'ISBLANK',
  ARRONDI: 'ROUND',
  PLAFOND: 'CEILING',
  PLANCHER: 'FLOOR',
  MAJUSCULE: 'UPPER',
  MINUSCULE: 'LOWER',
  SANSESPACES: 'TRIM',
  GAUCHE: 'LEFT',
  DROITE: 'RIGHT',
  LONGUEUR: 'LEN',
  TEXTE: 'TEXT',
  NOMBRE: 'VALUE',
  ANNEE: 'YEAR',
  MOIS: 'MONTH',
  JOUR: 'DAY',
  JOURSEMAINE: 'WEEKDAY',
  JOURS: 'DAYS',
  AJOUTER_JOURS: 'ADD_DAYS',
  AUJOURDHUI: 'TODAY',
  MAINTENANT: 'NOW',
  VRAI: 'TRUE',
  FAUX: 'FALSE',
  ET: 'AND',
  OU: 'OR',
  NON: 'NOT',
}

/**
 * A formula's text in English: its words renamed and `;` written `,`, the `[Libellé]` it
 * cites and its `"texts"` left as they are. A word the language does not know stays as
 * typed, for the kernel to refuse.
 */
export function formulaInEnglish(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i] as string
    if (c === '"' || c === '[') {
      // A text ends at its quote (`""` reads as two texts side by side, which changes
      // nothing here); a label at its bracket, `]]` being a bracket inside it.
      const close = c === '"' ? '"' : ']'
      let j = i + 1
      while (j < text.length) {
        if (text[j] === close) {
          if (close === ']' && text[j + 1] === ']') {
            j += 2
            continue
          }
          break
        }
        j++
      }
      out += text.slice(i, j + 1)
      i = j + 1
      continue
    }
    const word = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(text.slice(i))
    if (word !== null) {
      out += FORMULA_ENGLISH[word[0].toUpperCase()] ?? word[0]
      i += word[0].length
      continue
    }
    out += c === ';' ? ',' : c
    i++
  }
  return out
}
