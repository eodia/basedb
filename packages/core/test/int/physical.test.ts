import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * Chapter 06, end to end: physical renames and their compatibility aliases, the blank cut,
 * and the purge — on a real PostgreSQL, looking at what `pg_catalog` says, since that is
 * what a direct SQL consumer sees.
 */

const TENANT = 't6ph9zs'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminSession: string
let sql: pg.Client
let exportDir: string
let crm: { baseId: string; schemaName: string }
let clients: { tableId: string; name: string }
let factures: { tableId: string; name: string }
let nomField: string
let manager: RequestContext

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
}

async function relations(schema: string): Promise<string[]> {
  const { rows } = await sql.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'v') ORDER BY 1`,
    [schema],
  )
  return rows.map((r) => r.relname)
}

async function schemaOf(baseId: string): Promise<string> {
  const { rows } = await sql.query(
    `SELECT n.name FROM _basedb.db_schema s JOIN _basedb.physical_name n ON n.id = s.name_id
      WHERE s.base_id = $1 AND s.role = 'current' AND s.dropped_at IS NULL`,
    [baseId],
  )
  return rows[0].name
}

async function stateOf(scopeId: string, name: string): Promise<string | undefined> {
  const { rows } = await sql.query(
    'SELECT state FROM _basedb.physical_name WHERE scope_id = $1 AND name = $2',
    [scopeId, name],
  )
  return rows[0]?.state
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  exportDir = mkdtempSync(join(tmpdir(), 'basedb-exports-'))
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
    exportDir,
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await kernel.openContext({ userId: boot.userId, requestId: randomUUID(), surface: 'ui' })
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  crm = await kernel.createBase(admin, { label: 'CRM' })
  const c = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  clients = { tableId: c.tableId, name: c.tableName }
  nomField = c.fields[0].fieldId
  const f = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Factures',
    fields: [{ label: 'Numéro', kind: 'short_text' }],
  })
  factures = { tableId: f.tableId, name: f.tableName }
  await kernel.createLinkField(admin, {
    tableId: f.tableId,
    targetTableId: c.tableId,
    label: 'Client',
  })
  const acme = await kernel.createRecord(admin, {
    tableId: clients.tableId,
    values: { nom: 'ACME' },
  })
  await kernel.createRecord(admin, {
    tableId: factures.tableId,
    values: { numero: 'F-1', clients_id: acme.row._id },
  })

  // A manager of the base: « Gestion », which is not the administration role.
  const group = (await kernel.createGroup(admin, { label: 'Gestion CRM', sessionId: adminSession }))
    .id
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: group, scope: { kind: 'base', id: crm.baseId }, level: 'manage' }],
    sessionId: adminSession,
  })
  const m = await kernel.createUser(admin, {
    email: 'gestion@exemple.fr',
    displayName: 'Gestion',
    groupIds: [group],
    sessionId: adminSession,
  })
  manager = await kernel.openContext({ userId: m.user.id, requestId: randomUUID(), surface: 'ui' })

  sql = new pg.Client({ connectionString: container.getConnectionUri() })
  await sql.connect()
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await kernel?.close()
  await container?.stop()
})

describe('renaming a table in the database (§2)', () => {
  it('the impact names what will stop matching, and a manager is not an administrator', async () => {
    const impact = await kernel.renameImpact(admin, { kind: 'table', id: clients.tableId })
    expect(impact).toMatchObject({
      current: 'clients',
      qualified: `${crm.schemaName}.clients`,
      aliasAllowed: true,
      liveAliases: 0,
    })
    expect(impact.misalignedLinks).toEqual([
      { table: 'factures', column: 'clients_id', label: 'Client' },
    ])
    expect(await codeOf(kernel.renameImpact(manager, { kind: 'table', id: clients.tableId }))).toBe(
      'ADMIN_REQUIRED',
    )
  })

  it('renames, and leaves a writable alias under the old name', async () => {
    expect(
      await codeOf(
        kernel.renamePhysical(admin, {
          kind: 'table',
          id: clients.tableId,
          name: 'comptes',
          confirm: 'Clients',
        }),
      ),
    ).toBe('REQUEST_INVALID')

    const renamed = await kernel.renamePhysical(admin, {
      kind: 'table',
      id: clients.tableId,
      name: 'comptes',
      confirm: 'clients',
    })
    expect(renamed).toMatchObject({ name: 'comptes', alias: 'clients' })
    expect(await relations(crm.schemaName)).toEqual(
      expect.arrayContaining(['clients', 'comptes', 'factures']),
    )
    expect(await stateOf(await schemaIdOf(crm.baseId), 'clients')).toBe('alias')

    // The product follows the catalog; a direct consumer follows the alias — reads and
    // writes, and a write through the alias is captured like any other.
    const listed = await kernel.listRecords(admin, { tableId: clients.tableId })
    expect(listed.rows.map((r) => r.nom)).toEqual(['ACME'])
    const through = await sql.query(`SELECT nom FROM "${crm.schemaName}"."clients"`)
    expect(through.rows).toEqual([{ nom: 'ACME' }])
    await sql.query(
      `INSERT INTO "${crm.schemaName}"."clients" (_id, nom) VALUES (gen_random_uuid(), 'Par l’alias')`,
    )
    const after = await kernel.listRecords(admin, { tableId: clients.tableId })
    expect(after.rows.map((r) => r.nom).sort()).toEqual(['ACME', 'Par l’alias'])
    await kernel.drainHistory()
    const history = await kernel.baseHistory(admin, { baseId: crm.baseId })
    expect(history.revisions.some((r) => r.op === 'insert' && r.actor.kind === 'sql_direct')).toBe(
      true,
    )
  })

  it('a name the registry knows is refused, and a free one is suggested', async () => {
    const error = await kernel
      .renamePhysical(admin, {
        kind: 'table',
        id: clients.tableId,
        name: 'clients',
        confirm: 'comptes',
      })
      .then(
        () => null,
        (e) => e as { code: string; details: Record<string, unknown> },
      )
    expect(error?.code).toBe('NAME_RETIRED')
    expect(error?.details).toMatchObject({ state: 'alias', suggestion: 'clients_2' })
    expect(
      await codeOf(
        kernel.renamePhysical(admin, {
          kind: 'table',
          id: clients.tableId,
          name: 'pg_tables',
          confirm: 'comptes',
        }),
      ),
    ).toBe('IDENTIFIER_INVALID')
  })

  it('renamed twice, both aliases lead to the table', async () => {
    await kernel.renamePhysical(admin, {
      kind: 'table',
      id: clients.tableId,
      name: 'tiers',
      confirm: 'comptes',
    })
    for (const name of ['clients', 'comptes', 'tiers']) {
      const { rows } = await sql.query(
        `SELECT count(*)::int AS n FROM "${crm.schemaName}"."${name}"`,
      )
      expect(rows[0].n).toBe(2)
    }
    expect(
      (await kernel.renameImpact(admin, { kind: 'table', id: clients.tableId })).liveAliases,
    ).toBe(2)
  })
})

async function schemaIdOf(baseId: string): Promise<string> {
  const { rows } = await sql.query(
    `SELECT id FROM _basedb.db_schema WHERE base_id = $1 AND role = 'current' AND dropped_at IS NULL`,
    [baseId],
  )
  return rows[0].id
}

describe('renaming a field (§3.1: no alias)', () => {
  it('renames the column, and the alias views keep their frozen output name', async () => {
    expect(
      await codeOf(
        kernel.renamePhysical(admin, {
          kind: 'field',
          id: nomField,
          name: 'raison_sociale',
          confirm: 'nom',
          alias: true,
        }),
      ),
    ).toBe('REQUEST_INVALID')
    await kernel.renamePhysical(admin, {
      kind: 'field',
      id: nomField,
      name: 'raison_sociale',
      confirm: 'nom',
    })
    const { rows } = await sql.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'tiers' ORDER BY ordinal_position`,
      [crm.schemaName],
    )
    expect(rows.map((r) => r.column_name)).toContain('raison_sociale')
    const legacy = await sql.query(`SELECT nom FROM "${crm.schemaName}"."clients" ORDER BY nom`)
    expect(legacy.rows.map((r) => r.nom)).toEqual(['ACME', 'Par l’alias'])
    const listed = await kernel.listRecords(admin, { tableId: clients.tableId })
    expect(listed.columns).toContain('raison_sociale')
  })
})

