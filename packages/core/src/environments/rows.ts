import { qualify, quoteIdentifier } from '@basedb/naming'
import type { FieldKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { type Action, type ActorGrants, decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type EnvironmentSummary, loadPair } from './family.js'

/**
 * Synchronizing the ROWS of a table from one environment to another — chapter 14 §4.
 *
 * Two environments of a base live in the same database, in two schemas: comparing a
 * table's rows is one query joining both sides on `_id`, and copying them is one
 * statement per verb — nothing leaves PostgreSQL, and nothing is streamed through the
 * process. A row keeps its `_id` from one environment to the other, which is what makes a
 * row of recette recognizably the row of production it was copied from, and what keeps a
 * relation pointing at the right row once both tables are copied.
 *
 * What is copied is what the caller may read in the source AND write in the target —
 * the field masks hold here as on every other path —, matched field by field by lineage.
 * Documents and images are not: their files are deposited for ONE field and are not the
 * target's to cite. Formulas are recomputed by the target, not copied into it.
 *
 * The writes go through the target's triggers like any other: its history records them,
 * with the person who synchronized as their author.
 */

export interface SyncColumn {
  readonly lineage: string
  readonly label: string
  readonly kind: FieldKind
}

export interface RowSample {
  readonly id: string
  /** The row's display value, when its table designates a display column. */
  readonly display: string | null
  /** For a row present on both sides: the labels of the columns that differ. */
  readonly changed: readonly string[]
}

export interface RowComparison {
  readonly source: EnvironmentSummary
  readonly target: EnvironmentSummary
  readonly table: { readonly lineage: string; readonly label: string }
  readonly columns: readonly SyncColumn[]
  /** Columns of the source that are not synchronized, and why. */
  readonly skipped: ReadonlyArray<{ readonly label: string; readonly reason: string }>
  readonly counts: {
    readonly onlySource: number
    readonly onlyTarget: number
    readonly different: number
    readonly identical: number
  }
  /** Up to twenty rows of each kind — enough to recognize them, not to page through. */
  readonly samples: {
    readonly onlySource: readonly RowSample[]
    readonly onlyTarget: readonly RowSample[]
    readonly different: readonly RowSample[]
  }
  readonly lastSync: string | null
}

export interface TableRowCounts {
  readonly lineage: string
  readonly label: string
  /** Rows per environment, in the order of the pair: source, then target. */
  readonly source: number | null
  readonly target: number | null
}

const SAMPLE = 20
/** Not copied: files belong to one field, formulas to the table that computes them. */
const NOT_COPIED: Readonly<Record<string, string>> = {
  file: 'Documents : leurs fichiers appartiennent à l’environnement qui les a reçus.',
  image: 'Images : leurs fichiers appartiennent à l’environnement qui les a reçus.',
  formula: 'Formule : calculée par l’environnement cible.',
  autonumber: 'Numéro automatique : donné par l’environnement cible.',
  lookup: 'Recherche : lue à travers une relation, sans colonne.',
  rollup: 'Cumul : lu à travers une relation, sans colonne.',
  count: 'Décompte : lu à travers une relation, sans colonne.',
}

interface Side {
  readonly tableId: string
  readonly relation: string
  readonly label: string
  readonly displayLineage: string | null
}

interface Plan {
  readonly source: Side
  readonly target: Side
  readonly table: { readonly lineage: string; readonly label: string }
  /** Source column → target column, for every column copied. */
  readonly pairs: ReadonlyArray<{
    readonly lineage: string
    readonly label: string
    readonly kind: FieldKind
    readonly from: string
    readonly to: string
  }>
  readonly skipped: ReadonlyArray<{ readonly label: string; readonly reason: string }>
  readonly display: { readonly from: string | null; readonly to: string | null }
  /** The target's relations, by constraint: what a refused reference names. */
  readonly references: ReadonlyMap<string, string>
}

async function sideOf(
  exec: Executor,
  baseId: string,
  tableLineage: string,
): Promise<(Side & { readonly fields: FieldLine[] }) | null> {
  const [table] = await exec.query<{
    id: string
    label: string
    table_name: string
    schema_name: string
    display_lineage: string | null
  }>(
    `SELECT t.id, t.label, tn.name AS table_name, sn.name AS schema_name,
            df.lineage_id AS display_lineage
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
       LEFT JOIN _basedb.field df    ON df.id = t.display_field_id
      WHERE t.base_id = $1 AND t.lineage_id = $2 AND t.deleted_at IS NULL`,
    [baseId, tableLineage],
  )
  if (table === undefined) return null
  const fields = await exec.query<FieldLine>(
    `SELECT f.id, f.lineage_id, f.label, f.kind, n.name,
            EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.deleted_at IS NULL
      ORDER BY f.position`,
    [table.id],
  )
  return {
    tableId: table.id,
    relation: qualify(table.schema_name, table.table_name),
    label: table.label,
    displayLineage: table.display_lineage,
    fields,
  }
}

interface FieldLine extends Record<string, unknown> {
  readonly id: string
  readonly lineage_id: string
  readonly label: string
  readonly kind: FieldKind
  readonly name: string
  readonly has_ai: boolean
}

/**
 * The columns a synchronization copies, and the rights it needs: `read` on the source
 * table; on the target, the verbs of the writes asked for.
 */
async function planOf(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  sourceBaseId: string,
  targetBaseId: string,
  tableLineage: string,
  targetActions: readonly Action[],
): Promise<Plan> {
  const source = await sideOf(exec, sourceBaseId, tableLineage)
  const target = await sideOf(exec, targetBaseId, tableLineage)
  if (source === null || target === null) {
    throw new BasedbError('SYNC_TABLE_MISSING', { details: { table: tableLineage } })
  }

  const sourceTarget = await loadTarget(exec, ctx, source.tableId)
  const targetTarget = await loadTarget(exec, ctx, target.tableId)
  if (sourceTarget === null || targetTarget === null) {
    throw new BasedbError('SYNC_TABLE_MISSING', { details: { table: tableLineage } })
  }
  const read = decide(ctx, grants, 'read', sourceTarget)
  if (read.verdict !== 'ALLOWED') {
    throw new BasedbError(read.verdict === 'INVISIBLE' ? 'RESOURCE_NOT_FOUND' : 'ADMIN_REQUIRED', {
      details: { table: source.label, action: 'read' },
    })
  }
  const targetRead = decide(ctx, grants, 'read', targetTarget)
  if (targetRead.verdict !== 'ALLOWED') {
    throw new BasedbError(
      targetRead.verdict === 'INVISIBLE' ? 'RESOURCE_NOT_FOUND' : 'ADMIN_REQUIRED',
      { details: { table: target.label, action: 'read' } },
    )
  }
  for (const action of targetActions) {
    const decision = decide(ctx, grants, action, targetTarget)
    if (decision.verdict !== 'ALLOWED') {
      throw new BasedbError('ADMIN_REQUIRED', { details: { table: target.label, action } })
    }
  }
  const writable = decide(ctx, grants, 'update', targetTarget).writableFields

  const targetByLineage = new Map(target.fields.map((f) => [f.lineage_id, f]))
  const pairs: Plan['pairs'][number][] = []
  const skipped: { label: string; reason: string }[] = []
  for (const field of source.fields) {
    const notCopied = NOT_COPIED[field.kind]
    if (notCopied !== undefined) {
      skipped.push({ label: field.label, reason: notCopied })
      continue
    }
    const other = targetByLineage.get(field.lineage_id)
    if (other === undefined || other.kind !== field.kind) {
      skipped.push({ label: field.label, reason: 'Absent de l’environnement cible.' })
      continue
    }
    if (!read.readableFields.has(field.id)) {
      skipped.push({ label: field.label, reason: 'Masqué pour vous dans la source.' })
      continue
    }
    // A column the AI computes in the target is written by the kernel only — this copy
    // is the kernel's, and saves the target the calls; a column hidden there is not.
    const allowed =
      writable.has(other.id) || (other.has_ai && targetRead.readableFields.has(other.id))
    if (!allowed) {
      skipped.push({ label: field.label, reason: 'Non modifiable pour vous dans la cible.' })
      continue
    }
    pairs.push({
      lineage: field.lineage_id,
      label: field.label,
      kind: field.kind,
      from: field.name,
      to: other.name,
    })
  }

  // What names a row in the samples: the display column — or, when the table designates
  // none, its first short text, which is what a person would read a row by anyway.
  const displayOf = (side: typeof source, readable: ReadonlySet<string>) =>
    (
      side.fields.find((f) => f.lineage_id === side.displayLineage && readable.has(f.id)) ??
      side.fields.find((f) => f.kind === 'short_text' && readable.has(f.id))
    )?.name ?? null
  const displayFrom = displayOf(source, read.readableFields)
  const displayTo = displayOf(target, targetRead.readableFields)

  const references = await exec.query<{ constraint_name: string; label: string }>(
    `SELECT cn.name AS constraint_name, tt.label
       FROM _basedb.field_link_config lc
       JOIN _basedb.field f             ON f.id = lc.field_id
       JOIN _basedb.table_def tt        ON tt.id = lc.target_table_id
       JOIN _basedb.table_constraint c  ON c.id = lc.fk_constraint_id
       JOIN _basedb.physical_name cn    ON cn.id = c.name_id
      WHERE f.table_id = $1 AND lc.fk_dropped_at IS NULL`,
    [target.tableId],
  )

  return {
    source,
    target,
    table: { lineage: tableLineage, label: source.label },
    pairs,
    skipped,
    display: { from: displayFrom, to: displayTo },
    references: new Map(references.map((r) => [r.constraint_name, r.label])),
  }
}

const col = (alias: string, name: string) => `${alias}.${quoteIdentifier(name)}`

/** `ROW(…)` of the copied columns on one side — `ROW()` compares equal when there are none. */
function rowOf(plan: Plan, side: 'from' | 'to', alias: string): string {
  return `ROW(${plan.pairs.map((p) => col(alias, p[side])).join(', ')})`
}

async function lastRowSync(
  exec: Executor,
  sourceBaseId: string,
  targetBaseId: string,
  tableLineage: string,
): Promise<string | null> {
  const [row] = await exec.query<{ at: Date | null }>(
    `SELECT max(synced_at) AS at FROM _basedb.environment_sync
      WHERE kind = 'rows' AND table_lineage_id = $3
        AND source_base_id = $1 AND target_base_id = $2`,
    [sourceBaseId, targetBaseId, tableLineage],
  )
  return row?.at === null || row?.at === undefined ? null : new Date(row.at).toISOString()
}

/** Compares a table's rows between two environments of a base. */
export async function compareRows(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly sourceBaseId: string
    readonly targetBaseId: string
    readonly tableLineage: string
  },
): Promise<RowComparison> {
  return withTransaction(
    pools,
    'data',
    ctx,
    async (exec) => {
      const pair = await loadPair(exec, ctx, request.sourceBaseId, request.targetBaseId)
      const grants = await loadGrants(exec, ctx)
      const plan = await planOf(
        exec,
        ctx,
        grants,
        pair.source.id,
        pair.target.id,
        request.tableLineage,
        [],
      )
      const s = rowOf(plan, 'from', 's')
      const t = rowOf(plan, 'to', 't')
      const join = `${plan.source.relation} s FULL JOIN ${plan.target.relation} t ON t."_id" = s."_id"`

      const [counts] = await exec.query<{
        only_source: number
        only_target: number
        different: number
        identical: number
      }>(
        `SELECT count(*) FILTER (WHERE t."_id" IS NULL)::int AS only_source,
                count(*) FILTER (WHERE s."_id" IS NULL)::int AS only_target,
                count(*) FILTER (WHERE s."_id" IS NOT NULL AND t."_id" IS NOT NULL
                                   AND ${s} IS DISTINCT FROM ${t})::int AS different,
                count(*) FILTER (WHERE s."_id" IS NOT NULL AND t."_id" IS NOT NULL
                                   AND ${s} IS NOT DISTINCT FROM ${t})::int AS identical
           FROM ${join}`,
      )

      const display =
        plan.display.from !== null && plan.display.to !== null
          ? `coalesce(${col('s', plan.display.from)}::text, ${col('t', plan.display.to)}::text)`
          : plan.display.from !== null
            ? `${col('s', plan.display.from)}::text`
            : plan.display.to !== null
              ? `${col('t', plan.display.to)}::text`
              : 'NULL::text'
      // Only a row present on both sides has columns that differ.
      const changed =
        plan.pairs.length === 0
          ? 'ARRAY[]::text[]'
          : `CASE WHEN s."_id" IS NULL OR t."_id" IS NULL THEN ARRAY[]::text[]
                  ELSE array_remove(ARRAY[${plan.pairs
                    .map(
                      (p, i) =>
                        `CASE WHEN ${col('s', p.from)} IS DISTINCT FROM ${col('t', p.to)} THEN $${i + 1} END`,
                    )
                    .join(', ')}]::text[], NULL) END`
      const samples = await exec.query<{
        id: string
        display: string | null
        status: 'onlySource' | 'onlyTarget' | 'different'
        changed: string[]
      }>(
        `SELECT id, display, status, changed FROM (
           SELECT coalesce(s."_id", t."_id") AS id, ${display} AS display,
                  CASE WHEN t."_id" IS NULL THEN 'onlySource'
                       WHEN s."_id" IS NULL THEN 'onlyTarget'
                       ELSE 'different' END AS status,
                  ${changed} AS changed,
                  row_number() OVER (
                    PARTITION BY (t."_id" IS NULL), (s."_id" IS NULL)
                    ORDER BY coalesce(s."_id", t."_id")) AS n
             FROM ${join}
            WHERE t."_id" IS NULL OR s."_id" IS NULL OR ${s} IS DISTINCT FROM ${t}
         ) x WHERE n <= ${SAMPLE}
         ORDER BY status, id`,
        plan.pairs.map((p) => p.label),
      )
      const pick = (status: string) =>
        samples
          .filter((r) => r.status === status)
          .map((r) => ({ id: r.id, display: r.display, changed: r.changed }))

      return {
        source: pair.source,
        target: pair.target,
        table: plan.table,
        columns: plan.pairs.map((p) => ({ lineage: p.lineage, label: p.label, kind: p.kind })),
        skipped: plan.skipped,
        counts: {
          onlySource: counts?.only_source ?? 0,
          onlyTarget: counts?.only_target ?? 0,
          different: counts?.different ?? 0,
          identical: counts?.identical ?? 0,
        },
        samples: {
          onlySource: pick('onlySource'),
          onlyTarget: pick('onlyTarget'),
          different: pick('different'),
        },
        lastSync: await lastRowSync(exec, pair.source.id, pair.target.id, request.tableLineage),
      }
    },
    { readOnly: true, isolation: 'repeatable read' },
  )
}

