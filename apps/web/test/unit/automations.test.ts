import { describe, expect, it } from 'vitest'
import type { Automation, AutomationStep, DescribedBase, Field } from '../../src/lib/api/client'
import {
  END_NODE,
  GAP_Y,
  STEP_SIZE,
  TRIGGER_NODE,
  frameOf,
  layoutFlow,
  mergeOf,
} from '../../src/lib/automation-layout'
import { pickerMatches } from '../../src/lib/automation-picker'
import {
  type Draft,
  type DraftPath,
  type DraftStep,
  STEP_CATEGORIES,
  STEP_HINTS,
  STEP_KEYWORDS,
  STEP_LABELS,
  type StepKind,
  buttonUrl,
  changeableRows,
  citeGroups,
  draftOf,
  draftOfDefinition,
  emptyDraft,
  filterIssue,
  findStep,
  htmlOfText,
  inAttempt,
  inLoop,
  inputOf,
  insertStep,
  jsonBodyIssue,
  loopsAround,
  moveStep,
  newStep,
  notFoundBranch,
  pathProblem,
  pathSummary,
  referencesOf,
  refusalOf,
  removeStep,
  rowChoices,
  runSentence,
  runStepSentence,
  runStepsById,
  slotCaption,
  stepProblem,
  stepSummary,
  stepsAtSlot,
  stepsBefore,
  textOfHtml,
  triggerProblem,
  unavailableSteps,
  withoutCitations,
  withoutJsonCitations,
} from '../../src/lib/automations'
import { pillsToVariables, variablesToPills } from '../../src/lib/rich-text'

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
        retries: 2,
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
      retries: 2,
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
        on_error: 'continue',
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
      // It goes on after a failing row: how many failed.
      { label: 'Nombre de lignes en échec', token: '{{e1.echecs}}' },
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

// ── The triggers, steps and options added with the picker ──────────────────────

/** Invoices and their clients: numbers, dates, a file to keep a PDF in. */
const sales = {
  name: 'b_ventes',
  tables: [
    {
      id: 't1',
      name: 'factures',
      label: 'Factures',
      fields: [
        { name: 'numero', label: 'Numéro', kind: 'short_text' },
        { name: 'montant', label: 'Montant', kind: 'number' },
        { name: 'echeance', label: 'Échéance', kind: 'date' },
        { name: 'rdv', label: 'Rendez-vous', kind: 'datetime' },
        { name: 'pdf', label: 'PDF', kind: 'file' },
        { name: 'client', label: 'Client', kind: 'short_text' },
        {
          name: 'total',
          label: 'Total',
          kind: 'formula',
          computed: { result_kind: 'number', stored: false, multiple: false },
        },
      ],
    },
    {
      id: 't2',
      name: 'clients',
      label: 'Clients',
      fields: [{ name: 'nom', label: 'Nom', kind: 'short_text' }],
    },
  ],
} as unknown as DescribedBase

