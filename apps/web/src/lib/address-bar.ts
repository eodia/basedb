/**
 * The address bar — what it says of the screen, and where an address leads.
 *
 * The screen is one page, but the address follows what it shows: a table, a saved view, a
 * row open in its panel, a dashboard, a section of a base, the settings. So a bookmark, a
 * link pasted in a message and the browser's back and forward buttons all land where the
 * address says — the place, not the state it was left in: filters, widths and sorts stay
 * the browser's own (chapter 11 §1.4), and an address carries none of them.
 *
 * A base and a table go by their NAME: it is what a person reads, and what a tab carries —
 * renamed, their tabs close and reopen under the new name (chapter 06 §2), and an address
 * of the old name then names nothing. A base's name is its schema's, `b_<tenant>_<base>`
 * (chapter 01 §5): the address writes the part after the tenant, which every base of the
 * instance shares, and reading it puts it back. What has no name of its own — a view, a
 * dashboard, a saved query — goes by its identifier.
 *
 * Everything sits under a word of its own (`/bases/…`, `/parametres/…`): a base may be
 * called `v`, `api` or `mcp`, which already lead elsewhere at the root. The words are
 * French, as the settings' already were (`/?parametres=profil`, chapter 11 §10).
 *
 *   /bases/<base>                               the base: the tab open on it, else its first table
 *   /bases/<base>/tables/<table>[?vue=…&ligne=…] a table, a saved view of it, a row in the panel
 *   /bases/<base>/vues-sql/<id>                 a SQL view
 *   /bases/<base>/requetes/<id>                 a saved query
 *   /bases/<base>/questions/<id>                a saved question, in a tab
 *   /bases/<base>/tableaux-de-bord[/<id>]       the dashboards, one of them
 *   /bases/<base>/tableaux-de-bord/questions/<id>  a question, beside the dashboards
 *   /bases/<base>/automatisations[/<id>]        the automations, one of them
 *   /bases/<base>/structure | historique | integrations | documentation
 *   /projets/<id>                               a project with no base yet
 *   /administration/<tab>                       the administration
 *   /parametres/<tab>                           the settings
 */

/** The sections of a base that show one screen, whatever else is open. */
export type BaseSection = 'structure' | 'history' | 'integrations' | 'doc'

/** What the dashboards section shows: a dashboard, or a saved question beside them. */
export interface DashboardFocus {
  readonly kind: 'dashboard' | 'question'
  readonly id: string
}

export type Place =
  | { readonly kind: 'home' }
  | { readonly kind: 'project'; readonly project: string }
  | { readonly kind: 'base'; readonly base: string }
  | {
      readonly kind: 'table'
      readonly base: string
      readonly table: string
      /** A saved view of the table, `null` for its own grid — « Toutes les lignes ». */
      readonly view: string | null
      /** The row open in the panel. */
      readonly record: string | null
    }
  | { readonly kind: 'sqlview' | 'query' | 'question'; readonly base: string; readonly id: string }
  | { readonly kind: 'section'; readonly base: string; readonly section: BaseSection }
  | { readonly kind: 'dashboards'; readonly base: string; readonly focus: DashboardFocus | null }
  | { readonly kind: 'automations'; readonly base: string; readonly automation: string | null }
  /** `tab`: the slug of a tab, as the panel names it — `null` for its first. */
  | { readonly kind: 'admin'; readonly tab: string | null }
  | { readonly kind: 'settings'; readonly tab: string | null }

const SECTION_WORDS: Readonly<Record<BaseSection, string>> = {
  structure: 'structure',
  history: 'historique',
  integrations: 'integrations',
  doc: 'documentation',
}

const TAB_WORDS = { sqlview: 'vues-sql', query: 'requetes', question: 'questions' } as const

const path = (...parts: readonly string[]): string =>
  `/${parts.map((part) => encodeURIComponent(part)).join('/')}`

/** `b_` + the tenant, 't' and six characters, + `_` (chapter 01 §5). */
const TENANT_PREFIX = /^b_t[23456789abcdefghijkmnpqrstuvwxyz]{6}_(?=.)/

/** A base's name as an address writes it: without the tenant every base shares. */
const baseWord = (name: string): string => name.replace(TENANT_PREFIX, '')

