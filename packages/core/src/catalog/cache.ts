import { createHash } from 'node:crypto'
import type { ActorGrants } from '../rbac/decide.js'
import type { Executor } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'

/**
 * Catalog and authorization cache — chapter 02 § "Schema loading", chapter 05 §7.2,
 * chapter 08 §9.2.
 *
 * Two counters govern everything, and there are no others: `base.catalog_version` for
 * the structure, `tenant.authz_version` for the rights. Chapter 05 is explicit —
 * `authz_version` is "the ONLY invalidation counter for the product's rights: there
 * exists no other, under no other name", because two counters for the same thing
 * diverge at the first write.
 *
 * Both are kept by triggers, hence honest whoever writes: the product's promise is that
 * one writes in direct SQL, so a counter maintained by the application would be wrong
 * from the first `INSERT` that went around it.
 *
 * A TTL of 30 seconds sits ON TOP of the counters, and it is not redundant: a token or
 * a role reaching its `expires_at` changes no row, so no counter moves. Only the clock
 * catches that one.
 */

/** Chapter 05 §7.2: the lifetime of an authorization snapshot. */
export const SNAPSHOT_TTL_MS = 30_000

/** Chapter 08 §9.2: per-process bound on memoized serialized documents. */
export const DOCUMENT_CACHE_ENTRIES = 64

/**
 * Chapter 08 §9.2: beyond this, generation is refused and `?tables=` becomes mandatory.
 * A 500-table base serializes to some 6 MiB, which no client wants in one piece.
 */
export const DOCUMENT_MAX_BYTES = 2 * 1024 * 1024

/**
 * Application version, which enters the `ETag`.
 *
 * Without it, during a rolling deployment, one process would serve a `304` for a
 * document the other version would have generated differently.
 */
export const APPLICATION_VERSION = '0.6.1'

/** The two counters, read in one query. */
export interface CatalogVersions {
  /** Fingerprint over every live base of the tenant and its `catalog_version`. */
  readonly catalog: string
  readonly authz: number
}

/**
 * Reads the two counters.
 *
 * A fingerprint rather than a `max()`: a maximum would not notice a base being dropped,
 * and a sum would collide. `string_agg` over (id, version) notices an addition, a
 * removal and a modification alike, for the same single round trip.
 */
export async function readVersions(
  exec: Executor,
  tenantRef: string,
): Promise<CatalogVersions | null> {
  // The projects enter the fingerprint too, and a base's project with it: creating,
  // renaming or deleting a project, or moving a base into another, changes no
  // `catalog_version`, yet changes what every reader is shown.
  const rows = await exec.query<{ authz_version: string; catalog: string }>(
    `SELECT t.authz_version,
            coalesce(
              md5(string_agg(b.id::text || ':' || b.catalog_version::text || ':'
                             || b.project_id::text, ',' ORDER BY b.id)),
              'aucune-base'
            ) || ':' || coalesce(
              (SELECT md5(string_agg(p.id::text || ':' || p.updated_at::text, ',' ORDER BY p.id))
                 FROM _basedb.project p
                WHERE p.tenant_id = t.id AND p.deleted_at IS NULL),
              'aucun-projet'
            ) AS catalog
       FROM _basedb.tenant t
       LEFT JOIN _basedb.base b
              ON b.tenant_id = t.id AND b.is_live AND b.deleted_at IS NULL
      WHERE t.ref = $1
      GROUP BY t.id, t.authz_version`,
    [tenantRef],
  )

  const row = rows[0]
  if (row === undefined) return null
  return { catalog: row.catalog, authz: Number(row.authz_version) }
}

interface Entry<T> {
  readonly value: T
  readonly versions: CatalogVersions
  readonly storedAt: number
}

/**
 * A bounded cache whose entries are valid only while the counters have not moved AND
 * the snapshot has not aged out.
 *
 * `Map` iterates in insertion order, which is all an LRU needs: re-reading an entry
 * moves it to the end, and eviction takes the first.
 */
export class VersionedCache<T> {
  private readonly entries = new Map<string, Entry<T>>()

  constructor(private readonly capacity: number) {}

  get(key: string, versions: CatalogVersions, now: number): T | undefined {
    const entry = this.entries.get(key)
    if (entry === undefined) return undefined

    const stale =
      entry.versions.catalog !== versions.catalog ||
      entry.versions.authz !== versions.authz ||
      now - entry.storedAt > SNAPSHOT_TTL_MS

    if (stale) {
      this.entries.delete(key)
      return undefined
    }

    // Re-insert to mark it as the most recently used.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, versions: CatalogVersions, now: number, value: T): void {
    this.entries.delete(key)
    this.entries.set(key, { value, versions, storedAt: now })
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  /** For the tests, and for a process that wants to start from a known state. */
  clear(): void {
    this.entries.clear()
  }

  get size(): number {
    return this.entries.size
  }
}

/** The tenant's raw catalog — what the five loading queries produce. */
export const catalogCache = new VersionedCache<unknown>(DOCUMENT_CACHE_ENTRIES)

/** An actor's effective grants. Keyed by actor, invalidated by `authz_version`. */
export const grantsCache = new VersionedCache<ActorGrants>(DOCUMENT_CACHE_ENTRIES)

/** Serialized documents, keyed by their `ETag` (§9.2). */
export const documentCache = new VersionedCache<string>(DOCUMENT_CACHE_ENTRIES)

export function clearCaches(): void {
  catalogCache.clear()
  grantsCache.clear()
  documentCache.clear()
}

/**
 * Fingerprint of the caller's effective rights.
 *
 * It enters the `ETag` so that a copy kept by another actor can never be validated:
 * without it, two readers with different rights would share one validator, and the
 * narrower of the two would revalidate into the wider one's document.
 */
export function permissionsFingerprint(grants: ActorGrants): string {
  const roles = grants.roles
    .map((r) => r.id)
    .sort()
    .join(',')
  return createHash('sha256')
    .update(`${grants.isInstanceAdmin ? 'admin' : 'user'}|${roles}`)
    .digest('hex')
    .slice(0, 16)
}

/**
 * `ETag` of a serialized document — chapter 08 §9.2.
 *
 * SHA-256 of (`catalog_version`, `authz_version`, rights fingerprint, application
 * version) — and NOT of the document itself. That is the whole point: the chapter
 * requires a `304` on `If-None-Match` to be served WITHOUT REBUILDING, so the validator
 * must be computable from the counters alone. Hashing the bytes would force the
 * generation the `304` exists to avoid.
 *
 * `kind` and `reference` are in there because the three serializations of the same base,
 * and two different bases, are four distinct documents behind four distinct URLs.
 */
export function etagFor(
  ctx: RequestContext,
  versions: CatalogVersions,
  grants: ActorGrants,
  kind: 'meta' | 'openapi' | 'doc',
  reference: string,
): string {
  const digest = createHash('sha256')
    .update(
      [
        ctx.tenantId,
        reference,
        kind,
        versions.catalog,
        String(versions.authz),
        permissionsFingerprint(grants),
        APPLICATION_VERSION,
      ].join('|'),
    )
    .digest('hex')
  return `"${digest.slice(0, 32)}"`
}
