import { createHmac, randomBytes } from 'node:crypto'
import { catalogMigrations } from '@basedb/catalog-schema'
import { ALL_ERROR_CODES, ERROR_CODES } from '@basedb/contracts'
import {
  type AccessChange,
  type AccessGraph,
  accessGraph,
  applyAccessChanges,
} from './admin/access.js'
import {
  type GroupSummary,
  createGroup,
  deleteGroup,
  ensureSystemGroups,
  listGroupMembers,
  listGroups,
  renameGroup,
  setGroupMembership,
} from './admin/groups.js'
import {
  type UserSummary,
  createUser,
  listUsers,
  resetUserPassword,
  setUserGroups,
  updateUser,
} from './admin/users.js'
import { type AgentCall, recordAgentCall } from './agent/audit.js'
import {
  agentDescribeBase,
  agentDescribeTable,
  agentListBases,
  agentWhoAmI,
} from './agent/describe.js'
import {
  type AgentListRequest,
  type AgentRows,
  type AgentWriteRequest,
  agentCreateRecord,
  agentGetRecord,
  agentListRecords,
  agentLookupRecords,
  agentUpdateRecord,
} from './agent/records.js'
import {
  type ExpressionDraft,
  type ExpressionDraftRequest,
  type ProviderTransport,
  type StructureDraft,
  type StructureDraftRequest,
  draftExpression,
  draftStructure,
} from './ai/draft.js'
import { type OidcProvider, loadProviders, requireProvider } from './auth/oidc-providers.js'
import {
  type AssertedIdentity,
  completeOidc,
  linkIdentity,
  resolveIdentity,
  startOidc,
  unlinkIdentity,
} from './auth/oidc.js'
import {
  type Authenticated,
  type IssuedSession,
  type LoginResult,
  type Mailer,
  authenticateAccessToken,
  authenticateCookie,
  changePassword,
  confirmPasswordReset,
  dropElevation,
  elevate,
  issueAccessToken,
  login,
  logout,
  requestPasswordReset,
  revoke,
  setPassword,
  whoAmI,
} from './auth/operations.js'
import { loginWithOidc } from './auth/operations.js'
import { elevated, listLiveSessions, loadSessionByToken } from './auth/session.js'
import {
  type ApiTokenSummary,
  type CreateApiTokenRequest,
  type IssuedApiToken,
  createApiToken,
  listApiTokens,
  revokeApiToken,
  verifyApiToken,
} from './auth/tokens.js'
import { DESCRIPTION_MAX_CHARS } from './catalog/description.js'
import { setFieldDescription, setTableDescription } from './catalog/descriptions.js'
import { type Documentation, toDocumentation } from './catalog/documentation.js'
import { setFieldLabel } from './catalog/field-label.js'
import {
  type AddFieldRequest,
  type AddedField,
  type RequiredResult,
  addField,
  setFieldRequired,
} from './catalog/fields.js'
import {
  type BaseSummary,
  deleteBase,
  deleteTable,
  listDeletedBases,
  previewTableDeletion,
  renameBaseLabel,
  restoreBase,
  updateBase,
} from './catalog/lifecycle.js'
import {
  type CreateLinkFieldRequest,
  type CreatedLinkField,
  createLinkField,
  setDisplayColumn,
} from './catalog/links.js'
import type { Look, LookInput } from './catalog/look.js'
import { toOpenApi } from './catalog/openapi.js'
import {
  type CreateBaseResult,
  type CreateTableResult,
  type FieldRequest,
  createBase,
  createTable,
} from './catalog/operations.js'
import {
  type ProjectedBase,
  type ResolvedTable,
  type VisibleBase,
  listVisibleBases,
  projectBase,
  resolveBase,
  resolveField,
  resolveTable,
} from './catalog/projection.js'
import {
  type ProjectSummary,
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from './catalog/projects.js'
import {
  type SelectOptionInput,
  type SetOptionsResult,
  setSelectOptions,
} from './catalog/select-options.js'
import { type MetaKind, type ServedMeta, serveMeta } from './catalog/serve.js'
import { type UpdatedTable, updateTable } from './catalog/table-edit.js'
import {
  type Migration,
  applyMigration,
  listMigrations,
  proposeMigration,
  reclaimStaleMigrations,
} from './ddl/migration.js'
import { BasedbError } from './errors/index.js'
import {
  DEFAULT_MAX_FILE_BYTES,
  type FileDeps,
  type OpenedFile,
  type UploadRequest,
  type UploadedFile,
  openFile,
  uploadFile,
  withFileLinks,
} from './files/operations.js'
import { type FileStorageConfig, createFileStorage } from './files/storage.js'
import {
  type CreateRecordOptions,
  type CreateRecordsOptions,
  type CreatedRecord,
  type CreatedRecords,
  createRecord,
  createRecords,
} from './records/create.js'
import {
  type InverseLinkBlock,
  type InverseLinks,
  listInverseLinks,
} from './records/inverse-links.js'
import { type ListOptions, type ListResult, listRecords } from './records/list.js'
import {
  type DeleteRecordOptions,
  type UpdateRecordOptions,
  type UpdatedRecord,
  deleteRecord,
  updateRecord,
} from './records/update.js'
import { Pools, type PoolsOptions } from './runtime/pool.js'
import {
  type SqlConsoleRequest,
  type SqlConsoleResult,
  closeConsolePools,
  runConsoleSql,
} from './sql/console.js'
import { type RequestContext, type Surface, sealContext } from './tx/context.js'

/**
 * `@basedb/core` — the kernel.
 *
 * CLOSED `exports` MAP (chapter 10 §2.4, lock 1). This package exports only OPERATIONS
 * and the types they exchange. The pools, the SQL builder and the executor appear in no
 * exported path: an adapter holds no object representing a connection, and there is no
 * way, from an adapter, to execute an arbitrary SQL string.
 *
 * The context is the first argument of every operation, and its factory is reachable
 * only through `openContext`: an adapter asserts no identity, it forwards a credential
 * that the kernel verifies (locks 2 and 3).
 */

export { BasedbError, businessError, type ErrorClass } from './errors/index.js'
export type { Actor, ActorKind, PermissionSnapshot, RequestContext, Surface } from './tx/context.js'
export type { AllocatedName, ObjectKind, ScopeKind } from './naming/allocation.js'
export type {
  CreateBaseResult,
  CreateTableResult,
  CreatedField,
  FieldRequest,
} from './catalog/operations.js'
export type { CreateLinkFieldRequest, CreatedLinkField, OnDelete } from './catalog/links.js'
export type { AddFieldRequest, AddedField, RequiredResult } from './catalog/fields.js'
export type { Look, LookInput } from './catalog/look.js'
export type { UpdatedTable } from './catalog/table-edit.js'
export type { SelectOption, SelectOptionInput, SetOptionsResult } from './catalog/select-options.js'
export type { FileStorageConfig } from './files/storage.js'
export type { OpenedFile, UploadRequest, UploadedFile } from './files/operations.js'
export { DEFAULT_MAX_FILE_BYTES } from './files/operations.js'
export { MAX_FILES_PER_VALUE } from './ddl/emit.js'
export {
  MAX_IMAGE_CHARS,
  MAX_LABEL_CHARS,
  MAX_OPTIONS,
  MAX_OPTION_CHARS,
} from './catalog/select-options.js'
export type { ListOptions, ListResult } from './records/list.js'
export { COUNT_CEILING } from './records/list.js'
export type { BaseSummary } from './catalog/lifecycle.js'
export { TABLE_BATCH } from './catalog/lifecycle.js'
export type { Migration, MigrationStatus, MigrationStep } from './ddl/migration.js'
export type { SqlColumn, SqlConsoleRequest, SqlConsoleResult } from './sql/console.js'
export { CONSOLE_DEFAULT_LIMIT, CONSOLE_MAX_LIMIT } from './sql/console.js'
export type {
  ExpressionDraft,
  ExpressionDraftRequest,
  ProviderName,
  ProviderTransport,
  StructureDraft,
  StructureDraftRequest,
  UsageKind,
} from './ai/draft.js'
export { DESCRIPTION_MAX_CHARS }
export type { DocSection, Documentation } from './catalog/documentation.js'
export { DOCUMENTED_MCP_TOOLS, toDocumentation } from './catalog/documentation.js'
export { CACHE_CONTROL, VARY } from './catalog/serve.js'
export type { MetaKind, ServedMeta } from './catalog/serve.js'
export { clearCaches, SNAPSHOT_TTL_MS, DOCUMENT_MAX_BYTES } from './catalog/cache.js'
export { toOpenApi } from './catalog/openapi.js'
export { escapeLabel } from './catalog/labels.js'
export type {
  ProjectedBase,
  ProjectedField,
  ProjectedLink,
  ProjectedTable,
  ResolvedTable,
  VisibleBase,
} from './catalog/projection.js'
export type { InverseLinkBlock, InverseLinks, ReferencingRow } from './records/inverse-links.js'
export type {
  CreateRecordOptions,
  CreateRecordsOptions,
  CreatedRecord,
  CreatedRecords,
} from './records/create.js'
export { BATCH_MAX_OPERATIONS } from './records/create.js'
export type { DeleteRecordOptions, UpdateRecordOptions, UpdatedRecord } from './records/update.js'
export type { Action, Decision, Verdict } from './rbac/decide.js'
export type {
  Authenticated,
  IssuedSession,
  LoginResult,
  MailMessage,
  Mailer,
} from './auth/operations.js'
export { ELEVATION_MS } from './auth/session.js'
export { OIDC_COOKIE, forgetDiscoveries } from './auth/oidc.js'
export type { AssertedIdentity } from './auth/oidc.js'
export type { OidcProvider } from './auth/oidc-providers.js'
export { seal } from './auth/sealing.js'
export { normalizeEmail } from './auth/operations.js'
export { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, SESSION_ABSOLUTE_MS } from './auth/session.js'
export { PASSWORD_MIN, PASSWORD_MAX } from './auth/password.js'
export type {
  ApiTokenSummary,
  CreateApiTokenRequest,
  IssuedApiToken,
  TokenAccess,
} from './auth/tokens.js'
export { TOKEN_DEFAULT_DAYS, TOKEN_MAX_DAYS, forgetVerifiedTokens } from './auth/tokens.js'
export type { AgentCall } from './agent/audit.js'
export type {
  AccessCell,
  AccessChange,
  AccessGraph,
  AccessLevel,
  AccessProject,
} from './admin/access.js'
export { ACCESS_LEVELS, LEVEL_ACTIONS } from './admin/access.js'
export type { GroupSummary, SystemGroup } from './admin/groups.js'
export type { UserSummary } from './admin/users.js'
export type { ProjectBase, ProjectSummary } from './catalog/projects.js'
export type { AgentNotice } from './agent/describe.js'
export { ON_DELETE_MEANING } from './agent/describe.js'
export type {
  AgentColumn,
  AgentListRequest,
  AgentPredicate,
  AgentRows,
  AgentWriteRequest,
  AgentWriteResult,
} from './agent/records.js'
export { AGENT_BOUNDS } from './agent/records.js'
export { OPERATORS } from './records/filter.js'

/**
 * The write budgets of chapter 09 §6.4, evaluated AFTER THE FACT by the process that
 * drains the journals — never counted on the request path. Published by `whoami` so an
 * agent knows the bound it runs under.
 */
export const AGENT_WRITE_BUDGETS = Object.freeze({
  rows_written_per_hour: 500,
  rows_written_per_table_per_hour: 200,
})

/** What the agent-surface description operations return, as the adapter receives them. */
export type AgentBaseList = Awaited<ReturnType<typeof agentListBases>>
export type AgentBaseDescription = Awaited<ReturnType<typeof agentDescribeBase>>
export type AgentTableDescription = Awaited<ReturnType<typeof agentDescribeTable>>
export type AgentIdentity = Awaited<ReturnType<typeof agentWhoAmI>>
export type AgentLookup = Awaited<ReturnType<typeof agentLookupRecords>>
export type AgentWrite = Awaited<ReturnType<typeof agentCreateRecord>>

export interface KernelConfig {
  readonly connectionString: string
  /**
   * Instance key (A25), from which the password pepper and the access-token signature
   * are derived by domain separation.
   *
   * Optional here and NOT defaulted: a silent default would be the same secret on every
   * installation, which is worse than no secret at all because it looks like one. Its
   * absence is an incident, raised the first time authentication is used — not at
   * startup, so an instance that does not use passwords still runs.
   */
  readonly encryptionKey?: string
  /**
   * Delivers a message — the operator's SMTP, wired by the adapter.
   *
   * Absent, nothing leaves and nothing is logged: a reset link in a log file is a reset
   * link anyone holding the log can use. Chapter 13 §7 gives the operational command
   * that serves as the way back in.
   */
  readonly mailer?: Mailer
  /**
   * Pool sizing and timeouts, per pool — for an entry point whose surface demands
   * shorter ones than the defaults (the agent surface: 5 s statements, 1 s locks,
   * chapter 09 §11.3).
   */
  readonly poolSettings?: PoolsOptions['settings']
  /**
   * Where the bytes of `file` and `image` fields go, and the largest one accepted.
   *
   * Absent, a local directory under the working directory: enough for one host in
   * development, and said at startup so nobody runs production on it by accident.
   */
  readonly files?: {
    readonly storage: FileStorageConfig
    readonly maxBytes?: number
  }
}

/**
 * The kernel as an adapter sees it: a closed list of operations.
 *
 * Each takes a context as its first argument and returns either a result or a typed
 * error. None takes or returns a connection.
 */
export interface Kernel {
  /** Applies the catalog migrations. Bootstrap only (chapter 10 §9.2). */
  migrateCatalog(): Promise<number>
  /**
   * Password login — chapter 13 §2.
   *
   * Every failure answers `CREDENTIALS_INVALID`, whatever its cause, and costs the same:
   * no response lets a caller tell a non-existent account from an existing one.
   */
  login(request: {
    email: string
    password: string
    ip?: string | null
    userAgent?: string | null
  }): Promise<LoginResult>
  /** Believes a session cookie — `/auth/*` only. */
  authenticateCookie(token: string | undefined): Promise<Authenticated>
  /** Believes an access token — `/api/v1` only. */
  authenticateAccessToken(token: string | undefined): Promise<Authenticated>
  /** Exchanges the cookie for a 15-minute access token. Writes nothing. */
  issueAccessToken(
    sessionToken: string | undefined,
    csrf: string | undefined,
  ): Promise<{ token: string; expiresAt: Date }>
  logout(sessionToken: string | undefined): Promise<void>
  whoAmI(authenticated: Authenticated): Promise<{
    readonly id: string
    readonly email: string
    readonly displayName: string
    readonly tenantRef: string
    readonly isInstanceAdmin: boolean
    /** Member of the Administrators, or an instance administrator. */
    readonly isAdmin: boolean
    /** A temporary password is in use: a new one is asked for before anything else. */
    readonly mustChangePassword: boolean
    readonly elevatedUntil: string | null
  }>
  listSessions(authenticated: Authenticated): Promise<
    ReadonlyArray<{
      id: string
      createdAt: string
      lastSeenAt: string
      ip: string | null
      userAgent: string | null
    }>
  >
  revokeSession(
    authenticated: Authenticated,
    scope: { kind: 'one'; sessionId: string } | { kind: 'all' },
  ): Promise<void>
  /** Sets a password without checking a previous one — bootstrap and administration. */
  setPassword(request: { userId: string; password: string }): Promise<void>
  /**
   * Changes a password and hands back a FRESH session — §2.3.
   *
   * Every other session of the user is closed. Leaving the caller signed out too would
   * make the safe action the inconvenient one, which is how it stops being taken.
   */
  changePassword(request: {
    userId: string
    current: string
    next: string
  }): Promise<IssuedSession>
  /**
   * Elevation — §5. Five minutes, on the session, proved by the current password, and
   * never extended by use. The session token rotates with it.
   */
  elevate(
    sessionToken: string | undefined,
    password: string,
  ): Promise<{ session: IssuedSession; elevatedUntil: Date }>
  dropElevation(sessionToken: string | undefined): Promise<void>
  /** Opens a password reset. Answers nothing, always, and immediately (§2.3). */
  requestPasswordReset(email: string): Promise<void>
  confirmPasswordReset(request: { secret: string; password: string }): Promise<void>
  /** Providers this tenant accepts — nothing that depends on an address (§6). */
  oidcProviders(tenantRef: string): Promise<ReadonlyArray<{ slug: string; label: string }>>
  /** Opens an exchange: the authorize URL, and the sealed cookie that carries its state. */
  oidcStart(request: {
    tenantRef: string
    slug: string
    redirectUri: string
    returnTo?: string
  }): Promise<{ authorizeUrl: string; exchangeCookie: string }>
  /**
   * Completes an exchange and opens a session.
   *
   * Attachment is by `sub`, never by address: an address already held by an account
   * without an identity for this provider is refused, not silently adopted.
   */
  oidcCallback(request: {
    tenantRef: string
    slug: string
    code?: string
    state?: string
    cookie?: string
    ip?: string | null
    userAgent?: string | null
  }): Promise<{ session: IssuedSession; returnTo: string; provisioned: boolean }>
  /** Links a provider identity to the caller — demands an ELEVATED session (§5). */
  oidcLink(request: {
    sessionToken: string | undefined
    tenantRef: string
    slug: string
    code?: string
    state?: string
    cookie?: string
  }): Promise<void>
  oidcUnlink(request: { sessionToken: string | undefined; slug: string }): Promise<void>
  /**
   * Bootstraps the instance: one tenant and its first administrator.
   *
   * Idempotent — restarting does not create a second administrator. It is the only
   * write in the product that does not go through an authorization decision, and for
   * good reason: no actor exists yet to carry one (chapter 05 §12).
   */
  bootstrap(request: { readonly tenantRef: string; readonly email: string }): Promise<{
    readonly tenantId: string
    readonly userId: string
    readonly alreadyDone: boolean
  }>
  /**
   * Opens a context for a user, after CHECKING them against the catalog.
   *
   * This is the only reachable context factory. An unknown or disabled identifier does
   * not produce an empty context: it produces a refusal.
   */
  openContext(credential: {
    readonly userId: string
    readonly requestId: string
    readonly surface: Surface
    readonly timeoutMs?: number
  }): Promise<RequestContext>
  /**
   * Believes an integration token on one surface, and opens its context — chapter 05
   * §2.3, chapter 09 §9.3.
   *
   * The actor is the token: `actor.kind = 'token'`, `actor.tokenId` the token,
   * `actor.id` its creator. What it may do is its role intersected with its creator's
   * rights, recomputed at every decision. Refusals name why: `TOKEN_INVALID`,
   * `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_SUSPENDED`.
   */
  openTokenContext(credential: {
    readonly secret: string | undefined
    readonly surface: Surface
    readonly requestId: string
    readonly timeoutMs?: number
    readonly ip?: string | null
  }): Promise<RequestContext>
  /**
   * Mints an integration token — chapter 08 §11. The secret is in the result and
   * nowhere else, ever. Demands a session elevated minutes ago and `manage_tokens` on
   * the base; the token's role never carries more than its creator holds there.
   */
  createApiToken(ctx: RequestContext, request: CreateApiTokenRequest): Promise<IssuedApiToken>
  /** A base's tokens — metadata, prefix, state; never a secret. */
  listApiTokens(
    ctx: RequestContext,
    request: { readonly baseId: string },
  ): Promise<readonly ApiTokenSummary[]>
  /** Revokes a token at once and for good. Demands an elevated session. */
  revokeApiToken(
    ctx: RequestContext,
    request: { readonly tokenId: string; readonly sessionId: string },
  ): Promise<void>
  /** `whoami` of the agent surface — chapter 09 §2.2. */
  agentWhoAmI(
    ctx: RequestContext,
    budgets?: Readonly<Record<string, number>>,
  ): Promise<AgentIdentity>
  /** `list_bases`: the bases with at least one readable table, open to agents. */
  agentListBases(ctx: RequestContext): Promise<AgentBaseList>
  /** `describe_base` — §4.1. */
  agentDescribeBase(ctx: RequestContext, base: string): Promise<AgentBaseDescription>
  /** `describe_table` — §4.2. */
  agentDescribeTable(
    ctx: RequestContext,
    base: string,
    table: string,
  ): Promise<AgentTableDescription>
  /** `list_records` — §5.1. */
  agentListRecords(ctx: RequestContext, request: AgentListRequest): Promise<AgentRows>
  /** `get_record` — §5.2. */
  agentGetRecord(
    ctx: RequestContext,
    request: {
      readonly base: string
      readonly table: string
      readonly id: string
      readonly select?: readonly string[]
      readonly expand?: readonly string[]
      readonly expandFields?: readonly string[]
    },
  ): Promise<AgentRows>
  /** `lookup_records` — §5.3. */
  agentLookupRecords(
    ctx: RequestContext,
    request: {
      readonly base: string
      readonly table: string
      readonly value: string
      readonly limit?: number
    },
  ): Promise<AgentLookup>
  /** `create_record` — §6.1. */
  agentCreateRecord(ctx: RequestContext, request: AgentWriteRequest): Promise<AgentWrite>
  /** `update_record` — §6.2. */
  agentUpdateRecord(
    ctx: RequestContext,
    request: AgentWriteRequest & { readonly id: string },
  ): Promise<AgentWrite>
  /** The audit line of one agent call — the shape of its parameters, never their values. */
  recordAgentCall(ctx: RequestContext, call: AgentCall): Promise<void>
  createBase(
    ctx: RequestContext,
    request: {
      label: string
      technicalName?: string
      description?: string | null
      /** The project to create it in — the tenant's first when absent. */
      projectId?: string
    },
  ): Promise<CreateBaseResult>
  /**
   * The projects the caller can see, with the bases and tables they can see in each —
   * the navigation of the interface (chapter 05 §15).
   */
  listProjects(ctx: RequestContext): Promise<readonly ProjectSummary[]>
  /** Creates a project. `manage_schema` on the tenant: the Administrators. */
  createProject(
    ctx: RequestContext,
    request: { label: string; description?: string | null },
  ): Promise<{ readonly id: string; readonly label: string; readonly description: string | null }>
  /** Renames a project, or changes what it is for. `manage_schema` on the project. */
  updateProject(
    ctx: RequestContext,
    request: { projectId: string; label?: string; description?: string | null },
  ): Promise<{ readonly label: string; readonly description: string | null }>
  /** Deletes an empty project (`PROJECT_NOT_EMPTY` otherwise). */
  deleteProject(ctx: RequestContext, request: { projectId: string }): Promise<void>
  /** The tenant's accounts — administration only. */
  listUsers(ctx: RequestContext): Promise<readonly UserSummary[]>
  /**
   * Creates an account and returns its temporary password, shown this once. Every
   * administration write demands a session elevated minutes ago (05 §2.2).
   */
  createUser(
    ctx: RequestContext,
    request: {
      email: string
      displayName: string
      groupIds?: readonly string[]
      sessionId: string
    },
  ): Promise<{ readonly user: UserSummary; readonly temporaryPassword: string }>
  /** Renames, deactivates or reactivates an account. */
  updateUser(
    ctx: RequestContext,
    request: { userId: string; displayName?: string; disabled?: boolean; sessionId: string },
  ): Promise<UserSummary>
  /** A new temporary password; every session of the account is closed. */
  resetUserPassword(
    ctx: RequestContext,
    request: { userId: string; sessionId: string },
  ): Promise<{ readonly temporaryPassword: string }>
  /** Sets the groups of an account — « Tous les utilisateurs » always included. */
  setUserGroups(
    ctx: RequestContext,
    request: { userId: string; groupIds: readonly string[]; sessionId: string },
  ): Promise<UserSummary>
  /** The tenant's groups, the two system groups first. */
  listGroups(ctx: RequestContext): Promise<readonly GroupSummary[]>
  createGroup(
    ctx: RequestContext,
    request: { label: string; sessionId: string },
  ): Promise<GroupSummary>
  renameGroup(
    ctx: RequestContext,
    request: { groupId: string; label: string; sessionId: string },
  ): Promise<{ readonly label: string }>
  deleteGroup(ctx: RequestContext, request: { groupId: string; sessionId: string }): Promise<void>
  listGroupMembers(
    ctx: RequestContext,
    request: { groupId: string },
  ): Promise<ReadonlyArray<{ id: string; email: string; displayName: string }>>
  setGroupMembership(
    ctx: RequestContext,
    request: { groupId: string; userId: string; member: boolean; sessionId: string },
  ): Promise<void>
  /** The permission grid: every group, every project, base and table, and each level. */
  accessGraph(ctx: RequestContext): Promise<AccessGraph>
  /** Sets levels on the grid, Metabase-style, and returns the new grid. */
  applyAccessChanges(
    ctx: RequestContext,
    request: { changes: readonly AccessChange[]; sessionId: string },
  ): Promise<AccessGraph>
  createTable(
    ctx: RequestContext,
    request: {
      baseId: string
      label: string
      technicalName?: string
      description?: string | null
      fields: readonly FieldRequest[]
    },
  ): Promise<CreateTableResult>
  createLinkField(ctx: RequestContext, request: CreateLinkFieldRequest): Promise<CreatedLinkField>
  /**
   * Adds a column to an existing table — chapter 04 §1.3.
   *
   * ALWAYS nullable, whatever the caller asks: `ADD COLUMN … NOT NULL` without a default
   * fails on a populated table, and v1 has no defaults. The obligation is a separate
   * step, `setFieldRequired`.
   */
  addField(ctx: RequestContext, request: AddFieldRequest): Promise<AddedField>
  /**
   * Makes a field required, in the four steps of §1.3 — so that `SET NOT NULL` is
   * instant instead of holding the table for the length of a full scan.
   */
  setFieldRequired(
    ctx: RequestContext,
    request: { fieldId: string; required: boolean },
  ): Promise<RequiredResult>
  setDisplayColumn(
    ctx: RequestContext,
    request: { tableId: string; fieldId: string | null },
  ): Promise<{ readonly fieldId: string | null; readonly name: string | null }>
  /**
   * The bases the caller can see — chapter 08 §9.1.
   *
   * A base appears if and only if the caller holds `read` on at least one of its
   * tables; otherwise it does not exist for them.
   */
  listVisibleBases(ctx: RequestContext): Promise<readonly VisibleBase[]>
  /**
   * The projected description of a base: tables, fields, types, links.
   *
   * The SAME projection will serve the OpenAPI serialization and the readable
   * documentation (§9.1) — three views of one tree, so that no route can filter less
   * than its neighbour.
   */
  projectBase(ctx: RequestContext, reference: string): Promise<ProjectedBase>
  /**
   * OpenAPI 3.1 serialization of that SAME projection (§9.1).
   *
   * Second serialization, never a second source: a specification filtering by its own
   * means would end up filtering differently from `/meta`, and the looser of the two
   * would become the leak.
   */
  openApi(ctx: RequestContext, reference: string): Promise<Record<string, unknown>>
  /** Readable documentation of the same projection, for a human integrator (§9.4). */
  documentation(ctx: RequestContext, reference: string): Promise<Documentation>
  /**
   * Serves one of the four catalog documents WITH its validator (§9.2).
   *
   * A `304` is answered without building the document: the `ETag` derives from the two
   * counters, not from the bytes.
   */
  serveMeta(
    ctx: RequestContext,
    kind: MetaKind,
    reference: string,
    ifNoneMatch?: string,
  ): Promise<ServedMeta>
  /**
   * Resolves `{base}/{table}` to a catalog key — chapter 08 §1.1.
   *
   * An unknown name and an invisible table produce the same refusal, decided on the
   * in-memory catalog so that the two cost the same (§7.2).
   */
  resolveTable(ctx: RequestContext, baseRef: string, tableRef: string): Promise<ResolvedTable>
  /**
   * Resolves a base for a SCHEMA operation — WITHOUT the visibility rule of §9.1, which
   * would make a base with no table yet unreachable, hence its first table impossible
   * to create.
   */
  resolveBase(
    ctx: RequestContext,
    reference: string,
  ): Promise<{ readonly baseId: string; readonly baseName: string }>
  /** Resolves a field by NAME within its table — identifiers are not published. */
  resolveField(
    ctx: RequestContext,
    baseRef: string,
    tableRef: string,
    fieldRef: string,
  ): Promise<{ readonly fieldId: string; readonly tableId: string; readonly name: string }>
  /**
   * Renames a base's LABEL — chapter 06 §1.1.
   *
   * One catalog row, no DDL, no lock on a data table, and not a migration. The physical
   * schema name does not move, so no SQL consumer notices.
   */
  renameBase(
    ctx: RequestContext,
    request: { baseId: string; label: string },
  ): Promise<{ readonly label: string }>
  /**
   * Changes a base's label, description and/or look in one catalog write.
   *
   * `undefined` leaves a field as it is; a description is cleared with `null`. The look —
   * colour, pictogram, picture — is replaced whole as soon as one of its keys is named.
   * Same register as `renameBase`: no DDL, no migration.
   */
  updateBase(
    ctx: RequestContext,
    request: { baseId: string; label?: string; description?: string | null; look?: LookInput },
  ): Promise<{ readonly label: string; readonly description: string | null } & Look>
  /**
   * Changes a table's label and/or look. The relation keeps its physical name; the
   * `COMMENT ON TABLE` follows a new label in the same transaction.
   */
  updateTable(
    ctx: RequestContext,
    request: { tableId: string; label?: string; look?: LookInput },
  ): Promise<UpdatedTable>
  /**
   * Sets or clears the description of a table — what it is FOR, for the documentation
   * and for agents. Rewrites the `COMMENT ON TABLE` in the same transaction.
   */
  setTableDescription(
    ctx: RequestContext,
    request: { tableId: string; description: string | null },
  ): Promise<{ readonly description: string | null }>
  /** Same, for one field — and its `COMMENT ON COLUMN`. */
  setFieldDescription(
    ctx: RequestContext,
    request: { fieldId: string; description: string | null },
  ): Promise<{ readonly description: string | null }>
  /**
   * Renames a field's LABEL — chapter 06 §1.1. The column keeps its physical name: only
   * what a person reads changes, and the `COMMENT ON COLUMN` with it.
   */
  setFieldLabel(
    ctx: RequestContext,
    request: { fieldId: string; label: string },
  ): Promise<{ readonly label: string }>
  /**
   * Replaces the options of a `select`, in the given order — chapter 04 §3: the values
   * already there are updated, the new ones added, the absent ones removed (`OPTION_IN_USE`
   * while rows still carry them). Regenerates the `CHECK` only when the set of values moves.
   */
  setSelectOptions(
    ctx: RequestContext,
    request: { fieldId: string; options: readonly SelectOptionInput[] },
  ): Promise<SetOptionsResult>
  /**
   * Deletes a base LOGICALLY — chapter 06 §4.3.
   *
   * A multi-step plan, run by the migration state machine: links, then tables ten at a
   * time, then the alias schemas, then `ALTER SCHEMA … RENAME TO … zz_supprime_…`.
   * Nothing is dropped; the data stays readable in direct SQL, which is what makes
   * `restoreBase` exact.
   */
  deleteBase(ctx: RequestContext, request: { baseId: string }): Promise<Migration>
  /**
   * Deletes ONE table, logically — chapter 06 §4.2.
   *
   * Its rows, its indexes and its attribute numbers stay; the table is renamed
   * `zz_supprime_<date>_<nom>` and its fields follow in the same step, because
   * `ck_field_table_live` forbids a live field under a dead table.
   */
  deleteTable(ctx: RequestContext, request: { tableId: string }): Promise<Migration>
  /** What that deletion would do, without doing it — for the confirmation screen. */
  previewTableDeletion(
    ctx: RequestContext,
    tableId: string,
  ): Promise<{
    readonly label: string
    readonly rowCount: number | null
    readonly referencedBy: readonly string[]
    readonly lockedTables: readonly string[]
    readonly relegatedName: string
  }>
  /** Brings a logically deleted base back — chapter 06 §6. */
  restoreBase(ctx: RequestContext, request: { baseId: string }): Promise<Migration>
  /** The tenant's deleted bases. Empty for an actor without the administration role. */
  listDeletedBases(ctx: RequestContext): Promise<readonly BaseSummary[]>
  /** A base's migrations, newest first — what the structure screen shows. */
  listMigrations(ctx: RequestContext, baseId: string): Promise<readonly Migration[]>
  /** Resumes a plan left `interrupted`, from the step it stopped at. */
  resumeMigration(ctx: RequestContext, migrationId: string): Promise<Migration>
  /**
   * Drafts a filter expression from a sentence — chapter 12 §1.2, `expression_draft`.
   *
   * The transport is supplied by the caller: the kernel decides, the adapter calls
   * (§2.3). Nothing but labels, types and physical column names leaves; no cell value,
   * no identifier, no tenant reference.
   */
  draftExpression(
    ctx: RequestContext,
    transport: ProviderTransport,
    request: ExpressionDraftRequest,
  ): Promise<ExpressionDraft>
  /** Drafts tables, fields and links from a need — §1.2, `structure_draft`. */
  draftStructure(
    ctx: RequestContext,
    transport: ProviderTransport,
    request: StructureDraftRequest,
  ): Promise<StructureDraft>
  /**
   * Runs a statement against one base's schema — the SQL console.
   *
   * The ONE operation of this kernel that takes a SQL string, and it exists against the
   * grain of chapters 09 and 10, by the owner's decision. It runs on a SEPARATE
   * PostgreSQL login role holding nothing but that one schema, so `_basedb` is out of
   * reach, and every call is written to `audit_log`.
   */
  runSql(ctx: RequestContext, request: SqlConsoleRequest): Promise<SqlConsoleResult>
  listRecords(ctx: RequestContext, options: ListOptions): Promise<ListResult>
  /** The rows referencing a given row — chapter 04 §6. */
  listInverseLinks(
    ctx: RequestContext,
    options: { tableId: string; recordId: string },
  ): Promise<InverseLinks>
  createRecord(ctx: RequestContext, options: CreateRecordOptions): Promise<CreatedRecord>
  /**
   * Creates many records, ALL OR NOTHING — chapter 08 §3.5 (`atomic: true`). Every refusal
   * carries `details.index`, the position of the row that caused it.
   */
  createRecords(ctx: RequestContext, options: CreateRecordsOptions): Promise<CreatedRecords>
  updateRecord(ctx: RequestContext, options: UpdateRecordOptions): Promise<UpdatedRecord>
  deleteRecord(
    ctx: RequestContext,
    options: DeleteRecordOptions,
  ): Promise<{ readonly deleted: string; readonly sql: string }>
  /**
   * Deposits a file for a `file` or `image` field — chapter 04 §3 bis. The file is
   * attached to nothing until a row write cites the identifier returned.
   */
  uploadFile(ctx: RequestContext, request: UploadRequest): Promise<UploadedFile>
  /**
   * Opens a file through a link a read handed out. No context: the signed link IS the
   * credential, which is what lets an `<img src>` show a picture.
   */
  openFile(request: {
    tenant: string
    id: string
    expires: string | undefined
    signature: string | undefined
  }): Promise<OpenedFile>
  /** Where the files go, for the startup log; and the largest deposit, for the adapter. */
  readonly files: { readonly storage: string; readonly maxBytes: number }
  close(): Promise<void>
}

/**
 * The level a code carries in `_basedb.error_code`, derived from its HTTP status.
 *
 * Derived rather than stored a second time: the registry already fixes the status, and
 * a hand-kept second column would drift from it silently. The table's own CHECK is what
 * bounds the vocabulary.
 */
function levelOf(status: number | null): string {
  if (status === null) return 'incident'
  if (status === 401 || status === 403) return 'permission'
  if (status === 409 || status === 412 || status === 423 || status === 428) return 'conflict'
  if (status >= 500) return 'incident'
  return 'validation'
}

/** Default request deadline (chapter 10 §4.3). */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Starts the kernel.
 *
 * The pools are created here and never leave: they are captured by the operations'
 * closure. That is what makes lock 1 true by construction rather than by convention.
 */
export function startKernel(config: KernelConfig): Kernel {
  const pools = new Pools({
    connectionString: config.connectionString,
    settings: config.poolSettings,
  })

  /**
   * The key of the audit's value digests. Without an instance key, one drawn per
   * process: digests then correlate calls within a run only, which degrades the
   * correlation and never discloses a value.
   */
  const digestKey = config.encryptionKey || randomBytes(32).toString('base64')

  /**
   * Files: the storage, and the key file links are signed with — derived from the
   * instance key by domain separation, or, without one, from the per-process key above:
   * links then die with the process, which breaks nothing a reload does not repair.
   */
  const storage = createFileStorage(
    config.files?.storage ?? { driver: 'local', directory: '.basedb/files' },
  )
  const files: FileDeps = {
    pools,
    storage,
    maxBytes: config.files?.maxBytes ?? DEFAULT_MAX_FILE_BYTES,
    linkKey: createHmac('sha256', digestKey).update('basedb/files/link/v1').digest(),
  }
  const linked = <T extends { readonly fileColumns: readonly string[] }>(
    ctx: RequestContext,
    result: T & { readonly row: Record<string, unknown> },
  ): T =>
    result.fileColumns.length === 0
      ? result
      : { ...result, row: withFileLinks(files.linkKey, ctx, [result.row], result.fileColumns)[0] }

  /**
   * The instance key, demanded at the moment it is needed.
   *
   * An incident, not a business error: the caller has done nothing wrong and learns
   * nothing — the operator reads the reason in the log. Raising it here rather than at
   * startup keeps an instance that never authenticates by password working.
   */
  const instanceKey = (): string => {
    if (config.encryptionKey === undefined || config.encryptionKey === '') {
      throw new BasedbError('INTERNAL_ERROR', {
        details: { reason: 'BASEDB_ENCRYPTION_KEY absente' },
      })
    }
    return config.encryptionKey
  }

  /**
   * Mirrors the shared registry into `_basedb.error_code`.
   *
   * The registry in `@basedb/contracts` is generated from chapter 00's annex and is the
   * source of truth; the table is its projection, and it exists because catalog rows
   * REFERENCE it — `migration.error_code` carries a foreign key, so a failed migration
   * could not even be recorded without this. Codes are added, never renamed nor
   * re-meant (A23), so the upsert only ever grows the table.
   */
  const seedErrorCodes = async (): Promise<void> => {
    const rows = ALL_ERROR_CODES.map((code) => {
      const entry = ERROR_CODES[code]
      return [code, entry.chapter, levelOf(entry.httpStatus), entry.httpStatus, entry.condition]
    })

    await pools.withConnection('catalog', async (exec) => {
      for (const [code, origin, level, status, description] of rows) {
        await exec.query(
          `INSERT INTO _basedb.error_code (code, origin, level, http_status, description)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (code) DO UPDATE
             SET origin = EXCLUDED.origin, level = EXCLUDED.level,
                 http_status = EXCLUDED.http_status, description = EXCLUDED.description`,
          [code, origin, level, status, description],
          'insert',
        )
      }
    })
  }

  /**
   * Creates this month's partitions, and the two after it, for every journal.
   *
   * `ai_call`, `audit_log` and `security_log` are declared `PARTITION BY RANGE
   * (occurred_at)` and ship with none: an insert into a partitioned table with no
   * matching partition fails outright, so the first AI call — or the first console
   * statement — would error on its own journal entry. No DEFAULT partition: one would
   * make every later monthly partition impossible to attach.
   */
  const ensureJournalPartitions = async (): Promise<void> => {
    const now = new Date()
    await pools.withConnection('ddl', async (exec) => {
      for (const journal of ['ai_call', 'audit_log', 'security_log']) {
        for (let offset = 0; offset <= 2; offset++) {
          const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
          const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1))
          const suffix = `${from.getUTCFullYear()}_${String(from.getUTCMonth() + 1).padStart(2, '0')}`
          await exec.query(
            `CREATE TABLE IF NOT EXISTS _basedb.${journal}_${suffix}
               PARTITION OF _basedb.${journal}
               FOR VALUES FROM ('${from.toISOString()}') TO ('${to.toISOString()}')`,
            [],
            'ddl',
          )
        }
      }
    })
  }

  return {
    async migrateCatalog() {
      const migrations = catalogMigrations()
      await pools.withConnection('ddl', async (exec) => {
        for (const m of migrations) await exec.query(m.sql, [], 'ddl')
      })
      await seedErrorCodes()
      await ensureJournalPartitions()
      // A plan whose lease expired while a process was down is moved to `interrupted`,
      // never replayed on its own (chapter 06 §1.3). It stops the base from looking
      // like it has a migration running, and leaves a human something to resume.
      await reclaimStaleMigrations(pools)
      return migrations.length
    },

    async bootstrap(request) {
      return pools.withConnection('catalog', async (exec) => {
        const existing = await exec.query<{ tenant_id: string; user_id: string }>(
          `SELECT t.id AS tenant_id, u.id AS user_id
             FROM _basedb.tenant t
             JOIN _basedb.app_user u ON u.tenant_id = t.id AND u.is_instance_admin
            WHERE t.ref = $1`,
          [request.tenantRef],
        )
        const found = existing[0]
        if (found !== undefined) {
          return { tenantId: found.tenant_id, userId: found.user_id, alreadyDone: true }
        }

        // The tenant ↔ app_user cycle requires a single transaction with deferred
        // constraints: each one requires the other.
        await exec.query('BEGIN')
        const [t] = await exec.query<{ id: string; created_by: string }>(
          `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
           VALUES ($1, $2, true, _basedb_local.uuid_generate_v7())
           RETURNING id, created_by`,
          [request.tenantRef, request.tenantRef],
          'insert',
        )
        await exec.query(
          `INSERT INTO _basedb.app_user
             (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
           VALUES ($1, $2, $3, 'Administration', true, true, $1, $1)`,
          [t.created_by, t.id, request.email],
          'insert',
        )
        // The two system groups — the first account is an Administrator, and belongs to
        // everyone — and a first project to create bases in (chapter 05 §15).
        await ensureSystemGroups(exec, request.tenantRef, t.created_by)
        await exec.query(
          `INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
           VALUES ($1, 'Projet principal', 'projet principal', $2, $2)`,
          [t.id, t.created_by],
          'insert',
        )
        await exec.query('COMMIT')
        return { tenantId: t.id, userId: t.created_by, alreadyDone: false }
      })
    },

    async openContext(credential) {
      const rows = await pools.withConnection('catalog', (exec) =>
        exec.query<{ id: string; tenant_ref: string }>(
          `SELECT u.id, t.ref AS tenant_ref
             FROM _basedb.app_user u
             JOIN _basedb.tenant t ON t.id = u.tenant_id
            WHERE u.id = $1 AND u.disabled_at IS NULL AND u.deleted_at IS NULL`,
          [credential.userId],
        ),
      )

      const user = rows[0]
      if (user === undefined) {
        // Missing authentication is never disguised as a missing resource: a client
        // must be able to reconnect (§3.2 step 1).
        throw new BasedbError('AUTHENTICATION_REQUIRED')
      }

      const now = new Date()
      return sealContext({
        requestId: credential.requestId,
        actor: { kind: 'user', id: user.id },
        tenantId: user.tenant_ref,
        surface: credential.surface,
        timestamp: now,
        deadline: new Date(now.getTime() + (credential.timeoutMs ?? DEFAULT_TIMEOUT_MS)),
        permissions: { version: '1', rowPredicate: 'TRUE' },
      })
    },

    async openTokenContext(credential) {
      const token = await verifyApiToken(pools, credential.secret, credential.surface, {
        requestId: credential.requestId,
        ip: credential.ip,
      })
      const now = new Date()
      return sealContext({
        requestId: credential.requestId,
        actor: { kind: 'token', id: token.userId, tokenId: token.tokenId },
        tenantId: token.tenantRef,
        surface: credential.surface,
        timestamp: now,
        deadline: new Date(now.getTime() + (credential.timeoutMs ?? DEFAULT_TIMEOUT_MS)),
        permissions: { version: '1', rowPredicate: 'TRUE' },
      })
    },

    createApiToken: (ctx, request) => createApiToken(pools, ctx, request),
    listApiTokens: (ctx, request) => listApiTokens(pools, ctx, request),
    revokeApiToken: (ctx, request) => revokeApiToken(pools, ctx, request),

    agentWhoAmI: (ctx, budgets) =>
      agentWhoAmI(pools, ctx, { ...AGENT_WRITE_BUDGETS, ...(budgets ?? {}) }),
    agentListBases: (ctx) => agentListBases(pools, ctx),
    agentDescribeBase: (ctx, base) => agentDescribeBase(pools, ctx, base),
    agentDescribeTable: (ctx, base, table) => agentDescribeTable(pools, ctx, base, table),
    agentListRecords: (ctx, request) => agentListRecords(pools, ctx, request),
    agentGetRecord: (ctx, request) => agentGetRecord(pools, ctx, request),
    agentLookupRecords: (ctx, request) => agentLookupRecords(pools, ctx, request),
    agentCreateRecord: (ctx, request) => agentCreateRecord(pools, ctx, request),
    agentUpdateRecord: (ctx, request) => agentUpdateRecord(pools, ctx, request),
    recordAgentCall: (ctx, call) => recordAgentCall(pools, ctx, digestKey, call),

    login: (request) => login(pools, instanceKey(), request),
    authenticateCookie: (token) => authenticateCookie(pools, token),
    authenticateAccessToken: (token) => authenticateAccessToken(pools, instanceKey(), token),
    issueAccessToken: (token, csrf) => issueAccessToken(pools, instanceKey(), token, csrf),
    logout: (token) => logout(pools, token),
    whoAmI: (authenticated) => whoAmI(pools, authenticated),
    listSessions: (authenticated) => listLiveSessions(pools, authenticated.userId),
    revokeSession: (authenticated, scope) => revoke(pools, authenticated, scope),
    setPassword: (request) => setPassword(pools, instanceKey(), request),
    changePassword: (request) => changePassword(pools, instanceKey(), request),
    elevate: (token, password) => elevate(pools, instanceKey(), token, password),
    dropElevation: (token) => dropElevation(pools, token),
    requestPasswordReset: (email) => requestPasswordReset(pools, { email, mailer: config.mailer }),
    confirmPasswordReset: (request) => confirmPasswordReset(pools, instanceKey(), request),

    oidcProviders: async (tenantRef) => {
      const providers = await pools.withConnection('catalog', (exec) =>
        loadProviders(exec, instanceKey(), tenantRef),
      )
      // The slug and the label, and nothing else: a client identifier or an issuer would
      // describe the operator's arrangements to anyone who asks.
      return providers.map((p) => ({ slug: p.slug, label: p.label }))
    },

    oidcStart: async (request) => {
      const provider = await requireProvider(pools, instanceKey(), request.tenantRef, request.slug)
      return startOidc(instanceKey(), provider, {
        redirectUri: request.redirectUri,
        returnTo: request.returnTo,
      })
    },

    oidcCallback: async (request) => {
      const key = instanceKey()
      const provider = await requireProvider(pools, key, request.tenantRef, request.slug)
      const asserted = await completeOidc(key, provider, {
        code: request.code,
        state: request.state,
        cookie: request.cookie,
      })
      const resolved = await resolveIdentity(pools, provider, request.tenantRef, asserted)
      const session = await loginWithOidc(pools, key, resolved, {
        ip: request.ip,
        userAgent: request.userAgent,
      })
      return { session, returnTo: asserted.returnTo, provisioned: resolved.provisioned }
    },

    oidcLink: async (request) => {
      const key = instanceKey()
      const provider = await requireProvider(pools, key, request.tenantRef, request.slug)
      const asserted = await completeOidc(key, provider, {
        code: request.code,
        state: request.state,
        cookie: request.cookie,
      })

      await pools.withConnection('catalog', async (exec) => {
        const snapshot =
          request.sessionToken === undefined
            ? null
            : await loadSessionByToken(exec, request.sessionToken)
        if (snapshot === null) throw new BasedbError('AUTHENTICATION_REQUIRED')
        // Linking a provider is handing someone else the power to sign into this
        // account: it demands a proof made minutes ago, not one made last week.
        if (!elevated(snapshot, new Date())) throw new BasedbError('ELEVATION_REQUIRED')
        await linkIdentity(exec, provider, snapshot.userId, asserted.subject)
      })
    },

    oidcUnlink: async (request) => {
      await pools.withConnection('catalog', async (exec) => {
        const snapshot =
          request.sessionToken === undefined
            ? null
            : await loadSessionByToken(exec, request.sessionToken)
        if (snapshot === null) throw new BasedbError('AUTHENTICATION_REQUIRED')
        if (!elevated(snapshot, new Date())) throw new BasedbError('ELEVATION_REQUIRED')
        await unlinkIdentity(exec, request.slug, snapshot.userId)
      })
    },

    createBase: (ctx, request) => createBase(pools, ctx, request),
    listProjects: (ctx) => listProjects(pools, ctx),
    createProject: (ctx, request) => createProject(pools, ctx, request),
    updateProject: (ctx, request) => updateProject(pools, ctx, request),
    deleteProject: (ctx, request) => deleteProject(pools, ctx, request),
    listUsers: (ctx) => listUsers(pools, ctx),
    createUser: (ctx, request) => createUser(pools, ctx, instanceKey(), request),
    updateUser: (ctx, request) => updateUser(pools, ctx, request),
    resetUserPassword: (ctx, request) => resetUserPassword(pools, ctx, instanceKey(), request),
    setUserGroups: (ctx, request) => setUserGroups(pools, ctx, request),
    listGroups: (ctx) => listGroups(pools, ctx),
    createGroup: (ctx, request) => createGroup(pools, ctx, request),
    renameGroup: (ctx, request) => renameGroup(pools, ctx, request),
    deleteGroup: (ctx, request) => deleteGroup(pools, ctx, request),
    listGroupMembers: (ctx, request) => listGroupMembers(pools, ctx, request),
    setGroupMembership: (ctx, request) => setGroupMembership(pools, ctx, request),
    accessGraph: (ctx) => accessGraph(pools, ctx),
    applyAccessChanges: (ctx, request) => applyAccessChanges(pools, ctx, request),
    createTable: (ctx, request) => createTable(pools, ctx, request),
    createLinkField: (ctx, request) => createLinkField(pools, ctx, request),
    addField: (ctx, request) => addField(pools, ctx, request),
    setFieldRequired: (ctx, request) => setFieldRequired(pools, ctx, request),
    setDisplayColumn: (ctx, request) => setDisplayColumn(pools, ctx, request),
    listVisibleBases: (ctx) => listVisibleBases(pools, ctx),
    projectBase: (ctx, reference) => projectBase(pools, ctx, reference),
    openApi: async (ctx, reference) =>
      toOpenApi(await projectBase(pools, ctx, reference), ctx.tenantId),
    documentation: async (ctx, reference) =>
      toDocumentation(await projectBase(pools, ctx, reference), ctx.tenantId),
    serveMeta: (ctx, kind, reference, ifNoneMatch) =>
      serveMeta(pools, ctx, kind, reference, ifNoneMatch),
    resolveTable: (ctx, baseRef, tableRef) => resolveTable(pools, ctx, baseRef, tableRef),
    resolveBase: (ctx, reference) => resolveBase(pools, ctx, reference),
    resolveField: (ctx, baseRef, tableRef, fieldRef) =>
      resolveField(pools, ctx, baseRef, tableRef, fieldRef),
    renameBase: (ctx, request) => renameBaseLabel(pools, ctx, request),
    updateBase: (ctx, request) => updateBase(pools, ctx, request),
    updateTable: (ctx, request) => updateTable(pools, ctx, request),
    setTableDescription: (ctx, request) => setTableDescription(pools, ctx, request),
    setFieldDescription: (ctx, request) => setFieldDescription(pools, ctx, request),
    setFieldLabel: (ctx, request) => setFieldLabel(pools, ctx, request),
    setSelectOptions: (ctx, request) => setSelectOptions(pools, ctx, request),
    deleteBase: (ctx, request) => deleteBase(pools, ctx, request),
    deleteTable: (ctx, request) => deleteTable(pools, ctx, request),
    previewTableDeletion: (ctx, tableId) => previewTableDeletion(pools, ctx, tableId),
    restoreBase: (ctx, request) => restoreBase(pools, ctx, request),
    listDeletedBases: (ctx) => listDeletedBases(pools, ctx),
    listMigrations: (ctx, baseId) => listMigrations(pools, ctx, baseId),
    resumeMigration: (ctx, migrationId) => applyMigration(pools, ctx, migrationId),
    draftExpression: (ctx, transport, request) => draftExpression(pools, ctx, transport, request),
    draftStructure: (ctx, transport, request) => draftStructure(pools, ctx, transport, request),
    runSql: (ctx, request) =>
      runConsoleSql(pools, ctx, config.encryptionKey, config.connectionString, request),
    listRecords: async (ctx, options) => {
      const result = await listRecords(pools, ctx, options)
      return result.fileColumns.length === 0
        ? result
        : { ...result, rows: withFileLinks(files.linkKey, ctx, result.rows, result.fileColumns) }
    },
    listInverseLinks: (ctx, options) => listInverseLinks(pools, ctx, options),
    createRecord: async (ctx, options) => linked(ctx, await createRecord(pools, ctx, options)),
    createRecords: (ctx, options) => createRecords(pools, ctx, options),
    updateRecord: async (ctx, options) => linked(ctx, await updateRecord(pools, ctx, options)),
    uploadFile: (ctx, request) => uploadFile(files, ctx, request),
    openFile: (request) => openFile(files, request, new Date()),
    files: { storage: storage.description, maxBytes: files.maxBytes },
    deleteRecord: (ctx, options) => deleteRecord(pools, ctx, options),
    close: async () => {
      await closeConsolePools()
      await pools.end()
    },
  }
}
