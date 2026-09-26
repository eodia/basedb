import { describe, expect, it } from 'vitest'
import { icsCalendar, parseIcs } from '../../src/integrations/ical.js'
import { checkedSlackUrl } from '../../src/integrations/slack.js'
import { parseCsv, readCsv, sharedViewApi } from '../../src/sync/sources.js'

/**
 * Integrations, the parts that are pure — chapter 19.
 *
 * What these guard: a CSV is read as its author wrote it — quotes, separator, types; an
 * agenda's local times land at the right instant; a feed is folded and escaped as the
 * format wants, a whole day ending the next day; only Slack's own address is taken.
 */

describe('a CSV source', () => {
  it('reads quoted fields, doubled quotes and a guessed separator', () => {
    expect(parseCsv('a;b\n"x;1";"dit ""oui"""\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'dit "oui"'],
    ])
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('types its columns by their content, and keys rows by `id`', () => {
    const data = readCsv('nom,id,prix,jour\nVis,A1,"1,5",2026-10-01\nÉcrou,A2,2,2026-10-02\n')
    expect(data.columns.map((c) => [c.label, c.kind])).toEqual([
      ['nom', 'short_text'],
      ['id', 'short_text'],
      ['prix', 'number'],
      ['jour', 'date'],
    ])
    expect(data.rows.map((r) => r.key)).toEqual(['A1', 'A2'])
    expect(data.rows[0]?.values).toMatchObject({ c2: 1.5, c3: '2026-10-01' })
  })

  it('names the empty and the doubled headers, and keeps doubled keys apart', () => {
    const data = readCsv('id,,nom,nom\n1,a,b,c\n1,d,e,f\n')
    expect(data.columns.map((c) => c.label)).toEqual(['id', 'Colonne 2', 'nom', 'nom (2)'])
    expect(data.rows.map((r) => r.key)).toEqual(['1', '1#2'])
  })
})

describe('an agenda', () => {
  it('reads events, a local time in its zone, a whole day at midnight', () => {
    const events = parseIcs(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:a',
        'SUMMARY:Point\\, hebdo',
        'DTSTART;TZID=Europe/Paris:20261005T090000',
        'DESCRIPTION:ligne 1\\nligne',
        ' 2',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:Férié',
        'DTSTART;VALUE=DATE:20261101',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    )
    expect(events[0]).toMatchObject({
      uid: 'a',
      summary: 'Point, hebdo',
      start: '2026-10-05T07:00:00.000Z',
      description: 'ligne 1\nligne2',
    })
    expect(events[1]).toMatchObject({
      start: '2026-11-01T00:00:00.000Z',
      uid: '2026-11-01T00:00:00.000Z|Férié',
    })
  })

  it('writes a feed an agenda reads: escaped, folded, a whole day ending the next', () => {
    const text = icsCalendar(
      'Chantiers',
      [
        {
          uid: 'r1@basedb',
          summary: 'Livraison; ciment, sable',
          description: `Adresse : ${'rue '.repeat(30)}`,
          start: { date: '2026-10-09' },
          end: null,
        },
      ],
      new Date('2026-09-26T10:00:00Z'),
    )
    expect(text).toContain('SUMMARY:Livraison\\; ciment\\, sable')
    expect(text).toContain('DTSTART;VALUE=DATE:20261009\r\nDTEND;VALUE=DATE:20261010')
    expect(text.split('\r\n').every((line) => Buffer.byteLength(line) <= 75)).toBe(true)
    // Read back, the folded description is whole again.
    expect(parseIcs(text)[0]?.description).toBe(`Adresse : ${'rue '.repeat(30)}`)
  })
})

describe('the addresses a source or a connection takes', () => {
  it('takes only an incoming webhook of Slack', () => {
    expect(checkedSlackUrl('https://hooks.slack.com/services/T0/B0/xyz')).toBe(
      'https://hooks.slack.com/services/T0/B0/xyz',
    )
    expect(() => checkedSlackUrl('https://exemple.fr/services/x')).toThrow()
    expect(() => checkedSlackUrl('http://hooks.slack.com/services/x')).toThrow()
  })

  it('finds the API of a shared view from its page or its API link', () => {
    const token = 'AbCdEf0123456789_-xyz'
    expect(sharedViewApi(`https://app.exemple.fr/v/${token}`)).toBe(
      `https://app.exemple.fr/api/v1/views/${token}`,
    )
    expect(sharedViewApi(`https://api.exemple.fr/api/v1/views/${token}/`)).toBe(
      `https://api.exemple.fr/api/v1/views/${token}`,
    )
    expect(() => sharedViewApi('https://exemple.fr/autre')).toThrow()
  })
})
