import { checkTemplate, formulaInEnglish } from '@basedb/contracts'
import { bundledTemplates } from '@basedb/templates'
import { describe, expect, it } from 'vitest'
import { BasedbError } from '../../src/errors/index.js'
import {
  type FormulaField,
  type FormulaType,
  emitFormula,
  formulaDialect,
  parseFormula,
  renderFormula,
  resolveFormula,
} from '../../src/formula/language.js'

/**
 * The formula language — chapter 04 §7: French or English words, fields by label, typing
 * that refuses what PostgreSQL would refuse later, SQL emitted from the tree alone.
 */

const key = (label: string) => label.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

const FIELDS: readonly FormulaField[] = [
  { id: 'f-prix', label: 'Prix HT', name: 'prix_ht', kind: 'number', stored: true },
  { id: 'f-taux', label: 'Taux TVA', name: 'taux_tva', kind: 'number', stored: true },
  { id: 'f-nom', label: 'Nom', name: 'nom', kind: 'short_text', stored: true },
  { id: 'f-debut', label: 'Début', name: 'debut', kind: 'date', stored: true },
  { id: 'f-fin', label: 'Fin', name: 'fin', kind: 'date', stored: true },
  { id: 'f-quand', label: 'Quand', name: 'quand', kind: 'datetime', stored: true },
  { id: 'f-client', label: 'Client', name: 'clients_id', kind: 'link', stored: true },
  { id: 'f-ttc', label: 'TTC', name: 'ttc', kind: 'formula', stored: true },
  {
    id: 'f-total',
    label: 'Total factures',
    name: 'total_factures',
    kind: 'rollup',
    stored: false,
    resultKind: 'number',
  },
  {
    id: 'f-villes',
    label: 'Villes',
    name: 'villes',
    kind: 'lookup',
    stored: false,
    resultKind: 'short_text',
    multiple: true,
  },
  { id: 'f-crochet', label: 'Prix [HT]', name: 'prix_crochet', kind: 'number', stored: true },
]
const BY_KEY = new Map(FIELDS.map((f) => [key(f.label), f]))
const BY_ID = new Map(FIELDS.map((f) => [f.id, f]))

const resolve = (text: string) => resolveFormula(parseFormula(text), BY_KEY, key)

const TYPES: Readonly<Record<string, FormulaType>> = {
  number: 'number',
  short_text: 'text',
  date: 'date',
  datetime: 'datetime',
}
/** A date kept to the years 1 to 9999 — what the emitter writes around a conversion that could raise. */
const within = (sql: string) =>
  `(CASE WHEN ${sql} BETWEEN '0001-01-01'::date AND '9999-12-31'::date THEN ${sql} END)`
const formatted = (local: string, text: string, kind: 'date' | 'datetime' = 'date') =>
  kind === 'date'
    ? `(CASE WHEN ${local} BETWEEN '0001-01-01'::date AND '9999-12-31'::date THEN ${text} END)`
    : `(CASE WHEN ${local} BETWEEN '0001-01-01'::timestamp AND '9999-12-31 23:59:59.999999'::timestamp THEN ${text} END)`

const emit = (text: string) =>
  emitFormula(resolve(text).ast, {
    field: (id) => `"${BY_ID.get(id)?.name}"`,
    typeOf: (id) => {
      const f = BY_ID.get(id)
      return TYPES[f?.stored === false ? (f.resultKind ?? '') : (f?.kind ?? '')] ?? 'null'
    },
    timezone: 'Europe/Paris',
  })

function refusal(run: () => unknown): { code: string; details: Record<string, unknown> } {
  try {
    run()
  } catch (e) {
    expect(e).toBeInstanceOf(BasedbError)
    return { code: (e as BasedbError).code, details: { ...(e as BasedbError).details } }
  }
  throw new Error('expected a refusal')
}

