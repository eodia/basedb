import { createHmac, randomBytes } from 'node:crypto'
import {
  ALL_ERROR_CODES,
  type DashboardCopilotAnswer,
  ERROR_CODES,
  type QueryResult,
} from '@basedb/contracts'
import {
  type AccessChange,
  type AccessGraph,
  type AccessLevel,
  accessGraph,
  applyAccessChanges,
} from './admin/access.js'
import {
  type EffectiveMask,
  type FieldAccess,
  type FieldRule,
  effectiveFieldMask,
  fieldAccess,
  setFieldRule,
} from './admin/fields.js'
import {
  type GroupSummary,
  createGroup,
  deleteGroup,
  listGroupMembers,
  listGroups,
  renameGroup,
  setGroupMembership,
} from './admin/groups.js'
import {
  type InvitationPreview,
  type PendingInvitation,
  type ScopeSharing,
  type ShareScope,
  acceptInvitation,
  invitationPreview,
  inviteToScope,
  revokeInvitation,
  scopeSharing,
  setPersonAccess,
} from './admin/sharing.js'
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
  type AutomationCopilotAnswer,
  type AutomationCopilotRequest,
  automationCopilotTurn,
} from './ai/automation-copilot.js'
import { type CopilotAnswer, type CopilotRequest, copilotTurn } from './ai/copilot.js'
import { type DashboardCopilotRequest, dashboardCopilotTurn } from './ai/dashboard-copilot.js'
import {
  type ExpressionDraft,
  type ExpressionDraftRequest,
  type ProviderTransport,
  type StructureDraft,
  type StructureDraftRequest,
  draftExpression,
  draftStructure,
} from './ai/draft.js'
import {
  type AiFieldInput,
  type AiFieldStatus,
  type AiWorker,
  type AiWorkerOptions,
  aiFieldStatus,
  disableAiField,
  requestAiSweep,
  runAiCell,
  setAiField,
  startAiWorker,
} from './ai/field.js'
import { checkSchedule, nextRuns } from './ai/schedule.js'
import { checkBuilderQuery, checkConstraints, runBuilderQuery } from './analytics/query.js'
import {
  type SavedQuestion,
  type SharedDashboardPage,
  type ValueChoice,
  choicesOf,
  forVisitor,
  sharedCards,
  sharedRun,
  sharedTables,
  valuesQuery,
  withPeopleNames,
} from './analytics/shared-dashboard.js'
import { checkSqlQuery, runSqlQuestion } from './analytics/sql.js'
import { writeAudit } from './audit/journal.js'
import { bootstrapAdministrator, bootstrapInstance, bootstrapOpen } from './auth/bootstrap.js'
import { requireElevatedSession } from './auth/elevation.js'
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
import {
  type OwnIdentity,
  type ProfileChange,
  changeEmail,
  listOwnIdentities,
  updateProfile,
} from './auth/profile.js'
import { listLiveSessions, loadSessionById, sessionUsable } from './auth/session.js'
import {
  type SignupPolicy,
  adminSignupPolicy,
  setSignupPolicy,
  signUp,
  signupPolicy,
} from './auth/signup.js'
import {
  type ApiTokenSummary,
  type CreateApiTokenRequest,
  type IssuedApiToken,
  type OwnApiToken,
  createApiToken,
  listApiTokens,
  listOwnApiTokens,
  revokeApiToken,
  verifyApiToken,
} from './auth/tokens.js'
import {
  type Automation,
  type AutomationInput,
  type AutomationRun,
  createAutomation,
  deleteAutomation,
  listAutomationRuns,
  listAutomations,
  updateAutomation,
} from './automations/catalog.js'
import { requestRun, runAutomations, startAutomationWorker } from './automations/engine.js'
import { APPLICATION_VERSION } from './catalog/cache.js'
import { type FormulaInput, setFormula } from './catalog/computed-fields.js'
import {
  type DashboardShareSettings,
  type DashboardSharing,
  admitSharedDashboard,
  deleteDashboardShare,
  getDashboardSharing,
  regenerateDashboardShare,
  saveDashboardSharing,
} from './catalog/dashboard-shares.js'
import {
  type Dashboard,
  type DashboardInput,
  createDashboard,
  deleteDashboard,
  listDashboards,
  updateDashboard,
} from './catalog/dashboards.js'
import { DESCRIPTION_MAX_CHARS } from './catalog/description.js'
import { setFieldDescription, setTableDescription } from './catalog/descriptions.js'
import { type Documentation, toDocumentation } from './catalog/documentation.js'
import { setFieldLabel } from './catalog/field-label.js'
import { type ReorderedFields, reorderFields } from './catalog/field-order.js'
import {
  type AddFieldRequest,
  type AddedField,
  type RequiredResult,
  addField,
  setFieldRequired,
} from './catalog/fields.js'
import { type FieldFormat, type FieldFormatInput, setFieldFormat } from './catalog/formats.js'
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
import { type Member, listMembers } from './catalog/members.js'
import { toOpenApi } from './catalog/openapi.js'
import {
  type CreateBaseResult,
  type CreateTableResult,
  type FieldRequest,
  createBase,
  createTable,
} from './catalog/operations.js'
import {
  type AliasSummary,
  type PhysicalKind,
  type RenameImpact,
  type RenameResult,
  dropAlias,
  endBlankCut,
  listAliases,
  renameImpact,
  renamePhysical,
  startBlankCut,
} from './catalog/physical.js'
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
  type DeletedTable,
  type PurgeExport,
  type PurgeResult,
  exportForPurge,
  listDeletedTables,
  purge,
} from './catalog/purge.js'
import {
  type QueryInput,
  type SavedQuery,
  createQuery,
  deleteQuery,
  getQuery,
  listQueries,
  listQueryGroups,
  updateQuery,
} from './catalog/queries.js'
import {
  type Question,
  type QuestionInput,
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  updateQuestion,
} from './catalog/questions.js'
import {
  type SelectOptionInput,
  type SetOptionsResult,
  setSelectOptions,
} from './catalog/select-options.js'
import { type MetaKind, type ServedMeta, serveMeta } from './catalog/serve.js'
import {
  type SqlView,
  type SqlViewInput,
  createSqlView,
  deleteSqlView,
  getSqlView,
  listSqlViews,
  reorderSqlViews,
  sqlViewStatement,
  updateSqlView,
} from './catalog/sql-views.js'
import { type UpdatedTable, updateTable } from './catalog/table-edit.js'
import {
  type SavedView,
  createView,
  deleteView,
  listViews,
  reorderViews,
  updateView,
} from './catalog/views.js'
import {
  type Comment,
  addComment,
  deleteComment,
  editComment,
  listComments,
} from './collab/comments.js'
import {
  type NotificationPage,
  listNotifications,
  markNotificationsRead,
  purgeCollaboration,
} from './collab/notifications.js'
import {
  type Viewer,
  enterPresence,
  leavePresence,
  movePointer,
  refreshPresence,
  viewersOf,
} from './collab/presence.js'
import {
  DRAIN_CHANNEL,
  LIVE_CHANNEL,
  type LiveSignal,
  type PointerAt,
  canReadTable as canReadTableIn,
  parseLive,
  readableFieldNames,
} from './collab/signals.js'
import type { FieldKind } from './ddl/emit.js'
import {
  type Migration,
  applyMigration,
  listMigrations,
  proposeMigration,
  reclaimStaleMigrations,
} from './ddl/migration.js'
import {
  type EnvironmentSummary,
  type Family,
  assertDeletableEnvironment,
  createEnvironmentBase,
  deletionOrder,
  listEnvironments,
  renameEnvironment,
} from './environments/family.js'
import {
  type RowComparison,
  type RowSyncResult,
  type TableRowCounts,
  compareRows,
  countRows,
  syncRows,
} from './environments/rows.js'
import {
  type ApplyReport,
  type EnvironmentComparison,
  type StructurePlan,
  applyStructure,
  compareEnvironments,
  planStructure,
} from './environments/structure.js'
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
import { CALENDAR_MAX_EVENTS, calendarEvents } from './forms/shared-calendar.js'
import {
  type SharedViewPage,
  filterRefused,
  pageSpec,
  peopleIn,
  sharedField,
  sharedRow,
  shownFields,
  sortOf,
} from './forms/shared-view.js'
import {
  type FormSharing,
  type ShareSettings,
  type SharedForm,
  admitSharedView,
  deleteFormShare,
  getFormSharing,
  openSharedForm,
  regenerateFormShare,
  saveFormSharing,
  submitSharedForm,
} from './forms/shares.js'
import { drainHistory, startDrainLoop } from './history/drain.js'
import {
  type Deletion,
  type RevisionPage,
  baseHistory,
  listDeletions,
  recordHistory,
  restoreRecord,
  revertRevision,
} from './history/read.js'
import { type StructureHistoryPage, structureHistory } from './history/structure.js'
import { type Undone, undoTransaction } from './history/undo.js'
import { icsCalendar } from './integrations/ical.js'
import {
  type Integration,
  createIntegration,
  deleteIntegration,
  listIntegrations,
  testIntegration,
} from './integrations/slack.js'
import {
  type Proposal,
  type ProposedField,
  agentGetProposal,
  agentProposeAddField,
  agentProposeCreateTable,
  approveProposal,
  listProposals,
  rejectProposal,
} from './proposals/index.js'
import {
  type AggregateRequest,
  type AggregateResult,
  aggregateRecords,
} from './records/aggregate.js'
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
import {
  type CatalogState,
  inspectCatalog,
  migrateCatalog as migrateCatalogSchema,
} from './runtime/catalog-migrations.js'
import { Listener } from './runtime/listener.js'
import { Pools, type PoolsOptions } from './runtime/pool.js'
import {
  type SqlConsoleRequest,
  type SqlConsoleResult,
  closeConsolePools,
  runConsoleSql,
} from './sql/console.js'
import { closeReaderPools } from './sql/reader.js'
import { runSql } from './sql/run.js'
import {
  type SyncedTable,
  createSyncedTable,
  listSyncedTables,
  runSyncedTable,
  startSyncWorker,
  stopSyncedTable,
  syncDue,
  updateSyncedTable,
} from './sync/tables.js'
import {
  type CatalogEntry,
  type CatalogListing,
  DEFAULT_TEMPLATES_URL,
  deleteTemplate,
  getTemplate,
  importTemplate,
  listTemplates,
} from './templates/catalog.js'
import { type TemplateDraft, type TemplateDraftRequest, draftTemplate } from './templates/draft.js'
import { type RequestContext, type Surface, sealContext, withTransaction } from './tx/context.js'
import { dispatchWebhooks, startDispatchLoop } from './webhooks/dispatch.js'
import {
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookSummary,
  createWebhook,
  deleteWebhook,
  listDeliveries,
  listWebhooks,
  setWebhookActive,
} from './webhooks/manage.js'
import { STRICT_TARGETS, type TargetPolicy } from './webhooks/target.js'

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
export type { WebhookDelivery, WebhookEvent, WebhookSummary } from './webhooks/manage.js'
export type { SavedView, ViewKind } from './catalog/views.js'
export type { Comment } from './collab/comments.js'
export type { Notification, NotificationPage } from './collab/notifications.js'
export type { Viewer } from './collab/presence.js'
export type { LiveSignal, PointerAt } from './collab/signals.js'
export type { Undone } from './history/undo.js'
export type {
  Automation,
  AutomationAction,
  AutomationInput,
  AutomationRun,
  AutomationStep,
  AutomationTrigger,
  BranchPath,
  Schedule,
  TriggerKind,
} from './automations/catalog.js'
export { wireSteps } from './automations/catalog.js'
export type { ButtonInput } from './catalog/fields.js'
export type {
  InvitationPreview,
  PendingInvitation,
  ScopeSharing,
  ShareScope,
  SharedGroup,
  SharedPerson,
} from './admin/sharing.js'
export type { SignupPolicy } from './auth/signup.js'
export type { Block, Dashboard, DashboardInput } from './catalog/dashboards.js'
export type { Question, QuestionInput } from './catalog/questions.js'
export type {
  DashboardShare,
  DashboardShareSettings,
  DashboardSharing,
} from './catalog/dashboard-shares.js'
export type {
  SharedDashboardCard,
  SharedDashboardPage,
  SharedDashboardTable,
  ValueChoice,
} from './analytics/shared-dashboard.js'
export type { QueryAudience, QueryInput, QuerySummary, SavedQuery } from './catalog/queries.js'
export type { SqlView, SqlViewInput, SqlViewSummary } from './catalog/sql-views.js'
export type { Integration } from './integrations/slack.js'
export type { SyncedTable } from './sync/tables.js'
export type { CatalogEntry, CatalogListing, TemplateSource } from './templates/catalog.js'
export { DEFAULT_TEMPLATES_URL, resetTemplateCatalog } from './templates/catalog.js'
export type { TemplateDraft, TemplateDraftRequest } from './templates/draft.js'
export type { SourceKind } from './sync/sources.js'
export type { FieldFormat, FieldFormatInput } from './catalog/formats.js'
export type { Member } from './catalog/members.js'
export type { Proposal, ProposedField } from './proposals/index.js'
export type { TargetPolicy } from './webhooks/target.js'
export type {
  Deletion,
  Revision,
  RevisionActor,
  RevisionChange,
  RevisionOp,
  RevisionPage,
} from './history/read.js'
export type { Actor, ActorKind, PermissionSnapshot, RequestContext, Surface } from './tx/context.js'
export type { AllocatedName, ObjectKind, ScopeKind } from './naming/allocation.js'
export type {
  CreateBaseResult,
  CreateTableResult,
  CreatedField,
  FieldRequest,
} from './catalog/operations.js'
export type { CreateLinkFieldRequest, CreatedLinkField, OnDelete } from './catalog/links.js'
export type { FormulaInput, RollupInput, RollupAggregate } from './catalog/computed-fields.js'
export type { AddFieldRequest, AddedField, RequiredResult } from './catalog/fields.js'
export type { Look, LookInput } from './catalog/look.js'
export type { UpdatedTable } from './catalog/table-edit.js'
export type { ReorderedFields } from './catalog/field-order.js'
export type { SelectOption, SelectOptionInput, SetOptionsResult } from './catalog/select-options.js'
export type { FileStorageConfig } from './files/storage.js'
export type { OpenedFile, UploadRequest, UploadedFile } from './files/operations.js'
export { DEFAULT_MAX_FILE_BYTES } from './files/operations.js'
export type {
  AliasSummary,
  PhysicalKind,
  RenameImpact,
  RenameResult,
} from './catalog/physical.js'
export { ALIAS_DEFAULT_DAYS, BLANK_CUT_MIN_DAYS, MAX_LIVE_ALIASES } from './catalog/physical.js'
export type { DeletedTable, ExportedTable, PurgeExport, PurgeResult } from './catalog/purge.js'
export { EXPORT_MAX_ROWS, PURGE_DELAY_DAYS } from './catalog/purge.js'
export { MAX_FILES_PER_VALUE } from './ddl/emit.js'
export {
  MAX_IMAGE_CHARS,
  MAX_LABEL_CHARS,
  MAX_OPTIONS,
  MAX_OPTION_CHARS,
} from './catalog/select-options.js'
export type { ListOptions, ListResult } from './records/list.js'
export type { Aggregate, AggregateRequest, AggregateResult } from './records/aggregate.js'
export { COUNT_CEILING } from './records/list.js'
export type { BaseSummary } from './catalog/lifecycle.js'
export type { EnvironmentSummary, Family } from './environments/family.js'
export type {
  FormShare,
  FormSharing,
  ShareAccess,
  ShareSettings,
  ShareState,
  SharedForm,
  SharedQuestion,
} from './forms/shares.js'
export type { SharedViewField, SharedViewPage } from './forms/shared-view.js'
export { MAX_ENVIRONMENT_CHARS } from './environments/family.js'
export type {
  ApplyReport,
  ComparedField,
  ComparedFieldCell,
  ComparedTable,
  ComparedTableCell,
  EnvironmentComparison,
  PlanNote,
  PlanStep,
  StepChange,
  StepKind,
  StepResult,
  StepStatus,
  StructurePlan,
} from './environments/structure.js'
export type {
  RowComparison,
  RowSample,
  RowSyncResult,
  SyncColumn,
  TableRowCounts,
} from './environments/rows.js'
export type {
  StructureChange,
  StructureEvent,
  StructureHistoryPage,
} from './history/structure.js'
export type { BaseEnvironment } from './catalog/projection.js'
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
export { endpointFromEnv } from './ai/draft.js'
export type {
  AiFieldInput,
  AiFieldStatus,
  AiRefresh,
  AiWorker,
  AiWorkerOptions,
} from './ai/field.js'
export { MIN_INTERVAL_MINUTES } from './ai/schedule.js'
export type {
  CopilotAction,
  CopilotAnswer,
  CopilotField,
  CopilotMessage,
  CopilotRead,
  CopilotRequest,
} from './ai/copilot.js'
export type { DashboardCopilotRequest } from './ai/dashboard-copilot.js'
export type {
  AutomationCopilotAction,
  AutomationCopilotAnswer,
  AutomationCopilotRequest,
  AutomationDefinition,
} from './ai/automation-copilot.js'
export { DESCRIPTION_MAX_CHARS }
export type { DocSection, Documentation } from './catalog/documentation.js'
export { DOCUMENTED_MCP_TOOLS, toDocumentation } from './catalog/documentation.js'
export { CACHE_CONTROL, VARY } from './catalog/serve.js'
export type { MetaKind, ServedMeta } from './catalog/serve.js'
export { clearCaches, SNAPSHOT_TTL_MS, DOCUMENT_MAX_BYTES } from './catalog/cache.js'
export type { CatalogState } from './runtime/catalog-migrations.js'
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
export { COMMENT_MAX_LENGTH, MENTIONS_MAX } from './collab/comments.js'
export { UNDO_MAX_REVISIONS, UNDO_WINDOW_HOURS } from './history/undo.js'
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
export { PRESETS as OIDC_PRESETS } from './auth/oidc-providers.js'
export { seal } from './auth/sealing.js'
export { normalizeEmail } from './auth/operations.js'
export { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, SESSION_ABSOLUTE_MS } from './auth/session.js'
export { PASSWORD_MIN, PASSWORD_MAX } from './auth/password.js'
export type {
  ApiTokenSummary,
  CreateApiTokenRequest,
  IssuedApiToken,
  OwnApiToken,
  TokenAccess,
} from './auth/tokens.js'
export type { OwnIdentity, ProfileChange } from './auth/profile.js'
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
export type {
  EffectiveField,
  EffectiveMask,
  FieldAccess,
  FieldAccessField,
  FieldAccessGroup,
  FieldRule,
} from './admin/fields.js'
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
   * Where webhooks may send — chapter 08 §10.8. Absent: HTTPS to public addresses only.
   * Relaxing it is for development and tests, where the consumer runs on the same host.
   */
  readonly webhookTargets?: TargetPolicy
  /**
   * The directory where a purge's export is written — chapter 06 §5.2: on the
   * application host, never on the database server. Absent: no export, hence no purge
   * (`EXPORT_UNAVAILABLE`).
   */
  readonly exportDir?: string
  /**
   * Where the public site publishes its catalog of base templates — chapter 20 §3.1.
   * Absent: the site's own address; `null`: not read, the carried templates only.
   */
  readonly templatesUrl?: string | null
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
  /**
   * Sign-in providers declared by the operator in the environment (chapter 13 §3) — a
   * provider of the catalog with the same slug gives way to it. Their secrets stay in the
   * environment: nothing of them is written to the database.
   */
  readonly oidcProviders?: readonly OidcProvider[]
}

