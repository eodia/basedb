// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source: docs/architecture/00-decisions-structurantes.md, "Error code registry"
// annex. Regenerate with: node scripts/generate-error-codes.mjs
//
// A23: "A single registry [...] fixes one code per condition. A chapter may add a code
// to it, never rename one." The "Normative chapter" column alone is authoritative on a
// code's parentage.
//
// 225 codes, 8 domains.
//
// The `condition` strings are quoted verbatim from the French document, which is
// authoritative on their wording.

/** Functional domain of a code, taken from the annex sections. */
export type ErrorDomain =
  | 'amorcage_et_environnement'
  | 'nommage'
  | 'structure_et_migrations'
  | 'relations'
  | 'permissions_et_non_divulgation'
  | 'donnees_et_validation'
  | 'api_et_integrations'
  | 'authentification'

/** Every error code in the registry. */
export type ErrorCode =
  | 'CATALOG_CHECKSUM_MISMATCH'
  | 'CATALOG_DRIFT'
  | 'CATALOG_DRIFT_DETECTED'
  | 'CATALOG_VERSION_AHEAD'
  | 'COLLATION_VERSION_MISMATCH'
  | 'CONNECTION_CONTRACT_BROKEN'
  | 'DB_ENCODING_NOT_UTF8'
  | 'DB_NOT_OWNED'
  | 'DEADLINE_EXCEEDED'
  | 'EXTENSION_PG_TRGM_MISSING'
  | 'EXTENSION_UNACCENT_MISSING'
  | 'ICU_COLLATION_MISSING'
  | 'INTERNAL_ERROR'
  | 'POSTGRES_VERSION_TOO_OLD'
  | 'PRIVILEGES_INSUFFICIENT'
  | 'SERIALIZATION_CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT_EXCEEDED'
  | 'IDENTIFIER_INVALID'
  | 'LABEL_DUPLICATE'
  | 'LABEL_EMPTY'
  | 'LABEL_TOO_LONG'
  | 'NAME_AMBIGUOUS'
  | 'NAME_COLLISION_UNRESOLVED'
  | 'NAME_RETIRED'
  | 'NAME_TAKEN_OUTSIDE_REGISTRY'
  | 'NAME_TOO_LONG'
  | 'PHYSICAL_NAME_TAKEN'
  | 'REGISTRY_DIVERGENT'
  | 'SLUG_FALLBACK_APPLIED'
  | 'TENANT_ID_EXHAUSTED'
  | 'TOO_MANY_ALIASES'
  | 'ALIAS_DEPENDENT'
  | 'BASE_NOT_EMPTY'
  | 'BASE_READ_ONLY'
  | 'BASE_STRUCTURE_FROZEN'
  | 'COLUMN_HAS_VIEW_DEPENDENCIES'
  | 'CONCURRENT_CONFLICT'
  | 'CONVERSION_VALUES_INCOMPATIBLE'
  | 'DEFAULT_NOT_ALLOWED'
  | 'DEFAULT_VOLATILE_FORBIDDEN'
  | 'DEPENDENT_OBJECT'
  | 'ENVIRONMENT_IS_PRODUCTION'
  | 'ENVIRONMENT_MISMATCH'
  | 'EXPORT_STALE'
  | 'EXPORT_UNAVAILABLE'
  | 'FIELD_CONFIG_MISSING'
  | 'FIELD_USED_BY_FORMULA'
  | 'ID_IMMUTABLE'
  | 'INCOMPATIBLE_VALUES'
  | 'INDEX_LENGTH_EXCEEDED'
  | 'LENGTH_VALUES_EXCEEDED'
  | 'LOCK_UNAVAILABLE'
  | 'MIGRATION_EXPIRED'
  | 'MIGRATION_IN_PROGRESS'
  | 'MIGRATION_STALE'
  | 'MIGRATION_TAMPERED'
  | 'MIGRATION_TOO_LARGE'
  | 'OPTION_IN_USE'
  | 'PARENT_DELETED'
  | 'PLAN_CYCLIC'
  | 'PLAN_LOCK_CONFLICT'
  | 'PROJECT_NOT_EMPTY'
  | 'PURGE_TOO_EARLY'
  | 'REQUIRED_NULL_VALUES'
  | 'RESIDUAL_SCHEMA'
  | 'STEP_DEFERRED'
  | 'SYNC_REFERENCE_MISSING'
  | 'SYNC_TABLE_MISSING'
  | 'SYNC_VALUES_REFUSED'
  | 'TABLE_ATTRIBUTES_EXHAUSTED'
  | 'TABLE_MIGRATING'
  | 'TASK_IN_PROGRESS'
  | 'TIMEZONE_UNKNOWN'
  | 'TOO_MANY_TABLES'
  | 'BATCH_CASCADE_FORBIDDEN'
  | 'CASCADE_CONFIRMATION_REQUIRED'
  | 'CASCADE_CYCLE'
  | 'CASCADE_NOT_IN_MIGRATION'
  | 'CASCADE_TOO_DEEP'
  | 'CASCADE_TOO_LARGE'
  | 'DISPLAY_FIELD_IN_USE'
  | 'LINK_CASCADE_NOT_GRANTED'
  | 'LINK_CROSS_DATABASE'
  | 'LINK_ORPHAN_VALUES'
  | 'LINK_SELF_REQUIRED'
  | 'LINK_SET_NULL_ON_REQUIRED'
  | 'LINK_TARGET_NOT_FOUND'
  | 'LINK_TARGET_UNSUPPORTED'
  | 'LINK_TYPE_INCOMPATIBLE'
  | 'MCP_CASCADE_FORBIDDEN'
  | 'ROW_REFERENCED'
  | 'TABLE_REFERENCED'
  | 'TARGET_PURGED'
  | 'ACTION_FORBIDDEN'
  | 'ADMIN_REQUIRED'
  | 'AUTHORIZATION_REVOKED'
  | 'CONFIRMATION_REQUIRED'
  | 'CONFLICT'
  | 'CREATE_IMPOSSIBLE'
  | 'EMAIL_TAKEN'
  | 'EXPAND_UNAVAILABLE'
  | 'FIELD_NOT_WRITABLE'
  | 'FIELD_UNKNOWN'
  | 'FILTER_NOT_SUPPORTED'
  | 'GROUP_SYSTEM_IMMUTABLE'
  | 'LAST_INSTANCE_ADMIN'
  | 'LAST_TENANT_ADMIN'
  | 'MASK_REDUCED_MID_READ'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_INCONSISTENT'
  | 'PERMISSION_OUT_OF_SCOPE'
  | 'PRIVILEGE_ESCALATION'
  | 'RESOURCE_NOT_FOUND'
  | 'ROLE_NOT_DELEGABLE'
  | 'TENANT_ISOLATION_VIOLATED'
  | 'VALUE_REJECTED'
  | 'WEBHOOK_MASK_INCOMPLETE'
  | 'ARCHIVE_MISSING'
  | 'BULK_OPERATION_REFUSED'
  | 'CAPTURE_NOT_CONFORMING'
  | 'CAPTURE_TRIGGER_MISSING'
  | 'COMPUTED_FIELD_READ_ONLY'
  | 'DRAIN_LAGGING'
  | 'DUPLICATE_VALUE'
  | 'ERASURE_INCOMPLETE'
  | 'FILTER_NOT_INDEXABLE_VOLUME'
  | 'FORMULA_DEPENDS_ON_FORMULA'
  | 'FORMULA_FIELD_NOT_FOUND'
  | 'FORMULA_FUNCTION_NOT_IMMUTABLE'
  | 'FORMULA_LINK_FORBIDDEN'
  | 'FORMULA_NOT_IMMUTABLE'
  | 'FORMULA_SYNTAX'
  | 'FORMULA_TYPE_MISMATCH'
  | 'HISTORY_IMMUTABLE'
  | 'HISTORY_ORPHAN_ROWS'
  | 'HISTORY_PARTITION_MISSING'
  | 'HISTORY_UNAVAILABLE'
  | 'NUMBER_OUT_OF_RANGE'
  | 'PARTITION_DETACH_STUCK'
  | 'REQUIRED_FIELD_MISSING'
  | 'REQUIRED_VALUE_MISSING'
  | 'RESTORE_FIELD_CHANGED'
  | 'RESTORE_OUT_OF_RETENTION'
  | 'RESTORE_RECORD_PRESENT'
  | 'RESTORE_TARGET_MISSING'
  | 'RETENTION_INCONSISTENT'
  | 'REVISION_SUPERSEDED'
  | 'SORT_NOT_INDEXABLE_VOLUME'
  | 'TEXT_TOO_LONG'
  | 'TRUNCATE_FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'VALUE_INVALID'
  | 'VALUE_NOT_FINITE'
  | 'VALUE_OUT_OF_CONSTRAINT'
  | 'VALUE_OUT_OF_RANGE'
  | 'VALUE_TOO_LONG'
  | 'AI_CONSENT_REQUIRED'
  | 'AI_DISABLED'
  | 'AI_KEY_REJECTED'
  | 'AI_MODEL_UNKNOWN'
  | 'AI_NOT_CONFIGURED'
  | 'AI_PAYLOAD_TOO_LARGE'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_RESPONSE_UNUSABLE'
  | 'BATCH_TOO_LARGE'
  | 'BODY_TOO_LARGE'
  | 'CONCURRENCY_CONFLICT'
  | 'CONCURRENCY_LIMIT_EXCEEDED'
  | 'CONTENT_TYPE_INVALID'
  | 'CURSOR_INVALID'
  | 'CURSOR_STALE'
  | 'EXPAND_TOO_DEEP'
  | 'EXPAND_TOO_WIDE'
  | 'FIELD_NOT_EXPANDABLE'
  | 'FILTER_DISPLAY_UNAVAILABLE'
  | 'FILTER_FIELD_UNKNOWN'
  | 'FILTER_OPERATOR_INVALID'
  | 'FILTER_TOO_COMPLEX'
  | 'FILTER_TOO_LONG'
  | 'FILTER_VALUE_INVALID'
  | 'FORM_CLOSED'
  | 'FORM_RESTRICTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'IDEMPOTENCY_INTERRUPTED'
  | 'IDEMPOTENCY_STALE'
  | 'MCP_OPERATION_EXCLUDED'
  | 'PARAMETER_INVALID'
  | 'PRECHECK_TIMEOUT'
  | 'PROPOSAL_EXPIRED'
  | 'PROPOSAL_STALE'
  | 'QUERY_TOO_EXPENSIVE'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'REQUEST_INVALID'
  | 'RESUME_BEYOND_HORIZON'
  | 'SESSION_NOT_INITIALIZED'
  | 'SORT_FIELD_UNKNOWN'
  | 'SORT_UNAVAILABLE'
  | 'TOO_MANY_OPEN_PROPOSALS'
  | 'VERSION_CONFLICT'
  | 'WEBHOOK_TARGET_REJECTED'
  | 'WRITE_CONFLICT'
  | 'AUTHENTICATION_REQUIRED'
  | 'BOOTSTRAP_SECRET_INVALID'
  | 'CREDENTIALS_INVALID'
  | 'ELEVATION_REQUIRED'
  | 'OIDC_ACCOUNT_LINK_REQUIRED'
  | 'OIDC_PROVIDER_UNKNOWN'
  | 'OIDC_STATE_INVALID'
  | 'OIDC_TOKEN_INVALID'
  | 'ORIGIN_REJECTED'
  | 'PASSWORD_POLICY_VIOLATION'
  | 'PROVISIONING_REFUSED'
  | 'RESET_TOKEN_INVALID'
  | 'SESSION_EXPIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_EXPIRY_REQUIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_PRIVILEGE_REFUSED'
  | 'TOKEN_READ_ONLY'
  | 'TOKEN_REVOKED'
  | 'TOKEN_SUSPENDED'