export interface RowSyncResult {
  readonly inserted: number
  readonly updated: number
  readonly deleted: number
}

/**
 * Copies a table's rows from the source environment to the target, in ONE transaction:
 * the rows missing from the target are inserted with their `_id`, those that differ are
 * overwritten, and — only when asked — those the source does not have are deleted.
 *
 * All or nothing: a relation naming a row the target does not have yet refuses the whole
 * copy with `SYNC_REFERENCE_MISSING` and the table to synchronize first; a value the
 * target's constraints refuse — a choice it does not offer, an empty required column —
 * with `SYNC_VALUES_REFUSED`, the structure being the thing to carry over first.
 */
export async function syncRows(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly sourceBaseId: string
    readonly targetBaseId: string
    readonly tableLineage: string
    readonly insert: boolean
    readonly update: boolean
    readonly delete: boolean
  },
): Promise<RowSyncResult> {
  const actions: Action[] = []
  if (request.insert) actions.push('create')
  if (request.update) actions.push('update')
  if (request.delete) actions.push('delete')
  if (actions.length === 0) {
    throw new BasedbError('REQUEST_INVALID', { details: { reason: 'rien_a_faire' } })
  }

  return withTransaction(pools, 'data', ctx, async (exec) => {
    const pair = await loadPair(exec, ctx, request.sourceBaseId, request.targetBaseId)
    const grants = await loadGrants(exec, ctx)
    const plan = await planOf(
      exec,
      ctx,
      grants,
      pair.source.id,
      pair.target.id,
      request.tableLineage,
      actions,
    )
    const to = plan.pairs.map((p) => quoteIdentifier(p.to))
    const from = plan.pairs.map((p) => col('s', p.from))

    let inserted = 0
    let updated = 0
    let deleted = 0
    try {
      if (request.delete) {
        const rows = await exec.query<{ _id: string }>(
          `DELETE FROM ${plan.target.relation} t
            WHERE NOT EXISTS (SELECT 1 FROM ${plan.source.relation} s WHERE s."_id" = t."_id")
           RETURNING t."_id"`,
          [],
          'delete',
        )
        deleted = rows.length
      }
      if (request.update && plan.pairs.length > 0) {
        const rows = await exec.query<{ _id: string }>(
          `UPDATE ${plan.target.relation} t
              SET (${to.join(', ')}) = ROW(${from.join(', ')})
             FROM ${plan.source.relation} s
            WHERE t."_id" = s."_id" AND ${rowOf(plan, 'from', 's')} IS DISTINCT FROM ${rowOf(plan, 'to', 't')}
           RETURNING t."_id"`,
          [],
          'update',
        )
        updated = rows.length
      }
      if (request.insert) {
        const rows = await exec.query<{ _id: string }>(
          `INSERT INTO ${plan.target.relation} ("_id", "_created_by"${to.map((c) => `, ${c}`).join('')})
           SELECT s."_id", $1::uuid${from.map((c) => `, ${c}`).join('')}
             FROM ${plan.source.relation} s
            WHERE NOT EXISTS (SELECT 1 FROM ${plan.target.relation} t WHERE t."_id" = s."_id")
           RETURNING "_id"`,
          [ctx.actor.id],
          'insert',
        )
        inserted = rows.length
      }
    } catch (error) {
      throw refusal(error, plan)
    }

    await exec.query(
      `INSERT INTO _basedb.environment_sync
         (lineage_id, source_base_id, target_base_id, kind, table_lineage_id, synced_by, summary)
       SELECT b.lineage_id, $1, $2, 'rows', $3, $4, $5::jsonb FROM _basedb.base b WHERE b.id = $1`,
      [
        pair.source.id,
        pair.target.id,
        request.tableLineage,
        ctx.actor.id,
        JSON.stringify({ inserted, updated, deleted }),
      ],
      'insert',
    )
    return { inserted, updated, deleted }
  })
}

