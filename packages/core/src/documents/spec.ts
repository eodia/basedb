import { LOCALES, type Locale, isLocale } from '@basedb/contracts'
import { BasedbError } from '../errors/index.js'
import { sanitizeRichText } from '../records/rich-text.js'
import type { Executor } from '../runtime/pool.js'
import { MAX_IMAGE_BYTES, dataUrlOf, decodeImage } from './images.js'

/**
 * A document template — chapter 21 §1: how a row of a table becomes a PDF. The page, the
 * language its values are written in, a theme (colours, faces, sizes, margins), a header
 * and a footer, and a list of blocks: rich text citing the row's columns, the row's
 * fields, a table of the rows linked to it, a title, a picture, columns, rules, space, a
 * page break.
 *
 * Checked when written, against the catalog of that day; read again against the catalog
 * of the day of each rendering, where what has disappeared since is left out rather than
 * failing the document. A definition written before a setting existed reads with that
 * setting's default — which draws the document as it was drawn then.
 */

export type PageSize = 'A4' | 'LETTER'
export type Orientation = 'portrait' | 'landscape'
export type Align = 'left' | 'center' | 'right'
/** The two families a document is set in: the image's Noto Sans, and a serif. */
export type Face = 'sans' | 'serif'

export interface DocumentTheme {
  /** Titles, bands, table heads, links: `#rrggbb`. */
  readonly accent: string
  /** The text: `#rrggbb`. */
  readonly text: string
  readonly font: Face
  readonly title_font: Face
  /** The body's size, in points: 8 to 14. */
  readonly size: number
  /** The page's margins, in millimetres: 8 to 40. */
  readonly margin: number
  /** How the headings of a text read: as the text, in the accent, over an accent rule. */
  readonly titles: 'plain' | 'accent' | 'rule'
  /** A frame around each page, in the accent. */
  readonly border: 'none' | 'line' | 'double'
}

/** A picture: sent with the template (PNG or JPEG, `data:` address), or a row's image field. */
export type ImageSource =
  | { readonly kind: 'upload'; readonly data: string }
  | { readonly kind: 'field'; readonly field: string }

export interface DocumentHeader {
  readonly show: 'none' | 'first' | 'every'
  readonly logo: ImageSource | null
  /** The logo's width, in millimetres. */
  readonly logo_width: number
  /** Rich text under the logo — who sends the document. */
  readonly left: string
  /** Rich text set flush right — what the document is, its number, its date. */
  readonly right: string
  /** An accent rule under the header. */
  readonly rule: boolean
}

export interface DocumentFooter {
  /** Rich text at the foot of every page, citing columns. */
  readonly html: string
  readonly align: 'left' | 'center'
  /** « 2 / 3 », on the right. */
  readonly page_numbers: boolean
  /** A light rule above the footer. */
  readonly rule: boolean
}

/** The rows a table block lists. */
export type RowsSource =
  /** The rows of another table whose link field names this row — an invoice's lines. */
  | { readonly kind: 'incoming'; readonly table: string; readonly field: string }
  /** The rows a multiple link of this row names. */
  | { readonly kind: 'outgoing'; readonly field: string }

export interface TextBlock {
  readonly kind: 'text'
  readonly html: string
  readonly align: Align | 'justify'
  readonly size: 'small' | 'normal' | 'large'
  /** A tinted background, a frame, or an accent bar on the left. */
  readonly style: 'plain' | 'tint' | 'border' | 'bar'
}

export interface FieldsBlock {
  readonly kind: 'fields'
  /** The row's fields, by name; none: every field the reader reads. */
  readonly fields: readonly string[]
  /** Fields side by side. */
  readonly columns: 1 | 2 | 3
  /**
   * The label beside its value, above it, or a summary: labels on the left, values on the
   * right, the last row — the total due — in bold over an accent rule.
   */
  readonly labels: 'beside' | 'above' | 'summary'
  /** A field with no value is left out. */
  readonly hide_empty: boolean
}

export interface RowsBlock {
  readonly kind: 'rows'
  readonly title: string
  readonly source: RowsSource
  /** The columns of the rows listed, by physical name, in order. */
  readonly columns: readonly string[]
  /** Those of `columns` summed under the table. */
  readonly totals: readonly string[]
  /** A light grey head, a head in the accent, or rules only. */
  readonly style: 'light' | 'accent' | 'lines'
  /** Every other row tinted. */
  readonly zebra: boolean
  /** Column heads other than the fields' labels — « Qté » for « Quantité ». */
  readonly headers: Readonly<Record<string, string>>
  /** Column widths, in percent of the table's; the others share what is left. */
  readonly widths: Readonly<Record<string, number>>
  readonly align: Readonly<Record<string, Align>>
}

