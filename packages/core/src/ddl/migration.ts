import { createHash } from 'node:crypto'
import { isErrorCode } from '@basedb/contracts'
import { BasedbError } from '../errors/index.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The migration state machine — chapter 03, and the engine chapter 06 runs on.
 *
 * A lifecycle operation is NOT one transaction. Chapter 06 §1.3 says so outright: "Une
 * opération de cycle de vie est un plan à plusieurs transactions : son rejeu est celui
 * de la machine à états des migrations, étape par étape." Deleting a base with sixty
 * tables in a single transaction would hold `ACCESS EXCLUSIVE` on every one of them for
 * the whole duration; in batches of ten, each lock is held for a step.
 *
 * Which is why a plan is a LIST OF STEPS, each a list of statements, and why the step
 * number is written back to the catalog between two of them. A process killed mid-plan
 * leaves a row saying exactly where it stopped, and `resume` picks it up there rather
 * than starting over on a schema that is already half migrated.
 *
 *          proposed ──approve──▶ approved ──▶ applying ──▶ applied
 *              │                                  │
 *              └──▶ superseded / expired          ├──▶ failed
 *                                                 └──▶ interrupted ──▶ applying
 *
 * The statements are stored in the catalog and CHECKSUMMED. A plan whose bytes changed
 * between proposal and application is refused with `MIGRATION_TAMPERED` — not because
 * we expect malice, but because a plan computed against one catalog and run against
 * another is the way a half-applied schema happens.
 */

export type MigrationOrigin = 'ui' | 'rest' | 'mcp' | 'system'

export type MigrationStatus =
  | 'proposed'
  | 'approved'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'interrupted'
  | 'superseded'
  | 'expired'

/**
 * One step: what runs in ONE transaction.
 *
 * `lock` is documentation for the operator, shown while the step runs — chapter 11 §6.5
 * asks a long operation to say what it is holding, and "ALTER SCHEMA … RENAME, verrou
 * court" is a very different thing to read than a progress bar with no caption.
 */
export interface MigrationStep {
  readonly label: string
  readonly statements: readonly string[]
  readonly lock: 'none' | 'short' | 'exclusive'
}

export interface ProposeRequest {
  readonly baseId: string
  readonly label: string
  readonly origin: MigrationOrigin
  readonly steps: readonly MigrationStep[]
  /** What the catalog will look like afterwards, for the review screen. */
  readonly catalogDiff: Record<string, unknown>
  readonly affectedObjects?: readonly Record<string, unknown>[]
  /** Statements that undo the plan, when it is undoable. */
  readonly downSql?: readonly string[]
}

export interface Migration {
  readonly id: string
  readonly baseId: string
  readonly sequence: number | null
  readonly label: string
  readonly origin: MigrationOrigin
  readonly status: MigrationStatus
  readonly step: number | null
  readonly stepCount: number | null
  readonly stepLabel: string | null
  readonly errorCode: string | null
  readonly failedStatement: string | null
  readonly requestedAt: string
  readonly finishedAt: string | null
  readonly durationMs: number | null
}

/** The planner's version. Bumped when the SHAPE of a plan changes, never for a typo. */
const PLANNER_VERSION = 1

/**
 * How long a step may run before another process may take the plan over.
 *
 * Long enough for a `DROP SCHEMA` on a big base, short enough that a crashed process
 * does not park a base for an afternoon. A running step RENEWS it, so a legitimately
 * slow step is never stolen mid-statement.
 */
const LEASE_MS = 120_000

/** Chapter 03: a plan beyond this is refused rather than run. */
export const MAX_STEPS = 64

/**
 * Serializes with SORTED KEYS, at every depth.
 *
 * `up_sql` is a `jsonb` column, and `jsonb` does not keep insertion order: it stores
 * object keys sorted by length then bytewise. A checksum taken over `JSON.stringify` of
 * the plan would therefore never match the one taken over what comes back out of the
 * database, and every apply would raise `MIGRATION_TAMPERED` on its own plan.
 *
 * Canonicalising is what makes the guard mean what it says — the bytes of the STATEMENTS
 * changed — rather than "the driver reordered a field".
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

function checksumOf(steps: readonly MigrationStep[]): Buffer {
  return createHash('sha256').update(canonical(steps), 'utf8').digest()
}

/**
 * Records a plan. Writes NOTHING to the database the plan describes.
 *
 * Proposing is free and reversible; that separation is what makes a review screen
 * possible, and what chapter 03 requires of anything reaching the schema from MCP —
 * `ck_migration_mcp_approved` enforces it at the table level, so a bug here cannot make
 * a model's proposal self-apply.
 */
