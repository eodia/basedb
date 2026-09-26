import { createHash, randomUUID } from 'node:crypto'
import {
  MAX_FIELD_NAME_BYTES,
  MAX_TABLE_NAME_BYTES,
  qualify,
  quoteIdentifier,
  slugify,
} from '@basedb/naming'
import { agentView, logicalName, resolveAgentBase, resolveAgentTable } from '../agent/view.js'
import { writeAudit } from '../audit/journal.js'
import { normalizeDescription } from '../catalog/description.js'
import { addField } from '../catalog/fields.js'
import { createLinkField } from '../catalog/links.js'
import { createTable } from '../catalog/operations.js'
import { baseTargetOf } from '../catalog/projection.js'
import { type FieldKind, pgTypeOf } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants } from '../rbac/loader.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, sealContext, withTransaction } from '../tx/context.js'

/**
 * Structure proposals — chapter 09 §7: an agent never changes a structure, it PROPOSES,
 * and a person approves.
 *
 * A proposal is a row of `_basedb.migration` with `origin = 'mcp'` and `status =
 * 'proposed'` — which the catalog's `ck_migration_mcp_approved` forbids to leave that
 * state without an approver. It carries the request itself (`catalog_diff.request`), a
 * preview of what it will do (`up_sql`, `affected_objects`) and the catalog version it
 * was computed on. At approval everything is checked again — the approver's rights, the
 * rights of the person the token speaks for, the token itself, the catalog version, the
 * expiry — and the request is carried out by the ordinary operations of the kernel, in
 * that person's name: exactly what the schema editor would have done.
 *
 * A token never carries `manage_schema` (chapter 05 §2.3). What a proposal requires is
 * therefore the token's SCOPE — the base must be one it can see — and `manage_schema` for
 * the person who minted it: nothing is applied without a person, and the person the token
 * speaks for must be one who could have done it.
 */

/** A proposal nobody decided on after this long no longer describes the base (§7.2). */
export const PROPOSAL_LIFETIME_MS = 24 * 3_600_000

/** Open proposals per token and per base (§7.8). */
export const MAX_OPEN_PROPOSALS = 5

const PLANNER_VERSION = 1

/** Kinds an agent may propose for a new column — a link has its own path. */
const PLAIN_KINDS: readonly FieldKind[] = [
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'url',
]
const CHOICE_KINDS: readonly FieldKind[] = ['select', 'multi_select']

export interface ProposedField {
  readonly label: string
  readonly kind: FieldKind
  readonly description?: string | null
  readonly required?: boolean
  /** The choices of a `select` or `multi_select`: values, and their labels. */
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label?: string }>
}

type ProposalRequest =
  | {
      readonly operation: 'create_table'
      readonly baseId: string
      readonly label: string
      readonly description: string | null
      readonly fields: readonly ProposedField[]
    }
  | {
      readonly operation: 'add_field'
      readonly baseId: string
      readonly tableId: string
      readonly field: ProposedField
    }
  | {
      readonly operation: 'add_link'
      readonly baseId: string
      readonly tableId: string
      readonly targetTableId: string
      readonly label: string
      readonly description: string | null
      readonly onDelete: 'restrict' | 'set_null'
    }

/** One proposal, as the agent and the review screen read it. */
export interface Proposal {
  readonly id: string
  /** `approved`: a person approved it, and it is being carried out right now. */
  readonly status:
    | 'proposed'
    | 'approved'
    | 'applied'
    | 'rejected'
    | 'expired'
    | 'superseded'
    | 'failed'
  readonly base: { readonly id: string; readonly name: string; readonly label: string }
  readonly requestedAt: string
  readonly expiresAt: string
  readonly requestedBy: { readonly id: string; readonly name: string | null }
  readonly token: { readonly id: string | null; readonly label: string | null }
  readonly summaryTemplate: string
  /** Every value typed by someone is labelled `user_data`: shown as data, never as text. */
  readonly summaryParams: Readonly<Record<string, unknown>>
  readonly affectedObjects: ReadonlyArray<Record<string, unknown>>
  readonly upSql: readonly string[]
  readonly downSql: readonly string[]
  readonly decidedBy: { readonly id: string; readonly name: string | null } | null
  readonly decidedAt: string | null
  readonly error: string | null
}

