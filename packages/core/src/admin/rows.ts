import { qualify } from '@basedb/naming'
import { writeAudit } from '../audit/journal.js'
import { requireElevatedSession } from '../auth/elevation.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { requireAdministration } from '../rbac/require.js'
import { ROW_ALIAS, compileRowRule, ruleFieldsOf } from '../rbac/rows.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { disableRowSecurity, enableRowSecurity } from '../sql/row-security.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import { type AccessLevel, groupLevelsOnTable } from './access.js'
import { type GroupSummary, ensureSystemGroups, loadGroup, loadGroups } from './groups.js'

/**
 * Row rules, group by group — chapter 05 §16.
 *
 * Below the grid of §15, next to the field rules: a group may see only some rows of a
 * table, those a filter keeps — « commercial eq @moi ». A rule only ever subtracts, rights
 * stay additive, and a group that changes the table's structure sees all of it: the screen
 * offers no rule to such a group rather than one that would be ignored.
 */

export interface RowAccessField {
  readonly name: string
  readonly label: string
  readonly kind: string
  /** A choice list's options, for the suggestions of the screen. */
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
}

export interface RowAccessGroup extends GroupSummary {
  readonly level: AccessLevel
  /** The group's filter, as written — `null`: every row. */
  readonly rule: string | null
}

export interface RowAccess {
  readonly table: {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly base: { readonly id: string; readonly name: string; readonly label: string }
  }
  /** The fields a rule may name, the system columns included. */
  readonly fields: readonly RowAccessField[]
  readonly groups: readonly RowAccessGroup[]
}

type TableRow = {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly base_id: string
  readonly base_name: string
  readonly base_label: string
  readonly schema_name: string
}

async function loadTable(exec: Executor, ctx: RequestContext, tableId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(tableId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const [table] = await exec.query<TableRow>(
    `SELECT td.id::text, tn.name, td.label, b.id::text AS base_id, sn.name AS base_name,
            b.label AS base_label, tsn.name AS schema_name
       FROM _basedb.table_def td
       JOIN _basedb.base b           ON b.id = td.base_id
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.physical_name tn ON tn.id = td.name_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                    AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
       JOIN _basedb.db_schema ts     ON ts.id = td.schema_id
       JOIN _basedb.physical_name tsn ON tsn.id = ts.name_id
      WHERE td.id = $1 AND t.ref = $2 AND td.is_live AND b.is_live`,
    [tableId, ctx.tenantId],
  )
  if (table === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tableId } })
  const fields = await exec.query<{ id: string; name: string; label: string; kind: string }>(
    `SELECT f.id::text, n.name, f.label, f.kind
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position`,
    [tableId],
  )
  const options = await exec.query<{ field_id: string; value: string; label: string }>(
    `SELECT o.field_id::text, o.value, o.label
       FROM _basedb.select_option o
       JOIN _basedb.field f ON f.id = o.field_id
      WHERE f.table_id = $1 AND o.deleted_at IS NULL
      ORDER BY o.position`,
    [tableId],
  )
  return { table, fields, options }
}

async function loadRules(exec: Executor, tableId: string): Promise<Map<string, string>> {
  const rows = await exec.query<{ role_id: string; filter: string }>(
    'SELECT role_id::text, filter FROM _basedb.row_permission WHERE table_id = $1',
    [tableId],
  )
  return new Map(rows.map((r) => [r.role_id, r.filter]))
}

async function buildRowAccess(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<RowAccess> {
  const { table, fields, options } = await loadTable(exec, ctx, tableId)
  const levels = (await groupLevelsOnTable(exec, ctx, tableId)) ?? new Map()
  const rules = await loadRules(exec, tableId)
  const groups = await loadGroups(exec, ctx)
  const ruleable = new Set(
    ruleFieldsOf(fields)
      .filter((f) => f.stored)
      .map((f) => f.name),
  )
  return {
    table: {
      id: table.id,
      name: table.name,
      label: table.label,
      base: { id: table.base_id, name: table.base_name, label: table.base_label },
    },
    fields: fields
      .filter((f) => ruleable.has(f.name))
      .map((f) => {
        const own = options.filter((o) => o.field_id === f.id)
        return {
          name: f.name,
          label: f.label,
          kind: f.kind,
          ...(own.length > 0
            ? { options: own.map((o) => ({ value: o.value, label: o.label })) }
            : {}),
        }
      }),
    groups: groups.map((g) => ({
      ...g,
      level: levels.get(g.id) ?? 'none',
      rule: g.system === 'admins' ? null : (rules.get(g.id) ?? null),
    })),
  }
}

/** The row rules of one table, every group — the Administrators' screen. */
export async function rowAccess(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string },
): Promise<RowAccess> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
    return buildRowAccess(exec, ctx, request.tableId)
  })
}

/**
 * Sets — or lifts, with `null` — one group's rule on one table. An administration write:
 * elevated session, audit line, and `authz_version` moved by the catalog's trigger.
 *
 * Refused: a rule on the Administrators (`GROUP_SYSTEM_IMMUTABLE`), on a group that does
 * not reach the table or that manages it (`PERMISSION_OUT_OF_SCOPE` — it would restrict
 * nothing), and a filter that does not compile against the table (the filter's codes).
 */
