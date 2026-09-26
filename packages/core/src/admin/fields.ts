import { writeAudit } from '../audit/journal.js'
import { requireElevatedSession } from '../auth/elevation.js'
import { BasedbError } from '../errors/index.js'
import { SYSTEM_COLUMNS, decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { requireAdministration } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'
import { type AccessLevel, groupLevelsOnTable } from './access.js'
import { type GroupSummary, ensureSystemGroups, loadGroup, loadGroups } from './groups.js'

/**
 * Field rules, group by group — chapter 05 §4, and the screen §3.3 makes an obligation.
 *
 * The grid of §15 stops at the table. Below it, a group may be given less on ONE field:
 * the field hidden, or read-only. A rule only ever subtracts — it never gives a group more
 * than its level on the table — and it is written as the catalog's `field_permission`
 * row: `hidden` or `read`; no row is « what the level gives ».
 *
 * Rights stay additive (§3.3): a person in two groups gets, field by field, the higher of
 * the two. A field hidden for « Support » stays visible to a member of « Support » who is
 * also in « RH ». That is the trap the chapter names, and why this module also answers
 * the question that matters — what does THIS person see of THIS table, and through which
 * group — instead of leaving the administrator to compute it.
 */

/** What a rule does to a field, for one group. `null`: what the group's level gives. */
export type FieldRule = 'hidden' | 'read_only'

export interface FieldAccessField {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly kind: string
}

export interface FieldAccessGroup extends GroupSummary {
  /** The group's level on the table — inherited or not, as the grid shows it. */
  readonly level: AccessLevel
  /** Field id → rule, for the fields that carry one for this group. */
  readonly rules: Readonly<Record<string, FieldRule>>
}

export interface FieldAccess {
  readonly table: {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly base: { readonly id: string; readonly name: string; readonly label: string }
  }
  readonly fields: readonly FieldAccessField[]
  readonly groups: readonly FieldAccessGroup[]
}

/** One field, as a given person ends up with it — and why. */
export interface EffectiveField {
  readonly id: string
  readonly level: 'hidden' | 'read' | 'write'
  /** The person's groups through which the field is readable. */
  readonly readableVia: readonly string[]
  /** The person's groups whose rule restricts the field — overridden when readable elsewhere. */
  readonly restrictedBy: ReadonlyArray<{ readonly group: string; readonly rule: FieldRule }>
}

export interface EffectiveMask {
  readonly user: { readonly id: string; readonly displayName: string; readonly email: string }
  /** False when the person does not read the table at all: every field is then hidden. */
  readonly readsTable: boolean
  readonly fields: readonly EffectiveField[]
}

type TableRow = {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly base_id: string
  readonly base_name: string
  readonly base_label: string
}

async function loadTable(exec: Executor, ctx: RequestContext, tableId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(tableId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  const [table] = await exec.query<TableRow>(
    `SELECT td.id::text, tn.name, td.label, b.id::text AS base_id, sn.name AS base_name,
            b.label AS base_label
       FROM _basedb.table_def td
       JOIN _basedb.base b           ON b.id = td.base_id
       JOIN _basedb.tenant t         ON t.id = b.tenant_id
       JOIN _basedb.physical_name tn ON tn.id = td.name_id
       JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                    AND s.dropped_at IS NULL
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE td.id = $1 AND t.ref = $2 AND td.is_live AND b.is_live`,
    [tableId, ctx.tenantId],
  )
  if (table === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tableId } })
  const fields = await exec.query<FieldAccessField & Record<string, unknown>>(
    `SELECT f.id::text, n.name, f.label, f.kind
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live
      ORDER BY f.position`,
    [tableId],
  )
  return { table, fields: fields.filter((f) => !SYSTEM_COLUMNS.includes(f.name)) }
}