/** Every new kind of step, and every new option, as the API gives them. */
const everything: Automation = {
  ...automation,
  trigger: { kind: 'record_created', table: 't1', fields: [], schedule: null },
  condition: null,
  actions: [
    {
      id: 'e1',
      kind: 'aggregate',
      table: 't1',
      filter: 'client eq {{client}}',
      measures: [
        { fn: 'sum', field: 'montant' },
        { fn: 'max', field: 'echeance' },
      ],
    },
    {
      id: 'e2',
      kind: 'document',
      record: 'trigger',
      template: 'modele-1',
      field: 'pdf',
      name: 'Facture {{numero}}',
    },
    {
      id: 'e3',
      kind: 'email',
      record: 'trigger',
      users: [],
      user_field: null,
      email_field: null,
      addresses: ['compta@exemple.fr'],
      subject: 'Facture {{numero}}',
      message: '<p>Total : {{e1.somme.montant}}</p>',
      mode: 'together',
      cc: ['direction@exemple.fr'],
      reply_to: '{{client}}',
      format: 'html',
      attachments: [{ step: 'e2' }, { record: 'trigger', field: 'pdf' }],
    },
    {
      id: 'e4',
      kind: 'attempt',
      paths: [
        {
          id: 'c1',
          label: 'Essayer',
          when: null,
          steps: [{ id: 'e5', kind: 'run_automation', automation: 'a2', record: 'trigger' }],
        },
        {
          id: 'c2',
          label: 'En cas d’échec',
          when: null,
          steps: [
            {
              id: 'e6',
              kind: 'notify',
              record: 'trigger',
              users: ['u1'],
              user_field: null,
              message: 'Échec {{e4.erreur}} à {{e4.etape}}',
            },
          ],
        },
      ],
    },
    { id: 'e7', kind: 'wait', duration: { amount: 3, unit: 'days' }, until: null },
    {
      id: 'e8',
      kind: 'wait',
      duration: null,
      until: {
        record: 'trigger',
        field: 'echeance',
        offset_days: -2,
        at: '08:30',
        timezone: 'Europe/Paris',
      },
    },
    {
      id: 'e9',
      kind: 'branch',
      paths: [
        {
          id: 'c3',
          label: 'Gros',
          when: { value: '{{e1.somme.montant}}', op: 'gte', operand: '1000' },
          steps: [],
        },
        {
          id: 'c4',
          label: 'Rien',
          when: { value: '{{e1.nombre}}', op: 'empty', operand: '' },
          steps: [],
        },
        {
          id: 'c5',
          label: 'Sinon',
          when: null,
          steps: [{ id: 'e10', kind: 'delete_record', record: 'trigger' }],
        },
      ],
    },
  ],
}

/** The automation `e5` starts: its trigger has the table of invoices. */
const started = { ...automation, id: 'a2', label: 'Relance', trigger: everything.trigger }

const at = (draft: Draft, id: string) => findStep(draft.steps, id) as DraftStep