describe('reading and typing', () => {
  it('reads fields by label, whatever their case, and types the result', () => {
    const r = resolve('[prix ht] * (1 + [Taux TVA])')
    expect(r.type).toBe('number')
    expect(r.stored).toBe(true)
    expect(r.dependencies.sort()).toEqual(['f-prix', 'f-taux'])
  })

  it('reads a doubled closing bracket inside a label', () => {
    expect(resolve('[Prix [HT]]] + 1').dependencies).toEqual(['f-crochet'])
  })

  it('types comparisons, logic and text', () => {
    expect(resolve('[Prix HT] > 100 ET NON ([Nom] = "x")').type).toBe('boolean')
    expect(resolve('[Nom] & " — " & [Prix HT]').type).toBe('text')
    expect(resolve('SI([Prix HT] > 100; "cher"; "abordable")').type).toBe('text')
  })

  it('computes between dates', () => {
    expect(resolve('[Fin] - [Début]').type).toBe('number')
    expect(resolve('JOURS([Fin]; [Début])').type).toBe('number')
    expect(resolve('[Début] + 7').type).toBe('date')
    expect(resolve('AJOUTER_JOURS([Début]; 30)').type).toBe('date')
  })

  it('makes a formula computed at read time when it reads the clock or a computed field', () => {
    const today = resolve('JOURS(AUJOURDHUI(); [Début])')
    expect(today.stored).toBe(false)
    expect(today.usesToday).toBe(true)
    expect(resolve('[Total factures] * 1.2').stored).toBe(false)
  })

  it('refuses what cannot be computed, by name', () => {
    expect(refusal(() => resolve('[Inconnu] + 1'))).toMatchObject({
      code: 'FORMULA_FIELD_NOT_FOUND',
      details: { field: 'Inconnu', position: 0 },
    })
    expect(refusal(() => resolve('[Client]')).code).toBe('FORMULA_LINK_FORBIDDEN')
    expect(refusal(() => resolve('[TTC] * 2')).code).toBe('FORMULA_DEPENDS_ON_FORMULA')
    expect(refusal(() => resolve('[Nom] + 1')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('[Villes]')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('TEXTE([Début])')).code).toBe('FORMULA_FUNCTION_NOT_IMMUTABLE')
    expect(refusal(() => resolve('TEXTE([Quand])')).code).toBe('FORMULA_FUNCTION_NOT_IMMUTABLE')
    expect(refusal(() => resolve('[Nom] & [Début]')).code).toBe('FORMULA_FUNCTION_NOT_IMMUTABLE')
    expect(refusal(() => resolve('HEURE([Début])')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('SI(1; 2)')).code).toBe('FORMULA_SYNTAX')
    expect(refusal(() => resolve('"ouvert')).code).toBe('FORMULA_SYNTAX')
    expect(refusal(() => resolve('FOO(1)')).code).toBe('FORMULA_SYNTAX')
  })
})

