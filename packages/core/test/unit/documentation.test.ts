import { describe, expect, it } from 'vitest'
import { SYSTEM_COLUMN_DESCRIPTIONS } from '../../src/catalog/description.js'
import { toDocumentation } from '../../src/catalog/documentation.js'
import type { ProjectedBase, ProjectedField, ProjectedTable } from '../../src/catalog/projection.js'
import { SYSTEM_COLUMNS } from '../../src/rbac/decide.js'

/**
 * The readable documentation, on a hand-built projection.
 *
 * No database: `toDocumentation` is a pure function of the projection, so the shape of the
 * document — its groups, its tables, its examples — is testable without one. What needs a
 * real catalog (three serializations agreeing, a masked field disappearing) lives in
 * `serializations.test.ts`.
 */

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

function base(tables: ProjectedTable[], description: string | null = null): ProjectedBase {
  return { id: 'base-1', name: `b_${TENANT}_crm`, label: 'CRM', description, tables }
}

const section = (doc: ReturnType<typeof toDocumentation>, id: string) =>
  doc.sections.find((s) => s.id === id)

describe('the shape of the document', () => {
  const doc = toDocumentation(
    base([table({ name: 'factures' }), table({ name: 'clients' })]),
    TENANT,
  )

  it('files every section under a navigation group, in the order a sidebar shows them', () => {
    const groups = [...new Set(doc.sections.map((s) => s.group))]
    expect(groups).toEqual(['Prise en main', 'Tables', 'Référence'])
    // One "Tables" section per table, between the introduction and the reference.
    expect(doc.sections.filter((s) => s.group === 'Tables').map((s) => s.id)).toEqual([
      'factures',
      'clients',
    ])
  })

  it('carries the sections the reader looks for first', () => {
    expect(doc.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'lire-cette-base',
        'api-authentification',
        'api-conventions',
        'api-relations',
        'codes-de-reponse',
        'ecrire-en-sql',
      ]),
    )
  })

  it('warns, in a callout, that it describes what THIS reader can see', () => {
    expect(section(doc, 'lire-cette-base')?.markdown).toContain('> [!WARNING]')
    expect(section(doc, 'lire-cette-base')?.markdown).toContain('ce que VOUS pouvez voir')
  })

  it('says, in a callout, that permissions stop at direct SQL', () => {
    const sql = section(doc, 'ecrire-en-sql')?.markdown ?? ''
    expect(sql).toContain('> [!IMPORTANT]')
    expect(sql).toContain('ne s’appliquent pas en SQL direct')
  })
})

describe('a table section', () => {
  const invoices = table({
    name: 'factures',
    label: 'Factures',
    description: 'Factures émises aux clients.',
    fields: [
      ...system,
      field({ name: 'numero', label: 'Numéro', required: true, description: 'Numéro unique.' }),
      field({ name: 'montant', label: 'Montant', kind: 'number' }),
    ],
  })
  const md = section(toDocumentation(base([invoices]), TENANT), 'factures')?.markdown ?? ''

  it('opens with the description, before anything else', () => {
    expect(md.split('\n')[0]).toBe('Factures émises aux clients.')
  })

  it('states the SQL name a consumer will type', () => {
    expect(md).toContain(`**En SQL :** \`"b_${TENANT}_crm"."factures"\``)
  })

  it('lists the endpoints the reader holds, and no other', () => {
    expect(md).toContain('| `GET` | `/api/v1/t4z56fq/data/b_t4z56fq_crm/factures` |')
    expect(md).toContain('| `DELETE` | `/api/v1/t4z56fq/data/b_t4z56fq_crm/factures/{id}` |')

    const readOnly = section(
      toDocumentation(base([table({ name: 'factures', actions: ['read'] })]), TENANT),
      'factures',
    )?.markdown
    expect(readOnly).toContain('| `GET` |')
    expect(readOnly).not.toContain('| `POST` |')
    expect(readOnly).not.toContain('| `PATCH` |')
    expect(readOnly).not.toContain('| `DELETE` |')
    // Nothing to create, so no example that creates.
    expect(readOnly).not.toContain('-X POST')
  })

  it('describes each column in a row: name, label, type and description', () => {
    expect(md).toContain('| Colonne | Libellé | Type | Description |')
    expect(md).toContain('| `numero` | Numéro | texte · obligatoire | Numéro unique. |')
    // A column nobody described says so with a dash, not with an empty cell.
    expect(md).toContain('| `montant` | Montant | nombre (chaîne décimale) | — |')
  })

  it('describes the system columns with their own sentences', () => {
    expect(md).toContain('| `_id` | colonne système |')
    expect(md).toContain('UUID v7')
  })

  it('gives examples that can be pasted, in two languages', () => {
    expect(md).toContain('```bash title="cURL"')
    expect(md).toContain('```js title="JavaScript"')
    expect(md).toContain('curl "$BASEDB_URL/api/v1/t4z56fq/data/b_t4z56fq_crm/factures?limit=20"')
    // The body is built from the writable columns and their KIND — never from real data.
    expect(md).toContain('"montant":"1240.00"')
  })

  it('leaves the read-only and computed columns out of the creation example', () => {
    const md2 =
      section(
        toDocumentation(
          base([
            table({
              name: 'factures',
              fields: [
                ...system,
                field({ name: 'total', kind: 'formula', readOnly: true }),
                field({ name: 'numero' }),
              ],
            }),
          ]),
          TENANT,
        ),
        'factures',
      )?.markdown ?? ''
    const creation = md2.split('#### Créer une ligne')[1] ?? ''
    expect(creation).toContain('-d \'{"values":{"numero":"Exemple"}}\'')
    expect(creation).not.toContain('"total"')
  })
})

