import { type DescribedBase, type Field, type TableRef, api } from '@/lib/api/client'
import { type Template, VIEW_FIELD_KEYS, checkTemplate, optionValue } from '@basedb/contracts'

/**
 * A base as a template — chapter 20 §6: what the person reads of it, less what a template
 * never carries (§1.3), which is said. The way back of `lib/templates.ts`: names become
 * labels, identifiers keys, choice values their labels.
 */

export interface ExportOptions {
  readonly key: string
  readonly label: string
  readonly summary: string
  readonly category?: string
  /** Up to 50 rows per table, read with the exporter's rights. */
  readonly rows: boolean
  /** Who exports — the person a `$moi` stands for. */
  readonly me: string | null
}

export interface ExportResult {
  readonly template: Template
  /** What could not come along, in sentences. */
  readonly omitted: readonly string[]
}

const EXPORT_ROWS = 50
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/
const SKIPPED_KINDS = new Set(['system', 'file', 'image'])

/** A filter of the API as a template writes it: `[Libellé]` for names, labels for choices. */
export function filterToLabels(filter: string, fields: readonly Field[]): string {
  let out = ''
  let current: Field | null = null
  let i = 0
  while (i < filter.length) {
    const c = filter[i] as string
    if (c === '"') {
      let j = i + 1
      while (j < filter.length && filter[j] !== '"') j += filter[j] === '\\' ? 2 : 1
      const literal = filter.slice(i, j + 1)
      const inner = literal.slice(1, -1).replace(/\\(.)/g, '$1')
      const option = current?.options?.find((o) => o.value === inner)
      out += option === undefined ? literal : JSON.stringify(option.label)
      i = j + 1
      continue
    }
    const word = IDENTIFIER.exec(filter.slice(i))?.[0]
    if (word !== undefined) {
      const field = fields.find((f) => f.name === word)
      if (field !== undefined) {
        out += `[${field.label.replace(/\]/g, ']]')}]`
        current = field
      } else {
        if (word === 'and' || word === 'or') current = null
        out += word
      }
      i += word.length
      continue
    }
    out += c
    i++
  }
  return out
}

/** `{{nom}}` becomes `{{Libellé}}`. */
export function textToLabels(text: string, fields: readonly Field[]): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, name: string) => {
    const field = fields.find((f) => f.name === name)
    return field === undefined ? whole : `{{${field.label}}}`
  })
}

function uniqueKey(label: string, taken: Set<string>): string {
  const root = optionValue(label)
  let key = root
  for (let n = 2; taken.has(key); n++) key = `${root}_${n}`
  taken.add(key)
  return key
}

/** A value read from the API as a template writes it, or `undefined` to leave it out. */
export function templateValue(
  value: unknown,
  field: Field,
  rowKey: (tableName: string, id: string) => string | undefined,
  me: string | null,
): unknown {
  if (value === null || value === undefined || value === '') return undefined
  switch (field.kind) {
    case 'select':
      return field.options?.find((o) => o.value === value)?.label ?? String(value)
    case 'multi_select':
      return Array.isArray(value)
        ? value.map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
        : undefined
    case 'link':
    case 'multi_link': {
      const target = field.link?.target
      if (target === undefined) return undefined
      const ids = (Array.isArray(value) ? value : [value])
        .map((v) =>
          typeof v === 'string'
            ? v
            : typeof v === 'object' && v !== null
              ? (v as { id?: unknown }).id
              : null,
        )
        .filter((v): v is string => typeof v === 'string')
      const keys = ids.map((id) => rowKey(target, id)).filter((k): k is string => k !== undefined)
      if (keys.length === 0) return undefined
      return field.kind === 'link' ? `@${keys[0]}` : keys.map((k) => `@${k}`)
    }
    case 'user': {
      const id = typeof value === 'string' ? value : (value as { id?: unknown }).id
      return id !== undefined && id === me ? '$moi' : undefined
    }
    case 'date':
      return typeof value === 'string' ? value.slice(0, 10) : undefined
    case 'number':
    case 'boolean':
    case 'short_text':
    case 'long_text':
    case 'url':
    case 'email':
    case 'datetime':
      return value
    default:
      return undefined
  }
}

