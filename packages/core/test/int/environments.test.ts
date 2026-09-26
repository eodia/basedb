import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * The environments of a base, and the structure history they are compared by —
 * chapter 14 and chapter 07 §8.1.
 *
 * Through the kernel's public interface, as the API calls it: a base of production is
 * given a recette, the recette is changed, the change is carried back, and rows go from
 * one to the other — with the history saying, all along, who changed what.
 */

const TENANT = 't4z56fq'
const PASSWORD = 'mot-de-passe-de-test'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let crm: { baseId: string; schemaName: string }
let clients: string
let factures: string
let statut: string
let site: string
let recette: string

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  throw new Error('no error raised')
}

/** A table of an environment, by its label. */
async function tableIn(baseId: string, label: string): Promise<string> {
  const projects = await kernel.listProjects(admin)
  const base = projects.flatMap((p) => p.bases).find((b) => b.id === baseId)
  const table = base?.tables.find((t) => t.label === label)
  if (table === undefined) throw new Error(`no table ${label} in ${baseId}`)
  return table.id
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  kernel = startKernel({
    connectionString: container.getConnectionUri(),
    encryptionKey: 'cle-instance-de-test-0123456789',
  })
  await kernel.migrateCatalog()
  const boot = await kernel.bootstrap({ tenantRef: TENANT, email: 'admin@basedb.local' })
  await kernel.setPassword({ userId: boot.userId, password: PASSWORD })
  admin = await kernel.openContext({
    userId: boot.userId,
    requestId: randomUUID(),
    surface: 'rest',
  })

  crm = await kernel.createBase(admin, { label: 'CRM' })
  const created = await kernel.createTable(admin, {
    baseId: crm.baseId,
    label: 'Clients',
    fields: [
      { label: 'Nom', kind: 'short_text', required: true },
      { label: 'Site', kind: 'url' },
      { label: 'Notes', kind: 'long_text' },
    ],
  })
  clients = created.tableId
  site = created.fields.find((f) => f.label === 'Site')?.fieldId as string
  statut = (
    await kernel.addField(admin, {
      tableId: clients,
      label: 'Statut',
      kind: 'select',
      options: [
        { value: 'prospect', label: 'Prospect' },
        { value: 'client', label: 'Client' },
      ],
    })
  ).fieldId
  factures = (
    await kernel.createTable(admin, {
      baseId: crm.baseId,
      label: 'Factures',
      fields: [
        { label: 'Numéro', kind: 'short_text' },
        { label: 'Montant', kind: 'number' },
      ],
    })
  ).tableId
  await kernel.createLinkField(admin, {
    tableId: factures,
    targetTableId: clients,
    label: 'Client',
  })
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('the structure history', () => {
  it('records every act on the structure, with its author, and says it in words', async () => {
    await kernel.setFieldLabel(admin, { fieldId: statut, label: 'Étape' })
    await kernel.setFieldLabel(admin, { fieldId: statut, label: 'Statut' })

    const page = await kernel.structureHistory(admin, { baseId: crm.baseId, limit: 200 })
    const summaries = page.events.map((e) => e.summary)
    expect(summaries).toContain('Table « Clients » créée')
    expect(summaries).toContain('Champ « Statut » ajouté (liste de choix)')
    expect(summaries).toContain('Champ « Client » ajouté (relation)')
    expect(summaries).toContain('Choix « Prospect » ajouté à « Statut »')

    const renamed = page.events.find(
      (e) => e.object === 'field' && e.changes.some((c) => c.to === 'Étape'),
    )
    expect(renamed?.changes).toEqual([{ attribute: 'Libellé', from: 'Statut', to: 'Étape' }])
    expect(renamed?.actor.kind).toBe('user')
    // Most recent first.
    expect(page.events[0]?.changes[0]?.to).toBe('Statut')
  })
})

describe('the environments of a base', () => {
  it('creates a recette as a copy of the structure of production', async () => {
    const { environment, report } = await kernel.createEnvironment(admin, {
      baseId: crm.baseId,
      environment: 'Recette',
    })
    recette = environment.id
    expect(environment).toMatchObject({ environment: 'Recette', production: false })
    expect(report.failed).toBe(0)
    expect(report.results.every((r) => r.outcome === 'applied')).toBe(true)

    // Same base, twice: one label, two environments, two schemas.
    const family = await kernel.listEnvironments(admin, { baseId: recette })
    expect(family.label).toBe('CRM')
    expect(family.environments.map((e) => [e.environment, e.production])).toEqual([
      ['Production', true],
      ['Recette', false],
    ])
    expect(environment.name).not.toBe(crm.schemaName)

    // Nothing differs: the same tables and fields, matched by lineage, in the same order.
    const comparison = await kernel.compareEnvironments(admin, { baseId: crm.baseId })
    expect(comparison.tables.map((t) => [t.cells[0]?.label, t.differs])).toEqual([
      ['Clients', false],
      ['Factures', false],
    ])
    const clientsRow = comparison.tables[0]
    expect(clientsRow?.fields.map((f) => f.cells[1]?.label)).toEqual([
      'Nom',
      'Site',
      'Notes',
      'Statut',
    ])
    expect(
      clientsRow?.fields.find((f) => f.cells[0]?.label === 'Statut')?.cells[1]?.options,
    ).toEqual(['Prospect', 'Client'])
    const link = comparison.tables[1]?.fields.find((f) => f.cells[0]?.label === 'Client')
    expect(link?.cells[1]?.link).toBe('Clients')

    // The navigation shows the environments of one base, production first.
    const bases = (await kernel.listProjects(admin)).flatMap((p) => p.bases)
    const lineage = bases.find((b) => b.id === crm.baseId)?.environment.lineage
    expect(
      bases.filter((b) => b.environment.lineage === lineage).map((b) => b.environment.label),
    ).toEqual(['Production', 'Recette'])
  })

  it('refuses a second environment of the same name, and renames one', async () => {
    expect(
      await codeOf(kernel.createEnvironment(admin, { baseId: crm.baseId, environment: 'recette' })),
    ).toBe('LABEL_DUPLICATE')
    const renamed = await kernel.renameEnvironment(admin, {
      baseId: recette,
      environment: 'Qualif',
    })
    expect(renamed.environment).toBe('Qualif')
    await kernel.renameEnvironment(admin, { baseId: recette, environment: 'Recette' })
  })

  it('carries a change of recette back to production, step by step', async () => {
    const clientsRecette = await tableIn(recette, 'Clients')
    await kernel.addField(admin, {
      tableId: clientsRecette,
      label: 'Priorité',
      kind: 'select',
      options: [{ value: 'haute', label: 'Haute' }],
    })
    const facturesRecette = await tableIn(recette, 'Factures')
    await kernel.updateTable(admin, { tableId: facturesRecette, label: 'Factures émises' })

    const plan = await kernel.planStructure(admin, {
      sourceBaseId: recette,
      targetBaseId: crm.baseId,
    })
    const kinds = plan.steps.map((s) => [s.kind, s.status, s.selected])
    expect(kinds).toEqual([
      ['add_field', 'ready', true],
      ['update_table', 'ready', true],
    ])
    expect(plan.steps[1]?.changes).toEqual([
      { attribute: 'Libellé', from: 'Factures', to: 'Factures émises' },
    ])

    const report = await kernel.applyStructure(admin, {
      sourceBaseId: recette,
      targetBaseId: crm.baseId,
      steps: plan.steps.map((s) => s.id),
    })
    expect(report.applied).toBe(2)
    const after = await kernel.compareEnvironments(admin, { baseId: crm.baseId })
    expect(after.tables.every((t) => !t.differs)).toBe(true)
  })

  it('does not select a step that would undo a newer change of the target', async () => {
    // Production renames « Site » after recette last touched it.
    await kernel.setFieldLabel(admin, { fieldId: site, label: 'Site web' })
    const plan = await kernel.planStructure(admin, {
      sourceBaseId: recette,
      targetBaseId: crm.baseId,
    })
    const rename = plan.steps.find((s) => s.kind === 'update_field')
    expect(rename).toMatchObject({ status: 'target_newer', selected: false })

    // Seen from production, the same difference is production's to carry.
    const back = await kernel.planStructure(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
    })
    expect(back.steps.find((s) => s.kind === 'update_field')).toMatchObject({
      status: 'ready',
      selected: true,
    })
    // A step id that no longer exists is reported, not guessed at.
    const report = await kernel.applyStructure(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
      steps: [...back.steps.map((s) => s.id), 'update_field:00000000-0000-0000-0000-000000000000'],
    })
    expect(report.results.map((r) => r.outcome)).toEqual(['applied', 'skipped'])
  })

  it('refuses to compare a base with one that is not an environment of it', async () => {
    const other = await kernel.createBase(admin, { label: 'Autre' })
    expect(
      await codeOf(
        kernel.planStructure(admin, { sourceBaseId: crm.baseId, targetBaseId: other.baseId }),
      ),
    ).toBe('ENVIRONMENT_MISMATCH')
  })
})

