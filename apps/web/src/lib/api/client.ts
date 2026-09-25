/**
 * The ONLY network access point of `apps/web` (chapter 10 §1.5).
 *
 * No `fetch` anywhere else in the application: centralizing access is what makes the
 * absence of a parallel path to the database verifiable, and what will allow adding
 * authentication in one single place the day chapter 13 is written.
 *
 * URL plan of chapter 08 §1.4: `/api/v1/{tenantRef}`, then `/data/`, `/meta/` or
 * `/admin/`. Tables are addressed by their LOGICAL NAME — the same name one writes in
 * psql — and never by an identifier the user would have to look up.
 */

declare global {
  interface Window {
    __BASEDB_API__?: string
    __BASEDB_MCP__?: string
  }
}

/**
 * The MCP entry point's address, for the configuration an agent's client needs — handed
 * over by the layout like the API's, else the port `scripts/start.mjs` prefers.
 */
export function mcpEndpoint(): string {
  const given = typeof window === 'undefined' ? undefined : window.__BASEDB_MCP__
  return given !== undefined && given !== '' ? given : 'http://localhost:8788/mcp'
}

/**
 * API address.
 *
 * RUNTIME first — the value the layout handed over —, then the build-time variable for
 * server rendering. The order matters: a value inlined at build time may date from a
 * compilation performed without the variable.
 */
const BASE =
  (typeof window === 'undefined' ? undefined : window.__BASEDB_API__) ??
  process.env.BASEDB_API ??
  'http://localhost:8787'

/**
 * The session, held IN MEMORY and nowhere else.
 *
 * Not in `localStorage`: a value a script can read is a value an injected script can
 * exfiltrate, and these two are the whole credential. The session cookie is `HttpOnly`,
 * so it is not here at all — the browser sends it, and this code never sees it.
 *
 * Losing them on a reload is not a bug: the cookie survives, and one call to
 * `/auth/session/access` mints a new access token.
 */
let tenant = ''
let access: { token: string; expiresAt: number } | null = null

/** The name the API plants it under — readable, unlike the session cookie. */
const CSRF_COOKIE = '__Host-basedb_csrf'

/**
 * Reads the CSRF token from its cookie.
 *
 * Read on each use rather than kept in a variable: it survives a reload this way, and a
 * login in another tab replaces it without this one noticing anything.
 */
function csrfToken(): string {
  if (typeof document === 'undefined') return ''
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === CSRF_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return ''
}

const v1 = () => `/api/v1/${tenant}`

/**
 * The absolute root of this tenant's routes — what a program outside the interface calls,
 * as the token dialog writes it into an example.
 */
export function restRoot(): string {
  return `${BASE}${v1()}`
}

/** Chapter 13 §4.2: renewed before the end, never used up to it. */
const RENEW_BEFORE_MS = 60_000

/**
 * Returns a live access token, minting one against the cookie when needed.
 *
 * This is the only place that speaks to `/auth/session/access`, and the only place that
 * sends the CSRF header — which is what makes that route unreachable from a foreign
 * page.
 */
async function accessToken(): Promise<string> {
  if (access !== null && access.expiresAt - Date.now() > RENEW_BEFORE_MS) return access.token

  const r = await fetch(`${BASE}/auth/session/access`, {
    method: 'POST',
    headers: { 'x-basedb-csrf': csrfToken() },
    credentials: 'include',
    cache: 'no-store',
  })
  if (!r.ok) {
    access = null
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>
    throw new ApiError(String(body.code ?? 'AUTHENTICATION_REQUIRED'), r.status, '')
  }

  const body = (await r.json()) as { data: { token: string; expires_at: string } }
  access = { token: body.data.token, expiresAt: Date.parse(body.data.expires_at) }
  return access.token
}

/** True when a session seems to be open — the cookie may still say otherwise. */
export function forget(): void {
  tenant = ''
  access = null
}

