'use client'

import { ApiDocs } from '@/components/api-reference/api-docs'
import { AdminPanel, type AdminTab } from '@/components/app/admin/admin-panel'
import { NewBaseDialog } from '@/components/app/base-menu'
import { ElevationProvider } from '@/components/app/elevation'
import { EnvironmentBadge } from '@/components/app/environment-badge'
import { HistoryPanel } from '@/components/app/history'
import { NewTableDialog } from '@/components/app/new-table-dialog'
import { PasswordRequired } from '@/components/app/password-required'
import { ProjectDialog } from '@/components/app/project-menu'
import { SchemaEditor } from '@/components/app/schema-editor'
import {
  type BaseIntent,
  type Section,
  Sidebar,
  SidebarToggle,
  type TableIntent,
} from '@/components/app/sidebar'
import { TableDialogs, useTableActions } from '@/components/app/table-actions'
import { Workspace } from '@/components/app/workspace'
import { Login } from '@/components/login'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  type ApiDocumentation,
  type DescribedBase,
  type Me,
  type Project,
  api,
} from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { usePanels } from '@/lib/store/panels'
import { useSidebar } from '@/lib/store/sidebar'
import { hydrateWorkspace, useActiveTab, useWorkspace } from '@/lib/store/workspace'
import { useTheme } from '@/lib/theme'
import { useTitle } from '@/lib/use-title'
import { Database, FolderKanban, Loader2, Plus, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The application — chapter 11, organized by projects (chapter 05 §15).
 *
 * NO MOCKED OR HARD-CODED DATA: projects, bases, tables, columns and rows all come from
 * `/meta/…` and `/data/…`, hence from the catalog and from the reader's own rights. Two
 * people open this screen and see two different applications, and that is the rule
 * rather than an effect.
 *
 * Two notions of "the base" coexist, and keeping them apart is what keeps the screen
 * truthful. The DATA view follows the active tab — tabs may come from several bases, and
 * a grid must be drawn with the fields of the table it shows. The SECTIONS (structure,
 * documentation, history) and the SQL console speak of the CURRENT base: the last one
 * chosen in the sidebar, which activating a tab also makes current.
 *
 * Where the product has no backend yet — history — the control is drawn in its place and
 * DISABLED, with a word saying it is coming. Filling it with plausible data would make
 * the screen lie about what the product does.
 */

/** What each section is called, in the tab strip as on screen. */
const SECTION_TITLES: Readonly<Record<Section, string | undefined>> = {
  data: undefined,
  structure: 'Structure',
  history: 'Historique',
  doc: 'Documentation API et MCP',
  admin: 'Administration',
}

/** Where the project last browsed is remembered — a convenience, never a source of truth. */
const PROJECT_KEY = 'basedb.project.v1'

function rememberedProject(): string | null {
  try {
    return window.localStorage.getItem(PROJECT_KEY)
  } catch {
    return null
  }
}

function rememberProject(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(PROJECT_KEY)
    else window.localStorage.setItem(PROJECT_KEY, id)
  } catch {
    // A private window: the project is simply not remembered.
  }
}

// The demonstration base describes itself on purpose: its descriptions are what the
// generated documentation and the agents read, so they show what a well-described base
// looks like — the purpose, the format, the unit — rather than repeating the label.
const SAMPLE_BASE_DESCRIPTION =
  'Base de démonstration : des clients et les factures qui leur sont adressées. ' +
  'Elle sert à explorer les relations entre tables, la documentation générée et l’API.'

const SAMPLE_CLIENTS_DESCRIPTION =
  'Les entreprises et organisations à qui l’on facture. Une ligne par client, quel que ' +
  'soit le nombre de factures qui lui ont été adressées.'

const SAMPLE_INVOICES_DESCRIPTION =
  'Les factures émises, une ligne par facture. Chaque facture est adressée à un seul client ; ' +
  'un client peut en avoir plusieurs.'

