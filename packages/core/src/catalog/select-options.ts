import { checkConstraintName, qualify, quoteIdentifier } from '@basedb/naming'
import { quoteLiteral } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { allocateName } from '../naming/allocation.js'
import { loadGrants } from '../rbac/loader.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { assertManageSchema } from './lifecycle.js'

/**
 * The options of a `select` — chapter 04 §3.
 *
 * An option is a stored VALUE, a free LABEL, and how it looks: a colour of any hue, and
 * either a pictogram of the interface's icon library or a small picture. The look is
 * catalog only — no column of the user's table knows it — so changing it takes no lock
 * and rewrites no row. Changing the SET of values does not get off so lightly: the list is
 * a `CHECK` constraint, and it is regenerated.
 */

/** Bounds of chapter 03 §"Valeurs d'options" — and one of this file's own. */
export const MAX_OPTIONS = 200
export const MAX_OPTION_CHARS = 200
export const MAX_LABEL_CHARS = 255
/**
 * The longest picture, as the URL that carries it. A data URL of a 64-pixel icon is a few
 * kilobytes; the ceiling is what keeps a base description from growing by megabytes when
 * two hundred options each carry one, since the whole list travels with every catalog read.
 */
export const MAX_IMAGE_CHARS = 16_384

export interface SelectOptionInput {
  readonly value: string
  /** Defaults to the value. */
  readonly label?: string | null
  /** `#rgb` or `#rrggbb`; stored as `#rrggbb`, lowercase. */
  readonly color?: string | null
  /** The name of a pictogram, in kebab case. Exclusive with `image`. */
  readonly icon?: string | null
  /** An `https` URL or a `data:image/…;base64,` URL. Exclusive with `icon`. */
  readonly image?: string | null
}

export interface SelectOption {
  readonly value: string
  readonly label: string
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
}

const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const ICON = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i
const HTTPS_IMAGE = /^https:\/\/[^\s]+$/i

function invalid(reason: string, option?: string): BasedbError {
  return new BasedbError('REQUEST_INVALID', {
    details: { field: 'options', reason, ...(option === undefined ? {} : { option }) },
  })
}

