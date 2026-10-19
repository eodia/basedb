import type { Field, LinkOption, Member } from '@/lib/api/client'
import { displayStored, isDateKind, parseTyped, toStored } from '@/lib/dates'
import { editText, formatOf, parseNumberInput } from '@/lib/format'
import { $t } from '@/lib/i18n'
import { type Converted, convert as convertImported, fold } from '@/lib/import'
import { type CellRef, parseCellKey } from './use-selection'

/**
 * Pasting into the grid, and filling a selection — chapter 11 §2.4, as pure functions.
 *
 * Nothing here touches the screen or the network: a clipboard text goes in, the writes a
 * batch of updates would carry come out, with what could not be written and WHY. The hook
 * (`use-bulk-edit.tsx`) sends them; this file is what is tested.
 *
 * The rule that runs through it: a cell is converted by its FIELD's type, as typing the
 * same text into the cell would convert it — a number the way the number editor reads it
 * (`1 234,5`, `12,50 €`, `1:30`), a date the way the date editor reads it (day first, or
 * ISO), a choice by its label. A cell that does not convert is NOT written, and is
 * reported; the others are. What only the database can judge (a unique value, a rule)
 * comes back from the server, and then nothing is written.
 */

// ── The clipboard as text ────────────────────────────────────────────────────────────

/**
 * Tab-separated text as spreadsheets write it: a cell holding a tab, a line break or a
 * quote is wrapped in quotes with its own quotes doubled, so that `""` is one `"`. Rows end
 * at `\r\n`, `\n` or `\r`; the last line break is not a row; a blank line IS one (a row of
 * one empty cell), unlike in a file import, because a paste is positional.
 *
 * A quote opens a cell only at its very start — `5" screen` is just text. A quote that is
 * never closed is read as text too, rather than swallowing everything after it.
 */
export function parseClipboard(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  return parseWith(source, true) ?? (parseWith(source, false) as string[][])
}

/** `null` when a quote was left open and `quotes` asked for them to count. */
function parseWith(source: string, quotes: boolean): string[][] | null {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let atStart = true

  const endCell = () => {
    row.push(cell)
    cell = ''
    atStart = true
  }
  const endRow = () => {
    endCell()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i] as string
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (source[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (quotes && ch === '"' && atStart) {
      quoted = true
      atStart = false
    } else if (ch === '\t') {
      endCell()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      endRow()
    } else {
      cell += ch
      atStart = false
    }
  }
  if (quoted) return null
  if (cell !== '' || row.length > 0 || (!atStart && source !== '')) endRow()
  return rows
}

/** A rectangle of text as the clipboard carries it: what `parseClipboard` reads back. */
export function formatClipboard(rows: readonly (readonly string[])[]): string {
  const quote = (cell: string) => (/[\t\r\n"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)
  return rows.map((row) => row.map(quote).join('\t')).join('\n')
}

/** A row as the grid holds it: its identifier, and a value per field it was read with. */
export interface RowLike {
  readonly _id: string
  readonly [field: string]: unknown
}

/**
 * What a cell puts on the clipboard: what a person reads in it, so that a spreadsheet
 * understands it and the grid reads it back. A number as it is typed in the reader's
 * language, a date day first, a person by name — the rest as `plain` has it.
 */
export function clipboardText(
  row: RowLike,
  field: Field,
  members: readonly Member[],
  plain: (row: RowLike, field: Field) => string,
): string {
  const value = row[field.name]
  if (value === null || value === undefined || field.computed !== undefined) {
    return plain(row, field)
  }
  if (field.kind === 'number') return editText(value, field)
  if (isDateKind(field.kind)) return displayStored(String(value), field.kind)
  if (field.kind === 'user' && typeof value === 'string') {
    const member = members.find((m) => m.id === value)
    return member?.display_name || member?.email || value
  }
  return plain(row, field)
}

// ── What a field takes ───────────────────────────────────────────────────────────────

/** The kinds a person writes, and a text can become. Files and computed values are not. */
const WRITABLE_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'link',
  'multi_link',
  'url',
  'email',
  'user',
])

/** Whether a range may be pasted or filled into this field. */
export function bulkWritable(field: Field): boolean {
  return (
    field.system !== true &&
    field.read_only !== true &&
    field.ai !== true &&
    field.computed === undefined &&
    WRITABLE_KINDS.has(field.kind)
  )
}

const TEXT_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'url',
  'email',
  'number',
  'date',
  'datetime',
])

