import { SHELL_SEGMENT, STATIC_BUILD } from '@/lib/static-shell'
import App from '../page'

/** The static build exports this page once, as the shell of every address (lib/static-shell.ts). */
export function generateStaticParams(): { address: string[] }[] {
  return STATIC_BUILD ? [{ address: [SHELL_SEGMENT] }] : []
}

/**
 * Every address of the application — `/bases/crm/tables/contacts`, `/parametres/securite`:
 * the same screen as `/`, which reads the address itself (lib/address-bar.ts). A bookmark
 * or a reload lands here; moving about inside the screen never reloads it.
 *
 * The shared links keep their own routes — `/v/`, `/d/`, `/f/`, `/invitation/` —, which
 * Next.js serves before this one. An address naming nothing is still drawn by the screen:
 * a table one may not see must read exactly as a typo (chapter 11 §7), so both say « cette
 * page n'existe pas » in the same place.
 */
export default function Address() {
  return <App />
}
