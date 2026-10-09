import {
  type IDataObject,
  type IExecuteFunctions,
  type IHttpRequestMethods,
  type IHttpRequestOptions,
  type ILoadOptionsFunctions,
  type INodePropertyOptions,
  type IPollFunctions,
  type JsonObject,
  NodeApiError,
  type ResourceMapperFields,
} from 'n8n-workflow'
import { type Member, type MetaBase, type MetaTable, columnsOf } from './logic'

/**
 * basedb's REST API as the nodes call it: `/api/v1/<tenant>/…` on the instance of the
 * credentials, with its integration token. A refusal keeps basedb's code — stable, one per
 * cause — and says in plain words what it usually means.
 */

type Context = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions

/** One page of `GET /data/<base>/<table>`. */
export interface Page {
  readonly data: IDataObject[]
  readonly meta: { readonly has_next_page: boolean; readonly next_cursor: string | null }
}

const REVOKED =
  'The token was refused: check it in the credentials — it may have been revoked, suspended or have expired.'
const FILTER = 'The filter could not be read: see the filter syntax in the basedb documentation.'

const HINTS: Readonly<Record<string, string>> = {
  AUTHENTICATION_REQUIRED: REVOKED,
  TOKEN_INVALID: REVOKED,
  TOKEN_EXPIRED: REVOKED,
  TOKEN_REVOKED: REVOKED,
  TOKEN_SUSPENDED: REVOKED,
  TOKEN_READ_ONLY: 'This token reads only: create one with write access to write rows.',
  ADMIN_REQUIRED:
    'A token may not do that: it reads and writes the rows of one base, and deletes only if it was created to.',
  PERMISSION_DENIED: 'The person who created the token may not do that on this table.',
  ACTION_FORBIDDEN: 'The person who created the token may not do that on this table.',
  RESOURCE_NOT_FOUND: 'No such base, table or row — or the token does not open it.',
  REQUIRED_VALUE_MISSING: 'A required field has no value.',
  REQUIRED_FIELD_MISSING: 'A required field has no value.',
  VALIDATION_FAILED: 'A value does not fit its field.',
  VALUE_INVALID: 'A value does not fit its field.',
  VALUE_REJECTED: 'A value does not fit its field.',
  VALUE_NOT_FINITE: 'A number is not finite.',
  VALUE_OUT_OF_CONSTRAINT:
    'A value is not one the field accepts: a choice that is not in its list, a value outside its bounds.',
  VALUE_OUT_OF_RANGE: 'A number or a date is out of the range the field holds.',
  VALUE_TOO_LONG: 'A text is longer than the field holds.',
  TEXT_TOO_LONG: 'A text is longer than the field holds.',
  ROW_OUT_OF_SCOPE: 'The row is not one the person who created the token may see.',
  DUPLICATE_VALUE: 'Another row already holds this value, and the field takes each value once.',
  LINK_TARGET_NOT_FOUND: 'A linked row does not exist, or the token does not see it.',
  FILTER_FIELD_UNKNOWN: FILTER,
  FILTER_OPERATOR_INVALID: FILTER,
  FILTER_VALUE_INVALID: FILTER,
  FILTER_NOT_SUPPORTED: FILTER,
  RATE_LIMIT_EXCEEDED: 'basedb asks to slow down: try again in a moment.',
}

interface BasedbRefusal {
  readonly code?: string
  readonly details?: unknown
  readonly request_id?: string
}

const isRefusal = (v: unknown): v is BasedbRefusal =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as BasedbRefusal).code === 'string' &&
  /^[A-Z][A-Z0-9_]+$/.test((v as BasedbRefusal).code as string) &&
  'request_id' in v

/**
 * basedb's `{ code, details, request_id }`, wherever the HTTP client left it: n8n wraps the
 * response of a failed request in one or two errors (`cause`, `errorResponse`), with its
 * body parsed or as text. Searched a few levels down, never further.
 */
function refusalOf(error: unknown, depth = 0): BasedbRefusal | null {
  if (depth > 4 || error === null || error === undefined) return null
  if (typeof error === 'string') {
    if (!error.trimStart().startsWith('{')) return null
    try {
      return refusalOf(JSON.parse(error), depth + 1)
    } catch {
      return null
    }
  }
  if (typeof error !== 'object') return null
  if (isRefusal(error)) return error
  const e = error as Record<string, unknown>
  for (const key of ['response', 'data', 'body', 'cause', 'errorResponse', 'error']) {
    const found = refusalOf(e[key], depth + 1)
    if (found !== null) return found
  }
  return null
}

