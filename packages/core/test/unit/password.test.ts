import { describe, expect, it } from 'vitest'
import {
  checkPasswordPolicy,
  dummyVerify,
  hashPassword,
  verifyPassword,
} from '../../src/auth/password.js'

/** Chapter 13 §2. The instance key never leaves the process. */
const KEY = 'cle-instance-de-test-0123456789'

const IDENTITY = { email: 'marie.dupont@exemple.fr', displayName: 'Marie Dupont' }

describe('policy — chapter 13 §2.2', () => {
  it('accepts a long password with no imposed composition', () => {
    // No imposed composition, deliberately: it produces `Motdepasse2024!`, not entropy.
    expect(() => checkPasswordPolicy('les chaussettes de larchiduchesse', IDENTITY)).not.toThrow()
  })

  it('refuses below eight characters', () => {
    expect(() => checkPasswordPolicy('court', IDENTITY)).toThrow(/PASSWORD_POLICY_VIOLATION/)
    expect(() => checkPasswordPolicy('7 chars', IDENTITY)).toThrow(/PASSWORD_POLICY_VIOLATION/)
    expect(() => checkPasswordPolicy('8 chars!', IDENTITY)).not.toThrow()
  })

  it('refuses a common password, whatever its case', () => {
    expect(() => checkPasswordPolicy('Password', IDENTITY)).toThrow(/PASSWORD_POLICY_VIOLATION/)
    expect(() => checkPasswordPolicy('12345678', IDENTITY)).toThrow(/PASSWORD_POLICY_VIOLATION/)
  })

  it('refuses beyond 256, because hashing cost is a denial of service', () => {
    expect(() => checkPasswordPolicy('a'.repeat(300), IDENTITY)).toThrow()
  })

  it('refuses a password containing the address or the display name', () => {
    expect(() => checkPasswordPolicy('marie.dupont@exemple.fr!!', IDENTITY)).toThrow()
    expect(() => checkPasswordPolicy('xxMarie Dupontxx', IDENTITY)).toThrow()
    // The local part alone is enough to refuse.
    expect(() => checkPasswordPolicy('zzzmarie.dupontzzz', IDENTITY)).toThrow()
  })

  it('names its reason, since it speaks to someone already identified', () => {
    try {
      checkPasswordPolicy('court', IDENTITY)
      throw new Error('aurait du refuser')
    } catch (e) {
      expect((e as { details?: { reason?: string } }).details?.reason).toBe('trop_court')
    }
  })
})

describe('hashing — chapter 13 §2.1', () => {
  it('verifies a password it has hashed', async () => {
    const stored = await hashPassword(KEY, 'les chaussettes de larchiduchesse')
    expect(await verifyPassword(KEY, stored, 'les chaussettes de larchiduchesse')).toBe(true)
    expect(await verifyPassword(KEY, stored, 'autre chose entierement')).toBe(false)
  }, 30_000)

  it('carries the key version, so a rotation invalidates nothing', async () => {
    const stored = await hashPassword(KEY, 'les chaussettes de larchiduchesse')
    expect(stored.startsWith('v1$')).toBe(true)
    expect(stored).toContain('argon2id')
  }, 30_000)

  it('PEPPERS: the same password under another instance key does not verify', async () => {
    // This is what a stolen `pg_dump` runs into. Without the pepper, the dump alone
    // would be enough to mount a dictionary attack offline.
    const stored = await hashPassword(KEY, 'les chaussettes de larchiduchesse')
    expect(
      await verifyPassword('autre-cle-dinstance', stored, 'les chaussettes de larchiduchesse'),
    ).toBe(false)
  }, 30_000)

  it('gives two different hashes for the same password', async () => {
    // A random 16-byte salt: two users sharing a password must not share a row.
    const a = await hashPassword(KEY, 'les chaussettes de larchiduchesse')
    const b = await hashPassword(KEY, 'les chaussettes de larchiduchesse')
    expect(a).not.toBe(b)
  }, 30_000)

  it('treats a corrupt stored value as a failed login, not an incident', async () => {
    expect(await verifyPassword(KEY, 'n-importe-quoi', 'les chaussettes de larchiduchesse')).toBe(
      false,
    )
    expect(await verifyPassword(KEY, '', 'les chaussettes de larchiduchesse')).toBe(false)
  })

  it('normalizes to NFKC, so the same password typed two ways verifies', async () => {
    // `é` composed, and `e` + combining acute: two keyboards, one password.
    const stored = await hashPassword(KEY, 'un mot de passe accentué')
    expect(await verifyPassword(KEY, stored, 'un mot de passe accentué')).toBe(true)
  }, 30_000)

  it('the dummy verification costs about as much as a real one', async () => {
    // Without it, an existing account costs 100 ms and an unknown one costs nothing —
    // the very oracle the shared error code exists to avoid.
    const stored = await hashPassword(KEY, 'les chaussettes de larchiduchesse')

    const startReal = process.hrtime.bigint()
    await verifyPassword(KEY, stored, 'mauvais mot de passe ici')
    const real = Number(process.hrtime.bigint() - startReal)

    const startDummy = process.hrtime.bigint()
    await dummyVerify(KEY)
    const dummy = Number(process.hrtime.bigint() - startDummy)

    // Same order of magnitude is what matters; an exact match is neither achievable nor
    // required, since both are dominated by the same argon2id work.
    expect(dummy).toBeGreaterThan(real / 4)
    expect(dummy).toBeLessThan(real * 4)
  }, 30_000)
})
