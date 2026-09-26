import {
  type Template,
  type TemplateIssue,
  type TemplateSummary,
  checkTemplate,
  summarizeTemplate,
} from '@basedb/contracts'
import { bundledTemplates } from '@basedb/templates'
import { BasedbError } from '../errors/index.js'
import { loadGrants } from '../rbac/loader.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'

/**
 * The catalog of base templates — chapter 20 §3.
 *
 * Three sources, one format: the templates an administrator imported into the instance,
 * those the public site publishes, and those the application carries — the same files as
 * the site's, as they were when it was built. Under one key the instance's wins over the
 * site's, which wins over the carried one. Every template is checked by the shared
 * validator before it is served; a broken one is left out without leaving out the others.
 */

export type TemplateSource = 'instance' | 'site' | 'bundled'

export interface CatalogEntry {
  readonly template: Template
  readonly source: TemplateSource
}

export interface CatalogListing {
  readonly templates: ReadonlyArray<TemplateSummary & { readonly source: TemplateSource }>
  /** How the site's catalog is doing — `null` when reading it is switched off. */
  readonly site: {
    readonly url: string
    readonly fetched_at: string | null
    readonly error: string | null
  } | null
}

export interface CatalogConfig {
  /** Where the site publishes its catalog; `null`: not read (`BASEDB_TEMPLATES_URL=off`). */
  readonly url: string | null
  readonly targets: TargetPolicy
}

/** The public site's catalog, read when `BASEDB_TEMPLATES_URL` says nothing. */
export const DEFAULT_TEMPLATES_URL = 'https://eodia.github.io/basedb/modeles/catalogue.json'

const TTL_MS = 60 * 60_000
/** After a failure, the site is asked again sooner than after a success. */
const RETRY_MS = 5 * 60_000
const TIMEOUT_MS = 5000
const MAX_BYTES = 2 * 1024 * 1024

// ── The carried templates ────────────────────────────────────────────────────────────

let carried: readonly Template[] | null = null

function bundled(): readonly Template[] {
  if (carried === null) {
    carried = bundledTemplates().flatMap(({ raw }) => {
      const check = checkTemplate(raw)
      return check.ok ? [check.template] : []
    })
  }
  return carried
}

// ── The site's ───────────────────────────────────────────────────────────────────────

interface SiteState {
  readonly url: string
  readonly templates: readonly Template[]
  readonly fetchedAt: number | null
  readonly nextAt: number
  readonly error: string | null
}

let site: SiteState | null = null
let inflight: Promise<void> | null = null

/** Forgets what was read of the site — for tests, and when the address changes. */
export function resetTemplateCatalog(): void {
  site = null
  inflight = null
  carried = null
}

async function readSite(config: CatalogConfig): Promise<SiteState | null> {
  const url = config.url
  if (url === null) return null
  if (site === null || site.url !== url) {
    site = { url, templates: [], fetchedAt: null, nextAt: 0, error: null }
  }
  if (Date.now() >= site.nextAt) {
    inflight ??= refresh(url, config.targets).finally(() => {
      inflight = null
    })
    await inflight
  }
  return site
}

async function refresh(url: string, targets: TargetPolicy): Promise<void> {
  const previous = site?.templates ?? []
  try {
    const text = await fetchCatalog(url, targets)
    const body = JSON.parse(text) as unknown
    const list = Array.isArray(body)
      ? body
      : typeof body === 'object' &&
          body !== null &&
          Array.isArray((body as { templates?: unknown }).templates)
        ? ((body as { templates: unknown[] }).templates as unknown[])
        : null
    if (list === null) throw new Error('catalogue_illisible')
    const templates = list.flatMap((raw) => {
      const check = checkTemplate(raw)
      return check.ok ? [check.template] : []
    })
    site = { url, templates, fetchedAt: Date.now(), nextAt: Date.now() + TTL_MS, error: null }
  } catch (error) {
    // The last good copy stays: a site that does not answer for an hour takes nothing away.
    site = {
      url,
      templates: previous,
      fetchedAt: site?.fetchedAt ?? null,
      nextAt: Date.now() + RETRY_MS,
      error: error instanceof Error ? error.message : 'injoignable',
    }
  }
}

