import { describe, expect, it } from 'vitest'
import {
  MATCH,
  excerpt,
  fold,
  highlights,
  looksLikeQuestion,
  prepare,
  runsOf,
  scoreOf,
  scoreToken,
  tokensOf,
  within,
} from '../../src/lib/search'

/** The titles a search ranks, best first — those it finds at all. */
const rank = (query: string, titles: readonly string[]) =>
  titles
    .map((title) => ({ title, score: scoreOf(tokensOf(query), prepare({ title })) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.title)

describe('fold', () => {
  it('drops accents and case, one code point for one', () => {
    expect(fold('Élève à Noël')).toBe('eleve a noel')
    expect(Array.from(fold('Œuvre 🎯 é')).length).toBe(Array.from('Œuvre 🎯 é').length)
  })
})

describe('tokensOf', () => {
  it('splits on spaces and sheds the punctuation around words', () => {
    expect(tokensOf('  « Clients »  de Paris ? ')).toEqual(['clients', 'de', 'paris'])
  })
})

describe('within', () => {
  it('allows a letter replaced, added, dropped, or two swapped', () => {
    expect(within('factrue', 'facture', 1)).toBe(true)
    expect(within('factur', 'facture', 1)).toBe(true)
    expect(within('facturee', 'facture', 1)).toBe(true)
    expect(within('fixture', 'facture', 1)).toBe(false)
    expect(within('fixture', 'facture', 2)).toBe(true)
  })
})

describe('scoreToken', () => {
  it('ranks the kinds of match from the surest to the loosest', () => {
    expect(scoreToken('clients', 'clients')).toBe(MATCH.exact)
    expect(scoreToken('cli', 'clients actifs')).toBe(MATCH.prefix)
    expect(scoreToken('act', 'clients actifs')).toBe(MATCH.word)
    expect(scoreToken('ient', 'clients')).toBe(MATCH.inside)
    expect(scoreToken('nc', 'nouveau client')).toBe(MATCH.initials)
    expect(scoreToken('ncl', 'nouveau client')).toBe(MATCH.initials)
    expect(scoreToken('nouvtab', 'nouvelle table dans ventes')).toBe(MATCH.initials)
    expect(scoreToken('tv', 'nouvelle table dans ventes')).toBe(MATCH.initials - 8)
    expect(scoreToken('cleints', 'clients')).toBe(MATCH.slip)
    expect(scoreToken('zzz', 'clients')).toBe(0)
  })

  it('counts a single letter only at the start of a word', () => {
    expect(scoreToken('l', 'clients')).toBe(0)
    expect(scoreToken('c', 'les clients')).toBe(MATCH.word)
  })

  it('stays quick over a long text whose words all start alike', () => {
    const text = Array.from({ length: 300 }, (_, i) => `a${i}bc`).join(' ')
    const started = performance.now()
    expect(scoreToken('aaaaaaaaaaaaaaaaaaaz', text)).toBe(0)
    expect(performance.now() - started).toBeLessThan(200)
  })

  it('finds a word being typed with a slip', () => {
    expect(scoreToken('factr', 'factures impayées')).toBeGreaterThan(0)
  })

  it('sees words in technical names and where letters meet digits', () => {
    expect(scoreToken('date', 'date_de_naissance')).toBe(MATCH.prefix)
    expect(scoreToken('naissance', 'date_de_naissance')).toBe(MATCH.word)
    expect(scoreToken('2', 'table2')).toBe(MATCH.word)
  })
})

describe('scoreOf', () => {
  it('ranks the title that starts with the text first', () => {
    expect(rank('fact', ['Contacts', 'Factures', 'Lignes de facture', 'Clients'])).toEqual([
      'Factures',
      'Lignes de facture',
    ])
  })

  it('wants every word typed found somewhere', () => {
    const table = prepare({ title: 'Clients', context: 'Ventes · Mon projet' })
    expect(scoreOf(tokensOf('ventes clients'), table)).toBeGreaterThan(0)
    expect(scoreOf(tokensOf('achats clients'), table)).toBe(0)
  })

  it('does not list a thing found only where it lives', () => {
    const column = prepare({ title: 'Montant HT', context: 'Factures · Ventes' })
    expect(scoreOf(tokensOf('factures'), column)).toBe(0)
    expect(scoreOf(tokensOf('factures montant'), column)).toBeGreaterThan(0)
  })

  it('keeps slips and scattered letters from matching anything', () => {
    expect(scoreToken('nuit', 'quitter deconnexion sortir')).toBe(0)
    expect(scoreToken('ncl', 'projet principal')).toBe(0)
    expect(scoreToken('fctr', 'factures')).toBeGreaterThan(0)
  })

  it('reads keywords and places from the start of their words only', () => {
    const doc = prepare({ title: 'Documentation API', keywords: 'openapi développeurs' })
    expect(scoreOf(['velo'], doc)).toBe(0)
    expect(scoreOf(['develop'], doc)).toBeGreaterThan(0)
  })

  it('prefers the words in the order of the title', () => {
    const [first] = rank('nouvelle table', ['Table nouvelle', 'Nouvelle table dans « Ventes »'])
    expect(first).toBe('Nouvelle table dans « Ventes »')
  })

  it('finds a command by its keywords, below one found by its title', () => {
    const dark = prepare({ title: 'Thème sombre', keywords: 'nuit noir foncé' })
    const night = prepare({ title: 'Nuit' })
    expect(scoreOf(['nuit'], dark)).toBeGreaterThan(0)
    expect(scoreOf(['nuit'], night)).toBeGreaterThan(scoreOf(['nuit'], dark))
  })

  it('ignores accents typed or not', () => {
    expect(rank('eleves', ['Élèves', 'Professeurs'])).toEqual(['Élèves'])
    expect(rank('élèves', ['Eleves'])).toEqual(['Eleves'])
  })
})

describe('highlights', () => {
  it('lights the words where they were found', () => {
    const title = 'Lignes de facture'
    const runs = runsOf(title, highlights(title, tokensOf('fact lig')))
    expect(runs.filter((r) => r.lit).map((r) => r.text)).toEqual(['Lig', 'fact'])
  })

  it('lights the starts of words, and nothing for a word found elsewhere', () => {
    const title = 'Nouveau client'
    expect(
      runsOf(title, highlights(title, ['nc']))
        .filter((r) => r.lit)
        .map((r) => r.text),
    ).toEqual(['N', 'c'])
    expect(
      runsOf('Nouvelle table', highlights('Nouvelle table', ['nouvtab']))
        .filter((r) => r.lit)
        .map((r) => r.text),
    ).toEqual(['Nouv', 'tab'])
    expect(highlights('Clients', ['ventes']).size).toBe(0)
  })

  it('keeps accented titles aligned', () => {
    const title = 'Élèves inscrits'
    const lit = runsOf(title, highlights(title, ['eleves']))
    expect(lit[0]).toEqual({ text: 'Élèves', lit: true })
  })
})

describe('looksLikeQuestion', () => {
  const words = new Set(tokensOf('combien quel quelle comment montre'))
  it('reads a question mark, a question word, a long sentence', () => {
    expect(looksLikeQuestion('clients de Paris ?', words)).toBe(true)
    expect(looksLikeQuestion('combien de factures', words)).toBe(true)
    expect(looksLikeQuestion('les clients qui ont commandé en mars', words)).toBe(true)
  })
  it('leaves a name looked for alone', () => {
    expect(looksLikeQuestion('clients', words)).toBe(false)
    expect(looksLikeQuestion('factures impayées', words)).toBe(false)
    expect(looksLikeQuestion('combien', words)).toBe(false)
  })
})

describe('excerpt', () => {
  it('keeps a short text whole', () => {
    expect(excerpt('Livraison à Paris', ['paris']).text).toBe('Livraison à Paris')
  })
  it('cuts a long text around the match, the match kept', () => {
    const text = `${'a'.repeat(100)} Paris ${'b'.repeat(100)}`
    const cut = excerpt(text, ['paris'])
    expect(cut.text).toContain('Paris')
    expect(cut.text.startsWith('…')).toBe(true)
    expect(cut.text.endsWith('…')).toBe(true)
    expect(cut.lit.size).toBe(5)
  })
})
