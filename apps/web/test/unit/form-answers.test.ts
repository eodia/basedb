import { describe, expect, it } from 'vitest'
import {
  answerProblem,
  choiceKey,
  minutesFor,
  normalizeUrl,
  todayAnswer,
  widgetOf,
} from '../../src/components/app/forms/answers'
import { accentOf, onAccent } from '../../src/components/app/forms/theme'
import type { Field } from '../../src/lib/api/client'

const field = (kind: string, extra: Partial<Field> = {}): Field =>
  ({ name: kind, label: kind, description: null, kind, ...extra }) as Field

describe('the answers of a form', () => {
  it('asks each field the way it reads best', () => {
    expect(widgetOf(field('number', { format: { display: 'rating', rating_max: 5 } }))).toBe(
      'rating',
    )
    expect(widgetOf(field('short_text', { format: { display: 'phone' } }))).toBe('phone')
    expect(widgetOf(field('select', { options: [] }))).toBe('choice')
    expect(widgetOf(field('link'))).toBe('panel')
  })

  it('says how long a survey takes, never less than a minute', () => {
    expect(minutesFor([field('boolean')])).toBe(1)
    expect(minutesFor(Array.from({ length: 6 }, () => field('long_text')))).toBe(3)
  })

  it('completes an address typed without its scheme, and checks what is not right yet', () => {
    expect(normalizeUrl('exemple.fr')).toBe('https://exemple.fr')
    expect(normalizeUrl('http://exemple.fr')).toBe('http://exemple.fr')
    expect(answerProblem('email', 'lea@exemple')).not.toBeNull()
    expect(answerProblem('email', 'lea@exemple.fr')).toBeNull()
    expect(answerProblem('number', 'douze')).not.toBeNull()
    expect(answerProblem('number', 12)).toBeNull()
    expect(answerProblem('text', '')).toBeNull()
  })

  it('gives each choice a key, as far as the alphabet goes', () => {
    expect(choiceKey(0)).toBe('A')
    expect(choiceKey(25)).toBe('Z')
    expect(choiceKey(26)).toBeNull()
  })

  it('holds the day in the reader’s own calendar, and a date and time to the minute', () => {
    // Late in the evening: the day is the reader's, whatever it already is in UTC.
    const late = new Date(2026, 0, 5, 23, 47, 31, 500)
    expect(todayAnswer('date', late)).toBe('2026-01-05')
    expect(todayAnswer('datetime', late)).toBe(new Date(2026, 0, 5, 23, 47).toISOString())
  })
})

describe('the look of a form', () => {
  const look = {
    theme: 'clair' as const,
    accent: '',
    font: 'auto' as const,
    align: 'left' as const,
  }

  it('wears its own accent, else its table’s, else its theme’s', () => {
    expect(accentOf({ ...look, accent: '#123456' }, '#abcdef')).toBe('#123456')
    expect(accentOf(look, '#abcdef')).toBe('#abcdef')
    expect(accentOf(look, null)).toBe('#4f46e5')
  })

  it('writes on the accent in a colour that reads', () => {
    expect(onAccent('#111111')).toBe('#ffffff')
    expect(onAccent('#fde68a')).toBe('#0b0b0f')
  })
})
