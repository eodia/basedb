import { unseal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadGrants, loadTarget } from '../rbac/loader.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The AI copilot — chapter 12.
 *
 * Two usages, and only two (§1.2). Both draft something a human then amends, validates
 * and saves by an explicit act:
 *
 *   `structure_draft`   une description de besoin → une proposition de tables, champs
 *                       et liens, amendée dans l'éditeur de schéma ;
 *   `expression_draft`  une phrase → un filtre dans la grammaire fermée du chapitre 08,
 *                       affiché dans l'éditeur, passé au validateur ordinaire.
 *
 * Everything else is OUT OF SCOPE and stays out (§1.4): no AI field, no enrichment, no
 * summary, no translation, no generation in a cell, no semantic search, no conversation
 * about the data. Those would violate INV-IA2 and turn every write into a billed call.
 * Conversation about data is what the MCP server is for, with the user's own agent, keys
 * and budget.
 *
 * **The kernel decides, the adapter calls** (§2.3). This module carries the usage, the
 * payload assembly, the closed system prompt, the expected response schema, the
 * provider and model resolution, the consent, permission and quota checks, the
 * validation and reprojection of the response, and the log event. It holds no HTTP
 * client and imports none: the transport is a function the adapter hands in.
 *
 * **Nothing leaves but labels and types** (§5.1, §5.2). No cell value, no `_id`, no
 * physical name, no tenant identifier. Objects travel under an EPHEMERAL ORDINAL —
 * `t1`, `f3` — private to the call, and the response is reprojected onto real
 * identifiers here. A model that hallucinates an identifier therefore cannot name one
 * that exists.
 */

export type UsageKind = 'structure_draft' | 'expression_draft'
export type ProviderName = 'openai' | 'anthropic' | 'mistral'

/**
 * What the adapter must provide: transport, and nothing else.
 *
 * It receives a system instruction, a user payload and the schema the answer must
 * satisfy, and returns raw text. It does not know what a base is, cannot reach the
 * catalog, and cannot decide anything.
 */
export type ProviderTransport = (request: {
  readonly provider: ProviderName
  readonly model: string
  readonly apiKey: string
  readonly system: string
  readonly payload: Record<string, unknown>
  readonly schema: Record<string, unknown>
  readonly timeoutMs: number
}) => Promise<{
  readonly text: string
  readonly inputTokens: number | null
  readonly outputTokens: number | null
}>

/** Total time budget for a call — §2.3 step 5. */
const TIMEOUT_MS = 20_000

/** Payload ceiling, past which the call is refused rather than truncated (§2.3 step 4). */
const MAX_PAYLOAD_BYTES = 64 * 1024

/** Calls per tenant per hour. A ceiling, not a billing model (§6.2). */
const HOURLY_QUOTA = 60

export interface ExpressionDraftRequest {
  readonly baseRef: string
  readonly tableId: string
  readonly request: string
  /** The validator's message on the previous attempt, when there was one (§5.1). */
  readonly previousError?: string
}

export interface StructureDraftRequest {
  readonly baseId: string
  readonly request: string
}

export interface ExpressionDraft {
  readonly filter: string
  readonly sort: string | null
  readonly explanation: string
}

export interface StructureDraft {
  readonly tables: ReadonlyArray<{
    readonly label: string
    readonly fields: ReadonlyArray<{
      readonly label: string
      readonly kind: string
      readonly required: boolean
      /** The label of the table this link points at, already reprojected. */
      readonly target: string | null
    }>
  }>
  readonly explanation: string
}

// ── The two operations ────────────────────────────────────────────────────────

/**
 * Drafts a filter expression for one table.
 *
 * The permission checked is the one the draft PREPARES (§7): reading the table. A filter
 * is a reading tool, so someone who cannot read the table has no business being helped
 * to filter it — and the fields listed in the payload are only those their own mask
 * lets them read.
 */