const userData = (value: unknown) => ({ value, provenance: 'user_data' })

function checkLabel(label: unknown, field = 'label'): string {
  const text = typeof label === 'string' ? label.normalize('NFC').trim() : ''
  if (text === '') throw new BasedbError('LABEL_EMPTY', { details: { field } })
  if ([...text].length > 255) {
    throw new BasedbError('LABEL_TOO_LONG', { details: { field, maximum: 255 } })
  }
  return text
}

function checkField(field: ProposedField, path: string, allowChoices: boolean): ProposedField {
  const label = checkLabel(field.label, `${path}.label`)
  const kinds = allowChoices ? [...PLAIN_KINDS, ...CHOICE_KINDS] : PLAIN_KINDS
  if (!kinds.includes(field.kind)) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: `${path}.kind` } })
  }
  const description = normalizeDescription(field.description, `${path}.description`)
  if (CHOICE_KINDS.includes(field.kind)) {
    const options = field.options ?? []
    if (options.length === 0) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: `${path}.options` } })
    }
  }
  return {
    label,
    kind: field.kind,
    description,
    required: field.required === true,
    ...(field.options === undefined ? {} : { options: field.options }),
  }
}

/** The column name a label would get — the registry has the last word, at approval. */
const candidate = (label: string, nature: 'table' | 'champ') =>
  slugify(label, {
    max: nature === 'table' ? MAX_TABLE_NAME_BYTES : MAX_FIELD_NAME_BYTES,
    nature,
  }).slug

