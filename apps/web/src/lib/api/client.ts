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

import type { Template, TemplateIssue, TemplateSummary } from '@basedb/contracts'

declare global {
  interface Window {
    __BASEDB_API__?: string
    __BASEDB_MCP__?: string
  }
}

/**
 * An address as the browser must use it. One starting with `/` names this page's own
 * origin: the Docker image serves the interface, the API (`/`) and the MCP entry point
 * (`/mcp`) on one address, whatever the domain it is reached by. Made absolute because
 * some addresses leave the page — an iCalendar feed, an agent's configuration.
 */
export function absoluteAddress(address: string, origin?: string): string {
  const trimmed = address.replace(/\/+$/, '')
  if (!address.startsWith('/')) return trimmed
  const here = origin ?? (typeof window === 'undefined' ? '' : window.location.origin)
  return `${here}${trimmed}`
}

/**
 * The MCP entry point's address, for the configuration an agent's client needs — handed
 * over by the layout like the API's, else the port `scripts/start.mjs` prefers.
 */
export function mcpEndpoint(): string {
  const given = typeof window === 'undefined' ? undefined : window.__BASEDB_MCP__
  return given !== undefined && given !== '' ? absoluteAddress(given) : 'http://localhost:8788/mcp'
}

/**
 * API address.
 *
 * RUNTIME first — the value the layout handed over —, then the variable itself when
 * rendering on the server. Never inlined at build time (next.config.ts): an image built
 * once serves any address.
 */
const BASE = absoluteAddress(
  (typeof window === 'undefined' ? undefined : window.__BASEDB_API__) ??
    process.env.BASEDB_API ??
    'http://localhost:8787',
)

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

/**
 * A data write, as the undo journal hears it (chapter 16 §4): its transaction — which
 * `POST /history/undo` undoes — and what the request was.
 */
export interface Write {
  readonly transaction: string
  readonly method: string
  readonly path: string
  readonly body: string | null
}

let writeListener: ((write: Write) => void) | null = null

