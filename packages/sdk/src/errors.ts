/**
 * A refusal of basedb: its code — stable, one per cause, the same in every language —, the
 * details that say which field or which value, and the request's id, which the instance's
 * logs know. The HTTP status comes with it; the code is what a program tests.
 */
export class BasedbError extends Error {
  override readonly name = 'BasedbError'

  constructor(
    /** `RESOURCE_NOT_FOUND`, `VALUE_OUT_OF_CONSTRAINT`, `ADMIN_REQUIRED`… */
    readonly code: string,
    readonly status: number,
    readonly details: Readonly<Record<string, unknown>> | undefined,
    readonly requestId: string | undefined,
  ) {
    super(
      `basedb refused the request: ${code}${details === undefined ? '' : ` ${JSON.stringify(details)}`}`,
    )
  }

  /** The refusal a response carries — or, when basedb did not answer, what did. */
  static async from(response: Response): Promise<BasedbError> {
    const text = await response.text().catch(() => '')
    try {
      const body = JSON.parse(text) as { code?: unknown; details?: unknown; request_id?: unknown }
      if (typeof body.code === 'string') {
        return new BasedbError(
          body.code,
          response.status,
          typeof body.details === 'object' && body.details !== null
            ? (body.details as Record<string, unknown>)
            : undefined,
          typeof body.request_id === 'string' ? body.request_id : undefined,
        )
      }
    } catch {
      // Not basedb's JSON: a proxy, a gateway, an HTML page.
    }
    return new BasedbError(
      `HTTP_${response.status}`,
      response.status,
      { body: text.slice(0, 500) },
      undefined,
    )
  }
}
