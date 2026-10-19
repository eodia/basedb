import { RUNS_PER_HOUR, usedThisHour } from '../automations/engine.js'
import { BasedbError } from '../errors/index.js'
import { requireOnTable } from '../rbac/require.js'
import { listRecords } from '../records/list.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * The buttons of a table's toolbar — chapter 11 §1.6, chapter 17 §1.1.
 *
 * A Button FIELD acts on its own row. A toolbar button belongs to the table: every grid of
 * it shows the button, to whoever reads the table; whoever manages its structure sets it.
 * It opens an address, or starts an automation on a target chosen with it — the rows
 * ticked, one run each; the rows of the view on screen, its filter included; or no row,
 * for an automation without a table (a clock, an address of its own).
 *
 * Pressing one asks no more than reading the table: as with a Button field, the
 * automation acts with its owner's authority, and the person pressing only says when, and
 * on which rows they can read. The automation's hourly budget still bounds the runs.
 */

export const BUTTON_TARGETS = ['selection', 'view', 'none'] as const
export type ButtonTarget = (typeof BUTTON_TARGETS)[number]

/** Rows one press may start a run for — no more than an automation's hourly budget. */
export const MAX_PRESSED_ROWS = RUNS_PER_HOUR

const MAX_BUTTONS = 12

export interface TableButton {
  readonly id: string
  readonly tableId: string
  readonly label: string
  /** `#rrggbb`, or `null` for the toolbar's own. */
  readonly color: string | null
  readonly action: 'url' | 'automation'
  readonly url: string | null
  readonly automation: { readonly id: string; readonly label: string } | null
  readonly target: ButtonTarget
  /** Ask before starting. */
  readonly confirm: boolean
  readonly position: number
}

interface Row extends Record<string, unknown> {
  readonly id: string
  readonly table_id: string
  readonly label: string
  readonly color: string | null
  readonly action: 'url' | 'automation'
  readonly url: string | null
  readonly automation_id: string | null
  readonly automation_label: string | null
  readonly target: ButtonTarget
  readonly confirm: boolean
  readonly position: number
}

const SELECT = `SELECT b.id::text, b.table_id::text, b.label, b.color, b.action, b.url,
                       b.automation_id::text, a.label AS automation_label, b.target, b.confirm,
                       b.position
                  FROM _basedb.table_button b
                  LEFT JOIN _basedb.automation a ON a.id = b.automation_id`

const toButton = (row: Row): TableButton => ({
  id: row.id,
  tableId: row.table_id,
  label: row.label,
  color: row.color,
  action: row.action,
  url: row.url,
  automation:
    row.automation_id === null
      ? null
      : { id: row.automation_id, label: row.automation_label ?? '' },
  target: row.target,
  confirm: row.confirm,
  position: row.position,
})

const refuse = (field: string, reason: string): never => {
  throw new BasedbError('REQUEST_INVALID', { details: { field, reason } })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The buttons of a table, in their order — for whoever reads it. */
export async function listTableButtons(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string },
): Promise<readonly TableButton[]> {
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnTable(exec, ctx, 'read', request.tableId)
      const rows = await exec.query<Row>(
        `${SELECT} WHERE b.table_id = $1 ORDER BY b.position, b.created_at`,
        [request.tableId],
      )
      return rows.map(toButton)
    },
    { readOnly: true },
  )
}

interface Settings {
  readonly label: string
  readonly color: string | null
  readonly action: 'url' | 'automation'
  readonly url: string | null
  readonly automationId: string | null
  readonly target: ButtonTarget
  readonly confirm: boolean
}

/**
 * What a button says, checked as the field Button checks its own: a label, a colour, an
 * address that opens a page or a mail — never a script —, or an automation of the same
 * base whose trigger fits the target.
 */
