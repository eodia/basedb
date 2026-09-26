import { ERROR_CODES, isErrorCode } from '@basedb/contracts'
import {
  type AiFieldInput,
  type AiFieldStatus,
  BasedbError,
  CACHE_CONTROL,
  CSRF_COOKIE,
  CSRF_HEADER,
  type FormSharing,
  type Kernel,
  type MetaKind,
  type Migration,
  OIDC_COOKIE,
  type RequestContext,
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE,
  type SavedView,
  type ShareSettings,
  VARY,
} from '@basedb/core'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import { providerTransport } from './ai-transport.js'
import { RateLimiter } from './rate-limit.js'

/**
 * HTTP entry point — chapter 08.
 *
 * The adapter decides NOTHING: it extracts a credential, asks the kernel for a context,
 * calls an operation, and translates the business error into a response. It knows
 * neither the catalog, nor the permissions, nor the SQL — and it holds no object
 * representing a connection.
 *
 * URL plan of §1.4. Every route is prefixed `/api/v1/{tenantRef}`, and the literal
 * segments `/data/`, `/meta/` and `/admin/` separate the namespace of the tables from
 * that of the product: without them, a table named `openapi` or `tokens` would create a
 * routing ambiguity no slugification rule prevents.
 */

export interface AppOptions {
  /**
   * Origins allowed to call the API from a browser.
   *
   * A LIST, never `*`: the interface and the API live on distinct ports, so the browser
   * demands an origin check, and opening it to every origin would let any page call the
   * API with the user's credentials. Chapter 08 names that refusal `ORIGIN_REJECTED`.
   */
  readonly allowedOrigins?: readonly string[]
  /**
   * The kernel, seen from here as a closed list of operations. The adapter receives
   * neither pool, nor connection, nor executor: it therefore cannot bypass the
   * permission enforcement point, even by mistake.
   */
  readonly kernel: Kernel
  /**
   * Address of the bootstrapped administrator, published on `/api/v1/dev/account`.
   *
   * Set ONLY when the server has just bootstrapped the instance itself, hence in
   * development, and it publishes the ADDRESS alone — never the password, which the
   * server prints once in its own output. Without this option the route does not exist:
   * not an access check but an absence, there is nothing to reach.
   */
  readonly developmentEmail?: string
  /**
   * Public address of this API, used to build the OIDC return URL.
   *
   * The provider compares it, character for character, with what was registered against
   * the client identifier — so it is stated by the operator and never inferred from a
   * `Host` header a caller controls.
   */
  readonly publicUrl?: string
  /** Tenant these unauthenticated `/auth` routes belong to, while sessions carry none. */
  readonly tenantRef?: string
}

/** Normalized error shape of chapter 08 §6. */
interface ErrorBody {
  readonly code: string
  readonly details?: Readonly<Record<string, unknown>>
  readonly request_id: string
}

/** Variables carried by the Hono context, declared to stay typed. */
type Variables = { requestId: string }

/** What every integration token starts with (`bdb_` + prefix + secret, 08 §11.3). */
const INTEGRATION_TOKEN_PREFIX = 'bdb_'

