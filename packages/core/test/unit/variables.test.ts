import { describe, expect, it } from 'vitest'
import {
  type VariableColumn,
  type VariableScope,
  citedNames,
  hasVariables,
  resolveText,
} from '../../src/records/variables.js'

/**
 * Variables in a long text — chapter 04 §2.2. A citation reads the row's value as the
 * reader sees it; a column the reader cannot see gives nothing, name included; a citation
 * that names no column is just text; and in a rich text, a value is never markup.
 */

const column = (name: string, kind: string, rich = false): [string, VariableColumn] => [
  name,
  { name, kind, rich },
]

const scope = (overrides: Partial<VariableScope> = {}): VariableScope => ({
  readable: new Map([
    column('ville', 'short_text'),
    column('statut', 'select'),
    column('livraison', 'date'),
    column('rendez_vous', 'datetime'),
    column('client', 'link'),
    column('responsable', 'user'),
    column('montant', 'number'),
    column('payee', 'boolean'),
    column('notes', 'long_text'),
    column('contenu', 'long_text', true),
  ]),
  known: new Set([
    'ville',
    'statut',
    'livraison',
    'rendez_vous',
    'client',
    'responsable',
    'montant',
    'payee',
    'notes',
    'contenu',
    'salaire',
  ]),
  labels: new Map([['statut', new Map([['a_faire', 'À faire']])]]),
  people: new Map([['01a0e1eb-b1e6-74a0-84ea-fbf5838b4bc6', 'Camille Durand']]),
  dateFormat: 'dmy',
  timezone: 'Europe/Paris',
  ...overrides,
})

const row = {
  ville: 'Lyon',
  statut: 'a_faire',
  livraison: '2026-10-02',
  rendez_vous: '2026-10-02T12:30:00.000Z',
  client: { id: 'x', display: 'Maison Verte' },
  responsable: '01a0e1eb-b1e6-74a0-84ea-fbf5838b4bc6',
  montant: '1250.5000',
  payee: false,
  notes: 'Voir {{contenu}}',
  contenu: '<p>Un <strong>mot</strong></p>',
  salaire: '9000',
}

describe('resolveText', () => {
  it('reads each value as a sentence does', () => {
    expect(
      resolveText(
        '{{ville}}, {{ statut }}, le {{livraison}} à {{rendez_vous}} pour {{client}} — {{responsable}}, {{montant}} €, payée : {{payee}}',
        row,
        scope(),
        false,
      ),
    ).toBe(
      'Lyon, À faire, le 02/10/2026 à 02/10/2026 14:30 pour Maison Verte — Camille Durand, 1250.5 €, payée : non',
    )
  })

  it('follows the reader’s order of dates', () => {
    expect(resolveText('{{livraison}}', row, scope({ dateFormat: 'iso' }), false)).toBe(
      '2026-10-02',
    )
  })

  it('gives nothing for a column the reader cannot see — not even its name', () => {
    expect(resolveText('Salaire : {{salaire}}.', row, scope(), false)).toBe('Salaire : .')
  })

  it('leaves a citation that names no column as it was written', () => {
    expect(resolveText('Bonjour {{prenom_inconnu}}', row, scope(), false)).toBe(
      'Bonjour {{prenom_inconnu}}',
    )
  })

  it('escapes what it inserts into a rich text', () => {
    const hostile = { ...row, ville: '<img src=x onerror=alert(1)>' }
    expect(resolveText('<p>{{ville}}</p>', hostile, scope(), true)).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    )
  })

  it('inserts a cited rich text as words, and does not follow what it cites', () => {
    expect(resolveText('{{contenu}}', row, scope(), false)).toBe('Un mot')
    const chained = { ...row, notes: 'A {{ville}} B' }
    expect(resolveText('[{{notes}}]', chained, scope(), false)).toBe('[A  B]')
  })
})

describe('citations', () => {
  it('are found, and only when they name a column the way a name is written', () => {
    expect(hasVariables('rien')).toBe(false)
    expect(hasVariables('{{ Ville }}')).toBe(false)
    expect(hasVariables('{{ville}}')).toBe(true)
    expect([...citedNames(['{{a}} {{b}}', '{{ a }}'])]).toEqual(['a', 'b'])
  })
})
