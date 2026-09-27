import {
  ERROR_CODES,
  acceptedLanguages,
  isErrorCode,
  isLocale,
  matchLocale,
} from '@basedb/contracts'
import {
  type AiFieldInput,
  type AiFieldStatus,
  type Automation,
  type AutomationRun,
  BasedbError,
  CACHE_CONTROL,
  CSRF_COOKIE,
  CSRF_HEADER,
  type Comment,
  type Dashboard,
  type DashboardSharing,
  type FormSharing,
  type Integration,
  type Kernel,
  type MetaKind,
  type Migration,
  OIDC_COOKIE,
  type PendingInvitation,
  type PointerAt,
  type Question,
  type RequestContext,
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE,
  type SavedQuery,
  type SavedView,
  type ScopeSharing,
  type ShareScope,
  type ShareSettings,
  type SqlConsoleResult,
  type SqlView,
  type SyncedTable,
  VARY,
  wireSteps,
} from '@basedb/core'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
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
   * Set ONLY in development (`BASEDB_DEV_LOGIN=1`, which `pnpm start` sets) and by the
   * start that has just bootstrapped the instance, and it publishes the ADDRESS alone —
   * never the password. Without this option the route does not exist: not an access
   * check but an absence, there is nothing to reach.
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

/**
 * The language of the screen a request comes from — chapter 11 §10: the one the interface
 * sends (`x-basedb-locale`), else the browser's `Accept-Language`. What a copilot answers
 * in, and what the labels it proposes are written in.
 */
