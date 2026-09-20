import { randomUUID } from 'node:crypto'
import {
  MAX_RELEGATED_BASE_SLUG_BYTES,
  parseSchemaName,
  qualify,
  quoteIdentifier,
  relegatedName,
  relegationDate,
} from '@basedb/naming'
import { quoteLiteral } from '../ddl/emit.js'
import { type MigrationStep, runMigration } from '../ddl/migration.js'
import type { Migration } from '../ddl/migration.js'
import { BasedbError } from '../errors/index.js'
import { SCOPE_INSTANCE } from '../naming/allocation.js'
import { type ActorGrants, TENANT_SCOPE } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { normalizeDescription } from './description.js'
import { labelKey } from './operations.js'

/**
 * Lifecycle of a base — chapter 06.
 *
 * Two registers, and everything here follows from keeping them apart (§1.1):
 *
 *   le LIBELLÉ vit au catalogue seul, se modifie par un `UPDATE`, n'est pas une
 *   migration, ne prend aucun verrou sur une table de données, et est LIBÉRÉ à la
 *   suppression ;
 *
 *   le NOM PHYSIQUE vit dans `_basedb.physical_name` ET dans PostgreSQL, se modifie par
 *   `ALTER … RENAME`, est une migration, et n'est JAMAIS libéré — ni à la suppression,
 *   ni après la purge. Recréer une table « Clients » donne `clients_2`.
 *
 * So `renameBaseLabel` is three lines and `deleteBase` is a multi-step plan. That
 * asymmetry is the chapter's, not an accident of implementation.
 */

/** Chapter 06 §4.3: "par lots de dix tables (`MIGRATION_TOO_LARGE` au-delà)". */
export const TABLE_BATCH = 10

/** Same reasoning for the alias views a base may carry. */
const VIEW_BATCH = 10

export interface BaseSummary {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly deletedAt: string | null
  readonly tableCount: number
}

// ── Le libellé ────────────────────────────────────────────────────────────────

/**
 * Renames a base's LABEL, and nothing else.
 *
 * "C'est délibérément banal : c'est l'opération la plus fréquente, elle ne prend aucun
 * verrou sur une table de données, et elle n'est pas une migration" (§1.1). No DDL is
 * emitted, the schema keeps its physical name, and every consumer reading it in psql is
 * unaffected — which is exactly the point of having two registers.
 */
export async function renameBaseLabel(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly label: string },
): Promise<{ readonly label: string }> {
  const { label } = await updateBase(pools, ctx, request)
  return { label }
}

/**
 * Changes what a base is CALLED and/or what it is FOR, in one catalog write.
 *
 * Each field is optional and `undefined` means "leave as is" — which is why a description
 * is cleared with `null` or an empty string, never by omitting it. Both belong to the
 * catalog register of §1.1: no DDL, no migration, no lock on a data table.
 *
 * `catalog_version` moves here, by hand: unlike a table or a field, `base` has no trigger
 * for it, and the projection reads both columns. Without the bump, a reader served from
 * cache would keep seeing the old label and description until the snapshot aged out.
 */
export async function updateBase(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly baseId: string
    readonly label?: string
    readonly description?: string | null
  },
): Promise<{ readonly label: string; readonly description: string | null }> {
  const label = request.label?.trim()
  if (label !== undefined) {
    if (label === '') throw new BasedbError('LABEL_EMPTY', { details: { base: request.baseId } })
    if ([...label].length > 255) {
      throw new BasedbError('LABEL_TOO_LONG', { details: { maximum: 255 } })
    }
  }
  const setsDescription = request.description !== undefined
  const description = setsDescription ? normalizeDescription(request.description) : null

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const grants = await loadGrants(exec, ctx)
    await assertManageSchema(exec, ctx, grants, request.baseId)

    if (label !== undefined) {
      // The uniqueness index is partial on `deleted_at IS NULL`: a label freed by a
      // deletion is available again, immediately (§4.4). Caught here to name the conflict
      // rather than surface a constraint violation.
      const clash = await exec.query<{ id: string }>(
        `SELECT b.id FROM _basedb.base b
           JOIN _basedb.tenant t ON t.id = b.tenant_id
          WHERE t.ref = $1 AND b.label_key = $2 AND b.deleted_at IS NULL AND b.id <> $3`,
        [ctx.tenantId, labelKey(label), request.baseId],
      )
      if (clash.length > 0) {
        throw new BasedbError('LABEL_DUPLICATE', { details: { label } })
      }
    }

    const updated = await exec.query<{ label: string; description: string | null }>(
      `UPDATE _basedb.base
          SET label = CASE WHEN $2::boolean THEN $3::text ELSE label END,
              label_key = CASE WHEN $2::boolean THEN $4::text ELSE label_key END,
              description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
              catalog_version = catalog_version + 1,
              updated_at = clock_timestamp(), updated_by = $7
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING label, description`,
      [
        request.baseId,
        label !== undefined,
        label ?? null,
        label === undefined ? null : labelKey(label),
        setsDescription,
        description,
        ctx.actor.id,
      ],
      'update',
    )
    const row = updated[0]
    if (row === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: request.baseId } })
    }

    // Same signal the version triggers send for a table or a field, so other processes
    // reload instead of waiting for their snapshot to expire.
    await exec.query("SELECT pg_notify('basedb_catalog', $1::text)", [request.baseId])
    return { label: row.label, description: row.description }
  })
}

// ── La suppression logique d'une table ────────────────────────────────────────

