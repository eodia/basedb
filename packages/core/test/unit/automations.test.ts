import { describe, expect, it } from 'vitest'
import { nextRunOf } from '../../src/automations/catalog.js'
import { type Citable, render, renderFilter } from '../../src/automations/engine.js'
import type { ProjectedField } from '../../src/catalog/projection.js'

/**
 * Automations, the parts that are pure — chapter 17.
 *
 * What these guard: a schedule falls at the wall-clock time asked, in its time zone, the
 * day the clocks change included; a message cites the row as it reads, and what the steps
 * before found or were answered; a filter compares a cited value, never runs it.
 */

const paris = { timezone: 'Europe/Paris', weekday: 1 }

describe('the next run of a schedule', () => {
  it('falls every day at the local time asked', () => {
    // 10:00 in Paris on 26 September (UTC+2) is 08:00 UTC: 07:30 has passed.
    const next = nextRunOf(
      { ...paris, every: 'day', at: '07:30' },
      new Date('2026-09-26T08:00:00Z'),
    )
    expect(next.toISOString()).toBe('2026-09-27T05:30:00.000Z')
  })

  it('keeps the local time across the change of clocks', () => {
    // The clocks go back on 25 October: 07:30 in Paris is then 06:30 UTC.
    const next = nextRunOf(
      { ...paris, every: 'day', at: '07:30' },
      new Date('2026-10-24T12:00:00Z'),
    )
    expect(next.toISOString()).toBe('2026-10-25T06:30:00.000Z')
  })

  it('falls on the weekday asked, and every hour at the minute asked', () => {
    // Saturday 26 September → Monday 28 at 09:00 Paris.
    const monday = nextRunOf(
      { ...paris, every: 'week', at: '09:00' },
      new Date('2026-09-26T08:00:00Z'),
    )
    expect(monday.toISOString()).toBe('2026-09-28T07:00:00.000Z')
    const hourly = nextRunOf(
      { ...paris, every: 'hour', at: '00:15' },
      new Date('2026-09-26T08:20:00Z'),
    )
    expect(hourly.toISOString()).toBe('2026-09-26T09:15:00.000Z')
  })
})

describe('a message citing the row', () => {
  const fields = new Map<string, ProjectedField>([
    ['nom', { name: 'nom', kind: 'short_text' } as ProjectedField],
    [
      'statut',
      {
        name: 'statut',
        kind: 'select',
        options: [{ value: 'fait', label: 'Fait' }],
      } as unknown as ProjectedField,
    ],
    ['client', { name: 'client', kind: 'link' } as ProjectedField],
    ['responsable', { name: 'responsable', kind: 'user' } as ProjectedField],
  ])
  const row = {
    _id: 'r1',
    nom: 'Peindre',
    statut: 'fait',
    client: { id: 'c1', display: 'ACME' },
    responsable: 'u1',
  }
  const scope = (
    trigger: Record<string, unknown> | null,
    more: Partial<Omit<Citable, 'rows'>> & { rows?: Citable['rows'] } = {},
  ): Citable => ({
    rows: new Map([
      ['trigger', { table: 't1', fields, row: trigger }],
      ...(more.rows ?? new Map()),
    ]),
    data: more.data ?? new Map(),
    people: more.people ?? new Map(),
    now: more.now ?? new Date(),
  })

  it('reads each value as a person would', () => {
    expect(
      render(
        '{{nom}} ({{ statut }}) pour {{client}}, par {{responsable}} — {{_id}}',
        scope(row, { people: new Map([['u1', 'Marie']]) }),
      ),
    ).toBe('Peindre (Fait) pour ACME, par Marie — r1')
  })

  it('leaves empty what it cannot read, and says when', () => {
    const now = new Date('2026-09-26T10:00:00Z')
    expect(render('{{secret}}|{{_maintenant}}', scope(row, { now }))).toBe(
      '|2026-09-26T10:00:00.000Z',
    )
    expect(render('{{nom}}', scope(null))).toBe('')
  })

  it('cites what the steps before gave: a row found, a webhook’s answer', () => {
    const found = { table: 't2', fields, row: { _id: 'r2', nom: 'Vernir', statut: 'fait' } }
    const cited = scope(row, {
      rows: new Map([['e1', found]]),
      data: new Map([['e2', { statut: 201, reponse: { devis: { numero: 'D-7' } } }]]),
    })
    expect(render('{{e1.nom}} ({{e1.statut}}) {{e1._id}}', cited)).toBe('Vernir (Fait) r2')
    expect(render('{{e2.statut}} {{e2.reponse.devis.numero}} {{e9.nom}}', cited)).toBe('201 D-7 ')
  })
})

describe('a filter citing the row', () => {
  const fields = new Map<string, ProjectedField>([
    ['nom', { name: 'nom', kind: 'short_text' } as ProjectedField],
    ['client', { name: 'client', kind: 'link' } as ProjectedField],
  ])
  const cited = (row: Record<string, unknown>): Citable => ({
    rows: new Map([['trigger', { table: 't1', fields, row }]]),
    data: new Map([['e2', { statut: 200, reponse: { actif: true } }]]),
    people: new Map(),
    now: new Date(),
  })

  it('compares what a row holds, never reads it as the filter’s own words', () => {
    const row = { _id: 'r1', nom: 'x" or _id ne "', client: { id: 'c1', display: 'ACME' } }
    expect(renderFilter('nom eq {{nom}}', cited(row))).toBe('nom eq "x\\" or _id ne \\""')
    // Already inside quotes: escaped only.
    expect(renderFilter('nom contains "a {{nom}}"', cited(row))).toBe(
      'nom contains "a x\\" or _id ne \\""',
    )
  })

  it('names a relation by its row, and leaves a number and a boolean bare', () => {
    const row = { _id: 'r1', nom: 'Peindre', client: { id: 'c1', display: 'ACME' } }
    expect(renderFilter('client eq {{client}} and actif eq {{e2.reponse.actif}}', cited(row))).toBe(
      'client eq "c1" and actif eq true',
    )
    expect(renderFilter('code eq {{e2.statut}}', cited(row))).toBe('code eq 200')
  })
})
