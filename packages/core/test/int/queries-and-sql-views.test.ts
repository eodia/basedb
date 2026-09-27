import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * SQL for everyone, saved queries and SQL views — chapter 11 §1.7 and §1.8.
 *
 * Through the kernel's public interface, as an adapter sees it. What is checked is that
 * SQL never reads past the decider: a reader's statement sees their tables and fields and
 * nothing else, a shared query shares its text and not its author's reach, and a view is
 * read with the reader's rights.
 */

const TENANT = 't4z56fq'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let adminSession: string
let rh: { baseId: string; schemaName: string }
let employes: string
let salaire: string
let lecteurs: string
let paie: string
let alice: string
let bob: string

const ctxOf = (userId: string) =>
  kernel.openContext({ userId, requestId: randomUUID(), surface: 'rest' })

async function failure(promise: Promise<unknown>): Promise<{ code: string; details: never }> {
  try {
    await promise
  } catch (e) {
    return e as { code: string; details: never }
  }
  throw new Error('no error raised')
}

const codeOf = async (promise: Promise<unknown>) => (await failure(promise)).code

const run = async (userId: string, sql: string) =>
  kernel.runSql(await ctxOf(userId), { baseId: rh.baseId, sql })

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await ctxOf(boot.userId)
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  adminSession = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  rh = await kernel.createBase(admin, { label: 'RH' })
  const t = await kernel.createTable(admin, {
    baseId: rh.baseId,
    label: 'Employés',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Salaire', kind: 'number' },
      { label: 'Poste', kind: 'short_text' },
    ],
  })
  employes = t.tableId
  salaire = t.fields[1].fieldId
  await kernel.createTable(admin, {
    baseId: rh.baseId,
    label: 'Secrets',
    fields: [{ label: 'Code', kind: 'short_text' }],
  })
  for (const [nom, montant, poste] of [
    ['Dupont', '3000', 'Comptable'],
    ['Martin', '4200', 'Directrice'],
  ]) {
    await kernel.createRecord(admin, {
      tableId: employes,
      values: { nom, salaire: montant, poste },
    })
  }

  lecteurs = (await kernel.createGroup(admin, { label: 'Lecteurs', sessionId: adminSession })).id
  paie = (await kernel.createGroup(admin, { label: 'Paie', sessionId: adminSession })).id
  // Lecteurs read the one table, Salaire hidden from them.
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: lecteurs, scope: { kind: 'table', id: employes }, level: 'read' }],
    sessionId: adminSession,
  })
  await kernel.setFieldRule(admin, {
    groupId: lecteurs,
    fieldId: salaire,
    rule: 'hidden',
    sessionId: adminSession,
  })

  alice = (
    await kernel.createUser(admin, {
      email: 'alice@exemple.fr',
      displayName: 'Alice',
      groupIds: [lecteurs],
      sessionId: adminSession,
    })
  ).user.id
  bob = (
    await kernel.createUser(admin, {
      email: 'bob@exemple.fr',
      displayName: 'Bob',
      sessionId: adminSession,
    })
  ).user.id
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('SQL with the reader’s own rights', () => {
  it('reads the readable columns of the readable tables, read only', async () => {
    const result = await run(alice, 'SELECT * FROM employes ORDER BY nom')
    expect(result.mode).toBe('reader')
    const names = result.columns.map((c) => c.name)
    expect(names).toContain('nom')
    expect(names).toContain('poste')
    expect(names).not.toContain('salaire')
    expect(result.rows.map((r) => r.nom)).toEqual(['Dupont', 'Martin'])
  })

  it('refuses a hidden column, even qualified', async () => {
    const unqualified = await failure(run(alice, 'SELECT salaire FROM employes'))
    expect(unqualified.code).toBe('REQUEST_INVALID')
    const qualified = await failure(run(alice, `SELECT salaire FROM "${rh.schemaName}".employes`))
    expect(qualified.code).toBe('REQUEST_INVALID')
    expect((qualified.details as { sqlstate: string }).sqlstate).toBe('42501')
    // Through a function that runs SQL of its own, too: it runs as the reader.
    expect(
      await codeOf(
        run(
          alice,
          `SELECT query_to_xml('SELECT salaire FROM "${rh.schemaName}".employes', true, false, '')`,
        ),
      ),
    ).toBe('REQUEST_INVALID')
  })

  it('does not reach a table it cannot read, another schema, or the catalog', async () => {
    expect(await codeOf(run(alice, 'SELECT * FROM secrets'))).toBe('REQUEST_INVALID')
    expect(await codeOf(run(alice, `SELECT * FROM "${rh.schemaName}".secrets`))).toBe(
      'REQUEST_INVALID',
    )
    expect(await codeOf(run(alice, 'SELECT count(*) FROM _basedb.app_user'))).toBe(
      'REQUEST_INVALID',
    )
  })

  it('writes nothing, and runs one statement', async () => {
    expect(await codeOf(run(alice, "UPDATE employes SET poste = 'X'"))).toBe('REQUEST_INVALID')
    expect(await codeOf(run(alice, 'SELECT 1; DELETE FROM employes'))).toBe('REQUEST_INVALID')
    // A bare COMMIT ends the call's own transaction, nothing more: the next call starts
    // clean, its shadows made again.
    await run(alice, 'COMMIT').catch(() => undefined)
    const again = await run(alice, 'SELECT * FROM employes')
    expect(again.columns.map((c) => c.name)).not.toContain('salaire')
    const after = await run(admin.actor.id, 'SELECT count(*)::int AS n FROM employes')
    expect(after.rows[0]?.n).toBe(2)
  })

  it('follows the rights as they change', async () => {
    await kernel.setFieldRule(admin, {
      groupId: lecteurs,
      fieldId: salaire,
      rule: null,
      sessionId: adminSession,
    })
    const open = await run(alice, 'SELECT salaire FROM employes ORDER BY nom')
    expect(open.rows.map((r) => Number(r.salaire))).toEqual([3000, 4200])
    await kernel.setFieldRule(admin, {
      groupId: lecteurs,
      fieldId: salaire,
      rule: 'hidden',
      sessionId: adminSession,
    })
    expect(await codeOf(run(alice, 'SELECT salaire FROM employes'))).toBe('REQUEST_INVALID')
  })

  it('gives the console to whoever manages the base through its project', async () => {
    const nina = (
      await kernel.createUser(admin, {
        email: 'nina@exemple.fr',
        displayName: 'Nina',
        sessionId: adminSession,
      })
    ).user.id
    const asNina = await ctxOf(nina)
    // Whoever creates a project manages it — and every base in it (05 §15.1).
    const own = await kernel.createProject(asNina, { label: 'À moi' })
    const perso = await kernel.createBase(asNina, { label: 'Perso', projectId: own.id })
    await kernel.createTable(asNina, {
      baseId: perso.baseId,
      label: 'Notes',
      fields: [{ label: 'Texte', kind: 'short_text' }],
    })
    const wrote = await kernel.runSql(asNina, {
      baseId: perso.baseId,
      sql: "INSERT INTO notes (texte) VALUES ('à garder') RETURNING texte",
    })
    expect(wrote.mode).toBe('console')
    expect(wrote.rows[0]?.texte).toBe('à garder')
  })

  it('gives whoever manages the base the console, and a stranger nothing', async () => {
    const console = await run(admin.actor.id, 'SELECT salaire FROM employes')
    expect(console.mode).toBe('console')
    expect(await codeOf(run(bob, 'SELECT 1'))).toBe('RESOURCE_NOT_FOUND')
  })
})

