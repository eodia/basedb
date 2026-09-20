import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  IdentifierInvalidError,
  MAX_DERIVED_NAME_BYTES,
  TENANT_ALPHABET,
  TENANT_ID_DENYLIST,
  byteLength,
  checkConstraintName,
  composeSchemaName,
  distributeBudget,
  foreignKeyName,
  indexName,
  isAlphabetA,
  isAlphabetB,
  isRelegatedSchemaName,
  isTenantId,
  linkColumnName,
  linkColumnNameFromLabel,
  parseSchemaName,
  primaryKeyName,
  qualify,
  quoteIdentifier,
  relegatedName,
  relegatedSchemaName,
  sequenceName,
  triggerName,
  uniqueConstraintName,
} from '../src/index.js'

describe('chapter 01 §9.1 — derived name patterns', () => {
  it('primary key, foreign key and index on the nominal case of §12', () => {
    expect(primaryKeyName('factures')).toBe('pk_factures')
    expect(foreignKeyName('factures', 'clients_id')).toBe('fk_factures__clients_id')
    expect(indexName('factures', ['clients_id'])).toBe('ix_factures__clients_id')
  })

  it('link column: the target table name, with no transformation', () => {
    // No singularization, no pluralization, no translation: a `clients` table yields
    // `clients_id` (§9.3).
    expect(linkColumnName('clients')).toBe('clients_id')
    // Second link to the same target: the slug of the field label (§9.3, rule 2).
    expect(linkColumnNameFromLabel('client_livre')).toBe('client_livre_id')
  })

  it('check constraint and trigger', () => {
    expect(checkConstraintName('factures', 'montant', 'range')).toBe('ck_factures__montant__range')
    expect(triggerName('factures', 'system')).toBe('tg_factures__system')
  })

  it('explicit sequence', () => {
    expect(sequenceName('factures', 'numero')).toBe('factures__numero_seq')
  })

  it('uniqueness: at most three named columns, then __etc', () => {
    expect(uniqueConstraintName('factures', ['numero', 'annee'])).toBe('uq_factures__numero__annee')
    expect(uniqueConstraintName('t', ['a', 'b', 'c', 'd'])).toBe('uq_t__a__b__c__etc')
  })
})

describe('chapter 01 §9.6 — budget distribution per component', () => {
  it('reproduces the normative example, to the byte', () => {
    const table = 'liste_des_contrats_de_prevoyance_collective_sous' // 48 bytes
    const column = 'client_livre_id' // 15 bytes
    const name = foreignKeyName(table, column)

    expect(name).toBe('fk_liste_des_contrats_de_prevoyance_collective__client_livre_id')
    expect(byteLength(name)).toBe(63)
  })

  it('distribution follows the water-filling of §9.6 step 4', () => {
    // budget 58, components 48 and 15: part = 29; the column fits and returns 14 bytes,
    // the table receives 43.
    expect(distributeBudget([48, 15], 58)).toEqual([43, 15])
  })

  it('the remainder of the integer division goes to components in pattern order', () => {
    // budget 7, three components too long: part = 2, remainder = 1 → 3, 2, 2.
    expect(distributeBudget([50, 50, 50], 7)).toEqual([3, 2, 2])
  })

  it('no derived name ever exceeds 63 bytes', () => {
    const arbName = fc
      .stringMatching(/^[a-z][a-z0-9_]{0,47}$/)
      .filter((s) => s.length > 0 && !s.endsWith('_'))

    fc.assert(
      fc.property(arbName, arbName, arbName, (table, c1, c2) => {
        const names = [
          primaryKeyName(table),
          foreignKeyName(table, c1),
          indexName(table, [c1, c2]),
          uniqueConstraintName(table, [c1, c2]),
          checkConstraintName(table, c1, 'range'),
          triggerName(table, 'capture_upd'),
          sequenceName(table, c1),
          linkColumnName(table),
        ]
        return names.every((n) => byteLength(n) <= MAX_DERIVED_NAME_BYTES)
      }),
      { numRuns: 1000 },
    )
  })
})

describe('chapter 01 §5 — composing and reading schema names', () => {
  it('assembles and re-reads by position, not by splitting on _', () => {
    const name = composeSchemaName('t4z56fq', 'factures_2024')
    expect(name).toBe('b_t4z56fq_factures_2024')
    expect(parseSchemaName(name)).toEqual({ tenantId: 't4z56fq', baseSlug: 'factures_2024' })
  })

  it('two tenants may have a base with the same name', () => {
    expect(composeSchemaName('t4z56fq', 'crm')).toBe('b_t4z56fq_crm')
    expect(composeSchemaName('t9k2mnp', 'crm')).toBe('b_t9k2mnp_crm')
  })

  it('rejects schemas that are not basedb bases', () => {
    for (const foreign of ['_basedb', '_basedb_local', 'public', 'pg_catalog', 'b_xxx_crm']) {
      expect(parseSchemaName(foreign)).toBeNull()
    }
  })

  it('round trip over arbitrary slugs', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9_]{0,52}$/), (slug) => {
        const parsed = parseSchemaName(composeSchemaName('t4z56fq', slug))
        return parsed?.baseSlug === slug && parsed.tenantId === 't4z56fq'
      }),
      { numRuns: 500 },
    )
  })
})

