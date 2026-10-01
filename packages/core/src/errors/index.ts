import { ERROR_CODES, type ErrorCode, isErrorCode } from '@basedb/contracts'

/**
 * Taxonomy and SQLSTATE → registry code translation — chapter 10 §8.
 *
 * The translation is performed BY THE KERNEL'S QUERY EXECUTOR ITSELF, which every SQL
 * execution goes through without exception. It therefore cannot be forgotten: there is
 * no path that runs SQL without passing through it.
 */

/** Error class, which decides the log entry and what the user sees (§8.1). */
export type ErrorClass =
  | 'validation'
  | 'invisible'
  | 'forbidden'
  | 'conflict'
  | 'unavailable'
  | 'incident'

export interface BasedbErrorOptions {
  /** Named objects the actor is allowed to see. Never the name of an invisible object. */
  readonly details?: Readonly<Record<string, unknown>>
  /** The original PostgreSQL error, kept for the log, never for the user. */
  readonly cause?: unknown
  /** Set for an incident: the identifier the user can quote to support. */
  readonly incidentId?: string
}

/**
 * Business error of the kernel. It carries a registry code, never a message meant for
 * display: formatting belongs to the adapter, in the reader's language (chapter 10
 * §2.2).
 */
export class BasedbError extends Error {
  readonly code: ErrorCode
  readonly class: ErrorClass
  readonly details: Readonly<Record<string, unknown>>
  readonly incidentId: string | undefined

  constructor(code: ErrorCode, options: BasedbErrorOptions = {}) {
    super(code, { cause: options.cause })
    this.name = 'BasedbError'
    this.code = code
    this.class = classOf(code)
    this.details = options.details ?? {}
    this.incidentId = options.incidentId
  }

  /** HTTP status from the registry. Only the adapter uses it. */
  get httpStatus(): number | null {
    return ERROR_CODES[this.code].httpStatus
  }
}

/** Codes that are never the caller's fault: they reveal a defect in the product. */
const INCIDENTS: ReadonlySet<string> = new Set([
  'CATALOG_DRIFT',
  'PRIVILEGES_INSUFFICIENT',
  'FIELD_CONFIG_MISSING',
  'NAME_TOO_LONG',
  'NAME_TAKEN_OUTSIDE_REGISTRY',
  'CONNECTION_CONTRACT_BROKEN',
  'INTERNAL_ERROR',
])

function classOf(code: ErrorCode): ErrorClass {
  if (INCIDENTS.has(code)) return 'incident'
  const status = ERROR_CODES[code].httpStatus
  switch (status) {
    case 404:
      return 'invisible'
    case 403:
      return 'forbidden'
    case 409:
      return 'conflict'
    // A service the product depends on did not answer — a synced table's source, a
    // webhook, an AI provider: said to the caller as such, not hidden as a defect.
    case 502:
    case 503:
      return 'unavailable'
    case null:
      return 'incident'
    default:
      return status !== null && status >= 500 ? 'incident' : 'validation'
  }
}

/** The operation under way, which settles two possible translations of one SQLSTATE. */
export type SqlOperation = 'select' | 'insert' | 'update' | 'delete' | 'ddl'

export interface PgErrorLike {
  readonly code?: string
  readonly constraint?: string
  readonly column?: string
  readonly table?: string
  readonly detail?: string
  readonly message?: string
}

/**
 * Translation table of chapter 10 §8.2.
 *
 * `23503` and `42P01`/`42703` do not appear here: the first depends on the operation,
 * the others require a schema re-read and a single retry before being translated.
 */
const BY_SQLSTATE: ReadonlyMap<string, ErrorCode> = new Map<string, ErrorCode>([
  ['23505', 'DUPLICATE_VALUE'],
  ['23514', 'VALUE_OUT_OF_CONSTRAINT'],
  ['23502', 'REQUIRED_VALUE_MISSING'],
  ['22001', 'VALUE_TOO_LONG'],
  ['22003', 'VALUE_OUT_OF_RANGE'],
  ['22P02', 'VALUE_INVALID'],
  ['40001', 'SERIALIZATION_CONFLICT'],
  ['40P01', 'SERIALIZATION_CONFLICT'],
  ['55P03', 'LOCK_UNAVAILABLE'],
  ['57014', 'DEADLINE_EXCEEDED'],
  ['53300', 'SERVICE_UNAVAILABLE'],
  ['53200', 'SERVICE_UNAVAILABLE'],
  // The server stopping, starting, or closing the connection: not the caller's fault.
  ['57P01', 'SERVICE_UNAVAILABLE'],
  ['57P02', 'SERVICE_UNAVAILABLE'],
  ['57P03', 'SERVICE_UNAVAILABLE'],
  ['25P03', 'SERVICE_UNAVAILABLE'],
  ['08000', 'SERVICE_UNAVAILABLE'],
  ['08003', 'SERVICE_UNAVAILABLE'],
  ['08006', 'SERVICE_UNAVAILABLE'],
  ['42501', 'PRIVILEGES_INSUFFICIENT'],
])

