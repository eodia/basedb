import type {
  DocumentBlock,
  DocumentColumnBlock,
  DocumentFooter,
  DocumentHeader,
  DocumentRowsSource,
  DocumentSpec,
  DocumentTheme,
  Field,
  Table,
} from '@/lib/api/client'
import { $t, locale } from '@/lib/i18n'

/**
 * What the template editor holds — chapter 21 §1: the definition as the server reads it,
 * every setting present, and what a new block, a relation or a summary is. The server
 * checks everything again; these are the editor's starting points, not its rules.
 */

/** The look of a template written before themes: what the server takes when none is said. */
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

/** Accents that print well: dark enough for white text on a band, distinct from one another. */
export const ACCENTS = [
  '#1d4ed8',
  '#4338ca',
  '#7c3aed',
  '#be123c',
  '#c2410c',
  '#b45309',
  '#15803d',
  '#0f766e',
  '#0e7490',
  '#334155',
  '#111827',
] as const

export const TEXT_COLORS = ['#111827', '#1e293b', '#1c1917', '#172554'] as const

/** The heaviest picture the server takes in a template. */
export const MAX_IMAGE_BYTES = 300 * 1024

/** Blocks in a template, those inside columns included. */
export const MAX_BLOCKS = 50

/** A definition with every setting present — what an older server, or none, left out. */
export function complete(spec: Partial<DocumentSpec> | undefined): DocumentSpec {
  return {
    page: {
      size: spec?.page?.size ?? 'A4',
      orientation: spec?.page?.orientation ?? 'portrait',
      valign: spec?.page?.valign ?? 'top',
    },
    locale: spec?.locale ?? locale(),
    theme: { ...DEFAULT_THEME, ...spec?.theme },
    header: { ...DEFAULT_HEADER, ...spec?.header },
    footer:
      typeof spec?.footer === 'string'
        ? { ...DEFAULT_FOOTER, html: spec.footer === '' ? '' : `<p>${escapeHtml(spec.footer)}</p>` }
        : { ...DEFAULT_FOOTER, ...spec?.footer },
    blocks: spec?.blocks ?? [],
  }
}

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A column cited in a text: `{{nom}}`, which the document replaces by the row's value. */
export const cite = (name: string) => `{{${name}}}`

const NUMERIC = new Set(['number', 'count', 'autonumber'])

/** The kind a value reads as: a computed field's result, or the field's own. */
export const kindOf = (f: Field) => f.computed?.result_kind ?? f.kind

export const numeric = (f: Field) => NUMERIC.has(kindOf(f)) && f.computed?.multiple !== true

/** The fields a document may show: no system column, no button. */
export const shown = (fields: readonly Field[]) =>
  fields.filter((f) => f.system !== true && f.kind !== 'button')

export const imageFields = (table: Table) => shown(table.fields).filter((f) => f.kind === 'image')

/** A relation a table block may list: links to this table, and its multiple links. */
export interface RowsChoice {
  readonly value: string
  readonly label: string
  readonly table: Table
  readonly source: DocumentRowsSource
}

export function sourcesOf(table: Table, tables: readonly Table[]): RowsChoice[] {
  const out: RowsChoice[] = []
  for (const t of tables) {
    for (const f of t.fields) {
      if ((f.kind === 'link' || f.kind === 'multi_link') && f.link?.target === table.name) {
        out.push({
          value: `in:${t.id}:${f.name}`,
          label: $t('{table} — par « {field} »', { table: t.label, field: f.label }),
          table: t,
          source: { kind: 'incoming', table: t.id, field: f.name },
        })
      }
    }
  }
  for (const f of table.fields) {
    const target = tables.find((t) => t.name === f.link?.target)
    if (f.kind === 'multi_link' && target !== undefined) {
      out.push({
        value: `out:${f.name}`,
        label: $t('{table} — liées par « {field} »', { table: target.label, field: f.label }),
        table: target,
        source: { kind: 'outgoing', field: f.name },
      })
    }
  }
  return out
}

export const sourceKey = (s: DocumentRowsSource) =>
  s.kind === 'incoming' ? `in:${s.table}:${s.field}` : `out:${s.field}`