export async function basedbRequest(
  this: Context,
  method: IHttpRequestMethods,
  path: string,
  options: { qs?: IDataObject; body?: IDataObject } = {},
): Promise<unknown> {
  const credentials = await this.getCredentials('basedbApi')
  const root = String(credentials.url).trim().replace(/\/+$/, '')
  const tenant = encodeURIComponent(String(credentials.tenant).trim())
  const request: IHttpRequestOptions = {
    method,
    url: `${root}/api/v1/${tenant}${path}`,
    json: true,
    ...(options.qs === undefined ? {} : { qs: options.qs }),
    ...(options.body === undefined ? {} : { body: options.body }),
  }
  try {
    return await this.helpers.httpRequestWithAuthentication.call(this, 'basedbApi', request)
  } catch (error) {
    const refusal = refusalOf(error)
    if (refusal?.code === undefined) throw new NodeApiError(this.getNode(), error as JsonObject)
    const message = `basedb refused the request: ${refusal.code}`
    const description = [
      HINTS[refusal.code],
      refusal.details === undefined ? undefined : `Details: ${JSON.stringify(refusal.details)}`,
      refusal.request_id === undefined ? undefined : `Request: ${refusal.request_id}`,
    ]
      .filter((s) => s !== undefined)
      .join(' ')
    const status = (error as { httpCode?: unknown }).httpCode
    // Built from basedb's answer, not from n8n's error: handed an error it made itself,
    // NodeApiError returns that one as it is, and the message below would be lost.
    throw new NodeApiError(this.getNode(), { ...refusal, message, description } as JsonObject, {
      message,
      description,
      ...(typeof status === 'string' ? { httpCode: status } : {}),
    })
  }
}

/** The description of a base: its tables and their fields, as the token sees them. */
export async function baseOf(this: Context, base: string): Promise<MetaBase> {
  const body = (await basedbRequest.call(
    this,
    'GET',
    `/meta/bases/${encodeURIComponent(base)}`,
  )) as {
    data: MetaBase
  }
  return body.data
}

export async function tableOf(this: Context, base: string, table: string): Promise<MetaTable> {
  const found = (await baseOf.call(this, base)).tables.find((t) => t.name === table)
  if (found === undefined) {
    throw new NodeApiError(this.getNode(), {} as JsonObject, {
      message: `No table "${table}" in this base`,
      description: 'It may have been renamed, or the token does not open it.',
    })
  }
  return found
}

/** Every row a filter keeps, page after page, up to `max`. */
export async function allRows(
  this: Context,
  base: string,
  table: string,
  qs: IDataObject,
  max = Number.POSITIVE_INFINITY,
): Promise<IDataObject[]> {
  const rows: IDataObject[] = []
  let after: string | null = null
  do {
    const page = (await basedbRequest.call(
      this,
      'GET',
      `/data/${encodeURIComponent(base)}/${encodeURIComponent(table)}`,
      {
        qs: {
          ...qs,
          limit: Math.min(200, max - rows.length),
          ...(after === null ? {} : { after }),
        },
      },
    )) as Page
    rows.push(...page.data)
    after = page.meta.has_next_page ? page.meta.next_cursor : null
  } while (after !== null && rows.length < max)
  return rows
}

// ── What the node's lists offer ──────────────────────────────────────────────────────

export async function getBases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const body = (await basedbRequest.call(this, 'GET', '/meta/bases')) as {
    data: Array<{
      name: string
      label: string
      environment?: { label: string; production: boolean }
    }>
  }
  // A token of the whole base lists each environment, under the same label: the
  // environment tells them apart.
  return body.data.map((b) => ({
    name:
      b.environment === undefined || b.environment.production
        ? b.label
        : `${b.label} (${b.environment.label})`,
    value: b.name,
    description: b.name,
  }))
}

export async function getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const base = this.getCurrentNodeParameter('base') as string | undefined
  if (base === undefined || base === '') return []
  return (await baseOf.call(this, base)).tables.map((t) => ({
    name: t.label,
    value: t.name,
    description: t.name,
  }))
}

export async function getColumns(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
  const base = this.getCurrentNodeParameter('base') as string
  const table = await tableOf.call(this, base, this.getCurrentNodeParameter('table') as string)
  const operation = this.getCurrentNodeParameter('operation') as 'create' | 'update' | 'upsert'
  const members = table.fields.some((f) => f.kind === 'user')
    ? ((await basedbRequest.call(this, 'GET', '/meta/users')) as { data: Member[] }).data
    : []
  return {
    fields: columnsOf(table, operation, members).map((c) => ({
      ...c,
      options: c.options?.map((o) => ({ ...o })),
    })),
  }
}