/** The user context of the person a token speaks for — who the checks are made for. */
function personOf(ctx: RequestContext, userId: string): RequestContext {
  const now = new Date()
  return sealContext({
    requestId: ctx.requestId,
    actor: { kind: 'user', id: userId },
    tenantId: ctx.tenantId,
    surface: 'ui',
    timestamp: now,
    deadline: new Date(now.getTime() + 30_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

/** `manage_schema` on a base, for the person the token speaks for — or `AUTHORIZATION_REVOKED`. */
async function assertPersonManages(
  exec: Executor,
  person: RequestContext,
  baseId: string,
  code: 'PERMISSION_DENIED' | 'AUTHORIZATION_REVOKED',
): Promise<void> {
  const [base] = await exec.query<Record<string, unknown> & { id: string; project_id: string }>(
    'SELECT id::text, project_id::text, mcp_enabled FROM _basedb.base WHERE id = $1 AND is_live',
    [baseId],
  )
  if (base === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  const grants = await loadGrants(exec, person)
  const target = baseTargetOf(person, base as never)
  if (decide(person, grants, 'manage_schema', target).verdict !== 'ALLOWED') {
    throw new BasedbError(code, { details: { base: baseId, action: 'manage_schema' } })
  }
}

/**
 * A read-only token proposes nothing: a proposal is a write, reviewed. What the token may
 * do is its role — `create` or `update` somewhere in it makes it a writing token.
 */
async function assertTokenWrites(exec: Executor, ctx: RequestContext): Promise<void> {
  if (ctx.actor.tokenId === undefined) return
  const [row] = await exec.query<{ writes: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM _basedb.api_token tk
         JOIN _basedb.permission p ON p.role_id = tk.role_id
        WHERE tk.id = $1 AND p.action IN ('create', 'update')) AS writes`,
    [ctx.actor.tokenId],
  )
  if (row?.writes !== true) throw new BasedbError('TOKEN_READ_ONLY', { details: { object: null } })
}

/** Writes the proposal row — superseding an open one of the same token on the same objects. */
async function insertProposal(
  exec: Executor,
  ctx: RequestContext,
  request: ProposalRequest,
  preview: {
    readonly label: string
    readonly summaryTemplate: string
    readonly summaryParams: Record<string, unknown>
    readonly affectedObjects: ReadonlyArray<Record<string, unknown>>
    readonly upSql: readonly string[]
    readonly downSql: readonly string[]
    /** What makes two proposals "the same objects" (§7.8). */
    readonly objectKey: string
  },
): Promise<string> {
  const tokenId = ctx.actor.tokenId ?? null
  const [base] = await exec.query<{ catalog_version: string; structure_state: string | null }>(
    'SELECT catalog_version::text FROM _basedb.base WHERE id = $1',
    [request.baseId],
  )

  // Expired ones are closed first: they do not count against the cap.
  await exec.query(
    `UPDATE _basedb.migration SET status = 'expired'
      WHERE origin = 'mcp' AND status = 'proposed'
        AND requested_at < clock_timestamp() - $1::interval`,
    [`${PROPOSAL_LIFETIME_MS / 1000} seconds`],
    'update',
  )
  const open = await exec.query<{ id: string; object_key: string | null }>(
    `SELECT id::text, catalog_diff->>'object_key' AS object_key
       FROM _basedb.migration
      WHERE origin = 'mcp' AND status = 'proposed' AND base_id = $1
        AND catalog_diff->>'token_id' IS NOT DISTINCT FROM $2`,
    [request.baseId, tokenId],
  )
  const replaced = open.find((o) => o.object_key === preview.objectKey)
  if (replaced === undefined && open.length >= MAX_OPEN_PROPOSALS) {
    throw new BasedbError('TOO_MANY_OPEN_PROPOSALS', { details: { maximum: MAX_OPEN_PROPOSALS } })
  }

  const catalogDiff = {
    operation: request.operation,
    request,
    catalog_version: base?.catalog_version ?? null,
    token_id: tokenId,
    object_key: preview.objectKey,
    summary_template: preview.summaryTemplate,
    summary_params: preview.summaryParams,
  }
  const checksum = createHash('sha256')
    .update(JSON.stringify({ catalogDiff, upSql: preview.upSql }))
    .digest()
  const id = randomUUID()
  await exec.query(
    `INSERT INTO _basedb.migration
       (id, base_id, label, origin, status, planner_version, up_sql, down_sql, checksum,
        catalog_diff, affected_objects, requested_by)
     VALUES ($1, $2, $3, 'mcp', 'proposed', $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10)`,
    [
      id,
      request.baseId,
      preview.label,
      PLANNER_VERSION,
      JSON.stringify(preview.upSql),
      JSON.stringify(preview.downSql),
      checksum,
      JSON.stringify(catalogDiff),
      JSON.stringify(preview.affectedObjects),
      ctx.actor.id,
    ],
    'insert',
  )
  if (replaced !== undefined) {
    await exec.query(
      `UPDATE _basedb.migration SET status = 'superseded', superseded_by_id = $2 WHERE id = $1`,
      [replaced.id, id],
      'update',
    )
  }
  await writeAudit(exec, ctx, {
    action: 'proposal.create',
    objectKind: 'migration',
    objectId: id,
    objectName: preview.label,
    payload: { operation: request.operation },
  })
  return id
}

/** `propose_create_table` — a table and its first fields (§2.2). */
export async function agentProposeCreateTable(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly base: string
    readonly label: string
    readonly description?: string | null
    readonly fields: readonly ProposedField[]
  },
): Promise<Proposal> {
  const view = await agentView(pools, ctx)
  const base = resolveAgentBase(view, request.base)
  const label = checkLabel(request.label)
  const description = normalizeDescription(request.description)
  if (!Array.isArray(request.fields) || request.fields.length === 0) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'fields' } })
  }
  const fields = request.fields.map((f, i) => checkField(f, `fields[${i}]`, false))

  const id = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await assertTokenWrites(exec, ctx)
    await assertPersonManages(exec, personOf(ctx, ctx.actor.id), base.row.id, 'PERMISSION_DENIED')
    const table = candidate(label, 'table')
    const columns = fields.map(
      (f) => `  ${quoteIdentifier(candidate(f.label, 'champ'))} ${pgTypeOf(f.kind)}`,
    )
    return insertProposal(
      exec,
      ctx,
      { operation: 'create_table', baseId: base.row.id, label, description, fields },
      {
        label: `Création de la table « ${label} »`,
        summaryTemplate: 'create_table',
        summaryParams: {
          table_label: userData(label),
          table_description: userData(description),
          fields: fields.map((f) => ({
            label: userData(f.label),
            kind: { value: f.kind, provenance: 'system' },
            description: userData(f.description ?? null),
          })),
        },
        affectedObjects: [
          {
            role: 'created',
            kind: 'table',
            physical: table,
            effects: [
              `création de la table ${table}, avec ${fields.length} champ${fields.length > 1 ? 's' : ''} et les cinq colonnes système`,
              'aucune table existante n’est touchée',
            ],
          },
        ],
        upSql: [
          `CREATE TABLE ${qualify(base.row.schema_name, table)} (\n  "_id" uuid PRIMARY KEY,\n${columns.join(',\n')}\n)`,
        ],
        downSql: [`DROP TABLE ${qualify(base.row.schema_name, table)} RESTRICT`],
        objectKey: `create_table:${label.toLowerCase()}`,
      },
    )
  })
  return agentGetProposal(pools, ctx, id)
}

/** `propose_add_field` — a column, a list of choices, or a link to another table (§7.4). */
export async function agentProposeAddField(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly base: string
    readonly table: string
    readonly label: string
    readonly kind: FieldKind | 'link'
    readonly description?: string | null
    readonly options?: ReadonlyArray<{ readonly value: string; readonly label?: string }>
    readonly target?: string
    readonly onDelete?: string
  },
): Promise<Proposal> {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, request.base, request.table)
  const base = table.base
  const label = checkLabel(request.label)
  const description = normalizeDescription(request.description)
  const where = qualify(base.row.schema_name, table.row.table_name)

  const id = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await assertTokenWrites(exec, ctx)
    await assertPersonManages(exec, personOf(ctx, ctx.actor.id), base.row.id, 'PERMISSION_DENIED')

    if (request.kind === 'link') {
      if (request.onDelete === 'cascade') throw new BasedbError('MCP_CASCADE_FORBIDDEN')
      const onDelete = request.onDelete === 'set_null' ? 'set_null' : 'restrict'
      if (typeof request.target !== 'string') {
        throw new BasedbError('REQUEST_INVALID', { details: { field: 'target' } })
      }
      // The target is resolved among the tables the token READS: one it cannot see is
      // exactly one that does not exist (§7.4), and a link never crosses bases.
      const target =
        view.tableById.get(request.target) ??
        base.tables.find((t) => t.row.table_name === request.target)
      if (target === undefined) {
        const elsewhere = view.bases.some((b) =>
          b.tables.some((t) => t.row.table_name === request.target || t.row.id === request.target),
        )
        if (elsewhere) throw new BasedbError('LINK_CROSS_DATABASE')
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { param: 'target' } })
      }
      if (target.base.row.id !== base.row.id) throw new BasedbError('LINK_CROSS_DATABASE')
      const column = `${target.row.table_name}_id`
      const [count] = await exec.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${where}`)
      const rows = Number(count?.n ?? 0)
      return insertProposal(
        exec,
        ctx,
        {
          operation: 'add_link',
          baseId: base.row.id,
          tableId: table.row.id,
          targetTableId: target.row.id,
          label,
          description,
          onDelete,
        },
        {
          label: `Ajout du lien « ${label} » vers « ${target.row.label} »`,
          summaryTemplate: 'add_link_field',
          summaryParams: {
            field_label: userData(label),
            field_description: userData(description),
            source_table: {
              physical: table.row.table_name,
              label: table.row.label,
              provenance: 'user_data',
            },
            target_table: {
              physical: target.row.table_name,
              label: target.row.label,
              provenance: 'user_data',
            },
            on_delete: { value: onDelete, provenance: 'system' },
          },
          affectedObjects: [
            {
              role: 'modified',
              kind: 'table',
              physical: table.row.table_name,
              effects: [`ajout de la colonne ${column}`, `ajout d’un index sur ${column}`],
            },
            {
              role: 'referenced',
              kind: 'table',
              physical: target.row.table_name,
              effects: [
                `clé étrangère posée vers ${target.row.table_name}._id`,
                onDelete === 'restrict'
                  ? `les suppressions de lignes de « ${target.row.label} » seront refusées si elles sont référencées`
                  : `supprimer une ligne de « ${target.row.label} » videra ce champ dans les lignes qui la référencent`,
                'verrou SHARE ROW EXCLUSIVE sur les deux tables pendant la pose : les écritures attendent, les lectures non',
                `parcours de validation de ${rows} ligne${rows > 1 ? 's' : ''}`,
              ],
            },
          ],
          upSql: [
            `ALTER TABLE ${where} ADD COLUMN ${quoteIdentifier(column)} uuid`,
            `ALTER TABLE ${where} ADD CONSTRAINT … FOREIGN KEY (${quoteIdentifier(column)}) REFERENCES ${qualify(base.row.schema_name, target.row.table_name)} ("_id") ON DELETE ${onDelete === 'restrict' ? 'NO ACTION' : 'SET NULL'} NOT VALID`,
            `ALTER TABLE ${where} VALIDATE CONSTRAINT …`,
          ],
          downSql: [`ALTER TABLE ${where} DROP COLUMN ${quoteIdentifier(column)}`],
          objectKey: `add_field:${table.row.id}:${label.toLowerCase()}`,
        },
      )
    }

    const field = checkField(
      {
        label,
        kind: request.kind,
        description,
        ...(request.options === undefined ? {} : { options: request.options }),
      },
      'field',
      true,
    )
    const column = candidate(label, 'champ')
    return insertProposal(
      exec,
      ctx,
      { operation: 'add_field', baseId: base.row.id, tableId: table.row.id, field },
      {
        label: `Ajout du champ « ${label} » à « ${table.row.label} »`,
        summaryTemplate: 'add_field',
        summaryParams: {
          field_label: userData(label),
          field_description: userData(description),
          kind: { value: field.kind, provenance: 'system' },
          table: {
            physical: table.row.table_name,
            label: table.row.label,
            provenance: 'user_data',
          },
          ...(field.options === undefined
            ? {}
            : { options: field.options.map((o) => userData(o.label ?? o.value)) }),
        },
        affectedObjects: [
          {
            role: 'modified',
            kind: 'table',
            physical: table.row.table_name,
            effects: [`ajout de la colonne ${column}, vide dans les lignes existantes`],
          },
        ],
        upSql: [
          `ALTER TABLE ${where} ADD COLUMN ${quoteIdentifier(column)} ${pgTypeOf(field.kind)}`,
        ],
        downSql: [`ALTER TABLE ${where} DROP COLUMN ${quoteIdentifier(column)}`],
        objectKey: `add_field:${table.row.id}:${label.toLowerCase()}`,
      },
    )
  })
  return agentGetProposal(pools, ctx, id)
}

type ProposalRow = {
  readonly id: string
  readonly status: string
  readonly base_id: string
  readonly base_label: string
  readonly base_name: string
  readonly requested_at: string
  readonly requested_by: string
  readonly requested_name: string | null
  readonly catalog_diff: Record<string, unknown>
  readonly affected_objects: ReadonlyArray<Record<string, unknown>>
  readonly up_sql: readonly string[]
  readonly down_sql: readonly string[] | null
  readonly approved_by: string | null
  readonly approved_name: string | null
  readonly approved_at: string | null
  readonly token_label: string | null
  readonly error_code: string | null
}

const SELECT_PROPOSALS = `
  SELECT m.id::text, m.status, m.base_id::text, b.label AS base_label, sn.name AS base_name,
         m.requested_at::text, m.requested_by::text, ru.display_name AS requested_name,
         m.catalog_diff, m.affected_objects, m.up_sql, m.down_sql,
         m.approved_by::text, au.display_name AS approved_name, m.approved_at::text,
         tk.label AS token_label, m.error_code
    FROM _basedb.migration m
    JOIN _basedb.base b           ON b.id = m.base_id
    JOIN _basedb.tenant t         ON t.id = b.tenant_id
    JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
    JOIN _basedb.physical_name sn ON sn.id = s.name_id
    LEFT JOIN _basedb.app_user ru ON ru.id = m.requested_by
    LEFT JOIN _basedb.app_user au ON au.id = m.approved_by
    LEFT JOIN _basedb.api_token tk ON tk.id::text = m.catalog_diff->>'token_id'
   WHERE m.origin = 'mcp' AND t.ref = $1`

function toProposal(row: ProposalRow, tenantRef: string): Proposal {
  const diff = row.catalog_diff
  const decision = diff.decision as { by?: string; name?: string; at?: string } | undefined
  const rejected = decision !== undefined
  const status = rejected
    ? 'rejected'
    : ((['proposed', 'approved', 'applied', 'expired', 'superseded', 'failed'].includes(row.status)
        ? row.status
        : 'proposed') as Proposal['status'])
  return {
    id: row.id,
    status,
    // The name an agent reads in a conversation — 'crm', not the schema's full name.
    base: { id: row.base_id, name: logicalName(row.base_name, tenantRef), label: row.base_label },
    requestedAt: new Date(row.requested_at).toISOString(),
    expiresAt: new Date(Date.parse(row.requested_at) + PROPOSAL_LIFETIME_MS).toISOString(),
    requestedBy: { id: row.requested_by, name: row.requested_name },
    token: { id: (diff.token_id as string | null) ?? null, label: row.token_label },
    summaryTemplate: String(diff.summary_template ?? ''),
    summaryParams: (diff.summary_params as Record<string, unknown>) ?? {},
    affectedObjects: row.affected_objects ?? [],
    upSql: row.up_sql ?? [],
    downSql: row.down_sql ?? [],
    decidedBy: rejected
      ? { id: decision.by ?? '', name: decision.name ?? null }
      : row.approved_by === null
        ? null
        : { id: row.approved_by, name: row.approved_name },
    decidedAt: rejected
      ? (decision.at ?? null)
      : row.approved_at === null
        ? null
        : new Date(row.approved_at).toISOString(),
    error: row.error_code,
  }
}

/** `get_proposal` — the token that proposed it, and nobody else on the agent surface (§2.2). */
export async function agentGetProposal(
  pools: Pools,
  ctx: RequestContext,
  proposalId: string,
): Promise<Proposal> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      if (!/^[0-9a-f-]{36}$/i.test(proposalId)) throw new BasedbError('RESOURCE_NOT_FOUND')
      const [row] = await exec.query<ProposalRow>(`${SELECT_PROPOSALS} AND m.id = $2`, [
        ctx.tenantId,
        proposalId,
      ])
      // Through a token, the token that proposed it — not another token of the same
      // person; without one, the person it was proposed for.
      const mine =
        row !== undefined &&
        (ctx.actor.tokenId === undefined
          ? row.requested_by === ctx.actor.id
          : row.catalog_diff.token_id === ctx.actor.tokenId)
      if (row === undefined || !mine) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { proposal: proposalId } })
      }
      return toProposal(row, ctx.tenantId)
    },
    { readOnly: true },
  )
}

