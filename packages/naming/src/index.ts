/**
 * `@basedb/naming` — slugification, identifier validation, quoting and derived-name
 * patterns: all the normative content of chapter 01.
 *
 * PURE functions, NO I/O, NO dependencies (prohibition 3 of chapter 10 §1.3). Whatever
 * touches the database — allocating a name in the registry, the suffix loop, the
 * advisory lock — lives in `@basedb/core`.
 */

export {
  MAX_IDENTIFIER_BYTES,
  byteLength,
  isAlphabetA,
  isAlphabetB,
  LEADING_UNDERSCORE_ALLOWLIST,
  SYSTEM_COLUMNS,
  type SystemColumn,
} from './alphabet.js'

export {
  BUDGETS,
  budgetForNature,
  MAX_BASE_SLUG_BYTES,
  MAX_TABLE_NAME_BYTES,
  MAX_FIELD_NAME_BYTES,
  MAX_DERIVED_NAME_BYTES,
} from './budgets.js'

export {
  SLUG_VERSION,
  TRANSLITERATION,
  slugify,
  truncateHard,
  type SlugNature,
  type SlugifyOptions,
  type SlugResult,
} from './slug.js'

export {
  TENANT_ALPHABET,
  TENANT_ID_LENGTH,
  TENANT_ID_MAX_ATTEMPTS,
  TENANT_ID_DENYLIST,
  isTenantId,
  proposeTenantId,
  proposeAllowedTenantId,
  randomAlphabetChars,
} from './tenant.js'

export {
  ESCAPE_PREFIX,
  applyNameRestrictions,
  escapeReservedPrefix,
  hasReservedPrefix,
  isReservedForScope,
  isReservedWord,
  RESERVED_WORDS,
  type Catcode,
  type NameScope,
} from './reserved.js'

export {
  SCHEMA_PREFIX_BYTES,
  composeSchemaName,
  parseSchemaName,
  schemaBelongsToTenant,
  type ParsedSchemaName,
} from './schema-name.js'

export {
  MAX_UNIQUE_COLUMNS_NAMED,
  assembleDerivedName,
  checkConstraintName,
  distributeBudget,
  foreignKeyName,
  indexName,
  linkColumnName,
  linkColumnNameFromLabel,
  primaryKeyName,
  sequenceName,
  triggerName,
  uniqueConstraintName,
  type Segment,
} from './derived.js'

export {
  MAX_RELEGATED_BASE_SLUG_BYTES,
  MAX_RELEGATED_NAME_BYTES,
  RELEGATION_PREFIX_BYTES,
  isRelegatedName,
  isRelegatedSchemaName,
  relegatedName,
  relegatedSchemaName,
  relegationDate,
} from './relegation.js'

export {
  IdentifierInvalidError,
  qualify,
  qualifyColumn,
  quoteIdentifier,
} from './quote.js'
