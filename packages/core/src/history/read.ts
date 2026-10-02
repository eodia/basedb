import { qualify, quoteIdentifier } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { type ActorGrants, type Decision, decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { ROW_ALIAS, rowWhere } from '../rbac/rows.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { refuseSynced } from '../sync/guard.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type HistoryTable, loadHistoryTables } from './catalog.js'
import { drainHistory } from './drain.js'

/**
 * Reading the history — chapter 07 §9 — and the two ways back of §12.1: undoing a
 * modification, restoring a deleted row.
 *
 * The same single enforcement point as every read (§9.2): the history of a row is read
 * with `read` on its table; a field the reader may not read has no detail line; and a
 * modification that touched ONLY such fields is withheld altogether — an empty entry
 * would say that a hidden field changed, and when.
 */

export type RevisionOp = 'insert' | 'update' | 'delete'

export interface RevisionChange {
  readonly fieldId: string
  readonly label: string
  readonly kind: string
  /** The column, or `null` when the field was deleted since. */
  readonly name: string | null
  /** `undefined`: not concerned (a creation has no "before", a deletion no "after"). */
  readonly before?: unknown
  readonly after?: unknown
  readonly beforeDisplay: string | null
  readonly afterDisplay: string | null
}

export interface RevisionActor {
  readonly kind: string
  readonly userId: string | null
  readonly name: string | null
  readonly tokenId: string | null
  readonly tokenLabel: string | null
  /** A direct SQL write: the session that made it, since no person is known (§2.2). */
  readonly sqlIdentity: string | null
}

export interface Revision {
  readonly id: string
  readonly occurredAt: string
  readonly op: RevisionOp
  readonly cascade: boolean
  readonly table: { readonly id: string; readonly name: string; readonly label: string }
  readonly recordId: string
  readonly recordDisplay: string | null
  readonly actor: RevisionActor
  readonly changes: readonly RevisionChange[]
  /** What the reader may do with it now. */
  readonly actions: ReadonlyArray<'revert' | 'restore'>
}

export interface RevisionPage {
  readonly revisions: readonly Revision[]
  /** Opaque. `null` at the end — and ONLY the cursor says so (§9.2, rule 3). */
  readonly nextCursor: string | null
}

/** Revisions per page, and the most a caller may ask for. */
export const HISTORY_PAGE = 50
export const HISTORY_PAGE_MAX = 200

type HeaderRow = {
  readonly id: string
  readonly occurred_at: string
  readonly table_id: string
  readonly record_id: string
  readonly op: RevisionOp
  readonly is_cascade: boolean
  readonly record_display: string | null
  readonly actor_kind: string
  readonly actor_user_id: string | null
  readonly actor_token_id: string | null
  readonly sql_identity: string | null
  readonly user_name: string | null
  readonly token_label: string | null
}

type DetailRow = {
  readonly revision_id: string
  readonly field_id: string
  readonly field_kind: string
  readonly before_value: unknown
  readonly after_value: unknown
  readonly before_display: string | null
  readonly after_display: string | null
  readonly has_before: boolean
  readonly has_after: boolean
}

