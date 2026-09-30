import { describe, expect, it } from 'vitest'
import { type ActorGrants, type Target, decide } from '../../src/rbac/decide.js'
import {
  compileRowRule,
  compileRowRules,
  personalize,
  policyExpression,
  rowWhere,
  ruleFieldsOf,
} from '../../src/rbac/rows.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Row rules — chapter 05 §16: a filter per group and table, compiled into a template the
 * decider only combines, then written by each query under its own alias.
 */

const FIELDS = ruleFieldsOf([
  { name: 'nom', kind: 'short_text' },
  { name: 'region', kind: 'select' },
  { name: 'commercial', kind: 'user' },
  { name: 'montant', kind: 'number' },
  { name: 'ca', kind: 'rollup' },
])

const ME = '01a0e32d-6d27-783d-848e-e71c9462271a'

function context(): RequestContext {
  const t = new Date('2026-09-30T12:00:00Z')
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-000000000001',
    actor: { kind: 'user', id: ME },
    tenantId: 't4z56fq',
    surface: 'rest',
    timestamp: t,
    deadline: new Date(t.getTime() + 30_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

const reading = (
  id: string,
  actions: ActorGrants['roles'][number]['permissions'][number]['action'][] = ['read'],
) => ({
  id,
  permissions: actions.map((action) => ({ action, scopeKind: 'base' as const, scopeId: 'b-1' })),
  fieldRestrictions: [],
})

describe('compiling a rule', () => {
  it('qualifies its columns with the placeholder alias and writes its values as literals', () => {
    const sql = compileRowRule('region eq "nord" and montant gte 100', FIELDS)
    expect(sql).toContain('"basedb_row"."region"')
    expect(sql).toContain("'nord'")
    expect(sql).toContain('100')
    expect(sql).not.toMatch(/\$\d/)
  })

  it('escapes a quote in a value, so a rule cannot close its literal', () => {
    const sql = compileRowRule(`nom eq "l'épicerie"`, FIELDS)
    expect(sql).toContain("'l''épicerie'")
  })

  it('turns @moi into the person the decision is for — and only outside a string', () => {
    const sql = compileRowRule('commercial eq @moi or nom eq "@moi"', FIELDS)
    const mine = personalize(sql, ME)
    expect(mine).toContain(`'${ME}'`)
    expect(mine).toContain("'@moi'")
  })

  it('reads @me as @moi, the word other languages write', () => {
    expect(personalize(compileRowRule('commercial eq @me', FIELDS), ME)).toContain(`'${ME}'`)
  })

  it('accepts the system columns: « what I created »', () => {
    expect(() => compileRowRule('_created_by eq @moi', FIELDS)).not.toThrow()
  })

  it('refuses a field computed at read time, a path through a link, and nonsense', () => {
    expect(() => compileRowRule('ca gt 10', FIELDS)).toThrow()
    expect(() => compileRowRule('client.commercial eq @moi', FIELDS)).toThrow()
    expect(() => compileRowRule('region zz "nord"', FIELDS)).toThrow()
    expect(() => compileRowRule('   ', FIELDS)).toThrow()
  })

  it('makes a rule that no longer compiles show nothing rather than everything', () => {
    const rules = compileRowRules([{ roleId: 'r-1', filter: 'disparu eq 1' }], FIELDS)
    expect(rules.get('r-1')).toBe('FALSE')
  })
})

describe('writing a predicate into a query', () => {
  it('takes the alias of the query, a qualified relation, or none for a policy', () => {
    const sql = compileRowRule('region eq "nord"', FIELDS)
    expect(rowWhere(sql, 't')).toContain('"t"."region"')
    expect(rowWhere(sql, '"b_x"."clients"')).toContain('"b_x"."clients"."region"')
    expect(policyExpression(sql)).toMatch(/^\(?\s*"region"/)
    expect(rowWhere('TRUE', 't')).toBe('TRUE')
  })
})

describe('the decider combines the rules of the roles reading the table', () => {
  const rule = compileRowRule('commercial eq @moi', FIELDS)
  const nord = compileRowRule('region eq "nord"', FIELDS)
  const target: Target = {
    kind: 'table',
    id: 'table-1',
    tenantId: 't4z56fq',
    baseId: 'b-1',
    fieldIds: ['f-nom'],
    rowRules: new Map([
      ['ventes', rule],
      ['nord', nord],
    ]),
  }

  it('narrows a person to their group rule, @moi being them', () => {
    const d = decide(
      context(),
      { isInstanceAdmin: false, roles: [reading('ventes')] },
      'read',
      target,
    )
    expect(d.rowPredicate).toContain(`'${ME}'`)
  })

  it('is additive: two groups with rules see the union, a group without one sees all', () => {
    const both = decide(
      context(),
      { isInstanceAdmin: false, roles: [reading('ventes'), reading('nord')] },
      'read',
      target,
    )
    expect(both.rowPredicate).toContain(' OR ')
    const plus = decide(
      context(),
      { isInstanceAdmin: false, roles: [reading('ventes'), reading('direction')] },
      'read',
      target,
    )
    expect(plus.rowPredicate).toBe('TRUE')
  })

  it('lets whoever manages the table see all of it, and the instance administrator too', () => {
    const manager = decide(
      context(),
      { isInstanceAdmin: false, roles: [reading('ventes', ['read', 'manage_schema'])] },
      'read',
      target,
    )
    expect(manager.rowPredicate).toBe('TRUE')
    expect(
      decide(context(), { isInstanceAdmin: true, roles: [] }, 'read', target).rowPredicate,
    ).toBe('TRUE')
  })

  it('ignores the rule of a role that does not read the table', () => {
    const d = decide(
      context(),
      {
        isInstanceAdmin: false,
        roles: [reading('direction'), { ...reading('ventes'), permissions: [] }],
      },
      'read',
      target,
    )
    expect(d.rowPredicate).toBe('TRUE')
  })
})
