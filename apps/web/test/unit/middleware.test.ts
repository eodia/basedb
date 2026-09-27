import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { LOCALE_COOKIE } from '../../src/lib/i18n'
import { middleware } from '../../src/middleware'

/**
 * `?lang=` — a page asked for in a language, as the public site links to the demo: the
 * language remembered, and the parameter gone from the address.
 */

const visit = (path: string) => middleware(new NextRequest(`https://demo.example${path}`))

describe('middleware', () => {
  it('remembers the language asked for, and sends back to the address without it', () => {
    const response = visit('/?lang=de')
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://demo.example/')
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe('de')
  })

  it('reads a tag the way a browser writes it, and keeps the rest of the query', () => {
    const response = visit('/v/abc?embed=1&lang=pt-br')
    expect(response.headers.get('location')).toBe('https://demo.example/v/abc?embed=1')
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe('pt-BR')
  })

  it('sends back to the address the browser used, behind a proxy', () => {
    const behind = middleware(
      new NextRequest('http://localhost:3001/?lang=ja', {
        headers: { host: 'demo.basedb.eodia.com', 'x-forwarded-proto': 'https' },
      }),
    )
    expect(behind.headers.get('location')).toBe('https://demo.basedb.eodia.com/')
    // A host that is not one keeps the server's own address.
    const odd = middleware(
      new NextRequest('http://localhost:3001/?lang=ja', { headers: { host: 'a b/c' } }),
    )
    expect(odd.headers.get('location')).toBe('http://localhost:3001/')
  })

  it('drops a language it does not speak, and leaves every other page alone', () => {
    const unknown = visit('/?lang=xx')
    expect(unknown.headers.get('location')).toBe('https://demo.example/')
    expect(unknown.cookies.get(LOCALE_COOKIE)).toBeUndefined()
    const plain = visit('/?embed=1')
    expect(plain.headers.get('location')).toBeNull()
    expect(plain.headers.get('x-middleware-next')).toBe('1')
  })
})
