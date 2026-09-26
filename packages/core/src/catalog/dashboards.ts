import { canReadTable } from '../collab/signals.js'
import { BasedbError } from '../errors/index.js'
import { requireOnBase } from '../rbac/require.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Dashboards — chapter 18: blocks on a grid of three columns, each reading through the
 * ordinary routes with the rights of whoever looks. What is kept here is only their
 * layout and settings, checked when saved; nothing here opens anything.
 */

export const MAX_BLOCKS = 24

export type Block =
  | {
      readonly kind: 'number'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max'
      readonly field: string | null
      readonly filter: string
    }
  | {
      readonly kind: 'chart'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly groupBy: string
      readonly filter: string
      readonly style: 'bar' | 'pie'
    }
  | {
      readonly kind: 'list'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly fields: readonly string[]
      readonly filter: string
      readonly sort: string
      readonly limit: number
    }
  | { readonly kind: 'text'; readonly width: number; readonly title: string; readonly body: string }
  | {
      readonly kind: 'embed'
      readonly width: number
      readonly title: string
      readonly url: string
      readonly height: number
    }

export interface Dashboard {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly position: number
  readonly blocks: readonly Block[]
  readonly updatedAt: string
}

export interface DashboardInput {
  readonly label?: unknown
  readonly description?: unknown
  readonly blocks?: unknown
  readonly position?: unknown
}

const invalid = (field: string, reason: string, detail?: unknown) =>
  new BasedbError('REQUEST_INVALID', {
    details: { field, reason, ...(detail === undefined ? {} : { detail }) },
  })

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

/** The live tables of a base, by key, with their fields' names. */
async function tablesOf(exec: Executor, baseId: string) {
  const rows = await exec.query<{ id: string; name: string; field: string | null }>(
    `SELECT t.id::text, tn.name, fn.name AS field
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       LEFT JOIN _basedb.field f ON f.table_id = t.id AND f.is_live
       LEFT JOIN _basedb.physical_name fn ON fn.id = f.name_id
      WHERE t.base_id = $1 AND t.is_live`,
    [baseId],
  )
  const out = new Map<string, { id: string; name: string; fields: Set<string> }>()
  for (const r of rows) {
    const table = out.get(r.id) ?? { id: r.id, name: r.name, fields: new Set<string>() }
    if (r.field !== null) table.fields.add(r.field)
    out.set(r.id, table)
  }
  return out
}

function checkedBlocks(raw: unknown, tables: Awaited<ReturnType<typeof tablesOf>>): Block[] {
  if (!Array.isArray(raw)) throw invalid('blocks', 'liste_attendue')
  if (raw.length > MAX_BLOCKS) throw invalid('blocks', 'trop_de_blocs', MAX_BLOCKS)
  return raw.map((item, index): Block => {
    const b = (item ?? {}) as Record<string, unknown>
    const at = `blocks[${index}]`
    const width = b.width === 2 || b.width === 3 ? b.width : 1
    const title = text(b.title, 120)
    const tableOf = () => {
      const found = [...tables.values()].find((t) => t.id === b.table || t.name === b.table)
      if (found === undefined) throw invalid(`${at}.table`, 'table_inconnue', b.table)
      return found
    }
    const fieldOf = (table: { fields: Set<string> }, value: unknown, key: string) => {
      if (typeof value !== 'string' || !table.fields.has(value)) {
        throw invalid(`${at}.${key}`, 'champ_inconnu', value)
      }
      return value
    }
    switch (b.kind) {
      case 'number': {
        const table = tableOf()
        const aggregate = b.aggregate
        if (
          aggregate !== 'count' &&
          aggregate !== 'sum' &&
          aggregate !== 'avg' &&
          aggregate !== 'min' &&
          aggregate !== 'max'
        ) {
          throw invalid(`${at}.aggregate`, 'agregat_invalide', aggregate)
        }
        const field = aggregate === 'count' ? null : fieldOf(table, b.field, 'field')
        return {
          kind: 'number',
          width,
          title,
          table: table.id,
          aggregate,
          field,
          filter: text(b.filter, 4000),
        }
      }
      case 'chart': {
        const table = tableOf()
        return {
          kind: 'chart',
          width,
          title,
          table: table.id,
          groupBy: fieldOf(table, b.group_by ?? b.groupBy, 'group_by'),
          filter: text(b.filter, 4000),
          style: b.style === 'pie' ? 'pie' : 'bar',
        }
      }
      case 'list': {
        const table = tableOf()
        const fields = Array.isArray(b.fields) ? b.fields : []
        if (fields.length === 0 || fields.length > 6)
          throw invalid(`${at}.fields`, 'un_a_six_champs')
        const limit = typeof b.limit === 'number' ? Math.round(b.limit) : 10
        return {
          kind: 'list',
          width,
          title,
          table: table.id,
          fields: fields.map((f) => fieldOf(table, f, 'fields')),
          filter: text(b.filter, 4000),
          sort: text(b.sort, 200),
          limit: Math.min(Math.max(limit, 1), 20),
        }
      }
      case 'text':
        return { kind: 'text', width, title, body: text(b.body, 5000) }
      case 'embed': {
        const url = text(b.url, 2048)
        let parsed: URL | null = null
        try {
          parsed = new URL(url)
        } catch {
          parsed = null
        }
        if (parsed === null || parsed.protocol !== 'https:' || parsed.hostname === '') {
          throw invalid(`${at}.url`, 'adresse_invalide')
        }
        const height = typeof b.height === 'number' ? Math.round(b.height) : 400
        return { kind: 'embed', width, title, url, height: Math.min(Math.max(height, 200), 1200) }
      }
      default:
        throw invalid(`${at}.kind`, 'bloc_inconnu', b.kind)
    }
  })
}

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly position: number
  readonly blocks: Block[]
  readonly updated_at: string
}