describe('English', () => {
  it('reads the English words into the same tree as the French ones', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['SI([Prix HT] > 100; "cher"; "abordable")', 'IF([Prix HT] > 100, "cher", "abordable")'],
      ['SIVIDE([Nom]; "?") & MAJUSCULE([Nom])', 'IFBLANK([Nom], "?") & UPPER([Nom])'],
      ['ESTVIDE([Nom]) OU NON VRAI ET FAUX', 'ISBLANK([Nom]) OR NOT TRUE AND FALSE'],
      ['ARRONDI(ABS([Prix HT]); 2)', 'ROUND(ABS([Prix HT]), 2)'],
      ['PLAFOND([Prix HT]) + PLANCHER([Taux TVA])', 'CEILING([Prix HT]) + FLOOR([Taux TVA])'],
      ['MIN([Début]; [Fin])', 'MIN([Début], [Fin])'],
      ['MINUSCULE(SANSESPACES([Nom]))', 'LOWER(TRIM([Nom]))'],
      ['GAUCHE([Nom]; 2) & DROITE([Nom]; 2)', 'LEFT([Nom], 2) & RIGHT([Nom], 2)'],
      ['LONGUEUR(TEXTE(NOMBRE([Nom])))', 'LEN(TEXT(VALUE([Nom])))'],
      [
        'ANNEE([Début]) + MOIS([Début]) + JOUR([Début])',
        'YEAR([Début]) + MONTH([Début]) + DAY([Début])',
      ],
      ['JOURSEMAINE(DATE(2026; 9; 27))', 'WEEKDAY(DATE(2026, 9, 27))'],
      ['JOURS(AJOUTER_JOURS([Fin]; 3); AUJOURDHUI())', 'DAYS(ADD_DAYS([Fin], 3), TODAY())'],
      ['MAINTENANT()', 'now()'],
      [
        'STXT([Nom]; 2; 3) & SUBSTITUE([Nom]; "a"; "b")',
        'MID([Nom], 2, 3) & SUBSTITUTE([Nom], "a", "b")',
      ],
      ['TROUVE("a"; [Nom]) + CHERCHE("a"; [Nom])', 'FIND("a", [Nom]) + SEARCH("a", [Nom])'],
      [
        'SI(CONTIENT([Nom]; "a") ET COMMENCEPAR([Nom]; "a") ET FINITPAR([Nom]; "a"); NOMPROPRE([Nom]); REPT("-"; 3))',
        'IF(CONTAINS([Nom], "a") AND STARTSWITH([Nom], "a") AND ENDSWITH([Nom], "a"), PROPER([Nom]), REPT("-", 3))',
      ],
      [
        'CONCAT([Nom]; "!") & JOINDRE_TEXTE(", "; VRAI; [Nom]; [Nom])',
        'CONCAT([Nom], "!") & TEXTJOIN(", ", TRUE, [Nom], [Nom])',
      ],
      [
        'REGEX_CORRESPOND([Nom]; "a") & REGEX_EXTRAIRE([Nom]; "a") & REGEX_REMPLACER([Nom]; "a"; "b")',
        'REGEXMATCH([Nom], "a") & REGEXEXTRACT([Nom], "a") & REGEXREPLACE([Nom], "a", "b")',
      ],
      [
        'TEXTE([Début]; "jj/mm/aaaa") & HEURE([Quand]) & MINUTE([Quand]) & SECONDE([Quand])',
        'TEXT([Début], "jj/mm/aaaa") & HOUR([Quand]) & MINUTE([Quand]) & SECOND([Quand])',
      ],
      [
        'JOURS(AJOUTER_MOIS([Début]; 1); FIN_MOIS([Début]; 1)) + DATEDIF([Début]; [Fin]; "M")',
        'DAYS(ADD_MONTHS([Début], 1), EOMONTH([Début], 1)) + DATEDIF([Début], [Fin], "M")',
      ],
      ['NO_SEMAINE_ISO([Début])', 'ISOWEEKNUM([Début])'],
    ]
    for (const [french, english] of pairs) expect(resolve(english).ast).toEqual(resolve(french).ast)
  })

  it('takes a comma or a semicolon between arguments, in either language', () => {
    expect(resolve('SI([Prix HT] > 1, 2; 3)').ast).toEqual(resolve('IF([Prix HT] > 1; 2, 3)').ast)
  })

  it('renders in English, and the English reads back to the same tree', () => {
    const { ast } = resolve(
      'SI(NON ESTVIDE([Nom]) ET VRAI; ARRONDI([Prix HT]; 2); AUJOURDHUI() - [Début])',
    )
    const label = (id: string) => BY_ID.get(id)?.label ?? id
    const english = renderFormula(ast, label, 'en')
    expect(english).toBe('IF(NOT ISBLANK([Nom]) AND TRUE, ROUND([Prix HT], 2), TODAY() - [Début])')
    expect(renderFormula(ast, label)).toBe(
      'SI(NON ESTVIDE([Nom]) ET VRAI; ARRONDI([Prix HT]; 2); AUJOURDHUI() - [Début])',
    )
    expect(resolve(english).ast).toEqual(ast)
  })

  it('reads every formula of the official templates, once in English, as the same tree', () => {
    // Positions aside: the English words are not as long as the French ones.
    const tree = (text: string) =>
      JSON.stringify(parseFormula(text), (k, v) => (k === 'at' ? undefined : v))
    const formulas = bundledTemplates().flatMap(({ raw }) => {
      const check = checkTemplate(raw)
      if (!check.ok) return []
      return check.template.tables.flatMap((t) => t.fields.flatMap((f) => f.formula ?? []))
    })
    expect(formulas.length).toBeGreaterThan(0)
    for (const formula of formulas) expect(tree(formulaInEnglish(formula))).toBe(tree(formula))
  })

  it('writes in French on a French screen only', () => {
    expect(formulaDialect('fr')).toBe('fr')
    expect(formulaDialect('en')).toBe('en')
    expect(formulaDialect('de')).toBe('en')
    expect(formulaDialect('ja')).toBe('en')
  })
})

describe('emitting SQL', () => {
  it('guards division, bounds every cast to int, uses || rather than concat()', () => {
    expect(emit('[Prix HT] / [Taux TVA]')).toBe(
      '(CASE WHEN "taux_tva" = 0 OR "taux_tva" IS NULL THEN NULL ELSE "prix_ht" / "taux_tva" END)',
    )
    expect(emit('ARRONDI([Prix HT]; 2)')).toBe(
      'round("prix_ht", least(greatest(2::numeric, -1000), 1000)::int)',
    )
    expect(emit('[Nom] & [Prix HT]')).toBe(
      `(coalesce("nom"::text, '') || coalesce(trim_scale("prix_ht")::text, ''))`,
    )
  })

  it('re-emits text literals from their value', () => {
    expect(emit(`"l'été ""chaud"""`)).toBe(`'l''été "chaud"'::text`)
  })

  it('reads today in the field time zone', () => {
    expect(emit('AUJOURDHUI()')).toBe(`(pg_catalog.now() AT TIME ZONE 'Europe/Paris')::date`)
  })
})