/** API error, carrying the code from the shared registry. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly requestId: string
  /**
   * What the refusal carries beyond its code.
   *
   * The API serializes `details` for every business error, and most of the time the
   * screen ignores it — the code already says enough. The SQL console is the exception:
   * PostgreSQL's own message and the character it pointed at arrive here, and they are
   * the answer the person is waiting for.
   */
  readonly details: Readonly<Record<string, unknown>>

  constructor(
    code: string,
    status: number,
    requestId: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.details = details
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  // `/auth/*` and `/healthz` carry the cookie; everything else carries a Bearer token.
  const authenticated = path.startsWith('/api/v1/') && !path.startsWith('/api/v1/dev/')

  const send = async (bearer?: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` }),
        ...init?.headers,
      },
      credentials: 'include',
      cache: 'no-store',
    })

  let r = await (authenticated ? send(await accessToken()) : send())

  // One retry on a 401: the token may have been invalidated between minting and use —
  // a password change, a revocation, a server restart. A second failure is a real one.
  if (r.status === 401 && authenticated) {
    access = null
    r = await send(await accessToken())
  }

  if (r.status === 204) return undefined as T

  const body = (await r.json()) as Record<string, unknown>
  if (!r.ok) {
    throw new ApiError(
      String(body.code ?? 'INTERNAL_ERROR'),
      r.status,
      String(body.request_id ?? ''),
      typeof body.details === 'object' && body.details !== null
        ? (body.details as Record<string, unknown>)
        : {},
    )
  }
  return body as T
}

/** Unwraps the `{data: …}` envelope every catalog and data route uses. */
async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await call<{ data: T }>(path, init)
  return body.data
}

/** The project a base belongs to — a grouping with no physical existence (ch. 05 §15). */
export interface ProjectRef {
  readonly id: string
  readonly label: string
}

/**
 * The verbs of chapter 05 §1.3, as the catalog projection lists them on a table, a base
 * or a project. `manage_schema` on a project lets a base be added to it; on a base, a table.
 */
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'manage_schema'
  | 'manage_tokens'
  | 'manage_permissions'

/**
 * How a base or a table looks — the same three keys as a choice of a list: a colour, and a
 * pictogram or a picture. Catalog only; the keys are always present, `null` when unset.
 */
export interface Look {
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
}

/** A base of a project, as the navigation lists it. */
export interface ProjectBase extends Look {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly actions: readonly Action[]
  readonly tables: ReadonlyArray<
    {
      readonly id: string
      readonly name: string
      readonly label: string
      readonly actions: readonly Action[]
    } & Look
  >
}

/** A project as the navigation shows it: the bases and tables the caller can see in it. */
export interface Project {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly actions: readonly Action[]
  readonly bases: readonly ProjectBase[]
}

/** Who is signed in, and what the screen must know about them before drawing anything. */
export interface Me {
  readonly email: string
  readonly displayName: string
  readonly tenant: string
  /** Member of the Administrators: sees the administration and every project. */
  readonly isAdmin: boolean
  /** Signed in with a temporary password an administrator handed over. */
  readonly mustChangePassword: boolean
}

/** A person, as the administration lists them. */
export interface AdminUser {
  readonly id: string
  readonly email: string
  readonly display_name: string
  readonly is_admin: boolean
  readonly disabled: boolean
  readonly must_change_password: boolean
  readonly created_at: string
  readonly last_seen_at: string | null
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** A group of people — what permissions are granted to (ch. 05 §15). */
export interface Group {
  readonly id: string
  readonly label: string
  /** `admins` and `everyone` are the two groups every tenant has; `null` otherwise. */
  readonly system: 'admins' | 'everyone' | null
  readonly member_count: number
}

/** The four levels of the permission grid — Metabase's, over projects, bases, tables. */
export type AccessLevel = 'none' | 'read' | 'edit' | 'manage'

export interface AccessCell {
  /** `granular` when the node's children do not all have what the node itself has. */
  readonly level: AccessLevel | 'granular'
  /** True when granted ON this node rather than inherited from above. */
  readonly direct: boolean
}

export interface AccessGraph {
  readonly groups: readonly Group[]
  readonly projects: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly bases: ReadonlyArray<{
      readonly id: string
      readonly name: string
      readonly label: string
      readonly tables: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly label: string
      }>
    }>
  }>
  /** Group → `project:<id>` / `base:<id>` / `table:<id>` → cell. */
  readonly cells: Readonly<Record<string, Readonly<Record<string, AccessCell>>>>
}

export interface AccessChange {
  readonly group: string
  readonly scope: { readonly kind: 'project' | 'base' | 'table'; readonly id: string }
  readonly level: AccessLevel
}

export interface Base extends Look {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly project: ProjectRef
  /**
   * What this base is FOR, in the author's words — plain text, `null` when never written.
   *
   * The same sentence feeds the generated documentation and the agents reading the
   * catalog, which is why the screens that design a base, a table or a field ask for it.
   */
  readonly description: string | null
  readonly table_count: number
}

/**
 * One choice of a `select`, and how it looks.
 *
 * The look — a colour of any hue, and either a pictogram or a picture — belongs to the
 * catalog alone: the column stores the `value`, and nothing about how it is dressed. The
 * keys are always there and `null` when unset.
 */
export interface FieldOption {
  readonly value: string
  readonly label: string
  /** `#rrggbb`. */
  readonly color: string | null
  /** The name of a pictogram of the interface's library, in kebab case. */
  readonly icon: string | null
  /** An `https` URL or a `data:image/…` URL. Exclusive with `icon`. */
  readonly image: string | null
}

/** What the API takes for a choice: only `value` is required, keys are sent when set. */
export interface FieldOptionInput {
  readonly value: string
  readonly label?: string
  readonly color?: string | null
  readonly icon?: string | null
  readonly image?: string | null
}

/**
 * One file of a `file` or `image` field, as a read returns it.
 *
 * Name, type and size come from the catalog, never from whoever wrote the row. `url` is
 * a signed link RELATIVE to the API, valid a few hours: it is what an `<img src>` uses,
 * since it needs no `Authorization` header — pass it through `fileHref` first.
 */
export interface StoredFile {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly size: number
  readonly url?: string
}

/** The absolute address of a file's link, on the API's origin. */
export function fileHref(url: string, download = false): string {
  const absolute = /^https?:\/\//.test(url) ? url : `${BASE}${url}`
  return download ? `${absolute}${absolute.includes('?') ? '&' : '?'}download=1` : absolute
}

/** The files a cell holds, whatever the wire brought: anything else reads as none. */
export function filesOf(value: unknown): readonly StoredFile[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is StoredFile => typeof v === 'object' && v !== null && typeof v.id === 'string',
  )
}