export async function draftExpression(
  pools: Pools,
  ctx: RequestContext,
  transport: ProviderTransport,
  request: ExpressionDraftRequest,
): Promise<ExpressionDraft> {
  const prepared = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      const target = await loadTarget(exec, ctx, request.tableId)
      if (target === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
      }
      const decision = decide(ctx, grants, 'read', target)
      if (decision.verdict !== 'ALLOWED') {
        throw new BasedbError(
          decision.verdict === 'INVISIBLE' ? 'RESOURCE_NOT_FOUND' : 'ADMIN_REQUIRED',
          { details: { table: request.tableId } },
        )
      }

      const [table] = await exec.query<{ label: string; base_id: string }>(
        'SELECT label, base_id FROM _basedb.table_def WHERE id = $1',
        [request.tableId],
      )
      if (table === undefined) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
      }

      // Masked fields and fields not exposed to agents are excluded HERE, while the
      // decision is still in hand (§5.1). Filtering after assembly would mean the value
      // existed in a payload for a moment, which is exactly what must not happen.
      const fields = await exec.query<{
        id: string
        name: string
        label: string
        kind: string
        is_required: boolean
      }>(
        `SELECT f.id, n.name, f.label, f.kind, f.is_required
           FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
          WHERE f.table_id = $1 AND f.deleted_at IS NULL AND f.expose_to_agents
          ORDER BY f.position`,
        [request.tableId],
      )

      const readable = fields.filter((f) => decision.readableFields.has(f.id))

      const config = await resolveProvider(exec, ctx)
      await assertQuota(exec, ctx)

      return { table, readable, config }
    },
    { readOnly: true },
  )

  // The physical names travel because the OUTPUT is an expression written against them:
  // a filter naming labels would not parse. They are not identifiers and reveal nothing
  // a reader of the table cannot already see — §5.2 forbids `_id` and tenant
  // identifiers, and the column name is neither.
  const payload = {
    intent: 'expression_draft' as const,
    table_label: prepared.table.label,
    fields: prepared.readable.map((f) => ({
      name: f.name,
      label: f.label,
      kind: f.kind,
      required: f.is_required,
    })),
    request: request.request,
    ...(request.previousError === undefined ? {} : { previous_error: request.previousError }),
  }

  const answer = await invoke(
    pools,
    ctx,
    transport,
    prepared.config,
    'expression_draft',
    prepared.table.base_id,
    payload,
    EXPRESSION_SCHEMA,
    EXPRESSION_SYSTEM,
  )

  const filter = typeof answer.filter === 'string' ? answer.filter : ''
  const sort = typeof answer.sort === 'string' && answer.sort !== '' ? answer.sort : null
  const explanation = typeof answer.explanation === 'string' ? answer.explanation : ''

  // Reprojection: every name the model produced must be one of the fields we sent. A
  // name we did not send is a hallucination, and letting it through would mean asking
  // the kernel to parse a filter over a column the reader may not read.
  const known = new Set(prepared.readable.map((f) => f.name))
  for (const name of namesIn(filter)) {
    const head = name.split('.')[0] ?? name
    if (!known.has(head)) {
      throw new BasedbError('AI_RESPONSE_UNUSABLE', {
        details: { reason: 'champ inconnu dans la proposition', field: head },
      })
    }
  }

  return { filter, sort, explanation }
}

/**
 * Drafts a set of tables, fields and links for a base.
 *
 * The act this prepares is a schema change, so it demands `manage_schema` — checked by
 * the ordinary decider on the base, not by a rule invented for AI (§7).
 */