/**
 * Deletes ONE table, logically — chapter 06 §4.2.
 *
 * Four things the chapter insists on, and each of them is a line below:
 *
 *   — **la cascade logique sur les champs est obligatoire, et la base l'impose.**
 *     `ck_field_table_live` forbids a live field under a dead table, so every field gets
 *     its `deleted_at` in the same step. Their COLUMNS are not renamed and their registry
 *     rows stay `active`: the table already carries the marker, and renaming N columns
 *     would stretch a step that must stay short;
 *   — **les contraintes et index ne sont pas renommés.** They stay `pk_clients`,
 *     `ix_clients__…`; the registry guarantees a recreated table is `clients_2`, so
 *     nothing collides;
 *   — **les index de la table reléguée sont conservés.** It takes no more writes, so they
 *     cost nothing, and their presence makes a restoration exact and free;
 *   — **la liste des relations à verrouiller inclut les tables cibles.** `ALTER TABLE …
 *     DROP CONSTRAINT` on a foreign key takes `ACCESS EXCLUSIVE` on the referenced table
 *     too. Deleting a table bearing three links therefore freezes four tables briefly,
 *     and the confirmation screen names them.
 *
 * A table still aimed at by a LIVE link from elsewhere is refused with `TABLE_REFERENCED`
 * rather than dragged down with its neighbours: `ck_link_target_live` would refuse it
 * anyway, and a named refusal naming the culprit is worth more than a constraint
 * violation.
 */
export async function deleteTable(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string },
): Promise<Migration> {
  const plan = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [table] = await exec.query<{
      id: string
      base_id: string
      label: string
      name: string
      name_id: string
      schema_id: string
      schema_name: string
      structure_state: string
    }>(
      `SELECT t.id, t.base_id, t.label, tn.name, t.name_id, t.schema_id,
              sn.name AS schema_name, b.structure_state
         FROM _basedb.table_def t
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
         JOIN _basedb.base b           ON b.id = t.base_id
         JOIN _basedb.tenant te        ON te.id = b.tenant_id
        WHERE t.id = $1 AND t.deleted_at IS NULL AND b.deleted_at IS NULL AND te.ref = $2`,
      [request.tableId, ctx.tenantId],
    )
    if (table === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
    }
    if (table.structure_state === 'frozen') {
      throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: table.base_id } })
    }

    const grants = await loadGrants(exec, ctx)
    await assertManageSchema(exec, ctx, grants, table.base_id)

    // Live links from OTHER tables pointing here. `ck_link_target_live` refuses a dead
    // target under a live link; naming the offender is more useful than the violation.
    const referencing = await exec.query<{ table_label: string; field_label: string }>(
      `SELECT ot.label AS table_label, f.label AS field_label
         FROM _basedb.field_link_config lc
         JOIN _basedb.field f      ON f.id = lc.field_id AND f.deleted_at IS NULL
         JOIN _basedb.table_def ot ON ot.id = f.table_id AND ot.deleted_at IS NULL
        WHERE lc.target_table_id = $1 AND lc.fk_dropped_at IS NULL AND ot.id <> $1`,
      [request.tableId],
    )
    if (referencing.length > 0) {
      throw new BasedbError('TABLE_REFERENCED', {
        details: {
          table: table.label,
          by: referencing.map((r) => `${r.table_label}.${r.field_label}`),
        },
      })
    }

    // The foreign keys this table BEARS, dropped in the same step. They are its own, so
    // nothing outside is disturbed beyond the brief lock on each referenced table.
    const borne = await exec.query<{
      field_id: string
      constraint_id: string
      constraint_name: string
      index_id: string
      index_name: string
      target_label: string
    }>(
      `SELECT lc.field_id, lc.fk_constraint_id AS constraint_id, cn.name AS constraint_name,
              lc.fk_index_id AS index_id, ixn.name AS index_name, tt.label AS target_label
         FROM _basedb.field_link_config lc
         JOIN _basedb.field f            ON f.id = lc.field_id AND f.deleted_at IS NULL
         JOIN _basedb.table_constraint c ON c.id = lc.fk_constraint_id
         JOIN _basedb.physical_name cn   ON cn.id = c.name_id
         JOIN _basedb.table_index ix     ON ix.id = lc.fk_index_id
         JOIN _basedb.physical_name ixn  ON ixn.id = ix.name_id
         JOIN _basedb.table_def tt       ON tt.id = lc.target_table_id
        WHERE f.table_id = $1 AND lc.fk_dropped_at IS NULL`,
      [request.tableId],
    )

    // Alias views aiming at this table, dropped with it (§4.2).
    const views = await exec.query<{ id: string; name: string; schema_name: string }>(
      `SELECT v.id, n.name, sn.name AS schema_name
         FROM _basedb.sql_view_alias v
         JOIN _basedb.physical_name n  ON n.id = v.name_id
         JOIN _basedb.db_schema s      ON s.id = v.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
        WHERE v.target_table_id = $1 AND v.dropped_at IS NULL`,
      [request.tableId],
    )

    const at = ctx.timestamp
    const stamp = quoteLiteral(at.toISOString())
    const actor = quoteLiteral(ctx.actor.id)
    const id = `${quoteLiteral(table.id)}::uuid`

    const relegated = await freeName(
      exec,
      table.schema_id,
      relegatedName(table.name, at),
      new Set<string>(),
      { kind: 'relation', in: table.schema_name },
    )
    const nameId = randomUUID()

    const statements: string[] = []

    for (const link of borne) {
      statements.push(
        `ALTER TABLE ${qualify(table.schema_name, table.name)} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(link.constraint_name)};`,
      )
      statements.push(`DROP INDEX IF EXISTS ${qualify(table.schema_name, link.index_name)};`)
      statements.push(
        `UPDATE _basedb.field_link_config SET fk_dropped_at = ${stamp}::timestamptz WHERE field_id = ${quoteLiteral(link.field_id)}::uuid;`,
      )
      statements.push(
        `UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = ${stamp}::timestamptz, state_changed_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(link.constraint_id)}::uuid;`,
      )
      statements.push(
        `UPDATE _basedb.table_index SET state = 'dropped', dropped_at = ${stamp}::timestamptz, state_changed_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(link.index_id)}::uuid;`,
      )
    }

    for (const view of views) {
      statements.push(`DROP VIEW IF EXISTS ${qualify(view.schema_name, view.name)};`)
      statements.push(
        `UPDATE _basedb.sql_view_alias SET dropped_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(view.id)}::uuid;`,
      )
    }

    // The display designation first — `fk_display_field` is deferred but does NOT
    // cascade, so the mirror would still point at a field about to stop being live.
    statements.push(`UPDATE _basedb.table_def
   SET display_field_id = NULL, display_field_kind = NULL,
       display_field_is_live = NULL, display_field_can_be_display = NULL
 WHERE id = ${id};`)

    statements.push(`UPDATE _basedb.field
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid, is_live = false
 WHERE table_id = ${id} AND deleted_at IS NULL;`)

    statements.push(`INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version,
        previous_name_id, allocated_by)
VALUES (${quoteLiteral(nameId)}::uuid, 'schema', ${quoteLiteral(table.schema_id)}::uuid,
        ${quoteLiteral(relegated)}, 'table', 'relegated', 1,
        ${quoteLiteral(table.name_id)}::uuid, ${actor}::uuid);`)
    statements.push(`UPDATE _basedb.physical_name
   SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(table.name_id)}::uuid;`)

    statements.push(
      `ALTER TABLE ${qualify(table.schema_name, table.name)} RENAME TO ${quoteIdentifier(relegated)};`,
    )

    statements.push(`UPDATE _basedb.table_def
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid, is_live = false,
       name_id = ${quoteLiteral(nameId)}::uuid
 WHERE id = ${id};`)

    // Saved views over this table go with it: they name fields that are no longer live.
    statements.push(`UPDATE _basedb.view_def
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid
 WHERE table_id = ${id} AND deleted_at IS NULL;`)

    return {
      baseId: table.base_id,
      label: table.label,
      relegated,
      locked: borne.map((l) => l.target_label),
      statements,
    }
  })

  return runMigration(pools, ctx, {
    baseId: plan.baseId,
    label: `Suppression logique de la table « ${plan.label} »`,
    origin: ctx.surface === 'mcp' ? 'mcp' : ctx.surface === 'rest' ? 'rest' : 'ui',
    // ONE step: §4.2 gives the table a single short-lock relegation, unlike a base,
    // whose tables are batched ten at a time.
    steps: [
      { label: `Reléguer « ${plan.label} »`, statements: plan.statements, lock: 'exclusive' },
    ],
    catalogDiff: {
      operation: 'delete_table',
      table: plan.label,
      relegated_name: plan.relegated,
      locked_tables: plan.locked,
    },
    affectedObjects: [{ kind: 'table', label: plan.label, relegated: plan.relegated }],
  })
}