/** The proposals of a base, newest first — the review queue (§7.2, step 4). */
export async function listProposals(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Proposal[]> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    await exec.query(
      `UPDATE _basedb.migration SET status = 'expired'
        WHERE origin = 'mcp' AND status = 'proposed' AND base_id = $1
          AND requested_at < clock_timestamp() - $2::interval`,
      [request.baseId, `${PROPOSAL_LIFETIME_MS / 1000} seconds`],
      'update',
    )
    const rows = await exec.query<ProposalRow>(
      `${SELECT_PROPOSALS} AND m.base_id = $2 ORDER BY m.requested_at DESC LIMIT 100`,
      [ctx.tenantId, request.baseId],
    )
    return rows.map((row) => toProposal(row, ctx.tenantId))
  })
}

/**
 * Approves a proposal and carries it out — §7.5, §7.6. Every check is made again, now:
 * the approver's right, the proposer's right, the token, the catalog version, the expiry.
 */
export async function approveProposal(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly proposalId: string },
): Promise<Proposal> {
  if (!/^[0-9a-f-]{36}$/i.test(request.proposalId)) throw new BasedbError('RESOURCE_NOT_FOUND')

  const checked = await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [row] = await exec.query<{
      base_id: string
      status: string
      requested_by: string
      requested_at: string
      catalog_diff: Record<string, unknown>
      catalog_version: string
    }>(
      `SELECT m.base_id::text, m.status, m.requested_by::text, m.requested_at::text,
              m.catalog_diff, b.catalog_version::text
         FROM _basedb.migration m
         JOIN _basedb.base b   ON b.id = m.base_id
         JOIN _basedb.tenant t ON t.id = b.tenant_id
        WHERE m.id = $1 AND m.origin = 'mcp' AND t.ref = $2
        FOR UPDATE OF m`,
      [request.proposalId, ctx.tenantId],
    )
    if (row === undefined)
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { proposal: request.proposalId } })
    await requireOnBase(exec, ctx, 'manage_schema', row.base_id)
    if (row.status !== 'proposed' || row.catalog_diff.decision !== undefined) {
      throw new BasedbError('MIGRATION_STALE', { details: { proposal: request.proposalId } })
    }
    if (Date.parse(row.requested_at) + PROPOSAL_LIFETIME_MS < Date.now()) {
      await exec.query(
        `UPDATE _basedb.migration SET status = 'expired' WHERE id = $1`,
        [request.proposalId],
        'update',
      )
      return { expired: true as const }
    }
    if (row.catalog_diff.catalog_version !== row.catalog_version) {
      throw new BasedbError('PROPOSAL_STALE', { details: { proposal: request.proposalId } })
    }

    // The proposer: still able to do it, and their token still valid (§7.6, 2 and 3).
    await assertPersonManages(
      exec,
      personOf(ctx, row.requested_by),
      row.base_id,
      'AUTHORIZATION_REVOKED',
    )
    const tokenId = row.catalog_diff.token_id as string | null
    if (tokenId !== null) {
      const [token] = await exec.query<{ usable: boolean }>(
        `SELECT (tk.revoked_at IS NULL AND tk.suspended_at IS NULL
                 AND (tk.expires_at IS NULL OR tk.expires_at > clock_timestamp())
                 AND 'mcp' = ANY(tk.allowed_surfaces)
                 AND u.disabled_at IS NULL AND u.deleted_at IS NULL) AS usable
           FROM _basedb.api_token tk JOIN _basedb.app_user u ON u.id = tk.created_by
          WHERE tk.id = $1`,
        [tokenId],
      )
      if (token?.usable !== true) {
        throw new BasedbError('AUTHORIZATION_REVOKED', {
          details: { proposal: request.proposalId },
        })
      }
    }
    // Claimed here, in the transaction that checked it: a second approval — concurrent or
    // late — finds it no longer `proposed`, and nothing is applied twice.
    await exec.query(
      `UPDATE _basedb.migration
          SET status = 'approved', approved_by = $2, approved_at = clock_timestamp()
        WHERE id = $1`,
      [request.proposalId, ctx.actor.id],
      'update',
    )
    return {
      expired: false as const,
      requestedBy: row.requested_by,
      request: row.catalog_diff.request as ProposalRequest,
    }
  })
  if (checked.expired)
    throw new BasedbError('PROPOSAL_EXPIRED', { details: { proposal: request.proposalId } })

  // Carried out by the ordinary operations, in the name of the person the token speaks
  // for: their rights are checked once more, by the operation itself.
  const person = personOf(ctx, checked.requestedBy)
  const r = checked.request
  let created: Record<string, unknown>
  try {
    created = await carryOut(pools, person, r)
  } catch (error) {
    // Recorded, with its code, where the queue shows it: an approval that failed is not
    // silently back in the queue, and not silently gone either.
    const code = error instanceof BasedbError ? error.code : 'INTERNAL_ERROR'
    await withTransaction(pools, 'catalog', ctx, (exec) =>
      exec.query(
        `UPDATE _basedb.migration
            SET status = 'failed', finished_at = clock_timestamp(),
                error_code = coalesce((SELECT code FROM _basedb.error_code WHERE code = $2),
                                      'INTERNAL_ERROR'),
                sequence = (SELECT coalesce(max(sequence), 0) + 1 FROM _basedb.migration
                             WHERE base_id = (SELECT base_id FROM _basedb.migration WHERE id = $1))
          WHERE id = $1`,
        [request.proposalId, code],
        'update',
      ),
    )
    throw error
  }

  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await exec.query(
      `UPDATE _basedb.migration
          SET status = 'applied', applied_by = $2, applied_at = clock_timestamp(),
              finished_at = clock_timestamp(),
              sequence = (SELECT coalesce(max(sequence), 0) + 1 FROM _basedb.migration
                           WHERE base_id = (SELECT base_id FROM _basedb.migration WHERE id = $1)),
              catalog_diff = catalog_diff || jsonb_build_object('created', $3::jsonb)
        WHERE id = $1`,
      [request.proposalId, ctx.actor.id, JSON.stringify(created)],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'proposal.approve',
      objectKind: 'migration',
      objectId: request.proposalId,
      objectName: r.operation,
    })
  })
  return (await listProposalsById(pools, ctx, request.proposalId)) as Proposal
}

