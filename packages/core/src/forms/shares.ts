import { createHash, randomBytes } from 'node:crypto'
import { type FormCondition, isEmptyAnswer, visibleQuestions } from '@basedb/contracts'
import { writeAudit } from '../audit/journal.js'
import { seal, unseal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import { requireOnTable } from '../rbac/require.js'
import { createRecordFor } from '../records/create.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'

/**
 * Shared forms — chapter 15.
 *
 * A form or a survey (a view, chapter 11 §1.6) asks for a row; SHARING it lets someone
 * answer who holds no right on the table: anyone with the link when it is PUBLIC, any
 * signed-in member of the tenant — or of chosen groups — when it is for MEMBERS.
 *
 * The answer is written on the authority of the person who PUBLISHED the share, and of
 * nobody else: their right to create rows in the table is decided again at every answer,
 * narrowed to the form's questions, so a publisher who lost the right — or left — closes
 * their forms with it. Who answered is what the history says: the person, when signed in;
 * the form itself, when public — never the publisher as if they had typed it.
 *
 * The link is a bearer secret. The catalog keeps its hash, to find it, and the secret
 * sealed with the instance key, to show it again to whoever shares — never the secret in
 * clear.
 */

export type ShareAccess = 'public' | 'members'

/** Why a share does not take answers — or `open` when it does. */
export type ShareState = 'open' | 'inactive' | 'closed' | 'full' | 'authority'

export interface FormShare {
  readonly id: string
  readonly viewId: string
  readonly access: ShareAccess
  readonly active: boolean
  /** The secret of the link: the page is `/f/<token>`. */
  readonly token: string
  readonly closesAt: string | null
  readonly maxResponses: number | null
  readonly responseCount: number
  readonly lastResponseAt: string | null
  readonly publishedBy: { readonly id: string; readonly name: string | null }
  /** The groups a members' share is reserved to — none: every member. */
  readonly groupIds: readonly string[]
  readonly state: ShareState
  /** The page may be framed by another site (chapter 15 §10). */
  readonly canEmbed: boolean
  /** A form or a survey is answered; any other view is read (chapter 15 §10). */
  readonly viewKind: string
}

export interface FormSharing {
  readonly share: FormShare | null
  /** The tenant's groups, to reserve a members' share to some of them. */
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
  /** Questions of the form a shared link does not ask, and why. */
  readonly omitted: ReadonlyArray<{ readonly field: string; readonly reason: string }>
}

export interface SharedQuestion {
  /** The field's physical name: the key of its value in the answer. */
  readonly name: string
  readonly label: string
  readonly help: string | null
  readonly kind: string
  readonly required: boolean
  readonly options: ReadonlyArray<{
    readonly value: string
    readonly label: string
    readonly color: string | null
    readonly icon: string | null
    readonly image: string | null
  }> | null
  /** An example of an answer, shown in the empty input. */
  readonly placeholder: string | null
  /** Asked only when an earlier answer says so. */
  readonly showIf: FormCondition | null
  /** How a number or a text reads: a rating in stars, an amount, a phone number. */
  readonly format: {
    readonly display: string
    readonly ratingMax: number | null
    readonly currency: string | null
  } | null
}

/** How a shared form looks and moves: what its author chose, or the defaults. */
export interface SharedFormDesign {
  readonly theme: string
  /** `#rrggbb`: the form's own, else its table's; `null` for neither. */
  readonly accent: string | null
  readonly font: string
  readonly align: string
  readonly welcomeLabel: string
  readonly showProgress: boolean
  readonly showNumbers: boolean
  readonly autoAdvance: boolean
  readonly celebrate: boolean
  readonly endLink: { readonly label: string; readonly url: string } | null
}

/** A shared form as the person answering it sees it — nothing of the table beyond it. */
export interface SharedForm {
  readonly kind: 'form' | 'survey'
  readonly title: string
  readonly description: string
  readonly submitLabel: string
  readonly successMessage: string
  readonly allowAnother: boolean
  readonly access: ShareAccess
  /** Who answers, when signed in: « Vous répondez en tant que … ». */
  readonly respondent: string | null
  readonly questions: readonly SharedQuestion[]
  readonly design: SharedFormDesign
}

/** What a shared link asks. A relation would read another table; a file, deposit one. */
const SHAREABLE_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'url',
  'email',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
])

