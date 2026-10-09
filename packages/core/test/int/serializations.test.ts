import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Documentation, toDocumentation } from '../../src/catalog/documentation.js'
import { createLinkField, setDisplayColumn } from '../../src/catalog/links.js'
import { toOpenApi } from '../../src/catalog/openapi.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import { type ProjectedBase, projectBase } from '../../src/catalog/projection.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * Equality of the three serializations — chapter 08 §17.1, point 4.
 *
 * "For each test role, the set (tables, fields, link targets) described by
 * `/meta/bases/{base}`, by `openapi.json` and by `/doc` is rigorously equal. Any
 * divergence fails the suite."
 *
 * The whole value of this test lies in extracting that set from each serialization
 * INDEPENDENTLY — by reading the OpenAPI paths and schemas, and by parsing the
 * documentation's Markdown. Comparing three calls to the same accessor would prove
 * nothing; here, a serialization that forgets a field, or keeps one the reader may not
 * see, comes out different.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let admin: RequestContext
let crmSchema: string
let clients: { tableId: string; displayFieldId: string }
let invoices: { tableId: string; amountFieldId: string }
let salaries: { tableId: string }
let tenantId: string

/**
 * A HOSTILE description, like the hostile label below: a tag, Markdown emphasis, a pipe
 * that would close a table cell, and a second line opening with a list marker.
 */
const HOSTILE_DESCRIPTION =
  "Les clients <script>alert(1)</script> de l'entreprise, **tous** | sans exception.\n- puis une ligne qui ressemble à une liste"
const AMOUNT_DESCRIPTION = 'Montant hors taxes, en euros.'
const INVOICES_DESCRIPTION = 'Factures émises aux clients.'

/** What the three serializations must agree on, and nothing else. */
interface Described {
  readonly tables: readonly string[]
  readonly fields: readonly string[]
  readonly linkTargets: readonly string[]
}

const sorted = (d: Described): Described => ({
  tables: [...d.tables].sort(),
  fields: [...d.fields].sort(),
  linkTargets: [...d.linkTargets].sort(),
})

/** `factures` → `Factures`. Reimplemented here on purpose, not imported. */
const schemaName = (name: string) =>
  name
    .split('_')
    .filter((p) => p !== '')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')

function fromProjection(base: ProjectedBase): Described {
  return sorted({
    tables: base.tables.map((t) => t.name),
    fields: base.tables.flatMap((t) => t.fields.map((f) => `${t.name}.${f.name}`)),
    linkTargets: base.tables.flatMap((t) =>
      t.fields
        .filter((f) => f.link?.target !== undefined)
        .map((f) => `${t.name}.${f.name}->${f.link?.target?.table}`),
    ),
  })
}

/** Reads the OpenAPI document as a client generator would: paths, then schemas. */
function fromOpenApi(document: Record<string, unknown>, baseName: string): Described {
  const paths = document.paths as Record<string, unknown>
  const schemas = (document.components as { schemas: Record<string, unknown> }).schemas

  const prefix = `/data/${baseName}/`
  const tables = Object.keys(paths)
    .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .map((p) => p.slice(prefix.length))

  const fields: string[] = []
  const linkTargets: string[] = []

  for (const table of tables) {
    const read = schemas[`${schemaName(table)}Read`] as {
      properties: Record<string, Record<string, unknown>>
    }
    for (const [name, property] of Object.entries(read.properties)) {
      fields.push(`${table}.${name}`)
      const link = property['x-basedb-link'] as { target_table?: string } | undefined
      if (link?.target_table !== undefined) {
        linkTargets.push(`${table}.${name}->${link.target_table}`)
      }
    }
  }

  return sorted({ tables, fields, linkTargets })
}

