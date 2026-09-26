import { isErrorCode } from '@basedb/contracts'
import { disableAiField, setAiField } from '../ai/field.js'
import { setFieldDescription, setTableDescription } from '../catalog/descriptions.js'
import { setFieldLabel } from '../catalog/field-label.js'
import { reorderFields } from '../catalog/field-order.js'
import { addField, setFieldRequired } from '../catalog/fields.js'
import { deleteTable } from '../catalog/lifecycle.js'
import { type OnDelete, createLinkField, setDisplayColumn } from '../catalog/links.js'
import { type FieldRequest, createTable } from '../catalog/operations.js'
import { setSelectOptions } from '../catalog/select-options.js'
import { updateTable } from '../catalog/table-edit.js'
import type { FieldKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type EnvironmentSummary, loadFamily, loadPair } from './family.js'

/**
 * Comparing the structure of two environments, and carrying one into the other —
 * chapter 14 §3.
 *
 * Objects are matched by LINEAGE, never by name: « Clients » renamed « Comptes » in
 * recette is still the table of production, and a « Clients » created independently on
 * both sides is two tables. The comparison is the difference of two catalogs; the plan is
 * the list of kernel operations that would make the target look like the source — each
 * an ordinary operation, with its own checks, its own history and its own migration when
 * it needs one. Nothing here writes a catalog row directly.
 *
 * Who changed what is read from the structure history (chapter 07 §8): for an object that
 * differs, the side whose last change is the more recent is presumed right, and a change
 * made on both sides since the last synchronization is a conflict. A step that would undo
 * a newer change of the target, or settle a conflict, is proposed but not selected: the
 * default of « Appliquer » never reverts anyone's work.
 */

// ── The structure of one environment ──────────────────────────────────────────

export interface StructureOption {
  readonly value: string
  readonly label: string
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
}

export interface StructureField {
  readonly id: string
  readonly lineage: string
  readonly name: string
  readonly label: string
  readonly kind: FieldKind
  readonly description: string | null
  readonly required: boolean
  readonly position: number
  readonly options: readonly StructureOption[] | null
  readonly link: {
    readonly targetLineage: string
    readonly targetLabel: string
    readonly onDelete: OnDelete
  } | null
  /** The prompt cites columns by LINEAGE here (`{{@…}}`), to compare across environments. */
  readonly ai: {
    readonly prompt: string
    readonly mode: 'if_empty' | 'schedule'
    readonly cron: string | null
    readonly timezone: string | null
  } | null
}

export interface StructureTable {
  readonly id: string
  readonly lineage: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly position: number
  readonly deleted: boolean
  readonly displayLineage: string | null
  readonly fields: readonly StructureField[]
}

const REFERENCE = /\{\{\s*([^{}]+?)\s*\}\}/g
const NEUTRAL = /\{\{@([0-9a-f-]{36})\}\}/g

/** A stored prompt (`{{nom}}`) with its citations by lineage (`{{@…}}`). */
function neutralPrompt(prompt: string, lineageByName: ReadonlyMap<string, string>): string {
  return prompt.replace(REFERENCE, (all, name: string) => {
    const lineage = lineageByName.get(name.trim())
    return lineage === undefined ? all : `{{@${lineage}}}`
  })
}

/** Back to the target's names; `null` when a cited column has no counterpart there. */
function localPrompt(prompt: string, nameByLineage: ReadonlyMap<string, string>): string | null {
  let missing = false
  const out = prompt.replace(NEUTRAL, (_all, lineage: string) => {
    const name = nameByLineage.get(lineage)
    if (name === undefined) missing = true
    return `{{${name ?? lineage}}}`
  })
  return missing ? null : out
}

