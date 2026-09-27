'use client'

import { ApiDocs } from '@/components/api-reference/api-docs'
import {
  AdminPanel,
  type AdminTab,
  adminTabOfSlug,
  slugOfAdminTab,
} from '@/components/app/admin/admin-panel'
import { AutomationsPanel } from '@/components/app/automations'
import { BaseIllustration } from '@/components/app/base-illustration'
import { NewBaseDialog } from '@/components/app/base-menu'
import { CommandPalette } from '@/components/app/command-palette'
import { DashboardsPanel } from '@/components/app/dashboards'
import { ElevationProvider } from '@/components/app/elevation'
import { EnvironmentBadge } from '@/components/app/environment-badge'
import { HistoryPanel } from '@/components/app/history'
import { IntegrationsPanel } from '@/components/app/integrations'
import { NewTableDialog } from '@/components/app/new-table-dialog'
import { PasswordRequired } from '@/components/app/password-required'
import { ProjectIllustration } from '@/components/app/project-illustration'
import { ProjectDialog } from '@/components/app/project-menu'
import { SchemaEditor } from '@/components/app/schema-editor'
import {
  type LinkNotice,
  SettingsPanel,
  type SettingsTab,
  slugOfTab,
  tabOfSlug,
} from '@/components/app/settings/settings-panel'
import {
  type BaseIntent,
  type SavedIntent,
  type Section,
  Sidebar,
  SidebarToggle,
  type TableIntent,
} from '@/components/app/sidebar'
import { DeleteQueryDialog, QueryDialog } from '@/components/app/sql/query-dialog'
import { DeleteSqlViewDialog, SqlViewDialog } from '@/components/app/sql/sql-view-dialog'
import { TableDialogs, useTableActions } from '@/components/app/table-actions'
import { TemplateGallery } from '@/components/app/template-gallery'
import { Workspace } from '@/components/app/workspace'
import { Bootstrap } from '@/components/bootstrap'
import { Login } from '@/components/login'
import { SignUp } from '@/components/signup'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { type DashboardFocus, type Place, addressOf, placeOf } from '@/lib/address-bar'
import {
  type ApiDocumentation,
  ApiError,
  type DescribedBase,
  type Me,
  type Project,
  type QuerySummary,
  type SavedQuery,
  type SqlView,
  type SqlViewSummary,
  api,
} from '@/lib/api/client'
import { $t, followAccountLocale } from '@/lib/i18n'
import { messageFor, reasonFor } from '@/lib/messages'
import { applyPreferences } from '@/lib/preferences'
import { usePanels } from '@/lib/store/panels'
import { useSidebar } from '@/lib/store/sidebar'
import { type Tab, hydrateWorkspace, useActiveTab, useWorkspace } from '@/lib/store/workspace'
import { useTheme } from '@/lib/theme'
import { useAddressBar } from '@/lib/use-address-bar'
import { useTitle } from '@/lib/use-title'
import { Database, FolderKanban, Loader2, Plus, SearchX, Sparkles } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'

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
  structure: $t('Structure'),
  history: $t('Historique'),
  dashboards: $t('Tableaux de bord'),
  automations: $t('Automatisations'),
  integrations: $t('Intégrations'),
  doc: $t('Documentation API et MCP'),
  admin: $t('Administration'),
  settings: $t('Paramètres'),
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

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(true)
  const [online, setOnline] = useState<boolean | null>(null)
  /** No administrator exists yet: the first screen creates one instead of signing in. */
  const [bootstrapping, setBootstrapping] = useState(false)
  /** The sign-in screen turned into creating an account. */
  const [signingUp, setSigningUp] = useState(false)

  const [projects, setProjects] = useState<readonly Project[]>([])
  const [loaded, setLoaded] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  /** Every base described so far, by logical name: the tabs may span several. */
  const [described, setDescribed] = useState<Readonly<Record<string, DescribedBase>>>({})
  const [baseName, setBaseName] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('data')
  const [adminTab, setAdminTab] = useState<AdminTab>('users')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile')
  /** What a provider answered to a link asked for from the settings (chapter 13 §3.5). */
  const [linkNotice, setLinkNotice] = useState<LinkNotice | null>(null)
  /**
   * The address names nothing this person may open — a typo, a table renamed, deleted or
   * not theirs, which the screen does not tell apart (chapter 11 §7). Left by going elsewhere.
   */
  const [missing, setMissing] = useState(false)
  /** The dashboard, or the question, shown in the dashboards of a base — for the address. */
  const [dashboardFocus, setDashboardFocus] = useState<{
    readonly base: string
    readonly focus: DashboardFocus | null
  } | null>(null)
  /** The automation shown in the automations of a base — for the address. */
  const [automationFocus, setAutomationFocus] = useState<{
    readonly base: string
    readonly id: string | null
  } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  /** The gallery of templates, open — on one template, the demonstration say. */
  const [gallery, setGallery] = useState<{ readonly initialKey: string | null } | null>(null)
  /** The base a new table is being named in. */
  const [naming, setNaming] = useState<string | null>(null)
  const [newProject, setNewProject] = useState(false)
  const [newBase, setNewBase] = useState(false)
  /** A SQL view being created in a base, or changed — from the navigation. */
  const [viewEdit, setViewEdit] = useState<{
    readonly base: string
    readonly view: SqlView | null
  } | null>(null)
  /** A saved query being renamed or shared — from the navigation. */
  const [queryEdit, setQueryEdit] = useState<{
    readonly base: string
    readonly query: SavedQuery
  } | null>(null)
  /** A SQL view about to be deleted — from its menu in the navigation. */
  const [viewDelete, setViewDelete] = useState<{
    readonly base: string
    readonly view: SqlViewSummary
  } | null>(null)
  /** A saved query about to be deleted — from its menu in the navigation. */
  const [queryDelete, setQueryDelete] = useState<{
    readonly base: string
    readonly query: QuerySummary
  } | null>(null)

  const [doc, setDoc] = useState<ApiDocumentation | null>(null)

  const openTable = useWorkspace((s) => s.openTable)
  const openSql = useWorkspace((s) => s.openSql)
  const openQueryTab = useWorkspace((s) => s.openQuery)
  const openSqlViewTab = useWorkspace((s) => s.openSqlView)
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
  useTitle(
    missing
      ? [$t('Cette page n’existe pas')]
      : [
          section === 'data' ? activeTab?.label : SECTION_TITLES[section],
          section === 'admin' || section === 'settings'
            ? undefined
            : (base?.label ?? project?.label),
        ],
  )

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
    const found = await api.resume()
    // The account speaks another language than the page: the page reloads in it, and
    // nothing is drawn meanwhile.
    if (found !== null && followAccountLocale(found.locale)) return
    setBootstrapping(found === null && (await api.bootstrapOpen()))
    if (found !== null) applyPreferences(found)
    setMe(found)
    setChecking(false)
  }, [])

  /** The account changed from the settings: its name, its address, its preferences. */
  const changeMe = useCallback((updated: Me) => {
    // A language chosen in the settings reloads the page in it.
    if (followAccountLocale(updated.locale)) return
    applyPreferences(updated)
    setMe(updated)
  }, [])

  // WHO is signed in, rather than the account as a whole: the first load below must run
  // once per person, not again because they renamed themselves in the settings.
  const signedIn = me === null || me.mustChangePassword ? null : me.id
  /** Whose bases an address names: it writes them without their tenant. */
  const tenant = me?.tenant ?? null

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
    async (
      name: string,
      intent: BaseIntent | 'dashboards' | 'automations' | 'integrations',
      options: { readonly keepSection?: boolean } = {},
    ) => {
      setError(null)
      setMissing(false)
      try {
        const found = await describe(name)
        setBaseName(name)
        selectProject(found.project.id)
        refreshDoc(name)

        const state = useWorkspace.getState()
        switch (intent) {
          case 'open': {
            if (options.keepSection !== true) setSection('data')
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
          case 'history':
          case 'doc':
          case 'dashboards':
          case 'automations':
          case 'integrations':
            setSection(intent)
            break
          case 'sql': {
            setSection('data')
            const count = state.tabs.filter((t) => t.kind === 'sql').length + 1
            openSql(name, null, $t('Requête {count}', { count }))
            break
          }
          case 'question':
          case 'question-sql': {
            setSection('data')
            const count = state.tabs.filter((t) => t.kind === 'question').length + 1
            state.openNewQuestion(
              name,
              intent === 'question' ? 'builder' : 'sql',
              $t('Question {count}', { count }),
            )
            break
          }
          case 'new-table':
            setNaming(name)
            break
          case 'new-sql-view':
            setViewEdit({ base: name, view: null })
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
  // An address may land on the settings: `?parametres=<tab>`, or the provider's return
  // after a link asked for there — `&lien=<slug>` when it was made, `?connexion=<code>`
  // when it was refused (chapter 13 §3.5). The settings open on that tab, the outcome is
  // said once, and the address is cleaned: a reload must not say it again. Declared
  // before the first load, which reads `landing` to leave the settings in front.
  const landing = useRef(false)
  useEffect(() => {
    if (signedIn === null) return
    const params = new URLSearchParams(window.location.search)
    const tab = tabOfSlug(params.get('parametres'))
    const refused = params.get('connexion')
    if (tab === null && refused === null) return
    landing.current = true
    setSettingsTab(refused !== null ? 'profile' : (tab ?? 'profile'))
    setSection('settings')
    if (refused !== null) {
      const reason = params.get('raison')
      setLinkNotice({
        ok: false,
        // The sentence alone, as the sign-in screen says it: a code read off an address
        // carries no trace worth showing.
        text: reasonFor(new ApiError(refused, 400, '', reason === null ? {} : { reason })),
      })
    } else if (params.get('lien') !== null) {
      setLinkNotice({
        ok: true,
        text: $t('Compte lié : vous pouvez désormais vous connecter avec lui.'),
      })
    }
    for (const key of ['parametres', 'connexion', 'raison', 'lien']) params.delete(key)
    const rest = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${rest === '' ? '' : `?${rest}`}`,
    )
  }, [signedIn])

  /** Where an address leads — set further down, once all it calls is declared. */
  const goTo = useRef<(place: Place, known: readonly Project[]) => Promise<boolean>>(
    async () => false,
  )

  useEffect(() => {
    if (signedIn === null) return
    let stale = false
    void (async () => {
      try {
        const found = await loadProjects()
        if (stale) return
        // An address naming a place — a bookmark, a link — lands there; one naming nothing
        // says so. The settings and the administration are drawn over the base chosen below.
        const addressed = placeOf(window.location.pathname, window.location.search, tenant ?? '')
        const reached = addressed !== null && (await goTo.current(addressed, found))
        if (stale) return
        if (addressed === null || !reached) setMissing(true)
        const over = addressed?.kind === 'settings' || addressed?.kind === 'admin'
        if (reached && addressed.kind !== 'home' && !over) return
        const state = useWorkspace.getState()
        const tab = state.tabs.find((t) => t.id === state.activeId)
        const tabProject = found.find((p) => p.bases.some((b) => b.name === tab?.base))
        const chosen =
          tabProject ?? found.find((p) => p.id === rememberedProject()) ?? found[0] ?? null
        selectProject(chosen?.id ?? null)
        const target =
          tab !== undefined && tabProject !== undefined ? tab.base : chosen?.bases[0]?.name
        if (target !== undefined && reached) {
          await focusBase(target, 'open', { keepSection: landing.current || over })
        }
      } catch (e) {
        setError(messageFor(e))
      } finally {
        if (!stale) setLoaded(true)
      }
    })()
    return () => {
      stale = true
    }
  }, [signedIn, tenant, loadProjects, focusBase, selectProject])

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
      setMissing(false)
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
      setMissing(false)
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
   * A SQL view of the navigation: opened in a tab of its own, or changed in its dialog —
   * which reads it first, as it is now.
   */
  const onSqlView = useCallback(
    async (name: string, view: SqlViewSummary, intent: SavedIntent) => {
      setError(null)
      setMissing(false)
      if (intent === 'delete') {
        setViewDelete({ base: name, view })
        return
      }
      try {
        const found = described[name] ?? (await describe(name))
        setBaseName(name)
        selectProject(found.project.id)
        if (intent === 'edit') {
          setViewEdit({ base: name, view: await api.sqlView(name, view.id) })
          return
        }
        setSection('data')
        openSqlViewTab(name, view)
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [described, describe, openSqlViewTab, selectProject],
  )

  /**
   * A saved query of the navigation: its text opened in a SQL tab — the one already showing
   * it, if any — or its name and audience changed in its dialog.
   */
  const onQuery = useCallback(
    async (name: string, summary: QuerySummary, intent: SavedIntent) => {
      setError(null)
      setMissing(false)
      if (intent === 'delete') {
        setQueryDelete({ base: name, query: summary })
        return
      }
      try {
        const found = described[name] ?? (await describe(name))
        const query = await api.query(name, summary.id)
        setBaseName(name)
        selectProject(found.project.id)
        if (intent === 'edit') {
          setQueryEdit({ base: name, query })
          return
        }
        setSection('data')
        openQueryTab(name, query)
      } catch (e) {
        setError(messageFor(e))
        // Gone, or no longer shared: the navigation says so by no longer listing it.
        if (e instanceof ApiError && e.code === 'RESOURCE_NOT_FOUND') {
          void loadProjects().catch(() => undefined)
        }
      }
    },
    [described, describe, loadProjects, openQueryTab, selectProject],
  )

  // A notification's row in another base: its table is opened here, the workspace then
  // opens the row once that base is on screen (chapter 16 §2).
  const pendingRecord = useWorkspace((s) => s.pendingRecord)
  useEffect(() => {
    if (pendingRecord === null) return
    // Its base on screen, in the data: the workspace opens the row itself.
    if (pendingRecord.base === baseNameRef.current && section === 'data') return
    void onTable(pendingRecord.base, pendingRecord.table, 'open')
  }, [pendingRecord, onTable, section])

  /**
   * Goes where an address leads — on landing, and on the browser's back and forward.
   *
   * `known`: the projects as last read, which list what this person may open. Says whether
   * the place is there: one that is not — a base, a table, a view deleted, renamed or not
   * theirs — makes the page that does not exist, never a refusal (chapter 11 §7). What sits
   * inside a section — a dashboard, an automation, a saved view, a row — is shown when it is
   * still there, and the address then says what was shown instead.
   */
  const followAddress = useCallback(
    async (place: Place, known: readonly Project[]): Promise<boolean> => {
      setMissing(false)
      const store = useWorkspace.getState()
      if (place.kind !== 'table') store.requestView(null)
      switch (place.kind) {
        case 'home':
          return true
        case 'settings':
          setSettingsTab(tabOfSlug(place.tab) ?? 'profile')
          setSection('settings')
          return true
        case 'admin':
          if (me?.isAdmin !== true) return false
          setAdminTab(adminTabOfSlug(place.tab) ?? 'users')
          setSection('admin')
          return true
        case 'project':
          if (!known.some((p) => p.id === place.project)) return false
          await openProject(place.project, known)
          return true
      }
      const listed = known.flatMap((p) => p.bases).find((b) => b.name === place.base)
      if (listed === undefined) return false
      switch (place.kind) {
        case 'base':
          await focusBase(place.base, 'open')
          return true
        case 'section':
          await focusBase(place.base, place.section)
          return true
        case 'dashboards':
          setDashboardFocus({ base: place.base, focus: place.focus })
          await focusBase(place.base, 'dashboards')
          return true
        case 'automations':
          setAutomationFocus({ base: place.base, id: place.automation })
          await focusBase(place.base, 'automations')
          return true
        case 'table': {
          if (!listed.tables.some((t) => t.name === place.table)) return false
          const active = store.tabs.find((t) => t.id === store.activeId)
          const there =
            section === 'data' &&
            active?.kind === 'table' &&
            active.base === place.base &&
            active.table === place.table
          await onTable(place.base, place.table, 'open')
          store.requestView({ base: place.base, table: place.table, viewId: place.view })
          // The row: opened once its table is on screen — or closed, back where none was.
          const shown = useWorkspace.getState().shownRecord
          if (place.record === null) {
            if (shown !== null) store.closeRecord()
          } else if (!there || shown !== place.record) {
            store.requestRecord({ base: place.base, table: place.table, id: place.record })
          }
          return true
        }
        case 'sqlview': {
          const view = listed.sqlViews.find((v) => v.id === place.id)
          if (view === undefined) return false
          await onSqlView(place.base, view, 'open')
          return true
        }
        case 'query': {
          const query = listed.queries.find((q) => q.id === place.id)
          if (query === undefined) return false
          await onQuery(place.base, query, 'open')
          return true
        }
        case 'question': {
          const question = await api.question(place.base, place.id).catch(() => null)
          if (question === null) return false
          const found = described[place.base] ?? (await describe(place.base))
          setBaseName(place.base)
          selectProject(found.project.id)
          setSection('data')
          useWorkspace.getState().openQuestion(place.base, question)
          return true
        }
      }
    },
    [
      described,
      describe,
      focusBase,
      me,
      onQuery,
      onSqlView,
      onTable,
      openProject,
      section,
      selectProject,
    ],
  )
  goTo.current = followAddress

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
        setMissing(false)
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

  const signOut = useCallback(() => {
    setMe(null)
    setProjects([])
    setProjectId(null)
    setDescribed({})
    setBaseName(null)
    setLoaded(false)
    setSection('data')
    setLinkNotice(null)
    landing.current = false
    synced.current = null
    useWorkspace.getState().closeAll()
  }, [])

  /**
   * A question to the copilot, from the search: the data of its base are brought on screen
   * — the copilot speaks over a table —, then the question is put.
   */
  const askCopilot = useCallback(
    async (name: string, question: string) => {
      const state = useWorkspace.getState()
      const current = state.tabs.find((t) => t.id === state.activeId)
      if (section !== 'data' || current?.base !== name) await focusBase(name, 'open')
      useWorkspace.getState().askCopilot(question)
    },
    [section, focusBase],
  )

  // What the screen shows, as the address says it. Nothing before the first load — the
  // address is still being followed —, nor over a page that does not exist: that address
  // stays as it was typed.
  const shownRecord = useWorkspace((s) => s.shownRecord)
  const address =
    !loaded || missing || me === null
      ? null
      : addressOf(
          placeOnScreen({
            section,
            administers: me.isAdmin,
            adminTab,
            settingsTab,
            project,
            base,
            activeTab,
            shownRecord,
            dashboardFocus,
            automationFocus,
          }),
        )
  useAddressBar(address, async () => {
    if (!loaded || me === null) return
    const place = placeOf(window.location.pathname, window.location.search, me.tenant)
    if (place === null || !(await followAddress(place, projects))) setMissing(true)
  })

  // Nothing is shown before we know whether a session is open: a flash of the login
  // screen for someone already connected reads as having been signed out.
  if (checking) return <div className="min-h-screen bg-background" />

  if (online === false) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <h1 className="mb-2 text-base font-semibold">{$t('L’API ne répond pas')}</h1>
          <p className="text-muted-foreground">
            {$t('Vérifiez qu’elle est démarrée, puis rechargez.')}
          </p>
        </div>
      </main>
    )
  }

  if (me === null) {
    if (bootstrapping) return <Bootstrap onDone={() => void resume()} />
    return signingUp ? (
      <SignUp onDone={() => void resume()} onSignIn={() => setSigningUp(false)} />
    ) : (
      <Login
        onSignedIn={() => void resume()}
        onSignUp={() => setSigningUp(true)}
        // Signed in through a provider, one comes back to the address one came by.
        returnTo={`${window.location.pathname}${window.location.search}`}
      />
    )
  }

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
    // Anyone creates their own projects (05 §15.1); the others' come by invitation.
    if (projects.length === 0) {
      return (
        <Empty
          icon={FolderKanban}
          title={$t('Aucun projet')}
          illustration={<ProjectIllustration />}
          body={$t(
            'Un projet regroupe vos bases. Créez le vôtre — ou ouvrez le lien d’invitation qu’on vous a envoyé pour rejoindre celui d’une équipe.',
          )}
          action={{ label: $t('Créer un projet'), onClick: () => setNewProject(true) }}
        />
      )
    }
    if (project !== null && project.bases.length === 0 && (activeTab === null || base === null)) {
      return canCreateBase ? (
        <Empty
          icon={Database}
          title={$t('Aucune base dans « {label} »', { label: project.label })}
          illustration={<BaseIllustration />}
          body={$t(
            'Créez une base vide, partez d’un modèle ou demandez-la à l’IA — ou ouvrez la démonstration, qui montre tout basedb.',
          )}
          action={{ label: $t('Créer une base'), onClick: () => setNewBase(true) }}
          secondary={{
            label: $t('Base de démonstration'),
            onClick: () => setGallery({ initialKey: 'demo' }),
          }}
          busy={creating}
        />
      ) : (
        <Empty
          icon={Database}
          title={$t('Aucune base visible')}
          body={$t('Ce projet ne contient aucune base qui vous soit ouverte.')}
        />
      )
    }
    if (project === null && activeTab === null) {
      return (
        <Empty
          icon={FolderKanban}
          title={$t('Choisissez un projet')}
          body={$t('Sélectionnez un projet en haut du panneau de gauche.')}
        />
      )
    }
    // The current base has nothing open and no table: the one screen that offers a way forward.
    if (base !== null && !baseHasTabs && base.tables.length === 0) {
      return base.actions.includes('manage_schema') ? (
        <Empty
          icon={Database}
          title={$t('Aucune table')}
          body={$t('Créez la première table de « {label} ».', { label: base.label })}
          action={{ label: $t('Créer une table'), onClick: () => setNaming(base.name) }}
          busy={creating}
        />
      ) : (
        <Empty
          icon={Database}
          title={$t('Aucune table')}
          body={$t('Aucune table de cette base ne vous est ouverte.')}
        />
      )
    }
    const shown = tabBase ?? (activeTab === null ? base : null)
    if (shown === null && activeTab === null) {
      return (
        <Empty
          icon={Database}
          title={$t('Choisissez une base')}
          body={$t('Dépliez une base dans le panneau de gauche, puis ouvrez l’une de ses tables.')}
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
        self={me?.id ?? null}
        onNavigationChanged={() => void loadProjects().catch(() => undefined)}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <ElevationProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Toaster position="bottom-center" closeButton />
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
            onSqlView={(b, v, intent) => void onSqlView(b, v, intent)}
            onQuery={(b, q, intent) => void onQuery(b, q, intent)}
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
            onSection={(next) => {
              setMissing(false)
              setSection(next)
            }}
            onAdmin={(tab) => {
              setMissing(false)
              setAdminTab(tab)
              setSection('admin')
            }}
            onSettings={(tab) => {
              setMissing(false)
              setSettingsTab(tab)
              setSection('settings')
            }}
            onSignedOut={signOut}
          />

          {missing ? (
            <Empty
              icon={SearchX}
              title={$t('Cette page n’existe pas')}
              body={$t(
                'Son adresse est peut-être mal écrite, ou ce qu’elle désignait a été renommé ou supprimé.',
              )}
            />
          ) : section === 'settings' ? (
            <SettingsPanel
              tab={settingsTab}
              me={me}
              notice={linkNotice}
              onTab={setSettingsTab}
              onMe={changeMe}
              onDismissNotice={() => setLinkNotice(null)}
            />
          ) : section === 'admin' && me.isAdmin ? (
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
          ) : section === 'dashboards' ? (
            <DashboardsPanel
              base={base}
              focus={dashboardFocus?.base === base.name ? dashboardFocus.focus : null}
              onFocus={(focus) => setDashboardFocus({ base: base.name, focus })}
              onOpenInTab={(question) => {
                setSection('data')
                useWorkspace.getState().openQuestion(base.name, question)
              }}
            />
          ) : section === 'automations' ? (
            <AutomationsPanel
              base={base}
              focus={automationFocus?.base === base.name ? automationFocus.id : null}
              onFocus={(id) => setAutomationFocus({ base: base.name, id })}
            />
          ) : section === 'integrations' ? (
            <IntegrationsPanel
              base={base}
              onBack={() => void focusBase(base.name, 'open')}
              onChanged={() => void refreshBase()}
            />
          ) : (
            <SectionPanel
              section={section}
              base={base}
              doc={doc}
              onBack={() => void focusBase(base.name, 'open')}
              onChanged={() => refreshBase()}
              administers={me.isAdmin}
              buildable={buildableTables(projects, base.name)}
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
              onGallery={() => {
                setNewBase(false)
                setGallery({ initialKey: null })
              }}
            />
          )}

          {project !== null && (
            <TemplateGallery
              open={gallery !== null}
              project={project}
              me={me}
              initialKey={gallery?.initialKey ?? null}
              onClose={() => setGallery(null)}
              onDone={(name) => {
                setGallery(null)
                void loadProjects().then(() => focusBase(name, 'open'))
              }}
            />
          )}

          {viewEdit !== null && described[viewEdit.base] !== undefined && (
            <SqlViewDialog
              open
              base={described[viewEdit.base] as DescribedBase}
              view={viewEdit.view}
              onClose={() => setViewEdit(null)}
              onSaved={(saved) => {
                const where = viewEdit.base
                void loadProjects().catch(() => undefined)
                if (viewEdit.view === null) {
                  setSection('data')
                  openSqlViewTab(where, saved)
                  return
                }
                useWorkspace.getState().renameSqlView(saved.id, saved.label)
                // An open tab of the view reads it again: its text may have changed.
                useWorkspace.getState().reload()
              }}
              onDeleted={(id) => {
                useWorkspace.getState().dropSqlView(id)
                void loadProjects().catch(() => undefined)
              }}
            />
          )}

          {queryEdit !== null && (
            <QueryDialog
              open
              base={queryEdit.base}
              manages={described[queryEdit.base]?.actions.includes('manage_schema') === true}
              query={queryEdit.query}
              statement={queryEdit.query.statement}
              onClose={() => setQueryEdit(null)}
              onSaved={(saved) => {
                useWorkspace.getState().renameQuery(saved.id, saved.label)
                // Its open tab reads it again: who sees it may have changed too.
                useWorkspace.getState().reload()
                void loadProjects().catch(() => undefined)
              }}
              onDeleted={(id) => {
                useWorkspace.getState().detachQuery(id)
                void loadProjects().catch(() => undefined)
              }}
            />
          )}

          {viewDelete !== null && (
            <DeleteSqlViewDialog
              base={viewDelete.base}
              view={viewDelete.view}
              onClose={() => setViewDelete(null)}
              onDeleted={(id) => {
                useWorkspace.getState().dropSqlView(id)
                void loadProjects().catch(() => undefined)
              }}
            />
          )}

          {queryDelete !== null && (
            <DeleteQueryDialog
              base={queryDelete.base}
              query={queryDelete.query}
              onClose={() => setQueryDelete(null)}
              onDeleted={(id) => {
                useWorkspace.getState().detachQuery(id)
                void loadProjects().catch(() => undefined)
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
                  aria-label={$t('Fermer')}
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>

        <TableDialogs
          base={section === 'data' ? (tabBase ?? base) : base}
          administers={me.isAdmin}
          onBaseChanged={() => refreshBase()}
        />

        <CommandPalette
          me={me}
          projects={projects}
          project={project}
          base={base}
          described={described}
          section={section}
          describe={describe}
          onGo={(place) => {
            void followAddress(place, projects).then((reached) => {
              if (!reached) setMissing(true)
            })
          }}
          onTab={(id) => {
            setMissing(false)
            setSection('data')
            activate(id)
          }}
          onBase={(name, intent) => void focusBase(name, intent)}
          onTable={(name, table, intent) => void onTable(name, table, intent)}
          onNewProject={() => setNewProject(true)}
          onNewBase={() => setNewBase(true)}
          onGallery={(key) => setGallery({ initialKey: key })}
          onAskCopilot={(name, question) => void askCopilot(name, question)}
          onSignOut={() => {
            void api.logout().finally(signOut)
          }}
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
  illustration,
  title,
  body,
  action,
  secondary,
  busy = false,
}: {
  readonly icon: typeof Database
  readonly illustration?: ReactNode
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
        <div className="w-full max-w-md text-center">
          {illustration ?? (
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
              <Icon className="size-6 text-muted-foreground" />
            </span>
          )}
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
                  {busy ? $t('Création…') : secondary.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The tables of a base whose structure the reader may change. The base's description lists
 * only the DATA verbs of a table; the navigation's projects add `manage_schema` to each one
 * that grants it — the only place a « Gestion » set on a single table shows.
 */
function buildableTables(projects: readonly Project[], baseName: string): ReadonlySet<string> {
  const found = projects.flatMap((p) => p.bases).find((b) => b.name === baseName)
  return new Set(
    (found?.tables ?? []).filter((t) => t.actions.includes('manage_schema')).map((t) => t.name),
  )
}

/**
 * Where the screen is, as an address names it — in the order the screen itself chooses what
 * to draw: the settings, the administration, a section of the current base, else the data,
 * which follow the active tab.
 */
function placeOnScreen(screen: {
  readonly section: Section
  readonly administers: boolean
  readonly adminTab: AdminTab
  readonly settingsTab: SettingsTab
  readonly project: Project | null
  readonly base: DescribedBase | null
  readonly activeTab: Tab | null
  readonly shownRecord: string | null
  readonly dashboardFocus: { readonly base: string; readonly focus: DashboardFocus | null } | null
  readonly automationFocus: { readonly base: string; readonly id: string | null } | null
}): Place {
  const { section, project, base, activeTab } = screen
  if (section === 'settings') return { kind: 'settings', tab: slugOfTab(screen.settingsTab) }
  if (section === 'admin' && screen.administers) {
    return { kind: 'admin', tab: slugOfAdminTab(screen.adminTab) }
  }
  if (section !== 'data' && section !== 'admin' && base !== null) {
    if (section === 'dashboards') {
      const focus = screen.dashboardFocus?.base === base.name ? screen.dashboardFocus.focus : null
      return { kind: 'dashboards', base: base.name, focus }
    }
    if (section === 'automations') {
      const id = screen.automationFocus?.base === base.name ? screen.automationFocus.id : null
      return { kind: 'automations', base: base.name, automation: id }
    }
    return { kind: 'section', base: base.name, section }
  }
  // A project with no base to show the tab with draws itself, whatever tab is open.
  if (project !== null && project.bases.length === 0 && (activeTab === null || base === null)) {
    return { kind: 'project', project: project.id }
  }
  if (activeTab !== null) return placeOfTab(activeTab, screen.shownRecord)
  if (base !== null) return { kind: 'base', base: base.name }
  if (project !== null) return { kind: 'project', project: project.id }
  return { kind: 'home' }
}

/** A tab's address: what it shows when that was saved — an unsaved statement has none. */
function placeOfTab(tab: Tab, record: string | null): Place {
  const base: Place = { kind: 'base', base: tab.base }
  switch (tab.kind) {
    case 'table':
      return tab.table === null
        ? base
        : { kind: 'table', base: tab.base, table: tab.table, view: tab.viewId, record }
    case 'sqlview':
      return tab.sqlViewId === null ? base : { kind: 'sqlview', base: tab.base, id: tab.sqlViewId }
    case 'sql':
      return tab.queryId === null ? base : { kind: 'query', base: tab.base, id: tab.queryId }
    case 'question':
      return tab.questionId === null
        ? base
        : { kind: 'question', base: tab.base, id: tab.questionId }
  }
}

/** The sections of a base: its structure, its documentation, and what is not written yet. */
function SectionPanel({
  section,
  base,
  doc,
  onBack,
  onChanged,
  administers,
  buildable,
}: {
  readonly section: Section
  readonly base: DescribedBase
  readonly doc: ApiDocumentation | null
  readonly onBack: () => void
  readonly onChanged: () => Promise<void>
  readonly administers: boolean
  readonly buildable: ReadonlySet<string>
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
          {$t('Retour aux données')}
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
          <SchemaEditor
            base={base}
            onChanged={onChanged}
            administers={administers}
            buildable={buildable}
          />
        ) : (
          <ApiDocs base={base} doc={doc} />
        )}
      </div>
    </div>
  )
}