/**
 * How a cell is edited from the keyboard: `text` has an editor in the cell that a key
 * opens; `control` is a picker, a checkbox or stars, which open on their own control;
 * `none` is not written at all.
 */
export type EditMode = 'text' | 'control' | 'none'

export function editMode(field: Field): EditMode {
  if (!bulkWritable(field)) return 'none'
  if (field.kind === 'number' && formatOf(field) === 'rating') return 'control'
  return TEXT_KINDS.has(field.kind) ? 'text' : 'control'
}

const sameChoices = (a: Field, b: Field) => {
  const left = (a.options ?? []).map((o) => o.value).sort()
  const right = (b.options ?? []).map((o) => o.value).sort()
  return left.length === right.length && left.every((value, i) => value === right[i])
}

/**
 * Whether one value can be written to both fields as it stands: the same type, and for a
 * type that has them, the same choices, the same target table, the same reading of a number.
 */
export function compatible(a: Field, b: Field): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'select':
    case 'multi_select':
      return sameChoices(a, b)
    case 'link':
    case 'multi_link':
      return a.link?.target === b.link?.target
    case 'number':
      return JSON.stringify(a.format ?? null) === JSON.stringify(b.format ?? null)
    case 'long_text':
      return (a.unsafe_html === true) === (b.unsafe_html === true)
    default:
      return true
  }
}

// ── Labels to identifiers ────────────────────────────────────────────────────────────

/**
 * The rows (or the people) a label names: folded label → identifier, `null` when two share
 * it — pasting must not pick one of them for the person.
 */
export type Directory = ReadonlyMap<string, string | null>
/** One directory per link or person field, by field name. */
export type Directories = ReadonlyMap<string, Directory>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function enter(directory: Map<string, string | null>, label: string, id: string): void {
  const key = fold(label)
  if (key === '') return
  const known = directory.get(key)
  directory.set(key, known === undefined || known === id ? id : null)
}

/** The rows a link field already has the names of. */
export function linkDirectory(options: readonly LinkOption[]): Map<string, string | null> {
  const directory = new Map<string, string | null>()
  for (const option of options) enter(directory, option.display, option.id)
  return directory
}

/** The people of the tenant, by name and by address. */
export function memberDirectory(members: readonly Member[]): Map<string, string | null> {
  const directory = new Map<string, string | null>()
  for (const member of members) {
    if (member.disabled === true) continue
    if (member.display_name) enter(directory, member.display_name, member.id)
    enter(directory, member.email, member.id)
  }
  return directory
}

/** Adds what a search found: the rows whose label IS `label` (case and accents aside). */
export function enterFound(
  directory: Map<string, string | null>,
  label: string,
  found: readonly LinkOption[],
): void {
  const key = fold(label)
  for (const option of found) if (fold(option.display) === key) enter(directory, label, option.id)
}

/**
 * The labels a cell may be naming. A list of rows is written `A, B` — but a row may be
 * called `Dupont, Jean`: the whole text is a candidate beside its parts, and the one the
 * directory knows wins (`labelsOf`).
 */
export function linkCandidates(text: string): string[] {
  const whole = text.trim()
  if (whole === '' || UUID.test(whole)) return []
  const parts = whole.split(/\s*[;\n,]\s*/).filter((part) => part !== '')
  return [...new Set([whole, ...parts])]
}