function encodeCursor(row: { occurred_at: string; id: string }): string {
  return Buffer.from(`${row.occurred_at}|${row.id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string | undefined): { at: string; id: string } | null {
  if (cursor === undefined || cursor === '') return null
  const text = Buffer.from(cursor, 'base64url').toString('utf8')
  const [at, id] = text.split('|')
  if (at === undefined || id === undefined || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new BasedbError('CURSOR_INVALID')
  }
  return { at, id }
}

/** A table the reader may read, with what the decider allows on it. */
interface Visible {
  readonly table: HistoryTable
  readonly read: Decision
  readonly update: Decision
  readonly create: Decision
}

async function visibleTables(
  exec: Executor,
  ctx: RequestContext,
  grants: ActorGrants,
  tableIds: readonly string[],
): Promise<Map<string, Visible>> {
  const tables = await loadHistoryTables(exec, tableIds)
  const out = new Map<string, Visible>()
  for (const id of tableIds) {
    const table = tables.get(id)
    const target = await loadTarget(exec, ctx, id)
    if (table === undefined || target === null) continue
    const read = decide(ctx, grants, 'read', target)
    if (read.verdict !== 'ALLOWED') continue
    out.set(id, {
      table,
      read,
      update: decide(ctx, grants, 'update', target),
      create: decide(ctx, grants, 'create', target),
    })
  }
  return out
}

/** Headers of a page, newest first, then their visible details. */
async function pageOf(
  exec: Executor,
  visible: ReadonlyMap<string, Visible>,
  where: { readonly sql: string; readonly params: readonly unknown[] },
  cursor: string | undefined,
  limit: number,
): Promise<RevisionPage> {
  const after = decodeCursor(cursor)
  const params: unknown[] = [...where.params]
  let bound = ''
  if (after !== null) {
    params.push(after.at, after.id)
    bound = `AND r.occurred_at <= $${params.length - 1}::timestamptz
             AND (r.occurred_at, r.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
  }
  params.push(limit + 1)

  const headers = await exec.query<HeaderRow>(
    `SELECT r.id::text, r.occurred_at::text, r.table_id::text, r.record_id::text, r.op,
            r.is_cascade, r.record_display, r.actor_kind, r.actor_user_id::text,
            r.actor_token_id::text, r.sql_identity,
            u.display_name AS user_name, coalesce(tk.label, fv.label, au.label) AS token_label
       FROM _basedb.record_revision r
       LEFT JOIN _basedb.app_user u   ON u.id = r.actor_user_id
       LEFT JOIN _basedb.api_token tk ON tk.id = r.actor_token_id
       -- An answer to a public form: its « token » is the share, named by its form.
       LEFT JOIN _basedb.form_share fs ON fs.id = r.actor_token_id AND r.actor_kind = 'form'
       LEFT JOIN _basedb.view_def fv   ON fv.id = fs.view_id
       -- An automation's write: its « token » is the automation, named by its label.
       LEFT JOIN _basedb.automation au ON au.id = r.actor_token_id AND r.actor_kind = 'automation'
      WHERE ${where.sql} ${bound}
      ORDER BY r.occurred_at DESC, r.id DESC
      LIMIT $${params.length}`,
    params,
  )

  const more = headers.length > limit
  const page = more ? headers.slice(0, limit) : headers

  const details =
    page.length === 0
      ? []
      : await exec.query<DetailRow>(
          `SELECT revision_id::text, field_id::text, field_kind, before_value, after_value,
                  before_display, after_display,
                  before_value IS NOT NULL AS has_before, after_value IS NOT NULL AS has_after
             FROM _basedb.record_revision_field
            WHERE (revision_id, occurred_at) IN
                  (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))`,
          [page.map((h) => h.id), page.map((h) => h.occurred_at)],
        )
  const byRevision = new Map<string, DetailRow[]>()
  for (const d of details) {
    const list = byRevision.get(d.revision_id) ?? []
    list.push(d)
    byRevision.set(d.revision_id, list)
  }

  // The rows a reader under a row rule sees (05 §16): the history of any other is not
  // theirs to read — nor that of a deleted row, whose values no rule can be read against.
  const seen = new Map<string, Set<string>>()
  for (const [tableId, v] of visible) {
    if (v.read.rowPredicate === 'TRUE') continue
    const ids = [...new Set(page.filter((h) => h.table_id === tableId).map((h) => h.record_id))]
    const rows =
      ids.length === 0 || !v.table.isLive
        ? []
        : await exec.query<{ id: string }>(
            `SELECT "_id"::text AS id FROM ${qualify(v.table.schema, v.table.table)} AS ${quoteIdentifier(ROW_ALIAS)}
              WHERE "_id" = ANY($1::uuid[]) AND ( /*predicat_lignes*/ ${v.read.rowPredicate} )`,
            [ids],
          )
    seen.set(tableId, new Set(rows.map((r) => r.id)))
  }

  // Which deleted rows exist again — a restoration offered for a present row would fail.
  const present = new Set<string>()
  for (const [tableId, v] of visible) {
    const deleted = page.filter((h) => h.table_id === tableId && h.op === 'delete')
    if (deleted.length === 0 || !v.table.isLive) continue
    const rows = await exec.query<{ id: string }>(
      `SELECT "_id"::text AS id FROM ${qualify(v.table.schema, v.table.table)}
        WHERE "_id" = ANY($1::uuid[])`,
      [deleted.map((h) => h.record_id)],
    )
    for (const r of rows) present.add(`${tableId}:${r.id}`)
  }

  const revisions: Revision[] = []
  for (const h of page) {
    const v = visible.get(h.table_id)
    if (v === undefined) continue
    const reached = seen.get(h.table_id)
    if (reached !== undefined && !reached.has(h.record_id)) continue
    const fields = new Map(v.table.fields.map((f) => [f.id, f]))
    const changes: RevisionChange[] = (byRevision.get(h.id) ?? [])
      .filter((d) => v.read.readableFields.has(d.field_id))
      .map((d) => {
        const field = fields.get(d.field_id)
        return {
          fieldId: d.field_id,
          label: field?.label ?? d.field_id,
          kind: d.field_kind,
          name: field?.isLive === true ? field.column : null,
          ...(d.has_before ? { before: d.before_value } : {}),
          ...(d.has_after ? { after: d.after_value } : {}),
          beforeDisplay: d.before_display,
          afterDisplay: d.after_display,
        }
      })
      .sort(
        (a, b) =>
          v.table.fields.findIndex((f) => f.id === a.fieldId) -
          v.table.fields.findIndex((f) => f.id === b.fieldId),
      )

    // §9.2 rule 3: a modification of hidden fields only is not shown at all.
    if (h.op === 'update' && changes.length === 0) continue

    const actions: Array<'revert' | 'restore'> = []
    if (
      h.op === 'update' &&
      v.table.isLive &&
      v.update.verdict === 'ALLOWED' &&
      changes.every((c) => c.name !== null && v.update.writableFields.has(c.fieldId))
    ) {
      actions.push('revert')
    }
    if (
      h.op === 'delete' &&
      v.table.isLive &&
      v.create.verdict === 'ALLOWED' &&
      !present.has(`${h.table_id}:${h.record_id}`)
    ) {
      actions.push('restore')
    }

    revisions.push({
      id: h.id,
      occurredAt: new Date(h.occurred_at).toISOString(),
      op: h.op,
      cascade: h.is_cascade,
      table: { id: v.table.id, name: v.table.table, label: v.table.label },
      recordId: h.record_id,
      recordDisplay: h.record_display,
      actor: {
        kind: h.actor_kind,
        userId: h.actor_user_id,
        name: h.user_name,
        tokenId: h.actor_token_id,
        tokenLabel: h.token_label,
        sqlIdentity: h.sql_identity,
      },
      changes,
      actions,
    })
  }

  const last = page.at(-1)
  return { revisions, nextCursor: more && last !== undefined ? encodeCursor(last) : null }
}

const limitOf = (limit: number | undefined) =>
  Math.min(Math.max(Math.trunc(limit ?? HISTORY_PAGE), 1), HISTORY_PAGE_MAX)

/** The history of one row — its creation, each modification, its deletion. */
export async function recordHistory(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly recordId: string
    readonly cursor?: string
    readonly limit?: number
  },
): Promise<RevisionPage> {
  if (!/^[0-9a-f-]{36}$/i.test(request.recordId)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: request.recordId } })
  }
  // What was written a moment ago is on screen: a read of the history drains first, so a
  // person does not have to wait for the next pass to see their own change (§1.4).
  await drainHistory(pools).catch(() => undefined)

  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      const visible = await visibleTables(exec, ctx, grants, [request.tableId])
      if (!visible.has(request.tableId)) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
      }
      return pageOf(
        exec,
        visible,
        {
          sql: 'r.table_id = $1 AND r.record_id = $2',
          params: [request.tableId, request.recordId],
        },
        request.cursor,
        limitOf(request.limit),
      )
    },
    { readOnly: true },
  )
}