const OMITTED_REASON: Readonly<Record<string, string>> = {
  link: 'Relation : y répondre lirait une autre table.',
  file: 'Document : le dépôt de fichiers n’est pas ouvert aux formulaires partagés.',
  image: 'Image : le dépôt de fichiers n’est pas ouvert aux formulaires partagés.',
}

const SEAL_PURPOSE = 'form-share'
/** The budget of an answer: one catalog read, one insert. */
const ANSWER_TIMEOUT_MS = 30_000

const hashOf = (token: string) => createHash('sha256').update(token).digest()

/** A fresh link secret: 24 random bytes, base64url — 32 characters, URL-safe. */
function newToken(): string {
  return randomBytes(24).toString('base64url')
}

interface ShareRow extends Record<string, unknown> {
  readonly id: string
  readonly tenant_ref: string
  readonly view_id: string
  readonly table_id: string
  readonly base_id: string
  readonly access: ShareAccess
  readonly token_sealed: string
  readonly is_active: boolean
  readonly closes_at: Date | null
  readonly max_responses: number | null
  readonly response_count: number
  readonly last_response_at: Date | null
  readonly published_by: string
  readonly publisher_name: string | null
  readonly publisher_live: boolean
  readonly view_kind: string
  readonly view_label: string
  readonly view_spec: Record<string, unknown>
  readonly view_live: boolean
  readonly table_live: boolean
  readonly group_ids: string[]
  readonly can_embed: boolean
  readonly view_description: string | null
  readonly table_color: string | null
}

const SHARE_SELECT = `
  SELECT s.id, te.ref AS tenant_ref, s.view_id, s.table_id, t.base_id, s.access,
         s.token_sealed, s.is_active, s.closes_at, s.max_responses, s.response_count,
         s.last_response_at, s.published_by, u.display_name AS publisher_name,
         (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS publisher_live,
         v.kind AS view_kind, v.label AS view_label, v.spec AS view_spec,
         v.description AS view_description, s.can_embed, t.color AS table_color,
         v.deleted_at IS NULL AS view_live, (t.is_live AND t.deleted_at IS NULL) AS table_live,
         coalesce((SELECT array_agg(r.role_id::text ORDER BY r.role_id)
                     FROM _basedb.form_share_role r WHERE r.share_id = s.id), '{}') AS group_ids
    FROM _basedb.form_share s
    JOIN _basedb.tenant te    ON te.id = s.tenant_id
    JOIN _basedb.view_def v   ON v.id = s.view_id
    JOIN _basedb.table_def t  ON t.id = s.table_id
    JOIN _basedb.app_user u   ON u.id = s.published_by`

