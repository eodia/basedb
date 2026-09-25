import { type FieldKind, MAX_FILES_PER_VALUE, isFileKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'

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
 *     file deposited as `virus.exe` gets `virus.exe` back.
 */

/** A field whose value is reshaped before it is written, by physical name. */
export interface ShapedField {
  readonly id: string
  readonly kind: FieldKind
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
  fields: ReadonlyMap<string, { readonly name: string; readonly kind: FieldKind }>,
): Map<string, ShapedField> {
  const shaped = new Map<string, ShapedField>()
  for (const [id, field] of fields) {
    if (field.kind === 'multi_select' || isFileKind(field.kind)) {
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
      field.kind === 'multi_select'
        ? shapeChoices(name, value)
        : await shapeFiles(exec, name, field, value)
  }
  return out ?? values
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
