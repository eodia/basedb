import {
  type NameScope,
  SLUG_VERSION,
  type SlugNature,
  applyNameRestrictions,
  budgetForNature,
  byteLength,
  composeSchemaName,
  isAlphabetA,
  slugify,
  truncateHard,
} from '@basedb/naming'
import { BasedbError } from '../errors/index.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * Name allocation procedure — chapter 01 §6.1.
 *
 * It is UNIQUE across every object kind, and it is the ONLY path through which a
 * physical name can come into being. `@basedb/naming` computes candidates without
 * touching the database; this module holds the registry, the lock and the suffix loop.
 */

/** Instance-scope constant, for schema names (§6.2). */
export const SCOPE_INSTANCE = '00000000-0000-0000-0000-000000000001'

/** Advisory lock class for allocation, assigned to the catalog (A8). */
export const LOCK_CLASS_NAME_ALLOCATION = 2

export type ObjectKind =
  | 'schema'
  | 'table'
  | 'sql_view'
  | 'field'
  | 'system_field'
  | 'index'
  | 'constraint'
  | 'sequence'
  | 'trigger'

export type ScopeKind = 'instance' | 'schema' | 'table'

/**
 * The registry carries NO object identifier: the relation runs from the object TO the
 * name, never the other way round (A5). A catalog table references its registry row
 * through `name_id`; that is what allows a name to outlive the object that bore it, and
 * therefore never to be reassigned.
 */
export interface AllocationRequest {
  /** Label entered by the user, slugified when no technical name is supplied. */
  readonly label?: string
  /**
   * Technical name entered by the user (§2.4). Slugification is then NOT applied: the
   * string must satisfy alphabet A as is, otherwise `IDENTIFIER_INVALID`.
   */
  readonly technicalName?: string
  /** Already-assembled derived name (§9.6), bypassing both slugification and label. */
  readonly derivedName?: string
  /**
   * Derived fallbacks, tried BARE before the suffix loop opens (A7).
   *
   * This is the rule of chapter 04 §4.1 for link columns: `clients_id`, then the slug
   * of the field's label followed by `_id`, and only as a last resort a numeric suffix.
   * A second link to `clients` from a field labelled "Client livré" thus yields
   * `client_livre_id`, far more telling than `clients_id_2`.
   *
   * They are tried UNDER the scope lock, along with the main candidate: testing them
   * beforehand would let another transaction take the name in the meantime.
   */
  readonly derivedFallbacks?: readonly string[]
  readonly objectKind: ObjectKind
  readonly scopeKind: ScopeKind
  readonly scopeId: string
  /** For a schema: the tenant whose assembled name carries the positional prefix. */
  readonly tenantId?: string
}

export interface AllocatedName {
  /** Assigned physical name, to be returned to the caller (§2.5). */
  readonly name: string
  /** Identifier of the registry row, referenced by object tables. */
  readonly nameId: string
  /** True if the fallback rule of §3.5 applied: `SLUG_FALLBACK_APPLIED`. */
  readonly fallbackApplied: boolean
  /** Rank reached by the suffix loop; 1 means "bare candidate". */
  readonly rank: number
}

/** Naming budget and scope specific to each object kind. */
function budgetOf(objectKind: ObjectKind): { max: number; scope: NameScope; nature: SlugNature } {
  switch (objectKind) {
    case 'schema':
      return { max: budgetForNature('base'), scope: 'base', nature: 'base' }
    case 'table':
    case 'sql_view':
      return { max: budgetForNature('table'), scope: 'table', nature: 'table' }
    default:
      return { max: budgetForNature('champ'), scope: 'field', nature: 'champ' }
  }
}

/**
 * Applies the rank suffix while respecting the budget (§6.1, step 5).
 *
 * "To add a suffix of `k` bytes, the candidate is first truncated to `MAX − k` bytes,
 * then stripped of a trailing `_`, then suffixed." Going from `_9` to `_10` therefore
 * truncates one byte further.
 */
export function applySuffix(candidate: string, rank: number, max: number): string {
  if (rank <= 1) return candidate
  const suffix = `_${rank}`
  const base = truncateHard(candidate, max - byteLength(suffix))
  return `${base}${suffix}`
}

/**
 * Allocates a physical name.
 *
 * The caller supplies the executor of the structure step's transaction: the registry
 * row is inserted in THAT transaction (§6.1, step 7), never in a separate one —
 * otherwise a later failure would leave a name reserved for an object that does not
 * exist.
 */
