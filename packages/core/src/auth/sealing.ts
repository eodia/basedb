import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { BasedbError } from '../errors/index.js'

/**
 * Sealing with the instance key — A25.
 *
 * Two uses, and one reason to keep them in one place. `_basedb.secret` holds values the
 * database must not be able to reveal on its own — an OIDC client secret, an AI key —
 * and the OIDC exchange cookie holds state the browser carries but must not be able to
 * forge. Both want the same thing: confidentiality AND authenticity, from a key that
 * never lives in the database.
 *
 * AES-256-GCM, which gives both in one pass. A cipher without authentication would let
 * a browser flip bits in its own cookie and have the server believe the result.
 *
 * The key is DERIVED per purpose, by domain separation: a weakness in one use must not
 * become a weakness in the other, and a sealed cookie must never decrypt as a secret.
 */

/** Version prefix, so a key rotation can accept the previous one while re-sealing. */
const VERSION = 1

function keyFor(instanceKey: string, purpose: string): Buffer {
  return createHmac('sha256', instanceKey).update(`basedb/seal/${purpose}/v1`).digest()
}

/**
 * Seals a value: `v1.<iv>.<tag>.<ciphertext>`, all base64url.
 *
 * The parts are separated rather than concatenated at fixed offsets, because an offset
 * is a thing one gets wrong once and then cannot change.
 */
export function seal(instanceKey: string, purpose: string, plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFor(instanceKey, purpose), iv)
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    `v${VERSION}`,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    body.toString('base64url'),
  ].join('.')
}

/**
 * Opens a sealed value, or returns `null`.
 *
 * `null` rather than an exception, because every caller here treats a broken seal as an
 * absent credential — and an exception at this boundary would tempt someone into
 * telling a forged cookie apart from a missing one.
 */
export function unseal(instanceKey: string, purpose: string, sealed: string): string | null {
  const parts = sealed.split('.')
  if (parts.length !== 4 || parts[0] !== `v${VERSION}`) return null

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFor(instanceKey, purpose),
      Buffer.from(parts[1], 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    // A wrong tag, a truncated value, a seal from another purpose: all the same answer.
    return null
  }
}

/** The key version stored beside a secret, so a rotation knows what it is looking at. */
export const KEY_VERSION = VERSION

/** Raised when a sealed secret cannot be opened — an incident, never the caller's fault. */
export function refuseUnsealable(key: string): never {
  throw new BasedbError('INTERNAL_ERROR', { details: { secret: key } })
}