export function createApp(options: AppOptions) {
  const app = new Hono<{ Variables: Variables }>()

  const origins = options.allowedOrigins
  app.use(
    '*',
    cors({
      origin: (origin) => {
        // An explicit list when one is supplied. Otherwise, and ONLY then, any
        // `localhost` origin is accepted: in development the interface changes port
        // according to what is free, and maintaining the list by hand would protect
        // nobody. In production, `BASEDB_ORIGINS` is set and this branch is never
        // reached.
        if (origins !== undefined) return origins.includes(origin) ? origin : null
        return /^http:\/\/localhost(:\d+)?$/.test(origin) ? origin : null
      },
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'x-request-id', 'authorization', 'x-basedb-csrf'],
      exposeHeaders: ['x-request-id'],
      // The session cookie travels between two ports of the same site; without this the
      // browser sends it on no cross-origin request at all.
      credentials: true,
    }),
  )

  // End-to-end correlation: the request identifier is set here and appears in every
  // response, success or error.
  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID()
    c.set('requestId', requestId)
    c.header('x-request-id', requestId)
    await next()
  })

  /**
   * ONE single place translating business error → HTTP response.
   *
   * The status comes from the code registry (A23), never from a local choice: that is
   * what guarantees an invisible resource returns 404 on every route, including those
   * added later.
   */
  app.onError((error, c) => {
    const requestId = c.get('requestId') ?? 'unknown'

    if (error instanceof BasedbError) {
      const status = error.httpStatus ?? 500
      // An incident discloses only an identifier: no stack, no server message, no name
      // of an object the actor has no right to see (§8.1).
      const body: ErrorBody =
        error.class === 'incident'
          ? { code: 'INTERNAL_ERROR', request_id: requestId }
          : { code: error.code, details: error.details, request_id: requestId }
      return c.json(body, status as 400)
    }

    return c.json({ code: 'INTERNAL_ERROR', request_id: requestId } satisfies ErrorBody, 500)
  })

  /**
   * Opens a context, then CHECKS the tenant in the path against the actor's own.
   *
   * An actor carried onto another tenant gets a 404, never a 403 (§1.2): saying "you
   * have no right here" would confirm that the tenant exists.
   */
  const contextFor = async (
    c: { get: (k: 'requestId') => string; req: { param: (k: string) => string | undefined } },
    userId: string,
  ): Promise<RequestContext> => {
    const ctx = await options.kernel.openContext({
      userId,
      requestId: c.get('requestId'),
      surface: 'rest',
    })
    const tenantRef = c.req.param('tenantRef')
    if (tenantRef !== undefined && tenantRef !== ctx.tenantId) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tenant: tenantRef } })
    }
    return ctx
  }

  /**
   * The credential of `/api/v1`: an access token in `Authorization: Bearer`.
   *
   * Never the session cookie. A cookie is sent by the browser on every request to this
   * origin, including those a foreign page provokes; an `Authorization` header is not.
   * Two surfaces, two credentials, and the data API out of reach of a cookie alone.
   */
  const bearerWho = async (c: { req: { header: (k: string) => string | undefined } }) => {
    const header = c.req.header('authorization')
    const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined
    return options.kernel.authenticateAccessToken(token)
  }
  const bearer = async (c: { req: { header: (k: string) => string | undefined } }) =>
    (await bearerWho(c)).userId

  /**
   * The credential of the DATA routes — `/meta/bases`, `/data` and a file deposit: a
   * person's access token, or an integration token issued for the `rest` surface
   * (chapter 08 §11). The token is its own actor: its base, its role intersected with
   * its creator's rights at every decision — never its creator's session.
   *
   * Every other route — administration, SQL console, AI, projects — stays a person's: a
   * token opens one base's rows to a program, not the instance. There, `bearer` refuses
   * it like any credential it does not know.
   */
  const dataContext = async (c: Context<{ Variables: Variables }, string>) => {
    const header = c.req.header('authorization')
    const secret = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined
    if (secret?.startsWith(INTEGRATION_TOKEN_PREFIX) !== true) return contextFor(c, await bearer(c))

    const ctx = await options.kernel.openTokenContext({
      secret,
      surface: 'rest',
      requestId: c.get('requestId'),
    })
    // The same check as a person's: a token carried onto another tenant finds nothing.
    const tenantRef = c.req.param('tenantRef')
    if (tenantRef !== undefined && tenantRef !== ctx.tenantId) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { tenant: tenantRef } })
    }
    return ctx
  }

  /** The credential of `/auth/*`: the session cookie, and it alone. */
  const cookieHolder = async (c: Context<{ Variables: Variables }, string>) =>
    options.kernel.authenticateCookie(getCookie(c, SESSION_COOKIE))

  /** Liveness probe — entry point outside the catalog (chapter 08 §1.5). */
  app.get('/healthz', (c) => c.json({ status: 'ok' }))

  // The interface asks here for the bootstrap actor, instead of requiring it to be
  // copied from the server's output. The route is MOUNTED only if the server
  // bootstrapped the instance: in production the URL does not exist and returns 404
  // like any other unknown URL.
  if (options.developmentEmail !== undefined) {
    const email = options.developmentEmail
    // Only the address, so the login form can prefill it. The password is printed once
    // in the server output and never served over HTTP.
    app.get('/api/v1/dev/account', (c) => c.json({ email }))
  }

  /** The code registry, as the API publishes it. Not a catalog projection. */
  app.get('/api/v1/codes', (c) =>
    c.json({
      codes: Object.entries(ERROR_CODES).map(([code, e]) => ({
        code,
        condition: e.condition,
        http_status: e.httpStatus,
      })),
    }),
  )

  // ---------------------------------------------------------------------------------
  // /auth — chapter 13. No tenant reference: these routes precede knowing one.
  // ---------------------------------------------------------------------------------

  /**
   * One bucket for the whole of `/auth/*`, keyed by address (§6).
   *
   * It lives here, in this process, and is therefore approximate with several
   * instances — which is exactly what the chapter says, and why the defence against
   * targeted credential stuffing rests on the row lockout of §2.4 instead.
   */
  const limiter = new RateLimiter()

  const addressOf = (c: Context<{ Variables: Variables }, string>) =>
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'inconnue'

  /** Counts an attempt on a route that carries no bearer, and refuses past the bound. */
  const bounded = (c: Context<{ Variables: Variables }, string>): string => {
    const address = addressOf(c)
    const verdict = limiter.check(address, Date.now())
    if (!verdict.allowed) {
      c.header('retry-after', String(verdict.retryAfter))
      throw new BasedbError('RATE_LIMIT_EXCEEDED', {
        details: { retry_after: verdict.retryAfter },
      })
    }
    return address
  }

  /**
   * Plants the session cookie.
   *
   * `__Host-` is a prefix the browser ENFORCES: it refuses the cookie unless it is
   * `Secure`, path `/`, and carries no `Domain` — so a sibling host on the same domain
   * cannot write it. `SameSite=Strict` keeps it out of every cross-site request, and
   * `HttpOnly` keeps it out of reach of any script on the page.
   */
  const plantSession = (
    c: Context<{ Variables: Variables }, string>,
    token: string,
    csrf: string,
  ) => {
    const shared = {
      path: '/' as const,
      secure: true,
      sameSite: 'Strict' as const,
      maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
    }
    setCookie(c, SESSION_COOKIE, token, { ...shared, httpOnly: true })
    // Readable on purpose: the page must echo it into a header, which is precisely what
    // a foreign origin cannot do. It is not a secret from this page's own scripts — it
    // is a secret from every other origin.
    setCookie(c, CSRF_COOKIE, csrf, { ...shared, httpOnly: false })
  }

  app.post('/auth/password/login', async (c) => {
    const address = bounded(c)
    const body = await c.req
      .json<{ email?: string; password?: string }>()
      .catch(() => ({}) as { email?: string; password?: string })
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      // A malformed body is a failed login like any other: answering "field missing"
      // would be one more thing an attacker can tell apart.
      limiter.failed(address)
      throw new BasedbError('CREDENTIALS_INVALID')
    }

    let session: Awaited<ReturnType<typeof options.kernel.login>>
    try {
      session = await options.kernel.login({
        email: body.email,
        password: body.password,
        ip: address === 'inconnue' ? null : address,
        userAgent: c.req.header('user-agent') ?? null,
      })
    } catch (error) {
      // The penalty punishes a sweep, not a forgetful user: a success clears the run.
      limiter.failed(address)
      throw error
    }
    limiter.succeeded(address)

    plantSession(c, session.sessionToken, session.csrfToken)
    // The CSRF token goes in the BODY, not in a cookie: the client keeps it in memory
    // and echoes it in a header, which is precisely what a foreign page cannot do.
    return c.json({ data: { csrf: session.csrfToken, tenant: session.tenantRef } })
  })

  app.post('/auth/password/change', async (c) => {
    const body = await c.req.json<{ current?: string; next?: string }>()
    const who = await cookieHolder(c)
    if (typeof body.current !== 'string' || typeof body.next !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'next' } })
    }
    const fresh = await options.kernel.changePassword({
      userId: who.userId,
      current: body.current,
      next: body.next,
    })
    // Every OTHER session of this user is now closed — the point of changing a password
    // is usually that someone else may know the old one — and the caller is handed a
    // fresh one rather than being signed out for having done the safe thing.
    plantSession(c, fresh.sessionToken, fresh.csrfToken)
    return c.body(null, 204)
  })

  // The one route that turns a cookie into a credential for the data API — hence the
  // CSRF header, demanded here and nowhere else.
  app.post('/auth/session/access', async (c) => {
    const issued = await options.kernel.issueAccessToken(
      getCookie(c, SESSION_COOKIE),
      c.req.header(CSRF_HEADER),
    )
    return c.json({
      data: { token: issued.token, expires_at: issued.expiresAt.toISOString() },
    })
  })

  app.delete('/auth/session', async (c) => {
    await options.kernel.logout(getCookie(c, SESSION_COOKIE))
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
    deleteCookie(c, CSRF_COOKIE, { path: '/', secure: true })
    return c.body(null, 204)
  })

  app.get('/auth/sessions', async (c) => {
    const who = await cookieHolder(c)
    const sessions = await options.kernel.listSessions(who)
    return c.json({
      data: sessions.map((s) => ({
        id: s.id,
        created_at: s.createdAt,
        last_seen_at: s.lastSeenAt,
        ip: s.ip,
        user_agent: s.userAgent,
        current: s.id === who.sessionId,
      })),
    })
  })

  app.delete('/auth/sessions', async (c) => {
    await options.kernel.revokeSession(await cookieHolder(c), { kind: 'all' })
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
    deleteCookie(c, CSRF_COOKIE, { path: '/', secure: true })
    return c.body(null, 204)
  })

  app.delete('/auth/sessions/:id', async (c) => {
    const who = await cookieHolder(c)
    // A session belonging to someone else answers as one that does not exist.
    await options.kernel.revokeSession(who, { kind: 'one', sessionId: c.req.param('id') })
    return c.body(null, 204)
  })

  // Accepts either credential: the interface calls it with the cookie right after
  // login, an integration with its access token.
  app.get('/auth/me', async (c) => {
    const header = c.req.header('authorization')
    const who =
      header?.toLowerCase().startsWith('bearer ') === true
        ? await options.kernel.authenticateAccessToken(header.slice(7).trim())
        : await cookieHolder(c)

    const me = await options.kernel.whoAmI(who)
    return c.json({
      data: {
        id: me.id,
        email: me.email,
        display_name: me.displayName,
        tenant: me.tenantRef,
        is_instance_admin: me.isInstanceAdmin,
        is_admin: me.isAdmin,
        must_change_password: me.mustChangePassword,
        elevated_until: me.elevatedUntil,
      },
    })
  })

  // Elevation: five minutes, proved by the current password, on the SESSION and not on
  // an object. The session token rotates with it, which invalidates the access tokens in
  // flight — so the client is handed a new cookie here.
  app.post('/auth/elevate', async (c) => {
    const body = await c.req
      .json<{ password?: string }>()
      .catch(() => ({}) as { password?: string })
    if (typeof body.password !== 'string') throw new BasedbError('CREDENTIALS_INVALID')

    const elevated = await options.kernel.elevate(getCookie(c, SESSION_COOKIE), body.password)
    plantSession(c, elevated.session.sessionToken, elevated.session.csrfToken)
    return c.json({ data: { elevated_until: elevated.elevatedUntil.toISOString() } })
  })

  app.delete('/auth/elevation', async (c) => {
    await options.kernel.dropElevation(getCookie(c, SESSION_COOKIE))
    return c.body(null, 204)
  })

  // `202` ALWAYS, and immediately, without waiting for delivery. An unknown, disabled,
  // or OIDC-only account receives nothing — and answers exactly the same.
  app.post('/auth/password/reset/request', async (c) => {
    const address = bounded(c)
    void address
    const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string })
    if (typeof body.email === 'string') {
      await options.kernel.requestPasswordReset(body.email)
    }
    return c.body(null, 202)
  })

  app.post('/auth/password/reset/confirm', async (c) => {
    bounded(c)
    const body = await c.req
      .json<{ secret?: string; password?: string }>()
      .catch(() => ({}) as { secret?: string; password?: string })
    if (typeof body.secret !== 'string' || typeof body.password !== 'string') {
      // Unknown, expired, already used, malformed: one refusal.
      throw new BasedbError('RESET_TOKEN_INVALID')
    }
    await options.kernel.confirmPasswordReset({ secret: body.secret, password: body.password })
    return c.body(null, 204)
  })

  // ---------------------------------------------------------------------------------
  // /auth/oidc — chapter 13 §3
  // ---------------------------------------------------------------------------------

  /** The tenant these pre-session routes speak for. */
  const authTenant = () => options.tenantRef ?? 't4z56fq'

  /** Where the provider sends the browser back. Registered, hence never inferred. */
  const redirectUri = (c: Context<{ Variables: Variables }, string>, slug: string) => {
    const base = options.publicUrl ?? new URL(c.req.url).origin
    return `${base.replace(/\/$/, '')}/auth/oidc/${slug}/callback`
  }

  /** The exchange cookie: `SameSite=Lax`, because the return is a top-level GET. */
  const plantExchange = (c: Context<{ Variables: Variables }, string>, sealed: string) => {
    setCookie(c, OIDC_COOKIE, sealed, {
      path: '/',
      secure: true,
      httpOnly: true,
      // `Lax` is necessary AND sufficient here: `Strict` would strip the cookie from the
      // very navigation that brings the code back, and nothing would ever complete.
      sameSite: 'Lax',
      maxAge: 600,
    })
  }

  // Active providers, and nothing that depends on an address: before authentication,
  // no `/auth` route says anything about who holds an account here.
  app.get('/auth/oidc/providers', async (c) =>
    c.json({ data: await options.kernel.oidcProviders(authTenant()) }),
  )

  app.get('/auth/oidc/:slug/start', async (c) => {
    const slug = c.req.param('slug')
    const started = await options.kernel.oidcStart({
      tenantRef: authTenant(),
      slug,
      redirectUri: redirectUri(c, slug),
      returnTo: c.req.query('return_to'),
    })
    plantExchange(c, started.exchangeCookie)
    return c.redirect(started.authorizeUrl, 302)
  })

  app.get('/auth/oidc/:slug/callback', async (c) => {
    bounded(c)
    const slug = c.req.param('slug')
    const completed = await options.kernel.oidcCallback({
      tenantRef: authTenant(),
      slug,
      code: c.req.query('code'),
      state: c.req.query('state'),
      cookie: getCookie(c, OIDC_COOKIE),
      ip: addressOf(c),
      userAgent: c.req.header('user-agent') ?? null,
    })

    // The exchange is over: its cookie has nothing left to carry.
    deleteCookie(c, OIDC_COOKIE, { path: '/', secure: true })
    plantSession(c, completed.session.sessionToken, completed.session.csrfToken)
    return c.redirect(completed.returnTo, 302)
  })

  // Linking happens from a session that is ALREADY open and elevated — never the other
  // way round. Adopting an account because a provider claims its address would turn
  // every OIDC login into a takeover.
  app.post('/auth/oidc/:slug/link', async (c) => {
    await options.kernel.oidcLink({
      sessionToken: getCookie(c, SESSION_COOKIE),
      tenantRef: authTenant(),
      slug: c.req.param('slug'),
      code: c.req.query('code'),
      state: c.req.query('state'),
      cookie: getCookie(c, OIDC_COOKIE),
    })
    deleteCookie(c, OIDC_COOKIE, { path: '/', secure: true })
    return c.body(null, 204)
  })

  app.delete('/auth/oidc/:slug/link', async (c) => {
    await options.kernel.oidcUnlink({
      sessionToken: getCookie(c, SESSION_COOKIE),
      slug: c.req.param('slug'),
    })
    return c.body(null, 204)
  })

  // ---------------------------------------------------------------------------------
  // /meta — the catalog projection (§9)
  // ---------------------------------------------------------------------------------

  /**
   * Serves one of the four catalog documents, with its validator.
   *
   * `Cache-Control` is NOT `no-store`: that would forbid the client from keeping the
   * response, hence the validator, hence from ever sending `If-None-Match` — and the
   * `304` the chapter announces would never happen. `Vary: Authorization` is what keeps
   * a copy held by one actor from being validated for another.
   */
  type MetaContext = Context<{ Variables: Variables }, string>

  const meta = (kind: MetaKind, parameter?: string) => async (c: MetaContext) => {
    const ctx = await dataContext(c)
    const reference = parameter === undefined ? '' : (c.req.param(parameter) ?? '')
    const served = await options.kernel.serveMeta(
      ctx,
      kind,
      reference,
      c.req.header('if-none-match'),
    )

    c.header('etag', served.etag)
    c.header('cache-control', CACHE_CONTROL)
    c.header('vary', VARY)

    // Nothing was built to answer this: the validator comes from the two counters,
    // not from the bytes.
    if (served.notModified) return c.body(null, 304)
    // OpenAPI is a contract, served whole; the other three keep the envelope.
    return kind === 'openapi'
      ? c.json(served.body as Record<string, unknown>)
      : c.json({ data: served.body })
  }

  // A base appears if and only if the caller holds `read` on at least one of its
  // tables. A base with none is absent, not empty.
  app.get('/api/v1/:tenantRef/meta/bases', meta('bases'))

  // The projected description. The same projection serves the OpenAPI serialization and
  // the readable documentation (§9.1): three views of one tree, so that no route can
  // filter less than its neighbour — and now three documents behind one validator.
  app.get('/api/v1/:tenantRef/meta/bases/:base', meta('meta', 'base'))
  app.get('/api/v1/:tenantRef/meta/bases/:base/openapi.json', meta('openapi', 'base'))
  app.get('/api/v1/:tenantRef/meta/bases/:base/doc', meta('doc', 'base'))

  // ---------------------------------------------------------------------------------
  // /data — the rows (§3 to §6)
  // ---------------------------------------------------------------------------------

  app.get('/api/v1/:tenantRef/data/:base/:table', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const limit = c.req.query('limit')
    const result = await options.kernel.listRecords(ctx, {
      tableId: table.tableId,
      limit: limit !== undefined ? Number(limit) : undefined,
      after: c.req.query('after'),
      filter: c.req.query('filter'),
      links: c.req.query('links') === 'id' ? 'id' : 'display',
      expand: c.req.query('expand'),
      sort: c.req.query('sort'),
      // Chapter 11 §1.1: the total is NOT computed by default. A caller asks for it,
      // and the kernel caps the answer rather than scanning without a bound.
      count: c.req.query('count') === 'exact' ? 'exact' : undefined,
    })
    return c.json({
      data: result.rows,
      // The linked object is NOT nested in the row: it is returned in `included`,
      // indexed by table name then identifier (§5.2). 100 invoices pointing at 3
      // clients thus carry 3 objects, not 100.
      included: result.included,
      meta: {
        columns: result.columns,
        sql: result.sql,
        link_sql: result.linkSql,
        has_next_page: result.hasNextPage,
        next_cursor: result.nextCursor,
        count: result.total,
        count_is_capped: result.totalCapped,
      },
    })
  })

  // The rows deleted since an instant — how a consumer that missed events catches up on
  // what disappeared (§6.5). Declared before `/:id`, whose pattern it would otherwise be.
  app.get('/api/v1/:tenantRef/data/:base/:table/deleted', async (c) => {
    const ctx = await dataContext(c)
    const since = c.req.query('since')
    if (since === undefined || since === '') {
      throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'since' } })
    }
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const limit = c.req.query('limit')
    const page = await options.kernel.listDeletions(ctx, {
      tableId: table.tableId,
      since,
      cursor: c.req.query('cursor') || undefined,
      limit: limit === undefined ? undefined : Number(limit),
    })
    return c.json({
      data: page.deletions.map((d) => ({
        _id: d.id,
        deleted_at: d.deletedAt,
        deleted_by: d.deletedBy,
        cause: d.cause,
      })),
      meta: { next_cursor: page.nextCursor },
    })
  })

  // One row by its identifier — the route the documentation has always announced. It is
  // the list, filtered on `_id`: the same mask, the same link resolution, the same SQL
  // builder, and therefore no second read path to keep in step with the first.
  app.get('/api/v1/:tenantRef/data/:base/:table/:id', async (c) => {
    const ctx = await dataContext(c)
    const id = c.req.param('id')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: id } })
    }
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const result = await options.kernel.listRecords(ctx, {
      tableId: table.tableId,
      limit: 1,
      filter: `_id eq "${id.toLowerCase()}"`,
      links: c.req.query('links') === 'id' ? 'id' : 'display',
      expand: c.req.query('expand'),
    })
    const row = result.rows[0]
    if (row === undefined) throw new BasedbError('RESOURCE_NOT_FOUND', { details: { record: id } })
    return c.json({ data: row, included: result.included, meta: { sql: result.sql } })
  })

  app.post('/api/v1/:tenantRef/data/:base/:table', async (c) => {
    const body = await c.req.json<{ actor?: string; values?: Record<string, unknown> }>()
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const created = await options.kernel.createRecord(ctx, {
      tableId: table.tableId,
      values: body.values ?? {},
    })
    return c.json({ data: created.row }, 201)
  })

  // A batch, chapter 08 §3.5 — for now the part a file import needs: `create` operations,
  // all or nothing. What the spec also describes (`update`, `delete`, `atomic: false`,
  // `Idempotency-Key`) is refused by name rather than half-honoured: an `update` quietly
  // ignored would answer as if it had been done.
  app.post('/api/v1/:tenantRef/data/:base/:table/batch', async (c) => {
    const body = await c.req.json<{ atomic?: unknown; operations?: unknown }>()
    if (!Array.isArray(body.operations)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'operations' } })
    }
    if (body.atomic !== undefined && body.atomic !== true) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'atomic', reason: 'seul_atomique_est_pris_en_charge' },
      })
    }

    const records: Array<Record<string, unknown>> = []
    for (const [index, operation] of body.operations.entries()) {
      const { op, data } = (operation ?? {}) as { op?: unknown; data?: unknown }
      if (op !== 'create') {
        throw new BasedbError('REQUEST_INVALID', {
          details: { field: 'operations', index, reason: 'seul_create_est_pris_en_charge' },
        })
      }
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new BasedbError('REQUEST_INVALID', {
          details: { field: 'operations', index, reason: 'data_attendu' },
        })
      }
      records.push(data as Record<string, unknown>)
    }

    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const created = await options.kernel.createRecords(ctx, { tableId: table.tableId, records })

    // 200, with the shape of §3.5: a caller reads `summary` to know what happened.
    return c.json({
      atomic: true,
      results: created.ids.map((id, index) => ({ index, status: 'created', id })),
      summary: { created: created.ids.length, updated: 0, deleted: 0, failed: 0 },
    })
  })

  app.patch('/api/v1/:tenantRef/data/:base/:table/:id', async (c) => {
    const body = await c.req.json<{ actor?: string; values?: Record<string, unknown> }>()
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const updated = await options.kernel.updateRecord(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
      values: body.values ?? {},
    })
    return c.json({ data: updated.row })
  })

  app.delete('/api/v1/:tenantRef/data/:base/:table/:id', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    await options.kernel.deleteRecord(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
    })
    // 204: the deletion succeeded and there is nothing to return.
    return c.body(null, 204)
  })

  // The rows referencing a given row. A dedicated sub-path, not an expansion parameter:
  // an inverse link has unbounded cardinality, and including it in `expand` would put a
  // paginated list inside a row of another paginated list (§5.6).
  app.get('/api/v1/:tenantRef/data/:base/:table/:id/referenced_by', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const result = await options.kernel.listInverseLinks(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
    })
    return c.json({
      data: result.blocks.map((b) => ({
        label: b.label,
        table: b.tableName,
        field: b.fieldName,
        count: b.count,
        capped: b.capped,
        rows: b.rows,
      })),
      meta: { truncated: result.truncated, sql: result.sql },
    })
  })

  // ---------------------------------------------------------------------------------
  // History — chapter 07 §9, §12.1. Read with `read` on the table; undoing and
  // restoring are ordinary writes, with the reader's rights.
  // ---------------------------------------------------------------------------------

  type HistoryPage = Awaited<ReturnType<typeof options.kernel.recordHistory>>

  const serializeHistory = (page: HistoryPage) => ({
    data: page.revisions.map((r) => ({
      id: r.id,
      occurred_at: r.occurredAt,
      op: r.op,
      cascade: r.cascade,
      table: r.table,
      record_id: r.recordId,
      record_display: r.recordDisplay,
      actor: {
        kind: r.actor.kind,
        user_id: r.actor.userId,
        name: r.actor.name,
        token_id: r.actor.tokenId,
        token_label: r.actor.tokenLabel,
        sql_identity: r.actor.sqlIdentity,
      },
      changes: r.changes.map((ch) => ({
        field_id: ch.fieldId,
        label: ch.label,
        kind: ch.kind,
        name: ch.name,
        ...('before' in ch ? { before: ch.before } : {}),
        ...('after' in ch ? { after: ch.after } : {}),
        before_display: ch.beforeDisplay,
        after_display: ch.afterDisplay,
      })),
      actions: r.actions,
    })),
    // Only the cursor says the end has come: a page may hold fewer entries than asked
    // without being the last one, when the reader may not see some (07 §9.2).
    meta: { next_cursor: page.nextCursor },
  })

  const pageParameters = (c: { req: { query: (k: string) => string | undefined } }) => {
    const limit = c.req.query('limit')
    return {
      cursor: c.req.query('cursor') || undefined,
      limit: limit === undefined ? undefined : Number(limit),
    }
  }

  app.get('/api/v1/:tenantRef/data/:base/:table/:id/history', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const page = await options.kernel.recordHistory(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
      ...pageParameters(c),
    })
    return c.json(serializeHistory(page))
  })

  app.get('/api/v1/:tenantRef/meta/bases/:base/history', async (c) => {
    const ctx = await dataContext(c)
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const tableRef = c.req.query('table')
    const tableId =
      tableRef === undefined || tableRef === ''
        ? undefined
        : (await options.kernel.resolveTable(ctx, c.req.param('base'), tableRef)).tableId
    const page = await options.kernel.baseHistory(ctx, {
      baseId: base.baseId,
      tableId,
      ...pageParameters(c),
    })
    return c.json(serializeHistory(page))
  })

  app.post('/api/v1/:tenantRef/history/:revision/revert', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const result = await options.kernel.revertRevision(ctx, { revisionId: c.req.param('revision') })
    return c.json({ data: { table_id: result.tableId, record_id: result.recordId } })
  })

  app.post('/api/v1/:tenantRef/history/:revision/restore', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const result = await options.kernel.restoreRecord(ctx, { revisionId: c.req.param('revision') })
    return c.json({ data: { table_id: result.tableId, record_id: result.recordId } }, 201)
  })

  // ---------------------------------------------------------------------------------
  // /files — the bytes of `file` and `image` fields (chapter 04 §3 bis)
  //
  // A namespace of its own, like `/data/` and `/meta/`: `/data/{base}/{table}/files`
  // would read as the record whose identifier is `files`.
  // ---------------------------------------------------------------------------------

  // A deposit: the body IS the file, its type in `Content-Type`, its name in `?name=`.
  // Not multipart: one file per request is what the interface sends, and a raw body
  // needs no parser between the socket and the size bound.
  app.post(
    '/api/v1/:tenantRef/files/:base/:table/:field',
    bodyLimit({
      maxSize: options.kernel.files.maxBytes,
      onError: () => {
        throw new BasedbError('BODY_TOO_LARGE', {
          details: { maximum: options.kernel.files.maxBytes },
        })
      },
    }),
    async (c) => {
      const ctx = await dataContext(c)
      const table = await options.kernel.resolveTable(
        ctx,
        c.req.param('base'),
        c.req.param('table'),
      )
      const file = await options.kernel.uploadFile(ctx, {
        tableId: table.tableId,
        field: c.req.param('field'),
        name: c.req.query('name') ?? '',
        type: c.req.header('content-type'),
        bytes: new Uint8Array(await c.req.arrayBuffer()),
      })
      return c.json({ data: file }, 201)
    },
  )

  // A download, through the signed link a read handed out — no `Authorization`, which an
  // `<img src>` cannot send. The link is the credential; the kernel checks it.
  app.get('/api/v1/:tenantRef/files/:id/:name', async (c) => {
    const file = await options.kernel.openFile({
      tenant: c.req.param('tenantRef'),
      id: c.req.param('id'),
      expires: c.req.query('exp'),
      signature: c.req.query('sig'),
    })
    const inline = file.inline && c.req.query('download') !== '1'
    return c.body(file.body, 200, {
      'content-type': file.type,
      'content-length': String(file.size),
      'content-disposition': disposition(inline ? 'inline' : 'attachment', file.name),
      // The link is a capability: a shared cache must not keep it, and the browser may
      // for as long as the link lives — which is what keeps a grid's thumbnails cached.
      'cache-control': `private, max-age=${file.maxAge}, immutable`,
      etag: `"${file.sha256}"`,
      // What the file claims to be is what it is served as, never sniffed into HTML.
      'x-content-type-options': 'nosniff',
      // A document opened in place runs nothing: no script, no form, no plugin. Not for
      // a PDF, whose viewer a sandbox would refuse to start.
      ...(file.type === 'application/pdf'
        ? {}
        : { 'content-security-policy': "default-src 'none'; img-src 'self'; sandbox" }),
    })
  })

  // ---------------------------------------------------------------------------------
  // /admin — product operations
  //
  // Chapter 08 §1.4 does not give schema editing a route in the v1 plan; it does fix
  // that `/admin/` is the product namespace. These four therefore live there, and will
  // move under whatever path the chapter that specifies them chooses.
  // ---------------------------------------------------------------------------------

  app.post('/api/v1/:tenantRef/admin/bases', async (c) => {
    const body = await c.req.json<{
      label?: string
      description?: string | null
      project?: string
    }>()
    if (typeof body.label !== 'string' || body.label.trim() === '') {
      throw new BasedbError('LABEL_EMPTY')
    }
    const ctx = await contextFor(c, await bearer(c))
    // In the project named — the tenant's first when none is, as before projects existed.
    const base = await options.kernel.createBase(ctx, {
      label: body.label,
      description: body.description,
      projectId: typeof body.project === 'string' && body.project !== '' ? body.project : undefined,
    })
    return c.json(
      {
        data: {
          id: base.baseId,
          name: base.schemaName,
          description: base.description,
          project: base.projectId,
        },
      },
      201,
    )
  })

  // ---------------------------------------------------------------------------------
  // Projects — the level above the base (chapter 05 §15). Listed under /meta like the
  // bases: what the caller sees is a projection of their rights.
  // ---------------------------------------------------------------------------------

  app.get('/api/v1/:tenantRef/meta/projects', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const projects = await options.kernel.listProjects(ctx)
    return c.json({ data: projects })
  })

  app.post('/api/v1/:tenantRef/admin/projects', async (c) => {
    const body = await c.req.json<{ label?: string; description?: string | null } & LookBody>()
    const look = lookOf(body)
    const ctx = await contextFor(c, await bearer(c))
    const project = await options.kernel.createProject(ctx, {
      label: typeof body.label === 'string' ? body.label : '',
      description: body.description,
      ...(look === undefined ? {} : { look }),
    })
    return c.json({ data: project }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/projects/:id', async (c) => {
    const body = await c.req.json<{ label?: string; description?: string | null } & LookBody>()
    const look = lookOf(body)
    if (body.label === undefined && body.description === undefined && look === undefined) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'label, description, color, icon, image' },
      })
    }
    const ctx = await contextFor(c, await bearer(c))
    const result = await options.kernel.updateProject(ctx, {
      projectId: c.req.param('id'),
      label: body.label,
      description: body.description,
      ...(look === undefined ? {} : { look }),
    })
    return c.json({ data: result })
  })

  app.delete('/api/v1/:tenantRef/admin/projects/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    await options.kernel.deleteProject(ctx, { projectId: c.req.param('id') })
    return c.body(null, 204)
  })

  // ---------------------------------------------------------------------------------
  // /admin/users, /admin/groups, /admin/access — people, groups and the permission grid
  // (chapter 05 §8, §15). Administrators only, and every write demands a session
  // elevated minutes ago: the kernel checks it on the session itself.
  // ---------------------------------------------------------------------------------

  const serializeUser = (u: Awaited<ReturnType<typeof options.kernel.listUsers>>[number]) => ({
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    is_admin: u.isAdmin,
    disabled: u.disabled,
    must_change_password: u.mustChangePassword,
    created_at: u.createdAt,
    last_seen_at: u.lastSeenAt,
    groups: u.groups,
  })

  const serializeGroup = (g: Awaited<ReturnType<typeof options.kernel.listGroups>>[number]) => ({
    id: g.id,
    label: g.label,
    system: g.system,
    member_count: g.memberCount,
  })

  /** The acting context and the session the request came from, for elevation. */
  const administering = async (c: Context<{ Variables: Variables }, string>) => {
    const who = await bearerWho(c)
    return { ctx: await contextFor(c, who.userId), sessionId: who.sessionId }
  }

  app.get('/api/v1/:tenantRef/admin/users', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const users = await options.kernel.listUsers(ctx)
    return c.json({ data: users.map(serializeUser) })
  })

  app.post('/api/v1/:tenantRef/admin/users', async (c) => {
    const body = await c.req.json<{ email?: unknown; display_name?: unknown; groups?: unknown }>()
    const { ctx, sessionId } = await administering(c)
    const created = await options.kernel.createUser(ctx, {
      email: typeof body.email === 'string' ? body.email : '',
      displayName: typeof body.display_name === 'string' ? body.display_name : '',
      groupIds: Array.isArray(body.groups) ? (body.groups as string[]) : [],
      sessionId,
    })
    // The temporary password is in this response and nowhere else, ever.
    return c.json(
      {
        data: {
          user: serializeUser(created.user),
          temporary_password: created.temporaryPassword,
        },
      },
      201,
    )
  })

  app.patch('/api/v1/:tenantRef/admin/users/:id', async (c) => {
    const body = await c.req.json<{ display_name?: unknown; disabled?: unknown }>()
    const { ctx, sessionId } = await administering(c)
    const user = await options.kernel.updateUser(ctx, {
      userId: c.req.param('id'),
      displayName: typeof body.display_name === 'string' ? body.display_name : undefined,
      disabled: typeof body.disabled === 'boolean' ? body.disabled : undefined,
      sessionId,
    })
    return c.json({ data: serializeUser(user) })
  })

  app.post('/api/v1/:tenantRef/admin/users/:id/password', async (c) => {
    const { ctx, sessionId } = await administering(c)
    const reset = await options.kernel.resetUserPassword(ctx, {
      userId: c.req.param('id'),
      sessionId,
    })
    return c.json({ data: { temporary_password: reset.temporaryPassword } })
  })

  app.put('/api/v1/:tenantRef/admin/users/:id/groups', async (c) => {
    const body = await c.req.json<{ groups?: unknown }>()
    if (!Array.isArray(body.groups)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'groups' } })
    }
    const { ctx, sessionId } = await administering(c)
    const user = await options.kernel.setUserGroups(ctx, {
      userId: c.req.param('id'),
      groupIds: body.groups as string[],
      sessionId,
    })
    return c.json({ data: serializeUser(user) })
  })

  app.get('/api/v1/:tenantRef/admin/groups', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const groups = await options.kernel.listGroups(ctx)
    return c.json({ data: groups.map(serializeGroup) })
  })

  app.post('/api/v1/:tenantRef/admin/groups', async (c) => {
    const body = await c.req.json<{ label?: unknown }>()
    const { ctx, sessionId } = await administering(c)
    const group = await options.kernel.createGroup(ctx, {
      label: typeof body.label === 'string' ? body.label : '',
      sessionId,
    })
    return c.json({ data: serializeGroup(group) }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/groups/:id', async (c) => {
    const body = await c.req.json<{ label?: unknown }>()
    const { ctx, sessionId } = await administering(c)
    const result = await options.kernel.renameGroup(ctx, {
      groupId: c.req.param('id'),
      label: typeof body.label === 'string' ? body.label : '',
      sessionId,
    })
    return c.json({ data: result })
  })

  app.delete('/api/v1/:tenantRef/admin/groups/:id', async (c) => {
    const { ctx, sessionId } = await administering(c)
    await options.kernel.deleteGroup(ctx, { groupId: c.req.param('id'), sessionId })
    return c.body(null, 204)
  })

  app.get('/api/v1/:tenantRef/admin/groups/:id/members', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const members = await options.kernel.listGroupMembers(ctx, { groupId: c.req.param('id') })
    return c.json({
      data: members.map((m) => ({ id: m.id, email: m.email, display_name: m.displayName })),
    })
  })

  const membership = (member: boolean) => async (c: Context<{ Variables: Variables }, string>) => {
    const { ctx, sessionId } = await administering(c)
    await options.kernel.setGroupMembership(ctx, {
      groupId: c.req.param('id') ?? '',
      userId: c.req.param('user') ?? '',
      member,
      sessionId,
    })
    return c.body(null, 204)
  }
  app.put('/api/v1/:tenantRef/admin/groups/:id/members/:user', membership(true))
  app.delete('/api/v1/:tenantRef/admin/groups/:id/members/:user', membership(false))

  app.get('/api/v1/:tenantRef/admin/access', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const graph = await options.kernel.accessGraph(ctx)
    return c.json({ data: { ...graph, groups: graph.groups.map(serializeGroup) } })
  })

  app.post('/api/v1/:tenantRef/admin/access', async (c) => {
    const body = await c.req.json<{ changes?: unknown }>()
    if (!Array.isArray(body.changes)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'changes' } })
    }
    const { ctx, sessionId } = await administering(c)
    // Each change names its group as `group`: the wire speaks snake case, the kernel not.
    const changes = (body.changes as Array<Record<string, unknown> | null>).map((change) => ({
      groupId: typeof change?.group === 'string' ? change.group : '',
      scope: change?.scope as { kind: 'project' | 'base' | 'table'; id: string },
      level: change?.level as 'none' | 'read' | 'edit' | 'manage',
    }))
    const graph = await options.kernel.applyAccessChanges(ctx, { changes, sessionId })
    return c.json({ data: { ...graph, groups: graph.groups.map(serializeGroup) } })
  })

  // Below the grid: the rules of each group on the fields of one table (05 §4), and what
  // a given person ends up with there (§3.3).
  const serializeFieldAccess = (
    access: Awaited<ReturnType<typeof options.kernel.fieldAccess>>,
  ) => ({
    table: access.table,
    fields: access.fields,
    groups: access.groups.map((g) => ({ ...serializeGroup(g), level: g.level, rules: g.rules })),
  })

  app.get('/api/v1/:tenantRef/admin/access/tables/:table/fields', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const access = await options.kernel.fieldAccess(ctx, { tableId: c.req.param('table') })
    return c.json({ data: serializeFieldAccess(access) })
  })

  app.put('/api/v1/:tenantRef/admin/access/fields/:field', async (c) => {
    const body = await c.req.json<{ group?: unknown; rule?: unknown }>()
    if (typeof body.group !== 'string' || (body.rule !== null && typeof body.rule !== 'string')) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'group, rule' } })
    }
    const { ctx, sessionId } = await administering(c)
    const access = await options.kernel.setFieldRule(ctx, {
      groupId: body.group,
      fieldId: c.req.param('field'),
      rule: body.rule as 'hidden' | 'read_only' | null,
      sessionId,
    })
    return c.json({ data: serializeFieldAccess(access) })
  })

  app.get('/api/v1/:tenantRef/admin/access/tables/:table/mask', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const mask = await options.kernel.effectiveFieldMask(ctx, {
      tableId: c.req.param('table'),
      userId: c.req.query('user') ?? '',
    })
    return c.json({
      data: {
        user: { id: mask.user.id, display_name: mask.user.displayName, email: mask.user.email },
        reads_table: mask.readsTable,
        fields: mask.fields.map((f) => ({
          id: f.id,
          level: f.level,
          readable_via: f.readableVia,
          restricted_by: f.restrictedBy,
        })),
      },
    })
  })

  // ---------------------------------------------------------------------------------
  // /ai — the two draft usages of chapter 12 §1.2, and no third one.
  //
  // Neither route executes anything. A draft is shown, amended, validated by the
  // ordinary validator, and saved only by an explicit act.
  // ---------------------------------------------------------------------------------

  // The SQL console. The one route of this API that carries a SQL string, and it exists
  // against chapters 09 and 10 by the owner's decision. The kernel runs it on a separate
  // PostgreSQL login role that holds one schema and nothing else.
  app.post('/api/v1/:tenantRef/sql/:base', async (c) => {
    const body = await c.req.json<{ sql?: string; limit?: number }>()
    if (typeof body.sql !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'sql' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const result = await options.kernel.runSql(ctx, {
      baseId: base.baseId,
      sql: body.sql,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
    })
    return c.json({
      data: {
        columns: result.columns,
        rows: result.rows,
        row_count: result.rowCount,
        command: result.command,
        duration_ms: result.durationMs,
        truncated: result.truncated,
        schema: result.schema,
      },
    })
  })

  app.post('/api/v1/:tenantRef/ai/bases/:base/expression', async (c) => {
    const body = await c.req.json<{ table?: string; request?: string; previous_error?: string }>()
    if (typeof body.table !== 'string' || typeof body.request !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'table, request' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), body.table)
    const draft = await options.kernel.draftExpression(ctx, providerTransport, {
      baseRef: c.req.param('base'),
      tableId: table.tableId,
      request: body.request,
      previousError: body.previous_error,
    })
    return c.json({ data: draft })
  })

  // The copilot — chapter 12 §1.6. A conversation about one base: the screen keeps it and
  // sends it whole; the kernel answers the last message, and proposes. `read_data` is the
  // person's consent, for this conversation, to rows being read and sent to the provider.
  app.post('/api/v1/:tenantRef/ai/bases/:base/copilot', async (c) => {
    const body = await c.req.json<{
      table?: unknown
      filter?: unknown
      sort?: unknown
      messages?: unknown
      read_data?: unknown
    }>()
    const messages = Array.isArray(body.messages) ? body.messages : null
    if (
      messages === null ||
      messages.some(
        (m) =>
          typeof m !== 'object' ||
          m === null ||
          (m.role !== 'user' && m.role !== 'assistant') ||
          typeof m.content !== 'string',
      )
    ) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'messages' } })
    }
    for (const key of ['table', 'filter', 'sort'] as const) {
      const value = body[key]
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new BasedbError('REQUEST_INVALID', { details: { field: key } })
      }
    }
    if (body.read_data !== undefined && typeof body.read_data !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'read_data' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const table =
      typeof body.table === 'string' && body.table !== ''
        ? await options.kernel.resolveTable(ctx, c.req.param('base'), body.table)
        : null
    const answer = await options.kernel.copilot(ctx, providerTransport, {
      baseId: base.baseId,
      tableId: table?.tableId ?? null,
      view: {
        filter: typeof body.filter === 'string' ? body.filter : null,
        sort: typeof body.sort === 'string' ? body.sort : null,
      },
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      readData: body.read_data === true,
    })
    return c.json({ data: answer })
  })

  app.post('/api/v1/:tenantRef/ai/bases/:base/structure', async (c) => {
    const body = await c.req.json<{ request?: string }>()
    if (typeof body.request !== 'string' || body.request.trim() === '') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'request' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const draft = await options.kernel.draftStructure(ctx, providerTransport, {
      baseId: base.baseId,
      request: body.request,
    })
    return c.json({ data: draft })
  })

  // The bases this tenant has deleted logically, for the restore menu. Placed BEFORE
  // `/admin/bases/:base` so that `deleted` is not read as a base reference.
  app.get('/api/v1/:tenantRef/admin/bases/deleted', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const bases = await options.kernel.listDeletedBases(ctx)
    return c.json({
      data: bases.map((b) => ({
        id: b.id,
        name: b.name,
        label: b.label,
        deleted_at: b.deletedAt,
        table_count: b.tableCount,
      })),
    })
  })

  // A live base's deleted tables — the screen of deleted objects, where a purge starts.
  app.get('/api/v1/:tenantRef/admin/bases/:base/deleted-tables', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const tables = await options.kernel.listDeletedTables(ctx, { baseId: base.baseId })
    return c.json({
      data: tables.map((t) => ({
        id: t.id,
        label: t.label,
        name: t.name,
        deleted_at: t.deletedAt,
        deleted_by: t.deletedBy,
        purgeable_from: t.purgeableFrom,
      })),
    })
  })

  // ---------------------------------------------------------------------------------
  // Chapter 06 — the PHYSICAL name (renames and their compatibility aliases) and the
  // purge. Administration only, a person's session only; the kernel decides both.
  // ---------------------------------------------------------------------------------

  const physicalKind = (value: string): 'base' | 'table' | 'field' => {
    if (value === 'base' || value === 'table' || value === 'field') return value
    throw new BasedbError('RESOURCE_NOT_FOUND')
  }
  const purgeKind = (value: unknown): 'base' | 'table' => {
    if (value === 'base' || value === 'table') return value
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'kind' } })
  }

  app.get('/api/v1/:tenantRef/admin/physical/:kind/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const impact = await options.kernel.renameImpact(ctx, {
      kind: physicalKind(c.req.param('kind')),
      id: c.req.param('id'),
    })
    return c.json({
      data: {
        kind: impact.kind,
        id: impact.id,
        label: impact.label,
        current: impact.current,
        qualified: impact.qualified,
        suggested: impact.suggested,
        alias_allowed: impact.aliasAllowed,
        live_aliases: impact.liveAliases,
        estimated_rows: impact.estimatedRows,
        bytes: impact.bytes,
        webhooks: impact.webhooks,
        tokens: impact.tokens.map((t) => ({ label: t.label, last_used_at: t.lastUsedAt })),
        misaligned_links: impact.misalignedLinks,
        dependents: impact.dependents,
        citing_prompts: impact.citingPrompts,
      },
    })
  })

  app.post('/api/v1/:tenantRef/admin/physical/:kind/:id/rename', async (c) => {
    const body = await c.req.json<{
      name?: unknown
      confirm?: unknown
      alias?: unknown
      alias_days?: unknown
    }>()
    if (typeof body.name !== 'string' || typeof body.confirm !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'name, confirm' } })
    }
    if (body.alias !== undefined && typeof body.alias !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'alias' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const result = await options.kernel.renamePhysical(ctx, {
      kind: physicalKind(c.req.param('kind')),
      id: c.req.param('id'),
      name: body.name,
      confirm: body.confirm,
      ...(body.alias === undefined ? {} : { alias: body.alias }),
      ...(typeof body.alias_days === 'number' ? { aliasDays: body.alias_days } : {}),
    })
    return c.json({
      data: {
        name: result.name,
        alias: result.alias,
        migration: serializeMigration(result.migration),
      },
    })
  })

  type AliasSummary = Awaited<ReturnType<typeof options.kernel.listAliases>>[number]
  const serializeAlias = (a: AliasSummary) => ({
    id: a.id,
    kind: a.kind,
    name: a.name,
    qualified: a.qualified,
    target: a.target,
    target_label: a.targetLabel,
    created_at: a.createdAt,
    drop_after: a.dropAfter,
    blank_cut: a.blankCut,
    views: a.views,
    dependents: a.dependents,
  })

  app.get('/api/v1/:tenantRef/admin/aliases', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.query('base') ?? '')
    const aliases = await options.kernel.listAliases(ctx, { baseId: base.baseId })
    return c.json({ data: aliases.map(serializeAlias) })
  })

  app.post('/api/v1/:tenantRef/admin/aliases/:id/cut', async (c) => {
    const body = await c.req.json<{ days?: unknown }>().catch(() => ({}) as { days?: unknown })
    if (body.days !== undefined && typeof body.days !== 'number') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'days' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const alias = await options.kernel.startBlankCut(ctx, {
      aliasId: c.req.param('id'),
      ...(body.days === undefined ? {} : { days: body.days }),
    })
    return c.json({ data: alias === null ? null : serializeAlias(alias) })
  })

  app.post('/api/v1/:tenantRef/admin/aliases/:id/restore', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const alias = await options.kernel.endBlankCut(ctx, { aliasId: c.req.param('id') })
    return c.json({ data: alias === null ? null : serializeAlias(alias) })
  })

  app.post('/api/v1/:tenantRef/admin/aliases/:id/drop', async (c) => {
    const body = await c.req.json<{ confirm?: unknown }>()
    if (typeof body.confirm !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'confirm' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    await options.kernel.dropAlias(ctx, { aliasId: c.req.param('id'), confirm: body.confirm })
    return c.body(null, 204)
  })

  app.post('/api/v1/:tenantRef/admin/purge/exports', async (c) => {
    const body = await c.req.json<{ kind?: unknown; id?: unknown }>()
    if (typeof body.id !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'id' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const exported = await options.kernel.exportForPurge(ctx, {
      kind: purgeKind(body.kind),
      id: body.id,
    })
    return c.json(
      {
        data: {
          id: exported.id,
          directory: exported.directory,
          created_at: exported.createdAt,
          total_rows: exported.totalRows,
          total_bytes: exported.totalBytes,
          tables: exported.tables,
        },
      },
      201,
    )
  })

  app.post('/api/v1/:tenantRef/admin/purge', async (c) => {
    const body = await c.req.json<{
      kind?: unknown
      id?: unknown
      export?: unknown
      confirm?: unknown
      early_justification?: unknown
    }>()
    if (
      typeof body.id !== 'string' ||
      typeof body.export !== 'string' ||
      typeof body.confirm !== 'string'
    ) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'id, export, confirm' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const result = await options.kernel.purge(ctx, {
      kind: purgeKind(body.kind),
      id: body.id,
      exportId: body.export,
      confirm: body.confirm,
      ...(typeof body.early_justification === 'string' && body.early_justification.trim() !== ''
        ? { early: { justification: body.early_justification } }
        : {}),
    })
    return c.json({
      data: {
        purged_tables: result.purgedTables,
        residual_schema: result.residualSchema,
        migration: serializeMigration(result.migration),
      },
    })
  })

  // Renaming a LABEL, describing the base, dressing it — chapter 06 §1.1. One catalog row,
  // no DDL, no migration; the physical schema name does not move, so nothing an SQL
  // consumer wrote breaks. Any field may be omitted, but not all: a PATCH that changes
  // nothing is a mistake worth naming.
  app.patch('/api/v1/:tenantRef/admin/bases/:base', async (c) => {
    const body = await c.req.json<{ label?: string; description?: string | null } & LookBody>()
    const look = lookOf(body)
    if (body.label === undefined && body.description === undefined && look === undefined) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'label, description, color, icon, image' },
      })
    }
    if (body.label !== undefined && (typeof body.label !== 'string' || body.label.trim() === '')) {
      throw new BasedbError('LABEL_EMPTY')
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const result = await options.kernel.updateBase(ctx, {
      baseId: base.baseId,
      label: body.label,
      description: body.description,
      look,
    })
    return c.json({
      data: {
        id: base.baseId,
        name: base.baseName,
        label: result.label,
        description: result.description,
        color: result.color,
        icon: result.icon,
        image: result.image,
      },
    })
  })

  // Logical deletion — chapter 06 §4.3. Answers with the migration, not with 204: the
  // plan has steps, it may fail on one, and the caller needs to be able to say which.
  app.delete('/api/v1/:tenantRef/admin/bases/:base', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const migration = await options.kernel.deleteBase(ctx, { baseId: base.baseId })
    return c.json({ data: serializeMigration(migration) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/restore', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const migration = await options.kernel.restoreBase(ctx, { baseId: base.baseId })
    return c.json({ data: serializeMigration(migration) })
  })

  // ---------------------------------------------------------------------------------
  // Environments — chapter 14. `:base` is any environment of the base; an environment
  // is named by its own base name, the one in its URLs and its SQL schema.
  // ---------------------------------------------------------------------------------

  /** The base an environment parameter names — a body key or a query parameter. */
  const environmentOf = async (ctx: RequestContext, name: unknown, field: string) => {
    if (typeof name !== 'string' || name === '') {
      throw new BasedbError('REQUEST_INVALID', { details: { field } })
    }
    return (await options.kernel.resolveBase(ctx, name)).baseId
  }

  app.get('/api/v1/:tenantRef/admin/bases/:base/environments', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    return c.json({ data: await options.kernel.listEnvironments(ctx, { baseId: base.baseId }) })
  })

  // Adds an environment: an empty base of the same lineage, then the structure of the
  // source carried into it — the answer says, step by step, what was carried.
  app.post('/api/v1/:tenantRef/admin/bases/:base/environments', async (c) => {
    const body = await c.req.json<{ environment?: unknown; source?: unknown; consent?: unknown }>()
    if (typeof body.environment !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'environment' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createEnvironment(ctx, {
      baseId: base.baseId,
      environment: body.environment,
      ...(body.source === undefined
        ? {}
        : { sourceBaseId: await environmentOf(ctx, body.source, 'source') }),
      consent: body.consent === true,
    })
    return c.json({ data: created }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/bases/:base/environments/:env', async (c) => {
    const body = await c.req.json<{ environment?: unknown }>()
    if (typeof body.environment !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'environment' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const env = await options.kernel.resolveBase(ctx, c.req.param('env'))
    const renamed = await options.kernel.renameEnvironment(ctx, {
      baseId: env.baseId,
      environment: body.environment,
    })
    return c.json({ data: renamed })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/environments/:env', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const env = await options.kernel.resolveBase(ctx, c.req.param('env'))
    const migration = await options.kernel.deleteEnvironment(ctx, { baseId: env.baseId })
    return c.json({ data: serializeMigration(migration) })
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/environments/compare', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    return c.json({ data: await options.kernel.compareEnvironments(ctx, { baseId: base.baseId }) })
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/environments/plan', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const plan = await options.kernel.planStructure(ctx, {
      sourceBaseId: await environmentOf(ctx, c.req.query('source'), 'source'),
      targetBaseId: await environmentOf(ctx, c.req.query('target'), 'target'),
    })
    return c.json({ data: plan })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/environments/apply', async (c) => {
    const body = await c.req.json<{
      source?: unknown
      target?: unknown
      steps?: unknown
      consent?: unknown
    }>()
    if (!Array.isArray(body.steps) || body.steps.some((s) => typeof s !== 'string')) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'steps' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const report = await options.kernel.applyStructure(ctx, {
      sourceBaseId: await environmentOf(ctx, body.source, 'source'),
      targetBaseId: await environmentOf(ctx, body.target, 'target'),
      steps: body.steps as string[],
      consent: body.consent === true,
    })
    return c.json({ data: report })
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/environments/rows', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const counts = await options.kernel.countRows(ctx, {
      sourceBaseId: await environmentOf(ctx, c.req.query('source'), 'source'),
      targetBaseId: await environmentOf(ctx, c.req.query('target'), 'target'),
    })
    return c.json({ data: counts })
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/environments/rows/:table', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const comparison = await options.kernel.compareRows(ctx, {
      sourceBaseId: await environmentOf(ctx, c.req.query('source'), 'source'),
      targetBaseId: await environmentOf(ctx, c.req.query('target'), 'target'),
      tableLineage: c.req.param('table'),
    })
    return c.json({ data: comparison })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/environments/rows/:table/sync', async (c) => {
    const body = await c.req.json<{
      source?: unknown
      target?: unknown
      insert?: unknown
      update?: unknown
      delete?: unknown
    }>()
    const ctx = await contextFor(c, await bearer(c))
    const result = await options.kernel.syncRows(ctx, {
      sourceBaseId: await environmentOf(ctx, body.source, 'source'),
      targetBaseId: await environmentOf(ctx, body.target, 'target'),
      tableLineage: c.req.param('table'),
      insert: body.insert === true,
      update: body.update === true,
      delete: body.delete === true,
    })
    return c.json({ data: result })
  })

  // The structure history of a base — chapter 07 §8.1: who changed what, and when.
  app.get('/api/v1/:tenantRef/admin/bases/:base/structure-history', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const limit = Number(c.req.query('limit') ?? '50')
    const before = c.req.query('before')
    const page = await options.kernel.structureHistory(ctx, {
      baseId: base.baseId,
      limit: Number.isFinite(limit) ? limit : 50,
      ...(before === undefined || before === '' ? {} : { before }),
    })
    return c.json({ data: page })
  })

  // What deleting a table would do — §4.2 asks the confirmation screen to name the
  // tables it will briefly lock, so the screen must be able to ask before acting.
  app.get('/api/v1/:tenantRef/admin/bases/:base/tables/:table/deletion', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const preview = await options.kernel.previewTableDeletion(ctx, table.tableId)
    return c.json({
      data: {
        label: preview.label,
        row_count: preview.rowCount,
        referenced_by: preview.referencedBy,
        locked_tables: preview.lockedTables,
        relegated_name: preview.relegatedName,
      },
    })
  })

  // Logical deletion of ONE table (§4.2). Answers with the migration, like the base:
  // the plan has a step, it may fail on it, and the caller must be able to say so.
  app.delete('/api/v1/:tenantRef/admin/bases/:base/tables/:table', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const migration = await options.kernel.deleteTable(ctx, { tableId: table.tableId })
    return c.json({ data: serializeMigration(migration) })
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/migrations', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const migrations = await options.kernel.listMigrations(ctx, base.baseId)
    return c.json({ data: migrations.map(serializeMigration) })
  })

  // Resuming a plan left `interrupted`. Never automatic (chapter 06 §1.3): a human asks.
  app.post('/api/v1/:tenantRef/admin/migrations/:id/resume', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const migration = await options.kernel.resumeMigration(ctx, c.req.param('id'))
    return c.json({ data: serializeMigration(migration) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/tables', async (c) => {
    const body = await c.req.json<{
      label?: string
      description?: string | null
      actor?: string
      fields?: ReadonlyArray<{
        label: string
        kind: string
        required?: boolean
        description?: string | null
      }>
    }>()
    if (typeof body.label !== 'string' || body.label.trim() === '') {
      throw new BasedbError('LABEL_EMPTY')
    }
    const ctx = await contextFor(c, await bearer(c))
    // Designated by name as well as by identifier, exactly as under /data — but
    // resolved WITHOUT the visibility rule of §9.1: a base that has just been created
    // has no table yet, and that rule would make its first one impossible to add.
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const table = await options.kernel.createTable(ctx, {
      baseId: base.baseId,
      label: body.label,
      description: body.description,
      fields: (body.fields ?? []) as never,
    })
    return c.json(
      {
        data: {
          id: table.tableId,
          name: table.tableName,
          base: table.schemaName,
          sql: table.qualifiedName,
          description: table.description,
          fields: table.fields.map((f) => ({
            id: f.fieldId,
            label: f.label,
            name: f.name,
            kind: f.kind,
            description: f.description,
          })),
        },
      },
      201,
    )
  })

  // A link field is an operation of its own: its sequence spans three steps, one of
  // them outside a transaction, so it cannot be folded into table creation.
  app.post('/api/v1/:tenantRef/admin/bases/:base/tables/:table/links', async (c) => {
    const body = await c.req.json<{
      actor?: string
      label?: string
      description?: string | null
      target?: string
      required?: boolean
      on_delete?: 'restrict' | 'set_null' | 'cascade'
    }>()
    const ctx = await contextFor(c, await bearer(c))

    if (typeof body.label !== 'string' || body.label.trim() === '') {
      throw new BasedbError('LABEL_EMPTY')
    }
    if (typeof body.target !== 'string' || body.target === '') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'target' } })
    }

    const baseRef = c.req.param('base')
    const source = await options.kernel.resolveTable(ctx, baseRef, c.req.param('table'))
    // The target is designated within the same base: a link crossing bases is refused by
    // the kernel, and naming it here would not change that.
    const target = await options.kernel.resolveTable(ctx, baseRef, body.target)

    const link = await options.kernel.createLinkField(ctx, {
      tableId: source.tableId,
      targetTableId: target.tableId,
      label: body.label,
      description: body.description,
      required: body.required,
      onDelete: body.on_delete,
    })

    return c.json(
      {
        data: {
          id: link.fieldId,
          label: link.label,
          name: link.name,
          description: link.description,
          kind: 'link',
          target: link.targetTableName,
          constraint: link.constraintName,
          index: link.indexName,
          on_delete: link.onDelete,
        },
        meta: { sql: link.sql },
      },
      201,
    )
  })

  // A column added to a table that already holds rows. ALWAYS nullable: the obligation
  // is a separate call, because `ADD COLUMN … NOT NULL` without a default fails here.
  app.post('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields', async (c) => {
    const body = await c.req.json<{
      label?: string
      description?: string | null
      kind?: string
      options?: Array<{
        value: string
        label?: string
        color?: string | null
        icon?: string | null
        image?: string | null
      }>
      ai?: unknown
    }>()
    const ctx = await contextFor(c, await bearer(c))

    if (typeof body.label !== 'string' || body.label.trim() === '') {
      throw new BasedbError('LABEL_EMPTY')
    }
    if (typeof body.kind !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'kind' } })
    }

    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const field = await options.kernel.addField(ctx, {
      tableId: table.tableId,
      label: body.label,
      description: body.description,
      kind: body.kind as never,
      options: body.options,
      ...(body.ai === undefined ? {} : { ai: aiInputOf(body.ai) }),
    })

    return c.json(
      {
        data: {
          id: field.fieldId,
          name: field.name,
          label: field.label,
          description: field.description,
          kind: field.kind,
          required: false,
        },
        meta: { sql: field.sql },
      },
      201,
    )
  })

  // What a table is called, what it is FOR, how it looks. The label is renamed in the
  // catalog alone — the relation keeps its physical name — and the three are written in
  // that order, so a label that clashes leaves the rest as it was.
  app.patch('/api/v1/:tenantRef/admin/bases/:base/tables/:table', async (c) => {
    const body = await c.req.json<{ label?: string; description?: string | null } & LookBody>()
    const look = lookOf(body)
    if (body.label === undefined && body.description === undefined && look === undefined) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'label, description, color, icon, image' },
      })
    }
    if (body.label !== undefined && typeof body.label !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'label' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const written: Record<string, unknown> = {}
    if (body.label !== undefined || look !== undefined) {
      const updated = await options.kernel.updateTable(ctx, {
        tableId: table.tableId,
        label: body.label,
        look,
      })
      Object.assign(written, updated)
    }
    if (body.description !== undefined) {
      written.description = (
        await options.kernel.setTableDescription(ctx, {
          tableId: table.tableId,
          description: body.description,
        })
      ).description
    }
    return c.json({ data: { name: table.tableName, ...written } })
  })

  // What a field is CALLED and what it is FOR: two catalog writes, no migration. The label
  // goes first — it is the one that can clash with a sibling — so a refusal leaves the
  // description as it was.
  app.patch('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field', async (c) => {
    const body = await c.req.json<{ label?: string; description?: string | null }>()
    if (body.label === undefined && body.description === undefined) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'label, description' } })
    }
    if (body.label !== undefined && typeof body.label !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'label' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const field = await options.kernel.resolveField(
      ctx,
      c.req.param('base'),
      c.req.param('table'),
      c.req.param('field'),
    )
    const written: { label?: string; description?: string | null } = {}
    if (body.label !== undefined) {
      written.label = (
        await options.kernel.setFieldLabel(ctx, {
          fieldId: field.fieldId,
          label: body.label,
        })
      ).label
    }
    if (body.description !== undefined) {
      written.description = (
        await options.kernel.setFieldDescription(ctx, {
          fieldId: field.fieldId,
          description: body.description,
        })
      ).description
    }
    return c.json({ data: { name: field.name, ...written } })
  })

  // The choices of a `select`, replaced AS A WHOLE (chapter 04 §3): the list is what a
  // person edits and what a pasted JSON carries, and a PUT says so. Regenerating the
  // CHECK is a migration in three steps, hence `meta.sql`.
  // The order of the fields, as a whole list of physical names — what a drag in the
  // structure screen produces. The catalog's order; PostgreSQL's is left as it is.
  app.put('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/order', async (c) => {
    const body = await c.req.json<{ fields?: unknown }>()
    if (!Array.isArray(body.fields) || body.fields.some((f) => typeof f !== 'string')) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'fields' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const result = await options.kernel.reorderFields(ctx, {
      tableId: table.tableId,
      names: body.fields as string[],
    })
    return c.json({ data: { fields: result.order } })
  })

  // Saved views (chapter 11 §1.4): reading them is reading the table — a data route, open
  // to an integration token —, building them is `manage_schema`, like building the table.
  const serializeView = (view: SavedView) => ({
    id: view.id,
    label: view.label,
    kind: view.kind,
    description: view.description,
    position: view.position,
    spec: view.spec,
    filter_hidden: view.filterHidden,
    created_at: view.createdAt,
    updated_at: view.updatedAt,
  })

  app.get('/api/v1/:tenantRef/meta/bases/:base/tables/:table/views', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const views = await options.kernel.listViews(ctx, { tableId: table.tableId })
    return c.json({ data: views.map(serializeView) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/tables/:table/views', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const view = await options.kernel.createView(ctx, {
      tableId: table.tableId,
      label: body.label,
      kind: body.kind,
      description: body.description,
      spec: body.spec,
    })
    return c.json({ data: serializeView(view) }, 201)
  })

  // The order of the selector, as the whole list of identifiers — registered BEFORE
  // `views/:view`, which would otherwise take `order` for an identifier.
  app.put('/api/v1/:tenantRef/admin/bases/:base/tables/:table/views/order', async (c) => {
    const body = await c.req.json<{ views?: unknown }>()
    if (!Array.isArray(body.views) || body.views.some((v) => typeof v !== 'string')) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'views' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const result = await options.kernel.reorderViews(ctx, {
      tableId: table.tableId,
      ids: body.views as string[],
    })
    return c.json({ data: { views: result.order } })
  })

  app.patch('/api/v1/:tenantRef/admin/bases/:base/tables/:table/views/:view', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const view = await options.kernel.updateView(ctx, {
      tableId: table.tableId,
      viewId: c.req.param('view'),
      label: body.label,
      description: body.description,
      spec: body.spec,
    })
    return c.json({ data: serializeView(view) })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/tables/:table/views/:view', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    await options.kernel.deleteView(ctx, { tableId: table.tableId, viewId: c.req.param('view') })
    return c.body(null, 204)
  })

  // ---------------------------------------------------------------------------------
  // Shared forms — chapter 15. The sharing of a form view is administered here; it is
  // answered through `/api/v1/forms/:token`, below, which needs no right on the table.
  // ---------------------------------------------------------------------------------

  const serializeSharing = (sharing: FormSharing) => ({
    share:
      sharing.share === null
        ? null
        : {
            id: sharing.share.id,
            view_id: sharing.share.viewId,
            access: sharing.share.access,
            active: sharing.share.active,
            token: sharing.share.token,
            closes_at: sharing.share.closesAt,
            max_responses: sharing.share.maxResponses,
            response_count: sharing.share.responseCount,
            last_response_at: sharing.share.lastResponseAt,
            published_by: sharing.share.publishedBy,
            groups: sharing.share.groupIds,
            state: sharing.share.state,
          },
    groups: sharing.groups,
    omitted: sharing.omitted,
  })

  const shareRoute = '/api/v1/:tenantRef/admin/bases/:base/tables/:table/views/:view/share'

  app.get(shareRoute, async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const sharing = await options.kernel.getFormSharing(ctx, {
      tableId: table.tableId,
      viewId: c.req.param('view'),
    })
    return c.json({ data: serializeSharing(sharing) })
  })

  // Creates or changes the sharing: whoever saves becomes its publisher, and the answers
  // are written on their authority from then on.
  app.put(shareRoute, async (c) => {
    const body = await c.req.json<{
      access?: unknown
      active?: unknown
      closes_at?: unknown
      max_responses?: unknown
      groups?: unknown
    }>()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const sharing = await options.kernel.saveFormSharing(ctx, {
      tableId: table.tableId,
      viewId: c.req.param('view'),
      access: body.access as ShareSettings['access'],
      active: body.active === undefined ? true : (body.active as boolean),
      closesAt: (body.closes_at ?? null) as string | null,
      maxResponses: (body.max_responses ?? null) as number | null,
      groupIds: (body.groups ?? []) as string[],
    })
    return c.json({ data: serializeSharing(sharing) })
  })

  app.post(`${shareRoute}/regenerate`, async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const sharing = await options.kernel.regenerateFormShare(ctx, {
      tableId: table.tableId,
      viewId: c.req.param('view'),
    })
    return c.json({ data: serializeSharing(sharing) })
  })

  app.delete(shareRoute, async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    await options.kernel.deleteFormShare(ctx, {
      tableId: table.tableId,
      viewId: c.req.param('view'),
    })
    return c.body(null, 204)
  })

  /**
   * Who answers a shared form: the signed-in person when a valid access token comes with
   * the request, nobody otherwise. A stale token is not an error here — a public form
   * answers anyone —, and a members' form says it wants a sign-in by itself.
   */
  const respondentOf = async (
    c: Context<{ Variables: Variables }, string>,
  ): Promise<RequestContext | null> => {
    const header = c.req.header('authorization')
    if (header === undefined) return null
    try {
      return await contextFor(c, await bearer(c))
    } catch {
      return null
    }
  }

  /** Answers to shared forms, per address: a public form is an open door. */
  const answers = new RateLimiter(20, 60_000)

  app.get('/api/v1/forms/:token', async (c) => {
    const form = await options.kernel.openSharedForm({
      token: c.req.param('token'),
      respondent: await respondentOf(c),
      requestId: c.get('requestId'),
    })
    return c.json({
      data: {
        kind: form.kind,
        title: form.title,
        description: form.description,
        submit_label: form.submitLabel,
        success_message: form.successMessage,
        allow_another: form.allowAnother,
        access: form.access,
        respondent: form.respondent,
        questions: form.questions,
      },
    })
  })

  app.post('/api/v1/forms/:token', async (c) => {
    const verdict = answers.check(`${addressOf(c)}:${c.req.param('token')}`, Date.now())
    if (!verdict.allowed) {
      c.header('retry-after', String(verdict.retryAfter))
      throw new BasedbError('RATE_LIMIT_EXCEEDED', {
        details: { retry_after: verdict.retryAfter },
      })
    }
    const body = await c.req.json<{ values?: unknown }>()
    await options.kernel.submitSharedForm({
      token: c.req.param('token'),
      respondent: await respondentOf(c),
      requestId: c.get('requestId'),
      values: (body.values ?? {}) as Record<string, unknown>,
    })
    return c.json({ data: { received: true } }, 201)
  })

  app.put('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/options', async (c) => {
    const body = await c.req.json<{ options?: unknown }>()
    if (!Array.isArray(body.options)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'options' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const field = await options.kernel.resolveField(
      ctx,
      c.req.param('base'),
      c.req.param('table'),
      c.req.param('field'),
    )
    const result = await options.kernel.setSelectOptions(ctx, {
      fieldId: field.fieldId,
      options: body.options,
    })
    return c.json({
      data: { options: result.options, added: result.added, removed: result.removed },
      meta: { sql: result.sql },
    })
  })

  // An AI field: its prompt, its schedule, how it is doing (chapter 12 §9). Changing the
  // prompt is a fresh consent — `consent: true` again — and `recompute` starts over.
  app.get('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/ai', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const field = await options.kernel.resolveField(
      ctx,
      c.req.param('base'),
      c.req.param('table'),
      c.req.param('field'),
    )
    return c.json({ data: aiStatusJson(await options.kernel.aiFieldStatus(ctx, field.fieldId)) })
  })

  app.put('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/ai', async (c) => {
    const body = await c.req.json<{ recompute?: unknown }>()
    const input = aiInputOf(body)
    if (body.recompute !== undefined && typeof body.recompute !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'recompute' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const field = await options.kernel.resolveField(
      ctx,
      c.req.param('base'),
      c.req.param('table'),
      c.req.param('field'),
    )
    const status = await options.kernel.setAiField(ctx, {
      fieldId: field.fieldId,
      input,
      recompute: body.recompute === true,
    })
    return c.json({ data: aiStatusJson(status) })
  })

  // The AI option switched off: the field is an ordinary one again, its values kept.
  app.delete('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/ai', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const field = await options.kernel.resolveField(
      ctx,
      c.req.param('base'),
      c.req.param('table'),
      c.req.param('field'),
    )
    await options.kernel.disableAiField(ctx, field.fieldId)
    return c.body(null, 204)
  })

  // One row now — `record` given, the value is returned — or every row, by the worker.
  app.post('/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/ai/run', async (c) => {
    const body = await c.req.json<{ record?: unknown }>().catch(() => ({ record: undefined }))
    if (body.record !== undefined && typeof body.record !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'record' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const field = await options.kernel.resolveField(
      ctx,
      c.req.param('base'),
      c.req.param('table'),
      c.req.param('field'),
    )
    if (body.record === undefined) {
      await options.kernel.requestAiSweep(ctx, field.fieldId)
      return c.json({ data: { scheduled: true } }, 202)
    }
    const result = await options.kernel.runAiCell(ctx, providerTransport, {
      fieldId: field.fieldId,
      recordId: body.record,
    })
    return c.json({ data: { record: body.record, value: result.value } })
  })

  // The next runs of a schedule as a person builds it — nothing read, nothing written.
  app.post('/api/v1/:tenantRef/ai/schedule/preview', async (c) => {
    const body = await c.req.json<{ cron?: unknown; timezone?: unknown }>()
    if (typeof body.cron !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'cron' } })
    }
    if (body.timezone !== undefined && typeof body.timezone !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'timezone' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const preview = options.kernel.previewSchedule(ctx, {
      cron: body.cron,
      timezone: body.timezone ?? 'UTC',
    })
    return c.json({ data: { runs: preview.runs } })
  })

  // The obligation, in the four steps of §1.3 — which is why it has a route of its own.
  app.post(
    '/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/required',
    async (c) => {
      const body = await c.req.json<{ required?: boolean }>()
      const ctx = await contextFor(c, await bearer(c))
      const field = await options.kernel.resolveField(
        ctx,
        c.req.param('base'),
        c.req.param('table'),
        c.req.param('field'),
      )
      const result = await options.kernel.setFieldRequired(ctx, {
        fieldId: field.fieldId,
        required: body.required !== false,
      })
      return c.json({ data: { required: result.required }, meta: { sql: result.sql } })
    },
  )

  // ---------------------------------------------------------------------------------
  // /admin/tokens — integration tokens, chapter 08 §11. SESSION ONLY: the access token
  // these routes accept is minted from a session, never an integration token, so a
  // leaked token can neither mint another nor outlive its own revocation. Creating and
  // revoking demand an elevated session, which the kernel checks on the session itself.
  // ---------------------------------------------------------------------------------

  const serializeToken = (t: {
    id: string
    label: string
    prefix: string
    baseId: string | null
    access: string
    surfaces: readonly string[]
    createdAt: string
    expiresAt: string | null
    lastUsedAt: string | null
    revokedAt: string | null
    suspendedAt: string | null
  }) => ({
    id: t.id,
    label: t.label,
    prefix: t.prefix,
    base_id: t.baseId,
    access: t.access,
    surfaces: t.surfaces,
    created_at: t.createdAt,
    expires_at: t.expiresAt,
    last_used_at: t.lastUsedAt,
    revoked_at: t.revokedAt,
    suspended_at: t.suspendedAt,
  })

  app.get('/api/v1/:tenantRef/admin/tokens', async (c) => {
    const baseRef = c.req.query('base')
    if (baseRef === undefined || baseRef === '') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'base' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, baseRef)
    const tokens = await options.kernel.listApiTokens(ctx, { baseId: base.baseId })
    return c.json({ data: tokens.map(serializeToken) })
  })

  app.post('/api/v1/:tenantRef/admin/tokens', async (c) => {
    const body = await c.req.json<{
      label?: unknown
      base?: unknown
      access?: unknown
      surfaces?: unknown
      expires_in_days?: unknown
    }>()
    if (typeof body.base !== 'string' || body.base === '') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'base' } })
    }
    // Absent or `null`: no expiry. Anything else must be a number of days — a `"90"` sent
    // as text must not quietly become a token that never expires.
    const lifetime = body.expires_in_days
    if (lifetime !== undefined && lifetime !== null && typeof lifetime !== 'number') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'expires_in_days' } })
    }
    const who = await bearerWho(c)
    const ctx = await contextFor(c, who.userId)
    const base = await options.kernel.resolveBase(ctx, body.base)
    const issued = await options.kernel.createApiToken(ctx, {
      label: typeof body.label === 'string' ? body.label : '',
      baseId: base.baseId,
      // Checked by the kernel, which refuses anything but `read` and `write`, and any
      // surface but `rest` and `mcp`. Absent: both doors — the API for a program, MCP
      // for an agent — since one base's integration usually wants both.
      access: body.access as 'read' | 'write',
      surfaces: Array.isArray(body.surfaces)
        ? (body.surfaces as ('rest' | 'mcp')[])
        : ['rest', 'mcp'],
      expiresInDays: lifetime ?? null,
      sessionId: who.sessionId,
    })
    // The secret is in this response and nowhere else, ever.
    return c.json({ data: { ...serializeToken(issued), secret: issued.secret } }, 201)
  })

  // ---------------------------------------------------------------------------------
  // /admin/webhooks — chapter 08 §10. Like tokens: `manage_tokens` on the base, a session
  // elevated minutes ago for every change, and the secret shown once.
  // ---------------------------------------------------------------------------------

  type WebhookSummary = Awaited<ReturnType<typeof options.kernel.listWebhooks>>[number]

  const serializeWebhook = (w: WebhookSummary) => ({
    id: w.id,
    label: w.label,
    url: w.url,
    active: w.active,
    disabled_reason: w.disabledReason,
    created_at: w.createdAt,
    subscriptions: w.subscriptions.map((s) => ({
      table: s.tableName,
      table_label: s.tableLabel,
      events: s.events,
    })),
    last_delivery:
      w.lastDelivery === null
        ? null
        : {
            status: w.lastDelivery.status,
            at: w.lastDelivery.at,
            response_code: w.lastDelivery.responseCode,
          },
  })

  app.get('/api/v1/:tenantRef/admin/webhooks', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.query('base') ?? '')
    const hooks = await options.kernel.listWebhooks(ctx, { baseId: base.baseId })
    return c.json({ data: hooks.map(serializeWebhook) })
  })

  app.post('/api/v1/:tenantRef/admin/webhooks', async (c) => {
    const body = await c.req.json<{
      base?: unknown
      label?: unknown
      url?: unknown
      subscriptions?: unknown
    }>()
    if (typeof body.base !== 'string' || !Array.isArray(body.subscriptions)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'base, subscriptions' } })
    }
    const { ctx, sessionId } = await administering(c)
    const base = await options.kernel.resolveBase(ctx, body.base)
    const subscriptions = []
    for (const s of body.subscriptions as Array<{ table?: unknown; events?: unknown }>) {
      if (typeof s?.table !== 'string' || !Array.isArray(s.events)) {
        throw new BasedbError('REQUEST_INVALID', { details: { field: 'subscriptions' } })
      }
      const table = await options.kernel.resolveTable(ctx, body.base, s.table)
      subscriptions.push({
        tableId: table.tableId,
        events: s.events as ('create' | 'update' | 'delete')[],
      })
    }
    const created = await options.kernel.createWebhook(ctx, {
      baseId: base.baseId,
      label: typeof body.label === 'string' ? body.label : '',
      url: typeof body.url === 'string' ? body.url : '',
      subscriptions,
      sessionId,
    })
    // The secret is in this response and nowhere else, ever.
    return c.json({ data: { ...serializeWebhook(created.webhook), secret: created.secret } }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/webhooks/:id', async (c) => {
    const body = await c.req.json<{ active?: unknown }>()
    if (typeof body.active !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'active' } })
    }
    const { ctx, sessionId } = await administering(c)
    const hook = await options.kernel.setWebhookActive(ctx, {
      webhookId: c.req.param('id'),
      active: body.active,
      sessionId,
    })
    return c.json({ data: serializeWebhook(hook) })
  })

  app.delete('/api/v1/:tenantRef/admin/webhooks/:id', async (c) => {
    const { ctx, sessionId } = await administering(c)
    await options.kernel.deleteWebhook(ctx, { webhookId: c.req.param('id'), sessionId })
    return c.body(null, 204)
  })

  app.get('/api/v1/:tenantRef/admin/webhooks/:id/deliveries', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const deliveries = await options.kernel.listDeliveries(ctx, { webhookId: c.req.param('id') })
    return c.json({
      data: deliveries.map((d) => ({
        id: d.id,
        created_at: d.createdAt,
        status: d.status,
        attempts: d.attempts,
        next_attempt_at: d.nextAttemptAt,
        delivered_at: d.deliveredAt,
        response_code: d.responseCode,
        error_code: d.errorCode,
        table_label: d.tableLabel,
        record_id: d.recordId,
        op: d.op,
      })),
    })
  })

  // ---------------------------------------------------------------------------------
  // /admin/proposals — chapter 09 §7. The review queue of a base: what agents proposed,
  // for a person who manages its structure to approve or refuse. A person's session only:
  // a token never decides on a proposal, its own or another's.
  // ---------------------------------------------------------------------------------

  type ProposalSummary = Awaited<ReturnType<typeof options.kernel.listProposals>>[number]

  const serializeProposal = (p: ProposalSummary) => ({
    id: p.id,
    status: p.status,
    base: p.base,
    requested_at: p.requestedAt,
    expires_at: p.expiresAt,
    requested_by: p.requestedBy,
    token: p.token,
    summary_template: p.summaryTemplate,
    summary_params: p.summaryParams,
    affected_objects: p.affectedObjects,
    up_sql: p.upSql,
    down_sql: p.downSql,
    decided_by: p.decidedBy,
    decided_at: p.decidedAt,
    error: p.error,
  })

  app.get('/api/v1/:tenantRef/admin/proposals', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.query('base') ?? '')
    const proposals = await options.kernel.listProposals(ctx, { baseId: base.baseId })
    return c.json({ data: proposals.map(serializeProposal) })
  })

  app.post('/api/v1/:tenantRef/admin/proposals/:id/approve', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const proposal = await options.kernel.approveProposal(ctx, { proposalId: c.req.param('id') })
    return c.json({ data: serializeProposal(proposal) })
  })

  app.post('/api/v1/:tenantRef/admin/proposals/:id/reject', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const proposal = await options.kernel.rejectProposal(ctx, { proposalId: c.req.param('id') })
    return c.json({ data: serializeProposal(proposal) })
  })

  app.delete('/api/v1/:tenantRef/admin/tokens/:id', async (c) => {
    const who = await bearerWho(c)
    const ctx = await contextFor(c, who.userId)
    await options.kernel.revokeApiToken(ctx, {
      tokenId: c.req.param('id'),
      sessionId: who.sessionId,
    })
    return c.body(null, 204)
  })

  // The display column: what is shown instead of a UUID in a link cell. A null
  // designation is a valid state — the table remains a legitimate target.
  app.post('/api/v1/:tenantRef/admin/bases/:base/tables/:table/display', async (c) => {
    const body = await c.req.json<{ actor?: string; field?: string | null }>()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    // By name like everything else; `null` withdraws the designation, which is a valid
    // state — the table stays a legitimate link target, its cells show identifiers.
    const field =
      body.field === null || body.field === undefined
        ? null
        : await options.kernel.resolveField(
            ctx,
            c.req.param('base'),
            c.req.param('table'),
            body.field,
          )
    const designated = await options.kernel.setDisplayColumn(ctx, {
      tableId: table.tableId,
      fieldId: field?.fieldId ?? null,
    })
    return c.json({ data: { field: designated.fieldId, name: designated.name } })
  })

  return app
}

