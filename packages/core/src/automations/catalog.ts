import { BasedbError } from '../errors/index.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'

/**
 * Automations — chapter 17: what one is, and how it is kept. A trigger, a condition, a
 * sequence of actions, acting on the authority of its owner — the last person who saved
 * it. Everything a definition names is checked here, at write time, and read again, with
 * the owner's rights, at every run.
 */

export type TriggerKind = 'record_created' | 'record_updated' | 'schedule' | 'button'

export interface Schedule {
  readonly every: 'hour' | 'day' | 'week'
  /** `HH:MM`; only the minutes count for `hour`. */
  readonly at: string
  /** 1 (Monday) to 7, for `week`. */
  readonly weekday: number
  readonly timezone: string
}

export type AutomationAction =
  | { readonly kind: 'update_record'; readonly values: Readonly<Record<string, unknown>> }
  | {
      readonly kind: 'create_record'
      /** The table's catalog key. */
      readonly table: string
      readonly values: Readonly<Record<string, unknown>>
    }
  | {
      readonly kind: 'notify'
      readonly users: readonly string[]
      /** A person field of the triggering row, whose person is notified too. */
      readonly userField: string | null
      readonly message: string
    }
  | { readonly kind: 'webhook'; readonly url: string }
  | {
      readonly kind: 'slack'
      /** A Slack connection of the base (chapter 19 §1). */
      readonly integration: string
      readonly message: string
    }

export interface AutomationTrigger {
  readonly kind: TriggerKind
  /** The table's catalog key; `null` for a schedule. */
  readonly table: string | null
  /** The watched fields of `record_updated` — none: any change. */
  readonly fields: readonly string[]
  readonly schedule: Schedule | null
}

export interface Automation {
  readonly id: string
  readonly baseId: string
  readonly label: string
  readonly description: string | null
  readonly enabled: boolean
  readonly trigger: AutomationTrigger
  readonly condition: string | null
  readonly actions: readonly AutomationAction[]
  readonly owner: { readonly id: string; readonly name: string }
  readonly nextRunAt: string | null
  readonly lastRun: { readonly status: string; readonly at: string } | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AutomationRun {
  readonly id: string
  readonly trigger: string
  readonly recordId: string | null
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
  readonly reason: string | null
  readonly errorCode: string | null
  readonly steps: ReadonlyArray<Record<string, unknown>>
  readonly queuedAt: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

export interface AutomationInput {
  readonly label?: unknown
  readonly description?: unknown
  readonly enabled?: unknown
  readonly trigger?: unknown
  readonly condition?: unknown
  readonly actions?: unknown
}

export const MAX_ACTIONS = 10
export const MAX_NOTIFIED = 20

const invalid = (field: string, reason: string, detail?: unknown) =>
  new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })

const TRIGGERS: readonly TriggerKind[] = ['record_created', 'record_updated', 'schedule', 'button']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Schedules ────────────────────────────────────────────────────────────────

/** The offset of a time zone at an instant, in milliseconds (local − UTC). */
function offsetOf(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const local = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return local - Math.floor(instant / 1000) * 1000
}

/** The instant a wall-clock time has in a time zone. */
function zoned(y: number, m: number, d: number, h: number, min: number, timezone: string): number {
  const guess = Date.UTC(y, m, d, h, min)
  const first = guess - offsetOf(guess, timezone)
  // Once more, for the day the clocks change.
  return guess - offsetOf(first, timezone)
}

/** The instant a wall-clock time has in a time zone — an agenda's local times too. */
export function utcOf(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  timezone: string,
): number {
  return zoned(y, m, d, h, min, timezone)
}

/** The first run of a schedule strictly after `after`. */
export function nextRunOf(schedule: Schedule, after: Date): Date {
  const [hh, mm] = schedule.at.split(':').map(Number) as [number, number]
  const local = new Date(after.getTime() + offsetOf(after.getTime(), schedule.timezone))
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()
  if (schedule.every === 'hour') {
    for (let i = 0; i <= 25; i++) {
      const at = zoned(y, m, d, local.getUTCHours() + i, mm, schedule.timezone)
      if (at > after.getTime()) return new Date(at)
    }
  }
  for (let i = 0; i <= 8; i++) {
    const at = zoned(y, m, d + i, hh, mm, schedule.timezone)
    if (at <= after.getTime()) continue
    if (schedule.every === 'week') {
      const weekday = new Date(Date.UTC(y, m, d + i)).getUTCDay() || 7
      if (weekday !== schedule.weekday) continue
    }
    return new Date(at)
  }
  return new Date(after.getTime() + 3_600_000)
}

