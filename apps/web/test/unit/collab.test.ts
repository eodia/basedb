import { describe, expect, it } from 'vitest'
import type { AppNotification } from '../../src/lib/api/client'
import {
  editableText,
  encodeMentions,
  mentionAt,
  notificationSentence,
  relativeTime,
  segmentsOf,
} from '../../src/lib/collab'
import { describeWrite, journalKey } from '../../src/lib/undo'

/**
 * Collaboration as the screen reads it — chapter 16.
 *
 * What these guard: a comment is drawn as words, mentions and links, never as HTML; a
 * name picked from the list is sent as a mention, and only that name; the mention being
 * typed is found at the caret; Ctrl+Z is the journal's only outside of what is typed.
 */

const ALICE = '01a0db9e-5a5e-76a6-ae75-b7e09fcf5c7d'
const MARIE = '01a0db9e-5a5e-76a6-ae75-b7e09fcf5c7e'

describe('a comment’s text', () => {
  it('is cut into words, mentions and links', () => {
    expect(
      segmentsOf(`Vu avec @[Alice Martin](user:${ALICE}), voir https://exemple.fr/a.`),
    ).toEqual([
      { kind: 'text', text: 'Vu avec ' },
      { kind: 'mention', name: 'Alice Martin', id: ALICE },
      { kind: 'text', text: ', voir ' },
      { kind: 'link', url: 'https://exemple.fr/a.' },
    ])
    // Markup stays text: the screen never interprets it.
    expect(segmentsOf('<b>gras</b>')).toEqual([{ kind: 'text', text: '<b>gras</b>' }])
  })

  it('reads back as names in the editor, and is sent as mentions', () => {
    const { text, chosen } = editableText(`Merci @[Alice Martin](user:${ALICE}) !`)
    expect(text).toBe('Merci @Alice Martin !')
    expect(encodeMentions(text, chosen)).toBe(`Merci @[Alice Martin](user:${ALICE}) !`)
  })

  it('sends only the names picked, the longest first', () => {
    const chosen = new Map([
      ['Marie', MARIE],
      ['Marie-Anne', ALICE],
    ])
    expect(encodeMentions('@Marie-Anne et @Marie, pas @Mariette', chosen)).toBe(
      `@[Marie-Anne](user:${ALICE}) et @[Marie](user:${MARIE}), pas @Mariette`,
    )
    expect(encodeMentions('@Alice', new Map())).toBe('@Alice')
  })
})

describe('the mention being typed', () => {
  it('is found at the caret, up to two spaces into a name', () => {
    expect(mentionAt('Bonjour @Ali', 12)).toEqual({ start: 8, query: 'Ali' })
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionAt('Bonjour @Alice Mar', 18)).toEqual({ start: 8, query: 'Alice Mar' })
  })

  it('is not an address, nor a mention already over', () => {
    expect(mentionAt('ecrire a moi@exemple', 20)).toBeNull()
    expect(mentionAt('@a b c d', 8)).toBeNull()
  })
})

describe('when and what', () => {
  const now = new Date('2026-09-26T12:00:00Z')

  it('says when in words', () => {
    expect(relativeTime('2026-09-26T11:59:40Z', now)).toBe('à l’instant')
    expect(relativeTime('2026-09-26T11:55:00Z', now)).toBe('il y a 5 min')
    expect(relativeTime('2026-09-26T09:00:00Z', now)).toBe('il y a 3 h')
    expect(relativeTime('2026-09-25T10:00:00Z', now)).toBe('hier')
    expect(relativeTime('2026-09-22T12:00:00Z', now)).toBe('il y a 4 jours')
  })

  it('says what a notification is about', () => {
    const n = {
      kind: 'mention',
      actor: { id: ALICE, name: 'Alice Martin' },
      table: { name: 'taches', label: 'Tâches' },
    } as AppNotification
    expect(notificationSentence(n)).toBe('Alice Martin vous a mentionné dans Tâches')
    expect(notificationSentence({ ...n, kind: 'assigned', actor: null })).toBe(
      'Quelqu’un vous a désigné dans Tâches',
    )
    expect(notificationSentence({ ...n, kind: 'automation' })).toBe(
      'Alice Martin vous prévient par une automatisation dans Tâches',
    )
  })
})

describe('the undo journal', () => {
  const write = (method: string, path: string, body: unknown = null) => ({
    transaction: '42',
    method,
    path,
    body: body === null ? null : JSON.stringify(body),
  })

  it('names each gesture', () => {
    const label = (name: string) => (name === 'statut' ? 'Statut' : name)
    expect(describeWrite(write('PATCH', '/x/1', { values: { statut: 'fait' } }), label)).toBe(
      'modification de « Statut »',
    )
    expect(describeWrite(write('PATCH', '/x/1', { values: { a: 1, b: 2 } }), label)).toBe(
      'modification d’une ligne',
    )
    expect(describeWrite(write('POST', '/x'), label)).toBe('création d’une ligne')
    expect(describeWrite(write('POST', '/x/batch'), label)).toBe('import de lignes')
    expect(describeWrite(write('DELETE', '/x/1'), label)).toBe('suppression d’une ligne')
  })

  it('takes Ctrl+Z and Ctrl+Shift+Z, never inside what is being typed', () => {
    const key = (init: Partial<KeyboardEvent>, typing = false) =>
      ({
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        key: 'z',
        target: { isContentEditable: false, closest: () => (typing ? {} : null) },
        ...init,
      }) as unknown as KeyboardEvent
    expect(journalKey(key({ ctrlKey: true }))).toBe('undo')
    expect(journalKey(key({ metaKey: true, shiftKey: true, key: 'Z' }))).toBe('redo')
    expect(journalKey(key({ ctrlKey: true, key: 'y' }))).toBe('redo')
    expect(journalKey(key({ ctrlKey: true }, true))).toBeNull()
    expect(journalKey(key({}))).toBeNull()
  })
})
