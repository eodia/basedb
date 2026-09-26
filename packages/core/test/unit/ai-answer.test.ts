import { describe, expect, it } from 'vitest'
import { AI_KINDS, expectedFormat, isAiKind, parseAnswer } from '../../src/ai/answer.js'

/**
 * The AI as an option of a field: what each type asks of the model, and how an answer is
 * read into it — or refused when it holds no value of that type.
 */

const options = [
  { value: 'haute', label: 'Haute' },
  { value: 'basse', label: 'Basse' },
  { value: 'grand_compte', label: 'Grand compte' },
]

describe('the types the option is offered to', () => {
  it('are the types whose value an answer can hold', () => {
    expect([...AI_KINDS].sort()).toEqual(
      ['boolean', 'date', 'long_text', 'number', 'select', 'short_text', 'url'].sort(),
    )
    expect(isAiKind('link')).toBe(false)
    expect(isAiKind('file')).toBe(false)
  })

  it('tell the model what the column accepts, a list naming its choices', () => {
    expect(expectedFormat('long_text')).toBeUndefined()
    expect(expectedFormat('number')).toMatch(/nombre/)
    expect(expectedFormat('select', options)).toContain('« Grand compte »')
  })
})

describe('reading an answer', () => {
  it('text: as it comes, on one line for a short text', () => {
    expect(parseAnswer('long_text', '  Deux\nlignes  ')).toBe('Deux\nlignes')
    expect(parseAnswer('short_text', 'Une phrase\n  coupée')).toBe('Une phrase coupée')
    expect(parseAnswer('short_text', '')).toBe('')
  })

  it('a number, French or not, without its unit', () => {
    expect(parseAnswer('number', 'Environ 1 234,5 €')).toBe('1234.5')
    expect(parseAnswer('number', '-12.75')).toBe('-12.75')
    expect(parseAnswer('number', 'aucune idée')).toBeNull()
  })

  it('a choice, by its label or its value, named alone', () => {
    expect(parseAnswer('select', 'Haute', options)).toBe('haute')
    expect(parseAnswer('select', '« grand compte ».', options)).toBe('grand_compte')
    expect(parseAnswer('select', 'Priorité : Basse', options)).toBe('basse')
    expect(parseAnswer('select', 'Haute ou basse', options)).toBeNull()
    expect(parseAnswer('select', 'Moyenne', options)).toBeNull()
  })

  it('an address, found in the answer and given its scheme', () => {
    expect(parseAnswer('url', 'Voir https://exemple.fr/tarifs.')).toBe('https://exemple.fr/tarifs')
    expect(parseAnswer('url', 'exemple.fr')).toBe('https://exemple.fr')
    expect(parseAnswer('url', 'contact@exemple.fr')).toBe('mailto:contact@exemple.fr')
    expect(parseAnswer('url', 'javascript:alert(1)')).toBeNull()
  })

  it('yes or no, and a date that exists', () => {
    expect(parseAnswer('boolean', 'Oui, clairement')).toBe(true)
    expect(parseAnswer('boolean', 'non')).toBe(false)
    expect(parseAnswer('boolean', 'peut-être')).toBeNull()
    expect(parseAnswer('date', 'Le 2026-09-18.')).toBe('2026-09-18')
    expect(parseAnswer('date', '18/09/2026')).toBe('2026-09-18')
    expect(parseAnswer('date', '2026-02-30')).toBeNull()
  })
})