describe('text functions', () => {
  it('types them', () => {
    expect(resolve('STXT([Nom]; 2; 3)').type).toBe('text')
    expect(resolve('SUBSTITUE([Nom]; "a"; "b")').type).toBe('text')
    expect(resolve('TROUVE("a"; [Nom])').type).toBe('number')
    expect(resolve('CHERCHE("a"; [Nom])').type).toBe('number')
    expect(resolve('CONTIENT([Nom]; "a")').type).toBe('boolean')
    expect(resolve('COMMENCEPAR([Nom]; "a")').type).toBe('boolean')
    expect(resolve('FINITPAR([Nom]; "a")').type).toBe('boolean')
    expect(resolve('NOMPROPRE([Nom])').type).toBe('text')
    expect(resolve('REPT("-"; [Prix HT])').type).toBe('text')
    expect(resolve('CONCAT([Nom]; " "; [Prix HT]; VRAI)').type).toBe('text')
    expect(resolve('JOINDRE_TEXTE(", "; VRAI; [Nom]; [Prix HT])').type).toBe('text')
    // Stored: a generated column can hold them all.
    for (const text of ['STXT([Nom]; 2; 3)', 'CONTIENT([Nom]; "a")', 'REPT("-"; 3)']) {
      expect(resolve(text).stored).toBe(true)
    }
  })

  it('refuses what is not text, and a date turned into text without a format', () => {
    expect(refusal(() => resolve('STXT([Prix HT]; 1; 2)')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('STXT([Nom]; "1"; 2)')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('SUBSTITUE([Nom]; 1; "b")')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('CONTIENT([Prix HT]; "a")')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('REPT([Nom]; "a")')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('CONCAT([Nom]; [Début])'))).toMatchObject({
      code: 'FORMULA_FUNCTION_NOT_IMMUTABLE',
      details: { function: 'CONCAT', reason: 'date_en_texte' },
    })
    expect(refusal(() => resolve('JOINDRE_TEXTE(","; VRAI; [Quand])')).code).toBe(
      'FORMULA_FUNCTION_NOT_IMMUTABLE',
    )
  })

  it('counts its arguments, a range for the variadic ones', () => {
    expect(refusal(() => resolve('STXT([Nom]; 1)'))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'arguments:STXT:3' },
    })
    expect(refusal(() => resolve('CONCAT()'))).toMatchObject({
      details: { detail: 'arguments:CONCAT:1-32' },
    })
    expect(refusal(() => resolve('JOINDRE_TEXTE(","; VRAI)'))).toMatchObject({
      details: { detail: 'arguments:JOINDRE_TEXTE:3-34' },
    })
    const many = Array.from({ length: 33 }, () => '"a"').join('; ')
    expect(refusal(() => resolve(`CONCAT(${many})`)).code).toBe('FORMULA_SYNTAX')
  })

  it('emits STXT with the bounds of GAUCHE, and an absent number stays absent', () => {
    expect(emit('STXT([Nom]; 2; 3)')).toBe('substr("nom", 2, 3)')
    expect(emit('STXT([Nom]; 0; 99999999)')).toBe('substr("nom", 1, 1000000)')
    // `greatest` and `least` skip a NULL: without the test, an empty start would mean 1.
    expect(emit('STXT([Nom]; [Prix HT]; 3)')).toBe(
      'substr("nom", (CASE WHEN "prix_ht" IS NULL THEN NULL ELSE trunc(least(greatest("prix_ht", 1), 1000000))::int END), 3)',
    )
  })

  it('emits replacement and search from immutable functions', () => {
    expect(emit('SUBSTITUE([Nom]; "a"; "b")')).toBe(`replace("nom", 'a'::text, 'b'::text)`)
    expect(emit('TROUVE("x"; [Nom])')).toBe(`nullif(strpos("nom", 'x'::text), 0)::numeric`)
    expect(emit('CHERCHE("x"; [Nom])')).toBe(
      `nullif(strpos(lower("nom" COLLATE "und-x-icu"), 'x'::text), 0)::numeric`,
    )
    // Two fields: the text of each is lowered by the database.
    expect(emit('CHERCHE([Nom]; [Nom])')).toBe(
      `nullif(strpos(lower("nom" COLLATE "und-x-icu"), lower("nom" COLLATE "und-x-icu")), 0)::numeric`,
    )
    // A text written in the formula is lowered in the formula, with the same case rules.
    expect(emit('CHERCHE("ÉA"; [Nom])')).toContain(`'éa'::text`)
    expect(emit('NOMPROPRE([Nom])')).toBe(`initcap("nom" COLLATE "und-x-icu")`)
  })

  it('reads CONTIENT, COMMENCEPAR and FINITPAR as the filters do, folded', () => {
    expect(emit('CONTIENT([Nom]; "é")')).toBe(
      `(strpos(_basedb_local.fold_v1("nom"), _basedb_local.fold_v1('é'::text)) > 0)`,
    )
    expect(emit('COMMENCEPAR([Nom]; "a")')).toBe(
      `starts_with(_basedb_local.fold_v1("nom"), _basedb_local.fold_v1('a'::text))`,
    )
    // PostgreSQL has no ends_with: the two texts are turned round.
    expect(emit('FINITPAR([Nom]; "a")')).toBe(
      `starts_with(reverse(_basedb_local.fold_v1("nom")), reverse(_basedb_local.fold_v1('a'::text)))`,
    )
  })

  it('refuses to repeat past what a column can hold', () => {
    expect(emit('REPT("ab"; 3)')).toBe(
      `(CASE WHEN length('ab'::text)::bigint * 3 > 32767 THEN NULL ELSE repeat('ab'::text, 3) END)`,
    )
    expect(emit('REPT("ab"; 99999)')).toContain('* 32767 >')
    expect(emit('REPT([Nom]; [Prix HT])')).toContain('"prix_ht" IS NULL THEN NULL')
  })

  it('joins like & does: an absent text is empty, a number has no trailing zeros', () => {
    expect(emit('CONCAT([Nom]; [Prix HT])')).toBe(
      `(coalesce("nom"::text, '') || coalesce(trim_scale("prix_ht")::text, ''))`,
    )
    expect(emit('CONCAT([Nom])')).toBe(`(coalesce("nom"::text, ''))`)
  })

  it('joins with a separator, leaving out the empty parts when asked', () => {
    expect(emit('JOINDRE_TEXTE(" - "; FAUX; [Nom]; "x")')).toBe(
      `(coalesce("nom"::text, '') || ' - ' || coalesce('x'::text::text, ''))`,
    )
    // The separator comes before each part that is not empty, and the first one is cut.
    expect(emit(`JOINDRE_TEXTE(", "; VRAI; [Nom]; "x")`)).toBe(
      `substr((CASE WHEN length("nom"::text) > 0 THEN ', ' || "nom"::text ELSE '' END) || (', ' || 'x'), 3)`,
    )
    // Counted in characters, not in bytes.
    expect(emit('JOINDRE_TEXTE("→"; VRAI; [Nom])')).toContain(', 2)')
  })

  it('wants the separator and the choice written, never read from a field', () => {
    expect(refusal(() => resolve('JOINDRE_TEXTE([Nom]; VRAI; "a")'))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'texte_ecrit_attendu:JOINDRE_TEXTE:separateur' },
    })
    expect(refusal(() => resolve('JOINDRE_TEXTE(","; [Prix HT] > 1; "a")'))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'valeur_ecrite_attendue:JOINDRE_TEXTE:ignorer_vides' },
    })
    expect(refusal(() => resolve('JOINDRE_TEXTE(","; 1; "a")')).code).toBe('FORMULA_TYPE_MISMATCH')
  })

  it('stops a formula whose SQL grows past a ceiling, rather than building it', () => {
    // A division repeats its divisor three times: fourteen levels would be millions of copies.
    let nested = '[Prix HT]'
    for (let i = 0; i < 14; i++) nested = `[Prix HT] / (${nested})`
    expect(refusal(() => emit(nested))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'formule_trop_complexe' },
    })
    // A reasonable nesting passes.
    expect(emit('LONGUEUR(STXT([Nom]; LONGUEUR(STXT([Nom]; 1; 2)); 1))')).toContain('substr')
  })
})