/**
 * What deleting a table would do, WITHOUT doing it — for the confirmation screen.
 *
 * §4.2 asks the screen to name the tables it will briefly lock, and a reader deciding
 * whether to go ahead needs to know what stands in the way before clicking, not after.
 */
export async function previewTableDeletion(
  pools: Pools,
  ctx: RequestContext,
  tableId: string,
): Promise<{
  readonly label: string
  readonly rowCount: number | null
  readonly referencedBy: readonly string[]
  readonly lockedTables: readonly string[]
  readonly relegatedName: string
}> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const [table] = await exec.query<{
        label: string
        name: string
        schema_name: string
      }>(
        `SELECT t.label, tn.name, sn.name AS schema_name
           FROM _basedb.table_def t
           JOIN _basedb.physical_name tn ON tn.id = t.name_id
           JOIN _basedb.db_schema s      ON s.id = t.schema_id
           JOIN _basedb.physical_name sn ON sn.id = s.name_id
           JOIN _basedb.base b           ON b.id = t.base_id
           JOIN _basedb.tenant te        ON te.id = b.tenant_id
          WHERE t.id = $1 AND t.deleted_at IS NULL AND te.ref = $2`,
        [tableId, ctx.tenantId],
      )
      if (table === undefined) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
      }

      const referencing = await exec.query<{ label: string }>(
        `SELECT ot.label || '.' || f.label AS label
           FROM _basedb.field_link_config lc
           JOIN _basedb.field f      ON f.id = lc.field_id AND f.deleted_at IS NULL
           JOIN _basedb.table_def ot ON ot.id = f.table_id AND ot.deleted_at IS NULL
          WHERE lc.target_table_id = $1 AND lc.fk_dropped_at IS NULL AND ot.id <> $1`,
        [tableId],
      )

      const locked = await exec.query<{ label: string }>(
        `SELECT DISTINCT tt.label
           FROM _basedb.field_link_config lc
           JOIN _basedb.field f      ON f.id = lc.field_id AND f.deleted_at IS NULL
           JOIN _basedb.table_def tt ON tt.id = lc.target_table_id
          WHERE f.table_id = $1 AND lc.fk_dropped_at IS NULL`,
        [tableId],
      )

      // An ESTIMATE, from the planner's statistics, not a `count(*)`: the confirmation
      // screen must not pay for a full scan, and "about 12 000 rows" answers the
      // question just as well as an exact figure nobody will verify.
      const [estimate] = await exec.query<{ rows: string | null }>(
        `SELECT CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS rows
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2`,
        [table.schema_name, table.name],
      )

      return {
        label: table.label,
        rowCount: estimate?.rows == null ? null : Number(estimate.rows),
        referencedBy: referencing.map((r) => r.label),
        lockedTables: locked.map((l) => l.label),
        relegatedName: relegatedName(table.name, ctx.timestamp),
      }
    },
    { readOnly: true },
  )
}

// ── La suppression logique d'une base ─────────────────────────────────────────

/**
 * Deletes a base, logically — chapter 06 §4.3.
 *
 * The order is imposed by the database itself, not chosen here: `table_def.base_is_live`
 * mirrors `base.is_live`, and `ck_table_base_live` refuses a dead base under a live
 * table — translated into `BASE_NOT_EMPTY`. So the plan goes bottom-up, and each layer
 * is a step of its own:
 *
 *   1. les liens, par lots — `DROP CONSTRAINT` de chaque clé étrangère, `fk_dropped_at`
 *      posé, parce que `ck_link_target_live` refuse une cible morte sous un lien vivant ;
 *   2. les tables, par lots de dix — cascade logique sur les champs, relégation du nom,
 *      `ALTER TABLE … RENAME` ;
 *   3. les schémas d'alias — contrôle de dépendance, `DROP VIEW` par lots,
 *      `DROP SCHEMA` sans `CASCADE` ;
 *   4. le schéma courant, à verrou court — `ALTER SCHEMA … RENAME TO
 *      "b_t4z56fq_zz_supprime_20260918_crm"`, plus la cascade logique restante.
 *
 * Nothing is dropped. The tables keep their rows, their indexes and their data, and
 * remain READABLE IN DIRECT SQL under their relegated names (§4.4) — which is what
 * makes `restoreBase` exact and free rather than a re-import.
 */