/** The publisher's context: the authority the answers are written on. */
function authorityOf(row: ShareRow, requestId: string): RequestContext {
  const now = new Date()
  return sealContext({
    requestId,
    actor: { kind: 'user', id: row.published_by },
    tenantId: row.tenant_ref,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + ANSWER_TIMEOUT_MS),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

interface FieldLine extends Record<string, unknown> {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly kind: string
  readonly is_required: boolean
  /** A number's or a short text's reading — `rating`, `currency`, `phone`… */
  readonly display_format: string | null
  readonly rating_max: number | null
  readonly currency_code: string | null
}

/**
 * The questions a shared link asks: those of the view, whose field is live, of a kind a
 * link may ask, and writable by the publisher — and, beside them, those it leaves out.
 */
async function questionsOf(
  exec: Executor,
  row: Pick<ShareRow, 'table_id' | 'view_spec'>,
  writable: ReadonlySet<string> | null,
): Promise<{
  readonly questions: readonly SharedQuestion[]
  readonly omitted: FormSharing['omitted']
}> {
  const fields = await exec.query<FieldLine>(
    `SELECT f.id::text, n.name, f.label, f.description, f.kind, f.is_required,
            coalesce(nc.display_format, tc.display_format) AS display_format,
            nc.rating_max, nc.currency_code
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
       LEFT JOIN _basedb.field_number_config nc ON nc.field_id = f.id
       LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL`,
    [row.table_id],
  )
  const byName = new Map(fields.map((f) => [f.name, f]))
  const options = await exec.query<{
    field_id: string
    value: string
    label: string
    color: string | null
    icon: string | null
    image: string | null
  }>(
    `SELECT o.field_id::text, o.value, o.label, o.color, o.icon, o.image
       FROM _basedb.select_option o
       JOIN _basedb.field f ON f.id = o.field_id
      WHERE f.table_id = $1 AND o.deleted_at IS NULL
      ORDER BY o.position`,
    [row.table_id],
  )

  const asked = Array.isArray(row.view_spec.fields)
    ? (row.view_spec.fields as Array<Record<string, unknown>>)
    : []
  const questions: SharedQuestion[] = []
  const omitted: Array<{ field: string; reason: string }> = []
  for (const entry of asked) {
    const field = typeof entry.field === 'string' ? byName.get(entry.field) : undefined
    if (field === undefined) continue
    const label =
      typeof entry.label === 'string' && entry.label.trim() !== '' ? entry.label : field.label
    if (!SHAREABLE_KINDS.has(field.kind)) {
      omitted.push({ field: label, reason: OMITTED_REASON[field.kind] ?? 'Non posée.' })
      continue
    }
    if (writable !== null && !writable.has(field.id)) {
      omitted.push({ field: label, reason: 'Non modifiable pour la personne qui a publié.' })
      continue
    }
    const help =
      typeof entry.help === 'string' && entry.help.trim() !== ''
        ? entry.help
        : field.description !== null && field.description.trim() !== ''
          ? field.description
          : null
    questions.push({
      name: field.name,
      label,
      help,
      kind: field.kind,
      required: entry.required === true || field.is_required,
      placeholder:
        typeof entry.placeholder === 'string' && entry.placeholder.trim() !== ''
          ? entry.placeholder
          : null,
      showIf: conditionOf(entry.show_if),
      format:
        field.display_format === null ||
        field.display_format === 'plain' ||
        field.display_format === 'decimal'
          ? null
          : {
              display: field.display_format,
              ratingMax: field.rating_max,
              currency: field.currency_code,
            },
      options:
        field.kind === 'select' || field.kind === 'multi_select'
          ? options
              .filter((o) => o.field_id === field.id)
              .map((o) => ({
                value: o.value,
                label: o.label,
                color: o.color,
                icon: o.icon,
                image: o.image,
              }))
          : null,
    })
  }
  return { questions, omitted }
}

/** A condition as the spec keeps it — the kernel validated it when the view was saved. */
function conditionOf(raw: unknown): FormCondition | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { field, op, value } = raw as Record<string, unknown>
  if (typeof field !== 'string' || typeof op !== 'string') return null
  return {
    field,
    op: op as FormCondition['op'],
    value:
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : null,
  }
}

/** The look of a shared form: its spec's choices, the defaults for what it leaves out. */
function designOf(spec: Readonly<Record<string, unknown>>, tableColor: string | null) {
  const text = (key: string) => (typeof spec[key] === 'string' ? (spec[key] as string) : '')
  const flag = (key: string) => spec[key] !== false
  const accent = text('accent')
  const endUrl = text('end_link_url')
  return {
    theme: text('theme') === '' ? 'clair' : text('theme'),
    accent: accent !== '' ? accent : tableColor,
    font: text('font') === '' ? 'auto' : text('font'),
    align: text('align') === '' ? 'left' : text('align'),
    welcomeLabel: text('welcome_label'),
    showProgress: flag('show_progress'),
    showNumbers: flag('show_numbers'),
    autoAdvance: flag('auto_advance'),
    celebrate: flag('celebrate'),
    endLink: endUrl === '' ? null : { label: text('end_link_label'), url: endUrl },
  } satisfies SharedFormDesign
}

/** A form or a survey is answered; every other view is read (chapter 15 §10). */
export const isAnswered = (kind: string) => kind === 'form' || kind === 'survey'

/**
 * May the publisher still do what the share does here — create rows for a form, read them
 * for a data view? And which fields may they write, or read?
 */
async function authorityOver(
  exec: Executor,
  row: ShareRow,
  requestId: string,
): Promise<{
  readonly allowed: boolean
  readonly writable: ReadonlySet<string>
  readonly readable: ReadonlySet<string>
}> {
  const none = { allowed: false, writable: new Set<string>(), readable: new Set<string>() }
  if (!row.publisher_live) return none
  const authority = authorityOf(row, requestId)
  const target = await loadTarget(exec, authority, row.table_id)
  if (target === null) return none
  const action = isAnswered(row.view_kind) ? 'create' : 'read'
  const decision = decide(authority, await loadGrants(exec, authority), action, target)
  return {
    allowed: decision.verdict === 'ALLOWED',
    writable: decision.writableFields,
    readable: decision.readableFields,
  }
}

function stateOf(row: ShareRow, allowed: boolean, now: Date): ShareState {
  if (!row.is_active) return 'inactive'
  if (row.closes_at !== null && new Date(row.closes_at).getTime() <= now.getTime()) {
    return 'closed'
  }
  if (row.max_responses !== null && row.response_count >= row.max_responses) return 'full'
  if (!allowed) return 'authority'
  return 'open'
}

function toShare(row: ShareRow, instanceKey: string, state: ShareState): FormShare {
  const token = unseal(instanceKey, SEAL_PURPOSE, row.token_sealed)
  if (token === null) {
    // A share sealed under another instance key: it cannot be shown, and must be
    // regenerated — said by an empty token rather than by a crash of the dialog.
    return { ...toShareFields(row, state), token: '' }
  }
  return { ...toShareFields(row, state), token }
}

function toShareFields(row: ShareRow, state: ShareState): Omit<FormShare, 'token'> {
  return {
    id: row.id,
    viewId: row.view_id,
    access: row.access,
    active: row.is_active,
    closesAt: row.closes_at === null ? null : new Date(row.closes_at).toISOString(),
    maxResponses: row.max_responses,
    responseCount: row.response_count,
    lastResponseAt:
      row.last_response_at === null ? null : new Date(row.last_response_at).toISOString(),
    publishedBy: { id: row.published_by, name: row.publisher_name },
    groupIds: row.group_ids,
    state,
    canEmbed: row.can_embed,
    viewKind: row.view_kind,
  }
}

/**
 * The view of a table a share may carry: a form or a survey, to answer; any other view,
 * to read (chapter 15 §10). A personal view is its owner's alone: it is not shared.
 */
async function formView(
  exec: Executor,
  tableId: string,
  viewId: string,
): Promise<{
  readonly kind: string
  readonly label: string
  readonly spec: Record<string, unknown>
}> {
  const [view] = await exec.query<{
    kind: string
    label: string
    spec: Record<string, unknown>
    owner_id: string | null
  }>(
    `SELECT kind, label, spec, owner_id::text FROM _basedb.view_def
      WHERE id::text = $1 AND table_id = $2 AND deleted_at IS NULL`,
    [viewId, tableId],
  )
  if (view === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: viewId } })
  if (view.owner_id !== null) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'view', reason: 'vue_personnelle' },
    })
  }
  return view
}

