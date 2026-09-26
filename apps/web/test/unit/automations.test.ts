import { describe, expect, it } from 'vitest'
import type { Automation, DescribedBase, Field } from '../../src/lib/api/client'
import { buttonUrl, draftOf, emptyDraft, inputOf, runSentence } from '../../src/lib/automations'

/**
 * Automations as the screen edits them — chapter 17.
 *
 * What these guard: what the form shows goes back to the API unchanged — tables by name
 * on the way in, by key on the way out; a schedule carries no condition; a button's
 * address is composed from what the reader sees, and only an http(s) or mailto one opens.
 */

const base = {
  name: 'b_projet',
  tables: [
    { id: 't1', name: 'taches', fields: [] },
    { id: 't2', name: 'journal', fields: [] },
  ],
} as unknown as DescribedBase

const automation: Automation = {
  id: 'a1',
  label: 'Clôture',
  description: null,
  enabled: true,
  trigger: { kind: 'record_updated', table: 't1', fields: ['statut'], schedule: null },
  condition: 'statut eq "fait"',
  actions: [
    { kind: 'update_record', values: { note: 'Clos : {{nom}}', budget: 12 } },
    { kind: 'create_record', table: 't2', values: { entree: '{{nom}}' } },
    { kind: 'notify', users: ['u1'], user_field: null, message: 'Fini' },
    { kind: 'slack', integration: 'i1', message: '{{nom}} est close' },
  ],
  owner: { id: 'u1', name: 'Marie' },
  next_run_at: null,
  last_run: null,
  created_at: '',
  updated_at: '',
}

describe('the automation form', () => {
  it('shows tables by name, values as rows, and saves them back', () => {
    const draft = draftOf(automation, base)
    expect(draft.trigger.table).toBe('taches')
    expect(draft.actions[0]).toEqual({
      kind: 'update_record',
      values: [
        { field: 'note', value: 'Clos : {{nom}}' },
        { field: 'budget', value: '12' },
      ],
    })
    const input = inputOf(draft)
    expect(input.trigger).toEqual({
      kind: 'record_updated',
      table: 'taches',
      fields: ['statut'],
      schedule: null,
    })
    expect(input.actions?.[1]).toEqual({
      kind: 'create_record',
      table: 'journal',
      values: { entree: '{{nom}}' },
    })
    expect(input.actions?.[2]).toEqual({
      kind: 'notify',
      users: ['u1'],
      user_field: null,
      message: 'Fini',
    })
    // A Slack connection is named by its identifier, both ways.
    expect(draft.actions[3]).toEqual({
      kind: 'slack',
      integration: 'i1',
      message: '{{nom}} est close',
    })
    expect(input.actions?.[3]).toEqual({
      kind: 'slack',
      integration: 'i1',
      message: '{{nom}} est close',
    })
  })

  it('gives a schedule neither a table nor a condition', () => {
    const draft = { ...emptyDraft(base), condition: 'x eq 1' }
    const input = inputOf({ ...draft, trigger: { ...draft.trigger, kind: 'schedule' } })
    expect(input.trigger).toMatchObject({
      kind: 'schedule',
      table: null,
      schedule: { every: 'day' },
    })
    expect(input.condition).toBeNull()
  })

  it('says why a run did nothing', () => {
    expect(
      runSentence({ status: 'skipped', reason: 'condition_fausse' } as Parameters<
        typeof runSentence
      >[0]),
    ).toBe('Écartée : la condition n’était pas remplie')
    expect(
      runSentence({ status: 'failed', error_code: 'ACTION_FORBIDDEN' } as Parameters<
        typeof runSentence
      >[0]),
    ).toBe('Échouée (ACTION_FORBIDDEN)')
  })
})

describe('a button’s address', () => {
  const fields = [
    { name: 'numero', kind: 'short_text' },
    { name: 'statut', kind: 'select', options: [{ value: 'fait', label: 'Fait !' }] },
  ] as unknown as Field[]
  const row = { _id: 'r1', numero: 'D 42', statut: 'fait' }

  it('is composed from the row, encoded', () => {
    expect(buttonUrl('https://exemple.fr/devis/{{numero}}?s={{statut}}', row, fields)).toBe(
      'https://exemple.fr/devis/D%2042?s=Fait%20!',
    )
    // A field the reader cannot see is empty.
    expect(buttonUrl('mailto:{{secret}}x@exemple.fr', row, fields)).toBe('mailto:x@exemple.fr')
  })

  it('opens only an http(s) or mailto address', () => {
    expect(buttonUrl('javascript:alert({{numero}})', row, fields)).toBeNull()
    expect(buttonUrl('{{numero}}', row, fields)).toBeNull()
  })
})
