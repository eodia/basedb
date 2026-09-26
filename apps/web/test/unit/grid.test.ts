import { describe, expect, it } from 'vitest'
import type { Field } from '../../src/lib/api/client'
import { compileMatcher } from '../../src/lib/evaluate'
import { aggregatesFor, searchClause } from '../../src/lib/grid'

/**
 * The grid's additions — chapter 11 §1.6: colour rules evaluated on the rows on screen
 * with the kernel's semantics, the quick search turned into a filter, the aggregates each
 * type offers.
 */

const field = (name: string, kind: string, extra: Partial<Field> = {}): Field => ({
  name,
  label: name,
  kind,
  description: null,
  ...extra,
})

const FIELDS = [
  field('nom', 'short_text'),
  field('montant', 'number'),
  field('statut', 'select', {
    options: [
      { value: 'a_faire', label: 'À faire', color: null, icon: null, image: null },
      { value: 'bloque', label: 'Bloqué', color: null, icon: null, image: null },
    ],
  }),
  field('jour', 'date'),
  field('client', 'link'),
  field('fait', 'boolean'),
  field('tags', 'multi_select'),
  field('equipe', 'multi_link'),
]

describe('compileMatcher', () => {
  const row = {
    _id: 'r',
    nom: 'Élodie Martin',
    montant: '120.5000000000',
    statut: 'bloque',
    jour: '2026-09-10',
    client: { id: 'c1', display: 'ACME' },
    fait: false,
    tags: ['urgent'],
    equipe: [
      { id: 'p1', display: 'Léa' },
      { id: 'p2', display: 'Hugo' },
    ],
  }
  const matches = (expression: string) => compileMatcher(expression, FIELDS)?.(row)

  it('compares as the kernel does: numbers as numbers, text folded for contains', () => {
    expect(matches('montant gt 100')).toBe(true)
    expect(matches('montant lte 100')).toBe(false)
    expect(matches('nom contains "elodie"')).toBe(true)
    expect(matches('nom eq "Élodie Martin"')).toBe(true)
    expect(matches('statut in ["a_faire", "bloque"]')).toBe(true)
    expect(matches('jour between ["2026-09-01", "2026-09-30"]')).toBe(true)
    expect(matches('client eq "c1"')).toBe(true)
    expect(matches('fait eq false')).toBe(true)
    expect(matches('tags has_any ["urgent", "x"]')).toBe(true)
  })

  it('asks a multi-link what it holds, by identifier, a lone value being a list of one', () => {
    expect(matches('equipe has_any "p2"')).toBe(true)
    expect(matches('equipe has_all ["p1", "p2"]')).toBe(true)
    expect(matches('equipe has_all ["p1", "p3"]')).toBe(false)
    expect(matches('tags has_any "urgent"')).toBe(true)
    expect(matches('equipe is_null')).toBe(false)
  })

  it('follows and, or, not and parentheses', () => {
    expect(matches('statut eq "bloque" and (montant lt 10 or nom starts_with "él")')).toBe(true)
    expect(matches('not statut eq "bloque"')).toBe(false)
  })

  it('never matches an empty value but with is_null, nor an unknown field', () => {
    const empty = compileMatcher('montant ne 5', FIELDS)
    expect(empty?.({ _id: 'e', montant: null })).toBe(false)
    expect(compileMatcher('montant is_null', FIELDS)?.({ _id: 'e', montant: null })).toBe(true)
    expect(matches('secret eq 1')).toBe(false)
  })

  it('gives nothing for a rule that does not parse', () => {
    expect(compileMatcher('statut eq', FIELDS)).toBeNull()
    expect(compileMatcher('', FIELDS)).toBeNull()
  })
})

describe('searchClause', () => {
  it('looks in texts, in the labels of choices and in numbers', () => {
    expect(searchClause(FIELDS, 'bloq')).toBe('(nom contains "bloq") or (statut in ["bloque"])')
    expect(searchClause(FIELDS, '120')).toBe('(nom contains "120") or (montant eq 120)')
  })

  it('finds nothing, rather than everything, when no column can hold the text', () => {
    expect(searchClause([field('jour', 'date')], 'x')).toBe('_id is_null')
    expect(searchClause(FIELDS, '  ')).toBe('')
  })
})

describe('aggregatesFor', () => {
  it('offers sums on numbers, bounds on dates, ticks on booleans', () => {
    expect(aggregatesFor('number')).toContain('sum')
    expect(aggregatesFor('date')).toEqual(['min', 'max', 'filled', 'empty'])
    expect(aggregatesFor('boolean')[0]).toBe('checked')
    expect(aggregatesFor('short_text')).not.toContain('sum')
  })
})