const SAMPLE_FIELDS: ReadonlyArray<{
  label: string
  kind: string
  required?: boolean
  description: string
}> = [
  {
    label: 'Numéro',
    kind: 'short_text',
    required: true,
    description:
      'Référence de la facture telle qu’imprimée sur le document, par exemple F-2026-0042. ' +
      'Elle identifie la facture quand un autre enregistrement y renvoie.',
  },
  {
    label: 'Montant',
    kind: 'number',
    description: 'Montant total de la facture, en euros, taxes comprises.',
  },
  {
    label: 'Payée',
    kind: 'boolean',
    description:
      'Cochée dès que le règlement a été reçu en totalité ; décochée tant que la facture reste due.',
  },
  {
    label: "Date d'émission",
    kind: 'date',
    description: 'Jour où la facture a été émise au client, au format AAAA-MM-JJ.',
  },
]

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(true)
  const [online, setOnline] = useState<boolean | null>(null)

  const [projects, setProjects] = useState<readonly Project[]>([])
  const [loaded, setLoaded] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  /** Every base described so far, by logical name: the tabs may span several. */
  const [described, setDescribed] = useState<Readonly<Record<string, DescribedBase>>>({})
  const [baseName, setBaseName] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('data')
  const [adminTab, setAdminTab] = useState<AdminTab>('users')

  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  /** The base a new table is being named in. */
  const [naming, setNaming] = useState<string | null>(null)
  const [newProject, setNewProject] = useState(false)
  const [newBase, setNewBase] = useState(false)

  const [doc, setDoc] = useState<ApiDocumentation | null>(null)

  const openTable = useWorkspace((s) => s.openTable)
  const openSql = useWorkspace((s) => s.openSql)
  const activate = useWorkspace((s) => s.activate)
  const dropBase = useWorkspace((s) => s.dropBase)
  const dropTable = useWorkspace((s) => s.dropTable)
  const tabs = useWorkspace((s) => s.tabs)
  const activeTab = useActiveTab()
  const { importInto, deleteTable, editTable } = useTableActions()

  const base = baseName === null ? null : (described[baseName] ?? null)
  const project = projects.find((p) => p.id === projectId) ?? null
  const tabBase = activeTab === null ? null : (described[activeTab.base] ?? null)

  // Callbacks read the current base through a ref: one captured in a closure a render ago
  // would refresh the base that WAS current, not the one the person is looking at.
  const baseNameRef = useRef(baseName)
  baseNameRef.current = baseName

  // Declared before the early returns below, because a hook may not be conditional —
  // and because the title of a screen that is still checking the session is simply the
  // product's, which is what the empty segments produce.
  useTitle([
    section === 'data' ? activeTab?.label : SECTION_TITLES[section],
    section === 'admin' ? undefined : (base?.label ?? project?.label),
  ])

  // The theme, the open tabs, the width of the sidebar and of the panels on the right are
  // restored AFTER mount: all live in `localStorage`, which does not exist where Next.js
  // renders this tree first, and seeding them at module scope would make the first client
  // render disagree with the server's.
  useEffect(() => {
    hydrateWorkspace()
    useSidebar.getState().initialize()
    usePanels.getState().initialize()
    return useTheme.getState().initialize()
  }, [])

  /** Resumes a session from the cookie alone: the access token lived in memory. */
  const resume = useCallback(async () => {
    try {
      await api.health()
    } catch {
      setOnline(false)
      setChecking(false)
      return
    }
    setOnline(true)
    setMe(await api.resume())
    setChecking(false)
  }, [])

  useEffect(() => {
    void resume()
  }, [resume])

  /**
   * Rereads the generated documentation without waiting for it.
   *
   * It is built from the same catalog as the description of the base, so it goes stale
   * with it — and a description is the very thing it exists to show, which makes a stale
   * page the first place someone would notice an edit that "did not take".
   */
  const refreshDoc = useCallback((name: string) => {
    void api.documentation(name).then(setDoc, () => undefined)
  }, [])

  const describe = useCallback(async (name: string) => {
    const found = await api.describeBase(name)
    setDescribed((was) => ({ ...was, [name]: found }))
    return found
  }, [])

  const forget = useCallback((name: string) => {
    setDescribed((was) => {
      const { [name]: _gone, ...rest } = was
      return rest
    })
  }, [])

  const loadProjects = useCallback(async () => {
    const found = await api.projects()
    setProjects(found)
    return found
  }, [])

  const selectProject = useCallback((id: string | null) => {
    setProjectId(id)
    rememberProject(id)
  }, [])

  /**
   * Makes a base the current one, then does what was asked of it.
   *
   * « open » shows its data: the tab already open on it if there is one — reopening a base
   * must restore what was open, not add a duplicate of its first table — else its first
   * table, else nothing, and the empty base offers to create one.
   */
  const focusBase = useCallback(
    async (name: string, intent: BaseIntent) => {
      setError(null)
      try {
        const found = await describe(name)
        setBaseName(name)
        selectProject(found.project.id)
        refreshDoc(name)

        const state = useWorkspace.getState()
        switch (intent) {
          case 'open': {
            setSection('data')
            const current = state.tabs.find((t) => t.id === state.activeId)
            if (current?.base === name) break
            const mine = state.tabs.filter((t) => t.base === name)
            const last = mine[mine.length - 1]
            if (last !== undefined) activate(last.id)
            else if (found.tables[0] !== undefined)
              openTable(found.tables[0], found.tables[0].label)
            break
          }
          case 'structure':
            setSection('structure')
            break
          case 'doc':
            setSection('doc')
            break
          case 'sql': {
            setSection('data')
            const count = state.tabs.filter((t) => t.kind === 'sql').length + 1
            openSql(name, null, `Requête ${count}`)
            break
          }
          case 'new-table':
            setNaming(name)
            break
        }
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [activate, describe, openSql, openTable, refreshDoc, selectProject],
  )

  /**
   * The first load of a session: the project and base to land on.
   *
   * The open tab wins — it is what the person was looking at — then the project last
   * browsed, then the first one. A base opens by itself: arriving on a chooser when there
   * is one thing to choose is a click asked for nothing.
   */
  useEffect(() => {
    if (me === null || me.mustChangePassword) return
    let stale = false
    void (async () => {
      try {
        const found = await loadProjects()
        if (stale) return
        const state = useWorkspace.getState()
        const tab = state.tabs.find((t) => t.id === state.activeId)
        const tabProject = found.find((p) => p.bases.some((b) => b.name === tab?.base))
        const chosen =
          tabProject ?? found.find((p) => p.id === rememberedProject()) ?? found[0] ?? null
        selectProject(chosen?.id ?? null)
        const target =
          tab !== undefined && tabProject !== undefined ? tab.base : chosen?.bases[0]?.name
        if (target !== undefined) await focusBase(target, 'open')
      } catch (e) {
        setError(messageFor(e))
      } finally {
        if (!stale) setLoaded(true)
      }
    })()
    return () => {
      stale = true
    }
  }, [me, loadProjects, focusBase, selectProject])

  // Activating a tab makes its base the current one. Keyed on the tab alone: a base chosen
  // in the sidebar must not be taken back by a tab that merely stayed active.
  const activeId = activeTab?.id ?? null
  const activeBase = activeTab?.base ?? null
  const synced = useRef<string | null>(null)
  useEffect(() => {
    if (!loaded || activeId === null || activeBase === null) return
    if (synced.current === activeId) return
    synced.current = activeId
    if (activeBase === baseNameRef.current && described[activeBase] !== undefined) return
    void describe(activeBase).then(
      (found) => {
        setBaseName(activeBase)
        selectProject(found.project.id)
        refreshDoc(activeBase)
      },
      // The base of a restored tab is gone, or no longer visible: its tabs go with it.
      () => dropBase(activeBase),
    )
  }, [loaded, activeId, activeBase, described, describe, dropBase, refreshDoc, selectProject])

  /** Rereads the projects, and a base — the current one by default. */
  const refreshBase = useCallback(
    async (name?: string) => {
      await loadProjects().catch(() => undefined)
      const target = name ?? baseNameRef.current
      if (target === null) return
      try {
        await describe(target)
        refreshDoc(target)
      } catch {
        // The base is no longer visible: fall back to whatever else there is.
        forget(target)
        if (baseNameRef.current === target) setBaseName(null)
      }
    },
    [describe, forget, loadProjects, refreshDoc],
  )

  const openProject = useCallback(
    async (id: string, known?: readonly Project[]) => {
      selectProject(id)
      const chosen = (known ?? projects).find((p) => p.id === id)
      const state = useWorkspace.getState()
      const tab = state.tabs.find((t) => t.id === state.activeId)
      // The open tab stays in front when it belongs to the project; else its first base.
      const target = chosen?.bases.some((b) => b.name === tab?.base)
        ? tab?.base
        : chosen?.bases[0]?.name
      if (target !== undefined) {
        await focusBase(target, 'open')
      } else {
        setBaseName(null)
        if (section !== 'admin') setSection('data')
      }
    },
    [projects, focusBase, section, selectProject],
  )

  const onTable = useCallback(
    async (name: string, table: string, intent: TableIntent) => {
      setError(null)
      try {
        const found = described[name] ?? (await describe(name))
        const target = found.tables.find((t) => t.name === table)
        if (target === undefined) {
          await refreshBase(name)
          return
        }
        setBaseName(name)
        selectProject(found.project.id)
        if (intent === 'delete') {
          deleteTable(target)
          return
        }
        if (intent === 'edit') {
          editTable(target)
          return
        }
        setSection('data')
        openTable(target, target.label)
        if (intent === 'import') importInto(target)
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [
      described,
      describe,
      deleteTable,
      editTable,
      importInto,
      openTable,
      refreshBase,
      selectProject,
    ],
  )

  /**
   * A new table in a base — which is what the button says. The description is read back
   * rather than patched: the catalog decides the table's name, its system columns and the
   * order it appears in.
   */
  const createTable = useCallback(
    async (name: string, label: string, description?: string) => {
      setCreating(true)
      setError(null)
      try {
        const created = await api.createTableIn(name, label, description)
        const refreshed = await describe(name)
        setBaseName(name)
        refreshDoc(name)
        await loadProjects().catch(() => undefined)
        setSection('data')
        const opened = refreshed.tables.find((t) => t.name === created.name)
        if (opened !== undefined) openTable(opened, opened.label)
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setCreating(false)
      }
    },
    [describe, loadProjects, openTable, refreshDoc],
  )

  /** Two linked tables, described and filled, in the current project. */
  const createSample = useCallback(async () => {
    if (projectId === null) return
    setCreating(true)
    setError(null)
    try {
      const created = await api.createBase(
        `Démo ${new Date().toISOString().slice(11, 19)}`,
        SAMPLE_BASE_DESCRIPTION,
        projectId,
      )
      const clients = await api.createTable(
        created.name,
        'Clients',
        [
          {
            label: 'Raison sociale',
            kind: 'short_text',
            required: true,
            description:
              'Nom légal du client, tel qu’il figure sur ses factures. C’est aussi ce qui le ' +
              'désigne quand une facture renvoie vers lui.',
          },
          {
            label: 'Ville',
            kind: 'short_text',
            description: 'Ville du siège ou de l’établissement facturé, en texte libre.',
          },
        ],
        SAMPLE_CLIENTS_DESCRIPTION,
      )
      const invoices = await api.createTable(
        created.name,
        'Factures',
        SAMPLE_FIELDS,
        SAMPLE_INVOICES_DESCRIPTION,
      )
      await api.createLink(
        { base: created.name, name: invoices.name },
        'Client',
        clients.name,
        'Client à qui la facture est adressée. Une facture vise un seul client ; ' +
          'un client peut recevoir plusieurs factures.',
      )

      // Both tables get a display column: without one on `factures`, the inverse links
      // shown on a client would read as truncated UUIDs — correct, and useless.
      for (const [table, column] of [
        [clients, 'raison_sociale'],
        [invoices, 'numero'],
      ] as const) {
        const display = table.fields.find((f) => f.name === column)
        if (display?.id !== undefined) {
          await api.setDisplayColumn({ base: created.name, name: table.name }, display.id)
        }
      }
      for (const name of ['Dupont SARL', 'ACME', 'École du Nord']) {
        await api.createRecord({ base: created.name, name: clients.name }, { raison_sociale: name })
      }

      await loadProjects()
      await focusBase(created.name, 'open')
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setCreating(false)
    }
  }, [projectId, loadProjects, focusBase])

  const signOut = useCallback(() => {
    setMe(null)
    setProjects([])
    setProjectId(null)
    setDescribed({})
    setBaseName(null)
    setLoaded(false)
    setSection('data')
    synced.current = null
    useWorkspace.getState().closeAll()
  }, [])

  // Nothing is shown before we know whether a session is open: a flash of the login
  // screen for someone already connected reads as having been signed out.
  if (checking) return <div className="min-h-screen bg-background" />

  if (online === false) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <h1 className="mb-2 text-base font-semibold">L’API ne répond pas</h1>
          <p className="text-muted-foreground">Vérifiez qu’elle est démarrée, puis rechargez.</p>
        </div>
      </main>
    )
  }

  if (me === null) return <Login onSignedIn={() => void resume()} />

  if (me.mustChangePassword) {
    return (
      <PasswordRequired
        me={me}
        onDone={() => void resume()}
        onSignOut={() => {
          void api.logout().finally(signOut)
        }}
      />
    )
  }

  const baseHasTabs = base !== null && tabs.some((t) => t.base === base.name)
  const canCreateBase = project?.actions.includes('manage_schema') === true
  const namingBase = naming === null ? null : (described[naming] ?? null)
  // The environments that are not production, by base name: what a tab says of itself.
  const environments = new Map(
    projects
      .flatMap((p) => p.bases)
      .filter((b) => !b.environment.production)
      .map((b) => [b.name, b.environment] as const),
  )

  /** The data view: the active tab's base, or the current base when it has nothing open. */
  const dataView = () => {
    if (!loaded) return <Loading />
    if (projects.length === 0) {
      return me.isAdmin ? (
        <Empty
          icon={FolderKanban}
          title="Aucun projet"
          body="Un projet regroupe des bases. Créez le premier pour commencer."
          action={{ label: 'Créer un projet', onClick: () => setNewProject(true) }}
        />
      ) : (
        <Empty
          icon={FolderKanban}
          title="Aucun projet accessible"
          body="Aucun projet ne vous est encore ouvert. Demandez à un administrateur de vous donner accès."
        />
      )
    }
    if (project !== null && project.bases.length === 0 && (activeTab === null || base === null)) {
      return canCreateBase ? (
        <Empty
          icon={Database}
          title={`Aucune base dans « ${project.label} »`}
          body="Créez une base vide, ou une base de démonstration : deux tables liées, déjà décrites."
          action={{ label: 'Créer une base', onClick: () => setNewBase(true) }}
          secondary={{
            label: 'Base de démonstration',
            onClick: () => void createSample(),
          }}
          busy={creating}
        />
      ) : (
        <Empty
          icon={Database}
          title="Aucune base visible"
          body="Ce projet ne contient aucune base qui vous soit ouverte."
        />
      )
    }
    if (project === null && activeTab === null) {
      return (
        <Empty
          icon={FolderKanban}
          title="Choisissez un projet"
          body="Sélectionnez un projet en haut du panneau de gauche."
        />
      )
    }
    // The current base has nothing open and no table: the one screen that offers a way forward.
    if (base !== null && !baseHasTabs && base.tables.length === 0) {
      return base.actions.includes('manage_schema') ? (
        <Empty
          icon={Database}
          title="Aucune table"
          body={`Créez la première table de « ${base.label} ».`}
          action={{ label: 'Créer une table', onClick: () => setNaming(base.name) }}
          busy={creating}
        />
      ) : (
        <Empty
          icon={Database}
          title="Aucune table"
          body="Aucune table de cette base ne vous est ouverte."
        />
      )
    }
    const shown = tabBase ?? (activeTab === null ? base : null)
    if (shown === null && activeTab === null) {
      return (
        <Empty
          icon={Database}
          title="Choisissez une base"
          body="Dépliez une base dans le panneau de gauche, puis ouvrez l’une de ses tables."
        />
      )
    }
    // The active tab's base is being described: the sync effect above is on it.
    if (shown === null) return <Loading />
    return (
      <Workspace
        base={shown}
        tables={shown.tables}
        onBaseChanged={() => refreshBase(shown.name)}
        environments={environments}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <ElevationProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar
            projects={projects}
            project={project}
            base={base}
            user={me}
            section={section}
            busy={creating}
            onSelectProject={(id) => void openProject(id)}
            onNewProject={() => setNewProject(true)}
            onProjectsChanged={() => void refreshBase()}
            onProjectDeleted={(id) => {
              void loadProjects().then((found) => {
                const next = found.find((p) => p.id !== id)
                if (next !== undefined) void openProject(next.id, found)
                else {
                  selectProject(null)
                  setBaseName(null)
                }
              })
            }}
            onNewBase={() => setNewBase(true)}
            onBase={(name, intent) => void focusBase(name, intent)}
            onBaseChanged={(name) => void refreshBase(name)}
            onBaseDeleted={(name) => {
              dropBase(name)
              forget(name)
              void loadProjects().then((found) => {
                if (baseNameRef.current !== name) return
                const next = found.find((p) => p.id === projectId)?.bases[0]?.name
                if (next !== undefined) void focusBase(next, 'open')
                else setBaseName(null)
              })
            }}
            onTable={(b, t, intent) => void onTable(b, t, intent)}
            onRenamed={(change) => {
              // Tabs and URLs carry names: those of the old name are closed, and the
              // object is reopened under the new one (chapter 06 §2).
              if (change.kind === 'base') {
                dropBase(change.from)
                forget(change.from)
                void loadProjects().then(() => focusBase(change.to, 'open'))
                return
              }
              dropTable(change.base, change.from)
              void (async () => {
                await loadProjects().catch(() => undefined)
                const found = await describe(change.base)
                refreshDoc(change.base)
                const renamed = found.tables.find((t) => t.name === change.to)
                if (renamed === undefined) return
                setSection('data')
                openTable(renamed, renamed.label)
              })().catch((e) => setError(messageFor(e)))
            }}
            onSection={setSection}
            onAdmin={(tab) => {
              setAdminTab(tab)
              setSection('admin')
            }}
            onSignedOut={signOut}
          />

          {section === 'admin' && me.isAdmin ? (
            <AdminPanel
              tab={adminTab}
              me={me}
              focusProject={projectId}
              onTab={setAdminTab}
              onAccessChanged={() => void refreshBase()}
            />
          ) : section === 'data' || section === 'admin' || base === null ? (
            dataView()
          ) : section === 'history' ? (
            <HistoryPanel base={base} onBack={() => void focusBase(base.name, 'open')} />
          ) : (
            <SectionPanel
              section={section}
              base={base}
              doc={doc}
              onBack={() => void focusBase(base.name, 'open')}
              onChanged={() => refreshBase()}
              administers={me.isAdmin}
            />
          )}

          {namingBase !== null && (
            <NewTableDialog
              open={naming !== null}
              base={namingBase}
              busy={creating}
              onClose={() => setNaming(null)}
              onSubmit={async (label, description) => {
                await createTable(namingBase.name, label, description)
                setNaming(null)
              }}
            />
          )}

          {project !== null && (
            <NewBaseDialog
              open={newBase}
              project={project}
              onClose={() => setNewBase(false)}
              onDone={(name) => {
                setNewBase(false)
                void loadProjects().then(() => focusBase(name, 'open'))
              }}
            />
          )}

          <ProjectDialog
            open={newProject}
            onClose={() => setNewProject(false)}
            onDone={(id) => {
              setNewProject(false)
              void loadProjects().then((found) => openProject(id, found))
            }}
          />

          {error !== null && (
            <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center">
              <div className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>

        <TableDialogs
          base={section === 'data' ? (tabBase ?? base) : base}
          onBaseChanged={() => refreshBase()}
        />
      </ElevationProvider>
    </TooltipProvider>
  )
}

function Loading() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b px-3">
        <SidebarToggle />
      </header>
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}

/** Nothing to show yet: says why, and offers the way forward when there is one. */
function Empty({
  icon: Icon,
  title,
  body,
  action,
  secondary,
  busy = false,
}: {
  readonly icon: typeof Database
  readonly title: string
  readonly body: string
  readonly action?: { readonly label: string; readonly onClick: () => void }
  readonly secondary?: { readonly label: string; readonly onClick: () => void }
  readonly busy?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b px-3">
        <SidebarToggle />
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
            <Icon className="size-6 text-muted-foreground" />
          </span>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          {(action !== undefined || secondary !== undefined) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {action !== undefined && (
                <Button onClick={action.onClick} disabled={busy}>
                  <Plus className="size-4" />
                  {action.label}
                </Button>
              )}
              {secondary !== undefined && (
                <Button variant="outline" onClick={secondary.onClick} disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {busy ? 'Création…' : secondary.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** The sections of a base: its structure, its documentation, and what is not written yet. */
function SectionPanel({
  section,
  base,
  doc,
  onBack,
  onChanged,
  administers,
}: {
  readonly section: Section
  readonly base: DescribedBase
  readonly doc: ApiDocumentation | null
  readonly onBack: () => void
  readonly onChanged: () => Promise<void>
  readonly administers: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <span className="text-sm text-muted-foreground">{base.project.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">{base.label}</span>
        {base.environment !== undefined && !base.environment.production && (
          <EnvironmentBadge environment={base.environment} />
        )}
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{SECTION_TITLES[section] ?? ''}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onBack}>
          Retour aux données
        </Button>
      </header>

      {/* The documentation lays out its own columns and scrolls each of them: it gets the whole
          area, where every other section sits in one padded column that scrolls as a piece. */}
      <div
        className={
          section === 'doc'
            ? 'flex min-h-0 flex-1 flex-col'
            : 'min-h-0 flex-1 overflow-y-auto scroll-discret px-6 py-6'
        }
      >
        {section === 'structure' ? (
          <SchemaEditor base={base} onChanged={onChanged} administers={administers} />
        ) : (
          <ApiDocs base={base} doc={doc} />
        )}
      </div>
    </div>
  )
}