describe('regular expressions', () => {
  it('types them, and lists the patterns for the catalog to try against PostgreSQL', () => {
    const text = 'REGEX_CORRESPOND([Nom]; "^[A-Z]")'
    const resolved = resolve(text)
    expect(resolved.type).toBe('boolean')
    expect(resolved.stored).toBe(true)
    expect(resolved.patterns).toEqual([
      { pattern: '^[A-Z]', fn: 'REGEX_CORRESPOND', position: text.indexOf('"') },
    ])
    expect(resolve('REGEX_EXTRAIRE([Nom]; "[0-9]+")').type).toBe('text')
    expect(resolve('REGEX_REMPLACER([Nom]; "[0-9]+"; [Nom])').type).toBe('text')
    expect(resolve('1 + 1').patterns).toEqual([])
  })

  it('emits PostgreSQL regular expressions on a pinned collation', () => {
    expect(emit('REGEX_CORRESPOND([Nom]; "^a")')).toBe(`(("nom") COLLATE "und-x-icu" ~ '^a'::text)`)
    expect(emit('REGEX_EXTRAIRE([Nom]; "(\\d+)-")')).toBe(
      `substring(("nom") COLLATE "und-x-icu", '(\\d+)-'::text)`,
    )
    expect(emit(`REGEX_REMPLACER([Nom]; "l'a"; "\\1")`)).toBe(
      `regexp_replace(("nom") COLLATE "und-x-icu", 'l''a'::text, '\\1'::text, 'g')`,
    )
  })

  it('wants the pattern written in the formula: a pattern read from a row could break that row', () => {
    expect(refusal(() => resolve('REGEX_CORRESPOND([Nom]; [Nom])'))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'texte_ecrit_attendu:REGEX_CORRESPOND:motif' },
    })
    expect(refusal(() => resolve('REGEX_REMPLACER([Nom]; "a" & "b"; "c")')).code).toBe(
      'FORMULA_SYNTAX',
    )
  })

  it('refuses a back-reference, which makes the matcher exponential', () => {
    expect(refusal(() => resolve('REGEX_CORRESPOND([Nom]; "(a+)\\1")'))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'motif_refuse:REGEX_CORRESPOND:reference_arriere' },
    })
    // An escaped backslash followed by a digit is not one.
    expect(resolve('REGEX_CORRESPOND([Nom]; "a\\\\1")').patterns).toHaveLength(1)
    // Nor is the replacement a pattern: « \\1 » there is the first group.
    expect(resolve('REGEX_REMPLACER([Nom]; "(a)"; "\\1")').patterns).toHaveLength(1)
  })

  it('refuses a pattern altered in the stored tree', () => {
    const { ast } = resolve('REGEX_CORRESPOND([Nom]; "a")')
    const forged = JSON.parse(JSON.stringify(ast).replace('"v":"a"', '"v":"(a)\\\\1"'))
    expect(
      refusal(() =>
        emitFormula(forged, {
          field: () => '"nom"',
          typeOf: () => 'text',
          timezone: 'UTC',
        }),
      ).code,
    ).toBe('FORMULA_SYNTAX')
  })
})

