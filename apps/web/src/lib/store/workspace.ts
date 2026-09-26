'use client'

import type { Field, Table } from '@/lib/api/client'
import { create } from 'zustand'

/**
 * The workspace — tabs, and the view state each one carries.
 *
 * Chapter 11 §1.4 draws the line this store sits on: a NAMED and SHARED grid layout is
 * a saved view in `_basedb.view_def`, and creating one demands `manage_schema`. What
 * lives here is the other half — "la surcharge locale non enregistrée : largeur tirée à
 * la souris, colonne masquée à la volée", persisted BY BROWSER and never sent to the
 * server. Nothing in this file talks to the API, and that is the point.
 *
 * `field.position` gives the initial order and is not modified by a local rearrangement:
 * `columnOrder` is an overlay read on top of it, null until someone drags a header.
 */

export type TabKind = 'table' | 'sql'

/** One sort term. At most three, per chapter 11 §1.3. */
export interface SortTerm {
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

/** The maximum chapter 11 §1.3 fixes: "au plus trois champs". */
export const MAX_SORT_TERMS = 3

/** Page sizes offered at the bottom. The kernel caps at its own ceiling anyway. */
export const PAGE_SIZES = [25, 50, 100, 250] as const

export const DEFAULT_PAGE_SIZE = 100
export const DEFAULT_COLUMN_WIDTH = 180
export const MIN_COLUMN_WIDTH = 64
export const MAX_COLUMN_WIDTH = 640

/**
 * The unsaved, per-browser overlay of one open tab.
 *
 * `cursors` is a STACK of the `_id` values each loaded page started after. Chapter 11
 * §1.2 is explicit that "il n'existe pas de saut à la page N", `offset` not existing:
 * going back a page therefore means popping the stack, not computing an offset. The
 * stack is also what the bottom bar reads to know whether "précédent" is available.
 */
export interface ViewState {
  readonly columnWidths: Readonly<Record<string, number>>
  readonly columnOrder: readonly string[] | null
  readonly pinned: readonly string[]
  readonly hidden: readonly string[]
  readonly sorts: readonly SortTerm[]
  readonly filter: string
  readonly pageSize: number
  readonly cursors: readonly string[]
  /** Result of the "Compter" button — absent until someone asks (§1.1). */
  readonly total: number | null
  readonly totalCapped: boolean
  /**
   * The quick search of the toolbar — a text looked for in every text column. Joined to
   * the filter, never part of it: nothing saves it, and « Vue modifiée » ignores it.
   */
  readonly search: string
  /** The grid's rows grouped by this field, `null` for none (§1.6). */
  readonly groupBy: string | null
  /** The summary bar: one aggregate per column, by field name. */
  readonly summaries: Readonly<Record<string, string>>
  readonly rowHeight: RowHeight
  /** Rows take the colour of their choice in this list. */
  readonly colorField: string | null
  /** Rows matching a filter take a colour; the first rule that matches wins. */
  readonly colorRules: readonly ColorRule[]
  /** How a row coloured by the list shows it; each rule carries its own style. */
  readonly colorStyle: ColorStyle
  /**
   * The system columns shown — « Créé le », « Modifié par »… Hidden unless asked for, where
   * a field shows unless hidden: they are there on every table, and wanted on few.
   */
  readonly systemColumns: readonly string[]
}

export type RowHeight = 'short' | 'medium' | 'tall' | 'extra'

/** A row's height, in pixels, per setting: one line of text, two, four, six. */
export const ROW_HEIGHTS: Readonly<Record<RowHeight, number>> = {
  short: 36,
  medium: 56,
  tall: 92,
  extra: 132,
}

export interface ColorRule {
  readonly filter: string
  /** `#rrggbb`. */
  readonly color: string
  /** How a row this rule colours shows it. */
  readonly style: ColorStyle
}

/** A stripe at the row's left, a tinted background, or both (the default). */
export type ColorStyle = 'both' | 'stripe' | 'background'

export interface Tab {
  readonly id: string
  readonly kind: TabKind
  /** Base name — the schema, as one writes it in psql. */
  readonly base: string
  /** Table name, for a `table` tab. A `sql` tab carries none: it names its own. */
  readonly table: string | null
  readonly label: string
  readonly view: ViewState
  /** The statement being written, for a `sql` tab. */
  readonly draft: string
  /**
   * The saved view the tab shows (`_basedb.view_def`), `null` for the table's own grid —
   * "Toutes les lignes", which no one saved and every reader has.
   */
  readonly viewId: string | null
  /**
   * The overlay of that own grid, put aside while a saved view is shown: coming back to
   * it finds the columns as they were dragged, not reset.
   */
  readonly ownView: ViewState | null
}

/** A view with nothing set: every column, no sort, no filter, first page. */
export function emptyView(): ViewState {
  return {
    columnWidths: {},
    columnOrder: null,
    pinned: [],
    hidden: [],
    sorts: [],
    filter: '',
    pageSize: DEFAULT_PAGE_SIZE,
    cursors: [],
    total: null,
    totalCapped: false,
    search: '',
    groupBy: null,
    summaries: {},
    rowHeight: 'short',
    colorField: null,
    colorRules: [],
    colorStyle: 'both',
    systemColumns: [],
  }
}

interface WorkspaceState {
  readonly tabs: readonly Tab[]
  readonly activeId: string | null
  /** Rows selected in the active tab, by `_id`. Never persisted. */
  readonly checked: ReadonlySet<string>
  /** Cells selected in the active tab, keyed `rowId:fieldName`. Never persisted. */
  readonly cells: ReadonlySet<string>
  readonly copilotOpen: boolean
  /**
   * Moves when rows were written from OUTSIDE the grid — an import — so an open table
   * reloads instead of showing what it held before. Never persisted.
   */
  readonly reloadTick: number

