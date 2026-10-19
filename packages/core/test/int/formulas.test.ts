import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * The text and date functions of the formula language — chapter 04 §7.3.
 *
 * What only a real PostgreSQL can say: that every stored formula is accepted as a generated
 * column (immutable, whatever `lc_time` and `TimeZone` say), that the values are the ones a
 * spreadsheet would give, that an empty value stays empty, that a row can always be written
 * whatever it holds, and that a regular expression PostgreSQL does not accept is refused
 * before the formula is saved rather than on the first row.
 */

const TENANT = 't8fm2xq'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let tableId: string
let schemaName: string
let tableName: string
let client: pg.Client

/** The rows, by a letter in `cle`: the same people everywhere in this file. */
const ROWS = {
  // Everything there is to read.
  A: {
    nom: 'Banane aab',
    prix: 3,
    debut: '2026-01-31',
    fin: '2028-03-15',
    quand: '2026-06-30T23:30:45.000000Z',
  },
  // Nothing at all.
  B: {},
  // An accented name, no price, a month shorter than the day it starts on.
  C: {
    nom: 'Éléphant',
    debut: '2026-01-31',
    fin: '2026-02-28',
    quand: '2026-12-31T22:59:59.000000Z',
  },
  // Spaces, a negative number, an end before the start, no date and time.
  D: { nom: '  rue  de la Paix ', prix: -5, debut: '2027-01-01', fin: '2026-12-25' },
  // Too much of everything.
  E: { nom: 'x'.repeat(50000), prix: 9e27, debut: '2026-05-05' },
} as const

type Key = keyof typeof ROWS

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
}

async function failure(promise: Promise<unknown>): Promise<{
  code: string
  details: Record<string, unknown>
}> {
  try {
    await promise
  } catch (e) {
    const error = e as { code: string; details: Record<string, unknown> }
    return { code: error.code, details: error.details }
  }
  throw new Error('no error raised')
}

let counter = 0

/** Adds a formula field, and says under which physical name it reads. */
async function formula(
  expression: string,
  options: { label?: string; timezone?: string } = {},
): Promise<string> {
  const label = options.label ?? `Calcul ${String(++counter).padStart(3, '0')}`
  const added = await kernel.addField(admin, {
    tableId,
    label,
    kind: 'formula',
    formula: {
      expression,
      ...(options.timezone === undefined ? {} : { timezone: options.timezone }),
    },
  })
  return added.name
}

/** The rows as read, by key. */
async function read(options: { filter?: string; sort?: string } = {}) {
  const page = await kernel.listRecords(admin, { tableId, limit: 100, ...options })
  const byKey: Record<string, Record<string, unknown>> = {}
  for (const row of page.rows) byKey[row.cle as string] = row
  return { rows: page.rows, byKey }
}

async function columns(): Promise<string[]> {
  const found = await client.query<{ column_name: string }>(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
    [schemaName, tableName],
  )
  return found.rows.map((r) => r.column_name)
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  admin = await kernel.openContext({
    userId: boot.userId,
    requestId: randomUUID(),
    surface: 'rest',
  })
  const base = await kernel.createBase(admin, { label: 'Essais' })
  const table = await kernel.createTable(admin, {
    baseId: base.baseId,
    label: 'Mesures',
    fields: [
      { label: 'Clé', kind: 'short_text' },
      { label: 'Nom', kind: 'short_text' },
      { label: 'Prix', kind: 'number' },
      { label: 'Début', kind: 'date' },
      { label: 'Fin', kind: 'date' },
      { label: 'Quand', kind: 'datetime' },
    ],
  })
  tableId = table.tableId
  schemaName = table.schemaName
  tableName = table.tableName
  client = new pg.Client({ connectionString: container.getConnectionUri() })
  await client.connect()
  for (const [cle, values] of Object.entries(ROWS)) {
    await kernel.createRecord(admin, { tableId, values: { cle, ...values } })
  }
}, 240_000)

