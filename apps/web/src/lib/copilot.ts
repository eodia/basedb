import {
  type CopilotField,
  type DescribedBase,
  type Field,
  type FieldOptionInput,
  type Table,
  type TableRef,
  api,
} from '@/lib/api/client'
import { slugify } from '@/lib/options'
import { localTimezone } from '@/lib/schedule'

/**
 * Applying what the copilot proposed — chapter 12 §1.6.
 *
 * Every proposal is applied through the SAME routes a person would use by hand: a column
 * is `POST …/fields`, a row is `POST …/batch`. The copilot's answer is re-validated by the
 * kernel when it arrives; the routes re-check everything again when it is applied, under
 * the person's own rights. Nothing here trusts the proposal more than a form.
 */

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Choices as the API takes them: a value made from the label, the label kept. */
function optionInputs(labels: readonly string[]): FieldOptionInput[] {
  const seen = new Set<string>()
  return labels.map((label) => {
    let value = slugify(label) || 'choix'
    for (let n = 2; seen.has(value); n++) value = `${slugify(label)}_${n}`
    seen.add(value)
    return { value, label }
  })
}

/**
 * The fields of a new table that `POST …/tables` takes with it; the others — choices,
 * relations, fields computed by the AI — are added one by one afterwards, each by its own
 * route.
 */
const SIMPLE: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'url',
  'number',
  'boolean',
  'date',
  'datetime',
])

/** Adds proposed columns to a table. Stops at the first refusal, which it throws. */
export async function addFields(
  table: TableRef,
  fields: readonly CopilotField[],
  options: {
    /** The person's yes for an AI column's values leaving for the provider. */
    readonly aiConsent: boolean
    /** Physical names of tables proposed and created in this conversation, by label. */
    readonly created: ReadonlyMap<string, string>
  },
): Promise<void> {
  for (const field of fields) {
    const description = field.description ?? undefined
    if (field.kind === 'link') {
      const target = options.created.get(fold(field.target ?? '')) ?? field.target ?? ''
      await api.createLink(table, field.label, target, description)
    } else if (field.prompt !== null) {
      // A column the AI fills: its own type, and the option on top.
      await api.addField(table, {
        label: field.label,
        kind: field.kind,
        description,
        ...(field.options.length > 0 ? { options: optionInputs(field.options) } : {}),
        ai: {
          prompt: field.prompt ?? '',
          refresh: { mode: 'if_empty', timezone: localTimezone() },
          consent: options.aiConsent,
        },
      })
    } else {
      await api.addField(table, {
        label: field.label,
        kind: field.kind,
        description,
        ...(field.options.length > 0 ? { options: optionInputs(field.options) } : {}),
      })
    }
  }
}

/** Creates a table, then the columns it could not be created with. Returns its name. */
export async function createTable(
  base: string,
  proposal: {
    readonly label: string
    readonly description: string | null
    readonly fields: readonly CopilotField[]
  },
  options: { readonly aiConsent: boolean; readonly created: ReadonlyMap<string, string> },
): Promise<string> {
  const simple = proposal.fields.filter((f) => SIMPLE.has(f.kind) && f.prompt === null)
  const rest = proposal.fields.filter((f) => !SIMPLE.has(f.kind) || f.prompt !== null)
  const created = await api.createTable(
    base,
    proposal.label,
    simple.map((f) => ({
      label: f.label,
      kind: f.kind,
      ...(f.description === null ? {} : { description: f.description }),
    })),
    proposal.description ?? undefined,
  )
  await addFields({ base, name: created.name }, rest, options)
  return created.name
}