async function sharingOf(
  exec: Executor,
  ctx: RequestContext,
  instanceKey: string,
  tableId: string,
  viewId: string,
): Promise<FormSharing> {
  const view = await formView(exec, tableId, viewId)
  const groups = await exec.query<{ id: string; label: string }>(
    `SELECT r.id::text, r.label FROM _basedb.role r
       JOIN _basedb.tenant t ON t.id = r.tenant_id
      WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
      ORDER BY r.label`,
    [ctx.tenantId],
  )
  const [row] = await exec.query<ShareRow>(`${SHARE_SELECT} WHERE s.view_id::text = $1`, [viewId])
  // A data view asks no question: nothing is omitted from it.
  const answered = isAnswered(view.kind)
  if (row === undefined) {
    const { omitted } = answered
      ? await questionsOf(exec, { table_id: tableId, view_spec: view.spec }, null)
      : { omitted: [] }
    return { share: null, groups, omitted }
  }
  const authority = await authorityOver(exec, row, ctx.requestId)
  const { omitted } = answered ? await questionsOf(exec, row, authority.writable) : { omitted: [] }
  return {
    share: toShare(row, instanceKey, stateOf(row, authority.allowed, ctx.timestamp)),
    groups,
    omitted,
  }
}

/** The sharing of a form view: its link and settings, or none. `manage_schema`. */
export async function getFormSharing(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly tableId: string; readonly viewId: string },
): Promise<FormSharing> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
      return sharingOf(exec, ctx, instanceKey, request.tableId, request.viewId)
    },
    { readOnly: true },
  )
}