function screenLanguage(c: { req: { header: (name: string) => string | undefined } }): string {
  const sent = c.req.header('x-basedb-locale')
  if (isLocale(sent)) return sent
  return matchLocale(acceptedLanguages(c.req.header('accept-language')))
}

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
      allowHeaders: [
        'content-type',
        'x-request-id',
        'authorization',
        'x-basedb-csrf',
        'x-basedb-locale',
      ],
      exposeHeaders: ['x-request-id', 'x-basedb-transaction'],
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

  /**
   * The cookie's holder, as an actor acting on their own account — with the session the
   * request came from, which elevation is checked on.
   */
  const accountHolder = async (c: Context<{ Variables: Variables }, string>) => {
    const who = await cookieHolder(c)
    const ctx = await options.kernel.openContext({
      userId: who.userId,
      requestId: c.get('requestId'),
      surface: 'rest',
    })
    return { who, ctx }
  }

  /** Liveness probe — entry point outside the catalog (chapter 08 §1.5). */
  app.get('/healthz', (c) => c.json({ status: 'ok' }))

  // In development the interface asks here for the bootstrap actor, instead of requiring
  // it to be copied from the server's output. The route is MOUNTED only then: in
  // production the URL does not exist and returns 404 like any other unknown URL.
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

  const serializeMe = (me: Awaited<ReturnType<typeof options.kernel.whoAmI>>) => ({
    id: me.id,
    email: me.email,
    display_name: me.displayName,
    tenant: me.tenantRef,
    is_instance_admin: me.isInstanceAdmin,
    is_admin: me.isAdmin,
    must_change_password: me.mustChangePassword,
    elevated_until: me.elevatedUntil,
    has_password: me.hasPassword,
    date_format: me.dateFormat,
    week_start: me.weekStart,
    muted_notifications: me.mutedNotifications,
    locale: me.locale,
  })

  // Accepts either credential: the interface calls it with the cookie right after
  // login, an integration with its access token.
  app.get('/auth/me', async (c) => {
    const header = c.req.header('authorization')
    const who =
      header?.toLowerCase().startsWith('bearer ') === true
        ? await options.kernel.authenticateAccessToken(header.slice(7).trim())
        : await cookieHolder(c)

    return c.json({ data: serializeMe(await options.kernel.whoAmI(who)) })
  })

  // One's own account — chapter 11 §10: the name, and how the product reads. Each field
  // optional; the answer is the account as it now stands.
  app.patch('/auth/me', async (c) => {
    type Body = {
      display_name?: unknown
      date_format?: unknown
      week_start?: unknown
      muted_notifications?: unknown
      locale?: unknown
    }
    const body = await c.req.json<Body>().catch(() => ({}) as Body)
    const { who, ctx } = await accountHolder(c)
    await options.kernel.updateProfile(ctx, {
      displayName: body.display_name,
      dateFormat: body.date_format,
      weekStart: body.week_start,
      mutedNotifications: body.muted_notifications,
      // `null` is a choice — the browser's language —, an absent key none.
      locale: body.locale,
    })
    return c.json({ data: serializeMe(await options.kernel.whoAmI(who)) })
  })

  // The address one signs in with — chapter 13 §2.6. An elevated session, a password.
  app.put('/auth/me/email', async (c) => {
    const body = await c.req.json<{ email?: unknown }>().catch(() => ({}) as { email?: unknown })
    const { who, ctx } = await accountHolder(c)
    await options.kernel.changeEmail(ctx, {
      email: body.email,
      sessionId: who.sessionId,
      acceptLanguage: c.req.header('accept-language') ?? null,
    })
    return c.json({ data: serializeMe(await options.kernel.whoAmI(who)) })
  })

  // The ways in to one's account: whether it has a password, and each provider this
  // instance accepts, linked or not — a provider linked once and withdrawn since shows
  // too, under its bare name, so it can still be unlinked.
  app.get('/auth/identities', async (c) => {
    const who = await cookieHolder(c)
    const [identities, providers] = await Promise.all([
      options.kernel.listOwnIdentities(who),
      options.kernel.oidcProviders(who.tenantRef),
    ])
    const linked = new Map(identities.map((i) => [i.provider, i]))
    const listed = new Set(providers.map((p) => p.slug))
    const shown = [
      ...providers,
      ...identities
        .filter((i) => i.provider !== 'password' && !listed.has(i.provider))
        .map((i) => ({ slug: i.provider, label: i.provider })),
    ]
    return c.json({
      data: {
        password: linked.has('password'),
        providers: shown.map((p) => ({
          slug: p.slug,
          label: p.label,
          linked_at: linked.get(p.slug)?.createdAt ?? null,
          last_used_at: linked.get(p.slug)?.lastUsedAt ?? null,
        })),
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
      await options.kernel.requestPasswordReset(body.email, c.req.header('accept-language') ?? null)
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
    let completed: Awaited<ReturnType<typeof options.kernel.oidcCallback>>
    try {
      completed = await options.kernel.oidcCallback({
        tenantRef: authTenant(),
        slug,
        code: c.req.query('code'),
        state: c.req.query('state'),
        cookie: getCookie(c, OIDC_COOKIE),
        ip: addressOf(c),
        userAgent: c.req.header('user-agent') ?? null,
        requestId: c.get('requestId'),
      })
    } catch (error) {
      // The browser came back from the provider, on a page of its own: a refusal is shown
      // by the interface, in words, not as a JSON body on a blank page — by the sign-in
      // screen, or by the settings when a link was being made. The code and its reason
      // alone travel; an incident keeps its identifier in the log.
      if (!(error instanceof BasedbError) || error.class === 'incident') throw error
      deleteCookie(c, OIDC_COOKIE, { path: '/', secure: true })
      const reason = error.details?.reason
      const suffix = typeof reason === 'string' ? `&raison=${encodeURIComponent(reason)}` : ''
      return c.redirect(`/?connexion=${encodeURIComponent(error.code)}${suffix}`, 302)
    }

    // The exchange is over: its cookie has nothing left to carry. A link opens no
    // session — the one that asked for it is still there.
    deleteCookie(c, OIDC_COOKIE, { path: '/', secure: true })
    if (completed.kind === 'session') {
      plantSession(c, completed.session.sessionToken, completed.session.csrfToken)
    }
    return c.redirect(completed.returnTo, 302)
  })

  // Linking happens from a session that is ALREADY open and elevated — never the other
  // way round. Adopting an account because a provider claims its address would turn
  // every OIDC login into a takeover.
  //
  // A fetch, not a navigation, so that a missing elevation comes back as a code the
  // interface answers by asking for the password. It plants the exchange cookie and
  // hands back where to send the browser; the provider's return completes the link on
  // `/callback`, which opens no session.
  app.post('/auth/oidc/:slug/link', async (c) => {
    const body = await c.req
      .json<{ return_to?: unknown }>()
      .catch(() => ({}) as { return_to?: unknown })
    const slug = c.req.param('slug')
    const { who, ctx } = await accountHolder(c)
    const started = await options.kernel.oidcLinkStart(ctx, {
      sessionId: who.sessionId,
      slug,
      redirectUri: redirectUri(c, slug),
      returnTo: typeof body.return_to === 'string' ? body.return_to : undefined,
    })
    plantExchange(c, started.exchangeCookie)
    return c.json({ data: { url: started.authorizeUrl } })
  })

  app.delete('/auth/oidc/:slug/link', async (c) => {
    const { who, ctx } = await accountHolder(c)
    await options.kernel.oidcUnlink(ctx, { sessionId: who.sessionId, slug: c.req.param('slug') })
    return c.body(null, 204)
  })

  // ---------------------------------------------------------------------------------
  // /auth/signup — chapter 13 §8: one's own account
  // ---------------------------------------------------------------------------------

  // Whether anyone may create an account here, and with which addresses. Closed, `404`:
  // the sign-in screen then offers nothing but signing in.
  app.get('/auth/signup', async (c) => {
    const policy = await options.kernel.signupPolicy(authTenant())
    if (!policy.open) throw new BasedbError('RESOURCE_NOT_FOUND')
    return c.json({ data: policy })
  })

  app.post('/auth/signup', async (c) => {
    const address = bounded(c)
    type Body = {
      email?: unknown
      display_name?: unknown
      password?: unknown
      invitation?: unknown
    }
    const body = await c.req.json<Body>().catch(() => ({}) as Body)
    const session = await options.kernel.signUp({
      tenantRef: authTenant(),
      email: typeof body.email === 'string' ? body.email : '',
      displayName: typeof body.display_name === 'string' ? body.display_name : '',
      password: typeof body.password === 'string' ? body.password : '',
      invitation: typeof body.invitation === 'string' ? body.invitation : undefined,
      requestId: c.get('requestId'),
      ip: address === 'inconnue' ? null : address,
      userAgent: c.req.header('user-agent') ?? null,
    })
    plantSession(c, session.sessionToken, session.csrfToken)
    return c.json({ data: { csrf: session.csrfToken, tenant: session.tenantRef } })
  })

  // What an invitation offers, for its link's page, before anyone signs in. The secret in
  // the body, not the URL; counted like every route without a bearer.
  app.post('/auth/invitation', async (c) => {
    bounded(c)
    const body = await c.req.json<{ token?: unknown }>().catch(() => ({}) as { token?: unknown })
    const preview = await options.kernel.invitationPreview(
      authTenant(),
      typeof body.token === 'string' ? body.token : '',
    )
    return c.json({
      data: {
        scope: preview.scope,
        project: preview.project,
        level: preview.level,
        email: preview.email,
        invited_by: preview.invitedBy,
        expires_at: preview.expiresAt,
      },
    })
  })

  // ---------------------------------------------------------------------------------
  // /auth/bootstrap — chapter 13 §7: the first administrator, created from the interface
  // ---------------------------------------------------------------------------------

  // Whether the instance still waits for its administrator. Once one exists, `404` like
  // any unknown URL: the bootstrap no longer exists.
  app.get('/auth/bootstrap', async (c) => {
    if (!(await options.kernel.bootstrapOpen())) throw new BasedbError('RESOURCE_NOT_FOUND')
    return c.json({ data: { open: true } })
  })

  // The first person here creates the administrator — their address, name and password —
  // and leaves signed in, as from a login.
  app.post('/auth/bootstrap', async (c) => {
    const address = bounded(c)
    const body = await c.req
      .json<{ email?: unknown; display_name?: unknown; password?: unknown }>()
      .catch(() => ({}) as { email?: unknown; display_name?: unknown; password?: unknown })
    const session = await options.kernel.bootstrapAdministrator({
      tenantRef: authTenant(),
      email: typeof body.email === 'string' ? body.email : '',
      displayName: typeof body.display_name === 'string' ? body.display_name : '',
      password: typeof body.password === 'string' ? body.password : '',
      requestId: c.get('requestId'),
      ip: address === 'inconnue' ? null : address,
      userAgent: c.req.header('user-agent') ?? null,
    })
    plantSession(c, session.sessionToken, session.csrfToken)
    return c.json({ data: { csrf: session.csrfToken, tenant: session.tenantRef } })
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
      // `variables=raw`: the citations of long texts as written — for an editor.
      variables: c.req.query('variables') === 'raw' ? 'raw' : 'resolve',
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

  // Aggregates over every row the filter keeps — a grid's summary bar, the counts of its
  // groups (chapter 11 §1.6). `aggregates=montant:sum,nom:filled`, `group=statut`. Declared
  // before `/:id`, whose pattern it would otherwise be.
  app.get('/api/v1/:tenantRef/data/:base/:table/aggregate', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const aggregates = (c.req.query('aggregates') ?? '')
      .split(',')
      .map((pair) => pair.trim())
      .filter((pair) => pair !== '')
      .map((pair) => {
        const cut = pair.lastIndexOf(':')
        if (cut <= 0)
          throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'aggregates' } })
        return { field: pair.slice(0, cut), fn: pair.slice(cut + 1) }
      })
    const result = await options.kernel.aggregateRecords(ctx, {
      tableId: table.tableId,
      filter: c.req.query('filter'),
      aggregates,
      groupBy: c.req.query('group') || undefined,
    })
    return c.json({
      data: {
        total: result.total,
        values: result.values,
        groups: result.groups,
        groups_capped: result.groupsCapped,
      },
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
      variables: c.req.query('variables') === 'raw' ? 'raw' : 'resolve',
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
    c.header('x-basedb-transaction', created.xact)
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
    c.header('x-basedb-transaction', created.xact)

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
    c.header('x-basedb-transaction', updated.xact)
    return c.json({ data: updated.row })
  })

  app.delete('/api/v1/:tenantRef/data/:base/:table/:id', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const deleted = await options.kernel.deleteRecord(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
    })
    c.header('x-basedb-transaction', deleted.xact)
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
  // Collaboration — chapter 16: undo, comments, notifications, the live stream, presence
  // ---------------------------------------------------------------------------------

  // ---------------------------------------------------------------------------------
  // Integrations and synced tables — chapter 19
  // ---------------------------------------------------------------------------------

  const serializeIntegration = (i: Integration) => ({
    id: i.id,
    kind: i.kind,
    label: i.label,
    hint: i.hint,
    created_at: i.createdAt,
  })
  const serializeSynced = (t: SyncedTable) => ({
    table_id: t.tableId,
    table: t.tableName,
    label: t.label,
    source_kind: t.sourceKind,
    host: t.host,
    interval_minutes: t.intervalMinutes,
    next_sync_at: t.nextSyncAt,
    last_synced_at: t.lastSyncedAt,
    last_status: t.lastStatus,
    last_error: t.lastError,
    last_counts: t.lastCounts,
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/integrations', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const list = await options.kernel.listIntegrations(ctx, { baseId: base.baseId })
    return c.json({ data: list.map(serializeIntegration) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/integrations', async (c) => {
    const body = await c.req.json<{ label?: unknown; url?: unknown }>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createIntegration(ctx, {
      baseId: base.baseId,
      label: body.label,
      url: body.url,
    })
    return c.json({ data: serializeIntegration(created) }, 201)
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/integrations/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.deleteIntegration(ctx, { baseId: base.baseId, id: c.req.param('id') })
    return c.body(null, 204)
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/integrations/:id/test', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const tested = await options.kernel.testIntegration(ctx, {
      baseId: base.baseId,
      id: c.req.param('id'),
    })
    return c.json({ data: tested })
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/synced-tables', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const list = await options.kernel.listSyncedTables(ctx, { baseId: base.baseId })
    return c.json({ data: list.map(serializeSynced) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/synced-tables', async (c) => {
    const body = await c.req.json<{
      label?: unknown
      source?: { kind?: unknown; url?: unknown }
      interval_minutes?: unknown
    }>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createSyncedTable(ctx, {
      baseId: base.baseId,
      label: body.label,
      source: body.source ?? {},
      intervalMinutes: body.interval_minutes,
    })
    return c.json({ data: serializeSynced(created) }, 201)
  })

  const syncedTableOf = async (c: Context<{ Variables: Variables }, string>) => {
    const ctx = await contextFor(c, await bearer(c))
    const baseRef = c.req.param('base') ?? ''
    const base = await options.kernel.resolveBase(ctx, baseRef)
    const table = await options.kernel.resolveTable(ctx, baseRef, c.req.param('table') ?? '')
    return { ctx, baseId: base.baseId, tableId: table.tableId }
  }

  app.patch('/api/v1/:tenantRef/admin/bases/:base/synced-tables/:table', async (c) => {
    const body = await c.req.json<{ interval_minutes?: unknown }>()
    const { ctx, baseId, tableId } = await syncedTableOf(c)
    const updated = await options.kernel.updateSyncedTable(ctx, {
      baseId,
      tableId,
      intervalMinutes: body.interval_minutes,
    })
    return c.json({ data: serializeSynced(updated) })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/synced-tables/:table', async (c) => {
    const { ctx, baseId, tableId } = await syncedTableOf(c)
    await options.kernel.stopSyncedTable(ctx, { baseId, tableId })
    return c.body(null, 204)
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/synced-tables/:table/run', async (c) => {
    const { ctx, baseId, tableId } = await syncedTableOf(c)
    const ran = await options.kernel.runSyncedTable(ctx, { baseId, tableId })
    return c.json({ data: serializeSynced(ran) })
  })

  // ---------------------------------------------------------------------------------
  // Dashboards — chapter 18
  // ---------------------------------------------------------------------------------

  // The tabs, cards and filters are documents of `@basedb/contracts`, in their own names.
  const serializeDashboard = (d: Dashboard) => ({
    id: d.id,
    label: d.label,
    description: d.description,
    position: d.position,
    tabs: d.tabs,
    cards: d.cards,
    parameters: d.parameters,
    updated_at: d.updatedAt,
  })

  const serializeQuestion = (q: Question) => ({
    id: q.id,
    label: q.label,
    description: q.description,
    kind: q.kind,
    query: q.query,
    visualization: q.visualization,
    position: q.position,
    updated_at: q.updatedAt,
    updated_by: q.updatedBy,
  })

  app.get('/api/v1/:tenantRef/meta/bases/:base/dashboards', async (c) => {
    const ctx = await dataContext(c)
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const list = await options.kernel.listDashboards(ctx, { baseId: base.baseId })
    return c.json({ data: list.map(serializeDashboard) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/dashboards', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createDashboard(ctx, { baseId: base.baseId, input: body })
    return c.json({ data: serializeDashboard(created) }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/bases/:base/dashboards/:id', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const updated = await options.kernel.updateDashboard(ctx, {
      baseId: base.baseId,
      id: c.req.param('id'),
      input: body,
    })
    return c.json({ data: serializeDashboard(updated) })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/dashboards/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.deleteDashboard(ctx, { baseId: base.baseId, id: c.req.param('id') })
    return c.body(null, 204)
  })

  // The sharing of a dashboard by a link — chapter 18 §2.5. Administered here by the base's
  // builders; read through `/api/v1/dashboards/:token`, below, which needs no right on it.
  const serializeDashboardSharing = (sharing: DashboardSharing) => ({
    share:
      sharing.share === null
        ? null
        : {
            id: sharing.share.id,
            dashboard_id: sharing.share.dashboardId,
            access: sharing.share.access,
            active: sharing.share.active,
            token: sharing.share.token,
            published_by: sharing.share.publishedBy,
            groups: sharing.share.groupIds,
            state: sharing.share.state,
            can_embed: sharing.share.canEmbed,
          },
    groups: sharing.groups,
  })

  const dashboardShareRoute = '/api/v1/:tenantRef/admin/bases/:base/dashboards/:id/share'

  app.get(dashboardShareRoute, async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const sharing = await options.kernel.getDashboardSharing(ctx, {
      baseId: base.baseId,
      dashboardId: c.req.param('id'),
    })
    return c.json({ data: serializeDashboardSharing(sharing) })
  })

  // Creates or changes the sharing: whoever saves becomes its publisher, and the cards read
  // on their authority from then on.
  app.put(dashboardShareRoute, async (c) => {
    const body = await c.req.json<{
      access?: unknown
      active?: unknown
      groups?: unknown
      can_embed?: unknown
    }>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const sharing = await options.kernel.saveDashboardSharing(ctx, {
      baseId: base.baseId,
      dashboardId: c.req.param('id'),
      access: body.access as 'public' | 'members',
      active: body.active === undefined ? true : (body.active as boolean),
      groupIds: (body.groups ?? []) as string[],
      canEmbed: (body.can_embed ?? false) as boolean,
    })
    return c.json({ data: serializeDashboardSharing(sharing) })
  })

  app.post(`${dashboardShareRoute}/regenerate`, async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const sharing = await options.kernel.regenerateDashboardShare(ctx, {
      baseId: base.baseId,
      dashboardId: c.req.param('id'),
    })
    return c.json({ data: serializeDashboardSharing(sharing) })
  })

  app.delete(dashboardShareRoute, async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.deleteDashboardShare(ctx, {
      baseId: base.baseId,
      dashboardId: c.req.param('id'),
    })
    return c.body(null, 204)
  })

  // Saved questions — chapter 18 §3. Seen by whoever sees the base, written by its builders.
  app.get('/api/v1/:tenantRef/meta/bases/:base/questions', async (c) => {
    const ctx = await dataContext(c)
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const list = await options.kernel.listQuestions(ctx, { baseId: base.baseId })
    return c.json({ data: list.map(serializeQuestion) })
  })

  app.get('/api/v1/:tenantRef/meta/bases/:base/questions/:id', async (c) => {
    const ctx = await dataContext(c)
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const question = await options.kernel.getQuestion(ctx, {
      baseId: base.baseId,
      id: c.req.param('id'),
    })
    return c.json({ data: serializeQuestion(question) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/questions', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createQuestion(ctx, { baseId: base.baseId, input: body })
    return c.json({ data: serializeQuestion(created) }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/bases/:base/questions/:id', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const updated = await options.kernel.updateQuestion(ctx, {
      baseId: base.baseId,
      id: c.req.param('id'),
      input: body,
    })
    return c.json({ data: serializeQuestion(updated) })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/questions/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.deleteQuestion(ctx, { baseId: base.baseId, id: c.req.param('id') })
    return c.body(null, 204)
  })

  // Runs a question — a saved one by `question`, or one given whole in `query` — with the
  // caller's rights, a dashboard's filters in `constraints`. Beside `/sql/:base` rather than
  // under `/data/:base`, where `query` would be a table's name.
  app.post('/api/v1/:tenantRef/query/:base', async (c) => {
    const body = await c.req.json<{
      question?: unknown
      query?: unknown
      constraints?: unknown
      timezone?: unknown
      week_start?: unknown
    }>()
    const ctx = await dataContext(c)
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    if (
      typeof body.question !== 'string' &&
      (typeof body.query !== 'object' || body.query === null)
    ) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'query' } })
    }
    const result = await options.kernel.runQuestion(ctx, {
      baseId: base.baseId,
      ...(typeof body.question === 'string' ? { question: body.question } : { query: body.query }),
      constraints: body.constraints,
      timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
      weekStart: body.week_start === 0 ? 0 : 1,
    })
    return c.json({ data: result })
  })

  // ---------------------------------------------------------------------------------
  // Automations — chapter 17
  // ---------------------------------------------------------------------------------

  const serializeAutomation = (a: Automation) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    enabled: a.enabled,
    trigger: {
      kind: a.trigger.kind,
      table: a.trigger.table,
      fields: a.trigger.fields,
      schedule: a.trigger.schedule,
    },
    condition: a.condition,
    // The flow's steps, branches and what they hold included (chapter 17 §1.3).
    actions: wireSteps(a.actions),
    owner: a.owner,
    next_run_at: a.nextRunAt,
    last_run: a.lastRun,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  })
  const serializeRun = (r: AutomationRun) => ({
    id: r.id,
    trigger: r.trigger,
    record_id: r.recordId,
    status: r.status,
    reason: r.reason,
    error_code: r.errorCode,
    steps: r.steps,
    queued_at: r.queuedAt,
    started_at: r.startedAt,
    finished_at: r.finishedAt,
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/automations', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const list = await options.kernel.listAutomations(ctx, { baseId: base.baseId })
    return c.json({ data: list.map(serializeAutomation) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/automations', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createAutomation(ctx, { baseId: base.baseId, input: body })
    return c.json({ data: serializeAutomation(created) }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/bases/:base/automations/:id', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const updated = await options.kernel.updateAutomation(ctx, {
      baseId: base.baseId,
      id: c.req.param('id'),
      input: body,
    })
    return c.json({ data: serializeAutomation(updated) })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/automations/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.deleteAutomation(ctx, { baseId: base.baseId, id: c.req.param('id') })
    return c.body(null, 204)
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/automations/:id/runs', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const runs = await options.kernel.listAutomationRuns(ctx, {
      baseId: base.baseId,
      id: c.req.param('id'),
    })
    return c.json({ data: runs.map(serializeRun) })
  })

  /** Ten clicks a minute per person: a button is not a way to flood a queue (§4). */
  const clicks = new RateLimiter(10, 60_000)

  app.post('/api/v1/:tenantRef/automations/:id/run', async (c) => {
    const body = await c.req.json<{ record?: unknown }>().catch(() => ({}) as { record?: unknown })
    const ctx = await dataContext(c)
    const verdict = clicks.check(ctx.actor.tokenId ?? ctx.actor.id, Date.now())
    if (!verdict.allowed) {
      c.header('retry-after', String(verdict.retryAfter))
      throw new BasedbError('RATE_LIMIT_EXCEEDED', { details: { retry_after: verdict.retryAfter } })
    }
    const queued = await options.kernel.requestAutomationRun(ctx, {
      automationId: c.req.param('id'),
      recordId: typeof body.record === 'string' ? body.record : null,
    })
    return c.json({ data: { run: queued.runId } }, 202)
  })

  /** Undoes a transaction of the caller's; the undo's own is what a redo names (§4). */
  app.post('/api/v1/:tenantRef/history/undo', async (c) => {
    const body = await c.req.json<{ transaction?: unknown }>().catch(() => ({}))
    const ctx = await dataContext(c)
    const undone = await options.kernel.undoTransaction(ctx, {
      transaction: String((body as { transaction?: unknown }).transaction ?? ''),
    })
    c.header('x-basedb-transaction', undone.transaction)
    return c.json({
      data: { transaction: undone.transaction, revisions: undone.revisions, tables: undone.tables },
    })
  })

  const serializeComment = (comment: Comment) => ({
    id: comment.id,
    record_id: comment.recordId,
    author: comment.author,
    body: comment.body,
    mentions: comment.mentions,
    created_at: comment.createdAt,
    edited_at: comment.editedAt,
    can_edit: comment.canEdit,
    can_delete: comment.canDelete,
  })

  app.get('/api/v1/:tenantRef/data/:base/:table/:id/comments', async (c) => {
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const comments = await options.kernel.listComments(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
    })
    return c.json({ data: comments.map(serializeComment) })
  })

  app.post('/api/v1/:tenantRef/data/:base/:table/:id/comments', async (c) => {
    const body = await c.req.json<{ body?: unknown }>()
    const ctx = await dataContext(c)
    const table = await options.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))
    const added = await options.kernel.addComment(ctx, {
      tableId: table.tableId,
      recordId: c.req.param('id'),
      body: body.body,
    })
    return c.json(
      { data: serializeComment(added.comment), meta: { unreachable: added.unreachable } },
      201,
    )
  })

  app.patch('/api/v1/:tenantRef/comments/:comment', async (c) => {
    const body = await c.req.json<{ body?: unknown }>()
    const ctx = await dataContext(c)
    const comment = await options.kernel.editComment(ctx, {
      commentId: c.req.param('comment'),
      body: body.body,
    })
    return c.json({ data: serializeComment(comment) })
  })

  app.delete('/api/v1/:tenantRef/comments/:comment', async (c) => {
    const ctx = await dataContext(c)
    await options.kernel.deleteComment(ctx, { commentId: c.req.param('comment') })
    return c.body(null, 204)
  })

  app.get('/api/v1/:tenantRef/me/notifications', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const page = await options.kernel.listNotifications(ctx, {
      unread: c.req.query('unread') === 'true',
      after: c.req.query('after'),
    })
    return c.json({
      data: page.notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        actor: n.actor,
        base: n.base,
        table: n.table,
        record_id: n.recordId,
        comment_id: n.commentId,
        excerpt: n.excerpt,
        created_at: n.createdAt,
        read_at: n.readAt,
        readable: n.readable,
      })),
      meta: { unread: page.unread, next_cursor: page.nextCursor },
    })
  })

  app.post('/api/v1/:tenantRef/me/notifications/read', async (c) => {
    const body = await c.req.json<{ ids?: unknown; all?: unknown }>()
    const ctx = await contextFor(c, await bearer(c))
    const marked = await options.kernel.markNotificationsRead(ctx, {
      ids: Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === 'string')
        : [],
      all: body.all === true,
    })
    return c.json({ data: { marked } })
  })

  /** Moves an open stream's presence to another row of its table (§3.3). */
  app.post('/api/v1/:tenantRef/presence', async (c) => {
    const body = await c.req.json<{
      session?: unknown
      base?: unknown
      table?: unknown
      record?: unknown
    }>()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(
      ctx,
      String(body.base ?? ''),
      String(body.table ?? ''),
    )
    await options.kernel.enterPresence(ctx, {
      session: String(body.session ?? ''),
      tableId: table.tableId,
      recordId: typeof body.record === 'string' ? body.record : null,
    })
    return c.body(null, 204)
  })

  /**
   * Moves an open stream's pointer over the grid (§3.4). A signal and nothing else; a
   * stream sending faster than every 40 ms has the extra dropped — the screen sends about
   * eight a second, and a pointer is only ever the latest one.
   */
  const pointerSeen = new Map<string, number>()
  app.post('/api/v1/:tenantRef/presence/pointer', async (c) => {
    const body = await c.req.json<{
      session?: unknown
      base?: unknown
      table?: unknown
      at?: unknown
    }>()
    const session = String(body.session ?? '')
    const now = Date.now()
    if (now - (pointerSeen.get(session) ?? 0) < 40) return c.body(null, 204)
    pointerSeen.set(session, now)
    if (pointerSeen.size > 10_000) pointerSeen.clear()
    const ctx = await contextFor(c, await bearer(c))
    const table = await options.kernel.resolveTable(
      ctx,
      String(body.base ?? ''),
      String(body.table ?? ''),
    )
    await options.kernel.movePointer(ctx, {
      session,
      tableId: table.tableId,
      at: typeof body.at === 'object' && body.at !== null ? (body.at as PointerAt) : null,
    })
    return c.body(null, 204)
  })

  /** Open live streams per actor — ten at most (§3.2). */
  const streams = new Map<string, number>()
  const STREAMS_PER_ACTOR = 10
  const STREAM_LIFETIME_MS = 30 * 60_000
  const STREAM_PING_MS = 20_000

  /**
   * The live stream — chapter 16 §3.2: signals, never values. The table is decided once,
   * at the opening; the browser then reads again what a signal names, by the ordinary
   * routes, under its own rights.
   */
  app.get('/api/v1/:tenantRef/events', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const baseRef = c.req.query('base')
    const tableRef = c.req.query('table')
    let tableId: string | null = null
    if (baseRef !== undefined && tableRef !== undefined && baseRef !== '' && tableRef !== '') {
      const table = await options.kernel.resolveTable(ctx, baseRef, tableRef)
      if (!(await options.kernel.canReadTable(ctx, table.tableId))) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: tableRef } })
      }
      tableId = table.tableId
    }
    const actor = ctx.actor.id
    const open = streams.get(actor) ?? 0
    if (open >= STREAMS_PER_ACTOR) {
      throw new BasedbError('RATE_LIMIT_EXCEEDED', { details: { streams: STREAMS_PER_ACTOR } })
    }
    streams.set(actor, open + 1)
    await options.kernel.live.start()
    const session = crypto.randomUUID()
    const record = c.req.query('record') ?? null
    // What this reader sees of the table: another's pointer over a column hidden from
    // them names no column, and shows nowhere.
    const readable =
      tableId === null ? new Set<string>() : await options.kernel.readableFieldNames(ctx, tableId)

    return streamSSE(c, async (stream) => {
      // One write at a time: signals may arrive while a previous event is still sending.
      let queue: Promise<unknown> = Promise.resolve()
      const send = (event: string, data: unknown) => {
        queue = queue
          .then(() => stream.writeSSE({ event, data: JSON.stringify(data) }))
          .catch(() => undefined)
        return queue
      }
      const unsubscribe = options.kernel.live.subscribe((signal) => {
        if (signal.kind === 'notifications') {
          if (signal.user === actor) void send('notifications', {})
          return
        }
        if (tableId === null || signal.table !== tableId) return
        if (signal.kind === 'records') {
          void send('records', {
            table: signal.table,
            ids: signal.ids,
            ops: signal.ops,
            actor: signal.actor,
          })
        } else if (signal.kind === 'comments') {
          void send('comments', { table: signal.table, record: signal.record })
        } else if (signal.kind === 'pointer') {
          if (signal.session === session) return
          const at = signal.at !== null && readable.has(signal.at.field) ? signal.at : null
          void send('pointer', {
            session: signal.session,
            user: signal.user,
            name: signal.name,
            at,
          })
        } else if (signal.kind === 'presence') {
          const table = signal.table
          void options.kernel.viewersOf(table).then((viewers) =>
            send('presence', {
              table,
              viewers: viewers.map((v) => ({ user: v.userId, name: v.name, record: v.recordId })),
            }),
          )
        }
      })
      await send('ready', { session })
      if (tableId !== null) {
        await options.kernel
          .enterPresence(ctx, { session, tableId, recordId: record })
          .catch(() => undefined)
      }
      const ping = setInterval(() => {
        void send('ping', {})
        if (tableId !== null) void options.kernel.refreshPresence([session]).catch(() => undefined)
      }, STREAM_PING_MS)
      await new Promise<void>((resolve) => {
        const end = setTimeout(resolve, STREAM_LIFETIME_MS)
        stream.onAbort(() => {
          clearTimeout(end)
          resolve()
        })
      })
      clearInterval(ping)
      unsubscribe()
      streams.set(actor, Math.max(0, (streams.get(actor) ?? 1) - 1))
      if (tableId !== null) await options.kernel.leavePresence(session).catch(() => undefined)
    })
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

  // The people of the tenant — what a `user` field names (chapter 04, « Personne »): its
  // column holds an identifier, and this is where a reader finds the name that goes with it.
  app.get('/api/v1/:tenantRef/meta/users', async (c) => {
    const ctx = await dataContext(c)
    const members = await options.kernel.listMembers(ctx)
    return c.json({
      data: members.map((m) => ({
        id: m.id,
        display_name: m.displayName,
        email: m.email,
        disabled: m.disabled,
      })),
    })
  })

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

  // Who may create an account (chapter 13 §8): the administrators set it, elevated.
  app.get('/api/v1/:tenantRef/admin/signup', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    return c.json({ data: await options.kernel.adminSignupPolicy(ctx) })
  })

  app.put('/api/v1/:tenantRef/admin/signup', async (c) => {
    const body = await c.req
      .json<{ open?: unknown; domains?: unknown }>()
      .catch(() => ({}) as { open?: unknown; domains?: unknown })
    const { ctx, sessionId } = await administering(c)
    const policy = await options.kernel.setSignupPolicy(ctx, {
      open: body.open as boolean,
      domains: body.domains as string[],
      sessionId,
    })
    return c.json({ data: policy })
  })

  // ---------------------------------------------------------------------------------
  // Sharing a project or a base — chapter 05 §15.8. Its managers, no elevation: the
  // everyday gesture of a team, bounded by what they manage.
  // ---------------------------------------------------------------------------------

  const shareScope = (c: Context<{ Variables: Variables }, string>): ShareScope => {
    const kind = c.req.param('kind')
    if (kind !== 'project' && kind !== 'base') {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { scope: kind } })
    }
    return { kind, id: c.req.param('id') ?? '' }
  }

  const serializeInvitation = (i: PendingInvitation) => ({
    id: i.id,
    email: i.email,
    level: i.level,
    expires_at: i.expiresAt,
    invited_by: i.invitedBy,
    token: i.token,
  })

  const serializeScopeSharing = (s: ScopeSharing) => ({
    scope: s.scope,
    people: s.people.map((p) => ({
      user_id: p.userId,
      display_name: p.displayName,
      email: p.email,
      level: p.level,
      from: p.from,
      you: p.you,
    })),
    groups: s.groups,
    invitations: s.invitations.map(serializeInvitation),
  })

  app.get('/api/v1/:tenantRef/sharing/:kind/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const sharing = await options.kernel.scopeSharing(ctx, { scope: shareScope(c) })
    return c.json({ data: serializeScopeSharing(sharing) })
  })

  app.post('/api/v1/:tenantRef/sharing/:kind/:id/invitations', async (c) => {
    const body = await c.req
      .json<{ email?: unknown; level?: unknown }>()
      .catch(() => ({}) as { email?: unknown; level?: unknown })
    const ctx = await contextFor(c, await bearer(c))
    const invitation = await options.kernel.inviteToScope(ctx, {
      scope: shareScope(c),
      email: typeof body.email === 'string' ? body.email : '',
      level: body.level as 'read' | 'edit' | 'manage',
    })
    return c.json({ data: serializeInvitation(invitation) }, 201)
  })

  app.put('/api/v1/:tenantRef/sharing/:kind/:id/people/:userId', async (c) => {
    const body = await c.req.json<{ level?: unknown }>().catch(() => ({}) as { level?: unknown })
    const ctx = await contextFor(c, await bearer(c))
    const sharing = await options.kernel.setPersonAccess(ctx, {
      scope: shareScope(c),
      userId: c.req.param('userId'),
      level: body.level as 'none' | 'read' | 'edit' | 'manage',
    })
    return c.json({ data: serializeScopeSharing(sharing) })
  })

  app.delete('/api/v1/:tenantRef/invitations/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    await options.kernel.revokeInvitation(ctx, { invitationId: c.req.param('id') })
    return c.body(null, 204)
  })

  // The link's secret travels in the body, not in the URL: request logs keep URLs.
  app.post('/api/v1/:tenantRef/invitations/accept', async (c) => {
    const body = await c.req.json<{ token?: unknown }>().catch(() => ({}) as { token?: unknown })
    const ctx = await contextFor(c, await bearer(c))
    const accepted = await options.kernel.acceptInvitation(ctx, {
      token: typeof body.token === 'string' ? body.token : '',
    })
    return c.json({ data: { project_id: accepted.projectId, base_id: accepted.baseId } })
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
    const body = await c.req.json<{ sql?: string; limit?: number; read_only?: boolean }>()
    if (typeof body.sql !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'sql' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const result = await options.kernel.runSql(ctx, {
      baseId: base.baseId,
      sql: body.sql,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      ...(body.read_only === true ? { readOnly: true } : {}),
    })
    return c.json({ data: serializeSqlResult(result) })
  })

  // ---------------------------------------------------------------------------------
  // Saved queries and SQL views — chapter 11 §1.7 and §1.8. A person's routes: a token
  // runs no SQL, and keeps no query.
  // ---------------------------------------------------------------------------------

  const serializeQuery = (q: SavedQuery) => ({
    id: q.id,
    label: q.label,
    description: q.description,
    statement: q.statement,
    audience: q.audience,
    groups: q.groups,
    owner: q.owner,
    mine: q.mine,
    editable: q.editable,
    updated_at: q.updatedAt,
  })

  /** A query's body, in the API's words: `group_ids` for the groups of a `groups` query. */
  const queryInput = (body: Record<string, unknown>) => ({
    ...(body.label === undefined ? {} : { label: body.label as string }),
    ...(body.description === undefined ? {} : { description: body.description as string | null }),
    ...(body.statement === undefined ? {} : { statement: body.statement as string }),
    ...(body.audience === undefined
      ? {}
      : { audience: body.audience as 'personal' | 'base' | 'groups' }),
    ...(Array.isArray(body.group_ids) ? { groupIds: body.group_ids as string[] } : {}),
  })

  app.get('/api/v1/:tenantRef/meta/bases/:base/queries', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const list = await options.kernel.listQueries(ctx, { baseId: base.baseId })
    return c.json({ data: list.map(serializeQuery) })
  })

  app.get('/api/v1/:tenantRef/meta/bases/:base/queries/:query', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const query = await options.kernel.getQuery(ctx, {
      baseId: base.baseId,
      queryId: c.req.param('query'),
    })
    return c.json({ data: serializeQuery(query) })
  })

  app.get('/api/v1/:tenantRef/admin/bases/:base/query-groups', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const groups = await options.kernel.listQueryGroups(ctx, { baseId: base.baseId })
    return c.json({ data: groups })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/queries', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createQuery(ctx, {
      baseId: base.baseId,
      input: queryInput(body),
    })
    return c.json({ data: serializeQuery(created) }, 201)
  })

  app.patch('/api/v1/:tenantRef/admin/bases/:base/queries/:query', async (c) => {
    const body = await c.req.json<Record<string, unknown>>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const updated = await options.kernel.updateQuery(ctx, {
      baseId: base.baseId,
      queryId: c.req.param('query'),
      input: queryInput(body),
    })
    return c.json({ data: serializeQuery(updated) })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/queries/:query', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.deleteQuery(ctx, { baseId: base.baseId, queryId: c.req.param('query') })
    return c.body(null, 204)
  })

  const serializeSqlView = (v: SqlView) => ({
    id: v.id,
    name: v.name,
    label: v.label,
    description: v.description,
    definition: v.definition,
    broken: v.broken,
    color: v.color,
    icon: v.icon,
    image: v.image,
    editable: v.editable,
    updated_at: v.updatedAt,
  })

  /** A SQL view's body: its look travels flat, as a table's does. */
  const sqlViewInput = (body: Record<string, unknown> & LookBody) => {
    const look = lookOf(body)
    return {
      ...(body.label === undefined ? {} : { label: body.label as string }),
      ...(body.name === undefined ? {} : { name: body.name as string }),
      ...(body.description === undefined ? {} : { description: body.description as string | null }),
      ...(body.definition === undefined ? {} : { definition: body.definition as string }),
      ...(look === undefined ? {} : { look }),
    }
  }

  app.get('/api/v1/:tenantRef/meta/bases/:base/sql-views', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const list = await options.kernel.listSqlViews(ctx, { baseId: base.baseId })
    return c.json({ data: list.map(serializeSqlView) })
  })

  app.get('/api/v1/:tenantRef/meta/bases/:base/sql-views/:view', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const view = await options.kernel.getSqlView(ctx, {
      baseId: base.baseId,
      viewId: c.req.param('view'),
    })
    return c.json({ data: serializeSqlView(view) })
  })

  // The rows of a view, read like a statement typed in the console — with the reader's
  // reach, never the author's.
  app.get('/api/v1/:tenantRef/sql/:base/views/:view', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const limit = Number.parseInt(c.req.query('limit') ?? '', 10)
    const result = await options.kernel.readSqlView(ctx, {
      baseId: base.baseId,
      viewId: c.req.param('view'),
      ...(Number.isFinite(limit) ? { limit } : {}),
    })
    return c.json({ data: serializeSqlResult(result) })
  })

  app.post('/api/v1/:tenantRef/admin/bases/:base/sql-views', async (c) => {
    const body = await c.req.json<Record<string, unknown> & LookBody>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const created = await options.kernel.createSqlView(ctx, {
      baseId: base.baseId,
      input: sqlViewInput(body),
    })
    return c.json({ data: serializeSqlView(created) }, 201)
  })

  // Before `:view`, or `order` would be taken for a view.
  app.put('/api/v1/:tenantRef/admin/bases/:base/sql-views/order', async (c) => {
    const body = await c.req.json<{ order?: unknown }>()
    if (!Array.isArray(body.order) || !body.order.every((id) => typeof id === 'string')) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'order' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.reorderSqlViews(ctx, { baseId: base.baseId, order: body.order })
    return c.body(null, 204)
  })

  app.patch('/api/v1/:tenantRef/admin/bases/:base/sql-views/:view', async (c) => {
    const body = await c.req.json<Record<string, unknown> & LookBody>()
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const updated = await options.kernel.updateSqlView(ctx, {
      baseId: base.baseId,
      viewId: c.req.param('view'),
      input: sqlViewInput(body),
    })
    return c.json({ data: serializeSqlView(updated) })
  })

  app.delete('/api/v1/:tenantRef/admin/bases/:base/sql-views/:view', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    await options.kernel.deleteSqlView(ctx, { baseId: base.baseId, viewId: c.req.param('view') })
    return c.body(null, 204)
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
      language: screenLanguage(c),
    })
    return c.json({ data: answer })
  })

  // The copilot of the dashboards — chapter 18 §2.6: the same conversation, about the
  // dashboards of a base. `dashboard`, `tab` and `values` say what is on screen; the kernel
  // answers with questions, changes and filter values, proposed, never applied.
  app.post('/api/v1/:tenantRef/ai/bases/:base/dashboard-copilot', async (c) => {
    const body = await c.req.json<{
      dashboard?: unknown
      tab?: unknown
      values?: unknown
      messages?: unknown
      read_data?: unknown
      timezone?: unknown
      week_start?: unknown
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
    for (const key of ['dashboard', 'tab', 'timezone'] as const) {
      const value = body[key]
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new BasedbError('REQUEST_INVALID', { details: { field: key } })
      }
    }
    if (
      body.values !== undefined &&
      body.values !== null &&
      (typeof body.values !== 'object' || Array.isArray(body.values))
    ) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'values' } })
    }
    if (body.read_data !== undefined && typeof body.read_data !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'read_data' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const answer = await options.kernel.dashboardCopilot(ctx, providerTransport, {
      baseId: base.baseId,
      dashboardId:
        typeof body.dashboard === 'string' && body.dashboard !== '' ? body.dashboard : null,
      tab: typeof body.tab === 'string' && body.tab !== '' ? body.tab : null,
      values: (body.values ?? {}) as Record<string, never>,
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      readData: body.read_data === true,
      ...(typeof body.timezone === 'string' ? { timezone: body.timezone } : {}),
      weekStart: body.week_start === 0 ? 0 : 1,
      language: screenLanguage(c),
    })
    return c.json({ data: answer })
  })

  // The copilot of the automations — chapter 17 §6: the same conversation, about the
  // automations of a base. `automation` names the one on screen, `draft` is what its editor
  // shows; the kernel answers with automations proposed whole, never saved.
  app.post('/api/v1/:tenantRef/ai/bases/:base/automation-copilot', async (c) => {
    const body = await c.req.json<{
      automation?: unknown
      draft?: unknown
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
    if (
      body.automation !== undefined &&
      body.automation !== null &&
      typeof body.automation !== 'string'
    ) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'automation' } })
    }
    if (
      body.draft !== undefined &&
      body.draft !== null &&
      (typeof body.draft !== 'object' || Array.isArray(body.draft))
    ) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'draft' } })
    }
    if (body.read_data !== undefined && typeof body.read_data !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'read_data' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const base = await options.kernel.resolveBase(ctx, c.req.param('base'))
    const answer = await options.kernel.automationCopilot(ctx, providerTransport, {
      baseId: base.baseId,
      automationId:
        typeof body.automation === 'string' && body.automation !== '' ? body.automation : null,
      draft: (body.draft ?? null) as Record<string, unknown> | null,
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      readData: body.read_data === true,
      language: screenLanguage(c),
    })
    return c.json({ data: answer })
  })

  // ── Base templates — chapter 20 ──
  app.get('/api/v1/:tenantRef/meta/templates', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const listing = await options.kernel.listTemplates(ctx)
    return c.json({ data: listing.templates, meta: { site: listing.site } })
  })

  app.get('/api/v1/:tenantRef/meta/templates/:key', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const entry = await options.kernel.getTemplate(ctx, c.req.param('key'))
    return c.json({ data: entry.template, meta: { source: entry.source } })
  })

  // `draft` before `:key`: a template may not be called « draft », the route would hide it.
  app.post('/api/v1/:tenantRef/admin/templates/draft', async (c) => {
    const body = await c.req.json<{ project?: unknown; request?: unknown; previous?: unknown }>()
    if (typeof body.project !== 'string' || typeof body.request !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'project, request' } })
    }
    const ctx = await contextFor(c, await bearer(c))
    const draft = await options.kernel.draftTemplate(ctx, providerTransport, {
      projectId: body.project,
      request: body.request,
      previous: body.previous,
    })
    return c.json({ data: draft })
  })

  app.post('/api/v1/:tenantRef/admin/templates', async (c) => {
    const body = await c.req.json<unknown>()
    const ctx = await contextFor(c, await bearer(c))
    const imported = await options.kernel.importTemplate(ctx, body)
    return c.json({ data: imported }, 201)
  })

  app.delete('/api/v1/:tenantRef/admin/templates/:key', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    await options.kernel.deleteTemplate(ctx, c.req.param('key'))
    return c.body(null, 204)
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
      language: screenLanguage(c),
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

  /** What a physical rename would touch; `?label=` is the label typed alongside. */
  const renameImpactOf = async (
    c: Context<{ Variables: Variables }, string>,
    ctx: RequestContext,
    kind: 'base' | 'table' | 'field',
    id: string,
  ) => {
    const label = c.req.query('label')
    const impact = await options.kernel.renameImpact(ctx, {
      kind,
      id,
      ...(label === undefined ? {} : { label }),
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
  }

  /** The physical rename itself, from its body. */
  const renamePhysicalOf = async (
    c: Context<{ Variables: Variables }, string>,
    ctx: RequestContext,
    kind: 'base' | 'table' | 'field',
    id: string,
  ) => {
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
    const result = await options.kernel.renamePhysical(ctx, {
      kind,
      id,
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
  }

  app.get('/api/v1/:tenantRef/admin/physical/:kind/:id', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    return renameImpactOf(c, ctx, physicalKind(c.req.param('kind')), c.req.param('id'))
  })

  app.post('/api/v1/:tenantRef/admin/physical/:kind/:id/rename', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    return renamePhysicalOf(c, ctx, physicalKind(c.req.param('kind')), c.req.param('id'))
  })

  // A field by its names, like every other field route: its catalog id is not in the
  // description of a base, and the interface has only the names to go by.
  const physicalField = async (c: Context<{ Variables: Variables }, string>) => {
    const ctx = await contextFor(c, await bearer(c))
    const field = await options.kernel.resolveField(
      ctx,
      c.req.param('base') ?? '',
      c.req.param('table') ?? '',
      c.req.param('field') ?? '',
    )
    return { ctx, id: field.fieldId }
  }

  app.get(
    '/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/physical',
    async (c) => {
      const { ctx, id } = await physicalField(c)
      return renameImpactOf(c, ctx, 'field', id)
    },
  )

  app.post(
    '/api/v1/:tenantRef/admin/bases/:base/tables/:table/fields/:field/physical/rename',
    async (c) => {
      const { ctx, id } = await physicalField(c)
      return renamePhysicalOf(c, ctx, 'field', id)
    },
  )

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
      /** Several target rows per row: a multi-link (chapter 04 §4 bis). */
      multiple?: boolean
    }>()
    const ctx = await contextFor(c, await bearer(c))

    if (typeof body.label !== 'string' || body.label.trim() === '') {
      throw new BasedbError('LABEL_EMPTY')
    }
    if (body.multiple !== undefined && typeof body.multiple !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'multiple' } })
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
      multiple: body.multiple,
    })

    return c.json(
      {
        data: {
          id: link.fieldId,
          label: link.label,
          name: link.name,
          description: link.description,
          kind: link.kind,
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
      format?: unknown
      /** A formula: `{ expression, timezone? }` (chapter 04 §7). */
      formula?: { expression?: unknown; timezone?: unknown }
      /** A lookup, a rollup, a count: the relation followed and what is read (§7 ter). */
      rollup?: { via?: unknown; via_table?: unknown; target?: unknown; aggregate?: unknown }
      /** A button: `{ label, color?, action, url?, automation? }` (chapter 17 §4). */
      button?: Record<string, unknown>
      /** A long text that holds HTML (chapter 04 §2.2). */
      rich?: unknown
    }>()
    const ctx = await contextFor(c, await bearer(c))

    if (body.rich !== undefined && typeof body.rich !== 'boolean') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'rich' } })
    }
    if (body.format !== undefined && (typeof body.format !== 'object' || body.format === null)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'format' } })
    }
    const formula = formulaOf(body.formula)
    const rollup = rollupOf(body.rollup)
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
      ...(body.format === undefined ? {} : { format: body.format as Record<string, unknown> }),
      ...(formula === undefined ? {} : { formula }),
      ...(rollup === undefined ? {} : { rollup }),
      ...(body.button === undefined ? {} : { button: body.button }),
      ...(body.rich === true ? { rich: true } : {}),
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
    const body = await c.req.json<{
      label?: string
      description?: string | null
      format?: unknown
      formula?: { expression?: unknown; timezone?: unknown }
    }>()
    if (
      body.label === undefined &&
      body.description === undefined &&
      body.format === undefined &&
      body.formula === undefined
    ) {
      throw new BasedbError('REQUEST_INVALID', {
        details: { field: 'label, description, format, formula' },
      })
    }
    const formula = formulaOf(body.formula)
    if (body.format !== undefined && (typeof body.format !== 'object' || body.format === null)) {
      throw new BasedbError('REQUEST_INVALID', { details: { field: 'format' } })
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
    const written: {
      label?: string
      description?: string | null
      format?: unknown
      formula?: { stored: boolean }
    } = {}
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
    // How the value reads — a format changes no column, hence no migration.
    if (body.format !== undefined) {
      const format = await options.kernel.setFieldFormat(ctx, {
        fieldId: field.fieldId,
        format: body.format as Record<string, unknown>,
      })
      written.format = {
        display: format.display,
        currency: format.currency,
        rating_max: format.ratingMax,
      }
    }
    // A formula's expression: a stored one rewrites its column (chapter 04 §7.7).
    let sql: readonly string[] = []
    if (formula !== undefined) {
      const table = await options.kernel.resolveTable(
        ctx,
        c.req.param('base'),
        c.req.param('table'),
      )
      const done = await options.kernel.setFormula(ctx, {
        tableId: table.tableId,
        field: field.name,
        formula,
      })
      written.formula = { stored: done.stored }
      sql = done.sql
    }
    return c.json({ data: { name: field.name, ...written }, meta: { sql } })
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
    personal: view.personal,
    locked: view.locked,
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
      personal: body.personal === true,
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
      locked: body.locked,
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
            can_embed: sharing.share.canEmbed,
            view_kind: sharing.share.viewKind,
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
      can_embed?: unknown
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
      canEmbed: (body.can_embed ?? false) as boolean,
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
  /** Reads of shared views, per address and link (chapter 15 §10). */
  const viewReads = new RateLimiter(120, 60_000)

  /**
   * A shared data view, read — chapter 15 §10: its shown fields and a page of its rows,
   * on the publisher's authority. The token situates it; no right on the table is asked.
   */
  const readSharedView = async (c: Context<{ Variables: Variables }, string>, after?: string) => {
    const verdict = viewReads.check(`${addressOf(c)}:${c.req.param('token')}`, Date.now())
    if (!verdict.allowed) {
      c.header('retry-after', String(verdict.retryAfter))
      throw new BasedbError('RATE_LIMIT_EXCEEDED', {
        details: { retry_after: verdict.retryAfter },
      })
    }
    const page = await options.kernel.openSharedView({
      token: c.req.param('token') ?? '',
      reader: await respondentOf(c),
      requestId: c.get('requestId'),
      ...(after === undefined || after === '' ? {} : { after }),
    })
    return c.json({
      data: {
        kind: page.kind,
        title: page.title,
        description: page.description,
        access: page.access,
        reader: page.reader,
        can_embed: page.canEmbed,
        fields: page.fields,
        spec: page.spec,
        rows: page.rows,
      },
      meta: { next_cursor: page.nextCursor },
    })
  }

  app.get('/api/v1/views/:token', (c) => readSharedView(c))
  app.get('/api/v1/views/:token/rows', (c) => readSharedView(c, c.req.query('after')))

  /** The iCalendar feed of a shared calendar or timeline (chapter 19 §2.1). */
  app.get('/api/v1/views/:token/calendar.ics', async (c) => {
    const verdict = viewReads.check(`${addressOf(c)}:${c.req.param('token')}`, Date.now())
    if (!verdict.allowed) {
      c.header('retry-after', String(verdict.retryAfter))
      throw new BasedbError('RATE_LIMIT_EXCEEDED', { details: { retry_after: verdict.retryAfter } })
    }
    const ics = await options.kernel.openSharedCalendar({
      token: c.req.param('token'),
      requestId: c.get('requestId'),
      host: (c.req.header('host') ?? 'basedb').replace(/[^A-Za-z0-9.:-]/g, ''),
    })
    return c.body(ics, 200, {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'no-cache',
    })
  })

  /**
   * Reads of shared dashboards, per address and link: a page runs each of its cards, and
   * again at each change of a filter — a wider allowance than a view's.
   */
  const dashboardReads = new RateLimiter(600, 60_000)
  const admitDashboardRead = (c: Context<{ Variables: Variables }, string>) => {
    const verdict = dashboardReads.check(`${addressOf(c)}:${c.req.param('token')}`, Date.now())
    if (!verdict.allowed) {
      c.header('retry-after', String(verdict.retryAfter))
      throw new BasedbError('RATE_LIMIT_EXCEEDED', {
        details: { retry_after: verdict.retryAfter },
      })
    }
  }

  /** A shared dashboard — chapter 18 §2.5: its tabs, filters, cards, and the fields shown. */
  app.get('/api/v1/dashboards/:token', async (c) => {
    admitDashboardRead(c)
    const page = await options.kernel.openSharedDashboard({
      token: c.req.param('token'),
      reader: await respondentOf(c),
      requestId: c.get('requestId'),
    })
    return c.json({
      data: {
        title: page.title,
        description: page.description,
        access: page.access,
        reader: page.reader,
        can_embed: page.canEmbed,
        tabs: page.tabs,
        parameters: page.parameters,
        cards: page.cards,
        tables: page.tables,
      },
    })
  })

  // One card, run on the publisher's authority. The body gives the filters' values alone:
  // what they filter is the dashboard's, never the visitor's.
  app.post('/api/v1/dashboards/:token/cards/:card', async (c) => {
    admitDashboardRead(c)
    const body = await c.req
      .json<{ values?: unknown; timezone?: unknown; week_start?: unknown }>()
      .catch(() => ({}) as { values?: unknown; timezone?: unknown; week_start?: unknown })
    const result = await options.kernel.runSharedCard({
      token: c.req.param('token'),
      reader: await respondentOf(c),
      requestId: c.get('requestId'),
      card: c.req.param('card'),
      values: body.values,
      timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
      weekStart: body.week_start === 0 ? 0 : 1,
    })
    return c.json({ data: result })
  })

  app.get('/api/v1/dashboards/:token/parameters/:parameter/values', async (c) => {
    admitDashboardRead(c)
    const values = await options.kernel.sharedParameterValues({
      token: c.req.param('token'),
      reader: await respondentOf(c),
      requestId: c.get('requestId'),
      parameter: c.req.param('parameter'),
    })
    return c.json({ data: values })
  })

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

  // The tokens the caller minted, on every base (chapter 11 §10) — revoked with the route
  // below, which lets a creator close their own door without `manage_tokens`.
  app.get('/api/v1/:tenantRef/me/tokens', async (c) => {
    const ctx = await contextFor(c, await bearer(c))
    const tokens = await options.kernel.listOwnApiTokens(ctx)
    return c.json({
      data: tokens.map((t) => ({
        ...serializeToken(t),
        base:
          t.base === null
            ? null
            : {
                name: t.base.name,
                label: t.base.label,
                environment: t.base.environment,
                production: t.base.production,
              },
      })),
    })
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

/** What a SQL statement returned, in the API's words — the console's, a view's. */
function serializeSqlResult(result: SqlConsoleResult) {
  return {
    columns: result.columns,
    rows: result.rows,
    row_count: result.rowCount,
    command: result.command,
    duration_ms: result.durationMs,
    truncated: result.truncated,
    schema: result.schema,
    mode: result.mode,
  }
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

/** A formula as a request carries it: an expression, and the time zone AUJOURDHUI() reads. */
function formulaOf(
  raw: { expression?: unknown; timezone?: unknown } | undefined,
): { expression: string; timezone?: string } | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || raw === null || typeof raw.expression !== 'string') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'formula.expression' } })
  }
  if (raw.timezone !== undefined && raw.timezone !== null && typeof raw.timezone !== 'string') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'formula.timezone' } })
  }
  return {
    expression: raw.expression,
    ...(typeof raw.timezone === 'string' ? { timezone: raw.timezone } : {}),
  }
}