/**
 * A migration, as the API publishes it.
 *
 * `failed_statement` is included, `pg_message` is NOT. The statement is ours — we
 * emitted it, and showing it is how someone understands which step broke. The
 * PostgreSQL message belongs to the operator reading `_basedb.migration`, and chapter 05
 * forbids it crossing the enforcement point on any surface.
 */
function serializeMigration(m: Migration): Record<string, unknown> {
  return {
    id: m.id,
    sequence: m.sequence,
    label: m.label,
    origin: m.origin,
    status: m.status,
    step: m.step,
    step_count: m.stepCount,
    step_label: m.stepLabel,
    error_code: m.errorCode,
    failed_statement: m.failedStatement,
    requested_at: m.requestedAt,
    finished_at: m.finishedAt,
    duration_ms: m.durationMs,
  }
}

/** The look of a base or a table, as a body carries it: three keys, each optional. */
/**
 * The prompt, the schedule and the consent of an AI field, as a body carries them:
 * `{ prompt, refresh: { mode, cron?, timezone? }, consent }`. A wrong type is refused by
 * name; what the values MEAN is the kernel's to check.
 */
function aiInputOf(raw: unknown): AiFieldInput {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const refresh = (
    typeof body.refresh === 'object' && body.refresh !== null ? body.refresh : {}
  ) as Record<string, unknown>
  if (typeof body.prompt !== 'string') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'prompt' } })
  }
  if (refresh.mode !== 'if_empty' && refresh.mode !== 'schedule') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'refresh.mode' } })
  }
  for (const key of ['cron', 'timezone'] as const) {
    const value = refresh[key]
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: `refresh.${key}` } })
    }
  }
  if (body.consent !== undefined && typeof body.consent !== 'boolean') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'consent' } })
  }
  return {
    prompt: body.prompt,
    refresh: {
      mode: refresh.mode,
      cron: (refresh.cron as string | null | undefined) ?? null,
      timezone: (refresh.timezone as string | null | undefined) ?? null,
    },
    consent: body.consent === true,
  }
}