/** A value as the row takes it: a choice by its value, a link by its identifier. */
async function resolveValues(
  base: DescribedBase,
  table: Table,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  /** For a table proposed alongside: the keys are labels. */
  byLabel: boolean,
): Promise<Record<string, unknown>[]> {
  const fieldOf = (key: string): Field | undefined =>
    byLabel
      ? table.fields.find((f) => fold(f.label) === fold(key))
      : (table.fields.find((f) => f.name === key) ??
        table.fields.find((f) => fold(f.label) === fold(key)))

  // Link cells named by what the target row displays: one read per link column.
  const displays = new Map<string, Map<string, string>>()
  for (const field of table.fields.filter((f) => f.kind === 'link')) {
    const wanted = new Set<string>()
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (fieldOf(key)?.name !== field.name) continue
        if (typeof value === 'object' && value !== null && 'display' in value) {
          wanted.add(String((value as { display: unknown }).display))
        }
      }
    }
    if (wanted.size === 0) continue
    const targetName = field.link?.target
    const target = base.tables.find((t) => t.name === targetName)
    const display =
      target?.display_field ?? target?.fields.find((f) => f.kind === 'short_text')?.name
    if (target === undefined || display === undefined || display === null) {
      throw new Error(`Impossible de retrouver les lignes liées de « ${field.label} ».`)
    }
    const list = [...wanted].map((v) => JSON.stringify(v)).join(', ')
    const page = await api.list(
      { base: base.name, name: target.name },
      { filter: `${display} in [${list}]`, limit: 250 },
    )
    const found = new Map<string, string>()
    for (const row of page.data) {
      const shown = row[display]
      if (typeof shown === 'string' && !found.has(shown)) found.set(shown, String(row._id))
    }
    const missing = [...wanted].filter((w) => !found.has(w))
    if (missing.length > 0) {
      throw new Error(
        `« ${field.label} » : aucune ligne de ${target.label} ne s’appelle ${missing
          .slice(0, 3)
          .map((m) => `« ${m} »`)
          .join(', ')}.`,
      )
    }
    displays.set(field.name, found)
  }

  const choice = (field: Field, value: unknown) => {
    const text = String(value)
    return (
      field.options?.find((o) => o.value === text)?.value ??
      field.options?.find((o) => fold(o.label) === fold(text))?.value ??
      text
    )
  }

  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      const field = fieldOf(key)
      if (field === undefined) continue
      if (field.kind === 'link' && typeof value === 'object' && value !== null) {
        const link = value as { id?: string; display?: string }
        out[field.name] = link.id ?? displays.get(field.name)?.get(String(link.display)) ?? null
      } else if (field.kind === 'select' && value !== null) {
        out[field.name] = choice(field, value)
      } else if (field.kind === 'multi_select' && Array.isArray(value)) {
        out[field.name] = value.map((v) => choice(field, v))
      } else {
        out[field.name] = value
      }
    }
    return out
  })
}

/** Inserts proposed rows, all or nothing. */
export async function insertRecords(
  base: DescribedBase,
  proposal: {
    readonly table: string
    readonly pending: boolean
    readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>
  },
  created: ReadonlyMap<string, string>,
): Promise<number> {
  const name = proposal.pending ? created.get(fold(proposal.table)) : proposal.table
  const table =
    base.tables.find((t) => t.name === name) ??
    (proposal.pending ? base.tables.find((t) => fold(t.label) === fold(proposal.table)) : undefined)
  if (table === undefined) {
    throw new Error(
      proposal.pending
        ? `Créez d’abord la table « ${proposal.table} ».`
        : 'Cette table n’existe plus.',
    )
  }
  const rows = await resolveValues(base, table, proposal.records, proposal.pending)
  const result = await api.createRecords({ base: base.name, name: table.name }, rows)
  return result.summary.created
}

/** Changes proposed rows, one after the other. Returns how many were changed. */
export async function updateRecords(
  base: DescribedBase,
  proposal: {
    readonly table: string
    readonly updates: ReadonlyArray<{
      readonly id: string
      readonly values: Readonly<Record<string, unknown>>
    }>
  },
): Promise<number> {
  const table = base.tables.find((t) => t.name === proposal.table)
  if (table === undefined) throw new Error('Cette table n’existe plus.')
  const values = await resolveValues(
    base,
    table,
    proposal.updates.map((u) => u.values),
    false,
  )
  let done = 0
  for (const [i, update] of proposal.updates.entries()) {
    await api.updateRecord({ base: base.name, name: table.name }, update.id, values[i] ?? {})
    done++
  }
  return done
}
