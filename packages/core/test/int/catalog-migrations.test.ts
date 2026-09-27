import { randomUUID } from 'node:crypto'
import {
  type CatalogMigration,
  catalogMigrations,
  checksumOf,
  sealedMigrations,
} from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startKernel } from '../../src/index.js'
import { inspectCatalog, migrateCatalog } from '../../src/runtime/catalog-migrations.js'

/**
 * Catalog migrations — chapter 02, « Amorçage ».
 *
 * The promise to whoever installed basedb: whatever version they run, starting a newer
 * one brings their catalog to exactly what a fresh installation of it has, their data
 * kept — and nothing starts on a catalog whose history the code cannot vouch for.
 *
 * Every published version is rebuilt here from `migrations/sealed.json`, upgraded, and
 * compared with a fresh catalog object by object: a migration that upgrades differently
 * from how it installs fails here, not at a customer's.
 */

const PASSWORD = 'des tables bien rangees'
const shipped = catalogMigrations()

let container: StartedPostgreSqlContainer
let admin: Client

/** A new, empty database of the container, by its connection string. */
async function database(): Promise<string> {
  const name = `c_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  await admin.query(`CREATE DATABASE ${name}`)
  const uri = new URL(container.getConnectionUri())
  uri.pathname = `/${name}`
  return uri.toString()
}

async function withClient<T>(uri: string, work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: uri })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('aucun refus')
}

/** `a < b` for `x.y.z` versions. */
const before = (a: string, b: string) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0)
  }
  return false
}

/**
 * The catalog as an installation of `release` has it: the migrations published up to
 * it, applied as that version did — before 0.2.0 without writing their record — and a
 * little of what people put in it.
 */
async function installation(release: string): Promise<string> {
  const sealed = sealedMigrations()
  const last = sealed.findLastIndex((s) => s.release === release)
  const published = shipped.slice(0, last + 1)
  const uri = await database()
  await withClient(uri, async (client) => {
    for (const migration of published) await client.query(migration.sql)
    if (!before(release, '0.2.0')) {
      for (const migration of published) {
        await client.query(
          `INSERT INTO _basedb.catalog_migration (version, name, checksum, app_release, duration_ms)
           VALUES ($1, $2, $3, $4, 1)`,
          [migration.version, migration.name, migration.checksum, release],
        )
      }
    }
    // A tenant, its administrator and a project, as the first start of that version made.
    await client.query('BEGIN')
    const { rows } = await client.query<{ id: string; created_by: string }>(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ('t4z56fq', 't4z56fq', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
    )
    const tenant = rows[0] as { id: string; created_by: string }
    await client.query(
      `INSERT INTO _basedb.app_user
         (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
       VALUES ($1, $2, 'admin@exemple.fr', 'Administration', true, true, $1, $1)`,
      [tenant.created_by, tenant.id],
    )
    await client.query(
      `INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
       VALUES ($1, 'Projet principal', 'projet principal', $2, $2)`,
      [tenant.id, tenant.created_by],
    )
    await client.query('COMMIT')
  })
  return uri
}

/** Every object of the two schemas, by name, with its definition. */
async function fingerprint(uri: string): Promise<string[]> {
  return withClient(uri, async (client) => {
    const { rows } = await client.query<{ line: string }>(
      `WITH s(name) AS (VALUES ('_basedb'), ('_basedb_local'))
       SELECT line FROM (
         SELECT 'column ' || table_schema || '.' || table_name || '.' || column_name || ' '
                || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') AS line
           FROM information_schema.columns WHERE table_schema IN (SELECT name FROM s)
         UNION ALL
         SELECT 'constraint ' || n.nspname || '.' || t.relname || '.' || c.conname || ' '
                || pg_get_constraintdef(c.oid)
           FROM pg_constraint c
           JOIN pg_class t     ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname IN (SELECT name FROM s)
         UNION ALL
         SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname IN (SELECT name FROM s)
         UNION ALL
         SELECT 'function ' || n.nspname || '.' || p.proname || '('
                || pg_get_function_identity_arguments(p.oid) || ') '
                || md5(pg_get_functiondef(p.oid))
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname IN (SELECT name FROM s) AND p.prokind IN ('f', 'p')
         UNION ALL
         SELECT 'trigger ' || pg_get_triggerdef(t.oid)
           FROM pg_trigger t
           JOIN pg_class c     ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE NOT t.tgisinternal AND n.nspname IN (SELECT name FROM s)
         UNION ALL
         SELECT 'view ' || schemaname || '.' || viewname || ' ' || md5(definition)
           FROM pg_views WHERE schemaname IN (SELECT name FROM s)
       ) objects ORDER BY line`,
    )
    return rows.map((r) => r.line)
  })
}

const ledgerOf = (uri: string) =>
  withClient(uri, async (client) => {
    const { rows } = await client.query<{ version: number; name: string; app_release: string }>(
      'SELECT version, name, app_release FROM _basedb.catalog_migration ORDER BY version',
    )
    return rows
  })

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  admin = new Client({ connectionString: container.getConnectionUri() })
  await admin.connect()
}, 120_000)

afterAll(async () => {
  await admin?.end()
  await container?.stop()
})

describe('the migrations the code ships', () => {
  it('are numbered from 1 without a gap, and the published ones are intact', () => {
    expect(shipped.map((m) => m.version)).toEqual(shipped.map((_, i) => i + 1))
    const sealed = sealedMigrations()
    expect(sealed.length).toBeGreaterThan(0)
    for (const s of sealed) {
      const migration = shipped[s.version - 1]
      // Edited after publication: an installation that applied it would refuse to start.
      expect(migration?.name, `${s.name} a disparu ou a été renommée`).toBe(s.name)
      expect(migration?.checksum.toString('hex'), `${s.name} a été modifiée`).toBe(s.sha256)
    }
  })
})

describe('a fresh database', () => {
  it('receives every migration, recorded with this version, and then none', async () => {
    const uri = await database()
    expect(await inspectCatalog(uri)).toEqual({
      applied: 0,
      shipped: shipped.length,
      pending: shipped.map((m) => m.name),
    })
    expect(await migrateCatalog(uri, '9.9.9')).toEqual(shipped.map((m) => m.name))
    expect((await ledgerOf(uri)).map((r) => [r.version, r.app_release])).toEqual(
      shipped.map((m) => [m.version, '9.9.9']),
    )
    expect(await migrateCatalog(uri, '9.9.9')).toEqual([])
    expect((await inspectCatalog(uri)).pending).toEqual([])
  })

  it('a process that finds another one migrating says so, waits, and only then gives up', async () => {
    const uri = await database()
    const holder = new Client({ connectionString: uri })
    await holder.connect()
    try {
      await holder.query('SELECT pg_advisory_lock(1, 1)')
      let waited = 0
      expect(
        await codeOf(
          migrateCatalog(uri, 'x', {
            lockWaitMs: 1500,
            onWaiting: () => {
              waited += 1
            },
          }),
        ),
      ).toBe('LOCK_UNAVAILABLE')
      expect(waited).toBe(1)
    } finally {
      await holder.end()
    }
    // The holder gone, its lock is too.
    expect(await migrateCatalog(uri, 'x')).toHaveLength(shipped.length)
  })

  it('two processes starting together migrate it once', async () => {
    const uri = await database()
    const [a, b] = await Promise.all([migrateCatalog(uri, 'a'), migrateCatalog(uri, 'b')])
    expect([...(a ?? []), ...(b ?? [])]).toEqual(shipped.map((m) => m.name))
    expect(await ledgerOf(uri)).toHaveLength(shipped.length)
  })
})

describe('an installation of every published version', () => {
  const releases = [...new Set(sealedMigrations().map((s) => s.release))]

  for (const release of releases) {
    it(`${release} comes up to exactly what a fresh one has, its data kept`, async () => {
      const fresh = await database()
      const kernelFresh = startKernel({
        connectionString: fresh,
        encryptionKey: 'cle-de-test-0123456789',
      })
      await kernelFresh.migrateCatalog()
      await kernelFresh.close()

      const old = await installation(release)
      const kernel = startKernel({ connectionString: old, encryptionKey: 'cle-de-test-0123456789' })
      try {
        const state = await kernel.catalogStatus()
        expect(state.pending.length).toBe(shipped.length - state.applied)
        await kernel.migrateCatalog()
        const reference = await fingerprint(fresh)
        // Hundreds of columns, constraints, indexes, functions: an empty comparison proves nothing.
        expect(reference.length).toBeGreaterThan(500)
        expect(reference.some((line) => line.includes('_basedb.invitation'))).toBe(true)
        expect(await fingerprint(old)).toEqual(reference)

        const ledger = await ledgerOf(old)
        expect(ledger.map((r) => r.name)).toEqual(shipped.map((m) => m.name))
        if (before(release, '0.2.0')) expect(ledger[0]?.app_release).toBe('antérieure à 0.2.0')

        // What was there is still there, and the product works on it.
        const boot = await kernel.bootstrap({ tenantRef: 't4z56fq' })
        expect(boot).toMatchObject({ email: 'admin@exemple.fr', alreadyDone: true })
        const session = await kernel.signUp({
          tenantRef: 't4z56fq',
          email: 'lea@exemple.fr',
          displayName: 'Léa Martin',
          password: PASSWORD,
          requestId: randomUUID(),
        })
        const lea = await kernel.openContext({
          userId: session.userId,
          requestId: randomUUID(),
          surface: 'rest',
        })
        // The name the administrator's project holds is hers to take too.
        await kernel.createProject(lea, { label: 'Projet principal' })
        expect((await kernel.listProjects(lea)).map((p) => p.label)).toEqual(['Projet principal'])
      } finally {
        await kernel.close()
      }
    }, 120_000)
  }
})

describe('a catalog the code cannot vouch for', () => {
  it('a recorded migration that differs stops everything, and nothing is applied', async () => {
    const uri = await database()
    await migrateCatalog(uri, 'x')
    await withClient(uri, (c) =>
      c.query("UPDATE _basedb.catalog_migration SET checksum = '\\x00' WHERE version = 1"),
    )
    expect(await codeOf(inspectCatalog(uri))).toBe('CATALOG_CHECKSUM_MISMATCH')
    expect(await codeOf(migrateCatalog(uri, 'x'))).toBe('CATALOG_CHECKSUM_MISMATCH')
  })

  it('a newer version’s catalog is not written into by an older one', async () => {
    const uri = await database()
    await migrateCatalog(uri, 'x')
    await withClient(uri, (c) =>
      c.query(
        `INSERT INTO _basedb.catalog_migration (version, name, checksum, app_release, duration_ms)
         VALUES ($1, '9999_futur.sql', '\\x00', '99.0.0', 1)`,
        [shipped.length + 1],
      ),
    )
    expect(await codeOf(inspectCatalog(uri))).toBe('CATALOG_VERSION_AHEAD')
    expect(await codeOf(migrateCatalog(uri, 'x'))).toBe('CATALOG_VERSION_AHEAD')
  })
})

describe('a migration that fails', () => {
  it('leaves the catalog at the previous version, and says which one failed', async () => {
    const uri = await database()
    await migrateCatalog(uri, 'x')
    const broken: CatalogMigration = {
      version: shipped.length + 1,
      name: `${String(shipped.length + 1).padStart(4, '0')}_casse.sql`,
      sql: 'CREATE TABLE _basedb.essai (id int); SELECT 1 / 0;',
      checksum: checksumOf('casse'),
    }
    await expect(migrateCatalog(uri, 'x', { migrations: [...shipped, broken] })).rejects.toThrow(
      broken.name,
    )
    expect(await ledgerOf(uri)).toHaveLength(shipped.length)
    const [exists] = await withClient(uri, async (c) => {
      const { rows } = await c.query<{ found: boolean }>(
        "SELECT to_regclass('_basedb.essai') IS NOT NULL AS found",
      )
      return rows
    })
    expect(exists?.found).toBe(false)
  })
})

describe('the questions of 0.3.0', () => {
  it('stay with the whole base; a new one is its author’s', async () => {
    const uri = await installation('0.3.0')
    const made = await withClient(uri, async (client) => {
      const { rows } = await client.query<{ tenant: string; admin: string; project: string }>(
        `SELECT t.id AS tenant, t.created_by AS admin, p.id AS project
           FROM _basedb.tenant t JOIN _basedb.project p ON p.tenant_id = t.id`,
      )
      const at = rows[0] as { tenant: string; admin: string; project: string }
      const insert = async (sql: string, values: unknown[]) =>
        ((await client.query<{ id: string }>(sql, values)).rows[0] as { id: string }).id
      const base = await insert(
        `INSERT INTO _basedb.base (tenant_id, project_id, label, label_key, created_by, updated_by)
         VALUES ($1, $2, 'Ventes', 'ventes', $3, $3) RETURNING id`,
        [at.tenant, at.project, at.admin],
      )
      const question = await insert(
        `INSERT INTO _basedb.question (base_id, label, kind, query, created_by, updated_by)
         VALUES ($1, 'Chiffre du mois', 'sql', '{"kind":"sql","sql":"SELECT 1"}', $2, $2)
         RETURNING id`,
        [base, at.admin],
      )
      return { base, admin: at.admin, question }
    })

    const kernel = startKernel({ connectionString: uri, encryptionKey: 'cle-de-test-0123456789' })
    try {
      await kernel.migrateCatalog()
    } finally {
      await kernel.close()
    }

    await withClient(uri, async (client) => {
      const { rows } = await client.query('SELECT id::text, audience FROM _basedb.question')
      expect(rows).toEqual([{ id: made.question, audience: 'base' }])
      const fresh = await client.query<{ audience: string }>(
        `INSERT INTO _basedb.question (base_id, label, kind, query, created_by, updated_by)
         VALUES ($1, 'À moi', 'sql', '{"kind":"sql","sql":"SELECT 2"}', $2, $2)
         RETURNING audience`,
        [made.base, made.admin],
      )
      expect(fresh.rows[0]?.audience).toBe('personal')
      const saved = await client.query<{ found: boolean }>(
        "SELECT to_regclass('_basedb.saved_query') IS NOT NULL AS found",
      )
      expect(saved.rows[0]?.found).toBe(true)
    })
  })
})
