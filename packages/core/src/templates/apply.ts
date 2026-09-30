import {
  type Template,
  type TemplateApplyReport,
  type TemplateFieldInput,
  type TemplateOperations,
  type TemplateStep,
  applyTemplate as build,
  checkTemplate,
} from '@basedb/contracts'
import type { AiFieldInput } from '../ai/field.js'
import type { AutomationInput } from '../automations/catalog.js'
import type { FormulaInput, RollupInput } from '../catalog/computed-fields.js'
import type { DashboardInput } from '../catalog/dashboards.js'
import type { AddedField, ButtonInput } from '../catalog/fields.js'
import type { CreatedLinkField } from '../catalog/links.js'
import type { LookInput } from '../catalog/look.js'
import type { CreateBaseResult, CreateTableResult, FieldRequest } from '../catalog/operations.js'
import type { FieldKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import type { CreatedRecords } from '../records/create.js'
import type { RequestContext } from '../tx/context.js'
import type { CatalogEntry } from './catalog.js'
import { invalidTemplate } from './catalog.js'

/**
 * A template applied by the server, in one operation — chapter 20 §4.
 *
 * The browser used to chain the routes of `/admin` one by one: a refusal half-way left a
 * base half-built. Here the same steps — `applyTemplate` of the contracts, the one order
 * every reader follows — run against the kernel, with the caller's rights, into a base
 * created for the purpose; and if a step fails, that base is deleted before the refusal is
 * thrown, so that the caller sees the whole base or none. Deleted, not purged: it goes to
 * the trash with what it had, where an administrator finds it — a purge is irreversible and
 * asks for an export (chapter 06 §5).
 */

/** What the kernel offers that building a template needs. */
export interface TemplateKernel {
  getTemplate(ctx: RequestContext, key: string, locale?: string): Promise<CatalogEntry>
  createBase(
    ctx: RequestContext,
    request: { label: string; description?: string | null; projectId?: string },
  ): Promise<CreateBaseResult>
  createTable(
    ctx: RequestContext,
    request: {
      baseId: string
      label: string
      description?: string | null
      fields: readonly FieldRequest[]
    },
  ): Promise<CreateTableResult>
  updateTable(ctx: RequestContext, request: { tableId: string; look?: LookInput }): Promise<unknown>
  addField(
    ctx: RequestContext,
    request: {
      tableId: string
      label: string
      kind: FieldKind
      description?: string | null
      options?: TemplateFieldInput['options']
      ai?: AiFieldInput
      format?: Record<string, unknown>
      formula?: FormulaInput
      rollup?: RollupInput
      button?: ButtonInput
      rich?: boolean
    },
  ): Promise<AddedField>
  createLinkField(
    ctx: RequestContext,
    request: {
      tableId: string
      targetTableId: string
      label: string
      description?: string | null
      multiple?: boolean
    },
  ): Promise<CreatedLinkField>
  setDisplayColumn(
    ctx: RequestContext,
    request: { tableId: string; fieldId: string | null },
  ): Promise<unknown>
  createRecords(
    ctx: RequestContext,
    options: { tableId: string; records: ReadonlyArray<Readonly<Record<string, unknown>>> },
  ): Promise<CreatedRecords>
  updateRecord(
    ctx: RequestContext,
    options: { tableId: string; recordId: string; values: Readonly<Record<string, unknown>> },
  ): Promise<unknown>
  setFieldRequired(
    ctx: RequestContext,
    request: { fieldId: string; required: boolean },
  ): Promise<unknown>
  createView(
    ctx: RequestContext,
    request: {
      tableId: string
      label: unknown
      kind: unknown
      description?: unknown
      spec?: unknown
    },
  ): Promise<unknown>
  createDashboard(
    ctx: RequestContext,
    request: { baseId: string; input: DashboardInput },
  ): Promise<unknown>
  createAutomation(
    ctx: RequestContext,
    request: { baseId: string; input: AutomationInput },
  ): Promise<{ readonly id: string }>
  deleteBase(ctx: RequestContext, request: { baseId: string }): Promise<unknown>
}

export interface ApplyTemplateRequest {
  /** A template of the catalog, by its key — or a template itself, checked like an import. */
  readonly template: unknown
  /** The base's label: the template's own when absent. */
  readonly label?: string
  readonly description?: string | null
  readonly projectId?: string
  /** Writes the sample rows (the default); `false` leaves the tables empty. */
  readonly rows?: boolean
  /** The caller's yes to the AI fields' cited values leaving for the provider (ch. 12 §1.5). */
  readonly aiConsent?: boolean
  /** The language a template of the catalog is read in. */
  readonly locale?: string
  readonly onStep?: (step: TemplateStep) => void
}

export interface AppliedTemplate {
  readonly baseId: string
  readonly name: string
  readonly label: string
  readonly report: TemplateApplyReport
}

const AI_UNAVAILABLE = new Set(['AI_DISABLED', 'AI_NOT_CONFIGURED', 'AI_CONSENT_REQUIRED'])

/** A template by its key, or a template given whole — refused with its issues if unfit. */
async function templateOf(
  kernel: TemplateKernel,
  ctx: RequestContext,
  request: ApplyTemplateRequest,
): Promise<Template> {
  if (typeof request.template === 'string') {
    return (await kernel.getTemplate(ctx, request.template, request.locale)).template
  }
  if (typeof request.template !== 'object' || request.template === null) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'template' } })
  }
  const check = checkTemplate(request.template)
  if (!check.ok) throw invalidTemplate(check.issues)
  return check.template
}

