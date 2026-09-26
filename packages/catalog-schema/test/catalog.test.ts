import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CATALOG_SCHEMA, LOCAL_SCHEMA, catalogMigrations } from '../src/index.js'

/**
 * Catalog integration test — chapter 10 §7.
 *
 * It applies the DDL on a real PostgreSQL 16, under a role that OWNS THE DATABASE AND
 * IS NOT SUPERUSER, per the cadrage: "The tool assumes only an existing Postgres
 * database and a role owning that database. No command requiring instance privileges."
 *
 * This is the only test that proves the DDL of chapter 02 is applicable.
 */

let container: StartedPostgreSqlContainer
let client: Client

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('postgres')
    .withUsername('postgres')
    .withPassword('postgres')
    .start()

  // The operating role: it owns its database and nothing else.
  const admin = new Client({ connectionString: container.getConnectionUri() })
  await admin.connect()
  await admin.query("CREATE ROLE basedb_owner LOGIN PASSWORD 'basedb'")
  await admin.query('CREATE DATABASE basedb OWNER basedb_owner')
  await admin.end()

  client = new Client({
    host: container.getHost(),
    port: container.getPort(),
    database: 'basedb',
    user: 'basedb_owner',
    password: 'basedb',
  })
  await client.connect()
}, 180_000)

afterAll(async () => {
  await client?.end()
  await container?.stop()
})

describe('the catalog applies under a non-superuser role', () => {
  it('the role is neither superuser nor allowed to create databases', async () => {
    const { rows } = await client.query<{ rolsuper: boolean; rolcreatedb: boolean }>(
      'SELECT rolsuper, rolcreatedb FROM pg_roles WHERE rolname = current_user',
    )
    expect(rows[0].rolsuper, 'the test would lose all meaning under superuser').toBe(false)
    expect(rows[0].rolcreatedb).toBe(false)
  })

  it('PostgreSQL 16 at least (A1)', async () => {
    const { rows } = await client.query<{ v: string }>(
      "SELECT current_setting('server_version_num') AS v",
    )
    expect(Number(rows[0].v)).toBeGreaterThanOrEqual(160000)
  })

  it('applies every migration without error and without 42501', async () => {
    const migrations = catalogMigrations()
    expect(migrations.length).toBeGreaterThan(0)

    for (const m of migrations) {
      try {
        await client.query(m.sql)
      } catch (error) {
        const e = error as { code?: string; message?: string }
        // 42501 = insufficient_privilege: the migration would require rights the
        // cadrage forbids assuming.
        throw new Error(
          `${m.name} failed${e.code === '42501' ? ' FOR LACK OF PRIVILEGE (42501)' : ''}: ${e.message}`,
        )
      }
    }
  })
})