function checkedSchedule(raw: unknown): Schedule {
  const s = (raw ?? {}) as Record<string, unknown>
  const every = s.every
  if (every !== 'hour' && every !== 'day' && every !== 'week') {
    throw invalid('trigger.schedule.every', 'valeur_invalide')
  }
  const at = typeof s.at === 'string' ? s.at : '09:00'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) throw invalid('trigger.schedule.at', 'heure_invalide')
  const weekday = typeof s.weekday === 'number' ? s.weekday : 1
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw invalid('trigger.schedule.weekday', 'valeur_invalide')
  }
  const timezone = typeof s.timezone === 'string' && s.timezone !== '' ? s.timezone : 'Europe/Paris'
  try {
    new Intl.DateTimeFormat('fr', { timeZone: timezone })
  } catch {
    throw invalid('trigger.schedule.timezone', 'fuseau_inconnu')
  }
  return { every, at, weekday, timezone }
}

// ── Validation ───────────────────────────────────────────────────────────────

interface TableInfo {
  readonly id: string
  readonly name: string
  readonly fields: ReadonlyMap<string, string>
}

/** The live tables of a base, by name and by key, with their fields' kinds by name. */
async function tablesOf(exec: Executor, baseId: string): Promise<Map<string, TableInfo>> {
  const rows = await exec.query<{
    id: string
    name: string
    field: string | null
    kind: string | null
  }>(
    `SELECT t.id::text, tn.name, fn.name AS field, f.kind
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       LEFT JOIN _basedb.field f ON f.table_id = t.id AND f.is_live
       LEFT JOIN _basedb.physical_name fn ON fn.id = f.name_id
      WHERE t.base_id = $1 AND t.is_live`,
    [baseId],
  )
  const out = new Map<string, TableInfo>()
  for (const r of rows) {
    const table = out.get(r.id) ?? { id: r.id, name: r.name, fields: new Map<string, string>() }
    if (r.field !== null && r.kind !== null)
      (table.fields as Map<string, string>).set(r.field, r.kind)
    out.set(r.id, table)
  }
  return out
}

function tableByName(tables: Map<string, TableInfo>, name: unknown, field: string): TableInfo {
  const found = [...tables.values()].find((t) => t.name === name || t.id === name)
  if (found === undefined) throw invalid(field, 'table_inconnue', name)
  return found
}

function checkedValues(raw: unknown, table: TableInfo, field: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw invalid(field, 'valeurs_invalides')
  const values = raw as Record<string, unknown>
  const names = Object.keys(values)
  if (names.length === 0) throw invalid(field, 'aucune_valeur')
  for (const name of names) {
    if (!table.fields.has(name)) throw invalid(field, 'champ_inconnu', name)
  }
  return values
}

