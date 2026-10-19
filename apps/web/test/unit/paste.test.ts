import { describe, expect, it } from 'vitest'
import {
  type Directories,
  bulkWritable,
  clipboardText,
  compatible,
  convertPasted,
  editMode,
  enterFound,
  formatClipboard,
  ignoredSummary,
  linkCandidates,
  linkDirectory,
  memberDirectory,
  parseClipboard,
  planFill,
  planPaste,
  targetsOf,
} from '../../src/components/app/grid/paste'
import type { Field } from '../../src/lib/api/client'

/**
 * Pasting into the grid and filling a selection — chapter 11 §2.4.
 *
 * What these guard: a clipboard from a spreadsheet is read the way a spreadsheet wrote it
 * (quotes, line breaks inside a cell, CRLF); each cell becomes the value its FIELD takes,
 * the way typing it would; what cannot be written is left out and counted, not guessed;
 * and a value pasted over a range fills the range.
 */

const field = (over: Partial<Field> & { name: string; kind: string }): Field =>
  ({ label: over.name, description: null, ...over }) as Field

const nom = field({ name: 'nom', kind: 'short_text', label: 'Nom' })
const montant = field({ name: 'montant', kind: 'number', label: 'Montant' })
const statut = field({
  name: 'statut',
  kind: 'select',
  label: 'Statut',
  options: [
    { value: 'ouvert', label: 'Ouvert' },
    { value: 'clos', label: 'Clôturé' },
  ],
})
const note = field({ name: 'note', kind: 'short_text', label: 'Note', read_only: true })
const total = field({
  name: 'total',
  kind: 'formula',
  label: 'Total',
  computed: { result_kind: 'number', stored: true, multiple: false },
})
const echeance = field({ name: 'echeance', kind: 'date', label: 'Échéance' })

const AUDREY = '0190a0b2-0000-7000-8000-00000000000a'
const BASTIEN = '0190a0b2-0000-7000-8000-00000000000b'