/** The live tables and fields of a base, and its deleted tables, by lineage. */
export async function loadStructure(
  exec: Executor,
  baseId: string,
): Promise<readonly StructureTable[]> {
  const tables = await exec.query<{
    id: string
    lineage_id: string
    name: string
    label: string
    description: string | null
    color: string | null
    icon: string | null
    image: string | null
    position: number
    deleted: boolean
    display_lineage: string | null
  }>(
    `SELECT t.id, t.lineage_id, tn.name, t.label, t.description, t.color, t.icon, t.image,
            t.position, t.deleted_at IS NOT NULL AS deleted, df.lineage_id AS display_lineage
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       LEFT JOIN _basedb.field df    ON df.id = t.display_field_id
      WHERE t.base_id = $1 AND NOT t.is_purged
      ORDER BY t.position, t.label`,
    [baseId],
  )

  const fields = await exec.query<{
    id: string
    table_id: string
    lineage_id: string
    name: string
    label: string
    kind: FieldKind
    description: string | null
    is_required: boolean
    position: number
    on_delete: OnDelete | null
    target_lineage: string | null
    target_label: string | null
    prompt: string | null
    refresh_mode: 'if_empty' | 'schedule' | null
    refresh_cron: string | null
    refresh_timezone: string | null
  }>(
    `SELECT f.id, f.table_id, f.lineage_id, n.name, f.label, f.kind, f.description,
            f.is_required, f.position, lc.on_delete, tt.lineage_id AS target_lineage,
            tt.label AS target_label, ai.prompt, ai.refresh_mode, ai.refresh_cron,
            ai.refresh_timezone
       FROM _basedb.field f
       JOIN _basedb.table_def t      ON t.id = f.table_id
       JOIN _basedb.physical_name n  ON n.id = f.name_id
       LEFT JOIN _basedb.field_link_config lc ON lc.field_id = f.id
       LEFT JOIN _basedb.table_def tt         ON tt.id = lc.target_table_id
       LEFT JOIN _basedb.field_ai_config ai   ON ai.field_id = f.id
      WHERE f.base_id = $1 AND f.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY f.position, f.created_at`,
    [baseId],
  )

  const optionRows = await exec.query<
    StructureOption & { field_id: string } & Record<string, unknown>
  >(
    `SELECT o.field_id, o.value, o.label, o.color, o.icon, o.image
       FROM _basedb.select_option o
       JOIN _basedb.field f ON f.id = o.field_id
      WHERE f.base_id = $1 AND o.deleted_at IS NULL AND f.deleted_at IS NULL
      ORDER BY o.position`,
    [baseId],
  )
  const options = new Map<string, StructureOption[]>()
  for (const o of optionRows) {
    const list = options.get(o.field_id) ?? []
    list.push({ value: o.value, label: o.label, color: o.color, icon: o.icon, image: o.image })
    options.set(o.field_id, list)
  }

  return tables.map((t) => {
    const own = fields.filter((f) => f.table_id === t.id)
    const lineageByName = new Map(own.map((f) => [f.name, f.lineage_id]))
    return {
      id: t.id,
      lineage: t.lineage_id,
      name: t.name,
      label: t.label,
      description: t.description,
      color: t.color,
      icon: t.icon,
      image: t.image,
      position: t.position,
      deleted: t.deleted,
      displayLineage: t.display_lineage,
      fields: own.map((f) => ({
        id: f.id,
        lineage: f.lineage_id,
        name: f.name,
        label: f.label,
        kind: f.kind,
        description: f.description,
        required: f.is_required,
        position: f.position,
        options:
          f.kind === 'select' || f.kind === 'multi_select' ? (options.get(f.id) ?? []) : null,
        link:
          f.target_lineage === null
            ? null
            : {
                targetLineage: f.target_lineage,
                targetLabel: f.target_label ?? '',
                onDelete: f.on_delete ?? 'restrict',
              },
        ai:
          f.prompt === null || f.refresh_mode === null
            ? null
            : {
                prompt: neutralPrompt(f.prompt, lineageByName),
                mode: f.refresh_mode,
                cron: f.refresh_cron,
                timezone: f.refresh_timezone,
              },
      })),
    }
  })
}

/**
 * When each object of a base last changed, from its structure history: a table by its
 * `table_def` row, a field by its row, its configuration and its choices.
 */
async function lastChanges(exec: Executor, baseId: string): Promise<Map<string, number>> {
  const rows = await exec.query<{ key: string; at: Date }>(
    `SELECT key, max(occurred_at) AS at FROM (
       SELECT CASE WHEN object_kind = 'select_option' THEN parent_object_id ELSE object_id END
                AS key,
              occurred_at
         FROM _basedb.structure_revision
        WHERE base_id = $1
          AND object_kind IN ('table_def', 'field', 'field_config', 'select_option')
     ) r
     GROUP BY key`,
    [baseId],
  )
  return new Map(rows.map((r) => [r.key, new Date(r.at).getTime()]))
}

/** The last time one of the two was carried into the other, structure-wise. */
async function lastSync(exec: Executor, a: string, b: string): Promise<Date | null> {
  const [row] = await exec.query<{ at: Date | null }>(
    `SELECT max(synced_at) AS at FROM _basedb.environment_sync
      WHERE kind IN ('fork', 'structure')
        AND ((source_base_id = $1 AND target_base_id = $2)
          OR (source_base_id = $2 AND target_base_id = $1))`,
    [a, b],
  )
  return row?.at === null || row?.at === undefined ? null : new Date(row.at)
}

// ── Comparing every environment ───────────────────────────────────────────────

export interface ComparedTableCell {
  readonly label: string
  readonly name: string
  readonly deleted: boolean
  readonly description: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  readonly displayField: string | null
}

export interface ComparedFieldCell {
  readonly label: string
  readonly name: string
  readonly kind: FieldKind
  readonly required: boolean
  readonly description: string | null
  readonly options: readonly string[] | null
  readonly link: string | null
  readonly ai: boolean
}

export interface ComparedField {
  readonly lineage: string
  /** One cell per environment, in the order of `environments`; `null` where absent. */
  readonly cells: readonly (ComparedFieldCell | null)[]
  readonly differs: boolean
}

export interface ComparedTable {
  readonly lineage: string
  readonly cells: readonly (ComparedTableCell | null)[]
  readonly fields: readonly ComparedField[]
  /** The table itself, or one of its fields, is not the same everywhere. */
  readonly differs: boolean
}

export interface EnvironmentComparison {
  readonly environments: readonly EnvironmentSummary[]
  readonly tables: readonly ComparedTable[]
}

const tableSignature = (t: StructureTable | undefined) =>
  t === undefined
    ? 'absent'
    : JSON.stringify([
        t.deleted,
        t.label,
        t.description,
        t.color,
        t.icon,
        t.image,
        t.deleted ? null : t.displayLineage,
      ])

const fieldSignature = (f: StructureField | undefined) =>
  f === undefined
    ? 'absent'
    : JSON.stringify([
        f.label,
        f.kind,
        f.description,
        f.required,
        f.options,
        f.link?.targetLineage ?? null,
        f.link?.onDelete ?? null,
        f.ai,
      ])

/** Lineages in a stable order: the first environment's, then the others' newcomers. */
function unionOrder<T extends { readonly lineage: string }>(lists: readonly (readonly T[])[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.lineage)) continue
      seen.add(item.lineage)
      out.push(item.lineage)
    }
  }
  return out
}