  openTable: (table: Table, label: string) => string
  openSql: (base: string, table: string | null, label: string) => string
  activate: (id: string) => void
  close: (id: string) => void
  closeOthers: (id: string) => void
  closeToLeft: (id: string) => void
  closeToRight: (id: string) => void
  closeAll: () => void
  reorder: (fromId: string, toId: string) => void
  rename: (id: string, label: string) => void
  setDraft: (id: string, draft: string) => void
  patchView: (id: string, patch: Partial<ViewState>) => void
  /**
   * Shows another view in a tab: `view` is the overlay it opens with, `null` to find the
   * table's own grid as it was left. `draft` is the filter editor's text for it.
   */
  switchView: (id: string, viewId: string | null, view: ViewState | null, draft: string) => void
  setChecked: (next: ReadonlySet<string>) => void
  setCells: (next: ReadonlySet<string>) => void
  setCopilotOpen: (open: boolean) => void
  /** Drops every tab of a base — called when that base is deleted or renamed away. */
  dropBase: (base: string) => void
  /** Drops the tabs of one table — called when it is deleted: they would only fail to load. */
  dropTable: (base: string, table: string) => void
  /** Asks the open table to reload its rows. */
  reload: () => void
  /**
   * A row to open wherever it is — a notification's (chapter 16 §2): the page opens its
   * table, the workspace then the row, and clears the request.
   */
  pendingRecord: { readonly base: string; readonly table: string; readonly id: string } | null
  requestRecord: (target: { base: string; table: string; id: string } | null) => void
}

const STORAGE_KEY = 'basedb.workspace.v1'

/**
 * Restores what the previous visit left.
 *
 * Wrapped in a try: a corrupted or foreign value must produce an empty workspace, never
 * a screen that fails to mount. Selections are deliberately NOT restored — a row
 * selected yesterday is not a row anyone means to delete today.
 */
function restore(): { tabs: readonly Tab[]; activeId: string | null } {
  if (typeof window === 'undefined') return { tabs: [], activeId: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { tabs: [], activeId: null }
    const parsed = JSON.parse(raw) as { tabs?: unknown; activeId?: unknown }
    if (!Array.isArray(parsed.tabs)) return { tabs: [], activeId: null }
    const tabs = parsed.tabs
      .filter((t): t is Tab => typeof t === 'object' && t !== null && 'id' in t)
      .map((t) => ({
        ...t,
        view: { ...emptyView(), ...t.view },
        draft: t.draft ?? '',
        viewId: typeof t.viewId === 'string' ? t.viewId : null,
        // A tab saved before views existed has neither key.
        ownView:
          typeof t.ownView === 'object' && t.ownView !== null
            ? { ...emptyView(), ...t.ownView }
            : null,
      }))
    return {
      tabs,
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : (tabs[0]?.id ?? null),
    }
  } catch {
    return { tabs: [], activeId: null }
  }
}

function persist(tabs: readonly Tab[], activeId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId }))
  } catch {
    // A full or blocked storage is not a reason to break the screen: the overlay is a
    // convenience, and losing it costs a column width.
  }
}

