import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_ERROR_CODES, ERROR_CODES, httpStatusFor, isErrorCode } from '../src/index.js'

/**
 * The registry is generated from the annex of chapter 00. These tests verify that it
 * has not drifted from its source and that it upholds A2 and A23.
 */

const ANNEX = fileURLToPath(
  new URL('../../../docs/architecture/00-decisions-structurantes.md', import.meta.url),
)

/** Re-reads the codes straight from the annex, bypassing the generated file. */
function codesFromAnnex(): string[] {
  const text = readFileSync(ANNEX, 'utf8')
  const start = text.indexOf('## Annexe')
  expect(start, 'the annex of chapter 00 must exist').toBeGreaterThan(-1)
  const lines = text.slice(start).split(/\r?\n/)
  const codes: string[] = []
  for (const line of lines) {
    const m = line.match(/^\|\s*`([A-Z0-9_]+)`\s*\|/)
    if (m) codes.push(m[1])
  }
  return codes
}

describe('A23 — the registry is unique and derived from the document', () => {
  it('the generated file holds exactly the codes of the annex', () => {
    const expected = new Set(codesFromAnnex())
    const actual = new Set<string>(ALL_ERROR_CODES)

    const missing = [...expected].filter((c) => !actual.has(c))
    const extra = [...actual].filter((c) => !expected.has(c))

    expect(missing, 'codes present in the annex but absent from the generated registry').toEqual([])
    expect(extra, 'codes present in the registry but absent from the annex').toEqual([])
  })

  it('no duplicates: one code per condition', () => {
    expect(new Set(ALL_ERROR_CODES).size).toBe(ALL_ERROR_CODES.length)
  })

  it('the registry is not empty and covers the eight domains', () => {
    expect(ALL_ERROR_CODES.length).toBeGreaterThan(200)
    const domains = new Set(ALL_ERROR_CODES.map((c) => ERROR_CODES[c].domain))
    expect(domains.size).toBe(8)
  })
})

describe('A2 — machine identifiers in ASCII uppercase', () => {
  it('every code follows the naming rule, without exception', () => {
    for (const code of ALL_ERROR_CODES) {
      expect(code, `${code} must be in ASCII_UPPERCASE`).toMatch(/^[A-Z][A-Z0-9_]*$/)
    }
  })

  it('no French code survives', () => {
    // The five families merged by A23, and the codes dropped when the registry was
    // closed: their reappearance would signal a regression in the document.
    const dropped = [
      'TABLE_REFERENCEE',
      'VALEUR_DUPLIQUEE',
      'LIEN_CIBLE_INTROUVABLE',
      'NOT_FOUND',
      'UNAUTHENTICATED',
      'NULL_VALUES_PRESENT',
      'LINK_SET_NULL_REQUIRED',
      'ADMIN_RIGHT_REQUIRED',
      'VERSION_POSTGRES_INSUFFISANTE',
      'ENCODAGE_NON_SUPPORTE',
    ]
    for (const code of dropped) {
      expect(isErrorCode(code), `${code} was dropped and must not come back`).toBe(false)
    }
  })
})

describe('chapter 10 §8.1 — taxonomy and HTTP statuses', () => {
  it('statuses are plausible HTTP codes, or null', () => {
    for (const code of ALL_ERROR_CODES) {
      const status = httpStatusFor(code)
      if (status === null) continue
      expect(status, `${code} carries an out-of-range status`).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(600)
    }
  })

  it('the codes named by the taxonomy carry the announced status', () => {
    const expected: ReadonlyArray<[code: string, status: number]> = [
      ['RESOURCE_NOT_FOUND', 404], // invisible resource: the code, nothing else
      ['ADMIN_REQUIRED', 403], // visible, action reserved
      ['TABLE_REFERENCED', 409],
      ['ROW_REFERENCED', 409],
      ['DUPLICATE_VALUE', 409],
      ['DISPLAY_FIELD_IN_USE', 409],
      ['LINK_TARGET_NOT_FOUND', 409],
      ['LINK_ORPHAN_VALUES', 409],
      ['LOCK_UNAVAILABLE', 503],
      ['SERIALIZATION_CONFLICT', 503],
      ['IDENTIFIER_INVALID', 422],
      ['LINK_CROSS_DATABASE', 422],
      ['AUTHENTICATION_REQUIRED', 401],
      ['TOKEN_INVALID', 401],
      ['TOKEN_EXPIRED', 401],
      ['TOKEN_REVOKED', 401],
    ]

    for (const [code, status] of expected) {
      expect(isErrorCode(code), `${code} must be in the registry`).toBe(true)
      if (isErrorCode(code)) {
        expect(httpStatusFor(code), `${code} must be ${status}`).toBe(status)
      }
    }
  })

  it('startup refusals have no HTTP surface', () => {
    // They occur before any request has been served.
    for (const code of ['POSTGRES_VERSION_TOO_OLD', 'DB_ENCODING_NOT_UTF8']) {
      expect(isErrorCode(code)).toBe(true)
      if (isErrorCode(code)) expect(httpStatusFor(code)).toBeNull()
    }
  })

  it('every entry carries a condition and a normative chapter', () => {
    for (const code of ALL_ERROR_CODES) {
      const entry = ERROR_CODES[code]
      expect(entry.condition.length, `${code} has no condition`).toBeGreaterThan(3)
      expect(entry.chapter, `${code} has no normative chapter`).toMatch(/^\d{2}$/)
    }
  })
})

describe('status depending on origin', () => {
  it('IDENTIFIER_INVALID carries 422 and keeps the registry nuance', () => {
    // "422; 500 if built by the kernel": entering a technical name outside the alphabet
    // is a validation error; the same condition reached by an identifier the kernel
    // built is an incident (chapter 10 §8.1). The note is quoted from the French
    // document, which is authoritative on its wording.
    expect(ERROR_CODES.IDENTIFIER_INVALID.httpStatus).toBe(422)
    expect(ERROR_CODES.IDENTIFIER_INVALID.httpStatusNote).toBe(
      '422 ; 500 si construit par le noyau',
    )
  })

  it('it is the registry’s only composite case', () => {
    const composites = ALL_ERROR_CODES.filter((c) => ERROR_CODES[c].httpStatusNote !== null)
    expect(composites).toEqual(['IDENTIFIER_INVALID'])
  })
})