/** Hears every data write's transaction; `null` stops. The undo journal's only door. */
export function onWrite(listener: ((write: Write) => void) | null): void {
  writeListener = listener
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

  // Every data write names its transaction; an undo's own is the journal's business.
  const transaction = r.ok ? r.headers.get('x-basedb-transaction') : null
  if (transaction !== null && writeListener !== null && !path.endsWith('/history/undo')) {
    writeListener({
      transaction,
      method: init?.method ?? 'GET',
      path,
      body: typeof init?.body === 'string' ? init.body : null,
    })
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

/**
 * Which environment of its base a base is — chapter 14. The environments of one base
 * share its `lineage`; production is the default one.
 */
export interface BaseEnvironment {
  readonly lineage: string
  readonly label: string
  readonly production: boolean
  readonly position: number
}

/** A base of a project, as the navigation lists it. */
export interface ProjectBase extends Look {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly actions: readonly Action[]
  /** Agent proposals awaiting a decision — 0 for whoever does not decide on them. */
  readonly openProposals: number
  readonly environment: BaseEnvironment
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
export interface Project extends Look {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly actions: readonly Action[]
  readonly bases: readonly ProjectBase[]
}

/** Who is signed in, and what the screen must know about them before drawing anything. */
export interface Me {
  /** The account's identifier — what a person field, a mention, a presence name. */
  readonly id: string
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

/** The four levels of the permission grid, over projects, bases, tables. */
export type AccessLevel = 'none' | 'read' | 'edit' | 'manage'

/** Who may create an account, and with which addresses (chapter 13 §8). */
export interface SignupPolicy {
  readonly open: boolean
  readonly domains: readonly string[]
}

/** What an invitation offers, as its link's page shows it before anyone signs in. */
export interface InvitationPreview {
  readonly scope: { readonly kind: 'project' | 'base'; readonly label: string }
  readonly project: string
  readonly level: AccessLevel
  readonly email: string
  readonly invited_by: string
  readonly expires_at: string
}

/** A pending invitation — its link's secret included, for whoever manages the scope. */
export interface Invitation {
  readonly id: string
  readonly email: string
  readonly level: AccessLevel
  readonly expires_at: string
  readonly invited_by: string
  readonly token: string
}

/** Who has access to a project or a base, and who is invited to it (05 §15.8). */
export interface Sharing {
  readonly scope: { readonly kind: 'project' | 'base'; readonly id: string; readonly label: string }
  readonly people: ReadonlyArray<{
    readonly user_id: string
    readonly display_name: string
    readonly email: string
    readonly level: AccessLevel | 'granular'
    /** Given here, or on the project above — which only the project's sharing changes. */
    readonly from: 'here' | 'project'
    readonly you: boolean
  }>
  readonly groups: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly level: AccessLevel | 'granular'
  }>
  readonly invitations: readonly Invitation[]
}

export interface AccessCell {
  /** `granular` when the node's children do not all have what the node itself has. */
  readonly level: AccessLevel | 'granular'
  /** True when granted ON this node rather than inherited from above. */
  readonly direct: boolean
}

/** A group's rule on one field: hidden, or read-only. No rule: what its level gives. */
export type FieldRule = 'hidden' | 'read_only'

/** Below the grid: each group's rules on the fields of one table (chapter 05 §4). */
export interface FieldAccess {
  readonly table: {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly base: { readonly id: string; readonly name: string; readonly label: string }
  }
  readonly fields: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly label: string
    readonly kind: string
  }>
  readonly groups: ReadonlyArray<
    Group & {
      readonly level: AccessLevel
      readonly rules: Readonly<Record<string, FieldRule>>
    }
  >
}

/** What one person ends up with on each field of a table, and through which group (§3.3). */
export interface EffectiveMask {
  readonly user: { readonly id: string; readonly display_name: string; readonly email: string }
  readonly reads_table: boolean
  readonly fields: ReadonlyArray<{
    readonly id: string
    readonly level: 'hidden' | 'read' | 'write'
    readonly readable_via: readonly string[]
    readonly restricted_by: ReadonlyArray<{ readonly group: string; readonly rule: FieldRule }>
  }>
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
  /** Filled by the AI (chapter 12 §1.5): an option of the type, and read-only for people. */
  readonly ai?: boolean
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
  /**
   * How the value reads, when not plain (ch. 04 §2.11): a currency, a percentage, a
   * duration in seconds, a rating out of `rating_max` for a number; a phone number or a
   * barcode for a short text. The column is the same whatever the format.
   */
  readonly format?: {
    readonly display: string
    readonly currency?: string | null
    readonly rating_max?: number | null
  }
  readonly link?: {
    readonly target?: string
    readonly target_display_field?: string | null
    readonly expandable: boolean
    readonly masked: boolean
    readonly on_delete: string
  }
  /** A formula, a lookup, a rollup or a count: what it computes (ch. 04 §7, §7 ter). */
  readonly computed?: Computed
  /** A button: its label and what a click does (chapter 17 §4). */
  readonly button?: ButtonConfig
  /**
   * Set by the screen, never by the API: the field a computed field's value reads as —
   * its result's kind, with the format and choices of what it cites (`lib/computed.ts`).
   */
  readonly valueField?: Field
}

/** What a computed field computes — always read-only. */
export interface Computed {
  /** The kind of its value — or of each value, for a list. */
  readonly result_kind: string
  /** A generated column; false when computed at each read. */
  readonly stored: boolean
  /** A list of values: a lookup reaching several rows. */
  readonly multiple: boolean
  /** A formula's expression, with the labels of the day. */
  readonly expression?: string
  readonly timezone?: string | null
  /** The relation a lookup, a rollup or a count follows, and the table it reaches. */
  readonly via?: {
    readonly field: string
    readonly table: string
    readonly direction: 'outgoing' | 'incoming'
    readonly reached: string
  }
  readonly target?: string | null
  readonly aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max' | null
}

/** A lookup, a rollup, a count, as they are created: the relation, and what is read. */
export interface RollupInput {
  readonly via: string
  /** For a relation of another table aiming here. */
  readonly via_table?: string
  readonly target?: string
  readonly aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max'
}

/**
 * When an AI field computes: while a cell is empty — a new row, or one whose cited columns
 * changed, which empties it — or also on a schedule, a cron expression read in the
 * author's time zone.
 */
export interface AiRefresh {
  readonly mode: 'if_empty' | 'schedule'
  readonly cron?: string | null
  readonly timezone?: string | null
}

/** The prompt, the schedule and the consent an AI field is created or changed with. */
export interface AiFieldInput {
  /** Columns cited `{{Libellé}}`; the server keeps them under their physical names. */
  readonly prompt: string
  readonly refresh: AiRefresh
  /** The author's yes to the cited values leaving for the provider. */
  readonly consent: boolean
}

export interface AiFieldStatus {
  /** As stored: citations by PHYSICAL name, `{{notes}}`. */
  readonly prompt: string
  readonly cited: ReadonlyArray<{ readonly name: string; readonly label: string }>
  readonly refresh: {
    readonly mode: 'if_empty' | 'schedule'
    readonly cron: string | null
    readonly timezone: string | null
  }
  readonly next_sweep_at: string | null
  /** A recomputation of every row is under way. */
  readonly sweeping: boolean
  readonly last_run_at: string | null
  /** The code of the last refusal met, `null` after a clean run. */
  readonly last_error: string | null
  readonly last_error_at: string | null
  readonly computed_count: number
  readonly consented_at: string
}

// ── The copilot — chapter 12 §1.6 ────────────────────────────────────────────────────

export interface CopilotMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** A column the copilot proposes. `target` names a table; `prompt` is an AI column's. */
export interface CopilotField {
  readonly label: string
  readonly kind: string
  readonly description: string | null
  readonly options: readonly string[]
  readonly target: string | null
  readonly prompt: string | null
}

/** A link value to resolve on apply: the row's identifier, or its display value. */
export type CopilotLink = { readonly id: string } | { readonly display: string }

export type CopilotAction =
  | {
      readonly type: 'filter'
      readonly table: string
      readonly filter: string
      readonly sort: string | null
    }
  | { readonly type: 'sql'; readonly sql: string }
  | {
      readonly type: 'add_fields'
      readonly table: string
      readonly fields: readonly CopilotField[]
    }
  | {
      readonly type: 'create_table'
      readonly label: string
      readonly description: string | null
      readonly fields: readonly CopilotField[]
    }
  | {
      readonly type: 'insert_records'
      /** A table name — or, `pending`, the label of a table proposed alongside. */
      readonly table: string
      readonly pending: boolean
      readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>
    }
  | {
      readonly type: 'update_records'
      readonly table: string
      readonly updates: ReadonlyArray<{
        readonly id: string
        readonly values: Readonly<Record<string, unknown>>
      }>
    }

/** A read the copilot made to answer — what left the instance, said on the screen. */
export interface CopilotRead {
  readonly kind: 'sql' | 'records'
  readonly table: string | null
  readonly text: string
  readonly rows: number
  readonly error: string | null
}

export interface CopilotAnswer {
  readonly message: string
  readonly actions: readonly CopilotAction[]
  readonly reads: readonly CopilotRead[]
  readonly dropped: readonly string[]
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
  /** Kept like a source by the server: read, never written by hand (chapter 19 §3). */
  readonly synced?: boolean
}

export interface DescribedBase extends Look {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly description: string | null
  readonly project: ProjectRef
  /** Which environment of its base this one is (chapter 14). */
  readonly environment: BaseEnvironment
  /** The verbs held on the base itself: `manage_schema` lets a table be added to it. */
  readonly actions: readonly Action[]
  readonly tables: readonly Table[]
}

// ── Environments — chapter 14 ────────────────────────────────────────────────

/** An environment of a base, as its form lists it. */
export interface EnvironmentSummary {
  readonly id: string
  /** The base name of this environment — its URLs, its schema. */
  readonly name: string
  readonly environment: string
  readonly production: boolean
  readonly position: number
  readonly tableCount: number
  readonly createdAt: string
  readonly forkedFrom: string | null
}

export interface EnvironmentFamily extends Look {
  readonly lineageId: string
  readonly label: string
  readonly description: string | null
  readonly environments: readonly EnvironmentSummary[]
}

export interface ComparedTableCell extends Look {
  readonly label: string
  readonly name: string
  readonly deleted: boolean
  readonly description: string | null
  readonly displayField: string | null
}

export interface ComparedFieldCell {
  readonly label: string
  readonly name: string
  readonly kind: string
  readonly required: boolean
  readonly description: string | null
  readonly options: readonly string[] | null
  readonly link: string | null
  readonly ai: boolean
}

export interface EnvironmentComparison {
  readonly environments: readonly EnvironmentSummary[]
  readonly tables: ReadonlyArray<{
    readonly lineage: string
    readonly cells: ReadonlyArray<ComparedTableCell | null>
    readonly differs: boolean
    readonly fields: ReadonlyArray<{
      readonly lineage: string
      readonly cells: ReadonlyArray<ComparedFieldCell | null>
      readonly differs: boolean
    }>
  }>
}

export type StepStatus = 'ready' | 'target_newer' | 'conflict' | 'needs_consent'

export interface PlanStep {
  readonly id: string
  readonly kind: string
  readonly table: { readonly lineage: string; readonly label: string }
  readonly field?: { readonly lineage: string; readonly label: string; readonly kind: string }
  readonly summary: string
  readonly changes: ReadonlyArray<{
    readonly attribute: string
    readonly from: string | null
    readonly to: string | null
  }>
  readonly status: StepStatus
  readonly selected: boolean
  readonly destructive: boolean
  readonly dependsOn: readonly string[]
}

export interface StructurePlan {
  readonly source: EnvironmentSummary
  readonly target: EnvironmentSummary
  readonly lastSync: string | null
  readonly steps: readonly PlanStep[]
  readonly notes: ReadonlyArray<{
    readonly table: string
    readonly field?: string
    readonly message: string
  }>
}

export interface ApplyReport {
  readonly source: EnvironmentSummary
  readonly target: EnvironmentSummary
  readonly results: ReadonlyArray<{
    readonly id: string
    readonly kind: string
    readonly summary: string
    readonly outcome: 'applied' | 'failed' | 'skipped'
    readonly code?: string
    readonly note?: string
  }>
  readonly applied: number
  readonly failed: number
  readonly skipped: number
}

export interface TableRowCounts {
  readonly lineage: string
  readonly label: string
  readonly source: number | null
  readonly target: number | null
}

export interface RowSample {
  readonly id: string
  readonly display: string | null
  readonly changed: readonly string[]
}

export interface RowComparison {
  readonly source: EnvironmentSummary
  readonly target: EnvironmentSummary
  readonly table: { readonly lineage: string; readonly label: string }
  readonly columns: ReadonlyArray<{
    readonly lineage: string
    readonly label: string
    readonly kind: string
  }>
  readonly skipped: ReadonlyArray<{ readonly label: string; readonly reason: string }>
  readonly counts: {
    readonly onlySource: number
    readonly onlyTarget: number
    readonly different: number
    readonly identical: number
  }
  readonly samples: {
    readonly onlySource: readonly RowSample[]
    readonly onlyTarget: readonly RowSample[]
    readonly different: readonly RowSample[]
  }
  readonly lastSync: string | null
}

/** One act of the structure history (chapter 07 §8.1), said in words. */
export interface StructureEvent {
  readonly id: string
  readonly at: string
  readonly op: string
  readonly object: 'base' | 'table' | 'field' | 'ai' | 'option' | 'config'
  readonly table: string | null
  readonly field: string | null
  readonly summary: string
  readonly changes: ReadonlyArray<{
    readonly attribute: string
    readonly from: string | null
    readonly to: string | null
  }>
  readonly actor: { readonly kind: string; readonly name: string | null }
  readonly migrationId: string | null
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

/** What renaming a base, a table or a field in the database would touch (chapter 06 §2.1). */
export interface RenameImpact {
  readonly kind: 'base' | 'table' | 'field'
  readonly id: string
  readonly label: string
  readonly current: string
  readonly qualified: string
  readonly suggested: string
  readonly alias_allowed: boolean
  readonly live_aliases: number
  /** An ESTIMATE (`pg_class.reltuples`); `null` when never analysed. */
  readonly estimated_rows: number | null
  readonly bytes: number | null
  readonly webhooks: readonly string[]
  readonly tokens: ReadonlyArray<{ readonly label: string; readonly last_used_at: string | null }>
  readonly misaligned_links: ReadonlyArray<{
    readonly table: string
    readonly column: string
    readonly label: string
  }>
  readonly dependents: readonly string[]
  readonly citing_prompts: number
}

/** A compatibility alias: the old name of a base (a schema) or of a table (a view). */
export interface CompatibilityAlias {
  readonly id: string
  readonly kind: 'schema' | 'view'
  readonly name: string
  readonly qualified: string
  readonly target: string
  readonly target_label: string
  readonly created_at: string
  readonly drop_after: string | null
  readonly blank_cut: {
    readonly from: string
    readonly until: string
    readonly name: string
  } | null
  readonly views: number
  readonly dependents: readonly string[]
}

/** A deleted table of a live base, not purged yet. */
export interface DeletedTable {
  readonly id: string
  readonly label: string
  readonly name: string
  readonly deleted_at: string
  readonly deleted_by: string | null
  readonly purgeable_from: string
}

/** The export a purge requires (chapter 06 §5.2). */
export interface PurgeExport {
  readonly id: string
  readonly directory: string
  readonly created_at: string
  readonly total_rows: number
  readonly total_bytes: number
  readonly tables: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly name: string
    readonly file: string
    readonly rows: number
    readonly bytes: number
    readonly sha256: string
  }>
}

/** What a webhook is told about: a row created, modified, deleted. */
export type WebhookEvent = 'create' | 'update' | 'delete'

/** A webhook as the administration shows it — never its secret (chapter 08 §10). */
export interface Webhook {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly active: boolean
  /** Why it stopped: `failures`, `field_masked` or `manual`. */
  readonly disabled_reason: string | null
  readonly created_at: string
  readonly subscriptions: ReadonlyArray<{
    readonly table: string
    readonly table_label: string
    readonly events: readonly WebhookEvent[]
  }>
  readonly last_delivery: {
    readonly status: string
    readonly at: string
    readonly response_code: number | null
  } | null
}

export interface WebhookDelivery {
  readonly id: string
  readonly created_at: string
  readonly status: 'pending' | 'in_flight' | 'delivered' | 'failed' | 'abandoned'
  readonly attempts: number
  readonly next_attempt_at: string | null
  readonly delivered_at: string | null
  readonly response_code: number | null
  readonly error_code: string | null
  readonly table_label: string | null
  readonly record_id: string
  readonly op: string
}

/** A value typed by someone — an agent included: shown as data, never as text. */
export interface UserData {
  readonly value: unknown
  readonly provenance: 'user_data' | 'system'
}

/** A table named in a proposal: its physical name first, its label as data. */
export interface ProposalTable {
  readonly physical: string
  readonly label: string
  readonly provenance: 'user_data'
}

/** A structure change an agent proposed, awaiting a person — chapter 09 §7. */
export interface Proposal {
  readonly id: string
  readonly status:
    | 'proposed'
    | 'approved'
    | 'applied'
    | 'rejected'
    | 'expired'
    | 'superseded'
    | 'failed'
  readonly base: { readonly id: string; readonly name: string; readonly label: string }
  readonly requested_at: string
  readonly expires_at: string
  readonly requested_by: { readonly id: string; readonly name: string | null }
  readonly token: { readonly id: string | null; readonly label: string | null }
  readonly summary_template: 'create_table' | 'add_field' | 'add_link_field' | string
  readonly summary_params: {
    readonly table_label?: UserData
    readonly table_description?: UserData
    readonly fields?: ReadonlyArray<{
      readonly label: UserData
      readonly kind: UserData
      readonly description: UserData
    }>
    readonly field_label?: UserData
    readonly field_description?: UserData
    readonly kind?: UserData
    readonly table?: ProposalTable
    readonly options?: readonly UserData[]
    readonly source_table?: ProposalTable
    readonly target_table?: ProposalTable
    readonly on_delete?: UserData
  }
  readonly affected_objects: ReadonlyArray<{
    readonly role: 'created' | 'modified' | 'referenced'
    readonly kind: string
    readonly physical: string
    readonly effects: readonly string[]
  }>
  readonly up_sql: readonly string[]
  readonly down_sql: readonly string[]
  readonly decided_by: { readonly id: string; readonly name: string | null } | null
  readonly decided_at: string | null
  readonly error: string | null
}

/** One field of a revision: what it was, what it became — chapter 07 §3. */
export interface RevisionChange {
  readonly field_id: string
  readonly label: string
  readonly kind: string
  /** The column, or `null` when the field was deleted since. */
  readonly name: string | null
  /** Absent: not concerned — a creation has no "before", a deletion no "after". */
  readonly before?: unknown
  readonly after?: unknown
  /** The label of a choice, the name of a linked row, as they were that day. */
  readonly before_display: string | null
  readonly after_display: string | null
}

/** One entry of the history: a creation, a modification or a deletion of one row. */
export interface Revision {
  readonly id: string
  readonly occurred_at: string
  readonly op: 'insert' | 'update' | 'delete'
  /** Caused by the deletion of another row (a link `on delete`), not asked for directly. */
  readonly cascade: boolean
  readonly table: { readonly id: string; readonly name: string; readonly label: string }
  readonly record_id: string
  readonly record_display: string | null
  readonly actor: {
    readonly kind: string
    readonly user_id: string | null
    readonly name: string | null
    readonly token_id: string | null
    readonly token_label: string | null
    readonly sql_identity: string | null
  }
  readonly changes: readonly RevisionChange[]
  /** What the reader may do with it now. */
  readonly actions: ReadonlyArray<'revert' | 'restore'>
}

export interface RevisionPage {
  readonly data: readonly Revision[]
  /** `null` at the end — and only the cursor says so: a page may be short and not last. */
  readonly meta: { readonly next_cursor: string | null }
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

/** A person of the tenant, as a `user` field names them (ch. 04 §2.10). */
export interface Member {
  readonly id: string
  readonly display_name: string
  readonly email: string
  readonly disabled: boolean
}

/** The six ways a saved view shows a table — or asks for one of its rows. */
export type ViewKind =
  | 'grid'
  | 'kanban'
  | 'calendar'
  | 'timeline'
  | 'gallery'
  | 'list'
  | 'form'
  | 'survey'

/**
 * A saved view of a table (ch. 11 §1.4), shared by everyone who reads the table.
 *
 * `spec` has the shape of its `kind` — `lib/views.ts` reads it — and arrives already cut
 * down to the fields the reader sees. `filter_hidden` says its filter cites one they do
 * not: the view is then not shown, rather than shown unfiltered.
 */
export interface SavedView {
  readonly id: string
  readonly label: string
  readonly kind: ViewKind
  readonly description: string | null
  readonly position: number
  readonly spec: Readonly<Record<string, unknown>>
  readonly filter_hidden: boolean
  /** The reader's own view: nobody else sees it (ch. 11 §1.6). */
  readonly personal: boolean
  /** Refused any change until it is unlocked. */
  readonly locked: boolean
  readonly created_at: string
  readonly updated_at: string
}

/**
 * Aggregates over every row a filter keeps (ch. 11 §1.6) — the summary bar and the counts
 * of a grid's groups. Counts are numbers; sums, averages and bounds come as PostgreSQL
 * writes them, a decimal text or an ISO date, for the screen to format.
 */
export interface Aggregates {
  readonly total: number
  /** By `field:fn`. */
  readonly values: Readonly<Record<string, string | number | null>>
  /** Rows per value of the grouping field, empty value first. */
  readonly groups: ReadonlyArray<{ readonly value: unknown; readonly count: number }> | null
  readonly groups_capped: boolean
}

const path = (t: TableRef) => `${v1()}/data/${t.base}/${t.name}`
const viewsPath = (t: TableRef) => `${v1()}/admin/bases/${t.base}/tables/${t.name}/views`

// ── Integrations and synced tables — chapter 19 ──────────────────────────────

/** A Slack connection of a base: its address is never given back, only its end. */
export interface Integration {
  readonly id: string
  readonly kind: 'slack'
  readonly label: string
  readonly hint: string
  readonly created_at: string
}

export type SyncSourceKind = 'csv' | 'ics' | 'basedb'

export interface SyncedTable {
  readonly table_id: string
  readonly table: string
  readonly label: string
  readonly source_kind: SyncSourceKind
  readonly host: string
  readonly interval_minutes: number
  readonly next_sync_at: string
  readonly last_synced_at: string | null
  readonly last_status: 'ok' | 'failed' | null
  readonly last_error: string | null
  readonly last_counts: {
    readonly created: number
    readonly updated: number
    readonly deleted: number
  } | null
}

/** The iCalendar feed of a shared calendar or timeline, as an agenda subscribes to it. */
export function calendarFeedUrl(token: string): string {
  return `${BASE}/api/v1/views/${encodeURIComponent(token)}/calendar.ics`
}

/** The API address of a shared view, as a synced table of another base reads it. */
export function sharedViewApiUrl(token: string): string {
  return `${BASE}/api/v1/views/${encodeURIComponent(token)}`
}

// ── Base templates — chapter 20 ──────────────────────────────────────────────

/** Where a template of the gallery comes from. */
export type TemplateSource = 'instance' | 'site' | 'bundled'

export type TemplateItem = TemplateSummary & { readonly source: TemplateSource }

export interface TemplateCatalog {
  readonly templates: readonly TemplateItem[]
  /** How the public site's catalog is doing; `null` when the instance does not read it. */
  readonly site: {
    readonly url: string
    readonly fetched_at: string | null
    readonly error: string | null
  } | null
}

/** A template proposed by the AI, and what its repair dropped. */
export interface TemplateDraft {
  readonly template: Template
  readonly explanation: string
  readonly issues: readonly TemplateIssue[]
}

// ── Dashboards — chapter 18 ──────────────────────────────────────────────────

/** A block of a dashboard: it reads through the ordinary routes, on the reader's rights. */
export type DashboardBlock =
  | {
      readonly kind: 'number'
      readonly width: number
      readonly title: string
      /** The table's identifier. */
      readonly table: string
      readonly aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max'
      readonly field: string | null
      readonly filter: string
    }
  | {
      readonly kind: 'chart'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly group_by: string
      readonly filter: string
      readonly style: 'bar' | 'pie'
    }
  | {
      readonly kind: 'list'
      readonly width: number
      readonly title: string
      readonly table: string
      readonly fields: readonly string[]
      readonly filter: string
      readonly sort: string
      readonly limit: number
    }
  | { readonly kind: 'text'; readonly width: number; readonly title: string; readonly body: string }
  | {
      readonly kind: 'embed'
      readonly width: number
      readonly title: string
      readonly url: string
      readonly height: number
    }

export interface Dashboard {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly position: number
  readonly blocks: readonly DashboardBlock[]
  readonly updated_at: string
}

// ── Automations — chapter 17 ─────────────────────────────────────────────────

/** A button field's label, colour and action. */
export interface ButtonConfig {
  readonly label: string
  readonly color: string | null
  readonly action: 'url' | 'automation'
  /** An address that may cite the row with `{{champ}}`. */
  readonly url: string | null
  readonly automation: string | null
}

export type AutomationTriggerKind = 'record_created' | 'record_updated' | 'schedule' | 'button'

export interface AutomationSchedule {
  readonly every: 'hour' | 'day' | 'week'
  readonly at: string
  readonly weekday: number
  readonly timezone: string
}

export type AutomationAction =
  | { readonly kind: 'update_record'; readonly values: Readonly<Record<string, unknown>> }
  | {
      readonly kind: 'create_record'
      /** The table's identifier. */
      readonly table: string
      readonly values: Readonly<Record<string, unknown>>
    }
  | {
      readonly kind: 'notify'
      readonly users: readonly string[]
      readonly user_field: string | null
      readonly message: string
    }
  | { readonly kind: 'webhook'; readonly url: string }
  | {
      readonly kind: 'slack'
      /** The Slack connection's identifier. */
      readonly integration: string
      readonly message: string
    }

export interface Automation {
  readonly id: string
  readonly label: string
  readonly description: string | null
  readonly enabled: boolean
  readonly trigger: {
    readonly kind: AutomationTriggerKind
    /** The table's identifier; `null` for a schedule. */
    readonly table: string | null
    readonly fields: readonly string[]
    readonly schedule: AutomationSchedule | null
  }
  readonly condition: string | null
  readonly actions: readonly AutomationAction[]
  readonly owner: { readonly id: string; readonly name: string }
  readonly next_run_at: string | null
  readonly last_run: { readonly status: string; readonly at: string } | null
  readonly created_at: string
  readonly updated_at: string
}

/** What an automation is saved with — tables by name or identifier. */
export interface AutomationInput {
  readonly label?: string
  readonly description?: string | null
  readonly enabled?: boolean
  readonly trigger?: {
    readonly kind: AutomationTriggerKind
    readonly table?: string | null
    readonly fields?: readonly string[]
    readonly schedule?: AutomationSchedule | null
  }
  readonly condition?: string | null
  readonly actions?: readonly AutomationAction[]
}

export interface AutomationRun {
  readonly id: string
  readonly trigger: string
  readonly record_id: string | null
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
  readonly reason: string | null
  readonly error_code: string | null
  readonly steps: ReadonlyArray<{
    readonly action: string
    readonly status: string
    readonly detail?: string
    readonly error_code?: string
  }>
  readonly queued_at: string
  readonly started_at: string | null
  readonly finished_at: string | null
}

// ── Collaboration — chapter 16 ───────────────────────────────────────────────

/** A comment on a row (chapter 16 §1). */
export interface RecordComment {
  readonly id: string
  readonly record_id: string
  readonly author: { readonly id: string; readonly name: string }
  /** Plain text; a mention reads `@[Nom](user:<id>)`. */
  readonly body: string
  readonly mentions: readonly string[]
  readonly created_at: string
  readonly edited_at: string | null
  readonly can_edit: boolean
  readonly can_delete: boolean
}

/** An in-app notification (chapter 16 §2). */
export interface AppNotification {
  readonly id: string
  /** `automation`: an automation's « notify » step, its owner as the actor. */
  readonly kind: 'mention' | 'reply' | 'assigned' | 'automation'
  readonly actor: { readonly id: string; readonly name: string } | null
  readonly base: { readonly name: string; readonly label: string }
  readonly table: { readonly name: string; readonly label: string }
  readonly record_id: string
  readonly comment_id: string | null
  readonly excerpt: string
  readonly created_at: string
  readonly read_at: string | null
  /** Whether the row can still be opened. */
  readonly readable: boolean
}

/** Someone looking at the same table, and the row they have open (chapter 16 §3.3). */
export interface Viewer {
  readonly user: string
  readonly name: string
  readonly record: string | null
}

/**
 * Where a pointer is over the grid (chapter 16 §3.4): the cell — a row, a column — and
 * where in it, from 0 to 1, so that every screen places it again on its own layout.
 */
export interface PointerAt {
  readonly record: string
  readonly field: string
  readonly x: number
  readonly y: number
}

/** Someone else's pointer on the same table. */
export interface RemotePointer {
  readonly session: string
  readonly user: string
  readonly name: string
  readonly at: PointerAt
}

/**
 * Opens the live stream (chapter 16 §3.2) and hands each event to `onEvent` until the
 * stream ends or `signal` aborts it. `fetch` rather than `EventSource`: the stream is
 * authenticated by a Bearer token, which an `EventSource` cannot carry.
 */
export async function streamEvents(
  query: { readonly base?: string; readonly table?: string; readonly record?: string },
  onEvent: (name: string, data: Record<string, unknown>) => void,
  signal: AbortSignal,
): Promise<void> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value !== '') params.set(key, value)
  }
  const r = await fetch(`${BASE}${v1()}/events?${params.toString()}`, {
    headers: { authorization: `Bearer ${await accessToken()}` },
    credentials: 'include',
    cache: 'no-store',
    signal,
  })
  if (!r.ok || r.body === null) {
    if (r.status === 401) access = null
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>
    throw new ApiError(
      String(body.code ?? 'INTERNAL_ERROR'),
      r.status,
      String(body.request_id ?? ''),
    )
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const name = /^event: ?(.*)$/m.exec(block)?.[1]
      const payload = /^data: ?(.*)$/m.exec(block)?.[1]
      if (name === undefined) continue
      try {
        onEvent(name, JSON.parse(payload ?? '{}') as Record<string, unknown>)
      } catch {
        // A malformed event is dropped; the next one stands on its own.
      }
    }
  }
}