describe('renaming a base (§2.4), and the life of its aliases (§3.5)', () => {
  it('renames the schema, and leaves one with a view per table under the old name', async () => {
    const renamed = await kernel.renamePhysical(admin, {
      kind: 'base',
      id: crm.baseId,
      name: 'ventes',
      confirm: 'crm',
    })
    expect(renamed.alias).toBe(crm.schemaName)
    const current = await schemaOf(crm.baseId)
    expect(current).toBe(`b_${TENANT}_ventes`)
    expect(await relations(crm.schemaName)).toEqual(['factures', 'tiers'])
    const { rows } = await sql.query(`SELECT numero FROM "${crm.schemaName}"."factures"`)
    expect(rows).toEqual([{ numero: 'F-1' }])

    const aliases = await kernel.listAliases(admin, { baseId: crm.baseId })
    const schemaAlias = aliases.find((a) => a.kind === 'schema')
    expect(schemaAlias).toMatchObject({ name: crm.schemaName, views: 2, target: current })
    expect(
      aliases
        .filter((a) => a.kind === 'view')
        .map((a) => a.name)
        .sort(),
    ).toEqual(['clients', 'comptes'])
  })

  it('a blank cut makes the alias disappear, and one click brings it back', async () => {
    const alias = (await kernel.listAliases(admin, { baseId: crm.baseId })).find(
      (a) => a.name === 'clients',
    )
    expect(
      await codeOf(kernel.startBlankCut(admin, { aliasId: alias?.id as string, days: 7 })),
    ).toBe('REQUEST_INVALID')
    const cut = await kernel.startBlankCut(admin, { aliasId: alias?.id as string })
    expect(cut?.blankCut?.name).toMatch(/^zz_alias_\d{8}_clients$/)
    const schema = await schemaOf(crm.baseId)
    expect(await relations(schema)).not.toContain('clients')
    const back = await kernel.endBlankCut(admin, { aliasId: alias?.id as string })
    expect(back?.blankCut).toBeNull()
    expect(await relations(schema)).toContain('clients')
  })

  it('an alias someone built on is not dropped; once free, it is — and its name stays taken', async () => {
    const schema = await schemaOf(crm.baseId)
    const alias = (await kernel.listAliases(admin, { baseId: crm.baseId })).find(
      (a) => a.name === 'comptes',
    ) as { id: string }
    await sql.query(`CREATE VIEW public.rapport AS SELECT * FROM "${schema}"."comptes"`)
    expect(
      (await kernel.listAliases(admin, { baseId: crm.baseId })).find((a) => a.id === alias.id)
        ?.dependents,
    ).toEqual(['public.rapport'])
    expect(await codeOf(kernel.dropAlias(admin, { aliasId: alias.id, confirm: 'comptes' }))).toBe(
      'DEPENDENT_OBJECT',
    )
    await sql.query('DROP VIEW public.rapport')
    await kernel.dropAlias(admin, { aliasId: alias.id, confirm: 'comptes' })
    expect(await relations(schema)).not.toContain('comptes')
    expect(await stateOf(await schemaIdOf(crm.baseId), 'comptes')).toBe('retired')
  })

  it('the schema alias goes whole: its views, then the schema, RESTRICT', async () => {
    const alias = (await kernel.listAliases(admin, { baseId: crm.baseId })).find(
      (a) => a.kind === 'schema',
    ) as { id: string; name: string }
    await kernel.dropAlias(admin, { aliasId: alias.id, confirm: alias.name })
    const { rows } = await sql.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [alias.name])
    expect(rows).toEqual([])
  })
})

