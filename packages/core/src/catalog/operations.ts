import { qualify } from '@basedb/naming'
import type { ColumnSpec, FieldKind } from '../ddl/emit.js'
import {
  sqlCommentOnColumn,
  sqlCommentOnTable,
  sqlCreateSchema,
  sqlCreateTable,
} from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { SCOPE_INSTANCE, allocateName } from '../naming/allocation.js'
import { loadProjectTarget, requireAction, requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { commentText, normalizeDescription } from './description.js'

/**
 * Structure operations — chapter 03.
 *
 * An operation is a NAMED action of the domain: it takes a context as its first
 * argument and returns either a result or a typed error. The kernel does not expose a
 * connection, it exposes operations (chapter 10 §2.2).
 *
 * DDL and catalog writes in the SAME transaction: both succeed or both fail. That is
 * the cadrage's requirement, and it is what forbids a name from being reserved for an
 * object that does not exist.
 */

/** Comparison key for a label: folded case, collapsed spaces (chapter 01 §2.2). */
export function labelKey(label: string): string {
  return label.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface CreateBaseResult {
  readonly baseId: string
  /** The project the base was created in. */
  readonly projectId: string
  readonly description: string | null
  readonly schemaId: string
  /** Assigned physical name, to be returned to the caller (chapter 01 §2.5). */
  readonly schemaName: string
}

/**
 * Creates a base: one catalog row, one allocated name, one PostgreSQL schema.
 *
 * The schema name is allocated at INSTANCE scope, because it is the host database that
 * arbitrates its uniqueness; the suffix loop, however, operates on the base slug, and it
 * is that offset which makes multi-tenancy possible without a spurious suffix.
 */
export async function createBase(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly label: string
    readonly technicalName?: string
    readonly description?: string | null
    /** The project to create it in — the tenant's first when absent. */
    readonly projectId?: string
  },
): Promise<CreateBaseResult> {
  // Validated before the transaction opens: a description that is too long is a refusal,
  // and there is no reason to allocate a name only to roll it back.
  const description = normalizeDescription(request.description)

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    const tenant = await resolveTenant(exec, ctx)

    // A base is created INSIDE a project, by whoever may build in it: `manage_schema`
    // on the project, or on the tenant (chapter 05 §8, §15).
    const projectId = request.projectId ?? (await defaultProjectId(exec, ctx))
    const project = await loadProjectTarget(exec, ctx, projectId)
    await requireAction(exec, ctx, 'manage_schema', project, { project: projectId })

    // A label is unique within its project; caught here to name the conflict rather
    // than surface a constraint violation.
    const clash = await exec.query<{ id: string }>(
      'SELECT id FROM _basedb.base WHERE project_id = $1 AND label_key = $2 AND deleted_at IS NULL',
      [project?.id, labelKey(request.label)],
    )
    if (clash.length > 0) {
      throw new BasedbError('LABEL_DUPLICATE', { details: { label: request.label } })
    }

    const [base] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.base
         (tenant_id, project_id, label, label_key, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
      [tenant.id, project?.id, request.label, labelKey(request.label), description, ctx.actor.id],
      'insert',
    )

    const name = await allocateName(exec, ctx, {
      label: request.label,
      technicalName: request.technicalName,
      objectKind: 'schema',
      scopeKind: 'instance',
      scopeId: SCOPE_INSTANCE,
      tenantId: tenant.ref,
    })

    const [schema] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.db_schema (base_id, role, name_id, created_by)
       VALUES ($1, 'current', $2, $3) RETURNING id`,
      [base.id, name.nameId, ctx.actor.id],
      'insert',
    )

    await exec.query(sqlCreateSchema(name.name), [], 'ddl')

    return {
      baseId: base.id,
      projectId: project?.id as string,
      description,
      schemaId: schema.id,
      schemaName: name.name,
    }
  })
}

export interface FieldRequest {
  readonly label: string
  readonly kind: FieldKind
  readonly required?: boolean
  readonly technicalName?: string
  /** What the field is for — shown in the documentation and to agents. Plain text. */
  readonly description?: string | null
}

export interface CreatedField {
  readonly fieldId: string
  readonly label: string
  readonly description: string | null
  readonly name: string
  readonly kind: FieldKind
}

export interface CreateTableResult {
  readonly tableId: string
  readonly description: string | null
  readonly tableName: string
  readonly schemaName: string
  readonly fields: readonly CreatedField[]
  /** The SQL a consumer will write to read this table. */
  readonly qualifiedName: string
}

/**
 * Creates a table and its fields, in ONE operation.
 *
 * "A composite operation — creating a table with its fields — is ONE kernel operation,
 * not a sequence orchestrated by the API" (chapter 10 §4.1). Without this, a failure on
 * the third field would leave a half-defined table that nothing would clean up.
 */
export async function createTable(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly baseId: string
    readonly label: string
    readonly technicalName?: string
    readonly description?: string | null
    readonly fields: readonly FieldRequest[]
  },
): Promise<CreateTableResult> {
  // Every description is checked BEFORE the transaction: the third field's being too long
  // must not be discovered after the first two have been inserted and named.
  const tableDescription = normalizeDescription(request.description)
  const fieldDescriptions = request.fields.map((f, i) =>
    normalizeDescription(f.description, `fields[${i}].description`),
  )

  return withTransaction(pools, 'ddl', ctx, async (exec) => {
    // A table is added by whoever may build in its base (chapter 05 §8).
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const schema = await resolveSchema(exec, request.baseId)

    const tableName = await allocateName(exec, ctx, {
      label: request.label,
      technicalName: request.technicalName,
      objectKind: 'table',
      scopeKind: 'schema',
      scopeId: schema.id,
    })

    const [position] = await exec.query<{ n: number }>(
      'SELECT COALESCE(MAX(position), 0) + 1 AS n FROM _basedb.table_def WHERE base_id = $1',
      [request.baseId],
    )

    const [table] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.table_def
         (base_id, schema_id, name_id, label, label_key, description, position,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING id`,
      [
        request.baseId,
        schema.id,
        tableName.nameId,
        request.label,
        labelKey(request.label),
        tableDescription,
        position.n,
        ctx.actor.id,
      ],
      'insert',
    )

    // The five system columns are recorded in the registry when the table is created,
    // at that table's scope (chapter 01 §4): any later collision is then handled by the
    // ordinary availability mechanism, with no special rule.
    for (const systemColumn of [
      '_id',
      '_created_at',
      '_updated_at',
      '_created_by',
      '_updated_by',
    ]) {
      await exec.query(
        `INSERT INTO _basedb.physical_name
           (scope_kind, scope_id, name, object_kind, state, slug_version, allocated_by)
         VALUES ('table', $1, $2, 'system_field', 'active', 1, $3)`,
        [table.id, systemColumn, ctx.actor.id],
        'insert',
      )
    }

    const fields: CreatedField[] = []
    const columns: ColumnSpec[] = []

    for (const [index, field] of request.fields.entries()) {
      const description = fieldDescriptions[index] ?? null
      const fieldName = await allocateName(exec, ctx, {
        label: field.label,
        technicalName: field.technicalName,
        objectKind: 'field',
        scopeKind: 'table',
        scopeId: table.id,
      })

      const [row] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.field
           (table_id, base_id, kind, name_id, label, label_key, description, is_required,
            position, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
        [
          table.id,
          request.baseId,
          field.kind,
          fieldName.nameId,
          field.label,
          labelKey(field.label),
          description,
          field.required ?? false,
          fields.length + 1,
          ctx.actor.id,
        ],
        'insert',
      )

      await insertConfigSatellite(exec, row.id, field.kind)

      fields.push({
        fieldId: row.id,
        label: field.label,
        description,
        name: fieldName.name,
        kind: field.kind,
      })
      columns.push({ name: fieldName.name, kind: field.kind, required: field.required ?? false })
    }

    await exec.query(sqlCreateTable(schema.name, tableName.name, columns), [], 'ddl')

    // Comments make the database readable in psql without opening the product.
    await exec.query(
      sqlCommentOnTable(schema.name, tableName.name, commentText(request.label, tableDescription)),
      [],
      'ddl',
    )
    for (const f of fields) {
      await exec.query(
        sqlCommentOnColumn(
          schema.name,
          tableName.name,
          f.name,
          commentText(f.label, f.description),
        ),
        [],
        'ddl',
      )
    }

    return {
      tableId: table.id,
      description: tableDescription,
      tableName: tableName.name,
      schemaName: schema.name,
      fields,
      qualifiedName: qualify(schema.name, tableName.name),
    }
  })
}