/** The kernel's operations, in the shapes the contracts' builder speaks. */
function operationsOf(
  kernel: TemplateKernel,
  ctx: RequestContext,
  baseId: string,
): TemplateOperations {
  return {
    createTable: async (input) => {
      const created = await kernel.createTable(ctx, {
        baseId,
        label: input.label,
        ...(input.description === undefined ? {} : { description: input.description }),
        fields: [
          {
            label: input.first.label,
            kind: input.first.kind as FieldKind,
            ...(input.first.description === undefined
              ? {}
              : { description: input.first.description }),
          },
        ],
      })
      return {
        id: created.tableId,
        name: created.tableName,
        fields: created.fields.map((f) => ({ id: f.fieldId, name: f.name, label: f.label })),
      }
    },
    setTableLook: async (tableId, look) => {
      await kernel.updateTable(ctx, { tableId, look })
    },
    addField: async (tableId, input) => {
      const added = await kernel.addField(ctx, {
        tableId,
        label: input.label,
        kind: input.kind as FieldKind,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.options === undefined ? {} : { options: input.options }),
        ...(input.format === undefined ? {} : { format: input.format }),
        ...(input.rich === true ? { rich: true } : {}),
        ...(input.formula === undefined ? {} : { formula: input.formula }),
        ...(input.rollup === undefined
          ? {}
          : {
              rollup: {
                via: input.rollup.via,
                ...(input.rollup.via_table === undefined
                  ? {}
                  : { viaTable: input.rollup.via_table }),
                ...(input.rollup.target === undefined ? {} : { target: input.rollup.target }),
                ...(input.rollup.aggregate === undefined
                  ? {}
                  : { aggregate: input.rollup.aggregate as RollupInput['aggregate'] }),
              },
            }),
        ...(input.ai === undefined
          ? {}
          : {
              ai: {
                prompt: input.ai.prompt,
                refresh:
                  input.ai.refresh.mode === 'if_empty'
                    ? { mode: 'if_empty', cron: null, timezone: null }
                    : {
                        mode: 'schedule',
                        cron: input.ai.refresh.cron,
                        timezone: input.ai.refresh.timezone,
                      },
                consent: true,
              },
            }),
        ...(input.button === undefined ? {} : { button: input.button }),
      })
      return { id: added.fieldId, name: added.name }
    },
    createLink: async (tableId, input) => {
      const created = await kernel.createLinkField(ctx, {
        tableId,
        targetTableId: input.targetTableId,
        label: input.label,
        ...(input.description === undefined ? {} : { description: input.description }),
        multiple: input.multiple,
      })
      return { id: created.fieldId, name: created.name }
    },
    setDisplayColumn: async (tableId, fieldId) => {
      await kernel.setDisplayColumn(ctx, { tableId, fieldId })
    },
    createRows: async (tableId, rows) =>
      (await kernel.createRecords(ctx, { tableId, records: rows })).ids,
    updateRow: async (tableId, recordId, values) => {
      await kernel.updateRecord(ctx, { tableId, recordId, values })
    },
    setRequired: async (fieldId) => {
      await kernel.setFieldRequired(ctx, { fieldId, required: true })
    },
    createView: async (tableId, input) => {
      await kernel.createView(ctx, { tableId, ...input })
    },
    createDashboard: async (input) => {
      await kernel.createDashboard(ctx, { baseId, input: input as unknown as DashboardInput })
    },
    createAutomation: async (input) => {
      const created = await kernel.createAutomation(ctx, {
        baseId,
        input: input as unknown as AutomationInput,
      })
      return { id: created.id }
    },
    isAiUnavailable: (e) => e instanceof BasedbError && AI_UNAVAILABLE.has(e.code),
  }
}

/** Applies a template into a new base — the whole base, or none. */
export async function applyTemplate(
  kernel: TemplateKernel,
  ctx: RequestContext,
  request: ApplyTemplateRequest,
): Promise<AppliedTemplate> {
  const template = await templateOf(kernel, ctx, request)
  const label = (request.label ?? '').trim() || template.base.label
  const base = await kernel.createBase(ctx, {
    label,
    description:
      request.description === undefined ? (template.base.description ?? null) : request.description,
    ...(request.projectId === undefined ? {} : { projectId: request.projectId }),
  })
  let step: TemplateStep | null = null
  try {
    const report = await build(template, operationsOf(kernel, ctx, base.baseId), {
      onStep: (s) => {
        step = s
        request.onStep?.(s)
      },
      aiConsent: request.aiConsent === true,
      rows: request.rows !== false,
      me: ctx.actor.kind === 'user' ? ctx.actor.id : null,
    })
    return { baseId: base.baseId, name: base.schemaName, label, report }
  } catch (error) {
    // The half-built base goes: the caller is told of the step, never left with a remnant.
    const discarded = await kernel.deleteBase(ctx, { baseId: base.baseId }).then(
      () => true,
      () => false,
    )
    // An unforeseen failure stays what it is: the error boundary makes it an incident.
    if (!(error instanceof BasedbError)) throw error
    throw new BasedbError(error.code, {
      details: { ...error.details, template: { step, base: base.schemaName, discarded } },
      cause: error,
      ...(error.incidentId === undefined ? {} : { incidentId: error.incidentId }),
    })
  }
}