export async function deleteBase(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Migration> {
  const plan = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      // Dropping an alias is reserved to the administration role (§1.2), and the plan
      // below drops every alias of the base. So the whole operation is.
      assertAdministration(grants, request.baseId)
      return buildDeletionPlan(exec, ctx, request.baseId)
    },
    { readOnly: false },
  )

  return runMigration(pools, ctx, {
    baseId: request.baseId,
    label: `Suppression logique de « ${plan.label} »`,
    origin: ctx.surface === 'mcp' ? 'mcp' : ctx.surface === 'rest' ? 'rest' : 'ui',
    steps: plan.steps,
    catalogDiff: {
      operation: 'delete_base',
      base: plan.label,
      schema: plan.schemaName,
      relegated_schema: plan.relegatedSchema,
      tables: plan.tables.length,
      alias_schemas: plan.aliasSchemas.length,
    },
    affectedObjects: [
      ...plan.tables.map((t) => ({ kind: 'table', name: t.name, label: t.label })),
      ...plan.aliasSchemas.map((s) => ({ kind: 'schema', name: s.name })),
    ],
  })
}

interface PlannedTable {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly relegated: string
  readonly nameId: string
  readonly previousNameId: string
}

interface DeletionPlan {
  readonly label: string
  readonly schemaName: string
  readonly relegatedSchema: string
  readonly schemaNameId: string
  readonly schemaPreviousNameId: string
  readonly schemaId: string
  readonly tables: readonly PlannedTable[]
  readonly aliasSchemas: ReadonlyArray<{ id: string; name: string }>
  readonly steps: readonly MigrationStep[]
}