/** Every environment of a base side by side, table by table and field by field. */
export async function compareEnvironments(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<EnvironmentComparison> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const family = await loadFamily(exec, ctx, request.baseId)
      for (const env of family.environments) {
        await requireOnBase(exec, ctx, 'manage_schema', env.id)
      }
      const structures = []
      for (const env of family.environments) structures.push(await loadStructure(exec, env.id))

      const tables: ComparedTable[] = []
      for (const lineage of unionOrder(structures)) {
        const byEnv = structures.map((s) => s.find((t) => t.lineage === lineage))
        const liveFields = byEnv.map((t) => (t === undefined || t.deleted ? [] : t.fields))
        const fields: ComparedField[] = unionOrder(liveFields).map((fieldLineage) => {
          const cells = liveFields.map((list) => list.find((f) => f.lineage === fieldLineage))
          return {
            lineage: fieldLineage,
            cells: cells.map((f) => (f === undefined ? null : fieldCell(f))),
            differs: new Set(cells.map(fieldSignature)).size > 1,
          }
        })
        tables.push({
          lineage,
          cells: byEnv.map((t) => (t === undefined ? null : tableCell(t))),
          fields,
          differs: new Set(byEnv.map(tableSignature)).size > 1 || fields.some((f) => f.differs),
        })
      }
      return { environments: family.environments, tables }
    },
    { readOnly: true, isolation: 'repeatable read' },
  )
}

function tableCell(t: StructureTable): ComparedTableCell {
  const display = t.fields.find((f) => f.lineage === t.displayLineage)
  return {
    label: t.label,
    name: t.name,
    deleted: t.deleted,
    description: t.description,
    color: t.color,
    icon: t.icon,
    image: t.image,
    displayField: display?.label ?? null,
  }
}

function fieldCell(f: StructureField): ComparedFieldCell {
  return {
    label: f.label,
    name: f.name,
    kind: f.kind,
    required: f.required,
    description: f.description,
    options: f.options?.map((o) => o.label) ?? null,
    link: f.link?.targetLabel ?? null,
    ai: f.ai !== null,
  }
}

// ── The plan ──────────────────────────────────────────────────────────────────

export type StepKind =
  | 'create_table'
  | 'add_field'
  | 'add_link'
  | 'update_table'
  | 'update_field'
  | 'set_options'
  | 'set_required'
  | 'set_ai'
  | 'remove_ai'
  | 'set_display'
  | 'reorder_fields'
  | 'delete_table'

/**
 * Why a step is, or is not, selected by default:
 *
 *   ready          — the source's change is the more recent: applying brings it over;
 *   target_newer   — the target changed this object after the source did: applying would
 *                    undo that change;
 *   conflict       — both changed it since they were last synchronized;
 *   needs_consent  — an AI option: the cited values would leave for the provider.
 */
export type StepStatus = 'ready' | 'target_newer' | 'conflict' | 'needs_consent'

export interface StepChange {
  readonly attribute: string
  readonly from: string | null
  readonly to: string | null
}

export interface PlanStep {
  /** Stable across two plans of the same pair: `kind:lineage`. */
  readonly id: string
  readonly kind: StepKind
  readonly table: { readonly lineage: string; readonly label: string }
  readonly field?: { readonly lineage: string; readonly label: string; readonly kind: FieldKind }
  readonly summary: string
  readonly changes: readonly StepChange[]
  readonly status: StepStatus
  readonly selected: boolean
  readonly destructive: boolean
  /** Steps this one needs applied first — skipped otherwise. */
  readonly dependsOn: readonly string[]
}

export interface PlanNote {
  readonly table: string
  readonly field?: string
  readonly message: string
}

export interface StructurePlan {
  readonly source: EnvironmentSummary
  readonly target: EnvironmentSummary
  readonly lastSync: string | null
  readonly steps: readonly PlanStep[]
  /** Differences no step can settle — said, so that nobody thinks them settled. */
  readonly notes: readonly PlanNote[]
}

/** Created with their table by `createTable`; the others are added one by one. */
const TABLE_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'url',
  'email',
  'number',
  'boolean',
  'date',
  'datetime',
])

const KIND_LABEL: Readonly<Record<string, string>> = {
  short_text: 'texte',
  long_text: 'texte long',
  url: 'lien URL',
  email: 'e-mail',
  autonumber: 'numéro automatique',
  user: 'personne',
  number: 'nombre',
  boolean: 'booléen',
  date: 'date',
  datetime: 'date et heure',
  select: 'liste de choix',
  multi_select: 'choix multiple',
  file: 'document',
  image: 'image',
  link: 'relation',
  multi_link: 'relation multiple',
  formula: 'formule',
}

/** The order steps are applied in: what a later step needs exists by then. */
const PHASE: Readonly<Record<StepKind, number>> = {
  create_table: 1,
  add_field: 2,
  add_link: 3,
  update_table: 4,
  update_field: 4,
  set_options: 4,
  set_required: 4,
  set_ai: 5,
  remove_ai: 5,
  set_display: 6,
  reorder_fields: 6,
  delete_table: 7,
}

const look = (t: { color: string | null; icon: string | null; image: string | null }) =>
  t.image !== null ? 'image' : t.icon !== null ? `pictogramme ${t.icon}` : (t.color ?? 'aucune')

const optionsText = (options: readonly StructureOption[] | null) =>
  options === null ? null : options.map((o) => o.label).join(', ')

/**
 * A step, and what running it takes. `run` resolves to a note when the step was applied
 * with a reservation, and throws `Skipped` when there was nothing it could do.
 */
interface PlannedStep extends PlanStep {
  readonly run: (state: ApplyState) => Promise<string | null>
}

/** A step that could not be applied, for a reason that is not a refusal of the kernel. */
class Skipped {
  constructor(readonly note: string) {}
}