describe('parseClipboard', () => {
  it('reads tab-separated lines, whatever ends them', () => {
    expect(parseClipboard('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(parseClipboard('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(parseClipboard('a\rb')).toEqual([['a'], ['b']])
  })

  it('drops the last line break, not a blank line inside, and an empty cell stays a cell', () => {
    expect(parseClipboard('a\n')).toEqual([['a']])
    expect(parseClipboard('a\n\nb')).toEqual([['a'], [''], ['b']])
    expect(parseClipboard('a\t\tb')).toEqual([['a', '', 'b']])
    // What a spreadsheet puts on the clipboard for one empty cell.
    expect(parseClipboard('\r\n')).toEqual([['']])
    expect(parseClipboard('')).toEqual([])
  })

  it('keeps a line break, a tab and a quote inside a quoted cell', () => {
    expect(parseClipboard('"première\nseconde"\tx')).toEqual([['première\nseconde', 'x']])
    expect(parseClipboard('"a\tb"\tc')).toEqual([['a\tb', 'c']])
    expect(parseClipboard('"elle a dit ""oui"""\tx\r\ny\tz')).toEqual([
      ['elle a dit "oui"', 'x'],
      ['y', 'z'],
    ])
    expect(parseClipboard('"a\r\nb"\r\nc')).toEqual([['a\r\nb'], ['c']])
  })

  it('opens a quote only at the start of a cell, and reads an unclosed one as text', () => {
    expect(parseClipboard('écran 5" large\tx')).toEqual([['écran 5" large', 'x']])
    expect(parseClipboard('"jamais fermé\tx\ny')).toEqual([['"jamais fermé', 'x'], ['y']])
  })

  it('drops a byte order mark', () => {
    const mark = String.fromCharCode(0xfeff)
    expect(parseClipboard(`${mark}a\tb`)).toEqual([['a', 'b']])
  })

  it('reads back what formatClipboard writes — a grid pasted into a grid', () => {
    const grid = [
      ['simple', 'avec\ttabulation', 'avec\nretour'],
      ['guillemet " seul', '', '"entre guillemets"'],
      ['', '', ''],
    ]
    expect(parseClipboard(formatClipboard(grid))).toEqual(grid)
  })
})

describe('what a field takes', () => {
  it('numbers the way the number editor reads them', () => {
    expect(convertPasted('1 234,5', montant)).toEqual({ ok: true, value: 1234.5 })
    expect(convertPasted('1 234,5', montant)).toEqual({ ok: true, value: 1234.5 })
    expect(convertPasted('-3', montant)).toEqual({ ok: true, value: -3 })
    const price = field({
      name: 'p',
      kind: 'number',
      format: { display: 'currency', currency: 'EUR' },
    })
    expect(convertPasted('12,50 €', price)).toEqual({ ok: true, value: 12.5 })
    const duration = field({ name: 'd', kind: 'number', format: { display: 'duration' } })
    expect(convertPasted('1:30', duration)).toEqual({ ok: true, value: 5400 })
    expect(convertPasted('douze', montant)).toEqual({ ok: false, reason: 'nombre invalide' })
  })

  it('a rating is a whole number within its stars', () => {
    const stars = field({ name: 'r', kind: 'number', format: { display: 'rating', rating_max: 5 } })
    expect(convertPasted('4', stars)).toEqual({ ok: true, value: 4 })
    expect(convertPasted('6', stars).ok).toBe(false)
    expect(convertPasted('2,5', stars).ok).toBe(false)
  })

  it('dates day first or ISO, a time in the reader’s own zone', () => {
    expect(convertPasted('25/09/2026', echeance)).toEqual({ ok: true, value: '2026-09-25' })
    expect(convertPasted('2026-09-25', echeance)).toEqual({ ok: true, value: '2026-09-25' })
    expect(convertPasted('31/02/2026', echeance).ok).toBe(false)
    expect(convertPasted('09/25/2026', echeance).ok).toBe(false)
    const at = field({ name: 'a', kind: 'datetime' })
    expect(convertPasted('25/09/2026 14:30', at)).toEqual({
      ok: true,
      value: new Date(2026, 8, 25, 14, 30).toISOString(),
    })
  })

  it('checkboxes from the words a spreadsheet writes', () => {
    const done = field({ name: 'fait', kind: 'boolean' })
    for (const yes of ['TRUE', 'oui', 'Vrai', '1', 'x']) {
      expect(convertPasted(yes, done)).toEqual({ ok: true, value: true })
    }
    for (const no of ['FALSE', 'non', 'faux', '0']) {
      expect(convertPasted(no, done)).toEqual({ ok: true, value: false })
    }
    expect(convertPasted('peut-être', done).ok).toBe(false)
  })

  it('a choice by its label or its value; an unknown one is refused, with the reason', () => {
    expect(convertPasted('Clôturé', statut)).toEqual({ ok: true, value: 'clos' })
    expect(convertPasted('cloture', statut)).toEqual({ ok: true, value: 'clos' })
    expect(convertPasted('ouvert', statut)).toEqual({ ok: true, value: 'ouvert' })
    expect(convertPasted('archivé', statut)).toEqual({
      ok: false,
      reason: 'valeur absente de la liste',
    })
    const tags = field({
      name: 'tags',
      kind: 'multi_select',
      options: [
        { value: 'urgent', label: 'Urgent' },
        { value: 'client', label: 'Client' },
      ],
    } as Partial<Field> & { name: string; kind: string })
    expect(convertPasted('urgent; Client', tags)).toEqual({ ok: true, value: ['urgent', 'client'] })
    expect(convertPasted('urgent, inconnu', tags).ok).toBe(false)
  })

  it('empty empties, unless the field must be filled', () => {
    expect(convertPasted('  ', nom)).toEqual({ ok: true, value: null })
    expect(convertPasted('', montant)).toEqual({ ok: true, value: null })
    expect(convertPasted('', { ...nom, required: true })).toEqual({
      ok: false,
      reason: 'champ obligatoire',
    })
  })

  it('texts are trimmed; an address is checked; a rich text takes paragraphs', () => {
    expect(convertPasted('  Dupont  ', nom)).toEqual({ ok: true, value: 'Dupont' })
    const mail = field({ name: 'mail', kind: 'email' })
    expect(convertPasted('mailto:a@b.fr', mail)).toEqual({ ok: true, value: 'a@b.fr' })
    expect(convertPasted('pas une adresse', mail).ok).toBe(false)
    const rich = field({ name: 'r', kind: 'long_text', unsafe_html: true })
    expect(convertPasted('un <b>\n\ndeux', rich)).toEqual({
      ok: true,
      value: '<p>un &lt;b&gt;</p><p>deux</p>',
    })
    expect(convertPasted('<p>déjà du HTML</p>', rich)).toEqual({
      ok: true,
      value: '<p>déjà du HTML</p>',
    })
  })

  const clients = field({ name: 'client', kind: 'link', label: 'Client' })
  const equipe = field({ name: 'equipe', kind: 'multi_link', label: 'Équipe' })
  const dir = (field: Field, entries: Array<[string, string]>): Directories =>
    new Map([
      [field.name, linkDirectory(entries.map(([display, id]) => ({ id, display })))],
    ]) as Directories

  it('a row by its label, case and accents aside, or by its identifier', () => {
    const directories = dir(clients, [
      ['Audrey Brun', AUDREY],
      ['Bastien Roy', BASTIEN],
    ])
    expect(convertPasted('audrey brun', clients, directories)).toEqual({ ok: true, value: AUDREY })
    expect(convertPasted(BASTIEN.toUpperCase(), clients, new Map())).toEqual({
      ok: true,
      value: BASTIEN,
    })
    expect(convertPasted('Zoé', clients, directories)).toEqual({
      ok: false,
      reason: 'ligne liée introuvable',
    })
  })

  it('two rows with one label are not guessed between', () => {
    const directories = dir(clients, [
      ['Dupont', AUDREY],
      ['Dupont', BASTIEN],
    ])
    expect(convertPasted('Dupont', clients, directories)).toEqual({
      ok: false,
      reason: 'plusieurs lignes portent ce libellé',
    })
  })

  it('several rows: a list, unless the label itself holds a comma', () => {
    const directories = dir(equipe, [
      ['Audrey', AUDREY],
      ['Bastien', BASTIEN],
      ['Dupont, Jean', '0190a0b2-0000-7000-8000-00000000000c'],
    ])
    expect(convertPasted('Audrey, Bastien', equipe, directories)).toEqual({
      ok: true,
      value: [AUDREY, BASTIEN],
    })
    expect(convertPasted('Audrey; audrey', equipe, directories)).toEqual({
      ok: true,
      value: [AUDREY],
    })
    expect(convertPasted('Dupont, Jean', equipe, directories)).toEqual({
      ok: true,
      value: ['0190a0b2-0000-7000-8000-00000000000c'],
    })
    expect(convertPasted('Audrey, Zoé', equipe, directories)).toEqual({
      ok: false,
      reason: '« Zoé » : ligne liée introuvable',
    })
  })

  it('lists the labels to look for, the whole text and its parts', () => {
    expect(linkCandidates('Audrey')).toEqual(['Audrey'])
    expect(linkCandidates('Dupont, Jean; Roy')).toEqual([
      'Dupont, Jean; Roy',
      'Dupont',
      'Jean',
      'Roy',
    ])
    expect(linkCandidates('')).toEqual([])
    expect(linkCandidates(AUDREY)).toEqual([])
  })

  it('learns the rows a search found, only those the label names', () => {
    const directory = linkDirectory([])
    enterFound(directory, 'Audrey', [
      { id: AUDREY, display: 'AUDREY' },
      { id: BASTIEN, display: 'Audrey Brun' },
    ])
    expect(directory.get('audrey')).toBe(AUDREY)
    expect(directory.size).toBe(1)
  })

  it('a person by name, by address, or by identifier', () => {
    const owner = field({ name: 'resp', kind: 'user' })
    const directories: Directories = new Map([
      [
        'resp',
        memberDirectory([
          { id: AUDREY, display_name: 'Audrey Brun', email: 'audrey@x.fr', disabled: false },
          { id: BASTIEN, display_name: 'Bastien Roy', email: 'bastien@x.fr', disabled: true },
        ]),
      ],
    ])
    expect(convertPasted('Audrey Brun', owner, directories)).toEqual({ ok: true, value: AUDREY })
    expect(convertPasted('AUDREY@x.fr', owner, directories)).toEqual({ ok: true, value: AUDREY })
    // Someone who has left is not assigned work by a paste.
    expect(convertPasted('Bastien Roy', owner, directories).ok).toBe(false)
    expect(convertPasted(BASTIEN, owner, directories)).toEqual({ ok: true, value: BASTIEN })
  })
})

describe('what a field allows', () => {
  it('writes a text, a number, a choice — never a computed, read-only or system column', () => {
    expect(bulkWritable(nom)).toBe(true)
    expect(bulkWritable(statut)).toBe(true)
    expect(bulkWritable(note)).toBe(false)
    expect(bulkWritable(total)).toBe(false)
    expect(bulkWritable({ ...nom, system: true } as Field)).toBe(false)
    expect(bulkWritable({ ...nom, ai: true } as Field)).toBe(false)
    expect(bulkWritable(field({ name: 'f', kind: 'file' }))).toBe(false)
    expect(bulkWritable(field({ name: 'b', kind: 'button' }))).toBe(false)
  })

  it('opens an editor for a text, the control itself for a picker', () => {
    expect(editMode(nom)).toBe('text')
    expect(editMode(montant)).toBe('text')
    expect(editMode(echeance)).toBe('text')
    expect(editMode(statut)).toBe('control')
    expect(editMode(field({ name: 'ok', kind: 'boolean' }))).toBe('control')
    expect(editMode(field({ name: 'r', kind: 'number', format: { display: 'rating' } }))).toBe(
      'control',
    )
    expect(editMode(note)).toBe('none')
  })

  it('tells fields one value fits from those it does not', () => {
    expect(compatible(nom, field({ name: 'autre', kind: 'short_text' }))).toBe(true)
    expect(compatible(nom, montant)).toBe(false)
    expect(compatible(statut, { ...statut, name: 'etat' })).toBe(true)
    expect(
      compatible(
        statut,
        field({ name: 'e', kind: 'select', options: [{ value: 'a', label: 'A' }] } as never),
      ),
    ).toBe(false)
    const price = field({ name: 'p', kind: 'number', format: { display: 'currency' } })
    expect(compatible(montant, price)).toBe(false)
    expect(
      compatible(
        field({ name: 'a', kind: 'link', link: { target: 't1' } } as never),
        field({ name: 'b', kind: 'link', link: { target: 't2' } } as never),
      ),
    ).toBe(false)
  })
})

describe('planPaste', () => {
  const fields = [nom, montant, statut, note, total, echeance]
  const rows = [
    { _id: 'r0', nom: 'a', montant: '1', statut: null, note: null, total: 1, echeance: null },
    { _id: 'r1', nom: 'b', montant: '2', statut: null, note: null, total: 2, echeance: null },
    { _id: 'r2', nom: 'c', montant: '3', statut: null, note: null, total: 3, echeance: null },
  ]
  const at = (rowIndex: number, column: string) => ({ rowIndex, column })

  it('lands from the top left of the selection', () => {
    const plan = planPaste({
      matrix: [
        ['Alice', '10'],
        ['Bob', '20,5'],
      ],
      fields,
      rows,
      selection: [at(1, 'nom')],
    })
    expect(plan.updates).toEqual([
      { rowIndex: 1, id: 'r1', values: { nom: 'Alice', montant: 10 }, cells: 2 },
      { rowIndex: 2, id: 'r2', values: { nom: 'Bob', montant: 20.5 }, cells: 2 },
    ])
    expect(plan.creations).toEqual([])
    expect(plan.written).toBe(4)
    expect(plan.ignored).toEqual([])
  })

  it('starts at the top left of a range selected from its bottom right', () => {
    const plan = planPaste({
      matrix: [['Z']],
      fields,
      rows,
      selection: [at(2, 'montant'), at(1, 'montant'), at(2, 'nom'), at(1, 'nom')],
    })
    // One value, four cells: it fills them all.
    expect(plan.updates.map((u) => u.id)).toEqual(['r1', 'r2'])
    expect(plan.updates[0]?.values).toEqual({ nom: 'Z' })
    // « Z » is no number: those cells are left out, and said.
    expect(plan.ignored.map((i) => [i.rowIndex, i.field?.name, i.reason])).toEqual([
      [1, 'montant', 'nombre invalide'],
      [2, 'montant', 'nombre invalide'],
    ])
    expect(plan.written).toBe(2)
  })

  it('one value fills the whole range, each cell converted by its own column', () => {
    const plan = planPaste({
      matrix: [['Clôturé']],
      fields,
      rows,
      selection: [at(0, 'statut'), at(1, 'statut'), at(2, 'statut')],
    })
    expect(plan.updates.map((u) => u.values)).toEqual([
      { statut: 'clos' },
      { statut: 'clos' },
      { statut: 'clos' },
    ])
    expect(plan.written).toBe(3)
  })

  it('leaves out the cells that cannot take a value, and says which and why', () => {
    const plan = planPaste({
      matrix: [['x', '1', 'ouvert', 'n', '9', 'pas une date']],
      fields,
      rows,
      selection: [at(0, 'nom')],
    })
    expect(plan.updates).toEqual([
      { rowIndex: 0, id: 'r0', values: { nom: 'x', montant: 1, statut: 'ouvert' }, cells: 3 },
    ])
    expect(plan.ignored.map((i) => [i.field?.name, i.reason])).toEqual([
      ['note', 'colonne en lecture seule'],
      ['total', 'colonne calculée'],
      ['echeance', 'date invalide (jj/mm/aaaa ou aaaa-mm-jj)'],
    ])
  })

  it('a column the row was read without is masked, not written', () => {
    const masked = [{ _id: 'r0', montant: '1' }]
    const plan = planPaste({
      matrix: [['x', '1']],
      fields: [nom, montant],
      rows: masked,
      selection: [at(0, 'nom')],
    })
    expect(plan.updates[0]?.values).toEqual({ montant: 1 })
    expect(plan.ignored.map((i) => i.reason)).toEqual(['colonne masquée'])
  })

  it('counts what falls past the last column as left out', () => {
    const plan = planPaste({
      matrix: [['1', 'b', 'c']],
      fields: [nom, montant],
      rows,
      selection: [at(0, 'montant')],
    })
    expect(plan.ignored.map((i) => [i.field, i.reason])).toEqual([
      [null, 'au-delà de la dernière colonne'],
      [null, 'au-delà de la dernière colonne'],
    ])
  })

  it('offers the rows past the last one as rows to create, without their emptied cells', () => {
    const plan = planPaste({
      matrix: [['a'], ['b'], ['c'], ['d', '4'], [''], ['', '']],
      fields: [nom, montant],
      rows,
      selection: [at(2, 'nom')],
    })
    expect(plan.updates.map((u) => u.id)).toEqual(['r2'])
    expect(plan.creations).toEqual([
      { rowIndex: 3, id: null, values: { nom: 'b' }, cells: 1 },
      { rowIndex: 4, id: null, values: { nom: 'c' }, cells: 1 },
      { rowIndex: 5, id: null, values: { nom: 'd', montant: 4 }, cells: 2 },
    ])
    // The blank lines are rows of nothing: not created.
    expect(plan.creations.map((c) => c.rowIndex)).not.toContain(6)
    // The cells of the blank lines are not counted: nothing is made of them.
    expect(plan.written).toBe(1 + 1 + 1 + 2)
  })

  it('does nothing without a selection', () => {
    const plan = planPaste({ matrix: [['a', 'b']], fields, rows, selection: [] })
    expect(plan.written).toBe(0)
    expect(plan.updates).toEqual([])
  })
})

describe('planFill', () => {
  const fields = [nom, montant, statut, note]
  const rows = [
    { _id: 'r0', nom: 'a', montant: '1', statut: null, note: null },
    { _id: 'r1', nom: 'b', montant: '2', statut: null, note: null },
  ]
  const refs = (...cells: Array<[number, string]>) =>
    cells.map(([rowIndex, column]) => ({ rowIndex, column }))

  it('writes one value to every target of a compatible field', () => {
    const targets = targetsOf(refs([1, 'statut'], [0, 'statut']), fields, rows)
    const plan = planFill(targets, rows, 'clos', statut)
    expect(plan.updates).toEqual([
      { rowIndex: 0, id: 'r0', values: { statut: 'clos' }, cells: 1 },
      { rowIndex: 1, id: 'r1', values: { statut: 'clos' }, cells: 1 },
    ])
  })

  it('leaves out other types, read-only columns and, for an empty value, required ones', () => {
    const targets = targetsOf(
      refs([0, 'statut'], [0, 'montant'], [0, 'note']),
      [statut, montant, note],
      rows,
    )
    const plan = planFill(targets, rows, 'clos', statut)
    expect(plan.written).toBe(1)
    expect(plan.ignored.map((i) => [i.field?.name, i.reason])).toEqual([
      ['montant', 'type de champ différent'],
      ['note', 'colonne en lecture seule'],
    ])

    const must = { ...nom, required: true } as Field
    const emptied = planFill(
      targetsOf(refs([0, 'nom'], [0, 'montant']), [must, montant], rows),
      rows,
      null,
      null,
    )
    expect(emptied.updates[0]?.values).toEqual({ montant: null })
    expect(emptied.ignored.map((i) => i.reason)).toEqual(['champ obligatoire'])
  })

  it('drops a target whose row is gone', () => {
    expect(targetsOf(refs([5, 'nom']), fields, rows)).toEqual([])
  })
})

describe('the summary of what was left out', () => {
  it('counts by column and reason, the most frequent first', () => {
    const plan = planPaste({
      matrix: [['x'], ['y'], ['z']],
      fields: [statut],
      rows: [
        { _id: 'a', statut: null },
        { _id: 'b', statut: null },
        { _id: 'c', statut: null },
      ],
      selection: [{ rowIndex: 0, column: 'statut' }],
    })
    expect(ignoredSummary(plan.ignored)).toEqual([
      { label: 'Statut', reason: 'valeur absente de la liste', count: 3 },
    ])
  })
})

describe('what a copy puts on the clipboard', () => {
  const plain = (row: { [k: string]: unknown }, f: Field) => String(row[f.name] ?? '')
  const members = [{ id: AUDREY, display_name: 'Audrey Brun', email: 'a@x.fr', disabled: false }]

  it('writes what a person reads, so that a spreadsheet and the grid read it back', () => {
    expect(clipboardText({ _id: 'r', montant: '1234.5600000000' }, montant, members, plain)).toBe(
      '1234,56',
    )
    expect(clipboardText({ _id: 'r', echeance: '2026-09-25' }, echeance, members, plain)).toBe(
      '25/09/2026',
    )
    expect(
      clipboardText(
        { _id: 'r', resp: AUDREY },
        field({ name: 'resp', kind: 'user' }),
        members,
        plain,
      ),
    ).toBe('Audrey Brun')
    expect(clipboardText({ _id: 'r', nom: 'Dupont' }, nom, members, plain)).toBe('Dupont')
    expect(clipboardText({ _id: 'r', montant: null }, montant, members, plain)).toBe('')
  })

  it('round-trips through the clipboard format into the same values', () => {
    const copied = formatClipboard([
      [
        clipboardText({ _id: 'r', nom: 'Dupont\nJean' }, nom, members, plain),
        clipboardText({ _id: 'r', montant: '1234.5' }, montant, members, plain),
        clipboardText({ _id: 'r', echeance: '2026-09-25' }, echeance, members, plain),
      ],
    ])
    const [line] = parseClipboard(copied)
    expect(convertPasted(line?.[0] ?? '', nom)).toEqual({ ok: true, value: 'Dupont\nJean' })
    expect(convertPasted(line?.[1] ?? '', montant)).toEqual({ ok: true, value: 1234.5 })
    expect(convertPasted(line?.[2] ?? '', echeance)).toEqual({ ok: true, value: '2026-09-25' })
  })
})
