import type { ProjectedField } from '../catalog/projection.js'
import type { CalendarEvent, CalendarMoment } from '../integrations/ical.js'

/**
 * The events of a shared calendar or timeline — chapter 19 §2.1: each row of the view an
 * event, its title the view's title field, its dates the view's pivots, its description the
 * fields its cards show. Pure: the rows are read by the caller, on the publisher's
 * authority, exactly as the page reads them.
 */

export const CALENDAR_MAX_EVENTS = 1000

/** A value as an agenda's description reads it. */
function textOf(value: unknown, field: ProjectedField): string {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value))
    return value
      .map((v) => textOf(v, field))
      .filter((v) => v !== '')
      .join(', ')
  if (typeof value === 'object') {
    const named = value as { display?: unknown; name?: unknown }
    return String(named.display ?? named.name ?? '')
  }
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  const option = field.options?.find((o) => o.value === value)
  return option?.label ?? String(value)
}

function momentOf(value: unknown, field: ProjectedField | undefined): CalendarMoment | null {
  if (typeof value !== 'string' || value === '' || field === undefined) return null
  if (field.kind === 'date') return { date: value.slice(0, 10) }
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : { instant: at.toISOString() }
}

export function calendarEvents(
  kind: string,
  spec: Readonly<Record<string, unknown>>,
  fields: readonly ProjectedField[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  host: string,
): CalendarEvent[] {
  const byName = new Map(fields.map((f) => [f.name, f]))
  const pick = (key: string) =>
    typeof spec[key] === 'string' ? byName.get(spec[key] as string) : undefined
  const start = pick(kind === 'timeline' ? 'start_field' : 'date_field')
  const end = pick('end_field')
  // The view's title, else the first text it shows — never a date standing for a title.
  const title =
    pick('title_field') ??
    fields.find((f) => ['short_text', 'long_text', 'email', 'url'].includes(f.kind)) ??
    fields.find((f) => f !== start && f !== end)
  const shown = (Array.isArray(spec.card_fields) ? spec.card_fields : [])
    .map((n) => byName.get(String(n)))
    .filter((f): f is ProjectedField => f !== undefined)
  const events: CalendarEvent[] = []
  for (const row of rows) {
    const from = momentOf(row[start?.name ?? ''], start)
    if (from === null) continue
    events.push({
      uid: `${String(row._id)}@${host}`,
      summary: title === undefined ? 'Sans titre' : textOf(row[title.name], title) || 'Sans titre',
      description: shown
        .map((f) => {
          const text = textOf(row[f.name], f)
          return text === '' ? '' : `${f.label} : ${text}`
        })
        .filter((line) => line !== '')
        .join('\n'),
      start: from,
      end: momentOf(row[end?.name ?? ''], end),
    })
    if (events.length >= CALENDAR_MAX_EVENTS) break
  }
  return events
}
