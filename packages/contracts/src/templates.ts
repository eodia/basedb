/**
 * Base templates — chapter 20. One JSON format for the public site, the instance, the AI
 * and the export of a base, and ONE validator for all of them: the server checks what it
 * stores, fetches or receives from a model; the interface checks what it is about to
 * apply; the site checks what it publishes.
 *
 * A template cites everything by labels and by keys it gives itself — never a physical
 * name, never an identifier: those exist only once the base is built.
 *
 * In `repair` mode (a proposal of the AI, §2.9), what does not hold is dropped and said
 * rather than refusing the whole; otherwise every defect is an issue and the template is
 * refused. Either way the issues name a path and say, in French, what is wrong.
 */

/**
 * The newest format of a template. Format 2 adds the rich text of a long text (`rich`): a
 * reader of format 1 would store its HTML as Markdown, so a template that holds one says 2,
 * and an older instance leaves it out rather than misread it. A template without one is
 * still written — and read everywhere — as format 1.
 */
export const TEMPLATE_FORMAT = 2 as const
export type TemplateFormat = 1 | typeof TEMPLATE_FORMAT

export const TEMPLATE_LIMITS = {
  bytes: 1_000_000,
  tables: 30,
  fieldsPerTable: 100,
  options: 50,
  rowsPerTable: 200,
  rows: 2000,
  views: 20,
  dashboards: 5,
  blocks: 12,
  automations: 20,
  actions: 10,
  label: 80,
  summary: 300,
  description: 2000,
  text: 10_000,
  prompt: 8000,
  tags: 8,
} as const

export const TEMPLATE_FIELD_KINDS = [
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'url',
  'email',
  'user',
  'autonumber',
  'formula',
  'lookup',
  'rollup',
  'count',
  'button',
] as const
export type TemplateFieldKind = (typeof TEMPLATE_FIELD_KINDS)[number]

/** What the first field — the display column — may be. */
export const TEMPLATE_DISPLAY_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'number',
  'date',
  'datetime',
  'email',
  'url',
])

/** Nobody writes these: the kernel computes them, or a click does. */
export const TEMPLATE_COMPUTED_KINDS: ReadonlySet<string> = new Set([
  'autonumber',
  'formula',
  'lookup',
  'rollup',
  'count',
  'button',
])

/** The kinds a field computed by the AI may have — chapter 12 §1.5. */
export const TEMPLATE_AI_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'url',
  'number',
  'select',
  'boolean',
  'date',
])

/** What a form may ask — chapter 15 §3: neither a relation, nor a file, nor a person. */
export const TEMPLATE_FORM_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'url',
  'email',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
])

export const TEMPLATE_VIEW_KINDS = [
  'grid',
  'kanban',
  'calendar',
  'timeline',
  'gallery',
  'list',
  'form',
] as const
export type TemplateViewKind = (typeof TEMPLATE_VIEW_KINDS)[number]

const DATES = ['date', 'datetime']
/** What a grid, a chart, groups by — the kernel's `GROUPABLE`. */
const GROUPABLE = [
  'short_text',
  'select',
  'boolean',
  'link',
  'date',
  'number',
  'url',
  'formula',
  'email',
  'user',
]

/** The kinds a view's key expects of its field — as the kernel checks them (chapter 11). */
const VIEW_KEY_KINDS: Partial<
  Record<TemplateViewKind, Readonly<Record<string, readonly string[]>>>
> = {
  grid: { group_by: GROUPABLE, color_field: ['select'] },
  kanban: { group_by: ['select'] },
  calendar: { date_field: DATES, end_field: DATES, color_field: ['select'] },
  timeline: {
    start_field: DATES,
    end_field: DATES,
    group_by: ['select', 'link'],
    color_field: ['select'],
    depends_on: ['link', 'multi_link'],
  },
  gallery: { color_field: ['select'] },
  list: { group_by: ['select', 'link', 'user'] },
}

/** The summaries a column of a kind takes — the kernel's `aggregatesFor`. */
function summariesFor(kind: string): readonly string[] {
  if (kind === 'boolean') return ['checked', 'filled', 'empty']
  if (kind === 'number') return ['filled', 'empty', 'unique', 'sum', 'avg', 'min', 'max']
  if (kind === 'date' || kind === 'datetime' || kind === 'autonumber')
    return ['filled', 'empty', 'min', 'max']
  if (['long_text', 'multi_select', 'multi_link', 'lookup'].includes(kind))
    return ['filled', 'empty']
  return ['filled', 'empty', 'unique']
}

const NUMBER_FORMATS = ['decimal', 'integer', 'percent', 'currency', 'duration', 'rating']
const TEXT_FORMATS = ['plain', 'phone', 'barcode']
const AGGREGATES = ['count', 'sum', 'avg', 'min', 'max'] as const
type Aggregate = (typeof AGGREGATES)[number]

// ── The shapes, once checked ─────────────────────────────────────────────────────────

export interface TemplateOption {
  readonly label: string
  /** Derived from the label: what the column stores. */
  readonly value: string
  readonly color: string | null
  readonly icon: string | null
}

export interface TemplateField {
  readonly label: string
  readonly kind: TemplateFieldKind
  readonly description?: string
  readonly required?: boolean
  readonly options?: readonly TemplateOption[]
  readonly format?: {
    readonly display: string
    readonly currency?: string
    readonly rating_max?: number
  }
  /**
   * A `long_text` that holds HTML — the rich variant of chapter 04 §2.2: its sample values
   * are HTML, sanitized by the server as they are written. Never the display column, never
   * computed by the AI.
   */
  readonly rich?: boolean
  readonly formula?: string
  readonly rollup?: {
    /** The label of the relation followed. */
    readonly via: string
    /** The key of the table the relation belongs to, when it aims at this one. */
    readonly table?: string
    /** The label of the field read in the table reached. */
    readonly target?: string
    readonly aggregate?: Aggregate
  }
  readonly ai?: {
    /** Cites the table's fields `{{Libellé}}`. */
    readonly prompt: string
    readonly refresh: 'if_empty' | { readonly cron: string; readonly timezone: string }
  }
  readonly button?: {
    readonly label: string
    readonly color?: string
    /** `https:` or `mailto:`, composed of the row `{{Libellé}}`. */
    readonly url?: string
    /** The key of an automation of the template, triggered by `button`. */
    readonly automation?: string
  }
}

export interface TemplateTable {
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly icon?: string
  readonly color?: string
  /** The first is the display column. */
  readonly fields: readonly TemplateField[]
}

export interface TemplateLink {
  readonly from: string
  readonly label: string
  readonly to: string
  readonly multiple: boolean
  readonly description?: string
}

export type TemplateValue = string | number | boolean | readonly string[]

/** Values by field label; `$key` names the row for the relations that point at it. */
export type TemplateRow = Readonly<Record<string, TemplateValue>> & { readonly $key?: string }

export interface TemplateView {
  readonly table: string
  readonly label: string
  readonly kind: TemplateViewKind
  readonly description?: string
  /** Chapter 11's spec, fields cited by label. */
  readonly spec: Readonly<Record<string, unknown>>
}

export type TemplateBlock =
  | {
      readonly kind: 'number'
      readonly title: string
      readonly width: number
      readonly table: string
      readonly aggregate: Aggregate
      readonly field: string | null
      readonly filter: string
    }
  | {
      readonly kind: 'chart'
      readonly title: string
      readonly width: number
      readonly table: string
      readonly group_by: string
      readonly filter: string
      readonly style: 'bar' | 'pie'
    }
  | {
      readonly kind: 'list'
      readonly title: string
      readonly width: number
      readonly table: string
      readonly fields: readonly string[]
      readonly filter: string
      /** A field label, `-` in front for the descending order; empty: the table's order. */
      readonly sort: string
      readonly limit: number
    }
  | { readonly kind: 'text'; readonly title: string; readonly width: number; readonly body: string }

export interface TemplateDashboard {
  readonly label: string
  readonly description?: string
  readonly blocks: readonly TemplateBlock[]
}

export type TemplateAction =
  | {
      readonly kind: 'update_record'
      readonly values: Readonly<Record<string, string | number | boolean>>
    }
  | {
      readonly kind: 'create_record'
      readonly table: string
      readonly values: Readonly<Record<string, string | number | boolean>>
    }
  | {
      readonly kind: 'notify'
      /** `$moi` only: the person who applies the template. */
      readonly users: readonly string[]
      readonly user_field: string | null
      readonly message: string
    }

