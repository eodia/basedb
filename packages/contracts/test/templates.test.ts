import { describe, expect, it } from 'vitest'
import {
  checkTemplate,
  resolveTemplateDate,
  summarizeTemplate,
  translateFilter,
} from '../src/templates.js'

/**
 * Base templates — chapter 20.
 *
 * What these guard: a template is read the same way wherever it comes from; its references
 * — tables, fields, relations, choices, row keys — resolve, or it is refused with a path
 * saying where; the AI's proposal is repaired rather than refused, and says what was
 * dropped; nothing that calls outside survives; filters and dates become what the API reads.
 */

const tickets = {
  format: 1,
  key: 'suivi-tickets',
  label: 'Suivi de tickets',
  summary: 'Des tickets et leurs produits.',
  tables: [
    {
      key: 'produits',
      label: 'Produits',
      fields: [
        { label: 'Nom', kind: 'short_text' },
        { label: 'Nb tickets', kind: 'count', rollup: { via: 'Produit', table: 'tickets' } },
      ],
    },
    {
      key: 'tickets',
      label: 'Tickets',
      fields: [
        { label: 'Titre', kind: 'short_text', required: true },
        {
          label: 'Statut',
          kind: 'select',
          options: ['Nouveau', 'En cours', { label: 'Résolu', color: '#10b981' }],
        },
        { label: 'Ouvert le', kind: 'date' },
        { label: 'Description', kind: 'long_text' },
        {
          label: 'Catégorie',
          kind: 'select',
          options: ['Bug', 'Demande'],
          ai: { prompt: 'Classe ce ticket : {{Titre}} — {{Description}}' },
        },
        { label: 'Âge', kind: 'formula', formula: 'JOURS(AUJOURDHUI(); [Ouvert le])' },
        { label: 'Produit (nom)', kind: 'lookup', rollup: { via: 'Produit', target: 'Nom' } },
      ],
    },
  ],
  links: [{ from: 'tickets', label: 'Produit', to: 'produits' }],
  rows: {
    produits: [{ $key: 'app', Nom: 'Application' }],
    tickets: [
      { Titre: 'Crash', Statut: 'en_cours', Produit: '@app', 'Ouvert le': '-3d', Catégorie: 'bug' },
    ],
  },
  views: [
    {
      table: 'tickets',
      label: 'Tableau',
      kind: 'kanban',
      spec: { group_by: 'Statut', card_fields: ['Produit'] },
    },
    { table: 'tickets', label: 'Ouverts', kind: 'grid', spec: { filter: '[Statut] ne "Résolu"' } },
  ],
  dashboards: [
    {
      label: 'Vue d’ensemble',
      blocks: [
        { kind: 'number', title: 'Ouverts', table: 'tickets', filter: '[Statut] ne "Résolu"' },
        {
          kind: 'chart',
          title: 'Par catégorie',
          table: 'tickets',
          group_by: 'Catégorie',
          style: 'pie',
        },
      ],
    },
  ],
  automations: [
    {
      label: 'Date de résolution',
      trigger: { kind: 'record_updated', table: 'tickets', fields: ['Statut'] },
      condition: '[Statut] eq "Résolu"',
      actions: [{ kind: 'update_record', values: { Description: 'Résolu : {{Titre}}' } }],
    },
  ],
}

