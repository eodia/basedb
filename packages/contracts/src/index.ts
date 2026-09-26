/**
 * `@basedb/contracts` — the only vocabulary shared between the server, the front end
 * and the SDK: types, public payload shapes and the error code registry.
 *
 * The registry is GENERATED from the annex of chapter 00 (A23), which remains the
 * source of truth: `node scripts/generate-error-codes.mjs`.
 */

export {
  ALL_ERROR_CODES,
  ERROR_CODES,
  httpStatusFor,
  isErrorCode,
  type ErrorCode,
  type ErrorCodeEntry,
  type ErrorDomain,
} from './error-codes.js'

export {
  TEMPLATE_AI_KINDS,
  TEMPLATE_COMPUTED_KINDS,
  TEMPLATE_DISPLAY_KINDS,
  TEMPLATE_FIELD_KINDS,
  TEMPLATE_FORM_KINDS,
  TEMPLATE_FORMAT,
  TEMPLATE_LIMITS,
  TEMPLATE_VIEW_KINDS,
  VIEW_FIELD_KEYS,
  checkTemplate,
  citedInText,
  citedLabels,
  labelKey,
  optionValue,
  resolveTemplateDate,
  summarizeTemplate,
  translateFilter,
  type ResolvedField,
  type Template,
  type TemplateAction,
  type TemplateAutomation,
  type TemplateBlock,
  type TemplateCheck,
  type TemplateDashboard,
  type TemplateField,
  type TemplateFieldKind,
  type TemplateIssue,
  type TemplateLink,
  type TemplateOption,
  type TemplateRow,
  type TemplateSummary,
  type TemplateTable,
  type TemplateValue,
  type TemplateView,
  type TemplateViewKind,
} from './templates.js'
