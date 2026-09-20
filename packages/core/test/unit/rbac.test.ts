import { describe, expect, it } from 'vitest'
import {
  type Action,
  type ActorGrants,
  SYSTEM_COLUMNS,
  type Target,
  decide,
} from '../../src/rbac/decide.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Single enforcement point — chapter 05 §3.2.
 *
 * The order of the nine steps is not cosmetic: it upholds two invariants, and each has
 * its test below.
 */

const TENANT = 't4z56fq'
const OTHER_TENANT = 't9k2mnp'
const BASE = 'base-1'
const TABLE = 'table-1'
const FIELDS = ['f-numero', 'f-montant', 'f-salaire']

function context(overrides: Partial<Parameters<typeof sealContext>[0]> = {}): RequestContext {
  const t = new Date('2026-09-19T12:00:00Z')
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-000000000001',
    actor: { kind: 'user', id: 'u-1' },
    tenantId: TENANT,
    surface: 'rest',
    timestamp: t,
    deadline: new Date(t.getTime() + 30_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
    ...overrides,
  })
}

const target: Target = {
  kind: 'table',
  id: TABLE,
  tenantId: TENANT,
  baseId: BASE,
  fieldIds: FIELDS,
}

function grantsFor(actions: readonly Action[], overrides: Partial<ActorGrants> = {}): ActorGrants {
  return {
    isInstanceAdmin: false,
    roles: [
      {
        id: 'r-1',
        permissions: actions.map((action) => ({ action, scopeKind: 'base', scopeId: BASE })),
        fieldRestrictions: [],
      },
    ],
    ...overrides,
  }
}

describe('§3.2 — the nine steps', () => {
  it('step 2: partitioning comes first, instance administrators included', () => {
    const admin: ActorGrants = { isInstanceAdmin: true, roles: [] }
    const foreign: Target = { ...target, tenantId: OTHER_TENANT }

    // Without this ordering, the runtime guard would refuse with
    // TENANT_ISOLATION_VIOLATED what the decider had just allowed.
    const d = decide(context(), admin, 'read', foreign)
    expect(d.verdict).toBe('INVISIBLE')
    expect(d.reason).toBe('TENANT_MISMATCH')
  })

  it('step 3: the instance administrator gets the full mask INSIDE their tenant', () => {
    const d = decide(context(), { isInstanceAdmin: true, roles: [] }, 'delete', target)
    expect(d.verdict).toBe('ALLOWED')
    expect([...d.readableFields]).toEqual(expect.arrayContaining(FIELDS))
  })

  it('step 4: a token bound to one base sees nothing beyond it', () => {
    const d = decide(
      context({ actor: { kind: 'token', id: 'tok-1' } }),
      grantsFor(['read'], { tokenBaseId: 'another-base' }),
      'read',
      target,
    )
    expect(d.verdict).toBe('INVISIBLE')
    expect(d.reason).toBe('TOKEN_SCOPE')
  })

  it('step 9: without `read`, the target is INVISIBLE, never FORBIDDEN', () => {
    // First invariant: FORBIDDEN is never returned for an unreadable target.
    const d = decide(context(), grantsFor(['create']), 'create', target)
    expect(d.verdict).toBe('INVISIBLE')
    expect(d.reason).toBe('NO_READ')
  })

  it('step 9: with `read` but without the requested verb, it is FORBIDDEN', () => {
    const d = decide(context(), grantsFor(['read']), 'delete', target)
    expect(d.verdict).toBe('FORBIDDEN')
    expect(d.reason).toBe('ACTION_NOT_GRANTED')
  })

  it('visible table but empty mask → INVISIBLE', () => {
    // The only coherent outcome: a list of n empty objects would disclose the
    // cardinality of a table we meant to hide.
    const grants: ActorGrants = {
      isInstanceAdmin: false,
      roles: [
        {
          id: 'r-1',
          permissions: [{ action: 'read', scopeKind: 'base', scopeId: BASE }],
          fieldRestrictions: FIELDS.map((fieldId) => ({ fieldId, mode: 'hidden' as const })),
        },
      ],
    }
    const d = decide(context(), grants, 'read', target)
    expect(d.verdict).toBe('INVISIBLE')
    expect(d.reason).toBe('EMPTY_MASK')
  })
})

