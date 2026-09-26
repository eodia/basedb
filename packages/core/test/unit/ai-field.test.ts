import { describe, expect, it } from 'vitest'
import {
  MAX_VALUE_CHARS,
  canonicalizePrompt,
  citedNames,
  formatValue,
  renderPrompt,
} from '../../src/ai/prompt.js'
import { checkSchedule, nextRun, nextRuns, parseCron } from '../../src/ai/schedule.js'
import type { BasedbError } from '../../src/errors/index.js'

/**
 * The AI field without a database — chapter 12 §9: when it runs (a cron read in a time
 * zone) and what it sends (a prompt whose citations become the row's values).
 */

function refusal(fn: () => unknown): { code: string; reason: unknown; variable?: unknown } {
  try {
    fn()
  } catch (e) {
    const error = e as BasedbError
    return {
      code: error.code,
      reason: error.details?.reason,
      variable: error.details?.variable,
    }
  }
  throw new Error('aucun refus')
}

describe('a schedule', () => {
  it('reads the five classic fields, lists, ranges and steps', () => {
    const cron = parseCron('*/15 8-18 * * 1-5')
    expect([...cron.minute]).toEqual([0, 15, 30, 45])
    expect(cron.hour.size).toBe(11)
    expect([...cron.weekday]).toEqual([1, 2, 3, 4, 5])
    expect(cron.dayRestricted).toBe(false)
    expect(cron.weekdayRestricted).toBe(true)

    expect([...parseCron('0 9 1,15 * *').day]).toEqual([1, 15])
    // Sunday is 0 and 7.
    expect([...parseCron('0 9 * * 7').weekday]).toEqual([0])
  })

  it('refuses what is not an expression, saying where', () => {
    for (const bad of [
      '* * * *',
      '60 * * * *',
      '0 24 * * *',
      'a * * * *',
      '0 0 0 * *',
      '*/0 * * * *',
    ]) {
      expect(
        refusal(() => parseCron(bad)),
        bad,
      ).toMatchObject({
        code: 'REQUEST_INVALID',
        reason: 'cron_invalide',
      })
    }
  })

  it('is read in the author’s time zone, summer and winter alike', () => {
    const daily = parseCron('0 8 * * *')
    // 8 h in Paris in September is 6 h UTC …
    expect(nextRun(daily, 'Europe/Paris', new Date('2026-09-25T12:00:00Z'))?.toISOString()).toBe(
      '2026-09-26T06:00:00.000Z',
    )
    // … and 7 h UTC once summer time ends, on 25 October 2026.
    expect(nextRun(daily, 'Europe/Paris', new Date('2026-10-24T12:00:00Z'))?.toISOString()).toBe(
      '2026-10-25T07:00:00.000Z',
    )
    expect(nextRun(daily, 'UTC', new Date('2026-09-25T12:00:00Z'))?.toISOString()).toBe(
      '2026-09-26T08:00:00.000Z',
    )
  })

  it('takes a day matching EITHER restricted day, as every cron does', () => {
    // Friday 25 September 2026: the next Monday comes before the 1st of October.
    const run = nextRun(parseCron('0 8 1 * 1'), 'UTC', new Date('2026-09-25T12:00:00Z'))
    expect(run?.toISOString()).toBe('2026-09-28T08:00:00.000Z')
  })

  it('lists the next runs, strictly after one another', () => {
    const runs = nextRuns(parseCron('30 9 * * 1'), 'UTC', new Date('2026-09-25T12:00:00Z'), 3)
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-09-28T09:30:00.000Z',
      '2026-10-05T09:30:00.000Z',
      '2026-10-12T09:30:00.000Z',
    ])
  })

  it('refuses a zone it does not know, a date that never comes, and a pace too quick', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    expect(refusal(() => checkSchedule('0 8 * * *', 'Europe/Nulle-Part', now)).reason).toBe(
      'fuseau_inconnu',
    )
    expect(refusal(() => checkSchedule('0 0 31 2 *', 'UTC', now)).reason).toBe('cron_sans_date')
    expect(refusal(() => checkSchedule('*/5 * * * *', 'UTC', now)).reason).toBe(
      'frequence_trop_haute',
    )
    expect(refusal(() => checkSchedule('* 8 * * *', 'UTC', now)).reason).toBe(
      'frequence_trop_haute',
    )
    expect(() => checkSchedule('*/15 * * * *', 'UTC', now)).not.toThrow()
    expect(() => checkSchedule('0 */6 * * *', 'America/New_York', now)).not.toThrow()
  })
})

