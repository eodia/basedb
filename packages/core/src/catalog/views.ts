import { BasedbError } from '../errors/index.js'
import { type ActorGrants, decide } from '../rbac/decide.js'
import { loadTarget } from '../rbac/loader.js'
import { requireOnTable } from '../rbac/require.js'
import { BUDGETS, OPERATORS } from '../records/filter.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { normalizeDescription } from './description.js'
import { labelKey } from './operations.js'

/**
 * Saved views — `_basedb.view_def`, chapter 02 and chapter 11 §1.4.
 *
 * A view is a PRESENTATION of one table: how its rows are shown — a grid, a kanban, a
 * calendar, a timeline — or how a row is asked for — a form, a survey. It holds no data
 * and no right of its own (chapter 05 §9): reading a view is reading its table, and
 * building one is `manage_schema`, like building the table. Views are shared at the scale
 * of the table; there is no personal view.
 *
 * `spec` is the whole configuration, and its shape depends on `kind`. It names fields by
 * their physical name, like the filter it carries. Two moments treat it differently:
 *
 *   à l'écriture, il est VALIDÉ — clés connues, types des valeurs, champs vivants et lisibles
 *   par l'auteur, et le type des champs pivots (un kanban se range sur une liste de choix,
 *   un calendrier sur une date) ;
 *   à la lecture, il est REPROJETÉ pour le lecteur — un champ qu'il ne voit pas en disparaît,
 *   comme de la grille, et un filtre qui en cite un rend la vue inaffichable plutôt que
 *   silencieusement plus large.
 */

export const VIEW_KINDS = ['grid', 'kanban', 'calendar', 'timeline', 'form', 'survey'] as const

export type ViewKind = (typeof VIEW_KINDS)[number]

/** A view as the API returns it — its spec already cut down to what the reader sees. */
export interface SavedView {
  readonly id: string
  readonly label: string
  readonly kind: ViewKind
  readonly description: string | null
  readonly position: number
  readonly spec: Readonly<Record<string, unknown>>
  /**
   * The filter cites a field this reader cannot see — or one that no longer exists, which
   * reads the same. The view is not shown rather than shown unfiltered: an ignored filter
   * widens the result, which is worse than a refusal (chapter 06 §4).
   */
  readonly filterHidden: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

const MAX_LABEL_CHARS = 255
/** A spec is a configuration, not a document: 64 KiB is far more than any view needs. */
const MAX_SPEC_BYTES = 64 * 1024
const MAX_SORTS = 3
const MIN_WIDTH = 64
const MAX_WIDTH = 640
const MAX_PAGE = 500
/** A list of choices holds 200 at most (chapter 04 §3): so does the order of its columns. */
const MAX_OPTIONS = 200

const DATES = ['date', 'datetime'] as const
/** A form writes rows: a computed column has nothing to be typed into. */
const NOT_ASKABLE = ['formula']

/** The live fields of a table the reader sees: physical name → kind. */
type Readable = ReadonlyMap<string, string>

function refuse(reason: string, detail?: string): never {
  throw new BasedbError('REQUEST_INVALID', {
    details: { field: 'spec', reason, ...(detail === undefined ? {} : { detail }) },
  })
}

/**
 * Reads a raw spec key by key, and refuses whatever is left over: a key nobody reads is a
 * typo someone will spend an afternoon looking for.
 */
class SpecReader {
  private readonly seen = new Set<string>()

  constructor(
    private readonly raw: Readonly<Record<string, unknown>>,
    private readonly fields: Readable,
  ) {}

  private take(key: string): unknown {
    this.seen.add(key)
    return this.raw[key]
  }

  text(key: string, max: number): string {
    const value = this.take(key)
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string' || value.includes('\u0000')) refuse('valeur_invalide', key)
    const text = value.replace(/\r\n?/g, '\n').normalize('NFC').trim()
    if ([...text].length > max) refuse('texte_trop_long', key)
    return text
  }

  flag(key: string, fallback: boolean): boolean {
    const value = this.take(key)
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'boolean') refuse('valeur_invalide', key)
    return value
  }