/** The codes a function of the catalog raises itself (chapter 07 §18). */
const RAISED_BY_FUNCTIONS: ReadonlySet<string> = new Set([
  'TRUNCATE_FORBIDDEN',
  'BULK_OPERATION_REFUSED',
  'HISTORY_IMMUTABLE',
])

/** SQLSTATEs whose translation requires a schema re-read and a retry (§4.4, rule 3). */
export const SQLSTATES_NEEDING_SCHEMA_REREAD: ReadonlySet<string> = new Set(['42P01', '42703'])

/** SQLSTATEs whose retry is legitimate after rolling the transaction back (§4.3). */
export const RETRYABLE_SQLSTATES: ReadonlySet<string> = new Set(['40001', '40P01'])

/**
 * Translates a PostgreSQL error into a business error.
 *
 * An untranslated SQLSTATE is an INCIDENT, never a user fault: the product hit a
 * condition it cannot name, and hiding that behind a validation code would cast
 * suspicion on the caller.
 */
export function translatePgError(
  error: PgErrorLike,
  operation: SqlOperation = 'select',
): BasedbError {
  const sqlstate = error.code

  if (sqlstate === undefined) {
    return new BasedbError('SERVICE_UNAVAILABLE', { cause: error })
  }

  // `23503` depends on the operation: deleting a still-referenced row is not the same
  // fault as writing a link to a non-existent target.
  if (sqlstate === '23503') {
    const code: ErrorCode = operation === 'delete' ? 'ROW_REFERENCED' : 'LINK_TARGET_NOT_FOUND'
    return new BasedbError(code, { cause: error, details: constraintDetails(error) })
  }

  // A statement issued inside an aborted transaction is a defect of our own state
  // machine, never a user fault.
  if (sqlstate === '25P02') {
    return new BasedbError('INTERNAL_ERROR', {
      cause: error,
      details: { sqlstate, note: 'statement issued inside an aborted transaction' },
    })
  }

  // A catalog or capture function refusing on purpose: `RAISE EXCEPTION 'CODE: …'`.
  // Only the codes such a function may raise are believed — never whatever a message
  // happens to start with.
  if (sqlstate === 'P0001') {
    const raised = /^([A-Z_]+):/.exec(error.message ?? '')?.[1]
    if (raised !== undefined && RAISED_BY_FUNCTIONS.has(raised)) {
      return new BasedbError(raised as ErrorCode, { cause: error })
    }
  }

  const code = BY_SQLSTATE.get(sqlstate)
  if (code === undefined) {
    return new BasedbError('INTERNAL_ERROR', { cause: error, details: { sqlstate } })
  }

  return new BasedbError(code, { cause: error, details: constraintDetails(error) })
}

/**
 * Details that are safe to surface: the PHYSICAL NAME of the constraint or column.
 * Resolving it to the field's label belongs to the executor, which holds the database's
 * memoized schema — that is what allows saying "the value of field Numéro already
 * exists" rather than "violation of uq_factures__numero".
 */
function constraintDetails(error: PgErrorLike): Record<string, unknown> {
  const details: Record<string, unknown> = {}
  if (error.constraint !== undefined) details.constraint = error.constraint
  if (error.column !== undefined) details.column = error.column
  if (error.table !== undefined) details.table = error.table
  // The row a multi-link's trigger names — missing, or still linked (chapter 04 §4 bis).
  if (
    error.detail !== undefined &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(error.detail)
  ) {
    details.id = error.detail
  }
  return details
}

/** True if the error warrants a retry after rollback (§4.3). */
export function isRetryable(error: PgErrorLike): boolean {
  return error.code !== undefined && RETRYABLE_SQLSTATES.has(error.code)
}

/** True if the error requires a schema re-read before a single retry (§4.4). */
export function requiresSchemaReread(error: PgErrorLike): boolean {
  return error.code !== undefined && SQLSTATES_NEEDING_SCHEMA_REREAD.has(error.code)
}

/** Builds a business error from a registry code. */
export function businessError(code: string, options: BasedbErrorOptions = {}): BasedbError {
  if (!isErrorCode(code)) {
    return new BasedbError('INTERNAL_ERROR', {
      ...options,
      details: { ...options.details, unknownCode: code },
    })
  }
  return new BasedbError(code, options)
}