/** Group → field → rule, over one table. The catalog's `read` is the screen's `read_only`. */
async function loadRules(
  exec: Executor,
  tableId: string,
): Promise<Map<string, Record<string, FieldRule>>> {
  const rows = await exec.query<{ role_id: string; field_id: string; access: string }>(
    `SELECT fp.role_id::text, fp.field_id::text, fp.access
       FROM _basedb.field_permission fp
       JOIN _basedb.field f ON f.id = fp.field_id
      WHERE f.table_id = $1 AND f.is_live AND fp.access IN ('hidden', 'read')`,
    [tableId],
  )
  const out = new Map<string, Record<string, FieldRule>>()
  for (const row of rows) {
    const rules = out.get(row.role_id) ?? {}
    rules[row.field_id] = row.access === 'hidden' ? 'hidden' : 'read_only'
    out.set(row.role_id, rules)
  }
  return out
}

async function buildFieldAccess(
  exec: Executor,
  ctx: RequestContext,
  tableId: string,
): Promise<FieldAccess> {
  const { table, fields } = await loadTable(exec, ctx, tableId)
  const levels = (await groupLevelsOnTable(exec, ctx, tableId)) ?? new Map()
  const rules = await loadRules(exec, tableId)
  const groups = await loadGroups(exec, ctx)
  return {
    table: {
      id: table.id,
      name: table.name,
      label: table.label,
      base: { id: table.base_id, name: table.base_name, label: table.base_label },
    },
    fields: fields.map((f) => ({ id: f.id, name: f.name, label: f.label, kind: f.kind })),
    groups: groups.map((g) => ({
      ...g,
      level: levels.get(g.id) ?? 'none',
      rules: g.system === 'admins' ? {} : (rules.get(g.id) ?? {}),
    })),
  }
}

/** The field rules of one table, every group — the Administrators' screen. */
export async function fieldAccess(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string },
): Promise<FieldAccess> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)
    return buildFieldAccess(exec, ctx, request.tableId)
  })
}

/**
 * Sets — or lifts, with `null` — one group's rule on one field. An administration write:
 * a session elevated minutes ago, an audit line, and `authz_version` moved by the
 * catalog's trigger, so that every cached decision falls at once.
 */
export async function setFieldRule(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly groupId: string
    readonly fieldId: string
    readonly rule: FieldRule | null
    readonly sessionId: string
  },
): Promise<FieldAccess> {
  if (request.rule !== null && request.rule !== 'hidden' && request.rule !== 'read_only') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'rule' } })
  }
  if (!/^[0-9a-f-]{36}$/i.test(request.fieldId)) throw new BasedbError('RESOURCE_NOT_FOUND')

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    await requireElevatedSession(exec, ctx, request.sessionId)
    await ensureSystemGroups(exec, ctx.tenantId, ctx.actor.id)

    const group = await loadGroup(exec, ctx, request.groupId)
    // The Administrators hold every verb on the tenant: a field they cannot read would be
    // a contradiction the screen cannot express — as in the grid.
    if (group.system === 'admins') throw new BasedbError('GROUP_SYSTEM_IMMUTABLE')

    const [field] = await exec.query<{ table_id: string; label: string; name: string }>(
      `SELECT f.table_id::text, f.label, n.name
         FROM _basedb.field f
         JOIN _basedb.physical_name n ON n.id = f.name_id
         JOIN _basedb.table_def td    ON td.id = f.table_id
         JOIN _basedb.base b          ON b.id = td.base_id
         JOIN _basedb.tenant t        ON t.id = b.tenant_id
        WHERE f.id = $1 AND t.ref = $2 AND f.is_live AND td.is_live`,
      [request.fieldId, ctx.tenantId],
    )
    if (field === undefined || SYSTEM_COLUMNS.includes(field.name)) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { fieldId: request.fieldId } })
    }

    // A rule on a table the group does not reach restricts nothing, and would only wait
    // to surprise someone the day the group is given the table (§3.4).
    const levels = await groupLevelsOnTable(exec, ctx, field.table_id)
    if (request.rule !== null && (levels?.get(group.id) ?? 'none') === 'none') {
      throw new BasedbError('PERMISSION_OUT_OF_SCOPE', {
        details: { group: group.id, field: request.fieldId },
      })
    }

    if (request.rule === null) {
      await exec.query(
        'DELETE FROM _basedb.field_permission WHERE role_id = $1 AND field_id = $2',
        [group.id, request.fieldId],
        'delete',
      )
    } else {
      await exec.query(
        `INSERT INTO _basedb.field_permission (role_id, field_id, access)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, field_id) DO UPDATE SET access = EXCLUDED.access`,
        [group.id, request.fieldId, request.rule === 'hidden' ? 'hidden' : 'read'],
        'insert',
      )
    }
    await writeAudit(exec, ctx, {
      action: 'field_permission.set',
      objectKind: 'field',
      objectId: request.fieldId,
      objectName: field.label,
      payload: { group: group.id, rule: request.rule },
    })
    return buildFieldAccess(exec, ctx, field.table_id)
  })
}

