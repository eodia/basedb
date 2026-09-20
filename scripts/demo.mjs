/**
 * Runnable demonstration of the kernel — the vertical slice, for real.
 *
 *   node scripts/demo.mjs                     # starts a disposable PostgreSQL 16
 *   DATABASE_URL=postgres://… node scripts/demo.mjs
 *
 * Creates a base and a table through KERNEL OPERATIONS, inserts rows into it in direct
 * SQL, then shows what a consumer would see in psql. With neither API nor interface:
 * this is exit criterion no. 8 of phase 2.
 *
 * Requires the compiled packages: corepack pnpm exec tsc -b packages/core
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = new URL('../packages/core/dist/index.js', import.meta.url)
if (!existsSync(fileURLToPath(dist))) {
  console.error('The kernel is not compiled.\nRun: corepack pnpm exec tsc -b packages/core')
  process.exit(1)
}

// Import BY PATH: pnpm isolation (`node-linker=isolated`) prevents a root script from
// resolving a workspace package it does not declare — which is exactly what it should
// do, and the first filter against an undeclared import.
const { catalogMigrations } = await import('../packages/catalog-schema/dist/index.js')
const { createBase, createTable } = await import('../packages/core/dist/catalog/operations.js')
const { listRecords } = await import('../packages/core/dist/records/list.js')
const { Pools } = await import('../packages/core/dist/runtime/pool.js')
const { sealContext } = await import('../packages/core/dist/tx/context.js')

const grey = (s) => `[90m${s}[0m`
const bold = (s) => `[1m${s}[0m`
const green = (s) => `[32m${s}[0m`
const cyan = (s) => `[36m${s}[0m`

const heading = (t) => console.log(`\n${bold(t)}\n${grey('─'.repeat(t.length))}`)

const TENANT_REF = 't4z56fq'

let container = null
let url = process.env.DATABASE_URL

if (!url) {
  heading('Disposable PostgreSQL')
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
  console.log(grey('  starting a postgres:16-alpine container…'))
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  url = container.getConnectionUri()
  console.log(`  ${green('ready')} ${grey(url.replace(/:[^:@]*@/, ':***@'))}`)
} else {
  heading('PostgreSQL supplied')
  console.log(grey(`  ${url.replace(/:[^:@]*@/, ':***@')}`))
}

const pools = new Pools({ connectionString: url })

try {
  heading('Catalog')
  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) {
      await exec.query(m.sql, [], 'ddl')
      console.log(`  ${green('✓')} ${m.name}`)
    }
  })

  const objects = await pools.withConnection('catalog', (exec) =>
    exec.query(
      `SELECT count(*) FILTER (WHERE schemaname = '_basedb')       AS catalog,
              count(*) FILTER (WHERE schemaname = '_basedb_local') AS colocated
         FROM pg_tables WHERE schemaname IN ('_basedb', '_basedb_local')`,
    ),
  )
  console.log(
    grey(`  ${objects[0].catalog} tables in _basedb, ${objects[0].colocated} in _basedb_local`),
  )

  heading('Bootstrap')
  const actor = await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    const [t] = await exec.query(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Demonstration', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
      [TENANT_REF],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.app_user (id, tenant_id, email, display_name, is_system, created_by, updated_by)
       VALUES ($1, $2, 'demo@basedb.local', 'Demonstration', true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t.created_by
  })
  console.log(`  ${green('✓')} tenant ${cyan(TENANT_REF)} and its system user`)

  const now = new Date()
  const ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-0000000000de',
    actor: { kind: 'system', id: actor },
    tenantId: TENANT_REF,
    surface: 'system',
    timestamp: now,
    deadline: new Date(now.getTime() + 120_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  heading('Kernel operations')
  const base = await createBase(pools, ctx, { label: 'CRM' })
  console.log(`  ${green('✓')} base "CRM" → schema ${cyan(base.schemaName)}`)

  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Factures',
    fields: [
      { label: 'Numéro', kind: 'short_text', required: true },
      { label: 'Montant', kind: 'number' },
      { label: 'Payée', kind: 'boolean' },
      { label: "Date d'émission", kind: 'date' },
    ],
  })
  console.log(`  ${green('✓')} table "Factures" → ${cyan(table.qualifiedName)}`)
  for (const f of table.fields) {
    console.log(`      ${grey('"')}${f.label.padEnd(16)}${grey('" →')} ${cyan(f.name)}`)
  }

  heading('Writing in direct SQL, without going through the product')
  const rows = [
    ['F-2026-001', 1234.56, true, '2026-01-15'],
    ['F-2026-002', 890.0, false, '2026-02-03'],
    ['F-2026-003', 15750.4, false, '2026-03-21'],
  ]
  for (const [numero, montant, payee, date] of rows) {
    await pools.withConnection('data', (exec) =>
      exec.query(
        `INSERT INTO ${table.qualifiedName} ("numero", "montant", "payee", "date_d_emission")
         VALUES ($1, $2, $3, $4)`,
        [numero, montant, payee, date],
        'insert',
      ),
    )
  }
  console.log(`  ${green('✓')} ${rows.length} rows inserted`)

  heading('What an SQL consumer sees')
  const query = `SELECT "numero", "montant", "payee", "date_d_emission"\n  FROM ${table.qualifiedName}\n ORDER BY "date_d_emission";`
  console.log(grey(query.replace(/^/gm, '  ')))
  console.log()

  const result = await pools.withConnection('data', (exec) =>
    exec.query(
      `SELECT "numero", "montant"::text AS montant, "payee",
              "date_d_emission"::text AS date_d_emission
         FROM ${table.qualifiedName} ORDER BY "date_d_emission"`,
    ),
  )
  console.table(result)

  heading('Business labels, readable in psql')
  const comments = await pools.withConnection('data', (exec) =>
    exec.query(
      `SELECT a.attname AS column, col_description(a.attrelid, a.attnum) AS label
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0
          AND col_description(a.attrelid, a.attnum) IS NOT NULL
        ORDER BY a.attnum`,
      [base.schemaName, table.tableName],
    ),
  )
  for (const c of comments) {
    console.log(`  ${cyan(c.column.padEnd(18))} ${grey('"')}${c.label}${grey('"')}`)
  }

  heading('Permissions — the same SQL, two actors')
  const [tenantRow] = await pools.withConnection('catalog', (exec) =>
    exec.query('SELECT id FROM _basedb.tenant WHERE ref = $1', [TENANT_REF]),
  )

  async function createActor(name, maskedFieldId) {
    return pools.withConnection('catalog', async (exec) => {
      const [u] = await exec.query(
        `INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4) RETURNING id`,
        [tenantRow.id, `${name}@basedb.local`, name, actor],
        'insert',
      )
      const [r] = await exec.query(
        `INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
         VALUES ($1, $2, $2, $3, $4) RETURNING id`,
        [tenantRow.id, name, name, actor],
        'insert',
      )
      await exec.query(
        'INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1, $2, $3)',
        [r.id, u.id, actor],
        'insert',
      )
      await exec.query(
        `INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
         VALUES ($1, 'base', $2, 'read', $3)`,
        [r.id, base.baseId, actor],
        'insert',
      )
      if (maskedFieldId) {
        await exec.query(
          'INSERT INTO _basedb.field_permission (role_id, field_id, access) VALUES ($1, $2, $3)',
          [r.id, maskedFieldId, 'hidden'],
          'insert',
        )
      }
      return u.id
    })
  }

  const contextFor = (userId) =>
    sealContext({
      requestId: '018f3c2a-0000-7000-8000-0000000000df',
      actor: { kind: 'user', id: userId },
      tenantId: TENANT_REF,
      surface: 'rest',
      timestamp: new Date(),
      deadline: new Date(Date.now() + 60_000),
      permissions: { version: '1', rowPredicate: 'TRUE' },
    })

  const accountant = await createActor('comptable', null)
  const frontDesk = await createActor(
    'accueil',
    table.fields.find((f) => f.name === 'montant').fieldId,
  )

  for (const [name, userId] of [
    ['comptable', accountant],
    ['accueil', frontDesk],
  ]) {
    const view = await listRecords(pools, contextFor(userId), { tableId: table.tableId })
    const business = view.columns.filter((c) => !c.startsWith('_'))
    console.log(`  ${cyan(name.padEnd(10))} sees ${green(business.join(', '))}`)
    console.log(grey(`             ${view.sql.split(String.fromCharCode(10))[0]}`))
  }
  console.log(
    grey(
      [
        '',
        '  The masked field is not filtered after the fact: it is never read, hence never',
        '  transported. The column does not even appear in the emitted SQL.',
      ].join(String.fromCharCode(10)),
    ),
  )

  heading('Expected refusals')
  try {
    await pools.withConnection('data', (exec) =>
      exec.query(`INSERT INTO ${table.qualifiedName} ("montant") VALUES (1)`, [], 'insert'),
    )
    console.log('  ✗ the required field should have refused')
  } catch (e) {
    console.log(`  ${green('✓')} required field left empty → ${cyan(e.code)}`)
  }

  try {
    await pools.withConnection('catalog', (exec) => exec.query('SELECT 1 FROM tenant'))
    console.log('  ✗ the unqualified reference should have failed')
  } catch (e) {
    console.log(`  ${green('✓')} unqualified reference (empty search_path) → ${cyan(e.code)}`)
  }

  if (container) {
    heading('To explore for yourself')
    console.log(grey('  The container is stopped at the end of this script. To keep one:'))
    console.log(
      grey(
        '    docker run -d --name basedb -e POSTGRES_PASSWORD=x -p 5432:5432 postgres:16-alpine',
      ),
    )
    console.log(
      grey('    DATABASE_URL=postgres://postgres:x@localhost:5432/postgres node scripts/demo.mjs'),
    )
    console.log(grey('    psql postgres://postgres:x@localhost:5432/postgres'))
  } else {
    heading('To explore for yourself')
    console.log(grey(`  psql "${url.replace(/:[^:@]*@/, ':***@')}"`))
    console.log(grey(`  \\d ${base.schemaName}.${table.tableName}`))
  }

  console.log()
} finally {
  await pools.end()
  if (container) await container.stop()
}