  choice<T extends string>(key: string, values: readonly T[], fallback: T): T {
    const value = this.take(key)
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
      refuse('valeur_invalide', key)
    }
    return value as T
  }

  integer(key: string, min: number, max: number, fallback: number): number {
    const value = this.take(key)
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      refuse('valeur_invalide', key)
    }
    return value
  }

  /** A field of the table, of one of `kinds` when given. */
  field(key: string, kinds: readonly string[] | null, required: boolean): string | null {
    const value = this.take(key)
    if (value === undefined || value === null || value === '') {
      if (required) refuse('champ_pivot_manquant', key)
      return null
    }
    if (typeof value !== 'string') refuse('valeur_invalide', key)
    return this.check(value, kinds)
  }

  fieldList(key: string, kinds: readonly string[] | null = null): string[] {
    const value = this.take(key)
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) refuse('valeur_invalide', key)
    const names = value.map((name) => {
      if (typeof name !== 'string') refuse('valeur_invalide', key)
      return this.check(name, kinds)
    })
    const repeated = names.find((n, i) => names.indexOf(n) !== i)
    if (repeated !== undefined) refuse('doublon', repeated)
    return names
  }

  /**
   * An order of VALUES — the choices of a list, not fields. Not checked against the list:
   * a choice removed since is simply skipped when drawn, and one added since goes last.
   */
  valueList(key: string, max: number): string[] {
    const value = this.take(key)
    if (value === undefined || value === null) return []
    if (!Array.isArray(value) || value.length > max) refuse('valeur_invalide', key)
    const values = value.map((v) => {
      if (typeof v !== 'string' || v.length > MAX_LABEL_CHARS) refuse('valeur_invalide', key)
      return v
    })
    const repeated = values.find((v, i) => values.indexOf(v) !== i)
    if (repeated !== undefined) refuse('doublon', repeated)
    return values
  }

  private check(name: string, kinds: readonly string[] | null): string {
    const kind = this.fields.get(name)
    if (kind === undefined) refuse('champ_inconnu', name)
    if (kinds !== null && !kinds.includes(kind)) refuse('type_de_champ_incompatible', name)
    return name
  }

  filter(): string {
    const value = this.take('filter')
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string' || value.includes('\u0000')) refuse('valeur_invalide', 'filter')
    const text = value.trim()
    if (Buffer.byteLength(text, 'utf8') > BUDGETS.bytes) refuse('texte_trop_long', 'filter')
    return text
  }

  sorts(): Array<{ field: string; direction: 'asc' | 'desc' }> {
    const value = this.take('sorts')
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) refuse('valeur_invalide', 'sorts')
    if (value.length > MAX_SORTS) refuse('trop_de_tris')
    const terms = value.map((term) => {
      if (typeof term !== 'object' || term === null) refuse('valeur_invalide', 'sorts')
      const { field, direction } = term as { field?: unknown; direction?: unknown }
      if (typeof field !== 'string') refuse('valeur_invalide', 'sorts')
      if (direction !== 'asc' && direction !== 'desc') refuse('valeur_invalide', 'sorts')
      return { field: this.check(field, null), direction: direction as 'asc' | 'desc' }
    })
    const repeated = terms.find((t, i) => terms.findIndex((u) => u.field === t.field) !== i)
    if (repeated !== undefined) refuse('doublon', repeated.field)
    return terms
  }

  widths(): Record<string, number> {
    const value = this.take('column_widths')
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object' || Array.isArray(value))
      refuse('valeur_invalide', 'column_widths')
    const out: Record<string, number> = {}
    for (const [name, width] of Object.entries(value as Record<string, unknown>)) {
      this.check(name, null)
      if (typeof width !== 'number' || !Number.isFinite(width)) {
        refuse('valeur_invalide', 'column_widths')
      }
      out[name] = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
    }
    return out
  }

  /** The questions of a form: which fields, in which order, and how each is asked. */
  questions(): Array<{ field: string; required: boolean; label: string; help: string }> {
    const value = this.take('fields')
    if (!Array.isArray(value)) refuse('valeur_invalide', 'fields')
    if (value.length === 0) refuse('formulaire_vide')
    const questions = value.map((entry) => {
      if (typeof entry !== 'object' || entry === null) refuse('valeur_invalide', 'fields')
      const item = new SpecReader(entry as Record<string, unknown>, this.fields)
      const field = item.field('field', null, true) as string
      if (NOT_ASKABLE.includes(this.fields.get(field) ?? '')) {
        refuse('type_de_champ_incompatible', field)
      }
      const question = {
        field,
        required: item.flag('required', false),
        label: item.text('label', MAX_LABEL_CHARS),
        help: item.text('help', 1000),
      }
      item.finish()
      return question
    })
    const repeated = questions.find((q, i) => questions.findIndex((r) => r.field === q.field) !== i)
    if (repeated !== undefined) refuse('doublon', repeated.field)
    return questions
  }

  finish(): void {
    const unknown = Object.keys(this.raw).find((key) => !this.seen.has(key))
    if (unknown !== undefined) refuse('cle_inconnue', unknown)
  }
}