/** A refusal of the target's constraints, named for what the person can do about it. */
function refusal(error: unknown, plan: Plan): unknown {
  if (!(error instanceof BasedbError)) return error
  const constraint = typeof error.details.constraint === 'string' ? error.details.constraint : null
  if (error.code === 'LINK_TARGET_NOT_FOUND') {
    return new BasedbError('SYNC_REFERENCE_MISSING', {
      cause: error,
      details: {
        table: plan.table.label,
        ...(constraint !== null && plan.references.has(constraint)
          ? { target: plan.references.get(constraint) }
          : {}),
      },
    })
  }
  if (
    error.code === 'VALUE_OUT_OF_CONSTRAINT' ||
    error.code === 'REQUIRED_VALUE_MISSING' ||
    error.code === 'VALUE_TOO_LONG' ||
    error.code === 'VALUE_OUT_OF_RANGE' ||
    error.code === 'DUPLICATE_VALUE'
  ) {
    return new BasedbError('SYNC_VALUES_REFUSED', {
      cause: error,
      details: {
        table: plan.table.label,
        reason: error.code,
        ...(constraint ? { constraint } : {}),
      },
    })
  }
  return error
}

/** The row count of every table of the pair — the sidebar of the synchronization screen. */
export async function countRows(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly sourceBaseId: string; readonly targetBaseId: string },
): Promise<readonly TableRowCounts[]> {
  return withTransaction(
    pools,
    'data',
    ctx,
    async (exec) => {
      const pair = await loadPair(exec, ctx, request.sourceBaseId, request.targetBaseId)
      const grants = await loadGrants(exec, ctx)
      const tables = await exec.query<{
        base_id: string
        lineage_id: string
        id: string
        label: string
        relation_schema: string
        relation_table: string
      }>(
        `SELECT t.base_id, t.lineage_id, t.id, t.label, sn.name AS relation_schema,
                tn.name AS relation_table
           FROM _basedb.table_def t
           JOIN _basedb.physical_name tn ON tn.id = t.name_id
           JOIN _basedb.db_schema s      ON s.id = t.schema_id
           JOIN _basedb.physical_name sn ON sn.id = s.name_id
          WHERE t.base_id = ANY($1::uuid[]) AND t.deleted_at IS NULL
          ORDER BY t.position, t.label`,
        [[pair.source.id, pair.target.id]],
      )
      const out = new Map<string, { label: string; source: number | null; target: number | null }>()
      for (const table of tables) {
        const target = await loadTarget(exec, ctx, table.id)
        if (target === null || decide(ctx, grants, 'read', target).verdict !== 'ALLOWED') continue
        const [count] = await exec.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${qualify(table.relation_schema, table.relation_table)}`,
        )
        const entry = out.get(table.lineage_id) ?? {
          label: table.label,
          source: null,
          target: null,
        }
        if (table.base_id === pair.source.id) {
          entry.source = count?.n ?? 0
          entry.label = table.label
        } else {
          entry.target = count?.n ?? 0
        }
        out.set(table.lineage_id, entry)
      }
      return [...out.entries()].map(([lineage, e]) => ({ lineage, ...e }))
    },
    { readOnly: true, isolation: 'repeatable read' },
  )
}
