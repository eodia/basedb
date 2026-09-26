import { seal, unseal } from '../auth/sealing.js'
import { BasedbError } from '../errors/index.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Slack — chapter 19 §1: a base's connections to channels, by incoming webhook. The
 * address is an authorisation: sealed by the instance key, never read back, and only a
 * `hooks.slack.com` one is accepted — the server posts nowhere else by this path.
 */

const PURPOSE = 'integration/slack'
const TIMEOUT_MS = 10_000

export interface Integration {
  readonly id: string
  readonly kind: 'slack'
  readonly label: string
  /** The end of the address, to recognise it without revealing it. */
  readonly hint: string
  readonly createdAt: string
}

/**
 * An incoming webhook of Slack, or a refusal. In development (`anyHost`, the relaxed
 * webhook policy) any address is taken, so that a local stand-in can receive the message.
 */
export function checkedSlackUrl(raw: unknown, anyHost = false): string {
  const text = typeof raw === 'string' ? raw.trim() : ''
  let url: URL | null = null
  try {
    url = new URL(text)
  } catch {
    url = null
  }
  if (anyHost && url !== null && /^https?:$/.test(url.protocol)) return url.toString()
  if (
    url === null ||
    url.protocol !== 'https:' ||
    url.hostname !== 'hooks.slack.com' ||
    url.username !== '' ||
    url.password !== '' ||
    !/^\/(services|workflows|triggers)\//.test(url.pathname)
  ) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'url', reason: 'webhook_slack_attendu' },
    })
  }
  return url.toString()
}

/** Posts a message to a channel; any answer but 2xx is a failure said by its status. */
export async function postToSlack(url: string, text: string): Promise<number> {
  let status: number
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'basedb/1' },
      body: JSON.stringify({ text }),
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    await response.body?.cancel().catch(() => undefined)
    status = response.status
  } catch {
    throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: 'injoignable' } })
  }
  if (status < 200 || status >= 300) {
    throw new BasedbError('AUTOMATION_WEBHOOK_FAILED', { details: { reason: `http_${status}` } })
  }
  return status
}

/** The address of a connection of a base, opened for sending — `null` when gone. */
export async function slackUrlOf(
  exec: Executor,
  instanceKey: string,
  request: { readonly baseId: string; readonly id: string },
): Promise<string | null> {
  const [row] = await exec.query<{ url_sealed: string }>(
    `SELECT url_sealed FROM _basedb.integration
      WHERE id::text = $1 AND base_id = $2 AND kind = 'slack' AND deleted_at IS NULL`,
    [request.id, request.baseId],
  )
  return row === undefined ? null : unseal(instanceKey, PURPOSE, row.url_sealed)
}

export async function listIntegrations(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Integration[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      const rows = await exec.query<{
        id: string
        label: string
        url_hint: string
        created_at: string
      }>(
        `SELECT id::text, label, url_hint, created_at::text FROM _basedb.integration
          WHERE base_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
        [request.baseId],
      )
      return rows.map((r) => ({
        id: r.id,
        kind: 'slack' as const,
        label: r.label,
        hint: r.url_hint,
        createdAt: r.created_at,
      }))
    },
    { readOnly: true },
  )
}

export async function createIntegration(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: {
    readonly baseId: string
    readonly label: unknown
    readonly url: unknown
    readonly anyHost?: boolean
  },
): Promise<Integration> {
  const url = checkedSlackUrl(request.url, request.anyHost === true)
  const label = typeof request.label === 'string' ? request.label.trim().slice(0, 255) : ''
  if (label === '') {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'label', reason: 'libelle_invalide' },
    })
  }
  const hint = `…/${url.replace(/\/+$/, '').slice(-4)}`
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const [row] = await exec.query<{ id: string; created_at: string }>(
      `INSERT INTO _basedb.integration (tenant_id, base_id, kind, label, url_sealed, url_hint, created_by)
       SELECT b.tenant_id, b.id, 'slack', $2, $3, $4, $5 FROM _basedb.base b WHERE b.id = $1
       RETURNING id::text, created_at::text`,
      [request.baseId, label, seal(instanceKey, PURPOSE, url), hint, ctx.actor.id],
      'insert',
    )
    const created = row as { id: string; created_at: string }
    return { id: created.id, kind: 'slack', label, hint, createdAt: created.created_at }
  })
}

export async function deleteIntegration(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const rows = await exec.query(
      `UPDATE _basedb.integration SET deleted_at = pg_catalog.clock_timestamp()
        WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL RETURNING id`,
      [request.id, request.baseId],
      'update',
    )
    if (rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { integration: request.id } })
    }
  })
}

/** Sends a test message: what Slack answered, or why nothing arrived. */
export async function testIntegration(
  pools: Pools,
  ctx: RequestContext,
  instanceKey: string,
  request: { readonly baseId: string; readonly id: string },
): Promise<{ readonly status: number }> {
  const { url, label } = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      const [row] = await exec.query<{ label: string }>(
        `SELECT label FROM _basedb.integration
          WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL`,
        [request.id, request.baseId],
      )
      const opened = await slackUrlOf(exec, instanceKey, request)
      if (row === undefined || opened === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { integration: request.id } })
      }
      return { url: opened, label: row.label }
    },
    { readOnly: true },
  )
  return {
    status: await postToSlack(
      url,
      `Message d’essai de basedb : la connexion « ${label} » fonctionne.`,
    ),
  }
}