function labelsOf(text: string, directory: Directory | undefined): string[] {
  const whole = text.trim()
  if (UUID.test(whole) || directory?.has(fold(whole)) === true) return [whole]
  return whole.split(/\s*[;\n,]\s*/).filter((part) => part !== '')
}

// ── One cell ─────────────────────────────────────────────────────────────────────────

const ok = (value: unknown): Converted => ({ ok: true, value })
const fail = (reason: string): Converted => ({ ok: false, reason })

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** A rich text takes HTML: a plain text becomes paragraphs, HTML copied from another rich cell stays. */
function richText(text: string): string {
  if (/^\s*<(p|h[1-6]|ul|ol|li|div|blockquote|pre|table|br|strong|em|a)\b/i.test(text)) {
    return text.trim()
  }
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function oneRow(label: string, directory: Directory | undefined, none: string): Converted {
  if (UUID.test(label)) return ok(label.toLowerCase())
  const found = directory?.get(fold(label))
  if (found === undefined) return fail(none)
  if (found === null) return fail($t('plusieurs lignes portent ce libellé'))
  return ok(found)
}

/**
 * A pasted text as the value its field takes — `{ ok: false, reason }` when it is none.
 * An empty text is `null`, which empties the cell: that is what pasting a blank cell does
 * in a spreadsheet, and a field that cannot be empty refuses it here, not at the server.
 */
export function convertPasted(
  text: string,
  field: Field,
  directories: Directories = new Map(),
): Converted {
  if (text.trim() === '') {
    return field.required === true ? fail($t('champ obligatoire')) : ok(null)
  }

  switch (field.kind) {
    case 'short_text':
    case 'url':
    case 'email':
    case 'boolean':
    case 'select':
    case 'multi_select':
      return convertImported(text, field.kind, field.options)

    case 'long_text':
      return field.unsafe_html === true
        ? ok(richText(text))
        : convertImported(text, 'long_text', undefined)

    case 'number': {
      // As the number editor reads it: a duration `1:30`, an amount with its symbol.
      const parsed = parseNumberInput(text.trim(), field)
      if (typeof parsed !== 'number') return fail($t('nombre invalide'))
      if (formatOf(field) === 'rating') {
        const max = field.format?.rating_max ?? 5
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
          return fail($t('note de 0 à {max} attendue', { max }))
        }
      }
      return ok(parsed)
    }

    case 'date':
    case 'datetime': {
      // As the date editor reads it: day first, or ISO; a time is the reader's own.
      const moment = parseTyped(text)
      if (moment === null) {
        return fail(
          field.kind === 'date'
            ? $t('date invalide (jj/mm/aaaa ou aaaa-mm-jj)')
            : $t('date et heure invalides'),
        )
      }
      return ok(toStored(moment, field.kind))
    }

    case 'link':
      return oneRow(text.trim(), directories.get(field.name), $t('ligne liée introuvable'))

    case 'multi_link': {
      const directory = directories.get(field.name)
      const ids: string[] = []
      for (const label of labelsOf(text, directory)) {
        const row = oneRow(label, directory, $t('ligne liée introuvable'))
        if (!row.ok) return fail($t('« {label} » : {reason}', { label, reason: row.reason }))
        if (!ids.includes(row.value as string)) ids.push(row.value as string)
      }
      return ok(ids.length === 0 ? null : ids)
    }

    case 'user': {
      const label = text.trim()
      if (UUID.test(label)) return ok(label.toLowerCase())
      const found = directories.get(field.name)?.get(fold(label))
      if (found === undefined) return fail($t('personne introuvable'))
      if (found === null) return fail($t('plusieurs personnes portent ce nom'))
      return ok(found)
    }

    default:
      return fail($t('ce type ne se colle pas'))
  }
}

// ── Plans ────────────────────────────────────────────────────────────────────────────

/** The values one row receives, by field name. */
export interface RowWrite {
  /** Its place in the rows on screen; past the last one, a row to create. */
  readonly rowIndex: number
  /** `null` for a row that does not exist yet. */
  readonly id: string | null
  readonly values: Record<string, unknown>
  /** How many cells of the selection these values are. */
  readonly cells: number
}