/** The activity of a base — optionally of one of its tables — newest first. */
export async function baseHistory(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly baseId: string
    readonly tableId?: string
    readonly cursor?: string
    readonly limit?: number
  },
): Promise<RevisionPage> {
  await drainHistory(pools).catch(() => undefined)

  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      const tables = await exec.query<{ id: string }>(
        `SELECT id::text FROM _basedb.table_def
          WHERE base_id = $1 AND is_live AND ($2::uuid IS NULL OR id = $2::uuid)`,
        [request.baseId, request.tableId ?? null],
      )
      const visible = await visibleTables(
        exec,
        ctx,
        grants,
        tables.map((t) => t.id),
      )
      // A base whose tables the reader cannot read has no history for them — and says
      // exactly what a base they cannot see would say.
      if (visible.size === 0) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: request.baseId } })
      }
      return pageOf(
        exec,
        visible,
        {
          sql: 'r.base_id = $1 AND r.table_id = ANY($2::uuid[])',
          params: [request.baseId, [...visible.keys()]],
        },
        request.cursor,
        limitOf(request.limit),
      )
    },
    { readOnly: true },
  )
}

/** One deleted row of the deletion journal (07 §6). */
export interface Deletion {
  readonly id: string
  readonly deletedAt: string
  readonly deletedBy: string | null
  readonly cause: 'direct' | 'cascade'
}

