import { describe, expect, it } from 'vitest'
import type { Automation, DescribedBase, Field } from '../../src/lib/api/client'
import {
  END_NODE,
  GAP_Y,
  STEP_SIZE,
  TRIGGER_NODE,
  frameOf,
  layoutFlow,
  mergeOf,
} from '../../src/lib/automation-layout'
import {
  type Draft,
  type DraftStep,
  buttonUrl,
  citeGroups,
  draftOf,
  draftOfDefinition,
  emptyDraft,
  filterIssue,
  findStep,
  inLoop,
  inputOf,
  insertStep,
  jsonBodyIssue,
  loopsAround,
  moveStep,
  newStep,
  referencesOf,
  removeStep,
  rowChoices,
  runSentence,
  runStepSentence,
  runStepsById,
  stepProblem,
  stepsAtSlot,
  stepsBefore,
  withoutCitations,
  withoutJsonCitations,
} from '../../src/lib/automations'

/**
 * Automations as the editor shows them — chapter 17.
 *
 * What these guard: what the editor shows goes back to the API unchanged — tables by name
 * on the way in, by key on the way out, a flow's branches and paths with their
 * identifiers; a definition from before flows gets identifiers and acts on the triggering
 * row; a schedule carries no condition; a step sees — to cite, to act on — only the steps
 * passed on every way to it; an AI step is cited by its answer, and asks again for the
 * consent when its prompt changes; the flow is laid out as a tree whose paths meet again;
 * a button's address is composed from what the reader sees.
 */

