import { loadGrants } from '../rbac/loader.js'
import { administers } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The people of a tenant, as a `user` field names them — chapter 04, « Personne ».
 *
 * A `user` column holds an identifier and nothing else: its name is read here, by whoever
 * reads the table, so that a cell shows « Léa Martin » rather than a UUID. A disabled
 * account is listed, flagged: rows assigned to someone who left still say to whom; a
 * deleted one is not, and the system accounts never are.
 *
 * Not the whole tenant: anyone may create an account (chapter 13 §8), so a person sees
 * the people they share a project with — whoever holds any access in a project where they
 * hold one — and themselves. The administrators see everyone.
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
      const everyone = administers(ctx, await loadGrants(exec, ctx))
      const rows = await exec.query<{
        id: string
        display_name: string
        email: string
        disabled: boolean
      }>(
        `WITH reach AS (
           -- The project of every grant, whatever the node it is given on.
           SELECT m.user_id,
                  coalesce(p.scope_project_id, b.project_id, tb.project_id, ab.project_id)
                    AS project_id
             FROM _basedb.permission p
             JOIN _basedb.role_member m      ON m.role_id = p.role_id
             LEFT JOIN _basedb.base b        ON b.id = p.scope_base_id
             LEFT JOIN _basedb.table_def td  ON td.id = p.scope_table_id
             LEFT JOIN _basedb.base tb       ON tb.id = td.base_id
             LEFT JOIN _basedb.application a ON a.id = p.scope_application_id
             LEFT JOIN _basedb.base ab       ON ab.id = a.base_id
            WHERE p.scope_kind <> 'tenant'
         )
         SELECT u.id::text, u.display_name, u.email, u.disabled_at IS NOT NULL AS disabled
           FROM _basedb.app_user u
           JOIN _basedb.tenant t ON t.id = u.tenant_id
          WHERE t.ref = $1 AND u.deleted_at IS NULL
            -- The bootstrap account is a system one, yet a person who signs in (see users.ts).
            AND (NOT u.is_system OR u.is_instance_admin)
            AND ($3::boolean OR u.id = $2::uuid OR EXISTS (
                  SELECT 1 FROM reach theirs JOIN reach mine ON mine.project_id = theirs.project_id
                   WHERE theirs.user_id = u.id AND mine.user_id = $2::uuid))
          ORDER BY u.display_name, u.email`,
        [ctx.tenantId, ctx.actor.id, everyone],
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