async function checkedActions(
  exec: Executor,
  ctx: RequestContext,
  raw: unknown,
  trigger: AutomationTrigger,
  tables: Map<string, TableInfo>,
  targets: TargetPolicy,
  baseId: string,
): Promise<AutomationAction[]> {
  if (!Array.isArray(raw) || raw.length === 0) throw invalid('actions', 'aucune_action')
  if (raw.length > MAX_ACTIONS) throw invalid('actions', 'trop_d_actions', MAX_ACTIONS)
  const source = trigger.table === null ? null : (tables.get(trigger.table) ?? null)
  const out: AutomationAction[] = []
  for (const [index, item] of raw.entries()) {
    const a = (item ?? {}) as Record<string, unknown>
    const at = `actions[${index}]`
    switch (a.kind) {
      case 'update_record': {
        if (source === null) throw invalid(at, 'action_sans_ligne')
        out.push({ kind: 'update_record', values: checkedValues(a.values, source, `${at}.values`) })
        break
      }
      case 'create_record': {
        const table = tableByName(tables, a.table, `${at}.table`)
        out.push({
          kind: 'create_record',
          table: table.id,
          values: checkedValues(a.values, table, `${at}.values`),
        })
        break
      }
      case 'notify': {
        const users = Array.isArray(a.users)
          ? [...new Set(a.users.filter((u): u is string => typeof u === 'string' && UUID.test(u)))]
          : []
        if (users.length > MAX_NOTIFIED)
          throw invalid(`${at}.users`, 'trop_de_personnes', MAX_NOTIFIED)
        const userField =
          typeof a.user_field === 'string' && a.user_field !== '' ? a.user_field : null
        if (userField !== null && source?.fields.get(userField) !== 'user') {
          throw invalid(`${at}.user_field`, 'champ_personne_attendu', userField)
        }
        if (users.length === 0 && userField === null)
          throw invalid(`${at}.users`, 'personne_a_prevenir')
        if (users.length > 0) {
          const known = await exec.query<{ id: string }>(
            `SELECT u.id::text FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE t.ref = $1 AND u.id = ANY($2::uuid[]) AND u.deleted_at IS NULL`,
            [ctx.tenantId, users],
          )
          const unknown = users.find((u) => !known.some((k) => k.id === u))
          if (unknown !== undefined) throw invalid(`${at}.users`, 'personne_inconnue', unknown)
        }
        const message = typeof a.message === 'string' ? a.message.trim() : ''
        if (message === '' || message.length > 1000)
          throw invalid(`${at}.message`, 'message_invalide')
        out.push({ kind: 'notify', users, userField, message })
        break
      }
      case 'webhook': {
        const url = typeof a.url === 'string' ? a.url.trim() : ''
        await checkTarget(url, targets)
        out.push({ kind: 'webhook', url })
        break
      }
      case 'slack': {
        const integration = typeof a.integration === 'string' ? a.integration : ''
        const [found] = await exec.query<{ id: string }>(
          `SELECT id::text FROM _basedb.integration
            WHERE id::text = $1 AND base_id = $2 AND kind = 'slack' AND deleted_at IS NULL`,
          [integration, baseId],
        )
        if (found === undefined)
          throw invalid(`${at}.integration`, 'connexion_inconnue', integration)
        const message = typeof a.message === 'string' ? a.message.trim() : ''
        if (message === '' || message.length > 3000)
          throw invalid(`${at}.message`, 'message_invalide')
        out.push({ kind: 'slack', integration, message })
        break
      }
      default:
        throw invalid(`${at}.kind`, 'action_inconnue', a.kind)
    }
  }
  return out
}

async function checkedDefinition(
  exec: Executor,
  ctx: RequestContext,
  baseId: string,
  input: AutomationInput,
  current: Automation | null,
  targets: TargetPolicy,
) {
  const label = typeof input.label === 'string' ? input.label.trim() : (current?.label ?? '')
  if (label === '' || label.length > 255) throw invalid('label', 'libelle_invalide')
  const description =
    input.description === undefined
      ? (current?.description ?? null)
      : typeof input.description === 'string' && input.description.trim() !== ''
        ? input.description.trim().slice(0, 2000)
        : null
  const enabled = input.enabled === undefined ? (current?.enabled ?? true) : input.enabled === true

  const tables = await tablesOf(exec, baseId)
  const rawTrigger = (input.trigger ?? current?.trigger ?? {}) as Record<string, unknown>
  const kind = rawTrigger.kind as TriggerKind
  if (!TRIGGERS.includes(kind))
    throw invalid('trigger.kind', 'declencheur_inconnu', rawTrigger.kind)
  let trigger: AutomationTrigger
  if (kind === 'schedule') {
    trigger = { kind, table: null, fields: [], schedule: checkedSchedule(rawTrigger.schedule) }
  } else {
    const table = tableByName(tables, rawTrigger.table, 'trigger.table')
    const fields =
      kind === 'record_updated' && Array.isArray(rawTrigger.fields)
        ? [...new Set(rawTrigger.fields.filter((f): f is string => typeof f === 'string'))]
        : []
    for (const f of fields)
      if (!table.fields.has(f)) throw invalid('trigger.fields', 'champ_inconnu', f)
    trigger = { kind, table: table.id, fields, schedule: null }
  }

  const rawCondition = input.condition === undefined ? current?.condition : input.condition
  const condition =
    typeof rawCondition === 'string' && rawCondition.trim() !== '' ? rawCondition.trim() : null
  if (condition !== null && trigger.table === null)
    throw invalid('condition', 'condition_sans_ligne')
  if (condition !== null && condition.length > 4000) throw invalid('condition', 'texte_trop_long')

  const actions = await checkedActions(
    exec,
    ctx,
    input.actions ?? current?.actions?.map(wireAction(tables)),
    trigger,
    tables,
    targets,
    baseId,
  )
  return { label, description, enabled, trigger, condition, actions }
}