const TABLE_GONE = 'La table n’existe pas, ou plus, dans la cible.'
const FIELD_GONE = 'Le champ n’existe pas, ou plus, dans la cible.'

interface ApplyState {
  readonly pools: Pools
  readonly ctx: RequestContext
  readonly targetBaseId: string
  readonly consent: boolean
  /** The target's tables and fields by lineage — kept current as steps create them. */
  readonly tables: Map<string, string>
  readonly fields: Map<
    string,
    { readonly id: string; readonly name: string; readonly table: string }
  >
  readonly createdTables: Set<string>
  readonly createdFields: Set<string>
}

interface Recency {
  readonly source: ReadonlyMap<string, number>
  readonly target: ReadonlyMap<string, number>
  readonly since: number | null
}

/** Who is right about an object present on both sides, by its structure history. */
function statusOf(recency: Recency, sourceId: string, targetId: string): StepStatus {
  const s = recency.source.get(sourceId) ?? 0
  const t = recency.target.get(targetId) ?? 0
  if (recency.since !== null && s > recency.since && t > recency.since) return 'conflict'
  return t > s ? 'target_newer' : 'ready'
}

function step(
  partial: Omit<PlanStep, 'selected' | 'dependsOn' | 'destructive' | 'changes'> & {
    readonly dependsOn?: readonly string[]
    readonly destructive?: boolean
    readonly changes?: readonly StepChange[]
  },
  run: PlannedStep['run'],
): PlannedStep {
  return {
    ...partial,
    changes: partial.changes ?? [],
    dependsOn: partial.dependsOn ?? [],
    destructive: partial.destructive ?? false,
    selected: partial.status === 'ready',
    run,
  }
}

/**
 * The steps that would make `target` look like `source`, and what they cannot settle.
 *
 * Pure: it reads two structures and their histories, and decides nothing against the
 * database — which is what lets a test state a plan without one.
 */