describe('synchronizing rows between environments', () => {
  let clientLineage: string
  let factureLineage: string
  let dupont: string

  beforeAll(async () => {
    const comparison = await kernel.compareEnvironments(admin, { baseId: crm.baseId })
    clientLineage = comparison.tables[0]?.lineage as string
    factureLineage = comparison.tables[1]?.lineage as string

    dupont = (
      await kernel.createRecord(admin, {
        tableId: clients,
        values: { nom: 'Dupont', site: 'dupont.fr', statut: 'client' },
      })
    ).row._id as string
    await kernel.createRecord(admin, { tableId: clients, values: { nom: 'Martin' } })
    await kernel.createRecord(admin, {
      tableId: factures,
      values: { numero: 'F-1', montant: '120.50', clients_id: dupont },
    })
  })

  it('counts and compares, by _id', async () => {
    const counts = await kernel.countRows(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
    })
    expect(counts.find((c) => c.lineage === clientLineage)).toMatchObject({ source: 2, target: 0 })

    const comparison = await kernel.compareRows(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
      tableLineage: clientLineage,
    })
    expect(comparison.counts).toEqual({ onlySource: 2, onlyTarget: 0, different: 0, identical: 0 })
    expect(comparison.samples.onlySource.map((r) => r.display).sort()).toEqual(['Dupont', 'Martin'])
    expect(comparison.columns.map((c) => c.label)).toContain('Statut')
  })

  it('refuses a relation to a row the target does not have yet, then copies in order', async () => {
    expect(
      await codeOf(
        kernel.syncRows(admin, {
          sourceBaseId: crm.baseId,
          targetBaseId: recette,
          tableLineage: factureLineage,
          insert: true,
          update: false,
          delete: false,
        }),
      ),
    ).toBe('SYNC_REFERENCE_MISSING')

    const first = await kernel.syncRows(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
      tableLineage: clientLineage,
      insert: true,
      update: true,
      delete: false,
    })
    expect(first).toEqual({ inserted: 2, updated: 0, deleted: 0 })
    const second = await kernel.syncRows(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
      tableLineage: factureLineage,
      insert: true,
      update: true,
      delete: false,
    })
    expect(second.inserted).toBe(1)

    // The row keeps its _id: the invoice of recette points at recette's Dupont.
    const clientsRecette = await tableIn(recette, 'Clients')
    const copied = await kernel.listRecords(admin, { tableId: clientsRecette, sort: 'nom' })
    expect(copied.rows.map((r) => [r._id, r.nom])).toContainEqual([dupont, 'Dupont'])
  })

  it('overwrites what differs, and deletes what the source lacks only when asked', async () => {
    const clientsRecette = await tableIn(recette, 'Clients')
    await kernel.updateRecord(admin, {
      tableId: clientsRecette,
      recordId: dupont,
      values: { nom: 'Dupont & fils' },
    })
    await kernel.createRecord(admin, { tableId: clientsRecette, values: { nom: 'Essai' } })

    const comparison = await kernel.compareRows(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
      tableLineage: clientLineage,
    })
    expect(comparison.counts).toMatchObject({ onlyTarget: 1, different: 1, identical: 1 })
    expect(comparison.samples.different[0]?.changed).toEqual(['Nom'])

    const synced = await kernel.syncRows(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
      tableLineage: clientLineage,
      insert: true,
      update: true,
      delete: true,
    })
    expect(synced).toEqual({ inserted: 0, updated: 1, deleted: 1 })
    const again = await kernel.compareRows(admin, {
      sourceBaseId: crm.baseId,
      targetBaseId: recette,
      tableLineage: clientLineage,
    })
    expect(again.counts).toEqual({ onlySource: 0, onlyTarget: 0, different: 0, identical: 2 })
    expect(again.lastSync).not.toBeNull()
  })
})

describe('the base and its environments, as one', () => {
  it('renames every environment with the base', async () => {
    await kernel.updateBase(admin, { baseId: recette, label: 'Relation client' })
    const family = await kernel.listEnvironments(admin, { baseId: crm.baseId })
    expect(family.label).toBe('Relation client')
    const bases = (await kernel.listProjects(admin)).flatMap((p) => p.bases)
    expect(bases.filter((b) => b.label === 'Relation client')).toHaveLength(2)
  })

  it('never deletes production alone, and deletes another environment', async () => {
    expect(await codeOf(kernel.deleteEnvironment(admin, { baseId: crm.baseId }))).toBe(
      'ENVIRONMENT_IS_PRODUCTION',
    )
    const migration = await kernel.deleteEnvironment(admin, { baseId: recette })
    expect(migration.status).toBe('applied')
    const family = await kernel.listEnvironments(admin, { baseId: crm.baseId })
    expect(family.environments.map((e) => e.environment)).toEqual(['Production'])
  })
})