/** An action as it was written — table names rather than keys — to be checked again. */
const wireAction = (tables: Map<string, TableInfo>) => (a: AutomationAction) =>
  a.kind === 'create_record'
    ? { ...a, table: tables.get(a.table)?.name ?? a.table }
    : a.kind === 'notify'
      ? { kind: a.kind, users: a.users, user_field: a.userField, message: a.message }
      : a

// ── Reading ──────────────────────────────────────────────────────────────────

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly base_id: string
  readonly label: string
  readonly description: string | null
  readonly is_enabled: boolean
  readonly trigger_kind: TriggerKind
  readonly table_id: string | null
  readonly trigger: Record<string, unknown>
  readonly condition: string | null
  readonly actions: AutomationAction[]
  readonly owner_id: string
  readonly owner_name: string
  readonly next_run_at: string | null
  readonly last_status: string | null
  readonly last_at: string | null
  readonly created_at: string
  readonly updated_at: string
}

const COLUMNS = `a.id::text, a.base_id::text, a.label, a.description, a.is_enabled, a.trigger_kind,
       a.table_id::text, a.trigger, a.condition, a.actions, a.owner_id::text,
       coalesce(nullif(u.display_name, ''), u.email) AS owner_name, a.next_run_at::text,
       last.status AS last_status, last.at AS last_at, a.created_at::text, a.updated_at::text`
const FROM = `FROM _basedb.automation a
       JOIN _basedb.app_user u ON u.id = a.owner_id
       LEFT JOIN LATERAL (
         SELECT r.status, coalesce(r.finished_at, r.queued_at)::text AS at
           FROM _basedb.automation_run r WHERE r.automation_id = a.id
          ORDER BY r.queued_at DESC LIMIT 1) last ON true`

function shaped(row: Row): Automation {
  const t = row.trigger as { fields?: string[]; schedule?: Schedule }
  return {
    id: row.id,
    baseId: row.base_id,
    label: row.label,
    description: row.description,
    enabled: row.is_enabled,
    trigger: {
      kind: row.trigger_kind,
      table: row.table_id,
      fields: t.fields ?? [],
      schedule: t.schedule ?? null,
    },
    condition: row.condition,
    actions: row.actions,
    owner: { id: row.owner_id, name: row.owner_name },
    nextRunAt: row.next_run_at,
    lastRun: row.last_status === null ? null : { status: row.last_status, at: row.last_at ?? '' },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** One automation of a base, by key — absent and foreign read the same. */
export async function loadAutomation(exec: Executor, id: string): Promise<Automation | null> {
  if (!UUID.test(id)) return null
  const [row] = await exec.query<Row>(
    `SELECT ${COLUMNS} ${FROM} WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id],
  )
  return row === undefined ? null : shaped(row)
}

async function requireAutomation(exec: Executor, ctx: RequestContext, baseId: string, id: string) {
  const found = await loadAutomation(exec, id)
  if (found === null || found.baseId !== baseId) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { automation: id } })
  }
  return found
}

export async function listAutomations(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Automation[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      const rows = await exec.query<Row>(
        `SELECT ${COLUMNS} ${FROM}
          WHERE a.base_id = $1 AND a.deleted_at IS NULL
          ORDER BY a.created_at`,
        [request.baseId],
      )
      return rows.map(shaped)
    },
    { readOnly: true },
  )
}

// ── Writing ──────────────────────────────────────────────────────────────────

export async function createAutomation(
  pools: Pools,
  ctx: RequestContext,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly input: AutomationInput },
): Promise<Automation> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const d = await checkedDefinition(exec, ctx, request.baseId, request.input, null, targets)
    const [row] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.automation
         (tenant_id, base_id, label, description, is_enabled, trigger_kind, table_id, trigger,
          condition, actions, owner_id, next_run_at, created_by)
       SELECT b.tenant_id, b.id, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $10
         FROM _basedb.base b WHERE b.id = $1
       RETURNING id::text`,
      [
        request.baseId,
        d.label,
        d.description,
        d.enabled,
        d.trigger.kind,
        d.trigger.table,
        JSON.stringify({ fields: d.trigger.fields, schedule: d.trigger.schedule }),
        d.condition,
        JSON.stringify(d.actions),
        ctx.actor.id,
        d.trigger.schedule === null
          ? null
          : nextRunOf(d.trigger.schedule, ctx.timestamp).toISOString(),
      ],
      'insert',
    )
    return (await loadAutomation(exec, (row as { id: string }).id)) as Automation
  })
}