/** Builds the template of a base, then checks it — repairing, and saying so, if need be. */
export async function exportTemplate(
  base: DescribedBase,
  options: ExportOptions,
): Promise<ExportResult> {
  const omitted: string[] = []
  const keys = new Set<string>()
  const keyOfName = new Map<string, string>()
  const keyOfId = new Map<string, string>()
  for (const table of base.tables) {
    const key = uniqueKey(table.label, keys)
    keyOfName.set(table.name, key)
    keyOfId.set(table.id, key)
  }
  const tableByName = new Map(base.tables.map((t) => [t.name, t]))
  const tableById = new Map(base.tables.map((t) => [t.id, t]))
  const labelIn = (tableName: string | undefined, name: string | null | undefined) =>
    tableName === undefined || name === null || name === undefined
      ? undefined
      : tableByName.get(tableName)?.fields.find((f) => f.name === name)?.label

  const automations = await api.automations(base.name).catch(() => [])
  const buttonKeys = new Map<string, string>()

  // ── Tables, fields, relations ──
  const tables: Record<string, unknown>[] = []
  const links: Record<string, unknown>[] = []
  for (const table of base.tables) {
    const key = keyOfName.get(table.name) as string
    const ref: TableRef = { base: base.name, name: table.name }
    const own = table.fields.filter((f) => f.system !== true)
    const display = own.find((f) => f.name === table.display_field)
    const ordered = display === undefined ? own : [display, ...own.filter((f) => f !== display)]
    const fields: Record<string, unknown>[] = []
    for (const field of ordered) {
      if (SKIPPED_KINDS.has(field.kind)) {
        if (field.kind !== 'system') {
          omitted.push(
            `« ${table.label} » › « ${field.label} » : un modèle ne porte pas de fichier.`,
          )
        }
        continue
      }
      if (field.kind === 'link' || field.kind === 'multi_link') {
        const to = field.link?.target === undefined ? undefined : keyOfName.get(field.link.target)
        if (to === undefined) {
          omitted.push(
            `« ${table.label} » › « ${field.label} » : la table visée n’est pas dans la base.`,
          )
          continue
        }
        links.push({
          from: key,
          label: field.label,
          to,
          multiple: field.kind === 'multi_link',
          ...(field.description === null ? {} : { description: field.description }),
        })
        continue
      }
      const out: Record<string, unknown> = { label: field.label, kind: field.kind }
      if (field.description !== null && field.description !== '')
        out.description = field.description
      if (field.required === true && field.computed === undefined) out.required = true
      if (
        field.options !== undefined &&
        (field.kind === 'select' || field.kind === 'multi_select')
      ) {
        out.options = field.options.map((o) => ({
          label: o.label,
          ...(o.color === null ? {} : { color: o.color }),
          ...(o.icon === null ? {} : { icon: o.icon }),
        }))
      }
      if (field.format !== undefined && !['decimal', 'plain'].includes(field.format.display)) {
        out.format = {
          display: field.format.display,
          ...(field.format.currency ? { currency: field.format.currency } : {}),
          ...(field.format.rating_max ? { rating_max: field.format.rating_max } : {}),
        }
      }
      const computed = field.computed
      if (field.kind === 'formula' && computed?.expression !== undefined)
        out.formula = computed.expression
      if (
        (field.kind === 'lookup' || field.kind === 'rollup' || field.kind === 'count') &&
        computed?.via !== undefined
      ) {
        const via = computed.via
        const incoming = via.direction === 'incoming'
        out.rollup = {
          via: labelIn(incoming ? via.table : table.name, via.field) ?? via.field,
          ...(incoming ? { table: keyOfName.get(via.table) ?? via.table } : {}),
          ...(computed.target
            ? { target: labelIn(via.reached, computed.target) ?? computed.target }
            : {}),
          ...(computed.aggregate ? { aggregate: computed.aggregate } : {}),
        }
      }
      if (field.ai === true) {
        const status = await api.aiFieldStatus(ref, field.name).catch(() => null)
        if (status === null) {
          omitted.push(
            `« ${table.label} » › « ${field.label} » : consigne IA illisible, champ exporté sans l’IA.`,
          )
        } else {
          let prompt = status.prompt
          for (const cited of status.cited)
            prompt = prompt.replaceAll(`{{${cited.name}}}`, `{{${cited.label}}}`)
          out.ai = {
            prompt,
            refresh:
              status.refresh.mode === 'schedule' && status.refresh.cron !== null
                ? { cron: status.refresh.cron, timezone: status.refresh.timezone ?? 'Europe/Paris' }
                : 'if_empty',
          }
        }
      }
      if (field.kind === 'button' && field.button !== undefined) {
        const b = field.button
        const color = b.color === null ? {} : { color: b.color }
        if (b.action === 'url' && b.url !== null) {
          out.button = { label: b.label, ...color, url: textToLabels(b.url, table.fields) }
        } else if (b.action === 'automation' && b.automation !== null) {
          const k = buttonKeys.get(b.automation) ?? `bouton-${buttonKeys.size + 1}`
          buttonKeys.set(b.automation, k)
          out.button = { label: b.label, ...color, automation: k }
        }
      }
      fields.push(out)
    }
    tables.push({
      key,
      label: table.label,
      ...(table.description === null ? {} : { description: table.description }),
      ...(table.icon === null ? {} : { icon: table.icon }),
      ...(table.color === null ? {} : { color: table.color }),
      fields,
    })
  }

  // ── Views: the shared ones — a personal view is its author's ──
  const views: Record<string, unknown>[] = []
  for (const table of base.tables) {
    const list = await api.views({ base: base.name, name: table.name }).catch(() => [])
    for (const view of list) {
      if (view.personal || !(view.kind in VIEW_FIELD_KEYS)) continue
      const kind = view.kind as keyof typeof VIEW_FIELD_KEYS
      const allowed = VIEW_FIELD_KEYS[kind]
      const label = (name: unknown) =>
        typeof name === 'string' ? table.fields.find((f) => f.name === name)?.label : undefined
      const spec: Record<string, unknown> = {}
      for (const [k, value] of Object.entries(view.spec)) {
        if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue
        if (allowed.one.includes(k)) {
          const found = label(value)
          if (found !== undefined) spec[k] = found
        } else if (allowed.many.includes(k)) {
          spec[k] = (value as unknown[]).map(label).filter((v) => v !== undefined)
        } else if (k === 'filter') {
          spec.filter = filterToLabels(String(value), table.fields)
        } else if (k === 'sorts') {
          spec.sorts = (value as Array<{ field: string; direction: string }>).flatMap((s) => {
            const found = label(s.field)
            return found === undefined ? [] : [{ field: found, direction: s.direction }]
          })
        } else if (k === 'summaries') {
          spec.summaries = Object.fromEntries(
            Object.entries(value as Record<string, string>).flatMap(([name, fn]) => {
              const found = label(name)
              return found === undefined ? [] : [[found, fn]]
            }),
          )
        } else if (k === 'color_rules') {
          spec.color_rules = (value as Array<{ filter: string; color: string }>).map((r) => ({
            filter: filterToLabels(r.filter, table.fields),
            color: r.color,
          }))
        } else if (k === 'group_order') {
          const group = table.fields.find((f) => f.name === view.spec.group_by)
          spec.group_order = (value as string[]).map(
            (v) => group?.options?.find((o) => o.value === v)?.label ?? v,
          )
        } else if (k === 'fields' && kind === 'form') {
          spec.fields = (
            value as Array<{ field: string; required: boolean; label: string; help: string }>
          ).flatMap((q) => {
            const found = label(q.field)
            return found === undefined
              ? []
              : [
                  {
                    field: found,
                    required: q.required,
                    ...(q.label ? { label: q.label } : {}),
                    ...(q.help ? { help: q.help } : {}),
                  },
                ]
          })
        } else if (allowed.other.includes(k)) {
          spec[k] = value
        }
      }
      views.push({
        table: keyOfName.get(table.name),
        label: view.label,
        kind,
        ...(view.description === null ? {} : { description: view.description }),
        spec,
      })
    }
  }

  // ── Dashboards: every block but a page from outside ──
  const dashboards = (await api.dashboards(base.name).catch(() => [])).map((dashboard) => ({
    label: dashboard.label,
    ...(dashboard.description === null ? {} : { description: dashboard.description }),
    blocks: dashboard.blocks.flatMap((block): Record<string, unknown>[] => {
      if (block.kind === 'embed') {
        omitted.push(
          `Tableau « ${dashboard.label} » › « ${block.title} » : un modèle ne porte pas de page extérieure.`,
        )
        return []
      }
      if (block.kind === 'text')
        return [{ kind: 'text', title: block.title, width: block.width, body: block.body }]
      const table = tableById.get(block.table)
      if (table === undefined) return []
      const label = (name: string | null) =>
        name === null ? null : (table.fields.find((f) => f.name === name)?.label ?? null)
      const common = {
        title: block.title,
        width: block.width,
        table: keyOfId.get(block.table),
        filter: filterToLabels(block.filter, table.fields),
      }
      if (block.kind === 'number') {
        return [
          { kind: 'number', ...common, aggregate: block.aggregate, field: label(block.field) },
        ]
      }
      if (block.kind === 'chart') {
        return [{ kind: 'chart', ...common, group_by: label(block.group_by), style: block.style }]
      }
      const descending = block.sort.startsWith('-')
      const sortLabel =
        block.sort === '' ? null : label(descending ? block.sort.slice(1) : block.sort)
      return [
        {
          kind: 'list',
          ...common,
          fields: block.fields.map(label).filter((f) => f !== null),
          sort: sortLabel === null ? '' : `${descending ? '-' : ''}${sortLabel}`,
          limit: block.limit,
        },
      ]
    }),
  }))

  // ── Automations: every action but those that call outside ──
  const exportedAutomations = automations.flatMap((automation) => {
    const table =
      automation.trigger.table === null ? undefined : tableById.get(automation.trigger.table)
    const fields = table?.fields ?? []
    const label = (name: string) => fields.find((f) => f.name === name)?.label
    const valuesOf = (values: Readonly<Record<string, unknown>>, target: typeof table) =>
      Object.fromEntries(
        Object.entries(values).flatMap(([name, value]) => {
          const field = target?.fields.find((f) => f.name === name)
          if (field === undefined) return []
          const converted =
            typeof value === 'string'
              ? (field.options?.find((o) => o.value === value)?.label ??
                textToLabels(value, fields))
              : value
          return [[field.label, converted]]
        }),
      )
    const actions = automation.actions.flatMap((action): Record<string, unknown>[] => {
      switch (action.kind) {
        case 'update_record':
          return [{ kind: 'update_record', values: valuesOf(action.values, table) }]
        case 'create_record': {
          const target = tableById.get(action.table) ?? tableByName.get(action.table)
          if (target === undefined) return []
          return [
            {
              kind: 'create_record',
              table: keyOfName.get(target.name),
              values: valuesOf(action.values, target),
            },
          ]
        }
        case 'notify':
          return [
            {
              kind: 'notify',
              users: options.me !== null && action.users.includes(options.me) ? ['$moi'] : [],
              user_field: action.user_field === null ? null : (label(action.user_field) ?? null),
              message: textToLabels(action.message, fields),
            },
          ]
        default:
          omitted.push(
            `Automatisation « ${automation.label} » : un modèle n’appelle pas l’extérieur, action retirée.`,
          )
          return []
      }
    })
    if (actions.length === 0) return []
    const key = buttonKeys.get(automation.id)
    return [
      {
        ...(key === undefined ? {} : { key }),
        label: automation.label,
        ...(automation.description === null ? {} : { description: automation.description }),
        enabled: automation.enabled,
        trigger: {
          kind: automation.trigger.kind,
          table: table === undefined ? null : keyOfName.get(table.name),
          fields: automation.trigger.fields.map(label).filter((f) => f !== undefined),
          schedule: automation.trigger.schedule,
        },
        condition:
          automation.condition === null ? '' : filterToLabels(automation.condition, fields),
        actions,
      },
    ]
  })

  // ── Rows: keyed, so that the relations between them come along ──
  const rows: Record<string, Record<string, unknown>[]> = {}
  if (options.rows) {
    const read = new Map<string, ReadonlyArray<Record<string, unknown>>>()
    const rowKeys = new Map<string, string>()
    for (const table of base.tables) {
      const page = await api
        .list({ base: base.name, name: table.name }, { limit: EXPORT_ROWS })
        .catch(() => null)
      const list = page?.data ?? []
      read.set(table.name, list)
      const key = keyOfName.get(table.name) as string
      list.forEach((row, index) =>
        rowKeys.set(`${table.name}:${String(row._id)}`, `${key}-${index + 1}`),
      )
    }
    const rowKey = (tableName: string, id: string) => rowKeys.get(`${tableName}:${id}`)
    for (const table of base.tables) {
      const key = keyOfName.get(table.name) as string
      const writable = table.fields.filter(
        (f) =>
          f.system !== true &&
          f.computed === undefined &&
          !['button', 'autonumber', 'file', 'image'].includes(f.kind),
      )
      rows[key] = (read.get(table.name) ?? []).flatMap((row) => {
        const out: Record<string, unknown> = { $key: rowKey(table.name, String(row._id)) }
        for (const field of writable) {
          const value = templateValue(row[field.name], field, rowKey, options.me)
          if (value !== undefined) out[field.label] = value
        }
        return Object.keys(out).length > 1 ? [out] : []
      })
    }
  }

  const raw = {
    format: 1,
    key: options.key,
    label: options.label,
    summary: options.summary,
    ...(options.category === undefined || options.category === ''
      ? {}
      : { category: options.category }),
    ...(base.icon === null ? {} : { icon: base.icon }),
    ...(base.color === null ? {} : { color: base.color }),
    base: {
      label: base.label,
      ...(base.description === null ? {} : { description: base.description }),
    },
    tables,
    links,
    rows,
    views,
    dashboards,
    automations: exportedAutomations,
  }
  const strict = checkTemplate(raw)
  if (strict.ok) return { template: strict.template, omitted }
  const repaired = checkTemplate(raw, { repair: true })
  if (!repaired.ok)
    throw new Error(repaired.issues.map((i) => `${i.path} : ${i.message}`).join(' ; '))
  return {
    template: repaired.template,
    omitted: [...omitted, ...repaired.issues.map((i) => `${i.path} : ${i.message}`)],
  }
}
