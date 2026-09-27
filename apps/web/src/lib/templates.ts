import {
  ApiError,
  type AutomationAction,
  type AutomationInput,
  type DashboardBlock,
  type TableRef,
  api,
} from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import {
  type ResolvedField,
  type Template,
  type TemplateAutomation,
  type TemplateBlock,
  type TemplateField,
  type TemplateOption,
  type TemplateView,
  VIEW_FIELD_KEYS,
  citedInText,
  labelKey,
  resolveTemplateDate,
  translateFilter,
} from '@basedb/contracts'

/**
 * Base templates — chapter 20 §4 and §6. A template is applied by the interface, through
 * the public routes, with the rights of the person applying it; a base becomes a template
 * the same way round, from what that person reads. The template names everything by label
 * and by keys of its own; the API by physical names and identifiers: this module is where
 * one becomes the other, kept apart from the screens so that it can be tested.
 */

// ── Applying ─────────────────────────────────────────────────────────────────────────

/** A field once built: what the API calls it, and what a template value becomes in it. */
export interface BuiltField {
  readonly label: string
  readonly name: string
  readonly kind: string
  readonly options?: readonly TemplateOption[]
  /** Created with the AI: its sample values are not written, the AI fills the cells. */
  readonly ai: boolean
}

export interface BuiltTable {
  readonly key: string
  readonly label: string
  readonly id: string
  readonly ref: TableRef
  readonly fields: Map<string, BuiltField>
}

type Built = ReadonlyMap<string, BuiltTable>

export interface ApplyOptions {
  readonly onStep: (message: string) => void
  /** The person's yes to the AI fields' cited values leaving for the provider (ch. 12 §1.5). */
  readonly aiConsent: boolean
  /** Who applies it — what `$moi` becomes. */
  readonly me: string | null
  readonly today?: Date
}

export interface ApplyReport {
  /** What was built otherwise than the template said, in sentences. */
  readonly warnings: readonly string[]
}

const fieldOf = (table: BuiltTable | undefined, label: string) => table?.fields.get(labelKey(label))

/** A filter of the template as the API reads it, for one table. */
export function filterFor(filter: string, table: BuiltTable | undefined): string {
  if (filter.trim() === '') return ''
  const resolve = (label: string): ResolvedField | null => {
    const field = fieldOf(table, label)
    if (field === undefined) return null
    return field.options === undefined
      ? { name: field.name }
      : { name: field.name, options: field.options }
  }
  return translateFilter(filter, resolve).filter
}

/** `{{Libellé}}` → `{{nom}}`; the special tokens `{{_…}}` stay. */
export function textFor(text: string, table: BuiltTable | undefined): string {
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, label: string) => {
    if (label.startsWith('_')) return whole
    const field = fieldOf(table, label)
    return field === undefined ? whole : `{{${field.name}}}`
  })
}

/** A choice given by its label, as the column stores it. */
function choiceValue(field: BuiltField, label: string): string {
  return (
    field.options?.find((o) => labelKey(o.label) === labelKey(label))?.value ??
    field.options?.find((o) => o.value === label)?.value ??
    label
  )
}