export async function draftStructure(
  pools: Pools,
  ctx: RequestContext,
  transport: ProviderTransport,
  request: StructureDraftRequest,
): Promise<StructureDraft> {
  const prepared = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      const allowed =
        grants.isInstanceAdmin ||
        grants.roles.some((role) =>
          role.permissions.some(
            (p) =>
              p.action === 'manage_schema' &&
              (p.scopeKind === 'tenant' || p.scopeId === request.baseId),
          ),
        )
      if (!allowed) {
        throw new BasedbError('ADMIN_REQUIRED', { details: { base: request.baseId } })
      }

      const [base] = await exec.query<{ label: string }>(
        'SELECT label FROM _basedb.base WHERE id = $1 AND deleted_at IS NULL',
        [request.baseId],
      )
      if (base === undefined) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: request.baseId } })
      }

      const tables = await exec.query<{ id: string; label: string }>(
        `SELECT id, label FROM _basedb.table_def
          WHERE base_id = $1 AND deleted_at IS NULL ORDER BY position`,
        [request.baseId],
      )
      const fields = await exec.query<{
        table_id: string
        label: string
        kind: string
        is_required: boolean
        target_table_id: string | null
      }>(
        `SELECT f.table_id, f.label, f.kind, f.is_required, lc.target_table_id
           FROM _basedb.field f
           LEFT JOIN _basedb.field_link_config lc ON lc.field_id = f.id
          WHERE f.base_id = $1 AND f.deleted_at IS NULL AND f.expose_to_agents
          ORDER BY f.position`,
        [request.baseId],
      )

      const config = await resolveProvider(exec, ctx)
      await assertQuota(exec, ctx)
      return { base, tables, fields, config }
    },
    { readOnly: true },
  )

  // The ephemeral ordinals: `t1`, `t2`… private to this call. An identifier never
  // leaves, and a link target is designated by its ordinal (§5.1).
  const ordinalOf = new Map<string, string>()
  prepared.tables.forEach((t, i) => ordinalOf.set(t.id, `t${i + 1}`))

  const payload = {
    intent: 'structure_draft' as const,
    base_label: prepared.base.label,
    tables: prepared.tables.map((t) => ({
      ref: ordinalOf.get(t.id),
      label: t.label,
      fields: prepared.fields
        .filter((f) => f.table_id === t.id)
        .map((f) => ({
          label: f.label,
          kind: f.kind,
          required: f.is_required,
          ...(f.target_table_id === null
            ? {}
            : { target: ordinalOf.get(f.target_table_id) ?? null }),
        })),
    })),
    request: request.request,
  }

  const answer = await invoke(
    pools,
    ctx,
    transport,
    prepared.config,
    'structure_draft',
    request.baseId,
    payload,
    STRUCTURE_SCHEMA,
    STRUCTURE_SYSTEM,
  )

  const byOrdinal = new Map([...ordinalOf].map(([id, ref]) => [ref, id]))
  const labelOf = new Map(prepared.tables.map((t) => [t.id, t.label]))
  const drafted = Array.isArray(answer.tables) ? answer.tables : []

  return {
    tables: drafted.map((raw) => {
      const table = raw as Record<string, unknown>
      const fields = Array.isArray(table.fields) ? table.fields : []
      return {
        label: String(table.label ?? ''),
        fields: fields.map((f) => {
          const field = f as Record<string, unknown>
          const ref = typeof field.target === 'string' ? field.target : null
          // A target ordinal we did not issue is dropped rather than guessed: an
          // invented link is worse than a missing one, because it looks deliberate.
          const targetId = ref === null ? null : (byOrdinal.get(ref) ?? null)
          const local =
            ref !== null && targetId === null
              ? (drafted.find((t) => (t as Record<string, unknown>).ref === ref) as
                  | Record<string, unknown>
                  | undefined)
              : undefined
          return {
            label: String(field.label ?? ''),
            kind: String(field.kind ?? 'short_text'),
            required: field.required === true,
            target:
              targetId !== null
                ? (labelOf.get(targetId) ?? null)
                : local !== undefined
                  ? String(local.label ?? '')
                  : null,
          }
        }),
      }
    }),
    explanation: typeof answer.explanation === 'string' ? answer.explanation : '',
  }
}

// ── The call itself ───────────────────────────────────────────────────────────

interface ProviderConfig {
  readonly provider: ProviderName
  readonly model: string
  readonly apiKey: string
  readonly keyScope: 'instance' | 'tenant'
}

/**
 * Runs the call, validates, logs — whatever the outcome (§2.3 step 7).
 *
 * The retry is SINGLE and on an IDENTICAL payload: a response that fails its schema is
 * usually a formatting slip, and one more attempt costs less than a refusal the person
 * has to read and repeat. Two would be a loop with a bill attached.
 */
