import { LOCALES, type Locale, isLocale } from '@basedb/contracts'
import { BasedbError } from '../errors/index.js'
import { sanitizeRichText } from '../records/rich-text.js'
import type { Executor } from '../runtime/pool.js'

/**
 * A document template — chapter 21 §1: how a row of a table becomes a PDF. The page, the
 * language its values are written in, a line at the foot of every page, and a list of
 * blocks: rich text citing the row's columns, the row's fields, a table of the rows linked
 * to it, a page break.
 *
 * Checked when written, against the catalog of that day; read again against the catalog
 * of the day of each rendering, where what has disappeared since is left out rather than
 * failing the document.
 */

export type PageSize = 'A4' | 'LETTER'
export type Orientation = 'portrait' | 'landscape'

/** The rows a table block lists. */
export type RowsSource =
  /** The rows of another table whose link field names this row — an invoice's lines. */
  | { readonly kind: 'incoming'; readonly table: string; readonly field: string }
  /** The rows a multiple link of this row names. */
  | { readonly kind: 'outgoing'; readonly field: string }

export type DocumentBlock =
  | { readonly kind: 'text'; readonly html: string }
  | { readonly kind: 'fields'; readonly fields: readonly string[] }
  | {
      readonly kind: 'rows'
      readonly title: string
      readonly source: RowsSource
      /** The columns of the rows listed, by physical name, in order. */
      readonly columns: readonly string[]
      /** Those of `columns` summed under the table. */
      readonly totals: readonly string[]
    }
  | { readonly kind: 'break' }

export interface DocumentSpec {
  readonly page: { readonly size: PageSize; readonly orientation: Orientation }
  /** How values read: numbers, amounts, dates, yes and no. */
  readonly locale: Locale
  /** A line at the foot of every page, citing columns; the page number goes beside it. */
  readonly footer: string
  readonly blocks: readonly DocumentBlock[]
}

export const MAX_BLOCKS = 50
export const MAX_COLUMNS = 12
export const MAX_HTML_CHARS = 50_000
export const MAX_ROWS_LISTED = 500

function refuse(field: string, reason: string, detail?: unknown): never {
  throw new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })
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

const names = (value: unknown, field: string, max: number): string[] => {
  if (!Array.isArray(value)) refuse(field, 'liste_attendue')
  const out = [...new Set(value.filter((v): v is string => typeof v === 'string'))]
  if (out.length > max) refuse(field, 'trop_de_colonnes', max)
  return out
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
  if (typeof input !== 'object' || input === null) refuse('spec', 'objet_attendu')
  const raw = input as Record<string, unknown>
  const page = (raw.page ?? {}) as Record<string, unknown>
  const size = page.size ?? 'A4'
  const orientation = page.orientation ?? 'portrait'
  if (size !== 'A4' && size !== 'LETTER') refuse('spec.page.size', 'format_inconnu')
  if (orientation !== 'portrait' && orientation !== 'landscape')
    refuse('spec.page.orientation', 'orientation_inconnue')
  const locale = raw.locale ?? 'fr'
  if (!isLocale(locale)) refuse('spec.locale', 'langue_inconnue', LOCALES)
  const footer = typeof raw.footer === 'string' ? raw.footer.replace(/\s+/g, ' ').trim() : ''
  if (footer.length > 300) refuse('spec.footer', 'texte_trop_long', 300)
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) refuse('spec.blocks', 'aucun_bloc')
  if (raw.blocks.length > MAX_BLOCKS) refuse('spec.blocks', 'trop_de_blocs', MAX_BLOCKS)

  const own = await fieldsOf(exec, tableId)
  const [{ base_id: baseId } = { base_id: '' }] = await exec.query<{ base_id: string }>(
    'SELECT base_id::text FROM _basedb.table_def WHERE id = $1',
    [tableId],
  )
  const blocks: DocumentBlock[] = []
  for (const [i, value] of raw.blocks.entries()) {
    const at = `spec.blocks[${i}]`
    const b = (value ?? {}) as Record<string, unknown>
    switch (b.kind) {
      case 'text': {
        const html = typeof b.html === 'string' ? sanitizeRichText(b.html) : ''
        if (html.length > MAX_HTML_CHARS) refuse(`${at}.html`, 'texte_trop_long', MAX_HTML_CHARS)
        blocks.push({ kind: 'text', html })
        break
      }
      case 'fields': {
        const fields = names(b.fields, `${at}.fields`, 200)
        const unknown = fields.find((f) => !own.kinds.has(f))
        if (unknown !== undefined) refuse(`${at}.fields`, 'champ_inconnu', unknown)
        blocks.push({ kind: 'fields', fields })
        break
      }
      case 'rows': {
        const source = (b.source ?? {}) as Record<string, unknown>
        let related: Fields
        let checked: RowsSource
        if (source.kind === 'incoming') {
          const table = typeof source.table === 'string' ? source.table : ''
          const [found] = await exec.query<{ id: string }>(
            `SELECT id::text FROM _basedb.table_def
              WHERE id::text = $1 AND base_id = $2 AND is_live AND deleted_at IS NULL`,
            [table, baseId],
          )
          if (found === undefined) refuse(`${at}.source.table`, 'table_inconnue', table)
          related = await fieldsOf(exec, table)
          const field = typeof source.field === 'string' ? source.field : ''
          const kind = related.kinds.get(field)
          if ((kind !== 'link' && kind !== 'multi_link') || related.targets.get(field) !== tableId)
            refuse(`${at}.source.field`, 'lien_vers_la_table_attendu', field)
          checked = { kind: 'incoming', table, field }
        } else if (source.kind === 'outgoing') {
          const field = typeof source.field === 'string' ? source.field : ''
          const target = own.targets.get(field)
          if (own.kinds.get(field) !== 'multi_link' || target === undefined)
            refuse(`${at}.source.field`, 'lien_multiple_attendu', field)
          related = await fieldsOf(exec, target)
          checked = { kind: 'outgoing', field }
        } else {
          refuse(`${at}.source.kind`, 'source_inconnue')
        }
        const columns = names(b.columns, `${at}.columns`, MAX_COLUMNS)
        if (columns.length === 0) refuse(`${at}.columns`, 'aucune_colonne')
        const unknown = columns.find((c) => !related.kinds.has(c))
        if (unknown !== undefined) refuse(`${at}.columns`, 'champ_inconnu', unknown)
        const totals = names(b.totals ?? [], `${at}.totals`, MAX_COLUMNS).filter((t) =>
          columns.includes(t),
        )
        const title = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim() : ''
        if (title.length > 200) refuse(`${at}.title`, 'texte_trop_long', 200)
        blocks.push({ kind: 'rows', title, source: checked, columns, totals })
        break
      }
      case 'break':
        blocks.push({ kind: 'break' })
        break
      default:
        refuse(`${at}.kind`, 'bloc_inconnu', b.kind)
    }
  }
  return { page: { size, orientation }, locale, footer, blocks }
}

/** The document a row reads as when its table has no template: its fields, all of them. */
export const SHEET: DocumentSpec = {
  page: { size: 'A4', orientation: 'portrait' },
  locale: 'fr',
  footer: '',
  blocks: [{ kind: 'fields', fields: [] }],
}