export interface Field {
  readonly id?: string
  readonly label: string
  readonly name: string
  /** Plain text, `null` when never written. System columns carry a fixed one. */
  readonly description: string | null
  /** The type comes from the CATALOG: converting an input is never guessed. */
  readonly kind: string
  readonly required?: boolean
  readonly read_only?: boolean
  readonly system?: boolean
  /**
   * The operators this field accepts, read from the catalog (ch. 11 §1.3).
   *
   * The screen offers exactly these and never invents one: the normative table lives in
   * the kernel, and a copy kept here would drift the day a type gains an operator.
   */
  readonly operators?: readonly string[]
  readonly sortable?: boolean
  /** The choices of a `select`, which the database itself holds the column to. */
  readonly options?: readonly FieldOption[]
  readonly link?: {
    readonly target?: string
    readonly target_display_field?: string | null
    readonly expandable: boolean
    readonly masked: boolean
    readonly on_delete: string
  }
}

/** What is needed to address a table: its base and its own name. */
export interface TableRef {
  readonly base: string
  readonly name: string
}

export interface Table extends TableRef, Look {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly sql: string
  readonly actions: readonly string[]
  readonly referenced_by: boolean
  /** The column shown instead of an identifier when this table is a link target. */
  readonly display_field: string | null
  readonly fields: readonly Field[]
}

export interface DescribedBase extends Look {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly project: ProjectRef
  /** The verbs held on the base itself: `manage_schema` lets a table be added to it. */
  readonly actions: readonly Action[]
  readonly tables: readonly Table[]
}

/**
 * The longest description the API accepts, in characters.
 *
 * The server is the judge (`TEXT_TOO_LONG`); this copy only lets a form warn BEFORE the
 * round trip, and a drift between the two costs one refusal, never a corrupted value.
 */
export const DESCRIPTION_MAX = 1000

/**
 * One page of the readable documentation — what the viewer lists in its navigation.
 *
 * `title` is ESCAPED, like the Markdown: it comes from a label somebody typed, and the
 * generator neutralizes it for viewers that interpret HTML. The viewer undoes that with
 * `unescapeText` before showing it.
 */
export interface DocSection {
  readonly id: string
  readonly title: string
  /** The navigation group, in order of first appearance. */
  readonly group: string
  readonly markdown: string
}

export interface ApiDocumentation {
  readonly title: string
  readonly sections: readonly DocSection[]
}