describe('TEXTE(date; format)', () => {
  it('writes a date from numeric parts, in either language', () => {
    const french = resolve('TEXTE([Début]; "jj/mm/aaaa")')
    expect(french.type).toBe('text')
    expect(french.stored).toBe(true)
    // The format is kept as it was typed; its codes mean the same in both languages.
    expect(emit('TEXT([Début], "dd/mm/yyyy")')).toBe(emit('TEXTE([Début]; "jj/mm/aaaa")'))
    expect(emit('TEXTE([Début]; "jj/mm/aaaa")')).toBe(
      formatted(
        '("debut")',
        `lpad(extract(day from ("debut"))::int::text, 2, '0') || '/' || lpad(extract(month from ("debut"))::int::text, 2, '0') || '/' || lpad(extract(year from ("debut"))::int::text, 4, '0')`,
      ),
    )
  })

  it('knows the codes: years on two or four digits, days and months on one or two', () => {
    expect(emit('TEXTE([Début]; "aa")')).toBe(
      formatted('("debut")', `lpad((extract(year from ("debut"))::int % 100)::text, 2, '0')`),
    )
    expect(emit('TEXTE([Début]; "j.m")')).toBe(
      formatted(
        '("debut")',
        `extract(day from ("debut"))::int::text || '.' || extract(month from ("debut"))::int::text`,
      ),
    )
    // Capitals and lower case are the same code, and what is not a letter is written as it is.
    expect(emit('TEXTE([Début]; "AAAA-MM-JJ")')).toBe(emit('TEXTE([Début]; "aaaa-mm-jj")'))
    expect(emit('TEXTE([Début]; "jj à (aa)")')).toContain(`|| ' à (' ||`)
  })

  it('turns a minute from a month by its neighbours, as a spreadsheet does', () => {
    const sql = emit('TEXTE([Quand]; "mm/jj hh:mm:ss")')
    // The first « mm » is the month, the second follows the hour: a minute.
    expect(sql.indexOf('extract(month')).toBeLessThan(sql.indexOf('extract(day'))
    expect(sql).toContain('extract(minute from')
    expect(sql.match(/extract\(month/g)).toHaveLength(1)
    expect(emit('TEXTE([Quand]; "mm:ss")')).toContain('extract(minute from')
    expect(emit('TEXTE([Quand]; "ss")')).toContain('floor(extract(second from')
  })

  it('reads a date and time in the zone of the formula, and is then computed at read time', () => {
    const r = resolve('TEXTE([Quand]; "aaaa-mm-jj hh:mm")')
    expect(r.stored).toBe(false)
    expect(r.usesTimezone).toBe(true)
    expect(r.usesToday).toBe(false)
    const wall = `("quand" AT TIME ZONE 'Europe/Paris')`
    expect(emit('TEXTE([Quand]; "aaaa")')).toBe(
      formatted(wall, `lpad(extract(year from ${wall})::int::text, 4, '0')`, 'datetime'),
    )
  })

  it('keeps escaping a letter with a backslash', () => {
    expect(emit('TEXTE([Début]; "aaaa\\Tjj")')).toContain(`|| 'T' ||`)
    expect(emit('TEXTE([Début]; "\\l\\u")')).toContain(`'lu'`)
  })

  it('refuses a letter that is no code, names, and an hour on a date', () => {
    for (const [format, detail] of [
      ['lundi', 'format_inconnu:l'],
      ['jjjj', 'format_inconnu:jjjj'],
      ['mmmm aaaa', 'format_inconnu:mmmm'],
      ['aaa', 'format_inconnu:aaa'],
      ['jj\\', 'format_inconnu:\\'],
    ] as const) {
      expect(
        refusal(() => resolve(`TEXTE([Début]; "${format}")`)),
        format,
      ).toMatchObject({
        code: 'FORMULA_SYNTAX',
        details: { detail },
      })
    }
    expect(refusal(() => resolve('TEXTE([Début]; "jj hh")'))).toMatchObject({
      code: 'FORMULA_TYPE_MISMATCH',
      details: { detail: 'TEXTE:heure_sur_date' },
    })
    // A date and time may ask for an hour.
    expect(resolve('TEXTE([Quand]; "jj hh")').type).toBe('text')
  })

  it('wants a date, and a format written in the formula', () => {
    expect(refusal(() => resolve('TEXTE([Prix HT]; "0.00")')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('TEXTE([Nom]; "jj")')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('TEXTE([Début]; [Nom])'))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'texte_ecrit_attendu:TEXTE:format' },
    })
    expect(refusal(() => resolve('TEXTE([Début]; "jj"; 1)'))).toMatchObject({
      details: { detail: 'arguments:TEXTE:1-2' },
    })
    // The one-argument forms are as they were.
    expect(resolve('TEXTE([Prix HT])').type).toBe('text')
  })
})