afterAll(async () => {
  await client?.end()
  await kernel?.close()
  await container?.stop()
})

/** [formula, the value on each row it is asked about]. Absent rows are not asked. */
type Case = readonly [expression: string, expected: Partial<Record<Key, unknown>>]

/**
 * The text functions. A column holds each one (a generated column, so PostgreSQL has accepted
 * the expression as immutable); `B` has nothing, and a function of nothing is nothing.
 */
const TEXT: readonly Case[] = [
  ['STXT([Nom]; 2; 3)', { A: 'ana', B: null, C: 'lép' }],
  // An absent number is not a bound: no start is no text, not the whole of it.
  ['STXT([Nom]; [Prix]; 2)', { A: 'na', C: null, D: '  ', E: '' }],
  ['STXT([Nom]; 0; 4)', { A: 'Bana' }],
  ['STXT([Nom]; 3; -1)', { A: '' }],
  ['STXT([Nom]; 2.9; 2.9)', { A: 'an' }],
  ['SUBSTITUE([Nom]; "a"; "o")', { A: 'Bonone oob', B: null, C: 'Éléphont' }],
  ['SUBSTITUE([Nom]; "an"; "")', { A: 'Be aab' }],
  ['SUBSTITUE([Nom]; ""; "x")', { A: 'Banane aab' }],
  ['TROUVE("a"; [Nom])', { A: 2, B: null, C: 6 }],
  ['TROUVE("A"; [Nom])', { A: null }],
  ['CHERCHE("A"; [Nom])', { A: 2, B: null }],
  // The accent counts here, as in a spreadsheet.
  ['CHERCHE("É"; [Nom])', { A: null, C: 1 }],
  ['CHERCHE("e"; [Nom])', { C: null }],
  // Two fields: neither is written in the formula.
  ['CHERCHE([Clé]; [Nom])', { A: 2, B: null }],
  ['CONTIENT([Nom]; "ANAN")', { A: true, B: null, C: false }],
  // Case and accents do not count, as in the grid's filters.
  ['CONTIENT([Nom]; "ELEPHANT")', { A: false, C: true }],
  ['CONTIENT([Nom]; "paix")', { D: true }],
  ['COMMENCEPAR([Nom]; "BAN")', { A: true, B: null, C: false }],
  ['COMMENCEPAR([Nom]; "ele")', { C: true }],
  ['FINITPAR([Nom]; "AAB")', { A: true, C: false }],
  ['FINITPAR([Nom]; "aa")', { A: false }],
  ['FINITPAR([Nom]; "ant")', { C: true }],
  ['FINITPAR([Nom]; "")', { A: true }],
  ['NOMPROPRE([Nom])', { A: 'Banane Aab', B: null, D: '  Rue  De La Paix ' }],
  ['REPT("ab"; [Prix])', { A: 'ababab', B: null, C: null, D: '', E: null }],
  ['REPT("-"; 3)', { A: '---', B: '---' }],
  ['REPT([Nom]; 2)', { A: 'Banane aabBanane aab', E: null }],
  ['REPT("ab"; 16383)', { A: 'ab'.repeat(16383) }],
  ['REPT("ab"; 16384)', { A: null }],
  [
    'CONCAT([Nom]; "-"; [Prix])',
    { A: 'Banane aab-3', B: '-', C: 'Éléphant-', D: '  rue  de la Paix --5' },
  ],
  ['CONCAT("a"; VRAI; 1.50)', { B: 'aVRAI1.5' }],
  [
    'JOINDRE_TEXTE(", "; VRAI; [Nom]; [Prix])',
    { A: 'Banane aab, 3', B: '', C: 'Éléphant', D: '  rue  de la Paix , -5' },
  ],
  ['JOINDRE_TEXTE(", "; FAUX; [Nom]; [Prix])', { A: 'Banane aab, 3', B: ', ', C: 'Éléphant, ' }],
  ['JOINDRE_TEXTE("→"; VRAI; "x"; [Nom]; ""; [Prix])', { A: 'x→Banane aab→3', B: 'x' }],
  ['JOINDRE_TEXTE(""; VRAI; [Nom]; [Prix])', { A: 'Banane aab3', B: '' }],
  ['REGEX_CORRESPOND([Nom]; "(?i)^ban.*AAB$")', { A: true, B: null, C: false }],
  ['REGEX_CORRESPOND([Nom]; "^b")', { A: false }],
  ['REGEX_CORRESPOND([Nom]; "^\\w+$")', { A: false, C: true }],
  ['REGEX_EXTRAIRE([Nom]; "(a+)b")', { A: 'aa', B: null, C: null }],
  ['REGEX_EXTRAIRE([Nom]; "[A-Za-z]+")', { A: 'Banane', B: null }],
  ['REGEX_EXTRAIRE([Nom]; "^\\w+")', { C: 'Éléphant' }],
  ['REGEX_REMPLACER([Nom]; "a+"; "<\\&>")', { A: 'B<a>n<a>ne <aa>b', B: null }],
  ['REGEX_REMPLACER([Nom]; "(b)$"; "[\\1]")', { A: 'Banane aa[b]' }],
  ['REGEX_REMPLACER([Nom]; "\\s+"; " ")', { D: ' rue de la Paix ' }],
  ['REGEX_REMPLACER([Nom]; "e"; [Clé])', { A: 'BananA aab' }],
]