export async function setRowRule(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly groupId: string
    readonly tableId: string
    readonly rule: string | null
    readonly sessionId: string
  },
): Promise<RowAccess> {
  const rule = request.rule === null || request.rule.trim() === '' ? null : request.rule.trim()
  const done = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await requireElevatedSession(exec, ctx, request.sessionId)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)

    const group = await loadGroup(exec, ctx, request.groupId)
    if (group.system === 'admins') throw new BasedbError('GROUP_SYSTEM_IMMUTABLE')
    const { table, fields } = await loadTable(exec, ctx, request.tableId)

    if (rule === null) {
      await exec.query(
        'DELETE FROM _basedb.row_permission WHERE role_id = $1 AND table_id = $2',
        [group.id, table.id],
        'delete',
      )
    } else {
      const level = (await groupLevelsOnTable(exec, ctx, table.id))?.get(group.id) ?? 'none'
      if (level === 'none' || level === 'manage') {
        throw new BasedbError('PERMISSION_OUT_OF_SCOPE', {
          details: { group: group.id, table: table.id, level },
        })
      }
      compileRowRule(rule, ruleFieldsOf(fields))
      await exec.query(
        `INSERT INTO _basedb.row_permission (role_id, table_id, filter, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (role_id, table_id) DO UPDATE
            SET filter = EXCLUDED.filter, updated_by = EXCLUDED.updated_by,
                updated_at = clock_timestamp()`,
        [group.id, table.id, rule, ctx.actor.id],
        'insert',
      )
    }
    await writeAudit(exec, ctx, {
      action: 'row_permission.set',
      objectKind: 'table',
      objectId: table.id,
      objectName: table.label,
      payload: { group: group.id, rule },
    })
    const [left] = await exec.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM _basedb.row_permission WHERE table_id = $1',
      [table.id],
    )
    return {
      access: await buildRowAccess(exec, ctx, table.id),
      relation: qualify(table.schema_name, table.name),
      ruled: (left?.n ?? 0) > 0,
    }
  })
  // PostgreSQL's row security follows: on while a rule exists, for the SQL run in the
  // interface (`sql/row-security.ts`); off with the last one.
  await withTransaction(pools, 'ddl', ctx, async (exec) => {
    if (done.ruled) await enableRowSecurity(exec, done.relation)
    else await disableRowSecurity(exec, done.relation)
  })
  return done.access
}

/** How many rows of a table one person sees, and through which of their groups. */
export interface EffectiveRows {
  readonly user: { readonly id: string; readonly displayName: string; readonly email: string }
  readonly readsTable: boolean
  readonly total: number
  readonly visible: number
  /** Their groups reading the table, each with its rule — `null`: every row. */
  readonly via: ReadonlyArray<{ readonly group: string; readonly rule: string | null }>
}

/**
 * The count of rows a person sees, computed with the decider's own predicate — what every
 * surface will show them, not a re-derivation of it.
 */
export async function effectiveRows(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly userId: string },
): Promise<EffectiveRows> {
  if (!/^[0-9a-f-]{36}$/i.test(request.userId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const plan = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    const [user] = await exec.query<{ id: string; display_name: string; email: string }>(
      `SELECT u.id::text, u.display_name, u.email
         FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
        WHERE u.id = $1 AND t.ref = $2 AND u.deleted_at IS NULL AND NOT u.is_system`,
      [request.userId, ctx.tenantId],
    )
    if (user === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')
    const { table } = await loadTable(exec, ctx, request.tableId)

    const now = new Date()
    const person = sealContext({
      requestId: ctx.requestId,
      actor: { kind: 'user', id: user.id },
      tenantId: ctx.tenantId,
      surface: 'ui',
      timestamp: now,
      deadline: new Date(now.getTime() + 30_000),
      permissions: { version: '1', rowPredicate: 'TRUE' },
    })
    let predicate: string | null = null
    try {
      const grants = await loadGrants(exec, person)
      const target = await loadTarget(exec, person, table.id)
      if (target !== null) {
        const decision = decide(person, grants, 'read', target)
        if (decision.verdict === 'ALLOWED') predicate = decision.rowPredicate
      }
    } catch (error) {
      // A disabled account reads nothing — that is an answer, not an error.
      if (!(error instanceof BasedbError && error.code === 'AUTHENTICATION_REQUIRED')) throw error
    }

    const memberOf = await exec.query<{ role_id: string }>(
      `SELECT m.role_id::text FROM _basedb.role_member m
         JOIN _basedb.role r ON r.id = m.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
        WHERE m.user_id = $1`,
      [user.id],
    )
    const groups = await loadGroups(exec, ctx)
    const levels = (await groupLevelsOnTable(exec, ctx, table.id)) ?? new Map()
    const rules = await loadRules(exec, table.id)
    const via = memberOf
      .map((m) => groups.find((g) => g.id === m.role_id))
      .filter((g): g is (typeof groups)[number] => g !== undefined)
      .filter((g) => (levels.get(g.id) ?? 'none') !== 'none')
      .map((g) => ({
        group: g.label,
        rule:
          g.system === 'admins' || levels.get(g.id) === 'manage' ? null : (rules.get(g.id) ?? null),
      }))
    return {
      user: { id: user.id, displayName: user.display_name, email: user.email },
      relation: qualify(table.schema_name, table.name),
      predicate,
      via,
    }
  })

  const counts = await pools.withConnection('data', (exec) =>
    exec.query<{ total: number; visible: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE ( /*predicat_lignes*/ ${plan.predicate ?? 'FALSE'} ))::int AS visible
         FROM ${plan.relation} AS "${ROW_ALIAS}"`,
    ),
  )
  return {
    user: plan.user,
    readsTable: plan.predicate !== null,
    total: counts[0]?.total ?? 0,
    visible: counts[0]?.visible ?? 0,
    via: plan.via,
  }
}