export function buildPlan(
  source: readonly StructureTable[],
  target: readonly StructureTable[],
  recency: Recency,
  names: { readonly source: string; readonly target: string },
): { readonly steps: readonly PlannedStep[]; readonly notes: readonly PlanNote[] } {
  const steps: PlannedStep[] = []
  const notes: PlanNote[] = []
  const targetByLineage = new Map(target.map((t) => [t.lineage, t]))
  const sourceByLineage = new Map(source.map((t) => [t.lineage, t]))

  // The table a relation needs in the target: there already, or created by this plan.
  const tableNeed = (lineage: string): string[] => {
    const there = targetByLineage.get(lineage)
    return there !== undefined && !there.deleted ? [] : [`create_table:${lineage}`]
  }

  for (const table of source) {
    const ref = { lineage: table.lineage, label: table.label }
    const other = targetByLineage.get(table.lineage)

    if (table.deleted) {
      if (other !== undefined && !other.deleted) {
        steps.push(
          step(
            {
              id: `delete_table:${table.lineage}`,
              kind: 'delete_table',
              table: ref,
              summary: `Supprimer la table « ${other.label} »`,
              status: statusOf(recency, table.id, other.id),
              destructive: true,
            },
            async (state) => {
              const id = state.tables.get(table.lineage)
              if (id === undefined) throw new Skipped(TABLE_GONE)
              const migration = await deleteTable(state.pools, state.ctx, { tableId: id })
              if (migration.status !== 'applied') {
                const code = migration.errorCode ?? ''
                throw new BasedbError(isErrorCode(code) ? code : 'INTERNAL_ERROR')
              }
              return null
            },
          ),
        )
      }
      continue
    }

    if (other?.deleted === true) {
      notes.push({
        table: table.label,
        message: `Supprimée dans « ${names.target} » : restaurez-la d’abord pour y reporter la structure.`,
      })
      continue
    }

    const created = other === undefined
    const createId = `create_table:${table.lineage}`
    const deps = created ? [createId] : []

    if (created) {
      const simple = table.fields.filter((f) => TABLE_KINDS.has(f.kind))
      steps.push(
        step(
          {
            id: createId,
            kind: 'create_table',
            table: ref,
            summary: `Créer la table « ${table.label} »`,
            changes: [
              {
                attribute: 'Champs',
                from: null,
                to: table.fields.map((f) => f.label).join(', ') || 'aucun',
              },
            ],
            status: 'ready',
          },
          async (state) => {
            const fields: FieldRequest[] = simple.map((f) => ({
              label: f.label,
              kind: f.kind,
              required: f.required,
              description: f.description,
              lineageId: f.lineage,
            }))
            const done = await createTable(state.pools, state.ctx, {
              baseId: state.targetBaseId,
              label: table.label,
              description: table.description,
              fields,
              lineageId: table.lineage,
            })
            state.tables.set(table.lineage, done.tableId)
            state.createdTables.add(table.lineage)
            for (const [index, f] of done.fields.entries()) {
              const lineage = simple[index]?.lineage
              if (lineage === undefined) continue
              state.fields.set(lineage, { id: f.fieldId, name: f.name, table: table.lineage })
              state.createdFields.add(lineage)
            }
            if (table.color !== null || table.icon !== null || table.image !== null) {
              await updateTable(state.pools, state.ctx, {
                tableId: done.tableId,
                look: { color: table.color, icon: table.icon, image: table.image },
              })
            }
            return null
          },
        ),
      )
    } else {
      const changes: StepChange[] = []
      if (other.label !== table.label) {
        changes.push({ attribute: 'Libellé', from: other.label, to: table.label })
      }
      if (other.description !== table.description) {
        changes.push({ attribute: 'Description', from: other.description, to: table.description })
      }
      if (look(other) !== look(table) || other.color !== table.color) {
        changes.push({ attribute: 'Apparence', from: look(other), to: look(table) })
      }
      if (changes.length > 0) {
        steps.push(
          step(
            {
              id: `update_table:${table.lineage}`,
              kind: 'update_table',
              table: ref,
              summary: `Modifier la table « ${other.label} »`,
              changes,
              status: statusOf(recency, table.id, other.id),
            },
            async (state) => {
              const id = state.tables.get(table.lineage)
              if (id === undefined) throw new Skipped(TABLE_GONE)
              if (other.label !== table.label || look(other) !== look(table)) {
                await updateTable(state.pools, state.ctx, {
                  tableId: id,
                  ...(other.label !== table.label ? { label: table.label } : {}),
                  look: { color: table.color, icon: table.icon, image: table.image },
                })
              }
              if (other.description !== table.description) {
                await setTableDescription(state.pools, state.ctx, {
                  tableId: id,
                  description: table.description,
                })
              }
              return null
            },
          ),
        )
      }
    }

    const targetFields = new Map((other?.fields ?? []).map((f) => [f.lineage, f]))
    for (const field of table.fields) {
      const fref = { lineage: field.lineage, label: field.label, kind: field.kind }
      const there = targetFields.get(field.lineage)

      if (field.kind === 'formula') {
        if (there === undefined) {
          notes.push({
            table: table.label,
            field: field.label,
            message: 'Formule : elle ne se recopie pas encore d’un environnement à l’autre.',
          })
        }
        continue
      }

      let addId: string | null = null
      if (there === undefined) {
        if (created && TABLE_KINDS.has(field.kind)) {
          // Created with its table, by the table's step.
        } else if (field.link !== null) {
          const link = field.link
          addId = `add_link:${field.lineage}`
          if (link.onDelete === 'cascade') {
            notes.push({
              table: table.label,
              field: field.label,
              message: 'Relation en cascade : à recréer à la main, avec sa confirmation.',
            })
            continue
          }
          steps.push(
            step(
              {
                id: addId,
                kind: 'add_link',
                table: ref,
                field: fref,
                summary: `Ajouter la relation « ${field.label} » vers « ${link.targetLabel} »`,
                status: 'ready',
                dependsOn: [...deps, ...tableNeed(link.targetLineage)],
              },
              async (state) => {
                const tableId = state.tables.get(table.lineage)
                const targetTableId = state.tables.get(link.targetLineage)
                if (tableId === undefined || targetTableId === undefined) {
                  throw new Skipped(TABLE_GONE)
                }
                const done = await createLinkField(state.pools, state.ctx, {
                  tableId,
                  targetTableId,
                  label: field.label,
                  required: field.required,
                  onDelete: link.onDelete,
                  description: field.description,
                  lineageId: field.lineage,
                  multiple: field.kind === 'multi_link',
                })
                state.fields.set(field.lineage, {
                  id: done.fieldId,
                  name: done.name,
                  table: table.lineage,
                })
                state.createdFields.add(field.lineage)
                return null
              },
            ),
          )
        } else {
          addId = `add_field:${field.lineage}`
          steps.push(
            step(
              {
                id: addId,
                kind: 'add_field',
                table: ref,
                field: fref,
                summary: `Ajouter le champ « ${field.label} » (${KIND_LABEL[field.kind] ?? field.kind})`,
                changes:
                  field.options === null
                    ? []
                    : [{ attribute: 'Choix', from: null, to: optionsText(field.options) }],
                status: 'ready',
                dependsOn: deps,
              },
              async (state) => {
                const tableId = state.tables.get(table.lineage)
                if (tableId === undefined) throw new Skipped(TABLE_GONE)
                const done = await addField(state.pools, state.ctx, {
                  tableId,
                  label: field.label,
                  kind: field.kind,
                  description: field.description,
                  ...(field.options === null
                    ? {}
                    : {
                        options: field.options.map((o) => ({
                          value: o.value,
                          label: o.label,
                          color: o.color,
                          icon: o.icon,
                          image: o.image,
                        })),
                      }),
                  lineageId: field.lineage,
                })
                state.fields.set(field.lineage, {
                  id: done.fieldId,
                  name: done.name,
                  table: table.lineage,
                })
                state.createdFields.add(field.lineage)
                if (!field.required) return null
                try {
                  await setFieldRequired(state.pools, state.ctx, {
                    fieldId: done.fieldId,
                    required: true,
                  })
                  return null
                } catch (error) {
                  if (!(error instanceof BasedbError)) throw error
                  return 'Ajouté, mais laissé facultatif : des lignes de la cible sont vides.'
                }
              },
            ),
          )
        }
      } else {
        const status = statusOf(recency, field.id, there.id)
        const fieldChanges: StepChange[] = []
        if (there.label !== field.label) {
          fieldChanges.push({ attribute: 'Libellé', from: there.label, to: field.label })
        }
        if (there.description !== field.description) {
          fieldChanges.push({
            attribute: 'Description',
            from: there.description,
            to: field.description,
          })
        }
        if (fieldChanges.length > 0) {
          steps.push(
            step(
              {
                id: `update_field:${field.lineage}`,
                kind: 'update_field',
                table: ref,
                field: fref,
                summary: `Modifier le champ « ${there.label} »`,
                changes: fieldChanges,
                status,
              },
              async (state) => {
                const target = state.fields.get(field.lineage)
                if (target === undefined) throw new Skipped(FIELD_GONE)
                if (there.label !== field.label) {
                  await setFieldLabel(state.pools, state.ctx, {
                    fieldId: target.id,
                    label: field.label,
                  })
                }
                if (there.description !== field.description) {
                  await setFieldDescription(state.pools, state.ctx, {
                    fieldId: target.id,
                    description: field.description,
                  })
                }
                return null
              },
            ),
          )
        }

        if (
          field.options !== null &&
          JSON.stringify(field.options) !== JSON.stringify(there.options)
        ) {
          steps.push(
            step(
              {
                id: `set_options:${field.lineage}`,
                kind: 'set_options',
                table: ref,
                field: fref,
                summary: `Mettre à jour les choix de « ${there.label} »`,
                changes: [
                  {
                    attribute: 'Choix',
                    from: optionsText(there.options),
                    to: optionsText(field.options),
                  },
                ],
                status,
              },
              async (state) => {
                const target = state.fields.get(field.lineage)
                if (target === undefined) throw new Skipped(FIELD_GONE)
                await setSelectOptions(state.pools, state.ctx, {
                  fieldId: target.id,
                  options: (field.options ?? []).map((o) => ({
                    value: o.value,
                    label: o.label,
                    color: o.color,
                    icon: o.icon,
                    image: o.image,
                  })),
                })
                return null
              },
            ),
          )
        }

        if (there.required !== field.required) {
          steps.push(
            step(
              {
                id: `set_required:${field.lineage}`,
                kind: 'set_required',
                table: ref,
                field: fref,
                summary: field.required
                  ? `Rendre « ${there.label} » obligatoire`
                  : `Rendre « ${there.label} » facultatif`,
                changes: [
                  {
                    attribute: 'Obligatoire',
                    from: there.required ? 'oui' : 'non',
                    to: field.required ? 'oui' : 'non',
                  },
                ],
                status,
              },
              async (state) => {
                const target = state.fields.get(field.lineage)
                if (target === undefined) throw new Skipped(FIELD_GONE)
                await setFieldRequired(state.pools, state.ctx, {
                  fieldId: target.id,
                  required: field.required,
                })
                return null
              },
            ),
          )
        }

        if (
          (there.link?.targetLineage ?? null) !== (field.link?.targetLineage ?? null) ||
          (there.link?.onDelete ?? null) !== (field.link?.onDelete ?? null)
        ) {
          notes.push({
            table: table.label,
            field: field.label,
            message: 'Cible ou comportement à la suppression différents : à reprendre à la main.',
          })
        }

        if (field.ai === null && there.ai !== null) {
          steps.push(
            step(
              {
                id: `remove_ai:${field.lineage}`,
                kind: 'remove_ai',
                table: ref,
                field: fref,
                summary: `Retirer l’IA de « ${there.label} »`,
                status,
              },
              async (state) => {
                const target = state.fields.get(field.lineage)
                if (target === undefined) throw new Skipped(FIELD_GONE)
                await disableAiField(state.pools, state.ctx, target.id)
                return null
              },
            ),
          )
        }
      }

      // The AI option: on a field just added, or one whose prompt or schedule differs.
      if (
        field.ai !== null &&
        (there === undefined || JSON.stringify(there.ai) !== JSON.stringify(field.ai))
      ) {
        const ai = field.ai
        const needs = there === undefined ? [...deps, ...(addId === null ? [] : [addId])] : []
        // Never selected by default: the values the prompt cites would leave for the
        // provider, and that takes an explicit yes (chapter 12 §1.5).
        const recent = there === undefined ? 'ready' : statusOf(recency, field.id, there.id)
        steps.push(
          step(
            {
              id: `set_ai:${field.lineage}`,
              kind: 'set_ai',
              table: ref,
              field: fref,
              summary:
                there?.ai === null || there === undefined
                  ? `Activer l’IA sur « ${field.label} »`
                  : `Mettre à jour l’IA de « ${field.label} »`,
              changes: [{ attribute: 'Consigne', from: null, to: ai.prompt.replace(NEUTRAL, '…') }],
              status: recent === 'ready' ? 'needs_consent' : recent,
              dependsOn: needs,
            },
            async (state) => {
              if (!state.consent) {
                throw new Skipped('Non appliquée : le consentement à l’envoi des valeurs manque.')
              }
              const target = state.fields.get(field.lineage)
              if (target === undefined) throw new Skipped(FIELD_GONE)
              const names = new Map<string, string>()
              for (const [lineage, f] of state.fields) {
                if (f.table === table.lineage) names.set(lineage, f.name)
              }
              const prompt = localPrompt(ai.prompt, names)
              if (prompt === null) {
                throw new Skipped('Une colonne citée par la consigne manque dans la cible.')
              }
              await setAiField(state.pools, state.ctx, {
                fieldId: target.id,
                input: {
                  prompt,
                  refresh: { mode: ai.mode, cron: ai.cron, timezone: ai.timezone },
                  consent: true,
                },
              })
              return null
            },
          ),
        )
      }
    }

    if (other !== undefined) {
      for (const f of other.fields) {
        if (!table.fields.some((s) => s.lineage === f.lineage)) {
          notes.push({
            table: table.label,
            field: f.label,
            message: `Seulement dans « ${names.target} ».`,
          })
        }
      }
    }

    // The display column, once the field it names exists.
    const targetDisplay = other?.displayLineage ?? null
    if (table.displayLineage !== targetDisplay && table.displayLineage !== null) {
      const displayLineage = table.displayLineage
      const displayField = table.fields.find((f) => f.lineage === displayLineage)
      const addStep = steps.find(
        (s) =>
          s.field?.lineage === displayLineage && (s.kind === 'add_field' || s.kind === 'add_link'),
      )
      steps.push(
        step(
          {
            id: `set_display:${table.lineage}`,
            kind: 'set_display',
            table: ref,
            summary: `Colonne d’affichage de « ${table.label} » : « ${displayField?.label ?? '?'} »`,
            changes: [
              {
                attribute: 'Colonne d’affichage',
                from: other?.fields.find((f) => f.lineage === targetDisplay)?.label ?? null,
                to: displayField?.label ?? null,
              },
            ],
            status: other === undefined ? 'ready' : statusOf(recency, table.id, other.id),
            dependsOn: [...deps, ...(addStep === undefined ? [] : [addStep.id])],
          },
          async (state) => {
            const tableId = state.tables.get(table.lineage)
            const target = state.fields.get(displayLineage)
            if (tableId === undefined || target === undefined) throw new Skipped(FIELD_GONE)
            await setDisplayColumn(state.pools, state.ctx, { tableId, fieldId: target.id })
            return null
          },
        ),
      )
    }

    // The order of the columns, when it would not be the source's: fields added to a
    // table land at its end — and for a table just created, its non-simple fields come
    // after the others.
    const sourceOrder = table.fields.filter((f) => f.kind !== 'formula').map((f) => f.lineage)
    const adding = new Set(
      steps
        .filter((s) => s.table.lineage === table.lineage && s.field !== undefined)
        .filter((s) => s.kind === 'add_field' || s.kind === 'add_link')
        .map((s) => s.field?.lineage),
    )
    const predicted = created
      ? [...sourceOrder.filter((l) => !adding.has(l)), ...sourceOrder.filter((l) => adding.has(l))]
      : [
          ...(other?.fields ?? []).map((f) => f.lineage).filter((l) => sourceOrder.includes(l)),
          ...sourceOrder.filter((l) => adding.has(l)),
        ]
    const desired = sourceOrder.filter((l) => predicted.includes(l))
    if (desired.join() !== predicted.join()) {
      steps.push(
        step(
          {
            id: `reorder_fields:${table.lineage}`,
            kind: 'reorder_fields',
            table: ref,
            summary: `Réordonner les champs de « ${table.label} »`,
            status: other === undefined ? 'ready' : statusOf(recency, table.id, other.id),
            dependsOn: deps,
          },
          async (state) => {
            const tableId = state.tables.get(table.lineage)
            if (tableId === undefined) throw new Skipped(TABLE_GONE)
            const names = sourceOrder
              .map((l) => state.fields.get(l))
              .filter((f) => f !== undefined && f.table === table.lineage)
              .map((f) => (f as { name: string }).name)
            if (names.length > 0) {
              await reorderFields(state.pools, state.ctx, { tableId, names })
            }
            return null
          },
        ),
      )
    }
  }

  for (const table of target) {
    if (!table.deleted && !sourceByLineage.has(table.lineage)) {
      notes.push({ table: table.label, message: `Seulement dans « ${names.target} ».` })
    }
  }

  // Applied phase by phase; within a phase, in the source's order.
  const ordered = steps
    .map((s, index) => ({ s, index }))
    .sort((a, b) => PHASE[a.s.kind] - PHASE[b.s.kind] || a.index - b.index)
    .map(({ s }) => s)
  return { steps: ordered, notes }
}