describe('the purge (§5)', () => {
  let notes: { tableId: string }

  it('a deleted table: listed, exported, and not purged before thirty days', async () => {
    const t = await kernel.createTable(admin, {
      baseId: crm.baseId,
      label: 'Notes',
      fields: [{ label: 'Texte', kind: 'long_text' }],
    })
    notes = { tableId: t.tableId }
    for (const texte of ['un', 'deux, avec virgule', 'trois "citées"']) {
      await kernel.createRecord(admin, { tableId: t.tableId, values: { texte } })
    }
    await kernel.deleteTable(admin, { tableId: t.tableId })
    const deleted = await kernel.listDeletedTables(admin, { baseId: crm.baseId })
    expect(deleted.map((d) => d.label)).toEqual(['Notes'])

    const exported = await kernel.exportForPurge(admin, { kind: 'table', id: t.tableId })
    expect(exported.totalRows).toBe(3)
    const csv = readFileSync(join(exported.directory, exported.tables[0]?.file as string), 'utf8')
    expect(csv).toContain('"deux, avec virgule"')
    expect(csv).toContain('"trois ""citées"""')
    expect(existsSync(join(exported.directory, 'manifest.json'))).toBe(true)

    // Not the instance administrator's shortcut: a manager is not even an administrator.
    expect(
      await codeOf(
        kernel.purge(manager, {
          kind: 'table',
          id: t.tableId,
          exportId: exported.id,
          confirm: 'Notes',
        }),
      ),
    ).toBe('ADMIN_REQUIRED')
    expect(
      await codeOf(
        kernel.purge(admin, {
          kind: 'table',
          id: t.tableId,
          exportId: exported.id,
          confirm: 'Notes',
        }),
      ),
    ).toBe('PURGE_TOO_EARLY')
  })

  it('a write since the export makes it stale; a fresh export, and the table is gone for good', async () => {
    await sql.query(
      `UPDATE _basedb.table_def SET deleted_at = deleted_at - interval '31 days' WHERE id = $1`,
      [notes.tableId],
    )
    const first = await kernel.exportForPurge(admin, { kind: 'table', id: notes.tableId })
    const [deleted] = await kernel.listDeletedTables(admin, { baseId: crm.baseId })
    const schema = await schemaOf(crm.baseId)
    await sql.query(
      `INSERT INTO "${schema}"."${deleted?.name}" (_id, texte) VALUES (gen_random_uuid(), 'tardif')`,
    )
    expect(
      await codeOf(
        kernel.purge(admin, {
          kind: 'table',
          id: notes.tableId,
          exportId: first.id,
          confirm: 'Notes',
        }),
      ),
    ).toBe('EXPORT_STALE')

    const second = await kernel.exportForPurge(admin, { kind: 'table', id: notes.tableId })
    expect(second.totalRows).toBe(4)
    expect(
      await codeOf(
        kernel.purge(admin, {
          kind: 'table',
          id: notes.tableId,
          exportId: second.id,
          confirm: 'notes',
        }),
      ),
    ).toBe('REQUEST_INVALID')
    const done = await kernel.purge(admin, {
      kind: 'table',
      id: notes.tableId,
      exportId: second.id,
      confirm: 'Notes',
    })
    expect(done.purgedTables).toBe(1)
    expect(await relations(schema)).not.toContain(deleted?.name)
    const { rows } = await sql.query('SELECT is_purged FROM _basedb.table_def WHERE id = $1', [
      notes.tableId,
    ])
    expect(rows[0].is_purged).toBe(true)
    expect(await stateOf(await schemaIdOf(crm.baseId), deleted?.name as string)).toBe('purged')
    expect(await kernel.listDeletedTables(admin, { baseId: crm.baseId })).toEqual([])
    // An export serves once.
    expect(
      await codeOf(
        kernel.purge(admin, {
          kind: 'table',
          id: notes.tableId,
          exportId: second.id,
          confirm: 'Notes',
        }),
      ),
    ).toBe('RESOURCE_NOT_FOUND')
  })

  it('a deleted base, purged early by an instance administrator who says why', async () => {
    const rh = await kernel.createBase(admin, { label: 'RH' })
    const t = await kernel.createTable(admin, {
      baseId: rh.baseId,
      label: 'Salariés',
      fields: [{ label: 'Nom', kind: 'short_text' }],
    })
    await kernel.createRecord(admin, { tableId: t.tableId, values: { nom: 'Dupont' } })
    await kernel.deleteBase(admin, { baseId: rh.baseId })
    const exported = await kernel.exportForPurge(admin, { kind: 'base', id: rh.baseId })
    expect(exported.totalRows).toBe(1)
    const done = await kernel.purge(admin, {
      kind: 'base',
      id: rh.baseId,
      exportId: exported.id,
      confirm: 'RH',
      early: { justification: 'Données de test saisies par erreur.' },
    })
    expect(done).toMatchObject({ purgedTables: 1, residualSchema: false })
    expect((await kernel.listDeletedBases(admin)).map((b) => b.label)).not.toContain('RH')
    const audit = await sql.query(
      `SELECT payload FROM _basedb.audit_log WHERE action = 'purge.early' AND object_id = $1`,
      [rh.baseId],
    )
    expect(audit.rows[0]?.payload.justification).toBe('Données de test saisies par erreur.')
  })

  it('an unknown object in the schema: the tables go, the schema stays — RESIDUAL_SCHEMA', async () => {
    const paie = await kernel.createBase(admin, { label: 'Paie' })
    await kernel.createTable(admin, {
      baseId: paie.baseId,
      label: 'Bulletins',
      fields: [{ label: 'Mois', kind: 'short_text' }],
    })
    await kernel.deleteBase(admin, { baseId: paie.baseId })
    const relegated = (await kernel.listDeletedBases(admin)).find((b) => b.label === 'Paie')
      ?.name as string
    await sql.query(`CREATE VIEW "${relegated}"."constante" AS SELECT 1 AS un`)
    const exported = await kernel.exportForPurge(admin, { kind: 'base', id: paie.baseId })
    const done = await kernel.purge(admin, {
      kind: 'base',
      id: paie.baseId,
      exportId: exported.id,
      confirm: 'Paie',
      early: { justification: 'Test du schéma résiduel.' },
    })
    expect(done.residualSchema).toBe(true)
    expect(await relations(relegated)).toEqual(['constante'])
  })
})