const DATA_KEYS = ['filter', 'sorts']
const CARD_KEYS = ['title_field', 'card_fields', 'color_field']
const FORM_KEYS = [
  'title',
  'description',
  'fields',
  'submit_label',
  'success_message',
  'allow_another',
]

/** The keys a spec may carry, per kind. */
const SPEC_KEYS: Readonly<Record<ViewKind, readonly string[]>> = {
  grid: [...DATA_KEYS, 'hidden', 'pinned', 'column_order', 'column_widths', 'page_size'],
  kanban: [
    ...DATA_KEYS,
    'group_by',
    'group_order',
    'title_field',
    'card_fields',
    'cover_field',
    'hide_empty',
  ],
  calendar: [...DATA_KEYS, ...CARD_KEYS, 'date_field', 'end_field', 'mode'],
  timeline: [...DATA_KEYS, ...CARD_KEYS, 'start_field', 'end_field', 'group_by', 'scale'],
  form: FORM_KEYS,
  survey: FORM_KEYS,
}

/**
 * Turns what a caller sent into the spec the catalog stores, for one kind of view.
 *
 * Exported for the unit tests: the rules are the kernel's, and a test that goes through
 * HTTP to check that a kanban refuses a date field would test the network, not the rule.
 */
export function normalizeViewSpec(
  kind: ViewKind,
  raw: unknown,
  fields: Readable,
): Record<string, unknown> {
  const source = raw === undefined || raw === null ? {} : raw
  if (typeof source !== 'object' || Array.isArray(source)) refuse('spec_invalide')
  if (Buffer.byteLength(JSON.stringify(source), 'utf8') > MAX_SPEC_BYTES) {
    refuse('spec_trop_volumineux')
  }
  // The keys first: `date` for `date_field` is a typo, and the refusal must say THAT rather
  // than the missing pivot it leads to.
  const unknown = Object.keys(source).find((key) => !SPEC_KEYS[kind].includes(key))
  if (unknown !== undefined) refuse('cle_inconnue', unknown)
  const read = new SpecReader(source as Record<string, unknown>, fields)

  const spec = ((): Record<string, unknown> => {
    switch (kind) {
      case 'grid':
        return {
          filter: read.filter(),
          sorts: read.sorts(),
          hidden: read.fieldList('hidden'),
          pinned: read.fieldList('pinned'),
          column_order: read.fieldList('column_order'),
          column_widths: read.widths(),
          page_size: read.integer('page_size', 1, MAX_PAGE, 100),
        }
      case 'kanban':
        return {
          filter: read.filter(),
          sorts: read.sorts(),
          group_by: read.field('group_by', ['select'], true),
          // The order of the columns: the view's, not the list's — reordering a board
          // must not reorder the choices everywhere else they are offered.
          group_order: read.valueList('group_order', MAX_OPTIONS),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          cover_field: read.field('cover_field', ['file', 'image'], false),
          hide_empty: read.flag('hide_empty', false),
        }
      case 'calendar': {
        const spec = {
          filter: read.filter(),
          sorts: read.sorts(),
          date_field: read.field('date_field', DATES, true),
          end_field: read.field('end_field', DATES, false),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          color_field: read.field('color_field', ['select'], false),
          mode: read.choice('mode', ['month', 'week'] as const, 'month'),
        }
        if (spec.end_field !== null && spec.end_field === spec.date_field) {
          refuse('doublon', spec.end_field)
        }
        return spec
      }
      case 'timeline': {
        const spec = {
          filter: read.filter(),
          sorts: read.sorts(),
          start_field: read.field('start_field', DATES, true),
          end_field: read.field('end_field', DATES, false),
          group_by: read.field('group_by', ['select', 'link'], false),
          title_field: read.field('title_field', null, false),
          card_fields: read.fieldList('card_fields'),
          color_field: read.field('color_field', ['select'], false),
          scale: read.choice('scale', ['day', 'week', 'month'] as const, 'week'),
        }
        if (spec.end_field !== null && spec.end_field === spec.start_field) {
          refuse('doublon', spec.end_field)
        }
        return spec
      }
      case 'form':
      case 'survey':
        return {
          title: read.text('title', MAX_LABEL_CHARS),
          description: read.text('description', 4000),
          fields: read.questions(),
          submit_label: read.text('submit_label', 60),
          success_message: read.text('success_message', 2000),
          allow_another: read.flag('allow_another', true),
        }
    }
  })()
  read.finish()
  return spec
}