/** A view's spec as the API takes it: names for labels, values for choices. */
export function specFor(view: TemplateView, table: BuiltTable): Record<string, unknown> {
  const keys = VIEW_FIELD_KEYS[view.kind]
  const name = (label: unknown) =>
    typeof label === 'string' ? fieldOf(table, label)?.name : undefined
  const spec: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(view.spec)) {
    if (keys.one.includes(key)) {
      const found = name(value)
      if (found !== undefined) spec[key] = found
    } else if (keys.many.includes(key)) {
      spec[key] = (Array.isArray(value) ? value : []).map(name).filter((v) => v !== undefined)
    } else if (key === 'filter') {
      spec.filter = filterFor(String(value), table)
    } else if (key === 'sorts') {
      spec.sorts = (Array.isArray(value) ? value : []).flatMap(
        (s: { field?: unknown; direction?: unknown }) => {
          const found = name(s.field)
          return found === undefined
            ? []
            : [{ field: found, direction: s.direction === 'desc' ? 'desc' : 'asc' }]
        },
      )
    } else if (key === 'summaries') {
      spec.summaries = Object.fromEntries(
        Object.entries((value ?? {}) as Record<string, string>).flatMap(([label, fn]) => {
          const found = name(label)
          return found === undefined ? [] : [[found, fn]]
        }),
      )
    } else if (key === 'color_rules') {
      spec.color_rules = (Array.isArray(value) ? value : []).map(
        (r: { filter: string; color: string }) => ({
          filter: filterFor(r.filter, table),
          color: r.color,
        }),
      )
    } else if (key === 'group_order') {
      const group =
        typeof view.spec.group_by === 'string' ? fieldOf(table, view.spec.group_by) : undefined
      spec.group_order = (Array.isArray(value) ? value : []).map((label: string) =>
        group === undefined ? label : choiceValue(group, label),
      )
    } else if (key === 'fields' && view.kind === 'form') {
      spec.fields = (Array.isArray(value) ? value : []).flatMap(
        (q: { field: string; required?: boolean; label?: string; help?: string }) => {
          const found = name(q.field)
          return found === undefined
            ? []
            : [
                {
                  field: found,
                  required: q.required === true,
                  label: q.label ?? '',
                  help: q.help ?? '',
                },
              ]
        },
      )
    } else {
      spec[key] = value
    }
  }
  if (view.kind === 'form' && typeof spec.title !== 'string') spec.title = view.label
  return spec
}

/** A dashboard block as the API takes it: the table by identifier, its fields by name. */
export function blockFor(block: TemplateBlock, built: Built): DashboardBlock | null {
  if (block.kind === 'text')
    return { kind: 'text', width: block.width, title: block.title, body: block.body }
  const table = built.get(block.table)
  if (table === undefined) return null
  const name = (label: string | null) =>
    label === null ? null : (fieldOf(table, label)?.name ?? null)
  const filter = filterFor(block.filter, table)
  switch (block.kind) {
    case 'number':
      return {
        kind: 'number',
        width: block.width,
        title: block.title,
        table: table.id,
        aggregate: block.aggregate,
        field: name(block.field),
        filter,
      }
    case 'chart': {
      const group = name(block.group_by)
      return group === null
        ? null
        : {
            kind: 'chart',
            width: block.width,
            title: block.title,
            table: table.id,
            group_by: group,
            filter,
            style: block.style,
          }
    }
    case 'list': {
      const descending = block.sort.startsWith('-')
      const sortName =
        block.sort === '' ? null : name(descending ? block.sort.slice(1) : block.sort)
      return {
        kind: 'list',
        width: block.width,
        title: block.title,
        table: table.id,
        fields: block.fields.map(name).filter((f): f is string => f !== null),
        filter,
        sort: sortName === null ? '' : `${descending ? '-' : ''}${sortName}`,
        limit: block.limit,
      }
    }
  }
}

/** An automation as the API takes it; `me` stands for `$moi`. */
export function automationFor(
  automation: TemplateAutomation,
  built: Built,
  me: string | null,
): AutomationInput {
  const table = automation.trigger.table === null ? undefined : built.get(automation.trigger.table)
  const valuesFor = (
    values: Readonly<Record<string, string | number | boolean>>,
    target: BuiltTable | undefined,
  ) =>
    Object.fromEntries(
      Object.entries(values).flatMap(([label, value]) => {
        const field = fieldOf(target, label)
        if (field === undefined) return []
        const converted =
          typeof value === 'string'
            ? field.options !== undefined
              ? choiceValue(field, value)
              : textFor(value, table)
            : value
        return [[field.name, converted]]
      }),
    )
  const actions: AutomationAction[] = automation.actions.map((action) => {
    switch (action.kind) {
      case 'update_record':
        return { kind: 'update_record', values: valuesFor(action.values, table) }
      case 'create_record': {
        const target = built.get(action.table)
        return {
          kind: 'create_record',
          table: target?.ref.name ?? action.table,
          values: valuesFor(action.values, target),
        }
      }
      case 'notify':
        return {
          kind: 'notify',
          users: me === null ? [] : action.users.filter((u) => u === '$moi').map(() => me),
          user_field:
            action.user_field === null ? null : (fieldOf(table, action.user_field)?.name ?? null),
          message: textFor(action.message, table),
        }
    }
  })
  return {
    label: automation.label,
    description: automation.description ?? null,
    enabled: automation.enabled,
    trigger: {
      kind: automation.trigger.kind,
      table: table?.ref.name ?? null,
      fields: automation.trigger.fields.flatMap((label) => fieldOf(table, label)?.name ?? []),
      schedule: automation.trigger.schedule,
    },
    condition: automation.condition === '' ? null : filterFor(automation.condition, table),
    actions,
  }
}

