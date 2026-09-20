import { describe, expect, it } from 'vitest'
import type { BasedbError } from '../../src/errors/index.js'
import { BUDGETS, type FilterableColumn, buildFilter, buildSort } from '../../src/records/filter.js'

/**
 * The grammar of chapter 08 §4.1 and the thirteen operators of chapter 04 §9.
 *
 * What these tests look for first is not that the SQL is pretty: it is that NO string
 * from the caller reaches it. Each case therefore checks that the value sits in the
 * parameters, not in the text.
 */

const COLUMNS = new Map<string, FilterableColumn>([
  ['numero', { name: 'numero', kind: 'short_text' }],
  ['objet', { name: 'objet', kind: 'long_text' }],
  ['montant', { name: 'montant', kind: 'number' }],
  ['payee', { name: 'payee', kind: 'boolean' }],
  ['date_emission', { name: 'date_emission', kind: 'date' }],
  ['statut', { name: 'statut', kind: 'select' }],
  ['clients_id', { name: 'clients_id', kind: 'link' }],
])

/** Returns the error code raised, or fails the test if nothing is raised. */
function codeOf(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    return (e as BasedbError).code
  }
  throw new Error('no error raised')
}

describe('grammar', () => {
  it('gives `and` precedence over `or`', () => {
    // `a or b and c` must read as `a or (b and c)`. A left-to-right reading would give
    // `(a or b) and c`, which does not have the same solution set.
    const { sql } = buildFilter('payee eq true or montant gt 10 and montant lt 20', COLUMNS)
    expect(sql).toBe(
      '("payee" = $1::boolean OR ("montant" > $2::numeric AND "montant" < $3::numeric))',
    )
  })

  it('lets parentheses override precedence', () => {
    const { sql } = buildFilter('(payee eq true or montant gt 10) and montant lt 20', COLUMNS)
    expect(sql).toBe(
      '(("payee" = $1::boolean OR "montant" > $2::numeric) AND "montant" < $3::numeric)',
    )
  })

  it('accepts keywords in any case', () => {
    const a = buildFilter('payee eq true AND montant gt 10', COLUMNS)
    const b = buildFilter('payee eq true and montant gt 10', COLUMNS)
    expect(a.sql).toBe(b.sql)
  })

  it('applies `not` to the predicate that follows', () => {
    const { sql } = buildFilter('not statut in ["paye", "annule"]', COLUMNS)
    expect(sql).toBe('NOT ("statut" = ANY($1::text[]))')
  })

  it('refuses an incomplete expression', () => {
    expect(codeOf(() => buildFilter('montant gt', COLUMNS))).toBe('REQUEST_INVALID')
    expect(codeOf(() => buildFilter('(montant gt 1', COLUMNS))).toBe('REQUEST_INVALID')
    expect(codeOf(() => buildFilter('montant gt 1 and', COLUMNS))).toBe('REQUEST_INVALID')
  })

  it('accepts a bare date, without quotes', () => {
    // Without this, `_updated_at gte 2026-01-01` — the only way to resume after a
    // consumer outage — would require quoting nobody writes by hand.
    const { params } = buildFilter('date_emission gte 2026-01-01', COLUMNS)
    expect(params).toEqual(['2026-01-01'])
  })
})

describe('system columns', () => {
  it('are filterable without appearing in the mask (A18)', () => {
    const { sql, params } = buildFilter('_updated_at gte 2026-01-01T00:00:00Z', COLUMNS)
    expect(sql).toBe('"_updated_at" >= $1::timestamptz')
    expect(params).toEqual(['2026-01-01T00:00:00Z'])
  })

  it('are sortable, and `_id` always breaks the tie', () => {
    expect(buildSort('-_updated_at', COLUMNS).sql).toBe('"_updated_at" DESC, "_id" ASC')
  })
})

describe('masking', () => {
  it('makes a masked field indistinguishable from a non-existent one', () => {
    // This is the attack of §4.3: `salaire gte 50000`, then 25000, then 37500, reads a
    // masked column by dichotomy merely by observing which rows come back.
    expect(codeOf(() => buildFilter('salaire gte 50000', COLUMNS))).toBe('FILTER_FIELD_UNKNOWN')
    expect(codeOf(() => buildFilter('champ_inexistant eq 1', COLUMNS))).toBe('FILTER_FIELD_UNKNOWN')
  })

  it('applies the same rule to sorting', () => {
    // `sort=salaire` would hand over the full ordering of the masked column.
    expect(codeOf(() => buildSort('salaire', COLUMNS))).toBe('SORT_FIELD_UNKNOWN')
  })
})