/** Reads the documentation as a human would: its sections, its column tables. */
function fromDocumentation(doc: Documentation): Described {
  // A table section is one filed under "Tables". The others — overview, conventions,
  // relations, direct SQL — describe the base, not a table.
  const tableSections = doc.sections.filter((s) => s.group === 'Tables')

  const fields: string[] = []
  for (const section of tableSections) {
    // Only the rows of the two column tables count: the endpoint table above them also
    // opens each row with an inline code cell (`GET`), and is not a list of fields.
    let inColumns = false
    for (const line of section.markdown.split('\n')) {
      if (line.startsWith('### ')) {
        inColumns = line.startsWith('### Colonnes')
        continue
      }
      if (!inColumns) continue
      const match = /^\| `([^`]+)` \|/.exec(line)
      if (match !== null) fields.push(`${section.id}.${match[1]}`)
    }
  }

  const relations = doc.sections.find((s) => s.id === 'api-relations')
  const linkTargets: string[] = []
  for (const line of relations?.markdown.split('\n') ?? []) {
    const match = /^- `([^`]+)\.([^`.]+)` → `([^`]+)`$/.exec(line)
    if (match !== null) linkTargets.push(`${match[1]}.${match[2]}->${match[3]}`)
  }

  return sorted({ tables: tableSections.map((s) => s.id), fields, linkTargets })
}

/** Builds an actor holding `read` on the named tables, with some fields hidden. */
async function actorReading(
  email: string,
  tableIds: readonly string[],
  hiddenFieldIds: readonly string[] = [],
): Promise<RequestContext> {
  const userId = await pools.withConnection('catalog', async (exec) => {
    const [u] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
       VALUES ($1, $2, $2, $3, $3) RETURNING id`,
      [tenantId, email, admin.actor.id],
      'insert',
    )
    const [r] = await exec.query<{ id: string }>(
      `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
       VALUES ($1, $2, $2, $2, $3) RETURNING id`,
      [tenantId, email.split('@')[0], admin.actor.id],
      'insert',
    )
    await exec.query(
      'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
      [r.id, u.id, admin.actor.id],
      'insert',
    )
    for (const tableId of tableIds) {
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
         VALUES ($1, 'table', $2, 'read', $3)`,
        [r.id, tableId, admin.actor.id],
        'insert',
      )
    }
    for (const fieldId of hiddenFieldIds) {
      await exec.query(
        `INSERT INTO _basedb.field_permission (role_id, field_id, access)
         VALUES ($1, $2, 'hidden')`,
        [r.id, fieldId],
        'insert',
      )
    }
    return u.id
  })

  const t = new Date('2026-09-19T12:00:00Z')
  return sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000002a',
    actor: { kind: 'user', id: userId },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: t,
    deadline: new Date(t.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })

  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
  })

  const bootstrap = await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    const [t] = await exec.query<{ id: string; created_by: string }>(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
      [TENANT_REF],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.app_user
         (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t
  })
  tenantId = bootstrap.id

  const now = new Date('2026-09-19T12:00:00.000Z')
  admin = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000002b',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const crm = await createBase(pools, admin, { label: 'CRM' })
  crmSchema = crm.schemaName

  const c = await createTable(pools, admin, {
    baseId: crm.baseId,
    label: 'Clients',
    description: HOSTILE_DESCRIPTION,
    fields: [
      // A HOSTILE label: injected as-is into a `title` rendered by a documentation
      // viewer, it executes its script on whoever reads it (§7.6 decision 4).
      {
        label: 'Raison <img src=x onerror=alert(1)> **sociale**',
        kind: 'short_text',
        required: true,
      },
      { label: 'Ville', kind: 'short_text', description: 'Ville du siège social.' },
    ],
  })
  await setDisplayColumn(pools, admin, { tableId: c.tableId, fieldId: c.fields[0].fieldId })
  clients = { tableId: c.tableId, displayFieldId: c.fields[0].fieldId }

  const f = await createTable(pools, admin, {
    baseId: crm.baseId,
    label: 'Factures',
    description: INVOICES_DESCRIPTION,
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number', description: AMOUNT_DESCRIPTION },
      { label: 'Commentaire', kind: 'long_text' },
    ],
  })
  invoices = { tableId: f.tableId, amountFieldId: f.fields[1].fieldId }
  await createLinkField(pools, admin, {
    tableId: f.tableId,
    targetTableId: c.tableId,
    label: 'Client',
  })

  const s = await createTable(pools, admin, {
    baseId: crm.baseId,
    label: 'Salaires',
    fields: [{ label: 'Montant', kind: 'number' }],
  })
  salaries = { tableId: s.tableId }
}, 180_000)

afterAll(async () => {
  await pools?.end()
  await container?.stop()
})

describe('§17.1.4 — the three serializations describe exactly the same thing', () => {
  /** The roles the chapter calls "test roles": each sees a different slice. */
  async function roles(): Promise<Array<{ name: string; ctx: RequestContext }>> {
    return [
      { name: 'administrateur', ctx: admin },
      {
        name: 'lecteur partiel',
        ctx: await actorReading('partiel@basedb.local', [clients.tableId, invoices.tableId]),
      },
      {
        name: 'champ masqué',
        ctx: await actorReading(
          'masque@basedb.local',
          [clients.tableId, invoices.tableId],
          [invoices.amountFieldId],
        ),
      },
      {
        name: 'cible de lien invisible',
        ctx: await actorReading('sanscible@basedb.local', [invoices.tableId]),
      },
      {
        name: 'une seule table, sans lien',
        ctx: await actorReading('salaires@basedb.local', [salaries.tableId]),
      },
    ]
  }

  it('agree for every test role', async () => {
    for (const role of await roles()) {
      const base = await projectBase(pools, role.ctx, crmSchema)
      const meta = fromProjection(base)
      const openapi = fromOpenApi(toOpenApi(base, TENANT_REF), base.name)
      const doc = fromDocumentation(toDocumentation(base, TENANT_REF))

      // The role name rides along so a failure says WHICH slice diverged.
      expect({ role: role.name, ...openapi }).toEqual({ role: role.name, ...meta })
      expect({ role: role.name, ...doc }).toEqual({ role: role.name, ...meta })
    }
  })

  it('and the slices really do differ from one role to the next', async () => {
    // Without this, the test above would pass just as well on three serializations that
    // all describe nothing.
    const all = await projectBase(pools, admin, crmSchema)
    const partial = await projectBase(
      pools,
      await actorReading('temoin@basedb.local', [clients.tableId]),
      crmSchema,
    )
    expect(fromProjection(all).tables.length).toBe(3)
    expect(fromProjection(partial).tables).toEqual(['clients'])
  })
})

