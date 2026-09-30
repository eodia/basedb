import { BasedbError } from '../errors/index.js'
import { requireOnField } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { sanitizeRichText } from './rich-text.js'
import { shapeChoices, shapeEmail, shapeUrl, shapeUser } from './values.js'

/**
 * Default values — chapter 04 §1.5.
 *
 * A field may carry the value every row created without it takes: a fixed value, today's
 * date, the instant, or the person creating the row. The kernel applies it at creation,
 * whatever the surface — screen, API, MCP, import, form, automation — and no `DEFAULT`
 * clause is laid on the column: « whoever creates » and « today, in their time zone » do
 * not exist for PostgreSQL. A direct SQL write therefore gets none.
 *
 * A default fills a field the write did not NAME. A field named with `null` is a choice —
 * « no value » — and is left alone. It fills a field whatever the author's write mask:
 * like `_created_by`, it is the table's rule, not the author's write.
 */

export const DEFAULT_KINDS = ['value', 'today', 'now', 'me'] as const
export type DefaultKind = (typeof DEFAULT_KINDS)[number]

/** A field's default as the catalog holds it and the projection publishes it. */
export interface FieldDefault {
  readonly kind: DefaultKind
  /** For `value`: the value in its column form — a list for a multiple choice. */
  readonly value?: unknown
}

/** The defaults each kind of field takes: `today` is a date, `me` a person. */
export const DEFAULTS_BY_KIND: Readonly<Record<string, readonly DefaultKind[]>> = {
  short_text: ['value'],
  long_text: ['value'],
  number: ['value'],
  boolean: ['value'],
  date: ['value', 'today'],
  datetime: ['value', 'now'],
  select: ['value'],
  multi_select: ['value'],
  url: ['value'],
  email: ['value'],
  user: ['value', 'me'],
}

/**
 * The defaults a reader may rely on: a choice removed since is not a value the column's
 * `CHECK` accepts, and a default naming one is ignored rather than failing every row
 * created — re-adding the choice brings it back. Written for `f` (the field) and `fd`
 * (its default), the projection and the write both read it.
 */
export const DEFAULT_STILL_VALID = `(fd.kind <> 'value' OR f.kind NOT IN ('select', 'multi_select')
   OR NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements_text(CASE jsonb_typeof(fd.value)
                                        WHEN 'array' THEN fd.value
                                        ELSE jsonb_build_array(fd.value) END) AS v(value)
      WHERE NOT EXISTS (SELECT 1 FROM _basedb.select_option o
                         WHERE o.field_id = f.id AND o.deleted_at IS NULL
                           AND o.value = v.value)))
  AND NOT EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id)`

function refuse(reason: string): never {
  throw new BasedbError('REQUEST_INVALID', { details: { field: 'default', reason } })
}

interface DefaultedField {
  readonly id: string
  /** The physical name, what a refused value is reported against. */
  readonly name: string
  readonly kind: string
  readonly rich: boolean
  readonly maxLength: number | null
}

/**
 * Turns what a caller sent into the default stored for `field`: `{ kind: "today" }`, or
 * `{ kind: "value", value: … }` with the value as a write would send it. The value is
 * brought to its column form by the same rules as a write, so that applying it is a copy.
 */
export async function normalizeDefault(
  exec: Executor,
  field: DefaultedField,
  input: unknown,
): Promise<FieldDefault> {
  const accepted = DEFAULTS_BY_KIND[field.kind]
  if (accepted === undefined) refuse('type_sans_valeur_par_defaut')
  if (typeof input !== 'object' || input === null || Array.isArray(input)) refuse('objet_attendu')
  const { kind, value } = input as { kind?: unknown; value?: unknown }
  if (typeof kind !== 'string' || !(accepted as readonly string[]).includes(kind)) {
    refuse('genre_inconnu')
  }
  if (kind !== 'value') return { kind: kind as DefaultKind }
  if (value === null || value === undefined || value === '') refuse('valeur_vide')
  return { kind: 'value', value: await columnForm(exec, field, value) }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

async function columnForm(exec: Executor, field: DefaultedField, value: unknown): Promise<unknown> {
  const wrong = (): never => {
    throw new BasedbError('VALUE_INVALID', {
      details: { field: field.name, reason: 'valeur_par_defaut' },
    })
  }
  switch (field.kind) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string' || value.includes('\u0000')) return wrong()
      const text = field.rich ? sanitizeRichText(value) : value
      if (text.trim() === '') return wrong()
      if (field.maxLength !== null && [...text].length > field.maxLength) {
        throw new BasedbError('VALUE_OUT_OF_RANGE', {
          details: { field: field.name, reason: 'trop_long', maximum: field.maxLength },
        })
      }
      return text
    }
    case 'number': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
      return typeof n === 'number' && Number.isFinite(n) ? n : wrong()
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : wrong()
    case 'date': {
      const m = typeof value === 'string' ? DATE.exec(value) : null
      if (m === null) return wrong()
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
      return d.toISOString().slice(0, 10) === value ? value : wrong()
    }
    case 'datetime': {
      const t = typeof value === 'string' ? Date.parse(value) : Number.NaN
      return Number.isNaN(t) ? wrong() : new Date(t).toISOString()
    }
    case 'select':
    case 'multi_select': {
      const choices =
        field.kind === 'select'
          ? typeof value === 'string'
            ? [value]
            : wrong()
          : shapeChoices(field.name, value)
      if (choices === null || choices.length === 0) return wrong()
      const live = await exec.query<{ value: string }>(
        `SELECT value FROM _basedb.select_option
          WHERE field_id = $1 AND deleted_at IS NULL AND value = ANY($2::text[])`,
        [field.id, choices],
      )
      if (live.length !== new Set(choices).size) {
        throw new BasedbError('VALUE_INVALID', {
          details: { field: field.name, reason: 'choix_inconnu' },
        })
      }
      return field.kind === 'select' ? choices[0] : choices
    }
    case 'url':
      return shapeUrl(field.name, value) ?? wrong()
    case 'email':
      return shapeEmail(field.name, value) ?? wrong()
    case 'user':
      return (await shapeUser(exec, field.name, { id: field.id, kind: 'user' }, value)) ?? wrong()
    default:
      return wrong()
  }
}