export interface TemplateAutomation {
  readonly key?: string
  readonly label: string
  readonly description?: string
  readonly enabled: boolean
  readonly trigger: {
    readonly kind: 'record_created' | 'record_updated' | 'schedule' | 'button'
    readonly table: string | null
    readonly fields: readonly string[]
    readonly schedule: {
      readonly every: 'hour' | 'day' | 'week'
      readonly at: string
      readonly weekday: number
      readonly timezone: string
    } | null
  }
  readonly condition: string
  readonly actions: readonly TemplateAction[]
}

export interface Template {
  /** The lowest format that carries it: 2 when a field is a rich text, 1 otherwise. */
  readonly format: TemplateFormat
  readonly key: string
  readonly label: string
  readonly summary: string
  readonly description?: string
  readonly category?: string
  readonly icon?: string
  readonly color?: string
  readonly tags: readonly string[]
  readonly base: { readonly label: string; readonly description?: string }
  readonly tables: readonly TemplateTable[]
  readonly links: readonly TemplateLink[]
  readonly rows: Readonly<Record<string, readonly TemplateRow[]>>
  readonly views: readonly TemplateView[]
  readonly dashboards: readonly TemplateDashboard[]
  readonly automations: readonly TemplateAutomation[]
}

export interface TemplateIssue {
  readonly path: string
  readonly message: string
}

export type TemplateCheck =
  | { readonly ok: true; readonly template: Template; readonly issues: readonly TemplateIssue[] }
  | { readonly ok: false; readonly issues: readonly TemplateIssue[] }

/** What a gallery shows of a template before it is opened. */
export interface TemplateSummary {
  readonly key: string
  readonly label: string
  readonly summary: string
  readonly category: string | null
  readonly icon: string | null
  readonly color: string | null
  readonly tags: readonly string[]
  readonly counts: {
    readonly tables: number
    readonly fields: number
    readonly rows: number
    readonly views: number
    readonly dashboards: number
    readonly automations: number
    readonly ai_fields: number
  }
}

// ── Small shared helpers ─────────────────────────────────────────────────────────────

/** How two labels compare: case, accents and runs of spaces do not count. */
export function labelKey(label: string): string {
  return label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** The value a choice stores, derived from its label. */
export function optionValue(label: string): string {
  const value = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return value === '' ? 'choix' : value
}

const PALETTE = [
  '#94a3b8',
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]

/** The labels an expression cites `[Libellé]` — a `]` in a label is doubled. */
export function citedLabels(expression: string): string[] {
  const out: string[] = []
  scanCitations(expression, (label) => {
    out.push(label)
    return null
  })
  return out
}

/**
 * Walks an expression, handing each `[Libellé]` to `replace`: a string replaces the
 * citation, `null` keeps it. String literals are passed over — a `[` inside `"…"` is text.
 */
function scanCitations(expression: string, replace: (label: string) => string | null): string {
  let out = ''
  let i = 0
  while (i < expression.length) {
    const c = expression[i] as string
    if (c === '"') {
      const end = stringEnd(expression, i)
      out += expression.slice(i, end)
      i = end
      continue
    }
    if (c === '[') {
      let j = i + 1
      let label = ''
      while (j < expression.length) {
        if (expression[j] === ']') {
          if (expression[j + 1] === ']') {
            label += ']'
            j += 2
            continue
          }
          break
        }
        label += expression[j]
        j++
      }
      const replaced = replace(label)
      out += replaced ?? expression.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += c
    i++
  }
  return out
}

/** The index just past a string literal opening at `start`, escapes included. */
function stringEnd(text: string, start: number): number {
  let j = start + 1
  while (j < text.length) {
    if (text[j] === '\\') {
      j += 2
      continue
    }
    if (text[j] === '"') return j + 1
    j++
  }
  return text.length
}

/** The labels a message or a prompt cites `{{Libellé}}`, special tokens `{{_…}}` aside. */
export function citedInText(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
    .map((m) => m[1] as string)
    .filter((label) => !label.startsWith('_'))
}

/** A field as `translateFilter` resolves it: its name, and its choices for a list. */
export interface ResolvedField {
  readonly name: string
  readonly options?: readonly { readonly label: string; readonly value: string }[]
}

/**
 * A template's filter as the API reads it: each `[Libellé]` becomes the field's name, and
 * a choice compared by its label becomes its value — otherwise the filter would find
 * nothing. Returns the labels it could not resolve, leaving them as they were.
 */
export function translateFilter(
  filter: string,
  resolve: (label: string) => ResolvedField | null,
): { readonly filter: string; readonly unknown: readonly string[] } {
  const unknown: string[] = []
  let out = ''
  let current: ResolvedField | null = null
  let i = 0
  while (i < filter.length) {
    const c = filter[i] as string
    if (c === '"') {
      const end = stringEnd(filter, i)
      const literal = filter.slice(i, end)
      let replaced = literal
      if (current?.options !== undefined) {
        const inner = literal.slice(1, -1).replace(/\\(.)/g, '$1')
        const option =
          current.options.find((o) => labelKey(o.label) === labelKey(inner)) ??
          current.options.find((o) => o.value === inner)
        if (option !== undefined) replaced = JSON.stringify(option.value)
      }
      out += replaced
      i = end
      continue
    }
    if (c === '[') {
      let j = i + 1
      let label = ''
      while (j < filter.length) {
        if (filter[j] === ']') {
          if (filter[j + 1] === ']') {
            label += ']'
            j += 2
            continue
          }
          break
        }
        label += filter[j]
        j++
      }
      const field = resolve(label)
      if (field === null) {
        unknown.push(label)
        out += filter.slice(i, j + 1)
      } else {
        out += field.name
      }
      current = field
      i = j + 1
      continue
    }
    // `and` / `or` end a comparison: a literal after them belongs to the next field.
    const word = /^[A-Za-z_]+/.exec(filter.slice(i))?.[0]
    if (word !== undefined) {
      if (word === 'and' || word === 'or') current = null
      out += word
      i += word.length
      continue
    }
    out += c
    i++
  }
  return { filter: out, unknown }
}

/**
 * A date of a template as the API takes it: `2026-10-01`, or relative to `today` —
 * `today`, `+3d`, `-2w`, `+1m`, `+1y` —, a date-time adding ` HH:MM` (09:00 when absent).
 * `null` when the text is neither.
 */
export function resolveTemplateDate(
  value: string,
  kind: 'date' | 'datetime',
  today: Date,
): string | null {
  const text = value.trim()
  const pad = (n: number) => String(n).padStart(2, '0')
  const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const relative = /^(today|([+-])(\d{1,4})([dwmy]))(?:\s+(\d{1,2}):(\d{2}))?$/.exec(text)
  if (relative !== null) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (relative[2] !== undefined) {
      const n = Number(relative[3]) * (relative[2] === '-' ? -1 : 1)
      const unit = relative[4]
      if (unit === 'd') d.setDate(d.getDate() + n)
      if (unit === 'w') d.setDate(d.getDate() + 7 * n)
      if (unit === 'm') d.setMonth(d.getMonth() + n)
      if (unit === 'y') d.setFullYear(d.getFullYear() + n)
    }
    if (kind === 'date') return local(d)
    const hours = relative[5] === undefined ? 9 : Number(relative[5])
    const minutes = relative[6] === undefined ? 0 : Number(relative[6])
    if (hours > 23 || minutes > 59) return null
    d.setHours(hours, minutes, 0, 0)
    return d.toISOString()
  }

  const absolute =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      text,
    )
  if (absolute === null) return null
  const [, y, mo, da, h, mi, zone] = absolute
  const day = new Date(Number(y), Number(mo) - 1, Number(da))
  if (day.getMonth() !== Number(mo) - 1) return null
  if (kind === 'date') return `${y}-${mo}-${da}`
  if (h === undefined) {
    day.setHours(9, 0, 0, 0)
    return day.toISOString()
  }
  const parsed =
    zone === undefined
      ? new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi))
      : new Date(text.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** The view spec keys that cite ONE field, and those that cite a LIST of fields. */
export const VIEW_FIELD_KEYS: Readonly<
  Record<
    TemplateViewKind,
    {
      readonly one: readonly string[]
      readonly many: readonly string[]
      readonly other: readonly string[]
    }
  >
> = {
  grid: {
    one: ['group_by', 'color_field'],
    many: ['hidden', 'pinned', 'column_order'],
    other: [
      'filter',
      'sorts',
      'summaries',
      'row_height',
      'page_size',
      'color_rules',
      'color_style',
    ],
  },
  kanban: {
    one: ['group_by', 'title_field'],
    many: ['card_fields'],
    other: ['filter', 'sorts', 'group_order', 'hide_empty'],
  },
  calendar: {
    one: ['date_field', 'end_field', 'color_field', 'title_field'],
    many: ['card_fields'],
    other: ['filter', 'sorts', 'mode'],
  },
  timeline: {
    one: ['start_field', 'end_field', 'group_by', 'color_field', 'depends_on', 'title_field'],
    many: ['card_fields'],
    other: ['filter', 'sorts', 'scale'],
  },
  gallery: {
    one: ['title_field', 'color_field'],
    many: ['card_fields'],
    other: ['filter', 'sorts', 'card_size'],
  },
  list: {
    one: ['group_by', 'title_field'],
    many: ['card_fields'],
    other: ['filter', 'sorts'],
  },
  form: {
    one: [],
    many: [],
    other: ['title', 'description', 'fields', 'submit_label', 'success_message', 'allow_another'],
  },
}

// ── The checker ──────────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>
const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/
const TABLE_KEY = /^[a-z0-9]+([_-][a-z0-9]+)*$/
const ROW_KEY = /^[A-Za-z0-9_-]{1,64}$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const ICON = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** A table's fields as the checker knows them: its own, then its relations. */
interface Known {
  readonly table: TemplateTable
  readonly fields: Map<
    string,
    {
      label: string
      kind: string
      options?: readonly TemplateOption[]
      ai: boolean
      link?: TemplateLink
    }
  >
}

class Checker {
  readonly issues: TemplateIssue[] = []
  /** The format the template says it is written in. */
  format: TemplateFormat = TEMPLATE_FORMAT
  constructor(readonly repair: boolean) {}

  say(path: string, message: string): void {
    if (this.issues.length < 200) this.issues.push({ path, message })
  }

  text(raw: Raw, key: string, path: string, max: number, required: true): string | null
  text(raw: Raw, key: string, path: string, max: number, required?: false): string | undefined
  text(
    raw: Raw,
    key: string,
    path: string,
    max: number,
    required: boolean,
  ): string | null | undefined
  text(
    raw: Raw,
    key: string,
    path: string,
    max: number,
    required = false,
  ): string | null | undefined {
    const value = raw[key]
    if (value === undefined || value === null || value === '') {
      if (required) {
        this.say(`${path}.${key}`, 'valeur obligatoire')
        return null
      }
      return undefined
    }
    if (typeof value !== 'string' && !(this.repair && typeof value === 'number')) {
      this.say(`${path}.${key}`, 'texte attendu')
      return required ? null : undefined
    }
    const text = String(value).trim()
    if (text.length > max) {
      if (this.repair) {
        this.say(`${path}.${key}`, `coupé à ${max} caractères`)
        return text.slice(0, max)
      }
      this.say(`${path}.${key}`, `${max} caractères au plus`)
      return required ? null : undefined
    }
    if (text === '' && required) {
      this.say(`${path}.${key}`, 'valeur obligatoire')
      return null
    }
    return text === '' ? undefined : text
  }

  list(raw: Raw, key: string, path: string, max: number): unknown[] {
    const value = raw[key]
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) {
      this.say(`${path}.${key}`, 'liste attendue')
      return []
    }
    if (value.length > max) {
      this.say(`${path}.${key}`, `${max} éléments au plus`)
      return this.repair ? value.slice(0, max) : []
    }
    return value
  }
}