describe('§1.4 — scope inheritance', () => {
  it('an authorization on the base covers its tables', () => {
    expect(decide(context(), grantsFor(['read']), 'read', target).verdict).toBe('ALLOWED')
  })

  it('an authorization on an application covers the tables belonging to it', () => {
    const grants: ActorGrants = {
      isInstanceAdmin: false,
      roles: [
        {
          id: 'r-app',
          permissions: [{ action: 'read', scopeKind: 'application', scopeId: 'app-ventes' }],
          fieldRestrictions: [],
        },
      ],
    }
    // Membership is evaluated AT DECISION TIME, never frozen.
    const inside = { ...target, applicationIds: ['app-ventes'] }
    const outside = { ...target, applicationIds: ['app-rh'] }
    expect(decide(context(), grants, 'read', inside).verdict).toBe('ALLOWED')
    expect(decide(context(), grants, 'read', outside).verdict).toBe('INVISIBLE')
  })
})

describe('§3.3 — additivity and the trap it sets', () => {
  it('the union wins: a role without a restriction cancels another one', () => {
    // Bob is `rh` (read, no field rule) and `support` (read, salaire hidden). Bob SEES
    // salaire. That is a decision, not an oversight.
    const grants: ActorGrants = {
      isInstanceAdmin: false,
      roles: [
        {
          id: 'rh',
          permissions: [{ action: 'read', scopeKind: 'base', scopeId: BASE }],
          fieldRestrictions: [],
        },
        {
          id: 'support',
          permissions: [{ action: 'read', scopeKind: 'base', scopeId: BASE }],
          fieldRestrictions: [{ fieldId: 'f-salaire', mode: 'hidden' }],
        },
      ],
    }
    const d = decide(context(), grants, 'read', target)
    expect(d.verdict).toBe('ALLOWED')
    expect(d.readableFields.has('f-salaire')).toBe(true)
  })
})

describe('§4 — field mask', () => {
  it('system columns are always readable and never writable (A18)', () => {
    const d = decide(context(), grantsFor(['read', 'update']), 'update', target)
    for (const systemColumn of SYSTEM_COLUMNS) {
      expect(d.readableFields.has(systemColumn), `${systemColumn} must be readable`).toBe(true)
      expect(d.writableFields.has(systemColumn), `${systemColumn} is never writable`).toBe(false)
    }
  })

  it('`read` alone grants no writable field', () => {
    const d = decide(context(), grantsFor(['read']), 'read', target)
    expect(d.writableFields.size).toBe(0)
    // Clearable = readable minus writable: everything is clearable as far as the mask
    // goes, which spares the adapter from re-testing the rule itself.
    expect(d.clearableFields.size).toBe(d.readableFields.size)
  })

  it('a read-only field is readable but not writable', () => {
    const grants: ActorGrants = {
      isInstanceAdmin: false,
      roles: [
        {
          id: 'r-1',
          permissions: (['read', 'update'] as const).map((action) => ({
            action,
            scopeKind: 'base' as const,
            scopeId: BASE,
          })),
          fieldRestrictions: [{ fieldId: 'f-montant', mode: 'read_only' }],
        },
      ],
    }
    const d = decide(context(), grants, 'update', target)
    expect(d.readableFields.has('f-montant')).toBe(true)
    expect(d.writableFields.has('f-montant')).toBe(false)
    expect(d.clearableFields.has('f-montant')).toBe(true)
  })
})

describe('§6.1 — the row predicate is always emitted', () => {
  it('every decision carries it, refusals included (A20)', () => {
    const verdicts = [
      decide(context(), grantsFor(['read']), 'read', target),
      decide(context(), grantsFor([]), 'read', target),
      decide(context(), grantsFor(['read']), 'delete', target),
    ]
    for (const d of verdicts) {
      expect(d.rowPredicate).toBe('TRUE')
    }
  })
})

describe('§1.2 — the surface restricts, it never grants', () => {
  it('a token presented outside its allowed surfaces is invalid', () => {
    const d = decide(
      context({ actor: { kind: 'token', id: 'tok-1' }, surface: 'mcp' }),
      grantsFor(['read'], { tokenAllowedSurfaces: ['rest'] }),
      'read',
      target,
    )
    expect(d.verdict).toBe('FORBIDDEN')
    expect(d.reason).toBe('TOKEN_INVALID')
  })
})