export interface ShareSettings {
  readonly access: ShareAccess
  readonly active: boolean
  readonly closesAt: string | null
  readonly maxResponses: number | null
  readonly groupIds: readonly string[]
  /** Another site may frame the page (chapter 15 §10). */
  readonly canEmbed?: boolean
}

function checkSettings(raw: ShareSettings): ShareSettings {
  if (raw.access !== 'public' && raw.access !== 'members') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'access' } })
  }
  if (typeof raw.active !== 'boolean') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'active' } })
  }
  if (raw.closesAt !== null && Number.isNaN(Date.parse(raw.closesAt))) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'closes_at' } })
  }
  if (
    raw.maxResponses !== null &&
    (!Number.isInteger(raw.maxResponses) || raw.maxResponses < 1 || raw.maxResponses > 1_000_000)
  ) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'max_responses' } })
  }
  if (!Array.isArray(raw.groupIds) || raw.groupIds.some((g) => typeof g !== 'string')) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'groups' } })
  }
  if (raw.canEmbed !== undefined && typeof raw.canEmbed !== 'boolean') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'can_embed' } })
  }
  // Groups reserve a members' share; a public one is open to anyone, and keeps none.
  return { ...raw, groupIds: raw.access === 'public' ? [] : [...new Set(raw.groupIds)] }
}

/**
 * Shares a form view, or changes how it is shared. Whoever saves becomes its publisher:
 * the answers are written on THEIR authority from then on. `manage_schema` on the table.
 */