export async function proposeMigration(
  pools: Pools,
  ctx: RequestContext,
  request: ProposeRequest,
): Promise<Migration> {
  if (request.steps.length === 0) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { parameter: 'steps', detail: 'un plan vide ne se propose pas' },
    })
  }
  if (request.steps.length > MAX_STEPS) {
    throw new BasedbError('MIGRATION_TOO_LARGE', {
      details: { steps: request.steps.length, maximum: MAX_STEPS },
    })
  }

  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await assertStructureOpen(exec, request.baseId)

    const [row] = await exec.query<{ id: string; requested_at: string }>(
      `INSERT INTO _basedb.migration
         (base_id, label, origin, status, planner_version, up_sql, down_sql, checksum,
          catalog_diff, affected_objects, step_count, requested_by)
       VALUES ($1, $2, $3, 'proposed', $4, $5::jsonb, $6::jsonb, $7,
               $8::jsonb, $9::jsonb, $10, $11)
       RETURNING id, requested_at`,
      [
        request.baseId,
        request.label,
        request.origin,
        PLANNER_VERSION,
        JSON.stringify(request.steps),
        request.downSql === undefined ? null : JSON.stringify(request.downSql),
        checksumOf(request.steps),
        JSON.stringify(request.catalogDiff),
        JSON.stringify(request.affectedObjects ?? []),
        request.steps.length,
        ctx.actor.id,
      ],
      'insert',
    )

    return {
      id: row.id,
      baseId: request.baseId,
      sequence: null,
      label: request.label,
      origin: request.origin,
      status: 'proposed' as const,
      step: null,
      stepCount: request.steps.length,
      stepLabel: null,
      errorCode: null,
      failedStatement: null,
      requestedAt: row.requested_at,
      finishedAt: null,
      durationMs: null,
    }
  })
}

/** Approves a proposal. A separate act, and a separate signature in `audit_log`. */
export async function approveMigration(
  pools: Pools,
  ctx: RequestContext,
  migrationId: string,
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const changed = await exec.query<{ id: string }>(
      `UPDATE _basedb.migration
          SET status = 'approved', approved_by = $2, approved_at = clock_timestamp()
        WHERE id = $1 AND status = 'proposed'
        RETURNING id`,
      [migrationId, ctx.actor.id],
      'update',
    )
    if (changed.length === 0) {
      throw new BasedbError('MIGRATION_STALE', { details: { migration: migrationId } })
    }
  })
}

/**
 * Runs a plan to completion, step by step.
 *
 * Each step is its own transaction on the `ddl` pool, and the step counter is written
 * back OUTSIDE it, on the catalog pool. That is deliberate and it is the whole point: a
 * counter written inside the step's transaction would roll back with it, and a process
 * that died just after `COMMIT` would replay a step that had in fact succeeded. Written
 * after, the worst case is a counter one behind — which `resume` handles by re-running
 * one idempotent step, not by corrupting a schema.
 */
export async function applyMigration(
  pools: Pools,
  ctx: RequestContext,
  migrationId: string,
): Promise<Migration> {
  const plan = await claim(pools, ctx, migrationId)
  const started = Date.now()

  for (let index = plan.startAt; index < plan.steps.length; index++) {
    const step = plan.steps[index]
    if (step === undefined) continue

    try {
      await withTransaction(pools, 'ddl', ctx, async (exec) => {
        // The structure history (chapter 07 §8.1) is written by catalog triggers, which
        // learn the migration they belong to here — as the capture learns its author.
        await exec.query("SELECT set_config('basedb.migration_id', $1, true)", [migrationId])
        for (const statement of step.statements) {
          await exec.query(statement, [], 'ddl')
        }
      })
    } catch (error) {
      await recordFailure(pools, ctx, migrationId, index, step, error)
      throw error
    }

    await withTransaction(pools, 'catalog', ctx, async (exec) => {
      await exec.query(
        `UPDATE _basedb.migration
            SET step = $2, lease_until = clock_timestamp() + ($3 || ' milliseconds')::interval
          WHERE id = $1`,
        [migrationId, index + 1, String(LEASE_MS)],
        'update',
      )
    })
  }

  return finish(pools, ctx, migrationId, plan.baseId, Date.now() - started)
}

/** Proposes, approves and applies in one go — the path the UI takes for its own acts. */
export async function runMigration(
  pools: Pools,
  ctx: RequestContext,
  request: ProposeRequest,
): Promise<Migration> {
  const proposed = await proposeMigration(pools, ctx, request)
  await approveMigration(pools, ctx, proposed.id)
  return applyMigration(pools, ctx, proposed.id)
}

