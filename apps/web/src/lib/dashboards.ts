import type { Aggregates, DashboardBlock, DescribedBase, Field } from '@/lib/api/client'

/**
 * Dashboard blocks as the screen reads them — chapter 18: what a number says, how a chart
 * cuts its slices, what a new block starts with. Pure, to be tested.
 */

const PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
  '#64748b',
]

/** A new block of a kind, preset on the base's first table. */
export function emptyBlock(kind: DashboardBlock['kind'], base: DescribedBase): DashboardBlock {
  const table = base.tables[0]
  const id = table?.id ?? ''
  const first = table?.fields.find((f) => f.system !== true)?.name ?? ''
  switch (kind) {
    case 'number':
      return { kind, width: 1, title: '', table: id, aggregate: 'count', field: null, filter: '' }
    case 'chart': {
      const group = table?.fields.find((f) => f.kind === 'select')?.name ?? first
      return { kind, width: 1, title: '', table: id, group_by: group, filter: '', style: 'bar' }
    }
    case 'list':
      return {
        kind,
        width: 2,
        title: '',
        table: id,
        fields: first === '' ? [] : [first],
        filter: '',
        sort: '',
        limit: 10,
      }
    case 'text':
      return { kind, width: 1, title: '', body: '' }
    case 'embed':
      return { kind, width: 3, title: '', url: 'https://', height: 400 }
  }
}

const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

/** What a number block says: a count, or its aggregate as the field reads. */
export function numberText(
  block: Extract<DashboardBlock, { kind: 'number' }>,
  data: Aggregates,
  field: Field | undefined,
): string {
  if (block.aggregate === 'count' || block.field === null) return NUMBER.format(data.total)
  const raw = data.values[`${block.field}:${block.aggregate}`]
  if (raw === null || raw === undefined || raw === '') return '—'
  if (field?.kind === 'date' || field?.kind === 'datetime') {
    const date = new Date(String(raw))
    return Number.isNaN(date.getTime()) ? String(raw) : DATE.format(date)
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) return String(raw)
  if (field?.format?.display === 'currency') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: field.format.currency ?? 'EUR',
      maximumFractionDigits: 2,
    }).format(n)
  }
  if (field?.format?.display === 'percent') return `${NUMBER.format(n * 100)} %`
  return NUMBER.format(n)
}

export interface Slice {
  readonly label: string
  readonly count: number
  readonly color: string
}

/**
 * The slices of a chart: a label and a colour per value — a choice's own, a person's name —
 * the largest first, past eight gathered as « Autres ».
 */
export function chartSlices(
  groups: ReadonlyArray<{ readonly value: unknown; readonly count: number }>,
  field: Field | undefined,
  nameOf: (id: string) => string,
): Slice[] {
  const labelled = groups.map((g, index) => {
    const value = g.value
    let label: string
    let color: string | null = null
    if (value === null || value === undefined || value === '') label = 'Sans valeur'
    else if (field?.kind === 'select') {
      const option = field.options?.find((o) => o.value === value)
      label = option?.label ?? String(value)
      color = option?.color ?? null
    } else if (field?.kind === 'user') label = nameOf(String(value))
    else if (field?.kind === 'boolean') label = value === true ? 'Oui' : 'Non'
    else if (typeof value === 'object') {
      label = String((value as { display?: unknown }).display ?? JSON.stringify(value))
    } else label = String(value)
    return { label, count: g.count, color, index }
  })
  labelled.sort((a, b) => b.count - a.count)
  const head = labelled.slice(0, 8)
  const rest = labelled.slice(8)
  const slices: Slice[] = head.map((s, i) => ({
    label: s.label,
    count: s.count,
    color: s.color ?? PALETTE[i % PALETTE.length] ?? '#64748b',
  }))
  if (rest.length > 0) {
    slices.push({
      label: 'Autres',
      count: rest.reduce((sum, s) => sum + s.count, 0),
      color: '#94a3b8',
    })
  }
  return slices
}