async function invoke(
  pools: Pools,
  ctx: RequestContext,
  transport: ProviderTransport,
  config: ProviderConfig,
  usage: UsageKind,
  baseId: string | null,
  payload: Record<string, unknown>,
  schema: Record<string, unknown>,
  system: string,
): Promise<Record<string, unknown>> {
  const serialized = JSON.stringify(payload)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    await log(pools, ctx, {
      usage,
      baseId,
      config,
      status: 'refused',
      code: 'AI_PAYLOAD_TOO_LARGE',
    })
    throw new BasedbError('AI_PAYLOAD_TOO_LARGE', {
      details: { maximum: MAX_PAYLOAD_BYTES },
    })
  }

  const started = Date.now()
  let lastFailure: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    let answer: Awaited<ReturnType<ProviderTransport>>
    try {
      answer = await transport({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        system,
        payload,
        schema,
        timeoutMs: TIMEOUT_MS - (Date.now() - started),
      })
    } catch (error) {
      // A transport failure is not retried here: §2.4 puts the single immediate retry on
      // `429`, `5xx` and network errors inside the adapter, which is the only place that
      // can read a `Retry-After`. Reaching this point means that retry already happened.
      await log(pools, ctx, {
        usage,
        baseId,
        config,
        status: 'failed',
        code: 'AI_PROVIDER_UNAVAILABLE',
        durationMs: Date.now() - started,
      })
      throw error instanceof BasedbError
        ? error
        : new BasedbError('AI_PROVIDER_UNAVAILABLE', { cause: error })
    }

    const parsed = parseJson(answer.text)
    if (parsed !== null && validate(parsed, schema)) {
      await log(pools, ctx, {
        usage,
        baseId,
        config,
        status: 'accepted',
        durationMs: Date.now() - started,
        tokensIn: answer.inputTokens,
        tokensOut: answer.outputTokens,
      })
      return parsed
    }

    lastFailure = answer.text
  }

  await log(pools, ctx, {
    usage,
    baseId,
    config,
    status: 'unusable',
    code: 'AI_RESPONSE_UNUSABLE',
    durationMs: Date.now() - started,
  })
  // The model's free text is NOT reinterpreted and NOT returned (§1.2): it is rejected.
  // Whatever it said, nothing here executes it.
  throw new BasedbError('AI_RESPONSE_UNUSABLE', {
    details: { reason: 'réponse non conforme au schéma attendu' },
    cause: lastFailure,
  })
}

/**
 * Reads JSON out of a model's answer.
 *
 * Models wrap JSON in prose and in code fences however firmly one asks them not to.
 * Peeling those off is not "reinterpreting the answer" — the object inside is still
 * validated against the schema, and a non-conforming one is still refused.
 */
function parseJson(text: string): Record<string, unknown> | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidates = [fenced?.[1], text]
  for (const candidate of candidates) {
    if (candidate === undefined) continue
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) continue
    try {
      const value = JSON.parse(candidate.slice(start, end + 1)) as unknown
      if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

/**
 * Checks the shape against the declared schema.
 *
 * A small hand-written walker rather than a JSON Schema library: the two schemas below
 * are the only ones that exist, they are fixed, and the kernel takes no dependency it
 * does not need (chapter 10 §1.3).
 */
function validate(value: unknown, schema: Record<string, unknown>): boolean {
  const type = schema.type as string | undefined

  if (type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
    const required = (schema.required ?? []) as readonly string[]
    const record = value as Record<string, unknown>
    for (const key of required) {
      if (!(key in record)) return false
    }
    for (const [key, sub] of Object.entries(properties)) {
      if (!(key in record)) continue
      if (record[key] === null && sub.nullable === true) continue
      if (!validate(record[key], sub)) return false
    }
    return true
  }

  if (type === 'array') {
    if (!Array.isArray(value)) return false
    const items = schema.items as Record<string, unknown> | undefined
    if (items === undefined) return true
    return value.every((item) => validate(item, items))
  }

  if (type === 'string') return typeof value === 'string'
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'number') return typeof value === 'number'
  return true
}

/** The field names a filter expression mentions, for the reprojection check. */
function namesIn(filter: string): string[] {
  const names: string[] = []
  // Strings are removed first: `nom eq "montant gt 3"` must not surrender `montant`.
  const withoutStrings = filter.replace(/"(?:[^"\\]|\\.)*"/g, '""')
  const keywords = new Set([
    'and',
    'or',
    'not',
    'eq',
    'ne',
    'eq_ci',
    'contains',
    'starts_with',
    'ends_with',
    'in',
    'is_null',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'true',
    'false',
  ])
  let expectField = true
  for (const match of withoutStrings.matchAll(/[_a-zA-Z][\w.]*/g)) {
    const word = match[0]
    if (keywords.has(word.toLowerCase())) {
      expectField =
        word.toLowerCase() === 'and' || word.toLowerCase() === 'or' || word.toLowerCase() === 'not'
      continue
    }
    if (expectField) names.push(word)
    expectField = false
  }
  return names
}