export interface ImageBlock {
  readonly kind: 'image'
  readonly source: ImageSource
  /** In percent of the width it is set in. */
  readonly width: number
  readonly align: Align
}

export interface TitleBlock {
  readonly kind: 'title'
  /** Plain text, citing columns. */
  readonly text: string
  readonly subtitle: string
  /** As the text, in the accent, over an accent rule, on an accent band, or one edge to edge. */
  readonly style: 'plain' | 'accent' | 'underline' | 'band' | 'bleed'
  readonly align: Align
  readonly size: 'medium' | 'large' | 'huge'
}

export interface DividerBlock {
  readonly kind: 'divider'
  readonly color: 'accent' | 'light' | 'text'
  /** In points: 0.25 to 6. */
  readonly thickness: number
  /** In percent of the width it is set in, centred: a signature line is a short one. */
  readonly width: number
}

export interface SpacerBlock {
  readonly kind: 'spacer'
  /** In millimetres: 1 to 150. */
  readonly height: number
}

/** What a column holds: no table, no columns, no page break. */
export type ColumnBlock =
  | TextBlock
  | FieldsBlock
  | ImageBlock
  | TitleBlock
  | DividerBlock
  | SpacerBlock

export interface ColumnsBlock {
  readonly kind: 'columns'
  /** Relative widths, one per column: `[2, 1]` is two thirds and a third. */
  readonly widths: readonly number[]
  /** Two or three columns, each a list of blocks. */
  readonly columns: ReadonlyArray<readonly ColumnBlock[]>
}

export interface BreakBlock {
  readonly kind: 'break'
}

export type DocumentBlock =
  | TextBlock
  | FieldsBlock
  | RowsBlock
  | ImageBlock
  | TitleBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | BreakBlock

export interface DocumentPage {
  readonly size: PageSize
  readonly orientation: Orientation
  /** `center`: a document that fits on one page is set in the middle of its height. */
  readonly valign: 'top' | 'center'
}

export interface DocumentSpec {
  readonly page: DocumentPage
  /** How values read: numbers, amounts, dates, yes and no. */
  readonly locale: Locale
  readonly theme: DocumentTheme
  readonly header: DocumentHeader
  readonly footer: DocumentFooter
  readonly blocks: readonly DocumentBlock[]
}

/** Blocks in a template, those inside columns included. */
export const MAX_BLOCKS = 50
export const MAX_COLUMNS = 12
export const MAX_HTML_CHARS = 50_000
export const MAX_ROWS_LISTED = 500
/** Pictures sent with a template, each of at most `MAX_IMAGE_BYTES`. */
export const MAX_IMAGES = 8
export { MAX_IMAGE_BYTES }

/** The look of a template written before themes existed: the look it had then. */
export const DEFAULT_THEME: DocumentTheme = {
  accent: '#1d4ed8',
  text: '#111827',
  font: 'sans',
  title_font: 'sans',
  size: 10,
  margin: 20,
  titles: 'plain',
  border: 'none',
}

export const DEFAULT_HEADER: DocumentHeader = {
  show: 'none',
  logo: null,
  logo_width: 40,
  left: '',
  right: '',
  rule: false,
}

export const DEFAULT_FOOTER: DocumentFooter = {
  html: '',
  align: 'left',
  page_numbers: true,
  rule: false,
}

function refuse(field: string, reason: string, detail?: unknown): never {
  throw new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })
}

/**
 * Reading a definition. Strict, what a caller sends is refused at its first fault, naming
 * it; lenient, what is stored reads with a default in place of what it cannot read — a
 * document is never refused for a definition that was accepted when written.
 */
class Reader {
  images = 0
  constructor(readonly strict: boolean) {}

  fail<T>(field: string, reason: string, fallback: T, detail?: unknown): T {
    if (this.strict) refuse(field, reason, detail)
    return fallback
  }

  oneOf<T extends string | number>(
    value: unknown,
    field: string,
    allowed: readonly T[],
    fallback: T,
    reason = 'valeur_inconnue',
  ): T {
    if (value === undefined || value === null) return fallback
    return (allowed as readonly unknown[]).includes(value)
      ? (value as T)
      : this.fail(field, reason, fallback, allowed)
  }