/** A row of the template as the API takes it; relations it cannot resolve yet are returned apart. */
export function rowFor(
  row: Readonly<Record<string, unknown>>,
  table: BuiltTable,
  resolveKey: (tableKey: string, rowKey: string) => string | undefined,
  links: ReadonlyMap<string, string>,
  me: string | null,
  today: Date,
): { values: Record<string, unknown>; deferred: Record<string, unknown> } {
  const values: Record<string, unknown> = {}
  const deferred: Record<string, unknown> = {}
  for (const [label, value] of Object.entries(row)) {
    if (label === '$key') continue
    const field = fieldOf(table, label)
    if (field === undefined || field.ai) continue
    if (field.kind === 'link' || field.kind === 'multi_link') {
      const target = links.get(`${table.key}:${labelKey(label)}`) as string
      const refs = (Array.isArray(value) ? value : [value]) as string[]
      const ids = refs.map((ref) => resolveKey(target, ref.slice(1)))
      const resolved = ids.filter((id): id is string => id !== undefined)
      // A row of a table not created yet — or of this very table — is linked afterwards.
      if (resolved.length < ids.length) deferred[label] = value
      else values[field.name] = field.kind === 'link' ? (resolved[0] ?? null) : resolved
      continue
    }
    switch (field.kind) {
      case 'select':
        values[field.name] = choiceValue(field, String(value))
        break
      case 'multi_select':
        values[field.name] = (Array.isArray(value) ? value : [value]).map((v) =>
          choiceValue(field, String(v)),
        )
        break
      case 'date':
      case 'datetime':
        values[field.name] = resolveTemplateDate(String(value), field.kind, today)
        break
      case 'user':
        if (value === '$moi' && me !== null) values[field.name] = me
        break
      default:
        values[field.name] = value
    }
  }
  return { values, deferred }
}

const isAiUnavailable = (e: unknown) =>
  e instanceof ApiError &&
  ['AI_DISABLED', 'AI_NOT_CONFIGURED', 'AI_CONSENT_REQUIRED'].includes(e.code)

/** The input of a field of the template for `addField` — none for a relation or a computed field. */
function fieldInput(field: TemplateField) {
  return {
    label: field.label,
    kind: field.kind,
    ...(field.description === undefined ? {} : { description: field.description }),
    ...(field.options === undefined
      ? {}
      : {
          options: field.options.map((o) => ({
            value: o.value,
            label: o.label,
            color: o.color,
            icon: o.icon,
          })),
        }),
    ...(field.format === undefined ? {} : { format: field.format }),
    ...(field.rich === true ? { rich: true } : {}),
  }
}

/** Tables in an order where the target of a relation comes before its source, when it can. */
function rowOrder(template: Template): string[] {
  const order: string[] = []
  const visiting = new Set<string>()
  const visit = (key: string) => {
    if (order.includes(key) || visiting.has(key)) return
    visiting.add(key)
    for (const link of template.links) if (link.from === key && link.to !== key) visit(link.to)
    visiting.delete(key)
    order.push(key)
  }
  for (const table of template.tables) visit(table.key)
  return order
}

/**
 * Builds a template into a base that exists — chapter 20 §4, in its order. Each step is
 * told to `onStep`; one that fails stops the rest, the base holding what was built.
 */