describe('a prompt', () => {
  const fields = [
    { name: 'nom', label: 'Nom', kind: 'short_text' },
    { name: 'notes_du_client', label: 'Notes du client', kind: 'long_text' },
    { name: 'resume', label: 'Résumé', kind: 'short_text' },
  ]

  it('keeps every citation under the physical name, whatever the reader typed', () => {
    const canonical = canonicalizePrompt(
      'Résume {{ notes du CLIENT }} pour {{Nom}}, puis {{nom}} encore.',
      fields,
      'resume',
    )
    expect(canonical.prompt).toBe('Résume {{notes_du_client}} pour {{nom}}, puis {{nom}} encore.')
    expect(canonical.cited).toEqual(['notes_du_client', 'nom'])
    expect(citedNames(canonical.prompt)).toEqual(['notes_du_client', 'nom'])
  })

  it('refuses a citation that designates nothing, the field itself, and no prompt at all', () => {
    expect(refusal(() => canonicalizePrompt('Lis {{Adresse}}', fields, 'resume'))).toMatchObject({
      code: 'REQUEST_INVALID',
      reason: 'variable_inconnue',
      variable: 'Adresse',
    })
    expect(
      refusal(() => canonicalizePrompt('Reprends {{Résumé}}', fields, 'resume')),
    ).toMatchObject({ reason: 'variable_circulaire' })
    expect(refusal(() => canonicalizePrompt('   ', fields, 'resume')).reason).toBe('consigne_vide')
    expect(refusal(() => canonicalizePrompt('x'.repeat(8001), fields, null)).reason).toBe(
      'consigne_trop_longue',
    )
  })

  it('puts the row’s values in place, an unknown one read as empty', () => {
    const text = renderPrompt(
      'Résume {{notes_du_client}} pour {{nom}} ({{supprime}}).',
      new Map([
        ['notes_du_client', 'Fuite sous l’évier'],
        ['nom', 'Martin'],
      ]),
    )
    expect(text).toBe('Résume Fuite sous l’évier pour Martin ((vide)).')
  })

  it('writes each value as a person would read it', () => {
    expect(formatValue(null, { kind: 'short_text' })).toBe('(vide)')
    expect(formatValue('12.500', { kind: 'number' })).toBe('12.5')
    expect(formatValue('10.000', { kind: 'number' })).toBe('10')
    expect(formatValue('100', { kind: 'number' })).toBe('100')
    expect(formatValue(true, { kind: 'boolean' })).toBe('oui')
    const options = new Map([
      ['urgent', 'Urgent'],
      ['a_suivre', 'À suivre'],
    ])
    expect(formatValue('urgent', { kind: 'select', options })).toBe('Urgent')
    expect(formatValue(['urgent', 'a_suivre'], { kind: 'multi_select', options })).toBe(
      'Urgent, À suivre',
    )
    expect(
      formatValue('0190a000-0000-7000-8000-000000000001', {
        kind: 'link',
        displays: new Map([['0190a000-0000-7000-8000-000000000001', 'Chantier Nord']]),
      }),
    ).toBe('Chantier Nord')
    expect(
      formatValue(
        [
          { id: 'x', name: 'devis.pdf' },
          { id: 'y', name: 'plan.png' },
        ],
        {
          kind: 'file',
        },
      ),
    ).toBe('devis.pdf, plan.png')
    expect([...formatValue('é'.repeat(MAX_VALUE_CHARS + 50), { kind: 'long_text' })]).toHaveLength(
      MAX_VALUE_CHARS,
    )
  })
})
