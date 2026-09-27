import { BasedbError, type ProviderTransport } from '@basedb/core'

/**
 * The public demo — `BASEDB_DEMO=1`.
 *
 * One shared account, whose address and password the login screen prefills, on an
 * instance anyone can open. A visitor reads everything and edits what exists; they create
 * nothing and delete nothing — no base, table, row, file, comment, account, token or link
 * —, and the AI answers that it is not part of the demo. The operator puts the database
 * back every night: what a visitor changes lasts until then.
 *
 * A list of what is ALLOWED, not of what is refused: a route added later stays refused
 * until it is named here.
 */

export interface DemoAccount {
  readonly email: string
  readonly password: string
}

/** The tenant segment of the product's routes. */
const T = '/api/v1/[^/]+'
const SEGMENT = '[^/]+'

/** What a visitor may do beyond reading: `[method, path]`. */
const ALLOWED: ReadonlyArray<readonly [string, RegExp]> = (
  [
    // The session: signing in, the data API's token, confirming the password, signing out.
    ['POST', '/auth/password/login'],
    ['POST', '/auth/session/access'],
    ['DELETE', '/auth/session'],
    ['POST', '/auth/elevate'],
    ['DELETE', '/auth/elevation'],
    // Editing a row, and taking an edit back.
    ['PATCH', `${T}/data/${SEGMENT}/${SEGMENT}/${SEGMENT}`],
    ['POST', `${T}/history/undo`],
    ['POST', `${T}/history/${SEGMENT}/revert`],
    // Reading that goes by POST: a question, SQL — read only, see the route —, a shared
    // dashboard's card, the next runs of a schedule.
    ['POST', `${T}/query/${SEGMENT}`],
    ['POST', `${T}/sql/${SEGMENT}`],
    ['POST', `/api/v1/dashboards/${SEGMENT}/cards/${SEGMENT}`],
    ['POST', `${T}/ai/schedule/preview`],
    // What the other visitors see of one: presence, the pointer; one's notifications read.
    ['POST', `${T}/presence`],
    ['POST', `${T}/presence/pointer`],
    ['POST', `${T}/me/notifications/read`],
    // The structure as it stands: renaming, describing, reordering, a field's settings,
    // a view's filters and columns, a dashboard's layout.
    ['PATCH', `${T}/admin/projects/${SEGMENT}`],
    ['PATCH', `${T}/admin/bases/${SEGMENT}`],
    ['PATCH', `${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}`],
    ['POST', `${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}/display`],
    ['PATCH', `${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}/fields/${SEGMENT}`],
    ['PUT', `${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}/fields/order`],
    ['PUT', `${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}/fields/${SEGMENT}/options`],
    ['PATCH', `${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}/views/${SEGMENT}`],
    ['PUT', `${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}/views/order`],
    ['PUT', `${T}/admin/bases/${SEGMENT}/sql-views/order`],
    ['PATCH', `${T}/admin/bases/${SEGMENT}/dashboards/${SEGMENT}`],
    ['PATCH', `${T}/admin/bases/${SEGMENT}/questions/${SEGMENT}`],
    ['PATCH', `${T}/admin/bases/${SEGMENT}/queries/${SEGMENT}`],
  ] as const
).map(([method, path]) => [method, new RegExp(`^${path}$`)] as const)

/** The routes that call the AI: refused with the AI's own sentence. */
const AI_ROUTES: readonly RegExp[] = [
  new RegExp(`^${T}/ai/`),
  new RegExp(`^${T}/admin/templates/draft$`),
  new RegExp(`^${T}/admin/bases/${SEGMENT}/tables/${SEGMENT}/fields/${SEGMENT}/ai/run$`),
]

/**
 * Why the demo refuses a request, or `null` when it lets it through. Reading always
 * passes; so does a preflight.
 */
export function demoRefusal(method: string, path: string): BasedbError | null {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null
  if (ALLOWED.some(([m, pattern]) => m === method && pattern.test(path))) return null
  if (method === 'POST' && AI_ROUTES.some((pattern) => pattern.test(path))) {
    return new BasedbError('AI_DISABLED', { details: { reason: 'demo' } })
  }
  return new BasedbError('ACTION_FORBIDDEN', { details: { reason: 'demo' } })
}

/**
 * The demo's AI: it calls no provider, whatever the environment says, and says why —
 * for the work in the background too (an automation's AI step, an AI field), which no
 * route refusal reaches.
 */
export const demoTransport: ProviderTransport = async () => {
  throw new BasedbError('AI_DISABLED', { details: { reason: 'demo' } })
}