const shaped = (r: Row): Dashboard => ({
  id: r.id,
  label: r.label,
  description: r.description,
  position: r.position,
  blocks: r.blocks,
  updatedAt: r.updated_at,
})

/**
 * The dashboards of a base, for whoever sees it — who may read at least one of its tables.
 * The blocks keep their silence themselves, on the reader's rights.
 */
export async function listDashboards(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string },
): Promise<Dashboard[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const tables = await exec.query<{ id: string }>(
        'SELECT id::text FROM _basedb.table_def WHERE base_id = $1 AND is_live',
        [request.baseId],
      )
      let sees = false
      for (const t of tables) {
        if (await canReadTable(exec, ctx, t.id)) {
          sees = true
          break
        }
      }
      if (!sees) {
        // A base whose manager has no table yet is still theirs to arrange.
        await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      }
      const rows = await exec.query<Row>(
        `SELECT id::text, label, description, position, blocks, updated_at::text
           FROM _basedb.dashboard
          WHERE base_id = $1 AND deleted_at IS NULL
          ORDER BY position, created_at`,
        [request.baseId],
      )
      return rows.map(shaped)
    },
    { readOnly: true },
  )
}

export async function createDashboard(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly input: DashboardInput },
): Promise<Dashboard> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const label = text(request.input.label, 255)
    if (label === '') throw invalid('label', 'libelle_invalide')
    const blocks = checkedBlocks(request.input.blocks ?? [], await tablesOf(exec, request.baseId))
    const [row] = await exec.query<Row>(
      `INSERT INTO _basedb.dashboard (base_id, label, description, position, blocks, created_by, updated_by)
       SELECT $1, $2, $3, coalesce(max(position), 0) + 1, $4::jsonb, $5, $5
         FROM _basedb.dashboard WHERE base_id = $1 AND deleted_at IS NULL
       RETURNING id::text, label, description, position, blocks, updated_at::text`,
      [
        request.baseId,
        label,
        text(request.input.description, 2000) || null,
        JSON.stringify(blocks),
        ctx.actor.id,
      ],
      'insert',
    )
    return shaped(row as Row)
  })
}

export async function updateDashboard(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string; readonly input: DashboardInput },
): Promise<Dashboard> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const [current] = await exec.query<Row>(
      `SELECT id::text, label, description, position, blocks, updated_at::text
         FROM _basedb.dashboard
        WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL`,
      [request.id, request.baseId],
    )
    if (current === undefined) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { dashboard: request.id } })
    }
    const input = request.input
    const label = input.label === undefined ? current.label : text(input.label, 255)
    if (label === '') throw invalid('label', 'libelle_invalide')
    const description =
      input.description === undefined ? current.description : text(input.description, 2000) || null
    const blocks =
      input.blocks === undefined
        ? current.blocks
        : checkedBlocks(input.blocks, await tablesOf(exec, request.baseId))
    const position =
      typeof input.position === 'number' ? Math.round(input.position) : current.position
    const [row] = await exec.query<Row>(
      `UPDATE _basedb.dashboard
          SET label = $2, description = $3, blocks = $4::jsonb, position = $5,
              updated_by = $6, updated_at = pg_catalog.clock_timestamp()
        WHERE id = $1
        RETURNING id::text, label, description, position, blocks, updated_at::text`,
      [current.id, label, description, JSON.stringify(blocks), position, ctx.actor.id],
      'update',
    )
    return shaped(row as Row)
  })
}

export async function deleteDashboard(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly id: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
    const rows = await exec.query(
      `UPDATE _basedb.dashboard SET deleted_at = pg_catalog.clock_timestamp()
        WHERE id::text = $1 AND base_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [request.id, request.baseId],
      'update',
    )
    if (rows.length === 0) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { dashboard: request.id } })
    }
  })
}