/** The path of a lookup, a rollup or a count, by physical names (chapter 04 §7 ter). */
function rollupOf(
  raw: { via?: unknown; via_table?: unknown; target?: unknown; aggregate?: unknown } | undefined,
):
  | {
      via: string
      viaTable?: string
      target?: string
      aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max'
    }
  | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || raw === null || typeof raw.via !== 'string') {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'rollup.via' } })
  }
  for (const key of ['via_table', 'target', 'aggregate'] as const) {
    if (raw[key] !== undefined && raw[key] !== null && typeof raw[key] !== 'string') {
      throw new BasedbError('REQUEST_INVALID', { details: { field: `rollup.${key}` } })
    }
  }
  const aggregate = raw.aggregate as string | undefined | null
  if (
    aggregate !== undefined &&
    aggregate !== null &&
    !['count', 'sum', 'avg', 'min', 'max'].includes(aggregate)
  ) {
    throw new BasedbError('REQUEST_INVALID', { details: { field: 'rollup.aggregate' } })
  }
  return {
    via: raw.via,
    ...(typeof raw.via_table === 'string' ? { viaTable: raw.via_table } : {}),
    ...(typeof raw.target === 'string' ? { target: raw.target } : {}),
    ...(typeof aggregate === 'string'
      ? { aggregate: aggregate as 'count' | 'sum' | 'avg' | 'min' | 'max' }
      : {}),
  }
}
