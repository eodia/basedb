import {
  type Template,
  type TemplateCheck,
  type TemplateField,
  type TemplateViewKind,
  VIEW_FIELD_KEYS,
  checkTemplate,
  labelKey,
} from './templates.js'

/**
 * The official templates in the reader's language — chapter 20.
 *
 * A template is written in French. A dictionary per language and per template maps each
 * of its French texts to its translation (`packages/templates/i18n/<langue>/<clé>.json`);
 * a text it does not hold stays French. A label is translated once and followed wherever
 * it is cited — rows, formulas, filters, views, dashboards, automations, the `{{…}}` of a
 * prompt or a message —: a translator leaves the citations in French, and this module
 * rewrites them. The result goes through the validator every template goes through, so a
 * dictionary that breaks a citation, or makes two labels one, is refused rather than
 * served.
 */

/** A template's texts in one language: the French text → its translation. */
export type TemplateDictionary = Readonly<Record<string, string>>

/** What a text is, for whoever translates it: its place says how to write it. */
export type TemplateTextKind =
  /** The name of a table, a field, a relation, a view, a dashboard, an automation. */
  | 'label'
  /** A choice of a list. */
  | 'option'
  /** A tag of the gallery. */
  | 'tag'
  /** A description, a summary, a title, a form's wording, a block's text. */
  | 'text'
  /** A sample value of a short text — often the name of a fictitious company or person. */
  | 'value'
  /** A sample value of a long text. */
  | 'long'
  /** A sample value of a rich text: HTML, whose tags stay. */
  | 'rich'
  | 'email'
  | 'url'
  /** What the AI is asked; cites fields `{{Libellé}}`. */
  | 'prompt'
  /** A notification, a value an automation writes; may cite fields `{{Libellé}}`. */
  | 'message'
  /** A button's label (40 characters at most). */
  | 'button'

export interface TemplateText {
  readonly text: string
  readonly kind: TemplateTextKind
  /** Where it first appears: `tables.clients.fields.Nom`, `rows.clients[0].Nom`… */
  readonly where: string
}

interface Words {
  /** A text of the template, translated. */
  readonly text: (text: string, kind: TemplateTextKind, where: string) => string
  /** A label cited somewhere, or a choice compared in a filter: its translation, if any. */
  readonly cited: (label: string) => string
}

/**
 * The template in the language of `dictionary`, checked. `ok: false` when the dictionary
 * breaks it — the issues say where —, in which case the caller serves the French one.
 */
export function localizeTemplate(
  template: Template,
  dictionary: TemplateDictionary,
): TemplateCheck {
  const lookup = (text: string) => {
    const translated = dictionary[text]
    return typeof translated === 'string' && translated.trim() !== '' ? translated : text
  }
  return checkTemplate(rewrite(template, { text: lookup, cited: lookup }))
}

/** Every text a translator has to write for a template, each once, in reading order. */
export function templateTexts(template: Template): TemplateText[] {
  const seen = new Map<string, TemplateText>()
  rewrite(template, {
    text: (text, kind, where) => {
      if (text.trim() !== '' && !seen.has(text)) seen.set(text, { text, kind, where })
      return text
    },
    cited: (label) => label,
  })
  return [...seen.values()]
}

/** The labels a text cites `{{Libellé}}`, special tokens `{{_…}}` aside, rewritten. */
function citations(text: string, words: Words): string {
  return text.replace(/\{\{(\s*)([^{}]+?)(\s*)\}\}/g, (whole, before, label: string, after) =>
    label.startsWith('_') ? whole : `{{${before}${words.cited(label)}${after}}}`,
  )
}

/**
 * An expression — a formula, a filter —, its `[Libellé]` rewritten, and its string literals
 * too: in a filter they are the choices a field is compared with.
 */
function expression(text: string, words: Words): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i] as string
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      const end = Math.min(j + 1, text.length)
      const inner = text.slice(i + 1, end - 1).replace(/\\(.)/g, '$1')
      const translated = words.cited(inner)
      out += translated === inner ? text.slice(i, end) : JSON.stringify(translated)
      i = end
      continue
    }
    if (c === '[') {
      let j = i + 1
      let label = ''
      while (j < text.length) {
        if (text[j] === ']') {
          if (text[j + 1] === ']') {
            label += ']'
            j += 2
            continue
          }
          break
        }
        label += text[j]
        j++
      }
      out += `[${words.cited(label).replace(/]/g, ']]')}]`
      i = j + 1
      continue
    }
    out += c
    i++
  }
  return out
}