/** The request, carried out by the ordinary operation — what the schema editor would do. */
async function carryOut(
  pools: Pools,
  person: RequestContext,
  r: ProposalRequest,
): Promise<Record<string, unknown>> {
  if (r.operation === 'create_table') {
    const table = await createTable(pools, person, {
      baseId: r.baseId,
      label: r.label,
      description: r.description,
      fields: r.fields.map((f) => ({
        label: f.label,
        kind: f.kind,
        required: f.required,
        description: f.description ?? null,
      })),
    })
    return { table_id: table.tableId, table: table.tableName }
  }
  if (r.operation === 'add_field') {
    const field = await addField(pools, person, {
      tableId: r.tableId,
      label: r.field.label,
      kind: r.field.kind,
      description: r.field.description ?? null,
      ...(r.field.options === undefined
        ? {}
        : { options: r.field.options.map((o) => ({ value: o.value, label: o.label ?? o.value })) }),
    })
    return { field_id: field.fieldId, field: field.name }
  }
  const link = await createLinkField(pools, person, {
    tableId: r.tableId,
    targetTableId: r.targetTableId,
    label: r.label,
    description: r.description,
    onDelete: r.onDelete,
  })
  return { field_id: link.fieldId }
}

/** Refuses a proposal: recorded, and closed. */
export async function rejectProposal(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly proposalId: string },
): Promise<Proposal> {
  if (!/^[0-9a-f-]{36}$/i.test(request.proposalId)) throw new BasedbError('RESOURCE_NOT_FOUND')
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [row] = await exec.query<{ base_id: string; status: string }>(
      `SELECT m.base_id::text, m.status FROM _basedb.migration m
         JOIN _basedb.base b ON b.id = m.base_id JOIN _basedb.tenant t ON t.id = b.tenant_id
        WHERE m.id = $1 AND m.origin = 'mcp' AND t.ref = $2 FOR UPDATE OF m`,
      [request.proposalId, ctx.tenantId],
    )
    if (row === undefined)
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { proposal: request.proposalId } })
    await requireOnBase(exec, ctx, 'manage_schema', row.base_id)
    if (row.status !== 'proposed') {
      throw new BasedbError('MIGRATION_STALE', { details: { proposal: request.proposalId } })
    }
    const [who] = await exec.query<{ name: string }>(
      'SELECT display_name AS name FROM _basedb.app_user WHERE id = $1',
      [ctx.actor.id],
    )
    // The catalog knows no « rejected » state: the proposal is closed as expired, and the
    // decision — who, when — is written beside it, which is what the queue shows.
    await exec.query(
      `UPDATE _basedb.migration
          SET status = 'expired',
              catalog_diff = catalog_diff || jsonb_build_object('decision',
                jsonb_build_object('kind', 'rejected', 'by', $2::text, 'name', $3::text,
                                   'at', to_char(clock_timestamp() AT TIME ZONE 'UTC',
                                                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
        WHERE id = $1`,
      [request.proposalId, ctx.actor.id, who?.name ?? null],
      'update',
    )
    await writeAudit(exec, ctx, {
      action: 'proposal.reject',
      objectKind: 'migration',
      objectId: request.proposalId,
      objectName: null,
    })
  })
  return (await listProposalsById(pools, ctx, request.proposalId)) as Proposal
}

async function listProposalsById(
  pools: Pools,
  ctx: RequestContext,
  id: string,
): Promise<Proposal | null> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const [row] = await exec.query<ProposalRow>(`${SELECT_PROPOSALS} AND m.id = $2`, [
        ctx.tenantId,
        id,
      ])
      return row === undefined ? null : toProposal(row, ctx.tenantId)
    },
    { readOnly: true },
  )
}

/** How many proposals await a decision, per base — the badge of the queue. */
export async function openProposalCounts(
  exec: Executor,
  baseIds: readonly string[],
): Promise<Map<string, number>> {
  if (baseIds.length === 0) return new Map()
  const rows = await exec.query<{ base_id: string; n: number }>(
    `SELECT base_id::text, count(*)::int AS n FROM _basedb.migration
      WHERE origin = 'mcp' AND status = 'proposed' AND base_id = ANY($1::uuid[])
        AND requested_at >= clock_timestamp() - $2::interval
      GROUP BY base_id`,
    [baseIds, `${PROPOSAL_LIFETIME_MS / 1000} seconds`],
  )
  return new Map(rows.map((r) => [r.base_id, r.n]))
}
