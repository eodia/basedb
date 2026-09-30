import { describe, expect, it } from 'vitest'
import { type FieldDefault, resolveDefaults, todayIn } from '../../src/records/defaults.js'

/** Default values — chapter 04 §1.5: what each kind gives one write. */

const ME = '01a0e32d-6d27-783d-848e-e71c9462271a'

describe('today', () => {
  it('is the date where the person is, not in UTC', () => {
    // 23:30 UTC on 30 September: already 1 October in Paris, still 30 September in New York.
    const at = new Date('2026-09-30T23:30:00Z')
    expect(todayIn('Europe/Paris', at)).toBe('2026-10-01')
    expect(todayIn('America/New_York', at)).toBe('2026-09-30')
  })

  it('reads an unknown zone as UTC rather than failing the write', () => {
    expect(todayIn('Nulle/Part', new Date('2026-09-30T23:30:00Z'))).toBe('2026-09-30')
  })
})

describe('resolving the defaults of one write', () => {
  const defaults = new Map<string, FieldDefault>([
    ['statut', { kind: 'value', value: 'nouveau' }],
    ['ouvert_le', { kind: 'today' }],
    ['horodatage', { kind: 'now' }],
    ['responsable', { kind: 'me' }],
  ])
  const at = new Date('2026-09-30T10:00:00Z')

  it('gives each field its value', () => {
    const out = resolveDefaults(defaults, { actorId: ME, timeZone: 'Europe/Paris', at })
    expect(Object.fromEntries(out)).toEqual({
      statut: 'nouveau',
      ouvert_le: '2026-09-30',
      horodatage: '2026-09-30T10:00:00.000Z',
      responsable: ME,
    })
  })

  it('leaves « the person creating » empty when nobody is — a public form', () => {
    const out = resolveDefaults(defaults, { actorId: null, timeZone: 'UTC', at })
    expect(out.has('responsable')).toBe(false)
    expect(out.get('statut')).toBe('nouveau')
  })
})
