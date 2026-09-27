import App from '../page'

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