export interface Page {
  readonly data: ReadonlyArray<Record<string, unknown>>
  readonly included: Readonly<Record<string, Record<string, Record<string, unknown>>>>
  readonly meta: {
    readonly columns: readonly string[]
    readonly sql: string
    readonly has_next_page: boolean
    /** Opaque; the only way to the next page. There is no jump to page N (ch. 11 §1.2). */
    readonly next_cursor: string | null
    /** Only present when `count=exact` was asked for. */
    readonly count: number | null
    readonly count_is_capped: boolean
  }
}

/** A migration, as the structure screen reads it. */
export interface Migration {
  readonly id: string
  readonly sequence: number | null
  readonly label: string
  readonly origin: string
  readonly status: string
  readonly step: number | null
  readonly step_count: number | null
  readonly step_label: string | null
  readonly error_code: string | null
  readonly failed_statement: string | null
  readonly requested_at: string
  readonly finished_at: string | null
  readonly duration_ms: number | null
}

/** A base the tenant deleted logically, and can bring back (ch. 06 §6). */
/** Where an integration token is accepted: the REST API, the MCP server, or both. */
export type TokenSurface = 'rest' | 'mcp'

/** An integration token as the administration shows it: never its secret. */
export interface ApiToken {
  readonly id: string
  readonly label: string
  /** The eight characters after `bdb_`, enough to recognize a token. */
  readonly prefix: string
  readonly base_id: string | null
  readonly access: 'read' | 'write'
  readonly surfaces: readonly string[]
  readonly created_at: string
  /** `null`: no expiry — the token lives until it is revoked. */
  readonly expires_at: string | null
  readonly last_used_at: string | null
  readonly revoked_at: string | null
  readonly suspended_at: string | null
}

export interface DeletedBase {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly deleted_at: string
  readonly table_count: number
}

/** One block of the inverse-link summary — chapter 04 §6. */
export interface ReferencedBlock {
  readonly label: string
  readonly table: string
  readonly field: string
  readonly count: number
  readonly capped: boolean
  readonly rows: ReadonlyArray<{ id: string; display: string | null }>
}

/** A row offered by a link cell. The screen never asks anyone to type a UUID. */
export interface LinkOption {
  readonly id: string
  readonly display: string
}

/** What narrows a page: filter expression and sort, exactly as the API receives them. */
export interface View {
  readonly filter?: string
  readonly sort?: string
  readonly expand?: string
  readonly limit?: number
  /** Cursor of the previous page. Absent means the first page. */
  readonly after?: string
  /** `true` emits `count=exact`. Off by default, and deliberately so (ch. 11 §1.1). */
  readonly count?: boolean
}

const path = (t: TableRef) => `${v1()}/data/${t.base}/${t.name}`

