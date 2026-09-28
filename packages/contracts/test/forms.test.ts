import { describe, expect, it } from 'vitest'
import { conditionHolds, isEmptyAnswer, visibleQuestions } from '../src/forms.js'

describe('form conditions', () => {
  it('reads an answer the way a person would', () => {
    expect(conditionHolds({ field: 'a', op: 'is', value: 'Oui' }, 'oui')).toBe(true)
    expect(conditionHolds({ field: 'a', op: 'is', value: true }, true)).toBe(true)
    expect(conditionHolds({ field: 'a', op: 'is', value: true }, false)).toBe(false)
    expect(conditionHolds({ field: 'a', op: 'is_not', value: 'lyon' }, undefined)).toBe(true)
    expect(conditionHolds({ field: 'a', op: 'includes', value: 'b' }, ['a', 'b'])).toBe(true)
    expect(conditionHolds({ field: 'a', op: 'excludes', value: 'b' }, ['a'])).toBe(true)
    expect(conditionHolds({ field: 'a', op: 'gte', value: 4 }, 5)).toBe(true)
    expect(conditionHolds({ field: 'a', op: 'lte', value: 2 }, '3')).toBe(false)
    expect(conditionHolds({ field: 'a', op: 'gte', value: 4 }, null)).toBe(false)
    expect(conditionHolds({ field: 'a', op: 'answered', value: null }, '  ')).toBe(false)
    expect(conditionHolds({ field: 'a', op: 'empty', value: null }, [])).toBe(true)
  })

  it('counts « no » as an answer, and nothing as none', () => {
    expect(isEmptyAnswer(false)).toBe(false)
    expect(isEmptyAnswer(0)).toBe(false)
    expect(isEmptyAnswer('')).toBe(true)
    expect(isEmptyAnswer({ id: null, display: null })).toBe(true)
    expect(isEmptyAnswer({ id: 'x', display: null })).toBe(false)
  })

  it('hides what depends on a hidden question', () => {
    const questions = [
      { field: 'client', show_if: null },
      { field: 'societe', show_if: { field: 'client', op: 'is' as const, value: 'pro' } },
      { field: 'siret', show_if: { field: 'societe', op: 'answered' as const, value: null } },
      { field: 'note' },
    ]
    const pro = visibleQuestions(questions, { client: 'pro', societe: 'Martin' })
    expect(pro.map((q) => q.field)).toEqual(['client', 'societe', 'siret', 'note'])
    // « societe » was typed, then « client » changed: its answer no longer counts.
    const perso = visibleQuestions(questions, { client: 'perso', societe: 'Martin' })
    expect(perso.map((q) => q.field)).toEqual(['client', 'note'])
  })
})
