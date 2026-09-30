import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  type MetaTable,
  columnsOf,
  eventsFor,
  freshRows,
  literal,
  matchFilter,
  pollFilter,
  toWrite,
  valuesOf,
  verifySignature,
} from '../nodes/logic'

const field = (name: string, kind: string, more: Record<string, unknown> = {}) => ({
  name,
  label: name[0].toUpperCase() + name.slice(1),
  description: null,
  kind,
  required: false,
  read_only: false,
  system: false,
  ...more,
})

const TABLE: MetaTable = {
  id: 't',
  name: 'clients',
  label: 'Clients',
  actions: ['read', 'create', 'update'],
  fields: [
    field('_id', 'system', { system: true, read_only: true }),
    field('_updated_at', 'system', { system: true, read_only: true }),
    field('nom', 'short_text', { required: true }),
    field('email', 'email'),
    field('montant', 'number'),
    field('actif', 'boolean'),
    field('signe_le', 'date'),
    field('rappel', 'datetime'),
    field('statut', 'select', {
      options: [
        { value: 'nouveau', label: 'Nouveau' },
        { value: 'gagne', label: 'Gagné' },
      ],
    }),
    field('tags', 'multi_select'),
    field('societe_id', 'link'),
    field('contacts', 'multi_link'),
    field('responsable', 'user'),
    field('pays', 'short_text', { required: true, default: 'France' }),
    field('total', 'formula', { read_only: true, computed: { result_kind: 'number' } }),
    field('numero', 'autonumber', { read_only: true }),
    field('logo', 'image'),
    field('resume', 'long_text', { ai: true, read_only: true }),
  ],
}

describe('the columns a workflow fills', () => {
  it('offers what can be written, and nothing basedb computes', () => {
    const ids = columnsOf(TABLE, 'create', []).map((c) => c.id)
    expect(ids).toEqual([
      'nom',
      'email',
      'montant',
      'actif',
      'signe_le',
      'rappel',
      'statut',
      'tags',
      'societe_id',
      'contacts',
      'responsable',
      'pays',
    ])
  })

  it('requires a required field to create — unless basedb has a default for it', () => {
    const columns = columnsOf(TABLE, 'create', [])
    expect(columns.find((c) => c.id === 'nom')?.required).toBe(true)
    expect(columns.find((c) => c.id === 'pays')?.required).toBe(false)
    expect(columnsOf(TABLE, 'update', []).some((c) => c.required)).toBe(false)
  })

  it('proposes the ID first to update, and lets single values find a row', () => {
    const columns = columnsOf(TABLE, 'update', [])
    expect(columns[0]).toMatchObject({ id: '_id', defaultMatch: true, canBeUsedToMatch: true })
    expect(columns.find((c) => c.id === 'email')?.canBeUsedToMatch).toBe(true)
    expect(columns.find((c) => c.id === 'tags')?.canBeUsedToMatch).toBe(false)
    expect(columnsOf(TABLE, 'upsert', []).some((c) => c.id === '_id')).toBe(false)
  })

  it('lists the choices of a list, and the active people for a Person field', () => {
    const columns = columnsOf(TABLE, 'create', [
      { id: 'u1', display_name: 'Léa Martin', email: 'lea@exemple.fr', disabled: false },
      { id: 'u2', display_name: '', email: 'paul@exemple.fr', disabled: false },
      { id: 'u3', display_name: 'Ancien', email: 'x@exemple.fr', disabled: true },
    ])
    expect(columns.find((c) => c.id === 'statut')).toMatchObject({
      type: 'options',
      options: [
        { name: 'Nouveau', value: 'nouveau' },
        { name: 'Gagné', value: 'gagne' },
      ],
    })
    expect(columns.find((c) => c.id === 'responsable')?.options).toEqual([
      { name: 'Léa Martin', value: 'u1' },
      { name: 'paul@exemple.fr', value: 'u2' },
    ])
  })
})

describe('the values sent', () => {
  it('converts each kind to what basedb takes', () => {
    expect(toWrite('number', '12.5')).toBe(12.5)
    expect(toWrite('number', '')).toBeNull()
    expect(toWrite('number', 'douze')).toBe('douze')
    expect(toWrite('boolean', 'true')).toBe(true)
    expect(toWrite('date', '2026-10-01T22:30:00.000+02:00')).toBe('2026-10-01')
    expect(toWrite('date', { toISODate: () => '2026-10-01', toISO: () => 'x' })).toBe('2026-10-01')
    expect(toWrite('date', new Date('2026-10-01T08:00:00Z'))).toBe('2026-10-01')
    expect(toWrite('datetime', { toISO: () => '2026-10-01T08:00:00.000+02:00' })).toBe(
      '2026-10-01T08:00:00.000+02:00',
    )
    expect(toWrite('multi_select', 'a, b')).toEqual(['a', 'b'])
    expect(toWrite('multi_select', '["a","b"]')).toEqual(['a', 'b'])
    expect(toWrite('multi_link', [{ id: 'x', display: 'X' }, 'y'])).toEqual(['x', 'y'])
    expect(toWrite('link', { id: 'x', display: 'X' })).toBe('x')
    expect(toWrite('link', '')).toBeNull()
    expect(toWrite('short_text', 42)).toBe('42')
    expect(toWrite('select', null)).toBeNull()
  })

  it('sends only the writable fields mapped, the matching ones left out on update', () => {
    const mapped = { nom: 'Acme', email: 'a@acme.fr', total: 3, inconnu: 1, _id: 'x' }
    expect(valuesOf(TABLE, mapped)).toEqual({ nom: 'Acme', email: 'a@acme.fr' })
    expect(valuesOf(TABLE, mapped, ['email'])).toEqual({ nom: 'Acme' })
  })
})