export interface ErrorCodeEntry {
  /** The condition this code denotes, as the annex words it. */
  readonly condition: string
  /** Associated HTTP status, or `null` when the condition has no HTTP surface. */
  readonly httpStatus: number | null
  /** Whole status wording when it depends on the origin, otherwise `null`. */
  readonly httpStatusNote: string | null
  /** Chapter defining the code. Sole authority on its parentage. */
  readonly chapter: string
  readonly domain: ErrorDomain
}

export const ERROR_CODES: Readonly<Record<ErrorCode, ErrorCodeEntry>> = Object.freeze({
  CATALOG_CHECKSUM_MISMATCH: Object.freeze({
    condition: "Somme de contrôle d'une migration de catalogue déjà appliquée divergente",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '02',
    domain: 'amorcage_et_environnement',
  }),
  CATALOG_DRIFT: Object.freeze({
    condition: '42P01 ou 42703 persistant après relecture du schéma et rejeu unique',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '10',
    domain: 'amorcage_et_environnement',
  }),
  CATALOG_DRIFT_DETECTED: Object.freeze({
    condition: 'SQLSTATE de structure inattendu, ou écart de réconciliation, constaté en service',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '08',
    domain: 'amorcage_et_environnement',
  }),
  CATALOG_VERSION_AHEAD: Object.freeze({
    condition: 'La base est en avance sur le code livré',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '02',
    domain: 'amorcage_et_environnement',
  }),
  COLLATION_VERSION_MISMATCH: Object.freeze({
    condition: "Version de collation de la base d'accueil différente de celle enregistrée",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '01',
    domain: 'amorcage_et_environnement',
  }),
  CONNECTION_CONTRACT_BROKEN: Object.freeze({
    condition: "search_path ou TimeZone non conformes au premier usage d'une connexion",
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '01',
    domain: 'amorcage_et_environnement',
  }),
  DB_ENCODING_NOT_UTF8: Object.freeze({
    condition: "Base d'accueil dont l'encodage n'est pas UTF8",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '02',
    domain: 'amorcage_et_environnement',
  }),
  DB_NOT_OWNED: Object.freeze({
    condition: "Le rôle connecté n'est pas propriétaire de la base d'accueil",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '02',
    domain: 'amorcage_et_environnement',
  }),
  DEADLINE_EXCEEDED: Object.freeze({
    condition: '57014 : exécution interrompue par le budget de délai du noyau',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '10',
    domain: 'amorcage_et_environnement',
  }),
  EXTENSION_PG_TRGM_MISSING: Object.freeze({
    condition: 'Extension pg_trgm absente (A3)',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '10',
    domain: 'amorcage_et_environnement',
  }),
  EXTENSION_UNACCENT_MISSING: Object.freeze({
    condition: 'Extension unaccent absente (A3)',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '10',
    domain: 'amorcage_et_environnement',
  }),
  ICU_COLLATION_MISSING: Object.freeze({
    condition: 'Collations ICU indisponibles (A3)',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '10',
    domain: 'amorcage_et_environnement',
  }),
  INTERNAL_ERROR: Object.freeze({
    condition: 'SQLSTATE non cartographié, ou défaut interne ; request_id seul',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '05',
    domain: 'amorcage_et_environnement',
  }),
  POSTGRES_VERSION_TOO_OLD: Object.freeze({
    condition: 'Version de PostgreSQL inférieure à 16 (A1)',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '02',
    domain: 'amorcage_et_environnement',
  }),
  PRIVILEGES_INSUFFICIENT: Object.freeze({
    condition: 'Privilège CREATE ou propriété de schéma manquants ; 42501 en service',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '01',
    domain: 'amorcage_et_environnement',
  }),
  SERIALIZATION_CONFLICT: Object.freeze({
    condition: '40001 ou 40P01 après rejeu, côté noyau',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '10',
    domain: 'amorcage_et_environnement',
  }),
  SERVICE_UNAVAILABLE: Object.freeze({
    condition: '_basedb injoignable, ressources épuisées (53300, 53200)',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '08',
    domain: 'amorcage_et_environnement',
  }),
  TIMEOUT_EXCEEDED: Object.freeze({
    condition: 'statement_timeout, interblocage rejoué sans succès, ou budget de délai épuisé',
    httpStatus: 504,
    httpStatusNote: null,
    chapter: '08',
    domain: 'amorcage_et_environnement',
  }),
  IDENTIFIER_INVALID: Object.freeze({
    condition:
      "Nom technique saisi hors de l'alphabet A ; ou nom hors alphabet B au constructeur SQL",
    httpStatus: 422,
    httpStatusNote: '422 ; 500 si construit par le noyau',
    chapter: '01',
    domain: 'nommage',
  }),
  LABEL_DUPLICATE: Object.freeze({
    condition: 'Clé de comparaison de libellé déjà prise parmi les objets actifs du parent',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  LABEL_EMPTY: Object.freeze({
    condition: 'Libellé vide après suppression des espaces',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  LABEL_TOO_LONG: Object.freeze({
    condition: 'Libellé de plus de 255 caractères en NFC',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  NAME_AMBIGUOUS: Object.freeze({
    condition: 'Nom résolvant plusieurs objets visibles',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'nommage',
  }),
  NAME_COLLISION_UNRESOLVED: Object.freeze({
    condition: 'Suffixes _2 à _99 tous indisponibles',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  NAME_RETIRED: Object.freeze({
    condition:
      "Renommage d'administration visant un nom déjà enregistré au registre, quel que soit son état",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'nommage',
  }),
  NAME_TAKEN_OUTSIDE_REGISTRY: Object.freeze({
    condition: 'Nom de schéma présent dans pg_namespace sans ligne de registre',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  NAME_TOO_LONG: Object.freeze({
    condition: 'Nom dérivé dépassant 63 octets après répartition des budgets (A6)',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  PHYSICAL_NAME_TAKEN: Object.freeze({
    condition: 'Nom physique déjà enregistré dans la portée demandée',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '02',
    domain: 'nommage',
  }),
  REGISTRY_DIVERGENT: Object.freeze({
    condition: 'Écart bloquant entre le registre des noms et le catalogue système',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  SLUG_FALLBACK_APPLIED: Object.freeze({
    condition: 'Nom de repli attribué faute de caractère exploitable ; avertissement, pas un refus',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  TENANT_ID_EXHAUSTED: Object.freeze({
    condition: "Dix tirages consécutifs d'identifiant de tenant en collision ou exclus",
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '01',
    domain: 'nommage',
  }),
  TOO_MANY_ALIASES: Object.freeze({
    condition: 'Plus de cinq alias vivants sur un même objet',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'nommage',
  }),
  ALIAS_DEPENDENT: Object.freeze({
    condition: "Vue d'alias empêchant une purge ou une conversion non reconstructible",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  BASE_NOT_EMPTY: Object.freeze({
    condition: "Suppression logique d'une base dont une table est encore vivante",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '02',
    domain: 'structure_et_migrations',
  }),
  BASE_READ_ONLY: Object.freeze({
    condition: 'Opération de cycle de vie demandée sur une base non inscriptible',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  BASE_STRUCTURE_FROZEN: Object.freeze({
    condition: 'Opération de structure refusée sur une base gelée',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  COLUMN_HAS_VIEW_DEPENDENCIES: Object.freeze({
    condition: "DROP COLUMN bloqué par des vues SQL d'alias, avec leur liste",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'structure_et_migrations',
  }),
  CONCURRENT_CONFLICT: Object.freeze({
    condition: 'Entrelacement concurrent de deux opérations de structure sur le même objet',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  CONVERSION_VALUES_INCOMPATIBLE: Object.freeze({
    condition: "Valeurs non convertibles au pré-contrôle d'une conversion, avec échantillon",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'structure_et_migrations',
  }),
  DEFAULT_NOT_ALLOWED: Object.freeze({
    condition: 'Expression de défaut hors du vocabulaire autorisé',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  DEFAULT_VOLATILE_FORBIDDEN: Object.freeze({
    condition: 'Expression de défaut volatile',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  DEPENDENT_OBJECT: Object.freeze({
    condition:
      "Objet inconnu du catalogue dépendant d'une vue, d'une table ou d'un schéma à supprimer",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  ENVIRONMENT_IS_PRODUCTION: Object.freeze({
    condition:
      "Suppression de l'environnement de production seul : c'est la base entière qui se supprime",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '14',
    domain: 'structure_et_migrations',
  }),
  ENVIRONMENT_MISMATCH: Object.freeze({
    condition:
      "Comparaison, report de structure ou synchronisation entre deux bases qui ne sont pas deux environnements distincts d'une même base",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '14',
    domain: 'structure_et_migrations',
  }),
  EXPORT_STALE: Object.freeze({
    condition: "Écriture détectée sur l'objet depuis l'export préalable",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  EXPORT_UNAVAILABLE: Object.freeze({
    condition: "Répertoire d'export absent, non inscriptible, ou export en échec",
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  FIELD_CONFIG_MISSING: Object.freeze({
    condition: 'Champ dont le type exige un satellite de configuration absent',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '02',
    domain: 'structure_et_migrations',
  }),
  FIELD_USED_BY_FORMULA: Object.freeze({
    condition: "Suppression ou conversion d'un champ dont une formule vivante dépend",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  ID_IMMUTABLE: Object.freeze({
    condition: 'Écriture ou opération de structure visant _id ou une autre colonne système (A18)',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  INCOMPATIBLE_VALUES: Object.freeze({
    condition:
      'Revalidation en échec à la restauration ; details.constraint vaut required ou unique',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  INDEX_LENGTH_EXCEEDED: Object.freeze({
    condition: 'Tri ou unicité demandés sur un texte de plus de 500 caractères',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'structure_et_migrations',
  }),
  LENGTH_VALUES_EXCEEDED: Object.freeze({
    condition: 'Réduction de max_length en deçà de valeurs existantes, avec échantillon',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'structure_et_migrations',
  }),
  LOCK_UNAVAILABLE: Object.freeze({
    condition: 'lock_timeout atteint sur un verrou consultatif ou sur un verrou de table',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '01',
    domain: 'structure_et_migrations',
  }),
  MIGRATION_EXPIRED: Object.freeze({
    condition: 'Proposition de migration de plus de 24 h',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  MIGRATION_IN_PROGRESS: Object.freeze({
    condition: "Bail de structure non obtenu, ou clé d'idempotence rejouée",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  MIGRATION_STALE: Object.freeze({
    condition: 'Structure ou planificateur modifiés entre proposition et approbation',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  MIGRATION_TAMPERED: Object.freeze({
    condition: 'checksum de migration divergent',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  MIGRATION_TOO_LARGE: Object.freeze({
    condition: 'Bornes de plan dépassées',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  OPTION_IN_USE: Object.freeze({
    condition: "Suppression d'une option de liste portée par des lignes, avec le décompte",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'structure_et_migrations',
  }),
  PARENT_DELETED: Object.freeze({
    condition: "Restauration d'un objet dont le parent est supprimé",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  PLAN_CYCLIC: Object.freeze({
    condition: 'Cycle résiduel en phase 1 du tri du plan',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  PLAN_LOCK_CONFLICT: Object.freeze({
    condition: "Violation de l'invariant I-DDL-5 détectée à la planification",
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  PROJECT_NOT_EMPTY: Object.freeze({
    condition: "Suppression d'un projet qui porte encore une base vivante",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '02',
    domain: 'structure_et_migrations',
  }),
  PURGE_TOO_EARLY: Object.freeze({
    condition: 'Purge demandée avant le délai minimal',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  REQUIRED_NULL_VALUES: Object.freeze({
    condition: "Passage à obligatoire d'une colonne contenant des nuls, avec échantillon (A23)",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'structure_et_migrations',
  }),
  RESIDUAL_SCHEMA: Object.freeze({
    condition:
      "DROP SCHEMA final d'une base purgée en échec ; état affiché, jamais renvoyé à une écriture",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  STEP_DEFERRED: Object.freeze({
    condition: 'Étape concurrente reportée, transaction longue en cours',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  SYNC_REFERENCE_MISSING: Object.freeze({
    condition:
      "Synchronisation de lignes dont une relation désigne une ligne absente de l'environnement cible",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '14',
    domain: 'structure_et_migrations',
  }),
  SYNC_TABLE_MISSING: Object.freeze({
    condition:
      "Synchronisation d'une table absente, supprimée ou sans colonne commune dans l'un des deux environnements",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '14',
    domain: 'structure_et_migrations',
  }),
  SYNC_VALUES_REFUSED: Object.freeze({
    condition:
      "Valeur recopiée refusée par une contrainte de l'environnement cible : la structure est à reporter d'abord",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '14',
    domain: 'structure_et_migrations',
  }),
  TABLE_ATTRIBUTES_EXHAUSTED: Object.freeze({
    condition: "Plus de 1 500 numéros d'attribut consommés sur la table",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'structure_et_migrations',
  }),
  TABLE_MIGRATING: Object.freeze({
    condition: 'Étape de migration exclusive en cours sur la table',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '08',
    domain: 'structure_et_migrations',
  }),
  TASK_IN_PROGRESS: Object.freeze({
    condition: 'Seconde tâche différée demandée sur le même objet',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'structure_et_migrations',
  }),
  TIMEZONE_UNKNOWN: Object.freeze({
    condition: 'Fuseau absent de pg_timezone_names',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  TOO_MANY_TABLES: Object.freeze({
    condition: 'Borne de tables par base atteinte',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'structure_et_migrations',
  }),
  BATCH_CASCADE_FORBIDDEN: Object.freeze({
    condition: "delete déclenchant une cascade à l'intérieur d'un lot",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '08',
    domain: 'relations',
  }),
  CASCADE_CONFIRMATION_REQUIRED: Object.freeze({
    condition: 'En-tête de confirmation de cascade absent ou divergent du décompte annoncé',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'relations',
  }),
  CASCADE_CYCLE: Object.freeze({
    condition: 'Chaîne de cascades bouclante',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'relations',
  }),
  CASCADE_NOT_IN_MIGRATION: Object.freeze({
    condition: 'ON DELETE CASCADE présent dans une migration proposée',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'relations',
  }),
  CASCADE_TOO_DEEP: Object.freeze({
    condition: 'Cycle détecté, ou profondeur supérieure à 5 au décompte',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'relations',
  }),
  CASCADE_TOO_LARGE: Object.freeze({
    condition: 'Décompte de cascade supérieur à 5 000 lignes',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'relations',
  }),
  DISPLAY_FIELD_IN_USE: Object.freeze({
    condition: "Suppression logique du champ désigné comme colonne d'affichage (A15)",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '02',
    domain: 'relations',
  }),
  LINK_CASCADE_NOT_GRANTED: Object.freeze({
    condition: 'cascade demandé sans droit de gestion du schéma ou sans confirmation saisie (A14)',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'relations',
  }),
  LINK_CROSS_DATABASE: Object.freeze({
    condition: 'Champ lien dont la table cible appartient à une autre base',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '01',
    domain: 'relations',
  }),
  LINK_ORPHAN_VALUES: Object.freeze({
    condition: "Valeurs orphelines à la pose d'une clé étrangère (A23)",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '03',
    domain: 'relations',
  }),
  LINK_SELF_REQUIRED: Object.freeze({
    condition: 'Champ lien réflexif marqué obligatoire',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'relations',
  }),
  LINK_SET_NULL_ON_REQUIRED: Object.freeze({
    condition:
      "set_null sur un lien obligatoire, ou passage à obligatoire d'un lien en set_null (A23)",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'relations',
  }),
  LINK_TARGET_NOT_FOUND: Object.freeze({
    condition: "Écriture d'un lien vers une cible inexistante **ou** invisible (A23)",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'relations',
  }),
  LINK_TARGET_UNSUPPORTED: Object.freeze({
    condition: "Cible d'une clé étrangère autre que _id",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '03',
    domain: 'relations',
  }),
  LINK_TYPE_INCOMPATIBLE: Object.freeze({
    condition: 'Type de la colonne de lien incompatible avec la clé cible',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '10',
    domain: 'relations',
  }),
  MCP_CASCADE_FORBIDDEN: Object.freeze({
    condition: 'on_delete: "cascade" demandé par un agent',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'relations',
  }),
  ROW_REFERENCED: Object.freeze({
    condition:
      "Suppression d'une ligne encore référencée, refusée par la clause NO ACTION (A13, A23)",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'relations',
  }),
  TABLE_REFERENCED: Object.freeze({
    condition: "Suppression d'une table encore référencée par un lien actif (A23)",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '02',
    domain: 'relations',
  }),
  TARGET_PURGED: Object.freeze({
    condition: "Restauration d'un champ lien dont la table cible est purgée",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '06',
    domain: 'relations',
  }),
  ACTION_FORBIDDEN: Object.freeze({
    condition: 'Ressource visible, action non accordée',
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  ADMIN_REQUIRED: Object.freeze({
    condition:
      "Action réservée à l'administration, l'acteur voyant la ressource ; cycle de vie compris (A23)",
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '06',
    domain: 'permissions_et_non_divulgation',
  }),
  AUTHORIZATION_REVOKED: Object.freeze({
    condition: "Revérification des droits ou du jeton en échec à l'approbation",
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '09',
    domain: 'permissions_et_non_divulgation',
  }),
  CONFIRMATION_REQUIRED: Object.freeze({
    condition: 'Opération réservée présentée sans jeton de confirmation',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  CONFLICT: Object.freeze({
    condition: "Violation d'unicité ou de CHECK touchant un champ masqué ; réponse anonyme",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  CREATE_IMPOSSIBLE: Object.freeze({
    condition: "Champ obligatoire non inscriptible par l'acteur",
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  EMAIL_TAKEN: Object.freeze({
    condition: 'Adresse déjà portée par un compte du tenant',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  EXPAND_UNAVAILABLE: Object.freeze({
    condition: "Expansion d'un champ non expansible ou dont la cible est invisible",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  FIELD_NOT_WRITABLE: Object.freeze({
    condition: 'Champ visible mais non inscriptible, colonnes système comprises (A18)',
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  FIELD_UNKNOWN: Object.freeze({
    condition: 'Champ inexistant, masqué, ou filtre et tri sur un champ masqué',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  FILTER_NOT_SUPPORTED: Object.freeze({
    condition:
      'Opérateur autre que « renseigné » / « non renseigné », ou tri, sur un lien à cible illisible (A16)',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  GROUP_SYSTEM_IMMUTABLE: Object.freeze({
    condition:
      "Renommage ou suppression d'un groupe système, retrait d'un membre du groupe de tous les utilisateurs, ou niveau d'accès posé sur le groupe des administrateurs",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  LAST_INSTANCE_ADMIN: Object.freeze({
    condition: "Retrait, désactivation ou suppression du dernier administrateur d'instance",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '02',
    domain: 'permissions_et_non_divulgation',
  }),
  LAST_TENANT_ADMIN: Object.freeze({
    condition: "Retrait du dernier membre d'un rôle tenant_admin",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  MASK_REDUCED_MID_READ: Object.freeze({
    condition: 'Droits réduits pendant une lecture longue',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  PERMISSION_DENIED: Object.freeze({
    condition: 'Objet lisible, action non autorisée, sur la surface MCP',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'permissions_et_non_divulgation',
  }),
  PERMISSION_INCONSISTENT: Object.freeze({
    condition: 'Écriture accordée sans lecture',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  PERMISSION_OUT_OF_SCOPE: Object.freeze({
    condition: 'Règle de champ hors de la portée du rôle',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  PRIVILEGE_ESCALATION: Object.freeze({
    condition:
      "Accorder plus que ce qu'on détient ; rôle hors des capacités du créateur ; ajout à un rôle système",
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  RESOURCE_NOT_FOUND: Object.freeze({
    condition:
      'Ressource inexistante **ou** invisible, sur toute surface, objet de catalogue compris (A23)',
    httpStatus: 404,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  ROLE_NOT_DELEGABLE: Object.freeze({
    condition: "Rôle demandé non inclus dans les droits de l'appelant",
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '08',
    domain: 'permissions_et_non_divulgation',
  }),
  TENANT_ISOLATION_VIOLATED: Object.freeze({
    condition: "Requête visant le schéma d'un autre tenant ; incident, réponse générique",
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  VALUE_REJECTED: Object.freeze({
    condition: 'Valeur refusée par une contrainte dont tous les champs sont lisibles',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  WEBHOOK_MASK_INCOMPLETE: Object.freeze({
    condition: "Rôle d'un webhook sans masque de lecture complet sur une table abonnée (A19)",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'permissions_et_non_divulgation',
  }),
  ARCHIVE_MISSING: Object.freeze({
    condition: "Suppression d'une partition non archivée, archivage actif",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  BULK_OPERATION_REFUSED: Object.freeze({
    condition: 'Plafond de lignes capturées dans une transaction dépassé',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  CAPTURE_NOT_CONFORMING: Object.freeze({
    condition:
      "Arguments de déclencheur, attributs de la fonction de capture ou déclencheur d'immuabilité non conformes",
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  CAPTURE_TRIGGER_MISSING: Object.freeze({
    condition: "Table utilisateur sans ses cinq déclencheurs actifs en tgenabled = 'O'",
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  COMPUTED_FIELD_READ_ONLY: Object.freeze({
    condition: "Écriture sur un champ formule, sur n'importe quel chemin",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  DRAIN_LAGGING: Object.freeze({
    condition: 'Retard du drain au-delà de history.drain_lag_max (A10)',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  DUPLICATE_VALUE: Object.freeze({
    condition: "Violation d'unicité, 23505 ; nomme le champ, jamais la valeur en conflit (A23)",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'donnees_et_validation',
  }),
  ERASURE_INCOMPLETE: Object.freeze({
    condition: "Effacement ciblé n'ayant pas pu atteindre les archives",
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  FILTER_NOT_INDEXABLE_VOLUME: Object.freeze({
    condition: 'Filtre contains non indexé demandé au-delà du seuil de cardinalité',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  FORMULA_DEPENDS_ON_FORMULA: Object.freeze({
    condition: 'Formule référençant une autre formule',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  FORMULA_FIELD_NOT_FOUND: Object.freeze({
    condition: "Citation d'un libellé de champ inconnu dans la table",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  FORMULA_FUNCTION_NOT_IMMUTABLE: Object.freeze({
    condition: 'Fonction ou conversion dépendant de la session',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  FORMULA_LINK_FORBIDDEN: Object.freeze({
    condition: 'Formule référençant un champ lien',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  FORMULA_NOT_IMMUTABLE: Object.freeze({
    condition: 'Refus serveur 42P17 ; filet de sécurité signalant un défaut du moteur',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  FORMULA_SYNTAX: Object.freeze({
    condition: 'Expression non conforme à la grammaire, avec position',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  FORMULA_TYPE_MISMATCH: Object.freeze({
    condition: 'Opérandes de types inconciliables, avec position',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  HISTORY_IMMUTABLE: Object.freeze({
    condition: 'UPDATE ou DELETE sur un journal hors maintenance',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  HISTORY_ORPHAN_ROWS: Object.freeze({
    condition: 'Lignes de détail sans en-tête sur la même partition',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  HISTORY_PARTITION_MISSING: Object.freeze({
    condition: 'Partition du mois courant, de M+1 ou de M+2 absente, ou partition DEFAULT non vide',
    httpStatus: 500,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  HISTORY_UNAVAILABLE: Object.freeze({
    condition: "La capture a échoué, donc l'écriture de données aussi",
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  NUMBER_OUT_OF_RANGE: Object.freeze({
    condition: "Dépassement de precision / scale (22003) à l'entrée",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  PARTITION_DETACH_STUCK: Object.freeze({
    condition: "Partition restée en détachement au-delà d'un passage de la tâche",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  REQUIRED_FIELD_MISSING: Object.freeze({
    condition: 'Champ obligatoire absent du corps soumis',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '08',
    domain: 'donnees_et_validation',
  }),
  REQUIRED_VALUE_MISSING: Object.freeze({
    condition: 'NOT NULL violé en base (23502)',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '10',
    domain: 'donnees_et_validation',
  }),
  RESTORE_FIELD_CHANGED: Object.freeze({
    condition: 'Champ visé par une annulation en masse supprimé, purgé ou remplacé depuis',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  RESTORE_OUT_OF_RETENTION: Object.freeze({
    condition: 'Révisions nécessaires à la restauration déjà purgées',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  RESTORE_RECORD_PRESENT: Object.freeze({
    condition: "Restauration d'une ligne supprimée qui existe de nouveau",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  RESTORE_TARGET_MISSING: Object.freeze({
    condition: 'Restauration référençant une ligne absente et hors périmètre',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  RETENTION_INCONSISTENT: Object.freeze({
    condition: 'Rétention des structures inférieure à celle des données (A24)',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  REVISION_SUPERSEDED: Object.freeze({
    condition: "Annulation d'une modification dont un champ a changé depuis",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  SORT_NOT_INDEXABLE_VOLUME: Object.freeze({
    condition: 'Tri non indexable demandé au-delà du seuil de cardinalité',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  TEXT_TOO_LONG: Object.freeze({
    condition: 'Valeur dépassant max_length',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  TRUNCATE_FORBIDDEN: Object.freeze({
    condition: 'TRUNCATE sur une table utilisateur',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '07',
    domain: 'donnees_et_validation',
  }),
  VALIDATION_FAILED: Object.freeze({
    condition: 'Validation métier, avec details.violations[] ; forme anonyme sans droit de lecture',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '08',
    domain: 'donnees_et_validation',
  }),
  VALUE_INVALID: Object.freeze({
    condition: 'Type JSON ou format incompatible avec le type de champ ; caractère nul ; 22P02',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  VALUE_NOT_FINITE: Object.freeze({
    condition: 'NaN, Infinity ou -Infinity soumis à un champ number, date ou datetime',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '04',
    domain: 'donnees_et_validation',
  }),
  VALUE_OUT_OF_CONSTRAINT: Object.freeze({
    condition: 'CHECK violé en base (23514), règle résolue par le catalogue',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '10',
    domain: 'donnees_et_validation',
  }),
  VALUE_OUT_OF_RANGE: Object.freeze({
    condition: 'Dépassement numérique en base (22003)',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '10',
    domain: 'donnees_et_validation',
  }),
  VALUE_TOO_LONG: Object.freeze({
    condition: 'Dépassement de longueur en base (22001)',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '10',
    domain: 'donnees_et_validation',
  }),
  AI_CONSENT_REQUIRED: Object.freeze({
    condition: 'Consentement au fournisseur absent ou périmé',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_DISABLED: Object.freeze({
    condition: 'ai.enabled faux à la portée résolue',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_KEY_REJECTED: Object.freeze({
    condition: 'Clé refusée par le fournisseur, à la pose ou en exploitation',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_MODEL_UNKNOWN: Object.freeze({
    condition: 'Modèle absent de la table de correspondance du fournisseur résolu',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_NOT_CONFIGURED: Object.freeze({
    condition: 'IA activée sans fournisseur, modèle ou clé résolus',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_PAYLOAD_TOO_LARGE: Object.freeze({
    condition: 'Charge utile au-delà des plafonds déclarés',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_PROVIDER_UNAVAILABLE: Object.freeze({
    condition: 'Délai dépassé, 5xx, 429 amont, erreur réseau, circuit ouvert',
    httpStatus: 503,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_QUOTA_EXCEEDED: Object.freeze({
    condition: 'Plafond mensuel ou de simultanéité atteint',
    httpStatus: 429,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  AI_RESPONSE_UNUSABLE: Object.freeze({
    condition:
      "Réponse non conforme au schéma ou tronquée, après un réessai ; ou, pour un champ calculé par l'IA, sans valeur lisible dans le type du champ",
    httpStatus: 502,
    httpStatusNote: null,
    chapter: '12',
    domain: 'api_et_integrations',
  }),
  BATCH_TOO_LARGE: Object.freeze({
    condition: "Lot au-delà des bornes d'entrée",
    httpStatus: 413,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  BODY_TOO_LARGE: Object.freeze({
    condition: "Corps au-delà des bornes d'entrée",
    httpStatus: 413,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  CONCURRENCY_CONFLICT: Object.freeze({
    condition: 'Sérialisation ou interblocage sur la surface MCP ; rejouable',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  CONCURRENCY_LIMIT_EXCEEDED: Object.freeze({
    condition: 'Plafond de requêtes simultanées',
    httpStatus: 429,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  CONTENT_TYPE_INVALID: Object.freeze({
    condition: 'Corps non application/json',
    httpStatus: 415,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  CURSOR_INVALID: Object.freeze({
    condition:
      'Déchiffrement, acteur ou requête divergente ; curseur altéré ou lié à un autre jeton',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  CURSOR_STALE: Object.freeze({
    condition: 'Structure de tri ou de filtre modifiée, ou curseur périmé par une migration',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  EXPAND_TOO_DEEP: Object.freeze({
    condition: "Profondeur d'expansion dépassée",
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  EXPAND_TOO_WIDE: Object.freeze({
    condition: "Largeur d'expansion dépassée",
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  FIELD_NOT_EXPANDABLE: Object.freeze({
    condition: "Champ lien dont la cible ou le champ d'affichage n'est pas lisible",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  FILTER_DISPLAY_UNAVAILABLE: Object.freeze({
    condition: "Filtre portant sur une valeur d'affichage indisponible",
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  FILTER_FIELD_UNKNOWN: Object.freeze({
    condition:
      'Champ de filtre inexistant **ou** non lisible ; les deux causes ne sont jamais scindées',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  FILTER_OPERATOR_INVALID: Object.freeze({
    condition: 'Opérateur hors du vocabulaire fermé',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  FILTER_TOO_COMPLEX: Object.freeze({
    condition: 'Budget de complexité du filtre dépassé',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  FILTER_TOO_LONG: Object.freeze({
    condition: 'Longueur du filtre dépassée',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  FILTER_VALUE_INVALID: Object.freeze({
    condition: 'Valeur de filtre non coercible',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  FORM_CLOSED: Object.freeze({
    condition:
      "Réponse à un formulaire partagé désactivé, fermé, complet, ou dont la personne qui l'a publié ne peut plus ajouter de lignes",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '15',
    domain: 'api_et_integrations',
  }),
  FORM_RESTRICTED: Object.freeze({
    condition:
      "Formulaire partagé réservé à des groupes dont la personne connectée n'est pas membre",
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '15',
    domain: 'api_et_integrations',
  }),
  IDEMPOTENCY_CONFLICT: Object.freeze({
    condition: "Même clé d'idempotence, corps différent",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  IDEMPOTENCY_IN_PROGRESS: Object.freeze({
    condition: 'Même clé, revendication sous bail valide',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  IDEMPOTENCY_INTERRUPTED: Object.freeze({
    condition: 'Bail expiré, écriture métier partiellement constatée',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  IDEMPOTENCY_STALE: Object.freeze({
    condition: 'authz_version modifiée depuis la réponse mémorisée',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  MCP_OPERATION_EXCLUDED: Object.freeze({
    condition: "Nom réservé d'une opération exclue en v1",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  PARAMETER_INVALID: Object.freeze({
    condition: 'Étage protocolaire : type, cardinalité, taille ; ne cite aucun objet',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  PRECHECK_TIMEOUT: Object.freeze({
    condition: 'Pré-vérification au-delà de 30 secondes',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  PROPOSAL_EXPIRED: Object.freeze({
    condition: 'Proposition passée à expired au-delà de 24 heures',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  PROPOSAL_STALE: Object.freeze({
    condition: 'catalog_version modifié depuis la proposition',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  QUERY_TOO_EXPENSIVE: Object.freeze({
    condition: 'Budget de complexité ou plan estimé au-delà du seuil',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  QUOTA_EXCEEDED: Object.freeze({
    condition: "Plafond d'appels ou de requêtes simultanées sur la surface MCP ; rejouable",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  RATE_LIMIT_EXCEEDED: Object.freeze({
    condition: 'Seau à jetons épuisé (A4)',
    httpStatus: 429,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  REQUEST_INVALID: Object.freeze({
    condition: "Corps, paramètre ou bornes d'entrée mal formés",
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  RESUME_BEYOND_HORIZON: Object.freeze({
    condition: "since antérieur à la rétention de l'historique (A24)",
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  SESSION_NOT_INITIALIZED: Object.freeze({
    condition: 'Message reçu avant initialize',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  SORT_FIELD_UNKNOWN: Object.freeze({
    condition:
      'Champ de tri inexistant **ou** non lisible ; les deux causes ne sont jamais scindées',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  SORT_UNAVAILABLE: Object.freeze({
    condition: 'Tri impossible sur le champ demandé',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  TOO_MANY_OPEN_PROPOSALS: Object.freeze({
    condition: 'Plus de cinq propositions proposed pour ce jeton et cette base',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'api_et_integrations',
  }),
  VERSION_CONFLICT: Object.freeze({
    condition: 'If-Match divergent',
    httpStatus: 412,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  WEBHOOK_TARGET_REJECTED: Object.freeze({
    condition: "URL de livraison refusée par le filtre d'adresses ; état de livraison",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  WRITE_CONFLICT: Object.freeze({
    condition: 'Sérialisation ou interblocage après réessai unique',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '08',
    domain: 'api_et_integrations',
  }),
  AUTHENTICATION_REQUIRED: Object.freeze({
    condition:
      "Authentification absente ou refusée : aucun contexte d'acteur, ou porteur refusé par la route, sur toute surface (A23)",
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '05',
    domain: 'authentification',
  }),
  BOOTSTRAP_SECRET_INVALID: Object.freeze({
    condition: "Secret d'amorçage faux ou expiré",
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  CREDENTIALS_INVALID: Object.freeze({
    condition: "Tout échec d'authentification par mot de passe ; message unique",
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  ELEVATION_REQUIRED: Object.freeze({
    condition: 'Opération exigeant une ré-authentification récente',
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '05',
    domain: 'authentification',
  }),
  OIDC_ACCOUNT_LINK_REQUIRED: Object.freeze({
    condition: 'Adresse déjà portée par un compte sans identité pour ce fournisseur',
    httpStatus: 409,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  OIDC_PROVIDER_UNKNOWN: Object.freeze({
    condition: 'slug de fournisseur non déclaré, ou non accepté par le tenant',
    httpStatus: 404,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  OIDC_STATE_INVALID: Object.freeze({
    condition: "state, nonce ou cookie d'échange absent, expiré ou discordant",
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  OIDC_TOKEN_INVALID: Object.freeze({
    condition: "Jeton d'identité en échec sur l'un des contrôles de validation",
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  ORIGIN_REJECTED: Object.freeze({
    condition: 'Requête mutante sans origine déclarée exploitable',
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '05',
    domain: 'authentification',
  }),
  PASSWORD_POLICY_VIOLATION: Object.freeze({
    condition: 'Mot de passe refusé par la politique',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  PROVISIONING_REFUSED: Object.freeze({
    condition: 'Aucun compte correspondant, provisionnement inactif',
    httpStatus: 403,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  RESET_TOKEN_INVALID: Object.freeze({
    condition: 'Défi de réinitialisation inconnu, expiré ou consommé',
    httpStatus: 400,
    httpStatusNote: null,
    chapter: '13',
    domain: 'authentification',
  }),
  SESSION_EXPIRED: Object.freeze({
    condition: 'Session révoquée, inactive depuis 12 h, ou parvenue à son terme absolu',
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '05',
    domain: 'authentification',
  }),
  TOKEN_EXPIRED: Object.freeze({
    condition: "Jeton connu, date d'expiration dépassée",
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '08',
    domain: 'authentification',
  }),
  TOKEN_EXPIRY_REQUIRED: Object.freeze({
    condition:
      "Durée de vie d'un jeton donnée hors de 1 à 365 jours (l'absence de durée vaut « sans échéance »)",
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'authentification',
  }),
  TOKEN_INVALID: Object.freeze({
    condition: 'Jeton inconnu, ou présenté hors de allowed_surfaces',
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '05',
    domain: 'authentification',
  }),
  TOKEN_PRIVILEGE_REFUSED: Object.freeze({
    condition: 'Rôle de jeton portant manage_schema, manage_permissions ou manage_tokens',
    httpStatus: 422,
    httpStatusNote: null,
    chapter: '05',
    domain: 'authentification',
  }),
  TOKEN_READ_ONLY: Object.freeze({
    condition: 'Écriture avec un jeton dont le rôle ne porte que read',
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'authentification',
  }),
  TOKEN_REVOKED: Object.freeze({
    condition: 'Jeton connu, révoqué ; la session MCP est close',
    httpStatus: 401,
    httpStatusNote: null,
    chapter: '08',
    domain: 'authentification',
  }),
  TOKEN_SUSPENDED: Object.freeze({
    condition: "Budget d'écriture ou seuil d'énumération dépassé",
    httpStatus: null,
    httpStatusNote: null,
    chapter: '09',
    domain: 'authentification',
  }),
})

/** The list of codes, in annex order. */
export const ALL_ERROR_CODES: readonly ErrorCode[] = Object.freeze(
  Object.keys(ERROR_CODES) as ErrorCode[],
)

/** True if the string is a code of the registry. */
export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ERROR_CODES, value)
}

/**
 * HTTP status of a code, or `null` for a condition with no HTTP surface (startup
 * refusal, internal incident). Only the HTTP adapter uses it: the kernel knows nothing
 * of status codes (chapter 10 §2.2).
 */
export function httpStatusFor(code: ErrorCode): number | null {
  return ERROR_CODES[code].httpStatus
}