describe('date functions', () => {
  it('moves a date by months, as the end of the month holds', () => {
    expect(resolve('AJOUTER_MOIS([Début]; 3)').type).toBe('date')
    expect(emit('AJOUTER_MOIS([Début]; 3)')).toBe(
      `(${within('"debut"')} + make_interval(months => 3))::date`,
    )
    expect(emit('AJOUTER_MOIS([Début]; -3)')).toContain('(-3::numeric)')
    expect(emit('AJOUTER_MOIS([Début]; 999999)')).toContain('months => 12000)')
    expect(emit('AJOUTER_MOIS([Début]; [Prix HT])')).toContain('"prix_ht" IS NULL THEN NULL')
    expect(refusal(() => resolve('AJOUTER_MOIS([Nom]; 1)')).code).toBe('FORMULA_TYPE_MISMATCH')
    expect(refusal(() => resolve('AJOUTER_MOIS([Début]; "1")')).code).toBe('FORMULA_TYPE_MISMATCH')
  })

  it('finds the last day of a month, this one when no shift is given', () => {
    expect(resolve('FIN_MOIS([Début])').type).toBe('date')
    expect(emit('FIN_MOIS([Début])')).toBe(
      `(date_trunc('month', ${within('"debut"')} + make_interval(months => 0)) + interval '1 month' - interval '1 day')::date`,
    )
    expect(emit('FIN_MOIS([Début]; 2)')).toContain('make_interval(months => 2)')
    expect(refusal(() => resolve('FIN_MOIS()')).code).toBe('FORMULA_SYNTAX')
    expect(refusal(() => resolve('FIN_MOIS([Début]; 1; 2)')).code).toBe('FORMULA_SYNTAX')
  })

  it('counts whole years, whole months, days, and the months left after the years', () => {
    expect(resolve('DATEDIF([Début]; [Fin]; "M")').type).toBe('number')
    const age = `age(${within('"fin"')}::timestamp, ${within('"debut"')}::timestamp)`
    expect(emit('DATEDIF([Début]; [Fin]; "Y")')).toBe(`extract(year from ${age})::numeric`)
    expect(emit('DATEDIF([Début]; [Fin]; "m")')).toBe(
      `(extract(year from ${age}) * 12 + extract(month from ${age}))::numeric`,
    )
    expect(emit('DATEDIF([Début]; [Fin]; "ym")')).toBe(`extract(month from ${age})::numeric`)
    expect(emit('DATEDIF([Début]; [Fin]; "D")')).toBe(
      `((${within('"fin"')} - ${within('"debut"')})::numeric)`,
    )
  })

  it('refuses a unit it does not know, or one read from a field', () => {
    expect(refusal(() => resolve('DATEDIF([Début]; [Fin]; "MD")'))).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'unite_inconnue:MD' },
    })
    expect(refusal(() => resolve('DATEDIF([Début]; [Fin]; [Nom])'))).toMatchObject({
      details: { detail: 'texte_ecrit_attendu:DATEDIF:unite' },
    })
    expect(refusal(() => resolve('DATEDIF([Début]; [Prix HT]; "Y")')).code).toBe(
      'FORMULA_TYPE_MISMATCH',
    )
  })

  it('numbers the ISO week', () => {
    expect(resolve('NO_SEMAINE_ISO([Début])').type).toBe('number')
    expect(emit('NO_SEMAINE_ISO([Début])')).toBe(`extract(week from "debut")::numeric`)
  })

  it('keeps the date functions that existed as they were emitted', () => {
    expect(emit('ANNEE([Début])')).toBe(`extract(year from "debut")::numeric`)
    expect(emit('JOURS([Fin]; [Début])')).toBe(`(("fin" - "debut")::numeric)`)
    expect(emit('AJOUTER_JOURS([Début]; 30)')).toBe(
      `("debut" + least(greatest(30::numeric, -100000), 100000)::int)`,
    )
    expect(resolve('ANNEE([Début]) + MOIS([Fin])').stored).toBe(true)
    expect(resolve('ANNEE([Début])').usesTimezone).toBe(false)
  })
})