describe('a link target one cannot see appears NOWHERE', () => {
  it('neither in OpenAPI, nor in the documentation', async () => {
    const ctx = await actorReading('aveugle@basedb.local', [invoices.tableId])
    const base = await projectBase(pools, ctx, crmSchema)
    const openapi = JSON.stringify(toOpenApi(base, TENANT_REF))
    const doc = JSON.stringify(toDocumentation(base, TENANT_REF))

    // The field itself stays described — it belongs to a table the reader can read.
    expect(openapi).toContain('clients_id')
    expect(doc).toContain('clients_id')
    // But the target table's name is nowhere, in either document.
    expect(openapi).not.toContain('"clients"')
    expect(openapi).not.toContain('ClientsRead')
    expect(doc).not.toContain('`clients`')
    // And the field is not offered for expansion.
    expect(openapi).not.toContain('"expand"')
  })
})

describe('§7.6 — a hostile label is neutralized in all three', () => {
  it('cannot execute in a documentation viewer', async () => {
    const base = await projectBase(pools, admin, crmSchema)
    const openapi = JSON.stringify(toOpenApi(base, TENANT_REF))
    const doc = JSON.stringify(toDocumentation(base, TENANT_REF))
    const meta = JSON.stringify(base)

    // The raw tag survives in `/meta`, which is pure data consumed by a program — but
    // the two documents a human renders must carry it inert.
    expect(meta).toContain('<img src=x onerror=alert(1)>')

    for (const document of [openapi, doc]) {
      expect(document).not.toContain('<img')
      expect(document).toContain('&lt;img')
      // Markdown emphasis is neutralized too: `**sociale**` must read as text.
      expect(document).not.toContain('**sociale**')
    }
  })

  it('still reads as the original label once rendered', async () => {
    // Escaping is not censorship: a viewer displaying the escaped string shows the
    // label the user typed, character for character.
    const base = await projectBase(pools, admin, crmSchema)
    const doc = toDocumentation(base, TENANT_REF)
    const section = doc.sections.find((s) => s.id === 'clients')
    // Parentheses are escaped too — they open a Markdown link — so what a viewer shows
    // is the original label, with nothing in it able to open a construct.
    expect(section?.markdown).toContain(
      'Raison &lt;img src=x onerror=alert\\(1\\)&gt; \\*\\*sociale\\*\\*',
    )
  })
})

