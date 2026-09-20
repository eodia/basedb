import { describe, expect, it } from 'vitest'
import {
  BasedbError,
  businessError,
  isRetryable,
  requiresSchemaReread,
  translatePgError,
} from '../../src/errors/index.js'
import { CONNECTION_CONTRACT, startupOptions } from '../../src/runtime/pool.js'
import { assertDeadline, deadlineExceeded, sealContext } from '../../src/tx/context.js'

describe('chapter 10 §8.2 — SQLSTATE translation', () => {
  const cases: ReadonlyArray<[sqlstate: string, code: string]> = [
    ['23505', 'DUPLICATE_VALUE'],
    ['23514', 'VALUE_OUT_OF_CONSTRAINT'],
    ['23502', 'REQUIRED_VALUE_MISSING'],
    ['22001', 'VALUE_TOO_LONG'],
    ['22003', 'VALUE_OUT_OF_RANGE'],
    ['22P02', 'VALUE_INVALID'],
    ['40001', 'SERIALIZATION_CONFLICT'],
    ['40P01', 'SERIALIZATION_CONFLICT'],
    ['55P03', 'LOCK_UNAVAILABLE'],
    ['57014', 'DEADLINE_EXCEEDED'],
    ['53300', 'SERVICE_UNAVAILABLE'],
    ['42501', 'PRIVILEGES_INSUFFICIENT'],
  ]

  for (const [sqlstate, code] of cases) {
    it(`${sqlstate} → ${code}`, () => {
      expect(translatePgError({ code: sqlstate }).code).toBe(code)
    })
  }

  it('23503 depends on the operation', () => {
    // Deleting a still-referenced row is not the same fault as writing a link to a
    // non-existent target.
    expect(translatePgError({ code: '23503' }, 'delete').code).toBe('ROW_REFERENCED')
    expect(translatePgError({ code: '23503' }, 'insert').code).toBe('LINK_TARGET_NOT_FOUND')
    expect(translatePgError({ code: '23503' }, 'update').code).toBe('LINK_TARGET_NOT_FOUND')
  })

  it('an unknown SQLSTATE is an INCIDENT, never a user fault', () => {
    const e = translatePgError({ code: 'XX999' })
    expect(e.code).toBe('INTERNAL_ERROR')
    expect(e.class).toBe('incident')
    expect(e.details.sqlstate).toBe('XX999')
  })

  it('25P02 is a defect of our own state machine', () => {
    // A statement issued inside an aborted transaction is never attributable to the
    // caller.
    expect(translatePgError({ code: '25P02' }).class).toBe('incident')
  })

  it('surfaces the constraint physical name, not a raw server message', () => {
    const e = translatePgError({ code: '23505', constraint: 'uq_factures__numero' })
    expect(e.details.constraint).toBe('uq_factures__numero')
    // Resolving it to the field label belongs to the executor, which holds the
    // database's memoized schema.
    expect(e.message).not.toContain('duplicate key')
  })

  it('tells a retry apart from a schema re-read', () => {
    expect(isRetryable({ code: '40001' })).toBe(true)
    expect(isRetryable({ code: '23505' })).toBe(false)
    expect(requiresSchemaReread({ code: '42P01' })).toBe(true)
    expect(requiresSchemaReread({ code: '42703' })).toBe(true)
    expect(requiresSchemaReread({ code: '40001' })).toBe(false)
  })
})

describe('error classification (§8.1)', () => {
  it('files each code in the class its status imposes', () => {
    expect(businessError('RESOURCE_NOT_FOUND').class).toBe('invisible')
    expect(businessError('ADMIN_REQUIRED').class).toBe('forbidden')
    expect(businessError('TABLE_REFERENCED').class).toBe('conflict')
    expect(businessError('LOCK_UNAVAILABLE').class).toBe('unavailable')
    expect(businessError('IDENTIFIER_INVALID').class).toBe('validation')
    expect(businessError('CATALOG_DRIFT').class).toBe('incident')
  })

  it('a code outside the registry becomes an incident rather than a silent error', () => {
    const e = businessError('CODE_THAT_DOES_NOT_EXIST')
    expect(e.code).toBe('INTERNAL_ERROR')
    expect(e.details.unknownCode).toBe('CODE_THAT_DOES_NOT_EXIST')
  })

  it('carries the registry HTTP status, which only the adapter consults', () => {
    expect(new BasedbError('RESOURCE_NOT_FOUND').httpStatus).toBe(404)
    expect(new BasedbError('DUPLICATE_VALUE').httpStatus).toBe(409)
  })
})

describe('chapter 01 §10.3 — connection contract', () => {
  it('an empty value is written without quotes', () => {
    // `-c search_path=""` would literally set two quote characters: a search_path
    // neither empty nor valid, and every unqualified reference would fail confusingly.
    expect(startupOptions()).toContain('-c search_path=')
    expect(startupOptions()).not.toContain('search_path=""')
  })

  it('escapes spaces, as libpq expects', () => {
    expect(startupOptions()).toContain('-c DateStyle=ISO,\\ YMD')
  })

  it('carries the six semantic parameters', () => {
    const options = startupOptions()
    for (const key of Object.keys(CONNECTION_CONTRACT)) {
      expect(options, `${key} must appear in the startup packet`).toContain(`-c ${key}=`)
    }
  })

  it('accepts additional per-pool parameters', () => {
    expect(startupOptions({ lock_timeout: '3000ms' })).toContain('-c lock_timeout=3000ms')
  })
})

describe('chapter 10 §4 — context and deadline', () => {
  const base = {
    requestId: '018f3c2a-0000-7000-8000-000000000001',
    actor: { kind: 'user', id: 'u1' },
    tenantId: 't4z56fq',
    surface: 'rest',
    timestamp: new Date('2026-09-19T10:00:00Z'),
    deadline: new Date('2026-09-19T10:00:30Z'),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  } as const

  it('seals a frozen context', () => {
    const ctx = sealContext(base)
    expect(Object.isFrozen(ctx)).toBe(true)
    expect(ctx.language).toBe('fr')
    expect(ctx.schemaVersion).toBeNull()
  })

  it('the row predicate is constantly true in v1 (A20)', () => {
    // Present in the signature so the query builder emits it and the non-regression
    // test can be written, without implementing anything.
    expect(sealContext(base).permissions.rowPredicate).toBe('TRUE')
  })

  it('once crossed, the deadline forbids any new statement', () => {
    const ctx = sealContext(base)
    expect(deadlineExceeded(ctx, new Date('2026-09-19T10:00:29Z'))).toBe(false)
    expect(deadlineExceeded(ctx, new Date('2026-09-19T10:00:31Z'))).toBe(true)
    expect(() => assertDeadline(ctx, new Date('2026-09-19T10:00:31Z'))).toThrow(BasedbError)
  })
})