async function buildDeletionPlan(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<DeletionPlan> {
  const [base] = await exec.query<{
    label: string
    is_live: boolean
    structure_state: string
    tenant_ref: string
  }>(
    `SELECT b.label, b.is_live, b.structure_state, t.ref AS tenant_ref
       FROM _basedb.base b
       JOIN _basedb.tenant t ON t.id = b.tenant_id
      WHERE b.id = $1`,
    [baseId],
  )
  if (base === undefined || !base.is_live) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  }
  if (base.structure_state === 'frozen') {
    throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: baseId } })
  }

  const [current] = await exec.query<{ id: string; name: string; name_id: string }>(
    `SELECT s.id, n.name, s.name_id
       FROM _basedb.db_schema s
       JOIN _basedb.physical_name n ON n.id = s.name_id
      WHERE s.base_id = $1 AND s.role = 'current' AND s.dropped_at IS NULL`,
    [baseId],
  )
  if (current === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  }

  const tables = await exec.query<{ id: string; name: string; label: string; name_id: string }>(
    `SELECT t.id, n.name, t.label, t.name_id
       FROM _basedb.table_def t
       JOIN _basedb.physical_name n ON n.id = t.name_id
      WHERE t.base_id = $1 AND t.deleted_at IS NULL
      ORDER BY t.position, t.id`,
    [baseId],
  )

  // A ceiling on the PLAN, not on the base: past this, the work belongs to the purge
  // job, run off the request path, rather than to a request holding a lease.
  if (tables.length > TABLE_BATCH * 32) {
    throw new BasedbError('MIGRATION_TOO_LARGE', {
      details: { tables: tables.length, maximum: TABLE_BATCH * 32 },
    })
  }

  const aliasSchemas = await exec.query<{ id: string; name: string }>(
    `SELECT s.id, n.name
       FROM _basedb.db_schema s
       JOIN _basedb.physical_name n ON n.id = s.name_id
      WHERE s.base_id = $1 AND s.role = 'alias' AND s.dropped_at IS NULL`,
    [baseId],
  )

  await assertNoUnknownDependent(exec, [current.name, ...aliasSchemas.map((s) => s.name)])

  const at = ctx.timestamp
  const stamp = quoteLiteral(at.toISOString())
  const actor = quoteLiteral(ctx.actor.id)

  // ── Names, allocated in the plan and inserted by it ────────────────────────
  //
  // The registry rows are emitted as statements of the plan rather than inserted now:
  // a proposal that is never applied must not have reserved names, and a name is never
  // released once taken (§4.4). The availability loop below runs against the registry as
  // it stands, and a concurrent allocation between plan and execution makes the step
  // fail on `uq_physical_name` — a named failure, not a half-applied schema.
  const planned: PlannedTable[] = []
  const reserved = new Set<string>()
  for (const table of tables) {
    // Scoped to the SCHEMA, not to the table: `fk_table_name` points at
    // `(name_id, schema_id)`, and a table's own id is the scope of its FIELD names.
    const name = await freeName(exec, current.id, relegatedName(table.name, at), reserved, {
      kind: 'relation',
      in: current.name,
    })
    planned.push({
      id: table.id,
      name: table.name,
      label: table.label,
      relegated: name,
      nameId: randomUUID(),
      previousNameId: table.name_id,
    })
  }

  const parsed = parseSchemaName(current.name)
  const baseSlug = parsed === null ? current.name : parsed.baseSlug
  const relegatedSchemaSuffix = `zz_supprime_${relegationDate(at)}_${truncateBytes(
    baseSlug,
    MAX_RELEGATED_BASE_SLUG_BYTES,
  )}`
  const relegatedSchema = await freeName(
    exec,
    SCOPE_INSTANCE,
    `b_${base.tenant_ref}_${relegatedSchemaSuffix}`,
    reserved,
    { kind: 'schema' },
  )
  const schemaNameId = randomUUID()

  // ── The steps ──────────────────────────────────────────────────────────────

  const steps: MigrationStep[] = []

  // 1. Foreign keys. Dropped for the WHOLE base before any table is touched: a link may
  //    cross two batches, and `ck_link_target_live` would refuse the target's deletion
  //    while the constraint still stands. `ALTER TABLE … DROP CONSTRAINT` takes
  //    `ACCESS EXCLUSIVE` on the referenced table too, so these go in batches as well.
  const links = await exec.query<{
    field_id: string
    constraint_id: string
    constraint_name: string
    index_id: string
    index_name: string
    table_name: string
  }>(
    `SELECT lc.field_id, lc.fk_constraint_id AS constraint_id, cn.name AS constraint_name,
            lc.fk_index_id AS index_id, ixn.name AS index_name, tn.name AS table_name
       FROM _basedb.field_link_config lc
       JOIN _basedb.field f            ON f.id = lc.field_id
       JOIN _basedb.table_def t        ON t.id = f.table_id
       JOIN _basedb.physical_name tn   ON tn.id = t.name_id
       JOIN _basedb.table_constraint c ON c.id = lc.fk_constraint_id
       JOIN _basedb.physical_name cn   ON cn.id = c.name_id
       JOIN _basedb.table_index ix     ON ix.id = lc.fk_index_id
       JOIN _basedb.physical_name ixn  ON ixn.id = ix.name_id
      WHERE lc.base_id = $1 AND lc.fk_dropped_at IS NULL AND t.deleted_at IS NULL`,
    [baseId],
  )

  for (let i = 0; i < links.length; i += TABLE_BATCH) {
    const batch = links.slice(i, i + TABLE_BATCH)
    const statements = batch.flatMap((link) => [
      `ALTER TABLE ${qualify(current.name, link.table_name)} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(link.constraint_name)};`,
      `DROP INDEX IF EXISTS ${qualify(current.name, link.index_name)};`,
      `UPDATE _basedb.field_link_config SET fk_dropped_at = ${stamp}::timestamptz WHERE field_id = ${quoteLiteral(link.field_id)}::uuid;`,
      `UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = ${stamp}::timestamptz, state_changed_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(link.constraint_id)}::uuid;`,
      `UPDATE _basedb.table_index SET state = 'dropped', dropped_at = ${stamp}::timestamptz, state_changed_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(link.index_id)}::uuid;`,
    ])
    steps.push({
      label: `Détacher ${batch.length} lien${batch.length > 1 ? 's' : ''}`,
      statements,
      lock: 'exclusive',
    })
  }

  // 2. The tables, ten at a time.
  for (let i = 0; i < planned.length; i += TABLE_BATCH) {
    const batch = planned.slice(i, i + TABLE_BATCH)
    const statements: string[] = []

    for (const table of batch) {
      const id = `${quoteLiteral(table.id)}::uuid`

      // The display designation goes first: `fk_display_field` is DEFERRABLE INITIALLY
      // DEFERRED but does NOT cascade, so the mirror would still point at a field about
      // to stop being live, and the constraint would fire at COMMIT. All four columns
      // are cleared together — `ck_display_pair` accepts 0 or 4 non-nulls, never 1.
      statements.push(`UPDATE _basedb.table_def
   SET display_field_id = NULL, display_field_kind = NULL,
       display_field_is_live = NULL, display_field_can_be_display = NULL
 WHERE id = ${id};`)

      // The logical cascade onto the fields is MANDATORY and the database imposes it:
      // `ck_field_table_live` forbids a live field under a dead table. Their COLUMNS are
      // not renamed and their registry rows stay `active` — the table already carries
      // the marker, and renaming N columns would stretch a step that must stay short
      // (§4.2).
      statements.push(`UPDATE _basedb.field
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid, is_live = false
 WHERE table_id = ${id} AND deleted_at IS NULL;`)

      statements.push(`INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version,
        previous_name_id, allocated_by)
VALUES (${quoteLiteral(table.nameId)}::uuid, 'schema', ${quoteLiteral(current.id)}::uuid,
        ${quoteLiteral(table.relegated)}, 'table', 'relegated', 1,
        ${quoteLiteral(table.previousNameId)}::uuid, ${actor}::uuid);`)
      statements.push(`UPDATE _basedb.physical_name
   SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(table.previousNameId)}::uuid;`)
      statements.push(
        `ALTER TABLE ${qualify(current.name, table.name)} RENAME TO ${quoteIdentifier(table.relegated)};`,
      )
      statements.push(`UPDATE _basedb.table_def
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid, is_live = false,
       name_id = ${quoteLiteral(table.nameId)}::uuid
 WHERE id = ${id};`)
    }

    steps.push({
      label: `Reléguer ${batch.length} table${batch.length > 1 ? 's' : ''}`,
      statements,
      lock: 'exclusive',
    })
  }

  // 3. The alias schemas: views by batches, then the schema itself, RESTRICT.
  for (const alias of aliasSchemas) {
    const views = await exec.query<{ id: string; name: string }>(
      `SELECT v.id, n.name
         FROM _basedb.sql_view_alias v
         JOIN _basedb.physical_name n ON n.id = v.name_id
        WHERE v.schema_id = $1 AND v.dropped_at IS NULL`,
      [alias.id],
    )

    for (let i = 0; i < views.length; i += VIEW_BATCH) {
      const batch = views.slice(i, i + VIEW_BATCH)
      steps.push({
        label: `Supprimer ${batch.length} vue${batch.length > 1 ? 's' : ''} d’alias`,
        statements: batch.flatMap((view) => [
          `DROP VIEW IF EXISTS ${qualify(alias.name, view.name)};`,
          `UPDATE _basedb.sql_view_alias SET dropped_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(view.id)}::uuid;`,
        ]),
        lock: 'short',
      })
    }

    steps.push({
      label: `Supprimer le schéma d’alias ${alias.name}`,
      statements: [
        // RESTRICT, never CASCADE (invariant I-DDL-3). It is a safety net here: the
        // views were dropped above, and anything still depending on the schema is
        // something we did not know about and must not destroy silently.
        `DROP SCHEMA IF EXISTS ${quoteIdentifier(alias.name)} RESTRICT;`,
        `UPDATE _basedb.db_schema SET dropped_at = ${stamp}::timestamptz WHERE id = ${quoteLiteral(alias.id)}::uuid;`,
      ],
      lock: 'short',
    })
  }

  // 4. The current schema, and the remaining logical cascade. Renaming a schema locks no
  //    table: it changes one `pg_namespace` row, and only concurrent name resolutions
  //    wait, briefly (§4.3).
  steps.push({
    label: 'Reléguer le schéma et clore la base',
    statements: [
      `INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version,
        previous_name_id, allocated_by)
VALUES (${quoteLiteral(schemaNameId)}::uuid, 'instance', ${quoteLiteral(SCOPE_INSTANCE)}::uuid,
        ${quoteLiteral(relegatedSchema)}, 'schema', 'relegated', 1,
        ${quoteLiteral(current.name_id)}::uuid, ${actor}::uuid);`,
      `UPDATE _basedb.physical_name
   SET state = 'retired', state_changed_at = ${stamp}::timestamptz
 WHERE id = ${quoteLiteral(current.name_id)}::uuid;`,
      `ALTER SCHEMA ${quoteIdentifier(current.name)} RENAME TO ${quoteIdentifier(relegatedSchema)};`,
      `UPDATE _basedb.db_schema
   SET name_id = ${quoteLiteral(schemaNameId)}::uuid
 WHERE id = ${quoteLiteral(current.id)}::uuid;`,
      `UPDATE _basedb.view_def
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid
 WHERE deleted_at IS NULL
   AND table_id IN (SELECT id FROM _basedb.table_def
                     WHERE base_id = ${quoteLiteral(baseId)}::uuid);`,
      `UPDATE _basedb.application
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid
 WHERE base_id = ${quoteLiteral(baseId)}::uuid AND deleted_at IS NULL;`,
      // Last, because `base.is_live` cascades onto `table_def.base_is_live` and
      // `db_schema.base_is_live`: every table must already be dead, or
      // `ck_table_base_live` refuses it as `BASE_NOT_EMPTY`.
      `UPDATE _basedb.base
   SET deleted_at = ${stamp}::timestamptz, deleted_by = ${actor}::uuid, is_live = false
 WHERE id = ${quoteLiteral(baseId)}::uuid;`,
    ],
    lock: 'short',
  })

  return {
    label: base.label,
    schemaName: current.name,
    relegatedSchema,
    schemaNameId,
    schemaPreviousNameId: current.name_id,
    schemaId: current.id,
    tables: planned,
    aliasSchemas,
    steps,
  }
}

