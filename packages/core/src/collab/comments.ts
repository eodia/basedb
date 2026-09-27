import { qualify } from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import { loadHistoryTables } from '../history/catalog.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { requireOnTable } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { wantsNotification } from './notifications.js'
import { canReadTable, contextOf, emitLive } from './signals.js'

/**
 * Comments on a row — chapter 16 §1. Reading the row is enough to read and to write its
 * comments; its author alone edits one, its author or whoever builds the base deletes it.
 * Mentions are read in the text by the kernel, never taken from a list sent beside it.
 */

export const COMMENT_MAX_LENGTH = 10_000
export const MENTIONS_MAX = 20

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MENTION =
  /@\[([^\]\n]{1,100})\]\(user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi

export interface Comment {
  readonly id: string
  readonly recordId: string
  readonly author: { readonly id: string; readonly name: string }
  readonly body: string
  readonly mentions: readonly string[]
  readonly createdAt: string
  readonly editedAt: string | null
  readonly canEdit: boolean
  readonly canDelete: boolean
}

/** The people a text mentions, each once, in their order. */
export function mentionsIn(body: string): string[] {
  const out: string[] = []
  for (const match of body.matchAll(MENTION)) {
    const id = (match[2] as string).toLowerCase()
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** The text as a notification quotes it: a mention by its name, 200 characters at most. */
export function excerptOf(body: string): string {
  const plain = body
    .replace(MENTION, (_, name: string) => `@${name}`)
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length <= 200 ? plain : `${plain.slice(0, 199)}…`
}

function checkedBody(body: unknown): string {
  const text = typeof body === 'string' ? body.trim() : ''
  if (text === '') {
    throw new BasedbError('REQUIRED_VALUE_MISSING', { details: { field: 'body' } })
  }
  if (text.length > COMMENT_MAX_LENGTH) {
    throw new BasedbError('TEXT_TOO_LONG', {
      details: { field: 'body', maximum: COMMENT_MAX_LENGTH },
    })
  }
  if (mentionsIn(text).length > MENTIONS_MAX) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'body', reason: 'trop_de_mentions', maximum: MENTIONS_MAX },
    })
  }
  return text
}

interface Located {
  readonly relation: string
  readonly baseId: string
  readonly tenantUuid: string
}

/** The table's relation and owners, once reading it is established. */
async function locate(exec: Executor, ctx: RequestContext, tableId: string): Promise<Located> {
  await requireOnTable(exec, ctx, 'read', tableId)
  const table = (await loadHistoryTables(exec, [tableId])).get(tableId)
  const [owner] = await exec.query<{ base_id: string; tenant_id: string }>(
    `SELECT b.id::text AS base_id, b.tenant_id::text
       FROM _basedb.table_def t JOIN _basedb.base b ON b.id = t.base_id
      WHERE t.id = $1`,
    [tableId],
  )
  if (table === undefined || owner === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableId } })
  }
  return {
    relation: qualify(table.schema, table.table),
    baseId: owner.base_id,
    tenantUuid: owner.tenant_id,
  }
}

/**
 * Establishes that the row exists for the reader — a comment of a row one cannot read,
 * or of a deleted row, does not exist either.
 */
async function requireRow(
  pools: Pools,
  ctx: RequestContext,
  tableId: string,
  recordId: string,
): Promise<Located> {
  if (!UUID.test(recordId)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: recordId } })
  }
  const located = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => locate(exec, ctx, tableId),
    {
      readOnly: true,
    },
  )
  const rows = await withTransaction(
    pools,
    'data',
    ctx,
    (exec) => exec.query(`SELECT 1 FROM ${located.relation} WHERE "_id" = $1`, [recordId]),
    { readOnly: true },
  )
  if (rows.length === 0) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: recordId } })
  }
  return located
}

interface CommentRow extends Record<string, unknown> {
  readonly id: string
  readonly record_id: string
  readonly author_id: string
  readonly author_name: string
  readonly body: string
  readonly mentions: string[]
  readonly created_at: string
  readonly edited_at: string | null
}

const COMMENT_COLUMNS = `c.id::text, c.record_id::text, c.author_id::text,
       coalesce(nullif(u.display_name, ''), u.email) AS author_name, c.body,
       c.mentions::text[] AS mentions, c.created_at::text, c.edited_at::text`

function shaped(row: CommentRow, ctx: RequestContext, manages: boolean): Comment {
  const mine = row.author_id === ctx.actor.id
  return {
    id: row.id,
    recordId: row.record_id,
    author: { id: row.author_id, name: row.author_name },
    body: row.body,
    mentions: row.mentions,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    canEdit: mine,
    canDelete: mine || manages,
  }
}