describe('the filter that finds a row', () => {
  it('quotes texts, writes numbers as they are, and asks for an empty value with is_null', () => {
    expect(literal('Le "grand" magasin')).toBe('"Le \\"grand\\" magasin"')
    expect(literal(12)).toBe('12')
    expect(matchFilter(TABLE, ['email', 'montant'], { email: 'a@acme.fr', montant: '12' })).toBe(
      'email eq "a@acme.fr" and montant eq 12',
    )
    expect(matchFilter(TABLE, ['email'], { email: '' })).toBe('email is_null')
  })
})

describe('the polling trigger', () => {
  const row = (id: string, at: string) => ({ _id: id, _updated_at: at })

  it('asks again from the last instant, and leaves out what it has emitted at it', () => {
    const first = freshRows(
      [row('a', '2026-09-30T10:00:00.001Z'), row('b', '2026-09-30T10:00:00.002Z')],
      '_updated_at',
      { since: '2026-09-30T10:00:00.000Z', seen: [] },
    )
    expect(first.fresh.map((r) => r._id)).toEqual(['a', 'b'])
    expect(first.next).toEqual({
      since: '2026-09-30T10:00:00.002Z',
      seen: ['b@2026-09-30T10:00:00.002Z'],
    })

    // b again — the same instant is asked again —, and c, written in the same millisecond.
    const second = freshRows(
      [row('b', '2026-09-30T10:00:00.002Z'), row('c', '2026-09-30T10:00:00.002Z')],
      '_updated_at',
      first.next,
    )
    expect(second.fresh.map((r) => r._id)).toEqual(['c'])
    expect(second.next.seen).toEqual(['b@2026-09-30T10:00:00.002Z', 'c@2026-09-30T10:00:00.002Z'])

    // b changed later: a new instant, so a new event.
    const third = freshRows(
      [row('b', '2026-09-30T10:00:00.002Z'), row('b2', '2026-09-30T10:05:00.000Z')],
      '_updated_at',
      second.next,
    )
    expect(third.fresh.map((r) => r._id)).toEqual(['b2'])
    expect(third.next.seen).toEqual(['b2@2026-09-30T10:05:00.000Z'])
  })

  it('keeps its state when nothing came', () => {
    const state = { since: '2026-09-30T10:00:00.000Z', seen: ['a@x'] }
    expect(freshRows([], '_created_at', state)).toEqual({ fresh: [], next: state })
  })

  it('adds its instant to the reader’s filter', () => {
    expect(pollFilter('_created_at', '2026-09-30T10:00:00.000Z', '')).toBe(
      '_created_at gte "2026-09-30T10:00:00.000Z"',
    )
    expect(pollFilter('_updated_at', 'T', 'a eq 1 or b eq 2')).toBe(
      '_updated_at gte "T" and (a eq 1 or b eq 2)',
    )
  })
})

describe('the webhook trigger', () => {
  const secret = 'whsec_essai'
  const body = JSON.stringify({ events: [{ id: 'e1', type: 'record.created', table: 'clients' }] })
  const now = Date.UTC(2026, 8, 30, 10, 0, 0)
  const t = Math.floor(now / 1000)
  const sign = (at: number, raw = body, key = secret) =>
    `t=${at},v1=${createHmac('sha256', key).update(`${at}.${raw}`).digest('hex')}`

  it('accepts what basedb signed, and nothing else', () => {
    expect(verifySignature(secret, sign(t), Buffer.from(body), now)).toBe('valid')
    expect(verifySignature(secret, sign(t), `${body} `, now)).toBe('invalid')
    expect(verifySignature(secret, sign(t, body, 'autre'), body, now)).toBe('invalid')
    expect(verifySignature(secret, undefined, body, now)).toBe('missing')
    expect(verifySignature(secret, 'v1=abc', body, now)).toBe('missing')
  })

  it('refuses a delivery signed more than five minutes away', () => {
    expect(verifySignature(secret, sign(t - 301), body, now)).toBe('stale')
    expect(verifySignature(secret, sign(t - 299), body, now)).toBe('valid')
  })

  it('keeps the events of the types and tables asked', () => {
    const delivery = {
      events: [
        { id: '1', type: 'record.created', table: 'clients' },
        { id: '2', type: 'record.deleted', table: 'clients' },
        { id: '3', type: 'record.created', table: 'factures' },
      ],
    }
    expect(eventsFor(delivery, ['record.created'], []).map((e) => e.id)).toEqual(['1', '3'])
    expect(eventsFor(delivery, [], ['clients']).map((e) => e.id)).toEqual(['1', '2'])
    expect(eventsFor({ nothing: true }, [], [])).toEqual([])
  })
})
