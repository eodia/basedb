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