/** Checks a template; see the module's comment for what `repair` changes. */
export function checkTemplate(
  raw: unknown,
  options: { readonly repair?: boolean } = {},
): TemplateCheck {
  const c = new Checker(options.repair === true)
  const fail = (): TemplateCheck => ({ ok: false, issues: c.issues })

  if (!isRecord(raw)) {
    c.say('', 'un objet JSON est attendu')
    return fail()
  }
  try {
    if (JSON.stringify(raw).length > TEMPLATE_LIMITS.bytes) {
      c.say('', '1 Mo au plus')
      return fail()
    }
  } catch {
    c.say('', 'objet non sérialisable')
    return fail()
  }
  if (raw.format !== undefined && raw.format !== 1 && raw.format !== TEMPLATE_FORMAT) {
    c.say('format', `format ${String(raw.format)} inconnu ; seuls les formats 1 et 2 existent`)
    return fail()
  }
  if (raw.format === 1) c.format = 1

  const label = c.text(raw, 'label', '', TEMPLATE_LIMITS.label, true)
  let key = c.text(raw, 'key', '', 64, !c.repair) ?? undefined
  if (key !== undefined && !KEY.test(key)) {
    if (c.repair) key = undefined
    else c.say('key', 'minuscules, chiffres et tirets seulement')
  }
  if (key === undefined && label !== null)
    key = optionValue(label).replace(/_/g, '-').slice(0, 64) || 'modele'
  const summary = c.text(raw, 'summary', '', TEMPLATE_LIMITS.summary) ?? ''
  const description = c.text(raw, 'description', '', TEMPLATE_LIMITS.description)
  const category = c.text(raw, 'category', '', TEMPLATE_LIMITS.label)
  let icon = c.text(raw, 'icon', '', 40)
  if (icon !== undefined && !ICON.test(icon)) {
    c.say('icon', 'nom d’icône invalide')
    icon = undefined
  }
  let color = c.text(raw, 'color', '', 7)
  if (color !== undefined && !COLOR.test(color)) {
    c.say('color', 'couleur #rrggbb attendue')
    color = undefined
  }
  const tags = c
    .list(raw, 'tags', '', TEMPLATE_LIMITS.tags)
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map((t) => t.trim().slice(0, 30))
  const rawBase = isRecord(raw.base) ? raw.base : {}
  const baseLabel = c.text(rawBase, 'label', 'base', TEMPLATE_LIMITS.label) ?? label ?? ''
  const baseDescription = c.text(rawBase, 'description', 'base', TEMPLATE_LIMITS.description)

  // ── Tables and their own fields ──
  const tables: TemplateTable[] = []
  const known = new Map<string, Known>()
  const tableLabels = new Set<string>()
  const rawTables = c.list(raw, 'tables', '', TEMPLATE_LIMITS.tables)
  if (rawTables.length === 0) c.say('tables', 'au moins une table')
  rawTables.forEach((rt, ti) => {
    const path = `tables[${ti}]`
    if (!isRecord(rt)) {
      c.say(path, 'objet attendu')
      return
    }
    const tLabel = c.text(rt, 'label', path, TEMPLATE_LIMITS.label, true)
    let tKey = c.text(rt, 'key', path, 64, !c.repair) ?? undefined
    if (tKey === undefined && tLabel !== null) tKey = optionValue(tLabel)
    if (tKey !== undefined && !TABLE_KEY.test(tKey)) {
      c.say(`${path}.key`, 'minuscules, chiffres, tirets ou soulignés seulement')
      tKey = c.repair && tLabel !== null ? optionValue(tLabel) : undefined
    }
    if (tLabel === null || tKey === undefined) return
    if (known.has(tKey) || tableLabels.has(labelKey(tLabel))) {
      c.say(path, `table « ${tLabel} » en double`)
      return
    }
    const fields: TemplateField[] = []
    const fieldLabels = new Set<string>()
    c.list(rt, 'fields', path, TEMPLATE_LIMITS.fieldsPerTable).forEach((rf, fi) => {
      const field = checkField(c, rf, `${path}.fields[${fi}]`, fi === 0)
      if (field === null) return
      if (fieldLabels.has(labelKey(field.label))) {
        c.say(`${path}.fields[${fi}]`, `champ « ${field.label} » en double`)
        return
      }
      fieldLabels.add(labelKey(field.label))
      fields.push(field)
    })
    const first = fields[0]
    if (first === undefined) {
      c.say(`${path}.fields`, 'au moins un champ')
      return
    }
    if (!TEMPLATE_DISPLAY_KINDS.has(first.kind) || first.ai !== undefined) {
      c.say(
        `${path}.fields[0]`,
        'le premier champ, colonne d’affichage, est un texte, un nombre, une date, un e-mail ou une adresse',
      )
      if (!c.repair) return
      fields.unshift({ label: uniqueLabel('Nom', fieldLabels), kind: 'short_text' })
    }
    let tIcon = c.text(rt, 'icon', path, 40)
    if (tIcon !== undefined && !ICON.test(tIcon)) tIcon = undefined
    let tColor = c.text(rt, 'color', path, 7)
    if (tColor !== undefined && !COLOR.test(tColor)) tColor = undefined
    const tDescription = c.text(rt, 'description', path, TEMPLATE_LIMITS.description)
    const table: TemplateTable = {
      key: tKey,
      label: tLabel,
      ...(tDescription === undefined ? {} : { description: tDescription }),
      ...(tIcon === undefined ? {} : { icon: tIcon }),
      ...(tColor === undefined ? {} : { color: tColor }),
      fields,
    }
    tables.push(table)
    tableLabels.add(labelKey(tLabel))
    known.set(tKey, {
      table,
      fields: new Map(
        fields.map((f) => [
          labelKey(f.label),
          {
            label: f.label,
            kind: f.kind,
            ...(f.options === undefined ? {} : { options: f.options }),
            ai: f.ai !== undefined,
          },
        ]),
      ),
    })
  })
  if (tables.length === 0) {
    if (c.issues.every((i) => i.path !== 'tables')) c.say('tables', 'aucune table valide')
    return fail()
  }

  // ── Relations ──
  const links: TemplateLink[] = []
  c.list(raw, 'links', '', 100).forEach((rl, li) => {
    const path = `links[${li}]`
    if (!isRecord(rl)) {
      c.say(path, 'objet attendu')
      return
    }
    const from = c.text(rl, 'from', path, 64, true)
    const to = c.text(rl, 'to', path, 64, true)
    const lLabel = c.text(rl, 'label', path, TEMPLATE_LIMITS.label, true)
    if (from === null || to === null || lLabel === null) return
    const source = known.get(from)
    const target = known.get(to)
    if (source === undefined || target === undefined) {
      c.say(path, `table « ${source === undefined ? from : to} » inconnue`)
      return
    }
    if (source.fields.has(labelKey(lLabel))) {
      c.say(path, `« ${lLabel} » existe déjà dans « ${source.table.label} »`)
      return
    }
    const lDescription = c.text(rl, 'description', path, TEMPLATE_LIMITS.description)
    const link: TemplateLink = {
      from,
      label: lLabel,
      to,
      multiple: rl.multiple === true,
      ...(lDescription === undefined ? {} : { description: lDescription }),
    }
    links.push(link)
    source.fields.set(labelKey(lLabel), {
      label: lLabel,
      kind: link.multiple ? 'multi_link' : 'link',
      ai: false,
      link,
    })
  })

  // ── What the fields compute: formulas, relations followed, prompts, buttons ──
  const automationKeys = new Map<string, Raw>()
  // Read directly, not through `list`: the automations are checked — and said — below.
  for (const ra of Array.isArray(raw.automations) ? raw.automations : []) {
    if (isRecord(ra) && typeof ra.key === 'string') automationKeys.set(ra.key, ra)
  }
  for (const [ti, table] of tables.entries()) {
    const self = known.get(table.key) as Known
    const kept: TemplateField[] = []
    const declared = new Set<string>()
    for (const [fi, field] of table.fields.entries()) {
      const path = `tables[${ti}].fields[${fi}]`
      const ok = checkComputed(
        c,
        field,
        path,
        self,
        known,
        links,
        declared,
        automationKeys,
        table.key,
      )
      if (!ok) {
        if (c.repair) {
          self.fields.delete(labelKey(field.label))
          continue
        }
      }
      declared.add(labelKey(field.label))
      kept.push(field)
    }
    ;(table as { fields: readonly TemplateField[] }).fields = kept
  }

  // ── Sample rows ──
  const rows: Record<string, TemplateRow[]> = {}
  const rowKeys = new Map<string, Set<string>>()
  let total = 0
  const rawRows = isRecord(raw.rows) ? raw.rows : raw.rows === undefined ? {} : null
  if (rawRows === null) c.say('rows', 'objet attendu : des lignes par clé de table')
  for (const [tKey, list] of Object.entries(rawRows ?? {})) {
    const self = known.get(tKey)
    if (self === undefined) {
      c.say(`rows.${tKey}`, `table « ${tKey} » inconnue`)
      continue
    }
    if (!Array.isArray(list)) {
      c.say(`rows.${tKey}`, 'liste attendue')
      continue
    }
    const keys = new Set<string>()
    const out: TemplateRow[] = []
    for (const [ri, rr] of list.slice(0, TEMPLATE_LIMITS.rowsPerTable).entries()) {
      if (total >= TEMPLATE_LIMITS.rows) break
      const row = checkRow(c, rr, `rows.${tKey}[${ri}]`, self, keys)
      if (row !== null) {
        out.push(row)
        total++
      }
    }
    if (list.length > TEMPLATE_LIMITS.rowsPerTable)
      c.say(`rows.${tKey}`, `${TEMPLATE_LIMITS.rowsPerTable} lignes au plus`)
    rows[tKey] = out
    rowKeys.set(tKey, keys)
  }
  // The relations' `@clé`, now that every row has its key.
  for (const [tKey, list] of Object.entries(rows)) {
    const self = known.get(tKey) as Known
    rows[tKey] = list.map((row, ri) => {
      const next: Record<string, TemplateValue> = { ...row }
      for (const [label, value] of Object.entries(row)) {
        const field = self.fields.get(labelKey(label))
        if (field?.link === undefined) continue
        const targets = rowKeys.get(field.link.to) ?? new Set<string>()
        const refs = (Array.isArray(value) ? value : [value]) as string[]
        const good = refs.filter((ref) => targets.has(ref.slice(1)))
        if (good.length !== refs.length) {
          c.say(
            `rows.${tKey}[${ri}].${label}`,
            `ligne ${refs.filter((r) => !good.includes(r)).join(', ')} inconnue dans « ${known.get(field.link.to)?.table.label} »`,
          )
        }
        if (good.length === 0) delete next[label]
        else next[label] = field.link.multiple ? good : (good[0] as string)
      }
      return next as TemplateRow
    })
  }

  // ── Views, dashboards, automations ──
  const views: TemplateView[] = []
  c.list(raw, 'views', '', TEMPLATE_LIMITS.views).forEach((rv, vi) => {
    const view = checkView(c, rv, `views[${vi}]`, known, views)
    if (view !== null) views.push(view)
  })
  const dashboards: TemplateDashboard[] = []
  c.list(raw, 'dashboards', '', TEMPLATE_LIMITS.dashboards).forEach((rd, di) => {
    const dashboard = checkDashboard(c, rd, `dashboards[${di}]`, known)
    if (dashboard !== null) dashboards.push(dashboard)
  })
  const automations: TemplateAutomation[] = []
  c.list(raw, 'automations', '', TEMPLATE_LIMITS.automations).forEach((ra, ai) => {
    const automation = checkAutomation(c, ra, `automations[${ai}]`, known)
    if (automation !== null) automations.push(automation)
  })
  // A button whose automation did not survive loses its button.
  for (const table of tables) {
    const buttons = table.fields.filter((f) => f.button?.automation !== undefined)
    for (const field of buttons) {
      if (
        !automations.some((a) => a.key === field.button?.automation && a.trigger.kind === 'button')
      ) {
        c.say(`tables.${table.key}.${field.label}`, 'automatisation du bouton introuvable')
        if (c.repair)
          (table as { fields: readonly TemplateField[] }).fields = table.fields.filter(
            (f) => f !== field,
          )
      }
    }
  }

  if (label === null || key === undefined) return fail()
  if (!c.repair && c.issues.length > 0) return fail()

  const template: Template = {
    format: tables.some((t) => t.fields.some((f) => f.rich === true)) ? 2 : 1,
    key,
    label,
    summary,
    ...(description === undefined ? {} : { description }),
    ...(category === undefined ? {} : { category }),
    ...(icon === undefined ? {} : { icon }),
    ...(color === undefined ? {} : { color }),
    tags,
    base: {
      label: baseLabel,
      ...(baseDescription === undefined ? {} : { description: baseDescription }),
    },
    tables,
    links,
    rows,
    views,
    dashboards,
    automations,
  }
  return { ok: true, template, issues: c.issues }
}