export async function saveFormSharing(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly tableId: string; readonly viewId: string } & ShareSettings,
): Promise<FormSharing> {
  const checked = checkSettings(request)
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const view = await formView(exec, request.tableId, request.viewId)
    // A closing date and a ceiling count answers: a data view takes none.
    const settings = isAnswered(view.kind)
      ? checked
      : { ...checked, closesAt: null, maxResponses: null }
    const canEmbed = settings.canEmbed === true
    if (settings.groupIds.length > 0) {
      const known = await exec.query<{ id: string }>(
        `SELECT r.id::text FROM _basedb.role r JOIN _basedb.tenant t ON t.id = r.tenant_id
          WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
            AND r.id::text = ANY($2::text[])`,
        [ctx.tenantId, settings.groupIds],
      )
      if (known.length !== settings.groupIds.length) {
        throw new BasedbError('REQUEST_INVALID', { details: { field: 'groups' } })
      }
    }

    const [existing] = await exec.query<{ id: string }>(
      'SELECT id::text FROM _basedb.form_share WHERE view_id::text = $1',
      [request.viewId],
    )
    let shareId: string
    if (existing === undefined) {
      const token = newToken()
      const [created] = await exec.query<{ id: string }>(
        `INSERT INTO _basedb.form_share
           (tenant_id, view_id, table_id, access, token_hash, token_sealed, is_active,
            closes_at, max_responses, published_by, created_by, can_embed)
         SELECT t.id, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::timestamptz, $9, $10, $10, $11
           FROM _basedb.tenant t WHERE t.ref = $1
         RETURNING id::text`,
        [
          ctx.tenantId,
          request.viewId,
          request.tableId,
          settings.access,
          hashOf(token),
          seal(instanceKey, SEAL_PURPOSE, token),
          settings.active,
          settings.closesAt,
          settings.maxResponses,
          ctx.actor.id,
          canEmbed,
        ],
        'insert',
      )
      if (created === undefined) throw new BasedbError('RESOURCE_NOT_FOUND')
      shareId = created.id
    } else {
      shareId = existing.id
      await exec.query(
        `UPDATE _basedb.form_share
            SET access = $2, is_active = $3, closes_at = $4::timestamptz, max_responses = $5,
                published_by = $6, can_embed = $7, updated_at = clock_timestamp()
          WHERE id = $1::uuid`,
        [
          shareId,
          settings.access,
          settings.active,
          settings.closesAt,
          settings.maxResponses,
          ctx.actor.id,
          canEmbed,
        ],
        'update',
      )
    }
    await exec.query(
      'DELETE FROM _basedb.form_share_role WHERE share_id = $1::uuid',
      [shareId],
      'delete',
    )
    for (const roleId of settings.groupIds) {
      await exec.query(
        'INSERT INTO _basedb.form_share_role (share_id, role_id) VALUES ($1::uuid, $2::uuid)',
        [shareId, roleId],
        'insert',
      )
    }
    await writeAudit(exec, ctx, {
      action: existing === undefined ? 'form_share.create' : 'form_share.update',
      objectKind: 'view',
      objectId: request.viewId,
      objectName: view.label,
      tableId: request.tableId,
      payload: {
        access: settings.access,
        active: settings.active,
        closes_at: settings.closesAt,
        max_responses: settings.maxResponses,
        groups: settings.groupIds,
        can_embed: canEmbed,
      },
    })
    return sharingOf(exec, ctx, instanceKey, request.tableId, request.viewId)
  })
}

/** A new link for a shared form: the old one stops working at once. */
export async function regenerateFormShare(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly tableId: string; readonly viewId: string },
): Promise<FormSharing> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const view = await formView(exec, request.tableId, request.viewId)
    const token = newToken()
    const updated = await exec.query<{ id: string }>(
      `UPDATE _basedb.form_share
          SET token_hash = $2, token_sealed = $3, published_by = $4,
              updated_at = clock_timestamp()
        WHERE view_id::text = $1
        RETURNING id::text`,
      [request.viewId, hashOf(token), seal(instanceKey, SEAL_PURPOSE, token), ctx.actor.id],
      'update',
    )
    if (updated.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { share: request.viewId } })
    }
    await writeAudit(exec, ctx, {
      action: 'form_share.regenerate',
      objectKind: 'view',
      objectId: request.viewId,
      objectName: view.label,
      tableId: request.tableId,
    })
    return sharingOf(exec, ctx, instanceKey, request.tableId, request.viewId)
  })
}

/** Stops sharing a form: the link is forgotten, and the answers already given stay. */
export async function deleteFormShare(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly viewId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const view = await formView(exec, request.tableId, request.viewId)
    await exec.query(
      'DELETE FROM _basedb.form_share WHERE view_id::text = $1',
      [request.viewId],
      'delete',
    )
    await writeAudit(exec, ctx, {
      action: 'form_share.delete',
      objectKind: 'view',
      objectId: request.viewId,
      objectName: view.label,
      tableId: request.tableId,
    })
  })
}

// ── Answering ─────────────────────────────────────────────────────────────────

/**
 * Who may answer this share, and on whose authority: the whole door, checked in one
 * place for the page and for the answer alike.
 */