function publicStep(planned: PlannedStep): PlanStep {
  const { run, ...rest } = planned
  void run
  return rest
}

/** Loads both sides and plans — the one path `planStructure` and `applyStructure` share. */
async function plan(
  exec: Executor,
  ctx: RequestContext,
  sourceBaseId: string,
  targetBaseId: string,
) {
  const pair = await loadPair(exec, ctx, sourceBaseId, targetBaseId)
  await requireOnBase(exec, ctx, 'manage_schema', sourceBaseId)
  await requireOnBase(exec, ctx, 'manage_schema', targetBaseId)
  const source = await loadStructure(exec, sourceBaseId)
  const target = await loadStructure(exec, targetBaseId)
  const since = await lastSync(exec, sourceBaseId, targetBaseId)
  const built = buildPlan(
    source,
    target,
    {
      source: await lastChanges(exec, sourceBaseId),
      target: await lastChanges(exec, targetBaseId),
      since: since?.getTime() ?? null,
    },
    { source: pair.source.environment, target: pair.target.environment },
  )
  return { ...pair, since, target: pair.target, structure: target, built }
}

/** What applying `source` onto `target` would do, step by step. */
export async function planStructure(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly sourceBaseId: string; readonly targetBaseId: string },
): Promise<StructurePlan> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const p = await plan(exec, ctx, request.sourceBaseId, request.targetBaseId)
      return {
        source: p.source,
        target: p.target,
        lastSync: p.since?.toISOString() ?? null,
        steps: p.built.steps.map(publicStep),
        notes: p.built.notes,
      }
    },
    { readOnly: true, isolation: 'repeatable read' },
  )
}