describe('saved queries', () => {
  it('keeps a personal query to its author', async () => {
    const asAlice = await ctxOf(alice)
    const mine = await kernel.createQuery(asAlice, {
      baseId: rh.baseId,
      input: { label: 'Mes relances', statement: 'SELECT nom FROM employes' },
    })
    expect(mine).toMatchObject({ audience: 'personal', mine: true, editable: true })
    expect((await kernel.listQueries(asAlice, { baseId: rh.baseId })).map((q) => q.label)).toEqual([
      'Mes relances',
    ])
    expect(await kernel.listQueries(admin, { baseId: rh.baseId })).toEqual([])
    // Sharing is building the base.
    expect(
      await codeOf(
        kernel.updateQuery(asAlice, {
          baseId: rh.baseId,
          queryId: mine.id,
          input: { audience: 'base' },
        }),
      ),
    ).toBe('ADMIN_REQUIRED')
    expect(
      await codeOf(
        kernel.createQuery(asAlice, {
          baseId: rh.baseId,
          input: { label: 'Pour tous', statement: 'SELECT 1', audience: 'base' },
        }),
      ),
    ).toBe('ADMIN_REQUIRED')
    await kernel.deleteQuery(asAlice, { baseId: rh.baseId, queryId: mine.id })
  })

  it('shares a query with the base, or with groups — its text, not its reach', async () => {
    const shared = await kernel.createQuery(admin, {
      baseId: rh.baseId,
      input: {
        label: 'Masse salariale',
        statement: 'SELECT sum(salaire) FROM employes',
        audience: 'base',
      },
    })
    const forPaie = await kernel.createQuery(admin, {
      baseId: rh.baseId,
      input: { label: 'Paie du mois', statement: 'SELECT 1', audience: 'groups', groupIds: [paie] },
    })
    const forLecteurs = await kernel.createQuery(admin, {
      baseId: rh.baseId,
      input: {
        label: 'Annuaire',
        statement: 'SELECT nom, poste FROM employes',
        audience: 'groups',
        groupIds: [lecteurs],
      },
    })
    expect(forLecteurs.groups).toEqual([{ id: lecteurs, label: 'Lecteurs' }])

    const asAlice = await ctxOf(alice)
    const seen = await kernel.listQueries(asAlice, { baseId: rh.baseId })
    expect(seen.map((q) => q.id).sort()).toEqual([shared.id, forLecteurs.id].sort())
    expect(seen.every((q) => !q.editable)).toBe(true)
    expect(await codeOf(kernel.getQuery(asAlice, { baseId: rh.baseId, queryId: forPaie.id }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    expect(
      await codeOf(kernel.deleteQuery(asAlice, { baseId: rh.baseId, queryId: shared.id })),
    ).toBe('ADMIN_REQUIRED')

    // Its statement, run by Alice, reads what Alice reads.
    expect(await codeOf(run(alice, shared.statement))).toBe('REQUEST_INVALID')

    // The navigation lists them under the base.
    const projects = await kernel.listProjects(asAlice)
    const base = projects.flatMap((p) => p.bases).find((b) => b.id === rh.baseId)
    expect(base?.queries.map((q) => q.label).sort()).toEqual(['Annuaire', 'Masse salariale'])

    expect(await codeOf(kernel.listQueries(await ctxOf(bob), { baseId: rh.baseId }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    expect(
      await codeOf(
        kernel.createQuery(admin, {
          baseId: rh.baseId,
          input: { label: 'annuaire', statement: 'SELECT 2', audience: 'base' },
        }),
      ),
    ).toBe('LABEL_DUPLICATE')
  })
})

const sql = (text: string) => ({ kind: 'sql' as const, sql: text })

describe('questions of one’s own', () => {
  it('keeps a personal question to its author', async () => {
    const asAlice = await ctxOf(alice)
    const mine = await kernel.createQuestion(asAlice, {
      baseId: rh.baseId,
      input: { label: 'Mes relances', query: sql('SELECT nom FROM employes') },
    })
    expect(mine).toMatchObject({ audience: 'personal', mine: true, editable: true, kind: 'sql' })
    expect(
      (await kernel.listQuestions(asAlice, { baseId: rh.baseId })).map((q) => q.label),
    ).toEqual(['Mes relances'])
    expect(await kernel.listQuestions(admin, { baseId: rh.baseId })).toEqual([])
    // Sharing is building the base.
    expect(
      await codeOf(
        kernel.updateQuestion(asAlice, {
          baseId: rh.baseId,
          id: mine.id,
          input: { audience: 'base' },
        }),
      ),
    ).toBe('ADMIN_REQUIRED')
    expect(
      await codeOf(
        kernel.createQuestion(asAlice, {
          baseId: rh.baseId,
          input: { label: 'Pour tous', query: sql('SELECT 1'), audience: 'base' },
        }),
      ),
    ).toBe('ADMIN_REQUIRED')
    await kernel.deleteQuestion(asAlice, { baseId: rh.baseId, id: mine.id })
    expect(await kernel.listQuestions(asAlice, { baseId: rh.baseId })).toEqual([])
  })

  it('shares a question with the base, or with groups — the question, not its reach', async () => {
    const shared = await kernel.createQuestion(admin, {
      baseId: rh.baseId,
      input: {
        label: 'Masse salariale',
        query: sql('SELECT sum(salaire) FROM employes'),
        audience: 'base',
      },
    })
    const forPaie = await kernel.createQuestion(admin, {
      baseId: rh.baseId,
      input: {
        label: 'Paie du mois',
        query: sql('SELECT 1'),
        audience: 'groups',
        groupIds: [paie],
      },
    })
    const forLecteurs = await kernel.createQuestion(admin, {
      baseId: rh.baseId,
      input: {
        label: 'Annuaire',
        query: sql('SELECT nom, poste FROM employes'),
        audience: 'groups',
        groupIds: [lecteurs],
      },
    })
    expect(forLecteurs.groups).toEqual([{ id: lecteurs, label: 'Lecteurs' }])

    const asAlice = await ctxOf(alice)
    const seen = await kernel.listQuestions(asAlice, { baseId: rh.baseId })
    expect(seen.map((q) => q.id).sort()).toEqual([shared.id, forLecteurs.id].sort())
    expect(seen.every((q) => !q.editable)).toBe(true)
    expect(await codeOf(kernel.getQuestion(asAlice, { baseId: rh.baseId, id: forPaie.id }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    expect(await codeOf(kernel.deleteQuestion(asAlice, { baseId: rh.baseId, id: shared.id }))).toBe(
      'ADMIN_REQUIRED',
    )

    // Run by Alice, it reads what Alice reads.
    expect(
      await codeOf(kernel.runQuestion(asAlice, { baseId: rh.baseId, question: shared.id })),
    ).toBe('REQUEST_INVALID')

    // The navigation lists the saved queries, not the questions: those are the dashboards'.
    const projects = await kernel.listProjects(asAlice)
    const base = projects.flatMap((p) => p.bases).find((b) => b.id === rh.baseId)
    const listed = base?.queries.map((q) => q.id) ?? []
    expect(listed).not.toContain(shared.id)
    expect(listed).not.toContain(forLecteurs.id)

    expect(await codeOf(kernel.listQuestions(await ctxOf(bob), { baseId: rh.baseId }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })

  it('goes on a dashboard when the whole base sees it, and keeps the base while there', async () => {
    const all = (await kernel.listQuestions(admin, { baseId: rh.baseId })).filter(
      (q) => q.label === 'Masse salariale' || q.label === 'Annuaire',
    )
    const shared = all.find((q) => q.audience === 'base')
    const grouped = all.find((q) => q.audience === 'groups')
    const card = (question: string | undefined) => ({
      id: 'c1',
      x: 0,
      y: 0,
      w: 12,
      h: 6,
      kind: 'question',
      question,
    })
    const refused = await failure(
      kernel.createDashboard(admin, {
        baseId: rh.baseId,
        input: { label: 'Paie', cards: [card(grouped?.id)] },
      }),
    )
    expect(refused.code).toBe('REQUEST_INVALID')
    await kernel.createDashboard(admin, {
      baseId: rh.baseId,
      input: { label: 'Paie', cards: [card(shared?.id)] },
    })
    const kept = await failure(
      kernel.updateQuestion(admin, {
        baseId: rh.baseId,
        id: shared?.id ?? '',
        input: { audience: 'personal' },
      }),
    )
    expect(kept).toMatchObject({
      code: 'REQUEST_INVALID',
      details: { field: 'audience', reason: 'dans_un_tableau_de_bord', detail: ['Paie'] },
    })
  })
})

describe('SQL views', () => {
  it('creates a real view, read with the reader’s rights', async () => {
    const annuaire = await kernel.createSqlView(admin, {
      baseId: rh.baseId,
      input: {
        label: 'Annuaire des postes',
        definition: 'SELECT nom, poste FROM employes ORDER BY nom;',
        look: { color: '#3366ff', icon: 'users' },
      },
    })
    expect(annuaire).toMatchObject({ name: 'annuaire_des_postes', color: '#3366ff', broken: null })
    const masse = await kernel.createSqlView(admin, {
      baseId: rh.baseId,
      input: { label: 'Masse', definition: 'SELECT sum(salaire) AS total FROM employes' },
    })

    const asAlice = await ctxOf(alice)
    const listed = await kernel.listSqlViews(asAlice, { baseId: rh.baseId })
    expect(listed.map((v) => v.label)).toEqual(['Annuaire des postes'])
    const rows = await kernel.readSqlView(asAlice, { baseId: rh.baseId, viewId: annuaire.id })
    expect(rows.rows.map((r) => r.nom)).toEqual(['Dupont', 'Martin'])
    expect(await codeOf(kernel.readSqlView(asAlice, { baseId: rh.baseId, viewId: masse.id }))).toBe(
      'RESOURCE_NOT_FOUND',
    )
    // Named in a statement, it answers with Alice's grants — not its author's.
    expect(await codeOf(run(alice, 'SELECT * FROM masse'))).toBe('REQUEST_INVALID')
    const total = await kernel.readSqlView(admin, { baseId: rh.baseId, viewId: masse.id })
    expect(Number(total.rows[0]?.total)).toBe(7200)

    const projects = await kernel.listProjects(asAlice)
    const base = projects.flatMap((p) => p.bases).find((b) => b.id === rh.baseId)
    expect(base?.sqlViews.map((v) => v.label)).toEqual(['Annuaire des postes'])
    expect(
      await codeOf(
        kernel.createSqlView(asAlice, {
          baseId: rh.baseId,
          input: { label: 'À moi', definition: 'SELECT 1' },
        }),
      ),
    ).toBe('ADMIN_REQUIRED')
  })

  it('runs its text as ONE statement, and reads this base only', async () => {
    const injected = await failure(
      kernel.createSqlView(admin, {
        baseId: rh.baseId,
        input: { label: 'Piège', definition: `SELECT 1; DROP TABLE "${rh.schemaName}".secrets` },
      }),
    )
    expect(injected.code).toBe('REQUEST_INVALID')
    const still = await run(admin.actor.id, 'SELECT count(*)::int AS n FROM secrets')
    expect(still.rows[0]?.n).toBe(0)

    const outside = await failure(
      kernel.createSqlView(admin, {
        baseId: rh.baseId,
        input: { label: 'Comptes', definition: 'SELECT email FROM _basedb.app_user' },
      }),
    )
    expect(outside.code).toBe('REQUEST_INVALID')
    expect(outside.details).toMatchObject({ reason: 'hors_base' })

    expect(
      await codeOf(
        kernel.createSqlView(admin, {
          baseId: rh.baseId,
          input: { label: 'Employés', definition: 'SELECT 1' },
        }),
      ),
    ).toBe('LABEL_DUPLICATE')
  })

  it('is replaced, refused deletion while read, and survives a formula made again', async () => {
    const postes = await kernel.createSqlView(admin, {
      baseId: rh.baseId,
      input: { label: 'Postes', definition: 'SELECT poste FROM employes' },
    })
    const surPostes = await kernel.createSqlView(admin, {
      baseId: rh.baseId,
      input: { label: 'Sur les postes', definition: 'SELECT count(*) AS n FROM postes' },
    })
    // A column added at the end: replaced in place, even while another view reads it.
    await kernel.updateSqlView(admin, {
      baseId: rh.baseId,
      viewId: postes.id,
      input: { definition: 'SELECT poste, nom FROM employes' },
    })
    // Another view reads it: PostgreSQL will not drop it from under that one.
    expect(
      await codeOf(kernel.deleteSqlView(admin, { baseId: rh.baseId, viewId: postes.id })),
    ).toBe('DEPENDENT_OBJECT')
    await kernel.deleteSqlView(admin, { baseId: rh.baseId, viewId: surPostes.id })
    // A column taken away: made again rather than replaced.
    const again = await kernel.updateSqlView(admin, {
      baseId: rh.baseId,
      viewId: postes.id,
      input: { definition: 'SELECT nom FROM employes', label: 'Postes et noms' },
    })
    expect(again.label).toBe('Postes et noms')

    await kernel.addField(admin, {
      tableId: employes,
      label: 'Double',
      kind: 'formula',
      formula: { expression: '[Salaire] * 2' },
    })
    const doubles = await kernel.createSqlView(admin, {
      baseId: rh.baseId,
      input: { label: 'Doubles', definition: 'SELECT nom, double FROM employes' },
    })
    await kernel.setFormula(admin, {
      tableId: employes,
      field: 'double',
      formula: { expression: '[Salaire] * 3' },
    })
    const read = await kernel.readSqlView(admin, { baseId: rh.baseId, viewId: doubles.id })
    expect(read.rows.map((r) => Number(r.double)).sort((a, b) => a - b)).toEqual([9000, 12600])
    expect((await kernel.getSqlView(admin, { baseId: rh.baseId, viewId: doubles.id })).broken).toBe(
      null,
    )
  })

  it('is a view in PostgreSQL, security_invoker', async () => {
    const client = new pg.Client({ connectionString: container.getConnectionUri() })
    await client.connect()
    try {
      const { rows } = await client.query<{ options: string[] | null }>(
        `SELECT c.reloptions AS options FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = 'annuaire_des_postes' AND c.relkind = 'v'`,
        [rh.schemaName],
      )
      expect(rows[0]?.options).toContain('security_invoker=true')
    } finally {
      await client.end()
    }
  })
})
