import { utcOf } from '../automations/catalog.js'

/**
 * iCalendar (RFC 5545) — chapter 19 §2: the feed a shared calendar view publishes, and
 * the reading of an agenda a synced table imports. Only what an agenda needs: events with
 * a title, a start, an end, a place and a description.
 */

export type CalendarMoment =
  | { readonly date: string } // YYYY-MM-DD: a whole day
  | { readonly instant: string } // an ISO instant

export interface CalendarEvent {
  readonly uid: string
  readonly summary: string
  readonly description: string
  readonly start: CalendarMoment
  readonly end: CalendarMoment | null
}

/** Text as a property value holds it: backslash, semicolon, comma and newline escaped. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** A content line folded at 75 octets, as the format requires. */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const width = Buffer.byteLength(char, 'utf8')
    if (size + width > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += width
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (date: string) => date.replaceAll('-', '')
const compactInstant = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function momentLine(name: 'DTSTART' | 'DTEND', moment: CalendarMoment): string {
  return 'date' in moment
    ? `${name};VALUE=DATE:${compactDate(moment.date)}`
    : `${name}:${compactInstant(moment.instant)}`
}

/** A calendar of events, as an agenda subscribes to it. */
export function icsCalendar(
  name: string,
  events: readonly CalendarEvent[],
  now: Date = new Date(),
): string {
  const stamp = compactInstant(now.toISOString())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//basedb//vue partagee//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ]
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${escapeText(event.uid)}`, `DTSTAMP:${stamp}`)
    lines.push(momentLine('DTSTART', event.start))
    // A whole day ends the next day: the end of an all-day event is exclusive.
    if ('date' in event.start) {
      const last = event.end !== null && 'date' in event.end ? event.end.date : event.start.date
      lines.push(
        `DTEND;VALUE=DATE:${compactDate(nextDay(last < event.start.date ? event.start.date : last))}`,
      )
    } else if (event.end !== null) {
      lines.push(momentLine('DTEND', event.end))
    }
    lines.push(`SUMMARY:${escapeText(event.summary)}`)
    if (event.description !== '') lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

// ── Reading ──────────────────────────────────────────────────────────────────

export interface ParsedEvent {
  readonly uid: string
  readonly summary: string
  readonly description: string
  readonly location: string
  /** An ISO instant; a whole day starts at midnight UTC. */
  readonly start: string | null
  readonly end: string | null
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
}

/** A date or a date-time of the format, with its parameters, as an ISO instant. */
function instantOf(value: string, params: ReadonlyMap<string, string>): string | null {
  const day = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  if (day !== null) return `${day[1]}-${day[2]}-${day[3]}T00:00:00.000Z`
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value)
  if (time === null) return null
  const [, y, mo, d, h, mi, s, utc] = time as unknown as string[]
  const zone = params.get('TZID')
  if (utc === 'Z' || zone === undefined) {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString()
  }
  try {
    return new Date(utcOf(+y, +mo - 1, +d, +h, +mi, zone) + +s * 1000).toISOString()
  } catch {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString()
  }
}

/** The events of an agenda — anything else in it is ignored. */
export function parseIcs(text: string): ParsedEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const events: ParsedEvent[] = []
  let current: Record<string, { value: string; params: Map<string, string> }> | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current !== null) {
        const get = (key: string) => current?.[key]
        const start = get('DTSTART')
        const end = get('DTEND')
        events.push({
          uid: unescapeText(get('UID')?.value ?? ''),
          summary: unescapeText(get('SUMMARY')?.value ?? ''),
          description: unescapeText(get('DESCRIPTION')?.value ?? ''),
          location: unescapeText(get('LOCATION')?.value ?? ''),
          start: start === undefined ? null : instantOf(start.value, start.params),
          end: end === undefined ? null : instantOf(end.value, end.params),
        })
      }
      current = null
      continue
    }
    if (current === null) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const [name, ...rawParams] = line.slice(0, colon).split(';')
    const params = new Map<string, string>()
    for (const p of rawParams) {
      const eq = p.indexOf('=')
      if (eq > 0) params.set(p.slice(0, eq).toUpperCase(), p.slice(eq + 1).replace(/^"|"$/g, ''))
    }
    current[(name as string).toUpperCase()] = { value: line.slice(colon + 1), params }
  }
  // An event with no identifier is keyed by its start and title, so that it stays one row.
  return events.map((e) => (e.uid !== '' ? e : { ...e, uid: `${e.start ?? ''}|${e.summary}` }))
}