function uniqueLabel(label: string, taken: Set<string>): string {
  let candidate = label
  for (let n = 2; taken.has(labelKey(candidate)); n++) candidate = `${label} ${n}`
  taken.add(labelKey(candidate))
  return candidate
}

function checkField(c: Checker, rf: unknown, path: string, first: boolean): TemplateField | null {
  if (!isRecord(rf)) {
    c.say(path, 'objet attendu')
    return null
  }
  const label = c.text(rf, 'label', path, TEMPLATE_LIMITS.label, true)
  if (label === null) return null
  let kind = rf.kind
  if (kind === 'link' || kind === 'multi_link') {
    c.say(`${path}.kind`, 'une relation se déclare dans « links »')
    return null
  }
  if (kind === 'file' || kind === 'image') {
    c.say(`${path}.kind`, 'un modèle ne porte pas de fichier')
    if (!c.repair) return null
    kind = 'url'
  }
  if (typeof kind !== 'string' || !(TEMPLATE_FIELD_KINDS as readonly string[]).includes(kind)) {
    c.say(`${path}.kind`, `type « ${String(kind)} » inconnu`)
    if (!c.repair) return null
    kind = 'short_text'
  }
  const field: { -readonly [K in keyof TemplateField]: TemplateField[K] } = {
    label,
    kind: kind as TemplateFieldKind,
  }
  const description = c.text(rf, 'description', path, TEMPLATE_LIMITS.description)
  if (description !== undefined) field.description = description
  if (rf.required === true && !TEMPLATE_COMPUTED_KINDS.has(field.kind)) field.required = true

  if (field.kind === 'select' || field.kind === 'multi_select') {
    const options: TemplateOption[] = []
    const seen = new Set<string>()
    const values = new Set<string>()
    c.list(rf, 'options', path, TEMPLATE_LIMITS.options).forEach((ro, oi) => {
      const option = typeof ro === 'string' ? { label: ro } : isRecord(ro) ? ro : null
      const oLabel =
        option === null
          ? null
          : c.text(option, 'label', `${path}.options[${oi}]`, TEMPLATE_LIMITS.label, true)
      if (option === null || oLabel === null) return
      if (seen.has(labelKey(oLabel))) return
      seen.add(labelKey(oLabel))
      let value = optionValue(oLabel)
      for (let n = 2; values.has(value); n++) value = `${optionValue(oLabel)}_${n}`
      values.add(value)
      const oColor =
        typeof option.color === 'string' && COLOR.test(option.color) ? option.color : null
      const oIcon = typeof option.icon === 'string' && ICON.test(option.icon) ? option.icon : null
      options.push({
        label: oLabel,
        value,
        color: oColor ?? (PALETTE[options.length % PALETTE.length] as string),
        icon: oIcon,
      })
    })
    if (options.length === 0) {
      c.say(`${path}.options`, 'au moins un choix')
      if (!c.repair) return null
      field.kind = 'short_text'
    } else {
      field.options = options
    }
  }

  if (isRecord(rf.format)) {
    const display = rf.format.display
    const allowed =
      field.kind === 'number' ? NUMBER_FORMATS : field.kind === 'short_text' ? TEXT_FORMATS : null
    if (allowed === null || typeof display !== 'string' || !allowed.includes(display)) {
      c.say(`${path}.format`, 'format inconnu pour ce type')
    } else {
      const format: { display: string; currency?: string; rating_max?: number } = { display }
      if (display === 'currency') {
        const code =
          typeof rf.format.currency === 'string' ? rf.format.currency.toUpperCase() : 'EUR'
        format.currency = /^[A-Z]{3}$/.test(code) ? code : 'EUR'
      }
      if (display === 'rating') {
        const max = rf.format.rating_max
        format.rating_max =
          typeof max === 'number' && Number.isInteger(max) && max >= 1 && max <= 10 ? max : 5
      }
      field.format = format
    }
  }

  if (rf.rich === true) {
    if (field.kind !== 'long_text') c.say(`${path}.rich`, 'seul un texte long peut être riche')
    else if (first) c.say(`${path}.rich`, 'la colonne d’affichage n’est pas un texte riche')
    else if (c.format === 1) c.say(`${path}.rich`, 'un texte riche demande "format": 2')
    else field.rich = true
  }

  if (field.kind === 'formula') {
    const formula = c.text(rf, 'formula', path, 4000, true)
    if (formula === null) return null
    field.formula = formula
  }
  if (field.kind === 'lookup' || field.kind === 'rollup' || field.kind === 'count') {
    const rr = isRecord(rf.rollup) ? rf.rollup : null
    const via =
      rr === null ? null : c.text(rr, 'via', `${path}.rollup`, TEMPLATE_LIMITS.label, true)
    if (rr === null || via === null) {
      if (rr === null) c.say(`${path}.rollup`, 'la relation suivie est obligatoire')
      return null
    }
    const rollup: { via: string; table?: string; target?: string; aggregate?: Aggregate } = { via }
    const table = c.text(rr, 'table', `${path}.rollup`, 64)
    if (table !== undefined) rollup.table = table
    const target = c.text(rr, 'target', `${path}.rollup`, TEMPLATE_LIMITS.label)
    if (target !== undefined) rollup.target = target
    if (field.kind !== 'count' && target === undefined) {
      c.say(`${path}.rollup.target`, 'le champ lu est obligatoire')
      return null
    }
    if (field.kind === 'rollup') {
      const aggregate = rr.aggregate
      if (typeof aggregate !== 'string' || !(AGGREGATES as readonly string[]).includes(aggregate)) {
        c.say(`${path}.rollup.aggregate`, 'agrégat attendu : count, sum, avg, min ou max')
        if (!c.repair) return null
        rollup.aggregate = 'sum'
      } else {
        rollup.aggregate = aggregate as Aggregate
      }
    }
    field.rollup = rollup
  }

  if (rf.ai !== undefined && rf.ai !== null) {
    const ra = isRecord(rf.ai) ? rf.ai : null
    const prompt =
      ra === null ? null : c.text(ra, 'prompt', `${path}.ai`, TEMPLATE_LIMITS.prompt, true)
    if (!TEMPLATE_AI_KINDS.has(field.kind)) {
      c.say(`${path}.ai`, 'l’IA ne calcule pas ce type de champ')
    } else if (field.rich === true) {
      c.say(`${path}.ai`, 'l’IA n’écrit pas de texte riche')
    } else if (first) {
      c.say(`${path}.ai`, 'la colonne d’affichage n’est pas calculée par l’IA')
    } else if (ra !== null && prompt !== null) {
      let refresh: NonNullable<TemplateField['ai']>['refresh'] = 'if_empty'
      if (isRecord(ra.refresh) && typeof ra.refresh.cron === 'string') {
        refresh = {
          cron: ra.refresh.cron,
          timezone: typeof ra.refresh.timezone === 'string' ? ra.refresh.timezone : 'Europe/Paris',
        }
      }
      field.ai = { prompt, refresh }
    }
    if (field.ai === undefined && !c.repair) return null
  }

  if (field.kind === 'button') {
    const rb = isRecord(rf.button) ? rf.button : null
    const bLabel = rb === null ? null : c.text(rb, 'label', `${path}.button`, 40, true)
    if (rb === null || bLabel === null) {
      if (rb === null) c.say(`${path}.button`, 'le libellé et l’action du bouton sont obligatoires')
      return null
    }
    const url = c.text(rb, 'url', `${path}.button`, 2000)
    const automation = c.text(rb, 'automation', `${path}.button`, 64)
    if (url !== undefined && !/^(https:\/\/|mailto:)/i.test(url)) {
      c.say(`${path}.button.url`, 'une adresse https: ou mailto: seulement')
      return null
    }
    if ((url === undefined) === (automation === undefined)) {
      c.say(`${path}.button`, 'une adresse ou une automatisation, l’une ou l’autre')
      return null
    }
    const bColor = typeof rb.color === 'string' && COLOR.test(rb.color) ? rb.color : undefined
    field.button = {
      label: bLabel,
      ...(bColor === undefined ? {} : { color: bColor }),
      ...(url === undefined ? {} : { url }),
      ...(automation === undefined ? {} : { automation }),
    }
  }
  return field
}

