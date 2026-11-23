/**
 * `@basedb/naming` — slugification, identifier validation, quoting and derived-name
 * patterns: all the normative content of chapter 01.
 *
 * PURE functions, NO I/O, NO dependencies (prohibition 3 of chapter 10 §1.3). Whatever
 * touches the database — allocating a name in the registry, the suffix loop, the
 * advisory lock — lives in `@basedb/core`.
 */

export {
  byteLength,
  isAlphabetA,
  isAlphabetB,
  LEADING_UNDERSCORE_ALLOWLIST,
  MAX_IDENTIFIER_BYTES,
  SYSTEM_COLUMNS,
  type SystemColumn,
} from './alphabet.js'

export {
  BUDGETS,
  budgetForNature,
  MAX_BASE_SLUG_BYTES,
  MAX_DERIVED_NAME_BYTES,
  MAX_FIELD_NAME_BYTES,
  MAX_TABLE_NAME_BYTES,
} from './budgets.js'
export {
  assembleDerivedName,
  checkConstraintName,
  distributeBudget,
  foreignKeyName,
  indexName,
  linkColumnName,
  linkColumnNameFromLabel,
  MAX_UNIQUE_COLUMNS_NAMED,
  multiLinkColumnName,
  multiLinkColumnNameFromLabel,
  multiLinkTargetTriggerName,
  multiLinkTriggerName,
  primaryKeyName,
  type Segment,
  sequenceName,
  triggerName,
  uniqueConstraintName,
} from './derived.js'
export {
  IdentifierInvalidError,
  qualify,
  qualifyColumn,
  quoteIdentifier,
} from './quote.js'
export {
  isRelegatedName,
  isRelegatedSchemaName,
  MAX_RELEGATED_BASE_SLUG_BYTES,
  MAX_RELEGATED_NAME_BYTES,
  RELEGATION_PREFIX_BYTES,
  relegatedName,
  relegatedSchemaName,
  relegationDate,
} from './relegation.js'
export {
  applyNameRestrictions,
  type Catcode,
  ESCAPE_PREFIX,
  escapeReservedPrefix,
  hasReservedPrefix,
  isReservedForScope,
  isReservedWord,
  type NameScope,
  RESERVED_WORDS,
} from './reserved.js'
export {
  composeSchemaName,
  type ParsedSchemaName,
  parseSchemaName,
  SCHEMA_PREFIX_BYTES,
  schemaBelongsToTenant,
} from './schema-name.js'
export {
  SLUG_VERSION,
  type SlugifyOptions,
  type SlugNature,
  type SlugResult,
  slugify,
  TRANSLITERATION,
  truncateHard,
} from './slug.js'
export {
  isTenantId,
  proposeAllowedTenantId,
  proposeTenantId,
  randomAlphabetChars,
  TENANT_ALPHABET,
  TENANT_ID_DENYLIST,
  TENANT_ID_LENGTH,
  TENANT_ID_MAX_ATTEMPTS,
} from './tenant.js'