// ── Shared forms — chapter 15 ────────────────────────────────────────────────

export type ShareAccess = 'public' | 'members'
/** Why a share does not take answers — or `open` when it does. */
export type ShareState = 'open' | 'inactive' | 'closed' | 'full' | 'authority'

export interface FormShare {
  readonly id: string
  readonly view_id: string
  readonly access: ShareAccess
  readonly active: boolean
  /** The secret of the link: the page is `/f/<token>`. */
  readonly token: string
  readonly closes_at: string | null
  readonly max_responses: number | null
  readonly response_count: number
  readonly last_response_at: string | null
  readonly published_by: { readonly id: string; readonly name: string | null }
  readonly groups: readonly string[]
  readonly state: ShareState
  /** Another site may frame the page (ch. 15 §10). */
  readonly can_embed: boolean
  /** A form or a survey is answered at `/f/`; any other view is read at `/v/`. */
  readonly view_kind: ViewKind
}

export interface FormSharing {
  readonly share: FormShare | null
  readonly groups: ReadonlyArray<{ readonly id: string; readonly label: string }>
  readonly omitted: ReadonlyArray<{ readonly field: string; readonly reason: string }>
}

export interface ShareSettings {
  readonly access: ShareAccess
  readonly active: boolean
  readonly closes_at: string | null
  readonly max_responses: number | null
  readonly groups: readonly string[]
  readonly can_embed?: boolean
}