function checkComputed(
  c: Checker,
  field: TemplateField,
  path: string,
  self: Known,
  known: ReadonlyMap<string, Known>,
  links: readonly TemplateLink[],
  declared: ReadonlySet<string>,
  automations: ReadonlyMap<string, Raw>,
  tableKey: string,
): boolean {
  const lookup = (label: string) => self.fields.get(labelKey(label))
  if (field.formula !== undefined) {
    for (const cited of citedLabels(field.formula)) {
      const target = lookup(cited)
      if (target === undefined) {
        c.say(`${path}.formula`, `champ « ${cited} » inconnu`)
        return false
      }
      // A computed field cited must exist first: fields are created in their order.
      if (TEMPLATE_COMPUTED_KINDS.has(target.kind) && !declared.has(labelKey(cited))) {
        c.say(`${path}.formula`, `« ${cited} » est calculé : déclarez-le avant cette formule`)
        return false
      }
    }
  }
  if (field.rollup !== undefined) {
    const { via, table, target } = field.rollup
    let reached: Known | undefined
    if (table === undefined) {
      const link = lookup(via)?.link
      if (link === undefined) {
        c.say(`${path}.rollup.via`, `« ${via} » n’est pas une relation de cette table`)
        return false
      }
      reached = known.get(link.to)
    } else {
      const link = links.find(
        (l) => l.from === table && labelKey(l.label) === labelKey(via) && l.to === tableKey,
      )
      if (link === undefined) {
        c.say(`${path}.rollup.via`, `aucune relation « ${via} » de « ${table} » vers cette table`)
        return false
      }
      reached = known.get(table)
    }
    if (target !== undefined && reached?.fields.get(labelKey(target)) === undefined) {
      c.say(`${path}.rollup.target`, `champ « ${target} » inconnu dans « ${reached?.table.label} »`)
      return false
    }
  }
  if (field.ai !== undefined) {
    for (const cited of citedInText(field.ai.prompt)) {
      if (lookup(cited) === undefined || labelKey(cited) === labelKey(field.label)) {
        c.say(`${path}.ai.prompt`, `champ « ${cited} » inconnu`)
        return false
      }
    }
  }
  if (field.button !== undefined) {
    if (field.button.url !== undefined) {
      for (const cited of citedInText(field.button.url)) {
        if (lookup(cited) === undefined) {
          c.say(`${path}.button.url`, `champ « ${cited} » inconnu`)
          return false
        }
      }
    }
    if (field.button.automation !== undefined && !automations.has(field.button.automation)) {
      c.say(`${path}.button.automation`, `automatisation « ${field.button.automation} » inconnue`)
      return false
    }
  }
  return true
}