/** An AI field's status in the API's spelling. */
function aiStatusJson(status: AiFieldStatus) {
  return {
    prompt: status.prompt,
    cited: status.cited,
    refresh: status.refresh,
    next_sweep_at: status.nextSweepAt,
    sweeping: status.sweeping,
    last_run_at: status.lastRunAt,
    last_error: status.lastError,
    last_error_at: status.lastErrorAt,
    computed_count: status.computedCount,
    consented_at: status.consentedAt,
  }
}

interface LookBody {
  readonly color?: unknown
  readonly icon?: unknown
  readonly image?: unknown
}

/**
 * The look a body asks for, or `undefined` when it names none of its keys. A key given
 * something else than a string or `null` is refused by name rather than dropped.
 */
function lookOf(
  body: LookBody,
): { color?: string | null; icon?: string | null; image?: string | null } | undefined {
  const keys = ['color', 'icon', 'image'] as const
  if (keys.every((k) => body[k] === undefined)) return undefined
  const out: { color?: string | null; icon?: string | null; image?: string | null } = {}
  for (const key of keys) {
    const value = body[key]
    if (value === undefined) continue
    if (value !== null && typeof value !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: key } })
    }
    out[key] = value
  }
  return out
}

/**
 * `Content-Disposition` with the file's own name — RFC 6266.
 *
 * Twice: `filename*` carries the name as typed, accents and all, for every current
 * browser; `filename` an ASCII stand-in for the rest. The quote and the backslash are
 * replaced in the stand-in, since either would end the header's quoted string early.
 */
function disposition(kind: 'inline' | 'attachment', name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

export { isErrorCode }
