import { describe, expect, it } from 'vitest'
import {
  ImportError,
  chunk,
  convert,
  detectDelimiter,
  inferKind,
  labelFromFileName,
  matchColumns,
  parseBoolean,
  parseCsvText,
  parseDateParts,
  parseDelimited,
  parseJsonText,
  parseNumber,
  parseText,
} from '../../src/lib/import'

/**
 * Reading a file, and turning what it holds into values a field accepts.
 *
 * The module has no server and no DOM, which is the point: every decision a person would
 * otherwise discover as a refused batch — is `1,5` a number, is `05/03/2026` March or May —
 * is made here, where a test can pin it.
 */

const field = (name: string, label: string, kind = 'short_text') =>
  ({ name, label, kind, description: null }) as never

describe('delimited text', () => {
  it('honours quotes: a cell may hold the separator, a line break and a doubled quote', () => {
    const rows = parseDelimited('a,"b,c","d\ne","say ""hi"""\n1,2,3,4', ',')
    expect(rows).toEqual([
      ['a', 'b,c', 'd\ne', 'say "hi"'],
      ['1', '2', '3', '4'],
    ])
  })

  it('reads CRLF, lone CR and a missing final newline alike, and drops a BOM and blank lines', () => {
    expect(parseDelimited('﻿a;b\r\n\r\n1;2\r3;4', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('refuses a quote that is never closed: the file is cut off, not merely odd', () => {
    expect(() => parseDelimited('a,"b\n1,2', ',')).toThrow(ImportError)
  })

  it('finds the separator from the way the first lines split', () => {
    expect(detectDelimiter('nom;montant\nA;"1,5"\nB;"2,5"')).toBe(';')
    expect(detectDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',')
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
    expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|')
    expect(detectDelimiter('un seul champ\nautre ligne')).toBe(',')
  })

  it('a decimal comma does not make a semicolon file a comma file', () => {
    expect(detectDelimiter('prix;qte\n1,5;2\n2,25;3\n3,75;4')).toBe(';')
  })
})

describe('the table built from it', () => {
  it('takes the first row as the header, turns blanks into null and pads short rows', () => {
    const t = parseCsvText('Nom,Ville,Age\nCamille,,31\nThomas,Lyon', { hasHeader: true })
    expect(t.columns).toEqual(['Nom', 'Ville', 'Age'])
    expect(t.rows).toEqual([
      ['Camille', null, '31'],
      ['Thomas', 'Lyon', null],
    ])
    expect(t.delimiter).toBe(',')
  })

  it('names blank and repeated columns, so no two of them collide', () => {
    const t = parseCsvText('Nom,,Nom\na,b,c', { hasHeader: true })
    expect(t.columns).toEqual(['Nom', 'Colonne 2', 'Nom (2)'])
  })

  it('without a header, every row is data and the columns are numbered', () => {
    const t = parseCsvText('a,b\nc,d', { hasHeader: false })
    expect(t.columns).toEqual(['Colonne 1', 'Colonne 2'])
    expect(t.rows).toHaveLength(2)
  })

  it('refuses an empty file and a file that is only a header', () => {
    expect(() => parseCsvText('', { hasHeader: true })).toThrow('vide')
    expect(() => parseCsvText('a,b', { hasHeader: true })).toThrow('aucune donnée')
  })
})

describe('JSON', () => {
  it('reads an array of objects: the keys are the columns, in first-seen order', () => {
    const t = parseJsonText('[{"nom":"A","age":3},{"nom":"B","ville":"Lyon"}]', { hasHeader: true })
    expect(t.columns).toEqual(['nom', 'age', 'ville'])
    expect(t.rows).toEqual([
      ['A', 3, null],
      ['B', null, 'Lyon'],
    ])
  })

  it('reads an array of arrays, first row the header when asked', () => {
    expect(parseJsonText('[["a","b"],[1,2]]', { hasHeader: true }).rows).toEqual([[1, 2]])
    expect(parseJsonText('[["a","b"],[1,2]]', { hasHeader: false }).rows).toHaveLength(2)
  })

  it('finds the rows under the usual key, or under the only array there is', () => {
    expect(parseJsonText('{"data":[{"a":1}]}', { hasHeader: true }).rows).toEqual([[1]])
    expect(parseJsonText('{"meta":{"n":1},"lignes":[{"a":2}]}', { hasHeader: true }).rows).toEqual([
      [2],
    ])
  })

  it('reads one JSON value per line', () => {
    const t = parseJsonText('{"a":1}\n{"a":2}\n', { hasHeader: true })
    expect(t.rows).toEqual([[1], [2]])
  })

  it('keeps a nested value as text a person can read, and never as [object Object]', () => {
    const t = parseJsonText('[{"a":{"b":1},"c":[1,2]}]', { hasHeader: true })
    expect(t.rows[0]).toEqual(['{"b":1}', '[1,2]'])
  })

  it('refuses what is not a list of rows', () => {
    expect(() => parseJsonText('not json', { hasHeader: true })).toThrow('JSON valide')
    expect(() => parseJsonText('{"a":1}', { hasHeader: true })).toThrow('liste de lignes')
    expect(() => parseJsonText('[1,2]', { hasHeader: true })).toThrow('objets')
  })

  it('is picked by the extension or the first character, and a .csv is never JSON', () => {
    expect(parseText('x.json', '[{"a":1}]', { hasHeader: true }).format).toBe('json')
    expect(parseText('x', '[{"a":1}]', { hasHeader: true }).format).toBe('json')
    expect(parseText('x.csv', 'a,b\n1,2', { hasHeader: true }).format).toBe('csv')
    expect(parseText('x.txt', '[a],[b]\n1,2', { hasHeader: true }).format).toBe('csv')
  })
})

describe('numbers', () => {
  it.each([
    ['12', 12],
    ['-3.5', -3.5],
    ['12,5', 12.5],
    ['1 234,56', 1234.56],
    ['1 234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['+7', 7],
    [42, 42],
  ])('reads %s as %s', (raw, expected) => {
    expect(parseNumber(raw as never)).toBe(expected)
  })

  it.each(['abc', '12abc', '1,2,3', '', '--1', '1e3', 'NaN'])('refuses %s', (raw) => {
    expect(parseNumber(raw)).toBeNull()
  })
})

describe('booleans', () => {
  it('reads the words of both languages, and 1 and 0', () => {
    for (const yes of ['true', 'Vrai', 'OUI', 'yes', '1', 'x', true, 1]) {
      expect(parseBoolean(yes as never)).toBe(true)
    }
    for (const no of ['false', 'Faux', 'non', 'NO', '0', false, 0]) {
      expect(parseBoolean(no as never)).toBe(false)
    }
    for (const other of ['peut-être', '2', '', 2]) expect(parseBoolean(other as never)).toBeNull()
  })
})

describe('dates', () => {
  it('reads ISO and day-first, with any of / - .', () => {
    expect(parseDateParts('2026-03-05')).toEqual({ date: '2026-03-05', time: null })
    expect(parseDateParts('05/03/2026')).toEqual({ date: '2026-03-05', time: null })
    expect(parseDateParts('5.3.2026')).toEqual({ date: '2026-03-05', time: null })
    expect(parseDateParts('05-03-2026')).toEqual({ date: '2026-03-05', time: null })
  })

  it('a slashed date is DAY first: 03/05 is the third of May', () => {
    expect(parseDateParts('03/05/2026')?.date).toBe('2026-05-03')
  })

  it('reads a time, seconds and fractions, and a zone when there is one', () => {
    expect(parseDateParts('2026-03-05T14:30')?.time).toBe('14:30:00')
    expect(parseDateParts('05/03/2026 09:05:07')?.time).toBe('09:05:07')
    expect(parseDateParts('2026-03-05 14:30:15.250')?.time).toBe('14:30:15.250')
    expect(parseDateParts('2026-03-05T14:30:00+02:00')?.time).toBe('14:30:00+02:00')
    expect(parseDateParts('2026-03-05T14:30:00Z')?.time).toBe('14:30:00Z')
  })

  it('refuses a day the calendar does not have, an hour it does not have, and a two-digit year', () => {
    for (const bad of [
      '2026-02-30',
      '31/04/2026',
      '2026-13-01',
      '05/03/26',
      '2026-03-05T25:00',
      'demain',
    ]) {
      expect(parseDateParts(bad), bad).toBeNull()
    }
    expect(parseDateParts('29/02/2028')?.date).toBe('2028-02-29')
    expect(parseDateParts('29/02/2027')).toBeNull()
  })
})

describe('guessing the type of a column', () => {
  it('numbers, booleans, dates, datetimes and text', () => {
    expect(inferKind(['1', '2,5', '-3'])).toBe('number')
    expect(inferKind(['oui', 'non', 'Oui'])).toBe('boolean')
    expect(inferKind(['2026-01-01', '05/03/2026'])).toBe('date')
    expect(inferKind(['2026-01-01', '2026-03-05 14:30'])).toBe('datetime')
    expect(inferKind(['Camille', 'Thomas'])).toBe('short_text')
    expect(inferKind(['x'.repeat(300)])).toBe('long_text')
  })

  it('reads the WHOLE column: one stray word makes a column of numbers text', () => {
    expect(inferKind(['1', '2', '3', 'trois'])).toBe('short_text')
  })

  it('a column of zeros and ones is numbers, not a checkbox', () => {
    expect(inferKind(['0', '1', '1', '0'])).toBe('number')
    expect(inferKind([true, false])).toBe('boolean')
  })

  it('an identifier with a leading zero stays text', () => {
    expect(inferKind(['007', '042'])).toBe('short_text')
    expect(inferKind(['0.5', '0,25'])).toBe('number')
  })

  it('ignores empty cells, and an empty column is text', () => {
    expect(inferKind([null, '3', '', '4'])).toBe('number')
    expect(inferKind([null, null])).toBe('short_text')
  })
})

describe('converting a cell for a field', () => {
  const ok = (cell: never, kind: string, options?: never) => {
    const r = convert(cell, kind, options)
    if (!r.ok) throw new Error(`refused: ${r.reason}`)
    return r.value
  }

  it('an empty cell is nothing, whatever the type', () => {
    for (const kind of ['short_text', 'number', 'boolean', 'date', 'datetime', 'select']) {
      expect(ok(null as never, kind)).toBeNull()
      expect(ok('   ' as never, kind)).toBeNull()
    }
  })

  it('reads by the field, not by the text: 007 is text in a text field and 7 in a number', () => {
    expect(ok('007' as never, 'short_text')).toBe('007')
    expect(ok('007' as never, 'number')).toBe(7)
    expect(ok(' Camille ' as never, 'short_text')).toBe('Camille')
    expect(ok(12 as never, 'short_text')).toBe('12')
  })

  it('dates become ISO days, datetimes gain midnight or keep their time', () => {
    expect(ok('05/03/2026' as never, 'date')).toBe('2026-03-05')
    expect(ok('2026-03-05T14:30' as never, 'date')).toBe('2026-03-05')
    expect(ok('05/03/2026' as never, 'datetime')).toBe('2026-03-05T00:00:00')
    expect(ok('05/03/2026 14:30' as never, 'datetime')).toBe('2026-03-05T14:30:00')
    expect(ok('2026-03-05T14:30:00+02:00' as never, 'datetime')).toBe('2026-03-05T14:30:00+02:00')
  })

  it('a select takes the stored value, whether the file holds the value or the label', () => {
    const options = [
      { value: 'a_contacter', label: 'À contacter', color: null, icon: null, image: null },
      { value: 'actif', label: 'Actif', color: null, icon: null, image: null },
    ] as never
    expect(ok('actif' as never, 'select', options)).toBe('actif')
    expect(ok('ACTIF' as never, 'select', options)).toBe('actif')
    expect(ok('à contacter' as never, 'select', options)).toBe('a_contacter')
    expect(ok('A contacter' as never, 'select', options)).toBe('a_contacter')
  })

  it('says WHY a cell cannot be read, for the screen to show', () => {
    const why = (cell: string, kind: string) => {
      const r = convert(cell, kind, [])
      return r.ok ? null : r.reason
    }
    expect(why('douze', 'number')).toBe('nombre invalide')
    expect(why('peut-être', 'boolean')).toContain('oui/non')
    expect(why('hier', 'date')).toContain('date invalide')
    expect(why('hier', 'datetime')).toContain('invalides')
    expect(why('inconnu', 'select')).toBe('valeur absente de la liste')
    expect(why('x', 'link')).toContain('ne s’importe pas')
  })
})

describe('matching columns to fields', () => {
  const fields = [
    field('raison_sociale', 'Raison sociale'),
    field('ville', 'Ville'),
    field('age', 'Âge', 'number'),
  ]

  it('by label or by name, folded — accents and case do not matter', () => {
    expect(matchColumns(['RAISON SOCIALE', 'ville', 'age', 'Autre'], fields)).toEqual([
      'raison_sociale',
      'ville',
      'age',
      null,
    ])
  })

  it('a field takes one column only: the second `Ville` is left unmatched', () => {
    expect(matchColumns(['Ville', 'Ville (2)', 'ville'], fields)).toEqual(['ville', null, null])
  })
})

describe('small helpers', () => {
  it('turns a file name into a label to start from', () => {
    expect(labelFromFileName('clients_2026.csv')).toBe('Clients 2026')
    expect(labelFromFileName('mes-factures.final.json')).toBe('Mes factures.final')
    expect(labelFromFileName('.csv')).toBe('Import')
  })

  it('chunks a list, keeping the order and the remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})