function checkRow(
  c: Checker,
  rr: unknown,
  path: string,
  self: Known,
  keys: Set<string>,
): TemplateRow | null {
  if (!isRecord(rr)) {
    c.say(path, 'objet attendu')
    return null
  }
  const row: Record<string, TemplateValue> = {}
  for (const [label, value] of Object.entries(rr)) {
    if (label === '$key') {
      if (typeof value !== 'string' || !ROW_KEY.test(value) || keys.has(value)) {
        c.say(`${path}.$key`, 'clé de ligne invalide ou en double')
        continue
      }
      keys.add(value)
      row.$key = value
      continue
    }
    if (value === null || value === undefined || value === '') continue
    const field = self.fields.get(labelKey(label))
    if (field === undefined) {
      c.say(`${path}.${label}`, `champ inconnu dans « ${self.table.label} »`)
      continue
    }
    if (TEMPLATE_COMPUTED_KINDS.has(field.kind)) {
      c.say(`${path}.${label}`, 'champ calculé : il ne reçoit pas de valeur')
      continue
    }
    const checked = checkValue(c, value, field, `${path}.${label}`)
    if (checked !== undefined) row[field.label] = checked
  }
  if (Object.keys(row).filter((k) => k !== '$key').length === 0) {
    c.say(path, 'ligne vide')
    return null
  }
  return row as TemplateRow
}

function checkValue(
  c: Checker,
  value: unknown,
  field: { kind: string; options?: readonly TemplateOption[]; link?: TemplateLink },
  path: string,
): TemplateValue | undefined {
  const bad = (message: string) => {
    c.say(path, message)
    return undefined
  }
  const repairText = (v: unknown) =>
    c.repair && (typeof v === 'number' || typeof v === 'boolean') ? String(v) : v
  switch (field.kind) {
    case 'short_text':
    case 'long_text':
    case 'url':
    case 'email': {
      const v = repairText(value)
      if (typeof v !== 'string') return bad('texte attendu')
      if (v.length > TEMPLATE_LIMITS.text) return bad(`${TEMPLATE_LIMITS.text} caractères au plus`)
      if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+$/.test(v))
        return bad('adresse e-mail invalide')
      if (field.kind === 'url' && !/^https?:\/\//i.test(v)) return bad('adresse http(s) attendue')
      return v
    }
    case 'number': {
      const v =
        c.repair && typeof value === 'string' && /^-?\d+([.,]\d+)?$/.test(value.trim())
          ? Number(value.trim().replace(',', '.'))
          : value
      if (typeof v !== 'number' || !Number.isFinite(v)) return bad('nombre attendu')
      return v
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value
      if (c.repair && typeof value === 'string') {
        const folded = labelKey(value)
        if (['true', 'oui', 'vrai', 'yes'].includes(folded)) return true
        if (['false', 'non', 'faux', 'no'].includes(folded)) return false
      }
      return bad('vrai ou faux attendu')
    }
    case 'date':
    case 'datetime': {
      if (
        typeof value !== 'string' ||
        resolveTemplateDate(value, field.kind, new Date()) === null
      ) {
        return bad('date attendue : 2026-10-01, today, +3d, -2w…')
      }
      return value
    }
    case 'select': {
      const v = c.repair && Array.isArray(value) ? value[0] : value
      const option = typeof v === 'string' ? findOption(field.options, v) : undefined
      if (option === undefined) return bad(`choix « ${String(v)} » inconnu`)
      return option.label
    }
    case 'multi_select': {
      const list = Array.isArray(value)
        ? value
        : c.repair && typeof value === 'string'
          ? [value]
          : null
      if (list === null) return bad('liste de choix attendue')
      const labels: string[] = []
      for (const v of list) {
        const option = typeof v === 'string' ? findOption(field.options, v) : undefined
        if (option === undefined) c.say(path, `choix « ${String(v)} » inconnu`)
        else if (!labels.includes(option.label)) labels.push(option.label)
      }
      if (labels.length === 0) return undefined
      return labels
    }
    case 'user':
      return value === '$moi' ? '$moi' : bad('« $moi » seulement : un modèle ne connaît personne')
    case 'link':
    case 'multi_link': {
      const list = Array.isArray(value) ? value : [value]
      if (!list.every((v) => typeof v === 'string' && v.startsWith('@')))
        return bad('« @clé » d’une ligne attendue')
      if (field.kind === 'link' && list.length > 1) {
        if (!c.repair) return bad('une seule ligne pour cette relation')
        return list[0] as string
      }
      return field.kind === 'link' ? (list[0] as string) : (list as string[])
    }
    default:
      return bad('ce champ ne reçoit pas de valeur')
  }
}

function findOption(
  options: readonly TemplateOption[] | undefined,
  v: string,
): TemplateOption | undefined {
  return (
    options?.find((o) => labelKey(o.label) === labelKey(v)) ?? options?.find((o) => o.value === v)
  )
}

/** Checks a filter's citations against a table. */
function checkFilter(c: Checker, filter: string, path: string, self: Known): boolean {
  const unknown = citedLabels(filter).filter(
    (label) => self.fields.get(labelKey(label)) === undefined,
  )
  if (unknown.length > 0) {
    c.say(
      path,
      `champ${unknown.length > 1 ? 's' : ''} ${unknown.map((u) => `« ${u} »`).join(', ')} inconnu${unknown.length > 1 ? 's' : ''}`,
    )
    return false
  }
  return true
}