/** The address of a place: a path, and for a table its view and its row. */
export function addressOf(place: Place): string {
  if (place.kind === 'home') return '/'
  if (place.kind === 'project') return path('projets', place.project)
  if (place.kind === 'admin' || place.kind === 'settings') {
    const word = place.kind === 'admin' ? 'administration' : 'parametres'
    return place.tab === null ? path(word) : path(word, place.tab)
  }
  const base = baseWord(place.base)
  switch (place.kind) {
    case 'base':
      return path('bases', base)
    case 'table': {
      const params = new URLSearchParams()
      if (place.view !== null) params.set('vue', place.view)
      if (place.record !== null) params.set('ligne', place.record)
      const query = params.toString()
      return `${path('bases', base, 'tables', place.table)}${query === '' ? '' : `?${query}`}`
    }
    case 'sqlview':
    case 'query':
    case 'question':
      return path('bases', base, TAB_WORDS[place.kind], place.id)
    case 'section':
      return path('bases', base, SECTION_WORDS[place.section])
    case 'dashboards':
      return place.focus === null
        ? path('bases', base, 'tableaux-de-bord')
        : place.focus.kind === 'dashboard'
          ? path('bases', base, 'tableaux-de-bord', place.focus.id)
          : path('bases', base, 'tableaux-de-bord', 'questions', place.focus.id)
    case 'automations':
      return place.automation === null
        ? path('bases', base, 'automatisations')
        : path('bases', base, 'automatisations', place.automation)
  }
}

/** The path's segments, decoded — `null` when one cannot be. */
function segments(pathname: string): readonly string[] | null {
  try {
    return pathname
      .split('/')
      .filter((part) => part !== '')
      .map((part) => decodeURIComponent(part))
  } catch {
    return null
  }
}

/**
 * Where an address leads — `null` when it names nothing: a typo, or an address of a later
 * version. `/` is `home`: the screen then chooses, as it always has. `tenant`: the one of
 * the person signed in, whose bases the address names.
 */
export function placeOf(pathname: string, search: string, tenant: string): Place | null {
  const parts = segments(pathname)
  if (parts === null) return null
  const [head, ...rest] = parts
  if (head === undefined) return { kind: 'home' }
  if (head === 'bases') {
    const [base, ...inside] = rest
    if (base === undefined) return null
    return basePlace(`b_${tenant}_${base}`, inside, new URLSearchParams(search))
  }
  if (head === 'projets') {
    const [project, ...more] = rest
    return project === undefined || more.length > 0 ? null : { kind: 'project', project }
  }
  if (head === 'administration' || head === 'parametres') {
    if (rest.length > 1) return null
    const tab = rest[0] ?? null
    return head === 'administration' ? { kind: 'admin', tab } : { kind: 'settings', tab }
  }
  return null
}

function basePlace(base: string, parts: readonly string[], params: URLSearchParams): Place | null {
  const [word, id, ...more] = parts
  if (word === undefined) return { kind: 'base', base }
  if (word === 'tableaux-de-bord') {
    if (id === undefined) return { kind: 'dashboards', base, focus: null }
    if (id === 'questions') {
      const [question, ...after] = more
      if (question === undefined || after.length > 0) return null
      return { kind: 'dashboards', base, focus: { kind: 'question', id: question } }
    }
    return more.length > 0 ? null : { kind: 'dashboards', base, focus: { kind: 'dashboard', id } }
  }
  if (more.length > 0) return null
  if (word === 'automatisations') return { kind: 'automations', base, automation: id ?? null }
  const section = (Object.keys(SECTION_WORDS) as BaseSection[]).find(
    (s) => SECTION_WORDS[s] === word,
  )
  if (section !== undefined) return id === undefined ? { kind: 'section', base, section } : null
  if (id === undefined) return null
  if (word === 'tables') {
    return {
      kind: 'table',
      base,
      table: id,
      view: params.get('vue') || null,
      record: params.get('ligne') || null,
    }
  }
  const kind = (Object.keys(TAB_WORDS) as Array<keyof typeof TAB_WORDS>).find(
    (k) => TAB_WORDS[k] === word,
  )
  return kind === undefined ? null : { kind, base, id }
}
