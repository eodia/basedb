import { type Template, checkTemplate } from '@basedb/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Field, api } from '../../src/lib/api/client'
import { filterToLabels, templateValue, textToLabels } from '../../src/lib/template-export'
import {
  type BuiltField,
  type BuiltTable,
  aiFieldsOf,
  applyTemplate,
  automationFor,
  blockFor,
  rowFor,
  specFor,
} from '../../src/lib/templates'

/**
 * Base templates as the interface applies and exports them — chapter 20 §4, §6.
 *
 * What these guard: a template's labels become the API's names and its choices their
 * values — in a view, a block, an automation, a row —; a relation to a row not created yet
 * waits; `$moi` is whoever applies it; and the way back gives labels again.
 */

const statut: BuiltField = {
  label: 'Statut',
  name: 'statut',
  kind: 'select',
  options: [
    { label: 'En cours', value: 'en_cours', color: null, icon: null },
    { label: 'Résolu', value: 'resolu', color: null, icon: null },
  ],
  ai: false,
}
const field = (label: string, name: string, kind: string, ai = false): BuiltField => ({
  label,
  name,
  kind,
  ai,
})

const tickets: BuiltTable = {
  key: 'tickets',
  label: 'Tickets',
  id: 't-1',
  ref: { base: 'b_x', name: 'tickets' },
  fields: new Map(
    [
      field('Titre', 'titre', 'short_text'),
      statut,
      field('Ouvert le', 'ouvert_le', 'date'),
      field('Assigné à', 'assigne_a', 'user'),
      field('Produit', 'produit', 'link'),
      field('Bloqué par', 'bloque_par', 'multi_link'),
      field('Résumé', 'resume', 'short_text', true),
    ].map((f) => [f.label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(), f]),
  ),
}
const built = new Map([['tickets', tickets]])

describe('applying a template', () => {
  it('writes a view with names and choice values', () => {
    const spec = specFor(
      {
        table: 'tickets',
        label: 'Tableau',
        kind: 'kanban',
        spec: {
          group_by: 'Statut',
          card_fields: ['Produit', 'Ouvert le'],
          group_order: ['Résolu', 'En cours'],
          filter: '[Statut] ne "Résolu"',
          sorts: [{ field: 'Ouvert le', direction: 'desc' }],
        },
      },
      tickets,
    )
    expect(spec).toEqual({
      group_by: 'statut',
      card_fields: ['produit', 'ouvert_le'],
      group_order: ['resolu', 'en_cours'],
      filter: 'statut ne "resolu"',
      sorts: [{ field: 'ouvert_le', direction: 'desc' }],
    })
  })

  it('gives a form its questions by name, and a title', () => {
    expect(
      specFor(
        {
          table: 'tickets',
          label: 'Signaler',
          kind: 'form',
          spec: { fields: [{ field: 'Titre', required: true }] },
        },
        tickets,
      ),
    ).toEqual({
      fields: [{ field: 'titre', required: true, label: '', help: '' }],
      title: 'Signaler',
    })
  })

  it('points a block at the table by identifier', () => {
    expect(
      blockFor(
        {
          kind: 'list',
          title: 'Récents',
          width: 2,
          table: 'tickets',
          fields: ['Titre'],
          filter: '',
          sort: '-Ouvert le',
          limit: 5,
        },
        built,
      ),
    ).toEqual({
      kind: 'list',
      title: 'Récents',
      width: 2,
      table: 't-1',
      fields: ['titre'],
      filter: '',
      sort: '-ouvert_le',
      limit: 5,
    })
  })

  it('writes an automation by names, `$moi` being whoever applies it', () => {
    const input = automationFor(
      {
        label: 'Alerte',
        enabled: true,
        trigger: { kind: 'record_updated', table: 'tickets', fields: ['Statut'], schedule: null },
        condition: '[Statut] eq "Résolu"',
        actions: [
          { kind: 'update_record', values: { Statut: 'En cours', Titre: 'Vu : {{Titre}}' } },
          {
            kind: 'notify',
            users: ['$moi'],
            user_field: 'Assigné à',
            message: '{{Titre}} le {{_maintenant}}',
          },
        ],
      },
      built,
      'u-1',
    )
    expect(input.trigger).toEqual({
      kind: 'record_updated',
      table: 'tickets',
      fields: ['statut'],
      schedule: null,
    })
    expect(input.condition).toBe('statut eq "resolu"')
    expect(input.actions).toEqual([
      { kind: 'update_record', values: { statut: 'en_cours', titre: 'Vu : {{titre}}' } },
      {
        kind: 'notify',
        users: ['u-1'],
        user_field: 'assigne_a',
        message: '{{titre}} le {{_maintenant}}',
      },
    ])
  })

  it('writes a row: choices, relative dates, `$moi`; a relation not created yet waits', () => {
    const links = new Map([
      ['tickets:produit', 'produits'],
      ['tickets:bloque par', 'tickets'],
    ])
    const ids = new Map([['produits:app', 'r-app']])
    const { values, deferred } = rowFor(
      {
        Titre: 'Crash',
        Statut: 'En cours',
        'Ouvert le': '-3d',
        'Assigné à': '$moi',
        Produit: '@app',
        'Bloqué par': ['@k2'],
        Résumé: 'ignoré',
      },
      tickets,
      (table, key) => ids.get(`${table}:${key}`),
      links,
      'u-1',
      new Date(2026, 8, 26),
    )
    expect(values).toEqual({
      titre: 'Crash',
      statut: 'en_cours',
      ouvert_le: '2026-09-23',
      assigne_a: 'u-1',
      produit: 'r-app',
    })
    expect(deferred).toEqual({ 'Bloqué par': ['@k2'] })
  })
})