/** `#abc` becomes `#aabbcc`, and case is folded: what the column's CHECK expects. */
function normalizeColor(raw: string | null | undefined, option: string): string | null {
  const text = raw?.trim() ?? ''
  if (text === '') return null
  if (!COLOR.test(text)) throw invalid('couleur_invalide', option)
  const hex = text.slice(1).toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`
}

/**
 * Validates and normalises a list of options, whichever operation carries it.
 *
 * Shared by the creation of a `select` and by `setSelectOptions`, so the two cannot come
 * to accept different things: a list that a JSON paste can produce is a list the creation
 * dialog can too.
 */
export function normalizeOptions(options: readonly SelectOptionInput[]): readonly SelectOption[] {
  if (options.length === 0) throw invalid('liste_vide')
  if (options.length > MAX_OPTIONS) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'options', reason: 'trop_d_options', maximum: MAX_OPTIONS },
    })
  }

  const seen = new Set<string>()
  return options.map((raw) => {
    if (typeof raw?.value !== 'string') throw invalid('valeur_absente')
    const value = raw.value.trim()
    if (value === '') throw invalid('vide')
    if (value.includes('\0')) throw invalid('caractere_nul', value)
    if ([...value].length > MAX_OPTION_CHARS) throw invalid('trop_long', value)
    if (seen.has(value)) throw new BasedbError('DUPLICATE_VALUE', { details: { option: value } })
    seen.add(value)

    const label = (raw.label ?? '').trim() === '' ? value : (raw.label as string).trim()
    if ([...label].length > MAX_LABEL_CHARS) {
      throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: MAX_LABEL_CHARS } })
    }

    const icon = (raw.icon ?? '').trim() === '' ? null : (raw.icon as string).trim()
    if (icon !== null && (!ICON.test(icon) || icon.length > 64)) {
      throw invalid('icone_invalide', value)
    }

    const image = (raw.image ?? '').trim() === '' ? null : (raw.image as string).trim()
    if (image !== null) {
      if (!DATA_IMAGE.test(image) && !HTTPS_IMAGE.test(image))
        throw invalid('image_invalide', value)
      if (image.length > MAX_IMAGE_CHARS) throw invalid('image_trop_grande', value)
    }
    if (icon !== null && image !== null) throw invalid('icone_et_image', value)

    return { value, label, color: normalizeColor(raw.color, value), icon, image }
  })
}

export interface SetOptionsResult {
  readonly options: readonly SelectOption[]
  readonly added: readonly string[]
  readonly removed: readonly string[]
  /** What was emitted against the user's schema, in order — empty for a change of look. */
  readonly sql: readonly string[]
}

interface FieldRow extends Record<string, unknown> {
  readonly table_id: string
  readonly base_id: string
  readonly kind: string
  readonly column_name: string
  readonly table_name: string
  readonly schema_name: string
  readonly constraint_id: string | null
}

interface ExistingOption extends Record<string, unknown> {
  readonly value: string
  readonly archived: boolean
}

/** What the first, transactional step leaves for the step that runs outside it. */
type Plan =
  | { readonly regenerated: false; readonly sql: readonly string[] }
  | {
      readonly regenerated: true
      readonly sql: readonly string[]
      readonly relation: string
      readonly constraintName: string
      readonly constraintId: string
    }

/**
 * Replaces the whole list of a `select` by the given one, in the given order.
 *
 * The list is the unit, not the option, because that is what a person edits and what a
 * pasted JSON carries: the values already there are UPDATED (label, colour, picture,
 * place), the new ones are ADDED, and the ones no longer named are REMOVED — refused with
 * `OPTION_IN_USE` and the count while rows still carry them, since dropping them from the
 * `CHECK` would invalidate rows already written (§3, "Cycle de vie des options"). A value
 * is never renamed: that is a mass `UPDATE` of the user's data, a different act.
 *
 * When the set of values moves, the constraint is regenerated in the three steps of
 * chapter 03 — `DROP` and `ADD … NOT VALID` together, `VALIDATE` outside any transaction
 * so that it lets writes through, then the catalog row goes live. When only the look moves,
 * nothing is emitted at all.
 */
export async function setSelectOptions(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly fieldId: string; readonly options: readonly SelectOptionInput[] },
): Promise<SetOptionsResult> {
  const wanted = normalizeOptions(request.options)
  const wantedValues = new Set(wanted.map((o) => o.value))

  let added: string[] = []
  let removed: string[] = []

  const plan = await withTransaction(pools, 'ddl', ctx, async (exec): Promise<Plan> => {
    const [field] = await exec.query<FieldRow>(
      `SELECT f.table_id, f.base_id, f.kind,
              cn.name AS column_name, tn.name AS table_name, sn.name AS schema_name,
              sc.enum_constraint_id AS constraint_id
         FROM _basedb.field f
         JOIN _basedb.physical_name cn ON cn.id = f.name_id
         JOIN _basedb.table_def t      ON t.id = f.table_id
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
         LEFT JOIN _basedb.field_select_config sc ON sc.field_id = f.id
        WHERE f.id = $1 AND f.is_live AND t.is_live`,
      [request.fieldId],
    )
    if (field === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { field: request.fieldId } })
    }
    if (field.kind !== 'select') {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'kind', reason: 'pas_une_liste_de_choix' },
      })
    }
    await assertManageSchema(exec, ctx, await loadGrants(exec, ctx), field.base_id)

    const existing = await exec.query<ExistingOption>(
      `SELECT value, deleted_at IS NOT NULL AS archived
         FROM _basedb.select_option WHERE field_id = $1`,
      [request.fieldId],
    )
    const live = new Set(existing.filter((o) => !o.archived).map((o) => o.value))
    const archived = existing.filter((o) => o.archived).map((o) => o.value)

    added = wanted.filter((o) => !live.has(o.value)).map((o) => o.value)
    removed = [...live].filter((value) => !wantedValues.has(value))

    const relation = qualify(field.schema_name, field.table_name)
    const column = quoteIdentifier(field.column_name)

    // Narrowing: the rows are counted under a lock that keeps writers out, or a row
    // written between the count and the new constraint would carry a value the list no
    // longer allows — and `VALIDATE` would find it after the old constraint was gone.
    if (removed.length > 0) {
      await exec.query(`LOCK TABLE ${relation} IN SHARE ROW EXCLUSIVE MODE`, [], 'ddl')
      const used = await exec.query<{ value: string; count: number }>(
        `SELECT ${column} AS value, count(*)::int AS count
           FROM ${relation} WHERE ${column} = ANY($1::text[]) GROUP BY ${column} ORDER BY 1`,
        [removed],
      )
      if (used.length > 0) {
        throw new BasedbError('OPTION_IN_USE', {
          details: { field: request.fieldId, options: used },
        })
      }
    }

    if (removed.length > 0) {
      await exec.query(
        'DELETE FROM _basedb.select_option WHERE field_id = $1 AND value = ANY($2::text[]) AND deleted_at IS NULL',
        [request.fieldId, removed],
        'delete',
      )
    }
    for (const [index, option] of wanted.entries()) {
      const params = [
        request.fieldId,
        option.value,
        option.label,
        option.color,
        option.icon,
        option.image,
        index + 1,
      ]
      if (live.has(option.value)) {
        await exec.query(
          `UPDATE _basedb.select_option
              SET label = $3, color = $4, icon = $5, image = $6, position = $7
            WHERE field_id = $1 AND value = $2 AND deleted_at IS NULL`,
          params,
          'update',
        )
      } else {
        await exec.query(
          `INSERT INTO _basedb.select_option (field_id, value, label, color, icon, image, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          params,
          'insert',
        )
      }
    }

    if (added.length === 0 && removed.length === 0) {
      return { regenerated: false, sql: [] }
    }

    // The new constraint allows the archived values too: they are still on rows, and the
    // list a person edits never shows them.
    const values = [...wanted.map((o) => o.value), ...archived].map(quoteLiteral).join(', ')
    const name = await allocateName(exec, ctx, {
      derivedName: checkConstraintName(field.table_name, field.column_name, 'enum'),
      objectKind: 'constraint',
      scopeKind: 'table',
      scopeId: field.table_id,
    })
    const [constraint] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.table_constraint
         (table_id, base_id, kind, name_id, rule, origin, state, created_by)
       VALUES ($1, $2, 'check', $3, 'enum', 'system', 'not_valid', $4) RETURNING id`,
      [field.table_id, field.base_id, name.nameId, ctx.actor.id],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
       VALUES ($1, $2, $3, 1)`,
      [constraint.id, request.fieldId, field.table_id],
      'insert',
    )

    // The old constraint goes in the same statement as the new one is born: at no instant
    // is the column without a list, and a writer never sees the gap.
    let drop = ''
    if (field.constraint_id !== null) {
      const [old] = await exec.query<{ name: string }>(
        `SELECT n.name FROM _basedb.table_constraint k
           JOIN _basedb.physical_name n ON n.id = k.name_id WHERE k.id = $1`,
        [field.constraint_id],
      )
      drop = `DROP CONSTRAINT ${quoteIdentifier(old.name)}, `
    }
    const statement = `ALTER TABLE ${relation} ${drop}ADD CONSTRAINT ${quoteIdentifier(name.name)} CHECK (${column} IN (${values})) NOT VALID;`
    await exec.query(statement, [], 'ddl')

    await exec.query(
      'UPDATE _basedb.field_select_config SET enum_constraint_id = $2 WHERE field_id = $1',
      [request.fieldId, constraint.id],
      'update',
    )
    if (field.constraint_id !== null) {
      await exec.query(
        `UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = clock_timestamp()
          WHERE id = $1`,
        [field.constraint_id],
        'update',
      )
    }

    return {
      regenerated: true,
      sql: [statement],
      relation,
      constraintName: name.name,
      constraintId: constraint.id,
    }
  })

  const sql = [...plan.sql]
  if (plan.regenerated) {
    // Step 2, OUTSIDE a transaction: a `VALIDATE` inside one holds its lock until commit.
    // It cannot find a stray row — the count above was taken under a lock — so a failure
    // here is a real anomaly, and the constraint is left `not_valid` for the drift check
    // to name rather than being papered over.
    const validate = `ALTER TABLE ${plan.relation} VALIDATE CONSTRAINT ${quoteIdentifier(plan.constraintName)};`
    try {
      await pools.withConnection('ddl', (exec) => exec.query(validate, [], 'ddl'))
    } catch (error) {
      throw new BasedbError('VALIDATION_FAILED', {
        details: { field: request.fieldId, reason: 'contrainte_non_validee' },
        cause: error,
      })
    }
    sql.push(validate)
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.table_constraint SET state = 'active' WHERE id = $1`,
        [plan.constraintId],
        'update',
      ),
    )
  }

  return { options: wanted, added, removed, sql }
}