export async function applyTemplate(
  template: Template,
  base: string,
  options: ApplyOptions,
): Promise<ApplyReport> {
  const { onStep, me } = options
  const today = options.today ?? new Date()
  const warnings: string[] = []
  const built = new Map<string, BuiltTable>()
  const links = new Map<string, string>()
  const put = (table: BuiltTable, field: BuiltField) =>
    table.fields.set(labelKey(field.label), field)
  const simple = (f: TemplateField) =>
    !['formula', 'lookup', 'rollup', 'count', 'button'].includes(f.kind) && f.ai === undefined

  // 1. The tables, each with its display column.
  for (const [index, table] of template.tables.entries()) {
    onStep(
      $t('Table « {label} » ({value}/{tablesCount})…', {
        label: table.label,
        value: index + 1,
        tablesCount: template.tables.length,
      }),
    )
    const [first] = table.fields
    if (first === undefined) continue
    const created = await api.createTable(
      base,
      table.label,
      [
        {
          label: first.label,
          kind: first.kind,
          ...(first.description === undefined ? {} : { description: first.description }),
        },
      ],
      table.description,
    )
    const ref: TableRef = { base, name: created.name }
    const entry: BuiltTable = {
      key: table.key,
      label: table.label,
      id: created.id,
      ref,
      fields: new Map(),
    }
    const initial = created.fields.find((f) => labelKey(f.label) === labelKey(first.label))
    if (initial !== undefined)
      put(entry, { label: first.label, name: initial.name, kind: first.kind, ai: false })
    if (table.icon !== undefined || table.color !== undefined) {
      await api
        .updateTable(ref, {
          ...(table.icon === undefined ? {} : { icon: table.icon }),
          ...(table.color === undefined ? {} : { color: table.color }),
        })
        .catch(() => undefined)
    }
    built.set(table.key, entry)
  }

  // The fields the AI computes — with the person's consent, and an AI to compute them;
  // without, ordinary fields of their kind, which take the sample values.
  let aiOff = !options.aiConsent
  let degraded = 0
  const addAiField = async (entry: BuiltTable, field: TemplateField) => {
    onStep($t('Champ IA « {label} »…', { label: field.label }))
    const ai = field.ai as NonNullable<TemplateField['ai']>
    let added: { name: string } | null = null
    if (!aiOff) {
      try {
        added = await api.addField(entry.ref, {
          ...fieldInput(field),
          ai: {
            prompt: ai.prompt,
            refresh:
              ai.refresh === 'if_empty'
                ? { mode: 'if_empty' }
                : { mode: 'schedule', cron: ai.refresh.cron, timezone: ai.refresh.timezone },
            consent: true,
          },
        })
      } catch (e) {
        if (!isAiUnavailable(e)) throw e
        aiOff = true
      }
    }
    const withAi = added !== null
    if (added === null) {
      added = await api.addField(entry.ref, fieldInput(field))
      degraded++
    }
    put(entry, {
      label: field.label,
      name: added.name,
      kind: field.kind,
      ...(field.options === undefined ? {} : { options: field.options }),
      ai: withAi,
    })
  }

  // 2. Their fields, in their order — an AI field in its place when what it cites exists.
  const laterAi: Array<{ entry: BuiltTable; field: TemplateField }> = []
  for (const table of template.tables) {
    const entry = built.get(table.key) as BuiltTable
    const rest = table.fields.slice(1).filter((f) => simple(f) || f.ai !== undefined)
    if (rest.length > 0) onStep($t('Champs de « {label} »…', { label: table.label }))
    for (const field of rest) {
      if (field.ai !== undefined) {
        const ready = citedInText(field.ai.prompt).every(
          (label) => fieldOf(entry, label) !== undefined,
        )
        if (ready) await addAiField(entry, field)
        else laterAi.push({ entry, field })
        continue
      }
      const added = await api.addField(entry.ref, fieldInput(field))
      put(entry, {
        label: field.label,
        name: added.name,
        kind: field.kind,
        ...(field.options === undefined ? {} : { options: field.options }),
        ai: false,
      })
    }
  }

  // 3. The relations.
  for (const link of template.links) {
    const from = built.get(link.from)
    const to = built.get(link.to)
    if (from === undefined || to === undefined) continue
    onStep($t('Relation « {label} »…', { label: link.label }))
    const created = await api.createLink(
      from.ref,
      link.label,
      to.ref.name,
      link.description,
      link.multiple,
    )
    put(from, {
      label: link.label,
      name: created.name,
      kind: link.multiple ? 'multi_link' : 'link',
      ai: false,
    })
    links.set(`${link.from}:${labelKey(link.label)}`, link.to)
  }

  // 4. What is computed: formulas, lookups, rollups, counts — in rounds, since one may
  // read another, of this table or of another.
  let pending = template.tables.flatMap((table) =>
    table.fields
      .filter((f) => ['formula', 'lookup', 'rollup', 'count'].includes(f.kind))
      .map((field) => ({ table, field })),
  )
  while (pending.length > 0) {
    const failed: typeof pending = []
    let lastError: unknown = null
    for (const { table, field } of pending) {
      const entry = built.get(table.key) as BuiltTable
      onStep($t('Champ calculé « {label} »…', { label: field.label }))
      try {
        const input =
          field.kind === 'formula'
            ? {
                label: field.label,
                kind: 'formula',
                formula: { expression: field.formula ?? '' },
                ...(field.description === undefined ? {} : { description: field.description }),
              }
            : {
                label: field.label,
                kind: field.kind,
                rollup: rollupFor(field, table.key, built, links),
                ...(field.description === undefined ? {} : { description: field.description }),
              }
        const added = await api.addField(entry.ref, input)
        put(entry, { label: field.label, name: added.name, kind: field.kind, ai: false })
      } catch (e) {
        failed.push({ table, field })
        lastError = e
      }
    }
    if (failed.length === pending.length) throw lastError
    pending = failed
  }

  // 5. The AI fields that cite a relation or a computed field, now that those exist.
  for (const { entry, field } of laterAi) await addAiField(entry, field)
  if (degraded > 0) {
    warnings.push(
      options.aiConsent
        ? $tp(
            degraded,
            'L’IA n’est pas configurée : {count} champ IA créé comme un champ ordinaire, avec ses valeurs d’exemple.',
            'L’IA n’est pas configurée : {count} champs IA créés comme des champs ordinaires, avec leurs valeurs d’exemple.',
          )
        : $tp(
            degraded,
            'Sans votre accord, {count} champ IA a été créé comme un champ ordinaire, avec ses valeurs d’exemple.',
            'Sans votre accord, {count} champs IA ont été créés comme des champs ordinaires, avec leurs valeurs d’exemple.',
          ),
    )
  }

  // 6. The display columns.
  for (const table of template.tables) {
    const entry = built.get(table.key) as BuiltTable
    const first = table.fields[0]
    const display = first === undefined ? undefined : fieldOf(entry, first.label)
    if (display !== undefined) await api.setDisplayColumn(entry.ref, display.name)
  }

  // 7. The rows, relations resolved by their keys — afterwards for those not yet created.
  const ids = new Map<string, string>()
  const resolveKey = (tableKey: string, rowKey: string) => ids.get(`${tableKey}:${rowKey}`)
  const later: Array<{ table: BuiltTable; id: string; row: Readonly<Record<string, unknown>> }> = []
  for (const key of rowOrder(template)) {
    const rows = template.rows[key] ?? []
    const entry = built.get(key)
    if (entry === undefined || rows.length === 0) continue
    onStep($t('Lignes d’exemple de « {label} »…', { label: entry.label }))
    const prepared = rows.map((row) => rowFor(row, entry, resolveKey, links, me, today))
    for (let start = 0; start < prepared.length; start += 1000) {
      const chunk = prepared.slice(start, start + 1000)
      const created = await api.createRecords(
        entry.ref,
        chunk.map((p) => p.values),
      )
      created.results.forEach((result, index) => {
        const row = rows[start + index]
        if (row?.$key !== undefined) ids.set(`${key}:${row.$key}`, result.id)
        if (row !== undefined && Object.keys(chunk[index]?.deferred ?? {}).length > 0) {
          later.push({ table: entry, id: result.id, row: chunk[index]?.deferred ?? {} })
        }
      })
    }
  }
  if (later.length > 0) onStep($t('Relations entre les lignes…'))
  for (const { table, id, row } of later) {
    const { values } = rowFor(row, table, resolveKey, links, me, today)
    if (Object.keys(values).length > 0) await api.updateRecord(table.ref, id, values)
  }

  // 8. The buttons, after the automations they trigger.
  const automationIds = new Map<string, string>()
  for (const automation of template.automations.filter((a) => a.trigger.kind === 'button')) {
    onStep($t('Automatisation « {label} »…', { label: automation.label }))
    const created = await api.createAutomation(base, automationFor(automation, built, me))
    if (automation.key !== undefined) automationIds.set(automation.key, created.id)
  }
  for (const table of template.tables) {
    const entry = built.get(table.key) as BuiltTable
    for (const field of table.fields.filter((f) => f.kind === 'button')) {
      const button = field.button
      if (button === undefined) continue
      onStep($t('Bouton « {label} »…', { label: field.label }))
      const automation =
        button.automation === undefined ? undefined : automationIds.get(button.automation)
      const added = await api.addField(entry.ref, {
        label: field.label,
        kind: 'button',
        button:
          automation === undefined
            ? {
                label: button.label,
                color: button.color ?? null,
                action: 'url',
                url: textFor(button.url ?? '', entry),
              }
            : {
                label: button.label,
                color: button.color ?? null,
                action: 'automation',
                automation,
              },
      })
      put(entry, { label: field.label, name: added.name, kind: 'button', ai: false })
    }
  }

  // 9. The required fields, now that the rows are there.
  for (const table of template.tables) {
    const entry = built.get(table.key) as BuiltTable
    for (const field of table.fields.filter((f) => f.required === true)) {
      const found = fieldOf(entry, field.label)
      if (found === undefined) continue
      await api.setFieldRequired(entry.ref, found.name, true).catch(() => {
        warnings.push($t('« {label} » n’a pas pu être rendu obligatoire.', { label: field.label }))
      })
    }
  }

  // 10. The views, the dashboards, the other automations.
  for (const view of template.views) {
    const entry = built.get(view.table)
    if (entry === undefined) continue
    onStep($t('Vue « {label} »…', { label: view.label }))
    await api.createView(entry.ref, {
      label: view.label,
      kind: view.kind,
      description: view.description ?? null,
      spec: specFor(view, entry),
    })
  }
  for (const dashboard of template.dashboards) {
    onStep($t('Tableau de bord « {label} »…', { label: dashboard.label }))
    const blocks = dashboard.blocks
      .map((b) => blockFor(b, built))
      .filter((b): b is DashboardBlock => b !== null)
    await api.createDashboard(base, {
      label: dashboard.label,
      description: dashboard.description ?? null,
      blocks,
    })
  }
  for (const automation of template.automations.filter((a) => a.trigger.kind !== 'button')) {
    onStep($t('Automatisation « {label} »…', { label: automation.label }))
    await api.createAutomation(base, automationFor(automation, built, me))
  }
  return { warnings }
}