/**
 * Configuration satellite, required by the `ck_field_config_present` trigger for every
 * type whose `has_config` is true — that is, all of them in v1.
 *
 * The trigger is a DEFERRED constraint: it is checked at COMMIT, which allows the
 * natural write order, the field then its satellite.
 */
async function insertConfigSatellite(
  exec: Executor,
  fieldId: string,
  kind: FieldKind,
): Promise<void> {
  switch (kind) {
    case 'short_text':
    case 'long_text':
      await exec.query(
        'INSERT INTO _basedb.field_text_config (field_id, kind) VALUES ($1, $2)',
        [fieldId, kind],
        'insert',
      )
      return
    case 'number':
      await exec.query(
        'INSERT INTO _basedb.field_number_config (field_id) VALUES ($1)',
        [fieldId],
        'insert',
      )
      return
    case 'boolean':
      await exec.query(
        'INSERT INTO _basedb.field_boolean_config (field_id) VALUES ($1)',
        [fieldId],
        'insert',
      )
      return
    case 'date':
    case 'datetime':
      await exec.query(
        'INSERT INTO _basedb.field_datetime_config (field_id, kind) VALUES ($1, $2)',
        [fieldId, kind],
        'insert',
      )
      return
    default:
      // `select`, `link` and `formula` require configuration the caller must supply:
      // accepting them without it would produce a field the trigger would reject at
      // COMMIT, with a far less clear diagnostic than here.
      throw new BasedbError('FIELD_CONFIG_MISSING', {
        details: { kind, reason: 'type outside the kernel vertical slice' },
      })
  }
}