/** Rewrites an automation; whoever saves it becomes its owner (chapter 17 §1). */
export async function updateAutomation(
  pools: Pools,
  ctx: RequestContext,
  targets: TargetPolicy,
  request: { readonly baseId: string; readonly id: string; readonly input: AutomationInput },
): Promise<Automation> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const current = await requireAutomation(exec, ctx, request.baseId, request.id)
    const d = await checkedDefinition(exec, ctx, request.baseId, request.input, current, targets)
    await exec.query(
      `UPDATE _basedb.automation
          SET label = $2, description = $3, is_enabled = $4, trigger_kind = $5, table_id = $6,
              trigger = $7::jsonb, condition = $8, actions = $9::jsonb, owner_id = $10,
              next_run_at = $11, updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1`,
      [
        request.id,
        d.label,
        d.description,
        d.enabled,
        d.trigger.kind,
        d.trigger.table,
        JSON.stringify({ fields: d.trigger.fields, schedule: d.trigger.schedule }),
        d.condition,
        JSON.stringify(d.actions),
        ctx.actor.id,
        d.trigger.schedule === null
          ? null
          : nextRunOf(d.trigger.schedule, ctx.timestamp).toISOString(),
      ],
      'update',
    )
    // Switched off: what was waiting will not run.
    if (!d.enabled) {
      await exec.query(
        `UPDATE _basedb.automation_run SET status = 'skipped', reason = 'desactivee',
                finished_at = pg_catalog.clock_timestamp()
          WHERE automation_id = $1 AND status = 'queued'`,
        [request.id],
        'update',
      )
    }
    return (await loadAutomation(exec, request.id)) as Automation
  })
}

export async function deleteAutomation(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    await requireAutomation(exec, ctx, request.baseId, request.id)
    await exec.query(
      'UPDATE _basedb.automation SET deleted_at = pg_catalog.clock_timestamp() WHERE id = $1',
      [request.id],
      'update',
    )
    await exec.query(
      `UPDATE _basedb.automation_run SET status = 'skipped', reason = 'supprimee',
              finished_at = pg_catalog.clock_timestamp()
        WHERE automation_id = $1 AND status = 'queued'`,
      [request.id],
      'update',
    )
  })
}

export async function listAutomationRuns(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<AutomationRun[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      await requireAutomation(exec, ctx, request.baseId, request.id)
      const rows = await exec.query<{
        id: string
        trigger_kind: string
        record_id: string | null
        status: AutomationRun['status']
        reason: string | null
        error_code: string | null
        steps: Array<Record<string, unknown>>
        queued_at: string
        started_at: string | null
        finished_at: string | null
      }>(
        `SELECT id::text, trigger_kind, record_id::text, status, reason, error_code, steps,
                queued_at::text, started_at::text, finished_at::text
           FROM _basedb.automation_run WHERE automation_id = $1
          ORDER BY queued_at DESC LIMIT 50`,
        [request.id],
      )
      return rows.map((r) => ({
        id: r.id,
        trigger: r.trigger_kind,
        recordId: r.record_id,
        status: r.status,
        reason: r.reason,
        errorCode: r.error_code,
        steps: r.steps,
        queuedAt: r.queued_at,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
      }))
    },
    { readOnly: true },
  )
}