/**
 * Sets or removes (`null`) a field's default. Building the table is `manage_schema`
 * (chapter 05 §8); the write moves `catalog_version`, and every screen prefills anew.
 */
export async function setFieldDefault(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string; readonly default: unknown },
): Promise<FieldDefault | null> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnField(exec, ctx, 'manage_schema', request.fieldId)
    const [field] = await exec.query<{
      kind: string
      name: string
      is_rich: boolean
      max_length: number | null
      has_ai: boolean
    }>(
      `SELECT f.kind, n.name, coalesce(tc.is_rich, false) AS is_rich, tc.max_length,
              EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai
         FROM _basedb.field f
         JOIN _basedb.physical_name n ON n.id = f.name_id
         LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
        WHERE f.id = $1 AND f.is_live`,
      [request.fieldId],
    )
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.fieldId } })
    }
    if (request.default === null) {
      await exec.query(
        'DELETE FROM _basedb.field_default WHERE field_id = $1',
        [request.fieldId],
        'delete',
      )
      return null
    }
    // A field the AI fills is written by the model alone (chapter 12 §1.5).
    if (field.has_ai) refuse('champ_calcule')
    const normalized = await normalizeDefault(
      exec,
      {
        id: request.fieldId,
        name: field.name,
        kind: field.kind,
        rich: field.is_rich,
        maxLength: field.max_length === null ? null : Number(field.max_length),
      },
      request.default,
    )
    await exec.query(
      `INSERT INTO _basedb.field_default (field_id, kind, value, updated_by)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (field_id) DO UPDATE
          SET kind = EXCLUDED.kind, value = EXCLUDED.value,
              updated_by = EXCLUDED.updated_by, updated_at = clock_timestamp()`,
      [
        request.fieldId,
        normalized.kind,
        normalized.kind === 'value' ? JSON.stringify(normalized.value) : null,
        ctx.actor.kind === 'user' ? ctx.actor.id : null,
      ],
      'insert',
    )
    return normalized
  })
}

/** A table's defaults, by physical name — those a write can still apply. */
export async function loadDefaults(
  exec: Executor,
  tableId: string,
): Promise<ReadonlyMap<string, FieldDefault>> {
  const rows = await exec.query<{ name: string; kind: DefaultKind; value: unknown }>(
    `SELECT n.name, fd.kind, fd.value
       FROM _basedb.field_default fd
       JOIN _basedb.field f         ON f.id = fd.field_id
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL
        AND ${DEFAULT_STILL_VALID}`,
    [tableId],
  )
  return new Map(
    rows.map((r) => [
      r.name,
      r.kind === 'value' ? { kind: r.kind, value: r.value } : { kind: r.kind },
    ]),
  )
}

/** Today's date where `timeZone` is — `YYYY-MM-DD`. An unknown zone reads as UTC. */
export function todayIn(timeZone: string, at: Date): string {
  try {
    // `en-CA` writes a date as ISO does; the parts are reassembled all the same, so that a
    // runtime with another default layout cannot change the result.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at)
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')}`
  } catch {
    return at.toISOString().slice(0, 10)
  }
}

/**
 * The values a table's defaults give one write: the person creating (`null` for an answer
 * to a public form, which has no author — `me` then fills nothing), the time zone « today »
 * is read in, and the instant of the request.
 */
export function resolveDefaults(
  defaults: ReadonlyMap<string, FieldDefault>,
  who: { readonly actorId: string | null; readonly timeZone: string; readonly at: Date },
): ReadonlyMap<string, unknown> {
  const out = new Map<string, unknown>()
  for (const [name, d] of defaults) {
    if (d.kind === 'value') out.set(name, d.value)
    else if (d.kind === 'today') out.set(name, todayIn(who.timeZone, who.at))
    else if (d.kind === 'now') out.set(name, who.at.toISOString())
    else if (who.actorId !== null) out.set(name, who.actorId)
  }
  return out
}

/** The time zone of a person, as their profile sets it; UTC for anyone else. */
export async function timeZoneOf(exec: Executor, userId: string | null): Promise<string> {
  if (userId === null) return 'UTC'
  const [row] = await exec.query<{ timezone: string }>(
    'SELECT timezone FROM _basedb.app_user WHERE id = $1',
    [userId],
  )
  return row?.timezone ?? 'UTC'
}