/** A field as a shared view's page draws it (ch. 15 §10). */
export interface SharedViewField {
  readonly name: string
  readonly label: string
  readonly kind: string
  readonly options?: readonly FieldOption[]
  readonly format?: Field['format']
  readonly computed?: { readonly result_kind: string; readonly multiple: boolean }
}

/** A data view read through its link: its fields, its presentation, a page of rows. */
export interface SharedView {
  readonly kind: ViewKind
  readonly title: string
  readonly description: string | null
  readonly access: ShareAccess
  readonly reader: string | null
  readonly can_embed: boolean
  readonly fields: readonly SharedViewField[]
  readonly spec: Readonly<Record<string, unknown>>
  readonly rows: ReadonlyArray<Record<string, unknown>>
  readonly next_cursor: string | null
}

/** A shared form as the person answering sees it. */
export interface SharedForm {
  readonly kind: 'form' | 'survey'
  readonly title: string
  readonly description: string
  readonly submit_label: string
  readonly success_message: string
  readonly allow_another: boolean
  readonly access: ShareAccess
  readonly respondent: string | null
  readonly questions: ReadonlyArray<{
    readonly name: string
    readonly label: string
    readonly help: string | null
    readonly kind: string
    readonly required: boolean
    readonly options: readonly FieldOption[] | null
  }>
}