/** The keys of a spec that name ONE field, per kind. */
const SINGLE_FIELD_KEYS = [
  'group_by',
  'title_field',
  'cover_field',
  'date_field',
  'end_field',
  'start_field',
  'color_field',
]
const FIELD_LIST_KEYS = ['hidden', 'pinned', 'column_order', 'card_fields']

/** Operators, lower case: what follows a field name in a predicate. */
const OPERATOR_WORDS = new Set<string>(OPERATORS)

/**
 * The fields a filter cites — the first segment of every path that stands before an
 * operator. Quoted values are blanked first, so a value that happens to read like a field
 * name is not taken for one.
 */
export function citedFields(filter: string): string[] {
  const unquoted = filter.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
  const cited: string[] = []
  // The operator is looked AHEAD, not consumed: in `not debut is_null`, `not` must not
  // swallow the field that follows it.
  const predicate = /\b([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z_][A-Za-z0-9_]*)?(?=\s+([A-Za-z_]+))/g
  for (const match of unquoted.matchAll(predicate)) {
    const [, name, operator] = match
    if (
      name !== undefined &&
      operator !== undefined &&
      OPERATOR_WORDS.has(operator.toLowerCase())
    ) {
      cited.push(name)
    }
  }
  return cited
}

/**
 * The spec as ONE reader may see it (chapter 11 §7): what names a field they do not see —
 * or a field deleted since, which must read the same — disappears. A pivot that vanishes
 * becomes `null`, which the screen says; a filter that cites one hides the view.
 */
export function projectViewSpec(
  spec: Readonly<Record<string, unknown>>,
  readable: Readable,
): { readonly spec: Record<string, unknown>; readonly filterHidden: boolean } {
  const sees = (name: unknown): name is string => typeof name === 'string' && readable.has(name)
  const out: Record<string, unknown> = { ...spec }
  for (const key of SINGLE_FIELD_KEYS) {
    if (key in out && !sees(out[key])) out[key] = null
  }
  for (const key of FIELD_LIST_KEYS) {
    if (Array.isArray(out[key])) out[key] = (out[key] as unknown[]).filter(sees)
  }
  if (Array.isArray(out.sorts)) {
    out.sorts = (out.sorts as Array<{ field?: unknown }>).filter((t) => sees(t.field))
  }
  if (typeof out.column_widths === 'object' && out.column_widths !== null) {
    out.column_widths = Object.fromEntries(
      Object.entries(out.column_widths as Record<string, unknown>).filter(([name]) => sees(name)),
    )
  }
  if (Array.isArray(out.fields)) {
    out.fields = (out.fields as Array<{ field?: unknown }>).filter((q) => sees(q.field))
  }
  let filterHidden = false
  if (typeof out.filter === 'string' && out.filter !== '') {
    filterHidden = citedFields(out.filter).some((name) => !readable.has(name))
    if (filterHidden) out.filter = ''
  }
  return { spec: out, filterHidden }
}