// ── La restauration ───────────────────────────────────────────────────────────

/**
 * Restores a deleted base — chapter 06 §6.
 *
 * Exact and free, because nothing was destroyed: the tables kept their rows, their
 * indexes and their attribute numbers, and only their names carry a marker. Restoring
 * is therefore the deletion plan read backwards.
 *
 * The one thing that does NOT come back is the physical name. `uq_physical_name` is not
 * partial — no state releases a name — so the restored base gets a FRESH name allocated
 * under the ordinary procedure. "Le plus strict gagne, et c'est exactement ce qui rend
 * la restauration toujours possible côté nom" (§4.4). The label, on the other hand,
 * comes back as it was, unless someone took it meanwhile.
 */
export async function restoreBase(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Migration> {
  const plan = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const grants = await loadGrants(exec, ctx)
    assertAdministration(grants, request.baseId)
    return buildRestorationPlan(exec, ctx, request.baseId)
  })

  return runMigration(pools, ctx, {
    baseId: request.baseId,
    label: `Restauration de « ${plan.label} »`,
    origin: ctx.surface === 'mcp' ? 'mcp' : ctx.surface === 'rest' ? 'rest' : 'ui',
    steps: plan.steps,
    catalogDiff: { operation: 'restore_base', base: plan.label, tables: plan.tableCount },
  })
}

