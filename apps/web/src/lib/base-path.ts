/**
 * The path basedb is served under — `/basedb` behind a gateway at
 * `https://gateway.exemple.fr/basedb/`, empty at the root of its own address
 * (`BASEDB_BASE_PATH`, next.config.ts).
 *
 * Next adds it by itself to its links and its router. What this module is for: the
 * addresses the code writes by hand — the history of the address bar, which the screen
 * keeps in step with what it shows, and the links a person copies to share.
 */

export const BASE_PATH: string = process.env.BASEDB_BASE_PATH_BUILT ?? ''

/** An address of the interface, as the browser must use it: `/bases/x` → `/basedb/bases/x`. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`
}

/** A path the browser shows, as the interface names it: `/basedb/bases/x` → `/bases/x`. */
export function withoutBase(pathname: string): string {
  if (BASE_PATH === '' || !pathname.startsWith(BASE_PATH)) return pathname
  const rest = pathname.slice(BASE_PATH.length)
  return rest === '' ? '/' : rest
}

/** An absolute link to a page of the interface, for someone else to open. */
export function linkTo(path: string): string {
  return `${window.location.origin}${withBase(path)}`
}