/**
 * The rows of a table deleted since an instant, oldest first — the way a consumer that
 * missed events catches up on what disappeared (08 §6.5, 07 §6). Paged by
 * `(deleted_at, id)`, forward.
 */
export async function listDeletions(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly since: string
    readonly cursor?: string
    readonly limit?: number
  },
): Promise<{ readonly deletions: readonly Deletion[]; readonly nextCursor: string | null }> {
  if (Number.isNaN(Date.parse(request.since))) {
    throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'since' } })
  }
  await drainHistory(pools).catch(() => undefined)
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      const target = await loadTarget(exec, ctx, request.tableId)
      const read = target === null ? null : decide(ctx, grants, 'read', target)
      if (read === null || read.verdict !== 'ALLOWED') {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
      }
      // A deleted row has no values left to read a row rule against: a reader under one
      // is told of no deletion rather than of rows they were never shown (05 §16).
      if (read.rowPredicate !== 'TRUE') return { deletions: [], nextCursor: null }
      const after = decodeCursor(request.cursor)
      const limit = limitOf(request.limit)
      const rows = await exec.query<{
        record_id: string
        deleted_at: string
        deleted_by: string | null
        is_cascade: boolean
      }>(
        `SELECT record_id::text, deleted_at::text, deleted_by::text, is_cascade
           FROM _basedb.record_deletion
          WHERE table_id = $1 AND deleted_at >= $2::timestamptz
            AND ($3::timestamptz IS NULL OR (deleted_at, record_id) > ($3::timestamptz, $4::uuid))
          ORDER BY deleted_at, record_id
          LIMIT $5`,
        [request.tableId, request.since, after?.at ?? null, after?.id ?? null, limit + 1],
      )
      const more = rows.length > limit
      const page = more ? rows.slice(0, limit) : rows
      const last = page.at(-1)
      return {
        deletions: page.map((r) => ({
          id: r.record_id,
          deletedAt: new Date(r.deleted_at).toISOString(),
          deletedBy: r.deleted_by,
          cause: r.is_cascade ? ('cascade' as const) : ('direct' as const),
        })),
        nextCursor:
          more && last !== undefined
            ? encodeCursor({ occurred_at: last.deleted_at, id: last.record_id })
            : null,
      }
    },
    { readOnly: true },
  )
}

/** A revision as `loadRevision` finds it. */
export type LoadedRevision = NonNullable<Awaited<ReturnType<typeof loadRevision>>>

/** A revision's header and detail, by its identifier alone. */
export async function loadRevision(exec: Executor, revisionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(revisionId)) return null
  const [header] = await exec.query<{
    id: string
    occurred_at: string
    table_id: string
    record_id: string
    op: RevisionOp
    actor_user_id: string | null
  }>(
    `SELECT id::text, occurred_at::text, table_id::text, record_id::text, op,
            actor_user_id::text
       FROM _basedb.record_revision WHERE id = $1`,
    [revisionId],
  )
  if (header === undefined) return null
  const fields = await exec.query<{
    field_id: string
    before_value: unknown
    after_value: unknown
    has_before: boolean
  }>(
    `SELECT field_id::text, before_value, after_value, before_value IS NOT NULL AS has_before
       FROM _basedb.record_revision_field
      WHERE revision_id = $1 AND occurred_at = $2::timestamptz`,
    [revisionId, header.occurred_at],
  )
  return { header, fields }
}

/**
 * Undoes one modification: its fields go back to the values they had before it.
 *
 * Refused when any of them has changed since (`REVISION_SUPERSEDED`): undoing would then
 * erase a later write that nobody meant to undo. The write is an ordinary one — the
 * reader's rights apply, the database's constraints apply, and the capture records it
 * as a new modification by whoever undid.
 */
export async function revertRevision(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly revisionId: string },
): Promise<{ readonly tableId: string; readonly recordId: string }> {
  await drainHistory(pools).catch(() => undefined)

  return withTransaction(pools, 'data', ctx, async (exec) => {
    const revision = await loadRevision(exec, request.revisionId)
    if (revision === null) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: request.revisionId } })
    }
    return revertIn(exec, ctx, revision)
  })
}