function checkView(
  c: Checker,
  rv: unknown,
  path: string,
  known: ReadonlyMap<string, Known>,
  views: readonly TemplateView[],
): TemplateView | null {
  if (!isRecord(rv)) {
    c.say(path, 'objet attendu')
    return null
  }
  const tableKey = c.text(rv, 'table', path, 64, true)
  const label = c.text(rv, 'label', path, TEMPLATE_LIMITS.label, true)
  const kind = rv.kind
  if (tableKey === null || label === null) return null
  const self = known.get(tableKey)
  if (self === undefined) {
    c.say(`${path}.table`, `table « ${tableKey} » inconnue`)
    return null
  }
  if (typeof kind !== 'string' || !(TEMPLATE_VIEW_KINDS as readonly string[]).includes(kind)) {
    c.say(`${path}.kind`, `sorte de vue « ${String(kind)} » inconnue`)
    return null
  }
  if (views.some((v) => v.table === tableKey && labelKey(v.label) === labelKey(label))) {
    c.say(path, `vue « ${label} » en double`)
    return null
  }
  const keys = VIEW_FIELD_KEYS[kind as TemplateViewKind]
  const rawSpec = isRecord(rv.spec) ? rv.spec : {}
  const spec: Record<string, unknown> = {}
  let broken = false
  const field = (label: unknown, where: string) => {
    if (typeof label !== 'string') {
      c.say(where, 'libellé de champ attendu')
      broken = true
      return undefined
    }
    const found = self.fields.get(labelKey(label))
    if (found === undefined) {
      c.say(where, `champ « ${label} » inconnu`)
      broken = true
      return undefined
    }
    return found
  }
  for (const [key, value] of Object.entries(rawSpec)) {
    const where = `${path}.spec.${key}`
    if (value === null) continue
    if (keys.one.includes(key)) {
      const found = field(value, where)
      if (found !== undefined) spec[key] = found.label
    } else if (keys.many.includes(key)) {
      if (!Array.isArray(value)) {
        c.say(where, 'liste de libellés attendue')
        broken = true
        continue
      }
      spec[key] = value
        .map((v, i) => field(v, `${where}[${i}]`)?.label)
        .filter((v) => v !== undefined)
    } else if (keys.other.includes(key)) {
      spec[key] = value
    } else {
      c.say(where, 'clé inconnue pour cette sorte de vue')
      broken = true
    }
  }
  if (
    typeof spec.filter === 'string' &&
    !checkFilter(c, spec.filter, `${path}.spec.filter`, self)
  ) {
    broken = true
    Reflect.deleteProperty(spec, 'filter')
  }
  if (spec.sorts !== undefined) {
    const sorts = Array.isArray(spec.sorts) ? spec.sorts : []
    spec.sorts = sorts.flatMap((s, i) => {
      const found = isRecord(s) ? field(s.field, `${path}.spec.sorts[${i}]`) : undefined
      return found === undefined
        ? []
        : [
            {
              field: found.label,
              direction: isRecord(s) && s.direction === 'desc' ? 'desc' : 'asc',
            },
          ]
    })
  }
  if (spec.summaries !== undefined) {
    const summaries: Record<string, string> = {}
    for (const [label, fn] of Object.entries(isRecord(spec.summaries) ? spec.summaries : {})) {
      const found = field(label, `${path}.spec.summaries`)
      if (found === undefined || typeof fn !== 'string') continue
      if (!summariesFor(found.kind).includes(fn)) {
        c.say(`${path}.spec.summaries`, `« ${found.label} » ne se résume pas par « ${fn} »`)
        broken = true
        continue
      }
      summaries[found.label] = fn
    }
    spec.summaries = summaries
  }
  // Each key's field of the kind the view expects; a « Dépend de » of the table itself.
  for (const [key, kinds] of Object.entries(VIEW_KEY_KINDS[kind as TemplateViewKind] ?? {})) {
    const value = spec[key]
    if (typeof value !== 'string') continue
    const found = self.fields.get(labelKey(value))
    const selfLink = key !== 'depends_on' || found?.link?.to === tableKey
    if (found !== undefined && (!kinds.includes(found.kind) || !selfLink)) {
      c.say(
        `${path}.spec.${key}`,
        key === 'depends_on' && kinds.includes(found.kind)
          ? `« ${found.label} » n’est pas une relation de la table à elle-même`
          : `« ${found.label} » n’a pas le type qu’attend la vue`,
      )
      broken = true
      Reflect.deleteProperty(spec, key)
    }
  }
  if (spec.end_field !== undefined && spec.end_field === (spec.start_field ?? spec.date_field)) {
    c.say(`${path}.spec.end_field`, 'la fin et le début sont le même champ')
    broken = true
    Reflect.deleteProperty(spec, 'end_field')
  }
  if (spec.color_rules !== undefined) {
    const rules = Array.isArray(spec.color_rules) ? spec.color_rules : []
    spec.color_rules = rules.filter(
      (r, i) =>
        isRecord(r) &&
        typeof r.filter === 'string' &&
        typeof r.color === 'string' &&
        checkFilter(c, r.filter, `${path}.spec.color_rules[${i}]`, self),
    )
  }
  if (spec.group_order !== undefined) {
    const group =
      typeof spec.group_by === 'string' ? self.fields.get(labelKey(spec.group_by)) : undefined
    const order = Array.isArray(spec.group_order) ? spec.group_order : []
    spec.group_order = order
      .map((v) => (typeof v === 'string' ? findOption(group?.options, v)?.label : undefined))
      .filter((v) => v !== undefined)
  }
  if (kind === 'form') {
    const questions = Array.isArray(rawSpec.fields) ? rawSpec.fields : []
    spec.fields = questions.flatMap((q, i) => {
      const entry = typeof q === 'string' ? { field: q } : isRecord(q) ? q : null
      const found = entry === null ? undefined : field(entry.field, `${path}.spec.fields[${i}]`)
      if (entry === null || found === undefined) return []
      if (!TEMPLATE_FORM_KINDS.has(found.kind) || found.ai) {
        c.say(`${path}.spec.fields[${i}]`, `« ${found.label} » ne se pose pas dans un formulaire`)
        broken = true
        return []
      }
      return [
        {
          field: found.label,
          required: entry.required === true,
          ...(typeof entry.label === 'string' ? { label: entry.label } : {}),
          ...(typeof entry.help === 'string' ? { help: entry.help } : {}),
        },
      ]
    })
    if ((spec.fields as unknown[]).length === 0) {
      c.say(`${path}.spec.fields`, 'un formulaire pose au moins une question')
      return null
    }
  }
  if (kind === 'kanban' && spec.group_by === undefined) {
    const firstChoice = [...self.fields.values()].find((f) => f.kind === 'select')
    if (firstChoice === undefined) {
      c.say(`${path}.spec.group_by`, 'un kanban se groupe par une liste de choix')
      return null
    }
    spec.group_by = firstChoice.label
  }
  if (kind === 'calendar' && spec.date_field === undefined) {
    const firstDate = [...self.fields.values()].find(
      (f) => f.kind === 'date' || f.kind === 'datetime',
    )
    if (firstDate === undefined) {
      c.say(`${path}.spec.date_field`, 'un calendrier demande une date')
      return null
    }
    spec.date_field = firstDate.label
  }
  if (kind === 'timeline' && spec.start_field === undefined) {
    const dates = [...self.fields.values()].filter((f) => DATES.includes(f.kind))
    if (dates[0] === undefined) {
      c.say(`${path}.spec.start_field`, 'une chronologie demande une date de début')
      return null
    }
    spec.start_field = dates[0].label
    if (spec.end_field === undefined && dates[1] !== undefined) spec.end_field = dates[1].label
  }
  if (broken && !c.repair) return null
  const description = c.text(rv, 'description', path, TEMPLATE_LIMITS.description)
  return {
    table: tableKey,
    label,
    kind: kind as TemplateViewKind,
    ...(description === undefined ? {} : { description }),
    spec,
  }
}

function checkDashboard(
  c: Checker,
  rd: unknown,
  path: string,
  known: ReadonlyMap<string, Known>,
): TemplateDashboard | null {
  if (!isRecord(rd)) {
    c.say(path, 'objet attendu')
    return null
  }
  const label = c.text(rd, 'label', path, TEMPLATE_LIMITS.label, true)
  if (label === null) return null
  const blocks: TemplateBlock[] = []
  c.list(rd, 'blocks', path, TEMPLATE_LIMITS.blocks).forEach((rb, bi) => {
    const where = `${path}.blocks[${bi}]`
    if (!isRecord(rb)) {
      c.say(where, 'objet attendu')
      return
    }
    const title = c.text(rb, 'title', where, TEMPLATE_LIMITS.label) ?? ''
    const width = typeof rb.width === 'number' && [1, 2, 3].includes(rb.width) ? rb.width : 1
    if (rb.kind === 'text') {
      blocks.push({
        kind: 'text',
        title,
        width,
        body: c.text(rb, 'body', where, TEMPLATE_LIMITS.text) ?? '',
      })
      return
    }
    if (rb.kind === 'embed') {
      c.say(where, 'un modèle ne porte pas de page extérieure')
      return
    }
    const tableKey = c.text(rb, 'table', where, 64, true)
    const self = tableKey === null ? undefined : known.get(tableKey)
    if (tableKey === null || self === undefined) {
      if (tableKey !== null) c.say(`${where}.table`, `table « ${tableKey} » inconnue`)
      return
    }
    const fieldOf = (label: unknown, at: string) => {
      const found = typeof label === 'string' ? self.fields.get(labelKey(label)) : undefined
      if (found === undefined) c.say(at, `champ « ${String(label)} » inconnu`)
      return found
    }
    const filter = typeof rb.filter === 'string' ? rb.filter : ''
    if (filter !== '' && !checkFilter(c, filter, `${where}.filter`, self)) return
    if (rb.kind === 'number') {
      const aggregate = (AGGREGATES as readonly string[]).includes(String(rb.aggregate))
        ? (rb.aggregate as Aggregate)
        : 'count'
      const field = aggregate === 'count' ? undefined : fieldOf(rb.field, `${where}.field`)
      if (aggregate !== 'count' && field === undefined) return
      if (field !== undefined && !summariesFor(field.kind).includes(aggregate)) {
        c.say(`${where}.field`, `« ${field.label} » ne se calcule pas par « ${aggregate} »`)
        return
      }
      blocks.push({
        kind: 'number',
        title,
        width,
        table: tableKey,
        aggregate,
        field: field?.label ?? null,
        filter,
      })
    } else if (rb.kind === 'chart') {
      const group = fieldOf(rb.group_by, `${where}.group_by`)
      if (group === undefined) return
      if (!GROUPABLE.includes(group.kind)) {
        c.say(`${where}.group_by`, `« ${group.label} » ne se groupe pas`)
        return
      }
      blocks.push({
        kind: 'chart',
        title,
        width,
        table: tableKey,
        group_by: group.label,
        filter,
        style: rb.style === 'pie' ? 'pie' : 'bar',
      })
    } else if (rb.kind === 'list') {
      const fields = (Array.isArray(rb.fields) ? rb.fields : [])
        .map((f, i) => fieldOf(f, `${where}.fields[${i}]`)?.label)
        .filter((f): f is string => f !== undefined)
      let sort = typeof rb.sort === 'string' ? rb.sort.trim() : ''
      if (sort !== '') {
        const descending = sort.startsWith('-')
        const found = fieldOf(descending ? sort.slice(1) : sort, `${where}.sort`)
        sort = found === undefined ? '' : `${descending ? '-' : ''}${found.label}`
      }
      const limit =
        typeof rb.limit === 'number' && Number.isInteger(rb.limit)
          ? Math.min(Math.max(rb.limit, 1), 50)
          : 5
      blocks.push({ kind: 'list', title, width, table: tableKey, fields, filter, sort, limit })
    } else {
      c.say(`${where}.kind`, `bloc « ${String(rb.kind)} » inconnu`)
    }
  })
  if (blocks.length === 0) {
    c.say(`${path}.blocks`, 'au moins un bloc')
    return null
  }
  const description = c.text(rd, 'description', path, TEMPLATE_LIMITS.description)
  return { label, ...(description === undefined ? {} : { description }), blocks }
}