async function fetchCatalog(url: string, targets: TargetPolicy): Promise<string> {
  const checked = await checkTarget(url, targets).catch(() => {
    throw new Error('adresse_refusee')
  })
  let response: Response
  try {
    response = await fetch(checked, {
      headers: { accept: 'application/json', 'user-agent': 'basedb-templates/1' },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new Error('injoignable')
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error(`http_${response.status}`)
  }
  const reader = response.body?.getReader()
  if (reader === undefined) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new Error('trop_volumineux')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// ── The instance's ───────────────────────────────────────────────────────────────────

async function instanceTemplates(pools: Pools, ctx: RequestContext): Promise<Template[]> {
  const rows = await withTransaction(
    pools,
    'catalog',
    ctx,
    (exec) =>
      exec.query<{ body: unknown }>(
        `SELECT t.body
           FROM _basedb.template t
           JOIN _basedb.tenant n ON n.id = t.tenant_id
          WHERE n.ref = $1
          ORDER BY t.label`,
        [ctx.tenantId],
      ),
    { readOnly: true },
  )
  return rows.flatMap(({ body }) => {
    const check = checkTemplate(body)
    return check.ok ? [check.template] : []
  })
}

async function entries(
  pools: Pools,
  ctx: RequestContext,
  config: CatalogConfig,
): Promise<{
  readonly entries: CatalogEntry[]
  readonly site: SiteState | null
}> {
  const [own, read] = await Promise.all([instanceTemplates(pools, ctx), readSite(config)])
  const out: CatalogEntry[] = []
  const taken = new Set<string>()
  const add = (templates: readonly Template[], source: TemplateSource) => {
    for (const template of templates) {
      if (taken.has(template.key)) continue
      taken.add(template.key)
      out.push({ template, source })
    }
  }
  add(own, 'instance')
  add(read?.templates ?? [], 'site')
  add(bundled(), 'bundled')
  return { entries: out, site: read }
}

/** The gallery: a summary of each template, where it comes from, and how the site is doing. */
export async function listTemplates(
  pools: Pools,
  ctx: RequestContext,
  config: CatalogConfig,
): Promise<CatalogListing> {
  const found = await entries(pools, ctx, config)
  return {
    templates: found.entries.map(({ template, source }) => ({
      ...summarizeTemplate(template),
      source,
    })),
    site:
      found.site === null
        ? null
        : {
            url: found.site.url,
            fetched_at:
              found.site.fetchedAt === null ? null : new Date(found.site.fetchedAt).toISOString(),
            error: found.site.error,
          },
  }
}

/** One template, whole. */
export async function getTemplate(
  pools: Pools,
  ctx: RequestContext,
  config: CatalogConfig,
  key: string,
): Promise<CatalogEntry> {
  const found = (await entries(pools, ctx, config)).entries.find((e) => e.template.key === key)
  if (found === undefined)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { template: key } })
  return found
}

async function requireInstanceAdmin(pools: Pools, ctx: RequestContext): Promise<void> {
  const grants = await withTransaction(pools, 'catalog', ctx, (exec) => loadGrants(exec, ctx), {
    readOnly: true,
  })
  if (!grants.isInstanceAdmin) {
    throw new BasedbError('ADMIN_REQUIRED', { details: { action: 'templates' } })
  }
}

/** Refuses a template with the issues that say why — `TEMPLATE_INVALID`. */
export function invalidTemplate(issues: readonly TemplateIssue[]): BasedbError {
  return new BasedbError('TEMPLATE_INVALID', { details: { issues: issues.slice(0, 50) } })
}

/** Imports a template into the instance, or replaces the one of the same key (§3.2). */
export async function importTemplate(
  pools: Pools,
  ctx: RequestContext,
  raw: unknown,
): Promise<TemplateSummary & { readonly source: 'instance' }> {
  await requireInstanceAdmin(pools, ctx)
  const check = checkTemplate(raw)
  if (!check.ok) throw invalidTemplate(check.issues)
  const template = check.template
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    const [tenant] = await exec.query<{ id: string }>(
      'SELECT id FROM _basedb.tenant WHERE ref = $1 AND deleted_at IS NULL',
      [ctx.tenantId],
    )
    if (tenant === undefined)
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tenant: ctx.tenantId } })
    await exec.query(
      `INSERT INTO _basedb.template (tenant_id, key, label, body, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (tenant_id, key) DO UPDATE
         SET label = EXCLUDED.label, body = EXCLUDED.body,
             updated_at = clock_timestamp(), updated_by = EXCLUDED.updated_by`,
      [tenant.id, template.key, template.label, JSON.stringify(template), ctx.actor.id],
      'insert',
    )
  })
  return { ...summarizeTemplate(template), source: 'instance' }
}

/** Takes a template out of the instance; the site's or the carried one of that key shows again. */
export async function deleteTemplate(
  pools: Pools,
  ctx: RequestContext,
  key: string,
): Promise<void> {
  await requireInstanceAdmin(pools, ctx)
  const removed = await withTransaction(pools, 'catalog', ctx, (exec) =>
    exec.query<{ id: string }>(
      `DELETE FROM _basedb.template t
         USING _basedb.tenant n
        WHERE n.id = t.tenant_id AND n.ref = $1 AND t.key = $2
        RETURNING t.id`,
      [ctx.tenantId, key],
      'delete',
    ),
  )
  if (removed.length === 0)
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { template: key } })
}