async function resolveTenant(
  exec: Executor,
  ctx: RequestContext,
): Promise<{ id: string; ref: string }> {
  const rows = await exec.query<{ id: string; ref: string }>(
    'SELECT id, ref FROM _basedb.tenant WHERE ref = $1 AND deleted_at IS NULL',
    [ctx.tenantId],
  )
  const tenant = rows[0]
  if (tenant === undefined) {
    // Absence, not a revealing error: the caller learns nothing about a tenant it
    // cannot see.
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tenant: ctx.tenantId } })
  }
  return tenant
}

async function resolveSchema(
  exec: Executor,
  baseId: string,
): Promise<{ id: string; name: string }> {
  const rows = await exec.query<{ id: string; name: string }>(
    `SELECT s.id, n.name
       FROM _basedb.db_schema s
       JOIN _basedb.physical_name n ON n.id = s.name_id
      WHERE s.base_id = $1 AND s.role = 'current' AND s.dropped_at IS NULL`,
    [baseId],
  )
  const schema = rows[0]
  if (schema === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  }
  return schema
}

/**
 * The tenant's first project — created, named « Projet principal », when there is none.
 *
 * What a base created without naming a project lands in: the first base of a fresh
 * instance needs a home, and callers written before projects existed name none.
 */
export async function defaultProjectId(exec: Executor, ctx: RequestContext): Promise<string> {
  const rows = await exec.query<{ id: string }>(
    `SELECT p.id FROM _basedb.project p
       JOIN _basedb.tenant t ON t.id = p.tenant_id
      WHERE t.ref = $1 AND p.deleted_at IS NULL
      ORDER BY p.position, p.created_at
      LIMIT 1`,
    [ctx.tenantId],
  )
  if (rows[0] !== undefined) return rows[0].id
  const [created] = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
     SELECT t.id, 'Projet principal', 'projet principal', $2, $2
       FROM _basedb.tenant t WHERE t.ref = $1
     RETURNING id`,
    [ctx.tenantId, ctx.actor.id],
    'insert',
  )
  return created.id
}