  number(value: unknown, field: string, min: number, max: number, fallback: number, step = 0.5) {
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      return this.fail(field, 'valeur_hors_bornes', fallback, { min, max })
    return Math.round(value / step) * step
  }

  bool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback
  }

  color(value: unknown, field: string, fallback: string): string {
    if (value === undefined || value === null || value === '') return fallback
    if (typeof value === 'string') {
      const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value)
      if (short !== null)
        return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase()
      if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
    }
    return this.fail(field, 'couleur_invalide', fallback)
  }

  /** One line of plain text, its spaces folded. */
  line(value: unknown, field: string, max: number): string {
    const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
    return text.length > max ? this.fail(field, 'texte_trop_long', text.slice(0, max), max) : text
  }

  html(value: unknown, field: string, max: number): string {
    const html = typeof value === 'string' ? sanitizeRichText(value) : ''
    return html.length > max ? this.fail(field, 'texte_trop_long', '', max) : html
  }

  names(value: unknown, field: string, max: number): string[] {
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) return this.fail(field, 'liste_attendue', [])
    const out = [...new Set(value.filter((v): v is string => typeof v === 'string'))]
    return out.length > max ? this.fail(field, 'trop_de_colonnes', out.slice(0, max), max) : out
  }

  image(value: unknown, field: string): ImageSource | null {
    if (value === undefined || value === null) return null
    const raw = value as Record<string, unknown>
    if (raw.kind === 'field') {
      return typeof raw.field === 'string' && raw.field !== ''
        ? { kind: 'field', field: raw.field }
        : this.fail(`${field}.field`, 'champ_image_attendu', null)
    }
    if (raw.kind !== 'upload') return this.fail(`${field}.kind`, 'source_inconnue', null)
    const decoded = decodeImage(raw.data)
    if (decoded === 'too_large')
      return this.fail(`${field}.data`, 'image_trop_lourde', null, MAX_IMAGE_BYTES)
    if (decoded === 'invalid') return this.fail(`${field}.data`, 'image_invalide', null)
    this.images += 1
    if (this.images > MAX_IMAGES) return this.fail(field, 'trop_d_images', null, MAX_IMAGES)
    return { kind: 'upload', data: dataUrlOf(decoded.bytes, decoded.facts) }
  }

  /** A map keyed by column, kept to the columns listed. */
  record<T>(
    value: unknown,
    columns: readonly string[],
    read: (v: unknown, key: string) => T | null,
  ): Record<string, T> {
    const out: Record<string, T> = {}
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
    for (const [key, v] of Object.entries(value)) {
      if (!columns.includes(key)) continue
      const read1 = read(v, key)
      if (read1 !== null) out[key] = read1
    }
    return out
  }
}

const ALIGNS: readonly Align[] = ['left', 'center', 'right']
const INNER = ['text', 'fields', 'image', 'title', 'divider', 'spacer'] as const

function readTheme(r: Reader, value: unknown): DocumentTheme {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const d = DEFAULT_THEME
  return {
    accent: r.color(raw.accent, 'spec.theme.accent', d.accent),
    text: r.color(raw.text, 'spec.theme.text', d.text),
    font: r.oneOf(raw.font, 'spec.theme.font', ['sans', 'serif'], d.font),
    title_font: r.oneOf(raw.title_font, 'spec.theme.title_font', ['sans', 'serif'], d.title_font),
    size: r.number(raw.size, 'spec.theme.size', 8, 14, d.size),
    margin: r.number(raw.margin, 'spec.theme.margin', 8, 40, d.margin, 1),
    titles: r.oneOf(raw.titles, 'spec.theme.titles', ['plain', 'accent', 'rule'], d.titles),
    border: r.oneOf(raw.border, 'spec.theme.border', ['none', 'line', 'double'], d.border),
  }
}