/** The undo of one modification, inside a transaction the caller holds. */
export async function revertIn(
  exec: Executor,
  ctx: RequestContext,
  revision: LoadedRevision,
): Promise<{ readonly tableId: string; readonly recordId: string }> {
  const { header } = revision
  await refuseSynced(exec, ctx, header.table_id)
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, header.table_id)
  const read = target === null ? null : decide(ctx, grants, 'read', target)
  if (target === null || read?.verdict !== 'ALLOWED') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: header.id } })
  }
  if (header.op !== 'update') {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'revision', reason: 'seule_une_modification_s_annule' },
    })
  }
  const update = decide(ctx, grants, 'update', target)
  if (update.verdict !== 'ALLOWED') {
    throw new BasedbError('ADMIN_REQUIRED', {
      details: { table: header.table_id, action: 'update' },
    })
  }

  const table = (await loadHistoryTables(exec, [header.table_id])).get(header.table_id)
  if (table === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: header.id } })
  }
  const fields = new Map(table.fields.map((f) => [f.id, f]))
  const changes = revision.fields.filter((f) => read.readableFields.has(f.field_id))
  for (const change of changes) {
    const field = fields.get(change.field_id)
    if (field === undefined || !field.isLive || !update.writableFields.has(change.field_id)) {
      throw new BasedbError('FIELD_NOT_WRITABLE', { details: { field: change.field_id } })
    }
  }
  if (changes.length === 0) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: header.id } })
  }

  const where = qualify(table.schema, table.table)
  const [current] = await exec.query<{ row: Record<string, unknown> }>(
    // `_t`, not `t`: no physical name starts with `_`, so the whole row can never be
    // mistaken for a column called `t`.
    `SELECT pg_catalog.to_jsonb(_t) AS row FROM ${where} _t
      WHERE "_id" = $1 AND ( /*predicat_lignes*/ ${rowWhere(read.rowPredicate, '_t')} )
        FOR UPDATE`,
    [header.record_id],
  )
  if (current === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: header.record_id } })
  }

  const stale: string[] = []
  const values: Record<string, unknown> = {}
  for (const change of changes) {
    const field = fields.get(change.field_id) as NonNullable<ReturnType<typeof fields.get>>
    const now = current.row[field.column] ?? null
    if (JSON.stringify(now) !== JSON.stringify(change.after_value ?? null)) stale.push(field.column)
    values[field.column] = change.before_value ?? null
  }
  if (stale.length > 0) {
    throw new BasedbError('REVISION_SUPERSEDED', { details: { fields: stale } })
  }

  // `jsonb_populate_record` turns each JSON value back into its column's own type —
  // a list of choices into `text[]`, a date into `date` — exactly as it was captured.
  const assignments = Object.keys(values)
    .map((column) => `${quoteIdentifier(column)} = r.${quoteIdentifier(column)}`)
    .join(', ')
  await exec.query(
    `UPDATE ${where} AS t SET ${assignments}
       FROM pg_catalog.jsonb_populate_record(NULL::${where}, $1::jsonb) r
      WHERE t."_id" = $2`,
    [JSON.stringify(values), header.record_id],
    'update',
  )
  return { tableId: header.table_id, recordId: header.record_id }
}

/**
 * Brings a deleted row back, under its own identifier — chapter 07 §12.1.
 *
 * Its values are the ones its deletion captured; `_created_at` and `_created_by` come
 * from its creation when the journal still has it. A row it pointed to that is gone
 * refuses the restoration before anything is written (`RESTORE_TARGET_MISSING`). The
 * restoration is itself a creation, historised with whoever restored.
 */
export async function restoreRecord(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly revisionId: string },
): Promise<{ readonly tableId: string; readonly recordId: string }> {
  await drainHistory(pools).catch(() => undefined)

  return withTransaction(pools, 'data', ctx, async (exec) => {
    const revision = await loadRevision(exec, request.revisionId)
    if (revision === null) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: request.revisionId } })
    }
    return restoreIn(exec, ctx, revision)
  })
}

/**
 * Brings back a row by its own identifier — its LAST deletion, the one that took it
 * away. What an agent undoes its own mistake with, knowing the `_id` and not a revision.
 */