// ── Configuration, quota, log ─────────────────────────────────────────────────

/**
 * Resolves provider, model and key — §3.2 and §4.2.
 *
 * Tenant setting first, instance setting second. The key is read from
 * `_basedb.secret`, sealed with the instance key (A25): the database alone cannot
 * reveal it, and a dump without the key is a dump without the key.
 */
async function resolveProvider(exec: Executor, ctx: RequestContext): Promise<ProviderConfig> {
  const rows = await exec.query<{ key: string; value: unknown; scope_kind: string }>(
    `SELECT s.key, s.value, s.scope_kind
       FROM _basedb.setting s
       LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
      WHERE s.key IN ('ai.enabled', 'ai.provider', 'ai.model')
        AND (s.scope_kind = 'instance' OR t.ref = $1)
      ORDER BY s.scope_kind DESC`,
    [ctx.tenantId],
  )

  const settings = new Map<string, unknown>()
  // `scope_kind DESC` puts `tenant` before `instance`, so the first value wins.
  for (const row of rows) {
    if (!settings.has(row.key)) settings.set(row.key, row.value)
  }

  if (settings.get('ai.enabled') !== true) {
    throw new BasedbError('AI_DISABLED', { details: { tenant: ctx.tenantId } })
  }

  const provider = settings.get('ai.provider')
  const model = settings.get('ai.model')
  if (
    (provider !== 'openai' && provider !== 'anthropic' && provider !== 'mistral') ||
    typeof model !== 'string' ||
    model === ''
  ) {
    throw new BasedbError('AI_NOT_CONFIGURED', { details: { setting: 'ai.provider / ai.model' } })
  }

  const secrets = await exec.query<{
    value_encrypted: Buffer
    scope_kind: 'instance' | 'tenant'
    status: string
  }>(
    `SELECT s.value_encrypted, s.scope_kind, s.status
       FROM _basedb.secret s
       LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
      WHERE s.key = $1 AND (s.scope_kind = 'instance' OR t.ref = $2)
      ORDER BY s.scope_kind DESC`,
    [`ai.${provider}.api_key`, ctx.tenantId],
  )
  const secret = secrets.find((s) => s.status === 'valid')
  if (secret === undefined) {
    throw new BasedbError('AI_NOT_CONFIGURED', { details: { secret: `ai.${provider}.api_key` } })
  }

  const instanceKey = process.env.BASEDB_ENCRYPTION_KEY ?? ''
  const apiKey =
    instanceKey === ''
      ? null
      : unseal(instanceKey, 'secret', Buffer.from(secret.value_encrypted).toString('utf8'))
  if (apiKey === null) {
    throw new BasedbError('INTERNAL_ERROR', { details: { secret: `ai.${provider}.api_key` } })
  }

  return { provider, model, apiKey, keyScope: secret.scope_kind }
}

/**
 * The hourly ceiling — §6.2.
 *
 * Counted on `_basedb.ai_call`, which is written whatever the outcome from step 3 on:
 * a refused call still consumed a provider round trip, so it still counts. A quota that
 * only counted successes would be a quota one could exhaust for free.
 */
async function assertQuota(exec: Executor, ctx: RequestContext): Promise<void> {
  const [row] = await exec.query<{ n: string }>(
    `SELECT count(*) AS n FROM _basedb.ai_call c
       JOIN _basedb.tenant t ON t.id = c.tenant_id
      WHERE t.ref = $1 AND c.occurred_at > clock_timestamp() - interval '1 hour'`,
    [ctx.tenantId],
  )
  if (Number(row?.n ?? 0) >= HOURLY_QUOTA) {
    throw new BasedbError('AI_QUOTA_EXCEEDED', { details: { limit: HOURLY_QUOTA, window: '1h' } })
  }
}