describe('the new steps and options', () => {
  const draft = draftOf(everything, sales)

  it('go back to the API as they came, tables by name', () => {
    const out = inputOf(draft).actions as readonly AutomationStep[]
    expect(out).toEqual(
      everything.actions.map((s) => (s.kind === 'aggregate' ? { ...s, table: 'factures' } : s)),
    )
  })

  it('read in the editor with their own words', () => {
    expect(at(draft, 'e3')).toMatchObject({
      mode: 'together',
      cc: 'direction@exemple.fr',
      replyTo: '{{client}}',
      format: 'html',
    })
    expect(at(draft, 'e7')).toMatchObject({ mode: 'duration', amount: 3, unit: 'days' })
    expect(at(draft, 'e8')).toMatchObject({
      mode: 'until',
      record: 'trigger',
      field: 'echeance',
      offsetDays: -2,
      at: '08:30',
    })
    const branch = at(draft, 'e9') as Extract<DraftStep, { kind: 'branch' }>
    expect(branch.paths.map((p) => [p.test, p.otherwise])).toEqual([
      ['value', false],
      ['value', false],
      ['row', true],
    ])
    expect(pathSummary(branch.paths[0] as DraftPath)).toBe('{{e1.somme.montant}} ≥ 1000')
    expect(pathSummary(branch.paths[1] as DraftPath)).toBe('{{e1.nombre}} est vide')
    const members = [] as never[]
    expect(stepSummary(at(draft, 'e7'), draft, sales, members)).toBe('3 jours')
    expect(stepSummary(at(draft, 'e8'), draft, sales, members)).toBe(
      'Jusqu’à Échéance, 2 jours avant',
    )
    expect(stepSummary(at(draft, 'e5'), draft, sales, members, [started])).toBe('Relance')
  })

  it('write a mail in rich text: a plain message opens as paragraphs, and goes back as HTML', () => {
    const plain = {
      ...everything,
      actions: everything.actions.map((s) =>
        s.kind === 'email'
          ? { ...s, format: undefined, message: 'Bonjour {{client}},\n<b>merci</b>' }
          : s,
      ),
    }
    const opened = draftOf(plain, sales)
    expect(at(opened, 'e3')).toMatchObject({
      format: 'html',
      message: '<p>Bonjour {{client}},</p><p>&lt;b&gt;merci&lt;/b&gt;</p>',
    })
    expect(
      (inputOf(opened).actions as readonly AutomationStep[]).find((s) => s.kind === 'email'),
    ).toMatchObject({
      format: 'html',
      message: '<p>Bonjour {{client}},</p><p>&lt;b&gt;merci&lt;/b&gt;</p>',
    })
    expect(newStep('email', opened, sales, 'e99')).toMatchObject({ format: 'html', message: '' })
  })

  it('keep a copy aside while each recipient gets a mail of their own', () => {
    const each = { ...(at(draft, 'e3') as Extract<DraftStep, { kind: 'email' }>), mode: 'each' }
    expect(inputOf({ ...draft, steps: [each as DraftStep] }).actions?.[0]).toMatchObject({
      mode: 'each',
      cc: [],
    })
  })

  it('say nothing is wrong when nothing is', () => {
    for (const step of ['e1', 'e2', 'e3', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10']) {
      expect([step, stepProblem(at(draft, step), draft, [started])]).toEqual([step, null])
    }
  })

  it('cite what each gives, and an attempt’s error only in its second path', () => {
    const groups = citeGroups(draft, sales, stepsBefore(draft.steps, 'e3') ?? [])
    expect(groups.find((g) => g.label === 'e1 · Compter et additionner')?.items).toEqual([
      { label: 'Nombre de lignes', token: '{{e1.nombre}}' },
      { label: 'Somme · Montant', token: '{{e1.somme.montant}}' },
      { label: 'Maximum · Échéance', token: '{{e1.max.echeance}}' },
    ])
    expect(groups.find((g) => g.label === 'e2 · Générer un PDF')?.items).toEqual([
      { label: 'Nom du fichier', token: '{{e2.nom}}' },
    ])
    const rescue = citeGroups(draft, sales, stepsBefore(draft.steps, 'e6') ?? [])
    expect(rescue.find((g) => g.label === 'e4 · Essayer')?.items.map((i) => i.token)).toEqual([
      '{{e4.erreur}}',
      '{{e4.etape}}',
    ])
    expect(stepsBefore(draft.steps, 'e5')?.map((s) => s.id)).toEqual(['e1', 'e2', 'e3'])
    // After the block, neither path surely ran; what failed, if anything, is cited still.
    expect(stepsBefore(draft.steps, 'e7')?.map((s) => s.id)).toEqual(['e1', 'e2', 'e3', 'e4'])
    const tried = insertStep(draft.steps, 'c1', 1, {
      ...(at(draft, 'e6') as DraftStep),
      id: 'e11',
    })
    expect(stepProblem(findStep(tried, 'e11') as DraftStep, { ...draft, steps: tried })).toMatch(
      /e4/,
    )
  })

  it('names what a mail attaches among what it refers to', () => {
    expect(referencesOf(at(draft, 'e3'))).toEqual(['e2', 'e1'])
  })

  it('says what is wrong before the API does', () => {
    const problem = (step: DraftStep) => stepProblem(step, draft, [started])
    const mail = at(draft, 'e3') as Extract<DraftStep, { kind: 'email' }>
    expect(problem({ ...mail, cc: 'pas une adresse' })).toMatch(/copie/)
    expect(problem({ ...mail, replyTo: 'quelqu’un' })).toMatch(/Répondre à/)
    expect(problem({ ...mail, message: '<p></p>' })).toBe('Message vide')
    expect(
      problem({
        ...mail,
        addresses: Array.from({ length: 51 }, (_, i) => `p${i}@exemple.fr`).join(', '),
      }),
    ).toMatch(/50/)
    const wait = at(draft, 'e7') as Extract<DraftStep, { kind: 'wait' }>
    expect(problem({ ...wait, amount: 400 })).toMatch(/365/)
    expect(problem({ ...wait, amount: 0 })).toMatch(/365/)
    expect(problem({ ...(at(draft, 'e8') as DraftStep), field: '' } as DraftStep)).toMatch(
      /champ date/,
    )
    const count = at(draft, 'e1') as Extract<DraftStep, { kind: 'aggregate' }>
    expect(problem({ ...count, measures: [{ fn: 'sum', field: '' }] })).toMatch(/mesure/)
    const run = at(draft, 'e5') as Extract<DraftStep, { kind: 'run_automation' }>
    expect(problem({ ...run, automation: '' })).toMatch(/Choisissez/)
    expect(problem({ ...run, record: '' })).toMatch(/ligne/)
    expect(stepProblem(run, draft, [])).toMatch(/n’existe plus/)
    // Not known yet: the kernel judges.
    expect(stepProblem({ ...run, record: '' }, draft, null)).toBeNull()
    expect(problem({ ...(at(draft, 'e2') as DraftStep), record: '' } as DraftStep)).toMatch(/PDF/)
    const branch = at(draft, 'e9') as Extract<DraftStep, { kind: 'branch' }>
    const [big] = branch.paths
    expect(pathProblem({ ...(big as DraftPath), value: ' ' }, draft)).toMatch(/aucune valeur/)
    expect(pathProblem({ ...(big as DraftPath), operand: '' }, draft)).toMatch(/comparer/)
    expect(pathProblem({ ...(big as DraftPath), op: 'not_empty', operand: '' }, draft)).toBeNull()
  })

  it('makes each new kind preset on what is there', () => {
    const kinds: StepKind[] = [
      'delete_record',
      'aggregate',
      'run_automation',
      'document',
      'wait',
      'attempt',
    ]
    const made = kinds.map((k, i) => newStep(k, draft, sales, `e${20 + i}`))
    expect(made).toMatchObject([
      { kind: 'delete_record', record: 'trigger' },
      { kind: 'aggregate', table: 'factures', filter: '', measures: [] },
      { kind: 'run_automation', automation: '', record: '' },
      { kind: 'document', record: 'trigger', template: '', field: '', name: '' },
      { kind: 'wait', mode: 'duration', amount: 1, unit: 'days' },
      {
        kind: 'attempt',
        paths: [
          { id: 'c6', label: 'Essayer', otherwise: false },
          { id: 'c7', label: 'En cas d’échec', otherwise: false },
        ],
      },
    ])
    // An attempt sent: two paths, no test.
    expect(inputOf({ ...draft, steps: [made[5] as DraftStep] }).actions?.[0]).toEqual({
      id: 'e25',
      kind: 'attempt',
      paths: [
        { id: 'c6', label: 'Essayer', when: null, steps: [] },
        { id: 'c7', label: 'En cas d’échec', when: null, steps: [] },
      ],
    })
  })

  it('draws an attempt like a branch: two paths side by side, meeting below', () => {
    const { nodes, edges } = layoutFlow(draft)
    const node = (id: string) => nodes.find((n) => n.id === id)
    expect(node('c1')?.y).toBe(node('c2')?.y)
    expect((node('c1')?.x ?? 0) < (node('c2')?.x ?? 0)).toBe(true)
    expect(edges.filter((e) => e.source === 'e4').map((e) => [e.target, e.bend])).toEqual([
      ['c1', 'source'],
      ['c2', 'source'],
    ])
    expect(edges.filter((e) => e.target === mergeOf('e4')).map((e) => e.insert)).toEqual([
      { path: 'c1', index: 1 },
      { path: 'c2', index: 1 },
    ])
    expect(edges.find((e) => e.target === 'e7')?.source).toBe(mergeOf('e4'))
  })

  it('says where a step goes, and what may not go there', () => {
    expect(slotCaption(draft, { path: null, index: 0 })).toBe('Juste après le déclencheur')
    expect(slotCaption(draft, { path: null, index: 1 })).toBe('Après e1 · Compter et additionner')
    expect(slotCaption(draft, { path: 'c2', index: 0 })).toBe(
      'Au début du chemin « En cas d’échec »',
    )
    expect(inAttempt(draft.steps, 'c2')).toBe(true)
    expect(unavailableSteps(draft.steps, 'c2')).toEqual({ wait: 'Pas d’attente dans « Essayer »' })
    expect(unavailableSteps(draft.steps, null)).toEqual({})
    const waiting = insertStep(draft.steps, 'c1', 0, newStep('wait', draft, sales, 'e30'))
    expect(stepProblem(findStep(waiting, 'e30') as DraftStep, { ...draft, steps: waiting })).toBe(
      'Pas d’attente dans « Essayer »',
    )
  })
})

describe('the steps that may not go everywhere', () => {
  it('keeps waits and loops out of loops, and three levels at most', () => {
    const looped = draftOf(
      {
        ...automation,
        actions: [{ id: 'e1', kind: 'for_each', table: 't1', filter: '', sort: null, steps: [] }],
      },
      base,
    )
    expect(unavailableSteps(looped.steps, 'e1')).toEqual({
      for_each: 'Pas de boucle dans une boucle',
      wait: 'Pas d’attente dans une boucle',
    })
    const waiting = insertStep(looped.steps, 'e1', 0, newStep('wait', looped, base, 'e2'))
    expect(stepProblem(findStep(waiting, 'e2') as DraftStep, { ...looped, steps: waiting })).toBe(
      'Pas d’attente dans une boucle',
    )

    // Conditions within conditions, three deep.
    let draft: Draft = { ...emptyDraft(base), steps: [] }
    let path: string | null = null
    for (const id of ['e1', 'e2', 'e3']) {
      const branch = newStep('branch', draft, base, id) as Extract<DraftStep, { kind: 'branch' }>
      draft = { ...draft, steps: insertStep(draft.steps, path, 0, branch) }
      path = branch.paths[0]?.id ?? null
    }
    expect(unavailableSteps(draft.steps, path)).toMatchObject({
      branch: '3 niveaux imbriqués au plus',
      attempt: '3 niveaux imbriqués au plus',
      for_each: '3 niveaux imbriqués au plus',
    })
    const deep = insertStep(draft.steps, path, 0, newStep('attempt', draft, base, 'e4'))
    expect(stepProblem(findStep(deep, 'e4') as DraftStep, { ...draft, steps: deep })).toMatch(
      /niveaux/,
    )
  })
})

describe('the new triggers', () => {
  const on = (trigger: Automation['trigger'], actions: Automation['actions'] = []) =>
    draftOf({ ...automation, trigger, condition: null, actions }, base)

  it('a row deleted: cited as it was, never changed', () => {
    const draft = on({ kind: 'record_deleted', table: 't1', fields: [], schedule: null }, [
      { id: 'e1', kind: 'update_record', record: 'trigger', values: { nom: 'x' } },
    ])
    expect(inputOf(draft).trigger).toMatchObject({ kind: 'record_deleted', table: 'taches' })
    expect(stepProblem(at(draft, 'e1'), draft)).toMatch(/supprimée/)
    expect(newStep('delete_record', draft, base, 'e2')).toMatchObject({ record: '' })
    expect(newStep('notify', draft, base, 'e2')).toMatchObject({ record: 'trigger' })
    expect(changeableRows(draft, rowChoices(draft, base, []))).toEqual([])
    expect(citeGroups(draft, base, [])[0]?.label).toBe('La ligne supprimée, telle qu’elle était')
  })

  it('a row entering a filter: the filter is required', () => {
    const draft = on({ kind: 'record_matches', table: 't1', fields: [], schedule: null })
    expect(triggerProblem(draft)).toMatch(/filtre/)
    const filled = { ...draft, condition: 'statut eq "retard"' }
    expect(triggerProblem(filled)).toBeNull()
    expect(inputOf(filled).condition).toBe('statut eq "retard"')
  })

  it('a date reached: its field, days before or after, a time, a zone — both ways', () => {
    const draft = draftOf(
      {
        ...automation,
        condition: null,
        actions: [],
        trigger: {
          kind: 'date_reached',
          table: 't1',
          fields: [],
          schedule: null,
          date: { field: 'echeance', offset_days: -3, at: '08:30', timezone: 'Europe/Paris' },
        },
      },
      sales,
    )
    expect(draft.trigger.date).toEqual({
      field: 'echeance',
      offsetDays: -3,
      at: '08:30',
      timezone: 'Europe/Paris',
    })
    expect(inputOf(draft).trigger).toEqual({
      kind: 'date_reached',
      table: 'factures',
      fields: [],
      schedule: null,
      date: { field: 'echeance', offset_days: -3, at: '08:30', timezone: 'Europe/Paris' },
    })
    expect(triggerProblem(draft)).toBeNull()
    const set = (date: Partial<Draft['trigger']['date']>) => ({
      ...draft,
      trigger: { ...draft.trigger, date: { ...draft.trigger.date, ...date } },
    })
    expect(triggerProblem(set({ field: '' }))).toMatch(/champ date/)
    expect(triggerProblem(set({ offsetDays: 400 }))).toMatch(/365/)
    expect(triggerProblem(set({ at: '25:00' }))).toMatch(/Heure/)
    // Any other trigger sends no date.
    expect(
      inputOf({ ...draft, trigger: { ...draft.trigger, kind: 'record_created' } }).trigger,
    ).not.toHaveProperty('date')
  })

  it('a webhook received: no table, no condition, its body cited by key', () => {
    const draft = {
      ...on({ kind: 'webhook', table: null, fields: [], schedule: null }, [
        {
          id: 'e1',
          kind: 'create_record',
          table: 't2',
          values: { entree: '{{trigger.client.nom}} : {{trigger.montant}}' },
        },
      ]),
      condition: 'x eq 1',
    }
    expect(inputOf(draft)).toMatchObject({
      trigger: { kind: 'webhook', table: null },
      condition: null,
    })
    expect(citeGroups(draft, base, [])[0]).toEqual({
      label: 'La requête reçue',
      items: [
        { label: 'client.nom', token: '{{trigger.client.nom}}' },
        { label: 'montant', token: '{{trigger.montant}}' },
        { label: 'Le corps, s’il est du texte', token: '{{trigger.texte}}' },
      ],
    })
    expect(referencesOf(at(draft, 'e1'))).toEqual([])
    expect(stepProblem(at(draft, 'e1'), draft)).toBeNull()
    expect(rowChoices(draft, base, [])).toEqual([])
    expect(newStep('update_record', draft, base, 'e2')).toMatchObject({ record: '' })
  })
})

describe('« Si aucune ligne n’est trouvée… »', () => {
  it('inserts after a search a condition testing that it found nothing', () => {
    const draft = draftOf(flow, base)
    const branch = notFoundBranch(draft, 'e1', 'e9') as Extract<DraftStep, { kind: 'branch' }>
    expect(branch.paths).toMatchObject([
      { label: 'Aucune ligne trouvée', test: 'value', value: '{{e1._id}}', op: 'empty' },
      { label: 'Ligne trouvée', otherwise: true },
    ])
    const steps = insertStep(draft.steps, null, 1, branch)
    const next = { ...draft, steps }
    expect(pathProblem(branch.paths[0] as DraftPath, next)).toBeNull()
    expect(inputOf(next).actions?.[1]).toMatchObject({
      id: 'e9',
      kind: 'branch',
      paths: [{ when: { value: '{{e1._id}}', op: 'empty', operand: '' } }, { when: null }],
    })
  })
})

describe('a run held by a wait', () => {
  it('says when it goes on, and how the new steps went', () => {
    expect(
      runSentence({ status: 'waiting', resume_at: '2026-10-03T07:00:00Z' } as Parameters<
        typeof runSentence
      >[0]),
    ).toMatch(/^En pause, reprend le .*2026/)
    expect(
      runSentence({ status: 'skipped', reason: 'regle_de_lignes' } as Parameters<
        typeof runSentence
      >[0]),
    ).toMatch(/règle de lignes/)
    expect(
      runStepSentence({
        step: 'e7',
        kind: 'wait',
        status: 'succeeded',
        detail: '2026-10-03T07:00:00Z',
      }),
    ).toMatch(/^attente jusqu’au /)
    expect(
      runStepSentence({ step: 'e7', kind: 'wait', status: 'succeeded', detail: 'aucune_date' }),
    ).toMatch(/aucune date/)
    // An attempt names the path it ended on.
    expect(
      runStepSentence({
        step: 'e4',
        kind: 'attempt',
        status: 'succeeded',
        path: 'c2',
        detail: 'En cas d’échec',
      }),
    ).toBe('chemin « En cas d’échec »')
    // A loop going on after failing rows says `turns/failures`.
    expect(
      runStepSentence({ step: 'e1', kind: 'for_each', status: 'succeeded', detail: '10/2' }),
    ).toBe('10 lignes parcourues · 2 en échec')
    expect(
      runStepSentence({ step: 'e1', kind: 'for_each', status: 'succeeded', detail: '10' }),
    ).toBe('10 lignes parcourues')
    expect(
      runStepSentence({
        step: 'e5',
        kind: 'run_automation',
        status: 'failed',
        error_code: 'REQUEST_INVALID',
        detail: 'chaine_trop_longue',
      }),
    ).toMatch(/trop d’automatisations/)
  })
})

describe('the refusals of the new definitions', () => {
  it('each says what to do in a sentence', () => {
    const reasons = [
      'ligne_supprimee',
      'condition_requise',
      'champ_date_attendu',
      'decalage_invalide',
      'attente_invalide',
      'attente_dans_boucle',
      'attente_dans_essai',
      'automation_inconnue',
      'automation_elle_meme',
      'ligne_requise',
      'table_differente',
      'modele_inconnu',
      'champ_fichier_attendu',
      'mesure_invalide',
      'trop_de_mesures',
      'piece_jointe_invalide',
      'trop_de_pieces_jointes',
      'copie_sans_envoi_groupe',
      'reponse_a_invalide',
      'essai_deux_chemins',
      'operateur_inconnu',
      'reessais_invalides',
    ]
    for (const reason of reasons) {
      expect([reason, refusalOf({ reason, detail: 'x', step: 'e2' }).sentence]).not.toEqual([
        reason,
        null,
      ])
    }
    expect(refusalOf({ reason: 'trop_de_mesures', detail: 5 }).sentence).toBe('5 mesures au plus.')
  })
})

describe('a mail written out', () => {
  it('turns from plain text to rich text and back', () => {
    const html = htmlOfText('Bonjour {{nom}},\n<b>merci</b> & à bientôt')
    expect(html).toBe('<p>Bonjour {{nom}},</p><p>&lt;b&gt;merci&lt;/b&gt; &amp; à bientôt</p>')
    expect(textOfHtml(html)).toBe('Bonjour {{nom}},\n<b>merci</b> & à bientôt')
    expect(textOfHtml('<ul><li>un</li><li>deux</li></ul>')).toBe('- un\n- deux')
  })

  it('cites a step’s value or a key of the request as a pill', () => {
    const stored = '<p>{{e2.nom}} — {{trigger.client.Nom}} — {{nom}}</p>'
    const editable = variablesToPills(stored)
    expect(editable).toBe(
      '<p><span data-variable="e2.nom"></span> — <span data-variable="trigger.client.Nom"></span> — <span data-variable="nom"></span></p>',
    )
    expect(pillsToVariables(editable)).toBe(stored)
  })
})

describe('the step picker', () => {
  const entries = STEP_CATEGORIES.flatMap((c) =>
    c.kinds.map((kind) => ({
      id: kind,
      category: c.id,
      label: STEP_LABELS[kind],
      hint: STEP_HINTS[kind],
      keywords: STEP_KEYWORDS[kind],
    })),
  )
  const first = (query: string) => pickerMatches(entries, query, null).matches[0]?.entry.id

  it('lists every step by category while nothing is typed', () => {
    const all = pickerMatches(entries, '', null)
    expect(all.total).toBe(16)
    expect(all.matches.map((m) => m.entry.id)).toEqual(entries.map((e) => e.id))
    expect(all.counts).toEqual({ rows: 5, communicate: 4, documents: 1, ai: 1, logic: 5 })
    expect(pickerMatches(entries, '', 'logic').matches.map((m) => m.entry.id)).toEqual([
      'branch',
      'for_each',
      'attempt',
      'wait',
      'run_automation',
    ])
  })

  it('finds a step by its name, what it does, or a word it answers to — accents aside', () => {
    expect(first('courriel')).toBe('email')
    expect(first('facture')).toBe('document')
    expect(first('generer')).toBe('document')
    expect(first('boucle')).toBe('for_each')
    expect(first('corbeille')).toBe('delete_record')
    expect(first('attendre')).toBe('wait')
    expect(first('somme')).toBe('aggregate')
    expect(pickerMatches(entries, 'zzzz', null).total).toBe(0)
    const found = pickerMatches(entries, 'pdf', null)
    expect(found.counts).toEqual({ documents: 1 })
    expect([...(found.matches[0]?.lit ?? [])]).toEqual([11, 12, 13])
  })
})