/** A cell that was not written, and why. */
export interface Ignored {
  readonly rowIndex: number
  readonly field: Field | null
  readonly reason: string
}

export interface Plan {
  /** The rows that exist, to change. */
  readonly updates: readonly RowWrite[]
  /** The rows past the last one that the paste would add, in order. */
  readonly creations: readonly RowWrite[]
  readonly ignored: readonly Ignored[]
  /** Cells that will be written, updates and creations together; blank new rows are not. */
  readonly written: number
}

/** The selected cells, as references. */
export const refsOf = (cells: ReadonlySet<string>): CellRef[] => [...cells].map(parseCellKey)

/** The selected cells in reading order: row by row, left to right in the columns' order. */
export function inReadingOrder(refs: readonly CellRef[], fields: readonly Field[]): CellRef[] {
  const position = (ref: CellRef) => fields.findIndex((f) => f.name === ref.column)
  return [...refs].sort((a, b) => a.rowIndex - b.rowIndex || position(a) - position(b))
}

class Collector {
  readonly byRow = new Map<
    number,
    { id: string | null; values: Record<string, unknown>; n: number }
  >()
  readonly ignored: Ignored[] = []

  write(rowIndex: number, id: string | null, field: Field, value: unknown): void {
    const row = this.byRow.get(rowIndex) ?? { id, values: {}, n: 0 }
    row.values[field.name] = value
    row.n++
    this.byRow.set(rowIndex, row)
  }

  skip(rowIndex: number, field: Field | null, reason: string): void {
    this.ignored.push({ rowIndex, field, reason })
  }

  plan(existing: number): Plan {
    const all = [...this.byRow]
      .sort(([a], [b]) => a - b)
      .map(
        ([rowIndex, row]): RowWrite => ({ rowIndex, id: row.id, values: row.values, cells: row.n }),
      )
    // A new row made only of emptied cells would be a blank line in the table.
    const creations = all
      .filter((row) => row.rowIndex >= existing)
      .flatMap((row) => {
        const values = Object.fromEntries(
          Object.entries(row.values).filter(([, value]) => value !== null),
        )
        const cells = Object.keys(values).length
        return cells === 0 ? [] : [{ ...row, values, cells }]
      })
    const updates = all.filter((row) => row.rowIndex < existing)
    return {
      updates,
      creations,
      ignored: this.ignored,
      written: [...updates, ...creations].reduce((sum, row) => sum + row.cells, 0),
    }
  }
}

/** Why a cell of a row that exists cannot take a value, or `null` when it can. */
function refusal(row: RowLike | undefined, field: Field): string | null {
  if (field.system === true || field.read_only === true) return $t('colonne en lecture seule')
  if (field.computed !== undefined || field.ai === true) return $t('colonne calculée')
  if (!bulkWritable(field)) return $t('ce type ne se colle pas')
  // A field the row was read without is masked for this reader: nothing is known to write over.
  if (row !== undefined && !Object.hasOwn(row, field.name)) return $t('colonne masquée')
  return null
}

export interface PasteInput {
  readonly matrix: readonly (readonly string[])[]
  /** The columns on screen, in order. */
  readonly fields: readonly Field[]
  /** The rows on screen. */
  readonly rows: readonly RowLike[]
  /** The selected cells; the paste starts at the top left of their rectangle. */
  readonly selection: readonly CellRef[]
  readonly directories?: Directories
}

/** One pasted text and the place it lands: `field` is `undefined` past the last column. */
export interface Placement {
  readonly rowIndex: number
  readonly field: Field | undefined
  readonly text: string
}

/**
 * Where each pasted text lands.
 *
 * ONE value pasted over several cells goes to every one of them. Anything bigger lands
 * from the top left of the selection, row by row and column by column, as in a
 * spreadsheet.
 */