describe('operators', () => {
  it('refuses an operator outside the closed vocabulary', () => {
    expect(codeOf(() => buildFilter('montant like 5', COLUMNS))).toBe('FILTER_OPERATOR_INVALID')
  })

  it('refuses an operator the type does not declare', () => {
    // Long text is searched, not compared.
    expect(codeOf(() => buildFilter('objet eq "x"', COLUMNS))).toBe('FILTER_OPERATOR_INVALID')
    expect(codeOf(() => buildFilter('payee gt true', COLUMNS))).toBe('FILTER_OPERATOR_INVALID')
    expect(codeOf(() => buildFilter('clients_id contains "a"', COLUMNS))).toBe(
      'FILTER_OPERATOR_INVALID',
    )
  })

  it('translates `is_null` with no parameter', () => {
    const { sql, params } = buildFilter('date_emission is_null', COLUMNS)
    expect(sql).toBe('"date_emission" IS NULL')
    expect(params).toEqual([])
  })

  it('translates `between` with bounds included', () => {
    const { sql, params } = buildFilter('montant between [10, 20]', COLUMNS)
    expect(sql).toBe('"montant" BETWEEN $1::numeric AND $2::numeric')
    expect(params).toEqual([10, 20])
  })

  it('translates `in` into a bound array, not a concatenated list', () => {
    const { sql, params } = buildFilter('statut in ["paye", "annule"]', COLUMNS)
    expect(sql).toBe('"statut" = ANY($1::text[])')
    expect(params).toEqual([['paye', 'annule']])
  })

  it('folds both sides of `eq_ci`', () => {
    // Folding one side only would make the comparison asymmetric: "Eodia" would find
    // "eodia" but not the other way round.
    const { sql } = buildFilter('numero eq_ci "FA-2026"', COLUMNS)
    expect(sql).toBe('_basedb_local.fold_v1("numero") = _basedb_local.fold_v1($1::text)')
  })
})

