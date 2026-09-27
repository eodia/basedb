import { LOCALE_COOKIE } from '@/lib/i18n'
import { localeOfTag } from '@basedb/contracts'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * A page asked for in a language — `?lang=de` —, the way the public site links to the
 * demo: the language is remembered as if it had been chosen (`LOCALE_COOKIE`), and the
 * browser is sent back to the same address without the parameter, which the page is then
 * served in. A tag we do not speak is dropped; without the parameter, nothing happens.
 *
 * The parameter leaves the address: left there, a reload would override the language of the
 * account signed in since.
 */
export function middleware(request: NextRequest): NextResponse {
  const asked = request.nextUrl.searchParams.get('lang')
  if (asked === null) return NextResponse.next()

  const rest = new URLSearchParams(request.nextUrl.search)
  rest.delete('lang')
  const query = rest.toString()
  const back = new URL(
    `${request.nextUrl.pathname}${query === '' ? '' : `?${query}`}`,
    publicOrigin(request),
  )
  const response = NextResponse.redirect(back, 303)
  const chosen = localeOfTag(asked)
  if (chosen !== null) {
    // As `rememberLocale` writes it: the page's own scripts read it and take it back.
    response.cookies.set(LOCALE_COOKIE, chosen, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }
  return response
}

/**
 * Where the browser is: the address it asked for, as the proxy in front passed it on. Behind
 * one — the image's router, a TLS proxy —, Next knows only its own listening address.
 */
function publicOrigin(request: NextRequest): string {
  const first = (name: string) => request.headers.get(name)?.split(',')[0]?.trim()
  const host = first('x-forwarded-host') ?? first('host')
  const scheme = first('x-forwarded-proto') ?? request.nextUrl.protocol.replace(/:$/, '')
  return host !== undefined &&
    /^[A-Za-z0-9.-]+(:\d+)?$/.test(host) &&
    (scheme === 'http' || scheme === 'https')
    ? `${scheme}://${host}`
    : request.nextUrl.origin
}

export const config = {
  // The pages, not the scripts, styles and images Next serves beside them.
  matcher: ['/((?!_next/|favicon.ico|icon.svg|apple-icon.png).*)'],
}