let counter = 0
const nextId = () => `tab-${Date.now().toString(36)}-${(counter++).toString(36)}`

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  tabs: [],
  activeId: null,
  checked: new Set<string>(),
  cells: new Set<string>(),
  copilotOpen: false,
  reloadTick: 0,

  openTable: (table, label) => {
    // Opening a table already open ACTIVATES it rather than duplicating it: two tabs on
    // the same table would carry two divergent overlays of one thing.
    const existing = get().tabs.find(
      (t) => t.kind === 'table' && t.base === table.base && t.table === table.name,
    )
    if (existing !== undefined) {
      set({ activeId: existing.id, checked: new Set(), cells: new Set() })
      persist(get().tabs, existing.id)
      return existing.id
    }
    const tab: Tab = {
      id: nextId(),
      kind: 'table',
      base: table.base,
      table: table.name,
      label,
      view: emptyView(),
      draft: '',
      viewId: null,
      ownView: null,
    }
    const tabs = [...get().tabs, tab]
    set({ tabs, activeId: tab.id, checked: new Set(), cells: new Set() })
    persist(tabs, tab.id)
    return tab.id
  },

  openSql: (base, table, label) => {
    const tab: Tab = {
      id: nextId(),
      kind: 'sql',
      base,
      table,
      label,
      view: emptyView(),
      draft: '',
      viewId: null,
      ownView: null,
    }
    const tabs = [...get().tabs, tab]
    set({ tabs, activeId: tab.id, checked: new Set(), cells: new Set() })
    persist(tabs, tab.id)
    return tab.id
  },

  activate: (id) => {
    set({ activeId: id, checked: new Set(), cells: new Set() })
    persist(get().tabs, id)
  },

  close: (id) => {
    const { tabs, activeId } = get()
    const index = tabs.findIndex((t) => t.id === id)
    if (index === -1) return
    const next = tabs.filter((t) => t.id !== id)
    // Closing the active tab lands on its RIGHT neighbour, falling back to its left:
    // that is where the eye already is.
    const nextActive = activeId !== id ? activeId : (next[index]?.id ?? next[index - 1]?.id ?? null)
    set({ tabs: next, activeId: nextActive, checked: new Set(), cells: new Set() })
    persist(next, nextActive)
  },

  closeOthers: (id) => {
    const next = get().tabs.filter((t) => t.id === id)
    set({ tabs: next, activeId: id, checked: new Set(), cells: new Set() })
    persist(next, id)
  },

  closeToLeft: (id) => {
    const { tabs, activeId } = get()
    const index = tabs.findIndex((t) => t.id === id)
    if (index <= 0) return
    const next = tabs.slice(index)
    const nextActive = next.some((t) => t.id === activeId) ? activeId : id
    set({ tabs: next, activeId: nextActive, checked: new Set(), cells: new Set() })
    persist(next, nextActive)
  },

  closeToRight: (id) => {
    const { tabs, activeId } = get()
    const index = tabs.findIndex((t) => t.id === id)
    if (index === -1) return
    const next = tabs.slice(0, index + 1)
    const nextActive = next.some((t) => t.id === activeId) ? activeId : id
    set({ tabs: next, activeId: nextActive, checked: new Set(), cells: new Set() })
    persist(next, nextActive)
  },

  closeAll: () => {
    set({ tabs: [], activeId: null, checked: new Set(), cells: new Set() })
    persist([], null)
  },

  reorder: (fromId, toId) => {
    const tabs = [...get().tabs]
    const from = tabs.findIndex((t) => t.id === fromId)
    const to = tabs.findIndex((t) => t.id === toId)
    if (from === -1 || to === -1 || from === to) return
    const [moved] = tabs.splice(from, 1)
    if (moved === undefined) return
    tabs.splice(to, 0, moved)
    set({ tabs })
    persist(tabs, get().activeId)
  },

  rename: (id, label) => {
    const tabs = get().tabs.map((t) => (t.id === id ? { ...t, label } : t))
    set({ tabs })
    persist(tabs, get().activeId)
  },

  setDraft: (id, draft) => {
    const tabs = get().tabs.map((t) => (t.id === id ? { ...t, draft } : t))
    set({ tabs })
    persist(tabs, get().activeId)
  },

  patchView: (id, patch) => {
    const tabs = get().tabs.map((t) => (t.id === id ? { ...t, view: { ...t.view, ...patch } } : t))
    set({ tabs })
    persist(tabs, get().activeId)
  },

  switchView: (id, viewId, view, draft) => {
    const tabs = get().tabs.map((t) => {
      if (t.id !== id) return t
      // Leaving the table's own grid puts its overlay aside; coming back takes it out.
      const ownView = t.viewId === null ? t.view : t.ownView
      const next = view ?? (viewId === null ? (ownView ?? emptyView()) : emptyView())
      return { ...t, viewId, view: { ...next, cursors: [], total: null }, ownView, draft }
    })
    // The selection belonged to the rows of the view left behind.
    set({ tabs, checked: new Set(), cells: new Set() })
    persist(tabs, get().activeId)
  },

  setChecked: (next) => set({ checked: next }),
  setCells: (next) => set({ cells: next }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),

  dropBase: (base) => {
    const { tabs, activeId } = get()
    const next = tabs.filter((t) => t.base !== base)
    const nextActive = next.some((t) => t.id === activeId) ? activeId : (next[0]?.id ?? null)
    set({ tabs: next, activeId: nextActive, checked: new Set(), cells: new Set() })
    persist(next, nextActive)
  },

  dropTable: (base, table) => {
    const { tabs, activeId } = get()
    const next = tabs.filter((t) => !(t.base === base && t.table === table))
    const nextActive = next.some((t) => t.id === activeId) ? activeId : (next[0]?.id ?? null)
    set({ tabs: next, activeId: nextActive, checked: new Set(), cells: new Set() })
    persist(next, nextActive)
  },

  reload: () => set((s) => ({ reloadTick: s.reloadTick + 1 })),

  pendingRecord: null,
  requestRecord: (target) => set({ pendingRecord: target }),
}))

