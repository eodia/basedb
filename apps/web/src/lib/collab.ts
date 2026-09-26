import type { AppNotification } from '@/lib/api/client'

/**
 * The words of collaboration — chapter 16 — kept apart from the screens so that they can
 * be tested: how a comment's text is cut into words, mentions and links; how a mention
 * typed as a name is written for the server; when an instant was; what a notification
 * says.
 */

export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'mention'; readonly name: string; readonly id: string }
  | { readonly kind: 'link'; readonly url: string }

const TOKEN =
  /@\[([^\]\n]{1,100})\]\(user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)|(https?:\/\/[^\s<>"')\]]+)/gi

/** A comment's text as it is drawn: plain words, mentions, links — never HTML. */
export function segmentsOf(body: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const match of body.matchAll(TOKEN)) {
    const at = match.index ?? 0
    if (at > last) out.push({ kind: 'text', text: body.slice(last, at) })
    if (match[3] !== undefined) out.push({ kind: 'link', url: match[3] })
    else
      out.push({
        kind: 'mention',
        name: match[1] as string,
        id: (match[2] as string).toLowerCase(),
      })
    last = at + match[0].length
  }
  if (last < body.length) out.push({ kind: 'text', text: body.slice(last) })
  return out
}

/** The text as the editor shows it: a mention by its name alone. */
export function editableText(body: string): { text: string; chosen: Map<string, string> } {
  const chosen = new Map<string, string>()
  const text = body.replace(
    /@\[([^\]\n]{1,100})\]\(user:([0-9a-f-]{36})\)/gi,
    (_, name: string, id: string) => {
      chosen.set(name, id.toLowerCase())
      return `@${name}`
    },
  )
  return { text, chosen }
}

/**
 * The text as the server reads it: each `@Name` chosen from the list becomes
 * `@[Name](user:<id>)`. The longest names first, so that « Marie » does not eat the start
 * of « Marie-Anne ».
 */
export function encodeMentions(text: string, chosen: ReadonlyMap<string, string>): string {
  const names = [...chosen.keys()].sort((a, b) => b.length - a.length)
  if (names.length === 0) return text
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`@(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'gu')
  return text.replace(pattern, (_, name: string) => `@[${name}](user:${chosen.get(name)})`)
}

/**
 * The mention being typed at the caret — the `@` that starts it and what follows — or
 * `null` when the caret is not in one.
 */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const match = /(^|\s)@([\p{L}\p{N}'’ -]{0,40})$/u.exec(before)
  if (match === null) return null
  const query = match[2] as string
  // A second word is still the name; a third space means the mention is over.
  if ((query.match(/ /g) ?? []).length > 2) return null
  return { start: caret - query.length - 1, query }
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** When, in words: « à l’instant », « il y a 5 min », « hier », « 3 mars ». */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  const seconds = Math.round((now.getTime() - at.getTime()) / 1000)
  if (seconds < 45) return 'à l’instant'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  return DATE.format(at)
}

/** What a notification says, before its excerpt. */
export function notificationSentence(n: AppNotification): string {
  const who = n.actor?.name ?? 'Quelqu’un'
  switch (n.kind) {
    case 'mention':
      return `${who} vous a mentionné dans ${n.table.label}`
    case 'reply':
      return `${who} a répondu dans ${n.table.label}`
    case 'assigned':
      return `${who} vous a désigné dans ${n.table.label}`
    case 'automation':
      return `${who} vous prévient par une automatisation dans ${n.table.label}`
  }
}