export type StepOutcome = 'applied' | 'failed' | 'skipped'

export interface StepResult {
  readonly id: string
  readonly kind: StepKind
  readonly summary: string
  readonly outcome: StepOutcome
  /** The refusal's code, when the kernel refused the step. */
  readonly code?: string
  /** What happened beside the outcome — a field left optional, a missing consent. */
  readonly note?: string
}

export interface ApplyReport {
  readonly source: EnvironmentSummary
  readonly target: EnvironmentSummary
  readonly results: readonly StepResult[]
  readonly applied: number
  readonly failed: number
  readonly skipped: number
}

/**
 * Applies the chosen steps of a FRESH plan — the one the caller saw may be stale: a step
 * that no longer exists is reported skipped, never guessed at.
 *
 * Each step is an ordinary kernel operation, in its own transaction: a failure stops that
 * step and those that depend on it, not the others. When it is done, the grants of the
 * tables and fields it created are mirrored from the source, and the synchronization is
 * recorded — the common point the next comparison starts from.
 */
export async function applyStructure(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly sourceBaseId: string
    readonly targetBaseId: string
    /** Step ids to apply; `'all'` — every step of the plan, whatever its status. */
    readonly steps: readonly string[] | 'all'
    /** Consent to the AI options' cited values leaving for the provider (chapter 12). */
    readonly consent?: boolean
    /** Recorded as the environment's creation rather than a later synchronization. */
    readonly fork?: boolean
  },
): Promise<ApplyReport> {
  const planned = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => plan(exec, ctx, request.sourceBaseId, request.targetBaseId),
    { readOnly: true, isolation: 'repeatable read' },
  )
  const { source, target, structure, built } = planned

  const state: ApplyState = {
    pools,
    ctx,
    targetBaseId: target.id,
    consent: request.consent === true,
    tables: new Map(structure.filter((t) => !t.deleted).map((t) => [t.lineage, t.id])),
    fields: new Map(
      structure.flatMap((t) =>
        t.deleted
          ? []
          : t.fields.map((f) => [f.lineage, { id: f.id, name: f.name, table: t.lineage }] as const),
      ),
    ),
    createdTables: new Set(),
    createdFields: new Set(),
  }

  const wanted = request.steps === 'all' ? null : new Set(request.steps)
  const done = new Set<string>()
  const results: StepResult[] = []

  for (const s of built.steps) {
    if (wanted !== null && !wanted.has(s.id)) continue
    const missing = s.dependsOn.find((d) => !done.has(d))
    if (missing !== undefined) {
      results.push({
        id: s.id,
        kind: s.kind,
        summary: s.summary,
        outcome: 'skipped',
        note: 'Dépend d’une étape non appliquée.',
      })
      continue
    }
    try {
      const note = await s.run(state)
      done.add(s.id)
      results.push({
        id: s.id,
        kind: s.kind,
        summary: s.summary,
        outcome: 'applied',
        ...(note === null ? {} : { note }),
      })
    } catch (error) {
      if (error instanceof Skipped) {
        results.push({
          id: s.id,
          kind: s.kind,
          summary: s.summary,
          outcome: 'skipped',
          note: error.note,
        })
        continue
      }
      if (!(error instanceof BasedbError)) throw error
      results.push({
        id: s.id,
        kind: s.kind,
        summary: s.summary,
        outcome: 'failed',
        code: error.code,
      })
    }
  }
  if (wanted !== null) {
    for (const id of wanted) {
      if (built.steps.some((s) => s.id === id)) continue
      results.push({
        id,
        kind: (id.split(':')[0] ?? 'update_table') as StepKind,
        summary: 'Étape qui n’existe plus : la structure a changé depuis.',
        outcome: 'skipped',
      })
    }
  }

  const applied = results.filter((r) => r.outcome === 'applied').length
  const failed = results.filter((r) => r.outcome === 'failed').length
  const skipped = results.filter((r) => r.outcome === 'skipped').length

  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await mirrorGrants(exec, ctx, source.id, target.id, state)
    await exec.query(
      `INSERT INTO _basedb.environment_sync
         (lineage_id, source_base_id, target_base_id, kind, synced_by, summary)
       SELECT b.lineage_id, $1, $2, $3, $4, $5::jsonb FROM _basedb.base b WHERE b.id = $1`,
      [
        source.id,
        target.id,
        request.fork === true ? 'fork' : 'structure',
        ctx.actor.id,
        JSON.stringify({ applied, failed, skipped }),
      ],
      'insert',
    )
  })

  return { source, target, results, applied, failed, skipped }
}

