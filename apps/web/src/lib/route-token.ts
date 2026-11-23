import { useParams } from 'next/navigation'
import { withoutBase } from './base-path'
import { SHELL_SEGMENT } from './static-shell'

/**
 * The token of a shared link's page — `/f/<jeton>`, `/v/<jeton>`, `/invitation/<jeton>`.
 *
 * Next gives it; in the static build every token is served the same shell (lib/static-shell.ts),
 * whose parameter is the shell's own: the address the browser shows holds the real one —
 * read as Next reads it, still encoded.
 */
export function useRouteToken(): string {
  const { token } = useParams<{ token: string }>()
  if (token !== SHELL_SEGMENT || typeof window === 'undefined') return token
  return withoutBase(window.location.pathname).split('/')[2] ?? ''
}