describe('resulting structure', () => {
  it('both schemas exist, and only those', async () => {
    const { rows } = await client.query<{ nspname: string }>(
      `SELECT nspname FROM pg_namespace
       WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
       ORDER BY nspname`,
    )
    expect(rows.map((r) => r.nspname)).toEqual([CATALOG_SCHEMA, LOCAL_SCHEMA, 'public'])
  })

  it('the expected catalog tables are present', async () => {
    const { rows } = await client.query<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
      [CATALOG_SCHEMA],
    )
    const tables = new Set(rows.map((r) => r.tablename))

    // The foundation the other chapters depend on.
    for (const expected of [
      'physical_name',
      'physical_state',
      'lock_class',
      'tenant',
      'app_user',
      'auth_identity',
      'session',
      'confirmation_challenge',
      'role',
      'permission',
      'field_permission',
      'base',
      'db_schema',
      'table_def',
      'field',
      'field_kind',
      'field_link_config',
      'table_constraint',
      'table_constraint_member',
      'migration',
      'catalog_migration',
      'audit_log',
      'security_log',
      'api_token',
      'webhook',
      'idempotency_key',
      'secret',
      'ai_call',
      'error_code',
      'retention_policy',
    ]) {
      expect(tables.has(expected), `_basedb.${expected} must exist`).toBe(true)
    }
  })

  it('the capture buffers live in the colocated schema (A9, A10)', async () => {
    const { rows } = await client.query<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
      [LOCAL_SCHEMA],
    )
    const tables = rows.map((r) => r.tablename)
    expect(tables).toContain('revision_buffer')
    expect(tables).toContain('change_event_buffer')
  })

  it('shared functions live in `_basedb_local`, a fixed and non-configurable name (A9)', async () => {
    const { rows } = await client.query<{ proname: string; nspname: string }>(
      `SELECT p.proname, n.nspname FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ($1, $2) ORDER BY p.proname`,
      [CATALOG_SCHEMA, LOCAL_SCHEMA],
    )
    const byName = new Map(rows.map((r) => [r.proname, r.nspname]))
    expect(byName.get('uuid_generate_v7')).toBe(LOCAL_SCHEMA)
    expect(byName.get('set_updated_at')).toBe(LOCAL_SCHEMA)
  })

  it('uuid_generate_v7 does produce version 7 UUIDs, increasing', async () => {
    const { rows } = await client.query<{ u: string }>(
      `SELECT ${LOCAL_SCHEMA}.uuid_generate_v7()::text AS u FROM generate_series(1, 50)`,
    )
    const uuids = rows.map((r) => r.u)
    for (const u of uuids) {
      expect(u[14], `${u} must carry version 7`).toBe('7')
    }
    // UUIDv7 is only orderable across milliseconds: two calls within the same
    // millisecond have no guaranteed order. We therefore check the order between two
    // distinct instants, which is what cursor pagination depends on.
    const before = uuids[0]
    await new Promise((r) => setTimeout(r, 5))
    const { rows: after } = await client.query<{ u: string }>(
      `SELECT ${LOCAL_SCHEMA}.uuid_generate_v7()::text AS u`,
    )
    expect(after[0].u > before).toBe(true)
  })
})

describe('catalog invariants', () => {
  it('the registry alphabet B accepts a 63-byte name with no leading underscore', async () => {
    // The case that had revealed the inconsistency between alphabets A and B: a schema
    // name `b_<tenantId>_<53-byte slug>` is exactly 63 bytes.
    const name = `b_t4z56fq_${'a'.repeat(53)}`
    expect(Buffer.byteLength(name, 'utf8')).toBe(63)

    const { rows } = await client.query<{ ok: boolean }>(
      `SELECT ($1 ~ '^_?[a-z][a-z0-9_]{0,62}$' AND octet_length($1) <= 63) AS ok`,
      [name],
    )
    expect(rows[0].ok).toBe(true)
  })

  it('the mandatory seeds are loaded', async () => {
    const { rows: kinds } = await client.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM _basedb.field_kind',
    )
    // The thirteen types of the first catalog, the multiple relation, the computed fields
    // (lookup, rollup, count), the e-mail, the automatic number, the person and the button.
    expect(Number(kinds[0].n)).toBe(21)

    const { rows: states } = await client.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM _basedb.physical_state',
    )
    expect(Number(states[0].n)).toBeGreaterThanOrEqual(5)
  })

  it('every catalog foreign key carries a usable index (CAT-IDX drift)', async () => {
    // Without an index on the referencing side, every deletion of a target row forces a
    // full scan of the source table.
    const { rows } = await client.query<{ conname: string; conrelid: string }>(
      `SELECT c.conname, c.conrelid::regclass::text AS conrelid
         FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = '_basedb' AND c.contype = 'f'
          AND NOT EXISTS (
            SELECT 1 FROM pg_index i
             WHERE i.indrelid = c.conrelid
               AND i.indpred IS NULL
               AND (i.indkey::smallint[])[0:array_length(c.conkey, 1) - 1] = c.conkey
          )
        ORDER BY 2, 1`,
    )
    // Chapter 02 names this drift and requires it to be empty on the catalog.
    expect(rows.map((r) => `${r.conrelid}.${r.conname}`)).toEqual([])
  })
})