async function log(
  pools: Pools,
  ctx: RequestContext,
  entry: {
    usage: UsageKind
    baseId: string | null
    config: ProviderConfig
    status: 'accepted' | 'refused' | 'failed' | 'unusable'
    code?: string
    durationMs?: number
    tokensIn?: number | null
    tokensOut?: number | null
  },
): Promise<void> {
  await pools
    .withConnection('catalog', async (exec) => {
      await exec.query(
        `INSERT INTO _basedb.ai_call
           (tenant_id, base_id, actor_user_id, surface, usage_kind, provider, model,
            key_scope, status, error_code, tokens_in, tokens_out, tokens_estimated,
            duration_ms, request_id)
         SELECT t.id, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                $11 IS NULL, $13, $14::uuid
           FROM _basedb.tenant t WHERE t.ref = $1`,
        [
          ctx.tenantId,
          entry.baseId,
          ctx.actor.kind === 'user' ? ctx.actor.id : null,
          ctx.surface === 'rest' ? 'rest' : 'ui',
          entry.usage,
          entry.config.provider,
          entry.config.model,
          entry.config.keyScope,
          entry.status,
          entry.code ?? null,
          entry.tokensIn ?? null,
          entry.tokensOut ?? null,
          entry.durationMs ?? null,
          ctx.requestId.length === 36 ? ctx.requestId : null,
        ],
        'insert',
      )
    })
    .catch(() => {
      // An unwritable log must not swallow the answer the caller is waiting for. It is a
      // gap in the journal, visible as such, not a failed request.
    })
}

// ── The closed templates ──────────────────────────────────────────────────────
//
// Closed, in the chapter's sense (§2.3): the system instruction comes from here and
// nowhere else. Nothing a user types reaches it — their sentence travels in the payload,
// as data, and the instruction below says so.

const EXPRESSION_SYSTEM = `Tu écris des expressions de filtre pour basedb, et rien d'autre.

GRAMMAIRE, fermée — aucun autre opérateur n'existe :
  expression = ou
  ou         = et , { "or" , et }
  et         = unaire , { "and" , unaire }
  unaire     = [ "not" ] , primaire
  primaire   = "(" , expression , ")" | prédicat
  prédicat   = champ , opérateur , [ valeur ]

OPÉRATEURS : eq ne eq_ci contains starts_with ends_with in is_null gt gte lt lte between
  — is_null ne prend pas de valeur ; sa négation s'écrit "not champ is_null"
  — in et between prennent une liste : [1, 2, 3]
  — les chaînes sont entre guillemets doubles, les nombres et dates nus (2026-01-01)
  — un champ lien se traverse par un point : client.raison_sociale contains "x"

RÈGLES :
  — n'emploie QUE les champs listés dans la charge utile, par leur "name" exact ;
  — n'emploie pour un champ QUE les opérateurs que son type accepte ;
  — si la demande est impossible dans cette grammaire, rends un filtre vide et explique
    pourquoi dans "explanation". N'invente jamais un opérateur pour y arriver.

Réponds UNIQUEMENT par un objet JSON conforme au schéma. Aucun texte autour.`

const EXPRESSION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['filter', 'explanation'],
  properties: {
    filter: { type: 'string' },
    sort: { type: 'string', nullable: true },
    explanation: { type: 'string' },
  },
}

const STRUCTURE_SYSTEM = `Tu proposes des structures de tables pour basedb, et rien d'autre.

TYPES DE CHAMPS, fermés — aucun autre n'existe :
  short_text long_text number boolean date datetime select link

RÈGLES :
  — un champ "link" porte "target", le "ref" d'une table existante de la charge utile
    ou le "label" d'une table que tu proposes dans la même réponse ;
  — ne propose pas de table ni de champ qui existe déjà ; propose ce qui manque ;
  — les libellés sont en français, au singulier pour un champ, au pluriel pour une table ;
  — pas de champ "identifiant" ni "créé le" : toute table en porte déjà cinq, fournies
    par le produit ;
  — "explanation" dit en deux phrases ce que la proposition ajoute et pourquoi.

Réponds UNIQUEMENT par un objet JSON conforme au schéma. Aucun texte autour.`

const STRUCTURE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['tables', 'explanation'],
  properties: {
    tables: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'fields'],
        properties: {
          ref: { type: 'string' },
          label: { type: 'string' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'kind'],
              properties: {
                label: { type: 'string' },
                kind: { type: 'string' },
                required: { type: 'boolean' },
                target: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    explanation: { type: 'string' },
  },
}