/**
 * Rehydrates from `localStorage` AFTER mount.
 *
 * Not in the initializer: Next.js renders this tree on the server, where `window` does
 * not exist, and seeding the store from storage at module scope would make the first
 * client render disagree with the server's.
 */
export function hydrateWorkspace(): void {
  const { tabs, activeId } = restore()
  if (tabs.length === 0) return
  useWorkspace.setState({ tabs, activeId })
}

/** The active tab, or null. A selector so components re-render on it alone. */
export function useActiveTab(): Tab | null {
  return useWorkspace((s) => s.tabs.find((t) => t.id === s.activeId) ?? null)
}

/**
 * Applies the overlay to the catalog's field list.
 *
 * Order of operations, and it matters: the saved order first — `field.position`, which
 * is what the catalog hands over —, then the local rearrangement, then the hiding, then
 * the pinning. Pinning LAST is what lets a pinned column keep its rank among the pinned
 * ones while jumping ahead of the rest.
 */
export function arrangeFields(
  fields: readonly Field[],
  view: ViewState,
): {
  readonly visible: readonly Field[]
  readonly hidden: readonly Field[]
  /** The system columns not shown — offered apart, since hiding them is the default. */
  readonly systemHidden: readonly Field[]
} {
  const byName = new Map(fields.map((f) => [f.name, f]))
  const hides = (f: Field) =>
    f.system === true ? !view.systemColumns.includes(f.name) : view.hidden.includes(f.name)

  const ordered =
    view.columnOrder === null
      ? fields
      : [
          ...view.columnOrder
            .map((name) => byName.get(name))
            .filter((f): f is Field => f !== undefined),
          // A column created since the order was recorded is appended rather than
          // dropped: an overlay must never hide a field the catalog now publishes.
          ...fields.filter((f) => !view.columnOrder?.includes(f.name)),
        ]

  const hidden = ordered.filter((f) => f.system !== true && hides(f))
  const systemHidden = ordered.filter((f) => f.system === true && hides(f))
  const shown = ordered.filter((f) => !hides(f))

  return {
    visible: [
      ...shown.filter((f) => view.pinned.includes(f.name)),
      ...shown.filter((f) => !view.pinned.includes(f.name)),
    ],
    hidden,
    systemHidden,
  }
}

/** The `?sort=` value the API expects: `field,-other`, in the order they were added. */
export function sortParameter(sorts: readonly SortTerm[]): string {
  return sorts.map((s) => (s.direction === 'desc' ? `-${s.field}` : s.field)).join(',')
}