/**
 * The table grants and field rules of what this apply CREATED, copied from their source
 * counterparts: a column hidden from a group in production is hidden in recette from the
 * moment it exists there. Only what was created — a grant withdrawn in the target on
 * purpose is not brought back by the next synchronization.
 */
async function mirrorGrants(
  exec: Executor,
  ctx: RequestContext,
  sourceBaseId: string,
  targetBaseId: string,
  state: ApplyState,
): Promise<void> {
  if (state.createdTables.size > 0) {
    await exec.query(
      `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
       SELECT p.role_id, 'table', tt.id, p.action, $4
         FROM _basedb.permission p
         JOIN _basedb.table_def st ON st.id = p.scope_table_id AND st.base_id = $1
         JOIN _basedb.table_def tt ON tt.base_id = $2 AND tt.lineage_id = st.lineage_id
                                  AND tt.deleted_at IS NULL
        WHERE p.scope_kind = 'table' AND st.lineage_id = ANY($3::uuid[])
       ON CONFLICT DO NOTHING`,
      [sourceBaseId, targetBaseId, [...state.createdTables], ctx.actor.id],
      'insert',
    )
  }
  if (state.createdFields.size > 0) {
    await exec.query(
      `INSERT INTO _basedb.field_permission (role_id, field_id, access)
       SELECT fp.role_id, tf.id, fp.access
         FROM _basedb.field_permission fp
         JOIN _basedb.field sf     ON sf.id = fp.field_id AND sf.base_id = $1
         JOIN _basedb.table_def st ON st.id = sf.table_id
         JOIN _basedb.table_def tt ON tt.base_id = $2 AND tt.lineage_id = st.lineage_id
         JOIN _basedb.field tf     ON tf.table_id = tt.id AND tf.lineage_id = sf.lineage_id
                                  AND tf.deleted_at IS NULL
        WHERE sf.lineage_id = ANY($3::uuid[])
       ON CONFLICT DO NOTHING`,
      [sourceBaseId, targetBaseId, [...state.createdFields]],
      'insert',
    )
  }
}