async function settingsOf(
  exec: Executor,
  tableId: string,
  input: Record<string, unknown>,
): Promise<Settings> {
  const label = typeof input.label === 'string' ? input.label.trim() : ''
  if (label.length < 1 || label.length > 60) refuse('label', 'libelle_invalide')
  const color =
    typeof input.color === 'string' && input.color !== '' ? input.color.toLowerCase() : null
  if (color !== null && !/^#[0-9a-f]{6}$/.test(color)) refuse('color', 'couleur_invalide')
  const action = input.action
  if (action !== 'url' && action !== 'automation') return refuse('action', 'action_inconnue')
  const confirm = input.confirm === true

  if (action === 'url') {
    const url = typeof input.url === 'string' ? input.url.trim() : ''
    if (url.length > 2048 || !/^(https?:\/\/|mailto:)/i.test(url)) refuse('url', 'adresse_invalide')
    return { label, color, action, url, automationId: null, target: 'none', confirm }
  }

  const target = BUTTON_TARGETS.find((t) => t === input.target)
  if (target === undefined) return refuse('target', 'cible_inconnue')
  const automationId = typeof input.automation === 'string' ? input.automation : ''
  if (!UUID.test(automationId)) refuse('automation', 'automatisation_inconnue')
  const [automation] = await exec.query<{ trigger_kind: string; table_id: string | null }>(
    `SELECT a.trigger_kind, a.table_id::text
       FROM _basedb.automation a
       JOIN _basedb.table_def t ON t.base_id = a.base_id AND t.id = $2
      WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [automationId, tableId],
  )
  if (automation === undefined) return refuse('automation', 'automatisation_inconnue')
  // Rows go to an automation that takes a row of THIS table, as a Button field's would;
  // no row, to one that takes none.
  const fits =
    target === 'none'
      ? automation.table_id === null
      : automation.trigger_kind === 'button' && automation.table_id === tableId
  if (!fits)
    refuse('automation', target === 'none' ? 'automatisation_sans_table' : 'declencheur_bouton')
  return { label, color, action, url: null, automationId, target, confirm }
}

export async function createTableButton(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly input: Record<string, unknown> },
): Promise<TableButton> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const s = await settingsOf(exec, request.tableId, request.input)
    const [count] = await exec.query<{ n: number; next: number }>(
      `SELECT count(*)::int AS n, coalesce(max(position) + 1, 0)::int AS next
         FROM _basedb.table_button WHERE table_id = $1`,
      [request.tableId],
    )
    if ((count?.n ?? 0) >= MAX_BUTTONS) refuse('table', 'trop_de_boutons')
    const [created] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.table_button
         (table_id, label, color, action, url, automation_id, target, confirm, position,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id::text`,
      [
        request.tableId,
        s.label,
        s.color,
        s.action,
        s.url,
        s.automationId,
        s.target,
        s.confirm,
        count?.next ?? 0,
        ctx.actor.id,
      ],
      'insert',
    )
    return readOne(exec, (created as { id: string }).id)
  })
}

export async function updateTableButton(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly buttonId: string
    readonly input: Record<string, unknown>
  },
): Promise<TableButton> {
  return withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const current = await readOne(exec, request.buttonId, request.tableId)
    // What the request leaves out stays as it was.
    const merged: Record<string, unknown> = {
      label: current.label,
      color: current.color,
      action: current.action,
      url: current.url,
      automation: current.automation?.id,
      target: current.target,
      confirm: current.confirm,
      ...request.input,
    }
    const s = await settingsOf(exec, request.tableId, merged)
    const position =
      typeof request.input.position === 'number' && Number.isInteger(request.input.position)
        ? request.input.position
        : current.position
    await exec.query(
      `UPDATE _basedb.table_button
          SET label = $2, color = $3, action = $4, url = $5, automation_id = $6, target = $7,
              confirm = $8, position = $9, updated_at = clock_timestamp(), updated_by = $10
        WHERE id = $1`,
      [
        current.id,
        s.label,
        s.color,
        s.action,
        s.url,
        s.automationId,
        s.target,
        s.confirm,
        position,
        ctx.actor.id,
      ],
      'update',
    )
    return readOne(exec, current.id)
  })
}

export async function deleteTableButton(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly tableId: string; readonly buttonId: string },
): Promise<void> {
  await withTransaction(pools, 'catalog', ctx, async (exec) => {
    await requireOnTable(exec, ctx, 'manage_schema', request.tableId)
    const current = await readOne(exec, request.buttonId, request.tableId)
    await exec.query('DELETE FROM _basedb.table_button WHERE id = $1', [current.id], 'delete')
  })
}