async function managesTable(exec: Executor, ctx: RequestContext, tableId: string) {
  const target = await loadTarget(exec, ctx, tableId)
  if (target === null) return false
  return decide(ctx, await loadGrants(exec, ctx), 'manage_schema', target).verdict === 'ALLOWED'
}

/** The comments of a row, oldest first. */
export async function listComments(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly recordId: string },
): Promise<Comment[]> {
  await requireRow(pools, ctx, request.tableId, request.recordId)
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const manages = await managesTable(exec, ctx, request.tableId)
      const rows = await exec.query<CommentRow>(
        `SELECT ${COMMENT_COLUMNS}
           FROM _basedb.record_comment c JOIN _basedb.app_user u ON u.id = c.author_id
          WHERE c.table_id = $1 AND c.record_id = $2
          ORDER BY c.created_at, c.id
          LIMIT 1000`,
        [request.tableId, request.recordId],
      )
      return rows.map((r) => shaped(r, ctx, manages))
    },
    { readOnly: true },
  )
}

/** The mentioned people who are active members of the tenant — anyone else is refused. */
async function checkMentions(exec: Executor, ctx: RequestContext, ids: readonly string[]) {
  if (ids.length === 0) return
  const found = await exec.query<{ id: string }>(
    `SELECT u.id::text FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
      WHERE t.ref = $1 AND u.id = ANY($2::uuid[])
        AND u.deleted_at IS NULL AND u.disabled_at IS NULL`,
    [ctx.tenantId, ids],
  )
  const known = new Set(found.map((r) => r.id))
  const unknown = ids.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'body', reason: 'mention_inconnue', detail: unknown[0] },
    })
  }
}

interface Notice {
  readonly user: string
  readonly kind: 'mention' | 'reply'
}

/**
 * Notifies the people a comment concerns: those it mentions, then those who wrote before
 * in the thread — each once, a mention winning over a reply, never the author, never
 * someone who cannot read the row. Returns the mentioned people left out for that.
 */
async function notify(
  exec: Executor,
  ctx: RequestContext,
  where: Located,
  request: { readonly tableId: string; readonly recordId: string },
  comment: { readonly id: string; readonly body: string },
  mentioned: readonly string[],
  replyTo: readonly string[],
): Promise<string[]> {
  const notices: Notice[] = []
  const unreachable: string[] = []
  const seen = new Set<string>([ctx.actor.id])
  const candidates: Notice[] = [
    ...mentioned.map((user): Notice => ({ user, kind: 'mention' })),
    ...replyTo.map((user): Notice => ({ user, kind: 'reply' })),
  ]
  for (const notice of candidates) {
    if (seen.has(notice.user)) continue
    seen.add(notice.user)
    const reader = contextOf(ctx.tenantId, notice.user, ctx.requestId)
    if (await canReadTable(exec, reader, request.tableId)) notices.push(notice)
    else if (notice.kind === 'mention') unreachable.push(notice.user)
  }
  const excerpt = excerptOf(comment.body)
  for (const notice of notices) {
    // Refused in the person's settings (§2.3): nothing is written, and the mention is not
    // « unreachable » for it — the person can read the row, they chose not to be told.
    if (!(await wantsNotification(exec, notice.user, notice.kind))) continue
    await exec.query(
      `INSERT INTO _basedb.notification
         (tenant_id, user_id, kind, actor_id, base_id, table_id, record_id, comment_id, excerpt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        where.tenantUuid,
        notice.user,
        notice.kind,
        ctx.actor.id,
        where.baseId,
        request.tableId,
        request.recordId,
        comment.id,
        excerpt,
      ],
      'insert',
    )
    await emitLive(exec, { kind: 'notifications', user: notice.user })
  }
  return unreachable
}

/** Adds a comment; `unreachable` names the mentioned people who cannot read the row. */
export async function addComment(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly recordId: string; readonly body: unknown },
): Promise<{ readonly comment: Comment; readonly unreachable: readonly string[] }> {
  const body = checkedBody(request.body)
  const mentioned = mentionsIn(body)
  const where = await requireRow(pools, ctx, request.tableId, request.recordId)
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await checkMentions(exec, ctx, mentioned)
    const earlier = await exec.query<{ author_id: string }>(
      `SELECT author_id::text FROM _basedb.record_comment
        WHERE table_id = $1 AND record_id = $2
        GROUP BY author_id ORDER BY min(created_at)`,
      [request.tableId, request.recordId],
    )
    const [inserted] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.record_comment
         (tenant_id, base_id, table_id, record_id, author_id, body, mentions)
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[])
       RETURNING id::text`,
      [
        where.tenantUuid,
        where.baseId,
        request.tableId,
        request.recordId,
        ctx.actor.id,
        body,
        mentioned,
      ],
      'insert',
    )
    const id = (inserted as { id: string }).id
    const unreachable = await notify(
      exec,
      ctx,
      where,
      request,
      { id, body },
      mentioned,
      earlier.map((r) => r.author_id),
    )
    await emitLive(exec, {
      kind: 'comments',
      base: where.baseId,
      table: request.tableId,
      record: request.recordId,
    })
    const [row] = await exec.query<CommentRow>(
      `SELECT ${COMMENT_COLUMNS}
         FROM _basedb.record_comment c JOIN _basedb.app_user u ON u.id = c.author_id
        WHERE c.id = $1`,
      [id],
    )
    const manages = await managesTable(exec, ctx, request.tableId)
    return { comment: shaped(row as CommentRow, ctx, manages), unreachable }
  })
}