/** The columns a new table block lists: text first, numbers after, five at most. */
export function rowsColumns(table: Table): { columns: string[]; totals: string[] } {
  const usable = shown(table.fields).filter(
    (f) => f.kind !== 'link' && f.kind !== 'multi_link' && f.kind !== 'image' && f.kind !== 'file',
  )
  const texts = usable.filter((f) => !numeric(f)).slice(0, 2)
  const numbers = usable.filter(numeric).slice(0, 5 - texts.length)
  const columns = [...texts, ...numbers].map((f) => f.name)
  const amounts = numbers.filter((f) => (f.valueField ?? f).format?.display === 'currency')
  return {
    columns,
    totals: (amounts.length > 0 ? amounts.slice(-1) : []).map((f) => f.name),
  }
}

export type BlockKind = DocumentBlock['kind']
export type ColumnKind = DocumentColumnBlock['kind']

/** The kinds a column of a columns block may hold. */
export const COLUMN_KINDS: readonly ColumnKind[] = [
  'text',
  'title',
  'fields',
  'image',
  'divider',
  'spacer',
]

/** A new block of a kind, ready to show something on the table it is for. */
export function newBlock(
  kind: BlockKind,
  table: Table,
  sources: readonly RowsChoice[],
): DocumentBlock | null {
  switch (kind) {
    case 'text':
      return { kind: 'text', html: '', align: 'left', size: 'normal', style: 'plain' }
    case 'title': {
      const named = displayOf(table)
      return {
        kind: 'title',
        text: named === undefined ? table.label : cite(named),
        subtitle: '',
        style: 'accent',
        align: 'left',
        size: 'large',
      }
    }
    case 'fields':
      return { kind: 'fields', fields: [], columns: 1, labels: 'beside', hide_empty: false }
    case 'rows': {
      const first = sources[0]
      if (first === undefined) return null
      const { columns, totals } = rowsColumns(first.table)
      return {
        kind: 'rows',
        title: '',
        source: first.source,
        columns,
        totals,
        style: 'accent',
        zebra: true,
        headers: {},
        widths: {},
        align: {},
      }
    }
    case 'image': {
      const field = imageFields(table)[0]
      return {
        kind: 'image',
        source:
          field === undefined ? { kind: 'upload', data: '' } : { kind: 'field', field: field.name },
        width: 40,
        align: 'left',
      }
    }
    case 'divider':
      return { kind: 'divider', color: 'light', thickness: 1, width: 100 }
    case 'spacer':
      return { kind: 'spacer', height: 8 }
    case 'columns':
      return {
        kind: 'columns',
        widths: [1, 1],
        columns: [
          [{ kind: 'text', html: '', align: 'left', size: 'normal', style: 'plain' }],
          [{ kind: 'text', html: '', align: 'left', size: 'normal', style: 'plain' }],
        ],
      }
    case 'break':
      return { kind: 'break' }
  }
}

/** The column that names a row: the table's display column, else its first text. */
export function displayOf(table: Table): string | undefined {
  return (
    table.display_field ??
    table.fields.find((f) => f.kind === 'short_text' && f.system !== true)?.name
  )
}

/** Blocks in a list, those inside columns included — what the server counts. */
export const countBlocks = (blocks: readonly DocumentBlock[]): number =>
  blocks.reduce(
    (n, b) => n + 1 + (b.kind === 'columns' ? b.columns.reduce((m, c) => m + c.length, 0) : 0),
    0,
  )

/** An image block whose picture is still to be chosen: kept out of what is sent. */
export const unfinished = (b: DocumentBlock) =>
  b.kind === 'image' && b.source.kind === 'upload' && b.source.data === ''

/** The definition as sent: pictures still to choose are left out, it would be refused. */
export function sendable(spec: DocumentSpec): DocumentSpec {
  return {
    ...spec,
    blocks: spec.blocks
      .filter((b) => !unfinished(b))
      .map((b) =>
        b.kind === 'columns'
          ? { ...b, columns: b.columns.map((c) => c.filter((inner) => !unfinished(inner))) }
          : b,
      ),
  }
}

/** Plain text of a rich text, for a block's one-line summary. */
export const plainOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
