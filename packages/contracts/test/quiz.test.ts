import { describe, expect, it } from 'vitest'
import {
  isRightAnswer,
  looseText,
  quizAnswerFits,
  quizPassed,
  quizPercent,
  scoreQuiz,
} from '../src/quiz.js'

describe('quiz answers', () => {
  it('expects the right answer in the shape of its field', () => {
    expect(quizAnswerFits('select', 'paris')).toBe(true)
    expect(quizAnswerFits('select', '')).toBe(false)
    expect(quizAnswerFits('multi_select', ['a', 'b'])).toBe(true)
    expect(quizAnswerFits('multi_select', ['a', 'a'])).toBe(false)
    expect(quizAnswerFits('boolean', false)).toBe(true)
    expect(quizAnswerFits('number', 42)).toBe(true)
    expect(quizAnswerFits('number', '42')).toBe(false)
    expect(quizAnswerFits('date', '1789-07-14')).toBe(true)
    expect(quizAnswerFits('date', '14/07/1789')).toBe(false)
    expect(quizAnswerFits('short_text', ['Paris', 'Lutèce'])).toBe(true)
    expect(quizAnswerFits('short_text', 'Paris')).toBe(false)
    expect(quizAnswerFits('long_text', ['Paris'])).toBe(false)
  })

  it('reads a written answer the way a person would', () => {
    expect(looseText('  Élysée   Palace ')).toBe('elysee palace')
    expect(isRightAnswer('short_text', ['Lutèce', 'Paris'], 'lutece')).toBe(true)
    expect(isRightAnswer('short_text', ['Paris'], 'Lyon')).toBe(false)
  })

  it('grades every kind, and nothing answered is never right', () => {
    expect(isRightAnswer('select', 'b', 'b')).toBe(true)
    expect(isRightAnswer('select', 'b', 'a')).toBe(false)
    expect(isRightAnswer('multi_select', ['a', 'c'], ['c', 'a'])).toBe(true)
    expect(isRightAnswer('multi_select', ['a', 'c'], ['a'])).toBe(false)
    expect(isRightAnswer('multi_select', ['a', 'c'], ['a', 'b', 'c'])).toBe(false)
    expect(isRightAnswer('boolean', false, false)).toBe(true)
    expect(isRightAnswer('boolean', true, null)).toBe(false)
    expect(isRightAnswer('number', 3.5, '3,5')).toBe(true)
    expect(isRightAnswer('number', 0, 0)).toBe(true)
    expect(isRightAnswer('date', '1789-07-14', '1789-07-14')).toBe(true)
    expect(isRightAnswer('select', 'b', '')).toBe(false)
  })

  it('scores what was shown, and nothing else', () => {
    const questions = [
      { field: 'nom', kind: 'short_text', correct: null, points: 1 },
      { field: 'capitale', kind: 'select', correct: 'paris', points: 2 },
      { field: 'fleuve', kind: 'short_text', correct: ['Seine'], points: 1 },
      { field: 'bonus', kind: 'boolean', correct: true, points: 3 },
    ]
    const answers = { nom: 'Léa', capitale: 'paris', fleuve: 'la loire', bonus: true }
    const all = scoreQuiz(questions, answers, new Set(['nom', 'capitale', 'fleuve', 'bonus']))
    expect(all).toMatchObject({ score: 5, max: 6 })
    expect(all.marks.map((m) => m.right)).toEqual([true, false, true])
    // The bonus question was hidden: it is neither won nor lost.
    const hidden = scoreQuiz(questions, answers, new Set(['nom', 'capitale', 'fleuve']))
    expect(hidden).toMatchObject({ score: 2, max: 3 })
  })

  it('says whether the pass mark is reached', () => {
    expect(quizPercent(7, 10)).toBe(70)
    expect(quizPercent(0, 0)).toBe(0)
    expect(quizPassed(7, 10, 70)).toBe(true)
    expect(quizPassed(6, 10, 70)).toBe(false)
    expect(quizPassed(6, 10, null)).toBe(null)
  })
})