/** The template rewritten through `words`, as a raw template the validator reads back. */
function rewrite(template: Template, words: Words): Record<string, unknown> {
  const { text, cited } = words
  const optional = (
    key: string,
    value: string | undefined,
    kind: TemplateTextKind,
    where: string,
  ) => (value === undefined ? {} : { [key]: text(value, kind, where) })

  // What each table's fields are, to know how a sample value is written.
  const kinds = new Map<string, Map<string, TemplateField['kind'] | 'link'>>()
  const rich = new Set<string>()
  for (const table of template.tables) {
    const own = new Map<string, TemplateField['kind'] | 'link'>()
    for (const field of table.fields) {
      own.set(labelKey(field.label), field.kind)
      if (field.rich === true) rich.add(`${table.key}\u0000${labelKey(field.label)}`)
    }
    kinds.set(table.key, own)
  }
  for (const link of template.links) kinds.get(link.from)?.set(labelKey(link.label), 'link')

  const tables = template.tables.map((table) => {
    const at = `tables.${table.key}`
    return {
      key: table.key,
      label: text(table.label, 'label', `${at}.label`),
      ...optional('description', table.description, 'text', `${at}.description`),
      ...(table.icon === undefined ? {} : { icon: table.icon }),
      ...(table.color === undefined ? {} : { color: table.color }),
      fields: table.fields.map((field) => {
        const where = `${at}.fields.${field.label}`
        return {
          label: text(field.label, 'label', `${where}.label`),
          kind: field.kind,
          ...optional('description', field.description, 'text', `${where}.description`),
          ...(field.required === true ? { required: true } : {}),
          ...(field.options === undefined
            ? {}
            : {
                options: field.options.map((o) => ({
                  label: text(o.label, 'option', `${where}.options`),
                  ...(o.color === null ? {} : { color: o.color }),
                  ...(o.icon === null ? {} : { icon: o.icon }),
                })),
              }),
          ...(field.format === undefined ? {} : { format: field.format }),
          ...(field.rich === true ? { rich: true } : {}),
          ...(field.formula === undefined ? {} : { formula: expression(field.formula, words) }),
          ...(field.rollup === undefined
            ? {}
            : {
                rollup: {
                  ...field.rollup,
                  via: cited(field.rollup.via),
                  ...(field.rollup.target === undefined
                    ? {}
                    : { target: cited(field.rollup.target) }),
                },
              }),
          ...(field.ai === undefined
            ? {}
            : {
                ai: {
                  prompt: citations(text(field.ai.prompt, 'prompt', `${where}.ai.prompt`), words),
                  refresh: field.ai.refresh,
                },
              }),
          ...(field.button === undefined
            ? {}
            : {
                button: {
                  label: text(field.button.label, 'button', `${where}.button.label`),
                  ...(field.button.color === undefined ? {} : { color: field.button.color }),
                  ...(field.button.url === undefined
                    ? {}
                    : {
                        url: citations(text(field.button.url, 'url', `${where}.button.url`), words),
                      }),
                  ...(field.button.automation === undefined
                    ? {}
                    : { automation: field.button.automation }),
                },
              }),
        }
      }),
    }
  })

  const links = template.links.map((link) => ({
    from: link.from,
    label: text(link.label, 'label', `links.${link.from}.${link.label}`),
    to: link.to,
    multiple: link.multiple,
    ...optional(
      'description',
      link.description,
      'text',
      `links.${link.from}.${link.label}.description`,
    ),
  }))

  const rows: Record<string, unknown[]> = {}
  for (const [tableKey, list] of Object.entries(template.rows)) {
    const own = kinds.get(tableKey) ?? new Map()
    rows[tableKey] = list.map((row, ri) => {
      const out: Record<string, unknown> = {}
      for (const [label, value] of Object.entries(row)) {
        if (label === '$key') {
          out.$key = value
          continue
        }
        const where = `rows.${tableKey}[${ri}].${label}`
        const kind = own.get(labelKey(label))
        const sample =
          typeof value !== 'string'
            ? Array.isArray(value)
              ? kind === 'multi_select'
                ? value.map((v) => cited(v))
                : value
              : value
            : kind === 'select'
              ? cited(value)
              : kind === 'short_text'
                ? text(value, 'value', where)
                : kind === 'long_text'
                  ? text(
                      value,
                      rich.has(`${tableKey}\u0000${labelKey(label)}`) ? 'rich' : 'long',
                      where,
                    )
                  : kind === 'email' || kind === 'url'
                    ? text(value, kind, where)
                    : value
        out[cited(label)] = sample
      }
      return out
    })
  }

  const views = template.views.map((view, vi) => {
    const at = `views[${vi}]`
    const keys = VIEW_FIELD_KEYS[view.kind as TemplateViewKind]
    const spec: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(view.spec)) {
      if (keys.one.includes(key) && typeof value === 'string') spec[key] = cited(value)
      else if (keys.many.includes(key) && Array.isArray(value))
        spec[key] = value.map((v) => (typeof v === 'string' ? cited(v) : v))
      else if (key === 'filter' && typeof value === 'string') spec[key] = expression(value, words)
      else if (key === 'sorts' && Array.isArray(value))
        spec[key] = value.map((s: { field: string; direction: string }) => ({
          ...s,
          field: cited(s.field),
        }))
      else if (key === 'summaries' && typeof value === 'object' && value !== null)
        spec[key] = Object.fromEntries(
          Object.entries(value as Record<string, string>).map(([l, fn]) => [cited(l), fn]),
        )
      else if (key === 'color_rules' && Array.isArray(value))
        spec[key] = value.map((r: { filter: string }) => ({
          ...r,
          filter: expression(r.filter, words),
        }))
      else if (key === 'group_order' && Array.isArray(value))
        spec[key] = value.map((v) => (typeof v === 'string' ? cited(v) : v))
      else if (
        ['title', 'description', 'submit_label', 'success_message'].includes(key) &&
        typeof value === 'string'
      )
        spec[key] = text(value, 'text', `${at}.spec.${key}`)
      else if (key === 'fields' && view.kind === 'form' && Array.isArray(value))
        spec[key] = value.map(
          (q: { field: string; required: boolean; label?: string; help?: string }, qi) => ({
            field: cited(q.field),
            required: q.required,
            ...(q.label === undefined
              ? {}
              : { label: text(q.label, 'text', `${at}.spec.fields[${qi}].label`) }),
            ...(q.help === undefined
              ? {}
              : { help: text(q.help, 'text', `${at}.spec.fields[${qi}].help`) }),
          }),
        )
      else spec[key] = value
    }
    return {
      table: view.table,
      label: text(view.label, 'label', `${at}.label`),
      kind: view.kind,
      ...optional('description', view.description, 'text', `${at}.description`),
      spec,
    }
  })

  const dashboards = template.dashboards.map((dashboard, di) => {
    const at = `dashboards[${di}]`
    return {
      label: text(dashboard.label, 'label', `${at}.label`),
      ...optional('description', dashboard.description, 'text', `${at}.description`),
      blocks: dashboard.blocks.map((block, bi) => {
        const where = `${at}.blocks[${bi}]`
        const title = block.title === '' ? '' : text(block.title, 'label', `${where}.title`)
        switch (block.kind) {
          case 'text':
            return { ...block, title, body: text(block.body, 'text', `${where}.body`) }
          case 'number':
            return {
              ...block,
              title,
              field: block.field === null ? null : cited(block.field),
              filter: expression(block.filter, words),
            }
          case 'chart':
            return {
              ...block,
              title,
              group_by: cited(block.group_by),
              filter: expression(block.filter, words),
            }
          case 'list':
            return {
              ...block,
              title,
              fields: block.fields.map((f) => cited(f)),
              filter: expression(block.filter, words),
              sort: block.sort.startsWith('-')
                ? `-${cited(block.sort.slice(1))}`
                : block.sort === ''
                  ? ''
                  : cited(block.sort),
            }
        }
      }),
    }
  })

  const automations = template.automations.map((automation, ai) => {
    const at = `automations[${ai}]`
    const values = (
      tableKey: string | null,
      given: Readonly<Record<string, string | number | boolean>>,
      where: string,
    ) =>
      Object.fromEntries(
        Object.entries(given).map(([label, value]) => {
          const kind = tableKey === null ? undefined : kinds.get(tableKey)?.get(labelKey(label))
          const written =
            typeof value !== 'string'
              ? value
              : kind === 'select' || kind === 'multi_select'
                ? cited(value)
                : /^\{\{\s*_[^{}]*\}\}$/.test(value.trim())
                  ? value
                  : citations(text(value, 'message', `${where}.${label}`), words)
          return [cited(label), written]
        }),
      )
    return {
      ...(automation.key === undefined ? {} : { key: automation.key }),
      label: text(automation.label, 'label', `${at}.label`),
      ...optional('description', automation.description, 'text', `${at}.description`),
      enabled: automation.enabled,
      trigger: {
        ...automation.trigger,
        fields: automation.trigger.fields.map((f) => cited(f)),
      },
      condition: expression(automation.condition, words),
      actions: automation.actions.map((action, xi) => {
        const where = `${at}.actions[${xi}]`
        switch (action.kind) {
          case 'update_record':
            return {
              kind: action.kind,
              values: values(automation.trigger.table, action.values, `${where}.values`),
            }
          case 'create_record':
            return {
              kind: action.kind,
              table: action.table,
              values: values(action.table, action.values, `${where}.values`),
            }
          case 'notify':
            return {
              kind: action.kind,
              users: action.users,
              user_field: action.user_field === null ? null : cited(action.user_field),
              message:
                action.message === ''
                  ? ''
                  : citations(text(action.message, 'message', `${where}.message`), words),
            }
        }
      }),
    }
  })

  return {
    format: template.format,
    key: template.key,
    label: text(template.label, 'label', 'label'),
    summary: template.summary === '' ? '' : text(template.summary, 'text', 'summary'),
    ...optional('description', template.description, 'text', 'description'),
    ...optional('category', template.category, 'label', 'category'),
    ...(template.icon === undefined ? {} : { icon: template.icon }),
    ...(template.color === undefined ? {} : { color: template.color }),
    tags: template.tags.map((tag) => text(tag, 'tag', 'tags')),
    base: {
      label: text(template.base.label, 'label', 'base.label'),
      ...(template.base.description === undefined
        ? {}
        : { description: text(template.base.description, 'text', 'base.description') }),
    },
    tables,
    links,
    rows,
    views,
    dashboards,
    automations,
  }
}