function readHeader(r: Reader, value: unknown): DocumentHeader {
  if (typeof value !== 'object' || value === null) return DEFAULT_HEADER
  const raw = value as Record<string, unknown>
  const d = DEFAULT_HEADER
  return {
    show: r.oneOf(raw.show, 'spec.header.show', ['none', 'first', 'every'], d.show),
    logo: r.image(raw.logo, 'spec.header.logo'),
    logo_width: r.number(raw.logo_width, 'spec.header.logo_width', 10, 120, d.logo_width, 1),
    left: r.html(raw.left, 'spec.header.left', 5_000),
    right: r.html(raw.right, 'spec.header.right', 5_000),
    rule: r.bool(raw.rule, d.rule),
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function readFooter(r: Reader, value: unknown): DocumentFooter {
  // The footer was a line of plain text: it reads as a paragraph of it.
  if (typeof value === 'string') {
    const line = r.line(value, 'spec.footer', 300)
    return { ...DEFAULT_FOOTER, html: line === '' ? '' : `<p>${escapeHtml(line)}</p>` }
  }
  if (typeof value !== 'object' || value === null) return DEFAULT_FOOTER
  const raw = value as Record<string, unknown>
  const d = DEFAULT_FOOTER
  return {
    html: r.html(raw.html, 'spec.footer.html', 3_000),
    align: r.oneOf(raw.align, 'spec.footer.align', ['left', 'center'], d.align),
    page_numbers: r.bool(raw.page_numbers, d.page_numbers),
    rule: r.bool(raw.rule, d.rule),
  }
}

function readBlock(r: Reader, value: unknown, at: string, inner: boolean): DocumentBlock {
  const b = (value ?? {}) as Record<string, unknown>
  if (inner && !(INNER as readonly unknown[]).includes(b.kind))
    refuse(`${at}.kind`, 'bloc_interdit_en_colonne', b.kind)
  switch (b.kind) {
    case 'text':
      return {
        kind: 'text',
        html: r.html(b.html, `${at}.html`, MAX_HTML_CHARS),
        align: r.oneOf(b.align, `${at}.align`, [...ALIGNS, 'justify'], 'left'),
        size: r.oneOf(b.size, `${at}.size`, ['small', 'normal', 'large'], 'normal'),
        style: r.oneOf(b.style, `${at}.style`, ['plain', 'tint', 'border', 'bar'], 'plain'),
      }
    case 'fields':
      return {
        kind: 'fields',
        fields: r.names(b.fields, `${at}.fields`, 200),
        columns: r.oneOf(b.columns, `${at}.columns`, [1, 2, 3], 1),
        labels: r.oneOf(b.labels, `${at}.labels`, ['beside', 'above', 'summary'], 'beside'),
        hide_empty: r.bool(b.hide_empty, false),
      }
    case 'rows': {
      const source = (b.source ?? {}) as Record<string, unknown>
      let checked: RowsSource
      if (source.kind === 'incoming') {
        checked = {
          kind: 'incoming',
          table: typeof source.table === 'string' ? source.table : '',
          field: typeof source.field === 'string' ? source.field : '',
        }
      } else if (source.kind === 'outgoing') {
        checked = { kind: 'outgoing', field: typeof source.field === 'string' ? source.field : '' }
      } else {
        refuse(`${at}.source.kind`, 'source_inconnue')
      }
      const columns = r.names(b.columns, `${at}.columns`, MAX_COLUMNS)
      if (columns.length === 0) refuse(`${at}.columns`, 'aucune_colonne')
      return {
        kind: 'rows',
        title: r.line(b.title, `${at}.title`, 200),
        source: checked,
        columns,
        totals: r.names(b.totals, `${at}.totals`, MAX_COLUMNS).filter((t) => columns.includes(t)),
        style: r.oneOf(b.style, `${at}.style`, ['light', 'accent', 'lines'], 'light'),
        zebra: r.bool(b.zebra, false),
        headers: r.record(b.headers, columns, (v, key) => {
          const text = r.line(v, `${at}.headers.${key}`, 80)
          return text === '' ? null : text
        }),
        widths: r.record(b.widths, columns, (v, key) => {
          const width = r.number(v, `${at}.widths.${key}`, 3, 95, Number.NaN, 1)
          return Number.isNaN(width) ? null : width
        }),
        align: r.record(b.align, columns, (v, key) =>
          v === null ? null : r.oneOf(v, `${at}.align.${key}`, ALIGNS, 'left'),
        ),
      }
    }
    case 'image': {
      const source = r.image(b.source, `${at}.source`)
      if (source === null) refuse(`${at}.source`, 'image_attendue')
      return {
        kind: 'image',
        source,
        width: r.number(b.width, `${at}.width`, 5, 100, 40, 1),
        align: r.oneOf(b.align, `${at}.align`, ALIGNS, 'left'),
      }
    }
    case 'title':
      return {
        kind: 'title',
        text: r.line(b.text, `${at}.text`, 200),
        subtitle: r.line(b.subtitle, `${at}.subtitle`, 300),
        style: r.oneOf(
          b.style,
          `${at}.style`,
          ['plain', 'accent', 'underline', 'band', 'bleed'],
          'accent',
        ),
        align: r.oneOf(b.align, `${at}.align`, ALIGNS, 'left'),
        size: r.oneOf(b.size, `${at}.size`, ['medium', 'large', 'huge'], 'large'),
      }
    case 'divider':
      return {
        kind: 'divider',
        color: r.oneOf(b.color, `${at}.color`, ['accent', 'light', 'text'], 'light'),
        thickness: r.number(b.thickness, `${at}.thickness`, 0.25, 6, 0.75, 0.25),
        width: r.number(b.width, `${at}.width`, 5, 100, 100, 1),
      }
    case 'spacer':
      return { kind: 'spacer', height: r.number(b.height, `${at}.height`, 1, 150, 8, 1) }
    case 'columns': {
      if (!Array.isArray(b.columns) || b.columns.length < 2 || b.columns.length > 3)
        refuse(`${at}.columns`, 'deux_ou_trois_colonnes')
      const columns = b.columns.map((column, c) => {
        if (!Array.isArray(column)) refuse(`${at}.columns[${c}]`, 'liste_attendue')
        return column.flatMap((inner1, j) => {
          const where = `${at}.columns[${c}][${j}]`
          if (r.strict) return [readBlock(r, inner1, where, true) as ColumnBlock]
          try {
            return [readBlock(r, inner1, where, true) as ColumnBlock]
          } catch {
            return []
          }
        })
      })
      const widths = Array.isArray(b.widths) ? b.widths : []
      return {
        kind: 'columns',
        widths: columns.map((_, c) => r.number(widths[c] ?? 1, `${at}.widths[${c}]`, 1, 12, 1, 1)),
        columns,
      }
    }
    case 'break':
      return { kind: 'break' }
    default:
      refuse(`${at}.kind`, 'bloc_inconnu', b.kind)
  }
}

const countOf = (blocks: readonly DocumentBlock[]): number =>
  blocks.reduce(
    (n, b) => n + 1 + (b.kind === 'columns' ? b.columns.reduce((m, c) => m + countOf(c), 0) : 0),
    0,
  )

/**
 * A definition, read for what it says without the catalog: its shape, its limits, its
 * texts sanitized, its pictures checked. Strict for what a caller sends; lenient for what
 * is stored, which reads with defaults where it no longer reads.
 */
export function parseSpec(input: unknown, strict = true): DocumentSpec {
  if (typeof input !== 'object' || input === null) refuse('spec', 'objet_attendu')
  const r = new Reader(strict)
  const raw = input as Record<string, unknown>
  const page = (raw.page ?? {}) as Record<string, unknown>
  const size = r.oneOf(
    page.size,
    'spec.page.size',
    ['A4', 'LETTER'] as const,
    'A4',
    'format_inconnu',
  )
  const orientation = r.oneOf(
    page.orientation,
    'spec.page.orientation',
    ['portrait', 'landscape'] as const,
    'portrait',
    'orientation_inconnue',
  )
  const locale = raw.locale ?? 'fr'
  const checkedLocale: Locale = isLocale(locale)
    ? locale
    : r.fail('spec.locale', 'langue_inconnue', 'fr' as Locale, LOCALES)
  const theme = readTheme(r, raw.theme)
  const header = readHeader(r, raw.header)
  const footer = readFooter(r, raw.footer)
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) {
    if (strict) refuse('spec.blocks', 'aucun_bloc')
  }
  const list = Array.isArray(raw.blocks) ? raw.blocks : []
  if (list.length > MAX_BLOCKS && strict) refuse('spec.blocks', 'trop_de_blocs', MAX_BLOCKS)
  const blocks = list.flatMap((value, i) => {
    const at = `spec.blocks[${i}]`
    if (strict) return [readBlock(r, value, at, false)]
    try {
      return [readBlock(r, value, at, false)]
    } catch {
      return []
    }
  })
  if (countOf(blocks) > MAX_BLOCKS && strict) refuse('spec.blocks', 'trop_de_blocs', MAX_BLOCKS)
  const valign = r.oneOf(page.valign, 'spec.page.valign', ['top', 'center'] as const, 'top')
  return {
    page: { size, orientation, valign },
    locale: checkedLocale,
    theme,
    header,
    footer,
    blocks,
  }
}

/** A stored definition as it reads today — never refused. */
export function readSpec(stored: unknown): DocumentSpec {
  try {
    return parseSpec(stored, false)
  } catch {
    return SHEET
  }
}

/** A table's live fields: name → kind, and what a link aims at. */
interface Fields {
  readonly kinds: ReadonlyMap<string, string>
  readonly targets: ReadonlyMap<string, string>
}

async function fieldsOf(exec: Executor, tableId: string): Promise<Fields> {
  const rows = await exec.query<{ name: string; kind: string; target: string | null }>(
    `SELECT n.name, f.kind, lc.target_table_id::text AS target
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
       LEFT JOIN _basedb.field_link_config lc ON lc.field_id = f.id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL`,
    [tableId],
  )
  return {
    kinds: new Map(rows.map((r) => [r.name, r.kind])),
    targets: new Map(rows.flatMap((r) => (r.target === null ? [] : [[r.name, r.target]]))),
  }
}

/**
 * What a caller sent, as the template stores it — or a refusal naming the part that is
 * wrong. `tableId` is the template's table: the one whose row a document shows.
 */
export async function normalizeSpec(
  exec: Executor,
  tableId: string,
  input: unknown,
): Promise<DocumentSpec> {
  const spec = parseSpec(input, true)
  const own = await fieldsOf(exec, tableId)
  const [{ base_id: baseId } = { base_id: '' }] = await exec.query<{ base_id: string }>(
    'SELECT base_id::text FROM _basedb.table_def WHERE id = $1',
    [tableId],
  )

  const picture = (source: ImageSource | null, at: string) => {
    if (source?.kind === 'field' && own.kinds.get(source.field) !== 'image')
      refuse(`${at}.field`, 'champ_image_attendu', source.field)
  }
  picture(spec.header.logo, 'spec.header.logo')

  const check = async (block: DocumentBlock, at: string): Promise<void> => {
    switch (block.kind) {
      case 'fields': {
        const unknown = block.fields.find((f) => !own.kinds.has(f))
        if (unknown !== undefined) refuse(`${at}.fields`, 'champ_inconnu', unknown)
        return
      }
      case 'image':
        picture(block.source, `${at}.source`)
        return
      case 'columns':
        for (const [c, column] of block.columns.entries())
          for (const [j, inner] of column.entries()) await check(inner, `${at}.columns[${c}][${j}]`)
        return
      case 'rows': {
        const source = block.source
        let related: Fields
        if (source.kind === 'incoming') {
          const [found] = await exec.query<{ id: string }>(
            `SELECT id::text FROM _basedb.table_def
              WHERE id::text = $1 AND base_id = $2 AND is_live AND deleted_at IS NULL`,
            [source.table, baseId],
          )
          if (found === undefined) refuse(`${at}.source.table`, 'table_inconnue', source.table)
          related = await fieldsOf(exec, source.table)
          const kind = related.kinds.get(source.field)
          if (
            (kind !== 'link' && kind !== 'multi_link') ||
            related.targets.get(source.field) !== tableId
          )
            refuse(`${at}.source.field`, 'lien_vers_la_table_attendu', source.field)
        } else {
          const target = own.targets.get(source.field)
          if (own.kinds.get(source.field) !== 'multi_link' || target === undefined)
            refuse(`${at}.source.field`, 'lien_multiple_attendu', source.field)
          related = await fieldsOf(exec, target)
        }
        const unknown = block.columns.find((c) => !related.kinds.has(c))
        if (unknown !== undefined) refuse(`${at}.columns`, 'champ_inconnu', unknown)
        return
      }
      default:
        return
    }
  }
  for (const [i, block] of spec.blocks.entries()) await check(block, `spec.blocks[${i}]`)
  return spec
}

/** The document a row reads as when its table has no template: its fields, all of them. */
export const SHEET: DocumentSpec = {
  page: { size: 'A4', orientation: 'portrait', valign: 'top' },
  locale: 'fr',
  theme: DEFAULT_THEME,
  header: DEFAULT_HEADER,
  footer: DEFAULT_FOOTER,
  blocks: [{ kind: 'fields', fields: [], columns: 1, labels: 'beside', hide_empty: false }],
}