/**
 * What one person ends up with on each field of a table, and through which of their
 * groups — the screen §3.3 requires. Computed by the decider itself, never re-derived
 * here: this is what every surface will enforce for that person.
 */
export async function effectiveFieldMask(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly userId: string },
): Promise<EffectiveMask> {
  if (!/^[0-9a-f-]{36}$/i.test(request.userId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireAdministration(exec, ctx)
    const [user] = await exec.query<{ id: string; display_name: string; email: string }>(
      `SELECT u.id::text, u.display_name, u.email
         FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
        WHERE u.id = $1 AND t.ref = $2 AND u.deleted_at IS NULL AND NOT u.is_system`,
      [request.userId, ctx.tenantId],
    )
    if (user === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')
    const { fields } = await loadTable(exec, ctx, request.tableId)

    // The decision, exactly as the person's own request would get it.
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
    let readable: ReadonlySet<string> = new Set()
    let writable: ReadonlySet<string> = new Set()
    let readsTable = false
    try {
      const grants = await loadGrants(exec, person)
      const target = await loadTarget(exec, person, request.tableId)
      if (target !== null) {
        const decision = decide(person, grants, 'read', target)
        if (decision.verdict === 'ALLOWED') {
          readsTable = true
          readable = decision.readableFields
          writable = decision.writableFields
        }
      }
    } catch (error) {
      // A disabled account reads nothing — that is an answer, not an error.
      if (!(error instanceof BasedbError && error.code === 'AUTHENTICATION_REQUIRED')) throw error
    }

    // The why: the person's groups, their level on the table, their rules.
    const memberOf = await exec.query<{ role_id: string }>(
      `SELECT m.role_id::text FROM _basedb.role_member m
         JOIN _basedb.role r ON r.id = m.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
        WHERE m.user_id = $1`,
      [user.id],
    )
    const groups = await loadGroups(exec, ctx)
    const labelOf = new Map(groups.map((g) => [g.id, g.label]))
    const levels = (await groupLevelsOnTable(exec, ctx, request.tableId)) ?? new Map()
    const rules = await loadRules(exec, request.tableId)
    const mine = memberOf
      .map((m) => m.role_id)
      .filter((id) => labelOf.has(id))
      .map((id) => ({
        id,
        label: labelOf.get(id) as string,
        reads: (levels.get(id) ?? 'none') !== 'none',
        rules: groups.find((g) => g.id === id)?.system === 'admins' ? {} : (rules.get(id) ?? {}),
      }))

    return {
      user: { id: user.id, displayName: user.display_name, email: user.email },
      readsTable,
      fields: fields.map((f) => ({
        id: f.id,
        level: writable.has(f.id) ? 'write' : readable.has(f.id) ? 'read' : 'hidden',
        readableVia: readsTable
          ? mine.filter((g) => g.reads && g.rules[f.id] !== 'hidden').map((g) => g.label)
          : [],
        restrictedBy: mine
          .filter((g) => g.reads && g.rules[f.id] !== undefined)
          .map((g) => ({ group: g.label, rule: g.rules[f.id] as FieldRule })),
      })),
    }
  })
}
