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
    expect(refusal(() => resolve('ANNEE([Quand])')).code).toBe('FORMULA_FUNCTION_NOT_IMMUTABLE')
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