async function admit(
  exec: Executor,
  token: string,
  respondent: RequestContext | null,
  requestId: string,
  now: Date,
  /** What the door is for: answering a form, or reading a data view. */
  purpose: 'answer' | 'read' = 'answer',
): Promise<{
  readonly row: ShareRow
  readonly writable: ReadonlySet<string>
  readonly readable: ReadonlySet<string>
  readonly respondentName: string | null
}> {
  const [row] = await exec.query<ShareRow>(`${SHARE_SELECT} WHERE s.token_hash = $1`, [
    hashOf(token),
  ])
  // An unknown link, a deleted view or a deleted table: nothing is there. Nor is a form
  // opened as a view, or a view opened as a form.
  if (
    row === undefined ||
    !row.view_live ||
    !row.table_live ||
    isAnswered(row.view_kind) !== (purpose === 'answer')
  ) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { share: 'inconnu' } })
  }

  // A closed share says so before it asks anyone to sign in: signing in would not open it.
  const authority = await authorityOver(exec, row, requestId)
  const state = stateOf(row, authority.allowed, now)
  if (state !== 'open') {
    throw new BasedbError(purpose === 'answer' ? 'FORM_CLOSED' : 'VIEW_SHARE_CLOSED', {
      details: { reason: state },
    })
  }

  let respondentName: string | null = null
  if (row.access === 'members') {
    if (respondent === null || respondent.actor.kind !== 'user') {
      throw new BasedbError('AUTHENTICATION_REQUIRED', { details: { form: 'membres' } })
    }
    // A member of another tenant finds nothing here, as anywhere else.
    if (respondent.tenantId !== row.tenant_ref) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { form: 'inconnu' } })
    }
    const [person] = await exec.query<{ display_name: string | null; member: boolean }>(
      `SELECT u.display_name,
              (cardinality($2::text[]) = 0 OR EXISTS (
                 SELECT 1 FROM _basedb.role_member m
                  WHERE m.user_id = u.id AND m.role_id::text = ANY($2::text[]))) AS member
         FROM _basedb.app_user u WHERE u.id = $1`,
      [respondent.actor.id, row.group_ids],
    )
    if (person === undefined) throw new BasedbError('AUTHENTICATION_REQUIRED')
    if (!person.member) {
      throw new BasedbError(purpose === 'answer' ? 'FORM_RESTRICTED' : 'VIEW_SHARE_RESTRICTED')
    }
    respondentName = person.display_name
  }
  return { row, writable: authority.writable, readable: authority.readable, respondentName }
}

/** A shared data view, admitted: what may be read, and on whose authority (§10). */
export interface AdmittedView {
  readonly authority: RequestContext
  readonly tableId: string
  readonly baseId: string
  readonly kind: string
  readonly label: string
  readonly description: string | null
  readonly spec: Record<string, unknown>
  /** The publisher's readable fields, by catalog key. */
  readonly readable: ReadonlySet<string>
  readonly canEmbed: boolean
  readonly access: ShareAccess
  readonly reader: string | null
}

/**
 * Opens the door of a shared data view — chapter 15 §10: the link, its state, the reader
 * for a members' share, and the publisher's authority, decided again at every read.
 */
export async function admitSharedView(
  pools: Pools,
  request: {
    readonly token: string
    readonly reader: RequestContext | null
    readonly requestId: string
  },
): Promise<AdmittedView> {
  return pools.withConnection('catalog', async (exec) => {
    const { row, readable, respondentName } = await admit(
      exec,
      request.token,
      request.reader,
      request.requestId,
      new Date(),
      'read',
    )
    return {
      authority: authorityOf(row, request.requestId),
      tableId: row.table_id,
      baseId: row.base_id,
      kind: row.view_kind,
      label: row.view_label,
      description: row.view_description,
      spec: row.view_spec,
      readable,
      canEmbed: row.can_embed,
      access: row.access,
      reader: respondentName,
    }
  })
}

/** Opens a shared form: what the page shows. No right on the table is needed. */
export async function openSharedForm(
  pools: Pools,
  request: {
    readonly token: string
    readonly respondent: RequestContext | null
    readonly requestId: string
  },
): Promise<SharedForm> {
  return pools.withConnection('catalog', async (exec) => {
    const { row, writable, respondentName } = await admit(
      exec,
      request.token,
      request.respondent,
      request.requestId,
      new Date(),
    )
    const { questions } = await questionsOf(exec, row, writable)
    if (questions.length === 0) {
      throw new BasedbError('FORM_CLOSED', { details: { reason: 'sans_question' } })
    }
    const spec = row.view_spec
    const text = (key: string) => (typeof spec[key] === 'string' ? (spec[key] as string) : '')
    return {
      kind: row.view_kind === 'survey' ? 'survey' : 'form',
      title: text('title').trim() === '' ? row.view_label : text('title'),
      description: text('description'),
      submitLabel: text('submit_label'),
      successMessage: text('success_message'),
      allowAnother: spec.allow_another !== false,
      access: row.access,
      respondent: respondentName,
      questions,
      design: designOf(spec, row.table_color),
    }
  })
}

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0)

