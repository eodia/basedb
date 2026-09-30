import {
  EMAIL_PATTERN,
  type FieldKind,
  MAX_EMAIL_CHARS,
  MAX_FILES_PER_VALUE,
  MAX_URL_CHARS,
  URL_PATTERN,
  isFileKind,
} from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'
import { sanitizeRichText } from './rich-text.js'

/**
 * The values whose wire form is not their column form — chapter 04 §3 and §3 bis.
 *
 * Every other kind is handed to PostgreSQL as received, and the column's type and
 * constraints decide. Two cannot be:
 *
 *   - a `multi_select` arrives as a JSON list, possibly with repeats, possibly empty; the
 *     column is a `text[]` whose `CHECK` refuses an empty array — empty is `NULL`, so
 *     that `NOT NULL` means "at least one";
 *   - a `file` or `image` arrives as references to files deposited beforehand; the column
 *     stores what a reader needs to list them, and that is copied from `stored_file`,
 *     NEVER from the request. A client that sends `{ id, name: "facture.pdf" }` for a
 *     file deposited as `virus.exe` gets `virus.exe` back;
 *   - a RICH long text arrives as any HTML; the column stores its canonical, sanitized
 *     form (chapter 04 §2.2), and nothing when nothing readable is left.
 */

/** A field whose value is reshaped before it is written, by physical name. */
export interface ShapedField {
  readonly id: string
  readonly kind: FieldKind
  /** A long text holding HTML: sanitized before it is written. */
  readonly rich?: boolean
}