describe('what the reader is not told', () => {
  const orphan = table({
    name: 'factures',
    fields: [
      ...system,
      field({
        name: 'clients_id',
        label: 'Client',
        kind: 'link',
        // The target is invisible: nothing about it is disclosed, not even its name.
        link: { onDelete: 'restrict', required: false, expandable: false, masked: true },
      }),
    ],
  })
  const doc = toDocumentation(base([orphan]), TENANT)
  const json = JSON.stringify(doc)

  it('describes the link field and says nothing of its target', () => {
    expect(json).toContain('clients_id')
    expect(section(doc, 'api-relations')?.markdown).toContain('→ une table que vous ne voyez pas')
    expect(section(doc, 'factures')?.markdown).toContain('"masked":true')
    expect(json).not.toContain('`clients`')
  })

  it('offers no expansion of a link it cannot resolve', () => {
    expect(section(doc, 'factures')?.markdown).not.toContain('### Expansion')
  })
})

describe('a description is inert', () => {
  it('cannot start a list, a heading, or a table cell, whatever it begins with', () => {
    const doc = toDocumentation(
      base([
        table({ name: 't1', description: '- une puce' }),
        table({ name: 't2', description: '1. un numéro' }),
      ]),
      TENANT,
    )
    expect(section(doc, 't1')?.markdown.split('\n')[0]).toBe('\\- une puce')
    expect(section(doc, 't2')?.markdown.split('\n')[0]).toBe('1\\. un numéro')
  })

  it('stays on one line, so it cannot open a paragraph or a block of its own', () => {
    const doc = toDocumentation(
      base([table({ name: 't1', description: 'Première ligne.\n\n# Titre\n\n```\ncode\n```' })]),
      TENANT,
    )
    const lede = section(doc, 't1')?.markdown.split('\n')[0] ?? ''
    expect(lede).toContain('\\# Titre')
    expect(lede).toContain('\\`\\`\\`')
    // The text after the first line is the generated part, never the author's.
    expect(section(doc, 't1')?.markdown.split('\n')[1]).toBe('')
  })

  it('does not let a select option escape the fenced example it lands in', () => {
    const doc = toDocumentation(
      base([
        table({
          name: 't1',
          fields: [
            ...system,
            field({
              name: 'statut',
              kind: 'select',
              options: [{ value: "x'; DROP TABLE t; --`", label: 'Piège' }],
            }),
          ],
        }),
      ]),
      TENANT,
    )
    const md = section(doc, 't1')?.markdown ?? ''
    // A quote would close the shell string of the cURL example, a backtick the fence.
    expect(md).not.toContain("x'; DROP")
    expect(md).toContain('"statut":"valeur"')
  })
})

describe('the base description', () => {
  it('opens the overview, when there is one', () => {
    const doc = toDocumentation(base([table({ name: 'factures' })], 'Le suivi commercial.'), TENANT)
    expect(section(doc, 'lire-cette-base')?.markdown.split('\n')[0]).toBe('Le suivi commercial.')
  })

  it('leaves the overview to open on its own sentence when there is none', () => {
    const doc = toDocumentation(base([table({ name: 'factures' })]), TENANT)
    expect(section(doc, 'lire-cette-base')?.markdown.startsWith('Cette base s’appelle')).toBe(true)
  })
})

describe('section identifiers', () => {
  it('cannot be shadowed by a table, whatever it is called', () => {
    // A CRM with a table called "Relations" is not exotic. If its section took the id of the
    // guide's own, the navigation would show one of the two twice and lose the other.
    const doc = toDocumentation(
      base(
        ['relations', 'conventions', 'authentification', 'lire', 'ecrire'].map((name) =>
          table({ name }),
        ),
      ),
      TENANT,
    )
    const ids = doc.sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('give every section of the guide an id no logical name can have', () => {
    // A logical name has no hyphen (alphabet B of chapter 01): that is the whole argument.
    const guide = toDocumentation(base([]), TENANT).sections.filter((s) => s.group !== 'Tables')
    for (const s of guide) expect(s.id).toContain('-')
  })
})