/**
 * Answers a shared form: ONE row, written on the publisher's authority, as the person
 * who answered — or as the form, when it is public.
 *
 * A place is taken among `max_responses` BEFORE the row is written, and given back if the
 * row is refused: two answers arriving together cannot both take the last place.
 */
export async function submitSharedForm(
  pools: Pools,
  request: {
    readonly token: string
    readonly respondent: RequestContext | null
    readonly requestId: string
    readonly values: Readonly<Record<string, unknown>>
  },
): Promise<{ readonly received: true }> {
  if (
    typeof request.values !== 'object' ||
    request.values === null ||
    Array.isArray(request.values)
  ) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'values' } })
  }
  const now = new Date()
  const admitted = await pools.withConnection('catalog', async (exec) => {
    const found = await admit(exec, request.token, request.respondent, request.requestId, now)
    const { questions } = await questionsOf(exec, found.row, found.writable)
    return { ...found, questions }
  })
  const { row, questions } = admitted

  const asked = new Set(questions.map((q) => q.name))
  const unknown = Object.keys(request.values).find((name) => !asked.has(name))
  if (unknown !== undefined) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: unknown, reason: 'question_inconnue' },
    })
  }
  // What the person saw: a question an earlier answer hid is neither required nor written,
  // whatever was typed into it before it was hidden.
  const shown = new Set(
    visibleQuestions(
      questions.map((q) => ({ field: q.name, show_if: q.showIf })),
      request.values,
    ).map((q) => q.field),
  )
  const lacking = questions.find(
    (q) => shown.has(q.name) && q.required && isEmptyAnswer(request.values[q.name]),
  )
  if (lacking !== undefined) {
    throw new BasedbError('REQUIRED_VALUE_MISSING', { details: { field: lacking.name } })
  }
  const values = Object.fromEntries(
    Object.entries(request.values).filter(([name, value]) => shown.has(name) && !isEmpty(value)),
  )
  if (Object.keys(values).length === 0) {
    throw new BasedbError('REQUIRED_VALUE_MISSING', { details: { reason: 'reponse_vide' } })
  }

  const authority = authorityOf(row, request.requestId)
  const writer =
    row.access === 'members' && request.respondent !== null
      ? request.respondent
      : sealContext({
          requestId: request.requestId,
          actor: { kind: 'form', id: row.published_by, tokenId: row.id },
          tenantId: row.tenant_ref,
          surface: 'rest',
          timestamp: now,
          deadline: new Date(now.getTime() + ANSWER_TIMEOUT_MS),
          permissions: { version: '1', rowPredicate: 'TRUE' },
        })

  const taken = await withTransaction(pools, 'catalog', authority, (exec) =>
    exec.query<{ id: string }>(
      `UPDATE _basedb.form_share
          SET response_count = response_count + 1, last_response_at = clock_timestamp()
        WHERE id = $1::uuid AND (max_responses IS NULL OR response_count < max_responses)
        RETURNING id::text`,
      [row.id],
      'update',
    ),
  )
  if (taken.length === 0) throw new BasedbError('FORM_CLOSED', { details: { reason: 'full' } })

  try {
    await createRecordFor(pools, authority, writer, {
      tableId: row.table_id,
      values,
      fields: asked,
    })
  } catch (error) {
    await withTransaction(pools, 'catalog', authority, (exec) =>
      exec.query(
        `UPDATE _basedb.form_share SET response_count = greatest(response_count - 1, 0)
          WHERE id = $1::uuid`,
        [row.id],
        'update',
      ),
    ).catch(() => undefined)
    throw error
  }
  return { received: true }
}