/** What a file column holds for each file — and what a reader gets back, plus a link. */
export interface StoredFileRef {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly size: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The fields of a table that need reshaping, keyed by physical name. */
export function shapedFields(
  fields: ReadonlyMap<
    string,
    { readonly name: string; readonly kind: FieldKind; readonly rich?: boolean }
  >,
): Map<string, ShapedField> {
  const shaped = new Map<string, ShapedField>()
  for (const [id, field] of fields) {
    if (field.kind === 'long_text' && field.rich === true) {
      shaped.set(field.name, { id, kind: field.kind, rich: true })
      continue
    }
    if (
      field.kind === 'multi_select' ||
      field.kind === 'multi_link' ||
      field.kind === 'url' ||
      field.kind === 'email' ||
      field.kind === 'user' ||
      isFileKind(field.kind)
    ) {
      shaped.set(field.name, { id, kind: field.kind })
    }
  }
  return shaped
}

/**
 * Reshapes the values of one row.
 *
 * Only the WRITABLE names are touched. A name outside the write mask is left for the
 * caller to refuse with the refusal it owes — reshaping it first would answer "invalid
 * file" for a field the actor may not even know exists.
 */
export async function shapeValues(
  exec: Executor,
  shaped: ReadonlyMap<string, ShapedField>,
  writable: ReadonlySet<string>,
  values: Readonly<Record<string, unknown>>,
): Promise<Readonly<Record<string, unknown>>> {
  let out: Record<string, unknown> | null = null
  for (const [name, value] of Object.entries(values)) {
    const field = shaped.get(name)
    if (field === undefined || !writable.has(name)) continue
    out ??= { ...values }
    out[name] =
      field.rich === true
        ? shapeRichText(name, value)
        : field.kind === 'multi_select'
          ? shapeChoices(name, value)
          : field.kind === 'multi_link'
            ? shapeMultiLink(name, value)
            : field.kind === 'url'
              ? shapeUrl(name, value)
              : field.kind === 'email'
                ? shapeEmail(name, value)
                : field.kind === 'user'
                  ? await shapeUser(exec, name, field, value)
                  : await shapeFiles(exec, name, field, value)
  }
  return out ?? values
}

/** HTML in, its canonical sanitized form out — `null` when nothing readable is left. */
function shapeRichText(name: string, value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw invalid(name, 'texte_attendu')
  const clean = sanitizeRichText(value)
  return clean === '' ? null : clean
}

function invalid(field: string, reason: string): BasedbError {
  return new BasedbError('VALUE_INVALID', { details: { field, reason } })
}

/**
 * A multiple choice: a list of strings, repeats dropped in first-seen order. A lone
 * string is a list of one — what a person pasting a single value means.
 */
export function shapeChoices(field: string, value: unknown): readonly string[] | null {
  if (value === null || value === undefined || value === '') return null
  const items = Array.isArray(value) ? value : [value]
  const seen = new Set<string>()
  for (const item of items) {
    if (typeof item !== 'string' || item.includes('\u0000')) throw invalid(field, 'liste_de_textes')
    const trimmed = item.trim()
    if (trimmed !== '') seen.add(trimmed)
  }
  // Whether each value is in the list is the column's `CHECK` to say — the one rule
  // direct SQL is held to as well, so there is no second copy of the list here.
  return seen.size === 0 ? null : [...seen]
}

/**
 * A multi-link — chapter 04 §4 bis: a list of identifiers or of `{ id }` objects, so that a
 * row read can be written back as it came; a lone identifier is a list of one. Repeats
 * are dropped in first-seen order, empty is `NULL`. Whether each row exists is the
 * trigger's to say — the one rule direct SQL is held to as well.
 */
export function shapeMultiLink(field: string, value: unknown): readonly string[] | null {
  if (value === null || value === undefined || value === '') return null
  const items = Array.isArray(value) ? value : [value]
  const seen = new Set<string>()
  for (const item of items) {
    const id =
      typeof item === 'string'
        ? item
        : typeof item === 'object' && item !== null && 'id' in item
          ? (item as { id: unknown }).id
          : undefined
    // A masked element is a read of a table one may not see: it cannot be written back.
    if (typeof id !== 'string' || !UUID.test(id)) throw invalid(field, 'identifiant_de_ligne')
    seen.add(id.toLowerCase())
  }
  return seen.size === 0 ? null : [...seen]
}

/**
 * An address: trimmed, empty is `NULL`, a bare domain — `exemple.fr/tarifs` — gets the
 * `https://` a person means when they type one, and an e-mail address its `mailto:`.
 * Anything else that is not an `http(s)` or `mailto:` address is refused by name, before
 * the column's CHECK would refuse it blind.
 */
export function shapeUrl(field: string, value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw invalid(field, 'adresse_url')
  const text = value.trim()
  if (text === '') return null
  const withScheme = /^(https?:\/\/|mailto:)/i.test(text)
    ? text
    : /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(text)
      ? `mailto:${text}`
      : /^[^\s/@:]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(text)
        ? `https://${text}`
        : text
  if (withScheme.length > MAX_URL_CHARS || !URL_PATTERN.test(withScheme)) {
    throw invalid(field, 'adresse_url')
  }
  return withScheme
}

/** An e-mail address: trimmed, empty is `NULL`, a `mailto:` pasted with it dropped. */
export function shapeEmail(field: string, value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw invalid(field, 'adresse_email')
  const text = value.trim().replace(/^mailto:/i, '')
  if (text === '') return null
  if (text.length > MAX_EMAIL_CHARS || !EMAIL_PATTERN.test(text)) {
    throw invalid(field, 'adresse_email')
  }
  return text
}

/**
 * A person: the identifier of a user of the SAME tenant as the table, not deleted — the
 * column has no foreign key across `_basedb` (A9), so this is the check that stands for
 * it. A disabled account may still be assigned: it names someone who was there. An
 * identifier from elsewhere reads as unknown, like a file of another field.
 */
export async function shapeUser(
  exec: Executor,
  name: string,
  field: ShapedField,
  value: unknown,
): Promise<string | null> {
  if (value === null || value === undefined || value === '') return null
  const id =
    typeof value === 'string'
      ? value
      : typeof value === 'object' &&
          value !== null &&
          typeof (value as { id?: unknown }).id === 'string'
        ? (value as { id: string }).id
        : null
  if (id === null || !UUID.test(id)) throw invalid(name, 'personne_inconnue')
  const rows = await exec.query<{ id: string }>(
    `SELECT u.id::text
       FROM _basedb.app_user u
       JOIN _basedb.field f ON f.id = $2
       JOIN _basedb.base b  ON b.id = f.base_id
      WHERE u.id = $1::uuid AND u.tenant_id = b.tenant_id
        AND u.deleted_at IS NULL AND (NOT u.is_system OR u.is_instance_admin)`,
    [id, field.id],
  )
  if (rows.length === 0) throw invalid(name, 'personne_inconnue')
  return rows[0]?.id ?? null
}

/**
 * A list of files: each entry names a file deposited FOR THIS FIELD, by its identifier
 * alone or as an object carrying it (what a reader got back, sent unchanged). The rest
 * of what the entry says is ignored and re-read from the catalog.
 */
async function shapeFiles(
  exec: Executor,
  name: string,
  field: ShapedField,
  value: unknown,
): Promise<string | null> {
  if (value === null || value === undefined) return null
  const items = Array.isArray(value) ? value : [value]

  const ids: string[] = []
  for (const item of items) {
    const id =
      typeof item === 'string'
        ? item
        : typeof item === 'object' &&
            item !== null &&
            typeof (item as { id?: unknown }).id === 'string'
          ? (item as { id: string }).id
          : null
    if (id === null || !UUID.test(id)) throw invalid(name, 'reference_de_fichier')
    const lower = id.toLowerCase()
    if (!ids.includes(lower)) ids.push(lower)
  }
  if (ids.length === 0) return null
  if (ids.length > MAX_FILES_PER_VALUE) {
    throw new BasedbError('VALUE_OUT_OF_RANGE', {
      details: { field: name, reason: 'trop_de_fichiers', maximum: MAX_FILES_PER_VALUE },
    })
  }

  const rows = await exec.query<{
    id: string
    name: string
    mime_type: string
    size_bytes: string
  }>(
    `SELECT id, name, mime_type, size_bytes
       FROM _basedb.stored_file
      WHERE field_id = $1 AND id = ANY($2::uuid[])`,
    [field.id, ids],
  )
  const found = new Map(rows.map((r) => [r.id, r]))

  // A file deposited for another field — of another table, of another base — is
  // answered as a file that does not exist: the identifier alone must not carry a file
  // across a boundary the actor was never checked against.
  const files: StoredFileRef[] = ids.map((id) => {
    const row = found.get(id)
    if (row === undefined) throw invalid(name, 'fichier_inconnu')
    return { id: row.id, name: row.name, type: row.mime_type, size: Number(row.size_bytes) }
  })

  // Serialized here: `pg` turns a JavaScript array into a PostgreSQL array literal, which
  // a `jsonb` column refuses. A string is inferred as `jsonb` from the column.
  return JSON.stringify(files)
}