describe('a template', () => {
  it('is read with its choices valued, its rows canonical, its base named', () => {
    const check = checkTemplate(tickets)
    expect(check.issues).toEqual([])
    expect(check.ok).toBe(true)
    if (!check.ok) return
    const t = check.template
    expect(t.base.label).toBe('Suivi de tickets')
    expect(t.tables[1]?.fields[1]?.options?.map((o) => [o.label, o.value])).toEqual([
      ['Nouveau', 'nouveau'],
      ['En cours', 'en_cours'],
      ['Résolu', 'resolu'],
    ])
    // A choice given by its value comes back as its label; a relation as its key.
    expect(t.rows.tickets?.[0]).toMatchObject({
      Statut: 'En cours',
      Catégorie: 'Bug',
      Produit: '@app',
    })
    expect(summarizeTemplate(t).counts).toMatchObject({
      tables: 2,
      rows: 2,
      views: 2,
      ai_fields: 1,
    })
  })

  it('is refused with a path when a reference does not resolve', () => {
    const broken = structuredClone(tickets)
    broken.views[0] = {
      table: 'tickets',
      label: 'Tableau',
      kind: 'kanban',
      spec: { group_by: 'Etat', card_fields: [] },
    }
    broken.rows.tickets[0] = {
      ...broken.rows.tickets[0],
      Produit: '@inconnu',
    } as (typeof broken.rows.tickets)[0]
    const check = checkTemplate(broken)
    expect(check.ok).toBe(false)
    expect(check.issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(['views[0].spec.group_by', 'rows.tickets[0].Produit']),
    )
  })

  it('is repaired when it comes from the AI: what does not hold is dropped, and said', () => {
    const proposal = structuredClone(tickets) as Record<string, unknown> & typeof tickets
    proposal.views.push({
      table: 'tickets',
      label: 'Cassée',
      kind: 'grid',
      spec: { filter: '[Inconnu] eq 1' },
    })
    ;(proposal.automations[0] as { actions: unknown[] }).actions.push({
      kind: 'webhook',
      url: 'https://x.example',
    })
    ;(proposal.rows.tickets[0] as Record<string, unknown>).Statut = 'Perdu'
    const check = checkTemplate(proposal, { repair: true })
    expect(check.ok).toBe(true)
    if (!check.ok) return
    expect(check.template.automations[0]?.actions.map((a) => a.kind)).toEqual(['update_record'])
    expect(check.template.rows.tickets?.[0]).not.toHaveProperty('Statut')
    expect(check.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        'un modèle n’appelle pas l’extérieur : action retirée',
        'choix « Perdu » inconnu',
      ]),
    )
  })

  it('never takes a file, a shared page, or a formula citing what comes after it', () => {
    const t = structuredClone(tickets) as unknown as {
      tables: Array<{ fields: unknown[] }>
      dashboards: Array<{ blocks: unknown[] }>
    }
    t.tables[1]?.fields.push({ label: 'Pièce', kind: 'file' })
    t.tables[1]?.fields.splice(5, 0, { label: 'Double âge', kind: 'formula', formula: '[Âge] * 2' })
    t.dashboards[0]?.blocks.push({ kind: 'embed', url: 'https://x.example' })
    const check = checkTemplate(t)
    expect(check.ok).toBe(false)
    expect(check.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        'un modèle ne porte pas de fichier',
        '« Âge » est calculé : déclarez-le avant cette formule',
        'un modèle ne porte pas de page extérieure',
      ]),
    )
  })

  it('gives the display column a simple type, adding one when repairing', () => {
    const t = {
      label: 'X',
      tables: [{ label: 'Avis', fields: [{ label: 'Note', kind: 'select', options: ['1', '2'] }] }],
    }
    expect(checkTemplate(t).ok).toBe(false)
    const repaired = checkTemplate(t, { repair: true })
    expect(repaired.ok && repaired.template.tables[0]?.fields.map((f) => f.label)).toEqual([
      'Nom',
      'Note',
    ])
    expect(repaired.ok && repaired.template.key).toBe('x')
  })

  it('keeps a rich text on a long text only — neither the display column, nor the AI', () => {
    const t = { ...structuredClone(tickets), format: 2 } as unknown as {
      tables: Array<{ fields: Array<Record<string, unknown>> }>
      rows: Record<string, Array<Record<string, unknown>>>
    }
    const fields = t.tables[1]?.fields ?? []
    ;(fields[3] as Record<string, unknown>).rich = true
    ;(t.rows.tickets?.[0] as Record<string, unknown>).Description =
      '<p>Au <strong>démarrage</strong> :</p><ol><li>ouvrir</li><li>attendre</li></ol>'
    const check = checkTemplate(t)
    expect(check.issues).toEqual([])
    expect(check.ok && check.template.tables[1]?.fields[3]).toMatchObject({
      label: 'Description',
      kind: 'long_text',
      rich: true,
    })
    expect(check.ok && check.template.rows.tickets?.[0]?.Description).toContain('<ol>')
    // Format 2 says it: an instance that reads only format 1 leaves it out rather than
    // storing its HTML as Markdown. Without a rich text, a template is still format 1.
    expect(check.ok && check.template.format).toBe(2)
    const plain = checkTemplate(tickets)
    expect(plain.ok && plain.template.format).toBe(1)
    expect(checkTemplate({ ...t, format: 1 }).issues).toContainEqual({
      path: 'tables[1].fields[3].rich',
      message: 'un texte riche demande "format": 2',
    })
    expect(checkTemplate({ ...t, format: 3 }).issues).toContainEqual({
      path: 'format',
      message: 'format 3 inconnu ; seuls les formats 1 et 2 existent',
    })
    ;(fields[0] as Record<string, unknown>).rich = true
    ;(fields[4] as Record<string, unknown>).rich = true
    fields.push({ label: 'Résumé', kind: 'long_text', rich: true, ai: { prompt: '{{Titre}}' } })
    const refused = checkTemplate(t)
    expect(refused.ok).toBe(false)
    expect(refused.issues).toEqual(
      expect.arrayContaining([
        { path: 'tables[1].fields[0].rich', message: 'seul un texte long peut être riche' },
        { path: 'tables[1].fields[4].rich', message: 'seul un texte long peut être riche' },
        { path: 'tables[1].fields[7].ai', message: 'l’IA n’écrit pas de texte riche' },
      ]),
    )
    const repaired = checkTemplate(t, { repair: true })
    const kept = repaired.ok ? repaired.template.tables[1]?.fields : []
    expect(kept?.filter((f) => f.rich === true).map((f) => f.label)).toEqual([
      'Description',
      'Résumé',
    ])
    expect(kept?.find((f) => f.label === 'Résumé')?.ai).toBeUndefined()
  })

  it('never makes the display column a rich text', () => {
    const t = {
      label: 'X',
      tables: [{ label: 'Notes', fields: [{ label: 'Texte', kind: 'long_text', rich: true }] }],
    }
    const check = checkTemplate(t)
    expect(check.ok).toBe(false)
    expect(check.issues).toContainEqual({
      path: 'tables[0].fields[0].rich',
      message: 'la colonne d’affichage n’est pas un texte riche',
    })
  })
})