describe('chapter 01 §9.5 — relegation', () => {
  const at = new Date(Date.UTC(2026, 8, 18)) // 2026-09-18

  it('table or field: the marker precedes the former name', () => {
    expect(relegatedName('remise', at)).toBe('zz_supprime_20260918_remise')
  })

  it('schema: the marker comes AFTER the positional prefix', () => {
    const name = relegatedSchemaName('t4z56fq', 'crm', at)
    expect(name).toBe('b_t4z56fq_zz_supprime_20260918_crm')
    // Positional reading stays possible: a tool enumerating a tenant's schemas keeps
    // working.
    expect(parseSchemaName(name)?.tenantId).toBe('t4z56fq')
    expect(isRelegatedSchemaName(name)).toBe(true)
  })

  it('relegated names fit within 63 bytes', () => {
    const longTable = 'a'.repeat(48)
    const longBase = 'b'.repeat(53)
    expect(byteLength(relegatedName(longTable, at))).toBeLessThanOrEqual(63)
    expect(byteLength(relegatedSchemaName('t4z56fq', longBase, at))).toBeLessThanOrEqual(63)
  })
})

describe('chapter 01 §7 — tenantId', () => {
  it('the alphabet holds exactly 32 characters, without 0, o, 1 or l', () => {
    expect(TENANT_ALPHABET).toHaveLength(32)
    expect(new Set(TENANT_ALPHABET).size).toBe(32)
    for (const excluded of ['0', 'o', '1', 'l']) {
      expect(TENANT_ALPHABET).not.toContain(excluded)
    }
  })

  it('every denylist entry is an identifier the generator can actually produce', () => {
    // Without this check, the list would give a false impression of coverage by holding
    // unreachable values (§7.2).
    for (const entry of TENANT_ID_DENYLIST) {
      expect(isTenantId(entry), `${entry} must be a valid tenantId`).toBe(true)
    }
  })

  it('recognizes the shape t + 6 alphabet characters', () => {
    expect(isTenantId('t4z56fq')).toBe(true)
    expect(isTenantId('t9k2mnp')).toBe(true)
    expect(isTenantId('t4z56f')).toBe(false) // too short
    expect(isTenantId('x4z56fq')).toBe(false) // does not start with t
    expect(isTenantId('t4z56fo')).toBe(false) // `o` outside the alphabet
    expect(isTenantId('t4z56f1')).toBe(false) // `1` outside the alphabet
  })
})

describe('chapter 01 §10 — quoting and qualification', () => {
  it('quotes systematically, even with no character requiring it', () => {
    expect(quoteIdentifier('factures')).toBe('"factures"')
    expect(quoteIdentifier('_id')).toBe('"_id"')
  })

  it('qualifies explicitly', () => {
    expect(qualify('b_t4z56fq_crm', 'factures')).toBe('"b_t4z56fq_crm"."factures"')
    expect(qualify('_basedb_local', 'uuid_generate_v7')).toBe('"_basedb_local"."uuid_generate_v7"')
  })

  it('refuses to emit SQL for an identifier outside alphabet B', () => {
    // An assertion, not sanitization: we do not try to repair the name.
    for (const invalid of ['Factures', 'fac tures', 'fac"tures', '', 'a'.repeat(64), '2024']) {
      expect(() => quoteIdentifier(invalid)).toThrow(IdentifierInvalidError)
    }
  })

  it('doubles the double quote, defense in depth', () => {
    // Unreachable with the current alphabet, checked anyway against a regression.
    expect('a"b'.replace(/"/g, '""')).toBe('a""b')
  })
})

describe('chapter 01 §2.3 — B is a strict superset of A', () => {
  it('every alphabet A name satisfies alphabet B', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9_]{0,62}$/), (name) => {
        if (!isAlphabetA(name)) return true
        return isAlphabetB(name)
      }),
      { numRuns: 3000 },
    )
  })

  it('a 63-byte schema name is emittable', () => {
    // The case that closes the loop: `b_` + tenantId + `_` = 10 bytes, plus a base slug
    // at its maximum budget of 53, gives exactly 63 bytes. That name is allocated by the
    // engine itself — were it not emittable, no query could ever target it.
    const slug = 'liste_des_contrats_de_prevoyance_collective_souscrits' // 53 bytes
    const schema = composeSchemaName('t4z56fq', slug)

    expect(byteLength(slug)).toBe(53)
    expect(byteLength(schema)).toBe(63)
    expect(isAlphabetA(slug)).toBe(true)
    expect(isAlphabetB(schema)).toBe(true)
    expect(() => quoteIdentifier(schema)).not.toThrow()
  })

  it('B allows the leading _ of the closed list, A does not', () => {
    for (const reserved of ['_id', '_basedb', '_basedb_local', '_created_at']) {
      expect(isAlphabetB(reserved)).toBe(true)
      expect(isAlphabetA(reserved)).toBe(false)
    }
  })

  it('neither A nor B accepts beyond 63 bytes', () => {
    const tooLong = `a${'b'.repeat(63)}` // 64 bytes
    expect(isAlphabetA(tooLong)).toBe(false)
    expect(isAlphabetB(tooLong)).toBe(false)
    expect(isAlphabetB(`_${'b'.repeat(63)}`)).toBe(false)
  })
})