async function buildRestorationPlan(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
): Promise<{ label: string; tableCount: number; steps: readonly MigrationStep[] }> {
  const [base] = await exec.query<{
    label: string
    label_key: string
    deleted_at: string | null
    is_purged: boolean
    tenant_ref: string
  }>(
    `SELECT b.label, b.label_key, b.deleted_at, b.is_purged, t.ref AS tenant_ref
       FROM _basedb.base b JOIN _basedb.tenant t ON t.id = b.tenant_id
      WHERE b.id = $1`,
    [baseId],
  )
  if (base === undefined || base.deleted_at === null) {
    throw new BasedbError('RESTORE_TARGET_MISSING', { details: { base: baseId } })
  }
  if (base.is_purged) {
    throw new BasedbError('TARGET_PURGED', { details: { base: baseId } })
  }

  const taken = await exec.query<{ id: string }>(
    `SELECT b.id FROM _basedb.base b JOIN _basedb.tenant t ON t.id = b.tenant_id
      WHERE t.ref = $1 AND b.label_key = $2 AND b.deleted_at IS NULL`,
    [ctx.tenantId, base.label_key],
  )
  if (taken.length > 0) {
    throw new BasedbError('LABEL_DUPLICATE', { details: { label: base.label } })
  }

  const [schema] = await exec.query<{ id: string; name: string; name_id: string }>(
    `SELECT s.id, n.name, s.name_id
       FROM _basedb.db_schema s JOIN _basedb.physical_name n ON n.id = s.name_id
      WHERE s.base_id = $1 AND s.role = 'current' AND s.dropped_at IS NULL`,
    [baseId],
  )
  if (schema === undefined) {
    throw new BasedbError('RESTORE_TARGET_MISSING', { details: { base: baseId } })
  }

  const tables = await exec.query<{
    id: string
    name: string
    name_id: string
    previous: string | null
  }>(
    `SELECT t.id, n.name, t.name_id, n.previous_name_id AS previous
       FROM _basedb.table_def t JOIN _basedb.physical_name n ON n.id = t.name_id
      WHERE t.base_id = $1 AND t.deleted_at IS NOT NULL AND t.is_purged = false`,
    [baseId],
  )

  const at = ctx.timestamp
  const stamp = quoteLiteral(at.toISOString())
  const actor = quoteLiteral(ctx.actor.id)
  const reserved = new Set<string>()
  const steps: MigrationStep[] = []

  // The base comes back first: `ck_table_base_live` wants a live base under a live
  // table, and the mirrors cascade downwards from here.
  // The slug still carries the marker — the schema IS the relegated one — so it is
  // stripped before a fresh name is composed. Without this the base would come back as
  // `b_t4z56fq_zz_supprime_20260918_stocks`, restored and yet named as deleted.
  const restoredSlug = stripRelegation(parseSchemaName(schema.name)?.baseSlug ?? 'base')
  const restoredSchemaName = await freeName(
    exec,
    SCOPE_INSTANCE,
    `b_${base.tenant_ref}_${truncateBytes(restoredSlug, 53)}`,
    reserved,
    { kind: 'schema' },
  )
  const schemaNameId = randomUUID()

  steps.push({
    label: 'Rouvrir la base',
    statements: [
      `INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version,
        previous_name_id, allocated_by)
VALUES (${quoteLiteral(schemaNameId)}::uuid, 'instance', ${quoteLiteral(SCOPE_INSTANCE)}::uuid,
        ${quoteLiteral(restoredSchemaName)}, 'schema', 'active', 1,
        ${quoteLiteral(schema.name_id)}::uuid, ${actor}::uuid);`,
      `ALTER SCHEMA ${quoteIdentifier(schema.name)} RENAME TO ${quoteIdentifier(restoredSchemaName)};`,
      `UPDATE _basedb.db_schema
   SET name_id = ${quoteLiteral(schemaNameId)}::uuid
 WHERE id = ${quoteLiteral(schema.id)}::uuid;`,
      `UPDATE _basedb.base
   SET deleted_at = NULL, deleted_by = NULL, is_live = true,
       updated_at = ${stamp}::timestamptz, updated_by = ${actor}::uuid
 WHERE id = ${quoteLiteral(baseId)}::uuid;`,
    ],
    lock: 'short',
  })

  for (let i = 0; i < tables.length; i += TABLE_BATCH) {
    const batch = tables.slice(i, i + TABLE_BATCH)
    const statements: string[] = []

    for (const table of batch) {
      // The former name is not reused — it is `retired`, and a retired name is never
      // handed back. A fresh one is allocated from the same slug, which is why a
      // restored "Clients" may come back as `clients_2`.
      const previousName = table.previous === null ? null : await nameOf(exec, table.previous)
      const wanted = stripRelegation(previousName ?? table.name)
      // Checked inside the schema it is about to live in, which by then is the
      // restored one — the `ALTER SCHEMA … RENAME` is the first step of the plan.
      const restored = await freeName(exec, schema.id, wanted, reserved, {
        kind: 'relation',
        in: restoredSchemaName,
      })
      const nameId = randomUUID()

      statements.push(`INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version,
        previous_name_id, allocated_by)
VALUES (${quoteLiteral(nameId)}::uuid, 'schema', ${quoteLiteral(schema.id)}::uuid,
        ${quoteLiteral(restored)}, 'table', 'active', 1,
        ${quoteLiteral(table.name_id)}::uuid, ${actor}::uuid);`)
      statements.push(
        `ALTER TABLE ${qualify(restoredSchemaName, table.name)} RENAME TO ${quoteIdentifier(restored)};`,
      )
      statements.push(`UPDATE _basedb.table_def
   SET deleted_at = NULL, deleted_by = NULL, is_live = true,
       name_id = ${quoteLiteral(nameId)}::uuid
 WHERE id = ${quoteLiteral(table.id)}::uuid;`)
      statements.push(`UPDATE _basedb.field
   SET deleted_at = NULL, deleted_by = NULL, is_live = true
 WHERE table_id = ${quoteLiteral(table.id)}::uuid AND is_purged = false;`)
    }

    steps.push({
      label: `Restaurer ${batch.length} table${batch.length > 1 ? 's' : ''}`,
      statements,
      lock: 'exclusive',
    })
  }

  return { label: base.label, tableCount: tables.length, steps }
}

// ── Lecture ───────────────────────────────────────────────────────────────────

/** The tenant's deleted bases, for the restore menu. Administration role only. */
export async function listDeletedBases(
  pools: Pools,
  ctx: RequestContext,
): Promise<readonly BaseSummary[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      if (!isAdministration(grants)) return []
      const rows = await exec.query<{
        id: string
        name: string
        label: string
        deleted_at: string
        table_count: string
      }>(
        `SELECT b.id, n.name, b.label, b.deleted_at,
                (SELECT count(*) FROM _basedb.table_def t
                  WHERE t.base_id = b.id AND t.is_purged = false) AS table_count
           FROM _basedb.base b
           JOIN _basedb.tenant t     ON t.id = b.tenant_id
           JOIN _basedb.db_schema s  ON s.base_id = b.id AND s.role = 'current'
           JOIN _basedb.physical_name n ON n.id = s.name_id
          WHERE t.ref = $1 AND b.deleted_at IS NOT NULL AND b.is_purged = false
          ORDER BY b.deleted_at DESC`,
        [ctx.tenantId],
      )
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        label: r.label,
        deletedAt: r.deleted_at,
        tableCount: Number(r.table_count),
      }))
    },
    { readOnly: true },
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * The administration role, as chapter 06 §1.2 defines it operationally:
 * `app_user.is_instance_admin`, or a `manage_schema` permission of TENANT scope.
 *
 * A `manage_schema` of lower scope allows creating, modifying and logically deleting
 * objects; it never allows a physical rename, dropping an alias, or a purge. The base
 * deletion plan does two of those three, so it demands the full role.
 */
function isAdministration(grants: ActorGrants): boolean {
  if (grants.isInstanceAdmin) return true
  return grants.roles.some((role) =>
    role.permissions.some(
      (p) => p.action === 'manage_schema' && p.scopeKind === 'tenant' && p.scopeId === TENANT_SCOPE,
    ),
  )
}