const DATES: readonly Case[] = [
  ['TEXTE([Début]; "jj/mm/aaaa")', { A: '31/01/2026', B: null, D: '01/01/2027' }],
  ['TEXTE([Début]; "AAAA-M-J")', { A: '2026-1-31' }],
  ['TEXTE([Début]; "aa")', { A: '26' }],
  ['TEXTE([Début]; "jj à aaaa (\\T)")', { A: '31 à 2026 (T)' }],
  ['AJOUTER_MOIS([Début]; 1)', { A: '2026-02-28', B: null, D: '2027-02-01' }],
  ['AJOUTER_MOIS([Début]; -2)', { A: '2025-11-30' }],
  ['AJOUTER_MOIS([Début]; [Prix])', { A: '2026-04-30', B: null, C: null, D: '2026-08-01' }],
  ['AJOUTER_MOIS([Début]; 1.9)', { A: '2026-02-28' }],
  ['FIN_MOIS([Début])', { A: '2026-01-31', B: null, D: '2027-01-31', E: '2026-05-31' }],
  ['FIN_MOIS([Début]; 1)', { A: '2026-02-28' }],
  ['FIN_MOIS([Début]; 13)', { A: '2027-02-28' }],
  ['FIN_MOIS([Début]; -1)', { A: '2025-12-31' }],
  ['FIN_MOIS([Début]; [Prix])', { A: '2026-04-30', C: null }],
  ['DATEDIF([Début]; [Fin]; "Y")', { A: 2, B: null, C: 0, D: 0 }],
  ['DATEDIF([Début]; [Fin]; "M")', { A: 25, B: null, C: 0, D: 0 }],
  ['DATEDIF([Début]; [Fin]; "m")', { A: 25 }],
  ['DATEDIF([Début]; [Fin]; "YM")', { A: 1, C: 0 }],
  ['DATEDIF([Début]; [Fin]; "D")', { A: 774, C: 28, D: -7 }],
  ['DATEDIF([Fin]; [Début]; "M")', { A: -25 }],
  ['NO_SEMAINE_ISO([Début])', { A: 5, B: null, D: 53 }],
  ['ANNEE([Début]) * 100 + NO_SEMAINE_ISO([Début])', { A: 202605 }],
]