describe('the sample rows of a template', () => {
  afterEach(() => vi.restoreAllMocks())

  const build = async (rows?: boolean) => {
    const check = checkTemplate({
      key: 'taches',
      label: 'Tâches',
      tables: [
        { key: 'taches', label: 'Tâches', fields: [{ label: 'Titre', kind: 'short_text' }] },
      ],
      rows: { taches: [{ Titre: 'Écrire' }, { Titre: 'Relire' }] },
    })
    expect(check.ok).toBe(true)
    vi.spyOn(api, 'createTable').mockResolvedValue({
      id: 't1',
      name: 'taches',
      fields: [{ name: 'titre', label: 'Titre' }],
    } as never)
    vi.spyOn(api, 'setDisplayColumn').mockResolvedValue({ field: 'titre', name: 'titre' })
    const createRecords = vi
      .spyOn(api, 'createRecords')
      .mockResolvedValue({ results: [{ id: 'r1' }, { id: 'r2' }] } as never)
    const steps: string[] = []
    await applyTemplate((check as { template: Template }).template, 'projet', {
      onStep: (step) => steps.push(step),
      aiConsent: false,
      me: null,
      ...(rows === undefined ? {} : { rows }),
    })
    return { createRecords, steps }
  }

  it('are written by default', async () => {
    const { createRecords } = await build()
    expect(createRecords).toHaveBeenCalledWith({ base: 'projet', name: 'taches' }, [
      { titre: 'Écrire' },
      { titre: 'Relire' },
    ])
  })

  it('are left out on request: the tables stay empty', async () => {
    const { createRecords, steps } = await build(false)
    expect(createRecords).not.toHaveBeenCalled()
    expect(steps.some((step) => step.includes('exemple'))).toBe(false)
  })
})

describe('exporting a base', () => {
  const fields = [
    {
      name: 'statut',
      label: 'Statut',
      kind: 'select',
      description: null,
      options: [{ value: 'resolu', label: 'Résolu', color: null, icon: null, image: null }],
    },
    { name: 'titre', label: 'Titre', kind: 'short_text', description: null },
    {
      name: 'produit',
      label: 'Produit',
      kind: 'link',
      description: null,
      link: { target: 'produits', expandable: true, masked: false, on_delete: 'restrict' },
    },
  ] as unknown as Field[]

  it('writes filters and messages by label again', () => {
    expect(filterToLabels('statut eq "resolu" and titre contains "statut"', fields)).toBe(
      '[Statut] eq "Résolu" and [Titre] contains "statut"',
    )
    expect(textToLabels('Vu : {{titre}} ({{_id}})', fields)).toBe('Vu : {{Titre}} ({{_id}})')
  })

  it('writes values by label, relations by row key', () => {
    const key = (table: string, id: string) =>
      table === 'produits' && id === 'r-app' ? 'produits-1' : undefined
    expect(templateValue('resolu', fields[0] as Field, key, null)).toBe('Résolu')
    expect(templateValue({ id: 'r-app', display: 'App' }, fields[2] as Field, key, null)).toBe(
      '@produits-1',
    )
    expect(templateValue({ id: 'r-autre' }, fields[2] as Field, key, null)).toBeUndefined()
  })
})

describe('the AI of a template', () => {
  it('lists what the consent is about', () => {
    const check = checkTemplate({
      key: 'avis',
      label: 'Avis',
      tables: [
        {
          key: 'avis',
          label: 'Avis',
          fields: [
            { label: 'Texte', kind: 'long_text' },
            {
              label: 'Ton',
              kind: 'select',
              options: ['Bon', 'Mauvais'],
              ai: { prompt: 'Le ton de {{Texte}} ?' },
            },
          ],
        },
      ],
    })
    expect(check.ok).toBe(true)
    expect(aiFieldsOf((check as { template: Template }).template)).toEqual([
      { table: 'Avis', field: 'Ton', prompt: 'Le ton de {{Texte}} ?' },
    ])
  })
})