function assertAdministration(grants: ActorGrants, baseId: string): void {
  if (isAdministration(grants)) return
  // `ADMIN_REQUIRED` (403) when the actor may SEE the object, `RESOURCE_NOT_FOUND` (404)
  // otherwise (§1.2). Seeing it is the ordinary case here — the caller reached this
  // through the base they have open.
  throw new BasedbError('ADMIN_REQUIRED', { details: { base: baseId } })
}

/** `manage_schema` at any scope covering the base — enough to rename a label (§1.1). */
export async function assertManageSchema(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  baseId: string,
): Promise<void> {
  if (isAdministration(grants)) return
  const allowed = grants.roles.some((role) =>
    role.permissions.some(
      (p) =>
        p.action === 'manage_schema' &&
        ((p.scopeKind === 'tenant' && p.scopeId === TENANT_SCOPE) ||
          (p.scopeKind === 'base' && p.scopeId === baseId)),
    ),
  )
  if (allowed) return

  const visible = await exec.query<{ id: string }>(
    'SELECT id FROM _basedb.base WHERE id = $1 AND deleted_at IS NULL',
    [baseId],
  )
  throw new BasedbError(visible.length > 0 ? 'ADMIN_REQUIRED' : 'RESOURCE_NOT_FOUND', {
    details: { base: baseId },
  })
}

/**
 * Objects OUTSIDE the product depending on the schemas about to be touched.
 *
 * A direct SQL consumer may have built its own view over an alias view — the typical
 * report or transformation model, which is exactly the audience the alias exists to
 * protect (§4.6). Without this check the `DROP` fails mid-plan with a raw `2BP01`
 * message; with it, the refusal is named and carries the dependent's name.
 */
async function assertNoUnknownDependent(exec: Executor, schemas: readonly string[]): Promise<void> {
  if (schemas.length === 0) return
  const rows = await exec.query<{ dependent: string; referenced: string }>(
    `SELECT DISTINCT
            dn.nspname || '.' || dc.relname AS dependent,
            rn.nspname || '.' || rc.relname AS referenced
       FROM pg_depend d
       JOIN pg_rewrite r  ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
       JOIN pg_class dc   ON dc.oid = r.ev_class
       JOIN pg_namespace dn ON dn.oid = dc.relnamespace
       JOIN pg_class rc   ON rc.oid = d.refobjid AND d.refclassid = 'pg_class'::regclass
       JOIN pg_namespace rn ON rn.oid = rc.relnamespace
      WHERE rn.nspname = ANY($1::text[])
        AND dn.nspname <> ALL($1::text[])
        AND dc.oid <> rc.oid`,
    [schemas],
  )
  const blocker = rows[0]
  if (blocker !== undefined) {
    throw new BasedbError('DEPENDENT_OBJECT', {
      details: { dependent: blocker.dependent, referenced: blocker.referenced },
    })
  }
}

/**
 * The suffix loop, applied to a name we are about to claim.
 *
 * The collision is tested in `pg_catalog` as well as in the registry (§4.1): a relegated
 * name IS registered, but the registry is authoritative only over what it knows, and a
 * table relegated by a manual recovery may predate basedb entirely.
 */
async function freeName(
  exec: Executor,
  scopeId: string,
  wanted: string,
  reserved: Set<string>,
  /**
   * Where the PHYSICAL collision is tested.
   *
   * A schema name is unique across the cluster; a table name is unique WITHIN ITS
   * SCHEMA, and nowhere else. Testing a table against every `pg_class` row of the
   * instance would make two bases deleted on the same day collide on
   * `zz_supprime_20260918_clients` and push the second to `_2` for no reason — a name
   * drift with no cause, which is exactly what the registry exists to avoid.
   */
  physicalScope: { readonly kind: 'schema' } | { readonly kind: 'relation'; readonly in: string },
): Promise<string> {
  for (let rank = 1; rank <= 99; rank++) {
    const suffix = rank === 1 ? '' : `_${rank}`
    const candidate = `${truncateBytes(wanted, 63 - Buffer.byteLength(suffix, 'utf8'))}${suffix}`
    if (reserved.has(candidate)) continue

    const registered = await exec.query<{ n: string }>(
      'SELECT count(*) AS n FROM _basedb.physical_name WHERE scope_id = $1 AND name = $2',
      [scopeId, candidate],
    )
    if (Number(registered[0]?.n ?? 0) > 0) continue

    const physical =
      physicalScope.kind === 'schema'
        ? await exec.query<{ n: string }>(
            'SELECT count(*) AS n FROM pg_namespace WHERE nspname = $1',
            [candidate],
          )
        : await exec.query<{ n: string }>(
            `SELECT count(*) AS n FROM pg_class c
               JOIN pg_namespace ns ON ns.oid = c.relnamespace
              WHERE ns.nspname = $2 AND c.relname = $1`,
            [candidate, physicalScope.in],
          )
    if (Number(physical[0]?.n ?? 0) > 0) continue

    reserved.add(candidate)
    return candidate
  }
  throw new BasedbError('NAME_COLLISION_UNRESOLVED', { details: { name: wanted } })
}

async function nameOf(exec: Executor, nameId: string): Promise<string | null> {
  const [row] = await exec.query<{ name: string }>(
    'SELECT name FROM _basedb.physical_name WHERE id = $1',
    [nameId],
  )
  return row?.name ?? null
}

/** `zz_supprime_20260918_clients` → `clients`. Idempotent on a name without the marker. */
function stripRelegation(name: string): string {
  return name.replace(/^zz_supprime_\d{8}_/, '')
}

/**
 * Truncates on BYTES, never on characters.
 *
 * PostgreSQL's 63-byte limit counts bytes, and `é` is two of them. Cutting on characters
 * produces a name that passes every check here and is silently truncated by the server —
 * which only emits a `NOTICE`, and every driver ignores those.
 */
function truncateBytes(value: string, max: number): string {
  const buffer = Buffer.from(value, 'utf8')
  if (buffer.length <= max) return value
  // Cut back to a character boundary: a continuation byte at the edge would produce
  // invalid UTF-8.
  let end = max
  while (end > 0 && (buffer[end] ?? 0) >= 0x80 && (buffer[end] ?? 0) < 0xc0) end--
  return buffer.subarray(0, end).toString('utf8')
}
