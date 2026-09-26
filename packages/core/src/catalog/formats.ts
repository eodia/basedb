import { BasedbError } from '../errors/index.js'
import { requireOnField } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Display formats — chapter 02 (« Un type, ou un format ? »), chapter 04.
 *
 * A format changes how a value READS, never what the column holds: a currency is a
 * `number` shown with its symbol, a rating a `number` shown as stars, a phone number a
 * short text drawn as a link to call. It lives in the field's satellite, so changing it
 * is one `UPDATE` of the catalog — no migration, no rewrite, nothing for direct SQL to
 * notice.
 */

export const NUMBER_FORMATS = [
  'decimal',
  'integer',
  'percent',
  'currency',
  'duration',
  'rating',
] as const
export const TEXT_FORMATS = ['plain', 'phone', 'barcode'] as const

export type NumberFormat = (typeof NUMBER_FORMATS)[number]
export type TextFormat = (typeof TEXT_FORMATS)[number]

/** A field's format as the catalog holds it and the projection publishes it. */
export interface FieldFormat {
  readonly display: string
  /** ISO 4217, for a currency. */
  readonly currency: string | null
  /** The number of stars, for a rating. */
  readonly ratingMax: number | null
}

/** What a caller sends: every key optional, snake case like the rest of the API. */
export interface FieldFormatInput {
  readonly display?: unknown
  readonly currency?: unknown
  readonly rating_max?: unknown
}

/** The kinds that take a format. */
export const FORMATTABLE = new Set(['number', 'short_text'])

function refuse(reason: string): never {
  throw new BasedbError('REQUEST_INVALID', { details: { field: 'format', reason } })
}

/**
 * Turns what a caller sent into the format stored for a field of `kind`. A currency
 * without a code is in euros; a rating without a maximum has five stars.
 */
export function normalizeFormat(kind: string, input: FieldFormatInput): FieldFormat {
  if (!FORMATTABLE.has(kind)) refuse('type_sans_format')
  const display = input.display ?? (kind === 'number' ? 'decimal' : 'plain')
  const allowed: readonly string[] = kind === 'number' ? NUMBER_FORMATS : TEXT_FORMATS
  if (typeof display !== 'string' || !allowed.includes(display)) refuse('format_inconnu')

  let currency: string | null = null
  if (display === 'currency') {
    const code = input.currency ?? 'EUR'
    if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code.toUpperCase())) {
      refuse('devise_invalide')
    }
    currency = code.toUpperCase()
  }

  let ratingMax: number | null = null
  if (display === 'rating') {
    const max = input.rating_max ?? 5
    if (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > 10) {
      refuse('note_invalide')
    }
    ratingMax = max
  }
  return { display, currency, ratingMax }
}

/** Writes a format into the field's satellite — which exists: every number and text has one. */
export async function writeFormat(
  exec: Executor,
  fieldId: string,
  kind: string,
  format: FieldFormat,
): Promise<void> {
  if (kind === 'number') {
    await exec.query(
      `UPDATE _basedb.field_number_config
          SET display_format = $2, currency_code = $3, rating_max = $4
        WHERE field_id = $1`,
      [fieldId, format.display, format.currency, format.ratingMax],
      'update',
    )
  } else {
    await exec.query(
      'UPDATE _basedb.field_text_config SET display_format = $2 WHERE field_id = $1',
      [fieldId, format.display],
      'update',
    )
  }
  // The satellite is not versioned: the field row is touched so that `catalog_version`
  // moves, and every cached description of the base is read again.
  await exec.query(
    'UPDATE _basedb.field SET updated_at = clock_timestamp() WHERE id = $1',
    [fieldId],
    'update',
  )
}

/** Changes how a field reads. Building the table is `manage_schema` (chapter 05 §8). */
export async function setFieldFormat(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string; readonly format: FieldFormatInput },
): Promise<FieldFormat> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnField(exec, ctx, 'manage_schema', request.fieldId)
    const [field] = await exec.query<{ kind: string }>(
      'SELECT kind FROM _basedb.field WHERE id = $1 AND is_live',
      [request.fieldId],
    )
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.fieldId } })
    }
    const format = normalizeFormat(field.kind, request.format)
    await writeFormat(exec, request.fieldId, field.kind, format)
    return format
  })
}