describe('descriptions — one source, three serializations', () => {
  it('reach /meta, OpenAPI and the documentation', async () => {
    const base = await projectBase(pools, admin, crmSchema)
    const invoices = base.tables.find((t) => t.name === 'factures')
    const amount = invoices?.fields.find((f) => f.name === 'montant')

    // The projection holds the text as it was typed...
    expect(invoices?.description).toBe(INVOICES_DESCRIPTION)
    expect(amount?.description).toBe(AMOUNT_DESCRIPTION)

    // ...and each serialization carries it, by its own means.
    const openapi = toOpenApi(base, TENANT_REF)
    const schemas = (openapi.components as { schemas: Record<string, Record<string, unknown>> })
      .schemas
    expect(schemas.FacturesRead.description).toBe(INVOICES_DESCRIPTION)
    const properties = schemas.FacturesRead.properties as Record<string, Record<string, unknown>>
    expect(properties.montant.description).toBe(AMOUNT_DESCRIPTION)

    const doc = toDocumentation(base, TENANT_REF)
    const section = doc.sections.find((s) => s.id === 'factures')
    expect(section?.markdown).toContain(INVOICES_DESCRIPTION)
    expect(section?.markdown).toContain(
      `| \`montant\` | Montant | nombre (chaîne décimale) | ${AMOUNT_DESCRIPTION} |`,
    )
  })

  it('leave a system column with a description too', async () => {
    const base = await projectBase(pools, admin, crmSchema)
    const id = base.tables[0].fields.find((f) => f.name === '_id')
    // Without it the documentation would explain every column but the one a link needs.
    expect(id?.description).toContain('UUID')
  })

  it('are neutralized in the two documents a human renders, and raw in /meta', async () => {
    const base = await projectBase(pools, admin, crmSchema)
    const meta = JSON.stringify(base)
    // `/meta` is data consumed by a program: the text survives as typed.
    expect(meta).toContain('<script>alert(1)</script>')

    for (const document of [
      JSON.stringify(toOpenApi(base, TENANT_REF)),
      JSON.stringify(toDocumentation(base, TENANT_REF)),
    ]) {
      expect(document).not.toContain('<script')
      expect(document).toContain('&lt;script')
      expect(document).not.toContain('**tous**')
    }
  })

  it('cannot open a table cell, a list, or a second paragraph in the documentation', async () => {
    const base = await projectBase(pools, admin, crmSchema)
    const section = toDocumentation(base, TENANT_REF).sections.find((s) => s.id === 'clients')
    const lede = section?.markdown.split('\n')[0] ?? ''

    // ONE line: the newline of the description became a space, so the second line — which
    // opens with a list marker — cannot start a list.
    expect(lede).toContain('sans exception. - puis une ligne')
    expect(lede).not.toMatch(/^- /)
    // The pipe is escaped: it would otherwise close the cell of a table.
    expect(lede).toContain('\\|')
  })

  it('go with the field, so a masked field takes its description along', async () => {
    const hidden = await actorReading(
      'discret@basedb.local',
      [clients.tableId, invoices.tableId],
      [invoices.amountFieldId],
    )
    const base = await projectBase(pools, hidden, crmSchema)

    for (const document of [
      JSON.stringify(base),
      JSON.stringify(toOpenApi(base, TENANT_REF)),
      JSON.stringify(toDocumentation(base, TENANT_REF)),
    ]) {
      // A description is the first thing a reconnaissance would read about a hidden column.
      expect(document).not.toContain(AMOUNT_DESCRIPTION)
    }
    // The table's own description is still there: the reader may read the table.
    expect(JSON.stringify(base)).toContain(INVOICES_DESCRIPTION)
  })
})

describe('what OpenAPI says that /meta does not', () => {
  it('describes only the verbs the reader holds', async () => {
    const ctx = await actorReading('lecture@basedb.local', [clients.tableId])
    const document = toOpenApi(await projectBase(pools, ctx, crmSchema), TENANT_REF)
    const paths = document.paths as Record<string, Record<string, unknown>>
    const collection = paths[`${`/data/${crmSchema}/clients`}`]

    expect(Object.keys(collection).filter((k) => k !== 'parameters')).toEqual(['get'])
    // Every path takes the environment of the base (chapter 14 §1 bis).
    expect(collection.parameters).toContainEqual({
      $ref: '#/components/parameters/Environment',
    })
    // No write schema at all: there is nothing this reader could send.
    const schemas = (document.components as { schemas: Record<string, unknown> }).schemas
    expect(Object.keys(schemas)).not.toContain('ClientsWrite')
  })

  it('declares numbers as decimal strings, without exception', async () => {
    const document = toOpenApi(await projectBase(pools, admin, crmSchema), TENANT_REF)
    const schemas = (document.components as { schemas: Record<string, unknown> }).schemas
    const read = schemas.FacturesRead as { properties: Record<string, Record<string, unknown>> }
    // A float would silently round an amount, and the column is `numeric`.
    expect(read.properties.montant.format).toBe('decimal')
    expect(read.properties.montant.type).toEqual(['string', 'null'])
  })

  it('marks rich text as needing sanitizing at render time', async () => {
    // The API does not re-sanitize on read: the contract is that the consumer does it,
    // so the specification has to say which fields are concerned.
    const document = toOpenApi(await projectBase(pools, admin, crmSchema), TENANT_REF)
    const schemas = (document.components as { schemas: Record<string, unknown> }).schemas
    const read = schemas.FacturesRead as { properties: Record<string, Record<string, unknown>> }
    // `commentaire` is a plain long text here, so it is NOT flagged: the marker follows
    // the catalog's `is_rich`, it is not guessed from the type.
    expect(read.properties.commentaire['x-basedb-unsafe-html']).toBeUndefined()
  })

  it('describes referenced_by only where an inverse group is visible', async () => {
    const ctx = await actorReading('inverse@basedb.local', [clients.tableId, invoices.tableId])
    const document = toOpenApi(await projectBase(pools, ctx, crmSchema), TENANT_REF)
    const paths = Object.keys(document.paths as Record<string, unknown>)
    expect(paths).toContain(`/data/${crmSchema}/clients/{id}/referenced_by`)
    expect(paths).not.toContain(`/data/${crmSchema}/factures/{id}/referenced_by`)
  })
})