export const api = {
  health: () => call<{ status: string }>('/healthz'),

  /**
   * The bootstrapped administrator's ADDRESS, when the server publishes one.
   *
   * Returns `null` rather than throwing: on an instance that was not bootstrapped the
   * route does not exist, and that is not a failure — the address is simply typed.
   */
  developmentAccount: async (): Promise<{ email: string } | null> => {
    try {
      return await call<{ email: string }>('/api/v1/dev/account')
    } catch {
      return null
    }
  },

  /** Providers this instance accepts. Empty means password only. */
  oidcProviders: () => data<ReadonlyArray<{ slug: string; label: string }>>('/auth/oidc/providers'),

  /**
   * Where to SEND THE BROWSER to start an exchange.
   *
   * A full-page navigation, not a fetch: the route answers with a redirect to the
   * provider, and a redirect followed by `fetch` would land the provider's login page
   * inside a response body nobody can see.
   */
  oidcStartUrl: (slug: string) => `${BASE}/auth/oidc/${encodeURIComponent(slug)}/start?return_to=/`,

  /**
   * Opens a session.
   *
   * Both cookies are planted by the browser. The CSRF token also comes back in the body,
   * but this code reads it from its cookie instead — that is the copy which survives a
   * reload.
   */
  login: async (email: string, password: string): Promise<void> => {
    const body = await call<{ data: { tenant: string } }>('/auth/password/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    tenant = body.data.tenant
    access = null
  },

  /** Re-opens a session left by a previous page load, from the cookie alone. */
  resume: async (): Promise<Me | null> => {
    try {
      const body = await call<{
        data: {
          email: string
          display_name: string
          tenant: string
          is_admin?: boolean
          must_change_password?: boolean
        }
      }>('/auth/me')
      tenant = body.data.tenant
      return {
        email: body.data.email,
        displayName: body.data.display_name,
        tenant: body.data.tenant,
        isAdmin: body.data.is_admin === true,
        mustChangePassword: body.data.must_change_password === true,
      }
    } catch {
      return null
    }
  },

  /**
   * Changes the password, and comes back SIGNED IN.
   *
   * Every other session of this user is closed by the server — that is usually the
   * reason one changes a password — and a fresh cookie is planted for this one. Being
   * signed out for having done the safe thing is how people stop doing it.
   */
  changePassword: (current: string, next: string) =>
    call<void>('/auth/password/change', {
      method: 'POST',
      headers: { 'x-basedb-csrf': csrfToken() },
      body: JSON.stringify({ current, next }),
    }),

  sessions: () =>
    data<
      ReadonlyArray<{
        id: string
        created_at: string
        last_seen_at: string
        ip: string | null
        user_agent: string | null
        current: boolean
      }>
    >('/auth/sessions'),

  revokeSession: (id: string) =>
    call<void>(`/auth/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-basedb-csrf': csrfToken() },
    }),

  revokeOtherSessions: () =>
    call<void>('/auth/sessions', {
      method: 'DELETE',
      headers: { 'x-basedb-csrf': csrfToken() },
    }),

  /**
   * Proves the password again — five minutes during which integration tokens may be
   * minted or revoked (chapter 05 §2.2).
   *
   * The session token ROTATES with it, which kills the access token held here: the next
   * call mints a fresh one against the new cookie.
   */
  elevate: async (password: string): Promise<{ elevatedUntil: number }> => {
    const body = await call<{ data: { elevated_until: string } }>('/auth/elevate', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    access = null
    return { elevatedUntil: Date.parse(body.data.elevated_until) }
  },

  /** A base's integration tokens — metadata and prefix, never a secret (chapter 08 §11). */
  tokens: (base: string) =>
    data<readonly ApiToken[]>(`${v1()}/admin/tokens?base=${encodeURIComponent(base)}`),

  /** Mints a token for the agent surface. The secret is in this answer and nowhere else. */
  createToken: (request: {
    readonly base: string
    readonly label: string
    readonly access: 'read' | 'write'
    readonly surfaces: readonly TokenSurface[]
    /** 1 to 365 days, or `null`: no expiry. */
    readonly expiresInDays: number | null
  }) =>
    data<ApiToken & { readonly secret: string }>(`${v1()}/admin/tokens`, {
      method: 'POST',
      body: JSON.stringify({
        base: request.base,
        label: request.label,
        access: request.access,
        surfaces: request.surfaces,
        expires_in_days: request.expiresInDays,
      }),
    }),

  revokeToken: (id: string) =>
    call<void>(`${v1()}/admin/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  logout: async (): Promise<void> => {
    try {
      await call<void>('/auth/session', { method: 'DELETE' })
    } finally {
      forget()
    }
  },

  /** The bases the caller can see. A base with no readable table is simply absent. */
  bases: () => data<readonly Base[]>(`${v1()}/meta/bases`),

  /** The projected description of a base: tables, fields, types, links. */
  describeBase: (base: string) =>
    data<DescribedBase>(`${v1()}/meta/bases/${encodeURIComponent(base)}`),

  /** The readable documentation of the same projection — third serialization (§9.4). */
  documentation: (base: string) =>
    data<ApiDocumentation>(`${v1()}/meta/bases/${encodeURIComponent(base)}/doc`),

  /**
   * The OpenAPI 3.1 serialization. Returned whole — it is a contract, not a view.
   *
   * Fetched rather than linked: the route wants the Bearer token, which lives in memory,
   * so a link opened in a new tab would only ever meet a 401.
   */
  openApi: (base: string) =>
    call<Record<string, unknown>>(`${v1()}/meta/bases/${encodeURIComponent(base)}/openapi.json`),

  /** The projects the caller can see, each with its visible bases and tables. */
  projects: () => data<readonly Project[]>(`${v1()}/meta/projects`),

  createProject: (label: string, description?: string) =>
    data<{ id: string; label: string; description: string | null }>(`${v1()}/admin/projects`, {
      method: 'POST',
      body: JSON.stringify({ label, description }),
    }),

  /** What is absent stays as it was; a `null` description clears it. */
  updateProject: (id: string, patch: { label?: string; description?: string | null }) =>
    data<{ label: string; description: string | null }>(
      `${v1()}/admin/projects/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** Refused with `PROJECT_NOT_EMPTY` while a base is still in it. */
  deleteProject: (id: string) =>
    call<void>(`${v1()}/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Every `description` below is optional and travels only when given: `JSON.stringify`
  // drops an `undefined`, and the server reads a missing one as "none".
  createBase: (label: string, description?: string, project?: string) =>
    data<{ id: string; name: string; description: string | null; project: string }>(
      `${v1()}/admin/bases`,
      { method: 'POST', body: JSON.stringify({ label, description, project }) },
    ),

  createTable: (
    base: string,
    label: string,
    fields: ReadonlyArray<{
      label: string
      kind: string
      required?: boolean
      description?: string
    }>,
    description?: string,
  ) =>
    data<{
      id: string
      name: string
      base: string
      sql: string
      description: string | null
      fields: readonly Field[]
    }>(`${v1()}/admin/bases/${base}/tables`, {
      method: 'POST',
      body: JSON.stringify({ label, description, fields }),
    }),

  /**
   * Adds a column to an existing table.
   *
   * ALWAYS nullable — the obligation is `setFieldRequired`, and it is a separate call
   * because it is a separate, four-step operation on the database.
   */
  addField: (
    table: TableRef,
    field: {
      label: string
      kind: string
      description?: string
      options?: readonly FieldOptionInput[]
    },
  ) =>
    data<{ id: string; name: string; label: string; kind: string; description: string | null }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields`,
      { method: 'POST', body: JSON.stringify(field) },
    ),

  /**
   * Deposits a file for a `file` or `image` field. The body is the file itself; the
   * identifier returned is then written into the row, which is what attaches it.
   */
  uploadFile: (table: TableRef, field: string, file: File) =>
    data<StoredFile>(
      `${v1()}/files/${table.base}/${table.name}/${field}?name=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        body: file,
        headers: { 'content-type': file.type === '' ? 'application/octet-stream' : file.type },
      },
    ),

  /** Rewrites a field's description. `null` — or an empty text — clears it. */
  setFieldDescription: (table: TableRef, field: string, description: string | null) =>
    data<{ name: string; description: string | null }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}`,
      { method: 'PATCH', body: JSON.stringify({ description }) },
    ),

  /**
   * Renames a field: its LABEL. The column keeps its physical name, so a script written
   * against it in SQL keeps working.
   */
  setFieldLabel: (table: TableRef, field: string, label: string) =>
    data<{ name: string; label: string }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}`,
      { method: 'PATCH', body: JSON.stringify({ label }) },
    ),

  /**
   * Replaces the choices of a `select`, as a whole and in order.
   *
   * Values already there are re-dressed, new ones added, absent ones removed — refused
   * with `OPTION_IN_USE` while rows still carry them.
   */
  setFieldOptions: (table: TableRef, field: string, options: readonly FieldOptionInput[]) =>
    data<{ options: readonly FieldOption[]; added: readonly string[]; removed: readonly string[] }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}/options`,
      { method: 'PUT', body: JSON.stringify({ options }) },
    ),

  setFieldRequired: (table: TableRef, field: string, required: boolean) =>
    data<{ required: boolean }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}/required`,
      { method: 'POST', body: JSON.stringify({ required }) },
    ),

  createTableIn: (base: string, label: string, description?: string) =>
    data<{ id: string; name: string; description: string | null }>(
      `${v1()}/admin/bases/${base}/tables`,
      {
        method: 'POST',
        body: JSON.stringify({
          label,
          description,
          fields: [{ label: 'Nom', kind: 'short_text' }],
        }),
      },
    ),

  /** Rewrites a table's description. `null` — or an empty text — clears it. */
  setTableDescription: (table: TableRef, description: string | null) =>
    data<{ name: string; description: string | null }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}`,
      { method: 'PATCH', body: JSON.stringify({ description }) },
    ),

  /**
   * Renames a table — its LABEL, the relation keeps its name —, rewrites its description,
   * and/or changes its look. The look travels whole: naming any of its three keys replaces
   * all three.
   */
  updateTable: (
    table: TableRef,
    patch: { label?: string; description?: string | null } & Partial<Look>,
  ) =>
    data<{ name: string; label?: string; description?: string | null } & Partial<Look>>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  createLink: (table: TableRef, label: string, target: string, description?: string) =>
    data<Field & { target: string }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/links`,
      { method: 'POST', body: JSON.stringify({ label, target, description }) },
    ),

  /** Designates the column read instead of the identifier in link cells. */
  setDisplayColumn: (table: TableRef, field: string | null) =>
    data<{ field: string | null; name: string | null }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/display`,
      { method: 'POST', body: JSON.stringify({ field }) },
    ),

  list: (table: TableRef, view: View = {}) => {
    // `URLSearchParams` does the encoding itself: the filter grammar contains spaces
    // and quotes, which no hand-rolled escaping should touch.
    const q = new URLSearchParams()
    if (view.filter !== undefined && view.filter.trim() !== '') q.set('filter', view.filter)
    if (view.sort !== undefined && view.sort !== '') q.set('sort', view.sort)
    if (view.expand !== undefined && view.expand !== '') q.set('expand', view.expand)
    if (view.limit !== undefined) q.set('limit', String(view.limit))
    if (view.after !== undefined && view.after !== '') q.set('after', view.after)
    if (view.count === true) q.set('count', 'exact')
    return call<Page>(`${path(table)}?${q}`)
  },

  /**
   * Changes a base's LABEL and/or its description — what is absent stays as it was.
   *
   * Not a migration: the schema keeps its name (ch. 06 §1.1). An ABSENT description is
   * left alone and a `null` one clears it — callers must not conflate the two.
   */
  updateBase: (
    base: string,
    patch: { label?: string; description?: string | null } & Partial<Look>,
  ) =>
    data<{ id: string; name: string; label: string; description: string | null } & Look>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** Deletes a base logically. Returns the migration, which may have failed on a step. */
  deleteBase: (base: string) =>
    data<Migration>(`${v1()}/admin/bases/${encodeURIComponent(base)}`, { method: 'DELETE' }),

  /**
   * What deleting a table would do, without doing it.
   *
   * Asked BEFORE the confirmation is shown: chapter 06 §4.2 wants the screen to name the
   * tables the step will briefly lock, and someone deciding needs that before clicking.
   */
  tableDeletionPreview: (table: TableRef) =>
    data<{
      label: string
      row_count: number | null
      referenced_by: readonly string[]
      locked_tables: readonly string[]
      relegated_name: string
    }>(`${v1()}/admin/bases/${table.base}/tables/${table.name}/deletion`),

  /** Deletes one table logically. Its rows stay, readable in SQL under the new name. */
  deleteTable: (table: TableRef) =>
    data<Migration>(`${v1()}/admin/bases/${table.base}/tables/${table.name}`, {
      method: 'DELETE',
    }),

  restoreBase: (base: string) =>
    data<Migration>(`${v1()}/admin/bases/${encodeURIComponent(base)}/restore`, { method: 'POST' }),

  /** Empty for anyone without the administration role — an absence, not a refusal. */
  deletedBases: () => data<readonly DeletedBase[]>(`${v1()}/admin/bases/deleted`),

  migrations: (base: string) =>
    data<readonly Migration[]>(`${v1()}/admin/bases/${encodeURIComponent(base)}/migrations`),

  resumeMigration: (id: string) =>
    data<Migration>(`${v1()}/admin/migrations/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
    }),

  createRecord: (table: TableRef, values: Record<string, unknown>) =>
    data<Record<string, unknown>>(path(table), {
      method: 'POST',
      body: JSON.stringify({ values }),
    }),

  /**
   * Creates rows in ONE all-or-nothing batch — chapter 08 §3.5, at most 1 000 per call.
   *
   * A refusal names the row: `ApiError.details.index` is its position in `rows`. The
   * response is not wrapped in `data`, unlike every other route: that is the shape §3.5 gives.
   */
  createRecords: (table: TableRef, rows: ReadonlyArray<Record<string, unknown>>) =>
    call<{
      readonly atomic: true
      readonly results: ReadonlyArray<{ index: number; status: string; id: string }>
      readonly summary: { readonly created: number }
    }>(`${path(table)}/batch`, {
      method: 'POST',
      body: JSON.stringify({ operations: rows.map((data) => ({ op: 'create', data })) }),
    }),

  updateRecord: (table: TableRef, recordId: string, values: Record<string, unknown>) =>
    data<Record<string, unknown>>(`${path(table)}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ values }),
    }),

  deleteRecord: (table: TableRef, recordId: string) =>
    call<void>(`${path(table)}/${recordId}`, {
      method: 'DELETE',
    }),

  /**
   * Runs a statement against a base's schema — the SQL console.
   *
   * The one call of this client that carries SQL. The server runs it on a separate
   * PostgreSQL role holding that one schema and nothing else, so `_basedb` is out of
   * reach, and it records the statement in the audit log.
   */
  runSql: (base: string, sql: string, limit?: number) =>
    data<{
      columns: ReadonlyArray<{ name: string; dataType: string }>
      rows: ReadonlyArray<Record<string, unknown>>
      row_count: number
      command: string
      duration_ms: number
      truncated: boolean
      schema: string
    }>(`${v1()}/sql/${encodeURIComponent(base)}`, {
      method: 'POST',
      body: JSON.stringify({ sql, limit }),
    }),

  /**
   * Drafts a filter expression from a sentence — chapter 12, `expression_draft`.
   *
   * Nothing but labels, types and column names leaves the instance: no cell value, no
   * identifier. What comes back is a draft, shown in the editor and run only if asked.
   */
  draftExpression: (base: string, table: string, request: string, previousError?: string) =>
    data<{ filter: string; sort: string | null; explanation: string }>(
      `${v1()}/ai/bases/${encodeURIComponent(base)}/expression`,
      {
        method: 'POST',
        body: JSON.stringify({ table, request, previous_error: previousError }),
      },
    ),

  /** Drafts tables, fields and links from a need — `structure_draft`. */
  draftStructure: (base: string, request: string) =>
    data<{
      tables: ReadonlyArray<{
        label: string
        fields: ReadonlyArray<{
          label: string
          kind: string
          required: boolean
          target: string | null
        }>
      }>
      explanation: string
    }>(`${v1()}/ai/bases/${encodeURIComponent(base)}/structure`, {
      method: 'POST',
      body: JSON.stringify({ request }),
    }),

  /** The rows referencing a given row — a dedicated sub-path, never an expansion. */
  referencedBy: (table: TableRef, recordId: string) =>
    data<readonly ReferencedBlock[]>(`${path(table)}/${recordId}/referenced_by`),

  // ── Administration: people, groups, permissions (ch. 05 §15) ──────────────────────
  // Reading is open to administrators; every write also wants a session elevated within
  // the last five minutes, and answers `ELEVATION_REQUIRED` otherwise.

  users: () => data<readonly AdminUser[]>(`${v1()}/admin/users`),

  /** The temporary password is in this answer and nowhere else, ever. */
  createUser: (request: {
    readonly email: string
    readonly displayName: string
    readonly groups: readonly string[]
  }) =>
    data<{ user: AdminUser; temporary_password: string }>(`${v1()}/admin/users`, {
      method: 'POST',
      body: JSON.stringify({
        email: request.email,
        display_name: request.displayName,
        groups: request.groups,
      }),
    }),

  updateUser: (id: string, patch: { display_name?: string; disabled?: boolean }) =>
    data<AdminUser>(`${v1()}/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  /** Replaces the password with a temporary one, to be changed at the next sign-in. */
  resetUserPassword: (id: string) =>
    data<{ temporary_password: string }>(`${v1()}/admin/users/${encodeURIComponent(id)}/password`, {
      method: 'POST',
    }),

  setUserGroups: (id: string, groups: readonly string[]) =>
    data<AdminUser>(`${v1()}/admin/users/${encodeURIComponent(id)}/groups`, {
      method: 'PUT',
      body: JSON.stringify({ groups }),
    }),

  groups: () => data<readonly Group[]>(`${v1()}/admin/groups`),

  createGroup: (label: string) =>
    data<Group>(`${v1()}/admin/groups`, { method: 'POST', body: JSON.stringify({ label }) }),

  renameGroup: (id: string, label: string) =>
    data<unknown>(`${v1()}/admin/groups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),

  deleteGroup: (id: string) =>
    call<void>(`${v1()}/admin/groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  groupMembers: (id: string) =>
    data<ReadonlyArray<{ id: string; email: string; display_name: string }>>(
      `${v1()}/admin/groups/${encodeURIComponent(id)}/members`,
    ),

  setGroupMember: (group: string, user: string, member: boolean) =>
    call<void>(
      `${v1()}/admin/groups/${encodeURIComponent(group)}/members/${encodeURIComponent(user)}`,
      { method: member ? 'PUT' : 'DELETE' },
    ),

  /** The permission grid: every group's level on every project, base and table. */
  access: () => data<AccessGraph>(`${v1()}/admin/access`),

  /** Applies levels and returns the grid as it now stands. */
  setAccess: (changes: readonly AccessChange[]) =>
    data<AccessGraph>(`${v1()}/admin/access`, {
      method: 'POST',
      body: JSON.stringify({ changes }),
    }),
}