export async function restoreDeletedRecord(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly recordId: string },
): Promise<{ readonly tableId: string; readonly recordId: string }> {
  await drainHistory(pools).catch(() => undefined)

  return withTransaction(pools, 'data', ctx, async (exec) => {
    const [last] = await exec.query<{ id: string }>(
      `SELECT id::text FROM _basedb.record_revision
        WHERE table_id = $1 AND record_id = $2 AND op = 'delete'
        ORDER BY occurred_at DESC LIMIT 1`,
      [request.tableId, request.recordId],
    )
    const revision = last === undefined ? null : await loadRevision(exec, last.id)
    if (revision === null) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: request.recordId } })
    }
    return restoreIn(exec, ctx, revision)
  })
}

/** The restoration of one deletion, inside a transaction the caller holds. */
export async function restoreIn(
  exec: Executor,
  ctx: RequestContext,
  revision: LoadedRevision,
): Promise<{ readonly tableId: string; readonly recordId: string }> {
  const { header } = revision
  await refuseSynced(exec, ctx, header.table_id)
  const grants = await loadGrants(exec, ctx)
  const target = await loadTarget(exec, ctx, header.table_id)
  if (target === null || decide(ctx, grants, 'read', target).verdict !== 'ALLOWED') {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: header.id } })
  }
  if (header.op !== 'delete') {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'revision', reason: 'seule_une_suppression_se_restaure' },
    })
  }
  const create = decide(ctx, grants, 'create', target)
  if (create.verdict !== 'ALLOWED') {
    throw new BasedbError('ADMIN_REQUIRED', {
      details: { table: header.table_id, action: 'create' },
    })
  }

  const table = (await loadHistoryTables(exec, [header.table_id])).get(header.table_id)
  if (table === undefined || !table.isLive) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { revision: header.id } })
  }
  const where = qualify(table.schema, table.table)
  const [exists] = await exec.query<{ id: string }>(
    `SELECT "_id"::text AS id FROM ${where} WHERE "_id" = $1`,
    [header.record_id],
  )
  if (exists !== undefined) {
    throw new BasedbError('RESTORE_RECORD_PRESENT', { details: { record: header.record_id } })
  }

  const [created] = await exec.query<{ occurred_at: string; actor_user_id: string | null }>(
    `SELECT occurred_at::text, actor_user_id::text FROM _basedb.record_revision
      WHERE table_id = $1 AND record_id = $2 AND op = 'insert'
      ORDER BY occurred_at LIMIT 1`,
    [header.table_id, header.record_id],
  )

  const values: Record<string, unknown> = {
    _id: header.record_id,
    _created_at: created?.occurred_at ?? null,
    _created_by: created?.actor_user_id ?? null,
  }
  const fields = new Map(table.fields.map((f) => [f.id, f]))
  for (const change of revision.fields) {
    const field = fields.get(change.field_id)
    if (field === undefined || !field.isLive || !change.has_before) continue
    values[field.column] = change.before_value
  }
  const columns = Object.keys(values).filter((c) => values[c] !== null || !c.startsWith('_created'))

  try {
    await exec.query(
      `INSERT INTO ${where} (${columns.map((c) => quoteIdentifier(c)).join(', ')})
       SELECT ${columns.map((c) => `r.${quoteIdentifier(c)}`).join(', ')}
         FROM pg_catalog.jsonb_populate_record(NULL::${where}, $1::jsonb) r`,
      [JSON.stringify(values)],
      'insert',
    )
  } catch (error) {
    // A link to a row that is gone: nothing was written, and the refusal says why.
    if (error instanceof BasedbError && error.code === 'LINK_TARGET_NOT_FOUND') {
      throw new BasedbError('RESTORE_TARGET_MISSING', { details: { record: header.record_id } })
    }
    throw error
  }
  // A restoration is a creation: the row must be one its restorer sees (05 §16).
  if (create.rowPredicate !== 'TRUE') {
    const [scope] = await exec.query<{ holds: boolean }>(
      `SELECT ( /*predicat_lignes*/ ${create.rowPredicate} ) AS holds
         FROM ${where} AS ${quoteIdentifier(ROW_ALIAS)} WHERE "_id" = $1`,
      [header.record_id],
    )
    if (scope?.holds !== true) throw new BasedbError('ROW_OUT_OF_SCOPE')
  }
  return { tableId: header.table_id, recordId: header.record_id }
}