describe('the views of a template', () => {
  it('take for each key a field of the kind the view expects', () => {
    const t = structuredClone(tickets) as unknown as { views: unknown[] }
    t.views = [
      { table: 'tickets', label: 'Kanban', kind: 'kanban', spec: { group_by: 'Titre' } },
      { table: 'tickets', label: 'Agenda', kind: 'calendar', spec: { date_field: 'Statut' } },
      { table: 'tickets', label: 'Somme', kind: 'grid', spec: { summaries: { Titre: 'sum' } } },
    ]
    const strict = checkTemplate(t)
    expect(strict.ok).toBe(false)
    expect(strict.issues.map((i) => i.path)).toEqual([
      'views[0].spec.group_by',
      'views[1].spec.date_field',
      'views[2].spec.summaries',
    ])
    // Repaired, the kanban groups by a choice and the calendar reads a date.
    const repaired = checkTemplate(t, { repair: true })
    expect(repaired.ok && repaired.template.views.map((v) => v.spec)).toEqual([
      { group_by: 'Statut' },
      { date_field: 'Ouvert le' },
      { summaries: {} },
    ])
  })
})

describe('a filter of a template', () => {
  const resolve = (label: string) =>
    label === 'Statut'
      ? { name: 'statut', options: [{ label: 'Résolu', value: 'resolu' }] }
      : label === 'Titre'
        ? { name: 'titre' }
        : null

  it('cites fields by label and choices by label, as the API reads them by name and value', () => {
    expect(translateFilter('[Statut] ne "Résolu" and [Titre] contains "[x]"', resolve)).toEqual({
      filter: 'statut ne "resolu" and titre contains "[x]"',
      unknown: [],
    })
    expect(translateFilter('[Statut] in ("résolu", "Autre")', resolve).filter).toBe(
      'statut in ("resolu", "Autre")',
    )
    expect(translateFilter('[Inconnu] eq 1', resolve).unknown).toEqual(['Inconnu'])
  })
})

describe('a date of a template', () => {
  const today = new Date(2026, 8, 26, 15, 0)
  it('is relative to the day it is applied, or absolute', () => {
    expect(resolveTemplateDate('today', 'date', today)).toBe('2026-09-26')
    expect(resolveTemplateDate('+3d', 'date', today)).toBe('2026-09-29')
    expect(resolveTemplateDate('-2w', 'date', today)).toBe('2026-09-12')
    expect(resolveTemplateDate('+1m', 'date', today)).toBe('2026-10-26')
    expect(resolveTemplateDate('2026-10-01', 'date', today)).toBe('2026-10-01')
    expect(resolveTemplateDate('+1d 14:30', 'datetime', today)).toBe(
      new Date(2026, 8, 27, 14, 30).toISOString(),
    )
    expect(resolveTemplateDate('demain', 'date', today)).toBeNull()
    expect(resolveTemplateDate('2026-02-30', 'date', today)).toBeNull()
  })
})