export function placements({
  matrix,
  fields,
  selection,
}: Pick<PasteInput, 'matrix' | 'fields' | 'selection'>): Placement[] {
  const column = (name: string) => fields.findIndex((f) => f.name === name)
  const first = matrix[0]?.[0]
  if (
    matrix.length === 1 &&
    matrix[0]?.length === 1 &&
    first !== undefined &&
    selection.length > 1
  ) {
    return inReadingOrder(selection, fields).map((ref) => ({
      rowIndex: ref.rowIndex,
      field: fields[column(ref.column)],
      text: first,
    }))
  }

  const top = Math.min(...selection.map((ref) => ref.rowIndex))
  const left = Math.min(...selection.map((ref) => column(ref.column)).filter((c) => c !== -1))
  if (!Number.isFinite(top) || !Number.isFinite(left)) return []
  return matrix.flatMap((line, i) =>
    line.map((text, j) => ({ rowIndex: top + i, field: fields[left + j], text })),
  )
}

/**
 * What a paste writes: each placement converted by its field, those that cannot be left out
 * and listed. Rows past the last are `creations`, for the screen to offer making them.
 */
export function planPaste(input: PasteInput): Plan {
  const { rows, directories } = input
  const out = new Collector()
  for (const { rowIndex, field, text } of placements(input)) {
    if (field === undefined) {
      out.skip(rowIndex, null, $t('au-delà de la dernière colonne'))
      continue
    }
    const row = rows[rowIndex]
    const refused = refusal(row, field)
    if (refused !== null) out.skip(rowIndex, field, refused)
    else {
      const converted = convertPasted(text, field, directories)
      if (!converted.ok) out.skip(rowIndex, field, converted.reason)
      else out.write(rowIndex, row?._id ?? null, field, converted.value)
    }
  }
  return out.plan(rows.length)
}

/** One cell a fill or a clear lands on. */
export interface Target {
  readonly rowIndex: number
  readonly id: string
  readonly field: Field
}

/** The selected cells as targets; a cell whose row or column is gone is dropped. */
export function targetsOf(
  refs: readonly CellRef[],
  fields: readonly Field[],
  rows: readonly RowLike[],
): Target[] {
  return inReadingOrder(refs, fields).flatMap((ref) => {
    const field = fields.find((f) => f.name === ref.column)
    const row = rows[ref.rowIndex]
    return field === undefined || row === undefined
      ? []
      : [{ rowIndex: ref.rowIndex, id: row._id, field }]
  })
}

/**
 * The same value written to every target — `null` empties them. With an `active` field,
 * only the targets it is `compatible` with take it: a value chosen for a status is not a
 * value for a date.
 */
export function planFill(
  targets: readonly Target[],
  rows: readonly RowLike[],
  value: unknown,
  active: Field | null,
): Plan {
  const out = new Collector()
  for (const { rowIndex, id, field } of targets) {
    const refused = refusal(rows[rowIndex], field)
    if (refused !== null) out.skip(rowIndex, field, refused)
    else if (active !== null && !compatible(active, field)) {
      out.skip(rowIndex, field, $t('type de champ différent'))
    } else if (value === null && field.required === true) {
      out.skip(rowIndex, field, $t('champ obligatoire'))
    } else out.write(rowIndex, id, field, value)
  }
  return out.plan(rows.length)
}

/** What was left out, counted by column and reason — « Statut : valeur absente de la liste (2) ». */
export function ignoredSummary(
  ignored: readonly Ignored[],
): Array<{ readonly label: string; readonly reason: string; readonly count: number }> {
  const seen = new Map<string, { label: string; reason: string; count: number }>()
  for (const { field, reason } of ignored) {
    const label = field?.label ?? ''
    const key = `${label}|${reason}`
    const entry = seen.get(key) ?? { label, reason, count: 0 }
    entry.count++
    seen.set(key, entry)
  }
  return [...seen.values()].sort((a, b) => b.count - a.count)
}