/**
 * A lookup, a rollup or a count as `addField` takes it: names for labels. `links` tells the
 * table each relation reaches — for a relation that arrives, the table holding it.
 */
function rollupFor(
  field: TemplateField,
  tableKey: string,
  built: Built,
  links: ReadonlyMap<string, string>,
) {
  const rollup = field.rollup as NonNullable<TemplateField['rollup']>
  const holder = built.get(rollup.table ?? tableKey)
  const via = fieldOf(holder, rollup.via)
  const reachedKey = rollup.table ?? links.get(`${tableKey}:${labelKey(rollup.via)}`)
  const reached = reachedKey === undefined ? undefined : built.get(reachedKey)
  return {
    via: via?.name ?? rollup.via,
    ...(rollup.table === undefined ? {} : { via_table: holder?.ref.name ?? rollup.table }),
    ...(rollup.target === undefined
      ? {}
      : { target: fieldOf(reached, rollup.target)?.name ?? rollup.target }),
    ...(rollup.aggregate === undefined ? {} : { aggregate: rollup.aggregate }),
  }
}

/** The AI fields of a template, with their prompts — what the consent is about. */
export function aiFieldsOf(
  template: Template,
): Array<{ table: string; field: string; prompt: string }> {
  return template.tables.flatMap((table) =>
    table.fields
      .filter((f) => f.ai !== undefined)
      .map((f) => ({ table: table.label, field: f.label, prompt: f.ai?.prompt ?? '' })),
  )
}

/** The labels a prompt cites, to show it with its citations picked out. */
export const promptCitations = citedInText