const base = {
  name: 'b_projet',
  tables: [
    {
      id: 't1',
      name: 'taches',
      label: 'Tâches',
      fields: [
        { name: 'nom', label: 'Nom', kind: 'short_text' },
        { name: 'statut', label: 'Statut', kind: 'select' },
      ],
    },
    {
      id: 't2',
      name: 'journal',
      label: 'Journal',
      fields: [{ name: 'entree', label: 'Entrée', kind: 'short_text' }],
    },
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

/** Find a journal entry; if found, rewrite it, otherwise write one; then notify. */
const flow: Automation = {
  ...automation,
  actions: [
    { id: 'e1', kind: 'find_record', table: 't2', filter: 'entree eq {{nom}}', sort: null },
    {
      id: 'e2',
      kind: 'branch',
      paths: [
        {
          id: 'c1',
          label: 'Trouvée',
          when: { record: 'e1', condition: '' },
          steps: [{ id: 'e3', kind: 'update_record', record: 'e1', values: { entree: 'bis' } }],
        },
        {
          id: 'c2',
          label: 'Sinon',
          when: null,
          steps: [{ id: 'e4', kind: 'create_record', table: 't2', values: { entree: '{{nom}}' } }],
        },
      ],
    },
    { id: 'e5', kind: 'notify', record: 'trigger', users: ['u1'], user_field: null, message: 'ok' },
  ],
}

describe('the automation editor', () => {
  it('shows tables by name, values as rows, and saves them back', () => {
    const draft = draftOf(automation, base)
    expect(draft.trigger.table).toBe('taches')
    // Saved before flows: numbered in order, acting on the triggering row.
    expect(draft.steps[0]).toEqual({
      id: 'e1',
      kind: 'update_record',
      record: 'trigger',
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
      id: 'e2',
      kind: 'create_record',
      table: 'journal',
      values: { entree: '{{nom}}' },
    })
    expect(input.actions?.[2]).toEqual({
      id: 'e3',
      kind: 'notify',
      record: 'trigger',
      users: ['u1'],
      user_field: null,
      message: 'Fini',
    })
    // A Slack connection is named by its identifier, both ways.
    expect(input.actions?.[3]).toEqual({
      id: 'e4',
      kind: 'slack',
      integration: 'i1',
      message: '{{nom}} est close',
    })
  })

  it('keeps a flow’s branches, paths and identifiers, both ways', () => {
    const draft = draftOf(flow, base)
    expect(draft.steps[1]).toMatchObject({
      id: 'e2',
      kind: 'branch',
      paths: [
        { id: 'c1', label: 'Trouvée', otherwise: false, record: 'e1', condition: '' },
        { id: 'c2', label: 'Sinon', otherwise: true },
      ],
    })
    const out = inputOf(draft).actions
    expect(out?.[0]).toEqual({
      id: 'e1',
      kind: 'find_record',
      table: 'journal',
      filter: 'entree eq {{nom}}',
      sort: null,
    })
    expect(out?.[1]).toEqual({
      id: 'e2',
      kind: 'branch',
      paths: [
        {
          id: 'c1',
          label: 'Trouvée',
          when: { record: 'e1', condition: '' },
          steps: [{ id: 'e3', kind: 'update_record', record: 'e1', values: { entree: 'bis' } }],
        },
        {
          id: 'c2',
          label: 'Sinon',
          when: null,
          steps: [
            { id: 'e4', kind: 'create_record', table: 'journal', values: { entree: '{{nom}}' } },
          ],
        },
      ],
    })
    expect(out?.[2]).toEqual(flow.actions[2])
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

  it('says why a run did nothing, and which run step is which', () => {
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
    const steps = draftOf(automation, base).steps
    // A run from before flows names no step: its steps are the first level's, in order.
    const old = runStepsById(
      { steps: [{ action: 'update_record', status: 'succeeded' }] } as never,
      steps,
    )
    expect([...old.keys()]).toEqual(['e1'])
  })
})

describe('editing the flow', () => {
  const draft = draftOf(flow, base)
  const step = (id: string): DraftStep => ({
    ...newStep('webhook', draft, base, id),
    url: 'https://x',
  })

  it('inserts, moves and removes a step in its own sequence, a path’s included', () => {
    const inPath = insertStep(draft.steps, 'c2', 0, step('e9'))
    const branch = inPath[1] as Extract<DraftStep, { kind: 'branch' }>
    expect(branch.paths[1]?.steps.map((s) => s.id)).toEqual(['e9', 'e4'])
    const moved = moveStep(inPath, 'e9', 1)
    expect(
      (moved[1] as Extract<DraftStep, { kind: 'branch' }>).paths[1]?.steps.map((s) => s.id),
    ).toEqual(['e4', 'e9'])
    // Past its own sequence, nowhere to go.
    expect(moveStep(moved, 'e9', 1)).toEqual(moved)
    expect(removeStep(moved, 'e9')).toEqual(draft.steps)
  })

  it('makes a branch with its path and its « Sinon », fresh identifiers', () => {
    const branch = newStep('branch', draft, base, 'e6')
    expect(branch).toMatchObject({
      kind: 'branch',
      paths: [
        { id: 'c3', otherwise: false, record: 'trigger' },
        { id: 'c4', label: 'Sinon', otherwise: true },
      ],
    })
  })

  it('lets a step see only the steps passed on every way to it', () => {
    expect(stepsBefore(draft.steps, 'e3')?.map((s) => s.id)).toEqual(['e1'])
    // After the branch, what its paths wrote may not have been written.
    expect(stepsBefore(draft.steps, 'e5')?.map((s) => s.id)).toEqual(['e1'])
    // A path's test sees what came before its branch.
    expect(stepsBefore(draft.steps, 'c1')?.map((s) => s.id)).toEqual(['e1'])
    expect(stepsAtSlot(draft.steps, 'c2', 1).map((s) => s.id)).toEqual(['e1', 'e4'])

    const before = stepsAtSlot(draft.steps, 'c2', 1)
    expect(rowChoices(draft, base, before).map((c) => [c.value, c.table])).toEqual([
      ['trigger', 'taches'],
      ['e1', 'journal'],
      ['e4', 'journal'],
    ])
    const cited = citeGroups(draft, base, before)
    expect(cited.map((g) => g.label)).toEqual([
      'La ligne déclencheuse',
      'e1 · Chercher une ligne',
      'e4 · Créer une ligne',
      'Autre',
    ])
    expect(cited[1]?.items.map((i) => i.token)).toEqual(['{{e1.entree}}', '{{e1._id}}'])
  })
})

describe('an AI step', () => {
  const draft = draftOf(
    {
      ...automation,
      actions: [
        {
          id: 'e1',
          kind: 'ai',
          prompt: 'Classe {{nom}}',
          answer: 'select',
          options: ['Urgent', 'Normal'],
          consent: true,
        },
        { id: 'e2', kind: 'update_record', record: 'trigger', values: { note: '{{e1.reponse}}' } },
      ],
    },
    base,
  )

  it('keeps its prompt, its answer and its choices, both ways', () => {
    expect(draft.steps[0]).toEqual({
      id: 'e1',
      kind: 'ai',
      prompt: 'Classe {{nom}}',
      answer: 'select',
      options: ['Urgent', 'Normal'],
      consent: true,
    })
    // Blank lines typed among the choices do not travel.
    const typed = {
      ...draft,
      steps: [{ ...(draft.steps[0] as DraftStep), options: ['Urgent', '', ' Normal '] }],
    }
    expect(inputOf(typed as never).actions?.[0]).toMatchObject({ options: ['Urgent', 'Normal'] })
  })

  it('is cited by its answer, and says what it lacks', () => {
    const cited = citeGroups(draft, base, stepsBefore(draft.steps, 'e2') ?? [])
    expect(cited.find((g) => g.label === 'e1 · Demander à l’IA')?.items).toEqual([
      { label: 'Sa réponse', token: '{{e1.reponse}}' },
    ])
    const fresh = newStep('ai', draft, base, 'e3')
    expect(stepProblem(fresh, draft)).toBe('Consigne vide')
    expect(stepProblem({ ...fresh, prompt: 'Résume {{nom}}' } as DraftStep, draft)).toMatch(
      /Accord/,
    )
  })
})

describe('what the copilot proposes', () => {
  it('reads in the editor as a draft, tables by name, its AI steps still to consent to', () => {
    const draft = draftOfDefinition(
      {
        label: 'Tâche à relire',
        description: null,
        enabled: true,
        trigger: { kind: 'record_updated', table: 't1', fields: ['statut'], schedule: null },
        condition: 'statut eq "en_revue"',
        actions: [
          { id: 'e1', kind: 'ai', prompt: 'Résume {{nom}}', answer: 'short_text', consent: false },
          { id: 'e2', kind: 'update_record', record: 'trigger', values: { nom: '{{e1.reponse}}' } },
        ],
      },
      base,
    )
    expect(draft.trigger).toMatchObject({ kind: 'record_updated', table: 'taches' })
    expect(draft.steps.map((s) => s.id)).toEqual(['e1', 'e2'])
    expect(stepProblem(draft.steps[0] as DraftStep, draft)).toMatch(/Accord/)
  })
})

describe('a filter as it is typed', () => {
  const fields = [
    { name: 'titre', label: 'Titre', kind: 'short_text', operators: ['eq', 'ne', 'contains'] },
    { name: 'projets_id', label: 'Projet', kind: 'link', operators: ['eq', 'ne', 'is_null'] },
    { name: '_id', label: 'Identifiant', kind: 'system', system: true, operators: [] },
  ] as unknown as Field[]

  it('stands in for a citation where the run will put a text', () => {
    expect(withoutCitations('projets_id eq {{projets_id}}')).toBe('projets_id eq "x"')
    expect(withoutCitations('titre contains "a {{e2.titre}} b"')).toBe('titre contains "a x b"')
  })

  it('names an unknown field or an operator the type refuses, citations and _id aside', () => {
    expect(filterIssue('projets_id eq {{projets_id}} and titre ne "x"', fields)).toBeNull()
    expect(filterIssue('_id eq {{e2.projets_id}}', fields)).toBeNull()
    expect(filterIssue('projet eq {{projets_id}}', fields)).toMatch(/Champ inconnu/)
    expect(filterIssue('titre neq "x"', fields)).toMatch(/neq/)
    expect(filterIssue('titre eq', fields)).toMatch(/illisible/)
  })
})

describe('the flow on the canvas', () => {
  it('stacks a simple automation under its trigger, with the button that adds a step', () => {
    const { nodes, edges } = layoutFlow(draftOf(automation, base))
    expect(nodes.map((n) => [n.id, n.y])).toEqual([
      [TRIGGER_NODE, 0],
      ['e1', STEP_SIZE.h + GAP_Y],
      ['e2', 2 * (STEP_SIZE.h + GAP_Y)],
      ['e3', 3 * (STEP_SIZE.h + GAP_Y)],
      ['e4', 4 * (STEP_SIZE.h + GAP_Y)],
      [END_NODE, 5 * (STEP_SIZE.h + GAP_Y)],
    ])
    // Each edge between two pieces inserts there; the last one leads to the button.
    expect(edges.map((e) => e.insert?.index ?? null)).toEqual([0, 1, 2, 3, null])
  })

  it('opens a branch’s paths side by side, and has them meet below it', () => {
    const { nodes, edges } = layoutFlow(draftOf(flow, base))
    const at = (id: string) => nodes.find((n) => n.id === id)
    const c1 = at('c1')
    const c2 = at('c2')
    expect(c1?.y).toBe(c2?.y)
    expect((c1?.x ?? 0) < (c2?.x ?? 0)).toBe(true)
    // Symmetric around the branch.
    expect((c1?.x ?? 0) + (c2?.x ?? 0) + (c2?.w ?? 0)).toBe(0)
    const merge = at(mergeOf('e2'))
    expect((merge?.y ?? 0) > (at('e3')?.y ?? 0)).toBe(true)
    expect(at('e5')?.y).toBeGreaterThan(merge?.y ?? 0)
    expect(edges.filter((e) => e.target === mergeOf('e2')).map((e) => e.insert)).toEqual([
      { path: 'c1', index: 1 },
      { path: 'c2', index: 1 },
    ])
    expect(edges.find((e) => e.target === 'e5')?.source).toBe(mergeOf('e2'))
  })

  it('keeps an empty path open to a first step', () => {
    const draft: Draft = {
      ...draftOf(flow, base),
      steps: [newStep('branch', emptyDraft(base), base, 'e1')],
    }
    const { edges } = layoutFlow(draft)
    expect(
      edges.filter((e) => e.target === mergeOf('e1')).map((e) => [e.source, e.insert]),
    ).toEqual([
      ['c1', { path: 'c1', index: 0 }],
      ['c2', { path: 'c2', index: 0 }],
    ])
  })
})

describe('a webhook composed', () => {
  const webhook: Automation = {
    ...automation,
    actions: [
      {
        id: 'e1',
        kind: 'webhook',
        record: 'trigger',
        url: 'https://api.exemple.fr/clients/{{nom}}',
        method: 'PUT',
        headers: [
          { name: 'Authorization', value: null, secret: true, host: 'api.exemple.fr' },
          { name: 'X-Trace', value: '{{_id}}', secret: false },
        ],
        body: '{"nom": "{{nom}}"}',
        format: 'json',
      },
    ],
  }

  it('keeps a secret it never saw, and sends back what was typed', () => {
    const draft = draftOf(webhook, base)
    expect(draft.steps[0]).toMatchObject({
      method: 'PUT',
      body: 'json',
      template: '{"nom": "{{nom}}"}',
      headers: [
        { name: 'Authorization', value: '', secret: true, kept: true, host: 'api.exemple.fr' },
        { name: 'X-Trace', value: '{{_id}}', secret: false, kept: false },
      ],
    })
    // Sent back as read: the kept secret without a value, the host left to the kernel.
    expect(inputOf(draft).actions?.[0]).toEqual({
      id: 'e1',
      kind: 'webhook',
      record: 'trigger',
      url: 'https://api.exemple.fr/clients/{{nom}}',
      method: 'PUT',
      headers: [
        { name: 'Authorization', value: null, secret: true },
        { name: 'X-Trace', value: '{{_id}}', secret: false },
      ],
      body: '{"nom": "{{nom}}"}',
      format: 'json',
    })
    // A GET sends no body; a blank header row does not travel.
    const get = {
      ...draft,
      steps: [
        {
          ...(draft.steps[0] as Extract<DraftStep, { kind: 'webhook' }>),
          method: 'GET' as const,
          headers: [{ name: '', value: '', secret: true, kept: false, host: '' }],
        },
      ],
    }
    expect(inputOf(get).actions?.[0]).toMatchObject({ method: 'GET', headers: [], body: null })
  })

  it('says what stops it before the API does', () => {
    const draft = draftOf(webhook, base)
    const step = draft.steps[0] as Extract<DraftStep, { kind: 'webhook' }>
    expect(stepProblem(step, draft)).toBeNull()
    expect(stepProblem({ ...step, url: 'https://{{nom}}.exemple.fr/' }, draft)).toMatch(/hôte/)
    // Another host: the secret kept for the first one must be given again.
    expect(stepProblem({ ...step, url: 'https://autre.exemple.fr/x' }, draft)).toMatch(
      /Authorization/,
    )
    expect(stepProblem({ ...step, template: '{"nom": {{nom}' }, draft)).toMatch(/JSON/)
    const unsaid = { name: 'X-Cle', value: '', secret: true, kept: false, host: '' }
    expect(stepProblem({ ...step, headers: [unsaid] }, draft)).toMatch(/X-Cle/)
  })

  it('reads a citation in a JSON body as the run will put it', () => {
    expect(withoutJsonCitations('{"a": "x {{nom}}", "b": {{montant}}}')).toBe(
      '{"a": "x x", "b": 0}',
    )
    expect(jsonBodyIssue('{"a": "{{nom}}", "b": {{e2.reponse}}}')).toBeNull()
    expect(jsonBodyIssue('{a: 1}')).toMatch(/JSON invalide/)
  })

  it('is cited by its answer, and cites what it sends', () => {
    const draft = draftOf(webhook, base)
    expect(referencesOf(draft.steps[0] as DraftStep)).toEqual([])
    const cites = {
      ...(draft.steps[0] as Extract<DraftStep, { kind: 'webhook' }>),
      url: 'https://api.exemple.fr/{{e7.numero}}',
      template: '{"x": {{e8.total}}}',
    }
    expect(referencesOf(cites)).toEqual(['e7', 'e8'])
  })
})

describe('a loop', () => {
  /** Every morning, for each task to do: note it, and when urgent, write to the journal. */
  const loop: Automation = {
    ...automation,
    trigger: {
      kind: 'schedule',
      table: null,
      fields: [],
      schedule: { every: 'day', at: '08:00', weekday: 1, timezone: 'Europe/Paris' },
    },
    condition: null,
    actions: [
      {
        id: 'e1',
        kind: 'for_each',
        table: 't1',
        filter: 'statut eq "a_faire"',
        sort: '-nom',
        limit: 20,
        steps: [
          { id: 'e2', kind: 'update_record', record: 'e1', values: { nom: '{{e1.nom}} !' } },
          {
            id: 'e3',
            kind: 'branch',
            paths: [
              {
                id: 'c1',
                label: 'Urgente',
                when: { record: 'e1', condition: 'statut eq "urgent"' },
                steps: [
                  {
                    id: 'e4',
                    kind: 'create_record',
                    table: 't2',
                    values: { entree: '{{e1.nom}}' },
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: 'e5', kind: 'create_record', table: 't2', values: { entree: '{{e1.nombre}}' } },
    ],
  }
  const draft = draftOf(loop, base)

  it('keeps its table, filter, order, limit and steps, both ways', () => {
    expect(draft.steps[0]).toMatchObject({
      id: 'e1',
      kind: 'for_each',
      table: 'taches',
      filter: 'statut eq "a_faire"',
      sort: '-nom',
      limit: 20,
    })
    expect(inputOf(draft).actions).toEqual(
      loop.actions.map((s) =>
        s.kind === 'for_each'
          ? { ...s, table: 'taches', steps: expect.any(Array) }
          : { ...s, table: 'journal' },
      ),
    )
    expect((inputOf(draft).actions?.[0] as { steps: unknown[] }).steps[1]).toMatchObject({
      kind: 'branch',
      paths: [{ id: 'c1', steps: [{ id: 'e4', table: 'journal' }] }],
    })
  })

  it('edits its own sequence, and holds what is inserted there', () => {
    const inside = insertStep(draft.steps, 'e1', 0, newStep('notify', draft, base, 'e9'))
    const loopStep = inside[0] as Extract<DraftStep, { kind: 'for_each' }>
    expect(loopStep.steps.map((s) => s.id)).toEqual(['e9', 'e2', 'e3'])
    expect(moveStep(inside, 'e9', 1)[0]).toMatchObject({
      steps: [{ id: 'e2' }, { id: 'e9' }, { id: 'e3' }],
    })
    expect(removeStep(inside, 'e9')).toEqual(draft.steps)
    expect(inLoop(draft.steps, 'e1')).toBe(true)
    expect(inLoop(draft.steps, 'c1')).toBe(true)
    expect(inLoop(draft.steps, null)).toBe(false)
  })

  it('gives its steps the row of the turn, and what follows how many rows it went through', () => {
    // Inside, the loop is passed on every way — and it is around them.
    expect(stepsBefore(draft.steps, 'e4')?.map((s) => s.id)).toEqual(['e1', 'e2'])
    expect(loopsAround(draft.steps, 'e4')).toEqual(['e1'])
    expect(loopsAround(draft.steps, 'e5')).toEqual([])
    const inside = stepsBefore(draft.steps, 'e2') ?? []
    expect(rowChoices(draft, base, inside, ['e1']).map((c) => [c.value, c.table])).toEqual([
      ['e1', 'taches'],
    ])
    expect(citeGroups(draft, base, inside, ['e1'])[0]?.items.map((i) => i.token)).toEqual([
      '{{e1.nom}}',
      '{{e1.statut}}',
      '{{e1._id}}',
    ])
    // After it: no row to act on, how many it went through to cite.
    const after = stepsBefore(draft.steps, 'e5') ?? []
    expect(after.map((s) => s.id)).toEqual(['e1'])
    expect(rowChoices(draft, base, after, [])).toEqual([])
    expect(citeGroups(draft, base, after, [])[0]?.items).toEqual([
      { label: 'Nombre de lignes parcourues', token: '{{e1.nombre}}' },
    ])
    expect(stepsAtSlot(draft.steps, 'e1', 1).map((s) => s.id)).toEqual(['e1', 'e2'])
  })

  it('says what stops it, and how a run went through it', () => {
    const own = draft.steps[0] as Extract<DraftStep, { kind: 'for_each' }>
    expect(stepProblem(own, draft)).toBeNull()
    expect(stepProblem({ ...own, limit: 500 }, draft)).toMatch(/200/)
    const nested = insertStep(draft.steps, 'e1', 0, newStep('for_each', draft, base, 'e9'))
    expect(stepProblem(findStep(nested, 'e9') as DraftStep, { ...draft, steps: nested })).toMatch(
      /boucle/,
    )
    expect(
      runStepSentence({
        step: 'e1',
        kind: 'for_each',
        status: 'succeeded',
        detail: '20',
        more: true,
      }),
    ).toBe('20 lignes parcourues — limite atteinte')
    expect(
      runStepSentence({ step: 'e2', kind: 'update_record', status: 'succeeded', times: 3 }),
    ).toBe('fait · 3 fois')
  })

  it('draws its steps in a frame, from its card down to where a turn ends', () => {
    const { nodes, edges } = layoutFlow(draft)
    const at = (id: string) => nodes.find((n) => n.id === id)
    const frame = at(frameOf('e1'))
    const card = at('e1')
    const end = at(mergeOf('e1'))
    // The frame is laid before the card, so that the card lies over it.
    expect(nodes.findIndex((n) => n.id === frameOf('e1'))).toBeLessThan(
      nodes.findIndex((n) => n.id === 'e1'),
    )
    expect(frame?.y).toBe((card?.y ?? 0) + STEP_SIZE.h / 2)
    expect((frame?.y ?? 0) + (frame?.h ?? 0)).toBeGreaterThan(end?.y ?? 0)
    expect((frame?.x ?? 0) + (frame?.w ?? 0) / 2).toBe(0)
    expect(edges.find((e) => e.source === 'e1')).toMatchObject({
      target: 'e2',
      insert: { path: 'e1', index: 0 },
    })
    expect(edges.find((e) => e.target === mergeOf('e1'))?.insert).toEqual({ path: 'e1', index: 2 })
    // After the loop, the flow goes on from where a turn ends.
    expect(edges.find((e) => e.target === 'e5')?.source).toBe(mergeOf('e1'))
    expect(at('e5')?.y).toBeGreaterThan((frame?.y ?? 0) + (frame?.h ?? 0))
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