describe('injection', () => {
  it('lets no value reach the SQL text', () => {
    const hostile = '"; DROP TABLE factures; --'
    // The quote is escaped as the grammar requires; it is the COMPLETE value, quote
    // included, that must end up in the parameters.
    const escaped = hostile.replace(/"/g, '\\"')
    const { sql, params } = buildFilter(`numero eq "${escaped}"`, COLUMNS)
    expect(sql).toBe('"numero" = $1::text')
    expect(sql).not.toContain('DROP')
    expect(params).toEqual([hostile])
  })

  it('escapes LIKE metacharacters instead of letting them act', () => {
    // Without escaping, `contains "100%"` becomes a full table scan.
    const { sql, params } = buildFilter('numero contains "100%"', COLUMNS)
    expect(params).toEqual(['100\\%'])
    expect(sql).toContain("ESCAPE '\\'")
    // The bordering `%` are in the SQL, hence wildcards; the one in the value is bound,
    // hence literal.
    expect(sql).toBe(
      `_basedb_local.fold_v1("numero") LIKE '%' || _basedb_local.fold_v1($1::text) || '%' ESCAPE '\\'`,
    )
  })

  it('emits a border pattern only on the requested side', () => {
    expect(buildFilter('numero starts_with "FA"', COLUMNS).sql).toBe(
      `_basedb_local.fold_v1("numero") LIKE _basedb_local.fold_v1($1::text) || '%' ESCAPE '\\'`,
    )
    expect(buildFilter('numero ends_with "26"', COLUMNS).sql).toBe(
      `_basedb_local.fold_v1("numero") LIKE '%' || _basedb_local.fold_v1($1::text) ESCAPE '\\'`,
    )
  })
})

describe('coercion', () => {
  it('refuses a non-coercible value BEFORE emission', () => {
    // Letting PostgreSQL decide would surface a 22P02 translated into a server error,
    // where the contract requires a 400.
    expect(codeOf(() => buildFilter('montant eq "abc"', COLUMNS))).toBe('FILTER_VALUE_INVALID')
    expect(codeOf(() => buildFilter('date_emission eq "hier"', COLUMNS))).toBe(
      'FILTER_VALUE_INVALID',
    )
    expect(codeOf(() => buildFilter('clients_id eq "pas-un-uuid"', COLUMNS))).toBe(
      'FILTER_VALUE_INVALID',
    )
    expect(codeOf(() => buildFilter('payee eq "oui"', COLUMNS))).toBe('FILTER_VALUE_INVALID')
  })

  it('accepts a well-formed link identifier', () => {
    const uuid = '0195b1f4-6a2e-7c3d-8e9f-1a2b3c4d5e6f'
    const { sql, params } = buildFilter(`clients_id eq "${uuid}"`, COLUMNS)
    expect(sql).toBe('"clients_id" = $1::uuid')
    expect(params).toEqual([uuid])
  })
})

describe('budgets', () => {
  it('refuses a filter that is too long', () => {
    const long = `numero eq "${'a'.repeat(BUDGETS.bytes)}"`
    expect(codeOf(() => buildFilter(long, COLUMNS))).toBe('FILTER_TOO_LONG')
  })

  it('refuses more predicates than the bound', () => {
    const tooMany = Array.from({ length: BUDGETS.predicates + 1 }, () => 'payee eq true').join(
      ' and ',
    )
    expect(codeOf(() => buildFilter(tooMany, COLUMNS))).toBe('FILTER_TOO_COMPLEX')
  })

  it('stops the descent before a stack overflow', () => {
    // The counter is kept DURING parsing: checking the bound afterwards would assume
    // having survived the recursion, which is exactly what we want to avoid.
    const deep = `${'('.repeat(64)}payee eq true${')'.repeat(64)}`
    expect(codeOf(() => buildFilter(deep, COLUMNS))).toBe('FILTER_TOO_COMPLEX')
  })

  it('refuses an `in` list that is too long', () => {
    const elements = Array.from({ length: BUDGETS.inElements + 1 }, (_, i) => `"v${i}"`).join(',')
    expect(codeOf(() => buildFilter(`statut in [${elements}]`, COLUMNS))).toBe('FILTER_TOO_COMPLEX')
  })
})

describe('sorting', () => {
  it('always appends `_id` as the tie-break', () => {
    // Without it, two rows with the same value may swap places between two pages: the
    // pagination skips or repeats rows with nothing to signal it.
    expect(buildSort(undefined, COLUMNS).sql).toBe('"_id" ASC')
    expect(buildSort('montant', COLUMNS).sql).toBe('"montant" ASC, "_id" ASC')
  })

  it('reads the `-` prefix as a descending direction', () => {
    expect(buildSort('-montant,numero', COLUMNS).sql).toBe(
      '"montant" DESC, "numero" COLLATE "und-x-icu" ASC, "_id" ASC',
    )
  })

  it('emits the collation on textual fields, and on those alone', () => {
    // An ordering that depends on the instance locale is not reproducible between
    // development and production, and the cursor compares bounds that must be ordered
    // exactly as the index does (chapter 04 §1.8).
    expect(buildSort('numero', COLUMNS).sql).toContain('COLLATE "und-x-icu"')
    expect(buildSort('montant', COLUMNS).sql).not.toContain('COLLATE')
    expect(buildSort('date_emission', COLUMNS).sql).not.toContain('COLLATE')
  })

  it('refuses to sort a long text', () => {
    expect(codeOf(() => buildSort('objet', COLUMNS))).toBe('SORT_UNAVAILABLE')
  })

  it('refuses a repeated sort field', () => {
    expect(codeOf(() => buildSort('montant,-montant', COLUMNS))).toBe('REQUEST_INVALID')
  })
})

describe('link paths', () => {
  it('without a link table, a path is an unknown field', () => {
    // An unreadable target, a masked field and a non-existent field share one response:
    // telling them apart would allow enumerating a forbidden table's structure.
    expect(codeOf(() => buildFilter('clients_id.raison_sociale contains "a"', COLUMNS))).toBe(
      'FILTER_FIELD_UNKNOWN',
    )
  })
})

describe('alias and parameter offset', () => {
  it('qualifies the columns and shifts the numbering', () => {
    const { sql, params } = buildFilter('montant gt 10 and payee eq true', COLUMNS, {
      alias: 't',
      firstParameter: 3,
    })
    expect(sql).toBe('("t"."montant" > $3::numeric AND "t"."payee" = $4::boolean)')
    expect(params).toEqual([10, true])
  })
})