export async function allocateName(
  exec: Executor,
  ctx: RequestContext,
  request: AllocationRequest,
): Promise<AllocatedName> {
  const { max, scope, nature } = budgetOf(request.objectKind)

  // 1. Obtain a candidate: derived name, entered technical name, or label slug.
  let candidate: string
  let fallbackApplied = false

  if (request.derivedName !== undefined) {
    candidate = request.derivedName
  } else if (request.technicalName !== undefined) {
    // Slugification is not applied: the string must satisfy A as is.
    if (!isAlphabetA(request.technicalName)) {
      throw new BasedbError('IDENTIFIER_INVALID', {
        details: { technicalName: request.technicalName },
      })
    }
    candidate = request.technicalName
  } else if (request.label !== undefined) {
    const result = slugify(request.label, { max, nature })
    candidate = result.slug
    fallbackApplied = result.fallbackApplied
  } else {
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'allocation without label, technical name or derived name' },
    })
  }

  // 2 and 3. Escape a reserved prefix, then flag reserved words.
  const { candidate: escaped, needsSuffixLoop } = applyNameRestrictions(candidate, scope, max)

  // One advisory lock per scope serializes concurrent allocations: without it, two
  // transactions would both see `clients` free and the second would fail on the unique
  // index rather than receive `clients_2` (§6.4).
  const key = await lockKey(exec, request.scopeKind, request.scopeId)
  await exec.query('SELECT pg_advisory_xact_lock($1, $2)', [LOCK_CLASS_NAME_ALLOCATION, key])

  // 4, 5 and 6. Order imposed by A7: the bare candidate, THEN the derived fallbacks,
  // THEN numbering. A `_2` suffix is always the last resort, because it says nothing
  // about what the column designates.
  //
  // The fallbacks are tried under the lock taken above: testing them beforehand would
  // let another transaction take the name between the test and the insert.
  const fallbacks = needsSuffixLoop ? [] : (request.derivedFallbacks ?? [])
  const bareCandidates = needsSuffixLoop
    ? []
    : [escaped, ...fallbacks.map((f) => truncateHard(f, max))]

  for (const proposed of bareCandidates) {
    const registryName = nameToRegister(proposed, request)
    if (await isAvailable(exec, request.scopeId, registryName, request.objectKind)) {
      const nameId = await insertIntoRegistry(exec, ctx, registryName, request)
      return { name: registryName, nameId, fallbackApplied, rank: 1 }
    }
  }

  // Rank 1 has just been handled — or deliberately skipped, when the candidate is a
  // reserved word that `applyNameRestrictions` flagged.
  for (let rank = 2; rank <= 99; rank++) {
    const proposed = applySuffix(escaped, rank, max)
    const registryName = nameToRegister(proposed, request)

    if (await isAvailable(exec, request.scopeId, registryName, request.objectKind)) {
      const nameId = await insertIntoRegistry(exec, ctx, registryName, request)
      return { name: registryName, nameId, fallbackApplied, rank }
    }
  }

  // 6. Beyond `_99`.
  throw new BasedbError('NAME_COLLISION_UNRESOLVED', {
    details: { candidate: escaped, scopeId: request.scopeId },
  })
}

/**
 * Integer key of the scope's advisory lock, READ FROM THE CATALOG (A8).
 *
 * Never `hashtext()`: its collisions would cause mutual blocking between unrelated
 * bases, and diagnosing such a block — two operations waiting on each other without
 * sharing a single object — would cost hours. The keys come from a sequence shared by
 * `base`, `db_schema` and `table_def`, which makes them unique across scope kinds; key
 * 1 is reserved for the instance scope.
 */
async function lockKey(exec: Executor, scopeKind: ScopeKind, scopeId: string): Promise<number> {
  if (scopeKind === 'instance') return 1

  const table = scopeKind === 'schema' ? '_basedb.db_schema' : '_basedb.table_def'
  const rows = await exec.query<{ lock_key: number }>(
    `SELECT lock_key FROM ${table} WHERE id = $1`,
    [scopeId],
  )

  const key = rows[0]?.lock_key
  if (key === undefined) {
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'allocation scope unknown to the catalog', scopeKind, scopeId },
    })
  }
  return key
}

/**
 * For a base, the suffix loop operates on the BASE SLUG, but the availability check and
 * the registry row carry the ASSEMBLED NAME `b_<tenantId>_<base>` (§6.1, "schema case").
 *
 * This is what makes multi-tenancy possible: two tenants each have their own "CRM"
 * base, `b_t4z56fq_crm` and `b_t9k2mnp_crm`, with neither collision nor spurious
 * suffix.
 */
function nameToRegister(proposed: string, request: AllocationRequest): string {
  if (request.objectKind !== 'schema') return proposed
  if (request.tenantId === undefined) {
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'schema allocation without tenantId' },
    })
  }
  return composeSchemaName(request.tenantId, proposed)
}

/**
 * Availability: no `(scope_id, name)` row in the registry, WHATEVER THE STATE of that
 * row — a name is never released (§6.3). For a schema, also absence from `pg_namespace`
 * (§11.3).
 */
async function isAvailable(
  exec: Executor,
  scopeId: string,
  name: string,
  objectKind: ObjectKind,
): Promise<boolean> {
  const taken = await exec.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM _basedb.physical_name WHERE scope_id = $1 AND name = $2) AS exists',
    [scopeId, name],
  )
  if (taken[0]?.exists === true) return false

  if (objectKind === 'schema') {
    const occupied = await exec.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists',
      [name],
    )
    if (occupied[0]?.exists === true) {
      // A schema present in the host database without being known to the registry is
      // not an ordinary collision: it is an object basedb did not create, and renaming
      // or overwriting it would be worse than refusing.
      throw new BasedbError('NAME_TAKEN_OUTSIDE_REGISTRY', { details: { schema: name } })
    }
  }

  return true
}

/** Inserts the registry row, inside the current structure step's transaction. */
async function insertIntoRegistry(
  exec: Executor,
  ctx: RequestContext,
  name: string,
  request: AllocationRequest,
): Promise<string> {
  const rows = await exec.query<{ id: string }>(
    `INSERT INTO _basedb.physical_name
       (scope_kind, scope_id, name, object_kind, state, slug_version, allocated_by)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)
     RETURNING id`,
    [request.scopeKind, request.scopeId, name, request.objectKind, SLUG_VERSION, ctx.actor.id],
    'insert',
  )

  const id = rows[0]?.id
  if (id === undefined) {
    throw new BasedbError('INTERNAL_ERROR', {
      details: { reason: 'registry insert returned no id' },
    })
  }
  return id
}