/**
 * The kernel as an adapter sees it: a closed list of operations.
 *
 * Each takes a context as its first argument and returns either a result or a typed
 * error. None takes or returns a connection.
 */
export interface Kernel {
  /**
   * Brings the catalog to the version this code ships — chapter 02, « Amorçage ». Each
   * migration missing from `_basedb.catalog_migration` is applied, in order, in its own
   * transaction; the answer is how many were. Refuses, applying nothing, a catalog whose
   * recorded history this code cannot vouch for (`CATALOG_CHECKSUM_MISMATCH`) or which a
   * newer version already upgraded (`CATALOG_VERSION_AHEAD`).
   */
  migrateCatalog(options?: {
    onApplied?: (name: string, ms: number) => void
    onWaiting?: () => void
  }): Promise<number>
  /** Where the catalog stands, checked the same way, without applying anything. */
  catalogStatus(): Promise<CatalogState>
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
    /** Whether the account has a password — else it signs in through a provider only. */
    readonly hasPassword: boolean
    readonly dateFormat: 'dmy' | 'iso'
    readonly weekStart: 0 | 1
    readonly mutedNotifications: readonly string[]
    /** The language chosen, or `null`: the browser's. */
    readonly locale: string | null
  }>
  /**
   * Renames oneself, and sets how the product reads — chapter 11 §10. Each field is
   * optional; none is changed unless given.
   */
  updateProfile(ctx: RequestContext, change: ProfileChange): Promise<void>
  /**
   * Changes the address one signs in with — chapter 13 §2.6. Demands an elevated session
   * and an account with a password; the old address is told.
   */
  changeEmail(
    ctx: RequestContext,
    request: {
      readonly email: unknown
      readonly sessionId: string
      /** The caller's `Accept-Language`: the mail's language when the account has none. */
      readonly acceptLanguage?: string | null
    },
  ): Promise<{ readonly email: string }>
  /** The ways the caller signs in: the password, and each linked provider. */
  listOwnIdentities(authenticated: Authenticated): Promise<readonly OwnIdentity[]>
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
  requestPasswordReset(email: string, acceptLanguage?: string | null): Promise<void>
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
    requestId?: string
  }): Promise<
    | {
        readonly kind: 'session'
        session: IssuedSession
        returnTo: string
        provisioned: boolean
      }
    | { readonly kind: 'linked'; returnTo: string }
  >
  /**
   * Opens an exchange that LINKS a provider identity to the caller — §3.5. Demands an
   * ELEVATED session (§5); the return from the provider completes the link, through
   * `oidcCallback`, without opening a session.
   */
  oidcLinkStart(
    ctx: RequestContext,
    request: {
      readonly sessionId: string
      readonly slug: string
      readonly redirectUri: string
      readonly returnTo?: string
    },
  ): Promise<{ authorizeUrl: string; exchangeCookie: string }>
  /** Unlinks a provider identity — demands an ELEVATED session; never the last identity. */
  oidcUnlink(
    ctx: RequestContext,
    request: { readonly sessionId: string; readonly slug: string },
  ): Promise<void>
  /**
   * Bootstraps the instance: one tenant and its first administrator.
   *
   * Idempotent — restarting does not create a second administrator. It is the only
   * write in the product that does not go through an authorization decision, and for
   * good reason: no actor exists yet to carry one (chapter 05 §12). Without an address
   * it only finds the administrator, and answers `RESOURCE_NOT_FOUND` when there is none.
   */
  bootstrap(request: { readonly tenantRef: string; readonly email?: string }): Promise<{
    readonly tenantId: string
    readonly userId: string
    /** The administrator's address — the one given, or the one found. */
    readonly email: string
    readonly alreadyDone: boolean
  }>
  /** Whether the instance still has no administrator, so the interface may create it. */
  bootstrapOpen(): Promise<boolean>
  /**
   * Creates the first administrator from the interface, and opens their session — chapter
   * 13 §7. Only while `bootstrapOpen()`: afterwards, `RESOURCE_NOT_FOUND`.
   */
  bootstrapAdministrator(request: {
    readonly tenantRef: string
    readonly email: string
    readonly displayName: string
    readonly password: string
    readonly requestId: string
    readonly ip?: string | null
    readonly userAgent?: string | null
  }): Promise<LoginResult>
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
  /** The tokens the caller minted, on every base — metadata only (chapter 11 §10). */
  listOwnApiTokens(ctx: RequestContext): Promise<readonly OwnApiToken[]>
  /**
   * Revokes a token at once and for good. Demands an elevated session, and
   * `manage_tokens` on its base — unless the caller created it.
   */
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
  /** Creates a project — anyone signed in; its creator manages it (05 §15.1). */
  createProject(
    ctx: RequestContext,
    request: { label: string; description?: string | null; look?: LookInput },
  ): Promise<
    { readonly id: string; readonly label: string; readonly description: string | null } & Look
  >
  /** Renames a project, changes what it is for, or how it looks. `manage_schema` on it. */
  updateProject(
    ctx: RequestContext,
    request: { projectId: string; label?: string; description?: string | null; look?: LookInput },
  ): Promise<{ readonly label: string; readonly description: string | null } & Look>
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
  /** Sets levels on the grid and returns the new grid. */
  applyAccessChanges(
    ctx: RequestContext,
    request: { changes: readonly AccessChange[]; sessionId: string },
  ): Promise<AccessGraph>
  /** Who has access to a project or a base, and who is invited — its managers (05 §15.8). */
  scopeSharing(ctx: RequestContext, request: { scope: ShareScope }): Promise<ScopeSharing>
  /** Invites someone to a project or a base, at a level: a link valid a week. */
  inviteToScope(
    ctx: RequestContext,
    request: { scope: ShareScope; email: string; level: AccessLevel },
  ): Promise<PendingInvitation>
  revokeInvitation(ctx: RequestContext, request: { invitationId: string }): Promise<void>
  /** Changes, or takes back (`none`), what a person the scope was shared with may do. */
  setPersonAccess(
    ctx: RequestContext,
    request: { scope: ShareScope; userId: string; level: AccessLevel },
  ): Promise<ScopeSharing>
  /** What an invitation offers, for its link's page, before anyone signs in. */
  invitationPreview(tenantRef: string, token: string): Promise<InvitationPreview>
  /** Accepts an invitation as the signed-in person. */
  acceptInvitation(
    ctx: RequestContext,
    request: { token: string },
  ): Promise<{ readonly projectId: string; readonly baseId: string | null }>
  /** Whether anyone may create an account, and with which addresses (13 §8). */
  signupPolicy(tenantRef: string): Promise<SignupPolicy>
  /** The same, for the administration screen. */
  adminSignupPolicy(ctx: RequestContext): Promise<SignupPolicy>
  setSignupPolicy(
    ctx: RequestContext,
    request: { open: boolean; domains: readonly string[]; sessionId: string },
  ): Promise<SignupPolicy>
  /** Creates one's own account, and opens its session. */
  signUp(request: {
    tenantRef: string
    email: string
    displayName: string
    password: string
    invitation?: string
    requestId: string
    ip?: string | null
    userAgent?: string | null
  }): Promise<LoginResult>
  /** Below the grid: each group's rules on the fields of one table (05 §4). */
  fieldAccess(ctx: RequestContext, request: { tableId: string }): Promise<FieldAccess>
  /** Hides a field from a group, makes it read-only for it, or lifts the rule (`null`). */
  setFieldRule(
    ctx: RequestContext,
    request: { groupId: string; fieldId: string; rule: FieldRule | null; sessionId: string },
  ): Promise<FieldAccess>
  /** What one person ends up with on each field of a table, and through which group (05 §3.3). */
  effectiveFieldMask(
    ctx: RequestContext,
    request: { tableId: string; userId: string },
  ): Promise<EffectiveMask>
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
   * Sets the order of a table's fields, by physical name — the catalog's order, the one the
   * screens and the API follow; PostgreSQL's own column order is left as it is.
   */
  reorderFields(
    ctx: RequestContext,
    request: { tableId: string; names: readonly string[] },
  ): Promise<ReorderedFields>
  /** Changes how a number or a short text READS — no migration: the column is the same. */
  setFieldFormat(
    ctx: RequestContext,
    request: { fieldId: string; format: FieldFormatInput },
  ): Promise<FieldFormat>
  /**
   * Replaces a formula's expression — chapter 04 §7.7: a stored one rewrites its column;
   * one that becomes computed at read time loses it.
   */
  setFormula(
    ctx: RequestContext,
    request: { tableId: string; field: string; formula: FormulaInput },
  ): Promise<{ readonly stored: boolean; readonly sql: readonly string[] }>
  /** The people of the tenant — what a `user` field names, and how to call them. */
  listMembers(ctx: RequestContext): Promise<Member[]>
  /**
   * The saved views of a table, in the order of its selector — chapter 11 §1.4. `read` on
   * the table; each spec is cut down to the fields the reader sees.
   */
  listViews(ctx: RequestContext, request: { tableId: string }): Promise<SavedView[]>
  /** Creates a view — a grid, kanban, calendar, timeline, form or survey. `manage_schema`. */
  createView(
    ctx: RequestContext,
    request: {
      tableId: string
      label: unknown
      kind: unknown
      description?: unknown
      spec?: unknown
      /** The reader's own view, which only needs `read` (chapter 11 §1.6). */
      personal?: boolean
    },
  ): Promise<SavedView>
  /** Changes a view's label, description and/or WHOLE spec; never its kind. */
  updateView(
    ctx: RequestContext,
    request: {
      tableId: string
      viewId: string
      label?: unknown
      description?: unknown
      spec?: unknown
      /** Locks or unlocks a collaborative view. */
      locked?: unknown
    },
  ): Promise<SavedView>
  /** Deletes a view, logically. The rows it showed are not touched. */
  deleteView(ctx: RequestContext, request: { tableId: string; viewId: string }): Promise<void>
  /** Sets the order of a table's views, as the list of their identifiers. */
  reorderViews(
    ctx: RequestContext,
    request: { tableId: string; ids: readonly string[] },
  ): Promise<{ readonly order: readonly string[] }>
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
   * The environments of a base — chapter 14: production first, each a base of its own
   * sharing the lineage, label, description and look. `manage_schema` on the base.
   */
  listEnvironments(ctx: RequestContext, request: { baseId: string }): Promise<Family>
  /**
   * Adds an environment to a base: an empty base of the same lineage, then the structure
   * of `sourceBaseId` (production when absent) carried into it, step by step. The AI
   * options are carried only with `consent`.
   */
  createEnvironment(
    ctx: RequestContext,
    request: { baseId: string; environment: string; sourceBaseId?: string; consent?: boolean },
  ): Promise<{ readonly environment: EnvironmentSummary; readonly report: ApplyReport }>
  /** Renames an environment's badge. */
  renameEnvironment(
    ctx: RequestContext,
    request: { baseId: string; environment: string },
  ): Promise<EnvironmentSummary>
  /** Deletes one environment — never production (`ENVIRONMENT_IS_PRODUCTION`). */
  deleteEnvironment(ctx: RequestContext, request: { baseId: string }): Promise<Migration>
  /** Every environment of a base side by side, table by table, field by field. */
  compareEnvironments(
    ctx: RequestContext,
    request: { baseId: string },
  ): Promise<EnvironmentComparison>
  /** What carrying the structure of one environment into another would do. */
  planStructure(
    ctx: RequestContext,
    request: { sourceBaseId: string; targetBaseId: string },
  ): Promise<StructurePlan>
  /** Applies the chosen steps of a fresh plan; reports each step's outcome. */
  applyStructure(
    ctx: RequestContext,
    request: {
      sourceBaseId: string
      targetBaseId: string
      steps: readonly string[]
      consent?: boolean
    },
  ): Promise<ApplyReport>
  /** Rows per table in two environments — the list of the synchronization screen. */
  countRows(
    ctx: RequestContext,
    request: { sourceBaseId: string; targetBaseId: string },
  ): Promise<readonly TableRowCounts[]>
  /** A table's rows compared between two environments, by `_id`. */
  compareRows(
    ctx: RequestContext,
    request: { sourceBaseId: string; targetBaseId: string; tableLineage: string },
  ): Promise<RowComparison>
  /** Copies a table's rows from one environment to another, all or nothing. */
  syncRows(
    ctx: RequestContext,
    request: {
      sourceBaseId: string
      targetBaseId: string
      tableLineage: string
      insert: boolean
      update: boolean
      delete: boolean
    },
  ): Promise<RowSyncResult>
  /** The structure history of a base, most recent first — chapter 07 §8.1. */
  structureHistory(
    ctx: RequestContext,
    request: { baseId: string; before?: string; limit?: number },
  ): Promise<StructureHistoryPage>
  /** How a form view is shared — its link and settings, or none (chapter 15). */
  getFormSharing(
    ctx: RequestContext,
    request: { tableId: string; viewId: string },
  ): Promise<FormSharing>
  /** Shares a form view, or changes how; whoever saves becomes its publisher. */
  saveFormSharing(
    ctx: RequestContext,
    request: { tableId: string; viewId: string } & ShareSettings,
  ): Promise<FormSharing>
  /** A new link for a shared form: the old one stops working. */
  regenerateFormShare(
    ctx: RequestContext,
    request: { tableId: string; viewId: string },
  ): Promise<FormSharing>
  /** Stops sharing a form. The answers already given stay. */
  deleteFormShare(ctx: RequestContext, request: { tableId: string; viewId: string }): Promise<void>
  /**
   * Opens a shared form by its link — with no right on the table. `respondent` is the
   * signed-in person, when there is one; a members' form refuses without.
   */
  openSharedForm(request: {
    token: string
    respondent: RequestContext | null
    requestId: string
  }): Promise<SharedForm>
  /** Answers a shared form: one row, on the publisher's authority. */
  submitSharedForm(request: {
    token: string
    respondent: RequestContext | null
    requestId: string
    values: Readonly<Record<string, unknown>>
  }): Promise<{ readonly received: true }>
  /**
   * Reads a shared data view — chapter 15 §10: its shown fields and a page of its rows, on
   * the publisher's authority. No right on the table is needed.
   */
  openSharedView(request: {
    token: string
    reader: RequestContext | null
    requestId: string
    after?: string
  }): Promise<SharedViewPage>
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
  /** What renaming a base, a table or a field in the database would touch (06 §2.1). */
  renameImpact(
    ctx: RequestContext,
    /** `label`: the label being typed alongside — the suggestion is slugged from it. */
    request: { kind: PhysicalKind; id: string; label?: string },
  ): Promise<RenameImpact>
  /** The physical rename itself — administration only, confirmed by the current name. */
  renamePhysical(
    ctx: RequestContext,
    request: {
      kind: PhysicalKind
      id: string
      name: string
      confirm: string
      alias?: boolean
      aliasDays?: number
    },
  ): Promise<RenameResult>
  /** The compatibility aliases of a base (06 §3). */
  listAliases(ctx: RequestContext, request: { baseId: string }): Promise<AliasSummary[]>
  /** Renames an alias away for a while, to see who still uses it (06 §3.5). */
  startBlankCut(
    ctx: RequestContext,
    request: { aliasId: string; days?: number },
  ): Promise<AliasSummary | null>
  endBlankCut(ctx: RequestContext, request: { aliasId: string }): Promise<AliasSummary | null>
  dropAlias(ctx: RequestContext, request: { aliasId: string; confirm: string }): Promise<void>
  /** A live base's deleted tables, not purged yet. */
  listDeletedTables(ctx: RequestContext, request: { baseId: string }): Promise<DeletedTable[]>
  /** The export a purge requires: one CSV per table and a manifest (06 §5.2). */
  exportForPurge(
    ctx: RequestContext,
    request: { kind: 'base' | 'table'; id: string },
  ): Promise<PurgeExport>
  /** The one irreversible operation (06 §5). */
  purge(
    ctx: RequestContext,
    request: {
      kind: 'base' | 'table'
      id: string
      exportId: string
      confirm: string
      early?: { justification: string }
    },
  ): Promise<PurgeResult>
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
   * One turn of the copilot — chapter 12 §1.6: an answer, and proposals the person applies
   * through the ordinary routes. With `readData`, it may read rows first, under the
   * person's rights, in a read-only transaction when it reads by SQL.
   */
  copilot(
    ctx: RequestContext,
    transport: ProviderTransport,
    request: CopilotRequest,
  ): Promise<CopilotAnswer>
  /**
   * One turn of the copilot of the dashboards — chapter 18 §2.6: questions, changes to a
   * dashboard, values for its filters, proposed; results read only on consent, with the
   * person's rights.
   */
  dashboardCopilot(
    ctx: RequestContext,
    transport: ProviderTransport,
    request: DashboardCopilotRequest & { timezone?: string; weekStart?: 0 | 1 },
  ): Promise<DashboardCopilotAnswer>
  /**
   * One turn of the copilot of the automations — chapter 17 §6: an automation, new or
   * changed, proposed whole and checked as a save would be; rows read only on consent.
   */
  automationCopilot(
    ctx: RequestContext,
    transport: ProviderTransport,
    request: AutomationCopilotRequest,
  ): Promise<AutomationCopilotAnswer>
  /** How an AI field is set and how it is doing — chapter 12 §9. */
  aiFieldStatus(ctx: RequestContext, fieldId: string): Promise<AiFieldStatus>
  /**
   * Switches the AI option on for a field, or changes its prompt or schedule, with a fresh
   * consent; `recompute` starts a recomputation of every row.
   */
  setAiField(
    ctx: RequestContext,
    request: { fieldId: string; input: AiFieldInput; recompute?: boolean },
  ): Promise<AiFieldStatus>
  /** Switches the AI option off: the field is an ordinary, writable one again. */
  disableAiField(ctx: RequestContext, fieldId: string): Promise<void>
  /** Computes one row of an AI field now, overwriting its cell, and returns the value. */
  runAiCell(
    ctx: RequestContext,
    transport: ProviderTransport,
    request: { fieldId: string; recordId: string },
  ): Promise<{ readonly value: unknown }>
  /** Starts a recomputation of every row of an AI field — the worker does it. */
  requestAiSweep(ctx: RequestContext, fieldId: string): Promise<void>
  /**
   * The next runs of a schedule, or the refusal it would meet — what the screen shows
   * while a person builds one. Nothing is read or written.
   */
  previewSchedule(
    ctx: RequestContext,
    request: { cron: string; timezone: string },
  ): { readonly runs: readonly string[] }
  /**
   * Starts the process that fills AI fields, pass after pass, until `close`. The API
   * process runs one; several may run against one database, each field being leased.
   */
  startAiWorker(transport: ProviderTransport, options?: AiWorkerOptions): AiWorker
  /**
   * Runs a statement against one base's schema — the SQL console.
   *
   * The ONE operation of this kernel that takes a SQL string, and it exists against the
   * grain of chapters 09 and 10, by the owner's decision. It runs on a SEPARATE
   * PostgreSQL login role holding nothing but that one schema, so `_basedb` is out of
   * reach, and every call is written to `audit_log`.
   *
   * Whoever manages the base gets the console's reach, writes included; everyone else who
   * sees it runs read only, on a role of their own that PostgreSQL holds to their tables
   * and fields (`sql/reader.ts`). The result says which (`mode`).
   */
  runSql(ctx: RequestContext, request: SqlConsoleRequest): Promise<SqlConsoleResult>
  /**
   * The saved queries of a base (chapter 11 §1.7): personal, the base's, or some groups'.
   * Their text is shared, never their author's reach — each runs them with their own.
   */
  listQueries(ctx: RequestContext, request: { baseId: string }): Promise<SavedQuery[]>
  getQuery(ctx: RequestContext, request: { baseId: string; queryId: string }): Promise<SavedQuery>
  createQuery(
    ctx: RequestContext,
    request: { baseId: string; input: QueryInput },
  ): Promise<SavedQuery>
  updateQuery(
    ctx: RequestContext,
    request: { baseId: string; queryId: string; input: QueryInput },
  ): Promise<SavedQuery>
  deleteQuery(ctx: RequestContext, request: { baseId: string; queryId: string }): Promise<void>
  /** The groups a query may be shared with — for whoever manages the base. */
  listQueryGroups(
    ctx: RequestContext,
    request: { baseId: string },
  ): Promise<ReadonlyArray<{ readonly id: string; readonly label: string }>>
  /**
   * The SQL views of a base (chapter 11 §1.8): PostgreSQL views of its schema, created
   * `security_invoker`, listed among its tables. Those whose every column the caller reads.
   */
  listSqlViews(ctx: RequestContext, request: { baseId: string }): Promise<SqlView[]>
  getSqlView(ctx: RequestContext, request: { baseId: string; viewId: string }): Promise<SqlView>
  createSqlView(
    ctx: RequestContext,
    request: { baseId: string; input: SqlViewInput },
  ): Promise<SqlView>
  updateSqlView(
    ctx: RequestContext,
    request: { baseId: string; viewId: string; input: SqlViewInput },
  ): Promise<SqlView>
  deleteSqlView(ctx: RequestContext, request: { baseId: string; viewId: string }): Promise<void>
  reorderSqlViews(
    ctx: RequestContext,
    request: { baseId: string; order: readonly string[] },
  ): Promise<void>
  /** The rows of a SQL view, read through `runSql` — with the caller's reach. */
  readSqlView(
    ctx: RequestContext,
    request: { baseId: string; viewId: string; limit?: number },
  ): Promise<SqlConsoleResult>
  listRecords(ctx: RequestContext, options: ListOptions): Promise<ListResult>
  /**
   * Aggregates over every row a filter keeps — a grid's summary bar and the counts of its
   * groups (chapter 11 §1.6). Same mask and row predicate as a page.
   */
  aggregateRecords(ctx: RequestContext, request: AggregateRequest): Promise<AggregateResult>
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
  ): Promise<{ readonly deleted: string; readonly sql: string; readonly xact: string }>
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
  /**
   * The history of one row, newest first — chapter 07 §9. `read` on its table; the
   * detail of a field the reader may not read is withheld, and so is a modification of
   * such fields only.
   */
  recordHistory(
    ctx: RequestContext,
    request: { tableId: string; recordId: string; cursor?: string; limit?: number },
  ): Promise<RevisionPage>
  /** The activity of a base — or of one of its tables — over what the reader may read. */
  baseHistory(
    ctx: RequestContext,
    request: { baseId: string; tableId?: string; cursor?: string; limit?: number },
  ): Promise<RevisionPage>
  /** Undoes one modification; refused with `REVISION_SUPERSEDED` if a field changed since. */
  revertRevision(
    ctx: RequestContext,
    request: { revisionId: string },
  ): Promise<{ tableId: string; recordId: string }>
  /** Brings a deleted row back under its own identifier (chapter 07 §12.1). */
  restoreRecord(
    ctx: RequestContext,
    request: { revisionId: string },
  ): Promise<{ tableId: string; recordId: string }>
  /** The rows of a table deleted since an instant — a consumer's catch-up (08 §6.5). */
  listDeletions(
    ctx: RequestContext,
    request: { tableId: string; since: string; cursor?: string; limit?: number },
  ): Promise<{ readonly deletions: readonly Deletion[]; readonly nextCursor: string | null }>
  /** A base's webhooks — never a secret (08 §10). `manage_tokens` on the base. */
  listWebhooks(ctx: RequestContext, request: { baseId: string }): Promise<WebhookSummary[]>
  /** Creates a webhook; the signing secret is in the result and nowhere else, ever. */
  createWebhook(
    ctx: RequestContext,
    request: {
      baseId: string
      label: string
      url: string
      subscriptions: ReadonlyArray<{ tableId: string; events: readonly WebhookEvent[] }>
      sessionId: string
    },
  ): Promise<{ readonly webhook: WebhookSummary; readonly secret: string }>
  /** Stops or restarts a webhook; restarting checks its mask again (08 §10.3). */
  setWebhookActive(
    ctx: RequestContext,
    request: { webhookId: string; active: boolean; sessionId: string },
  ): Promise<WebhookSummary>
  deleteWebhook(
    ctx: RequestContext,
    request: { webhookId: string; sessionId: string },
  ): Promise<void>
  /** The last deliveries of a webhook — states, never bodies (08 §10.9). */
  listDeliveries(
    ctx: RequestContext,
    request: { webhookId: string; limit?: number },
  ): Promise<WebhookDelivery[]>
  /** `propose_create_table` — an agent proposes a table; a person decides (09 §7). */
  agentProposeCreateTable(
    ctx: RequestContext,
    request: {
      base: string
      label: string
      description?: string | null
      fields: readonly ProposedField[]
    },
  ): Promise<Proposal>
  /** `propose_add_field` — a column, a list of choices or a link (09 §7.4). */
  agentProposeAddField(
    ctx: RequestContext,
    request: {
      base: string
      table: string
      label: string
      kind: FieldKind | 'link'
      description?: string | null
      options?: ReadonlyArray<{ value: string; label?: string }>
      target?: string
      onDelete?: string
    },
  ): Promise<Proposal>
  /** `get_proposal` — its author, and nobody else on the agent surface. */
  agentGetProposal(ctx: RequestContext, proposalId: string): Promise<Proposal>
  /** The review queue of a base (09 §7.2), newest first. `manage_schema` on the base. */
  listProposals(ctx: RequestContext, request: { baseId: string }): Promise<Proposal[]>
  /** Approves and carries out a proposal, every check made again (09 §7.5, §7.6). */
  approveProposal(ctx: RequestContext, request: { proposalId: string }): Promise<Proposal>
  rejectProposal(ctx: RequestContext, request: { proposalId: string }): Promise<Proposal>
  /** One pass of the webhook sender, now; returns the deliveries handled. */
  dispatchWebhooks(): Promise<number>
  /** Moves what the capture buffered into the journals now; returns the rows moved. */
  drainHistory(): Promise<number>
  /** The catalog of base templates (chapter 20): the instance's, the site's, the carried ones. */
  listTemplates(ctx: RequestContext): Promise<CatalogListing>
  getTemplate(ctx: RequestContext, key: string): Promise<CatalogEntry>
  /** Imports a template into the instance — an administrator of the instance. */
  importTemplate(ctx: RequestContext, raw: unknown): ReturnType<typeof importTemplate>
  deleteTemplate(ctx: RequestContext, key: string): Promise<void>
  /** A template proposed by the AI from a sentence (chapter 20 §5). */
  draftTemplate(
    ctx: RequestContext,
    transport: ProviderTransport,
    request: TemplateDraftRequest,
  ): Promise<TemplateDraft>
  /** The Slack connections of a base (chapter 19 §1). */
  listIntegrations(ctx: RequestContext, request: { baseId: string }): Promise<Integration[]>
  createIntegration(
    ctx: RequestContext,
    request: { baseId: string; label: unknown; url: unknown },
  ): Promise<Integration>
  deleteIntegration(ctx: RequestContext, request: { baseId: string; id: string }): Promise<void>
  testIntegration(
    ctx: RequestContext,
    request: { baseId: string; id: string },
  ): Promise<{ status: number }>
  /** The synced tables of a base (chapter 19 §3). */
  listSyncedTables(ctx: RequestContext, request: { baseId: string }): Promise<SyncedTable[]>
  createSyncedTable(
    ctx: RequestContext,
    request: {
      baseId: string
      label: unknown
      source: { kind?: unknown; url?: unknown }
      intervalMinutes?: unknown
    },
  ): Promise<SyncedTable>
  updateSyncedTable(
    ctx: RequestContext,
    request: { baseId: string; tableId: string; intervalMinutes: unknown },
  ): Promise<SyncedTable>
  stopSyncedTable(ctx: RequestContext, request: { baseId: string; tableId: string }): Promise<void>
  runSyncedTable(
    ctx: RequestContext,
    request: { baseId: string; tableId: string },
  ): Promise<SyncedTable>
  /** One pass of the synchronisation worker, now; returns the tables handled. */
  syncDue(): Promise<number>
  /**
   * The iCalendar feed of a shared calendar or timeline (chapter 19 §2.1): the page's rows
   * on the publisher's authority, as events — for a public share only.
   */
  openSharedCalendar(request: { token: string; requestId: string; host: string }): Promise<string>
  /** The dashboards of a base (chapter 18). */
  listDashboards(ctx: RequestContext, request: { baseId: string }): Promise<Dashboard[]>
  createDashboard(
    ctx: RequestContext,
    request: { baseId: string; input: DashboardInput },
  ): Promise<Dashboard>
  updateDashboard(
    ctx: RequestContext,
    request: { baseId: string; id: string; input: DashboardInput },
  ): Promise<Dashboard>
  deleteDashboard(ctx: RequestContext, request: { baseId: string; id: string }): Promise<void>
  /** The saved questions of a base (chapter 18 §3), for whoever sees it. */
  listQuestions(ctx: RequestContext, request: { baseId: string }): Promise<Question[]>
  getQuestion(ctx: RequestContext, request: { baseId: string; id: string }): Promise<Question>
  createQuestion(
    ctx: RequestContext,
    request: { baseId: string; input: QuestionInput },
  ): Promise<Question>
  updateQuestion(
    ctx: RequestContext,
    request: { baseId: string; id: string; input: QuestionInput },
  ): Promise<Question>
  deleteQuestion(ctx: RequestContext, request: { baseId: string; id: string }): Promise<void>
  /**
   * Runs a question with the caller's rights (chapter 18 §3): one built with the mouse,
   * through the readers' plans; a SQL one, read only on their own role. `question` runs a
   * saved one as its builder saved it; `query`, one given whole. The filters of a dashboard
   * come as `constraints`.
   */
  runQuestion(
    ctx: RequestContext,
    request: {
      baseId: string
      question?: string
      query?: unknown
      constraints?: unknown
      timezone?: string
      weekStart?: 0 | 1
    },
  ): Promise<QueryResult>
  /** How a dashboard is shared — its link and settings, or none (chapter 18 §2.5). */
  getDashboardSharing(
    ctx: RequestContext,
    request: { baseId: string; dashboardId: string },
  ): Promise<DashboardSharing>
  /** Shares a dashboard, or changes how; whoever saves becomes its publisher. */
  saveDashboardSharing(
    ctx: RequestContext,
    request: { baseId: string; dashboardId: string } & DashboardShareSettings,
  ): Promise<DashboardSharing>
  /** A new link for a shared dashboard: the old one stops working. */
  regenerateDashboardShare(
    ctx: RequestContext,
    request: { baseId: string; dashboardId: string },
  ): Promise<DashboardSharing>
  /** Stops sharing a dashboard. */
  deleteDashboardShare(
    ctx: RequestContext,
    request: { baseId: string; dashboardId: string },
  ): Promise<void>
  /**
   * Opens a shared dashboard by its link — chapter 18 §2.5: its tabs, filters and cards,
   * and the fields they show, as the publisher reads them. No right on the base is needed;
   * `reader` is the signed-in person, when there is one — a members' share refuses without.
   */
  openSharedDashboard(request: {
    token: string
    reader: RequestContext | null
    requestId: string
  }): Promise<SharedDashboardPage>
  /**
   * Runs one card of a shared dashboard on the publisher's authority, its filters tied by
   * the kernel from the visitor's `values` — never a query of the visitor's.
   */
  runSharedCard(request: {
    token: string
    reader: RequestContext | null
    requestId: string
    card: string
    values?: unknown
    timezone?: string
    weekStart?: 0 | 1
  }): Promise<QueryResult>
  /** The values a category filter of a shared dashboard offers. */
  sharedParameterValues(request: {
    token: string
    reader: RequestContext | null
    requestId: string
    parameter: string
  }): Promise<ValueChoice[]>
  /** The automations of a base (chapter 17). */
  listAutomations(ctx: RequestContext, request: { baseId: string }): Promise<Automation[]>
  createAutomation(
    ctx: RequestContext,
    request: { baseId: string; input: AutomationInput },
  ): Promise<Automation>
  updateAutomation(
    ctx: RequestContext,
    request: { baseId: string; id: string; input: AutomationInput },
  ): Promise<Automation>
  deleteAutomation(ctx: RequestContext, request: { baseId: string; id: string }): Promise<void>
  listAutomationRuns(
    ctx: RequestContext,
    request: { baseId: string; id: string },
  ): Promise<AutomationRun[]>
  /** Queues a run for a row: a button clicked, or a test (chapter 17 §4). */
  requestAutomationRun(
    ctx: RequestContext,
    request: { automationId: string; recordId: string | null },
  ): Promise<{ runId: string }>
  /** One pass of the automation worker, now; returns the runs handled. */
  runAutomations(options?: { readonly aiTransport?: ProviderTransport }): Promise<number>
  /** Undoes a transaction of the caller's (chapter 16 §4); returns the undo's own. */
  undoTransaction(ctx: RequestContext, request: { transaction: string }): Promise<Undone>
  /** The comments of a row, oldest first (chapter 16 §1). */
  listComments(
    ctx: RequestContext,
    request: { tableId: string; recordId: string },
  ): Promise<Comment[]>
  addComment(
    ctx: RequestContext,
    request: { tableId: string; recordId: string; body: unknown },
  ): Promise<{ comment: Comment; unreachable: readonly string[] }>
  editComment(ctx: RequestContext, request: { commentId: string; body: unknown }): Promise<Comment>
  deleteComment(ctx: RequestContext, request: { commentId: string }): Promise<void>
  /** The caller's notifications, newest first (chapter 16 §2). */
  listNotifications(
    ctx: RequestContext,
    request: { unread?: boolean; after?: string; limit?: number },
  ): Promise<NotificationPage>
  markNotificationsRead(
    ctx: RequestContext,
    request: { ids?: readonly string[]; all?: boolean },
  ): Promise<number>
  /** Whether the caller may read a table — what a live stream decides once. */
  canReadTable(ctx: RequestContext, tableId: string): Promise<boolean>
  /** Presence (chapter 16 §3.3). */
  enterPresence(
    ctx: RequestContext,
    request: { session: string; tableId: string; recordId: string | null },
  ): Promise<void>
  refreshPresence(sessions: readonly string[]): Promise<void>
  leavePresence(session: string): Promise<void>
  viewersOf(tableId: string): Promise<Viewer[]>
  /** Moves a stream's pointer over the grid (chapter 16 §3.4): a signal, nothing written. */
  movePointer(
    ctx: RequestContext,
    request: { session: string; tableId: string; at: PointerAt | null },
  ): Promise<void>
  /** The columns the caller reads in a table, by physical name. */
  readableFieldNames(ctx: RequestContext, tableId: string): Promise<ReadonlySet<string>>
  /**
   * The live signals of every instance (chapter 16 §3.1), heard on the listening
   * connection once `start` has run: `subscribe` hands each to the handler.
   */
  readonly live: {
    start(): Promise<void>
    subscribe(handler: (signal: LiveSignal) => void): () => void
    readonly ready: boolean
  }
  /**
   * Starts the work a serving process does in the background — the history drain. Called
   * once by the server; a test drains by hand instead, and deterministically.
   */
  startBackground(options?: {
    /** The AI provider's transport, for the automations' AI steps (chapter 17 §1.3). */
    readonly aiTransport?: ProviderTransport
  }): void
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
/** How often the history drain passes when nothing wakes it (chapter 07 §1.4). */
const DRAIN_INTERVAL_MS = 2_000

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

  /** Stops the background drain and the webhook sender, once started. */
  let stopDrain: (() => void) | undefined
  let stopDispatch: (() => void) | undefined
  let stopPurge: (() => void) | undefined
  let stopAutomations: (() => void) | undefined
  let stopSync: (() => void) | undefined
  /** The listening connection (chapter 10 §3.1): the drain's wake-up, the live signals. */
  const listener = new Listener(config.connectionString, [DRAIN_CHANNEL, LIVE_CHANNEL], (error) => {
    console.error('connexion d’écoute :', error instanceof Error ? error.message : error)
  })
  let listening: Promise<void> | null = null
  const liveHandlers = new Set<(signal: LiveSignal) => void>()
  listener.on(LIVE_CHANNEL, (payload) => {
    const signal = parseLive(payload)
    if (signal === null) return
    for (const handler of liveHandlers) handler(signal)
  })
  // A write woke the drain: one pass soon, coalescing a burst of wake-ups into one.
  let drainSoon: NodeJS.Timeout | null = null
  listener.on(DRAIN_CHANNEL, () => {
    if (drainSoon !== null) return
    drainSoon = setTimeout(() => {
      drainSoon = null
      drainHistory(pools).catch((error) => console.error('drain de l’historique :', error))
    }, 50)
  })
  const webhookTargets = config.webhookTargets ?? STRICT_TARGETS
  const templates = {
    url: config.templatesUrl === undefined ? DEFAULT_TEMPLATES_URL : config.templatesUrl,
    targets: webhookTargets,
  }

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

  /** A question run with `ctx`'s rights: built with the mouse, or in SQL (chapter 18 §3). */
  const runAnyQuery = (
    ctx: RequestContext,
    baseId: string,
    query: unknown,
    rawConstraints: unknown,
    options: { readonly timezone?: string; readonly weekStart?: 0 | 1 },
  ): Promise<QueryResult> => {
    const kind =
      typeof query === 'object' && query !== null ? (query as { kind?: unknown }).kind : null
    const constraints = checkConstraints(rawConstraints)
    if (kind === 'sql') {
      return runSqlQuestion(pools, ctx, config.encryptionKey, config.connectionString, {
        baseId,
        query: checkSqlQuery(query),
        constraints,
        timeZone: options.timezone,
        weekStart: options.weekStart,
      })
    }
    return runBuilderQuery(pools, ctx, {
      baseId,
      query: checkBuilderQuery(query),
      constraints,
      timeZone: options.timezone,
      weekStart: options.weekStart,
    })
  }

  /** The saved questions of a base, as a shared dashboard's cards run them. */
  const sharedQuestions = async (
    authority: RequestContext,
    baseId: string,
  ): Promise<Map<string, SavedQuestion>> =>
    new Map(
      (await listQuestions(pools, authority, { baseId })).map((q) => [
        q.id,
        { label: q.label, query: q.query, visualization: q.visualization },
      ]),
    )

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

  /** The AI workers started, stopped by `close` before the pools they use. */
  const workers: AiWorker[] = []

  return {
    async migrateCatalog(options) {
      const applied = await migrateCatalogSchema(config.connectionString, APPLICATION_VERSION, {
        onApplied: options?.onApplied,
        onWaiting: options?.onWaiting,
      })
      // What follows is idempotent, and runs at every start.
      await seedErrorCodes()
      await ensureJournalPartitions()
      // A plan whose lease expired while a process was down is moved to `interrupted`,
      // never replayed on its own (chapter 06 §1.3). It stops the base from looking
      // like it has a migration running, and leaves a human something to resume.
      await reclaimStaleMigrations(pools)
      return applied.length
    },

    catalogStatus: () => inspectCatalog(config.connectionString),

    bootstrap: (request) => bootstrapInstance(pools, request),
    bootstrapOpen: () => bootstrapOpen(pools),
    bootstrapAdministrator: (request) => bootstrapAdministrator(pools, instanceKey(), request),

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
    listOwnApiTokens: (ctx) => listOwnApiTokens(pools, ctx),
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
    updateProfile: (ctx, change) => updateProfile(pools, ctx, change),
    changeEmail: (ctx, request) => changeEmail(pools, ctx, { ...request, mailer: config.mailer }),
    listOwnIdentities: (authenticated) => listOwnIdentities(pools, authenticated.userId),
    listSessions: (authenticated) => listLiveSessions(pools, authenticated.userId),
    revokeSession: (authenticated, scope) => revoke(pools, authenticated, scope),
    setPassword: (request) => setPassword(pools, instanceKey(), request),
    changePassword: (request) => changePassword(pools, instanceKey(), request),
    elevate: (token, password) => elevate(pools, instanceKey(), token, password),
    dropElevation: (token) => dropElevation(pools, token),
    requestPasswordReset: (email, acceptLanguage) =>
      requestPasswordReset(pools, { email, mailer: config.mailer, acceptLanguage }),
    confirmPasswordReset: (request) => confirmPasswordReset(pools, instanceKey(), request),

    oidcProviders: async (tenantRef) => {
      const providers = await pools.withConnection('catalog', (exec) =>
        loadProviders(exec, instanceKey(), tenantRef, config.oidcProviders),
      )
      // The slug and the label, and nothing else: a client identifier or an issuer would
      // describe the operator's arrangements to anyone who asks.
      return providers.map((p) => ({ slug: p.slug, label: p.label }))
    },

    oidcStart: async (request) => {
      const provider = await requireProvider(
        pools,
        instanceKey(),
        request.tenantRef,
        request.slug,
        config.oidcProviders,
      )
      return startOidc(instanceKey(), provider, {
        redirectUri: request.redirectUri,
        returnTo: request.returnTo,
      })
    },

    oidcCallback: async (request) => {
      const key = instanceKey()
      const provider = await requireProvider(
        pools,
        key,
        request.tenantRef,
        request.slug,
        config.oidcProviders,
      )
      const asserted = await completeOidc(key, provider, {
        code: request.code,
        state: request.state,
        cookie: request.cookie,
      })
      if (asserted.linkSession !== null) {
        const linkSession = asserted.linkSession
        const now = new Date()
        const snapshot = await pools.withConnection('catalog', (exec) =>
          loadSessionById(exec, linkSession),
        )
        // The session that opened the exchange, still open: a link made for a session
        // closed since — signed out, revoked, its password changed — is made for nobody.
        if (
          snapshot === null ||
          !sessionUsable(snapshot, now) ||
          snapshot.tenantRef !== request.tenantRef
        ) {
          throw new BasedbError('AUTHENTICATION_REQUIRED')
        }
        const ctx = sealContext({
          requestId: request.requestId ?? 'oidc-link',
          actor: { kind: 'user', id: snapshot.userId },
          tenantId: snapshot.tenantRef,
          surface: 'rest',
          timestamp: now,
          deadline: new Date(now.getTime() + DEFAULT_TIMEOUT_MS),
          permissions: { version: '1', rowPredicate: 'TRUE' },
        })
        await withTransaction(pools, 'catalog', ctx, async (exec) => {
          await linkIdentity(exec, provider, snapshot.userId, asserted.subject)
          await writeAudit(exec, ctx, {
            action: 'user.identity_link',
            objectKind: 'app_user',
            objectId: snapshot.userId,
            payload: { provider: provider.slug },
          })
        })
        return { kind: 'linked', returnTo: asserted.returnTo }
      }

      const resolved = await resolveIdentity(pools, provider, request.tenantRef, asserted)
      const session = await loginWithOidc(pools, key, resolved, {
        ip: request.ip,
        userAgent: request.userAgent,
      })
      return {
        kind: 'session',
        session,
        returnTo: asserted.returnTo,
        provisioned: resolved.provisioned,
      }
    },

    oidcLinkStart: async (ctx, request) => {
      const key = instanceKey()
      const provider = await requireProvider(
        pools,
        key,
        ctx.tenantId,
        request.slug,
        config.oidcProviders,
      )
      // Linking a provider is handing someone else the power to sign into this account:
      // it demands a proof made minutes ago, not one made last week. The exchange then
      // carries the session, and the return re-reads it.
      await pools.withConnection('catalog', (exec) =>
        requireElevatedSession(exec, ctx, request.sessionId),
      )
      return startOidc(key, provider, {
        redirectUri: request.redirectUri,
        returnTo: request.returnTo,
        linkSession: request.sessionId,
      })
    },

    oidcUnlink: (ctx, request) =>
      withTransaction(pools, 'catalog', ctx, async (exec) => {
        await requireElevatedSession(exec, ctx, request.sessionId)
        await unlinkIdentity(exec, request.slug, ctx.actor.id)
        await writeAudit(exec, ctx, {
          action: 'user.identity_unlink',
          objectKind: 'app_user',
          objectId: ctx.actor.id,
          payload: { provider: request.slug },
        })
      }),

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
    scopeSharing: (ctx, request) => scopeSharing(pools, ctx, instanceKey(), request),
    inviteToScope: (ctx, request) => inviteToScope(pools, ctx, instanceKey(), request),
    revokeInvitation: (ctx, request) => revokeInvitation(pools, ctx, request),
    setPersonAccess: (ctx, request) => setPersonAccess(pools, ctx, instanceKey(), request),
    invitationPreview: (tenantRef, token) => invitationPreview(pools, tenantRef, token),
    acceptInvitation: (ctx, request) => acceptInvitation(pools, ctx, request),
    signupPolicy: (tenantRef) => signupPolicy(pools, tenantRef),
    adminSignupPolicy: (ctx) => adminSignupPolicy(pools, ctx),
    setSignupPolicy: (ctx, request) => setSignupPolicy(pools, ctx, request),
    signUp: (request) => signUp(pools, instanceKey(), request),
    fieldAccess: (ctx, request) => fieldAccess(pools, ctx, request),
    setFieldRule: (ctx, request) => setFieldRule(pools, ctx, request),
    effectiveFieldMask: (ctx, request) => effectiveFieldMask(pools, ctx, request),
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
    reorderFields: (ctx, request) => reorderFields(pools, ctx, request),
    setFieldFormat: (ctx, request) => setFieldFormat(pools, ctx, request),
    setFormula: (ctx, request) => setFormula(pools, ctx, request),
    listMembers: (ctx) => listMembers(pools, ctx),
    listViews: (ctx, request) => listViews(pools, ctx, request),
    createView: (ctx, request) => createView(pools, ctx, request),
    updateView: (ctx, request) => updateView(pools, ctx, request),
    deleteView: (ctx, request) => deleteView(pools, ctx, request),
    reorderViews: (ctx, request) => reorderViews(pools, ctx, request),
    setSelectOptions: (ctx, request) => setSelectOptions(pools, ctx, request),
    // Deleting a base deletes every environment of it, production last (chapter 14).
    deleteBase: async (ctx, request) => {
      let last: Migration | null = null
      for (const baseId of await deletionOrder(pools, ctx, request.baseId)) {
        last = await deleteBase(pools, ctx, { baseId })
        if (last.status !== 'applied') return last
      }
      if (last === null) return deleteBase(pools, ctx, request)
      return last
    },
    listEnvironments: (ctx, request) => listEnvironments(pools, ctx, request),
    createEnvironment: async (ctx, request) => {
      const created = await createEnvironmentBase(pools, ctx, request)
      const report = await applyStructure(pools, ctx, {
        sourceBaseId: created.sourceBaseId,
        targetBaseId: created.environment.id,
        steps: 'all',
        consent: request.consent === true,
        fork: true,
      })
      return { environment: created.environment, report }
    },
    renameEnvironment: (ctx, request) => renameEnvironment(pools, ctx, request),
    deleteEnvironment: async (ctx, request) => {
      await assertDeletableEnvironment(pools, ctx, request.baseId)
      return deleteBase(pools, ctx, request)
    },
    compareEnvironments: (ctx, request) => compareEnvironments(pools, ctx, request),
    planStructure: (ctx, request) => planStructure(pools, ctx, request),
    applyStructure: (ctx, request) => applyStructure(pools, ctx, request),
    countRows: (ctx, request) => countRows(pools, ctx, request),
    compareRows: (ctx, request) => compareRows(pools, ctx, request),
    syncRows: async (ctx, request) => {
      // What the target held is drained into its history before it is overwritten.
      await drainHistory(pools).catch(() => undefined)
      return syncRows(pools, ctx, request)
    },
    structureHistory: (ctx, request) => structureHistory(pools, ctx, request),
    getFormSharing: (ctx, request) => getFormSharing(pools, ctx, instanceKey(), request),
    saveFormSharing: (ctx, request) => saveFormSharing(pools, ctx, instanceKey(), request),
    regenerateFormShare: (ctx, request) => regenerateFormShare(pools, ctx, instanceKey(), request),
    deleteFormShare: (ctx, request) => deleteFormShare(pools, ctx, request),
    openSharedForm: (request) => openSharedForm(pools, request),
    submitSharedForm: (request) => submitSharedForm(pools, request),
    openSharedView: async (request) => {
      const view = await admitSharedView(pools, request)
      const base = await projectBase(pools, view.authority, view.baseId)
      const table = base.tables.find((t) => t.id === view.tableId)
      if (table === undefined) {
        throw new BasedbError('VIEW_SHARE_CLOSED', { details: { reason: 'authority' } })
      }
      const shown = shownFields(view.kind, view.spec, table)
      const readableNames = new Set(table.fields.map((f) => f.name))
      const sort = sortOf(view.spec, readableNames)
      const page = await listRecords(pools, view.authority, {
        tableId: view.tableId,
        filter: typeof view.spec.filter === 'string' ? view.spec.filter : undefined,
        sort: sort || undefined,
        select: shown.map((f) => f.name),
        limit: view.kind === 'grid' ? 100 : 250,
        after: request.after,
      }).catch(filterRefused)
      const signed =
        page.fileColumns.length === 0
          ? page.rows
          : withFileLinks(files.linkKey, view.authority, page.rows, page.fileColumns)
      // The people the page names, by their name alone.
      const ids = peopleIn(signed, shown)
      const people = new Map<string, string | null>()
      if (ids.length > 0) {
        await pools.withConnection('catalog', async (exec) => {
          const found = await exec.query<{ id: string; display_name: string | null }>(
            `SELECT u.id::text, NULLIF(u.display_name, '') AS display_name
               FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE t.ref = $1 AND u.id = ANY($2::uuid[])`,
            [view.authority.tenantId, ids],
          )
          for (const r of found) people.set(r.id, r.display_name)
        })
      }
      return {
        kind: view.kind,
        title: view.label,
        description: view.description,
        access: view.access,
        reader: view.reader,
        canEmbed: view.canEmbed,
        fields: shown.map(sharedField),
        spec: pageSpec(view.spec, new Set(shown.map((f) => f.name)), sort !== ''),
        rows: signed.map((row) => sharedRow(row, shown, people)),
        nextCursor: page.nextCursor,
      }
    },
    deleteTable: (ctx, request) => deleteTable(pools, ctx, request),
    previewTableDeletion: (ctx, tableId) => previewTableDeletion(pools, ctx, tableId),
    restoreBase: (ctx, request) => restoreBase(pools, ctx, request),
    renameImpact: (ctx, request) => renameImpact(pools, ctx, request),
    renamePhysical: async (ctx, request) => {
      // A column rename changes the names the capture writes under: what is still in the
      // buffer is drained first, under the names the catalog knows them by.
      if (request.kind === 'field') await drainHistory(pools)
      return renamePhysical(pools, ctx, request)
    },
    listAliases: (ctx, request) => listAliases(pools, ctx, request),
    startBlankCut: (ctx, request) => startBlankCut(pools, ctx, request),
    endBlankCut: (ctx, request) => endBlankCut(pools, ctx, request),
    dropAlias: (ctx, request) => dropAlias(pools, ctx, request),
    listDeletedTables: (ctx, request) => listDeletedTables(pools, ctx, request),
    exportForPurge: (ctx, request) => exportForPurge(pools, ctx, config.exportDir, request),
    purge: (ctx, request) => purge(pools, ctx, request),
    listDeletedBases: (ctx) => listDeletedBases(pools, ctx),
    listMigrations: (ctx, baseId) => listMigrations(pools, ctx, baseId),
    resumeMigration: (ctx, migrationId) => applyMigration(pools, ctx, migrationId),
    draftExpression: (ctx, transport, request) => draftExpression(pools, ctx, transport, request),
    draftStructure: (ctx, transport, request) => draftStructure(pools, ctx, transport, request),
    copilot: (ctx, transport, request) =>
      copilotTurn(pools, ctx, transport, request, (baseId, sql) =>
        runConsoleSql(pools, ctx, config.encryptionKey, config.connectionString, {
          baseId,
          sql,
          limit: 50,
          readOnly: true,
        }),
      ),
    dashboardCopilot: (ctx, transport, request) =>
      dashboardCopilotTurn(pools, ctx, transport, request, {
        runQuery: (query, constraints) =>
          runAnyQuery(ctx, request.baseId, query, constraints, request),
        readSql: (baseId, sql) =>
          runConsoleSql(pools, ctx, config.encryptionKey, config.connectionString, {
            baseId,
            sql,
            limit: 50,
            readOnly: true,
          }),
      }),
    automationCopilot: (ctx, transport, request) =>
      automationCopilotTurn(pools, ctx, transport, request, {
        targets: webhookTargets,
        readSql: (baseId, sql) =>
          runConsoleSql(pools, ctx, config.encryptionKey, config.connectionString, {
            baseId,
            sql,
            limit: 50,
            readOnly: true,
          }),
      }),
    aiFieldStatus: (ctx, fieldId) => aiFieldStatus(pools, ctx, fieldId),
    setAiField: (ctx, request) => setAiField(pools, ctx, request),
    disableAiField: (ctx, fieldId) => disableAiField(pools, ctx, fieldId),
    runAiCell: (ctx, transport, request) => runAiCell(pools, ctx, transport, request),
    requestAiSweep: (ctx, fieldId) => requestAiSweep(pools, ctx, fieldId),
    previewSchedule: (ctx, request) => {
      const timezone = request.timezone.trim() || 'UTC'
      const cron = checkSchedule(request.cron, timezone, ctx.timestamp)
      return {
        runs: nextRuns(cron, timezone, ctx.timestamp, 5).map((d) => d.toISOString()),
      }
    },
    startAiWorker: (transport, options) => {
      const worker = startAiWorker(pools, transport, options)
      workers.push(worker)
      return worker
    },
    runSql: (ctx, request) =>
      runSql(pools, ctx, config.encryptionKey, config.connectionString, request),
    listQueries: (ctx, request) => listQueries(pools, ctx, request),
    getQuery: (ctx, request) => getQuery(pools, ctx, request),
    createQuery: (ctx, request) => createQuery(pools, ctx, request),
    updateQuery: (ctx, request) => updateQuery(pools, ctx, request),
    deleteQuery: (ctx, request) => deleteQuery(pools, ctx, request),
    listQueryGroups: (ctx, request) => listQueryGroups(pools, ctx, request),
    listSqlViews: (ctx, request) => listSqlViews(pools, ctx, request),
    getSqlView: (ctx, request) => getSqlView(pools, ctx, request),
    createSqlView: (ctx, request) => createSqlView(pools, ctx, request),
    updateSqlView: (ctx, request) => updateSqlView(pools, ctx, request),
    deleteSqlView: (ctx, request) => deleteSqlView(pools, ctx, request),
    reorderSqlViews: (ctx, request) => reorderSqlViews(pools, ctx, request),
    readSqlView: async (ctx, request) =>
      runSql(pools, ctx, config.encryptionKey, config.connectionString, {
        baseId: request.baseId,
        sql: await sqlViewStatement(pools, ctx, request),
        ...(request.limit === undefined ? {} : { limit: request.limit }),
        readOnly: true,
      }),
    listRecords: async (ctx, options) => {
      const result = await listRecords(pools, ctx, options)
      return result.fileColumns.length === 0
        ? result
        : { ...result, rows: withFileLinks(files.linkKey, ctx, result.rows, result.fileColumns) }
    },
    aggregateRecords: (ctx, request) => aggregateRecords(pools, ctx, request),
    listInverseLinks: (ctx, options) => listInverseLinks(pools, ctx, options),
    createRecord: async (ctx, options) => linked(ctx, await createRecord(pools, ctx, options)),
    createRecords: (ctx, options) => createRecords(pools, ctx, options),
    updateRecord: async (ctx, options) => linked(ctx, await updateRecord(pools, ctx, options)),
    uploadFile: (ctx, request) => uploadFile(files, ctx, request),
    openFile: (request) => openFile(files, request, new Date()),
    files: { storage: storage.description, maxBytes: files.maxBytes },
    deleteRecord: (ctx, options) => deleteRecord(pools, ctx, options),
    recordHistory: (ctx, request) => recordHistory(pools, ctx, request),
    baseHistory: (ctx, request) => baseHistory(pools, ctx, request),
    revertRevision: (ctx, request) => revertRevision(pools, ctx, request),
    restoreRecord: (ctx, request) => restoreRecord(pools, ctx, request),
    drainHistory: () => drainHistory(pools),
    undoTransaction: (ctx, request) => undoTransaction(pools, ctx, request),
    listTemplates: (ctx) => listTemplates(pools, ctx, templates),
    getTemplate: (ctx, key) => getTemplate(pools, ctx, templates, key),
    importTemplate: (ctx, raw) => importTemplate(pools, ctx, raw),
    deleteTemplate: (ctx, key) => deleteTemplate(pools, ctx, key),
    draftTemplate: (ctx, transport, request) => draftTemplate(pools, ctx, transport, request),
    listIntegrations: (ctx, request) => listIntegrations(pools, ctx, request),
    createIntegration: (ctx, request) =>
      createIntegration(pools, ctx, instanceKey(), {
        ...request,
        anyHost: webhookTargets.allowPrivate,
      }),
    deleteIntegration: (ctx, request) => deleteIntegration(pools, ctx, request),
    testIntegration: (ctx, request) => testIntegration(pools, ctx, instanceKey(), request),
    listSyncedTables: (ctx, request) => listSyncedTables(pools, ctx, request),
    createSyncedTable: (ctx, request) =>
      createSyncedTable(pools, ctx, instanceKey(), webhookTargets, request),
    updateSyncedTable: (ctx, request) => updateSyncedTable(pools, ctx, request),
    stopSyncedTable: (ctx, request) => stopSyncedTable(pools, ctx, request),
    runSyncedTable: (ctx, request) =>
      runSyncedTable(pools, ctx, instanceKey(), webhookTargets, request),
    syncDue: () => syncDue(pools, instanceKey(), webhookTargets),
    openSharedCalendar: async (request) => {
      const view = await admitSharedView(pools, {
        token: request.token,
        reader: null,
        requestId: request.requestId,
      }).catch((error) => {
        // An agenda that subscribes does not sign in: a members' share has no feed.
        if (error instanceof BasedbError && error.code === 'AUTHENTICATION_REQUIRED') {
          throw new BasedbError('VIEW_SHARE_RESTRICTED', {
            details: { reason: 'flux_public_seulement' },
          })
        }
        throw error
      })
      if (view.kind !== 'calendar' && view.kind !== 'timeline') {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { view: 'calendrier' } })
      }
      const base = await projectBase(pools, view.authority, view.baseId)
      const table = base.tables.find((t) => t.id === view.tableId)
      if (table === undefined) {
        throw new BasedbError('VIEW_SHARE_CLOSED', { details: { reason: 'authority' } })
      }
      const shown = shownFields(view.kind, view.spec, table)
      const rows: Array<Record<string, unknown>> = []
      let after: string | undefined
      do {
        const page = await listRecords(pools, view.authority, {
          tableId: view.tableId,
          filter: typeof view.spec.filter === 'string' ? view.spec.filter : undefined,
          select: shown.map((f) => f.name),
          limit: 250,
          after,
        }).catch(filterRefused)
        rows.push(...page.rows)
        after = page.nextCursor ?? undefined
      } while (after !== undefined && rows.length < CALENDAR_MAX_EVENTS)
      return icsCalendar(
        view.label,
        calendarEvents(view.kind, view.spec, shown, rows, request.host),
      )
    },
    listDashboards: (ctx, request) => listDashboards(pools, ctx, request),
    createDashboard: (ctx, request) => createDashboard(pools, ctx, request),
    updateDashboard: (ctx, request) => updateDashboard(pools, ctx, request),
    deleteDashboard: (ctx, request) => deleteDashboard(pools, ctx, request),
    listQuestions: (ctx, request) => listQuestions(pools, ctx, request),
    getQuestion: (ctx, request) => getQuestion(pools, ctx, request),
    createQuestion: (ctx, request) => createQuestion(pools, ctx, request),
    updateQuestion: (ctx, request) => updateQuestion(pools, ctx, request),
    deleteQuestion: (ctx, request) => deleteQuestion(pools, ctx, request),
    runQuestion: async (ctx, request) => {
      const query =
        request.question !== undefined
          ? (await getQuestion(pools, ctx, { baseId: request.baseId, id: request.question })).query
          : request.query
      return runAnyQuery(ctx, request.baseId, query, request.constraints, request)
    },
    getDashboardSharing: (ctx, request) => getDashboardSharing(pools, ctx, instanceKey(), request),
    saveDashboardSharing: (ctx, request) =>
      saveDashboardSharing(pools, ctx, instanceKey(), request),
    regenerateDashboardShare: (ctx, request) =>
      regenerateDashboardShare(pools, ctx, instanceKey(), request),
    deleteDashboardShare: (ctx, request) => deleteDashboardShare(pools, ctx, request),
    openSharedDashboard: async (request) => {
      const admitted = await admitSharedDashboard(pools, request)
      const questions = await sharedQuestions(admitted.authority, admitted.baseId)
      const base = await projectBase(pools, admitted.authority, admitted.baseId)
      const queries = admitted.dashboard.cards
        .filter((c) => c.kind === 'question')
        .map((c) => (c.question === undefined ? c.query : questions.get(c.question)?.query))
        .filter((q): q is NonNullable<typeof q> => q !== undefined)
      const { dashboard } = admitted
      return {
        title: dashboard.label,
        description: dashboard.description,
        access: admitted.access,
        reader: admitted.reader,
        canEmbed: admitted.canEmbed,
        tabs: dashboard.tabs,
        parameters: dashboard.parameters,
        cards: sharedCards(dashboard, questions),
        tables: sharedTables(base, queries),
      }
    },
    runSharedCard: async (request) => {
      const admitted = await admitSharedDashboard(pools, request)
      const questions = await sharedQuestions(admitted.authority, admitted.baseId)
      const run = sharedRun(admitted.dashboard, request.card, questions, request.values)
      const result = await runAnyQuery(
        admitted.authority,
        admitted.baseId,
        run.query,
        run.constraints,
        request,
      )
      return pools.withConnection('catalog', (exec) =>
        withPeopleNames(exec, admitted.authority.tenantId, forVisitor(result)),
      )
    },
    sharedParameterValues: async (request) => {
      const admitted = await admitSharedDashboard(pools, request)
      const questions = await sharedQuestions(admitted.authority, admitted.baseId)
      const query = valuesQuery(admitted.dashboard, request.parameter, questions)
      if (query === null) return []
      const result = await runBuilderQuery(pools, admitted.authority, {
        baseId: admitted.baseId,
        query: checkBuilderQuery(query),
        constraints: [],
      })
      const named = await pools.withConnection('catalog', (exec) =>
        withPeopleNames(exec, admitted.authority.tenantId, result),
      )
      return choicesOf(named, await projectBase(pools, admitted.authority, admitted.baseId))
    },
    listAutomations: (ctx, request) => listAutomations(pools, ctx, request),
    createAutomation: (ctx, request) => createAutomation(pools, ctx, webhookTargets, request),
    updateAutomation: (ctx, request) => updateAutomation(pools, ctx, webhookTargets, request),
    deleteAutomation: (ctx, request) => deleteAutomation(pools, ctx, request),
    listAutomationRuns: (ctx, request) => listAutomationRuns(pools, ctx, request),
    requestAutomationRun: (ctx, request) => requestRun(pools, ctx, request),
    runAutomations: (options) =>
      runAutomations(pools, {
        targets: webhookTargets,
        instanceKey,
        ...(options?.aiTransport === undefined ? {} : { aiTransport: options.aiTransport }),
      }),
    listComments: (ctx, request) => listComments(pools, ctx, request),
    addComment: (ctx, request) => addComment(pools, ctx, request),
    editComment: (ctx, request) => editComment(pools, ctx, request),
    deleteComment: (ctx, request) => deleteComment(pools, ctx, request),
    listNotifications: (ctx, request) => listNotifications(pools, ctx, request),
    markNotificationsRead: (ctx, request) => markNotificationsRead(pools, ctx, request),
    canReadTable: (ctx, tableId) =>
      pools.withConnection('catalog', (exec) => canReadTableIn(exec, ctx, tableId)),
    enterPresence: (ctx, request) => enterPresence(pools, ctx, request),
    refreshPresence: (sessions) => refreshPresence(pools, sessions),
    leavePresence: (session) => leavePresence(pools, session),
    viewersOf: (tableId) => viewersOf(pools, tableId),
    movePointer: (ctx, request) => movePointer(pools, ctx, request),
    readableFieldNames: (ctx, tableId) =>
      pools.withConnection('catalog', (exec) => readableFieldNames(exec, ctx, tableId)),
    live: {
      start: () => {
        listening ??= listener.start()
        return listening
      },
      subscribe: (handler) => {
        liveHandlers.add(handler)
        return () => liveHandlers.delete(handler)
      },
      get ready() {
        return listener.ready
      },
    },
    listDeletions: (ctx, request) => listDeletions(pools, ctx, request),
    listWebhooks: (ctx, request) => listWebhooks(pools, ctx, request),
    createWebhook: (ctx, request) =>
      createWebhook(pools, ctx, instanceKey(), webhookTargets, request),
    setWebhookActive: (ctx, request) => setWebhookActive(pools, ctx, request),
    deleteWebhook: (ctx, request) => deleteWebhook(pools, ctx, request),
    listDeliveries: (ctx, request) => listDeliveries(pools, ctx, request),
    dispatchWebhooks: () => dispatchWebhooks(pools, instanceKey(), webhookTargets),
    agentProposeCreateTable: (ctx, request) => agentProposeCreateTable(pools, ctx, request),
    agentProposeAddField: (ctx, request) => agentProposeAddField(pools, ctx, request),
    agentGetProposal: (ctx, proposalId) => agentGetProposal(pools, ctx, proposalId),
    listProposals: (ctx, request) => listProposals(pools, ctx, request),
    approveProposal: (ctx, request) => approveProposal(pools, ctx, request),
    rejectProposal: (ctx, request) => rejectProposal(pools, ctx, request),
    startBackground: (options) => {
      if (stopDrain !== undefined) return
      // Notifications past their retention, presence nobody refreshed: every ten minutes.
      const purge = setInterval(() => {
        purgeCollaboration(pools).catch((error) => console.error('purge :', error))
      }, 600_000)
      stopPurge = () => clearInterval(purge)
      // The synced tables due, every minute (chapter 19 §3.3).
      stopSync = startSyncWorker(pools, instanceKey, webhookTargets, 60_000, (error) =>
        console.error('synchronisation :', error),
      )
      // The automations' queue and clock (chapter 17 §2).
      stopAutomations = startAutomationWorker(
        pools,
        {
          targets: webhookTargets,
          instanceKey,
          ...(options?.aiTransport === undefined ? {} : { aiTransport: options.aiTransport }),
        },
        DRAIN_INTERVAL_MS,
        (error) => console.error('automatisations :', error),
      )
      stopDrain = startDrainLoop(pools, DRAIN_INTERVAL_MS, (error) => {
        // A drain that fails stops nothing: the buffers keep the rows, and the next pass
        // retries (07 §4.5). It is said, not swallowed.
        console.error('drain de l’historique :', error)
      })
      stopDispatch = startDispatchLoop(
        pools,
        instanceKey,
        webhookTargets,
        DRAIN_INTERVAL_MS,
        (error) => {
          console.error('envoi des webhooks :', error)
        },
      )
    },
    close: async () => {
      stopDrain?.()
      stopDispatch?.()
      stopPurge?.()
      stopAutomations?.()
      stopSync?.()
      if (drainSoon !== null) clearTimeout(drainSoon)
      await listener.stop()
      await Promise.all(workers.map((w) => w.stop()))
      await closeConsolePools()
      await closeReaderPools()
      await pools.end()
    },
  }
}