function checkAutomation(
  c: Checker,
  ra: unknown,
  path: string,
  known: ReadonlyMap<string, Known>,
): TemplateAutomation | null {
  if (!isRecord(ra)) {
    c.say(path, 'objet attendu')
    return null
  }
  const label = c.text(ra, 'label', path, TEMPLATE_LIMITS.label, true)
  const rt = isRecord(ra.trigger) ? ra.trigger : null
  if (label === null) return null
  if (rt === null) {
    c.say(`${path}.trigger`, 'déclencheur obligatoire')
    return null
  }
  const kind = rt.kind
  if (
    kind !== 'record_created' &&
    kind !== 'record_updated' &&
    kind !== 'schedule' &&
    kind !== 'button'
  ) {
    c.say(`${path}.trigger.kind`, `déclencheur « ${String(kind)} » inconnu`)
    return null
  }
  const tableKey = kind === 'schedule' ? null : c.text(rt, 'table', `${path}.trigger`, 64, true)
  const self = tableKey === null ? undefined : known.get(tableKey)
  if (kind !== 'schedule' && self === undefined) {
    if (tableKey !== null) c.say(`${path}.trigger.table`, `table « ${tableKey} » inconnue`)
    return null
  }
  const fieldOf = (table: Known | undefined, label: unknown, at: string) => {
    const found = typeof label === 'string' ? table?.fields.get(labelKey(label)) : undefined
    if (found === undefined) c.say(at, `champ « ${String(label)} » inconnu`)
    return found
  }
  const fields =
    kind === 'record_updated'
      ? (Array.isArray(rt.fields) ? rt.fields : [])
          .map((f, i) => fieldOf(self, f, `${path}.trigger.fields[${i}]`)?.label)
          .filter((f): f is string => f !== undefined)
      : []
  let schedule: TemplateAutomation['trigger']['schedule'] = null
  if (kind === 'schedule') {
    const rs = isRecord(rt.schedule) ? rt.schedule : {}
    const every = rs.every === 'hour' || rs.every === 'week' ? rs.every : 'day'
    const at = typeof rs.at === 'string' && /^\d{2}:\d{2}$/.test(rs.at) ? rs.at : '09:00'
    const weekday =
      typeof rs.weekday === 'number' &&
      Number.isInteger(rs.weekday) &&
      rs.weekday >= 0 &&
      rs.weekday <= 6
        ? rs.weekday
        : 1
    const timezone = typeof rs.timezone === 'string' ? rs.timezone : 'Europe/Paris'
    schedule = { every, at, weekday, timezone }
  }
  const condition = kind === 'schedule' ? '' : (c.text(ra, 'condition', path, 2000) ?? '')
  if (
    condition !== '' &&
    self !== undefined &&
    !checkFilter(c, condition, `${path}.condition`, self)
  )
    return null

  const actions: TemplateAction[] = []
  const valuesOf = (raw: unknown, table: Known | undefined, at: string) => {
    const out: Record<string, string | number | boolean> = {}
    for (const [label, value] of Object.entries(isRecord(raw) ? raw : {})) {
      const found = fieldOf(table, label, `${at}.${label}`)
      if (found === undefined) continue
      if (TEMPLATE_COMPUTED_KINDS.has(found.kind) || found.ai) {
        c.say(`${at}.${label}`, 'champ calculé : il ne reçoit pas de valeur')
        continue
      }
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
        continue
      if (typeof value === 'string') {
        const unknown = citedInText(value).filter(
          (l) => self?.fields.get(labelKey(l)) === undefined,
        )
        if (unknown.length > 0) {
          c.say(`${at}.${label}`, `champ « ${unknown[0]} » inconnu`)
          continue
        }
      }
      out[found.label] =
        typeof value === 'string' && found.options !== undefined
          ? (findOption(found.options, value)?.label ?? value)
          : value
    }
    return out
  }
  c.list(ra, 'actions', path, TEMPLATE_LIMITS.actions).forEach((rx, xi) => {
    const at = `${path}.actions[${xi}]`
    if (!isRecord(rx)) return
    if (rx.kind === 'webhook' || rx.kind === 'slack') {
      c.say(at, 'un modèle n’appelle pas l’extérieur : action retirée')
      return
    }
    if (rx.kind === 'update_record') {
      if (kind === 'schedule') {
        c.say(at, 'une automatisation à heure fixe n’a pas de ligne à modifier')
        return
      }
      const values = valuesOf(rx.values, self, `${at}.values`)
      if (Object.keys(values).length > 0) actions.push({ kind: 'update_record', values })
    } else if (rx.kind === 'create_record') {
      const target = typeof rx.table === 'string' ? known.get(rx.table) : undefined
      if (target === undefined) {
        c.say(`${at}.table`, `table « ${String(rx.table)} » inconnue`)
        return
      }
      actions.push({
        kind: 'create_record',
        table: rx.table as string,
        values: valuesOf(rx.values, target, `${at}.values`),
      })
    } else if (rx.kind === 'notify') {
      const users = (Array.isArray(rx.users) ? rx.users : []).filter(
        (u) => u === '$moi',
      ) as string[]
      const userField =
        rx.user_field === undefined || rx.user_field === null
          ? null
          : fieldOf(self, rx.user_field, `${at}.user_field`)
      if (userField !== null && userField?.kind !== 'user') {
        c.say(`${at}.user_field`, 'un champ personne est attendu')
        return
      }
      const message = typeof rx.message === 'string' ? rx.message.slice(0, 2000) : ''
      if (users.length === 0 && userField === null) {
        c.say(at, 'personne à prévenir : « $moi » ou un champ personne')
        return
      }
      actions.push({ kind: 'notify', users, user_field: userField?.label ?? null, message })
    } else {
      c.say(`${at}.kind`, `action « ${String(rx.kind)} » inconnue`)
    }
  })
  if (actions.length === 0) {
    c.say(`${path}.actions`, 'au moins une action')
    return null
  }
  const key = typeof ra.key === 'string' && KEY.test(ra.key) ? ra.key : undefined
  const description = c.text(ra, 'description', path, TEMPLATE_LIMITS.description)
  return {
    ...(key === undefined ? {} : { key }),
    label,
    ...(description === undefined ? {} : { description }),
    enabled: ra.enabled !== false,
    trigger: { kind, table: tableKey, fields, schedule },
    condition,
    actions,
  }
}

/** A template as a gallery card shows it. */
export function summarizeTemplate(template: Template): TemplateSummary {
  const fields = template.tables.reduce((n, t) => n + t.fields.length, 0) + template.links.length
  return {
    key: template.key,
    label: template.label,
    summary: template.summary,
    category: template.category ?? null,
    icon: template.icon ?? null,
    color: template.color ?? null,
    tags: template.tags,
    counts: {
      tables: template.tables.length,
      fields,
      rows: Object.values(template.rows).reduce((n, rows) => n + rows.length, 0),
      views: template.views.length,
      dashboards: template.dashboards.length,
      automations: template.automations.length,
      ai_fields: template.tables.reduce(
        (n, t) => n + t.fields.filter((f) => f.ai !== undefined).length,
        0,
      ),
    },
  }
}
