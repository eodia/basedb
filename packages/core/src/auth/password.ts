import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { BasedbError } from '../errors/index.js'

/**
 * Password authentication — chapter 13 §2.
 *
 * Two decisions carry the whole section. The hash is **argon2id, with no alternative**,
 * at parameters the chapter fixes. And the password is **peppered** before hashing: what
 * argon2id sees is `HMAC-SHA256(pepper, password)`, the pepper being derived from the
 * instance key and never living in the database. A copied volume, a `pg_dump` or a
 * mislaid backup therefore does not suffice to mount a dictionary attack.
 */

/** §2.1 — fixed, and not configurable. 64 MiB, 3 passes, parallelism 1. */
// `Algorithm.Argon2id` is an ambient const enum, unreachable under `isolatedModules`.
// Its numeric value is part of the library's public shape; naming it here is clearer
// than importing a type-only enum and losing it at emit.
const ARGON2ID = 2

const ARGON2 = {
  algorithm: ARGON2ID,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const

/**
 * Key version prefixing the stored value.
 *
 * During a rotation the previous version stays accepted for verification and the row is
 * recomputed at the next login; a parameter change therefore invalidates nothing.
 */
const KEY_VERSION = 'v1'

export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 256

/**
 * Starter deny list, shipped with the product and extensible by the operator.
 *
 * Deliberately local: A4 forbids calling a third-party reputation service, which would
 * send a password — or its prefix — outside the instance at the very moment it is
 * chosen.
 */
const DENIED = new Set(
  [
    'motdepasse',
    'password',
    'passw0rd',
    'password1234',
    'azertyuiop',
    'qwertyuiop',
    '123456789012',
    'administrateur',
    'administrator',
    'jaimelesfrites',
    'basedbbasedb',
    'changemechangeme',
    'letmeinletmein',
    'welcomewelcome',
    'iloveyouiloveyou',
    'motdepasse123',
    'password123!',
    'azerty123456',
    'qwerty123456',
  ].map((p) => p.toLowerCase()),
)

/**
 * Derives the pepper from the instance key, by DOMAIN SEPARATION.
 *
 * The same key serves other purposes (A25); using it raw for two things would let a
 * weakness in one become a weakness in the other.
 */
function pepperOf(instanceKey: string): Buffer {
  return createHmac('sha256', instanceKey).update('basedb/pepper/password/v1').digest()
}

/**
 * What argon2id actually hashes.
 *
 * Returned as base64 and NOT as raw bytes: `hash()` accepts an arbitrary buffer, but
 * `verify()` decodes its password as UTF-8 and rejects anything else. An HMAC digest is
 * random bytes, so passing it raw hashes fine and then NEVER verifies — a failure that
 * looks exactly like a wrong password.
 */
function peppered(instanceKey: string, password: string): string {
  // NFKC first: two keyboards can produce the same accented character with different
  // code points, and a password typed on one must verify on the other.
  return createHmac('sha256', pepperOf(instanceKey))
    .update(password.normalize('NFKC'))
    .digest('base64')
}

export interface Identity {
  readonly email: string
  readonly displayName: string
}

/**
 * Checks the policy of §2.2.
 *
 * No imposed composition and no periodic expiry — deliberately. They produce
 * `Motdepasse2024!` and the incrementing of a final digit, not entropy. Length,
 * a deny list and similarity are the three rules with a demonstrated effect.
 *
 * Every refusal carries its reason: it addresses someone who has already proved their
 * identity, so there is nothing to withhold.
 */
export function checkPasswordPolicy(password: string, identity: Identity): void {
  const refuse = (reason: string): never => {
    throw new BasedbError('PASSWORD_POLICY_VIOLATION', { details: { reason } })
  }

  const normalized = password.normalize('NFKC')
  if (normalized.length < PASSWORD_MIN) refuse('trop_court')
  // An upper bound too: beyond it, hashing cost becomes a denial of service.
  if (normalized.length > PASSWORD_MAX) refuse('trop_long')

  const folded = normalized.toLowerCase()
  if (DENIED.has(folded)) refuse('trop_courant')

  const local = identity.email.split('@')[0] ?? ''
  for (const piece of [identity.email, local, identity.displayName]) {
    if (piece.length >= 3 && folded.includes(piece.toLowerCase())) refuse('ressemble_a_identite')
  }
}

/** Hashes a password. The stored value is the full PHC string, parameters included. */
export async function hashPassword(instanceKey: string, password: string): Promise<string> {
  const digest = await hash(peppered(instanceKey, password), {
    ...ARGON2,
    salt: randomBytes(16),
  })
  return `${KEY_VERSION}$${digest}`
}

/**
 * Verifies a password.
 *
 * Returns `false` rather than throwing on a malformed stored value: a corrupt row is a
 * failed authentication, not an incident the caller should learn about.
 */
export async function verifyPassword(
  instanceKey: string,
  stored: string,
  password: string,
): Promise<boolean> {
  const separator = stored.indexOf('$')
  if (separator === -1) return false
  const digest = stored.slice(separator + 1)

  try {
    // NO options here: the PHC string carries the parameters it was produced with, and
    // passing today's would make a row hashed under previous parameters fail to verify —
    // exactly the rotation the key version is meant to survive.
    return await verify(digest, peppered(instanceKey, password))
  } catch {
    return false
  }
}

/**
 * A constant hash, hashed for nothing — §2.5.
 *
 * When the address matches no `password` identity, a DUMMY argon2id hash runs against a
 * constant digest with the same parameters. Without it the response time would be the
 * oracle the error code is careful to avoid: an existing account costs 100 ms, an
 * unknown one costs nothing, and the difference is measurable from anywhere.
 */
export async function dummyVerify(instanceKey: string): Promise<void> {
  // A fixed PHC string, produced once with these very parameters.
  const digest = await hash(peppered(instanceKey, 'compte-inexistant'), {
    ...ARGON2,
    salt: Buffer.alloc(16, 7),
  })
  // Consume the result so no optimizer can elide the work.
  timingSafeEqual(Buffer.from(digest.slice(0, 16)), Buffer.from(digest.slice(0, 16)))
}