/** Read at read time, in a zone: no column holds them. */
const ZONED: readonly Case[] = [
  ['ANNEE([Quand])', { A: 2026, B: null, C: 2026, D: null }],
  ['MOIS([Quand])', { A: 7, C: 12 }],
  ['JOUR([Quand])', { A: 1, C: 31 }],
  ['JOURSEMAINE([Quand])', { A: 3, C: 4 }],
  ['NO_SEMAINE_ISO([Quand])', { A: 27 }],
  ['HEURE([Quand])', { A: 1, B: null, C: 23 }],
  ['MINUTE([Quand])', { A: 30, C: 59 }],
  ['SECONDE([Quand])', { A: 45, C: 59 }],
  [
    'TEXTE([Quand]; "aaaa-mm-jj hh:mm:ss")',
    { A: '2026-07-01 01:30:45', B: null, C: '2026-12-31 23:59:59' },
  ],
  ['TEXTE([Quand]; "mm:ss")', { A: '30:45' }],
  ['TEXTE([Quand]; "j/m/aa h:mm")', { A: '1/7/26 1:30' }],
  ['FIN_MOIS([Quand])', { A: '2026-07-31', B: null }],
  ['AJOUTER_JOURS([Quand]; 1)', { A: '2026-07-02', C: '2027-01-01' }],
  ['AJOUTER_MOIS([Quand]; 1)', { A: '2026-08-01' }],
  ['JOURS([Quand]; [Début])', { A: 151, B: null }],
  ['DATEDIF([Début]; [Quand]; "M")', { A: 5, B: null }],
  ['SI(HEURE([Quand]) < 12; "matin"; "après-midi")', { A: 'matin', C: 'après-midi' }],
]

describe('the text functions', () => {
  const names: string[] = []

  it('are all accepted as generated columns', async () => {
    for (const [expression] of TEXT) names.push(await formula(expression))
    const held = await columns()
    for (const name of names) expect(held).toContain(name)
  })

  it('give the values a spreadsheet gives, and an empty value for an empty one', async () => {
    const { byKey } = await read()
    TEXT.forEach(([expression, expected], i) => {
      for (const [key, value] of Object.entries(expected)) {
        const got = byKey[key]?.[names[i] as string]
        // A number comes out as its text, as every number does.
        const shown = typeof value === 'number' && got !== null ? Number(got) : got
        expect(shown, `${expression} on ${key}`).toBe(value)
      }
    })
  })
})

describe('the date functions', () => {
  const names: string[] = []

  it('are all accepted as generated columns', async () => {
    for (const [expression] of DATES) names.push(await formula(expression))
    const held = await columns()
    for (const name of names) expect(held).toContain(name)
  })

  it('give the dates a spreadsheet gives', async () => {
    const { byKey } = await read()
    DATES.forEach(([expression, expected], i) => {
      for (const [key, value] of Object.entries(expected)) {
        const got = byKey[key]?.[names[i] as string]
        const shown = typeof value === 'number' && got !== null ? Number(got) : got
        expect(shown, `${expression} on ${key}`).toBe(value)
      }
    })
  })
})