/** The comment, in the caller's tenant; absent and foreign read the same. */
async function loadComment(exec: Executor, ctx: RequestContext, commentId: string) {
  if (!UUID.test(commentId)) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { comment: commentId } })
  }
  const [row] = await exec.query<{
    table_id: string
    record_id: string
    author_id: string
    mentions: string[]
  }>(
    `SELECT c.table_id::text, c.record_id::text, c.author_id::text, c.mentions::text[] AS mentions
       FROM _basedb.record_comment c JOIN _basedb.tenant t ON t.id = c.tenant_id
      WHERE c.id = $1 AND t.ref = $2`,
    [commentId, ctx.tenantId],
  )
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { comment: commentId } })
  }
  return row
}

/** Rewrites a comment's text — its author's alone. New mentions are notified. */
export async function editComment(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly commentId: string; readonly body: unknown },
): Promise<Comment> {
  const body = checkedBody(request.body)
  const mentioned = mentionsIn(body)
  const found = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => loadComment(exec, ctx, request.commentId),
    { readOnly: true },
  )
  const where = await requireRow(pools, ctx, found.table_id, found.record_id)
  if (found.author_id !== ctx.actor.id) {
    throw new BasedbError('ACTION_FORBIDDEN', {
      details: { comment: request.commentId, reason: 'auteur_seul' },
    })
  }
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await checkMentions(exec, ctx, mentioned)
    await exec.query(
      `UPDATE _basedb.record_comment
          SET body = $2, mentions = $3::uuid[], edited_at = pg_catalog.clock_timestamp()
        WHERE id = $1`,
      [request.commentId, body, mentioned],
      'update',
    )
    const added = mentioned.filter((id) => !found.mentions.includes(id))
    await notify(
      exec,
      ctx,
      where,
      { tableId: found.table_id, recordId: found.record_id },
      { id: request.commentId, body },
      added,
      [],
    )
    await emitLive(exec, {
      kind: 'comments',
      base: where.baseId,
      table: found.table_id,
      record: found.record_id,
    })
    const [row] = await exec.query<CommentRow>(
      `SELECT ${COMMENT_COLUMNS}
         FROM _basedb.record_comment c JOIN _basedb.app_user u ON u.id = c.author_id
        WHERE c.id = $1`,
      [request.commentId],
    )
    return shaped(row as CommentRow, ctx, await managesTable(exec, ctx, found.table_id))
  })
}

/** Deletes a comment — its author, or whoever builds the base. */
export async function deleteComment(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly commentId: string },
): Promise<void> {
  const found = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) => loadComment(exec, ctx, request.commentId),
    { readOnly: true },
  )
  const where = await requireRow(pools, ctx, found.table_id, found.record_id)
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    if (found.author_id !== ctx.actor.id && !(await managesTable(exec, ctx, found.table_id))) {
      throw new BasedbError('ACTION_FORBIDDEN', {
        details: { comment: request.commentId, reason: 'auteur_seul' },
      })
    }
    await exec.query(
      'DELETE FROM _basedb.record_comment WHERE id = $1',
      [request.commentId],
      'delete',
    )
    await emitLive(exec, {
      kind: 'comments',
      base: where.baseId,
      table: found.table_id,
      record: found.record_id,
    })
  })
}
