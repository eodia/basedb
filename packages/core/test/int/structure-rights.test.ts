import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Kernel, startKernel } from '../../src/index.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * « Édition » writes rows, it never builds — chapter 05 §15.
 *
 * The level bundles `read, create, update, delete` and nothing else: every operation of
 * the « Structure » screen demands `manage_schema`, and a group granted « Édition » on a
 * base must be refused each of them, one by one, through the kernel an adapter calls.
 */

const TENANT = 't8st5ru'
const PASSWORD = 'mot de passe du tenant solide'

let container: StartedPostgreSqlContainer
let kernel: Kernel
let admin: RequestContext
let editor: RequestContext
let projectId: string
let baseId: string
let clients: { tableId: string; nom: string; statut: string }
let factures: string

const ctxOf = (userId: string) =>
  kernel.openContext({ userId, requestId: randomUUID(), surface: 'ui' })

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (e) {
    return (e as { code: string }).code
  }
  return 'NO_ERROR'
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
  admin = await ctxOf(boot.userId)
  const login = await kernel.login({ email: 'admin@basedb.local', password: PASSWORD })
  const sessionId = (await kernel.elevate(login.sessionToken, PASSWORD)).session.sessionId

  projectId = (await kernel.createProject(admin, { label: 'Atelier' })).id
  baseId = (await kernel.createBase(admin, { label: 'Démo', projectId })).baseId
  const created = await kernel.createTable(admin, {
    baseId,
    label: 'Clients',
    fields: [{ label: 'Nom', kind: 'short_text' }],
  })
  const statut = await kernel.addField(admin, {
    tableId: created.tableId,
    label: 'Statut',
    kind: 'select',
    options: [{ value: 'actif' }, { value: 'inactif' }],
  })
  clients = {
    tableId: created.tableId,
    nom: created.fields[0]?.fieldId as string,
    statut: statut.fieldId,
  }
  factures = (
    await kernel.createTable(admin, {
      baseId,
      label: 'Factures',
      fields: [{ label: 'Numéro', kind: 'short_text' }],
    })
  ).tableId

  // The reported case: a group granted « Édition » on the base, and one of its members.
  const saisie = await kernel.createGroup(admin, { label: 'Saisie', sessionId })
  const user = await kernel.createUser(admin, {
    email: 'carole@exemple.fr',
    displayName: 'Carole',
    groupIds: [saisie.id],
    sessionId,
  })
  await kernel.applyAccessChanges(admin, {
    changes: [{ groupId: saisie.id, scope: { kind: 'base', id: baseId }, level: 'edit' }],
    sessionId,
  })
  editor = await ctxOf(user.user.id)
}, 240_000)

afterAll(async () => {
  await kernel?.close()
  await container?.stop()
})

describe('« Édition » on a base', () => {
  it('writes rows', async () => {
    await expect(
      kernel.createRecord(editor, { tableId: clients.tableId, values: { nom: 'Lumen' } }),
    ).resolves.toBeDefined()
  })

  it('is told, by the projection, that it does not build', async () => {
    const project = (await kernel.listProjects(editor)).find((p) => p.id === projectId)
    const base = project?.bases.find((b) => b.id === baseId)
    expect(base?.actions).toEqual(expect.arrayContaining(['read', 'create', 'update', 'delete']))
    expect(base?.actions).not.toContain('manage_schema')
    expect(base?.tables.length).toBe(2)
    for (const table of base?.tables ?? []) expect(table.actions).not.toContain('manage_schema')
  })

  it.each([
    ['createTable', () => kernel.createTable(editor, { baseId, label: 'Nouvelle', fields: [] })],
    ['createBase', () => kernel.createBase(editor, { label: 'Autre', projectId })],
    ['updateBase', () => kernel.updateBase(editor, { baseId, label: 'Renommée' })],
    ['updateTable', () => kernel.updateTable(editor, { tableId: clients.tableId, label: 'Gens' })],
    [
      'setTableDescription',
      () => kernel.setTableDescription(editor, { tableId: clients.tableId, description: 'x' }),
    ],
    ['deleteTable', () => kernel.deleteTable(editor, { tableId: factures })],
    [
      'addField',
      () =>
        kernel.addField(editor, { tableId: clients.tableId, label: 'Ville', kind: 'short_text' }),
    ],
    [
      'createLinkField',
      () =>
        kernel.createLinkField(editor, {
          tableId: factures,
          targetTableId: clients.tableId,
          label: 'Client',
        }),
    ],
    [
      'setFieldLabel',
      () => kernel.setFieldLabel(editor, { fieldId: clients.nom, label: 'Nom complet' }),
    ],
    [
      'setFieldDescription',
      () => kernel.setFieldDescription(editor, { fieldId: clients.nom, description: 'x' }),
    ],
    [
      'setFieldFormat',
      () =>
        kernel.setFieldFormat(editor, {
          fieldId: clients.nom,
          format: { display: 'url' } as never,
        }),
    ],
    [
      'setFieldRequired',
      () => kernel.setFieldRequired(editor, { fieldId: clients.nom, required: true }),
    ],
    [
      'setSelectOptions',
      () =>
        kernel.setSelectOptions(editor, {
          fieldId: clients.statut,
          options: [{ value: 'actif' }, { value: 'inactif' }, { value: 'archivé' }],
        }),
    ],
    [
      'reorderFields',
      () => kernel.reorderFields(editor, { tableId: clients.tableId, names: ['statut', 'nom'] }),
    ],
    [
      'setDisplayColumn',
      () => kernel.setDisplayColumn(editor, { tableId: clients.tableId, fieldId: clients.nom }),
    ],
    [
      'setFormula',
      () =>
        kernel.setFormula(editor, {
          tableId: clients.tableId,
          field: 'nom',
          formula: { expression: '1' } as never,
        }),
    ],
    [
      'createView (shared)',
      () =>
        kernel.createView(editor, { tableId: clients.tableId, label: 'Pour tous', kind: 'grid' }),
    ],
  ])('is refused %s', async (_name, attempt) => {
    expect(await codeOf(attempt())).toBe('ADMIN_REQUIRED')
  })

  it('left the structure exactly as the administrator built it', async () => {
    const project = (await kernel.listProjects(admin)).find((p) => p.id === projectId)
    const base = project?.bases.find((b) => b.id === baseId)
    expect(base?.label).toBe('Démo')
    expect(base?.tables.map((t) => t.label)).toEqual(['Clients', 'Factures'])
  })
})