describe('a date and time', () => {
  const names: string[] = []

  it('is read as a day in the zone of the formula: computed at read time, no column', async () => {
    const before = await columns()
    for (const [expression] of ZONED) names.push(await formula(expression))
    const after = await columns()
    expect(after).toEqual(before)
    const configs = await client.query<{ is_stored: boolean; timezone: string | null }>(
      `SELECT fc.is_stored, fc.timezone
         FROM _basedb.field_formula_config fc
         JOIN _basedb.field f ON f.id = fc.field_id
         JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE f.table_id = $1 AND n.name = ANY($2)`,
      [tableId, names],
    )
    expect(configs.rows).toHaveLength(names.length)
    for (const row of configs.rows) {
      expect(row.is_stored).toBe(false)
      expect(row.timezone).toBe('Europe/Paris')
    }
  })

  it('gives the day, the hour and the text of Paris, not of UTC', async () => {
    const { byKey } = await read()
    ZONED.forEach(([expression, expected], i) => {
      for (const [key, value] of Object.entries(expected)) {
        const got = byKey[key]?.[names[i] as string]
        const shown = typeof value === 'number' && got !== null ? Number(got) : got
        expect(shown, `${expression} on ${key}`).toBe(value)
      }
    })
  })

  it('takes the zone it is given', async () => {
    const newYork = await formula('HEURE([Quand])', { timezone: 'America/New_York' })
    const day = await formula('JOUR([Quand])', { timezone: 'America/New_York' })
    const tokyo = await formula('TEXTE([Quand]; "jj hh:mm")', { timezone: 'Asia/Tokyo' })
    const { byKey } = await read()
    expect(Number(byKey.A?.[newYork])).toBe(19)
    expect(Number(byKey.A?.[day])).toBe(30)
    expect(byKey.A?.[tokyo]).toBe('01 08:30')
    const unknown = await failure(formula('HEURE([Quand])', { timezone: 'Mars/Olympus' }))
    expect(unknown.code).toBe('REQUEST_INVALID')
  })

  it('is filtered and sorted like any column', async () => {
    const name = await formula('HEURE([Quand])', { label: 'Heure locale' })
    expect(name).toBe('heure_locale')
    const morning = await read({ filter: 'heure_locale lt 12' })
    expect(morning.rows.map((r) => r.cle)).toEqual(['A'])
    const late = await read({ sort: '-heure_locale' })
    // Descending, an empty value first as in any sort on a column.
    expect(late.rows.map((r) => r.cle).filter((k) => k === 'A' || k === 'C')).toEqual(['C', 'A'])
  })

  it('makes a stored formula computed when rewritten over it, and back', async () => {
    const name = await formula('ANNEE([Début])', { label: 'Année utile' })
    expect(await columns()).toContain(name)
    const toRead = await kernel.setFormula(admin, {
      tableId,
      field: name,
      formula: { expression: 'ANNEE([Quand])' },
    })
    expect(toRead.stored).toBe(false)
    expect(await columns()).not.toContain(name)
    expect(Number((await read()).byKey.C?.[name])).toBe(2026)
    const back = await kernel.setFormula(admin, {
      tableId,
      field: name,
      formula: { expression: 'ANNEE([Début]) + 1' },
    })
    expect(back.stored).toBe(true)
    expect(await columns()).toContain(name)
    expect(Number((await read()).byKey.A?.[name])).toBe(2027)
  })
})

describe('a date turned into text', () => {
  it('is refused without a format, and the message says what to write', async () => {
    for (const expression of [
      'TEXTE([Début])',
      'TEXTE([Quand])',
      '[Nom] & [Début]',
      'CONCAT([Quand])',
    ]) {
      expect((await failure(formula(expression))).code, expression).toBe(
        'FORMULA_FUNCTION_NOT_IMMUTABLE',
      )
    }
  })

  it('is refused a format that would need a name, a letter it does not know, or an hour it has not', async () => {
    const refused = await failure(formula('TEXTE([Début]; "jjjj")'))
    expect(refused).toMatchObject({
      code: 'FORMULA_SYNTAX',
      details: { detail: 'format_inconnu:jjjj' },
    })
    expect((await failure(formula('TEXTE([Début]; "lundi")'))).code).toBe('FORMULA_SYNTAX')
    expect((await failure(formula('TEXTE([Début]; "hh:mm")'))).code).toBe('FORMULA_TYPE_MISMATCH')
    expect((await failure(formula('TEXTE([Prix]; "jj")'))).code).toBe('FORMULA_TYPE_MISMATCH')
  })

  it('refuses the hour of a date', async () => {
    expect((await failure(formula('HEURE([Début])'))).code).toBe('FORMULA_TYPE_MISMATCH')
    expect((await failure(formula('MINUTE([Fin])'))).code).toBe('FORMULA_TYPE_MISMATCH')
  })
})

