import { describe, expect, it } from 'vitest'
import { type Place, addressOf, placeOf } from '../../src/lib/address-bar'

const ID = '0b6f3c1e-8d2a-4f5b-9c7e-1a2b3c4d5e6f'
const OTHER = '9f8e7d6c-5b4a-4321-8fed-cba987654321'
const TENANT = 't4z56fq'
/** The schema of the base the addresses call `crm`. */
const CRM = `b_${TENANT}_crm`

/** Every kind of place, each as its address writes it. */
const PLACES: ReadonlyArray<readonly [Place, string]> = [
  [{ kind: 'home' }, '/'],
  [{ kind: 'project', project: ID }, `/projets/${ID}`],
  [{ kind: 'base', base: CRM }, '/bases/crm'],
  [
    { kind: 'table', base: CRM, table: 'contacts', view: null, record: null },
    '/bases/crm/tables/contacts',
  ],
  [
    { kind: 'table', base: CRM, table: 'contacts', view: ID, record: OTHER },
    `/bases/crm/tables/contacts?vue=${ID}&ligne=${OTHER}`,
  ],
  [
    { kind: 'table', base: CRM, table: 'contacts', view: null, record: OTHER },
    `/bases/crm/tables/contacts?ligne=${OTHER}`,
  ],
  [{ kind: 'sqlview', base: CRM, id: ID }, `/bases/crm/vues-sql/${ID}`],
  [{ kind: 'query', base: CRM, id: ID }, `/bases/crm/requetes/${ID}`],
  [{ kind: 'question', base: CRM, id: ID }, `/bases/crm/questions/${ID}`],
  [{ kind: 'section', base: CRM, section: 'structure' }, '/bases/crm/structure'],
  [{ kind: 'section', base: CRM, section: 'history' }, '/bases/crm/historique'],
  [{ kind: 'section', base: CRM, section: 'integrations' }, '/bases/crm/integrations'],
  [{ kind: 'section', base: CRM, section: 'doc' }, '/bases/crm/documentation'],
  [{ kind: 'dashboards', base: CRM, focus: null }, '/bases/crm/tableaux-de-bord'],
  [
    { kind: 'dashboards', base: CRM, focus: { kind: 'dashboard', id: ID } },
    `/bases/crm/tableaux-de-bord/${ID}`,
  ],
  [
    { kind: 'dashboards', base: CRM, focus: { kind: 'question', id: ID } },
    `/bases/crm/tableaux-de-bord/questions/${ID}`,
  ],
  [{ kind: 'automations', base: CRM, automation: null }, '/bases/crm/automatisations'],
  [{ kind: 'automations', base: CRM, automation: ID }, `/bases/crm/automatisations/${ID}`],
  [{ kind: 'admin', tab: 'groupes' }, '/administration/groupes'],
  [{ kind: 'admin', tab: null }, '/administration'],
  [{ kind: 'settings', tab: 'securite' }, '/parametres/securite'],
]

function split(address: string): [string, string] {
  const at = address.indexOf('?')
  return at === -1 ? [address, ''] : [address.slice(0, at), address.slice(at)]
}

describe('addressOf', () => {
  it.each(PLACES)('writes %j as %s', (place, address) => {
    expect(addressOf(place)).toBe(address)
  })
})

describe('placeOf', () => {
  it.each(PLACES)('reads back %j from its address', (place, address) => {
    expect(placeOf(...split(address), TENANT)).toEqual(place)
  })

  it('reads a trailing slash as the same place', () => {
    expect(placeOf('/bases/crm/tables/contacts/', '', TENANT)).toEqual(
      placeOf('/bases/crm/tables/contacts', '', TENANT),
    )
  })

  it('reads an empty view or row as none', () => {
    expect(placeOf('/bases/crm/tables/contacts', '?vue=&ligne=', TENANT)).toEqual({
      kind: 'table',
      base: CRM,
      table: 'contacts',
      view: null,
      record: null,
    })
  })

  it('names no place for an address it does not know', () => {
    for (const address of [
      '/crm',
      '/bases',
      '/bases/crm/tables',
      '/bases/crm/inconnu',
      '/bases/crm/tables/contacts/en-trop',
      '/bases/crm/structure/en-trop',
      '/bases/crm/tableaux-de-bord/questions',
      '/bases/crm/tableaux-de-bord/un/deux',
      '/projets',
      '/parametres/profil/en-trop',
      '/bases/%E0%A4%A',
    ]) {
      expect(placeOf(address, '', TENANT), address).toBeNull()
    }
  })

  it('writes a base without the tenant every base shares, and puts it back', () => {
    expect(addressOf({ kind: 'base', base: `b_${TENANT}_demo_atelier_lumen` })).toBe(
      '/bases/demo_atelier_lumen',
    )
    expect(placeOf('/bases/demo_atelier_lumen', '', TENANT)).toEqual({
      kind: 'base',
      base: `b_${TENANT}_demo_atelier_lumen`,
    })
  })

  it('keeps a table called like a section apart from the section', () => {
    expect(placeOf('/bases/crm/tables/structure', '', TENANT)).toMatchObject({
      kind: 'table',
      table: 'structure',
    })
    expect(placeOf('/bases/crm/structure', '', TENANT)).toMatchObject({
      kind: 'section',
      section: 'structure',
    })
  })
})