interface ClaimedPlan {
  readonly baseId: string
  readonly steps: readonly MigrationStep[]
  readonly startAt: number
}

/**
 * Takes the lease, assigns the sequence, and checks the plan has not moved.
 *
 * `uq_migration_running` — a partial unique index on `base_id WHERE status='applying'` —
 * is what makes "une seule migration en cours par base" true against concurrent
 * processes rather than against a check nobody holds a lock for. Two processes racing
 * here produce a unique violation, and the loser gets `MIGRATION_IN_PROGRESS`.
 */
async function claim(pools: Pools, ctx: RequestContext, migrationId: string): Promise<ClaimedPlan> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [found] = await exec.query<{
      base_id: string
      status: MigrationStatus
      up_sql: MigrationStep[]
      checksum: Buffer
      step: number | null
      lease_until: string | null
    }>(
      `SELECT base_id, status, up_sql, checksum, step, lease_until
         FROM _basedb.migration WHERE id = $1 FOR UPDATE`,
      [migrationId],
    )

    if (found === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { migration: migrationId } })
    }
    if (found.status === 'applied') {
      throw new BasedbError('MIGRATION_STALE', { details: { reason: 'déjà appliquée' } })
    }
    if (found.status === 'applying') {
      const alive =
        found.lease_until !== null && Date.parse(found.lease_until) > ctx.timestamp.getTime()
      if (alive) {
        throw new BasedbError('MIGRATION_IN_PROGRESS', { details: { migration: migrationId } })
      }
    } else if (found.status !== 'approved' && found.status !== 'interrupted') {
      throw new BasedbError('MIGRATION_STALE', { details: { status: found.status } })
    }

    const steps = found.up_sql
    if (!checksumOf(steps).equals(Buffer.from(found.checksum))) {
      throw new BasedbError('MIGRATION_TAMPERED', { details: { migration: migrationId } })
    }

    // The sequence is assigned at ENTRY INTO EXECUTION and not at proposal (A12):
    // proposals can pile up and be abandoned, and a dense order over abandoned plans
    // would have holes that mean nothing.
    await exec.query(
      `UPDATE _basedb.migration
          SET status = 'applying',
              sequence = COALESCE(sequence,
                           (SELECT COALESCE(MAX(m.sequence), 0) + 1
                              FROM _basedb.migration m WHERE m.base_id = $2)),
              executor_id = $3,
              lease_until = clock_timestamp() + ($4 || ' milliseconds')::interval,
              attempts = attempts + 1,
              started_at = COALESCE(started_at, clock_timestamp())
        WHERE id = $1`,
      [migrationId, found.base_id, executorId(ctx), String(LEASE_MS)],
      'update',
    )

    await exec.query(
      'UPDATE _basedb.base SET current_migration_id = $2 WHERE id = $1',
      [found.base_id, migrationId],
      'update',
    )

    return { baseId: found.base_id, steps, startAt: found.step ?? 0 }
  })
}

async function finish(
  pools: Pools,
  ctx: RequestContext,
  migrationId: string,
  baseId: string,
  durationMs: number,
): Promise<Migration> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await exec.query(
      `UPDATE _basedb.migration
          SET status = 'applied', applied_by = $2, applied_at = clock_timestamp(),
              finished_at = clock_timestamp(), duration_ms = $3,
              executor_id = NULL, lease_until = NULL
        WHERE id = $1`,
      [migrationId, ctx.actor.id, durationMs],
      'update',
    )

    // The counter is bumped and the notification emitted IN THIS TRANSACTION. `NOTIFY`
    // is transactional — delivered at COMMIT and never before — so no listener can
    // learn of a migration that then rolls back (chapter 06 §1.3).
    await exec.query(
      `UPDATE _basedb.base
          SET catalog_version = catalog_version + 1,
              current_migration_id = NULL,
              updated_at = clock_timestamp(), updated_by = $2
        WHERE id = $1`,
      [baseId, ctx.actor.id],
      'update',
    )
    await exec.query("SELECT pg_notify('basedb_catalog', $1)", [baseId])

    return read(exec, migrationId)
  })
}

/**
 * Writes down why a step failed, in full.
 *
 * The PostgreSQL diagnostics go in the catalog row and NOT into the response: chapter 05
 * §"règle de divulgation" forbids a raw server message from crossing the enforcement
 * point. The operator reads `pg_message` in the table; the caller gets a named code.
 */