describe('a regular expression', () => {
  it('that PostgreSQL does not accept is refused before the formula is saved', async () => {
    const before = await columns()
    for (const pattern of ['(', '[a-', 'a{2,1}', '*a', 'ab\\']) {
      const expression = `REGEX_CORRESPOND([Nom]; "${pattern.replace(/\\/g, '\\')}")`
      const refused = await failure(formula(expression))
      expect(refused.code, pattern).toBe('FORMULA_SYNTAX')
      expect(refused.details, pattern).toMatchObject({
        detail: 'motif_invalide:REGEX_CORRESPOND',
        position: expression.indexOf('"'),
      })
      expect(String(refused.details.reason), pattern).toMatch(/regular expression|escape/)
    }
    // Nothing was left behind, and the next formula is saved as usual.
    expect(await columns()).toEqual(before)
    const name = await formula('REGEX_CORRESPOND([Nom]; "^B")')
    expect((await read()).byKey.A?.[name]).toBe(true)
  })

  it('is written in the formula, never read from a row, and has no back-reference', async () => {
    expect(await codeOf(formula('REGEX_CORRESPOND([Nom]; [Clé])'))).toBe('FORMULA_SYNTAX')
    expect(await codeOf(formula('REGEX_EXTRAIRE([Nom]; "(a)\\1")'))).toBe('FORMULA_SYNTAX')
    expect(await codeOf(formula('REGEX_REMPLACER([Nom]; "a" & "b"; "c")'))).toBe('FORMULA_SYNTAX')
  })

  it('over a text written alone is refused, PostgreSQL having no collation for a constant', async () => {
    for (const expression of [
      'MAJUSCULE("abc")',
      'NOMPROPRE("a" & "b")',
      'REGEX_CORRESPOND("abc"; "b")',
    ]) {
      const refused = await failure(formula(expression))
      expect(refused, expression).toMatchObject({
        code: 'FORMULA_SYNTAX',
        details: { detail: 'texte_ecrit_seul' },
      })
    }
    // With a field in it, the same functions are stored.
    expect(await formula('NOMPROPRE("a " & [Nom])')).toBeTruthy()
  })

  it('tells the right function from the wrong arguments', async () => {
    expect(await codeOf(formula('REGEX_CORRESPOND([Prix]; "a")'))).toBe('FORMULA_TYPE_MISMATCH')
    expect(await codeOf(formula('DATEDIF([Début]; [Fin]; "MD")'))).toBe('FORMULA_SYNTAX')
    expect(await codeOf(formula('JOINDRE_TEXTE([Nom]; VRAI; "a")'))).toBe('FORMULA_SYNTAX')
    expect(await codeOf(formula('STXT([Nom]; 1)'))).toBe('FORMULA_SYNTAX')
  })
})

describe('a row that holds anything', () => {
  it('is always written: no stored formula raises on a value at the edge', async () => {
    // Direct SQL, beyond what the kernel lets through: dates at both ends of what a date
    // column holds, numbers at the edge of the column, a text of a million characters.
    const insert = `INSERT INTO "${schemaName}"."${tableName}" (cle, nom, prix, debut, fin)
                    VALUES ($1, $2, $3, $4, $5)`
    const edges: Array<[string, string | null, string | null, string | null, string | null]> = [
      [
        'X1',
        'y'.repeat(1_000_000),
        '9999999999999999999999999999.9999999999',
        '0001-01-01',
        '9999-12-31',
      ],
      ['X2', 'é', '-9999999999999999999999999999.9999999999', '9999-12-31', '0001-01-01'],
      ['X3', '', '0', '2026-02-28', '2026-02-28'],
      ['X4', null, null, null, null],
      ['X5', 'a\\1(', '1e0', '4713-01-01', '5874897-12-31'],
    ]
    for (const edge of edges) {
      await client.query('BEGIN')
      try {
        await client.query(insert, edge)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`${edge[0]}: ${(error as Error).message}`)
      }
    }
    const count = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM "${schemaName}"."${tableName}" WHERE cle LIKE 'X%'`,
    )
    expect(Number(count.rows[0]?.n)).toBe(edges.length)
    // And they are read, with every formula of this file, computed or stored.
    const { byKey } = await read()
    expect(byKey.X1).toBeDefined()
    expect(byKey.X4).toBeDefined()
  })
})
