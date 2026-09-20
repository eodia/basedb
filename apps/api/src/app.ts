import { ERROR_CODES, isErrorCode } from '@basedb/contracts'
import {
  BasedbError,
  CACHE_CONTROL,
  CSRF_COOKIE,
  CSRF_HEADER,
  type Kernel,
  type MetaKind,
  type Migration,
  OIDC_COOKIE,
  type RequestContext,
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE,
  VARY,
} from '@basedb/core'
import { type Context, Hono } from 'hono'
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
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
  const bearer = async (c: { req: { header: (k: string) => string | undefined } }) => {
    const header = c.req.header('authorization')
    const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined
    const who = await options.kernel.authenticateAccessToken(token)
    return who.userId
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
    const ctx = await contextFor(c, await bearer(c))
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
    const ctx = await contextFor(c, await bearer(c))
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

  app.post('/api/v1/:tenantRef/data/:base/:table', async (c) => {
    const body = await c.req.json<{ actor?: string; values?: Record<string, unknown> }>()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const created = await options.kernel.createRecord(ctx, {
      tableId: table.tableId,
      values: body.values ?? {},
    })
    return c.json({ data: created.row }, 201)
  })

  app.patch('/api/v1/:tenantRef/data/:base/:table/:id', async (c) => {
    const body = await c.req.json<{ actor?: string; values?: Record<string, unknown> }>()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const updated = await options.kernel.updateRecord(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
      values: body.values ?? {},
    })
    return c.json({ data: updated.row })
  })

  app.delete('/api/v1/:tenantRef/data/:base/:table/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
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
    const ctx = await contextFor(c, await bearer(c))
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
  // /admin — product operations
  //
  // Chapter 08 §1.4 does not give schema editing a route in the v1 plan; it does fix
  // that `/admin/` is the product namespace. These four therefore live there, and will
  // move under whatever path the chapter that specifies them chooses.
  // ---------------------------------------------------------------------------------

  app.post('/api/v1/:tenantRef/admin/bases', async (c) => {
    const body = await c.req.json<{ label?: string; actor?: string }>()
    if (typeof body.label !== 'string' || body.label.trim() === '') {
      throw new BasedbError('LABEL_EMPTY')
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.createBase(ctx, { label: body.label })
    return c.json({ data: { id: base.baseId, name: base.schemaName } }, 201)
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

  // Renaming a LABEL — chapter 06 §1.1. One catalog row, no DDL, no migration; the
  // physical schema name does not move, so nothing an SQL consumer wrote breaks.
  app.patch('/api/v1/:tenantRef/admin/bases/:base', async (c) => {
    const body = await c.req.json<{ label?: string }>()
    if (typeof body.label !== 'string' || body.label.trim() === '') {
      throw new BasedbError('LABEL_EMPTY')
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const result = await options.kernel.renameBase(ctx, {
      baseId: base.baseId,
      label: body.label,
    })
    return c.json({ data: { id: base.baseId, name: base.baseName, label: result.label } })
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
      actor?: string
      fields?: ReadonlyArray<{ label: string; kind: string; required?: boolean }>
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
      fields: (body.fields ?? []) as never,
    })
    return c.json(
      {
        data: {
          id: table.tableId,
          name: table.tableName,
          base: table.schemaName,
          sql: table.qualifiedName,
          fields: table.fields.map((f) => ({
            id: f.fieldId,
            label: f.label,
            name: f.name,
            kind: f.kind,
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
      required: body.required,
      onDelete: body.on_delete,
    })

    return c.json(
      {
        data: {
          id: link.fieldId,
          label: link.label,
          name: link.name,
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
      kind?: string
      options?: Array<{ value: string; label?: string }>
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
      kind: body.kind as never,
      options: body.options,
    })

    return c.json(
      {
        data: {
          id: field.fieldId,
          name: field.name,
          label: field.label,
          kind: field.kind,
          required: false,
        },
        meta: { sql: field.sql },
      },
      201,
    )
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

export { isErrorCode }
