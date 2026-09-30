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

  it('the level is the highest over the roles, field by field — not a union of verbs', () => {
    // `lecteurs` reads without a field rule; `saisie` edits, `montant` read-only. The only
    // role that writes does not write `montant`, and a role that merely reads adds no
    // write to it: montant = max(read, read) = read (§4.1).
    const grants: ActorGrants = {
      isInstanceAdmin: false,
      roles: [
        {
          id: 'lecteurs',
          permissions: [{ action: 'read', scopeKind: 'base', scopeId: BASE }],
          fieldRestrictions: [],
        },
        {
          id: 'saisie',
          permissions: (['read', 'create', 'update'] as const).map((action) => ({
            action,
            scopeKind: 'table' as const,
            scopeId: TABLE,
          })),
          fieldRestrictions: [{ fieldId: 'f-montant', mode: 'read_only' }],
        },
      ],
    }
    const d = decide(context(), grants, 'update', target)
    expect(d.verdict).toBe('ALLOWED')
    expect(d.readableFields.has('f-montant')).toBe(true)
    expect(d.writableFields.has('f-montant')).toBe(false)
    expect(d.writableFields.has('f-numero')).toBe(true)
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
  it('every decision carries it: every row without a rule, none on a refusal (A20, §16)', () => {
    expect(decide(context(), grantsFor(['read']), 'read', target).rowPredicate).toBe('TRUE')
    expect(decide(context(), grantsFor([]), 'read', target).rowPredicate).toBe('FALSE')
    expect(decide(context(), grantsFor(['read']), 'delete', target).rowPredicate).toBe('FALSE')
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

describe('§2.3 — a token: its role, intersected with its creator', () => {
  const tokenContext = context({
    actor: { kind: 'token', id: 'u-1', tokenId: 'tok-1' },
    surface: 'mcp',
  })
  const role = (
    actions: readonly Action[],
    restrictions: ActorGrants['roles'][number]['fieldRestrictions'] = [],
  ) => ({
    id: 'r-token',
    permissions: actions.map((action) => ({ action, scopeKind: 'base' as const, scopeId: BASE })),
    fieldRestrictions: restrictions,
  })

  it('a read-only token under a writing creator reads, and is refused a write BY ITS ROLE', () => {
    const grants = grantsFor(['read', 'create', 'update'], { tokenRole: role(['read']) })
    expect(decide(tokenContext, grants, 'read', target).verdict).toBe('ALLOWED')
    const write = decide(tokenContext, grants, 'update', target)
    expect(write.verdict).toBe('FORBIDDEN')
    expect(write.reason).toBe('TOKEN_ACTION_NOT_GRANTED')
  })

  it('a writing token under a creator who lost the right is refused BY ITS CREATOR', () => {
    const grants = grantsFor(['read'], { tokenRole: role(['read', 'create', 'update']) })
    const write = decide(tokenContext, grants, 'update', target)
    expect(write.verdict).toBe('FORBIDDEN')
    expect(write.reason).toBe('ACTION_NOT_GRANTED')
  })

  it('a creator with no right left makes the token see nothing', () => {
    const grants: ActorGrants = { isInstanceAdmin: false, roles: [], tokenRole: role(['read']) }
    expect(decide(tokenContext, grants, 'read', target).verdict).toBe('INVISIBLE')
  })

  it('field masks intersect: hidden on either side is hidden', () => {
    const grants = grantsFor(['read', 'update'], {
      tokenRole: role(['read', 'update'], [{ fieldId: 'f-salaire', mode: 'hidden' }]),
    })
    const d = decide(tokenContext, grants, 'update', target)
    expect(d.readableFields.has('f-salaire')).toBe(false)
    expect(d.writableFields.has('f-salaire')).toBe(false)
    expect(d.writableFields.has('f-numero')).toBe(true)
  })

  it('an instance administrator’s token keeps its scope and its role', () => {
    const grants: ActorGrants = {
      isInstanceAdmin: true,
      roles: [],
      tokenRole: role(['read']),
      tokenBaseId: 'another-base',
    }
    expect(decide(tokenContext, grants, 'read', target).reason).toBe('TOKEN_SCOPE')
    const inScope = decide(tokenContext, { ...grants, tokenBaseId: BASE }, 'update', target)
    expect(inScope.reason).toBe('TOKEN_ACTION_NOT_GRANTED')
  })
})

describe('chapter 09 §12.2 — what is withheld from agents', () => {
  const agent = context({ surface: 'mcp' })
  const withheld: Target = { ...target, agentHiddenFieldIds: ['f-salaire'] }

  it('a field closed to agents is unreadable on the mcp surface, and only there', () => {
    const onMcp = decide(agent, grantsFor(['read', 'update']), 'update', withheld)
    expect(onMcp.readableFields.has('f-salaire')).toBe(false)
    expect(onMcp.writableFields.has('f-salaire')).toBe(false)
    const onRest = decide(context(), grantsFor(['read']), 'read', withheld)
    expect(onRest.readableFields.has('f-salaire')).toBe(true)
  })

  it('an administrator does not see it either, on that surface', () => {
    const admin: ActorGrants = { isInstanceAdmin: true, roles: [] }
    expect(decide(agent, admin, 'read', withheld).readableFields.has('f-salaire')).toBe(false)
  })

  it('a table whose every field is withheld does not exist for agents', () => {
    const all: Target = { ...target, agentHiddenFieldIds: FIELDS }
    const d = decide(agent, grantsFor(['read']), 'read', all)
    expect(d.verdict).toBe('INVISIBLE')
    expect(d.reason).toBe('EMPTY_MASK')
  })

  it('a base closed to agents does not exist there, whatever the rights', () => {
    const closed: Target = { ...target, agentsExcluded: true }
    const admin: ActorGrants = { isInstanceAdmin: true, roles: [] }
    expect(decide(agent, admin, 'read', closed).verdict).toBe('INVISIBLE')
    expect(decide(context(), admin, 'read', closed).verdict).toBe('ALLOWED')
  })
})
