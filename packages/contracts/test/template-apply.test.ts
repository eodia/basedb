import { describe, expect, it } from 'vitest'
import {
  type BuiltField,
  type BuiltTable,
  type Template,
  type TemplateOperations,
  type TemplateStep,
  aiFieldsOf,
  applyTemplate,
  automationFor,
  blockFor,
  checkTemplate,
  rowFor,
  specFor,
} from '../src/index.js'

/**
 * Building a template — chapter 20 §4: a template's labels become the API's names and its
 * choices their values — in a view, a block, an automation, a row —; a relation to a row not
 * created yet waits; `$moi` is whoever applies it; the steps come in their order, through
 * whatever operations the caller gives.
 */

const statut: BuiltField = {
  label: 'Statut',
  id: 'f-statut',
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
  id: `f-${name}`,
  name,
  kind,
  ai,
})

const tickets: BuiltTable = {
  key: 'tickets',
  label: 'Tickets',
  id: 't-1',
  name: 'tickets',
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
  /** Operations that build nothing and remember what they were asked. */
  const recorded = () => {
    const calls: Array<[string, unknown[]]> = []
    const record =
      (name: string, answer: (...args: never[]) => unknown = () => undefined) =>
      async (...args: never[]) => {
        calls.push([name, args])
        return answer(...args)
      }
    const operations: TemplateOperations = {
      createTable: record('createTable', () => ({
        id: 't1',
        name: 'taches',
        fields: [{ id: 'f1', name: 'titre', label: 'Titre' }],
      })) as TemplateOperations['createTable'],
      setTableLook: record('setTableLook') as TemplateOperations['setTableLook'],
      addField: record('addField', () => ({
        id: 'f2',
        name: 'x',
      })) as TemplateOperations['addField'],
      createLink: record('createLink', () => ({
        id: 'l',
        name: 'l',
      })) as TemplateOperations['createLink'],
      setDisplayColumn: record('setDisplayColumn') as TemplateOperations['setDisplayColumn'],
      createRows: record('createRows', () => ['r1', 'r2']) as TemplateOperations['createRows'],
      updateRow: record('updateRow') as TemplateOperations['updateRow'],
      setRequired: record('setRequired') as TemplateOperations['setRequired'],
      createView: record('createView') as TemplateOperations['createView'],
      createDashboard: record('createDashboard') as TemplateOperations['createDashboard'],
      createAutomation: record('createAutomation', () => ({
        id: 'a',
      })) as TemplateOperations['createAutomation'],
      isAiUnavailable: () => false,
    }
    return { calls, operations }
  }

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
    const { calls, operations } = recorded()
    const steps: TemplateStep[] = []
    const report = await applyTemplate((check as { template: Template }).template, operations, {
      onStep: (step) => steps.push(step),
      aiConsent: false,
      me: null,
      ...(rows === undefined ? {} : { rows }),
    })
    return { calls, steps, report }
  }

  it('are written by default, after the display column', async () => {
    const { calls, report } = await build()
    expect(calls.map(([name]) => name)).toEqual(['createTable', 'setDisplayColumn', 'createRows'])
    expect(calls.at(-1)).toEqual(['createRows', ['t1', [{ titre: 'Écrire' }, { titre: 'Relire' }]]])
    expect(report).toEqual({ aiDegraded: 0, sampled: true, notRequired: [] })
  })

  it('are left out on request: the tables stay empty', async () => {
    const { calls, steps, report } = await build(false)
    expect(calls.some(([name]) => name === 'createRows')).toBe(false)
    expect(steps.some((step) => step.kind === 'rows')).toBe(false)
    expect(report.sampled).toBe(false)
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