/** The fields of a table the actor reads, by physical name. */
async function readableFields(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  tableId: string,
): Promise<Map<string, string>> {
  const target = await loadTarget(exec, ctx, tableId)
  if (target === null) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  const decision = decide(ctx, grants, 'read', target)
  const rows = await exec.query<{ id: string; name: string; kind: string }>(
    `SELECT f.id::text, n.name, f.kind
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL
        AND f.definition_state = 'active'`,
    [tableId],
  )
  return new Map(
    rows.filter((r) => decision.readableFields.has(r.id)).map((r) => [r.name, r.kind] as const),
  )
}

interface ViewRow extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly kind: ViewKind
  readonly description: string | null
  readonly position: number
  readonly spec: Record<string, unknown>
  readonly created_at: string
  readonly updated_at: string
}

const VIEW_COLUMNS = `id::text, label, kind, description, position, spec,
  created_at::text, updated_at::text`

function toView(row: ViewRow, readable: Readable): SavedView {
  const projected = projectViewSpec(row.spec ?? {}, readable)
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    description: row.description,
    position: row.position,
    spec: projected.spec,
    filterHidden: projected.filterHidden,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** A label as the catalog keeps it — trimmed, bounded, never empty. */
function normalizeLabel(value: unknown, tableId: string): string {
  if (typeof value !== 'string')
    throw new BasedbError('LABEL_EMPTY', { details: { table: tableId } })
  const label = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (label === '') throw new BasedbError('LABEL_EMPTY', { details: { table: tableId } })
  if ([...label].length > MAX_LABEL_CHARS) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: MAX_LABEL_CHARS } })
  }
  return label
}

/** `name` — a slug of the label, for scripts and URLs; not unique, never a key. */
function slugOf(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63)
    .replace(/_+$/, '')
  return slug === '' ? 'vue' : slug
}

function asKind(value: unknown): ViewKind {
  if (typeof value !== 'string' || !(VIEW_KINDS as readonly string[]).includes(value)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'kind' } })
  }
  return value as ViewKind
}