async function readOne(exec: Executor, buttonId: string, tableId?: string): Promise<TableButton> {
  if (!UUID.test(buttonId))
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { button: buttonId } })
  const [row] = await exec.query<Row>(
    `${SELECT} WHERE b.id = $1 ${tableId === undefined ? '' : 'AND b.table_id = $2'}`,
    tableId === undefined ? [buttonId] : [buttonId, tableId],
  )
  if (row === undefined) {
    throw new BasedbError('RESOURCE_NOT_FOUND', { details: { button: buttonId } })
  }
  return toButton(row)
}

/**
 * Presses a button: queues one run per row of its target — the rows ticked, or those of
 * the view on screen — or one run with no row. Only rows the person reads are taken:
 * one they cannot is refused as if it did not exist. Refused whole rather than in part
 * when the target holds more rows than one press may start, or than the automation's
 * hourly budget has left: a button that ran on some rows and not others, without saying
 * which, would be worse than one that asked to narrow the view.
 */
export async function pressTableButton(
  pools: Pools,
  ctx: RequestContext,
  request: {
    readonly tableId: string
    readonly buttonId: string
    readonly records?: readonly string[]
    readonly filter?: string
  },
): Promise<{ readonly runs: number }> {
  const button = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnTable(exec, ctx, 'read', request.tableId)
      const found = await readOne(exec, request.buttonId, request.tableId)
      const [automation] =
        found.automation === null
          ? []
          : await exec.query<{ enabled: boolean }>(
              `SELECT is_enabled AS enabled FROM _basedb.automation
                WHERE id = $1 AND deleted_at IS NULL`,
              [found.automation.id],
            )
      return { ...found, enabled: automation?.enabled === true }
    },
    { readOnly: true },
  )
  if (button.action !== 'automation' || button.automation === null) {
    throw new BasedbError('REQUEST_INVALID', { details: { reason: 'bouton_sans_automatisation' } })
  }
  if (!button.enabled) {
    throw new BasedbError('AUTOMATION_DISABLED', { details: { automation: button.automation.id } })
  }

  let records: readonly (string | null)[]
  if (button.target === 'none') {
    records = [null]
  } else {
    const filter =
      button.target === 'selection'
        ? selectionFilter(request.records)
        : (request.filter ?? '').trim()
    const page = await listRecords(pools, ctx, {
      tableId: request.tableId,
      filter: filter === '' ? undefined : filter,
      limit: MAX_PRESSED_ROWS + 1,
      select: ['_id'],
    })
    if (page.rows.length > MAX_PRESSED_ROWS || page.hasNextPage) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { reason: 'trop_de_lignes', maximum: MAX_PRESSED_ROWS },
      })
    }
    records = page.rows.map((row) => String(row._id))
    if (records.length === 0) {
      throw new BasedbError('REQUEST_INVALID', { details: { reason: 'aucune_ligne' } })
    }
  }

  const left = RUNS_PER_HOUR - (await usedThisHour(pools, button.automation.id))
  if (records.length > left) {
    throw new BasedbError('RATE_LIMIT_EXCEEDED', {
      details: { reason: 'debit', remaining: Math.max(0, left) },
    })
  }
  await pools.withConnection('catalog', (exec) =>
    exec.query(
      `INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id)
       SELECT $1, 'button', r FROM unnest($2::uuid[]) AS r`,
      [button.automation?.id, records],
      'insert',
    ),
  )
  return { runs: records.length }
}

/** The ticked rows as a filter, so that `listRecords` drops what the person cannot read. */
function selectionFilter(records: readonly string[] | undefined): string {
  const ids = [...new Set(records ?? [])]
  if (ids.length === 0) {
    throw new BasedbError('REQUEST_INVALID', { details: { reason: 'aucune_ligne' } })
  }
  if (ids.length > MAX_PRESSED_ROWS) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { reason: 'trop_de_lignes', maximum: MAX_PRESSED_ROWS },
    })
  }
  if (!ids.every((id) => UUID.test(id))) refuse('records', 'identifiant_invalide')
  return `_id in [${ids.map((id) => `"${id.toLowerCase()}"`).join(', ')}]`
}