/**
 * A call to a shared form: anonymous first — a public form answers anyone —, then, when
 * the form wants a signed-in member, once more with the session's access token if there
 * is a session in this browser.
 */
async function formCall<T>(path: string, init?: RequestInit): Promise<T> {
  const send = (bearer?: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` }),
      },
      credentials: 'include',
      cache: 'no-store',
    })
  let r = await send()
  if (r.status === 401) {
    const bearer = await accessToken().catch(() => undefined)
    if (bearer !== undefined) r = await send(bearer)
  }
  const body = (await r.json().catch(() => ({}))) as Record<string, unknown>
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
  return (body as { data: T }).data
}

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

  /**
   * Whether the instance still waits for its first administrator.
   *
   * `false` on any failure: once an administrator exists the route answers `404`, and
   * the login screen is the right one to fall back to whatever went wrong.
   */
  bootstrapOpen: async (): Promise<boolean> => {
    try {
      await call<unknown>('/auth/bootstrap')
      return true
    } catch {
      return false
    }
  },

  /** Creates the first administrator, and comes back SIGNED IN as them. */
  bootstrap: async (request: {
    email: string
    displayName: string
    password: string
  }): Promise<void> => {
    const body = await call<{ data: { tenant: string } }>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        email: request.email,
        display_name: request.displayName,
        password: request.password,
      }),
    })
    tenant = body.data.tenant
    access = null
  },

  /** Whether anyone may create an account here; `null` when it is closed. */
  signupPolicy: async (): Promise<SignupPolicy | null> => {
    try {
      return await data<SignupPolicy>('/auth/signup')
    } catch {
      return null
    }
  },

  /**
   * Creates one's own account, and comes back SIGNED IN. An invitation's secret admits the
   * account even when sign-up is closed.
   */
  signUp: async (request: {
    email: string
    displayName: string
    password: string
    invitation?: string
  }): Promise<void> => {
    const body = await call<{ data: { tenant: string } }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: request.email,
        display_name: request.displayName,
        password: request.password,
        invitation: request.invitation,
      }),
    })
    tenant = body.data.tenant
    access = null
  },

  /** What an invitation offers — before signing in. The secret travels in the body. */
  invitationPreview: (token: string) =>
    data<InvitationPreview>('/auth/invitation', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  /** Providers this instance accepts. Empty means password only. */
  oidcProviders: () => data<ReadonlyArray<{ slug: string; label: string }>>('/auth/oidc/providers'),

  /**
   * Where to SEND THE BROWSER to start an exchange.
   *
   * A full-page navigation, not a fetch: the route answers with a redirect to the
   * provider, and a redirect followed by `fetch` would land the provider's login page
   * inside a response body nobody can see.
   */
  oidcStartUrl: (slug: string, returnTo = '/') =>
    `${BASE}/auth/oidc/${encodeURIComponent(slug)}/start?return_to=${encodeURIComponent(returnTo)}`,

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
          id: string
          email: string
          display_name: string
          tenant: string
          is_admin?: boolean
          must_change_password?: boolean
        }
      }>('/auth/me')
      tenant = body.data.tenant
      return {
        id: body.data.id,
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

  createProject: (label: string, description?: string, look?: Partial<Look>) =>
    data<{ id: string; label: string; description: string | null }>(`${v1()}/admin/projects`, {
      method: 'POST',
      body: JSON.stringify({ label, description, ...look }),
    }),

  /** What is absent stays as it was; a `null` description clears it. The look travels whole. */
  updateProject: (
    id: string,
    patch: { label?: string; description?: string | null } & Partial<Look>,
  ) =>
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
      ai?: AiFieldInput
      format?: { display: string; currency?: string | null; rating_max?: number | null }
      formula?: { expression: string; timezone?: string }
      rollup?: RollupInput
      button?: {
        label: string
        color?: string | null
        action: 'url' | 'automation'
        url?: string
        automation?: string
      }
    },
  ) =>
    data<{ id: string; name: string; label: string; kind: string; description: string | null }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields`,
      { method: 'POST', body: JSON.stringify(field) },
    ),

  /** How an AI field is set and how it is doing. */
  aiFieldStatus: (table: TableRef, field: string) =>
    data<AiFieldStatus>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}/ai`,
    ),

  /** Changes the prompt or the schedule — a fresh consent — and recomputes if asked. */
  setAiField: (table: TableRef, field: string, input: AiFieldInput & { recompute?: boolean }) =>
    data<AiFieldStatus>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}/ai`,
      { method: 'PUT', body: JSON.stringify(input) },
    ),

  /** Switches the AI option off: the field is an ordinary one again, its values kept. */
  disableAiField: (table: TableRef, field: string) =>
    call<void>(`${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}/ai`, {
      method: 'DELETE',
    }),

  /** Computes one row now and returns its value. */
  runAiCell: (table: TableRef, field: string, record: string) =>
    data<{ record: string; value: unknown }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}/ai/run`,
      { method: 'POST', body: JSON.stringify({ record }) },
    ),

  /** Recomputes every row, in the background. */
  runAiSweep: (table: TableRef, field: string) =>
    data<{ scheduled: boolean }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}/ai/run`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  /** The next runs of a schedule, or the refusal it would meet. Nothing is written. */
  previewSchedule: (cron: string, timezone: string) =>
    data<{ runs: readonly string[] }>(`${v1()}/ai/schedule/preview`, {
      method: 'POST',
      body: JSON.stringify({ cron, timezone }),
    }),

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
  /**
   * The order of a table's fields, as the whole list of their names. The catalog's order —
   * the grid opens with it; PostgreSQL's own column order is not touched.
   */
  reorderFields: (table: TableRef, fields: readonly string[]) =>
    data<{ fields: readonly string[] }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/order`,
      { method: 'PUT', body: JSON.stringify({ fields }) },
    ),

  /** The saved views of a table, in the order of its selector. */
  views: (table: TableRef) =>
    data<readonly SavedView[]>(`${v1()}/meta/bases/${table.base}/tables/${table.name}/views`),

  /** Creates a view, placed last. `manage_schema` on the base, like building the table. */
  createView: (
    table: TableRef,
    view: {
      label: string
      kind: ViewKind
      description?: string | null
      spec: Readonly<Record<string, unknown>>
      personal?: boolean
    },
  ) => data<SavedView>(viewsPath(table), { method: 'POST', body: JSON.stringify(view) }),

  /** Renames a view and/or replaces its WHOLE spec — or locks it. Its kind never changes. */
  updateView: (
    table: TableRef,
    id: string,
    patch: {
      label?: string
      description?: string | null
      spec?: Readonly<Record<string, unknown>>
      locked?: boolean
    },
  ) =>
    data<SavedView>(`${viewsPath(table)}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteView: (table: TableRef, id: string) =>
    call<void>(`${viewsPath(table)}/${id}`, { method: 'DELETE' }),

  /** How a form view is shared: its link and settings, or none (chapter 15). */
  formSharing: (table: TableRef, view: string) =>
    data<FormSharing>(`${viewsPath(table)}/${view}/share`),

  /** Shares a form view, or changes how. Whoever saves becomes its publisher. */
  saveFormSharing: (table: TableRef, view: string, settings: ShareSettings) =>
    data<FormSharing>(`${viewsPath(table)}/${view}/share`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  /** A new link: the old one stops working at once. */
  regenerateFormShare: (table: TableRef, view: string) =>
    data<FormSharing>(`${viewsPath(table)}/${view}/share/regenerate`, { method: 'POST' }),

  /** Stops sharing a form. The answers already given stay. */
  deleteFormShare: (table: TableRef, view: string) =>
    call<void>(`${viewsPath(table)}/${view}/share`, { method: 'DELETE' }),

  /** Opens a shared form by its link — no right on the table needed. */
  sharedForm: (token: string) => formCall<SharedForm>(`/api/v1/forms/${encodeURIComponent(token)}`),

  /** Reads a shared data view by its link — no right on the table needed (ch. 15 §10). */
  sharedView: async (token: string, after?: string): Promise<SharedView> => {
    const path =
      after === undefined
        ? `/api/v1/views/${encodeURIComponent(token)}`
        : `/api/v1/views/${encodeURIComponent(token)}/rows?after=${encodeURIComponent(after)}`
    const r = await fetch(`${BASE}${path}`, { credentials: 'include', cache: 'no-store' })
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>
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
    const meta = (body.meta ?? {}) as { next_cursor?: string | null }
    return {
      ...(body.data as Omit<SharedView, 'next_cursor'>),
      next_cursor: meta.next_cursor ?? null,
    }
  },

  /** Answers a shared form: one row. */
  submitSharedForm: (token: string, values: Readonly<Record<string, unknown>>) =>
    formCall<{ received: true }>(`/api/v1/forms/${encodeURIComponent(token)}`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    }),

  /** The order of the selector, as the list of the views' identifiers. */
  reorderViews: (table: TableRef, ids: readonly string[]) =>
    data<{ views: readonly string[] }>(`${viewsPath(table)}/order`, {
      method: 'PUT',
      body: JSON.stringify({ views: ids }),
    }),

  /** Changes how a number or a short text reads — no migration, the column is the same. */
  /** A formula's new expression — a stored one rewrites its column (ch. 04 §7.7). */
  setFormula: (table: TableRef, field: string, expression: string) =>
    data<{ name: string; formula?: { stored: boolean } }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}`,
      { method: 'PATCH', body: JSON.stringify({ formula: { expression } }) },
    ),

  setFieldFormat: (
    table: TableRef,
    field: string,
    format: { display: string; currency?: string | null; rating_max?: number | null },
  ) =>
    data<{ name: string; format: Field['format'] }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/fields/${field}`,
      { method: 'PATCH', body: JSON.stringify({ format }) },
    ),

  /** The people of the tenant — what a `user` field names. */
  members: () => data<readonly Member[]>(`${v1()}/meta/users`),

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

  /** A relation; `multiple` makes it a multi-link — several rows (04 §4 bis). */
  createLink: (
    table: TableRef,
    label: string,
    target: string,
    description?: string,
    multiple?: boolean,
  ) =>
    data<Field & { target: string }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/links`,
      { method: 'POST', body: JSON.stringify({ label, target, description, multiple }) },
    ),

  /** Designates the column read instead of the identifier in link cells. */
  setDisplayColumn: (table: TableRef, field: string | null) =>
    data<{ field: string | null; name: string | null }>(
      `${v1()}/admin/bases/${table.base}/tables/${table.name}/display`,
      { method: 'POST', body: JSON.stringify({ field }) },
    ),

  aggregate: (
    table: TableRef,
    request: {
      readonly filter?: string
      readonly aggregates: ReadonlyArray<{ readonly field: string; readonly fn: string }>
      readonly group?: string | null
    },
  ) => {
    const q = new URLSearchParams()
    if (request.filter !== undefined && request.filter.trim() !== '')
      q.set('filter', request.filter)
    if (request.aggregates.length > 0) {
      q.set('aggregates', request.aggregates.map((a) => `${a.field}:${a.fn}`).join(','))
    }
    if (request.group !== undefined && request.group !== null) q.set('group', request.group)
    return data<Aggregates>(`${path(table)}/aggregate?${q}`)
  },

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

  /**
   * Deletes a base logically — every environment of it, production last. Returns the
   * migration, which may have failed on a step.
   */
  deleteBase: (base: string) =>
    data<Migration>(`${v1()}/admin/bases/${encodeURIComponent(base)}`, { method: 'DELETE' }),

  // ── Environments (chapter 14). `base` is any environment of the base. ──

  environments: (base: string) =>
    data<EnvironmentFamily>(`${v1()}/admin/bases/${encodeURIComponent(base)}/environments`),

  /**
   * Adds an environment: a copy of the structure of `source` (production when absent).
   * Its tables are created one by one: the report says which were, and which were not.
   */
  createEnvironment: (base: string, environment: string, source?: string) =>
    data<{ environment: EnvironmentSummary; report: ApplyReport }>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments`,
      { method: 'POST', body: JSON.stringify({ environment, source }) },
    ),

  renameEnvironment: (base: string, env: string, environment: string) =>
    data<EnvironmentSummary>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments/${encodeURIComponent(env)}`,
      { method: 'PATCH', body: JSON.stringify({ environment }) },
    ),

  /** Deletes one environment — never production, which is the base itself. */
  deleteEnvironment: (base: string, env: string) =>
    data<Migration>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments/${encodeURIComponent(env)}`,
      { method: 'DELETE' },
    ),

  compareEnvironments: (base: string) =>
    data<EnvironmentComparison>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments/compare`,
    ),

  planStructure: (base: string, source: string, target: string) =>
    data<StructurePlan>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments/plan?${new URLSearchParams({ source, target })}`,
    ),

  applyStructure: (
    base: string,
    request: { source: string; target: string; steps: readonly string[]; consent: boolean },
  ) =>
    data<ApplyReport>(`${v1()}/admin/bases/${encodeURIComponent(base)}/environments/apply`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  countRows: (base: string, source: string, target: string) =>
    data<readonly TableRowCounts[]>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments/rows?${new URLSearchParams({ source, target })}`,
    ),

  compareRows: (base: string, table: string, source: string, target: string) =>
    data<RowComparison>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments/rows/${encodeURIComponent(table)}?${new URLSearchParams({ source, target })}`,
    ),

  syncRows: (
    base: string,
    table: string,
    request: { source: string; target: string; insert: boolean; update: boolean; delete: boolean },
  ) =>
    data<{ inserted: number; updated: number; deleted: number }>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/environments/rows/${encodeURIComponent(table)}/sync`,
      { method: 'POST', body: JSON.stringify(request) },
    ),

  /** The structure history of a base, most recent first (chapter 07 §8.1). */
  structureHistory: (base: string, before?: string) =>
    data<{ events: readonly StructureEvent[]; next: string | null }>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/structure-history${before === undefined ? '' : `?${new URLSearchParams({ before })}`}`,
    ),

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

  /** A live base's deleted tables — where their purge starts. */
  deletedTables: (base: string) =>
    data<readonly DeletedTable[]>(`${v1()}/admin/bases/${encodeURIComponent(base)}/deleted-tables`),

  /** What a physical rename would touch — shown before anyone confirms. */
  renameImpact: (kind: RenameImpact['kind'], id: string) =>
    data<RenameImpact>(`${v1()}/admin/physical/${kind}/${encodeURIComponent(id)}`),

  renamePhysical: (
    kind: RenameImpact['kind'],
    id: string,
    request: { name: string; confirm: string; alias?: boolean; alias_days?: number },
  ) =>
    data<{ name: string; alias: string | null; migration: Migration }>(
      `${v1()}/admin/physical/${kind}/${encodeURIComponent(id)}/rename`,
      { method: 'POST', body: JSON.stringify(request) },
    ),

  aliases: (base: string) =>
    data<readonly CompatibilityAlias[]>(`${v1()}/admin/aliases?base=${encodeURIComponent(base)}`),

  cutAlias: (id: string, days: number) =>
    data<CompatibilityAlias | null>(`${v1()}/admin/aliases/${encodeURIComponent(id)}/cut`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    }),

  restoreAlias: (id: string) =>
    data<CompatibilityAlias | null>(`${v1()}/admin/aliases/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    }),

  dropAlias: (id: string, confirm: string) =>
    call<void>(`${v1()}/admin/aliases/${encodeURIComponent(id)}/drop`, {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    }),

  /** Writes the export a purge requires, on the application host. */
  exportForPurge: (kind: 'base' | 'table', id: string) =>
    data<PurgeExport>(`${v1()}/admin/purge/exports`, {
      method: 'POST',
      body: JSON.stringify({ kind, id }),
    }),

  /** The one irreversible operation. */
  purge: (request: {
    kind: 'base' | 'table'
    id: string
    export: string
    confirm: string
    early_justification?: string
  }) =>
    data<{ purged_tables: number; residual_schema: boolean; migration: Migration }>(
      `${v1()}/admin/purge`,
      { method: 'POST', body: JSON.stringify(request) },
    ),

  migrations: (base: string) =>
    data<readonly Migration[]>(`${v1()}/admin/bases/${encodeURIComponent(base)}/migrations`),

  resumeMigration: (id: string) =>
    data<Migration>(`${v1()}/admin/migrations/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
    }),

  /** One row, by its identifier — what following a link opens. */
  getRecord: (table: TableRef, recordId: string) =>
    data<Record<string, unknown>>(`${path(table)}/${encodeURIComponent(recordId)}`),

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

  /**
   * One turn of the copilot: the whole conversation goes, the answer comes back with its
   * proposals. `readData` is the person's consent to rows being read for this turn.
   */
  copilot: (
    base: string,
    request: {
      table: string | null
      filter: string | null
      sort: string | null
      messages: readonly CopilotMessage[]
      readData: boolean
    },
  ) =>
    data<CopilotAnswer>(`${v1()}/ai/bases/${encodeURIComponent(base)}/copilot`, {
      method: 'POST',
      body: JSON.stringify({
        table: request.table,
        filter: request.filter,
        sort: request.sort,
        messages: request.messages,
        read_data: request.readData,
      }),
    }),

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

  /** A base's webhooks. */
  webhooks: (base: string) =>
    data<readonly Webhook[]>(`${v1()}/admin/webhooks?base=${encodeURIComponent(base)}`),

  /** Creates a webhook. The signing secret is in this answer and nowhere else. */
  createWebhook: (request: {
    readonly base: string
    readonly label: string
    readonly url: string
    readonly subscriptions: ReadonlyArray<{ table: string; events: readonly WebhookEvent[] }>
  }) =>
    data<Webhook & { readonly secret: string }>(`${v1()}/admin/webhooks`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  setWebhookActive: (id: string, active: boolean) =>
    data<Webhook>(`${v1()}/admin/webhooks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  deleteWebhook: (id: string) =>
    call<void>(`${v1()}/admin/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  webhookDeliveries: (id: string) =>
    data<readonly WebhookDelivery[]>(`${v1()}/admin/webhooks/${encodeURIComponent(id)}/deliveries`),

  /** The « Propositions » queue of a base: what agents proposed, newest first. */
  proposals: (base: string) =>
    data<readonly Proposal[]>(`${v1()}/admin/proposals?base=${encodeURIComponent(base)}`),

  /** Approves a proposal: every check is made again, then the change is applied. */
  approveProposal: (id: string) =>
    data<Proposal>(`${v1()}/admin/proposals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    }),

  rejectProposal: (id: string) =>
    data<Proposal>(`${v1()}/admin/proposals/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
    }),

  /** The Slack connections of a base (chapter 19 §1). */
  integrations: (base: string) =>
    data<readonly Integration[]>(`${v1()}/admin/bases/${encodeURIComponent(base)}/integrations`),

  createIntegration: (base: string, input: { label: string; url: string }) =>
    data<Integration>(`${v1()}/admin/bases/${encodeURIComponent(base)}/integrations`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteIntegration: (base: string, id: string) =>
    call<void>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/integrations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  testIntegration: (base: string, id: string) =>
    data<{ status: number }>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/integrations/${encodeURIComponent(id)}/test`,
      { method: 'POST' },
    ),

  /** The synced tables of a base (chapter 19 §3). */
  syncedTables: (base: string) =>
    data<readonly SyncedTable[]>(`${v1()}/admin/bases/${encodeURIComponent(base)}/synced-tables`),

  createSyncedTable: (
    base: string,
    input: {
      label: string
      source: { kind: SyncSourceKind; url: string }
      interval_minutes: number
    },
  ) =>
    data<SyncedTable>(`${v1()}/admin/bases/${encodeURIComponent(base)}/synced-tables`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateSyncedTable: (base: string, table: string, input: { interval_minutes: number }) =>
    data<SyncedTable>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/synced-tables/${encodeURIComponent(table)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),

  stopSyncedTable: (base: string, table: string) =>
    call<void>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/synced-tables/${encodeURIComponent(table)}`,
      { method: 'DELETE' },
    ),

  runSyncedTable: (base: string, table: string) =>
    data<SyncedTable>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/synced-tables/${encodeURIComponent(table)}/run`,
      { method: 'POST' },
    ),

  /** The dashboards of a base, for whoever sees it (chapter 18). */
  /** The gallery: the instance's templates, the site's, the carried ones (chapter 20). */
  templates: async (): Promise<TemplateCatalog> => {
    const r = await call<{
      data: readonly TemplateItem[]
      meta: { site: TemplateCatalog['site'] }
    }>(`${v1()}/meta/templates`)
    return { templates: r.data, site: r.meta.site }
  },

  template: async (key: string): Promise<{ template: Template; source: TemplateSource }> => {
    const r = await call<{ data: Template; meta: { source: TemplateSource } }>(
      `${v1()}/meta/templates/${encodeURIComponent(key)}`,
    )
    return { template: r.data, source: r.meta.source }
  },

  /** Imports a template into the instance, or replaces the one of the same key. */
  importTemplate: (template: unknown) =>
    data<TemplateItem>(`${v1()}/admin/templates`, {
      method: 'POST',
      body: JSON.stringify(template),
    }),

  deleteTemplate: (key: string) =>
    call<void>(`${v1()}/admin/templates/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  /** A template proposed by the AI from a sentence — or the previous proposal, refined. */
  draftTemplate: (request: { project: string; request: string; previous?: Template }) =>
    data<TemplateDraft>(`${v1()}/admin/templates/draft`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  dashboards: (base: string) =>
    data<readonly Dashboard[]>(`${v1()}/meta/bases/${encodeURIComponent(base)}/dashboards`),

  createDashboard: (
    base: string,
    input: { label: string; description?: string | null; blocks: readonly DashboardBlock[] },
  ) =>
    data<Dashboard>(`${v1()}/admin/bases/${encodeURIComponent(base)}/dashboards`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateDashboard: (
    base: string,
    id: string,
    input: {
      label?: string
      description?: string | null
      blocks?: readonly DashboardBlock[]
      position?: number
    },
  ) =>
    data<Dashboard>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/dashboards/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),

  deleteDashboard: (base: string, id: string) =>
    call<void>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/dashboards/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  /** The automations of a base (chapter 17). */
  automations: (base: string) =>
    data<readonly Automation[]>(`${v1()}/admin/bases/${encodeURIComponent(base)}/automations`),

  createAutomation: (base: string, input: AutomationInput) =>
    data<Automation>(`${v1()}/admin/bases/${encodeURIComponent(base)}/automations`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /** Rewrites an automation; whoever saves it becomes its owner. */
  updateAutomation: (base: string, id: string, input: AutomationInput) =>
    data<Automation>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/automations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),

  deleteAutomation: (base: string, id: string) =>
    call<void>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/automations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  automationRuns: (base: string, id: string) =>
    data<readonly AutomationRun[]>(
      `${v1()}/admin/bases/${encodeURIComponent(base)}/automations/${encodeURIComponent(id)}/runs`,
    ),

  /** Runs an automation for a row — a button clicked, or a test. */
  runAutomation: (id: string, record: string | null) =>
    data<{ run: string }>(`${v1()}/automations/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      body: JSON.stringify({ record }),
    }),

  /** Undoes a transaction of the caller's; returns the undo's own (chapter 16 §4). */
  undoTransaction: (transaction: string) =>
    data<{ transaction: string; revisions: number; tables: readonly string[] }>(
      `${v1()}/history/undo`,
      { method: 'POST', body: JSON.stringify({ transaction }) },
    ),

  /** The comments of a row, oldest first (chapter 16 §1). */
  comments: (table: TableRef, recordId: string) =>
    data<readonly RecordComment[]>(`${path(table)}/${encodeURIComponent(recordId)}/comments`),

  /** Adds a comment; `unreachable` names the mentioned people who cannot read the row. */
  addComment: async (table: TableRef, recordId: string, body: string) => {
    const r = await call<{ data: RecordComment; meta: { unreachable: readonly string[] } }>(
      `${path(table)}/${encodeURIComponent(recordId)}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
    )
    return { comment: r.data, unreachable: r.meta.unreachable }
  },

  editComment: (commentId: string, body: string) =>
    data<RecordComment>(`${v1()}/comments/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),

  deleteComment: (commentId: string) =>
    call<void>(`${v1()}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }),

  /** The caller's notifications, newest first; `unread` counts those not read. */
  notifications: async (options: { unread?: boolean; after?: string } = {}) => {
    const q = new URLSearchParams()
    if (options.unread === true) q.set('unread', 'true')
    if (options.after !== undefined) q.set('after', options.after)
    const query = q.toString()
    const r = await call<{
      data: readonly AppNotification[]
      meta: { unread: number; next_cursor: string | null }
    }>(`${v1()}/me/notifications${query === '' ? '' : `?${query}`}`)
    return { notifications: r.data, unread: r.meta.unread, nextCursor: r.meta.next_cursor }
  },

  markNotificationsRead: (request: { ids?: readonly string[]; all?: boolean }) =>
    data<{ marked: number }>(`${v1()}/me/notifications/read`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /** Moves an open stream's presence to another row of its table. */
  movePresence: (request: {
    session: string
    base: string
    table: string
    record: string | null
  }) => call<void>(`${v1()}/presence`, { method: 'POST', body: JSON.stringify(request) }),

  /** Moves this stream's pointer over the grid, `null` when it leaves it. */
  movePointer: (request: {
    session: string
    base: string
    table: string
    at: PointerAt | null
  }) => call<void>(`${v1()}/presence/pointer`, { method: 'POST', body: JSON.stringify(request) }),

  /** The history of one row, newest first. */
  recordHistory: (table: TableRef, recordId: string, cursor?: string) =>
    call<RevisionPage>(
      `${path(table)}/${recordId}/history${cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`}`,
    ),

  /** The activity of a base — or of one of its tables — newest first. */
  baseHistory: (base: string, options: { table?: string; cursor?: string } = {}) => {
    const q = new URLSearchParams()
    if (options.table !== undefined && options.table !== '') q.set('table', options.table)
    if (options.cursor !== undefined) q.set('cursor', options.cursor)
    const query = q.toString()
    return call<RevisionPage>(
      `${v1()}/meta/bases/${encodeURIComponent(base)}/history${query === '' ? '' : `?${query}`}`,
    )
  },

  /** Puts back the values a modification replaced. Refused if a field changed since. */
  revertRevision: (id: string) =>
    data<{ table_id: string; record_id: string }>(
      `${v1()}/history/${encodeURIComponent(id)}/revert`,
      { method: 'POST' },
    ),

  /** Brings a deleted row back, under its own identifier. */
  restoreRevision: (id: string) =>
    data<{ table_id: string; record_id: string }>(
      `${v1()}/history/${encodeURIComponent(id)}/restore`,
      { method: 'POST' },
    ),

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

  /** Who may create an account — the administrators' setting. */
  adminSignupPolicy: () => data<SignupPolicy>(`${v1()}/admin/signup`),

  setSignupPolicy: (policy: SignupPolicy) =>
    data<SignupPolicy>(`${v1()}/admin/signup`, {
      method: 'PUT',
      body: JSON.stringify(policy),
    }),

  /** Who has access to a project or a base, and who is invited — for its managers. */
  sharing: (kind: 'project' | 'base', id: string) =>
    data<Sharing>(`${v1()}/sharing/${kind}/${encodeURIComponent(id)}`),

  /** An invitation link, valid a week, at a level. */
  invite: (kind: 'project' | 'base', id: string, email: string, level: AccessLevel) =>
    data<Invitation>(`${v1()}/sharing/${kind}/${encodeURIComponent(id)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, level }),
    }),

  /** Changes what someone may do on the scope; `none` takes it back. */
  setPersonAccess: (kind: 'project' | 'base', id: string, user: string, level: AccessLevel) =>
    data<Sharing>(
      `${v1()}/sharing/${kind}/${encodeURIComponent(id)}/people/${encodeURIComponent(user)}`,
      { method: 'PUT', body: JSON.stringify({ level }) },
    ),

  revokeInvitation: (id: string) =>
    call<void>(`${v1()}/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** Accepts an invitation as the signed-in person: where it leads. */
  acceptInvitation: async (token: string) => {
    const accepted = await data<{ project_id: string; base_id: string | null }>(
      `${v1()}/invitations/accept`,
      { method: 'POST', body: JSON.stringify({ token }) },
    )
    return { projectId: accepted.project_id, baseId: accepted.base_id }
  },

  /** Each group's rules on the fields of one table. */
  fieldAccess: (tableId: string) =>
    data<FieldAccess>(`${v1()}/admin/access/tables/${encodeURIComponent(tableId)}/fields`),

  /** Sets one group's rule on one field — `null` lifts it. */
  setFieldRule: (fieldId: string, group: string, rule: FieldRule | null) =>
    data<FieldAccess>(`${v1()}/admin/access/fields/${encodeURIComponent(fieldId)}`, {
      method: 'PUT',
      body: JSON.stringify({ group, rule }),
    }),

  /** What a person ends up with on each field of a table. */
  effectiveMask: (tableId: string, userId: string) =>
    data<EffectiveMask>(
      `${v1()}/admin/access/tables/${encodeURIComponent(tableId)}/mask?user=${encodeURIComponent(userId)}`,
    ),
}
