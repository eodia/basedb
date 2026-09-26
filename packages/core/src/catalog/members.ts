import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The people of a tenant, as a `user` field names them — chapter 04, « Personne ».
 *
 * A `user` column holds an identifier and nothing else: its name is read here, by whoever
 * reads the table, so that a cell shows « Léa Martin » rather than a UUID. Members of the
 * tenant see each other's names and addresses — they already share its bases. A disabled
 * account is listed, flagged: rows assigned to someone who left still say to whom; a
 * deleted one is not, and the system accounts never are.
 */

export interface Member {
  readonly id: string
  readonly displayName: string
  readonly email: string
  readonly disabled: boolean
}

export async function listMembers(pools: Pools, ctx: RequestContext): Promise<Member[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const rows = await exec.query<{
        id: string
        display_name: string
        email: string
        disabled: boolean
      }>(
        `SELECT u.id::text, u.display_name, u.email, u.disabled_at IS NOT NULL AS disabled
           FROM _basedb.app_user u
           JOIN _basedb.tenant t ON t.id = u.tenant_id
          WHERE t.ref = $1 AND u.deleted_at IS NULL
            -- The bootstrap account is a system one, yet a person who signs in (see users.ts).
            AND (NOT u.is_system OR u.is_instance_admin)
          ORDER BY u.display_name, u.email`,
        [ctx.tenantId],
      )
      return rows.map((r) => ({
        id: r.id,
        displayName: r.display_name,
        email: r.email,
        disabled: r.disabled,
      }))
    },
    { readOnly: true },
  )
}
