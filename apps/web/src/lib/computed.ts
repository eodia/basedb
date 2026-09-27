import { $t } from '@/lib/i18n'
import type { Field, Table } from './api/client'

/**
 * Computed fields on screen — chapter 04 §7, §7 ter, chapter 11 §3.
 *
 * A formula, a lookup, a rollup or a count is shown as the field its VALUE is: a rollup
 * of amounts reads as an amount, with the currency of the amounts it sums; a lookup of a
 * list of choices shows the choices' chips; a formula whose result is a date, a date. The
 * value field is built here once, from the table the path reaches, and every view — the
 * grid, the panel, the cards — draws it with the widgets it already has, read-only.
 */

/** The kinds a formula, a lookup, a rollup or a count may be. */
export const COMPUTED_KINDS: ReadonlySet<string> = new Set(['formula', 'lookup', 'rollup', 'count'])

/**
 * The field a computed field's value reads as: the kind of its result, with the format
 * and the choices of the field it cites when it cites one. Read-only, always.
 */
export function valueFieldOf(field: Field, tables: readonly Table[]): Field {
  const computed = field.computed
  if (computed === undefined) return field
  const reached =
    computed.via === undefined ? undefined : tables.find((t) => t.name === computed.via?.reached)
  const cited =
    computed.target === undefined || computed.target === null
      ? undefined
      : reached?.fields.find((f) => f.name === computed.target)
  // What the cited field's own value reads as — a formula cited by a lookup reads as its
  // result.
  const citedValue = cited?.computed === undefined ? cited : valueFieldOf(cited, tables)

  const base: Field = {
    name: field.name,
    label: field.label,
    description: field.description,
    kind: computed.result_kind,
    read_only: true,
  }
  if (field.kind === 'lookup' || (field.kind === 'rollup' && computed.aggregate !== 'count')) {
    // A lookup is the cited field's value; a sum, a mean, a bound keep its format too — a
    // total of amounts is an amount.
    return {
      ...base,
      ...(citedValue?.options === undefined ? {} : { options: citedValue.options }),
      ...(citedValue?.format === undefined ? {} : { format: citedValue.format }),
    }
  }
  return base
}

/** The fields of a table, each computed one carrying the field its value reads as. */
export function withValueFields(fields: readonly Field[], tables: readonly Table[]): Field[] {
  return fields.map((f) =>
    f.computed === undefined ? f : { ...f, valueField: valueFieldOf(f, tables) },
  )
}

/** What a cell draws for a field: a computed one as its value, read-only. */
export function shownField(field: Field): Field {
  if (field.computed === undefined) return field
  return { ...(field.valueField ?? valueFieldOf(field, [])), name: field.name, read_only: true }
}

/** The name of an aggregation, as the rollup dialog and the header's tooltip say it. */
export const AGGREGATE_NAMES: Readonly<Record<string, string>> = {
  count: $t('Nombre de valeurs'),
  sum: $t('Somme'),
  avg: $t('Moyenne'),
  min: $t('Minimum'),
  max: $t('Maximum'),
}

/** One sentence on what a computed field reads — the header's tooltip, the structure list. */
export function describeComputed(field: Field, tables: readonly Table[]): string | null {
  const computed = field.computed
  if (computed === undefined) return null
  if (computed.expression !== undefined) {
    return computed.stored
      ? `= ${computed.expression}`
      : $t('= {expression} (calculée à chaque lecture)', { expression: computed.expression })
  }
  const via = computed.via
  if (via === undefined) return null
  const reached = tables.find((t) => t.name === via.reached)
  const holder = tables.find((t) => t.name === via.table)
  const relation = holder?.fields.find((f) => f.name === via.field)?.label ?? via.field
  const path =
    via.direction === 'outgoing'
      ? $t('par « {relation} »', { relation })
      : $t('lignes de « {value} » liées par « {relation} »', {
          value: holder?.label ?? via.table,
          relation,
        })
  const cited =
    computed.target === undefined || computed.target === null
      ? null
      : (reached?.fields.find((f) => f.name === computed.target)?.label ?? computed.target)
  switch (field.kind) {
    case 'lookup':
      return `« ${cited ?? '?'} » — ${path}`
    case 'rollup':
      return $t('{value} de « {value2} » — {path}', {
        value: AGGREGATE_NAMES[computed.aggregate ?? 'count'] ?? '',
        value2: cited ?? '?',
        path,
      })
    case 'count':
      return $t('Nombre de lignes — {path}', { path })
    default:
      return null
  }
}

/**
 * The kind a field is summarised, grouped and filtered as: a computed one's value, a list
 * as `lookup` — the same rule as the kernel's (`meta.ts`, `effectiveKind`).
 */
export function effectiveKind(field: Field): string {
  if (field.computed === undefined) return field.kind
  return field.computed.multiple ? 'lookup' : field.computed.result_kind
}