async function assertLabelFree(
  exec: Executor,
  tableId: string,
  label: string,
  except: string | null,
): Promise<void> {
  const clash = await exec.query<{ id: string }>(
    `SELECT id FROM _basedb.view_def
      WHERE table_id = $1 AND label_key = $2 AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [tableId, labelKey(label), except],
  )
  if (clash.length > 0) throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
}

/** The views of a table, in the order of its selector. `read` on the table. */
export async function listViews(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string },
): Promise<SavedView[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await requireOnTable(exec, ctx, 'read', request.tableId)
      const readable = await readableFields(exec, ctx, grants, request.tableId)
      const rows = await exec.query<ViewRow>(
        `SELECT ${VIEW_COLUMNS} FROM _basedb.view_def
          WHERE table_id = $1 AND deleted_at IS NULL
          ORDER BY position, created_at`,
        [request.tableId],
      )
      return rows.map((row) => toView(row, readable))
    },
    { readOnly: true },
  )
}

/** Creates a view, placed last. Building is `manage_schema` (chapter 05 §9). */
export async function createView(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly label: unknown
    readonly kind: unknown
    readonly description?: unknown
    readonly spec?: unknown
  },
): Promise<SavedView> {
  const label = normalizeLabel(request.label, request.tableId)
  const kind = asKind(request.kind)
  const description = normalizeDescription(request.description)

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const grants = await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const readable = await readableFields(exec, ctx, grants, request.tableId)
    const spec = normalizeViewSpec(kind, request.spec, readable)
    await assertLabelFree(exec, request.tableId, label, null)
    const [row] = await exec.query<ViewRow>(
      `INSERT INTO _basedb.view_def
         (table_id, label, label_key, name, description, kind, spec, position,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb,
               (SELECT coalesce(max(position), 0) + 1 FROM _basedb.view_def
                 WHERE table_id = $1 AND deleted_at IS NULL),
               $8, $8)
       RETURNING ${VIEW_COLUMNS}`,
      [
        request.tableId,
        label,
        labelKey(label),
        slugOf(label),
        description,
        kind,
        JSON.stringify(spec),
        ctx.actor.id,
      ],
      'insert',
    )
    return toView(row as ViewRow, readable)
  })
}

/**
 * Changes a view's label, description and/or spec. The spec is replaced WHOLE, like a
 * list of choices: a partial merge would leave a kanban whose pivot changed carrying the
 * card fields chosen for the old one. The kind never changes — a calendar made into a form
 * is another view.
 */
export async function updateView(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly viewId: string
    readonly label?: unknown
    readonly description?: unknown
    readonly spec?: unknown
  },
): Promise<SavedView> {
  const label =
    request.label === undefined ? undefined : normalizeLabel(request.label, request.tableId)
  const setsDescription = request.description !== undefined
  const description = setsDescription ? normalizeDescription(request.description) : null
  if (label === undefined && !setsDescription && request.spec === undefined) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'body' } })
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const grants = await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const [current] = await exec.query<{ kind: ViewKind }>(
      `SELECT kind FROM _basedb.view_def
        WHERE id::text = $1 AND table_id = $2 AND deleted_at IS NULL`,
      [request.viewId, request.tableId],
    )
    if (current === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: request.viewId } })
    }
    const readable = await readableFields(exec, ctx, grants, request.tableId)
    const spec =
      request.spec === undefined ? null : normalizeViewSpec(current.kind, request.spec, readable)
    if (label !== undefined) await assertLabelFree(exec, request.tableId, label, request.viewId)

    const [row] = await exec.query<ViewRow>(
      `UPDATE _basedb.view_def
          SET label = coalesce($2, label),
              label_key = coalesce($3, label_key),
              name = coalesce($4, name),
              description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
              spec = coalesce($7::jsonb, spec),
              updated_at = clock_timestamp(), updated_by = $8
        WHERE id = $1::uuid
        RETURNING ${VIEW_COLUMNS}`,
      [
        request.viewId,
        label ?? null,
        label === undefined ? null : labelKey(label),
        label === undefined ? null : slugOf(label),
        setsDescription,
        description,
        spec === null ? null : JSON.stringify(spec),
        ctx.actor.id,
      ],
      'update',
    )
    return toView(row as ViewRow, readable)
  })
}

/** Deletes a view — logically, like every catalog object. The rows are not touched. */
export async function deleteView(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly viewId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const rows = await exec.query<{ id: string }>(
      `UPDATE _basedb.view_def
          SET deleted_at = clock_timestamp(), deleted_by = $3
        WHERE id::text = $1 AND table_id = $2 AND deleted_at IS NULL
        RETURNING id::text`,
      [request.viewId, request.tableId, ctx.actor.id],
      'update',
    )
    if (rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: request.viewId } })
    }
  })
}

/**
 * Sets the order of a table's views, as the list of their identifiers. Views the list does
 * not name — created meanwhile by someone else — keep their relative order after the
 * others, as fields do (chapter 04 §1.1): a stale screen cannot lose a view.
 */
export async function reorderViews(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly ids: readonly string[] },
): Promise<{ readonly order: readonly string[] }> {
  const ids = request.ids
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'views' } })
  }
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i)
  if (repeated !== undefined) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'views', reason: 'doublon', detail: repeated },
    })
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const views = await exec.query<{ id: string; position: number }>(
      `SELECT id::text, position FROM _basedb.view_def
        WHERE table_id = $1 AND deleted_at IS NULL
        ORDER BY position, created_at`,
      [request.tableId],
    )
    const known = new Map(views.map((v) => [v.id, v]))
    const unknown = ids.find((id) => !known.has(id))
    if (unknown !== undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: unknown } })
    }
    const named = new Set(ids)
    const order = [...ids, ...views.filter((v) => !named.has(v.id)).map((v) => v.id)]
    for (const [index, id] of order.entries()) {
      if (known.get(id)?.position === index + 1) continue
      await exec.query(
        `UPDATE _basedb.view_def
            SET position = $2, updated_at = clock_timestamp(), updated_by = $3
          WHERE id = $1::uuid`,
        [id, index + 1, ctx.actor.id],
        'update',
      )
    }
    return { order }
  })
}