async function recordFailure(
  pools: Pools,
  ctx: RequestContext,
  migrationId: string,
  index: number,
  step: MigrationStep,
  error: unknown,
): Promise<void> {
  const business = error instanceof BasedbError ? error : null
  const pg = (business?.cause ?? error) as
    | {
        code?: string
        message?: string
        detail?: string
        hint?: string
        constraint?: string
      }
    | undefined

  const code = business !== null && isErrorCode(business.code) ? business.code : 'INTERNAL_ERROR'
  const sqlstate = typeof pg?.code === 'string' && /^[0-9A-Z]{5}$/.test(pg.code) ? pg.code : null

  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await exec.query(
      `UPDATE _basedb.migration
          SET status = 'failed', finished_at = clock_timestamp(),
              executor_id = NULL, lease_until = NULL,
              error_code = $2, pg_sqlstate = $3, pg_message = $4, pg_detail = $5,
              pg_hint = $6, pg_constraint_name = $7,
              failed_statement_n = $8, failed_statement = $9
        WHERE id = $1`,
      [
        migrationId,
        code,
        sqlstate,
        pg?.message ?? null,
        pg?.detail ?? null,
        pg?.hint ?? null,
        pg?.constraint ?? null,
        index,
        step.statements.join('\n'),
      ],
      'update',
    )
  }).catch(() => {
    // The failure record is best effort: if the catalog is unreachable too, the caller's
    // original error is the one that matters and must not be replaced by this one.
  })
}

/**
 * Marks as `interrupted` every plan whose lease has expired — chapter 10 §9, startup.
 *
 * NOT automatic re-execution: §1.3 is explicit that "aucune opération de cycle de vie
 * n'est jamais rejouée automatiquement". This only moves the row to a state a human can
 * resume from, and the base stops looking like it has a migration running.
 */
export async function reclaimStaleMigrations(pools: Pools): Promise<number> {
  return pools.withConnection('catalog', async (exec) => {
    const rows = await exec.query<{ id: string }>(
      `UPDATE _basedb.migration
          SET status = 'interrupted', executor_id = NULL, lease_until = NULL
        WHERE status = 'applying' AND lease_until < clock_timestamp()
        RETURNING id`,
      [],
      'update',
    )
    return rows.length
  })
}

export async function listMigrations(
  pools: Pools,
  ctx: RequestContext,
  baseId: string,
): Promise<readonly Migration[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const rows = await exec.query<MigrationRow>(
        `${SELECT_MIGRATION} WHERE base_id = $1 ORDER BY requested_at DESC LIMIT 50`,
        [baseId],
      )
      return rows.map(toMigration)
    },
    { readOnly: true },
  )
}

/** A base whose structure is frozen accepts no structure operation (chapter 06 §7). */
async function assertStructureOpen(exec: Executor, baseId: string): Promise<void> {
  const [base] = await exec.query<{ structure_state: string; is_live: boolean }>(
    'SELECT structure_state, is_live FROM _basedb.base WHERE id = $1',
    [baseId],
  )
  if (base === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { base: baseId } })
  }
  if (base.structure_state === 'frozen') {
    throw new BasedbError('BASE_STRUCTURE_FROZEN', { details: { base: baseId } })
  }
}

/** Identifies the process holding the lease — host and pid, which is what an operator greps. */
function executorId(ctx: RequestContext): string {
  return `${process.pid}@${ctx.requestId.slice(0, 8)}`
}

interface MigrationRow extends Record<string, unknown> {
  id: string
  base_id: string
  sequence: string | number | null
  label: string
  origin: MigrationOrigin
  status: MigrationStatus
  step: number | null
  step_count: number | null
  up_sql: MigrationStep[]
  error_code: string | null
  failed_statement: string | null
  requested_at: string
  finished_at: string | null
  duration_ms: number | null
}

const SELECT_MIGRATION = `SELECT id, base_id, sequence, label, origin, status, step, step_count,
         up_sql, error_code, failed_statement, requested_at, finished_at, duration_ms
    FROM _basedb.migration`

function toMigration(row: MigrationRow): Migration {
  const current = row.step === null ? null : (row.up_sql[row.step]?.label ?? null)
  return {
    id: row.id,
    baseId: row.base_id,
    sequence: row.sequence === null ? null : Number(row.sequence),
    label: row.label,
    origin: row.origin,
    status: row.status,
    step: row.step,
    stepCount: row.step_count,
    stepLabel: current,
    errorCode: row.error_code,
    failedStatement: row.failed_statement,
    requestedAt: row.requested_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
  }
}

async function read(exec: Executor, migrationId: string): Promise<Migration> {
  const [row] = await exec.query<MigrationRow>(`${SELECT_MIGRATION} WHERE id = $1`, [migrationId])
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { migration: migrationId } })
  }
  return toMigration(row)
}