describe('a date and time in a formula', () => {
  it('is read as a day in the zone of the formula, which makes it computed at read time', () => {
    for (const text of [
      'ANNEE([Quand])',
      'MOIS([Quand])',
      'JOUR([Quand])',
      'JOURSEMAINE([Quand])',
      'NO_SEMAINE_ISO([Quand])',
      'JOURS([Quand]; [Début])',
      'AJOUTER_JOURS([Quand]; 1)',
      'AJOUTER_MOIS([Quand]; 1)',
      'FIN_MOIS([Quand])',
      'DATEDIF([Début]; [Quand]; "M")',
      'HEURE([Quand])',
      'MINUTE([Quand])',
      'SECONDE([Quand])',
    ]) {
      const r = resolve(text)
      expect(r.stored, text).toBe(false)
      expect(r.usesTimezone, text).toBe(true)
      // The clock is not read: that is AUJOURDHUI().
      expect(r.usesToday, text).toBe(false)
    }
  })

  it('types the results: a day is a date, a part a number', () => {
    expect(resolve('AJOUTER_JOURS([Quand]; 1)').type).toBe('date')
    expect(resolve('AJOUTER_MOIS([Quand]; 1)').type).toBe('date')
    expect(resolve('FIN_MOIS([Quand])').type).toBe('date')
    expect(resolve('HEURE([Quand])').type).toBe('number')
    expect(resolve('SI(HEURE([Quand]) < 12; "matin"; "après-midi")').type).toBe('text')
  })

  it('emits the zone as a literal, and refuses one that is not a zone name', () => {
    expect(emit('ANNEE([Quand])')).toBe(
      `extract(year from ("quand" AT TIME ZONE 'Europe/Paris')::date)::numeric`,
    )
    expect(emit('JOURS([Quand]; [Début])')).toBe(
      `((("quand" AT TIME ZONE 'Europe/Paris')::date - "debut")::numeric)`,
    )
    expect(emit('HEURE([Quand])')).toBe(
      `extract(hour from ("quand" AT TIME ZONE 'Europe/Paris'))::numeric`,
    )
    expect(emit('SECONDE([Quand])')).toBe(
      `floor(extract(second from ("quand" AT TIME ZONE 'Europe/Paris')))::numeric`,
    )
    const { ast } = resolve('HEURE([Quand])')
    const context = { field: () => '"quand"', typeOf: () => 'datetime' as const }
    expect(emitFormula(ast, { ...context, timezone: 'America/Argentina/Buenos_Aires' })).toContain(
      `'America/Argentina/Buenos_Aires'`,
    )
    expect(
      refusal(() => emitFormula(ast, { ...context, timezone: `x'; DROP TABLE t; --` })).code,
    ).toBe('FORMULA_SYNTAX')
  })

  it('refuses the hour of a date, which has none', () => {
    for (const text of ['HEURE([Début])', 'MINUTE([Début])', 'SECONDE([Début])']) {
      expect(
        refusal(() => resolve(text)),
        text,
      ).toMatchObject({
        code: 'FORMULA_TYPE_MISMATCH',
        details: { detail: text.replace(/\(.*/, ':date') },
      })
    }
  })

  it('leaves MIN and MAX on date and time alone: an instant needs no zone to be ordered', () => {
    const r = resolve('MAX([Quand]; [Quand])')
    expect(r.type).toBe('datetime')
    expect(r.stored).toBe(true)
  })

  it('tells a clock reading from a zone reading', () => {
    expect(resolve('AUJOURDHUI()').usesTimezone).toBe(true)
    expect(resolve('AUJOURDHUI()').usesToday).toBe(true)
    const now = resolve('MAINTENANT()')
    expect(now.stored).toBe(false)
    expect(now.usesTimezone).toBe(false)
  })
})

describe('rendering', () => {
  it('writes the tree back with the labels of the day, parenthesised as needed', () => {
    const { ast } = resolve('([Prix HT] + 1) * [Taux TVA]')
    const labels = new Map([
      ['f-prix', 'Prix hors taxes'],
      ['f-taux', 'Taux'],
    ])
    const text = renderFormula(ast, (id) => labels.get(id) ?? id)
    expect(text).toBe('([Prix hors taxes] + 1) * [Taux]')
  })
})
