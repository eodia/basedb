import { readFileSync } from 'node:fs'
import { LOCALES } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import { SYSTEM_COLUMN_DESCRIPTIONS } from '../../src/catalog/description.js'
import { CATALOGS, sayer } from '../../src/catalog/documentation-texts/index.js'
import { toDocumentation } from '../../src/catalog/documentation.js'
import type { ProjectedBase, ProjectedField, ProjectedTable } from '../../src/catalog/projection.js'
import { SYSTEM_COLUMNS } from '../../src/rbac/decide.js'

/**
 * The API and MCP documentation in every language basedb speaks (chapter 11 §10).
 *
 * The sentences are read from the generator's source — every `t('…')` and `phrase('…')` —
 * so that a sentence added or reworded in French and left untranslated fails here, in
 * the language that lacks it, instead of surfacing as French in the middle of a page.
 */

const SOURCE = readFileSync(new URL('../../src/catalog/documentation.ts', import.meta.url), 'utf8')

function sentences(): string[] {
  const found = new Set<string>()
  for (const match of SOURCE.matchAll(/\b(?:t|phrase)\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    found.add((match[1] ?? '').replace(/\\(.)/g, '$1'))
  }
  return [...found]
}

const SENTENCES = sentences()
const sorted = (items: readonly string[]) => [...items].sort()
const placeholders = (text: string) => sorted(text.match(/\{\w+\}/g) ?? [])
const codeSpans = (text: string) => sorted(text.match(/`[^`]*`/g) ?? [])

describe('the catalogs of the documentation', () => {
  it('finds the sentences of the generator', () => {
    expect(SENTENCES.length).toBeGreaterThan(150)
    expect(SENTENCES).toContain('Vue d’ensemble')
    expect(SENTENCES).toContain('Prise en main')
  })

  it('exist for every language but French, the source', () => {
    expect(sorted(Object.keys(CATALOGS))).toEqual(sorted(LOCALES.filter((l) => l !== 'fr')))
  })

  for (const [language, catalog] of Object.entries(CATALOGS)) {
    describe(language, () => {
      it('translate every sentence', () => {
        expect(
          SENTENCES.filter((s) => !(typeof catalog[s] === 'string' && catalog[s] !== '')),
        ).toEqual([])
      })

      it('translate nothing the generator no longer says', () => {
        expect(Object.keys(catalog).filter((k) => !SENTENCES.includes(k))).toEqual([])
      })

      it('keep the values to fill in, and the code, as they are', () => {
        const drifted = SENTENCES.filter((s) => {
          const said = catalog[s]
          if (said === undefined) return false
          return (
            placeholders(said).join() !== placeholders(s).join() ||
            codeSpans(said).join() !== codeSpans(s).join()
          )
        })
        expect(drifted).toEqual([])
      })
    })
  }
})

describe('saying a sentence', () => {
  it('fills in the values, once, without reading what it inserts', () => {
    const t = sayer('fr')
    expect(t('Valeurs : {values}.', { values: '`{count}`' })).toBe('Valeurs : `{count}`.')
    expect(t('Valeurs : {values}.')).toBe('Valeurs : {values}.')
  })

  it('writes French in a language basedb does not speak', () => {
    expect(sayer('xx')('Vue d’ensemble')).toBe('Vue d’ensemble')
  })

  it('writes French a sentence no catalog knows', () => {
    expect(sayer('en')('Une phrase que personne n’a traduite.')).toBe(
      'Une phrase que personne n’a traduite.',
    )
  })
})

// ── The whole document, in another language ───────────────────────────────────────────

const TENANT = 't4z56fq'

const system: ProjectedField[] = SYSTEM_COLUMNS.map((name) => ({
  name,
  label: name,
  description: SYSTEM_COLUMN_DESCRIPTIONS[name] ?? null,
  kind: 'system',
  required: false,
  readOnly: true,
  system: true,
  unsafeHtml: false,
}))

function field(overrides: Partial<ProjectedField> & { name: string }): ProjectedField {
  return {
    label: overrides.name,
    description: null,
    kind: 'short_text',
    required: false,
    readOnly: false,
    system: false,
    unsafeHtml: false,
    ...overrides,
  }
}

function table(overrides: Partial<ProjectedTable> & { name: string }): ProjectedTable {
  return {
    id: `id-${overrides.name}`,
    label: overrides.name,
    description: null,
    sql: `"b_${TENANT}_crm"."${overrides.name}"`,
    actions: ['read', 'create', 'update', 'delete'],
    fields: [...system],
    referencedBy: false,
    displayField: null,
    ...overrides,
  }
}

/** A base that goes through most of the generator: links, files, choices, hidden columns. */
function richBase(overrides: Partial<ProjectedBase> = {}): ProjectedBase {
  const factures = table({
    name: 'factures',
    displayField: 'numero',
    referencedBy: true,
    fields: [
      ...system,
      field({ name: 'numero', required: true }),
      field({ name: 'montant', kind: 'number' }),
      field({
        name: 'statut',
        kind: 'select',
        options: [{ value: 'payee', label: 'Payée', color: null, icon: null, image: null }],
      }),
      field({ name: 'devis', kind: 'file' }),
      field({ name: 'notes', kind: 'long_text', ai: true, readOnly: true }),
      field({ name: 'marge', kind: 'number', hiddenFromAgents: true }),
      field({
        name: 'clients_id',
        kind: 'link',
        link: {
          target: { table: 'clients', displayField: 'nom' },
          onDelete: 'restrict',
          required: false,
          expandable: true,
          masked: false,
        },
      }),
      field({
        name: 'contrat_id',
        kind: 'link',
        link: { onDelete: 'set_null', required: false, expandable: false, masked: true },
      }),
    ],
  })
  return {
    id: 'base-1',
    name: `b_${TENANT}_crm`,
    label: 'CRM',
    description: null,
    project: { id: 'project-1', label: 'Commercial' },
    baseActions: ['read', 'create', 'update', 'delete', 'manage_schema', 'manage_tokens'],
    agentsEnabled: true,
    tables: [factures, table({ name: 'clients', displayField: 'nom' })],
    ...overrides,
  }
}

describe('the documentation in another language', () => {
  // The French sentences long enough not to be the same in another language by chance.
  const french = SENTENCES.filter((s) => s.length >= 30)
  const variants = [richBase(), richBase({ agentsEnabled: false, baseActions: ['read'] })]

  for (const language of ['en', 'de', 'ja']) {
    it(`leaves no French sentence in ${language}`, () => {
      for (const base of variants) {
        const text = JSON.stringify(toDocumentation(base, TENANT, language))
        expect(french.filter((s) => text.includes(JSON.stringify(s).slice(1, -1)))).toEqual([])
      }
    })
  }

  it('titles its groups in the reader’s language', () => {
    const doc = toDocumentation(richBase(), TENANT, 'en')
    expect(doc.sections[0]?.group).toBe(CATALOGS.en['Prise en main'])
    expect(doc.title).toBe(
      CATALOGS.en['{base} — documentation API et MCP']?.replace('{base}', 'CRM'),
    )
  })

  it('stays in French without a language, and in one it does not speak', () => {
    const plain = toDocumentation(richBase(), TENANT)
    expect(plain.sections[0]?.group).toBe('Prise en main')
    expect(toDocumentation(richBase(), TENANT, 'xx')).toEqual(plain)
  })
})
